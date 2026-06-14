# Document Synchronization Rules

Use these rules after any code or behavior change.

## Core Rule

Do not update all docs mechanically.

Instead:

1. identify what changed;
2. identify affected modules;
3. identify affected docs;
4. update only affected docs;
5. explain why unaffected docs were not updated.

## Change Type Mapping

| Change type | Docs to check |
|---|---|
| New feature | roadmap, module design, module implementation, flow docs, changelog |
| Business rule change | product-design, module design, flow docs, test-plan |
| Core function change | module implementation, test-plan, change-notes |
| API change | api docs, module api, error-codes, frontend integration docs |
| Database schema change | database/schema, migrations, data-dictionary, module docs |
| Architecture change | technical-architecture, ADR, project-overview |
| Module boundary change | project-overview, module overview, architecture |
| Permission/auth change | product-design, module design, api docs, test-plan, change-notes |
| Error code change | api/error-codes, module api |
| Config/deployment change | technical-architecture, deployment docs, changelog |
| Bug fix in high-risk logic | implementation, test-plan, change-notes |
| Refactor with no behavior change | implementation only if file/symbol structure changed |
| Formatting-only change | usually no docs update required |

## Documents and Their Update Triggers

### docs/project-overview.md

Update when:

- new major module is added;
- module responsibility changes;
- directory structure changes significantly;
- project purpose or scope changes;
- high-risk areas change.

### docs/technical-architecture.md

Update when:

- technology stack changes;
- architectural pattern changes;
- database/cache/queue/storage design changes;
- deployment or infrastructure changes;
- authentication or security architecture changes;
- cross-module dependency changes.

### docs/product-design.md

Update when:

- business rules change;
- user roles change;
- product behavior changes;
- permission rules change;
- state machines change;
- important edge cases change.

### docs/development-roadmap.md

Update when:

- a feature is completed;
- a feature starts development;
- a feature is delayed;
- scope changes;
- technical debt is added or resolved;
- roadmap status changes.

### docs/ai-development-rules.md

Update only when AI development rules, project constraints, risk modules, or required workflow changes.

### docs/changelog.md

Update when:

- feature added;
- behavior changed;
- architecture changed;
- API changed;
- database changed;
- high-risk bug fixed;
- compatibility changed.

### docs/modules/{module}/overview.md

Update when:

- module responsibility changes;
- module dependencies change;
- module public role changes;
- new important files are added.

### docs/modules/{module}/design.md

Update when:

- module business rules change;
- module states change;
- module permissions change;
- module edge cases change;
- module input/output behavior changes.

### docs/modules/{module}/principle.md

Update when:

- design rationale changes;
- security/performance principle changes;
- important constraints change;
- high-risk logic changes.

### docs/modules/{module}/implementation.md

Update when:

- core files change;
- core functions change;
- public symbols change;
- function responsibility changes;
- call relationship changes;
- dependencies change;
- tests move or change.

### docs/modules/{module}/api.md

Update when:

- endpoints change;
- request/response schema changes;
- error codes change;
- permissions change;
- compatibility notes change.

### docs/modules/{module}/data-flow.md

Update when:

- data input changes;
- processing steps change;
- storage changes;
- cross-module data interaction changes;
- error/exception path changes.

### docs/modules/{module}/test-plan.md

Update when:

- behavior changes;
- new edge cases are introduced;
- test files are added/moved;
- regression coverage changes.

### docs/modules/{module}/change-notes.md

Update for important module-level changes.

## No-Update Cases

Usually no docs update is required for:

- formatting only;
- comment typo;
- local variable rename;
- unused import removal;
- internal test refactor;
- small implementation cleanup that changes no behavior, public API, file structure, or module responsibility.

Still mention this in the final summary.

Example:

```text
本次变更仅移除未使用 import，未影响行为、接口、模块职责或文档索引，因此无需更新 docs。
````

## Required Synchronization Table

After every development task, output:

```md
## 文档同步检查

| 文档 | 是否更新 | 原因 |
|---|---|---|
| docs/project-overview.md | 否 | 未改变项目整体结构 |
| docs/technical-architecture.md | 否 | 未改变技术架构 |
| docs/product-design.md | 是 | 更新订单取消业务规则 |
| docs/development-roadmap.md | 是 | 标记订单取消功能完成 |
| docs/modules/order/implementation.md | 是 | 新增 cancelOrder() 实现说明 |
| docs/flows/order-flow.md | 是 | 补充订单取消流程 |
```

## Implementation Document Locator Rule

When updating implementation docs, prefer:

```text
file path + class/function/symbol + responsibility + caller + dependency + test location
```

Example:

```md
### login()

File: src/modules/auth/auth.service.ts  
Symbol: login()  
Search anchor: async login(  
Responsibility: validate credentials and issue access/refresh tokens.  
Caller: AuthController.login()  
Dependencies: UserRepository, TokenService, PasswordHasher  
Tests: tests/auth/auth.service.test.ts  

Change notes:
- Do not return passwordHash.
- Login failures must not reveal whether the user exists.
- Response schema changes require frontend type updates.
```

Line numbers may be included as approximate hints but never as the only locator.

