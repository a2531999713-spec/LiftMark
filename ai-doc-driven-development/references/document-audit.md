# Documentation Audit Workflow

Use this workflow when the user asks for a full docs/code consistency audit, weekly audit, release audit, version audit, or documentation drift check.

## Goal

Compare project documentation with actual code and identify drift.

Do not immediately rewrite all docs.

First generate an audit report.

## Audit Frequency

Recommended:

- once per week;
- before each release;
- after major refactors;
- after adding major modules;
- when documentation seems outdated.

## Audit Scope

Check:

1. docs directory completeness;
2. project overview accuracy;
3. architecture document accuracy;
4. product/business design accuracy;
5. roadmap status accuracy;
6. module docs completeness;
7. implementation docs accuracy;
8. API docs vs actual routes/controllers;
9. database docs vs schema/migrations/models;
10. flow docs vs actual code paths;
11. test-plan docs vs actual tests;
12. ADR coverage for major decisions;
13. docs that describe missing or removed code;
14. code that exists without documentation.

## Required Audit Process

### Step 1: Scan codebase

Identify:

- major directories;
- modules;
- APIs;
- database models/migrations;
- tests;
- configuration;
- build/deployment;
- high-risk areas.

### Step 2: Read docs

Read:

```text
docs/README.md
docs/project-overview.md
docs/technical-architecture.md
docs/product-design.md
docs/development-roadmap.md
docs/ai-development-rules.md
docs/modules/**
docs/api/**
docs/database/**
docs/flows/**
docs/adr/**
````

Only read folders that exist.

### Step 3: Compare docs to code

Classify findings:

* high risk;
* medium risk;
* low risk;
* missing docs;
* outdated docs;
* incorrect docs;
* uncertain assumptions.

### Step 4: Create audit report

Create:

```text
docs/audits/YYYY-MM-DD-doc-audit.md
```

Use actual current date if available. Otherwise use a date provided by the user or project context.

### Step 5: Suggest repair order

Do not directly rewrite every doc unless the user asks.

Provide repair order:

1. high-risk inaccurate docs;
2. missing module docs;
3. API/database mismatches;
4. roadmap status errors;
5. implementation symbol/index errors;
6. low-risk cleanup.

## Audit Report Template

```md
# 文档一致性审计报告

审计日期：YYYY-MM-DD  
审计范围：全项目  
审计方式：AI 全量扫描代码与 docs 文档对比  

## 1. 总体结论

- 文档整体状态：
- 高风险问题：
- 中风险问题：
- 低风险问题：
- 缺失文档：
- 建议优先级：

## 2. 高风险问题

### 2.1 {问题标题}

问题类型：  
影响范围：  
代码依据：  
文档位置：  
实际情况：  
当前文档描述：  
风险：  
建议修复：  

## 3. 中风险问题

## 4. 低风险问题

## 5. 缺失文档

| 模块/功能 | 缺失文档 | 建议 |
|---|---|---|

## 6. 过期文档

| 文档 | 过期内容 | 实际代码情况 | 建议 |
|---|---|---|---|

## 7. 代码与文档冲突

| 冲突点 | 代码事实 | 文档描述 | 建议处理 |
|---|---|---|---|

## 8. Roadmap 状态检查

| 功能 | Roadmap 状态 | 代码实际状态 | 建议 |
|---|---|---|---|

## 9. 建议修复顺序

1.
2.
3.

## 10. 需要人工确认的问题

1.
2.
3.
```

## Risk Classification

### High risk

Use high risk for:

* auth/security docs wrong;
* payment/billing docs wrong;
* database schema docs wrong;
* permission logic docs wrong;
* API docs that could break clients;
* roadmap says a critical feature is complete but code is missing;
* docs guide AI to edit wrong modules.

### Medium risk

Use medium risk for:

* implementation function index outdated;
* module dependency description outdated;
* test-plan incomplete;
* flow docs partially outdated.

### Low risk

Use low risk for:

* minor wording issue;
* missing non-critical helper description;
* old changelog entry;
* formatting inconsistency.

## Final Response After Audit

After creating the audit report, output:

```md
## 文档审计总结

### 审计报告

- 已创建：

### 总体状态

-

### 高风险问题

-

### 建议修复顺序

1.
2.
3.

### 需要人工确认

-
```

