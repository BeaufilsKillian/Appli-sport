export const C = {
  background: '#050709',
  surface: '#101419',
  surfaceRaised: '#171D25',
  surfaceSoft: '#1D2530',
  line: '#27303B',
  white: '#F5F8FC',
  muted: '#8C98A8',
  blue: '#0878F9',
  blueSoft: '#0B2749',
  green: '#2AD278',
  red: '#FF5266',
  gold: '#FFBD62',
};

export const radii = { card: 16, button: 12, pill: 100 };
export const fmt = (v: number, digits = 0) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(v);
export const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
export const durationLabel = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

export const LIGHT_C: typeof C = {
  background: '#F5F7FA', surface: '#FFFFFF', surfaceRaised: '#E7EDF6',
  surfaceSoft: '#DAE5F2', line: '#D2DCE8', white: '#152233', muted: '#5D6C7D',
  blue: '#1269E6', blueSoft: '#E7F0FF', green: '#147C51', red: '#C43F4D', gold: '#C78B29',
};
