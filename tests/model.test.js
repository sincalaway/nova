import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../shared/model.js');
await import('../shared/sync-merge.js');
const { NovaModel } = globalThis;
const { NovaSyncMerge } = globalThis;

test('legacy state preserves user data and exposes new disabled cards', () => {
  const state = {
    bookmarks: [{ name: 'Example', url: 'https://example.com', category: '工具' }],
    categories: [{ name: '工具', icon: '🧰' }],
    note: 'legacy note',
    todos: [{ id: 'legacy-todo', text: '保留旧待办', done: false }],
    nova: {
      settings: { theme: 'light', minimalMode: true },
      widgets: [
        { id: 'my-notes', type: 'notes', enabled: true, order: 8, config: { text: '保留笔记', preview: true } },
        { id: 'my-weather', type: 'weather', enabled: false, order: 9, config: { city: 'Buffalo' } },
        { id: 'custom-widget', type: 'custom', enabled: true, order: 10, config: { customValue: 42 } }
      ],
      tools: { whiteboard: { strokes: [{ id: 'stroke-1', color: '#000000', width: 3, points: [[0.1, 0.2]] }] } }
    }
  };

  const normalized = NovaModel.normalize(state);
  assert.equal(normalized.bookmarks[0].url, 'https://example.com');
  assert.equal(normalized.nova.settings.theme, 'light');
  assert.equal(normalized.nova.settings.minimalMode, true);
  assert.equal(normalized.nova.widgets.find(item => item.type === 'notes').config.text, '保留笔记');
  assert.equal(normalized.nova.widgets.find(item => item.type === 'notes').order, 8);
  assert.equal(normalized.nova.widgets.find(item => item.type === 'weather').enabled, false);
  assert.ok(normalized.nova.widgets.some(item => item.type === 'countdown' && item.enabled === false));
  assert.ok(normalized.nova.widgets.some(item => item.type === 'anniversary' && item.enabled === false));
  assert.ok(normalized.nova.widgets.some(item => item.type === 'todo' && item.enabled === false));
  assert.ok(normalized.nova.widgets.some(item => item.id === 'custom-widget'));
  assert.equal(normalized.nova.todos[0].text, '保留旧待办');
  assert.equal(normalized.nova.tools.whiteboard.strokes[0].id, 'stroke-1');
});

test('normalization is idempotent and does not duplicate widget cards', () => {
  const state = NovaModel.normalize({ bookmarks: [], categories: [] });
  const firstTypes = state.nova.widgets.map(item => item.type);
  const secondTypes = NovaModel.normalize(state).nova.widgets.map(item => item.type);
  assert.deepEqual(secondTypes, firstTypes);
  assert.equal(new Set(secondTypes).size, secondTypes.length);
});

test('safe URL helper rejects executable and non-HTTP schemes', () => {
  assert.equal(NovaModel.safeHttpUrl('javascript:alert(1)'), '');
  assert.equal(NovaModel.safeHttpUrl('data:text/html,<script>1</script>'), '');
  assert.equal(NovaModel.safeHttpUrl('https://example.com/'), 'https://example.com/');
});

test('cloud merge preserves existing policy while joining device-specific edits', () => {
  const stroke = (id, x) => ({ id, color: '#111111', width: 2, points: [[x, 0.2]] });
  const remote = {
    bookmarks: [{ name: '云端名称', url: 'https://example.com/' }],
    categories: [{ name: '云端分类' }],
    nova: {
      settings: { theme: 'dark', language: 'zh-CN' },
      widgets: [{ id: 'remote-note', type: 'notes', enabled: true, order: 1, config: { text: '云端文本', preview: true } }],
      todos: [{ id: 'same-todo', text: '云端待办', done: false }],
      searchEngines: [{ id: 'remote-search', name: '云端搜索', template: 'https://remote.example/?q={query}' }],
      webApps: [{ id: 'remote-app', title: '云端应用', url: 'https://cloud.example/' }],
      searchHistory: ['remote query'],
      tools: { whiteboard: { strokes: [stroke('remote-stroke', 0.1), stroke('shared-stroke', 0.3)] } }
    }
  };
  const local = {
    bookmarks: [{ name: '本机名称', url: 'https://example.com' }, { name: '本机书签', url: 'https://local.example/' }],
    categories: [{ name: '本机分类' }],
    nova: {
      settings: { theme: 'light', minimalMode: true },
      widgets: [{ id: 'local-note', type: 'notes', enabled: false, order: 4, config: { text: '本机文本', customColor: '#abc' } }],
      todos: [{ id: 'same-todo', text: '本机待办', done: true }, { id: 'local-todo', text: '新待办', done: false }],
      searchEngines: [{ id: 'local-search', name: '本机搜索', template: 'https://local.example/?q={query}' }],
      webApps: [{ id: 'local-app', title: '本机应用', url: 'https://local.example/' }],
      searchHistory: ['local query'],
      tools: { whiteboard: { strokes: [stroke('local-stroke', 0.5), stroke('shared-stroke', 0.8)] } }
    }
  };

  const merged = NovaSyncMerge.mergeStates(remote, local);
  assert.equal(merged.bookmarks.find(item => item.url.includes('example.com')).name, '云端名称');
  assert.ok(merged.bookmarks.some(item => item.name === '本机书签'));
  assert.deepEqual(merged.categories.map(item => item.name), ['云端分类', '本机分类']);
  assert.equal(merged.nova.settings.theme, 'light');
  assert.equal(merged.nova.settings.language, 'zh-CN');
  assert.equal(merged.nova.settings.minimalMode, true);
  const note = merged.nova.widgets.find(item => item.type === 'notes');
  assert.equal(note.enabled, false);
  assert.equal(note.config.text, '本机文本');
  assert.equal(note.config.preview, true);
  assert.equal(note.config.customColor, '#abc');
  assert.equal(merged.nova.todos.find(item => item.id === 'same-todo').text, '本机待办');
  assert.equal(merged.nova.todos.find(item => item.id === 'same-todo').done, true);
  assert.ok(merged.nova.searchEngines.some(item => item.id === 'remote-search'));
  assert.ok(merged.nova.searchEngines.some(item => item.id === 'local-search'));
  assert.ok(merged.nova.webApps.some(item => item.id === 'remote-app'));
  assert.ok(merged.nova.webApps.some(item => item.id === 'local-app'));
  assert.equal(merged.nova.tools.whiteboard.strokes.filter(item => item.id === 'shared-stroke').length, 1);
  assert.ok(merged.nova.tools.whiteboard.strokes.some(item => item.id === 'local-stroke'));
});

test('backup import adds missing data without overwriting current bookmarks or settings', () => {
  const current = {
    bookmarks: [{ name: '本机名称', url: 'https://example.com/', category: '本机分类', home: true, layout: '2x2' }],
    categories: [{ name: '本机分类', icon: '★' }],
    nova: {
      settings: { theme: 'light', customSetting: 'keep' },
      widgets: [{ id: 'local-note', type: 'notes', enabled: true, order: 0, config: { text: '本机笔记', preview: true, localOnly: true } }],
      todos: [{ id: 'todo-1', text: '本机待办', done: true }],
      searchHistory: ['本机查询'],
      tools: { whiteboard: { strokes: [{ id: 'local-stroke', points: [[0.1, 0.2]] }] } }
    }
  };
  const incoming = {
    bookmarks: [
      { name: '备份名称', url: 'https://example.com', category: '备份分类', home: false },
      { name: '新书签', url: 'https://new.example/', category: '备份分类' }
    ],
    categories: [{ name: '本机分类', icon: '备份图标' }, { name: '备份分类', icon: '✦' }],
    nova: {
      settings: { theme: 'dark', importedSetting: 'available' },
      widgets: [{ id: 'backup-note', type: 'notes', enabled: false, order: 4, config: { text: '备份笔记', importedOnly: true } }],
      todos: [{ id: 'todo-1', text: '备份待办', done: false }, { id: 'todo-2', text: '新待办', done: false }],
      searchHistory: ['备份查询'],
      tools: { whiteboard: { strokes: [{ id: 'backup-stroke', points: [[0.8, 0.9]] }] } }
    }
  };
  const originalCurrent = structuredClone(current);
  const originalIncoming = structuredClone(incoming);

  const result = NovaSyncMerge.mergeImportedState(current, incoming);

  assert.equal(result.bookmarks[0].name, '本机名称');
  assert.equal(result.bookmarks[0].home, true);
  assert.equal(result.bookmarks[0].layout, '2x2');
  assert.ok(result.bookmarks.some(item => item.url === 'https://new.example/'));
  assert.deepEqual(result.categories.map(item => item.name), ['本机分类', '备份分类']);
  assert.equal(result.categories[0].icon, '★');
  assert.equal(result.nova.settings.theme, 'light');
  assert.equal(result.nova.settings.customSetting, 'keep');
  assert.equal(result.nova.widgets.find(item => item.type === 'notes').config.text, '本机笔记');
  assert.equal(result.nova.todos.find(item => item.id === 'todo-1').done, true);
  assert.ok(result.nova.todos.some(item => item.id === 'todo-2'));
  assert.ok(result.nova.tools.whiteboard.strokes.some(item => item.id === 'local-stroke'));
  assert.ok(result.nova.tools.whiteboard.strokes.some(item => item.id === 'backup-stroke'));
  assert.deepEqual(current, originalCurrent);
  assert.deepEqual(incoming, originalIncoming);
});
