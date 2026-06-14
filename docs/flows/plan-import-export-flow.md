# 计划导入导出流程

更新时间：2026-06-12

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
-> 不覆盖已有计划
-> 用户可设为当前计划
```

## 5. 当前实现

- `parsePlanFile` 已支持 JSON 解析和 schema 校验。
- `createImportedPlanDraft` 已支持重新生成本地 ID。
- 文件选择、文件保存/分享、导入落库仍显示“开发中”。
