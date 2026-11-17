# Nova 浏览器扩展

本目录提供 Chromium Manifest V3 扩展，可用于 Google Chrome、Microsoft Edge 等兼容浏览器。它把岁瞬起始页设为新标签页，保留“点击扩展图标，把当前网页带入书签表单”的原有行为；主页组件包括倒计时、纪念日和待办，并提供在线白板、实时字数统计、代码高亮、本机去背、IP 查询与 LaTeX 工具箱。

## 从项目源码生成扩展包

在仓库根目录运行：

```bash
npm ci
npm run build:extension
```

此命令会将根目录共享模块复制到本目录，按需编译工具箱和 ONNX 引擎、附带 WebAssembly 运行时及第三方许可，并输出 `dist/nova-chromium-extension.zip`。也可以加载本目录 `extension/`；编辑根目录共享代码后，先重新执行打包脚本以同步副本。

## 安装

1. 解压 ZIP（或使用仓库内 `extension/` 目录）。
2. Chrome 打开 `chrome://extensions`，Edge 打开 `edge://extensions`。
3. 开启开发者模式，点击“加载已解压的扩展程序”，选择解压后的扩展文件夹。
4. 新建标签页即可使用；可将扩展固定在工具栏，以便快速收藏当前网页。

## 权限与数据

扩展保留 `activeTab`：仅在用户主动点击扩展图标时读取当前标签页标题和网址，没有读取所有网站的权限。Manifest 仅额外声明天气、热榜、一言、IP 查询、Supabase 同步、LaTeX iframe、壁纸和模型下载所需域名。默认数据仍在当前扩展本地；可从侧栏“云同步”直接登录，与岁瞬网页端使用同一 Supabase 账号（两端登录会话彼此独立），无需上传 `service_role` 密钥。待办、白板笔迹和偏好会随登录账户同步；壁纸文件不上传。

站点 favicon 继续使用原有 Google S2 服务。天气、热榜、一言、IP 查询和 LaTeX 受网络与第三方服务影响；点击 IP 查询会把当前或输入的 IP 发给 IPWhois.io，位置只作近似估算。智能去背需首用下载约 94 MiB 模型，图片留在本机；不支持 WebGPU 时仍可用纯色抠除。API、模型和许可来源见[项目 API 来源文档](https://github.com/sincalaway/nova/blob/main/docs/API-SOURCES.md)及 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 网页与扩展之间的数据迁移

网页和扩展属于不同来源，浏览器不会自动共享 localStorage。可在任一端导出 JSON 到另一端导入；也可分别在网页和扩展登录同一 Supabase 账号。扩展首次看到云端数据时会明确询问合并、云端覆盖或本机覆盖；后续自动检查更新。卸载扩展前仍建议导出 JSON 备份。

## 已知限制

Chrome 扩展不会替换无痕窗口的新标签页。部分网站使用 CSP 或 `X-Frame-Options` 禁止 iframe；遇到空白或错误页时，请从 WebApp 窗口选择“新标签打开”。卸载扩展前，请先用 JSON 导出备份。
