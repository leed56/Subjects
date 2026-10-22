-- Enrich only the two named LakBiz demo organizations with deterministic,
-- clearly synthetic 30-day sales history. Product identity/price provenance
-- remains in the product master and current stock remains an independent
-- synthetic snapshot; this migration does not touch real customer tenants.

do $$
declare
  r_org record;
  r_p1 record;
  r_p2 record;
  r_customer record;
  i integer;
  v_count integer;
  v_idx1 integer;
  v_idx2 integer;
  v_sale_id text;
  v_bill_no text;
  v_tender_id text;
  v_sale_date timestamptz;
  v_qty1 numeric;
  v_qty2 numeric;
  v_total numeric;
  v_cost numeric;
  v_profit numeric;
  v_method text;
  v_customer_id text;
  v_customer_name text;
begin
  for r_org in
    select id, name, sector
    from public.organizations
    where (name = 'LakBiz Grocery Demo' and sector = 'grocery')
       or (name = 'LakBiz Pharmacy Demo' and sector = 'pharmacy')
  loop
    select count(*) into v_count
    from public.products_base p
    left join public.product_inventory_profiles ip
      on ip.product_id = p.id and ip.organization_id = r_org.id
    where p.organization_id = r_org.id
      and p.id like ('demo:' || r_org.sector || ':%')
      and p.active = true
      and p.sell_price > 0
      and (r_org.sector <> 'pharmacy' or coalesce(ip.tracking_mode, 'simple') = 'simple');

    if v_count < 2 then
      raise notice 'Skipping demo history volume for %, only % saleable simple products', r_org.name, v_count;
      continue;
    end if;

    for i in 6..185 loop
      v_idx1 := (i * 13) % v_count;
      v_idx2 := (i * 29 + 7) % v_count;
      if v_idx2 = v_idx1 then v_idx2 := (v_idx2 + 1) % v_count; end if;

      select p.id, p.name, p.sell_price, p.buy_price into r_p1
      from public.products_base p
      left join public.product_inventory_profiles ip
        on ip.product_id = p.id and ip.organization_id = r_org.id
      where p.organization_id = r_org.id
        and p.id like ('demo:' || r_org.sector || ':%')
        and p.active = true and p.sell_price > 0
        and (r_org.sector <> 'pharmacy' or coalesce(ip.tracking_mode, 'simple') = 'simple')
      order by p.id offset v_idx1 limit 1;

      select p.id, p.name, p.sell_price, p.buy_price into r_p2
      from public.products_base p
      left join public.product_inventory_profiles ip
        on ip.product_id = p.id and ip.organization_id = r_org.id
      where p.organization_id = r_org.id
        and p.id like ('demo:' || r_org.sector || ':%')
        and p.active = true and p.sell_price > 0
        and (r_org.sector <> 'pharmacy' or coalesce(ip.tracking_mode, 'simple') = 'simple')
      order by p.id offset v_idx2 limit 1;

      v_qty1 := 1 + (i % 3);
      v_qty2 := 1 + ((i + 1) % 2);
      v_total := round((r_p1.sell_price * v_qty1 + r_p2.sell_price * v_qty2)::numeric, 2);
      v_cost := round((coalesce(r_p1.buy_price,0) * v_qty1 + coalesce(r_p2.buy_price,0) * v_qty2)::numeric, 2);
      v_profit := round((v_total - v_cost)::numeric, 2);
      v_method := case when i % 4 = 0 then 'card' else 'cash' end;
      v_sale_date := date_trunc('day', now())
        - (((i - 6) % 30) * interval '1 day')
        + interval '8 hours' + ((i % 12) * interval '47 minutes');
      v_sale_id := 'demo:' || r_org.sector || ':sale:' || i;
      v_bill_no := 'DEMO-' || case when r_org.sector='pharmacy' then 'PH' else 'GR' end || '-' || lpad(i::text,4,'0');
      v_tender_id := 'demo:' || r_org.sector || ':tender:' || i;

      v_customer_id := null;
      v_customer_name := 'Walk-in Customer';
      if i % 4 <> 1 then
        select c.id, c.name into r_customer
        from public.customers c
        where c.organization_id = r_org.id
          and c.id like ('demo:' || r_org.sector || ':customer:%')
        order by c.id offset (i % 3) limit 1;
        if r_customer.id is not null then
          v_customer_id := r_customer.id;
          v_customer_name := r_customer.name;
        end if;
      end if;

      insert into public.sales_base
        (id, organization_id, bill_no, sale_date, subtotal, output_vat, total, profit, payment_method, customer_id, customer_name, credit_amount, cheque_id, discount)
      values
        (v_sale_id, r_org.id, v_bill_no, v_sale_date, v_total, 0, v_total, v_profit, v_method, v_customer_id, v_customer_name, 0, null, 0)
      on conflict (id) do update set
        bill_no=excluded.bill_no, sale_date=excluded.sale_date, subtotal=excluded.subtotal,
        output_vat=excluded.output_vat, total=excluded.total, profit=excluded.profit,
        payment_method=excluded.payment_method, customer_id=excluded.customer_id,
        customer_name=excluded.customer_name, credit_amount=0, cheque_id=null, discount=0;

      insert into public.sale_lines_base
        (id, sale_id, organization_id, product_id, product_name, qty, unit_price, buy_price, line_order)
      values
        (md5(v_sale_id || ':0')::uuid, v_sale_id, r_org.id, r_p1.id, r_p1.name, v_qty1, r_p1.sell_price, coalesce(r_p1.buy_price,0), 0),
        (md5(v_sale_id || ':1')::uuid, v_sale_id, r_org.id, r_p2.id, r_p2.name, v_qty2, r_p2.sell_price, coalesce(r_p2.buy_price,0), 1)
      on conflict (id) do update set
        product_id=excluded.product_id, product_name=excluded.product_name, qty=excluded.qty,
        unit_price=excluded.unit_price, buy_price=excluded.buy_price, line_order=excluded.line_order;

      insert into public.sale_tenders
        (id, organization_id, sale_id, kind, amount, note, created_by, created_at)
      values
        (v_tender_id, r_org.id, v_sale_id, v_method, v_total,
         'Synthetic demo sales history; not factual customer activity.', null, v_sale_date)
      on conflict (id) do update set
        kind=excluded.kind, amount=excluded.amount, note=excluded.note, created_at=excluded.created_at;
    end loop;
  end loop;
end $$;
