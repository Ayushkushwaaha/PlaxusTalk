const axios = require('axios');

const PINATA_API_KEY    = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const PINATA_BASE       = 'https://api.pinata.cloud';
const IPFS_GATEWAY      = 'https://gateway.pinata.cloud/ipfs';

// Check if Pinata is configured
function isPinataConfigured() {
  return !!(PINATA_API_KEY && PINATA_SECRET_KEY);
}

// Pinata auth headers
function pinataHeaders() {
  return {
    pinata_api_key:        PINATA_API_KEY,
    pinata_secret_api_key: PINATA_SECRET_KEY,
    'Content-Type': 'application/json',
  };
}

// Upload any JSON to IPFS via Pinata
async function pinJSON(data, name = 'plaxustalk-data') {
  if (!isPinataConfigured()) throw new Error('Pinata not configured');
  const body = {
    pinataContent: data,
    pinataMetadata: { name, keyvalues: { app: 'plaxustalk', timestamp: Date.now().toString() } },
    pinataOptions: { cidVersion: 1 },
  };
  const res = await axios.post(`${PINATA_BASE}/pinning/pinJSONToIPFS`, body, { headers: pinataHeaders() });
  return res.data.IpfsHash; // CID
}

// Fetch JSON from IPFS
async function fetchFromIPFS(cid) {
  const res = await axios.get(`${IPFS_GATEWAY}/${cid}`, { timeout: 10000 });
  return res.data;
}

// Get IPFS gateway URL for a CID
function ipfsUrl(cid) {
  return `${IPFS_GATEWAY}/${cid}`;
}

// Upload chat message to IPFS
async function pinChatMessage({ roomId, sender, senderId, text, timestamp }) {
  const data = {
    type:      'chat_message',
    app:       'plaxustalk',
    roomId,
    sender,
    senderId,
    text,
    timestamp: timestamp || new Date().toISOString(),
  };
  return pinJSON(data, `chat-${roomId}-${Date.now()}`);
}

// Upload full chat history to IPFS
async function pinChatHistory(roomId, messages) {
  const data = {
    type:      'chat_history',
    app:       'plaxustalk',
    roomId,
    messages,
    exportedAt: new Date().toISOString(),
    totalMessages: messages.length,
  };
  return pinJSON(data, `chat-history-${roomId}`);
}

// Upload user profile to IPFS
async function pinUserProfile({ userId, name, email, bio, avatar, links, updatedAt }) {
  const data = {
    type:      'user_profile',
    app:       'plaxustalk',
    userId,
    name,
    email,
    bio:       bio || '',
    avatar:    avatar || null,
    links:     links || {},
    updatedAt: updatedAt || new Date().toISOString(),
    version:   1,
  };
  return pinJSON(data, `profile-${userId}`);
}

// List all pins for this app
async function listPins(nameFilter = '') {
  if (!isPinataConfigured()) return [];
  const res = await axios.get(`${PINATA_BASE}/data/pinList?status=pinned&metadata[name]=${nameFilter}`, {
    headers: pinataHeaders(),
  });
  return res.data.rows || [];
}

// Unpin (delete) from IPFS
async function unpin(cid) {
  if (!isPinataConfigured()) return;
  await axios.delete(`${PINATA_BASE}/pinning/unpin/${cid}`, { headers: pinataHeaders() });
}

module.exports = {
  isPinataConfigured,
  pinJSON,
  fetchFromIPFS,
  ipfsUrl,
  pinChatMessage,
  pinChatHistory,
  pinUserProfile,
  listPins,
  unpin,
};
