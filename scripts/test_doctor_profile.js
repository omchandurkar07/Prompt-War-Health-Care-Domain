const axios = require('axios').default;
const qs = require('qs');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

const doctorCredentials = {
  email: process.env.TEST_DOCTOR_EMAIL || 'testdoctor@example.com',
  password: process.env.TEST_DOCTOR_PASSWORD || 'password123'
};

const client = axios.create({ baseURL: BASE, withCredentials: true });

async function login() {
  const res = await client.post('/doctor/login', qs.stringify({
    email: doctorCredentials.email,
    password: doctorCredentials.password
  }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (!res.data || !res.data.ok) throw new Error('Doctor login failed: ' + (res.data && res.data.error));
  console.log('Logged in as doctor:', res.data.user?.name || doctorCredentials.email);
}

async function getProfile() {
  const res = await client.get('/doctor/profile');
  if (!res.data || !res.data.ok) throw new Error('Get doctor profile failed');
  console.log('Doctor profile fetched:', { id: res.data.doctor._id, name: res.data.doctor.full_name });
  return res.data.doctor;
}

async function updateProfile() {
  const form = new URLSearchParams();
  form.append('full_name', 'Dr. Automated');
  form.append('phone', '7777777777');
  form.append('specialization', 'General Physician');
  form.append('qualification', 'MBBS');
  form.append('experience_years', '5');
  form.append('bio', 'Automated test doctor profile');

  const res = await client.post('/doctor/profile', form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (!res.data || !res.data.ok) throw new Error('Update doctor profile failed: ' + (res.data && res.data.error));
  console.log('Doctor profile updated succesfully. Name now:', res.data.doctor.full_name);
}

async function run() {
  try {
    await login();
    await getProfile();
    await updateProfile();
    await getProfile();
    console.log('\nDoctor profile test completed successfully.');
  } catch (err) {
    console.error('Test failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

if (require.main === module) run();

module.exports = { run };
