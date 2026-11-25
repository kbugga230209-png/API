import java.util.Properties

plugins {
    id("com.android.application")
}

// Signing material is never read from the repository. It comes from:
//   * CI: environment variables populated from GitHub Actions secrets
//   * local release: ~/.gradle/gradle.properties or an untracked keystore + env
val keystorePath: String? = System.getenv("ANDROID_KEYSTORE_PATH")
    ?: (project.findProperty("ANDROID_KEYSTORE_PATH") as String?)
val keystorePassword: String? = System.getenv("ANDROID_KEYSTORE_PASSWORD")
    ?: (project.findProperty("ANDROID_KEYSTORE_PASSWORD") as String?)
val keyAlias: String? = System.getenv("ANDROID_KEY_ALIAS")
    ?: (project.findProperty("ANDROID_KEY_ALIAS") as String?)
val keyPassword: String? = System.getenv("ANDROID_KEY_PASSWORD")
    ?: (project.findProperty("ANDROID_KEY_PASSWORD") as String?)

val releaseSigningAvailable = listOf(keystorePath, keystorePassword, keyAlias, keyPassword)
    .all { !it.isNullOrBlank() } && file(keystorePath ?: "").exists()

val buildingRelease = gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }

android {
    namespace = "app.bharatbite.twa"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.bharatbite"
        minSdk = 24
        targetSdk = 35
        versionCode = (project.findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = (project.findProperty("versionName") as String?) ?: "0.1.0"
        manifestPlaceholders["hostName"] = (project.findProperty("hostName") as String?) ?: "bharatbite.vercel.app"
    }

    signingConfigs {
        if (releaseSigningAvailable) {
            create("release") {
                storeFile = file(keystorePath!!)
                storePassword = keystorePassword
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            // An unsigned release build must never be produced by accident.
            if (releaseSigningAvailable) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources.excludes += setOf("META-INF/*.kotlin_module")
    }
}

// Fail loudly instead of emitting an unsigned APK that looks like a release.
gradle.taskGraph.whenReady {
    if (buildingRelease && !releaseSigningAvailable && allTasks.any { it.name.contains("Release") }) {
        if (System.getenv("ALLOW_UNSIGNED_RELEASE") != "true") {
            throw GradleException(
                "Release signing material is missing (ANDROID_KEYSTORE_PATH/PASSWORD, ANDROID_KEY_ALIAS, " +
                    "ANDROID_KEY_PASSWORD). Refusing to build an unsigned release. See docs/ANDROID.md."
            )
        }
    }
}

dependencies {
    // Trusted Web Activity wrapper: renders the deployed PWA in a Chrome-backed
    // activity with no address bar once asset links are verified.
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
