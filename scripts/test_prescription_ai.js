const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { parseLines } = require('../services/ocrService');
const { normalizeExtractedMedicine } = require('../services/prescriptionExtraction');
const { preparePrescriptionImage } = require('../services/prescriptionImage');

const run = async () => {
  const fixedSchedule = parseLines('Tab. Amoxicillin 500 mg 1 tab BD for 5 days');
  assert.equal(fixedSchedule.length, 1);
  assert.equal(fixedSchedule[0].name, 'Amoxicillin');
  assert.equal(fixedSchedule[0].dosage, '500 mg');
  assert.equal(fixedSchedule[0].timing, 'BD');
  assert.equal(fixedSchedule[0].quantity, '10 tablets');
  assert.equal(fixedSchedule[0].quantity_source, 'calculated');

  assert.deepEqual(parseLines('Take 1 tab after food for 5 days'), []);

  const prnMedicine = normalizeExtractedMedicine({
    name: 'Paracetamol',
    units_per_dose: '1 tablet',
    timing: 'SOS',
    duration: '5 days'
  });
  assert.equal(prnMedicine.quantity, '');
  assert.equal(prnMedicine.quantity_source, 'not_specified');

  const explicitQuantity = normalizeExtractedMedicine({
    name: 'Amoxicillin',
    units_per_dose: '1 capsule',
    timing: 'BD',
    duration: '5 days',
    quantity: '12 capsules'
  });
  assert.equal(explicitQuantity.quantity, '12 capsules');
  assert.equal(explicitQuantity.quantity_source, 'written');

  const unclearSchedule = normalizeExtractedMedicine({
    name: 'Medicine',
    units_per_dose: '1 tablet',
    timing: 'as directed',
    duration: '1 week'
  });
  assert.equal(unclearSchedule.quantity, '');

  const imagePath = path.join(os.tmpdir(), `prescription-ai-${process.pid}.svg`);
  const svg = '<svg width="4000" height="3000" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="100" y="200" font-size="80">Rx Medicine 250 mg</text></svg>';
  fs.writeFileSync(imagePath, svg);
  try {
    const prepared = await preparePrescriptionImage(imagePath);
    const metadata = await sharp(prepared.buffer).metadata();
    assert.equal(prepared.mimeType, 'image/jpeg');
    assert.ok(metadata.width <= 2400 && metadata.height <= 2400);
    assert.equal(prepared.detailImages.length, 2);
    assert.ok(prepared.detailImages.every(image => image.length > 0));
  } finally {
    fs.unlinkSync(imagePath);
  }

  console.log('Prescription AI/OCR synthetic checks passed.');
};

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
