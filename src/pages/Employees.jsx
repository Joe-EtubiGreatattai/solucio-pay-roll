import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle, BadgeCheck, Building2, CheckCircle2, Loader2, Pencil, RefreshCw, Search, ShieldQuestion, UserCheck, UserMinus, UserPlus, Users, XCircle,
} from 'lucide-react';
import { api } from '../api.js';
import useFetch from '../lib/useFetch';
import { naira, plural } from '../lib/format';
import {
  Avatar, Badge, Button, Card, Confirm, Empty, ErrorNote, Field, IconButton, Modal, MoneyInput, PageHeader, PasswordInput, Skeleton, SuccessCheck, Tabs,
} from '../components/ui';
import { changedRecently } from '../lib/fees';
import { date } from '../lib/format';

// Changing where someone's salary goes always needs the admin's password
function ConfirmWithPassword({ value, onChange }) {
  return (
    <div className="mt-4 animate-fade-in rounded-xl border border-slate-200 bg-white p-3">
      <Field label="Your password" hint="Needed to save bank details. This protects against someone redirecting salaries.">
        <PasswordInput autoComplete="current-password" value={value} onChange={(e) => onChange(e.target.value)} />
      </Field>
    </div>
  );
}

function AccountCheck({ state, name, error }) {
  if (state === 'checking') return <p className="mt-2 flex animate-fade-in items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Checking with the bank…</p>;
  if (state === 'ok') {
    return (
      <div className="mt-2 flex animate-scale-in items-center gap-2.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
        <BadgeCheck className="h-5 w-5 shrink-0 animate-pop-in" />
        <span><span className="block text-xs text-emerald-700">Account name</span><b>{name}</b></span>
      </div>
    );
  }
  if (state === 'error') return <p className="mt-2 flex animate-shake items-center gap-2 text-sm text-rose-700"><XCircle className="h-4 w-4 shrink-0" /> {error}</p>;
  return <p className="mt-1 text-xs text-slate-500">We check the account with the bank before saving.</p>;
}

function ReadOnly({ label, children }) {
  return (
    <div>
      <span className="label">{label}</span>
      <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">{children || '—'}</p>
    </div>
  );
}

// Staff from HR: details are read-only here. The only fix allowed is choosing the bank when HR's name wasn't recognised.
function HrEmployeeModal({ open, employee, banks, onClose, onSaved }) {
  const [bankCode, setBankCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setBankCode(employee?.bankCode || ''); setError(''); setPassword(''); } }, [open, employee?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true);
    setError('');
    try {
      const updated = await api(`/employees/${employee.id}`, { method: 'PATCH', body: { bankCode, bankName: banks.find((b) => b.code === bankCode)?.name, password } });
      if (updated.attention) setError(updated.attention);
      else { toast.success(`${employee.fullName}’s account is verified`); onSaved(); }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!employee) return null;
  const bankChanged = bankCode && bankCode !== employee.bankCode;
  return (
    <Modal open={open} onClose={onClose} title={employee.fullName} guardChanges={false}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {bankChanged && <Button loading={busy} disabled={!password} onClick={save}>Verify account</Button>}
      </>}>
      <div className="space-y-5">
        <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-900">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" /> These details come from Solucio HR. Change them there, then sync.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnly label="Staff ID">{employee.staffId}</ReadOnly>
          <ReadOnly label="Department">{[employee.department, employee.jobTitle].filter(Boolean).join(' · ')}</ReadOnly>
          <ReadOnly label="Email">{employee.email}</ReadOnly>
          <ReadOnly label="Usual monthly pay"><span className="money">{naira(employee.salaryKobo)}</span></ReadOnly>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><Building2 className="h-4 w-4 text-slate-500" /> Bank account</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank" hint={employee.hrBankName ? `In HR: “${employee.hrBankName}”` : undefined}>
              <select className="input" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
                <option value="">Choose a bank…</option>
                {banks.map((b) => <option key={b.code + b.name} value={b.code}>{b.name}</option>)}
              </select>
            </Field>
            <ReadOnly label="Account number"><span className="money">{employee.accountLast4 ? `••••••${employee.accountLast4}` : 'Not in HR'}</span></ReadOnly>
          </div>
          {employee.hasRecipient && !bankChanged && (
            <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
              <BadgeCheck className="h-5 w-5 shrink-0" /><span><span className="block text-xs text-emerald-700">Verified account name</span><b>{employee.accountName}</b></span>
            </div>
          )}
          {employee.attention && !bankChanged && <p className="mt-3 flex items-start gap-2 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {employee.attention}</p>}
          {bankChanged && <ConfirmWithPassword value={password} onChange={setPassword} />}
        </div>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}

function EmployeeModal({ open, employee, banks, onClose, onSaved }) {
  const editing = Boolean(employee?.id);
  const [form, setForm] = useState({});
  const [check, setCheck] = useState({ state: 'idle' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setForm(editing
      ? { fullName: employee.fullName, email: employee.email || '', salary: employee.salaryKobo / 100, bankCode: employee.bankCode, accountNumber: '' }
      : { fullName: '', email: '', salary: '', bankCode: '', accountNumber: '' });
    setCheck(editing && employee.hasRecipient ? { state: 'ok', name: employee.accountName } : { state: 'idle' });
    setError('');
  }, [open, employee?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const changingBank = !editing || form.accountNumber || form.bankCode !== employee?.bankCode;

  useEffect(() => {
    if (!open) return;
    if (form.accountNumber?.length !== 10 || !form.bankCode) {
      if (changingBank && !(editing && !form.accountNumber)) setCheck({ state: 'idle' });
      return;
    }
    let cancelled = false;
    setCheck({ state: 'checking' });
    api('/banks/resolve', { method: 'POST', body: { accountNumber: form.accountNumber, bankCode: form.bankCode } })
      .then((r) => !cancelled && setCheck({ state: 'ok', name: r.accountName }))
      .catch((e) => !cancelled && setCheck({ state: 'error', error: e.message }));
    return () => { cancelled = true; };
  }, [form.accountNumber, form.bankCode, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsAccount = editing && form.bankCode !== employee?.bankCode && !form.accountNumber;
  const sendingBank = !editing ? Boolean(form.accountNumber) : Boolean(form.accountNumber);
  const canSave = form.fullName && form.salary !== '' && (!changingBank || check.state === 'ok' || (!editing && !form.accountNumber && !form.bankCode)) && !needsAccount && !busy && (!sendingBank || password);

  async function submit(e) {
    e?.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError('');
    const body = { fullName: form.fullName, email: form.email, salary: form.salary };
    if (form.accountNumber) Object.assign(body, { accountNumber: form.accountNumber, bankCode: form.bankCode, bankName: banks.find((b) => b.code === form.bankCode)?.name, password });
    try {
      await api(editing ? `/employees/${employee.id}` : '/employees', { method: editing ? 'PATCH' : 'POST', body });
      toast.success(editing ? `${form.fullName} updated` : `${form.fullName} added`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${employee.fullName}` : 'Add employee'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={busy} disabled={!canSave}>{editing ? 'Save changes' : 'Add employee'}</Button>
      </>}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" className="sm:col-span-2"><input className="input" required value={form.fullName || ''} onChange={set('fullName')} /></Field>
          <Field label="Email" hint="Optional"><input className="input" type="email" value={form.email || ''} onChange={set('email')} /></Field>
          <Field label="Monthly salary"><MoneyInput required value={form.salary ?? ''} onChange={set('salary')} /></Field>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><Building2 className="h-4 w-4 text-slate-500" /> Bank account</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank">
              <select className="input" value={form.bankCode || ''} onChange={set('bankCode')}>
                <option value="">Choose a bank…</option>
                {banks.map((b) => <option key={b.code + b.name} value={b.code}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Account number">
              <input className="input money tracking-wider" inputMode="numeric" maxLength={10} placeholder={editing && employee.accountLast4 ? `••••••${employee.accountLast4}` : '10 digits'}
                value={form.accountNumber || ''} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))} />
            </Field>
          </div>
          {needsAccount ? <p className="mt-2 text-sm text-amber-700">Enter the account number for the new bank.</p> : <AccountCheck {...check} />}
          {form.accountNumber && check.state === 'ok' && <ConfirmWithPassword value={password} onChange={setPassword} />}
        </div>
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function SyncResult({ result, onClose, onFix }) {
  const r = result || {};
  return (
    <Modal open={Boolean(result)} onClose={onClose} title="Synced with Solucio HR" size="sm" guardChanges={false}
      footer={<Button onClick={onClose}>Done</Button>}>
      <div className="flex flex-col items-center text-center">
        {r.attention?.length ? (
          <span className="mb-3 flex h-14 w-14 animate-pop-in items-center justify-center rounded-full bg-amber-50 text-amber-600"><AlertTriangle className="h-7 w-7" /></span>
        ) : <SuccessCheck className="mb-3 h-14 w-14" />}
        <p className="text-sm text-slate-500">{plural(r.total || 0, 'person', 'people')} in HR</p>
      </div>
      <dl className="stagger mt-4 grid grid-cols-3 gap-2 text-center">
        {[['Added', r.added], ['Updated', r.updated], ['Taken off payroll', r.removed]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{l}</dt><dd className="text-xl font-bold text-slate-900">{v || 0}</dd></div>
        ))}
      </dl>
      {r.attention?.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold text-slate-700">{plural(r.attention.length, 'person needs', 'people need')} a fix before they can be paid</p>
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {r.attention.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onFix(a.id)} className="w-full rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-left text-sm transition hover:bg-amber-50">
                  <b className="text-slate-800">{a.name}</b>
                  <span className="block text-xs text-amber-800">{a.issue}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

export default function Employees() {
  const { data: list, loading, error, reload } = useFetch('/employees', { initial: [] });
  const { data: banks } = useFetch('/banks', { initial: [] });
  const { data: health } = useFetch('/health');
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(() => (params.get('tab') === 'attention' ? 'attention' : 'active'));
  const [q, setQ] = useState('');
  const [toggling, setToggling] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState('');
  const [syncResult, setSyncResult] = useState(null);
  const hrOn = Boolean(health?.hr);

  const editId = params.get('edit');
  const modalOpen = params.get('add') === '1' || Boolean(editId);
  const editing = editId ? list.find((e) => e.id === editId) : null;
  const closeModal = () => setParams({}, { replace: true });

  const active = list.filter((e) => e.active);
  const needsFix = active.filter((e) => !e.hasRecipient);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list
      .filter((e) => ({ all: true, active: e.active, attention: e.active && !e.hasRecipient, inactive: !e.active })[tab])
      .filter((e) => !term || `${e.fullName} ${e.email || ''} ${e.bankName || ''} ${e.accountName || ''} ${e.staffId || ''} ${e.department || ''}`.toLowerCase().includes(term));
  }, [list, tab, q]);
  const monthly = active.reduce((s, e) => s + e.salaryKobo, 0);

  async function sync() {
    setBusy('sync');
    try {
      const r = await api('/hr/sync', { method: 'POST' });
      setSyncResult(r);
      reload();
    } catch (e) {
      toast.error(e.message, { duration: 6000 });
    } finally {
      setBusy('');
    }
  }

  async function toggleActive() {
    setBusy('toggle');
    try {
      await api(`/employees/${toggling.id}`, { method: 'PATCH', body: { active: !toggling.active } });
      toast.success(toggling.active ? `${toggling.fullName} taken off payroll` : `${toggling.fullName} is back on payroll`);
      setToggling(null);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }

  // Ask the banks again about every account that couldn't be verified (e.g. after switching to live keys)
  async function recheckAll() {
    setBusy('recheck');
    try {
      const r = await api('/employees/recheck', { method: 'POST' });
      if (r.fixed) toast.success(`${plural(r.fixed, 'account')} verified`);
      if (r.still.length) toast(`${plural(r.still.length, 'person still needs', 'people still need')} a fix. The reason is next to each name.`, { icon: '⚠️' });
      else if (!r.fixed) toast.success('Nothing left to check');
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }
  async function recheckOne(e) {
    setBusy(`recheck:${e.id}`);
    try {
      const r = await api(`/employees/${e.id}/recheck`, { method: 'POST' });
      if (r.fixed) toast.success(`${e.fullName}’s account is verified`);
      else toast.error(r.employee?.attention || 'Still couldn’t verify this account');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  }

  const [confirmError, setConfirmError] = useState('');
  async function confirmAccount(password) {
    setBusy('confirm');
    setConfirmError('');
    try {
      const r = await api(`/employees/${confirming.id}/confirm-account`, { method: 'POST', body: { password } });
      if (r.attention) toast.error(r.attention);
      else toast.success(`${confirming.fullName}’s account is confirmed`);
      setConfirming(null);
      reload();
    } catch (e) {
      setConfirmError(e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={loading ? 'Loading…' : `${plural(active.length, 'person', 'people')} on payroll · ${naira(monthly, { decimals: 0 })} a month`}
        actions={<>
          {hrOn && <Button icon={RefreshCw} loading={busy === 'sync'} onClick={sync}>{busy === 'sync' ? 'Syncing…' : 'Sync from HR'}</Button>}
          <Button variant={hrOn ? 'secondary' : 'primary'} icon={UserPlus} onClick={() => setParams({ add: '1' })}>Add employee</Button>
        </>}
      />
      <ErrorNote>{error}</ErrorNote>

      {needsFix.length > 0 && (
        <div className="mb-4 flex w-full animate-fade-up flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="min-w-48 flex-1"><b>{plural(needsFix.length, 'person can’t', 'people can’t')}</b> be paid until their bank account is fixed.</span>
          <Button size="sm" variant="secondary" icon={RefreshCw} loading={busy === 'recheck'} onClick={recheckAll}>{busy === 'recheck' ? 'Checking with banks…' : 'Check all again'}</Button>
          {tab !== 'attention' && <button type="button" onClick={() => setTab('attention')} className="font-semibold hover:underline">Review</button>}
        </div>
      )}

      <Card bodyClass="">
        <div className="flex flex-col gap-3 px-4 pt-3 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <Tabs value={tab} onChange={setTab} tabs={[
            { value: 'active', label: 'On payroll', count: active.length },
            { value: 'attention', label: 'Needs a fix', count: needsFix.length },
            { value: 'inactive', label: 'Off payroll', count: list.length - active.length },
            { value: 'all', label: 'All', count: list.length },
          ]} />
          <div className="relative mb-2 sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input rounded-full py-2 pl-10" placeholder="Name, staff ID or bank" aria-label="Filter employees" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : shown.length === 0 ? (
          list.length === 0 ? (
            <Empty icon={Users} title="No employees yet"
              action={hrOn ? <Button icon={RefreshCw} loading={busy === 'sync'} onClick={sync}>Sync from HR</Button> : <Button icon={UserPlus} onClick={() => setParams({ add: '1' })}>Add employee</Button>}>
              {hrOn ? 'Bring in everyone from Solucio HR with their bank accounts and pay.' : 'Add each person with their salary and bank account.'}
            </Empty>
          ) : tab === 'attention' ? (
            <Empty icon={CheckCircle2} title="Everyone can be paid">Every bank account on payroll is verified.</Empty>
          ) : (
            <Empty icon={Search} title="No matches">Try a different name or bank, or switch tabs.</Empty>
          )
        ) : (
          <table className="table">
            <thead><tr><th>Employee</th><th>Bank account</th><th className="text-right">Monthly pay</th><th className="w-24"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} className={e.active ? '' : 'opacity-60'}>
                  <td data-label="">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.fullName} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-800">
                          <span className="truncate">{e.fullName}</span>
                          {e.source === 'hr' && <Badge color="teal">HR</Badge>}
                          {!e.active && <Badge>Off payroll</Badge>}
                        </p>
                        <p className="truncate text-xs text-slate-500">{[e.staffId, e.department].filter(Boolean).join(' · ') || e.email || 'Added here'}</p>
                      </div>
                    </div>
                  </td>
                  <td data-label="Bank account">
                    {e.hasRecipient ? (
                      <div>
                        <p className="font-medium text-slate-700">{e.bankName} <span className="money text-slate-500">••••{e.accountLast4}</span></p>
                        <p className="flex items-center justify-end gap-1 text-xs text-emerald-700 lg:justify-start"><BadgeCheck className="h-3.5 w-3.5" /> {e.accountName}</p>
                        {changedRecently(e.bankChangedAt) && <p className="text-xs font-medium text-amber-700">Changed {date(e.bankChangedAt)}</p>}
                      </div>
                    ) : (
                      <div className="max-w-xs">
                        <p className="flex items-start justify-end gap-1.5 text-xs font-medium text-amber-800 lg:justify-start">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> <span>{e.attention || 'Bank account not verified'}</span>
                        </p>
                        {e.nameMismatch ? (
                          <button type="button" onClick={() => setConfirming(e)} className="mt-1 text-xs font-semibold text-brand-700 hover:underline">Check and confirm</button>
                        ) : (e.source === 'hr' && e.accountLast4 && !e.bankCode) || (e.source !== 'hr' && !e.accountLast4) ? (
                          <button type="button" onClick={() => setParams({ edit: e.id })} className="mt-1 text-xs font-semibold text-brand-700 hover:underline">{e.source === 'hr' ? 'Choose bank' : 'Add bank account'}</button>
                        ) : e.accountLast4 ? (
                          <button type="button" disabled={busy === `recheck:${e.id}`} onClick={() => recheckOne(e)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-60">
                            {busy === `recheck:${e.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Check again
                          </button>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td data-label="Monthly pay" className="money text-right font-semibold text-slate-900">{naira(e.salaryKobo)}</td>
                  <td data-label="">
                    <div className="flex justify-end gap-1">
                      <IconButton icon={Pencil} label={e.source === 'hr' ? `View ${e.fullName}` : `Edit ${e.fullName}`} onClick={() => setParams({ edit: e.id })} />
                      {e.active
                        ? <IconButton icon={UserMinus} tone="danger" label={`Take ${e.fullName} off payroll`} onClick={() => setToggling(e)} />
                        : <IconButton icon={UserCheck} tone="brand" label={`Put ${e.fullName} back on payroll`} onClick={() => setToggling(e)} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing?.source === 'hr' ? (
        <HrEmployeeModal open={modalOpen} employee={editing} banks={banks} onClose={closeModal} onSaved={() => { closeModal(); reload(); }} />
      ) : (
        <EmployeeModal open={modalOpen && (!editId || Boolean(editing))} employee={editing} banks={banks} onClose={closeModal} onSaved={() => { closeModal(); reload(); }} />
      )}

      <SyncResult result={syncResult} onClose={() => setSyncResult(null)} onFix={(id) => { setSyncResult(null); setParams({ edit: id }); }} />

      <Confirm open={Boolean(toggling)} onClose={() => setToggling(null)} busy={busy === 'toggle'} onConfirm={toggleActive}
        tone={toggling?.active ? 'danger' : 'primary'} icon={toggling?.active ? UserMinus : UserCheck}
        title={toggling?.active ? 'Take off payroll?' : 'Put back on payroll?'}
        confirmLabel={toggling?.active ? 'Take off payroll' : 'Put back on payroll'}>
        {toggling?.active
          ? <><b className="text-slate-800">{toggling?.fullName}</b> won’t be included in new payroll runs. Past runs keep their records.{toggling?.source === 'hr' && ' The next HR sync puts them back if they’re still employed in HR.'}</>
          : <><b className="text-slate-800">{toggling?.fullName}</b> will be included in new payroll runs again.</>}
      </Confirm>

      <Confirm open={Boolean(confirming)} onClose={() => setConfirming(null)} busy={busy === 'confirm'} onConfirm={confirmAccount} askPassword error={confirmError}
        icon={ShieldQuestion} title="Is this the right account?" confirmLabel="Yes, it’s theirs">
        The bank says account <b className="money text-slate-800">••••{confirming?.accountLast4}</b> belongs to <b className="text-slate-800">{confirming?.attention?.match(/“(.*)”/)?.[1]}</b>, not <b className="text-slate-800">{confirming?.fullName}</b>.
        Only confirm if you’ve checked with them. Salary will go to this account.
      </Confirm>
    </>
  );
}
