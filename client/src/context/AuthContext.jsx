import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Configure Axios defaults
axios.defaults.withCredentials = true;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/me');
      if (response.data && response.data.loggedIn) {
        setUser(response.data.user);
        setRole(response.data.role);
      } else {
        setUser(null);
        setRole(null);
      }
    } catch (error) {
      console.error('Auth verification failed', error);
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email, password, userType) => {
    setLoading(true);
    try {
      let endpoint = '/api/login';
      let payload = { email, password };
      
      if (userType === 'doctor') {
        endpoint = '/api/doctor/login';
      } else if (userType === 'admin') {
        endpoint = '/api/admin/login';
        payload = { username: email, password };
      }

      const response = await axios.post(endpoint, payload);
      if (response.data && response.data.ok) {
        await checkAuth();
        return { success: true };
      } else {
        setLoading(false);
        return { success: false, error: response.data.error || 'Invalid credentials' };
      }
    } catch (error) {
      setLoading(false);
      return { success: false, error: error.response?.data?.error || 'Server error during login' };
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const endpoint = role === 'doctor' ? '/api/doctor/logout' : '/api/logout';
      await axios.get(endpoint);
    } catch (error) {
      console.error('Logout request failed', error);
    } finally {
      setUser(null);
      setRole(null);
      setLoading(false);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
