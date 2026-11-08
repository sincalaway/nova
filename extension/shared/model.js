(function (root) {
  'use strict';
  const engines = [
    { id: 'bing', name: 'Bing', template: 'https://www.bing.com/search?q={query}', icon: 'b', builtin: true },
    { id: 'google', name: 'Google', template: 'https://www.google.com/search?q={query}', icon: 'G', builtin: true },
    { id: 'baidu', name: '百度', template: 'https://www.baidu.com/s?wd={query}', icon: '百', builtin: true },
    { id: 'sogou', name: '搜狗', template: 'https://www.sogou.com/web?query={query}', icon: '搜', builtin: true },
    { id: 'duckduckgo', name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q={query}', icon: 'd', builtin: true }
  ];
  const widgets = [
    { id: 'widget-notes', type: 'notes', enabled: true, order: 0, config: { text: '', preview: false } },
    { id: 'widget-weather', type: 'weather', enabled: true, order: 1, config: { city: '', latitude: null, longitude: null } },
    { id: 'widget-hotlist', type: 'hotlist', enabled: true, order: 2, config: { source: 'baidu' } },
    { id: 'widget-calendar', type: 'calendar', enabled: true, order: 3, config: {} },
    { id: 'widget-quote', type: 'dailyQuote', enabled: true, order: 4, config: { day: '', text: '', from: '' } }
  ];
  const wallpapers = [
    { id: 'nebula-local', name: '星云（内置）', category: '星空', url: 'galaxy.jpg', credit: '项目内置图片' },
    { id: 'alpine-lake', name: '山湖晨光', category: '自然', url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2200&q=85', credit: 'Unsplash' },
    { id: 'golden-field', name: '金色原野', category: '自然', url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=2200&q=85', credit: 'Unsplash' },
    { id: 'mountain-range', name: '山脉', category: '自然', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2200&q=85', credit: 'Unsplash' },
    { id: 'night-sky', name: '蓝调夜色', category: '夜景', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=2200&q=85', credit: 'Unsplash' },
    { id: 'ocean-blue', name: '海岸线', category: '海洋', url: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=2200&q=85', credit: 'Unsplash' }
  ];
  const sites = [
    { name: 'Google', url: 'https://www.google.com', category: '工具', icon: 'G' },
    { name: 'Bing', url: 'https://www.bing.com', category: '工具', icon: 'b' },
    { name: '百度', url: 'https://www.baidu.com', category: '工具', icon: '百' },
    { name: 'GitHub', url: 'https://github.com', category: '开发', icon: 'GH' },
    { name: 'Gmail', url: 'https://mail.google.com', category: '邮件', icon: 'M' },
    { name: 'YouTube', url: 'https://www.youtube.com', category: '影音', icon: '▶' },
    { name: '知乎', url: 'https://www.zhihu.com', category: '资讯', icon: '知' },
    { name: '微博', url: 'https://weibo.com', category: '资讯', icon: '微' },
    { name: 'Notion', url: 'https://www.notion.so', category: '工具', icon: 'N' },
    { name: 'Figma', url: 'https://www.figma.com', category: '开发', icon: 'F' },
    { name: 'ChatGPT', url: 'https://chatgpt.com', category: 'AI', icon: '✳' },
    { name: 'DeepSeek', url: 'https://chat.deepseek.com', category: 'AI', icon: 'DS' }
  ];
  const defaultNova = () => ({
    version: 2,
    settings: { theme: 'dark', minimalMode: false, dateFormat: 'full', wallpaperCategory: '全部', translationEnabled: true, suggestionsEnabled: true, searchEngineId: 'bing', wallpaper: { source: 'default', kind: 'image', value: '', blur: 0, shade: 0.34 } },
    searchEngines: engines.map(item => ({ ...item })),
    searchHistory: [],
    widgets: widgets.map(item => ({ ...item, config: { ...item.config } })),
    webApps: []
  });
  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }
  function normalize(state) {
    if (!state || typeof state !== 'object') state = {};
    if (!Array.isArray(state.bookmarks)) state.bookmarks = [];
    if (!Array.isArray(state.categories)) state.categories = [];
    if (!state.categories.length) state.categories = [
      { name: '工具', icon: '🧰' }, { name: '开发', icon: '⌘' }, { name: '邮件', icon: '✉' },
      { name: '资讯', icon: '▤' }, { name: 'AI', icon: '✦' }, { name: '影音', icon: '▶' }
    ];
    state.schemaVersion = 2;
    const base = defaultNova();
    const old = state.nova && typeof state.nova === 'object' ? state.nova : {};
    state.nova = {
      ...base,
      ...old,
      version: 2,
      settings: { ...base.settings, ...(old.settings || {}) },
      searchEngines: Array.isArray(old.searchEngines) ? old.searchEngines : base.searchEngines,
      searchHistory: Array.isArray(old.searchHistory) ? old.searchHistory.slice(0, 30) : [],
      widgets: Array.isArray(old.widgets) ? old.widgets.map(item => ({ ...item, config: { ...(item.config || {}) } })) : base.widgets,
      webApps: Array.isArray(old.webApps) ? old.webApps : []
    };
    state.nova.searchEngines = state.nova.searchEngines.filter(engine => engine && engine.name && engine.template && engine.template.includes('{query}') && safeHttpUrl(engine.template.replace('{query}', 'test')));
    const legacyEngine = String(state.engine || '');
    if (legacyEngine && !state.nova.searchEngines.some(engine => engine.template.replace('{query}', '') === legacyEngine)) {
      const template = legacyEngine.includes('{query}') ? legacyEngine : `${legacyEngine}{query}`;
      if (safeHttpUrl(template.replace('{query}', 'test'))) state.nova.searchEngines.push({ id: `legacy-${Date.now()}`, name: '旧版自定义搜索', template, icon: '搜', builtin: false });
    }
    const notes = state.nova.widgets.find(widget => widget.type === 'notes');
    if (notes && typeof state.note === 'string' && !notes.config.text) notes.config.text = state.note;
    for (const bookmark of state.bookmarks) {
      if (!bookmark || typeof bookmark !== 'object') continue;
      if (!Array.isArray(bookmark.categories)) bookmark.categories = bookmark.category ? [bookmark.category] : [];
      if (bookmark.category && !bookmark.categories.includes(bookmark.category)) bookmark.categories.unshift(bookmark.category);
    }
    return state;
  }
  root.NovaModel = { engines, widgets, wallpapers, sites, defaultNova, normalize, safeHttpUrl };
})(typeof window !== 'undefined' ? window : globalThis);
