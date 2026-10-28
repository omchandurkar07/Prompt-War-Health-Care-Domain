import React from 'react';

const FALLBACK_IMAGE = '/static/images/default_doctor.svg';

const DoctorAvatar = ({ src, alt = 'Doctor profile photo', className, style }) => (
  <img
    src={src || FALLBACK_IMAGE}
    alt={alt}
    className={className}
    style={style}
    onError={(event) => {
      event.currentTarget.onerror = null;
      event.currentTarget.src = FALLBACK_IMAGE;
    }}
  />
);

export default DoctorAvatar;
