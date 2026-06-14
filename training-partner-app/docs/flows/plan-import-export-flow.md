# 计划导入导出流程

更新时间：2026-06-14

## 1. 支持格式

第一版推荐：

```text
.liftmark.json
```

同时预留：

```text
.json
.liftmark
.liftmark.zip
```

导出文件本质是开放 JSON schema。

## 2. 导出对象

导出对象是用户计划，不是系统方案。

```json
{
  "format": "liftmark-plan",
  "schemaVersion": 1,
  "app": "LiftMark",
  "exportedAt": "ISO_DATE",
  "plan": {},
  "phases": [],
  "days": [],
  "exercises": [],
  "planExercises": [],
  "alternatives": [],
  "progressionRules": []
}
```

当前 `planFileService` 的实际结构为 `plan.template`、`plan.phases`、`plan.days`、`plan.exercises`，后续可在 schemaVersion 变更时调整为扁平字段。

## 3. 不导出内容

- 训练记录。
- 成员 1RM。
- 身体数据。
- 激活码。
- 设备信息。

## 4. 导入流程

```text
选择文件
-> 解析 JSON
-> 校验 format
-> 校验 schemaVersion
-> 重新生成本地 id
-> 生成新的 UserTrainingPlan
-> 写入 SQLite
-> 不覆盖已有计划
-> 用户可设为当前计划
```

## 5. 当前实现

- `parsePlanFile` 已支持 JSON 解析和 schema 校验。
- `createImportedPlanDraft` 已支持重新生成本地 ID。
- `planDocumentService` 已接入 Expo DocumentPicker，支持选择 `.liftmark.json` 并读取文件内容。
- `PlanRepository.importUserPlan()` 已支持导入草稿落库，导入结果为 `source: "imported"`、`visibility: "private"` 的用户计划。
- 计划页和设置页导入成功后都会询问“是否设为当前训练计划？”，确认后只更新当前本地小组的 current plan。
- 文件保存/分享/复制能力仍为后续增强，当前导出后只显示成功提示，不常驻展示 JSON 预览。

## 6. 失败提示

- JSON 解析失败、format 不匹配、schemaVersion 不兼容或结构不完整时，页面显示“计划文件格式不兼容 / 这个文件不是练刻 LiftMark 支持的计划文件”。
- 导入取消不报错。
- 导入不会覆盖已有计划，不导入成员 1RM、身体数据或训练记录。
