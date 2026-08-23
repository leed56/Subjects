-- LakBiz POS cutover hardening.
--
-- Advanced retail checkout now commits sale header, tender ledger, aggregate
-- stock and exact variant/lot/serial allocation through
-- finalize_sale_with_private_tenders_v3 in one PostgreSQL transaction.
-- The older allocate_sale_inventory RPC was a second-step compatibility path
-- for the former createSaleToCloud -> allocate flow and must no longer be an
-- authenticated application surface once the atomic retail UI is deployed.
--
-- IMPORTANT rollout order:
--   1. deploy/certify the atomic retail Sales UI;
--   2. apply this migration to the shared LakBiz database;
--   3. verify only the v3 finalizer remains app-facing for advanced sales.
--
-- HVAC remains on its legacy application checkout for installation-job
-- creation, but it does not enable advanced identity allocation and therefore
-- does not call this RPC.

revoke execute on function public.allocate_sale_inventory(uuid, text, text, jsonb)
  from authenticated;

-- Keep the function callable by privileged database/server contexts because
-- finalize_sale_with_private_tenders_v3 may invoke allocation internally under
-- SECURITY DEFINER. REVOKE from authenticated does not remove owner/service
-- execution privileges.

comment on function public.allocate_sale_inventory(uuid, text, text, jsonb) is
  'Internal advanced-inventory sale allocator. Direct authenticated execution was revoked after the atomic retail POS v3 cutover; application checkout must use finalize_sale_with_private_tenders_v3.';
