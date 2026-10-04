import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { BASE_SCENE_OBJECTS } from '../scene-data.js';

export const SCENE_DRAFT_KEY='mini3d-studio-scene-v1';

const $=id=>document.getElementById(id);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const rad=value=>THREE.MathUtils.degToRad(Number(value)||0);
const deg=value=>THREE.MathUtils.radToDeg(Number(value)||0);
const round=value=>Math.round((Number(value)||0)*100)/100;
const clone=value=>JSON.parse(JSON.stringify(value));

let renderer=null;
let scene=null;
let camera=null;
let orbit=null;
let transform=null;
let transformHelper=null;
let selectionBox=null;
let resizeObserver=null;
let roots=[];
let sceneData=null;
let selectedId=null;
let canEdit=false;
let initialized=false;
let sceneDirty=false;
let active=false;
let logFn=()=>{};
let stateFn=()=>{};
let searchText='';
let history=[];
let historyIndex=-1;
let transformBefore=null;
let lastValidation=[];
let autosaveTimer=0;

function cloneDefaults(){
  return {
    version:1,
    name:'S1 Green Valley',
    objects:BASE_SCENE_OBJECTS.map(obj=>normalizeObject(clone(obj))).filter(Boolean)
  };
}

function normalizeObject(raw,index=0){
  if(!raw || !['box','tree','carSpawn','lootSpawn'].includes(raw.type)) return null;

  const type=raw.type;
  const position=Array.isArray(raw.position)?raw.position:[0,0,0];
  const rotation=Array.isArray(raw.rotation)?raw.rotation:[0,0,0];
  const scale=Array.isArray(raw.scale)?raw.scale:[1,1,1];
  const size=Array.isArray(raw.size)?raw.size:[6,4,6];
  const color=/^#[0-9a-f]{6}$/i.test(raw.color||'')
    ? raw.color
    : type==='tree'
      ? '#2f633a'
      : type==='carSpawn'
        ? '#68c7ff'
        : type==='lootSpawn'
          ? '#f0c64b'
          : '#8390a0';

  return {
    id:String(raw.id||('object-'+index)).slice(0,80),
    type,
    name:String(raw.name||type.toUpperCase()).slice(0,40),
    position:[
      clamp(position[0],-238,238),
      clamp(position[1],-20,100),
      clamp(position[2],-238,238)
    ],
    rotation:[
      clamp(rotation[0],-Math.PI*4,Math.PI*4),
      clamp(rotation[1],-Math.PI*4,Math.PI*4),
      clamp(rotation[2],-Math.PI*4,Math.PI*4)
    ],
    scale:[
      clamp(scale[0]||1,.1,20),
      clamp(scale[1]||1,.1,20),
      clamp(scale[2]||1,.1,20)
    ],
    ...(type==='box'?{
      size:[
        clamp(size[0]||6,.5,100),
        clamp(size[1]||4,.5,100),
        clamp(size[2]||6,.5,100)
      ]
    }:{}),
    color,
    editorHidden:Boolean(raw.editorHidden),
    editorLocked:Boolean(raw.editorLocked)
  };
}

function loadSceneData(){
  try{
    const raw=JSON.parse(localStorage.getItem(SCENE_DRAFT_KEY)||'null');
    if(raw?.version===1 && Array.isArray(raw.objects)){
      return {
        version:1,
        name:String(raw.name||'S1 Green Valley').slice(0,60),
        objects:raw.objects.slice(0,500).map(normalizeObject).filter(Boolean)
      };
    }
  }catch{}
  return cloneDefaults();
}

function sceneObjectById(id){
  return sceneData?.objects.find(obj=>obj.id===id)||null;
}

function rootById(id){
  return roots.find(root=>root.userData.sceneId===id)||null;
}

function makeBox(data){
  const material=new THREE.MeshStandardMaterial({
    color:data.color,
    roughness:.78,
    metalness:.02
  });
  const mesh=new THREE.Mesh(
    new THREE.BoxGeometry(data.size[0],data.size[1],data.size[2]),
    material
  );
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  return mesh;
}

function makeTree(data){
  const group=new THREE.Group();

  const trunk=new THREE.Mesh(
    new THREE.CylinderGeometry(.65,.85,5,8),
    new THREE.MeshStandardMaterial({color:0x6e4d2f,roughness:.9})
  );
  trunk.position.y=2.5;
  trunk.castShadow=true;
  group.add(trunk);

  const crown=new THREE.Mesh(
    new THREE.ConeGeometry(3.6,8,9),
    new THREE.MeshStandardMaterial({color:data.color,roughness:.88})
  );
  crown.position.y=8;
  crown.castShadow=true;
  crown.userData.colorTarget=true;
  group.add(crown);

  return group;
}

function makeMarker(data){
  const group=new THREE.Group();
  const mat=new THREE.MeshBasicMaterial({
    color:data.color,
    transparent:true,
    opacity:.9,
    depthTest:false
  });

  if(data.type==='carSpawn'){
    const base=new THREE.Mesh(new THREE.BoxGeometry(2.4,.65,4.2),mat);
    base.position.y=.45;
    base.userData.colorTarget=true;
    group.add(base);

    const arrow=new THREE.Mesh(
      new THREE.ConeGeometry(.55,1.5,8),
      new THREE.MeshBasicMaterial({color:data.color,depthTest:false})
    );
    arrow.rotation.x=Math.PI/2;
    arrow.position.set(0,1.25,2.6);
    arrow.userData.colorTarget=true;
    group.add(arrow);
  }else{
    const ring=new THREE.Mesh(
      new THREE.TorusGeometry(2.2,.16,8,28),
      mat
    );
    ring.rotation.x=Math.PI/2;
    ring.position.y=.18;
    ring.userData.colorTarget=true;
    group.add(ring);

    const beacon=new THREE.Mesh(
      new THREE.CylinderGeometry(.18,.18,3.4,8),
      new THREE.MeshBasicMaterial({color:data.color,transparent:true,opacity:.75,depthTest:false})
    );
    beacon.position.y=1.7;
    beacon.userData.colorTarget=true;
    group.add(beacon);
  }

  return group;
}

function applyTransform(root,data){
  root.position.fromArray(data.position);
  root.rotation.set(...data.rotation);
  root.scale.fromArray(data.scale);
  root.visible=!data.editorHidden;
  root.userData.editorLocked=Boolean(data.editorLocked);
}

function createRoot(data){
  const root=data.type==='tree'
    ? makeTree(data)
    : (data.type==='carSpawn' || data.type==='lootSpawn')
      ? makeMarker(data)
      : makeBox(data);
  root.userData.sceneId=data.id;
  root.userData.sceneType=data.type;
  root.name=data.name;
  applyTransform(root,data);
  scene.add(root);
  roots.push(root);
  return root;
}

function disposeRoot(root){
  root.traverse(child=>{
    if(child.geometry) child.geometry.dispose?.();
    if(child.material){
      const materials=Array.isArray(child.material)?child.material:[child.material];
      materials.forEach(mat=>mat.dispose?.());
    }
  });
  scene.remove(root);
}

function rebuildScene({keepSelection=false}={}){
  const previous=keepSelection?selectedId:null;
  transform?.detach();

  if(selectionBox){
    scene.remove(selectionBox);
    selectionBox.geometry?.dispose?.();
    selectionBox.material?.dispose?.();
    selectionBox=null;
  }

  roots.forEach(disposeRoot);
  roots=[];

  for(const data of sceneData.objects) createRoot(data);

  selectedId=previous && sceneObjectById(previous)?previous:null;
  renderObjectList();
  renderProperties();
  if(selectedId) selectObject(selectedId,false);
  validateScene();
  notifyState();
}

function buildBaseWorld(){
  scene.background=new THREE.Color(0x8fb1c9);
  scene.fog=new THREE.Fog(0x8fb1c9,170,620);
  scene.add(new THREE.HemisphereLight(0xdcecff,0x40552d,2.3));

  const sun=new THREE.DirectionalLight(0xffffff,2.35);
  sun.position.set(55,80,35);
  scene.add(sun);

  const ground=new THREE.Mesh(
    new THREE.PlaneGeometry(480,480),
    new THREE.MeshStandardMaterial({color:0x5f8a45,roughness:1})
  );
  ground.rotation.x=-Math.PI/2;
  ground.receiveShadow=true;
  ground.userData.editorGround=true;
  scene.add(ground);

  const roadMat=new THREE.MeshStandardMaterial({color:0x4d5157,roughness:1});
  for(const [x,z,w,d] of [[0,0,16,480],[0,0,480,12],[-125,55,10,220],[125,-60,10,230]]){
    const road=new THREE.Mesh(new THREE.BoxGeometry(w,.08,d),roadMat);
    road.position.set(x,.04,z);
    road.receiveShadow=true;
    road.userData.editorGround=true;
    scene.add(road);
  }

  const grid=new THREE.GridHelper(480,96,0x5e7183,0x41515f);
  grid.position.y=.09;
  const mats=Array.isArray(grid.material)?grid.material:[grid.material];
  mats.forEach(mat=>{mat.transparent=true;mat.opacity=.34;});
  grid.userData.editorGround=true;
  scene.add(grid);
}

function filteredObjects(){
  if(!searchText) return sceneData.objects;
  const q=searchText.toLowerCase();
  return sceneData.objects.filter(obj=>
    obj.name.toLowerCase().includes(q) ||
    obj.type.toLowerCase().includes(q) ||
    obj.id.toLowerCase().includes(q)
  );
}

function renderObjectList(){
  const list=$('sceneObjectList');
  if(!list) return;
  list.innerHTML='';

  for(const obj of filteredObjects()){
    const row=document.createElement('div');
    row.className='scene-object-row'+(obj.id===selectedId?' active':'');
    row.dataset.sceneId=obj.id;

    const select=document.createElement('button');
    select.className='scene-object';
    select.innerHTML=
      '<span>'+({tree:'▲',box:'■',carSpawn:'C',lootSpawn:'✦'}[obj.type]||'•')+'</span>'+
      '<strong>'+escapeHtml(obj.name)+'</strong>'+
      '<small>'+obj.type+'</small>';
    select.addEventListener('click',()=>selectObject(obj.id,true));

    const hide=document.createElement('button');
    hide.className='scene-mini-btn'+(obj.editorHidden?' active':'');
    hide.title=obj.editorHidden?'Show':'Hide';
    hide.textContent=obj.editorHidden?'○':'●';
    hide.disabled=!canEdit;
    hide.addEventListener('click',event=>{
      event.stopPropagation();
      toggleHidden(obj.id);
    });

    const lock=document.createElement('button');
    lock.className='scene-mini-btn'+(obj.editorLocked?' active':'');
    lock.title=obj.editorLocked?'Unlock':'Lock';
    lock.textContent=obj.editorLocked?'L':'U';
    lock.disabled=!canEdit;
    lock.addEventListener('click',event=>{
      event.stopPropagation();
      toggleLocked(obj.id);
    });

    row.append(select,hide,lock);
    list.appendChild(row);
  }

  if($('sceneObjectCount')){
    const total=sceneData.objects.length;
    const visible=filteredObjects().length;
    $('sceneObjectCount').textContent=searchText?(visible+'/'+total):String(total);
  }
}

function escapeHtml(value){
  return String(value??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function setSelectionBox(root){
  if(selectionBox){
    scene.remove(selectionBox);
    selectionBox.geometry?.dispose?.();
    selectionBox.material?.dispose?.();
  }
  selectionBox=null;

  if(!root || !root.visible) return;
  selectionBox=new THREE.BoxHelper(root,0xf0c64b);
  selectionBox.material.depthTest=false;
  selectionBox.material.transparent=true;
  selectionBox.material.opacity=.9;
  scene.add(selectionBox);
}

function selectObject(id,focus=false){
  const root=rootById(id);
  const data=sceneObjectById(id);

  if(!root || !data){
    selectedId=null;
    transform?.detach();
    setSelectionBox(null);
    renderObjectList();
    renderProperties();
    return;
  }

  selectedId=id;
  if(canEdit && !data.editorLocked && !data.editorHidden) transform?.attach(root);
  else transform?.detach();

  setSelectionBox(root);
  renderObjectList();
  renderProperties();
  if(focus && root.visible) focusSelected();
}

function renderProperties(){
  const data=sceneObjectById(selectedId);
  const has=Boolean(data);
  $('noSceneSelection')?.classList.toggle('hidden',has);
  $('sceneProperties')?.classList.toggle('hidden',!has);

  if(!has){
    if($('selectedType')) $('selectedType').textContent='NONE';
    return;
  }

  $('selectedType').textContent=data.type.toUpperCase()+
    (data.editorLocked?' · LOCKED':'')+
    (data.editorHidden?' · HIDDEN':'');

  $('propName').value=data.name;
  $('propPosX').value=round(data.position[0]);
  $('propPosY').value=round(data.position[1]);
  $('propPosZ').value=round(data.position[2]);
  $('propRotX').value=round(deg(data.rotation[0]));
  $('propRotY').value=round(deg(data.rotation[1]));
  $('propRotZ').value=round(deg(data.rotation[2]));
  $('propScaleX').value=round(data.scale[0]);
  $('propScaleY').value=round(data.scale[1]);
  $('propScaleZ').value=round(data.scale[2]);

  $('boxSizeGroup').classList.toggle('hidden',data.type!=='box');
  if(data.type==='box'){
    $('propSizeX').value=round(data.size[0]);
    $('propSizeY').value=round(data.size[1]);
    $('propSizeZ').value=round(data.size[2]);
  }

  $('propColor').value=data.color;
  $('propColorText').value=data.color;
  updateEditAvailability();
}

function syncDataFromRoot({historyCommit=false}={}){
  const data=sceneObjectById(selectedId);
  const root=rootById(selectedId);
  if(!data || !root) return;

  data.position=[round(root.position.x),round(root.position.y),round(root.position.z)];
  data.rotation=[root.rotation.x,root.rotation.y,root.rotation.z];
  data.scale=[round(root.scale.x),round(root.scale.y),round(root.scale.z)];

  selectionBox?.update();
  markDirty();
  renderProperties();
  if(historyCommit) pushHistory();
}

function markDirty(){
  sceneDirty=true;
  validateScene();
  clearTimeout(autosaveTimer);
  autosaveTimer=setTimeout(()=>{
    if(!sceneData || !canEdit) return;
    localStorage.setItem(SCENE_DRAFT_KEY,JSON.stringify({
      version:1,
      name:sceneData.name||'S1 Green Valley',
      updatedAt:new Date().toISOString(),
      objects:sceneData.objects.map(obj=>clone(obj))
    }));
  },700);
  notifyState();
}

function notifyState(){
  stateFn?.({
    dirty:sceneDirty,
    count:sceneData?.objects.length||0,
    saved:Boolean(localStorage.getItem(SCENE_DRAFT_KEY)),
    canUndo:historyIndex>0,
    canRedo:historyIndex>=0 && historyIndex<history.length-1,
    warnings:lastValidation.length
  });
}

function snapshot(){
  return JSON.stringify(sceneData);
}

function pushHistory(){
  if(!sceneData) return;
  const snap=snapshot();
  if(history[historyIndex]===snap) return;
  history=history.slice(0,historyIndex+1);
  history.push(snap);
  if(history.length>60) history.shift();
  historyIndex=history.length-1;
  notifyState();
}

function restoreHistory(index){
  if(index<0 || index>=history.length) return false;
  try{
    sceneData=JSON.parse(history[index]);
    historyIndex=index;
    sceneDirty=true;
    rebuildScene();
    return true;
  }catch{
    return false;
  }
}

export function undoScene(){
  if(!canEdit || historyIndex<=0) return false;
  const ok=restoreHistory(historyIndex-1);
  if(ok) logFn('Scene undo','ok');
  return ok;
}

export function redoScene(){
  if(!canEdit || historyIndex>=history.length-1) return false;
  const ok=restoreHistory(historyIndex+1);
  if(ok) logFn('Scene redo','ok');
  return ok;
}

function updateEditAvailability(){
  const data=sceneObjectById(selectedId);
  const editable=canEdit && !data?.editorLocked;

  const ids=[
    'addBoxBtn','addTreeBtn','addCarSpawnBtn','addLootSpawnBtn','sceneMoveMode','sceneRotateMode','sceneScaleMode',
    'sceneDuplicateBtn','sceneDeleteBtn','propName',
    'propPosX','propPosY','propPosZ','propRotX','propRotY','propRotZ',
    'propScaleX','propScaleY','propScaleZ','propSizeX','propSizeY','propSizeZ',
    'propColor','propColorText','propDuplicateBtn','propDeleteBtn','resetSceneBtn'
  ];

  ids.forEach(id=>{
    const el=$(id);
    if(!el) return;
    if(['addBoxBtn','addTreeBtn','addCarSpawnBtn','addLootSpawnBtn','resetSceneBtn'].includes(id)) el.disabled=!canEdit;
    else el.disabled=!editable;
  });

  if(transform){
    transform.enabled=editable && !data?.editorHidden;
    if(!transform.enabled) transform.detach();
  }
}

function setTransformMode(mode){
  const data=sceneObjectById(selectedId);
  if(!transform || !canEdit || data?.editorLocked || data?.editorHidden) return;

  const root=rootById(selectedId);
  if(root && transform.object!==root) transform.attach(root);
  transform.setMode(mode);

  ['sceneMoveMode','sceneRotateMode','sceneScaleMode'].forEach(id=>$(id)?.classList.remove('active'));
  const map={translate:'sceneMoveMode',rotate:'sceneRotateMode',scale:'sceneScaleMode'};
  $(map[mode])?.classList.add('active');
  $('sceneSelectMode')?.classList.remove('active');
}

function uniqueId(prefix){
  return (prefix+'-'+(crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(16).slice(2)))
    .replaceAll('.','-');
}

function addObject(type){
  if(!canEdit) return;
  const id=uniqueId(type);
  const target=orbit?.target||new THREE.Vector3();

  let template;
  if(type==='tree'){
    template={
      id,type:'tree',name:'New Tree',
      position:[round(target.x+4),0,round(target.z+4)],
      rotation:[0,0,0],scale:[1,1,1],color:'#2f633a'
    };
  }else if(type==='carSpawn'){
    template={
      id,type:'carSpawn',name:'New Car Spawn',
      position:[round(target.x+4),0,round(target.z+4)],
      rotation:[0,0,0],scale:[1,1,1],color:'#68c7ff'
    };
  }else if(type==='lootSpawn'){
    template={
      id,type:'lootSpawn',name:'New Loot Area',
      position:[round(target.x+4),0,round(target.z+4)],
      rotation:[0,0,0],scale:[1,1,1],color:'#f0c64b'
    };
  }else{
    template={
      id,type:'box',name:'New Box',
      position:[round(target.x+4),2.5,round(target.z+4)],
      rotation:[0,0,0],scale:[1,1,1],size:[5,5,5],color:'#8390a0'
    };
  }

  const obj=normalizeObject(template);

  sceneData.objects.push(obj);
  createRoot(obj);
  markDirty();
  pushHistory();
  renderObjectList();
  selectObject(obj.id,true);
  logFn('Scene: added '+obj.name,'ok');
}

function deleteSelected(){
  if(!canEdit || !selectedId) return;
  const data=sceneObjectById(selectedId);
  if(data?.editorLocked){
    logFn('Unlock the object before deleting it','error');
    return;
  }

  const root=rootById(selectedId);
  transform?.detach();
  if(root){
    disposeRoot(root);
    roots=roots.filter(x=>x!==root);
  }

  sceneData.objects=sceneData.objects.filter(obj=>obj.id!==selectedId);
  selectedId=null;
  setSelectionBox(null);
  markDirty();
  pushHistory();
  renderObjectList();
  renderProperties();
  logFn('Scene: deleted '+(data?.name||'object'),'ok');
}

function duplicateSelected(){
  if(!canEdit || !selectedId) return;
  const source=sceneObjectById(selectedId);
  if(!source || source.editorLocked) return;

  const copy=clone(source);
  copy.id=uniqueId(source.type);
  copy.name=(source.name+' Copy').slice(0,40);
  copy.position[0]=round(copy.position[0]+3);
  copy.position[2]=round(copy.position[2]+3);
  copy.editorLocked=false;
  copy.editorHidden=false;

  sceneData.objects.push(copy);
  createRoot(copy);
  markDirty();
  pushHistory();
  renderObjectList();
  selectObject(copy.id,true);
  logFn('Scene: duplicated '+source.name,'ok');
}

function rebuildSelectedGeometry(){
  const data=sceneObjectById(selectedId);
  const old=rootById(selectedId);
  if(!data || !old) return;

  const wasSelected=selectedId;
  transform?.detach();
  disposeRoot(old);
  roots=roots.filter(x=>x!==old);
  createRoot(data);
  selectObject(wasSelected,false);
}

function setSelectedColor(color){
  const data=sceneObjectById(selectedId);
  const root=rootById(selectedId);
  if(!canEdit || !data || !root || data.editorLocked || !/^#[0-9a-f]{6}$/i.test(color)) return;

  data.color=color.toLowerCase();
  root.traverse(child=>{
    if(!child.material) return;
    if(data.type==='box' || child.userData.colorTarget){
      const mats=Array.isArray(child.material)?child.material:[child.material];
      mats.forEach(mat=>mat.color?.set(data.color));
    }
  });

  markDirty();
  $('propColor').value=data.color;
  $('propColorText').value=data.color;
}

function applyPropertyInputs(){
  if(!canEdit) return;
  const data=sceneObjectById(selectedId);
  const root=rootById(selectedId);
  if(!data || !root || data.editorLocked) return;

  data.name=String($('propName').value||data.name).slice(0,40);
  root.name=data.name;

  root.position.set(
    clamp($('propPosX').value,-238,238),
    clamp($('propPosY').value,-20,100),
    clamp($('propPosZ').value,-238,238)
  );
  root.rotation.set(
    rad(clamp($('propRotX').value,-720,720)),
    rad(clamp($('propRotY').value,-720,720)),
    rad(clamp($('propRotZ').value,-720,720))
  );
  root.scale.set(
    clamp($('propScaleX').value,.1,20),
    clamp($('propScaleY').value,.1,20),
    clamp($('propScaleZ').value,.1,20)
  );

  let geometryChanged=false;
  if(data.type==='box'){
    const newSize=[
      clamp($('propSizeX').value,.5,100),
      clamp($('propSizeY').value,.5,100),
      clamp($('propSizeZ').value,.5,100)
    ];
    geometryChanged=newSize.some((value,index)=>Math.abs(value-data.size[index])>.0001);
    data.size=newSize;
  }

  syncDataFromRoot();
  if(geometryChanged) rebuildSelectedGeometry();
  markDirty();
  pushHistory();
  renderObjectList();
}

function focusSelected(){
  const root=rootById(selectedId);
  if(!root || !root.visible || !camera || !orbit) return;

  const box=new THREE.Box3().setFromObject(root);
  const sphere=box.getBoundingSphere(new THREE.Sphere());
  const radius=Math.max(3,sphere.radius);
  const dir=new THREE.Vector3(1,.7,1).normalize();

  orbit.target.copy(sphere.center);
  camera.position.copy(sphere.center).addScaledVector(dir,radius*3.2);
  orbit.update();
}

function pointerSelect(event){
  if(!active || !renderer || !camera || transform?.dragging || transform?.axis) return;
  if(event.button!==undefined && event.button!==0) return;

  const rect=renderer.domElement.getBoundingClientRect();
  if(!rect.width || !rect.height) return;

  const pointer=new THREE.Vector2(
    ((event.clientX-rect.left)/rect.width)*2-1,
    -((event.clientY-rect.top)/rect.height)*2+1
  );

  const ray=new THREE.Raycaster();
  ray.setFromCamera(pointer,camera);

  const hits=ray.intersectObjects(roots.filter(root=>root.visible),true);
  if(!hits.length){
    selectObject(null,false);
    return;
  }

  let root=hits[0].object;
  while(root && !root.userData.sceneId) root=root.parent;
  if(root?.userData.sceneId) selectObject(root.userData.sceneId,false);
}

function toggleHidden(id){
  if(!canEdit) return;
  const data=sceneObjectById(id);
  const root=rootById(id);
  if(!data || !root) return;

  data.editorHidden=!data.editorHidden;
  root.visible=!data.editorHidden;
  if(selectedId===id){
    transform?.detach();
    setSelectionBox(root.visible?root:null);
  }
  markDirty();
  pushHistory();
  renderObjectList();
  renderProperties();
}

function toggleLocked(id){
  if(!canEdit) return;
  const data=sceneObjectById(id);
  if(!data) return;

  data.editorLocked=!data.editorLocked;
  rootById(id).userData.editorLocked=data.editorLocked;
  if(selectedId===id) selectObject(id,false);
  markDirty();
  pushHistory();
  renderObjectList();
}

function setSnap(){
  if(!transform) return;
  const translate=Number($('sceneTranslateSnap')?.value||.5);
  const rotate=Number($('sceneRotateSnap')?.value||5);
  const scale=Number($('sceneScaleSnap')?.value||.1);
  transform.setTranslationSnap(translate>0?translate:null);
  transform.setRotationSnap(rotate>0?THREE.MathUtils.degToRad(rotate):null);
  transform.setScaleSnap(scale>0?scale:null);
}

function validateScene(){
  const warnings=[];
  const ids=new Set();

  for(const obj of sceneData?.objects||[]){
    if(ids.has(obj.id)) warnings.push('Duplicate object ID: '+obj.id);
    ids.add(obj.id);

    if(Math.abs(obj.position[0])>238 || Math.abs(obj.position[2])>238){
      warnings.push(obj.name+' is outside the map');
    }
    if(obj.scale.some(value=>value<=0)){
      warnings.push(obj.name+' has invalid scale');
    }
  }

  // Fast coarse overlap check for box centers. It catches obvious accidental duplicates.
  const boxes=(sceneData?.objects||[]).filter(obj=>obj.type==='box');
  for(let i=0;i<boxes.length;i++){
    for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];
      if(
        Math.abs(a.position[0]-b.position[0])<.05 &&
        Math.abs(a.position[1]-b.position[1])<.05 &&
        Math.abs(a.position[2]-b.position[2])<.05
      ){
        warnings.push(a.name+' overlaps '+b.name);
      }
    }
  }

  lastValidation=warnings.slice(0,25);
  const host=$('sceneValidation');
  if(host){
    host.innerHTML=lastValidation.length
      ? lastValidation.map(msg=>'<div class="validation-warning">⚠ '+escapeHtml(msg)+'</div>').join('')
      : '<div class="validation-ok">✓ No obvious scene problems</div>';
  }
  return lastValidation;
}

function bindPropertyEvents(){
  const propertyIds=[
    'propName','propPosX','propPosY','propPosZ',
    'propRotX','propRotY','propRotZ',
    'propScaleX','propScaleY','propScaleZ',
    'propSizeX','propSizeY','propSizeZ'
  ];
  propertyIds.forEach(id=>$(id)?.addEventListener('change',applyPropertyInputs));

  $('propColor')?.addEventListener('change',event=>{
    setSelectedColor(event.target.value);
    pushHistory();
  });
  $('propColorText')?.addEventListener('change',event=>{
    const value=String(event.target.value||'').trim();
    if(/^#[0-9a-f]{6}$/i.test(value)){
      setSelectedColor(value);
      pushHistory();
    }else{
      renderProperties();
    }
  });

  $('addBoxBtn')?.addEventListener('click',()=>addObject('box'));
  $('addTreeBtn')?.addEventListener('click',()=>addObject('tree'));
  $('addCarSpawnBtn')?.addEventListener('click',()=>addObject('carSpawn'));
  $('addLootSpawnBtn')?.addEventListener('click',()=>addObject('lootSpawn'));
  $('sceneMoveMode')?.addEventListener('click',()=>setTransformMode('translate'));
  $('sceneRotateMode')?.addEventListener('click',()=>setTransformMode('rotate'));
  $('sceneScaleMode')?.addEventListener('click',()=>setTransformMode('scale'));

  $('sceneSelectMode')?.addEventListener('click',()=>{
    if(!transform) return;
    transform.detach();
    $('sceneSelectMode')?.classList.add('active');
    ['sceneMoveMode','sceneRotateMode','sceneScaleMode'].forEach(id=>$(id)?.classList.remove('active'));
  });

  $('sceneFocusBtn')?.addEventListener('click',focusSelected);
  $('sceneDuplicateBtn')?.addEventListener('click',duplicateSelected);
  $('sceneDeleteBtn')?.addEventListener('click',deleteSelected);
  $('propDuplicateBtn')?.addEventListener('click',duplicateSelected);
  $('propDeleteBtn')?.addEventListener('click',deleteSelected);

  $('sceneSearch')?.addEventListener('input',event=>{
    searchText=String(event.target.value||'').trim();
    renderObjectList();
  });

  ['sceneTranslateSnap','sceneRotateSnap','sceneScaleSnap'].forEach(id=>$(id)?.addEventListener('change',setSnap));

  $('resetSceneBtn')?.addEventListener('click',()=>{
    if(!canEdit) return;
    if(!confirm('Reset Scene Draft to the original S1 map?')) return;
    localStorage.removeItem(SCENE_DRAFT_KEY);
    sceneData=cloneDefaults();
    sceneDirty=true;
    history=[];
    historyIndex=-1;
    pushHistory();
    rebuildScene();
    logFn('Scene reset to original S1 map','ok');
  });
}

function resize(){
  if(!renderer || !camera || !$('sceneViewport')) return;
  const host=$('sceneViewport');
  const width=Math.max(1,host.clientWidth);
  const height=Math.max(1,host.clientHeight);
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
}

function animate(){
  if(!initialized) return;
  requestAnimationFrame(animate);
  if(!active) return;

  selectionBox?.update();
  orbit?.update();
  renderer.render(scene,camera);
}

function cleanForExport(obj){
  const copy=clone(obj);
  delete copy.editorHidden;
  delete copy.editorLocked;
  return copy;
}

function jsValue(value,indent=0){
  if(Array.isArray(value)){
    if(value.length<=4 && value.every(v=>typeof v!=='object')) return '['+value.map(v=>jsValue(v)).join(',')+']';
    const inner=' '.repeat(indent+2);
    const pad=' '.repeat(indent);
    return '[\n'+value.map(v=>inner+jsValue(v,indent+2)).join(',\n')+'\n'+pad+']';
  }
  if(value && typeof value==='object'){
    const inner=' '.repeat(indent+2);
    const pad=' '.repeat(indent);
    return '{\n'+Object.entries(value).map(([k,v])=>
      inner+( /^[A-Za-z_$][\w$]*$/.test(k)?k:JSON.stringify(k) )+':'+jsValue(v,indent+2)
    ).join(',\n')+'\n'+pad+'}';
  }
  if(typeof value==='string') return JSON.stringify(value);
  return String(value);
}

export function getGeneratedSceneModule(){
  const objects=(sceneData?.objects||[]).map(cleanForExport);
  return 'export const BASE_SCENE_OBJECTS = '+jsValue(objects)+';\n';
}

export function getSceneData(){
  return clone(sceneData);
}

export function validateCurrentScene(){
  return [...validateScene()];
}

export function initSceneEditor({role='tester',log=()=>{},onStateChange=()=>{}}={}){
  if(initialized){
    setSceneEditorRole(role);
    logFn=log;
    stateFn=onStateChange;
    return;
  }

  logFn=log;
  stateFn=onStateChange;
  sceneData=loadSceneData();

  const host=$('sceneViewport');
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(60,1,.1,1200);
  camera.position.set(115,95,115);

  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.shadowMap.enabled=false;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  orbit=new OrbitControls(camera,renderer.domElement);
  orbit.enableDamping=true;
  orbit.dampingFactor=.08;
  orbit.maxDistance=650;
  orbit.minDistance=4;
  orbit.maxPolarAngle=Math.PI*.49;
  orbit.target.set(0,0,0);

  transform=new TransformControls(camera,renderer.domElement);
  transform.setMode('translate');
  transform.setTranslationSnap(.5);
  transform.setRotationSnap(THREE.MathUtils.degToRad(5));
  transform.setScaleSnap(.1);
  transformHelper=transform.getHelper?transform.getHelper():transform;
  scene.add(transformHelper);

  transform.addEventListener('dragging-changed',event=>{
    orbit.enabled=!event.value;
    if(event.value) transformBefore=snapshot();
  });
  transform.addEventListener('objectChange',()=>syncDataFromRoot());
  transform.addEventListener('mouseUp',()=>{
    syncDataFromRoot();
    if(transformBefore!==snapshot()) pushHistory();
    transformBefore=null;
  });

  buildBaseWorld();
  for(const data of sceneData.objects) createRoot(data);

  renderer.domElement.addEventListener('pointerdown',pointerSelect);
  bindPropertyEvents();

  resizeObserver=new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  initialized=true;
  history=[];
  historyIndex=-1;
  pushHistory();
  renderObjectList();
  renderProperties();
  setSceneEditorRole(role);
  validateScene();
  notifyState();
  animate();
}

export function setSceneEditorRole(role){
  canEdit=['owner','developer','builder'].includes(role);
  renderObjectList();
  updateEditAvailability();
}

export function setSceneEditorActive(value){
  active=Boolean(value);
  if(active){
    resize();
    requestAnimationFrame(resize);
  }
}

export function saveSceneDraft(){
  if(!sceneData || !canEdit) return false;
  const payload={
    version:1,
    name:sceneData.name||'S1 Green Valley',
    updatedAt:new Date().toISOString(),
    objects:sceneData.objects.map(obj=>clone(obj))
  };
  localStorage.setItem(SCENE_DRAFT_KEY,JSON.stringify(payload));
  sceneDirty=false;
  notifyState();
  logFn('Scene draft saved · '+payload.objects.length+' objects','ok');
  return true;
}

export function reloadSceneDraft(){
  if(!initialized) return;
  sceneData=loadSceneData();
  sceneDirty=false;
  history=[];
  historyIndex=-1;
  pushHistory();
  rebuildScene();
  logFn('Scene reloaded','ok');
}

export function getSceneStatus(){
  return {
    dirty:sceneDirty,
    count:sceneData?.objects.length||0,
    saved:Boolean(localStorage.getItem(SCENE_DRAFT_KEY)),
    canUndo:historyIndex>0,
    canRedo:historyIndex>=0 && historyIndex<history.length-1,
    warnings:lastValidation.length
  };
}
