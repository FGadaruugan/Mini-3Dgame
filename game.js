import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const UI = {
  hp: $('hp'), alive: $('alive'), kills: $('kills'), ammo: $('ammo'), reserve: $('reserve'),
  zoneInfo: $('zoneInfo'), reloadState: $('reloadState'), minimap: $('minimap'), hitmarker: $('hitmarker'),
  message: $('message'), startOverlay: $('startOverlay'), endOverlay: $('endOverlay'), endTitle: $('endTitle'), endText: $('endText'),
  startBtn: $('startBtn'), mobileStartBtn: $('mobileStartBtn'), restartBtn: $('restartBtn'), lobbyBtn: $('lobbyBtn'), fullscreenBtn: $('fullscreenBtn'), pauseBtn: $('pauseBtn'),
  lobbyHint: $('lobbyHint'), lobbyPlayers: $('lobbyPlayers'),
  hud: $('hud'), mobileControls: $('mobileControls'),
  movePad: $('movePad'), moveStick: $('moveStick'), lookPad: $('lookPad'), fireBtn: $('fireBtn'), reloadBtn: $('reloadBtn')
};
const mm = UI.minimap.getContext('2d');

const GAME = {
  mapHalf: 90,
  playerSpeed: 14,
  sprintSpeed: 18,
  botSpeed: 8,
  maxHp: 100,
  magSize: 30,
  reloadMs: 1500,
  fireDelayMs: 120,
  botCount: 5,
  bulletDamage: 28,
  botDamage: 8,
  botFireMinMs: 620,
  botFireMaxMs: 1050,
  zoneStart: 92,
  zoneEnd: 18,
  zoneShrinkSeconds: 150,
  zoneDamagePerSecond: 9,
  spawnProtectionSeconds: 4
};

let scene, camera, renderer, clock, player, ground, zoneRing, lobbyStage, lobbySpot;
let started = false, paused = false, ended = false;
let selectedMode = 'solo';
let yaw = Math.PI, pitch = -0.18, bodyYaw = 0, aiming = false;
let hp = GAME.maxHp, ammo = GAME.magSize, reserve = 120, kills = 0, reloading = false;
let lastShot = 0, elapsed = 0, spawnProtection = 0, lobbyTime = 0, lobbyCharacterYaw = -.28;
let bots = [], colliders = [], tracers = [];
const keys = new Set();
const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3();

const mobile = {
  movePointer: null, lookPointer: null, firePointer: null,
  moveX: 0, moveY: 0, lookLastX: 0, lookLastY: 0, firing: false
};

init();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb6d8);
  scene.fog = new THREE.Fog(0x8fb6d8, 70, 210);

  camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 500);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('game').appendChild(renderer.domElement);

  clock = new THREE.Clock();
  buildWorld();
  createPlayer();
  createLobbyStage();
  bindInputs();
  resetMatch();
  showLobby();
  animate();
}

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
  for (const [x, z, w, d] of [[0,0,16,180],[0,0,180,12]]) {
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
  player = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color:0xc99372, roughness:.72 });
  const suitMat = new THREE.MeshStandardMaterial({ color:0x1e2935, roughness:.58, metalness:.08 });
  const vestMat = new THREE.MeshStandardMaterial({ color:0x35485a, roughness:.5, metalness:.12 });
  const clothMat = new THREE.MeshStandardMaterial({ color:0x304f73, roughness:.72 });
  const darkMat = new THREE.MeshStandardMaterial({ color:0x111820, roughness:.52, metalness:.18 });
  const accentMat = new THREE.MeshStandardMaterial({
    color:0xd5ad35,
    roughness:.34,
    metalness:.58,
    emissive:0x2c2104,
    emissiveIntensity:.16
  });

  const addPart = (geometry, material, x, y, z, rx=0, ry=0, rz=0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x,y,z);
    mesh.rotation.set(rx,ry,rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    player.add(mesh);
    return mesh;
  };

  // Boots + legs
  addPart(new THREE.BoxGeometry(.34,.24,.55), darkMat, -.28,.14,-.08);
  addPart(new THREE.BoxGeometry(.34,.24,.55), darkMat,  .28,.14,-.08);
  addPart(new THREE.CylinderGeometry(.17,.20,1.10,10), suitMat, -.28,.78,0);
  addPart(new THREE.CylinderGeometry(.17,.20,1.10,10), suitMat,  .28,.78,0);
  addPart(new THREE.CylinderGeometry(.205,.18,.16,10), accentMat, -.28,.38,0);
  addPart(new THREE.CylinderGeometry(.205,.18,.16,10), accentMat,  .28,.38,0);

  // Hips, torso, armor
  addPart(new THREE.BoxGeometry(.84,.38,.48), suitMat, 0,1.42,0);
  addPart(new THREE.BoxGeometry(.94,1.12,.52), clothMat, 0,2.12,0);
  addPart(new THREE.BoxGeometry(1.04,.72,.60), vestMat, 0,2.30,-.03);
  addPart(new THREE.BoxGeometry(.72,.13,.64), accentMat, 0,1.68,-.02);
  addPart(new THREE.BoxGeometry(.10,.62,.66), accentMat, -.39,2.30,-.01);
  addPart(new THREE.BoxGeometry(.10,.62,.66), accentMat,  .39,2.30,-.01);

  // Shoulders + arms
  addPart(new THREE.SphereGeometry(.23,10,8), vestMat, -.61,2.54,0);
  addPart(new THREE.SphereGeometry(.23,10,8), vestMat,  .61,2.54,0);
  addPart(new THREE.CylinderGeometry(.13,.15,.82,10), suitMat, -.70,2.12,0,0,0,-.16);
  addPart(new THREE.CylinderGeometry(.13,.15,.82,10), suitMat,  .70,2.12,0,0,0, .16);
  addPart(new THREE.SphereGeometry(.15,10,8), skinMat, -.76,1.68,0);
  addPart(new THREE.SphereGeometry(.15,10,8), skinMat,  .76,1.68,0);

  // Neck + head + hair/helmet shell
  addPart(new THREE.CylinderGeometry(.13,.15,.20,10), skinMat, 0,2.85,0);
  addPart(new THREE.SphereGeometry(.40,16,12), skinMat, 0,3.27,0);
  const hair = addPart(new THREE.SphereGeometry(.425,16,12), darkMat, 0,3.38,.03);
  hair.scale.set(1.03,.62,1.04);
  addPart(new THREE.BoxGeometry(.52,.09,.10), darkMat, 0,3.27,-.39);

  // Backpack and shoulder weapon.
  addPart(new THREE.BoxGeometry(.64,.82,.30), darkMat, 0,2.22,.42);
  const gun = addPart(new THREE.BoxGeometry(.17,.18,1.55), darkMat, .55,2.72,-.20,0,-.18,-.62);
  const barrel = addPart(new THREE.BoxGeometry(.10,.10,.72), accentMat, .88,2.95,-.50,0,-.18,-.62);
  gun.add(barrel);
  addPart(new THREE.BoxGeometry(.22,.35,.17), darkMat, .43,2.53,-.20,0,-.18,-.62);

  // Small chest emblem for a stronger lobby silhouette.
  const emblem = addPart(new THREE.OctahedronGeometry(.13), accentMat, 0,2.42,-.34);
  emblem.rotation.z=Math.PI/4;

  player.userData.gun = gun;
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

function makeBot(index) {
  const root = new THREE.Group();
  const colors = [0x8b3944,0x355b8f,0x7d6b2f,0x5d3f7c,0x2f6f68];
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.75,1.65,4,8), new THREE.MeshStandardMaterial({ color: colors[index % colors.length] }));
  body.position.y = 1.65;
  body.castShadow = true;
  root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.45,12,9), new THREE.MeshStandardMaterial({ color:0xc89470 }));
  head.position.y = 3.08;
  head.castShadow = true;
  root.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(.16,.16,1.25), new THREE.MeshStandardMaterial({ color:0x24272b }));
  gun.position.set(.5,2.15,-.5);
  root.add(gun);
  root.userData = {
    hp: 100, alive: true, gun, nextShot: 700 + Math.random()*800,
    strafe: Math.random() < .5 ? -1 : 1, think: Math.random()*1.2
  };
  scene.add(root);
  return root;
}

function resetMatch() {
  bots.forEach(b => scene.remove(b));
  bots = [];
  tracers.forEach(t => scene.remove(t.mesh));
  tracers = [];
  hp = 100;
  ammo = 30;
  reserve = 120;
  kills = 0;
  reloading = false;
  lastShot = 0;
  elapsed = 0;
  spawnProtection = GAME.spawnProtectionSeconds;
  yaw = Math.PI;
  pitch = -0.18;
  aiming = false;
  ended = false;
  paused = false;
  keys.clear();
  mobile.moveX = mobile.moveY = 0;
  mobile.firing = false;
  centerStick();
  player.visible=true;
  player.position.set(0,0,67);
  bodyYaw = wrapAngle(yaw + Math.PI);
  player.rotation.y = bodyYaw;
  if (lobbyStage) lobbyStage.visible=false;
  if (zoneRing) zoneRing.visible=true;
  const spawns = [[-66,-58],[65,-60],[-63,60],[62,57],[0,-68]];
  for (let i=0;i<GAME.botCount;i++) {
    const bot = makeBot(i);
    bot.position.set(spawns[i][0],0,spawns[i][1]);
    bots.push(bot);
  }
  UI.endOverlay.classList.add('hidden');
  UI.reloadState.textContent = '';
  updateHud();
}

function setGameUiVisible(visible) {
  UI.hud.classList.toggle('hidden',!visible);
  UI.mobileControls.classList.toggle('hidden',!visible);
}

function showLobby() {
  document.exitPointerLock?.();
  document.getElementById('lobbyDrawer')?.classList.remove('open');
  document.getElementById('drawerBackdrop')?.classList.remove('open');
  document.getElementById('drawerToggle')?.classList.remove('open');
  started=false;
  paused=false;
  ended=false;
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
  document.getElementById('lobbyDrawer')?.classList.remove('open');
  document.getElementById('drawerBackdrop')?.classList.remove('open');
  document.getElementById('drawerToggle')?.classList.remove('open');
  if (selectedMode !== 'solo') {
    UI.lobbyHint.textContent='This multiplayer mode is coming soon.';
    return;
  }

  // Fullscreen must be requested from the PLAY user gesture on mobile.
  await enterFullscreen();

  resetMatch();
  started=true;
  paused=false;
  ended=false;
  UI.startOverlay.classList.add('hidden');
  UI.endOverlay.classList.add('hidden');
  setGameUiVisible(true);
  clock.getDelta();

  if (matchMedia('(pointer:fine)').matches) {
    renderer.domElement.requestPointerLock?.();
  }
}

function bindInputs() {
  addEventListener('resize', onResize);
  addEventListener('keydown', e => {
    if (['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)) keys.add(e.code);
    if (e.code === 'KeyR') beginReload();
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('mousemove', e => {
    if (!started || paused || ended || document.pointerLockElement !== renderer.domElement) return;
    // Drag/move right -> look right. Move up -> look up.
    yaw = wrapAngle(yaw - e.movementX * .0023);
    pitch += e.movementY * .0018;
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
        UI.lobbyHint.textContent=mode==='friend'
          ? 'FRIEND mode: multiplayer will be added next.'
          : '1V1 mode: multiplayer will be added next.';
        return;
      }

      selectedMode=mode;
      document.querySelectorAll('.mode-card').forEach(item=>item.classList.remove('active'));
      card.classList.add('active');
      UI.lobbyPlayers.textContent='1 + 5 BOTS';
      UI.lobbyHint.textContent='SOLO mode is ready.';
    });
  });

  document.querySelectorAll('.lobby-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tab=item.dataset.lobbyTab || '';
      document.querySelectorAll('.lobby-nav-item').forEach(x=>x.classList.remove('active'));
      item.classList.add('active');

      const labels={
        theme:'THEME',
        season:'S32 / SEASON',
        workshop:'WORKSHOP',
        cards:'CARDS',
        inventory:'INVENTORY'
      };

      const toast=document.getElementById('lobbyTabToast');
      if (toast) {
        toast.textContent=(labels[tab] || tab.toUpperCase()) + ' · COMING NEXT';
        toast.classList.remove('hidden');
        clearTimeout(toast._hideTimer);
        toast._hideTimer=setTimeout(()=>toast.classList.add('hidden'),900);
      }
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
      const name=item.querySelector('strong')?.textContent || 'MENU';
      const toast=document.getElementById('lobbyTabToast');
      if(toast){
        toast.textContent=name + ' · COMING SOON';
        toast.classList.remove('hidden');
        clearTimeout(toast._hideTimer);
        toast._hideTimer=setTimeout(()=>toast.classList.add('hidden'),900);
      }
    });
  });

  UI.fullscreenBtn?.addEventListener('click', enterFullscreen);
  UI.startBtn.addEventListener('click', startMatch);
  UI.mobileStartBtn?.addEventListener('click', startMatch);
  UI.restartBtn.addEventListener('click', () => {
    resetMatch();
    started=true;
    paused=false;
    ended=false;
    setGameUiVisible(true);
    UI.endOverlay.classList.add('hidden');
    clock.getDelta();
  });
  UI.lobbyBtn.addEventListener('click', showLobby);
  UI.pauseBtn.addEventListener('click', togglePause);
  UI.reloadBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    beginReload();
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
    yaw = wrapAngle(yaw - dx*.006);
    pitch += dy*.0045;
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
  paused = !paused;
  showMessage(paused ? 'PAUSED' : '', paused ? 999999 : 0);
  if (!paused) clock.getDelta();
}

function beginReload() {
  if (!started || paused || ended || reloading || ammo >= GAME.magSize || reserve <= 0) return;
  reloading = true;
  UI.reloadState.textContent = 'Reloading…';
  const startedAt = performance.now();
  const check = () => {
    if (!reloading || ended) return;
    if (performance.now()-startedAt >= GAME.reloadMs) {
      const need = GAME.magSize-ammo;
      const take = Math.min(need,reserve);
      ammo += take;
      reserve -= take;
      reloading=false;
      UI.reloadState.textContent='';
      updateHud();
    } else {
      requestAnimationFrame(check);
    }
  };
  requestAnimationFrame(check);
}

function shoot() {
  if (!started || paused || ended || reloading) return;
  const now=performance.now();
  if (now-lastShot < GAME.fireDelayMs) return;
  lastShot=now;
  if (ammo<=0) {
    beginReload();
    return;
  }
  ammo--;
  updateHud();

  const origin = camera.getWorldPosition(tmpV.clone());
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();
  raycaster.set(origin,dir);
  raycaster.far=140;
  const liveMeshes=[];
  bots.forEach(b=>{
    if(b.userData.alive) b.children.forEach(c=>{
      c.userData.bot=b;
      liveMeshes.push(c);
    });
  });
  const hits=raycaster.intersectObjects(liveMeshes,false);
  let end=origin.clone().addScaledVector(dir,80);
  if(hits.length){
    const hit=hits[0];
    end=hit.point.clone();
    const bot=hit.object.userData.bot;
    const headshot=hit.object===bot.children[1];
    damageBot(bot, headshot ? GAME.bulletDamage*1.65 : GAME.bulletDamage);
    showHitmarker();
  }
  spawnTracer(origin,end,0xffdf76);
}

function damageBot(bot, amount) {
  if(!bot.userData.alive) return;
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
  hp = Math.max(0,hp-amount);
  updateHud();
  if(hp<=0) endMatch(false);
}

function spawnTracer(a,b,color) {
  const geo=new THREE.BufferGeometry().setFromPoints([a,b]);
  const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity:.9});
  const mesh=new THREE.Line(geo,mat);
  scene.add(mesh);
  tracers.push({mesh,life:.08});
}

function updateTracers(dt) {
  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];
    t.life-=dt;
    t.mesh.material.opacity=Math.max(0,t.life/.08);
    if(t.life<=0){
      scene.remove(t.mesh);
      tracers.splice(i,1);
    }
  }
}

function updatePlayer(dt) {
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
  const nx=THREE.MathUtils.clamp(p.x+delta.x,-GAME.mapHalf+2,GAME.mapHalf-2);
  const nz=THREE.MathUtils.clamp(p.z+delta.z,-GAME.mapHalf+2,GAME.mapHalf-2);
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

  // Subtle idle motion instead of a static model.
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
    if(!bot.userData.alive) continue;
    bot.userData.think-=dt;
    const toP=player.position.clone().sub(bot.position);
    const dist=toP.length();
    const flat=toP.clone();
    flat.y=0;
    if(flat.lengthSq()>0.001) flat.normalize();
    bot.rotation.y=Math.atan2(flat.x,flat.z);
    const strafe=new THREE.Vector3(flat.z,0,-flat.x).multiplyScalar(bot.userData.strafe);
    const move=new THREE.Vector3();
    if(dist>24) move.add(flat);
    else if(dist<12) move.addScaledVector(flat,-.65);
    else move.addScaledVector(strafe,.7);
    if(bot.userData.think<=0){
      bot.userData.think=.8+Math.random()*1.4;
      if(Math.random()<.35) bot.userData.strafe*=-1;
    }
    if(move.lengthSq()>0) move.normalize().multiplyScalar(GAME.botSpeed*dt);
    const before=bot.position.clone();
    moveWithCollision(bot,move,.95);
    if(bot.position.distanceToSquared(before)<.002 && move.lengthSq()>0) bot.userData.strafe*=-1;

    bot.userData.nextShot-=dt*1000;
    if(dist<62 && bot.userData.nextShot<=0 && hasSimpleLineOfSight(bot.position,player.position)){
      bot.userData.nextShot=GAME.botFireMinMs+Math.random()*(GAME.botFireMaxMs-GAME.botFireMinMs);
      botShoot(bot,dist);
    }
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
  const t=THREE.MathUtils.clamp(elapsed/GAME.zoneShrinkSeconds,0,1);
  return THREE.MathUtils.lerp(GAME.zoneStart,GAME.zoneEnd,t);
}

function updateZone(dt) {
  const r=currentZoneRadius();
  zoneRing.scale.set(r,1,r);
  UI.zoneInfo.textContent='Zone: ' + Math.round(r) + ' m';
  const pr=Math.hypot(player.position.x,player.position.z);
  if(pr>r) damagePlayer(GAME.zoneDamagePerSecond*dt);
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
  ended=true;
  paused=false;
  reloading=false;
  mobile.firing=false;
  document.exitPointerLock?.();
  UI.endTitle.textContent=win?'WINNER!':'ELIMINATED';
  UI.endText.textContent='Kills: ' + kills + ' · Survived: ' + Math.floor(elapsed) + 's';
  UI.endOverlay.classList.remove('hidden');
}

function updateHud() {
  UI.hp.textContent=Math.ceil(hp);
  UI.ammo.textContent=ammo;
  UI.reserve.textContent=reserve;
  UI.kills.textContent=kills;
  UI.alive.textContent=1+bots.filter(b=>b.userData.alive).length;
  UI.hp.parentElement.style.outline=hp<30?'1px solid rgba(255,80,80,.9)':'';
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
  const scale=(w*.44)/GAME.mapHalf;
  mm.clearRect(0,0,w,h);
  mm.fillStyle='rgba(7,12,17,.86)';
  mm.fillRect(0,0,w,h);

  const r=currentZoneRadius()*scale;
  mm.strokeStyle='#55d7ff';
  mm.lineWidth=3;
  mm.beginPath();
  mm.arc(cx,cy,r,0,Math.PI*2);
  mm.stroke();

  mm.fillStyle='#ffffff';
  mm.beginPath();
  mm.arc(cx+player.position.x*scale,cy+player.position.z*scale,5,0,Math.PI*2);
  mm.fill();

  mm.strokeStyle='#ffffff';
  mm.beginPath();
  mm.moveTo(cx+player.position.x*scale,cy+player.position.z*scale);
  mm.lineTo(cx+(player.position.x+Math.sin(yaw)*8)*scale,cy+(player.position.z+Math.cos(yaw)*8)*scale);
  mm.stroke();

  mm.fillStyle='#ff5b5b';
  bots.forEach(b=>{
    if(!b.userData.alive) return;
    mm.beginPath();
    mm.arc(cx+b.position.x*scale,cy+b.position.z*scale,3.4,0,Math.PI*2);
    mm.fill();
  });
}

function onResize() {
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.033);
  if(started && !paused && !ended){
    elapsed+=dt;
    spawnProtection=Math.max(0,spawnProtection-dt);
    updatePlayer(dt);
    updateBots(dt);
    updateZone(dt);
    updateTracers(dt);
    updateCamera();
    updateHud();
    drawMinimap();
  } else if(!started) {
    updateLobby(dt);
  } else {
    updateCamera();
    drawMinimap();
  }
  renderer.render(scene,camera);
}
