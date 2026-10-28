Profile API & UI Quick Tests
=============================

1) Prerequisites
- Start the backend server: `node server.js`
- Ensure MongoDB is running and the app has access to test accounts for patient and doctor;
  - Set environment variables `TEST_PATIENT_EMAIL`, `TEST_PATIENT_PASSWORD`, `TEST_DOCTOR_EMAIL`, `TEST_DOCTOR_PASSWORD` if needed.

2) Run automated API checks
- From project root run:
```bash
node scripts/test_patient_profile.js
node scripts/test_doctor_profile.js
```

These scripts will attempt to log in, fetch profile, update profile, and fetch again. They'll print results and exit non-zero on failure.

3) Manual UI checks
- Log in as a patient and visit `/profile` — verify fields: name, phone, dob, gender, blood group, address, emergency contact, avatar upload.
- Log in as a doctor and visit `/doctor/profile` — verify doctor-specific fields and avatar upload.
- From the navbar profile menu (avatar) click Profile to confirm routing for both roles.

4) Notes / Troubleshooting
- If login fails, ensure the test account exists and credentials are correct. You can create a user via the registration flow or insert a user in MongoDB with a bcrypt-hashed password.
- File uploads in the UI use multipart form upload; the API tests do not exercise file uploads to keep them simple.
