import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Alert } from '@/data/selectors';
import { getCurrentUserId } from '@/data/session';

/**
 * Itens de alerta já vistos por quem está logado.
 *
 * Os alertas são calculados a partir dos dados (vacina vencendo, dose
 * atrasada…), então não existem como linhas no banco: o "visto" é uma
 * conveniência de cada pessoa e fica no navegador dela.
 */

const EVENT = 'lunaar:alertas-vistos';
const keyFor = () => `lunaar.alertas.vistos.${getCurrentUserId() ?? 'anon'}`;
export const itemKey = (alertId: string, itemId: string) => `${alertId}:${itemId}`;

function read(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(keyFor()) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function write(seen: Set<string>) {
  try {
    localStorage.setItem(keyFor(), JSON.stringify([...seen]));
  } catch {
    /* sem armazenamento: vale só nesta aba */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useSeenAlerts(alerts: Alert[]) {
  const [seen, setSeen] = useState(read);

  // Mantém o sino e a página de alertas em sincronia.
  useEffect(() => {
    const sync = () => setSeen(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const current = useMemo(() => alerts.flatMap((a) => a.items.map((i) => itemKey(a.id, i.id))), [alerts]);
  const unseen = current.filter((k) => !seen.has(k)).length;

  const markSeen = useCallback(
    (keys: string[]) => {
      // Guarda só o que ainda existe, para a lista não crescer para sempre.
      const live = new Set(current);
      const next = new Set([...read()].filter((k) => live.has(k)));
      keys.forEach((k) => next.add(k));
      setSeen(next);
      write(next);
    },
    [current],
  );

  const markAll = useCallback(() => markSeen(current), [markSeen, current]);

  return { seen, unseen, markSeen, markAll };
}
