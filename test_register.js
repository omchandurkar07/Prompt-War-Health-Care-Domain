const axios = require('axios');

async function run() {
  try {
    const payload = {
      full_name: 'OM VITTHAL CHANDURKAR',
      email: 'chandurkarom07@gmail.com',
      password: 'TestPass123',
      phone: '8149312060',
      dob: '2007-06-08',
      gender: 'male',
      blood_group: 'A+',
      address: 'Tunki Bk. 444204'
    };

    const res = await axios.post('http://localhost:3000/api/register', payload, { timeout: 10000 });
    console.log('Response:', res.status, res.data);
  } catch (err) {
    if (err.response) {
      console.error('Error response:', err.response.status, err.response.data);
    } else {
      console.error('Request error:', err.message);
    }
  }
}

run();
