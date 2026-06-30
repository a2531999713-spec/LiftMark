# Body Metrics 模块实现文档

更新时间：2026-06-30

## 模块职责

- 在 `app/profile/body-metrics.tsx` 为当前小组第一位训练成员记录体重、体脂、围度和备注。
- 支持身体目标：增肌、减脂、维持，可选目标体重、目标日期和备注。
- 展示最近变化摘要、目标进度、体重/体脂/围度趋势，以及近 4 周训练频率与训练量关联摘要。
- 数据写入 SQLite `body_metrics` 表，走 `BodyMetricsRepository`，不使用 AsyncStorage。
- 趋势由 `src/domain/body/body-metrics-analysis.ts` 生成，按实际记录日期排序，最多展示最近 12 条有效记录。

## 主要文件

| 文件 | 说明 |
|---|---|
| `app/profile/body-metrics.tsx` | 我的页二级页面，录入和查看身体数据。 |
| `src/domain/body/body-metrics.types.ts` | 身体数据领域类型。 |
| `src/domain/body/body-metrics-analysis.ts` | 趋势、变化摘要、目标进度和训练关联辅助函数。 |
| `src/data/repositories/bodyMetricsRepository.ts` | Repository 接口。 |
| `src/data/local/repositories/bodyMetricsRepository.ts` | SQLite 实现。 |
| `src/tests/body-metrics.test.ts` | 趋势排序、变化摘要和目标进度单元测试。 |

## 页面结构

1. 顶部状态卡：当前体重、较上次变化、最近记录日期、当前目标。
2. 快速记录：默认只显示日期、体重、备注；“更多身体围度”折叠展开体脂和围度。
3. 目标设置：折叠卡片内维护目标类型、目标体重、目标日期和备注。
4. 变化摘要：最近 7 天、30 天、最近一次变化和记录频率。
5. 训练关联：近 4 周训练次数、完成组数、训练量与体重变化摘要。
6. 趋势图：体重、体脂、腰围/围度使用日期横轴和真实单位。

## 数据说明

- `body_metrics` 按 `member_id + date` 复用当天记录，不创建重复日期数据。
- `body_metric_goals` 每位成员保留一条当前目标。
- 身体数据不做医学诊断，不输出健康结论。

## 验证

- `npm run typecheck`
- `npm test -- --runInBand`
