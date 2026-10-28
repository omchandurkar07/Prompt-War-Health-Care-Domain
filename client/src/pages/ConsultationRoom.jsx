import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ConsultationRoom = () => {
  const { aid } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isVideo = pathname.includes('/video/');
  const isFollowup = pathname.includes('/messages/');
  const { user, role } = useAuth();

  const [appt, setAppt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const chatPollRef = useRef(null);

  // Video call UI simulation states
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);

  const fetchChatHistory = useCallback(async () => {
    try {
      const res = await axios.get(`/api/api/chat/history/${aid}`);
      if (res.data && res.data.messages) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.error('Failed to load chat history', err);
    }
  }, [aid]);

  const fetchRoomData = useCallback(async () => {
    try {
      const endpoint = isFollowup
        ? `/api/consultation/messages/${aid}`
        : `/api/consultation/${isVideo ? 'video' : 'chat'}/${aid}`;
      const res = await axios.get(endpoint);
      if (res.data && res.data.ok) {
        setAppt(res.data.appt);
        fetchChatHistory();
        // Start polling chat history every 3s
        chatPollRef.current = setInterval(fetchChatHistory, 3000);
      } else {
        setError(res.data.error || 'Failed to authorize consult room.');
      }
    } catch (err) {
      console.error(err);
      setError('You are not authorized to join this clinical consultation room.');
    } finally {
      setLoading(false);
    }
  }, [aid, fetchChatHistory, isFollowup, isVideo]);

  useEffect(() => {
    fetchRoomData();
    return () => {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    };
  }, [fetchRoomData]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;

    setChatLoading(true);
    try {
      const res = await axios.post(`/api/api/chat/send/${aid}`, {
        message: typedMessage
      });
      if (res.data && res.data.ok) {
        setTypedMessage('');
        fetchChatHistory();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to transmit message.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!window.confirm('Are you sure you want to end this clinical session?')) return;
    try {
      const res = await axios.get(`/api/consultation/complete/${aid}`);
      if (res.data && res.data.ok) {
        if (role === 'patient') {
          navigate(`/review/${aid}`);
        } else {
          // Doctors write care plans
          navigate(`/doctor/dashboard`);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error closing session.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #dbeafe', borderTop: '4px solid #ef4444', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
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
    <div className="container animate-fade-in" style={{ padding: '20px', maxWidth: '1100px' }}>
      
      {/* Title bar */}
      <div className="glass" style={{ padding: '16px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '0.68rem', background: '#fee2e2', color: '#b91c1c', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>🚨 LIVE CLINICAL ROOM</span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 0' }}>Consultation Room</h2>
        </div>
        {!isFollowup && (
          <button onClick={handleEndSession} className="btn btn-danger btn-sm" style={{ background: '#ef4444' }}>
            🛑 End Consultation Session
          </button>
        )}
      </div>

      <div className="row g-4">
        {/* Left Side: Chat Feed (always visible) */}
        <div className={isVideo ? 'col-lg-4' : 'col-lg-12'}>
          <div className="glass" style={{ height: '520px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px' }}>
            
            {/* Chat header */}
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '10px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>
                {isFollowup ? '💬 Appointment follow-up messages' : '💬 Live Practitioner Consultation Chat'}
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Only the patient and doctor on this appointment can view these messages. For urgent symptoms, contact emergency services.
              </span>
            </div>

            {/* Chat Feed list */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px', marginBottom: '14px' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  No messages logged in room. Write a message below to start consultation.
                </div>
              ) : (
                messages.map(msg => {
                  const isSelf = msg.sender_id === (user?.id || user?._id);
                  return (
                    <div 
                      key={msg.id} 
                      style={{ 
                        alignSelf: isSelf ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div style={{ 
                        padding: '10px 14px', 
                        borderRadius: '12px', 
                        background: isSelf ? 'var(--primary)' : '#f1f5f9',
                        color: isSelf ? '#fff' : 'var(--text)',
                        fontSize: '0.82rem',
                        lineHeight: 1.4
                      }}>
                        {msg.message}
                      </div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', alignSelf: isSelf ? 'flex-end' : 'flex-start', marginTop: '2px', padding: '0 2px' }}>
                        {msg.sender_name} · {msg.timestamp}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef}></div>
            </div>

            {/* Chat input box */}
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="Type your medical query..."
                className="form-control form-control-sm"
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                maxLength={2000}
                disabled={chatLoading}
                required
              />
              <button type="submit" disabled={chatLoading || !typedMessage.trim()} className="btn btn-primary btn-sm">Send</button>
            </form>

          </div>
        </div>

        {/* Right Side: Simulated Video call wrapper */}
        {isVideo && (
          <div className="col-lg-8 animate-fade-in">
            <div className="glass" style={{ height: '520px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#0f172a', border: '1px solid #1e293b' }}>
              
              {/* Screen Stream Wrapper */}
              <div style={{ flex: 1, position: 'relative', background: '#1e293b', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                
                {/* Simulated Doc Stream */}
                {cameraActive ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '8px' }}>👨‍⚕️</span>
                    <strong style={{ fontSize: '1rem', color: '#fff', display: 'block' }}>Dr. {appt?.doctor_id?.full_name || 'Practitioner'}</strong>
                    <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>Streaming Live Video Link...</span>
                  </div>
                ) : (
                  <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>⚠️ Practitioner has turned camera off</div>
                )}

                {/* Simulated Local PIP Stream */}
                <div style={{ 
                  position: 'absolute', 
                  bottom: '16px', 
                  right: '16px', 
                  width: '120px', 
                  height: '90px', 
                  background: '#0f172a', 
                  border: '1.5px solid #cbd5e1', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justify: 'center', 
                  fontSize: '0.75rem', 
                  color: '#fff' 
                }}>
                  {micActive ? '👤 You (Live)' : '👤 You (Muted)'}
                </div>
              </div>

              {/* Call Controls block */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginTop: '16px' }}>
                <button 
                  onClick={() => setMicActive(!micActive)} 
                  className={`btn ${micActive ? 'btn-outline' : 'btn-danger'} btn-sm`}
                  style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: '#3b82f6', color: micActive ? '#3b82f6' : '#fff' }}
                  title={micActive ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {micActive ? '🎙️' : '🔇'}
                </button>

                <button 
                  onClick={() => setCameraActive(!cameraActive)} 
                  className={`btn ${cameraActive ? 'btn-outline' : 'btn-danger'} btn-sm`}
                  style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: '#3b82f6', color: cameraActive ? '#3b82f6' : '#fff' }}
                  title={cameraActive ? 'Stop Camera' : 'Start Camera'}
                >
                  {cameraActive ? '📹' : '🚫'}
                </button>

                <button 
                  onClick={handleEndSession} 
                  className="btn btn-danger btn-sm"
                  style={{ background: '#ef4444', borderRadius: '20px', padding: '0 20px', height: '40px' }}
                >
                  📞 Hang Up
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default ConsultationRoom;
