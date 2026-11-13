import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeft, ArrowUpRight, Check, Download, FileCheck2, Minus, Search, UserPlus, Users, Wallet } from 'lucide-react';
import { api } from '../api.js';
import useFetch from '../lib/useFetch';
import { transferCost } from '../lib/fees';
import { date, monthLabel, naira, plural } from '../lib/format';
import { Avatar, Badge, Button, Card, Empty, ErrorNote, Field, Modal, Money, PageHeader, Skeleton } from '../components/ui';

function Checkbox({ checked, indeterminate }) {
  return (
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition duration-150 ${checked || indeterminate ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white'}`}>
      {checked ? <Check className="h-3.5 w-3.5 animate-pop-in" strokeWidth={3} /> : indeterminate ? <Minus className="h-3.5 w-3.5" strokeWidth={3} /> : null}
    </span>
  );
}

// Approved payroll from Solucio HR: each person's net pay, ready to send.
function FromHr() {
  const navigate = useNavigate();
  const { data: runs, loading, error } = useFetch('/hr/runs', { initial: [] });
  const [busy, setBusy] = useState(null);
  const [skipped, setSkipped] = useState(null);

  async function importRun(r) {
    setBusy(r.id);
    try {
      const res = await api(`/hr/runs/${r.id}/import`, { method: 'POST' });
      if (res.skipped?.length) setSkipped({ ...res, period: r.period });
      else { toast.success(res.existed ? 'Opened the existing payment run' : 'Payment run created from HR'); navigate(`/runs/${res.runId}`); }
    } catch (e) {
      if (e.data?.skipped?.length) setSkipped({ skipped: e.data.skipped, period: r.period, error: e.message });
      else toast.error(e.message, { duration: 6000 });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Card title="Approved payroll in Solucio HR" subtitle="HR works out each person’s take-home pay. Pick a month to pay it." bodyClass="">
        {loading ? (
          <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : error ? (
          <div className="p-5"><ErrorNote>{error}</ErrorNote></div>
        ) : runs.length === 0 ? (
          <Empty icon={FileCheck2} title="No approved payroll in HR yet">Approve a month’s payroll in Solucio HR, then come back here to pay it.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {runs.map((r) => (
              <li key={r.id} className="flex animate-fade-in flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><FileCheck2 className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 basis-52">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                    {monthLabel(r.period)}
                    {r.status === 'paid' ? <Badge color="green">Paid in HR</Badge> : <Badge color="blue">Approved in HR</Badge>}
                  </p>
                  <p className="text-sm text-slate-500">{plural(r.headcount || 0, 'person', 'people')} · <span className="money">{naira(Math.round((r.net || 0) * 100), { decimals: 0 })}</span> take-home · approved {date(r.approvedAt)}</p>
                </div>
                <div className="w-full sm:w-auto [&_a]:block [&_button]:w-full">
                {r.paymentRunId ? (
                  <Link to={`/runs/${r.paymentRunId}`}><Button variant="secondary" icon={ArrowUpRight}>Open payment run</Button></Link>
                ) : r.status === 'paid' ? (
                  <span className="text-sm text-slate-500">Already paid</span>
                ) : (
                  <Button icon={Download} loading={busy === r.id} disabled={Boolean(busy)} onClick={() => importRun(r)}>{busy === r.id ? 'Preparing…' : 'Pay this month'}</Button>
                )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-center text-sm text-slate-500">We sync staff and bank details from HR first. Nothing is paid until you approve.</p>

      <Modal open={Boolean(skipped)} onClose={() => setSkipped(null)} title={skipped?.runId ? 'Run created, with some people left out' : 'Couldn’t create the run'} size="sm" guardChanges={false}
        footer={<>
          <Link to="/employees?tab=attention" onClick={() => setSkipped(null)}><Button variant="secondary" className="w-full">Fix bank details</Button></Link>
          {skipped?.runId && <Button onClick={() => navigate(`/runs/${skipped.runId}`)}>Open run</Button>}
        </>}>
        <p className="flex items-start gap-2 text-sm text-slate-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {skipped?.runId
            ? 'These people are on the HR payroll but can’t be paid yet. Pay them in a separate run once their bank details are fixed. HR won’t be marked as paid automatically.'
            : skipped?.error}
        </p>
        <ul className="mt-4 space-y-2">
          {skipped?.skipped?.map((s) => (
            <li key={s.name} className="rounded-xl bg-amber-50/70 px-3 py-2 text-sm"><b className="text-slate-800">{s.name}</b><span className="block text-xs text-amber-800">{s.reason}</span></li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

export default function NewRun() {
  const navigate = useNavigate();
  const now = new Date();
  const [title, setTitle] = useState(`${now.toLocaleString('en-NG', { month: 'long', year: 'numeric' })} salaries`);
  const [period, setPeriod] = useState(now.toISOString().slice(0, 7));
  const { data: all, loading } = useFetch('/employees', { initial: [] });
  const { data: dash } = useFetch('/dashboard');
  const { data: health } = useFetch('/health');
  const [source, setSource] = useState(null);
  const mode = source || (health?.hr ? 'hr' : 'manual');
  const [selected, setSelected] = useState(new Set());
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const employees = useMemo(() => all.filter((e) => e.active && e.hasRecipient), [all]);
  useEffect(() => setSelected(new Set(employees.map((e) => e.id))), [employees]);

  const shown = employees.filter((e) => !q.trim() || e.fullName.toLowerCase().includes(q.trim().toLowerCase()));
  const picked = employees.filter((e) => selected.has(e.id));
  const total = picked.reduce((s, e) => s + e.salaryKobo, 0);
  const paystackFees = picked.reduce((s, e) => s + transferCost(e.salaryKobo).feeKobo, 0);
  const stampDuty = picked.reduce((s, e) => s + transferCost(e.salaryKobo).stampDutyKobo, 0);
  const fees = paystackFees + stampDuty;
  const needed = total + fees;
  const balance = dash?.balanceKobo;
  const coverage = balance == null || !needed ? null : Math.min(100, (balance / needed) * 100);
  const allOn = employees.length > 0 && selected.size === employees.length;

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function create() {
    setBusy(true);
    setError('');
    try {
      const run = await api('/payroll-runs', { method: 'POST', body: { title, period, employeeIds: [...selected] } });
      toast.success('Draft created. Check the amounts.');
      navigate(`/runs/${run.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        back={<Link to="/runs" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Payroll runs</Link>}
        title="New payroll run"
        subtitle={mode === 'hr' ? 'Pay a month that’s been approved in Solucio HR.' : 'Choose who gets paid. You can still change amounts before anything is sent.'}
      />
      {health?.hr && (
        <div role="tablist" aria-label="Where the amounts come from" className="mb-5 inline-grid grid-cols-2 rounded-full bg-white p-1 text-sm font-semibold shadow-sm ring-1 ring-slate-200">
          {[['hr', 'From HR payroll'], ['manual', 'Choose people']].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setSource(k)}
              className={`min-h-10 rounded-full px-5 transition ${mode === k ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{l}</button>
          ))}
        </div>
      )}
      {mode === 'hr' ? <FromHr /> : (
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Run details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
              <Field label="Month"><input className="input" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
            </div>
          </Card>

          <Card title="Who gets paid" subtitle={`${selected.size} of ${employees.length} selected`} bodyClass=""
            action={employees.length > 0 && (
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className="input rounded-full py-2 pl-10" placeholder="Find someone" aria-label="Find an employee" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            )}>
            {loading ? (
              <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : employees.length === 0 ? (
              <Empty icon={Users} title="No one to pay yet" action={<Link to="/employees?add=1"><Button icon={UserPlus}>Add employees</Button></Link>}>
                Add employees with verified bank accounts first.
              </Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                <li>
                  <button type="button" onClick={() => setSelected(allOn ? new Set() : new Set(employees.map((e) => e.id)))}
                    className="flex w-full items-center gap-3 bg-slate-50 px-4 py-2.5 text-left text-sm font-semibold text-slate-600 sm:px-5">
                    <Checkbox checked={allOn} indeterminate={!allOn && selected.size > 0} />
                    {allOn ? 'Unselect everyone' : 'Select everyone'}
                  </button>
                </li>
                {shown.map((e) => {
                  const on = selected.has(e.id);
                  return (
                    <li key={e.id}>
                      <button type="button" onClick={() => toggle(e.id)} aria-pressed={on}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors sm:px-5 ${on ? 'bg-brand-50/40 hover:bg-brand-50/70' : 'hover:bg-slate-50'}`}>
                        <Checkbox checked={on} />
                        <Avatar name={e.fullName} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm font-semibold transition-colors ${on ? 'text-slate-900' : 'text-slate-500'}`}>{e.fullName}</span>
                          <span className="block truncate text-xs text-slate-500">{e.bankName} ••••{e.accountLast4}</span>
                        </span>
                        <span className={`money text-sm font-semibold transition-colors ${on ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{naira(e.salaryKobo)}</span>
                      </button>
                    </li>
                  );
                })}
                {shown.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">No one matches “{q}”.</li>}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Summary" className="lg:sticky lg:top-8">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">People</dt><dd className="font-semibold">{plural(picked.length, 'person', 'people')}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Salaries</dt><dd className="font-semibold"><Money kobo={total} /></dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Paystack transfer fees</dt><dd className="font-semibold"><Money kobo={paystackFees} /></dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Stamp duty <span className="text-xs">(₦50 on ₦10k+)</span></dt><dd className="font-semibold"><Money kobo={stampDuty} /></dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Solucio Payroll fee</dt><dd className="font-semibold">₦0.00</dd></div>
            <div className="flex items-baseline justify-between border-t border-slate-100 pt-3"><dt className="font-semibold text-slate-700">Total needed</dt><dd className="text-xl font-bold text-slate-900"><Money kobo={needed} /></dd></div>
          </dl>
          {coverage != null && (
            <div className="mt-5 rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-slate-600"><Wallet className="h-3.5 w-3.5" /> Payroll balance</span>
                <span className="money font-semibold">{naira(balance, { decimals: 0 })}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full origin-left animate-grow-x rounded-full transition-[width] duration-500 ${coverage >= 100 ? 'bg-brand-600' : 'bg-amber-500'}`} style={{ width: `${coverage}%` }} />
              </div>
              <p className={`mt-2 text-xs ${coverage >= 100 ? 'text-slate-500' : 'font-medium text-amber-700'}`}>
                {coverage >= 100 ? 'Your balance covers this run.' : <>Short by {naira(needed - balance, { decimals: 0 })}. You can still create the draft. <Link to={`/funds?add=1&amount=${needed - balance}`} className="font-semibold underline">Add funds</Link></>}
              </p>
            </div>
          )}
          <div className="mt-5"><ErrorNote>{error}</ErrorNote></div>
          <Button className="mt-3 w-full" size="lg" loading={busy} disabled={!selected.size || !title.trim()} onClick={create}>Create draft</Button>
          <p className="mt-2 text-center text-xs text-slate-500">Nothing is paid until you approve.</p>
        </Card>
      </div>
      )}
    </>
  );
}
