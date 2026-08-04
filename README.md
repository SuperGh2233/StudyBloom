# StudyBloom

StudyBloom 是一个温暖、简洁的个人学习计划日历。它使用 Supabase Auth 登录，并通过 PostgreSQL 与 Row Level Security 在不同设备间安全同步用户自己的计划。

中文副标题：让每一天的努力，慢慢开花

## 功能

- 邮箱注册、登录、退出、会话保持、忘记密码与重置密码
- 未登录路由保护，以及已登录用户自动离开登录页
- 周一到周日的完整月历、跨月补位、返回今天和月份切换
- 每日任务新增、编辑、删除、完成、取消完成和排序
- 每日备注、休息日、复制前一天、复制到指定日期
- 月完成率、任务数量、完成天数、连续打卡与最近七天统计
- 当前用户全部数据的 JSON 导入和导出
- 中文错误、加载、空状态、确认提示和错误边界
- 375px 移动端布局与桌面端响应式抽屉/弹窗

## 技术栈

- React 19、Vite 8、TypeScript 6
- Tailwind CSS 4
- React Router、date-fns、lucide-react
- Supabase Auth、Supabase PostgreSQL
- Vitest、Testing Library、ESLint
- Vercel

## 目录结构

```text
src/
  components/        通用按钮、表单、提示、确认和状态组件
  features/          认证、日历和任务编辑功能
  hooks/             月份计划数据编排
  layouts/           登录后的响应式应用布局
  lib/               Supabase 客户端
  pages/             登录、日历、统计、设置、重置密码和 404
  services/          认证、任务、日期设置、统计、导入导出
  test/              测试环境
  types/             领域类型与数据库类型
  utils/             UTC+8 日期与中文错误处理
supabase/
  migrations/        可追踪的数据库迁移
  schema.sql          可直接在 SQL Editor 执行的完整结构
```

## 本地运行

要求 Node.js 20.19+ 或 22.12+，推荐使用当前 LTS。

```bash
npm install
copy .env.example .env.local
npm run dev
```

访问终端显示的本地地址。未配置 Supabase 时，登录页会显示明确的开发提示。

## 环境变量

`.env.local`：

```env
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_ANON_KEY=你的公开匿名密钥
```

只可使用 anon key 或 publishable key。不要使用 `service_role`，也不要提交 `.env` 或 `.env.local`。

## Supabase 配置

1. 创建 Supabase 项目。
2. 在 SQL Editor 中执行 [supabase/schema.sql](supabase/schema.sql)。
3. 在 Authentication 中启用 Email 登录，并按需要决定是否要求邮箱验证。
4. 将 Project URL 和公开 anon/publishable key 写入 `.env.local`。
5. 将本地和生产地址加入 Authentication 的 Redirect URLs。

完整步骤见 [supabase/README.md](supabase/README.md)。

## 连续打卡规则

- 当天至少存在一条任务，且当天全部任务已完成，记为完成打卡。
- 标记为休息日的日期不增加连续天数，也不会中断连续记录。
- 没有任务且不是休息日的过去日期会中断连续记录。
- 未来日期不参与统计。
- 当前版本统计页展示当前自然月内的当前和最长连续记录。

## 检查与构建

```bash
npm run lint
npm run test
npm run build
npm run preview
```

构建产物位于 `dist/`。

## 部署

Vercel 使用 Vite 预设、`npm run build` 和 `dist` 输出目录。SPA 刷新回退由 `vercel.json` 处理。详细步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 当前限制

- 必须先由项目所有者创建 Supabase 项目并执行 SQL，真实认证和跨设备同步才能工作。
- 数据库迁移尚未在真实 Supabase 项目中执行。
- GitHub 仓库和 Vercel 项目尚未创建，需要项目所有者登录对应平台完成授权。
