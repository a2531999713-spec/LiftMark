# Initial Project Scan Workflow

Use this workflow when the user asks to scan a project for the first time, create docs, create technical documentation, create design documentation, create a roadmap, or establish AI-readable project documentation.

## Goal

Perform one full scan of the project and create a useful `docs/` knowledge base.

Do not generate excessive documentation. Focus on documents that help AI and humans navigate and modify the project.

## Steps

### Step 1: Inspect project structure

Identify:

- root files;
- package manager;
- framework;
- programming languages;
- frontend/backend split;
- app entry points;
- test directories;
- configuration files;
- deployment files;
- database/migration files;
- API route locations;
- major source directories;
- likely modules.

### Step 2: Identify technology stack

Record confirmed technologies.

Examples:

- frontend framework;
- backend framework;
- database;
- ORM;
- state management;
- styling system;
- test framework;
- build tool;
- deployment platform;
- CI/CD system.

Mark uncertain items as assumptions.

Use labels:

```text
Confirmed from code
Inferred from naming
Needs human confirmation
````

### Step 3: Identify core modules

A module is worth documenting if it owns meaningful business or system responsibility.

Examples:

* auth;
* user;
* billing;
* payment;
* order;
* notification;
* admin;
* analytics;
* file;
* search;
* workflow.

Do not create module docs for trivial utility folders unless they are architecturally important.

### Step 4: Create top-level docs

Create or update:

```text
docs/README.md
docs/project-overview.md
docs/technical-architecture.md
docs/product-design.md
docs/development-roadmap.md
docs/ai-development-rules.md
docs/changelog.md
docs/glossary.md
```

If some documents cannot be completed from the codebase, create useful placeholders with `Needs human confirmation`.

### Step 5: Create module docs

For each meaningful module, create:

```text
docs/modules/{module}/overview.md
docs/modules/{module}/design.md
docs/modules/{module}/principle.md
docs/modules/{module}/implementation.md
docs/modules/{module}/api.md
docs/modules/{module}/data-flow.md
docs/modules/{module}/test-plan.md
docs/modules/{module}/change-notes.md
```

If a module does not have APIs or tests, still mention that clearly.

### Step 6: Create flow docs when visible

Create flow docs only for real flows found in code or strongly implied by the project.

Examples:

```text
docs/flows/login-flow.md
docs/flows/registration-flow.md
docs/flows/payment-flow.md
docs/flows/order-flow.md
```

### Step 7: Create API/database/ADR docs when relevant

Create:

```text
docs/api/
docs/database/
docs/adr/
```

only when the project contains APIs, database models, migrations, or major architecture decisions.

### Step 8: Produce final scan summary

After generating docs, output:

```md
## 初次项目梳理总结

### 已识别技术栈

-

### 已识别核心模块

-

### 已创建文档

-

### 需要人工确认的问题

-

### 高风险区域

-

### 后续建议

-
```

## Important Rules

* Do not claim certainty when code evidence is weak.
* Do not document every ordinary function.
* Do not generate huge docs just to fill space.
* Prefer concise but useful docs.
* Record design intent only when visible from code or confirmed by user.
* Otherwise mark design intent as needing confirmation.

