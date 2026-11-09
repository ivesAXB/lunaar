import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, RotateCcw } from 'lucide-react';
import { useData, useMe } from '@/data/store';
import { inCare } from '@/data/selectors';
import type { Accommodation, Base, Kennel, KennelKind, User, UserRole } from '@/data/types';
import { useToast } from '@/components/toast';
import { Avatar, Button, ConfirmDialog, Dialog, Field, Notice, PageHeader, Tag } from '@/components/ui';
import { fmtMoney, maskPhone } from '@/lib/format';
import { BASE, KENNEL_KIND, ROLE } from '@/lib/labels';
import { isRemote } from '@/lib/supabase';
import { compareKennels, kennelName, kennelPath, kennelShort, kennelTag, uniqueSorted } from '@/lib/kennel';

const TABS = [
  { key: 'equipe', label: 'Equipe' },
  { key: 'canis', label: 'Canis' },
  { key: 'hotel', label: 'Hotelzinho' },
  { key: 'ong', label: 'Organização' },
];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get('aba'))?.key ?? 'equipe';
  return (
    <div className="page">
      <PageHeader title="Configurações" />
      <nav className="tabs" role="tablist" aria-label="Seções">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setParams(t.key === 'equipe' ? {} : { aba: t.key }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </nav>
      <div role="tabpanel" style={{ paddingTop: 'var(--sp-6)' }}>
        {tab === 'equipe' && <TeamTab />}
        {tab === 'canis' && <KennelsTab />}
        {tab === 'hotel' && <HotelTab />}
        {tab === 'ong' && <OrgTab />}
      </div>
    </div>
  );
}

function TeamTab() {
  const { db, actions } = useData();
  const me = useMe();
  const toast = useToast();
  const [editing, setEditing] = useState<Partial<User> | null>(null);
  const [toggle, setToggle] = useState<User | null>(null);
  const canManage = me?.role === 'coordenacao';
  return (
    <>
      <div className="settings-head">
        <p className="muted">{canManage ? 'Quem acessa o sistema e o que faz na LUNAAR.' : 'Quem acessa o sistema. Só a coordenação altera a equipe.'}</p>
        {canManage && (
          <Button variant="dark" icon={<Plus aria-hidden />} onClick={() => setEditing({ role: 'equipe', active: true })}>
            Adicionar pessoa
          </Button>
        )}
      </div>
      <div className="table-wrap">
        <table className="table table--stack">
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Função</th>
              <th scope="col">Acesso</th>
              <th scope="col">
                <span className="visually-hidden">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {db.users.map((u) => (
              <tr key={u.id}>
                <td data-primary>
                  <div className="cell-primary">
                    <Avatar name={u.name} muted={!u.active} />
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {u.name} {u.id === me?.id && <span className="muted">(você)</span>}
                      </div>
                      <div className="cell-primary__sub">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td data-label="Função">{ROLE[u.role]}</td>
                <td data-end>{u.active ? <Tag tone="green" dot>Ativo</Tag> : <Tag tone="neutral" dot>Desativado</Tag>}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {canManage && (
                    <>
                      <Button size="sm" variant="ghost" iconOnly icon={<Pencil aria-hidden />} onClick={() => setEditing(u)} aria-label={`Editar ${u.name}`} />
                      {u.id !== me?.id && (
                        <Button size="sm" variant="ghost" onClick={() => setToggle(u)}>
                          {u.active ? 'Desativar' : 'Reativar'}
                        </Button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <UserDialog initial={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!toggle}
        onClose={() => setToggle(null)}
        danger={!!toggle?.active}
        title={toggle?.active ? `Desativar ${toggle?.name}?` : `Reativar ${toggle?.name}?`}
        description={toggle?.active ? 'A pessoa não conseguirá mais entrar. O histórico de registros dela é mantido.' : 'A pessoa volta a acessar o sistema com a senha atual.'}
        confirmLabel={toggle?.active ? 'Desativar acesso' : 'Reativar acesso'}
        onConfirm={async () => {
          if (!toggle) return;
          await actions.saveUser({ ...toggle, active: !toggle.active });
          toast(toggle.active ? 'Acesso desativado.' : 'Acesso reativado.');
        }}
      />
    </>
  );
}

function UserDialog({ initial, onClose }: { initial: Partial<User>; onClose: () => void }) {
  const { actions } = useData();
  const toast = useToast();
  const [name, setName] = useState(initial.name ?? '');
  const [email, setEmail] = useState(initial.email ?? '');
  const [role, setRole] = useState<UserRole>(initial.role ?? 'equipe');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const isNew = !initial.id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().split(/\s+/).length < 2) next.name = 'Informe nome e sobrenome.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'E-mail inválido.';
    if (isNew && password.length < 8) next.password = 'A senha provisória precisa de pelo menos 8 caracteres.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await actions.saveUser({ ...(initial as User), name: name.trim(), email: email.trim().toLowerCase(), role, active: initial.active ?? true, ...(password ? { password } : {}) });
      toast(isNew ? 'Pessoa adicionada à equipe.' : 'Dados atualizados.');
      onClose();
    } catch (err) {
      setErrors({ email: (err as Error).message });
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title={isNew ? 'Adicionar pessoa' : `Editar ${initial.name}`}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="dark" type="submit" form="user-form" loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="user-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Nome" required error={errors.name}>
          {(p) => <input {...p} data-autofocus className="input" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="E-mail" required error={errors.email} hint={isRemote && !isNew ? 'O e-mail de login não pode ser alterado aqui.' : undefined}>
          {(p) => <input {...p} type="email" className="input" value={email} disabled={isRemote && !isNew} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Função">
          {(p) => (
            <select {...p} className="select" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {Object.entries(ROLE).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </Field>
        {(isNew || !isRemote) && (
          <Field
            label={isNew ? 'Senha provisória' : 'Nova senha'}
            required={isNew}
            optional={!isNew}
            error={errors.password}
            hint={isRemote ? 'Passe a senha para a pessoa. Ela pode trocar depois em “Esqueci minha senha”.' : 'A pessoa troca a senha no primeiro acesso.'}
          >
            {(p) => <input {...p} type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
        )}
      </form>
    </Dialog>
  );
}

function KennelsTab() {
  const { db, base } = useData();
  const [editing, setEditing] = useState<Partial<Kennel> | null>(null);
  const care = inCare(db);
  const kennels = [...db.kennels].sort(compareKennels);
  return (
    <>
      <div className="settings-head">
        <p className="muted">
          Onde os animais ficam: localização, setor, ala e número do canil.{base !== 'todas' && ` Mostrando os canis de ${BASE[base]}.`}
        </p>
        <Button variant="dark" icon={<Plus aria-hidden />} onClick={() => setEditing({ kind: 'canil', capacity: 4, base: base === 'todas' ? 'ong' : base })}>
          Adicionar canil
        </Button>
      </div>
      <div className="table-wrap">
        <table className="table table--stack">
          <thead>
            <tr>
              <th scope="col">Canil</th>
              <th scope="col">Unidade</th>
              <th scope="col">Localização</th>
              <th scope="col">Setor</th>
              <th scope="col">Ala</th>
              <th scope="col" className="num">
                Ocupação
              </th>
              <th scope="col">
                <span className="visually-hidden">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {kennels.map((k) => {
              const n = care.filter((a) => a.kennelId === k.id).length;
              return (
                <tr key={k.id}>
                  <td data-primary>
                    <span className="kennel-tag" style={{ position: 'static', marginRight: 10 }}>
                      {kennelTag(k)}
                    </span>
                    <strong style={{ fontWeight: 600 }}>{kennelName(k)}</strong>
                    {k.notes && <div className="cell-primary__sub">{k.notes}</div>}
                  </td>
                  <td data-label="Unidade">{BASE[k.base]}</td>
                  <td data-label="Localização">{k.location}</td>
                  <td data-label="Setor">{k.sector}</td>
                  <td data-label="Ala">{k.wing}</td>
                  <td data-end className="num tnum">
                    <span style={n > k.capacity ? { color: 'var(--danger)', fontWeight: 700 } : undefined}>
                      {n}/{k.capacity}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Button size="sm" variant="ghost" iconOnly icon={<Pencil aria-hidden />} onClick={() => setEditing(k)} aria-label={`Editar ${kennelPath(k)}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing && <KennelDialog initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function KennelDialog({ initial, onClose }: { initial: Partial<Kennel>; onClose: () => void }) {
  const { actions, all: db } = useData();
  const [base, setBase] = useState<Base>(initial.base ?? 'ong');
  const toast = useToast();
  const [location, setLocation] = useState(initial.location ?? '');
  const [sector, setSector] = useState(initial.sector ?? '');
  const [wing, setWing] = useState(initial.wing ?? '');
  const [number, setNumber] = useState(initial.number ?? '');
  const [kind, setKind] = useState<KennelKind>(initial.kind ?? 'canil');
  const [capacity, setCapacity] = useState(String(initial.capacity ?? 4));
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!location.trim()) next.location = 'Informe a unidade. Ex.: Sede Coxipó.';
    if (!sector.trim()) next.sector = 'Informe o setor. Ex.: Cães.';
    if (!/^[A-Za-z0-9]{1,3}$/.test(wing.trim())) next.wing = 'Use até 3 letras ou números. Ex.: A.';
    if (!/^[A-Za-z0-9-]{1,4}$/.test(number.trim())) next.number = 'Use até 4 caracteres. Ex.: 05.';
    else if (db.kennels.some((k) => k.id !== initial.id && same(k.location, location) && same(k.sector, sector) && same(k.wing, wing) && same(k.number, number)))
      next.number = 'Já existe um canil com este número nesta ala.';
    if (!(Number(capacity) >= 1 && Number(capacity) <= 50)) next.capacity = 'Capacidade entre 1 e 50.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    await actions.saveKennel({
      id: initial.id,
      base,
      location: location.trim(),
      sector: sector.trim(),
      wing: wing.trim().toUpperCase(),
      number: number.trim().toUpperCase(),
      kind,
      capacity: Number(capacity),
      notes: notes.trim() || undefined,
    });
    toast('Canil salvo.');
    onClose();
  };

  const existing = (pick: (k: Kennel) => string) => uniqueSorted(db.kennels.map(pick));

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      busy={busy}
      title={initial.id ? `Editar ${kennelShort(initial as Kennel)}` : 'Novo canil'}
      description="Localização → setor → ala → número. Use nomes já existentes para agrupar corretamente."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="dark" type="submit" form="kennel-form" loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="kennel-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Unidade" className="col-2">
          {(p) => (
            <select {...p} className="select" value={base} onChange={(e) => setBase(e.target.value as Base)}>
              {(Object.keys(BASE) as Base[]).map((b) => (
                <option key={b} value={b}>
                  {BASE[b]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Localização" required error={errors.location} className="col-4" hint="Prédio ou endereço.">
          {(p) => <input {...p} data-autofocus className="input" list="kn-locations" value={location} onChange={(e) => setLocation(e.target.value)} />}
        </Field>
        <Field label="Setor" required error={errors.sector} className="col-3">
          {(p) => <input {...p} className="input" list="kn-sectors" value={sector} onChange={(e) => setSector(e.target.value)} />}
        </Field>
        <Field label="Ala" required error={errors.wing} className="col-2 keep">
          {(p) => <input {...p} className="input" value={wing} onChange={(e) => setWing(e.target.value.toUpperCase())} placeholder="A" />}
        </Field>
        <Field label="Número do canil" required error={errors.number} className="col-2 keep">
          {(p) => <input {...p} className="input" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder="05" />}
        </Field>
        <Field label="Capacidade" required error={errors.capacity} className="col-2">
          {(p) => <input {...p} type="number" min={1} max={50} className="input" value={capacity} onChange={(e) => setCapacity(e.target.value)} />}
        </Field>
        <Field label="Tipo" className="col-3">
          {(p) => (
            <select {...p} className="select" value={kind} onChange={(e) => setKind(e.target.value as KennelKind)}>
              {Object.entries(KENNEL_KIND).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Observações" optional className="col-3">
          {(p) => <input {...p} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: reservado para idosos" />}
        </Field>
        <datalist id="kn-locations">
          {existing((k) => k.location).map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
        <datalist id="kn-sectors">
          {existing((k) => k.sector).map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </form>
    </Dialog>
  );
}
function HotelTab() {
  const { db } = useData();
  const [editing, setEditing] = useState<Accommodation | null>(null);
  return (
    <>
      <div className="settings-head">
        <p className="muted">Tipos de acomodação do hotelzinho, capacidade e valor da diária.</p>
      </div>
      <div className="table-wrap">
        <table className="table table--stack">
          <thead>
            <tr>
              <th scope="col">Acomodação</th>
              <th scope="col" className="num">
                Vagas
              </th>
              <th scope="col" className="num">
                Diária
              </th>
              <th scope="col">
                <span className="visually-hidden">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {db.accommodations.map((a) => (
              <tr key={a.id}>
                <td data-primary>
                  <strong style={{ fontWeight: 600 }}>{a.name}</strong>
                  <div className="cell-primary__sub">{a.description}</div>
                </td>
                <td data-label="Vagas" className="num">
                  {a.capacity}
                </td>
                <td data-end className="num tnum">
                  {fmtMoney(a.dailyRate)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Button size="sm" variant="ghost" iconOnly icon={<Pencil aria-hidden />} onClick={() => setEditing(a)} aria-label={`Editar ${a.name}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <AccommodationDialog initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function AccommodationDialog({ initial, onClose }: { initial: Accommodation; onClose: () => void }) {
  const { actions } = useData();
  const toast = useToast();
  const [capacity, setCapacity] = useState(String(initial.capacity));
  const [rate, setRate] = useState(String(initial.dailyRate).replace('.', ','));
  const [description, setDescription] = useState(initial.description);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = Number(rate.replace(',', '.'));
    const next: Record<string, string> = {};
    if (!(Number(capacity) >= 1)) next.capacity = 'Mínimo de 1 vaga.';
    if (Number.isNaN(r) || r < 0) next.rate = 'Valor inválido. Ex.: 85,00.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    await actions.saveAccommodation({ ...initial, capacity: Number(capacity), dailyRate: r, description: description.trim() });
    toast('Acomodação atualizada. Novas reservas usam a nova diária.');
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      title={initial.name}
      description="Hospedagens já criadas mantêm a diária combinada."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="dark" type="submit" form="acc-form" loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="acc-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Vagas" required error={errors.capacity} className="col-3 keep">
          {(p) => <input {...p} data-autofocus type="number" min={1} className="input" value={capacity} onChange={(e) => setCapacity(e.target.value)} />}
        </Field>
        <Field label="Diária (R$)" required error={errors.rate} className="col-3 keep">
          {(p) => <input {...p} inputMode="decimal" className="input" value={rate} onChange={(e) => setRate(e.target.value)} />}
        </Field>
        <Field label="Descrição" optional>
          {(p) => <input {...p} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
      </form>
    </Dialog>
  );
}

function OrgTab() {
  const { db, actions } = useData();
  const toast = useToast();
  const [org, setOrg] = useState(db.organization);
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const me = useMe();
  const emptyDb = db.animals.length === 0 && db.clients.length === 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await actions.saveOrganization({ ...org, name: org.name.trim() });
      toast('Dados da organização salvos.');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-10)', maxWidth: 640 }}>
      <form className="form-grid" onSubmit={submit} noValidate>
        <Field label="Nome da organização" required>
          {(p) => <input {...p} className="input" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} />}
        </Field>
        <Field label="Cidade" className="col-3">
          {(p) => <input {...p} className="input" value={org.city} onChange={(e) => setOrg({ ...org, city: e.target.value })} />}
        </Field>
        <Field label="Telefone" className="col-3">
          {(p) => <input {...p} className="input" inputMode="tel" value={org.phone} onChange={(e) => setOrg({ ...org, phone: maskPhone(e.target.value) })} />}
        </Field>
        <Field label="Chave Pix para doações" hint="Aparece em recibos e comunicações.">
          {(p) => <input {...p} className="input" value={org.pix} onChange={(e) => setOrg({ ...org, pix: e.target.value })} />}
        </Field>
        <div>
          <Button type="submit" variant="dark" loading={busy}>
            Salvar
          </Button>
        </div>
      </form>

      {!isRemote ? (
        <div>
          <Notice tone="neutral">
            <strong>Dados de demonstração.</strong> Este ambiente guarda os dados neste navegador. Restaurar recria os animais, clientes e hospedagens de exemplo com datas a partir de hoje.
          </Notice>
          <Button style={{ marginTop: 12 }} icon={<RotateCcw aria-hidden />} onClick={() => setReset(true)}>
            Restaurar dados de exemplo
          </Button>
        </div>
      ) : (
        emptyDb &&
        me?.role === 'coordenacao' && (
          <div>
            <Notice tone="neutral">
              <strong>Sistema vazio.</strong> Para conhecer o sistema, dá para carregar animais, clientes e hospedagens de exemplo. Eles ficam no banco como dados reais; apague-os antes de começar a usar de verdade.
            </Notice>
            <Button style={{ marginTop: 12 }} icon={<RotateCcw aria-hidden />} onClick={() => setReset(true)}>
              Carregar dados de exemplo
            </Button>
          </div>
        )
      )}
      <ConfirmDialog
        open={reset}
        onClose={() => setReset(false)}
        danger={!isRemote}
        title={isRemote ? 'Carregar dados de exemplo?' : 'Restaurar dados de exemplo?'}
        description={
          isRemote
            ? 'Serão criados cerca de 28 animais, 9 clientes e 21 hospedagens fictícios no banco da LUNAAR.'
            : 'Tudo o que foi cadastrado ou alterado neste navegador será substituído pelos dados de exemplo.'
        }
        confirmLabel={isRemote ? 'Carregar exemplos' : 'Restaurar'}
        onConfirm={async () => {
          try {
            await actions.resetDemo();
            toast(isRemote ? 'Dados de exemplo carregados.' : 'Dados de exemplo restaurados.');
          } catch (err) {
            toast((err as Error).message, 'error');
          }
        }}
      />
    </div>
  );
}
