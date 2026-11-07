# 岁瞬网页书签 · 星云主页

一个无需构建步骤的静态个人书签主页。页面打开后即可搜索、整理常用网站，并可自定义背景和时钟显示。

## 使用方法

### 打开主页

部署后访问 Cloudflare Pages 提供的 `*.pages.dev` 地址，也可以绑定自己的域名。若暂时不部署，可在项目目录启动本地预览：

```bash
python3 -m http.server 8000
```

然后访问 <http://localhost:8000>。也可以直接打开 `index.html`；本地 HTTP 预览通常更稳定。

这是一个网页，不是浏览器扩展。可以把主页地址加入浏览器书签，或在浏览器设置中设为启动页；是否能替换新标签页取决于浏览器自身支持。

### 添加和整理书签

- 点击侧栏「系统设置」，右侧页面会显示「添加标签、批量编辑、背景设置、书签管理」四项功能；进入「书签管理」后可添加书签并直接编辑卡片。侧栏「＋ / 添加」仍用于直接新建文件夹。
- 左侧分类栏用于切换文件夹。「系统设置」是独立导航页，点击后四项功能会显示在右侧主内容区；「添加标签」和侧栏「＋ / 添加」都可以新建分类。右键点击已有分类可编辑名称/图标或删除。
- 在「系统设置 → 书签管理」中，直接在书签卡片上编辑、改分类、切换首页显示或删除；右键书签/分类可直接打开编辑，不再弹出滑出式菜单。
- 使用搜索框搜索网页或输入网址；默认搜索服务可在「偏好 → 常规设置」中选择 Bing、Google、百度或 DuckDuckGo。

### 背景、设置与数据备份

「系统设置」页的「背景设置」可以更换壁纸并调整模糊和遮罩。「偏好 → 常规设置」可调节书签图标尺寸；「偏好 → 时间日期」可设置 12/24 小时制和是否显示秒数。点击主页日期可打开日历。设置中的数据页提供 JSON 导出和导入，可用于备份或迁移书签及偏好。

**未配置云服务时，数据保存在当前浏览器本地。** 配置 Supabase 后，可从侧栏「云同步」注册/登录，同一账号会自动保存书签和偏好，并可在其他设备恢复；自定义壁纸仍只保存在当前浏览器。网页链接本身不会包含个人书签数据；使用同一公开网址的其他人会在自己的浏览器中拥有各自独立的数据。


## 登录与跨设备同步（需配置 Supabase）

静态网页本身没有账号数据库；项目已接入 Supabase Auth 与每账号独立的书签 JSON 同步。部署者需要先创建一个 Supabase 项目：

1. 在 Supabase 项目设置中启用 Email 登录，并按需要配置邮箱验证。
2. 在 SQL Editor 执行本仓库的 `supabase-schema.sql`。该表启用 RLS，每个账号只能读取和修改自己的行。
3. `sync-config.js` 已配置本项目的公开 Supabase URL 与 anon/publishable key；切换到其他 Supabase 项目时，只替换为该项目自己的公开值。不要填入 `service_role` key。
4. 部署网页；用户在侧栏点「云同步」注册/登录，同一账号登录其他设备后会恢复远端书签。首次登录时本机和云端书签按网址合并。

配置有效且已执行 SQL 迁移后，登录按钮才可用于跨设备同步；缺少配置时登录按钮会保持禁用。云端表尚未创建时，登录或同步无法完成。

## 部署到 Cloudflare Pages（连接 GitHub，推荐）

本仓库根目录含有 `index.html`，不需要框架或打包步骤。Cloudflare 官方静态 HTML 指南：[Deploy a static HTML site](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)；Git 连接说明：[Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)。

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) 并打开 **Workers & Pages**。
2. 选择 **Create application → Pages → Import an existing Git repository**，按提示连接 GitHub，并选择 `sincalaway/nova`。
3. 构建设置填写：

   | 设置 | 值 |
   | --- | --- |
   | Production branch（生产分支） | `main` |
   | Framework preset（框架预设） | `None` / 无 |
   | Build command（构建命令） | `exit 0` |
   | Build output directory（输出目录） | `.` |

4. 开始部署。完成后，Cloudflare 会提供 `项目名.pages.dev` 网址；可在 Pages 项目设置中绑定自定义域名。
5. 仓库 `main` 分支后续每次推送都会触发自动部署；提交到其他分支或 PR 可用于预览（依 Pages 项目配置而定）。

> **注意：** Pages 的 Git 集成和 Direct Upload 是不同的项目创建方式。Cloudflare 文档说明，使用 Git 集成后不能再把同一 Pages 项目切换为 Direct Upload；本仓库推荐保持 Git 集成。

## 文件说明

- `index.html`：完整主页（HTML、样式与交互逻辑）。
- `galaxy.jpg`：星空背景图。
- `logo.png`：项目标识资源。
- `sync-config.js`：Supabase 公共项目 URL 与 anon/publishable key 配置。
- `supabase-schema.sql`：每账号云同步表及行级安全策略。

## Chrome / Edge 浏览器扩展

本仓库同时提供 Chromium Manifest V3 浏览器扩展。加载扩展后，新建标签页会显示这套书签主页；点击工具栏中的“岁瞬网页书签”图标，可把当前网页标题和网址带入添加书签表单。

### 安装

1. 在本仓库中找到 `extension/` 文件夹，或下载并解压浏览器扩展发行包。
2. 在 Chrome 打开 `chrome://extensions`，或在 Edge 打开 `edge://extensions`。
3. 开启“开发者模式”，选择“加载已解压的扩展程序”，并选中 `extension/` 文件夹。
4. 打开新标签页即可使用；可在浏览器扩展菜单中将扩展固定到工具栏，方便收藏当前网页。

扩展不申请读取所有网站数据的权限。只有在你主动点击扩展图标时，才使用 `activeTab` 读取当前标签页标题和网址；书签与偏好保存在扩展自己的浏览器本地存储中。收藏仅支持普通 `http` / `https` 网页，浏览器内部页面（如 `chrome://`）不能收藏。站点图标通过 Google S2 favicon 服务加载；书签正文和设置仍保存在本地。

### 网站版数据迁移与注意事项

网站版与扩展版属于不同来源，不会自动共享本地数据。请在网站版打开“偏好 → 数据变动记录”，选择“导出数据”；再到扩展版新标签页的“偏好 → 数据变动记录 → 导入数据”，选择导出的 JSON 文件。扩展不能替换无痕窗口的新标签页，数据也不会自动跨设备同步；卸载前请先导出 JSON 备份。
