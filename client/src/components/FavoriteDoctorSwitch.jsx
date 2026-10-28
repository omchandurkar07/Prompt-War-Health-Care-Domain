import React, { useId } from 'react';

const FavoriteDoctorSwitch = ({ doctorId, checked, onChange, disabled = false }) => {
  const inputId = `favorite-doctor-${doctorId}-${useId().replace(/:/g, '')}`;

  return (
    <div className="favorite-doctor-switch">
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={inputId} className="favorite-doctor-label">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span className="favorite-doctor-action">
          <span className="favorite-doctor-option-add">Add to Favorites</span>
          <span className="favorite-doctor-option-added">Added to Favorites</span>
        </span>
      </label>
    </div>
  );
};

export default FavoriteDoctorSwitch;
