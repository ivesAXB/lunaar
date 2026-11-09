import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/data/session';
import { Button, Field, Notice } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { useToast } from '@/components/toast';
import './auth.css';

/**
 * Destino do link de recuperação enviado por e-mail.
 * O Supabase abre uma sessão temporária a partir do link; aqui a pessoa define a nova senha.
 */
export function ResetPasswordPage() {
  const { userId, ready, updatePassword } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (password.length < 8) next.password = 'Use pelo menos 8 caracteres.';
    if (confirm !== password) next.confirm = 'As senhas não conferem.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      await updatePassword(password);
      toast('Senha alterada. Bem-vindo(a) de volta!');
      navigate('/', { replace: true });
    } catch (err) {
      setErrors({ form: (err as Error).message });
      setLoading(false);
    }
  };

  return (
    <div className="auth auth--single">
      <main className="auth__main">
        <form className="auth__form" onSubmit={submit} noValidate aria-labelledby="reset-title">
          <div className="auth__brand">
            <Logo variant="full" height={110} />
          </div>
          <h1 id="reset-title" className="auth__title">
            Nova senha
          </h1>
          {ready && !userId ? (
            <>
              <Notice tone="amber">O link expirou ou já foi usado. Peça um novo link de recuperação.</Notice>
              <Link to="/recuperar-senha" className="btn btn--dark btn--block" style={{ marginTop: 16 }}>
                Pedir novo link
              </Link>
            </>
          ) : (
            <>
              <p className="auth__lead">Escolha uma senha com pelo menos 8 caracteres.</p>
              {errors.form && (
                <div className="error-summary" role="alert">
                  {errors.form}
                </div>
              )}
              <div className="auth__fields">
                <Field label="Nova senha" error={errors.password} htmlFor="new-password">
                  {(p) => (
                    <div className="input-group">
                      <input {...p} className="input" style={{ paddingLeft: 12, paddingRight: 48 }} type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                      <span className="input-group__suffix">
                        <Button variant="ghost" size="sm" iconOnly onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show} icon={show ? <EyeOff aria-hidden /> : <Eye aria-hidden />} />
                      </span>
                    </div>
                  )}
                </Field>
                <Field label="Confirmar nova senha" error={errors.confirm} htmlFor="confirm-password">
                  {(p) => <input {...p} className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
                </Field>
              </div>
              <Button type="submit" variant="primary" block loading={loading} disabled={!ready}>
                Salvar nova senha
              </Button>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
