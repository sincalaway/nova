# Nova 架构与数据模型

## 产品方向

Nova 是本地优先、可自部署的个人起始页，Web 使用 Vue 3 与 Vite 构建，另提供 Chromium Manifest V3 新标签页扩展。默认不要求账号或服务器；用户可在需要时启用已有 Supabase 账号同步。网页模板已迁入 Vue 单文件组件，现有本地状态、书签、认证和云同步控制器保留为兼容模块；扩展维持独立、免 Vue 的入口。

## 现状与兼容边界

- Web 与扩展继续使用 `ziyou.replica.v1` 本地存储键，已有书签、分类、布局和偏好可原地读取。
- Web 保留既有 Supabase Auth 注册、邮箱验证、登录、密码重置，以及 `public.bookmark_sync` 的单行 JSON payload、RLS 策略和按网址合并逻辑。不会新建表，不在客户端加入 `service_role` 密钥。
- 新增字段放在状态对象内并可缺省；旧数据由默认值补齐。现有 `bookmarks`、`categories` 和顶层 `wallpaper` 字段不删除。
- 扩展沿用 Manifest V3、`chrome_url_overrides.newtab` 和自己的本地存储；要跨设备使用时在扩展内单独登录 Supabase，不共享网页会话，也不申请读取全部网站的权限。
- 倒计时、纪念日、待办和白板笔迹都保存在 `state.nova`，并通过现有 JSON payload 同步。大型壁纸/视频 Blob 仍放 IndexedDB；账号同步不会上传本地媒体文件。
- 背景移除通过 WebGPU/ONNX Runtime Web 在设备本地推理。模型按需从 Hugging Face 下载；网页运行时通过 Vite 生成按需 WASM 资源，扩展打包时将其附带。

## 代码分层

```text
/
├── index.html                    # Vite HTML 入口
├── package.json / vite.config.js # Vue/Vite 依赖与生产构建配置
├── sync-config.js                # Supabase 公共 URL / anon key 配置，仅保留现有用途
├── supabase-schema.sql           # 现有 bookmark_sync + RLS，不改注册/权限模型
├── src/
│   ├── App.vue                   # Vue 主页模板与启动生命周期
│   ├── styles.css                # 主页全局样式
│   └── legacy/site-app.js        # 原书签、认证与同步控制器兼容层
├── public/                       # 根目录图片和 sync-config.js 的静态资源链接
├── shared/
│   ├── model.js                  # 新功能默认值、状态归一化与安全 URL 工具
│   ├── assets.js                 # 本地壁纸 IndexedDB 读写
│   ├── dashboard.js              # 搜索、卡片、导入、WebApp 和设置增强层
│   ├── feature-suite.js          # Web/扩展共享工具箱
│   └── background-removal.js     # 按需加载的 ONNX 本地去背引擎
├── extension/
│   ├── newtab.html               # 新标签页入口
│   ├── app.js / app.css          # 既有扩展体验
│   ├── sync.js / sync-config.js  # 扩展独立认证与同一云同步表
│   └── shared/                   # 打包时由 shared/ 同步生成
├── scripts/package-extension.mjs # 同步共享模块并输出扩展包
├── build/                         # Vite 生产输出，Cloudflare Pages 发布此目录
└── docs/
    ├── ARCHITECTURE.md
    └── data-model.json
```

网页增强模块通过窄接口读取和保存既有应用状态，不接管网页账号认证或现有书签同步代码。模型迁移按卡片类型合并默认定义：旧卡片的用户 ID、顺序、开关和配置保留，新倒计时、纪念日、待办卡片以关闭状态加入组件库。扩展的独立同步器使用同一 Supabase Auth 与 `bookmark_sync` 表，不读取网页会话。

## 运行时数据流

1. 页面先读取 `ziyou.replica.v1`，为缺少的新字段补默认值；原有字段仍是书签、搜索和外观的兼容来源。
2. 用户操作即时写回浏览器本地状态。短文本/偏好保存在 localStorage；用户上传的图片或视频 Blob 保存在 IndexedDB，只将 asset ID 存进状态。
3. Web 登录后复用既有 Supabase 用户会话与 `bookmark_sync` 表；扩展以自己的 Supabase 会话访问相同用户行。书签、分类、组件设置、待办、白板笔迹及搜索偏好保存在 JSON payload；壁纸二进制不上传。
4. JSON 备份导出状态对象；导入先校验结构、补齐默认值，再一次性替换/合并。导入的本地媒体若未随 JSON 附带则显示为缺失资源，不执行远程脚本或 HTML。
5. 搜索、天气、热搜、一言和 IP 查询由浏览器直接调用公开接口；文本处理和代码高亮本地运行。智能去背仅在用户主动点按后按需下载模型并在 WebGPU 上执行；IP 查询只在用户点按后向第三方发送被查询的 IP。

## 分阶段实现

### 阶段 1：稳固兼容层与基础体验

保留主页和扩展入口、local-first 状态、现有书签管理；补充版本化数据模型、拖拽排序、多分类、HTML 书签导入、聚合搜索快捷切换和本地搜索历史；壁纸库、图片/视频 URL 与本地媒体使用同一设置入口；提供极简模式与亮/暗主题。

### 阶段 2：组件和 WebApp

组件以 `widgets[]` 配置驱动，包含记事本、天气、热搜、日历、每日一言、倒计时、纪念日和待办。卡片支持显示/隐藏、拖拽顺序与各自设置；事件卡片支持本地日期、重复规则、颜色、背景图和遮罩。WebApp 使用 iframe 内嵌并提供 Dock、最小化和全屏；由于站点的 `X-Frame-Options` / CSP，部分网址只能改为新标签打开。

### 阶段 3：同步、备份和交付

扩展 JSON 备份可导入/导出；Web 与扩展分别登录后复用 `bookmark_sync` payload，不变更注册表或 RLS。首次扩展同步提供双端合并、云端覆盖、本机覆盖；已连接时自动备份本机变更并轮询远端更新。自部署时保持 Supabase 可选，纯本地用户无需配置。

### 阶段 4：效率工具与跨设备补齐

工具箱包含在线白板（本地矢量笔迹）、实时字数统计与文本清理、安全代码高亮、本机智能/纯色去背、IP 地理查询和 LaTeXLive。白板、待办和事件字段通过同一状态模型同步；图片文件、模型输入图像和字数统计内容不上传。

## 关键设计取舍

- Vue/Vite 负责网页模板、样式与构建；网页继续使用原认证/同步控制器，扩展通过独立小型 REST 客户端共享同一 Supabase 用户行，避免更换既有 RLS 和存储表。
- 浏览器扩展仅允许打包目录内资源。共享模块由脚本复制到 `extension/` 后再打包，确保加载未打包扩展时也不引用目录外文件。
- 书签类别先保留旧 `category` 主分类，同时增加可选 `categories[]`；老版本仍可读主分类，新版支持多个分类。
- 本地优先不等于隐私数据绝不上云：仅用户主动登录后才同步 JSON payload。天气定位和 IP 查询均需用户主动操作；IP 服务会看到所查询的 IP。图片去背原图始终留在本机，文字统计输入不保存。
