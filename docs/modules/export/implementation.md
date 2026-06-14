# Export 模块实现文档

更新时间：2026-06-12  
对应代码目录：`training-partner-app/`；设置页已接入基础 JSON 导出、训练记录导出、系统方案数据重置和 `.liftmark.json` 当前用户计划导出。

## 1. 模块职责

提供本地训练数据 JSON 导出、系统方案数据重置和清空测试数据等设置页能力。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `src/services/exportService.ts` | JSON 导出服务、训练记录导出、系统方案和默认用户计划 seed 重置。 |
| `src/services/planFileService.ts` | `.liftmark.json` 计划文件生成、校验和导入 ID 重映射。 |
| `app/(tabs)/settings.tsx` | 设置页入口。 |
| `src/data/local/repositories/settingsRepository.ts` | 轻量设置 Repository。 |

## 3. 核心类/函数

### exportLocalDataJson()

文件：见主要文件列表  
符号：`exportLocalDataJson()`  
搜索锚点：`exportLocalDataJson`  
职责：导出本地 SQLite 数据为 JSON 字符串。  
调用方：settings  
依赖：group, member, plan, exercise, workout, progression, recovery  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### resetDefaultPlanData()

文件：见主要文件列表  
符号：`resetDefaultPlanData()`  
搜索锚点：`resetDefaultPlanData`  
职责：重新执行 seed 写入，补齐缺失的系统方案和默认用户计划数据，不删除训练记录。  
调用方：settings  
依赖：group, member, plan, exercise, workout, progression, recovery  
测试：见 `test-plan.md`  

### createCurrentPlanFile()

文件：`src/services/planFileService.ts`  
符号：`createCurrentPlanFile()`  
搜索锚点：`createCurrentPlanFile`  
职责：生成 `.liftmark.json` 当前用户计划文件，不包含系统方案、成员 1RM 或训练记录。  
调用方：settings  
依赖：plan, exercise  
测试：`src/tests/plan-file.test.ts`

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

## 4. 数据结构

- SQLite tables
- JSON export payload

## 5. 调用关系

- 依赖：group, member, plan, exercise, workout, progression, recovery
- 被调用：settings

## 6. 测试位置

- 用户可以导出本地训练数据。
- 导出 JSON 包含成员、计划、训练记录和建议。
- 重置 seed 数据后默认 group、系统方案和默认用户计划仍可读取。
- 当前用户计划可导出为 `.liftmark.json` JSON。

建议测试文件：

- `src/tests/export.test.ts`
- 若函数位于更细分文件，按实际路径拆分测试文件。

## 7. 高风险区域

- 导出不能漏掉 workout_sets、progression_suggestions、recovery_logs。
- 清空测试数据必须有确认流程，避免误删真实训练记录。
- 计划导出不能包含系统方案、成员 1RM 或训练记录。

## 8. 文档同步记录

- 2026-06-08：根据需求文档、开发文档和 Excel 计划初始化模块实现说明。
- 2026-06-09：同步 Sprint 1 代码骨架：`src/services/exportService.ts` 占位已创建，真实导出逻辑待 Sprint 7。
- 2026-06-11：同步稳定性与基础体验 Sprint：`exportService.ts` 支持全量/训练记录 JSON 字符串导出和默认计划重置；`planFileService.ts` 支持 `.liftmark` 当前计划导出、schema 校验和导入 ID 重映射；设置页入口已接入。
- 2026-06-12：同步计划模块系统方案分离：导出对象改为当前用户计划，推荐扩展名 `.liftmark.json`，系统方案不作为导出对象。
