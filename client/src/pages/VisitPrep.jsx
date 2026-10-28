import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const VisitPrep = () => {
  const { aid } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Form State
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [duration, setDuration] = useState('');
  const [severity, setSeverity] = useState(5);
  const [betterWorse, setBetterWorse] = useState('');
  const [medsList, setMedsList] = useState(['']); // List of current meds strings
  const [temperature, setTemperature] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const fetchPrepDetails = async () => {
    try {
      const res = await axios.get(`/api/visit-prep/${aid}`);
      if (res.data && res.data.ok) {
        setData(res.data);
        const existing = res.data.existing;
        if (existing) {
          setChiefComplaint(existing.chief_complaint || '');
          setDuration(existing.duration || '');
          setSeverity(existing.severity || 5);
          setBetterWorse(existing.better_worse || '');
          setTemperature(existing.temperature || '');
          setBpSystolic(existing.bp_systolic || '');
          setBpDiastolic(existing.bp_diastolic || '');
          setBloodSugar(existing.blood_sugar || '');
          setAdditionalNotes(existing.additional_notes || '');
        }

        // Initialize medications list from existing or auto pull
        const existingMeds = res.data.existing_meds || [];
        if (existingMeds.length > 0) {
          setMedsList(existingMeds);
        } else if (res.data.auto_meds && res.data.auto_meds.length > 0) {
          setMedsList(res.data.auto_meds.map(m => m.name));
        }
      } else {
        setError(res.data.error || 'Failed to load visit prep details.');
      }
    } catch (err) {
      console.error(err);
      setError('You are not authorized to fill out visit prep sheets for this appointment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrepDetails();
  }, [aid]);

  const addMedRow = () => {
    setMedsList([...medsList, '']);
  };
  const removeMedRow = (idx) => {
    setMedsList(medsList.filter((_, i) => i !== idx));
  };
  const updateMedRow = (idx, val) => {
    setMedsList(prev => prev.map((med, i) => i === idx ? val : med));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!chiefComplaint.trim()) {
      alert('Please specify your chief symptom complaint.');
      return;
    }

    setSubmitLoading(true);
    setMessage('');
    try {
      const res = await axios.post(`/api/visit-prep/${aid}`, {
        chief_complaint: chiefComplaint,
        duration,
        severity,
        better_worse: betterWorse,
        med_name: medsList,
        temperature,
        bp_systolic: bpSystolic,
        bp_diastolic: bpDiastolic,
        blood_sugar: bloodSugar,
        additional_notes: additionalNotes
      });

      if (res.data && res.data.ok) {
        setMessage('🎉 Prep sheet submitted successfully!');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } else {
        setMessage(`❌ ${res.data.error || 'Submission failed.'}`);
      }
    } catch (err) {
      console.error(err);
      setMessage('❌ Error submitting clinical prep details.');
    } finally {
      setSubmitLoading(false);
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

  const { appt } = data || {};

  return (
    <div className="container animate-fade-in" style={{ padding: '30px 20px', maxWidth: '750px' }}>
      
      {/* Title Header */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(99,102,241,0.06))' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 850, margin: 0 }}>Clinical Visit Prep Sheet</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Complete this diagnostic questionnaire for your upcoming appointment with Dr. <strong>{appt.dname}</strong> ({appt.specialization}). This lets your practitioner review your vitals beforehand.
        </p>
      </div>

      {message && (
        <div className={`alert ${message.includes('successfully') ? 'alert-success' : 'alert-danger'}`} style={{ padding: '10px 12px', fontSize: '0.82rem', marginBottom: '16px' }}>
          {message}
        </div>
      )}

      <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Symptoms Section */}
        <div className="glass" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '14px' }}>🩺 Symptom History</h3>
          
          <div className="form-group mb-3">
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>What is your primary medical concern/symptom? (Chief Complaint)</label>
            <input 
              type="text" 
              placeholder="e.g. Sharp pain in lower abdomen, chest tightness"
              className="form-control form-control-sm"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              required
            />
          </div>

          <div className="row g-2 mb-3">
            <div className="col-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>How long has this lasted?</label>
                <input 
                  type="text" 
                  placeholder="e.g. 3 days, 2 weeks"
                  className="form-control form-control-sm"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
            
            <div className="col-6">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Severity Scale (1-10)</label>
                <select 
                  className="form-control form-control-sm"
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value))}
                >
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <option key={n} value={n}>{n} {n >= 8 ? '— Severe Pain' : n >= 4 ? '— Moderate' : '— Mild discomfort'}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>What makes it feel better or worse?</label>
            <input 
              type="text" 
              placeholder="e.g. sitting up relieves it, hot water worsens it"
              className="form-control form-control-sm"
              value={betterWorse}
              onChange={(e) => setBetterWorse(e.target.value)}
            />
          </div>

        </div>

        {/* Vitals Section */}
        <div className="glass" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '14px' }}>🌡️ Home Vitals Logging (Optional)</h3>
          
          <div className="row g-2">
            <div className="col-4">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Temp (°F)</label>
                <input 
                  type="number" 
                  step="any"
                  placeholder="e.g. 98.6"
                  className="form-control form-control-sm"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </div>
            </div>

            <div className="col-4">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Blood Pressure (BP)</label>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input type="number" placeholder="Sys" className="form-control form-control-sm" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} />
                  <span>/</span>
                  <input type="number" placeholder="Dia" className="form-control form-control-sm" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="col-4">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Blood Sugar (mg/dL)</label>
                <input 
                  type="number" 
                  placeholder="e.g. 110"
                  className="form-control form-control-sm"
                  value={bloodSugar}
                  onChange={(e) => setBloodSugar(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Current Medicines */}
        <div className="glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>💊 Active Medications You Take</h3>
            <button type="button" onClick={addMedRow} className="btn btn-outline btn-xs">Add Medicine</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {medsList.map((med, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="e.g. Metformin 500mg, Atorvastatin 10mg"
                  className="form-control form-control-sm"
                  value={med}
                  onChange={(e) => updateMedRow(idx, e.target.value)}
                  style={{ flex: 1 }}
                />
                {medsList.length > 1 && (
                  <button type="button" onClick={() => removeMedRow(idx)} className="btn btn-ghost btn-xs" style={{ color: '#ef4444' }}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="glass" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '12px' }}>📝 Questions for Doctor</h3>
          <textarea 
            rows="2"
            className="form-control form-control-sm"
            placeholder="List any questions or instructions you would like to discuss during your consult..."
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            style={{ fontSize: '0.82rem' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={submitLoading}
          className="btn btn-primary"
          style={{ padding: '14px 20px', fontWeight: 800, borderRadius: '10px' }}
        >
          {submitLoading ? 'Submitting Form...' : 'Compile & Submit Prep Sheet'}
        </button>

      </form>

      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default VisitPrep;
