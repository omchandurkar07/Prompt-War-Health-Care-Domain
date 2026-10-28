const Tesseract = require('tesseract.js');
const fs = require('fs');
const { normalizeExtractedMedicines } = require('./prescriptionExtraction');

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
  const strengthRegex = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|IU|%|units?)\b|\b\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\b/i;
  const unitsPerDoseRegex = /\b\d+(?:\.\d+)?\s*(?:tablets?|tabs?|capsules?|caps?|pills?|ml|mL)\b/i;
  const scheduleRegex = /\b(?:\d\s*[-–]\s*\d\s*[-–]\s*\d(?:\s*[-–]\s*\d)?|Q\s*\d+\s*H|OD|QD|BD|BID|TDS|TID|QID|QDS|SOS|PRN)\b/i;
  const frequencyRegex = /\b(?:once|twice|thrice|three|four)\s+(?:a|per)?\s*day\b|\bevery\s+\d+\s+hours?\b/i;
  const durationRegex = /\b\d+\s*(?:days?|d\b|weeks?|months?)\b/i;
  const quantityRegex = /\b(?:qty|quantity)\s*[:=-]?\s*#?\s*(\d+(?:\.\d+)?\s*(?:tablets?|tabs?|capsules?|caps?|pills?|ml|mL|bottles?|sachets?)?)\b|#\s*(\d+(?:\.\d+)?)\b/i;
  const metadataRegex = /^(?:dr\.?|doctor|patient|name|age|date|rx|diagnosis|assessment|advice|instructions?|follow.?up|signature|phone|address|hospital)\b/i;
  const irrelevantRegex = /\b(?:take with|after food|before food|after meals?|before meals?|morning|afternoon|evening|night|bedtime|daily|once daily|twice daily|thrice daily|three times|four times|every \d+ hours?|for \d+ days?)\b/i;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (line.length < 3 || metadataRegex.test(line)) continue;

    const strength = line.match(strengthRegex)?.[0] || '';
    const unitsPerDose = line.match(unitsPerDoseRegex)?.[0] || '';
    const schedule = line.match(scheduleRegex)?.[0] || line.match(frequencyRegex)?.[0] || '';
    const duration = line.match(durationRegex)?.[0] || '';
    const quantityMatch = line.match(quantityRegex);
    const quantity = quantityMatch?.[1] || quantityMatch?.[2] || '';
    const medicineLine = line.replace(/^\s*(?:syp|syrup)\.?\s+/i, '');

    if (!strength && !unitsPerDose && !schedule && !duration && !quantity) continue;

    let name = medicineLine
      .replace(strengthRegex, ' ')
      .replace(unitsPerDoseRegex, ' ')
      .replace(scheduleRegex, ' ')
      .replace(frequencyRegex, ' ')
      .replace(durationRegex, ' ')
      .replace(quantityRegex, ' ')
      .replace(/\b(?:tab(?:let)?s?|cap(?:sule)?s?|oral|po|after food|before food|once|twice|thrice|daily|bd|bid|tds|tid|qid|qds|sos|prn|q\s*\d+\s*h)\b/gi, ' ')
      .replace(/\bx\b/gi, ' ')
      .replace(/[0-9#]+/g, ' ')
      .replace(/[×/,:;|()[\]{}]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (name.length < 2 || irrelevantRegex.test(name)) continue;

    medicines.push({
      name: name.substring(0, 120),
      dosage: strength,
      units_per_dose: unitsPerDose.replace(/\s+/g, ' '),
      timing: schedule,
      frequency: schedule,
      duration: duration.replace(/\s*d$/i, ' days'),
      quantity,
      route: '',
      instructions: '',
      confidence: 'low'
    });
  }

  return normalizeExtractedMedicines(medicines).slice(0, 15);
};

module.exports = {
  extractMedicinesFromImage,
  parseLines
};
