import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const Family = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add Member Modal & Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    dob: '',
    relation: 'Spouse',
    gender: 'Male',
    blood_group: 'A+',
    allergies: '',
    chronic_conditions: ''
  });
  const [profileImage, setProfileImage] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addMessage, setAddMessage] = useState('');

  // Edit Member State
  const [editingMember, setEditingMember] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    dob: '',
    relation: '',
    gender: '',
    blood_group: '',
    allergies: '',
    chronic_conditions: ''
  });
  const [editLoading, setEditLoading] = useState(false);

  const fetchFamily = async () => {
    try {
      const res = await axios.get('/api/family');
      if (res.data && res.data.ok) {
        setData(res.data);
      } else {
        setError(res.data.error || 'Failed to load family circle.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error loading family data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamily();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) {
      alert('Please enter a name.');
      return;
    }

    setAddLoading(true);
    setAddMessage('');

    const formData = new FormData();
    if (profileImage) {
      formData.append('profile_image', profileImage);
    }
    formData.append('name', addForm.name);
    formData.append('dob', addForm.dob);
    formData.append('relation', addForm.relation);
    formData.append('gender', addForm.gender);
    formData.append('blood_group', addForm.blood_group);
    formData.append('allergies', addForm.allergies);
    formData.append('chronic_conditions', addForm.chronic_conditions);

    try {
      const res = await axios.post('/api/family/add', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.ok) {
        setAddMessage('🎉 Family member added successfully!');
        setAddForm({
          name: '',
          dob: '',
          relation: 'Spouse',
          gender: 'Male',
          blood_group: 'A+',
          allergies: '',
          chronic_conditions: ''
        });
        setProfileImage(null);
        setTimeout(() => {
          setShowAddModal(false);
          setAddMessage('');
          fetchFamily();
        }, 1500);
      } else {
        setAddMessage(`❌ ${res.data.error || 'Failed to add member.'}`);
      }
    } catch (err) {
      console.error(err);
      setAddMessage('❌ Error adding family member.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleStartEdit = (member) => {
    setEditingMember(member);
    setEditForm({
      name: member.name,
      dob: member.dob ? member.dob.split('T')[0] : '',
      relation: member.relation,
      gender: member.gender,
      blood_group: member.blood_group,
      allergies: member.allergies,
      chronic_conditions: member.chronic_conditions
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await axios.post(`/api/family/edit/${editingMember._id}`, editForm);
      if (res.data && res.data.ok) {
        setEditingMember(null);
        fetchFamily();
      } else {
        alert(res.data.error || 'Failed to edit member.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating member details.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteMember = async (mid) => {
    if (!window.confirm('Are you sure you want to remove this family member? All associated vaccination logs will be deleted.')) return;
    try {
      const res = await axios.post(`/api/family/delete/${mid}`);
      if (res.data && res.data.ok) {
        fetchFamily();
      } else {
        alert(res.data.error || 'Failed to delete member.');
      }
    } catch (err) {
      console.error(err);
      alert('Error removing family member profile.');
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

  const { members = [] } = data || {};

  return (
    <div className="container" style={{ padding: '30px 20px' }}>
      
      {/* Header Block */}
      <div className="glass" style={{ padding: '24px 32px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(124,58,237,0.06))' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0 }}>Family Healthcare Circles</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Add dependents to manage vaccination schedules, book clinical appointments, and maintain health records locker channels.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
          ➕ Add Dependent Member
        </button>
      </div>

      {members.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '3rem' }}>👨‍👩‍👧‍👦</span>
          <h3 style={{ fontSize: '1.25rem', marginTop: '16px' }}>Your Family Circle is Empty</h3>
          <p style={{ fontSize: '0.9rem' }}>Add child vaccination plans or aging parents to manage their records seamlessly.</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-outline btn-sm" style={{ marginTop: '16px' }}>Add First Dependent</button>
        </div>
      ) : (
        <div className="row g-4">
          {members.map(({ member, age, appts }) => {
            const isEditing = editingMember && editingMember._id === member._id;
            return (
              <div key={member._id} className="col-md-6 col-lg-4">
                <div className="glass h-100" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', border: '1px solid var(--border)' }}>
                  
                  {isEditing ? (
                    // Edit Form
                    <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 10px' }}>Edit Dependents</h4>
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        value={editForm.name} 
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                        required 
                      />
                      <input 
                        type="date" 
                        className="form-control form-control-sm" 
                        value={editForm.dob} 
                        onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })} 
                      />
                      <select 
                        className="form-control form-control-sm" 
                        value={editForm.relation} 
                        onChange={(e) => setEditForm({ ...editForm, relation: e.target.value })}
                      >
                        <option value="Spouse">Spouse</option>
                        <option value="Child">Child</option>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Other">Other</option>
                      </select>
                      <select 
                        className="form-control form-control-sm" 
                        value={editForm.gender} 
                        onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      <input 
                        type="text" 
                        placeholder="Allergies" 
                        className="form-control form-control-sm" 
                        value={editForm.allergies} 
                        onChange={(e) => setEditForm({ ...editForm, allergies: e.target.value })} 
                      />
                      <input 
                        type="text" 
                        placeholder="Chronic Conditions" 
                        className="form-control form-control-sm" 
                        value={editForm.chronic_conditions} 
                        onChange={(e) => setEditForm({ ...editForm, chronic_conditions: e.target.value })} 
                      />
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '10px' }}>
                        <button type="button" onClick={() => setEditingMember(null)} className="btn btn-ghost btn-xs">Cancel</button>
                        <button type="submit" disabled={editLoading} className="btn btn-primary btn-xs">Save</button>
                      </div>
                    </form>
                  ) : (
                    // Display details
                    <div>
                      {/* Top profile banner */}
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <div style={{ 
                          width: '50px', 
                          height: '50px', 
                          borderRadius: '50%', 
                          background: member.gender === 'Female' ? '#fdf2f8' : '#eff6ff', 
                          border: `2px solid ${member.gender === 'Female' ? '#fbcfe8' : '#bfdbfe'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.25rem',
                          overflow: 'hidden'
                        }}>
                          {member.profile_image ? (
                            <img src={member.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : member.relation === 'Child' ? '👶' : member.gender === 'Female' ? '👩' : '👨'}
                        </div>

                        <div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>{member.name}</h4>
                          <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: 'var(--primary)', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', display: 'inline-block', marginTop: '2px' }}>
                            {member.relation} · {age !== null ? `${age} yrs` : 'No Dob'}
                          </span>
                        </div>
                      </div>

                      <hr style={{ margin: '14px 0', borderColor: 'var(--border)' }} />

                      <div style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)' }}>
                        <div>🩸 Blood group: <strong style={{ color: 'var(--text)' }}>{member.blood_group || 'Not Specified'}</strong></div>
                        <div>⚠️ Allergies: <strong style={{ color: member.allergies ? '#ef4444' : 'var(--text)' }}>{member.allergies || 'None'}</strong></div>
                        <div>🩺 Chronic: <strong style={{ color: 'var(--text)' }}>{member.chronic_conditions || 'None'}</strong></div>
                      </div>

                      {/* Dependents Schedule alerts */}
                      {appts.length > 0 && (
                        <div style={{ marginTop: '14px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Upcoming Bookings:</span>
                          {appts.map(appt => (
                            <span key={appt.id} style={{ fontSize: '0.72rem', display: 'block', color: 'var(--primary)', fontWeight: 600 }}>📅 {appt.appt_date} with Dr. {appt.dname.split(' ')[0]}</span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', marginTop: '18px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                        <Link to={`/family/${member._id}/vaccines`} className="btn btn-outline btn-xs w-100" style={{ textAlign: 'center', padding: '6px' }}>
                          💉 Vaccines
                        </Link>
                        <button onClick={() => handleStartEdit(member)} className="btn btn-ghost btn-xs">Edit</button>
                        <button onClick={() => handleDeleteMember(member._id)} className="btn btn-ghost btn-xs" style={{ color: '#ef4444' }}>Remove</button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Dependent Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative' }}>
            
            <button 
              onClick={() => setShowAddModal(false)} 
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>

            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>➕ Add Family Circle Member</h3>

              {addMessage && (
                <div className={`alert ${addMessage.includes('successfully') ? 'alert-success' : 'alert-danger'}`} style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                  {addMessage}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Full Name</label>
                <input 
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="e.g. Aarav Sharma"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Relationship</label>
                    <select 
                      className="form-control form-control-sm"
                      value={addForm.relation}
                      onChange={(e) => setAddForm({ ...addForm, relation: e.target.value })}
                    >
                      <option value="Spouse">Spouse</option>
                      <option value="Child">Child</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Date of Birth</label>
                    <input 
                      type="date"
                      className="form-control form-control-sm"
                      value={addForm.dob}
                      onChange={(e) => setAddForm({ ...addForm, dob: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Gender</label>
                    <select 
                      className="form-control form-control-sm"
                      value={addForm.gender}
                      onChange={(e) => setAddForm({ ...addForm, gender: e.target.value })}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Blood Group</label>
                    <select 
                      className="form-control form-control-sm"
                      value={addForm.blood_group}
                      onChange={(e) => setAddForm({ ...addForm, blood_group: e.target.value })}
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Known Allergies (Optional)</label>
                <input 
                  type="text"
                  placeholder="e.g. Peanuts, Sulfas"
                  className="form-control form-control-sm"
                  value={addForm.allergies}
                  onChange={(e) => setAddForm({ ...addForm, allergies: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Chronic Conditions (Optional)</label>
                <input 
                  type="text"
                  placeholder="e.g. Asthma, Type-1 Diabetes"
                  className="form-control form-control-sm"
                  value={addForm.chronic_conditions}
                  onChange={(e) => setAddForm({ ...addForm, chronic_conditions: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Profile Image (Optional)</label>
                <input 
                  type="file"
                  className="form-control form-control-sm"
                  onChange={(e) => setProfileImage(e.target.files[0])}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="btn btn-ghost btn-sm"
                  disabled={addLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-sm"
                  disabled={addLoading}
                >
                  {addLoading ? 'Adding Circle...' : 'Add Dependent'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      <div style={{ height: '40px' }}></div>
    </div>
  );
};

export default Family;
