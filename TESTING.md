# StudyBloom 测试清单

## 自动化检查

```bash
npm run lint
npm run test
npm run build
```

生产 PWA 预览：

```bash
npm run build
npm run preview
```

## iPhone Safari

使用正式 HTTPS 域名测试：

1. Safari 打开网站。
2. 点击分享 → 添加到主屏幕。
3. 检查桌面图标和名称是否为 StudyBloom。
4. 从主屏幕打开，确认没有 Safari 地址栏和底部工具栏。
5. 检查刘海屏顶部、Home Indicator 底部没有遮挡。
6. 注册或登录 Supabase 账号。
7. 新增任务、完成任务、刷新页面，确认数据同步。
8. 断开网络重新打开，确认基础应用壳和离线提示可以显示。
9. 恢复网络后确认提示自动消失，重新操作任务成功。
10. 发布新版本后确认出现更新提示；选择“稍后”不会立即刷新，选择“立即更新”后加载新版本。

## Android Chrome

检查原生“安装 StudyBloom”提示、主屏幕图标、standalone 窗口和刷新后的数据同步。

## 普通浏览器和内置浏览器

- 桌面 Chrome、Safari、Edge：不应受 PWA 安装提示影响。
- 微信、QQ 内置浏览器：显示使用 Safari 或系统浏览器打开的提示。
- 登录、日历、统计、设置和密码重置路由刷新不应出现 Vercel 404。

## 网络异常

- 断网时显示“当前处于离线状态，云端数据暂时不可用”。
- 在线恢复时显示“网络已恢复，可以继续同步计划”。
- 离线新增、编辑、删除任务不显示虚假的保存成功提示。
