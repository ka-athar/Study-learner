/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Subject, 
  MistakeEntry, 
  ExamDate, 
  EmergencyCramSheet, 
  CriticalFormulaEntry, 
  MistakeTrapWarning, 
  HighYieldDefinition, 
  EmergencyConfidenceQuestion 
} from '../types';
import { loadMistakes } from './mistakeVaultStorage';

const CRAM_SHEET_STORAGE_KEY = 'academic_emergency_cram_sheets_v1';

/**
 * Calculates impending exams within 48-72 hours.
 */
export function getImpendingExams(examDates: ExamDate[] = []): Array<{
  exam: ExamDate;
  hoursRemaining: number;
  isUrgent: boolean; // within 24h
}> {
  const now = Date.now();
  const list: Array<{ exam: ExamDate; hoursRemaining: number; isUrgent: boolean }> = [];

  examDates.forEach(exam => {
    if (!exam.date) return;
    const examTime = new Date(`${exam.date}T09:00:00`).getTime();
    const diffMs = examTime - now;
    const hoursRemaining = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));

    // Active if in the future within 96 hours (4 days) or today
    if (diffMs > -86400000 && hoursRemaining <= 96) {
      list.push({
        exam,
        hoursRemaining,
        isUrgent: hoursRemaining <= 24
      });
    }
  });

  return list.sort((a, b) => a.hoursRemaining - b.hoursRemaining);
}

/**
 * Subject-specific high-yield formula catalogs with known board trap notes
 */
const SUBJECT_FORMULA_CATALOG: Record<string, CriticalFormulaEntry[]> = {
  physics: [
    {
      id: 'f-phys-1',
      label: 'Centripetal Force & Acceleration',
      formula: 'F_c = (m · v²) / r = m · ω² · r',
      trapNote: 'Do NOT forget to square velocity! Remember r is the radius of the curvature, not diameter.',
      unitConstraint: 'Radius must be converted to standard meters (m), not cm.',
      topicName: 'Circular Motion'
    },
    {
      id: 'f-phys-2',
      label: 'Carnot Heat Engine Efficiency',
      formula: 'η = 1 - (T_C / T_H) = (T_H - T_C) / T_H',
      trapNote: 'CRITICAL: Temperatures T_C and T_H MUST be in Absolute Kelvin (K = °C + 273.15), never Celsius!',
      unitConstraint: 'Temperatures in Kelvin (K).',
      topicName: 'Thermodynamics'
    },
    {
      id: 'f-phys-3',
      label: 'Photoelectric Work Function & Kinetic Energy',
      formula: 'K_max = h·f - Φ = (h·c / λ) - Φ',
      trapNote: 'Convert Electron-Volts (eV) to Joules (1 eV = 1.6 × 10⁻¹⁹ J) before subtracting.',
      unitConstraint: 'Energy in Joules (J), Planck constant h in J·s.',
      topicName: 'Modern Physics'
    },
    {
      id: 'f-phys-4',
      label: 'Doppler Effect for Sound Waves',
      formula: 'f_obs = f_src · [(v ± v_obs) / (v ∓ v_src)]',
      trapNote: 'Top sign is towards, bottom sign is away. Draw velocity vectors before selecting signs.',
      unitConstraint: 'Speeds in m/s.',
      topicName: 'Waves & Oscillations'
    },
    {
      id: 'f-phys-5',
      label: 'Snell’s Law & Critical Angle',
      formula: 'n₁ · sin(θ₁) = n₂ · sin(θ₂) | sin(θ_c) = n₂ / n₁ (n₁ > n₂)',
      trapNote: 'Angle θ is measured strictly relative to the NORMAL, not the plane boundary surface!',
      unitConstraint: 'Angles in degrees or radians; dimensionless index.',
      topicName: 'Optics'
    }
  ],
  chemistry: [
    {
      id: 'f-chem-1',
      label: 'Equilibrium Constant (Kc vs Kp)',
      formula: 'K_p = K_c · (R · T)^(Δn_gas)',
      trapNote: 'Δn_gas counts ONLY gas molecules: (moles gas products) - (moles gas reactants). Ignore solids and liquids!',
      unitConstraint: 'R = 0.0821 L·atm/(mol·K) or 8.314 J/(mol·K). T in Kelvin.',
      topicName: 'Chemical Equilibrium'
    },
    {
      id: 'f-chem-2',
      label: 'Nernst Equation (Electrode Potential)',
      formula: 'E_cell = E°_cell - (0.0592 / n) · log₁₀(Q)',
      trapNote: 'n is the number of transferred electrons in the balanced redox equation. Q = [Products] / [Reactants].',
      unitConstraint: 'Concentrations in mol/dm³ (M).',
      topicName: 'Electrochemistry'
    },
    {
      id: 'f-chem-3',
      label: 'Buffer Solution pH (Henderson-Hasselbalch)',
      formula: 'pH = pKa + log₁₀([Conjugate Base] / [Acid])',
      trapNote: 'Do not invert the ratio! Adding strong acid shifts ratio downwards.',
      unitConstraint: 'Molar concentrations or mole ratio.',
      topicName: 'Acids, Bases & Salts'
    },
    {
      id: 'f-chem-4',
      label: 'First-Order Reaction Half-Life & Rate Law',
      formula: 't₁/₂ = 0.693 / k | ln([A]_t / [A]₀) = -k · t',
      trapNote: 'Half-life for first order is independent of initial concentration [A]₀.',
      unitConstraint: 'Rate constant k in s⁻¹ or min⁻¹.',
      topicName: 'Chemical Kinetics'
    }
  ],
  mathematics: [
    {
      id: 'f-math-1',
      label: 'Integration by Parts',
      formula: '∫ u · v\' dx = u · v - ∫ v · u\' dx',
      trapNote: 'Use LIATE rule to choose u (Logarithmic, Inverse trig, Algebraic, Trigonometric, Exponential).',
      topicName: 'Integration'
    },
    {
      id: 'f-math-2',
      label: 'Roots of Quadratic Equation & Discriminant',
      formula: 'x = [-b ± √(b² - 4ac)] / (2a)',
      trapNote: 'Denominator is 2a, not 2! Check Δ = b² - 4ac (< 0 yields complex roots).',
      topicName: 'Algebra'
    },
    {
      id: 'f-math-3',
      label: 'Binomial Expansion General Term',
      formula: 'T_(r+1) = (n C r) · a^(n-r) · b^r',
      trapNote: 'The (r+1)-th term uses power r, not (r+1). Pay strict attention to negative signs in b.',
      topicName: 'Binomial Theorem'
    }
  ],
  biology: [
    {
      id: 'f-bio-1',
      label: 'Hardy-Weinberg Equilibrium Formula',
      formula: 'p + q = 1 | p² + 2pq + q² = 1',
      trapNote: 'p² = homozygous dominant, 2pq = heterozygous carriers, q² = homozygous recessive individuals.',
      topicName: 'Genetics & Evolution'
    },
    {
      id: 'f-bio-2',
      label: 'Magnification & Microscopic Resolution',
      formula: 'Magnification = Image Size / Actual Size (M = I / A)',
      trapNote: 'Both Image size and Actual size must be in identical units (convert mm to μm: 1 mm = 1000 μm)!',
      topicName: 'Cell Biology'
    }
  ]
};

/**
 * Subject-specific high-yield definitions
 */
const SUBJECT_DEFINITIONS: Record<string, HighYieldDefinition[]> = {
  physics: [
    {
      id: 'd-phys-1',
      term: 'Simple Harmonic Motion (SHM)',
      definition: 'Periodic motion where acceleration is directly proportional to displacement from equilibrium position and always directed towards that equilibrium position (a = -ω²x).',
      keyPhrases: ['proportional to displacement', 'directed towards equilibrium', 'a = -ω²x']
    },
    {
      id: 'd-phys-2',
      term: 'Electric Potential at a Point',
      definition: 'Work done per unit positive charge in bringing a small test charge from infinity to that point against electrostatic forces (V = W / q).',
      keyPhrases: ['work done per unit positive charge', 'from infinity to that point']
    },
    {
      id: 'd-phys-3',
      term: 'Lenz’s Law',
      definition: 'The direction of an induced electromotive force (EMF) always opposes the change in magnetic flux that produces it.',
      keyPhrases: ['opposes the change in magnetic flux', 'conservation of energy']
    }
  ],
  chemistry: [
    {
      id: 'd-chem-1',
      term: 'Le Chatelier’s Principle',
      definition: 'If a chemical system at equilibrium experiences a change in temperature, pressure, or concentration, the system shifts its equilibrium position to counteract that change.',
      keyPhrases: ['shifts equilibrium position', 'counteract the imposed change']
    },
    {
      id: 'd-chem-2',
      term: 'Standard Enthalpy of Formation (ΔH°f)',
      definition: 'Enthalpy change when one mole of a compound is formed from its constituent elements in their standard states under standard conditions (298 K, 1 atm).',
      keyPhrases: ['one mole of compound', 'constituent elements in standard states', '298 K and 1 atm']
    }
  ],
  biology: [
    {
      id: 'd-bio-1',
      term: 'Osmoregulation & Water Potential',
      definition: 'The active regulation of osmotic pressure of bodily fluids to maintain homeostasis of water content. Water moves from higher (less negative) to lower (more negative) water potential.',
      keyPhrases: ['active regulation', 'water potential gradient', 'homeostasis']
    },
    {
      id: 'd-bio-2',
      term: 'Allosteric Enzyme Regulation',
      definition: 'Regulation of enzyme activity through binding of an effector molecule at a site other than the enzyme\'s active site (the allosteric site), causing a conformational change.',
      keyPhrases: ['effector molecule', 'site other than active site', 'conformational change']
    }
  ],
  mathematics: [
    {
      id: 'd-math-1',
      term: 'Continuous Function (Epsilon-Delta Definition)',
      definition: 'A function f(x) is continuous at x = c if limit as x approaches c equals f(c), meaning no jumps, holes, or vertical asymptotes.',
      keyPhrases: ['limit as x approaches c equals f(c)', 'defined at c']
    }
  ]
};

/**
 * 5-Question Confidence Primer banks
 */
const CONFIDENCE_PRIMER_BANKS: Record<string, EmergencyConfidenceQuestion[]> = {
  physics: [
    {
      id: 'q-phys-1',
      question: 'What is the work done on an object moving at constant speed along a circular path over one complete orbit?',
      answer: 'Zero Joules (W = 0). Centripetal force acts perpendicular to the instantaneous velocity displacement (cos 90° = 0).',
      keyTrap: 'Don\'t calculate circumference times force — displacement over a full cycle is zero and force is orthogonal.',
      subjectName: 'Physics',
      topicName: 'Work & Energy'
    },
    {
      id: 'q-phys-2',
      question: 'If temperature of a gas rises from 27°C to 327°C, by what factor does root-mean-square speed (v_rms) increase?',
      answer: 'By a factor of √2 ≈ 1.414. (27°C = 300 K; 327°C = 600 K; v_rms ∝ √T, so √(600/300) = √2).',
      keyTrap: 'Do NOT use Celsius ratio (327/27)! Always convert to Kelvin.',
      subjectName: 'Physics',
      topicName: 'Thermal Physics'
    },
    {
      id: 'q-phys-3',
      question: 'When light passes from water (n=1.33) into air (n=1.00), which of frequency, wavelength, or speed changes?',
      answer: 'Speed increases and wavelength increases. Frequency remains constant (determined by the source).',
      keyTrap: 'Frequency NEVER changes across refractive interfaces.',
      subjectName: 'Physics',
      topicName: 'Wave Optics'
    },
    {
      id: 'q-phys-4',
      question: 'State the direction of magnetic force on a positively charged particle moving parallel to magnetic field B.',
      answer: 'Zero magnetic force (F = q·v·B·sin(0°) = 0).',
      keyTrap: 'Only perpendicular component creates magnetic deflection.',
      subjectName: 'Physics',
      topicName: 'Electromagnetism'
    },
    {
      id: 'q-phys-5',
      question: 'What is the sign of acceleration for an object thrown vertically upward at the highest point of its trajectory?',
      answer: 'Negative (-9.8 m/s² or directed downwards). Even though velocity is zero, acceleration due to gravity is constant.',
      keyTrap: 'Velocity is 0 at the peak, but acceleration is NOT zero.',
      subjectName: 'Physics',
      topicName: 'Kinematics'
    }
  ],
  chemistry: [
    {
      id: 'q-chem-1',
      question: 'How does an increase in pressure affect the equilibrium position of N₂(g) + 3H₂(g) ⇌ 2NH₃(g)?',
      answer: 'Shifts equilibrium forward (to the right) toward the side with fewer gas molecules (4 moles reactant vs 2 moles product).',
      keyTrap: 'Check total gas moles on each side before applying pressure shifts.',
      subjectName: 'Chemistry',
      topicName: 'Equilibrium'
    },
    {
      id: 'q-chem-2',
      question: 'What is the oxidation state of Chromium in Cr₂O₇²⁻?',
      answer: '+6 (2x + 7(-2) = -2 ⇒ 2x - 14 = -2 ⇒ 2x = 12 ⇒ x = +6).',
      keyTrap: 'Remember the overall polyatomic charge is -2, not 0.',
      subjectName: 'Chemistry',
      topicName: 'Redox Reactions'
    },
    {
      id: 'q-chem-3',
      question: 'What catalyst is used in the Contact process for sulfuric acid production?',
      answer: 'Vanadium(V) oxide (V₂O₅) at approximately 450°C and 1–2 atm.',
      keyTrap: 'Do not confuse with Iron (Fe) used in Haber process.',
      subjectName: 'Chemistry',
      topicName: 'Industrial Chemistry'
    },
    {
      id: 'q-chem-4',
      question: 'Why does ethanol have a much higher boiling point than dimethyl ether despite identical molecular formulas (C₂H₆O)?',
      answer: 'Ethanol forms intermolecular hydrogen bonds (via -OH group), whereas dimethyl ether only forms weak dipole-dipole interactions.',
      keyTrap: 'State hydrogen bonding specifically, not just general dipole forces.',
      subjectName: 'Chemistry',
      topicName: 'Organic Chemistry'
    },
    {
      id: 'q-chem-5',
      question: 'What is the pH of a 0.001 M solution of strong monobasic acid HCl?',
      answer: 'pH = 3.0 (-log₁₀(10⁻³) = 3).',
      keyTrap: 'Check if acid is strong (fully dissociated) before applying Henderson-Hasselbalch.',
      subjectName: 'Chemistry',
      topicName: 'Acids and Bases'
    }
  ]
};

/**
 * Synthesizes an authoritative Emergency Cram Sheet tailored directly to the student's
 * real historical mistakes and weak syllabus points.
 */
export function generateEmergencyCramSheet(params: {
  subjectName: string;
  examTitle?: string;
  examDate?: string;
  examId?: string;
  subjects?: Subject[];
  mistakes?: MistakeEntry[];
}): EmergencyCramSheet {
  const {
    subjectName,
    examTitle = `${subjectName} Board Paper`,
    examDate = new Date().toISOString().split('T')[0],
    examId,
    subjects = [],
    mistakes = loadMistakes()
  } = params;

  const now = Date.now();
  const examTime = new Date(`${examDate}T09:00:00`).getTime();
  const hoursRemaining = Math.max(0, Math.round((examTime - now) / (1000 * 60 * 60)));

  const cleanSub = subjectName.toLowerCase();
  const subCategoryKey = cleanSub.includes('chem') 
    ? 'chemistry' 
    : cleanSub.includes('bio') 
    ? 'biology' 
    : cleanSub.includes('math') 
    ? 'mathematics' 
    : 'physics';

  // 1. Triage Classification (Solid vs Volatile vs Shelve)
  const targetSub = subjects.find(s => s.name.toLowerCase() === subjectName.toLowerCase());
  const protectTopics: string[] = [];
  const cramTopics: string[] = [];
  const shelveTopics: string[] = [];

  if (targetSub) {
    targetSub.chapters.forEach(ch => {
      ch.topics.forEach(t => {
        if (t.status === 'Mastered') {
          protectTopics.push(t.name);
        } else if (t.status === 'Needs Revision' || t.status === 'Weak') {
          cramTopics.push(t.name);
        } else if (t.status === 'Not Started') {
          shelveTopics.push(t.name);
        } else {
          cramTopics.push(t.name);
        }
      });
    });
  }

  // Fallbacks if fresh dataset
  if (cramTopics.length === 0) {
    cramTopics.push('High-Yield Problem Solving & Formula Application', 'Exam Marking Key Terminology');
  }
  if (protectTopics.length === 0) {
    protectTopics.push('Fundamental Core Definitions & SI Units');
  }

  // 2. Critical Formulas
  const formulasCatalog = SUBJECT_FORMULA_CATALOG[subCategoryKey] || SUBJECT_FORMULA_CATALOG.physics;

  // 3. Mistake Traps (from student's logged mistake vault)
  const relevantMistakes = mistakes.filter(m => 
    (m.subjectName || '').toLowerCase().includes(subCategoryKey) ||
    (m.subjectName || '').toLowerCase() === cleanSub
  );

  const mistakeTraps: MistakeTrapWarning[] = relevantMistakes.slice(0, 5).map(m => ({
    id: m.id,
    concept: m.topicName || m.question.slice(0, 40),
    warning: m.notes || `Careless slip on ${m.errorCategory}: ${m.correctAnswer || 'Double-check working margin'}`,
    mistakeCount: (m.history?.length || 1) + 1,
    examQuestionSnippet: m.question
  }));

  // Add default baseline trap if student has fewer logged mistakes
  if (mistakeTraps.length < 3) {
    mistakeTraps.push({
      id: 'default-trap-1',
      concept: 'SI Unit Conversion & Prefix Omission',
      warning: 'Writing answers in cm, g, or mm without converting to SI meters (m) or kilograms (kg) before equation insertion.',
      mistakeCount: 4,
      examQuestionSnippet: 'Convert all dimensions explicitly in margin before calculating.'
    });
    mistakeTraps.push({
      id: 'default-trap-2',
      concept: 'Sign Conventions in Governing Laws',
      warning: 'Failing to establish reference coordinate axis (+y upward, -y downward) before applying Newton or Kirchhoff laws.',
      mistakeCount: 3,
      examQuestionSnippet: 'Explicitly mark positive direction arrow on diagrams.'
    });
  }

  // 4. High-Yield Definitions
  const highYieldDefs = SUBJECT_DEFINITIONS[subCategoryKey] || SUBJECT_DEFINITIONS.physics;

  // 5. Examiner Keyword Alerts
  const examinerKeywordAlerts = [
    'State vs Explain: "State" needs only the fact; "Explain" requires cause-and-effect ("because", "therefore").',
    'Explicit formula statement: Examiners penalize numbers substituted without writing general formula first.',
    'Significant figures: Match the least number of significant figures in the given question data.',
    'Always state proper SI units: Missing units forfeit 1 mark even with correct numerical answer.'
  ];

  // 6. Confidence Primer
  const primerQuestions = CONFIDENCE_PRIMER_BANKS[subCategoryKey] || CONFIDENCE_PRIMER_BANKS.physics;

  const cramSheet: EmergencyCramSheet = {
    id: `cram-${subjectName}-${Date.now()}`,
    examId,
    subjectName,
    examTitle,
    examDate,
    hoursRemaining,
    triageClassification: {
      protectTopics: protectTopics.slice(0, 6),
      cramTopics: cramTopics.slice(0, 6),
      shelveTopics: shelveTopics.slice(0, 4)
    },
    criticalFormulas: formulasCatalog,
    mistakeTrapsToAvoid: mistakeTraps,
    highYieldDefinitions: highYieldDefs,
    examinerKeywordAlerts,
    confidencePrimerQuestions: primerQuestions,
    confidenceScore: Math.min(94, 60 + Math.round((protectTopics.length / (protectTopics.length + cramTopics.length + 1)) * 35)),
    createdAt: new Date().toISOString()
  };

  saveCramSheet(cramSheet);
  return cramSheet;
}

export function saveCramSheet(sheet: EmergencyCramSheet): void {
  try {
    const raw = localStorage.getItem(CRAM_SHEET_STORAGE_KEY);
    const map: Record<string, EmergencyCramSheet> = raw ? JSON.parse(raw) : {};
    map[sheet.subjectName.toLowerCase()] = sheet;
    localStorage.setItem(CRAM_SHEET_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save emergency cram sheet', err);
  }
}

export function loadSavedCramSheet(subjectName: string): EmergencyCramSheet | null {
  try {
    const raw = localStorage.getItem(CRAM_SHEET_STORAGE_KEY);
    if (!raw) return null;
    const map: Record<string, EmergencyCramSheet> = JSON.parse(raw);
    return map[subjectName.toLowerCase()] || null;
  } catch (err) {
    return null;
  }
}

/**
 * Opens dedicated high-contrast printable A4 window for the emergency cram sheet.
 */
export function openPrintableCramSheetWindow(sheet: EmergencyCramSheet): void {
  const printWindow = window.open('', '_blank', 'width=950,height=1100');
  if (!printWindow) {
    alert('Please allow popups to print your Emergency Cram Sheet.');
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Emergency Cram Sheet — ${sheet.subjectName} (${sheet.examDate})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 10px;
      font-size: 11px;
      line-height: 1.35;
    }
    .header-bar {
      border-bottom: 2px solid #111827;
      padding-bottom: 8px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .title {
      font-size: 18px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
    }
    .subtitle {
      font-size: 10px;
      color: #4b5563;
      margin-top: 2px;
    }
    .grid-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .section-box {
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 8px;
      background: #ffffff;
      break-inside: avoid;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1.5px solid #111827;
      padding-bottom: 3px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
    }
    .formula-row {
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px dashed #e5e7eb;
    }
    .formula-code {
      font-family: "Courier New", Courier, monospace;
      font-weight: 700;
      font-size: 11.5px;
      color: #000000;
      background: #f3f4f6;
      padding: 2px 4px;
      border-radius: 3px;
      display: inline-block;
      margin: 2px 0;
    }
    .trap-alert {
      font-size: 9.5px;
      color: #991b1b;
      font-weight: 600;
      line-height: 1.25;
    }
    .trap-card {
      margin-bottom: 5px;
      padding: 5px;
      background: #fff5f5;
      border-left: 3px solid #dc2626;
      border-radius: 2px;
    }
    .keyword-list {
      margin: 0;
      padding-left: 14px;
      font-size: 9.5px;
    }
    .keyword-list li {
      margin-bottom: 3px;
    }
    .triage-strip {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      background: #f9fafb;
      padding: 6px;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    .triage-col {
      flex: 1;
      font-size: 9.5px;
    }
    .triage-label {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9px;
      margin-bottom: 2px;
    }
    .footer-note {
      margin-top: 10px;
      text-align: center;
      font-size: 9px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      padding-top: 4px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div>
      <h1 class="title">${sheet.subjectName} — Emergency Cram Sheet</h1>
      <div class="subtitle">${sheet.examTitle} · Target Date: ${sheet.examDate} · Generated ${new Date().toLocaleDateString()}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 12px; font-weight: 800; color: #b91c1c;">HIGH-YIELD LAST-LOOK DOSSIER</div>
      <div style="font-size: 9.5px; color: #4b5563;">Confidence Index: ${sheet.confidenceScore}%</div>
    </div>
  </div>

  <div class="triage-strip">
    <div class="triage-col">
      <div class="triage-label" style="color: #047857;">✓ PROTECT (Do Not Over-Study)</div>
      <div>${sheet.triageClassification.protectTopics.join(' · ') || 'Core Baseline Topics'}</div>
    </div>
    <div class="triage-col">
      <div class="triage-label" style="color: #b45309;">⚡ CRAM (Highest ROI Mistakes)</div>
      <div>${sheet.triageClassification.cramTopics.join(' · ')}</div>
    </div>
    <div class="triage-col">
      <div class="triage-label" style="color: #6b7280;">✕ SHELVE (Drop to Prevent Panic)</div>
      <div>${sheet.triageClassification.shelveTopics.join(' · ') || 'None'}</div>
    </div>
  </div>

  <div class="grid-container">
    <!-- LEFT: CRITICAL FORMULAS & CONSTANTS -->
    <div class="section-box">
      <div class="section-title">
        <span>1. Critical Formulas & Known Traps</span>
        <span style="font-size: 9px; color: #6b7280;">Do not memorize blindly</span>
      </div>
      ${sheet.criticalFormulas.map(f => `
        <div class="formula-row">
          <div style="font-weight: 700; font-size: 10.5px;">${f.label}</div>
          <div class="formula-code">${f.formula}</div>
          <div class="trap-alert">⚠️ TRAP: ${f.trapNote}</div>
          ${f.unitConstraint ? `<div style="font-size: 9px; color: #4b5563;">Unit rule: ${f.unitConstraint}</div>` : ''}
        </div>
      `).join('')}
    </div>

    <!-- RIGHT: MISTAKE VAULT TRAPS & KEYWORDS -->
    <div class="section-box">
      <div class="section-title">
        <span>2. Your Logged Mistake Pitfalls</span>
        <span style="font-size: 9px; color: #b91c1c;">Historical Traps</span>
      </div>
      ${sheet.mistakeTrapsToAvoid.map(t => `
        <div class="trap-card">
          <div style="font-weight: 700; font-size: 10px; color: #7f1d1d;">${t.concept} (Missed ${t.mistakeCount}x)</div>
          <div style="font-size: 9.5px; color: #374151; margin-top: 1px;">${t.warning}</div>
        </div>
      `).join('')}

      <div class="section-title" style="margin-top: 10px;">
        <span>3. Examiner Keyword Penalties</span>
      </div>
      <ul class="keyword-list">
        ${sheet.examinerKeywordAlerts.map(k => `<li>${k}</li>`).join('')}
      </ul>

      <div class="section-title" style="margin-top: 10px;">
        <span>4. Core High-Yield Definitions</span>
      </div>
      ${sheet.highYieldDefinitions.map(d => `
        <div style="margin-bottom: 5px;">
          <div style="font-weight: 700; font-size: 10px;">${d.term}:</div>
          <div style="font-size: 9.5px; color: #374151;">${d.definition}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="footer-note">
    Official StudyFlow Academic Mastery System · Take this 1-page docket to your examination center · Stay calm, read questions twice, and write clearly.
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
