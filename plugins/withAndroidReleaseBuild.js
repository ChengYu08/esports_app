const { createRunOncePlugin, withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

const TAG = 'with-android-release-build';

function withAndroidReleaseBuild(config) {
  config = withGradleProperties(config, (mod) => {
    const properties = mod.modResults;
    const set = (key, value) => {
      const existing = properties.find((item) => item.type === 'property' && item.key === key);
      if (existing) existing.value = value;
      else properties.push({ type: 'property', key, value });
    };
    set('reactNativeArchitectures', 'arm64-v8a');
    set('android.enableMinifyInReleaseBuilds', 'true');
    set('android.enableShrinkResourcesInReleaseBuilds', 'true');
    set('android.enablePngCrunchInReleaseBuilds', 'false');
    // 禁止 Foojay 自动下载 JDK（用本机 JAVA_HOME）
    set('org.gradle.java.installations.auto-download', 'false');
    return mod;
  });

  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error(`${TAG} requires Groovy app/build.gradle.`);
    if (mod.modResults.contents.includes(TAG)) return mod;
    // Apply after the generated android block.
    // Debug and release share the same keystore so local installs can overwrite each other.
    // Signing files live outside android/, which clean prebuild deletes.
    mod.modResults.contents += `
// @generated begin ${TAG}
def releaseCredentialsFile = rootProject.file('../.android-signing/credentials.json')
def releaseKeyFile = rootProject.file('../.android-signing/release.keystore')
def releaseCredentials = releaseCredentialsFile.exists()
    ? new groovy.json.JsonSlurper().parse(releaseCredentialsFile) : [:]
android {
    signingConfigs {
        release {
            storeFile releaseKeyFile
            storeType 'PKCS12'
            keyAlias releaseCredentials.keyAlias
            storePassword releaseCredentials.password
            keyPassword releaseCredentials.password
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.release
        }
        release {
            signingConfig signingConfigs.release
            proguardFile rootProject.file('../plugins/android-release.pro')
        }
    }
}
tasks.matching { it.name ==~ /validateSigning(Debug|Release)/ }.configureEach {
    doFirst {
        if (!releaseKeyFile.exists() || !releaseCredentials.password || !releaseCredentials.keyAlias) {
            throw new GradleException('Missing release signing. Run npm run build:apk:init-signing or restore .android-signing from backup.')
        }
    }
}
// @generated end ${TAG}
`;
    return mod;
  });
}

module.exports = createRunOncePlugin(withAndroidReleaseBuild, TAG, '2.2.0');
