# Settings 测试计划

更新时间：2026-06-11

## 1. 单元测试范围

- `.liftmark` schemaVersion 校验。
- 导入计划时新 ID 重映射。
- 导出 payload 不包含成员 1RM 或训练记录到计划文件。

## 2. 集成测试范围

- 设置页能读取默认 group、active_plan_id、SQLite 状态和 seed 状态。
- 周五补弱开关能写入 `groups.friday_enabled`，重新进入设置页后状态不丢失。
- 导出全部数据能生成 JSON 字符串。
- 导出当前计划能生成 `.liftmark` JSON 字符串。
- 重置默认计划不删除训练记录。

## 3. E2E 测试范围

- APK 安装后进入设置页，基础设置、数据管理和调试信息可见。
- 危险操作弹出二次确认。
- 未实现入口显示“开发中”。

## 4. 测试文件位置

- `src/tests/plan-file.test.ts`
- 后续 SQLite 集成测试可放在 `src/tests/settings.test.ts` 或 `src/tests/export.test.ts`。
