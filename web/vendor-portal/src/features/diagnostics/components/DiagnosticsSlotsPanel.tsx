import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { useIsNarrow } from '@/shared/hooks/useIsNarrow';
import { ConfirmDialog } from '@/shared/ui';
import { buildHourlySlotTemplates, DEFAULT_SLOT_CAPACITY, formatDiagnosticsSlotAmPmRange, hourlySlotLabel } from '@hlm-diagnostics';
import { upsertDiagnosticsBranch, type DiagnosticsPortalProfile } from '../api/diagnosticsApi';
import { DiagnosticsVendorCalendar, type CalView } from './DiagnosticsVendorCalendar';

export type DiagnosticsBranchSlot = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  capacity: number;
  active: boolean;
};

type BranchRow = DiagnosticsPortalProfile['branches'][number] & {
  slots?: DiagnosticsBranchSlot[];
  blockedSlotsByDate?: string | null;
};

/** DB column `diagnostics_slot_templates.label` is length 40 */
const SLOT_LABEL_MAX = 40;

function todayIst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function branchSlotsPayload(_branch: BranchRow, slots: DiagnosticsBranchSlot[]) {
  return slots.map((s) => ({
    id: s.id,
    label: String(s.label ?? '').slice(0, SLOT_LABEL_MAX),
    startTime: s.startTime.slice(0, 5),
    endTime: s.endTime.slice(0, 5),
    capacity: Math.max(1, s.capacity),
    active: s.active !== false,
  }));
}

function hourlySeedPayload(capacity: number = DEFAULT_SLOT_CAPACITY) {
  return buildHourlySlotTemplates(capacity).map((row: { label: string; startTime: string; endTime: string; capacity: number }) => ({
    label: row.label,
    startTime: row.startTime,
    endTime: row.endTime,
    capacity: row.capacity,
    active: true,
  }));
}

/** IST hour 0–23 from "HH:mm" or "HH:mm:ss". */
function slotStartHour(startTime: string): number {
  const h = Number(startTime.slice(0, 2));
  return Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 0;
}

/** API may return "HH:mm" or "HH:mm:ss"; `<input type="time">` needs "HH:mm". */
function slotTimeForInput(raw: string): string {
  const t = raw?.trim() ?? '';
  if (t.length >= 5 && /^\d{1,2}:\d{2}/.test(t)) {
    return `${t.slice(0, 2)}:${t.slice(3, 5)}`;
  }
  return '00:00';
}

function normalizeTimeHm(raw: string): string | null {
  const s = raw?.trim() ?? '';
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function slotDurationMinutes(s: DiagnosticsBranchSlot): number {
  const sh = Number(s.startTime.slice(0, 2));
  const sm = Number(s.startTime.slice(3, 5));
  const eh = Number(s.endTime.slice(0, 2));
  const em = Number(s.endTime.slice(3, 5));
  let start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end <= start) end += 24 * 60;
  return end - start;
}

/** Hourly template: starts on the hour, 60 minutes (wraps midnight). */
function isStandardHourlySlot(s: DiagnosticsBranchSlot): boolean {
  const sm = Number(s.startTime.slice(3, 5));
  const em = Number(s.endTime.slice(3, 5));
  return sm === 0 && em === 0 && slotDurationMinutes(s) === 60;
}

const CAP_BUCKETS: { id: 'morning' | 'pm'; label: string; hours: readonly number[] }[] = [
  { id: 'morning', label: 'Morning (12 am – 12 pm)', hours: [...Array(12)].map((_, i) => i) },
  { id: 'pm', label: 'Afternoon & night (12 pm – 12 am)', hours: [...Array(12)].map((_, i) => i + 12) },
];

function slotsByHourForBuckets(slots: DiagnosticsBranchSlot[]): Map<number, DiagnosticsBranchSlot> {
  const map = new Map<number, DiagnosticsBranchSlot>();
  for (const s of slots) {
    map.set(slotStartHour(s.startTime), s);
  }
  return map;
}

function CustomCapSlotRow({
  slot,
  busy,
  onTimesCommit,
  onLabelCommit,
  onCapacityCommit,
  onDeleteRequest,
}: {
  slot: DiagnosticsBranchSlot;
  busy: boolean;
  onTimesCommit: (slotId: string, start: string, end: string) => void;
  onLabelCommit: (slotId: string, label: string) => void;
  onCapacityCommit: (slotId: string, cap: number) => void;
  onDeleteRequest: (slotId: string) => void;
}) {
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  function commitTimes() {
    const a = startRef.current?.value ?? '';
    const b = endRef.current?.value ?? '';
    onTimesCommit(slot.id, a, b);
  }

  const rangeAmPm = formatDiagnosticsSlotAmPmRange(slot.startTime, slot.endTime);

  return (
    <li style={capCustomRowCardStyle}>
      <div style={capCustomRowInnerStyle}>
        <div style={capCustomTimeClusterStyle} title={`Customers see: ${rangeAmPm}`}>
          <input
            ref={startRef}
            type="time"
            step={60}
            disabled={busy}
            defaultValue={slotTimeForInput(slot.startTime)}
            style={capCustomTimeInputStyle}
            aria-label="Window start"
            onBlur={commitTimes}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
          <span style={capCustomTimeDashStyle} aria-hidden>
            →
          </span>
          <input
            ref={endRef}
            type="time"
            step={60}
            disabled={busy}
            defaultValue={slotTimeForInput(slot.endTime)}
            style={capCustomTimeInputStyle}
            aria-label="Window end"
            onBlur={commitTimes}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
          <span style={capCustomAmPmBadgeStyle}>{rangeAmPm}</span>
        </div>
        <textarea
          rows={1}
          aria-label={`Slot name (${SLOT_LABEL_MAX} characters max)`}
          placeholder="Name this slot…"
          defaultValue={slot.label}
          disabled={busy}
          maxLength={SLOT_LABEL_MAX}
          style={capCustomLabelTextareaStyle}
          onBlur={(e) => {
            const next = e.target.value.trim().slice(0, SLOT_LABEL_MAX);
            if (next !== (slot.label ?? '').trim()) onLabelCommit(slot.id, next);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
        />
        <div style={capCustomRightClusterStyle}>
          <label style={capCustomCapBlockStyle}>
            <span style={capFallbackNStyle}>N</span>
            <input
              type="number"
              min={1}
              defaultValue={slot.capacity}
              disabled={busy}
              style={capCustomCapInputStyle}
              aria-label={`Capacity for ${rangeAmPm}`}
              onBlur={(e) => {
                const next = Number(e.target.value);
                if (next !== slot.capacity && Number.isFinite(next)) onCapacityCommit(slot.id, next);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            style={capDeleteBtnStyle}
            aria-label={`Remove ${rangeAmPm}`}
            onClick={() => onDeleteRequest(slot.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

function CapHourCell({
  hour,
  slot,
  busy,
  onCapacityCommit,
  onLabelCommit,
}: {
  hour: number;
  slot: DiagnosticsBranchSlot | undefined;
  busy: boolean;
  onCapacityCommit: (slotId: string, cap: number) => void;
  onLabelCommit: (slotId: string, label: string) => void;
}) {
  if (!slot) {
    return (
      <div style={capCellMissingStyle} title="No template for this hour">
        <span style={capCellTimeStyle}>{hourlySlotLabel(hour)}</span>
        <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>—</span>
      </div>
    );
  }
  const range = hourlySlotLabel(hour);
  return (
    <div style={capCellStyle}>
      <div style={capCellTimeRowStyle}>
        <span style={capCellTimeStyle}>{range}</span>
      </div>
      <input
        type="text"
        aria-label={`Staff note for ${range}`}
        placeholder="Add note (optional)"
        defaultValue={slot.label}
        disabled={busy}
        maxLength={SLOT_LABEL_MAX}
        title={slot.label?.trim() ? slot.label : 'Shown to buyers only if different from the time above'}
        style={capCellLabelInputStyle}
        onBlur={(e) => {
          const next = e.target.value.trim().slice(0, SLOT_LABEL_MAX);
          if (next !== (slot.label ?? '').trim()) onLabelCommit(slot.id, next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <div style={capCellCapRowStyle}>
        <span style={capCellCapMutedStyle}>Cap</span>
        <input
          id={`cap-${slot.id}`}
          type="number"
          min={1}
          defaultValue={slot.capacity}
          disabled={busy}
          style={capCellInputStyle}
          aria-label={`Max visits for ${range}`}
          onBlur={(e) => {
            const next = Number(e.target.value);
            if (next !== slot.capacity && Number.isFinite(next)) onCapacityCommit(slot.id, next);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
    </div>
  );
}

export function DiagnosticsSlotsPanel({
  token,
  profile,
  orders,
  onSaved,
  onError,
  onToast,
}: {
  token: string;
  profile: DiagnosticsPortalProfile;
  orders: Array<{ slotStart?: string | null; status: string; servingBranchId?: string | null }>;
  onSaved: (me: DiagnosticsPortalProfile) => void;
  onError: (message: string) => void;
  onToast: (message: string) => void;
}) {
  const narrow = useIsNarrow(767);
  const branches = profile.branches as BranchRow[];
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const today = todayIst();
  const [pickDate, setPickDate] = useState(today);
  const [calView, setCalView] = useState<CalView>('daily');
  const [busy, setBusy] = useState(false);
  const [slotToDeleteId, setSlotToDeleteId] = useState<string | null>(null);
  const [slotDraft, setSlotDraft] = useState({
    label: '',
    startTime: '07:00',
    endTime: '08:00',
    capacity: DEFAULT_SLOT_CAPACITY,
  });

  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);
  const slots = useMemo(
    () => (branch?.slots ?? []).filter((s) => s.active !== false),
    [branch],
  );

  const slotsByHour = useMemo(() => slotsByHourForBuckets(slots), [slots]);
  const showHourlyCapGrid = useMemo(() => slots.length > 0 && slots.every(isStandardHourlySlot), [slots]);
  const customCapSlots = useMemo(
    () => (showHourlyCapGrid ? [] : slots),
    [slots, showHourlyCapGrid],
  );

  async function persistSlots(nextSlots: DiagnosticsBranchSlot[], toast: string) {
    if (!branch || !token) return;
    setBusy(true);
    try {
      const saved = await upsertDiagnosticsBranch(token, {
        id: branch.id,
        label: branch.label,
        addressLine: branch.addressLine,
        homeCollectionRadiusKm: branch.homeCollectionRadiusKm,
        slots: branchSlotsPayload(branch, nextSlots),
      });
      onSaved(saved);
      onToast(toast);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save slots');
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlockForDate(date: string, slotId: string) {
    if (!branch || !token) return;
    const { parseBlockedSlotsByDate } = await import('@hlm-beauty');
    const map = parseBlockedSlotsByDate(branch.blockedSlotsByDate);
    const csv = map[date] ?? '';
    const ids = new Set(
      csv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    const willBlock = !ids.has(slotId);
    if (ids.has(slotId)) ids.delete(slotId);
    else ids.add(slotId);
    setBusy(true);
    try {
      const saved = await upsertDiagnosticsBranch(token, {
        id: branch.id,
        label: branch.label,
        addressLine: branch.addressLine,
        homeCollectionRadiusKm: branch.homeCollectionRadiusKm,
        blockedSlotDate: date,
        blockedSlotIds: [...ids].join(','),
      });
      onSaved(saved);
      onToast(willBlock ? 'Blocked for that day' : 'Opened for that day');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update block');
    } finally {
      setBusy(false);
    }
  }

  async function addSlotTemplate() {
    if (!branch || !token || !slotDraft.label.trim()) return;
    const existing = branchSlotsPayload(branch, branch.slots ?? []);
    setBusy(true);
    try {
      const saved = await upsertDiagnosticsBranch(token, {
        id: branch.id,
        label: branch.label,
        addressLine: branch.addressLine,
        homeCollectionRadiusKm: branch.homeCollectionRadiusKm,
        slots: [
          ...existing,
          {
            label: slotDraft.label.trim().slice(0, SLOT_LABEL_MAX),
            startTime: slotDraft.startTime,
            endTime: slotDraft.endTime,
            capacity: Math.max(1, slotDraft.capacity),
            active: true,
          },
        ] as Parameters<typeof upsertDiagnosticsBranch>[1]['slots'],
      });
      onSaved(saved);
      setSlotDraft({ label: '', startTime: '07:00', endTime: '08:00', capacity: DEFAULT_SLOT_CAPACITY });
      onToast('Slot window saved');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save slot');
    } finally {
      setBusy(false);
    }
  }

  async function seedDefaultSlots() {
    if (!branch || slots.length > 0) return;
    setBusy(true);
    try {
      const saved = await upsertDiagnosticsBranch(token, {
        id: branch.id,
        label: branch.label,
        addressLine: branch.addressLine,
        homeCollectionRadiusKm: branch.homeCollectionRadiusKm,
        slots: hourlySeedPayload() as Parameters<typeof upsertDiagnosticsBranch>[1]['slots'],
      });
      onSaved(saved);
      onToast('24×7 hourly templates added');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not seed slots');
    } finally {
      setBusy(false);
    }
  }

  async function replaceWithHourlyGrid() {
    if (!branch || !token) return;
    setBusy(true);
    try {
      const saved = await upsertDiagnosticsBranch(token, {
        id: branch.id,
        label: branch.label,
        addressLine: branch.addressLine,
        homeCollectionRadiusKm: branch.homeCollectionRadiusKm,
        slots: hourlySeedPayload() as Parameters<typeof upsertDiagnosticsBranch>[1]['slots'],
      });
      onSaved(saved);
      onToast('Replaced with 1-hour · 24×7 templates');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not replace slots');
    } finally {
      setBusy(false);
    }
  }

  async function updateSlotCapacity(slotId: string, capacity: number) {
    if (!branch) return;
    const cap = Math.max(1, Math.floor(capacity) || 1);
    const next = (branch.slots ?? []).map((s) => (s.id === slotId ? { ...s, capacity: cap } : s));
    await persistSlots(next, 'Capacity saved');
  }

  async function updateSlotLabel(slotId: string, label: string) {
    if (!branch) return;
    const trimmed = label.trim().slice(0, SLOT_LABEL_MAX);
    const next = (branch.slots ?? []).map((s) => (s.id === slotId ? { ...s, label: trimmed } : s));
    await persistSlots(next, 'Label saved');
  }

  async function removeSlot(slotId: string) {
    if (!branch) return;
    const next = (branch.slots ?? []).filter((s) => s.id !== slotId);
    await persistSlots(next, 'Slot removed');
  }

  async function updateSlotTimes(slotId: string, startRaw: string, endRaw: string) {
    if (!branch) return;
    const start = normalizeTimeHm(startRaw);
    const end = normalizeTimeHm(endRaw);
    if (!start || !end) {
      onError('Enter valid start and end times');
      return;
    }
    if (start === end) {
      onError('End time must differ from start time');
      return;
    }
    const cur = (branch.slots ?? []).find((s) => s.id === slotId);
    if (!cur) return;
    const curStart = slotTimeForInput(cur.startTime);
    const curEnd = slotTimeForInput(cur.endTime);
    if (start === curStart && end === curEnd) return;
    const next = (branch.slots ?? []).map((s) => (s.id === slotId ? { ...s, startTime: start, endTime: end } : s));
    await persistSlots(next, 'Times saved');
  }

  if (branches.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Add a branch first, then define home-collection slots here.
      </p>
    );
  }

  const calendarSlots = slots.map((s) => ({
    id: s.id,
    label: s.label,
    startTime: s.startTime,
    endTime: s.endTime,
    capacity: s.capacity,
  }));

  return (
    <div style={{ display: 'grid', gap: narrow ? '0.5rem' : '0.65rem', minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Same flow as <strong>Koya Glam</strong>: times are <strong>am/pm</strong> like the customer app. Today / Daily /
        Weekly / Monthly, colour legend, tap a cell to block that <strong>hour on that date</strong>. Edit labels and{' '}
        <strong>N</strong> below for each template window.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'end' }}>
        <label style={fieldStyle}>
          Branch
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={inputStyle}>
            {branches.filter((b) => b.active).map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        {slots.length > 0 ? (
          <button type="button" disabled={busy} style={btnGhostStyle} onClick={() => void replaceWithHourlyGrid()}>
            Reset templates to 1h · 24×7
          </button>
        ) : null}
      </div>

      {slots.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem' }}>No slot templates for this branch yet.</p>
          <button type="button" disabled={busy} style={btnStyle} onClick={() => void seedDefaultSlots()}>
            Add 24×7 hourly templates
          </button>
        </div>
      ) : (
        <DiagnosticsVendorCalendar
          view={calView}
          onViewChange={(v) => {
            setCalView(v);
            if (v === 'today') setPickDate(today);
          }}
          anchorDate={pickDate}
          onAnchorDateChange={setPickDate}
          today={today}
          branchId={branch!.id}
          slots={calendarSlots}
          orders={orders}
          blockedSlotsByDate={branch!.blockedSlotsByDate}
          busy={busy}
          onToggleBlock={(date, slotId) => void toggleBlockForDate(date, slotId)}
        />
      )}

      {slots.length > 0 ? (
        <div style={capSectionWrapStyle}>
          <div style={capSectionHeaderStyle}>
            <div style={capSectionTitleBlockStyle}>
              <p style={capSectionTitleStyle}>Hourly capacity (template)</p>
              <p style={capSectionHintStyle}>
                Time is what buyers pick. Optional <strong>notes</strong> appear on their chip only when they differ from
                that time (e.g. Peak, Night). Calendar blocks are per date; <strong>Cap</strong> is max visits per hour.
              </p>
            </div>
          </div>
          {showHourlyCapGrid ? (
            <>
              {CAP_BUCKETS.map((bucket) => (
                <div key={bucket.id} style={capBucketPanelStyle}>
                  <p style={capBucketLabelStyle}>{bucket.label}</p>
                  <div style={narrow ? capGridStyleNarrow : capGridStyle}>
                    {bucket.hours.map((hour) => (
                      <CapHourCell
                        key={`${bucket.id}-${hour}`}
                        hour={hour}
                        slot={slotsByHour.get(hour)}
                        busy={busy}
                        onCapacityCommit={(id, cap) => void updateSlotCapacity(id, cap)}
                        onLabelCommit={(id, lbl) => void updateSlotLabel(id, lbl)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <p style={capFallbackIntroStyle}>
                Custom windows — one row each: <strong>time → name → N</strong>. Blur or Enter to save.{' '}
                <strong>Delete</strong> removes the template (orphaned calendar blocks are harmless). Names max{' '}
                {SLOT_LABEL_MAX} characters.
              </p>
              <ul style={capFallbackListStyle}>
                {customCapSlots.map((slot) => (
                  <CustomCapSlotRow
                    key={`${slot.id}-${slotTimeForInput(slot.startTime)}-${slotTimeForInput(slot.endTime)}`}
                    slot={slot}
                    busy={busy}
                    onTimesCommit={(id, start, end) => void updateSlotTimes(id, start, end)}
                    onLabelCommit={(id, lbl) => void updateSlotLabel(id, lbl)}
                    onCapacityCommit={(id, cap) => void updateSlotCapacity(id, cap)}
                    onDeleteRequest={(id) => setSlotToDeleteId(id)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={slotToDeleteId != null}
        title="Remove slot template?"
        description="This window will no longer be offered for booking. Calendar blocks that referred to this template ID will not apply anymore."
        confirmLabel="Remove"
        cancelLabel="Go back"
        danger
        busy={busy}
        onClose={() => setSlotToDeleteId(null)}
        onConfirm={() => {
          const id = slotToDeleteId;
          setSlotToDeleteId(null);
          if (id) void removeSlot(id);
        }}
      />

      <div style={cardStyle}>
        <p style={{ margin: '0 0 0.45rem', fontWeight: 600, fontSize: '0.82rem' }}>Add custom window</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(3, minmax(4rem, 1fr))', gap: '0.35rem' }}>
          <input
            placeholder="Label"
            aria-label="Label"
            value={slotDraft.label}
            onChange={(e) => setSlotDraft((d) => ({ ...d, label: e.target.value }))}
            style={inputStyle}
          />
          <input
            type="time"
            aria-label="Start"
            value={slotDraft.startTime}
            onChange={(e) => {
              const start = e.target.value;
              const [h] = start.split(':').map(Number);
              const endH = Number.isFinite(h) ? (h + 1) % 24 : 8;
              setSlotDraft((d) => ({
                ...d,
                startTime: start,
                endTime: `${String(endH).padStart(2, '0')}:00`,
              }));
            }}
            style={inputStyle}
          />
          <input
            type="time"
            aria-label="End"
            value={slotDraft.endTime}
            onChange={(e) => setSlotDraft((d) => ({ ...d, endTime: e.target.value }))}
            style={inputStyle}
          />
          <input
            type="number"
            min={1}
            aria-label="Capacity"
            value={slotDraft.capacity}
            onChange={(e) => setSlotDraft((d) => ({ ...d, capacity: Number(e.target.value) || 1 }))}
            style={inputStyle}
          />
        </div>
        <button
          type="button"
          disabled={busy || !slotDraft.label.trim()}
          style={{ ...btnStyle, marginTop: '0.45rem' }}
          onClick={() => void addSlotTemplate()}
        >
          Save window
        </button>
      </div>
    </div>
  );
}

const fieldStyle: CSSProperties = { display: 'grid', gap: '0.2rem', fontSize: '0.72rem' };
const inputStyle: CSSProperties = {
  font: 'inherit',
  padding: '0.35rem 0.45rem',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
};
const cardStyle: CSSProperties = {
  padding: '0.55rem 0.65rem',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
};

const TEAL_ACCENT = '#0f766e';

const capSectionWrapStyle: CSSProperties = {
  ...cardStyle,
  background: 'linear-gradient(180deg, #f8fffd 0%, #ffffff 48%)',
  borderColor: '#ccfbf1',
  boxShadow: '0 1px 2px rgba(15, 118, 110, 0.06)',
};
const capSectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '0.45rem',
  flexWrap: 'wrap',
  marginBottom: '0.4rem',
};
const capSectionTitleBlockStyle: CSSProperties = { minWidth: 0, flex: '1 1 12rem' };
const capSectionTitleStyle: CSSProperties = {
  margin: 0,
  fontWeight: 700,
  fontSize: '0.8rem',
  color: '#134e4a',
  letterSpacing: '-0.01em',
};
const capSectionHintStyle: CSSProperties = {
  margin: '0.2rem 0 0',
  fontSize: '0.64rem',
  color: '#64748b',
  lineHeight: 1.35,
  maxWidth: '42em',
};
const capBucketPanelStyle: CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.55rem 0.6rem 0.6rem',
  borderRadius: 14,
  border: '1px solid rgba(20, 184, 166, 0.22)',
  background: 'linear-gradient(165deg, rgba(240, 253, 250, 0.65) 0%, #ffffff 38%, #fafafa 100%)',
  boxShadow: '0 2px 10px rgba(15, 118, 110, 0.06)',
};
const capBucketLabelStyle: CSSProperties = {
  margin: '0 0 0.42rem',
  fontSize: '0.64rem',
  fontWeight: 800,
  color: '#0f766e',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
/** Six equal columns on wide viewports so labels have room; phones use wider cells / fewer columns. */
const capGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: '0.55rem',
};
const capGridStyleNarrow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 9.25rem), 1fr))',
  gap: '0.45rem',
};
const capCellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: '0.38rem',
  minWidth: 0,
  padding: '0.45rem 0.5rem 0.48rem',
  borderRadius: 12,
  border: '1px solid rgba(226, 232, 240, 0.95)',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255,255,255,0.9)',
};
const capCellTimeRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.35rem',
  minWidth: 0,
};
const capCellLabelInputStyle: CSSProperties = {
  ...inputStyle,
  minWidth: 0,
  width: '100%',
  fontSize: '0.68rem',
  lineHeight: 1.35,
  padding: '0.32rem 0.42rem',
  color: '#334155',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  background: 'rgba(248, 250, 252, 0.85)',
  boxSizing: 'border-box',
};
const capCellCapRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.35rem',
  marginTop: '0.06rem',
  paddingTop: '0.32rem',
  borderTop: '1px solid rgba(226, 232, 240, 0.85)',
};
const capCellMissingStyle: CSSProperties = {
  ...capCellStyle,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.12rem',
  opacity: 0.65,
  borderStyle: 'dashed',
  borderColor: '#cbd5e1',
  background: '#f8fafc',
};
const capCellTimeStyle: CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 800,
  fontVariantNumeric: 'tabular-nums',
  color: '#0f172a',
  letterSpacing: '-0.02em',
  width: '100%',
  lineHeight: 1.25,
};
const capCellCapMutedStyle: CSSProperties = {
  fontSize: '0.58rem',
  fontWeight: 800,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
};
const capCellInputStyle: CSSProperties = {
  ...inputStyle,
  width: '3rem',
  minWidth: '3rem',
  padding: '0.28rem 0.32rem',
  textAlign: 'center',
  fontSize: '0.82rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  borderColor: 'rgba(20, 184, 166, 0.45)',
  borderRadius: 8,
  background: 'linear-gradient(180deg, #ecfdf5 0%, #f0fdfa 100%)',
};
const capFallbackIntroStyle: CSSProperties = {
  margin: '0 0 0.35rem',
  fontSize: '0.65rem',
  color: '#64748b',
};
const capFallbackListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: '0.4rem',
  maxHeight: '18rem',
  overflowY: 'auto',
};
/** Custom-window rows: one card = time cluster | large label | N + delete */
const capCustomRowCardStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
};
const capCustomRowInnerStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'stretch',
  gap: '0.55rem',
  padding: '0.38rem 0.5rem',
  minWidth: 0,
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
};
const capCustomTimeClusterStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: '0.2rem',
  flexShrink: 0,
};
const capCustomTimeInputStyle: CSSProperties = {
  ...inputStyle,
  width: '5.1rem',
  minWidth: '4.75rem',
  padding: '0.32rem 0.35rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
};
const capCustomTimeDashStyle: CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 800,
  color: '#94a3b8',
  userSelect: 'none',
  padding: '0 0.05rem',
};
const capCustomAmPmBadgeStyle: CSSProperties = {
  display: 'none',
};
const capCustomLabelTextareaStyle: CSSProperties = {
  ...inputStyle,
  flex: '1 1 12rem',
  minWidth: '10rem',
  minHeight: '2.5rem',
  resize: 'vertical',
  maxWidth: '100%',
  fontSize: '0.84rem',
  fontWeight: 600,
  lineHeight: 1.35,
  padding: '0.38rem 0.5rem',
  color: '#0f172a',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
};
const capCustomRightClusterStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: '0.38rem',
  flexShrink: 0,
};
const capCustomCapBlockStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.22rem',
};
const capCustomCapInputStyle: CSSProperties = {
  ...inputStyle,
  width: '2.85rem',
  minWidth: '2.85rem',
  padding: '0.28rem 0.22rem',
  textAlign: 'center',
  fontSize: '0.8rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  borderColor: '#5eead4',
  borderRadius: 8,
  background: '#f0fdfa',
};
const capDeleteBtnStyle: CSSProperties = {
  font: 'inherit',
  fontSize: '0.68rem',
  fontWeight: 700,
  padding: '0.35rem 0.5rem',
  borderRadius: 8,
  border: '1px solid #fecaca',
  background: '#fff',
  color: '#b91c1c',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const capFallbackNStyle: CSSProperties = {
  fontSize: '0.58rem',
  fontWeight: 700,
  color: TEAL_ACCENT,
  letterSpacing: '0.05em',
};

const btnStyle: CSSProperties = {
  font: 'inherit',
  fontSize: '0.78rem',
  padding: '0.35rem 0.65rem',
  borderRadius: 6,
  border: 'none',
  background: '#0f766e',
  color: '#fff',
  cursor: 'pointer',
};
const btnGhostStyle: CSSProperties = {
  ...btnStyle,
  background: '#fff',
  color: '#0f766e',
  border: '1px solid #0f766e',
};
