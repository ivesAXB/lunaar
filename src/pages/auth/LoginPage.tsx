import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/data/session';
import { Button, Field } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { isRemote } from '@/lib/supabase';
import './auth.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { userId, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  if (userId) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Informe seu e-mail.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Confira o e-mail: falta o “@” ou o domínio.';
    if (!password) next.password = 'Informe sua senha.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) {
      document.getElementById(next.email ? 'login-email' : 'login-password')?.focus();
      return;
    }
    setLoading(true);
    try {
      await login(email, password, remember);
      navigate(from, { replace: true });
    } catch (err) {
      setFormError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="auth">
      <aside className="auth__art" aria-hidden>
        <figure className="auth__photo">
          <img src="/photos/dog-01-groenendael.jpg" alt="" />
        </figure>
        <p className="auth__quote">
          Adote, apadrinhe,
          <br />
          doe e <span className="marker">ajude</span>.
        </p>
        <p className="auth__place">Associação LUNAAR · Cuiabá – MT</p>
      </aside>

      <main className="auth__main">
        <form className="auth__form" onSubmit={submit} noValidate aria-labelledby="login-title">
          <div className="auth__brand">
            <Logo variant="full" height={132} />
          </div>
          <h1 id="login-title" className="auth__title">
            Entrar
          </h1>
          <p className="auth__lead">Acesso da equipe da LUNAAR.</p>

          {formError && (
            <div className="error-summary" role="alert">
              <AlertCircle size={18} aria-hidden />
              <span>{formError}</span>
            </div>
          )}

          <div className="auth__fields">
            <Field label="E-mail" error={errors.email} htmlFor="login-email">
              {(p) => (
                <input
                  {...p}
                  className="input"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => email && !EMAIL_RE.test(email.trim()) && setErrors((s) => ({ ...s, email: 'Confira o e-mail: falta o “@” ou o domínio.' }))}
                />
              )}
            </Field>

            <Field label="Senha" error={errors.password} htmlFor="login-password">
              {(p) => (
                <div className="input-group">
                  <input
                    {...p}
                    className="input"
                    style={{ paddingLeft: 12, paddingRight: 48 }}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <span className="input-group__suffix">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-pressed={showPassword}
                      icon={showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    />
                  </span>
                </div>
              )}
            </Field>

            <div className="auth__row">
              <label className="checkbox">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Manter conectado
              </label>
              <Link to="/recuperar-senha" className="link" style={{ fontSize: 'var(--fs-sm)' }}>
                Esqueci minha senha
              </Link>
            </div>
          </div>

          <Button type="submit" variant="primary" block loading={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>

          {!isRemote && (
          <p className="auth__demo">
            Acesso de demonstração: <strong>mariana@lunaar.org</strong> · senha <strong>lunaar2026</strong>
          </p>
          )}
        </form>
      </main>
    </div>
  );
}
