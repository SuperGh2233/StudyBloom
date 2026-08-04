# StudyBloom

StudyBloom 是一个温暖、简洁的个人学习计划日历，让每天的努力慢慢开花。用户可以记录每日任务、完成任务、查看月度统计，并在不同设备间通过 Supabase 同步。

## 功能

- 邮箱注册、登录、退出、忘记密码和重置密码
- 周一到周日的完整月历、月份切换和返回今天
- 每日任务新增、编辑、删除、完成状态和排序
- 休息日、每日备注、复制前一天计划和复制到指定日期
- 月度完成率、连续打卡和近七天统计
- 数据 JSON 导入导出
- Supabase Auth、PostgreSQL 和 RLS 数据隔离
- iPhone 添加到主屏幕的 PWA 支持
- 静态资源预缓存、离线状态提示和版本更新提示

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
  features/         认证、日历和每日任务功能
  hooks/            月度计划和 PWA Hooks
  layouts/          登录后应用壳层
  pages/            登录、日历、统计、设置和重置密码页面
  services/         Supabase 数据服务、备份和统计
  types/            TypeScript 类型
  utils/            日期和错误处理工具
  lib/              Supabase 客户端
public/
  pwa-icon.svg      可替换的品牌图标源文件
  pwa-*.png         PWA 图标
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
- 断网时显示中文状态条；应用壳仍可从缓存打开。新增、编辑、删除任务需要恢复网络后重试，不伪造离线保存成功。

## Supabase 数据库

数据库脚本位于 `supabase/schema.sql`，迁移位于 `supabase/migrations/`。表为 `plan_days` 和 `tasks`，所有策略只允许用户访问自己的数据。

## 部署

项目适合部署到 Vercel。完整配置和 PWA 验证步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)，人工测试清单见 [TESTING.md](TESTING.md)。
