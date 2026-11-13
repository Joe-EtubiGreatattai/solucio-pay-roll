import { useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, CheckCircle2, History, Mail, Receipt, KeyRound, Link2, Link2Off, RefreshCw, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { api, setToken } from '../api.js';
import { dateTime } from '../lib/format';
import { useAuth } from '../auth.jsx';
import useFetch from '../lib/useFetch';
import { Avatar, Badge, Button, Card, Confirm, ErrorNote, Field, IconButton, PageHeader, PasswordInput, Skeleton } from '../components/ui';

function HrConnection() {
  const { data, loading, reload } = useFetch('/hr/status');
  const [checking, setChecking] = useState(false);
  const recheck = async () => { setChecking(true); await reload(); setChecking(false); };
  return (
    <Card title="Solucio HR" subtitle="Staff, bank details and approved payroll come from HR.">
      {loading ? <Skeleton className="h-12" /> : !data?.configured ? (
        <div className="flex items-start gap-3 text-sm text-slate-600">
          <Link2Off className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <p>Not connected. Set <code className="rounded bg-slate-100 px-1">HR_API_URL</code> and <code className="rounded bg-slate-100 px-1">HR_API_KEY</code> in the payroll backend’s .env, using the same key as <code className="rounded bg-slate-100 px-1">PAYROLL_INTEGRATION_KEY</code> in HR.</p>
        </div>
      ) : data.connected ? (
        <div className="flex animate-fade-in items-start gap-3 text-sm">
          <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0"><span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 [animation-iteration-count:2]" /><span className="relative h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
          <div><p className="flex items-center gap-1.5 font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Connected</p><p className="break-all text-slate-500">{data.url}</p></div>
        </div>
      ) : (
        <div className="flex animate-fade-in items-start gap-3 text-sm">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div><p className="font-semibold text-amber-800">Can’t reach HR</p><p className="text-slate-600">{data.error}</p></div>
        </div>
      )}
      {data?.configured && <Button size="sm" variant="secondary" className="mt-4" icon={RefreshCw} loading={checking} onClick={recheck}>Check again</Button>}
    </Card>
  );
}

// What else payroll is connected to (all set in backend/.env)
function ConnectedApps() {
  const { data } = useFetch('/health');
  if (!data) return null;
  const rows = [
    { icon: Building2, label: 'Sign in with Solucio HR', on: data.hrSignIn, off: 'Set HR_API_URL and HR_API_KEY' },
    { icon: Mail, label: 'Payroll alerts by email (sent by HR)', on: data.hr, off: 'Needs the HR connection' },
    { icon: Receipt, label: 'Expenses recorded in Payment & Receipt', on: data.receipts, off: 'Set RECEIPTS_API_URL and RECEIPTS_API_KEY' },
  ];
  return (
    <Card title="Connected apps">
      <ul className="space-y-3 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-2.5">
            <r.icon className={`mt-0.5 h-4 w-4 shrink-0 ${r.on ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className="flex-1"><span className="font-medium text-slate-800">{r.label}</span><br /><span className="text-slate-500">{r.on ? 'On' : r.off}</span></span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { data: admins, loading, reload } = useFetch('/team', { initial: [] });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwError, setPwError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', tempPassword: '', password: '' });
  const [removeError, setRemoveError] = useState('');
  const { data: activity, loading: activityLoading, reload: reloadActivity } = useFetch('/team/activity', { initial: [] });
  const [addError, setAddError] = useState('');
  const [busy, setBusy] = useState('');
  const [removing, setRemoving] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function changePassword(e) {
    e.preventDefault();
    setBusy('pw');
    setPwError('');
    try {
      const r = await api('/auth/change-password', { method: 'POST', body: pw });
      if (r.token) setToken(r.token); // this browser stays signed in; others are signed out
      setPw({ currentPassword: '', newPassword: '' });
      toast.success('Password changed. Other devices are signed out.');
      reloadActivity();
    } catch (err) {
      setPwError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function addAdmin(e) {
    e.preventDefault();
    setBusy('add');
    setAddError('');
    try {
      await api('/team', { method: 'POST', body: form });
      toast.success(`${form.name} can now sign in`);
      setForm({ name: '', email: '', tempPassword: '', password: '' });
      reload();
      reloadActivity();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function removeAdmin(password) {
    setBusy('remove');
    setRemoveError('');
    try {
      await api(`/team/${removing.id}`, { method: 'DELETE', body: { password } });
      toast.success(`${removing.name} removed`);
      setRemoving(null);
      reload();
      reloadActivity();
    } catch (err) {
      setRemoveError(err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Your password and who can run payroll." />

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <Card title="Admins" subtitle="Everyone here can add employees and send payroll." className="lg:col-span-3" bodyClass="">
          {loading ? (
            <div className="space-y-3 p-5">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {admins.map((a) => (
                <li key={a.id || a.email} className="flex animate-fade-in items-center gap-3 px-4 py-3 sm:px-5">
                  <Avatar name={a.name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                      {a.name}
                      {a.primary && <Badge color="teal" icon={ShieldCheck}>Main admin</Badge>}
                      {a.source === 'hr' && <Badge color="blue" icon={Building2}>From Solucio HR</Badge>}
                      {a.id === user.id && <Badge>You</Badge>}
                    </p>
                    <p className="truncate text-sm text-slate-500">{a.email}{a.notSignedInYet && ' · hasn’t signed in yet'}</p>
                  </div>
                  {!a.primary && a.source !== 'hr' && a.id !== user.id && <IconButton icon={Trash2} tone="danger" label={`Remove ${a.name}`} onClick={() => setRemoving(a)} />}
                </li>
              ))}
              <li className="flex items-start gap-2.5 bg-sky-50/60 px-4 py-3 text-sm text-slate-600 sm:px-5">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <span>HR staff sign in here with their Solucio HR email and password once an HR admin ticks <b className="font-semibold text-slate-700">Payroll access</b> on their staff record. Turning it off there signs them out here.</span>
              </li>
            </ul>
          )}
          <form onSubmit={addAdmin} className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><UserPlus className="h-4 w-4 text-slate-500" /> Add an admin</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name"><input className="input" required value={form.name} onChange={set('name')} /></Field>
              <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set('email')} /></Field>
              <Field label="Their temporary password" hint="10+ characters with a number"><input className="input" required minLength={10} autoComplete="off" value={form.tempPassword} onChange={set('tempPassword')} /></Field>
              <Field label="Your password" hint="Admins can move money, so adding one needs your password"><PasswordInput required autoComplete="current-password" value={form.password} onChange={set('password')} /></Field>
            </div>
            <div className="mt-3"><ErrorNote>{addError}</ErrorNote></div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Share the temporary password with them. They can change it here.</p>
              <Button icon={UserPlus} loading={busy === 'add'}>Add admin</Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4 lg:col-span-2">
        <HrConnection />
        {user.source === 'hr' ? (
          <Card title="Your password">
            <p className="flex items-start gap-2.5 text-sm text-slate-600"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" /> You sign in with your Solucio HR account. Change your password in the HR staff portal; it changes here too.</p>
          </Card>
        ) : (
        <Card title="Your password">
          <form onSubmit={changePassword} className="space-y-4">
            <Field label="Current password"><PasswordInput required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
            <Field label="New password" hint="10+ characters, with letters and a number. Changing it signs out your other devices."><PasswordInput required minLength={10} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            <ErrorNote>{pwError}</ErrorNote>
            <Button icon={KeyRound} loading={busy === 'pw'}>Change password</Button>
          </form>
        </Card>
        )}
        <ConnectedApps />
        </div>
      </div>

      <Card title={<span className="flex items-center gap-2"><History className="h-4 w-4 text-slate-500" /> Activity</span>} subtitle="Sign-ins, payments, bank changes and admin changes. This log can’t be edited." className="mt-4" bodyClass="">
        {activityLoading ? (
          <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${/failed|locked/.test(a.action) ? 'bg-rose-500' : /bank|confirm|approve|admin/.test(a.action) ? 'bg-amber-500' : 'bg-slate-300'}`} />
                <span className="flex-1"><b className="font-semibold text-slate-800">{a.by}</b> <span className="text-slate-600">{a.label.charAt(0).toLowerCase() + a.label.slice(1)}</span></span>
                <span className="whitespace-nowrap text-xs text-slate-500">{dateTime(a.at)}</span>
              </li>
            ))}
            {activity.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">Nothing yet.</li>}
          </ul>
        )}
      </Card>

      <Confirm open={Boolean(removing)} onClose={() => setRemoving(null)} busy={busy === 'remove'} tone="danger" icon={Trash2} askPassword error={removeError}
        title="Remove this admin?" confirmLabel="Remove admin" onConfirm={removeAdmin}>
        <b className="text-slate-800">{removing?.name}</b> won’t be able to sign in to payroll any more.
      </Confirm>
    </>
  );
}
