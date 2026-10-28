import React from 'react';
import { Link } from 'react-router-dom';

const socialLinks = [
  { label: 'YouTube', href: 'https://www.youtube.com/', mark: '▶' },
  { label: 'TikTok', href: 'https://www.tiktok.com/', mark: '♪' },
  { label: 'Discord', href: 'https://discord.com/', mark: 'D' },
  { label: 'Kick', href: 'https://kick.com/', mark: 'K' }
];

const Footer = () => {
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
          <div className="footer-social">
            <span className="footer-social-heading">Social</span>
            {socialLinks.map(({ label, href, mark }) => (
              <a
                key={label}
                className="footer-social-link"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${label}`}
                title={label}
              >
                <span aria-hidden="true">{mark}</span>
              </a>
            ))}
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
