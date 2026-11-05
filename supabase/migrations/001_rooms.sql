create schema if not exists zk_ludo;
revoke all on schema zk_ludo from public, anon, authenticated;
create table zk_ludo.rooms (
 code text primary key,
 snapshot jsonb not null,
 touched timestamptz not null default now()
);
alter table zk_ludo.rooms enable row level security;
create index on zk_ludo.rooms(touched);
