import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';

const PrescriptionDetail = () => {
  const { rx_id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Doctor regeneration state
  const [regenLanguage, setRegenLanguage] = useState('English');
  const [regenLoading, setRegenLoading] = useState(false);

  const fetchPrescription = async () => {
    try {
      const res = await axios.get(`/api/prescriptions/${rx_id}`);
      if (res.data && res.data.ok) {
        setData(res.data);
        if (res.data.rx) {
          setRegenLanguage(res.data.rx.ai_language || 'English');
        }
      } else {
        setError(res.data.error || 'Failed to load prescription.');
      }
    } catch (err) {
      console.error(err);
      setError('You are not authorized to view this prescription, or it does not exist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescription();
  }, [rx_id]);

  const handleRegenerateAI = async () => {
    setRegenLoading(true);
    try {
      const endpoint = is_doctor_view 
        ? `/api/doctor/prescription/regenerate/${rx_id}`
        : `/api/patient/prescription/translate/${rx_id}`;

      const res = await axios.post(endpoint, {
        preferred_language: regenLanguage
      });
      if (res.data && res.data.ok) {
        setData(prev => ({
          ...prev,
          rx: {
            ...prev.rx,
            ai_explanation: res.data.explanation,
            ai_status: res.data.status,
            ai_language: res.data.language,
            recovery_plan: res.data.recovery_plan
          }
        }));
        alert(is_doctor_view ? 'AI Explanation successfully regenerated and updated!' : 'AI Explanation successfully translated!');
      } else {
        alert(res.data.error || 'Failed to update explanation.');
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Server error updating AI summary.');
    } finally {
      setRegenLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f4f6', borderTop: '4px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '40px 20px', maxWidth: '800px' }}>
        <div className="alert alert-danger">❌ &nbsp;{error}</div>
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/dashboard" className="btn btn-outline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const { rx, medicines = [], reminders = [], is_doctor_view } = data || {};
  const recoveryPlan = data?.recovery_plan || rx?.recovery_plan || {};
  const recoverySections = [
    { title: 'What to do today', icon: '✅', items: recoveryPlan.today },
    { title: 'Over the next few days', icon: '📅', items: recoveryPlan.next_days },
    { title: 'Food and fluids', icon: '🥗', items: recoveryPlan.food },
    { title: 'Rest and activity', icon: '🛌', items: recoveryPlan.rest },
    { title: 'When to get help', icon: '🚨', items: recoveryPlan.watch_for },
    { title: 'Follow-up', icon: '🩺', items: recoveryPlan.follow_up },
  ];

  return (
    <>
      <section className="page-header" style={{ background: 'linear-gradient(135deg, #f5f3ff, #edd9ff)', padding: '40px 0' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#1e1b4b' }}>📄 E-Prescription</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>
            {rx?.dname?.startsWith('Dr. ') ? rx.dname : `Dr. ${rx?.dname}`} · {rx?.created_at ? new Date(rx.created_at).toLocaleDateString() : ''}
          </p>
        </div>
      </section>

      <section className="section" style={{ padding: '40px 0' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <div className="rx-glass card" style={{ padding: '28px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.4)', boxShadow: '0 8px 32px rgba(0,0,0,0.05)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
              <div>
                <span className="status-badge status-confirmed" style={{ background: '#e0e7ff', color: '#4f46e5', fontWeight: 700, padding: '6px 12px', borderRadius: '12px' }}>
                  {rx?.prescription_id}
                </span>
                <p style={{ margin: '12px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Patient: <strong>{rx?.pname}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <a 
                  href={`/api/prescriptions/${rx_id}/download/`} 
                  download 
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  ⬇️ Download PDF
                </a>
                <Link to={is_doctor_view ? "/doctor/dashboard" : "/dashboard"} className="btn btn-outline btn-sm">
                  Dashboard
                </Link>
              </div>
            </div>

            {/* Diagnosis Info */}
            <div className="glass" style={{ padding: '20px', marginBottom: '20px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.45)', border: '1px solid rgba(255,255,255,0.5)' }}>
              <strong style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Diagnosis</strong>
              <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)' }}>
                {rx?.diagnosis || rx?.diagnosis_notes || '—'}
              </p>
              {rx?.follow_up_date && (
                <p style={{ margin: '12px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  📅 Follow-up: <strong style={{ color: 'var(--text)' }}>{rx.follow_up_date}</strong>
                </p>
              )}
            </div>

            {/* Scan Image (if any) */}
            {rx?.original_upload_url && (
              <div className="glass" style={{ padding: '20px', marginBottom: '20px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.3)' }}>
                <strong style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Uploaded Scan</strong>
                {rx.original_upload_url.toLowerCase().includes('.pdf') ? (
                  <a href={rx.original_upload_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    Open PDF Scan
                  </a>
                ) : (
                  <img 
                    src={rx.original_upload_url} 
                    alt="Prescription Scan" 
                    style={{ maxHeight: '280px', maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                )}
              </div>
            )}

            {/* Medicines List */}
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e1b4b', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>Medicines</h3>
            <div className="table-responsive" style={{ overflowX: 'auto', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <table className="table" style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse', margin: 0 }}>
                <thead>
                  <tr style={{ background: '#2563eb', color: 'white' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: 'white', fontWeight: 700, width: '50px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: 'white', fontWeight: 700 }}>Medicine</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: 'white', fontWeight: 700 }}>Dosage</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: 'white', fontWeight: 700 }}>Timing</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: 'white', fontWeight: 700 }}>Duration</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: 'white', fontWeight: 700 }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {medicines && medicines.length > 0 ? (
                    medicines.map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)', backgroundColor: idx % 2 === 1 ? '#f8fafc' : 'white' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>{m.name}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {[m.dosage, m.units_per_dose].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>{m.timing || m.frequency || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>{m.duration || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {m.quantity || 'Not specified'}
                          {m.quantity_source === 'calculated' && (
                            <span style={{ display: 'block', color: '#92400e', fontSize: '0.72rem' }}>Estimated — verify</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-muted" style={{ padding: '16px', textAlign: 'center' }}>No medicines listed.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Doctor notes */}
            {(rx?.doctor_notes || rx?.advice) && (
              <div className="glass" style={{ padding: '18px', borderLeft: '4px solid #7c3aed', background: 'rgba(243, 232, 255, 0.25)', borderRadius: '0 12px 12px 0', marginBottom: '24px' }}>
                <strong style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#6b21a8' }}>Doctor Notes & Advice</strong>
                <p style={{ margin: '6px 0 0', fontSize: '0.92rem', lineHeight: '1.5', color: 'var(--text)' }}>
                  {rx.doctor_notes || rx.advice}
                </p>
              </div>
            )}

            {/* AI Explanation Section */}
            {(rx?.ai_explanation || is_doctor_view) && (
              <div className="glass ai-explanation-section" style={{ padding: '24px', borderLeft: '4px solid #4f46e5', background: 'rgba(238, 242, 255, 0.4)', borderRadius: '0 16px 16px 0', marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem', background: '#e0e7ff', color: '#4f46e5', padding: '6px 10px', borderRadius: '50%' }}>🤖</span>
                    <h3 style={{ margin: 0, color: '#4f46e5', fontSize: '1.15rem', fontWeight: 700 }}>Your Prescription & Recovery Plan</h3>
                  </div>
                  <div>
                    {rx?.ai_explanation ? (
                      <span className="status-badge" style={{ backgroundColor: rx.ai_status === 'success' ? '#ecfdf5' : '#fffbeb', color: rx.ai_status === 'success' ? '#065f46' : '#92400e', border: `1px solid ${rx.ai_status === 'success' ? '#a7f3d0' : '#fef3c7'}`, fontSize: '0.78rem', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                        {rx.ai_status === 'success' ? '🟢 Recovery guide' : 'ℹ️ Prescription guide'} ({rx.ai_language || 'English'})
                      </span>
                    ) : (
                      <span className="status-badge" style={{ backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', fontSize: '0.78rem', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                        ⚪ AI Summary Pending
                      </span>
                    )}
                  </div>
                </div>

                <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  A practical guide based on the prescription and doctor’s notes. Follow the verified pharmacy label if anything differs.
                </p>

                {recoveryPlan.medicine_guidance?.length > 0 && (
                  <div style={{ marginBottom: '18px' }}>
                    <h4 style={{ color: '#1e1b4b', fontSize: '1rem', margin: '0 0 10px' }}>Medicine guide</h4>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {recoveryPlan.medicine_guidance.map((medicine, index) => (
                        <div key={`${medicine.name}-${index}`} style={{ background: '#fff', border: '1px solid #e0e7ff', borderRadius: '12px', padding: '14px' }}>
                          <strong style={{ color: '#312e81' }}>💊 {medicine.name}</strong>
                          {medicine.purpose && <p style={{ margin: '5px 0', fontSize: '0.86rem' }}>{medicine.purpose}</p>}
                          {medicine.how_to_take && <p style={{ margin: '5px 0', fontSize: '0.86rem' }}><strong>How to take:</strong> {medicine.how_to_take}</p>}
                          {medicine.caution && <p style={{ margin: '5px 0 0', color: '#92400e', fontSize: '0.83rem' }}><strong>Quantity / check:</strong> {medicine.caution}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
                  {recoverySections.filter(section => section.items?.length > 0).map(section => (
                    <section key={section.title} style={{ background: '#fff', border: '1px solid rgba(15, 23, 42, 0.08)', borderRadius: '12px', padding: '14px' }}>
                      <h4 style={{ color: '#312e81', fontSize: '0.92rem', margin: '0 0 8px' }}>{section.icon} {section.title}</h4>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.84rem', lineHeight: 1.55, color: '#374151' }}>
                        {section.items.map((item, index) => <li key={`${section.title}-${index}`} style={{ marginBottom: '5px' }}>{item}</li>)}
                      </ul>
                    </section>
                  ))}
                </div>

                {recoveryPlan.disclaimer && (
                  <p style={{ margin: '18px 0 0', borderTop: '1px solid rgba(0, 0, 0, 0.06)', paddingTop: '12px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {recoveryPlan.disclaimer}
                  </p>
                )}

                {/* CDS warnings */}
                {rx?.cds_warnings && (
                  <div className="glass" style={{ marginTop: '20px', padding: '16px', borderLeft: '4px solid #f97316', background: '#fff7ed', color: '#7c2d12', borderRadius: '8px' }}>
                    <strong style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#c2410c' }}>Clinical Decision Support Alerts</strong>
                    <ul style={{ marginTop: '8px', paddingLeft: '18px', fontSize: '0.85rem' }}>
                      {rx.cds_warnings.split('\n').filter(Boolean).map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* AI translation / regeneration option */}
                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid rgba(0, 0, 0, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Summary Language:</label>
                    <select 
                      value={regenLanguage} 
                      onChange={(e) => setRegenLanguage(e.target.value)}
                      className="form-input" 
                      style={{ padding: '4px 10px', fontSize: '0.85rem', borderRadius: '8px', width: '120px' }}
                    >
                      <option value="English">English</option>
                      <option value="Hindi">Hindi</option>
                      <option value="Marathi">Marathi</option>
                    </select>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleRegenerateAI}
                    disabled={regenLoading}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {regenLoading ? 'Updating...' : (is_doctor_view ? '🔄 Regenerate AI Summary' : '🔄 Translate AI Summary')}
                  </button>
                </div>
              </div>
            )}

            {/* Reminders section for patients */}
            {!is_doctor_view && reminders && reminders.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e1b4b', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>Medicine Reminders</h3>
                <ul style={{ fontSize: '0.9rem', paddingLeft: '18px', lineHeight: '1.6' }}>
                  {reminders.map((r, idx) => (
                    <li key={idx}>
                      <strong>{r.medicine_name}</strong> — daily at <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{r.remind_time}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rx?.email_sent && (
              <p style={{ color: '#16a34a', fontSize: '0.82rem', marginTop: '16px', fontWeight: 500 }}>
                ✅ Prescription PDF copy successfully emailed to the patient.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* AI Loader Overlay Modal */}
      {regenLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="card" style={{
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(229, 231, 235, 0.5)',
            padding: '32px',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            maxWidth: '350px',
            width: '90%',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #f3e8ff',
              borderTop: '4px solid #7c3aed',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <div style={{ fontWeight: 700, fontSize: '1.15rem', color: '#1e1b4b' }}>Regenerating AI Explanation...</div>
            <div style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: '1.5' }}>
              Gemini is rewriting details in the selected language. This may take a few seconds.
            </div>
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}} />
        </div>
      )}
    </>
  );
};

export default PrescriptionDetail;
