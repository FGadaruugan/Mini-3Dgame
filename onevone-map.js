export const ONEVONE_MAP = {
  version: 1,
  name: '1V1 Arena',
  mapHalf: 70,
  groundColor: '#536b47',
  objects: [
    {id:'spawn-a',type:'spawnA',name:'HOST SPAWN',position:[0,0,52],rotation:[0,3.141592653589793,0],scale:[1,1,1],color:'#62c8ff'},
    {id:'spawn-b',type:'spawnB',name:'GUEST SPAWN',position:[0,0,-52],rotation:[0,0,0],scale:[1,1,1],color:'#ff7a72'},

    {id:'boundary-n',type:'box',name:'North Boundary',position:[0,2,-68],rotation:[0,0,0],scale:[1,1,1],size:[136,4,4],color:'#3b4650'},
    {id:'boundary-s',type:'box',name:'South Boundary',position:[0,2,68],rotation:[0,0,0],scale:[1,1,1],size:[136,4,4],color:'#3b4650'},
    {id:'boundary-w',type:'box',name:'West Boundary',position:[-68,2,0],rotation:[0,0,0],scale:[1,1,1],size:[4,4,136],color:'#3b4650'},
    {id:'boundary-e',type:'box',name:'East Boundary',position:[68,2,0],rotation:[0,0,0],scale:[1,1,1],size:[4,4,136],color:'#3b4650'},

    {id:'cover-center-a',type:'box',name:'Center Cover A',position:[-9,2,0],rotation:[0,0.35,0],scale:[1,1,1],size:[7,4,14],color:'#747b82'},
    {id:'cover-center-b',type:'box',name:'Center Cover B',position:[9,2,0],rotation:[0,-0.35,0],scale:[1,1,1],size:[7,4,14],color:'#747b82'}
  ]
};
