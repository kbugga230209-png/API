#!/usr/bin/env python3
"""
Publishes build verification metadata and IPA blob reference to the current GitHub Check Run output
so CI consumers with API-only access can inspect exact compiler output and verify the built IPA.
"""
import base64
import json
import os
import subprocess
import sys


def gh_api(endpoint: str, method: str = "GET", payload_obj: dict | None = None) -> dict:
    cmd = ["gh", "api", endpoint, "--method", method]
    input_str = None
    if payload_obj is not None:
        cmd.extend(["--input", "-"])
        input_str = json.dumps(payload_obj)

    res = subprocess.run(cmd, input=input_str, text=True, capture_output=True)
    if res.returncode != 0:
        print(f"gh api failed ({method} {endpoint}):\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}", file=sys.stderr)
        sys.exit(res.returncode)
    return json.loads(res.stdout) if res.stdout.strip() else {}


def create_blob(repo: str, file_path: str) -> str:
    with open(file_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    resp = gh_api(f"repos/{repo}/git/blobs", method="POST", payload_obj={"content": b64, "encoding": "base64"})
    return resp["sha"]


def main() -> None:
    repo = os.environ["GITHUB_REPOSITORY"]
    run_id = os.environ["GITHUB_RUN_ID"]

    ipa_path = "ios/build/ipa/INKVAULT.ipa"
    ipa_blob = create_blob(repo, ipa_path)

    with open("ios/build/xcodebuild-simulator.log", errors="replace") as f:
        sim_log = f.read()
    with open("ios/build/xcodebuild-archive.log", errors="replace") as f:
        arc_log = f.read()

    sim_warnings = [l for l in sim_log.splitlines() if "warning:" in l.lower()]
    arc_warnings = [l for l in arc_log.splitlines() if "warning:" in l.lower()]

    with open("ios/build/altstore-verification.json") as f:
        altstore_verification = json.load(f)

    report = {
        "xcode_version": open("xcode-version.txt").read().strip(),
        "xcodegen_output": open("build-xcodegen.txt").read().strip(),
        "simulator_tail": "\n".join(sim_log.splitlines()[-25:]),
        "archive_tail": "\n".join(arc_log.splitlines()[-25:]),
        "simulator_warnings": sim_warnings[:30],
        "archive_warnings": arc_warnings[:30],
        "ipa_sha256": open("ios/build/ipa/INKVAULT.ipa.sha256").read().strip(),
        "ipa_size_bytes": os.path.getsize(ipa_path),
        "ipa_blob_sha": ipa_blob,
        "altstore_verification": altstore_verification,
        "compiled_plist": open("ios/build/compiled-info-plist.txt").read(),
    }

    report_path = "ios/build/verification-report.json"
    with open(report_path, "w") as out:
        json.dump(report, out, indent=2)

    report_blob = create_blob(repo, report_path)

    jobs_resp = gh_api(f"repos/{repo}/actions/runs/{run_id}/jobs")
    for job in jobs_resp.get("jobs", []):
        if "Xcode 16" in job.get("name", ""):
            check_id = job["id"]
            summary_payload = {
                "ipa_blob_sha": ipa_blob,
                "report_blob_sha": report_blob,
                "ipa_sha256": report["ipa_sha256"],
                "ipa_size_bytes": report["ipa_size_bytes"],
                "simulator_warning_count": len(sim_warnings),
                "archive_warning_count": len(arc_warnings),
                "altstore_personal_team_compatible": altstore_verification.get("altstore_personal_team_compatible"),
            }
            gh_api(
                f"repos/{repo}/check-runs/{check_id}",
                method="PATCH",
                payload_obj={
                    "output": {
                        "title": "INKVAULT.ipa Compiled & AltStore-Verified",
                        "summary": json.dumps(summary_payload),
                    }
                },
            )
            print("✓ Published verification summary to check run", check_id)


if __name__ == "__main__":
    main()
