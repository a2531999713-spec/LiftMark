# Daily Development Workflow

Use this workflow when the user asks to implement a feature, fix a bug, refactor code, or modify existing behavior in a project that uses docs.

## Goal

Use docs as the starting point, then verify with source code, then modify code and synchronize docs.

## Required Steps

### Step 1: Read project docs

If these files exist, read them first:

```text
docs/README.md
docs/project-overview.md
docs/development-roadmap.md
docs/ai-development-rules.md
````

If the task is architecture-related, also read:

```text
docs/technical-architecture.md
```

If the task is business-rule-related, also read:

```text
docs/product-design.md
```

### Step 2: Identify affected modules

From the user request and project docs, identify affected modules.

Then read relevant module docs:

```text
docs/modules/{module}/overview.md
docs/modules/{module}/design.md
docs/modules/{module}/principle.md
docs/modules/{module}/implementation.md
```

Read API, flow, database, or test docs if relevant.

### Step 3: Verify source code

Before editing, inspect the relevant source files.

Use documentation to narrow the search scope, but trust the source code over documentation.

If the docs are outdated, note the mismatch.

### Step 4: Plan small changes

Before editing, create a concise implementation plan:

```md
## 实施计划

1.
2.
3.

## 预计影响范围

-

## 需要同步的文档

-
```

For small tasks, keep the plan short.

### Step 5: Modify code

Rules:

* make targeted changes;
* avoid unrelated refactoring;
* preserve module boundaries;
* preserve public APIs unless the task requires changing them;
* preserve backwards compatibility unless explicitly changed;
* add tests for behavior changes;
* avoid deleting logic that is not understood.

### Step 6: Run or update tests when possible

Prefer relevant tests over full-suite tests if the project is large.

If tests cannot be run, explain why.

### Step 7: Synchronize docs

After code changes, apply the rules in `document-sync-rules.md`.

Update only affected documents.

### Step 8: Final response

End with:

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

## Special Cases

### Bug fix

For bug fixes, update implementation docs if the bug reveals an important constraint.

If the bug is caused by incorrect design assumptions, update design or principle docs.

### Refactor

For refactors, clearly state behavior that must remain unchanged.

Update implementation docs if file structure, core functions, dependencies, or module responsibilities changed.

### API change

Update API docs, module API docs, error codes, frontend usage docs, and roadmap if applicable.

### Database change

Update schema docs, migrations docs, data dictionary, and affected module docs.

### High-risk module

For auth, payment, permissions, billing, database migration, security, or production configuration changes:

* read principle docs;
* avoid broad changes;
* add or update tests;
* update change-notes;
* explicitly state risk.

