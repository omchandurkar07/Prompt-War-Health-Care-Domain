import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const SPECIALIZATIONS = [
  'Cardiologist', 'Neurologist', 'General Physician', 'Dermatologist', 'Dentist',
  'Orthopedic Surgeon', 'Ophthalmologist', 'ENT Specialist', 'Pediatrician',
  'Gynecologist', 'Psychiatrist', 'Gastroenterologist', 'Pulmonologist',
  'Endocrinologist', 'Urologist', 'Nephrologist', 'Oncologist', 'General Surgeon',
  'Rheumatologist'
];

const Register = () => {
  const navigate = useNavigate();
  
  const [userType, setUserType] = useState('patient'); // 'patient' or 'doctor'
  const [step, setStep] = useState(1); // 1: Form, 2: Patient OTP Verify
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Common Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');

  // Patient Fields
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [address, setAddress] = useState('');
  
  // OTP verify
  const [otp, setOtp] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [loginRedirect, setLoginRedirect] = useState('');

  // Doctor Fields
  const [specialization, setSpecialization] = useState('');
  const [experience, setExperience] = useState('');
  const [qualification, setQualification] = useState('');
  const [bio, setBio] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [fee, setFee] = useState('500');
  
  // Doctor availability configs
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState('30');
  const [breakStart, setBreakStart] = useState('13:00');
  const [breakEnd, setBreakEnd] = useState('14:00');
  const [workingDays, setWorkingDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [degreeCert, setDegreeCert] = useState(null);
  const [profileImage, setProfileImage] = useState(null);

  // Doctor slots list generated on form change
  const [generatedSlots, setGeneratedSlots] = useState([]);

  // Calculate doctor slots preview
  useEffect(() => {
    if (userType !== 'doctor') return;
    
    const toMinutes = (t) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const toTime = (m) => {
      return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    };

    const formatTime12 = (t) => {
      const [h, m] = t.split(':').map(Number);
      const ap = h >= 12 ? 'PM' : 'AM';
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
    };

    const startMin = toMinutes(slotStart);
    const endMin = toMinutes(slotEnd);
    const dur = parseInt(slotDuration);
    const brkSMin = breakStart ? toMinutes(breakStart) : -1;
    const brkEMin = breakEnd ? toMinutes(breakEnd) : -1;

    if (!slotStart || !slotEnd || isNaN(dur) || dur <= 0 || startMin >= endMin) {
      setGeneratedSlots([]);
      return;
    }

    const slots = [];
    let cur = startMin;

    while (cur + dur <= endMin) {
      const slotEndVal = cur + dur;
      if (brkSMin >= 0 && brkEMin >= 0) {
        if (!(cur >= brkSMin && cur < brkEMin) && !(slotEndVal > brkSMin && slotEndVal <= brkEMin)) {
          slots.push(formatTime12(toTime(cur)));
        }
      } else {
        slots.push(formatTime12(toTime(cur)));
      }
      cur += dur;
    }
    setGeneratedSlots(slots);
  }, [slotStart, slotEnd, slotDuration, breakStart, breakEnd, userType]);

  const handlePatientSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName || !email || !password || !phone) {
      setError('Please fill in all required fields.');
      return;
    }

    // Client-side sanitization to match backend expectations
    let cleanedPhone = (phone || '').trim().replace(/[^0-9+]/g, '');
    if (cleanedPhone.startsWith('0')) cleanedPhone = cleanedPhone.replace(/^0+/, '');
    if (cleanedPhone.startsWith('+91')) cleanedPhone = cleanedPhone.substring(3);
    if (cleanedPhone.startsWith('91') && cleanedPhone.length === 12) cleanedPhone = cleanedPhone.substring(2);

    setSubmitting(true);
    try {
      const res = await axios.post('/api/register', {
        full_name: fullName,
        email,
        password,
        phone: cleanedPhone,
        dob,
        gender,
        blood_group: bloodGroup,
        address
      });

      if (res.data && res.data.ok) {
        // Trigger send OTP
        const otpRes = await axios.post('/api/register/send-otp');
        if (otpRes.data && otpRes.data.ok) {
          // Get masked phone number
          const verifyRes = await axios.get('/api/register/verify');
          if (verifyRes.data && verifyRes.data.ok) {
            setMaskedPhone(verifyRes.data.masked_phone);
          }
          setStep(2);
        } else {
          setError(otpRes.data.error || 'Failed to send verification OTP.');
        }
      } else {
        setError(res.data.error || 'Registration failed.');
        if (res.data && res.data.redirect) setLoginRedirect(res.data.redirect);
      }
    } catch (err) {
      console.error('Patient registration error:', err);
      setError(err.response?.data?.error || err.message || JSON.stringify(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (otp.length !== 6 || isNaN(otp)) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/register/verify-otp', { otp });
      if (res.data && res.data.ok) {
        setSuccess(res.data.message || 'OTP Verified! Redirecting to Dashboard...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } else {
        setError(res.data.error || 'Incorrect OTP.');
      }
    } catch (err) {
      console.error(err);
      setError('Verification failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await axios.post('/api/register/send-otp');
      if (res.data && res.data.ok) {
        setSuccess('OTP resent successfully.');
      } else {
        setError(res.data.error || 'Failed to resend OTP.');
      }
    } catch (err) {
      console.error(err);
      setError('Resend request failed.');
    }
  };

  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName || !email || !password || !phone || !specialization || !experience) {
      setError('Please fill in all required fields.');
      return;
    }

    // Sanitize phone similar to patient flow
    let cleanedPhone = (phone || '').trim().replace(/[^0-9+]/g, '');
    if (cleanedPhone.startsWith('0')) cleanedPhone = cleanedPhone.replace(/^0+/, '');
    if (cleanedPhone.startsWith('+91')) cleanedPhone = cleanedPhone.substring(3);
    if (cleanedPhone.startsWith('91') && cleanedPhone.length === 12) cleanedPhone = cleanedPhone.substring(2);

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('full_name', fullName);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('phone', cleanedPhone);
      formData.append('specialization', specialization);
      formData.append('experience_years', experience);
      formData.append('qualification', qualification);
      formData.append('bio', bio);
      formData.append('hospital_name', hospitalName);
      formData.append('clinic_address', clinicAddress);
      formData.append('city', city);
      formData.append('state', state);
      formData.append('pincode', pincode);
      formData.append('consultation_fee', fee);
      formData.append('slot_start', slotStart);
      formData.append('slot_end', slotEnd);
      formData.append('slot_duration', slotDuration);
      formData.append('break_start', breakStart);
      formData.append('break_end', breakEnd);
      formData.append('available_days', workingDays.join(','));

      if (profileImage) formData.append('profile_image', profileImage);
      if (degreeCert) formData.append('degree_certificate', degreeCert);

      const res = await axios.post('/api/doctor/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.ok) {
        setSuccess(res.data.message || 'Registration successful! You can now log in.');
        setTimeout(() => {
          navigate('/login?type=doctor');
        }, 2000);
      } else {
        setError(res.data.error || 'Doctor registration failed.');
      }
    } catch (err) {
      console.error('Doctor registration error:', err);
      setError(err.response?.data?.error || err.message || JSON.stringify(err));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDay = (day) => {
    if (workingDays.includes(day)) {
      setWorkingDays(prev => prev.filter(d => d !== day));
    } else {
      setWorkingDays(prev => [...prev, day]);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 'calc(100vh - 120px)',
      padding: '40px 20px',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #eff6ff 100%)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: userType === 'doctor' && step === 1 ? '720px' : '520px',
        padding: '36px',
        boxSizing: 'border-box',
        borderRadius: '24px',
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)',
      }}>
        
        {/* Glow Logo Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          boxShadow: '0 8px 16px rgba(59, 130, 246, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: '1.6rem',
          fontWeight: 900,
          margin: '0 auto 20px',
          transition: 'transform 0.3s ease',
        }}>
          ✚
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 850, letterSpacing: '-0.03em', color: '#0f172a', margin: 0 }}>Create Account</h2>
          <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '4px' }}>Join the premium HMS network</p>
        </div>

        {/* Sliding Tabs (Only in Step 1) */}
        {step === 1 && (
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', marginBottom: '24px' }}>
            <button
              className="btn"
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                backgroundColor: userType === 'patient' ? '#ffffff' : 'transparent',
                color: userType === 'patient' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: userType === 'patient' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer'
              }}
              onClick={() => {
                setUserType('patient');
                setError('');
              }}
            >
              Patient Portal
            </button>
            <button
              className="btn"
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                backgroundColor: userType === 'doctor' ? '#ffffff' : 'transparent',
                color: userType === 'doctor' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: userType === 'doctor' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer'
              }}
              onClick={() => {
                setUserType('doctor');
                setError('');
              }}
            >
              Doctor Console
            </button>
          </div>
        )}

        {/* Error / Success Notifications */}
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '20px', padding: '10px 14px', fontSize: '0.85rem' }}>
            ❌ &nbsp;{error}
            {loginRedirect && (
              <div style={{ marginTop: '8px' }}>
                <a href={loginRedirect} style={{ fontWeight: 700, color: 'var(--primary)' }}>Go to Login</a>
              </div>
            )}
          </div>
        )}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: '20px', padding: '10px 14px', fontSize: '0.85rem' }}>
            ✅ &nbsp;{success}
          </div>
        )}

        {/* STEP 1: PATIENT REGISTRATION FORM */}
        {userType === 'patient' && step === 1 && (
          <form onSubmit={handlePatientSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', fontSize: '0.95rem', fontWeight: 700 }}>Personal Details</h4>
            
            <div className="row g-3">
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Full Name *</label>
                <input type="text" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Phone *</label>
                <input type="tel" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="10-digit number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Email *</label>
                <input type="email" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="john@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Password *</label>
                <input type="password" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} minLength="6" required />
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-4">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Date of Birth</label>
                <input type="date" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
              <div className="col-md-4">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Gender</label>
                <select className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="col-md-4">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Blood Group</label>
                <select className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                  <option value="">Select</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Residential Address</label>
              <textarea className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="Full street address" rows="2" value={address} onChange={(e) => setAddress(e.target.value)}></textarea>
            </div>

            <button type="submit" className="btn w-100" style={{
              padding: '12px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.95rem',
              color: '#ffffff',
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              boxShadow: '0 8px 16px rgba(37, 99, 235, 0.2)',
              marginTop: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }} disabled={submitting}>
              {submitting ? 'Registering...' : 'Request OTP Verification'}
            </button>
          </form>
        )}

        {/* STEP 2: PATIENT OTP VERIFY */}
        {userType === 'patient' && step === 2 && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '3rem' }}>📱</span>
              <h4 style={{ marginTop: '10px', fontSize: '1.1rem', fontWeight: 700 }}>Enter Verification Code</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>We have sent a 6-digit OTP code by SMS to your mobile number: <strong>{maskedPhone}</strong></p>
            </div>

            <div>
              <input
                type="text"
                className="hero-input w-100 text-center"
                style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1.25rem', letterSpacing: '4px', fontWeight: 700 }}
                placeholder="000000"
                maxLength="6"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn w-100" style={{
              padding: '12px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.95rem',
              color: '#ffffff',
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              boxShadow: '0 8px 16px rgba(37, 99, 235, 0.2)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }} disabled={submitting}>
              {submitting ? 'Verifying...' : 'Verify & Log In'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: '4px' }}>
              <button type="button" className="btn-link" onClick={() => setStep(1)}>
                ⬅ Edit Form
              </button>
              <button type="button" className="btn-link text-primary" style={{ fontWeight: 600 }} onClick={handleResendOtp}>
                🔄 Resend Code
              </button>
            </div>
          </form>
        )}

        {/* STEP 1: DOCTOR REGISTRATION FORM */}
        {userType === 'doctor' && step === 1 && (
          <form onSubmit={handleDoctorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <h4 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', fontSize: '0.95rem', fontWeight: 700 }}>1. Personal & Account Details</h4>
            <div className="row g-3">
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Full Name *</label>
                <input type="text" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="Dr. John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Phone *</label>
                <input type="tel" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Email *</label>
                <input type="email" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="doctor@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Password *</label>
                <input type="password" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} minLength="6" required />
              </div>
            </div>

            <h4 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', fontSize: '0.95rem', fontWeight: 700, marginTop: '12px' }}>2. Professional Details</h4>
            <div className="row g-3">
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Specialization *</label>
                <select className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} value={specialization} onChange={(e) => setSpecialization(e.target.value)} required>
                  <option value="">SelectSpecialization</option>
                  {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Experience (years) *</label>
                <input type="number" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="e.g. 10" value={experience} onChange={(e) => setExperience(e.target.value)} min="0" max="50" required />
              </div>
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Qualifications</label>
                <input type="text" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="MBBS, MD, DM..." value={qualification} onChange={(e) => setQualification(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Consultation Fee (₹)</label>
                <input type="number" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} value={fee} onChange={(e) => setFee(e.target.value)} min="0" />
              </div>
              <div className="col-md-12">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Professional Bio</label>
                <textarea className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="Brief description of your clinical expertise..." rows="2" value={bio} onChange={(e) => setBio(e.target.value)}></textarea>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Profile Image</label>
                <input type="file" accept="image/*" style={{ fontSize: '0.82rem' }} onChange={(e) => setProfileImage(e.target.files[0])} />
              </div>
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Degree / Registration Certificate File</label>
                <input type="file" accept="image/*,application/pdf" style={{ fontSize: '0.82rem' }} onChange={(e) => setDegreeCert(e.target.files[0])} />
              </div>
            </div>

            <h4 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', fontSize: '0.95rem', fontWeight: 700, marginTop: '12px' }}>3. Practice Location</h4>
            <div className="row g-3">
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Hospital / Clinic Name</label>
                <input type="text" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="City Cardiac Care" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} />
              </div>
              <div className="col-md-6">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Clinic Address</label>
                <input type="text" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="Full street address" value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} />
              </div>
              <div className="col-md-4">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>City</label>
                <input type="text" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="Pune" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="col-md-4">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>State</label>
                <input type="text" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="Maharashtra" value={state} onChange={(e) => setState(e.target.value)} />
              </div>
              <div className="col-md-4">
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Pincode</label>
                <input type="text" className="hero-input w-100" style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} placeholder="411001" value={pincode} onChange={(e) => setPincode(e.target.value)} />
              </div>
            </div>

            <h4 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', fontSize: '0.95rem', fontWeight: 700, marginTop: '12px' }}>4. Working Hours & Slot Config</h4>
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Shift Start Time</label>
                  <input type="time" className="hero-input w-100" style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} value={slotStart} onChange={(e) => setSlotStart(e.target.value)} required />
                </div>
                <div className="col-md-4">
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Shift End Time</label>
                  <input type="time" className="hero-input w-100" style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} required />
                </div>
                <div className="col-md-4">
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Slot Duration</label>
                  <select className="hero-input w-100" style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} value={slotDuration} onChange={(e) => setSlotDuration(e.target.value)} required>
                    <option value="15">15 min</option>
                    <option value="20">20 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Break Start Time</label>
                  <input type="time" className="hero-input w-100" style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Break End Time</label>
                  <input type="time" className="hero-input w-100" style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem' }} value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
                </div>
              </div>

              {/* Working Days */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>Working Days</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: workingDays.includes(day) ? 'var(--primary)' : '#ffffff',
                        color: workingDays.includes(day) ? '#ffffff' : 'var(--text-muted)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview */}
              {generatedSlots.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '8px' }}>
                    📋 Live Slots Preview ({generatedSlots.length} slots generated)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                    {generatedSlots.map((s, idx) => (
                      <span key={idx} style={{ padding: '4px 8px', background: '#e2e8f0', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="btn w-100" style={{
              padding: '12px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.95rem',
              color: '#ffffff',
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              boxShadow: '0 8px 16px rgba(37, 99, 235, 0.2)',
              marginTop: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }} disabled={submitting}>
              {submitting ? 'Submitting Registration...' : 'Submit Doctor Application'}
            </button>
          </form>
        )}

        {/* Footer Link */}
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.88rem', color: '#64748b', fontWeight: 500 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}>
            Log in here
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Register;
