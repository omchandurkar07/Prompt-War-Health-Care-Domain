const Tesseract = require('tesseract.js');
const fs = require('fs');

const extractMedicinesFromImage = async (filePath) => {
  const result = { raw_text: '', medicines: [], ocr_available: false };
  if (!filePath || !fs.existsSync(filePath)) return result;

  try {
    console.log(`[OCR] Parsing image file: ${filePath}`);
    const ocrResult = await Tesseract.recognize(filePath, 'eng');
    const rawText = ocrResult.data.text || '';
    result.raw_text = rawText.trim();
    result.ocr_available = true;
    result.medicines = parseLines(rawText);
    console.log(`[OCR] Extracted ${result.medicines.length} medicines.`);
  } catch (error) {
    console.error(`[OCR] Parsing failed: ${error.message}`);
    result.error = error.message;
  }
  return result;
};

const parseLines = (text) => {
  const medicines = [];
  const dosageRegex = /\b(\d+\s*(?:mg|ml|mcg|g|tablet|tab|cap)s?)\b/i;
  const timingKeywords = ['morning', 'afternoon', 'evening', 'night', 'bd', 'tds', 'after food', 'before food'];

  const lines = text.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (line.length < 3) continue;

    // Filter headers/clinical metadata
    if (/^(dr\.?|doctor|patient|date|rx)\b/i.test(line)) continue;

    const dm = line.match(dosageRegex);
    const dosage = dm ? dm[1] : '';

    const timingList = [];
    const lowerLine = line.toLowerCase();
    timingKeywords.forEach(kw => {
      if (lowerLine.includes(kw)) {
        timingList.push(kw);
      }
    });
    const timing = timingList.join(', ').substring(0, 120);

    let name = line;
    if (dm) {
      const idx = line.indexOf(dm[1]);
      name = line.substring(0, idx).replace(/[-:,]+$/, '').trim();
    }
    if (name.length < 2) continue;

    medicines.push({
      name: name.substring(0, 120),
      dosage: dosage.substring(0, 80),
      timing: timing,
      duration: '',
      frequency: timing,
      route: 'Oral',
      instructions: ''
    });
  }

  return medicines.slice(0, 15);
};

module.exports = {
  extractMedicinesFromImage
};
