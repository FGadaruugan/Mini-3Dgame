import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const $ = id => document.getElementById(id);
const configured =
  /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) &&
  typeof SUPABASE_PUBLISHABLE_KEY === 'string' &&
  SUPABASE_PUBLISHABLE_KEY.length > 20;

let supabase = null;
let session = null;
let profile = null;
let friends = [];
let onlineUsers = new Set();
let presenceChannel = null;
let realtimeChannel = null;
let matchChannel = null;
let currentRoomCode = null;
let matchRole = null;
let peerProfile = null;

const ui = {
  overlay: $('profileOverlay'),
  close: $('profileClose'),
  friendsOverlay: $('friendsOverlay'),
  friendsClose: $('friendsClose'),
  friendsOpenProfile: $('friendsOpenProfile'),
  profileOpenFriends: $('profileOpenFriends'),
  signIn: $('profileGoogleSignIn'),
  signOut: $('profileSignOut'),
  avatar: $('profileAvatar'),
  name: $('profileName'),
  id: $('profilePlayerId'),
  copyId: $('profileCopyId'),
  backend: $('profileBackendState'),
  friendsBackend: $('friendsBackendState'),
  matches: $('profileMatches'),
  wins: $('profileWins'),
  kills: $('profileKills'),
  soloWins: $('profileSoloWins'),
  duelWins: $('profileDuelWins'),
  friendId: $('friendIdInput'),
  addFriend: $('addFriendBtn'),
  friends: $('friendsList'),
  requests: $('friendRequestsList'),
  emptyFriends: $('friendsEmpty'),
  emptyRequests: $('requestsEmpty'),
  inviteToast: $('inviteToast'),
  inviteText: $('inviteText'),
  inviteAccept: $('inviteAccept'),
  inviteReject: $('inviteReject'),
  friendsCount: document.querySelector('[data-shortcut="friends"] small')
};

function getLocalStats() {
  const raw=window.Mini3DProfileStats?.getState?.() || {};
  return {
    matches:Math.max(0,Number(raw.matches)||0),
    wins:Math.max(0,Number(raw.wins)||0),
    kills:Math.max(0,Number(raw.kills)||0),
    soloWins:Math.max(0,Number(raw.soloWins)||0),
    duelWins:Math.max(0,Number(raw.duelWins)||0)
  };
}

function renderProfileStats() {
  const stats=getLocalStats();
  if(ui.matches) ui.matches.textContent=String(stats.matches);
  if(ui.wins) ui.wins.textContent=String(stats.wins);
  if(ui.kills) ui.kills.textContent=String(stats.kills);
  if(ui.soloWins) ui.soloWins.textContent=String(stats.soloWins);
  if(ui.duelWins) ui.duelWins.textContent=String(stats.duelWins);
}

function openProfile() {
  ui.friendsOverlay?.classList.add('hidden');
  ui.overlay?.classList.remove('hidden');
  renderProfileStats();
  if (configured && session) refreshProfile();
}

function closeProfile() {
  ui.overlay?.classList.add('hidden');
}

function openFriends() {
  ui.overlay?.classList.add('hidden');
  ui.friendsOverlay?.classList.remove('hidden');
  if (configured && session) {
    Promise.all([refreshFriends(),refreshRequests()]);
  }
}

function closeFriends() {
  ui.friendsOverlay?.classList.add('hidden');
}

function getAccountState() {
  return {
    configured,
    signedIn:Boolean(session),
    displayName:profile?.display_name || (session?'Player':'Guest Player'),
    playerId:profile?.player_id || null,
    avatarUrl:profile?.avatar_url || null,
    status:ui.backend?.textContent || (session?'ONLINE':'NOT SIGNED IN')
  };
}

function dispatchAccountUpdated() {
  document.dispatchEvent(new CustomEvent('mini3d:account-updated',{
    detail:getAccountState()
  }));
}

async function copyPlayerId() {
  if(!profile?.player_id) return false;
  try{
    await navigator.clipboard?.writeText(profile.player_id);
    setStatus('ID COPIED','ok');
    return true;
  }catch{
    return false;
  }
}

async function signInWithGoogle() {
  if(!configured || !supabase) {
    setStatus('GOOGLE LOGIN NOT CONFIGURED','error');
    return false;
  }

  setStatus('OPENING GOOGLE SIGN-IN…');
  const {error}=await supabase.auth.signInWithOAuth({
    provider:'google',
    options:{redirectTo:window.location.origin + window.location.pathname}
  });

  if(error){
    setStatus('GOOGLE LOGIN NOT CONFIGURED','error');
    return false;
  }
  return true;
}

async function signOutAccount() {
  if(!supabase) return false;
  await supabase.auth.signOut();
  closeProfile();
  closeFriends();
  return true;
}

function setStatus(message, type='') {
  [ui.backend,ui.friendsBackend].forEach(el=>{
    if(!el) return;
    el.textContent=message;
    el.dataset.state=type;
  });
  dispatchAccountUpdated();
}

function updateTopProfile() {
  const name = profile?.display_name || (session ? 'PLAYER' : 'PLAYER 01');
  const shortId = profile?.player_id ? 'ID ' + profile.player_id : 'LV. 1';

  document.querySelectorAll('.mobile-profile strong,.lobby-player strong')
    .forEach(el => el.textContent = name);
  document.querySelectorAll('.mobile-profile small,.lobby-player small')
    .forEach(el => el.textContent = shortId);

  if (profile?.avatar_url) {
    document.querySelectorAll('.mobile-avatar,.avatar').forEach(el => {
      el.style.backgroundImage = `url("${profile.avatar_url}")`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.textContent = '';
    });
  }
}

function renderProfile() {
  if (!session) {
    ui.name.textContent = 'Guest Player';
    ui.id.textContent = '--------';
    ui.avatar.removeAttribute('src');
    ui.avatar.classList.add('no-image');
    ui.signIn.classList.remove('hidden');
    ui.signOut.classList.add('hidden');
    updateTopProfile();
    renderProfileStats();
    dispatchAccountUpdated();
    return;
  }

  ui.name.textContent = profile?.display_name || 'Player';
  ui.id.textContent = profile?.player_id || '--------';
  if (profile?.avatar_url) {
    ui.avatar.src = profile.avatar_url;
    ui.avatar.classList.remove('no-image');
  } else {
    ui.avatar.removeAttribute('src');
    ui.avatar.classList.add('no-image');
  }
  ui.signIn.classList.add('hidden');
  ui.signOut.classList.remove('hidden');
  updateTopProfile();
  renderProfileStats();
  dispatchAccountUpdated();
}

function renderFriends() {
  if (!ui.friends) return;
  ui.friends.innerHTML = '';

  for (const friend of friends) {
    const online = onlineUsers.has(friend.id);
    const row = document.createElement('div');
    row.className = 'friend-row';
    row.innerHTML = `
      <div class="friend-avatar">${friend.avatar_url ? `<img src="${friend.avatar_url}" alt="" />` : '<span>P</span>'}</div>
      <div class="friend-copy">
        <strong>${escapeHtml(friend.display_name || 'Player')}</strong>
        <small>ID ${friend.player_id}</small>
      </div>
      <div class="friend-state ${online ? 'online' : ''}">
        <i></i><span>${online ? 'ONLINE' : 'OFFLINE'}</span>
      </div>
      <button class="friend-invite" ${online ? '' : 'disabled'} data-friend-id="${friend.id}">
        INVITE
      </button>
    `;
    ui.friends.appendChild(row);
  }

  ui.emptyFriends?.classList.toggle('hidden', friends.length > 0);
  if (ui.friendsCount) ui.friendsCount.textContent = friends.length + '/25';

  ui.friends.querySelectorAll('.friend-invite').forEach(btn => {
    btn.addEventListener('click', () => sendInvite(btn.dataset.friendId));
  });
}

async function refreshProfile() {
  if (!supabase || !session) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('id,player_id,display_name,avatar_url')
    .eq('id', session.user.id)
    .single();

  if (error) {
    setStatus('PROFILE ERROR', 'error');
    return;
  }
  profile = data;
  renderProfile();
}

async function refreshFriends() {
  if (!supabase || !session) return;

  const { data: links, error } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', session.user.id);

  if (error) {
    setStatus('FRIENDS ERROR', 'error');
    return;
  }

  const ids = (links || []).map(x => x.friend_id);
  if (!ids.length) {
    friends = [];
    renderFriends();
    return;
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id,player_id,display_name,avatar_url')
    .in('id', ids);

  if (profileError) {
    setStatus('FRIENDS ERROR', 'error');
    return;
  }

  friends = profiles || [];
  renderFriends();
}

async function refreshRequests() {
  if (!supabase || !session || !ui.requests) return;

  const { data: requests, error } = await supabase
    .from('friend_requests')
    .select('id,sender_id,created_at')
    .eq('receiver_id', session.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending:false });

  if (error) return;

  ui.requests.innerHTML = '';
  const senderIds = [...new Set((requests || []).map(x => x.sender_id))];
  let senderMap = new Map();

  if (senderIds.length) {
    const { data: senders } = await supabase
      .from('profiles')
      .select('id,player_id,display_name,avatar_url')
      .in('id', senderIds);
    senderMap = new Map((senders || []).map(x => [x.id,x]));
  }

  for (const request of requests || []) {
    const sender = senderMap.get(request.sender_id);
    const row = document.createElement('div');
    row.className = 'request-row';
    row.innerHTML = `
      <div class="friend-copy">
        <strong>${escapeHtml(sender?.display_name || 'Player')}</strong>
        <small>ID ${sender?.player_id || '--------'}</small>
      </div>
      <button class="request-accept" data-id="${request.id}">ACCEPT</button>
      <button class="request-reject" data-id="${request.id}">×</button>
    `;
    ui.requests.appendChild(row);
  }

  ui.emptyRequests?.classList.toggle('hidden', (requests || []).length > 0);

  ui.requests.querySelectorAll('.request-accept').forEach(btn => {
    btn.addEventListener('click', () => respondFriendRequest(btn.dataset.id, true));
  });
  ui.requests.querySelectorAll('.request-reject').forEach(btn => {
    btn.addEventListener('click', () => respondFriendRequest(btn.dataset.id, false));
  });
}

async function refreshAll() {
  await refreshProfile();
  await Promise.all([refreshFriends(), refreshRequests()]);
}

async function addFriend() {
  if (!supabase || !session) {
    setStatus('SIGN IN FIRST', 'error');
    return;
  }

  const playerId = (ui.friendId?.value || '').trim();
  if (!/^\d{8}$/.test(playerId)) {
    setStatus('ENTER AN 8-DIGIT ID', 'error');
    return;
  }

  ui.addFriend.disabled = true;
  const { error } = await supabase.rpc('send_friend_request', {
    target_player_id: playerId
  });
  ui.addFriend.disabled = false;

  if (error) {
    setStatus(error.message.toUpperCase().slice(0,48), 'error');
    return;
  }

  ui.friendId.value = '';
  setStatus('FRIEND REQUEST SENT', 'ok');
}

async function respondFriendRequest(requestId, accept) {
  const { error } = await supabase.rpc('respond_friend_request', {
    request_id: requestId,
    accept_request: accept
  });

  if (error) {
    setStatus(error.message.toUpperCase().slice(0,48), 'error');
    return;
  }

  setStatus(accept ? 'FRIEND ADDED' : 'REQUEST REMOVED', 'ok');
  await Promise.all([refreshFriends(), refreshRequests()]);
}

async function sendInvite(friendId) {
  if (!onlineUsers.has(friendId)) {
    setStatus('FRIEND IS OFFLINE', 'error');
    return;
  }

  const { data, error } = await supabase.rpc('send_match_invite', {
    target_friend_id: friendId
  });

  if (error) {
    setStatus(error.message.toUpperCase().slice(0,48), 'error');
    return;
  }

  const result = Array.isArray(data) ? data[0] : data;
  currentRoomCode = result?.room_code || null;
  matchRole = 'host';
  peerProfile = friends.find(friend => friend.id === friendId) || null;
  setStatus('INVITE SENT · ROOM ' + (currentRoomCode || ''), 'ok');
}

function showIncomingInvite(payload) {
  const invite = payload.new;
  if (!invite || invite.receiver_id !== session?.user.id) return;

  ui.inviteToast.dataset.inviteId = invite.id;
  ui.inviteText.textContent = 'MATCH INVITE · ROOM ' + invite.room_code;
  ui.inviteToast.classList.remove('hidden');
}

async function respondInvite(accept) {
  const inviteId = ui.inviteToast?.dataset.inviteId;
  if (!inviteId || !supabase) return;

  const { data, error } = await supabase.rpc('respond_match_invite', {
    invite_id: inviteId,
    accept_invite: accept
  });

  if (error) {
    setStatus(error.message.toUpperCase().slice(0,48), 'error');
    return;
  }

  ui.inviteToast.classList.add('hidden');
  if (accept) {
    closeProfile();
    closeFriends();
    currentRoomCode = data || '';
    matchRole = 'guest';
    setStatus('JOINING ROOM ' + currentRoomCode, 'ok');
    await joinMatchRoom(currentRoomCode, 'guest');
  }
}

async function joinMatchRoom(roomCode, role) {
  if (!supabase || !session || !profile || !roomCode) return;

  currentRoomCode = String(roomCode);
  matchRole = role || matchRole || 'guest';

  if (matchChannel) {
    await supabase.removeChannel(matchChannel);
    matchChannel = null;
  }

  matchChannel = supabase.channel('mini3d-match-' + currentRoomCode, {
    config:{
      broadcast:{ self:false, ack:false },
      presence:{ key:session.user.id }
    }
  });

  matchChannel
    .on('broadcast',{ event:'game-state' },({ payload })=>{
      if (!payload || payload.userId === session.user.id) return;
      document.dispatchEvent(new CustomEvent('mini3d:net-state',{ detail:payload }));
    })
    .on('broadcast',{ event:'shot' },({ payload })=>{
      if (!payload || payload.userId === session.user.id) return;
      document.dispatchEvent(new CustomEvent('mini3d:net-shot',{ detail:payload }));
    })
    .on('broadcast',{ event:'damage' },({ payload })=>{
      if (!payload || payload.targetUserId !== session.user.id) return;
      document.dispatchEvent(new CustomEvent('mini3d:net-damage',{ detail:payload }));
    })
    .on('presence',{ event:'sync' },()=>{
      const state=matchChannel.presenceState();
      const players=Object.values(state).flat();
      document.dispatchEvent(new CustomEvent('mini3d:room-presence',{
        detail:{ roomCode:currentRoomCode,players }
      }));
    })
    .subscribe(async status=>{
      if (status !== 'SUBSCRIBED') return;

      await matchChannel.track({
        user_id:session.user.id,
        player_id:profile.player_id,
        display_name:profile.display_name,
        avatar_url:profile.avatar_url || null,
        role:matchRole,
        joined_at:new Date().toISOString()
      });

      setStatus('CONNECTED · ROOM ' + currentRoomCode,'ok');

      document.dispatchEvent(new CustomEvent('mini3d:room-join',{
        detail:{
          roomCode:currentRoomCode,
          role:matchRole,
          userId:session.user.id,
          profile:{
            playerId:profile.player_id,
            displayName:profile.display_name,
            avatarUrl:profile.avatar_url || null
          },
          peer:peerProfile
        }
      }));
    });
}

window.Mini3DNet = {
  sendState(payload) {
    if (!matchChannel || !currentRoomCode || !session) return;
    matchChannel.send({
      type:'broadcast',
      event:'game-state',
      payload:{ ...payload,userId:session.user.id,roomCode:currentRoomCode }
    });
  },

  sendShot(payload) {
    if (!matchChannel || !currentRoomCode || !session) return;
    matchChannel.send({
      type:'broadcast',
      event:'shot',
      payload:{ ...payload,userId:session.user.id,roomCode:currentRoomCode }
    });
  },

  sendDamage(targetUserId,amount) {
    if (!matchChannel || !currentRoomCode || !session || !targetUserId) return;
    matchChannel.send({
      type:'broadcast',
      event:'damage',
      payload:{
        userId:session.user.id,
        targetUserId,
        amount,
        roomCode:currentRoomCode
      }
    });
  },

  leave:async function() {
    if (matchChannel && supabase) await supabase.removeChannel(matchChannel);
    matchChannel=null;
    currentRoomCode=null;
    matchRole=null;
  }
};

function subscribeRealtime() {
  if (!supabase || !session || !profile) return;

  presenceChannel?.unsubscribe();
  realtimeChannel?.unsubscribe();

  presenceChannel = supabase.channel('mini3d-online', {
    config:{ presence:{ key:session.user.id } }
  });

  const syncPresence = () => {
    const state = presenceChannel.presenceState();
    onlineUsers = new Set(Object.keys(state));
    renderFriends();
  };

  presenceChannel
    .on('presence',{ event:'sync' },syncPresence)
    .on('presence',{ event:'join' },syncPresence)
    .on('presence',{ event:'leave' },syncPresence)
    .subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          player_id: profile.player_id,
          display_name: profile.display_name,
          online_at: new Date().toISOString()
        });
      }
    });

  realtimeChannel = supabase.channel('mini3d-social-' + session.user.id)
    .on('postgres_changes',{
      event:'INSERT',
      schema:'public',
      table:'friend_requests',
      filter:'receiver_id=eq.' + session.user.id
    },()=>refreshRequests())
    .on('postgres_changes',{
      event:'INSERT',
      schema:'public',
      table:'match_invites',
      filter:'receiver_id=eq.' + session.user.id
    },showIncomingInvite)
    .on('postgres_changes',{
      event:'UPDATE',
      schema:'public',
      table:'match_invites',
      filter:'sender_id=eq.' + session.user.id
    },payload=>{
      if (payload.new?.status === 'accepted') {
        currentRoomCode = payload.new.room_code;
        matchRole = 'host';
        setStatus('FRIEND JOINED · ROOM ' + currentRoomCode, 'ok');
        joinMatchRoom(currentRoomCode,'host');
      }
    })
    .subscribe();
}

async function handleSession(nextSession) {
  session = nextSession;
  profile = null;

  if (!session) {
    friends = [];
    onlineUsers.clear();
    renderProfile();
    renderFriends();
    ui.requests.innerHTML = '';
    ui.emptyRequests?.classList.remove('hidden');
    presenceChannel?.unsubscribe();
    realtimeChannel?.unsubscribe();
    if (matchChannel && supabase) supabase.removeChannel(matchChannel);
    matchChannel=null;
    currentRoomCode=null;
    matchRole=null;
    setStatus(configured ? 'NOT SIGNED IN' : 'BACKEND NOT CONNECTED');
    return;
  }

  setStatus('ONLINE PROFILE CONNECTING…');
  await refreshAll();
  subscribeRealtime();
  setStatus('ONLINE', 'ok');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

document.querySelectorAll('.mobile-profile,.lobby-player').forEach(el => {
  el.setAttribute('role','button');
  el.tabIndex = 0;
  el.addEventListener('click',openProfile);
});

document.querySelector('[data-shortcut="friends"]')?.addEventListener('click',openFriends);
ui.close?.addEventListener('click',closeProfile);
ui.friendsClose?.addEventListener('click',closeFriends);
ui.profileOpenFriends?.addEventListener('click',openFriends);
ui.friendsOpenProfile?.addEventListener('click',openProfile);

window.Mini3DProfile={
  openProfile,
  closeProfile,
  openFriends,
  closeFriends,
  refreshStats:renderProfileStats,
  getAccountState,
  copyPlayerId,
  signIn:signInWithGoogle,
  signOut:signOutAccount
}
ui.copyId?.addEventListener('click',copyPlayerId);
ui.addFriend?.addEventListener('click',addFriend);
ui.friendId?.addEventListener('input',()=>{
  ui.friendId.value = ui.friendId.value.replace(/\D/g,'').slice(0,8);
});
ui.inviteAccept?.addEventListener('click',()=>respondInvite(true));
ui.inviteReject?.addEventListener('click',()=>respondInvite(false));

document.addEventListener('mini3d:profile-stats-updated',renderProfileStats);

if (!configured) {
  renderProfile();
  renderFriends();
  setStatus('BACKEND NOT CONNECTED');
  ui.signIn.disabled = true;
} else {
  supabase = createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

  ui.signIn?.addEventListener('click',signInWithGoogle);

  ui.signOut?.addEventListener('click',signOutAccount);

  const { data:{ session:initialSession } } = await supabase.auth.getSession();
  await handleSession(initialSession);

  supabase.auth.onAuthStateChange((_event,nextSession)=>{
    queueMicrotask(()=>handleSession(nextSession));
  });
}
