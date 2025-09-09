const waitOn = require('wait-on');
require('dotenv').config();

waitOn({
  resources: [`tcp:${process.env.MAINDB_HOST}:${process.env.MAINDB_PORT || 3306}`],
  delay: 4000,         // initial delay in ms
  interval: 5000,      // poll interval in ms
  timeout: 30000,      // timeout in ms (30s)
  tcpTimeout: 1000,    // TCP timeout per attempt
  window: 1000         // stabilization window
}, (err) => {
  if (err) {
    console.error('❌ MySQL did not start in time:', err.message);
    process.exit(1);
  }

  console.log('✅ MySQL is up. Starting server...');
  const express = require('express')
  const session = require('express-session')
  const path = require('path')
  const cors = require('cors')
  const authRoutes = require('./routes/auth')
  const aksesRoutes = require('./routes/akses')
  const userRoutes = require('./routes/user')
  const http = require('http')
  const favicon = require('serve-favicon')
  const { createProxyMiddleware } = require('http-proxy-middleware');
  require('./devices/fp');
  require('./devices/buzzer');

  const SHINOBI_HOST = process.env.SHINOBI_HOST;
  const SHINOBI_GROUP_KEY = process.env.SHINOBI_GROUP_KEY;

  const mainDb = require('./models/mainDb');
  const { startRFIDReader, setEnrollMode, submitEnrollment } = require('./devices/rfid');
  const connectSessionKnex = require('connect-session-knex');
  const KnexSessionStore = connectSessionKnex.ConnectSessionKnexStore;
  
  const app = express()
  app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))

  const sessionStore = new KnexSessionStore({
    knex: mainDb,
    tablename: 'sessions', // Name of the table to store session data
    sidfieldname: 'session_id', // Column name for session IDs
    createTable: true, // Automatically create the sessions table if it doesn't exist
    clearInterval: 1000 * 60, // Clear expired sessions every hour
  });

  // // Handle session store errors
  sessionStore.on('connect-error', (error) => {
    console.error('Knex session store error:', error);
  });
  app.use(
    session({
      secret: process.env.OPENAIOT_KEY, 
      resave: false, 
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 day in milliseconds
        secure: false, //process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
      },
    })
  );

  app.use('/stream/:uid/:token', (req, res, next) => {
    const { uid, token } = req.params;

    const proxy = createProxyMiddleware({
      target: SHINOBI_HOST,
      changeOrigin: true,
      pathRewrite: (path, req) => {
        const { uid, token } = req.params;
        return `/${SHINOBI_GROUP_KEY}/mjpeg/${uid}/${token}`;
      },
      onProxyReq: (proxyReq, req, res) => {
        // 🛠️ Tambahkan header Accept agar dianggap "browser"
        proxyReq.setHeader('Accept', 'image/webp,image/apng,image/*,*/*;q=0.8');
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0');
      },
      proxyTimeout: 10000, // opsional
    });

    proxy(req, res, next);
  });

  const server = http.createServer(app)
  const io = require('socket.io')(server);
  require('./devices/fp').setSocket(io);
  require('./controllers/aksesController').setSocketIO(io);

  app.use(express.urlencoded({ extended: true }))
  app.use(express.static(path.join(__dirname, 'public')))
  app.set('views', path.join(__dirname, 'views'))
  app.use('/libs', express.static('node_modules'))
  app.locals.publicPath = path.join(__dirname, 'public')
  app.locals.headerPath = path.join(__dirname, 'views', 'includes', 'header.ejs')
  app.locals.footerPath = path.join(__dirname, 'views', 'includes', 'footer.ejs')
  app.locals.sideAksesPath = path.join(__dirname, 'views', 'includes', 'side_akses.ejs')
  app.set('view engine', 'ejs')
  app.use(express.json())
  app.use(cors())


  // app.use(preCheckMiddleware);
  app.use('/', authRoutes);
  app.use('/akses', aksesRoutes);
  app.use('/users', userRoutes);

  app.get('/', (req, res) => {
      if (req.session.user) {
        res.redirect('/akses')
      } else {
        res.redirect('/login')
      }
  })

  app.use((req, res) => {
      res.status(404).render('404', { message: 'Page not found' })
  })

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).render('500', { message: 'Internal Server Error' });
  })
  
  console.log("Mengaktifkan RFID Reader...");
  startRFIDReader();

  server.listen(3003, '::', () => {
    console.log('Server running on http://localhost/ ')
  })

  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    try {
      // await mongoose.disconnect();
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  })
});