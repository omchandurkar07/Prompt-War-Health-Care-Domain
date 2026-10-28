import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Search, X } from 'lucide-react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Badge,
  Box,
  Container,
  Avatar,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import MenuIconImport from '@mui/icons-material/Menu';
import NotificationsIconImport from '@mui/icons-material/Notifications';
import NotificationsOutlinedIconImport from '@mui/icons-material/NotificationsOutlined';
import { useTheme } from '@mui/material/styles';

const MenuIcon = MenuIconImport.default || MenuIconImport;
const NotificationsIcon = NotificationsIconImport.default || NotificationsIconImport;
const NotificationsOutlinedIcon = NotificationsOutlinedIconImport.default || NotificationsOutlinedIconImport;

const Navbar = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [anchorElNav, setAnchorElNav] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [anchorElNotif, setAnchorElNotif] = useState(null);

  const [navSearch, setNavSearch] = useState('');
  const handleNavSearchSubmit = (e) => {
    e.preventDefault();
    if (navSearch.trim()) {
      navigate(`/doctors?q=${encodeURIComponent(navSearch.trim())}`);
      setNavSearch('');
    }
  };
  const handleClearNavSearch = () => setNavSearch('');

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await axios.get('/api/notifications');
      if (res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000); // Poll every 20s
    return () => clearInterval(interval);
  }, [user]);

  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
  };
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };
   const handleOpenNotifMenu = (event) => {
    setAnchorElNotif(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };
  
   const handleCloseNotifMenu = () => {
    setAnchorElNotif(null);
  };

  const handleNotifClick = async (n) => {
    const destination = n.link === '/appointments'
      ? (role === 'doctor' ? '/doctor/appointments' : '/dashboard#appointments')
      : n.link;

    try {
      if (!n.is_read) {
        await axios.post(`/api/notification/${n.id}/read`);
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: 1 } : item));
      }
      handleCloseNotifMenu();
      if (destination) {
        navigate(destination);
      }
    } catch (err) {
      console.error('Failed to read notification', err);
      handleCloseNotifMenu();
      if (destination) navigate(destination);
    }
  };

  const handleNotifDelete = async (nid, is_read) => {
    try {
      await axios.delete(`/api/notification/${nid}`);
      setNotifications(prev => prev.filter(item => item.id !== nid));
      if (!is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  };

  const handleClearAllNotifs = async () => {
    try {
      await axios.delete('/api/notifications/clear-all');
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to clear notifications', err);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  const guestLinks = [
    { label: 'Home', path: '/' },
    { label: 'Find Doctors', path: '/doctors' },
    { label: 'Symptom Check', path: '/symptom-checker' },
  ];

  const [anchorElHealth, setAnchorElHealth] = useState(null);

  const handleOpenHealthMenu = (event) => {
    setAnchorElHealth(event.currentTarget);
  };

  const handleCloseHealthMenu = () => {
    setAnchorElHealth(null);
  };

  const patientLinks = [
    ...guestLinks,
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Appointments', path: '/dashboard#appointments' },
  ];

  const myHealthLinks = [
      { label: 'Medical Locker', path: '/health-locker' },
      { label: 'Vitals Tracker', path: '/health-tracker' },
      { label: 'My Allergies', path: '/my-allergies' },
      { label: 'Family Health', path: '/family' },
      { label: 'Health Passport', path: '/health-passport' },
      { label: 'Healing Plan', path: '/healing-plan' },
      { label: 'Ambulance Dispatch', path: '/ambulance-emergency' },
      { label: 'Live Queue', path: '/queue/status' },
  ];
  
  const doctorLinks = [
     { label: 'Dashboard', path: '/doctor/dashboard' },
     { label: 'Appointments', path: '/my-appointments' },
     { label: 'Patients', path: '/doctor/patients' },
     { label: 'Analytics', path: '/doctor/analytics' },
  ];
  
  const adminLinks = [
       { label: 'Admin Panel', path: '/admin/dashboard' },
  ];

  let links = guestLinks;
  if(role === 'patient') links = patientLinks;
  else if(role === 'doctor') links = doctorLinks;
  else if(role === 'admin') links = adminLinks;

  const isLinkActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path.includes('#')) {
      const [basePath, hash] = path.split('#');
      return location.pathname === basePath && location.hash === `#${hash}`;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <AppBar
      position="sticky"
      sx={{
        background: 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
        boxShadow: 'none',
        color: 'text.primary'
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ minHeight: { xs: '64px', md: '72px' } }}>
          {/* Logo Desktop */}
          <Box
            component={Link}
            to={role === 'doctor' ? '/doctor/dashboard' : '/'}
            sx={{
              mr: 3,
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              textDecoration: 'none',
            }}
          >
            <Box sx={{
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '34px',
              height: '34px',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              borderRadius: '10px',
              color: 'white',
              fontWeight: 900,
              marginRight: '10px',
              fontSize: '0.95rem',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
            }}>✚</Box>
            <Typography
              variant="h6"
              noWrap
              sx={{
                fontWeight: 800,
                color: 'text.primary',
                letterSpacing: '-0.02em',
                fontSize: '1.25rem',
              }}
            >
              UltraCare
            </Typography>
          </Box>

          {/* Mobile Navigation Icon */}
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-label="navigation menu"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{
                display: { xs: 'block', md: 'none' },
              }}
              PaperProps={{
                sx: { borderRadius: '16px', mt: 1, boxShadow: '0 12px 24px rgba(0,0,0,0.08)' }
              }}
            >
              {links.map((link) => (
                <MenuItem 
                  key={link.label} 
                  onClick={() => { handleCloseNavMenu(); navigate(link.path); }}
                  selected={isLinkActive(link.path)}
                  sx={{ py: 1.2, px: 2.5, mx: 1, borderRadius: '8px' }}
                >
                  <Typography textAlign="center" sx={{ fontWeight: 500 }}>{link.label}</Typography>
                </MenuItem>
              ))}
               {role === 'patient' && (
                 <MenuItem 
                   onClick={(e) => { handleCloseNavMenu(); handleOpenHealthMenu(e); }}
                   selected={myHealthLinks.some(l => isLinkActive(l.path))}
                   sx={{ py: 1.2, px: 2.5, mx: 1, borderRadius: '8px' }}
                 >
                   <Typography textAlign="center" sx={{ fontWeight: 500 }}>My Health</Typography>
                 </MenuItem>
               )}
            </Menu>
          </Box>

          {/* Logo Mobile */}
          <Box
            component={Link}
            to="/"
            sx={{
              mr: 2,
              display: { xs: 'flex', md: 'none' },
              flexGrow: 1,
              alignItems: 'center',
              textDecoration: 'none',
            }}
          >
            <Box sx={{
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '30px',
              height: '30px',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 900,
              marginRight: '8px',
              fontSize: '0.85rem',
            }}>✚</Box>
            <Typography
              variant="h5"
              noWrap
              sx={{
                fontWeight: 800,
                color: 'text.primary',
                letterSpacing: '-0.02em',
                fontSize: '1.15rem',
              }}
            >
              UltraCare
            </Typography>
          </Box>

          {/* Desktop Navigation Links */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
            {links.map((link) => {
              const active = isLinkActive(link.path);
              return (
                <Button
                  key={link.label}
                  onClick={() => navigate(link.path)}
                  sx={{
                    my: 1.5,
                    mx: 0.5,
                    color: active ? 'primary.main' : 'text.secondary',
                    fontWeight: active ? 700 : 500,
                    background: active ? 'rgba(79, 70, 229, 0.06)' : 'transparent',
                    borderRadius: '10px',
                    '&:hover': {
                      background: 'rgba(79, 70, 229, 0.04)',
                      color: 'primary.main',
                    },
                    px: 2,
                    py: 1,
                  }}
                >
                  {link.label}
                </Button>
              );
            })}
            {role === 'patient' && (
              <>
                {(() => {
                  const active = myHealthLinks.some(link => isLinkActive(link.path));
                  return (
                    <Button
                      onClick={handleOpenHealthMenu}
                      sx={{
                        my: 1.5,
                        mx: 0.5,
                        color: active ? 'primary.main' : 'text.secondary',
                        fontWeight: active ? 700 : 500,
                        background: active ? 'rgba(79, 70, 229, 0.06)' : 'transparent',
                        borderRadius: '10px',
                        '&:hover': {
                          background: 'rgba(79, 70, 229, 0.04)',
                          color: 'primary.main',
                        },
                        px: 2,
                        py: 1,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      My Health
                    </Button>
                  );
                })()}
                <Menu
                  sx={{ mt: '45px' }}
                  id="menu-health"
                  anchorEl={anchorElHealth}
                  anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={Boolean(anchorElHealth)}
                  onClose={handleCloseHealthMenu}
                  PaperProps={{
                    sx: { borderRadius: '16px', boxShadow: '0 12px 24px rgba(0,0,0,0.08)' }
                  }}
                >
                  {myHealthLinks.map((link) => {
                    const active = isLinkActive(link.path);
                    return (
                      <MenuItem 
                        key={link.label} 
                        onClick={() => { handleCloseHealthMenu(); navigate(link.path); }}
                        selected={active}
                        sx={{ py: 1.2, px: 2.5, mx: 1, my: 0.2, borderRadius: '8px' }}
                      >
                        <Typography textAlign="center" sx={{ whiteSpace: 'nowrap', fontWeight: active ? 600 : 500 }}>{link.label}</Typography>
                      </MenuItem>
                    );
                  })}
                </Menu>
              </>
            )}
          </Box>

          {/* Spacer to push search and actions to the right */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }} />

          {/* Desktop Search Bar */}
          {!isMobile && (
            <Box
              component="form"
              onSubmit={handleNavSearchSubmit}
              role="search"
              sx={{
                mx: 3,
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                background: 'rgba(15, 23, 42, 0.05)',
                borderRadius: '999px',
                padding: '5px 12px',
                border: '1px solid rgba(15, 23, 42, 0.08)',
                width: '180px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  width: '100%',
                  height: '2px',
                  borderRadius: '1px',
                  background: 'primary.main',
                  transform: 'scaleX(0)',
                  transformOrigin: 'center',
                  transition: 'transform 0.3s ease',
                },
                '&:focus-within': {
                  background: '#ffffff',
                  borderColor: 'primary.main',
                  boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.12)',
                  borderRadius: '12px',
                  width: '250px',
                  '&::before': { transform: 'scaleX(1)' },
                },
                '& .nav-search-button, & .nav-search-reset': {
                  display: 'inline-flex',
                  flexShrink: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 0,
                  padding: '4px',
                  color: 'text.secondary',
                  background: 'transparent',
                  cursor: 'pointer',
                },
                '& .nav-search-button:hover, & .nav-search-reset:hover': {
                  color: 'primary.main',
                },
                '& .nav-search-reset': {
                  visibility: 'hidden',
                  opacity: 0,
                  transition: 'opacity 0.2s ease',
                },
                '& input:not(:placeholder-shown) ~ .nav-search-reset': {
                  visibility: 'visible',
                  opacity: 1,
                },
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                  '&::before, & .nav-search-reset': { transition: 'none' },
                },
              }}
            >
              <button className="nav-search-button" type="submit" aria-label="Search doctors">
                <Search size={17} aria-hidden="true" />
              </button>
              <input
                type="text"
                placeholder="Search doctors..."
                aria-label="Search doctors"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '0.88rem',
                  color: 'inherit',
                  width: '100%',
                  minWidth: 0,
                  padding: '2px 6px'
                }}
              />
              <button
                className="nav-search-reset"
                type="button"
                aria-label="Clear doctor search"
                onClick={handleClearNavSearch}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </Box>
          )}

          {/* Right User Actions */}
          <Box sx={{ flexGrow: 0, display: 'flex', alignItems: 'center' }}>
            {user ? (
              <>
                <IconButton
                  onClick={handleOpenNotifMenu}
                  aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                  aria-controls="menu-notif"
                  aria-haspopup="true"
                  sx={{ p: 1, mr: 2, color: 'text.secondary' }}
                >
                  <Badge badgeContent={unreadCount} color="error">
                    <Box
                      sx={{
                        position: 'relative',
                        display: 'flex',
                        width: 24,
                        height: 24,
                        '& svg': {
                          position: 'absolute',
                          inset: 0,
                          width: 24,
                          height: 24,
                        },
                        '& .notification-bell-filled': {
                          display: unreadCount > 0 ? 'block' : 'none',
                          animation: unreadCount > 0 ? 'notification-bell-fill 0.5s ease both' : 'none',
                        },
                        '& .notification-bell-outline': {
                          display: unreadCount > 0 ? 'none' : 'block',
                        },
                        '@keyframes notification-bell-fill': {
                          '0%': { opacity: 0, transform: 'rotate(0deg)' },
                          '25%': { transform: 'rotate(25deg)' },
                          '50%': { transform: 'rotate(-20deg) scale(1.2)' },
                          '75%': { transform: 'rotate(15deg)' },
                          '100%': { opacity: 1, transform: 'rotate(0deg)' },
                        },
                        '@media (prefers-reduced-motion: reduce)': {
                          '& .notification-bell-filled': { animation: 'none' },
                        },
                      }}
                    >
                      <NotificationsOutlinedIcon className="notification-bell-outline" />
                      <NotificationsIcon className="notification-bell-filled" />
                    </Box>
                  </Badge>
                </IconButton>
                <Menu
                    sx={{ mt: '45px' }}
                    id="menu-notif"
                    anchorEl={anchorElNotif}
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                    keepMounted
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                    open={Boolean(anchorElNotif)}
                    onClose={handleCloseNotifMenu}
                    PaperProps={{
                      sx: { borderRadius: '16px', width: '280px', maxHeight: '360px', boxShadow: '0 12px 24px rgba(0,0,0,0.08)' }
                    }}
                >
                    {notifications.length > 0 ? (
                      <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Notifications</Typography>
                          <Button size="small" onClick={handleClearAllNotifs} sx={{ fontSize: '0.7rem', textTransform: 'none', minWidth: 'auto', p: 0.5 }}>
                            Clear All
                          </Button>
                        </Box>
                        {notifications.map((n) => (
                          <MenuItem key={n.id} onClick={() => handleNotifClick(n)} sx={{ py: 1.5, px: 2, borderBottom: '1px solid rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.02)' } }}>
                            <Box sx={{ flexGrow: 1, mr: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: n.is_read ? 400 : 600 }}>{n.title}</Typography>
                            </Box>
                            <IconButton 
                              size="small" 
                              onClick={(e) => { e.stopPropagation(); handleNotifDelete(n.id, n.is_read); }}
                              sx={{ 
                                p: 0.25, 
                                opacity: 0.5, 
                                '&:hover': { opacity: 1, color: 'error.main', backgroundColor: 'rgba(239, 68, 68, 0.08)' } 
                              }}
                            >
                              <span style={{ fontSize: '0.8rem', lineHeight: 1 }}>✕</span>
                            </IconButton>
                          </MenuItem>
                        ))}
                      </>
                    ) : (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">No new notifications</Typography>
                      </Box>
                    )}
                </Menu>

                <Tooltip title="Open settings">
                  <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                    <Avatar 
                      src={user.profile_image}
                      sx={{ 
                        bgcolor: 'primary.main', 
                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                        fontWeight: 700, 
                        fontSize: '0.9rem',
                        boxShadow: '0 4px 10px rgba(79, 70, 229, 0.2)' 
                      }}
                    >
                      {getInitials(user.name)}
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Menu
                  sx={{ mt: '45px' }}
                  id="menu-appbar"
                  anchorEl={anchorElUser}
                  anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={Boolean(anchorElUser)}
                  onClose={handleCloseUserMenu}
                  PaperProps={{
                    sx: { borderRadius: '16px', boxShadow: '0 12px 24px rgba(0,0,0,0.08)', minWidth: '150px' }
                  }}
                >
                  <MenuItem onClick={() => { handleCloseUserMenu(); navigate(role === 'doctor' ? '/doctor/profile' : '/profile'); }} sx={{ py: 1.2, px: 2.5 }}>
                    <Typography textAlign="center" sx={{ fontWeight: 500 }}>Profile</Typography>
                  </MenuItem>
                  <MenuItem onClick={() => { handleCloseUserMenu(); logout(); }} sx={{ py: 1.2, px: 2.5, color: 'error.main' }}>
                    <Typography textAlign="center" sx={{ fontWeight: 600 }}>Logout</Typography>
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button component={Link} to="/login" variant="text" sx={{ color: 'text.primary', fontWeight: 600 }}>Login</Button>
                <Button component={Link} to="/register" variant="contained" color="primary" sx={{ boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' }}>Register</Button>
              </Box>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navbar;
