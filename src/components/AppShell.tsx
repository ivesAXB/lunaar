import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BedDouble,
  Bell,
  ListChecks,
  Pill,
  CalendarDays,
  Gauge,
  LogOut,
  Menu as MenuIcon,
  PawPrint,
  Plus,
  Search,
  Settings,
  Stethoscope,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/data/session';
import { useData, useMe } from '@/data/store';
import { buildAlerts, doseSlots, inCare, isTaskOverdue } from '@/data/selectors';
import { BASE, ROLE } from '@/lib/labels';
import { todayIso } from '@/lib/format';
import { useSeenAlerts } from '@/lib/seenAlerts';
import { BaseSwitcher } from './BaseSwitcher';
import { AlertBell } from './AlertBell';
import { Logo } from './Logo';
import { Avatar, Dialog } from './ui';
import { GlobalSearch } from './GlobalSearch';
import './shell.css';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  end?: boolean;
}

export function AppShell() {
  const { logout } = useAuth();
  const { db, ready, base } = useData();
  const user = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const firstRender = useRef(true);

  const hosted = db.bookings.filter((b) => b.status === 'hospedado').length;
  const pendingDoses = ready ? doseSlots(db, todayIso()).filter((d) => d.status !== 'administrada').length : 0;
  const lateTasks = db.tasks.filter(isTaskOverdue).length;
  const { unseen } = useSeenAlerts(ready ? buildAlerts(db) : []);

  const groups: { label?: string; items: NavItem[] }[] = [
    {
      items: [
        { to: '/', label: 'Painel', icon: Gauge, end: true },
        { to: '/agenda', label: 'Agenda', icon: CalendarDays },
        { to: '/alertas', label: 'Alertas', icon: Bell, count: unseen },
        { to: '/tarefas', label: 'Tarefas', icon: ListChecks, count: lateTasks },
      ],
    },
    {
      label: base === 'todas' ? 'Abrigo' : `Abrigo · ${BASE[base]}`,
      items: [
        { to: '/animais', label: 'Animais', icon: PawPrint, count: inCare(db).length },
        { to: '/saude', label: 'Saúde', icon: Stethoscope },
        { to: '/medicamentos', label: 'Medicamentos', icon: Pill, count: pendingDoses },
      ],
    },
    {
      label: 'Hotelzinho',
      items: [
        { to: '/hospedagem', label: 'Hospedagens', icon: BedDouble, count: hosted },
        { to: '/clientes', label: 'Clientes e pets', icon: Users },
      ],
    },
    {
      label: 'Gestão',
      items: [
        { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
        { to: '/configuracoes', label: 'Configurações', icon: Settings },
      ],
    },
  ];

  // Ao trocar de tela: volta ao topo e leva o foco ao título (leitores de tela anunciam a nova página).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    setMoreOpen(false);
    const t = setTimeout(() => document.getElementById('page-title')?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, [location.pathname]);

  // Atalhos: "/" ou Ctrl+K abrem a busca.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Supabase: login válido mas sem perfil ativo na equipe.
  if (!user) {
    if (!ready) return null;
    return (
      <div className="page" role="alert" style={{ maxWidth: 560 }}>
        <Logo variant="full" height={100} />
        <h1 className="page-title" style={{ marginTop: 24 }}>Acesso não liberado</h1>
        <p className="page-header__sub" style={{ margin: '12px 0 20px' }}>Seu login não está ativo na equipe da LUNAAR. Fale com a coordenação.</p>
        <button type="button" className="btn btn--dark" onClick={logout}>Sair</button>
      </div>
    );
  }

  const newItems = [
    { to: '/animais/novo', label: 'Animal', hint: 'Cadastrar entrada na ONG ou no Recanto', icon: PawPrint },
    { to: '/tarefas?nova=1', label: 'Tarefa', hint: 'Atribuir algo à equipe', icon: ListChecks },
    { to: '/hospedagem/nova', label: 'Hospedagem', hint: 'Reservar vaga no hotelzinho', icon: BedDouble },
    { to: '/clientes/novo', label: 'Cliente', hint: 'Tutor que usa o hotelzinho', icon: Users },
  ];

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Pular para o conteúdo
      </a>

      <aside className="sidebar" aria-label="Navegação principal">
        <Link to="/" className="sidebar__brand" aria-label="LUNAAR, ir para o painel">
          <Logo onDark height={78} />
        </Link>
        <nav className="sidebar__nav">
          {groups.map((g, i) => (
            <div key={i} className="sidebar__group">
              {g.label && <p className="sidebar__label">{g.label}</p>}
              <ul>
                {g.items.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} end={item.end} className="sidebar__link">
                      <item.icon aria-hidden />
                      <span>{item.label}</span>
                      {item.count != null && item.count > 0 && <span className="sidebar__count tnum">{item.count}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="sidebar__user">
          <Avatar name={user.name} />
          <div className="sidebar__user-text">
            <strong>{user.name}</strong>
            <span>{ROLE[user.role]}</span>
          </div>
          <button type="button" className="sidebar__logout" onClick={logout} aria-label="Sair do sistema" title="Sair">
            <LogOut aria-hidden />
          </button>
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <Link to="/" className="topbar__brand" aria-label="LUNAAR, ir para o painel">
            <Logo height={40} />
          </Link>
          <button type="button" className="topbar__search" onClick={() => setSearchOpen(true)}>
            <Search aria-hidden />
            <span>Buscar animal, cliente, pet ou hospedagem</span>
            <kbd>/</kbd>
          </button>
          <button type="button" className="btn btn--ghost btn--icon topbar__search-icon" onClick={() => setSearchOpen(true)} aria-label="Buscar">
            <Search aria-hidden />
          </button>
          <BaseSwitcher />
          <AlertBell />
          <button type="button" className="btn btn--primary topbar__new" onClick={() => setNewOpen(true)} aria-haspopup="dialog" aria-label="Novo cadastro">
            <Plus aria-hidden />
            <span>Novo</span>
          </button>
        </header>

        <main id="main" className="shell__content">
          <Outlet />
        </main>
      </div>

      <nav className="bottomnav" aria-label="Navegação principal">
        {[
          { to: '/', label: 'Painel', icon: Gauge, end: true },
          { to: '/animais', label: 'Animais', icon: PawPrint },
          { to: '/hospedagem', label: 'Hotelzinho', icon: BedDouble },
          { to: '/agenda', label: 'Agenda', icon: CalendarDays },
        ].map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="bottomnav__item">
            <item.icon aria-hidden />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button type="button" className="bottomnav__item" onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
          <MenuIcon aria-hidden />
          <span>Mais</span>
        </button>
      </nav>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title="O que você quer cadastrar?">
        <ul className="choice-list">
          {newItems.map((item) => (
            <li key={item.to}>
              <button
                type="button"
                onClick={() => {
                  setNewOpen(false);
                  navigate(item.to);
                }}
              >
                <item.icon aria-hidden />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais opções">
        <ul className="choice-list">
          {[
            { to: '/medicamentos', label: 'Medicamentos', icon: Pill },
            { to: '/tarefas', label: 'Tarefas', icon: ListChecks },
            { to: '/alertas', label: 'Alertas', icon: Bell },
            { to: '/clientes', label: 'Clientes e pets', icon: Users },
            { to: '/saude', label: 'Saúde dos animais', icon: Stethoscope },
            { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
            { to: '/configuracoes', label: 'Configurações', icon: Settings },
          ].map((item) => (
            <li key={item.to}>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  navigate(item.to);
                }}
              >
                <item.icon aria-hidden />
                <span>
                  <strong>{item.label}</strong>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={logout}>
              <LogOut aria-hidden />
              <span>
                <strong>Sair</strong>
                <small>
                  {user.name} · {ROLE[user.role]}
                </small>
              </span>
            </button>
          </li>
        </ul>
      </Dialog>
    </div>
  );
}
