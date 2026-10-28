import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const PatientProfile = () => {
  const { checkAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    dob: '',
    gender: 'Male',
    blood_group: 'A+',
    address: '',
    emergency_contact: ''
  });
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [currentImage, setCurrentImage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchProfile = async () => {
    try {
      const res = await axios.get('/api/profile');
      if (res.data && res.data.ok) {
        const p = res.data.patient;
        setProfileForm({
          full_name: p.full_name || '',
          phone: p.phone || '',
          dob: p.dob ? p.dob.split('T')[0] : '',
          gender: p.gender || 'Male',
          blood_group: p.blood_group || 'A+',
          address: p.address || '',
          emergency_contact: p.emergency_contact || ''
        });
        setCurrentImage(p.profile_image || '');
      } else {
        setError(res.data.error || 'Failed to fetch profile details.');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error loading profile parameters.');
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
    formData.append('full_name', profileForm.full_name);
    formData.append('phone', profileForm.phone);
    formData.append('dob', profileForm.dob);
    formData.append('gender', profileForm.gender);
    formData.append('blood_group', profileForm.blood_group);
    formData.append('address', profileForm.address);
    formData.append('emergency_contact', profileForm.emergency_contact);

    try {
      const res = await axios.post('/api/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.ok) {
        setMessage('🎉 Profile updated successfully!');
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
        setFile(null);
        setCurrentImage(res.data.patient.profile_image);
        await checkAuth(); // Update global auth name
      } else {
        setMessage(`❌ ${res.data.error || 'Failed to update.'}`);
      }
    } catch (err) {
      console.error(err);
      setMessage('❌ Server connection error updating details.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #dbeafe', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
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
    <div className="container animate-fade-in" style={{ padding: '30px 20px', maxWidth: '650px' }}>
      <div className="glass" style={{ padding: '28px' }}>
        <h2 style={{ fontWeight: 850, fontSize: '1.45rem', marginBottom: '18px' }}>👤 Manage Patient Profile</h2>
        
        {message && (
          <div className={`alert ${message.includes('successfully') ? 'alert-success' : 'alert-danger'}`} style={{ padding: '10px 14px', fontSize: '0.85rem', marginBottom: '16px' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#bfdbfe', border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', overflow: 'hidden' }}>
              {(previewUrl || currentImage) ? (
                <img src={previewUrl || currentImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : '👤'}
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

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Full Name</label>
            <input 
              type="text" 
              className="form-control form-control-sm"
              value={profileForm.full_name}
              onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
              required
            />
          </div>

          <div className="row g-2">
            <div className="col-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Phone Number</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="col-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Date of Birth</label>
                <input 
                  type="date" 
                  className="form-control form-control-sm"
                  value={profileForm.dob}
                  onChange={(e) => setProfileForm({ ...profileForm, dob: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="row g-2">
            <div className="col-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Gender</label>
                <select 
                  className="form-control form-control-sm"
                  value={profileForm.gender}
                  onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="col-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Blood Group</label>
                <select 
                  className="form-control form-control-sm"
                  value={profileForm.blood_group}
                  onChange={(e) => setProfileForm({ ...profileForm, blood_group: e.target.value })}
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Postal Address</label>
            <textarea 
              rows="2"
              className="form-control form-control-sm"
              value={profileForm.address}
              onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Emergency Contact Numbers</label>
            <input 
              type="text" 
              placeholder="e.g. +91 99887 76655 (Brother)"
              className="form-control form-control-sm"
              value={profileForm.emergency_contact}
              onChange={(e) => setProfileForm({ ...profileForm, emergency_contact: e.target.value })}
            />
          </div>

          <button 
            type="submit" 
            disabled={submitLoading} 
            className="btn btn-primary btn-sm w-100"
            style={{ marginTop: '10px' }}
          >
            {submitLoading ? 'Saving Profile...' : 'Save Profile Changes'}
          </button>

        </form>
      </div>
    </div>
  );
};

export default PatientProfile;
