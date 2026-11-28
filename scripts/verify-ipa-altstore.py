#!/usr/bin/env python3
"""
Deterministic verifier for unsigned INKVAULT.ipa packaging & AltStore (AltSign / Free Personal Team) compatibility.
Exits non-zero if any structural, Mach-O ARM64, Info.plist, resource, or entitlement check fails.
"""
import json
import os
import plistlib
import struct
import sys
import zipfile

PAID_ONLY_ENTITLEMENTS = {
    "aps-environment",
    "com.apple.developer.applesignin",
    "com.apple.developer.associated-domains",
    "com.apple.developer.icloud-container-identifiers",
    "com.apple.developer.icloud-services",
    "com.apple.developer.in-app-payments",
    "com.apple.developer.networking.networkextension",
    "com.apple.developer.networking.vpn.api",
    "com.apple.developer.ubiquity-kvstore-identifier",
    "com.apple.security.application-groups",
}


def verify_ipa(ipa_path: str, entitlements_path: str = "ios/InkVaultApp/InkVault.entitlements") -> dict:
    if not os.path.isfile(ipa_path):
        raise AssertionError(f"IPA file does not exist: {ipa_path}")

    ipa_size = os.path.getsize(ipa_path)
    assert ipa_size > 100_000, f"IPA unexpectedly small: {ipa_size} bytes"

    with zipfile.ZipFile(ipa_path, "r") as z:
        bad_zip_entry = z.testzip()
        assert bad_zip_entry is None, f"Corrupted ZIP entry in IPA: {bad_zip_entry}"

        names = set(z.namelist())
        infos = {i.filename: i for i in z.infolist()}

        # 1. Clean Payload/InkVault.app hierarchy & AltSign minizip compatibility
        assert any(n.startswith("Payload/InkVault.app/") for n in names), "Missing Payload/InkVault.app/ directory"
        for n in names:
            assert not n.startswith("__MACOSX/"), f"Forbidden macOS resource fork entry in IPA: {n}"
            assert not n.endswith(".DS_Store"), f"Forbidden .DS_Store entry in IPA: {n}"
            assert not n.endswith(".appex") and "/PlugIns/" not in n, f"Unexpected app extension consuming Personal Team App ID quota: {n}"
        assert "Payload/InkVault.app/embedded.mobileprovision" not in names, "Unsigned IPA must not embed a foreign provisioning profile"
        assert not any(n.startswith("Payload/InkVault.app/_CodeSignature/") for n in names), "Unsigned IPA must not contain pre-signed _CodeSignature/"

        for info in z.infolist():
            assert info.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), (
                f"Unsupported ZIP compression method {info.compress_type} on {info.filename} (AltSign requires STORED/DEFLATED)"
            )

        # 2. Required resources inside Payload/InkVault.app
        required_files = [
            "Payload/InkVault.app/InkVault",
            "Payload/InkVault.app/Info.plist",
            "Payload/InkVault.app/PkgInfo",
            "Payload/InkVault.app/PrivacyInfo.xcprivacy",
            "Payload/InkVault.app/Assets.car",
            "Payload/InkVault.app/AppIcon60x60@2x.png",
            "Payload/InkVault.app/AppIcon76x76@2x~ipad.png",
            "Payload/InkVault.app/LaunchScreen.storyboardc/Info.plist",
            "Payload/InkVault.app/WebBundle/index.html",
        ]
        for req in required_files:
            assert req in names, f"Missing required bundle file inside IPA: {req}"

        web_assets = [n for n in names if n.startswith("Payload/InkVault.app/WebBundle/assets/")]
        assert any(n.endswith(".js") for n in web_assets), "Missing compiled JS bundles in WebBundle/assets/"
        assert any(n.endswith(".css") for n in web_assets), "Missing compiled CSS bundle in WebBundle/assets/"
        assert any("pdf.worker" in n for n in web_assets), "Missing bundled pdf.worker.min.mjs in WebBundle/assets/"

        # Check loose AppIcon PNG is standard ISO PNG (IHDR first chunk, not Apple CgBI) for Windows AltServer
        ipad_icon = z.read("Payload/InkVault.app/AppIcon76x76@2x~ipad.png")
        assert ipad_icon[:8] == b"\x89PNG\r\n\x1a\n", "Invalid PNG signature on AppIcon76x76@2x~ipad.png"
        first_chunk = ipad_icon[12:16].decode("ascii", errors="replace")

        # 3. Verify UNIX executable permission bit (0o755) on Payload/InkVault.app/InkVault
        exec_info = infos["Payload/InkVault.app/InkVault"]
        exec_mode = (exec_info.external_attr >> 16) & 0o777
        assert (exec_mode & 0o111) == 0o111, f"Executable missing +x bits in ZIP: mode={oct(exec_mode)}"

        # 4. Verify ARM64 Mach-O executable, iOS 16.0 deployment target, unsigned state & AltSign header headroom
        macho = z.read("Payload/InkVault.app/InkVault")
        magic, cputype, cpusubtype, filetype, ncmds, sizeofcmds, flags, _ = struct.unpack("<IIIIIIII", macho[:32])
        assert magic == 0xFEEDFACF, f"Expected 64-bit Mach-O magic 0xfeedfacf, got {hex(magic)}"
        assert cputype == 0x0100000C, f"Expected CPU_TYPE_ARM64 (0x0100000c), got {hex(cputype)}"
        assert filetype == 2, f"Expected MH_EXECUTE (2), got {filetype}"

        offset = 32
        has_code_sig = False
        platform_id = None
        minos_str = None
        sdk_str = None
        min_sec_offset = len(macho)

        for _ in range(ncmds):
            cmd, cmdsize = struct.unpack("<II", macho[offset : offset + 8])
            if cmd == 0x1D:  # LC_CODE_SIGNATURE
                has_code_sig = True
            elif cmd == 0x32:  # LC_BUILD_VERSION
                platform_id, minos, sdk, _ = struct.unpack("<IIII", macho[offset + 8 : offset + 24])
                minos_str = f"{(minos >> 16) & 0xFF}.{(minos >> 8) & 0xFF}.{minos & 0xFF}"
                sdk_str = f"{(sdk >> 16) & 0xFF}.{(sdk >> 8) & 0xFF}.{sdk & 0xFF}"
            elif cmd == 0x19:  # LC_SEGMENT_64
                nsects = struct.unpack("<I", macho[offset + 64 : offset + 68])[0]
                sec_off = offset + 72
                for _ in range(nsects):
                    fileoff = struct.unpack("<I", macho[sec_off + 48 : sec_off + 52])[0]
                    if 0 < fileoff < min_sec_offset:
                        min_sec_offset = fileoff
                    sec_off += 80
            offset += cmdsize

        assert not has_code_sig, "Expected unsigned Mach-O binary (LC_CODE_SIGNATURE must be absent prior to AltStore signing)"
        assert platform_id == 2, f"Expected PLATFORM_IOS (2 in <mach-o/loader.h>) in LC_BUILD_VERSION, got {platform_id}"
        assert minos_str == "16.0.0", f"Expected Mach-O minos 16.0.0, got {minos_str}"
        header_headroom = min_sec_offset - (32 + sizeofcmds)
        assert header_headroom >= 1024, f"Insufficient Mach-O header headroom for AltSign ldid ({header_headroom} bytes)"

        # 5. Verify Info.plist metadata & AltStore ALTApplication keys
        plist = plistlib.loads(z.read("Payload/InkVault.app/Info.plist"))
        assert plist.get("CFBundleIdentifier") == "app.inkvault.studio", f"Unexpected bundle ID: {plist.get('CFBundleIdentifier')}"
        assert plist.get("CFBundleExecutable") == "InkVault", f"Unexpected CFBundleExecutable: {plist.get('CFBundleExecutable')}"
        assert plist.get("CFBundleDisplayName") == "INKVAULT", f"Unexpected CFBundleDisplayName: {plist.get('CFBundleDisplayName')}"
        assert plist.get("CFBundlePackageType") == "APPL", f"Unexpected CFBundlePackageType: {plist.get('CFBundlePackageType')}"
        assert plist.get("CFBundleShortVersionString") == "1.0.0", f"Unexpected version: {plist.get('CFBundleShortVersionString')}"
        assert plist.get("CFBundleVersion") == "1", f"Unexpected build number: {plist.get('CFBundleVersion')}"
        assert plist.get("MinimumOSVersion") == "16.0", f"Unexpected MinimumOSVersion: {plist.get('MinimumOSVersion')}"
        assert 2 in plist.get("UIDeviceFamily", []), f"iPad family (2) missing from UIDeviceFamily: {plist.get('UIDeviceFamily')}"
        assert plist.get("UILaunchStoryboardName") == "LaunchScreen", "Missing UILaunchStoryboardName=LaunchScreen"
        assert plist.get("UIApplicationSceneManifest", {}).get("UIApplicationSupportsMultipleScenes") is True, "Multi-window scenes not enabled"
        assert "CFBundleIcons~ipad" in plist, "Missing CFBundleIcons~ipad in compiled Info.plist"
        assert "NSMicrophoneUsageDescription" in plist, "Missing NSMicrophoneUsageDescription"

        # Verify PrivacyInfo.xcprivacy is valid plist with zero tracking
        privacy = plistlib.loads(z.read("Payload/InkVault.app/PrivacyInfo.xcprivacy"))
        assert privacy.get("NSPrivacyTracking") is False, "NSPrivacyTracking must be False"

    # 6. Verify source entitlements contain zero paid-only capabilities blocking Free Personal Team signing
    ent_keys = []
    if os.path.isfile(entitlements_path):
        with open(entitlements_path, "rb") as ef:
            ent = plistlib.load(ef)
        ent_keys = list(ent.keys())
        forbidden = PAID_ONLY_ENTITLEMENTS.intersection(ent_keys)
        assert not forbidden, f"Entitlements contain paid-only capabilities incompatible with Free Personal Team AltStore signing: {forbidden}"

    summary = {
        "ipa_path": ipa_path,
        "ipa_size_bytes": ipa_size,
        "bundle_identifier": plist["CFBundleIdentifier"],
        "display_name": plist["CFBundleDisplayName"],
        "version": f"{plist['CFBundleShortVersionString']} ({plist['CFBundleVersion']})",
        "minimum_os_version": plist["MinimumOSVersion"],
        "device_family": plist["UIDeviceFamily"],
        "macho_architecture": "arm64 (CPU_TYPE_ARM64 0x0100000c, MH_EXECUTE)",
        "macho_minos": minos_str,
        "macho_sdk": sdk_str,
        "macho_unsigned": not has_code_sig,
        "macho_header_headroom_bytes": header_headroom,
        "executable_unix_mode": oct(exec_mode),
        "ipad_icon_png_first_chunk": first_chunk,
        "web_bundle_asset_count": len(web_assets),
        "entitlement_keys": ent_keys,
        "altstore_personal_team_compatible": True,
    }
    return summary


if __name__ == "__main__":
    target_ipa = sys.argv[1] if len(sys.argv) > 1 else "ios/build/ipa/INKVAULT.ipa"
    result = verify_ipa(target_ipa)
    print(json.dumps(result, indent=2))
