import { useState } from 'react';
import type { ID, Kennel } from '@/data/types';
import { Link } from 'react-router-dom';
import { Field, Notice } from '@/components/ui';
import { compareKennels, kennelName, uniqueSorted } from '@/lib/kennel';

/**
 * Seleção em cascata: Localização → Setor → Ala → Canil.
 * Cada nível filtra o seguinte; o valor final é o id do canil.
 * O último select mostra as vagas livres de cada canil.
 */
export function KennelPicker({
  kennels,
  value,
  onChange,
  occupancy,
  error,
  required,
}: {
  kennels: Kennel[];
  value: ID;
  onChange: (id: ID) => void;
  occupancy: (id: ID) => number;
  error?: string;
  required?: boolean;
}) {
  const current = kennels.find((k) => k.id === value);
  const [location, setLocation] = useState(current?.location ?? '');
  const [sector, setSector] = useState(current?.sector ?? '');
  const [wing, setWing] = useState(current?.wing ?? '');

  const locations = uniqueSorted(kennels.map((k) => k.location));
  const sectors = uniqueSorted(kennels.filter((k) => k.location === location).map((k) => k.sector));
  const wings = uniqueSorted(kennels.filter((k) => k.location === location && k.sector === sector).map((k) => k.wing));
  const options = kennels.filter((k) => k.location === location && k.sector === sector && k.wing === wing).sort(compareKennels);

  // O erro (e o foco do resumo de erros) vai para o primeiro nível ainda vazio.
  const errorLevel = !error ? null : !location ? 'location' : !sector ? 'sector' : !wing ? 'wing' : 'kennel';
  const idFor = (level: string) => (level === (errorLevel ?? 'kennel') ? 'f-kennelId' : `f-${level}`);
  const errFor = (level: string) => (errorLevel === level ? error : undefined);

  // Ao escolher um nível, se só houver uma opção no próximo, já seleciona.
  const pickLocation = (v: string) => {
    setLocation(v);
    const s = uniqueSorted(kennels.filter((k) => k.location === v).map((k) => k.sector));
    pickSector(s.length === 1 ? s[0] : '', v);
  };
  const pickSector = (v: string, loc = location) => {
    setSector(v);
    const w = uniqueSorted(kennels.filter((k) => k.location === loc && k.sector === v).map((k) => k.wing));
    pickWing(w.length === 1 ? w[0] : '', loc, v);
  };
  const pickWing = (v: string, loc = location, sec = sector) => {
    setWing(v);
    const ks = kennels.filter((k) => k.location === loc && k.sector === sec && k.wing === v);
    onChange(ks.length === 1 ? ks[0].id : '');
  };

  if (kennels.length === 0) {
    return (
      <div style={{ gridColumn: 'span 6' }}>
        <Notice tone="amber">
          Nenhum canil cadastrado ainda.{' '}
          <Link to="/configuracoes?aba=canis" className="link" style={{ color: 'inherit' }}>
            Cadastre os canis em Configurações
          </Link>{' '}
          (localização, setor, ala e número) e depois volte para alocar o animal.
          {error && <strong style={{ display: 'block', marginTop: 4 }}>{error}</strong>}
        </Notice>
      </div>
    );
  }

  return (
    <>
      <Field label="Localização" required={required} className="col-3" htmlFor={idFor('location')} error={errFor('location')} hint="Unidade onde o animal está.">
        {(p) => (
          <select {...p} className="select" value={location} onChange={(e) => pickLocation(e.target.value)}>
            <option value="">Selecione…</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Setor" required={required} className="col-3" htmlFor={idFor('sector')} error={errFor('sector')}>
        {(p) => (
          <select {...p} className="select" value={sector} onChange={(e) => pickSector(e.target.value)} disabled={!location}>
            <option value="">{location ? 'Selecione…' : 'Escolha a localização'}</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Ala" required={required} className="col-3 keep" htmlFor={idFor('wing')} error={errFor('wing')}>
        {(p) => (
          <select {...p} className="select" value={wing} onChange={(e) => pickWing(e.target.value)} disabled={!sector}>
            <option value="">{sector ? 'Selecione…' : '—'}</option>
            {wings.map((w) => (
              <option key={w} value={w}>
                Ala {w}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Número do canil" required={required} error={errFor('kennel')} className="col-3 keep" htmlFor={idFor('kennel')}>
        {(p) => (
          <select {...p} className="select" value={value} onChange={(e) => onChange(e.target.value)} disabled={!wing}>
            <option value="">{wing ? 'Selecione…' : '—'}</option>
            {options.map((k) => {
              const free = k.capacity - occupancy(k.id);
              return (
                <option key={k.id} value={k.id}>
                  {kennelName(k)} · {free <= 0 ? 'lotado' : `${free} ${free === 1 ? 'vaga' : 'vagas'}`}
                </option>
              );
            })}
          </select>
        )}
      </Field>
    </>
  );
}
