const express = require('express');
const router = express.Router();
const dns = require('dns');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Admin = require('../models/Admin');
const OtpSession = require('../models/OtpSession');
const Notification = require('../models/Notification');
const Appointment = require('../models/Appointment');

const { sendFast2SmsOtp, verifyFast2SmsOtp } = require('../services/fast2SmsService');

// Multer storage configuration for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../static/uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = file.fieldname === 'degree_certificate' ? 'doc_cert' : 'doc';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${prefix}_${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage });

const SPECIALIZATIONS = [
  'Cardiologist', 'Neurologist', 'General Physician', 'Dermatologist', 'Dentist',
  'Orthopedic Surgeon', 'Ophthalmologist', 'ENT Specialist', 'Pediatrician',
  'Gynecologist', 'Psychiatrist', 'Gastroenterologist', 'Pulmonologist',
  'Endocrinologist', 'Urologist', 'Nephrologist', 'Oncologist', 'General Surgeon',
  'Rheumatologist'
];

// Helper to check email domain
const isValidEmailDomain = (email) => {
  return new Promise((resolve) => {
    const parts = email.split('@');
    if (parts.length !== 2) return resolve(false);
    const domain = parts[1];
    dns.lookup(domain, (err) => {
      if (err) resolve(false);
      else resolve(true);
    });
  });
};

// ==================== PATIENT REGISTER & LOGIN ====================

router.get('/register', (req, res) => {
  res.json({ error: 'Use React registration page' });
});

router.post('/register', async (req, res) => {
  const { full_name, email, password, phone, dob, gender, blood_group, address } = req.body;
  const nextPage = req.body.next || '';

  const cleanedEmail = (email || '').trim().toLowerCase();
    let domainValid = true;
    try {
      domainValid = await isValidEmailDomain(cleanedEmail);
    } catch (dnsErr) {
      console.warn('[register] DNS check failed, allowing registration if other validations pass:', dnsErr && dnsErr.message ? dnsErr.message : dnsErr);
      domainValid = true;
    }
    if (!domainValid) {
      // DNS lookup returned false — log a warning but do not block registration because
      // some environments (CI, offline dev) may not allow DNS lookups. Proceed and
      // allow registration; the frontend will still verify the mobile number by SMS OTP.
      console.warn(`[register] Domain lookup returned false for ${cleanedEmail} — proceeding.`);
    }

  // Format phone number
  let cleanedPhone = (phone || '').trim().replace(/[\s-]/g, '');
  if (cleanedPhone.startsWith('+91')) {
    cleanedPhone = cleanedPhone.substring(3);
  }
  if (cleanedPhone.startsWith('91') && cleanedPhone.length === 12) {
    cleanedPhone = cleanedPhone.substring(2);
  }

  if (!cleanedPhone || cleanedPhone.length !== 10 || isNaN(cleanedPhone)) {
    return res.json({ ok: false, error: 'Please enter a valid 10-digit phone number for OTP verification.' });
  }

  try {
    const patientExists = await Patient.findOne({ email: cleanedEmail });
    if (patientExists) {
      return res.json({ ok: false, error: 'Email already registered.', redirect: `/login?next=${encodeURIComponent(nextPage)}` });
    }

    const doctorExists = await Doctor.findOne({ email: cleanedEmail });
    if (doctorExists) {
      return res.json({ ok: false, error: 'Email registered as doctor.', redirect: '/doctor/login' });
    }

    req.session.reg_data = {
      full_name: full_name.trim(),
      email: cleanedEmail,
      password: password,
      phone: cleanedPhone,
      dob: dob || '',
      gender: gender || '',
      blood_group: blood_group || '',
      address: address || ''
    };

    res.json({ ok: true, redirect: '/register/verify' });
  } catch (error) {
    res.json({ ok: false, error: `Registration error: ${error.message}` });
  }
});

router.get('/register/verify', (req, res) => {
  if (!req.session.reg_data) {
    return res.json({ ok: false, error: 'Please fill the registration form first.', redirect: '/register' });
  }
  const phone = req.session.reg_data.phone;
  const maskedPhone = `${'*'.repeat(6)}${phone.slice(-4)}`;

  res.json({ ok: true, masked_phone: maskedPhone });
});

router.post('/register/send-otp', async (req, res) => {
  if (!req.session.reg_data) {
    return res.json({ ok: false, error: 'Session expired. Please register again.' });
  }
  const phone = req.session.reg_data.phone;

  try {
    // Check cooldown
    const lastSession = await OtpSession.findOne({ phone, purpose: 'registration' }).sort({ created_at: -1 });
    if (lastSession) {
      const diff = (Date.now() - new Date(lastSession.created_at).getTime()) / 1000;
      if (diff < 60) {
        const remaining = Math.ceil(60 - diff);
        return res.json({ ok: false, error: `Please wait ${remaining}s before requesting a new OTP.`, cooldown: remaining });
      }
    }

    // Generate 6 digit OTP
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Delete previous OTPs
    await OtpSession.deleteMany({ phone, purpose: 'registration' });

    const newOtp = new OtpSession({
      phone,
      otp_code: otpCode,
      purpose: 'registration',
      expires_at: expiresAt
    });
    await newOtp.save();

    try {
      await sendFast2SmsOtp(phone, otpCode);
      res.json({ ok: true, message: 'OTP sent to your registered mobile number.' });
    } catch (sendError) {
      await OtpSession.deleteOne({ _id: newOtp._id });
      console.error('[OTP-SMS] Registration OTP delivery failed:', sendError.message);
      res.status(502).json({ ok: false, error: sendError.message });
    }
  } catch (error) {
    console.error('[OTP-SMS] Registration OTP request failed:', error.message);
    res.status(500).json({ ok: false, error: 'Unable to send the verification OTP.' });
  }
});

router.post('/register/verify-otp', async (req, res) => {
  if (!req.session.reg_data) {
    return res.json({ ok: false, error: 'Session expired. Please register again.', redirect: '/register' });
  }

  const { otp } = req.body;
  const enteredOtp = (otp || '').trim();
  if (!enteredOtp || enteredOtp.length !== 6) {
    return res.json({ ok: false, error: 'Please enter a valid 6-digit OTP.' });
  }

  const phone = req.session.reg_data.phone;

  try {
    const otpRow = await OtpSession.findOne({ phone, purpose: 'registration', is_verified: false }).sort({ created_at: -1 });
    if (!otpRow) {
      return res.json({ ok: false, error: 'No OTP found. Please request a new one.' });
    }

    if (new Date() > new Date(otpRow.expires_at)) {
      await OtpSession.deleteOne({ _id: otpRow._id });
      return res.json({ ok: false, error: 'OTP has expired. Please request a new one.' });
    }

    if (otpRow.attempts >= 3) {
      await OtpSession.deleteOne({ _id: otpRow._id });
      return res.json({ ok: false, error: 'Too many attempts. Please request a new OTP.' });
    }

    if (enteredOtp !== otpRow.otp_code) {
      otpRow.attempts += 1;
      await otpRow.save();
      const remaining = 3 - otpRow.attempts;
      return res.json({ ok: false, error: `Incorrect OTP. ${remaining} attempt(s) remaining.` });
    }

    const providerVerified = await verifyFast2SmsOtp(phone, enteredOtp);
    if (!providerVerified) {
      otpRow.attempts += 1;
      await otpRow.save();
      return res.json({ ok: false, error: 'Fast2SMS could not verify this code. Check it and try again.' });
    }

    // OTP verified
    otpRow.is_verified = true;
    await otpRow.save();

    const reg = req.session.reg_data;
    const passwordHash = await bcrypt.hash(reg.password, 10);

    const newPatient = new Patient({
      full_name: reg.full_name,
      email: reg.email,
      password_hash: passwordHash,
      phone: reg.phone,
      dob: reg.dob,
      gender: reg.gender,
      blood_group: reg.blood_group,
      address: reg.address,
      is_verified: true
    });
    const patient = await newPatient.save();

    // Clean up OTPs
    await OtpSession.deleteMany({ phone, purpose: 'registration' });

    // Session log in
    req.session.patient_id = patient._id;
    req.session.patient_name = patient.full_name;
    req.session.role = 'patient';

    const redirectUrl = req.session.next_page || '/dashboard';
    delete req.session.reg_data;
    delete req.session.next_page;

    res.json({ ok: true, message: `Welcome to UltraCare, ${patient.full_name.split(' ')[0]}! 🎉`, redirect: redirectUrl });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

router.post('/register/resend-otp', async (req, res) => {
  // Alias for send-otp
  res.redirect(307, '/register/send-otp');
});

router.get('/login', (req, res) => {
  res.json({ error: 'Use React login page' });
});

router.get('/me', async (req, res) => {
  try {
    if (req.session.patient_id) {
      const patient = await Patient.findById(req.session.patient_id);
      return res.json({ 
        loggedIn: true, 
        role: 'patient', 
        user: { 
          id: req.session.patient_id, 
          name: req.session.patient_name,
          profile_image: patient ? patient.profile_image : ''
        } 
      });
    }
    if (req.session.doctor_id) {
      const doctor = await Doctor.findById(req.session.doctor_id);
      return res.json({ 
        loggedIn: true, 
        role: 'doctor', 
        user: { 
          id: req.session.doctor_id, 
          name: req.session.doctor_name,
          profile_image: doctor ? doctor.profile_image : ''
        } 
      });
    }
    if (req.session.admin_id) {
      return res.json({ loggedIn: true, role: 'admin', user: { id: req.session.admin_id, name: req.session.admin_name } });
    }
    res.json({ loggedIn: false });
  } catch (error) {
    res.json({ loggedIn: false, error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password, next } = req.body;
  const cleanedEmail = (email || '').trim().toLowerCase();

  try {
    const patient = await Patient.findOne({ email: cleanedEmail });
    if (!patient || !(await bcrypt.compare(password, patient.password_hash))) {
      return res.json({ ok: false, error: 'Invalid email or password.' });
    }

    req.session.patient_id = patient._id;
    req.session.patient_name = patient.full_name;
    req.session.role = 'patient';

    res.json({ ok: true, message: `Welcome back, ${patient.full_name.split(' ')[0]}!`, redirect: next || '/dashboard', user: { id: patient._id, name: patient.full_name, role: 'patient' } });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ==================== DOCTOR REGISTER & LOGIN ====================

router.get('/doctor/register', (req, res) => {
  res.json({ specializations: SPECIALIZATIONS });
});

router.post('/doctor/register', upload.fields([
  { name: 'profile_image', maxCount: 1 },
  { name: 'degree_certificate', maxCount: 1 }
]), async (req, res) => {
  const f = req.body;
  const email = (f.email || '').trim().toLowerCase();

    let domainValidDoc = true;
    try {
      domainValidDoc = await isValidEmailDomain(email);
    } catch (dnsErr) {
      console.warn('[doctor.register] DNS check failed, allowing registration if other validations pass:', dnsErr && dnsErr.message ? dnsErr.message : dnsErr);
      domainValidDoc = true;
    }
    if (!domainValidDoc) {
      console.warn(`[doctor.register] Domain lookup returned false for ${email} — proceeding.`);
    }

  try {
    const docExists = await Doctor.findOne({ email });
    if (docExists) {
      return res.json({ ok: false, error: 'Email already registered as doctor.' });
    }

    const patientExists = await Patient.findOne({ email });
    if (patientExists) {
      return res.json({ ok: false, error: 'Email registered as patient. Use different email.' });
    }

    const pw = await bcrypt.hash(f.password, 10);

    const profileImagePath = req.files['profile_image'] ? `/static/uploads/${req.files['profile_image'][0].filename}` : '/static/images/default_doctor.svg';
    const certPath = req.files['degree_certificate'] ? `/static/uploads/${req.files['degree_certificate'][0].filename}` : '';

    const newDoc = new Doctor({
      full_name: f.full_name.trim(),
      email,
      password_hash: pw,
      phone: f.phone || '',
      specialization: f.specialization,
      qualification: f.qualification || '',
      experience_years: parseInt(f.experience_years || 0),
      bio: f.bio || '',
      profile_image: profileImagePath,
      hospital_name: f.hospital_name || '',
      clinic_address: f.clinic_address || '',
      city: f.city || '',
      state: f.state || '',
      pincode: f.pincode || '',
      consultation_fee: parseInt(f.consultation_fee || 500),
      available_days: f.available_days || 'Mon,Tue,Wed,Thu,Fri',
      slot_start: f.slot_start || '09:00',
      slot_end: f.slot_end || '17:00',
      slot_duration: parseInt(f.slot_duration || 30),
      break_start: f.break_start || '13:00',
      break_end: f.break_end || '14:00',
      degree_certificate: certPath,
      is_approved: true // Default active registration from app.py line 1254 (marked 1 at the end of columns list)
    });

    await newDoc.save();
    res.json({ ok: true, message: 'Registration successful! Your doctor account is active. You can log in now.' });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

router.get('/doctor/login', (req, res) => {
  res.json({ error: 'Use React doctor login page' });
});

router.post('/doctor/login', async (req, res) => {
  const { email, password } = req.body;
  const cleanedEmail = (email || '').trim().toLowerCase();

  try {
    const doctor = await Doctor.findOne({ email: cleanedEmail });
    if (!doctor || !(await bcrypt.compare(password, doctor.password_hash))) {
      return res.json({ ok: false, error: 'Invalid credentials.' });
    }

    if (!doctor.is_approved) {
      return res.json({ ok: false, error: 'Your account is pending admin approval.' });
    }

    req.session.doctor_id = doctor._id;
    req.session.doctor_name = doctor.full_name;
    req.session.role = 'doctor';

    doctor.last_active = new Date();
    await doctor.save();

    const parts = doctor.full_name.split(' ');
    const firstName = parts[1] && doctor.full_name.startsWith('Dr. ') ? parts[1] : (parts[0] || 'Doctor');

    res.json({ ok: true, message: `Welcome, Dr. ${firstName}!`, redirect: '/doctor/dashboard', user: { id: doctor._id, name: doctor.full_name, role: 'doctor' } });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

router.get('/doctor/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ==================== ADMIN AUTH ====================

router.get('/admin/login', (req, res) => {
  res.json({ error: 'Use React admin login page' });
});

router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await Admin.findOne({ username: (username || '').trim().toLowerCase() });
    if (admin && (await bcrypt.compare(password, admin.password_hash))) {
      req.session.admin_id = admin._id;
      req.session.admin_name = admin.full_name || admin.username;
      req.session.role = 'admin';
      return res.json({ ok: true, redirect: '/admin', user: { id: admin._id, name: admin.full_name, role: 'admin' } });
    }
    res.json({ ok: false, error: 'Invalid credentials.' });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

// ==================== FORGOT & RESET PASSWORD ====================

router.post('/forgot-password', async (req, res) => {
  const { email, userType } = req.body;
  const cleanedEmail = (email || '').trim().toLowerCase();

  try {
    let user = null;
    if (userType === 'doctor') {
      user = await Doctor.findOne({ email: cleanedEmail });
    } else {
      user = await Patient.findOne({ email: cleanedEmail });
    }

    if (!user) {
      return res.json({ ok: false, error: 'Email address not registered.' });
    }

    const phone = String(user.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ ok: false, error: 'No valid mobile number is saved for this account. Contact support to update it.' });
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await OtpSession.deleteMany({ phone, purpose: 'forgot_password' });

    const newOtp = new OtpSession({
      phone,
      otp_code: otpCode,
      purpose: 'forgot_password',
      expires_at: expiresAt
    });
    await newOtp.save();

    try {
      await sendFast2SmsOtp(phone, otpCode);
      req.session.forgot_password_data = {
        email: cleanedEmail,
        userType,
        phone
      };
      res.json({ ok: true, message: `OTP sent by SMS to the mobile number ending in ${phone.slice(-4)}.` });
    } catch (sendError) {
      await OtpSession.deleteOne({ _id: newOtp._id });
      console.error('[OTP-SMS] Password reset OTP delivery failed:', sendError.message);
      res.status(502).json({ ok: false, error: sendError.message });
    }
  } catch (error) {
    console.error('[OTP-SMS] Password reset OTP request failed:', error.message);
    res.status(500).json({ ok: false, error: 'Unable to send the password reset OTP.' });
  }
});

router.post('/reset-password', async (req, res) => {
  if (!req.session.forgot_password_data) {
    return res.json({ ok: false, error: 'Session expired. Please request OTP again.' });
  }

  const { otp, newPassword } = req.body;
  const { email, userType, phone } = req.session.forgot_password_data;

  const enteredOtp = (otp || '').trim();
  if (!enteredOtp || enteredOtp.length !== 6) {
    return res.json({ ok: false, error: 'Please enter a valid 6-digit OTP.' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.json({ ok: false, error: 'Password must be at least 6 characters long.' });
  }

  try {
    const otpRow = await OtpSession.findOne({ phone, purpose: 'forgot_password', is_verified: false }).sort({ created_at: -1 });
    if (!otpRow) {
      return res.json({ ok: false, error: 'No active OTP session found.' });
    }

    if (new Date() > new Date(otpRow.expires_at)) {
      await OtpSession.deleteOne({ _id: otpRow._id });
      return res.json({ ok: false, error: 'OTP has expired. Please request a new one.' });
    }

    if (otpRow.attempts >= 3) {
      await OtpSession.deleteOne({ _id: otpRow._id });
      return res.json({ ok: false, error: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    if (enteredOtp !== otpRow.otp_code) {
      otpRow.attempts += 1;
      await otpRow.save();
      const remaining = 3 - otpRow.attempts;
      return res.json({ ok: false, error: `Incorrect OTP. ${remaining} attempt(s) remaining.` });
    }

    const providerVerified = await verifyFast2SmsOtp(phone, enteredOtp);
    if (!providerVerified) {
      otpRow.attempts += 1;
      await otpRow.save();
      return res.json({ ok: false, error: 'Fast2SMS could not verify this code. Check it and try again.' });
    }

    // OTP is valid, hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    if (userType === 'doctor') {
      await Doctor.findOneAndUpdate({ email }, { password_hash: passwordHash });
    } else {
      await Patient.findOneAndUpdate({ email }, { password_hash: passwordHash });
    }

    // Verify OTP session
    otpRow.is_verified = true;
    await otpRow.save();

    delete req.session.forgot_password_data;
    res.json({ ok: true, message: 'Password has been reset successfully.' });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

module.exports = router;
