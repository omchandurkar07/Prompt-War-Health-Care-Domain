import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const SharedLocker = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSharedRecords = async () => {
    try {
      const res = await axios.get(`/api/shared/${token}`);
      if (res.data && res.data.ok) {
        setData(res.data);
      } else {
        setError(res.data.error || 'Invalid or expired share token.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error loading shared health records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSharedRecords();
  }, [token]);

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

  if (data?.expired) {
    return (
      <div className="container" style={{ padding: '60px 20px', maxWidth: '500px', textAlign: 'center' }}>
        <div className="glass" style={{ padding: '40px' }}>
          <span style={{ fontSize: '3rem' }}>⏳</span>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 850, marginTop: '16px' }}>Share Token Expired</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            This secure shared health locker link has expired or been revoked by the patient. Please ask the patient for a new link.
          </p>
        </div>
      </div>
    );
  }

  const { records = [], patient_name = 'Patient', expires_at = '' } = data || {};

  return (
    <div className="container animate-fade-in" style={{ padding: '30px 20px', maxWidth: '900px' }}>
      
      {/* Title block */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(99,102,241,0.06))' }}>
        <span style={{ fontSize: '0.72rem', background: '#d1fae5', color: '#065f46', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>✔ Secure File Share</span>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 850, margin: '6px 0 0' }}>Shared Records: {patient_name}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          Secure, temporary access to medical reports. This link will expire on: <strong>{expires_at}</strong>.
        </p>
      </div>

      {records.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '0.9rem', margin: 0 }}>No records shared in this link pack.</p>
        </div>
      ) : (
        <div className="row g-4">
          {records.map(rec => (
            <div key={rec.id} className="col-md-6">
              <div className="glass h-100" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
                
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.5rem' }}>{getDocTypeIcon(rec.doc_type)}</span>
                    <div>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0 }}>{rec.title}</h4>
                      <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>{rec.doc_type}</span>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.4 }}>
                    {rec.description || 'No description uploaded.'}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' }}>
                    {rec.doctor_name && <span style={{ fontSize: '0.68rem', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>🩺 Dr. {rec.doctor_name}</span>}
                    {rec.tags && rec.tags.split(',').map((tag, idx) => (
                      <span key={idx} style={{ fontSize: '0.68rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px' }}>#{tag.trim()}</span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>📅 Record Date: {rec.record_date}</span>
                  {rec.file_path && (
                    <a 
                      href={rec.file_path} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-primary btn-xs"
                      style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                    >
                      Download File
                    </a>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default SharedLocker;
