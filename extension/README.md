# Nova 浏览器扩展

本目录提供 Chromium Manifest V3 扩展，可用于 Google Chrome、Microsoft Edge 等兼容浏览器。它把 Nova 起始页替换为新标签页，保留“点击扩展图标，把当前网页带入书签表单”的原有行为；新增主页组件、聚合搜索、壁纸、书签导入和 WebApp 窗口。

## 从项目源码生成扩展包

在仓库根目录运行：

```bash
node scripts/package-extension.mjs
```

此命令会将根目录 `shared/` 模块复制到本目录 `shared/`，输出 `dist/nova-chromium-extension.zip`。也可以直接加载本目录 `extension/`；编辑根目录共享代码后，先重新执行打包脚本以同步副本。

## 安装

1. 解压 ZIP（或使用仓库内 `extension/` 目录）。
2. Chrome 打开 `chrome://extensions`，Edge 打开 `edge://extensions`。
3. 开启开发者模式，点击“加载已解压的扩展程序”，选择解压后的扩展文件夹。
4. 新建标签页即可使用；可将扩展固定在工具栏，以便快速收藏当前网页。

## 权限与数据

扩展保留 `activeTab`：仅在用户主动点击扩展图标时读取当前标签页标题和网址。没有请求读取所有网站的权限。Manifest 额外列出天气、地名查询、Hitokoto、热榜与 Unsplash 图片所需的精确域名。书签、搜索历史、布局、卡片和偏好保存在该浏览器扩展的本地存储；上传的壁纸/视频二进制保存在 IndexedDB。扩展不复用网站版 Supabase 登录会话。

站点 favicon 继续使用原有 Google S2 服务。天气、热榜和一言受互联网、CORS 与第三方服务可用性影响；API 来源和限制请看[项目 API 来源文档](https://github.com/sincalaway/nova/blob/main/docs/API-SOURCES.md)。

## 网页与扩展之间的数据迁移

网页和扩展属于不同的来源，浏览器不会自动共享 localStorage。可在网页原有设置页导出 JSON，再到扩展原有数据设置页导入。跨设备云同步仍是网站版现有 Supabase 功能；扩展本地数据不会自动同步。

## 已知限制

Chrome 扩展不会替换无痕窗口的新标签页。部分网站使用 CSP 或 `X-Frame-Options` 禁止 iframe；遇到空白或错误页时，请从 WebApp 窗口选择“新标签打开”。卸载扩展前，请先用 JSON 导出备份。
