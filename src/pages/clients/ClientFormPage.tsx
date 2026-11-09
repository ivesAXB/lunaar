import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '@/data/store';
import type { Client } from '@/data/types';
import { useToast } from '@/components/toast';
import { Button, Field, PageHeader } from '@/components/ui';
import { ErrorSummary, useForm } from '@/lib/useForm';
import { isValidCpf, maskCep, maskCpf, maskPhone } from '@/lib/format';
import { NotFoundPage } from '../NotFoundPage';

type V = {
  name: string;
  cpf: string;
  phone: string;
  whatsapp: string;
  sameWhatsapp: boolean;
  email: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  notes: string;
};

const LABELS: Partial<Record<keyof V, string>> = {
  name: 'Nome completo',
  cpf: 'CPF',
  phone: 'Telefone',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  zip: 'CEP',
  street: 'Rua',
  number: 'Número',
  district: 'Bairro',
  city: 'Cidade',
  state: 'UF',
};

const digits = (s: string) => s.replace(/\D/g, '');

function toForm(c?: Client): V {
  return {
    name: c?.name ?? '',
    cpf: c?.cpf ?? '',
    phone: c?.phone ?? '',
    whatsapp: c?.whatsapp ?? '',
    sameWhatsapp: c ? c.whatsapp === c.phone : true,
    email: c?.email ?? '',
    zip: c?.address.zip ?? '',
    street: c?.address.street ?? '',
    number: c?.address.number ?? '',
    complement: c?.address.complement ?? '',
    district: c?.address.district ?? '',
    city: c?.address.city ?? 'Cuiabá',
    state: c?.address.state ?? 'MT',
    notes: c?.notes ?? '',
  };
}

export function ClientFormPage() {
  const { id } = useParams();
  const { db, actions, ready } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = id ? db.clients.find((c) => c.id === id) : undefined;
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const validate = useCallback(
    (v: V) => {
      const e: Partial<Record<keyof V, string>> = {};
      if (v.name.trim().split(/\s+/).length < 2) e.name = 'Informe nome e sobrenome.';
      if (!v.cpf) e.cpf = 'Informe o CPF.';
      else if (!isValidCpf(v.cpf)) e.cpf = 'CPF inválido. Confira os 11 dígitos.';
      else if (db.clients.some((c) => c.cpf === v.cpf && c.id !== existing?.id)) e.cpf = 'Já existe um cliente com este CPF.';
      if (digits(v.phone).length < 10) e.phone = 'Telefone incompleto. Use DDD + número.';
      if (!v.sameWhatsapp && v.whatsapp && digits(v.whatsapp).length < 11) e.whatsapp = 'WhatsApp incompleto. Use DDD + 9 dígitos.';
      if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'E-mail inválido.';
      if (v.zip && digits(v.zip).length !== 8) e.zip = 'CEP deve ter 8 dígitos.';
      if (!v.street.trim()) e.street = 'Informe a rua.';
      if (!v.number.trim()) e.number = 'Informe o número (ou “s/n”).';
      if (!v.district.trim()) e.district = 'Informe o bairro.';
      if (!v.city.trim()) e.city = 'Informe a cidade.';
      if (!/^[A-Za-z]{2}$/.test(v.state.trim())) e.state = 'Use a sigla (ex.: MT).';
      return e;
    },
    [db.clients, existing?.id],
  );

  const form = useForm<V>(toForm(existing), validate);
  const v = form.values;

  if (id && !existing) return ready ? <NotFoundPage what="Cliente" back="/clientes" /> : null;

  // Preenche o endereço pelo CEP (ViaCEP). Falha silenciosa: o usuário digita manualmente.
  const lookupCep = async () => {
    const cep = digits(v.zip);
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        form.setValues((cur) => ({
          ...cur,
          street: data.logradouro || cur.street,
          district: data.bairro || cur.district,
          city: data.localidade || cur.city,
          state: data.uf || cur.state,
        }));
        document.getElementById('f-number')?.focus();
      }
    } catch {
      /* sem internet: segue manual */
    } finally {
      setCepLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.check()) return;
    setSaving(true);
    try {
      const saved = await actions.saveClient({
        id: existing?.id,
        createdAt: existing?.createdAt,
        name: v.name.trim(),
        cpf: v.cpf,
        phone: v.phone,
        whatsapp: v.sameWhatsapp ? v.phone : v.whatsapp || undefined,
        email: v.email.trim() || undefined,
        address: {
          street: v.street.trim(),
          number: v.number.trim(),
          complement: v.complement.trim() || undefined,
          district: v.district.trim(),
          city: v.city.trim(),
          state: v.state.trim().toUpperCase(),
          zip: v.zip,
        },
        notes: v.notes.trim() || undefined,
      });
      toast(existing ? 'Cliente atualizado.' : 'Cliente cadastrado. Agora cadastre o pet.');
      navigate(existing ? `/clientes/${saved.id}` : `/clientes/${saved.id}/pets/novo`, { replace: true });
    } catch (err) {
      toast((err as Error).message, 'error');
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader back={existing ? { to: `/clientes/${existing.id}`, label: existing.name } : { to: '/clientes', label: 'Clientes' }} title={existing ? 'Editar cliente' : 'Cadastrar cliente'} />

      <form onSubmit={submit} noValidate>
        {form.showSummary && <ErrorSummary errors={form.errors} labels={LABELS} />}

        <section className="form-section">
          <div className="form-section__intro">
            <h2>Dados pessoais</h2>
            <p>Quem é responsável pelo pet durante a hospedagem.</p>
          </div>
          <div className="form-grid">
            <Field label="Nome completo" required error={form.errors.name} className="col-4" htmlFor="f-name">
              {(p) => <input {...p} {...form.bind('name')} className="input" autoComplete="name" />}
            </Field>
            <Field label="CPF" required error={form.errors.cpf} className="col-2" htmlFor="f-cpf">
              {(p) => <input {...p} {...form.bind('cpf', maskCpf)} className="input" inputMode="numeric" placeholder="000.000.000-00" />}
            </Field>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__intro">
            <h2>Contato</h2>
            <p>O WhatsApp é usado para avisos de check-in e check-out.</p>
          </div>
          <div className="form-grid">
            <Field label="Telefone" required error={form.errors.phone} className="col-3" htmlFor="f-phone">
              {(p) => <input {...p} {...form.bind('phone', maskPhone)} className="input" inputMode="tel" autoComplete="tel" placeholder="(65) 99999-9999" />}
            </Field>
            {!v.sameWhatsapp && (
              <Field label="WhatsApp" optional error={form.errors.whatsapp} className="col-3" htmlFor="f-whatsapp">
                {(p) => <input {...p} {...form.bind('whatsapp', maskPhone)} className="input" inputMode="tel" />}
              </Field>
            )}
            <label className="checkbox">
              <input type="checkbox" checked={v.sameWhatsapp} onChange={(e) => form.set('sameWhatsapp', e.target.checked)} />
              O telefone também é WhatsApp
            </label>
            <Field label="E-mail" optional error={form.errors.email} className="col-4" htmlFor="f-email">
              {(p) => <input {...p} {...form.bind('email')} type="email" className="input" autoComplete="email" />}
            </Field>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__intro">
            <h2>Endereço</h2>
            <p>Digite o CEP para preencher automaticamente.</p>
          </div>
          <div className="form-grid">
            <Field label="CEP" optional error={form.errors.zip} className="col-2" htmlFor="f-zip" hint={cepLoading ? 'Buscando endereço…' : undefined}>
              {(p) => {
                const b = form.bind('zip', maskCep);
                return <input {...p} {...b} onBlur={() => (b.onBlur(), lookupCep())} className="input" inputMode="numeric" placeholder="78000-000" />;
              }}
            </Field>
            <div className="col-4" />
            <Field label="Rua" required error={form.errors.street} className="col-4" htmlFor="f-street">
              {(p) => <input {...p} {...form.bind('street')} className="input" autoComplete="address-line1" />}
            </Field>
            <Field label="Número" required error={form.errors.number} className="col-2 keep" htmlFor="f-number">
              {(p) => <input {...p} {...form.bind('number')} className="input" />}
            </Field>
            <Field label="Complemento" optional className="col-2 keep" htmlFor="f-complement">
              {(p) => <input {...p} {...form.bind('complement')} className="input" />}
            </Field>
            <Field label="Bairro" required error={form.errors.district} className="col-4" htmlFor="f-district">
              {(p) => <input {...p} {...form.bind('district')} className="input" />}
            </Field>
            <Field label="Cidade" required error={form.errors.city} className="col-4" htmlFor="f-city">
              {(p) => <input {...p} {...form.bind('city')} className="input" autoComplete="address-level2" />}
            </Field>
            <Field label="UF" required error={form.errors.state} className="col-2 keep" htmlFor="f-state">
              {(p) => <input {...p} {...form.bind('state', (s) => s.toUpperCase().slice(0, 2))} className="input" autoComplete="address-level1" />}
            </Field>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section__intro">
            <h2>Observações</h2>
          </div>
          <div className="form-grid">
            <Field label="Observações" optional htmlFor="f-notes" hint="Preferências de contato, autorizações (banho, tosa), pessoas autorizadas a buscar.">
              {(p) => <textarea {...p} {...form.bind('notes')} className="textarea" rows={3} />}
            </Field>
          </div>
        </section>

        <div className="form-actions">
          <span className="form-actions__note">
            Campos com <span style={{ color: 'var(--danger)' }}>*</span> são obrigatórios.
          </span>
          <Button onClick={() => navigate(-1)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {existing ? 'Salvar alterações' : 'Cadastrar e adicionar pet'}
          </Button>
        </div>
      </form>
    </div>
  );
}
