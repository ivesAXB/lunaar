-- ═══════════════════════════════════════════════════════════════
-- LUNAAR · Gestão de Animais & Hospedagem
-- Esquema relacional (PostgreSQL 15+)
--
-- Espelha src/data/types.ts. A interface hoje usa dados locais
-- (src/data/store.tsx); este arquivo é o contrato do backend real.
--
-- Decisões:
-- • animals (ONG) e client_pets (hotelzinho) são tabelas separadas:
--   ciclos de vida, regras e donos diferentes.
-- • bookings referencia só o pet; o cliente vem de client_pets.client_id
--   (sem duplicar client_id na hospedagem).
-- • Check-in e check-out são 1:1 com a hospedagem (PK = booking_id).
-- • Nada de exclusão física de histórico: usuários são desativados;
--   clientes/pets com hospedagens não podem ser apagados (ON DELETE RESTRICT).
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ─── Tipos ─────────────────────────────────────────────────────
CREATE TYPE user_role        AS ENUM ('coordenacao', 'equipe', 'veterinaria');
CREATE TYPE species          AS ENUM ('cao', 'gato');
CREATE TYPE sex              AS ENUM ('macho', 'femea');
CREATE TYPE animal_size      AS ENUM ('pequeno', 'medio', 'grande');
CREATE TYPE kennel_kind      AS ENUM ('canil', 'gatil', 'enfermaria', 'lar_temporario');
CREATE TYPE animal_status    AS ENUM ('disponivel', 'tratamento', 'observacao', 'reservado', 'adotado', 'atencao');
CREATE TYPE animal_origin    AS ENUM ('resgate', 'abandono', 'entrega_voluntaria', 'transferencia', 'nascido_abrigo');
CREATE TYPE treatment_status AS ENUM ('pendente', 'ativo', 'concluido');
CREATE TYPE health_record_type AS ENUM ('consulta', 'exame', 'cirurgia', 'observacao');
CREATE TYPE animal_event_type  AS ENUM ('entrada', 'status', 'canil', 'adocao', 'nota', 'saude');
CREATE TYPE booking_status   AS ENUM ('reserva', 'confirmada', 'hospedado', 'finalizada', 'cancelada');
CREATE TYPE pet_condition    AS ENUM ('boa', 'regular', 'atencao');

-- ─── Organização e usuários ────────────────────────────────────
CREATE TABLE organization (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- linha única
  name        text NOT NULL,
  city        text,
  phone       text,
  pix_key     text
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         citext UNIQUE NOT NULL,
  password_hash text NOT NULL,            -- argon2/bcrypt, nunca a senha
  role          user_role NOT NULL DEFAULT 'equipe',
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── Abrigo ────────────────────────────────────────────────────
-- Localização → setor → ala → número do canil.
-- Ex.: Sede Coxipó · Setor Cães · Ala A · Canil 01 (etiqueta "A-01").
CREATE TABLE kennels (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location  text NOT NULL,                 -- unidade/endereço
  sector    text NOT NULL,                 -- Cães, Gatos, Clínico…
  wing      varchar(3) NOT NULL,           -- ala
  number    varchar(4) NOT NULL,           -- número do canil dentro da ala
  kind      kennel_kind NOT NULL,
  capacity  smallint NOT NULL CHECK (capacity BETWEEN 1 AND 50),
  notes     text,
  UNIQUE (location, sector, wing, number)
);

CREATE TABLE animals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  species            species NOT NULL,
  breed              text NOT NULL DEFAULT 'SRD',
  sex                sex NOT NULL,
  color              text NOT NULL,
  weight_kg          numeric(5,2) CHECK (weight_kg > 0),
  birth_date         date,
  age_approx_months  smallint CHECK (age_approx_months >= 0),
  size               animal_size NOT NULL,
  status             animal_status NOT NULL DEFAULT 'observacao',
  neutered           boolean NOT NULL DEFAULT false,
  photo_url          text,
  temperament        text,
  intake_date        date NOT NULL,
  origin             animal_origin NOT NULL,
  origin_notes       text,
  kennel_id          uuid REFERENCES kennels(id) ON DELETE SET NULL,
  responsible_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  diseases           text,
  allergies          text,
  vet_notes          text,
  last_vet_visit     date,
  -- adoção (1:1, preenchida quando status = 'adotado')
  adopter_name       text,
  adopter_phone      text,
  adopter_cpf        char(14),
  adoption_date      date,
  adoption_notes     text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adoption_complete CHECK (
    status <> 'adotado' OR (adopter_name IS NOT NULL AND adoption_date IS NOT NULL)
  ),
  CONSTRAINT adopted_has_no_kennel CHECK (status <> 'adotado' OR kennel_id IS NULL)
);
CREATE INDEX animals_status_idx ON animals (status);
CREATE INDEX animals_kennel_idx ON animals (kennel_id);

CREATE TABLE animal_treatments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id   uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  title       text NOT NULL,
  medication  text,
  dosage      text,
  start_date  date NOT NULL,
  end_date    date CHECK (end_date IS NULL OR end_date >= start_date),
  status      treatment_status NOT NULL DEFAULT 'ativo',
  vet         text,
  notes       text
);
CREATE INDEX animal_treatments_open_idx ON animal_treatments (animal_id) WHERE status <> 'concluido';

CREATE TABLE animal_vaccines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id   uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  name        text NOT NULL,
  applied_on  date NOT NULL,
  next_due    date CHECK (next_due IS NULL OR next_due >= applied_on),
  batch       text,
  vet         text
);
CREATE INDEX animal_vaccines_due_idx ON animal_vaccines (next_due);

CREATE TABLE animal_health_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id    uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  record_date  date NOT NULL,
  type         health_record_type NOT NULL,
  title        text NOT NULL,
  description  text,
  vet          text
);

-- Linha do tempo gerada pelas ações do sistema (auditoria leve).
CREATE TABLE animal_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id  uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  at         timestamptz NOT NULL DEFAULT now(),
  type       animal_event_type NOT NULL,
  text       text NOT NULL,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX animal_events_animal_idx ON animal_events (animal_id, at DESC);

-- ─── Hotelzinho ────────────────────────────────────────────────
CREATE TABLE clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  cpf         char(14) UNIQUE NOT NULL,   -- 000.000.000-00, validado na aplicação
  phone       text NOT NULL,
  whatsapp    text,
  email       citext,
  street      text NOT NULL,
  number      text NOT NULL,
  complement  text,
  district    text NOT NULL,
  city        text NOT NULL,
  state       char(2) NOT NULL,
  zip         char(9),
  notes       text,
  created_at  date NOT NULL DEFAULT current_date
);

CREATE TABLE client_pets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  name         text NOT NULL,
  species      species NOT NULL,
  breed        text NOT NULL,
  sex          sex NOT NULL,
  color        text NOT NULL,
  weight_kg    numeric(5,2) CHECK (weight_kg > 0),
  age_years    smallint CHECK (age_years BETWEEN 0 AND 30),
  size         animal_size NOT NULL,
  photo_url    text,
  vaccines     text,
  allergies    text,
  medications  text,
  feeding      text,
  behavior     text,
  notes        text
);
CREATE INDEX client_pets_client_idx ON client_pets (client_id);

CREATE TABLE accommodations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  species     text NOT NULL CHECK (species IN ('cao', 'gato', 'ambos')),
  capacity    smallint NOT NULL CHECK (capacity >= 1),
  daily_rate  numeric(8,2) NOT NULL CHECK (daily_rate >= 0)
);

CREATE TABLE bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text UNIQUE NOT NULL,         -- H-1041…
  pet_id            uuid NOT NULL REFERENCES client_pets(id) ON DELETE RESTRICT,
  accommodation_id  uuid NOT NULL REFERENCES accommodations(id),
  check_in          date NOT NULL,
  check_out         date NOT NULL,
  status            booking_status NOT NULL DEFAULT 'reserva',
  daily_rate        numeric(8,2) NOT NULL,        -- congelada no momento da reserva
  special_needs     text,
  notes             text,
  cancel_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_period CHECK (check_out > check_in)
);
CREATE INDEX bookings_period_idx ON bookings (accommodation_id, check_in, check_out)
  WHERE status IN ('reserva', 'confirmada', 'hospedado');
CREATE INDEX bookings_pet_idx ON bookings (pet_id);

CREATE TABLE booking_checkins (
  booking_id       uuid PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  at               timestamptz NOT NULL,
  user_id          uuid NOT NULL REFERENCES users(id),
  condition        pet_condition NOT NULL,
  condition_notes  text,
  items            text[] NOT NULL DEFAULT '{}',
  feeding          text,
  medications      text,
  notes            text,
  CONSTRAINT checkin_attention_needs_notes CHECK (condition <> 'atencao' OR condition_notes IS NOT NULL)
);

CREATE TABLE booking_checkouts (
  booking_id       uuid PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  at               timestamptz NOT NULL,
  user_id          uuid NOT NULL REFERENCES users(id),
  condition        pet_condition NOT NULL,
  condition_notes  text,
  pendencies       text,
  notes            text,
  final_value      numeric(10,2) NOT NULL CHECK (final_value >= 0)
);

-- Disponibilidade: a checagem de lotação por dia é feita na aplicação
-- (selectors.peakOccupancy). No backend, repetir a regra dentro da
-- transação de criação da reserva (SELECT … FOR UPDATE na acomodação).
-- ═══════════════════════════════════════════════════════════════
-- LUNAAR · Gestão de Animais & Hospedagem
-- Esquema relacional (PostgreSQL 15+)
--
-- Espelha src/data/types.ts. A interface hoje usa dados locais
-- (src/data/store.tsx); este arquivo é o contrato do backend real.
--
-- Decisões:
-- • animals (ONG) e client_pets (hotelzinho) são tabelas separadas:
--   ciclos de vida, regras e donos diferentes.
-- • bookings referencia só o pet; o cliente vem de client_pets.client_id
--   (sem duplicar client_id na hospedagem).
-- • Check-in e check-out são 1:1 com a hospedagem (PK = booking_id).
-- • Nada de exclusão física de histórico: usuários são desativados;
--   clientes/pets com hospedagens não podem ser apagados (ON DELETE RESTRICT).
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ─── Tipos ─────────────────────────────────────────────────────
CREATE TYPE user_role        AS ENUM ('coordenacao', 'equipe', 'veterinaria');
CREATE TYPE species          AS ENUM ('cao', 'gato');
CREATE TYPE sex              AS ENUM ('macho', 'femea');
CREATE TYPE animal_size      AS ENUM ('pequeno', 'medio', 'grande');
CREATE TYPE kennel_kind      AS ENUM ('canil', 'gatil', 'enfermaria', 'lar_temporario');
CREATE TYPE animal_status    AS ENUM ('disponivel', 'tratamento', 'observacao', 'reservado', 'adotado', 'atencao');
CREATE TYPE animal_origin    AS ENUM ('resgate', 'abandono', 'entrega_voluntaria', 'transferencia', 'nascido_abrigo');
CREATE TYPE treatment_status AS ENUM ('pendente', 'ativo', 'concluido');
CREATE TYPE health_record_type AS ENUM ('consulta', 'exame', 'cirurgia', 'observacao');
CREATE TYPE animal_event_type  AS ENUM ('entrada', 'status', 'canil', 'adocao', 'nota', 'saude');
CREATE TYPE booking_status   AS ENUM ('reserva', 'confirmada', 'hospedado', 'finalizada', 'cancelada');
CREATE TYPE pet_condition    AS ENUM ('boa', 'regular', 'atencao');

-- ─── Organização e usuários ────────────────────────────────────
CREATE TABLE organization (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- linha única
  name        text NOT NULL,
  city        text,
  phone       text,
  pix_key     text
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         citext UNIQUE NOT NULL,
  password_hash text NOT NULL,            -- argon2/bcrypt, nunca a senha
  role          user_role NOT NULL DEFAULT 'equipe',
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── Abrigo ────────────────────────────────────────────────────
-- Localização → setor → ala → número do canil.
-- Ex.: Sede Coxipó · Setor Cães · Ala A · Canil 01 (etiqueta "A-01").
CREATE TABLE kennels (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location  text NOT NULL,                 -- unidade/endereço
  sector    text NOT NULL,                 -- Cães, Gatos, Clínico…
  wing      varchar(3) NOT NULL,           -- ala
  number    varchar(4) NOT NULL,           -- número do canil dentro da ala
  kind      kennel_kind NOT NULL,
  capacity  smallint NOT NULL CHECK (capacity BETWEEN 1 AND 50),
  notes     text,
  UNIQUE (location, sector, wing, number)
);

CREATE TABLE animals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  species            species NOT NULL,
  breed              text NOT NULL DEFAULT 'SRD',
  sex                sex NOT NULL,
  color              text NOT NULL,
  weight_kg          numeric(5,2) CHECK (weight_kg > 0),
  birth_date         date,
  age_approx_months  smallint CHECK (age_approx_months >= 0),
  size               animal_size NOT NULL,
  status             animal_status NOT NULL DEFAULT 'observacao',
  neutered           boolean NOT NULL DEFAULT false,
  photo_url          text,
  temperament        text,
  intake_date        date NOT NULL,
  origin             animal_origin NOT NULL,
  origin_notes       text,
  kennel_id          uuid REFERENCES kennels(id) ON DELETE SET NULL,
  responsible_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  diseases           text,
  allergies          text,
  vet_notes          text,
  last_vet_visit     date,
  -- adoção (1:1, preenchida quando status = 'adotado')
  adopter_name       text,
  adopter_phone      text,
  adopter_cpf        char(14),
  adoption_date      date,
  adoption_notes     text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adoption_complete CHECK (
    status <> 'adotado' OR (adopter_name IS NOT NULL AND adoption_date IS NOT NULL)
  ),
  CONSTRAINT adopted_has_no_kennel CHECK (status <> 'adotado' OR kennel_id IS NULL)
);
CREATE INDEX animals_status_idx ON animals (status);
CREATE INDEX animals_kennel_idx ON animals (kennel_id);

CREATE TABLE animal_treatments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id   uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  title       text NOT NULL,
  medication  text,
  dosage      text,
  start_date  date NOT NULL,
  end_date    date CHECK (end_date IS NULL OR end_date >= start_date),
  status      treatment_status NOT NULL DEFAULT 'ativo',
  vet         text,
  notes       text
);
CREATE INDEX animal_treatments_open_idx ON animal_treatments (animal_id) WHERE status <> 'concluido';

CREATE TABLE animal_vaccines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id   uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  name        text NOT NULL,
  applied_on  date NOT NULL,
  next_due    date CHECK (next_due IS NULL OR next_due >= applied_on),
  batch       text,
  vet         text
);
CREATE INDEX animal_vaccines_due_idx ON animal_vaccines (next_due);

CREATE TABLE animal_health_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id    uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  record_date  date NOT NULL,
  type         health_record_type NOT NULL,
  title        text NOT NULL,
  description  text,
  vet          text
);

-- Linha do tempo gerada pelas ações do sistema (auditoria leve).
CREATE TABLE animal_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id  uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  at         timestamptz NOT NULL DEFAULT now(),
  type       animal_event_type NOT NULL,
  text       text NOT NULL,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX animal_events_animal_idx ON animal_events (animal_id, at DESC);

-- ─── Hotelzinho ────────────────────────────────────────────────
CREATE TABLE clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  cpf         char(14) UNIQUE NOT NULL,   -- 000.000.000-00, validado na aplicação
  phone       text NOT NULL,
  whatsapp    text,
  email       citext,
  street      text NOT NULL,
  number      text NOT NULL,
  complement  text,
  district    text NOT NULL,
  city        text NOT NULL,
  state       char(2) NOT NULL,
  zip         char(9),
  notes       text,
  created_at  date NOT NULL DEFAULT current_date
);

CREATE TABLE client_pets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  name         text NOT NULL,
  species      species NOT NULL,
  breed        text NOT NULL,
  sex          sex NOT NULL,
  color        text NOT NULL,
  weight_kg    numeric(5,2) CHECK (weight_kg > 0),
  age_years    smallint CHECK (age_years BETWEEN 0 AND 30),
  size         animal_size NOT NULL,
  photo_url    text,
  vaccines     text,
  allergies    text,
  medications  text,
  feeding      text,
  behavior     text,
  notes        text
);
CREATE INDEX client_pets_client_idx ON client_pets (client_id);

CREATE TABLE accommodations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  species     text NOT NULL CHECK (species IN ('cao', 'gato', 'ambos')),
  capacity    smallint NOT NULL CHECK (capacity >= 1),
  daily_rate  numeric(8,2) NOT NULL CHECK (daily_rate >= 0)
);

CREATE TABLE bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text UNIQUE NOT NULL,         -- H-1041…
  pet_id            uuid NOT NULL REFERENCES client_pets(id) ON DELETE RESTRICT,
  accommodation_id  uuid NOT NULL REFERENCES accommodations(id),
  check_in          date NOT NULL,
  check_out         date NOT NULL,
  status            booking_status NOT NULL DEFAULT 'reserva',
  daily_rate        numeric(8,2) NOT NULL,        -- congelada no momento da reserva
  special_needs     text,
  notes             text,
  cancel_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_period CHECK (check_out > check_in)
);
CREATE INDEX bookings_period_idx ON bookings (accommodation_id, check_in, check_out)
  WHERE status IN ('reserva', 'confirmada', 'hospedado');
CREATE INDEX bookings_pet_idx ON bookings (pet_id);

CREATE TABLE booking_checkins (
  booking_id       uuid PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  at               timestamptz NOT NULL,
  user_id          uuid NOT NULL REFERENCES users(id),
  condition        pet_condition NOT NULL,
  condition_notes  text,
  items            text[] NOT NULL DEFAULT '{}',
  feeding          text,
  medications      text,
  notes            text,
  CONSTRAINT checkin_attention_needs_notes CHECK (condition <> 'atencao' OR condition_notes IS NOT NULL)
);

CREATE TABLE booking_checkouts (
  booking_id       uuid PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  at               timestamptz NOT NULL,
  user_id          uuid NOT NULL REFERENCES users(id),
  condition        pet_condition NOT NULL,
  condition_notes  text,
  pendencies       text,
  notes            text,
  final_value      numeric(10,2) NOT NULL CHECK (final_value >= 0)
);

-- Disponibilidade: a checagem de lotação por dia é feita na aplicação
-- (selectors.peakOccupancy). No backend, repetir a regra dentro da
-- transação de criação da reserva (SELECT … FOR UPDATE na acomodação).


-- ═══ Módulos trazidos do ONG-Lunar-Site: ver supabase/migrations/20261108000000_modulos_ong.sql ═══
-- (unidade ONG/Recanto em animals e kennels, times em animal_treatments,
--  medication_doses, tasks, animal_weights, animal_documents e bucket privado documents)
