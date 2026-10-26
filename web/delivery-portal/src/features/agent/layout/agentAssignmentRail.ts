import type { CSSProperties } from 'react';

/** Centered column — assignment cards use less horizontal width than full bleed. */
export const agentAssignmentRail: CSSProperties = {
  width: 'min(100%, var(--agent-assignment-rail, 32rem))',
  marginInline: 'auto',
  justifySelf: 'center',
  display: 'grid',
  gap: '0.65rem',
  minWidth: 0,
};

export const agentAssignmentList: CSSProperties = {
  display: 'grid',
  gap: '0.45rem',
  width: '100%',
};
