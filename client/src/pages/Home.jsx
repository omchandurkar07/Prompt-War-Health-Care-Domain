import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import axios from 'axios';
import DoctorAvatar from '../components/DoctorAvatar';

const Home = () => {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('/api/');
        if (res.data && res.data.ok) {
          setFeatured(res.data.featured || []);
          setTestimonials(res.data.testimonials || []);
        }
      } catch (err) {
        console.error('Failed to fetch home page data', err);
      }
    };
    fetchData();
  }, []);

  const handleSearchChange = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim().length >= 2) {
      try {
        const res = await axios.get(`/api/search-suggestions?q=${encodeURIComponent(q)}`);
        setSuggestions(res.data || []);
      } catch (err) {
        console.error(err);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/doctors?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const selectSuggestion = (s) => {
    navigate(`/doctors?q=${encodeURIComponent(s.full_name)}`);
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg"></div>

        <div className="container hero-content">
          <div className="hero-copy">
            <div className="hero-badge">🧬 &nbsp;Your Trusted Healthcare Partner</div>
            <h1 style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
              Smart Healthcare,<br />
              <span style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>Simplified.</span>
            </h1>
            <p className="hero-sub" style={{ fontSize: '0.95rem', color: '#64748b', margin: '0 0 24px', maxWidth: '480px', lineHeight: 1.65 }}>
              Book verified doctors, manage prescriptions, track your health journey — all from one modern platform built for you.
            </p>

            <div style={{ position: 'relative', maxWidth: '540px', zIndex: 10 }}>
              <form onSubmit={handleSearchSubmit} className="hero-search-form">
                <div className="hero-search-input-shell">
                  <Search size={18} aria-hidden="true" className="hero-search-icon" />
                  <input
                    type="text"
                    placeholder="Search doctor, specialization, or city..."
                    aria-label="Search doctors by name, specialization, or city"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="hero-search-input"
                    required
                  />
                  <button
                    type="button"
                    className="hero-search-clear"
                    aria-label="Clear doctor search"
                    onClick={() => {
                      setSearchQuery('');
                      setSuggestions([]);
                    }}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                <button type="submit" className="btn btn-primary hero-search-btn">Find Doctors</button>
              </form>

              {suggestions.length > 0 && (
                <div className="glass animate-fade-in-up" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '8px',
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  borderRadius: '16px',
                  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.1)',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  padding: '8px 0'
                }}>
                  {suggestions.map((s) => (
                    <div
                      key={s._id}
                      onClick={() => selectSuggestion(s)}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        borderBottom: '1px solid rgba(0,0,0,0.02)',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(79, 70, 229, 0.06)'; e.currentTarget.style.color = '#4f46e5'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'inherit'; }}
                    >
                      <strong style={{ fontSize: '0.92rem' }}>{s.full_name}</strong>
                      <span style={{ fontSize: '0.76rem', color: '#64748b' }}>{s.specialization} • {s.hospital_name || s.clinic_address || 'Clinic'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="hero-tags" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.88rem', color: '#64748b' }}>Popular:</span>
              <Link to="/doctors?spec=General%20Physician" style={{ fontSize: '0.82rem', background: 'white', border: '1px solid #e2e8f0', padding: '6px 14px', borderRadius: '20px', color: '#475569', fontWeight: 500 }}>General Physician</Link>
              <Link to="/doctors?spec=Dermatologist" style={{ fontSize: '0.82rem', background: 'white', border: '1px solid #e2e8f0', padding: '6px 14px', borderRadius: '20px', color: '#475569', fontWeight: 500 }}>Dermatologist</Link>
              <Link to="/doctors?spec=Cardiologist" style={{ fontSize: '0.82rem', background: 'white', border: '1px solid #e2e8f0', padding: '6px 14px', borderRadius: '20px', color: '#475569', fontWeight: 500 }}>Cardiologist</Link>
              <Link to="/symptom-checker" style={{ fontSize: '0.82rem', background: 'white', border: '1px solid #e2e8f0', padding: '6px 14px', borderRadius: '20px', color: '#475569', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                💓 Symptom Checker
              </Link>
            </div>
          </div>

          <div className="hero-visual" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignContent: 'center' }}>
            <div className="glass animate-fade-in-up" style={{ padding: '24px 20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(79, 70, 229, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🩺</div>
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 2px', color: '#0f172a' }}>Verified Doctors</h4>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Approved specialists only</p>
              </div>
            </div>

            <div className="glass animate-fade-in-up" style={{ padding: '24px 20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(124, 58, 237, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>📅</div>
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 2px', color: '#0f172a' }}>Instant Booking</h4>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Real-time availability</p>
              </div>
            </div>

            <div className="glass animate-fade-in-up" style={{ padding: '24px 20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>💊</div>
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 2px', color: '#0f172a' }}>Digital Prescriptions</h4>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Stored securely</p>
              </div>
            </div>

            <div className="glass animate-fade-in-up" style={{ padding: '24px 20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🔔</div>
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 2px', color: '#0f172a' }}>Smart Alerts</h4>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Never miss updates</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section doctors-section" style={{ padding: '24px 0' }}>
        <div className="container">
          <div className="section-heading">
            <h2 className="section-title">Meet top doctors</h2>
          </div>

          <div className="doctor-grid">
            {featured.length > 0 ? (
              featured.map(({ doc }) => (
                <div key={doc._id} className="doctor-card">
                  <div className="doctor-card-image">
                    <DoctorAvatar src={doc.profile_image} alt={doc.full_name} className="doctor-avatar" />
                  </div>

                  <div className="doctor-info">
                    <h4>{doc.full_name}</h4>
                    <span>{doc.specialization}</span>
                    <p style={{ marginTop: '6px' }}>{doc.hospital_name || doc.clinic_address || 'Verified healthcare partner'}</p>
                  </div>

                  <div className="doctor-card-meta">
                    <span>{doc.experience_years ? `${doc.experience_years} yrs experience` : 'Experienced'} </span>
                    <Link to={`/doctors?spec=${encodeURIComponent(doc.specialization)}`} className="btn btn-outline btn-sm doctor-book-btn">
                      Book now
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="doctor-card doctor-empty-card">
                No featured doctors available right now.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section" style={{ padding: '24px 0' }}>
        <div className="container">
          <div className="section-heading" style={{ textAlign: 'center', alignItems: 'center', marginBottom: '28px' }}>
            <h2 className="section-title">What We Offer</h2>
            <p className="section-sub" style={{ color: '#64748b', fontSize: '0.96rem', marginTop: '6px' }}>Everything you need for a seamless healthcare experience</p>
          </div>

          <div className="service-grid">
            <div className="offer-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--primary)' }}>🗓️</div>
              <h4>Easy Appointment Booking</h4>
              <p>Search specialists, compare fees and book confirmed slots in seconds.</p>
            </div>
            <div className="offer-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed' }}>🤖</div>
              <h4>AI Symptom Analyzer</h4>
              <p>Get fast symptom guidance, specialist recommendations and urgency signals.</p>
            </div>
            <div className="offer-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>🧾</div>
              <h4>AI-Powered Prescriptions</h4>
              <p>Receive clinician-reviewed prescriptions with digital access and summaries.</p>
            </div>
            <div className="offer-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(249, 115, 22, 0.08)', color: '#f97316' }}>🗄️</div>
              <h4>Smart Health Locker</h4>
              <p>Store reports, records and prescriptions in a secure patient vault.</p>
            </div>
            <div className="offer-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(14, 165, 233, 0.08)', color: '#0ea5e9' }}>💊</div>
              <h4>Healing & Care Plans</h4>
              <p>Track care routines, medication reminders and progress steps in one place.</p>
            </div>
            <div className="offer-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(192, 132, 252, 0.08)', color: '#c084fc' }}>👨‍👩‍👧</div>
              <h4>Family Health Manager</h4>
              <p>Keep records for dependents, immunizations and appointments together.</p>
            </div>
            <div className="offer-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(14, 165, 233, 0.08)', color: '#0284c7' }}>🛡️</div>
              <h4>Preventive Screenings</h4>
              <p>Manage wellness checks, alerts and follow-up reminders proactively.</p>
            </div>
            <div className="offer-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(20, 184, 166, 0.08)', color: '#14b8a6' }}>⏱️</div>
              <h4>Live Queue Tracking</h4>
              <p>Monitor wait times and appointment progress in real time.</p>
            </div>
            <div className="offer-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(249, 115, 22, 0.08)', color: '#f97316' }}>🧾</div>
              <h4>Pre-Visit Telemetry Prep</h4>
              <p>Share symptoms, vitals and notes before your consultation.</p>
            </div>
            <div className="offer-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#059669' }}>📈</div>
              <h4>Vitals Tracker & Logbook</h4>
              <p>Record blood pressure, glucose and health metrics over time.</p>
            </div>
            <div className="offer-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6' }}>🚑</div>
              <h4>Ambulance Emergency Dispatch</h4>
              <p>Request urgent transport and track crew status from the app.</p>
            </div>
            <div className="offer-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#2563eb' }}>🏥</div>
              <h4>Doctor Home Visits</h4>
              <p>Book qualified practitioners for medical care at your doorstep.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Health Managed */}
      <section className="section" style={{ backgroundColor: '#f0fdf4', padding: '26px 0' }}>
        <div className="container">
          <div className="section-heading">
            <h2 className="section-title">Your Health, Fully Managed</h2>
          </div>

          <div className="health-managed-grid">
            <div className="health-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)', color: 'var(--primary)' }}>📄</div>
              <h4>Store Prescriptions</h4>
              <p>Every prescription from your doctor is saved to your profile for easy access.</p>
            </div>
            <div className="health-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed' }}>📚</div>
              <h4>Track Medical History</h4>
              <p>See past appointments, doctor notes and treatment timelines in one place.</p>
            </div>
            <div className="health-card">
              <div className="icon-wrap" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>🔔</div>
              <h4>Manage Follow-ups</h4>
              <p>Set reminders, view next steps and stay on schedule for ongoing care.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section" style={{ padding: '28px 0' }}>
        <div className="container">
          <div className="section-heading">
            <h2 className="section-title">How It Works</h2>
          </div>

          <div className="steps-grid">
            <div className="step-card" data-step="01">
              <div className="step-icon">🔍</div>
              <h3>Search & Discover</h3>
              <p>Find specialists by symptoms, ratings, location and availability.</p>
            </div>
            <div className="step-card" data-step="02">
              <div className="step-icon">📅</div>
              <h3>Book Your Slot</h3>
              <p>Pick a time, confirm your consultation and get instant schedule details.</p>
            </div>
            <div className="step-card" data-step="03">
              <div className="step-icon">✅</div>
              <h3>Get Treated & Tracked</h3>
              <p>Attend your visit, receive prescriptions and monitor recovery from the app.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {testimonials.length > 0 && (
        <section className="section" style={{ backgroundColor: '#f8fafc', padding: '24px 0' }}>
          <div className="container">
            <h2 className="section-title">What Our Patients Say</h2>
            <p className="section-sub">Real stories of health and healing from verified users</p>

            <div className="row g-4 justify-content-center" style={{ marginTop: '16px' }}>
              {testimonials.map(t => (
                <div key={t._id} className="col-md-4">
                  <div className="testimonial-card">
                    <div style={{ color: 'var(--warning)', marginBottom: '10px' }}>
                      {'⭐'.repeat(t.rating)}
                    </div>
                    <p style={{ fontStyle: 'italic', fontSize: '0.92rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                      "{t.comment}"
                    </p>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>- {t.name}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Call to Action */}
      <section className="section cta-section">
        <div className="container">
          <div className="glass row align-items-center" style={{ padding: '28px', margin: '0' }}>
            <div className="col-md-8">
              <h2>Are you a Medical Professional?</h2>
              <p style={{ color: 'var(--text-muted)' }}>
                Register your clinic, connect with patients in need of specialized treatment, use clinical decision assistance logs, and write AI-parsed scanned prescriptions.
              </p>
            </div>
            <div className="col-md-4 text-md-end">
              <Link to="/register?type=doctor" className="btn btn-primary btn-lg">Join as a Doctor</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
