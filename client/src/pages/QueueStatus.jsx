import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import DoctorAvatar from '../components/DoctorAvatar';

const QueueStatus = () => {
  const { aid } = useParams();
  const [activeAid, setActiveAid] = useState(aid);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);

  const fetchQueueStatus = async () => {
    let currentAid = activeAid || aid;

    // If aid is undefined, fetch today's active appointment from patient dashboard
    if (!currentAid) {
      try {
        const dashboardRes = await axios.get('/api/patient/dashboard');
        if (dashboardRes.data && dashboardRes.data.upcoming) {
          const todayStr = new Date().toISOString().split('T')[0];
          // Find first confirmed or pending appointment for today
          const todayAppt = dashboardRes.data.upcoming.find(a => a.appt_date === todayStr);
          if (todayAppt) {
            currentAid = todayAppt._id;
            setActiveAid(todayAppt._id);
          } else {
            setError('You do not have any active appointments today to track in the live queue.');
            setLoading(false);
            return;
          }
        } else {
          setError('Failed to fetch patient schedule.');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error(err);
        setError('Server connection error querying today\'s schedule.');
        setLoading(false);
        return;
      }
    }

    try {
      const res = await axios.get(`/api/queue/status/${currentAid}`);
      if (res.data && res.data.ok) {
        setData(res.data);
        
        // Stop polling if the consultation is already complete
        if (res.data.entry?.queue_status === 'done') {
          setPolling(false);
        }
      } else {
        setError(res.data.error || 'Failed to check queue status.');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error querying live queue metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueStatus();
    
    let interval = null;
    if (polling && (activeAid || aid)) {
      interval = setInterval(fetchQueueStatus, 5000); // Poll every 5s
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [aid, activeAid, polling]);

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #dbeafe', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (error) {
    if (error.includes('appointments today') || error.includes('schedule')) {
      return (
        <div className="container" style={{ padding: '30px 20px', maxWidth: '600px' }}>
          <div style={{ marginBottom: '16px' }}>
            <Link to="/dashboard" style={{ fontSize: '0.85rem', fontWeight: 600 }}>⬅️ Back to Patient Dashboard</Link>
          </div>
          <div className="glass text-center" style={{ padding: '48px 32px', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>⏱️</span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>No Active Queue Today</h2>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 }}>
              {error}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Link to="/doctors" className="btn btn-primary btn-sm" style={{ padding: '10px 20px', borderRadius: '10px' }}>Book Appointment</Link>
              <Link to="/dashboard" className="btn btn-outline btn-sm" style={{ padding: '10px 20px', borderRadius: '10px' }}>Go to Dashboard</Link>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="container" style={{ padding: '40px 20px' }}>
        <div className="alert alert-danger">❌ {error}</div>
      </div>
    );
  }

  const { appt, entry, position = null, est_wait = null } = data || {};
  const isNowServing = entry?.queue_status === 'now_serving';
  const isDone = entry?.queue_status === 'done';

  return (
    <div className="container animate-fade-in" style={{ padding: '30px 20px', maxWidth: '600px' }}>
      
      {/* Back to dashboard */}
      <div style={{ marginBottom: '16px' }}>
        <Link to="/dashboard" style={{ fontSize: '0.85rem', fontWeight: 600 }}>⬅️ Back to Patient Dashboard</Link>
      </div>

      <div className="glass text-center" style={{ padding: '36px' }}>
        
        {isDone ? (
          // Session Completed
          <div>
            <span style={{ fontSize: '3rem' }}>✓</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 850, marginTop: '16px' }}>Consultation Finished</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Your session with Dr. {appt.doctor_id?.full_name} has concluded. Thank you for using UltraCare.
            </p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <Link to={`/review/${appt._id}`} className="btn btn-primary btn-sm">⭐ Rate Consultation</Link>
              <Link to="/dashboard" className="btn btn-outline btn-sm">Dashboard</Link>
            </div>
          </div>
        ) : isNowServing ? (
          // Now Serving Callout
          <div className="animate-pulse">
            <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '12px' }}>🔔</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 850, color: '#ef4444' }}>It is Your Turn!</h2>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: '6px 0 16px' }}>
              Dr. {appt.doctor_id?.full_name} is ready to serve you now. Please join immediately.
            </p>
            
            <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
              <span style={{ fontSize: '0.78rem', display: 'block', color: '#991b1b' }}>Room Link Mode:</span>
              <strong style={{ fontSize: '0.92rem', color: '#7f1d1d' }}>{appt.appt_type === 'video' ? 'Virtual Video Consult Session' : 'In-Clinic Physical Appointment'}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {appt.appt_type === 'video' ? (
                <Link to={`/consultation/video/${appt._id}`} className="btn btn-success" style={{ padding: '14px', borderRadius: '10px', fontWeight: 800 }}>
                  🎥 Join Virtual Consultation Room
                </Link>
              ) : (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Please walk into the doctor's cabin now.</span>
              )}
            </div>
          </div>
        ) : (
          // Waiting in line
          <div>
            <span style={{ fontSize: '2.5rem' }}>⏳</span>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '14px' }}>Live Queue Tracking</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Your appointment session with Dr. {appt.doctor_id?.full_name} is active in the queue.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '24px 0' }}>
              <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Position Ahead</span>
                <strong style={{ fontSize: '2rem', color: 'var(--primary)', fontWeight: 850 }}>
                  {position !== null ? `#${position}` : '—'}
                </strong>
              </div>

              <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Estimated Wait</span>
                <strong style={{ fontSize: '2rem', color: 'var(--warning)', fontWeight: 850 }}>
                  {est_wait !== null ? `${est_wait}m` : '—'}
                </strong>
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              💡 This dashboard refreshes automatically. Get ready to join when the bell flashes!
            </p>
          </div>
        )}

        <hr style={{ margin: '24px 0', borderColor: 'var(--border)' }} />

        {/* Doctor Details Summary */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', textAlign: 'left' }}>
          <DoctorAvatar
            src={appt.doctor_id?.profile_image}
            alt={appt.doctor_id?.full_name || 'Doctor'}
            style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <div>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 800, margin: 0 }}>Dr. {appt.doctor_id?.full_name}</h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, display: 'block' }}>{appt.doctor_id?.specialization}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Clinic: {appt.doctor_id?.hospital_name}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default QueueStatus;
