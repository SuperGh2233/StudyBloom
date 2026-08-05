# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
npm run dev        # Vite 开发服务器（localhost:5173）
npm run build      # tsc -b && vite build（类型检查 + 构建）
npm run lint       # eslint .
npm run test       # vitest run（单次）
npx vitest run src/services/backup.test.ts   # 跑单个测试文件
npx vitest run -t "测试名片段"                 # 按名称跑单个用例
npm run test:watch
npm run build && npm run preview             # 生产 PWA 预览（验证 Service Worker 必须用这个，dev 模式不生成 sw.js）
```

本地运行前复制 `.env.example` 为 `.env.local`，填 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。只允许 anon/publishable key，禁止 `service_role` key。

## 架构

StudyBloom：个人学习计划日历 PWA。前端 React 19 + Vite + TypeScript + Tailwind v4（`@tailwindcss/vite`）+ vite-plugin-pwa；后端完全依赖 Supabase（Auth + Postgres + RLS），无自建服务端；部署在 Vercel。

**分层约定**：pages → hooks/features → services → `lib/supabase.ts`。页面不直接调 Supabase，数据操作全部经过 `src/services/`（经 `services/index.ts` 统一导出）。

- **`src/services/`**：Supabase 返回 snake_case 行，在 service 内映射为 camelCase 领域类型（见 `tasks.ts` 的 `mapTask`）。所有异常经 `utils/errorMessage.ts` 的 `toAppError`/`AppError` 包装成中文错误消息。虽然 RLS 已隔离数据，所有查询仍显式 `.eq('user_id', user.id)`（纵深防御，勿删）。
- **`src/lib/supabase.ts`**：客户端**可为 null**（环境变量缺失时应用仍渲染，AuthContext 暴露 `configured` 标志）；需要客户端时用 `getSupabase()`，它抛 `CONFIG_MISSING`。
- **`src/hooks/useMonthPlans.ts`**：日历页的核心状态 hook——按月加载 tasks + plan_days，所有写操作是**乐观更新 + 失败回滚**（`setTasks(previous)` 后 rethrow），保持这个模式。
- **日历页双布局**：`<1024px` 用 `CalendarGrid`（紧凑卡片），`≥1024px` 用 `DesktopCalendar`（星期标题 + 每周"日期行 + 任务行"的海报表格）。两者共享 `useMonthPlans` 数据与 `DayEditor`，改数据流时两个组件都要检查。
- **认证**：`features/auth/AuthContext.tsx` 提供 `useAuth`；`RouteGuards.tsx` 的 `ProtectedRoute`/`PublicOnlyRoute` 守卫路由。`/reset-password` 必须保持公开路由（Supabase 重置邮件的回调目标）。

**数据模型**（`supabase/schema.sql` 是权威脚本，在 Supabase SQL Editor 手工执行；`migrations/` 是镜像）：`plan_days`（每用户每天一行：休息日 + 备注，`unique(user_id, plan_date)`）+ `tasks`（title/completed/sort_order）。RLS 策略逐操作限定 `auth.uid() = user_id`；`anon` 角色无任何表权限。新增表必须补 RLS 策略和 grants。

**日期约定**：一律 `YYYY-MM-DD` 字符串（`DateKey` 类型），经 `utils/date.ts` 的 `assertDateKey`/`monthRange` 校验，格式化用 date-fns。

**PWA 约定**（改 `vite.config.ts` 的 VitePWA 配置前必读）：
- `registerType: 'prompt'`，更新由 `PWAUpdatePrompt` 组件让用户手动确认，不要改成自动刷新。
- Service Worker 只预缓存静态资源；`navigateFallbackDenylist` 排除 `/auth/`、`/rest/`、`/storage/`、`/functions/`——Supabase 请求绝不进缓存，也不要缓存任何用户数据或 token。
- 离线策略是**明示而非伪装**：断网时 `OfflineBanner` 提示，写操作失败就报错重试，不伪造离线保存成功。
- `vercel.json` 全量 rewrite 到 `index.html`（SPA 路由刷新不 404 依赖它）。

**测试**：Vitest + jsdom + Testing Library（setup 在 `src/test/setup.ts`）。现有测试只覆盖 services/utils 的纯逻辑；依赖网络的 Supabase 调用不做单测，RLS 隔离必须按 `supabase/README.md` 的双账号流程在真实项目上验证。

## 文档与规则

- 部署流程（GitHub → Supabase → Vercel → 回调地址 → PWA 验证）见 `DEPLOYMENT.md`；人工测试清单见 `TESTING.md`；Supabase 建库步骤见 `supabase/README.md`。
- UI/视觉改版任务遵循 `.agents/skills/design-taste-frontend/SKILL.md`（anti-slop 前端设计规范）。

## 本机 Git 推送

本机直连 GitHub 会被重置，仓库已固化配置走 Clash 代理：`http.proxy = http://127.0.0.1:7897`、`http.sslbackend = schannel`（local config）。推送失败时先确认 Clash 在运行，不要改回直连。
