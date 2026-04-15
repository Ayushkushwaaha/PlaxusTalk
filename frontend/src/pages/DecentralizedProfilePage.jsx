import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

export default function DecentralizedProfilePage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ bio: '', avatar: '', links: { twitter: '', github: '', website: '' } });
  const [ipfsData, setIpfsData] = useState(null);
  const [profileCid, setProfileCid] = useState(null);
  const [ipfsEnabled, setIpfsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('edit');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    
    fetch(`${BACKEND_URL}/api/ipfs/profile/${user?.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.profileCid) setProfileCid(d.profileCid);
        if (d.ipfsProfile) {
          setIpfsData(d.ipfsProfile);
          setProfile({
            bio:    d.ipfsProfile.bio || '',
            avatar: d.ipfsProfile.avatar || '',
            links:  d.ipfsProfile.links || { twitter: '', github: '', website: '' },
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveToIPFS = async () => {
    setSaving(true); setMsg(''); setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/ipfs/profile`, {
        method: 'PUT', headers,
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.cid) {
        setProfileCid(data.cid);
        setMsg(`Profile stored on IPFS — CID: ${data.cid.slice(0, 20)}...`);
      } else {
        setMsg(data.message);
      }
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-info opacity-[0.03] blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-accent opacity-[0.03] blur-[100px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-7 h-7 relative">
            <div className="absolute inset-0 border-2 border-accent rotate-45" />
            <div className="absolute inset-[4px] bg-accent rotate-45" />
          </div>
          <span className="font-display text-accent text-base tracking-widest">PLEXUSTALK</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/profile" className="font-display text-xs text-muted hover:text-white tracking-widest uppercase">← PROFILE</Link>
          <button onClick={() => { logout(); navigate('/login'); }} className="font-display text-xs text-muted hover:text-warn tracking-widest uppercase transition-colors">SIGN OUT</button>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 border border-info/20 px-4 py-1.5 mb-4 text-info font-display text-xs tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-info animate-pulse" />
            DECENTRALIZED IDENTITY
          </div>
          <h1 className="font-display text-3xl text-white">YOUR WEB3 PROFILE</h1>
          <p className="font-body text-muted text-sm mt-2">Your profile data is stored on IPFS — you own it, not us.</p>
        </div>

        {/* IPFS Status */}
        <div className={`flex items-center gap-3 p-4 border mb-6 ${ipfsEnabled ? 'border-info/30 bg-info/5' : 'border-warn/30 bg-warn/5'}`}>
          <div className={`w-2 h-2 rounded-full ${ipfsEnabled ? 'bg-info animate-pulse' : 'bg-warn'}`} />
          <div>
            <p className={`font-display text-xs tracking-widest ${ipfsEnabled ? 'text-info' : 'text-warn'}`}>
              {ipfsEnabled ? 'IPFS STORAGE ACTIVE — PINATA CONNECTED' : 'IPFS NOT CONFIGURED — ADD PINATA KEYS TO .env'}
            </p>
            {!ipfsEnabled && <p className="font-body text-xs text-muted mt-0.5">Add PINATA_API_KEY and PINATA_SECRET_KEY to backend .env</p>}
          </div>
        </div>

        {/* Current CID */}
        {profileCid && (
          <div className="terminal-border bg-panel/80 p-4 mb-6">
            <p className="font-display text-xs text-accent tracking-widest mb-2">CURRENT IPFS CID</p>
            <div className="flex items-center gap-3 flex-wrap">
              <code className="font-display text-xs text-white/70 bg-void px-3 py-2 flex-1 break-all">{profileCid}</code>
              <a href={`${IPFS_GATEWAY}/${profileCid}`} target="_blank" rel="noopener noreferrer"
                className="font-display text-xs text-info border border-info/30 px-3 py-2 hover:bg-info/10 transition-colors whitespace-nowrap">
                VIEW ON IPFS ↗
              </a>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border mb-6">
          {['edit', 'preview', 'history'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-3 font-display text-xs tracking-widest uppercase transition-all ${tab === t ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-white'}`}>
              {t === 'edit' ? 'EDIT' : t === 'preview' ? 'PREVIEW' : 'IPFS HISTORY'}
            </button>
          ))}
        </div>

        {tab === 'edit' && (
          <div className="terminal-border bg-panel/80 p-8 flex flex-col gap-6">
            <div className="h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center">
                <span className="font-display text-2xl text-accent">{initials}</span>
              </div>
              <div>
                <p className="font-body text-white">{user?.name}</p>
                <p className="font-display text-xs text-muted">{user?.email}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-display text-xs text-muted tracking-widest">BIO</label>
              <textarea value={profile.bio} onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Tell the world about yourself..." rows={3}
                className="w-full bg-void border border-border text-white font-body text-sm px-4 py-3 outline-none focus:border-accent/50 transition-all resize-none" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-display text-xs text-muted tracking-widest">AVATAR URL</label>
              <input value={profile.avatar} onChange={(e) => setProfile((p) => ({ ...p, avatar: e.target.value }))}
                placeholder="https://... or ipfs://..."
                className="w-full bg-void border border-border text-white font-body text-sm px-4 py-3 outline-none focus:border-accent/50 transition-all" />
            </div>

            <div className="flex flex-col gap-3">
              <label className="font-display text-xs text-muted tracking-widest">SOCIAL LINKS</label>
              {[['twitter', 'Twitter / X'], ['github', 'GitHub'], ['website', 'Website']].map(([key, label]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="font-display text-xs text-muted w-16">{label}</span>
                  <input value={profile.links[key] || ''} onChange={(e) => setProfile((p) => ({ ...p, links: { ...p.links, [key]: e.target.value } }))}
                    placeholder={`Your ${label}`}
                    className="flex-1 bg-void border border-border text-white font-body text-sm px-4 py-2.5 outline-none focus:border-accent/50 transition-all" />
                </div>
              ))}
            </div>

            {msg && <p className="font-body text-sm text-accent">✓ {msg}</p>}
            {error && <p className="font-body text-sm text-warn">⚠ {error}</p>}

            <button onClick={saveToIPFS} disabled={saving || !ipfsEnabled}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <><span className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />UPLOADING TO IPFS...</> : '⬡ SAVE TO IPFS'}
            </button>
            {!ipfsEnabled && <p className="font-body text-xs text-muted/50 text-center">Add Pinata keys to enable IPFS storage</p>}
          </div>
        )}

        {tab === 'preview' && (
          <div className="terminal-border bg-panel/80 p-8">
            <p className="font-display text-xs text-accent/60 tracking-widest mb-6">PUBLIC PROFILE PREVIEW</p>
            <div className="flex items-start gap-5 mb-6">
              <div className="w-20 h-20 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center overflow-hidden">
                {profile.avatar ? <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" onError={(e) => e.target.remove()} /> : <span className="font-display text-2xl text-accent">{initials}</span>}
              </div>
              <div>
                <h2 className="font-display text-2xl text-white">{user?.name}</h2>
                <p className="font-display text-xs text-muted mt-1">{user?.email}</p>
                {profile.bio && <p className="font-body text-sm text-white/70 mt-3">{profile.bio}</p>}
              </div>
            </div>
            {Object.entries(profile.links).filter(([, v]) => v).length > 0 && (
              <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
                {Object.entries(profile.links).filter(([, v]) => v).map(([k, v]) => (
                  <span key={k} className="font-display text-xs border border-border text-muted px-3 py-1.5">{k.toUpperCase()}: {v}</span>
                ))}
              </div>
            )}
            {profileCid && (
              <div className="mt-6 pt-4 border-t border-border">
                <p className="font-display text-xs text-muted/50 tracking-widest mb-1">VERIFIED ON IPFS</p>
                <code className="font-display text-xs text-info/60 break-all">{profileCid}</code>
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="terminal-border bg-panel/80">
            <div className="p-6 border-b border-border">
              <p className="font-display text-xs text-muted tracking-widest">Each save creates a permanent immutable version on IPFS</p>
            </div>
            {profileCid ? (
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-display text-xs text-accent tracking-widest mb-1">LATEST VERSION</p>
                    <code className="font-display text-xs text-white/70 break-all">{profileCid}</code>
                    <div className="mt-2">
                      <a href={`${IPFS_GATEWAY}/${profileCid}`} target="_blank" rel="noopener noreferrer"
                        className="font-display text-xs text-info hover:text-info/70 tracking-widest transition-colors">VIEW ON IPFS ↗</a>
                    </div>
                  </div>
                </div>
                {ipfsData && (
                  <div className="bg-void border border-border p-4">
                    <p className="font-display text-xs text-muted/60 tracking-widest mb-2">RAW DATA ON IPFS</p>
                    <pre className="font-display text-xs text-white/40 overflow-x-auto">{JSON.stringify(ipfsData, null, 2)}</pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center py-16 gap-3">
                <span className="font-display text-4xl text-border">⬡</span>
                <span className="font-display text-xs text-muted/40 tracking-widest">NO IPFS VERSIONS YET</span>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
