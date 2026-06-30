# Group 模块实现文档

更新时间：2026-06-30  
对应代码目录：`training-partner-app/`；已实现默认小组、多小组创建/切换、本地成员、小组训练记录视图和小组动作详情分析。

## 1. 模块职责

管理本地训练小组、当前小组选择、当前计划、当前周期、当前周数和周五补弱开关。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `src/domain/group/group.types.ts` | Group 类型定义。 |
| `src/data/local/repositories/groupRepository.ts` | 小组 Repository，支持列出、创建、读取和更新小组。 |
| `src/store/selectedGroupStore.ts` | 最近选中小组状态。 |
| `app/profile/groups.tsx` | 当前小组切换、创建新小组和成员入口。 |
| `app/(tabs)/today.tsx` | 今日训练入口，使用当前小组生成 session。 |
| `app/(tabs)/members.tsx` | 成员页，按当前小组读取成员。 |
| `app/(tabs)/history.tsx` | 记录页小组视角入口，展示小组汇总、成员贡献、主项表现和趋势。 |
| `app/history/group-exercise/[exerciseId].tsx` | 小组动作详情页，按当前小组、指标、时间范围和成员筛选展示多成员趋势。 |

## 3. 核心类/函数

### GroupRepository.getDefaultGroup

文件：见主要文件列表  
符号：`GroupRepository.getDefaultGroup`  
搜索锚点：`GroupRepository`  
职责：读取本机默认训练小组。  
调用方：member, today-training-flow, workout, export  
依赖：plan  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### GroupRepository.listGroups

文件：见主要文件列表  
符号：`GroupRepository.listGroups`  
搜索锚点：`GroupRepository`  
职责：列出本机所有小组，供当前小组切换、今日训练、成员页和历史页解析当前 `groupId`。  
调用方：profile/groups, today, members, history, settings, body-metrics  
依赖：plan  
测试：见 `test-plan.md`  

修改注意：

1. UI 不得用硬编码默认小组替代该方法。
2. 当 `selectedGroupId` 失效时，调用方可回落到第一个小组并写回 store。
3. 训练记录必须写入当前小组的 `group_id`。

### GroupRepository.createGroup

文件：见主要文件列表  
符号：`GroupRepository.createGroup`  
搜索锚点：`GroupRepository`  
职责：首次启动时创建默认小组，也用于用户在小组页创建新本地小组。  
调用方：member, today-training-flow, workout, export  
依赖：plan  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### GroupRepository.updateGroup

文件：见主要文件列表  
符号：`GroupRepository.updateGroup`  
搜索锚点：`GroupRepository`  
职责：更新当前周期、当前周数和周五开关。  
调用方：member, today-training-flow, workout, export  
依赖：plan  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

## 4. 数据结构

- Group
- groups

## 5. 调用关系

- 依赖：plan
- 被调用：member, today-training-flow, workout, export

## 6. 测试位置

- 首次启动可以创建默认小组。
- 可以从小组页创建新小组并立即切换。
- 今日训练、成员页和历史页均使用当前小组。
- 能保存当前周期、周数、周五是否训练。
- 切换周数后今日训练读取正确周。

建议测试文件：

- `src/tests/group.test.ts`
- 若函数位于更细分文件，按实际路径拆分测试文件。

## 7. 高风险区域

- 第一版即使只有一个默认小组，也不能把 UI 和数据结构做成单人逻辑。
- currentWeek 和 currentPhaseType 必须与 plan phase 范围保持一致。
- 多小组切换只改变当前 UI 和新训练归属，不迁移旧训练记录。

## 8. 文档同步记录

- 2026-06-08：根据需求文档、开发文档和 Excel 计划初始化模块实现说明。
- 2026-06-09：同步 Sprint 1 代码骨架：Group 类型、Repository 接口、SQLite 实现和默认小组 seed 已创建。
- 2026-06-10：同步 Android development build 调整：GroupRepository 仍通过 native SQLite 读取默认小组；`initializeLocalDatabase()` 改为可复用初始化 Promise，避免页面和根布局重复触发 seed。
- 2026-06-10：同步 Gradle/JDK toolchain 修复：Group 模块代码未改动；Android 构建固定使用 `JAVA_HOME` JDK 17，不使用 vendor 限制。
- 2026-06-10：同步本地 Android 预览 APK 流程：GroupRepository 和默认小组 seed 未改动；`npm run android:apk` 生成的 release APK 已能在模拟器首屏读取 Today 数据，当前验收不依赖 Metro。
- 2026-06-30：记录页小组动作表现卡接入动作详情页；小组动作详情使用本机 SQLite 训练记录生成指标、时间范围、成员筛选和多成员趋势线。
- 2026-06-30：小组页支持列出所有本地小组、创建新小组和切换当前小组；今日训练、成员页、记录页、设置页、头像同步和身体数据页均跟随 `selectedGroupStore` 当前小组。
