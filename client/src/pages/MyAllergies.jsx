import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MyAllergies = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form inputs
  const [allergyName, setAllergyName] = useState('');
  const [allergyType, setAllergyType] = useState('drug');
  const [severity, setSeverity] = useState('moderate');
  const [notes, setNotes] = useState('');
  const [familyMemberId, setFamilyMemberId] = useState(''); // Empty string is personal

  const [addLoading, setAddLoading] = useState(false);
  const [addMessage, setAddMessage] = useState('');

  // Autocomplete drug matches
  const [drugMatches, setDrugMatches] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  const fetchAllergyData = async () => {
    try {
      const res = await axios.get('/api/my-allergies');
      if (res.data && res.data.ok) {
        setData(res.data);
      } else {
        setError(res.data.error || 'Failed to fetch allergy logs.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error loading allergy configuration profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllergyData();
  }, []);

  const handleAllergyNameChange = (val) => {
    setAllergyName(val);
    if (allergyType === 'drug' && data?.drug_list && val.trim().length > 1) {
      const matches = data.drug_list.filter(d => 
        d.brand_name.toLowerCase().includes(val.toLowerCase()) ||
        d.generic_name.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setDrugMatches(matches);
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleSelectDrug = (drug) => {
    setAllergyName(`${drug.brand_name} (${drug.generic_name})`);
    setShowAutocomplete(false);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!allergyName.trim()) {
      alert('Allergy name cannot be empty.');
      return;
    }

    setAddLoading(true);
    setAddMessage('');
    try {
      const res = await axios.post('/api/my-allergies/add', {
        allergy_name: allergyName,
        family_member_id: familyMemberId || null,
        allergy_type: allergyType,
        severity,
        notes
      });
      if (res.data && res.data.ok) {
        setAddMessage(`🎉 Allergy "${allergyName}" added successfully.`);
        setAllergyName('');
        setNotes('');
        fetchAllergyData();
      } else {
        setAddMessage(`❌ ${res.data.error || 'Failed to add allergy.'}`);
      }
    } catch (err) {
      console.error(err);
      setAddMessage('❌ Server error submitting allergy profile.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteAllergy = async (aid) => {
    if (!window.confirm('Are you sure you want to delete this allergy log?')) return;
    try {
      const res = await axios.post(`/api/my-allergies/delete/${aid}`);
      if (res.data && res.data.ok) {
        fetchAllergyData();
      } else {
        alert(res.data.error || 'Failed to delete allergy.');
      }
    } catch (err) {
      alert('Error updating patient health profile.');
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

  const { allergies = [], family = [], family_allergies = {} } = data || {};

  return (
    <div className="container" style={{ padding: '30px 20px' }}>
      
      {/* Header Block */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(245,158,11,0.06))' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0 }}>Clinical Allergy Profile Manager</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Log sensitivities, drug reactions, and dietary restrictions. These profiles automatically alert practitioners during prescribing to block unsafe drug combinations.</p>
      </div>

      <div className="row g-4">
        {/* Left Side: Allergy Lists */}
        <div className="col-lg-7">
          
          {/* Personal Allergies */}
          <div className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              👤 Personal Allergies & Sensitivities
            </h3>
            {allergies.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No personal allergies registered.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {allergies.map(a => (
                  <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <h5 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>{a.allergy_name}</h5>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
                        <span style={{ 
                          color: a.severity === 'severe' ? '#ef4444' : a.severity === 'moderate' ? '#f59e0b' : '#3b82f6'
                        }}>
                          🚨 {a.severity}
                        </span>
                        <span>· {a.allergy_type}</span>
                      </div>
                      {a.notes && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0', fontStyle: 'italic' }}>"{a.notes}"</p>}
                    </div>
                    <button onClick={() => handleDeleteAllergy(a._id)} className="btn btn-ghost btn-xs" style={{ color: '#ef4444' }}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Family Circle Allergies */}
          {family.map(member => {
            const mAllergies = family_allergies[member._id] || [];
            return (
              <div key={member._id} className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>
                  👨‍👩‍👧 {member.full_name}'s Sensitivities ({member.relationship})
                </h3>
                {mAllergies.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No allergies registered for {member.full_name}.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {mAllergies.map(a => (
                      <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <h5 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>{a.allergy_name}</h5>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
                            <span style={{ 
                              color: a.severity === 'severe' ? '#ef4444' : a.severity === 'moderate' ? '#f59e0b' : '#3b82f6'
                            }}>
                              🚨 {a.severity}
                            </span>
                            <span>· {a.allergy_type}</span>
                          </div>
                          {a.notes && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0', fontStyle: 'italic' }}>"{a.notes}"</p>}
                        </div>
                        <button onClick={() => handleDeleteAllergy(a._id)} className="btn btn-ghost btn-xs" style={{ color: '#ef4444' }}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        </div>

        {/* Right Side: Add Form */}
        <div className="col-lg-5">
          <div className="glass" style={{ padding: '24px', position: 'sticky', top: '20px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '14px' }}>➕ Register Allergy Profile</h3>

            {addMessage && (
              <div className={`alert ${addMessage.includes('successfully') ? 'alert-success' : 'alert-danger'}`} style={{ padding: '10px 14px', fontSize: '0.82rem', marginBottom: '14px' }}>
                {addMessage}
              </div>
            )}

            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Associate Profile</label>
                <select 
                  className="form-control form-control-sm"
                  value={familyMemberId}
                  onChange={(e) => setFamilyMemberId(e.target.value)}
                >
                  <option value="">Personal Profile (Self)</option>
                  {family.map(f => (
                    <option key={f._id} value={f._id}>{f.full_name} ({f.relationship})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Allergy / Sensitivity Category</label>
                <select 
                  className="form-control form-control-sm"
                  value={allergyType}
                  onChange={(e) => {
                    setAllergyType(e.target.value);
                    setShowAutocomplete(false);
                  }}
                >
                  <option value="drug">💊 Drug / Pharmaceutical Agent</option>
                  <option value="food">🥦 Food / Dietary Restricted Item</option>
                  <option value="environmental">🌸 Environmental (Pollen, Dust)</option>
                  <option value="other">🔬 Other / Chemicals / Latex</option>
                </select>
              </div>

              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Allergen Name</label>
                <input 
                  type="text" 
                  placeholder={allergyType === 'drug' ? "Search brand/generic (e.g. Paracetamol)..." : "e.g. Peanuts, Penicillin..."}
                  className="form-control form-control-sm"
                  value={allergyName}
                  onChange={(e) => handleAllergyNameChange(e.target.value)}
                  required
                  autoComplete="off"
                />

                {/* Drug Autocomplete Dropdown */}
                {showAutocomplete && drugMatches.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                    {drugMatches.map(drug => (
                      <button
                        key={drug.id}
                        type="button"
                        onClick={() => handleSelectDrug(drug)}
                        className="btn-link"
                        style={{ padding: '8px 12px', fontSize: '0.78rem', textAlign: 'left', borderBottom: '1px solid #f1f5f9', width: '100%' }}
                      >
                        <strong style={{ color: 'var(--primary)' }}>{drug.brand_name}</strong> — {drug.generic_name} ({drug.dosage_form})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Severity Response</label>
                <select 
                  className="form-control form-control-sm"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                >
                  <option value="mild">Mild (Rashes, Sneezing)</option>
                  <option value="moderate">Moderate (Hives, Mild breathing issue)</option>
                  <option value="severe">Severe (Anaphylaxis, Sudden choking)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Symptoms / Clinical Remarks</label>
                <textarea 
                  rows="2" 
                  className="form-control form-control-sm"
                  placeholder="e.g. experiences swelling in lips and vomiting after consumption"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button 
                type="submit" 
                disabled={addLoading} 
                className="btn btn-primary btn-sm w-100"
                style={{ marginTop: '6px' }}
              >
                {addLoading ? 'Registering...' : 'Add to Allergy Profile'}
              </button>

            </form>
          </div>
        </div>
      </div>

    </div>
  );
};

export default MyAllergies;
