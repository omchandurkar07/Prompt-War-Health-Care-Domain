import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const AmbulanceEmergency = () => {
  const { user } = useAuth();
  const [activeBooking, setActiveBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [pickupLocation, setPickupLocation] = useState('');
  const [severity, setSeverity] = useState('critical');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Live Map canvas references
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const statusPollRef = useRef(null);

  // Animated Coordinates State
  const mapStateRef = useRef({
    currentLat: 0,
    currentLng: 0,
    targetLat: 0,
    targetLng: 0,
    pickupLat: 0,
    pickupLng: 0,
    startLat: 0,
    startLng: 0,
    status: '',
    pulseRadius: 0
  });

  const fetchActiveBooking = async () => {
    try {
      const res = await axios.get('/api/ambulance-emergency');
      if (res.data && res.data.ok) {
        const booking = res.data.active_booking;
        setActiveBooking(booking);
        if (booking) {
          const state = mapStateRef.current;
          state.pickupLat = booking.pickup_lat;
          state.pickupLng = booking.pickup_lng;
          state.startLat = booking.driver_lat;
          state.startLng = booking.driver_lng;
          state.currentLat = booking.driver_lat;
          state.currentLng = booking.driver_lng;
          state.targetLat = booking.driver_lat;
          state.targetLng = booking.driver_lng;
          state.status = booking.status;
          
          startPolling(booking._id);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Error checking active emergency dispatches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveBooking();
    return () => {
      stopPolling();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const startPolling = (bookingId) => {
    stopPolling();
    pollStatus(bookingId);
    statusPollRef.current = setInterval(() => pollStatus(bookingId), 4000);
  };

  const stopPolling = () => {
    if (statusPollRef.current) {
      clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }
  };

  const pollStatus = async (bookingId) => {
    try {
      const res = await axios.get(`/api/api/ambulance/status/${bookingId}`);
      if (res.data && !res.data.error) {
        const data = res.data;
        const state = mapStateRef.current;
        state.targetLat = data.driver_lat;
        state.targetLng = data.driver_lng;
        state.pickupLat = data.pickup_lat;
        state.pickupLng = data.pickup_lng;
        state.status = data.status;

        setActiveBooking(prev => {
          if (!prev) return null;
          return {
            ...prev,
            status: data.status,
            eta_minutes: data.eta_minutes
          };
        });

        if (['completed', 'cancelled'].includes(data.status)) {
          stopPolling();
          if (data.status === 'cancelled') {
            setActiveBooking(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to poll ambulance coordinates:', err);
    }
  };

  // Submit Emergency dispatch
  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!pickupLocation.trim()) {
      alert('Please specify your exact pickup location.');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await axios.post('/api/ambulance-emergency', {
        pickup_location: pickupLocation,
        severity
      });
      if (res.data && res.data.ok) {
        const booking = res.data.booking;
        setActiveBooking(booking);
        
        const state = mapStateRef.current;
        state.pickupLat = booking.pickup_lat;
        state.pickupLng = booking.pickup_lng;
        state.startLat = booking.driver_lat;
        state.startLng = booking.driver_lng;
        state.currentLat = booking.driver_lat;
        state.currentLng = booking.driver_lng;
        state.targetLat = booking.driver_lat;
        state.targetLng = booking.driver_lng;
        state.status = booking.status;
        
        startPolling(booking._id);
      } else {
        alert(res.data.error || 'Failed to dispatch ambulance.');
      }
    } catch (err) {
      console.error(err);
      alert('Error requesting emergency ambulance.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!activeBooking) return;
    if (!window.confirm('Are you sure you want to cancel this critical dispatch response?')) return;

    try {
      const res = await axios.post(`/api/api/ambulance/cancel/${activeBooking._id}`);
      if (res.data && res.data.success) {
        stopPolling();
        setActiveBooking(null);
        alert('Emergency dispatch request cancelled.');
      } else {
        alert(res.data.error || 'Failed to cancel request.');
      }
    } catch (err) {
      console.error(err);
      alert('Error cancelling booking dispatch.');
    }
  };

  // Projection coordinate system
  const project = (lat, lng, w, h) => {
    const state = mapStateRef.current;
    const minLat = Math.min(state.startLat, state.pickupLat) - 0.005;
    const maxLat = Math.max(state.startLat, state.pickupLat) + 0.005;
    const minLng = Math.min(state.startLng, state.pickupLng) - 0.005;
    const maxLng = Math.max(state.startLng, state.pickupLng) + 0.005;

    const margin = 60;
    const x = margin + ((lng - minLng) / (maxLng - minLng)) * (w - 2 * margin);
    const y = h - margin - ((lat - minLat) / (maxLat - minLat)) * (h - 2 * margin);
    return { x, y };
  };

  // Canvas Drawing
  useEffect(() => {
    if (!activeBooking) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const drawMap = () => {
      const w = canvas.width;
      const h = canvas.height;
      const state = mapStateRef.current;

      // Linear easing coordinates update
      state.currentLat += (state.targetLat - state.currentLat) * 0.05;
      state.currentLng += (state.targetLng - state.currentLng) * 0.05;

      // Background Slate
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Draw river crossing topology
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 24;
      ctx.beginPath();
      ctx.moveTo(-20, h * 0.4);
      ctx.bezierCurveTo(w * 0.3, h * 0.3, w * 0.6, h * 0.7, w + 20, h * 0.6);
      ctx.stroke();

      // Faint streets grids
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      const step = 80;
      for (let x = 0; x < w + 50; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, -50);
        ctx.lineTo(x, h + 50);
        ctx.stroke();
      }
      for (let y = 0; y < h + 50; y += step) {
        ctx.beginPath();
        ctx.moveTo(-50, y);
        ctx.lineTo(w + 50, y);
        ctx.stroke();
      }

      // Projections
      const start = project(state.startLat, state.startLng, w, h);
      const end = project(state.pickupLat, state.pickupLng, w, h);
      const current = project(state.currentLat, state.currentLng, w, h);

      // Easing line dashes for routing path
      const midPoint = { x: end.x, y: start.y };
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.lineDashOffset = (Date.now() / 40) % 20;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(midPoint.x, midPoint.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.setLineDash([]); // Reset

      // Pulsating Destination
      state.pulseRadius += 0.25;
      if (state.pulseRadius > 25) state.pulseRadius = 0;
      ctx.fillStyle = `rgba(239, 68, 68, ${1 - state.pulseRadius / 25})`;
      ctx.beginPath();
      ctx.arc(end.x, end.y, state.pulseRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText('🔴 Pickup Point', end.x - 35, end.y - 12);

      // Vehicle Marker
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(current.x, current.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '16px Inter';
      ctx.fillText('🚑', current.x - 9, current.y + 6);
    };

    const loop = () => {
      drawMap();
      animationRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [activeBooking]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #dbeafe', borderTop: '4px solid #ef4444', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '30px 20px' }}>
      
      {/* Title block */}
      <div style={{ 
        background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '30px 36px',
        marginBottom: '28px',
        boxShadow: '0 10px 25px rgba(239, 68, 68, 0.15)'
      }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>🚨 Ambulance Emergency System</h1>
        <p style={{ opacity: 0.9, fontSize: '0.9rem', marginTop: '6px', maxWidth: '600px' }}>Get a high-speed critical response ambulance dispatched to your location. Monitor responders, telemetry status, and ETA countdowns.</p>
      </div>

      {!activeBooking ? (
        // Dispatch Request Screen
        <div className="row g-4">
          <div className="col-lg-7">
            <div className="glass" style={{ padding: '28px' }}>
              <h2 style={{ fontWeight: 800, color: 'var(--text)', fontSize: '1.35rem', marginBottom: '16px' }}>Request Emergency Ambulance</h2>
              
              <form onSubmit={handleDispatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>Exact Pickup Location & Landmarks</label>
                  <textarea 
                    rows="3" 
                    className="form-control"
                    placeholder="e.g. Flat 302, Building A, Rose Heights, near Pune Central Mall, Shivaji Nagar, Pune"
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    required
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '10px' }}>Medical Severity Level</label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div 
                      onClick={() => setSeverity('critical')}
                      style={{ 
                        border: '2px solid',
                        borderColor: severity === 'critical' ? '#ef4444' : '#cbd5e1',
                        background: severity === 'critical' ? '#fef2f2' : '#ffffff',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '4px' }}>🔴</span>
                      <strong style={{ fontSize: '0.85rem', display: 'block', color: severity === 'critical' ? '#ef4444' : '#475569' }}>CRITICAL</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '2px' }}>Chest pain, breathing issue, stroke, trauma, unconsciousness.</span>
                    </div>

                    <div 
                      onClick={() => setSeverity('non-critical')}
                      style={{ 
                        border: '2px solid',
                        borderColor: severity === 'non-critical' ? '#f59e0b' : '#cbd5e1',
                        background: severity === 'non-critical' ? '#fffbeb' : '#ffffff',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span style={{ fontSize: '1.75rem', display: 'block', marginBottom: '4px' }}>🟡</span>
                      <strong style={{ fontSize: '0.85rem', display: 'block', color: severity === 'non-critical' ? '#b45309' : '#475569' }}>NON-CRITICAL</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '2px' }}>Stretcher support, scheduled transfer, fracture, high fever.</span>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={submitLoading}
                  className="btn btn-primary btn-lg w-100"
                  style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', border: 'none', color: '#fff', fontWeight: 800, padding: '14px', borderRadius: '10px' }}
                >
                  {submitLoading ? 'Dispatching Rescue...' : '🔴 Dispatch Rescue Ambulance'}
                </button>
              </form>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="glass" style={{ padding: '24px', background: '#f8fafc', borderStyle: 'dashed' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 10px' }}>🚑 Rescue Fleet Support</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 14px' }}>
                All response vehicles are classified Advanced Life Support (ALS) emergency dispatches, complete with oxygen compressors, telemetry trackers, ventilators, and emergency pharmaceuticals.
              </p>
              <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '16px', lineHeight: '1.8' }}>
                <li>Dispatcher review queue duration: <strong>&lt; 90 seconds</strong></li>
                <li>Qualified Advanced Life Support paramedics on-board</li>
                <li>Continuous GPS feeds shared with target emergency rooms</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        // Active Tracking Screen
        <div className="row g-4">
          <div className="col-lg-8">
            <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid #cbd5e1', height: '450px', background: '#0f172a' }}>
              
              {/* Overlay Badge */}
              <div style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
                <span className="pulse-indicator" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block', animation: 'pulseGlow 1.5s infinite' }}></span>
                <span style={{ textTransform: 'uppercase' }}>
                  {activeBooking.status === 'dispatched' ? 'Dispatching Vehicle' : activeBooking.status === 'enroute' ? 'Vehicle En Route' : 'Vehicle Arrived'}
                </span>
              </div>

              <canvas ref={canvasRef} width="800" height="450" style={{ width: '100%', height: '100%', display: 'block' }}></canvas>
            </div>
          </div>

          <div className="col-lg-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Countdown Card */}
              <div style={{ 
                background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
                color: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'center',
                boxShadow: '0 10px 15px -3px rgba(30, 27, 75, 0.3)'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', opacity: 0.8, textTransform: 'uppercase' }}>Estimated Arrival</span>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '6px 0', color: '#fca5a5' }}>
                  {activeBooking.eta_minutes > 0 ? `${activeBooking.eta_minutes} MINS` : 'ARRIVED'}
                </div>
                <span style={{ fontSize: '0.78rem', opacity: 0.9 }}>Ambulance is responding to your location</span>
              </div>

              {/* Driver Details Card */}
              <div className="glass" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', border: '2px solid #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem' }}>🚑</div>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>{activeBooking.driver_name}</h4>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444' }}>{activeBooking.vehicle_number}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Emergency Responder</span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Pickup Point:</span>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{activeBooking.pickup_location}</strong>
                </div>

                {/* Timeline status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600 }}>
                    <span style={{ color: '#10b981' }}>✔</span>
                    <span style={{ color: '#10b981' }}>Ambulance Dispatched</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600 }}>
                    <span style={{ color: ['enroute', 'arrived'].includes(activeBooking.status) ? '#10b981' : '#94a3b8' }}>
                      {['enroute', 'arrived'].includes(activeBooking.status) ? '✔' : '⏳'}
                    </span>
                    <span style={{ color: activeBooking.status === 'enroute' ? '#ef4444' : ['completed', 'arrived'].includes(activeBooking.status) ? '#10b981' : '#64748b' }}>
                      En Route to Location
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600 }}>
                    <span style={{ color: activeBooking.status === 'arrived' ? '#10b981' : '#94a3b8' }}>
                      {activeBooking.status === 'arrived' ? '✔' : '⏳'}
                    </span>
                    <span style={{ color: activeBooking.status === 'arrived' ? '#10b981' : '#64748b' }}>
                      Arrived at Destination
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <a href={`tel:${activeBooking.driver_phone}`} className="btn btn-primary btn-sm text-center" style={{ width: '100%', display: 'block', padding: '10px 0', textDecoration: 'none', fontWeight: 700 }}>
                    📞 Call Responder ({activeBooking.driver_phone})
                  </a>
                  
                  {activeBooking.status !== 'arrived' && (
                    <button onClick={handleCancelBooking} className="btn-outline-danger" style={{ width: '100%', padding: '10px 0', borderRadius: '10px' }}>
                      Cancel Emergency Request
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Pulsing Keyframe Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulseGlow {
          0% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}} />
    </div>
  );
};

export default AmbulanceEmergency;
