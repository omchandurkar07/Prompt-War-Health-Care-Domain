import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';

const DoctorPrepSheet = () => {
  const { aid } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPrepSheet = async () => {
    try {
      const res = await axios.get(`/api/doctor/prep-sheet/${aid}`);
      if (res.data && res.data.ok) {
        setData(res.data);
      } else {
        setError(res.data.error || 'Failed to load prep sheet.');
      }
    } catch (err) {
      console.error(err);
      setError('You are not authorized to view this visit prep sheet, or it does not exist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrepSheet();
  }, [aid]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f4f6', borderTop: '4px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '40px 20px', maxWidth: '750px' }}>
        <div className="alert alert-danger">❌ &nbsp;{error}</div>
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/doctor/dashboard" className="btn btn-outline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const { appt, prep, meds = [], allergies = [] } = data || {};

  return (
    <>
      <section className="page-header" style={{ background: 'linear-gradient(135deg, #fdf4ff, #fae8ff)', padding: '40px 0' }}>
        <div className="container" style={{ maxWidth: '750px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#1e1b4b' }}>📋 Visit Prep Sheet</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>
            Patient: <strong>{appt?.fm_name || appt?.pname}</strong> · {appt?.appt_date} {appt?.time_slot}
          </p>
        </div>
      </section>

      <section className="section" style={{ padding: '40px 0' }}>
        <div className="container" style={{ maxWidth: '750px' }}>
          
          {prep ? (
            <>
              {/* Patient Info Summary */}
              <div className="glass" style={{ padding: '24px', marginBottom: '24px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#1e1b4b' }}>{appt?.fm_name || appt?.pname}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0' }}>
                      {appt?.dob && <>DOB: {appt.dob}</>}
                      {appt?.gender && <> · {appt.gender}</>}
                      {appt?.blood_group && <> · {appt.blood_group}</>}
                    </p>
                    {appt?.pphone && <p style={{ fontSize: '0.85rem', margin: '8px 0 0', color: 'var(--text)' }}>📞 {appt.pphone}</p>}
                  </div>
                  <div>
                    {allergies && allergies.length > 0 ? (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ marginBottom: '4px' }}><strong style={{ color: '#dc2626', fontSize: '0.85rem' }}>⚠️ Known Allergies:</strong></div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {allergies.map((a, idx) => (
                            <span key={idx} className="badge badge-red" style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px' }}>
                              {a.allergy_name} ({a.severity})
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.85rem', color: '#16a34a', margin: '0 0 8px' }}>🟢 No known clinical allergies</p>
                    )}
                    {appt?.chronic_conditions && (
                      <p style={{ fontSize: '0.85rem', margin: '4px 0 0', color: 'var(--text)' }}>
                        <strong>🏥 Chronic Conditions:</strong> {appt.chronic_conditions}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Prep Sheet Content */}
              <div className="prep-sheet glass" style={{ padding: '28px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.4)', boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
                
                <div className="prep-field" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>🩺 Chief Complaint</label>
                  <p className="prep-value" style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{prep.chief_complaint || '—'}</p>
                </div>

                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', margin: '20px 0' }}>
                  <div className="prep-field" style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>⏱️ Duration</label>
                    <p className="prep-value" style={{ fontSize: '1rem', fontWeight: 500, margin: 0 }}>{prep.duration || '—'}</p>
                  </div>
                  <div className="prep-field" style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>📊 Severity</label>
                    <p className="prep-value" style={{ fontSize: '1rem', fontWeight: 500, margin: 0 }}>
                      {Array.from({ length: prep.severity || 0 }).map((_, i) => (
                        <span key={i}>
                          {prep.severity === 1 ? '😊' : ''}
                          {prep.severity === 2 ? '🙂' : ''}
                          {prep.severity === 3 ? '😐' : ''}
                          {prep.severity === 4 ? '😣' : ''}
                          {prep.severity === 5 ? '😫' : ''}
                        </span>
                      ))}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '6px' }}> ({prep.severity}/5)</span>
                    </p>
                  </div>
                </div>

                {prep.better_worse && (
                  <div className="prep-field" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>🔄 What makes it better/worse</label>
                    <p className="prep-value" style={{ fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>{prep.better_worse}</p>
                  </div>
                )}

                {meds && meds.length > 0 && (
                  <div className="prep-field" style={{ marginBottom: '20px', marginTop: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>💊 Current Medications</label>
                    <div className="plan-pills" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {meds.map((m, idx) => (
                        <span key={idx} className="plan-pill" style={{ background: '#f3e8ff', color: '#6b21a8', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 500 }}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vitals */}
                {(prep.temperature || prep.bp_systolic || prep.blood_sugar) && (
                  <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e1b4b', marginBottom: '12px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📊 Self-Measured Vitals</label>
                    <div className="vitals-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                      {prep.temperature && (
                        <div className="vital-box glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.4)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.3)' }}>
                          <span className="vital-icon" style={{ fontSize: '1.5rem', marginBottom: '6px' }}>🌡️</span>
                          <span className="vital-val" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>{prep.temperature}°F</span>
                          <span className="vital-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Temperature</span>
                        </div>
                      )}
                      {prep.bp_systolic && (
                        <div className="vital-box glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.4)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.3)' }}>
                          <span className="vital-icon" style={{ fontSize: '1.5rem', marginBottom: '6px' }}>💓</span>
                          <span className="vital-val" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>{prep.bp_systolic}/{prep.bp_diastolic || '?'}</span>
                          <span className="vital-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Blood Pressure</span>
                        </div>
                      )}
                      {prep.blood_sugar && (
                        <div className="vital-box glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.4)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.3)' }}>
                          <span className="vital-icon" style={{ fontSize: '1.5rem', marginBottom: '6px' }}>🩸</span>
                          <span className="vital-val" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)' }}>{prep.blood_sugar} mg/dL</span>
                          <span className="vital-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Blood Sugar</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {prep.additional_notes && (
                  <div className="prep-field" style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>📝 Additional Notes</label>
                    <p className="prep-value" style={{ fontSize: '0.95rem', margin: 0, lineHeight: 1.5, color: 'var(--text)' }}>{prep.additional_notes}</p>
                  </div>
                )}

                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '24px', textAlign: 'right', fontStyle: 'italic' }}>
                  Submitted: {prep.created_at ? new Date(prep.created_at).toLocaleString() : ''}
                </p>
              </div>
            </>
          ) : (
            <div className="glass" style={{ padding: '60px 40px', textAlign: 'center', borderRadius: '16px', background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(10px)' }}>
              <div className="empty-icon" style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>No Prep Sheet Submitted</h3>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>The patient hasn't filled out a pre-visit form for this appointment.</p>
            </div>
          )}

          <div className="center-action" style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link to="/doctor/dashboard" className="btn btn-outline">← Back to Dashboard</Link>
            {prep && (
              <Link to={`/doctor/prescription/${appt?._id || appt?.id}`} className="btn btn-primary">
                ✍️ Write Prescription
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default DoctorPrepSheet;
