import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const HealingPlan = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkedItems, setCheckedItems] = useState({});
  const [streak, setStreak] = useState(0);

  const fetchHealingPlan = async () => {
    try {
      const res = await axios.get('/api/healing-plan');
      if (res.data && res.data.ok) {
        setData(res.data);
        setStreak(res.data.streak || 0);

        // Prepopulate checked items map
        const initialChecked = {};
        if (res.data.logs) {
          Object.entries(res.data.logs).forEach(([itemId, log]) => {
            if (log) {
              initialChecked[itemId] = log.is_done;
            }
          });
        }
        setCheckedItems(initialChecked);
      } else {
        setError(res.data.error || 'Failed to fetch healing plan data.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error loading Care Plan diagnostics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealingPlan();
  }, []);

  const handleToggleCheck = async (itemId) => {
    const todayStr = data?.today || new Date().toISOString().split('T')[0];
    try {
      // Toggle locally
      setCheckedItems(prev => ({
        ...prev,
        [itemId]: !prev[itemId]
      }));

      const res = await axios.post('/api/adherence/toggle', {
        item_id: itemId,
        date: todayStr
      });

      if (!res.data.ok) {
        // Revert local toggle
        setCheckedItems(prev => ({
          ...prev,
          [itemId]: !prev[itemId]
        }));
      } else {
        // Fetch stats again to update week adherence chart
        const info = await axios.get('/api/healing-plan');
        if (info.data && info.data.ok) {
          setData(info.data);
          setStreak(info.data.streak || 0);
        }
      }
    } catch (err) {
      console.error(err);
      // Revert local toggle
      setCheckedItems(prev => ({
        ...prev,
        [itemId]: !prev[itemId]
      }));
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

  const { plans = [], items = [], week_stats = [] } = data || {};

  // Group items by time of day
  const groupedItems = {
    morning: items.filter(it => it.time_of_day === 'morning'),
    afternoon: items.filter(it => it.time_of_day === 'afternoon'),
    evening: items.filter(it => it.time_of_day === 'evening'),
    night: items.filter(it => it.time_of_day === 'night' || it.time_of_day === 'any')
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '30px 20px' }}>
      
      {/* Title banner */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(99,102,241,0.06))' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 850, margin: 0 }}>Healing & Care Plan Checklist</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Track daily medication bounds, diagnostic recommendations, and lifestyle habits prescribed by your clinical practitioners.</p>
      </div>

      <div className="row g-4">
        {/* Left Side: Stats & Active plans list */}
        <div className="col-lg-4">
          
          {/* Streak indicator */}
          <div className="glass text-center" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)', color: '#fff' }}>
            <span style={{ fontSize: '2.5rem' }}>🔥</span>
            <h4 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '10px 0 2px', color: '#fca5a5' }}>
              {streak} Day Adherence Streak
            </h4>
            <p style={{ fontSize: '0.78rem', opacity: 0.9, margin: 0 }}>
              Keep logging daily tasks with at least 75% checklist compliance to grow your clinical recovery streak!
            </p>
          </div>

          {/* Adherence Progression bar */}
          <div className="glass" style={{ padding: '20px', marginBottom: '24px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px' }}>📊 Weekly Compliance progression</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {week_stats.map((stat, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700 }}>
                    <span>{stat.day} ({stat.date.slice(5)})</span>
                    <span>{stat.pct}% Adherence</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${stat.pct}%`, 
                      height: '100%', 
                      background: stat.pct >= 75 ? '#10b981' : stat.pct >= 40 ? '#f59e0b' : '#ef4444',
                      borderRadius: '99px'
                    }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active clinical plans info */}
          <div className="glass" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '12px' }}>🏢 Care Provider Details</h4>
            {plans.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No active clinical plans compiled.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {plans.map(p => (
                  <div key={p.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                    <strong style={{ display: 'block', color: 'var(--text)' }}>Dr. {p.doctor_name}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, display: 'block' }}>{p.specialization}</span>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Valid: {p.start_date} to {p.end_date}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Checklists split by Time of Day */}
        <div className="col-lg-8">
          <div className="glass" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '18px' }}>📝 Healing Checklists</h3>

            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 10px', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '2.5rem' }}>🩺</span>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '12px', color: 'var(--text)' }}>No Checklist Items Prescribed</h4>
                <p style={{ fontSize: '0.82rem', maxWidth: '300px', margin: '4px auto 0' }}>Consultations with your doctors will automatically generate daily checklists here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {Object.entries(groupedItems).map(([timeLabel, list]) => {
                  if (list.length === 0) return null;
                  return (
                    <div key={timeLabel}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '10px' }}>
                        🌅 {timeLabel} Routine
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {list.map(it => {
                          const isDone = !!checkedItems[it._id];
                          return (
                            <label 
                              key={it._id} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                gap: '10px', 
                                padding: '12px 16px', 
                                background: isDone ? 'rgba(16,185,129,0.04)' : '#f8fafc',
                                borderRadius: '10px', 
                                border: isDone ? '1px solid #bbf7d0' : '1px solid #e2e8f0', 
                                cursor: 'pointer',
                                margin: 0,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <input 
                                type="checkbox" 
                                style={{ marginTop: '4px', cursor: 'pointer' }}
                                checked={isDone}
                                onChange={() => handleToggleCheck(it._id)}
                              />
                              <div style={{ flex: 1, fontSize: '0.85rem' }}>
                                <strong style={{ 
                                  display: 'block', 
                                  textDecoration: isDone ? 'line-through' : 'none', 
                                  color: isDone ? 'var(--text-muted)' : 'var(--text)' 
                                }}>
                                  {it.title}
                                </strong>
                                
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                                  Type: <span style={{ textTransform: 'capitalize' }}>{it.item_type}</span>
                                  {it.details?.dosage && ` · Dosage: ${it.details.dosage}`}
                                  {it.details?.instructions && ` · Instructions: ${it.details.instructions}`}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

              </div>
            )}

          </div>
        </div>

      </div>

      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default HealingPlan;
