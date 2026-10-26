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

export function IconBeauty({ active }: Props) {
  return (
    <svg viewBox="0 0 24 24" style={svg} aria-hidden>
      <path
        d="M12 3c2.2 0 4 1.5 4.5 3.6.8-.2 1.6-.1 2.3.3 1.2.7 1.9 2 1.7 3.4-.2 1.3-1.2 2.4-2.5 2.8-.4 1.9-2 3.3-4 3.3s-3.6-1.4-4-3.3c-1.3-.4-2.3-1.5-2.5-2.8-.2-1.4.5-2.7 1.7-3.4.7-.4 1.5-.5 2.3-.3C8 4.5 9.8 3 12 3Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.5 14.5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconLaundry({ active }: Props) {
  return (
    <svg viewBox="0 0 24 24" style={svg} aria-hidden>
      <path
        d="M8 4.5h8l.8 2.2H7.2L8 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 8.5h11l-.9 11.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8L6.5 8.5Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
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
