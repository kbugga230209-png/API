# Android distribution

The app is a **Trusted Web Activity (TWA)** wrapper around the deployed PWA:
`android/` contains the shell, and all product logic stays in the web app. That
means one codebase, one release cadence, and no duplicated nutrition catalog — a
wrapper cannot drift from the site.

## What CI has actually done

Run [`android release`](https://github.com/kbugga230209-png/API/actions/workflows/android-release.yml)
on every push that touches `android/`:

1. assembles `:app:assembleDebug` on `ubuntu-latest` with JDK 17, Android SDK 35,
   Gradle 8.11.1 and AGP 8.7.3 (all pinned in the repository);
2. verifies the APK with `apksigner verify --print-certs` and `zipalign -c`;
3. dumps `package:` / `launchable-activity:` from `aapt2`;
4. attempts `:app:assembleRelease` **without** signing material and fails the job
   if Gradle produces an APK instead of refusing;
5. uploads the debug APK, the verification text and the SHA-256 for 14 days.

The debug APK is a build artifact for verification, not a distribution. No
signed release APK exists yet — `/download` says so.

## Reproducible build configuration

| Item | Value | Where |
| --- | --- | --- |
| AGP | 8.7.3 | `android/build.gradle.kts` |
| Gradle | 8.11.1 | `.github/workflows/android-release.yml` (+ `android/gradle/wrapper.properties` for reference) |
| JDK | 17 (temurin) | workflow |
| compileSdk / targetSdk | 35 | `android/app/build.gradle.kts` |
| minSdk | 24 | same |
| applicationId | `app.bharatbite` | same |
| Kotlin stdlib | forced to 1.9.24 | same (prevents duplicate `jdk8` classes from older transitive deps) |

There is no `gradlew` in the repository on purpose: a wrapper script without its
60 KB wrapper JAR looks runnable and is not. CI installs Gradle at the pinned
version; locally use `gradle` 8.11.1 or generate a wrapper with
`gradle wrapper --gradle-version 8.11.1` (do not commit it unless you commit the
JAR too).

Reproducible here means "the same commit yields an equivalent APK with the same
configuration". It is not byte-identical across JDK builds, and the release notes
must not claim otherwise. What *is* verifiable is the digest: every artifact is
published with its SHA-256 and the signing certificate digest.

## Keystore requirements

One keystore for the app's lifetime. Losing it without Play App Signing means
losing the ability to update the app.

```bash
# RSA 4096, 25+ years validity, distinct passwords for store and key
keytool -genkeypair -v \
  -keystore bharatbite-release.keystore \
  -alias bharatbite \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=BharatBite, OU=Android, O=BharatBite, L=Nadiad, ST=Gujarat, C=IN"

# what CI receives (never commit either file)
base64 -w0 bharatbite-release.keystore > keystore.b64
keytool -list -v -keystore bharatbite-release.keystore -alias bharatbite | grep SHA256
```

| Repository secret | Content |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | base64 of the `.keystore` file |
| `ANDROID_KEYSTORE_PASSWORD` | store password |
| `ANDROID_KEY_ALIAS` | `bharatbite` |
| `ANDROID_KEY_PASSWORD` | key password |

The workflow decodes the keystore into `$RUNNER_TEMP`, `chmod 600`s it, never
echoes a password, and deletes the file in an `if: always()` step. If any secret
is missing the release job fails before building, so an unsigned APK can never be
mistaken for a release.

Recommended: enrol in **Play App Signing** and keep this keystore as the upload
key. Then a lost upload key can be reset by Google, and the app signing
certificate stays stable — which matters because the asset-links fingerprint and
users' trust are tied to it.

## Asset links (hiding the URL bar)

`Chrome` shows an address bar unless `https://<host>/.well-known/assetlinks.json`
lists the certificate that signed the APK. `android/app/src/main/res/values/strings.xml`
currently declares an **empty** fingerprint list, which is honest: no signing
certificate exists yet, so the app runs with the URL bar visible.

When the keystore exists:

1. take the SHA-256 fingerprint printed by the release job (or `keytool -list -v`);
2. put it in `asset_statements` in `strings.xml` **and** in
   `apps/web/public/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.bharatbite",
    "sha256_cert_fingerprints": ["AA:BB:…"]
  }
}]
```

3. deploy the web app before shipping the APK, then confirm with
   `adb shell pm get-app-links app.bharatbite` (expect `verified`).

If Play App Signing is used, the fingerprint must be Play's **app signing**
certificate, not the upload key.

## Versioning

`versionCode` must increase for every upload and is passed to the workflow
(`workflow_dispatch` inputs `version_name`, `version_code`). Keep it in step with
`APP_VERSION` in `apps/web/lib/config.ts` so `/download` and the APK agree.

## Release checklist

1. `workflow_dispatch` the `android release` workflow with the new version.
2. Confirm the job printed `Verifies` and `Number of signers: 1`.
3. Download the `bharatbite-release-apk` artifact, compute its SHA-256, and check
   it matches `release-sha256.txt`.
4. Attach the APK + SHA-256 + certificate digest to a GitHub Release tagged
   `android-v<version>`.
5. Update `/download` with the version, digest and date (the page has a
   `status: 'no-signed-apk'` entry today; flip it only when the artifact exists).
6. Spot-check install on a real device: install, open, sign in, log a meal.
