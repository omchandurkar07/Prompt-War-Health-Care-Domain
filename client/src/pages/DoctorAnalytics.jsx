import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const DoctorAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get('/api/doctor/analytics');
      if (res.data && res.data.ok) {
        setData(res.data);
      } else {
        setError(res.data.error || 'Failed to load analytics.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error loading clinical performance analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f4f6', borderTop: '4px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
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

  const { doctor = {}, monthly = [], rating_dist = [], total_revenue = 0 } = data || {};

  return (
    <>
      <section className="page-header" style={{ background: 'linear-gradient(135deg, #f5f3ff, #edd9ff)', padding: '40px 0' }}>
        <div className="container" style={{ maxWidth: '1000px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#1e1b4b' }}>📊 Practice Analytics</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>Insights about your practice performance and ratings</p>
        </div>
      </section>

      <section className="section" style={{ padding: '40px 0' }}>
        <div className="container" style={{ maxWidth: '1000px' }}>
          
          {/* Stats Row */}
          <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <div className="stat-card glass" style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.45)', border: '1px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>💰</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1.2 }}>₹{total_revenue}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Total Revenue</div>
              </div>
            </div>
            
            <div className="stat-card glass" style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.45)', border: '1px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>⭐</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1.2 }}>{parseFloat(doctor.rating_avg || 0).toFixed(1)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Avg Rating</div>
              </div>
            </div>
            
            <div className="stat-card glass" style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.45)', border: '1px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>👥</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1.2 }}>{doctor.total_patients || 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Total Patients</div>
              </div>
            </div>

            <div className="stat-card glass" style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.45)', border: '1px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>⚡</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1.2 }}>{Math.round(doctor.response_time_avg || 0)} min</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Avg Response</div>
              </div>
            </div>
          </div>

          <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            
            {/* Monthly Appointments Chart */}
            <div className="analytics-card glass card" style={{ padding: '24px', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>Monthly Appointments</h3>
              <div className="chart-container" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '220px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                {monthly.length > 0 ? (
                  monthly.map((m, idx) => {
                    const totalHeight = Math.min(200, (m.cnt || 0) * 10);
                    const completedHeight = Math.min(200, (m.completed || 0) * 10);
                    return (
                      <div key={idx} className="chart-bar-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <div className="chart-bars" style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '200px' }}>
                          <div 
                            className="chart-bar" 
                            style={{ 
                              height: `${totalHeight}px`, 
                              width: '14px', 
                              background: '#c084fc', 
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s' 
                            }} 
                            title={`${m.cnt} total`}
                          />
                          <div 
                            className="chart-bar completed" 
                            style={{ 
                              height: `${completedHeight}px`, 
                              width: '14px', 
                              background: '#7c3aed', 
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s' 
                            }} 
                            title={`${m.completed} completed`}
                          />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.month && typeof m.month === 'string' ? m.month.slice(5) : (m.month || 'N/A')}</span>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ color: 'var(--text-muted)', padding: '40px 0' }}>No appointment data yet</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', justifyContent: 'center', fontSize: '0.78rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#c084fc', borderRadius: '50%' }}></span> Total
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#7c3aed', borderRadius: '50%' }}></span> Completed
                </span>
              </div>
            </div>

            {/* Rating Distribution */}
            <div className="analytics-card glass card" style={{ padding: '24px', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>Rating Distribution</h3>
              <div className="rating-dist" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rating_dist.length > 0 ? (
                  rating_dist.map((r, idx) => {
                    const percentage = (r.cnt / (doctor.rating_count || 1)) * 100;
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem' }}>
                        <span style={{ width: '30px' }}>{r.rating}⭐</span>
                        <div style={{ flex: 1, height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                          <div style={{ width: `${percentage}%`, height: '100%', background: '#7c3aed', borderRadius: '5px' }}></div>
                        </div>
                        <span style={{ width: '25px', textAlign: 'right', color: 'var(--text-muted)' }}>{r.cnt}</span>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No reviews yet</p>
                )}
              </div>
            </div>

          </div>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <Link to="/doctor/dashboard" className="btn btn-outline">← Back to Dashboard</Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default DoctorAnalytics;
