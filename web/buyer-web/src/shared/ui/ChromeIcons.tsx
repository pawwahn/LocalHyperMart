import type { CSSProperties } from 'react';

const base: CSSProperties = { width: 20, height: 20, display: 'block', flexShrink: 0 };

export function IconPin({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...base, ...style }} fill="none" aria-hidden>
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.25" fill="currentColor" />
    </svg>
  );
}

export function IconBell({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...base, ...style }} fill="none" aria-hidden>
      <path
        d="M12 3.5a5.5 5.5 0 0 0-5.5 5.5v3.2l-1.2 2.4h13.4l-1.2-2.4V9a5.5 5.5 0 0 0-5.5-5.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconRefresh({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{
        ...base,
        animation: spinning ? 'hlm-spin 800ms linear infinite' : undefined,
      }}
      fill="none"
      aria-hidden
    >
      <path
        d="M20 12a8 8 0 1 1-2.3-5.7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M20 4v5h-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSearch({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...base, width: 18, height: 18, ...style }} fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.85" />
      <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
    </svg>
  );
}

export function IconMic({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...base, ...style }} fill="none" aria-hidden>
      <rect x="9" y="3.5" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12 17v3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function IconMicActive({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...base, ...style }} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}

export function IconChevronDown({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...base, width: 16, height: 16, ...style }} fill="none" aria-hidden>
      <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
