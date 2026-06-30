# 贡献指南

感谢您对 **练刻 LiftMark** 项目的关注！本指南将帮助您了解如何为项目做出贡献。

## 📋 目录

- [开发环境设置](#开发环境设置)
- [分支管理](#分支管理)
- [提交信息规范](#提交信息规范)
- [Pull Request 流程](#pull-request-流程)
- [代码审查](#代码审查)
- [版本发布](#版本发布)
- [问题反馈](#问题反馈)

## 🛠️ 开发环境设置

1. **Fork 本仓库**
   ```bash
   # 在 GitHub 上点击 Fork 按钮
   ```

2. **克隆你的 Fork**
   ```bash
   git clone https://github.com/your-username/LiftMark.git
   cd LiftMark
   ```

3. **添加上游远程**
   ```bash
   git remote add upstream https://github.com/a2531999713-spec/LiftMark.git
   ```

4. **安装依赖**
   ```bash
   cd training-partner-app
   npm install
   ```

5. **启动开发服务器**
   ```bash
   npm start
   ```

## 🌿 分支管理

### 分支命名规范

- `main` - 主分支，保持稳定
- `develop` - 开发分支，集成最新功能
- `feature/xxx` - 功能分支，如 `feature/add-new-exercise`
- `bugfix/xxx` - 修复分支，如 `bugfix/fix-date-format`
- `hotfix/xxx` - 紧急修复分支
- `release/xxx` - 发布分支，如 `release/v1.2.0`

### 工作流程

1. **从 `develop` 分支创建新分支**
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/your-feature-name
   ```

2. **开发完成后推送**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **创建 Pull Request**

## 📝 提交信息规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范来格式化提交信息。

### 格式

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### 类型 (type)

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式（不影响逻辑）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 添加测试
- `build`: 构建系统或外部依赖变更
- `ci`: CI 配置变更
- `chore`: 其他杂项变更
- `revert`: 回滚提交

### 范围 (scope)

可选，表示影响范围：
- `ui`: UI 相关
- `api`: API 相关
- `db`: 数据库相关
- `auth`: 认证相关
- `training`: 训练功能
- `plan`: 计划功能
- `member`: 成员管理

### 示例

```bash
# 新功能
git commit -m "feat(training): add RPE/RIR selector to workout page"

# 修复 bug
git commit -m "fix(ui): resolve button overlap on small screens"

# 文档更新
git commit -m "docs(readme): update installation instructions"

# 重构
git commit -m "refactor(data): simplify workout history fetching"
```

### 提交信息检查

我们使用 `commitlint` 来检查提交信息格式。在提交前，可以运行以下命令检查：

```bash
npm run commitlint
```

## 🔄 Pull Request 流程

1. **确保代码是最新的**
   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

2. **推送你的分支**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **创建 Pull Request**
   - 标题：简洁描述变更内容
   - 描述：详细说明变更内容、相关问题、测试情况
   - 选择正确的标签（`feature`, `bugfix`, `documentation` 等）

4. **关联 Issue**
   - 在描述中使用 `Fixes #123` 或 `Closes #123` 自动关联 Issue

5. **等待审查**
   - 至少需要一位维护者批准
   - 确保 CI 通过

6. **合并**
   - 使用 Squash and Merge（推荐）或 Rebase and Merge
   - 删除特性分支

## 🔍 代码审查

### 审查要点

1. **代码质量**
   - 遵循项目编码规范
   - 类型安全（TypeScript）
   - 适当的错误处理

2. **功能完整性**
   - 功能是否完整
   - 边界情况处理
   - 用户体验

3. **测试覆盖**
   - 单元测试
   - 集成测试
   - 手动测试

4. **性能影响**
   - 无不必要的渲染
   - 内存泄漏检查
   - 合理的缓存策略

### 审查流程

1. **自我审查** - 提交前自己检查一遍
2. **自动化检查** - CI 会运行 lint、类型检查和测试
3. **人工审查** - 至少一位维护者审查
4. **反馈处理** - 根据反馈进行修改
5. **最终批准** - 获得批准后合并

## 📦 版本发布

### 版本号规范

使用 [语义化版本](https://semver.org/)：`MAJOR.MINOR.PATCH`

- **MAJOR**: 重大功能变更或破坏性更新
- **MINOR**: 新增功能，向后兼容
- **PATCH**: Bug 修复，向后兼容

### 发布流程

1. **更新版本号**
   - 修改 `package.json` 中的版本号
   - 更新 `CHANGELOG.md`

2. **创建发布分支**
   ```bash
   git checkout -b release/v1.2.0
   ```

3. **测试和修复**
   - 在发布分支上进行最终测试
   - 修复发现的问题

4. **合并到主分支**
   ```bash
   git checkout main
   git merge release/v1.2.0
   git tag v1.2.0
   ```

5. **合并回开发分支**
   ```bash
   git checkout develop
   git merge release/v1.2.0
   ```

6. **推送到远程**
   ```bash
   git push origin main --tags
   git push origin develop
   ```

7. **创建 GitHub Release**
   - 在 GitHub 上创建新 Release
   - 附上构建产物（APK、IPA 等）

## ❓ 问题反馈

### Bug 报告

1. 在 GitHub Issues 中创建新 Issue
2. 使用 Bug 报告模板
3. 提供以下信息：
   - 问题描述
   - 复现步骤
   - 期望行为
   - 实际行为
   - 环境信息（OS、设备、App 版本）
   - 截图或日志

### 功能建议

1. 在 GitHub Issues 中创建新 Issue
2. 使用功能建议模板
3. 描述：
   - 功能需求
   - 使用场景
   - 预期行为
   - 可能的实现方案

## 📚 相关资源

- [React Native 文档](https://reactnative.dev/)
- [Expo 文档](https://docs.expo.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [语义化版本](https://semver.org/)

---

感谢您的贡献！🎉