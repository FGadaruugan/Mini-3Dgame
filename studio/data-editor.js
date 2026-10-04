import { GAME, WEAPONS, CAR_CONFIG, LOOT_CONFIG } from '../game-config.js';

export const DATA_DRAFT_KEY='mini3d-studio-data-v1';

const $=id=>document.getElementById(id);
const clone=value=>JSON.parse(JSON.stringify(value));

const DEFAULT_DATA={
  version:1,
  game:clone(GAME),
  weapons:clone(WEAPONS),
  car:clone(CAR_CONFIG),
  loot:clone(LOOT_CONFIG)
};

const GAME_FIELDS=[
  ['mapHalf','Map half-size',60,1000,1],
  ['playerSpeed','Player speed',1,60,.5],
  ['sprintSpeed','Sprint speed',1,80,.5],
  ['botSpeed','Bot speed',1,40,.5],
  ['maxHp','Max HP',1,1000,1],
  ['botCount','Bot count',1,99,1],
  ['botDamage','Bot damage',0,100,1],
  ['botFireMinMs','Bot fire min ms',50,10000,10],
  ['botFireMaxMs','Bot fire max ms',50,10000,10],
  ['zoneStart','Zone start',10,1000,1],
  ['zoneEnd','Zone end',1,500,1],
  ['zoneShrinkSeconds','Zone seconds',10,3600,10],
  ['zoneDamagePerSecond','Zone damage/sec',0,100,1],
  ['spawnProtectionSeconds','Spawn protection',0,60,.5]
];

const WEAPON_FIELDS=[
  ['name','Name','text'],
  ['ammoType','Ammo','select'],
  ['mag','Mag','number',1,200,1],
  ['damage','Damage','number',1,500,1],
  ['fireDelay','Fire ms','number',20,3000,5],
  ['reloadMs','Reload ms','number',100,10000,50],
  ['range','Range','number',10,1000,5]
];

let data=loadDraft();
let canEdit=false;
let dirty=false;
let logFn=()=>{};
let stateFn=()=>{};
let initialized=false;

function loadDraft(){
  try{
    const saved=JSON.parse(localStorage.getItem(DATA_DRAFT_KEY)||'null');
    if(saved?.version===1 && saved.game && saved.weapons && saved.car && saved.loot){
      return sanitize(saved);
    }
  }catch{}
  return clone(DEFAULT_DATA);
}

function finite(value,fallback=0){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}

function sanitize(input){
  const next=clone(DEFAULT_DATA);
  for(const [key,,min,max] of GAME_FIELDS){
    next.game[key]=Math.min(max,Math.max(min,finite(input.game?.[key],next.game[key])));
  }

  for(const [id,base] of Object.entries(next.weapons)){
    const source=input.weapons?.[id]||{};
    base.name=String(source.name||base.name).slice(0,24);
    base.ammoType=['5.56','9mm'].includes(source.ammoType)?source.ammoType:base.ammoType;
    base.mag=Math.max(1,Math.min(200,finite(source.mag,base.mag)));
    base.damage=Math.max(1,Math.min(500,finite(source.damage,base.damage)));
    base.fireDelay=Math.max(20,Math.min(3000,finite(source.fireDelay,base.fireDelay)));
    base.reloadMs=Math.max(100,Math.min(10000,finite(source.reloadMs,base.reloadMs)));
    base.range=Math.max(10,Math.min(1000,finite(source.range,base.range)));
    base.id=id;
  }

  next.car.maxSpeed=Math.max(1,Math.min(100,finite(input.car?.maxSpeed,next.car.maxSpeed)));
  next.car.reverseSpeed=Math.max(1,Math.min(50,finite(input.car?.reverseSpeed,next.car.reverseSpeed)));
  next.car.acceleration=Math.max(1,Math.min(100,finite(input.car?.acceleration,next.car.acceleration)));
  next.car.turnRate=Math.max(.1,Math.min(5,finite(input.car?.turnRate,next.car.turnRate)));

  next.loot.weaponCount=Math.max(0,Math.min(300,finite(input.loot?.weaponCount,next.loot.weaponCount)));
  next.loot.ammoCount=Math.max(0,Math.min(500,finite(input.loot?.ammoCount,next.loot.ammoCount)));
  next.loot.bandageCount=Math.max(0,Math.min(300,finite(input.loot?.bandageCount,next.loot.bandageCount)));
  next.loot.armorCount=Math.max(0,Math.min(300,finite(input.loot?.armorCount,next.loot.armorCount)));
  return next;
}

function escapeHtml(value){
  return String(value??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function renderGameSettings(){
  return GAME_FIELDS.map(([key,label,min,max,step])=>`
    <label class="data-field">
      <span>${escapeHtml(label)}</span>
      <input data-scope="game" data-key="${key}" type="number"
        min="${min}" max="${max}" step="${step}" value="${data.game[key]}" />
    </label>
  `).join('');
}

function renderWeaponRows(){
  return Object.entries(data.weapons).map(([id,w])=>`
    <tr data-weapon="${id}">
      <td><b>${id}</b></td>
      <td><input data-scope="weapon" data-id="${id}" data-key="name" value="${escapeHtml(w.name)}" maxlength="24" /></td>
      <td>
        <select data-scope="weapon" data-id="${id}" data-key="ammoType">
          <option value="5.56" ${w.ammoType==='5.56'?'selected':''}>5.56</option>
          <option value="9mm" ${w.ammoType==='9mm'?'selected':''}>9mm</option>
        </select>
      </td>
      <td><input data-scope="weapon" data-id="${id}" data-key="mag" type="number" min="1" max="200" value="${w.mag}" /></td>
      <td><input data-scope="weapon" data-id="${id}" data-key="damage" type="number" min="1" max="500" value="${w.damage}" /></td>
      <td><input data-scope="weapon" data-id="${id}" data-key="fireDelay" type="number" min="20" max="3000" value="${w.fireDelay}" /></td>
      <td><input data-scope="weapon" data-id="${id}" data-key="reloadMs" type="number" min="100" max="10000" value="${w.reloadMs}" /></td>
      <td><input data-scope="weapon" data-id="${id}" data-key="range" type="number" min="10" max="1000" value="${w.range}" /></td>
    </tr>
  `).join('');
}

function render(){
  const host=$('dataEditorHost');
  if(!host) return;

  host.innerHTML=`
    <div class="data-editor-scroll">
      <section class="data-section">
        <div class="data-section-head">
          <div><small>CORE</small><h2>GAME SETTINGS</h2></div>
          <span>game-config.js</span>
        </div>
        <div class="data-fields-grid">${renderGameSettings()}</div>
      </section>

      <section class="data-section">
        <div class="data-section-head">
          <div><small>BALANCE</small><h2>WEAPONS</h2></div>
          <span>5 weapons</span>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>ID</th><th>Name</th><th>Ammo</th><th>Mag</th><th>Damage</th><th>Fire ms</th><th>Reload</th><th>Range</th></tr></thead>
            <tbody>${renderWeaponRows()}</tbody>
          </table>
        </div>
      </section>

      <section class="data-section split-data">
        <div>
          <div class="data-section-head"><div><small>VEHICLE</small><h2>CAR</h2></div></div>
          <div class="data-fields-grid compact">
            ${[
              ['maxSpeed','Max speed',1,100,.5],
              ['reverseSpeed','Reverse speed',1,50,.5],
              ['acceleration','Acceleration',1,100,.5],
              ['turnRate','Turn rate',.1,5,.05]
            ].map(([key,label,min,max,step])=>`
              <label class="data-field"><span>${label}</span>
                <input data-scope="car" data-key="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${data.car[key]}" />
              </label>
            `).join('')}
          </div>
        </div>

        <div>
          <div class="data-section-head"><div><small>WORLD</small><h2>LOOT COUNTS</h2></div></div>
          <div class="data-fields-grid compact">
            ${[
              ['weaponCount','Weapons'],['ammoCount','Ammo'],['bandageCount','Bandages'],['armorCount','Armor']
            ].map(([key,label])=>`
              <label class="data-field"><span>${label}</span>
                <input data-scope="loot" data-key="${key}" type="number" min="0" max="500" step="1" value="${data.loot[key]}" />
              </label>
            `).join('')}
          </div>
        </div>
      </section>
    </div>
  `;

  bindInputs();
  updatePermissions();
}

function bindInputs(){
  $('dataEditorHost')?.querySelectorAll('input,select').forEach(input=>{
    input.addEventListener('input',()=>{
      if(!canEdit) return;
      const scope=input.dataset.scope;
      const key=input.dataset.key;
      const value=input.type==='number'?finite(input.value):input.value;

      if(scope==='game') data.game[key]=value;
      if(scope==='car') data.car[key]=value;
      if(scope==='loot') data.loot[key]=value;
      if(scope==='weapon'){
        const id=input.dataset.id;
        data.weapons[id][key]=value;
      }
      dirty=true;
      stateFn?.(getDataStatus());
    });
  });
}

function updatePermissions(){
  $('dataEditorHost')?.querySelectorAll('input,select').forEach(el=>el.disabled=!canEdit);
}

function jsValue(value,indent=0){
  if(Array.isArray(value)) return JSON.stringify(value);
  if(value && typeof value==='object'){
    const pad=' '.repeat(indent);
    const inner=' '.repeat(indent+2);
    const entries=Object.entries(value).map(([key,val])=>
      `${inner}${/^[A-Za-z_$][\w$]*$/.test(key)?key:JSON.stringify(key)}: ${jsValue(val,indent+2)}`
    );
    return `{\n${entries.join(',\n')}\n${pad}}`;
  }
  if(typeof value==='string') return JSON.stringify(value);
  return String(value);
}

export function getGeneratedConfig(){
  const clean=sanitize(data);
  return `export const GAME = ${jsValue(clean.game)};\n\nexport const WEAPONS = ${jsValue(clean.weapons)};\n\nexport const CAR_CONFIG = ${jsValue(clean.car)};\n\nexport const LOOT_CONFIG = ${jsValue(clean.loot)};\n`;
}

export function initDataEditor({role='tester',log=()=>{},onStateChange=()=>{}}={}){
  logFn=log;
  stateFn=onStateChange;
  canEdit=['owner','developer'].includes(role);
  if(!initialized){
    render();
    initialized=true;
  }else{
    updatePermissions();
  }
  stateFn(getDataStatus());
}

export function setDataEditorRole(role){
  canEdit=['owner','developer'].includes(role);
  updatePermissions();
}

export function saveDataDraft(){
  if(!canEdit) return false;
  data=sanitize(data);
  localStorage.setItem(DATA_DRAFT_KEY,JSON.stringify({
    ...data,
    updatedAt:new Date().toISOString()
  }));
  dirty=false;
  render();
  stateFn?.(getDataStatus());
  logFn('Data draft saved','ok');
  return true;
}

export function reloadDataDraft(){
  data=loadDraft();
  dirty=false;
  render();
  stateFn?.(getDataStatus());
  logFn('Data draft reloaded','ok');
}

export function resetDataDraft(){
  if(!canEdit) return false;
  localStorage.removeItem(DATA_DRAFT_KEY);
  data=clone(DEFAULT_DATA);
  dirty=true;
  render();
  stateFn?.(getDataStatus());
  logFn('Data reset to live defaults','ok');
  return true;
}

export function getDataStatus(){
  return {
    dirty,
    saved:Boolean(localStorage.getItem(DATA_DRAFT_KEY)),
    weapons:Object.keys(data.weapons).length
  };
}
