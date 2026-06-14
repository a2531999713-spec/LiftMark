# Document System

This reference defines the documentation system used by the AI document driven development workflow.

## Purpose

The documentation system exists to help AI and human developers understand, modify, and maintain a software project without repeatedly scanning the entire codebase.

The docs should function as:

1. project map;
2. architecture memory;
3. module boundary definition;
4. business logic record;
5. implementation index;
6. development roadmap;
7. documentation/code synchronization checklist;
8. audit target.

## Core Rule

Code is the source of truth.

Documentation is the navigation layer and design memory.

When documentation and code conflict, prefer the code and update the documentation.

## Documentation Layers

### 1. Project-level docs

Project-level docs describe the whole system.

Expected files:

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
````

### 2. Module-level docs

Module docs describe one specific module.

Expected structure:

```text
docs/modules/{module-name}/
  overview.md
  design.md
  principle.md
  implementation.md
  api.md
  data-flow.md
  test-plan.md
  change-notes.md
```

Only create module docs for meaningful modules. Avoid creating heavy documentation for trivial folders.

### 3. Flow docs

Flow docs describe cross-module user, business, or system flows.

Examples:

```text
docs/flows/login-flow.md
docs/flows/payment-flow.md
docs/flows/order-flow.md
```

### 4. API docs

API docs describe external or internal interfaces.

Examples:

```text
docs/api/rest-api.md
docs/api/websocket-api.md
docs/api/error-codes.md
```

### 5. Database docs

Database docs describe schema, migrations, important tables, and data constraints.

Examples:

```text
docs/database/schema.md
docs/database/migrations.md
docs/database/data-dictionary.md
```

### 6. ADR docs

ADR means Architecture Decision Record.

Use ADR docs for major architecture decisions.

Examples:

```text
docs/adr/ADR-001-tech-stack-selection.md
docs/adr/ADR-002-authentication-design.md
docs/adr/ADR-003-database-selection.md
```

### 7. Audit docs

Audit docs record periodic documentation/code consistency checks.

Examples:

```text
docs/audits/2026-06-08-doc-audit.md
docs/audits/2026-06-15-doc-audit.md
```

## What Good Docs Should Contain

Good docs should record:

* why the module exists;
* what the module owns;
* what the module does not own;
* key business rules;
* key technical decisions;
* core files;
* core functions;
* public interfaces;
* data flow;
* high-risk logic;
* test locations;
* known constraints;
* change risks.

## What Docs Should Avoid

Avoid:

* translating every line of code into prose;
* listing every trivial helper function;
* duplicating large amounts of code;
* overusing line numbers;
* documenting guesses as facts;
* creating docs that no one will read;
* forcing every tiny change to update every document.

## Stable Implementation References

Prefer:

```text
file path + class name + function name + symbol/search anchor
```

Example:

```text
File: src/modules/auth/auth.service.ts
Symbol: login()
Search anchor: async login(
Responsibility: validate credentials and issue tokens
Tests: tests/auth/auth.service.test.ts
```

Avoid relying only on:

```text
src/modules/auth/auth.service.ts:93
```

Line numbers shift frequently and should only be used as approximate auxiliary hints.

