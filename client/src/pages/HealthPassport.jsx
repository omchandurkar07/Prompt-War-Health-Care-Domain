import React, { useState, useEffect } from 'react';
import axios from 'axios';

const HealthPassport = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [familyMemberId, setFamilyMemberId] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [sections, setSections] = useState({
    conditions: true,
    medications: true,
    allergies: true,
    lab_results: true,
    vaccinations: true,
    blood_group: true
  });
  const [genLoading, setGenLoading] = useState(false);
  const [genMessage, setGenMessage] = useState('');

  // QR Modal View
  const [generatedPass, setGeneratedPass] = useState(null);

  const fetchPassports = async () => {
    try {
      const res = await axios.get('/api/health-passport');
      if (res.data && res.data.ok) {
        setData(res.data);
      } else {
        setError(res.data.error || 'Failed to load health passports.');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error loading health passports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPassports();
  }, []);

  const handleSectionChange = (sec) => {
    setSections(prev => ({
      ...prev,
      [sec]: !prev[sec]
    }));
  };

  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    if (pin.length !== 4 || isNaN(pin)) {
      alert('PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      alert('PINs do not match.');
      return;
    }

    setGenLoading(true);
    setGenMessage('');

    const activeSections = Object.entries(sections)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name);

    try {
      const res = await axios.post('/api/health-passport/generate', {
        family_member_id: familyMemberId || null,
        date_range: dateRange,
        pin,
        pin_confirm: pinConfirm,
        sections: activeSections
      });

      if (res.data && res.data.ok) {
        setGenMessage('🎉 Health Passport generated successfully!');
        setGeneratedPass({
          token: res.data.token,
          pin: pin
        });
        setPin('');
        setPinConfirm('');
        fetchPassports();
      } else {
        setGenMessage(`❌ ${res.data.error || 'Failed to generate passport.'}`);
      }
    } catch (err) {
      console.error(err);
      setGenMessage(`❌ ${err.response?.data?.error || 'Server error generating health passport.'}`);
    } finally {
      setGenLoading(false);
    }
  };

  if (loading && !data) {
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

  const { patient, family = [], passports = [] } = data || {};

  return (
    <div className="container" style={{ padding: '30px 20px' }}>
      
      {/* Title block */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(37,99,235,0.06))' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0 }}>Clinical Health Passports</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Generate secure, temporary QR-coded health passports containing emergency contacts, active prescriptions, and critical allergies. Shareable with hospitals during clinical consults.</p>
      </div>

      <div className="row g-4">
        {/* Left Side: Generator form */}
        <div className="col-lg-5">
          <div className="glass" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '16px' }}>🎫 Generate New Health Passport</h3>

            {genMessage && (
              <div className={`alert ${genMessage.includes('successfully') ? 'alert-success' : 'alert-danger'}`} style={{ padding: '10px 12px', fontSize: '0.82rem', marginBottom: '14px' }}>
                {genMessage}
              </div>
            )}

            <form onSubmit={handleGenerateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Associate Profile</label>
                <select 
                  className="form-control form-control-sm"
                  value={familyMemberId}
                  onChange={(e) => setFamilyMemberId(e.target.value)}
                >
                  <option value="">Personal Profile ({patient?.full_name})</option>
                  {family.map(f => (
                    <option key={f._id} value={f._id}>{f.full_name} ({f.relationship})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Clinical Information Sections</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  {Object.entries(sections).map(([secName, enabled]) => (
                    <label key={secName} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer', margin: 0 }}>
                      <input 
                        type="checkbox" 
                        checked={enabled} 
                        onChange={() => handleSectionChange(secName)} 
                      />
                      <span style={{ textTransform: 'capitalize' }}>{secName.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Lab Results Date Range</label>
                <select 
                  className="form-control form-control-sm"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                >
                  <option value="all">Include All Historical Records</option>
                  <option value="1">Past 1 Month Only</option>
                  <option value="3">Past 3 Months Only</option>
                  <option value="6">Past 6 Months Only</option>
                  <option value="12">Past 1 Year Only</option>
                </select>
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Set 4-Digit Security PIN</label>
                    <input 
                      type="password"
                      maxLength="4"
                      placeholder="e.g. 1234"
                      className="form-control form-control-sm"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Confirm PIN</label>
                    <input 
                      type="password"
                      maxLength="4"
                      placeholder="e.g. 1234"
                      className="form-control form-control-sm"
                      value={pinConfirm}
                      onChange={(e) => setPinConfirm(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={genLoading}
                className="btn btn-primary btn-sm w-100"
                style={{ marginTop: '6px' }}
              >
                {genLoading ? 'Compiling Passport...' : '🎫 Generate Health Passport'}
              </button>

            </form>
          </div>
        </div>

        {/* Right Side: Passports list */}
        <div className="col-lg-7">
          <div className="glass" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>📜 Past Health Passports</h3>

            {passports.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No health passports generated yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {passports.map(p => (
                  <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text)' }}>Passport Code: {p.passport_token.slice(0, 12)}...</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                        📅 Created: {new Date(p.created_at).toLocaleDateString('en-IN')} · Mode: {p.date_range} · Sections: {p.sections.join(', ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => setGeneratedPass({ token: p.passport_token, pin: '****' })}
                        className="btn btn-outline btn-xs"
                      >
                        🔎 View QR Code
                      </button>
                      <a 
                        href={`/verify-passport/${p.passport_token}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn btn-ghost btn-xs"
                      >
                        Open Verification
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* QR Code Viewer Modal */}
      {generatedPass && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '400px', padding: '28px', position: 'relative', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            
            <button 
              onClick={() => setGeneratedPass(null)} 
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>

            <span style={{ fontSize: '2rem' }}>🎫</span>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Secure Health Passport QR</h3>
            
            <div style={{ padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '12px', display: 'inline-block' }}>
              <img 
                src={`/api/health-passport/qr/${generatedPass.token}`} 
                alt="QR Verification Link" 
                style={{ width: '200px', height: '200px', display: 'block' }}
              />
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              Practitioners can scan this QR code with any mobile device to review your emergency medical parameters securely.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '8px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Required PIN:</span>
              <strong style={{ fontSize: '1.1rem', letterSpacing: '1px', color: 'var(--primary)' }}>{generatedPass.pin}</strong>
            </div>

            <button onClick={() => setGeneratedPass(null)} className="btn btn-outline btn-sm w-100">
              Close Sheet
            </button>

          </div>
        </div>
      )}

      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default HealthPassport;
