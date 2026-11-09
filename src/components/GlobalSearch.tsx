import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Search, User as UserIcon } from 'lucide-react';
import { useData } from '@/data/store';
import { bookingViews, kennelById } from '@/data/selectors';
import { normalize, fmtDateShort } from '@/lib/format';
import { kennelShort } from '@/lib/kennel';
import { ANIMAL_STATUS, BOOKING_STATUS, SPECIES } from '@/lib/labels';
import { Photo } from './ui';
import './search.css';

interface Result {
  id: string;
  group: string;
  title: string;
  sub: string;
  href: string;
  photo?: string | null;
  icon?: 'client' | 'booking';
}

export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(0);
    const prev = document.activeElement as HTMLElement | null;
    setTimeout(() => inputRef.current?.focus(), 10);
    return () => prev?.focus?.();
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const term = normalize(q.trim());
    if (!term) return [];
    const has = (...parts: (string | undefined)[]) => parts.some((p) => p && normalize(p).includes(term));
    const out: Result[] = [];
    db.animals
      .filter((a) => has(a.name, a.breed, a.color))
      .slice(0, 6)
      .forEach((a) =>
        out.push({
          id: a.id,
          group: 'Animais da ONG',
          title: a.name,
          sub: `${SPECIES[a.species]} · ${a.breed} · ${ANIMAL_STATUS[a.status].short}${kennelById(db, a.kennelId) ? ` · ${kennelShort(kennelById(db, a.kennelId)!)}` : ''}`,
          href: `/animais/${a.id}`,
          photo: a.photo ?? null,
        }),
      );
    db.pets
      .filter((p) => has(p.name, p.breed))
      .slice(0, 5)
      .forEach((p) => {
        const owner = db.clients.find((c) => c.id === p.clientId);
        out.push({ id: p.id, group: 'Pets de clientes', title: p.name, sub: `${p.breed} · Tutor(a): ${owner?.name ?? '—'}`, href: `/pets/${p.id}`, photo: p.photo ?? null });
      });
    db.clients
      .filter((c) => has(c.name, c.cpf, c.phone, c.whatsapp, c.email))
      .slice(0, 5)
      .forEach((c) => out.push({ id: c.id, group: 'Clientes', title: c.name, sub: `${c.cpf} · ${c.whatsapp ?? c.phone}`, href: `/clientes/${c.id}`, icon: 'client' }));
    bookingViews(db)
      .filter((b) => has(b.code))
      .slice(0, 4)
      .forEach((b) =>
        out.push({
          id: b.id,
          group: 'Hospedagens',
          title: `${b.code} · ${b.pet.name}`,
          sub: `${fmtDateShort(b.checkIn)} → ${fmtDateShort(b.checkOut)} · ${BOOKING_STATUS[b.status].label}`,
          href: `/hospedagem/${b.id}`,
          icon: 'booking',
        }),
      );
    return out;
  }, [q, db]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const go = (r: Result) => {
    onClose();
    navigate(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    }
    if (e.key === 'Enter' && results[active]) go(results[active]);
  };

  let lastGroup = '';
  return createPortal(
    <div className="overlay search-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search" role="dialog" aria-modal="true" aria-label="Buscar no sistema">
        <div className="search__field">
          <Search aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Nome do animal, cliente, CPF, telefone ou código H-…"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="search-results"
            aria-activedescendant={results[active] ? `sr-${results[active].id}` : undefined}
            aria-label="Buscar"
            autoComplete="off"
          />
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            Esc
          </button>
        </div>
        <ul id="search-results" role="listbox" className="search__results" aria-label="Resultados">
          {results.map((r, i) => {
            const header = r.group !== lastGroup;
            lastGroup = r.group;
            return (
              <li key={r.group + r.id} role="presentation">
                {header && (
                  <p className="search__group" aria-hidden>
                    {r.group}
                  </p>
                )}
                <div
                  id={`sr-${r.id}`}
                  role="option"
                  aria-selected={i === active}
                  className="search__item"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                >
                  {r.icon === 'client' ? (
                    <span className="search__icon">
                      <UserIcon aria-hidden />
                    </span>
                  ) : r.icon === 'booking' ? (
                    <span className="search__icon">
                      <BedDouble aria-hidden />
                    </span>
                  ) : (
                    <Photo src={r.photo ?? undefined} alt="" name={r.title} size={36} />
                  )}
                  <span className="search__text">
                    <strong>{r.title}</strong>
                    <small>{r.sub}</small>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        {q.trim() && results.length === 0 && <p className="search__empty">Nada encontrado para “{q}”.</p>}
        {!q.trim() && <p className="search__empty">Dica: pressione <kbd>/</kbd> em qualquer tela para buscar.</p>}
      </div>
    </div>,
    document.body,
  );
}
