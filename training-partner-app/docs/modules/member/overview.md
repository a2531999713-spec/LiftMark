# Member 模块概览

更新时间：2026-07-01

## 2026-07-01 成员加重单位补充

- 新建成员和空值 fallback 中，杠铃 / 哑铃加重单位默认均为 2.5kg。
- 已有成员明确保存的 2kg、1.25kg 等自定义步进不做批量迁移，继续作为该成员训练参数使用。

## 2026-06-30 成员头像展示补充

- 成员头像统一从 `MemberProfile.avatarLocalUri`、`avatarThumbUrl`、`avatarUrl` 和 `GroupMember.avatarUrl` 解析。
- 训练轮换顺序、训练首页、成员页、总结页和小组分析均使用统一 Avatar 组件，不再只显示姓名首字母。
- 账号头像与成员头像分表保存；训练相关页面只读取成员头像。账号头像更新后会同步当前小组第一位训练成员头像。
- 成员列表、新增成员、编辑成员和加重单位入口均跟随当前小组。

## 1. 模块职责

管理训练成员、成员档案、1RM 和加重单位，是多人建议重量与训练记录归属的基础。

- 成员基础信息：昵称、角色、成员头像 URL / 缩略图 / 本地缓存路径。
- 成员训练参数：体重、卧推/深蹲/硬拉/肩推 1RM、引体参考总负重。
- 成员加重单位：杠铃默认 2.5kg，哑铃默认 2.5kg；成员可手动改为 2kg、1.25kg 等自定义步进。
- 成员资料的本地持久化和编辑表单。
- 当前小组内成员列表、创建和编辑。

## 2. 非职责

- 不决定小组当前计划和当前周数。
- 不生成今日训练内容。
- 不直接计算进阶建议，只提供个人参数。

## 3. 相关业务场景

- 首次使用流程。
- 今日训练生成流程。
- 训练执行和历史查看。
- 数据导出和后续云同步预留。
- 账号头像与成员头像分离：账号头像归属账号资料，成员头像归属训练成员档案。

## 4. 依赖模块

- group
- weight

## 5. 被依赖模块

- workout
- history
- progression
- export

## 6. 主要文件

Sprint 1 已创建基础领域、数据和页面占位骨架；以下路径按当前实现和后续计划合并列出：

| 文件 | 说明 |
|---|---|
| `src/domain/member/member.types.ts` | 成员、成员档案类型。 |
| `src/domain/member/member.service.ts` | 成员资料校验和领域服务。 |
| `src/config/appLimits.ts` | 本地小组成员数量等集中限制。 |
| `src/domain/member/member.validation.ts` | 成员表单校验、2-5 人数量限制和默认表单值。 |
| `src/data/local/repositories/memberRepository.ts` | 成员和档案的 SQLite Repository。 |
| `src/components/members/MemberForm.tsx` | 成员编辑表单。 |
| `src/components/members/MemberCard.tsx` | 成员列表卡片。 |
| `src/components/workout/RotationOrderCard.tsx` | 训练执行轮换顺序卡，展示成员真实头像和姓名。 |
| `app/(tabs)/members.tsx` | 成员列表页。 |
| `app/member/new.tsx` | 新增成员页。 |
| `app/member/[memberId].tsx` | 编辑成员页。 |

## 7. 核心数据结构

- GroupMember
- MemberProfile
- member_profiles
- group_members

头像限制：SQLite 只保存 URL、缩略图 URL、本地缓存路径和更新时间，不保存图片二进制或 Base64。

## 8. 修改风险

- 1RM 为空时不得阻塞进入 App，但建议重量必须显示“未设置 1RM”。
- 第一版一个本地默认小组最多支持 5 位成员；达到 5 人后新增入口显示说明卡。
- 成员删除策略待确认，不能破坏历史训练记录。

## 9. 需要人工确认的问题

- Sprint 2 已创建成员列表、新增和编辑路径；后续 Sprint 若新增/迁移文件，需继续与实际源码对齐。
- 如果实际实现与本文档不一致，应以代码为准并同步更新文档。
