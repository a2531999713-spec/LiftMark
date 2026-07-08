# 09 GitHub 文档同步建议

## 一、需要同步到 GitHub

建议同步：

```text
docs/handoff/
docs/architecture/
CHANGELOG.md
README.md
```

原因：

```text
1. 新窗口 Codex 需要读取最新架构。
2. 避免 Codex 只基于旧代码继续补 Bug。
3. 让后续每次开发都有明确依据。
4. 保留架构决策记录。
```

## 二、不要同步

```text
.env
.pem
数据库密码
服务器密钥
阿里云密钥
数据库备份
临时截图
调试日志
zip 包
未整理聊天记录
```

## 三、推荐命令

```bash
git status
git checkout -b docs/core-architecture-refactor-v3
mkdir -p docs/handoff
mkdir -p docs/architecture
```

复制文档后：

```bash
git status
git add docs/handoff/
git add docs/architecture/
git add CHANGELOG.md
git commit -m "docs: define core architecture refactor scope"
git push origin docs/core-architecture-refactor-v3
```

不要使用：

```bash
git add .
```

## 四、如果已经有重构分支

如果你已经准备直接让 Codex 修改代码，也可以把文档提交到同一个重构分支：

```bash
git checkout -b refactor/core-scope-plan-report-reminder
git add docs/handoff/
git add docs/architecture/
git commit -m "docs: add architecture refactor handoff"
git push origin refactor/core-scope-plan-report-reminder
```
