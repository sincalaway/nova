# Nova — 个人起始页与书签工作台

Nova 是本地优先、可自部署的个人主页与 Chromium 新标签页扩展。项目保留原静态主页、Supabase 注册/登录和云同步书签实现，并在其上增加多分类、搜索、壁纸、组件卡片与 WebApp 窗口。

## 功能一览

| 模块 | 已实现功能 |
| --- | --- |
| 起始页 | Web 首页与 Chrome/Edge 新标签页、时间和日期格式选项、原有 12/24 小时与秒数设置、亮/暗主题、极简模式、桌面与手机适配。 |
| 书签 | 添加/编辑/删除、常用站点目录、自定义图标 URL、主分类与多分类、浏览器书签 HTML 导入、拖拽排序；原有图标大小和卡片布局选项继续可用。 |
| 搜索 | Bing、Google、百度、搜狗、DuckDuckGo、自定义搜索模板、Tab / Shift+Tab 切换、快捷翻译、本地建议和搜索历史（均可开关）。 |
| 壁纸 | 内置分类壁纸库、随机切换、自定义图片/视频 URL、本地图片/视频上传、模糊和遮罩调整。大文件存在 IndexedDB，不放入 localStorage。 |
| 组件 | 可添加/移除并拖拽排序：记事本（纯文本/简易 Markdown）、天气、热搜、月历、每日一言。 |
| WebApp | 书签可选内嵌窗口打开；Dock、最小化、全屏、新标签页打开。目标网站禁止 iframe 时改用新标签页。 |
| 数据 | 原有 JSON 导入/导出、Supabase 账号注册和书签云同步行为。 |

## 本地运行 Web

网页使用 Vue 3 单文件组件和 Vite 构建；原书签、账号和云同步控制器暂由兼容模块加载，以保持现有行为。在项目根目录执行：

```bash
npm ci
npm run dev
```

然后访问 Vite 显示的本地地址（默认 <http://localhost:5173>）。生产构建使用 `npm run build`，静态产物写入 `build/`；可用 `npm run preview` 本地预览。建议通过 `http://localhost` 或 HTTPS 使用；浏览器定位等能力要求安全上下文。

当前 Cloudflare Pages 生产站点为 <https://nova-6sm.pages.dev/>。现有 Pages 项目需将构建命令设为 `npm run build`、输出目录设为 `build` 后再发布 Vue/Vite 版本。

## 构建并安装 Chrome / Edge 扩展

在项目根目录运行：

```bash
node scripts/package-extension.mjs
```

脚本把 `shared/` 共享模块复制到扩展包内部，并生成 `dist/nova-chromium-extension.zip`。若直接调试源码，也可先运行此命令，再加载 `extension/` 目录。Chrome 打开 `chrome://extensions`，Edge 打开 `edge://extensions`，开启“开发者模式”，选择“加载已解压的扩展程序”并选中 `extension/`。修改 `shared/` 后重新运行打包脚本以同步扩展副本。

扩展保留原有 `activeTab` 权限，并仅为天气、热榜、一言和壁纸声明所需的服务域名；没有申请读取所有网站的权限。扩展书签和偏好保存在扩展自己的本机存储中，不会自动登录网站账号。

## 注册与云同步（重要：沿用原实现）

网站继续使用现有 Supabase Auth 与 `public.bookmark_sync` JSON payload。本次没有更改注册、邮箱验证、登录、密码重置、RLS、表结构或按网址合并书签的逻辑，也不新增数据库表。已登录的 Web 用户会通过原有同步机制保存新增状态字段；无需执行新的 SQL migration。扩展版仍使用自身本地数据。

继续按本项目现有方式配置 Supabase：在 Supabase 启用 Email 登录，在 Authentication 的 URL Configuration 中添加实际部署网址，执行仓库中的 `supabase-schema.sql`，并按原有 `sync-config.js` 流程注入项目公开 URL 和 anon/publishable key。绝不要把 `service_role` key 放入前端或提交到 Git。配置有效且同步表已存在后，用户从侧栏“云同步”注册/登录；首次同步仍按网址合并书签。忘记密码需要用户主动点击“忘记密码”并在邮件返回页面设置新密码，邮件投递受 Supabase 邮件服务与速率限制影响。

原有 JSON 导入/导出入口保留。新增字段位于 `schemaVersion: 2` 与 `nova` 命名空间；缺少新增字段的旧数据会自动补默认值。外部壁纸 URL 可以随 JSON 状态同步；本地上传媒体文件本身只保存在当前浏览器 IndexedDB，不会上传到云端。启用云同步前，建议先导出一份 JSON 备份。

## Cloudflare Pages 自部署

Cloudflare Pages 使用 Vue/Vite 静态构建产物。Cloudflare 官方说明：[Git 集成](https://developers.cloudflare.com/pages/configuration/git-integration/)。

在 Cloudflare Dashboard 选择 **Workers & Pages → Create application → Pages → Import an existing Git repository**，连接 `sincalaway/nova`。构建配置使用：

| 设置 | 值 |
| --- | --- |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `build` |

先在现有 Pages 项目更新构建命令和输出目录，再通过 Git 集成部署。修改 `main` 后 Git 集成会自动部署；Git 集成和 Direct Upload 是不同项目创建方式，本仓库应沿用现有 Git 集成设置。

## 第三方 API、许可与注意事项

天气使用 [Open-Meteo 天气接口](https://open-meteo.com/en/docs) 和[地名查询接口](https://open-meteo.com/en/docs/geocoding-api)。通常无需 API key；官方免费服务面向非商业用途、有请求限制且不保证 uptime。商业部署应先查看[价格和条款](https://open-meteo.com/en/pricing)，或更换为自建/授权服务。天气只使用用户输入的城市，或用户主动点击并授权后的浏览器定位。

热搜使用 [VVhan 开源热榜聚合接口](https://www.vvhan.com/article/zhihu-baidu-weibo-api-kaiyuan)，并非百度、微博或知乎官方稳定 API；源站改版、限流、CORS 或服务策略变化可能导致暂时不可用。一言使用 [Hitokoto 官方接口](https://hitokoto.cn/usage)，按本地日期缓存；高流量站点应遵循其调用建议。服务地址、字段与说明见 [`docs/API-SOURCES.md`](docs/API-SOURCES.md)。

壁纸列表的外部图片从 Unsplash 链接加载；可自行替换配置或只使用仓库内的 `galaxy.jpg`。使用外部图片时请遵循来源站的许可与流量条款。嵌入窗口能否打开由目标站点 CSP / `X-Frame-Options` 决定；失败时使用“新标签打开”。天气、热榜和一言依赖互联网；书签、笔记、月历、主题和 JSON 本地备份可离线使用。

## 项目结构与架构

```text
index.html                    # Vite HTML 入口
src/App.vue                   # Vue 主页模板与挂载生命周期
src/styles.css                # 原站点全局样式
src/legacy/site-app.js        # 既有书签、Supabase 认证与同步控制器
public/                       # 指向现有根目录图片和同步配置的静态资源链接
shared/                       # Web/扩展共用的数据、媒体与增强模块
extension/                    # 独立的 Manifest V3 新标签页扩展
build/                        # Vite 生产产物（本地构建生成）
scripts/package-extension.mjs # 复制共享模块并打包扩展
docs/                         # 架构、数据模型及 API 来源说明
```

完整设计见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)，结构化字段约定见 [`docs/data-model.json`](docs/data-model.json)。
