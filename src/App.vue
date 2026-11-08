<script setup>
import { onMounted } from 'vue'

function hideBrokenImage(event) {
  event.currentTarget.style.display = 'none'
}

onMounted(async () => {
  // Preserve the existing local-first and Supabase account/sync behavior while
  // the page shell moves to Vue. Load in the same order as the former scripts.
  await import('./legacy/site-app.js')
  await import('../shared/model.js')
  await import('../shared/assets.js')
  await import('../shared/dashboard.js')
})
</script>

<template>
<div id="wallpaper" aria-hidden="true"></div><div id="shade" aria-hidden="true"></div>
<aside class="rail" aria-label="主导航">
  <a class="rail-brand" href="#home" title="岁瞬网页书签主页"><img :src="'/logo-square.png'" alt="岁瞬" @error="hideBrokenImage"></a>
  <nav class="rail-links" id="railLinks"></nav>
</aside>
<main class="workspace" id="home">
    <div class="top-actions" aria-label="快捷操作">
    <button id="railAccount" class="top-action" type="button" title="登录并同步书签" aria-label="登录并同步书签"><span class="rail-icon rail-icon-sync"><svg viewBox="0 0 24 24"><path d="M7.2 18.5H6a4 4 0 1 1 .6-7.95A5.7 5.7 0 0 1 17.3 9a4.8 4.8 0 0 1 .7 9.5h-1.2"/><path d="M12 12v9m-3-3 3 3 3-3"/></svg></span><span id="syncRailLabel">云同步</span></button>
    <button id="railAdd" class="top-action" type="button" title="添加文件夹" aria-label="添加文件夹"><span class="rail-icon rail-icon-add"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><span>添加</span></button>

    <button id="railSettings" class="top-action" type="button" title="偏好设置" aria-label="偏好设置"><span class="rail-icon rail-icon-settings"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-1.7 2.94-.09-.02a1.7 1.7 0 0 0-1.72.6l-.05.07h-3.4l-.04-.09a1.7 1.7 0 0 0-1.5-1.04 1.7 1.7 0 0 0-.76.18l-.08.04-2.94-1.7.02-.09a1.7 1.7 0 0 0-.6-1.72l-.07-.05v-3.4l.09-.04a1.7 1.7 0 0 0 1.04-1.5 1.7 1.7 0 0 0-.18-.76l-.04-.08 1.7-2.94.09.02a1.7 1.7 0 0 0 1.72-.6l.05-.07h3.4l.04.09a1.7 1.7 0 0 0 1.5 1.04 1.7 1.7 0 0 0 .76-.18l.08-.04 2.94 1.7-.02.09a1.7 1.7 0 0 0 .6 1.72l.07.05v3.4z"/></svg></span><span>偏好</span></button>
    <button id="accountAvatar" class="account-avatar" type="button" hidden title="已登录账号" aria-label="已登录账号" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-1.5a7 7 0 0 1 14 0V20"/></svg></button>
  </div>
  <section class="hero" aria-label="时间和搜索">
    <div class="clock" id="clock">19:12:49</div>
    <div class="date-line" id="dateLine" role="button" tabindex="0" title="打开日历" aria-label="打开日历"></div>
    <form class="search-shell" id="searchForm">
      <div class="engine-wrap"><span class="engine-mark" id="engineMark">b</span><select class="engine" id="engine" aria-label="搜索引擎"><option value="https://www.bing.com/search?q=">Bing</option><option value="https://www.google.com/search?q=">Google</option><option value="https://www.baidu.com/s?wd=">百度</option><option value="https://duckduckgo.com/?q=">DuckDuckGo</option></select></div>
      <input class="search-input" id="searchInput" autocomplete="off" placeholder="输入并搜索..." aria-label="搜索网页或输入网址">
      <button class="search-go" aria-label="搜索" title="搜索" type="submit"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg></button>
    </form>
  </section>
  <section class="bookmark-manager" id="bookmarkManager" aria-label="书签管理" hidden><div class="manager-copy"><strong>书签管理</strong><span id="managerCount"></span></div><div class="manager-actions"><button type="button" id="managerAddBookmark">添加书签</button><button type="button" class="manager-done" id="managerDone">完成</button></div></section>
  <section class="category-filter-row" id="categoryFilters" aria-label="书签分类筛选"></section>
  <section class="bookmark-grid" id="bookmarkGrid" aria-label="我的书签"></section>
  <section class="system-settings-page" id="systemSettingsPage" aria-labelledby="systemSettingsTitle" hidden>
    <header class="system-settings-heading">
      <div><span class="system-settings-kicker">岁瞬 · 管理中心</span><h1 id="systemSettingsTitle">系统设置</h1><p>管理书签、分类和主页外观，让常用内容保持井然有序。</p></div>
    </header>
    <div class="system-settings-grid" aria-label="系统设置功能">
      <button type="button" class="system-action-card" data-system-action="add-tag"><span class="system-card-icon icon-tag" aria-hidden="true">＋</span><span class="system-card-copy"><strong>添加标签</strong><small>新建分类文件夹，为书签建立清晰的归属。</small></span><span class="system-card-arrow" aria-hidden="true">↗</span></button>
      <button type="button" class="system-action-card" data-system-action="batch-edit"><span class="system-card-icon icon-batch" aria-hidden="true">☷</span><span class="system-card-copy"><strong>批量编辑</strong><small>在同一处快速修改多条书签的名称、网址和分类。</small></span><span class="system-card-arrow" aria-hidden="true">↗</span></button>
      <button type="button" class="system-action-card" data-system-action="background"><span class="system-card-icon icon-background" aria-hidden="true">◈</span><span class="system-card-copy"><strong>背景设置</strong><small>更换主页壁纸，细调背景模糊与遮罩效果。</small></span><span class="system-card-arrow" aria-hidden="true">↗</span></button>
      <button type="button" class="system-action-card" data-system-action="bookmarks"><span class="system-card-icon icon-bookmarks" aria-hidden="true">▤</span><span class="system-card-copy"><strong>书签管理</strong><small>查看并整理全部书签，支持添加、编辑和移动。</small></span><span class="system-card-arrow" aria-hidden="true">↗</span></button>
    </div>
    <p class="system-settings-footnote">书签、分类与偏好默认保存在当前浏览器；登录云同步后可在其他设备恢复。侧栏「添加」按钮可随时新建文件夹。</p>
  </section>
</main>
<div class="dock" aria-label="Dock 书签"><div class="dock-bookmarks" id="dockBookmarks" aria-label="Dock 书签"></div></div>
<div class="chrome-foot"><a href="https://liukuan.cc/" target="_blank" rel="noopener">岁瞬网页书签</a></div>
<div class="overlay" id="settingsOverlay" role="dialog" aria-modal="true" aria-label="设置">
  <div class="settings-dialog">
    <aside class="settings-nav">
      <div class="settings-profile"><img :src="'/logo-horizontal.png'" alt="岁瞬网页书签"></div>
      <nav class="setting-tabs" id="settingTabs"></nav>
    </aside>
    <section class="settings-content" id="settingsContent"></section>
  </div>
</div>
<div class="modal-backdrop" id="bookmarkOverlay" role="dialog" aria-modal="true" aria-labelledby="bookmarkModalTitle">
  <form class="bookmark-modal" id="bookmarkForm">
    <div class="modal-head"><h2 id="bookmarkModalTitle">添加书签</h2><button class="modal-close" type="button" id="closeBookmark" aria-label="关闭">×</button></div>
    <div class="field"><label for="bookmarkName">名称</label><input id="bookmarkName" maxlength="32" required placeholder="例如：工作台"></div>
    <div class="field"><label for="bookmarkUrl">网址</label><input id="bookmarkUrl" required placeholder="https://example.com" inputmode="url"></div>
    <div class="field-row"><div class="field"><label for="bookmarkCategory">分类</label><select id="bookmarkCategory"></select></div><div class="field"><label for="bookmarkIcon">图标 / Emoji</label><input id="bookmarkIcon" maxlength="5" placeholder="自动加载网站图标"></div></div>
    <div class="modal-actions"><button class="danger-btn" type="button" id="deleteBookmark">删除</button><button class="cancel-btn" type="button" id="cancelBookmark">取消</button><button class="save-btn" type="submit">保存</button></div>
  </form>
</div>
<div class="category-overlay" id="categoryOverlay" role="dialog" aria-modal="true" aria-labelledby="categoryTitle">
  <form class="category-card" id="categoryForm">
    <div class="category-head"><h2 id="categoryTitle">添加标签</h2><button type="button" class="category-close" id="closeCategory" aria-label="关闭">×</button></div>
    <label for="categoryIcon">标签图标</label><input id="categoryIcon" maxlength="5" value="✦" aria-label="文件夹图标">
    <label for="categoryName">标签名称</label><input id="categoryName" maxlength="16" required placeholder="请填写标签名称" aria-label="标签名称">
    <button class="category-delete danger-btn" id="deleteCategory" type="button">删除文件夹</button><button class="category-save" id="categorySave" type="submit">保存</button>
  </form>
</div>
<div class="bookmark-context-menu" id="bookmarkContextMenu" role="menu" aria-label="书签操作" aria-hidden="true"></div>
<div class="category-context-menu" id="categoryContextMenu" role="menu" aria-label="分类操作" aria-hidden="true"></div>
<div class="utility-backdrop" id="utilityOverlay" role="dialog" aria-modal="true" aria-labelledby="utilityTitle"><section class="utility-card"><header class="utility-head"><h2 id="utilityTitle"></h2><button type="button" id="closeUtility" aria-label="关闭">×</button></header><div id="utilityBody"></div></section></div>
<input id="wallpaperFile" type="file" accept="image/*" hidden><input id="importFile" type="file" accept="application/json,.json" hidden>
<div class="sync-backdrop" id="syncOverlay" role="dialog" aria-modal="true" aria-labelledby="syncTitle">
  <form class="sync-card" id="syncForm">
    <header class="sync-head"><div class="sync-head-brand"><img class="sync-brand" :src="'/logo-vertical.png'" alt="岁瞬"><div><span class="sync-kicker">跨设备书签</span><h2 id="syncTitle">登录与云同步</h2></div></div><button type="button" class="sync-close" id="closeSync" aria-label="关闭">×</button></header>
    <p class="sync-status" id="syncStatus">登录后，书签与偏好会在你的设备间同步。</p>
    <div id="syncSetupNote" class="sync-setup" hidden>云同步尚未配置。请在项目的 <code>sync-config.js</code> 填入 Supabase 项目 URL 和 anon key，并按 README 创建数据表后启用。</div>
    <div id="syncSignedOut">
      <label class="sync-field">邮箱<input id="syncEmail" type="email" autocomplete="email" required placeholder="name@example.com"></label>
      <label class="sync-field">密码<input id="syncPassword" type="password" autocomplete="current-password" minlength="8" required placeholder="至少 8 位"></label>
      <div class="sync-actions"><button class="save-btn" id="syncLogin" type="submit">登录并同步</button><button class="cancel-btn" id="syncSignup" type="button">创建账号</button></div>
      <button class="sync-reset-link" id="syncReset" type="button">忘记密码？重置密码</button>
      <p class="sync-foot">密码由 Supabase Auth 验证；书签数据仅限该账号读取。请在自己的 Supabase 项目中启用邮件验证与安全策略。</p>
    </div>
    <div id="syncRecovery" hidden>
      <p class="sync-recovery-copy">请设置新密码（至少 8 位），保存后即可用新密码登录。</p>
      <label class="sync-field">新密码<input id="syncNewPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="至少 8 位"></label>
      <label class="sync-field">确认新密码<input id="syncConfirmPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="再次输入新密码"></label>
      <div class="sync-actions"><button class="cancel-btn" id="syncCancelRecovery" type="button">取消</button><button class="save-btn" id="syncSavePassword" type="button">保存新密码</button></div>
      <p class="sync-foot">密码将由 Supabase 安全更新；此流程不会更改书签内容。</p>
    </div>
    <div id="syncSignedIn" hidden><div class="sync-account"><span class="sync-avatar">☁</span><div><strong id="syncAccountEmail"></strong><small>云端同步已连接</small></div></div><div class="sync-actions"><button class="cancel-btn" id="syncSignOut" type="button">退出登录</button><button class="save-btn" id="syncNow" type="button">立即同步</button></div></div>
  </form>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
</template>
