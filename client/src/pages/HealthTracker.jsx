import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const HealthTracker = () => {
  const [trackerData, setTrackerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  
  // Chart and Log Details
  const [chartLogs, setChartLogs] = useState([]);
  const [chartTargets, setChartTargets] = useState({});
  const [chartLoading, setChartLoading] = useState(false);
  const [chartDays, setChartDays] = useState(30);

  // AURA AI Insights State
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Share State
  const [doctorsList, setDoctorsList] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // Log Form State
  const [logForm, setLogForm] = useState({
    log_date: '',
    log_time: '',
    note: '',
    // metrics variables will be dynamic
    fasting: '',
    post_meal: '',
    random: '',
    systolic: '',
    diastolic: '',
    pulse: '',
    weight: '',
    temp: '',
    spo2: ''
  });
  const [logLoading, setLogLoading] = useState(false);
  const [logMessage, setLogMessage] = useState('');

  const fetchTrackerDashboard = async () => {
    try {
      const res = await axios.get('/api/health-tracker');
      if (res.data && res.data.ok) {
        setTrackerData(res.data);
        
        // Default select first active condition
        if (res.data.active && res.data.active.length > 0 && !selectedCondition) {
          setSelectedCondition(res.data.active[0]);
        }
        
        // Reset default time
        setLogForm(prev => ({
          ...prev,
          log_date: res.data.today || new Date().toISOString().split('T')[0],
          log_time: res.data.now_time || new Date().toTimeString().slice(0, 5)
        }));
      } else {
        setError(res.data.error || 'Failed to initialize health tracker page.');
      }
    } catch (err) {
      console.error(err);
      setError('Server connection error loading telemetry configurations.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuraInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await axios.get('/api/health-tracker/aura-insights');
      if (res.data && res.data.ok) {
        setInsights(res.data.insights || []);
      }
    } catch (err) {
      console.error('Failed to load AURA insights', err);
    } finally {
      setInsightsLoading(false);
    }
  };

  const fetchDoctorsList = async () => {
    try {
      // Find list of active doctors for sharing
      const res = await axios.get('/api/doctors');
      if (res.data && res.data.ok) {
        setDoctorsList(res.data.doctors_data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTrackerDashboard();
    fetchAuraInsights();
    fetchDoctorsList();
  }, []);

  const fetchChartData = async () => {
    if (!selectedCondition) return;
    setChartLoading(true);
    try {
      const res = await axios.get(`/api/tracker-data/${selectedCondition}?days=${chartDays}`);
      if (res.data && res.data.ok) {
        setChartLogs(res.data.data || []);
        setChartTargets(res.data.targets || {});
        
        // If config specifies shared doctor, select it in sharing dropdown
        if (trackerData && trackerData.configs) {
          const cfg = trackerData.configs.find(c => c.condition === selectedCondition);
          if (cfg && cfg.share_with_doctor_id) {
            setSelectedDoctorId(cfg.share_with_doctor_id);
          } else {
            setSelectedDoctorId('');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load chart metrics', err);
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [selectedCondition, chartDays]);

  const handleStartTracking = async (cond) => {
    try {
      const res = await axios.post('/api/health-tracker/start', { condition: cond });
      if (res.data && res.data.ok) {
        setSelectedCondition(cond);
        await fetchTrackerDashboard();
      }
    } catch (err) {
      alert('Error activating tracking module.');
    }
  };

  const handleStopTracking = async (cond) => {
    if (!window.confirm(`Are you sure you want to stop tracking ${trackerData.conditions[cond]?.label}? Your past logs will be preserved.`)) return;
    try {
      const res = await axios.post('/api/health-tracker/stop', { condition: cond });
      if (res.data && res.data.ok) {
        if (selectedCondition === cond) {
          setSelectedCondition('');
        }
        await fetchTrackerDashboard();
      }
    } catch (err) {
      alert('Error pausing tracking module.');
    }
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    setLogLoading(true);
    setLogMessage('');

    try {
      const payload = {
        condition: selectedCondition,
        log_date: logForm.log_date,
        log_time: logForm.log_time,
        note: logForm.note
      };

      // Extract metrics based on active condition
      const condMetrics = trackerData.conditions[selectedCondition].metrics;
      condMetrics.forEach(m => {
        payload[m.key] = logForm[m.key];
      });

      const res = await axios.post('/api/health-tracker/log', payload);
      if (res.data && res.data.ok) {
        setLogMessage('🎉 Telemetry logged successfully!');
        setLogForm(prev => ({
          ...prev,
          note: '',
          fasting: '',
          post_meal: '',
          random: '',
          systolic: '',
          diastolic: '',
          pulse: '',
          weight: '',
          temp: '',
          spo2: ''
        }));
        await fetchTrackerDashboard();
        await fetchChartData();
        fetchAuraInsights(); // Update AURA correlation metrics
      } else {
        setLogMessage(`❌ ${res.data.error || 'Failed to submit.'}`);
      }
    } catch (err) {
      console.error(err);
      setLogMessage('❌ Error submitting logs.');
    } finally {
      setLogLoading(false);
    }
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/health-tracker/share', {
        condition: selectedCondition,
        doctor_id: selectedDoctorId || null
      });
      if (res.data && res.data.ok) {
        alert('Sharing settings updated successfully.');
        fetchTrackerDashboard();
      } else {
        alert(res.data.error || 'Failed to update sharing.');
      }
    } catch (err) {
      alert('Error updating doctor sharing parameters.');
    }
  };

  const handleDownloadReport = () => {
    window.open('/api/health-tracker/download-report', '_blank');
  };

  // Compile Chart data structures
  const buildChartData = () => {
    if (chartLogs.length === 0) return null;

    const labels = chartLogs.map(l => `${l.date} ${l.time ? '· ' + l.time : ''}`);
    const condMetrics = trackerData?.conditions[selectedCondition]?.metrics || [];

    const datasets = condMetrics.map((m, idx) => {
      const colors = ['#2563eb', '#10b981', '#ef4444', '#f59e0b', '#7c3aed'];
      const borderCol = colors[idx % colors.length];
      const dataPoints = chartLogs.map(l => l.metrics[m.key] || null);

      return {
        label: m.label,
        data: dataPoints,
        borderColor: borderCol,
        backgroundColor: borderCol + '20',
        borderWidth: 2,
        tension: 0.3,
        fill: false,
        spanGaps: true
      };
    });

    // Add target limits if specified by doctor
    const config = trackerData?.configs?.find(c => c.condition === selectedCondition);
    const targets = config && config.targets ? (typeof config.targets === 'string' ? JSON.parse(config.targets) : config.targets) : {};

    condMetrics.forEach(m => {
      if (targets[m.key]) {
        const trg = targets[m.key];
        if (trg.max !== undefined && trg.max !== '') {
          datasets.push({
            label: `${m.label} Upper Bound`,
            data: Array(chartLogs.length).fill(trg.max),
            borderColor: '#fca5a5',
            borderDash: [5, 5],
            borderWidth: 1.5,
            fill: false,
            pointStyle: 'none',
            pointRadius: 0
          });
        }
        if (trg.min !== undefined && trg.min !== '') {
          datasets.push({
            label: `${m.label} Lower Bound`,
            data: Array(chartLogs.length).fill(trg.min),
            borderColor: '#fed7aa',
            borderDash: [5, 5],
            borderWidth: 1.5,
            fill: false,
            pointStyle: 'none',
            pointRadius: 0
          });
        }
      }
    });

    return { labels, datasets };
  };

  const chartData = buildChartData();
  const activeConditionObj = trackerData?.conditions[selectedCondition];

  if (loading) {
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

  return (
    <div className="container" style={{ padding: '30px 20px' }}>
      
      {/* Header Panel */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(37,99,235,0.06))' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0 }}>Smart Health Tracker</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Log daily telemetry readings and check clinical trends correlated with your adherence logs.</p>
        </div>
        <button onClick={handleDownloadReport} className="btn btn-outline btn-sm">
          📥 Download Health Report PDF
        </button>
      </div>

      <div className="row g-4">
        {/* Left Side: Modules & Insights */}
        <div className="col-lg-4">
          
          {/* Active Trackers Checklist */}
          <div className="glass" style={{ padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px' }}> Start Tracking a Condition</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>Select or toggle health monitors below</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(trackerData.conditions).map(([key, value]) => {
                const isActive = trackerData.active.includes(key);
                
                // Determine curated theme color based on condition label
                let theme = { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
                if (value.label.includes('Sugar') || value.label.includes('Glucose')) {
                  theme = { bg: '#fef2f2', text: '#ef4444', border: '#fee2e2' };
                } else if (value.label.includes('Pressure')) {
                  theme = { bg: '#f5f3ff', text: '#7c3aed', border: '#edd9ff' };
                } else if (value.label.includes('Weight')) {
                  theme = { bg: '#fffbeb', text: '#d97706', border: '#fef3c7' };
                } else if (value.label.includes('SpO2') || value.label.includes('Oxygen')) {
                  theme = { bg: '#f0f9ff', text: '#0ea5e9', border: '#e0f2fe' };
                } else if (value.label.includes('Temperature') || value.label.includes('Fever')) {
                  theme = { bg: '#f0fdf4', text: '#16a34a', border: '#dcfce7' };
                }

                const isSelected = selectedCondition === key;

                return (
                  <div 
                    key={key} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px', 
                      background: isSelected ? 'rgba(255, 255, 255, 0.95)' : '#ffffff', 
                      borderRadius: '16px', 
                      border: isSelected ? `2.5px solid ${theme.text}` : '1px solid #e2e8f0',
                      boxShadow: isSelected ? '0 10px 20px rgba(0,0,0,0.04)' : 'none',
                      transition: 'all 0.25s ease'
                    }}
                  >
                    <div 
                      onClick={() => isActive && setSelectedCondition(key)}
                      style={{ cursor: isActive ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}
                    >
                      <div style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '10px', 
                        background: theme.bg, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        color: theme.text,
                        border: `1px solid ${theme.border}`
                      }}>
                        {value.icon === '🩺' ? '🩸' : value.icon === '⚖️' ? '⚖️' : value.icon === '📈' ? '📈' : value.icon}
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.85rem', display: 'block', color: isActive ? 'var(--text)' : 'var(--text-muted)' }}>
                          {value.label}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {isActive ? `Recent Log: ${trackerData.recent[key]?.[0]?.log_date || 'None'}` : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => isActive ? handleStopTracking(key) : handleStartTracking(key)}
                      className={`btn btn-xs`}
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: '0.72rem', 
                        fontWeight: 700, 
                        borderRadius: '8px',
                        background: isActive ? '#f1f5f9' : theme.text,
                        color: isActive ? '#475569' : 'white',
                        border: 'none',
                        boxShadow: isActive ? 'none' : `0 4px 10px ${theme.text}33`
                      }}
                    >
                      {isActive ? 'Pause' : 'Track'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AURA AI Coach */}
          <div className="glass" style={{ padding: '24px', position: 'relative', border: '1px dashed #7c3aed', background: 'radial-gradient(circle at 10% 10%, rgba(124,58,237,0.04), transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '1.35rem' }}>🔮</span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>AURA AI Clinical Coach</h3>
            </div>

            {insightsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ width: '24px', height: '24px', border: '3px solid #e2e8f0', borderTop: '3px solid #7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
              </div>
            ) : insights.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>No correlation logs found. Log telemetry and complete checklist elements to train the AI coach.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {insights.map((ins, idx) => (
                  <div key={idx} style={{ padding: '12px', background: ins.type === 'positive' ? '#f0fdf4' : ins.type === 'warning' ? '#fffbeb' : '#f0f9ff', borderRadius: '8px', borderLeft: `4px solid ${ins.type === 'positive' ? '#10b981' : ins.type === 'warning' ? '#f59e0b' : '#3b82f6'}` }}>
                    <h5 style={{ fontSize: '0.8rem', fontWeight: 800, margin: '0 0 4px', color: ins.type === 'positive' ? '#065f46' : ins.type === 'warning' ? '#92400e' : '#1e3a8a' }}>
                      {ins.title}
                    </h5>
                    <p style={{ fontSize: '0.78rem', margin: '0 0 6px', color: 'var(--text-muted)', lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: ins.description }} />
                    <p style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text)', margin: 0 }}>💡 {ins.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Log Form & Chart Visualization */}
        <div className="col-lg-8">
          
          {selectedCondition && activeConditionObj ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Form & Sharing */}
              <div className="row g-4">
                
                {/* Log Form */}
                <div className="col-md-7">
                  <div className="glass" style={{ padding: '20px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📝 Log {activeConditionObj.label} Reading
                    </h3>

                    {logMessage && (
                      <div className={`alert ${logMessage.includes('successfully') ? 'alert-success' : 'alert-danger'}`} style={{ padding: '8px 12px', fontSize: '0.82rem', marginBottom: '12px' }}>
                        {logMessage}
                      </div>
                    )}

                    <form onSubmit={handleLogSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      
                      <div className="row g-2">
                        <div className="col-6">
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Date</label>
                            <input 
                              type="date" 
                              className="form-control form-control-sm"
                              value={logForm.log_date}
                              onChange={(e) => setLogForm({ ...logForm, log_date: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Time</label>
                            <input 
                              type="time" 
                              className="form-control form-control-sm"
                              value={logForm.log_time}
                              onChange={(e) => setLogForm({ ...logForm, log_time: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Dynamic Metrics Inputs */}
                      <div className="row g-2">
                        {activeConditionObj.metrics.map(metric => (
                          <div key={metric.key} className="col-6">
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                {metric.label} ({metric.unit})
                              </label>
                              <input 
                                type="number"
                                step="any"
                                placeholder={`e.g. ${metric.key === 'fasting' ? '90' : metric.key === 'systolic' ? '120' : '98'}`}
                                className="form-control form-control-sm"
                                value={logForm[metric.key]}
                                onChange={(e) => setLogForm({ ...logForm, [metric.key]: e.target.value })}
                                required
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Notes / Activities</label>
                        <input 
                          type="text" 
                          placeholder="e.g. after lunch, felt dizzy"
                          className="form-control form-control-sm"
                          value={logForm.note}
                          onChange={(e) => setLogForm({ ...logForm, note: e.target.value })}
                        />
                      </div>

                      <button type="submit" disabled={logLoading} className="btn btn-primary btn-sm w-100" style={{ marginTop: '4px' }}>
                        {logLoading ? 'Submitting...' : 'Log Reading'}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Doctor Sharing */}
                <div className="col-md-5">
                  <div className="glass" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px' }}>🤝 Doctor Telemetry Access</h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        Share your logs automatically with an approved doctor. They can review your trends in their clinic console.
                      </p>
                    </div>

                    <form onSubmit={handleShareSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                      <div className="form-group">
                        <select 
                          className="form-control form-control-sm"
                          value={selectedDoctorId}
                          onChange={(e) => setSelectedDoctorId(e.target.value)}
                        >
                          <option value="">Do Not Share</option>
                          {doctorsList.map(({ doc }) => (
                            <option key={doc._id} value={doc._id}>Dr. {doc.full_name} ({doc.specialization})</option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" className="btn btn-outline btn-sm w-100">
                        Update Access
                      </button>
                    </form>
                  </div>
                </div>

              </div>

              {/* Chart Visualization */}
              <div className="glass" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>📊 Clinical Progression Chart</h3>
                  
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[7, 14, 30].map(days => (
                      <button 
                        key={days} 
                        onClick={() => setChartDays(days)} 
                        className={`btn btn-xs ${chartDays === days ? 'btn-primary' : 'btn-outline'}`}
                      >
                        {days} Days
                      </button>
                    ))}
                  </div>
                </div>

                {chartLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '220px' }}>
                    <div style={{ width: '30px', height: '30px', border: '3px solid #e2e8f0', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  </div>
                ) : chartLogs.length === 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '220px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No telemetry records registered in the past {chartDays} days. Log values above to see live trends.
                  </div>
                ) : chartData ? (
                  <div style={{ height: '260px', position: 'relative' }}>
                    <Line 
                      data={chartData} 
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'top',
                            labels: { boxWidth: 12, font: { size: 10 } }
                          }
                        },
                        scales: {
                          x: { grid: { display: false }, ticks: { font: { size: 8 } } },
                          y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 8 } } }
                        }
                      }} 
                    />
                  </div>
                ) : null}
              </div>

            </div>
          ) : (
            <div className="glass" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '3rem' }}>📈</span>
              <h3 style={{ fontSize: '1.25rem', marginTop: '16px' }}>No Tracking Module Selected</h3>
              <p style={{ fontSize: '0.9rem' }}>Please select one of your active tracking modules on the left panel or click 'Track' on a new condition to start.</p>
            </div>
          )}

        </div>
      </div>

      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default HealthTracker;
