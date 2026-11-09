import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useData } from '@/data/store';
import { clientById } from '@/data/selectors';
import { Avatar, ButtonLink, EmptyState, PageHeader, Photo, Skeleton, Tag } from '@/components/ui';
import { fmtDate, normalize } from '@/lib/format';
import { SPECIES } from '@/lib/labels';

export function ClientListPage() {
  const { db, ready } = useData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = params.get('aba') === 'pets' ? 'pets' : 'clientes';
  const q = params.get('q') ?? '';
  const term = normalize(q.trim());

  const hostedPetIds = useMemo(() => new Set(db.bookings.filter((b) => b.status === 'hospedado').map((b) => b.petId)), [db.bookings]);

  const clients = useMemo(
    () =>
      db.clients
        .filter((c) => {
          if (!term) return true;
          const petNames = db.pets.filter((p) => p.clientId === c.id).map((p) => p.name).join(' ');
          return normalize(`${c.name} ${c.cpf} ${c.phone} ${c.whatsapp ?? ''} ${c.email ?? ''} ${petNames}`).includes(term);
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [db.clients, db.pets, term],
  );

  const pets = useMemo(
    () =>
      db.pets
        .filter((p) => !term || normalize(`${p.name} ${p.breed} ${clientById(db, p.clientId)?.name ?? ''}`).includes(term))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [db, term],
  );

  const setQ = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  return (
    <div className="page">
      <PageHeader
        title="Clientes e pets"
        sub="Tutores que usam o hotelzinho e seus animais."
        actions={
          <ButtonLink to="/clientes/novo" variant="primary" icon={<Plus aria-hidden />}>
            Cadastrar cliente
          </ButtonLink>
        }
      />

      <nav className="tabs" aria-label="Alternar lista">
        <Link to={`/clientes${q ? `?q=${encodeURIComponent(q)}` : ''}`} replace aria-current={tab === 'clientes' ? 'page' : undefined}>
          Clientes {ready && <span className="count">{db.clients.length}</span>}
        </Link>
        <Link to={`/clientes?aba=pets${q ? `&q=${encodeURIComponent(q)}` : ''}`} replace aria-current={tab === 'pets' ? 'page' : undefined}>
          Pets dos clientes {ready && <span className="count">{db.pets.length}</span>}
        </Link>
      </nav>

      <div className="toolbar">
        <div className="input-group toolbar__search">
          <Search aria-hidden />
          <input
            className="input"
            type="search"
            aria-label={tab === 'pets' ? 'Buscar pets' : 'Buscar clientes'}
            placeholder={tab === 'pets' ? 'Nome do pet, raça ou tutor' : 'Nome, CPF, telefone ou nome do pet'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {!ready ? (
        <Skeleton h={300} />
      ) : tab === 'clientes' ? (
        clients.length === 0 ? (
          <EmptyState title={q ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'} action={!q && <ButtonLink to="/clientes/novo" variant="primary">Cadastrar cliente</ButtonLink>} />
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">WhatsApp</th>
                  <th scope="col">Pets</th>
                  <th scope="col" className="num">
                    Hospedagens
                  </th>
                  <th scope="col">Cliente desde</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const own = db.pets.filter((p) => p.clientId === c.id);
                  const stays = db.bookings.filter((b) => own.some((p) => p.id === b.petId) && b.status !== 'cancelada').length;
                  return (
                    <tr key={c.id} data-href onClick={(e) => !(e.target as HTMLElement).closest('a') && navigate(`/clientes/${c.id}`)}>
                      <td data-primary>
                        <div className="cell-primary">
                          <Avatar name={c.name} muted />
                          <div style={{ minWidth: 0 }}>
                            <Link to={`/clientes/${c.id}`} className="cell-primary__name">
                              {c.name}
                            </Link>
                            <div className="cell-primary__sub tnum">{c.cpf}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="WhatsApp" className="tnum">
                        {c.whatsapp ?? c.phone}
                      </td>
                      <td data-label="Pets">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {own.slice(0, 3).map((p) => (
                            <Photo key={p.id} src={p.photo} alt="" name={p.name} size={26} round />
                          ))}
                          <span>{own.map((p) => p.name).join(', ') || '—'}</span>
                        </span>
                      </td>
                      <td data-label="Hospedagens" className="num">
                        {stays}
                      </td>
                      <td data-label="Desde" className="tnum" data-hide-mobile>
                        {fmtDate(c.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : pets.length === 0 ? (
        <EmptyState title={q ? 'Nenhum pet encontrado' : 'Nenhum pet cadastrado'}>Pets são cadastrados a partir da ficha do cliente.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Pet</th>
                <th scope="col">Tutor(a)</th>
                <th scope="col">Cuidados</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {pets.map((p) => {
                const owner = clientById(db, p.clientId);
                return (
                  <tr key={p.id} data-href onClick={(e) => !(e.target as HTMLElement).closest('a') && navigate(`/pets/${p.id}`)}>
                    <td data-primary>
                      <div className="cell-primary">
                        <Photo src={p.photo} alt="" name={p.name} size={40} round />
                        <div style={{ minWidth: 0 }}>
                          <Link to={`/pets/${p.id}`} className="cell-primary__name">
                            {p.name}
                          </Link>
                          <div className="cell-primary__sub">
                            {SPECIES[p.species]} · {p.breed}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Tutor(a)">
                      {owner && (
                        <Link to={`/clientes/${owner.id}`} className="link-plain">
                          {owner.name}
                        </Link>
                      )}
                    </td>
                    <td data-label="Cuidados">
                      {[p.medications && 'Medicação', p.allergies && 'Alergia'].filter(Boolean).join(' · ') || <span className="muted">—</span>}
                    </td>
                    <td data-end>{hostedPetIds.has(p.id) ? <Tag tone="green" dot>Hospedado</Tag> : <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Em casa</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
