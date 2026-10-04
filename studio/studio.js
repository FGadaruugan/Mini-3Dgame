import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../supabase-config.js';

const $=id=>document.getElementById(id);
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

const FILES={
  'game.js':'../game.js',
  'style.css':'../style.css',
  'profile.js':'../profile.js',
  'index.html':'../index.html'
};

let session=null;
let access=null;
let activeFile='game.js';
let liveText='';
let currentSource='live';

function log(message,type=''){
  const row=document.createElement('div');
  row.className='log-line '+type;
  row.textContent='['+new Date().toLocaleTimeString()+'] '+message;
  $('consoleOutput').appendChild(row);
  $('consoleOutput').scrollTop=$('consoleOutput').scrollHeight;
}

function setGate(text,signIn=false){
  $('gateStatus').textContent=text;
  $('studioSignIn').classList.toggle('hidden',!signIn);
}

function draftKey(file){return 'mini3d-studio-draft:'+file;}

function updateStats(){
  const text=$('codeEditor').value;
  $('codeStats').textContent=(text.split('\n').length)+' lines · '+text.length+' chars';
  $('fileState').textContent=currentSource==='draft'?'DRAFT':'LIVE';
}

function parseQuickTools(){
  if(activeFile!=='game.js') return;
  const text=$('codeEditor').value;
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

async function loadFile(file,{ignoreDraft=false}={}){
  activeFile=file;
  $('activeFileLabel').textContent=file;
  document.querySelectorAll('.file-item').forEach(el=>el.classList.toggle('active',el.dataset.file===file));

  try{
    const response=await fetch(FILES[file]+'?studio='+Date.now(),{cache:'no-store'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    liveText=await response.text();

    const draft=ignoreDraft?null:localStorage.getItem(draftKey(file));
    $('codeEditor').value=draft ?? liveText;
    currentSource=draft!==null?'draft':'live';
    updateStats();
    parseQuickTools();
    log('Loaded '+file+(draft!==null?' from local draft':' from live game'),'ok');
  }catch(error){
    $('codeEditor').value='';
    log('Failed to load '+file+': '+error.message,'error');
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
  return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
}

async function boot(){
  const {data:{session:nextSession}}=await supabase.auth.getSession();
  session=nextSession;

  if(!session){
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
    setGate('Access denied. This account is a normal PLAYER.');
    return;
  }

  $('gate').classList.add('hidden');
  $('studioShell').classList.remove('hidden');
  $('roleChip').textContent=String(access.role).toUpperCase();
  $('studioIdentity').textContent=(access.display_name||'PLAYER')+' · ID '+(access.player_id||'--------');
  $('ownerPanel').classList.toggle('hidden',access.role!=='owner');

  log('Studio access granted: '+String(access.role).toUpperCase(),'ok');
  await loadFile('game.js');
  await refreshMembers();
}

$('studioSignIn').addEventListener('click',async()=>{
  await supabase.auth.signInWithOAuth({
    provider:'google',
    options:{redirectTo:window.location.href}
  });
});

document.querySelectorAll('.file-item').forEach(btn=>{
  btn.addEventListener('click',()=>loadFile(btn.dataset.file));
});

$('codeEditor').addEventListener('input',()=>{
  currentSource='draft';
  updateStats();
  if(activeFile==='game.js') parseQuickTools();
});

$('codeEditor').addEventListener('keyup',()=>{
  const el=$('codeEditor');
  const before=el.value.slice(0,el.selectionStart);
  const line=before.split('\n').length;
  const col=before.length-before.lastIndexOf('\n');
  $('cursorInfo').textContent='Ln '+line+', Col '+col;
});

$('saveDraftBtn').addEventListener('click',()=>{
  localStorage.setItem(draftKey(activeFile),$('codeEditor').value);
  currentSource='draft';
  updateStats();
  log('Draft saved locally: '+activeFile,'ok');
});

$('discardDraftBtn').addEventListener('click',()=>{
  localStorage.removeItem(draftKey(activeFile));
  loadFile(activeFile,{ignoreDraft:true});
});

$('playTestBtn').addEventListener('click',()=>window.open('../','_blank','noopener'));

$('applyQuickTools').addEventListener('click',()=>{
  if(activeFile!=='game.js'){
    log('Quick Tools only work on game.js','error');
    return;
  }

  let text=$('codeEditor').value;
  text=replaceGameNumber(text,'botCount',Number($('toolBotCount').value));
  text=replaceGameNumber(text,'mapHalf',Number($('toolMapHalf').value));
  text=replaceGameNumber(text,'playerSpeed',Number($('toolPlayerSpeed').value));
  text=replaceGameNumber(text,'zoneShrinkSeconds',Number($('toolZoneSeconds').value));
  $('codeEditor').value=text;
  currentSource='draft';
  updateStats();
  localStorage.setItem(draftKey(activeFile),text);
  log('Quick Tools applied to local game.js draft','ok');
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

supabase.auth.onAuthStateChange(()=>queueMicrotask(boot));
boot();
