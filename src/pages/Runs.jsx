import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, ChevronRight, Plus } from 'lucide-react';
import useFetch from '../lib/useFetch';
import { date, monthLabel, naira } from '../lib/format';
import { Button, Card, Empty, ErrorNote, PageHeader, Skeleton, StatusBadge, Tabs } from '../components/ui';

const GROUPS = {
  open: ['DRAFT', 'FUNDED', 'PROCESSING'],
  attention: ['PARTIAL_FAILED'],
  done: ['COMPLETED'],
};

export default function Runs() {
  const { data: runs, loading, error } = useFetch('/payroll-runs', { initial: [] });
  const [tab, setTab] = useState('all');
  const shown = useMemo(() => (tab === 'all' ? runs : runs.filter((r) => GROUPS[tab].includes(r.status))), [runs, tab]);
  const count = (k) => runs.filter((r) => GROUPS[k].includes(r.status)).length;

  return (
    <>
      <PageHeader
        title="Payroll runs"
        subtitle="Each run pays a group of employees in one go."
        actions={<Link to="/runs/new"><Button icon={Plus} className="w-full">New payroll run</Button></Link>}
      />
      <ErrorNote>{error}</ErrorNote>
      <Card bodyClass="">
        <div className="px-4 pt-3 sm:px-5">
          <Tabs value={tab} onChange={setTab} tabs={[
            { value: 'all', label: 'All', count: runs.length },
            { value: 'open', label: 'In progress', count: count('open') },
            { value: 'attention', label: 'Needs attention', count: count('attention') },
            { value: 'done', label: 'Completed', count: count('done') },
          ]} />
        </div>
        {loading ? (
          <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : shown.length === 0 ? (
          <Empty icon={Banknote} title={runs.length ? 'Nothing in this list' : 'No payroll runs yet'}
            action={!runs.length && <Link to="/runs/new"><Button icon={Plus}>Start your first run</Button></Link>}>
            {runs.length ? 'Runs move here as their status changes.' : 'A run picks who gets paid, checks your balance, and sends every salary at once.'}
          </Empty>
        ) : (
          <table className="table">
            <thead><tr><th>Run</th><th>People</th><th className="text-right">Total</th><th>Status</th><th className="w-10"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="group">
                  <td data-label="">
                    <Link to={`/runs/${r.id}`} className="block">
                      <span className="block font-semibold text-slate-800 group-hover:text-brand-700">{r.title}</span>
                      <span className="block text-xs text-slate-500">{r.period ? monthLabel(r.period) : 'No period'} · created {date(r.createdAt)}</span>
                    </Link>
                  </td>
                  <td data-label="People" className="text-slate-600">
                    {['COMPLETED', 'PARTIAL_FAILED', 'PROCESSING'].includes(r.status) ? `${r.paidCount} of ${r.itemCount} paid` : `${r.itemCount}`}
                  </td>
                  <td data-label="Total" className="money text-right font-semibold">{naira(r.totalKobo)}</td>
                  <td data-label="Status"><StatusBadge status={r.status} /></td>
                  <td data-label="" className="text-right">
                    <Link to={`/runs/${r.id}`} aria-label={`Open ${r.title}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-700">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
