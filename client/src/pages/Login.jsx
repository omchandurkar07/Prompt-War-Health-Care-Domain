import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  Container,
  Box,
  Card,
  Typography,
  TextField,
  Button,
  Modal,
  Link,
  Alert,
  InputAdornment
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import MailIconImport from '@mui/icons-material/MailOutline';
import LockIconImport from '@mui/icons-material/LockOutlined';

const MailIcon = MailIconImport.default || MailIconImport;
const LockIcon = LockIconImport.default || LockIconImport;


const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user, role } = useAuth();

  const [userType, setUserType] = useState('patient'); // 'patient' or 'doctor'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await axios.post('/api/forgot-password', {
        email: forgotEmail,
        userType: userType
      });
      if (res.data && res.data.ok) {
        setForgotSuccess(res.data.message || 'OTP sent successfully!');
        setForgotStep(2);
      } else {
        setForgotError(res.data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      console.error(err);
      setForgotError(err.response?.data?.error || 'Server error requesting password reset.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotOtp.trim() || forgotOtp.length !== 6) {
      setForgotError('Please enter a valid 6-digit verification code.');
      return;
    }
    if (!forgotNewPass || forgotNewPass.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await axios.post('/api/reset-password', {
        otp: forgotOtp,
        newPassword: forgotNewPass
      });
      if (res.data && res.data.ok) {
        setForgotSuccess('🎉 Password reset successfully! You can now sign in.');
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotStep(1);
          setForgotEmail('');
          setForgotOtp('');
          setForgotNewPass('');
        }, 2000);
      } else {
        setForgotError(res.data.error || 'Failed to reset password.');
      }
    } catch (err) {
      console.error(err);
      setForgotError('Server error completing password reset.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      if (role === 'doctor') {
        navigate('/doctor/dashboard');
      } else if (role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, role, navigate]);

  // Set user type from query param if present
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'doctor') {
      setUserType('doctor');
    } else {
      setUserType('patient');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setSubmitting(true);
    const res = await login(email, password, userType);
    setSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Invalid credentials.');
    }
  };

  const userTypeIndex = ['patient', 'doctor', 'admin'].indexOf(userType);

  return (
    <>
      <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 120px)',
        py: 6,
        px: 2,
        background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #eff6ff 100%)',
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 3, md: 5 },
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.6)',
          boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Glow Logo Icon */}
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            boxShadow: '0 8px 16px rgba(59, 130, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '1.6rem',
            fontWeight: 900,
            mb: 3,
            transition: 'transform 0.3s ease',
            '&:hover': {
              transform: 'rotate(90deg) scale(1.05)',
            }
          }}
        >
          ✚
        </Box>

        <Typography component="h1" variant="h5" sx={{ fontWeight: 850, letterSpacing: '-0.03em', mb: 0.5, color: '#0f172a' }}>
          Welcome back
        </Typography>
        <Typography component="p" variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
          Sign in to access your secure portal
        </Typography>

        <Box
          role="group"
          aria-label="Choose account type"
          sx={{
            position: 'relative',
            display: 'flex',
            width: '100%',
            mb: 3.5,
            p: '4px',
            borderRadius: '12px',
            background: '#e9e9eb',
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              zIndex: 0,
              top: '4px',
              bottom: '4px',
              left: '4px',
              width: 'calc((100% - 8px) / 3)',
              borderRadius: '9px',
              background: '#ffffff',
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.18)',
              transform: `translateX(${userTypeIndex * 100}%)`,
              transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
              },
            }}
          />
          {[
            { value: 'patient', label: 'Patient Portal' },
            { value: 'doctor', label: 'Doctor Console' },
            { value: 'admin', label: 'Admin Panel' },
          ].map(({ value, label }) => (
            <Box
              key={value}
              component="button"
              type="button"
              aria-pressed={userType === value}
              onClick={() => setUserType(value)}
              sx={{
                position: 'relative',
                zIndex: 1,
                flex: 1,
                minWidth: 0,
                py: 1,
                px: 0.5,
                border: 0,
                borderRadius: '9px',
                background: 'transparent',
                color: userType === value ? '#2563eb' : '#64748b',
                fontFamily: 'inherit',
                fontSize: { xs: '0.72rem', sm: '0.85rem' },
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'color 180ms ease',
                '&:focus-visible': {
                  outline: '2px solid #2563eb',
                  outlineOffset: '-2px',
                },
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                },
              }}
            >
              {label}
            </Box>
          ))}
        </Box>
        
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              width: '100%', 
              mb: 2.5, 
              borderRadius: '12px', 
              fontSize: '0.85rem',
              alignItems: 'center'
            }}
          >
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label={userType === 'admin' ? "Username" : "Email Address"}
            name="email"
            autoComplete={userType === 'admin' ? "username" : "email"}
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MailIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                </InputAdornment>
              ),
              sx: { borderRadius: '12px' }
            }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                </InputAdornment>
              ),
              sx: { borderRadius: '12px' }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', mt: 1.5, mb: 1 }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => {
                setForgotStep(1);
                setForgotEmail(email);
                setForgotOtp('');
                setForgotNewPass('');
                setForgotError('');
                setForgotSuccess('');
                setShowForgotModal(true);
              }}
              sx={{ 
                fontWeight: 600, 
                color: '#3b82f6', 
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              Forgot Password?
            </Link>
          </Box>

          <LoadingButton
            type="submit"
            fullWidth
            variant="contained"
            loading={submitting}
            sx={{
              mt: 3,
              mb: 2.5,
              py: 1.5,
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.95rem',
              textTransform: 'none',
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.2s',
              '&:hover': {
                background: 'linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)',
                boxShadow: '0 12px 24px -5px rgba(37, 99, 235, 0.35)',
                transform: 'translateY(-1px)',
              },
              '&:active': {
                transform: 'translateY(0)',
              }
            }}
          >
            Sign In
          </LoadingButton>
          
          <Typography variant="body2" color="text.secondary" align="center" sx={{ fontWeight: 500 }}>
            Don't have an account?{' '}
            <Link 
              component={RouterLink} 
              to="/register" 
              sx={{ 
                color: '#2563eb', 
                fontWeight: 700, 
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              Register here
            </Link>
          </Typography>
        </Box>
      </Card>
    </Box>

      <Modal
        open={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        aria-labelledby="forgot-password-modal-title"
      >
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 24,
          p: 4,
        }}>
          <Typography id="forgot-password-modal-title" variant="h6" component="h2" sx={{ mb: 2, fontWeight: 700 }}>
            Reset Password
          </Typography>

          {forgotError && <Alert severity="error" sx={{ mb: 2 }}>{forgotError}</Alert>}
          {forgotSuccess && <Alert severity="success" sx={{ mb: 2 }}>{forgotSuccess}</Alert>}

          {forgotStep === 1 ? (
            <Box component="form" onSubmit={handleRequestOtp} noValidate sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Request an OTP by SMS to the mobile number saved on your {userType === 'doctor' ? 'doctor' : 'patient'} account. Enter your registered email to find the account.
              </Typography>
              <TextField
                margin="normal"
                required
                fullWidth
                id="forgot-email"
                label="Registered Email"
                name="email"
                autoComplete="email"
                autoFocus
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
              <LoadingButton
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                loading={forgotSubmitting}
              >
                Send OTP by SMS
              </LoadingButton>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleResetPassword} noValidate sx={{ mt: 1 }}>
               <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter the verification OTP and choose your new login password.
              </Typography>
              <TextField
                margin="normal"
                required
                fullWidth
                id="otp"
                label="Verification OTP"
                name="otp"
                inputProps={{ maxLength: 6 }}
                value={forgotOtp}
                onChange={(e) => setForgotOtp(e.target.value)}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="newPassword"
                label="New Password"
                type="password"
                id="new-password"
                value={forgotNewPass}
                onChange={(e) => setForgotNewPass(e.target.value)}
              />
              <LoadingButton
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                loading={forgotSubmitting}
              >
                Confirm Reset Password
              </LoadingButton>
            </Box>
          )}
        </Box>
      </Modal>
    </>
  );
};

export default Login;
