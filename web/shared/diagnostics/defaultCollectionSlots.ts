import { buildHourlySlotTemplates, DEFAULT_SLOT_CAPACITY, formatDiagnosticsSlotAmPmRange } from './hourlySlotTemplates';

export type DefaultCollectionSlot = {
  slotId: string;
  label: string;
  start: string;
  end: string;
  capacity: number;
};

export {
  DEFAULT_SLOT_CAPACITY,
  buildHourlySlotTemplates,
  hourlySlotLabel,
  formatDiagnosticsSlotAmPmRange,
  templateTimeToMinutes,
} from './hourlySlotTemplates';

/** Buyer fallback when lab templates are not loaded yet. */
export function defaultCollectionSlotsForBuyer(): DefaultCollectionSlot[] {
  return buildHourlySlotTemplates(DEFAULT_SLOT_CAPACITY).map((row, index) => ({
    slotId: `default-${index}-${row.startTime.replace(':', '')}`,
    label: formatDiagnosticsSlotAmPmRange(row.startTime, row.endTime),
    start: row.startTime,
    end: row.endTime,
    capacity: row.capacity,
  }));
}

export function isDiagnosticsSlotTemplateUuid(slotId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slotId);
}
