import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DoctorQueue = () => {
  const [queue, setQueue] = useState([]);
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Walk-in form state
  const [walkinName, setWalkinName] = useState('');
  const [walkinReason, setWalkinReason] = useState('');
  const [walkinLoading, setWalkinLoading] = useState(false);

  const fetchQueue = async () => {
    try {
      const res = await axios.get('/api/doctor/queue');
      if (res.data && res.data.ok) {
        setQueue(res.data.queue || []);
        setToday(res.data.today || '');
      } else {
        setError(res.data.error || 'Failed to fetch queue list.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error loading queue list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleUpdateStatus = async (entryId, status) => {
    try {
      const res = await axios.post('/api/doctor/queue/update', {
        entry_id: entryId,
        status
      });
      if (res.data && res.data.ok) {
        fetchQueue();
      } else {
        alert(res.data.error || 'Failed to update queue entry.');
      }
    } catch (err) {
      alert('Error updating queue status.');
    }
  };

  const handleAddWalkin = async (e) => {
    e.preventDefault();
    if (!walkinName.trim()) {
      alert('Please specify a patient name.');
      return;
    }

    setWalkinLoading(true);
    try {
      const res = await axios.post('/api/doctor/queue/add-walkin', {
        name: walkinName,
        reason: walkinReason
      });
      if (res.data && res.data.ok) {
        setWalkinName('');
        setWalkinReason('');
        fetchQueue();
        alert('Walk-in patient added to queue successfully.');
      } else {
        alert(res.data.error || 'Failed to add walk-in.');
      }
    } catch (err) {
      alert('Error adding walk-in patient.');
    } finally {
      setWalkinLoading(false);
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

  // Filter queue into waiting, now serving, and done
  const servingList = queue.filter(qe => qe.queue_status === 'now_serving');
  const waitingList = queue.filter(qe => qe.queue_status === 'waiting');
  const doneList = queue.filter(qe => ['done', 'absent'].includes(qe.queue_status));

  return (
    <div className="container animate-fade-in" style={{ padding: '30px 20px' }}>
      
      {/* Title Header */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', background: 'linear-gradient(135deg, rgba(5,150,105,0.06), rgba(37,99,235,0.06))' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 850, margin: 0, color: '#059669' }}>OPD Live Queue Manager</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Monitor live waiting rooms, trigger SMS/push call updates to next in line patients, and log outpatient walk-ins.
        </p>
      </div>

      <div className="row g-4">
        {/* Left Side: Live Queue status lists */}
        <div className="col-lg-8">
          
          {/* Now Serving section */}
          <div className="glass" style={{ padding: '24px', border: '1.5px solid #059669', background: 'rgba(5,150,105,0.03)', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🔊 NOW SERVING CABINET
            </h3>

            {servingList.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                No patient is currently being called. Review the waiting list below and click "Call Serving".
              </p>
            ) : (
              servingList.map(qe => (
                <div key={qe.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 850, margin: 0 }}>#{qe.queue_position} {qe.patient_name}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Type: <strong>{qe.is_walkin ? 'Walk-in' : 'Confirmed Appt'}</strong> {qe.time_slot && `· Slot: ${qe.time_slot}`}
                    </span>
                    {qe.reason && <p style={{ fontSize: '0.82rem', margin: '6px 0 0', color: 'var(--text-muted)' }}>Reason: "{qe.reason}"</p>}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => handleUpdateStatus(qe.id, 'done')}
                      className="btn btn-success btn-sm"
                      style={{ background: '#10b981', borderColor: '#10b981', color: '#fff', fontWeight: 700 }}
                    >
                      ✓ Completed
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(qe.id, 'absent')}
                      className="btn btn-outline btn-sm"
                      style={{ borderColor: '#ef4444', color: '#ef4444' }}
                    >
                      Absent / Skip
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Waiting List */}
          <div className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 16px' }}>👥 Patients Waiting ({waitingList.length})</h3>
            
            {waitingList.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No patients waiting in queue today.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {waitingList.map(qe => (
                  <div key={qe.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>#{qe.queue_position} {qe.patient_name}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                        Mode: {qe.is_walkin ? 'Walk-in' : 'Appointment'} {qe.time_slot && `· Time: ${qe.time_slot}`}
                      </span>
                      {qe.reason && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Reason: {qe.reason}</span>}
                    </div>
                    <button 
                      onClick={() => handleUpdateStatus(qe.id, 'now_serving')}
                      className="btn btn-primary btn-xs"
                      style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                    >
                      📢 Call Cabinet
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Finished Queue list */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 16px', color: 'var(--text-muted)' }}>📜 Serviced Log History</h3>
            
            {doneList.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No logs registered for today.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {doneList.map(qe => (
                  <div key={qe.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span>#{qe.queue_position} {qe.patient_name} ({qe.is_walkin ? 'Walk-in' : 'Appt'})</span>
                    <strong style={{ color: qe.queue_status === 'done' ? '#10b981' : '#ef4444' }}>
                      {qe.queue_status === 'done' ? '✓ Completed' : '✖ Absent'}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Register Walk-in form */}
        <div className="col-lg-4">
          <div className="glass" style={{ padding: '24px', position: 'sticky', top: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '14px' }}>➕ Register Walk-in Patient</h3>

            <form onSubmit={handleAddWalkin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Patient Full Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Rahul Patil"
                  className="form-control form-control-sm"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Reason for Consultation</label>
                <input 
                  type="text" 
                  placeholder="e.g. fever & cold checkup"
                  className="form-control form-control-sm"
                  value={walkinReason}
                  onChange={(e) => setWalkinReason(e.target.value)}
                />
              </div>

              <button 
                type="submit" 
                disabled={walkinLoading}
                className="btn btn-primary btn-sm w-100"
                style={{ marginTop: '6px' }}
              >
                {walkinLoading ? 'Registering...' : 'Add Patient to Live Queue'}
              </button>
            </form>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DoctorQueue;
