export type ThemeMode = 'light' | 'dark';

export type AccentId =
  | 'forest'
  | 'ocean'
  | 'amber'
  | 'berry'
  | 'teal'
  | 'slate'
  | 'coral';

export type ThemePreference = {
  mode: ThemeMode;
  accent: AccentId;
};

export type AccentPreset = {
  id: AccentId;
  label: string;
  accent: string;
  accentHover: string;
  accentSoftLight: string;
  accentSoftDark: string;
  rgb: string;
};

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: 'forest',
    label: 'Forest',
    accent: '#1B8B4C',
    accentHover: '#146B3A',
    accentSoftLight: '#E8F5EE',
    accentSoftDark: '#163527',
    rgb: '27, 139, 76',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    accent: '#2563EB',
    accentHover: '#1D4ED8',
    accentSoftLight: '#DBEAFE',
    accentSoftDark: '#1E2A4A',
    rgb: '37, 99, 235',
  },
  {
    id: 'amber',
    label: 'Amber',
    accent: '#C47B17',
    accentHover: '#9A5F10',
    accentSoftLight: '#FFF3DF',
    accentSoftDark: '#3A2A14',
    rgb: '196, 123, 23',
  },
  {
    id: 'berry',
    label: 'Berry',
    accent: '#BE185D',
    accentHover: '#9D174D',
    accentSoftLight: '#FCE7F3',
    accentSoftDark: '#3B1528',
    rgb: '190, 24, 93',
  },
  {
    id: 'teal',
    label: 'Teal',
    accent: '#0F766E',
    accentHover: '#0D5F59',
    accentSoftLight: '#CCFBF1',
    accentSoftDark: '#143532',
    rgb: '15, 118, 110',
  },
  {
    id: 'slate',
    label: 'Slate',
    accent: '#475569',
    accentHover: '#334155',
    accentSoftLight: '#E2E8F0',
    accentSoftDark: '#1E293B',
    rgb: '71, 85, 105',
  },
  {
    id: 'coral',
    label: 'Coral',
    accent: '#E11D48',
    accentHover: '#BE123C',
    accentSoftLight: '#FFE4E6',
    accentSoftDark: '#3F1520',
    rgb: '225, 29, 72',
  },
];

export const MODE_PRESETS: Record<
  ThemeMode,
  {
    bg: string;
    bgElevated: string;
    bgMuted: string;
    border: string;
    text: string;
    textMuted: string;
    textInverse: string;
  }
> = {
  light: {
    bg: '#F5F7F6',
    bgElevated: '#FFFFFF',
    bgMuted: '#EEF2F0',
    border: '#E5E7EB',
    text: '#1A1A1A',
    textMuted: '#6B7280',
    textInverse: '#FFFFFF',
  },
  dark: {
    bg: '#000000',
    bgElevated: '#161616',
    bgMuted: '#1C1C1C',
    border: '#2A2A2A',
    text: '#FFFFFF',
    textMuted: '#A3A3A3',
    textInverse: '#FFFFFF',
  },
};

export function getAccent(id: AccentId): AccentPreset {
  return ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
}
