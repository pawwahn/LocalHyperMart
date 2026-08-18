import type { CSSProperties } from 'react';

type Props = { active?: boolean };

const svg: CSSProperties = { width: 22, height: 22, display: 'block' };

export function IconHome({ active }: Props) {
  return (
    <svg viewBox="0 0 24 24" style={svg} aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1v-9.5Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconGrid({ active }: Props) {
  return (
    <svg viewBox="0 0 24 24" style={svg} aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconBasket({ active }: Props) {
  return (
    <svg viewBox="0 0 24 24" style={svg} aria-hidden>
      <path
        d="M4.5 8.5h15l-1.2 9.2a2 2 0 0 1-2 1.8H7.7a2 2 0 0 1-2-1.8L4.5 8.5Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 8.5 9.4 4.8h5.2L16 8.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconWallet({ active }: Props) {
  return (
    <svg viewBox="0 0 24 24" style={svg} aria-hidden>
      <rect x="3.5" y="6" width="17" height="13" rx="2.2" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" />
      <path d="M14.5 12.5h6v4h-6a2 2 0 0 1-2-2 2 2 0 0 1 2-2Z" fill={active ? 'var(--bg)' : 'none'} stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconMore({ active }: Props) {
  return (
    <svg viewBox="0 0 24 24" style={svg} aria-hidden>
      <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" />
    </svg>
  );
}
