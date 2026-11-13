import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowDownLeft, ArrowUpRight, BadgeCheck, Clock, CreditCard, Landmark, Loader2, Plus, ReceiptText, RefreshCw, RotateCcw, Scale, ShieldAlert, ShieldCheck, Wallet } from 'lucide-react';
import { api } from '../api.js';
import useFetch from '../lib/useFetch';
import { chargeFee, grossUpForNet } from '../lib/fees';
import { dateTime, naira } from '../lib/format';
import { Badge, Button, Card, Empty, ErrorNote, Field, Modal, Money, MoneyInput, PageHeader, Skeleton, SuccessCheck } from '../components/ui';

const KIND = {
  funding: { label: 'Added', color: 'green', icon: ArrowDownLeft },
  payout: { label: 'Salary', color: 'slate', icon: ArrowUpRight },
  refund: { label: 'Returned', color: 'blue', icon: RotateCcw },
  adjustment: { label: 'Adjustment', color: 'amber', icon: Scale },
  fee_adjustment: { label: 'Fee settled', color: 'teal', icon: ReceiptText },
};

// All fees in one place, straight from the backend's fee table
function FeesExplained() {
  const { data } = useFetch('/funds/fees');
  if (!data) return null;
  return (
    <Card title={<span className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-slate-500" /> Fees explained</span>} subtitle="Every charge that can touch the payroll balance. Solucio Payroll itself charges nothing." className="mt-4">
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="font-semibold text-slate-800">Paying a salary</dt>
          <dd className="mt-1 text-slate-600">Paystack transfer fee: ₦10 up to ₦5,000 · ₦25 up to ₦50,000 · ₦50 above. Only charged when the payment succeeds.</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="font-semibold text-slate-800">Stamp duty</dt>
          <dd className="mt-1 text-slate-600">{data.stampDuty ? '₦50 on each salary of ₦10,000 or more (government levy collected by Paystack).' : 'Not charged: this business is registered as exempt.'}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="font-semibold text-slate-800">Adding funds</dt>
          <dd className="mt-1 text-slate-600">Paystack: 1.5% + ₦100 (₦100 waived under ₦2,500), never more than ₦2,000. You see the fee before paying; the real fee is shown after.</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-slate-500">Fees are set aside when a run is approved and settled against what Paystack actually charges once each payment succeeds. Failed payments return their salary and fees in full.</p>
    </Card>
  );
}

function AddFunds({ open, onClose, suggestion }) {
  const [amount, setAmount] = useState('');
  const [exact, setExact] = useState(true); // the amount entered is what must land in the balance
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setAmount(suggestion ? String(Math.ceil(suggestion / 100)) : ''); setError(''); } }, [open, suggestion]);

  const entered = Math.round(Number(amount || 0) * 100);
  const kobo = entered > 0 ? (exact ? grossUpForNet(entered) : entered) : 0;
  const fee = kobo > 0 ? chargeFee(kobo) : 0;

  async function go() {
    setBusy(true);
    setError('');
    try {
      const { authorizationUrl } = await api('/funds/checkout', { method: 'POST', body: { amount, exact } });
      window.location.assign(authorizationUrl); // Paystack checkout, then back to /funds
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add funds" size="sm" guardChanges={false}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button icon={ShieldCheck} loading={busy} disabled={kobo < 100_000} onClick={go}>Pay {kobo ? naira(kobo) : ''} on Paystack</Button>
      </>}>
      <div className="space-y-4">
        <div role="tablist" aria-label="What the amount means" className="grid grid-cols-2 rounded-full bg-slate-100 p-1 text-sm font-semibold">
          {[[true, 'Amount to add'], [false, 'Amount to pay']].map(([v, l]) => (
            <button key={l} type="button" role="tab" aria-selected={exact === v} onClick={() => setExact(v)}
              className={`min-h-9 rounded-full transition ${exact === v ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
          ))}
        </div>
        <Field label={exact ? 'Amount to add to the balance' : 'Amount to pay'} hint={exact ? 'Paystack’s fee is added on top, so exactly this lands' : 'Paystack’s fee comes out of this amount'}>
          <MoneyInput autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} className="py-3 text-lg font-semibold" />
        </Field>
        {kobo > 0 && (
          <dl className="animate-fade-in space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">You pay</dt><dd className="money font-semibold">{naira(kobo)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Paystack fee <span className="text-xs">(local card, transfer or USSD)</span></dt><dd className="money">− {naira(fee)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-2"><dt className="font-semibold text-slate-700">Added to payroll balance</dt><dd className="money font-bold text-brand-700">{naira(kobo - fee)}</dd></div>
          </dl>
        )}
        {kobo > 0 && <p className="text-xs text-slate-500">Foreign cards cost more (3.9% + ₦100). The balance is credited with whatever actually arrives after Paystack’s real fee.</p>}
        <p className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex gap-1.5"><CreditCard className="h-4 w-4" /><Landmark className="h-4 w-4" /></span>
          Pay by card, bank transfer or USSD on Paystack’s secure page. You’ll come straight back here.
        </p>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}

// Shown when the admin comes back from Paystack checkout
function ReturnFromCheckout({ reference, onDone }) {
  const [state, setState] = useState({ step: 'checking' });
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api(`/funds/verify/${encodeURIComponent(reference)}`, { method: 'POST' })
      .then((r) => setState({ step: r.status === 'SUCCESS' ? 'ok' : r.status === 'PENDING' ? 'pending' : 'failed', ...r }))
      .catch((e) => setState({ step: 'error', error: e.message }));
  }, [reference]);

  const close = () => onDone(state.step === 'ok');
  return (
    <Modal open onClose={close} title="Adding funds" size="sm" guardChanges={false} footer={state.step !== 'checking' && <Button onClick={close}>Done</Button>}>
      <div className="flex flex-col items-center py-4 text-center">
        {state.step === 'checking' && <><Loader2 className="mb-3 h-10 w-10 animate-spin text-brand-600" /><p className="font-semibold">Confirming with Paystack…</p></>}
        {state.step === 'ok' && (
          <>
            <SuccessCheck className="mb-4 h-16 w-16" />
            <p className="text-2xl font-bold text-slate-900"><Money kobo={state.creditedKobo} /></p>
            <p className="mt-1 text-sm text-slate-500">added to the payroll balance{state.feeKobo ? ` (Paystack fee ${naira(state.feeKobo)})` : ''}</p>
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-2 text-sm">Balance now <b className="money">{naira(state.balanceKobo)}</b></p>
          </>
        )}
        {state.step === 'pending' && (
          <>
            <span className="mb-3 flex h-14 w-14 animate-pop-in items-center justify-center rounded-full bg-amber-50 text-amber-600"><Clock className="h-7 w-7" /></span>
            <p className="font-semibold">Waiting for the payment</p>
            <p className="mt-1 text-sm text-slate-500">Paystack hasn’t confirmed it yet. Bank transfers can take a few minutes. It’ll be added as soon as it’s confirmed.</p>
          </>
        )}
        {(state.step === 'failed' || state.step === 'error') && (
          <>
            <p className="font-semibold text-rose-700">The payment didn’t go through</p>
            <p className="mt-1 text-sm text-slate-500">{state.error || 'Nothing was added. You can try again.'}</p>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function Funds() {
  const { data, loading, error, reload } = useFetch('/funds');
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(params.get('add') === '1');
  const reference = params.get('reference') || params.get('trxref');
  const suggestion = Number(params.get('amount')) || 0; // kobo, e.g. how much a run is short by
  const [checking, setChecking] = useState(null);

  async function recheck(ref) {
    setChecking(ref);
    try {
      const r = await api(`/funds/verify/${encodeURIComponent(ref)}`, { method: 'POST' });
      if (r.status === 'SUCCESS') toast.success(`${naira(r.creditedKobo)} added`);
      else toast(r.status === 'PENDING' ? 'Still waiting for Paystack' : 'That payment didn’t go through');
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setChecking(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Funds"
        subtitle="Money Solucio has added for payroll. Salaries are paid from this balance only."
        actions={<Button icon={Plus} onClick={() => setAdding(true)}>Add funds</Button>}
      />
      <ErrorNote>{error}</ErrorNote>

      {loading || !data ? (
        <div className="space-y-4"><Skeleton className="h-44 rounded-3xl" /><Skeleton className="h-72 rounded-2xl" /></div>
      ) : (
        <>
          <section className="relative mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-6 text-white shadow-sm sm:p-8">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/5" aria-hidden="true" />
            <div className="absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-white/5" aria-hidden="true" />
            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="flex items-center gap-2 text-sm text-brand-100"><Wallet className="h-4 w-4" /> Payroll balance</p>
                <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl"><Money kobo={data.balanceKobo} /></p>
                <p className="mt-2 text-sm text-brand-100">Available to pay salaries</p>
              </div>
              <dl className="flex gap-8 text-sm">
                <div><dt className="text-brand-200">Added, last 30 days</dt><dd className="money mt-0.5 text-lg font-semibold">{naira(data.addedLast30Kobo, { decimals: 0 })}</dd></div>
                <div><dt className="text-brand-200">Paid out, last 30 days</dt><dd className="money mt-0.5 text-lg font-semibold">{naira(data.paidLast30Kobo, { decimals: 0 })}</dd></div>
                <div><dt className="text-brand-200">Of which fees</dt><dd className="money mt-0.5 text-lg font-semibold">{naira(data.feesLast30Kobo || 0)}</dd></div>
              </dl>
            </div>
            {data.integrity && (
              <p className={`relative mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${data.integrity.ok ? 'bg-white/10 text-brand-50' : 'bg-rose-500 text-white'}`}>
                {data.integrity.ok ? <BadgeCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                {data.integrity.ok ? `Balance matches all ${data.integrity.entries} entries below` : 'The balance doesn’t match its history. Don’t approve payments; contact support.'}
              </p>
            )}
          </section>

          {data.pending.length > 0 && (
            <Card title="Waiting for Paystack" subtitle="Top-ups that haven’t been confirmed yet" className="mb-4" bodyClass="">
              <ul className="divide-y divide-slate-100">
                {data.pending.map((p) => (
                  <li key={p.reference} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <Clock className="h-5 w-5 text-amber-500" />
                    <div className="flex-1"><p className="money font-semibold">{naira(p.amountKobo)}</p><p className="text-xs text-slate-500">Started {dateTime(p.createdAt)}</p></div>
                    <Button size="sm" variant="secondary" icon={RefreshCw} loading={checking === p.reference} onClick={() => recheck(p.reference)}>Check</Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="History" bodyClass="">
            {data.entries.length === 0 ? (
              <Empty icon={Wallet} title="No money added yet" action={<Button icon={Plus} onClick={() => setAdding(true)}>Add funds</Button>}>
                Add funds before running payroll. Only money added here can be used to pay salaries.
              </Empty>
            ) : (
              <table className="table">
                <thead><tr><th>What</th><th>When</th><th className="text-right">Amount</th><th className="text-right">Balance after</th></tr></thead>
                <tbody>
                  {data.entries.map((e) => {
                    const k = KIND[e.kind] || KIND.adjustment;
                    return (
                      <tr key={e.id}>
                        <td data-label="">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${e.amountKobo > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}><k.icon className="h-4 w-4" /></span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{e.description}</p>
                              <Badge color={k.color}>{k.label}</Badge>
                              {e.run && <Link to={`/runs/${e.run}`} className="ml-2 text-xs font-semibold text-brand-700 hover:underline">View run</Link>}
                            </div>
                          </div>
                        </td>
                        <td data-label="When" className="whitespace-nowrap text-slate-500">{dateTime(e.createdAt)}</td>
                        <td data-label="Amount" className={`money whitespace-nowrap text-right font-semibold ${e.amountKobo > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {e.amountKobo > 0 ? '+' : '−'}{naira(Math.abs(e.amountKobo))}
                        </td>
                        <td data-label="Balance after" className="money whitespace-nowrap text-right text-slate-500">{naira(e.balanceAfterKobo)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
          <FeesExplained />
        </>
      )}

      <AddFunds open={adding} onClose={() => { setAdding(false); if (params.get('add')) setParams({}, { replace: true }); }} suggestion={suggestion} />
      {reference && <ReturnFromCheckout reference={reference} onDone={() => { setParams({}, { replace: true }); reload(); }} />}
    </>
  );
}
