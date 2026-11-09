import type { Kennel } from '@/data/types';
import { KENNEL_KIND } from './labels';

/** "Canil 01", "Gatil 01", "Enfermaria 01"… */
export const kennelName = (k: Kennel) => `${KENNEL_KIND[k.kind]} ${k.number}`;

/** Etiqueta curta da foto: "A-01". */
export const kennelTag = (k: Kennel) => `${k.wing}-${k.number}`;

/** "Ala A · Canil 01" */
export const kennelShort = (k: Kennel) => `Ala ${k.wing} · ${kennelName(k)}`;

/** "Sede Coxipó · Setor Cães · Ala A · Canil 01" */
export const kennelPath = (k: Kennel) => `${k.location} · Setor ${k.sector} · ${kennelShort(k)}`;

/** Ordenação natural por localização, setor, ala e número. */
export const compareKennels = (a: Kennel, b: Kennel) =>
  a.location.localeCompare(b.location) ||
  a.sector.localeCompare(b.sector) ||
  a.wing.localeCompare(b.wing, 'pt-BR', { numeric: true }) ||
  a.number.localeCompare(b.number, 'pt-BR', { numeric: true });

export const uniqueSorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
