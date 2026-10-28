import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';

const VaccinationSchedule = () => {
  const { mid } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markDate, setMarkDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedVaccine, setSelectedVaccine] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchSchedule = async () => {
    try {
      const res = await axios.get(`/api/family/${mid}/vaccines`);
      if (res.data && res.data.ok) {
        setData(res.data);
      } else {
        setError(res.data.error || 'Failed to load vaccination schedule.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error loading vaccination logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [mid]);

  const handleMarkCompleted = async (e) => {
    e.preventDefault();
    if (!selectedVaccine) return;

    setSubmitLoading(true);
    try {
      const res = await axios.post(`/api/family/${mid}/vaccine/mark`, {
        vaccine_name: selectedVaccine,
        completed_date: markDate
      });
      if (res.data && res.data.ok) {
        setSelectedVaccine(null);
        fetchSchedule();
      } else {
        alert(res.data.error || 'Failed to mark vaccination.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating vaccination status.');
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

  const { member, schedule = [], age_months = 0 } = data || {};

  return (
    <div className="container" style={{ padding: '30px 20px' }}>
      
      {/* Back button */}
      <div style={{ marginBottom: '16px' }}>
        <Link to="/family" style={{ fontSize: '0.85rem', fontWeight: 600 }}>⬅️ Back to Family Circle</Link>
      </div>

      {/* Member Profile Card */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(99,102,241,0.06))' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#bfdbfe', border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', overflow: 'hidden' }}>
          {member.profile_image ? (
            <img src={member.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : member.relation === 'Child' ? '👶' : '👤'}
        </div>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0 }}>Vaccination Schedule: {member.name}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Current Age: <strong>{age_months} months</strong> ({member.relation}) · Blood group: <strong>{member.blood_group}</strong>
          </p>
        </div>
      </div>

      {/* Schedule list */}
      <div className="glass" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '20px' }}>📋 Scheduled Clinical Immunizations</h3>
        
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px', fontSize: '0.82rem', fontWeight: 700 }}>Immunization</th>
                <th style={{ padding: '12px 8px', fontSize: '0.82rem', fontWeight: 700 }}>Target Age</th>
                <th style={{ padding: '12px 8px', fontSize: '0.82rem', fontWeight: 700 }}>Triage Status</th>
                <th style={{ padding: '12px 8px', fontSize: '0.82rem', fontWeight: 700 }}>Date Administered</th>
                <th style={{ padding: '12px 8px', fontSize: '0.82rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((vacc, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 8px', fontSize: '0.85rem', fontWeight: 700 }}>{vacc.vaccine}</td>
                  <td style={{ padding: '12px 8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{vacc.age}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ 
                      fontSize: '0.68rem', 
                      fontWeight: 800, 
                      padding: '3px 8px', 
                      borderRadius: '6px', 
                      background: vacc.status === 'completed' ? '#d1fae5' : vacc.status === 'due' ? '#fee2e2' : '#f1f5f9',
                      color: vacc.status === 'completed' ? '#065f46' : vacc.status === 'due' ? '#b91c1c' : '#475569',
                      textTransform: 'uppercase'
                    }}>
                      {vacc.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {vacc.completed_date ? new Date(vacc.completed_date).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    {vacc.status !== 'completed' ? (
                      <button 
                        onClick={() => setSelectedVaccine(vacc.vaccine)} 
                        className="btn btn-outline btn-xs"
                      >
                        Mark Administered
                      </button>
                    ) : (
                      <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.82rem' }}>✓ Immunized</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark Completed Date Selection Popover Modal */}
      {selectedVaccine && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '380px', padding: '24px', position: 'relative' }}>
            
            <button 
              onClick={() => setSelectedVaccine(null)} 
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>

            <form onSubmit={handleMarkCompleted} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>💉 Mark Immunization</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Please specify the vaccination date for <strong>{selectedVaccine}</strong> on {member.name}'s medical profile.
              </p>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Date Administered</label>
                <input 
                  type="date"
                  className="form-control form-control-sm"
                  value={markDate}
                  onChange={(e) => setMarkDate(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button type="button" onClick={() => setSelectedVaccine(null)} className="btn btn-ghost btn-sm" disabled={submitLoading}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitLoading}>
                  {submitLoading ? 'Saving...' : 'Save Log'}
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

export default VaccinationSchedule;
