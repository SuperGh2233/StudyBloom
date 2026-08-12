# StudyBloom Supabase 配置

## 创建项目

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)。
2. 点击 `New project`，选择组织并填写项目名称、数据库密码和区域。
3. 数据库密码请保存在密码管理器中，不要发送给任何人，也不要写入代码。

## 创建数据表与 RLS

1. 进入项目左侧 `SQL Editor`。
2. 新建查询。
3. 完整复制并执行 [schema.sql](schema.sql)。
4. 在 `Table Editor` 中确认存在 `tasks` 和 `plan_days`。
5. 在 `Database > Policies` 中确认两张表均启用 RLS，且 SELECT、INSERT、UPDATE、DELETE 各有一条策略。

脚本包含：

- `tasks` 与 `plan_days` 表
- 用户删除后的级联清理
- `plan_days(user_id, plan_date)` 唯一约束
- 月份查询索引
- 自动更新 `updated_at` 的触发器
- 使用 `auth.uid() = user_id` 的逐操作 RLS 策略

## 获取公开配置

1. 打开 `Project Settings > API`。
2. 复制 Project URL。
3. 复制 anon key 或 publishable key。
4. 写入项目根目录的 `.env.local`：

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

不要复制或发送 `service_role` key。它拥有绕过 RLS 的权限，不可放在浏览器应用中。

## 配置 Email Auth

1. 打开 `Authentication > Providers > Email`。
2. 保持 Email + Password 启用。
3. 生产环境建议开启邮箱验证。
4. 在 `Authentication > URL Configuration` 设置 Site URL。
5. 在 Redirect URLs 中加入：
   - `http://localhost:5173/reset-password`
   - `https://你的正式域名/reset-password`

## 双账号隔离测试

1. 注册账号 A 和账号 B，并分别完成邮箱验证。
2. 使用账号 A 新建任务和备注，记录页面中能看到的数据。
3. 退出并登录账号 B，确认看不到账号 A 的任何数据。
4. 在浏览器开发工具中获取账号 A 的任务 ID。
5. 登录账号 B 后，尝试读取、修改或删除账号 A 的任务 ID，请求应返回空结果或权限错误。
6. 尝试在 INSERT/UPDATE 请求中把 `user_id` 改成账号 A 的 ID，请求应被 RLS 拒绝。
7. 回到账号 A，确认原数据未被修改。

此测试必须在真实 Supabase 项目执行，本地静态检查不能代替线上 RLS 验证。

## 好友系统迁移

好友功能由 `migrations/20260805100000_add_friend_system.sql` 引入，新增 `profiles`、`friendships`、`calendar_shares` 三张表，并为 `tasks` 和 `plan_days` 追加好友只读 SELECT 策略。它依赖初始 `schema.sql` 中的 `set_updated_at()` 函数，请在执行完 `schema.sql` 之后再执行。

### 执行步骤

1. 打开 SQL Editor，新建查询。
2. 完整复制并按顺序执行：先 `schema.sql`（新项目），再 `migrations/` 下按文件名排序的全部迁移。
3. 确认表存在：`select table_name from information_schema.tables where table_schema = 'public';`
4. 确认 RLS 已启用：`select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace;`（三张新表均应为 `t`）。
5. 用已有账号重新登录或注册新账号，`profiles` 应由触发器自动创建；历史账号由迁移中的回填语句补齐。

### 权限模型

- `profiles`：登录用户可读（仅昵称、StudyBloom ID、头像，不含邮箱），仅本人可改。
- `friendships`：仅申请双方可见；只能以自己身份发起申请（`auth.uid() = requester_id`）；只有被申请方能接受/拒绝；任一方可拉黑或删除已接受关系。
- `calendar_shares`：仅 owner 可增删改，viewer 可读取自己的授权；授权前提是双方已是 `accepted` 好友。
- `tasks` / `plan_days`：好友只读。SELECT 额外允许 `calendar_shares.can_view = true` 的 viewer；INSERT/UPDATE/DELETE 仍限定 `auth.uid() = user_id`，因此好友在服务端层面就无法写入对方数据。
- 删除好友、拉黑或关系失效时，`friendships_cleanup_shares` 触发器（security definer）自动清除双方之间的授权。

### RLS 测试方法

在 SQL Editor 用 `set role authenticated;` 和 `set request.jwt.claim.sub = '<某账号uid>';` 模拟指定用户，再尝试越权读写（参考 TESTING.md 的三账号清单）。也可以在浏览器开发者工具中直接构造 PostgREST 请求，篡改 `user_id` / `requester_id` 验证被拒绝。

### 回滚迁移

如需完全移除好友系统，在 SQL Editor 执行（顺序即删除依赖）：

```sql
drop policy if exists tasks_select_shared on public.tasks;
drop policy if exists plan_days_select_shared on public.plan_days;
drop trigger if exists friendships_cleanup_shares on public.friendships;
drop function if exists public.cleanup_calendar_shares();
drop table if exists public.calendar_shares;
drop table if exists public.friendships;
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.profiles;
drop function if exists public.generate_friend_code();
```

## 学习模块迁移

学习功能由 `migrations/20260811000000_add_attendance_and_study_mode.sql` 引入，新增五张表：

| 表 | 作用 | 关键规则 |
| --- | --- | --- |
| `study_locations` | 学习地点（名称、中心经纬度、签到半径、启用、默认） | 半径 100–1000 米；历史地点停用而不删除 |
| `attendance_records` | 地点签到/签退记录 | 部分唯一索引：每用户最多一条未签退记录；异常结束记 `manual_closed` |
| `study_sessions` | 学习会话（自由计时 / 番茄专注） | 部分唯一索引：每用户最多一个未完成会话；任务删除时 `task_id` 置空，保留任务名称快照 |
| `study_session_segments` | 计时片段（唯一时长事实来源） | 部分唯一索引：每会话最多一个未结束片段；休息不产生片段 |
| `study_preferences` | 番茄偏好、每日目标和倒计时跨设备同步 | 主键即 `user_id` |

另新增 Haversine 距离函数与 11 个 RPC（签到/签退/异常结束、开始/暂停/继续/结束学习、番茄同步与阶段切换），全部只允许 `authenticated` 执行，`anon` 无表权限也无函数执行权限。

### 执行步骤

1. 确认已按顺序执行 `schema.sql` 与好友系统迁移（本迁移依赖 `set_updated_at()` 与 `tasks` 表）。
2. 打开 SQL Editor，完整复制 `migrations/20260811000000_add_attendance_and_study_mode.sql` 并执行。
3. 确认五张新表存在且启用 RLS：
   ```sql
   select relname, relrowsecurity from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('study_locations','attendance_records','study_sessions','study_session_segments','study_preferences');
   ```
4. 确认 `anon` 无残留权限：
   ```sql
   select grantee, table_name from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'
     and table_name like 'study%' or table_name = 'attendance_records';
   ```
   （应返回空。）

### V0.4.1 数据可信性迁移

已有线上项目在完成上面的学习模块迁移后，继续执行 `migrations/20260812000000_harden_study_data_integrity.sql`。新项目直接执行最新 `schema.sql` 即已包含这部分定义。

V0.4.1 会：

- 撤销浏览器对 `attendance_records`、`study_sessions`、`study_session_segments` 的直接写权限，只保留本人读取。
- 将签到与学习状态 RPC 改为经过 `auth.uid()` 限定的 `security definer` 函数。
- 为完整备份提供校验型 `restore_study_records` RPC。
- 按所有计时片段总和判断会话是否达到一分钟。
- 记录番茄轮次和数据库完成时间，跨午夜轮数归入实际完成日期。
- 由数据库根据已完成轮数决定短休息或长休息。
- 限制每个用户最多一个默认学习地点。

执行后用登录账号的 access token 直接向三张核心表发起 INSERT/UPDATE/DELETE，请求应返回权限错误；页面中的正常签到、计时和完整备份恢复应继续成功。

可在 SQL Editor 确认权限：

```sql
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in ('attendance_records','study_sessions','study_session_segments')
order by table_name, privilege_type;
```

三张表对 `authenticated` 应只剩 `SELECT`，状态写入由 RPC 的函数所有者完成。

### V0.5.1 任务学习目标迁移

已有线上项目继续执行 `migrations/20260813000000_add_task_study_goals_and_reflections.sql`。该迁移为任务增加可选的预计学习分钟，为已结束学习会话增加最多 500 字的学习感受，并提供仅限记录所有者调用的保存与备份恢复 RPC。执行后无需迁移已有数据，旧任务默认不设置预计时长，旧学习记录的感受默认为空。

可在 SQL Editor 验证：

```sql
select column_name from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'tasks' and column_name = 'estimated_minutes')
    or (table_name = 'study_sessions' and column_name = 'reflection'));
```

应返回两行。浏览器仍不能直接更新 `study_sessions.reflection`，页面通过 `save_study_session_reflection` 安全保存。

### V0.6.0 每日学习目标迁移

已有线上项目继续执行 `migrations/20260814000000_add_daily_study_goal.sql`。该迁移只为 `study_preferences` 增加每日目标开关和分钟数；默认开启并设为 120 分钟，允许范围为 1–1440 分钟，不修改现有学习会话和签到数据。

可在 SQL Editor 验证：

```sql
select daily_goal_enabled, daily_goal_minutes
from public.study_preferences
limit 5;
```

已有偏好记录会自动得到默认值；设置页保存后，该目标会通过现有的本人 RLS 策略跨设备同步。

### V0.7.0 倒计时与好友备注迁移

已有线上项目继续执行 `migrations/20260815000000_add_countdown_and_friend_notes.sql`。倒计时保存在 `study_preferences`，默认关闭且不预设考试日期；好友备注保存在新的 `friend_notes` 表中。

`friend_notes` 的安全规则：

- 只能为已接受的好友新增或修改备注。
- 最多 30 个字符，提交空内容会删除备注。
- 只有 `owner_id = auth.uid()` 的备注人能读取、修改或删除，对方本人不可见。
- 删除或拉黑好友后，数据库触发器自动删除双方各自的备注。

可在 SQL Editor 验证：

```sql
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relname = 'friend_notes';

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'study_preferences'
  and column_name in ('countdown_enabled', 'countdown_title', 'countdown_date');
```

第一条应返回 `relrowsecurity = true`，第二条应返回三行。

### 权限与验证模型

- 五张新表全部为「仅本人」策略：`auth.uid() = user_id`。V0.4.1 后三张核心记录表额外撤销浏览器直接写权限。**好友（calendar_shares）不获得任何新表的读取权限**——精确经纬度、签到记录、学习时长明细永不对好友开放。
- 由于外键校验会绕过 RLS，写入策略额外用 `exists(...)` 校验所引用的父行（地点/会话/任务/签到记录）同属当前用户，与好友系统迁移的做法一致。
- 签到/签退由 RPC 在服务端用 Haversine 复核距离、校验精度（≤150 米）并写入数据库时间；前端展示的距离只是预检。
- 状态切换（开始/暂停/继续/结束、番茄阶段推进）全部在单个事务内完成并对行加锁（`for update`）；`sync_pomodoro_session` 幂等，页面恢复/多设备场景重复调用安全。
- 浏览器定位可被技术手段伪造：这是个人学习记录工具，**不是**防作弊考勤系统。

### 建议的手工验证

- 双账号隔离：账号 A 创建地点并签到，账号 B 无法读取 A 的 `study_locations`/`attendance_records`/`study_sessions`（参考上方「双账号隔离测试」流程）。
- 部分唯一索引：同一账号开两个浏览器标签同时调用 `check_in_at_location` / `start_study_session`，只应产生一条活动记录。
- 幂等性：重复调用 `sync_pomodoro_session`、对已签退记录再次 `check_out_from_location`，不应报错或产生脏数据。
- 精度与半径：精度 >150 米的请求、超出半径的签到应返回中文错误。

### 回滚迁移

如需完全移除学习模块（会删除全部学习数据）：

```sql
revoke execute on function
  public.haversine_distance_m(double precision, double precision, double precision, double precision),
  public.check_in_at_location(uuid, double precision, double precision, double precision),
  public.check_out_from_location(double precision, double precision, double precision),
  public.force_close_attendance(),
  public.start_study_session(text, uuid, integer, integer, integer, integer),
  public.pause_study_session(uuid),
  public.resume_study_session(uuid),
  public.sync_pomodoro_session(uuid),
  public.start_next_pomodoro_phase(uuid, text),
  public.skip_pomodoro_break(uuid),
  public.finish_study_session(uuid)
from authenticated;

drop function if exists public.finish_study_session(uuid);
drop function if exists public.skip_pomodoro_break(uuid);
drop function if exists public.start_next_pomodoro_phase(uuid, text);
drop function if exists public.sync_pomodoro_session(uuid);
drop function if exists public.resume_study_session(uuid);
drop function if exists public.pause_study_session(uuid);
drop function if exists public.start_study_session(text, uuid, integer, integer, integer, integer);
drop function if exists public.force_close_attendance();
drop function if exists public.check_out_from_location(double precision, double precision, double precision);
drop function if exists public.check_in_at_location(uuid, double precision, double precision, double precision);
drop function if exists public.haversine_distance_m(double precision, double precision, double precision, double precision);

drop table if exists public.study_preferences;
drop table if exists public.study_session_segments;
drop table if exists public.study_sessions;
drop table if exists public.attendance_records;
drop table if exists public.study_locations;
```
