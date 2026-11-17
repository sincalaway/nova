(function (root) {
  'use strict';
  const app = root.NovaApp, model = root.NovaModel;
  if (!app || !model) return;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  const toolItems = [
    { id:'whiteboard', title:'在线画板', icon:'✎', desc:'在本机绘制并自动保存。' },
    { id:'word-count', title:'字数统计', icon:'字', desc:'实时统计与常用排版清理。' },
    { id:'code-highlight', title:'代码高亮', icon:'⌘', desc:'选择语言并生成安全的高亮代码。' },
    { id:'background-removal', title:'在线抠图', icon:'◩', desc:'优先本机 AI 去背，也支持纯色抠图。' },
    { id:'ip-lookup', title:'IP 查询', icon:'◎', desc:'查询当前公网 IP 地址。' },
    { id:'latex', title:'LaTex公式', icon:'∑', desc:'打开 LaTeXLive 公式编辑器。' },
    { id:'sync', title:'跨设备同步', icon:'☁', desc:'用岁瞬云同步在浏览器间恢复数据。' }
  ];
  let overlay, content, activeTool = '', bgFile = null, bgBitmap = null, bgResultUrl = '', sampledColor = null, drawing = false, liveStroke = null;
  const bgCanvasState = { canvas: null, ctx: null };
  const sourceModelUrl = 'https://huggingface.co/studioludens/birefnet-lite-512/resolve/4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7/onnx/model_fp16.onnx?download=true';

  function notify(message) { if (app.toast) app.toast(message); else { const el = $('#nsToast'); if (el) { el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); } } }
  function state() { return model.normalize(app.getState()); }
  function addStyles() {
    if ($('#nsFeatureStyles')) return;
    const style = document.createElement('style'); style.id = 'nsFeatureStyles';
    style.textContent = `
      .ns-tool-launch{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin:10px 0 8px;padding:11px 8px;border:1px solid rgba(224,239,255,.15);border-radius:12px;background:rgba(255,255,255,.07);color:inherit;cursor:pointer;font-size:12px}.ns-tool-launch:hover{background:rgba(255,255,255,.14)}.ns-tool-launch .ns-launch-icon{font-size:18px;color:#88c7ff}
      .ns-overlay{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:16px;background:rgba(3,8,16,.72);backdrop-filter:blur(8px)}.ns-overlay[hidden]{display:none!important}.ns-window{width:min(1120px,100%);height:min(780px,calc(100dvh - 32px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(220,235,250,.18);border-radius:20px;background:#f7f9fc;color:#26374a;box-shadow:0 28px 100px rgba(0,0,0,.45)}.ns-head{height:58px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 18px;background:#fff;border-bottom:1px solid #e5ebf1}.ns-brand{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:700}.ns-brand-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:#e5f2ff;color:#2477bb;font-size:18px}.ns-head-actions{display:flex;gap:6px}.ns-head button,.ns-button{border:1px solid #d9e2eb;border-radius:9px;background:#fff;color:#3b4d61;padding:8px 11px;font-size:11px;cursor:pointer}.ns-head button:hover,.ns-button:hover{background:#eff6fd}.ns-layout{min-height:0;flex:1;display:grid;grid-template-columns:235px minmax(0,1fr)}.ns-nav{overflow:auto;padding:15px 12px;border-right:1px solid #e4eaf0;background:#f1f5f9}.ns-nav-title{padding:4px 10px 11px;color:#718198;font-size:10px;letter-spacing:.12em;text-transform:uppercase}.ns-nav button{display:flex;align-items:center;gap:10px;width:100%;padding:10px;border:0;border-radius:10px;background:transparent;color:#4b5d72;text-align:left;font-size:12px;cursor:pointer}.ns-nav button:hover,.ns-nav button.active{background:#e2effb;color:#1f6da8}.ns-nav-icon{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:8px;background:#fff;color:#3983bd;font-size:14px}.ns-work{min-width:0;overflow:auto;padding:24px}.ns-home-title{margin:0 0 6px;font-size:23px;color:#203246}.ns-home-copy{margin:0 0 20px;color:#728198;font-size:12px;line-height:1.65}.ns-tool-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}.ns-tool-card{min-height:115px;display:flex;gap:12px;align-items:flex-start;padding:16px;border:1px solid #e2e9f0;border-radius:15px;background:#fff;color:#2d3e51;text-align:left;cursor:pointer;box-shadow:0 4px 14px rgba(33,61,91,.04);transition:.15s}.ns-tool-card:hover{transform:translateY(-2px);border-color:#b2d1ed;box-shadow:0 9px 22px rgba(33,61,91,.09)}.ns-tool-card-icon{display:grid;place-items:center;flex:none;width:40px;height:40px;border-radius:12px;background:#eaf4fd;color:#297bb7;font-size:19px;font-weight:700}.ns-tool-card strong{display:block;margin:1px 0 5px;font-size:13px}.ns-tool-card small{color:#78879a;font-size:10px;line-height:1.55}.ns-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}.ns-page-head h2{margin:0 0 5px;font-size:21px}.ns-page-head p{margin:0;color:#748398;font-size:11px;line-height:1.6}.ns-tool-body{min-width:0}.ns-tool-body textarea,.ns-tool-body input:not([type=checkbox]):not([type=range]):not([type=color]),.ns-tool-body select{border:1px solid #d9e2eb;border-radius:9px;background:#fff;color:#25364a;padding:9px 10px;font-size:12px}.ns-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-bottom:11px}.ns-toolbar label{display:flex;align-items:center;gap:6px;color:#65758a;font-size:11px}.ns-toolbar input[type=color]{width:34px;height:30px;padding:2px;border:1px solid #d9e2eb;border-radius:8px;background:white}.ns-toolbar input[type=range]{width:95px}.ns-note{margin:8px 0;padding:9px 11px;border-radius:9px;background:#edf5fc;color:#61748a;font-size:10px;line-height:1.6}.ns-primary{border-color:#247cbc;background:#247cbc;color:#fff}.ns-primary:hover{background:#176ba8;color:#fff}.ns-canvas-wrap{height:min(56vh,490px);min-height:280px;overflow:hidden;border:1px solid #d5dee8;border-radius:12px;background-color:#fff;background-image:linear-gradient(45deg,#edf1f4 25%,transparent 25%),linear-gradient(-45deg,#edf1f4 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#edf1f4 75%),linear-gradient(-45deg,transparent 75%,#edf1f4 75%);background-size:18px 18px;background-position:0 0,0 9px,9px -9px,-9px 0}.ns-canvas-wrap canvas{display:block;width:100%;height:100%;touch-action:none;cursor:crosshair}.ns-word-area{width:100%;height:min(38vh,320px);min-height:180px;resize:vertical;box-sizing:border-box;line-height:1.65;font:13px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace}.ns-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:8px;margin:12px 0}.ns-stat{padding:10px;border:1px solid #e5ebf1;border-radius:10px;background:#fff}.ns-stat span{display:block;margin-bottom:5px;color:#7b899b;font-size:10px}.ns-stat strong{color:#263a50;font-size:18px;font-variant-numeric:tabular-nums}.ns-code-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.ns-code-grid textarea{box-sizing:border-box;width:100%;height:360px;resize:vertical;font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre}.ns-code-output{box-sizing:border-box;height:360px;overflow:auto;margin:0;padding:12px;border:1px solid #d9e2eb;border-radius:10px;background:#111c2a;color:#e4edf7;font:12px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre}.ns-code-output .kw{color:#c792ea}.ns-code-output .str{color:#c3e88d}.ns-code-output .com{color:#79919f}.ns-code-output .num{color:#f78c6c}.ns-code-output .tag{color:#89ddff}.ns-cutout-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}.ns-image-stage{min-height:280px;display:grid;place-items:center;overflow:auto;border:1px solid #d8e1ea;border-radius:12px;background-color:#fff;background-image:linear-gradient(45deg,#edf1f4 25%,transparent 25%),linear-gradient(-45deg,#edf1f4 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#edf1f4 75%),linear-gradient(-45deg,transparent 75%,#edf1f4 75%);background-size:18px 18px;background-position:0 0,0 9px,9px -9px,-9px 0}.ns-image-stage canvas{display:block;max-width:100%;max-height:430px;cursor:crosshair}.ns-status{min-height:18px;color:#63768d;font-size:10px}.ns-swatch{display:inline-block;width:13px;height:13px;margin:0 4px;vertical-align:middle;border:1px solid #aaa;border-radius:3px}.ns-latex-frame{height:min(68vh,620px);min-height:400px;border:1px solid #dde5ed;border-radius:12px;overflow:hidden;background:#fff}.ns-latex-frame iframe{display:block;width:100%;height:100%;border:0}.ns-ip-box{margin:20px 0;padding:22px;border:1px solid #dfe7ef;border-radius:14px;background:#fff;text-align:center}.ns-ip-value{font-size:25px;font-weight:700;letter-spacing:.03em;color:#246eaa;overflow-wrap:anywhere}.ns-sync-box{max-width:560px;padding:18px;border:1px solid #e0e7ef;border-radius:14px;background:#fff}.ns-toast{position:fixed;left:50%;bottom:22px;z-index:1210;transform:translate(-50%,12px);opacity:0;padding:9px 14px;border-radius:10px;background:#17283b;color:#fff;font-size:11px;pointer-events:none;transition:.18s}.ns-toast.show{transform:translate(-50%,0);opacity:1}
      @media(max-width:760px){.ns-overlay{padding:0}.ns-window{width:100%;height:100dvh;border:0;border-radius:0}.ns-head{height:52px;padding:0 12px}.ns-layout{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.ns-nav{display:flex;gap:4px;padding:8px;overflow:auto;border-right:0;border-bottom:1px solid #e4eaf0}.ns-nav-title{display:none}.ns-nav button{flex:none;width:auto;padding:6px 8px;font-size:10px}.ns-nav-icon{width:24px;height:24px}.ns-work{padding:16px 13px 28px}.ns-tool-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ns-tool-card{min-height:95px;padding:11px;gap:8px}.ns-tool-card-icon{width:33px;height:33px;border-radius:10px}.ns-tool-card strong{font-size:11px}.ns-tool-card small{font-size:9px}.ns-code-grid,.ns-cutout-grid{grid-template-columns:1fr}.ns-code-grid textarea,.ns-code-output{height:230px}.ns-latex-frame{height:65vh;min-height:360px}.ns-canvas-wrap{height:48vh;min-height:240px}.ns-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ns-ip-value{font-size:20px}}
    `;
    document.head.append(style);
  }
  function addLauncher() {
    const rail = $('.rail'); if (!rail || $('.ns-tool-launch', rail)) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'ns-tool-launch'; button.innerHTML = '<span class="ns-launch-icon" aria-hidden="true">⌘</span><span>工具箱</span>'; button.setAttribute('aria-label', '打开岁瞬工具箱');
    const bottom = $('.rail-bottom', rail); if (bottom) rail.insertBefore(button, bottom); else $('.rail-links', rail)?.after(button);
    button.addEventListener('click', () => openSuite());
  }
  function ensureOverlay() {
    if ($('#nsFeatureOverlay')) { overlay = $('#nsFeatureOverlay'); content = $('.ns-work', overlay); return; }
    overlay = document.createElement('div'); overlay.id = 'nsFeatureOverlay'; overlay.className = 'ns-overlay'; overlay.hidden = true;
    overlay.innerHTML = `<section class="ns-window" role="dialog" aria-modal="true" aria-labelledby="nsDialogTitle"><header class="ns-head"><div class="ns-brand"><span class="ns-brand-mark">✦</span><span id="nsDialogTitle">岁瞬工具箱</span></div><div class="ns-head-actions"><button type="button" data-ns-home>工具首页</button><button type="button" data-ns-close aria-label="关闭工具箱">关闭</button></div></header><div class="ns-layout"><nav class="ns-nav" aria-label="工具列表"><div class="ns-nav-title">工具</div>${toolItems.map(item=>`<button type="button" data-ns-tool="${item.id}"><span class="ns-nav-icon">${item.icon}</span><span>${item.title}</span></button>`).join('')}</nav><main class="ns-work" tabindex="-1"></main></div></section>`;
    document.body.append(overlay); content = $('.ns-work', overlay);
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-ns-close]')) return closeSuite();
      if (event.target.closest('[data-ns-home]')) return renderHome();
      const link = event.target.closest('[data-ns-tool]'); if (link) return openTool(link.dataset.nsTool);
      const back = event.target.closest('[data-ns-back]'); if (back) return renderHome();
      if (event.target.closest('[data-ns-sync-open]')) return openSync();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay && !overlay.hidden) closeSuite(); });
  }
  function openSuite() { ensureOverlay(); overlay.hidden = false; renderHome(); $('.ns-work', overlay).focus(); }
  function closeSuite() { if (!overlay) return; overlay.hidden = true; const frame = $('#nsLatexFrame'); if (frame) frame.src = 'about:blank'; if (activeTool === 'word-count') { const area = $('#nsWordText'); if (area) area.value = ''; } activeTool = ''; }
  function renderHome() {
    activeTool = '';
    $$('.ns-nav [data-ns-tool]', overlay).forEach(button => button.classList.remove('active'));
    content.innerHTML = `<h1 class="ns-home-title">岁瞬工具箱</h1><p class="ns-home-copy">常用效率工具集中在这里。文本统计、代码处理、白板和去背默认在本机处理；IP 查询与 LaTeXLive 会连接各自的服务。</p><div class="ns-tool-grid">${toolItems.map(item=>`<button type="button" class="ns-tool-card" data-ns-tool="${item.id}"><span class="ns-tool-card-icon">${item.icon}</span><span><strong>${item.title}</strong><small>${item.desc}</small></span></button>`).join('')}</div>`;
  }
  function pageHead(title, copy) { return `<header class="ns-page-head"><div><h2>${title}</h2><p>${copy}</p></div><button class="ns-button" type="button" data-ns-back>返回工具箱</button></header>`; }
  function openTool(id) {
    if (id === 'sync') return openSync();
    activeTool = id;
    $$('.ns-nav [data-ns-tool]', overlay).forEach(button => button.classList.toggle('active', button.dataset.nsTool === id));
    const render = {
      whiteboard: renderWhiteboard,
      'word-count': renderWordCount,
      'code-highlight': renderCodeHighlight,
      'background-removal': renderBackgroundRemoval,
      'ip-lookup': renderIpLookup,
      latex: renderLatex
    }[id];
    if (!render) return renderHome();
    content.innerHTML = render();
    if (id === 'whiteboard') setupWhiteboard();
    if (id === 'word-count') setupWordCount();
    if (id === 'code-highlight') setupCodeHighlight();
    if (id === 'background-removal') setupBackgroundRemoval();
    if (id === 'ip-lookup') setupIpLookup();
  }
  function renderWhiteboard() {
    return `<div class="ns-tool-body">${pageHead('在线画板','画布内容保存在当前岁瞬书签数据中，并随已有账号同步；本机离线可用。')}<div class="ns-toolbar"><label>颜色 <input id="nsPenColor" type="color" value="#1e5e97"></label><label>笔触 <input id="nsPenWidth" type="range" min="1" max="24" value="4"></label><button class="ns-button" type="button" data-board-undo>撤销</button><button class="ns-button" type="button" data-board-clear>清空</button><button class="ns-button" type="button" data-board-download>导出 PNG</button></div><div class="ns-canvas-wrap"><canvas id="nsBoardCanvas" aria-label="白板画布"></canvas></div><p class="ns-note">在画布上按住鼠标或手指绘制。数据仅保存为矢量笔迹，关闭工具不会清空。</p></div>`;
  }
  function setupWhiteboard() {
    const canvas = $('#nsBoardCanvas'), ctx = canvas.getContext('2d'); if (!canvas || !ctx) return;
    bgCanvasState.canvas = canvas; bgCanvasState.ctx = ctx;
    const strokeList = () => { const tools = state().nova.tools; if (!Array.isArray(tools.whiteboard.strokes)) tools.whiteboard.strokes = []; return tools.whiteboard.strokes; };
    const resize = () => { const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr)); drawBoard(); };
    function drawBoard() {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,rect.width,rect.height);
      const strokes = [...strokeList()]; if (liveStroke) strokes.push(liveStroke);
      for (const stroke of strokes) { const points = stroke.points || []; if (!points.length) continue; ctx.beginPath(); ctx.strokeStyle = stroke.color || '#1e5e97'; ctx.lineWidth = Number(stroke.width)||4; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.moveTo(points[0][0]*rect.width,points[0][1]*rect.height); for (let i=1;i<points.length;i++) ctx.lineTo(points[i][0]*rect.width,points[i][1]*rect.height); if(points.length===1){ctx.lineTo(points[0][0]*rect.width+.1,points[0][1]*rect.height+.1);} ctx.stroke(); }
    }
    const point = event => { const rect=canvas.getBoundingClientRect(); return [Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))]; };
    canvas.onpointerdown = event => { event.preventDefault(); canvas.setPointerCapture(event.pointerId); drawing=true; liveStroke={color:$('#nsPenColor').value,width:Number($('#nsPenWidth').value),points:[point(event)]}; drawBoard(); };
    canvas.onpointermove = event => { if(!drawing||!liveStroke)return; const p=point(event),last=liveStroke.points[liveStroke.points.length-1]; if(liveStroke.points.length<600&&Math.hypot(p[0]-last[0],p[1]-last[1])>.002){liveStroke.points.push(p);drawBoard();} };
    const finish = () => { if(!drawing)return; drawing=false; if(liveStroke){const strokes=strokeList();liveStroke.id=`stroke-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;strokes.push(liveStroke); if(strokes.length>150)strokes.splice(0,strokes.length-150); liveStroke=null; app.save();drawBoard();} };
    canvas.onpointerup=finish; canvas.onpointercancel=finish; window.addEventListener('resize',resize,{once:true}); resize();
    $('[data-board-undo]',content).onclick=()=>{const strokes=strokeList();strokes.pop();app.save();drawBoard();};
    $('[data-board-clear]',content).onclick=()=>{if(!strokeList().length)return; if(!window.confirm('清空这张白板？'))return; state().nova.tools.whiteboard.strokes=[];app.save();drawBoard();};
    $('[data-board-download]',content).onclick=()=>{const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download='岁瞬白板.png';link.click();};
  }
  function renderWordCount() {
    return `<div class="ns-tool-body">${pageHead('字数统计','实时计算，输入内容只留在当前页面；关闭工具后会清空，不会保存或同步。')}<div class="ns-toolbar"><button type="button" class="ns-button" data-word-clean="html">清除 HTML</button><button type="button" class="ns-button" data-word-clean="script">清除脚本</button><button type="button" class="ns-button" data-word-clean="link">清除链接标签</button><button type="button" class="ns-button" data-word-indent="yes">段首缩进</button><button type="button" class="ns-button" data-word-indent="no">取消缩进</button><button type="button" class="ns-button" data-word-punct="en">中文转英文标点</button><button type="button" class="ns-button" data-word-punct="zh">英文转中文标点</button><button type="button" class="ns-button" data-word-spaces>合并空格</button><button type="button" class="ns-button" data-word-clear>清空</button></div><textarea class="ns-word-area" id="nsWordText" placeholder="在这里粘贴或输入文字…"></textarea><div class="ns-stats" id="nsWordStats"></div></div>`;
  }
  function wordMetrics(text) {
    const chars = Array.from(text), cjk = chars.filter(ch => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(ch)).length;
    const cjkPunct = chars.filter(ch => /[，。！？；：、…（）《》“”‘’【】—·「」『』]/u.test(ch)).length;
    const english = (text.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) || []).length, digits = (text.match(/\d+/g) || []).length;
    const englishChars = (text.match(/[A-Za-z]/g) || []).length, digitChars = (text.match(/\d/g) || []).length;
    const folded = chars.reduce((sum,ch) => sum + (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(ch) ? 2 : 1),0);
    return [['总字数',cjk+english+digits],['折合字符',folded],['汉字/日韩文字',cjk],['中文标点',cjkPunct],['英文字符',englishChars],['数字个数',digitChars],['全部字符',chars.length],['中文+数字',cjk+digitChars],['英语单词',english]];
  }
  function setupWordCount() {
    const area=$('#nsWordText'), stats=$('#nsWordStats');
    const update=()=>{stats.innerHTML=wordMetrics(area.value).map(([name,value])=>`<div class="ns-stat"><span>${name}</span><strong>${value}</strong></div>`).join('');};
    area.addEventListener('input',update); update();
    content.onclick = event=>{
      const button=event.target.closest('[data-word-clear],[data-word-clean],[data-word-indent],[data-word-punct],[data-word-spaces]'); if(!button)return;
      if(button.hasAttribute('data-word-clear'))area.value='';
      else if(button.dataset.wordClean==='script')area.value=area.value.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
      else if(button.dataset.wordClean==='link')area.value=area.value.replace(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi,'$1');
      else if(button.dataset.wordClean==='html'){const doc=new DOMParser().parseFromString(area.value,'text/html');doc.querySelectorAll('script,style').forEach(node=>node.remove());area.value=doc.body.textContent||'';}
      else if(button.dataset.wordIndent==='yes')area.value=area.value.split('\n').map(line=>line.trim()?`　　${line}`:line).join('\n');
      else if(button.dataset.wordIndent==='no')area.value=area.value.replace(/^[\t \u3000]+/gm,'');
      else if(button.dataset.wordPunct==='en')area.value=area.value.replace(/[，。！？；：、（）【】]/g,ch=>({'，':',','。':'.','！':'!','？':'?','；':';','：':':','、':',','（':'(','）':')','【':'[','】':']'})[ch]);
      else if(button.dataset.wordPunct==='zh')area.value=area.value.replace(/[,!?;:()[\]]/g,ch=>({',':'，','!':'！','?':'？',';':'；',':':'：','(':'（',')':'）','[':'【',']':'】'})[ch]||'。');
      else if(button.hasAttribute('data-word-spaces'))area.value=area.value.replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n');
      area.dispatchEvent(new Event('input')); area.focus();
    };
  }
  const keywords = new Set(('as async await break case catch class const continue def del do else elif end enum export extends false finally for from function if import in interface let match module namespace new null of package pass private procedure protected public raise return self static super switch then this throw true try typeof undefined var void while with yield abstract boolean byte char double final float int long native short synchronized transient volatile lambda print puts require begin read write select from where insert update delete create table join left right inner and or not null true false').split(/\s+/).map(word=>word.toLowerCase()));
  function highlightCode(source, language) {
    const htmlLang=['html','xml'].includes(language), pattern=htmlLang ? /(<!--[\s\S]*?-->|<\/?[A-Za-z][^<>]*>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g : /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b)/g;
    let out='', last=0, match;
    while((match=pattern.exec(source))){out+=esc(source.slice(last,match.index));const token=match[0];let cls='';
      if(htmlLang){if(token.startsWith('<!--'))cls='com';else if(token.startsWith('<'))cls='tag';else cls='str';}
      else if(token.startsWith('//')||token.startsWith('/*')||token.startsWith('#'))cls='com';else if(/^['"`]/.test(token))cls='str';else if(/^\d/.test(token))cls='num';else if(keywords.has(token.toLowerCase()))cls='kw';
      out+=cls?`<span class="${cls}">${esc(token)}</span>`:esc(token);last=pattern.lastIndex;
    }
    out+=esc(source.slice(last));return out;
  }
  function renderCodeHighlight() {
    const langs=['c_cpp','csharp','css','delphi','xml','html','java','javascript','php','python','ruby','sql','vb'];
    const labels={c_cpp:'C/C++',csharp:'C#',css:'CSS',delphi:'Delphi/Pascal',xml:'XML',html:'HTML',java:'Java',javascript:'JavaScript',php:'PHP',python:'Python',ruby:'Ruby',sql:'SQL',vb:'VB'};
    return `<div class="ns-tool-body">${pageHead('代码高亮','输入源码并选择语言。处理在本机完成，源码按纯文本高亮，不会作为 HTML 执行。')}<div class="ns-toolbar"><label>语言<select id="nsCodeLang">${langs.map((lang,index)=>`<option value="${lang}" ${index===0?'selected':''}>${labels[lang]}</option>`).join('')}</select></label><button class="ns-button ns-primary" type="button" data-code-highlight>高亮</button><button class="ns-button" type="button" data-code-copy>复制源码</button><button class="ns-button" type="button" data-code-clear>清空</button></div><p class="ns-note">支持 C/C++、C#、CSS、Delphi/Pascal、XML/HTML、Java、JavaScript、PHP、Python、Ruby、SQL、VB。输出可复制后粘贴到 Word 或 PPT。</p><div class="ns-code-grid"><textarea id="nsCodeInput" spellcheck="false" placeholder="在此输入源码…"></textarea><pre class="ns-code-output"><code id="nsCodeOutput">高亮结果会显示在这里。</code></pre></div></div>`;
  }
  function setupCodeHighlight() {
    const source=$('#nsCodeInput'), output=$('#nsCodeOutput');
    $('[data-code-highlight]',content).onclick=()=>{output.innerHTML=highlightCode(source.value,$('#nsCodeLang').value);};
    $('[data-code-copy]',content).onclick=async()=>{try{await navigator.clipboard.writeText(source.value);notify('源码已复制');}catch(_){source.select();document.execCommand('copy');notify('已尝试复制源码');}};
    $('[data-code-clear]',content).onclick=()=>{source.value='';output.textContent='高亮结果会显示在这里。';source.focus();};
  }
  function renderBackgroundRemoval() {
    return `<div class="ns-tool-body">${pageHead('在线抠图','原图只在本机处理，不会上传。首次使用会下载约 94 MB 模型和按需加载的推理运行时；扩展随包提供本地运行时。若设备不支持 WebGPU，可用纯色抠图。')}<div class="ns-toolbar"><label class="ns-button">选择图片<input id="nsBgFile" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button class="ns-button ns-primary" type="button" data-bg-ai disabled>本地智能去背</button><button class="ns-button" type="button" data-bg-manual disabled>抠除采样颜色</button><button class="ns-button" type="button" data-bg-download disabled>下载透明 PNG</button><label>容差 <input id="nsBgTolerance" type="range" min="5" max="180" value="42"></label></div><div class="ns-cutout-grid"><div><div class="ns-image-stage"><canvas id="nsBgCanvas" hidden></canvas><span id="nsBgEmpty">选择一张有背景的图片开始。</span></div><p class="ns-status" id="nsBgStatus" role="status">支持 PNG、JPEG、WebP；单张不超过 25 MB。</p></div><div class="ns-note"><strong>本地纯色抠除</strong><p>点预览图中要移除的背景颜色，再调节容差并点击「抠除采样颜色」。更适合纯色或接近纯色的背景。智能模型在设备本地运行；没有 WebGPU 时此按钮会提示切换到纯色模式。</p><div>已采样颜色：<span class="ns-swatch" id="nsBgSwatch"></span><code id="nsBgColorText">尚未采样</code></div></div></div></div>`;
  }
  function setupBackgroundRemoval() {
    const input=$('#nsBgFile'), canvas=$('#nsBgCanvas'), ctx=canvas.getContext('2d'), status=$('#nsBgStatus'), ai=$('[data-bg-ai]'), manual=$('[data-bg-manual]'), download=$('[data-bg-download]');
    bgCanvasState.canvas=canvas; bgCanvasState.ctx=ctx; bgFile=null; sampledColor=null; if(bgResultUrl)URL.revokeObjectURL(bgResultUrl);bgResultUrl='';
    const setStatus=text=>{status.textContent=text;};
    const drawBitmap=(bitmap)=>{canvas.width=bitmap.width;canvas.height=bitmap.height;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0);canvas.hidden=false;$('#nsBgEmpty').hidden=true;download.disabled=true;};
    input.onchange=async()=>{const file=input.files?.[0];input.value='';if(!file)return;if(file.size>25*1024*1024)return setStatus('图片超过 25 MB，请缩小后重试。');if(!/^image\/(png|jpeg|webp)$/.test(file.type))return setStatus('当前只支持 PNG、JPEG 或 WebP。');
      try{const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>32000000){bitmap.close();return setStatus('图片像素过多，请先缩小尺寸。');}bgFile=file;bgBitmap=bitmap;sampledColor=null;drawBitmap(bitmap);ai.disabled=false;manual.disabled=false;setStatus(`已载入 ${bitmap.width}×${bitmap.height} 图片。点击预览可采样背景颜色。`);}catch(_){setStatus('图片无法读取，请换一张有效图片。');}
    };
    canvas.onclick=event=>{if(canvas.hidden)return;const rect=canvas.getBoundingClientRect(),x=Math.max(0,Math.min(canvas.width-1,Math.floor((event.clientX-rect.left)*canvas.width/rect.width))),y=Math.max(0,Math.min(canvas.height-1,Math.floor((event.clientY-rect.top)*canvas.height/rect.height)));try{const px=ctx.getImageData(x,y,1,1).data;sampledColor=[px[0],px[1],px[2]];$('#nsBgSwatch').style.background=`rgb(${sampledColor.join(',')})`;$('#nsBgColorText').textContent=`rgb(${sampledColor.join(', ')})`;setStatus('已采样背景颜色；可运行纯色抠除。');}catch(_){}};
    ai.onclick=async()=>{
      if(!bgFile)return;if(!navigator.gpu){setStatus('此浏览器未检测到 WebGPU。可改用「抠除采样颜色」，图片仍只在本机处理。');return;}
      ai.disabled=true;manual.disabled=true;setStatus('正在载入本地推理运行时…首次使用会下载约 94 MB 模型。');
      try{if(!root.NovaLoadBackgroundEngine)throw new Error('本地模型加载器不可用，请刷新页面后重试。');const engine=await root.NovaLoadBackgroundEngine();const result=await engine.removeBackground(bgFile,(message,progress)=>setStatus(progress==null?message:`${message} ${Math.round(progress*100)}%`));const bitmap=await createImageBitmap(result);drawBitmap(bitmap);bitmap.close();bgResultUrl=URL.createObjectURL(result);download.disabled=false;setStatus('去背完成。图片未上传；可以下载透明 PNG。');}
      catch(error){setStatus(`${error?.message||'智能去背失败'} 可尝试纯色背景抠除。`);}
      finally{ai.disabled=false;manual.disabled=false;}
    };
    manual.onclick=()=>{if(!bgFile||!canvas.width)return;if(!sampledColor){setStatus('请先点击图片中要移除的背景颜色。');return;}try{const image=ctx.getImageData(0,0,canvas.width,canvas.height),data=image.data,tolerance=Number($('#nsBgTolerance').value),feather=24,[r,g,b]=sampledColor;for(let i=0;i<data.length;i+=4){const distance=Math.hypot(data[i]-r,data[i+1]-g,data[i+2]-b);if(distance<=tolerance)data[i+3]=0;else if(distance<tolerance+feather)data[i+3]=Math.round(data[i+3]*((distance-tolerance)/feather));}ctx.putImageData(image,0,0);canvas.toBlob(blob=>{if(!blob)return; if(bgResultUrl)URL.revokeObjectURL(bgResultUrl);bgResultUrl=URL.createObjectURL(blob);download.disabled=false;setStatus('纯色抠除已完成。边缘可通过容差微调后重新选择原图处理。');},'image/png');}catch(_){setStatus('处理失败，请换一张尺寸更小的图片。');}};
    download.onclick=()=>{if(!bgResultUrl)return;const link=document.createElement('a');link.href=bgResultUrl;link.download='岁瞬-透明背景.png';link.click();};
  }
  function renderIpLookup() {
    return `<div class="ns-tool-body">${pageHead('IP 查询','留空查询当前公网 IP，或输入 IPv4 / IPv6 地址查看公开地理与网络信息。位置是近似值。')}<div class="ns-ip-box"><form id="nsIpForm" class="ns-toolbar"><label>IP 地址<input id="nsIpInput" inputmode="url" placeholder="留空查询当前 IP"></label><button class="ns-button ns-primary" type="submit">查询</button><button type="button" class="ns-button" data-ip-copy disabled>复制 IP</button></form><div class="ns-ip-value" id="nsIpValue">—</div><p class="ns-status" id="nsIpStatus" role="status">查询会将当前或输入的 IP 发送给 IPWhois.io；不获取 GPS 定位、不保存结果。</p><div class="ns-stats" id="nsIpDetails"></div></div><p class="ns-note">IPWhois.io 免费接口限每个调用域名每天 1,000 次；位置由 IP 数据库推算，可能不准确。详见 <a href="https://ipwhois.io/documentation" target="_blank" rel="noopener noreferrer">接口文档</a>。</p></div>`;
  }
  function isIpAddress(value) {
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return value.split('.').every(part => Number(part) <= 255);
    return value.includes(':') && /^[0-9a-f:.]+$/i.test(value) && value.split(':').length >= 3;
  }
  function setupIpLookup() {
    const form=$('#nsIpForm'), copy=$('[data-ip-copy]');
    form.onsubmit=event=>{event.preventDefault();lookupIp($('#nsIpInput').value.trim());};
    copy.onclick=async()=>{const ip=$('#nsIpValue').dataset.ip;if(!ip)return;try{await navigator.clipboard.writeText(ip);notify('IP 已复制');}catch(_){notify('复制失败，请手动选择 IP');}};
  }
  async function lookupIp(ip = '') {
    const value=$('#nsIpValue'),status=$('#nsIpStatus'),copy=$('[data-ip-copy]'),details=$('#nsIpDetails'); if(!value)return;
    if(ip&&!isIpAddress(ip)){status.textContent='IP 格式无效，请输入有效 IPv4 或 IPv6，或留空查询当前 IP。';return;}
    value.textContent='正在查询…';copy.disabled=true;details.innerHTML='';
    try{const path=ip?`/${encodeURIComponent(ip)}`:'/';const url=new URL(`https://ipwho.is${path}`);url.searchParams.set('fields','ip,type,country,region,city,connection.isp,connection.org,timezone.id,timezone.utc,flag.emoji');url.searchParams.set('lang','zh-CN');const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();if(!data.success||!data.ip)throw new Error(data.message||'服务没有返回 IP 信息。');value.textContent=data.ip;value.dataset.ip=data.ip;copy.disabled=false;const location=[data.region,data.city].filter(Boolean).join(' · ');const rows=[['IP 类型',data.type],['国家',data.country],['地区 / 城市',location],['运营商',data.connection?.isp],['组织',data.connection?.org],['时区',[data.timezone?.id,data.timezone?.utc].filter(Boolean).join(' · ')]];details.innerHTML=rows.filter(([,text])=>text).map(([label,text])=>`<div class="ns-stat"><span>${esc(label)}</span><strong style="font-size:12px">${esc(text)}</strong></div>`).join('');status.textContent='查询完成。IP 位置为数据库估算，结果可能不准确。';}
    catch(error){value.textContent='暂不可用';status.textContent=error?.message||'IP 查询服务暂时不可用，请检查网络后重试。';}
  }
  function renderLatex() {
    return `<div class="ns-tool-body">${pageHead('LaTex公式','内嵌 LaTeXLive 编辑器。目标网站可能禁止嵌入；若窗口为空，可使用「在新标签打开」。')}<div class="ns-toolbar"><a class="ns-button ns-primary" href="https://www.latexlive.com/" target="_blank" rel="noopener noreferrer">在新标签打开 LaTeXLive</a></div><div class="ns-latex-frame"><iframe id="nsLatexFrame" title="LaTeXLive 公式编辑器" src="https://www.latexlive.com/" referrerpolicy="no-referrer" loading="lazy"></iframe></div></div>`;
  }
  function openSync() {
    if(root.NovaExtensionSync?.open){root.NovaExtensionSync.open();return;}
    const button=$('#railAccount'); if(button){button.click();return;}
    notify('请使用顶部「云同步」入口登录。');
  }
  function renderSync() {
    return `<div class="ns-tool-body">${pageHead('跨设备同步','使用同一岁瞬账号，可在已启用同步的浏览器间恢复书签与组件数据。')}<div class="ns-sync-box"><p>书签、分类、待办、事件卡片、白板笔迹与偏好会随账号云同步。纯文本统计内容不会保存；本地上传的壁纸原文件仍留在原设备。</p><button class="ns-button ns-primary" type="button" data-ns-sync-open>打开云同步</button></div></div>`;
  }
  function init() {
    addStyles(); addLauncher(); ensureOverlay();
    const observer=new MutationObserver(()=>{ if(!$('.ns-tool-launch'))addLauncher(); });
    if($('.rail'))observer.observe($('.rail'),{childList:true,subtree:true});
    root.NovaFeatureSuite={open:openSuite,refresh:()=>{if(overlay&&!overlay.hidden&&activeTool==='whiteboard')openTool('whiteboard');}};
    document.addEventListener('click',event=>{const trigger=event.target.closest('[data-ns-sync]');if(trigger)openSync();});
  }
  function $$(selector,scope=document){return [...scope.querySelectorAll(selector)];}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
