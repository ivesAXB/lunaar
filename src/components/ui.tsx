import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronLeft, PawPrint, X } from 'lucide-react';
import type { AnimalStatus, BookingStatus } from '@/data/types';
import { ANIMAL_STATUS, BOOKING_STATUS, type Tone } from '@/lib/labels';
import { initials } from '@/lib/format';

// ─── Botão ───────────────────────────────────────────────────

type Variant = 'default' | 'primary' | 'dark' | 'ghost' | 'danger' | 'danger-ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', icon, iconOnly, loading, block, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  const cls = [
    'btn',
    variant !== 'default' && `btn--${variant}`,
    size === 'sm' && 'btn--sm',
    iconOnly && 'btn--icon',
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} data-loading={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden /> : icon}
      {children}
      {loading && <span className="visually-hidden">Carregando</span>}
    </button>
  );
});

export function ButtonLink({
  to,
  variant = 'default',
  size = 'md',
  icon,
  children,
  className = '',
  ...rest
}: { to: string; variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode; children?: ReactNode; className?: string; 'aria-label'?: string }) {
  const cls = ['btn', variant !== 'default' && `btn--${variant}`, size === 'sm' && 'btn--sm', !children && 'btn--icon', className]
    .filter(Boolean)
    .join(' ');
  return (
    <Link to={to} className={cls} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

// ─── Status ──────────────────────────────────────────────────

export function Tag({ tone, children, dot, icon }: { tone: Tone; children: ReactNode; dot?: boolean; icon?: ReactNode }) {
  return (
    <span className={`tag ${dot ? 'tag--dot' : ''} ${!icon && !dot ? 'tag--plain' : ''}`} data-tone={tone}>
      {icon}
      {children}
    </span>
  );
}

/** Status do animal: sempre ícone + texto, nunca só cor. */
export function AnimalStatusTag({ status, short, bare }: { status: AnimalStatus; short?: boolean; bare?: boolean }) {
  const meta = ANIMAL_STATUS[status];
  const Icon = meta.icon;
  if (bare)
    return (
      <span className="status-text" data-tone={meta.tone}>
        <Icon aria-hidden />
        {short ? meta.short : meta.label}
      </span>
    );
  return <Tag tone={meta.tone} icon={<Icon aria-hidden />}>{short ? meta.short : meta.label}</Tag>;
}

export function BookingStatusTag({ status }: { status: BookingStatus }) {
  const meta = BOOKING_STATUS[status];
  return (
    <Tag tone={meta.tone} dot>
      {meta.label}
    </Tag>
  );
}

// ─── Foto e avatar ───────────────────────────────────────────

export function Photo({
  src,
  alt,
  name,
  size,
  ratio,
  round,
  className = '',
  children,
  eager,
}: {
  src?: string;
  alt: string;
  name: string;
  size?: number;
  ratio?: string;
  round?: boolean;
  className?: string;
  children?: ReactNode;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const style = size ? { width: size, height: size } : ratio ? { aspectRatio: ratio } : undefined;
  return (
    <div className={`photo ${round ? 'photo--round' : ''} ${className}`} style={style}>
      {src && !failed ? (
        <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
      ) : (
        <div className="photo__fallback" role="img" aria-label={`${name}: sem foto cadastrada`}>
          {size && size < 56 ? <span style={{ fontSize: size * 0.36 }}>{initials(name) || '?'}</span> : <PawPrint aria-hidden size={size ? size * 0.3 : 32} />}
        </div>
      )}
      {children}
    </div>
  );
}

export function Avatar({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <span className={`avatar ${muted ? 'avatar--muted' : ''}`} aria-hidden>
      {initials(name)}
    </span>
  );
}

// ─── Estrutura de página ─────────────────────────────────────

export function PageHeader({
  title,
  sub,
  back,
  eyebrow,
  actions,
}: {
  title: ReactNode;
  sub?: ReactNode;
  back?: { to: string; label: string };
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {(back || eyebrow) && (
          <div className="page-header__eyebrow">
            {back && (
              <Link to={back.to}>
                <ChevronLeft aria-hidden style={{ verticalAlign: '-2px' }} />
                {back.label}
              </Link>
            )}
            {eyebrow}
          </div>
        )}
        <h1 className="page-title" id="page-title" tabIndex={-1}>
          {title}
        </h1>
        {sub && <p className="page-header__sub">{sub}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function SectionLabel({ children, count, action, as: As = 'h2', id }: { children: ReactNode; count?: number; action?: ReactNode; as?: 'h2' | 'h3'; id?: string }) {
  return (
    <As className="section-label" id={id}>
      <span>
        {children}
        {count != null && (
          <>
            {' '}
            <span className="section-label__count tnum">{count}</span>
          </>
        )}
      </span>
      {action}
    </As>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <PawPrint aria-hidden />}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ w = '100%', h = 14, style }: { w?: number | string; h?: number | string; style?: React.CSSProperties }) {
  return <span className="skeleton" style={{ width: w, height: h, ...style }} aria-hidden />;
}

export function Notice({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="notice" data-tone={tone} role="note">
      {icon}
      <div>{children}</div>
    </div>
  );
}

// ─── Campos ──────────────────────────────────────────────────

export function Field({
  label,
  required,
  optional,
  hint,
  error,
  children,
  className = '',
  htmlFor,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string; required?: boolean }) => ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const auto = useId();
  const id = htmlFor ?? auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${className}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="req" aria-hidden>
            *
          </span>
        )}
        {optional && <span className="opt">(opcional)</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required })}
      {error && (
        <p className="field__error" id={errorId}>
          <AlertCircle aria-hidden />
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Choices<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  hideLegend,
}: {
  legend: string;
  name: string;
  value: T | undefined;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  hideLegend?: boolean;
}) {
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className={hideLegend ? 'visually-hidden' : 'field__label'} style={{ padding: 0, marginBottom: 6 }}>
        {legend}
      </legend>
      <div className="choices">
        {options.map((o) => (
          <label key={o.value} className="choice">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ─── Diálogo ─────────────────────────────────────────────────

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelectorAll<HTMLElement>(FOCUSABLE)[1];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && node) {
        const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div
        ref={ref}
        className={`dialog ${wide ? 'dialog--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
      >
        <div className="dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descId}>{description}</p>}
          </div>
          <Button variant="ghost" iconOnly size="sm" onClick={onClose} aria-label="Fechar" disabled={busy} icon={<X aria-hidden />} />
        </div>
        {children && <div className="dialog__body">{children}</div>}
        {footer && <div className="dialog__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmação para ações destrutivas ou irreversíveis. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  danger = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      busy={busy}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Voltar
          </Button>
          <Button variant={danger ? 'danger' : 'dark'} onClick={run} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

// ─── Menu suspenso ───────────────────────────────────────────

export function MenuButton({ label, icon, children, align = 'right', variant = 'default' }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; variant?: Variant }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        wrap.current?.querySelector<HTMLElement>('button')?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(wrap.current?.querySelectorAll<HTMLElement>('.menu button, .menu a') ?? []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    wrap.current?.querySelector<HTMLElement>('.menu button, .menu a')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <Button variant={variant} iconOnly aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)} icon={icon} />
      {open && (
        <div className="menu" role="menu" id={menuId} style={{ top: 'calc(100% + 6px)', [align]: 0 }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
