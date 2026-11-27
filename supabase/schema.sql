-- Extensiones necesarias
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- 1. Comercios (Tenants)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  business_name text not null,
  slug text unique not null,
  phone text,
  allow_station_choice boolean not null default true,
  subscription_plan text not null default 'trial',
  subscription_status text not null default 'active',
  created_at timestamptz not null default now()
);

-- 2. Estaciones / Profesionales
create table public.stations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Servicios
create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  name text not null,
  duration_minutes int not null check (duration_minutes >= 15),
  price numeric(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 4. Horarios de atención (station_id NULL = horario general del local)
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  station_id uuid references public.stations(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);

-- 5. Turnos (Appointments)
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  station_id uuid references public.stations(id) on delete restrict not null,
  service_id uuid references public.services(id) on delete restrict not null,
  client_name text not null,
  client_phone text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled')),
  reminder_sent boolean not null default false,
  created_at timestamptz not null default now(),
  -- Evita dobles reservas simultáneas en la misma estación y fecha
  exclude using gist (
    station_id with =,
    date with =,
    tsrange((date + start_time), (date + end_time), '[)') with &&
  ) where (status <> 'cancelled')
);

-- Índices para consultas rápidas de disponibilidad
create index idx_appointments_tenant_date on public.appointments(tenant_id, date);
create index idx_schedules_tenant_day on public.schedules(tenant_id, day_of_week);

-- Seguridad RLS (Row Level Security)
alter table public.tenants enable row level security;
alter table public.stations enable row level security;
alter table public.services enable row level security;
alter table public.schedules enable row level security;
alter table public.appointments enable row level security;

-- Lectura pública para la página de reservas
create policy "Public read tenants" on public.tenants for select using (true);
create policy "Public read stations" on public.stations for select using (is_active = true);
create policy "Public read services" on public.services for select using (is_active = true);
create policy "Public read schedules" on public.schedules for select using (true);
create policy "Public read active appointments" on public.appointments
  for select using (status <> 'cancelled');

-- Inserción pública de turnos (clientes sin cuenta)
create policy "Public insert appointments" on public.appointments
  for insert with check (status = 'confirmed');

-- Control total para el dueño autenticado
create policy "Owner manage tenant" on public.tenants for all using (auth.uid() = user_id);
create policy "Owner manage stations" on public.stations for all
  using (tenant_id in (select id from public.tenants where user_id = auth.uid()));
create policy "Owner manage services" on public.services for all
  using (tenant_id in (select id from public.tenants where user_id = auth.uid()));
create policy "Owner manage schedules" on public.schedules for all
  using (tenant_id in (select id from public.tenants where user_id = auth.uid()));
create policy "Owner manage appointments" on public.appointments for all
  using (tenant_id in (select id from public.tenants where user_id = auth.uid()));