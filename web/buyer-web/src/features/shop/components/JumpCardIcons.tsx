import type { CSSProperties } from 'react';
import type { ShopHomeJumpIcon } from '../config/shopHomeJumpCards';

const svg: CSSProperties = { width: 22, height: 22, display: 'block' };

export function JumpCardIcon({ id, color }: { id: ShopHomeJumpIcon; color: string }) {
  const style = { ...svg, color };
  switch (id) {
    case 'deals':
      return (
        <svg viewBox="0 0 24 24" style={style} fill="none" aria-hidden>
          <path d="M5 8.5 12 3l7 5.5v8L12 22l-7-5V8.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case 'beauty':
      return (
        <svg viewBox="0 0 24 24" style={style} fill="none" aria-hidden>
          <path
            d="M12 4c1.8 0 3.2 1.2 3.6 2.9.6-.1 1.2 0 1.7.3 1 .6 1.6 1.7 1.4 3-.2 1.1-1 2-2.1 2.3-.3 1.6-1.6 2.8-3.6 2.8s-3.3-1.2-3.6-2.8c-1.1-.3-1.9-1.2-2.1-2.3-.2-1.3.4-2.4 1.4-3 .5-.3 1.1-.4 1.7-.3C8.8 5.2 10.2 4 12 4Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'fresh':
      return (
        <svg viewBox="0 0 24 24" style={style} fill="none" aria-hidden>
          <path d="M8 4h8v4H8V4Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
          <path d="M6.5 9h11l-1 11H7.5L6.5 9Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      );
    case 'farm':
      return (
        <svg viewBox="0 0 24 24" style={style} fill="none" aria-hidden>
          <path d="M12 3v4M8.5 7.5 12 11l3.5-3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M6 21c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function ServiceGlamIcon({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...svg, ...style }} fill="none" aria-hidden>
      <path
        d="M12 4c2 0 3.6 1.4 4 3.3.7-.2 1.4-.1 2 .4 1.1.6 1.7 1.8 1.5 3.1-.2 1.2-1.1 2.2-2.3 2.5-.4 1.7-1.9 3-4.2 3s-3.8-1.3-4.2-3c-1.2-.3-2.1-1.3-2.3-2.5-.2-1.3.4-2.5 1.5-3.1.6-.5 1.3-.6 2-.4.4-1.9 2-3.3 4-3.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ServiceLaundryIcon({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...svg, ...style }} fill="none" aria-hidden>
      <path d="M8 4.5h8l.7 2H7.3L8 4.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M6.5 8.5h11l-.8 11.5a2 2 0 0 1-2 1.8H9.3a2 2 0 0 1-2-1.8L6.5 8.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}
