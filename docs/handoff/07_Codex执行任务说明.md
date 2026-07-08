# 07 Codex 执行任务说明

## 一、任务方向

本次不要继续零散修 Bug。  
正式进入核心架构重构。

重构目标：

```text
账号作用域
小组
计划
计划周期
训练执行
训练报告
同步
提醒
动作接口预留
```

## 二、开始前

先执行：

```bash
git status
git log --oneline -8
git branch --show-current
```

创建分支：

```bash
git checkout -b refactor/core-scope-plan-report-reminder
```

不要使用：

```bash
git add .
```

## 三、必须先阅读的文档

```text
docs/handoff/
docs/architecture/
CHANGELOG.md
README.md
```

如果文档路径不同，请先搜索最新架构交接文档。

## 四、P0 任务

```text
1. 重构账号作用域。
2. 重构小组空状态。
3. 重构计划状态。
4. 增加计划周期和归档结构。
5. 重构训练开始、保存、结束主链路。
6. 训练结束生成训练报告。
7. 增加热量估算字段和基础算法。
8. 增加训练提醒本地通知。
9. 动作库只预留接口，不接入媒体资源。
10. 修复同步队列 owner scope。
```

## 五、P1 任务

```text
1. 计划周期统计。
2. 历史记录按计划周期筛选。
3. 训练报告详情页。
4. 训练提醒设置页。
5. 动作图标 icon_key 映射。
```

## 六、暂时只预留

```text
1. 服务端推送。
2. 动作 GIF。
3. 第三方动作图片。
4. AI 训练总结。
5. 完整身体热力图。
6. 商业动作媒体授权接入。
```

## 七、保护规则

禁止：

```text
1. 删除 176 主号服务器训练数据。
2. 迁移 176 数据给 188。
3. 迁移 188 数据给 176。
4. 无备份执行破坏性 SQL。
5. 提交密钥、.env、.pem、数据库备份。
6. 提交临时截图、zip 包、调试日志。
```

188 测试数据可以清空或重建。

## 八、验证命令

移动端：

```bash
cd training-partner-app
npm install
npm run typecheck
npm run lint
npm test -- --runInBand
```

后端如果修改：

```bash
cd apps/liftmark-api
npm install
npm run typecheck
npm run build
```

## 九、Android 验证

必须验证：

```text
1. 清空 App 数据。
2. 登录 176。
3. 首页不错误显示“近日计划未就绪”。
4. 历史可见。
5. 计划页可用。
6. 登出。
7. 登录 188。
8. 188 不显示 176 数据。
9. 188 空状态不白屏。
10. 188 可创建小组。
11. 188 可使用计划。
12. 188 可开始训练。
13. 训练结束生成报告。
14. 训练报告显示估算热量。
15. 本地训练提醒可设置。
```

## 十、提交信息

建议：

```bash
git commit -m "refactor: stabilize account scoped training architecture"
```

如拆分提交：

```text
refactor: unify account and group scope
feat: add plan cycle archive model
feat: add training report and calorie estimate
feat: add local workout reminders
chore: reserve exercise catalog icon fields
```
