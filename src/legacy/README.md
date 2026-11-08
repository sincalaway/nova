# 旧版站点控制器兼容层

`site-app.js` 是从原 `index.html` 内联脚本原样提取的页面控制器。Vue 根组件在模板挂载后加载该模块，再按旧顺序加载 `shared/model.js`、`shared/assets.js` 和 `shared/dashboard.js`。这样迁移页面结构和构建系统时，不需要重写已运行的书签状态、Supabase 注册/登录/密码重置或云同步逻辑。

后续如将控制器逐步改写为 Vue composables，应继续保持 `ziyou.replica.v1`、`public.bookmark_sync` 的 payload 与 RLS、已有 URL 合并策略及密码恢复回调不变，并为每一步增加回归测试。
