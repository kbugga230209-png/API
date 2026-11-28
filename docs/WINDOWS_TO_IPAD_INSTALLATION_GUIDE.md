# INKVAULT — Windows PC to iPad Installation & 7-Day Refresh Guide

This guide explains how to install `INKVAULT.ipa` onto your personal iPad from a **Windows 10/11 PC** without owning a Mac and without paying $99/year for a commercial Apple Developer Program membership.

---

## 1. Prerequisites on Windows 10 / 11

> **Important:** You **must** install Apple's direct standalone Windows installers for iTunes and iCloud — **do NOT** use the Microsoft Store versions (Microsoft Store builds omit the Apple Mobile Device USB pairing libraries required for local IPA signing).

1. Uninstall any Microsoft Store versions of **iTunes** or **iCloud** if previously installed.
2. Download and install **iTunes for Windows (64-bit direct installer)** from Apple Support and **iCloud for Windows (direct installer)**. Reboot Windows once after installation.
3. On your **iPad**, enable **Developer Mode** (required by Apple on iPadOS 16+ for all personal development builds):
   - Note: If **Settings → Privacy & Security → Developer Mode** is not visible yet, it automatically appears immediately after your first sideload installation below!

---

## 2. Method A (Recommended): AltStore / AltServer — Automatic Wi-Fi 7-Day Refresh

AltStore uses your free Apple ID ("Personal Team", $0) and automatically refreshes INKVAULT over home Wi-Fi so it never expires.

### Step-by-Step Initial Setup
1. Download **AltServer for Windows** from `https://altstore.io` and extract/install `AltInstaller.msi`.
2. Launch **iTunes** and **iCloud** on Windows, then connect your **iPad to your Windows PC via USB cable**.
   - Unlock the iPad and tap **Trust This Computer** (enter your iPad passcode).
   - Inside iTunes on Windows, click the small **iPad icon**, scroll to **Options**, check **"Sync with this iPad over Wi-Fi"**, and click **Apply**.
3. Launch **AltServer** from the Windows Start Menu. Click the diamond **AltServer icon** in your Windows system tray (bottom-right taskbar):
   - Select **Install AltStore → [Your iPad Name]**.
   - Enter your **free Apple ID email and password** when prompted by AltServer (this authenticates directly with Apple's provisioning servers over TLS to generate a free 7-day Personal Team certificate for your iPad's UDID; if prompted for a 6-digit Apple 2FA code, enter it).
4. On your **iPad**, enable Developer Mode & Trust your Personal Team profile:
   - Open **Settings → General → VPN & Device Management → Developer App → [Your Apple ID Email]** and tap **Trust**.
   - Open **Settings → Privacy & Security → Developer Mode**, toggle **Developer Mode ON**, tap **Restart**, and confirm after reboot.
5. Install **`INKVAULT.ipa`** onto your iPad:
   - Copy **`INKVAULT.ipa`** to your iPad (via **iCloud Drive**, **Google Drive**, email, or local transfer so it is visible in the iPad **Files** app).
   - Keep your iPad connected to your Windows PC (USB or same Wi-Fi with AltServer + iTunes running).
   - Open the **AltStore** app on your iPad → go to the **My Apps** tab → tap the **`+`** button in the top-left corner → select **`INKVAULT.ipa`**.
   - If AltStore asks whether to keep App Extensions, choose **Remove App Extensions** (INKVAULT has none and uses zero paid entitlements).
   - Within ~15 seconds, **INKVAULT** appears on your iPad Home Screen!

### Automatic 7-Day Refresh (Zero Data Loss)
- Free Apple Personal Team provisioning profiles are valid for **7 days**.
- Whenever your Windows PC is awake with **AltServer** running in the system tray and your iPad is on the **same Wi-Fi network** (or plugged in via USB), AltStore refreshes INKVAULT in the background automatically (you can also tap **Refresh All** inside AltStore → **My Apps** at any time).
- **Your Notebooks Are Safe:** Refreshing/re-signing updates only the code-signing profile; all INKVAULT notebooks, PDFs, audio notes, IndexedDB vaults, Keychain AES-256 keys, and `Application Support/InkVaultBackups/` checkpoints remain **100% intact**. Even if 7 days pass while travelling away from your PC, **do NOT delete the INKVAULT icon** — simply reconnect to AltServer and tap **Refresh All** (or re-sideload `INKVAULT.ipa` with the same Apple ID) to unlock the app immediately with all data preserved.

---

## 3. Method B (Alternative): Sideloadly on Windows (Direct USB/Wi-Fi Install Without AltStore Slot)

Apple limits free Personal Teams to **3 sideloaded apps active simultaneously** per device. Because AltStore itself uses 1 of those 3 slots, if you prefer to install `INKVAULT.ipa` directly using only **1 slot**:

1. Download **Sideloadly (64-bit Windows)** from `https://sideloadly.io`.
2. Connect your iPad to your Windows PC via USB and tap **Trust This Computer**.
3. Open **Sideloadly**:
   - Confirm your iPad appears under **iDevice**.
   - Enter your **Apple ID** in the Apple Account field.
   - Drag and drop **`INKVAULT.ipa`** onto the **IPA** slot.
   - Keep **Apple ID Sideload** selected under Signing Mode and click **Start** (enter your Apple ID password & 2FA code directly in Sideloadly's Apple auth prompt).
4. Once `Done!` appears, trust your developer certificate on iPad under **Settings → General → VPN & Device Management** (first time only) and launch **INKVAULT**!
5. To refresh every 7 days without losing any data: connect via USB (or enable Wi-Fi sideloading), drop `INKVAULT.ipa` into Sideloadly with the **same Apple ID**, and click **Start** — Sideloadly overwrites only the binary signature while preserving your entire notebook container.

---

## 4. Rebuilding `INKVAULT.ipa` Automatically in Codemagic (Optional Cloud Rebuild)

`codemagic.yaml` is preconfigured at the repository root:
1. Sign in to `https://codemagic.io` with GitHub (Free Personal tier includes **500 free `mac_mini_m2` build minutes/month**).
2. Add your private GitHub repository and select **`codemagic.yaml`**.
3. Run workflow **`inkvault-ipados-sideload-ipa`** (no paid Apple credentials needed!).
4. Download **`INKVAULT.ipa`** and **`xcodebuild-archive.log`** from the **Artifacts** panel when the build finishes.
