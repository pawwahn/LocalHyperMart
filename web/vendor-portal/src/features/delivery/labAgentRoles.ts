export type LabAgentTitle = 'MANAGER' | 'COLLECTION_AGENT' | 'LAB_TECHNICIAN';

export const LAB_AGENT_ROLE_OPTIONS: { value: LabAgentTitle; label: string }[] = [
  { value: 'COLLECTION_AGENT', label: 'Collection agent' },
  { value: 'LAB_TECHNICIAN', label: 'Lab technician' },
  { value: 'MANAGER', label: 'Manager' },
];

export function formatLabAgentRole(title: string | null | undefined): string {
  const normalized = normalizeLabAgentTitle(title);
  const hit = LAB_AGENT_ROLE_OPTIONS.find((o) => o.value === normalized);
  return hit?.label ?? 'Collection agent';
}

export function normalizeLabAgentTitle(title: string | null | undefined): LabAgentTitle {
  if (title === 'MANAGER' || title === 'LAB_TECHNICIAN' || title === 'COLLECTION_AGENT') {
    return title;
  }
  return 'COLLECTION_AGENT';
}

export function defaultCollectionCapable(title: LabAgentTitle): boolean {
  return title === 'COLLECTION_AGENT' || title === 'MANAGER';
}
