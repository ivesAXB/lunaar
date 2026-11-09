/**
 * Modelo de domínio da LUNAAR.
 *
 * Animais da ONG (Animal) e pets de clientes (ClientPet) são entidades
 * distintas por design: têm ciclos de vida diferentes (acolhimento/adoção
 * vs. hospedagem temporária) e nunca devem ser misturados.
 *
 * Datas são strings ISO: "yyyy-MM-dd" para datas e ISO completo para
 * momentos (check-in/out). O espelho relacional está em db/schema.sql.
 */

export type ID = string;
export type ISODate = string;
export type ISODateTime = string;

export type Species = 'cao' | 'gato';
export type Sex = 'macho' | 'femea';
export type Size = 'pequeno' | 'medio' | 'grande';

export type UserRole = 'coordenacao' | 'equipe' | 'veterinaria';

/** Unidade da instituição. Animais e canis pertencem a uma delas. */
export type Base = 'ong' | 'recanto';

export interface User {
  id: ID;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  /** Somente no mock. No backend real a senha fica como hash no servidor. */
  password?: string;
}

export type KennelKind = 'canil' | 'gatil' | 'enfermaria' | 'lar_temporario';

/**
 * Espaço físico onde um animal da ONG fica alojado.
 * Hierarquia: localização (unidade) → setor → ala → número do canil.
 */
export interface Kennel {
  id: ID;
  location: string;
  sector: string;
  wing: string;
  number: string;
  base: Base;
  kind: KennelKind;
  capacity: number;
  notes?: string;
}

// ─── Animais da ONG ─────────────────────────────────────────────

export type AnimalStatus =
  | 'disponivel'
  | 'tratamento'
  | 'observacao'
  | 'reservado'
  | 'adotado'
  | 'atencao';

export type AnimalOrigin = 'resgate' | 'abandono' | 'entrega_voluntaria' | 'transferencia' | 'nascido_abrigo';

export interface Adoption {
  adopterName: string;
  adopterPhone: string;
  adopterCpf?: string;
  date: ISODate;
  notes?: string;
}

export interface Animal {
  id: ID;
  base: Base;
  name: string;
  species: Species;
  breed: string;
  sex: Sex;
  color: string;
  weightKg?: number;
  /** Quando exata; caso contrário usa-se ageApproxMonths. */
  birthDate?: ISODate;
  ageApproxMonths?: number;
  size: Size;
  status: AnimalStatus;
  neutered: boolean;
  photo?: string;
  intakeDate: ISODate;
  kennelId?: ID;
  origin: AnimalOrigin;
  originNotes?: string;
  responsibleId?: ID;
  diseases?: string;
  allergies?: string;
  vetNotes?: string;
  lastVetVisit?: ISODate;
  adoption?: Adoption;
  temperament?: string;
  updatedAt: ISODateTime;
}

export type TreatmentStatus = 'pendente' | 'ativo' | 'concluido';

export interface AnimalTreatment {
  id: ID;
  animalId: ID;
  title: string;
  medication?: string;
  dosage?: string;
  startDate: ISODate;
  endDate?: ISODate;
  status: TreatmentStatus;
  vet?: string;
  notes?: string;
  /** Horários diários da medicação ("08:00"). Vazio: sem agenda de doses. */
  times: string[];
}

/** Dose administrada de um tratamento com horários (agenda de doses). */
export interface MedicationDose {
  id: ID;
  treatmentId: ID;
  animalId: ID;
  scheduledOn: ISODate;
  scheduledTime: string;
  givenAt: ISODateTime;
  userId?: ID;
  notes?: string;
}

export interface AnimalWeight {
  id: ID;
  animalId: ID;
  measuredOn: ISODate;
  weightKg: number;
  notes?: string;
  userId?: ID;
}

export type DocumentKind = 'exame' | 'receituario' | 'laudo' | 'termo' | 'foto' | 'documento';

export interface AnimalDocument {
  id: ID;
  animalId: ID;
  name: string;
  kind: DocumentKind;
  /** Supabase: caminho no bucket "documents". Demonstração: data URL. */
  path: string;
  mime?: string;
  sizeKb?: number;
  uploadedAt: ISODateTime;
  userId?: ID;
}

export type TaskStatus = 'pendente' | 'em_andamento' | 'concluida';
export type TaskPriority = 'baixa' | 'normal' | 'alta' | 'critica';
export type TaskCategory = 'geral' | 'medicacao' | 'exame' | 'higiene' | 'monitoramento' | 'alta';

export interface Task {
  id: ID;
  title: string;
  animalId?: ID;
  base: Base;
  assigneeId?: ID;
  priority: TaskPriority;
  category: TaskCategory;
  dueAt: ISODateTime;
  status: TaskStatus;
  notes?: string;
  createdBy?: ID;
  createdAt: ISODateTime;
  doneAt?: ISODateTime;
}

export interface AnimalVaccine {
  id: ID;
  animalId: ID;
  name: string;
  date: ISODate;
  nextDue?: ISODate;
  vet?: string;
  batch?: string;
}

export type HealthRecordType = 'consulta' | 'exame' | 'cirurgia' | 'observacao';

export interface AnimalHealthRecord {
  id: ID;
  animalId: ID;
  date: ISODate;
  type: HealthRecordType;
  title: string;
  description?: string;
  vet?: string;
}

export type AnimalEventType = 'entrada' | 'status' | 'canil' | 'adocao' | 'nota' | 'saude';

/** Linha do tempo do animal: registrada automaticamente pelas ações do sistema. */
export interface AnimalEvent {
  id: ID;
  animalId: ID;
  at: ISODateTime;
  type: AnimalEventType;
  text: string;
  userId?: ID;
}

// ─── Hotelzinho ─────────────────────────────────────────────────

export interface Client {
  id: ID;
  name: string;
  cpf: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string;
    zip: string;
  };
  notes?: string;
  createdAt: ISODate;
}

export interface ClientPet {
  id: ID;
  clientId: ID;
  name: string;
  species: Species;
  breed: string;
  sex: Sex;
  color: string;
  weightKg?: number;
  ageYears?: number;
  size: Size;
  photo?: string;
  vaccines?: string;
  allergies?: string;
  medications?: string;
  feeding?: string;
  behavior?: string;
  notes?: string;
}

export interface Accommodation {
  id: ID;
  name: string;
  description: string;
  species: Species | 'ambos';
  capacity: number;
  dailyRate: number;
}

export type BookingStatus = 'reserva' | 'confirmada' | 'hospedado' | 'finalizada' | 'cancelada';

/** A hospedagem referencia só o pet; o cliente é obtido via pet.clientId. */
export interface Booking {
  id: ID;
  code: string;
  petId: ID;
  accommodationId: ID;
  checkIn: ISODate;
  checkOut: ISODate;
  status: BookingStatus;
  notes?: string;
  specialNeeds?: string;
  dailyRate: number;
  createdAt: ISODateTime;
  cancelReason?: string;
}

export type PetCondition = 'boa' | 'regular' | 'atencao';

export interface BookingCheckin {
  bookingId: ID;
  at: ISODateTime;
  userId: ID;
  condition: PetCondition;
  conditionNotes?: string;
  items: string[];
  feeding?: string;
  medications?: string;
  notes?: string;
}

export interface BookingCheckout {
  bookingId: ID;
  at: ISODateTime;
  userId: ID;
  condition: PetCondition;
  conditionNotes?: string;
  pendencies?: string;
  notes?: string;
  finalValue: number;
}

export interface Organization {
  name: string;
  city: string;
  phone: string;
  pix: string;
}

export interface Database {
  version: number;
  organization: Organization;
  users: User[];
  kennels: Kennel[];
  animals: Animal[];
  treatments: AnimalTreatment[];
  vaccines: AnimalVaccine[];
  healthRecords: AnimalHealthRecord[];
  events: AnimalEvent[];
  doses: MedicationDose[];
  weights: AnimalWeight[];
  documents: AnimalDocument[];
  tasks: Task[];
  clients: Client[];
  pets: ClientPet[];
  accommodations: Accommodation[];
  bookings: Booking[];
  checkins: BookingCheckin[];
  checkouts: BookingCheckout[];
}
