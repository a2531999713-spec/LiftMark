# Settings 模块实现文档

更新时间：2026-06-14  
对应代码目录：`training-partner-app/`

## 1. 主要文件

| 文件 | 说明 |
|---|---|
| `app/(tabs)/settings.tsx` | 设置页，展示顶部状态卡、分组设置列表、数据管理、计划管理、激活和开发调试信息。 |
| `src/services/exportService.ts` | `exportLocalDataJson()`、`exportWorkoutDataJson()`、`resetDefaultPlanData()`。 |
| `src/services/planFileService.ts` | `.liftmark.json` 计划文件 service。 |
| `app/activation.tsx` | 本地激活码页面。 |
| `src/services/activationService.ts` | 本地激活 service 工厂。 |

## 2. 核心函数

### saveFridayStrategy()

文件：`app/(tabs)/settings.tsx`  
职责：保存周五策略，并通过 `GroupRepository.updateGroup()` 写入 `groups.friday_strategy`，同时兼容更新 `groups.friday_enabled`。  
调用方：设置页基础设置区。  
测试：当前通过 Android APK 截图烟测，后续可补 SQLite 集成测试。

### ActivationService.activate()

文件：`src/domain/activation/activation.service.ts`  
职责：校验本地测试激活码 `LIFTMARK-TEST-2026` 并保存激活状态。  
调用方：`app/activation.tsx`、`app/(tabs)/settings.tsx`。

### exportLocalDataJson()

文件：`src/services/exportService.ts`  
职责：导出 groups、member_profiles、plan、exercise、workout、progression、recovery 等 SQLite 表数据为 JSON 字符串。  
调用方：`app/(tabs)/settings.tsx`  
测试：后续可补 SQLite 集成测试。

### createCurrentPlanFile()

文件：`src/services/planFileService.ts`  
职责：读取当前用户计划模板、阶段、训练日、计划动作、动作库和替代动作，生成 `.liftmark.json` JSON payload。  
调用方：`app/(tabs)/settings.tsx`  
测试：`src/tests/plan-file.test.ts`

### createImportedPlanDraft()

文件：`src/services/planFileService.ts`  
职责：校验 `.liftmark.json` / `.liftmark` payload，并生成新的本地 plan/phase/day/exercise id，避免覆盖已有计划。  
调用方：后续导入 UI。  
测试：`src/tests/plan-file.test.ts`

## 3. 当前限制

- 设置页已按 `docs/ui/settings-page-redesign.png` 改为移动设置中心：顶部品牌/状态卡、分组列表项、开发中标签、危险操作二次确认。
- 本地小组规则通过列表入口弹窗展示，主页面只保留简洁状态。
- 设置页顶部改为深色品牌/状态卡；激活页仍使用本地视觉资产。激活状态保存在 SQLite `activation_state`。
- 第一版只在设置页展示导出 JSON 预览，文件保存/分享能力后续接入。
- 导入计划、备份数据库、恢复数据库等入口统一显示“该功能正在开发中，后续版本开放。”。
- 清空测试数据、清空训练记录、重置整个 App 只保留二次确认和提示，避免误删真实训练记录。
