import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const DoctorProfile = () => {
  const { checkAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    specialization: '',
    qualification: '',
    experience_years: '',
    bio: '',
    hospital_name: '',
    clinic_address: '',
    city: '',
    state: '',
    pincode: '',
    consultation_fee: '',
    home_visit_available: false,
    home_visit_fee: '',
    available_days: '',
    slot_start: '',
    slot_end: '',
    slot_duration: '',
    break_start: '',
    break_end: ''
  });
  const [specializations, setSpecializations] = useState([]);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [currentImage, setCurrentImage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchProfile = async () => {
    try {
      const res = await axios.get('/api/doctor/profile');
      if (res.data && res.data.ok) {
        const d = res.data.doctor;
        setProfileForm({
          full_name: d.full_name || '',
          phone: d.phone || '',
          specialization: d.specialization || '',
          qualification: d.qualification || '',
          experience_years: d.experience_years || 0,
          bio: d.bio || '',
          hospital_name: d.hospital_name || '',
          clinic_address: d.clinic_address || '',
          city: d.city || '',
          state: d.state || '',
          pincode: d.pincode || '',
          consultation_fee: d.consultation_fee || 500,
          home_visit_available: d.home_visit_available || false,
          home_visit_fee: d.home_visit_fee || 0,
          available_days: d.available_days || 'Mon,Tue,Wed,Thu,Fri',
          slot_start: d.slot_start || '09:00',
          slot_end: d.slot_end || '17:00',
          slot_duration: d.slot_duration || 30,
          break_start: d.break_start || '13:00',
          break_end: d.break_end || '14:00'
        });
        setCurrentImage(d.profile_image || '');
        setSpecializations(res.data.specializations || []);
      } else {
        setError(res.data.error || 'Failed to fetch doctor profile details.');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error loading practitioner profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setMessage('');

    const formData = new FormData();
    if (file) {
      formData.append('profile_image', file);
    }
    Object.entries(profileForm).forEach(([key, val]) => {
      formData.append(key, val);
    });

    try {
      const res = await axios.post('/api/doctor/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.ok) {
        setMessage('🎉 Profile updated successfully!');
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
        setFile(null);
        setCurrentImage(res.data.doctor.profile_image);
        await checkAuth(); // Update global auth name
      } else {
        setMessage(`❌ ${res.data.error || 'Failed to update.'}`);
      }
    } catch (err) {
      console.error(err);
      setMessage('❌ Server connection error updating practitioner details.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #dbeafe', borderTop: '4px solid #059669', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '40px 20px' }}>
        <div className="alert alert-danger">❌ {error}</div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ padding: '30px 20px', maxWidth: '750px' }}>
      <div className="glass" style={{ padding: '28px' }}>
        <h2 style={{ fontWeight: 850, fontSize: '1.45rem', marginBottom: '18px', color: '#0f172a' }}>🩺 Manage Practitioner Profile</h2>
        
        {message && (
          <div className={`alert ${message.includes('successfully') ? 'alert-success' : 'alert-danger'}`} style={{ padding: '10px 14px', fontSize: '0.85rem', marginBottom: '16px' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#d1fae5', border: '2px solid #059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', overflow: 'hidden' }}>
              {(previewUrl || currentImage) ? (
                <img src={previewUrl || currentImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : '🩺'}
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Update Avatar File</label>
              <input 
                type="file" 
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="form-control form-control-sm" 
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="row g-2">
            <div className="col-md-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Practitioner Full Name</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Contact Phone</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="row g-2">
            <div className="col-md-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Specialization</label>
                <select 
                  className="form-control form-control-sm"
                  value={profileForm.specialization}
                  onChange={(e) => setProfileForm({ ...profileForm, specialization: e.target.value })}
                >
                  {specializations.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Qualifications</label>
                <input 
                  type="text" 
                  placeholder="e.g. MBBS, MD (Cardiology)"
                  className="form-control form-control-sm"
                  value={profileForm.qualification}
                  onChange={(e) => setProfileForm({ ...profileForm, qualification: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="row g-2">
            <div className="col-md-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Experience Years</label>
                <input 
                  type="number" 
                  className="form-control form-control-sm"
                  value={profileForm.experience_years}
                  onChange={(e) => setProfileForm({ ...profileForm, experience_years: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Consultation Fee (₹)</label>
                <input 
                  type="number" 
                  className="form-control form-control-sm"
                  value={profileForm.consultation_fee}
                  onChange={(e) => setProfileForm({ ...profileForm, consultation_fee: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="col-md-6">
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Offer Home Visits?</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="home_visit_available"
                    checked={profileForm.home_visit_available}
                    onChange={(e) => setProfileForm({ ...profileForm, home_visit_available: e.target.checked })}
                  />
                  <label htmlFor="home_visit_available" style={{ margin: 0, fontSize: '0.82rem' }}>Enable home visit availability</label>
                </div>
              </div>
            </div>
          </div>

          {profileForm.home_visit_available && (
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Home Visit Fee (₹)</label>
              <input
                type="number"
                className="form-control form-control-sm"
                value={profileForm.home_visit_fee}
                onChange={(e) => setProfileForm({ ...profileForm, home_visit_fee: e.target.value })}
                min="0"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Brief Clinical Bio</label>
            <textarea 
              rows="2"
              className="form-control form-control-sm"
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
            />
          </div>

          <h4 style={{ fontSize: '0.92rem', fontWeight: 800, borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginTop: '10px', color: '#0f172a' }}>🏢 Clinic & Schedule Configurations</h4>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Clinic Name & Hospital</label>
            <input 
              type="text" 
              className="form-control form-control-sm"
              value={profileForm.hospital_name}
              onChange={(e) => setProfileForm({ ...profileForm, hospital_name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Detailed Clinic Address</label>
            <input 
              type="text" 
              className="form-control form-control-sm"
              value={profileForm.clinic_address}
              onChange={(e) => setProfileForm({ ...profileForm, clinic_address: e.target.value })}
            />
          </div>

          <div className="row g-2">
            <div className="col-4">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>City</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                />
              </div>
            </div>
            <div className="col-4">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>State</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  value={profileForm.state}
                  onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                />
              </div>
            </div>
            <div className="col-4">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Pincode</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  value={profileForm.pincode}
                  onChange={(e) => setProfileForm({ ...profileForm, pincode: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="row g-2">
            <div className="col-4">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Shift Slot Start</label>
                <input 
                  type="time" 
                  className="form-control form-control-sm"
                  value={profileForm.slot_start}
                  onChange={(e) => setProfileForm({ ...profileForm, slot_start: e.target.value })}
                />
              </div>
            </div>
            <div className="col-4">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Shift Slot End</label>
                <input 
                  type="time" 
                  className="form-control form-control-sm"
                  value={profileForm.slot_end}
                  onChange={(e) => setProfileForm({ ...profileForm, slot_end: e.target.value })}
                />
              </div>
            </div>
            <div className="col-4">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Slot Duration (Mins)</label>
                <input 
                  type="number" 
                  className="form-control form-control-sm"
                  value={profileForm.slot_duration}
                  onChange={(e) => setProfileForm({ ...profileForm, slot_duration: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Break Start</label>
                <input 
                  type="time" 
                  className="form-control form-control-sm"
                  value={profileForm.break_start}
                  onChange={(e) => setProfileForm({ ...profileForm, break_start: e.target.value })}
                />
              </div>
            </div>
            <div className="col-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Break End</label>
                <input 
                  type="time" 
                  className="form-control form-control-sm"
                  value={profileForm.break_end}
                  onChange={(e) => setProfileForm({ ...profileForm, break_end: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Weekly Available Days</label>
            <input 
              type="text" 
              placeholder="e.g. Mon,Tue,Wed,Thu,Fri"
              className="form-control form-control-sm"
              value={profileForm.available_days}
              onChange={(e) => setProfileForm({ ...profileForm, available_days: e.target.value })}
            />
          </div>

          <button 
            type="submit" 
            disabled={submitLoading} 
            className="btn btn-primary btn-sm w-100"
            style={{ background: '#059669', borderColor: '#059669', marginTop: '10px' }}
          >
            {submitLoading ? 'Saving Profile...' : 'Save Profile Changes'}
          </button>

        </form>
      </div>
    </div>
  );
};

export default DoctorProfile;
