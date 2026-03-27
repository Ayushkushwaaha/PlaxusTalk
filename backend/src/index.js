require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'plaxustalk_dev_secret_change_in_production';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@plaxustalk.com';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
});

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://ayushkm123:Ayush123@cluster0.lxiykaw.mongodb.net/Nexus?retryWrites=true&w=majority&appName=Cluster0';

if (MONGO_URI) {
  mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
    connectTimeoutMS: 60000,
    family: 4,
    ssl: true,
    tls: true,
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err.message));
} else {
  console.log('⚠️  MONGODB_URI not set');
}
// ─── Schemas ──────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, minlength: 6 },
  isAdmin:   { type: Boolean, default: false },
  banned:    { type: Boolean, default: false },
  friends:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  friendRequests: [{
    from:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  }],
  isOnline:   { type: Boolean, default: false },
  lastSeen:   { type: Date, default: Date.now },
  profile_cid: { type: String, default: null }, // IPFS CID for decentralized profile
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.comparePassword = function (c) { return bcrypt.compare(c, this.password); };
const User = mongoose.model('User', userSchema);

const callSchema = new mongoose.Schema({
  room_id:      { type: String, required: true, index: true },
  user1_wallet: { type: String, default: null },
  user2_wallet: { type: String, default: null },
  user1_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  user2_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  start_time:   { type: Date, default: Date.now },
  duration:     { type: Number, default: null },
  avg_latency:  { type: Number, default: null },
  chat_cid:     { type: String, default: null }, // IPFS CID for chat history
}, { timestamps: true });
const Call = mongoose.model('Call', callSchema);

// ─── Middleware ───────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const d = jwt.verify(h.split(' ')[1], JWT_SECRET);
    req.userId = d.userId;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

async function adminOnly(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
    next();
  } catch { res.status(500).json({ error: 'Server error' }); }
}

// ─── Auth Routes ─────────────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password min 6 characters' });
  try {
    if (await User.findOne({ email }))
      return res.status(409).json({ error: 'Email already registered' });
    const isAdmin = email === ADMIN_EMAIL;
    const user = await User.create({ name, email, password, isAdmin });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin } });
  } catch (err) { res.status(500).json({ error: 'Signup failed' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'All fields required' });
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid email or password' });
    if (user.banned) return res.status(403).json({ error: 'Account banned' });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin } });
  } catch { res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin } });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/auth/update', auth, async (req, res) => {
  const { name, email } = req.body;
  try {
    const user = await User.findByIdAndUpdate(req.userId, { name, email }, { new: true }).select('-password');
    res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch { res.status(500).json({ error: 'Update failed' }); }
});

app.put('/api/auth/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.userId);
    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ error: 'Current password incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ─── User Search ──────────────────────────────────────────────────────────────
app.get('/api/users/search', auth, async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const user = await User.findOne({ email }).select('-password -friendRequests');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: user._id, name: user.name, email: user.email, isOnline: user.isOnline } });
  } catch { res.status(500).json({ error: 'Search failed' }); }
});

// ─── Friends Routes ───────────────────────────────────────────────────────────
app.get('/api/friends', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('friends', 'name email isOnline lastSeen');
    res.json({ friends: user.friends || [] });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/friends/requests', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('friendRequests.from', 'name email');
    const pending = user.friendRequests.filter((r) => r.status === 'pending');
    res.json({ requests: pending });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/friends/request', auth, async (req, res) => {
  const { toId } = req.body;
  try {
    const toUser = await User.findById(toId);
    if (!toUser) return res.status(404).json({ error: 'User not found' });
    const alreadySent = toUser.friendRequests.some(
      (r) => r.from.toString() === req.userId && r.status === 'pending'
    );
    if (alreadySent) return res.status(409).json({ error: 'Request already sent' });
    toUser.friendRequests.push({ from: req.userId, status: 'pending' });
    await toUser.save();
    // Notify via socket if online
    const targetSocket = onlineUsers.get(toId);
    if (targetSocket) {
      const fromUser = await User.findById(req.userId).select('name');
      io.to(targetSocket).emit('friend-request', { from: { id: req.userId, name: fromUser.name } });
    }
    res.json({ message: 'Request sent' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/friends/respond', auth, async (req, res) => {
  const { fromId, action } = req.body;
  try {
    const user = await User.findById(req.userId);
    const reqIdx = user.friendRequests.findIndex((r) => r.from.toString() === fromId);
    if (reqIdx === -1) return res.status(404).json({ error: 'Request not found' });
    user.friendRequests[reqIdx].status = action === 'accept' ? 'accepted' : 'rejected';
    if (action === 'accept') {
      user.friends.push(fromId);
      await User.findByIdAndUpdate(fromId, { $addToSet: { friends: req.userId } });
    }
    await user.save();
    res.json({ message: `Request ${action}ed` });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/friends/:friendId', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { $pull: { friends: req.params.friendId } });
    await User.findByIdAndUpdate(req.params.friendId, { $pull: { friends: req.userId } });
    res.json({ message: 'Friend removed' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ─── Calls ────────────────────────────────────────────────────────────────────
app.get('/api/calls', auth, async (req, res) => {
  try {
    const calls = await Call.find({
      $or: [{ user1_id: req.userId }, { user2_id: req.userId }],
    }).sort({ createdAt: -1 }).limit(50);
    res.json({ calls });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ─── IPFS Routes ─────────────────────────────────────────────────────────────
const ipfs = require('./services/ipfs');

// Chat message schema in MongoDB (stores CID reference)
const chatMsgSchema = new mongoose.Schema({
  roomId:    { type: String, required: true, index: true },
  senderId:  { type: String },
  senderName:{ type: String },
  text:      { type: String, required: true },
  cid:       { type: String, default: null }, // IPFS CID
  ipfsUrl:   { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });
const ChatMsg = mongoose.model('ChatMsg', chatMsgSchema);

// POST /api/ipfs/chat — store one chat message on IPFS
app.post('/api/ipfs/chat', auth, async (req, res) => {
  const { roomId, text, senderName } = req.body;
  if (!roomId || !text) return res.status(400).json({ error: 'roomId and text required' });
  try {
    let cid = null;
    let url = null;
    if (ipfs.isPinataConfigured()) {
      cid = await ipfs.pinChatMessage({
        roomId, sender: senderName || 'User',
        senderId: req.userId, text,
        timestamp: new Date().toISOString(),
      });
      url = ipfs.ipfsUrl(cid);
    }
    const msg = await ChatMsg.create({
      roomId, senderId: req.userId,
      senderName: senderName || 'User', text, cid, ipfsUrl: url,
    });
    res.json({ message: msg, cid, ipfsUrl: url });
  } catch (err) {
    console.error('IPFS chat error:', err.message);
    res.status(500).json({ error: 'Failed to store message' });
  }
});

// GET /api/ipfs/chat/:roomId — get all messages for a room
app.get('/api/ipfs/chat/:roomId', auth, async (req, res) => {
  try {
    const messages = await ChatMsg.find({ roomId: req.params.roomId })
      .sort({ timestamp: 1 }).limit(200);
    res.json({ messages, count: messages.length });
  } catch { res.status(500).json({ error: 'Failed to fetch messages' }); }
});

// POST /api/ipfs/chat/:roomId/export — export full chat history to IPFS
app.post('/api/ipfs/chat/:roomId/export', auth, async (req, res) => {
  try {
    const messages = await ChatMsg.find({ roomId: req.params.roomId }).sort({ timestamp: 1 });
    if (!ipfs.isPinataConfigured()) return res.status(503).json({ error: 'Pinata not configured' });
    const cid = await ipfs.pinChatHistory(req.params.roomId, messages.map((m) => ({
      sender: m.senderName, text: m.text, timestamp: m.timestamp,
    })));
    const url = ipfs.ipfsUrl(cid);
    // Save CID to the call record
    await Call.findOneAndUpdate({ room_id: req.params.roomId }, { chat_cid: cid });
    res.json({ cid, ipfsUrl: url, messageCount: messages.length });
  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/ipfs/chat/cid/:cid — fetch chat from IPFS directly
app.get('/api/ipfs/chat/cid/:cid', async (req, res) => {
  try {
    const data = await ipfs.fetchFromIPFS(req.params.cid);
    res.json(data);
  } catch { res.status(500).json({ error: 'Failed to fetch from IPFS' }); }
});

// PUT /api/ipfs/profile — upload profile to IPFS
app.put('/api/ipfs/profile', auth, async (req, res) => {
  const { bio, avatar, links } = req.body;
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    let cid = null;
    let url = null;
    if (ipfs.isPinataConfigured()) {
      cid = await ipfs.pinUserProfile({
        userId:    user._id.toString(),
        name:      user.name,
        email:     user.email,
        bio:       bio || '',
        avatar:    avatar || null,
        links:     links || {},
        updatedAt: new Date().toISOString(),
      });
      url = ipfs.ipfsUrl(cid);
      // Save CID to user
      user.profile_cid = cid;
      await user.save();
    }
    res.json({ cid, ipfsUrl: url, message: cid ? 'Profile stored on IPFS' : 'Pinata not configured' });
  } catch (err) {
    console.error('Profile IPFS error:', err.message);
    res.status(500).json({ error: 'Failed to store profile' });
  }
});

// GET /api/ipfs/profile/:userId — get user profile (from IPFS if available)
app.get('/api/ipfs/profile/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name email profile_cid isOnline');
    if (!user) return res.status(404).json({ error: 'User not found' });
    let ipfsProfile = null;
    if (user.profile_cid) {
      try { ipfsProfile = await ipfs.fetchFromIPFS(user.profile_cid); } catch { }
    }
    res.json({
      user: { id: user._id, name: user.name, email: user.email, isOnline: user.isOnline },
      ipfsProfile,
      profileCid: user.profile_cid,
      ipfsUrl: user.profile_cid ? ipfs.ipfsUrl(user.profile_cid) : null,
    });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// GET /api/ipfs/status — check if Pinata is configured
app.get('/api/ipfs/status', auth, (req, res) => {
  res.json({
    configured: ipfs.isPinataConfigured(),
    gateway: 'https://gateway.pinata.cloud/ipfs',
  });
});

// ─── Rooms ────────────────────────────────────────────────────────────────────
const rooms = new Map();
const onlineUsers = new Map(); // userId → socketId

function mockLatency() { return Math.floor(80 + Math.random() * 60); }

async function logCall(room) {
  if (mongoose.connection.readyState !== 1 || room.users.length < 2) return;
  const duration = Math.floor((Date.now() - room.startTime) / 1000);
  try {
    await Call.create({
      room_id:      room.id,
      user1_wallet: room.users[0]?.wallet || null,
      user2_wallet: room.users[1]?.wallet || null,
      user1_id:     room.users[0]?.userId || null,
      user2_id:     room.users[1]?.userId || null,
      start_time:   new Date(room.startTime),
      duration,
      avg_latency:  room.latencySamples.length
        ? Math.round(room.latencySamples.reduce((a, b) => a + b, 0) / room.latencySamples.length)
        : null,
    });
    console.log(`📝 Call logged — room: ${room.id}, duration: ${duration}s`);
  } catch (err) { console.error('Log error:', err.message); }
}

app.post('/api/rooms', auth, (req, res) => {
  const { password } = req.body;
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  rooms.set(roomId, {
    id: roomId, users: [], startTime: null, latencySamples: [],
    callId: uuidv4(), password: password || null,
  });
  res.json({ roomId });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ roomId: room.id, userCount: room.users.length, full: room.users.length >= 2, hasPassword: !!room.password });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────
app.get('/api/admin/stats', auth, adminOnly, async (req, res) => {
  try {
    const [totalUsers, totalCalls, allCalls] = await Promise.all([
      User.countDocuments(),
      Call.countDocuments(),
      Call.find().select('avg_latency duration start_time'),
    ]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const callsToday = allCalls.filter((c) => new Date(c.start_time) >= today).length;
    const totalMinutes = Math.round(allCalls.reduce((a, c) => a + (c.duration || 0), 0) / 60);
    const latencyList = allCalls.filter((c) => c.avg_latency);
    const avgLatency = latencyList.length ? Math.round(latencyList.reduce((a, c) => a + c.avg_latency, 0) / latencyList.length) : null;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsers7d = await User.countDocuments({ createdAt: { $gte: weekAgo } });
    res.json({ totalUsers, totalCalls, callsToday, totalMinutes, avgLatency, newUsers7d });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password -friendRequests').sort({ createdAt: -1 });
    res.json({ users });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/admin/calls', auth, adminOnly, async (req, res) => {
  try {
    const calls = await Call.find().sort({ createdAt: -1 }).limit(100);
    res.json({ calls });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/admin/rooms', auth, adminOnly, (req, res) => {
  const roomList = Array.from(rooms.values()).map((r) => ({
    id: r.id, userCount: r.users.length, hasPassword: !!r.password,
    startTime: r.startTime, callId: r.callId,
  }));
  res.json({ rooms: roomList });
});

app.post('/api/admin/users/:id/ban', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    user.banned = !user.banned;
    await user.save();
    res.json({ banned: user.banned });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/admin/rooms/:roomId', auth, adminOnly, (req, res) => {
  const id = req.params.roomId.toUpperCase();
  const room = rooms.get(id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  io.to(id).emit('room-ended', { message: 'Room ended by admin' });
  if (room.latencyInterval) clearInterval(room.latencyInterval);
  rooms.delete(id);
  res.json({ message: 'Room ended' });
});

app.get('/api/ipfs/status', (req, res) => {
  res.json({ configured: isPinataConfigured() });
});
app.get('/health', (req, res) => res.json({ status: 'ok', rooms: rooms.size, users: onlineUsers.size }));

// ─── IPFS Routes ──────────────────────────────────────────────────────────────
const { pinJSON, fetchFromIPFS, getIPFSUrl, isPinataConfigured } = require('./ipfs');

// Upload chat history for a room to IPFS
app.post('/api/ipfs/chat', auth, async (req, res) => {
  const { roomId, messages } = req.body;
  if (!roomId || !messages) return res.status(400).json({ error: 'roomId and messages required' });
  if (!isPinataConfigured()) return res.status(503).json({ error: 'IPFS not configured' });
  try {
    const data = {
      roomId,
      messages,
      savedAt: new Date().toISOString(),
      savedBy: req.userId,
      version: '1.0',
    };
    const cid = await pinJSON(data, `plaxustalk-chat-${roomId}`);
    // Save CID to call record
    await Call.findOneAndUpdate({ room_id: roomId }, { chat_cid: cid });
    res.json({ cid, url: getIPFSUrl(cid) });
  } catch (err) {
    console.error('IPFS chat error:', err.message);
    res.status(500).json({ error: 'Failed to store chat on IPFS' });
  }
});

// Fetch chat history from IPFS by CID
app.get('/api/ipfs/chat/:cid', auth, async (req, res) => {
  try {
    const data = await fetchFromIPFS(req.params.cid);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch from IPFS' });
  }
});

// Upload user profile to IPFS
app.post('/api/ipfs/profile', auth, async (req, res) => {
  const { name, bio, avatar, links } = req.body;
  if (!isPinataConfigured()) return res.status(503).json({ error: 'IPFS not configured' });
  try {
    const profileData = {
      name,
      bio: bio || '',
      avatar: avatar || null,
      links: links || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      owner: req.userId,
      version: '1.0',
    };
    const cid = await pinJSON(profileData, `plaxustalk-profile-${req.userId}`);
    // Save CID to user
    await User.findByIdAndUpdate(req.userId, { profile_cid: cid });
    res.json({ cid, url: getIPFSUrl(cid) });
  } catch (err) {
    console.error('IPFS profile error:', err.message);
    res.status(500).json({ error: 'Failed to store profile on IPFS' });
  }
});

// Fetch profile from IPFS
app.get('/api/ipfs/profile/:cid', async (req, res) => {
  try {
    const data = await fetchFromIPFS(req.params.cid);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile from IPFS' });
  }
});

// Get current user's IPFS profile CID
app.get('/api/ipfs/profile/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('profile_cid');
    if (!user?.profile_cid) return res.json({ cid: null });
    const data = await fetchFromIPFS(user.profile_cid);
    res.json({ cid: user.profile_cid, url: getIPFSUrl(user.profile_cid), profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);
  let currentRoomId = null;
  let currentUserId = null;

  socket.on('user-online', async ({ userId }) => {
    if (!userId) return;
    currentUserId = userId;
    onlineUsers.set(userId, socket.id);
    try { await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() }); } catch { }
  });

  socket.on('join-room', ({ roomId, wallet, userId, userName, password }) => {
    const id = roomId.toUpperCase();
    let room = rooms.get(id);
    if (!room) {
      room = { id, users: [], startTime: null, latencySamples: [], callId: uuidv4(), password: null };
      rooms.set(id, room);
    }
    if (room.users.length >= 2) { socket.emit('room-full'); return; }
    if (room.password && room.password !== password) { socket.emit('room-wrong-password'); return; }

    currentRoomId = id;
    socket.join(id);
    const isInitiator = room.users.length === 0;
    room.users.push({ socketId: socket.id, wallet: wallet || null, userId: userId || null, userName: userName || 'Guest' });

    socket.emit('joined-room', { roomId: id, isInitiator, peerCount: room.users.length, callId: room.callId });

    if (room.users.length === 2) {
      room.startTime = Date.now();
      io.to(id).emit('peer-joined', { userCount: 2, userName });
      room.latencyInterval = setInterval(() => {
        const latency = mockLatency();
        room.latencySamples.push(latency);
        io.to(id).emit('latency-update', { latency, p2p: true });
      }, 3000);
    }
    console.log(`👤 ${socket.id} joined room ${id} (${room.users.length}/2)`);
  });

  socket.on('offer',         ({ roomId, offer })     => socket.to(roomId.toUpperCase()).emit('offer', { offer }));
  socket.on('answer',        ({ roomId, answer })    => socket.to(roomId.toUpperCase()).emit('answer', { answer }));
  socket.on('ice-candidate', ({ roomId, candidate }) => socket.to(roomId.toUpperCase()).emit('ice-candidate', { candidate }));

  socket.on('update-wallet', ({ roomId, wallet }) => {
    const room = rooms.get(roomId?.toUpperCase());
    if (!room) return;
    const user = room.users.find((u) => u.socketId === socket.id);
    if (user) user.wallet = wallet;
  });

  socket.on('chat-message', async ({ roomId, message }) => {
    // Relay to peer immediately
    socket.to(roomId.toUpperCase()).emit('chat-message', message);
    // Store on IPFS in background
    if (ipfs.isPinataConfigured() && message.text) {
      try {
        const cid = await ipfs.pinChatMessage({
          roomId, sender: message.sender,
          senderId: message.senderId, text: message.text,
          timestamp: new Date().toISOString(),
        });
        // Notify sender of CID
        socket.emit('message-stored', { messageId: message.id, cid, ipfsUrl: ipfs.ipfsUrl(cid) });
      } catch (e) { /* IPFS storage is non-blocking */ }
    }
  });

  socket.on('reaction',   ({ roomId, emoji })  => socket.to(roomId.toUpperCase()).emit('reaction', { emoji }));
  socket.on('raise-hand', ({ roomId, raised }) => socket.to(roomId.toUpperCase()).emit('raise-hand', { raised }));

  socket.on('admit-peer',   ({ roomId, socketId }) => io.to(socketId).emit('waiting-admitted'));
  socket.on('reject-peer',  ({ roomId, socketId }) => io.to(socketId).emit('waiting-rejected'));

  socket.on('disconnect', async () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    if (currentUserId) {
      onlineUsers.delete(currentUserId);
      try { await User.findByIdAndUpdate(currentUserId, { isOnline: false, lastSeen: new Date() }); } catch { }
    }
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (room.latencyInterval) { clearInterval(room.latencyInterval); room.latencyInterval = null; }
    await logCall(room);
    room.users = room.users.filter((u) => u.socketId !== socket.id);
    io.to(currentRoomId).emit('peer-left', { userCount: room.users.length });
    if (room.users.length === 0) { rooms.delete(currentRoomId); console.log(`🗑️  Room ${currentRoomId} deleted`); }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`🚀 PlaxusTalk server running on :${PORT}`));
