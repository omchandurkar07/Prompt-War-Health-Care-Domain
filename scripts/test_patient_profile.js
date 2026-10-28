const axios = require('axios').default;
const qs = require('qs');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

const patientCredentials = {
  email: process.env.TEST_PATIENT_EMAIL || 'testpatient@example.com',
  password: process.env.TEST_PATIENT_PASSWORD || 'password123'
};

const client = axios.create({ baseURL: BASE, withCredentials: true });

async function login() {
  const res = await client.post('/login', qs.stringify({
    email: patientCredentials.email,
    password: patientCredentials.password
  }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (!res.data || !res.data.ok) throw new Error('Login failed: ' + (res.data && res.data.error));
  console.log('Logged in as patient:', res.data.user?.name || patientCredentials.email);
}

async function getProfile() {
  const res = await client.get('/profile');
  if (!res.data || !res.data.ok) throw new Error('Get profile failed');
  console.log('Patient profile fetched:', { id: res.data.patient._id, name: res.data.patient.full_name });
  return res.data.patient;
}

async function updateProfile() {
  const form = new URLSearchParams();
  form.append('full_name', 'Automated Tester');
  form.append('phone', '9999999999');
  form.append('dob', '1990-01-01');
  form.append('gender', 'Other');
  form.append('blood_group', 'O+');
  form.append('address', '123 Test St');
  form.append('emergency_contact', '8888888888');

  const res = await client.post('/profile', form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (!res.data || !res.data.ok) throw new Error('Update profile failed: ' + (res.data && res.data.error));
  console.log('Profile updated succesfully. Name now:', res.data.patient.full_name);
}

async function run() {
  try {
    await login();
    await getProfile();
    await updateProfile();
    await getProfile();
    console.log('\nPatient profile test completed successfully.');
  } catch (err) {
    console.error('Test failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

if (require.main === module) run();

module.exports = { run };
