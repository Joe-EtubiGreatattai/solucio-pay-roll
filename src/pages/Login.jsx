import { useState } from 'react';
import { BadgeCheck, Landmark, Lock, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Button, ErrorNote, Field, PasswordInput } from '../components/ui';
import Logo from '../components/Logo';

const POINTS = [
  { icon: BadgeCheck, text: 'Every account is checked with the bank before anyone is paid.' },
  { icon: Landmark, text: 'One approval sends salaries to every employee at once.' },
  { icon: ShieldCheck, text: 'Each payment is tracked until the bank confirms it.' },
];

export default function Login() {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      signIn(await api('/auth/login', { method: 'POST', body: form }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true"><path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff" /></svg>
          </div>
          <span className="text-xl font-bold">Solucio Hospital</span>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">Pay the whole team<br />with one approval.</h1>
          <ul className="stagger mt-8 max-w-md space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-brand-50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10"><Icon className="h-4 w-4" /></span>
                <span className="pt-1">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-brand-200">© {new Date().getFullYear()} Solucio Hospital · Payroll</p>
      </div>

      <div className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo className="h-11 w-11" />
            <span className="leading-tight"><span className="block text-lg font-bold">Solucio Payroll</span><span className="block text-sm text-slate-500">Solucio Hospital</span></span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Sign in to payroll</h2>
          <p className="mt-1 text-sm text-slate-500">Use your Solucio HR email and password. Payroll access is given in HR.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              <input className="input" type="email" required autoFocus autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Password">
              <PasswordInput required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <ErrorNote>{error}</ErrorNote>
            <Button className="w-full" size="lg" loading={busy}>Sign in</Button>
          </form>
          <p className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Lock className="h-4 w-4" /> Need access? Ask an existing payroll admin.
          </p>
        </div>
      </div>
    </div>
  );
}
