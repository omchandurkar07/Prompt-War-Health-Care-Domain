import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import DoctorAvatar from '../components/DoctorAvatar';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkedItems, setCheckedItems] = useState({});
  const [payments, setPayments] = useState([]);
  const [rescheduleDraft, setRescheduleDraft] = useState(null);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const res = await axios.get('/api/dashboard');
      if (res.data && res.data.ok) {
        setData(res.data);
        setCheckedItems(res.data.checklist_done || {});
      } else {
        setError(res.data.error || 'Failed to load dashboard.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error loading dashboard details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const res = await axios.get('/api/payments/history');
      if (res.data?.ok) setPayments(res.data.payments || []);
    } catch (err) {
      console.error('Payment history unavailable', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchPaymentHistory();
  }, []);

  useEffect(() => {
    if (!loading) {
      const hash = location.hash;
      if (hash === '#appointments') {
        const el = document.getElementById('appointments-section');
        if (el) {
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth' });
          }, 150);
        }
      }
    }
  }, [loading, location.hash]);

  const handleToggleChecklist = async (itemId) => {
    const todayStr = data?.today_str || new Date().toISOString().split('T')[0];
    try {
      // Toggle locally
      setCheckedItems(prev => ({
        ...prev,
        [itemId]: !prev[itemId]
      }));

      const res = await axios.post('/api/adherence/toggle', {
        item_id: itemId,
        date: todayStr
      });

      if (!res.data.ok) {
        // Revert if error
        setCheckedItems(prev => ({
          ...prev,
          [itemId]: !prev[itemId]
        }));
      }
    } catch (err) {
      console.error(err);
      // Revert if error
      setCheckedItems(prev => ({
        ...prev,
        [itemId]: !prev[itemId]
      }));
    }
  };

  const handleCancelAppointment = async (apptId) => {
    if (!window.confirm('Cancel this appointment? If it has been paid, a refund request will be sent to the administrator for review.')) return;
    try {
      const res = await axios.post(`/api/appointment/cancel/${apptId}`);
      if (res.data && res.data.ok) {
        alert(res.data.message || 'Appointment cancelled.');
        await Promise.all([fetchDashboardData(), fetchPaymentHistory()]);
      } else {
        alert(res.data.error || 'Failed to cancel appointment.');
      }
    } catch (err) {
      console.error(err);
      alert('Error cancelling appointment.');
    }
  };

  const handleRescheduleRequest = async (event, appointmentId) => {
    event.preventDefault();
    if (!rescheduleDraft?.appt_date || !rescheduleDraft?.time_slot) return;
    setRescheduleBusy(true);
    try {
      const response = await axios.post(`/api/appointment/${appointmentId}/reschedule`, rescheduleDraft);
      if (!response.data?.ok) throw new Error(response.data?.error || 'Unable to send reschedule request.');
      alert(response.data.message);
      setRescheduleDraft(null);
      await fetchDashboardData();
    } catch (requestError) {
      console.error(requestError);
      alert(requestError.response?.data?.error || requestError.message || 'Unable to send reschedule request.');
    } finally {
      setRescheduleBusy(false);
    }
  };

  const handlePayAppointment = (appt) => navigate(`/payment/${appt._id}`);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #dbeafe', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
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

  const { patient, stats, upcoming = [], past = [], checklist_items = [], prescriptions = [], medicine_reminders = [] } = data || {};

  return (
    <div className="container" style={{ padding: '30px 20px' }}>
      
      {/* Welcome Banner */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(124,58,237,0.06))' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0 }}>Hello, {patient?.full_name || 'Patient'}!</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Welcome back. Manage your prescriptions, consult doctors, and check off your daily Care Plan checklist.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/doctors" className="btn btn-primary btn-sm">📅 Book Appointment</Link>
          <Link to="/symptom-checker" className="btn btn-outline btn-sm">🤖 AI Symptom Checker</Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="row g-4 mb-4">
        <div className="col-6 col-md-3">
          <div className="glass" style={{ padding: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '1.75rem' }}>💼</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', margin: '8px 0 2px' }}>{stats?.total || 0}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Total Consults</p>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="glass" style={{ padding: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '1.75rem' }}>🟢</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', margin: '8px 0 2px' }}>{stats?.confirmed || 0}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Confirmed</p>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="glass" style={{ padding: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '1.75rem' }}>⏳</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)', margin: '8px 0 2px' }}>{stats?.pending || 0}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Pending</p>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="glass" style={{ padding: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '1.75rem' }}>📄</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7c3aed', margin: '8px 0 2px' }}>{stats?.prescriptions || 0}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>Prescriptions</p>
          </div>
        </div>
      </div>

      <div className="row g-4">
        
        {/* Main Side: Appointments */}
        <div className="col-lg-8">
          
          {/* Upcoming Appointments */}
          <div id="appointments-section" className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🗓️ Upcoming Consultations
            </h3>
            
            {upcoming.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.9rem' }}>No upcoming appointments scheduled.</p>
                <Link to="/doctors" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'inline-block', marginTop: '8px' }}>Find a doctor & book now ➡️</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {upcoming.map(appt => (
                  <div key={appt._id} className="glass" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <DoctorAvatar
                        src={appt.doctor_id?.profile_image}
                        alt={appt.doctor_id?.full_name || 'Doctor'}
                        style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} 
                      />
                      <div>
                        <h5 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Dr. {appt.doctor_id?.full_name}</h5>
                        <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, margin: '2px 0' }}>{appt.doctor_id?.specialization}</p>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>📅 {appt.appt_date} at ⏰ {appt.time_slot} ({appt.appt_type})</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {appt.status === 'confirmed' && Number(appt.fee) > 0 && appt.payment_status !== 'completed' && appt.payment_status !== 'refunded' && (
                        <button
                          onClick={() => handlePayAppointment(appt)}
                          className="btn btn-primary btn-sm"
                        >
                          {appt.payment_status === 'failed' ? 'Retry payment' : `Pay ₹${Number(appt.fee || 0).toFixed(2)}`}
                        </button>
                      )}
                      {appt.payment_status === 'completed' && (
                        <span className="badge bg-success" style={{ alignSelf: 'center' }}>Paid</span>
                      )}
                      {appt.appt_type === 'emergency' && (
                        <Link to={`/consultation/video/${appt._id}`} className="btn btn-success btn-sm">🚨 Join Room</Link>
                      )}
                      {appt.status === 'confirmed' && (
                        <Link to={`/visit-prep/${appt._id}`} className="btn btn-outline btn-sm">📝 Prep Sheet</Link>
                      )}
                      {['confirmed', 'completed'].includes(appt.status) && (
                        <Link to={`/consultation/messages/${appt._id}`} className="btn btn-outline btn-sm">💬 Message doctor</Link>
                      )}
                      {appt.status === 'confirmed' && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={Boolean(appt.reschedule_request?.requested_at)}
                          onClick={() => setRescheduleDraft(rescheduleDraft?.appointmentId === appt._id
                            ? null
                            : { appointmentId: appt._id, appt_date: '', time_slot: '' })}
                        >
                          {appt.reschedule_request?.requested_at
                            ? 'Reschedule pending'
                            : rescheduleDraft?.appointmentId === appt._id ? 'Close request' : 'Request reschedule'}
                        </button>
                      )}
                      <button onClick={() => handleCancelAppointment(appt._id)} className="btn btn-danger btn-sm" style={{ padding: '6px 10px' }}>Cancel</button>
                    </div>

                    {appt.doctor_reschedule_message && (
                      <p role="status" style={{ flexBasis: '100%', margin: 0, padding: '10px 12px', borderRadius: '8px', background: '#eff6ff', color: '#1e40af', fontSize: '0.84rem' }}>
                        <strong>Doctor update:</strong> {appt.doctor_reschedule_message}
                      </p>
                    )}
                    {appt.reschedule_request?.requested_at && (
                      <p role="status" style={{ flexBasis: '100%', margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        Reschedule requested: {appt.reschedule_request.appt_date} at {appt.reschedule_request.time_slot}. Your current slot remains active until the doctor responds.
                      </p>
                    )}
                    {rescheduleDraft?.appointmentId === appt._id && (
                      <form
                        onSubmit={(event) => handleRescheduleRequest(event, appt._id)}
                        style={{ flexBasis: '100%', display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap' }}
                      >
                        <label style={{ fontSize: '0.8rem' }}>
                          Preferred date
                          <input
                            type="date"
                            required
                            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                            value={rescheduleDraft.appt_date}
                            onChange={(event) => setRescheduleDraft({ ...rescheduleDraft, appt_date: event.target.value })}
                            className="form-control form-control-sm"
                          />
                        </label>
                        <label style={{ fontSize: '0.8rem' }}>
                          Preferred time
                          <input
                            type="time"
                            required
                            value={rescheduleDraft.time_slot}
                            onChange={(event) => setRescheduleDraft({ ...rescheduleDraft, time_slot: event.target.value })}
                            className="form-control form-control-sm"
                          />
                        </label>
                        <button className="btn btn-primary btn-sm" disabled={rescheduleBusy}>
                          {rescheduleBusy ? 'Sending...' : 'Send request'}
                        </button>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Your doctor must approve the requested slot.
                        </span>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {payments.length > 0 && (
            <div className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Payment History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {payments.map((payment) => (
                  <div key={payment._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                    <div>
                      <strong>{payment.doctor_id?.full_name ? `Dr. ${payment.doctor_id.full_name}` : 'Consultation'}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {payment.appointment_id?.appt_date || 'Appointment'} · {payment.appointment_id?.time_slot || ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong>₹{(payment.amount_paise / 100).toFixed(2)}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'capitalize' }}>
                        {payment.refund_status !== 'none'
                          ? `Refund ${payment.refund_status}`
                          : payment.payment_mode === 'simulation' && payment.status === 'paid'
                            ? 'Demo payment — not charged'
                            : payment.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past Consultations / Medical History */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>📜 Consultation History</h3>
            
            {past.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No past medical consultation records found.</p>
            ) : (
              <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                {past.map(appt => {
                  const appointmentPrescription = data.prescriptions?.find(
                    rx => String(rx.appointment_id?._id || rx.appointment_id) === String(appt._id)
                  );
                  return (
                  <div key={appt._id} style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <h5 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>Dr. {appt.doctor_id?.full_name || 'Specialist'}</h5>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{appt.appt_date} · {appt.time_slot} · {appt.status}</span>
                      {appt.doctor_notes && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0', fontStyle: 'italic' }}>Notes: {appt.doctor_notes}</p>}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {appt.status === 'completed' && (
                        <>
                          {appointmentPrescription && (
                            <Link
                              to={`/prescriptions/${appointmentPrescription._id}`}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            >
                              RX Details
                            </Link>
                          )}
                          <Link to={`/consultation/messages/${appt._id}`} className="btn btn-outline btn-sm" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>💬 Message doctor</Link>
                          {!data.reviewed_appt_ids?.includes(appt._id) && (
                            <Link to={`/review/${appt._id}`} className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>⭐ Rate</Link>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass" style={{ padding: '24px', marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>💊 Recent Prescriptions</h3>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{stats?.prescriptions || 0} in your prescription history</span>
              </div>
              <Link to="/my-prescriptions" className="btn btn-outline btn-sm">View all prescriptions →</Link>
            </div>
            {prescriptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '18px 10px', color: 'var(--text-muted)' }}>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>When your doctor issues a prescription, it will appear here and be saved in your account.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {prescriptions.slice(0, 4).map((rx) => (
                  <div key={rx._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '12px', border: '1px solid var(--border)', borderRadius: '12px', background: 'rgba(255,255,255,0.65)' }}>
                    <div>
                      <strong style={{ display: 'block' }}>{rx.dname?.startsWith('Dr.') ? rx.dname : `Dr. ${rx.dname || 'Doctor'}`}</strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {rx.prescription_id} · {new Date(rx.created_at).toLocaleDateString()}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.82rem', marginTop: '3px' }}>
                        {rx.diagnosis || rx.diagnosis_notes || 'Prescription'} · {(rx.medicines || []).length} medicine(s)
                      </span>
                    </div>
                    <Link to={`/prescriptions/${rx._id}`} className="btn btn-primary btn-sm">Open</Link>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Sidebar: Care Plan, Checklists, Reminders */}
        <div className="col-lg-4">
          
          <div className="glass" style={{ padding: '22px', marginBottom: '24px', borderRadius: '16px' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚡</span> Quick Tools
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Link 
                to="/health-tracker" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '16px 10px', 
                  borderRadius: '14px', 
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
                  border: '1px solid #bfdbfe', 
                  color: '#1e40af', 
                  textDecoration: 'none', 
                  transition: 'all 0.2s ease', 
                  textAlign: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(30, 64, 175, 0.04)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(30, 64, 175, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(30, 64, 175, 0.04)';
                }}
              >
                <span style={{ fontSize: '1.5rem', marginBottom: '6px' }}>🩺</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Telemetry Log</span>
              </Link>

              <Link 
                to="/health-locker" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '16px 10px', 
                  borderRadius: '14px', 
                  background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', 
                  border: '1px solid #a7f3d0', 
                  color: '#065f46', 
                  textDecoration: 'none', 
                  transition: 'all 0.2s ease', 
                  textAlign: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(6, 95, 70, 0.04)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(6, 95, 70, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(6, 95, 70, 0.04)';
                }}
              >
                <span style={{ fontSize: '1.5rem', marginBottom: '6px' }}>🔒</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Health Locker</span>
              </Link>

              <Link 
                to="/health-passport" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '16px 10px', 
                  borderRadius: '14px', 
                  background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', 
                  border: '1px solid #c7d2fe', 
                  color: '#3730a3', 
                  textDecoration: 'none', 
                  transition: 'all 0.2s ease', 
                  textAlign: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(55, 48, 163, 0.04)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(55, 48, 163, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(55, 48, 163, 0.04)';
                }}
              >
                <span style={{ fontSize: '1.5rem', marginBottom: '6px' }}>🎫</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Health Passport</span>
              </Link>

              <Link 
                to="/family" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '16px 10px', 
                  borderRadius: '14px', 
                  background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)', 
                  border: '1px solid #fbcfe8', 
                  color: '#9d174d', 
                  textDecoration: 'none', 
                  transition: 'all 0.2s ease', 
                  textAlign: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(157, 23, 77, 0.04)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(157, 23, 77, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(157, 23, 77, 0.04)';
                }}
              >
                <span style={{ fontSize: '1.5rem', marginBottom: '6px' }}>👨‍👩‍👧</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Family Circles</span>
              </Link>
            </div>
          </div>

          {/* Care Plan Checklist widget */}
          <div className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📝 Healing Plan Checklist
            </h3>

            {checklist_items.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                No active clinical Care Plan. Once your doctor creates a plan during consultation, it will appear here.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {checklist_items.map(item => (
                  <label key={item._id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      style={{ marginTop: '4px', cursor: 'pointer' }}
                      checked={!!checkedItems[item._id]}
                      onChange={() => handleToggleChecklist(item._id)}
                    />
                    <div style={{ fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, display: 'block', textDecoration: checkedItems[item._id] ? 'line-through' : 'none', color: checkedItems[item._id] ? 'var(--text-muted)' : 'var(--text)' }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: 700 }}>
                        {item.time_of_day} · {item.item_type}
                      </span>
                    </div>
                  </label>
                ))}
                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                  <Link to="/healing-plan" style={{ fontSize: '0.8rem', fontWeight: 600 }}>View full progress reports ➡️</Link>
                </div>
              </div>
            )}
          </div>

          {/* Active Medicine Reminders */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px' }}>⏰ Active Reminders</h3>

            {medicine_reminders.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>No active timers configured.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {medicine_reminders.map(rem => (
                  <div key={rem._id} style={{ padding: '10px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>💊</span>
                    <div style={{ fontSize: '0.85rem' }}>
                      <strong style={{ display: 'block' }}>{rem.medicine_name}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Remind at {rem.remind_time} ({rem.frequency})</span>
                    </div>
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

export default Dashboard;
