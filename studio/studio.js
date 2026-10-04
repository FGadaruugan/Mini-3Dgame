import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../supabase-config.js';
import {
  initSceneEditor,
  setSceneEditorRole,
  setSceneEditorActive,
  saveSceneDraft,
  reloadSceneDraft,
  getSceneStatus,
  getSceneData,
  getGeneratedSceneModule,
  undoScene,
  redoScene
} from './scene-editor.js';
import {
  initDataEditor,
  setDataEditorRole,
  saveDataDraft,
  reloadDataDraft,
  resetDataDraft,
  getDataStatus,
  getGeneratedConfig,
  DATA_DRAFT_KEY
} from './data-editor.js';

const $=id=>document.getElementById(id);
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

const FILES={
  'game.js':'../game.js',
  'game-config.js':'../game-config.js',
  'scene-data.js':'../scene-data.js',
  'dev-tools.js':'../dev-tools.js',
  'style.css':'../style.css',
  'profile.js':'../profile.js',
  'index.html':'../index.html',
  'STUDIO_GUIDE.md':'../STUDIO_GUIDE.md'
};

const VERSION_KEY='mini3d-studio-history-v1';
const SCENE_KEY='mini3d-studio-scene-v1';

let session=null;
let access=null;
let activeFile='game.js';
let liveText='';
let currentSource='live';
let workspaceMode='code';
let studioReady=false;
let sceneStatus={dirty:false,count:0,warnings:0,canUndo:false,canRedo:false};
let dataStatus={dirty:false,saved:false,weapons:0};
let codeAutosaveTimer=0;

function log(message,type=''){
  const row=document.createElement('div');
  row.className='log-line '+type;
  row.textContent='['+new Date().toLocaleTimeString()+'] '+message;
  $('consoleOutput').appendChild(row);
  $('consoleOutput').scrollTop=$('consoleOutput').scrollHeight;
}

function setHealth(text,state=''){
  const el=$('studioHealth');
  if(!el) return;
  el.textContent=text;
  el.className=state;
}

function setGate(text,signIn=false){
  $('gateStatus').textContent=text;
  $('studioSignIn').classList.toggle('hidden',!signIn);
}

function draftKey(file){return 'mini3d-studio-draft:'+file;}
function canEditCode(){return ['owner','developer'].includes(access?.role);}
function canEditScene(){return ['owner','developer','builder'].includes(access?.role);}
function canEditData(){return ['owner','developer'].includes(access?.role);}

function updateStats(){
  if(workspaceMode==='scene'){
    $('codeStats').textContent=sceneStatus.count+' objects · '+sceneStatus.warnings+' warnings · '+(sceneStatus.dirty?'draft':'saved');
    $('fileState').textContent=sceneStatus.dirty?'DRAFT':'SCENE';
    $('undoBtn').disabled=!sceneStatus.canUndo;
    $('redoBtn').disabled=!sceneStatus.canRedo;
    setHealth(sceneStatus.warnings?sceneStatus.warnings+' SCENE WARNINGS':'SCENE OK',sceneStatus.warnings?'warn':'');
    return;
  }

  if(workspaceMode==='data'){
    $('codeStats').textContent=dataStatus.weapons+' weapons · '+(dataStatus.dirty?'unsaved changes':'saved');
    $('fileState').textContent=dataStatus.dirty?'DRAFT':'DATA';
    $('undoBtn').disabled=true;
    $('redoBtn').disabled=true;
    setHealth('DATA READY');
    return;
  }

  const text=$('codeEditor').value;
  $('codeStats').textContent=(text.split('\n').length)+' lines · '+text.length+' chars';
  $('fileState').textContent=currentSource==='draft'?'DRAFT':'LIVE';
  $('undoBtn').disabled=false;
  $('redoBtn').disabled=false;
  setHealth(currentSource==='draft'?'LOCAL CODE DRAFT':'LIVE FILE');
}

function updateRolePermissions(){
  const codeEditable=canEditCode();
  $('codeEditor').readOnly=!codeEditable;

  ['toolBotCount','toolMapHalf','toolPlayerSpeed','toolZoneSeconds','applyQuickTools'].forEach(id=>{
    if($(id)) $(id).disabled=!codeEditable;
  });

  if(!codeEditable && workspaceMode==='code'){
    $('cursorInfo').textContent='READ ONLY · '+String(access?.role||'player').toUpperCase();
  }

  setSceneEditorRole(access?.role||'tester');
  setDataEditorRole(access?.role||'tester');
}

function setWorkspaceMode(mode){
  workspaceMode=['scene','data'].includes(mode)?mode:'code';
  const sceneMode=workspaceMode==='scene';
  const dataMode=workspaceMode==='data';
  const codeMode=workspaceMode==='code';

  $('codePane').classList.toggle('hidden',!codeMode);
  $('scenePane').classList.toggle('hidden',!sceneMode);
  $('dataPane').classList.toggle('hidden',!dataMode);

  $('codeExplorer').classList.toggle('hidden',!codeMode);
  $('sceneExplorer').classList.toggle('hidden',!sceneMode);
  $('dataExplorer').classList.toggle('hidden',!dataMode);

  $('codeInspector').classList.toggle('hidden',!codeMode);
  $('sceneInspector').classList.toggle('hidden',!sceneMode);
  $('dataInspector').classList.toggle('hidden',!dataMode);

  $('codeTab').classList.toggle('active',codeMode);
  $('sceneTab').classList.toggle('active',sceneMode);
  $('dataTab').classList.toggle('active',dataMode);

  document.body.classList.toggle('scene-mode',sceneMode);
  document.body.classList.toggle('data-mode',dataMode);

  $('activeFileLabel').textContent=sceneMode
    ? 'scene-data.js'
    : dataMode
      ? 'game-config.js'
      : activeFile;

  $('cursorInfo').textContent=sceneMode
    ? (canEditScene()?'SCENE EDITOR':'SCENE VIEW · READ ONLY')
    : dataMode
      ? (canEditData()?'DATA EDITOR':'DATA VIEW · READ ONLY')
      : (canEditCode()?'READY':'READ ONLY · '+String(access?.role||'player').toUpperCase());

  setSceneEditorActive(sceneMode);
  updateStats();
}

function parseQuickToolsFromText(text){
  const read=(name,fallback)=>{
    const m=text.match(new RegExp(name+'\\s*:\\s*([0-9.]+)'));
    return m?m[1]:fallback;
  };
  $('toolBotCount').value=read('botCount',29);
  $('toolMapHalf').value=read('mapHalf',240);
  $('toolPlayerSpeed').value=read('playerSpeed',14);
  $('toolZoneSeconds').value=read('zoneShrinkSeconds',300);
}

function replaceGameNumber(text,name,value){
  const rx=new RegExp('('+name+'\\s*:\\s*)([0-9.]+)');
  return rx.test(text)?text.replace(rx,'$1'+value):text;
}

async function syncQuickTools(){
  let text=localStorage.getItem(draftKey('game-config.js'));
  if(!text){
    try{
      const response=await fetch('../game-config.js?studio='+Date.now(),{cache:'no-store'});
      text=await response.text();
    }catch{}
  }
  if(text) parseQuickToolsFromText(text);
}

async function loadFile(file,{ignoreDraft=false}={}){
  activeFile=file;
  $('activeFileLabel').textContent=workspaceMode==='code'?file:
    workspaceMode==='scene'?'scene-data.js':'game-config.js';
  document.querySelectorAll('.file-item').forEach(el=>el.classList.toggle('active',el.dataset.file===file));

  try{
    const response=await fetch(FILES[file]+'?studio='+Date.now(),{cache:'no-store'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    liveText=await response.text();

    const draft=ignoreDraft?null:localStorage.getItem(draftKey(file));
    $('codeEditor').value=draft ?? liveText;
    currentSource=draft!==null?'draft':'live';
    updateStats();
    if(file==='game-config.js') parseQuickToolsFromText($('codeEditor').value);
    log('Loaded '+file+(draft!==null?' · local draft':' · live'),'ok');
  }catch(error){
    $('codeEditor').value='';
    log('Failed to load '+file+': '+error.message,'error');
    setHealth('FILE ERROR','error');
  }
}

async function refreshMembers(){
  if(access?.role!=='owner') return;
  const {data,error}=await supabase.rpc('list_studio_members');
  if(error){log('Member list: '+error.message,'error');return;}

  const list=$('memberList');
  list.innerHTML='';
  for(const member of data||[]){
    const row=document.createElement('div');
    row.className='member-row';
    row.innerHTML='<div><strong>'+escapeHtml(member.display_name||'Player')+'</strong><small>ID '+escapeHtml(member.player_id)+'</small></div><b>'+escapeHtml(member.role)+'</b>';
    list.appendChild(row);
  }
  if(!(data||[]).length) list.innerHTML='<div class="inspector-note">No extra Studio members yet.</div>';
}

function escapeHtml(value){
  return String(value??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

async function copyText(text,label='CONTENT'){
  try{
    await navigator.clipboard.writeText(text);
  }catch{
    const temp=document.createElement('textarea');
    temp.value=text;
    temp.style.position='fixed';
    temp.style.opacity='0';
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
  }
  log(label+' copied to clipboard','ok');
}

function saveCurrent(){
  if(workspaceMode==='scene'){
    if(!canEditScene()){log('Scene is read-only for this role','error');return false;}
    const ok=saveSceneDraft();
    updateStats();
    return ok;
  }

  if(workspaceMode==='data'){
    if(!canEditData()){log('Data is read-only for this role','error');return false;}
    const ok=saveDataDraft();
    updateStats();
    return ok;
  }

  if(!canEditCode()){log('Code is read-only for this role','error');return false;}
  localStorage.setItem(draftKey(activeFile),$('codeEditor').value);
  currentSource='draft';
  updateStats();
  log('Code draft saved: '+activeFile,'ok');
  return true;
}

function copyCurrent(){
  if(workspaceMode==='scene'){
    return copyText(getGeneratedSceneModule(),'scene-data.js');
  }
  if(workspaceMode==='data'){
    return copyText(getGeneratedConfig(),'game-config.js');
  }
  return copyText($('codeEditor').value,activeFile);
}

function getVersions(){
  try{
    const value=JSON.parse(localStorage.getItem(VERSION_KEY)||'[]');
    return Array.isArray(value)?value:[];
  }catch{
    return [];
  }
}

function collectCodeDrafts(){
  const drafts={};
  for(const file of Object.keys(FILES)){
    const value=localStorage.getItem(draftKey(file));
    if(value!==null) drafts[file]=value;
  }
  if(workspaceMode==='code' && canEditCode()) drafts[activeFile]=$('codeEditor').value;
  return drafts;
}

function collectBackup(label='Manual snapshot'){
  return {
    format:'mini3d-studio-backup',
    version:1,
    createdAt:new Date().toISOString(),
    label,
    codeDrafts:collectCodeDrafts(),
    sceneDraft:localStorage.getItem(SCENE_KEY),
    dataDraft:localStorage.getItem(DATA_DRAFT_KEY)
  };
}

function createSnapshot(){
  saveCurrent();
  if(canEditScene()) saveSceneDraft();
  if(canEditData()) saveDataDraft();

  const versions=getVersions();
  versions.unshift(collectBackup('Snapshot '+new Date().toLocaleString()));
  localStorage.setItem(VERSION_KEY,JSON.stringify(versions.slice(0,20)));
  renderVersions();
  log('Local Studio snapshot created','ok');
}

function restoreBackup(backup){
  if(!backup || backup.format!=='mini3d-studio-backup') throw new Error('Invalid Studio backup');

  for(const file of Object.keys(FILES)) localStorage.removeItem(draftKey(file));
  for(const [file,text] of Object.entries(backup.codeDrafts||{})){
    if(FILES[file] && typeof text==='string') localStorage.setItem(draftKey(file),text);
  }

  if(typeof backup.sceneDraft==='string') localStorage.setItem(SCENE_KEY,backup.sceneDraft);
  else localStorage.removeItem(SCENE_KEY);

  if(typeof backup.dataDraft==='string') localStorage.setItem(DATA_DRAFT_KEY,backup.dataDraft);
  else localStorage.removeItem(DATA_DRAFT_KEY);
}

function renderVersions(){
  const list=$('versionsList');
  if(!list) return;
  const versions=getVersions();
  list.innerHTML='';

  if(!versions.length){
    list.innerHTML='<div class="version-empty">No local snapshots yet.</div>';
    return;
  }

  versions.forEach((version,index)=>{
    const row=document.createElement('div');
    row.className='version-row';
    const date=new Date(version.createdAt);
    row.innerHTML='<div><strong>'+escapeHtml(version.label||('Snapshot '+(index+1)))+'</strong><small>'+escapeHtml(date.toLocaleString())+' · '+Object.keys(version.codeDrafts||{}).length+' code drafts</small></div>';

    const restore=document.createElement('button');
    restore.textContent='RESTORE';
    restore.addEventListener('click',()=>{
      if(!confirm('Restore this Studio snapshot? Current local drafts will be replaced.')) return;
      try{
        restoreBackup(version);
        location.reload();
      }catch(error){
        log('Restore failed: '+error.message,'error');
      }
    });
    row.appendChild(restore);
    list.appendChild(row);
  });
}

function exportBackup(){
  saveCurrent();
  if(canEditScene()) saveSceneDraft();
  if(canEditData()) saveDataDraft();

  const backup=collectBackup('Exported backup');
  backup.history=getVersions().slice(0,10);

  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='mini3d-studio-backup-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  log('Portable Studio backup exported','ok');
}

async function importBackupFile(file){
  try{
    const text=await file.text();
    const backup=JSON.parse(text);
    if(backup?.format!=='mini3d-studio-backup' || backup.version!==1) throw new Error('Unsupported backup file');
    if(!confirm('Import this Studio backup? Current local drafts will be replaced.')) return;
    restoreBackup(backup);
    if(Array.isArray(backup.history)) localStorage.setItem(VERSION_KEY,JSON.stringify(backup.history.slice(0,20)));
    location.reload();
  }catch(error){
    log('Import failed: '+error.message,'error');
  }
}

function findInCode(){
  if(workspaceMode!=='code') setWorkspaceMode('code');
  const query=$('codeFindInput').value;
  if(!query) return;

  const editor=$('codeEditor');
  const text=editor.value;
  let index=text.indexOf(query,editor.selectionEnd);
  if(index<0) index=text.indexOf(query,0);
  if(index<0){
    log('Find: no match for "'+query+'"','error');
    return;
  }

  editor.focus();
  editor.setSelectionRange(index,index+query.length);
  const line=text.slice(0,index).split('\n').length;
  $('cursorInfo').textContent='Found · Ln '+line;
}

async function applyQuickTools(){
  if(!canEditCode()){
    log('Quick Tools require OWNER or DEVELOPER role','error');
    return;
  }

  let text=localStorage.getItem(draftKey('game-config.js'));
  if(text===null){
    try{
      const response=await fetch('../game-config.js?studio='+Date.now(),{cache:'no-store'});
      text=await response.text();
    }catch(error){
      log('Could not load game-config.js','error');
      return;
    }
  }

  text=replaceGameNumber(text,'botCount',Number($('toolBotCount').value));
  text=replaceGameNumber(text,'mapHalf',Number($('toolMapHalf').value));
  text=replaceGameNumber(text,'playerSpeed',Number($('toolPlayerSpeed').value));
  text=replaceGameNumber(text,'zoneShrinkSeconds',Number($('toolZoneSeconds').value));
  localStorage.setItem(draftKey('game-config.js'),text);

  setWorkspaceMode('code');
  await loadFile('game-config.js');
  log('Quick Tools updated game-config.js draft','ok');
}

async function boot(){
  const {data:{session:nextSession}}=await supabase.auth.getSession();
  session=nextSession;

  if(!session){
    $('studioShell').classList.add('hidden');
    $('gate').classList.remove('hidden');
    setGate('Sign in with the game account that has Studio access.',true);
    return;
  }

  const {data,error}=await supabase.rpc('get_studio_access');
  if(error){
    setGate('Studio access check failed: '+error.message);
    return;
  }

  access=Array.isArray(data)?data[0]:data;
  const allowed=['owner','developer','builder','tester'].includes(access?.role);

  if(!allowed){
    $('studioShell').classList.add('hidden');
    $('gate').classList.remove('hidden');
    setGate('Access denied. This account is a normal PLAYER.');
    return;
  }

  $('gate').classList.add('hidden');
  $('studioShell').classList.remove('hidden');
  $('roleChip').textContent=String(access.role).toUpperCase();
  $('studioIdentity').textContent=(access.display_name||'PLAYER')+' · ID '+(access.player_id||'--------');
  $('ownerPanel').classList.toggle('hidden',access.role!=='owner');

  if(!studioReady){
    initSceneEditor({
      role:access.role,
      log,
      onStateChange:status=>{
        sceneStatus=status;
        if(workspaceMode==='scene') updateStats();
      }
    });

    initDataEditor({
      role:access.role,
      log,
      onStateChange:status=>{
        dataStatus=status;
        if(workspaceMode==='data') updateStats();
      }
    });

    studioReady=true;
  }else{
    setSceneEditorRole(access.role);
    setDataEditorRole(access.role);
  }

  updateRolePermissions();
  log('Studio v1 access granted: '+String(access.role).toUpperCase(),'ok');
  await loadFile(activeFile);
  await syncQuickTools();
  await refreshMembers();

  if(access.role==='builder' || access.role==='tester') setWorkspaceMode('scene');
  else setWorkspaceMode(workspaceMode);
}

$('studioSignIn').addEventListener('click',async()=>{
  await supabase.auth.signInWithOAuth({
    provider:'google',
    options:{redirectTo:window.location.href}
  });
});

$('codeTab').addEventListener('click',()=>setWorkspaceMode('code'));
$('sceneTab').addEventListener('click',()=>setWorkspaceMode('scene'));
$('dataTab').addEventListener('click',()=>setWorkspaceMode('data'));

document.querySelectorAll('.file-item').forEach(btn=>{
  btn.addEventListener('click',()=>{
    setWorkspaceMode('code');
    loadFile(btn.dataset.file);
  });
});

$('codeEditor').addEventListener('input',()=>{
  if(!canEditCode()) return;
  currentSource='draft';
  updateStats();

  clearTimeout(codeAutosaveTimer);
  codeAutosaveTimer=setTimeout(()=>{
    localStorage.setItem(draftKey(activeFile),$('codeEditor').value);
  },650);

  if(activeFile==='game-config.js') parseQuickToolsFromText($('codeEditor').value);
});

$('codeEditor').addEventListener('keyup',()=>{
  if(workspaceMode!=='code') return;
  const el=$('codeEditor');
  const before=el.value.slice(0,el.selectionStart);
  const line=before.split('\n').length;
  const col=before.length-before.lastIndexOf('\n');
  $('cursorInfo').textContent=(canEditCode()?'':'READ ONLY · ')+'Ln '+line+', Col '+col;
});

$('saveDraftBtn').addEventListener('click',saveCurrent);
$('copyCurrentBtn').addEventListener('click',copyCurrent);
$('snapshotBtn').addEventListener('click',createSnapshot);
$('versionsBtn').addEventListener('click',()=>{
  renderVersions();
  $('versionsOverlay').classList.remove('hidden');
});
$('versionsClose').addEventListener('click',()=>$('versionsOverlay').classList.add('hidden'));
$('versionsOverlay').addEventListener('click',event=>{
  if(event.target===$('versionsOverlay')) $('versionsOverlay').classList.add('hidden');
});

$('exportBtn').addEventListener('click',exportBackup);
$('importBtn').addEventListener('click',()=>$('importFileInput').click());
$('importFileInput').addEventListener('change',()=>{
  const file=$('importFileInput').files?.[0];
  if(file) importBackupFile(file);
  $('importFileInput').value='';
});

$('undoBtn').addEventListener('click',()=>{
  if(workspaceMode==='scene') undoScene();
  else if(workspaceMode==='code'){
    $('codeEditor').focus();
    document.execCommand?.('undo');
  }
});
$('redoBtn').addEventListener('click',()=>{
  if(workspaceMode==='scene') redoScene();
  else if(workspaceMode==='code'){
    $('codeEditor').focus();
    document.execCommand?.('redo');
  }
});

$('codeFindBtn').addEventListener('click',findInCode);
$('codeFindInput').addEventListener('keydown',event=>{
  if(event.key==='Enter') findInCode();
});

$('playTestBtn').addEventListener('click',()=>{
  if(canEditScene()) saveSceneDraft();
  if(canEditData()) saveDataDraft();
  if(workspaceMode==='code' && currentSource==='draft'){
    log('Code draft is not executed automatically. Copy it into the source file first.','error');
  }
  window.open('../?studioTest=1','_blank','noopener');
});

$('applyQuickTools').addEventListener('click',applyQuickTools);

$('resetDataBtn').addEventListener('click',()=>{
  if(!canEditData()) return;
  if(!confirm('Reset Data draft to the live game defaults?')) return;
  resetDataDraft();
  updateStats();
});

$('memberPlayerId').addEventListener('input',()=>{
  $('memberPlayerId').value=$('memberPlayerId').value.replace(/\D/g,'').slice(0,8);
});

$('memberApply').addEventListener('click',async()=>{
  if(access?.role!=='owner') return;

  const playerId=$('memberPlayerId').value.trim();
  const role=$('memberRole').value;
  if(!/^\d{8}$/.test(playerId)){
    log('Enter a valid 8-digit Player ID','error');
    return;
  }

  $('memberApply').disabled=true;
  const {error}=await supabase.rpc('set_studio_member',{
    target_player_id:playerId,
    target_role:role
  });
  $('memberApply').disabled=false;

  if(error){
    log('Access update failed: '+error.message,'error');
    return;
  }

  log('Studio access updated for '+playerId+' → '+role,'ok');
  $('memberPlayerId').value='';
  await refreshMembers();
});

$('clearConsole').addEventListener('click',()=>$('consoleOutput').innerHTML='');

addEventListener('keydown',event=>{
  const tag=event.target?.tagName;
  const typing=['INPUT','TEXTAREA','SELECT'].includes(tag);

  if((event.ctrlKey||event.metaKey) && event.code==='KeyS'){
    event.preventDefault();
    saveCurrent();
    return;
  }

  if(workspaceMode==='scene' && !typing){
    if((event.ctrlKey||event.metaKey) && event.code==='KeyZ'){
      event.preventDefault();
      event.shiftKey?redoScene():undoScene();
    }else if((event.ctrlKey||event.metaKey) && event.code==='KeyY'){
      event.preventDefault();
      redoScene();
    }else if((event.ctrlKey||event.metaKey) && event.code==='KeyD'){
      event.preventDefault();
      $('sceneDuplicateBtn').click();
    }else if(event.code==='Delete'){
      event.preventDefault();
      $('sceneDeleteBtn').click();
    }else if(event.code==='KeyF'){
      event.preventDefault();
      $('sceneFocusBtn').click();
    }else if(event.code==='KeyW'){
      $('sceneMoveMode').click();
    }else if(event.code==='KeyE'){
      $('sceneRotateMode').click();
    }else if(event.code==='KeyR'){
      $('sceneScaleMode').click();
    }
  }
});

supabase.auth.onAuthStateChange(()=>queueMicrotask(boot));
boot();
