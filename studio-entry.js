import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const button=document.getElementById('studioBtn');

if(new URLSearchParams(location.search).get('studioTest')==='1'){
  try{
    const draft=JSON.parse(localStorage.getItem('mini3d-studio-gui-v1')||'null');
    if(typeof draft?.generatedCss==='string' && draft.generatedCss.trim()){
      const style=document.createElement('style');
      style.id='mini3d-studio-gui-test';
      style.textContent=draft.generatedCss;
      document.head.appendChild(style);
      document.documentElement.dataset.studioGuiTest='1';
    }
  }catch(error){
    console.warn('Studio GUI test draft unavailable',error);
  }
}

if(button){
  button.classList.add('hidden');

  const openStudio=()=>{
    window.location.href='./studio/';
  };

  button.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    openStudio();
  });

  (async()=>{
    try{
      const configured=
        /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) &&
        typeof SUPABASE_PUBLISHABLE_KEY==='string' &&
        SUPABASE_PUBLISHABLE_KEY.length>20;

      if(!configured) return;

      const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
      const {data:{session}}=await client.auth.getSession();
      if(!session) return;

      const {data,error}=await client.rpc('get_studio_access');
      if(error) return;

      const access=Array.isArray(data)?data[0]:data;
      const role=access?.role||'player';
      if(!['owner','developer','builder','tester'].includes(role)) return;

      button.dataset.studioRole=role;
      const small=button.querySelector('small');
      if(small) small.textContent=role.toUpperCase()+' · Private developer workspace';
      button.classList.remove('hidden');
    }catch(error){
      console.warn('Studio entry unavailable',error);
    }
  })();
}
