# Member 模块实现文档

更新时间：2026-06-30  
对应代码目录：`training-partner-app/`；已实现成员列表、新增成员、编辑成员、MemberProfile 表单、1RM 输入、加重单位设置和成员头像展示。

## 2026-06-30 补充：成员表单保存状态

- `src/components/members/MemberForm.tsx` 删除“这些数据会用于什么”解释区，成员资料页只保留基础信息、训练参数和加重单位。
- 表单使用 React Hook Form `mode: 'onChange'`，保存按钮必须满足“有变更 + 校验通过 + 非保存中”才可点击。
- 未修改的编辑表单按钮显示“已保存”并禁用；新建表单未填写时显示“填写后可保存”并禁用；保存中显示“保存中...”。
- 后续不得把保存按钮做成一直高亮可点的固定误触入口。

## 1. 模块职责

管理训练成员、成员档案、1RM 和加重单位，是多人建议重量与训练记录归属的基础。

## 2. 主要文件

| 文件 | 说明 |
|---|---|
| `src/domain/member/member.types.ts` | 成员、成员档案类型。 |
| `src/domain/member/member.service.ts` | 成员资料校验和领域服务。 |
| `src/config/appLimits.ts` | 本地小组成员上限等集中配置。 |
| `src/domain/member/member.validation.ts` | 成员表单 schema、默认值和成员数量限制。 |
| `src/data/local/repositories/memberRepository.ts` | 成员和档案的 SQLite Repository。 |
| `src/components/members/MemberForm.tsx` | 成员编辑表单。 |
| `src/components/members/MemberCard.tsx` | 成员列表卡片。 |
| `src/components/workout/RotationOrderCard.tsx` | 训练执行轮换顺序卡，读取 profile 头像并展示成员真实头像。 |
| `app/(tabs)/members.tsx` | 成员列表页。 |
| `app/member/new.tsx` | 新增成员页。 |
| `app/member/[memberId].tsx` | 编辑成员页。 |

## 3. 核心类/函数

### MemberRepository.listMembers

文件：见主要文件列表  
符号：`MemberRepository.listMembers`  
搜索锚点：`MemberRepository`  
职责：按 groupId 查询成员列表。  
调用方：workout, history, progression, export  
依赖：group, weight  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### MemberRepository.getMemberProfile

文件：见主要文件列表  
符号：`MemberRepository.getMemberProfile`  
搜索锚点：`MemberRepository`  
职责：读取成员 1RM、体重、加重单位和头像字段。  
调用方：workout, history, progression, export  
依赖：group, weight  
测试：见 `test-plan.md`  

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### MemberRepository.updateProfile

文件：见主要文件列表  
符号：`MemberRepository.updateProfile`  
搜索锚点：`MemberRepository`  
职责：保存成员训练参数。  
调用方：workout, history, progression, export  
依赖：group, weight  
测试：见 `test-plan.md`  
头像字段：可保存 `avatarUrl`、`avatarThumbUrl`、`avatarLocalUri`、`avatarUpdatedAt`，但图片文件处理由头像服务负责，不在 Repository 内处理二进制。

修改注意：

1. 不要把该逻辑移动到页面组件。
2. 保持输入输出可测试。
3. 修改后同步相关模块和流程文档。

### memberFormSchema

文件：`src/domain/member/member.validation.ts`  
符号：`memberFormSchema`  
搜索锚点：`memberFormSchema`  
职责：校验成员昵称、体重、1RM 和加重单位；允许 1RM 留空。  
调用方：`src/components/members/MemberForm.tsx`  
依赖：Zod  
测试：`src/tests/member.test.ts`  

修改注意：

1. 不要让页面组件复制字段校验规则。
2. 1RM 留空必须继续允许保存成员。
3. 修改字段时同步成员表单、测试计划和 Repository API 文档。

### canAddGroupMember

文件：`src/domain/member/member.validation.ts`  
符号：`canAddGroupMember`  
搜索锚点：`canAddGroupMember`  
职责：限制本地默认小组最多 5 名成员。  
调用方：`app/(tabs)/members.tsx`, `app/member/new.tsx`  
依赖：`src/config/appLimits.ts`  
测试：`src/tests/member.test.ts`

## 4. 数据结构

- GroupMember
- MemberProfile
- member_profiles
- group_members

`MemberProfile` 中的头像字段只代表训练成员头像。账号头像由 `src/services/avatar/*` 和 `account_profile_cache` 维护。

头像根因说明：我的页账号头像展示优先读 `account_profile_cache`，但训练执行、训练首页、记录和小组分析按成员读取 `member_profiles`。因此只更新账号缓存不会让训练相关页面自动变化；当前实现会在账号头像更新/删除时同步当前小组第一位训练成员的 profile 头像字段，UI 层统一使用 `Avatar` 组件解析本地路径、缩略图 URL、远程 URL 和成员兜底头像。

## 5. 调用关系

- 依赖：group, weight
- 被调用：workout, history, progression, export

## 6. 测试位置

- 创建 2-5 个成员后均可独立保存 1RM。
- 关闭 App 后成员资料仍存在。
- 缺失 1RM 时今日训练页不崩溃。

建议测试文件：

- `src/tests/member.test.ts`
- 若函数位于更细分文件，按实际路径拆分测试文件。

## 7. 高风险区域

- 1RM 为空时不得阻塞进入 App，但建议重量必须显示“未设置 1RM”。
- 成员删除策略待确认，不能破坏历史训练记录。

## 8. 文档同步记录

- 2026-06-08：根据需求文档、开发文档和 Excel 计划初始化模块实现说明。
- 2026-06-09：同步 Sprint 1 代码骨架：成员类型、成员服务、Repository 接口与 SQLite 实现已创建。
- 2026-06-09：同步 Sprint 2 成员管理：成员列表、新增/编辑页面、成员表单校验和成员单元测试已创建。
- 2026-06-10：同步 Android development build 调整：成员数据继续写入 SQLite，不改用 AsyncStorage；数据库初始化入口可重复安全调用，适配 native 首屏启动。
- 2026-06-10：同步 Gradle/JDK toolchain 修复：Member 模块代码未改动；成员持久化仍依赖 native SQLite，Android 构建固定使用 `JAVA_HOME` JDK 17。
- 2026-06-10：同步本地 Android 预览 APK 流程：成员数据存储仍为 native SQLite；本地 release APK 已完成安装和首屏烟测，成员新增/编辑后关闭重开的持久化场景仍需后续手工验证。
- 2026-06-12：同步可用性 + UI 落地 Sprint：`MemberForm` 改为顶部训练氛围 Hero、基础信息卡、两列训练参数卡、加重单位卡和说明卡；保存链路仍使用原有 Zod 校验和 SQLite Repository。
- 2026-06-12：同步本地图片资产落地：`MemberForm` 的 Hero 通过 `liftmarkImages.partnerHero` 使用本地训练搭子图片；成员数据结构、校验和 SQLite 保存链路未变。
- 2026-06-15：本地小组成员上限从 4 调整为 5，并集中到 `src/config/appLimits.ts`。
- 2026-06-28：成员档案增加头像 URL、缩略图、本地缓存路径和更新时间字段；账号头像与成员头像分离，SQLite 不保存图片二进制或 Base64。
- 2026-06-30：训练执行轮换顺序卡接入成员 profile 头像；训练现场不再只依赖 `GroupMember.avatarUrl` 或姓名首字。
- 2026-06-30：成员列表、新增成员、成员编辑、加重单位、训练档案和身体数据入口改为跟随 `selectedGroupStore` 当前小组。
