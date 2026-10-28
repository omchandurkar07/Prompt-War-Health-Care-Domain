import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import DoctorAvatar from '../components/DoctorAvatar';

const SYMPTOM_CATEGORIES = {
  '🌡️ General': ['fever','high_fever','mild_fever','chills','sweating','fatigue','weakness','weight_loss','weight_gain','body_ache','malaise','loss_of_appetite','dehydration'],
  '🧠 Head & Neurological': ['headache','severe_headache','dizziness','fainting','confusion','seizures','tremors','numbness','tingling','blurred_vision','sensitivity_to_light'],
  '🫁 Respiratory': ['cough','dry_cough','productive_cough','sneezing','runny_nose','nasal_congestion','shortness_of_breath','wheezing','chest_tightness','rapid_breathing'],
  '❤️ Cardiovascular': ['chest_pain','palpitations','high_blood_pressure','irregular_heartbeat','swollen_legs'],
  '🍽️ Gastrointestinal': ['nausea','vomiting','diarrhea','constipation','stomach_pain','abdominal_cramps','bloating','acidity','heartburn','blood_in_stool','loss_of_taste','excessive_hunger','excessive_thirst'],
  '🧴 Skin': ['skin_rash','itching','redness','dry_skin','pimples','blisters','skin_peeling','dark_patches','swelling','bruising','yellowish_skin'],
  '🦴 Musculoskeletal': ['joint_pain','muscle_pain','back_pain','neck_pain','knee_pain','stiffness','swollen_joints','difficulty_walking','bone_pain'],
  '🚰 Urinary': ['painful_urination','frequent_urination','blood_in_urine','dark_urine','lower_back_pain_kidney'],
  '👁️ Eyes': ['eye_pain','red_eyes','watery_eyes','eye_discharge','vision_problems'],
  '👂 Ear, Nose, Throat': ['sore_throat','difficulty_swallowing','ear_pain','hearing_loss','sinus_pressure','snoring'],
  '🧘 Mental Health': ['anxiety','depression_mood','mood_swings','insomnia_symptom','irritability','panic_attacks','loss_of_interest','difficulty_concentrating'],
  '🔬 Other': ['irregular_periods','excessive_hair_growth','hair_loss','hot_flashes','cold_intolerance','swollen_lymph_nodes','night_sweats','muscle_cramps','excessive_sweating','pale_skin','brittle_nails','mouth_ulcers','bad_breath']
};

const SymptomChecker = () => {
  const { user, role } = useAuth();
  const [allSymptoms, setAllSymptoms] = useState([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCats, setExpandedCats] = useState(new Set());
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'voice'

  // Text/Voice Inputs
  const [symptomTextDesc, setSymptomTextDesc] = useState('');
  const [audioStatus, setAudioStatus] = useState('');
  const [recording, setRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);

  // Triage scan states
  const [scanState, setScanState] = useState('empty'); // 'empty' | 'loading' | 'results' | 'error'
  const [scanError, setScanError] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);
  const [scanResult, setScanResult] = useState(null);
  const [recommendedDocs, setRecommendedDocs] = useState([]);

  const validSymptomIds = useMemo(() => new Set(allSymptoms.map((sym) => sym.id)), [allSymptoms]);

  const normalizeSymptomId = (symptomId) => symptomId.toString().toLowerCase().trim().replace(/\s+/g, '_');

  // Fetch full symptom list
  const fetchSymptomList = async () => {
    try {
      const res = await axios.get('/api/ml-symptoms');
      if (res.data && res.data.symptoms) {
        setAllSymptoms(res.data.symptoms);
      }
    } catch (err) {
      console.error('Failed to load ML symptoms list', err);
    }
  };

  useEffect(() => {
    fetchSymptomList();
    
    // Check if SpeechRecognition is supported
    const SpeechVal = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechVal) {
      const rec = new SpeechVal();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setRecording(true);
        setAudioStatus('🎙️ Speaking... Click button to stop.');
      };
      
      rec.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        const val = finalTranscript || interimTranscript;
        if (val) {
          setSymptomTextDesc(val);
        }
      };

      rec.onerror = (e) => {
        console.error(e);
        setAudioStatus(`❌ Speech Error: ${e.error}`);
        setRecording(false);
      };

      rec.onend = () => {
        setRecording(false);
      };

      setRecognition(rec);
    }
  }, []);

  const handleToggleSymptom = (id) => {
    setSelectedSymptoms(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleRemoveSymptom = (id) => {
    setSelectedSymptoms(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleToggleCategory = (catName) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(catName)) {
        next.delete(catName);
      } else {
        next.add(catName);
      }
      return next;
    });
  };

  // Text parser logic
  const handleExtractSymptoms = async () => {
    if (!symptomTextDesc.trim()) {
      alert('Please type or speak a description of your symptoms first.');
      return;
    }
    setAudioStatus('⏳ Extracting symptoms via NLP classification...');
    try {
      const res = await axios.post('/api/ml-parse-text', { text: symptomTextDesc });
      if (res.data && res.data.symptoms) {
        const extracted = (res.data.symptoms || []).map(normalizeSymptomId).filter((id) => validSymptomIds.has(id));
        if (extracted.length > 0) {
          setSelectedSymptoms(new Set(extracted));
          setAudioStatus(`✅ Extracted ${extracted.length} symptom tags! Switched to Manual list.`);
          
          // Auto switch to manual tab to let user review
          setTimeout(() => {
            setActiveTab('manual');
          }, 1000);
        } else {
          setAudioStatus('⚠️ No matching symptom tags found. Please describe in more detail or check boxes.');
        }
      }
    } catch (err) {
      setAudioStatus('❌ NLP Service is offline or failed.');
    }
  };

  // Audio WAV Uploader
  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAudioStatus('⏳ Transcribing audio file. Please wait...');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/ml-transcribe-audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.text) {
        setSymptomTextDesc(res.data.text);
        setAudioStatus('✅ Transcription complete!');
      } else {
        setAudioStatus(`❌ Error: ${res.data.error || 'Failed transcription.'}`);
      }
    } catch (err) {
      setAudioStatus('❌ Network error transcribing audio file.');
    }
  };

  const handleToggleMic = () => {
    if (!recognition) {
      alert('Speech Recognition is not supported by your browser. Please type or upload a WAV recording.');
      return;
    }
    if (recording) {
      recognition.stop();
    } else {
      setSymptomTextDesc('');
      recognition.start();
    }
  };

  const handleRunTriage = async () => {
    if (selectedSymptoms.size === 0) return;
    setScanError('');
    setScanResult(null);
    setRecommendedDocs([]);
    
    setScanState('loading');
    setLoadingStep(1);
    
    // Simulate progression steps
    setTimeout(() => setLoadingStep(2), 700);
    setTimeout(() => setLoadingStep(3), 1400);

    try {
      const symArray = Array.from(selectedSymptoms).map(normalizeSymptomId);
      const predictRes = await axios.post('/api/ml-predict', { symptoms: symArray });
      
      if (predictRes.data && !predictRes.data.error) {
        setScanResult(predictRes.data);
        
        // Fetch recommended doctors
        const spec = predictRes.data.recommended_specialization || predictRes.data.specialization || 'General Physician';
        const docRes = await axios.get(`/api/doctors?spec=${encodeURIComponent(spec)}`);
        if (docRes.data && docRes.data.doctors_data) {
          setRecommendedDocs(docRes.data.doctors_data.map(d => d.doc));
        }
        
        setTimeout(() => {
          setScanState('results');
        }, 2000);
      } else {
        setScanError(predictRes.data.error || 'Failed to analyze symptoms.');
        setScanState('error');
      }
    } catch (err) {
      console.error(err);
      setScanError(err.response?.data?.error || 'ML helper service is offline or unreachable.');
      setScanState('error');
    }
  };

  // Checkbox categories filtering
  const getFilteredCategories = () => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return SYMPTOM_CATEGORIES;

    const filtered = {};
    Object.entries(SYMPTOM_CATEGORIES).forEach(([catName, list]) => {
      const matches = list.filter(id => {
        const item = allSymptoms.find(s => s.id === id);
        const displayName = item ? item.name : id.replace(/_/g, ' ');
        return displayName.toLowerCase().includes(query);
      });
      if (matches.length > 0) {
        filtered[catName] = matches;
      }
    });
    return filtered;
  };

  const filteredCategories = getFilteredCategories();

  const selectedSymptomsList = useMemo(() => {
    return Array.from(selectedSymptoms).map(id => {
      const item = allSymptoms.find(s => s.id === id);
      return item ? item.name : id.replace(/_/g, ' ');
    });
  }, [selectedSymptoms, allSymptoms]);

  return (
    <div className="container" style={{ padding: '30px 20px' }}>
      
      {/* AI Doctor Header */}
      <div className="ai-doctor-video-hero">
        <div className="ai-doctor-hero-overlay"></div>
        
        <div className="ai-doctor-hero-content">
          <span className="ai-doctor-hero-tag-centered">
            <i className="fa-solid fa-robot"></i> Intelligent Health Assistant
          </span>
          
          <h1 className="ai-doctor-hero-title">
            AI <span className="ai-doctor-hero-title-accent">Doctor</span>
          </h1>
          
          <p className="ai-doctor-hero-desc">
            Select your symptoms to receive an instant, secure AI-powered health assessment and discover appropriate doctor specialists.
          </p>
          
          <div className="ai-doctor-hero-cards-grid">
            <div className="ai-doctor-trust-card">
              <div className="ai-doctor-trust-icon-box">
                <i className="fa-solid fa-shield-halved" style={{ color: '#3b82f6' }}></i>
              </div>
              <div>
                <h4 className="ai-doctor-trust-title">Secure & Private</h4>
                <p className="ai-doctor-trust-subtitle">HIPAA compliance standard</p>
              </div>
            </div>

            <div className="ai-doctor-trust-card">
              <div className="ai-doctor-trust-icon-box">
                <i className="fa-solid fa-bolt" style={{ color: '#f59e0b' }}></i>
              </div>
              <div>
                <h4 className="ai-doctor-trust-title">Instant Insights</h4>
                <p className="ai-doctor-trust-subtitle">Scan completes in seconds</p>
              </div>
            </div>

            <div className="ai-doctor-trust-card">
              <div className="ai-doctor-trust-icon-box">
                <i className="fa-solid fa-brain" style={{ color: '#ec4899' }}></i>
              </div>
              <div>
                <h4 className="ai-doctor-trust-title">Smart Match</h4>
                <p className="ai-doctor-trust-subtitle">Appropriate specialties</p>
              </div>
            </div>

            <div className="ai-doctor-trust-card">
              <div className="ai-doctor-trust-icon-box">
                <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i>
              </div>
              <div>
                <h4 className="ai-doctor-trust-title">Trusted Analysis</h4>
                <p className="ai-doctor-trust-subtitle">Validated triage matches</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        
        {/* Input Panel */}
        <div className="col-lg-5">
          <div className="glass" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '4px' }}>🔍 AI Symptom Input</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '18px' }}>Select symptoms manually or describe them in text/voice</p>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '6px', marginBottom: '16px' }}>
              <button 
                onClick={() => setActiveTab('manual')} 
                className="btn-link"
                style={{ flex: 1, padding: '10px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', borderBottom: activeTab === 'manual' ? '2.5px solid var(--primary)' : 'none', color: activeTab === 'manual' ? 'var(--primary)' : 'var(--text-muted)' }}
              >
                📋 Manual Checks
              </button>
              <button 
                onClick={() => setActiveTab('voice')} 
                className="btn-link"
                style={{ flex: 1, padding: '10px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', borderBottom: activeTab === 'voice' ? '2.5px solid var(--primary)' : 'none', color: activeTab === 'voice' ? 'var(--primary)' : 'var(--text-muted)' }}
              >
                🎙️ Describe (Voice/Text)
              </button>
            </div>

            {/* Tab: Manual */}
            {activeTab === 'manual' && (
              <div>
                <input 
                  type="text"
                  placeholder="Search symptoms (e.g. fever, cough)..."
                  className="form-control form-control-sm mb-3"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                {/* Selected Chips */}
                <div className="ml-chips-container">
                  {selectedSymptoms.size === 0 ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No symptoms selected yet.</span>
                  ) : (
                    Array.from(selectedSymptoms).map(id => {
                      const item = allSymptoms.find(s => s.id === id);
                      return (
                        <span key={id} className="ml-chip">
                          {item ? item.name : id.replace(/_/g, ' ')}
                          <button onClick={() => handleRemoveSymptom(id)} className="ml-chip-remove">✕</button>
                        </span>
                      );
                    })
                  )}
                  {selectedSymptoms.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSymptoms(new Set())}
                      className="btn btn-outline btn-sm"
                      style={{ marginLeft: 'auto', height: '32px', fontWeight: 700 }}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Categories Accordion */}
                <div className="ml-categories" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {Object.entries(filteredCategories).map(([catName, list]) => {
                    const isExpanded = expandedCats.has(catName) || searchQuery.length > 1;
                    return (
                      <div key={catName} style={{ marginBottom: '8px' }}>
                        <div 
                          onClick={() => handleToggleCategory(catName)}
                          role="button"
                          tabIndex={0}
                          className="ml-category-header"
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggleCategory(catName); } }}
                        >
                          <span>{catName}</span>
                          <span>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                        
                        {isExpanded && (
                          <div className="ml-category-body open" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '8px 4px' }}>
                            {list.map(id => {
                              const s = allSymptoms.find(item => item.id === id);
                              const isChecked = selectedSymptoms.has(id);
                              return (
                                <label key={id} className="ml-symptom-item" style={{ margin: 0 }}>
                                  <input 
                                    type="checkbox" 
                                    checked={isChecked}
                                    onChange={() => handleToggleSymptom(id)}
                                  />
                                  <span className="ml-symptom-check"></span>
                                  <span className="ml-symptom-name">
                                    {s ? s.name : id.replace(/_/g, ' ')}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {Object.keys(filteredCategories).length === 0 && (
                  <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No symptom categories match your search. Try a different keyword like <strong>fever</strong>, <strong>cough</strong>, or <strong>headache</strong>.
                  </div>
                )}
              </div>
            )}

            {/* Tab: Voice/Text */}
            {activeTab === 'voice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Describe in your own words</label>
                  <textarea 
                    className="form-control"
                    rows="4"
                    placeholder="e.g. I have had a severe throbbing headache and felt nauseous since morning, also feeling slight fever..."
                    value={symptomTextDesc}
                    onChange={(e) => setSymptomTextDesc(e.target.value)}
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={handleToggleMic} 
                    className={`btn ${recording ? 'btn-danger' : 'btn-outline'} btn-sm`}
                    style={{ flex: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    🎙️ {recording ? 'Listening...' : 'Speak Symptoms'}
                  </button>
                  
                  <button 
                    onClick={() => document.getElementById('wavUpload').click()}
                    className="btn btn-outline btn-sm"
                    style={{ flex: 1 }}
                  >
                    📁 Upload WAV
                  </button>
                  <input 
                    type="file" 
                    id="wavUpload" 
                    accept=".wav"
                    onChange={handleAudioUpload}
                    style={{ display: 'none' }}
                  />
                </div>

                {audioStatus && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                    {audioStatus}
                  </div>
                )}

                <button 
                  onClick={handleExtractSymptoms} 
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: '#6366f1', color: '#4f46e5', fontWeight: 700 }}
                >
                  ✨ Auto-Extract Symptoms via NLP
                </button>
              </div>
            )}

            {/* Trigger Button */}
            <button 
              onClick={handleRunTriage}
              disabled={selectedSymptoms.size === 0}
              className="btn btn-primary btn-full"
              style={{ marginTop: '20px', padding: '12px', fontSize: '0.9rem', fontWeight: 700 }}
            >
              🩺 Conduct AI Health Triage ({selectedSymptoms.size} Selected)
            </button>
            {selectedSymptoms.size > 0 && (
              <div style={{ marginTop: '12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Tip: Use the Auto-Extract tool to fill symptoms from plain language and then review the selected options above.
              </div>
            )}

          </div>
        </div>

        {/* Results Panel */}
        <div className="col-lg-7">
          
          {/* State: Empty */}
          {scanState === 'empty' && (
            <div className="glass" style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '440px', background: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: '24px' }}>
              <span style={{ fontSize: '3.5rem', marginBottom: '8px' }}>🩺</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>Begin Your AI Health Assessment</h3>
              <p style={{ fontSize: '0.85rem', maxWidth: '320px', lineHeight: 1.5, margin: 0, color: '#64748b' }}>Please select your active clinical symptoms on the left to begin your AI triage and specialist routing.</p>
            </div>
          )}

          {/* State: Loading */}
          {scanState === 'loading' && (
            <div className="glass" style={{ textAlign: 'center', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '440px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '50%', animation: 'bounce 0.6s infinite alternate' }}></div>
                <div style={{ width: '12px', height: '12px', background: '#6366f1', borderRadius: '50%', animation: 'bounce 0.6s infinite alternate 0.2s' }}></div>
                <div style={{ width: '12px', height: '12px', background: '#ec4899', borderRadius: '50%', animation: 'bounce 0.6s infinite alternate 0.4s' }}></div>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Analyzing Symptom Indicators...</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Mapping patterns with medical classifications model</p>
              
              <div style={{ width: '100%', maxWidth: '240px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: loadingStep >= 1 ? '#10b981' : '#94a3b8' }}>
                  {loadingStep >= 1 ? '✔' : '⏳'} Encoding symptom vectors
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: loadingStep >= 2 ? '#10b981' : '#94a3b8' }}>
                  {loadingStep >= 2 ? '✔' : '⏳'} Evaluating clinical thresholds
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: loadingStep >= 3 ? '#10b981' : '#94a3b8' }}>
                  {loadingStep >= 3 ? '✔' : '⏳'} Calculating differential specialists
                </div>
              </div>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes bounce {
                  to { transform: translateY(-12px); }
                }
              `}} />
            </div>
          )}

          {/* State: Error */}
          {scanState === 'error' && (
            <div className="glass" style={{ textAlign: 'center', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '440px' }}>
              <span style={{ fontSize: '2.5rem' }}>❌</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '16px' }}>Scan Failed</h3>
              <p style={{ fontSize: '0.85rem', color: '#ef4444', maxWidth: '300px', marginTop: '4px' }}>{scanError}</p>
              <button onClick={() => setScanState('empty')} className="btn btn-outline btn-sm" style={{ marginTop: '16px' }}>Reset</button>
            </div>
          )}

          {/* State: Results */}
          {scanState === 'results' && scanResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Emergency Warning */}
              {scanResult.is_emergency && (
                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '16px', borderRadius: '12px', color: '#991b1b' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>🚨 Urgent Medical Evaluation Recommended</h4>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', lineHeight: 1.4 }}>
                    Your primary matches indicate a condition (<strong>{scanResult.disease}</strong>) which could require immediate clinical checkups. Please seek emergency care or immediate specialist assistance.
                  </p>
                </div>
              )}

              {/* Triage summary card */}
              <div className="glass" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: 800, 
                    textTransform: 'uppercase', 
                    padding: '3px 8px', 
                    borderRadius: '6px', 
                    background: scanResult.risk_level === 'High' ? '#fef2f2' : scanResult.risk_level === 'Medium' ? '#fffbeb' : '#f0fdf4',
                    color: scanResult.risk_level === 'High' ? '#ef4444' : scanResult.risk_level === 'Medium' ? '#f59e0b' : '#10b981'
                  }}>
                    {scanResult.risk_level} Risk Triage
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Triage Analytics</span>
                </div>

                <h2 style={{ fontSize: '1.75rem', fontWeight: 850, margin: 0 }}>{scanResult.disease}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Primary Specialty Referral: <strong style={{ color: 'var(--text)' }}>{scanResult.recommended_specialization}</strong>
                </p>

                {/* Confidence Meter */}
                <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>ML Correlation Index</span>
                    <strong>{scanResult.confidence}%</strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#cbd5e1', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${scanResult.confidence}%`, height: '100%', background: 'var(--primary)' }}></div>
                  </div>
                </div>

                {/* Differential Matches */}
                {scanResult.all_predictions && scanResult.all_predictions.length > 1 && (
                  <div style={{ marginTop: '18px' }}>
                    <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>Differential Possibilities</h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {scanResult.all_predictions.map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                          <span style={{ fontWeight: 600 }}>{p.disease} <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.72rem' }}>({p.specialization})</span></span>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.probability}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Doctors referral cards */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '12px' }}>👨‍⚕️ Available Specialist Referrals ({scanResult.recommended_specialization}s)</h3>
                
                {recommendedDocs.length === 0 ? (
                  <div className="glass" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No matching {scanResult.recommended_specialization}s found locally. <Link to="/doctors" style={{ color: 'var(--primary)', fontWeight: 600 }}>Browse all practitioners ➡️</Link>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {recommendedDocs.map(doc => (
                      <div key={doc._id} className="glass" style={{ padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                            <DoctorAvatar
                              src={doc.profile_image}
                              alt={doc.full_name || 'Doctor'}
                              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            <div>
                              <h5 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0 }}>Dr. {doc.full_name}</h5>
                              <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>{doc.specialization}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', margin: '4px 0' }}>🏥 {doc.hospital_name}</span>
                          <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span>⭐ {Number(doc.rating_avg || 0).toFixed(1)}</span>
                            <span>💼 {doc.experience_years} yrs exp</span>
                            <span>₹{doc.consultation_fee}</span>
                          </div>
                        </div>

                        <Link
                          to={
                            scanResult.recommended_specialization
                              ? `/doctors?spec=${encodeURIComponent(scanResult.recommended_specialization)}`
                              : '/doctors'
                          }
                          className="btn btn-primary btn-xs w-100"
                          style={{ marginTop: '10px', padding: '6px', textAlign: 'center' }}
                        >
                          📅 Book Appointment
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={() => setScanState('empty')} className="btn btn-outline btn-full" style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 700 }}>
                🔄 Restart Diagnosis
              </button>

            </div>
          )}

        </div>

      </div>

      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default SymptomChecker;
