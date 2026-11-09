import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  Eye,
  House,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import type {
  AnimalEventType,
  Base,
  DocumentKind,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  AnimalOrigin,
  AnimalStatus,
  BookingStatus,
  HealthRecordType,
  KennelKind,
  PetCondition,
  Sex,
  Size,
  Species,
  TreatmentStatus,
  UserRole,
} from '@/data/types';

/** Tons semânticos: cada um mapeia para um par de tokens (--tone-*-fg / -bg) em tokens.css. */
export type Tone = 'green' | 'amber' | 'blue' | 'orange' | 'neutral' | 'red' | 'ink';

export interface StatusMeta {
  label: string;
  short: string;
  tone: Tone;
  icon: LucideIcon;
  description: string;
}

export const ANIMAL_STATUS: Record<AnimalStatus, StatusMeta> = {
  disponivel: { label: 'Disponível para adoção', short: 'Disponível', tone: 'green', icon: CheckCircle2, description: 'Apto e liberado para adoção.' },
  tratamento: { label: 'Em tratamento', short: 'Tratamento', tone: 'amber', icon: Stethoscope, description: 'Em tratamento veterinário ativo.' },
  observacao: { label: 'Em observação', short: 'Observação', tone: 'blue', icon: Eye, description: 'Quarentena ou avaliação de comportamento/saúde.' },
  reservado: { label: 'Reservado', short: 'Reservado', tone: 'orange', icon: Bookmark, description: 'Adoção em andamento com família definida.' },
  adotado: { label: 'Adotado', short: 'Adotado', tone: 'ink', icon: House, description: 'Adotado; não está mais no abrigo.' },
  atencao: { label: 'Necessita atenção', short: 'Atenção', tone: 'red', icon: AlertTriangle, description: 'Precisa de ação imediata da equipe.' },
};

export const ANIMAL_STATUS_ORDER: AnimalStatus[] = ['atencao', 'tratamento', 'observacao', 'disponivel', 'reservado', 'adotado'];

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone; step: number }> = {
  reserva: { label: 'Reserva', tone: 'neutral', step: 0 },
  confirmada: { label: 'Confirmada', tone: 'blue', step: 1 },
  hospedado: { label: 'Pet hospedado', tone: 'green', step: 2 },
  finalizada: { label: 'Finalizada', tone: 'ink', step: 3 },
  cancelada: { label: 'Cancelada', tone: 'red', step: -1 },
};

export const SPECIES: Record<Species, string> = { cao: 'Cachorro', gato: 'Gato' };
export const SEX: Record<Sex, string> = { macho: 'Macho', femea: 'Fêmea' };
export const SIZE: Record<Size, string> = { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' };

export const ORIGIN: Record<AnimalOrigin, string> = {
  resgate: 'Resgate',
  abandono: 'Abandono',
  entrega_voluntaria: 'Entrega voluntária',
  transferencia: 'Transferência',
  nascido_abrigo: 'Nascido no abrigo',
};

export const KENNEL_KIND: Record<KennelKind, string> = {
  canil: 'Canil',
  gatil: 'Gatil',
  enfermaria: 'Enfermaria',
  lar_temporario: 'Lar temporário',
};

export const TREATMENT_STATUS: Record<TreatmentStatus, { label: string; tone: Tone }> = {
  pendente: { label: 'Pendente', tone: 'orange' },
  ativo: { label: 'Em andamento', tone: 'amber' },
  concluido: { label: 'Concluído', tone: 'neutral' },
};

export const HEALTH_RECORD: Record<HealthRecordType, string> = {
  consulta: 'Consulta',
  exame: 'Exame',
  cirurgia: 'Cirurgia',
  observacao: 'Observação',
};

export const EVENT_TYPE: Record<AnimalEventType, string> = {
  entrada: 'Entrada',
  status: 'Status',
  canil: 'Localização',
  adocao: 'Adoção',
  nota: 'Anotação',
  saude: 'Saúde',
};

export const ROLE: Record<UserRole, string> = {
  coordenacao: 'Coordenação',
  equipe: 'Equipe de cuidado',
  veterinaria: 'Veterinária',
};

export const CONDITION: Record<PetCondition, { label: string; tone: Tone }> = {
  boa: { label: 'Boa', tone: 'green' },
  regular: { label: 'Regular', tone: 'amber' },
  atencao: { label: 'Requer atenção', tone: 'red' },
};

export const CHECKIN_ITEMS = ['Coleira', 'Guia', 'Ração', 'Cama', 'Brinquedo', 'Medicamentos', 'Caixa de transporte', 'Roupinha', 'Comedouro'];

export const BASE: Record<Base, string> = { ong: 'ONG Lunaar', recanto: 'Recanto' };

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  pendente: { label: 'A fazer', tone: 'neutral' },
  em_andamento: { label: 'Em andamento', tone: 'blue' },
  concluida: { label: 'Concluída', tone: 'green' },
};
export const TASK_STATUS_ORDER: TaskStatus[] = ['pendente', 'em_andamento', 'concluida'];

export const TASK_PRIORITY: Record<TaskPriority, { label: string; tone: Tone; rank: number }> = {
  critica: { label: 'Crítica', tone: 'red', rank: 0 },
  alta: { label: 'Alta', tone: 'orange', rank: 1 },
  normal: { label: 'Normal', tone: 'neutral', rank: 2 },
  baixa: { label: 'Baixa', tone: 'neutral', rank: 3 },
};

export const TASK_CATEGORY: Record<TaskCategory, string> = {
  geral: 'Geral',
  medicacao: 'Medicação',
  exame: 'Exame',
  higiene: 'Higiene',
  monitoramento: 'Monitoramento',
  alta: 'Alta / saída',
};

export const DOCUMENT_KIND: Record<DocumentKind, string> = {
  exame: 'Exame',
  receituario: 'Receituário',
  laudo: 'Laudo',
  termo: 'Termo',
  foto: 'Foto',
  documento: 'Documento',
};

export type DoseStatus = 'administrada' | 'pendente' | 'atrasada';
export const DOSE_STATUS: Record<DoseStatus, { label: string; tone: Tone }> = {
  administrada: { label: 'Administrada', tone: 'green' },
  pendente: { label: 'Pendente', tone: 'blue' },
  atrasada: { label: 'Atrasada', tone: 'red' },
};
