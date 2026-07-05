# Design QA - LiftMark Compact Home + Account Panel (2026-07-05)

- source visual truth: `docs/ui/reference/home-v3.png`, `docs/ui/reference/account-panel-v3.png`
- implementation scope: home tab density, top-right avatar account panel, in-panel profile editing, in-panel training group management entry
- target runtime: Android emulator `emulator-5554`, release APK
- release APK path: `android/app/build/outputs/apk/release/app-release.apk`

## Checks

- TypeScript: passed with `npm run typecheck`
- ESLint: passed with `npm run lint`
- Jest: passed with `npm test` (15 suites, 89 tests)
- APK generation: passed during `npm run android:preview`
- Install/open verification: blocked by emulator package service

## Visual Review

- Home first screen is more compact: header avatar is 40dp, plan card and training hero are shorter, the current group/start card has no management entry, and focus rows are reduced to 70dp.
- Header copy now comes from training context, not hour-based greetings. It uses the current plan day/focus, date, week, plan, and active group.
- Bottom tabs remain limited to `首页 / 计划 / 记录`; settings, members, and explore tabs are hidden.
- Account entry now opens a right-top floating panel near the avatar. The old bottom-sheet account menu is not used by the home screen.
- The panel main menu has no standalone `个人资料`; the top avatar/name summary is the edit-profile entry.
- Profile editing stays inside the panel with avatar, nickname, age, gender, phone, LiftMark ID, membership, and sync status. The save action appears only when the draft is dirty.
- `切换小组` and `管理小组与成员` are merged under `训练小组`, with group switching and links to manage/create/settings destinations inside the panel substate.
- Legal/about/feedback destinations remain routed to existing pages.

## Emulator Evidence

- `npm run android:preview`: release APK build succeeded.
- `npm run android:preview`: install failed with `adb: failed to install ... cmd: Can't find service: package`.
- `adb devices -l`: `emulator-5554` was visible as `device`, then temporarily `offline` after adb restart, then visible as `device` again.
- `npm run android:install` after adb restart: failed with the same `Can't find service: package`.
- Live screenshot verification is blocked by the current emulator service state.

## Findings

- No actionable static design QA issues found in the changed UI code.
- Live device visual QA remains blocked by emulator/adb package service failure, not by TypeScript, lint, tests, or APK generation.

final result: code/build QA passed; live emulator screenshot QA blocked by device state.
