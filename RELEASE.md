# 版本发布指南

本文档说明 **练刻 LiftMark** 项目的版本发布流程、规范和最佳实践。

## 📋 目录

- [版本号规范](#版本号规范)
- [发布流程](#发布流程)
- [发布检查清单](#发布检查清单)
- [版本记录格式](#版本记录格式)
- [自动化工具](#自动化工具)
- [常见问题](#常见问题)

## 🔢 版本号规范

我们使用 [语义化版本](https://semver.org/) (SemVer) 规范：

```
MAJOR.MINOR.PATCH
```

### 版本号含义

| 类型 | 说明 | 示例 |
|------|------|------|
| **MAJOR** | 重大功能变更或破坏性更新 | `1.0.0` → `2.0.0` |
| **MINOR** | 新增功能，向后兼容 | `1.2.0` → `1.3.0` |
| **PATCH** | Bug 修复，向后兼容 | `1.2.3` → `1.2.4` |

### 版本号决定原则

**MAJOR (重大版本)**
- 移除或重写现有 API
- 修改数据结构（需要迁移）
- 改变应用核心行为
- 最低系统要求变更

**MINOR (功能版本)**
- 新增用户可见功能
- 新增 API 端点
- 新增组件或模块
- 性能优化（不影响 API）

**PATCH (修复版本)**
- Bug 修复
- 安全补丁
- 文档更新
- 依赖更新（不影响 API）

### 预发布版本

```
MAJOR.MINOR.PATCH-PRERELEASE
```

- `alpha` - 内部测试版
- `beta` - 公开测试版
- `rc` - 候选发布版

示例：`1.2.0-alpha.1`、`1.2.0-beta.2`、`1.2.0-rc.1`

## 🚀 发布流程

### 1. 准备阶段

#### 确定版本号
```bash
# 查看当前版本
npm version --json

# 确定新版本号（基于变更内容）
# MAJOR: 破坏性变更
# MINOR: 新功能
# PATCH: Bug 修复
```

#### 更新文档
- 更新 `CHANGELOG.md`
- 更新 `README.md`（如有必要）
- 更新相关文档

### 2. 创建发布分支

```bash
# 从 develop 分支创建发布分支
git checkout develop
git pull origin develop
git checkout -b release/v1.2.0

# 更新版本号
npm version 1.2.0 --no-git-tag-version

# 提交版本号变更
git add package.json package-lock.json
git commit -m "chore: bump version to 1.2.0"
```

### 3. 测试验证

```bash
# 运行完整测试套件
npm run typecheck
npm run lint
npm test

# 手动测试关键功能
# - 训练记录流程
# - 计划创建/导入
# - 成员管理
# - 数据导出/导入

# 构建 APK 进行真机测试
npm run android:preview
```

### 4. 最终审查

- [ ] 代码审查完成
- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] CHANGELOG 已更新
- [ ] 版本号正确
- [ ] 无未解决的 TODO 或 FIXME

### 5. 合并到主分支

```bash
# 合并到 main 分支
git checkout main
git merge release/v1.2.0

# 创建版本标签
git tag -a v1.2.0 -m "Release v1.2.0"

# 推送到远程
git push origin main --tags
```

### 6. 合并回开发分支

```bash
# 合并回 develop 分支
git checkout develop
git merge release/v1.2.0

# 推送到远程
git push origin develop

# 删除发布分支
git branch -d release/v1.2.0
git push origin --delete release/v1.2.0
```

### 7. 创建 GitHub Release

1. 访问 GitHub 仓库的 Releases 页面
2. 点击 "Create a new release"
3. 选择刚创建的标签 `v1.2.0`
4. 填写发布标题和描述
5. 上传构建产物（APK、IPA 等）
6. 发布 Release

### 8. 构建和分发

```bash
# 构建生产版本
npm run android:release

# 上传到应用商店
# - Google Play Store
# - Apple App Store
# - 其他分发渠道
```

## ✅ 发布检查清单

### 代码质量
- [ ] TypeScript 类型检查通过
- [ ] ESLint 代码检查通过
- [ ] 所有测试通过
- [ ] 无安全漏洞
- [ ] 性能无回退

### 功能验证
- [ ] 核心功能正常工作
- [ ] 新功能按预期工作
- [ ] 边界情况已处理
- [ ] 错误处理完善
- [ ] 用户体验良好

### 文档更新
- [ ] CHANGELOG.md 已更新
- [ ] README.md 已更新（如有必要）
- [ ] API 文档已更新（如有必要）
- [ ] 用户指南已更新（如有必要）

### 版本信息
- [ ] package.json 版本号正确
- [ ] app.json 版本号正确（Expo/React Native）
- [ ] 版本标签已创建
- [ ] 版本描述已准备

### 构建和分发
- [ ] 开发构建成功
- [ ] 生产构建成功
- [ ] APK/IPA 文件正常
- [ ] 签名正确
- [ ] 分发渠道准备就绪

## 📝 版本记录格式

### CHANGELOG.md 格式

```markdown
# LiftMark (练刻) 更新日志

---

## v1.2.0 — 2026-06-30

**简短描述本次发布的主要变更**

### 新功能
- 功能描述 #issue_number
- 功能描述

### 优化
- 优化描述 #issue_number
- 优化描述

### 修复
- 修复描述 #issue_number
- 修复描述

### 其他变更
- 其他变更描述

### 破坏性变更（如有）
- 破坏性变更描述
- 迁移指南

---

## v1.1.0 — 2026-06-22

**简短描述**

### 新功能
- ...

### 修复
- ...
```

### 提交信息格式

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```bash
# 新功能
git commit -m "feat(training): add RPE/RIR selector to workout page"

# 修复 bug
git commit -m "fix(ui): resolve button overlap on small screens"

# 文档更新
git commit -m "docs(readme): update installation instructions"

# 重构
git commit -m "refactor(data): simplify workout history fetching"

# 性能优化
git commit -m "perf(render): optimize list rendering for large datasets"

# 测试
git commit -m "test(auth): add unit tests for login flow"
```

### GitHub Release 描述格式

```markdown
## v1.2.0 (2026-06-30)

### ✨ 新功能
- 新增 RPE/RIR 选择器到训练页面 (#123)
- 支持训练计划导入导出 (#124)

### 🐛 修复
- 修复按钮重叠问题 (#125)
- 修复日期格式显示错误 (#126)

### ⚡ 优化
- 优化列表渲染性能 (#127)
- 减少内存占用 (#128)

### 📝 文档
- 更新安装指南 (#129)

### 🔧 其他
- 更新依赖版本 (#130)

### 📦 构建产物
- `app-release.apk` - Android 生产版本
- `app-preview.apk` - Android 预览版本
```

## 🤖 自动化工具

### 版本号更新脚本

创建 `scripts/update-version.js`：

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('请提供版本号：node scripts/update-version.js 1.2.0');
  process.exit(1);
}

// 更新 package.json
const packagePath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.version = version;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

// 更新 app.json
const appPath = path.join(__dirname, '../app.json');
const appJson = JSON.parse(fs.readFileSync(appPath, 'utf8'));
appJson.expo.version = version;
fs.writeFileSync(appPath, JSON.stringify(appJson, null, 2) + '\n');

console.log(`版本已更新为 ${version}`);
```

### CHANGELOG 生成脚本

使用 [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog)：

```bash
# 安装
npm install -g conventional-changelog-cli

# 生成 CHANGELOG
conventional-changelog -p angular -i CHANGELOG.md -s

# 从特定版本开始
conventional-changelog -p angular -i CHANGELOG.md -s -r 0
```

### Git 标签管理

```bash
# 创建带注释的标签
git tag -a v1.2.0 -m "Release v1.2.0"

# 查看所有标签
git tag -l

# 推送标签到远程
git push origin v1.2.0

# 推送所有标签
git push origin --tags

# 删除本地标签
git tag -d v1.2.0

# 删除远程标签
git push origin --delete v1.2.0
```

## ❓ 常见问题

### Q: 如何确定下一个版本号？

A: 基于变更内容决定：
- 有破坏性变更 → MAJOR
- 有新功能 → MINOR
- 只有修复 → PATCH

### Q: 发布分支应该保留多久？

A: 建议：
- 发布后立即删除已合并的发布分支
- 保留版本标签作为历史记录
- 本地分支可在合并后删除

### Q: 如何处理发布过程中的紧急修复？

A: 1. 从发布分支创建修复分支
2. 修复问题并测试
3. 合并回发布分支
4. 继续发布流程

### Q: 如何回滚发布？

A: 1. 创建新版本修复问题
2. 不要删除有问题的版本标签
3. 在 Release 说明中标记问题
4. 发布修复版本

### Q: 多平台发布顺序？

A: 建议：
1. 先发布 Android（审核快）
2. 再发布 iOS（审核慢）
3. 同时发布 Web 版本
4. 保持版本号一致

## 📚 相关资源

- [语义化版本规范](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Releases 最佳实践](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- [Expo 版本管理](https://docs.expo.dev/workflow/publishing/#versioning-your-app)
- [React Native 版本管理](https://reactnative.dev/docs/signed-apk-android#versioning-your-app)

---

最后更新：2026-06-30