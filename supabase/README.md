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
