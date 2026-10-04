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

const ui = {
  overlay: $('profileOverlay'),
  close: $('profileClose'),
  signIn: $('profileGoogleSignIn'),
  signOut: $('profileSignOut'),
  avatar: $('profileAvatar'),
  name: $('profileName'),
  id: $('profilePlayerId'),
  copyId: $('profileCopyId'),
  backend: $('profileBackendState'),
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

function openProfile() {
  ui.overlay?.classList.remove('hidden');
  if (configured && session) refreshAll();
}

function closeProfile() {
  ui.overlay?.classList.add('hidden');
}

function setStatus(message, type='') {
  if (!ui.backend) return;
  ui.backend.textContent = message;
  ui.backend.dataset.state = type;
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
  setStatus('INVITE SENT · ROOM ' + (result?.room_code || ''), 'ok');
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
    setStatus('JOINED ROOM ' + (data || ''), 'ok');
    document.dispatchEvent(new CustomEvent('mini3d:room-join', {
      detail:{ roomCode:data }
    }));
  }
}

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
        setStatus('INVITE ACCEPTED · ROOM ' + payload.new.room_code, 'ok');
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

document.querySelector('[data-shortcut="friends"]')?.addEventListener('click',openProfile);
ui.close?.addEventListener('click',closeProfile);
ui.copyId?.addEventListener('click',async()=>{
  if (!profile?.player_id) return;
  await navigator.clipboard?.writeText(profile.player_id);
  setStatus('ID COPIED', 'ok');
});
ui.addFriend?.addEventListener('click',addFriend);
ui.friendId?.addEventListener('input',()=>{
  ui.friendId.value = ui.friendId.value.replace(/\D/g,'').slice(0,8);
});
ui.inviteAccept?.addEventListener('click',()=>respondInvite(true));
ui.inviteReject?.addEventListener('click',()=>respondInvite(false));

if (!configured) {
  renderProfile();
  renderFriends();
  setStatus('BACKEND NOT CONNECTED');
  ui.signIn.disabled = true;
} else {
  supabase = createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

  ui.signIn?.addEventListener('click',async()=>{
    await supabase.auth.signInWithOAuth({
      provider:'google',
      options:{ redirectTo:window.location.origin + window.location.pathname }
    });
  });

  ui.signOut?.addEventListener('click',async()=>{
    await supabase.auth.signOut();
    closeProfile();
  });

  const { data:{ session:initialSession } } = await supabase.auth.getSession();
  await handleSession(initialSession);

  supabase.auth.onAuthStateChange((_event,nextSession)=>{
    queueMicrotask(()=>handleSession(nextSession));
  });
}
