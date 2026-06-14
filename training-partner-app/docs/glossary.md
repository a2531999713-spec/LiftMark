# 术语表

更新时间：2026-06-08

| 术语 | 含义 | 相关模块 |
|---|---|---|
| 计划模板 | 定义阶段、周、训练日、动作、组数、次数和强度的数据模板 | plan |
| 个人参数 | 成员自己的 1RM、体重、加重单位等数据 | member, weight |
| 训练记录 | 某次实际训练的 session、动作记录和 set 记录 | workout, history |
| 1RM | 一次最大重量，用于百分比重量计算 | member, weight |
| RPE | 主观用力程度，RPE 10 表示极限 | workout, progression |
| RIR | 剩余次数，RIR 2 表示还能做约 2 次 | workout, progression |
| 双进阶 | 先把次数推进到上限，再增加重量 | progression |
| 减量周 | 降低重量和组数用于恢复疲劳的周期 | plan, recovery |
| A/B/C 优先级 | A 必做，B 建议做，C 状态好/有时间再做 | plan, recovery |
| 替代动作 | 器械被占或身体不适时保持动作模式的替换动作 | exercise |
| seed 数据 | 首次启动写入 SQLite 的默认计划、动作和替换库 | plan, exercise |
| Repository | Domain/UI 访问本地 SQLite 的抽象接口 | api, database |
| 本地优先 | 训练数据先写 SQLite，离线也能完整训练 | technical-architecture |
| AsyncStorage | 只允许保存轻量设置，不允许保存训练记录 | technical-architecture |
| 计划快照 | 训练记录保存当时计划字段，防止计划修改破坏历史 | workout, history |
| 进阶建议 | 完成训练后生成下次加重、维持、降重、减量或继续加次数建议 | progression |
