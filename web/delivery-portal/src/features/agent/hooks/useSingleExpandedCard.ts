import { useEffect, useState } from 'react';

type Identifiable = { id: string; status?: string };

/** Keep one assignment card expanded; prefer in-progress (or custom) when the list changes. */
export function useSingleExpandedCard<T extends Identifiable>(
  items: T[],
  preferStatus?: string,
): [string | null, (id: string | null) => void] {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const itemKey = items.map((i) => i.id).join('|');

  useEffect(() => {
    if (items.length === 0) {
      setExpandedId(null);
      return;
    }
    setExpandedId((cur) => {
      if (cur && items.some((i) => i.id === cur)) return cur;
      if (preferStatus) {
        const preferred = items.find((i) => i.status === preferStatus);
        if (preferred) return preferred.id;
      }
      return items[0].id;
    });
  }, [itemKey, preferStatus]);

  return [expandedId, setExpandedId];
}
