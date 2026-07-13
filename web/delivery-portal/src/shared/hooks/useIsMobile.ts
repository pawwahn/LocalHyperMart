import { useEffect, useState } from 'react';

const DEFAULT_BREAKPOINT = 768;

/** True when viewport width is below the given breakpoint (default 768). */
export function useIsMobile(breakpointPx = DEFAULT_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${breakpointPx - 1}px)`).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpointPx]);

  return isMobile;
}
