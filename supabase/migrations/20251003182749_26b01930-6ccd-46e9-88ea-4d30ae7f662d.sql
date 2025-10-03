-- 1) Create a dedicated table to store sensitive wallet addresses, protected by RLS
create table public.profile_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.profile_wallets enable row level security;

-- Policies: only the owner can access and modify their wallet record
create policy "Users can view own wallet" 
  on public.profile_wallets for select 
  using (auth.uid() = user_id);

create policy "Users can insert own wallet" 
  on public.profile_wallets for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own wallet" 
  on public.profile_wallets for update 
  using (auth.uid() = user_id);

-- Keep updated_at in sync
create trigger update_profile_wallets_updated_at
before update on public.profile_wallets
for each row execute function public.update_updated_at_column();

-- 2) Migrate existing wallet data from public.profiles into the new secure table
insert into public.profile_wallets (user_id, wallet_address)
select id as user_id, wallet_address
from public.profiles
where wallet_address is not null
on conflict (user_id) do update
  set wallet_address = excluded.wallet_address,
      updated_at = now();

-- 3) Null out wallet addresses in public.profiles to prevent public exposure
update public.profiles
set wallet_address = null
where wallet_address is not null;