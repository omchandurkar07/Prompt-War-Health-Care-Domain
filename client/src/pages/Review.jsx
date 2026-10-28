import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import DoctorAvatar from '../components/DoctorAvatar';

const Review = () => {
  const { aid } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form State
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchApptDetails = async () => {
    try {
      const res = await axios.get(`/api/review/${aid}`);
      if (res.data && res.data.ok) {
        setData(res.data.appt);
      } else {
        setError(res.data.error || 'This appointment cannot be reviewed at this time.');
      }
    } catch (err) {
      console.error(err);
      setError('Invalid review link or server database mismatch.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApptDetails();
  }, [aid]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setMessage('');
    try {
      const res = await axios.post(`/api/review/${aid}`, {
        rating,
        comment
      });
      if (res.data && res.data.ok) {
        setMessage('🎉 Review submitted successfully! Thank you.');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } else {
        setMessage(`❌ ${res.data.error || 'Failed to submit.'}`);
      }
    } catch (err) {
      console.error(err);
      setMessage('❌ Server connection error submitting review.');
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

  return (
    <div className="container animate-fade-in" style={{ padding: '30px 20px', maxWidth: '500px' }}>
      <div className="glass" style={{ padding: '32px', textAlign: 'center' }}>
        
        <span style={{ fontSize: '3rem' }}>⭐</span>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 850, marginTop: '16px' }}>Rate Your Consultation</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Please share your feedback to help us maintain clinical quality standards.
        </p>

        {message && (
          <div className={`alert ${message.includes('successfully') ? 'alert-success' : 'alert-danger'}`} style={{ padding: '10px 14px', fontSize: '0.85rem', margin: '14px 0' }}>
            {message}
          </div>
        )}

        {/* Doctor Details */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', margin: '20px 0', textAlign: 'left' }}>
          <DoctorAvatar
            src={data.profile_image}
            alt={data.dname || 'Doctor'}
            style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>Dr. {data.dname}</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>{data.specialization}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>Session Date: {data.appt_date} at {data.time_slot}</span>
          </div>
        </div>

        {/* Star Rating Select */}
        <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Consultation Rating</label>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', fontSize: '2rem', cursor: 'pointer' }}>
              {[1, 2, 3, 4, 5].map((starIdx) => {
                const active = starIdx <= (hoverRating || rating);
                return (
                  <span
                    key={starIdx}
                    onMouseEnter={() => setHoverRating(starIdx)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(starIdx)}
                    style={{ color: active ? 'var(--warning)' : '#e2e8f0', transition: 'color 0.15s ease' }}
                  >
                    ★
                  </span>
                );
              })}
            </div>
          </div>

          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '6px' }}>Detailed Comments (Optional)</label>
            <textarea 
              rows="3"
              className="form-control form-control-sm"
              placeholder="Tell us what went well, or what could be improved..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ fontSize: '0.82rem' }}
            />
          </div>

          <button 
            type="submit" 
            disabled={submitLoading}
            className="btn btn-primary btn-sm w-100"
            style={{ padding: '12px', borderRadius: '10px', fontWeight: 800 }}
          >
            {submitLoading ? 'Submitting Review...' : 'Submit Feedback'}
          </button>

        </form>

      </div>
    </div>
  );
};

export default Review;
