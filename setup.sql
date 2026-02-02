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
-- UPDATE SEED DATA to 324 base voters
-- This uses ON CONFLICT to update existing rows or insert new ones
-- Safe to run even if rows already exist from previous seed
-- ══════════════════════════════════════════
-- Rates: excited_count = excited_rate * 324, meh_count = cold_rate * 324
-- first_pick_count = first_pick_rate * 324

insert into trend_stats (name, excited_count, meh_count, skip_count, first_pick_count, total_voters) values
  ('Tokenized Equities',               240, 84, 0, 58, 324),
  ('Onchain Vaults',                    230, 94, 0, 45, 324),
  ('Prediction Markets',                224, 100, 0, 39, 324),
  ('Equity Perpetuals',                 207, 117, 0, 29, 324),
  ('Stablecoin-linked Cards',           201, 123, 0, 26, 324),
  ('Onchain Privacy',                   188, 136, 0, 23, 324),
  ('Stablecoin-based Cross-Border Payments', 181, 143, 0, 19, 324),
  ('Tokenized Collateral in Traditional Markets', 172, 152, 0, 16, 324),
  ('Stablecoin-based Neobanks',         165, 159, 0, 13, 324),
  ('Regulated ICOs',                    152, 172, 0, 13, 324),
  ('Onchain FX',                        143, 181, 0, 10, 324),
  ('Undercollateralized Lending',        133, 191, 0, 10, 324),
  ('Yield Tokenization',                123, 201, 0, 10, 324),
  ('AI Agents on Crypto Rails',         110, 214, 0, 6, 324),
  ('Payments-focused Blockchains',      94, 230, 0, 6, 324)
on conflict (name) do update set
  excited_count = excluded.excited_count,
  meh_count = excluded.meh_count,
  skip_count = excluded.skip_count,
  first_pick_count = excluded.first_pick_count,
  total_voters = excluded.total_voters;
