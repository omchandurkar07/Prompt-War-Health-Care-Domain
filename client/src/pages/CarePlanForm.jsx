import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const CarePlanForm = () => {
  const { aid } = useParams();
  const navigate = useNavigate();
  const [appt, setAppt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Form State lists
  const [medList, setMedList] = useState([{ name: '', dosage: '', frequency: 'Once daily (morning)', route: 'Oral', instructions: '' }]);
  const [lifestyleList, setLifestyleList] = useState([{ text: '', time: 'morning' }]);
  const [labList, setLabList] = useState([{ name: '', instructions: '' }]);
  const [followupDate, setFollowupDate] = useState('');

  // Target boundaries
  const [targets, setTargets] = useState({
    target_sugar_fasting_min: '70',
    target_sugar_fasting_max: '110',
    target_sugar_post_meal_min: '100',
    target_sugar_post_meal_max: '140',
    target_bp_systolic_min: '90',
    target_bp_systolic_max: '130',
    target_bp_diastolic_min: '60',
    target_bp_diastolic_max: '85',
    target_spo2_min: '95',
    target_temp_min: '97',
    target_temp_max: '99',
    target_weight_min: '60',
    target_weight_max: '80'
  });

  const fetchApptInfo = async () => {
    try {
      const res = await axios.get(`/api/doctor/care-plan/${aid}`);
      if (res.data && res.data.ok) {
        setAppt(res.data.appt);
      } else {
        setError(res.data.error || 'Failed to load consult appointment details.');
      }
    } catch (err) {
      console.error(err);
      setError('You are not authorized to write Care Plans for this patient session.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApptInfo();
  }, [aid]);

  // Medicines mutators
  const addMedRow = () => {
    setMedList([...medList, { name: '', dosage: '', frequency: 'Once daily (morning)', route: 'Oral', instructions: '' }]);
  };
  const removeMedRow = (idx) => {
    setMedList(medList.filter((_, i) => i !== idx));
  };
  const updateMedRow = (idx, field, val) => {
    setMedList(prev => prev.map((med, i) => i === idx ? { ...med, [field]: val } : med));
  };

  // Lifestyle mutators
  const addLifestyleRow = () => {
    setLifestyleList([...lifestyleList, { text: '', time: 'morning' }]);
  };
  const removeLifestyleRow = (idx) => {
    setLifestyleList(lifestyleList.filter((_, i) => i !== idx));
  };
  const updateLifestyleRow = (idx, field, val) => {
    setLifestyleList(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  // Lab mutators
  const addLabRow = () => {
    setLabList([...labList, { name: '', instructions: '' }]);
  };
  const removeLabRow = (idx) => {
    setLabList(labList.filter((_, i) => i !== idx));
  };
  const updateLabRow = (idx, field, val) => {
    setLabList(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setMessage('');

    // Compile lists into request body arrays
    const payload = {
      start_date: new Date().toISOString().split('T')[0],
      duration_days: 30, // Default 1 month Care Plan duration
      followup_date: followupDate || null,
      ...targets
    };

    // Append lists
    payload.med_name = medList.map(m => m.name);
    payload.med_dosage = medList.map(m => m.dosage);
    payload.med_frequency = medList.map(m => m.frequency);
    payload.med_route = medList.map(m => m.route);
    payload.med_instructions = medList.map(m => m.instructions);

    payload.lifestyle_text = lifestyleList.map(l => l.text);
    payload.lifestyle_time = lifestyleList.map(l => l.time);

    payload.lab_name = labList.map(l => l.name);
    payload.lab_instructions = labList.map(l => l.instructions);

    try {
      const res = await axios.post(`/api/doctor/care-plan/${aid}`, payload);
      if (res.data && res.data.ok) {
        setMessage('🎉 Healing Care Plan compiled successfully!');
        setTimeout(() => {
          navigate('/doctor/dashboard');
        }, 1500);
      } else {
        setMessage(`❌ ${res.data.error || 'Failed to submit Care Plan.'}`);
      }
    } catch (err) {
      console.error(err);
      setMessage(`❌ ${err.response?.data?.error || 'Server error compiling Care Plan.'}`);
    } finally {
      setSubmitLoading(false);
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

  return (
    <div className="container animate-fade-in" style={{ padding: '30px 20px', maxWidth: '850px' }}>
      
      {/* Title Header */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', background: 'linear-gradient(135deg, rgba(5,150,105,0.06), rgba(37,99,235,0.06))' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 850, margin: 0, color: '#059669' }}>Compile Patients Healing Care Plan</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Formulating clinical checklist parameters for patient: <strong style={{ color: 'var(--text)' }}>{appt?.pname}</strong> {appt?.fm_name && `(Dependent: ${appt.fm_name})`}.
        </p>
      </div>

      {message && (
        <div className={`alert ${message.includes('successfully') ? 'alert-success' : 'alert-danger'}`} style={{ padding: '10px 14px', fontSize: '0.85rem', marginBottom: '16px' }}>
          {message}
        </div>
      )}

      <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* Medications */}
        <div className="glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>💊 Prescribed Medications</h3>
            <button type="button" onClick={addMedRow} className="btn btn-outline btn-xs">➕ Add Medicine</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {medList.map((med, idx) => (
              <div key={idx} style={{ padding: '14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', position: 'relative' }}>
                {medList.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeMedRow(idx)}
                    style={{ position: 'absolute', top: '10px', right: '10px', border: 'none', background: 'transparent', color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
                
                <div className="row g-2">
                  <div className="col-md-6 col-12">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Medicine Brand Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Paracetamol 650mg"
                        className="form-control form-control-sm"
                        value={med.name}
                        onChange={(e) => updateMedRow(idx, 'name', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="col-md-3 col-6">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Dosage Metric</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 1 tablet"
                        className="form-control form-control-sm"
                        value={med.dosage}
                        onChange={(e) => updateMedRow(idx, 'dosage', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="col-md-3 col-6">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Route of Intake</label>
                      <select 
                        className="form-control form-control-sm"
                        value={med.route}
                        onChange={(e) => updateMedRow(idx, 'route', e.target.value)}
                      >
                        <option value="Oral">Oral</option>
                        <option value="Injection">Injection</option>
                        <option value="Inhalation">Inhalation</option>
                        <option value="Topical">Topical</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="col-md-6 col-12">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Frequency Pattern</label>
                      <select 
                        className="form-control form-control-sm"
                        value={med.frequency}
                        onChange={(e) => updateMedRow(idx, 'frequency', e.target.value)}
                      >
                        <option value="Once daily (morning)">Once daily (morning)</option>
                        <option value="Once daily (evening)">Once daily (evening)</option>
                        <option value="Twice daily (morning and evening)">Twice daily (morning and evening)</option>
                        <option value="Three times daily">Three times daily</option>
                        <option value="Once daily (afternoon)">Once daily (afternoon)</option>
                        <option value="As needed (SOS)">As needed (SOS)</option>
                      </select>
                    </div>
                  </div>

                  <div className="col-md-6 col-12">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Food Instructions</label>
                      <input 
                        type="text" 
                        placeholder="e.g. after lunch, before breakfast"
                        className="form-control form-control-sm"
                        value={med.instructions}
                        onChange={(e) => updateMedRow(idx, 'instructions', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Lifestyle items */}
        <div className="glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>🏃 Lifestyle Habit Adjustments</h3>
            <button type="button" onClick={addLifestyleRow} className="btn btn-outline btn-xs">➕ Add Task</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {lifestyleList.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="e.g. Drink 1L water, brisk walk 30 mins"
                  className="form-control form-control-sm"
                  value={item.text}
                  onChange={(e) => updateLifestyleRow(idx, 'text', e.target.value)}
                  required
                  style={{ flex: 2 }}
                />
                
                <select 
                  className="form-control form-control-sm"
                  value={item.time}
                  onChange={(e) => updateLifestyleRow(idx, 'time', e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                  <option value="any">Anytime</option>
                </select>

                {lifestyleList.length > 1 && (
                  <button type="button" onClick={() => removeLifestyleRow(idx)} className="btn btn-ghost btn-xs" style={{ color: '#ef4444' }}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Lab Tests */}
        <div className="glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>🔬 Recommended Lab Screenings</h3>
            <button type="button" onClick={addLabRow} className="btn btn-outline btn-xs">➕ Add Screening</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {labList.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="e.g. HbA1c Glycated Hemoglobin, Lipid Panel"
                  className="form-control form-control-sm"
                  value={item.name}
                  onChange={(e) => updateLabRow(idx, 'name', e.target.value)}
                  required
                  style={{ flex: 1.5 }}
                />
                <input 
                  type="text" 
                  placeholder="e.g. fast for 12 hours before test"
                  className="form-control form-control-sm"
                  value={item.instructions}
                  onChange={(e) => updateLabRow(idx, 'instructions', e.target.value)}
                  style={{ flex: 2 }}
                />

                {labList.length > 1 && (
                  <button type="button" onClick={() => removeLabRow(idx)} className="btn btn-ghost btn-xs" style={{ color: '#ef4444' }}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Targets and Boundaries */}
        <div className="glass" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '16px' }}>📈 Clinical Target Boundaries (for Chart warnings)</h3>
          
          <div className="row g-3">
            <div className="col-md-6">
              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>Fasting Blood Sugar (mg/dL)</strong>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" className="form-control form-control-sm" value={targets.target_sugar_fasting_min} onChange={(e) => setTargets({ ...targets, target_sugar_fasting_min: e.target.value })} />
                  <span>to</span>
                  <input type="number" className="form-control form-control-sm" value={targets.target_sugar_fasting_max} onChange={(e) => setTargets({ ...targets, target_sugar_fasting_max: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>Post-meal Blood Sugar (mg/dL)</strong>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" className="form-control form-control-sm" value={targets.target_sugar_post_meal_min} onChange={(e) => setTargets({ ...targets, target_sugar_post_meal_min: e.target.value })} />
                  <span>to</span>
                  <input type="number" className="form-control form-control-sm" value={targets.target_sugar_post_meal_max} onChange={(e) => setTargets({ ...targets, target_sugar_post_meal_max: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>BP Systolic (mmHg)</strong>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" className="form-control form-control-sm" value={targets.target_bp_systolic_min} onChange={(e) => setTargets({ ...targets, target_bp_systolic_min: e.target.value })} />
                  <span>to</span>
                  <input type="number" className="form-control form-control-sm" value={targets.target_bp_systolic_max} onChange={(e) => setTargets({ ...targets, target_bp_systolic_max: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>BP Diastolic (mmHg)</strong>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" className="form-control form-control-sm" value={targets.target_bp_diastolic_min} onChange={(e) => setTargets({ ...targets, target_bp_diastolic_min: e.target.value })} />
                  <span>to</span>
                  <input type="number" className="form-control form-control-sm" value={targets.target_bp_diastolic_max} onChange={(e) => setTargets({ ...targets, target_bp_diastolic_max: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Min SpO2 (%)</strong>
                <input type="number" className="form-control form-control-sm" value={targets.target_spo2_min} onChange={(e) => setTargets({ ...targets, target_spo2_min: e.target.value })} />
              </div>
            </div>

            <div className="col-md-4">
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Body Temp (°F)</strong>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input type="number" step="any" className="form-control form-control-sm" value={targets.target_temp_min} onChange={(e) => setTargets({ ...targets, target_temp_min: e.target.value })} />
                  <span>-</span>
                  <input type="number" step="any" className="form-control form-control-sm" value={targets.target_temp_max} onChange={(e) => setTargets({ ...targets, target_temp_max: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="col-md-4">
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Body Weight (kg)</strong>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input type="number" className="form-control form-control-sm" value={targets.target_weight_min} onChange={(e) => setTargets({ ...targets, target_weight_min: e.target.value })} />
                  <span>-</span>
                  <input type="number" className="form-control form-control-sm" value={targets.target_weight_max} onChange={(e) => setTargets({ ...targets, target_weight_max: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Date and Submit */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', margin: 0 }}>Follow-up Date (Optional):</label>
            <input 
              type="date" 
              className="form-control form-control-sm"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>

          <button 
            type="submit" 
            disabled={submitLoading}
            className="btn btn-primary"
            style={{ padding: '12px 24px', background: '#059669', borderColor: '#059669', fontWeight: 800 }}
          >
            {submitLoading ? 'Saving Plan...' : 'Compile & Save Care Plan'}
          </button>
        </div>

      </form>

      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default CarePlanForm;
