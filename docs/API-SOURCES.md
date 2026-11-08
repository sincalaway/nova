# 公开接口与素材来源

## 天气：Open-Meteo

- 官方天气预报接口说明：https://open-meteo.com/en/docs
- 官方地名/坐标查询说明：https://open-meteo.com/en/docs/geocoding-api
- 官方使用及价格说明：https://open-meteo.com/en/pricing
- 页面使用 Geocoding API 的 `name`, `count`, `language`, `format` 查询城市，再以 `latitude`, `longitude`, `current`, `timezone=auto` 请求当前天气。官方文档说明商业使用保留资源需要 API key；免费 API 面向非商业用途，有请求限制且不提供 uptime 保证。若用于商业部署，应先确认服务条款/价格或改接自己的天气服务。
- 地址为用户输入城市，或用户明确点击“定位”并授权浏览器地理位置；未经许可不读取坐标。

## 每日一言：Hitokoto

- 官方接口说明：https://hitokoto.cn/usage
- 示例请求：`https://v1.hitokoto.cn/?c=i&encode=json`；响应包含 `hitokoto` 正文、`from` 出处、`from_who` 作者和 `uuid`。界面按本地日期缓存，链接回一言来源；官方建议控制访问频率并对高流量站点提前沟通，也提供自部署语句接口。

## 热搜：VVhan 开源聚合 API

- 服务及接口源码说明：https://www.vvhan.com/article/zhihu-baidu-weibo-api-kaiyuan
- 页面尝试 `https://api.vvhan.com/api/hotlist?type=baidu|weibo|zhihu`。该接口聚合/解析目标站点榜单，非百度、微博或知乎官方的稳定 API；接口可能因站点改版、限流、CORS 或服务策略失效。若部署环境访问失败，用户可自行替换 `shared/dashboard.js` 中的 endpoint，或部署文档页列出的开源聚合源码并自建代理。

## 壁纸图像

- Unsplash 图片由 `shared/model.js` 中预置的公开图片 URL 加载；本项目不将图片复制进仓库。可直接使用项目内置 `galaxy.jpg`、选择这些链接，或在设置中粘贴自己的 HTTP(S) 图片/视频地址。使用外部图片时，请遵循图片来源方的许可和流量条款；自部署者可以替换壁纸列表。
