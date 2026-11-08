(function (root) {
  'use strict';
  const app = root.NovaApp, model = root.NovaModel;
  if (!app || !model) return;
  const state = () => model.normalize(app.getState());
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const safeUrl = value => model.safeHttpUrl(value);
  const typeNames = { notes: '记事本', weather: '天气', hotlist: '热搜', calendar: '日历', dailyQuote: '每日一言' };
  let wallpaperBlobUrl = '', weatherTimer = 0, toastTimer = 0, contextBookmarkIndex = -1;

  function ensureData() {
    const s = state();
    if (!Array.isArray(s.nova.searchEngines) || !s.nova.searchEngines.length) s.nova.searchEngines = model.engines.map(item => ({ ...item }));
    if (!Array.isArray(s.nova.widgets)) s.nova.widgets = model.widgets.map(item => ({ ...item, config: { ...item.config } }));
    return s;
  }
  function save() {
    const s = ensureData();
    s.schemaVersion = 2;
    s.nova.version = 2;
    app.save();
    applyAppearance();
  }
  function notify(message) {
    if (app.toast) app.toast(message);
    else {
      let toast = $('#novaToast');
      if (!toast) { toast = document.createElement('div'); toast.id = 'novaToast'; toast.className = 'nova-toast'; document.body.append(toast); }
      toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
    }
  }
  function ensureMarkup() {
    if (!$('#novaWidgetBoard')) {
      const grid = $('#bookmarkGrid'), home = $('#home');
      const board = document.createElement('section'); board.id = 'novaWidgetBoard'; board.className = 'nova-widget-board'; board.setAttribute('aria-label', '主页组件');
      if (grid?.parentNode) grid.after(board); else if (home) home.append(board);
    }
    if (!$('#novaToolbar')) {
      const toolbar = document.createElement('nav'); toolbar.id = 'novaToolbar'; toolbar.className = 'nova-toolbar'; toolbar.setAttribute('aria-label', 'Nova 快捷操作');
      toolbar.innerHTML = '<button type="button" data-nova-open="widgets" title="组件与设置">组件</button><button type="button" data-nova-minimal title="极简模式（Esc 退出）">极简</button><button type="button" data-nova-theme title="切换主题">主题</button>';
      document.body.append(toolbar);
    }
    if (!$('#novaPanel')) {
      const panel = document.createElement('div'); panel.id = 'novaPanel'; panel.className = 'nova-panel'; panel.hidden = true;
      panel.innerHTML = '<div class="nova-panel-shade" data-nova-close></div><section class="nova-panel-card" role="dialog" aria-modal="true" aria-labelledby="novaPanelTitle"><header class="nova-panel-head"><div><span>PERSONAL START PAGE</span><h2 id="novaPanelTitle">主页组件</h2></div><button type="button" data-nova-close aria-label="关闭">×</button></header><nav class="nova-panel-tabs"><button type="button" data-nova-tab="widgets">组件</button><button type="button" data-nova-tab="search">搜索</button><button type="button" data-nova-tab="wallpaper">壁纸</button><button type="button" data-nova-tab="sites">书签与 WebApp</button></nav><div id="novaPanelBody" class="nova-panel-body"></div></section>';
      document.body.append(panel);
    }
    if (!$('#novaWebappLayer')) {
      const layer = document.createElement('div'); layer.id = 'novaWebappLayer'; layer.className = 'nova-web-layer'; layer.hidden = true;
      layer.innerHTML = '<div class="nova-window" role="dialog" aria-label="内嵌 WebApp"><header class="nova-window-head"><strong id="novaWindowTitle">WebApp</strong><div><button type="button" data-window-minimize title="最小化">−</button><button type="button" data-window-fullscreen title="全屏">⛶</button><button type="button" data-window-newtab title="新标签打开">↗</button><button type="button" data-window-close title="关闭">×</button></div></header><iframe id="novaWebFrame" title="内嵌 WebApp" allow="fullscreen; clipboard-read; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe><p class="nova-frame-note">如果页面禁止嵌入（CSP / X-Frame-Options），请用右上角按钮在新标签页打开。</p></div>';
      document.body.append(layer);
    }
    if (!$('#novaAppDock')) {
      const dock = document.createElement('nav'); dock.id = 'novaAppDock'; dock.className = 'nova-app-dock'; dock.setAttribute('aria-label', '打开的 WebApp'); dock.hidden = true; document.body.append(dock);
    }
    if (!$('#novaHtmlFile')) {
      const input = document.createElement('input'); input.type = 'file'; input.id = 'novaHtmlFile'; input.accept = '.html,.htm,text/html'; input.hidden = true; document.body.append(input);
    }
    if (!$('#novaMediaFile')) {
      const input = document.createElement('input'); input.type = 'file'; input.id = 'novaMediaFile'; input.accept = 'image/*,video/mp4,video/webm,video/ogg,video/quicktime'; input.hidden = true; document.body.append(input);
    }
    if (!$('#novaTranslateButton')) {
      const form = $('#searchForm'), submit = $('.search-go', form);
      if (form && submit) { const translate = document.createElement('button'); translate.id = 'novaTranslateButton'; translate.type = 'button'; translate.className = 'nova-translate'; translate.textContent = '译'; translate.title = '快捷翻译'; submit.before(translate); }
    }
    if (!$('#novaSuggestions')) {
      const form = $('#searchForm');
      if (form) { const list = document.createElement('div'); list.id = 'novaSuggestions'; list.className = 'nova-suggestions'; list.hidden = true; form.after(list); }
    }
    if ($('#bookmarkForm') && !$('#novaBookmarkCategories')) {
      const field = document.createElement('label'); field.className = 'nova-bookmark-extra'; field.innerHTML = '<span>更多分类（可多选）</span><select id="novaBookmarkCategories" multiple size="3" aria-label="更多分类"></select>';
      const iconField = document.createElement('label'); iconField.className = 'nova-bookmark-extra'; iconField.innerHTML = '<span>自定义图标图片 URL（可选）</span><input id="novaBookmarkIconUrl" type="url" placeholder="https://example.com/icon.png">';
      const appField = document.createElement('label'); appField.className = 'nova-bookmark-appcheck'; appField.innerHTML = '<input id="novaBookmarkAsApp" type="checkbox"> 选择“内嵌 WebApp”打开';
      const form = $('#bookmarkForm'), actions = $('.modal-actions', form);
      actions?.before(field, iconField, appField);
    }
  }
  function addStyles() {
    if ($('#novaStyles')) return;
    const style = document.createElement('style'); style.id = 'novaStyles';
    style.textContent = `
      .nova-wall-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:blur(var(--wall-blur));transform:scale(1.035)}.nova-toolbar{position:fixed;right:18px;top:60px;z-index:12;display:flex;gap:6px}.nova-toolbar button,.nova-btn{border:1px solid rgba(230,241,255,.2);border-radius:10px;background:rgba(12,28,45,.76);color:#f5f9ff;padding:8px 11px;font-size:11px;backdrop-filter:blur(14px);box-shadow:0 5px 16px #0002}.nova-toolbar button:hover,.nova-btn:hover{background:rgba(52,90,126,.87)}
      .nova-widget-board{position:relative;z-index:1;width:min(1120px,calc(100% - 12px));margin:18px auto 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr));gap:12px;align-content:start;max-height:calc(100vh - 260px);overflow:auto;padding:3px 4px 18px;scrollbar-width:thin}.nova-widget-board:empty{display:none}.nova-widget{position:relative;min-width:0;min-height:125px;padding:15px 15px 14px;border:1px solid rgba(226,240,255,.18);border-radius:15px;background:rgba(12,26,42,.68);color:#eef6ff;box-shadow:0 9px 28px rgba(0,0,0,.2);backdrop-filter:blur(17px);display:flex;flex-direction:column;gap:10px}.nova-widget[draggable=true]{cursor:grab}.nova-widget.nova-drag-over{outline:2px solid #6abaff}.nova-widget-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.nova-widget-head strong{font-size:13px;letter-spacing:.02em}.nova-widget-actions{display:flex;gap:5px}.nova-widget-actions button,.nova-widget select,.nova-widget input,.nova-widget textarea{border:1px solid rgba(220,236,252,.2);border-radius:8px;background:rgba(255,255,255,.09);color:inherit;padding:6px 8px;font-size:11px}.nova-widget-actions button{padding:3px 7px;cursor:pointer}.nova-widget select option{color:#243244}.nova-widget-body{min-height:40px;font-size:12px;line-height:1.65;color:rgba(241,247,255,.9)}.nova-note-editor{width:100%;min-height:115px;resize:vertical;background:rgba(0,0,0,.14)!important;font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace!important}.nova-note-preview{min-height:60px;white-space:normal;overflow-wrap:anywhere}.nova-note-preview h3,.nova-note-preview h4{margin:.35em 0}.nova-note-preview p{margin:.35em 0}.nova-weather-row{display:flex;gap:6px}.nova-weather-row input{flex:1;min-width:0}.nova-weather-data{font-size:12px}.nova-weather-temp{font-size:30px;font-weight:300;line-height:1.1}.nova-widget small,.nova-muted{color:rgba(226,238,250,.62);font-size:10px}.nova-hotlist{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px}.nova-hotlist li{display:flex;gap:7px;min-width:0}.nova-hotlist a{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit}.nova-hotlist a:hover{color:#91d1ff}.nova-hot-rank{color:#ffc681;min-width:15px;font-variant-numeric:tabular-nums}.nova-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center}.nova-calendar span,.nova-calendar button{padding:4px 0;font-size:10px;border:0;border-radius:6px;background:transparent;color:inherit}.nova-calendar button.today{background:#67aff0;color:#10253c;font-weight:bold}.nova-calendar button:hover{background:rgba(255,255,255,.13)}.nova-quote{font-size:15px;line-height:1.7}.nova-quote-from{text-align:right}.nova-panel{position:fixed;inset:0;z-index:70}.nova-panel[hidden],.nova-web-layer[hidden]{display:none!important}.nova-panel-shade{position:absolute;inset:0;background:rgba(3,9,17,.62);backdrop-filter:blur(5px)}.nova-panel-card{position:absolute;right:0;top:0;bottom:0;width:min(620px,100vw);display:flex;flex-direction:column;background:#f8fbff;color:#253448;box-shadow:-22px 0 70px #0005}.nova-panel-head{display:flex;justify-content:space-between;align-items:center;padding:22px 24px 14px;border-bottom:1px solid #e7edf4}.nova-panel-head>div>span{font-size:9px;letter-spacing:.18em;color:#6393c0}.nova-panel-head h2{margin:5px 0 0;font-size:20px}.nova-panel-head>button{border:0;border-radius:8px;width:32px;height:32px;background:#eaf0f5;color:#526477;font-size:22px}.nova-panel-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:10px 20px;border-bottom:1px solid #e7edf4}.nova-panel-tabs button,.nova-chip{border:1px solid #dfe7ef;border-radius:9px;background:#fff;color:#526477;padding:8px 10px;font-size:11px}.nova-panel-tabs button.active{background:#e6f2fc;color:#1f70b3;border-color:#b6d7f3}.nova-panel-body{overflow:auto;padding:18px 22px 30px}.nova-panel-body h3{font-size:13px;margin:18px 0 8px}.nova-panel-body p,.nova-help{font-size:11px;line-height:1.65;color:#718094}.nova-settings-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid #edf1f5;font-size:12px}.nova-settings-row input[type=checkbox]{accent-color:#308dd0}.nova-field{display:flex;flex-direction:column;gap:5px;margin:12px 0;font-size:11px;color:#68788d}.nova-field input,.nova-field select{width:100%;border:1px solid #d9e2eb;border-radius:8px;background:#fff;color:#263649;padding:9px 10px;font-size:12px}.nova-form-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.nova-catalog{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}.nova-catalog button,.nova-wall-card{border:1px solid #e2e9f0;border-radius:11px;background:#fff;color:#35465a;padding:9px;text-align:left;font-size:11px;cursor:pointer}.nova-catalog button:hover,.nova-wall-card:hover{border-color:#99c9ed;transform:translateY(-1px)}.nova-wall-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.nova-wall-card{padding:0;overflow:hidden}.nova-wall-card img{display:block;width:100%;height:80px;object-fit:cover;background:#d8e1e8}.nova-wall-card span{display:block;padding:7px 8px}.nova-engine-row{display:grid;grid-template-columns:1fr 2fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #edf1f5;font-size:11px}.nova-engine-row button{border:0;background:#fff0f0;color:#bd4f59;border-radius:7px;padding:6px}.nova-search-tip{font-size:10px;color:#7c8b9d}.nova-suggestions{position:relative;z-index:13;width:min(750px,100%);margin:-2px auto 0;border-radius:0 0 13px 13px;background:rgba(255,255,255,.97);color:#2c3c4d;box-shadow:0 12px 24px #0002;overflow:hidden}.nova-suggestions[hidden]{display:none}.nova-suggestions button{display:block;width:100%;padding:8px 14px;text-align:left;border:0;background:transparent;color:inherit;font-size:11px}.nova-suggestions button:hover{background:#eff6fc}.nova-translate{align-self:stretch;min-width:36px;border:0;border-left:1px solid #dfe4ea;background:transparent;color:#397aaf;font-size:11px}.nova-translate[hidden]{display:none}.nova-bookmark-extra{display:block;margin:9px 0;color:#748095;font-size:10px}.nova-bookmark-extra input,.nova-bookmark-extra select{display:block;width:100%;margin-top:5px;border:1px solid #e1e5ea;border-radius:8px;padding:8px;background:#fff;color:#29394a;font-size:11px}.nova-bookmark-extra select{height:auto}.nova-bookmark-appcheck{display:flex;gap:7px;align-items:center;margin:8px 0;color:#596a7c;font-size:10px}.nova-bookmark-appcheck input{accent-color:#438ccc}.nova-web-layer{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.64);backdrop-filter:blur(5px)}.nova-window{position:absolute;left:6vw;top:6vh;width:88vw;height:86vh;display:flex;flex-direction:column;border:1px solid #d9e2ec;border-radius:15px;overflow:hidden;background:#f6f9fc;box-shadow:0 25px 90px #0007}.nova-window-head{height:46px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 11px 0 15px;background:#f3f6fa;color:#33465b}.nova-window-head strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nova-window-head div{display:flex;gap:5px}.nova-window-head button{width:29px;height:28px;border:0;border-radius:7px;background:#e5ebf1;color:#51657a}.nova-window iframe{flex:1;min-height:0;width:100%;border:0;background:white}.nova-frame-note{margin:0;padding:4px 8px;text-align:center;background:#fff;color:#6c7b8b;font-size:9px}.nova-app-dock{position:fixed;z-index:30;right:14px;bottom:78px;display:flex;gap:6px;max-width:min(48vw,440px);overflow:auto;padding:6px;border:1px solid rgba(235,244,255,.2);border-radius:13px;background:rgba(16,29,44,.82);backdrop-filter:blur(15px)}.nova-app-dock[hidden]{display:none}.nova-app-dock button{flex:none;max-width:140px;border:0;border-radius:8px;background:rgba(255,255,255,.12);color:white;padding:7px 9px;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nova-app-dock button.active{background:#368fe0}.nova-app-dock button.close-app{color:#ffbdc2}.nova-toast{position:fixed;left:50%;bottom:25px;z-index:100;transform:translate(-50%,12px);opacity:0;pointer-events:none;padding:9px 14px;border-radius:9px;background:#1d2b3a;color:white;font-size:11px;transition:.18s}.nova-toast.show{transform:translate(-50%,0);opacity:1}.nova-light{--nova-card-bg:rgba(255,255,255,.8)}body.nova-light .nova-widget{background:rgba(249,252,255,.88);color:#253548;border-color:rgba(38,66,96,.16)}body.nova-light .nova-widget-body{color:#40546a}body.nova-light .nova-widget small,body.nova-light .nova-muted{color:#718094}body.nova-light .nova-hotlist a{color:#32475d}body.nova-light .nova-toolbar button{background:rgba(248,251,255,.91);color:#34485e;border-color:#b9cad8}.nova-minimal .rail,.nova-minimal .top-actions,.nova-minimal .top-toolbar,.nova-minimal .top-actions,.nova-minimal #bookmarkManager,.nova-minimal #categoryFilters,.nova-minimal #bookmarkGrid,.nova-minimal #systemSettingsPage,.nova-minimal .dock,.nova-minimal .chrome-foot,.nova-minimal #novaWidgetBoard,.nova-minimal #novaToolbar{display:none!important}.nova-minimal .workspace{margin:0!important;width:100%!important;padding:0!important;justify-content:center!important}.nova-minimal .hero{width:min(700px,90vw)!important;margin:0 auto!important}.nova-minimal .clock,.nova-minimal .date-line{display:none!important}.nova-minimal .search-shell{margin:0 auto!important}
      .nova-web-layer:fullscreen .nova-window{left:0;top:0;width:100vw;height:100vh;border-radius:0}.nova-web-layer:fullscreen .nova-frame-note{display:none}
      @media(max-width:680px){.nova-toolbar{right:7px;top:48px;gap:4px}.nova-toolbar button{padding:7px 8px;font-size:10px}.nova-widget-board{width:calc(100% - 14px);grid-template-columns:1fr;max-height:calc(100vh - 235px);margin-top:12px}.nova-panel-card{width:100vw}.nova-panel-head{padding:17px}.nova-panel-body{padding:14px 16px 26px}.nova-panel-tabs{padding:8px 10px}.nova-panel-tabs button{padding:7px}.nova-wall-grid{grid-template-columns:1fr 1fr}.nova-window{left:0;top:0;width:100vw;height:100dvh;border-radius:0}.nova-app-dock{left:8px;right:8px;bottom:58px;max-width:none}.nova-suggestions{width:100%}}
    `;
    document.head.append(style);
  }
  function applyAppearance() {
    const s = ensureData(), settings = s.nova.settings;
    document.body.classList.toggle('nova-light', settings.theme === 'light');
    document.body.classList.toggle('nova-minimal', !!settings.minimalMode);
    const button = $('[data-nova-minimal]');
    if (button) button.textContent = settings.minimalMode ? '退出极简' : '极简';
    const translation = $('#novaTranslateButton');
    if (translation) translation.hidden = !settings.translationEnabled;
  }
  function panelOpen(tab = 'widgets') {
    const panel = $('#novaPanel'); if (!panel) return;
    panel.hidden = false; renderPanel(tab); $('[data-nova-close]', panel)?.focus();
  }
  function panelClose() { const panel = $('#novaPanel'); if (panel) panel.hidden = true; }
  function engineOptions() {
    const s = ensureData(), select = $('#engine'); if (!select) return;
    const engines = s.nova.searchEngines;
    select.replaceChildren(...engines.map(engine => new Option(engine.name, engine.template)));
    const current = engines.find(engine => engine.template === s.engine || engine.template.replace('{query}', '') === s.engine) || engines.find(engine => engine.id === s.nova.settings.searchEngineId) || engines[0];
    if (current) { select.value = current.template; s.engine = current.template.replace('{query}', ''); s.nova.settings.searchEngineId = current.id; }
  }
  function selectedEngines() { return ensureData().nova.searchEngines; }
  function setEngine(engine) {
    const s = ensureData(); s.engine = engine.template.replace('{query}', ''); s.nova.settings.searchEngineId = engine.id;
    const select = $('#engine'); if (select) select.value = engine.template;
    const mark = $('#engineMark'); if (mark) mark.textContent = engine.icon || engine.name.slice(0, 1);
    save();
  }
  function renderSuggestions() {
    const list = $('#novaSuggestions'), input = $('#searchInput');
    if (!list || !input || !ensureData().nova.settings.suggestionsEnabled) { if (list) list.hidden = true; return; }
    const query = input.value.trim().toLocaleLowerCase();
    const items = state().nova.searchHistory.filter(text => !query || text.toLocaleLowerCase().includes(query)).slice(0, 6);
    list.innerHTML = items.map(text => `<button type="button" data-search-history="${esc(text)}">◷　${esc(text)}</button>`).join('');
    list.hidden = !items.length;
  }
  function addHistory(query) {
    const s = ensureData(), history = s.nova.searchHistory.filter(item => item !== query);
    s.nova.searchHistory = [query, ...history].slice(0, 30); save();
  }
  function renderPanel(tab) {
    const body = $('#novaPanelBody'), title = $('#novaPanelTitle'); if (!body) return;
    $$('#novaPanel .nova-panel-tabs button').forEach(button => button.classList.toggle('active', button.dataset.novaTab === tab));
    title.textContent = ({ widgets: '主页组件', search: '搜索设置', wallpaper: '壁纸与主题', sites: '书签与 WebApp' })[tab] || '主页设置';
    const s = ensureData();
    if (tab === 'widgets') {
      const active = new Map(s.nova.widgets.map(widget => [widget.type, widget]));
      body.innerHTML = `<p>卡片按顺序显示在主页书签下方；拖动卡片可以排序。笔记、城市和显示偏好会保存在当前状态中，登录云同步时按现有 JSON 备份流程同步。</p><h3>组件库</h3>${model.widgets.map(def => { const current = active.get(def.type); return `<div class="nova-settings-row"><span><strong>${typeNames[def.type]}</strong><br><small>${widgetDescription(def.type)}</small></span><div>${current ? `<button class="nova-btn" type="button" data-widget-remove="${def.type}">移除</button>` : `<button class="nova-btn" type="button" data-widget-add="${def.type}">添加</button>`}</div></div>`; }).join('')}<h3>已启用组件顺序</h3><p>${s.nova.widgets.slice().sort((a,b)=>a.order-b.order).map(item => typeNames[item.type]).join(' · ') || '尚未添加组件'}</p>`;
    } else if (tab === 'search') {
      body.innerHTML = `<p>搜索直接在你选择的搜索引擎打开；搜索历史仅保存在本机/现有账号 JSON 状态中，不会向 Nova 发送查询。</p><label class="nova-settings-row"><span>快捷翻译按钮</span><input id="novaTranslationEnabled" type="checkbox" ${s.nova.settings.translationEnabled ? 'checked' : ''}></label><label class="nova-settings-row"><span>本地搜索建议与历史</span><input id="novaSuggestionsEnabled" type="checkbox" ${s.nova.settings.suggestionsEnabled ? 'checked' : ''}></label><h3>搜索引擎</h3><div>${s.nova.searchEngines.map(engine => `<div class="nova-engine-row"><strong>${esc(engine.name)}</strong><span>${esc(engine.template)}</span>${engine.builtin ? '<span></span>' : `<button type="button" data-engine-remove="${esc(engine.id)}">删除</button>`}</div>`).join('')}</div><form id="novaEngineForm"><div class="nova-form-row"><label class="nova-field">名称<input name="name" required maxlength="40" placeholder="例如：搜狗"></label><label class="nova-field">搜索 URL 模板<input name="template" required placeholder="https://example.com?q={query}"></label><button class="nova-btn" type="submit">添加</button></div></form><p class="nova-search-tip">模板必须包含 <code>{query}</code>。在搜索框中按 Tab / Shift+Tab 可循环切换搜索引擎。</p>`;
    } else if (tab === 'wallpaper') {
      const current = s.nova.settings.wallpaper || {}, wallpaperCategories=['全部',...new Set(model.wallpapers.map(item=>item.category))], selectedWallpaperCategory=s.nova.settings.wallpaperCategory||'全部', visibleWallpapers=model.wallpapers.filter(item=>selectedWallpaperCategory==='全部'||item.category===selectedWallpaperCategory);
      body.innerHTML = `<p>图片库来源为项目内置星空图或 Unsplash 图片链接。选择后仅保存壁纸地址；本地上传的图片/视频保存在当前浏览器 IndexedDB，不会上传二进制文件。</p><label class="nova-field">壁纸分类<select id="novaWallpaperCategory">${wallpaperCategories.map(category=>'<option value="'+esc(category)+'" '+(selectedWallpaperCategory===category?'selected':'')+'>'+esc(category)+'</option>').join('')}</select></label><div class="nova-wall-grid">${visibleWallpapers.map(wallpaper => `<button class="nova-wall-card" type="button" data-wallpaper="${esc(wallpaper.id)}"><img loading="lazy" src="${esc(wallpaper.url)}" alt=""><span>${esc(wallpaper.name)} · ${esc(wallpaper.category)}</span></button>`).join('')}</div><div class="nova-settings-row"><span>随机壁纸</span><button class="nova-btn" type="button" data-wallpaper-random>随机切换</button></div><h3>自定义链接或本地文件</h3><form id="novaWallpaperUrlForm"><label class="nova-field">图片 / 视频 URL<input name="url" type="url" placeholder="https://example.com/wallpaper.jpg"></label><button class="nova-btn" type="submit">应用链接</button></form><div class="nova-settings-row"><span>上传图片或视频（最大 50 MB）</span><button class="nova-btn" type="button" data-wallpaper-upload>选择文件</button></div><div class="nova-settings-row"><span>背景模糊</span><input id="novaBlur" type="range" min="0" max="12" value="${Number(s.blur ?? current.blur ?? 0)}"></div><div class="nova-settings-row"><span>遮罩透明度</span><input id="novaShade" type="range" min="8" max="70" value="${Number(s.shade ?? 34)}"></div><h3>时间与日期</h3><label class="nova-settings-row"><span>日期格式</span><select id="novaDateFormat"><option value="full" ${s.nova.settings.dateFormat==='full'?'selected':''}>月/日 + 星期</option><option value="short" ${s.nova.settings.dateFormat==='short'?'selected':''}>短日期</option><option value="iso" ${s.nova.settings.dateFormat==='iso'?'selected':''}>年/月/日</option><option value="month-day" ${s.nova.settings.dateFormat==='month-day'?'selected':''}>中文长日期</option></select></label><p>24 小时制与秒数可在原有时间设置中调整。</p><h3>外观</h3><div class="nova-settings-row"><span>当前主题：${s.nova.settings.theme === 'light' ? '亮色' : '暗色'}</span><button class="nova-btn" type="button" data-nova-theme>切换主题</button></div><div class="nova-settings-row"><span>一键极简模式</span><button class="nova-btn" type="button" data-nova-minimal>切换</button></div>`;
    } else {
      body.innerHTML = `<p>常用站点一键添加到当前书签；支持 Chrome / Edge 导出的 Netscape Bookmark HTML。内嵌窗口会受目标站点的 CSP 和 X-Frame-Options 限制。</p><h3>常用站点</h3><div class="nova-catalog">${model.sites.map(site => `<button type="button" data-site-add="${esc(site.url)}">${esc(site.icon)}　${esc(site.name)}<br><small>${esc(site.category)}</small></button>`).join('')}</div><h3>从浏览器导入</h3><button type="button" class="nova-btn" data-html-import>导入书签 HTML</button><p>读取导出的本地 HTML 文件；只导入 http/https 链接和文件夹名称，不执行 HTML 脚本。</p><h3>添加 WebApp</h3><form id="novaWebappForm"><div class="nova-form-row"><label class="nova-field">名称<input name="title" required maxlength="80" placeholder="我的工作台"></label><label class="nova-field">网址<input name="url" type="url" required placeholder="https://example.com"></label><button class="nova-btn" type="submit">打开</button></div></form><h3>已打开的 WebApp</h3><p>${s.nova.webApps.filter(item => item.open && !item.minimized).map(item => esc(item.title)).join(' · ') || '目前没有已打开窗口。'}</p>`;
    }
  }
  function widgetDescription(type) {
    return ({ notes: '本地保存纯文本，支持安全的简易 Markdown 预览。', weather: 'Open-Meteo 免费天气；输入城市或主动授权定位。', hotlist: '微博、百度、知乎热榜（第三方服务可能临时不可用）。', calendar: '本地月历，无需联网。', dailyQuote: '每日缓存一条一言，附原文链接。' })[type] || '';
  }
  function getWidget(type) { return ensureData().nova.widgets.find(item => item.type === type); }
  function markdown(text) {
    return String(text || '').split('\n').map(line => {
      let value = esc(line).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      if (/^### /.test(value)) return `<h4>${value.slice(4)}</h4>`;
      if (/^## /.test(value)) return `<h3>${value.slice(3)}</h3>`;
      if (/^# /.test(value)) return `<h3>${value.slice(2)}</h3>`;
      if (/^- /.test(value)) return `<p>• ${value.slice(2)}</p>`;
      return value ? `<p>${value}</p>` : '<br>';
    }).join('');
  }
  function monthMarkup(date) {
    const year = date.getFullYear(), month = date.getMonth(), first = new Date(year, month, 1), offset = (first.getDay() + 6) % 7, days = new Date(year, month + 1, 0).getDate(), now = new Date();
    let cells = ['一','二','三','四','五','六','日'].map(day => `<span class="nova-muted">${day}</span>`).join('');
    for (let i = 0; i < offset; i++) cells += '<span></span>';
    for (let day = 1; day <= days; day++) cells += `<button type="button" class="${year === now.getFullYear() && month === now.getMonth() && day === now.getDate() ? 'today' : ''}" aria-label="${year}年${month+1}月${day}日">${day}</button>`;
    return `<div class="nova-widget-head"><strong>${year}年${month + 1}月</strong><div class="nova-widget-actions"><button type="button" data-month-step="-1">‹</button><button type="button" data-month-step="1">›</button></div></div><div class="nova-calendar">${cells}</div>`;
  }
  function renderWidgets() {
    const board = $('#novaWidgetBoard'); if (!board) return;
    const widgets = ensureData().nova.widgets.filter(widget => widget.enabled !== false).sort((a,b) => a.order - b.order);
    board.innerHTML = widgets.map(widget => {
      const title = typeNames[widget.type] || '组件';
      let content = '';
      if (widget.type === 'notes') {
        const config = widget.config || {};
        content = `<div class="nova-widget-head"><strong>${title}</strong><div class="nova-widget-actions"><button type="button" data-note-preview>${config.preview ? '编辑' : '预览'}</button></div></div>${config.preview ? `<div class="nova-widget-body nova-note-preview">${markdown(config.text)}</div>` : `<textarea class="nova-note-editor" aria-label="记事本" placeholder="记点什么……支持 # 标题、- 列表、**粗体**、\`代码\`">${esc(config.text)}</textarea>`}`;
      } else if (widget.type === 'weather') {
        const city = widget.config.city || '';
        content = `<div class="nova-widget-head"><strong>${title}</strong><div class="nova-widget-actions"><button type="button" data-weather-refresh>刷新</button></div></div><form class="nova-weather-row"><input aria-label="城市" value="${esc(city)}" placeholder="输入城市，如 San Francisco"><button class="nova-btn" type="submit">查询</button><button class="nova-btn" type="button" data-weather-location title="允许浏览器定位">定位</button></form><div class="nova-weather-data">${city ? '正在获取天气…' : '输入城市，或点「定位」主动授权后获取天气。'}</div>`;
      } else if (widget.type === 'hotlist') {
        const source = widget.config.source || 'baidu';
        content = `<div class="nova-widget-head"><strong>${title}</strong><div class="nova-widget-actions"><select aria-label="热搜来源" data-hotlist-source><option value="baidu" ${source === 'baidu' ? 'selected' : ''}>百度</option><option value="weibo" ${source === 'weibo' ? 'selected' : ''}>微博</option><option value="zhihu" ${source === 'zhihu' ? 'selected' : ''}>知乎</option></select><button type="button" data-hotlist-refresh>刷新</button></div></div><div class="nova-widget-body" data-hotlist-data>正在加载热榜…</div>`;
      } else if (widget.type === 'calendar') {
        const dateValue = widget.config.month ? new Date(`${widget.config.month}-01T12:00:00`) : new Date();
        content = monthMarkup(dateValue);
      } else if (widget.type === 'dailyQuote') {
        const config = widget.config || {};
        content = `<div class="nova-widget-head"><strong>每日一言</strong><div class="nova-widget-actions"><button type="button" data-quote-refresh>换一句</button></div></div><div class="nova-widget-body nova-quote" data-quote-text>${esc(config.text || '静候一句今日的话…')}</div><small class="nova-quote-from" data-quote-from>${esc(config.from || '')}</small>`;
      }
      return `<article class="nova-widget" draggable="true" data-widget-id="${esc(widget.id)}" data-widget-type="${esc(widget.type)}">${content}</article>`;
    }).join('');
    bindWidgetEvents();
  }
  function bindWidgetEvents() {
    const board = $('#novaWidgetBoard');
    board.querySelectorAll('[data-note-preview]').forEach(button => button.onclick = () => { const widget = getWidget('notes'); widget.config.preview = !widget.config.preview; save(); renderWidgets(); });
    board.querySelectorAll('.nova-note-editor').forEach(input => input.oninput = () => { const widget = getWidget('notes'); widget.config.text = input.value; ensureData().note = input.value; clearTimeout(weatherTimer); weatherTimer = setTimeout(save, 300); });
    board.querySelectorAll('.nova-weather-row').forEach(form => form.onsubmit = event => { event.preventDefault(); const city = $('input', form).value.trim(); if (!city) return; const widget = getWidget('weather'); widget.config.city = city; widget.config.latitude = null; widget.config.longitude = null; save(); renderWidgets(); fetchWeather(widget); });
    board.querySelectorAll('[data-weather-location]').forEach(button => button.onclick = () => {
      if (!navigator.geolocation) return notify('此浏览器不支持定位；可直接输入城市名称。');
      button.disabled = true; navigator.geolocation.getCurrentPosition(position => { const widget = getWidget('weather'); widget.config.city = '当前位置'; widget.config.latitude = position.coords.latitude; widget.config.longitude = position.coords.longitude; save(); renderWidgets(); fetchWeather(widget); }, () => { button.disabled = false; notify('定位未成功；你可以改为输入城市名称。'); }, { timeout: 10000, maximumAge: 300000 });
    });
    board.querySelectorAll('[data-weather-refresh]').forEach(button => button.onclick = () => fetchWeather(getWidget('weather')));
    board.querySelectorAll('[data-hotlist-source]').forEach(select => select.onchange = () => { const widget = getWidget('hotlist'); widget.config.source = select.value; save(); loadHotlist(widget); });
    board.querySelectorAll('[data-hotlist-refresh]').forEach(button => button.onclick = () => loadHotlist(getWidget('hotlist')));
    board.querySelectorAll('[data-month-step]').forEach(button => button.onclick = () => { const widget = getWidget('calendar'), current = widget.config.month ? new Date(`${widget.config.month}-01T12:00:00`) : new Date(); current.setMonth(current.getMonth() + Number(button.dataset.monthStep)); widget.config.month = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}`; save(); renderWidgets(); });
    board.querySelectorAll('[data-quote-refresh]').forEach(button => button.onclick = () => loadQuote(true));
    board.querySelectorAll('.nova-widget').forEach(card => {
      card.addEventListener('dragstart', event => { event.dataTransfer.setData('application/x-nova-widget', card.dataset.widgetId); event.dataTransfer.effectAllowed = 'move'; });
      card.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('application/x-nova-widget')) { event.preventDefault(); card.classList.add('nova-drag-over'); } });
      card.addEventListener('dragleave', () => card.classList.remove('nova-drag-over'));
      card.addEventListener('drop', event => { const source = event.dataTransfer.getData('application/x-nova-widget'); if (!source || source === card.dataset.widgetId) return; event.preventDefault(); event.stopPropagation(); const list = ensureData().nova.widgets.sort((a,b)=>a.order-b.order), from = list.findIndex(item=>item.id===source), to = list.findIndex(item=>item.id===card.dataset.widgetId); if (from < 0 || to < 0) return; const [moved] = list.splice(from,1); list.splice(to,0,moved); list.forEach((item,index)=>item.order=index); save(); renderWidgets(); });
    });
  }
  async function fetchWeather(widget) {
    const target = $('[data-widget-type="weather"] .nova-weather-data'); if (!target || !widget) return;
    target.textContent = '正在查询…';
    try {
      let latitude = widget.config.latitude, longitude = widget.config.longitude, label = widget.config.city;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        if (!label || label === '当前位置') throw new Error('请先输入城市，或使用定位按钮。');
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(label)}&count=1&language=zh&format=json`;
        const geoResponse = await fetch(geoUrl); if (!geoResponse.ok) throw new Error('地名查询服务暂不可用');
        const geo = await geoResponse.json(), place = geo.results?.[0]; if (!place) throw new Error('没有找到该城市，请更换名称。');
        latitude = place.latitude; longitude = place.longitude; label = [place.name, place.admin1].filter(Boolean).join(' · ');
        widget.config.latitude = latitude; widget.config.longitude = longitude; widget.config.city = label; save();
      }
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`;
      const response = await fetch(url); if (!response.ok) throw new Error('天气服务暂不可用');
      const data = await response.json(), current = data.current; if (!current) throw new Error('暂无天气数据');
      const descriptions = { 0:'晴朗',1:'大致晴朗',2:'局部多云',3:'阴天',45:'雾',48:'雾凇',51:'毛毛雨',53:'中等毛毛雨',55:'强毛毛雨',61:'小雨',63:'中雨',65:'大雨',71:'小雪',73:'中雪',75:'大雪',80:'阵雨',81:'中等阵雨',82:'强阵雨',95:'雷暴' };
      target.innerHTML = `<div class="nova-weather-temp">${Math.round(current.temperature_2m)}°</div><div>${esc(descriptions[current.weather_code] || '天气情况')} · 体感 ${Math.round(current.apparent_temperature)}°</div><small>${esc(label || '当前位置')}　湿度 ${current.relative_humidity_2m}%　风速 ${current.wind_speed_10m} km/h</small>`;
    } catch (error) { target.textContent = error.message || '天气获取失败，请稍后重试。'; }
  }
  async function loadHotlist(widget) {
    const target = $('[data-hotlist-data]'); if (!target || !widget) return;
    target.textContent = '正在加载热榜…';
    try {
      const source = widget.config.source || 'baidu', response = await fetch(`https://api.vvhan.com/api/hotlist?type=${encodeURIComponent(source)}`);
      if (!response.ok) throw new Error('热榜服务暂不可用');
      const result = await response.json(); let items = Array.isArray(result.data) ? result.data : [];
      if (!items.length && result.data?.cards) items = result.data.cards.flatMap(card => card.content || []);
      items = items.map(item => ({ title: item.title || item.note || item.word || item.name, url: item.url || item.link, hot: item.hot || item.hotScore })).filter(item => item.title).slice(0, 8);
      if (!items.length) throw new Error('当前来源没有返回热榜');
      target.innerHTML = `<ol class="nova-hotlist">${items.map((item,index) => `<li><span class="nova-hot-rank">${index+1}</span>${safeUrl(item.url) ? `<a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener">${esc(item.title)}</a>` : `<span>${esc(item.title)}</span>`}</li>`).join('')}</ol><small>数据来自第三方热榜接口</small>`;
    } catch (error) { target.textContent = `${error.message || '热榜获取失败'}（可切换来源或稍后刷新）`; }
  }
  async function loadQuote(force = false) {
    const widget = getWidget('dailyQuote'); if (!widget) return;
    const now = new Date(), day = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`, text = $('[data-quote-text]'), from = $('[data-quote-from]');
    const renderSource=()=>{if(!from)return;from.innerHTML=widget.config.uuid?`<a href="https://hitokoto.cn/?uuid=${encodeURIComponent(widget.config.uuid)}" target="_blank" rel="noopener">${esc(widget.config.from||'查看出处')}</a>`:esc(widget.config.from||'');};
    if (!force && widget.config.day === day && widget.config.text) { if (text) text.textContent = widget.config.text; renderSource(); return; }
    if (text) text.textContent = '正在加载今日一言…';
    try {
      const response = await fetch('https://v1.hitokoto.cn/?c=i&encode=json'); if (!response.ok) throw new Error('一言服务暂不可用');
      const data = await response.json(); widget.config.day = day; widget.config.text = data.hitokoto || '今日也请保持好奇。'; widget.config.from = [data.from_who, data.from].filter(Boolean).join(' · '); widget.config.uuid=data.uuid||''; save();
      if (text) text.textContent = widget.config.text; renderSource();
    } catch (_) { const fallback = '慢慢来，也是一种前进。'; widget.config.day = day; widget.config.text = fallback; widget.config.from = 'Nova'; widget.config.uuid=''; save(); if (text) text.textContent = fallback; renderSource(); }
  }
  function ensureCategory(name) {
    const s = ensureData(); if (!s.categories.some(item => item.name === name)) s.categories.push({ name, icon: '✦' });
  }
  function addBookmark(site, asApp = false) {
    const s = ensureData(), url = safeUrl(site.url); if (!url) return notify('只支持 http / https 网站地址。');
    if (s.bookmarks.some(bookmark => safeUrl(bookmark.url) === url)) return notify('这个网站已经在书签中。');
    ensureCategory(site.category || '工具');
    const category = site.category || '工具';
    s.bookmarks.push({ id: `bm-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, name: String(site.name || site.title || new URL(url).hostname).slice(0,80), url, category, categories: [category], icon: site.icon || '', home: true, openMode: asApp ? 'webapp' : 'tab', order: s.bookmarks.length });
    save(); app.render?.(); updateCustomIcons(); notify('已添加到书签');
  }
  function renderCalendarDayOpen(event) { if (event.target.closest('.nova-calendar button')) return; }
  function openWebApp(item) {
    const url = safeUrl(item.url); if (!url) return notify('WebApp 地址无效。');
    const s = ensureData();
    let session = s.nova.webApps.find(appItem => appItem.url === url);
    if (!session) { session = { id: `app-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, title: String(item.title || item.name || new URL(url).hostname).slice(0,80), url, iconUrl: safeUrl(item.iconUrl || ''), open: true, minimized: false }; s.nova.webApps.push(session); }
    session.open = true; session.minimized = false; save(); showWebApp(session); renderAppDock();
  }
  function showWebApp(session) {
    const layer = $('#novaWebappLayer'), frame = $('#novaWebFrame'); if (!layer || !frame) return;
    $('#novaWindowTitle').textContent = session.title; frame.src = session.url; layer.hidden = false; layer.dataset.appId = session.id; $('#novaAppDock').hidden = false;
  }
  function renderAppDock() {
    const dock = $('#novaAppDock'), active = ensureData().nova.webApps.filter(item => item.open);
    dock.hidden = active.length === 0;
    dock.innerHTML = active.map(item => `<button type="button" data-app-focus="${esc(item.id)}" class="${item.minimized ? '' : 'active'}">${esc(item.title)}</button><button type="button" class="close-app" data-app-close="${esc(item.id)}" aria-label="关闭${esc(item.title)}">×</button>`).join('');
    dock.querySelectorAll('[data-app-focus]').forEach(button => button.onclick = () => { const item = ensureData().nova.webApps.find(entry => entry.id === button.dataset.appFocus); if (item) { item.minimized = false; save(); showWebApp(item); renderAppDock(); } });
    dock.querySelectorAll('[data-app-close]').forEach(button => button.onclick = () => { const s = ensureData(), item = s.nova.webApps.find(entry => entry.id === button.dataset.appClose); if (item) { item.open = false; item.minimized = true; if ($('#novaWebappLayer').dataset.appId === item.id) $('#novaWebappLayer').hidden = true; save(); renderAppDock(); } });
  }
  function minimizeCurrentApp() {
    const layer = $('#novaWebappLayer'), id = layer.dataset.appId, item = ensureData().nova.webApps.find(entry => entry.id === id);
    if (item) { item.minimized = true; save(); layer.hidden = true; renderAppDock(); }
  }
  function renderPanelSiteForm() { renderPanel('sites'); }
  function bindPanel() {
    $('#novaToolbar').addEventListener('click', event => {
      if (event.target.closest('[data-nova-open]')) panelOpen('widgets');
      if (event.target.closest('[data-nova-minimal]')) toggleMinimal();
      if (event.target.closest('[data-nova-theme]')) toggleTheme();
    });
    $('#novaPanel').addEventListener('click', event => {
      const tab = event.target.closest('[data-nova-tab]'); if (tab) return renderPanel(tab.dataset.novaTab);
      if (event.target.closest('[data-nova-close]')) return panelClose();
      const add = event.target.closest('[data-widget-add]'); if (add) { const def = model.widgets.find(item => item.type === add.dataset.widgetAdd); if (def && !getWidget(def.type)) { const list = ensureData().nova.widgets; list.push({ ...def, id:`widget-${def.type}-${Date.now()}`, enabled:true, order:list.length, config:{...def.config} }); save(); renderPanel('widgets'); renderWidgets(); } return; }
      const remove = event.target.closest('[data-widget-remove]'); if (remove) { const s=ensureData(); s.nova.widgets=s.nova.widgets.filter(item=>item.type!==remove.dataset.widgetRemove); s.nova.widgets.forEach((item,index)=>item.order=index); save(); renderPanel('widgets'); renderWidgets(); return; }
      const wall = event.target.closest('[data-wallpaper]'); if (wall) { const item=model.wallpapers.find(entry=>entry.id===wall.dataset.wallpaper); if(item) setWallpaper({source:item.id==='nebula-local'?'default':'library',kind:'image',value:item.url,libraryId:item.id}); return; }
      if (event.target.closest('[data-wallpaper-random]')) { const choices=model.wallpapers.filter(item=>item.id!==(ensureData().nova.settings.wallpaper?.libraryId)); const item=choices[Math.floor(Math.random()*choices.length)]; if(item) setWallpaper({source:item.id==='nebula-local'?'default':'library',kind:'image',value:item.url,libraryId:item.id}); return; }
      if (event.target.closest('[data-wallpaper-upload]')) { $('#novaMediaFile').click(); return; }
      if (event.target.closest('[data-html-import]')) { $('#novaHtmlFile').click(); return; }
      const site = event.target.closest('[data-site-add]'); if (site) { const item=model.sites.find(entry=>entry.url===site.dataset.siteAdd); if(item) addBookmark(item); return; }
      const engine = event.target.closest('[data-engine-remove]'); if (engine) { const s=ensureData(); s.nova.searchEngines=s.nova.searchEngines.filter(item=>item.id!==engine.dataset.engineRemove); engineOptions(); save(); renderPanel('search'); return; }
    });
    $('#novaPanel').addEventListener('change', event => {
      const s=ensureData();
      if(event.target.id==='novaTranslationEnabled'){s.nova.settings.translationEnabled=event.target.checked;save();}
      if(event.target.id==='novaSuggestionsEnabled'){s.nova.settings.suggestionsEnabled=event.target.checked;save();if(!event.target.checked)$('#novaSuggestions').hidden=true;}
      if(event.target.id==='novaDateFormat'){s.nova.settings.dateFormat=event.target.value;app.refreshClock?.();save();}
      if(event.target.id==='novaWallpaperCategory'){s.nova.settings.wallpaperCategory=event.target.value;save();renderPanel('wallpaper');}
      if(event.target.id==='novaBlur'){s.blur=Number(event.target.value);s.nova.settings.wallpaper.blur=s.blur;applyWallpaper();save();}
      if(event.target.id==='novaShade'){s.shade=Number(event.target.value);s.nova.settings.wallpaper.shade=s.shade/100;applyWallpaper();save();}
    });
    $('#novaPanel').addEventListener('submit', event => {
      if(event.target.id==='novaEngineForm'){event.preventDefault();const data=new FormData(event.target),name=String(data.get('name')||'').trim(),template=String(data.get('template')||'').trim();if(!name||!template.includes('{query}')||!safeUrl(template.replace('{query}','test')))return notify('请填写有效的 https/http 搜索模板，并包含 {query}。');const id=`custom-${Date.now()}`;ensureData().nova.searchEngines.push({id,name,template,icon:name.slice(0,1),builtin:false});engineOptions();save();renderPanel('search');notify('搜索引擎已添加');}
      if(event.target.id==='novaWallpaperUrlForm'){event.preventDefault();const value=safeUrl(new FormData(event.target).get('url'));if(!value)return notify('请输入有效的 http/https 图片或视频链接。');const kind=/\.(mp4|webm|ogg|mov)(?:[?#].*)?$/i.test(value)?'video':'image';setWallpaper({source:'url',kind,value});}
      if(event.target.id==='novaWebappForm'){event.preventDefault();const data=new FormData(event.target),url=safeUrl(data.get('url'));if(!url)return notify('请输入有效的网址。');openWebApp({url,title:String(data.get('title')||new URL(url).hostname)});panelClose();}
    });
  }
  function toggleMinimal() { const s=ensureData(); s.nova.settings.minimalMode=!s.nova.settings.minimalMode; applyAppearance(); save(); if(s.nova.settings.minimalMode) $('#searchInput')?.focus(); }
  function toggleTheme() { const s=ensureData(); s.nova.settings.theme=s.nova.settings.theme==='light'?'dark':'light'; applyAppearance(); save(); }
  function searchUrl(engine, query) { const template=engine?.template || state().engine; return safeUrl(template.replace('{query}', encodeURIComponent(query))) || safeUrl(state().engine + encodeURIComponent(query)); }
  function bindSearch() {
    const select=$('#engine'),input=$('#searchInput'),form=$('#searchForm'); if(!select||!input||!form)return;
    engineOptions();
    select.onchange=()=>{const engine=selectedEngines().find(item=>item.template===select.value);if(engine)setEngine(engine);};
    document.addEventListener('change',event=>{if(event.target.id!=='settingsEngine')return;const engine=selectedEngines().find(item=>item.template.replace('{query}','')===event.target.value);if(engine)setTimeout(()=>setEngine(engine),0);},true);
    input.addEventListener('keydown',event=>{
      if(event.key==='Tab'){const engines=selectedEngines(),current=engines.findIndex(item=>item.template===select.value),step=event.shiftKey?-1:1;event.preventDefault();setEngine(engines[(current+step+engines.length)%engines.length]);}
      if(event.key==='Escape'){if(ensureData().nova.settings.minimalMode){toggleMinimal();event.preventDefault();}$('#novaSuggestions').hidden=true;}
      if(event.key==='ArrowDown'&&!$('#novaSuggestions').hidden){event.preventDefault();$('[data-search-history]',$('#novaSuggestions'))?.focus();}
    });
    input.addEventListener('focus',renderSuggestions); input.addEventListener('input',renderSuggestions);
    $('#novaSuggestions').addEventListener('click',event=>{const button=event.target.closest('[data-search-history]');if(button){input.value=button.dataset.searchHistory;$('#novaSuggestions').hidden=true;input.focus();}});
    document.addEventListener('click',event=>{if(!event.target.closest('#searchForm')&&!event.target.closest('#novaSuggestions'))$('#novaSuggestions').hidden=true;});
    form.addEventListener('submit',event=>{const query=input.value.trim();if(!query)return;addHistory(query);$('#novaSuggestions').hidden=true;},true);
    $('#novaTranslateButton').onclick=()=>{const query=input.value.trim();if(!query)return input.focus();const url=`https://translate.google.com/?sl=auto&tl=zh-CN&text=${encodeURIComponent(query)}&op=translate`;window.open(url,'_blank','noopener');};
  }
  function populateBookmarkExtras() {
    const select=$('#novaBookmarkCategories'), name=$('#bookmarkName')?.value, rawUrl=$('#bookmarkUrl')?.value;
    if(!select)return;
    select.innerHTML=ensureData().categories.map(category=>`<option value="${esc(category.name)}">${esc(category.name)}</option>`).join('');
    const url=safeUrl(rawUrl), bookmark=ensureData().bookmarks.find(item=>url && safeUrl(item.url)===url);
    const selected=new Set(bookmark?.categories || (bookmark?.category?[bookmark.category]:[]));
    [...select.options].forEach(option=>option.selected=selected.has(option.value));
    const iconInput=$('#novaBookmarkIconUrl'); if(iconInput)iconInput.value=bookmark?.iconUrl||'';
    const asApp=$('#novaBookmarkAsApp'); if(asApp)asApp.checked=bookmark?.openMode==='webapp';
  }
  function bindBookmarks() {
    const form=$('#bookmarkForm'),overlay=$('#bookmarkOverlay');
    if(!form)return;
    const observer=new MutationObserver(populateBookmarkExtras); if(overlay)observer.observe(overlay,{attributes:true,attributeFilter:['class']});
    $('#bookmarkUrl')?.addEventListener('input',populateBookmarkExtras);
    form.addEventListener('submit',()=>{
      const extras={url:safeUrl($('#bookmarkUrl')?.value),category:$('#bookmarkCategory')?.value,categories:[...($('#novaBookmarkCategories')?.selectedOptions||[])].map(option=>option.value),iconUrl:safeUrl($('#novaBookmarkIconUrl')?.value),openMode:$('#novaBookmarkAsApp')?.checked?'webapp':'tab'};
      setTimeout(()=>{
        const s=ensureData(),bookmark=s.bookmarks.find(item=>extras.url&&safeUrl(item.url)===extras.url); if(!bookmark)return;
        if(extras.category&&!extras.categories.includes(extras.category))extras.categories.unshift(extras.category);
        bookmark.categories=[...new Set(extras.categories.length?extras.categories:(extras.category?[extras.category]:[]))];
        bookmark.category=extras.category||bookmark.category||bookmark.categories[0]||'工具';
        bookmark.iconUrl=extras.iconUrl||''; bookmark.openMode=extras.openMode;
        save(); app.render?.(); updateCustomIcons();
      },0);
    },true);
    const grid=$('#bookmarkGrid');
    if(grid){
      grid.addEventListener('contextmenu',event=>{const card=event.target.closest('.bookmark');if(card)contextBookmarkIndex=Number(card.dataset.index);},true);
      grid.addEventListener('click',event=>{const link=event.target.closest('.bookmark-link');if(!link)return;const card=link.closest('.bookmark'),bookmark=ensureData().bookmarks[Number(card?.dataset.index)];if(bookmark?.openMode==='webapp'){event.preventDefault();event.stopPropagation();openWebApp(bookmark);}},true);
      grid.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('application/x-ziyou-bookmark')){const card=event.target.closest('.bookmark');if(card)event.preventDefault();}},true);
      grid.addEventListener('drop',event=>{const card=event.target.closest('.bookmark'),sourceValue=event.dataTransfer.getData('application/x-ziyou-bookmark');if(!card||!/^\d+$/.test(sourceValue))return;const source=Number(sourceValue),target=Number(card.dataset.index),list=ensureData().bookmarks;if(source===target||!list[source]||!list[target])return;event.preventDefault();event.stopPropagation();const [moved]=list.splice(source,1);list.splice(source<target?target-1:target,0,moved);list.forEach((item,index)=>item.order=index);save();app.render?.();renderWidgets();},true);
    }
    const contextMenu=$('#bookmarkContextMenu');
    if(contextMenu){
      const addWebAppAction=()=>{const openButton=$('[data-context-action="open"]',contextMenu);if(!openButton||$('[data-nova-webapp]',contextMenu))return;const button=document.createElement('button');button.type='button';button.className='context-item';button.dataset.contextAction='webapp';button.dataset.novaWebapp='true';button.innerHTML='<span class="context-icon">▣</span><span>内嵌窗口打开</span>';openButton.after(button);};
      new MutationObserver(addWebAppAction).observe(contextMenu,{childList:true});
      contextMenu.addEventListener('click',event=>{const button=event.target.closest('[data-nova-webapp]');if(!button)return;event.preventDefault();event.stopPropagation();const bookmark=ensureData().bookmarks[contextBookmarkIndex];if(!bookmark)return;bookmark.openMode='webapp';save();contextMenu.classList.remove('open');contextMenu.setAttribute('aria-hidden','true');openWebApp(bookmark);});
    }
    const categorySelect=$('#bookmarkCategory');
    if(categorySelect){categorySelect.addEventListener('change',()=>populateBookmarkExtras());}
    const iconObserver=new MutationObserver(updateCustomIcons);if(grid)iconObserver.observe(grid,{childList:true,subtree:true});const dock=$('#dockBookmarks');if(dock)iconObserver.observe(dock,{childList:true,subtree:true});
  }
  function updateCustomIcons() {
    document.querySelectorAll('.bookmark[data-index],.dock-bookmark[data-index]').forEach(card=>{
      const bookmark=ensureData().bookmarks[Number(card.dataset.index)],url=safeUrl(bookmark?.iconUrl);if(!url)return;
      const box=$('.favicon',card);if(!box)return;let image=$('img',box);if(!image){image=document.createElement('img');image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';box.append(image);}image.src=url;
    });
  }
  function setWallpaper(config) {
    const s=ensureData();s.nova.settings.wallpaper={...(s.nova.settings.wallpaper||{}),...config};s.wallpaper='';
    if(config.blur!==undefined)s.blur=config.blur;if(config.shade!==undefined)s.shade=Math.round(config.shade*100);
    save();applyWallpaper();if(!$('#novaPanel').hidden)renderPanel('wallpaper');notify('壁纸已应用');
  }
  async function applyWallpaper() {
    const s=ensureData(),config=s.nova.settings.wallpaper||{},wall=$('#wallpaper');if(!wall)return;
    const videoExisting=$('video.nova-wall-video',wall);if(videoExisting)videoExisting.remove();
    let source=config.value||'';
    if(config.source==='indexeddb'&&config.assetId&&root.NovaAssets){try{const blob=await root.NovaAssets.get(config.assetId);if(blob){if(wallpaperBlobUrl)URL.revokeObjectURL(wallpaperBlobUrl);wallpaperBlobUrl=URL.createObjectURL(blob);source=wallpaperBlobUrl;}}catch(_) {}}
    if(!source)source=s.wallpaper||'galaxy.jpg';
    const style=document.documentElement.style;
    style.setProperty('--wall-blur',`${Number(s.blur??config.blur)||0}px`);style.setProperty('--shade',String(Math.max(0,Math.min(80,Number(s.shade??34)))/100));
    if(config.kind==='video'&&source){wall.style.backgroundImage='none';let video=$('video.nova-wall-video',wall);if(!video){video=document.createElement('video');video.className='nova-wall-video';video.muted=true;video.loop=true;video.autoplay=true;video.playsInline=true;video.setAttribute('aria-hidden','true');wall.append(video);}video.src=source;video.play().catch(()=>{});}
    else wall.style.backgroundImage=`url("${source.replace(/["\\]/g,'')}")`;
    const preview=$('[data-preview]');if(preview)preview.style.backgroundImage=wall.style.backgroundImage;
  }
  function bindFiles() {
    $('#importFile')?.addEventListener('change', () => setTimeout(() => { ensureData(); renderWidgets(); renderAppDock(); engineOptions(); applyWallpaper(); }, 0));
    $('#novaMediaFile').addEventListener('change',async event=>{
      const file=event.target.files?.[0];event.target.value='';if(!file)return;
      if(!/^image\//.test(file.type)&&!/^video\/(mp4|webm|ogg|quicktime)$/.test(file.type))return notify('请选择图片或常见视频文件。');
      if(file.size>50*1024*1024)return notify('文件超过 50 MB，请压缩后再试。');
      if(!root.NovaAssets)return notify('本地媒体存储不可用。');
      try{const id=`wallpaper-${Date.now()}`;await root.NovaAssets.put(id,file);const s=ensureData();s.nova.settings.wallpaper={source:'indexeddb',kind:file.type.startsWith('video/')?'video':'image',assetId:id,value:'',libraryId:''};s.wallpaper='';save();await applyWallpaper();panelClose();notify('已应用本地壁纸；文件不会上传。');}catch(error){notify(error.message||'无法保存这个文件。');}
    });
    $('#novaHtmlFile').addEventListener('change',event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;const reader=new FileReader();reader.onload=()=>importBookmarksHtml(String(reader.result||''));reader.onerror=()=>notify('无法读取这个 HTML 文件。');reader.readAsText(file);});
  }
  function importBookmarksHtml(html) {
    const doc=new DOMParser().parseFromString(html,'text/html'),s=ensureData(),rootDl=doc.querySelector('dl');if(!rootDl)return notify('没有找到浏览器书签目录。');
    let added=0;
    function visit(dl,path=[]) {
      for(const dt of [...dl.children].filter(node=>node.tagName==='DT')) {
        const folder=[...dt.children].find(node=>node.tagName==='H3'), link=[...dt.children].find(node=>node.tagName==='A'), childDl=[...dt.children].find(node=>node.tagName==='DL');
        if(folder&&childDl){visit(childDl,[...path,folder.textContent.trim()].filter(Boolean));continue;}
        if(!link)continue;
        const url=safeUrl(link.getAttribute('href'));if(!url)continue;
        if(s.bookmarks.some(item=>safeUrl(item.url)===url))continue;
        const pathNames=path.length?path:['导入书签'];pathNames.forEach(name=>ensureCategory(name));const category=pathNames[pathNames.length-1],name=(link.textContent||new URL(url).hostname).trim().slice(0,80);
        s.bookmarks.push({id:`bm-${Date.now()}-${added}`,name,url,category,categories:[...pathNames],icon:'',home:false,openMode:'tab',order:s.bookmarks.length});added++;
      }
    }
    visit(rootDl);save();app.render?.();updateCustomIcons();notify(added?`已导入 ${added} 个新书签（重复项已跳过）。`:'没有可导入的新 http/https 书签。');
  }
  function bindWindow() {
    $('#novaWebappLayer').addEventListener('click',event=>{if(event.target.id==='novaWebappLayer')minimizeCurrentApp();});
    $('[data-window-close]').onclick=()=>{const layer=$('#novaWebappLayer'),id=layer.dataset.appId,item=ensureData().nova.webApps.find(entry=>entry.id===id);if(item){item.open=false;item.minimized=true;}layer.hidden=true;save();renderAppDock();};
    $('[data-window-minimize]').onclick=minimizeCurrentApp;
    $('[data-window-newtab]').onclick=()=>{const url=$('#novaWebFrame').src;if(safeUrl(url))window.open(url,'_blank','noopener');};
    $('[data-window-fullscreen]').onclick=()=>{const layer=$('#novaWebappLayer');if(layer.requestFullscreen)layer.requestFullscreen().catch(()=>notify('浏览器未允许全屏。'));};
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!$('#novaPanel').hidden)panelClose();else if(!$('#novaWebappLayer').hidden)minimizeCurrentApp();}});
  }
  function bindBookmarkExtras() { $('#novaBookmarkCategories')?.addEventListener('change',()=>{}); }
  function init() {
    ensureMarkup();addStyles();ensureData();applyAppearance();bindPanel();bindSearch();bindBookmarks();bindFiles();bindWindow();bindBookmarkExtras();
    $('#novaToolbar').addEventListener('click',event=>{if(event.target.closest('[data-nova-open]'))renderPanel('widgets');});
    $('#novaPanel').addEventListener('click',event=>{const target=event.target.closest('[data-nova-minimal]');if(target)toggleMinimal();const theme=event.target.closest('[data-nova-theme]');if(theme)toggleTheme();});
    $('#novaPanel').addEventListener('click',event=>{const button=event.target.closest('[data-widget-add],[data-widget-remove]');if(button)renderWidgets();});
    $('#novaPanel').addEventListener('submit',event=>{if(event.target.id==='novaEngineForm'||event.target.id==='novaWallpaperUrlForm'||event.target.id==='novaWebappForm')setTimeout(()=>{if(!$('#novaPanel').hidden)renderPanel(event.target.id==='novaEngineForm'?'search':event.target.id==='novaWallpaperUrlForm'?'wallpaper':'sites');},20);});
    renderWidgets();renderAppDock();applyWallpaper();engineOptions();populateBookmarkExtras();updateCustomIcons();
    for(const widget of ensureData().nova.widgets){if(widget.enabled===false)continue;if(widget.type==='weather'&&(widget.config.city||widget.config.latitude!=null))fetchWeather(widget);if(widget.type==='hotlist')loadHotlist(widget);if(widget.type==='dailyQuote')loadQuote(false);}
    root.addEventListener('nova-state-change',()=>{ensureData();applyAppearance();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
