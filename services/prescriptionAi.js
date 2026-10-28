const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const { normalizeExtractedMedicines } = require('./prescriptionExtraction');

const COMMON_MEDS_EXPLANATIONS = [
  {
    pattern: /amoxicillin|penicillin|azithromycin|cefixime|augmentin|clavulanate|erythromycin|ciprofloxacin|doxycycline/i,
    class: 'Antibiotic',
    purpose: 'Treats bacterial infections.',
    instructions: 'Complete the full course of treatment exactly as prescribed, even if you feel better earlier. Do not skip doses.',
    side_effects: 'Nausea, diarrhea, mild stomach upset.',
    precautions: 'Take with a glass of water. If you develop a severe rash or difficulty breathing, stop taking it and contact your doctor immediately.'
  },
  {
    pattern: /paracetamol|acetaminophen|crocin|dolo|calpol|fever|tylenol/i,
    class: 'Analgesic & Antipyretic',
    purpose: 'Reduces fever and relieves mild-to-moderate pain.',
    instructions: 'Take as needed for pain or fever, keeping at least 4 to 6 hours between doses.',
    side_effects: 'Very rare when taken at recommended doses.',
    precautions: 'Do not exceed 4,000mg (4g) per day. Avoid combining with other products containing paracetamol to prevent liver damage.'
  },
  {
    pattern: /ibuprofen|combiflam|aspirin|naproxen|diclofenac|voveran|aceclofenac/i,
    class: 'NSAID (Painkiller)',
    purpose: 'Reduces inflammation, pain, and swelling.',
    instructions: 'Take with or after food/milk to protect your stomach lining.',
    side_effects: 'Stomach ache, heartburn, nausea, dizziness.',
    precautions: 'Avoid taking on an empty stomach. Consult your doctor if you have a history of stomach ulcers, asthma, or kidney issues.'
  },
  {
    pattern: /metformin|glycomet|insulin|glimepiride|gliclazide|sitagliptin|jardiance/i,
    class: 'Anti-diabetic Medication',
    purpose: 'Helps control and lower blood glucose (sugar) levels.',
    instructions: 'Take with meals to minimize gastrointestinal side effects.',
    side_effects: 'Nausea, mild diarrhea, metallic taste in mouth.',
    precautions: 'Monitor your blood sugar levels regularly. Do not skip meals after taking this medication to avoid low blood sugar (hypoglycemia).'
  },
  {
    pattern: /atorvastatin|rosuvastatin|simvastatin|lipitor|crestor/i,
    class: 'Statin (Cholesterol lowering)',
    purpose: 'Lowers "bad" LDL cholesterol and triglycerides in the blood.',
    instructions: 'Usually taken once daily, preferably in the evening, with or without food.',
    side_effects: 'Muscle aches, headache, mild digestive issues.',
    precautions: 'Limit consumption of grapefruit juice. Report any unexplained muscle pain or weakness to your doctor immediately.'
  },
  {
    pattern: /pantoprazole|pantocid|omeprazole|pan-d|pantodac|ranitidine|aciloc|famotidine/i,
    class: 'Antacid / PPI',
    purpose: 'Reduces stomach acid production to treat acid reflux, heartburn, or ulcers.',
    instructions: 'Take in the morning on an empty stomach, at least 30 to 45 minutes before breakfast.',
    side_effects: 'Headache, mild digestive issues, gas.',
    precautions: 'Best taken consistently as directed. Let your doctor know if symptoms persist after completion.'
  },
  {
    pattern: /cetirizine|okacet|levocetirizine|alegard|allegra|fexofenadine|montelukast|montair/i,
    class: 'Antihistamine (Anti-allergy)',
    purpose: 'Relieves allergy symptoms like sneezing, runny nose, watery eyes, or hives.',
    instructions: 'Take once daily, preferably at bedtime if it causes drowsiness.',
    side_effects: 'Sleepiness, dry mouth, tiredness, headache.',
    precautions: 'Avoid driving or operating heavy machinery if you feel drowsy. Limit alcohol consumption.'
  },
  {
    pattern: /cough syrup|benadryl|ascoril|grilinctus|alex/i,
    class: 'Cough Relief / Expectorant',
    purpose: 'Relieves cough, thins mucus, and eases congestion.',
    instructions: 'Take using the measured cup provided. Shake well before use.',
    side_effects: 'Mild drowsiness, dry mouth, lightheadedness.',
    precautions: 'Avoid drinking water immediately after taking the syrup to allow it to coat the throat. Do not drive if drowsy.'
  }
];

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const RECOVERY_PLAN_DISCLAIMER = 'This plan organizes the prescription and general self-care information. It does not replace instructions from your doctor or pharmacist.';

const normalizeRecoveryPlan = (plan, fallback) => {
  const normalizeList = (value, fallbackItems) => {
    if (!Array.isArray(value)) return fallbackItems;
    const items = value
      .filter(item => typeof item === 'string' && item.trim())
      .slice(0, 6)
      .map(item => item.trim().slice(0, 320));
    return items.length ? items : fallbackItems;
  };
  const normalizeMedicines = (value, fallbackItems) => {
    if (!Array.isArray(value)) return fallbackItems;
    const items = value
      .filter(item => item && typeof item === 'object')
      .slice(0, 30)
      .map(item => ({
        name: String(item.name || '').trim().slice(0, 120),
        purpose: String(item.purpose || '').trim().slice(0, 240),
        how_to_take: String(item.how_to_take || '').trim().slice(0, 320),
        caution: String(item.caution || '').trim().slice(0, 240)
      }))
      .filter(item => item.name);
    return items.length ? items : fallbackItems;
  };

  return {
    medicine_guidance: normalizeMedicines(plan?.medicine_guidance, fallback.medicine_guidance),
    today: normalizeList(plan?.today, fallback.today),
    next_days: normalizeList(plan?.next_days, fallback.next_days),
    food: normalizeList(plan?.food, fallback.food),
    rest: normalizeList(plan?.rest, fallback.rest),
    watch_for: normalizeList(plan?.watch_for, fallback.watch_for),
    follow_up: normalizeList(plan?.follow_up, fallback.follow_up),
    disclaimer: RECOVERY_PLAN_DISCLAIMER
  };
};

const createFallbackRecoveryPlan = (medicines = [], diagnosis = '', doctorNotes = '', followUpDate = '') => {
  const hasDoctorNotes = Boolean(String(doctorNotes || '').trim());
  const plan = {
    medicine_guidance: medicines.filter(medicine => medicine?.name).map(medicine => {
      const dose = [medicine.dosage, medicine.units_per_dose].filter(Boolean).join(' · ') || 'Dose not specified on the digital summary';
      const timing = medicine.timing || medicine.frequency || 'Schedule not specified on the digital summary';
      const duration = medicine.duration || 'Duration not specified';
      const quantity = medicine.quantity || 'Quantity not specified';
      return {
        name: medicine.name,
        purpose: 'Use only for the reason explained by your prescribing clinician; the scan alone cannot confirm why it was chosen.',
        how_to_take: `${dose}; ${timing}; ${duration}. Follow the pharmacy label. If any direction is unclear, confirm it with the prescriber or pharmacist before taking it.`,
        caution: `${quantity}${medicine.quantity_source === 'calculated' ? ' (estimated from the written schedule; verify with the prescriber or pharmacist)' : ''}`
      };
    }),
    today: [
      'Compare each medicine, dose, schedule, and quantity with the original prescription and pharmacy label.',
      'If a dose or schedule is missing or hard to read, ask the prescriber or pharmacist before taking that medicine.',
      ...(hasDoctorNotes ? [`Follow your doctor’s instructions: ${String(doctorNotes).trim().slice(0, 240)}`] : [])
    ],
    next_days: [
      'Take medicines only as written on the verified prescription label; do not start, stop, or change a dose based on this summary.',
      `Duration: ${medicines.some(medicine => medicine.duration) ? medicines.map(medicine => `${medicine.name}: ${medicine.duration || 'not stated'}`).join('; ') : 'No treatment duration was recorded; confirm it with your clinician.'}`,
      'Keep a short note of your symptoms and any side effects to discuss at follow-up.'
    ],
    food: [
      ...medicines.filter(medicine => medicine.instructions).map(medicine => `${medicine.name}: ${medicine.instructions}`),
      'No specific diet is prescribed in this summary. Choose your usual balanced meals as tolerated, unless your clinician has given you dietary restrictions.',
      'Drink fluids normally unless you have been told to limit fluids.'
    ],
    rest: [
      'Rest when you feel tired and return to normal activity gradually as you feel better.',
      'No fixed number of rest hours was specified; follow any activity restrictions given by your clinician.'
    ],
    watch_for: [
      'Seek urgent medical help for trouble breathing, swelling of the face or throat, fainting, severe chest pain, or another severe reaction.',
      'Contact your clinician if symptoms worsen, new concerning symptoms appear, or you are unsure whether a medicine is causing a problem.'
    ],
    follow_up: [
      ...(followUpDate ? [`Attend the follow-up recorded for ${followUpDate}.`] : []),
      ...(diagnosis ? [`Discuss your progress for ${diagnosis} with your clinician if symptoms are not improving as expected.`] : ['If symptoms are not improving as expected, contact your clinician for advice.'])
    ]
  };

  return normalizeRecoveryPlan(plan, plan);
};

function generateFallbackExplanation(medicines, doctorNotes = '', diagnosis = '', followUpDate = '') {
  const plan = createFallbackRecoveryPlan(medicines, diagnosis, doctorNotes, followUpDate);
  let html = [];
  html.push('<div class="ai-explanation-box">');
  html.push('<h3 style="color:#4f46e5; margin-top:0; font-weight:700;">Your recovery plan</h3>');
  const sections = [
    ['Medicines — check against the pharmacy label', plan.medicine_guidance.map(med => (
      `<strong>${escapeHtml(med.name)}</strong><br/>${escapeHtml(med.how_to_take)}<br/><span>Quantity: ${escapeHtml(med.caution)}</span>`
    ))],
    ['What to do today', plan.today],
    ['Over the next few days', plan.next_days],
    ['Food and fluids', plan.food],
    ['Rest and activity', plan.rest],
    ['When to get help', plan.watch_for],
    ['Follow-up', plan.follow_up]
  ];
  sections.forEach(([title, items]) => {
    if (!items.length) return;
    html.push(`<h4 style="color:#1e293b; margin:18px 0 6px;">${title}</h4><ul style="margin:0; padding-left:20px; color:#4b5563;">`);
    items.forEach(item => html.push(`<li style="margin:4px 0;">${typeof item === 'string' ? escapeHtml(item) : item}</li>`));
    html.push('</ul>');
  });
  html.push(`<p style="font-size:0.78rem; color:#64748b; border-top:1px solid #e5e7eb; padding-top:12px; margin-top:18px;">${RECOVERY_PLAN_DISCLAIMER}</p>`);
  html.push('</div>');

  return html.join('');
}

function sanitizeAiHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script.*?>.*?<\/script>/gis, '')
    .replace(/on\w+\s*=\s*["'].*?["']/gi, '')
    .replace(/on\w+\s*=\s*`.*?`/gi, '')
    .replace(/href\s*=\s*["']\s*javascript:.*?["']/gi, '');
}

async function explainPrescriptionWithAi(filePath, mimeType, doctorNotes = '', language = 'English') {
  const result = {
    medicines: [],
    explanation: '',
    raw_response: '',
    status: 'fallback',
    language: language,
    raw_text: '',
    diagnosis: '',
    doctor_notes: '',
    follow_up_date: '',
    success: false,
    recovery_plan: createFallbackRecoveryPlan([], '', doctorNotes)
  };

  if (!filePath || !fs.existsSync(filePath)) {
    result.explanation = sanitizeAiHtml(generateFallbackExplanation([], doctorNotes));
    return result;
  }

  const xaiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
  const isXaiValid = xaiKey && !xaiKey.startsWith('PASTE_YOUR');

  const prompt = `
  You are a careful prescription transcription assistant. Extract only information clearly visible in the uploaded document. Never diagnose, guess an unclear medicine, invent a dose, or fill in missing directions.
  
  Analyze this uploaded prescription image or PDF document carefully and perform the following tasks:
  
  1. Transcribe the diagnosis only if it is explicitly written. Otherwise return an empty string.
  2. Extract a follow-up date only if explicitly written. Format it as YYYY-MM-DD. Otherwise return an empty string.
  3. Extract all medicines listed. For each medicine, extract:
     - name: Transcribe the medicine name. Correct a spelling only when the intended name is unambiguous; otherwise preserve the visible text and mark confidence low.
     - dosage: Strength and amount per dose when written (e.g. '500 mg', '1 tablet', '5 ml').
     - units_per_dose: Number and form taken at each dose when explicitly written (e.g. '1 tablet', '2 capsules', '5 ml'); leave empty if unclear.
     - timing: Exact frequency/time instructions when written (e.g. '1-0-1 after food', 'Twice daily', 'Morning and Night'). Preserve prescription abbreviations if uncertain.
     - duration: Treatment duration when written (e.g. '5 days', '1 week').
     - quantity: Total dispensed quantity only when explicitly written (e.g. '10 tablets'). Do not calculate this field; use an empty string when absent.
     - route: Administration route (e.g. 'Oral', 'Topical', 'Ophthalmic').
     - instructions: Patient instructions (e.g. 'Take with warm water', 'Avoid cold drinks').
     - confidence: 'high', 'medium', or 'low' for transcription confidence. Use low for uncertain handwriting or any uncertain field.
  4. Do not interpret tablet-strength as quantity. Do not derive a schedule from medical knowledge. Return every medicine that is explicitly listed and omit unrelated text.
  5. Generate a concise, practical recovery_plan in ${language} using only the verified prescription and clinician instructions:
     - medicine_guidance: one item per listed medicine with name, purpose (if uncertain say to ask the prescriber), how_to_take (repeat only the exact written dose, schedule, duration, and quantity; point out missing directions), and caution.
     - today: 2-4 concrete steps for checking the pharmacy label, confirming unclear directions, and following the clinician's written advice.
     - next_days: a short staged checklist (today, next 1-2 days, and until the stated follow-up or end of the written course). Do not invent a treatment duration.
     - food: practical, diagnosis-appropriate food advice only when the diagnosis or clinician instructions support it. Otherwise recommend usual balanced meals as tolerated, no invented restrictions, and fluids only if not restricted.
     - rest: practical recovery and activity guidance. Never invent a number of rest hours or prescribe bed rest when not stated.
     - watch_for: relevant warning signs; if diagnosis is unclear, give only general serious-reaction/emergency advice.
     - follow_up: use only the explicit follow-up date or written instructions; otherwise advise contacting the clinician if worsening or not improving.
     Avoid generic filler, repeated disclaimers, diagnosis by inference, extra medicines, dosage changes, or certainty about recovery.
  6. Add a brief one- or two-sentence explanation in ${language}; do not repeat the recovery plan in this field.
  
  You MUST respond ONLY in valid JSON format matching this schema:
  {
    "diagnosis": "string (only a diagnosis explicitly written, otherwise empty)",
    "doctor_notes": "string (any clinical instructions or advice for the patient, or empty if none)",
    "follow_up_date": "string (explicit date in YYYY-MM-DD format, otherwise empty)",
    "medicines": [
      {
        "name": "string",
        "dosage": "string",
        "units_per_dose": "string (written units per dose, otherwise empty)",
        "timing": "string",
        "duration": "string",
        "route": "string",
        "instructions": "string",
        "quantity": "string (explicitly written total count or volume, otherwise empty)",
        "confidence": "high | medium | low"
      }
    ],
    "explanation": "string (short HTML summary, without repeated generic wellness text)",
    "recovery_plan": {
      "medicine_guidance": [{"name": "string", "purpose": "string", "how_to_take": "string", "caution": "string"}],
      "today": ["string"],
      "next_days": ["string"],
      "food": ["string"],
      "rest": ["string"],
      "watch_for": ["string"],
      "follow_up": ["string"]
    }
  }
  `;

  // 1. Try xAI (Grok) if Key is present
  if (isXaiValid) {
    try {
      console.log('[AI] Initializing xAI (Grok) API...');
      const modelName = process.env.XAI_MODEL || process.env.GROK_MODEL || 'grok-2-vision-1212';
      console.log(`[AI] Reading file inline for xAI: ${filePath} (${mimeType})`);
      
      const fileBase64 = fs.readFileSync(filePath).toString('base64');
      const dataUrl = `data:${mimeType || 'image/png'};base64,${fileBase64}`;

      const response = await axios.post('https://api.x.ai/v1/chat/completions', {
        model: modelName,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Authorization': `Bearer ${xaiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const respText = response.data.choices[0].message.content.trim();
      result.raw_response = respText;
      
      const data = JSON.parse(respText);
      result.medicines = normalizeExtractedMedicines(data.medicines);
      result.diagnosis = data.diagnosis || '';
      result.doctor_notes = data.doctor_notes || '';
      result.follow_up_date = data.follow_up_date || '';
      result.recovery_plan = normalizeRecoveryPlan(
        data.recovery_plan,
        createFallbackRecoveryPlan(result.medicines, result.diagnosis, result.doctor_notes || doctorNotes, result.follow_up_date)
      );

      let explanationHtml = data.explanation || '';
      if (doctorNotes) {
        const notesBlock = `
          <div style="background:#f3f4f6; padding:12px 16px; border-radius:8px; margin-bottom:20px; font-size:0.88rem; border-left:4px solid #9ca3af; color:#374151;">
          <strong>Doctor's Clinical Guidance:</strong><br/>${escapeHtml(doctorNotes)}
          </div>
        `;
        explanationHtml = notesBlock + explanationHtml;
      }

      const quoteBlock = `
        <div style="text-align:center; margin-top:20px; border-top:1px solid #e5e7eb; padding-top:15px;">
        <p style="font-size:1.15rem; color:#4f46e5; font-weight:bold; margin:0 0 4px 0;">❤️ Get Well Soon!</p>
        <p style="font-size:0.82rem; color:#6b7280; margin:0; font-style:italic;">"Your health is our priority. Wishing you a speedy recovery!"</p>
        </div>
      `;
      explanationHtml = explanationHtml + quoteBlock;

      result.explanation = sanitizeAiHtml(explanationHtml);
      result.success = true;
      result.status = 'success';
      return result;
    } catch (error) {
      console.error(`[AI] xAI API execution failed: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
    }
  }

  // 2. Fallback to Gemini if valid key exists
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const isGeminiValid = geminiKey && !geminiKey.startsWith('PASTE_YOUR');

  if (isGeminiValid) {
    try {
      console.log('[AI] Initializing Gemini API...');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });

      console.log(`[AI] Reading file inline for Gemini API: ${filePath} (${mimeType})`);
      const filePart = {
        inlineData: {
          data: fs.readFileSync(filePath).toString('base64'),
          mimeType: mimeType || 'image/png'
        }
      };

      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              filePart,
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const respText = response.response.text().trim();
      result.raw_response = respText;
      
      const data = JSON.parse(respText);
      result.medicines = normalizeExtractedMedicines(data.medicines);
      result.diagnosis = data.diagnosis || '';
      result.doctor_notes = data.doctor_notes || '';
      result.follow_up_date = data.follow_up_date || '';
      result.recovery_plan = normalizeRecoveryPlan(
        data.recovery_plan,
        createFallbackRecoveryPlan(result.medicines, result.diagnosis, result.doctor_notes || doctorNotes, result.follow_up_date)
      );

      let explanationHtml = data.explanation || '';
      if (doctorNotes) {
        const notesBlock = `
          <div style="background:#f3f4f6; padding:12px 16px; border-radius:8px; margin-bottom:20px; font-size:0.88rem; border-left:4px solid #9ca3af; color:#374151;">
          <strong>Doctor's Clinical Guidance:</strong><br/>${escapeHtml(doctorNotes)}
          </div>
        `;
        explanationHtml = notesBlock + explanationHtml;
      }

      const quoteBlock = `
        <div style="text-align:center; margin-top:20px; border-top:1px solid #e5e7eb; padding-top:15px;">
        <p style="font-size:1.15rem; color:#4f46e5; font-weight:bold; margin:0 0 4px 0;">❤️ Get Well Soon!</p>
        <p style="font-size:0.82rem; color:#6b7280; margin:0; font-style:italic;">"Your health is our priority. Wishing you a speedy recovery!"</p>
        </div>
      `;
      explanationHtml = explanationHtml + quoteBlock;

      result.explanation = sanitizeAiHtml(explanationHtml);
      result.success = true;
      result.status = 'success';
      return result;
    } catch (error) {
      console.error(`[AI] Gemini API execution failed: ${error.message}`);
    }
  }

  // 3. Fallback to local OCR / basic explanation if both fail
  if (!result.success) {
    console.log('[AI] Running local OCR & fallback explanation generation...');
    let medicines = [];
    const ext = path.extname(filePath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(ext)) {
      try {
        const ocrService = require('./ocrService');
        const ocrResult = await ocrService.extractMedicinesFromImage(filePath);
        medicines = ocrResult.medicines || [];
        result.raw_text = ocrResult.raw_text || '';
      } catch (ocrErr) {
        console.warn(`[AI] Local OCR fallback failed: ${ocrErr.message}`);
      }
    }
    result.medicines = normalizeExtractedMedicines(medicines);
    result.recovery_plan = createFallbackRecoveryPlan(result.medicines, result.diagnosis, doctorNotes, result.follow_up_date);
    result.explanation = sanitizeAiHtml(generateFallbackExplanation(
      result.medicines,
      doctorNotes,
      result.diagnosis,
      result.follow_up_date
    ));
    result.status = 'fallback';
  }

  return result;
}

async function generateDigitalPrescriptionExplanation(medicines, diagnosis = '', doctorNotes = '', language = 'English', followUpDate = '') {
  const result = {
    explanation: '',
    raw_response: '',
    status: 'fallback',
    language: language,
    recovery_plan: createFallbackRecoveryPlan(medicines, diagnosis, doctorNotes, followUpDate)
  };

  const xaiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
  const isXaiValid = xaiKey && !xaiKey.startsWith('PASTE_YOUR');

  const medsText = medicines.map(m => (
    `- Name: ${m.name}, Strength: ${m.dosage || 'Not specified'}, Units per dose: ${m.units_per_dose || 'Not specified'}, Timing/Frequency: ${m.timing || m.frequency || 'Not specified'}, Duration: ${m.duration || 'Not specified'}, Quantity: ${m.quantity || 'Not specified'}, Quantity source: ${m.quantity_source || 'not_specified'}, Route: ${m.route || 'Not specified'}, Instructions: ${m.instructions || 'None'}`
  )).join('\n');

  const prompt = `
  Create a concise patient recovery plan in ${language} from this doctor's digital prescription. This is a health communication task, not a diagnosis or a new treatment plan.
  
  Prescribed Medicines:
  ${medsText}
  
  Diagnosis: ${diagnosis || 'Not specified'}
  Doctor's Notes: ${doctorNotes || 'None'}
  Follow-up date: ${followUpDate || 'Not specified'}
  
  Use the prescription's exact medicines, dose, schedule, duration, and quantity. Never add, infer, or change any medicine or dose. If a direction is missing, say it is not specified and ask the patient to confirm with the prescriber or pharmacist. Do not treat medicine knowledge as proof of the patient's diagnosis or the reason a medicine was selected. Keep medicine names in English; write advice in ${language}.
  
  Return an actionable and non-repetitive recovery_plan JSON object:
  - medicine_guidance: one item per prescribed medicine with name, purpose (only if supported by the written diagnosis/instructions; otherwise say ask the prescriber), how_to_take (repeat exact instructions, state what is missing), and caution.
  - today: 2-4 specific steps to verify labels and follow the doctor's written instructions.
  - next_days: staged steps for today, the next 1-2 days, and until the prescribed course/follow-up. Never invent a course length.
  - food: meal guidance only when supported by diagnosis or written doctor instructions; otherwise suggest usual balanced meals as tolerated, no invented restrictions, and normal fluids unless restricted.
  - rest: practical recovery guidance without inventing an hours-per-day number or unnecessary bed rest.
  - watch_for: relevant warning signs; if context is insufficient, only general serious-reaction/emergency guidance.
  - follow_up: only the stated follow-up plan/date, or advise contacting the clinician for worsening/not improving.
  Use short clear sentences. Avoid generic filler, repeated disclaimers, unsolicited drug recommendations, and promises of recovery.
  
  You MUST respond ONLY in valid JSON format matching this schema:
  {
    "explanation": "string (brief summary without generic filler)",
    "recovery_plan": {
      "medicine_guidance": [{"name": "string", "purpose": "string", "how_to_take": "string", "caution": "string"}],
      "today": ["string"],
      "next_days": ["string"],
      "food": ["string"],
      "rest": ["string"],
      "watch_for": ["string"],
      "follow_up": ["string"]
    }
  }
  `;

  if (isXaiValid) {
    try {
      console.log('[AI] Generating digital prescription explanation using xAI (Grok)...');
      const modelName = process.env.XAI_MODEL || process.env.GROK_MODEL || 'grok-2-1212';
      
      const response = await axios.post('https://api.x.ai/v1/chat/completions', {
        model: modelName,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Authorization': `Bearer ${xaiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const respText = response.data.choices[0].message.content.trim();
      result.raw_response = respText;

      const data = JSON.parse(respText);
      let explanationHtml = data.explanation || '';
      result.recovery_plan = normalizeRecoveryPlan(
        data.recovery_plan,
        createFallbackRecoveryPlan(medicines, diagnosis, doctorNotes, followUpDate)
      );

      if (doctorNotes) {
        const notesBlock = `
          <div style="background:#f3f4f6; padding:12px 16px; border-radius:8px; margin-bottom:20px; font-size:0.88rem; border-left:4px solid #9ca3af; color:#374151;">
          <strong>Doctor's Clinical Guidance:</strong><br/>${escapeHtml(doctorNotes)}
          </div>
        `;
        explanationHtml = notesBlock + explanationHtml;
      }

      const quoteBlock = `
        <div style="text-align:center; margin-top:20px; border-top:1px solid #e5e7eb; padding-top:15px;">
        <p style="font-size:1.15rem; color:#4f46e5; font-weight:bold; margin:0 0 4px 0;">❤️ Get Well Soon!</p>
        <p style="font-size:0.82rem; color:#6b7280; margin:0; font-style:italic;">"Your health is our priority. Wishing you a speedy recovery!"</p>
        </div>
      `;
      explanationHtml = explanationHtml + quoteBlock;

      result.explanation = sanitizeAiHtml(explanationHtml);
      result.status = 'success';
      return result;
    } catch (error) {
      console.error(`[AI] xAI digital explanation generator failed: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY || '';
  const isGeminiValid = geminiKey && !geminiKey.startsWith('PASTE_YOUR');

  if (isGeminiValid) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });

      console.log(`[AI] Generating digital prescription explanation in ${language} using Gemini...`);
      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });
      
      const respText = response.response.text().trim();
      result.raw_response = respText;

      const data = JSON.parse(respText);
      let explanationHtml = data.explanation || '';
      result.recovery_plan = normalizeRecoveryPlan(
        data.recovery_plan,
        createFallbackRecoveryPlan(medicines, diagnosis, doctorNotes, followUpDate)
      );

      if (doctorNotes) {
        const notesBlock = `
          <div style="background:#f3f4f6; padding:12px 16px; border-radius:8px; margin-bottom:20px; font-size:0.88rem; border-left:4px solid #9ca3af; color:#374151;">
          <strong>Doctor's Clinical Guidance:</strong><br/>${escapeHtml(doctorNotes)}
          </div>
        `;
        explanationHtml = notesBlock + explanationHtml;
      }

      const quoteBlock = `
        <div style="text-align:center; margin-top:20px; border-top:1px solid #e5e7eb; padding-top:15px;">
        <p style="font-size:1.15rem; color:#4f46e5; font-weight:bold; margin:0 0 4px 0;">❤️ Get Well Soon!</p>
        <p style="font-size:0.82rem; color:#6b7280; margin:0; font-style:italic;">"Your health is our priority. Wishing you a speedy recovery!"</p>
        </div>
      `;
      explanationHtml = explanationHtml + quoteBlock;

      result.explanation = sanitizeAiHtml(explanationHtml);
      result.status = 'success';
      return result;
    } catch (error) {
      console.error(`[AI] Gemini digital explanation generator failed: ${error.message}`);
    }
  }

  result.recovery_plan = createFallbackRecoveryPlan(medicines, diagnosis, doctorNotes, followUpDate);
  result.explanation = sanitizeAiHtml(generateFallbackExplanation(
    medicines,
    doctorNotes,
    diagnosis,
    followUpDate
  ));
  result.status = 'fallback';

  return result;
}

module.exports = {
  explainPrescriptionWithAi,
  generateDigitalPrescriptionExplanation,
  createFallbackRecoveryPlan
};
