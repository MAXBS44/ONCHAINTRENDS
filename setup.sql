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
-- UPDATE SEED DATA to 27 base voters
-- This uses ON CONFLICT to update existing rows or insert new ones
-- Safe to run even if rows already exist from previous seed
-- ══════════════════════════════════════════
-- Rates: excited_count = excited_rate * 27, meh_count = cold_rate * 27
-- first_pick_count = first_pick_rate * 27

insert into trend_stats (name, excited_count, meh_count, skip_count, first_pick_count, total_voters) values
  ('Tokenized Equities',               20, 7, 0, 5, 27),
  ('Onchain Vaults',                    19, 8, 0, 4, 27),
  ('Prediction Markets',                19, 8, 0, 3, 27),
  ('Equity Perpetuals',                 17, 10, 0, 2, 27),
  ('Stablecoin-linked Cards',           17, 10, 0, 2, 27),
  ('Onchain Privacy',                   16, 11, 0, 2, 27),
  ('Stablecoin-based Cross-Border Payments', 15, 12, 0, 2, 27),
  ('Tokenized Collateral in Traditional Markets', 14, 13, 0, 1, 27),
  ('Stablecoin-based Neobanks',         14, 13, 0, 1, 27),
  ('Regulated ICOs',                    13, 14, 0, 1, 27),
  ('Onchain FX',                        12, 15, 0, 1, 27),
  ('Undercollateralized Lending',        11, 16, 0, 1, 27),
  ('Yield Tokenization',                10, 17, 0, 1, 27),
  ('AI Agents on Crypto Rails',         9, 18, 0, 1, 27),
  ('Payments-focused Blockchains',      8, 19, 0, 1, 27)
on conflict (name) do update set
  excited_count = excluded.excited_count,
  meh_count = excluded.meh_count,
  skip_count = excluded.skip_count,
  first_pick_count = excluded.first_pick_count,
  total_voters = excluded.total_voters;
