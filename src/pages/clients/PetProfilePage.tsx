import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BedDouble, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useData } from '@/data/store';
import { bookingViews } from '@/data/selectors';
import { useToast } from '@/components/toast';
import { BookingStatusTag, ButtonLink, ConfirmDialog, MenuButton, Photo, SectionLabel } from '@/components/ui';
import { fmtDate, fmtKg } from '@/lib/format';
import { SEX, SIZE, SPECIES } from '@/lib/labels';
import { NotFoundPage } from '../NotFoundPage';
import '../animals/profile.css';

export function PetProfilePage() {
  const { id } = useParams();
  const { db, ready, actions } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pet = db.pets.find((p) => p.id === id);
  if (!pet) return ready ? <NotFoundPage what="Pet" back="/clientes?aba=pets" /> : null;
  const owner = db.clients.find((c) => c.id === pet.clientId);
  const stays = bookingViews(db, db.bookings.filter((b) => b.petId === pet.id)).sort((a, b) => b.checkIn.localeCompare(a.checkIn));

  const rows: [string, string | undefined][] = [
    ['Alimentação', pet.feeding],
    ['Medicamentos', pet.medications],
    ['Alergias', pet.allergies],
    ['Vacinas', pet.vaccines],
    ['Comportamento', pet.behavior],
    ['Observações', pet.notes],
  ];

  return (
    <div className="page profile">
      <div className="profile__crumbs">
        <Link to="/clientes?aba=pets">Pets dos clientes</Link>
        <span aria-hidden>/</span>
        <span>{pet.name}</span>
      </div>
      <div className="profile__layout">
        <aside className="profile__aside">
          <Photo src={pet.photo} alt={`Foto de ${pet.name}`} name={pet.name} ratio="4 / 5" className="profile__photo" eager />
        </aside>
        <div className="profile__main">
          <header className="profile__header">
            <div>
              <p className="profile__kicker">
                Pet de cliente · {owner && <Link to={`/clientes/${owner.id}`} className="link-plain">{owner.name}</Link>}
              </p>
              <h1 className="profile__name" id="page-title" tabIndex={-1}>
                {pet.name}
              </h1>
            </div>
            <div className="profile__actions">
              <ButtonLink to={`/hospedagem/nova?pet=${pet.id}`} variant="primary" icon={<BedDouble aria-hidden />}>
                Nova hospedagem
              </ButtonLink>
              <ButtonLink to={`/pets/${pet.id}/editar`} icon={<Pencil aria-hidden />}>
                Editar
              </ButtonLink>
              <MenuButton label="Mais ações" icon={<MoreHorizontal aria-hidden />}>
                {(close) => (
                  <button type="button" role="menuitem" className="menu__danger" onClick={() => (close(), setConfirmDelete(true))}>
                    <Trash2 aria-hidden /> Excluir pet
                  </button>
                )}
              </MenuButton>
            </div>
          </header>

          <dl className="profile__facts">
            {[
              ['Espécie', SPECIES[pet.species]],
              ['Raça', pet.breed],
              ['Sexo', SEX[pet.sex]],
              ['Idade', pet.ageYears != null ? `${pet.ageYears} ${pet.ageYears === 1 ? 'ano' : 'anos'}` : '—'],
              ['Porte', SIZE[pet.size]],
              ['Peso', fmtKg(pet.weightKg)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="stack-lg" style={{ marginTop: 'var(--sp-8)' }}>
            <section aria-labelledby="p-care">
              <SectionLabel id="p-care">Cuidados na hospedagem</SectionLabel>
              <dl className="kv kv--rows">
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd className={v ? undefined : 'is-empty'}>{v ?? 'Não informado'}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="p-stays">
              <SectionLabel id="p-stays" count={stays.length}>
                Hospedagens
              </SectionLabel>
              {stays.length === 0 ? (
                <p className="muted">{pet.name} ainda não se hospedou na LUNAAR.</p>
              ) : (
                <ul className="plain-list">
                  {stays.map((b) => (
                    <li key={b.id}>
                      <Link to={`/hospedagem/${b.id}`} className="plain-list__item" style={{ justifyContent: 'space-between' }}>
                        <span>
                          <strong className="tnum">
                            {fmtDate(b.checkIn, 'dd/MM/yy')} → {fmtDate(b.checkOut, 'dd/MM/yy')}
                          </strong>{' '}
                          <span className="muted">
                            · {b.code} · {b.nights} {b.nights === 1 ? 'noite' : 'noites'}
                          </span>
                        </span>
                        <BookingStatusTag status={b.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Excluir ${pet.name}?`}
        description={
          stays.length
            ? `${pet.name} tem ${stays.length} ${stays.length === 1 ? 'hospedagem registrada' : 'hospedagens registradas'}. Pets com histórico não podem ser excluídos, para manter os registros.`
            : 'A ficha do pet será apagada. Esta ação não pode ser desfeita.'
        }
        confirmLabel="Excluir pet"
        onConfirm={async () => {
          try {
            await actions.deletePet(pet.id);
            toast('Pet excluído.');
            navigate(owner ? `/clientes/${owner.id}` : '/clientes', { replace: true });
          } catch (err) {
            toast((err as Error).message, 'error');
          }
        }}
      />
    </div>
  );
}
