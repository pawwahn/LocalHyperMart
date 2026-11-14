import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { usePortalChrome } from '@/shared/layout/PortalChromeContext';
import { useAuth } from '@/shared/auth/AuthContext';
import { isDiagnosticsVendor, isGlamVendor } from '@/features/shop/hooks/useHidesListings';
import {
  defaultCollectionCapable,
  formatLabAgentRole,
  LAB_AGENT_ROLE_OPTIONS,
  normalizeLabAgentTitle,
  type LabAgentTitle,
} from '../labAgentRoles';
import { useVendorShop } from '@/features/shop/hooks/useVendorShop';
import { ApiError } from '@/shared/api/http';
import { Banner, Button, Card, TextField } from '@/shared/ui';
import {
  createVendorDeliveryAgent,
  fetchVendorDeliveryAgents,
  updateVendorDeliveryAgent,
  updateVendorDeliveryAgentStatus,
  type AgentAvailabilityStatus,
  type VendorAgentDto,
} from '../api/deliveryAgentsApi';
import {
  fetchMyDiagnostics,
  upsertDiagnosticsStaff,
  type DiagnosticsStaffRow,
} from '@/features/diagnostics/api/diagnosticsApi';

export function DeliveryAgentsPage() {
  const { session } = useAuth();
  const { shop, loading: shopLoading } = useVendorShop();
  const [agents, setAgents] = useState<VendorAgentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'add' | 'edit'>('list');
  const [editingAgent, setEditingAgent] = useState<VendorAgentDto | null>(null);
  const [editStatus, setEditStatus] = useState<AgentAvailabilityStatus>('ACTIVE');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [govtIdType, setGovtIdType] = useState('AADHAAR');
  const [govtIdNumber, setGovtIdNumber] = useState('');
  const [reference1Name, setReference1Name] = useState('');
  const [reference1Phone, setReference1Phone] = useState('');
  const [reference2Name, setReference2Name] = useState('');
  const [reference2Phone, setReference2Phone] = useState('');
  const [labTitle, setLabTitle] = useState<LabAgentTitle>('COLLECTION_AGENT');
  const [collectionCapable, setCollectionCapable] = useState(true);
  const [labStaff, setLabStaff] = useState<DiagnosticsStaffRow[]>([]);
  const [editingLabStaff, setEditingLabStaff] = useState<DiagnosticsStaffRow | null>(null);
  const [togglingStaffId, setTogglingStaffId] = useState<string | null>(null);

  const glamVendor = isGlamVendor(session?.serviceName);
  const diagnosticsVendor = isDiagnosticsVendor(session?.serviceName);
  usePortalChrome({
    title: glamVendor ? 'Professionals' : diagnosticsVendor ? 'Agents' : 'Delivery agents',
  });

  const scope = useMemo(() => {
    if (!session || !shop?.shopId || !shop?.townId) return null;
    return {
      token: session.accessToken,
      vendorId: session.vendorId,
      shopId: shop.shopId,
      townId: shop.townId,
    };
  }, [session, shop?.shopId, shop?.townId]);

  const reload = useCallback(async () => {
    if (diagnosticsVendor) {
      if (!session?.accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const profile = await fetchMyDiagnostics(session.accessToken);
        setLabStaff(profile.staff.filter((row) => row.roleType !== 'LAB_ADMIN'));
      } catch (err) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load agents');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!scope) return;
    setLoading(true);
    setError(null);
    try {
      setAgents(await fetchVendorDeliveryAgents(scope));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not load agents');
    } finally {
      setLoading(false);
    }
  }, [scope, diagnosticsVendor, session?.accessToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function resetFormFields() {
    setName('');
    setPhone('');
    setPassword('');
    setGovtIdType('AADHAAR');
    setGovtIdNumber('');
    setReference1Name('');
    setReference1Phone('');
    setReference2Name('');
    setReference2Phone('');
    setShowOptional(false);
    setEditingAgent(null);
    setEditingLabStaff(null);
    setEditStatus('ACTIVE');
    setLabTitle('COLLECTION_AGENT');
    setCollectionCapable(true);
  }

  function onLabTitleChange(next: LabAgentTitle) {
    setLabTitle(next);
    setCollectionCapable(defaultCollectionCapable(next));
  }

  function beginEditLabStaff(row: DiagnosticsStaffRow) {
    setError(null);
    setNotice(null);
    setEditingLabStaff(row);
    setName(row.displayName);
    const role = normalizeLabAgentTitle(row.title);
    setLabTitle(role);
    setCollectionCapable(row.collectionCapable ?? defaultCollectionCapable(role));
    setTab('edit');
  }

  async function toggleLabStaff(row: DiagnosticsStaffRow) {
    if (!session?.accessToken) return;
    setTogglingStaffId(row.id);
    setError(null);
    setNotice(null);
    try {
      await upsertDiagnosticsStaff(session.accessToken, {
        id: row.id,
        displayName: row.displayName,
        phone: row.phone,
        title: row.title ?? 'COLLECTION_AGENT',
        collectionCapable: row.collectionCapable,
        roleType: row.roleType,
        active: !row.active,
      });
      setNotice(`${row.displayName} is now ${row.active ? 'paused' : 'active'}.`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update status');
    } finally {
      setTogglingStaffId(null);
    }
  }

  async function onSaveLabStaffEdit(e: FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !editingLabStaff) return;
    const nextPassword = password.trim();
    if (nextPassword && nextPassword.length < 8) {
      setError('New login password must be at least 8 characters.');
      return;
    }
    setSavingEdit(true);
    setError(null);
    setNotice(null);
    try {
      await upsertDiagnosticsStaff(session.accessToken, {
        id: editingLabStaff.id,
        displayName: name.trim(),
        phone: editingLabStaff.phone,
        title: labTitle,
        collectionCapable,
        roleType: editingLabStaff.roleType,
        active: editingLabStaff.active,
        ...(nextPassword ? { password: nextPassword } : {}),
      });
      setNotice(nextPassword ? `Updated ${name.trim()} and reset login password.` : `Updated ${name.trim()}.`);
      resetFormFields();
      setTab('list');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update agent');
    } finally {
      setSavingEdit(false);
    }
  }

  function beginEdit(agent: VendorAgentDto) {
    setError(null);
    setNotice(null);
    setEditingAgent(agent);
    setName(agent.name);
    setEditStatus(agent.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setGovtIdType(agent.govtIdType ?? 'AADHAAR');
    setGovtIdNumber(agent.govtIdNumber ?? '');
    setReference1Name(agent.reference1Name ?? '');
    setReference1Phone(agent.reference1Phone ?? '');
    setReference2Name(agent.reference2Name ?? '');
    setReference2Phone(agent.reference2Phone ?? '');
    setShowOptional(
      Boolean(
        agent.govtIdNumber ||
          agent.reference1Name ||
          agent.reference1Phone ||
          agent.reference2Name ||
          agent.reference2Phone,
      ),
    );
    const role = normalizeLabAgentTitle(agent.labTitle);
    setLabTitle(role);
    setCollectionCapable(agent.collectionCapable ?? defaultCollectionCapable(role));
    setTab('edit');
  }

  function labRolePayload() {
    if (!diagnosticsVendor) return {};
    return { labTitle, collectionCapable };
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!scope || !editingAgent) return;
    setSavingEdit(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateVendorDeliveryAgent(scope, editingAgent.agentId, {
        name: name.trim(),
        govtIdType: showOptional && govtIdNumber.trim() ? govtIdType : undefined,
        govtIdNumber: showOptional ? govtIdNumber.replace(/\s/g, '').trim() || undefined : undefined,
        reference1Name: showOptional ? reference1Name.trim() || undefined : undefined,
        reference1Phone: showOptional ? reference1Phone.trim() || undefined : undefined,
        reference2Name: showOptional ? reference2Name.trim() || undefined : undefined,
        reference2Phone: showOptional ? reference2Phone.trim() || undefined : undefined,
        ...labRolePayload(),
      });
      const priorStatus = editingAgent.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      if (editStatus !== priorStatus) {
        await updateVendorDeliveryAgentStatus(scope, editingAgent.agentId, editStatus);
      }
      setNotice(`Updated ${updated.name}.`);
      resetFormFields();
      setTab('list');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update agent');
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleAgentStatus(agent: VendorAgentDto) {
    if (!scope) return;
    const next: AgentAvailabilityStatus = agent.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setTogglingId(agent.agentId);
    setError(null);
    setNotice(null);
    try {
      await updateVendorDeliveryAgentStatus(scope, agent.agentId, next);
      setNotice(`${agent.name} is now ${next === 'ACTIVE' ? 'active' : 'paused'}.`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not update status');
    } finally {
      setTogglingId(null);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!scope) return;
    const trimmedPhone = phone.trim();
    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await createVendorDeliveryAgent(scope, {
        name: name.trim(),
        phone: trimmedPhone,
        password,
        govtIdType: showOptional && govtIdNumber.trim() ? govtIdType : undefined,
        govtIdNumber: showOptional ? govtIdNumber.replace(/\s/g, '').trim() || undefined : undefined,
        reference1Name: showOptional ? reference1Name.trim() || undefined : undefined,
        reference1Phone: showOptional ? reference1Phone.trim() || undefined : undefined,
        reference2Name: showOptional ? reference2Name.trim() || undefined : undefined,
        reference2Phone: showOptional ? reference2Phone.trim() || undefined : undefined,
        ...labRolePayload(),
      });
      setNotice(`Agent ${name.trim()} created. They can log in on the delivery app.`);
      setName('');
      setPhone('');
      setPassword('');
      setTab('list');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not create agent');
    } finally {
      setCreating(false);
    }
  }

  const activeCount = diagnosticsVendor
    ? labStaff.filter((a) => a.active).length
    : agents.filter((a) => a.status === 'ACTIVE').length;

  if (!diagnosticsVendor && shopLoading && !shop) {
    return <p style={styles.muted}>Loading shop…</p>;
  }
  if (!diagnosticsVendor && !scope) {
    return (
      <Banner tone="warning">
        Shop details missing. Open <Link to="/settings">Settings</Link> or contact support.
      </Banner>
    );
  }

  return (
    <div style={styles.wrap}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <div style={styles.toolbar}>
        <p style={styles.meta}>
          {activeCount} active · {diagnosticsVendor ? labStaff.length : agents.length} total ·{' '}
          {diagnosticsVendor
            ? 'managers, collection agents, and lab technicians'
            : 'shop delivery staff (not hub agents)'}
        </p>
        {!diagnosticsVendor ? (
          <div style={styles.tabs}>
            <button
              type="button"
              style={tab === 'list' ? styles.tabOn : styles.tab}
              onClick={() => {
                resetFormFields();
                setTab('list');
              }}
            >
              Agents
            </button>
            <button
              type="button"
              style={tab === 'add' ? styles.tabOn : styles.tab}
              onClick={() => {
                resetFormFields();
                setTab('add');
              }}
            >
              Add agent
            </button>
          </div>
        ) : null}
      </div>

      {diagnosticsVendor && tab === 'list' ? (
        loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : labStaff.length === 0 ? (
          <Card style={styles.empty}>
            <p style={styles.emptyTitle}>No agents yet</p>
            <p style={styles.muted}>
              Add managers, collection agents, or lab technicians under{' '}
              <Link to="/diagnostics">Diagnostics → Staff</Link>.
            </p>
          </Card>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.thActions}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {labStaff.map((row) => (
                  <tr key={row.id} style={row.active ? undefined : styles.rowPaused}>
                    <td style={styles.td}>{row.displayName}</td>
                    <td style={styles.td}>{row.phone}</td>
                    <td style={styles.td}>{formatLabAgentRole(row.title)}</td>
                    <td style={styles.td}>
                      <span style={row.active ? styles.badgeOk : styles.badgeOff}>
                        {row.active ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td style={styles.tdActions}>
                      <Button size="sm" variant="ghost" onClick={() => beginEditLabStaff(row)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={togglingStaffId === row.id}
                        onClick={() => void toggleLabStaff(row)}
                      >
                        {togglingStaffId === row.id ? '…' : row.active ? 'Pause' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {!diagnosticsVendor && tab === 'list' ? (
        loading ? (
          <p style={styles.muted}>Loading…</p>
        ) : agents.length === 0 ? (
          <Card style={styles.empty}>
            <p style={styles.emptyTitle}>No delivery agents yet</p>
            <p style={styles.muted}>Add one to deliver orders with “Delivery by my agent”.</p>
            <Button size="sm" onClick={() => setTab('add')}>
              Add agent
            </Button>
          </Card>
        ) : (
          <ul style={styles.list}>
            {agents.map((a) => (
              <li key={a.agentId}>
                <Card style={styles.row}>
                  <div style={styles.rowMain}>
                    <span style={styles.rowName}>{a.name}</span>
                    <span style={styles.muted}>{a.phone}</span>
                    <span style={a.status === 'ACTIVE' ? styles.badgeOk : styles.badgeOff}>
                      {a.status === 'INACTIVE' ? 'PAUSED' : a.status}
                    </span>
                  </div>
                  <div style={styles.rowActions}>
                    <Button size="sm" variant="ghost" onClick={() => beginEdit(a)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={togglingId === a.agentId || a.status === 'DISABLED'}
                      onClick={() => void toggleAgentStatus(a)}
                    >
                      {togglingId === a.agentId
                        ? '…'
                        : a.status === 'ACTIVE'
                          ? 'Pause'
                          : 'Activate'}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {diagnosticsVendor && tab === 'edit' && editingLabStaff ? (
        <Card style={styles.formCard}>
          <p style={styles.hint}>Mobile {editingLabStaff.phone} is the login ID and cannot be changed here.</p>
          <form style={styles.form} onSubmit={(e) => void onSaveLabStaffEdit(e)}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <label style={styles.selectWrap}>
              <span style={styles.label}>Role</span>
              <select
                style={styles.select}
                value={labTitle}
                onChange={(e) => onLabTitleChange(e.target.value as LabAgentTitle)}
              >
                {LAB_AGENT_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {labTitle !== 'LAB_TECHNICIAN' ? (
              <label style={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={collectionCapable}
                  onChange={(e) => setCollectionCapable(e.target.checked)}
                />
                Can run home collection visits
              </label>
            ) : null}
            <TextField
              label="Reset login password (optional)"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p style={styles.hint}>Leave blank to keep the current password.</p>
            <div style={styles.formActions}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetFormFields();
                  setEditingLabStaff(null);
                  setTab('list');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {!diagnosticsVendor && tab === 'edit' && editingAgent ? (
        <Card style={styles.formCard}>
          <p style={styles.hint}>
            Mobile {editingAgent.phone} is the login ID and cannot be changed here.
          </p>
          <form style={styles.form} onSubmit={(e) => void onSaveEdit(e)}>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            {diagnosticsVendor ? (
              <>
                <label style={styles.selectWrap}>
                  <span style={styles.label}>Lab role</span>
                  <select
                    style={styles.select}
                    value={labTitle}
                    onChange={(e) => onLabTitleChange(e.target.value as LabAgentTitle)}
                  >
                    {LAB_AGENT_ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {labTitle !== 'LAB_TECHNICIAN' ? (
                  <label style={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={collectionCapable}
                      onChange={(e) => setCollectionCapable(e.target.checked)}
                    />
                    Can run home collection visits
                  </label>
                ) : null}
              </>
            ) : null}
            <label style={styles.selectWrap}>
              <span style={styles.label}>Availability</span>
              <select
                style={styles.select}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as AgentAvailabilityStatus)}
              >
                <option value="ACTIVE">Active — can be assigned deliveries</option>
                <option value="INACTIVE">Paused — not assigned new deliveries</option>
              </select>
            </label>
            <button
              type="button"
              style={styles.optionalToggle}
              onClick={() => setShowOptional((v) => !v)}
            >
              {showOptional ? 'Hide' : 'Show'} optional ID & references
            </button>
            {showOptional ? (
              <>
                <div style={styles.row2}>
                  <label style={styles.selectWrap}>
                    <span style={styles.label}>ID type</span>
                    <select
                      style={styles.select}
                      value={govtIdType}
                      onChange={(e) => setGovtIdType(e.target.value)}
                    >
                      <option value="AADHAAR">Aadhaar</option>
                      <option value="VOTER_ID">Voter ID</option>
                      <option value="DRIVING_LICENSE">Driving licence</option>
                      <option value="PAN">PAN</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <TextField
                    label="ID number"
                    value={govtIdNumber}
                    onChange={(e) => setGovtIdNumber(e.target.value)}
                  />
                </div>
                <div style={styles.row2}>
                  <TextField
                    label="Reference 1 name"
                    value={reference1Name}
                    onChange={(e) => setReference1Name(e.target.value)}
                  />
                  <TextField
                    label="Reference 1 phone"
                    value={reference1Phone}
                    onChange={(e) => setReference1Phone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
                <div style={styles.row2}>
                  <TextField
                    label="Reference 2 name"
                    value={reference2Name}
                    onChange={(e) => setReference2Name(e.target.value)}
                  />
                  <TextField
                    label="Reference 2 phone"
                    value={reference2Phone}
                    onChange={(e) => setReference2Phone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
              </>
            ) : null}
            <div style={styles.formActions}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetFormFields();
                  setTab('list');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Card>
      ) : !diagnosticsVendor ? (
        <Card style={styles.formCard}>
          <p style={styles.hint}>Name and mobile are required. Agent uses the delivery app to reach buyers.</p>
          <form style={styles.form} onSubmit={(e) => void onCreate(e)}>
            <div style={styles.row2}>
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <TextField
                label="Mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
                required
              />
            </div>
            <TextField
              label="Login password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {diagnosticsVendor ? (
              <>
                <label style={styles.selectWrap}>
                  <span style={styles.label}>Lab role</span>
                  <select
                    style={styles.select}
                    value={labTitle}
                    onChange={(e) => onLabTitleChange(e.target.value as LabAgentTitle)}
                  >
                    {LAB_AGENT_ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {labTitle !== 'LAB_TECHNICIAN' ? (
                  <label style={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={collectionCapable}
                      onChange={(e) => setCollectionCapable(e.target.checked)}
                    />
                    Can run home collection visits
                  </label>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              style={styles.optionalToggle}
              onClick={() => setShowOptional((v) => !v)}
            >
              {showOptional ? 'Hide' : 'Show'} optional ID & references (same as hub form)
            </button>
            {showOptional ? (
              <>
                <div style={styles.row2}>
                  <label style={styles.selectWrap}>
                    <span style={styles.label}>ID type</span>
                    <select
                      style={styles.select}
                      value={govtIdType}
                      onChange={(e) => setGovtIdType(e.target.value)}
                    >
                      <option value="AADHAAR">Aadhaar</option>
                      <option value="VOTER_ID">Voter ID</option>
                      <option value="DRIVING_LICENSE">Driving licence</option>
                      <option value="PAN">PAN</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <TextField
                    label="ID number"
                    value={govtIdNumber}
                    onChange={(e) => setGovtIdNumber(e.target.value)}
                  />
                </div>
                <div style={styles.row2}>
                  <TextField
                    label="Reference 1 name"
                    value={reference1Name}
                    onChange={(e) => setReference1Name(e.target.value)}
                  />
                  <TextField
                    label="Reference 1 phone"
                    value={reference1Phone}
                    onChange={(e) => setReference1Phone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
                <div style={styles.row2}>
                  <TextField
                    label="Reference 2 name"
                    value={reference2Name}
                    onChange={(e) => setReference2Name(e.target.value)}
                  />
                  <TextField
                    label="Reference 2 phone"
                    value={reference2Phone}
                    onChange={(e) => setReference2Phone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
              </>
            ) : null}
            <div style={styles.formActions}>
              <Button type="button" variant="ghost" onClick={() => setTab('list')}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create agent'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: '0.55rem', minWidth: 0 },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  meta: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' },
  tabs: { display: 'flex', gap: '0.35rem' },
  tab: {
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    cursor: 'pointer',
    fontSize: '0.82rem',
  },
  tabOn: {
    padding: '0.35rem 0.65rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--accent)',
    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-elevated))',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
  list: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.4rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.45rem',
    flexWrap: 'wrap',
    padding: '0.55rem 0.75rem',
  },
  rowMain: {
    display: 'grid',
    gridTemplateColumns: 'minmax(80px, 1fr) auto auto',
    gap: '0.45rem',
    alignItems: 'center',
    minWidth: 0,
    flex: '1 1 200px',
  },
  rowActions: { display: 'flex', gap: '0.2rem', flexShrink: 0 },
  rowName: { fontWeight: 700, fontSize: '0.9rem' },
  badgeOk: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: 'var(--accent-hover)',
  },
  badgeOff: { fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)' },
  empty: { textAlign: 'center', padding: '1rem' },
  emptyTitle: { margin: '0 0 0.35rem', fontWeight: 800 },
  muted: { margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' },
  formCard: { padding: '0.75rem 0.85rem' },
  hint: { margin: '0 0 0.45rem', fontSize: '0.82rem', color: 'var(--text-muted)' },
  form: { display: 'grid', gap: '0.45rem' },
  row2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.45rem',
  },
  optionalToggle: {
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    color: 'var(--accent-hover)',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'left',
  },
  selectWrap: { display: 'grid', gap: '0.2rem' },
  label: { fontSize: '0.78rem', fontWeight: 700 },
  select: {
    padding: '0.45rem 0.55rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    fontSize: '0.85rem',
  },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.25rem' },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
  th: {
    textAlign: 'left',
    padding: '0.45rem 0.55rem',
    background: 'var(--bg-muted, #f8fafc)',
    fontWeight: 800,
    borderBottom: '1px solid var(--border)',
  },
  thActions: {
    textAlign: 'right',
    padding: '0.45rem 0.55rem',
    background: 'var(--bg-muted, #f8fafc)',
    fontWeight: 800,
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '0.45rem 0.55rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' },
  tdActions: {
    padding: '0.45rem 0.55rem',
    borderBottom: '1px solid var(--border)',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  rowPaused: { opacity: 0.85, background: '#f8fafc' },
};
