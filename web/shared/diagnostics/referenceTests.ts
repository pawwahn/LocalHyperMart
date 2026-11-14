export type DiagnosticsReferenceTest = {
  code: string;
  label: string;
  hint?: string;
  fastingNote?: string;
  prescriptionRequired?: boolean;
  homeCollection?: boolean;
  category: string;
};

export const DIAGNOSTICS_TEST_CATEGORIES = [
  { id: 'ROUTINE', label: 'Routine blood', emoji: '🩸' },
  { id: 'DIABETES', label: 'Diabetes', emoji: '🍬' },
  { id: 'LIPID', label: 'Lipid & heart', emoji: '❤️' },
  { id: 'LIVER_KIDNEY', label: 'Liver & kidney', emoji: '🫀' },
  { id: 'THYROID', label: 'Thyroid & hormones', emoji: '🦋' },
  { id: 'VITAMINS', label: 'Vitamins & iron', emoji: '💊' },
  { id: 'URINE', label: 'Urine & stool', emoji: '🧪' },
  { id: 'INFECTION', label: 'Fever & infection', emoji: '🌡️' },
  { id: 'OTHER', label: 'Other', emoji: '➕' },
] as const;

export const DIAGNOSTICS_REFERENCE_TESTS: DiagnosticsReferenceTest[] = [
  { code: 'CBC', label: 'Complete blood count (CBC)', category: 'ROUTINE' },
  { code: 'ESR', label: 'ESR', category: 'ROUTINE' },
  { code: 'FBS', label: 'Fasting blood sugar', fastingNote: '8–12 hr fast', category: 'DIABETES' },
  { code: 'PPBS', label: 'Post-prandial blood sugar', fastingNote: '2 hr after meal', category: 'DIABETES' },
  { code: 'RBS', label: 'Random blood sugar', category: 'DIABETES' },
  { code: 'HBA1C', label: 'HbA1c', category: 'DIABETES' },
  { code: 'LIPID_PROFILE', label: 'Lipid profile', fastingNote: '10–12 hr fast', category: 'LIPID' },
  { code: 'CRP', label: 'C-Reactive protein (CRP)', category: 'LIPID' },
  { code: 'LFT', label: 'Liver function test (LFT)', category: 'LIVER_KIDNEY' },
  { code: 'SGPT_ALT', label: 'SGPT (ALT)', category: 'LIVER_KIDNEY' },
  { code: 'SGOT_AST', label: 'SGOT (AST)', category: 'LIVER_KIDNEY' },
  { code: 'KFT', label: 'Kidney function test (KFT)', category: 'LIVER_KIDNEY' },
  { code: 'CREATININE', label: 'Serum creatinine', category: 'LIVER_KIDNEY' },
  { code: 'UREA', label: 'Blood urea', category: 'LIVER_KIDNEY' },
  { code: 'TSH', label: 'TSH', category: 'THYROID' },
  { code: 'THYROID_PROFILE', label: 'Thyroid profile (T3, T4, TSH)', category: 'THYROID' },
  { code: 'BETA_HCG', label: 'Beta HCG (pregnancy)', category: 'THYROID' },
  { code: 'VIT_D', label: 'Vitamin D (25-OH)', category: 'VITAMINS' },
  { code: 'VIT_B12', label: 'Vitamin B12', category: 'VITAMINS' },
  { code: 'FERRITIN', label: 'Ferritin', category: 'VITAMINS' },
  { code: 'URINE_RME', label: 'Urine routine (RME)', category: 'URINE' },
  { code: 'DENGUE_NS1', label: 'Dengue NS1 antigen', category: 'INFECTION' },
  { code: 'MALARIA_AG', label: 'Malaria antigen', category: 'INFECTION' },
  { code: 'BLOOD_GROUP', label: 'Blood group & Rh', category: 'OTHER' },
];

export type DiagnosticsReferencePackage = {
  code: string;
  label: string;
  memberTestCodes: string[];
};

export const DIAGNOSTICS_REFERENCE_PACKAGES: DiagnosticsReferencePackage[] = [
  {
    code: 'PKG_BASIC_HEALTH',
    label: 'Basic health checkup',
    memberTestCodes: ['CBC', 'FBS', 'LFT', 'KFT', 'URINE_RME', 'LIPID_PROFILE'],
  },
  {
    code: 'PKG_FULL_BODY_STD',
    label: 'Full body checkup — standard',
    memberTestCodes: ['CBC', 'FBS', 'LFT', 'KFT', 'URINE_RME', 'LIPID_PROFILE', 'TSH', 'VIT_D', 'VIT_B12', 'HBA1C'],
  },
  {
    code: 'PKG_DIABETES',
    label: 'Diabetes care panel',
    memberTestCodes: ['FBS', 'HBA1C', 'LIPID_PROFILE', 'CREATININE', 'URINE_RME'],
  },
  {
    code: 'PKG_THYROID',
    label: 'Thyroid panel',
    memberTestCodes: ['THYROID_PROFILE'],
  },
  {
    code: 'PKG_LIVER',
    label: 'Liver panel',
    memberTestCodes: ['LFT', 'SGPT_ALT', 'SGOT_AST'],
  },
  {
    code: 'PKG_KIDNEY',
    label: 'Kidney panel',
    memberTestCodes: ['KFT', 'CREATININE', 'UREA', 'URINE_RME'],
  },
  {
    code: 'PKG_ANEMIA',
    label: 'Anemia profile',
    memberTestCodes: ['CBC', 'FERRITIN', 'VIT_B12'],
  },
  {
    code: 'PKG_FEVER',
    label: 'Fever / infection screen',
    memberTestCodes: ['CBC', 'CRP', 'DENGUE_NS1', 'MALARIA_AG'],
  },
];

export function slugDiagnosticsCustomCode(label: string): string {
  const base = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  return base ? `CUS_${base}` : `CUS_${Date.now()}`;
}

export function referenceTestByCode(code: string): DiagnosticsReferenceTest | undefined {
  const key = code.trim().toUpperCase();
  return DIAGNOSTICS_REFERENCE_TESTS.find((row) => row.code === key);
}

/** Lab catalog note first; else standard prep hint from reference test code (buyer-facing). */
export function displayFastingPrepForTest(test: {
  code?: string | null;
  fastingNote?: string | null;
}): string | undefined {
  const fromLab = test.fastingNote?.trim();
  if (fromLab) return fromLab;
  const code = test.code?.trim();
  if (!code) return undefined;
  return referenceTestByCode(code)?.fastingNote?.trim() || undefined;
}
