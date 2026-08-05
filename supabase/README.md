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
