const mongoose = require('mongoose');

const CarePlanItemSchema = new mongoose.Schema({
  care_plan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CarePlan', required: true },
  item_type: { type: String, default: 'medicine' }, // medicine, diet, exercise, measurement, followup
  title: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  time_of_day: { type: String, default: 'morning' }, // morning, afternoon, evening, night
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CarePlanItem', CarePlanItemSchema);
