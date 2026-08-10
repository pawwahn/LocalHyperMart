import { useState, type CSSProperties, type MouseEvent } from 'react';

function canUseNativeDialer(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

type Props = {
  phone: string;
  label?: string;
  style?: CSSProperties;
};

/**
 * On a real phone: opens the dialer (`tel:`).
 * On desktop (local/dev): copies the number — avoids Windows “Pick an app” for tel: links.
 */
export function CallPhoneLink({ phone, label, style }: Props) {
  const [copied, setCopied] = useState(false);
  const text = label ?? `Call · ${phone}`;

  async function onClick(e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) {
    if (canUseNativeDialer()) {
      // Let the browser open the dialer.
      return;
    }
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this phone number:', phone);
    }
  }

  if (canUseNativeDialer()) {
    return (
      <a href={`tel:${phone}`} style={style} onClick={onClick}>
        {text}
      </a>
    );
  }

  return (
    <button type="button" style={{ ...buttonReset, ...style }} onClick={onClick} title="Copy phone number">
      {copied ? `Copied · ${phone}` : text}
    </button>
  );
}

const buttonReset: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  textAlign: 'left',
};
