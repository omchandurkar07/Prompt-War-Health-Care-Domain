import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const DoctorPatients = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPatients = async (query = '') => {
    try {
      const res = await axios.get(`/api/doctor/patients?q=${encodeURIComponent(query)}`);
      if (res.data && res.data.ok) {
        setData(res.data);
      } else {
        setError(res.data.error || 'Failed to load patients.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error loading patient registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    fetchPatients(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setLoading(true);
    fetchPatients('');
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f4f6', borderTop: '4px solid #059669', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '40px 20px', maxWidth: '1000px' }}>
        <div className="alert alert-danger">❌ &nbsp;{error}</div>
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/doctor/dashboard" className="btn btn-outline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const { patients = [], search = '' } = data || {};

  return (
    <>
      <section className="page-header" style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', padding: '40px 0' }}>
        <div className="container" style={{ maxWidth: '1200px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#064e3b' }}>👥 Patient Registry</h1>
          <p style={{ margin: '8px 0 0', color: '#065f46', fontSize: '0.95rem' }}>
            View medical profiles, history log, and manage medical lockers for patient consultations.
          </p>
        </div>
      </section>

      <section className="section" style={{ padding: '40px 0' }}>
        <div className="container" style={{ maxWidth: '1200px' }}>

          {/* Search & Toolbar */}
          <div className="patients-toolbar glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderRadius: '16px', marginBottom: '28px', gap: '16px', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.45)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <form onSubmit={handleSearchSubmit} className="patients-search-form" style={{ display: 'flex', flex: 1, minWidth: '280px', gap: '10px' }}>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patients by name, email, or phone..." 
                className="form-input" 
                style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}
              />
              <button type="submit" className="btn btn-primary" style={{ background: '#059669', borderColor: '#059669', color: '#fff' }}>🔍 Search</button>
              {searchQuery && (
                <button type="button" onClick={handleClearSearch} className="btn btn-outline">Clear</button>
              )}
            </form>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Total Consulted: <span style={{ color: '#059669', fontWeight: 800 }}>{patients.length}</span> patient(s)
            </div>
          </div>

          {/* Patients Grid */}
          {patients.length > 0 ? (
            <div className="patients-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
              {patients.map(p => (
                <div key={p._id} className="patient-premium-card card" style={{ position: 'relative', overflow: 'hidden', borderRadius: '16px', transition: 'all 0.3s', display: 'flex', flexDirection: 'column' }}>
                  <div className="patient-card-top-bar" style={{ height: '6px', background: 'linear-gradient(90deg, #059669, #34d399)' }}></div>
                  
                  <div className="patient-card-body" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="patient-header-info" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="patient-avatar-placeholder" style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                        {p.full_name ? p.full_name.slice(0, 2).toUpperCase() : 'PA'}
                      </div>
                      <div className="patient-name-title">
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{p.full_name}</h3>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ID: #PA-{p._id ? p._id.slice(-6).toUpperCase() : ''}</span>
                      </div>
                    </div>
                    
                    <div className="patient-details-list" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem', color: 'var(--text-light)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '12px 0', margin: '8px 0' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>Gender:</span>
                        <span>{p.gender || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>Blood Group:</span>
                        <span style={{ fontWeight: 700, color: '#991b1b' }}>{p.blood_group || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>DOB:</span>
                        <span>{p.dob || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>Phone:</span>
                        <span>{p.phone || 'N/A'}</span>
                      </div>
                    </div>

                    <div style={{ marginTop: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CHRONIC CONDITIONS</span>
                      <div className="conditions-container" style={{ minHeight: '38px' }}>
                        {p.chronic_conditions && p.chronic_conditions.trim() ? (
                          p.chronic_conditions.split(',').map((cond, idx) => (
                            <span key={idx} className="badge-condition" style={{ display: 'inline-block', background: '#fef2f2', color: '#991b1b', border: '1px solid #fee2e2', padding: '2px 8px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600, marginRight: '4px', marginBottom: '4px' }}>
                              {cond.trim()}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No chronic conditions declared.</span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '8px' }}>
                      ✉️ {p.email}
                    </div>
                  </div>
                  
                  <div className="patient-card-actions" style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', background: 'rgba(248, 250, 252, 0.5)' }}>
                    <Link to={`/doctor/patient/${p._id}/records`} className="btn btn-primary btn-sm btn-full" style={{ background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#fff' }}>
                      📂 Medical Locker &amp; History
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.45)', border: '1px solid rgba(255,255,255,0.5)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px' }}>No consulting patients found</h3>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                {search ? 'No patients match your search criteria. Try a different term.' : "You haven't consulted any patients yet. Once appointments are booked and confirmed, patients will appear here."}
              </p>
              {search && (
                <button onClick={handleClearSearch} className="btn btn-outline" style={{ marginTop: '16px' }}>Clear Search</button>
              )}
            </div>
          )}

        </div>
      </section>
    </>
  );
};

export default DoctorPatients;
