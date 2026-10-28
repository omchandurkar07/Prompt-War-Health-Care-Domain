import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const VerifyPassport = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Verification states
  const [pin, setPin] = useState('');
  const [verifiedData, setVerifiedData] = useState(null);
  const [pinError, setPinError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const checkPassportToken = async () => {
    try {
      const res = await axios.get(`/api/verify-passport/${token}`);
      if (res.data && res.data.ok) {
        // Valid token, waiting for PIN entry
        setLoading(false);
      } else {
        setError(res.data.error || 'Passport token has expired or is invalid.');
      }
    } catch (err) {
      console.error(err);
      setError('Invalid health passport link or token.');
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPassportToken();
  }, [token]);

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (pin.length !== 4 || isNaN(pin)) {
      setPinError('PIN must be exactly 4 digits.');
      return;
    }

    setSubmitLoading(true);
    setPinError('');
    try {
      const res = await axios.post(`/api/verify-passport/${token}`, { pin });
      if (res.data && res.data.ok) {
        setVerifiedData(res.data.data);
      } else {
        setPinError(res.data.error || 'Authentication failed.');
      }
    } catch (err) {
      console.error(err);
      setPinError(err.response?.data?.error || 'Incorrect security PIN code.');
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
    <div className="container animate-fade-in" style={{ padding: '30px 20px', maxWidth: '800px' }}>
      
      {!verifiedData ? (
        // PIN Verification Screen
        <div className="glass" style={{ padding: '40px', textAlign: 'center', maxWidth: '460px', margin: '40px auto' }}>
          <span style={{ fontSize: '3rem' }}>🔐</span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 850, marginTop: '16px', color: '#0f172a' }}>Enter Passport Security PIN</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.4 }}>
            This medical summary is password protected. Please enter the 4-digit PIN provided by the patient to decrypt their health history.
          </p>

          {pinError && (
            <div className="alert alert-danger" style={{ padding: '10px', fontSize: '0.8rem', margin: '14px 0' }}>
              ❌ {pinError}
            </div>
          )}

          <form onSubmit={handleVerifySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
            <div className="form-group">
              <input 
                type="password"
                maxLength="4"
                placeholder="• • • •"
                className="form-control"
                style={{ textAlign: 'center', fontSize: '1.75rem', letterSpacing: '12px', padding: '10px', borderRadius: '12px' }}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button 
              type="submit" 
              disabled={submitLoading}
              className="btn btn-primary btn-lg w-100"
              style={{ padding: '14px', borderRadius: '10px', fontWeight: 800 }}
            >
              {submitLoading ? 'Decrypting Medical Data...' : '🔓 Decrypt & Verify'}
            </button>
          </form>
        </div>
      ) : (
        // Verified Passport Display Screen
        <div className="glass animate-fade-in" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #f1f5f9', paddingBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '0.72rem', background: '#d1fae5', color: '#065f46', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>✔ Verified Medical Summary</span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 850, margin: '6px 0 0' }}>{verifiedData.name}</h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Gender: <strong>{verifiedData.gender || '—'}</strong> · Age: <strong>{verifiedData.dob ? `${new Date().getFullYear() - new Date(verifiedData.dob).getFullYear()} yrs` : '—'}</strong>
            </div>
          </div>

          <div className="row g-4">
            {/* Left side info */}
            <div className="col-md-6">
              
              {/* Core metrics */}
              <div className="card-custom" style={{ padding: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: '0 0 10px' }}>🩸 Clinical Constants</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                  <div>Blood Group: <strong>{verifiedData.blood_group || 'Not Specified'}</strong></div>
                  <div>Chronic Conditions: <strong style={{ color: '#ef4444' }}>{verifiedData.conditions || 'None Reported'}</strong></div>
                  {verifiedData.emergency_contact && <div>Emergency Contact: <strong>{verifiedData.emergency_contact}</strong></div>}
                </div>
              </div>

              {/* Allergies list */}
              {verifiedData.allergies && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '10px' }}>⚠️ Active Allergies</h4>
                  {verifiedData.allergies.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>None registered.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {verifiedData.allergies.map((a, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.8rem' }}>
                          <strong>{a.name}</strong>
                          <span style={{ color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.72rem' }}>{a.severity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Active Medications */}
              {verifiedData.medications && (
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '10px' }}>💊 Active Medications</h4>
                  {verifiedData.medications.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No active prescriptions.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {verifiedData.medications.map((m, idx) => (
                        <div key={idx} style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '0.8rem' }}>
                          <strong>{m.name}</strong>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Prescribed by: {m.doctor}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Right side info */}
            <div className="col-md-6">
              
              {/* Lab Results summary */}
              {verifiedData.lab_results && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '10px' }}>🔬 Recent Diagnostic Results</h4>
                  {verifiedData.lab_results.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No uploaded lab reports.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {verifiedData.lab_results.map((l, idx) => (
                        <div key={idx} style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>{l.title}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{l.record_date}</span>
                          </div>
                          {l.description && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>{l.description}</p>}
                          {l.doctor_name && <span style={{ fontSize: '0.68rem', display: 'block', color: 'var(--primary)', marginTop: '4px' }}>Clinician: {l.doctor_name}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Vaccinations */}
              {verifiedData.vaccinations && (
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '10px' }}>💉 Vaccination History</h4>
                  {verifiedData.vaccinations.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No immunizations logged.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {verifiedData.vaccinations.map((v, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '0.8rem' }}>
                          <strong>{v.vaccine_name}</strong>
                          <span style={{ fontSize: '0.72rem', color: '#166534' }}>Administered: {v.completed_date}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '28px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <button onClick={() => setVerifiedData(null)} className="btn btn-outline btn-sm">
              🔒 Re-lock Passport Data
            </button>
          </div>

        </div>
      )}

      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default VerifyPassport;
