import * as THREE from './vendor/three.module.min.js';

const TAU=Math.PI*2;

function clamp01(value){
  return Math.max(0,Math.min(1,value));
}

function damp(current,target,speed,dt){
  return THREE.MathUtils.lerp(current,target,1-Math.exp(-speed*dt));
}

function dampAngle(current,target,speed,dt){
  const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current+delta*(1-Math.exp(-speed*dt));
}

function material(color,{roughness=.72,metalness=.04,emissive=0x000000,emissiveIntensity=0}={}){
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity
  });
}

function addMesh(parent,geometry,mat,{
  x=0,y=0,z=0,
  rx=0,ry=0,rz=0,
  sx=1,sy=1,sz=1,
  castShadow=true,
  receiveShadow=true,
  hitZone=null,
  name=''
}={}){
  const mesh=new THREE.Mesh(geometry,mat);
  mesh.position.set(x,y,z);
  mesh.rotation.set(rx,ry,rz);
  mesh.scale.set(sx,sy,sz);
  mesh.castShadow=castShadow;
  mesh.receiveShadow=receiveShadow;
  if(name) mesh.name=name;
  if(hitZone) mesh.userData.hitZone=hitZone;
  parent.add(mesh);
  return mesh;
}

function addPivot(parent,name,x,y,z){
  const pivot=new THREE.Group();
  pivot.name=name;
  pivot.position.set(x,y,z);
  parent.add(pivot);
  return pivot;
}

function createLowPolyRifle({accent=0xd4ad35,dark=0x171d24,body=0x2c343d}={}){
  const root=new THREE.Group();
  root.name='WeaponRig';

  const darkMat=material(dark,{roughness:.42,metalness:.40});
  const bodyMat=material(body,{roughness:.40,metalness:.34});
  const accentMat=material(accent,{roughness:.30,metalness:.56,emissive:0x241b03,emissiveIntensity:.10});

  addMesh(root,new THREE.BoxGeometry(.18,.22,1.34),bodyMat,{y:0,z:-.34,name:'Receiver'});
  addMesh(root,new THREE.BoxGeometry(.11,.11,.98),darkMat,{y:.015,z:-1.45,name:'Barrel'});
  addMesh(root,new THREE.CylinderGeometry(.075,.075,.36,10),darkMat,{y:.015,z:-2.08,rx:Math.PI/2,name:'Muzzle'});
  addMesh(root,new THREE.BoxGeometry(.16,.18,.58),darkMat,{y:.01,z:.63,name:'Stock'});
  addMesh(root,new THREE.BoxGeometry(.13,.46,.24),darkMat,{y:-.28,z:-.28,rx:-.15,name:'Grip'});
  addMesh(root,new THREE.BoxGeometry(.18,.52,.30),accentMat,{y:-.34,z:-.67,rx:.10,name:'Magazine'});
  addMesh(root,new THREE.BoxGeometry(.10,.16,.28),darkMat,{y:.20,z:-.50,name:'Sight'});
  addMesh(root,new THREE.BoxGeometry(.08,.08,.76),accentMat,{x:.13,y:.02,z:-1.24,name:'SideRail'});

  root.userData.muzzleLocal=new THREE.Vector3(0,.015,-2.26);
  root.scale.set(.84,.84,.84);
  return root;
}

function tagCharacterMesh(root,mesh,zone){
  mesh.userData.characterRoot=root;
  mesh.userData.hitZone=zone;
  root.userData.hitMeshes.push(mesh);
}

function addHitPart(root,parent,geometry,mat,opts,zone){
  const mesh=addMesh(parent,geometry,mat,{...opts,hitZone:zone});
  tagCharacterMesh(root,mesh,zone);
  return mesh;
}

export function createHumanoidCharacter(options={}){
  const {
    outfitColor=0x31567e,
    pantsColor=0x222c37,
    vestColor=0x3b4c5c,
    skinColor=0xc99372,
    hairColor=0x151a20,
    shoeColor=0x10161d,
    accentColor=0xd6ae38,
    enemy=false,
    bot=false,
    name='Character'
  }=options;

  const root=new THREE.Group();
  root.name=name;
  root.userData.hitMeshes=[];

  const skinMat=material(skinColor,{roughness:.78});
  const shirtMat=material(enemy?0x9d3c43:outfitColor,{roughness:.70});
  const pantsMat=material(pantsColor,{roughness:.76});
  const vestMat=material(enemy?0x5a2c33:vestColor,{roughness:.54,metalness:.08});
  const hairMat=material(hairColor,{roughness:.66});
  const shoeMat=material(shoeColor,{roughness:.50,metalness:.10});
  const accentMat=material(accentColor,{roughness:.34,metalness:.48,emissive:0x241b03,emissiveIntensity:.10});
  const eyeMat=material(0x11161b,{roughness:.45});

  const rig={
    time:Math.random()*TAU,
    stride:0,
    state:'idle',
    speed:0,
    crouch:0,
    recoil:0,
    reload:0,
    hit:0,
    dead:0
  };

  const body=addPivot(root,'Body',0,0,0);
  const hips=addPivot(body,'Hips',0,1.37,0);
  const torso=addPivot(body,'Torso',0,1.53,0);
  const headPivot=addPivot(body,'HeadPivot',0,2.97,0);

  const leftLeg=addPivot(hips,'LeftLeg',-.245,0,0);
  const rightLeg=addPivot(hips,'RightLeg',.245,0,0);
  const leftArm=addPivot(torso,'LeftArm',-.55,.94,0);
  const rightArm=addPivot(torso,'RightArm',.55,.94,0);

  // Pelvis and layered clothing.
  addHitPart(root,hips,new THREE.BoxGeometry(.72,.34,.46),pantsMat,{y:.02,z:0,name:'Pelvis'},'torso');
  addMesh(hips,new THREE.BoxGeometry(.76,.10,.50),accentMat,{y:.17,z:0,name:'Belt'});

  // Torso: undershirt + outer shirt + tactical vest.
  addHitPart(root,torso,new THREE.BoxGeometry(.84,1.02,.48),shirtMat,{y:.48,z:0,name:'Torso'},'torso');
  addMesh(torso,new THREE.BoxGeometry(.92,.66,.56),vestMat,{y:.54,z:-.03,name:'Vest'});
  addMesh(torso,new THREE.BoxGeometry(.12,.54,.61),accentMat,{x:-.34,y:.54,z:-.02,name:'VestStripL'});
  addMesh(torso,new THREE.BoxGeometry(.12,.54,.61),accentMat,{x:.34,y:.54,z:-.02,name:'VestStripR'});
  addMesh(torso,new THREE.OctahedronGeometry(.10),accentMat,{y:.62,z:-.325,rz:Math.PI/4,name:'ChestMark'});

  // Backpack sits behind the torso, no hitbox expansion.
  addMesh(torso,new THREE.BoxGeometry(.58,.72,.27),shoeMat,{y:.50,z:.39,name:'Backpack'});
  addMesh(torso,new THREE.BoxGeometry(.45,.18,.16),accentMat,{y:.72,z:.55,name:'BackpackTop'});

  const buildLeg=(pivot,side)=>{
    const upper=addHitPart(root,pivot,new THREE.CylinderGeometry(.155,.175,.70,10),pantsMat,{y:-.34,name:side+'UpperLeg'},'legs');
    const knee=addMesh(pivot,new THREE.SphereGeometry(.17,10,8),vestMat,{y:-.71,name:side+'Knee'});
    const lower=addHitPart(root,pivot,new THREE.CylinderGeometry(.13,.155,.64,10),pantsMat,{y:-1.02,name:side+'LowerLeg'},'legs');
    addMesh(pivot,new THREE.BoxGeometry(.31,.22,.49),shoeMat,{y:-1.39,z:-.09,name:side+'Boot'});
    addMesh(pivot,new THREE.BoxGeometry(.20,.10,.36),accentMat,{y:-1.26,z:.02,name:side+'BootAccent'});
    return {upper,knee,lower};
  };

  buildLeg(leftLeg,'Left');
  buildLeg(rightLeg,'Right');

  const buildArm=(pivot,side)=>{
    addMesh(pivot,new THREE.SphereGeometry(.19,10,8),vestMat,{name:side+'Shoulder'});
    const upper=addHitPart(root,pivot,new THREE.CylinderGeometry(.115,.135,.63,10),shirtMat,{y:-.31,name:side+'UpperArm'},'arms');
    addMesh(pivot,new THREE.SphereGeometry(.12,10,8),skinMat,{y:-.65,name:side+'Elbow'});
    const lower=addHitPart(root,pivot,new THREE.CylinderGeometry(.095,.115,.55,10),skinMat,{y:-.91,name:side+'Forearm'},'arms');
    addMesh(pivot,new THREE.SphereGeometry(.115,10,8),skinMat,{y:-1.21,name:side+'Hand'});
    return {upper,lower};
  };

  buildArm(leftArm,'Left');
  buildArm(rightArm,'Right');

  // Neck/head/face.
  addMesh(headPivot,new THREE.CylinderGeometry(.12,.14,.18,10),skinMat,{y:-.13,name:'Neck'});
  const head=addHitPart(root,headPivot,new THREE.SphereGeometry(.36,18,14),skinMat,{y:.21,sy:1.08,name:'Head'},'head');

  // Hair cap and front fringe.
  const hair=addMesh(headPivot,new THREE.SphereGeometry(.378,16,12),hairMat,{y:.31,z:.025,sy:.64,name:'Hair'});
  hair.scale.x=1.02;
  hair.scale.z=1.03;
  addMesh(headPivot,new THREE.BoxGeometry(.44,.11,.10),hairMat,{y:.31,z:-.35,rz:-.04,name:'Fringe'});

  // Simple face, deliberately stylized rather than uncanny.
  addMesh(headPivot,new THREE.SphereGeometry(.038,8,6),eyeMat,{x:-.12,y:.24,z:-.34,sz:.45,castShadow:false,receiveShadow:false,name:'EyeL'});
  addMesh(headPivot,new THREE.SphereGeometry(.038,8,6),eyeMat,{x:.12,y:.24,z:-.34,sz:.45,castShadow:false,receiveShadow:false,name:'EyeR'});
  addMesh(headPivot,new THREE.BoxGeometry(.13,.025,.025),eyeMat,{y:.08,z:-.355,castShadow:false,receiveShadow:false,name:'Mouth'});

  // Weapon rig is kept separate from hit meshes.
  const weaponMount=addPivot(torso,'WeaponMount',.20,.47,-.46);
  const weapon=createLowPolyRifle({accent:accentColor});
  weapon.rotation.set(-.04,0,0);
  weaponMount.add(weapon);

  // Hands are posed toward the weapon by rotating shoulder pivots.
  leftArm.rotation.set(1.02,0,-.18);
  rightArm.rotation.set(1.10,0,.15);

  root.userData.characterRig={
    ...rig,
    body,
    hips,
    torso,
    headPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    weaponMount,
    weapon,
    head
  };
  root.userData.weapon=weapon;
  root.userData.gun=weapon;
  root.userData.characterKind=enemy?'enemy':bot?'bot':'player';
  root.userData.hitMultipliers={
    head:1.65,
    torso:1,
    arms:.82,
    legs:.76
  };

  return root;
}

export function getCharacterHitMeshes(character){
  return Array.isArray(character?.userData?.hitMeshes)
    ? character.userData.hitMeshes
    : [];
}

export function getHitMultiplier(character,mesh){
  const zone=mesh?.userData?.hitZone || 'torso';
  return character?.userData?.hitMultipliers?.[zone] ?? 1;
}

export function pulseCharacterAction(character,action,amount=1){
  const rig=character?.userData?.characterRig;
  if(!rig) return;
  if(action==='fire') rig.recoil=Math.max(rig.recoil,clamp01(amount));
  if(action==='reload') rig.reload=Math.max(rig.reload,clamp01(amount));
  if(action==='hit') rig.hit=Math.max(rig.hit,clamp01(amount));
}

export function setCharacterWeaponVisible(character,visible){
  const weapon=character?.userData?.characterRig?.weapon;
  if(weapon) weapon.visible=Boolean(visible);
}

export function updateHumanoidAnimation(character,state={},dt=1/60){
  const rig=character?.userData?.characterRig;
  if(!rig) return;

  rig.time+=dt;
  const speed=Math.max(0,Number(state.speed)||0);
  const moving=Boolean(state.moving) || speed>.15;
  const sprinting=Boolean(state.sprinting);
  const aiming=Boolean(state.aiming);
  const reloading=Boolean(state.reloading);
  const crouching=Boolean(state.crouching);
  const airborne=Boolean(state.airborne);
  const dead=Boolean(state.dead);
  const lobby=Boolean(state.lobby);

  rig.recoil=Math.max(0,rig.recoil-dt*8.5);
  rig.reload=reloading
    ? Math.min(1,rig.reload+dt*2.2)
    : Math.max(0,rig.reload-dt*3.2);
  rig.hit=Math.max(0,rig.hit-dt*4.5);
  rig.dead=damp(rig.dead,dead?1:0,8,dt);
  rig.crouch=damp(rig.crouch,crouching?1:0,10,dt);
  rig.speed=damp(rig.speed,speed,7,dt);

  const strideSpeed=sprinting?11:moving?8:2.2;
  rig.stride+=dt*strideSpeed;
  if(rig.stride>TAU*100) rig.stride%=TAU;

  const moveWeight=moving&&!airborne&&!dead?clamp01(speed/7):0;
  const stride=Math.sin(rig.stride);
  const strideOpp=Math.sin(rig.stride+Math.PI);
  const idleBreath=Math.sin(rig.time*1.8)*.018;
  const bob=moveWeight*Math.abs(Math.sin(rig.stride*2))*.035;

  rig.body.position.y=damp(
    rig.body.position.y,
    -rig.crouch*.44 + idleBreath + bob - rig.dead*.36,
    12,
    dt
  );

  rig.torso.rotation.z=dampAngle(
    rig.torso.rotation.z,
    rig.hit*.07*Math.sin(rig.time*20),
    12,
    dt
  );
  rig.torso.rotation.x=dampAngle(
    rig.torso.rotation.x,
    sprinting&&moving?.08:airborne?-.06:0,
    10,
    dt
  );

  const legSwing=airborne?0:stride*.72*moveWeight;
  rig.leftLeg.rotation.x=dampAngle(rig.leftLeg.rotation.x,legSwing,14,dt);
  rig.rightLeg.rotation.x=dampAngle(rig.rightLeg.rotation.x,-legSwing,14,dt);

  if(airborne){
    rig.leftLeg.rotation.x=dampAngle(rig.leftLeg.rotation.x,-.24,12,dt);
    rig.rightLeg.rotation.x=dampAngle(rig.rightLeg.rotation.x,.36,12,dt);
  }

  const baseArmX=aiming?1.22:1.02;
  const walkArm=aiming?0:strideOpp*.22*moveWeight;
  const reloadWave=rig.reload*Math.sin(rig.time*9)*.16;

  rig.leftArm.rotation.x=dampAngle(
    rig.leftArm.rotation.x,
    baseArmX+walkArm+(reloading?-.30+reloadWave:0),
    14,
    dt
  );
  rig.rightArm.rotation.x=dampAngle(
    rig.rightArm.rotation.x,
    baseArmX-walkArm+(reloading?-.08:0),
    14,
    dt
  );

  rig.leftArm.rotation.z=dampAngle(
    rig.leftArm.rotation.z,
    aiming?-.32:reloading?-.55:-.18,
    14,
    dt
  );
  rig.rightArm.rotation.z=dampAngle(
    rig.rightArm.rotation.z,
    aiming?.24:reloading?.05:.15,
    14,
    dt
  );

  const recoilKick=rig.recoil*.12;
  rig.weaponMount.position.z=damp(rig.weaponMount.position.z,-.46+recoilKick,24,dt);
  rig.weaponMount.position.y=damp(
    rig.weaponMount.position.y,
    .47+(aiming?.055:0)+(reloading?-.10:0),
    14,
    dt
  );
  rig.weaponMount.rotation.x=dampAngle(
    rig.weaponMount.rotation.x,
    reloading?.34:rig.recoil*-.08,
    16,
    dt
  );
  rig.weaponMount.rotation.z=dampAngle(
    rig.weaponMount.rotation.z,
    reloading?-.24:0,
    16,
    dt
  );

  rig.headPivot.rotation.x=dampAngle(
    rig.headPivot.rotation.x,
    lobby?Math.sin(rig.time*.7)*.025:airborne?.04:0,
    8,
    dt
  );
  rig.headPivot.rotation.y=dampAngle(
    rig.headPivot.rotation.y,
    lobby?Math.sin(rig.time*.45)*.05:0,
    8,
    dt
  );

  if(dead){
    rig.body.rotation.z=dampAngle(rig.body.rotation.z,-1.15,5,dt);
    rig.weaponMount.rotation.x=dampAngle(rig.weaponMount.rotation.x,.8,5,dt);
  }else{
    rig.body.rotation.z=dampAngle(rig.body.rotation.z,0,8,dt);
  }

  character.userData.animationState=
    dead?'dead':
    reloading?'reload':
    airborne?'air':
    crouching?'crouch':
    sprinting&&moving?'sprint':
    moving?'move':
    aiming?'aim':
    lobby?'lobby-idle':'idle';
}
