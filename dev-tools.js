let api=null;
let root=null;
let statsEl=null;
let colliderOn=false;

function button(label,action,{danger=false}={}){
  const el=document.createElement('button');
  el.type='button';
  el.textContent=label;
  if(danger) el.classList.add('danger');
  el.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    action?.();
  });
  return el;
}

export function initDevTools(options={}){
  if(!options.enabled || root) return;
  api=options;

  const style=document.createElement('style');
  style.textContent=`
    .m3d-dev-panel{
      position:fixed;left:10px;bottom:10px;z-index:99999;width:min(330px,calc(100vw - 20px));
      padding:10px;border:1px solid #3a4653;border-radius:10px;background:rgba(7,12,18,.94);
      color:#eaf0f6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
      box-shadow:0 14px 40px rgba(0,0,0,.45);backdrop-filter:blur(8px)
    }
    .m3d-dev-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
    .m3d-dev-head strong{font:900 11px/1 system-ui,sans-serif;letter-spacing:.08em;color:#f0c64b}
    .m3d-dev-head button{border:0;background:transparent;color:#8fa1b4;font-size:15px;cursor:pointer}
    .m3d-dev-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:8px}
    .m3d-dev-stat{padding:6px;border-radius:5px;background:#111b25;color:#7f92a5;font-size:8px}
    .m3d-dev-stat b{display:block;margin-top:2px;color:#dce6ef;font-size:11px}
    .m3d-dev-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
    .m3d-dev-actions button{
      min-height:34px;border:1px solid #2a3a49;border-radius:6px;background:#15212c;color:#d5e0ea;
      font:800 9px system-ui,sans-serif;cursor:pointer
    }
    .m3d-dev-actions button:hover{border-color:#566c80}
    .m3d-dev-actions button.active{border-color:#aa8d35;background:#2a2413;color:#f0c64b}
    .m3d-dev-actions button.danger{border-color:#6a343b;background:#2b161b;color:#ff939c}
    .m3d-dev-collapsed .m3d-dev-stats,.m3d-dev-collapsed .m3d-dev-actions{display:none}
    @media(max-width:700px){
      .m3d-dev-panel{width:260px;max-height:48vh;overflow:auto;transform:scale(.88);transform-origin:left bottom}
      .m3d-dev-actions{grid-template-columns:1fr 1fr}
    }
  `;
  document.head.appendChild(style);

  root=document.createElement('section');
  root.className='m3d-dev-panel';
  root.innerHTML=`
    <div class="m3d-dev-head">
      <strong>STUDIO PLAY TEST</strong>
      <button type="button" aria-label="Collapse">−</button>
    </div>
    <div class="m3d-dev-stats"></div>
    <div class="m3d-dev-actions"></div>
  `;

  statsEl=root.querySelector('.m3d-dev-stats');
  const actions=root.querySelector('.m3d-dev-actions');

  const controls=[
    button('START GROUND',api.startGround),
    button('HEAL',api.heal),
    button('TEST LOADOUT',api.giveLoadout),
    button('BRING CAR',api.bringCar),
    button('FAST ZONE',api.shrinkZone),
    button('COLLIDERS',()=>{
      colliderOn=Boolean(api.toggleColliders?.());
      const target=[...actions.children].find(x=>x.textContent==='COLLIDERS');
      target?.classList.toggle('active',colliderOn);
    }),
    button('CLEAR BOTS',api.eliminateBots,{danger:true}),
    button('RETURN LOBBY',api.returnLobby)
  ];

  controls.forEach(el=>actions.appendChild(el));

  root.querySelector('.m3d-dev-head button').addEventListener('click',()=>{
    root.classList.toggle('m3d-dev-collapsed');
    root.querySelector('.m3d-dev-head button').textContent=
      root.classList.contains('m3d-dev-collapsed')?'+':'−';
  });

  root.addEventListener('pointerdown',event=>event.stopPropagation());
  root.addEventListener('mousedown',event=>event.stopPropagation());
  root.addEventListener('contextmenu',event=>event.stopPropagation());

  document.body.appendChild(root);
  updateDevTools();
}

export function updateDevTools(){
  if(!root || !api?.getStats) return;
  const s=api.getStats()||{};
  const stats=[
    ['FPS',s.fps??0],
    ['PHASE',String(s.phase??'—').toUpperCase()],
    ['HP',s.hp??0],
    ['BOTS',(s.botsLanded??0)+'/'+(s.botsAlive??0)],
    ['LOOT',s.loot??0],
    ['CARS',s.cars??0],
    ['OBJECTS',s.sceneObjects??0],
    ['ZONE',(s.zone??0)+'m']
  ];
  statsEl.innerHTML=stats.map(([name,value])=>
    '<div class="m3d-dev-stat">'+name+'<b>'+String(value)+'</b></div>'
  ).join('');
}
