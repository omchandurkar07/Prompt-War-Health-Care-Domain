const DRUG_CLASS_MAP = {
  'penicillin': ['amoxicillin', 'ampicillin', 'piperacillin', 'nafcillin', 'dicloxacillin'],
  'cephalosporin': ['ceftriaxone', 'cefixime', 'cephalexin', 'cefuroxime', 'cefazolin'],
  'sulfa': ['sulfamethoxazole', 'sulfasalazine', 'trimethoprim'],
  'nsaid': ['ibuprofen', 'naproxen', 'diclofenac', 'aspirin', 'indomethacin', 'piroxicam', 'meloxicam'],
  'statin': ['atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'lovastatin'],
  'ace inhibitor': ['enalapril', 'lisinopril', 'ramipril', 'captopril', 'perindopril'],
  'fluoroquinolone': ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin'],
  'macrolide': ['azithromycin', 'clarithromycin', 'erythromycin'],
  'opioid': ['tramadol', 'codeine', 'morphine', 'fentanyl', 'oxycodone'],
  'benzodiazepine': ['alprazolam', 'diazepam', 'clonazepam', 'lorazepam', 'midazolam'],
  'ssri': ['sertraline', 'fluoxetine', 'escitalopram', 'paroxetine', 'citalopram'],
  'tetracycline': ['doxycycline', 'tetracycline', 'minocycline'],
};

const DRUG_INTERACTIONS = [
  { drug_a: 'warfarin', drug_b: 'aspirin', warning: 'Increased bleeding risk' },
  { drug_a: 'metformin', drug_b: 'contrast dye', warning: 'Risk of lactic acidosis' },
  { drug_a: 'warfarin', drug_b: 'ibuprofen', warning: 'Increased bleeding risk' },
  { drug_a: 'lisinopril', drug_b: 'potassium', warning: 'Risk of hyperkalemia' },
  { drug_a: 'metformin', drug_b: 'alcohol', warning: 'Risk of hypoglycemia' },
  { drug_a: 'digoxin', drug_b: 'amiodarone', warning: 'Digoxin toxicity risk' },
  { drug_a: 'simvastatin', drug_b: 'amlodipine', warning: 'Increased risk of myopathy' },
  { drug_a: 'clopidogrel', drug_b: 'omeprazole', warning: 'Reduced antiplatelet effect' },
  { drug_a: 'ssri', drug_b: 'tramadol', warning: 'Serotonin syndrome risk' },
  { drug_a: 'ace inhibitor', drug_b: 'spironolactone', warning: 'Hyperkalemia risk' },
];

const checkAllergyMatch = (drugName, allergyList) => {
  const warnings = [];
  const drugLower = (drugName || '').toLowerCase();
  
  allergyList.forEach(allergy => {
    const al = (allergy || '').toLowerCase().trim();
    if (!al) return;

    // Direct match
    if (drugLower.includes(al) || al.includes(drugLower)) {
      warnings.push(`🔴 ALLERGY: Patient is allergic to "${allergy}". Drug "${drugName}" matches directly.`);
      return;
    }

    // Class match: allergy is a class name, drug belongs to that class
    if (DRUG_CLASS_MAP[al]) {
      const match = DRUG_CLASS_MAP[al].some(member => drugLower.includes(member) || member.includes(drugLower));
      if (match) {
        warnings.push(`🔴 ALLERGY: Patient is allergic to "${allergy}" class. Drug "${drugName}" belongs to this class.`);
        return;
      }
    }

    // Class match: drug is in a class, allergy is another member of the same class
    for (const [clsName, members] of Object.entries(DRUG_CLASS_MAP)) {
      const drugInClass = members.some(m => drugLower.includes(m) || m.includes(drugLower));
      const allergyInClass = members.some(m => al.includes(m) || m.includes(al)) || al === clsName;
      if (drugInClass && allergyInClass) {
        if (!warnings.some(w => w.includes(drugName))) {
          warnings.push(`🟡 CLASS: "${drugName}" is in the same drug class (${clsName}) as allergy "${allergy}".`);
        }
        break;
      }
    }
  });

  return warnings;
};

const checkDrugInteractions = (newDrug, existingDrugs) => {
  const warnings = [];
  const newLower = (newDrug || '').toLowerCase();

  DRUG_INTERACTIONS.forEach(interaction => {
    existingDrugs.forEach(existing => {
      const exLower = (existing || '').toLowerCase();
      
      const matchA = newLower.includes(interaction.drug_a) || interaction.drug_a.includes(newLower);
      const matchB = exLower.includes(interaction.drug_b) || interaction.drug_b.includes(exLower);
      const reverseMatchA = newLower.includes(interaction.drug_b) || interaction.drug_b.includes(newLower);
      const reverseMatchB = exLower.includes(interaction.drug_a) || interaction.drug_a.includes(exLower);

      if ((matchA && matchB) || (reverseMatchA && reverseMatchB)) {
        warnings.push(`⚠️ ${newDrug} + ${existing}: ${interaction.warning}`);
      }
    });
  });

  return warnings;
};

const generateCdsWarnings = (patientDob, chronicConditionsText = '', allergiesText = '', medicines = [], existingMeds = []) => {
  const warnings = [];

  // 1. Age check
  if (patientDob) {
    try {
      const dob = new Date(patientDob);
      const age = new Date().getFullYear() - dob.getFullYear();
      if (age >= 65) {
        medicines.forEach(m => {
          const name = typeof m === 'object' ? m.name : String(m);
          warnings.push(`⚠️ Elderly patient (${age}y): review dose/monitor for "${name}"`);
        });
      }
    } catch (e) {}
  }

  // 2. Renal impairment check
  const cond = (chronicConditionsText || '').toLowerCase();
  const kidneyKeywords = ['kidney', 'ckd', 'renal', 'dialysis', 'kidney disease'];
  if (kidneyKeywords.some(k => cond.includes(k))) {
    medicines.forEach(m => {
      const name = typeof m === 'object' ? m.name : String(m);
      warnings.push(`⚠️ Possible renal impairment: consider renal dose adjustment for "${name}"`);
    });
  }

  // 3. Allergy checks
  const allergies = (allergiesText || '').split(',').map(a => a.trim()).filter(Boolean);
  medicines.forEach(m => {
    const medname = typeof m === 'object' ? m.name : String(m);
    try {
      const allergyWarnings = checkAllergyMatch(medname, allergies);
      warnings.push(...allergyWarnings);
    } catch (e) {}
  });

  // 4. Interaction checks
  const existingTitles = existingMeds.map(em => typeof em === 'object' ? em.name : String(em));
  medicines.forEach(m => {
    const medname = typeof m === 'object' ? m.name : String(m);
    try {
      const interactionWarnings = checkDrugInteractions(medname, existingTitles);
      warnings.push(...interactionWarnings);
    } catch (e) {}
  });

  // Deduplicate warnings
  return [...new Set(warnings)];
};

module.exports = {
  checkAllergyMatch,
  checkDrugInteractions,
  generateCdsWarnings
};
