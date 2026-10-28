import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';

const WritePrescription = () => {
  const { aid } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form State
  const [diagnosis, setDiagnosis] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState('');
  const [fileError, setFileError] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [showOcrPreview, setShowOcrPreview] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [extractionNotice, setExtractionNotice] = useState('');
  
  // Medicines List
  const [medicines, setMedicines] = useState([]);
  
  // Submission UI States
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    if (!selectedFile || !selectedFile.type.startsWith('image/')) {
      setSelectedImagePreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(selectedFile);
    setSelectedImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedFile]);
  
  const fetchPrescriptionDetails = async () => {
    try {
      const res = await axios.get(`/api/doctor/prescription/${aid}`);
      if (res.data && res.data.ok) {
        setData(res.data);
        if (res.data.existing_rx) {
          setDiagnosis(res.data.existing_rx.diagnosis || res.data.existing_rx.diagnosis_notes || '');
          setDoctorNotes(res.data.existing_rx.doctor_notes || res.data.existing_rx.advice || '');
          setFollowUpDate(res.data.existing_rx.follow_up_date || '');
          setPreferredLanguage(res.data.existing_rx.ai_language || 'English');
        }
        if (res.data.medicines && res.data.medicines.length > 0) {
          setMedicines(res.data.medicines);
        }
      } else {
        setError(res.data.error || 'Failed to load prescription form.');
      }
    } catch (err) {
      console.error(err);
      setError('You must complete the appointment session first before writing a full prescription.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptionDetails();
  }, [aid]);

  const addMedicineRow = () => {
    setMedicines(prev => [...prev, {
      name: '',
      dosage: '',
      units_per_dose: '',
      timing: '',
      duration: '',
      quantity: '',
      quantity_source: 'not_specified',
      confidence: 'low',
      source: 'manual',
      route: 'Oral',
      instructions: ''
    }]);
  };

  const removeMedicineRow = (indexToRemove) => {
    setMedicines(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const updateMedicineField = (indexToUpdate, field, value) => {
    setMedicines(prev => prev.map((medicine, index) => (
      index === indexToUpdate ? { ...medicine, [field]: value } : medicine
    )));
  };

  const handleFileSelection = (file) => {
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    if (!allowedExtensions.includes(extension)) {
      setFileError('Choose a PDF, JPG, PNG, or WebP file.');
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFileError('The prescription scan must be 10 MB or smaller.');
      setSelectedFile(null);
      return;
    }

    setFileError('');
    setSelectedFile(file);
    setShowOcrPreview(false);
    setOcrText('');
    setExtractionNotice('Prescription scan uploaded. Extracting medicine details...');
    handleOcrScan(file);
  };

  const handleFileChange = (e) => {
    handleFileSelection(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    handleFileSelection(e.dataTransfer.files?.[0]);
  };

  const handleOcrScan = async (fileToScan = selectedFile) => {
    if (!fileToScan) {
      return;
    }
    setOcrLoading(true);
    const formData = new FormData();
    formData.append('file', fileToScan);
    
    try {
      const response = await fetch('/api/prescription/ocr', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Unable to analyze this prescription scan.');
      }

      if (result.medicines && result.medicines.length > 0) {
        setMedicines(result.medicines.map(m => ({
            name: m.name || '',
            dosage: m.dosage || '',
            units_per_dose: m.units_per_dose || '',
            timing: m.timing || m.frequency || '',
            duration: m.duration || '',
            quantity: m.quantity || '',
            quantity_source: m.quantity_source || (m.quantity ? 'written' : 'not_specified'),
            confidence: m.confidence || 'low',
            route: m.route || '',
            instructions: m.instructions || ''
          })));
        setExtractionNotice('Detected details are suggestions. Verify the medicine, dose, schedule, duration, and quantity against the uploaded prescription before saving.');
      } else {
        setExtractionNotice('The scan could not reliably identify any medicines. Check the original scan or upload a clearer image before saving.');
      }
      if (result.diagnosis) {
        setDiagnosis(result.diagnosis);
      }
      if (result.follow_up_date) {
        setFollowUpDate(result.follow_up_date);
      }
      if (result.doctor_notes) {
        setDoctorNotes(result.doctor_notes);
      }
      if (result.raw_text) {
        setOcrText(result.raw_text);
        setShowOcrPreview(true);
      }
    } catch (err) {
      console.error(err);
      setExtractionNotice(err.message || 'Unable to analyze this scan. Try uploading a clearer prescription image.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const hasMeds = medicines.some(m => m.name.trim() !== '');
    if (!selectedFile && !diagnosis.trim()) {
      alert('Primary diagnosis is required if no prescription file is uploaded.');
      return;
    }
    if (!selectedFile && !hasMeds) {
      alert('Upload a prescription scan so its medicine details can be detected.');
      return;
    }

    setSubmitLoading(true);
    const formData = new FormData();
    formData.append('diagnosis', diagnosis);
    formData.append('doctor_notes', doctorNotes);
    formData.append('follow_up_date', followUpDate);
    formData.append('preferred_language', preferredLanguage);
    if (selectedFile) {
      formData.append('prescription_file', selectedFile);
    }
    
    // Append medicines list
    medicines.forEach((med, index) => {
      formData.append(`med_name[${index}]`, med.name);
      formData.append(`medicine_name[${index}]`, med.name);
      formData.append(`med_dosage[${index}]`, med.dosage);
      formData.append(`medicine_dosage[${index}]`, med.dosage);
      formData.append(`medicine_units_per_dose[${index}]`, med.units_per_dose || '');
      formData.append(`med_frequency[${index}]`, med.timing);
      formData.append(`medicine_timing[${index}]`, med.timing);
      formData.append(`med_duration[${index}]`, med.duration);
      formData.append(`medicine_duration[${index}]`, med.duration);
      formData.append(`med_quantity[${index}]`, med.quantity || '');
      formData.append(`medicine_quantity[${index}]`, med.quantity || '');
      formData.append(`medicine_quantity_source[${index}]`, med.quantity_source || '');
      formData.append(`med_route[${index}]`, 'Oral');
      formData.append(`med_instructions[${index}]`, '');
    });

    try {
      const response = await fetch(`/api/doctor/prescription/${aid}`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const result = await response.json();
      if (response.ok && result.ok) {
        if (result.warnings && result.warnings.length > 0) {
          alert('Prescription saved! Warnings detected by Clinical Decision Support (CDS): \n' + result.warnings.join('\n'));
        } else {
          alert(result.message || 'Prescription saved and made available in the patient dashboard.');
        }
        navigate('/doctor/dashboard');
      } else {
        alert(result.error || 'Failed to submit prescription.');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Server error submitting prescription details.');
    } finally {
      setSubmitLoading(false);
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
      <div className="container" style={{ padding: '40px 20px', maxWidth: '920px' }}>
        <div className="alert alert-danger">❌ &nbsp;{error}</div>
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/doctor/dashboard" className="btn btn-outline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const { appt } = data || {};

  return (
    <>
      <section className="page-header" style={{ background: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)', padding: '40px 0' }}>
        <div className="container" style={{ maxWidth: '920px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#1e1b4b' }}>💊 Create Prescription</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>
            For: <strong>{appt?.fm_name || appt?.pname}</strong> · {appt?.appt_date} {appt?.time_slot}
          </p>
        </div>
      </section>

      <section className="section" style={{ padding: '40px 0' }}>
        <div className="container" style={{ maxWidth: '920px' }}>
          
          <form onSubmit={handleSubmit} className="rx-glass card" style={{ padding: '28px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.4)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e1b4b', marginBottom: '8px', display: 'block' }}>Diagnosis *</label>
                <textarea 
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="form-input" 
                  rows="4" 
                  required={!selectedFile}
                  placeholder="Primary diagnosis details..."
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.5)' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e1b4b', marginBottom: '8px', display: 'block' }}>Doctor Instructions & Notes</label>
                <textarea 
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  className="form-input" 
                  rows="4" 
                  placeholder="Instructions for the patient..."
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.5)' }}
                />
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1e1b4b', marginBottom: '4px', display: 'block' }}>Follow-up Date</label>
                    <input 
                      type="date" 
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1e1b4b', marginBottom: '4px', display: 'block' }}>AI Summary Lang</label>
                    <select 
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                    >
                      <option value="English">English</option>
                      <option value="Hindi">Hindi</option>
                      <option value="Marathi">Marathi</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* File Upload Zone */}
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e1b4b', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>Upload Prescription Scan (Optional)</h3>
            <label
              htmlFor="rx_file"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingFile(false);
              }}
              onDrop={handleFileDrop}
              style={{
                minHeight: '92px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                border: `2px dashed ${isDraggingFile ? '#7c3aed' : '#c084fc'}`,
                borderRadius: '16px',
                padding: '20px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: isDraggingFile || selectedFile ? 'rgba(243, 232, 255, 0.55)' : 'rgba(255,255,255,0.65)',
                color: '#64748b',
                transition: 'background 0.2s ease, border-color 0.2s ease',
                marginBottom: '12px'
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                aria-hidden="true"
                style={{ width: '18px', height: '18px', flexShrink: 0, fill: '#8b5cf6' }}
              >
                <path d="M10 1c-.27 0-.52.11-.71.29l-6 6A1 1 0 0 0 3 8v12a3 3 0 0 0 3 3h1a1 1 0 1 0 0-2H6a1 1 0 0 1-1-1V9h5a1 1 0 0 0 1-1V3h7a1 1 0 0 1 1 1v5a1 1 0 1 0 2 0V4a3 3 0 0 0-3-3h-8ZM9 7H6.41L9 4.41V7Zm7.5 4a4.5 4.5 0 0 0-4.48 4.12A4 4 0 0 0 13 23h7a4 4 0 0 0 .98-7.88A4.5 4.5 0 0 0 16.5 11Z" />
              </svg>
              <span style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
                {selectedFile
                  ? `Selected: ${selectedFile.name} — click to replace`
                  : 'Drag & drop or choose a PDF or image (JPG, PNG, WebP; max 10 MB)'}
              </span>
              <input
                type="file" 
                id="rx_file" 
                onChange={handleFileChange}
                accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                aria-describedby="rx-file-help"
                style={{
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  padding: 0,
                  margin: '-1px',
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                  whiteSpace: 'nowrap',
                  border: 0
                }}
              />
            </label>
            <span id="rx-file-help" style={{ display: 'block', marginBottom: '12px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              Upload a PDF or an image of the prescription (JPG, JPEG, PNG, or WebP). The selected image will be previewed below.
            </span>
            {selectedImagePreview && (
              <img
                src={selectedImagePreview}
                alt="Selected prescription image preview"
                style={{ display: 'block', maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', marginBottom: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}
              />
            )}
            {fileError && (
              <p role="alert" style={{ margin: '0 0 12px', color: '#b91c1c', fontSize: '0.85rem' }}>
                {fileError}
              </p>
            )}
            
            {selectedFile && (
              <div style={{ marginBottom: '24px' }}>
                <button 
                  type="button" 
                  onClick={handleOcrScan}
                  disabled={ocrLoading}
                  className="btn btn-outline btn-sm"
                  style={{ marginRight: '8px' }}
                >
                  {ocrLoading ? 'Analyzing scan...' : '🔄 Analyze scan again'}
                </button>
                {extractionNotice && (
                  <p role="status" style={{ margin: '10px 0', color: '#475569', fontSize: '0.85rem' }}>
                    {extractionNotice}
                  </p>
                )}
                {showOcrPreview && (
                  <pre style={{
                    marginTop: '12px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.8rem',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {ocrText}
                  </pre>
                )}
              </div>
            )}

            <section aria-live="polite" style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e1b4b', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                Medicines
              </h3>
              <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Review medicines detected from the scan or add medicine details manually. Confirm all details against the doctor's instructions before saving.
              </p>
              {medicines.length > 0 ? (
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Medicine Name *</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Strength</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Dose</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Timing</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Duration</th>
                        <th style={{ textAlign: 'left', padding: '8px' }}>Quantity</th>
                        <th style={{ width: '48px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {medicines.map((med, index) => (
                        <tr key={`${med.name}-${index}`} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="text"
                              value={med.name || ''}
                              onChange={event => updateMedicineField(index, 'name', event.target.value)}
                              className="form-input form-input-sm"
                              placeholder="Medicine name"
                              aria-label={`Medicine name ${index + 1}`}
                              required
                              style={{ width: '140px', padding: '6px 10px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="text"
                              value={med.dosage || ''}
                              onChange={event => updateMedicineField(index, 'dosage', event.target.value)}
                              className="form-input form-input-sm"
                              placeholder="e.g. 250 mg"
                              aria-label={`Strength for medicine ${index + 1}`}
                              style={{ width: '110px', padding: '6px 10px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="text"
                              value={med.units_per_dose || ''}
                              onChange={event => updateMedicineField(index, 'units_per_dose', event.target.value)}
                              className="form-input form-input-sm"
                              placeholder="e.g. 5 ml"
                              aria-label={`Dose for medicine ${index + 1}`}
                              style={{ width: '100px', padding: '6px 10px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="text"
                              value={med.timing || med.frequency || ''}
                              onChange={event => updateMedicineField(index, 'timing', event.target.value)}
                              className="form-input form-input-sm"
                              placeholder="e.g. TDS"
                              aria-label={`Timing for medicine ${index + 1}`}
                              style={{ width: '110px', padding: '6px 10px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="text"
                              value={med.duration || ''}
                              onChange={event => updateMedicineField(index, 'duration', event.target.value)}
                              className="form-input form-input-sm"
                              placeholder="e.g. 5 days"
                              aria-label={`Duration for medicine ${index + 1}`}
                              style={{ width: '100px', padding: '6px 10px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="text"
                              value={med.quantity || ''}
                              onChange={event => updateMedicineField(index, 'quantity', event.target.value)}
                              className="form-input form-input-sm"
                              placeholder="Optional"
                              aria-label={`Quantity for medicine ${index + 1}`}
                              style={{ width: '100px', padding: '6px 10px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeMedicineRow(index)}
                              className="btn btn-ghost btn-sm"
                              aria-label={`Remove medicine ${index + 1}`}
                              style={{ color: 'var(--danger)', fontSize: '1.2rem', padding: '0 8px' }}
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '16px', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No medicines added yet. Add them here manually or upload a scan to detect them.
                </div>
              )}
              <button
                type="button"
                onClick={addMedicineRow}
                className="btn btn-outline btn-sm"
                style={{ marginTop: '12px' }}
              >
                + Add medicine manually
              </button>
            </section>

            {/* Submitting Buttons */}
            <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                type="submit" 
                disabled={submitLoading}
                className="btn btn-primary btn-lg btn-full"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#ffffff', fontWeight: 600 }}
              >
                {submitLoading ? 'Saving prescription and preparing care plan...' : 'Save & Share with Patient'}
              </button>
              <Link to="/doctor/dashboard" className="btn btn-outline btn-full" style={{ textAlign: 'center' }}>Cancel</Link>
            </div>
          </form>

        </div>
      </section>

      {/* AI Loader Overlay Modal */}
      {submitLoading && (
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
            <div style={{ fontWeight: 700, fontSize: '1.15rem', color: '#1e1b4b' }}>Generating AI Explanation...</div>
            <div style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: '1.5' }}>
              Gemini is creating a clinical explanation and translation. This may take a few seconds.
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

export default WritePrescription;
