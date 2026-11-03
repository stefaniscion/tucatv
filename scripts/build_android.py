"""Build and sign Android using an existing, untracked keystore."""

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def run(command, cwd=ROOT):
    subprocess.run([str(part) for part in command], cwd=cwd, check=True)


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    sdk_value = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if not sdk_value:
        raise SystemExit("Set ANDROID_HOME or ANDROID_SDK_ROOT to your Android SDK.")
    sdk = Path(sdk_value).expanduser().resolve()
    key = Path(os.environ.get("TUCATV_KEYSTORE", ROOT / "signing/tucatv-release.p12")).expanduser().resolve()
    password = (
        Path(os.environ.get("TUCATV_KEYSTORE_PASSWORD_FILE", ROOT / "signing/password.txt")).expanduser().resolve()
    )
    alias = os.environ.get("TUCATV_KEY_ALIAS", "tucatv")
    for path in (key, password):
        if not path.is_file():
            raise SystemExit(f"Required signing file missing: {path}. No new key was generated.")
    tools = sdk / "build-tools/34.0.0"
    windows = os.name == "nt"
    align = tools / ("zipalign.exe" if windows else "zipalign")
    signer = tools / ("apksigner.bat" if windows else "apksigner")
    for path in (align, signer):
        if not path.is_file():
            raise SystemExit(f"Install Android Build Tools 34.0.0: {path} missing.")
    npm = shutil.which("npm.cmd" if windows else "npm")
    if not npm:
        raise SystemExit("npm is required. Install Node.js and run npm ci first.")
    version = json.loads((ROOT / "package.json").read_text())["version"]
    gradle_text = (ROOT / "android/app/build.gradle").read_text()
    match = re.search(r'versionName\s+"([^"]+)"', gradle_text)
    if not match or match.group(1) != version:
        raise SystemExit("package.json and Android versionName must match.")
    run([npm, "run", "android:sync"])
    wrapper = ROOT / "android" / ("gradlew.bat" if windows else "gradlew")
    run([wrapper, "--no-daemon", ":app:assembleRelease"], cwd=ROOT / "android")
    unsigned = ROOT / "android/app/build/outputs/apk/release/app-release-unsigned.apk"
    output_dir = ROOT / "artifacts/android"
    output_dir.mkdir(parents=True, exist_ok=True)
    aligned = output_dir / "aligned-unsigned.apk"
    output = output_dir / f"TucaTV-{version}.apk"
    pending = output_dir / f".TucaTV-{version}.pending.apk"
    run([align, "-p", "-f", "4", unsigned, aligned])
    try:
        run(
            [
                signer,
                "sign",
                "--ks",
                key,
                "--ks-key-alias",
                alias,
                "--ks-pass",
                f"file:{password}",
                "--out",
                pending,
                aligned,
            ]
        )
        run([signer, "verify", "--verbose", "--print-certs", pending])
        pending.replace(output)
    finally:
        aligned.unlink(missing_ok=True)
        pending.unlink(missing_ok=True)
    print(f"Signed APK: {output}")


if __name__ == "__main__":
    main()
