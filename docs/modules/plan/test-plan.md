# Plan 测试计划

更新时间：2026-06-12

## 1. 单元测试范围

- 系统方案目录包含第一版 8 个方案。
- 四练增力增肌方案标记为完整可用，并引用系统模板 planId。
- `createUserPlanCopyDraft` 生成新的用户计划 ID。
- 复制结果 `source = system_copy`。
- 复制结果记录 `originSchemeId`。
- 复制后的 phases、days、plan exercises 指向新的用户计划结构。
- `.liftmark.json` / `.liftmark` JSON schemaVersion 校验。
- 导入草稿生成新的本地 ID，不覆盖原 ID。

## 2. 集成测试范围

- migration v2 给 `plan_templates` 增加 `origin_scheme_id`。
- seed 后系统模板仍为 `source=system`。
- seed 后默认小组当前计划指向用户计划副本，而不是系统模板。
- `PlanRepository.listUserPlans()` 不返回 `source=system` 的系统方案。
- `PlanRepository.copySystemSchemeToUserPlan()` 能写入新的用户计划。
- `GroupRepository.updateGroup()` 能把复制出的用户计划设为当前计划。

## 3. E2E 测试范围

- 计划页能看到“系统方案”。
- 系统方案不会直接出现在“我的计划”里。
- 点击“使用此方案”后生成用户计划。
- 用户可以把生成计划设为当前计划。
- 训练页读取当前用户计划。
- 训练记录不会绑定系统方案。

## 4. 已有测试文件

- `src/tests/plan.test.ts`
- `src/tests/plan-file.test.ts`

## 5. 回归测试点

- 今日训练 A/B/C 恢复过滤仍正常。
- 周五默认休息仍正常。
- 当前计划导出不包含成员 1RM 或训练记录。
- APK 预览命令 `npm run android:preview` 可编译、安装和打开。
