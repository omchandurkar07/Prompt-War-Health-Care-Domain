const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const Testimonial = require('../models/Testimonial');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const upload = multer();
const { ML_URL } = require('../services/mlHelperService');

// Helpers
const getDoctorBadges = (doc) => {
  const badges = [];
  if (doc.rating_avg >= 4.5 && doc.rating_count >= 3) {
    badges.push({ label: 'Top Doctor', icon: '⭐', color: 'gold' });
  }
  if (doc.response_time_avg > 0 && doc.response_time_avg < 60) {
    badges.push({ label: 'Fast Response', icon: '⚡', color: 'blue' });
  }
  if (doc.rating_avg >= 4.0) {
    badges.push({ label: 'Highly Rated', icon: '🏆', color: 'green' });
  }
  if (doc.is_available) {
    badges.push({ label: 'Available Now', icon: '🟢', color: 'emerald' });
  }
  return badges;
};

// Home Route
router.get('/', async (req, res) => {
  try {
    const featuredDocs = await Doctor.find({ is_approved: true })
      .sort({ rating_avg: -1, rating_count: -1 })
      .limit(6);
    
    const featured = featuredDocs.map(doc => ({
      doc,
      badges: getDoctorBadges(doc)
    }));

    const testimonials = await Testimonial.find()
      .sort({ created_at: -1 })
      .limit(6);

    res.json({ ok: true, featured, testimonials });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
});

// Submit Testimonial
router.post('/testimonial', async (req, res) => {
  const { name, comment, rating } = req.body;
  if (!name || !comment || comment.trim().length < 5) {
    return res.json({ ok: false, error: 'Name and comment required' });
  }
  try {
    const testimonial = new Testimonial({
      name,
      comment,
      rating: parseInt(rating) || 5
    });
    await testimonial.save();
    res.json({ ok: true });
  } catch (error) {
    res.json({ ok: false, error: error.message });
  }
});

const helperErrorMessage = (error) => {
  if (error.response?.data?.error) return error.response.data.error;
  if (error.response?.status) return `ML helper service error (${error.response.status})`;
  if (error.code) return error.message || error.code;
  return 'ML helper service offline';
};

// Proxy Symptom list
router.get('/ml-symptoms', async (req, res) => {
  try {
    const response = await axios.get(`${ML_URL}/api/ml-symptoms`);
    res.json(response.data);
  } catch (error) {
    console.error('[ML PROXY] /api/ml-symptoms failed:', error.message || error);
    res.status(500).json({ error: helperErrorMessage(error) });
  }
});

// Proxy Parse Text
router.post('/ml-parse-text', async (req, res) => {
  try {
    const response = await axios.post(`${ML_URL}/api/ml-parse-text`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('[ML PROXY] /api/ml-parse-text failed:', error.message || error);
    res.status(500).json({ error: helperErrorMessage(error) });
  }
});

// Proxy Prediction
router.post('/ml-predict', async (req, res) => {
  try {
    const response = await axios.post(`${ML_URL}/api/ml-predict`, req.body);
    const data = response.data;
    if (data && data.specialization) {
      data.recommended_specialization = data.specialization;
    }
    res.json(data);
  } catch (error) {
    console.error('[ML PROXY] /api/ml-predict failed:', error.message || error);
    res.status(500).json({ error: helperErrorMessage(error) });
  }
});

// Proxy Audio Transcription
router.post('/ml-transcribe-audio', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const response = await axios.post(`${ML_URL}/api/ml-transcribe-audio`, form, {
      headers: { ...form.getHeaders() }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data?.error || 'ML helper service offline' });
  }
});

// Proxy Traffic Route ML Predictor
router.post('/ml-traffic-predict', async (req, res) => {
  try {
    const response = await axios.post(`${ML_URL}/api/ml-traffic-predict`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data?.error || 'ML helper service offline' });
  }
});

module.exports = router;
