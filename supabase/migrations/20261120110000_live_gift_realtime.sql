-- Enable Realtime for already-settled live gift transactions.
-- No tables, balances, policies, or transaction semantics are changed.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'vip_gift_transactions'
    ) then
    alter publication supabase_realtime add table public.vip_gift_transactions;
  end if;
end $$;
