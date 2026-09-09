window.LABELS = ["0 球", "1 球", "2 球", "3 球", "4 球", "5 球", "6 球", "7+ 球"];
window.BUCKETS = window.DATA.buckets;
(function(){
  // 设备判定：优先 matchMedia(min-width:820px)（最贴近 CSS 真实断点）；
  // 不可用时回退到 内宽 + 触屏点数 + UA 三重判断，尽量别把平板/大屏手机误判成桌面。
  function detectPC(){
    try{
      if(window.matchMedia){
        var mq = window.matchMedia('(min-width:820px)');
        if(mq && typeof mq.matches === 'boolean') return mq.matches;
      }
    }catch(e){}
    var w = window.innerWidth || document.documentElement.clientWidth || 1024;
    var coarse = (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    var ua = navigator.userAgent || '';
    if(/Android|iPhone|iPad|iPod|Mobile|Windows Phone|HarmonyOS/i.test(ua)) return false;
    if(coarse && w < 1024) return false;
    return w >= 820;
  }
  function txt(id){ return document.getElementById(id).textContent; }
  function injectStyle(href){ var l=document.createElement('link'); l.rel='stylesheet'; l.href=href; document.head.appendChild(l); }
  var isPC = detectPC();
  injectStyle(window.GOALS_ASSET + (isPC ? 'css/goals-pc.css' : 'css/goals-mb.css'));
  document.getElementById('mount').innerHTML = isPC ? txt('pcBody') : txt('mbBody');
  document.body.className = isPC ? 'mode-pc' : 'mode-mb';
  // 只执行被选中那一份逻辑脚本（桌面 / 移动二选一）。
  // 原先是内联 textContent 同步执行；改成外链后为异步，故用 onload 串联后置模块。
  var s = document.createElement('script');
  s.src = window.GOALS_ASSET + (isPC ? 'js/goals-pc.js' : 'js/goals-mb.js');
  s.onload = function(){ postModules(); };
  s.onerror = function(){ postModules(); };
  document.body.appendChild(s);

  // 后置模块：横屏全屏按钮 + 连续场次浮层，需要等版本脚本把 render() 挂到全局后再跑
  function postModules(){

(function(){
  var force = /[?&]forcemb\b/.test(location.search||'');
  var isMobile = force || !(window.matchMedia && window.matchMedia('(min-width:820px)').matches);
  if(!isMobile) return;
  if(window.__landscapeMod) return; window.__landscapeMod=true;

  var ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4M3 9V5a2 2 0 0 1 2-2h4"/></svg>';
  var css=''
    +'.land-overlay{position:fixed;inset:0;z-index:9999;background:var(--bg);overflow:auto;-webkit-overflow-scrolling:touch;}'
    +'.land-stage{position:absolute;top:50%;left:50%;width:100vh;height:100vw;transform:translate(-50%,-50%) rotate(90deg);transform-origin:center;overflow:auto;}'
    +'.land-stage>.land-clone{width:100%;}'
    +'.land-exit{position:fixed;top:14px;right:14px;z-index:10001;display:inline-flex;align-items:center;gap:6px;padding:11px 17px;border:0;border-radius:22px;background:linear-gradient(135deg,#e0533a,#ff7a59);color:#fff;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 5px 16px rgba(224,83,58,.4);font-family:inherit;appearance:none;-webkit-appearance:none;}'
    +'.land-exit:active{transform:scale(.96);}'
    +'.land-hint{position:fixed;left:0;right:0;bottom:18px;z-index:10001;text-align:center;color:var(--text-muted);font-size:12px;pointer-events:none;}'
    +'.land-btn{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;gap:6px;margin:4px 0 10px;padding:9px 15px;border:1px solid var(--border);border-radius:20px;background:linear-gradient(135deg,#2f7bdc,#4a9eff);color:#fff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(47,123,220,.3);font-family:inherit;line-height:1;}'
    +'.land-btn:active{transform:scale(.97);}'
    +'.land-btn.on{background:linear-gradient(135deg,#e0533a,#ff7a59);box-shadow:0 3px 10px rgba(224,83,58,.3);}'
    +'.land-btn svg{width:15px;height:15px;}';
  var st=document.createElement('style'); st.id='landscapeStyle'; st.textContent=css; (document.head||document.documentElement).appendChild(st);

  var overlay=null, stage=null, openPanelId=null;
  function ensureOverlay(){
    if(overlay) return;
    overlay=document.createElement('div'); overlay.className='land-overlay'; overlay.id='landOverlay'; overlay.style.display='none';
    var scrim=document.createElement('div'); scrim.className='land-scrim'; scrim.style.position='absolute'; scrim.style.inset='0';
    stage=document.createElement('div'); stage.className='land-stage';
    var exitBtn=document.createElement('button'); exitBtn.type='button'; exitBtn.className='land-exit'; exitBtn.textContent='✕ 退出横屏';
    var hintEl=document.createElement('div'); hintEl.className='land-hint'; hintEl.textContent='横屏阅读更佳 · 可拖动查看 · 点 ✕ 或按 Esc 退出';
    overlay.appendChild(scrim); overlay.appendChild(stage); overlay.appendChild(exitBtn); overlay.appendChild(hintEl);
    document.body.appendChild(overlay);
    exitBtn.addEventListener('click', closeLandscape);
    overlay.addEventListener('click', function(e){ if(e.target===overlay||e.target===scrim) closeLandscape(); });
  }
  function setBtn(pid,on){ var b=document.getElementById('landBtn-'+pid); if(!b) return; b.classList.toggle('on',!!on); b.innerHTML= on? '✕ 退出横屏' : (ICON+' 横屏全屏'); }
  function openLandscape(panel){
    ensureOverlay();
    if(openPanelId) closeLandscape();
    openPanelId=panel.id;
    var clone=panel.cloneNode(true); clone.className=(clone.className||'')+' land-clone'; clone.removeAttribute('id');
    stage.innerHTML=''; stage.appendChild(clone);
    overlay.style.display='block'; document.body.classList.add('land-open');
    setBtn(openPanelId,true);
    if(overlay.requestFullscreen) try{ overlay.requestFullscreen(); }catch(e){}
  }
  function closeLandscape(){
    if(!openPanelId) return;
    var pid=openPanelId; openPanelId=null;
    if(stage) stage.innerHTML='';
    if(overlay) overlay.style.display='none';
    document.body.classList.remove('land-open');
    if(document.fullscreenElement && document.exitFullscreen) try{ document.exitFullscreen(); }catch(e){}
    setBtn(pid,false);
  }
  function makeBtn(pid){
    var id='landBtn-'+pid, b=document.getElementById(id);
    if(b) return b;
    b=document.createElement('button'); b.type='button'; b.id=id; b.className='land-btn'; b.innerHTML=ICON+' 横屏全屏';
    b.addEventListener('click', function(){ var p=document.getElementById(pid); if(!p) return; if(openPanelId===pid) closeLandscape(); else openLandscape(p); });
    return b;
  }
  function activePanels(){
    var out=[];
    var t=document.getElementById('trend'); if(t && t.innerHTML.trim()!=='') out.push('trend');
    ['overview','teams','seq23'].forEach(function(pid){ var p=document.getElementById(pid); if(p && p.innerHTML.trim()!=='') out.push(pid); });
    return out;
  }
  function attachLandscapeButtons(){
    var active=activePanels();
    ['overview','teams','seq23','trend'].forEach(function(pid){ var b=document.getElementById('landBtn-'+pid); if(b && active.indexOf(pid)<0) b.remove(); });
    active.forEach(function(pid){ var p=document.getElementById(pid); if(!p) return; var b=makeBtn(pid); if(b.parentNode!==p.parentNode || b.nextSibling!==p) p.parentNode.insertBefore(b, p); });
  }
  if(typeof window.render==='function'){ var _o=window.render; window.render=function(){ _o.apply(this,arguments); attachLandscapeButtons(); }; }
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && openPanelId) closeLandscape(); });
  document.addEventListener('fullscreenchange', function(){ if(!document.fullscreenElement && openPanelId) closeLandscape(); });
  attachLandscapeButtons();
})();

  (function(){
    try{
      var css=document.createElement('style');
      css.textContent='.seq-tip{position:fixed;z-index:90;pointer-events:none;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:9px 12px;font-size:12.5px;color:var(--text);box-shadow:0 8px 22px rgba(0,0,0,.22);display:none;max-width:260px;line-height:1.5;}.seq-tip .seq-tip-teams{display:flex;align-items:center;gap:7px;font-weight:700;color:var(--text-strong);}.seq-tip .seq-tip-teams .vs{color:var(--text-muted);font-weight:400;font-size:11px;}.seq-tip .seq-tip-teams .score{font-size:15px;color:var(--accent);font-variant-numeric:tabular-nums;margin-left:2px;}.seq-tip .seq-tip-round{font-weight:800;color:var(--text-strong);font-size:13px;margin-bottom:4px;}.seq-tip .seq-tip-date{margin-top:5px;color:var(--text-muted);font-size:11.5px;}.seq-score-cell{cursor:pointer;transition:transform .12s,filter .12s;}.seq-score-cell:hover{filter:brightness(1.32);transform:translateY(-2px);}.trend-tip{position:fixed;z-index:80;pointer-events:none;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 11px;font-size:12.5px;color:var(--text);box-shadow:0 6px 18px rgba(0,0,0,.20);display:none;max-width:240px;line-height:1.5;}';
      document.head.appendChild(css);
    }catch(e){}
    if(window.__seqTipReady) return; window.__seqTipReady=true;
    var tip=document.createElement('div'); tip.className='seq-tip'; tip.id='seqTip'; document.body.appendChild(tip);
    function show(e){
      var t=e.target; if(!t||!t.closest) return;
      var el=t.closest('.seq-score-cell'); if(!el) return;
      var home=el.getAttribute('data-home'), away=el.getAttribute('data-away'), score=el.getAttribute('data-score'), date=el.getAttribute('data-date'), round=el.getAttribute('data-round'), ha=el.getAttribute('data-ha'), season=el.getAttribute('data-season');
      if(!home && !away) return;
      var line=home+' <b>'+score+'</b> '+away, sp=(''+score).split('-');
      if(ha!=='H' && sp.length===2) line=away+' <b>'+sp[1]+'-'+sp[0]+'</b> '+home;
      tip.innerHTML='<b>'+season+' 第 '+round+' 轮</b> · '+date+' · '+(ha==='H'?'主场':'客场')+'<br>'+line;
      tip.style.display='block';
      var x=e.clientX, y=e.clientY; if((x==null)&&e.touches&&e.touches[0]){x=e.touches[0].clientX;y=e.touches[0].clientY;}
      tip.style.left=(x+14)+'px'; tip.style.top=(y+14)+'px';
    }
    function move(e){ if(tip.style.display!=='block') return; var x=e.clientX,y=e.clientY; if((x==null)&&e.touches&&e.touches[0]){x=e.touches[0].clientX;y=e.touches[0].clientY;} tip.style.left=(x+14)+'px'; tip.style.top=(y+14)+'px'; }
    function hide(e){ var t=e.target; if(!t||!t.closest) return; var el=t.closest('.seq-score-cell'); if(!el) return; var rel=e.relatedTarget; if(rel && el.contains(rel)) return; tip.style.display='none'; }
    document.addEventListener('mouseover',show);
    document.addEventListener('mousemove',move);
    document.addEventListener('mouseout',hide);
  })();
  }
})();
