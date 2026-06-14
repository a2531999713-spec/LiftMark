---
name: ai-doc-driven-development
description: ai document driven development workflow for software projects. use this skill when the user asks to scan a codebase, create or maintain project docs, generate technical/design/roadmap documents, update docs after code changes, enforce docs/code synchronization, create module documentation, or run a periodic documentation consistency audit. also use when the user wants ai-assisted development to rely on docs instead of repeatedly scanning the entire project.
---

# AI Doc Driven Development

Use this skill to help maintain software projects with an AI-readable documentation system. The core workflow is:

1. First full project scan.
2. Generate or repair the `docs/` knowledge base.
3. Use docs as the entry point for future development.
4. Read relevant source code to verify docs before editing.
5. Modify code in small, targeted steps.
6. Update affected documentation after code changes.
7. Periodically audit docs against the actual codebase.

## Core Principle

Treat code as the source of truth.

Treat documentation as:

- project navigation;
- architecture memory;
- design rationale;
- module boundary definition;
- implementation index;
- development roadmap;
- AI operating context.

Never treat documentation as a substitute for reading relevant source code.

## Use Cases

Use this skill for:

- creating a `docs/` folder for a new or existing project;
- scanning a project and generating project overview documents;
- generating technical architecture documents;
- generating product or system design documents;
- generating development roadmaps;
- generating module-level documentation;
- creating implementation documents that point to files, classes, functions, symbols, and tests;
- updating docs after a feature, bug fix, refactor, API change, database change, or architecture change;
- running a weekly or per-version documentation consistency audit;
- checking whether documentation and code are synchronized;
- creating AI development rules for a project.

## Required Behavior

When this skill is active, always follow these rules:

1. Read project docs before editing code when docs exist.
2. Read relevant source code before making any code changes.
3. Use docs to narrow the search scope, not to replace code inspection.
4. Update only affected documents after a change.
5. Do not update every document mechanically.
6. If no document needs updating, explicitly explain why.
7. If docs conflict with code, treat code as correct and update docs.
8. Distinguish confirmed facts from assumptions.
9. Avoid writing speculative content as fact.
10. Do not document every ordinary function.
11. Document only important modules, public interfaces, core functions, high-risk logic, data models, flows, and cross-module dependencies.
12. Prefer file path + symbol name over fragile line numbers.
13. Line numbers may be included only as auxiliary hints.
14. Preserve module boundaries.
15. Avoid unrelated refactoring.
16. After every development task, output a documentation synchronization summary.

## Workflow Selection

Choose the workflow based on the user's request.

### First-time project scan

If the user asks to read a project, initialize docs, create technical docs, create design docs, create a roadmap, or build an AI-readable documentation system:

Read `references/initial-project-scan.md`.

Then create or update the project `docs/` structure.

### Daily development

If the user asks to implement a feature, fix a bug, refactor code, or modify existing behavior in a documented project:

Read `references/daily-development-workflow.md`.

Then use the existing docs to locate relevant modules and source code.

### Documentation synchronization

If code has changed, or the user asks whether docs need updates:

Read `references/document-sync-rules.md`.

Then update only affected docs and output the synchronization table.

### Documentation audit

If the user asks for a weekly audit, version audit, full docs/code consistency check, or documentation drift check:

Read `references/document-audit.md`.

Then produce an audit report under `docs/audits/YYYY-MM-DD-doc-audit.md`.

### Document templates

If the user asks to create docs or repair missing docs:

Read `references/docs-templates.md`.

Use templates from `assets/docs-template/` when creating top-level docs.

### Output formatting

If the user asks for a summary, PR note, audit report, or post-development report:

Read `references/output-formats.md`.

## Required Project Docs Structure

For software projects using this workflow, prefer this structure:

```text
docs/
  README.md
  project-overview.md
  technical-architecture.md
  product-design.md
  development-roadmap.md
  ai-development-rules.md
  changelog.md
  glossary.md

  modules/
    {module-name}/
      overview.md
      design.md
      principle.md
      implementation.md
      api.md
      data-flow.md
      test-plan.md
      change-notes.md

  flows/
    {business-flow}.md

  database/
    schema.md
    migrations.md
    data-dictionary.md

  api/
    rest-api.md
    websocket-api.md
    error-codes.md

  adr/
    ADR-001-example.md

  audits/
    YYYY-MM-DD-doc-audit.md
````

Do not create all optional folders blindly. Create folders that fit the actual project.

## Required Final Response After Development Tasks

After any code modification, include:

```md
## 修改总结

### 代码修改

- 修改文件：
- 新增文件：
- 删除文件：

### 功能变化

-

### 测试情况

-

### 文档同步检查

| 文档 | 是否更新 | 原因 |
|---|---|---|

### 风险说明

-

### 后续建议

-
```

## Prohibited Behavior

Do not:

* edit code without reading relevant docs when docs exist;
* rely only on docs without verifying source code;
* rewrite all docs after every small change;
* document every trivial helper function;
* use line numbers as the only implementation locator;
* delete compatibility logic without understanding why it exists;
* perform unrelated refactors;
* silently ignore outdated docs;
* mark assumptions as confirmed facts;
* finish a code task without reporting documentation impact.

