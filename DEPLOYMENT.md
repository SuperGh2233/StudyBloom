# StudyBloom 部署说明

## 推送到 GitHub

1. 登录 [GitHub](https://github.com/)，创建名为 `study-bloom` 的空仓库。
2. 不要勾选自动创建 README，当前项目已经包含文档。
3. 在项目目录执行：

```bash
git init
git add .
git commit -m "feat: initialize StudyBloom"
git branch -M main
git remote add origin https://github.com/你的用户名/study-bloom.git
git push -u origin main
```

推送前确认 `.env` 和 `.env.local` 没有进入 `git status`。

## 导入 Vercel

1. 登录 [Vercel](https://vercel.com/)。
2. 点击 `Add New > Project`，授权 GitHub 后选择 `study-bloom`。
3. Framework Preset 选择 `Vite`。
4. Build Command 填写 `npm run build`。
5. Output Directory 填写 `dist`。
6. 在 Environment Variables 中配置：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. 点击 Deploy。

公开环境变量只能使用 anon key 或 publishable key，不能使用 `service_role`。

## 配置 Supabase 正式地址

1. 部署成功后复制 Vercel 正式域名。
2. 打开 Supabase `Authentication > URL Configuration`。
3. 将 Site URL 设置为正式域名。
4. Redirect URLs 增加 `https://你的域名/reset-password`。
5. 保留本地开发重置地址。

## 路由刷新 404

项目根目录的 `vercel.json` 已将全部路由回退到 `index.html`。如果刷新子页面仍出现 404，确认该文件已提交且最新部署包含它。

## 构建日志与回滚

- 在 Vercel 项目 `Deployments` 中打开部署记录可查看 Build Logs。
- 部署失败时先检查 Node 版本、环境变量名和 `npm run build` 输出。
- 需要回滚时，在之前的成功部署右侧菜单选择 `Promote to Production`。

GitHub 登录、仓库创建、Vercel 授权、环境变量和正式域名配置必须由项目所有者手动完成。
