import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BedDouble, Mail, MessageCircle, MoreHorizontal, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { useData } from '@/data/store';
import { accommodationById, bookingViews } from '@/data/selectors';
import { useToast } from '@/components/toast';
import { BookingStatusTag, ButtonLink, ConfirmDialog, MenuButton, PageHeader, Photo, SectionLabel, Tag } from '@/components/ui';
import { fmtDate, fmtMoney, whatsappLink } from '@/lib/format';
import { SEX, SPECIES } from '@/lib/labels';
import { NotFoundPage } from '../NotFoundPage';
import '../boarding/boarding.css';
import '../animals/profile.css';

export function ClientProfilePage() {
  const { id } = useParams();
  const { db, ready, actions } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const client = db.clients.find((c) => c.id === id);
  if (!client) return ready ? <NotFoundPage what="Cliente" back="/clientes" /> : null;

  const pets = db.pets.filter((p) => p.clientId === client.id);
  const bookings = bookingViews(db, db.bookings.filter((b) => pets.some((p) => p.id === b.petId))).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const spent = bookings.reduce((s, b) => s + (db.checkouts.find((c) => c.bookingId === b.id)?.finalValue ?? 0), 0);
  const hosted = new Set(bookings.filter((b) => b.status === 'hospedado').map((b) => b.petId));
  const a = client.address;

  return (
    <div className="page">
      <PageHeader
        back={{ to: '/clientes', label: 'Clientes' }}
        title={client.name}
        sub={`Cliente desde ${fmtDate(client.createdAt)} · ${bookings.filter((b) => b.status === 'finalizada').length} hospedagens finalizadas · ${fmtMoney(spent)} no total`}
        actions={
          <>
            <ButtonLink to={`/hospedagem/nova${pets.length === 1 ? `?pet=${pets[0].id}` : ''}`} variant="primary" icon={<BedDouble aria-hidden />}>
              Nova hospedagem
            </ButtonLink>
            <ButtonLink to={`/clientes/${client.id}/editar`} icon={<Pencil aria-hidden />}>
              Editar
            </ButtonLink>
            <MenuButton label="Mais ações" icon={<MoreHorizontal aria-hidden />}>
              {(close) => (
                <button type="button" role="menuitem" className="menu__danger" onClick={() => (close(), setConfirmDelete(true))}>
                  <Trash2 aria-hidden /> Excluir cliente
                </button>
              )}
            </MenuButton>
          </>
        }
      />

      <div className="booking-grid">
        <div className="stack-lg">
          <section aria-labelledby="c-pets">
            <SectionLabel
              id="c-pets"
              count={pets.length}
              action={
                <Link to={`/clientes/${client.id}/pets/novo`}>
                  <Plus size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Adicionar pet
                </Link>
              }
            >
              Pets
            </SectionLabel>
            {pets.length === 0 ? (
              <p className="muted">
                Nenhum pet cadastrado.{' '}
                <Link className="link" to={`/clientes/${client.id}/pets/novo`}>
                  Cadastrar o primeiro
                </Link>
              </p>
            ) : (
              <ul className="client-pets">
                {pets.map((p) => (
                  <li key={p.id}>
                    <Link to={`/pets/${p.id}`} className="client-pet">
                      <Photo src={p.photo} alt={`Foto de ${p.name}`} name={p.name} ratio="1" />
                      <span className="client-pet__text">
                        <strong>{p.name}</strong>
                        <small>
                          {SPECIES[p.species]} · {p.breed} · {SEX[p.sex].toLowerCase()}
                        </small>
                        {hosted.has(p.id) && (
                          <Tag tone="green" dot>
                            Hospedado agora
                          </Tag>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="c-hist">
            <SectionLabel id="c-hist" count={bookings.length}>
              Hospedagens
            </SectionLabel>
            {bookings.length === 0 ? (
              <p className="muted">Nenhuma hospedagem ainda.</p>
            ) : (
              <ul className="plain-list">
                {bookings.map((b) => (
                  <li key={b.id}>
                    <Link to={`/hospedagem/${b.id}`} className="plain-list__item" style={{ justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong>
                          {b.pet.name} · <span className="tnum">{fmtDate(b.checkIn, 'dd/MM/yy')} → {fmtDate(b.checkOut, 'dd/MM/yy')}</span>
                        </strong>
                        <span className="muted">
                          {b.code} · {accommodationById(db, b.accommodationId)?.name} · {b.nights} {b.nights === 1 ? 'noite' : 'noites'}
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

        <aside className="stack-lg">
          <section aria-labelledby="c-contact">
            <SectionLabel id="c-contact">Contato</SectionLabel>
            <ul className="contact-list">
              {client.whatsapp && (
                <li>
                  <a href={whatsappLink(client.whatsapp)} target="_blank" rel="noreferrer" className="link-plain">
                    <MessageCircle aria-hidden /> WhatsApp {client.whatsapp}
                  </a>
                </li>
              )}
              <li>
                <a href={`tel:${client.phone.replace(/\D/g, '')}`} className="link-plain">
                  <Phone aria-hidden /> {client.phone}
                </a>
              </li>
              {client.email && (
                <li>
                  <a href={`mailto:${client.email}`} className="link-plain">
                    <Mail aria-hidden /> {client.email}
                  </a>
                </li>
              )}
            </ul>
          </section>
          <section aria-labelledby="c-data">
            <SectionLabel id="c-data">Cadastro</SectionLabel>
            <dl className="kv kv--rows kv--compact">
              <div>
                <dt>CPF</dt>
                <dd className="tnum">{client.cpf}</dd>
              </div>
              <div>
                <dt>Endereço</dt>
                <dd>
                  {a.street}, {a.number}
                  {a.complement && ` · ${a.complement}`}
                  <span className="kv-note">
                    {a.district} · {a.city}/{a.state}
                    {a.zip && ` · ${a.zip}`}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Observações</dt>
                <dd className={client.notes ? undefined : 'is-empty'}>{client.notes ?? '—'}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Excluir ${client.name}?`}
        description={`O cadastro do cliente e de ${pets.length === 1 ? 'seu pet' : `seus ${pets.length} pets`} será apagado. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir cliente"
        onConfirm={async () => {
          try {
            await actions.deleteClient(client.id);
            toast('Cliente excluído.');
            navigate('/clientes', { replace: true });
          } catch (err) {
            toast((err as Error).message, 'error');
          }
        }}
      />
    </div>
  );
}
