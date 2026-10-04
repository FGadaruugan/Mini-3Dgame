export const GUI_DRAFT_KEY='mini3d-studio-gui-v1';

const $=id=>document.getElementById(id);
const clone=value=>JSON.parse(JSON.stringify(value));
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
const round=v=>Math.round((Number(v)||0)*100)/100;

const GROUPS={
  lobby:{label:'LOBBY',description:'Main lobby and matchmaking UI'},
  hud:{label:'IN-GAME HUD',description:'Battle HUD shown over the 3D map'},
  controls:{label:'MOBILE CONTROLS',description:'Touch controls. Player Move/Fire/Reload custom settings stay separate.'},
  overlays:{label:'OVERLAYS',description:'Backpack, settings and match result panels'}
};

const ELEMENTS=[
  // Desktop / shared lobby
  {id:'lobbyTop',group:'lobby',label:'Top Bar',selector:'.lobby-topbar',devices:['desktop'],defaults:{desktop:{x:0,y:0,w:100,h:10,opacity:100,scale:100,font:100,radius:0,z:30}}},
  {id:'lobbyBrand',group:'lobby',label:'Brand',selector:'.lobby-brand',devices:['desktop'],defaults:{desktop:{x:2,y:2,w:24,h:7,opacity:100,scale:100,font:100,radius:0,z:31}}},
  {id:'lobbyProfile',group:'lobby',label:'Profile',selector:'.lobby-player',devices:['desktop'],defaults:{desktop:{x:76,y:2,w:21,h:7,opacity:100,scale:100,font:100,radius:8,z:31}}},
  {id:'lobbyLeft',group:'lobby',label:'Match Panel',selector:'.battle-left-panel',devices:['desktop','mobile'],defaults:{desktop:{x:2,y:22,w:27,h:55,opacity:100,scale:100,font:100,radius:5,z:28},mobile:{x:1,y:17,w:25,h:61,opacity:100,scale:80,font:80,radius:5,z:28}}},
  {id:'lobbyHero',group:'lobby',label:'Hero Text',selector:'.lobby-hero',devices:['desktop'],defaults:{desktop:{x:35,y:22,w:30,h:48,opacity:100,scale:100,font:100,radius:0,z:20}}},
  {id:'lobbyPanel',group:'lobby',label:'Mode Panel',selector:'.lobby-panel',devices:['desktop'],defaults:{desktop:{x:69,y:18,w:28,h:61,opacity:100,scale:100,font:100,radius:12,z:29}}},
  {id:'playBtn',group:'lobby',label:'PLAY Button',selector:'#startBtn',devices:['desktop'],defaults:{desktop:{x:72,y:67,w:22,h:8,opacity:100,scale:100,font:100,radius:5,z:35}}},
  {id:'mobileLobbyBar',group:'lobby',label:'Mobile Top Bar',selector:'.mobile-lobbybar',devices:['mobile'],defaults:{mobile:{x:1,y:1,w:98,h:12,opacity:100,scale:100,font:100,radius:5,z:35}}},
  {id:'mobileStart',group:'lobby',label:'Mobile START',selector:'#mobileStartBtn',devices:['mobile'],defaults:{mobile:{x:2,y:67,w:23,h:10,opacity:100,scale:100,font:100,radius:4,z:36}}},
  {id:'bottomNav',group:'lobby',label:'Bottom Navigation',selector:'.lobby-bottom-nav',devices:['desktop','mobile'],defaults:{desktop:{x:29,y:91,w:42,h:8,opacity:100,scale:100,font:100,radius:8,z:34},mobile:{x:27,y:88,w:50,h:10,opacity:100,scale:80,font:80,radius:8,z:34}}},
  {id:'moreBtn',group:'lobby',label:'MORE Toggle',selector:'#drawerToggle',devices:['desktop','mobile'],defaults:{desktop:{x:96,y:44,w:3,h:11,opacity:100,scale:100,font:100,radius:6,z:42},mobile:{x:96,y:40,w:3,h:16,opacity:100,scale:80,font:80,radius:6,z:42}}},
  {id:'fullscreenBtn',group:'lobby',label:'Fullscreen',selector:'#fullscreenBtn',devices:['desktop','mobile'],defaults:{desktop:{x:94,y:12,w:4,h:7,opacity:100,scale:100,font:100,radius:5,z:40},mobile:{x:94,y:13,w:4,h:10,opacity:100,scale:80,font:80,radius:5,z:40}}},

  // HUD
  {id:'hudStats',group:'hud',label:'HP / Alive / Kills',selector:'#hud .top-row',devices:['desktop','mobile'],defaults:{desktop:{x:1.5,y:2,w:29,h:8,opacity:100,scale:100,font:100,radius:6,z:45},mobile:{x:1,y:2,w:34,h:10,opacity:100,scale:82,font:82,radius:6,z:45}}},
  {id:'zoneInfo',group:'hud',label:'Zone Info',selector:'#zoneInfo',devices:['desktop','mobile'],defaults:{desktop:{x:41,y:2,w:18,h:6,opacity:100,scale:100,font:100,radius:6,z:45},mobile:{x:40,y:2,w:20,h:8,opacity:100,scale:82,font:82,radius:6,z:45}}},
  {id:'minimap',group:'hud',label:'Minimap',selector:'#minimap',devices:['desktop','mobile'],defaults:{desktop:{x:82,y:2,w:16,h:28,opacity:100,scale:100,font:100,radius:10,z:44},mobile:{x:85,y:2,w:14,h:29,opacity:92,scale:80,font:80,radius:10,z:44}}},
  {id:'weaponHud',group:'hud',label:'Weapon HUD',selector:'#hud .weapon.panel',devices:['desktop','mobile'],defaults:{desktop:{x:78,y:79,w:20,h:17,opacity:100,scale:100,font:100,radius:8,z:45},mobile:{x:70,y:76,w:18,h:20,opacity:90,scale:80,font:80,radius:8,z:45}}},
  {id:'weaponSlots',group:'hud',label:'Weapon Slots',selector:'#weaponSlots',devices:['desktop','mobile'],defaults:{desktop:{x:55,y:86,w:20,h:10,opacity:100,scale:100,font:100,radius:6,z:45},mobile:{x:51,y:83,w:18,h:13,opacity:90,scale:80,font:80,radius:6,z:45}}},
  {id:'backpackBtn',group:'hud',label:'Backpack',selector:'#backpackBtn',devices:['desktop','mobile'],defaults:{desktop:{x:2,y:84,w:13,h:8,opacity:100,scale:100,font:100,radius:5,z:46},mobile:{x:35,y:84,w:14,h:11,opacity:88,scale:80,font:80,radius:5,z:46}}},
  {id:'lootPrompt',group:'hud',label:'Loot Prompt',selector:'#lootPrompt',devices:['desktop','mobile'],defaults:{desktop:{x:41,y:71,w:18,h:9,opacity:100,scale:100,font:100,radius:6,z:48},mobile:{x:39,y:69,w:22,h:12,opacity:94,scale:80,font:80,radius:6,z:48}}},
  {id:'vehicleHud',group:'hud',label:'Vehicle HUD',selector:'#vehicleHud',devices:['desktop','mobile'],defaults:{desktop:{x:43,y:83,w:14,h:8,opacity:100,scale:100,font:100,radius:6,z:48},mobile:{x:43,y:82,w:15,h:11,opacity:94,scale:80,font:80,radius:6,z:48}}},
  {id:'driveBtn',group:'hud',label:'Drive Button',selector:'#driveBtn',devices:['desktop'],defaults:{desktop:{x:44,y:73,w:12,h:8,opacity:100,scale:100,font:100,radius:5,z:49}}},
  {id:'planeJump',group:'hud',label:'Plane Jump',selector:'#planeJumpBtn',devices:['desktop','mobile'],defaults:{desktop:{x:43,y:67,w:14,h:9,opacity:100,scale:100,font:100,radius:6,z:55},mobile:{x:43,y:61,w:14,h:13,opacity:100,scale:85,font:85,radius:6,z:55}}},

  // Mobile controls. move/fire/reload are player-customizable and export separately.
  {id:'movePad',group:'controls',label:'MOVE',selector:'#movePad',devices:['mobile'],playerControl:'move',defaults:{mobile:{x:4,y:66,w:15,h:27,opacity:60,scale:100,font:100,radius:50,z:60}}},
  {id:'lookPad',group:'controls',label:'LOOK AREA',selector:'#lookPad',devices:['mobile'],cssExport:false,defaults:{mobile:{x:43,y:18,w:55,h:70,opacity:15,scale:100,font:100,radius:0,z:20}}},
  {id:'fireBtn',group:'controls',label:'FIRE',selector:'#fireBtn',devices:['mobile'],playerControl:'fire',defaults:{mobile:{x:86,y:72,w:10,h:18,opacity:82,scale:100,font:100,radius:50,z:65}}},
  {id:'reloadBtn',group:'controls',label:'RELOAD',selector:'#reloadBtn',devices:['mobile'],playerControl:'reload',defaults:{mobile:{x:78,y:56,w:7,h:13,opacity:76,scale:100,font:100,radius:50,z:65}}},
  {id:'pickupBtnMobile',group:'controls',label:'PICK',selector:'#pickupMobileBtn',devices:['mobile'],defaults:{mobile:{x:71,y:45,w:7,h:13,opacity:78,scale:100,font:100,radius:50,z:65}}},
  {id:'healBtn',group:'controls',label:'+HP',selector:'#bandageBtn',devices:['mobile'],defaults:{mobile:{x:8,y:48,w:7,h:13,opacity:78,scale:100,font:100,radius:50,z:65}}},
  {id:'driveMobile',group:'controls',label:'DRIVE',selector:'#driveMobileBtn',devices:['mobile'],defaults:{mobile:{x:68,y:63,w:8,h:15,opacity:82,scale:100,font:100,radius:50,z:65}}},
  {id:'jumpMobile',group:'controls',label:'JUMP',selector:'#jumpBtn',devices:['mobile'],defaults:{mobile:{x:88,y:50,w:8,h:15,opacity:82,scale:100,font:100,radius:50,z:65}}},

  // overlays
  {id:'backpackPanel',group:'overlays',label:'Backpack Panel',selector:'#backpackOverlay .backpack-panel',devices:['desktop','mobile'],defaults:{desktop:{x:18,y:12,w:64,h:76,opacity:100,scale:100,font:100,radius:12,z:130},mobile:{x:10,y:7,w:80,h:86,opacity:100,scale:88,font:88,radius:10,z:130}}},
  {id:'settingsPanel',group:'overlays',label:'Settings',selector:'#settingsOverlay .settings-shell',devices:['desktop','mobile'],defaults:{desktop:{x:5,y:5,w:90,h:90,opacity:100,scale:100,font:100,radius:10,z:130},mobile:{x:1,y:1,w:98,h:98,opacity:100,scale:100,font:86,radius:4,z:130}}},
  {id:'endCard',group:'overlays',label:'Match Result',selector:'#endOverlay .card',devices:['desktop','mobile'],defaults:{desktop:{x:33,y:30,w:34,h:35,opacity:100,scale:100,font:100,radius:12,z:135},mobile:{x:28,y:22,w:44,h:50,opacity:100,scale:90,font:90,radius:10,z:135}}}
];

function defaultState(){
  const layouts={desktop:{},mobile:{}};
  for(const meta of ELEMENTS){
    for(const device of meta.devices){
      const base=meta.defaults[device]||meta.defaults.desktop||meta.defaults.mobile;
      layouts[device][meta.id]={...clone(base),enabled:true};
    }
  }
  return {version:1,activeGroup:'lobby',activeDevice:'desktop',layouts};
}

function loadState(){
  const fallback=defaultState();
  try{
    const raw=JSON.parse(localStorage.getItem(GUI_DRAFT_KEY)||'null');
    if(!raw?.layouts) return fallback;
    for(const device of ['desktop','mobile']){
      for(const meta of ELEMENTS.filter(m=>m.devices.includes(device))){
        const saved=raw.layouts?.[device]?.[meta.id];
        if(saved) fallback.layouts[device][meta.id]={...fallback.layouts[device][meta.id],...saved};
      }
    }
    fallback.activeGroup=GROUPS[raw.activeGroup]?raw.activeGroup:'lobby';
    fallback.activeDevice=['desktop','mobile'].includes(raw.activeDevice)?raw.activeDevice:'desktop';
    return fallback;
  }catch{
    return fallback;
  }
}

let state=loadState();
let selectedId=null;
let canEdit=false;
let initialized=false;
let active=false;
let dirty=false;
let drag=null;
let history=[];
let historyIndex=-1;
let logFn=()=>{};
let stateFn=()=>{};
let autosaveTimer=0;

function metaById(id){return ELEMENTS.find(x=>x.id===id)||null;}
function layoutFor(id,device=state.activeDevice){return state.layouts?.[device]?.[id]||null;}
function availableElements(){
  return ELEMENTS.filter(meta=>meta.group===state.activeGroup && meta.devices.includes(state.activeDevice));
}

function saveRaw(){
  localStorage.setItem(GUI_DRAFT_KEY,JSON.stringify({
    ...state,
    updatedAt:new Date().toISOString(),
    generatedCss:getGeneratedGuiCss(),
    playerDefaults:getPlayerControlDefaultsSnippet()
  }));
}

function markDirty(){
  dirty=true;
  clearTimeout(autosaveTimer);
  autosaveTimer=setTimeout(saveRaw,650);
  notify();
}

function snapshot(){return JSON.stringify(state);}
function pushHistory(){
  const snap=snapshot();
  if(history[historyIndex]===snap) return;
  history=history.slice(0,historyIndex+1);
  history.push(snap);
  if(history.length>60) history.shift();
  historyIndex=history.length-1;
  notify();
}
function restoreHistory(index){
  if(index<0||index>=history.length) return false;
  state=JSON.parse(history[index]);
  historyIndex=index;
  dirty=true;
  if(!availableElements().some(x=>x.id===selectedId)) selectedId=availableElements()[0]?.id||null;
  renderAll();
  notify();
  return true;
}

function notify(){
  stateFn?.({
    dirty,
    group:state.activeGroup,
    device:state.activeDevice,
    count:availableElements().length,
    canUndo:historyIndex>0,
    canRedo:historyIndex>=0&&historyIndex<history.length-1
  });
}

function escapeHtml(value){
  return String(value??'')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");
}

function groupLabel(){
  return GROUPS[state.activeGroup]?.label||'GUI';
}

function renderExplorer(){
  const groups=$('guiGroupList');
  const elements=$('guiElementList');
  if(!groups||!elements) return;

  groups.innerHTML='';
  for(const [id,group] of Object.entries(GROUPS)){
    const btn=document.createElement('button');
    btn.className='gui-group-item'+(id===state.activeGroup?' active':'');
    btn.innerHTML='<strong>'+escapeHtml(group.label)+'</strong><small>'+escapeHtml(group.description)+'</small>';
    btn.addEventListener('click',()=>{
      state.activeGroup=id;
      if(id==='controls') state.activeDevice='mobile';
      selectedId=availableElements()[0]?.id||null;
      markDirty();
      pushHistory();
      renderAll();
    });
    groups.appendChild(btn);
  }

  elements.innerHTML='';
  for(const meta of availableElements()){
    const cfg=layoutFor(meta.id);
    const btn=document.createElement('button');
    btn.className='gui-element-item'+(meta.id===selectedId?' active':'');
    btn.innerHTML='<span>'+escapeHtml(meta.playerControl?'P':'UI')+'</span><strong>'+escapeHtml(meta.label)+'</strong><small>'+escapeHtml(meta.selector)+'</small>';
    btn.addEventListener('click',()=>select(meta.id));
    if(cfg && cfg.enabled===false) btn.classList.add('disabled-item');
    elements.appendChild(btn);
  }
  $('guiElementCount').textContent=String(availableElements().length);
}

function mockContent(meta){
  const labels={
    lobbyTop:'MINI 3D BATTLE                         PLAYER 01',
    lobbyBrand:'M3D · MINI 3D BATTLE',
    lobbyProfile:'P1  PLAYER 01',
    lobbyLeft:'MATCH · SOLO · GREEN VALLEY',
    lobbyHero:'READY FOR BATTLE?',
    lobbyPanel:'GAME MODE\nSOLO · FRIEND · 1V1',
    playBtn:'▶ PLAY SOLO',
    mobileLobbyBar:'M3D                 PLAYER 01',
    mobileStart:'START ›',
    bottomNav:'THEME   SEASON   WORKSHOP   CARDS   INVENTORY',
    moreBtn:'›',
    fullscreenBtn:'⛶',
    hudStats:'HP 100   ALIVE 30   KILLS 0',
    zoneInfo:'ZONE 232m',
    minimap:'MINIMAP',
    weaponHud:'AR-4\n30 / 120',
    weaponSlots:'[1] AR-4    [2] EMPTY',
    backpackBtn:'BACKPACK',
    lootPrompt:'ITEM · PICK',
    vehicleHud:'CAR · 0 km/h',
    driveBtn:'DRIVE',
    planeJump:'JUMP',
    movePad:'MOVE',
    lookPad:'LOOK',
    fireBtn:'FIRE',
    reloadBtn:'RLD',
    pickupBtnMobile:'PICK',
    healBtn:'+HP',
    driveMobile:'DRIVE',
    jumpMobile:'JUMP',
    backpackPanel:'BACKPACK\nARMOR · BANDAGE · WEAPONS',
    settingsPanel:'SETTINGS\nSENSITIVITY · CUSTOMIZE BUTTONS',
    endCard:'MATCH OVER\nPLAY AGAIN · LOBBY'
  };
  return labels[meta.id]||meta.label;
}

function renderPreview(){
  const host=$('guiCanvas');
  if(!host) return;
  host.innerHTML='';
  host.dataset.group=state.activeGroup;
  host.dataset.device=state.activeDevice;

  const safe=document.createElement('div');
  safe.className='gui-safe-area';
  host.appendChild(safe);

  const bg=document.createElement('div');
  bg.className='gui-preview-bg gui-bg-'+state.activeGroup;
  if(state.activeGroup==='lobby'){
    bg.innerHTML='<div class="gui-bg-horizon"></div><div class="gui-bg-character">PLAYER</div>';
  }else if(state.activeGroup==='hud'||state.activeGroup==='controls'){
    bg.innerHTML='<div class="gui-bg-ground"></div><div class="gui-bg-crosshair">+</div>';
  }else{
    bg.innerHTML='<div class="gui-bg-dim">GAME PAUSED</div>';
  }
  host.appendChild(bg);

  for(const meta of availableElements()){
    const cfg=layoutFor(meta.id);
    if(!cfg) continue;

    const item=document.createElement('div');
    item.className='gui-preview-item gui-kind-'+state.activeGroup+(meta.id===selectedId?' selected':'')+(cfg.enabled===false?' layout-disabled':'');
    if(meta.playerControl) item.classList.add('player-owned');
    item.dataset.guiId=meta.id;
    item.style.left=cfg.x+'%';
    item.style.top=cfg.y+'%';
    item.style.width=cfg.w+'%';
    item.style.height=cfg.h+'%';
    item.style.opacity=String(clamp(cfg.opacity,10,100)/100);
    item.style.transform='scale('+clamp(cfg.scale,40,200)/100+')';
    item.style.zIndex=String(clamp(cfg.z,1,300));
    item.style.borderRadius=clamp(cfg.radius,0,50)+'px';
    item.style.fontSize=clamp(cfg.font,40,200)/100+'em';
    item.textContent=mockContent(meta);
    item.title=meta.selector;

    const badge=document.createElement('i');
    badge.textContent=meta.playerControl?'PLAYER':'DEV';
    item.appendChild(badge);

    const resize=document.createElement('b');
    resize.className='gui-resize-handle';
    resize.textContent='↘';
    item.appendChild(resize);

    item.addEventListener('pointerdown',event=>beginDrag(event,meta.id,'move'));
    resize.addEventListener('pointerdown',event=>{
      event.stopPropagation();
      beginDrag(event,meta.id,'resize');
    });
    item.addEventListener('click',event=>{
      event.stopPropagation();
      select(meta.id);
    });
    host.appendChild(item);
  }
}

function select(id){
  if(!layoutFor(id)) return;
  selectedId=id;
  renderExplorer();
  renderPreview();
  renderInspector();
}

function beginDrag(event,id,mode){
  if(!canEdit) return;
  const cfg=layoutFor(id);
  const host=$('guiCanvas');
  if(!cfg||!host) return;
  event.preventDefault();
  event.stopPropagation();
  select(id);

  const rect=host.getBoundingClientRect();
  drag={
    id,mode,pointerId:event.pointerId,
    rect,
    startX:event.clientX,startY:event.clientY,
    start:clone(cfg),
    before:snapshot()
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function moveDrag(event){
  if(!drag||drag.pointerId!==event.pointerId||!canEdit) return;
  const cfg=layoutFor(drag.id);
  if(!cfg) return;
  const dx=((event.clientX-drag.startX)/drag.rect.width)*100;
  const dy=((event.clientY-drag.startY)/drag.rect.height)*100;
  const snap=Number($('guiSnap')?.value||1);
  const snapVal=value=>snap>0?Math.round(value/snap)*snap:value;

  if(drag.mode==='move'){
    cfg.x=round(clamp(snapVal(drag.start.x+dx),0,100-Math.max(1,cfg.w)));
    cfg.y=round(clamp(snapVal(drag.start.y+dy),0,100-Math.max(1,cfg.h)));
  }else{
    cfg.w=round(clamp(snapVal(drag.start.w+dx),2,100-cfg.x));
    cfg.h=round(clamp(snapVal(drag.start.h+dy),2,100-cfg.y));
  }
  dirty=true;
  renderPreview();
  renderInspector();
  notify();
}

function endDrag(event){
  if(!drag||drag.pointerId!==event.pointerId) return;
  const before=drag.before;
  drag=null;
  if(before!==snapshot()){
    markDirty();
    pushHistory();
  }
}

function renderInspector(){
  const meta=metaById(selectedId);
  const cfg=layoutFor(selectedId);
  const none=$('guiNoSelection');
  const props=$('guiProperties');
  none?.classList.toggle('hidden',Boolean(meta&&cfg));
  props?.classList.toggle('hidden',!(meta&&cfg));
  if(!meta||!cfg) return;

  $('guiSelectedName').textContent=meta.label;
  $('guiSelectedSelector').textContent=meta.selector;
  $('guiPropX').value=round(cfg.x);
  $('guiPropY').value=round(cfg.y);
  $('guiPropW').value=round(cfg.w);
  $('guiPropH').value=round(cfg.h);
  $('guiPropOpacity').value=round(cfg.opacity);
  $('guiPropScale').value=round(cfg.scale);
  $('guiPropFont').value=round(cfg.font);
  $('guiPropRadius').value=round(cfg.radius);
  $('guiPropZ').value=round(cfg.z);
  $('guiPropEnabled').checked=cfg.enabled!==false;

  const note=$('guiPlayerNote');
  note.classList.toggle('hidden',!meta.playerControl);
  if(meta.playerControl){
    note.textContent='PLAYER CUSTOM CONTROL · Studio edits the developer default. A player’s saved CUSTOMIZE BUTTONS layout still overrides it.';
  }

  const readonly=!canEdit;
  props.querySelectorAll('input,select,button').forEach(el=>el.disabled=readonly);
}

function applyInspector(){
  if(!canEdit) return;
  const cfg=layoutFor(selectedId);
  if(!cfg) return;

  cfg.x=clamp($('guiPropX').value,0,100);
  cfg.y=clamp($('guiPropY').value,0,100);
  cfg.w=clamp($('guiPropW').value,2,100);
  cfg.h=clamp($('guiPropH').value,2,100);
  cfg.opacity=clamp($('guiPropOpacity').value,10,100);
  cfg.scale=clamp($('guiPropScale').value,40,200);
  cfg.font=clamp($('guiPropFont').value,40,200);
  cfg.radius=clamp($('guiPropRadius').value,0,50);
  cfg.z=clamp($('guiPropZ').value,1,300);
  cfg.enabled=$('guiPropEnabled').checked;
  markDirty();
  pushHistory();
  renderAll();
}

function resetSelected(){
  if(!canEdit||!selectedId) return;
  const meta=metaById(selectedId);
  const base=meta?.defaults?.[state.activeDevice];
  if(!base) return;
  state.layouts[state.activeDevice][selectedId]={...clone(base),enabled:true};
  markDirty();
  pushHistory();
  renderAll();
}

function resetGroup(){
  if(!canEdit) return;
  for(const meta of availableElements()){
    const base=meta.defaults?.[state.activeDevice];
    if(base) state.layouts[state.activeDevice][meta.id]={...clone(base),enabled:true};
  }
  markDirty();
  pushHistory();
  renderAll();
}

function renderAll(){
  $('guiDeviceDesktop')?.classList.toggle('active',state.activeDevice==='desktop');
  $('guiDeviceMobile')?.classList.toggle('active',state.activeDevice==='mobile');
  $('guiPresetTitle').textContent=groupLabel()+' · '+state.activeDevice.toUpperCase();
  renderExplorer();
  renderPreview();
  renderInspector();
  notify();
}

function cssRule(meta,cfg,device){
  if(cfg.enabled===false||meta.cssExport===false||meta.playerControl) return '';
  const prefix=device==='mobile'
    ? '@media (pointer:coarse), (max-width: 900px)'
    : '@media (pointer:fine) and (min-width: 901px)';
  return `${prefix} {
  ${meta.selector} {
    position: absolute !important;
    left: ${round(cfg.x)}% !important;
    top: ${round(cfg.y)}% !important;
    right: auto !important;
    bottom: auto !important;
    width: ${round(cfg.w)}% !important;
    height: ${round(cfg.h)}% !important;
    opacity: ${round(cfg.opacity/100)} !important;
    transform: scale(${round(cfg.scale/100)}) !important;
    transform-origin: top left !important;
    font-size: ${round(cfg.font/100)}em !important;
    border-radius: ${round(cfg.radius)}px !important;
    z-index: ${Math.round(cfg.z)} !important;
  }
}`;
}

export function getGeneratedGuiCss(){
  const rules=[];
  rules.push('/* Generated by Mini 3D Studio GUI Editor. */');
  rules.push('/* Player CUSTOMIZE BUTTONS for MOVE/FIRE/RELOAD remain per-user and are not overridden here. */');
  for(const device of ['desktop','mobile']){
    for(const meta of ELEMENTS){
      if(!meta.devices.includes(device)) continue;
      const cfg=state.layouts?.[device]?.[meta.id];
      if(!cfg) continue;
      const rule=cssRule(meta,cfg,device);
      if(rule) rules.push(rule);
    }
  }
  return rules.join('\n\n')+'\n';
}

export function getPlayerControlDefaultsSnippet(){
  const controls={};
  for(const meta of ELEMENTS.filter(x=>x.playerControl)){
    const cfg=state.layouts.mobile[meta.id];
    if(!cfg) continue;
    controls[meta.playerControl]={
      x:round(cfg.x),
      y:round(cfg.y),
      scale:round(cfg.scale),
      opacity:round(cfg.opacity)
    };
  }
  return `controls: ${JSON.stringify(controls,null,2)}`;
}

export function getGuiDraft(){
  return clone(state);
}

export function initGuiEditor({role='tester',log=()=>{},onStateChange=()=>{}}={}){
  logFn=log;
  stateFn=onStateChange;
  canEdit=['owner','developer','builder'].includes(role);
  if(initialized){
    renderAll();
    return;
  }

  selectedId=availableElements()[0]?.id||null;
  history=[snapshot()];
  historyIndex=0;

  $('guiDeviceDesktop')?.addEventListener('click',()=>{
    state.activeDevice='desktop';
    if(state.activeGroup==='controls') state.activeGroup='hud';
    selectedId=availableElements()[0]?.id||null;
    markDirty();
    pushHistory();
    renderAll();
  });
  $('guiDeviceMobile')?.addEventListener('click',()=>{
    state.activeDevice='mobile';
    selectedId=availableElements()[0]?.id||null;
    markDirty();
    pushHistory();
    renderAll();
  });

  $('guiCanvas')?.addEventListener('pointermove',moveDrag);
  $('guiCanvas')?.addEventListener('pointerup',endDrag);
  $('guiCanvas')?.addEventListener('pointercancel',endDrag);
  $('guiCanvas')?.addEventListener('pointerdown',event=>{
    if(event.target===$('guiCanvas')||event.target.classList.contains('gui-preview-bg')){
      selectedId=null;
      renderAll();
    }
  });

  const propIds=['guiPropX','guiPropY','guiPropW','guiPropH','guiPropOpacity','guiPropScale','guiPropFont','guiPropRadius','guiPropZ','guiPropEnabled'];
  propIds.forEach(id=>$(id)?.addEventListener('change',applyInspector));
  $('guiResetSelected')?.addEventListener('click',resetSelected);
  $('guiResetGroup')?.addEventListener('click',()=>{
    if(confirm('Reset this GUI group for the current device?')) resetGroup();
  });

  initialized=true;
  renderAll();
}

export function setGuiEditorRole(role){
  canEdit=['owner','developer','builder'].includes(role);
  renderInspector();
}

export function setGuiEditorActive(value){
  active=Boolean(value);
  if(active) renderAll();
}

export function saveGuiDraft(){
  if(!canEdit) return false;
  saveRaw();
  dirty=false;
  notify();
  logFn('GUI draft saved · '+groupLabel(),'ok');
  return true;
}

export function reloadGuiDraft(){
  state=loadState();
  selectedId=availableElements()[0]?.id||null;
  dirty=false;
  history=[snapshot()];
  historyIndex=0;
  renderAll();
  logFn('GUI draft reloaded','ok');
}

export function undoGui(){
  if(!canEdit||historyIndex<=0) return false;
  const ok=restoreHistory(historyIndex-1);
  if(ok) logFn('GUI undo','ok');
  return ok;
}

export function redoGui(){
  if(!canEdit||historyIndex>=history.length-1) return false;
  const ok=restoreHistory(historyIndex+1);
  if(ok) logFn('GUI redo','ok');
  return ok;
}

export function getGuiStatus(){
  return {
    dirty,
    group:state.activeGroup,
    device:state.activeDevice,
    count:availableElements().length,
    canUndo:historyIndex>0,
    canRedo:historyIndex>=0&&historyIndex<history.length-1
  };
}
