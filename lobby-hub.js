(() => {
  const STORAGE_KEY='mini3d-s2-hub-v1';
  const PROFILE_STATS_KEY='mini3d-profile-stats-v1';
  const VERSION=2;

  const THEMES=[
    {id:'classic',name:'CLASSIC',desc:'Clean S2 battlefield lobby'},
    {id:'neon',name:'NEON OPS',desc:'Cool blue tactical lobby'},
    {id:'ember',name:'EMBER',desc:'Warm competitive lobby'}
  ];

  const WEAPONS=[
    {id:'AR4',name:'AR-4',type:'ASSAULT',damage:27,mag:30,rate:'FAST'},
    {id:'AR7',name:'AR-7',type:'ASSAULT',damage:32,mag:30,rate:'MEDIUM'},
    {id:'SMG9',name:'SMG-9',type:'SMG',damage:20,mag:35,rate:'VERY FAST'},
    {id:'DMR5',name:'DMR-5',type:'DMR',damage:43,mag:20,rate:'SEMI'},
    {id:'LMG5',name:'LMG-5',type:'LMG',damage:25,mag:45,rate:'FAST'}
  ];

  const CARDS=[
    {id:'vanguard',name:'VANGUARD',tag:'S2',desc:'Season 2 starter card'},
    {id:'duelist',name:'DUELIST',tag:'1V1',desc:'Built for arena players'},
    {id:'survivor',name:'SURVIVOR',tag:'BR',desc:'Battle Royale specialist'}
  ];

  const INVENTORY_ITEMS=[
    {id:'field',name:'FIELD KIT',slot:'OUTFIT',desc:'Standard S2 combat kit'},
    {id:'gold',name:'GOLD BADGE',slot:'BADGE',desc:'Season 2 gold lobby badge'},
    {id:'crimson',name:'CRIMSON TAG',slot:'BADGE',desc:'Arena-red profile accent'}
  ];

  const PAGE_META={
    theme:['THEME','SEASON 2 LOBBY STYLE'],
    season:['S2 / SEASON','SEASON 02 PROGRESS'],
    workshop:['WORKSHOP','WEAPONS & LOADOUT PREVIEW'],
    cards:['CARDS','PLAYER CARD COLLECTION'],
    inventory:['INVENTORY','SEASON 2 ITEMS'],
    mail:['MAIL','MESSAGES & REWARDS'],
    clan:['CLAN','LOCAL CLAN PROFILE'],
    rank:['RANK','S2 LOCAL PERFORMANCE'],
    security:['SECURITY CENTER','LOCAL ACCOUNT SAFETY'],
    region:['REGION','MATCH REGION PREFERENCE'],
    create:['CO-CREATE SPACE','CREATOR ACCESS'],
    club:['CLUB','FRIENDS & SOCIAL'],
    tournament:['TOURNAMENT','S2 ARENA CUP'],
    esports:['ESPORTS CENTER','COMPETITIVE HUB'],
    wiki:['GAME WIKI','S2 RULES & CONTROLS'],
    support:['CUSTOMER SERVICE','DIAGNOSTICS & HELP'],
    recall:['RECALL','RETURNING PLAYER REWARD'],
    crate:['CRATES','S2 REWARD CRATES'],
    shop:['SHOP','S2 LOCAL CATALOG'],
    modes:['GAME MODES','CHOOSE HOW TO PLAY']
  };

  const defaults=()=>({
    version:VERSION,
    theme:'classic',
    favoriteWeapon:'LMG5',
    equippedCard:'vanguard',
    equippedItem:'field',
    ownedItems:['field'],
    region:'ASIA',
    clanTag:'',
    tournamentRegistered:false,
    claimedMail:[],
    claimedMissions:[],
    claimedSeason:[],
    claimedRecallDate:'',
    crateOpened:0,
    credits:0
  });

  function clone(value){return JSON.parse(JSON.stringify(value));}

  function emptyProfileStats(){
    return {matches:0,wins:0,kills:0,soloWins:0,duelWins:0};
  }

  function normalizeProfileStats(raw){
    const base=emptyProfileStats();
    return {
      matches:Math.max(0,Math.floor(Number(raw?.matches)||base.matches)),
      wins:Math.max(0,Math.floor(Number(raw?.wins)||base.wins)),
      kills:Math.max(0,Math.floor(Number(raw?.kills)||base.kills)),
      soloWins:Math.max(0,Math.floor(Number(raw?.soloWins)||base.soloWins)),
      duelWins:Math.max(0,Math.floor(Number(raw?.duelWins)||base.duelWins))
    };
  }

  function loadProfileStats(migrateFrom=null){
    try{
      const stored=JSON.parse(localStorage.getItem(PROFILE_STATS_KEY)||'null');
      if(stored) return normalizeProfileStats(stored);
    }catch{}

    const migrated=normalizeProfileStats(migrateFrom);
    localStorage.setItem(PROFILE_STATS_KEY,JSON.stringify(migrated));
    return migrated;
  }

  function load(){
    const base=defaults();
    try{
      const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!raw) return {state:base,legacyStats:null};

      const {stats:legacyStats,...seasonRaw}=raw;
      return {
        state:{
          ...base,
          ...seasonRaw,
          claimedMail:Array.isArray(raw.claimedMail)?raw.claimedMail:[],
          claimedMissions:Array.isArray(raw.claimedMissions)?raw.claimedMissions:[],
          claimedSeason:Array.isArray(raw.claimedSeason)?raw.claimedSeason:[],
          ownedItems:Array.isArray(raw.ownedItems)?raw.ownedItems:['field']
        },
        legacyStats
      };
    }catch{
      return {state:base,legacyStats:null};
    }
  }

  const loaded=load();
  let state=loaded.state;
  let playerStats=loadProfileStats(loaded.legacyStats);
  let activePage='season';

  const $=id=>document.getElementById(id);
  const overlay=()=>$('s2HubOverlay');
  const content=()=>$('s2HubContent');
  const title=()=>$('s2HubTitle');
  const subtitle=()=>$('s2HubSubtitle');
  const credits=()=>$('s2HubCredits');

  function save(){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    applyLobbyState();
    renderHeader();
  }

  function escapeHtml(value){
    return String(value??'')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function todayKey(){
    const now=new Date();
    return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  }

  function applyLobbyState(){
    document.body.dataset.s2Theme=state.theme;
    document.body.dataset.s2Card=state.equippedCard;
    document.body.dataset.s2Item=state.equippedItem;

    document.querySelectorAll('.season-tag').forEach(el=>el.textContent='SEASON 02');
    document.querySelectorAll('.mobile-brand small').forEach(el=>el.textContent='SEASON 02');

    const playerCards=document.querySelectorAll('.lobby-player,.mobile-profile');
    playerCards.forEach(el=>{
      el.dataset.card=state.equippedCard;
      el.dataset.item=state.equippedItem;
    });
  }

  function renderHeader(){
    if(credits()) credits().textContent=String(state.credits||0);
  }

  function setPageMeta(page){
    const meta=PAGE_META[page]||[String(page).toUpperCase(),'SEASON 2'];
    if(title()) title().textContent=meta[0];
    if(subtitle()) subtitle().textContent=meta[1];
  }

  function button(label,action,extra=''){
    return '<button class="s2-action '+extra+'" data-s2-action="'+escapeHtml(action)+'">'+escapeHtml(label)+'</button>';
  }

  function progress(value,max){
    const pct=Math.max(0,Math.min(100,max?value/max*100:0));
    return '<div class="s2-progress"><i style="width:'+pct.toFixed(1)+'%"></i></div>';
  }

  function missionRows(){
    const s=playerStats;
    const missions=[
      {id:'play-1',title:'PLAY ONE MATCH',value:s.matches,max:1,reward:50},
      {id:'kills-10',title:'GET 10 KILLS',value:s.kills,max:10,reward:100},
      {id:'win-1',title:'WIN ONE MATCH',value:s.wins,max:1,reward:150}
    ];

    return missions.map(m=>{
      const done=m.value>=m.max;
      const claimed=state.claimedMissions.includes(m.id);
      return '<article class="s2-list-card">'+
        '<div><small>MISSION</small><strong>'+m.title+'</strong>'+
        '<span>'+Math.min(m.value,m.max)+' / '+m.max+'</span>'+progress(m.value,m.max)+'</div>'+
        (claimed
          ? '<b class="s2-state good">CLAIMED</b>'
          : done
            ? button('CLAIM +'+m.reward,'claim-mission:'+m.id,'compact')
            : '<b class="s2-state">IN PROGRESS</b>')+
      '</article>';
    }).join('');
  }

  function renderTheme(){
    return '<div class="s2-grid">'+THEMES.map(t=>
      '<article class="s2-tile '+(state.theme===t.id?'selected':'')+'">'+
        '<small>LOBBY THEME</small><strong>'+t.name+'</strong><p>'+t.desc+'</p>'+
        button(state.theme===t.id?'EQUIPPED':'APPLY','theme:'+t.id,state.theme===t.id?'muted':'')+
      '</article>'
    ).join('')+'</div>';
  }

  function renderSeason(){
    return '<section class="s2-hero-card">'+
      '<div><small>SEASON 02</small><h2>FRONTLINE</h2><p>Season 2 focuses on the dedicated 1V1 Arena, lobby systems, Studio map editing and polish.</p></div>'+
      '<div class="s2-season-badge"><span>S2</span><b>FRONTLINE</b></div>'+
    '</section>'+
    '<h3 class="s2-section-title">SEASON CONTENT</h3>'+
    '<div class="s2-grid">'+
      '<article class="s2-tile selected"><small>NEW MODE</small><strong>1V1 ARENA</strong><p>10 minutes · first to 40 kills · LMG-5 · 3s respawn · 3s shield.</p>'+button('OPEN MODES','open-modes')+'</article>'+
      '<article class="s2-tile"><small>MAP</small><strong>DEDICATED ARENA</strong><p>1V1 uses its own map and no longer loads the Battle Royale world.</p></article>'+
      '<article class="s2-tile"><small>CREATOR</small><strong>STUDIO SCENE</strong><p>Authorized creators can build the 1V1 Arena separately from Green Valley.</p>'+button('CREATOR ACCESS','open-create')+'</article>'+
      '<article class="s2-tile"><small>CUSTOMIZATION</small><strong>THEMES & CARDS</strong><p>Season 2 lobby themes, player cards and local cosmetics are managed from the bottom menu.</p>'+button('OPEN THEME','open-theme')+'</article>'+
      '<article class="s2-tile"><small>WORKSHOP</small><strong>WEAPON SHOWCASE</strong><p>Inspect S2 weapon information and choose a showcase weapon for your lobby profile.</p>'+button('OPEN WORKSHOP','open-workshop')+'</article>'+
      '<article class="s2-tile"><small>SOCIAL</small><strong>PROFILE / FRIENDS</strong><p>Player statistics belong to Profile. Friends and invitations use a separate Friends screen.</p>'+button('OPEN PROFILE','open-profile')+'</article>'+
    '</div>';
  }

  function renderWorkshop(){
    return '<div class="s2-grid">'+WEAPONS.map(w=>
      '<article class="s2-tile '+(state.favoriteWeapon===w.id?'selected':'')+'">'+
        '<small>'+w.type+'</small><strong>'+w.name+'</strong>'+
        '<div class="s2-specs"><span>DMG <b>'+w.damage+'</b></span><span>MAG <b>'+w.mag+'</b></span><span>RATE <b>'+w.rate+'</b></span></div>'+
        '<p>Workshop selection is saved as your S2 showcase weapon.</p>'+
        button(state.favoriteWeapon===w.id?'SHOWCASE':'SET SHOWCASE','weapon:'+w.id,state.favoriteWeapon===w.id?'muted':'')+
      '</article>'
    ).join('')+'</div><div class="s2-note">1V1 gameplay remains locked to LMG-5 · 45/∞ by match rules.</div>';
  }

  function renderCards(){
    return '<div class="s2-grid">'+CARDS.map(card=>
      '<article class="s2-player-card '+(state.equippedCard===card.id?'selected':'')+'">'+
        '<div class="s2-card-art">'+card.tag+'</div><small>PLAYER CARD</small><strong>'+card.name+'</strong><p>'+card.desc+'</p>'+
        button(state.equippedCard===card.id?'EQUIPPED':'EQUIP','card:'+card.id,state.equippedCard===card.id?'muted':'')+
      '</article>'
    ).join('')+'</div>';
  }

  function renderInventory(){
    return '<div class="s2-grid">'+INVENTORY_ITEMS.map(item=>{
      const owned=state.ownedItems.includes(item.id);
      const equipped=state.equippedItem===item.id;
      return '<article class="s2-tile '+(equipped?'selected':'')+'">'+
        '<small>'+item.slot+'</small><strong>'+item.name+'</strong><p>'+item.desc+'</p>'+
        (owned
          ? button(equipped?'EQUIPPED':'EQUIP','item:'+item.id,equipped?'muted':'')
          : '<b class="s2-state">LOCKED · FIND IN SHOP</b>')+
      '</article>';
    }).join('')+'</div>';
  }

  function renderMail(){
    const claimed=state.claimedMail.includes('s2-welcome');
    return '<article class="s2-mail">'+
      '<div class="s2-mail-icon">✉</div><div><small>SEASON 02 TEAM</small><strong>WELCOME TO SEASON 2</strong>'+
      '<p>The new 1V1 Arena and S2 lobby systems are live. This reward can be claimed once on this device.</p></div>'+
      (claimed?'<b class="s2-state good">CLAIMED</b>':button('CLAIM +200','mail:s2-welcome'))+
    '</article>';
  }

  function rankName(){
    const score=playerStats.wins*12+playerStats.kills+playerStats.matches*2;
    if(score>=250) return 'DIAMOND';
    if(score>=140) return 'PLATINUM';
    if(score>=70) return 'GOLD';
    if(score>=25) return 'SILVER';
    return 'BRONZE';
  }

  function renderRank(){
    const s=playerStats;
    return '<section class="s2-rank-card"><small>LOCAL S2 RANK</small><h2>'+rankName()+'</h2>'+
      '<div class="s2-stat-strip"><span><b>'+s.matches+'</b>MATCHES</span><span><b>'+s.wins+'</b>WINS</span><span><b>'+s.kills+'</b>KILLS</span></div>'+
      '<p>This rank uses match history stored on this device. Global leaderboard needs a server leaderboard API.</p></section>';
  }

  function renderClan(){
    return '<section class="s2-form-card"><small>LOCAL CLAN PROFILE</small><h2>'+(state.clanTag?'['+escapeHtml(state.clanTag)+']':'NO CLAN TAG')+'</h2>'+
      '<p>Set a short local clan tag. Shared clan membership will require backend tables/realtime.</p>'+
      '<div class="s2-input-row"><input id="s2ClanInput" maxlength="5" value="'+escapeHtml(state.clanTag)+'" placeholder="TAG" />'+button('SAVE','save-clan')+'</div></section>';
  }

  function renderSecurity(){
    return '<div class="s2-grid">'+
      '<article class="s2-tile"><small>LOCAL DATA</small><strong>S2 SAVE</strong><p>Theme, cards, region and rewards are stored locally. Match statistics are displayed in Profile.</p>'+button('EXPORT SUMMARY','copy-diagnostics')+'</article>'+
      '<article class="s2-tile"><small>RESET</small><strong>LOCAL S2 DATA</strong><p>Clears only S2 hub data on this device. Game settings and account data remain separate.</p>'+button('RESET S2 DATA','reset-s2','danger')+'</article>'+
    '</div>';
  }

  function renderRegion(){
    const regions=['ASIA','EUROPE','NORTH AMERICA'];
    return '<div class="s2-grid">'+regions.map(region=>
      '<article class="s2-tile '+(state.region===region?'selected':'')+'"><small>MATCH REGION</small><strong>'+region+'</strong>'+
      '<p>Saved preference for future server matchmaking.</p>'+button(state.region===region?'SELECTED':'SELECT','region:'+region,state.region===region?'muted':'')+'</article>'
    ).join('')+'</div><div class="s2-note">Current Supabase 1V1 prototype does not route rooms by region yet.</div>';
  }

  function renderCreate(){
    const studio=document.getElementById('studioBtn');
    const allowed=studio && !studio.classList.contains('hidden');
    return '<section class="s2-form-card"><small>CREATOR ACCESS</small><h2>MINI 3D STUDIO</h2>'+
      '<p>Build maps, GUI and game data in the private Studio workspace.</p>'+
      (allowed?button('OPEN STUDIO','open-studio'):'<b class="s2-state">AUTHORIZED STUDIO ROLE REQUIRED</b>')+
    '</section>';
  }

  function renderClub(){
    return '<section class="s2-form-card"><small>SOCIAL</small><h2>FRIENDS & CLUB</h2>'+
      '<p>Use Player ID to add friends, see online status and send 1V1 invites.</p>'+
      button('OPEN FRIENDS','open-friends')+
    '</section>';
  }

  function renderTournament(){
    return '<section class="s2-form-card"><small>SEASON 02</small><h2>ARENA CUP</h2>'+
      '<p>Format: 1V1 · 10 minutes · first to 40 kills. Local registration is saved on this device.</p>'+
      (state.tournamentRegistered
        ? '<b class="s2-state good">REGISTERED LOCALLY</b>'
        : button('REGISTER','register-tournament'))+
      '<div class="s2-note">Online brackets, opponents and results require tournament backend services.</div>'+
    '</section>';
  }

  function renderEsports(){
    return '<div class="s2-grid">'+
      '<article class="s2-tile"><small>S2 FORMAT</small><strong>1V1 ARENA</strong><p>10:00 · 40 kill limit · LMG-5 · 3s respawn · 3s shield.</p></article>'+
      '<article class="s2-tile"><small>COMPETITIVE</small><strong>FAIR PLAY</strong><p>Pause is disabled in 1V1 and the match timer uses real elapsed time.</p></article>'+
    '</div>';
  }

  function renderModes(){
    return '<div class="s2-grid">'+
      '<article class="s2-tile selected"><small>CLASSIC</small><strong>SOLO</strong><p>Green Valley · 1 player + 29 bots.</p>'+button('SELECT SOLO','choose-solo')+'</article>'+
      '<article class="s2-tile"><small>MULTIPLAYER</small><strong>1V1 ARENA</strong><p>Invite an online friend. 10 minutes · first to 40 kills · LMG-5.</p>'+button('OPEN FRIENDS','open-friends')+'</article>'+
      '<article class="s2-tile"><small>CO-OP</small><strong>FRIEND / TEAM</strong><p>The current online prototype supports 1V1 rooms. Full team matchmaking still needs multiplayer backend expansion.</p><b class="s2-state">BACKEND EXPANSION NEEDED</b></article>'+
    '</div>';
  }

  function renderWiki(){
    return '<div class="s2-grid">'+
      '<article class="s2-tile"><small>MODE</small><strong>BATTLE ROYALE</strong><p>Green Valley · 1 player + 29 bots · loot, vehicles and shrinking zone.</p></article>'+
      '<article class="s2-tile"><small>MODE</small><strong>1V1 ARENA</strong><p>10 minutes. First to 40 kills wins. At time limit, highest kills wins.</p></article>'+
      '<article class="s2-tile"><small>PC</small><strong>CONTROLS</strong><p>WASD move · Mouse aim · LMB fire · RMB ADS · R reload.</p></article>'+
      '<article class="s2-tile"><small>MOBILE</small><strong>CONTROLS</strong><p>Move pad · look area · FIRE · RLD. HUD layout can be customized in Settings.</p></article>'+
    '</div>';
  }

  function diagnosticsText(){
    return [
      'Mini 3D Battle · Season 2',
      'Theme: '+state.theme,
      'Region: '+state.region,
      'Profile Matches: '+playerStats.matches,
      'Profile Wins: '+playerStats.wins,
      'Profile Kills: '+playerStats.kills,
      'Profile Title: '+rankName(),
      'Browser: '+navigator.userAgent
    ].join('\n');
  }

  function renderSupport(){
    return '<section class="s2-form-card"><small>SELF SERVICE</small><h2>DIAGNOSTICS</h2>'+
      '<p>Copy a small local diagnostic summary for bug reports. It does not include passwords or authentication tokens.</p>'+
      button('COPY DIAGNOSTICS','copy-diagnostics')+
      '<h3 class="s2-section-title">QUICK CHECK</h3>'+
      '<div class="s2-status-list"><span>WEBGL <b>'+(window.WebGLRenderingContext?'READY':'UNAVAILABLE')+'</b></span>'+
      '<span>LOCAL SAVE <b>'+(typeof localStorage!=='undefined'?'READY':'UNAVAILABLE')+'</b></span>'+
      '<span>ONLINE <b>'+(navigator.onLine?'YES':'NO')+'</b></span></div>'+
    '</section>';
  }

  function renderRecall(){
    const claimed=state.claimedRecallDate===todayKey();
    return '<section class="s2-form-card"><small>DAILY RETURN</small><h2>RECALL REWARD</h2>'+
      '<p>One local reward per calendar day on this device.</p>'+
      (claimed?'<b class="s2-state good">TODAY CLAIMED</b>':button('CLAIM +50','claim-recall'))+
    '</section>';
  }

  function renderCrate(){
    const canOpen=state.credits>=50;
    return '<section class="s2-form-card"><small>S2 CRATE</small><h2>SUPPLY CRATE</h2>'+
      '<p>Costs 50 local S2 credits. Opening a crate advances the local crate counter; no paid currency is used.</p>'+
      '<div class="s2-stat-strip"><span><b>'+state.crateOpened+'</b>OPENED</span><span><b>'+state.credits+'</b>CREDITS</span></div>'+
      (canOpen?button('OPEN · 50','open-crate'): '<b class="s2-state">NEED 50 CREDITS</b>')+
    '</section>';
  }

  function renderShop(){
    const products=[
      {id:'gold',name:'GOLD BADGE',price:150,desc:'Local cosmetic badge.'},
      {id:'crimson',name:'CRIMSON TAG',price:100,desc:'Local arena accent.'}
    ];

    return '<div class="s2-grid">'+
      '<article class="s2-tile '+(state.equippedItem==='field'?'selected':'')+'"><small>OWNED</small><strong>FIELD KIT</strong><p>Included with Season 2.</p>'+button(state.equippedItem==='field'?'EQUIPPED':'EQUIP','item:field',state.equippedItem==='field'?'muted':'')+'</article>'+
      products.map(product=>{
        const owned=state.ownedItems.includes(product.id);
        const equipped=state.equippedItem===product.id;
        let action;
        if(equipped) action=button('EQUIPPED','item:'+product.id,'muted');
        else if(owned) action=button('EQUIP','item:'+product.id);
        else action=button(
          state.credits>=product.price?'BUY · '+product.price:'NEED '+product.price,
          'shop:'+product.id,
          state.credits>=product.price?'':'muted'
        );

        return '<article class="s2-tile '+(equipped?'selected':'')+'"><small>'+(owned?'OWNED':product.price+' CREDITS')+'</small><strong>'+product.name+'</strong><p>'+product.desc+'</p>'+action+'</article>';
      }).join('')+
    '</div><div class="s2-note">This catalog uses only local S2 credits and does not process real-money purchases.</div>';
  }

  function renderPage(page){
    activePage=PAGE_META[page]?page:'season';
    setPageMeta(activePage);

    const renderer={
      theme:renderTheme,
      season:renderSeason,
      workshop:renderWorkshop,
      cards:renderCards,
      inventory:renderInventory,
      mail:renderMail,
      clan:renderClan,
      rank:renderRank,
      security:renderSecurity,
      region:renderRegion,
      create:renderCreate,
      club:renderClub,
      tournament:renderTournament,
      esports:renderEsports,
      wiki:renderWiki,
      support:renderSupport,
      recall:renderRecall,
      crate:renderCrate,
      shop:renderShop,
      modes:renderModes
    }[activePage]||renderSeason;

    if(content()) content().innerHTML=renderer();
    renderHeader();
  }

  function open(page='season'){
    if(page==='rank' || page==='profile'){
      window.Mini3DProfile?.openProfile?.();
      return;
    }

    if(page==='friends'){
      window.Mini3DProfile?.openFriends?.();
      return;
    }

    if(!overlay()) return;
    renderPage(page);
    overlay().classList.remove('hidden');
    overlay().setAttribute('aria-hidden','false');
  }

  function close(){
    overlay()?.classList.add('hidden');
    overlay()?.setAttribute('aria-hidden','true');
  }

  function toast(message){
    const el=$('lobbyTabToast');
    if(!el) return;
    el.textContent=message;
    el.classList.remove('hidden');
    clearTimeout(el._hideTimer);
    el._hideTimer=setTimeout(()=>el.classList.add('hidden'),1100);
  }

  function claimOnce(collection,id,reward){
    if(collection.includes(id)) return false;
    collection.push(id);
    state.credits+=reward;
    save();
    renderPage(activePage);
    toast('+'+reward+' S2 CREDITS');
    return true;
  }

  async function handleAction(action){
    if(!action) return;
    const [kind,...rest]=action.split(':');
    const value=rest.join(':');

    if(kind==='theme'){
      state.theme=value;
      save();
      renderPage(activePage);
      return;
    }

    if(kind==='weapon'){
      state.favoriteWeapon=value;
      save();
      renderPage(activePage);
      return;
    }

    if(kind==='card'){
      state.equippedCard=value;
      save();
      renderPage(activePage);
      return;
    }

    if(kind==='item'){
      if(!state.ownedItems.includes(value)) return;
      state.equippedItem=value;
      save();
      renderPage(activePage);
      return;
    }

    if(kind==='region'){
      state.region=value;
      save();
      renderPage(activePage);
      return;
    }

    if(kind==='claim-mission'){
      const rewards={'play-1':50,'kills-10':100,'win-1':150};
      claimOnce(state.claimedMissions,value,rewards[value]||0);
      return;
    }

    if(kind==='claim-season'){
      const rewards={rookie:75,hunter:125,winner:200};
      claimOnce(state.claimedSeason,value,rewards[value]||0);
      return;
    }

    if(kind==='mail'){
      claimOnce(state.claimedMail,value,200);
      return;
    }

    if(action==='save-clan'){
      const input=$('s2ClanInput');
      state.clanTag=String(input?.value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);
      save();
      renderPage(activePage);
      toast('CLAN TAG SAVED');
      return;
    }

    if(action==='register-tournament'){
      state.tournamentRegistered=true;
      save();
      renderPage(activePage);
      return;
    }

    if(action==='claim-recall'){
      if(state.claimedRecallDate!==todayKey()){
        state.claimedRecallDate=todayKey();
        state.credits+=50;
        save();
        renderPage(activePage);
        toast('+50 S2 CREDITS');
      }
      return;
    }

    if(action==='open-crate'){
      if(state.credits<50) return;
      state.credits-=50;
      state.crateOpened++;
      state.credits+=25;
      save();
      renderPage(activePage);
      toast('CRATE OPENED · +25 CREDITS');
      return;
    }

    if(kind==='shop'){
      const prices={gold:150,crimson:100};
      const price=prices[value]||0;

      if(state.ownedItems.includes(value)){
        state.equippedItem=value;
        save();
        renderPage(activePage);
        return;
      }

      if(state.credits<price) return;
      state.credits-=price;
      state.ownedItems.push(value);
      state.equippedItem=value;
      save();
      renderPage(activePage);
      toast('PURCHASED '+value.toUpperCase());
      return;
    }

    if(action==='open-studio'){
      window.location.href='./studio/';
      return;
    }

    if(action==='open-modes'){
      renderPage('modes');
      return;
    }

    if(action==='open-create'){
      renderPage('create');
      return;
    }

    if(action==='open-theme'){
      renderPage('theme');
      return;
    }

    if(action==='open-workshop'){
      renderPage('workshop');
      return;
    }

    if(action==='open-profile'){
      close();
      window.Mini3DProfile?.openProfile?.();
      return;
    }

    if(action==='choose-solo'){
      close();
      document.querySelector('.mode-card[data-mode="solo"]')?.click();
      return;
    }

    if(action==='open-friends'){
      close();
      window.Mini3DProfile?.openFriends?.();
      return;
    }

    if(action==='copy-diagnostics'){
      try{
        await navigator.clipboard.writeText(diagnosticsText());
        toast('DIAGNOSTICS COPIED');
      }catch{
        toast('COPY UNAVAILABLE');
      }
      return;
    }

    if(action==='reset-s2'){
      if(!confirm('Reset local Season 2 hub data on this device?')) return;
      state=defaults();
      save();
      renderPage('security');
      toast('S2 LOCAL DATA RESET');
    }
  }

  function recordMatch({mode='solo',result='lose',kills=0}={}){
    const k=Math.max(0,Math.floor(Number(kills)||0));
    playerStats.matches++;
    playerStats.kills+=k;

    if(result==='win'){
      playerStats.wins++;
      if(mode==='1v1') playerStats.duelWins++;
      else playerStats.soloWins++;
    }

    localStorage.setItem(PROFILE_STATS_KEY,JSON.stringify(playerStats));

    state.credits+=10+Math.min(40,k);
    save();

    document.dispatchEvent(new CustomEvent('mini3d:profile-stats-updated',{
      detail:{...playerStats}
    }));
  }

  function bind(){
    $('s2HubClose')?.addEventListener('click',close);
    overlay()?.addEventListener('click',event=>{
      if(event.target===overlay()) close();
    });

    content()?.addEventListener('click',event=>{
      const target=event.target.closest('[data-s2-action]');
      if(target) handleAction(target.dataset.s2Action);
    });

    addEventListener('keydown',event=>{
      if(event.key==='Escape' && overlay() && !overlay().classList.contains('hidden')) close();
    });

    document.querySelector('[data-shortcut="crate"]')?.addEventListener('click',()=>open('crate'));
    document.querySelector('[data-shortcut="rank"]')?.addEventListener('click',()=>open('rank'));
    document.querySelector('[data-shortcut="shop"]')?.addEventListener('click',()=>open('shop'));

    document.querySelector('.event-banner')?.addEventListener('click',()=>open('season'));
    document.querySelector('.match-mode-card')?.addEventListener('click',()=>open('modes'));

    applyLobbyState();
    renderHeader();
  }

  window.Mini3DLobbyHub={open,close,renderPage,getState:()=>clone(state)};
  window.Mini3DS2={recordMatch,getState:()=>clone(state)};
  window.Mini3DProfileStats={getState:()=>clone(playerStats)};

  bind();
})();
