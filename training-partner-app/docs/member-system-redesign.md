# 小组成员系统重构设计文档

## 1. 背景与目标

### 1.1 当前问题

- 小组成员是本地创建的"占位符"，不绑定真实账号
- 训练数据只存在于创建者的手机上，组员无法查看
- 头像不同步，因为成员没有真实的用户身份
- 多人训练时，每个人都要掏手机记录，效率低

### 1.2 设计目标

- 所有小组成员都是**真实注册用户**，通过邀请码加入
- 支持**一人记录多人数据**：训练结束后可选择上传到组员账号
- 组员登录后收到提示，**确认或拒绝**他人上传的训练数据
- 保留过渡期：本地创建成员功能暂时保留，逐步引导用户使用邀请制

---

## 2. 核心概念

### 2.1 两种成员类型

| 类型 | 来源 | 数据归属 | 同步方式 |
|------|------|----------|----------|
| **真实成员** | 通过邀请码加入的注册用户 | 归属各自账号 | 必须同步 |
| **本地成员** | 手机上手动创建（过渡期） | 归属当前设备 | 可选同步到记录者账号 |

### 2.2 训练数据流向

```
场景：A、B、C 在同一个健身房，只有 A 的手机记录

1. A 记录训练数据（包含 A、B、C 的数据）
2. A 的数据 → 自动上传到 A 的账号
3. B、C 的数据 → A 选择是否上传
4. 如果 A 选择上传 → 数据进入服务器"待确认"队列
5. B 登录 → 看到提示"A 为你记录了一次训练"
6. B 确认 → 数据写入 B 的账号
7. B 拒绝 → 数据丢弃
```

---

## 3. 服务器端设计

### 3.1 数据库表结构

#### 3.1.1 修改 `group_members` 表

现有表已有 `user_id` 字段，无需修改。成员加入小组时自动绑定 `user_id`。

```sql
-- 已有结构，无需修改
CREATE TABLE group_members (
  id VARCHAR(255) PRIMARY KEY,
  group_id VARCHAR(255) NOT NULL REFERENCES groups(id),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  role VARCHAR(255) NOT NULL DEFAULT 'member',
  status VARCHAR(255) NOT NULL DEFAULT 'active',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);
```

#### 3.1.2 新建 `pending_training_data` 表

存储待确认的训练数据（由其他组员上传）。

```sql
CREATE TABLE pending_training_data (
  id VARCHAR(255) PRIMARY KEY,
  group_id VARCHAR(255) NOT NULL REFERENCES groups(id),
  uploader_user_id VARCHAR(255) NOT NULL REFERENCES users(id),  -- 上传者
  target_user_id VARCHAR(255) NOT NULL REFERENCES users(id),    -- 目标用户
  session_data JSONB NOT NULL,           -- 训练会话数据
  sets_data JSONB NOT NULL,              -- 训练组数据
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending/accepted/rejected
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pending_training_target ON pending_training_data(target_user_id, status);
```

#### 3.1.3 新建 `group_invitations` 表

存储小组邀请码和邀请记录。

```sql
CREATE TABLE group_invitations (
  id VARCHAR(255) PRIMARY KEY,
  group_id VARCHAR(255) NOT NULL REFERENCES groups(id),
  code VARCHAR(20) NOT NULL UNIQUE,      -- 邀请码
  created_by_user_id VARCHAR(255) NOT NULL REFERENCES users(id),
  max_uses INTEGER DEFAULT 1,            -- 最大使用次数
  use_count INTEGER DEFAULT 0,           -- 已使用次数
  expires_at TIMESTAMP WITH TIME ZONE,   -- 过期时间
  disabled_at TIMESTAMP WITH TIME ZONE,  -- 禁用时间
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_code ON group_invitations(code);
```

### 3.2 API 接口设计

#### 3.2.1 邀请码管理

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/groups/:id/invitations` | POST | 创建邀请码 |
| `/api/groups/:id/invitations` | GET | 获取邀请码列表 |
| `/api/groups/:id/invitations/:codeId` | DELETE | 禁用邀请码 |
| `/api/invitations/:code/join` | POST | 通过邀请码加入小组 |

**创建邀请码请求**：
```json
POST /api/groups/:id/invitations
{
  "maxUses": 10,        // 可选，默认1
  "expiresInDays": 7    // 可选，默认不过期
}
```

**通过邀请码加入**：
```json
POST /api/invitations/ABC123XYZ/join
// 无需 body，从 token 获取当前用户
```

#### 3.2.2 待确认数据

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/pending-training` | GET | 获取当前用户的待确认数据列表 |
| `/api/pending-training/:id` | POST | 确认接受数据 |
| `/api/pending-training/:id` | DELETE | 拒绝数据 |
| `/api/pending-training/upload` | POST | 上传训练数据到指定用户 |

**上传待确认数据**：
```json
POST /api/pending-training/upload
{
  "groupId": "grp_xxx",
  "targetUserId": "usr_yyy",  // 目标用户
  "sessionData": {            // 训练会话数据
    "title": "胸部训练",
    "date": "2026-07-02",
    "week": 1,
    "weekday": 3,
    "status": "completed"
  },
  "setsData": [               // 训练组数据
    {
      "exerciseId": "ex_bench",
      "setNumber": 1,
      "weight": 80,
      "reps": 10,
      "completed": true
    }
  ]
}
```

**确认数据**：
```json
POST /api/pending-training/:id/accept
// 将数据写入用户的真实训练记录
```

#### 3.2.3 成员头像同步

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/groups/:id/members` | GET | 获取小组成员（含头像） |
| `/api/sync/avatar` | POST | 同步用户头像 |

已有接口，无需修改。`GET /groups/:id/members` 已通过 JOIN `users` 表返回头像。

---

## 4. 手机端设计

### 4.1 邀请码流程

#### 4.1.1 创建小组后生成邀请码

```
用户创建小组 → 自动生成邀请码 → 显示在小组详情页
                                 ├── 复制邀请码
                                 ├── 生成二维码（可选）
                                 └── 分享链接（可选）
```

#### 4.1.2 加入小组

```
用户输入邀请码 → 调用 /api/invitations/:code/join
                ├── 成功 → 自动成为小组成员
                └── 失败 → 显示错误（码无效/已过期/人数上限）
```

### 4.2 训练数据上传流程

#### 4.2.1 训练结束时选择上传

```
训练结束 → 显示"上传训练数据"页面
          ├── 仅上传我的数据（默认选中）
          ├── 上传所有参与者的数据
          └── 自定义选择（勾选框）
```

#### 4.2.2 数据映射

手机端需要将本地成员 ID 映射到真实用户 ID：

```
本地 member_id (member_xxx) → 查询 group_members 表 → 获取 user_id
                                ↓
                         如果是真实成员（有 user_id）→ 上传到该用户
                         如果是本地成员（无 user_id）→ 提示用户绑定或跳过
```

### 4.3 待确认数据处理

#### 4.3.1 登录时检查

```
用户登录 → 调用 GET /api/pending-training
          ├── 有待确认数据 → 显示提示"X 为你记录了训练数据"
          │                   ├── 查看详情
          │                   ├── 确认接受
          │                   └── 拒绝
          └── 无待确认数据 → 正常进入主页
```

#### 4.3.2 数据确认后

```
用户确认 → 调用 POST /api/pending-training/:id/accept
          → 数据写入 workout_sessions 和 workout_sets
          → 本地数据库同步更新
          → 提示"训练数据已添加"
```

### 4.4 本地成员过渡方案

#### 4.4.1 现有功能保留

- 本地创建成员功能暂时保留
- 训练记录正常关联本地成员

#### 4.4.2 引导提示

```
当用户创建本地成员时：
"提示：邀请真实用户加入小组，可以实现多设备数据同步"
"是否生成邀请码？"
  ├── 是 → 生成邀请码页面
  └── 否 → 继续创建本地成员
```

#### 4.4.3 逐步迁移

- 小组详情页显示"邀请成员"按钮
- 成员列表中标注"本地成员"标签
- 提示用户邀请真实用户替换本地成员

---

## 5. 数据同步规则

### 5.1 谁的数据上传到哪里

| 场景 | 数据归属 | 说明 |
|------|----------|------|
| A 记录自己的训练 | A 的账号 | 自动上传 |
| A 记录 B 的训练（B 在场） | B 的账号 | 需要 B 确认 |
| A 记录本地成员 X 的训练 | A 的账号 | 本地成员无独立账号，数据归 A |
| B 登录后看到待确认数据 | B 的账号 | B 确认后写入 |

### 5.2 权限控制

- 只有小组成员才能上传训练数据给其他成员
- 只有数据目标用户才能确认或拒绝
- 上传者可以看到数据状态（待确认/已确认/已拒绝）

---

## 6. 实施步骤

### 第一阶段：服务器端 ✅ 已完成

1. 创建 `pending_training_data` 表 ✅
2. 创建 `group_invitations` 表 ✅
3. 实现邀请码接口（创建/查询/禁用/使用） ✅
4. 实现待确认数据接口（上传/查询/确认/拒绝） ✅
5. 修改 `member_profiles` 表结构 ✅

### 第二阶段：手机端 ✅ 已完成

1. 邀请码 UI（创建/显示/分享/输入） ✅
2. 训练结束上传流程（选择上传对象） ✅
3. 待确认数据提示和确认流程 ✅
4. 成员列表显示真实成员和本地成员 ⏳ 待优化

### 第三阶段：清理 ⏳ 待实施

1. 本地创建成员功能加引导提示
2. 逐步引导用户使用邀请制
3. 最终移除本地创建成员功能

---

## 8. 已实现的文件清单

### 服务器端

| 文件 | 功能 |
|------|------|
| `apps/liftmark-api/src/db/migrate.ts` | 数据库迁移（member_profiles, pending_training_data, group_invitations） |
| `apps/liftmark-api/src/modules/invitations/invitation.routes.ts` | 邀请码接口 |
| `apps/liftmark-api/src/modules/pending-training/pendingTraining.routes.ts` | 待确认数据接口 |
| `apps/liftmark-api/src/modules/sync/profileSync.routes.ts` | 头像/小组/成员同步接口 |

### 手机端

| 文件 | 功能 |
|------|------|
| `training-partner-app/src/services/invitationService.ts` | 邀请码 API 服务 |
| `training-partner-app/src/services/pendingTrainingService.ts` | 待确认数据 API 服务 |
| `training-partner-app/app/group/invitations.tsx` | 邀请码管理界面 |
| `training-partner-app/app/group/join.tsx` | 输入邀请码加入小组 |
| `training-partner-app/app/pending-training/index.tsx` | 待确认数据通知界面 |
| `training-partner-app/app/workout/upload-members.tsx` | 训练结束选择上传组员 |

---

## 9. API 接口清单

### 邀请码接口

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/api/groups/:id/invitations` | POST | 创建邀请码 | ✅ |
| `/api/groups/:id/invitations` | GET | 获取邀请码列表 | ✅ |
| `/api/groups/:id/invitations/:codeId` | DELETE | 禁用邀请码 | ✅ |
| `/api/invitations/:code/join` | POST | 通过邀请码加入小组 | ✅ |

### 待确认数据接口

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/api/pending-training` | GET | 获取待确认数据 | ✅ |
| `/api/pending-training/upload` | POST | 上传训练数据给他人 | ✅ |
| `/api/pending-training/:id/accept` | POST | 确认接受数据 | ✅ |
| `/api/pending-training/:id` | DELETE | 拒绝数据 | ✅ |
| `/api/pending-training/uploaded` | GET | 查看上传的数据状态 | ✅ |

### 同步接口

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/api/sync/avatar` | POST | 同步用户头像 | ✅ |
| `/api/sync/groups` | POST | 同步小组 | ✅ |
| `/api/sync/members` | POST | 同步成员 | ✅ |
| `/api/sync/groups-pull` | GET | 拉取小组和成员数据 | ✅ |

---

## 7. 注意事项

### 7.1 数据安全

- 训练数据上传需要验证发送者和接收者都是小组成员
- 待确认数据有有效期（建议 30 天）
- 用户可以随时删除已确认的他人数据

### 7.2 并发处理

- 多人同时为同一用户上传数据 → 允许，用户逐条确认
- 同一用户在多设备登录 → 待确认数据对所有设备可见
- 确认操作需要幂等（重复确认不报错）

### 7.3 离线场景

- 无网络时训练数据保存在本地
- 有网络时自动上传自己的数据
- 为他人上传的数据需要手动触发或网络恢复后自动上传
