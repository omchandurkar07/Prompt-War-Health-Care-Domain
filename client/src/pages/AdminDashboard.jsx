import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  Snackbar,
  Divider,
  Avatar,
  Chip
} from '@mui/material';
import axios from 'axios';

const AdminDashboard = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Data States
  const [stats, setStats] = useState(null);
  const [pendingDocs, setPendingDocs] = useState([]);
  const [recentAppts, setRecentAppts] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [refundRequests, setRefundRequests] = useState([]);
  
  // UI States
  const [toastMessage, setToastMessage] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/admin/dashboard');
      if (res.data && res.data.ok) {
        setStats(res.data.stats);
        setPendingDocs(res.data.pending_docs || []);
        setRecentAppts(res.data.recent || []);
      } else {
        setError(res.data.error || 'Failed to load dashboard statistics.');
      }
    } catch (err) {
      console.error(err);
      setError('Server error loading dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await axios.get('/api/admin/doctors');
      if (res.data && res.data.ok) {
        setAllDoctors(res.data.doctors || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await axios.get('/api/admin/patients');
      if (res.data && res.data.ok) {
        setAllPatients(res.data.patients || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await axios.get('/api/admin/appointments');
      if (res.data && res.data.ok) {
        setAllAppointments(res.data.appointments || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRefundRequests = async () => {
    try {
      const res = await axios.get('/api/admin/payment-refunds');
      if (res.data && res.data.ok) {
        setRefundRequests(res.data.requests || []);
      }
    } catch (err) {
      console.error(err);
      setToastMessage('Unable to load payment refund requests.');
      setToastOpen(true);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    if (newValue === 0) {
      fetchDashboardData();
    } else if (newValue === 1) {
      fetchDoctors();
    } else if (newValue === 2) {
      fetchPatients();
    } else if (newValue === 3) {
      fetchAppointments();
    } else if (newValue === 4) {
      fetchRefundRequests();
    }
  };

  const handleRefundDecision = async (paymentId, decision) => {
    const note = decision === 'reject'
      ? window.prompt('Reason for rejecting this refund request:')
      : window.prompt('Optional note for this full refund:') || '';
    if (decision === 'reject' && note === null) return;
    if (decision === 'approve' && !window.confirm('Approve a full refund through Razorpay?')) return;

    setActionLoading(true);
    try {
      const res = await axios.post(`/api/admin/payment-refunds/${paymentId}/decision`, { decision, note });
      if (res.data?.ok) {
        setToastMessage(decision === 'approve'
          ? `Refund ${res.data.status}.`
          : 'Refund request rejected.');
        setToastOpen(true);
        fetchRefundRequests();
      } else {
        setToastMessage(res.data?.error || 'Unable to update refund request.');
        setToastOpen(true);
      }
    } catch (err) {
      setToastMessage(err.response?.data?.error || 'Unable to update refund request.');
      setToastOpen(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveDoctor = async (did) => {
    setActionLoading(true);
    try {
      const res = await axios.post(`/api/admin/doctor/approve/${did}`);
      if (res.data && res.data.ok) {
        setToastMessage('🎉 Doctor approved successfully!');
        setToastOpen(true);
        // Refresh data
        if (tabValue === 0) {
          fetchDashboardData();
        } else {
          fetchDoctors();
        }
      } else {
        setToastMessage(res.data.error || 'Failed to approve doctor.');
        setToastOpen(true);
      }
    } catch (err) {
      console.error(err);
      setToastMessage('Error approving doctor.');
      setToastOpen(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDoctor = async (did) => {
    if (!window.confirm('Are you sure you want to reject this doctor registration?')) return;
    setActionLoading(true);
    try {
      const res = await axios.post(`/api/admin/doctor/reject/${did}`);
      if (res.data && res.data.ok) {
        setToastMessage('❌ Doctor registration rejected.');
        setToastOpen(true);
        if (tabValue === 0) {
          fetchDashboardData();
        } else {
          fetchDoctors();
        }
      } else {
        setToastMessage(res.data.error || 'Failed to reject doctor.');
        setToastOpen(true);
      }
    } catch (err) {
      console.error(err);
      setToastMessage('Error rejecting doctor.');
      setToastOpen(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveDoctor = async (did) => {
    if (!window.confirm('Are you sure you want to remove this doctor from the platform? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      const res = await axios.post(`/api/admin/doctor/remove/${did}`);
      if (res.data && res.data.ok) {
        setToastMessage('🗑️ Doctor account deleted successfully.');
        setToastOpen(true);
        fetchDoctors();
      } else {
        setToastMessage(res.data.error || 'Failed to remove doctor.');
        setToastOpen(true);
      }
    } catch (err) {
      console.error(err);
      setToastMessage('Error removing doctor.');
      setToastOpen(true);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress size={50} />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>
            System Administration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage approvals, system stats, doctors, patients, and scheduling logs
          </Typography>
        </Box>
        <Button variant="outlined" color="primary" onClick={() => tabValue === 0 ? fetchDashboardData() : (tabValue === 1 ? fetchDoctors() : (tabValue === 2 ? fetchPatients() : (tabValue === 3 ? fetchAppointments() : fetchRefundRequests())))} sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}>
          🔄 Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4, borderRadius: '12px' }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 4, borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              py: 2
            }
          }}
        >
          <Tab label="📊 Overview" />
          <Tab label="🥼 Doctors Directory" />
          <Tab label="👤 Patients Directory" />
          <Tab label="🗓️ Appointment Logs" />
          <Tab label="💳 Refund Requests" />
        </Tabs>

        {/* Tab Panel 0: Overview */}
        {tabValue === 0 && stats && (
          <Box sx={{ p: 3 }}>
            {/* Stat Cards Grid */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {[
                { label: 'Total Patients', count: stats.total_patients, color: '#3b82f6', bg: '#eff6ff', icon: '👤' },
                { label: 'Active Doctors', count: stats.total_doctors, color: '#10b981', bg: '#ecfdf5', icon: '🥼' },
                { label: 'Pending Approvals', count: stats.pending_doctors, color: '#f59e0b', bg: '#fffbeb', icon: '⏳' },
                { label: 'Total Appointments', count: stats.total_appts, color: '#8b5cf6', bg: '#f5f3ff', icon: '🗓️' },
                { label: 'Pending Appointments', count: stats.pending_appts, color: '#ef4444', bg: '#fef2f2', icon: '🏥' }
              ].map((card, i) => (
                <Grid item xs={12} sm={6} md={2.4} key={i}>
                  <Card sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'none', background: card.bg }}>
                    <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                          {card.label}
                        </Typography>
                        <span style={{ fontSize: '1.25rem' }}>{card.icon}</span>
                      </Box>
                      <Typography variant="h3" sx={{ fontWeight: 900, color: card.color }}>
                        {card.count}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Split layout: Pending Approvals & Recent Activities */}
            <Grid container spacing={4}>
              {/* Pending Approvals */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: '#1e293b' }}>
                  ⏳ Pending Doctor Registrations ({pendingDocs.length})
                </Typography>
                <Paper sx={{ p: 2, borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                  {pendingDocs.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">No pending doctor approvals at the moment.</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {pendingDocs.map((doc) => (
                        <Paper key={doc._id} sx={{ p: 2, borderRadius: '12px', border: '1px solid #f1f5f9', background: '#f8fafc', boxShadow: 'none' }}>
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <Avatar src={doc.profile_image} sx={{ width: 48, height: 48, border: '2px solid #e2e8f0' }} />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Dr. {doc.full_name}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{doc.specialization} • {doc.qualification}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>✉️ {doc.email}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>📞 {doc.phone || 'N/A'}</Typography>
                              {doc.degree_certificate && (
                                <Box sx={{ mt: 1 }}>
                                  <a href={doc.degree_certificate} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                                    📄 View Certificate
                                  </a>
                                </Box>
                              )}
                            </Box>
                          </Box>
                          <Divider sx={{ my: 1.5 }} />
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button size="small" variant="contained" color="success" disabled={actionLoading} onClick={() => handleApproveDoctor(doc._id)} sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}>
                              Approve
                            </Button>
                            <Button size="small" variant="outlined" color="error" disabled={actionLoading} onClick={() => handleRejectDoctor(doc._id)} sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}>
                              Reject
                            </Button>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* Recent Appointments */}
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: '#1e293b' }}>
                  🗓️ Recent Appointments
                </Typography>
                <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                  <Table size="small">
                    <TableHead sx={{ background: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Patient</TableCell>
                        <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Doctor</TableCell>
                        <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Date/Time</TableCell>
                        <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentAppts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                            No recent appointments found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentAppts.map((appt) => (
                          <TableRow key={appt.id}>
                            <TableCell sx={{ py: 1.5, fontWeight: 650 }}>{appt.pname}</TableCell>
                            <TableCell sx={{ py: 1.5 }}>Dr. {appt.dname}</TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              {appt.appointment_date} <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({appt.appointment_time})</span>
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Chip 
                                label={appt.status} 
                                size="small" 
                                color={appt.status === 'completed' ? 'success' : (appt.status === 'pending' ? 'warning' : 'default')} 
                                sx={{ fontWeight: 700, textTransform: 'capitalize', fontSize: '0.65rem' }} 
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Tab Panel 1: Doctors Directory */}
        {tabValue === 1 && (
          <Box sx={{ p: 3 }}>
            <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <Table>
                <TableHead sx={{ background: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Doctor</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Specialization</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Credentials</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Fee</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allDoctors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        Loading doctors directory...
                      </TableCell>
                    </TableRow>
                  ) : (
                    allDoctors.map((doc) => (
                      <TableRow key={doc._id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar src={doc.profile_image} sx={{ width: 40, height: 40 }} />
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Dr. {doc.full_name}</Typography>
                              <Typography variant="caption" color="text.secondary">{doc.email}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>{doc.specialization}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{doc.qualification}</Typography>
                          <Typography variant="caption" color="text.secondary">{doc.experience_years} years exp</Typography>
                        </TableCell>
                        <TableCell>₹{doc.consultation_fee}</TableCell>
                        <TableCell>
                          <Chip 
                            label={doc.is_approved ? 'Approved' : 'Pending'} 
                            color={doc.is_approved ? 'success' : 'warning'} 
                            size="small" 
                            sx={{ fontWeight: 700 }} 
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            {!doc.is_approved && (
                              <Button size="small" variant="contained" color="success" onClick={() => handleApproveDoctor(doc._id)} sx={{ textTransform: 'none', borderRadius: '8px' }}>
                                Approve
                              </Button>
                            )}
                            <Button size="small" variant="outlined" color="error" onClick={() => doc.is_approved ? handleRemoveDoctor(doc._id) : handleRejectDoctor(doc._id)} sx={{ textTransform: 'none', borderRadius: '8px' }}>
                              Delete
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Tab Panel 2: Patients Directory */}
        {tabValue === 2 && (
          <Box sx={{ p: 3 }}>
            <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <Table>
                <TableHead sx={{ background: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Patient</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Contact Info</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Registered Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Total Booked Appointments</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allPatients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        Loading patients directory...
                      </TableCell>
                    </TableRow>
                  ) : (
                    allPatients.map((patient) => (
                      <TableRow key={patient.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{patient.full_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{patient.gender} • {patient.blood_group || 'No Blood Group'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">✉️ {patient.email}</Typography>
                          <Typography variant="body2">📞 {patient.phone || 'N/A'}</Typography>
                        </TableCell>
                        <TableCell>{patient.created_at ? new Date(patient.created_at).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#4f46e5' }}>{patient.appt_count} appointments</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Tab Panel 3: Appointment Logs */}
        {tabValue === 3 && (
          <Box sx={{ p: 3 }}>
            <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <Table>
                <TableHead sx={{ background: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Appointment ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Patient Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Doctor Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Schedule</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allAppointments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        Loading appointment logs...
                      </TableCell>
                    </TableRow>
                  ) : (
                    allAppointments.map((appt) => (
                      <TableRow key={appt.id} hover>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{appt.id}</TableCell>
                        <TableCell sx={{ fontWeight: 650 }}>{appt.pname}</TableCell>
                        <TableCell>Dr. {appt.dname}</TableCell>
                        <TableCell>
                          <Chip label={appt.specialization || 'General'} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{appt.appointment_date}</Typography>
                          <Typography variant="caption" color="text.secondary">{appt.appointment_time}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={appt.status} 
                            color={appt.status === 'completed' ? 'success' : (appt.status === 'pending' ? 'warning' : 'default')} 
                            size="small" 
                            sx={{ fontWeight: 750, textTransform: 'uppercase', fontSize: '0.62rem' }} 
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {tabValue === 4 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: '#1e293b' }}>
              Payment Refund Requests ({refundRequests.length})
            </Typography>
            <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
              <Table>
                <TableHead sx={{ background: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Patient</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Doctor / Appointment</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Request</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Decision</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {refundRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        No refund requests need review.
                      </TableCell>
                    </TableRow>
                  ) : refundRequests.map((payment) => (
                    <TableRow key={payment._id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{payment.patient_id?.full_name || 'Patient'}</Typography>
                        <Typography variant="caption" color="text.secondary">{payment.patient_id?.email || ''}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">Dr. {payment.doctor_id?.full_name || 'Doctor'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {payment.appointment_id?.appt_date || 'Appointment'} · {payment.appointment_id?.time_slot || ''}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>₹{(payment.amount_paise / 100).toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip label={payment.refund_status} size="small" color={payment.refund_status === 'failed' ? 'error' : 'warning'} sx={{ textTransform: 'capitalize' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{payment.refund_note}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                          {payment.refund_status !== 'processing' ? (
                            <Button size="small" variant="contained" color="success" disabled={actionLoading} onClick={() => handleRefundDecision(payment._id, 'approve')} sx={{ textTransform: 'none' }}>
                              {payment.refund_status === 'failed' ? 'Retry full refund' : 'Approve full refund'}
                            </Button>
                          ) : (
                            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                              Awaiting provider confirmation
                            </Typography>
                          )}
                          {payment.refund_status === 'requested' && (
                            <Button size="small" variant="outlined" color="error" disabled={actionLoading} onClick={() => handleRefundDecision(payment._id, 'reject')} sx={{ textTransform: 'none' }}>
                              Reject
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      {/* Snackbar notification */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={() => setToastOpen(false)}
        message={toastMessage}
        sx={{
          '& .MuiPaper-root': {
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '0.9rem',
            background: '#1e293b'
          }
        }}
      />
    </Container>
  );
};

export default AdminDashboard;
