import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import CallFriendButton from '../components/CallFriendButton';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function api(path, token, options = {}) {
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  }).then((r) => r.json());
}

export default function FriendsPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends]     = useState([]);
  const [requests, setRequests]   = useState([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError]   = useState('');
  const [tab, setTab] = useState('friends');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [fd, rq] = await Promise.all([
        api('/api/friends', token),
        api('/api/friends/requests', token),
      ]);
      setFriends(fd.friends || []);
      setRequests(rq.requests || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const searchUser = async () => {
    setSearchResult(null); setSearchError('');
    if (!searchEmail.trim()) return;
    const data = await api(`/api/users/search?email=${encodeURIComponent(searchEmail)}`, token);
    if (data.error) setSearchError(data.error);
    else setSearchResult(data.user);
  };

  const sendRequest = async (toId) => {
    const data = await api('/api/friends/request', token, {
      method: 'POST', body: JSON.stringify({ toId }),
    });
    if (data.error) setMsg(`⚠ ${data.error}`);
    else { setMsg('✓ Friend request sent!'); setSearchResult(null); setSearchEmail(''); }
    setTimeout(() => setMsg(''), 3000);
  };

  const respond = async (fromId, action) => {
    await api('/api/friends/respond', token, {
      method: 'POST', body: JSON.stringify({ fromId, action }),
    });
    await load();
  };

  const removeFriend = async (friendId) => {
    await api(`/api/friends/${friendId}`, token, { method: 'DELETE' });
    await load();
  };

  const formatLastSeen = (d) => {
    if (!d) return 'Never';
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-accent opacity-[0.03] blur-[100px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-7 h-7 relative">
            <div className="absolute inset-0 border-2 border-accent rotate-45" />
            <div className="absolute inset-[4px] bg-accent rotate-45" />
          </div>
          <span className="font-display text-accent text-base tracking-widest">PLEXUSTALK</span>
        </Link>
        <Link to="/" className="font-display text-xs text-muted hover:text-white tracking-widest uppercase transition-colors">← HOME</Link>
      </header>

      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 border border-accent/20 px-4 py-1.5 mb-4 text-accent font-display text-xs tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            CONTACTS
          </div>
          <h1 className="font-display text-3xl text-white">FRIENDS</h1>
        </div>

        {/* Search */}
        <div className="terminal-border bg-panel/80 p-6 mb-6">
          <p className="font-display text-xs text-accent/60 tracking-widest mb-4">ADD FRIEND BY EMAIL</p>
          <div className="flex gap-3">
            <input
              value={searchEmail}
              onChange={(e) => { setSearchEmail(e.target.value); setSearchResult(null); setSearchError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && searchUser()}
              placeholder="friend@example.com"
              className="flex-1 bg-void border border-border text-white font-body text-sm px-4 py-3 outline-none focus:border-accent/50 transition-all"
            />
            <button onClick={searchUser} className="btn-primary px-6">SEARCH</button>
          </div>

          {searchError && <p className="font-body text-sm text-warn mt-3">⚠ {searchError}</p>}
          {msg && <p className="font-body text-sm text-accent mt-3">{msg}</p>}

          {searchResult && (
            <div className="flex items-center justify-between mt-4 p-4 border border-accent/20 bg-accent/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
                  <span className="font-display text-sm text-accent">
                    {searchResult.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-display text-sm text-white">{searchResult.name}</p>
                  <p className="font-body text-xs text-muted">{searchResult.email}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${searchResult.isOnline ? 'bg-accent' : 'bg-muted'}`} />
              </div>
              <button onClick={() => sendRequest(searchResult.id)} className="btn-secondary text-xs py-2 px-4">
                + ADD FRIEND
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6">
          {[
            { key: 'friends',  label: `FRIENDS (${friends.length})` },
            { key: 'requests', label: `REQUESTS (${requests.length})` },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-6 py-3 font-display text-xs tracking-widest uppercase transition-all ${
                tab === t.key ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-white'
              }`}>
              {t.label}
              {t.key === 'requests' && requests.length > 0 && (
                <span className="ml-2 w-4 h-4 rounded-full bg-warn text-void text-xs inline-flex items-center justify-center">
                  {requests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Friends list */}
        {tab === 'friends' && (
          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            ) : friends.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <span className="font-display text-5xl text-border">◈</span>
                <span className="font-display text-xs text-muted/40 tracking-widest">NO FRIENDS YET — ADD ONE ABOVE</span>
              </div>
            ) : (
              friends.map((f) => (
                <div key={f._id} className="terminal-border bg-panel/60 p-5 flex items-center justify-between hover:bg-panel/80 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                        <span className="font-display text-lg text-accent">{f.name?.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-panel ${f.isOnline ? 'bg-accent' : 'bg-muted'}`} />
                    </div>
                    <div>
                      <p className="font-display text-sm text-white">{f.name}</p>
                      <p className="font-body text-xs text-muted">{f.email}</p>
                      <p className="font-display text-xs text-muted/50 mt-0.5">
                        {f.isOnline ? <span className="text-accent">● ONLINE</span> : `Last seen ${formatLastSeen(f.lastSeen)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                        <CallFriendButton friend={f} callType="p2p" />
                        <button onClick={() => removeFriend(f._id)}
                       className="border border-warn/30 text-warn/60 hover:text-warn hover:border-warn/60 font-display text-xs tracking-widest px-3 py-2 transition-all">
                     REMOVE
                  </button>
               </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Friend requests */}
        {tab === 'requests' && (
          <div className="flex flex-col gap-3">
            {requests.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <span className="font-display text-5xl text-border">◈</span>
                <span className="font-display text-xs text-muted/40 tracking-widest">NO PENDING REQUESTS</span>
              </div>
            ) : (
              requests.map((r) => (
                <div key={r._id} className="terminal-border bg-panel/60 p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-info/20 border border-info/30 flex items-center justify-center">
                      <span className="font-display text-lg text-info">{r.from?.name?.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-display text-sm text-white">{r.from?.name}</p>
                      <p className="font-body text-xs text-muted">{r.from?.email}</p>
                      <p className="font-display text-xs text-info/60 mt-0.5">WANTS TO BE FRIENDS</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => respond(r.from._id, 'accept')}
                      className="btn-primary text-xs py-2 px-4">✓ ACCEPT</button>
                    <button onClick={() => respond(r.from._id, 'reject')}
                      className="border border-warn/30 text-warn font-display text-xs tracking-widest px-3 py-2 hover:bg-warn/10 transition-all">
                      ✕ REJECT
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
