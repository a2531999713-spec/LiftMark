# ADR-001 React Native + Expo + SQLite 技术方案

更新时间：2026-06-09

## 状态

Accepted

## 背景

项目第一版目标是安卓本地可用，让 2-5 人在健身房训练时快速查看今日训练、计算建议重量、记录实际完成情况，并生成下次建议。训练现场不能依赖网络，训练记录不能丢失。

项目采用 React Native + Expo + TypeScript + SQLite，支持 Android、iOS 和 Web 平台。

## 决策

第一阶段采用：

- React Native。
- Expo。
- TypeScript。
- Expo Router。
- Expo SQLite。
- Zustand。
- Jest + React Native Testing Library。

训练数据保存到 SQLite。AsyncStorage 只用于轻量设置、首次启动标记、最近选中的 `group_id` 和主题偏好。

## 原因

- React Native + Expo 能更快构建 Android 本地 App，同时预留 iOS。
- SQLite 支持离线训练、结构化记录和历史查询。
- TypeScript 有利于计划模板、训练记录和进阶规则的类型约束。
- Expo Router 适合页面路由和后续移动端扩展。
- Repository 层能隔离本地 SQLite 和未来 Supabase 同步。

## 被拒绝方案

### PWA 作为主应用

拒绝原因：第一阶段开发文档明确不做 PWA 主应用，训练现场体验、离线可靠性和移动端能力优先。

### 纯原生 Android

拒绝原因：开发速度慢，iOS 预留成本更高。

### AsyncStorage 保存训练记录

拒绝原因：训练数据结构复杂，需要 session、动作记录、每组记录、建议和历史查询；AsyncStorage 只适合轻量设置。

### 计划硬编码到页面组件

拒绝原因：破坏“计划是数据，不是代码”，无法支持计划编辑、计划分享和多计划扩展。

## 结果

正面结果：

- 能支持离线训练闭环。
- 训练记录结构清晰。
- 后续可在 Repository 和 sync 层接 Supabase。
- Domain 层算法可测试。

代价：

- Sprint 1 已先落地 schema、migrations 和 Repository 骨架。
- 需要设计 seed 数据映射，而不是简单复制 Excel 表。
- 需要处理本地数据导出、备份和迁移。

## 后续检查

- Sprint 1 已确认 Expo SQLite 接入，并以 `schema_migrations` 表和顺序 migration 数组实现本地 migration 骨架。
- 数据库字段若变化，同步 `docs/database/schema.md`。
- Repository 接口若变化，同步 `docs/api/local-repository-api.md`。
