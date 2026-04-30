require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');

const JWT_SECRET = process.env.JWT_SECRET || 'plaxustalk_dev_secret_change_in_production';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@plaxustalk.com';

// ─── In-memory stores ─────────────────────────────────────────────────────────
const onlineUsers      = new Map(); // userId -> socketId
const pushSubscriptions = new Map(); // userId -> push subscription
const rooms            = new Map();
const groupRooms       = new Map();

// ─── VAPID Setup ──────────────────────────────────────────────────────────────
webpush.setVapidDetails(
  'mailto:ayush.km123@gmail.com',
  'BMxz0c46aPWBqI1LOeYx9Oxb6K9u18BLFw1D9INCFaE4tE8WVd9vr6n4Nzy9MSrDkQ5W0cUJUKCR0HiCw3-F1KM',
  'SA5RfIXLTIDL6o5SW5nmY7fE2McmMNU1o4qNCKaAAE8'
);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || '*',
      'https://plexustalks.vercel.app',
      'https://plaxustalks.vercel.app',
      'https://plexustalks-git-main-ayushkushwaahas-projects.vercel.app',
      'https://plaxustalks-git-main-ayushkushwaahas-projects.vercel.app',
      'http://localhost:5173',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || '*',
    'https://plexustalks.vercel.app',
    'https://plaxustalks.vercel.app',
    'https://plexustalks-git-main-ayushkushwaahas-projects.vercel.app',
    'https://plaxustalks-git-main-ayushkushwaahas-projects.vercel.app',
    'http://localhost:5173',
  ],
  credentials: true,
}));
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
  isOnline:        { type: Boolean, default: false },
  lastSeen:        { type: Date, default: Date.now },
  profile_cid:     { type: String, default: null },
  pushSubscription: { type: Object, default: null }, // stored push subscription
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
  chat_cid:     { type: String, default: null },
}, { timestamps: true });
const Call = mongoose.model('Call', callSchema);

const chatMsgSchema = new mongoose.Schema({
  roomId:     { type: String, required: true, index: true },
  senderId:   { type: String },
  senderName: { type: String },
  text:       { type: String, required: true },
  cid:        { type: String, default: null },
  ipfsUrl:    { type: String, default: null },
  timestamp:  { type: Date, default: Date.now },
}, { timestamps: true });
const ChatMsg = mongoose.model('ChatMsg', chatMsgSchema);

// ─── Auth Middleware ──────────────────────────────────────────────────────────
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
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password min 6 characters' });
  try {
    if (await User.findOne({ email })) return res.status(409).json({ error: 'Email already registered' });
    const isAdmin = email === ADMIN_EMAIL;
    const user = await User.create({ name, email, password, isAdmin });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, isAdmin: user.isAdmin } });
  } catch { res.status(500).json({ error: 'Signup failed' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'All fields required' });
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ error: 'Invalid email or password' });
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
    if (!(await user.comparePassword(currentPassword))) return res.status(401).json({ error: 'Current password incorrect' });
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
    const alreadySent = toUser.friendRequests.some((r) => r.from.toString() === req.userId && r.status === 'pending');
    if (alreadySent) return res.status(409).json({ error: 'Request already sent' });
    toUser.friendRequests.push({ from: req.userId, status: 'pending' });
    await toUser.save();
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
    const calls = await Call.find({ $or: [{ user1_id: req.userId }, { user2_id: req.userId }] }).sort({ createdAt: -1 }).limit(50);
    res.json({ calls });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ─── Rooms ────────────────────────────────────────────────────────────────────
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
      avg_latency: room.latencySamples.length
        ? Math.round(room.latencySamples.reduce((a, b) => a + b, 0) / room.latencySamples.length)
        : null,
    });
  } catch (err) { console.error('Log error:', err.message); }
}

app.post('/api/rooms', auth, (req, res) => {
  const { password } = req.body;
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  rooms.set(roomId, { id: roomId, users: [], startTime: null, latencySamples: [], callId: uuidv4(), password: password || null });
  res.json({ roomId });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ roomId: room.id, userCount: room.users.length, full: room.users.length >= 2, hasPassword: !!room.password });
});

// ─── Push Notification Routes ─────────────────────────────────────────────────

// Save push subscription from browser
app.post('/api/push/subscribe', auth, async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) return res.status(400).json({ error: 'Missing fields' });
    pushSubscriptions.set(userId.toString(), subscription);
    await User.findByIdAndUpdate(userId, { pushSubscription: subscription }).catch(() => {});
    console.log(`🔔 Push subscription saved for user ${userId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Remove push subscription
app.post('/api/push/unsubscribe', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    pushSubscriptions.delete(userId?.toString());
    await User.findByIdAndUpdate(userId, { $unset: { pushSubscription: '' } }).catch(() => {});
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
});

// Send call push notification to a friend
app.post('/api/push/call', auth, async (req, res) => {
  try {
    const { callerId, callerName, receiverId, roomId, callType } = req.body;
    if (!receiverId || !roomId) return res.status(400).json({ error: 'Missing fields' });

    // Get subscription — check memory first, then MongoDB
    let subscription = pushSubscriptions.get(receiverId.toString());
    if (!subscription) {
      const receiverUser = await User.findById(receiverId).select('pushSubscription').catch(() => null);
      subscription = receiverUser?.pushSubscription;
      if (subscription) pushSubscriptions.set(receiverId.toString(), subscription); // cache it
    }

    if (!subscription) {
      console.log(`⚠️  No push subscription for user ${receiverId} — socket only`);
      return res.json({ success: true, method: 'socket-only' });
    }

    const payload = JSON.stringify({
      title: `📞 ${callerName} is calling you...`,
      body: callType === 'group' ? 'Tap to join the group call' : 'Tap to answer',
      callerName,
      roomId,
      callType: callType || 'p2p',
      icon: '/logo.png',
    });

    await webpush.sendNotification(subscription, payload);
    console.log(`📨 Push notification sent to ${receiverId}`);
    res.json({ success: true, method: 'push' });
  } catch (err) {
    console.error('Push call error:', err.message);
    // Subscription expired — clean it up
    if (err.statusCode === 410) {
      pushSubscriptions.delete(req.body.receiverId?.toString());
      await User.findByIdAndUpdate(req.body.receiverId, { $unset: { pushSubscription: '' } }).catch(() => {});
    }
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────
app.get('/api/admin/stats', auth, adminOnly, async (req, res) => {
  try {
    const [totalUsers, totalCalls, allCalls] = await Promise.all([
      User.countDocuments(), Call.countDocuments(), Call.find().select('avg_latency duration start_time'),
    ]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const callsToday = allCalls.filter((c) => new Date(c.start_time) >= today).length;
    const totalMinutes = Math.round(allCalls.reduce((a, c) => a + (c.duration || 0), 0) / 60);
    const latencyList = allCalls.filter((c) => c.avg_latency);
    const avgLatency = latencyList.length ? Math.round(latencyList.reduce((a, c) => a + c.avg_latency, 0) / latencyList.length) : null;
    const newUsers7d = await User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } });
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
    id: r.id, userCount: r.users.length, hasPassword: !!r.password, startTime: r.startTime, callId: r.callId,
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

// ─── IPFS Routes ──────────────────────────────────────────────────────────────
const ipfs = require('./services/ipfs');

app.post('/api/ipfs/chat', auth, async (req, res) => {
  const { roomId, text, senderName } = req.body;
  if (!roomId || !text) return res.status(400).json({ error: 'roomId and text required' });
  try {
    let cid = null, url = null;
    if (ipfs.isPinataConfigured()) {
      cid = await ipfs.pinChatMessage({ roomId, sender: senderName || 'User', senderId: req.userId, text, timestamp: new Date().toISOString() });
      url = ipfs.ipfsUrl(cid);
    }
    const msg = await ChatMsg.create({ roomId, senderId: req.userId, senderName: senderName || 'User', text, cid, ipfsUrl: url });
    res.json({ message: msg, cid, ipfsUrl: url });
  } catch (err) { res.status(500).json({ error: 'Failed to store message' }); }
});

app.get('/api/ipfs/chat/:roomId', auth, async (req, res) => {
  try {
    const messages = await ChatMsg.find({ roomId: req.params.roomId }).sort({ timestamp: 1 }).limit(200);
    res.json({ messages, count: messages.length });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/ipfs/profile', auth, async (req, res) => {
  const { bio, avatar, links } = req.body;
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    let cid = null, url = null;
    if (ipfs.isPinataConfigured()) {
      cid = await ipfs.pinUserProfile({ userId: user._id.toString(), name: user.name, email: user.email, bio: bio || '', avatar: avatar || null, links: links || {}, updatedAt: new Date().toISOString() });
      url = ipfs.ipfsUrl(cid);
      user.profile_cid = cid;
      await user.save();
    }
    res.json({ cid, ipfsUrl: url });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/ipfs/profile/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name email profile_cid isOnline');
    if (!user) return res.status(404).json({ error: 'User not found' });
    let ipfsProfile = null;
    if (user.profile_cid) { try { ipfsProfile = await ipfs.fetchFromIPFS(user.profile_cid); } catch { } }
    res.json({ user: { id: user._id, name: user.name, email: user.email, isOnline: user.isOnline }, ipfsProfile, profileCid: user.profile_cid, ipfsUrl: user.profile_cid ? ipfs.ipfsUrl(user.profile_cid) : null });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/ipfs/status', auth, (req, res) => {
  res.json({ configured: ipfs.isPinataConfigured(), gateway: 'https://gateway.pinata.cloud/ipfs' });
});

app.get('/health', (req, res) => res.json({ status: 'ok', rooms: rooms.size, onlineUsers: onlineUsers.size }));

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);
  let currentRoomId = null;
  let currentUserId = null;

  // ── Register user so friends can call them ──────────────────────────────────
  socket.on('register-user', async ({ userId }) => {
    if (!userId) return;
    currentUserId = userId.toString();
    onlineUsers.set(currentUserId, socket.id);
    console.log(`👤 User ${currentUserId} registered (${socket.id})`);
    try { await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() }); } catch { }
  });

  // Keep backward compat with old 'user-online' event
  socket.on('user-online', async ({ userId }) => {
    if (!userId) return;
    currentUserId = userId.toString();
    onlineUsers.set(currentUserId, socket.id);
    try { await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() }); } catch { }
  });

  // ── Call signaling ──────────────────────────────────────────────────────────

  // Caller presses "Call" button
  socket.on('call-friend', ({ callerId, callerName, receiverId, roomId, callType }) => {
    const receiverSocketId = onlineUsers.get(receiverId?.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('incoming-call', { callerName, callerId, roomId, callType: callType || 'p2p' });
      console.log(`📞 Call from ${callerName} to socket ${receiverSocketId} room ${roomId}`);
    } else {
      console.log(`⚠️  Receiver ${receiverId} not online — push notification only`);
    }
  });

  // Receiver accepted
  socket.on('call-accepted', ({ roomId, callerId }) => {
    const callerSocketId = onlineUsers.get(callerId?.toString());
    if (callerSocketId) io.to(callerSocketId).emit('call-accepted', { roomId });
    console.log(`✅ Call accepted for room ${roomId}`);
  });

  // Receiver declined
  socket.on('call-declined', ({ roomId, callerId }) => {
    const callerSocketId = onlineUsers.get(callerId?.toString());
    if (callerSocketId) io.to(callerSocketId).emit('call-declined', { roomId });
    console.log(`❌ Call declined for room ${roomId}`);
  });

  // Caller cancelled before answer
  socket.on('call-cancelled', ({ receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId?.toString());
    if (receiverSocketId) io.to(receiverSocketId).emit('call-cancelled');
  });

  // ── P2P Room ────────────────────────────────────────────────────────────────
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
    socket.to(roomId.toUpperCase()).emit('chat-message', message);
    if (ipfs.isPinataConfigured() && message?.text) {
      try {
        const cid = await ipfs.pinChatMessage({ roomId, sender: message.sender, senderId: message.senderId, text: message.text, timestamp: new Date().toISOString() });
        socket.emit('message-stored', { messageId: message.id, cid, ipfsUrl: ipfs.ipfsUrl(cid) });
      } catch { }
    }
  });

  socket.on('reaction',   ({ roomId, emoji })  => socket.to(roomId.toUpperCase()).emit('reaction', { emoji }));
  socket.on('raise-hand', ({ roomId, raised }) => socket.to(roomId.toUpperCase()).emit('raise-hand', { raised }));
  socket.on('admit-peer', ({ roomId, socketId }) => io.to(socketId).emit('waiting-admitted'));
  socket.on('reject-peer', ({ roomId, socketId }) => io.to(socketId).emit('waiting-rejected'));

  // ── Group Room ──────────────────────────────────────────────────────────────
  socket.on('group-join', ({ roomId, userName }) => {
    const id = roomId?.toUpperCase();
    if (!id) return;
    if (!groupRooms.has(id)) groupRooms.set(id, []);
    const room = groupRooms.get(id);
    const existingIdx = room.findIndex(p => p.socketId === socket.id);
    if (existingIdx !== -1) room.splice(existingIdx, 1);
    if (room.length >= 8) { socket.emit('group-room-full'); return; }
    socket.emit('group-peers', { peers: room.map(p => ({ socketId: p.socketId, name: p.userName })) });
    room.push({ socketId: socket.id, userName: userName || 'Guest' });
    socket.join(id);
    socket.to(id).emit('group-peer-joined', { socketId: socket.id, name: userName || 'Guest' });
    console.log(`👥 ${socket.id} joined group ${id} (${room.length}/8)`);
  });

  socket.on('group-offer',       ({ roomId, to, offer })     => socket.to(to).emit('group-offer', { from: socket.id, offer }));
  socket.on('group-answer',      ({ roomId, to, answer })    => socket.to(to).emit('group-answer', { from: socket.id, answer }));
  socket.on('group-ice',         ({ roomId, to, candidate }) => socket.to(to).emit('group-ice', { from: socket.id, candidate }));
  socket.on('group-peer-muted',  ({ roomId, isMuted })       => socket.to(roomId?.toUpperCase()).emit('group-peer-muted', { socketId: socket.id, isMuted }));

  socket.on('group-leave', ({ roomId }) => {
    const id = roomId?.toUpperCase();
    if (!id || !groupRooms.has(id)) return;
    const room = groupRooms.get(id);
    groupRooms.set(id, room.filter(p => p.socketId !== socket.id));
    socket.to(id).emit('group-peer-left', { socketId: socket.id });
    if (groupRooms.get(id).length === 0) groupRooms.delete(id);
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    console.log(`❌ Disconnected: ${socket.id}`);

    // Remove from online users
    if (currentUserId) {
      onlineUsers.delete(currentUserId);
      try { await User.findByIdAndUpdate(currentUserId, { isOnline: false, lastSeen: new Date() }); } catch { }
    }

    // Clean up group rooms
    groupRooms.forEach((peers, roomId) => {
      const wasMember = peers.find(p => p.socketId === socket.id);
      if (wasMember) {
        groupRooms.set(roomId, peers.filter(p => p.socketId !== socket.id));
        socket.to(roomId).emit('group-peer-left', { socketId: socket.id });
        if (groupRooms.get(roomId).length === 0) groupRooms.delete(roomId);
      }
    });

    // Clean up P2P room
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