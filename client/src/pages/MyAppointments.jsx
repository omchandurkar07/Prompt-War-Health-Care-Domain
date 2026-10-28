import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const MyAppointments = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('upcoming'); // 'all' | 'pending' | 'today' | 'upcoming' | 'completed' | 'cancelled'

  // Complete consultation modal
  const [completingAppt, setCompletingAppt] = useState(null);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [file, setFile] = useState(null);
  const [compLoading, setCompLoading] = useState(false);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/doctor/appointments?filter=${filter}`);
      if (res.data && res.data.ok) {
        setData(res.data);
      } else {
        setError(res.data.error || 'Failed to load appointments.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error loading appointments console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [filter]);

  const handleAccept = async (aid) => {
    try {
      const res = await axios.post(`/api/doctor/appointment/${aid}/accept`);
      if (res.data && res.data.ok) {
        alert('Appointment confirmed!');
        fetchAppointments();
      } else {
        alert(res.data.error || 'Failed to accept appointment.');
      }
    } catch (err) {
      alert('Error updating appointment.');
    }
  };

  const handleReject = async (aid) => {
    if (!window.confirm('Are you sure you want to decline this request?')) return;
    try {
      const res = await axios.post(`/api/doctor/appointment/${aid}/reject`);
      if (res.data && res.data.ok) {
        alert('Appointment declined.');
        fetchAppointments();
      } else {
        alert(res.data.error || 'Failed to decline appointment.');
      }
    } catch (err) {
      alert('Error updating appointment.');
    }
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    setCompLoading(true);
    
    const formData = new FormData();
    formData.append('doctor_notes', doctorNotes);
    if (file) {
      formData.append('prescription_file', file);
    }

    try {
      const res = await axios.post(`/api/doctor/appointment/${completingAppt._id}/complete`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.ok) {
        alert('Consultation completed successfully!');
        setCompletingAppt(null);
        setDoctorNotes('');
        setFile(null);
        fetchAppointments();
      } else {
        alert(res.data.error || 'Failed to finalize consultation.');
      }
    } catch (err) {
      console.error(err);
      alert('Error completing consultation.');
    } finally {
      setCompLoading(false);
    }
  };

  if (loading && !data) {
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

  const { appointments = [], stats = {} } = data || {};

  return (
    <div className="container animate-fade-in" style={{ padding: '30px 20px' }}>
      
      {/* Header Panel */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'linear-gradient(135deg, rgba(5,150,105,0.06), rgba(37,99,235,0.06))' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 850, margin: 0, color: '#059669' }}>Practitioner Booking Console</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Review upcoming outpatient dispatches, accept emergency consultations, and finalize treatment sessions.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/doctor/profile" className="btn btn-outline btn-sm">Manage Shift Times</Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="row g-3 mb-4">
        <div className="col-4 col-md-2">
          <div className="glass text-center" style={{ padding: '12px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Today's Total</span>
            <strong style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>{stats.today_count || 0}</strong>
          </div>
        </div>
        <div className="col-4 col-md-2">
          <div className="glass text-center" style={{ padding: '12px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Pending Req</span>
            <strong style={{ fontSize: '1.25rem', color: 'var(--warning)' }}>{stats.pending_reqs || 0}</strong>
          </div>
        </div>
        <div className="col-4 col-md-2">
          <div className="glass text-center" style={{ padding: '12px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Completed</span>
            <strong style={{ fontSize: '1.25rem', color: '#10b981' }}>{stats.completed || 0}</strong>
          </div>
        </div>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="glass" style={{ padding: '10px 16px', marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['upcoming', 'today', 'pending', 'completed', 'cancelled', 'all'].map(item => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`btn btn-xs ${filter === item ? 'btn-primary' : 'btn-outline'}`}
            style={{ textTransform: 'capitalize', padding: '6px 12px' }}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Appointments list */}
      {appointments.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '3rem' }}>📅</span>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '16px' }}>No Appointments Found</h3>
          <p style={{ fontSize: '0.85rem' }}>No consult bookings matched your current filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {appointments.map(appt => (
            <div key={appt._id} className="glass" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', border: '1px solid var(--border)' }}>
              
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    fontSize: '0.68rem', 
                    fontWeight: 800, 
                    padding: '3px 8px', 
                    borderRadius: '6px', 
                    background: appt.status === 'confirmed' ? '#d1fae5' : appt.status === 'pending' ? '#fef3c7' : '#f1f5f9',
                    color: appt.status === 'confirmed' ? '#065f46' : appt.status === 'pending' ? '#d97706' : '#475569',
                    textTransform: 'uppercase'
                  }}>
                    {appt.status}
                  </span>
                  
                  {appt.appt_type === 'emergency' && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: '#fee2e2', color: '#b91c1c' }}>
                      🚨 Emergency
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '8px 0 2px' }}>Patient: {appt.pname}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  📅 Scheduled Date: <strong>{appt.appt_date}</strong> at ⏰ <strong>{appt.time_slot}</strong> ({appt.appt_type} mode)
                </span>
                {appt.reason && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '6px 0 0', fontStyle: 'italic' }}>
                    Reason: "{appt.reason}"
                  </p>
                )}
              </div>

              {/* Actions row */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {appt.status === 'pending' && (
                  <>
                    <button onClick={() => handleAccept(appt._id)} className="btn btn-success btn-xs" style={{ background: '#10b981', borderColor: '#10b981', color: '#fff' }}>Accept</button>
                    <button onClick={() => handleReject(appt._id)} className="btn btn-danger btn-xs" style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}>Decline</button>
                  </>
                )}

                {appt.status === 'confirmed' && (
                  <>
                    {appt.appt_type === 'video' && (
                      <Link to={`/consultation/video/${appt._id}`} className="btn btn-success btn-xs">🎥 Join Call</Link>
                    )}
                    <Link to={`/doctor/care-plan/${appt._id}`} className="btn btn-outline btn-xs">💊 Set Care Plan</Link>
                    <button onClick={() => setCompletingAppt(appt)} className="btn btn-primary btn-xs" style={{ background: '#059669', borderColor: '#059669', color: '#fff' }}>Complete Consult</button>
                  </>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Complete Consult Form Modal */}
      {completingAppt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '480px', padding: '24px', position: 'relative' }}>
            
            <button 
              onClick={() => setCompletingAppt(null)} 
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>

            <form onSubmit={handleCompleteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>⚙ Finalize Consultation Session</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Logging clinical comments and uploading digital prescriptions (PDF scan) for: <strong>{completingAppt.pname}</strong>.
              </p>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Doctor Notes & Remarks</label>
                <textarea 
                  rows="3" 
                  className="form-control form-control-sm"
                  placeholder="e.g. Patient complains of severe migraine. Advised rest..."
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Attach Prescription Scan (Optional)</label>
                <input 
                  type="file" 
                  className="form-control form-control-sm" 
                  onChange={(e) => setFile(e.target.files[0])}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" onClick={() => setCompletingAppt(null)} className="btn btn-ghost btn-sm" disabled={compLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={compLoading} style={{ background: '#059669', borderColor: '#059669' }}>
                  {compLoading ? 'Finalizing...' : 'Complete Session'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default MyAppointments;
