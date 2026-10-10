#!/bin/bash

npx expo prebuild --platform android --clean

cd android
./gradlew assembleRelease  

# - APK：`android/app/build/outputs/apk/release/app-release.apk`