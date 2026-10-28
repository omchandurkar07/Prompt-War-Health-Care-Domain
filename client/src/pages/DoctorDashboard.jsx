import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import DoctorAvatar from '../components/DoctorAvatar';

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const res = await axios.get('/api/doctor/dashboard');
      if (res.data && res.data.ok) {
        setData(res.data);
      } else {
        setError(res.data.error || 'Failed to load doctor dashboard.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error loading doctor dashboard details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleToggleAvailability = async () => {
    setStatusUpdating(true);
    try {
      const res = await axios.post('/api/doctor/toggle-availability');
      if (res.data && res.data.ok) {
        setData(prev => ({
          ...prev,
          doctor: {
            ...prev.doctor,
            is_available: res.data.is_available
          }
        }));
      }
    } catch (err) {
      console.error(err);
      alert('Error updating status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAcceptAppointment = async (apptId) => {
    try {
      const res = await axios.post(`/api/doctor/appointment/${apptId}/accept`);
      if (res.data && res.data.ok) {
        alert('Appointment request accepted!');
        fetchDashboardData();
      } else {
        alert(res.data.error || 'Failed to accept appointment.');
      }
    } catch (err) {
      console.error(err);
      alert('Error accepting appointment.');
    }
  };

  const handleRejectAppointment = async (apptId) => {
    if (!window.confirm('Are you sure you want to decline this appointment request?')) return;
    try {
      const res = await axios.post(`/api/doctor/appointment/${apptId}/reject`);
      if (res.data && res.data.ok) {
        alert('Appointment request declined.');
        fetchDashboardData();
      } else {
        alert(res.data.error || 'Failed to decline appointment.');
      }
    } catch (err) {
      console.error(err);
      alert('Error declining appointment.');
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
        <div className="alert alert-danger">❌ &nbsp;{error}</div>
      </div>
    );
  }

  const { doctor, pending = [], stats, recent = [], completed_sessions = [], recent_prescriptions = [], badges = [] } = data || {};

  return (
    <div className="container" style={{ padding: '30px 20px' }}>
      
      {/* Welcome & Availability Card */}
      <div className="doctor-welcome-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <DoctorAvatar
            src={doctor?.profile_image}
            alt={doctor?.full_name || 'Doctor'}
            style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255, 255, 255, 0.2)' }} 
          />
          <div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0 }}>
              {doctor?.full_name?.startsWith('Dr.') ? doctor.full_name : `Dr. ${doctor?.full_name}`}
            </h1>
            <p style={{ color: '#cbd5e1', fontSize: '0.88rem', marginTop: '4px' }}>
              {doctor?.specialization} · {doctor?.hospital_name || 'UltraCare Specialist'}
            </p>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              {badges.map((b, idx) => (
                <span key={idx} className={`badge badge-${b.color}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Availability Toggle Switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(10px)', padding: '12px 20px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', color: 'white' }}>Availability Status</span>
            <span style={{ fontSize: '0.75rem', color: doctor?.is_available ? '#34d399' : '#f87171', fontWeight: 600 }}>
              {doctor?.is_available ? '🟢 Accepting Emergencies' : '🔴 Status Set to Busy'}
            </span>
          </div>
          <button 
            type="button" 
            onClick={handleToggleAvailability}
            className={`btn btn-sm ${doctor?.is_available ? 'btn-danger' : 'btn-success'}`}
            style={{ borderRadius: '8px', padding: '6px 12px' }}
            disabled={statusUpdating}
          >
            {doctor?.is_available ? 'Set Busy' : 'Set Active'}
          </button>
        </div>
      </div>

      {/* Stats Counter Rows */}
      <div className="row g-4 mb-5">
        <div className="col-6 col-md-3">
          <div className="glass" style={{ padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', height: '100%' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🗓️</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary)', margin: 0, lineHeight: 1.2 }}>{stats?.today || 0}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '2px 0 0' }}>Today's Appts</p>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="glass" style={{ padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', height: '100%' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>👥</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669', margin: 0, lineHeight: 1.2 }}>{stats?.total_patients || 0}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '2px 0 0' }}>Patients Consulted</p>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="glass" style={{ padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', height: '100%' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>⭐</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--warning)', margin: 0, lineHeight: 1.2 }}>{stats?.rating || 0.0}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '2px 0 0' }}>Avg Rating ({stats?.rating_count || 0})</p>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="glass" style={{ padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', height: '100%' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>📄</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
              <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#7c3aed', margin: 0, lineHeight: 1.2 }}>{stats?.prescriptions || 0}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '2px 0 0' }}>Prescriptions Written</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        
        {/* Main Console Area */}
        <div className="col-lg-8">
          
          {/* Pending Appointment Requests */}
          <div className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔔 Patient Booking Requests
            </h3>

            {pending.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No pending booking requests.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pending.map(appt => (
                  <div key={appt._id} className="glass" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', border: '1px solid #f1f5f9' }}>
                    <div>
                      <h5 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>{appt.patient_id?.full_name || 'Patient'}</h5>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0' }}>Reason: {appt.reason || 'General Consultation'}</p>
                      <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>📅 {appt.appt_date} at ⏰ {appt.time_slot} ({appt.appt_type})</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleAcceptAppointment(appt._id)} className="btn btn-success btn-sm">Accept</button>
                      <button onClick={() => handleRejectAppointment(appt._id)} className="btn btn-danger btn-sm">Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's Schedule */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📋 Today's Appointments Schedule</span>
              <Link to="/my-appointments" style={{ fontSize: '0.8rem', fontWeight: 600 }}>View calendar ➡️</Link>
            </h3>

            {recent.filter(a => a.status === 'confirmed').length === 0 ? (
              <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No confirmed appointments scheduled for today.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recent.filter(a => a.status === 'confirmed').map(appt => (
                  <div key={appt._id} className="glass" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', border: '1px solid #f1f5f9' }}>
                    <div>
                      <h5 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>{appt.pname}</h5>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Slot: ⏰ {appt.time_slot} ({appt.appt_type})</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {appt.appt_type === 'emergency' && (
                        <Link to={`/consultation/video/${appt._id}`} className="btn btn-success btn-sm">🚨 Join Room</Link>
                      )}
                      <Link to={`/doctor/prep-sheet/${appt._id}`} className="btn btn-outline btn-sm">📋 View Prep</Link>
                      <Link to={`/doctor/care-plan/${appt._id}`} className="btn btn-outline btn-sm">💊 Set Care Plan</Link>
                      <Link to={`/doctor/prescription/${appt._id}`} className="btn btn-primary btn-sm">✍️ Complete & Prescribe</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Sidebar: Shortcuts and lists */}
        <div className="col-lg-4">
          
          {/* Shortcuts */}
          <div className="glass" style={{ padding: '20px', marginBottom: '24px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>⚡ Quick Actions</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Link to="/doctor/queue" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '12px', justifyContent: 'flex-start', background: '#f8fafc', border: '1px solid #e2e8f0', height: '60px' }}>
                <span style={{ fontSize: '1.25rem' }}>🚶</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Queue</span>
              </Link>
              <Link to="/doctor/patients" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '12px', justifyContent: 'flex-start', background: '#f8fafc', border: '1px solid #e2e8f0', height: '60px' }}>
                <span style={{ fontSize: '1.25rem' }}>👥</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Patients</span>
              </Link>
              <Link to="/doctor/profile" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '12px', justifyContent: 'flex-start', background: '#f8fafc', border: '1px solid #e2e8f0', height: '60px' }}>
                <span style={{ fontSize: '1.25rem' }}>⚙️</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Settings</span>
              </Link>
              <Link to="/doctor/analytics" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '12px', justifyContent: 'flex-start', background: '#f8fafc', border: '1px solid #e2e8f0', height: '60px' }}>
                <span style={{ fontSize: '1.25rem' }}>📈</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Analytics</span>
              </Link>
            </div>
          </div>

          {/* Recent Prescriptions */}
          <div className="glass" style={{ padding: '20px', marginBottom: '24px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>📄 Recent Prescriptions</h4>
            
            {recent_prescriptions.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>No prescriptions written yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recent_prescriptions.map(rx => (
                  <div key={rx._id} style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.82rem' }}>
                      <strong style={{ display: 'block' }}>{rx.pname}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID: {rx.prescription_id}</span>
                    </div>
                    <Link to={`/prescriptions/${rx._id}`} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>View</Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Sessions History */}
          <div className="glass" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>📜 Completed Consultations</h4>
            
            {completed_sessions.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>No consultations completed yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {completed_sessions.map(s => (
                  <div key={s._id} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                    <strong>{s.pname}</strong>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.appt_date} · {s.time_slot} ({s.appt_type})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

export default DoctorDashboard;
