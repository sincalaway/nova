(function (root) {
  'use strict';
  const CONFIG = root.BOOKMARK_SYNC_CONFIG || {};
  const STORAGE_KEY = 'ziyou.replica.v1';
  const SESSION_KEY = 'nova.extension.auth.v1';
  const META_KEY = 'nova.extension.syncmeta.v1';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  let session = readJson(SESSION_KEY, null), pendingRow = null, timer = 0, suppressSave = false, syncing = false;
  let dialog;

  function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch (_) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function toast(message) { root.NovaApp?.toast?.(message); }
  function configured() { return /^https:\/\//.test(CONFIG.url || '') && Boolean(CONFIG.anonKey); }
  function apiUrl(path) { return `${String(CONFIG.url || '').replace(/\/$/, '')}${path}`; }
  function requestHeaders(token = '') { const headers = { apikey: CONFIG.anonKey, 'Content-Type': 'application/json' }; if (token) headers.Authorization = `Bearer ${token}`; return headers; }
  async function parseResponse(response) {
    let data = null; try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `服务请求失败（HTTP ${response.status}）`);
    return data;
  }
  async function authRequest(path, body) {
    const response = await fetch(apiUrl(`/auth/v1/${path}`), { method: 'POST', headers: requestHeaders(), body: JSON.stringify(body) });
    return parseResponse(response);
  }
  function saveSession(value) {
    session = value && value.access_token ? { ...value, expires_at: value.expires_at || Math.floor(Date.now() / 1000) + Number(value.expires_in || 3600) } : null;
    if (session) writeJson(SESSION_KEY, session); else localStorage.removeItem(SESSION_KEY);
    updateDialog();
  }
  async function refreshSession() {
    if (!session?.refresh_token) throw new Error('登录已过期，请重新登录。');
    if (session.expires_at && Date.now() < (session.expires_at - 60) * 1000) return;
    const renewed = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    saveSession(renewed);
  }
  async function apiFetch(path, options = {}) {
    if (!session) throw new Error('请先登录岁瞬云同步。');
    await refreshSession();
    const response = await fetch(apiUrl(path), { ...options, headers: { ...requestHeaders(session.access_token), ...(options.headers || {}) } });
    if (response.status === 401 && session?.refresh_token) {
      session.expires_at = 0; await refreshSession();
      return fetch(apiUrl(path), { ...options, headers: { ...requestHeaders(session.access_token), ...(options.headers || {}) } }).then(parseResponse);
    }
    return parseResponse(response);
  }
  function currentState() { return root.NovaModel?.normalize(root.NovaApp?.getState?.() || {}) || (root.NovaApp?.getState?.() || {}); }
  function mergeStates(remote, local) {
    if (!root.NovaSyncMerge?.mergeStates) throw new Error('同步合并模块未加载，请刷新扩展页面后重试。');
    return root.NovaSyncMerge.mergeStates(remote, local);
  }
  function cloudPayload() {
    const value = JSON.parse(JSON.stringify(currentState()));
    delete value.wallpaper;
    return value;
  }
  function setStatus(message, kind = '') {
    const status = $('#novaExtSyncStatus', dialog); if (!status) return;
    status.textContent = message; status.dataset.kind = kind;
  }
  function ensureDialog() {
    if (dialog) return dialog;
    const style = document.createElement('style');
    style.textContent = `.nes-overlay{position:fixed;inset:0;z-index:1300;display:grid;place-items:center;padding:14px;background:rgba(3,9,18,.7);backdrop-filter:blur(8px)}.nes-overlay[hidden]{display:none}.nes-card{width:min(470px,100%);max-height:calc(100dvh - 28px);overflow:auto;border-radius:18px;background:#f8fbff;color:#293b4e;box-shadow:0 25px 80px #0006;padding:22px}.nes-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.nes-head h2{margin:0;font-size:19px}.nes-head button{border:0;background:#edf2f7;border-radius:8px;padding:7px 10px;font-size:18px}.nes-status{padding:10px 12px;border-radius:9px;background:#eef5fb;color:#60748a;font-size:11px;line-height:1.6}.nes-status[data-kind=error]{background:#fff0ef;color:#a13d3b}.nes-field{display:grid;gap:5px;margin:12px 0;color:#66778b;font-size:11px}.nes-field input{box-sizing:border-box;width:100%;border:1px solid #d9e1e9;border-radius:9px;padding:10px;background:#fff;color:#25364a}.nes-actions{display:flex;flex-wrap:wrap;gap:8px;margin:13px 0}.nes-actions button,.nes-actions label,.nes-conflict button{border:1px solid #d9e2eb;border-radius:9px;background:#fff;color:#35495e;padding:9px 12px;font-size:11px;cursor:pointer}.nes-actions .primary,.nes-conflict .primary{border-color:#2c84c4;background:#2c84c4;color:white}.nes-foot{color:#77879a;font-size:10px;line-height:1.6}.nes-conflict{padding:13px;border:1px solid #e2e9f0;border-radius:11px;background:#fff}.nes-conflict h3{margin:0 0 6px;font-size:13px}.nes-conflict p{font-size:11px;color:#68788b;line-height:1.6}.nes-conflict button{display:block;width:100%;margin:7px 0;text-align:left}.nes-conflict button.primary{font-weight:700}.nes-backup{display:flex;gap:8px;flex-wrap:wrap;padding-top:10px;border-top:1px solid #e6ebf1}.nes-backup button{border:0;background:transparent;color:#3879aa;padding:7px 0;font-size:10px}.nes-sync-in{padding:12px;border-radius:10px;background:#eef7f0;color:#496a56;font-size:11px}`;
    document.head.append(style);
    dialog = document.createElement('div'); dialog.id = 'novaExtSyncDialog'; dialog.className = 'nes-overlay'; dialog.hidden = true;
    dialog.innerHTML = `<section class="nes-card" role="dialog" aria-modal="true" aria-labelledby="nesTitle"><header class="nes-head"><h2 id="nesTitle">岁瞬云同步</h2><button type="button" data-nes-close aria-label="关闭">×</button></header><p class="nes-status" id="novaExtSyncStatus" role="status"></p><div id="nesAuth"><form id="nesAuthForm"><label class="nes-field">邮箱<input name="email" type="email" autocomplete="email" required></label><label class="nes-field">密码<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><div class="nes-actions"><button class="primary" type="submit" data-nes-action="login">登录并同步</button><button type="button" data-nes-action="signup">创建账号</button></div></form><div class="nes-actions"><button type="button" data-nes-action="reset">忘记密码</button></div></div><div id="nesSignedIn" hidden><div class="nes-sync-in"><strong id="nesEmail"></strong><br>自动同步已连接。</div><div class="nes-actions"><button type="button" data-nes-action="sync">立即同步</button><button type="button" data-nes-action="signout">退出登录</button></div></div><div class="nes-conflict" id="nesConflict" hidden><h3>首次连接：请选择保留方式</h3><p id="nesConflictText">本机与云端都有数据。建议合并，遇到同一网址时优先采用云端版本；删除记录不会被合并恢复。</p><button class="primary" type="button" data-nes-resolution="merge">建议：合并云端与本机数据</button><button type="button" data-nes-resolution="cloud">使用云端数据替换本机</button><button type="button" data-nes-resolution="device">用本机数据覆盖云端</button></div><div class="nes-backup"><button type="button" data-nes-action="export">导出本地 JSON 备份</button><button type="button" data-nes-action="import">导入并合并备份</button><input type="file" accept="application/json,.json" data-nes-file hidden></div><p class="nes-foot">云端保存书签、分类、组件、待办、白板笔迹和设置。输入的统计文本不会保存；本地上传的壁纸原文件不会随云同步上传。只在你登录的账号下读取。</p></section>`;
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-nes-close]')) { dialog.hidden = true; return; }
      const action = event.target.closest('[data-nes-action]')?.dataset.nesAction;
      if (action === 'signup') return signUp();
      if (action === 'reset') return resetPassword();
      if (action === 'sync') return synchronize('manual');
      if (action === 'signout') return signOut();
      if (action === 'export') return exportBackup();
      if (action === 'import') return $('[data-nes-file]', dialog).click();
      const resolution = event.target.closest('[data-nes-resolution]')?.dataset.nesResolution;
      if (resolution) resolveConflict(resolution);
    });
    $('#nesAuthForm', dialog).addEventListener('submit', event => { event.preventDefault(); signIn(new FormData(event.target)); });
    $('[data-nes-file]', dialog).addEventListener('change', importBackup);
    return dialog;
  }
  function updateDialog() {
    if (!dialog) return;
    $('#nesAuth', dialog).hidden = !!session; $('#nesSignedIn', dialog).hidden = !session;
    $('#nesEmail', dialog).textContent = session?.user?.email || '已登录';
    if (!configured()) { setStatus('云同步尚未配置，请在仓库的 sync-config.js 中检查 Supabase URL 与公钥。', 'error'); return; }
    if (session) setStatus(`已登录 ${session.user?.email || ''}。本机修改会自动备份；跨设备更新会定期检查。`);
    else setStatus('登录后可在其他安装了岁瞬的 Chromium 浏览器恢复数据。首次连接会先让你选择合并方式。');
  }
  async function signIn(form) {
    if (!configured()) return setStatus('云同步配置缺失。', 'error');
    const button = $('[data-nes-action="login"]', dialog); button.disabled = true;
    try {
      const value = await authRequest('token?grant_type=password', { email: String(form.get('email') || '').trim(), password: String(form.get('password') || '') });
      if (!value.access_token) throw new Error('登录服务未返回会话，请检查账号或邮件验证状态。');
      saveSession(value); toast('登录成功，正在检查云端数据'); await synchronize('login');
    } catch (error) { setStatus(error.message || '登录失败，请检查邮箱、密码或网络。', 'error'); }
    finally { button.disabled = false; }
  }
  async function signUp() {
    if (!configured()) return setStatus('云同步配置缺失。', 'error');
    const form = new FormData($('#nesAuthForm', dialog)), email = String(form.get('email') || '').trim(), password = String(form.get('password') || '');
    if (!email || password.length < 8) return setStatus('请填写有效邮箱和至少 8 位密码。', 'error');
    try {
      const value = await authRequest('signup', { email, password });
      if (value.access_token) { saveSession(value); setStatus('账号创建成功，正在同步本机数据。'); await synchronize('login'); }
      else setStatus('账号已创建，请查收验证邮件；验证后返回这里登录。');
    } catch (error) { setStatus(error.message || '创建账号失败，请稍后重试。', 'error'); }
  }
  async function resetPassword() {
    const email = String(new FormData($('#nesAuthForm', dialog)).get('email') || '').trim();
    if (!email) return setStatus('请先填写邮箱，再请求密码重置。', 'error');
    try { await authRequest('recover', { email }); setStatus('如账号存在，Supabase 将发送密码重置邮件。请使用岁瞬网页端完成重置后，再回到扩展登录。'); }
    catch (error) { setStatus(error.message || '无法请求重置邮件，请稍后重试。', 'error'); }
  }
  async function signOut() {
    if (session?.access_token) { try { await fetch(apiUrl('/auth/v1/logout'), { method: 'POST', headers: requestHeaders(session.access_token) }); } catch (_) {} }
    saveSession(null); pendingRow = null; localStorage.removeItem(META_KEY); setStatus('已退出云同步。本机书签与待办仍保留。'); toast('已退出云同步');
  }
  async function fetchRemote() {
    const id = encodeURIComponent(session.user.id);
    const rows = await apiFetch(`/rest/v1/bookmark_sync?select=payload,updated_at&user_id=eq.${id}`);
    return Array.isArray(rows) ? rows[0] || null : null;
  }
  function syncMeta() { return readJson(META_KEY, {}); }
  function saveMeta(row, local) { writeJson(META_KEY, { userId: session?.user?.id || '', remoteUpdatedAt: row?.updated_at || new Date().toISOString(), localHash: JSON.stringify(local), email: session?.user?.email || '' }); }
  async function writeCloud() {
    if (!session) throw new Error('请先登录。');
    const payload = cloudPayload(), updated = new Date().toISOString();
    const query = `/rest/v1/bookmark_sync?on_conflict=user_id`;
    await apiFetch(query, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: session.user.id, payload, updated_at: updated }) });
    const row = await fetchRemote(); saveMeta(row || { updated_at: updated }, payload); return row;
  }
  function hasLocalData(value) { return Boolean((value?.bookmarks || []).length || (value?.nova?.todos || []).length || (value?.nova?.widgets || []).some(widget => widget.type === 'notes' && widget.config?.text) || (value?.nova?.tools?.whiteboard?.strokes || []).length); }
  function showConflict(row) {
    pendingRow = row; const remoteCount = row?.payload?.bookmarks?.length || 0, localCount = currentState().bookmarks?.length || 0;
    $('#nesConflictText', dialog).textContent = `本机约 ${localCount} 个书签，云端约 ${remoteCount} 个书签。推荐合并；同一网址优先采用云端版本。两端删除记录不能自动合并，冲突时可能恢复另一端仍保留的旧项。`;
    $('#nesConflict', dialog).hidden = false;
    setStatus('云端已有数据；请先选择合并或覆盖方式，避免无提示丢失本机内容。');
  }
  function applyState(value) {
    const target = root.NovaApp?.getState?.(); if (!target) throw new Error('页面数据模型尚未就绪。');
    const normalized = root.NovaModel?.normalize(JSON.parse(JSON.stringify(value))) || value;
    suppressSave = true;
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, normalized);
    root.NovaApp.save?.(); root.NovaApp.render?.(); root.NovaDashboard?.refresh?.();
    root.dispatchEvent(new CustomEvent('nova-state-change'));
    setTimeout(() => { suppressSave = false; }, 100);
  }
  async function resolveConflict(choice) {
    if (!pendingRow) return;
    const remote = pendingRow.payload || {}, local = cloudPayload();
    try {
      if (choice === 'cloud') applyState(remote);
      else if (choice === 'merge') applyState(mergeStates(remote, local));
      const row = await writeCloud(); pendingRow = null; $('#nesConflict', dialog).hidden = true;
      setStatus('同步完成。本机与云端数据已连接。'); toast('岁瞬数据已同步');
      if (row) saveMeta(row, cloudPayload());
    } catch (error) { setStatus(error.message || '同步失败，请稍后重试。', 'error'); }
  }
  async function synchronize(reason = 'manual') {
    if (!session || syncing) return;
    syncing = true; clearTimeout(timer); pendingRow = null;
    try {
      await refreshSession(); setStatus('正在检查云端数据…');
      const row = await fetchRemote(), local = cloudPayload(), meta = syncMeta();
      if (!row) { const saved = await writeCloud(); setStatus('云端此前没有数据，已将本机数据备份到云端。'); if (saved) saveMeta(saved, cloudPayload()); return; }
      const sameUser = meta.userId === session.user.id;
      if (!sameUser) { showConflict(row); return; }
      const localDirty = Boolean(meta.localHash && meta.localHash !== JSON.stringify(local));
      if (row.updated_at && (!meta.remoteUpdatedAt || row.updated_at > meta.remoteUpdatedAt)) {
        if (localDirty) {
          applyState(mergeStates(row.payload || {}, local));
          const saved = await writeCloud(); if (saved) saveMeta(saved, cloudPayload());
          setStatus('检测到两端同时有修改，已合并内容并同步。删除冲突请检查两端列表。');
        } else {
          applyState(row.payload || {}); saveMeta(row, cloudPayload()); setStatus('已从云端载入其他设备的最新数据。');
        }
        return;
      }
      if (meta.localHash && meta.localHash !== JSON.stringify(local)) {
        const saved = await writeCloud(); if (saved) saveMeta(saved, cloudPayload()); setStatus('本机变更已备份到云端。'); return;
      }
      saveMeta(row, local); setStatus(reason === 'manual' ? '本机数据与云端一致。' : '云端同步已连接。');
    } catch (error) { setStatus(error.message || '同步失败，请检查网络和 Supabase 表权限。', 'error'); }
    finally { syncing = false; }
  }
  function schedule() {
    if (suppressSave || !session) return;
    clearTimeout(timer); timer = setTimeout(() => synchronize('local-change'), 900);
  }
  function exportBackup() {
    const data = JSON.stringify(currentState(), null, 2), url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `岁瞬书签备份-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('本地备份已导出');
  }
  function importBackup(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (file.size > 25 * 1024 * 1024) return setStatus('备份文件过大（超过 25 MB）。', 'error');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const raw = JSON.parse(String(reader.result || '{}'));
        if (!raw || !Array.isArray(raw.bookmarks)) throw new Error('这不是有效的岁瞬 JSON 备份。');
        const incoming = root.NovaModel?.normalize(raw);
        if (!incoming || !root.NovaSyncMerge?.mergeImportedState) throw new Error('安全合并模块未加载，请刷新后重试。');
        applyState(root.NovaSyncMerge.mergeImportedState(currentState(), incoming));
        setStatus('备份已与本机数据合并，已有内容和偏好优先保留；如已登录，稍后会自动同步。'); toast('备份已导入并合并'); if (session) schedule();
      } catch (error) { setStatus(error.message || '无法读取备份文件。', 'error'); }
    };
    reader.onerror = () => setStatus('无法读取备份文件。', 'error'); reader.readAsText(file);
  }
  function open() { ensureDialog(); dialog.hidden = false; updateDialog(); if (session) synchronize('manual'); }
  function init() {
    ensureDialog(); updateDialog();
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { const result = originalSet.call(this, key, value); if (key === STORAGE_KEY && !suppressSave) schedule(); return result; };
    if (session && configured()) setTimeout(() => synchronize('resume'), 1200);
    setInterval(() => { if (session && !syncing) synchronize('poll'); }, 30000);
    root.addEventListener('online', () => { if (session) synchronize('reconnect'); });
    root.NovaExtensionSync = { open, schedule, sync: () => synchronize('manual') };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})(window);
