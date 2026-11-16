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

  function mergeCurrentFirst(currentItems, incomingItems, getId) {
    const result = (Array.isArray(currentItems) ? currentItems : []).map(item => item && typeof item === 'object' ? { ...item, ...(Array.isArray(item.config) ? { config: [...item.config] } : {}), ...(Array.isArray(item.categories) ? { categories: [...item.categories] } : {}) } : item);
    const indexes = new Map();
    result.forEach((item, index) => {
      if (item == null) return;
      const id = getId(item);
      if (id != null && id !== '' && !indexes.has(id)) indexes.set(id, index);
    });
    for (const item of Array.isArray(incomingItems) ? incomingItems : []) {
      if (item == null) continue;
      const id = getId(item);
      if (id != null && id !== '' && indexes.has(id)) {
        const index = indexes.get(id);
        if (typeof item === 'object' && typeof result[index] === 'object') result[index] = mergeRecords(item, result[index]);
      } else {
        const next = typeof item === 'object'
          ? { ...item, ...(Array.isArray(item.config) ? { config: [...item.config] } : {}), ...(Array.isArray(item.categories) ? { categories: [...item.categories] } : {}) }
          : item;
        result.push(next);
        if (id != null && id !== '') indexes.set(id, result.length - 1);
      }
    }
    return result;
  }

  function mergeImportedState(currentState = {}, incomingState = {}) {
    const current = JSON.parse(JSON.stringify(currentState || {}));
    const incoming = JSON.parse(JSON.stringify(incomingState || {}));
    const merged = { ...incoming, ...current };
    for (const [key, value] of Object.entries(incoming)) {
      if ((merged[key] == null || merged[key] === '') && value != null && value !== '') merged[key] = value;
    }

    const localBookmarks = Array.isArray(current.bookmarks) ? current.bookmarks : [];
    const bookmarks = localBookmarks.map(item => item && typeof item === 'object' ? { ...item, ...(Array.isArray(item.categories) ? { categories: [...item.categories] } : {}) } : item);
    const localBookmarkIndex = new Map();
    bookmarks.forEach((item, index) => {
      if (item?.url && !localBookmarkIndex.has(canonicalUrl(item.url))) localBookmarkIndex.set(canonicalUrl(item.url), index);
    });
    for (const item of Array.isArray(incoming.bookmarks) ? incoming.bookmarks : []) {
      if (!item || typeof item !== 'object') continue;
      const key = item.url ? canonicalUrl(item.url) : '';
      if (key && localBookmarkIndex.has(key)) {
        const index = localBookmarkIndex.get(key);
        bookmarks[index] = mergeRecords(item, bookmarks[index]);
      } else {
        bookmarks.push({ ...item, ...(Array.isArray(item.categories) ? { categories: [...item.categories] } : {}) });
      }
    }
    merged.bookmarks = bookmarks;

    const currentCategories = Array.isArray(current.categories) ? current.categories : [];
    const categories = currentCategories.map(item => item && typeof item === 'object' ? { ...item } : item);
    const categoryIndexes = new Map();
    categories.forEach((item, index) => { if (item?.name && !categoryIndexes.has(item.name)) categoryIndexes.set(item.name, index); });
    for (const item of Array.isArray(incoming.categories) ? incoming.categories : []) {
      if (!item?.name) continue;
      if (categoryIndexes.has(item.name)) {
        const index = categoryIndexes.get(item.name);
        categories[index] = mergeRecords(item, categories[index]);
      } else {
        categoryIndexes.set(item.name, categories.length);
        categories.push({ ...item });
      }
    }
    merged.categories = categories;

    const currentNova = current.nova || {}, incomingNova = incoming.nova || {};
    const currentTodos = Array.isArray(currentNova.todos) ? currentNova.todos : current.todos;
    const incomingTodos = Array.isArray(incomingNova.todos) ? incomingNova.todos : incoming.todos;
    const currentTools = currentNova.tools || {}, incomingTools = incomingNova.tools || {};
    const currentBoard = currentTools.whiteboard || {}, incomingBoard = incomingTools.whiteboard || {};
    merged.nova = {
      ...incomingNova,
      ...currentNova,
      settings: { ...(incomingNova.settings || {}), ...(currentNova.settings || {}) },
      widgets: mergeCurrentFirst(currentNova.widgets, incomingNova.widgets, item => item.type || item.id),
      todos: mergeCurrentFirst(currentTodos, incomingTodos, item => item.id),
      searchEngines: mergeCurrentFirst(currentNova.searchEngines, incomingNova.searchEngines, item => item.id),
      searchHistory: mergeCurrentFirst(currentNova.searchHistory, incomingNova.searchHistory, item => String(item)).slice(0, 30),
      webApps: mergeCurrentFirst(currentNova.webApps, incomingNova.webApps, item => item.id),
      tools: {
        ...incomingTools,
        ...currentTools,
        whiteboard: {
          ...incomingBoard,
          ...currentBoard,
          strokes: mergeCurrentFirst(currentBoard.strokes, incomingBoard.strokes, item => item.id || JSON.stringify(item)).slice(-150)
        }
      }
    };
    if (Array.isArray(current.todos) || Array.isArray(incoming.todos)) merged.todos = mergeCurrentFirst(current.todos, incoming.todos, item => item.id);
    if (!merged.note && incoming.note) merged.note = incoming.note;
    return root.NovaModel?.normalize(merged) || merged;
  }

  root.NovaSyncMerge = { mergeById, mergeStates, mergeImportedState };
})(window);
