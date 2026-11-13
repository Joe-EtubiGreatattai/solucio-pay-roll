import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle, ArrowLeft, BellRing, Check, CheckCircle2, Download, FileCheck2, FileEdit, Lock, Receipt, ReceiptText, RefreshCw, RotateCcw, Send, ShieldAlert, Trash2, UserCheck, Wallet, X,
} from 'lucide-react';
import { api, download } from '../api.js';
import { date, dateTime, monthLabel, naira, plural } from '../lib/format';
import { changedRecently } from '../lib/fees';
import {
  Avatar, Badge, Button, Card, Confirm, ErrorNote, IconButton, Money, PageHeader, Skeleton, SuccessCheck, StatusBadge, Tabs,
} from '../components/ui';

const STEPS = [
  { label: 'Review amounts', icon: FileEdit },
  { label: 'Lock amounts', icon: Lock },
  { label: 'Approve & send', icon: Send },
  { label: 'Paid', icon: Check },
];
const stepIndex = (s) => ({ DRAFT: 0, FUNDED: 1, PROCESSING: 2, COMPLETED: 4, PARTIAL_FAILED: 3 })[s] ?? 0;

function Stepper({ status }) {
  const current = stepIndex(status);
  const filled = Math.min(current, STEPS.length - 1) / (STEPS.length - 1);
  return (
    <div className="relative mb-6">
      {/* Track between the first and last step centres, filling as the run moves on */}
      <div className="absolute left-[12.5%] right-[12.5%] top-[18px] h-0.5 rounded-full bg-slate-200" aria-hidden="true">
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-out" style={{ width: `${filled * 100}%` }} />
      </div>
      <ol className="relative grid grid-cols-4" aria-label="Progress">
        {STEPS.map((s, i) => {
          const done = i < current;
          const now = i === current;
          const Icon = done ? Check : s.icon;
          return (
            <li key={s.label} aria-current={now ? 'step' : undefined} className="flex flex-col items-center gap-2 text-center">
              <span className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300 ${done ? 'bg-brand-700 text-white' : now ? 'bg-white text-brand-700 ring-2 ring-brand-600' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}>
                {now && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-400/40" />}
                <Icon className={`relative h-4 w-4 ${done ? 'animate-pop-in' : ''}`} />
              </span>
              <span className={`text-xs font-semibold sm:text-sm ${done || now ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// The run's money at a glance: one bar split into paid, sending, failed and not sent.
function MoneyBar({ run }) {
  const sum = (st) => run.items.filter((i) => st.includes(i.status)).reduce((s, i) => s + i.amountKobo, 0);
  const count = (st) => run.items.filter((i) => st.includes(i.status)).length;
  const parts = [
    { key: 'paid', label: 'Paid', st: ['SUCCESS'], cls: 'bg-brand-600', dot: 'bg-brand-600' },
    { key: 'sending', label: 'Sending', st: ['PENDING', 'QUEUED'], cls: 'in-flight', dot: 'bg-amber-400' },
    { key: 'failed', label: 'Failed', st: ['FAILED', 'REVERSED'], cls: 'bg-rose-500', dot: 'bg-rose-500' },
    { key: 'todo', label: 'Not sent yet', st: ['DRAFT'], cls: 'hatched', dot: 'bg-slate-300' },
  ].map((p) => ({ ...p, kobo: sum(p.st), n: count(p.st) })).filter((p) => p.n > 0);
  const total = run.totalKobo || 1;

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200">
        {parts.map((p) => (
          <div key={p.key} className={`h-full origin-left animate-grow-x transition-[width] duration-700 ease-out ${p.cls}`} style={{ width: `${(p.kobo / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${p.dot}`} />
            <span className="text-slate-500">{p.label}</span>
            <span className="money font-semibold text-slate-800">{naira(p.kobo, { decimals: 0 })}</span>
            <span className="text-slate-400">({p.n})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AmountCell({ item, onSave }) {
  const [value, setValue] = useState(item.amountKobo / 100);
  const [flash, setFlash] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    setValue(item.amountKobo / 100);
    if (first.current) { first.current = false; return; }
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [item.amountKobo]);
  const commit = () => {
    if (value === '' || Math.round(Number(value) * 100) === item.amountKobo) return setValue(item.amountKobo / 100);
    onSave(value);
  };
  return (
    <div className="relative ml-auto w-40">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-400">₦</span>
      <input type="number" min="0" step="0.01" aria-label={`Amount for ${item.employeeName}`} value={value}
        onChange={(e) => setValue(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={`input money py-1.5 pl-7 text-right font-semibold transition-colors duration-700 ${flash ? 'border-brand-400 bg-brand-50' : ''}`} />
    </div>
  );
}

// Every naira this run costs, line by line. The app itself adds nothing.
function FeeBreakdown({ run }) {
  const n = run.items.length;
  const dutyCount = run.items.filter((i) => i.stampDutyKobo > 0).length;
  const rows = [
    ['Salaries', `${plural(n, 'person', 'people')}`, run.totalKobo],
    ['Paystack transfer fees', `${plural(n, 'transfer')} · ₦10 / ₦25 / ₦50 by amount`, run.transferFeesKobo ?? run.feesKobo],
    ['Stamp duty', dutyCount ? `₦50 × ${dutyCount} (transfers of ₦10,000+)` : 'None (all under ₦10,000)', run.stampDutyKobo || 0],
    ['Solucio Payroll fee', 'This app charges nothing', 0],
  ];
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      {rows.map(([label, hint, kobo]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-2">
          <dt><span className="font-medium text-slate-700">{label}</span><span className="block text-xs text-slate-500">{hint}</span></dt>
          <dd className="money whitespace-nowrap font-semibold text-slate-900">{naira(kobo)}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-4 pt-3">
        <dt className="font-semibold text-slate-900">Total from payroll balance</dt>
        <dd className="money text-lg font-bold text-slate-900">{naira(run.totalKobo + run.feesKobo)}</dd>
      </div>
      {run.actualFeesKobo != null && (
        <p className="pt-3 text-xs text-slate-500">Paystack reported {naira(run.actualFeesKobo)} in transfer fees for this run. Any difference from the amount set aside was settled in the payroll balance (see Funds).</p>
      )}
    </dl>
  );
}

// After a run is paid: staff notices and the expense record in the hospital's books
function FollowUps({ run, busy, onRecord }) {
  const { receipts, paidNotices } = run;
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {paidNotices?.hr && (
        <li className="flex items-start gap-2 text-slate-600">
          <BellRing className={`mt-0.5 h-4 w-4 shrink-0 ${paidNotices.waiting ? 'text-amber-500' : 'text-emerald-600'}`} />
          {paidNotices.waiting
            ? <span>Telling {plural(paidNotices.waiting, 'person', 'people')} they’ve been paid…</span>
            : <span>{plural(paidNotices.sent, 'person', 'people')} told they’ve been paid (email and payslip in Solucio HR)</span>}
        </li>
      )}
      {receipts?.connected && (
        <li className="flex items-start gap-2 text-slate-600">
          <Receipt className={`mt-0.5 h-4 w-4 shrink-0 ${receipts.recordedAt ? 'text-emerald-600' : receipts.error ? 'text-amber-500' : 'text-slate-400'}`} />
          <span className="flex-1">
            {!receipts.records ? 'Test payments aren’t recorded in Payment & Receipt'
              : receipts.recordedAt ? `Recorded as expenses in Payment & Receipt, ${dateTime(receipts.recordedAt)}`
              : receipts.error ? `Not recorded in Payment & Receipt yet: ${receipts.error}`
              : 'Will be recorded in Payment & Receipt once Paystack confirms the final fees'}
            {receipts.records && !receipts.recordedAt && (
              <Button size="sm" variant="secondary" className="mt-2" icon={Receipt} loading={busy === 'record'} onClick={onRecord}>Record now</Button>
            )}
          </span>
        </li>
      )}
    </ul>
  );
}

export default function RunDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(null);
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null); // 'approve' | 'delete'
  const [filter, setFilter] = useState('all');
  const [dlgError, setDlgError] = useState('');
  const [ack, setAck] = useState(false);
  const [repeat, setRepeat] = useState(null); // names already paid this month
  const [retryTarget, setRetryTarget] = useState(null); // item, or 'all'
  const prevStatus = useRef(null);

  const load = useCallback(() => api(`/payroll-runs/${id}`).then(setRun).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  // Celebrate or warn once when a run finishes while the page is open
  useEffect(() => {
    if (!run) return;
    if (prevStatus.current === 'PROCESSING' && run.status === 'COMPLETED') toast.success('Everyone has been paid');
    if (prevStatus.current === 'PROCESSING' && run.status === 'PARTIAL_FAILED') toast.error('Some payments failed. Check the list.');
    prevStatus.current = run.status;
  }, [run?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (run && ['DRAFT', 'FUNDED'].includes(run.status)) api(`/payroll-runs/${id}/balance`).then(setBalance).catch(() => setBalance(null));
  }, [id, run?.status, run?.totalKobo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (run?.status !== 'PROCESSING') return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [run?.status, load]);

  // inDialog: show errors inside the open dialog (e.g. wrong password) instead of a toast
  async function act(label, path, opts = { method: 'POST' }, success, inDialog = false) {
    setBusy(label);
    setDlgError('');
    try {
      const res = await api(path, opts);
      if (res?.items) setRun(res);
      if (success) toast.success(success);
      return res || true;
    } catch (e) {
      if (inDialog) setDlgError(e.message);
      else toast.error(e.message);
      return e.data?.repeat ? { repeat: e.data.repeat } : null;
    } finally {
      setBusy('');
    }
  }

  async function lock(allowRepeat = false) {
    const r = await act('fund', `/payroll-runs/${id}/fund`, { method: 'POST', body: { allowRepeat } }, allowRepeat ? null : null);
    if (r?.repeat) return setRepeat(r.repeat);
    if (r) { toast.success('Amounts locked'); setRepeat(null); }
  }

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!run) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" /><Skeleton className="h-12" /><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const draft = run.status === 'DRAFT';
  const fromHr = Boolean(run.hrRunId);
  const sent = ['PROCESSING', 'COMPLETED', 'PARTIAL_FAILED'].includes(run.status);
  const failed = run.items.filter((i) => ['FAILED', 'REVERSED'].includes(i.status));
  const paid = run.items.filter((i) => i.status === 'SUCCESS');
  const sending = run.items.filter((i) => ['PENDING', 'QUEUED'].includes(i.status));
  const needed = run.totalKobo + run.feesKobo;
  const enough = !balance || balance.enough;
  const items = filter === 'all' ? run.items : run.items.filter((i) => ({ paid: ['SUCCESS'], sending: ['PENDING', 'QUEUED'], failed: ['FAILED', 'REVERSED'] })[filter].includes(i.status));

  const recentChanges = run.items.filter((i) => changedRecently(i.bankChangedAt));
  const alerts = run.items.filter((i) => i.alert);

  async function retry(password) {
    const targets = retryTarget === 'all' ? failed : [retryTarget];
    for (const i of targets) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await act('retry', `/payroll-runs/${id}/items/${i.id}/retry`, { method: 'POST', body: { password } }, null, true);
      if (!ok) return;
    }
    toast.success(`Retrying ${plural(targets.length, 'payment')}`);
    setRetryTarget(null);
  }

  return (
    <>
      <PageHeader
        back={<Link to="/runs" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Payroll runs</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{run.title} <StatusBadge status={run.status} /></span>}
        subtitle={<span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">{fromHr && <Badge color="teal" icon={FileCheck2}>From Solucio HR</Badge>}{run.period ? monthLabel(run.period) : 'No period'} · {plural(run.items.length, 'person', 'people')}{run.lockedByName && <> · locked by {run.lockedByName}</>}{run.approvedAt && <> · approved by {run.approvedByName || 'an admin'} {dateTime(run.approvedAt)}</>}</span>}
        actions={<>
          {sent && <Button variant="secondary" icon={Download} onClick={() => download(`/payroll-runs/${id}/export.csv`, `${run.title}.csv`).catch((e) => toast.error(e.message))}>Export CSV</Button>}
          {['DRAFT', 'FUNDED'].includes(run.status) && <Button variant="danger-soft" icon={Trash2} onClick={() => setConfirm('delete')}>Delete</Button>}
        </>}
      />

      <Stepper status={run.status} />

      {alerts.length > 0 && (
        <div role="alert" className="mb-4 flex animate-fade-up items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div><b>Check these payments in your Paystack dashboard.</b> Paystack sent an update that didn’t match what was paid, so it was ignored: {alerts.map((i) => i.employeeName).join(', ')}.</div>
        </div>
      )}
      {['DRAFT', 'FUNDED'].includes(run.status) && recentChanges.length > 0 && (
        <div className="mb-4 flex animate-fade-up items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <b>Bank accounts changed in the last 7 days:</b> {recentChanges.map((i) => `${i.employeeName} (${date(i.bankChangedAt)})`).join(', ')}.
            <span className="block text-amber-800">A last-minute bank change is the most common payroll fraud. Confirm the new account with each person (not by email) before approving.</span>
          </div>
        </div>
      )}

      {/* Summary and the one thing to do next */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" bodyClass="p-5 sm:p-6">
          {run.status === 'COMPLETED' ? (
            <div className="flex items-center gap-4">
              <SuccessCheck className="h-14 w-14" />
              <div>
                <p className="text-sm text-slate-500">Paid to {plural(paid.length, 'person', 'people')}</p>
                <p className="text-3xl font-bold tracking-tight text-slate-900"><Money kobo={run.totalKobo} /></p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">{sent ? 'Paid so far' : 'Salaries in this run'}</p>
                <p className="text-3xl font-bold tracking-tight text-slate-900">
                  <Money kobo={sent ? paid.reduce((s, i) => s + i.amountKobo, 0) : run.totalKobo} />
                  {sent && <span className="ml-2 text-base font-medium text-slate-400">of {naira(run.totalKobo)}</span>}
                </p>
              </div>
              {!sent && (
                <dl className="flex gap-6 text-sm">
                  <div><dt className="text-slate-500">Fees</dt><dd className="money font-semibold">{naira(run.feesKobo)}</dd></div>
                  <div><dt className="text-slate-500">Total needed</dt><dd className="money font-semibold">{naira(needed)}</dd></div>
                </dl>
              )}
            </div>
          )}
          <div className="mt-5"><MoneyBar run={run} /></div>
        </Card>

        <Card bodyClass="p-5 h-full flex flex-col">
          {draft && (
            <>
              <h2 className="font-semibold text-slate-900">Check the amounts</h2>
              <p className="mt-1 text-sm text-slate-500">{fromHr
                ? 'Each amount is the person’s take-home pay from the approved HR payroll. If something’s wrong, fix it in HR and import again.'
                : 'Change anyone’s amount for bonuses or deductions. When it’s right, lock the amounts.'}</p>
              {balance && (
                <div className={`mt-4 flex items-center gap-3 rounded-xl p-3 text-sm ${enough ? 'bg-slate-50' : 'animate-fade-in bg-amber-50 text-amber-900'}`}>
                  <Wallet className={`h-5 w-5 shrink-0 ${enough ? 'text-slate-500' : 'text-amber-600'}`} />
                  <span>Payroll balance <b className="money">{naira(balance.balanceKobo, { decimals: 0 })}</b>{!enough && <> · <Link to={`/funds?add=1&amount=${balance.neededKobo - balance.balanceKobo}`} className="font-semibold underline">add {naira(balance.neededKobo - balance.balanceKobo, { decimals: 0 })}</Link></>}</span>
                </div>
              )}
              <div className="flex-1" />
              <Button className="mt-4 w-full" icon={Lock} loading={busy === 'fund'} disabled={!enough || !run.items.length}
                onClick={() => lock(false)}>Lock amounts</Button>
            </>
          )}
          {run.status === 'FUNDED' && (
            <>
              <h2 className="font-semibold text-slate-900">Ready to pay</h2>
              <p className="mt-1 text-sm text-slate-500">Amounts are locked and the payroll balance covers them. Approving takes {naira(run.totalKobo + run.feesKobo)} from the balance and sends every salary now.</p>
              <div className="flex-1" />
              {run.needsSecondApprover ? (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
                  <UserCheck className="mt-0.5 h-4 w-4 shrink-0" /> You locked the amounts, so another admin must approve. Two people check every payment before money moves.
                </p>
              ) : (
                <Button className="mt-4 w-full" size="lg" icon={Send} disabled={!enough} onClick={() => { setAck(false); setDlgError(''); setConfirm('approve'); }}>Approve &amp; pay {naira(run.totalKobo, { decimals: 0 })}</Button>
              )}
            </>
          )}
          {run.status === 'PROCESSING' && (
            <>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900"><span className="relative flex h-2.5 w-2.5"><span className="absolute inset-0 animate-ping rounded-full bg-amber-400" /><span className="relative h-2.5 w-2.5 rounded-full bg-amber-500" /></span> Sending salaries</h2>
              <p className="mt-1 text-sm text-slate-500">{plural(sending.length, 'payment')} waiting for the bank. This page updates by itself.</p>
              {run.lastError && <div className="mt-3"><ErrorNote>Some payments didn’t reach Paystack: {run.lastError}</ErrorNote></div>}
              <div className="flex-1" />
              <div className="mt-4 flex flex-col gap-2">
                {run.lastError && <Button icon={Send} loading={busy === 'resend'} onClick={() => act('resend', `/payroll-runs/${id}/resend`, undefined, 'Sent again')}>Send the rest again</Button>}
                <Button variant="secondary" icon={RefreshCw} loading={busy === 'sync'} onClick={() => act('sync', `/payroll-runs/${id}/sync`, undefined, 'Statuses updated')}>Check with Paystack</Button>
              </div>
            </>
          )}
          {run.status === 'PARTIAL_FAILED' && (
            <>
              <h2 className="flex items-center gap-2 font-semibold text-rose-700"><AlertTriangle className="h-4 w-4" /> {plural(failed.length, 'payment')} failed</h2>
              <p className="mt-1 text-sm text-slate-500">The reason is next to each name. Fix the bank details if needed, then retry. Retrying never pays anyone twice.</p>
              <div className="flex-1" />
              <Button className="mt-4 w-full" icon={RotateCcw} onClick={() => { setDlgError(''); setRetryTarget('all'); }}>Retry {failed.length > 1 ? 'all failed' : 'failed payment'}</Button>
            </>
          )}
          {run.status === 'COMPLETED' && (
            <>
              <h2 className="font-semibold text-slate-900">All done</h2>
              <p className="mt-1 text-sm text-slate-500">The bank confirmed every payment. Download the list for your records.</p>
              {fromHr && (run.hrPaidAt ? (
                <p className="mt-4 flex animate-fade-in items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" /> Marked as paid in Solucio HR</p>
              ) : (
                <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    {run.hrPaidError ? `Couldn’t update Solucio HR: ${run.hrPaidError}` : run.hrComplete ? 'Updating Solucio HR…' : 'Some people from HR weren’t in this run, so HR wasn’t marked as paid.'}</p>
                  <Button size="sm" variant="secondary" className="mt-2" icon={FileCheck2} loading={busy === 'hr-paid'}
                    onClick={() => act('hr-paid', `/payroll-runs/${id}/hr-paid`, undefined, 'Marked as paid in Solucio HR')}>Mark month as paid in HR</Button>
                </div>
              ))}
              <FollowUps run={run} busy={busy} onRecord={() => act('record', `/payroll-runs/${id}/record-expenses`, undefined, 'Recorded in Payment & Receipt')} />
              <div className="flex-1" />
              <Button className="mt-4 w-full" variant="secondary" icon={Download} onClick={() => download(`/payroll-runs/${id}/export.csv`, `${run.title}.csv`)}>Download CSV</Button>
            </>
          )}
        </Card>
      </div>

      <Card className="mt-4" title={<span className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-slate-500" /> Cost breakdown</span>} subtitle="Every fee, from Paystack’s published prices. Nothing hidden.">
        <FeeBreakdown run={run} />
      </Card>

      <Card className="mt-4" bodyClass="">
        {sent ? (
          <div className="px-4 pt-3 sm:px-5">
            <Tabs value={filter} onChange={setFilter} tabs={[
              { value: 'all', label: 'Everyone', count: run.items.length },
              { value: 'paid', label: 'Paid', count: paid.length },
              { value: 'sending', label: 'Sending', count: sending.length },
              { value: 'failed', label: 'Failed', count: failed.length },
            ]} />
          </div>
        ) : (
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-[17px] font-semibold text-slate-900">People in this run</h2></div>
        )}
        <table className="table">
          <thead><tr><th>Employee</th><th>Bank</th><th className="text-right">Amount</th>{!draft && <th>Status</th>}<th className="w-16"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td data-label=""><div className="flex items-center gap-3"><Avatar name={i.employeeName} size="sm" /><span><span className="block font-semibold text-slate-800">{i.employeeName}</span>{changedRecently(i.bankChangedAt) && !sent && <span className="text-xs font-medium text-amber-700">Bank changed {date(i.bankChangedAt)}</span>}{i.alert && <span className="block max-w-xs text-xs font-medium text-rose-700">{i.alert}</span>}</span></div></td>
                <td data-label="Bank" className="text-slate-600"><span>{i.bankName} <span className="money text-slate-400">••••{i.accountLast4}</span></span></td>
                <td data-label="Amount" className="text-right">
                  <div className="flex flex-col items-end">
                    {draft && !fromHr ? <AmountCell item={i} onSave={(amount) => act('edit', `/payroll-runs/${id}/items/${i.id}`, { method: 'PATCH', body: { amount } })} />
                      : <span className="money font-semibold text-slate-900">{naira(i.amountKobo)}</span>}
                    <span className="money mt-0.5 text-xs text-slate-500" title="Paystack transfer fee + stamp duty">
                      + {naira((i.feeKobo || 0) + (i.stampDutyKobo || 0))} fees{i.actualFeeKobo != null && i.actualFeeKobo !== i.feeKobo ? ` (Paystack charged ${naira(i.actualFeeKobo)})` : ''}
                    </span>
                  </div>
                </td>
                {!draft && <td data-label="Status">
                  <div className="flex flex-col items-end gap-1 lg:items-start">
                    <span key={i.status} className="animate-pop-in"><StatusBadge status={i.status} /></span>
                    {i.failureReason && <span className="max-w-56 text-xs text-rose-600">{i.failureReason}</span>}
                  </div>
                </td>}
                <td data-label="" className="text-right">
                  {draft && <IconButton icon={X} tone="danger" label={`Remove ${i.employeeName} from this run`} onClick={() => act('remove', `/payroll-runs/${id}/items/${i.id}`, { method: 'DELETE' }, `${i.employeeName} removed from this run`)} />}
                  {['FAILED', 'REVERSED'].includes(i.status) && (
                    <Button size="sm" variant="secondary" icon={RotateCcw} disabled={!!busy} onClick={() => { setDlgError(''); setRetryTarget(i); }}>Retry</Button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500">No one in this list.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Confirm open={confirm === 'approve'} onClose={() => setConfirm(null)} busy={busy === 'approve'} icon={Send} askPassword error={dlgError}
        disabled={recentChanges.length > 0 && !ack}
        title="Send salaries now?" confirmLabel={`Pay ${naira(run.totalKobo, { decimals: 0 })}`}
        onConfirm={async (password) => {
          const r = await act('approve', `/payroll-runs/${id}/approve`, { method: 'POST', body: { password, acknowledgeBankChanges: ack } }, 'Salaries sent to Paystack', true);
          if (r && !r.repeat) setConfirm(null);
        }}>
        <p>This sends <b className="text-slate-800">{naira(run.totalKobo)}</b> to <b className="text-slate-800">{plural(run.items.length, 'person', 'people')}</b>.</p>
        <p className="mt-2"><b className="text-slate-800">{naira(run.totalKobo + run.feesKobo)}</b> comes out of the payroll balance: salaries plus {naira(run.transferFeesKobo ?? run.feesKobo)} Paystack fees{run.stampDutyKobo ? ` and ${naira(run.stampDutyKobo)} stamp duty` : ''}. Failed payments are returned. Payments can’t be cancelled once sent.</p>
        {recentChanges.length > 0 && (
          <label className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900">
            <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>I’ve confirmed the new bank accounts of {recentChanges.map((i) => i.employeeName).join(', ')} with each person directly.</span>
          </label>
        )}
      </Confirm>
      <Confirm open={Boolean(retryTarget)} onClose={() => setRetryTarget(null)} busy={busy === 'retry'} icon={RotateCcw} askPassword error={dlgError}
        title={retryTarget === 'all' ? `Retry ${plural(failed.length, 'payment')}?` : 'Retry this payment?'}
        confirmLabel="Retry" onConfirm={retry}>
        {retryTarget === 'all'
          ? <>The salary and fees for {failed.map((i) => i.employeeName).join(', ')} are taken from the payroll balance again and sent with new references. Nobody can be paid twice.</>
          : <>{naira(retryTarget?.amountKobo)} plus {naira((retryTarget?.feeKobo || 0) + (retryTarget?.stampDutyKobo || 0))} fees is taken from the payroll balance again and sent to {retryTarget?.employeeName}. If their bank details were fixed, the new account is used.</>}
      </Confirm>
      <Confirm open={Boolean(repeat)} onClose={() => setRepeat(null)} busy={busy === 'fund'} tone="danger" icon={ShieldAlert}
        title="Pay these people again?" confirmLabel="Yes, lock anyway" onConfirm={() => lock(true)}>
        {repeat?.join(', ')} {repeat?.length === 1 ? 'has' : 'have'} already been paid (or {repeat?.length === 1 ? 'is' : 'are'} being paid) for {monthLabel(run.period)} in another run. Only continue if this is a deliberate extra payment.
      </Confirm>
      <Confirm open={confirm === 'delete'} onClose={() => setConfirm(null)} busy={busy === 'delete'} tone="danger" icon={Trash2}
        title="Delete this run?" confirmLabel="Delete run"
        onConfirm={async () => { if (await act('delete', `/payroll-runs/${id}`, { method: 'DELETE' }, 'Run deleted')) navigate('/runs'); }}>
        <b className="text-slate-800">{run.title}</b> hasn’t been paid, so nothing is lost except this draft.
      </Confirm>
    </>
  );
}
