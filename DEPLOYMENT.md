# StudyBloom 部署说明

## 1. GitHub

确认没有 `.env`、`.env.local` 或其他真实密钥后推送：

```bash
git add .
git commit -m "chore: update StudyBloom"
git push origin main
```

## 2. Supabase

1. 创建 Supabase 项目。
2. 在 SQL Editor 执行 `supabase/schema.sql`。
3. 在 Authentication → Sign In / Providers 中启用 Email。
4. 在 Project Settings → API Keys 获取 Project URL 和 Publishable/anon key。
5. 生产环境不要使用 `service_role` 或 Secret key。

## 3. Vercel

导入 GitHub 仓库 `SuperGh2233/StudyBloom`，配置：

- Framework Preset：Vite
- Root Directory：`./`
- Build Command：`npm run build`
- Output Directory：`dist`

环境变量需要设置在 Production、Preview、Development：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

修改环境变量或 PWA 配置后必须重新部署。

## 4. Supabase 回调地址

部署成功后，在 Authentication → URL Configuration 设置：

- Site URL：Vercel 正式域名
- Redirect URL：`https://你的域名/reset-password`
- 本地开发可保留：`http://localhost:5173/reset-password`

## 5. 验证 PWA

部署必须使用 HTTPS。打开正式域名后检查：

1. 浏览器开发者工具 Application → Manifest 能读取 `StudyBloom`、`standalone` 和三个图标。
2. Application → Service Workers 中出现已注册的 `sw.js`。
3. Network 中没有图标 404。
4. 刷新页面后 Service Worker 仍然存在。
5. 断开网络后重新打开，能看到应用壳和离线状态提示。
6. Supabase Auth、REST 和业务数据请求没有被列入缓存。

## 6. 发布新版本

推送到 `main` 后等待 Vercel 部署完成。用户打开旧版本时会看到“StudyBloom 有新版本可用”，点击“立即更新”才会刷新页面，不会在编辑任务时强制刷新。

如果浏览器一直显示旧版本：

1. 在开发者工具 Application → Service Workers 点击 Unregister。
2. 清理该域名的站点数据和缓存。
3. 重新打开 HTTPS 地址。

不要把用户任务、Access Token 或 Refresh Token 放入 Service Worker 缓存。
