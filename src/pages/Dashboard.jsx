import { Link } from 'react-router-dom';
import { ArrowUpRight, Banknote, CalendarClock, ChevronRight, Plus, UserPlus, Users, Wallet } from 'lucide-react';
import useFetch from '../lib/useFetch';
import { useAuth } from '../auth.jsx';
import { date, naira, nairaShort, plural } from '../lib/format';
import { Animated, Button, Card, Empty, ErrorNote, Money, PageHeader, Skeleton, StatCard, STATUS, StatusBadge } from '../components/ui';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const BAR = { COMPLETED: 'bg-brand-600', PARTIAL_FAILED: 'bg-rose-400', PROCESSING: 'in-flight', FUNDED: 'bg-sky-400', DRAFT: 'hatched' };

function History({ runs }) {
  const list = [...runs].reverse();
  const max = Math.max(...list.map((r) => r.totalKobo), 1);
  return (
    <div className="flex h-56 items-end gap-3 sm:gap-5">
      {list.map((r, i) => (
        <Link key={r.id} to={`/runs/${r.id}`} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${r.title}: ${naira(r.totalKobo)} (${STATUS[r.status].label})`}>
          <span className="money text-xs font-semibold text-slate-600 opacity-80 transition group-hover:opacity-100">{nairaShort(r.totalKobo)}</span>
          <span
            className={`w-full max-w-14 origin-bottom animate-grow-y rounded-t-xl ring-1 ring-inset ring-black/5 transition group-hover:brightness-95 ${BAR[r.status]}`}
            style={{ height: `${Math.max(6, (r.totalKobo / max) * 78)}%`, animationDelay: `${i * 70}ms` }}
          />
          <span className="w-full truncate text-center text-xs text-slate-500">{r.period ? new Date(`${r.period}-01`).toLocaleDateString('en-NG', { month: 'short' }) : date(r.createdAt)}</span>
        </Link>
      ))}
    </div>
  );
}

function NextStep({ data }) {
  const open = data.recentRuns.find((r) => ['DRAFT', 'FUNDED', 'PROCESSING', 'PARTIAL_FAILED'].includes(r.status));
  const month = new Date().toLocaleDateString('en-NG', { month: 'long' });
  let content;
  const shortBy = data.monthlyKobo - (data.balanceKobo || 0);
  if (!data.employees) {
    content = { icon: UserPlus, title: 'Add your first employees', body: 'Add each person with their salary and bank account. We check every account with the bank.', to: '/employees?add=1', cta: 'Add employees' };
  } else if (open) {
    const copy = {
      DRAFT: ['Finish reviewing the draft', 'Check the amounts, then lock them in.'],
      FUNDED: ['Ready for approval', 'Amounts are locked and your balance covers them. Approve to pay everyone.'],
      PROCESSING: ['Salaries are on their way', 'We’ll mark each person as paid when the bank confirms.'],
      PARTIAL_FAILED: ['Some payments failed', 'See why and retry them.'],
    }[open.status];
    content = { icon: STATUS[open.status].icon, title: copy[0], body: <><b className="text-slate-700">{open.title}</b> · {copy[1]}</>, to: `/runs/${open.id}`, cta: 'Open run' };
  } else if (shortBy > 0) {
    content = { icon: Wallet, title: 'Add funds for payroll', body: `Salaries come to ${naira(data.monthlyKobo, { decimals: 0 })} a month. The payroll balance is ${naira(shortBy, { decimals: 0 })} short.`, to: `/funds?add=1&amount=${shortBy}`, cta: 'Add funds' };
  } else {
    content = { icon: CalendarClock, title: `Run ${month} payroll`, body: `${plural(data.employees, 'employee')} will be included, ${naira(data.monthlyKobo, { decimals: 0 })} in total.`, to: '/runs/new', cta: 'Start run' };
  }
  const Icon = content.icon;
  return (
    <div className="flex h-full flex-col">
      <span className="mb-4 flex h-11 w-11 animate-pop-in items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span>
      <h3 className="text-lg font-semibold text-slate-900">{content.title}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-500">{content.body}</p>
      <Link to={content.to} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.97] desk:min-h-10">
        {content.cta} <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading } = useFetch('/dashboard');
  const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' });

  const header = (
    <PageHeader
      title={`${greeting()}, ${user?.name?.split(' ')[0] || 'there'}`}
      subtitle={today}
      actions={<Link to="/runs/new"><Button icon={Plus} className="w-full">New payroll run</Button></Link>}
    />
  );

  if (error) return <>{header}<ErrorNote>{error}</ErrorNote></>;
  if (loading || !data) {
    return (
      <>
        {header}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3"><Skeleton className="h-72 rounded-2xl lg:col-span-2" /><Skeleton className="h-72 rounded-2xl" /></div>
      </>
    );
  }

  const short = data.balanceKobo != null && data.monthlyKobo > 0 && data.balanceKobo < data.monthlyKobo;
  const last = data.recentRuns.find((r) => ['COMPLETED', 'PARTIAL_FAILED'].includes(r.status));

  return (
    <>
      {header}
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Link to="/funds" className="lift rounded-2xl">
          <StatCard label="Payroll balance" icon={Wallet} tone={short ? 'amber' : 'brand'} warn={short}
            value={<Money kobo={data.balanceKobo} decimals={0} />}
            hint={short ? 'Less than one month of salaries' : 'Money Solucio has added'} />
        </Link>
        <StatCard label="Active employees" icon={Users} tone="blue" value={<Animated value={data.employees} />} hint="On payroll" />
        <StatCard label="Monthly payroll" icon={Banknote} tone="green" value={<Money kobo={data.monthlyKobo} decimals={0} />} hint="Sum of active salaries" />
        <StatCard label="Last paid" icon={CalendarClock} tone="slate" value={last ? date(last.approvedAt || last.createdAt) : 'Not yet'} hint={last ? last.title : 'No completed runs'} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Payroll history" subtitle="Total of each recent run" className="lg:col-span-2 animate-fade-up [animation-delay:150ms]">
          {data.recentRuns.length ? <History runs={data.recentRuns} /> : (
            <Empty icon={Banknote} title="No payroll runs yet">Your runs will show here once you start paying salaries.</Empty>
          )}
        </Card>
        <Card className="animate-fade-up [animation-delay:200ms]" bodyClass="p-5 h-full"><NextStep data={data} /></Card>
      </div>

      {data.recentRuns.length > 0 && (
        <Card title="Recent runs" className="mt-4 animate-fade-up [animation-delay:250ms]" bodyClass=""
          action={<Link to="/runs" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">All runs <ChevronRight className="h-4 w-4" /></Link>}>
          <table className="table">
            <thead><tr><th>Run</th><th>Created</th><th className="text-right">Total</th><th>Status</th></tr></thead>
            <tbody>
              {data.recentRuns.map((r) => (
                <tr key={r.id}>
                  <td data-label=""><Link to={`/runs/${r.id}`} className="font-semibold text-slate-800 hover:text-brand-700">{r.title}</Link></td>
                  <td data-label="Created" className="text-slate-500">{date(r.createdAt)}</td>
                  <td data-label="Total" className="money text-right font-semibold">{naira(r.totalKobo)}</td>
                  <td data-label="Status"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
