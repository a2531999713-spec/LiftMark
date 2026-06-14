# Activation 模块实现文档

更新时间：2026-06-12

## 1. 主要文件

| 文件 | 说明 |
|---|---|
| `src/domain/activation/activation.types.ts` | 激活状态、Repository 和远程校验接口类型。 |
| `src/domain/activation/activation.service.ts` | 试用剩余天数和本地激活码校验。 |
| `src/data/local/activation/LocalActivationRepository.ts` | SQLite 本地激活状态 Repository。 |
| `src/data/local/activation/RemoteActivationProvider.ts` | 后续远程校验预留接口实现。 |
| `src/services/activationService.ts` | App 层 service 工厂。 |
| `app/activation.tsx` | 激活码页面。 |
| `app/(tabs)/settings.tsx` | 设置页“试用与激活”入口。 |
| `src/assets/images/index.ts` | 激活页通过 `liftmarkImages.recoveryHero` 引用本地图片 Hero。 |

## 2. 数据库

新增 SQLite 表 `activation_state`，由 migration v3 创建。该表只保存本地试用/激活状态，不保存训练记录。

## 2.1 UI 资产

激活页和设置页的试用状态 Hero 使用本地图片资产，只影响页面展示；激活校验、试用剩余天数和 SQLite 持久化逻辑不依赖图片。

## 3. 测试

`src/tests/activation.test.ts` 覆盖：

- 试用剩余天数计算；
- 无效激活码拒绝；
- `LIFTMARK-TEST-2026` 本地激活成功。
