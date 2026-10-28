require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const connectDB = require('./config/db');
const { startMlHelper } = require('./services/mlHelperService');

const app = express();
const PORT = process.env.PORT || 3000;
const sessionSecret = process.env.SECRET_KEY;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('Set SECRET_KEY to a unique random value of at least 32 characters.');
}

// Ensure uploads folders exist
const uploadsDirs = [
  path.join(__dirname, 'static/uploads'),
  path.join(__dirname, 'static/uploads/records'),
  path.join(__dirname, 'static/uploads/prescriptions'),
  path.join(__dirname, 'static/uploads/temp')
];
uploadsDirs.forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

// Middleware for parsing requests
app.use(express.json({
  verify: (req, res, buffer) => {
    if (req.originalUrl === '/api/payments/webhook') {
      req.rawBody = Buffer.from(buffer);
    }
  }
}));
app.use(express.urlencoded({ extended: true }));

// Enable CORS for React Frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  credentials: true
}));

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'static')));

const createSessionMiddleware = () => {
  const clientPromise = new Promise((resolve, reject) => {
    if (mongoose.connection.readyState === 1) {
      resolve(mongoose.connection.getClient());
    } else {
      mongoose.connection.once('open', () => {
        resolve(mongoose.connection.getClient());
      });
      mongoose.connection.once('error', (err) => {
        reject(err);
      });
    }
  });

  const store = MongoStore.create({
    clientPromise,
    collectionName: 'sessions'
  });

  return session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    }
  });
};

// Register session middleware synchronously
app.use(createSessionMiddleware());

// Custom flash message middleware
app.use((req, res, next) => {
  // Flash function on request
  req.flash = (type, message) => {
    if (!req.session) return [];
    if (message) {
      if (!req.session.flash) req.session.flash = {};
      if (!req.session.flash[type]) req.session.flash[type] = [];
      req.session.flash[type].push(message);
    } else {
      if (!req.session.flash) return [];
      const messages = req.session.flash[type] || [];
      delete req.session.flash[type];
      return messages;
    }
  };

  // Flash getter helper for templates
  res.locals.get_flashed_messages = (options = {}) => {
    if (!req.session || !req.session.flash) return [];
    const withCategories = options.with_categories || false;
    const result = [];
    
    for (const [cat, msgs] of Object.entries(req.session.flash)) {
      if (withCategories) {
        msgs.forEach(m => result.push([cat, m]));
      } else {
        result.push(...msgs);
      }
    }
    
    // Clear flash after retrieving
    req.session.flash = {};
    return result;
  };

  // Expose session variables directly to all templates
  res.locals.session = req.session;
  res.locals.request = {
    args: {
      get: (key) => req.query[key] || ''
    }
  };
  res.locals.url_for = (endpoint, params = {}) => {
    switch (endpoint) {
      case 'admin_approve_doctor':
        return `/admin/doctor/approve/${params.did}`;
      case 'admin_reject_doctor':
        return `/admin/doctor/reject/${params.did}`;
      case 'admin_remove_doctor':
        return `/admin/doctor/remove/${params.did}`;
      case 'allergy.add_allergy':
        return '/my-allergies/add';
      case 'allergy.delete_allergy':
        return `/my-allergies/delete/${params.aid}`;
      case 'cancel_appt':
        return `/appointment/cancel/${params.aid}`;
      case 'doctor_accept':
        return `/doctor/appointment/${params.aid}/accept`;
      case 'doctor_reject':
        return `/doctor/appointment/${params.aid}/reject`;
      case 'doctor_complete':
        return `/doctor/appointment/${params.aid}/complete`;
      case 'doctor_delete_patient_record':
        return `/doctor/patient/${params.pid}/records/delete/${params.rid}`;
      case 'doctor_patient_records':
        return `/doctor/patient/${params.pid || params.patient_id}/records`;
      case 'doctors_list':
        return `/doctors${params.spec ? '?spec=' + encodeURIComponent(params.spec) : ''}`;
      case 'family.add_member':
        return '/family/add';
      case 'family.delete_member':
        return `/family/delete/${params.mid}`;
      case 'family.family_list':
        return '/family';
      case 'family.mark_vaccine':
        return `/family/${params.mid}/vaccine/mark`;
      case 'family.vaccination_schedule':
        return `/family/${params.mid}/vaccines`;
      case 'health_locker.delete_record':
        return `/health-locker/delete/${params.rid}`;
      case 'health_locker.health_locker':
        return `/health-locker${params.member ? '?member=' + params.member : ''}`;
      case 'health_locker.upload_record':
        return '/health-locker/upload';
      case 'health_passport.generate_passport':
        return '/health-passport/generate';
      case 'health_passport.verify_passport':
        return `/verify-passport/${params.token}`;
      case 'health_tracker.download_health_report':
        return '/health-tracker/download-report';
      case 'health_tracker.start_tracking':
        return '/health-tracker/start';
      case 'health_tracker.stop_tracking':
        return '/health-tracker/stop';
      case 'my_appointments':
        return '/my-appointments';
      case 'prescription.download_prescription_pdf':
        return `/prescriptions/${params.rx_id}/download`;
      case 'prescription.prescription_detail_doctor':
        return `/doctor/prescription/view/${params.rx_id}`;
      case 'prescription.prescriptions_doctor':
        return '/doctor/prescriptions';
      case 'prescription.regenerate_prescription_ai':
        return `/doctor/prescription/regenerate/${params.rx_id}`;
      case 'prescription.write_prescription':
        return `/doctor/prescription/create/${params.aid}`;
      case 'preventive.mark_done':
        return '/preventive-care/mark-done';
      case 'queue.add_walkin':
        return '/doctor/queue/add-walkin';
      case 'queue.public_queue':
        return `/queue/public/${params.doctor_id}/${params.queue_date}`;
      case 'session_complete':
        return `/consultation/complete/${params.aid}`;
      case 'start_consultation':
        return `/consultation/start/${params.did}/${params.session_type || 'video'}`;
      case 'toggle_availability':
        return '/doctor/toggle-availability';
      default:
        console.warn(`[url_for] Unmapped endpoint: ${endpoint}`, params);
        return '#';
    }
  };
  next();
});

// EJS Layout Engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout'); // Defaults to layout.ejs

// Import routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const ambulanceRoutes = require('./routes/ambulance');
const healthLockerRoutes = require('./routes/healthLocker');
const carePlanRoutes = require('./routes/carePlan');
const familyRoutes = require('./routes/family');
const prescriptionRoutes = require('./routes/prescription');
const preventiveRoutes = require('./routes/preventive');
const queueRoutes = require('./routes/queue');
const visitPrepRoutes = require('./routes/visitPrep');
const allergyRoutes = require('./routes/allergy');
const healthTrackerRoutes = require('./routes/healthTracker');
const healthPassportRoutes = require('./routes/healthPassport');
const patientRoutes = require('./routes/patient');
const doctorRoutes = require('./routes/doctor');
const consultationRoutes = require('./routes/consultation');
const adminRoutes = require('./routes/admin');
const cronRoutes = require('./routes/cron');
const paymentRoutes = require('./routes/payments');

// Mount API routes
app.use('/api', indexRoutes);
app.use('/api', authRoutes);
app.use('/api', ambulanceRoutes);
app.use('/api', healthLockerRoutes);
app.use('/api', carePlanRoutes);
app.use('/api', familyRoutes);
app.use('/api', prescriptionRoutes);
app.use('/api', preventiveRoutes);
app.use('/api', queueRoutes);
app.use('/api', visitPrepRoutes);
app.use('/api', allergyRoutes);
app.use('/api', healthTrackerRoutes);
app.use('/api', healthPassportRoutes);
app.use('/api', doctorRoutes);
app.use('/api', paymentRoutes);
app.use('/api', patientRoutes);
app.use('/api', consultationRoutes);
app.use('/api', adminRoutes);
app.use('/api', cronRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// API 404 Handler
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API Endpoint not found' });
});

// Serve React SPA in production
app.use(express.static(path.join(__dirname, 'client/dist')));
app.use((req, res) => {
  const indexFile = path.join(__dirname, 'client/dist/index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).send('React production build not found. Please run build first or use Vite dev server.');
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  const logPath = path.join(__dirname, 'express_error.log');
  try {
    fs.appendFileSync(logPath, `\n--- Exception at ${new Date().toISOString()} ---\n${err.stack}\n`);
  } catch (logErr) {
    console.error('Failed to log express exception:', logErr);
  }
  res.status(500).send(`Internal Server Error: ${err.message}`);
});

const startServer = async () => {
  try {
    await connectDB();
    try {
      await startMlHelper();
    } catch (mlError) {
      console.warn('[WARNING] ML helper service failed to start:', mlError.message || mlError);
      console.warn('[WARNING] Symptom checker routes may be unavailable until the ML helper service is running.');
    }

    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(55));
      console.log(`  UltraCare HMS - Express Backend Running`);
      console.log(`  URL  : http://localhost:${PORT}`);
      console.log(`  Admin: http://localhost:${PORT}/admin/login`);
      console.log('='.repeat(55) + '\n');
    });
  } catch (error) {
    console.error('[FATAL] Failed to start server due to database connection error.');
    process.exit(1);
  }
};

startServer();
