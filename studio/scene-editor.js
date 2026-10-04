import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export const SCENE_DRAFT_KEY='mini3d-studio-scene-v1';

const $=id=>document.getElementById(id);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const rad=value=>THREE.MathUtils.degToRad(Number(value)||0);
const deg=value=>THREE.MathUtils.radToDeg(Number(value)||0);
const round=value=>Math.round((Number(value)||0)*100)/100;

const DEFAULT_OBJECTS=[
  {id:'house-01',type:'box',name:'House 01',position:[-35,5,-28],rotation:[0,0,0],scale:[1,1,1],size:[18,10,22],color:'#a76d42'},
  {id:'house-02',type:'box',name:'House 02',position:[34,4,-34],rotation:[0,0,0],scale:[1,1,1],size:[24,8,18],color:'#8390a0'},
  {id:'house-03',type:'box',name:'House 03',position:[-42,6,32],rotation:[0,0,0],scale:[1,1,1],size:[22,12,20],color:'#b48a62'},
  {id:'house-04',type:'box',name:'House 04',position:[37,4.5,33],rotation:[0,0,0],scale:[1,1,1],size:[16,9,26],color:'#787f8e'},
  {id:'house-05',type:'box',name:'House 05',position:[5,3.5,47],rotation:[0,0,0],scale:[1,1,1],size:[18,7,12],color:'#8a755c'},
  {id:'house-06',type:'box',name:'House 06',position:[-6,4.5,-54],rotation:[0,0,0],scale:[1,1,1],size:[20,9,14],color:'#6f7f91'},
  {id:'house-07',type:'box',name:'Outer House 01',position:[-155,5,-132],rotation:[0,0,0],scale:[1,1,1],size:[28,10,34],color:'#8f6747'},
  {id:'house-08',type:'box',name:'Outer House 02',position:[-118,4,-158],rotation:[0,0,0],scale:[1,1,1],size:[22,8,24],color:'#75879a'},
  {id:'house-09',type:'box',name:'Outer House 03',position:[150,6,130],rotation:[0,0,0],scale:[1,1,1],size:[34,12,28],color:'#8d7a65'},
  {id:'house-10',type:'box',name:'Outer House 04',position:[120,4.5,160],rotation:[0,0,0],scale:[1,1,1],size:[20,9,32],color:'#6f8092'},
  {id:'house-11',type:'box',name:'Outer House 05',position:[-158,5.5,122],rotation:[0,0,0],scale:[1,1,1],size:[30,11,22],color:'#a17a55'},
  {id:'house-12',type:'box',name:'Outer House 06',position:[158,4.5,-138],rotation:[0,0,0],scale:[1,1,1],size:[24,9,30],color:'#7a8490'},
  {id:'house-13',type:'box',name:'Outer House 07',position:[-88,4,145],rotation:[0,0,0],scale:[1,1,1],size:[18,8,20],color:'#8d7359'},
  {id:'house-14',type:'box',name:'Outer House 08',position:[92,4,-150],rotation:[0,0,0],scale:[1,1,1],size:[20,8,18],color:'#72879a'},

  {id:'wall-01',type:'box',name:'Wall 01',position:[-18,1.5,-8],rotation:[0,0,0],scale:[1,1,1],size:[18,3,2],color:'#8c8b86'},
  {id:'wall-02',type:'box',name:'Wall 02',position:[21,1.5,13],rotation:[0,0,0],scale:[1,1,1],size:[20,3,2],color:'#8c8b86'},
  {id:'wall-03',type:'box',name:'Wall 03',position:[-7,1.5,23],rotation:[0,0,0],scale:[1,1,1],size:[2,3,18],color:'#8c8b86'},
  {id:'wall-04',type:'box',name:'Wall 04',position:[53,1.5,-2],rotation:[0,0,0],scale:[1,1,1],size:[2,3,22],color:'#8c8b86'},
  {id:'wall-05',type:'box',name:'Wall 05',position:[-56,1.5,-1],rotation:[0,0,0],scale:[1,1,1],size:[2,3,22],color:'#8c8b86'},

  ...[
    [-70,-63],[-64,55],[-52,63],[-28,61],[-18,-69],[15,-67],[31,63],[59,57],
    [68,20],[65,-54],[49,-66],[-69,18],[-25,12],[25,-13],[51,14],[-48,-12]
  ].map(([x,z],index)=>({
    id:'tree-'+String(index+1).padStart(2,'0'),
    type:'tree',
    name:'Tree '+String(index+1).padStart(2,'0'),
    position:[x,0,z],
    rotation:[0,0,0],
    scale:[1,1,1],
    color:'#2f633a'
  }))
];

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

function cloneDefaults(){
  return {
    version:1,
    name:'S1 Green Valley',
    objects:DEFAULT_OBJECTS.map(obj=>structuredClone(obj))
  };
}

function normalizeObject(raw,index=0){
  if(!raw || !['box','tree'].includes(raw.type)) return null;

  const type=raw.type;
  const position=Array.isArray(raw.position)?raw.position:[0,0,0];
  const rotation=Array.isArray(raw.rotation)?raw.rotation:[0,0,0];
  const scale=Array.isArray(raw.scale)?raw.scale:[1,1,1];
  const size=Array.isArray(raw.size)?raw.size:[6,4,6];
  const color=/^#[0-9a-f]{6}$/i.test(raw.color||'')?raw.color:(type==='tree'?'#2f633a':'#8390a0');

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
    color
  };
}

function loadSceneData(){
  try{
    const raw=JSON.parse(localStorage.getItem(SCENE_DRAFT_KEY)||'null');
    if(raw?.version===1 && Array.isArray(raw.objects)){
      const objects=raw.objects.slice(0,300).map(normalizeObject).filter(Boolean);
      return {
        version:1,
        name:String(raw.name||'S1 Green Valley').slice(0,60),
        objects
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

function applyTransform(root,data){
  root.position.fromArray(data.position);
  root.rotation.set(...data.rotation);
  root.scale.fromArray(data.scale);
}

function createRoot(data){
  const root=data.type==='tree'?makeTree(data):makeBox(data);
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

function rebuildScene(){
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
  selectedId=null;
  renderObjectList();
  renderProperties();
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

function renderObjectList(){
  const list=$('sceneObjectList');
  if(!list) return;
  list.innerHTML='';

  for(const obj of sceneData.objects){
    const button=document.createElement('button');
    button.className='scene-object'+(obj.id===selectedId?' active':'');
    button.dataset.sceneId=obj.id;
    button.innerHTML=
      '<span>'+(obj.type==='tree'?'▲':'■')+'</span>'+
      '<strong>'+escapeHtml(obj.name)+'</strong>'+
      '<small>'+obj.type+'</small>';
    button.addEventListener('click',()=>selectObject(obj.id,true));
    list.appendChild(button);
  }

  if($('sceneObjectCount')) $('sceneObjectCount').textContent=String(sceneData.objects.length);
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

  if(!root) return;
  selectionBox=new THREE.BoxHelper(root,0xf0c64b);
  selectionBox.material.depthTest=false;
  selectionBox.material.transparent=true;
  selectionBox.material.opacity=.9;
  scene.add(selectionBox);
}

function selectObject(id,focus=false){
  const root=rootById(id);
  if(!root){
    selectedId=null;
    transform?.detach();
    setSelectionBox(null);
    renderObjectList();
    renderProperties();
    return;
  }

  selectedId=id;
  transform?.attach(root);
  setSelectionBox(root);
  renderObjectList();
  renderProperties();
  if(focus) focusSelected();
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

  $('selectedType').textContent=data.type.toUpperCase();
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

function syncDataFromRoot(){
  const data=sceneObjectById(selectedId);
  const root=rootById(selectedId);
  if(!data || !root) return;

  data.position=[round(root.position.x),round(root.position.y),round(root.position.z)];
  data.rotation=[root.rotation.x,root.rotation.y,root.rotation.z];
  data.scale=[round(root.scale.x),round(root.scale.y),round(root.scale.z)];

  selectionBox?.update();
  markDirty();
  renderProperties();
}

function markDirty(){
  sceneDirty=true;
  notifyState();
}

function notifyState(){
  stateFn?.({
    dirty:sceneDirty,
    count:sceneData?.objects.length||0,
    saved:Boolean(localStorage.getItem(SCENE_DRAFT_KEY))
  });
}

function updateEditAvailability(){
  const editable=canEdit;
  const ids=[
    'addBoxBtn','addTreeBtn','sceneMoveMode','sceneRotateMode','sceneScaleMode',
    'sceneDuplicateBtn','sceneDeleteBtn','propName',
    'propPosX','propPosY','propPosZ','propRotX','propRotY','propRotZ',
    'propScaleX','propScaleY','propScaleZ','propSizeX','propSizeY','propSizeZ',
    'propColor','propColorText','propDuplicateBtn','propDeleteBtn','resetSceneBtn'
  ];
  ids.forEach(id=>{
    const el=$(id);
    if(el) el.disabled=!editable;
  });

  if(transform){
    transform.enabled=editable;
    if(!editable) transform.setMode('translate');
  }
}

function setTransformMode(mode){
  if(!transform || !canEdit) return;
  transform.setMode(mode);
  ['sceneMoveMode','sceneRotateMode','sceneScaleMode'].forEach(id=>$(id)?.classList.remove('active'));
  const map={translate:'sceneMoveMode',rotate:'sceneRotateMode',scale:'sceneScaleMode'};
  $(map[mode])?.classList.add('active');
  $('sceneSelectMode')?.classList.remove('active');
}

function addObject(type){
  if(!canEdit) return;
  const id=(crypto.randomUUID?.()||('obj-'+Date.now()+'-'+Math.random())).replaceAll('.','-');
  const target=orbit?.target||new THREE.Vector3();

  const obj=normalizeObject(type==='tree'?{
    id,type:'tree',name:'New Tree',
    position:[round(target.x+4),0,round(target.z+4)],
    rotation:[0,0,0],scale:[1,1,1],color:'#2f633a'
  }:{
    id,type:'box',name:'New Box',
    position:[round(target.x+4),2.5,round(target.z+4)],
    rotation:[0,0,0],scale:[1,1,1],size:[5,5,5],color:'#8390a0'
  });

  sceneData.objects.push(obj);
  createRoot(obj);
  markDirty();
  renderObjectList();
  selectObject(obj.id,true);
  logFn('Scene: added '+obj.name,'ok');
}

function deleteSelected(){
  if(!canEdit || !selectedId) return;
  const data=sceneObjectById(selectedId);
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
  renderObjectList();
  renderProperties();
  logFn('Scene: deleted '+(data?.name||'object'),'ok');
}

function duplicateSelected(){
  if(!canEdit || !selectedId) return;
  const source=sceneObjectById(selectedId);
  if(!source) return;

  const copy=structuredClone(source);
  copy.id=(crypto.randomUUID?.()||('obj-'+Date.now()+'-'+Math.random())).replaceAll('.','-');
  copy.name=(source.name+' Copy').slice(0,40);
  copy.position[0]=round(copy.position[0]+3);
  copy.position[2]=round(copy.position[2]+3);

  sceneData.objects.push(copy);
  createRoot(copy);
  markDirty();
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
  if(!canEdit || !data || !root || !/^#[0-9a-f]{6}$/i.test(color)) return;

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
  if(!data || !root) return;

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

  if(data.type==='box'){
    const newSize=[
      clamp($('propSizeX').value,.5,100),
      clamp($('propSizeY').value,.5,100),
      clamp($('propSizeZ').value,.5,100)
    ];
    const changed=newSize.some((value,index)=>Math.abs(value-data.size[index])>.0001);
    data.size=newSize;
    if(changed){
      syncDataFromRoot();
      rebuildSelectedGeometry();
      markDirty();
      renderObjectList();
      return;
    }
  }

  syncDataFromRoot();
  renderObjectList();
}

function focusSelected(){
  const root=rootById(selectedId);
  if(!root || !camera || !orbit) return;

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

  const hits=ray.intersectObjects(roots,true);
  if(!hits.length){
    selectObject(null,false);
    return;
  }

  let root=hits[0].object;
  while(root && !root.userData.sceneId) root=root.parent;
  if(root?.userData.sceneId) selectObject(root.userData.sceneId,false);
}

function bindPropertyEvents(){
  const propertyIds=[
    'propName','propPosX','propPosY','propPosZ',
    'propRotX','propRotY','propRotZ',
    'propScaleX','propScaleY','propScaleZ',
    'propSizeX','propSizeY','propSizeZ'
  ];
  propertyIds.forEach(id=>$(id)?.addEventListener('change',applyPropertyInputs));

  $('propColor')?.addEventListener('input',event=>setSelectedColor(event.target.value));
  $('propColorText')?.addEventListener('change',event=>{
    const value=String(event.target.value||'').trim();
    if(/^#[0-9a-f]{6}$/i.test(value)) setSelectedColor(value);
    else renderProperties();
  });

  $('addBoxBtn')?.addEventListener('click',()=>addObject('box'));
  $('addTreeBtn')?.addEventListener('click',()=>addObject('tree'));

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

  $('resetSceneBtn')?.addEventListener('click',()=>{
    if(!canEdit) return;
    if(!confirm('Reset Scene Draft to the original S1 map?')) return;
    localStorage.removeItem(SCENE_DRAFT_KEY);
    sceneData=cloneDefaults();
    sceneDirty=true;
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
  });
  transform.addEventListener('objectChange',syncDataFromRoot);

  buildBaseWorld();
  for(const data of sceneData.objects) createRoot(data);

  renderer.domElement.addEventListener('pointerdown',pointerSelect);
  bindPropertyEvents();

  resizeObserver=new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  initialized=true;
  renderObjectList();
  renderProperties();
  setSceneEditorRole(role);
  notifyState();
  animate();
}

export function setSceneEditorRole(role){
  canEdit=['owner','developer','builder'].includes(role);
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
  if(!sceneData) return false;
  const payload={
    version:1,
    name:sceneData.name||'S1 Green Valley',
    updatedAt:new Date().toISOString(),
    objects:sceneData.objects.map(obj=>structuredClone(obj))
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
  rebuildScene();
  logFn('Scene reloaded','ok');
}

export function getSceneStatus(){
  return {
    dirty:sceneDirty,
    count:sceneData?.objects.length||0,
    saved:Boolean(localStorage.getItem(SCENE_DRAFT_KEY))
  };
}
