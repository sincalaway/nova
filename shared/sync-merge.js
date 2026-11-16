(function (root) {
  'use strict';

  function mergeById(first, second, getId, mergeRecord = (earlier, later) => ({ ...earlier, ...later })) {
    const records = new Map();
    for (const item of Array.isArray(first) ? first : []) {
      if (item == null) continue;
      const id = getId(item);
      if (id != null && id !== '') records.set(id, item);
    }
    for (const item of Array.isArray(second) ? second : []) {
      if (item == null) continue;
      const id = getId(item);
      if (id == null || id === '') continue;
      records.set(id, records.has(id) ? mergeRecord(records.get(id), item) : item);
    }
    return [...records.values()];
  }

  function canonicalUrl(value) {
    try { return new URL(value).href.replace(/\/$/, '').toLowerCase(); }
    catch (_) { return String(value || '').toLowerCase(); }
  }

  function mergeRecords(earlier, later) {
    return { ...earlier, ...later, ...(earlier?.config || later?.config ? { config: { ...(earlier?.config || {}), ...(later?.config || {}) } } : {}) };
  }

  function mergeStates(remote = {}, local = {}) {
    const merged = { ...local, ...remote };
    const bookmarks = new Map();
    for (const item of [...(remote.bookmarks || []), ...(local.bookmarks || [])]) {
      if (item?.url && !bookmarks.has(canonicalUrl(item.url))) bookmarks.set(canonicalUrl(item.url), item);
    }
    merged.bookmarks = [...bookmarks.values()];
    const categories = new Map();
    for (const item of [...(remote.categories || []), ...(local.categories || [])]) {
      if (item?.name && !categories.has(item.name)) categories.set(item.name, item);
    }
    merged.categories = [...categories.values()];

    const remoteNova = remote.nova || {}, localNova = local.nova || {};
    merged.nova = {
      ...localNova,
      ...remoteNova,
      settings: { ...(remoteNova.settings || {}), ...(localNova.settings || {}) }
    };
    merged.nova.widgets = mergeById(remoteNova.widgets, localNova.widgets, item => item.type || item.id, mergeRecords);
    merged.nova.todos = mergeById(remoteNova.todos, localNova.todos, item => item.id, mergeRecords);
    merged.nova.searchEngines = mergeById(remoteNova.searchEngines, localNova.searchEngines, item => item.id, mergeRecords);
    merged.nova.searchHistory = mergeById(remoteNova.searchHistory, localNova.searchHistory, item => String(item), (_earlier, later) => later).slice(0, 20);
    merged.nova.webApps = mergeById(remoteNova.webApps, localNova.webApps, item => item.id, mergeRecords);

    const remoteTools = remoteNova.tools || {}, localTools = localNova.tools || {};
    const remoteBoard = remoteTools.whiteboard || {}, localBoard = localTools.whiteboard || {};
    const strokes = mergeById(remoteBoard.strokes, localBoard.strokes, item => item.id || JSON.stringify(item));
    merged.nova.tools = {
      ...remoteTools,
      ...localTools,
      whiteboard: { ...remoteBoard, ...localBoard, strokes: strokes.slice(-150) }
    };
    return root.NovaModel?.normalize(merged) || merged;
  }

  root.NovaSyncMerge = { mergeById, mergeStates };
})(window);
