import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const HealthLocker = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtering
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Upload Modal State
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    doc_type: 'Lab Report',
    record_date: new Date().toISOString().split('T')[0],
    description: '',
    appointment_id: '',
    family_member_id: '',
    doctor_name: '',
    tags: ''
  });
  const [file, setFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  // Sharing State
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [expiryType, setExpiryType] = useState('24');
  const [customExpiry, setCustomExpiry] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [shareExpires, setShareExpires] = useState('');
  const [shareLoading, setShareLoading] = useState(false);

  const fetchLockerData = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({
        member: selectedMember,
        type: selectedType,
        q: submittedSearch,
        from: dateFrom,
        to: dateTo
      });
      const res = await axios.get(`/api/health-locker?${params.toString()}`);
      if (res.data && res.data.ok) {
        setData(res.data);
      } else {
        setError(res.data.error || 'Failed to fetch medical records.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error fetching Health Locker records.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedMember, selectedType, submittedSearch]);

  useEffect(() => {
    fetchLockerData();
  }, [fetchLockerData]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSubmittedSearch(search.trim());
  };

  const handleClearFilters = () => {
    setSearch('');
    setSubmittedSearch('');
    setSelectedMember('');
    setSelectedType('');
    setDateFrom('');
    setDateTo('');
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Please attach a medical report file (PDF, Image, etc.)');
      return;
    }

    setUploadLoading(true);
    setUploadMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', uploadForm.title);
    formData.append('doc_type', uploadForm.doc_type);
    formData.append('record_date', uploadForm.record_date);
    formData.append('description', uploadForm.description);
    formData.append('appointment_id', uploadForm.appointment_id);
    formData.append('family_member_id', uploadForm.family_member_id);
    formData.append('doctor_name', uploadForm.doctor_name);
    formData.append('tags', uploadForm.tags);

    try {
      const res = await axios.post('/api/health-locker/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.ok) {
        setUploadMessage('🎉 Record uploaded successfully!');
        setFile(null);
        setUploadForm({
          title: '',
          doc_type: 'Lab Report',
          record_date: new Date().toISOString().split('T')[0],
          description: '',
          appointment_id: '',
          family_member_id: '',
          doctor_name: '',
          tags: ''
        });
        setTimeout(() => {
          setShowUpload(false);
          setUploadMessage('');
          fetchLockerData();
        }, 1500);
      } else {
        setUploadMessage(`❌ ${res.data.error || 'Upload failed.'}`);
      }
    } catch (err) {
      console.error(err);
      setUploadMessage('❌ Error uploading medical file.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteRecord = async (recId) => {
    if (!window.confirm('Are you sure you want to delete this record permanentally?')) return;
    try {
      const res = await axios.post(`/api/health-locker/delete/${recId}`);
      if (res.data && res.data.ok) {
        // Clear from selected lists
        setSelectedRecords(prev => prev.filter(id => id !== recId));
        fetchLockerData();
      } else {
        alert(res.data.error || 'Failed to delete record.');
      }
    } catch (err) {
      alert('Error connecting to medical files controller.');
    }
  };

  const handleSelectRecord = (recId) => {
    setSelectedRecords(prev => {
      if (prev.includes(recId)) {
        return prev.filter(id => id !== recId);
      } else {
        return [...prev, recId];
      }
    });
  };

  const handleGenerateShareLink = async () => {
    if (selectedRecords.length === 0) return;
    setShareLoading(true);
    setShareLink('');
    try {
      const res = await axios.post('/api/health-locker/share', {
        record_ids: selectedRecords,
        expiry_type: expiryType,
        custom_expiry: customExpiry
      });
      if (res.data && res.data.ok) {
        setShareLink(res.data.link);
        setShareExpires(res.data.expires);
      } else {
        alert(res.data.error || 'Failed to generate share link.');
      }
    } catch (err) {
      alert('Error creating secure medical share token.');
    } finally {
      setShareLoading(false);
    }
  };

  const getDocTypeIcon = (type) => {
    switch (type) {
      case 'Prescription': return '📄';
      case 'Blood Test': return '🩸';
      case 'X-Ray':
      case 'MRI':
      case 'CT Scan': return '💀';
      case 'Ultrasound': return '🌊';
      case 'Vaccination Record': return '💉';
      case 'Lab Report': return '🔬';
      default: return '📁';
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert('📋 Link copied to clipboard!');
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #dbeafe', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
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

  const { records = [], family = [], appointments = [], doc_types = [] } = data || {};
  const hasFilters = Boolean(submittedSearch || selectedMember || selectedType || dateFrom || dateTo);

  return (
    <div className="container" style={{ padding: '30px 20px' }}>
      
      {/* Title Header */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(37,99,235,0.06))' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0 }}>Smart Health Locker</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Secure, encrypted repository for prescriptions, scan reports, and clinic summaries.</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn btn-primary btn-sm">
          📤 Upload Document
        </button>
      </div>

      <div className="row g-4">
        {/* Main Content: Records list and Filters */}
        <div className={selectedRecords.length > 0 ? 'col-lg-8' : 'col-lg-12'} style={{ transition: 'all 0.3s ease' }}>
          
          {/* Filters Bar */}
          <div className="glass" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '260px' }}>
              <input 
                type="text" 
                placeholder="Search by report name, tags, doctors..."
                className="form-control form-control-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="btn btn-outline btn-sm">Search</button>
            </form>

            <select 
              className="form-control form-control-sm" 
              style={{ width: 'auto', minWidth: '150px' }}
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
            >
              <option value="">Personal Records</option>
              {family.map(f => (
                <option key={f._id} value={f._id}>{f.full_name} ({f.relationship})</option>
              ))}
            </select>

            <select 
              className="form-control form-control-sm" 
              style={{ width: 'auto', minWidth: '150px' }}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">All Document Types</option>
              {doc_types.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                From
                <input
                  type="date"
                  aria-label="Filter records from date"
                  className="form-control form-control-sm"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                To
                <input
                  type="date"
                  aria-label="Filter records through date"
                  className="form-control form-control-sm"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
            </div>
            {hasFilters && (
              <button type="button" onClick={handleClearFilters} className="btn btn-ghost btn-sm">
                Clear filters
              </button>
            )}
          </div>

          {/* Records Grid */}
          {records.length === 0 ? (
            <div className="glass" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '3rem' }}>📁</span>
              <h3 style={{ fontSize: '1.25rem', marginTop: '16px' }}>{hasFilters ? 'No matching records' : 'Locker is Empty'}</h3>
              <p style={{ fontSize: '0.9rem' }}>
                {hasFilters
                  ? 'Try adjusting or clearing your filters.'
                  : 'Upload medical documents to securely store them and share access links with doctors.'}
              </p>
            </div>
          ) : (
            <div className="timeline-container" style={{ position: 'relative', paddingLeft: '32px', borderLeft: '3px solid #3b82f6', margin: '20px 0 20px 15px' }}>
              {records.map(rec => {
                const isSelected = selectedRecords.includes(rec.id);
                return (
                  <div key={rec.id} className="timeline-item" style={{ position: 'relative', marginBottom: '24px' }}>
                    
                    {/* Circle Node Dot on timeline line */}
                    <div style={{
                      position: 'absolute',
                      left: '-43px',
                      top: '12px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#3b82f6',
                      border: '4px solid #ffffff',
                      boxShadow: '0 0 0 3px #bfdbfe'
                    }}></div>

                    {/* Node Card Content (Horizontal) */}
                    <div className="glass" style={{ padding: '20px', border: isSelected ? '2.5px solid var(--primary)' : '1px solid #e2e8f0', background: 'white', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                      
                      {/* Left: Info */}
                      <div style={{ flex: 1, minWidth: '250px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.25rem' }}>{getDocTypeIcon(rec.doc_type)}</span>
                          <div>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#1e293b' }}>{rec.title}</h4>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{rec.doc_type}</span>
                          </div>
                        </div>
                        {rec.description && (
                          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '8px 0 0', lineHeight: 1.4 }}>
                            {rec.description}
                          </p>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' }}>
                          {rec.doctor_name && <span style={{ fontSize: '0.68rem', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>🩺 Dr. {rec.doctor_name}</span>}
                          {rec.tags && rec.tags.split(',').map((tag, idx) => (
                            <span key={idx} style={{ fontSize: '0.68rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px' }}>#{tag.trim()}</span>
                          ))}
                        </div>
                      </div>

                      {/* Right: Actions and Date */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', minWidth: '150px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>📅 {rec.record_date}</span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* View/Download link */}
                          {rec.file_path ? (
                            <a 
                              href={rec.file_path} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="btn btn-outline btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600, padding: '6px 12px', border: '1.5px solid #cbd5e1', color: '#475569', borderRadius: '10px' }}
                            >
                              View/Download
                            </a>
                          ) : rec.rx_db_id ? (
                            <Link 
                              to={`/prescriptions/${rec.rx_db_id}`} 
                              className="btn btn-outline btn-sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600, padding: '6px 12px', border: '1.5px solid #cbd5e1', color: '#475569', borderRadius: '10px' }}
                            >
                              View/Download
                            </Link>
                          ) : null}

                          {/* Select Checkbox */}
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#475569', cursor: 'pointer', margin: 0 }}>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => handleSelectRecord(rec.id)}
                              style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                            />
                            Select to share
                          </label>

                          {/* Delete Trash Button */}
                          <button 
                            onClick={() => handleDeleteRecord(rec.id)} 
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                            title="Delete Record"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Shared link builder */}
        {selectedRecords.length > 0 && (
          <div className="col-lg-4">
            <div className="glass" style={{ padding: '20px', position: 'sticky', top: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '12px' }}>🔗 Secure Link Sharing</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                You have selected <strong>{selectedRecords.length} document(s)</strong>. Generate a temporary encrypted access link to share with clinics or family.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Expiration Timer</label>
                  <select 
                    className="form-control form-control-sm"
                    value={expiryType}
                    onChange={(e) => setExpiryType(e.target.value)}
                  >
                    <option value="1">1 Hour</option>
                    <option value="4">4 Hours</option>
                    <option value="12">12 Hours</option>
                    <option value="24">24 Hours</option>
                    <option value="168">7 Days</option>
                    <option value="custom">Custom Expiry Date</option>
                  </select>
                </div>

                {expiryType === 'custom' && (
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Choose Custom Date & Time</label>
                    <input 
                      type="datetime-local" 
                      className="form-control form-control-sm"
                      value={customExpiry}
                      onChange={(e) => setCustomExpiry(e.target.value)}
                      required
                    />
                  </div>
                )}

                <button 
                  onClick={handleGenerateShareLink} 
                  disabled={shareLoading} 
                  className="btn btn-primary btn-sm w-100"
                  style={{ marginTop: '4px' }}
                >
                  {shareLoading ? 'Generating Link...' : 'Generate Access Token'}
                </button>

                {shareLink && (
                  <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', marginTop: '10px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600, display: 'block' }}>✔ Link Generated!</span>
                    <input 
                      type="text" 
                      readOnly 
                      className="form-control form-control-sm" 
                      value={shareLink} 
                      style={{ background: '#fff', fontSize: '0.75rem', marginTop: '4px' }}
                      onClick={(e) => e.target.select()}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button onClick={handleCopyLink} className="btn btn-success btn-xs w-100" style={{ padding: '4px' }}>📋 Copy</button>
                      <a href={shareLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-xs w-100" style={{ padding: '4px', textAlign: 'center' }}>🔗 Open</a>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#166534', display: 'block', marginTop: '8px', textAlign: 'center' }}>
                      Expires: {shareExpires}
                    </span>
                  </div>
                )}

                <button 
                  onClick={() => setSelectedRecords([])} 
                  className="btn btn-ghost btn-sm w-100"
                  style={{ color: 'var(--text-muted)', marginTop: '4px' }}
                >
                  Cancel Selection
                </button>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {showUpload && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative' }}>
            
            <button 
              onClick={() => setShowUpload(false)} 
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>

            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>📤 Upload Medical Document</h3>

              {uploadMessage && (
                <div className={`alert ${uploadMessage.includes('successfully') ? 'alert-success' : 'alert-danger'}`} style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                  {uploadMessage}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Document Title</label>
                <input 
                  type="text"
                  placeholder="e.g. Annual Blood Sugar Report"
                  className="form-control form-control-sm"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Document Category</label>
                    <select 
                      className="form-control form-control-sm"
                      value={uploadForm.doc_type}
                      onChange={(e) => setUploadForm({ ...uploadForm, doc_type: e.target.value })}
                    >
                      {doc_types.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Report Date</label>
                    <input 
                      type="date"
                      className="form-control form-control-sm"
                      value={uploadForm.record_date}
                      onChange={(e) => setUploadForm({ ...uploadForm, record_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Associate Family Circle</label>
                    <select 
                      className="form-control form-control-sm"
                      value={uploadForm.family_member_id}
                      onChange={(e) => setUploadForm({ ...uploadForm, family_member_id: e.target.value })}
                    >
                      <option value="">Personal Record</option>
                      {family.map(f => (
                        <option key={f._id} value={f._id}>{f.full_name} ({f.relationship})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Link Consultation Appointment</label>
                    <select 
                      className="form-control form-control-sm"
                      value={uploadForm.appointment_id}
                      onChange={(e) => setUploadForm({ ...uploadForm, appointment_id: e.target.value })}
                    >
                      <option value="">No Session Link</option>
                      {appointments.map(appt => (
                        <option key={appt.id} value={appt.id}>{appt.appt_date} · Dr. {appt.dname}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Prescribing Doctor</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Dr. John Doe"
                      className="form-control form-control-sm"
                      value={uploadForm.doctor_name}
                      onChange={(e) => setUploadForm({ ...uploadForm, doctor_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Search tags</label>
                    <input 
                      type="text" 
                      placeholder="e.g. cholesterol, cardiology"
                      className="form-control form-control-sm"
                      value={uploadForm.tags}
                      onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Notes / Summary</label>
                <textarea 
                  className="form-control form-control-sm"
                  rows="2"
                  placeholder="Summarize key remarks..."
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Attach File (PDF or Image)</label>
                <input 
                  type="file" 
                  className="form-control form-control-sm" 
                  onChange={(e) => setFile(e.target.files[0])}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowUpload(false)} 
                  className="btn btn-ghost btn-sm"
                  disabled={uploadLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-sm"
                  disabled={uploadLoading}
                >
                  {uploadLoading ? 'Uploading File...' : 'Upload Document'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default HealthLocker;
