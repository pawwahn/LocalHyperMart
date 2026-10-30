const WORKFLOW_STEPS = ['EN_ROUTE', 'START', 'COMPLETE'] as const;

/** One primary session action at a time (excludes CANCEL). */
export function primaryBeautyWorkflowAction(allowedActions?: string[] | null): string | null {
  if (!allowedActions?.length) return null;
  for (const step of WORKFLOW_STEPS) {
    if (allowedActions.includes(step)) return step;
  }
  return null;
}
