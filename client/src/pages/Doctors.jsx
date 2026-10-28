import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import DoctorAvatar from '../components/DoctorAvatar';

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const Doctors = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [doctors, setDoctors] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Map and Route States
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [selectedRouteDocId, setSelectedRouteDocId] = useState(null);

  // Map Refs
  const mapInstance = React.useRef(null);
  const markersGroup = React.useRef(null);
  const routeLine = React.useRef(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');
  const [minExp, setMinExp] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [minRating, setMinRating] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [homeVisitOnly, setHomeVisitOnly] = useState(false);
  const [useGeolocation, setUseGeolocation] = useState(false);
  const [radius, setRadius] = useState(10);
  const [coords, setCoords] = useState({ lat: null, lng: null });

  // Doctor Details Modal
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Dynamic Leaflet CDN Loader
  useEffect(() => {
    if (!document.getElementById('leaflet-css-cdn')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-cdn';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!window.L) {
      const script = document.createElement('script');
      script.id = 'leaflet-js-cdn';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        setLeafletLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      setLeafletLoaded(true);
    }
  }, []);

  // Bind global handler for leaflet popup clicks
  useEffect(() => {
    window.selectRouteDoctor = (docId) => {
      setSelectedRouteDocId(docId);
    };
    return () => {
      delete window.selectRouteDoctor;
    };
  }, []);

  // Synchronize Map Markers
  useEffect(() => {
    if (!leafletLoaded || !window.L) return;
    const L = window.L;

    if (!mapInstance.current) {
      // Default Center Pune
      const startLat = coords.lat || 18.5204;
      const startLng = coords.lng || 73.8567;

      mapInstance.current = L.map('doctors-leaflet-map').setView([startLat, startLng], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      markersGroup.current = L.featureGroup().addTo(mapInstance.current);
    }

    const markers = markersGroup.current;
    markers.clearLayers();

    // 1. User Position
    if (coords.lat && coords.lng) {
      const userIcon = L.divIcon({
        className: 'user-pulse-marker',
        html: `<div style="width:16px; height:16px; background:#2563eb; border:3px solid white; border-radius:50%; box-shadow: 0 0 8px rgba(37,99,235,0.6);"></div>`,
        iconSize: [16, 16]
      });
      L.marker([coords.lat, coords.lng], { icon: userIcon })
        .addTo(markers)
        .bindPopup('<strong>My Location</strong>');
    }

    // 2. Doctor Positions
    doctors.forEach(({ doc }) => {
      if (doc.latitude && doc.longitude) {
        L.marker([doc.latitude, doc.longitude])
          .addTo(markers)
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 0.82rem; min-width: 150px; line-height: 1.4;">
              <strong style="display:block; font-size:0.88rem; color:#1e293b;">Dr. ${doc.full_name}</strong>
              <span style="color:#2563eb; font-weight:600; display:block; margin-bottom:4px;">${doc.specialization}</span>
              <span style="color:var(--text-muted); display:block; font-size:0.75rem;">Clinic: ${doc.hospital_name || 'Clinic'}</span>
              <button 
                onclick="window.selectRouteDoctor('${doc._id}')"
                style="background:#4f46e5; color:white; border:none; padding:5px 10px; border-radius:6px; font-size:0.72rem; margin-top:8px; cursor:pointer; width:100%; font-weight:600;"
              >
                🚗 Calculate Route
              </button>
            </div>
          `);
      }
    });

    if (markers.getLayers().length > 0) {
      mapInstance.current.fitBounds(markers.getBounds(), { padding: [40, 40] });
    }
  }, [leafletLoaded, doctors, coords.lat, coords.lng]);

  // Map and Route States
  const [trafficRoutes, setTrafficRoutes] = useState([]);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [suggestedRoute, setSuggestedRoute] = useState(null);
  const [trafficFactors, setTrafficFactors] = useState(null);

  // Fetch ML Traffic Routes
  useEffect(() => {
    const getTrafficData = async () => {
      const selectedRouteDoc = doctors.find(d => d.doc._id === selectedRouteDocId)?.doc;
      if (!selectedRouteDoc || !coords.lat || !coords.lng) {
        setTrafficRoutes([]);
        setSuggestedRoute(null);
        setTrafficFactors(null);
        return;
      }
      setTrafficLoading(true);
      try {
        const res = await axios.post('/api/ml-traffic-predict', {
          user_lat: coords.lat,
          user_lng: coords.lng,
          dest_lat: selectedRouteDoc.latitude,
          dest_lng: selectedRouteDoc.longitude
        });
        if (res.data && res.data.ok) {
          setTrafficRoutes(res.data.roads || []);
          setSuggestedRoute(res.data.best_route_suggested || null);
          setTrafficFactors(res.data.current_time_factors || null);
        }
      } catch (err) {
        console.error('Error fetching ML traffic prediction:', err);
      } finally {
        setTrafficLoading(false);
      }
    };
    getTrafficData();
  }, [selectedRouteDocId, coords.lat, coords.lng, doctors]);

  // Synchronize Route Polyline
  useEffect(() => {
    if (!leafletLoaded || !window.L || !mapInstance.current) return;
    const L = window.L;

    if (routeLine.current) {
      if (Array.isArray(routeLine.current)) {
        routeLine.current.forEach(line => line.remove());
      } else {
        routeLine.current.remove();
      }
      routeLine.current = null;
    }

    const selectedRouteDoc = doctors.find(d => d.doc._id === selectedRouteDocId)?.doc;
    if (!selectedRouteDoc || !coords.lat || !coords.lng) return;

    const newLines = [];

    if (trafficRoutes.length > 0) {
      // Draw roads from OSM with traffic coloring
      trafficRoutes.forEach(road => {
        const isSuggested = suggestedRoute && road.id === suggestedRoute.id;
        const color = road.density_color || '#6366f1';
        
        const line = L.polyline(road.coordinates, {
          color: color,
          weight: isSuggested ? 6 : 3.5,
          opacity: isSuggested ? 0.95 : 0.6,
          dashArray: isSuggested ? null : '5, 8'
        }).addTo(mapInstance.current);

        // Tooltip displaying density prediction details
        line.bindTooltip(`
          <div style="font-family:sans-serif; font-size:0.75rem; padding:2px;">
            <strong>${road.name || 'Local road'}</strong> (${road.type})<br/>
            Traffic Density: <strong style="color:${color};">${road.density}</strong> (${road.confidence}% confidence)
          </div>
        `, { sticky: true });

        newLines.push(line);
      });

      // Fit map bounds to show all roads
      const bounds = L.featureGroup(newLines).getBounds();
      mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
    } else {
      // Fallback straight line polyline
      if (selectedRouteDoc.latitude && selectedRouteDoc.longitude) {
        const pathPoints = [
          [coords.lat, coords.lng],
          [selectedRouteDoc.latitude, selectedRouteDoc.longitude]
        ];
        const fallbackLine = L.polyline(pathPoints, {
          color: '#6366f1',
          weight: 5,
          dashArray: '8, 12',
          opacity: 0.85
        }).addTo(mapInstance.current);

        newLines.push(fallbackLine);
        mapInstance.current.fitBounds(fallbackLine.getBounds(), { padding: [60, 60] });
      }
    }

    routeLine.current = newLines;

    return () => {
      if (routeLine.current) {
        if (Array.isArray(routeLine.current)) {
          routeLine.current.forEach(line => line.remove());
        } else {
          routeLine.current.remove();
        }
        routeLine.current = null;
      }
    };
  }, [leafletLoaded, selectedRouteDocId, coords.lat, coords.lng, doctors, trafficRoutes, suggestedRoute]);

  // Booking State
  const [showBooking, setShowBooking] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [reason, setReason] = useState('');
  const [apptType, setApptType] = useState('normal');
  const [homeAddress, setHomeAddress] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      let url = `/api/doctors?q=${encodeURIComponent(search)}&spec=${encodeURIComponent(selectedSpec)}&min_exp=${minExp}&max_fee=${maxFee}&min_rating=${minRating}&radius=${radius}`;
      if (availableOnly) {
        url += '&available=1';
      }
      if (homeVisitOnly) {
        url += '&home_visit=1';
      }
      if (useGeolocation && coords.lat && coords.lng) {
        url += `&user_lat=${coords.lat}&user_lng=${coords.lng}`;
      }

      const res = await axios.get(url);
      if (res.data && res.data.ok) {
        setDoctors(res.data.doctors_data || []);
        setSpecs(res.data.specs || []);
        if (res.data.specializations) {
          setSpecializations(res.data.specializations);
        }
      } else {
        setError(res.data.error || 'Failed to load doctors.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error fetching doctors list.');
    } finally {
      setLoading(false);
    }
  };

  // Handle URL Search parameters and sync filter state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryParam = params.get('q') || '';
    const specParam = params.get('spec') || '';
    
    setSearch(queryParam);
    setSelectedSpec(specParam);
    
    const fetchFiltered = async () => {
      setLoading(true);
      try {
        let url = `/api/doctors?q=${encodeURIComponent(queryParam)}&spec=${encodeURIComponent(specParam)}&min_exp=${minExp}&max_fee=${maxFee}&min_rating=${minRating}&radius=${radius}`;
        if (availableOnly) {
          url += '&available=1';
        }
        if (homeVisitOnly) {
          url += '&home_visit=1';
        }
        if (useGeolocation && coords.lat && coords.lng) {
          url += `&user_lat=${coords.lat}&user_lng=${coords.lng}`;
        }

        const res = await axios.get(url);
        if (res.data && res.data.ok) {
          setDoctors(res.data.doctors_data || []);
          setSpecs(res.data.specs || []);
          if (res.data.specializations) {
            setSpecializations(res.data.specializations);
          }
        } else {
          setError(res.data.error || 'Failed to load doctors.');
        }
      } catch (err) {
        console.error(err);
        setError('Server error fetching doctors list.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchFiltered();
  }, [location.search, minExp, maxFee, minRating, availableOnly, homeVisitOnly, useGeolocation, radius]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    navigate(`/doctors?q=${encodeURIComponent(search)}&spec=${encodeURIComponent(selectedSpec)}`);
  };

  const handleGeoLocation = () => {
    if (!useGeolocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCoords({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setUseGeolocation(true);
          },
          (err) => {
            console.error(err);
            alert('Failed to get location: ' + err.message);
          }
        );
      } else {
        alert('Geolocation is not supported by your browser.');
      }
    } else {
      setUseGeolocation(false);
      setCoords({ lat: null, lng: null });
    }
  };

  const viewDoctorDetails = async (docId) => {
    setDetailLoading(true);
    setSelectedDoc(null);
    setReviews([]);
    setShowBooking(false);
    try {
      const res = await axios.get(`/api/doctor/${docId}`);
      if (res.data && res.data.ok) {
        setSelectedDoc(res.data.doctor);
        setReviews(res.data.reviews || []);
      } else {
        alert(res.data.error || 'Doctor details not found.');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching doctor details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const startBooking = async () => {
    if (!selectedDoc) return;
    setShowBooking(true);
    setBookingDate(new Date().toISOString().split('T')[0]);
    setSelectedSlot('');
    setReason('');
    setHomeAddress('');
    setApptType('normal');
    setBookingMessage('');
  };

  const handleBookNowDirect = async (docId) => {
    setDetailLoading(true);
    setSelectedDoc(null);
    setReviews([]);
    try {
      const res = await axios.get(`/api/doctor/${docId}`);
      if (res.data && res.data.ok) {
        setSelectedDoc(res.data.doctor);
        setReviews(res.data.reviews || []);
        setShowBooking(true);
        setBookingDate(new Date().toISOString().split('T')[0]);
        setSelectedSlot('');
        setReason('');
        setHomeAddress('');
        setApptType('normal');
        setBookingMessage('');
      } else {
        alert(res.data.error || 'Doctor details not found.');
      }
    } catch (err) {
      console.error(err);
      alert('Error starting booking process.');
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchSlots = async () => {
    if (!selectedDoc || !bookingDate) return;
    try {
      // Get config details of doctor
      const infoRes = await axios.get(`/api/doctor-info/${selectedDoc._id}`);
      const bookedRes = await axios.get(`/api/booked-slots?doctor_id=${selectedDoc._id}&date=${bookingDate}`);
      
      const allSlots = infoRes.data.slots ? infoRes.data.slots.split(',') : [];
      const bookedSlots = bookedRes.data || [];
      
      // Filter out booked slots
      const available = allSlots.filter(s => !bookedSlots.includes(s));
      setAvailableSlots(available);
    } catch (err) {
      console.error('Error fetching slots', err);
    }
  };

  useEffect(() => {
    if (showBooking && bookingDate) {
      fetchSlots();
    }
  }, [bookingDate, showBooking]);

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      alert('Please select a time slot.');
      return;
    }
    if (apptType === 'home_visit' && !homeAddress.trim()) {
      alert('Please enter the home address for the home visit.');
      return;
    }

    setBookingLoading(true);
    setBookingMessage('');
    try {
      const res = await axios.post(`/api/book/${selectedDoc._id}`, {
        appt_date: bookingDate,
        time_slot: selectedSlot,
        reason,
        appt_type: apptType,
        home_address: homeAddress
      });

      if (res.data && res.data.ok) {
        setSelectedDoc(null);
        setShowBooking(false);
        navigate(res.data.payment_required
          ? `/payment/${res.data.appointment_id}`
          : '/dashboard');
      } else {
        setBookingMessage(`❌ ${res.data.error || 'Booking failed.'}`);
      }
    } catch (err) {
      console.error(err);
      setBookingMessage('❌ Error completing booking registration.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '30px 20px' }}>
      
      {/* Title block */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(16,185,129,0.06))' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0 }}>Find Medical Specialists</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Book physical or video consultations with verified specialists. Filter by specialization, coordinates, ratings, and schedules.</p>
      </div>

      <div className="row g-4">
        {/* Sidebar Filters */}
        <div className="col-lg-3">
          <div className="glass" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>🔍 Search Filters</h3>
            
            <form onSubmit={handleSearchSubmit} className="d-flex flex-column gap-3">
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Keywords</label>
                <input 
                  type="text" 
                  className="form-control form-control-sm" 
                  placeholder="Doctor, hospital, city..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Specialization</label>
                <select 
                  className="form-control form-control-sm"
                  value={selectedSpec}
                  onChange={(e) => setSelectedSpec(e.target.value)}
                >
                  <option value="">All Specializations</option>
                  {(specializations.length > 0 ? specializations : specs).map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Min Experience (Years)</label>
                <input 
                  type="number" 
                  className="form-control form-control-sm" 
                  min="0"
                  placeholder="e.g. 5"
                  value={minExp}
                  onChange={(e) => setMinExp(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Max Consultation Fee</label>
                <input 
                  type="number" 
                  className="form-control form-control-sm" 
                  min="0"
                  placeholder="e.g. 1000"
                  value={maxFee}
                  onChange={(e) => setMaxFee(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Min Rating</label>
                <select 
                  className="form-control form-control-sm"
                  value={minRating}
                  onChange={(e) => setMinRating(e.target.value)}
                >
                  <option value="">Any Rating</option>
                  <option value="4.5">⭐⭐⭐⭐⭐ 4.5+</option>
                  <option value="4.0">⭐⭐⭐⭐ 4.0+</option>
                  <option value="3.5">⭐⭐⭐ 3.5+</option>
                </select>
              </div>

              <div className="form-check" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  id="availableOnly"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="availableOnly" style={{ fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}>Available Now Only</label>
              </div>

              <div className="form-check" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  id="homeVisitOnly"
                  checked={homeVisitOnly}
                  onChange={(e) => setHomeVisitOnly(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="homeVisitOnly" style={{ fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}>Home Visits Only</label>
              </div>

              <hr style={{ margin: '8px 0' }} />

              <div className="form-group">
                <button 
                  type="button" 
                  className={`btn btn-sm ${useGeolocation ? 'btn-success' : 'btn-outline'} w-100`} 
                  onClick={handleGeoLocation}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  📍 {useGeolocation ? 'Location Active' : 'Filter by Distance'}
                </button>
              </div>

              {useGeolocation && (
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Radius: {radius} km</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    value={radius} 
                    onChange={(e) => setRadius(parseInt(e.target.value))}
                    className="w-100"
                  />
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-sm w-100" style={{ marginTop: '8px' }}>
                Apply Filters
              </button>
            </form>
          </div>
        </div>

        {/* Doctors Grid */}
        <div className="col-lg-9">
          
          {/* Interactive Leaflet Map Card */}
          <div className="glass" style={{ padding: '20px', marginBottom: '24px', borderRadius: '24px', background: 'white', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 850, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🗺️</span> Interactive Specialists Map
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '2px 0 0' }}>
                  {useGeolocation && coords.lat && coords.lng 
                    ? 'Showing doctors near you. Click a doctor to show travel route.' 
                    : 'Activate location filter to show distance and calculate route.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={handleGeoLocation} 
                  className={`btn btn-sm ${useGeolocation ? 'btn-success' : 'btn-outline'}`}
                  style={{ borderRadius: '8px', padding: '6px 12px', fontSize: '0.78rem' }}
                >
                  📍 {useGeolocation ? 'Location Active' : 'My Location'}
                </button>
                {selectedRouteDocId && (
                  <button 
                    onClick={() => setSelectedRouteDocId(null)} 
                    className="btn btn-outline btn-sm"
                    style={{ borderRadius: '8px', padding: '6px 12px', fontSize: '0.78rem', color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    Clear Route
                  </button>
                )}
              </div>
            </div>

            {/* Map container */}
            <div 
              id="doctors-leaflet-map" 
              style={{ 
                height: '350px', 
                width: '100%', 
                borderRadius: '16px', 
                border: '1px solid #e2e8f0', 
                zIndex: 1, 
                position: 'relative' 
              }}
            >
              {!leafletLoaded && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: '#f8fafc', borderRadius: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Loading interactive map engine...
                </div>
              )}
            </div>

            {/* Selected Route Info Box & ML Traffic suggestions */}
            {(() => {
              const selectedRouteDoc = doctors.find(d => d.doc._id === selectedRouteDocId)?.doc;
              if (selectedRouteDoc && coords.lat && coords.lng) {
                const distanceVal = getDistance(coords.lat, coords.lng, selectedRouteDoc.latitude, selectedRouteDoc.longitude);
                return (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* Traffic loading overlay */}
                    {trafficLoading && (
                      <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '14px', height: '14px', border: '2px solid #cbd5e1', borderTop: '2px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                        Analyzing real-time road networks & traffic patterns via Random Forest ML...
                      </div>
                    )}

                    <div style={{ padding: '16px 20px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 850, margin: 0, color: '#4c1d95', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          🚗 ML Recommended Route to Dr. {selectedRouteDoc.full_name}
                        </h4>
                        
                        {suggestedRoute ? (
                          <div style={{ marginTop: '6px' }}>
                            <p style={{ fontSize: '0.8rem', color: '#6d28d9', margin: 0 }}>
                              Suggested Road: <strong>{suggestedRoute.name || 'Local Street'}</strong> ({suggestedRoute.type})
                            </p>
                            <p style={{ fontSize: '0.78rem', color: '#7c3aed', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>Density: <strong style={{ color: suggestedRoute.density_color }}>{suggestedRoute.density} Density</strong></span>
                              <span>•</span>
                              <span>Confidence: <strong>{suggestedRoute.confidence}%</strong></span>
                              {trafficFactors && (
                                <>
                                  <span>•</span>
                                  <span>Factors: <strong>Hour {trafficFactors.hour} {trafficFactors.is_rush_hour ? '(Rush Hour)' : '(Off-Peak)'}</strong></span>
                                </>
                              )}
                            </p>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                              Est. Distance: <strong>{Math.round(distanceVal * 100) / 100} km</strong> &nbsp;·&nbsp; Est. Duration: <strong>{Math.ceil(distanceVal * (suggestedRoute.density === 'High' ? 4 : suggestedRoute.density === 'Medium' ? 2.8 : 1.8))} mins</strong>
                            </p>
                          </div>
                        ) : (
                          <p style={{ fontSize: '0.78rem', color: '#6d28d9', margin: '6px 0 0' }}>
                            Direct Distance: <strong>{Math.round(distanceVal * 100) / 100} km</strong> (Approx. travel duration: <strong>{Math.ceil(distanceVal * 2.5)} mins</strong>)
                          </p>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button 
                          onClick={() => handleBookNowDirect(selectedRouteDoc._id)} 
                          className="btn btn-primary btn-sm"
                          style={{ borderRadius: '10px', padding: '8px 16px', fontSize: '0.8rem', backgroundColor: '#6d28d9', border: 'none', fontWeight: 600 }}
                        >
                          Book Appointment
                        </button>
                      </div>
                    </div>

                    {/* Traffic Legend */}
                    {trafficRoutes.length > 0 && (
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', paddingLeft: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '12px', height: '4px', background: '#22c55e', borderRadius: '2px' }}></span> Low Density
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '12px', height: '4px', background: '#f59e0b', borderRadius: '2px' }}></span> Medium Density
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '12px', height: '4px', background: '#ef4444', borderRadius: '2px' }}></span> High Density
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontStyle: 'italic', marginLeft: 'auto' }}>
                          *Hover on any path segment to view street details & confidence index.
                        </span>
                      </div>
                    )}

                  </div>
                );
              }
              return null;
            })()}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
              <div style={{ width: '40px', height: '40px', border: '4px solid #dbeafe', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
          ) : error ? (
            <div className="alert alert-danger">❌ {error}</div>
          ) : doctors.length === 0 ? (
            <div className="glass" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '3rem' }}>🩺</span>
              <h3 style={{ fontSize: '1.25rem', marginTop: '16px' }}>No Doctors Found</h3>
              <p style={{ fontSize: '0.9rem' }}>Try adjusting your search filters or clearing specialized coordinates queries.</p>
            </div>
          ) : (
            <div className="row g-4">
              {doctors.map(({ doc, badges }) => (
                <div key={doc._id} className="col-md-4">
                  <div className="glass h-100" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'transform 0.25s ease, box-shadow 0.25s ease', position: 'relative', borderRadius: '24px', border: '1px solid #e2e8f0', background: 'white' }}>
                    
                    {/* Top Right Available Badge */}
                    <span style={{ 
                      position: 'absolute', 
                      top: '16px', 
                      right: '16px', 
                      fontSize: '0.72rem', 
                      background: doc.is_available ? '#e8f5e9' : '#fee2e2', 
                      color: doc.is_available ? '#2e7d32' : '#b91c1c', 
                      padding: '4px 10px', 
                      borderRadius: '20px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '5px', 
                      fontWeight: 600 
                    }}>
                      <span style={{ 
                        width: '6px', 
                        height: '6px', 
                        background: doc.is_available ? '#2e7d32' : '#ef4444', 
                        borderRadius: '50%' 
                      }}></span>
                      {doc.is_available ? 'Available' : 'Busy'}
                    </span>

                    {/* Top Content (Horizontal) */}
                    <div>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginTop: '10px' }}>
                        {/* Left: Avatar */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <DoctorAvatar
                            src={doc.profile_image}
                            alt={doc.full_name}
                            style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f0f4ff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                          />
                        </div>

                        {/* Right: Info */}
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 2px', color: '#0f172a', textAlign: 'left' }}>Dr. {doc.full_name}</h4>
                          <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 700, display: 'block', marginBottom: '6px', textAlign: 'left' }}>
                            {doc.specialization}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#475569', display: 'block', margin: '2px 0', textAlign: 'left' }}>
                            🏢 {doc.hospital_name || 'Clinic'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textAlign: 'left' }}>
                            📍 {doc.city || 'Pune, Maharashtra'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0 0', borderTop: '1px solid #f1f5f9', paddingTop: '12px', fontSize: '0.8rem', color: '#475569', fontWeight: 550 }}>
                        <span>⭐ {doc.rating_avg ? doc.rating_avg.toFixed(1) : '0.0'}</span>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <span>{doc.experience_years} yrs</span>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <span>₹{doc.consultation_fee}</span>
                      </div>

                      {doc.latitude && doc.longitude && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#6d28d9', background: '#f5f3ff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
                          <span>📍 Distance: <strong>{coords.lat && coords.lng ? `${Math.round(getDistance(coords.lat, coords.lng, doc.latitude, doc.longitude) * 100) / 100} km` : 'Active on map'}</strong></span>
                          {coords.lat && coords.lng && (
                            <button 
                              type="button" 
                              onClick={() => {
                                setSelectedRouteDocId(doc._id);
                                const el = document.getElementById('doctors-leaflet-map');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                              }}
                              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#4f46e5', fontWeight: 700, padding: 0, cursor: 'pointer', fontSize: '0.78rem' }}
                            >
                              Show Route
                            </button>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                        <button 
                          onClick={() => viewDoctorDetails(doc._id)} 
                          className="btn btn-outline btn-sm"
                          style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #cbd5e1', color: '#475569', borderRadius: '10px' }}
                        >
                          View Profile
                        </button>
                        <button 
                          onClick={() => handleBookNowDirect(doc._id)} 
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600, background: '#2563eb', border: 'none', borderRadius: '10px' }}
                        >
                          Book Now
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Doctor Details & Booking Modal */}
      {selectedDoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', pointerEvents: 'auto' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px', pointerEvents: 'auto' }}>
            
            {/* Close Button */}
            <button 
              onClick={() => { setSelectedDoc(null); setShowBooking(false); }} 
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>

            {!showBooking ? (
              <>
                {/* Profile Header */}
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <DoctorAvatar
                    src={selectedDoc.profile_image}
                    alt={`Dr. ${selectedDoc.full_name}`}
                    style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }}
                  />
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>Dr. {selectedDoc.full_name}</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 700, margin: '2px 0 6px' }}>{selectedDoc.specialization}</p>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span>🎓 {selectedDoc.qualification || 'MBBS'}</span>
                      <span>💼 {selectedDoc.experience_years} years exp</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      ⭐ <strong>{selectedDoc.rating_avg.toFixed(1)}</strong> ({selectedDoc.rating_count} reviews)
                    </div>
                  </div>
                </div>

                {/* Bio & Details */}
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px' }}>About Clinical Practice</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>{selectedDoc.bio || 'No details specified.'}</p>
                </div>

                <div className="row g-3">
                  <div className="col-6">
                    <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Consultation Fee</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text)' }}>₹{selectedDoc.consultation_fee}</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Availability Schedule</span>
                      <strong style={{ fontSize: '0.8rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{selectedDoc.available_days}</strong>
                    </div>
                  </div>
                  <div className="col-12">
                    <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Clinic & Hospital Address</span>
                      <strong style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{selectedDoc.hospital_name} — {selectedDoc.clinic_address}, {selectedDoc.city}</strong>
                    </div>
                  </div>
                </div>

                {/* Reviews Section */}
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>Patient Feedback</h4>
                  {reviews.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No reviews registered for this practitioner yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                      {reviews.map(rev => (
                        <div key={rev._id} style={{ padding: '10px', background: 'rgba(241,245,249,0.5)', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.8rem' }}>{rev.patient_id?.full_name || 'Patient'}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>{'★'.repeat(rev.rating)}</span>
                          </div>
                          {rev.comment && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>"{rev.comment}"</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button onClick={() => setSelectedDoc(null)} className="btn btn-ghost btn-sm">Close</button>
                  <button onClick={startBooking} className="btn btn-primary btn-sm">📅 Schedule Consultation</button>
                </div>
              </>
            ) : (
              // Booking Form Screen
              <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📅 Book Consultation with Dr. {selectedDoc.full_name}
                </h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Your appointment is booked immediately; payment follows booking.
                </p>
                
                {bookingMessage && (
                  <div className={`alert ${bookingMessage.includes('successful') ? 'alert-success' : 'alert-danger'}`} style={{ padding: '10px 14px', fontSize: '0.85rem' }}>
                    {bookingMessage}
                  </div>
                )}

                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Choose Date</label>
                      <input 
                        type="date" 
                        className="form-control form-control-sm"
                        min={new Date().toISOString().split('T')[0]}
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Consultation Mode</label>
                      <select 
                        className="form-control form-control-sm"
                        value={apptType}
                        onChange={(e) => setApptType(e.target.value)}
                      >
                        <option value="normal">Normal Out-Patient (OPD)</option>
                        <option value="video">Virtual Consultation (Video/Chat)</option>
                        {selectedDoc?.home_visit_available && <option value="home_visit">Doctor Home Visit</option>}
                        <option value="emergency">Emergency Immediate Consultation</option>
                      </select>
                      {selectedDoc?.home_visit_available && (
                        <p style={{ margin: '6px 0 0', color: '#15803d', fontSize: '0.78rem' }}>
                          Home visit available for ₹{(typeof selectedDoc.home_visit_fee === 'number' && selectedDoc.home_visit_fee > 0) ? selectedDoc.home_visit_fee : selectedDoc.consultation_fee + 300}.
                        </p>
                      )}
                    </div>
                  </div>

                  {apptType === 'home_visit' && selectedDoc?.home_visit_available && (
                    <div className="col-12">
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Home Visit Address</label>
                        <textarea
                          className="form-control"
                          rows="2"
                          placeholder="Enter the address where the doctor should visit"
                          value={homeAddress}
                          onChange={(e) => setHomeAddress(e.target.value)}
                          style={{ fontSize: '0.82rem' }}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="col-12">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Available Slots</label>
                      {availableSlots.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, padding: '10px', background: '#fff5f5', borderRadius: '8px', border: '1px solid #fecaca' }}>
                          ⚠️ No slots available on this date. Please select another date.
                        </p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', maxHeight: '140px', overflowY: 'auto', padding: '4px' }}>
                          {availableSlots.map(slot => (
                            <button
                              key={slot}
                              type="button"
                              className={`btn btn-sm ${selectedSlot === slot ? 'btn-primary' : 'btn-outline'}`}
                              style={{ padding: '6px', fontSize: '0.78rem' }}
                              onClick={() => setSelectedSlot(slot)}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Reason for Consultation (Optional)</label>
                      <textarea 
                        className="form-control"
                        rows="2"
                        placeholder="Describe your symptoms briefly..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        style={{ fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowBooking(false)} 
                    className="btn btn-ghost btn-sm"
                    disabled={bookingLoading}
                  >
                    Back to Details
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-sm"
                    disabled={bookingLoading || availableSlots.length === 0 || (apptType === 'home_visit' && !homeAddress.trim())}
                  >
                    {bookingLoading ? 'Scheduling...' : `Confirm Booking (₹${apptType === 'home_visit' ? ((typeof selectedDoc?.home_visit_fee === 'number' && selectedDoc.home_visit_fee > 0) ? selectedDoc.home_visit_fee : selectedDoc.consultation_fee + 300) : selectedDoc?.consultation_fee})`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Spacing element */}
      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default Doctors;
