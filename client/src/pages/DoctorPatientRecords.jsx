import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';

const DoctorPatientRecords = () => {
  const { pid } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Upload Record Form State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('Lab Report');
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [familyMemberId, setFamilyMemberId] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const fetchRecords = async () => {
    try {
      const res = await axios.get(`/api/doctor/patient/${pid}/records`);
      if (res.data && res.data.ok) {
        setData(res.data);
        if (res.data.doctor) {
          setDoctorName(`Dr. ${res.data.doctor.full_name}`);
        }
      } else {
        setError(res.data.error || 'Failed to load patient records.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'You are not authorized to view this patient\'s records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [pid]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Title is required.');
      return;
    }
    if (!selectedFile) {
      alert('Please attach a file.');
      return;
    }

    setUploadLoading(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('doc_type', docType);
    formData.append('record_date', recordDate);
    formData.append('family_member_id', familyMemberId);
    formData.append('doctor_name', doctorName);
    formData.append('description', description);
    formData.append('tags', tags);
    formData.append('file', selectedFile);

    try {
      const res = await axios.post(`/api/doctor/patient/${pid}/records`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data && res.data.ok) {
        alert('Medical record stored successfully!');
        setShowUploadModal(false);
        // Clear inputs
        setTitle('');
        setDocType('Lab Report');
        setRecordDate(new Date().toISOString().split('T')[0]);
        setFamilyMemberId('');
        setDescription('');
        setTags('');
        setSelectedFile(null);
        // Reload list
        fetchRecords();
      } else {
        alert(res.data.error || 'Failed to upload record.');
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Server error uploading record.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteRecord = async (rid) => {
    if (!window.confirm('Are you sure you want to delete this medical record? This cannot be undone.')) return;
    try {
      const res = await axios.post(`/api/doctor/patient/${pid}/records/delete/${rid}`);
      if (res.data && res.data.ok) {
        alert('Record deleted successfully.');
        fetchRecords();
      } else {
        alert(res.data.error || 'Failed to delete record.');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting record.');
    }
  };

  const getCleanType = (type) => {
    return (type || '').toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Prescription': return '📋';
      case 'Blood Test': return '🩸';
      case 'X-Ray': return '🦴';
      case 'MRI':
      case 'CT Scan': return '🧲';
      case 'Ultrasound': return '🌊';
      case 'Discharge Summary': return '🏥';
      case 'Vaccination Record': return '💉';
      case 'Lab Report': return '🔬';
      case 'Doctor Notes': return '🩺';
      default: return '📄';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f4f6', borderTop: '4px solid #059669', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '40px 20px', maxWidth: '800px' }}>
        <div className="alert alert-danger">❌ &nbsp;{error}</div>
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/doctor/patients" className="btn btn-outline">← Back to Patient Registry</Link>
        </div>
      </div>
    );
  }

  const { patient, records = [], family = [], doc_types = [] } = data || {};

  return (
    <>
      <section className="section" style={{ padding: '20px 0' }}>
        <div className="container" style={{ maxWidth: '1100px' }}>
          
          {/* Breadcrumbs */}
          <div style={{ marginBottom: '16px' }}>
            <Link to="/doctor/patients" style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
              ← Back to Patient Registry
            </Link>
          </div>

          {/* Header Banner */}
          <div className="records-hero" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)', color: 'white', padding: '28px', borderRadius: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>📂 Patient Medical Locker</h1>
              <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>Digital health timeline and records management for <strong>{patient?.full_name}</strong></p>
            </div>
            <button className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981', color: 'white' }} onClick={() => setShowUploadModal(true)}>
              📤 Upload Medical Record
            </button>
          </div>

          {/* Patient Summary Card */}
          <div className="patient-summary-card card" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', borderRadius: '16px' }}>
            <div className="patient-summary-avatar" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', color: '#047857', display: 'flex', alignItems: 'center', justifycontent: 'center', fontSize: '1.3rem', fontWeight: 800, justifyContent: 'center' }}>
              {patient?.full_name ? patient.full_name.slice(0, 2).toUpperCase() : 'PA'}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)' }}>{patient?.full_name}</h3>
              <div className="patient-summary-details" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                <div className="patient-summary-item" style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}><strong style={{ color: 'var(--text-muted)' }}>Gender:</strong> {patient?.gender || 'N/A'}</div>
                <div className="patient-summary-item" style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}><strong style={{ color: 'var(--text-muted)' }}>Blood Group:</strong> <span style={{ fontWeight: 700, color: '#991b1b' }}>{patient?.blood_group || 'N/A'}</span></div>
                <div className="patient-summary-item" style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}><strong style={{ color: 'var(--text-muted)' }}>DOB:</strong> {patient?.dob || 'N/A'}</div>
                <div className="patient-summary-item" style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}><strong style={{ color: 'var(--text-muted)' }}>Emergency Contact:</strong> {patient?.emergency_contact || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="records-layout" style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '24px', alignItems: 'start' }}>
            
            {/* Timeline Center */}
            <div className="timeline-container card" style={{ padding: '24px', borderRadius: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text)', marginBottom: '20px', borderBottom: '2px solid var(--border)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🕒 Health Timeline Records</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>Showing {records.length} record(s)</span>
              </div>

              {/* Document Types Legend */}
              <div className="doc-types-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                <span className="doc-legend-badge" style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '12px', background: '#f3f4f6', color: '#4b5563', fontWeight: 600, borderLeft: '3px solid #4f46e5' }}>📋 Prescription</span>
                <span className="doc-legend-badge" style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '12px', background: '#f3f4f6', color: '#4b5563', fontWeight: 600, borderLeft: '3px solid #ef4444' }}>🩸 Blood Test</span>
                <span className="doc-legend-badge" style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '12px', background: '#f3f4f6', color: '#4b5563', fontWeight: 600, borderLeft: '3px solid #d97706' }}>🦴 X-Ray</span>
                <span className="doc-legend-badge" style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '12px', background: '#f3f4f6', color: '#4b5563', fontWeight: 600, borderLeft: '3px solid #7c3aed' }}>🧲 MRI/CT</span>
                <span className="doc-legend-badge" style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '12px', background: '#f3f4f6', color: '#4b5563', fontWeight: 600, borderLeft: '3px solid #10b981' }}>💉 Vaccination</span>
                <span className="doc-legend-badge" style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '12px', background: '#f3f4f6', color: '#4b5563', fontWeight: 600, borderLeft: '3px solid #16a34a' }}>🔬 Lab Report</span>
                <span className="doc-legend-badge" style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '12px', background: '#f3f4f6', color: '#4b5563', fontWeight: 600, borderLeft: '3px solid #ea580c' }}>🩺 Doc Notes</span>
              </div>

              {records.length > 0 ? (
                <div className="timeline" style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
                  {records.map(r => (
                    <div key={r._id} className="timeline-item" style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                      <div className={`timeline-dot ${getCleanType(r.doc_type)}`} style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        flexShrink: 0,
                        border: '1px solid var(--border)'
                      }}>
                        {getTypeIcon(r.doc_type)}
                      </div>
                      
                      <div className="timeline-content glass" style={{ flex: 1, padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>{r.title}</h4>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                              <span className="status-badge" style={{ background: '#f3f4f6', color: '#4b5563', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px' }}>{r.doc_type}</span>
                              {r.family_member_id && (
                                <span className="status-badge" style={{ background: '#fef2f2', color: '#b91c1c', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px' }}>Family Member</span>
                              )}
                            </div>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            {r.record_date || new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {r.doctor_name && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '8px 0 4px' }}>
                            🩺 Uploaded by: <strong>{r.doctor_name}</strong>
                          </p>
                        )}
                        
                        {r.description && (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: '8px 0 0', lineHeight: 1.4 }}>{r.description}</p>
                        )}
                        
                        {r.tags && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                            {r.tags.split(',').map((tag, tagIdx) => (
                              <span key={tagIdx} style={{ background: '#f1f5f9', color: '#334155', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 500 }}>
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {r.file_path ? (
                            <a href={r.file_path} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-xs" style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
                              View / Download File
                            </a>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No file attachment</span>
                          )}
                          
                          <button 
                            onClick={() => handleDeleteRecord(r._id)}
                            className="btn btn-ghost btn-sm" 
                            style={{ color: 'var(--danger)', padding: '4px 8px' }} 
                            title="Delete Record"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📂</div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 6px' }}>No records in medical locker</h3>
                  <p style={{ fontSize: '0.85rem' }}>There are no medical timeline records recorded for this patient.</p>
                  <button className="btn btn-primary btn-sm" style={{ background: '#059669', borderColor: '#059669', marginTop: '10px' }} onClick={() => setShowUploadModal(true)}>
                    Upload First Record
                  </button>
                </div>
              )}
            </div>

            {/* Side Panel */}
            <div className="side-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.4)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🟢 Medical Locker Guide
                </h4>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: '1.45', margin: 0 }}>
                  Storing records here securely pushes them to the patient's <strong>Smart Health Locker</strong>. Patients will receive dashboard notifications detailing the report uploads.
                </p>
                <ul style={{ fontSize: '0.74rem', color: 'var(--text-light)', paddingLeft: '16px', margin: '10px 0 0 0', lineHeight: '1.45' }}>
                  <li>Upload clinic visit reports, MRI, blood screenings, or vaccination files.</li>
                  <li>Supported formats: JPG, PNG, WEBP, PDF.</li>
                  <li>Assigned tags aid patient classification.</li>
                </ul>
              </div>

              <div className="glass" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.4)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)' }}>
                  ⚠️ Patient Health Summary
                </h4>
                <div style={{ fontSize: '0.78rem', borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '8px' }}>
                  <strong>Chronic Conditions:</strong>
                  <p style={{ margin: '4px 0 10px 0', color: 'var(--text-light)' }}>
                    {patient?.chronic_conditions || 'None declared'}
                  </p>
                  
                  <strong>Allergies &amp; Alerts:</strong>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--text-light)' }}>
                    {patient?.allergies || 'None registered'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Upload Modal Overlay */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowUploadModal(false); }}>
          
          <div className="modal-card card glass" style={{ maxWidth: '550px', width: '90%', padding: '28px', borderRadius: '16px', background: '#fff', textAlign: 'left', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)' }}>📤 Upload Patient Medical Record</h3>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: '1.1rem', color: 'var(--text-light)' }} onClick={() => setShowUploadModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleUploadSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Document Title *</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required 
                  className="form-input" 
                  placeholder="e.g., Blood Screening Report - June 2026"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Document Type</label>
                  <select 
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                  >
                    {doc_types.map((t, idx) => (
                      <option key={idx} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Date of Record</label>
                  <input 
                    type="date" 
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>For Family Member</label>
                  <select 
                    value={familyMemberId}
                    onChange={(e) => setFamilyMemberId(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                  >
                    <option value="">Patient (Self)</option>
                    {family.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.relation})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Doctor / Hospital Name</label>
                  <input 
                    type="text" 
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="form-input" 
                    placeholder="Defaults to current doctor"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Record Description / Diagnostic Notes</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="form-input" 
                  rows="3" 
                  placeholder="Brief diagnostics note, critical outcomes, or advice..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>
              
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Tags (comma separated)</label>
                <input 
                  type="text" 
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="form-input" 
                  placeholder="e.g., lab, biochemistry, blood-sugar"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>
              
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Attach File Document *</label>
                <input 
                  type="file" 
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.webp" 
                  className="form-input" 
                  required
                  style={{ width: '100%', padding: '8px' }}
                />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Supported file types: PDF, JPG, PNG, WEBP. Max size: 16MB.</span>
              </div>
              
              <button 
                type="submit" 
                disabled={uploadLoading}
                className="btn btn-primary btn-lg btn-full" 
                style={{ background: '#059669', borderColor: '#059669', color: '#fff', marginTop: '10px' }}
              >
                {uploadLoading ? 'Uploading...' : 'Save to Patient Health Locker'}
              </button>
            </form>
          </div>
          
        </div>
      )}
    </>
  );
};

export default DoctorPatientRecords;
