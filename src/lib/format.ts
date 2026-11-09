import { differenceInCalendarDays, differenceInMonths, format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const toDate = (iso: string) => (iso.length === 10 ? parseISO(`${iso}T12:00:00`) : parseISO(iso));
export const todayIso = () => format(new Date(), 'yyyy-MM-dd');
export const isoDate = (date: Date) => format(date, 'yyyy-MM-dd');

export const fmtDate = (iso?: string, pattern = 'dd/MM/yyyy') => (iso ? format(toDate(iso), pattern, { locale: ptBR }) : '—');
export const fmtDateShort = (iso: string) => format(toDate(iso), "d 'de' MMM", { locale: ptBR });
export const fmtTime = (iso: string) => format(toDate(iso), 'HH:mm');
export const fmtDateTime = (iso: string) => format(toDate(iso), "dd/MM/yyyy 'às' HH:mm");
export const fmtWeekday = (iso: string) => format(toDate(iso), 'EEEE', { locale: ptBR });

/** "hoje", "amanhã", "ontem" ou "12 de set". */
export function fmtRelativeDay(iso: string) {
  const date = toDate(iso);
  if (isToday(date)) return 'hoje';
  if (isTomorrow(date)) return 'amanhã';
  if (isYesterday(date)) return 'ontem';
  return fmtDateShort(iso);
}

export const fmtAgo = (iso: string) => formatDistanceToNowStrict(toDate(iso), { locale: ptBR, addSuffix: true });

export const daysFromToday = (iso: string) => differenceInCalendarDays(toDate(iso), new Date());
export const nightsBetween = (from: string, to: string) => Math.max(0, differenceInCalendarDays(toDate(to), toDate(from)));

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtMoney = (value: number) => brl.format(value);
export const fmtNumber = (value: number, digits = 0) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const fmtKg = (value?: number) => (value == null ? '—' : `${fmtNumber(value, value % 1 ? 1 : 0)} kg`);

export function ageInMonths(birthDate?: string, approxMonths?: number, reference = new Date()) {
  if (birthDate) return differenceInMonths(reference, toDate(birthDate));
  return approxMonths;
}

export function fmtAge(months?: number, approx = false) {
  if (months == null) return 'Idade não informada';
  const prefix = approx ? '~' : '';
  if (months < 12) return `${prefix}${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  return `${prefix}${years} ${years === 1 ? 'ano' : 'anos'}`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ─── Documentos e máscaras ──────────────────────────────────────

const onlyDigits = (v: string) => v.replace(/\D/g, '');

function cpfCheckDigit(digits: string) {
  const sum = digits.split('').reduce((acc, n, i) => acc + Number(n) * (digits.length + 1 - i), 0);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/** Gera um CPF formatado e válido a partir de 9 dígitos base (usado nos dados de exemplo). */
export function makeCpf(base9: string) {
  const d1 = cpfCheckDigit(base9);
  const d2 = cpfCheckDigit(base9 + d1);
  return maskCpf(`${base9}${d1}${d2}`);
}

export function isValidCpf(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const d1 = cpfCheckDigit(digits.slice(0, 9));
  const d2 = cpfCheckDigit(digits.slice(0, 9) + d1);
  return digits.endsWith(`${d1}${d2}`);
}

export function maskCpf(value: string) {
  return onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function maskPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCep(value: string) {
  return onlyDigits(value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

export const whatsappLink = (phone: string) => `https://wa.me/55${onlyDigits(phone)}`;

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
