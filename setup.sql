-- Run this in your Supabase SQL Editor
-- Updated: 15 trends with seed data based on 317 base voters
-- IMPORTANT: Only run this ONCE. If tables already exist with real votes, DO NOT re-run.

-- Drop old tables (CAUTION: destroys existing data)
-- drop table if exists voter_sessions cascade;
-- drop table if exists trend_stats cascade;

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

-- Policies (safe: only creates if not exists)
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

-- ══════════════════════════════════════════
-- UPDATE SEED DATA to 317 base voters
-- This uses ON CONFLICT to update existing rows or insert new ones
-- Safe to run even if rows already exist from previous seed
-- ══════════════════════════════════════════
-- Rates: excited_count = excited_rate * 317, meh_count = cold_rate * 317
-- skip = 317 - excited - meh (remainder)
-- first_pick_count = first_pick_rate * 317

insert into trend_stats (name, excited_count, meh_count, skip_count, first_pick_count, total_voters) values
  ('Tokenized Equities',               235, 82, 0, 57, 317),
  ('Onchain Vaults',                    225, 92, 0, 44, 317),
  ('Prediction Markets',                219, 98, 0, 38, 317),
  ('Equity Perpetuals',                 203, 114, 0, 29, 317),
  ('Stablecoin-linked Cards',           197, 120, 0, 25, 317),
  ('Onchain Privacy',                   184, 133, 0, 22, 317),
  ('Stablecoin-based Cross-Border Payments', 178, 139, 0, 19, 317),
  ('Tokenized Collateral in Traditional Markets', 168, 149, 0, 16, 317),
  ('Stablecoin-based Neobanks',         162, 155, 0, 13, 317),
  ('Regulated ICOs',                    149, 168, 0, 13, 317),
  ('Onchain FX',                        139, 178, 0, 10, 317),
  ('Undercollateralized Lending',        130, 187, 0, 10, 317),
  ('Yield Tokenization',                120, 197, 0, 10, 317),
  ('AI Agents on Crypto Rails',         108, 209, 0, 6, 317),
  ('Payments-focused Blockchains',      92, 225, 0, 6, 317)
on conflict (name) do update set
  excited_count = excluded.excited_count,
  meh_count = excluded.meh_count,
  skip_count = excluded.skip_count,
  first_pick_count = excluded.first_pick_count,
  total_voters = excluded.total_voters;
