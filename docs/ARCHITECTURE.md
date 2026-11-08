# Nova 架构与数据模型

## 产品方向

Nova 是本地优先、可自部署的个人起始页，提供静态 Web 与 Chromium Manifest V3 新标签页扩展。默认不要求账号或服务器；用户可在需要时启用已有 Supabase 账号同步。项目当前由根目录静态主页和 `extension/` 扩展组成，Cloudflare Pages 从根目录直接发布，因此本轮采用免构建的渐进式模块化，不先迁移 Vue/Vite，也不改变已部署站点的构建入口。

## 现状与兼容边界

- Web 与扩展继续使用 `ziyou.replica.v1` 本地存储键，已有书签、分类、布局和偏好可原地读取。
- Web 保留既有 Supabase Auth 注册、邮箱验证、登录、密码重置，以及 `public.bookmark_sync` 的单行 JSON payload、RLS 策略和按网址合并逻辑。不会新建表，不在客户端加入 `service_role` 密钥。
- 新增字段放在状态对象内并可缺省；旧数据由默认值补齐。现有 `bookmarks`、`categories` 和顶层 `wallpaper` 字段不删除。
- 扩展沿用 Manifest V3、`chrome_url_overrides.newtab` 和扩展自己的本地存储；扩展不继承网站登录会话，也不申请读取全部网站的权限。
- 本地上传的大型壁纸/视频放 IndexedDB；可跨设备访问的公开壁纸 URL、书签与卡片数据可进入现有 JSON payload。账号同步不会上传本地媒体文件。

## 代码分层

```text
/
├── index.html                    # 现有免构建 Web 入口（生产路径保持不变）
├── sync-config.js                # Supabase 公共 URL / anon key 配置，仅保留现有用途
├── supabase-schema.sql           # 现有 bookmark_sync + RLS，不改注册/权限模型
├── shared/
│   ├── model.js                  # 新功能默认值、状态归一化与安全 URL 工具
│   ├── assets.js                 # 本地壁纸 IndexedDB 读写
│   └── dashboard.js              # 搜索、卡片、导入、WebApp 和设置增强层
├── extension/
│   ├── newtab.html               # 新标签页入口
│   ├── app.js / app.css          # 既有扩展体验
│   └── dashboard-enhancements.js # 打包时由 shared/dashboard.js 同步生成
├── scripts/package-extension.mjs # 同步共享模块并输出可加载/分发的扩展包
└── docs/
    ├── ARCHITECTURE.md
    └── data-model.json
```

增强模块通过窄接口读取和保存既有应用状态，不接管账号认证或现有书签同步代码。新模块仅在初始化时补齐 `state.nova`；对书签和分类的扩展遵循向后兼容字段。

## 运行时数据流

1. 页面先读取 `ziyou.replica.v1`，为缺少的新字段补默认值；原有字段仍是书签、搜索和外观的兼容来源。
2. 用户操作即时写回浏览器本地状态。短文本/偏好保存在 localStorage；用户上传的图片或视频 Blob 保存在 IndexedDB，只将 asset ID 存进状态。
3. Web 登录后复用既有 Supabase 用户会话与 `bookmark_sync` 表。新书签元数据、分类、卡片、笔记、搜索偏好及可公开访问的壁纸 URL 作为 JSON 字段沿用原 payload；本地媒体二进制不上传。
4. JSON 备份导出状态对象；导入先校验结构、补齐默认值，再一次性替换/合并。导入的本地媒体若未随 JSON 附带则显示为缺失资源，不执行远程脚本或 HTML。
5. 搜索、天气、热搜和一言由浏览器直接调用公开接口；它们不是产品服务承诺，可能受网络、限流、CORS 或第三方接口变更影响。

## 分阶段实现

### 阶段 1：稳固兼容层与基础体验

保留主页和扩展入口、local-first 状态、现有书签管理；补充版本化数据模型、拖拽排序、多分类、HTML 书签导入、聚合搜索快捷切换和本地搜索历史；壁纸库、图片/视频 URL 与本地媒体使用同一设置入口；提供极简模式与亮/暗主题。

### 阶段 2：组件和 WebApp

组件以 `widgets[]` 配置驱动，首批包含记事本、天气、热搜、日历和每日一言。卡片支持显示/隐藏、拖拽顺序与各自设置。WebApp 使用 iframe 内嵌并提供 Dock、最小化和全屏；由于站点的 `X-Frame-Options` / CSP，部分网址只能改为新标签打开。

### 阶段 3：同步、备份和交付

扩展已有 JSON 导入导出覆盖新增状态；Web 继续沿用已有 `bookmark_sync` payload，不变更注册流程、表名或 RLS。完善自部署、扩展打包、公开 API 和功能状态文档。对 Supabase 变更保持可选，纯本地用户无需配置。

## 关键设计取舍

- 不在本轮把整站改成 Vue/Vite：那会要求改变 Cloudflare Pages 输出目录及部署设置，并增加静态注册/同步流程的回归风险；组件化由共享 JS 模块和数据驱动卡片先提供。
- 浏览器扩展仅允许打包目录内资源。共享模块由脚本复制到 `extension/` 后再打包，确保加载未打包扩展时也不引用目录外文件。
- 书签类别先保留旧 `category` 主分类，同时增加可选 `categories[]`；老版本仍可读主分类，新版支持多个分类。
- 本地优先不等于隐私数据绝不上云：仅用户主动登录后，原有同步协议按当前行为同步 JSON payload。天气定位只在用户主动授权/输入城市后使用，不静默读取精确位置。
