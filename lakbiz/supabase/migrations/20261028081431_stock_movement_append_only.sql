-- Stock history is an append-only business record. Corrections and returns
-- create new movements; neither stale snapshots nor privileged view functions
-- may edit or delete prior evidence. No existing rows are changed here.
create schema if not exists ledger_internal;
revoke all on schema ledger_internal from public, anon, authenticated;

create or replace function ledger_internal.reject_stock_movement_mutation()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  raise exception 'Recorded stock movements are immutable; append a correction instead'
    using errcode = '42501';
end;
$$;
revoke all on function ledger_internal.reject_stock_movement_mutation() from public, anon, authenticated;

drop trigger if exists stock_logs_immutable on public.stock_logs;
create trigger stock_logs_immutable
before update or delete on public.stock_logs
for each row execute function ledger_internal.reject_stock_movement_mutation();

drop policy if exists stock_logs_update_member on public.stock_logs;
drop policy if exists stock_logs_delete_member on public.stock_logs;
revoke update, delete, truncate on public.stock_logs from anon, authenticated;

comment on table public.stock_logs is 'Append-only stock movement evidence. Returns and corrections append new rows. Ordinary clients cannot update, delete or truncate history.';
notify pgrst, 'reload schema';
