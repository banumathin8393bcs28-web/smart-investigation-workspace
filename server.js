require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const session = require('express-session');
const connectMongo = require('connect-mongo');
const MongoStore = connectMongo.default || connectMongo.MongoStore || connectMongo;
const methodOverride = require('method-override');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const { connectDB, MONGODB_URI } = require('./config/db');
const { setSocketIO, createNotification } = require('./services/notificationService');
const Message = require('./models/Message');
const Investigator = require('./models/Investigator');
const { ensureAuthenticated } = require('./middleware/auth');
const { serveFileResponse } = require('./services/storageService');

// Route imports
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const profileRoutes = require('./routes/profile');
const caseRoutes = require('./routes/cases');
const sceneRoutes = require('./routes/scenes');
const evidenceRequestRoutes = require('./routes/evidenceRequests');
const evidenceRoutes = require('./routes/evidence');
const contactRoutes = require('./routes/contacts');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const custodyRoutes = require('./routes/custody');
const reportRoutes = require('./routes/reports');
const autopsyRoutes = require('./routes/autopsy');
const criminalRoutes = require('./routes/criminalRecords');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Configure Socket.IO in notification service
setSocketIO(io);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// HTTP Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Rate limit exceeded from this workstation IP address.'
});
app.use(apiLimiter);

// Core middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(methodOverride('_method'));

// Session configuration with connect-mongo MongoDB session store
const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_investigation';
app.use(session({
  secret: process.env.SESSION_SECRET || 'forensic-secure-key-998822334411',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: dbUri,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60 // 24 hours
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: 'lax',
    secure: false // Set to true when running over HTTPS
  }
}));

// Global flash & helper locals
app.use((req, res, next) => {
  res.locals.success = req.query.success || null;
  res.locals.error = req.query.error || null;
  next();
});

// Authenticated route for serving private profile uploads across local and cloud environments
app.get('/uploads/profiles/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(__dirname, 'private_uploads', 'profiles', filename);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');

  serveFileResponse(req, res, {
    filename,
    localPath: filePath,
    mimeType,
    bucketName: 'profile_bucket',
    fallbackPath: '/images/default-avatar.png'
  });
});

// Socket.IO Real-time Messaging and Room Management
io.on('connection', (socket) => {
  socket.on('join_room', (data) => {
    if (data && data.room) {
      socket.join(data.room);
    }
  });

  socket.on('send_message', async (data) => {
    try {
      if (!data.senderId || !data.recipientId || (!data.content && !data.attachments)) return;

      const sender = await Investigator.findById(data.senderId);
      const recipient = await Investigator.findById(data.recipientId);
      if (!sender || !recipient) return;

      const savedMsg = await Message.create({
        sender: sender._id,
        senderName: sender.fullName,
        recipient: recipient._id,
        recipientName: recipient.fullName,
        caseId: data.caseId || null,
        messageText: data.content || '',
        attachments: data.attachments || [],
        deliveryStatus: 'Sent',
        sentTimestamp: new Date()
      });

      const payload = {
        _id: savedMsg._id,
        senderId: sender._id,
        senderName: sender.fullName,
        recipientId: recipient._id,
        recipientName: recipient.fullName,
        messageText: savedMsg.messageText,
        attachments: savedMsg.attachments,
        sentTimestamp: savedMsg.sentTimestamp
      };

      // Broadcast to both recipient room and sender room
      io.to(`user_${recipient._id}`).emit('receive_message', payload);
      io.to(`user_${sender._id}`).emit('receive_message', payload);

      // Create persistent notification
      await createNotification({
        recipientId: recipient._id,
        senderId: sender._id,
        senderName: sender.fullName,
        notificationType: 'message',
        title: `Message from ${sender.fullName}`,
        text: savedMsg.messageText || 'Sent an attachment',
        actionLink: `/messages?recipientId=${sender._id}`
      });
    } catch (err) {
      console.error('[Socket.IO Message Error]:', err);
    }
  });
});

// SECTION 4: FIRST PAGE — WELCOME PAGE AT ROOT
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('home', {
    title: 'Smart Investigation Workspace'
  });
});

// Route Mounts
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/profile', profileRoutes);
app.use('/cases', caseRoutes);
app.use('/scenes', sceneRoutes);
app.use('/evidence/requests', evidenceRequestRoutes);
app.use('/evidence', evidenceRoutes);
app.use('/contacts', contactRoutes);
app.use('/messages', messageRoutes);
app.use('/notifications', notificationRoutes);
app.use('/custody', custodyRoutes);
app.use('/reports', reportRoutes);
app.use('/autopsy', autopsyRoutes);
app.use('/criminals', criminalRoutes);
app.use('/suspects', criminalRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('partials/error', {
    title: '404 - Record Not Found',
    message: 'The requested investigation case, evidence artifact, or module does not exist.'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]:', err);
  res.status(500).render('partials/error', {
    title: '500 - System Operational Fault',
    message: err.message || 'An unexpected internal error occurred in the investigation workspace.'
  });
});

const PORT = process.env.PORT || 3000;

async function start() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(` SMART INVESTIGATION WORKSPACE // OFFICIAL FORENSIC SERVER`);
    console.log(` Port: ${PORT}`);
    console.log(` URL:  http://localhost:${PORT}`);
    console.log(` Database: MongoDB Community Server (${dbUri})`);
    console.log(` Session Store: connect-mongo active`);
    console.log(`================================================================`);
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('[Fatal Error] Failed to start server:', err);
  });
}

module.exports = { app, server, start };
