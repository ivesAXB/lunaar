import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useData } from '@/data/store';
import { kennelById, missingInfo, vaccineDue } from '@/data/selectors';
import type { Animal, AnimalStatus } from '@/data/types';
import { ageInMonths, daysFromToday, fmtAge, fmtDate, normalize } from '@/lib/format';
import { SEX, SIZE, SPECIES } from '@/lib/labels';
import { compareKennels, kennelShort, kennelTag } from '@/lib/kennel';
import { AnimalStatusTag, Button, ButtonLink, Dialog, EmptyState, PageHeader, Photo, Skeleton } from '@/components/ui';
import './animals.css';

const TABS: { key: string; label: string; match: (a: Animal) => boolean }[] = [
  { key: '', label: 'Sob cuidado', match: (a) => a.status !== 'adotado' },
  { key: 'disponivel', label: 'Disponíveis', match: (a) => a.status === 'disponivel' },
  { key: 'tratamento', label: 'Em tratamento', match: (a) => a.status === 'tratamento' },
  { key: 'observacao', label: 'Em observação', match: (a) => a.status === 'observacao' },
  { key: 'reservado', label: 'Reservados', match: (a) => a.status === 'reservado' },
  { key: 'atencao', label: 'Atenção', match: (a) => a.status === 'atencao' },
  { key: 'adotado', label: 'Adotados', match: (a) => a.status === 'adotado' },
];

const HEALTH_FILTERS: Record<string, { label: string; test: (a: Animal, ctx: { treat: Set<string>; vac: Set<string> }) => boolean }> = {
  tratamento: { label: 'Com tratamento ativo ou pendente', test: (a, c) => c.treat.has(a.id) },
  vacina: { label: 'Vacina vencida ou vencendo', test: (a, c) => c.vac.has(a.id) },
  doenca: { label: 'Com doença ou alergia registrada', test: (a) => Boolean(a.diseases || a.allergies) },
  incompleto: { label: 'Cadastro incompleto', test: (a) => missingInfo(a).length > 0 },
  castrar: { label: 'Não castrado', test: (a) => !a.neutered },
};

const SORTS: Record<string, { label: string; fn: (a: Animal, b: Animal) => number }> = {
  nome: { label: 'Nome (A–Z)', fn: (a, b) => a.name.localeCompare(b.name) },
  recentes: { label: 'Entrada mais recente', fn: (a, b) => b.intakeDate.localeCompare(a.intakeDate) },
  antigos: { label: 'Há mais tempo no abrigo', fn: (a, b) => a.intakeDate.localeCompare(b.intakeDate) },
};

const FILTER_KEYS = ['especie', 'sexo', 'porte', 'canil', 'raca', 'saude'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

function readView(): 'cards' | 'lista' {
  try {
    return localStorage.getItem('lunaar.animals.view') === 'lista' ? 'lista' : 'cards';
  } catch {
    return 'cards';
  }
}

export function AnimalListPage() {
  const { db, ready } = useData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [view, setView] = useState(readView);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';
  const sort = params.get('ordem') ?? 'nome';
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ''])) as Record<FilterKey, string>;

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const tabHref = (key: string) => {
    const next = new URLSearchParams(params);
    if (key) next.set('status', key);
    else next.delete('status');
    const qs = next.toString();
    return qs ? `?${qs}` : '/animais';
  };

  const changeView = (v: 'cards' | 'lista') => {
    setView(v);
    try {
      localStorage.setItem('lunaar.animals.view', v);
    } catch {
      /* preferência apenas nesta sessão */
    }
  };

  const ctx = useMemo(
    () => ({
      treat: new Set(db.treatments.filter((t) => t.status !== 'concluido').map((t) => t.animalId)),
      vac: new Set(db.animals.filter((a) => vaccineDue(db, a.id).length).map((a) => a.id)),
    }),
    [db],
  );

  const breeds = useMemo(() => [...new Set(db.animals.map((a) => a.breed))].sort(), [db.animals]);
  const tab = TABS.find((t) => t.key === status) ?? TABS[0];

  const base = useMemo(() => {
    const term = normalize(q.trim());
    return db.animals.filter((a) => {
      if (term && !normalize(`${a.name} ${a.breed} ${a.color}`).includes(term)) return false;
      if (filters.especie && a.species !== filters.especie) return false;
      if (filters.sexo && a.sex !== filters.sexo) return false;
      if (filters.porte && a.size !== filters.porte) return false;
      if (filters.canil && a.kennelId !== filters.canil) return false;
      if (filters.raca && a.breed !== filters.raca) return false;
      if (filters.saude && !HEALTH_FILTERS[filters.saude]?.test(a, ctx)) return false;
      return true;
    });
  }, [db.animals, q, filters.especie, filters.sexo, filters.porte, filters.canil, filters.raca, filters.saude, ctx]);

  const list = useMemo(() => base.filter(tab.match).sort(SORTS[sort]?.fn ?? SORTS.nome.fn), [base, tab, sort]);

  const activeChips: { key: FilterKey; label: string }[] = [];
  if (filters.especie) activeChips.push({ key: 'especie', label: SPECIES[filters.especie as 'cao'] });
  if (filters.sexo) activeChips.push({ key: 'sexo', label: SEX[filters.sexo as 'macho'] });
  if (filters.porte) activeChips.push({ key: 'porte', label: `Porte ${SIZE[filters.porte as 'medio'].toLowerCase()}` });
  if (filters.canil) activeChips.push({ key: 'canil', label: kennelById(db, filters.canil) ? kennelShort(kennelById(db, filters.canil)!) : 'Canil' });
  if (filters.raca) activeChips.push({ key: 'raca', label: filters.raca });
  if (filters.saude) activeChips.push({ key: 'saude', label: HEALTH_FILTERS[filters.saude]?.label ?? '' });

  const filterControls = (
    <>
      <FilterSelect label="Espécie" value={filters.especie} onChange={(v) => update({ especie: v })} options={Object.entries(SPECIES)} />
      <FilterSelect label="Sexo" value={filters.sexo} onChange={(v) => update({ sexo: v })} options={Object.entries(SEX)} />
      <FilterSelect label="Porte" value={filters.porte} onChange={(v) => update({ porte: v })} options={Object.entries(SIZE)} />
      <FilterSelect label="Canil" value={filters.canil} onChange={(v) => update({ canil: v })} options={[...db.kennels].sort(compareKennels).map((k) => [k.id, ` · `])} />
      <FilterSelect label="Raça" value={filters.raca} onChange={(v) => update({ raca: v })} options={breeds.map((b) => [b, b])} />
      <FilterSelect label="Saúde" value={filters.saude} onChange={(v) => update({ saude: v })} options={Object.entries(HEALTH_FILTERS).map(([k, f]) => [k, f.label])} />
    </>
  );

  return (
    <div className="page">
      <PageHeader
        title="Animais"
        sub="Cães e gatos acolhidos pela LUNAAR."
        actions={
          <ButtonLink to="/animais/novo" variant="primary" icon={<Plus aria-hidden />}>
            Cadastrar animal
          </ButtonLink>
        }
      />

      <nav className="tabs" aria-label="Filtrar por situação">
        {TABS.map((t) => {
          const n = base.filter(t.match).length;
          return (
            <Link key={t.key} to={tabHref(t.key)} aria-current={t.key === status ? 'page' : undefined} replace>
              {t.label}
              {ready && <span className="count">{n}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="toolbar">
        <div className="input-group toolbar__search">
          <Search aria-hidden />
          <input className="input" type="search" placeholder="Buscar por nome, raça ou cor" aria-label="Buscar animais" value={q} onChange={(e) => update({ q: e.target.value })} />
        </div>
        <Button className="toolbar__filters-btn" icon={<SlidersHorizontal aria-hidden />} onClick={() => setFiltersOpen(true)}>
          Filtros{activeChips.length > 0 && ` (${activeChips.length})`}
        </Button>
        <span className="toolbar__spacer" />
        <label className="visually-hidden" htmlFor="animal-sort">
          Ordenar
        </label>
        <select id="animal-sort" className="select toolbar__sort" value={sort} onChange={(e) => update({ ordem: e.target.value === 'nome' ? '' : e.target.value })}>
          {Object.entries(SORTS).map(([k, s]) => (
            <option key={k} value={k}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="segmented" role="group" aria-label="Visualização">
          <button type="button" aria-pressed={view === 'cards'} onClick={() => changeView('cards')}>
            <LayoutGrid aria-hidden /> <span className="hide-sm">Cards</span>
          </button>
          <button type="button" aria-pressed={view === 'lista'} onClick={() => changeView('lista')}>
            <List aria-hidden /> <span className="hide-sm">Lista</span>
          </button>
        </div>
      </div>
      <div className="filter-row" role="group" aria-label="Filtros">
        {filterControls}
      </div>

      {(activeChips.length > 0 || q) && (
        <div className="filter-chips">
          <span className="result-count" aria-live="polite">
            {list.length} {list.length === 1 ? 'resultado' : 'resultados'}
          </span>
          {activeChips.map((c) => (
            <span key={c.key} className="filter-chip">
              {c.label}
              <button type="button" onClick={() => update({ [c.key]: '' })} aria-label={`Remover filtro ${c.label}`}>
                <X aria-hidden />
              </button>
            </span>
          ))}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setParams(status ? { status } : {}, { replace: true })}>
            Limpar tudo
          </button>
        </div>
      )}

      {!ready ? (
        view === 'cards' ? <CardsSkeleton /> : <Skeleton h={320} />
      ) : list.length === 0 ? (
        <EmptyState
          title={q || activeChips.length ? 'Nenhum animal com esses filtros' : 'Nenhum animal nesta situação'}
          action={
            q || activeChips.length ? (
              <Button onClick={() => setParams(status ? { status } : {}, { replace: true })}>Limpar filtros</Button>
            ) : (
              <ButtonLink to="/animais/novo" variant="primary" icon={<Plus aria-hidden />}>
                Cadastrar animal
              </ButtonLink>
            )
          }
        >
          {q || activeChips.length ? 'Tente remover algum filtro ou buscar por outro termo.' : 'Quando um animal entrar nesta situação, ele aparece aqui.'}
        </EmptyState>
      ) : view === 'cards' ? (
        <ul className="animal-grid">
          {list.map((a, i) => (
            <li key={a.id} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
              <AnimalCard animal={a} kennelCode={kennelById(db, a.kennelId) ? kennelTag(kennelById(db, a.kennelId)!) : undefined} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Animal</th>
                <th scope="col">Sexo · porte</th>
                <th scope="col">Idade</th>
                <th scope="col">Local</th>
                <th scope="col">Situação</th>
                <th scope="col">Entrada</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const k = kennelById(db, a.kennelId);
                return (
                  <tr key={a.id} data-href onClick={(e) => !(e.target as HTMLElement).closest('a') && navigate(`/animais/${a.id}`)}>
                    <td data-primary>
                      <div className="cell-primary">
                        <Photo src={a.photo} alt="" name={a.name} size={40} />
                        <div style={{ minWidth: 0 }}>
                          <Link to={`/animais/${a.id}`} className="cell-primary__name">
                            {a.name}
                          </Link>
                          <div className="cell-primary__sub">
                            {SPECIES[a.species]} · {a.breed}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Sexo e porte">
                      {SEX[a.sex]} · {SIZE[a.size]}
                    </td>
                    <td data-label="Idade" className="tnum">
                      {fmtAge(ageInMonths(a.birthDate, a.ageApproxMonths), !a.birthDate)}
                    </td>
                    <td data-label="Local">{k ? (<>{kennelShort(k)}<div className="cell-primary__sub">{k.location} · Setor {k.sector}</div></>) : a.status === 'adotado' ? 'Com a família' : '—'}</td>
                    <td data-end>
                      <AnimalStatusTag status={a.status} short />
                    </td>
                    <td data-label="Entrada" className="tnum" data-hide-mobile>
                      {fmtDate(a.intakeDate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        footer={
          <>
            <Button onClick={() => setParams(status ? { status } : {}, { replace: true })}>Limpar</Button>
            <Button variant="dark" onClick={() => setFiltersOpen(false)}>
              Ver {list.length} {list.length === 1 ? 'animal' : 'animais'}
            </Button>
          </>
        }
      >
        <div className="filters-sheet">{filterControls}</div>
      </Dialog>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="filter-select">
      <span className="visually-hidden">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)} data-active={value ? true : undefined}>
        <option value="">{label}: todos</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AnimalCard({ animal: a, kennelCode }: { animal: Animal; kennelCode?: string }) {
  const months = ageInMonths(a.birthDate, a.ageApproxMonths);
  const days = -daysFromToday(a.intakeDate);
  return (
    <Link to={`/animais/${a.id}`} className="animal-card">
      <Photo src={a.photo} alt={`Foto de ${a.name}`} name={a.name} ratio="4 / 5" className="animal-card__photo">
        {kennelCode && <span className="kennel-tag">{kennelCode}</span>}
      </Photo>
      <div className="animal-card__body">
        <div className="animal-card__title">
          <h3>{a.name}</h3>
          <span className="animal-card__sex" aria-label={SEX[a.sex]} title={SEX[a.sex]}>
            {a.sex === 'macho' ? '♂' : '♀'}
          </span>
        </div>
        <p className="animal-card__meta">
          {a.breed} · {SIZE[a.size].toLowerCase()} · {fmtAge(months, !a.birthDate)}
        </p>
        <div className="animal-card__foot">
          <AnimalStatusTag status={a.status as AnimalStatus} short bare />
          <span className="animal-card__days tnum">{a.status === 'adotado' && a.adoption ? `adotado ${fmtDate(a.adoption.date, 'dd/MM')}` : `${days} ${days === 1 ? 'dia' : 'dias'}`}</span>
        </div>
      </div>
    </Link>
  );
}

function CardsSkeleton() {
  return (
    <ul className="animal-grid" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i}>
          <Skeleton h="auto" style={{ aspectRatio: '4 / 5' }} />
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <Skeleton w="50%" h={18} />
            <Skeleton w="80%" h={12} />
          </div>
        </li>
      ))}
    </ul>
  );
}
