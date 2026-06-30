# 项目总览
## 2026-06-14 品牌迁移状态

- 当前品牌：中文名“练刻”，英文名“LiftMark”，完整品牌“练刻 LiftMark”。
- 当前 Android package / applicationId：`com.liftmark.app`。
- 当前 npm package / Expo slug / scheme：`liftmark`。
- 当前计划文件格式：`.liftmark.json`，manifest 使用 `app: "LiftMark"`、`format: "liftmark-plan"`。
- 当前真实项目路径为 `C:\Users\zhw\Documents\LiftMark\training-partner-app`；代码和文档语义统一为 LiftMark。


更新时间：2026-06-11

## 1. 项目简介

本项目品牌为“练刻 / LiftMark”，是一个安卓优先、iOS 预留的多人力量训练 App。产品目标是替代 Excel 训练计划表，让 2-5 人在健身房训练时快速查看今日训练、自动计算每个人建议重量、记录实际完成情况，并在训练后生成下次训练建议。

长期定位是“多人训练计划执行器 + 可配置训练计划系统 + 训练记录与进阶建议平台”。

## 2. 项目目标

- 第一版：安卓本地 MVP，可真实支持训练搭子使用。
- 中期：增强训练体验、恢复评分、导出和备份能力。
- 后期：云同步、小组邀请、计划分享、教练模式和计划市场。

## 3. 核心功能

| 功能 | MVP 状态 | 说明 |
|---|---|---|
| 多成员管理 | 计划内 | 支持 2-5 人，成员独立 1RM 和加重单位 |
| 默认小组 | 计划内 | 第一版一个默认训练小组 |
| 主流计划库 | 基础已完成 | 新手全身、PPL、经典四分化、上肢/下肢、5x5、减脂保肌、恢复、居家哑铃 |
| 今日训练 | 计划内 | 根据当前周期、周数、星期和动作筛选生成 |
| 多人训练执行 | 计划内 | 按动作轮换记录每个成员 |
| 自动重量计算 | 计划内 | 根据 1RM、百分比和加重单位计算 |
| 动作替换 | 计划内 | 训练中替换器械占用或不适动作 |
| 动作库 | 基础已完成 | 100+ 系统动作、自定义动作和统一动作选择器 |
| 训练历史 | 基础已完成 | 最近训练、最近 5 次趋势、预估 1RM、PR 接近度和疲劳建议 |
| 设置页 | 基础已完成 | 品牌/版本、小组状态、计划导出、开发调试信息 |
| 数据导出 | 基础已完成 | JSON 导出本地数据、训练记录和 `.liftmark` 当前计划 |
| 云同步 | 延后 | 第二或第三阶段接 Supabase |

## 4. 用户角色

- 普通健身者：按计划训练、记录数据、获得加重建议。
- 健身搭子：2-5 人一起练，同动作不同重量。
- 进阶训练者：关注 1RM、完成情况、周期化训练和减量。
- 私教/小团队：后续用于分配计划和查看完成情况。
- 新手用户：套用模板，直接知道今天练什么。

## 5. 技术栈概览

| 类型 | 技术 | 依据 |
|---|---|---|
| 移动框架 | React Native | 开发文档确认 |
| 工具链 | Expo | 开发文档确认 |
| 语言 | TypeScript | 开发文档确认 |
| 路由 | Expo Router | 开发文档确认 |
| 本地数据库 | Expo SQLite | 开发文档确认 |
| 本地轻量设置 | AsyncStorage，仅限轻量设置 | 开发文档确认 |
| 状态管理 | Zustand | 开发文档确认 |
| 表单 | React Hook Form + Zod | 开发文档确认 |
| 后续服务端 | Supabase | 第二/三阶段预留 |
| 测试 | Jest + React Native Testing Library | 开发文档确认 |
| 部署 | Android 优先，iOS 预留 | 开发文档确认 |

## 6. 目录结构

当前仓库已创建业务项目 `training-partner-app/`。Sprint 1 已落地的基础结构为：

```text
training-partner-app/
  app/
    _layout.tsx
    index.tsx
    (tabs)/today.tsx
    (tabs)/history.tsx
    (tabs)/plan.tsx
    (tabs)/members.tsx
    (tabs)/settings.tsx
    member/new.tsx
    member/[memberId].tsx
    plan/[planId].tsx
    workout/[sessionId].tsx
    workout/summary/[sessionId].tsx
  src/
    components/
      common/
      members/
    domain/
      member/
        member.validation.ts
      group: planned via member/group types and repositories
      plan/
      exercise/
      workout/
      weight/
      progression/
      recovery/
    data/
      local/
      seed/
    store/
    sync/
    services/
    theme/
    tests/
      member.test.ts
```

## 7. 核心模块

| 模块 | 名称 | 职责 | 文档 |
|---|---|---|---|
| member | 成员 | 管理训练成员、成员档案、1RM 和加重单位，是多人建议重量与训练记录归属的基础。 | `docs/modules/member/overview.md` |
| group | 小组 | 管理默认训练小组、当前计划、当前周期、当前周数和周五补弱开关。 | `docs/modules/group/overview.md` |
| plan | 计划 | 把训练计划模板、阶段、周、训练日和动作作为计划导出，并承接 Excel 训练计划到 seed 数据的映射。 | `docs/modules/plan/overview.md` |
| exercise | 动作 | 管理动作库、动作模式、器械、目标肌群和替代动作，支撑计划动作与训练中替换。 | `docs/modules/exercise/overview.md` |
| workout | 训练执行 | 创建训练 session、生成动作记录和每位成员的 set 记录，支撑训练现场多人轮换记录。 | `docs/modules/workout/overview.md` |
| weight | 重量计算 | 根据计划百分比、成员 1RM 和器械加重单位计算建议重量，并提供预估 1RM。 | `docs/modules/weight/overview.md` |
| progression | 进阶建议 | 训练完成后基于完成情况、失败次数和双进阶规则生成下次建议。 | `docs/modules/progression/overview.md` |
| recovery | 恢复评分 | 根据睡眠、食欲、训练欲望、酸痛、关节不适和疲劳生成建议；训练页当前使用动作筛选控制 A/B/C 动作快照。 | `docs/modules/recovery/overview.md` |
| history | 训练历史 | 查看最近训练、成员筛选、动作筛选、历史最好表现、预估 1RM 和最近进阶建议。 | `docs/modules/history/overview.md` |
| export | 导出 | 提供本地训练数据 JSON 导出、重置默认计划和重建测试数据等设置页能力。 | `docs/modules/export/overview.md` |
| settings | 设置 | 展示品牌、版本、本地小组、SQLite/seed 状态，并提供计划导出和计划导入导出入口。 | `docs/modules/settings/overview.md` |

## 8. 模块依赖关系

- `group` 绑定当前计划、周期、周数和周五设置。
- `member` 提供个人 1RM 和加重单位。
- `plan` 提供数据化计划模板和今日训练候选动作。
- `exercise` 提供动作元数据和替换库。
- `weight` 使用 plan + member + exercise 计算建议重量。
- `workout` 创建 session 和 set 记录。
- `progression` 使用 workout 结果生成下次建议。
- 训练页动作筛选影响今日动作优先级过滤。
- `history` 聚合 workout、progression 和 weight 的历史视图。
- `export` 汇总本地 SQLite 数据导出。
- `settings` 编排 export、plan 文件 service 和本地调试信息。

## 9. 启动方式

业务项目位于 `training-partner-app/`。常用命令：

```bash
cd training-partner-app
npm run start
npm run android
npm run android:apk
npm run android:preview
npm run typecheck
npm run lint
npm test
```

第一阶段主要验收方式是本地 Android 预览 APK：

```powershell
npm run android:apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
npm run android:preview
```

`android:preview` 会执行“编译 APK -> 安装 APK -> 打开 App”。该方式不依赖 Web、Expo Go 或 Metro；development build 仍保留为后续调试选项。

## 10. 测试方式

计划使用 Jest + React Native Testing Library。第一批必须覆盖：

- `roundToIncrement`
- `calculateSuggestedWeight`
- `estimateOneRM`
- `getStrengthProgressionSuggestion`
- `getHypertrophyProgressionSuggestion`
- `calculateRecoveryScore`
- `filterExercisesByRecovery`

当前已配置 `jest-expo`，测试目录为 `training-partner-app/src/tests/`；已覆盖 member、plan、weight、recovery、workout、history 和 plan-file。

## 11. 部署方式

- P0：Android 本地预览 APK，Android 真机运行预留。
- P1：iOS 预留。
- P2：Web 管理页或分享页预留。

## 12. 当前开发阶段

当前处于稳定性与基础体验 Sprint：品牌中文化、APK 一键预览、设置页基础功能、计划 `.liftmark` 导出 service、历史推算、计划仪表盘、扩展动作库和自定义动作基础流程已完成；完整业务持久化烟测仍待后续人工验证。

## 13. 高风险区域

- 计划是数据，不是代码。
- 计划模板和个人参数分离。
- 计划和训练记录分离。
- 多人逻辑从第一版就保留。
- 本地 SQLite 优先。
- Domain 层不依赖 UI。
- 训练记录不能用 AsyncStorage 保存。

## 14. 需要人工确认的问题

- `roundToIncrement` 对半档边界的策略是否固定为四舍五入。
- 第一版成员删除、训练记录删除、重建测试数据是否需要软删除。
- 第一版是否需要实现恢复评分页，还是只保留今日训练页的快速恢复选择。
- 当前本机 Node.js v24.16.0 和 Microsoft JDK 17.0.19 已满足 Android 本地 APK 构建要求；`npm run android:apk` 已通过模拟器首屏烟测，真机预览可使用 `npm run android:apk:device`。
