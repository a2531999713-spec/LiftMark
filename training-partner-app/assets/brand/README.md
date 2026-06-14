LiftMark brand source and build assets live here.

- `app-icon-1024.png`: Expo app icon source.
- `adaptive-icon-foreground.png`: Android adaptive icon foreground.
- `adaptive-icon-monochrome.png`: Android themed icon foreground.
- `splash-logo.png`: Expo and Android splash logo.
- `favicon.png`: Web favicon placeholder for future optional web support.
- `source/`: original user-provided brand image sources.

Android native APK builds also mirror these assets into `android/app/src/main/res/` so `npm run android:apk` does not depend on a fresh Expo prebuild.
