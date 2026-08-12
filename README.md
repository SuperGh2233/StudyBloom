# StudyBloom

StudyBloom 是一个温暖、简洁的个人学习计划日历，让每天的努力慢慢开花。用户可以记录每日任务、完成任务、查看月度统计、设置学习地点签到，并用自由计时和番茄专注记录真实的学习时长——所有数据在不同设备间通过 Supabase 同步。

## 功能

- 邮箱注册、登录、退出、忘记密码和重置密码
- 周一到周日的完整月历、月份切换和返回今天
- 每日任务新增、编辑、删除、完成状态和排序
- 任务预计学习时长、实际累计时长、目标进度和任务学习明细
- 休息日、每日备注、复制前一天计划和复制到指定日期
- 月度完成率、连续完成和近七天统计
- 数据 JSON 导入导出（备份版本 2，兼容版本 1 导入）
- 好友系统：StudyBloom ID 精确添加、申请接受/拒绝/取消、删除与拉黑
- 好友日历：所有者逐个授权后，好友可只读查看对方月历和完成情况
- 学习模块：学习地点设置、地点签到/签退、自由计时、番茄专注、学习记录与统计
- Supabase Auth、PostgreSQL 和 RLS 数据隔离
- iPhone 添加到主屏幕的 PWA 支持
- 静态资源预缓存、离线状态提示和版本更新提示

## 学习模块

- **学习地点**：在「设置 → 学习地点」中添加地点（名称 + 签到半径 100–1000 米），到达后点「使用当前位置」确定中心坐标。第一版不接入地图 SDK；历史地点停用而不删除。
- **地点签到/签退**：只在主动点击签到/签退时获取一次浏览器定位（`navigator.geolocation`，精度需 ≤150 米）；距离由数据库用 Haversine 复核，超出半径会给出中文提示。忘记签退时可用「异常结束本次记录」（二次确认，不计有效在场时长）。
- **学习模式**：自由计时（开始/暂停/继续/结束）与番茄专注（可配置专注 15–90 分钟、短休息 3–30、长休息 10–60、长休息间隔 2–8 轮，偏好跨设备同步）。默认关联今日第一项未完成任务，也可选择自由学习；最近选择的模式会跨设备保留。学习时长以数据库计时片段为准，刷新、锁屏、切后台都能恢复。V0.4.1 起核心记录只允许通过数据库 RPC 修改，番茄休息类型也由数据库决定。
- **V0.5.1 学习闭环**：任务可设置 30/45/60/90/120 分钟快捷目标或自定义分钟数，并显示累计实际时长与进度。结束学习后展示本次时长、番茄轮数和今日累计，可选同步完成任务并写 500 字以内的学习感受；任务详情展示累计时长、次数、最近学习时间和近期记录。
- **隐私**：精确位置仅本人可见，不对好友开放、不进好友日历、不持续采集、不发送给 Supabase 以外的第三方。浏览器定位可被伪造，本功能不是防作弊考勤系统。
- **统计**：统计页新增今天/本周/本月学习时长、日均、次数、最长单次、自由/番茄时长、完成番茄轮数、近七天柱形图和按任务统计。

## 技术栈

React、Vite、TypeScript、Tailwind CSS、date-fns、lucide-react、Supabase JS、vite-plugin-pwa、Vitest。

## 本地运行

```bash
npm install
npm run dev
```

复制 `.env.example` 为 `.env.local`，填写：

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`.env.local` 已被 Git 忽略。只能使用 Supabase 的 Publishable/anon key，不能使用 `service_role` key。

> 学习模块需要在 Supabase 按文件名顺序执行 `20260811000000_add_attendance_and_study_mode.sql`、`20260812000000_harden_study_data_integrity.sql` 和 `20260813000000_add_task_study_goals_and_reflections.sql`（步骤见 [supabase/README.md](supabase/README.md)），否则学习页、统计和完整备份恢复会提示错误。

常用检查命令：

```bash
npm run lint
npm run test
npm run build
npm run preview
```

## 目录结构

```text
src/
  components/       通用组件、PWA 提示和离线状态
  features/
    auth/           登录注册与路由守卫
    calendar/       移动端与桌面端日历布局
    tasks/          每日任务编辑、学习目标进度与任务学习详情
    study/          学习页组件（计时、签到、任务选择、学习记录）
  hooks/            月度计划、好友、学习会话与签到 Hooks
  layouts/          登录后应用壳层（五列导航 + ActiveStudyBar）
  pages/            登录、日历、好友、学习、统计、设置和重置密码页面
  services/         Supabase 数据服务、备份和统计（含学习/签到服务）
  types/            TypeScript 领域类型与 Database 类型
  utils/            日期、错误处理、定位与学习时长工具
  lib/              Supabase 客户端
public/
  pwa-icon.svg      可替换的品牌图标源文件
  pwa-*.png         PWA 图标
supabase/
  migrations/       按文件名顺序执行的迁移（含学习模块迁移）
```

## PWA 使用方式

### iPhone Safari

1. 使用 Safari 打开正式 HTTPS 域名。
2. 点击底部分享按钮。
3. 选择“添加到主屏幕”。
4. 点击右上角“添加”。
5. 从主屏幕打开 StudyBloom，即可使用 standalone 独立窗口。

微信、QQ 等内置浏览器不能直接完成 iPhone 安装，请选择“在 Safari 中打开”。安装提示会在关闭后保留七天，不会每次打扰。

### Android Chrome

浏览器支持原生安装提示时，页面会显示“立即安装”；也可以通过浏览器菜单选择“添加到主屏幕”。

### 更新和离线

- VitePWA 使用 `registerType: "prompt"`，检测到新版本后由用户选择“立即更新”或“稍后”。
- Service Worker 只预缓存 HTML、JavaScript、CSS、图标等静态资源。
- Supabase Auth、REST、Storage、Functions 和业务数据请求不会被缓存，也不会写入 Service Worker。
- 断网时显示中文状态条；应用壳仍可从缓存打开。新增、编辑、删除任务及学习计时、签到、签退均需恢复网络后操作，不伪造离线保存成功。

## Supabase 数据库

数据库脚本位于 `supabase/schema.sql`，迁移位于 `supabase/migrations/`。核心表为 `plan_days` 和 `tasks`，所有策略只允许用户访问自己的数据。

学习模块由 `20260811000000_add_attendance_and_study_mode.sql` 引入，`20260812000000_harden_study_data_integrity.sql` 完成 V0.4.1 权限加固，`20260813000000_add_task_study_goals_and_reflections.sql` 增加 V0.5.1 任务目标与学习感受：

| 表 | 作用 | 关键规则 |
| --- | --- | --- |
| `study_locations` | 学习地点（名称/中心坐标/半径/启用/默认） | 半径 100–1000 米；停用不删除 |
| `attendance_records` | 地点签到/签退 | 每用户最多一条未签退记录；异常结束 `manual_closed` |
| `study_sessions` | 学习会话（自由/番茄） | 每用户最多一个未完成会话；任务删除后保留名称快照 |
| `study_session_segments` | 计时片段（时长唯一事实来源） | 休息不产生片段；记录番茄轮次和实际完成时间 |
| `study_preferences` | 番茄偏好跨设备同步 | 主键为 `user_id` |

所有状态切换通过数据库 RPC 原子完成（签到/签退、开始/暂停/继续/结束、番茄同步与阶段切换）。浏览器对签到、会话和计时片段只有本人只读权限，不能直接伪造写入；`anon` 无表权限也无函数执行权限。执行步骤与验证方法见 [supabase/README.md](supabase/README.md)。

好友系统由迁移 `20260805100000_add_friend_system.sql` 引入，新增三张表：

| 表 | 作用 | 关键规则 |
| --- | --- | --- |
| `profiles` | 昵称、StudyBloom ID（`friend_code`）、是否接收申请 | 注册时触发器自动建档；`BLOOM-XXXXXX` 随机生成 |
| `friendships` | 好友申请与关系（pending/accepted/rejected/blocked） | 只有双方可见；同一对用户同时只存在一条有效关系 |
| `calendar_shares` | 日历查看授权（owner → viewer） | 只有 owner 可管理；只能授权给已接受的好友 |

权限模型（全部由 RLS 保证，前端隐藏只是体验）：

- 好友对 `tasks` / `plan_days` **只有 SELECT**：当且仅当 `calendar_shares.can_view = true` 时可见；写入策略仍然限定 `auth.uid() = user_id`，好友无法新增、修改、删除或勾选对方任务。
- 默认不共享：成为好友后不会自动开放日历，必须由所有者在“设置 → 好友与隐私”中逐个开启。
- 删除好友、拉黑或关闭开关都会立即让对方失去访问（删除/拉黑时由数据库触发器清理授权）。

执行迁移与测试方法见 [supabase/README.md](supabase/README.md)，三账号安全测试清单见 [TESTING.md](TESTING.md)。

## 部署

项目适合部署到 Vercel。完整配置和 PWA 验证步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)，人工测试清单见 [TESTING.md](TESTING.md)。
