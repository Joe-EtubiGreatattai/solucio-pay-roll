import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, CheckCircle2, CircleDashed, Clock, Eye, EyeOff, FileEdit, Inbox, Loader2, Lock, RotateCcw, Send, X, XCircle,
} from 'lucide-react';
import { useCountUp, useExit } from '../lib/motion';
import { initials, naira } from '../lib/format';

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className = '', children, ...props }) {
  const variants = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
    secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    'danger-soft': 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  const sizes = {
    sm: 'min-h-10 px-3.5 py-1.5 text-sm desk:min-h-0 desk:px-3 desk:text-xs',
    md: 'min-h-11 px-5 py-2.5 text-sm desk:min-h-0',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Card({ title, subtitle, action, className = '', bodyClass = 'p-5', children }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 [&>*]:whitespace-nowrap [&>*]:px-3 sm:[&>*]:flex-none sm:[&>*]:px-5">{actions}</div>}
    </div>
  );
}

const BADGE_COLORS = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  teal: 'bg-brand-50 text-brand-700 ring-brand-600/20',
};

export function Badge({ children, color = 'slate', icon: Icon, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${BADGE_COLORS[color]} ${className}`}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

// One place that decides how every run / payment status looks.
export const STATUS = {
  DRAFT: { label: 'Draft', color: 'slate', icon: FileEdit },
  FUNDED: { label: 'Ready to pay', color: 'blue', icon: Lock },
  PROCESSING: { label: 'Paying', color: 'amber', icon: Send },
  COMPLETED: { label: 'Completed', color: 'green', icon: CheckCircle2 },
  PARTIAL_FAILED: { label: 'Some failed', color: 'red', icon: AlertTriangle },
  QUEUED: { label: 'Queued', color: 'slate', icon: CircleDashed },
  PENDING: { label: 'Sending', color: 'amber', icon: Clock },
  SUCCESS: { label: 'Paid', color: 'green', icon: CheckCircle2 },
  FAILED: { label: 'Failed', color: 'red', icon: XCircle },
  REVERSED: { label: 'Reversed', color: 'red', icon: RotateCcw },
};

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, color: 'slate' };
  const spinning = status === 'PENDING' || status === 'PROCESSING';
  return (
    <Badge color={s.color}>
      {s.icon && <s.icon className={`h-3.5 w-3.5 ${spinning ? 'animate-pulse' : ''}`} />}
      {s.label}
    </Badge>
  );
}

const fieldValue = (f) => (f.type === 'checkbox' || f.type === 'radio' ? f.checked : f.value);
const dialogStack = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessible dialog: bottom sheet on phones, centred on larger screens. Focus trap, Escape to close,
// and it asks before throwing away unsaved changes.
export function Modal({ open, onClose, title, children, footer, size = 'md', guardChanges = true }) {
  const panel = useRef(null);
  const baseline = useRef(new Map());
  const [askDiscard, setAskDiscard] = useState(false);
  const titleId = useId();
  const { mounted, closing } = useExit(open, 160);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const requestClose = () => {
    const changed = [...baseline.current].some(([f, v]) => f.isConnected && fieldValue(f) !== v);
    if (guardChanges && changed) setAskDiscard(true);
    else closeRef.current();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    if (!open) return;
    baseline.current = new Map();
    setAskDiscard(false);
    const id = Symbol('dialog');
    dialogStack.push(id);
    const previouslyFocused = document.activeElement;
    const el = panel.current;
    const first = el.querySelector('input:not([type="hidden"]), select, textarea') || el.querySelector(`.dialog-footer ${FOCUSABLE}`);
    (first || el).focus();
    const onKey = (e) => {
      if (dialogStack[dialogStack.length - 1] !== id) return;
      if (e.key === 'Escape') { e.preventDefault(); requestCloseRef.current(); }
      if (e.key === 'Tab') {
        const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!items.length) return;
        const [a, b] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
      }
    };
    const touch = (e) => {
      const f = e.target.closest?.('input, select, textarea');
      if (f && !baseline.current.has(f)) baseline.current.set(f, fieldValue(f));
    };
    const commit = () => setTimeout(() => { for (const f of baseline.current.keys()) baseline.current.set(f, fieldValue(f)); });
    window.addEventListener('keydown', onKey);
    el.addEventListener('focusin', touch);
    el.addEventListener('submit', commit, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('focusin', touch);
      el.removeEventListener('submit', commit, true);
      dialogStack.splice(dialogStack.indexOf(id), 1);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm sm:items-start sm:p-4 sm:pt-[10vh] ${closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'}`}
      onMouseDown={requestClose}
    >
      <div
        ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`card w-full rounded-b-none pb-[env(safe-area-inset-bottom)] shadow-xl outline-none sm:rounded-b-2xl sm:pb-0 ${widths[size]} ${closing ? 'animate-[sheet-down_0.2s_ease-in_both] sm:animate-scale-out' : 'animate-[sheet-up_0.3s_var(--ease-out-soft)_backwards] sm:animate-scale-in'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true"><span className="h-1.5 w-10 rounded-full bg-slate-300" /></div>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={requestClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 desk:h-8 desk:w-8">
            <X className="h-5 w-5" />
          </button>
        </div>
        {askDiscard && (
          <div role="alert" className="flex animate-slide-down flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
            <span className="flex-1 font-medium">Discard your changes?</span>
            <Button size="sm" variant="secondary" onClick={() => setAskDiscard(false)}>Keep editing</Button>
            <Button size="sm" variant="danger" onClick={() => closeRef.current()}>Discard</Button>
          </div>
        )}
        <div className="dialog-body max-h-[65vh] overflow-y-auto overscroll-contain px-4 py-4 sm:max-h-[70vh] sm:px-5">{children}</div>
        {footer && <div className="dialog-footer flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 py-3 sm:px-5 [&>*]:flex-1 sm:[&>*]:flex-none">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// Yes / no dialog for actions that matter.
// Yes / no dialog for actions that matter. With `askPassword`, the admin re-types their password
// (required for anything that moves money or changes who gets paid); onConfirm receives it.
export function Confirm({ open, title, children, confirmLabel, tone = 'primary', busy, onConfirm, onClose, icon: Icon = AlertTriangle, askPassword, error, disabled }) {
  const tones = { primary: 'bg-brand-50 text-brand-700', danger: 'bg-rose-50 text-rose-600' };
  const [password, setPassword] = useState('');
  useEffect(() => { if (open) setPassword(''); }, [open]);
  const go = () => { if (!busy && !disabled && (!askPassword || password)) onConfirm(password); };
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" guardChanges={false}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} disabled={disabled || (askPassword && !password)} onClick={go}>{confirmLabel}</Button>
      </>}>
      <div className="flex gap-4">
        <span className={`flex h-10 w-10 shrink-0 animate-pop-in items-center justify-center rounded-full ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1 space-y-4 text-sm leading-relaxed text-slate-600">
          <div>{children}</div>
          {askPassword && (
            <form onSubmit={(e) => { e.preventDefault(); go(); }}>
              <Field label="Your password" hint="Needed for anything that moves money or changes who gets paid.">
                <PasswordInput autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </form>
          )}
          <ErrorNote>{error}</ErrorNote>
        </div>
      </div>
    </Modal>
  );
}

export function IconButton({ icon: Icon, label, tone = 'default', className = '', ...props }) {
  const tones = { default: 'text-slate-500 hover:text-slate-800', danger: 'text-rose-600 hover:text-rose-700', brand: 'text-brand-700 hover:text-brand-800' };
  return (
    <button type="button" aria-label={label} title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition duration-150 hover:bg-slate-100 active:scale-90 disabled:opacity-50 desk:h-8 desk:w-8 ${tones[tone]} ${className}`} {...props}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function Field({ label, children, className = '', hint }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`input pr-10 ${className}`} />
      <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700">
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// Naira amount field: shows ₦ inside the box.
export function MoneyInput({ className = '', ...props }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-400">₦</span>
      <input type="number" min="0" step="0.01" inputMode="decimal" {...props} className={`input money pl-8 ${className}`} />
    </div>
  );
}

export function Spinner({ className = '' }) {
  return (
    <div role="status" aria-live="polite" className={`flex justify-center py-12 ${className}`}>
      <Loader2 aria-hidden="true" className="h-6 w-6 text-brand-600 [animation:spin_1s_linear_infinite,fade-in_0.3s_0.2s_backwards]" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function Empty({ title, children, icon: Icon = Inbox, action }) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center px-4 py-12 text-center">
      <span className="mb-3 flex h-14 w-14 animate-pop-in items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Icon className="h-7 w-7" /></span>
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Counts numbers up when they first appear or change.
export function Animated({ value, format = (n) => Math.round(n).toLocaleString() }) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const shown = useCountUp(numeric ? value : 0);
  if (!numeric) return <>{value ?? '—'}</>;
  return <>{format(shown)}</>;
}

export function Money({ kobo, decimals = 2 }) {
  if (kobo == null) return <>—</>;
  return <span className="money"><Animated value={kobo} format={(n) => naira(Math.round(n), { decimals })} /></span>;
}

const TONES = {
  brand: 'bg-brand-50 text-brand-700', amber: 'bg-amber-50 text-amber-600', red: 'bg-rose-50 text-rose-600',
  blue: 'bg-sky-50 text-sky-600', green: 'bg-emerald-50 text-emerald-600', slate: 'bg-slate-100 text-slate-600',
};

export function StatCard({ label, value, icon: Icon, tone = 'brand', hint, warn }) {
  return (
    <div className={`card flex w-full items-start gap-3 p-4 sm:gap-4 sm:p-5 ${warn ? 'border-amber-300 bg-amber-50/40' : ''}`}>
      {Icon && <div className={`hidden rounded-xl p-2.5 min-[420px]:block ${TONES[tone]}`}><Icon className="h-5 w-5" /></div>}
      <div className="min-w-0">
        <p className="text-sm leading-snug text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-bold text-slate-900 sm:text-2xl">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

export function Avatar({ name, size = 'md' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' };
  // Stable soft colour per name so lists are easier to scan
  const palette = ['bg-brand-100 text-brand-800', 'bg-sky-100 text-sky-800', 'bg-amber-100 text-amber-800', 'bg-violet-100 text-violet-800', 'bg-rose-100 text-rose-800', 'bg-emerald-100 text-emerald-800'];
  const idx = [...(name || '')].reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length;
  return (
    <span className={`${sizes[size]} ${palette[idx]} flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white`}>
      {initials(name)}
    </span>
  );
}

// Tabs with an underline that slides to the selected tab.
export function Tabs({ tabs, value, onChange }) {
  const list = useRef(null);
  const [bar, setBar] = useState(null);
  useLayoutEffect(() => {
    const el = list.current?.querySelector('[aria-selected="true"]');
    if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, tabs.length, tabs.map((t) => t.count).join()]);
  return (
    <div ref={list} role="tablist" className="relative flex gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={`min-h-11 whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-colors desk:min-h-0 ${value === t.value ? 'text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}>
          {t.label}
          {t.count != null && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{t.count}</span>}
        </button>
      ))}
      {bar && <span aria-hidden="true" className="absolute bottom-0 h-0.5 rounded-full bg-brand-600 transition-all duration-300 ease-out" style={{ left: bar.left, width: bar.width }} />}
    </div>
  );
}

// Animated success mark: the circle pops in and the tick draws itself.
export function SuccessCheck({ className = 'h-14 w-14' }) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center ${className}`} aria-hidden="true">
      <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-400 [animation-iteration-count:2]" />
      <svg viewBox="0 0 52 52" className="relative h-full w-full animate-pop-in">
        <circle cx="26" cy="26" r="25" className="fill-emerald-500" />
        <path d="M15 27l7 7 15-16" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" className="animate-draw" />
      </svg>
    </span>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p key={String(children)} role="alert" className="flex animate-shake items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{children}</span>
    </p>
  );
}
