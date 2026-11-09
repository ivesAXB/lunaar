-- ═══════════════════════════════════════════════════════════════
-- LUNAAR · Gestão de Animais & Hospedagem — esquema Supabase
--
-- • Login pelo Supabase Auth; cada usuário tem um registro em profiles.
-- • Só membros ativos da equipe (profiles.active) leem e gravam dados (RLS).
-- • Coordenação gerencia equipe e dados da organização.
-- • IDs são texto (UUID gerado pelo app) para casar com o front-end.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ─── Perfis (equipe) ───────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      citext not null unique,
  role       text not null default 'equipe' check (role in ('coordenacao', 'equipe', 'veterinaria')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Funções auxiliares para as políticas (security definer evita recursão no RLS).
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.is_coordinator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'coordenacao');
$$;

-- Cria o perfil quando um usuário é criado no Auth.
-- O primeiro usuário do sistema vira coordenação automaticamente.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  first_user boolean := not exists (select 1 from public.profiles);
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    new.email,
    case when first_user then 'coordenacao' else coalesce(new.raw_user_meta_data->>'role', 'equipe') end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Organização (linha única) ─────────────────────────────────
create table public.organization (
  id      smallint primary key default 1 check (id = 1),
  name    text not null,
  city    text,
  phone   text,
  pix_key text
);
insert into public.organization (id, name, city, phone, pix_key)
values (1, 'Associação LUNAAR', 'Cuiabá – MT', '(65) 99246-5672', '(65) 99246-5672');

-- ─── Abrigo ────────────────────────────────────────────────────
-- Localização → setor → ala → número do canil.
create table public.kennels (
  id        text primary key default gen_random_uuid()::text,
  location  text not null,
  sector    text not null,
  wing      text not null,
  number    text not null,
  kind      text not null check (kind in ('canil', 'gatil', 'enfermaria', 'lar_temporario')),
  capacity  smallint not null check (capacity between 1 and 50),
  notes     text,
  unique (location, sector, wing, number)
);

create table public.animals (
  id                 text primary key default gen_random_uuid()::text,
  name               text not null,
  species            text not null check (species in ('cao', 'gato')),
  breed              text not null default 'SRD',
  sex                text not null check (sex in ('macho', 'femea')),
  color              text not null,
  weight_kg          numeric(5,2) check (weight_kg > 0),
  birth_date         date,
  age_approx_months  smallint check (age_approx_months >= 0),
  size               text not null check (size in ('pequeno', 'medio', 'grande')),
  status             text not null default 'observacao'
                       check (status in ('disponivel', 'tratamento', 'observacao', 'reservado', 'adotado', 'atencao')),
  neutered           boolean not null default false,
  photo              text,
  temperament        text,
  intake_date        date not null,
  origin             text not null check (origin in ('resgate', 'abandono', 'entrega_voluntaria', 'transferencia', 'nascido_abrigo')),
  origin_notes       text,
  kennel_id          text references public.kennels(id) on delete set null,
  responsible_id     uuid references public.profiles(id) on delete set null,
  diseases           text,
  allergies          text,
  vet_notes          text,
  last_vet_visit     date,
  adopter_name       text,
  adopter_phone      text,
  adopter_cpf        text,
  adoption_date      date,
  adoption_notes     text,
  updated_at         timestamptz not null default now(),
  constraint adoption_complete check (status <> 'adotado' or (adopter_name is not null and adoption_date is not null))
);
create index animals_status_idx on public.animals (status);
create index animals_kennel_idx on public.animals (kennel_id);

create table public.animal_treatments (
  id          text primary key default gen_random_uuid()::text,
  animal_id   text not null references public.animals(id) on delete cascade,
  title       text not null,
  medication  text,
  dosage      text,
  start_date  date not null,
  end_date    date,
  status      text not null default 'ativo' check (status in ('pendente', 'ativo', 'concluido')),
  vet         text,
  notes       text
);
create index animal_treatments_animal_idx on public.animal_treatments (animal_id);

create table public.animal_vaccines (
  id          text primary key default gen_random_uuid()::text,
  animal_id   text not null references public.animals(id) on delete cascade,
  name        text not null,
  applied_on  date not null,
  next_due    date,
  batch       text,
  vet         text
);
create index animal_vaccines_animal_idx on public.animal_vaccines (animal_id);

create table public.animal_health_records (
  id           text primary key default gen_random_uuid()::text,
  animal_id    text not null references public.animals(id) on delete cascade,
  record_date  date not null,
  type         text not null check (type in ('consulta', 'exame', 'cirurgia', 'observacao')),
  title        text not null,
  description  text,
  vet          text
);
create index animal_health_records_animal_idx on public.animal_health_records (animal_id);

create table public.animal_events (
  id         text primary key default gen_random_uuid()::text,
  animal_id  text not null references public.animals(id) on delete cascade,
  at         timestamptz not null default now(),
  type       text not null check (type in ('entrada', 'status', 'canil', 'adocao', 'nota', 'saude')),
  text       text not null,
  user_id    uuid references public.profiles(id) on delete set null
);
create index animal_events_animal_idx on public.animal_events (animal_id, at desc);

-- ─── Hotelzinho ────────────────────────────────────────────────
create table public.clients (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  cpf         text unique not null,
  phone       text not null,
  whatsapp    text,
  email       text,
  street      text not null,
  number      text not null,
  complement  text,
  district    text not null,
  city        text not null,
  state       text not null,
  zip         text,
  notes       text,
  created_at  date not null default current_date
);

create table public.client_pets (
  id           text primary key default gen_random_uuid()::text,
  client_id    text not null references public.clients(id) on delete restrict,
  name         text not null,
  species      text not null check (species in ('cao', 'gato')),
  breed        text not null,
  sex          text not null check (sex in ('macho', 'femea')),
  color        text not null,
  weight_kg    numeric(5,2) check (weight_kg > 0),
  age_years    smallint check (age_years between 0 and 30),
  size         text not null check (size in ('pequeno', 'medio', 'grande')),
  photo        text,
  vaccines     text,
  allergies    text,
  medications  text,
  feeding      text,
  behavior     text,
  notes        text
);
create index client_pets_client_idx on public.client_pets (client_id);

create table public.accommodations (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  description text,
  species     text not null check (species in ('cao', 'gato', 'ambos')),
  capacity    smallint not null check (capacity >= 1),
  daily_rate  numeric(8,2) not null check (daily_rate >= 0)
);

create table public.bookings (
  id                text primary key default gen_random_uuid()::text,
  code              text unique not null,
  pet_id            text not null references public.client_pets(id) on delete restrict,
  accommodation_id  text not null references public.accommodations(id),
  check_in          date not null,
  check_out         date not null,
  status            text not null default 'reserva' check (status in ('reserva', 'confirmada', 'hospedado', 'finalizada', 'cancelada')),
  daily_rate        numeric(8,2) not null,
  special_needs     text,
  notes             text,
  cancel_reason     text,
  created_at        timestamptz not null default now(),
  constraint booking_period check (check_out > check_in)
);
create index bookings_pet_idx on public.bookings (pet_id);
create index bookings_period_idx on public.bookings (accommodation_id, check_in, check_out);

create table public.booking_checkins (
  booking_id       text primary key references public.bookings(id) on delete cascade,
  at               timestamptz not null,
  user_id          uuid references public.profiles(id) on delete set null,
  condition        text not null check (condition in ('boa', 'regular', 'atencao')),
  condition_notes  text,
  items            text[] not null default '{}',
  feeding          text,
  medications      text,
  notes            text
);

create table public.booking_checkouts (
  booking_id       text primary key references public.bookings(id) on delete cascade,
  at               timestamptz not null,
  user_id          uuid references public.profiles(id) on delete set null,
  condition        text not null check (condition in ('boa', 'regular', 'atencao')),
  condition_notes  text,
  pendencies       text,
  notes            text,
  final_value      numeric(10,2) not null check (final_value >= 0)
);

-- Acomodações padrão do hotelzinho
insert into public.accommodations (id, name, description, species, capacity, daily_rate) values
  ('ac1', 'Suíte individual', 'Espaço fechado para um cão, com cama e ventilador.', 'cao', 6, 85),
  ('ac2', 'Baia coletiva', 'Para cães sociáveis de pequeno e médio porte.', 'cao', 4, 60),
  ('ac3', 'Gatil', 'Nichos individuais em ambiente separado dos cães.', 'gato', 4, 55);

-- ─── Segurança (RLS) ───────────────────────────────────────────
alter table public.profiles              enable row level security;
alter table public.organization          enable row level security;
alter table public.kennels               enable row level security;
alter table public.animals               enable row level security;
alter table public.animal_treatments     enable row level security;
alter table public.animal_vaccines       enable row level security;
alter table public.animal_health_records enable row level security;
alter table public.animal_events         enable row level security;
alter table public.clients               enable row level security;
alter table public.client_pets           enable row level security;
alter table public.accommodations        enable row level security;
alter table public.bookings              enable row level security;
alter table public.booking_checkins      enable row level security;
alter table public.booking_checkouts     enable row level security;

-- Perfis: a equipe vê todos; cada um vê o próprio (para checar se está ativo);
-- só a coordenação altera (função, nome, ativo). Criação é feita pelo trigger/API.
create policy profiles_select on public.profiles for select using (public.is_staff() or id = auth.uid());
create policy profiles_update on public.profiles for update using (public.is_coordinator()) with check (public.is_coordinator());

create policy org_select on public.organization for select using (public.is_staff());
create policy org_update on public.organization for update using (public.is_coordinator()) with check (public.is_coordinator());

-- Demais tabelas: qualquer membro ativo da equipe lê e grava.
do $$
declare t text;
begin
  foreach t in array array['kennels', 'animals', 'animal_treatments', 'animal_vaccines', 'animal_health_records',
                           'animal_events', 'clients', 'client_pets', 'accommodations', 'bookings',
                           'booking_checkins', 'booking_checkouts']
  loop
    execute format('create policy %I on public.%I for all using (public.is_staff()) with check (public.is_staff())', t || '_staff', t);
  end loop;
end $$;

-- ─── Fotos (Storage) ───────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy photos_read on storage.objects for select using (bucket_id = 'photos');
create policy photos_insert on storage.objects for insert with check (bucket_id = 'photos' and public.is_staff());
create policy photos_update on storage.objects for update using (bucket_id = 'photos' and public.is_staff());
create policy photos_delete on storage.objects for delete using (bucket_id = 'photos' and public.is_staff());
