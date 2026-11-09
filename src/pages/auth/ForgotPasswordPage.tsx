import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, MailCheck } from 'lucide-react';
import { useAuth } from '@/data/session';
import { Button, Field } from '@/components/ui';
import { Logo } from '@/components/Logo';
import './auth.css';

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Informe o e-mail cadastrado na LUNAAR.');
      document.getElementById('forgot-email')?.focus();
      return;
    }
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth auth--single">
      <main className="auth__main">
        {sent ? (
          <div className="auth__form" role="status">
            <div className="auth__brand">
              <Logo variant="full" height={110} />
            </div>
            <MailCheck size={32} aria-hidden />
            <h1 className="auth__title">Confira seu e-mail</h1>
            <p className="auth__lead">
              Se <strong>{email}</strong> estiver cadastrado, você vai receber um link para criar uma nova senha. Confira também a caixa de spam.
            </p>
            <Link to="/login" className="btn btn--dark btn--block">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form className="auth__form" onSubmit={submit} noValidate aria-labelledby="forgot-title">
            <div className="auth__brand">
              <Logo variant="full" height={110} />
            </div>
            <Link to="/login" className="auth__back">
              <ChevronLeft size={16} aria-hidden /> Voltar
            </Link>
            <h1 id="forgot-title" className="auth__title">
              Recuperar senha
            </h1>
            <p className="auth__lead">Enviaremos um link de redefinição para o seu e-mail.</p>
            <div className="auth__fields">
              <Field label="E-mail" error={error} htmlFor="forgot-email">
                {(p) => <input {...p} className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Field>
            </div>
            <Button type="submit" variant="primary" block loading={loading}>
              Enviar link
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
