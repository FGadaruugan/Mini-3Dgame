import * as THREE from './vendor/three.module.min.js';
import {
  createHumanoidCharacter,
  getCharacterHitMeshes,
  getHitMultiplier,
  pulseCharacterAction,
  updateHumanoidAnimation
} from './character-system.js?v=20261007-player-rework2';

const $ = (id) => document.getElementById(id);
const UI = {
  hp: $('hp'), alive: $('alive'), kills: $('kills'), ammo: $('ammo'), reserve: $('reserve'),
  zoneInfo: $('zoneInfo'), reloadState: $('reloadState'), minimap: $('minimap'), hitmarker: $('hitmarker'),
  message: $('message'), startOverlay: $('startOverlay'), endOverlay: $('endOverlay'), endTitle: $('endTitle'), endText: $('endText'),
  startBtn: $('startBtn'), mobileStartBtn: $('mobileStartBtn'), restartBtn: $('restartBtn'), lobbyBtn: $('lobbyBtn'), fullscreenBtn: $('fullscreenBtn'), pauseBtn: $('pauseBtn'),
  lobbyHint: $('lobbyHint'), lobbyPlayers: $('lobbyPlayers'),
  hud: $('hud'), mobileControls: $('mobileControls'),
  movePad: $('movePad'), moveStick: $('moveStick'), lookPad: $('lookPad'), fireBtn: $('fireBtn'), reloadBtn: $('reloadBtn'),
  planeJumpBtn: $('planeJumpBtn'), jumpBtn: $('jumpBtn'),
  weaponName: $('weaponName'), ammoType: $('ammoType'),
  weaponSlot1: $('weaponSlot1'), weaponSlot2: $('weaponSlot2'),
  backpackBtn: $('backpackBtn'), backpackOverlay: $('backpackOverlay'), backpackClose: $('backpackClose'),
  bagWeapon1: $('bagWeapon1'), bagWeapon2: $('bagWeapon2'),
  armorValue: $('armorValue'), bandageValue: $('bandageValue'), backpackCapacity: $('backpackCapacity'),
  ammo556Value: $('ammo556Value'), ammo9Value: $('ammo9Value'), useBandageBag: $('useBandageBag'),
  lootPrompt: $('lootPrompt'), lootPromptText: $('lootPromptText'), pickupBtn: $('pickupBtn'),
  pickupMobileBtn: $('pickupMobileBtn'), bandageBtn: $('bandageBtn'),
  vehicleHud: $('vehicleHud'), vehicleSpeed: $('vehicleSpeed'), driveBtn: $('driveBtn'), driveMobileBtn: $('driveMobileBtn')
};
const mm = UI.minimap.getContext('2d');

const GAME = {
  mapHalf: 240,
  playerSpeed: 14,
  sprintSpeed: 18,
  botSpeed: 8,
  maxHp: 100,
  magSize: 30,
  reloadMs: 1500,
  fireDelayMs: 120,
  botCount: 29,
  bulletDamage: 28,
  botDamage: 8,
  botFireMinMs: 620,
  botFireMaxMs: 1050,
  zoneStart: 232,
  zoneEnd: 30,
  zoneShrinkSeconds: 300,
  zoneDamagePerSecond: 9,
  spawnProtectionSeconds: 4
};

const WEAPONS = {
  AR4:  { id:'AR4',  name:'AR-4',  ammoType:'5.56', mag:30, damage:27, fireDelay:105, reloadMs:1450, range:150 },
  AR7:  { id:'AR7',  name:'AR-7',  ammoType:'5.56', mag:30, damage:32, fireDelay:125, reloadMs:1550, range:155 },
  SMG9: { id:'SMG9', name:'SMG-9', ammoType:'9mm',  mag:35, damage:20, fireDelay:72,  reloadMs:1250, range:95  },
  DMR5: { id:'DMR5', name:'DMR-5', ammoType:'5.56', mag:20, damage:43, fireDelay:235, reloadMs:1700, range:190 },
  LMG5: { id:'LMG5', name:'LMG-5', ammoType:'5.56', mag:45, damage:25, fireDelay:92,  reloadMs:2150, range:145 }
};

const BACKPACK_MAX = 12;
let lootPickups = [];
let nearestLoot = null;
let lastPickupAt = 0;
let lastAutoPickupAt = 0;
const AUTO_PICKUP_RADIUS = 2.65;
const MANUAL_PICKUP_RADIUS = 6.5;
let activeWeaponSlot = 0;
let backpackOpen = false;
let backpackPauseRestore = false;
let inventory = createEmptyInventory();

let cars = [];
let activeCar = null;
let nearestCar = null;
let lastCarToggleAt = 0;

function createEmptyInventory() {
  return {
    weapons:[null,null],
    ammo:{'5.56':0,'9mm':0},
    bandage:0,
    armor:0
  };
}

let scene, camera, renderer, clock, player, ground, zoneRing, lobbyStage, lobbySpot;
let started = false, paused = false, ended = false;
let selectedMode = 'solo';
let yaw = Math.PI, pitch = -0.18, bodyYaw = 0, aiming = false;
let hp = GAME.maxHp, ammo = GAME.magSize, reserve = 120, kills = 0, reloading = false;
let lastShot = 0, elapsed = 0, spawnProtection = 0, lobbyTime = 0, lobbyCharacterYaw = -.28;
let countdownTimers = [];
let brPhase = 'lobby';
let plane = null;
let planeProgress = 0;
let playerDropped = false;
let verticalVelocity = 0;
let zoneElapsed = 0;
const planeStart = new THREE.Vector3(-285,72,-165);
const planeEnd = new THREE.Vector3(285,72,165);
let bots = [], colliders = [], tracers = [];
let multiplayer = false;
let multiplayerRoom = null;
let multiplayerRole = null;
let remotePlayer = null;
let remoteUserId = null;
let remoteTarget = {
  x:0, y:0, z:0, yaw:0, hp:100,
  alive:true, shielded:false, kills:0, role:null, timeRemaining:600
};
let lastNetStateSent = 0;

const ONEVONE_MATCH_SECONDS = 10 * 60;
const ONEVONE_KILL_LIMIT = 40;
const ONEVONE_RESPAWN_MS = 3000;
const ONEVONE_SHIELD_MS = 3000;

let multiplayerTimeRemaining = ONEVONE_MATCH_SECONDS;
let multiplayerLastClockAt = 0;
let multiplayerRespawnAt = 0;
let multiplayerShieldUntil = 0;
let multiplayerFinished = false;
let remoteAliveLast = null;
let remoteKills = 0;

let battleRoyaleWorldObjects = [];
let battleRoyaleColliders = [];
let oneVOneWorld = null;
let oneVOneOccluders = [];
let oneVOneSpawns = {
  host:{position:[0,0,52],yaw:Math.PI},
  guest:{position:[0,0,-52],yaw:0}
};
let activeMapHalf = GAME.mapHalf;

const keys = new Set();
const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3();
const SETTINGS_KEY = 'mini3d-settings-v1';
const DEFAULT_USER_SETTINGS = {
  sensitivity: {
    horizontal: 100,
    vertical: 100,
    ads: 75,
    firing: 85
  },
  controls: {
    move:   { x: 4,  y: 66, scale: 100, opacity: 60 },
    fire:   { x: 86, y: 72, scale: 100, opacity: 82 },
    reload: { x: 78, y: 56, scale: 100, opacity: 76 }
  },
  graphics: {
    preset: 'medium',
    shadows: true,
    renderDistance: 480,
    effects: 'medium',
    fpsLimit: 60
  }
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS));
}

function loadUserSettings() {
  const fallback = cloneDefaults();
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!saved) return fallback;
    return {
      sensitivity: { ...fallback.sensitivity, ...(saved.sensitivity || {}) },
      controls: {
        move: { ...fallback.controls.move, ...(saved.controls?.move || {}) },
        fire: { ...fallback.controls.fire, ...(saved.controls?.fire || {}) },
        reload: { ...fallback.controls.reload, ...(saved.controls?.reload || {}) }
      },
      graphics: {
        ...fallback.graphics,
        ...(saved.graphics || {})
      }
    };
  } catch {
    return fallback;
  }
}

let userSettings = loadUserSettings();
let selectedControl = 'fire';

function saveUserSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
}

const GRAPHICS_PRESETS = {
  low: { shadows:false, renderDistance:320, effects:'low', fpsLimit:60 },
  medium: { shadows:true, renderDistance:480, effects:'medium', fpsLimit:60 },
  high: { shadows:true, renderDistance:720, effects:'high', fpsLimit:120 }
};

let lastRenderFrameAt=0;

function graphicsPixelRatio() {
  const preset=userSettings.graphics?.preset || 'medium';
  if(preset==='low') return Math.min(devicePixelRatio,1);
  if(preset==='high') return Math.min(devicePixelRatio,2);
  return Math.min(devicePixelRatio,1.5);
}

function applyGraphicsSettings() {
  if(!userSettings.graphics) userSettings.graphics={...cloneDefaults().graphics};
  const graphics=userSettings.graphics;

  graphics.renderDistance=THREE.MathUtils.clamp(Number(graphics.renderDistance)||480,240,800);
  graphics.fpsLimit=[0,30,60,120].includes(Number(graphics.fpsLimit))
    ? Number(graphics.fpsLimit)
    : 60;
  graphics.effects=['low','medium','high'].includes(graphics.effects)
    ? graphics.effects
    : 'medium';
  graphics.shadows=Boolean(graphics.shadows);

  if(renderer){
    renderer.setPixelRatio(graphicsPixelRatio());
    renderer.setSize(innerWidth,innerHeight,false);
    renderer.shadowMap.enabled=graphics.shadows;
  }

  if(camera){
    camera.far=graphics.renderDistance;
    camera.updateProjectionMatrix();
  }

  if(scene?.fog){
    scene.fog.near=oneVOneWorld
      ? Math.min(85,graphics.renderDistance*.34)
      : Math.min(110,graphics.renderDistance*.30);
    scene.fog.far=graphics.renderDistance;
  }

  document.body.dataset.graphicsPreset=graphics.preset || 'custom';
  document.body.dataset.graphicsEffects=graphics.effects;
  lastRenderFrameAt=0;
}

function setGraphicsPreset(name) {
  const preset=GRAPHICS_PRESETS[name];
  if(!preset) return;
  userSettings.graphics={...userSettings.graphics,...preset,preset:name};
  saveUserSettings();
  applyGraphicsSettings();
  syncSettingsUi();
}

function markGraphicsCustom() {
  if(!userSettings.graphics) userSettings.graphics={...cloneDefaults().graphics};
  userSettings.graphics.preset='custom';
}

function syncAccountSettingsUi() {
  const account=window.Mini3DProfile?.getAccountState?.() || {
    signedIn:false,
    configured:true,
    displayName:'Guest Player',
    playerId:null,
    avatarUrl:null,
    status:'NOT SIGNED IN'
  };

  const name=document.getElementById('settingsAccountName');
  const id=document.getElementById('settingsAccountId');
  const status=document.getElementById('settingsAccountStatus');
  const avatar=document.getElementById('settingsAccountAvatar');
  const auth=document.getElementById('settingsAccountAuth');
  const copy=document.getElementById('settingsCopyPlayerId');

  if(name) name.textContent=account.displayName || 'Guest Player';
  if(id) id.textContent='PLAYER ID · '+(account.playerId || '--------');
  if(status){
    status.textContent=account.status || (account.signedIn?'ONLINE':'NOT SIGNED IN');
    status.dataset.state=account.signedIn?'ok':'';
  }
  if(auth){
    auth.textContent=account.signedIn?'SIGN OUT':'SIGN IN WITH GOOGLE';
    auth.dataset.mode=account.signedIn?'signout':'signin';
    auth.disabled=account.configured===false;
  }
  if(copy) copy.disabled=!account.playerId;

  if(avatar){
    if(account.avatarUrl){
      avatar.style.backgroundImage='url("'+String(account.avatarUrl).replaceAll('"','%22')+'")';
      avatar.style.backgroundSize='cover';
      avatar.style.backgroundPosition='center';
      avatar.textContent='';
    }else{
      avatar.style.backgroundImage='';
      avatar.textContent='P1';
    }
  }
}

function getSensitivityFactor() {
  if (aiming) return userSettings.sensitivity.ads / 100;
  if (mobile.firing) return userSettings.sensitivity.firing / 100;
  return 1;
}

function applyControlLayout() {
  const map = {
    move: { el: UI.movePad, base: 122 },
    fire: { el: UI.fireBtn, base: 82 },
    reload: { el: UI.reloadBtn, base: 58 }
  };

  for (const [name, meta] of Object.entries(map)) {
    const cfg = userSettings.controls[name];
    const el = meta.el;
    if (!el || !cfg) continue;

    const size = meta.base * (cfg.scale / 100);
    el.style.left = cfg.x + '%';
    el.style.top = cfg.y + '%';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.opacity = String(cfg.opacity / 100);
  }

  if (UI.movePad && UI.moveStick) {
    const padSize = 122 * (userSettings.controls.move.scale / 100);
    const stickSize = Math.min(50, padSize * .42);
    UI.moveStick.style.width = stickSize + 'px';
    UI.moveStick.style.height = stickSize + 'px';
    UI.moveStick.style.left = ((padSize - stickSize) / 2) + 'px';
    UI.moveStick.style.top = ((padSize - stickSize) / 2) + 'px';
  }
}


const mobile = {
  movePointer: null, lookPointer: null, firePointer: null,
  moveX: 0, moveY: 0, lookLastX: 0, lookLastY: 0, firing: false
};

function getActiveWeaponSlot() {
  return inventory.weapons[activeWeaponSlot] || null;
}

function getWeaponDef(slot=getActiveWeaponSlot()) {
  return slot ? WEAPONS[slot.id] : null;
}

function syncLegacyAmmo() {
  const slot=getActiveWeaponSlot();
  const def=getWeaponDef(slot);
  ammo=slot ? slot.magAmmo : 0;
  reserve=def
    ? (multiplayer ? Infinity : (inventory.ammo[def.ammoType] || 0))
    : 0;
}

function backpackUsed() {
  const weapons=inventory.weapons.filter(Boolean).length*2;
  const ammoStacks=Math.ceil((inventory.ammo['5.56']||0)/30)+Math.ceil((inventory.ammo['9mm']||0)/30);
  return weapons+ammoStacks+inventory.bandage+(inventory.armor>0?1:0);
}

function canAddBackpackUnits(units=1) {
  return backpackUsed()+units<=BACKPACK_MAX;
}

function setActiveWeaponSlot(index) {
  if(index<0 || index>1) return;
  activeWeaponSlot=index;
  reloading=false;
  UI.reloadState.textContent='';
  syncLegacyAmmo();
  updateHud();
}

function clearLoot() {
  lootPickups.forEach(item=>scene?.remove(item));
  lootPickups=[];
  nearestLoot=null;
  UI.lootPrompt?.classList.add('hidden');
  UI.pickupMobileBtn?.classList.add('hidden');
}

function createLootMesh(kind,payload) {
  const group=new THREE.Group();
  let mesh;
  if(kind==='weapon'){
    mesh=new THREE.Mesh(
      new THREE.BoxGeometry(1.45,.22,.34),
      new THREE.MeshStandardMaterial({color:0x303943,roughness:.42,metalness:.25})
    );
  } else if(kind==='ammo'){
    mesh=new THREE.Mesh(
      new THREE.BoxGeometry(.62,.34,.48),
      new THREE.MeshStandardMaterial({color:payload.ammoType==='5.56'?0xb89f45:0x769b55,roughness:.55})
    );
  } else if(kind==='bandage'){
    mesh=new THREE.Mesh(
      new THREE.CylinderGeometry(.32,.32,.22,10),
      new THREE.MeshStandardMaterial({color:0xf2f2f2,roughness:.8})
    );
    mesh.rotation.z=Math.PI/2;
  } else {
    mesh=new THREE.Mesh(
      new THREE.BoxGeometry(.82,.95,.24),
      new THREE.MeshStandardMaterial({color:0x36556e,roughness:.65})
    );
  }
  mesh.castShadow=false;
  group.add(mesh);

  const ring=new THREE.Mesh(
    new THREE.RingGeometry(.55,.72,18),
    new THREE.MeshBasicMaterial({
      color:kind==='weapon'?0xf1c84b:kind==='ammo'?0x9bd36a:kind==='bandage'?0xffffff:0x65b9ff,
      transparent:true,
      opacity:.78,
      side:THREE.DoubleSide
    })
  );
  ring.rotation.x=-Math.PI/2;
  ring.position.y=-.38;
  group.add(ring);

  group.position.y=.45;
  group.userData.loot={kind,...payload};
  group.className='loot-pickup';
  scene.add(group);
  return group;
}

function spawnLootAt(position,kind,payload) {
  const item=createLootMesh(kind,payload);
  item.position.set(position.x,.45,position.z);
  lootPickups.push(item);
}

function spawnBattleRoyaleLoot() {
  clearLoot();

  const weaponIds=Object.keys(WEAPONS);
  const clusters=[
    [0,0],[-35,-28],[34,-34],[-42,32],[37,33],[5,47],[-6,-54],
    [-150,-125],[-118,-150],[148,122],[118,150],[-150,115],[150,-130],
    [-85,138],[88,-142]
  ];

  const clusterPoint=(index,spread=11)=>{
    const [cx,cz]=clusters[index%clusters.length];
    for(let attempt=0;attempt<20;attempt++){
      const x=cx+THREE.MathUtils.randFloat(-spread,spread);
      const z=cz+THREE.MathUtils.randFloat(-spread,spread);
      if(isSafeLandingSpot(x,z,1.6)) return new THREE.Vector3(x,0,z);
    }
    return randomGroundPoint(28);
  };

  for(let i=0;i<30;i++){
    spawnLootAt(clusterPoint(i,13),'weapon',{weaponId:weaponIds[i%weaponIds.length]});
  }

  for(let i=0;i<42;i++){
    const ammoType=i%3===0?'9mm':'5.56';
    spawnLootAt(clusterPoint(i+3,14),'ammo',{ammoType,amount:ammoType==='9mm'?35:30});
  }

  for(let i=0;i<16;i++){
    spawnLootAt(clusterPoint(i+7,12),'bandage',{amount:1});
  }

  for(let i=0;i<10;i++){
    spawnLootAt(clusterPoint(i+11,12),'armor',{protection:i%4===0?40:25});
  }
}

function describeLoot(data) {
  if(data.kind==='weapon') return WEAPONS[data.weaponId]?.name || 'WEAPON';
  if(data.kind==='ammo') return data.ammoType.toUpperCase()+' AMMO · '+data.amount;
  if(data.kind==='bandage') return 'BANDAGE';
  if(data.kind==='armor') return 'ARMOR VEST · '+data.protection+'%';
  return 'ITEM';
}

function findNearestLoot(maxDist=MANUAL_PICKUP_RADIUS, filter=null) {
  let best=null;
  let bestDist=maxDist;

  for(const item of lootPickups){
    if(!item?.visible || !item.userData?.loot) continue;
    if(filter && !filter(item.userData.loot,item)) continue;

    const dist=Math.hypot(
      item.position.x-player.position.x,
      item.position.z-player.position.z
    );

    if(dist<=bestDist){
      best=item;
      bestDist=dist;
    }
  }

  return best;
}

function removeLootItem(item) {
  if(!item) return;
  scene.remove(item);
  lootPickups=lootPickups.filter(x=>x!==item);
  if(nearestLoot===item) nearestLoot=null;
}

function canAutoPickup(data) {
  if(!data) return false;

  if(data.kind==='weapon'){
    return inventory.weapons.some(slot=>!slot);
  }

  if(data.kind==='ammo'){
    const current=inventory.ammo[data.ammoType]||0;
    const stackCost=current%30===0 ? 1 : 0;
    return canAddBackpackUnits(stackCost);
  }

  if(data.kind==='bandage'){
    return canAddBackpackUnits(1);
  }

  if(data.kind==='armor'){
    return (data.protection||25)>inventory.armor;
  }

  return false;
}

function applyLootItem(item,{auto=false,allowWeaponSwap=false}={}) {
  if(!item?.userData?.loot) return false;

  const data=item.userData.loot;

  if(data.kind==='weapon'){
    let slotIndex=inventory.weapons.findIndex(slot=>!slot);

    if(slotIndex<0){
      if(!allowWeaponSwap) return false;
      slotIndex=activeWeaponSlot;
    }

    const def=WEAPONS[data.weaponId];
    if(!def) return false;

    const replacing=Boolean(inventory.weapons[slotIndex]);

    // A picked weapon contains one loaded magazine. Reserve ammo remains a separate loot resource.
    inventory.weapons[slotIndex]={
      id:data.weaponId,
      magAmmo:def.mag
    };

    setActiveWeaponSlot(slotIndex);
    removeLootItem(item);
    showMessage(
      replacing
        ? 'SWAPPED → '+def.name
        : (auto?'AUTO PICK · ':'PICKED ')+def.name,
      600
    );
    return true;
  }

  if(data.kind==='ammo'){
    const current=inventory.ammo[data.ammoType]||0;
    const stackCost=current%30===0 ? 1 : 0;
    if(!canAddBackpackUnits(stackCost)) return false;

    inventory.ammo[data.ammoType]=current+(data.amount||0);
    removeLootItem(item);
    syncLegacyAmmo();
    showMessage((auto?'AUTO · +':'+')+(data.amount||0)+' '+data.ammoType.toUpperCase(),420);
    return true;
  }

  if(data.kind==='bandage'){
    if(!canAddBackpackUnits(1)) return false;

    inventory.bandage+=data.amount||1;
    removeLootItem(item);
    showMessage(auto?'AUTO · BANDAGE':'PICKED BANDAGE',420);
    return true;
  }

  if(data.kind==='armor'){
    const protection=data.protection||25;
    if(protection<=inventory.armor){
      if(auto) return false;
      showMessage('ARMOR '+inventory.armor+'% IS BETTER',500);
      return false;
    }

    inventory.armor=protection;
    removeLootItem(item);
    showMessage((auto?'AUTO · ':'')+'ARMOR '+inventory.armor+'%',500);
    return true;
  }

  return false;
}

function autoPickupNearbyLoot() {
  if(multiplayer || brPhase!=='ground' || backpackOpen || ended) return;

  const now=performance.now();
  if(now-lastAutoPickupAt<120) return;
  lastAutoPickupAt=now;

  // Pick only one item per tick to avoid swallowing an entire pile instantly.
  const item=findNearestLoot(AUTO_PICKUP_RADIUS,(data)=>canAutoPickup(data));
  if(!item) return;

  if(applyLootItem(item,{auto:true,allowWeaponSwap:false})){
    updateHud();
  }
}

function updateLootInteraction() {
  if(multiplayer || brPhase!=='ground' || backpackOpen || activeCar){
    nearestLoot=null;
    UI.lootPrompt?.classList.add('hidden');
    UI.pickupMobileBtn?.classList.add('hidden');
    return;
  }

  autoPickupNearbyLoot();

  // Manual prompt is mainly for weapon swapping when both slots are occupied,
  // or for an item just outside the auto-pickup radius.
  nearestLoot=findNearestLoot(MANUAL_PICKUP_RADIUS);

  if(nearestLoot){
    const data=nearestLoot.userData.loot;
    const weaponNeedsSwap=data.kind==='weapon' && inventory.weapons.every(Boolean);

    UI.lootPromptText.textContent=(weaponNeedsSwap?'SWAP · ':'')+describeLoot(data);
    if(UI.pickupBtn) UI.pickupBtn.textContent=weaponNeedsSwap?'SWAP':'PICK';
    if(UI.pickupMobileBtn) UI.pickupMobileBtn.textContent=weaponNeedsSwap?'SWAP':'PICK';

    UI.lootPrompt.classList.remove('hidden');
    UI.pickupMobileBtn?.classList.remove('hidden');
  } else {
    UI.lootPrompt?.classList.add('hidden');
    UI.pickupMobileBtn?.classList.add('hidden');
  }
}

function pickupNearestLoot() {
  if(brPhase!=='ground' || multiplayer || backpackOpen) return;

  const now=performance.now();
  if(now-lastPickupAt<180) return;
  lastPickupAt=now;

  const item=findNearestLoot(MANUAL_PICKUP_RADIUS);
  if(!item){
    showMessage('MOVE CLOSER TO ITEM',450);
    return;
  }

  nearestLoot=item;
  const data=item.userData.loot;
  const allowWeaponSwap=data?.kind==='weapon';

  if(applyLootItem(item,{auto:false,allowWeaponSwap})){
    updateHud();
    updateLootInteraction();
  } else if(data?.kind!=='armor'){
    showMessage('BACKPACK FULL',500);
  }
}

function useBandage() {
  if(inventory.bandage<=0){ showMessage('NO BANDAGE',500); return; }
  if(hp>=GAME.maxHp){ showMessage('HP FULL',500); return; }
  if(brPhase!=='ground' || ended) return;

  inventory.bandage--;
  hp=Math.min(GAME.maxHp,hp+25);
  showMessage('BANDAGE · +25 HP',700);
  updateHud();
}

function openBackpack() {
  if(!started || ended || brPhase!=='ground' || activeCar) return;
  backpackOpen=true;
  backpackPauseRestore=paused;
  if(!multiplayer) paused=true;
  UI.backpackOverlay?.classList.remove('hidden');
  updateHud();
}

function closeBackpack() {
  backpackOpen=false;
  UI.backpackOverlay?.classList.add('hidden');
  if(!multiplayer && started && !ended) paused=backpackPauseRestore;
  clock?.getDelta();
}

function updateLootAnimations(dt) {
  const t=performance.now()*.001;
  for(let i=0;i<lootPickups.length;i++){
    const item=lootPickups[i];
    item.rotation.y+=dt*.7;
    item.position.y=.45+Math.sin(t*2+i*.7)*.08;
  }
}

function createCar(color=0x536779) {
  const car=new THREE.Group();

  const bodyMat=new THREE.MeshStandardMaterial({color,roughness:.58,metalness:.16});
  const darkMat=new THREE.MeshStandardMaterial({color:0x1c2228,roughness:.72});
  const glassMat=new THREE.MeshStandardMaterial({
    color:0x7ca0b8,roughness:.24,metalness:.12,transparent:true,opacity:.72
  });

  const body=new THREE.Mesh(new THREE.BoxGeometry(2.5,.78,4.7),bodyMat);
  body.position.y=.82;
  body.castShadow=matchMedia('(pointer:fine)').matches;
  car.add(body);

  const cabin=new THREE.Mesh(new THREE.BoxGeometry(2.02,.82,2.45),glassMat);
  cabin.position.set(0,1.48,-.18);
  cabin.castShadow=false;
  car.add(cabin);

  const bumperFront=new THREE.Mesh(new THREE.BoxGeometry(2.55,.24,.28),darkMat);
  bumperFront.position.set(0,.62,2.43);
  car.add(bumperFront);

  const bumperRear=bumperFront.clone();
  bumperRear.position.z=-2.43;
  car.add(bumperRear);

  const wheelGeo=new THREE.CylinderGeometry(.42,.42,.30,12);
  const wheelPositions=[
    [-1.28,.48,1.48],[1.28,.48,1.48],
    [-1.28,.48,-1.48],[1.28,.48,-1.48]
  ];

  wheelPositions.forEach(([x,y,z])=>{
    const wheel=new THREE.Mesh(wheelGeo,darkMat);
    wheel.rotation.z=Math.PI/2;
    wheel.position.set(x,y,z);
    car.add(wheel);
  });

  car.userData.speed=0;
  car.userData.maxSpeed=31;
  car.userData.reverseSpeed=12;
  car.userData.acceleration=21;
  car.userData.turnRate=1.55;
  car.userData.vehicle=true;

  scene.add(car);
  return car;
}

function clearCars() {
  if(activeCar){
    player.visible=true;
    activeCar=null;
  }

  cars.forEach(car=>scene?.remove(car));
  cars=[];
  nearestCar=null;

  UI.vehicleHud?.classList.add('hidden');
  UI.driveBtn?.classList.add('hidden');
  UI.driveMobileBtn?.classList.add('hidden');

  if(UI.driveBtn) UI.driveBtn.textContent='DRIVE';
  if(UI.driveMobileBtn) UI.driveMobileBtn.textContent='DRIVE';
}

function findSafeCarSpawn(x,z) {
  const attempts=[
    [x,z],[x+7,z],[x-7,z],[x,z+8],[x,z-8],
    [x+12,z+10],[x-12,z-10]
  ];

  for(const [px,pz] of attempts){
    if(
      Math.abs(px)<GAME.mapHalf-5 &&
      Math.abs(pz)<GAME.mapHalf-5 &&
      !blocked(px,pz,2.7)
    ){
      return new THREE.Vector3(px,0,pz);
    }
  }

  return randomGroundPoint(34);
}

function spawnCars() {
  clearCars();

  const spawns=[
    [0,100,0],
    [0,-115,Math.PI],
    [100,0,Math.PI/2],
    [-108,0,-Math.PI/2],
    [125,-105,0],
    [-125,100,Math.PI]
  ];
  const colors=[0x526b7c,0x7b5145,0x4f6652,0x77704a,0x53536f,0x6f4b55];

  spawns.forEach(([x,z,rot],index)=>{
    const car=createCar(colors[index%colors.length]);
    const p=findSafeCarSpawn(x,z);
    car.position.copy(p);
    car.rotation.y=rot;
    cars.push(car);
  });
}

function findNearestCar(maxDist=6.2) {
  let best=null;
  let bestDist=maxDist;

  for(const car of cars){
    if(!car?.visible) continue;
    const dist=Math.hypot(
      car.position.x-player.position.x,
      car.position.z-player.position.z
    );

    if(dist<bestDist){
      best=car;
      bestDist=dist;
    }
  }

  return best;
}

function setVehicleActionVisible(visible,label='DRIVE') {
  if(UI.driveBtn){
    UI.driveBtn.textContent=label;
    UI.driveBtn.classList.toggle('hidden',!visible);
  }
  if(UI.driveMobileBtn){
    UI.driveMobileBtn.textContent=label;
    UI.driveMobileBtn.classList.toggle('hidden',!visible);
  }
}

function updateCarInteraction() {
  if(multiplayer || brPhase!=='ground' || backpackOpen || ended){
    nearestCar=null;
    if(!activeCar) setVehicleActionVisible(false);
    return;
  }

  if(activeCar){
    nearestCar=activeCar;
    setVehicleActionVisible(true,'EXIT');
    UI.vehicleHud?.classList.remove('hidden');
    return;
  }

  nearestCar=findNearestCar(6.2);
  setVehicleActionVisible(Boolean(nearestCar),'DRIVE');
  UI.vehicleHud?.classList.add('hidden');
}

function enterCar(car=nearestCar) {
  if(
    !car ||
    activeCar ||
    multiplayer ||
    brPhase!=='ground' ||
    backpackOpen ||
    ended
  ) return;

  activeCar=car;
  nearestCar=car;
  reloading=false;
  mobile.firing=false;
  aiming=false;

  player.visible=false;
  player.position.copy(car.position);
  player.position.y=0;
  bodyYaw=car.rotation.y;

  UI.reloadState.textContent='';
  UI.lootPrompt?.classList.add('hidden');
  UI.pickupMobileBtn?.classList.add('hidden');
  UI.vehicleHud?.classList.remove('hidden');
  setVehicleActionVisible(true,'EXIT');

  showMessage('DRIVING · F / EXIT TO LEAVE',700);
}

function exitCar() {
  if(!activeCar) return;

  const car=activeCar;
  const side=new THREE.Vector3(3.4,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),car.rotation.y);
  const back=new THREE.Vector3(0,0,-4.0).applyAxisAngle(new THREE.Vector3(0,1,0),car.rotation.y);
  const candidates=[
    car.position.clone().add(side),
    car.position.clone().sub(side),
    car.position.clone().add(back)
  ];

  let exitPos=candidates.find(p=>!blocked(p.x,p.z,1.15));
  if(!exitPos) exitPos=car.position.clone().add(new THREE.Vector3(0,0,4.5));

  activeCar=null;
  nearestCar=null;
  player.visible=true;
  player.position.set(
    THREE.MathUtils.clamp(exitPos.x,-GAME.mapHalf+2,GAME.mapHalf-2),
    0,
    THREE.MathUtils.clamp(exitPos.z,-GAME.mapHalf+2,GAME.mapHalf-2)
  );

  yaw=car.rotation.y+Math.PI;
  bodyYaw=wrapAngle(yaw+Math.PI);
  player.rotation.y=bodyYaw;

  UI.vehicleHud?.classList.add('hidden');
  setVehicleActionVisible(false);
  showMessage('EXITED CAR',450);

  updateLootInteraction();
  updateCarInteraction();
}

function toggleCar() {
  const now=performance.now();
  if(now-lastCarToggleAt<220) return;
  lastCarToggleAt=now;

  if(activeCar) exitCar();
  else {
    nearestCar=findNearestCar(6.5);
    if(nearestCar) enterCar(nearestCar);
    else showMessage('MOVE CLOSER TO CAR',450);
  }
}

function carBlocked(car,nx,nz) {
  if(blocked(nx,nz,2.15)) return true;

  for(const other of cars){
    if(other===car || !other.visible) continue;
    if(Math.hypot(other.position.x-nx,other.position.z-nz)<4.0) return true;
  }

  return false;
}

function updateCar(dt) {
  if(!activeCar) return;

  const car=activeCar;
  let throttle=0;
  let steer=0;

  if(keys.has('KeyW')) throttle+=1;
  if(keys.has('KeyS')) throttle-=1;
  if(keys.has('KeyA')) steer-=1;
  if(keys.has('KeyD')) steer+=1;

  throttle+=THREE.MathUtils.clamp(-mobile.moveY,-1,1);
  steer+=THREE.MathUtils.clamp(mobile.moveX,-1,1);
  throttle=THREE.MathUtils.clamp(throttle,-1,1);
  steer=THREE.MathUtils.clamp(steer,-1,1);

  let speed=car.userData.speed||0;

  if(throttle>0.05){
    speed+=car.userData.acceleration*throttle*dt;
  } else if(throttle<-.05){
    speed+=car.userData.acceleration*.72*throttle*dt;
  } else {
    speed*=Math.exp(-2.35*dt);
    if(Math.abs(speed)<.05) speed=0;
  }

  speed=THREE.MathUtils.clamp(
    speed,
    -car.userData.reverseSpeed,
    car.userData.maxSpeed
  );

  if(Math.abs(speed)>.25 && Math.abs(steer)>.02){
    const directionFactor=THREE.MathUtils.clamp(speed/8,-1,1);
    car.rotation.y+=steer*car.userData.turnRate*dt*directionFactor;
  }

  const forward=new THREE.Vector3(
    Math.sin(car.rotation.y),
    0,
    Math.cos(car.rotation.y)
  );

  const nx=THREE.MathUtils.clamp(
    car.position.x+forward.x*speed*dt,
    -GAME.mapHalf+3,
    GAME.mapHalf-3
  );
  const nz=THREE.MathUtils.clamp(
    car.position.z+forward.z*speed*dt,
    -GAME.mapHalf+3,
    GAME.mapHalf-3
  );

  if(!carBlocked(car,nx,nz)){
    car.position.x=nx;
    car.position.z=nz;
  } else {
    speed*=-.16;
  }

  car.userData.speed=speed;

  player.position.copy(car.position);
  player.position.y=0;
  bodyYaw=car.rotation.y;

  if(UI.vehicleSpeed){
    UI.vehicleSpeed.textContent=Math.round(Math.abs(speed)*5.4);
  }

  updateCarInteraction();
}

function updateCarCamera(dt) {
  if(!activeCar) return;

  const forward=new THREE.Vector3(
    Math.sin(activeCar.rotation.y),
    0,
    Math.cos(activeCar.rotation.y)
  );
  const target=activeCar.position.clone().add(new THREE.Vector3(0,1.25,0));
  const desired=target.clone()
    .addScaledVector(forward,-9.5)
    .add(new THREE.Vector3(0,4.9,0));

  const blend=1-Math.exp(-6.5*dt);
  camera.position.lerp(desired,blend);
  camera.lookAt(target.clone().addScaledVector(forward,5));
  camera.fov=THREE.MathUtils.lerp(camera.fov,74,.12);
  camera.updateProjectionMatrix();
}

init();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb6d8);
  scene.fog = new THREE.Fog(0x8fb6d8, 110, 520);

  camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 800);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('game').appendChild(renderer.domElement);
  applyGraphicsSettings();

  clock = new THREE.Clock();
  buildWorld();

  // Everything created by buildWorld() belongs to the Battle Royale map.
  // Lobby/player objects are created afterwards and remain independent.
  battleRoyaleWorldObjects=[...scene.children];
  battleRoyaleColliders=colliders.map(c=>({...c}));

  createPlayer();
  createLobbyStage();
  applyControlLayout();
  bindInputs();
  hp=GAME.maxHp;
  ammo=GAME.magSize;
  reserve=120;
  bots=[];
  brPhase='lobby';
  showLobby();
  updateHud();
  animate();
}


function setBattleRoyaleWorldVisible(visible) {
  battleRoyaleWorldObjects.forEach(object=>{
    object.visible=visible;
  });
}

function disposeObjectTree(root) {
  root?.traverse?.(child=>{
    child.geometry?.dispose?.();
    if(child.material){
      const materials=Array.isArray(child.material)?child.material:[child.material];
      materials.forEach(material=>material?.dispose?.());
    }
  });
}

function clearOneVOneWorld({restoreBattleRoyale=true}={}) {
  if(oneVOneWorld){
    disposeObjectTree(oneVOneWorld);
    scene.remove(oneVOneWorld);
    oneVOneWorld=null;
  }

  oneVOneOccluders=[];
  activeMapHalf=GAME.mapHalf;

  if(restoreBattleRoyale){
    colliders=battleRoyaleColliders.map(c=>({...c}));
    setBattleRoyaleWorldVisible(true);
    scene.background=new THREE.Color(0x8fb6d8);
    scene.fog=new THREE.Fog(0x8fb6d8,110,520);
    applyGraphicsSettings();
  }
}

function addOneVOneBoxCollider(data) {
  const size=Array.isArray(data.size)?data.size:[6,4,6];
  const scale=Array.isArray(data.scale)?data.scale:[1,1,1];
  const rotation=Array.isArray(data.rotation)?data.rotation:[0,0,0];
  const position=Array.isArray(data.position)?data.position:[0,0,0];

  const width=Math.abs((Number(size[0])||6)*(Number(scale[0])||1));
  const depth=Math.abs((Number(size[2])||6)*(Number(scale[2])||1));
  const yaw=Number(rotation[1])||0;
  const c=Math.abs(Math.cos(yaw));
  const sn=Math.abs(Math.sin(yaw));
  const halfX=(width*c+depth*sn)/2+.55;
  const halfZ=(width*sn+depth*c)/2+.55;
  const x=Number(position[0])||0;
  const z=Number(position[2])||0;

  colliders.push({
    minX:x-halfX,
    maxX:x+halfX,
    minZ:z-halfZ,
    maxZ:z+halfZ
  });
}

function createOneVOneTree(data,parent) {
  const group=new THREE.Group();
  const trunk=new THREE.Mesh(
    new THREE.CylinderGeometry(.65,.85,5,8),
    new THREE.MeshStandardMaterial({color:0x6e4d2f,roughness:.9})
  );
  trunk.position.y=2.5;
  trunk.castShadow=true;
  trunk.receiveShadow=true;
  group.add(trunk);

  const crown=new THREE.Mesh(
    new THREE.ConeGeometry(3.6,8,9),
    new THREE.MeshStandardMaterial({color:data.color||0x2f633a,roughness:.88})
  );
  crown.position.y=8;
  crown.castShadow=true;
  group.add(crown);

  group.position.fromArray(Array.isArray(data.position)?data.position:[0,0,0]);
  group.rotation.set(...(Array.isArray(data.rotation)?data.rotation:[0,0,0]));
  group.scale.fromArray(Array.isArray(data.scale)?data.scale:[1,1,1]);
  parent.add(group);
  oneVOneOccluders.push(trunk,crown);

  const radius=1.1*Math.max(Math.abs(group.scale.x),Math.abs(group.scale.z));
  colliders.push({
    minX:group.position.x-radius,
    maxX:group.position.x+radius,
    minZ:group.position.z-radius,
    maxZ:group.position.z+radius
  });
}

function createFallbackOneVOneMap() {
  return {
    version:1,
    name:'1V1 Arena',
    mapHalf:70,
    groundColor:'#536b47',
    objects:[
      {id:'spawn-a',type:'spawnA',position:[0,0,52],rotation:[0,Math.PI,0],scale:[1,1,1],color:'#62c8ff'},
      {id:'spawn-b',type:'spawnB',position:[0,0,-52],rotation:[0,0,0],scale:[1,1,1],color:'#ff7a72'},
      {id:'boundary-n',type:'box',position:[0,2,-68],rotation:[0,0,0],scale:[1,1,1],size:[136,4,4],color:'#3b4650'},
      {id:'boundary-s',type:'box',position:[0,2,68],rotation:[0,0,0],scale:[1,1,1],size:[136,4,4],color:'#3b4650'},
      {id:'boundary-w',type:'box',position:[-68,2,0],rotation:[0,0,0],scale:[1,1,1],size:[4,4,136],color:'#3b4650'},
      {id:'boundary-e',type:'box',position:[68,2,0],rotation:[0,0,0],scale:[1,1,1],size:[4,4,136],color:'#3b4650'}
    ]
  };
}

async function activateOneVOneMap() {
  clearOneVOneWorld({restoreBattleRoyale:false});
  setBattleRoyaleWorldVisible(false);
  colliders=[];
  oneVOneOccluders=[];

  let mapData=null;
  try{
    const module=await import('./onevone-map.js?matchMap='+Date.now());
    mapData=module.ONEVONE_MAP;
  }catch(error){
    console.warn('1V1 map module failed; using safe fallback arena.',error);
  }

  if(!mapData || !Array.isArray(mapData.objects)){
    mapData=createFallbackOneVOneMap();
  }

  activeMapHalf=THREE.MathUtils.clamp(Number(mapData.mapHalf)||70,30,220);
  oneVOneWorld=new THREE.Group();
  oneVOneWorld.name='ONEVONE_WORLD';
  scene.add(oneVOneWorld);

  scene.background=new THREE.Color(0x7893a7);
  scene.fog=new THREE.Fog(0x7893a7,85,260);

  const hemi=new THREE.HemisphereLight(0xdcecff,0x343b2b,2.15);
  oneVOneWorld.add(hemi);

  const sun=new THREE.DirectionalLight(0xffffff,2.3);
  sun.position.set(36,64,28);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-90;
  sun.shadow.camera.right=90;
  sun.shadow.camera.top=90;
  sun.shadow.camera.bottom=-90;
  oneVOneWorld.add(sun);

  const groundColor=/^#[0-9a-f]{6}$/i.test(mapData.groundColor||'')
    ? mapData.groundColor
    : '#536b47';

  const arenaGround=new THREE.Mesh(
    new THREE.PlaneGeometry(activeMapHalf*2,activeMapHalf*2),
    new THREE.MeshStandardMaterial({color:groundColor,roughness:1})
  );
  arenaGround.rotation.x=-Math.PI/2;
  arenaGround.receiveShadow=true;
  arenaGround.userData.oneVOneEnvironment=true;
  oneVOneWorld.add(arenaGround);

  const spawns={host:null,guest:null};

  for(const raw of mapData.objects){
    if(!raw || !raw.type) continue;

    if(raw.type==='spawnA' || raw.type==='spawnB'){
      const position=Array.isArray(raw.position)?raw.position:[0,0,0];
      const rotation=Array.isArray(raw.rotation)?raw.rotation:[0,0,0];
      const spawn={
        position:[
          THREE.MathUtils.clamp(Number(position[0])||0,-activeMapHalf+4,activeMapHalf-4),
          Math.max(0,Number(position[1])||0),
          THREE.MathUtils.clamp(Number(position[2])||0,-activeMapHalf+4,activeMapHalf-4)
        ],
        yaw:Number(rotation[1])||0
      };
      if(raw.type==='spawnA' && !spawns.host) spawns.host=spawn;
      if(raw.type==='spawnB' && !spawns.guest) spawns.guest=spawn;
      continue;
    }

    if(raw.type==='box'){
      const size=Array.isArray(raw.size)?raw.size:[6,4,6];
      const color=/^#[0-9a-f]{6}$/i.test(raw.color||'')?raw.color:'#7a838b';
      const mesh=new THREE.Mesh(
        new THREE.BoxGeometry(
          Math.max(.5,Number(size[0])||6),
          Math.max(.5,Number(size[1])||4),
          Math.max(.5,Number(size[2])||6)
        ),
        new THREE.MeshStandardMaterial({color,roughness:.82})
      );
      mesh.position.fromArray(Array.isArray(raw.position)?raw.position:[0,0,0]);
      mesh.rotation.set(...(Array.isArray(raw.rotation)?raw.rotation:[0,0,0]));
      mesh.scale.fromArray(Array.isArray(raw.scale)?raw.scale:[1,1,1]);
      mesh.castShadow=true;
      mesh.receiveShadow=true;
      mesh.userData.oneVOneEnvironment=true;
      oneVOneWorld.add(mesh);
      oneVOneOccluders.push(mesh);
      addOneVOneBoxCollider(raw);
      continue;
    }

    if(raw.type==='tree'){
      createOneVOneTree(raw,oneVOneWorld);
    }
  }

  oneVOneSpawns={
    host:spawns.host||{position:[0,0,Math.min(52,activeMapHalf-12)],yaw:Math.PI},
    guest:spawns.guest||{position:[0,0,-Math.min(52,activeMapHalf-12)],yaw:0}
  };

  applyGraphicsSettings();
}

function setupOneVOneLoadout() {
  inventory=createEmptyInventory();
  inventory.weapons[0]={id:'LMG5',magAmmo:WEAPONS.LMG5.mag};
  inventory.weapons[1]=null;
  inventory.ammo['5.56']=0;
  inventory.ammo['9mm']=0;
  inventory.bandage=0;
  inventory.armor=0;
  activeWeaponSlot=0;
  reloading=false;
  UI.reloadState.textContent='';
  syncLegacyAmmo();
}

function getOneVOneLocalSpawn() {
  return multiplayerRole==='host'?oneVOneSpawns.host:oneVOneSpawns.guest;
}

function applyOneVOneSpawn() {
  const spawn=getOneVOneLocalSpawn();
  player.position.fromArray(spawn.position);
  yaw=spawn.yaw;
  pitch=-.18;
  bodyYaw=wrapAngle(yaw+Math.PI);
  player.rotation.y=bodyYaw;
}

function formatOneVOneTime(seconds) {
  const total=Math.max(0,Math.ceil(Number(seconds)||0));
  const minutes=Math.floor(total/60);
  const secs=String(total%60).padStart(2,'0');
  return minutes+':'+secs;
}

function buildOneVOneNetworkState(extra={}) {
  return {
    x:player.position.x,
    y:player.position.y,
    z:player.position.z,
    yaw:player.rotation.y,
    hp,
    alive:hp>0,
    shielded:hp>0 && performance.now()<multiplayerShieldUntil,
    kills,
    role:multiplayerRole,
    timeRemaining:multiplayerTimeRemaining,
    ...extra
  };
}

function finishOneVOneMatch(result,reason='MATCH COMPLETE',{broadcast=true}={}) {
  if(!multiplayer || multiplayerFinished) return;
  multiplayerFinished=true;

  const winnerRole=result==='draw'
    ? 'draw'
    : result==='win'
      ? multiplayerRole
      : (multiplayerRole==='host'?'guest':'host');

  if(broadcast){
    window.Mini3DNet?.sendState(buildOneVOneNetworkState({
      finished:true,
      winnerRole,
      finishReason:reason
    }));
  }

  ended=true;
  paused=false;
  reloading=false;
  mobile.firing=false;
  multiplayerRespawnAt=0;
  document.exitPointerLock?.();

  UI.endTitle.textContent=result==='win'
    ? 'WINNER!'
    : result==='draw'
      ? 'DRAW'
      : 'DEFEAT';

  UI.endText.textContent=
    'KILLS '+kills+' - '+remoteKills+
    ' · '+reason+
    ' · '+formatOneVOneTime(multiplayerTimeRemaining);

  UI.endOverlay.classList.remove('hidden');

  window.Mini3DS2?.recordMatch?.({
    mode:'1v1',
    result,
    kills
  });

  updateHud();
}

function checkOneVOneKillLimit() {
  if(!multiplayer || multiplayerFinished) return false;

  if(kills>=ONEVONE_KILL_LIMIT){
    finishOneVOneMatch('win','40 KILL LIMIT');
    return true;
  }

  if(remoteKills>=ONEVONE_KILL_LIMIT){
    finishOneVOneMatch('lose','OPPONENT REACHED 40 KILLS');
    return true;
  }

  return false;
}

function handleOneVOneDeath() {
  if(!multiplayer || multiplayerFinished || multiplayerRespawnAt>0) return;

  hp=0;
  player.visible=false;
  reloading=false;
  mobile.firing=false;
  multiplayerShieldUntil=0;
  multiplayerRespawnAt=performance.now()+ONEVONE_RESPAWN_MS;
  lastNetStateSent=0;

  UI.reloadState.textContent='';
  showMessage('ELIMINATED · RESPAWN IN 3s',2900);
  updateHud();
}

function respawnOneVOnePlayer() {
  if(!multiplayer || multiplayerFinished) return;

  setupOneVOneLoadout();
  hp=GAME.maxHp;
  multiplayerRespawnAt=0;
  multiplayerShieldUntil=performance.now()+ONEVONE_SHIELD_MS;
  applyOneVOneSpawn();
  player.visible=true;
  lastNetStateSent=0;

  showMessage('SPAWN SHIELD · 3s',1000);
  updateHud();
}

function updateOneVOneMatch() {
  if(!multiplayer || multiplayerFinished) return;

  const now=performance.now();
  if(!multiplayerLastClockAt) multiplayerLastClockAt=now;
  const realDt=Math.max(0,(now-multiplayerLastClockAt)/1000);
  multiplayerLastClockAt=now;
  multiplayerTimeRemaining=Math.max(0,multiplayerTimeRemaining-realDt);

  if(hp<=0 && multiplayerRespawnAt>0 && now>=multiplayerRespawnAt){
    respawnOneVOnePlayer();
  }

  if(multiplayerTimeRemaining<=0){
    if(kills>remoteKills) finishOneVOneMatch('win','TIME LIMIT');
    else if(kills<remoteKills) finishOneVOneMatch('lose','TIME LIMIT');
    else finishOneVOneMatch('draw','TIME LIMIT · TIED SCORE');
    return;
  }

  const respawnLeft=hp<=0 && multiplayerRespawnAt>0
    ? Math.max(0,(multiplayerRespawnAt-now)/1000)
    : 0;
  const shieldLeft=hp>0
    ? Math.max(0,(multiplayerShieldUntil-now)/1000)
    : 0;

  let suffix='';
  if(respawnLeft>0) suffix=' · RESPAWN '+respawnLeft.toFixed(1)+'s';
  else if(shieldLeft>0) suffix=' · SHIELD '+shieldLeft.toFixed(1)+'s';

  UI.zoneInfo.textContent=
    '1V1 · '+formatOneVOneTime(multiplayerTimeRemaining)+
    ' · KILLS '+kills+'-'+remoteKills+
    suffix;

  elapsed=ONEVONE_MATCH_SECONDS-multiplayerTimeRemaining;
}

function createRemotePlayer() {
  if(remotePlayer){
    scene.remove(remotePlayer);
    remotePlayer=null;
  }

  remotePlayer=createHumanoidCharacter({
    name:'RemotePlayer',
    enemy:true,
    outfitColor:0x8f3940,
    pantsColor:0x2a252a,
    vestColor:0x5b3034,
    skinColor:0xc99372,
    hairColor:0x17191e,
    shoeColor:0x101317,
    accentColor:0xe06a55
  });

  remotePlayer.userData.remote=true;
  remotePlayer.userData.hp=100;
  remotePlayer.userData.userId=null;
  remotePlayer.visible=false;
  scene.add(remotePlayer);
}

async function startMultiplayerMatch(detail) {
  multiplayer=true;
  multiplayerRoom=detail.roomCode;
  multiplayerRole=detail.role;
  remoteUserId=null;
  remoteTarget={
    x:0,y:0,z:0,yaw:0,hp:100,
    alive:true,shielded:false,kills:0,role:null,timeRemaining:ONEVONE_MATCH_SECONDS
  };

  multiplayerTimeRemaining=ONEVONE_MATCH_SECONDS;
  multiplayerLastClockAt=performance.now();
  multiplayerRespawnAt=0;
  multiplayerShieldUntil=0;
  multiplayerFinished=false;
  remoteAliveLast=null;
  remoteKills=0;

  resetMatch({battleRoyale:false});
  bots.forEach(bot=>bot.visible=false);
  bots=[];
  brPhase='ground';

  showMessage('1V1 · LOADING ARENA',100000);
  await activateOneVOneMap();

  setupOneVOneLoadout();
  hp=GAME.maxHp;
  kills=0;
  elapsed=0;
  spawnProtection=0;

  applyOneVOneSpawn();
  player.visible=true;

  createRemotePlayer();

  started=true;
  paused=false;
  ended=false;
  UI.startOverlay.classList.add('hidden');
  document.getElementById('profileOverlay')?.classList.add('hidden');
  document.getElementById('friendsOverlay')?.classList.add('hidden');
  UI.endOverlay.classList.add('hidden');
  setGameUiVisible(true);
  UI.zoneInfo.textContent='1V1 · 10:00 · KILLS 0-0';
  showMessage('1V1 · LMG-5 · FIRST TO 40 / 10 MIN',1300);
  clock.getDelta();
}

function updateRemotePlayer(dt) {
  if(!multiplayer || !remotePlayer || !remotePlayer.visible) return;

  const before=remotePlayer.position.clone();
  const t=1-Math.exp(-14*dt);
  remotePlayer.position.x=THREE.MathUtils.lerp(remotePlayer.position.x,remoteTarget.x,t);
  remotePlayer.position.y=THREE.MathUtils.lerp(remotePlayer.position.y,remoteTarget.y,t);
  remotePlayer.position.z=THREE.MathUtils.lerp(remotePlayer.position.z,remoteTarget.z,t);
  remotePlayer.rotation.y=lerpAngle(remotePlayer.rotation.y,remoteTarget.yaw,t);

  const moved=remotePlayer.position.distanceTo(before);
  updateHumanoidAnimation(remotePlayer,{
    moving:moved>.0008,
    speed:dt>0?moved/dt:0,
    aiming:true,
    dead:!remoteTarget.alive
  },dt);
}

function sendMultiplayerState() {
  if (!multiplayer || !window.Mini3DNet || multiplayerFinished) return;
  const now=performance.now();
  if (now-lastNetStateSent<50) return;
  lastNetStateSent=now;
  window.Mini3DNet.sendState(buildOneVOneNetworkState());
}

document.addEventListener('mini3d:room-join',event=>{
  startMultiplayerMatch(event.detail).catch(error=>{
    console.error('1V1 start failed',error);
    showMessage('1V1 MAP ERROR',2000);
    showLobby();
  });
});

document.addEventListener('mini3d:room-presence',event=>{
  if (!multiplayer || event.detail.roomCode!==multiplayerRoom) return;
  const other=(event.detail.players || []).find(p=>p.user_id && p.user_id!==remoteUserId);
  if (other && other.user_id) {
    remoteUserId=other.user_id;
    if (remotePlayer) {
      remotePlayer.userData.userId=remoteUserId;
      remotePlayer.visible=true;
    }
    showMessage('OPPONENT CONNECTED',900);
  }
});

document.addEventListener('mini3d:net-state',event=>{
  if (!multiplayer || event.detail.roomCode!==multiplayerRoom) return;

  remoteUserId=event.detail.userId || remoteUserId;

  const remoteAlive=event.detail.alive!==false;
  const nextRemoteKills=Math.max(0,Number(event.detail.kills)||0);

  remoteTarget={
    x:Number(event.detail.x)||0,
    y:Number(event.detail.y)||0,
    z:Number(event.detail.z)||0,
    yaw:Number(event.detail.yaw)||0,
    hp:Number(event.detail.hp ?? 100),
    alive:remoteAlive,
    shielded:Boolean(event.detail.shielded),
    kills:nextRemoteKills,
    role:event.detail.role||remoteTarget.role||null,
    timeRemaining:Number.isFinite(Number(event.detail.timeRemaining))
      ? Number(event.detail.timeRemaining)
      : remoteTarget.timeRemaining
  };

  if(event.detail.role==='host' && multiplayerRole==='guest' && Number.isFinite(Number(event.detail.timeRemaining))){
    multiplayerTimeRemaining=THREE.MathUtils.clamp(
      Number(event.detail.timeRemaining),
      0,
      ONEVONE_MATCH_SECONDS
    );
    multiplayerLastClockAt=performance.now();
  }

  remoteKills=nextRemoteKills;

  if(remoteAliveLast===true && remoteAlive===false && !multiplayerFinished){
    kills++;
    showMessage('ELIMINATION · '+kills+'/'+ONEVONE_KILL_LIMIT,700);
    updateHud();
    checkOneVOneKillLimit();
  }
  remoteAliveLast=remoteAlive;

  if (remotePlayer) {
    remotePlayer.userData.userId=remoteUserId;
    remotePlayer.userData.hp=remoteTarget.hp;
    remotePlayer.userData.shielded=remoteTarget.shielded;
    remotePlayer.visible=remoteAlive;
  }

  if(event.detail.finished && !multiplayerFinished){
    const winnerRole=event.detail.winnerRole;
    const result=winnerRole==='draw'
      ? 'draw'
      : winnerRole===multiplayerRole
        ? 'win'
        : 'lose';
    finishOneVOneMatch(
      result,
      String(event.detail.finishReason||'MATCH COMPLETE'),
      {broadcast:false}
    );
    return;
  }

  if(!multiplayerFinished) checkOneVOneKillLimit();
});

document.addEventListener('mini3d:net-damage',event=>{
  if (!multiplayer || ended || multiplayerFinished || hp<=0) return;

  if(performance.now()<multiplayerShieldUntil){
    showMessage('SPAWN SHIELD',260);
    return;
  }

  const amount=THREE.MathUtils.clamp(Number(event.detail.amount)||0,0,100);
  if (amount<=0) return;

  pulseCharacterAction(player,'hit',1);
  hp=Math.max(0,hp-amount);
  updateHud();

  if(hp<=0){
    handleOneVOneDeath();
  }
});

document.addEventListener('mini3d:net-shot',event=>{
  if (!multiplayer || event.detail.roomCode!==multiplayerRoom) return;
  pulseCharacterAction(remotePlayer,'fire',1);
  const a=new THREE.Vector3(event.detail.ox||0,event.detail.oy||0,event.detail.oz||0);
  const b=new THREE.Vector3(event.detail.ex||0,event.detail.ey||0,event.detail.ez||0);
  spawnTracer(a,b,0xff775c);
});

function buildWorld() {
  const hemi = new THREE.HemisphereLight(0xdcecff, 0x40552d, 2.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(45, 70, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -110;
  sun.shadow.camera.right = 110;
  sun.shadow.camera.top = 110;
  sun.shadow.camera.bottom = -110;
  scene.add(sun);

  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GAME.mapHalf * 2, GAME.mapHalf * 2),
    new THREE.MeshStandardMaterial({ color: 0x5f8a45, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x4d5157, roughness: 1 });
  for (const [x, z, w, d] of [[0,0,16,480],[0,0,480,12],[-125,55,10,220],[125,-60,10,230]]) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(w,.08,d), roadMat);
    road.position.set(x,.04,z);
    road.receiveShadow = true;
    scene.add(road);
  }

  addBox(-35, 0, -28, 18, 10, 22, 0xa76d42);
  addBox(34, 0, -34, 24, 8, 18, 0x8390a0);
  addBox(-42, 0, 32, 22, 12, 20, 0xb48a62);
  addBox(37, 0, 33, 16, 9, 26, 0x787f8e);
  addBox(5, 0, 47, 18, 7, 12, 0x8a755c);
  addBox(-6, 0, -54, 20, 9, 14, 0x6f7f91);

  // S1 outer settlements: spreads combat across the larger island.
  addBox(-155,0,-132,28,10,34,0x8f6747);
  addBox(-118,0,-158,22,8,24,0x75879a);
  addBox(150,0,130,34,12,28,0x8d7a65);
  addBox(120,0,160,20,9,32,0x6f8092);
  addBox(-158,0,122,30,11,22,0xa17a55);
  addBox(158,0,-138,24,9,30,0x7a8490);
  addBox(-88,0,145,18,8,20,0x8d7359);
  addBox(92,0,-150,20,8,18,0x72879a);

  const wallColor = 0x8c8b86;
  addBox(-18,0,-8,18,3,2,wallColor);
  addBox(21,0,13,20,3,2,wallColor);
  addBox(-7,0,23,2,3,18,wallColor);
  addBox(53,0,-2,2,3,22,wallColor);
  addBox(-56,0,-1,2,3,22,wallColor);

  const treePositions = [[-70,-63],[-64,55],[-52,63],[-28,61],[-18,-69],[15,-67],[31,63],[59,57],[68,20],[65,-54],[49,-66],[-69,18],[-25,12],[25,-13],[51,14],[-48,-12]];
  treePositions.forEach(([x,z]) => addTree(x,z));

  const zonePts = [];
  for (let i=0;i<=128;i++) {
    const a = (i/128) * Math.PI * 2;
    zonePts.push(new THREE.Vector3(Math.cos(a), .18, Math.sin(a)));
  }
  const zoneGeo = new THREE.BufferGeometry().setFromPoints(zonePts);
  zoneRing = new THREE.Line(zoneGeo, new THREE.LineBasicMaterial({ color:0x55d7ff, transparent:true, opacity:.95 }));
  scene.add(zoneRing);
}

function addBox(x, y, z, w, h, d, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshStandardMaterial({ color, roughness:.8 }));
  mesh.position.set(x, y + h/2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  colliders.push({ minX:x-w/2-.55, maxX:x+w/2+.55, minZ:z-d/2-.55, maxZ:z+d/2+.55 });
}

function addTree(x,z) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.65,.85,5,8), new THREE.MeshStandardMaterial({ color:0x6e4d2f }));
  trunk.position.set(x,2.5,z);
  trunk.castShadow = true;
  scene.add(trunk);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(3.6,8,9), new THREE.MeshStandardMaterial({ color:0x2f633a }));
  crown.position.set(x,8,z);
  crown.castShadow = true;
  scene.add(crown);
  colliders.push({ minX:x-1.1,maxX:x+1.1,minZ:z-1.1,maxZ:z+1.1 });
}

function createPlayer() {
  player=createHumanoidCharacter({
    name:'Player',
    outfitColor:0x31567e,
    pantsColor:0x202a34,
    vestColor:0x3d5060,
    skinColor:0xc99372,
    hairColor:0x151a20,
    shoeColor:0x10161d,
    accentColor:0xd6ae38
  });

  player.userData.hp=GAME.maxHp;
  player.userData.alive=true;
  scene.add(player);
}

function createLobbyStage() {
  lobbyStage = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(3.3,3.5,.28,48),
    new THREE.MeshStandardMaterial({
      color:0x171d24,
      roughness:.42,
      metalness:.35
    })
  );
  base.position.y=.14;
  base.receiveShadow=true;
  lobbyStage.add(base);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.9,.045,10,72),
    new THREE.MeshBasicMaterial({
      color:0xf1c84b,
      transparent:true,
      opacity:.78
    })
  );
  ring.rotation.x=Math.PI/2;
  ring.position.y=.31;
  lobbyStage.add(ring);

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.8,2.7,64),
    new THREE.MeshBasicMaterial({
      color:0x4f7898,
      transparent:true,
      opacity:.07,
      side:THREE.DoubleSide
    })
  );
  innerRing.rotation.x=-Math.PI/2;
  innerRing.position.y=.295;
  lobbyStage.add(innerRing);

  lobbySpot = new THREE.PointLight(0xf3cf65,20,18,2);
  lobbySpot.position.set(-2.2,5.8,2.6);
  lobbyStage.add(lobbySpot);

  const coolRim = new THREE.PointLight(0x7fc8ff,11,17,2);
  coolRim.position.set(3.4,4.2,-2.7);
  lobbyStage.add(coolRim);

  const warmFill = new THREE.PointLight(0xffa63b,6,12,2);
  warmFill.position.set(-3.4,2.4,-1.5);
  lobbyStage.add(warmFill);

  const backPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(3.15,3.15,.05,48),
    new THREE.MeshStandardMaterial({
      color:0x0f151b,
      roughness:.42,
      metalness:.24,
      transparent:true,
      opacity:.92
    })
  );
  backPlate.position.y=.32;
  lobbyStage.add(backPlate);

  lobbyStage.visible=false;
  scene.add(lobbyStage);
}

function createPlane() {
  if (plane) scene.remove(plane);

  plane = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color:0xb8c1c9, roughness:.55, metalness:.28 });
  const darkMat = new THREE.MeshStandardMaterial({ color:0x39434e, roughness:.62 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(10,2.3,3.2), bodyMat);
  body.castShadow = false;
  plane.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.6,3.4,10), bodyMat);
  nose.rotation.z = -Math.PI/2;
  nose.position.x = 6.1;
  plane.add(nose);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(4.2,.28,17), bodyMat);
  plane.add(wing);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(2.4,2.7,.4), darkMat);
  tail.position.set(-4.3,1.1,0);
  plane.add(tail);

  plane.scale.set(1.35,1.35,1.35);
  scene.add(plane);
}

function isSafeLandingSpot(x,z,radius=4.2) {
  if (Math.abs(x)>GAME.mapHalf-radius-2 || Math.abs(z)>GAME.mapHalf-radius-2) return false;
  return !blocked(x,z,radius);
}

function randomGroundPoint(margin=32) {
  for (let attempt=0; attempt<80; attempt++) {
    const x=THREE.MathUtils.randFloat(-GAME.mapHalf+margin,GAME.mapHalf-margin);
    const z=THREE.MathUtils.randFloat(-GAME.mapHalf+margin,GAME.mapHalf-margin);
    if (isSafeLandingSpot(x,z,4.2)) return new THREE.Vector3(x,0,z);
  }

  const fallbacks=[
    [0,85],[85,0],[0,-85],[-85,0],
    [105,105],[-105,105],[105,-105],[-105,-105]
  ];
  const safe=fallbacks.find(([x,z])=>isSafeLandingSpot(x,z,4.2));
  return safe ? new THREE.Vector3(safe[0],0,safe[1]) : new THREE.Vector3(0,0,0);
}

function setupBattleRoyaleFlight() {
  brPhase='plane';
  planeProgress=0;
  playerDropped=false;
  verticalVelocity=0;

  createPlane();
  plane.position.copy(planeStart);
  const dir=planeEnd.clone().sub(planeStart);
  plane.rotation.y=Math.atan2(dir.x,dir.z)-Math.PI/2;

  player.visible=false;
  UI.planeJumpBtn?.classList.remove('hidden');
  UI.jumpBtn?.classList.add('hidden');

  bots.forEach((bot,index)=>{
    bot.visible=false;
    bot.userData.dropped=false;
    bot.userData.landed=false;
    bot.userData.dropAt=.08+Math.random()*.80;
    bot.userData.dropTarget=randomGroundPoint(30);
    bot.userData.target=null;
    bot.userData.name='BOT '+String(index+1).padStart(2,'0');
    bot.userData.kills=0;
  });

  showMessage('30 ALIVE · CHOOSE YOUR DROP',1400);
}

function jumpFromPlane() {
  if (brPhase!=='plane' || playerDropped || !plane) return;

  playerDropped=true;
  brPhase='falling';
  player.visible=true;
  player.position.copy(plane.position).add(new THREE.Vector3(0,-5,0));
  verticalVelocity=-10;

  UI.planeJumpBtn?.classList.add('hidden');
  UI.jumpBtn?.classList.remove('hidden');
  if (UI.jumpBtn) UI.jumpBtn.textContent='PARA';

  showMessage('FREE FALL · STEER TO LAND',800);
}

function openParachute() {
  if (brPhase!=='falling') return;
  brPhase='parachute';
  verticalVelocity=-6;
  UI.jumpBtn?.classList.add('hidden');
  showMessage('PARACHUTE OPEN',600);
}

function updateFlight(dt) {
  // Plane keeps flying even after the player jumps so the remaining bots can drop.
  if (plane) {
    planeProgress=Math.min(1,planeProgress+dt/18);
    plane.position.lerpVectors(planeStart,planeEnd,planeProgress);

    for (const bot of bots) {
      if (!bot.userData.dropped && planeProgress>=bot.userData.dropAt) {
        bot.userData.dropped=true;
        bot.visible=true;
        bot.position.copy(plane.position).add(new THREE.Vector3(0,-4-Math.random()*3,0));
      }
    }

    if (brPhase==='plane' && !playerDropped) {
      camera.position.lerp(plane.position.clone().add(new THREE.Vector3(-20,12,19)),.12);
      camera.lookAt(plane.position);
    }

    if (brPhase==='plane' && planeProgress>=.94 && !playerDropped) {
      jumpFromPlane();
    }

    if (planeProgress>=1) {
      scene.remove(plane);
      plane=null;
    }
  }

  // Bot glide/landing simulation.
  for (const bot of bots) {
    if (!bot.userData.alive || !bot.userData.dropped || bot.userData.landed) continue;

    const target=bot.userData.dropTarget;
    const dx=target.x-bot.position.x;
    const dz=target.z-bot.position.z;
    const dist=Math.hypot(dx,dz)||1;

    const glide=dist>90 ? 46 : dist>35 ? 30 : 15;
    bot.position.x+=dx/dist*Math.min(glide*dt,dist);
    bot.position.z+=dz/dist*Math.min(glide*dt,dist);

    const descendRate=dist>45 ? 3.2 : dist>14 ? 7 : 12;
    bot.position.y=Math.max(0,bot.position.y-descendRate*dt);

    if (bot.position.y<=.35) {
      bot.position.x=target.x;
      bot.position.z=target.z;
      bot.position.y=0;

      if(!isSafeLandingSpot(bot.position.x,bot.position.z,2.2)){
        const safe=randomGroundPoint(32);
        bot.position.x=safe.x;
        bot.position.z=safe.z;
      }

      bot.userData.landed=true;
      bot.userData.target=null;
      bot.visible=true;
    }
  }

  if (brPhase==='falling' || brPhase==='parachute') {
    let mx=mobile.moveX;
    let mz=mobile.moveY;

    if(keys.has('KeyA')) mx-=1;
    if(keys.has('KeyD')) mx+=1;
    if(keys.has('KeyW')) mz-=1;
    if(keys.has('KeyS')) mz+=1;

    const inputLength=Math.hypot(mx,mz);
    if(inputLength>1){ mx/=inputLength; mz/=inputLength; }

    const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
    const right=new THREE.Vector3(-forward.z,0,forward.x);
    const glide=forward.multiplyScalar(-mz).add(right.multiplyScalar(mx));

    if(glide.lengthSq()>.001) {
      glide.normalize().multiplyScalar((brPhase==='parachute'?13:23)*dt);
    }

    player.position.x=THREE.MathUtils.clamp(player.position.x+glide.x,-GAME.mapHalf+2,GAME.mapHalf-2);
    player.position.z=THREE.MathUtils.clamp(player.position.z+glide.z,-GAME.mapHalf+2,GAME.mapHalf-2);

    if(brPhase==='falling' && player.position.y<28) openParachute();

    verticalVelocity=brPhase==='parachute'
      ? -6
      : Math.max(-30,verticalVelocity-20*dt);

    player.position.y=Math.max(0,player.position.y+verticalVelocity*dt);

    if(player.position.y<=.01) {
      player.position.y=0;
      brPhase='ground';
      zoneElapsed=0;
      spawnProtection=GAME.spawnProtectionSeconds;
      UI.jumpBtn?.classList.add('hidden');
      if (UI.jumpBtn) UI.jumpBtn.textContent='JUMP';
      showMessage('LANDED · SURVIVE',800);
      updateLootInteraction();
    }
  }
}

function findBotTarget(bot) {
  let best=null;
  let bestD=Infinity;

  if (hp>0 && brPhase==='ground') {
    const d=bot.position.distanceToSquared(player.position);
    if(d<bestD){
      best={type:'player',obj:player};
      bestD=d;
    }
  }

  for(const other of bots){
    if(other===bot || !other.userData.alive || !other.userData.landed) continue;
    const d=bot.position.distanceToSquared(other.position);
    if(d<bestD){
      best={type:'bot',obj:other};
      bestD=d;
    }
  }

  return best;
}

function damageBotByBot(target,amount,killer) {
  if(!target.userData.alive) return;

  pulseCharacterAction(target,'hit',1);
  target.userData.hp-=amount;
  if(target.userData.hp<=0){
    target.userData.alive=false;
    target.visible=false;
    killer.userData.kills=(killer.userData.kills||0)+1;
    showMessage(killer.userData.name+' eliminated '+target.userData.name,520);
    checkWin();
  }
}

function botShootTarget(bot,targetInfo,dist) {
  const target=targetInfo.obj;
  pulseCharacterAction(bot,'fire',1);
  bot.userData.firePulse=.12;
  const origin=bot.position.clone().add(new THREE.Vector3(0,2.25,0));
  const end=target.position.clone().add(new THREE.Vector3(0,2,0));
  const accuracy=THREE.MathUtils.clamp(.82-dist*.006,.32,.78);
  const hit=Math.random()<accuracy;

  if(!hit){
    end.x+=(Math.random()-.5)*8;
    end.y+=(Math.random()-.5)*3;
    end.z+=(Math.random()-.5)*8;
  }

  spawnTracer(origin,end,0xff775c);

  if(!hit) return;
  if(targetInfo.type==='player') damagePlayer(GAME.botDamage);
  else damageBotByBot(target,GAME.botDamage,bot);
}

function makeBot(index) {
  const colors=[0x8b3944,0x355b8f,0x7d6b2f,0x5d3f7c,0x2f6f68];
  const accents=[0xd4a845,0x7fb2e1,0xd4bf62,0xb090dc,0x68c1ae];

  const root=createHumanoidCharacter({
    name:'BotCharacter',
    bot:true,
    outfitColor:colors[index%colors.length],
    pantsColor:0x242b33,
    vestColor:0x3a4652,
    skinColor:0xc89470,
    hairColor:0x171a1f,
    shoeColor:0x11161c,
    accentColor:accents[index%accents.length]
  });

  Object.assign(root.userData,{
    hp:100,
    alive:true,
    nextShot:700+Math.random()*800,
    strafe:Math.random()<.5?-1:1,
    think:Math.random()*1.2,
    firePulse:0
  });

  scene.add(root);
  return root;
}

function resetMatch(options={}) {
  const battleRoyale=options.battleRoyale!==false;

  if(plane){ scene.remove(plane); plane=null; }
  clearCars();
  UI.planeJumpBtn?.classList.add('hidden');
  UI.jumpBtn?.classList.add('hidden');
  if (UI.jumpBtn) UI.jumpBtn.textContent='JUMP';

  bots.forEach(b=>scene.remove(b));
  bots=[];
  tracers.forEach(t=>scene.remove(t.mesh));
  tracers=[];

  hp=GAME.maxHp;
  inventory=createEmptyInventory();
  activeWeaponSlot=0;
  lastPickupAt=0;
  lastAutoPickupAt=0;
  backpackOpen=false;
  UI.backpackOverlay?.classList.add('hidden');
  clearLoot();

  if(battleRoyale){
    ammo=0;
    reserve=0;
  } else {
    inventory.weapons[0]={id:'AR4',magAmmo:WEAPONS.AR4.mag};
    inventory.ammo['5.56']=120;
    syncLegacyAmmo();
  }

  kills=0;
  reloading=false;
  lastShot=0;
  elapsed=0;
  zoneElapsed=0;
  spawnProtection=GAME.spawnProtectionSeconds;
  yaw=Math.PI;
  pitch=-.18;
  aiming=false;
  ended=false;
  paused=false;
  keys.clear();
  mobile.moveX=mobile.moveY=0;
  mobile.firing=false;
  centerStick();

  player.visible=true;
  player.position.set(0,0,0);
  bodyYaw=wrapAngle(yaw+Math.PI);
  player.rotation.y=bodyYaw;

  if(lobbyStage) lobbyStage.visible=false;
  if(zoneRing) zoneRing.visible=true;

  if(battleRoyale){
    brPhase='countdown';
    for(let i=0;i<GAME.botCount;i++){
      const bot=makeBot(i);
      bot.position.set(0,72,0);
      bot.visible=false;
      bot.userData.name='BOT '+String(i+1).padStart(2,'0');
      bot.userData.dropped=false;
      bot.userData.landed=false;
      bot.userData.target=null;
      bots.push(bot);
    }
    spawnBattleRoyaleLoot();
    spawnCars();
  } else {
    brPhase='ground';
  }

  UI.endOverlay.classList.add('hidden');
  UI.reloadState.textContent='';
  updateHud();
}

function clearMatchCountdown() {
  countdownTimers.forEach(clearTimeout);
  countdownTimers = [];
}

function beginMatchCountdown() {
  clearMatchCountdown();
  paused = true;
  showMessage('3', 100000);

  countdownTimers.push(setTimeout(() => showMessage('2', 100000), 1000));
  countdownTimers.push(setTimeout(() => showMessage('1', 100000), 2000));
  countdownTimers.push(setTimeout(() => {
    showMessage('GO!',550);
    setupBattleRoyaleFlight();
    paused=false;
    spawnProtection=GAME.spawnProtectionSeconds;
    clock.getDelta();
  },3000));
}

function setGameUiVisible(visible) {
  UI.hud.classList.toggle('hidden',!visible);
  UI.mobileControls.classList.toggle('hidden',!visible);
}

function showLobby() {
  clearMatchCountdown();
  clearOneVOneWorld();
  if (multiplayer) window.Mini3DNet?.leave?.();
  multiplayer=false;
  multiplayerRoom=null;
  multiplayerRole=null;
  remoteUserId=null;
  multiplayerTimeRemaining=ONEVONE_MATCH_SECONDS;
  multiplayerLastClockAt=0;
  multiplayerRespawnAt=0;
  multiplayerShieldUntil=0;
  multiplayerFinished=false;
  remoteAliveLast=null;
  remoteKills=0;
  if (remotePlayer) {
    scene.remove(remotePlayer);
    remotePlayer=null;
  }
  document.exitPointerLock?.();
  document.getElementById('lobbyDrawer')?.classList.remove('open');
  document.getElementById('profileOverlay')?.classList.add('hidden');
  document.getElementById('friendsOverlay')?.classList.add('hidden');
  document.getElementById('drawerBackdrop')?.classList.remove('open');
  document.getElementById('drawerToggle')?.classList.remove('open');
  started=false;
  paused=false;
  ended=false;
  brPhase='lobby';
  playerDropped=false;
  planeProgress=0;
  zoneElapsed=0;
  UI.planeJumpBtn?.classList.add('hidden');
  UI.jumpBtn?.classList.add('hidden');
  if(plane){scene.remove(plane);plane=null;}
  clearLoot();
  clearCars();
  closeBackpack();
  reloading=false;
  mobile.firing=false;
  keys.clear();

  // Dedicated lobby presentation state.
  bots.forEach(bot=>bot.visible=false);
  player.visible=true;
  player.position.set(0,.28,0);
  lobbyCharacterYaw=-.28;
  bodyYaw=lobbyCharacterYaw;
  player.rotation.y=bodyYaw;
  lobbyTime=0;

  if (lobbyStage) {
    lobbyStage.position.set(0,0,0);
    lobbyStage.visible=true;
  }
  if (zoneRing) zoneRing.visible=false;

  setGameUiVisible(false);
  UI.endOverlay.classList.add('hidden');
  UI.startOverlay.classList.remove('hidden');
  UI.lobbyHint.textContent='SOLO mode is ready.';
}

async function enterFullscreen() {
  const root=document.documentElement;
  const shell=document.getElementById('game-shell') || root;
  let entered=false;

  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      entered=true;
    } else if (shell.requestFullscreen) {
      // Use the simplest call first for best Android Chrome compatibility.
      await shell.requestFullscreen();
      entered=true;
    } else if (shell.webkitRequestFullscreen) {
      shell.webkitRequestFullscreen();
      entered=true;
    } else if (root.requestFullscreen) {
      await root.requestFullscreen();
      entered=true;
    } else if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
      entered=true;
    }
  } catch (error) {
    entered=false;
  }

  // Try to collapse the browser chrome even when Fullscreen API is unavailable.
  try {
    window.scrollTo(0,1);
  } catch (error) {}

  if (entered) {
    document.body.classList.add('is-fullscreen');
    if (UI.lobbyHint) UI.lobbyHint.textContent='Fullscreen enabled.';
  } else {
    if (UI.lobbyHint) {
      UI.lobbyHint.textContent='Chrome did not allow fullscreen in this tab. Use browser menu → Add to Home screen / Install app for true fullscreen.';
    }
  }

  try {
    if (entered && screen.orientation?.lock) {
      await screen.orientation.lock('landscape');
    }
  } catch (error) {}

  return entered;
}

document.addEventListener('fullscreenchange', () => {
  document.body.classList.toggle('is-fullscreen', Boolean(document.fullscreenElement));
});

document.addEventListener('webkitfullscreenchange', () => {
  document.body.classList.toggle('is-fullscreen', Boolean(document.webkitFullscreenElement));
});

async function startMatch() {
  clearOneVOneWorld();
  document.getElementById('lobbyDrawer')?.classList.remove('open');
  document.getElementById('drawerBackdrop')?.classList.remove('open');
  document.getElementById('drawerToggle')?.classList.remove('open');

  if(selectedMode==='1v1'){
    UI.lobbyHint.textContent='Choose an online friend and press INVITE.';
    document.querySelector('[data-shortcut="friends"]')?.click();
    return;
  }

  if(selectedMode!=='solo'){
    UI.lobbyHint.textContent='This mode needs the next multiplayer backend expansion.';
    return;
  }

  // Keep fullscreen independent from game startup so a browser rejection
  // can never prevent the match from starting.
  enterFullscreen().catch(()=>{});

  resetMatch();
  started=true;
  paused=true;
  ended=false;

  UI.startOverlay.classList.add('hidden');
  UI.endOverlay.classList.add('hidden');
  setGameUiVisible(true);

  // Pointer lock is requested while the PLAY click is still a user gesture.
  if (matchMedia('(pointer:fine)').matches) {
    renderer.domElement.requestPointerLock?.();
  }

  beginMatchCountdown();
}


function openSettings(initialPage='sensitivity') {
  document.getElementById('lobbyDrawer')?.classList.remove('open');
  document.getElementById('drawerBackdrop')?.classList.remove('open');
  document.getElementById('drawerToggle')?.classList.remove('open');
  document.getElementById('settingsOverlay')?.classList.remove('hidden');
  showSettingsPage(initialPage);
  syncSettingsUi();
}

function closeSettings() {
  document.getElementById('settingsOverlay')?.classList.add('hidden');
}

function showSettingsPage(page) {
  const validPages=['sensitivity','controls','graphics','account'];
  const activePage=validPages.includes(page)?page:'sensitivity';
  const pageIds={
    sensitivity:'settingsSensitivityPage',
    controls:'settingsControlsPage',
    graphics:'settingsGraphicsPage',
    account:'settingsAccountPage'
  };

  document.querySelectorAll('.settings-page').forEach(section=>{
    section.classList.toggle('active',section.id===pageIds[activePage]);
  });

  document.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.settingsPage === activePage);
  });

  if(activePage==='controls') requestAnimationFrame(renderControlPreview);
  if(activePage==='account') syncAccountSettingsUi();
}

function syncSettingsUi() {
  const sensitivityBindings = [
    ['sensHorizontal', 'sensHorizontalValue', 'horizontal'],
    ['sensVertical', 'sensVerticalValue', 'vertical'],
    ['sensAds', 'sensAdsValue', 'ads'],
    ['sensFiring', 'sensFiringValue', 'firing']
  ];

  sensitivityBindings.forEach(([inputId,valueId,key]) => {
    const input=document.getElementById(inputId);
    const value=document.getElementById(valueId);
    if (input) input.value=userSettings.sensitivity[key];
    if (value) value.textContent=userSettings.sensitivity[key] + '%';
  });

  syncSelectedControlEditor();
  renderControlPreview();

  const graphics=userSettings.graphics || cloneDefaults().graphics;
  document.querySelectorAll('.graphics-preset').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.graphicsPreset===graphics.preset);
  });

  const shadows=document.getElementById('graphicsShadows');
  const shadowsValue=document.getElementById('graphicsShadowsValue');
  const distance=document.getElementById('graphicsDistance');
  const distanceValue=document.getElementById('graphicsDistanceValue');
  const effects=document.getElementById('graphicsEffects');
  const effectsValue=document.getElementById('graphicsEffectsValue');
  const fps=document.getElementById('graphicsFps');
  const fpsValue=document.getElementById('graphicsFpsValue');

  if(shadows) shadows.checked=Boolean(graphics.shadows);
  if(shadowsValue) shadowsValue.textContent=graphics.shadows?'ON':'OFF';
  if(distance) distance.value=graphics.renderDistance;
  if(distanceValue) distanceValue.textContent=graphics.renderDistance+'m';
  if(effects) effects.value=graphics.effects;
  if(effectsValue) effectsValue.textContent=String(graphics.effects).toUpperCase();
  if(fps) fps.value=String(graphics.fpsLimit);
  if(fpsValue) fpsValue.textContent=graphics.fpsLimit===0?'UNLIMITED':graphics.fpsLimit+' FPS';

  syncAccountSettingsUi();
}

function syncSelectedControlEditor() {
  const cfg=userSettings.controls[selectedControl];
  const name=document.getElementById('selectedControlName');
  const size=document.getElementById('controlSize');
  const sizeValue=document.getElementById('controlSizeValue');
  const opacity=document.getElementById('controlOpacity');
  const opacityValue=document.getElementById('controlOpacityValue');

  if (name) name.textContent=selectedControl.toUpperCase();
  if (size) size.value=cfg.scale;
  if (sizeValue) sizeValue.textContent=cfg.scale + '%';
  if (opacity) opacity.value=cfg.opacity;
  if (opacityValue) opacityValue.textContent=cfg.opacity + '%';

  document.querySelectorAll('.control-preview-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.control === selectedControl);
  });
}

function renderControlPreview() {
  const preview=document.getElementById('controlPreview');
  if (!preview) return;

  const baseSizes={move:68,fire:50,reload:42};

  document.querySelectorAll('.control-preview-item').forEach(item => {
    const name=item.dataset.control;
    const cfg=userSettings.controls[name];
    if (!cfg) return;

    const size=baseSizes[name]*(cfg.scale/100);
    item.style.left=cfg.x + '%';
    item.style.top=cfg.y + '%';
    item.style.width=size + 'px';
    item.style.height=size + 'px';
    item.style.opacity=String(cfg.opacity/100);
  });
}

function bindSettingsUi() {
  document.getElementById('settingsClose')?.addEventListener('click',closeSettings);

  document.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.addEventListener('click',()=>showSettingsPage(btn.dataset.settingsPage));
  });

  const sensitivityBindings = [
    ['sensHorizontal', 'sensHorizontalValue', 'horizontal'],
    ['sensVertical', 'sensVerticalValue', 'vertical'],
    ['sensAds', 'sensAdsValue', 'ads'],
    ['sensFiring', 'sensFiringValue', 'firing']
  ];

  sensitivityBindings.forEach(([inputId,valueId,key]) => {
    const input=document.getElementById(inputId);
    const value=document.getElementById(valueId);
    input?.addEventListener('input',()=>{
      userSettings.sensitivity[key]=Number(input.value);
      if (value) value.textContent=input.value + '%';
      saveUserSettings();
    });
  });

  document.getElementById('resetSensitivity')?.addEventListener('click',()=>{
    userSettings.sensitivity={...cloneDefaults().sensitivity};
    saveUserSettings();
    syncSettingsUi();
  });

  const preview=document.getElementById('controlPreview');
  let drag=null;

  document.querySelectorAll('.control-preview-item').forEach(item => {
    item.addEventListener('pointerdown',e=>{
      e.preventDefault();
      selectedControl=item.dataset.control;
      syncSelectedControlEditor();

      const rect=item.getBoundingClientRect();
      drag={
        pointerId:e.pointerId,
        item,
        offsetX:e.clientX-rect.left,
        offsetY:e.clientY-rect.top
      };
      item.setPointerCapture?.(e.pointerId);
    });

    item.addEventListener('pointermove',e=>{
      if (!drag || drag.pointerId!==e.pointerId || drag.item!==item || !preview) return;

      const area=preview.getBoundingClientRect();
      const itemRect=item.getBoundingClientRect();

      const maxX=Math.max(0,area.width-itemRect.width);
      const maxY=Math.max(0,area.height-itemRect.height);

      const px=Math.min(maxX,Math.max(0,e.clientX-area.left-drag.offsetX));
      const py=Math.min(maxY,Math.max(0,e.clientY-area.top-drag.offsetY));

      const cfg=userSettings.controls[selectedControl];
      cfg.x=(px/area.width)*100;
      cfg.y=(py/area.height)*100;

      item.style.left=cfg.x + '%';
      item.style.top=cfg.y + '%';
    });

    const stop=e=>{
      if (drag?.pointerId===e.pointerId) drag=null;
    };
    item.addEventListener('pointerup',stop);
    item.addEventListener('pointercancel',stop);
  });

  document.getElementById('controlSize')?.addEventListener('input',e=>{
    userSettings.controls[selectedControl].scale=Number(e.target.value);
    document.getElementById('controlSizeValue').textContent=e.target.value + '%';
    renderControlPreview();
  });

  document.getElementById('controlOpacity')?.addEventListener('input',e=>{
    userSettings.controls[selectedControl].opacity=Number(e.target.value);
    document.getElementById('controlOpacityValue').textContent=e.target.value + '%';
    renderControlPreview();
  });

  document.getElementById('resetControlLayout')?.addEventListener('click',()=>{
    userSettings.controls=cloneDefaults().controls;
    selectedControl='fire';
    renderControlPreview();
    syncSelectedControlEditor();
  });

  document.getElementById('saveControlLayout')?.addEventListener('click',()=>{
    saveUserSettings();
    applyControlLayout();

    const toast=document.getElementById('lobbyTabToast');
    if (toast) {
      toast.textContent='CONTROL LAYOUT SAVED';
      toast.classList.remove('hidden');
      clearTimeout(toast._hideTimer);
      toast._hideTimer=setTimeout(()=>toast.classList.add('hidden'),900);
    }
  });
}

  document.querySelectorAll('.graphics-preset').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(btn.dataset.graphicsPreset==='custom') return;
      setGraphicsPreset(btn.dataset.graphicsPreset);
    });
  });

  document.getElementById('graphicsShadows')?.addEventListener('change',event=>{
    markGraphicsCustom();
    userSettings.graphics.shadows=Boolean(event.target.checked);
    saveUserSettings();
    applyGraphicsSettings();
    syncSettingsUi();
  });

  document.getElementById('graphicsDistance')?.addEventListener('input',event=>{
    markGraphicsCustom();
    userSettings.graphics.renderDistance=Number(event.target.value);
    saveUserSettings();
    applyGraphicsSettings();
    syncSettingsUi();
  });

  document.getElementById('graphicsEffects')?.addEventListener('change',event=>{
    markGraphicsCustom();
    userSettings.graphics.effects=event.target.value;
    saveUserSettings();
    applyGraphicsSettings();
    syncSettingsUi();
  });

  document.getElementById('graphicsFps')?.addEventListener('change',event=>{
    markGraphicsCustom();
    userSettings.graphics.fpsLimit=Number(event.target.value);
    saveUserSettings();
    applyGraphicsSettings();
    syncSettingsUi();
  });

  document.getElementById('resetGraphics')?.addEventListener('click',()=>{
    userSettings.graphics={...cloneDefaults().graphics};
    saveUserSettings();
    applyGraphicsSettings();
    syncSettingsUi();
  });

  document.getElementById('settingsOpenProfile')?.addEventListener('click',()=>{
    closeSettings();
    window.Mini3DProfile?.openProfile?.();
  });

  document.getElementById('settingsOpenFriends')?.addEventListener('click',()=>{
    closeSettings();
    window.Mini3DProfile?.openFriends?.();
  });

  document.getElementById('settingsCopyPlayerId')?.addEventListener('click',async()=>{
    const copied=await window.Mini3DProfile?.copyPlayerId?.();
    const toast=document.getElementById('lobbyTabToast');
    if(toast){
      toast.textContent=copied?'PLAYER ID COPIED':'PLAYER ID UNAVAILABLE';
      toast.classList.remove('hidden');
      clearTimeout(toast._hideTimer);
      toast._hideTimer=setTimeout(()=>toast.classList.add('hidden'),900);
    }
  });

  document.getElementById('settingsAccountAuth')?.addEventListener('click',async()=>{
    const account=window.Mini3DProfile?.getAccountState?.();
    if(account?.signedIn) await window.Mini3DProfile?.signOut?.();
    else await window.Mini3DProfile?.signIn?.();
    syncAccountSettingsUi();
  });

  document.addEventListener('mini3d:account-updated',syncAccountSettingsUi);


function bindInputs() {
  addEventListener('resize', onResize);
  addEventListener('keydown', e => {
    if (['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)) keys.add(e.code);
    if (e.code === 'KeyR') beginReload();
    if (e.code === 'KeyE') pickupNearestLoot();
    if (e.code === 'Digit1') setActiveWeaponSlot(0);
    if (e.code === 'Digit2') setActiveWeaponSlot(1);
    if (e.code === 'KeyB') backpackOpen ? closeBackpack() : openBackpack();
    if (e.code === 'KeyH') useBandage();
    if (e.code === 'KeyF') toggleCar();
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if(e.code==='Space'){
      if(brPhase==='plane') jumpFromPlane();
      else if(brPhase==='falling') openParachute();
    }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('mousemove', e => {
    if (!started || paused || ended || document.pointerLockElement !== renderer.domElement) return;
    // Drag/move right -> look right. Move up -> look up.
    const sensitivityFactor=getSensitivityFactor();
    yaw = wrapAngle(yaw - e.movementX * .0023 * (userSettings.sensitivity.horizontal/100) * sensitivityFactor);
    pitch += e.movementY * .0018 * (userSettings.sensitivity.vertical/100) * sensitivityFactor;
    pitch = THREE.MathUtils.clamp(pitch,-.62,.34);
  });
  renderer.domElement.addEventListener('mousedown', e => {
    if (!started) return;
    if (e.button === 0) shoot();
    if (e.button === 2) aiming = true;
    if (document.pointerLockElement !== renderer.domElement && matchMedia('(pointer:fine)').matches) renderer.domElement.requestPointerLock?.();
  });
  addEventListener('mouseup', e => {
    if (e.button === 2) aiming = false;
  });
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

  bindSettingsUi();

  const lobbyHero=document.getElementById('lobbyCharacterDrag') || document.querySelector('.lobby-hero');
  let lobbyDragPointer=null;
  let lobbyDragX=0;

  lobbyHero?.addEventListener('pointerdown', e => {
    if (started) return;
    lobbyDragPointer=e.pointerId;
    lobbyDragX=e.clientX;
    lobbyHero.setPointerCapture?.(e.pointerId);
  });

  lobbyHero?.addEventListener('pointermove', e => {
    if (started || lobbyDragPointer!==e.pointerId) return;
    const dx=e.clientX-lobbyDragX;
    lobbyDragX=e.clientX;
    lobbyCharacterYaw=wrapAngle(lobbyCharacterYaw+dx*.012);
  });

  const stopLobbyDrag=e => {
    if (lobbyDragPointer===e.pointerId) lobbyDragPointer=null;
  };
  lobbyHero?.addEventListener('pointerup',stopLobbyDrag);
  lobbyHero?.addEventListener('pointercancel',stopLobbyDrag);

  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      const mode=card.dataset.mode;
      if(card.classList.contains('locked')){
        UI.lobbyHint.textContent='FRIEND / TEAM mode needs the next multiplayer backend expansion.';
        return;
      }

      selectedMode=mode;
      document.querySelectorAll('.mode-card').forEach(item=>item.classList.remove('active'));
      card.classList.add('active');

      const desktopLabel=UI.startBtn?.querySelector('span:last-child');
      const mobileLabel=UI.mobileStartBtn?.querySelector('span:first-child');
      const mobileMode=document.querySelector('.match-mode-card');

      if(mode==='1v1'){
        UI.lobbyPlayers.textContent='2 PLAYERS';
        UI.lobbyHint.textContent='1V1 ready · invite an online friend to enter the Arena.';
        if(desktopLabel) desktopLabel.textContent='OPEN FRIENDS';
        if(mobileLabel) mobileLabel.textContent='FRIENDS';
        if(mobileMode){
          mobileMode.querySelector('.mode-thumb').textContent='1V1';
          mobileMode.querySelector('strong').textContent='1V1 · Arena';
          mobileMode.querySelector('small').textContent='INVITE AN ONLINE FRIEND';
        }
      }else{
        UI.lobbyPlayers.textContent='1 + 29 BOTS';
        UI.lobbyHint.textContent='SOLO mode is ready.';
        if(desktopLabel) desktopLabel.textContent='PLAY SOLO';
        if(mobileLabel) mobileLabel.textContent='START';
        if(mobileMode){
          mobileMode.querySelector('.mode-thumb').textContent='GV';
          mobileMode.querySelector('strong').textContent='Classic · Solo';
          mobileMode.querySelector('small').textContent='GREEN VALLEY · 1 + 29 BOTS';
        }
      }
    });
  });

  document.querySelectorAll('.lobby-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab=item.dataset.lobbyTab || 'season';
      document.querySelectorAll('.lobby-nav-item').forEach(x=>x.classList.remove('active'));
      item.classList.add('active');
      window.Mini3DLobbyHub?.open?.(tab);
    });
  });

  const drawer=document.getElementById('lobbyDrawer');
  const drawerToggle=document.getElementById('drawerToggle');
  const drawerClose=document.getElementById('drawerClose');
  const drawerBackdrop=document.getElementById('drawerBackdrop');

  const setDrawerOpen=open => {
    drawer?.classList.toggle('open',open);
    drawerBackdrop?.classList.toggle('open',open);
    drawerToggle?.classList.toggle('open',open);
    drawerToggle?.setAttribute('aria-expanded',String(open));
  };

  drawerToggle?.addEventListener('click',()=>setDrawerOpen(!drawer?.classList.contains('open')));
  drawerClose?.addEventListener('click',()=>setDrawerOpen(false));
  drawerBackdrop?.addEventListener('click',()=>setDrawerOpen(false));

  document.querySelectorAll('.drawer-item').forEach(item=>{
    item.addEventListener('click',()=>{
      const page=item.dataset.drawerItem || '';

      if(page==='settings'){
        setDrawerOpen(false);
        openSettings('sensitivity');
        return;
      }

      if(page==='studio'){
        // studio-entry.js owns authorization and navigation for this button.
        return;
      }

      setDrawerOpen(false);
      window.Mini3DLobbyHub?.open?.(page);
    });
  });

  UI.fullscreenBtn?.addEventListener('click', enterFullscreen);
  UI.startBtn.addEventListener('click', startMatch);
  UI.mobileStartBtn?.addEventListener('click', startMatch);
  UI.restartBtn.addEventListener('click', () => {
    if(multiplayer){
      showLobby();
      return;
    }

    resetMatch();
    started=true;
    paused=true;
    ended=false;
    setGameUiVisible(true);
    UI.endOverlay.classList.add('hidden');
    beginMatchCountdown();
  });
  UI.lobbyBtn.addEventListener('click', showLobby);
  UI.pauseBtn.addEventListener('click', togglePause);
  UI.reloadBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    beginReload();
  });

  const handlePickupInput=e=>{
    e?.preventDefault?.();
    e?.stopPropagation?.();
    pickupNearestLoot();
  };
  UI.pickupBtn?.addEventListener('pointerdown',handlePickupInput);
  UI.pickupBtn?.addEventListener('click',handlePickupInput);
  UI.pickupMobileBtn?.addEventListener('pointerdown',handlePickupInput);
  UI.pickupMobileBtn?.addEventListener('click',handlePickupInput);
  UI.bandageBtn?.addEventListener('pointerdown',e=>{e.preventDefault();useBandage();});
  UI.weaponSlot1?.addEventListener('click',()=>setActiveWeaponSlot(0));
  UI.weaponSlot2?.addEventListener('click',()=>setActiveWeaponSlot(1));
  UI.bagWeapon1?.addEventListener('click',()=>setActiveWeaponSlot(0));
  UI.bagWeapon2?.addEventListener('click',()=>setActiveWeaponSlot(1));
  UI.backpackBtn?.addEventListener('click',openBackpack);
  UI.backpackClose?.addEventListener('click',closeBackpack);
  UI.useBandageBag?.addEventListener('click',useBandage);
  UI.backpackOverlay?.addEventListener('click',e=>{if(e.target===UI.backpackOverlay)closeBackpack();});

  const handleDriveInput=e=>{
    e?.preventDefault?.();
    e?.stopPropagation?.();
    toggleCar();
  };
  UI.driveBtn?.addEventListener('pointerdown',handleDriveInput);
  UI.driveBtn?.addEventListener('click',handleDriveInput);
  UI.driveMobileBtn?.addEventListener('pointerdown',handleDriveInput);
  UI.driveMobileBtn?.addEventListener('click',handleDriveInput);
  UI.planeJumpBtn?.addEventListener('pointerdown',e=>{
    e.preventDefault();
    e.stopPropagation();
    jumpFromPlane();
  });
  UI.planeJumpBtn?.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    jumpFromPlane();
  });
  UI.jumpBtn?.addEventListener('pointerdown',e=>{
    e.preventDefault();
    e.stopPropagation();
    openParachute();
  });
  UI.jumpBtn?.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    openParachute();
  });

  setupMovePad();
  setupLookPad();
  UI.fireBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    mobile.firePointer = e.pointerId;
    mobile.firing = true;
    shoot();
  });
  UI.fireBtn.addEventListener('pointerup', e => {
    if (mobile.firePointer === e.pointerId) {
      mobile.firing = false;
      mobile.firePointer = null;
    }
  });
  UI.fireBtn.addEventListener('pointercancel', () => {
    mobile.firing = false;
    mobile.firePointer = null;
  });
}

function setupMovePad() {
  UI.movePad.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (mobile.movePointer !== null) return;
    mobile.movePointer = e.pointerId;
    UI.movePad.setPointerCapture(e.pointerId);
    updateMove(e);
  });
  UI.movePad.addEventListener('pointermove', e => {
    if (mobile.movePointer === e.pointerId) updateMove(e);
  });
  const end = e => {
    if (mobile.movePointer === e.pointerId) {
      mobile.movePointer = null;
      mobile.moveX = mobile.moveY = 0;
      centerStick();
    }
  };
  UI.movePad.addEventListener('pointerup', end);
  UI.movePad.addEventListener('pointercancel', end);
}

function updateMove(e) {
  const r = UI.movePad.getBoundingClientRect();
  const cx = r.left+r.width/2;
  const cy = r.top+r.height/2;
  let dx = e.clientX-cx;
  let dy = e.clientY-cy;
  const max = r.width*.32;
  const len = Math.hypot(dx,dy) || 1;
  if (len>max) {
    dx = dx/len*max;
    dy = dy/len*max;
  }
  mobile.moveX = dx/max;
  mobile.moveY = dy/max;
  UI.moveStick.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
}

function centerStick() {
  UI.moveStick.style.transform='translate(0px,0px)';
}

function setupLookPad() {
  UI.lookPad.addEventListener('pointerdown', e => {
    if (mobile.lookPointer !== null) return;
    mobile.lookPointer=e.pointerId;
    mobile.lookLastX=e.clientX;
    mobile.lookLastY=e.clientY;
    UI.lookPad.setPointerCapture(e.pointerId);
  });
  UI.lookPad.addEventListener('pointermove', e => {
    if (mobile.lookPointer !== e.pointerId || paused || ended) return;
    const dx=e.clientX-mobile.lookLastX;
    const dy=e.clientY-mobile.lookLastY;
    mobile.lookLastX=e.clientX;
    mobile.lookLastY=e.clientY;
    // PUBG-style camera drag: right -> right, up -> up.
    const sensitivityFactor=getSensitivityFactor();
    yaw = wrapAngle(yaw - dx*.006 * (userSettings.sensitivity.horizontal/100) * sensitivityFactor);
    pitch += dy*.0045 * (userSettings.sensitivity.vertical/100) * sensitivityFactor;
    pitch = THREE.MathUtils.clamp(pitch,-.62,.34);
  });
  const end=e=>{
    if(mobile.lookPointer===e.pointerId) mobile.lookPointer=null;
  };
  UI.lookPad.addEventListener('pointerup',end);
  UI.lookPad.addEventListener('pointercancel',end);
}

function togglePause() {
  if (!started || ended) return;
  if(multiplayer){
    showMessage('PAUSE DISABLED IN 1V1',550);
    return;
  }
  paused = !paused;
  showMessage(paused ? 'PAUSED' : '', paused ? 999999 : 0);
  if (!paused) clock.getDelta();
}

function beginReload() {
  if (!started || paused || ended || reloading || activeCar) return;
  if (multiplayer && hp<=0) return;
  if (!multiplayer && brPhase!=='ground') return;

  const slot=getActiveWeaponSlot();
  const def=getWeaponDef(slot);
  if(!slot || !def) return;

  const available=multiplayer
    ? Infinity
    : (inventory.ammo[def.ammoType] || 0);
  if(slot.magAmmo>=def.mag || available<=0) return;

  reloading=true;
  pulseCharacterAction(player,'reload',1);
  UI.reloadState.textContent='Reloading…';
  const startedAt=performance.now();

  const check=()=>{
    if(!reloading || ended) return;
    if(performance.now()-startedAt>=def.reloadMs){
      const need=def.mag-slot.magAmmo;
      const take=multiplayer
        ? need
        : Math.min(need,inventory.ammo[def.ammoType]||0);
      slot.magAmmo+=take;
      if(!multiplayer) inventory.ammo[def.ammoType]-=take;
      reloading=false;
      UI.reloadState.textContent='';
      syncLegacyAmmo();
      updateHud();
    } else {
      requestAnimationFrame(check);
    }
  };

  requestAnimationFrame(check);
}

function shoot() {
  if (!started || paused || ended || reloading || activeCar) return;
  if (multiplayer && hp<=0) return;
  if (!multiplayer && brPhase!=='ground') return;
  const slot=getActiveWeaponSlot();
  const weapon=getWeaponDef(slot);
  if(!slot || !weapon){ showMessage('NO WEAPON',350); return; }

  const now=performance.now();
  if (now-lastShot < weapon.fireDelay) return;
  lastShot=now;

  if (slot.magAmmo<=0) {
    beginReload();
    return;
  }

  slot.magAmmo--;
  pulseCharacterAction(player,'fire',1);
  syncLegacyAmmo();
  updateHud();

  const origin = camera.getWorldPosition(tmpV.clone());
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();
  raycaster.set(origin,dir);
  raycaster.far=weapon?.range || 140;
  const liveMeshes=[];
  if(multiplayer && remotePlayer?.visible){
    getCharacterHitMeshes(remotePlayer).forEach(mesh=>{
      mesh.userData.remotePlayer=remotePlayer;
      liveMeshes.push(mesh);
    });
  }else{
    bots.forEach(bot=>{
      if(!bot.userData.alive) return;
      getCharacterHitMeshes(bot).forEach(mesh=>{
        mesh.userData.bot=bot;
        liveMeshes.push(mesh);
      });
    });
  }

  const shotTargets=multiplayer
    ? [...liveMeshes,...oneVOneOccluders]
    : liveMeshes;
  const hits=raycaster.intersectObjects(shotTargets,false);
  let end=origin.clone().addScaledVector(dir,80);

  if(hits.length){
    const hit=hits[0];
    end=hit.point.clone();

    if(multiplayer && hit.object.userData.remotePlayer){
      if(remoteTarget.shielded){
        showMessage('OPPONENT SHIELD',260);
      }else{
        const multiplier=getHitMultiplier(remotePlayer,hit.object);
        window.Mini3DNet?.sendDamage(remoteUserId,weapon.damage*multiplier);
        showHitmarker();
      }
    }else{
      const bot=hit.object.userData.bot;
      const multiplier=getHitMultiplier(bot,hit.object);
      damageBot(bot,weapon.damage*multiplier);
      showHitmarker();
    }
  }

  spawnTracer(origin,end,0xffdf76);

  if (multiplayer) {
    window.Mini3DNet?.sendShot({
      ox:origin.x,oy:origin.y,oz:origin.z,
      ex:end.x,ey:end.y,ez:end.z
    });
  }
}

function damageBot(bot, amount) {
  if(!bot.userData.alive) return;
  pulseCharacterAction(bot,'hit',1);
  bot.userData.hp -= amount;
  if(bot.userData.hp<=0){
    bot.userData.alive=false;
    bot.visible=false;
    kills++;
    showMessage('BOT DOWN',700);
    updateHud();
    checkWin();
  }
}

function damagePlayer(amount) {
  if(ended || spawnProtection>0) return;
  pulseCharacterAction(player,'hit',1);
  const reduced=amount*(1-THREE.MathUtils.clamp(inventory.armor,0,60)/100);
  hp = Math.max(0,hp-reduced);
  updateHud();
  if(hp<=0){
    if(multiplayer) handleOneVOneDeath();
    else endMatch(false);
  }
}

function spawnTracer(a,b,color) {
  const quality=userSettings.graphics?.effects || 'medium';
  if(quality==='low' && Math.random()<.45) return;

  const life=quality==='high'?.12:quality==='low'?.045:.08;
  const opacity=quality==='high'?1:quality==='low'?.62:.9;
  const geo=new THREE.BufferGeometry().setFromPoints([a,b]);
  const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity});
  const mesh=new THREE.Line(geo,mat);
  scene.add(mesh);
  tracers.push({mesh,life,maxLife:life});
}

function updateTracers(dt) {
  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];
    t.life-=dt;
    t.mesh.material.opacity=Math.max(0,t.life/(t.maxLife||.08));
    if(t.life<=0){
      scene.remove(t.mesh);
      tracers.splice(i,1);
    }
  }
}

function updatePlayer(dt) {
  if(multiplayer && hp<=0) return;

  let mx=0,mz=0;
  if(keys.has('KeyA')) mx-=1;
  if(keys.has('KeyD')) mx+=1;
  if(keys.has('KeyW')) mz-=1;
  if(keys.has('KeyS')) mz+=1;
  mx += mobile.moveX;
  mz += mobile.moveY;

  const inputLength=Math.hypot(mx,mz);
  if(inputLength>1){
    mx/=inputLength;
    mz/=inputLength;
  }

  const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?GAME.sprintSpeed:GAME.playerSpeed;
  const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right=new THREE.Vector3(-forward.z,0,forward.x);

  const moveDir=forward.clone().multiplyScalar(-mz).add(right.clone().multiplyScalar(mx));
  const isMoving=moveDir.lengthSq()>.0025;

  if(isMoving){
    moveDir.normalize();
    moveWithCollision(player,moveDir.clone().multiplyScalar(speed*dt),1.05);
  }

  // Free-look camera and character rotation are separate.
  // While moving, the body turns toward movement. While aiming/firing,
  // it turns toward the camera/crosshair direction.
  let desiredBodyYaw=bodyYaw;
  const recentlyFired=performance.now()-lastShot<180;
  if(aiming || mobile.firing || recentlyFired){
    desiredBodyYaw=wrapAngle(yaw+Math.PI);
  } else if(isMoving){
    const movementYaw=Math.atan2(moveDir.x,moveDir.z);
    desiredBodyYaw=wrapAngle(movementYaw+Math.PI);
  }

  bodyYaw=lerpAngle(bodyYaw,desiredBodyYaw,1-Math.exp(-12*dt));
  player.rotation.y=bodyYaw;

  updateHumanoidAnimation(player,{
    moving:isMoving,
    speed:isMoving?speed:0,
    sprinting:isMoving && (keys.has('ShiftLeft')||keys.has('ShiftRight')),
    aiming:aiming || mobile.firing || recentlyFired,
    reloading,
    airborne:brPhase==='falling' || brPhase==='parachute',
    crouching:false,
    dead:hp<=0
  },dt);

  updateLootInteraction();
  updateCarInteraction();
  if(mobile.firing) shoot();
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle),Math.cos(angle));
}

function lerpAngle(from,to,t) {
  const delta=wrapAngle(to-from);
  return wrapAngle(from+delta*t);
}

function moveWithCollision(obj, delta, radius) {
  const p=obj.position;
  const nx=THREE.MathUtils.clamp(p.x+delta.x,-activeMapHalf+2,activeMapHalf-2);
  const nz=THREE.MathUtils.clamp(p.z+delta.z,-activeMapHalf+2,activeMapHalf-2);
  if(!blocked(nx,p.z,radius)) p.x=nx;
  if(!blocked(p.x,nz,radius)) p.z=nz;
}

function blocked(x,z,r) {
  return colliders.some(c=>x+r>c.minX && x-r<c.maxX && z+r>c.minZ && z-r<c.maxZ);
}

function updateCamera() {
  const dist=aiming?4.5:7.5;
  const height=aiming?3.3:4.5;
  const look=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(-pitch),Math.cos(yaw)*Math.cos(pitch));
  const target=player.position.clone().add(new THREE.Vector3(0,2.4,0));
  const pos=target.clone().addScaledVector(look,-dist).add(new THREE.Vector3(0,height-2.4,0));
  camera.position.lerp(pos,.2);
  camera.lookAt(target.clone().addScaledVector(look,30));
  camera.fov=THREE.MathUtils.lerp(camera.fov,aiming?52:70,.16);
  camera.updateProjectionMatrix();
}

function updateLobby(dt) {
  lobbyTime+=dt;
  updateHumanoidAnimation(player,{lobby:true,moving:false,speed:0},dt);

  // Subtle root motion plus rig breathing/idle animation.
  player.position.y=.28+Math.sin(lobbyTime*1.7)*.025;
  player.rotation.y=lobbyCharacterYaw+Math.sin(lobbyTime*.55)*.028;

  if (lobbyStage) {
    const ring=lobbyStage.children[1];
    const innerRing=lobbyStage.children[2];
    if (ring) ring.rotation.z=lobbyTime*.13;
    if (innerRing) innerRing.rotation.z=-lobbyTime*.055;
  }

  if (lobbySpot) {
    lobbySpot.intensity=17+Math.sin(lobbyTime*1.4)*1.5;
  }

  const target=player.position.clone().add(new THREE.Vector3(0,2.05,0));
  const orbit=.54+Math.sin(lobbyTime*.18)*.035;
  const distance=7.15;

  const desired=new THREE.Vector3(
    Math.sin(orbit)*distance,
    3.42+Math.sin(lobbyTime*.30)*.055,
    Math.cos(orbit)*distance
  );

  const blend=1-Math.exp(-3.8*dt);
  camera.position.lerp(desired,blend);

  // Keep the character large and slightly left of center for lobby controls.
  camera.lookAt(target.clone().add(new THREE.Vector3(.78,.05,0)));
  camera.fov=THREE.MathUtils.lerp(camera.fov,44,blend);
  camera.updateProjectionMatrix();
}

function updateBots(dt) {
  for(const bot of bots){
    if(!bot.userData.alive || !bot.userData.landed) continue;

    bot.userData.think-=dt;

    if(
      bot.userData.think<=0 ||
      !bot.userData.target ||
      !bot.userData.target.obj?.visible
    ){
      bot.userData.target=findBotTarget(bot);
      bot.userData.think=.45+Math.random()*.85;
      if(Math.random()<.30) bot.userData.strafe*=-1;
    }

    const targetInfo=bot.userData.target;
    if(!targetInfo){
      updateHumanoidAnimation(bot,{moving:false,speed:0},dt);
      continue;
    }

    const target=targetInfo.obj;
    const toTarget=target.position.clone().sub(bot.position);
    const dist=toTarget.length();
    const flat=toTarget.clone();
    flat.y=0;

    if(flat.lengthSq()>.001) flat.normalize();
    // Humanoid characters face local -Z, so add PI to face the target.
    bot.rotation.y=wrapAngle(Math.atan2(flat.x,flat.z)+Math.PI);

    const strafe=new THREE.Vector3(flat.z,0,-flat.x).multiplyScalar(bot.userData.strafe);
    const move=new THREE.Vector3();

    if(dist>27) move.add(flat);
    else if(dist<11) move.addScaledVector(flat,-.55);
    else move.addScaledVector(strafe,.65);

    if(move.lengthSq()>0) move.normalize().multiplyScalar(GAME.botSpeed*dt);

    const before=bot.position.clone();
    moveWithCollision(bot,move,.95);
    const moved=bot.position.distanceTo(before);
    if(bot.position.distanceToSquared(before)<.002 && move.lengthSq()>0){
      bot.userData.strafe*=-1;
      bot.userData.think=0;
    }

    bot.userData.nextShot-=dt*1000;
    bot.userData.firePulse=Math.max(0,(bot.userData.firePulse||0)-dt);
    if(
      dist<70 &&
      bot.userData.nextShot<=0 &&
      hasSimpleLineOfSight(bot.position,target.position)
    ){
      bot.userData.nextShot=GAME.botFireMinMs+Math.random()*(GAME.botFireMaxMs-GAME.botFireMinMs);
      botShootTarget(bot,targetInfo,dist);
    }

    updateHumanoidAnimation(bot,{
      moving:moved>.001,
      speed:dt>0?moved/dt:0,
      sprinting:dist>34,
      aiming:dist<70,
      dead:!bot.userData.alive
    },dt);
  }
}

function hasSimpleLineOfSight(a,b) {
  const steps=14;
  for(let i=1;i<steps;i++){
    const t=i/steps;
    const x=THREE.MathUtils.lerp(a.x,b.x,t);
    const z=THREE.MathUtils.lerp(a.z,b.z,t);
    if(blocked(x,z,.15)) return false;
  }
  return true;
}

function botShoot(bot,dist) {
  const origin=bot.position.clone().add(new THREE.Vector3(0,2.25,0));
  const target=player.position.clone().add(new THREE.Vector3(0,2.0,0));
  const accuracy=THREE.MathUtils.clamp(.92-dist*.007,.48,.9);
  const hit=Math.random()<accuracy;
  const end=target.clone();
  if(!hit){
    end.x+=(Math.random()-.5)*7;
    end.y+=(Math.random()-.5)*4;
    end.z+=(Math.random()-.5)*7;
  }
  spawnTracer(origin,end,0xff775c);
  if(hit) damagePlayer(GAME.botDamage);
}

function currentZoneRadius() {
  const t=THREE.MathUtils.clamp(zoneElapsed/GAME.zoneShrinkSeconds,0,1);
  return THREE.MathUtils.lerp(GAME.zoneStart,GAME.zoneEnd,t);
}

function updateZone(dt) {
  const r=currentZoneRadius();
  zoneRing.scale.set(r,1,r);
  UI.zoneInfo.textContent='Zone: ' + Math.round(r) + ' m';
  const pr=Math.hypot(player.position.x,player.position.z);
  if(pr>r) damagePlayer(GAME.zoneDamagePerSecond*dt);
  if (multiplayer) UI.zoneInfo.textContent='1V1 · ROOM ' + multiplayerRoom;
  bots.forEach(b=>{
    if(b.userData.alive && Math.hypot(b.position.x,b.position.z)>r){
      b.userData.hp-=GAME.zoneDamagePerSecond*dt;
      if(b.userData.hp<=0){
        b.userData.alive=false;
        b.visible=false;
        checkWin();
      }
    }
  });
}

function checkWin() {
  if(bots.every(b=>!b.userData.alive) && !ended) endMatch(true);
  updateHud();
}

function endMatch(win) {
  clearMatchCountdown();
  ended=true;
  paused=false;
  reloading=false;
  mobile.firing=false;
  document.exitPointerLock?.();
  UI.endTitle.textContent=win?'WINNER!':'ELIMINATED';
  UI.endText.textContent='Kills: ' + kills + ' · Survived: ' + Math.floor(elapsed) + 's';
  UI.endOverlay.classList.remove('hidden');

  window.Mini3DS2?.recordMatch?.({
    mode:'solo',
    result:win?'win':'lose',
    kills
  });
}

function updateHud() {
  syncLegacyAmmo();

  UI.hp.textContent=Math.ceil(hp);
  UI.ammo.textContent=ammo;
  UI.reserve.textContent=Number.isFinite(reserve)?reserve:'∞';
  UI.kills.textContent=kills;
  UI.alive.textContent=multiplayer
    ? ((hp>0?1:0)+(remotePlayer?.visible?1:0))
    : 1+bots.filter(b=>b.userData.alive).length;
  UI.hp.parentElement.style.outline=hp<30?'1px solid rgba(255,80,80,.9)':'';

  const slot=getActiveWeaponSlot();
  const def=getWeaponDef(slot);
  if(UI.weaponName) UI.weaponName.textContent=def ? def.name : 'UNARMED';
  if(UI.ammoType) UI.ammoType.textContent=def ? def.ammoType.toUpperCase()+' AMMO' : 'NO AMMO';

  const slots=[UI.weaponSlot1,UI.weaponSlot2];
  const bags=[UI.bagWeapon1,UI.bagWeapon2];
  inventory.weapons.forEach((weaponSlot,index)=>{
    const weaponDef=getWeaponDef(weaponSlot);
    const name=weaponDef?.name || 'EMPTY';

    if(slots[index]){
      slots[index].classList.toggle('active',index===activeWeaponSlot);
      slots[index].querySelector('strong').textContent=name;
    }

    if(bags[index]){
      bags[index].classList.toggle('active',index===activeWeaponSlot);
      bags[index].querySelector('strong').textContent=name;
      bags[index].querySelector('small').textContent=weaponDef
        ? weaponSlot.magAmmo+'/'+(multiplayer?'∞':(inventory.ammo[weaponDef.ammoType]||0))+' · '+weaponDef.ammoType
        : '—';
    }
  });

  if(UI.armorValue) UI.armorValue.textContent=inventory.armor+'%';
  if(UI.bandageValue) UI.bandageValue.textContent=inventory.bandage;
  if(UI.backpackCapacity) UI.backpackCapacity.textContent=backpackUsed()+' / '+BACKPACK_MAX;
  if(UI.ammo556Value) UI.ammo556Value.textContent=multiplayer?'∞':(inventory.ammo['5.56']||0);
  if(UI.ammo9Value) UI.ammo9Value.textContent=inventory.ammo['9mm']||0;
}

let messageTimer=0;
function showMessage(text,ms=900) {
  UI.message.textContent=text;
  UI.message.classList.toggle('hidden',!text);
  clearTimeout(messageTimer);
  if(text && ms<100000) messageTimer=setTimeout(()=>UI.message.classList.add('hidden'),ms);
}

function showHitmarker() {
  UI.hitmarker.classList.add('show');
  setTimeout(()=>UI.hitmarker.classList.remove('show'),100);
}

function drawMinimap() {
  const w=UI.minimap.width;
  const h=UI.minimap.height;
  const cx=w/2;
  const cy=h/2;
  const scale=(w*.44)/activeMapHalf;
  mm.clearRect(0,0,w,h);
  mm.fillStyle='rgba(7,12,17,.86)';
  mm.fillRect(0,0,w,h);

  if(!multiplayer){
    const r=currentZoneRadius()*scale;
    mm.strokeStyle='#55d7ff';
    mm.lineWidth=3;
    mm.beginPath();
    mm.arc(cx,cy,r,0,Math.PI*2);
    mm.stroke();
  }

  mm.fillStyle='#ffffff';
  const marker=(brPhase==='plane' && plane) ? plane.position : player.position;
  mm.beginPath();
  mm.arc(cx+marker.x*scale,cy+marker.z*scale,5,0,Math.PI*2);
  mm.fill();

  mm.strokeStyle='#ffffff';
  mm.beginPath();
  mm.moveTo(cx+player.position.x*scale,cy+player.position.z*scale);
  mm.lineTo(cx+(player.position.x+Math.sin(yaw)*8)*scale,cy+(player.position.z+Math.cos(yaw)*8)*scale);
  mm.stroke();

  mm.fillStyle='#ff5b5b';
  if(multiplayer){
    if(remotePlayer?.visible){
      mm.beginPath();
      mm.arc(cx+remotePlayer.position.x*scale,cy+remotePlayer.position.z*scale,3.8,0,Math.PI*2);
      mm.fill();
    }
  }else{
    bots.forEach(b=>{
      if(!b.userData.alive || !b.userData.landed) return;
      mm.beginPath();
      mm.arc(cx+b.position.x*scale,cy+b.position.z*scale,3.4,0,Math.PI*2);
      mm.fill();
    });
  }

  if(!multiplayer){
    mm.fillStyle='#68c7ff';
    cars.forEach(car=>{
      mm.fillRect(
        cx+car.position.x*scale-2.5,
        cy+car.position.z*scale-2.5,
        5,
        5
      );
    });
  }
}

function onResize() {
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(graphicsPixelRatio());
  renderer.setSize(innerWidth,innerHeight);
}

addEventListener('error', event => {
  const message=event?.error?.message || event?.message;
  if (message && typeof showMessage === 'function') {
    showMessage('GAME ERROR · ' + String(message).slice(0,70), 100000);
  }
});

addEventListener('unhandledrejection', event => {
  const message=event?.reason?.message || event?.reason;
  if (message && typeof showMessage === 'function') {
    showMessage('GAME ERROR · ' + String(message).slice(0,70), 100000);
  }
});

function animate() {
  requestAnimationFrame(animate);

  const now=performance.now();
  const fpsLimit=Number(userSettings.graphics?.fpsLimit)||0;
  if(fpsLimit>0){
    const minFrameMs=1000/fpsLimit;
    if(lastRenderFrameAt && now-lastRenderFrameAt<minFrameMs-.35) return;
  }
  lastRenderFrameAt=now;

  const dt=Math.min(clock.getDelta(),.05);

  if(started && !paused && !ended){
    elapsed+=dt;
    spawnProtection=Math.max(0,spawnProtection-dt);

    if(multiplayer){
      brPhase='ground';
      updateOneVOneMatch(dt);
      if(!multiplayerFinished){
        updatePlayer(dt);
        updateRemotePlayer(dt);
        sendMultiplayerState();
      }
    } else {
      if(brPhase==='plane' || brPhase==='falling' || brPhase==='parachute'){
        updateFlight(dt);
      } else if(brPhase==='ground'){
        zoneElapsed+=dt;
        if(activeCar) updateCar(dt);
        else updatePlayer(dt);
        updateZone(dt);
      }

      // Landed bots can fight while other players are still dropping.
      if(brPhase!=='countdown') updateBots(dt);
    }

    updateTracers(dt);
    updateLootAnimations(dt);

    // Plane owns its camera; a driven car uses a chase camera.
    if(activeCar && !multiplayer) updateCarCamera(dt);
    else if(multiplayer || brPhase!=='plane') updateCamera();

    updateHud();
    drawMinimap();
  } else if(!started) {
    updateLobby(dt);
  } else {
    if(activeCar && !multiplayer) updateCarCamera(dt);
    else updateCamera();
    drawMinimap();
  }

  renderer.render(scene,camera);
}
