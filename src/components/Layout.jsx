import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Banknote, FlaskConical, LayoutDashboard, LogOut, Menu, Plus, Search, Settings, ShieldCheck, Users, Wallet, X } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import useFetch from '../lib/useFetch';
import { useExit } from '../lib/motion';
import { naira } from '../lib/format';
import { Avatar } from './ui';
import Logo from './Logo';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/runs', label: 'Payroll runs', icon: Banknote },
  { to: '/funds', label: 'Funds', icon: Wallet },
];

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] transition ${isActive ? 'bg-white font-semibold text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'}`}>
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-3 top-1/2 h-8 w-1.5 -translate-y-1/2 animate-[grow-y_0.3s_ease-out_both] rounded-r-full bg-brand-700" />}
          <Icon className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-brand-700' : ''}`} />
          <span className="flex-1">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ onLogout }) {
  return (
    <div className="flex h-full flex-col rounded-3xl bg-slate-100/80 px-3 py-6">
      <Link to="/" className="mb-8 flex items-center gap-2.5 px-4">
        <Logo className="h-10 w-10" />
        <span className="leading-tight">
          <span className="block text-lg font-semibold tracking-tight">Solucio Payroll</span>
          <span className="block text-xs text-slate-500">Solucio Hospital</span>
        </span>
      </Link>
      <nav aria-label="Main" className="flex-1 space-y-0.5">
        {NAV.map((n) => <NavItem key={n.to} {...n} />)}
        <Link to="/runs/new" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 active:scale-[0.98]">
          <Plus className="h-4 w-4" /> New payroll run
        </Link>
      </nav>
      <div className="space-y-0.5 border-t border-slate-200 pt-4">
        <NavItem to="/settings" label="Settings" icon={Settings} />
        <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] text-slate-500 transition hover:bg-white/70 hover:text-slate-800">
          <LogOut className="h-5 w-5" /> Sign out
        </button>
      </div>
    </div>
  );
}

// Search employees and payroll runs. ⌘K / Ctrl+K focuses it.
function QuickSearch() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef();
  const navigate = useNavigate();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  const load = () => {
    if (items) return;
    Promise.all([api('/employees'), api('/payroll-runs')])
      .then(([emps, runs]) => setItems([
        ...emps.map((e) => ({ id: e.id, kind: 'employee', title: e.fullName, sub: `${e.bankName || 'Bank'} ••••${e.accountLast4} · ${naira(e.salaryKobo, { decimals: 0 })}`, to: `/employees?edit=${e.id}`, search: `${e.fullName} ${e.email || ''} ${e.bankName || ''}` })),
        ...runs.map((r) => ({ id: r.id, kind: 'run', title: r.title, sub: `Payroll run · ${naira(r.totalKobo, { decimals: 0 })}`, to: `/runs/${r.id}`, search: `${r.title} ${r.period || ''}` })),
      ]))
      .catch(() => setItems([]));
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term || !items) return [];
    return items.filter((i) => i.search.toLowerCase().includes(term)).slice(0, 7);
  }, [q, items]);

  const go = (i) => { setQ(''); setOpen(false); input.current?.blur(); setItems(null); navigate(i.to); };

  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input ref={input} value={q} placeholder="Search employees and runs" aria-label="Search employees and payroll runs" role="combobox"
        aria-expanded={open && Boolean(q.trim())} aria-controls="quick-search-results" aria-autocomplete="list"
        className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-11 pr-16 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 desk:text-sm"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => { setOpen(true); load(); }} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && results[active]) go(results[active]);
          if (e.key === 'Escape') { setQ(''); input.current.blur(); }
        }} />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md bg-slate-100 px-1.5 py-0.5 font-sans text-xs text-slate-600 sm:block">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      {open && q.trim() && (
        <ul id="quick-search-results" role="listbox" className="card absolute left-0 right-0 z-40 mt-2 origin-top animate-scale-in overflow-hidden py-1 shadow-xl">
          {results.map((r, i) => (
            <li key={r.kind + r.id} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={() => go(r)} onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${i === active ? 'bg-brand-50' : ''}`}>
                {r.kind === 'employee' ? <Avatar name={r.title} size="sm" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Banknote className="h-4 w-4" /></span>}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-slate-500">{r.sub}</span>
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-4 py-3 text-sm text-slate-600">{items ? `Nothing matches “${q.trim()}”.` : 'Loading…'}</li>}
        </ul>
      )}
    </div>
  );
}

const MODES = {
  mock: { label: 'Practice mode', icon: FlaskConical, cls: 'bg-violet-50 text-violet-700 ring-violet-600/20', tip: 'Paystack is simulated. No money moves.' },
  test: { label: 'Paystack test', icon: ShieldCheck, cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', tip: 'Using Paystack test keys. No real money moves.' },
};
// Live mode is the normal state, so the header shows a chip only when no real money moves

export default function Layout({ children }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { data: health } = useFetch('/health');
  const { data: funds, reload: reloadFunds } = useFetch('/funds/balance');
  useEffect(() => { reloadFunds(); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  const [drawer, setDrawer] = useState(false);
  const navigate = useNavigate();
  useEffect(() => setDrawer(false), [location.pathname]);
  const drawerAnim = useExit(drawer, 200);
  const logout = () => { signOut(); navigate('/'); };
  const mode = MODES[health?.paystack];

  return (
    <div className="min-h-screen bg-slate-200/60 p-2 sm:p-4">
      <div className="flex min-h-[calc(100vh-1rem)] gap-4 rounded-[2rem] bg-white p-3 sm:min-h-[calc(100vh-2rem)] sm:p-4">
        <aside className="sticky top-4 hidden h-[calc(100vh-4rem)] w-64 shrink-0 lg:block"><Sidebar onLogout={logout} /></aside>
        {drawerAnim.mounted && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className={`absolute inset-0 bg-slate-900/50 ${drawerAnim.closing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={() => setDrawer(false)} />
            <aside className={`relative h-full w-72 bg-white p-3 ${drawerAnim.closing ? 'animate-slide-out-left' : 'animate-slide-in-left'}`}><Sidebar onLogout={logout} /></aside>
            <button type="button" aria-label="Close menu" className="absolute left-[18.5rem] top-4 text-white" onClick={() => setDrawer(false)}><X /></button>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex items-center gap-3 rounded-3xl bg-slate-100/80 px-3 py-3 sm:px-5">
            <button type="button" aria-label="Open menu" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white lg:hidden" onClick={() => setDrawer(true)}><Menu className="h-5 w-5" /></button>
            <QuickSearch />
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              {funds && (
                <Link to="/funds" title="Payroll balance" className="hidden animate-fade-in items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-300 sm:inline-flex">
                  <Wallet className="h-4 w-4 text-brand-700" /><span className="money">{naira(funds.balanceKobo, { decimals: 0 })}</span>
                </Link>
              )}
              {mode && (
                <span title={mode.tip} className={`hidden animate-fade-in items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset md:inline-flex ${mode.cls}`}>
                  <mode.icon className="h-3.5 w-3.5" /> {mode.label}
                </span>
              )}
              <Link to="/settings" className="flex items-center gap-3 rounded-full pr-2 transition hover:bg-white/60" title="Settings">
                <Avatar name={user?.name} />
                <span className="hidden text-left leading-tight md:block">
                  <span className="block text-sm font-semibold">{user?.name}</span>
                  <span className="block text-xs text-slate-500">Admin</span>
                </span>
              </Link>
            </div>
          </header>
          <main className="flex-1 rounded-3xl bg-slate-100/80 p-4 sm:p-6 lg:p-8">
            <div key={location.pathname} className="animate-fade-up">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
