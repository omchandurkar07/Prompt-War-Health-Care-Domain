import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import DoctorAvatar from '../components/DoctorAvatar';

const MyPrescriptions = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPrescriptions = async () => {
      try {
        const response = await axios.get('/api/patient/prescriptions');
        if (!response.data?.ok) {
          throw new Error(response.data?.error || 'Unable to load prescriptions.');
        }
        setPrescriptions(response.data.prescriptions || []);
      } catch (requestError) {
        console.error('Prescription history request failed:', requestError);
        setError(requestError.response?.data?.error || requestError.message || 'Unable to load prescription history.');
      } finally {
        setLoading(false);
      }
    };

    loadPrescriptions();
  }, []);

  const filteredPrescriptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const cutoff = new Date();
    if (dateFilter === '30') cutoff.setDate(cutoff.getDate() - 30);
    if (dateFilter === '365') cutoff.setDate(cutoff.getDate() - 365);

    return prescriptions
      .filter((rx) => {
        if (dateFilter !== 'all' && new Date(rx.created_at) < cutoff) return false;
        if (!normalizedSearch) return true;

        const searchableText = [
          rx.prescription_id,
          rx.diagnosis,
          rx.diagnosis_notes,
          rx.dname,
          rx.specialization,
          rx.family_member_name,
          ...(rx.medicines || []).map((medicine) => medicine.name),
        ].join(' ').toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const dateDifference = new Date(b.created_at) - new Date(a.created_at);
        return sortOrder === 'newest' ? dateDifference : -dateDifference;
      });
  }, [prescriptions, search, dateFilter, sortOrder]);

  if (loading) {
    return (
      <div className="container" style={{ padding: '56px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading your prescriptions...
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '1000px', padding: '36px 20px 56px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div>
          <Link to="/dashboard" style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 700 }}>← Patient dashboard</Link>
          <h1 style={{ margin: '10px 0 4px', fontSize: '1.8rem', fontWeight: 800 }}>My Prescriptions</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Your complete prescription history, saved securely in your account.
          </p>
        </div>
        <div className="glass" style={{ padding: '12px 18px', borderRadius: '14px', color: '#5b21b6', fontWeight: 800 }}>
          {prescriptions.length} {prescriptions.length === 1 ? 'prescription' : 'prescriptions'}
        </div>
      </div>

      <div className="glass" style={{ padding: '16px', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          Search prescriptions
          <input
            type="search"
            className="form-control"
            placeholder="Doctor, medicine, diagnosis..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          Date range
          <select className="form-control" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
            <option value="all">Any time</option>
            <option value="30">Last 30 days</option>
            <option value="365">Last year</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          Sort by
          <select className="form-control" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {!error && filteredPrescriptions.length === 0 && (
        <div className="glass" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem' }}>📄</div>
          <h2 style={{ margin: '8px 0', fontSize: '1.2rem' }}>
            {prescriptions.length ? 'No prescriptions match these filters' : 'No prescriptions yet'}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '18px' }}>
            {prescriptions.length
              ? 'Try another search or date range.'
              : 'When a doctor issues you a prescription, it will be available here and on your dashboard.'}
          </p>
          {prescriptions.length === 0 && <Link to="/doctors" className="btn btn-primary btn-sm">Find a doctor</Link>}
        </div>
      )}

      <div style={{ display: 'grid', gap: '14px' }}>
        {filteredPrescriptions.map((rx) => (
          <article key={rx._id} className="glass" style={{ padding: '18px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                <DoctorAvatar
                  src={rx.profile_image}
                  alt={rx.dname}
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <strong style={{ display: 'block' }}>{rx.dname.startsWith('Dr.') ? rx.dname : `Dr. ${rx.dname}`}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{rx.specialization || 'Treating doctor'}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <strong style={{ display: 'block', color: '#5b21b6' }}>{rx.prescription_id}</strong>
                {new Date(rx.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>

            <div style={{ margin: '16px 0 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Diagnosis</span>
                <strong>{rx.diagnosis || rx.diagnosis_notes || 'Not specified'}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Medicines</span>
                <strong>{(rx.medicines || []).length} prescribed</strong>
                {(rx.medicines || []).length > 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '3px' }}>
                    {rx.medicines.slice(0, 3).map((medicine) => medicine.name).join(', ')}
                    {rx.medicines.length > 3 ? ` +${rx.medicines.length - 3} more` : ''}
                  </div>
                )}
              </div>
              {rx.family_member_name && (
                <div>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>For family member</span>
                  <strong>{rx.family_member_name}</strong>
                </div>
              )}
              {rx.follow_up_date && (
                <div>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Follow-up</span>
                  <strong>{rx.follow_up_date}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <Link to={`/prescriptions/${rx._id}`} className="btn btn-primary btn-sm">View full prescription</Link>
              <a href={`/api/prescriptions/${rx._id}/download/`} className="btn btn-outline btn-sm" download>Download PDF</a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default MyPrescriptions;
