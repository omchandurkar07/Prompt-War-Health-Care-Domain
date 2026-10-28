import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Footer = () => {
  const { role } = useAuth();

  return (
    <footer className="footer" style={{ marginTop: 'auto' }}>
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <div className="mark" style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '36px', height: '36px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderRadius: '10px', color: 'white', fontWeight: 900, marginRight: '10px' }}>✚</div>
              Ultra<span>Care</span>
            </div>
            <p className="footer-desc">
              Modern healthcare platform connecting patients with verified specialists. Book appointments, manage health records, and get care — all in one place.
            </p>
          </div>
          <div className="footer-col">
            <h4>For Patients</h4>
            <ul>
              <li><Link to="/doctors">Find Doctors</Link></li>
              <li><Link to="/register">Register</Link></li>
              <li><Link to="/login">Login</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>For Doctors</h4>
            <ul>
              <li><Link to="/register?type=doctor">Join as Doctor</Link></li>
              <li><Link to="/login?type=doctor">Doctor Login</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="footer-bottom container">
        <span>© 2026 UltraCare. All rights reserved.</span>
        <span>MERN Stack · MongoDB · React SPA</span>
      </div>
    </footer>
  );
};

export default Footer;
