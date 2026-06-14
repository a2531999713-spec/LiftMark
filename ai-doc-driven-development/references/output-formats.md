# Output Formats

Use these output formats for consistency.

## First Project Scan Summary

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

## Daily Development Plan

```md
## 实施计划

1.
2.
3.

## 预计影响范围

-

## 需要读取的文档

-

## 需要检查的源码

-

## 可能需要同步的文档

-
```

## Post-development Summary

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

## Documentation Sync Table

```md
## 文档同步检查

| 文档 | 是否更新 | 原因 |
|---|---|---|
| docs/project-overview.md | 否 | 未改变项目整体结构 |
| docs/technical-architecture.md | 否 | 未改变技术架构 |
| docs/product-design.md | 是 | 更新业务规则 |
| docs/development-roadmap.md | 是 | 更新功能状态 |
| docs/modules/{module}/implementation.md | 是 | 更新核心函数说明 |
```

## Audit Summary

```md
## 文档审计总结

### 审计报告

- 已创建：

### 总体状态

-

### 高风险问题

-

### 中风险问题

-

### 低风险问题

-

### 建议修复顺序

1.
2.
3.

### 需要人工确认

-
```

## Human Confirmation Section

Use when facts are uncertain:

```md
## 需要人工确认的问题

1. 当前代码中未找到 {feature} 的明确实现，请确认是否尚未开发或由外部服务提供。
2. 当前 {module} 的职责根据目录命名推断，未在代码中看到明确边界定义。
3. 当前 {api} 的调用方未完全确认，需要结合前端或外部客户端继续检查。
```

## Risk Section

```md
## 风险说明

- 高风险：
- 中风险：
- 低风险：
- 回滚建议：
```
