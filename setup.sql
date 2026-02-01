-- Run this in your Supabase SQL Editor
-- Updated: 15 trends with seed data starting at 180 voters

-- Drop old tables
drop table if exists votes cascade;
drop table if exists trends cascade;
drop table if exists voter_sessions cascade;
drop table if exists trend_stats cascade;

-- Voter sessions: one row per completed vote
create table if not exists voter_sessions (
  id bigint generated always as identity primary key,
  session_id text not null,
  votes jsonb not null,
  top3 jsonb not null default '[]',
  excited_count integer not null default 0,
  completed_at timestamptz default now()
);

-- Aggregated trend stats
create table if not exists trend_stats (
  id bigint generated always as identity primary key,
  name text unique not null,
  excited_count integer default 0,
  meh_count integer default 0,
  skip_count integer default 0,
  first_pick_count integer default 0,
  second_pick_count integer default 0,
  third_pick_count integer default 0,
  total_voters integer default 0
);

-- Enable RLS
alter table voter_sessions enable row level security;
alter table trend_stats enable row level security;

-- Policies
do $$ begin
  if not exists (select 1 from pg_policies where tablename='voter_sessions' and policyname='anon_insert_sessions') then
    create policy "anon_insert_sessions" on voter_sessions for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='voter_sessions' and policyname='anon_read_sessions') then
    create policy "anon_read_sessions" on voter_sessions for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='trend_stats' and policyname='anon_read_stats') then
    create policy "anon_read_stats" on trend_stats for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='trend_stats' and policyname='anon_update_stats') then
    create policy "anon_update_stats" on trend_stats for update using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='trend_stats' and policyname='anon_insert_stats') then
    create policy "anon_insert_stats" on trend_stats for insert with check (true);
  end if;
end $$;

-- Seed 15 trends with initial data (180 base voters)
-- Counts are: excited = rate * 180, first_pick = rate * 180
-- total_voters = 180 for all
insert into trend_stats (name, excited_count, meh_count, skip_count, first_pick_count, total_voters) values
  ('Tokenized Equities',               133, 32, 15, 32, 180),
  ('Onchain Vaults',                    128, 36, 16, 25, 180),
  ('Prediction Markets',                124, 38, 18, 22, 180),
  ('Equity Perpetuals',                 115, 43, 22, 16, 180),
  ('Stablecoin-linked Cards',           112, 45, 23, 14, 180),
  ('Onchain Privacy',                   104, 49, 27, 13, 180),
  ('Stablecoin-based Cross-Border Payments', 101, 51, 28, 11, 180),
  ('Tokenized Collateral in Traditional Markets', 95, 54, 31, 9, 180),
  ('Stablecoin-based Neobanks',         92, 56, 32, 7, 180),
  ('Regulated ICOs',                    85, 59, 36, 7, 180),
  ('Onchain FX',                        79, 62, 39, 5, 180),
  ('Undercollateralized Lending',        74, 65, 41, 5, 180),
  ('Yield Tokenization',                68, 68, 44, 5, 180),
  ('AI Agents on Crypto Rails',         61, 72, 47, 4, 180),
  ('Payments-focused Blockchains',      52, 76, 52, 4, 180)
on conflict (name) do nothing;
