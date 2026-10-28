const patientRequired = (req, res, next) => {
  if (!req.session || !req.session.patient_id) {
    req.flash('warning', 'Please log in as a patient.');
    return res.redirect('/login');
  }
  next();
};

const doctorRequired = (req, res, next) => {
  if (!req.session || !req.session.doctor_id) {
    req.flash('warning', 'Please log in as a doctor.');
    return res.redirect('/doctor/login');
  }
  next();
};

const adminRequired = (req, res, next) => {
  if (!req.session || !req.session.admin_id) {
    return res.redirect('/admin/login');
  }
  next();
};

module.exports = {
  patientRequired,
  doctorRequired,
  adminRequired
};
