const parseDurationDays = (duration = '') => {
  const match = String(duration).match(/\b(\d+)\s*(day|week|month)s?\b/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === 'week') return amount * 7;
  if (unit === 'month') return null;
  return amount;
};

const parseUnitsPerDose = (dosage = '') => {
  const match = String(dosage).match(/\b(\d+(?:\.\d+)?)\s*(tablets?|tabs?|capsules?|caps?|pills?)\b/i);
  return match ? Number(match[1]) : null;
};

const parseDosesPerDay = (timing = '', frequency = '') => {
  const schedule = `${timing} ${frequency}`.toLowerCase();
  if (/\b(prn|as needed|when required|if required|SOS|taper)\b/i.test(schedule)) return null;

  const schedulePattern = schedule.match(/\b([01])\s*[-–]\s*([01])\s*[-–]\s*([01])(?:\s*[-–]\s*([01]))?\b/);
  if (schedulePattern) {
    const doses = schedulePattern.slice(1).filter(Boolean).reduce((sum, dose) => sum + Number(dose), 0);
    return doses > 0 ? doses : null;
  }

  if (/\b(qid|qds|four times daily|4 times daily)\b/.test(schedule)) return 4;
  if (/\b(tid|tds|three times daily|3 times daily|every 8 hours|q8h)\b/.test(schedule)) return 3;
  if (/\b(bid|bd|twice daily|2 times daily|morning and night)\b/.test(schedule)) return 2;
  if (/\b(once daily|once a day|daily|od|qd|every 24 hours)\b/.test(schedule)) return 1;
  if (/\bevery 6 hours\b/.test(schedule)) return 4;
  if (/\bevery 12 hours\b/.test(schedule)) return 2;
  return null;
};

const formatQuantity = (quantity, dosage) => {
  if (!quantity) return '';
  const unitMatch = String(dosage || '').match(/\b(tablets?|tabs?|capsules?|caps?|pills?)\b/i);
  const rawUnit = unitMatch?.[1].toLowerCase() || '';
  const unit = /^(tab|tablet)/.test(rawUnit) ? 'tablet' : (/^(cap|capsule)/.test(rawUnit) ? 'capsule' : (/pill/.test(rawUnit) ? 'pill' : rawUnit));
  return `${quantity}${unit ? ` ${unit}${Number(quantity) === 1 ? '' : 's'}` : ''}`.trim();
};

const normalizeExtractedMedicine = (medicine = {}) => {
  const unitsPerDose = String(medicine.units_per_dose || '').trim().slice(0, 40);
  const normalized = {
    name: String(medicine.name || '').trim().slice(0, 120),
    dosage: String(medicine.dosage || '').trim().slice(0, 80),
    units_per_dose: unitsPerDose,
    timing: String(medicine.timing || medicine.frequency || '').trim().slice(0, 120),
    frequency: String(medicine.frequency || medicine.timing || '').trim().slice(0, 120),
    duration: String(medicine.duration || '').trim().slice(0, 80),
    quantity: String(medicine.quantity || '').trim().slice(0, 60),
    quantity_source: medicine.quantity_source === 'calculated' ? 'calculated' : (medicine.quantity ? 'written' : 'not_specified'),
    route: String(medicine.route ?? 'Oral').trim().slice(0, 40),
    instructions: String(medicine.instructions || '').trim().slice(0, 240),
    confidence: ['high', 'medium', 'low'].includes(String(medicine.confidence || '').toLowerCase())
      ? String(medicine.confidence).toLowerCase()
      : 'low'
  };

  if (normalized.quantity) return normalized;

  const unitsPerDoseCount = parseUnitsPerDose(normalized.units_per_dose || normalized.dosage);
  const dosesPerDay = parseDosesPerDay(normalized.timing, normalized.frequency);
  const durationDays = parseDurationDays(normalized.duration);

  if (unitsPerDoseCount && dosesPerDay && durationDays) {
    const amount = unitsPerDoseCount * dosesPerDay * durationDays;
    if (Number.isInteger(amount) && amount > 0 && amount <= 10000) {
      normalized.quantity = formatQuantity(amount, normalized.units_per_dose || normalized.dosage);
      normalized.quantity_source = 'calculated';
    }
  }

  return normalized;
};

const normalizeExtractedMedicines = (medicines) => (
  Array.isArray(medicines)
    ? medicines.filter(medicine => medicine && typeof medicine === 'object' && String(medicine.name || '').trim())
      .slice(0, 30)
      .map(normalizeExtractedMedicine)
    : []
);

module.exports = {
  normalizeExtractedMedicine,
  normalizeExtractedMedicines
};
