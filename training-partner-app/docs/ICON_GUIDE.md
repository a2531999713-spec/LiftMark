# Android Icon & Splash Screen Guide

## Overview

This document describes the icon and splash screen assets for the LiftMark Android app.

## Icon Assets

### Source Files (Brand Assets)

| File | Size | Description |
|------|------|-------------|
| `assets/brand/app-icon-1024.png` | 1024x1024 | App icon with white rounded background |
| `assets/brand/adaptive-icon-foreground.png` | 1024x1024 | Adaptive icon foreground (logo on transparent) |
| `assets/brand/adaptive-icon-monochrome.png` | 1024x1024 | Monochrome icon for Android 13+ themed icons |
| `assets/brand/splash-logo-square.png` | 1024x1024 | Square splash logo (no text) |

### Android Generated Files

Located in `android/app/src/main/res/`:

#### Mipmap Directories (Launcher Icons)

Each density folder contains:
- `ic_launcher.webp` - Standard launcher icon
- `ic_launcher_round.webp` - Round launcher icon
- `ic_launcher_background.webp` - Background layer (solid #0D1B2A)
- `ic_launcher_foreground.webp` - Foreground layer (logo)
- `ic_launcher_monochrome.webp` - Monochrome layer

| Density | Size |
|---------|------|
| mdpi | 48x48 |
| hdpi | 72x72 |
| xhdpi | 96x96 |
| xxhdpi | 144x144 |
| xxxhdpi | 192x192 |

#### Drawable Directories (Splash Screen)

Each density folder contains:
- `splashscreen_logo.png` - Splash screen logo

| Density | Size |
|---------|------|
| mdpi | 144x144 |
| hdpi | 216x216 |
| xhdpi | 288x288 |
| xxhdpi | 432x432 |
| xxxhdpi | 576x576 |

## Configuration

### app.json

```json
{
  "expo": {
    "icon": "./assets/brand/app-icon-1024.png",
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#0D1B2A",
        "foregroundImage": "./assets/brand/adaptive-icon-foreground.png",
        "monochromeImage": "./assets/brand/adaptive-icon-monochrome.png"
      }
    },
    "splash": {
      "image": "./assets/brand/splash-logo-square.png",
      "resizeMode": "contain",
      "backgroundColor": "#F2F4F7"
    }
  }
}
```

### Android Manifest

```xml
<application
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round">
```

## Regenerating Assets

### Using Scripts

Run the provided Python scripts to regenerate assets:

```bash
# Fix icon background color
python scripts/fix_icons.py

# Fix splash screen dimensions
python scripts/fix_splash.py
```

### Using Expo Prebuild

To regenerate all Android resources from scratch:

```bash
cd training-partner-app
npx expo prebuild --clean
```

## Troubleshooting

### Icon shows white background

**Cause**: `ic_launcher_background.webp` files have wrong color.

**Fix**: Run `python scripts/fix_icons.py` to regenerate with correct #0D1B2A background.

### Splash screen is cropped or distorted

**Cause**: Splash logo is not square.

**Fix**: Run `python scripts/fix_splash.py` to generate square splash logo.

### Icon not updating after changes

**Cause**: Build cache.

**Fix**: Clean and rebuild:
```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

## Color Reference

| Color | Hex | RGB | Usage |
|-------|-----|-----|-------|
| Dark Navy | #0D1B2A | (13, 27, 42) | Icon background |
| Light Gray | #F2F4F7 | (242, 244, 247) | Splash background |
| Red | #FF4136 | (255, 65, 54) | Logo accent |
