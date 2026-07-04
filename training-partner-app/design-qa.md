# Design QA - LiftMark Home + Account Entry (2026-07-05)

- source visual truth: `docs/ui/reference/home-v3.png`, `docs/ui/reference/profile-v3.png`
- implementation scope: home tab, avatar account entry, account action sheet, profile detail page, legal/support/account utility routes
- target runtime: Android emulator `emulator-5554`, release APK
- release APK path: `android/app/build/outputs/apk/release/app-release.apk`
- release APK timestamp checked: `2026-07-05 02:34:26`

## Checks

- TypeScript: passed with `npm run typecheck -- --pretty false`
- ESLint: passed with `npm run lint`
- Jest: passed with `npm test -- --runInBand` (15 suites, 89 tests)
- APK generation: passed; `app-release.apk` exists
- Install/open verification: blocked by emulator system services

## Visual Review

- Home structure follows the supplied home reference: greeting/date header, account avatar entry, plan progress card, dark training hero, current group start card, and compact top-three focus list.
- Profile structure follows the supplied profile reference: custom title header, profile summary card, grouped account/sync/preference/legal rows, right-side status labels, and chevrons.
- Homepage data remains dynamic. Plan name, week/day, exercise list, volume, member names, group names, sync status, and history labels come from app state/repositories with fallback empty states, not hardcoded demo values.
- The old bottom `settings`/`我的` tab is hidden. Account management is reachable from the top-right avatar and the profile route.

## Emulator Evidence

- `adb devices -l`: `emulator-5554 device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64`
- `adb -s emulator-5554 shell getprop sys.boot_completed`: `1`
- `adb -s emulator-5554 shell wm size`: failed with `cmd: Can't find service: window`
- `npm run android:install`: failed with `adb: failed to install ... cmd: Can't find service: package`
- `npm run android:open`: failed before a resumed app activity could be verified
- `adb -s emulator-5554 shell dumpsys activity activities`: failed with `Can't find service: activity`
- `adb -s emulator-5554 shell screencap -p /sdcard/liftmark-home-v3.png`: timed out

## Findings

- No actionable P0/P1/P2 issues found in static design QA.
- Live visual screenshot verification is blocked by the current emulator service state. The emulator is listed as booted, but core Android services required for install, activity launch, window sizing, and screenshots are unavailable.

final result: code/build QA passed; live emulator screenshot QA blocked by device state.
