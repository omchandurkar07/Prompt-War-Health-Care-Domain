import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import DoctorAvatar from '../components/DoctorAvatar';

const loadRazorpay = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true);
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkedItems, setCheckedItems] = useState({});
  const [payments, setPayments] = useState([]);
  const [paymentBusy, setPaymentBusy] = useState('');

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

  const handlePayAppointment = async (appt) => {
    setPaymentBusy(appt._id);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Razorpay Checkout could not be loaded. Check your connection and try again.');

      const orderRes = await axios.post(`/api/payments/order/${appt._id}`);
      if (!orderRes.data?.ok) throw new Error(orderRes.data?.error || 'Unable to start checkout.');

      const checkout = new window.Razorpay({
        key: orderRes.data.key_id,
        amount: orderRes.data.amount,
        currency: orderRes.data.currency,
        name: 'UltraCare',
        description: `Consultation with Dr. ${appt.doctor_id?.full_name || 'your doctor'}`,
        order_id: orderRes.data.order_id,
        prefill: { name: patient?.full_name || '', email: patient?.email || '' },
        notes: { appointment_id: appt._id },
        theme: { color: '#0f766e' },
        handler: async (gatewayResponse) => {
          try {
            const verifyRes = await axios.post(`/api/payments/verify/${appt._id}`, gatewayResponse);
            if (!verifyRes.data?.ok) throw new Error(verifyRes.data?.error || 'Payment verification is pending.');
            alert(verifyRes.data.status === 'paid'
              ? 'Payment confirmed.'
              : `Payment received. Current refund status: ${verifyRes.data.status}.`);
            await Promise.all([fetchDashboardData(), fetchPaymentHistory()]);
          } catch (verifyError) {
            alert(verifyError.response?.data?.error || verifyError.message || 'Payment was received but confirmation is pending. Check payment history before retrying.');
            fetchPaymentHistory();
          } finally {
            setPaymentBusy('');
          }
        },
        modal: { ondismiss: () => setPaymentBusy('') }
      });

      checkout.on('payment.failed', (event) => {
        setPaymentBusy('');
        alert(event.error?.description || 'Payment was not completed. You can try again.');
      });
      checkout.open();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Unable to start payment.');
      setPaymentBusy('');
    }
  };

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
                      {appt.status === 'confirmed' && appt.payment_status !== 'completed' && appt.payment_status !== 'refunded' && (
                        <button
                          onClick={() => handlePayAppointment(appt)}
                          className="btn btn-primary btn-sm"
                          disabled={paymentBusy === appt._id}
                        >
                          {paymentBusy === appt._id ? 'Opening checkout...' : `Pay ₹${Number(appt.fee || 0).toFixed(2)}`}
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
                      <button onClick={() => handleCancelAppointment(appt._id)} className="btn btn-danger btn-sm" style={{ padding: '6px 10px' }}>Cancel</button>
                    </div>
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
                {past.map(appt => (
                  <div key={appt._id} style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <h5 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>Dr. {appt.doctor_id?.full_name || 'Specialist'}</h5>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{appt.appt_date} · {appt.time_slot} · {appt.status}</span>
                      {appt.doctor_notes && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0', fontStyle: 'italic' }}>Notes: {appt.doctor_notes}</p>}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {appt.status === 'completed' && (
                        <>
                          <Link to={`/prescriptions/rx_${appt._id}`} className="btn btn-outline btn-sm" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>RX Details</Link>
                          {!data.reviewed_appt_ids?.includes(appt._id) && (
                            <Link to={`/review/${appt._id}`} className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>⭐ Rate</Link>
                          )}
                        </>
                      )}
                    </div>
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
