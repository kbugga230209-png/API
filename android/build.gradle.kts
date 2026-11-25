// Root build file. Versions are pinned (no `+`, no dynamic versions) so the same
// commit produces the same APK on any machine with the same SDK — that is what
// "reproducible" means here; it is not byte-for-byte reproducible across
// different JDK builds, and the release notes say so.
plugins {
    id("com.android.application") version "8.7.3" apply false
}
