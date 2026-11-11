ems-center justify-center rounded-2xl border border-slate-200 bg-white/75 px-3 text-xs font-bold text-slate-400 disabled:cursor-not-allowed">{grocery("holdBill")}</button>
                <button type="button" disabled title={locale === "si" ? "රඳවාගත් බිල්පත් ඉක්මනින් පැමිණේ" : locale === "ta" ? "சேமித்த பில்களை மீட்டெடுப்பது விரைவில் வருகிறது" : "Saved bill recall is coming soon"} className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/75 px-3 text-xs font-bold text-slate-400 disabled:cursor-not-allowed">{grocery("recallBill")}</button>
                <button type="button" onClick={() => document.getElementById("grocery-pos-search")?.focus()} className="inline-flex h-12 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50/90 px-3 text-xs font-bold text-violet-700 transition hover:bg-violet-100">{grocery("priceCheck")}</button>
                <Link href="/stock" className="col-span-2 inline-flex h-10 items-center justify-center rounded-xl border border-blue-100 bg-white/75 px-3 text-xs font-bold text-blue-700 transition hover:bg-white sm:col-span-1 sm:h-12">{grocery("inventory")}</Link>
              </div>
            </div>
          </section>
        ) : <ProPageHeader
          eyebrow={org.sector === "pharmacy" ? (si ? "ආරක්ෂිත Pharmacy POS" : "Protected Pharmacy POS") : t("sales.pos_eyebrow")}
          title={t("sales.title")}
          description={org.sector === "pharmacy" ? (si ? "Prescription, FEFO batch සහ ගෙවීම එකම checkout transaction එකක පාලනය කරයි." : "Prescription checks, FEFO batch allocation and payment commit in one checkout transaction.") : (si ? "ගෙවීම සහ තොගය එකම checkout transaction එකක සුරකියි." : "Payment and stock commit together in one checkout transaction.")}
          actions={<><ProBadge tone="emerald">Atomic checkout</ProBadge><ProButton href="/stock" variant="secondary">{t("sales.add_stock_link")}</ProButton>{lastBillId && <ProButton href={`/bills/${lastBillId}`} variant="dark">{t("sales.view_bill")}</ProButton>}</>}
        />}

        <WriteDisabledHint className="mb-5" />

        {message && (
          <div className="mb-5 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">
            {message}
            {lastBillId && (
              <Link href={`/bills/${lastBillId}`} className="ml-2 font-bold underline">
                {t("sales.view_bill")}
              </Link>
            )}
          </div>
        )}

        <section className={`mt-4 grid gap-3 ${groceryPos ? "grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"}`}>
          {groceryPos && groceryLiveMetrics ? (
            <>
              <ProStatCard
                label={grocery("todaySales")}
                value={formatLkr(groceryLiveMetrics.intelligence.todaySales)}
                hint={groceryLiveMetrics.intelligence.todaySalesChangePct == null ? grocery("noBillsYet") : `${groceryLiveMetrics.intelligence.todaySalesChangePct >= 0 ? "▲" : "▼"} ${Math.abs(groceryLiveMetrics.intelligence.todaySalesChangePct).toFixed(0)}% ${locale === "si" ? "ඊයේට වඩා" : locale === "ta" ? "நேற்றை விட" : "vs yesterday"}`}
                icon={<SalesIcon className="h-5 w-5" />}
                tone="teal"
              />
              <ProStatCard
                label={grocery("billsGenerated")}
                value={String(groceryLiveMetrics.intelligence.todayTransactions)}
                hint={grocery("completedToday")}
                icon={<BillsIcon className="h-5 w-5" />}
                tone="slate"
              />
              <ProStatCard
                label={grocery("averageBill")}
                value={formatLkr(groceryLiveMetrics.intelligence.averageBasket)}
                hint={grocery("fromCheckout")}
                icon={<CostingIcon className="h-5 w-5" />}
                tone="emerald"
              />
              <ProStatCard
                label={grocery("itemsSold")}
                value={String(groceryLiveMetrics.itemsSold)}
                hint={grocery("todayBills")}
                icon={<SalesIcon className="h-5 w-5" />}
                tone="slate"
              />
            </>
          ) : (
            <>
              <ProStatCard
                label={t("sales.cart_items")}
                value={String(cartCount)}
                hint={lines.length ? `${lines.length} ${t("sales.product_lines")}` : t("sales.no_selected")}
                icon={<SalesIcon className="h-5 w-5" />}
                tone="teal"
              />
              <ProStatCard
                label={t("sales.gross")}
                value={formatLkr(gross)}
                hint={discountClamped > 0 ? `${t("sales.discount")} ${formatLkr(discountClamped)}` : t("sales.before_discount")}
                icon={<BillsIcon className="h-5 w-5" />}
                tone="slate"
              />
              <ProStatCard
                label={t("common.total")}
                value={formatLkr(netTotal)}
                hint={paymentSummaryLabel}
                icon={<CostingIcon className="h-5 w-5" />}
                tone="emerald"
              />
            </>
          )}
        </section>

        {inStock.length === 0 ? (
          <section className="mt-6">
            {groceryPos ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.14),transparent_34%),linear-gradient(105deg,#f8fbff,#ffffff_54%,#eef6ff)] px-5 py-4 shadow-[0_10px_28px_rgba(59,130,246,0.07)] sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">{locale === "si" ? "නාමාවලිය සූදානම්" : locale === "ta" ? "பட்டியல் தயார்" : "Catalogue ready"}</span>
                  <h2 className="mt-1 text-base font-bold tracking-[-0.025em] text-slate-950">{locale === "si" ? "ආරම්භක භාණ්ඩ Stock හි ඇත" : locale === "ta" ? "தொடக்கப் பொருட்கள் கையிருப்பில் உள்ளன" : "Starter products are in Stock"}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{locale === "si" ? "විකිණීමට පෙර සැබෑ මිල, barcode සහ ලැබුණු තොගය ඇතුළත් කර සක්‍රිය කරන්න." : locale === "ta" ? "விற்பனைக்கு முன் உண்மையான விலை, barcode மற்றும் பெற்ற சரக்கை உள்ளிட்டு செயல்படுத்தவும்." : "Enter real prices, barcodes and received stock in Stock before activating these items for sale."}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <ProButton href="/stock" variant="secondary">{t("sales.add_stock_link")}</ProButton>
                </div>
              </div>
            ) : (
              <ProCard>
                <ProEmptyState
                  title={t("sales.no_stock")}
                  description={t("sales.add_stock_first_desc")}
                  action={<ProButton href="/stock">{t("sales.add_stock_link")}</ProButton>}
                />
              </ProCard>
            )}
          </section>
        ) : (
          <section className={`mt-5 grid gap-5 ${groceryPos ? "lg:grid-cols-[minmax(0,1fr)_minmax(340px,390px)]" : "xl:grid-cols-[1.45fr_0.85fr]"}`}>
            <div className="min-w-0 space-y-4">
              <ProCard
                title={t("sales.products_title")}
                eyebrow={t("sales.fast_checkout_eyebrow")}
                action={<ProBadge tone="emerald">{inStock.length} {groceryPos ? grocery("available") : "available"}</ProBadge>}
              >
                {!groceryPos && <div className="relative">
                  <input
                    type="search"
                    value={search}
                    autoFocus={fastRetail}
                    autoComplete="off"
                    onChange={(event) => {
                      setSearch(event.target.value);
                      if (fastRetail) setResultLimit(30);
                    }}
                    onKeyDown={(event) => {
                      if (!fastRetail) return;
                      if (event.key === "Enter" && quickAddCandidate) {
                        event.preventDefault();
                        addOne(quickAddCandidate);
                      }
                      if (event.key === "Escape") setSearch("");
                    }}
                    placeholder={
                      org.sector === "pharmacy"
                        ? (si ? "ඖෂධය, generic නම, brand, strength, code හෝ barcode…" : "Search medicine, generic, brand, strength, code or barcode…")
                        : fastRetail
                          ? (si ? "Barcode scan කරන්න හෝ භාණ්ඩය, brand හෝ code සොයන්න…" : "Scan barcode or search product, brand or code…")
                          : t("sales.search_placeholder")
                    }
                    className={`h-12 w-full rounded-xl border px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white ${groceryPos ? "border-blue-100 bg-blue-50/55 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" : "border-slate-200 bg-slate-50 focus:border-teal-300 focus:ring-4 focus:ring-teal-100"}`}
                  />
                </div>}

                {fastRetail && (
                  <div className={`flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${groceryPos ? "" : "mt-3"}`}>
                    <button
                      type="button"
                      onClick={() => { setCategoryFilter("all"); setResultLimit(30); }}
                      className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${categoryFilter === "all" ? groceryPos ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md shadow-blue-200" : "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                    >
                      {groceryPos ? grocery("allProducts") : si ? "සියල්ල" : "All"} <span className="opacity-70">{inStock.length}</span>
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.name}
                        type="button"
                        onClick={() => { setCategoryFilter(category.name); setResultLimit(30); }}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${categoryFilter === category.name ? groceryPos ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md shadow-blue-200" : "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
                      >
                        {groceryPos && <GroceryCategoryArt label={category.name} className="h-5 w-5" />}
                        {groceryPos ? groceryCategoryLabel(category.name, locale) : category.name} <span className="opacity-70">{category.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {conditionRelevant && (
                  <div className="mt-3 flex gap-2">
                    {(["all", "new", "used"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setConditionFilter(value)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${conditionFilter === value ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`}
                      >
                        {value === "all" ? t("stock.filter_all") : value === "new" ? t("stock.condition_new") : t("stock.condition_used")}
                      </button>
                    ))}
                  </div>
                )}
              </ProCard>

                {filtered.length === 0 ? (
                  <ProCard><ProEmptyState title={groceryPos ? categoryFilter === "all" ? grocery("noMatchingProducts") : grocery("emptyCategory") : t("sales.no_match")} description={groceryPos ? grocery("emptyCategoryHint") : t("sales.search_no_match_desc")} /></ProCard>
              ) : (
                <div className={fastRetail ? groceryPos ? "grid gap-3 sm:grid-cols-2 2xl:grid-cols-3" : "grid gap-2 md:grid-cols-2 2xl:grid-cols-3" : "grid gap-3 md:grid-cols-2"}>
                  {visibleProducts.map((product) => {
                    const qty = cart[product.id] ?? 0;
                    const selected = qty > 0;
                    const selectedPrice = effectiveUnitPrice(product, customerId, data,
                      groceryPos && orgRole !== "owner" && orgRole !== "manager" ? undefined : priceOverrides[product.id]);
                    const unitPrice = groceryPos && selectedPrice <= 0 ? product.sellPrice : selectedPrice;
                    const rx = org.sector === "pharmacy" && boolField(product.customFields.requiresPrescription);
                    return (
                      <article
                        key={product.id}
                        className={`min-w-0 overflow-hidden rounded-2xl border bg-white transition ${groceryPos ? "shadow-[0_10px_26px_rgba(15,23,42,0.07)] hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_30px_rgba(37,99,235,0.13)]" : "p-4"} ${selected ? "border-teal-300 ring-2 ring-teal-100" : "border-slate-200 hover:border-teal-200"}`}
                      >
                        {groceryPos && (
                          <div className="relative h-24 overflow-hidden border-b border-slate-100 bg-[radial-gradient(circle_at_50%_30%,#ffffff_0%,#eff6ff_62%,#eef2ff_100%)]">
                            <GroceryProductArt name={product.name} category={product.category} imageUrl={typeof product.customFields.imageUrl === "string" ? product.customFields.imageUrl : undefined} className="h-full w-full" />
                            <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-white/90 px-2 py-1 text-[9px] font-bold text-slate-600 shadow-sm" title={groceryCategoryLabel(product.category, locale) || "Grocery"}>{groceryCategoryLabel(product.category, locale) || "Grocery"}</span>
                          </div>
                        )}
                        <div className={`${groceryPos ? "space-y-2 p-3" : "flex items-start justify-between gap-3"}`}>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className={`text-sm font-bold text-slate-950 ${groceryPos ? "break-normal leading-6 [overflow-wrap:normal]" : "truncate"}`}>{groceryPos ? groceryProductLabel(product, locale) : product.name}</h2>
                              {conditionRelevant && <ProductConditionBadge condition={product.condition} />}
                              {rx && <ProBadge tone="amber">Rx</ProBadge>}
                            </div>
                            <p className={`mt-1 text-xs font-semibold text-slate-500 ${groceryPos ? "break-normal leading-5 [overflow-wrap:normal]" : ""}`}>
                              {groceryPos
                                ? groceryUnitLabel(product.customFields.unitVariant ?? product.customFields.unit ?? "1 unit", locale)
                                : <>{product.sku ? `${product.sku} · ` : ""}{product.category || "General"}</>}
                            </p>
                            {org.sector === "pharmacy" && (
                              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">
                                {[product.customFields.genericName, product.customFields.strength, product.customFields.brand, product.customFields.packSize]
                                  .filter(Boolean).map(String).join(" · ") || (si ? "Batch පාලිත තොග" : "Batch-controlled stock")}
                              </p>
                            )}
                          </div>
                          <div className={groceryPos ? "" : "shrink-0 text-right"}>
                            {groceryPos ? (
                              <p className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold leading-5 [overflow-wrap:normal] ${product.stockQty <= (product.reorderLevel ?? 0) ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{product.stockQty} {grocery("inStock")}</p>
                            ) : (
                              <>
                                <p className="text-sm font-bold text-slate-950">{formatLkr(unitPrice)}</p>
                                <p className="mt-1 text-[10px] font-semibold text-slate-400">{product.stockQty} in stock</p>
                              </>
                            )}
                          </div>
                        </div>
                        <div className={`flex items-center justify-between gap-3 ${groceryPos ? "border-t border-slate-100 px-3 pb-3 pt-2.5" : "mt-4"}`}>
                          {groceryPos ? (
                            <>
                              <span className="font-mono text-base font-extrabold text-slate-950">{formatLkr(unitPrice)}</span>
                              <button
                                type="button"
                                aria-label={`${grocery("add")} ${groceryProductLabel(product, locale)}`}
                                onClick={() => addOne(product)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-xl font-semibold text-white shadow-[0_8px_16px_rgba(59,130,246,0.26)] transition hover:brightness-110 active:scale-95"
                              >+
                              </button>
                            </>
                          ) : <>
                          <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            <button
                              type="button"
                              aria-label={`Decrease ${product.name}`}
                              onClick={() => setQty(product.id, qty - 1, product.stockQty)}
                              className="flex h-10 w-10 items-center justify-center text-lg font-bold text-slate-600 hover:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400"
                            >−</button>
                            <input
                              aria-label={`${product.name} quantity`}
                              type="number"
                              min={0}
                              max={product.stockQty}
                              step="any"
                              value={qty || ""}
                              onChange={(event) => setQty(product.id, Number(event.target.value), product.stockQty)}
                              className="h-10 w-14 border-x border-slate-200 bg-white text-center text-sm font-bold outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400"
                            />
                            <button
                              type="button"
                              aria-label={`Increase ${product.name}`}
                              onClick={() => setQty(product.id, qty + 1, product.stockQty)}
                              className="flex h-10 w-10 items-center justify-center text-lg font-bold text-teal-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-400"
                            >+</button>
                          </div>
                          <span className="font-mono text-sm font-bold text-teal-700">{formatLkr(unitPrice * qty)}</span>
                          </>}
                        </div>
                      </article>
                    );
                  })}
                  {fastRetail && filtered.length > visibleProducts.length && (
                    <button
                      type="button"
                      onClick={() => setResultLimit((value) => value + 30)}
                      className="min-h-24 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-left hover:border-teal-300 hover:bg-teal-50"
                    >
                      <span className="block text-sm font-bold text-slate-800">{groceryPos ? grocery("showMore") : si ? "තවත් භාණ්ඩ පෙන්වන්න" : "Show more products"}</span>
                      <span className="mt-1 block text-xs text-slate-500">{visibleProducts.length} / {filtered.length}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
              <ProCard title={groceryPos ? grocery("cart") : t("sales.cart_title")} eyebrow={groceryPos ? grocery("checkout") : t("sales.checkout_eyebrow")}>
                {lines.length === 0 ? (
                  <ProEmptyState title={groceryPos ? grocery("noItemsSelected") : t("sales.no_selected")} description={groceryPos ? grocery("chooseProducts") : t("sales.choose_products_desc")} />
                ) : (
                  <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-1">
                    {lines.map((line) => (
                      <div key={line.product.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 gap-2.5">
                            {groceryPos && (
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50">
                                <GroceryProductArt
                                  name={line.product.name}
                                  category={line.product.category}
                                  imageUrl={typeof line.product.customFields.imageUrl === "string" ? line.product.customFields.imageUrl : undefined}
                                  className="h-full w-full p-1"
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-950">{groceryPos ? groceryProductLabel(line.product, locale) : line.product.name}</p>
                              {groceryPos ? (
                                <div className="mt-1.5 inline-flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                                  <button type="button" aria-label={`${grocery("decrease")} ${groceryProductLabel(line.product, locale)}`} onClick={() => setQty(line.product.id, line.qty - 1, line.product.stockQty)} className="flex h-7 w-7 items-center justify-center text-sm font-bold text-slate-600 hover:bg-slate-50">−</button>
                                  <span className="flex h-7 min-w-8 items-center justify-center border-x border-slate-200 px-1 text-xs font-bold text-slate-900">{line.qty}</span>
                                  <button type="button" aria-label={`${grocery("increase")} ${groceryProductLabel(line.product, locale)}`} onClick={() => setQty(line.product.id, line.qty + 1, line.product.stockQty)} className="flex h-7 w-7 items-center justify-center text-sm font-bold text-teal-700 hover:bg-teal-50">+</button>
                                </div>
                              ) : <p className="mt-0.5 text-xs font-semibold text-slate-500">× {line.qty}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <p className="shrink-0 font-mono text-sm font-bold text-slate-950">{formatLkr(line.unitPrice * line.qty)}</p>
                            {groceryPos && <button type="button" aria-label={`${grocery("removeItem")} ${groceryProductLabel(line.product, locale)}`} onClick={() => setQty(line.product.id, 0, line.product.stockQty)} className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">×</button>}
                          </div>
                        </div>
                        {(!groceryPos || orgRole === "owner" || orgRole === "manager") && <label className="mt-3 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                          {t("sales.unit_price")}
                          <input
                            type="number"
                            min={groceryPos ? 0.01 : 0}
                            step="any"
                            value={line.unitPrice}
                            onChange={(event) => {
                              setPriceOverrides((current) => ({ ...current, [line.product.id]: Math.max(groceryPos ? 0.01 : 0, Number(event.target.value)) }));
                              setPendingSaleId(null);
                            }}
                            className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-xs font-bold text-slate-700 outline-none focus:border-teal-300"
                          />
                        </label>}
                        {advancedRetail && (
                          <AdvancedSaleSelector
                            productId={line.product.id}
                            qty={line.qty}
                            value={inventoryStates[line.product.id]?.selection}
                            onChange={(next) => setInventoryStates((current) => ({ ...current, [line.product.id]: next }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 space-y-3 border-t border-slate-200 pt-5 text-sm font-semibold text-slate-600">
                  <div className="flex justify-between"><span>{t("sales.gross")}</span><span className="font-mono font-bold text-slate-950">{formatLkr(gross)}</span></div>
                  <label className="flex items-center justify-between gap-2">
                    <span>{t("sales.discount")}</span>
                    <input
                      type="number"
                      min={0}
                      max={gross}
                      value={discount || ""}
                      onChange={(event) => { setDiscount(Number(event.target.value)); setPendingSaleId(null); }}
                      className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm font-bold text-slate-900 outline-none focus:border-teal-300"
                    />
                  </label>
                  {billVat && (
                    <div className={`rounded-lg px-3 py-2.5 text-xs ${groceryPos ? "border border-violet-100 bg-violet-50 text-slate-700" : "bg-slate-900 text-slate-200"}`}>
                      <div className="flex justify-between"><span>{t("vat.taxable")}</span><span className="font-mono">{formatLkr(billVat.subtotal)}</span></div>
                      <div className={`mt-1 flex justify-between ${groceryPos ? "text-violet-700" : "text-teal-300"}`}><span>{t("vat.output_vat")} (18%)</span><span className="font-mono font-bold">{formatLkr(billVat.vat)}</span></div>
                    </div>
                  )}
                </div>

                <div className={`mt-5 rounded-xl p-4 ${groceryPos ? "border border-blue-100 bg-gradient-to-r from-sky-50 via-indigo-50 to-violet-50 text-slate-950 shadow-[0_10px_22px_rgba(59,130,246,0.08)]" : "bg-slate-950 text-white"}`}>
                  <p className={`text-xs font-bold uppercase tracking-[0.16em] ${groceryPos ? "text-blue-700" : "text-teal-300"}`}>{t("common.total")}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight">{formatLkr(netTotal)}</p>
                </div>

                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-bold text-slate-700">
                    {t("common.customer")}
                    <select
                      value={customerId}
                      onChange={(event) => resetPricingForCustomer(event.target.value)}
                      className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-300"
                    >
                      <option value="">{t("sales.walk_in_label")}</option>
                      {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customerOptionText(customer)}</option>)}
                    </select>
                  </label>

                  {!customerId && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-bold text-slate-700">
                        {t("sales.walkin_name")}
                        <input
                          value={walkInName}
                          onChange={(event) => { setWalkInName(event.target.value); setPendingSaleId(null); }}
                          className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-300"
                        />
                      </label>
                      <label className="block text-sm font-bold text-slate-700">
                        {t("sales.walkin_phone")}
                        <input
                          type="tel"
                          inputMode="tel"
                          placeholder="07X XXX XXXX"
                          value={walkInPhone}
                          onChange={(event) => { setWalkInPhone(event.target.value); setPendingSaleId(null); }}
                          className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-300"
                        />
                        {walkInPhone.trim() !== "" && !isValidSlMobile(walkInPhone) && (
                          <span className="mt-1 block text-xs font-semibold text-amber-600">{t("msg.phone_invalid")}</span>
                        )}
                      </label>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-bold text-slate-700">{t("common.payment")}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(PAYMENT_OPTIONS as CheckoutPayment[]).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            setPayment(method);
                            if (splitPayment && secondaryPayment === method) {
                              const alternate = (PAYMENT_OPTIONS as CheckoutPayment[]).find((item) => item !== method) ?? "cash";
                              setSecondaryPayment(alternate);
                            }
                            setPendingSaleId(null);
                          }}
                          className={`rounded-lg border px-3 py-3 text-sm font-bold transition ${payment === method ? "border-teal-300 bg-teal-50 text-teal-800 ring-2 ring-teal-100" : "border-slate-200 bg-white text-slate-600 hover:border-teal-200"}`}
                        >
                          {paymentLabel(t, method)}
                        </button>
                      ))}
                    </div>

                    <label className={`mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition ${splitPayment ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-slate-50"}`}>
                      <div>
                        <span className="block text-sm font-bold text-slate-800">{groceryPos ? grocery("splitPayment") : si ? "ගෙවීම දෙකට බෙදන්න" : "Split payment"}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{si ? "උදා: cash + card, cash + credit" : "For example cash + card or cash + customer credit"}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={splitPayment}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setSplitPayment(enabled);
                          if (enabled) {
                            if (secondaryPayment === payment) {
                              const alternate = (PAYMENT_OPTIONS as CheckoutPayment[]).find((item) => item !== payment) ?? "card";
                              setSecondaryPayment(alternate);
                            }
                            if (secondaryAmount === "" || Number(secondaryAmount) <= 0 || Number(secondaryAmount) >= netTotal) {
                              setSecondaryAmount(netTotal > 0 ? Math.round((netTotal / 2) * 100) / 100 : "");
                            }
                          }
                          setPendingSaleId(null);
                        }}
                        className="h-5 w-5 accent-teal-600"
                      />
                    </label>
                  </div>

                  {splitPayment && (
                    <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">{si ? "දෙවන ගෙවීම" : "Second payment"}</p>
                          <p className="mt-1 text-xs text-slate-500">{si ? "මෙම මුදල දෙවන ක්‍රමයට යයි. ඉතිරිය පළමු ක්‍රමයට." : "This amount uses the second method; the balance stays on the first."}</p>
                        </div>
                        <ProBadge tone="emerald">Mixed</ProBadge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(PAYMENT_OPTIONS as CheckoutPayment[])
                          .filter((method) => method !== payment)
                          .map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => { setSecondaryPayment(method); setPendingSaleId(null); }}
                              className={`rounded-lg border px-3 py-2.5 text-xs font-bold transition ${secondaryPayment === method ? "border-teal-300 bg-white text-teal-800 ring-2 ring-teal-100" : "border-slate-200 bg-white/70 text-slate-600 hover:border-teal-200"}`}
                            >
                              {paymentLabel(t, method)}
                            </button>
                          ))}
                      </div>

                      <label className="mt-3 block text-xs font-bold text-slate-600">
                        {si ? "දෙවන ගෙවීම් මුදල" : "Second payment amount"}
                        <input
                          type="number"
                          min={0.01}
                          max={Math.max(0.01, netTotal - 0.01)}
                          step="any"
                          value={secondaryAmount}
                          onChange={(event) => {
                            setSecondaryAmount(event.target.value === "" ? "" : Number(event.target.value));
                            setPendingSaleId(null);
                          }}
                          className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-sm font-bold text-slate-900 outline-none focus:border-teal-300"
                        />
                      </label>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                          <p className="font-semibold text-slate-500">{paymentLabel(t, payment)}</p>
                          <p className="mt-1 font-mono text-sm font-bold text-slate-900">{formatLkr(primaryTenderPreview)}</p>
                        </div>
                        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                          <p className="font-semibold text-slate-500">{paymentLabel(t, secondaryPayment)}</p>
                          <p className="mt-1 font-mono text-sm font-bold text-slate-900">{formatLkr(secondaryAmountValue)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {cashTenderPreview > 0 && netTotal > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>{si ? "Cash කොටස" : "Cash portion"}</span>
                        <span className="font-mono text-slate-800">{formatLkr(cashTenderPreview)}</span>
                      </div>
                      <label className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700">
                        <span>{t("sales.cash_received")}</span>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={cashReceived}
                          onChange={(event) => setCashReceived(event.target.value === "" ? "" : Number(event.target.value))}
                          className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm font-bold outline-none focus:border-teal-300"
                        />
                      </label>
                      {cashReceived !== "" && (
                        <div className="mt-3 flex justify-between text-sm font-bold text-teal-800"><span>{t("sales.change_due")}</span><span className="font-mono">{formatLkr(changeDue)}</span></div>
                      )}
                    </div>
                  )}

                  {(payment === "cheque" || (splitPayment && secondaryPayment === "cheque")) && (
                    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                      <label className="text-xs font-bold text-slate-600">Cheque no.
                        <input value={chequeNo} onChange={(event) => { setChequeNo(event.target.value); setPendingSaleId(null); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-300" />
                      </label>
                      <label className="text-xs font-bold text-slate-600">Bank
                        <select value={chequeBank} onChange={(event) => { setChequeBank(event.target.value); setPendingSaleId(null); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-300">
                          {LK_BANKS.map((bank) => <option key={bank}>{bank}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-bold text-slate-600">Cheque date
                        <input type="date" value={chequeDate} onChange={(event) => { setChequeDate(event.target.value); setPendingSaleId(null); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-300" />
                      </label>
                      <label className="flex min-h-10 items-center gap-2 self-end rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
                        <input type="checkbox" checked={postDated} onChange={(event) => { setPostDated(event.target.checked); setPendingSaleId(null); }} /> Post-dated
                      </label>
                    </div>
                  )}

                  {lines.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <a
                          href={quoteWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                        >
                          {t("bills.quote_whatsapp")}
                        </a>
                        {/* Was always just this one deep link — opens
                            WhatsApp with the quote pre-filled, but someone
                            still has to press Send by hand. When the real
                            WhatsApp API is available for this org, offer an
                            actual auto-send too instead of only the manual
                            open-and-send flow. */}
                        {canApiWhatsApp && (
                          <button
                            type="button"
                            disabled={sendingQuoteApi || !isValidSlMobile(recipientPhone)}
                            title={!isValidSlMobile(recipientPhone) ? t("msg.phone_invalid") : undefined}
                            onClick={() => void handleSendQuoteApi()}
                            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-4 text-sm font-bold text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            🚀 {sendingQuoteApi ? t("msg.sending") : t("msg.send_api_whatsapp")}
                          </button>
                        )}
                      </div>
                      {quoteApiFeedback && (
                        quoteApiFeedback.ok ? (
                          <p className="text-center text-xs font-semibold text-emerald-700">{quoteApiFeedback.message}</p>
                        ) : (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
                            <p className="font-semibold">{quoteApiFeedback.message}</p>
                            <Link
                              href="/settings/notifications"
                              className="mt-1 inline-block font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
                            >
                              {t("msg.configure_whatsapp_link")}
                            </Link>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={lines.length === 0 || !canWrite || saving || identityBlocked || netTotal <= 0}
                    title={!canWrite ? (disabledHint ?? undefined) : identityBlocked ? (si ? "Prescription / batch / variant / IMEI අවශ්‍යතා සම්පූර්ණ කරන්න" : "Complete prescription / inventory requirements") : undefined}
                    onClick={() => void handleSale()}
                    className="w-full rounded-lg bg-teal-600 py-4 text-sm font-bold text-white shadow-[0_8px_20px_rgba(13,148,136,0.2)] transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? t("common.saving") : identityBlocked ? (si ? "Checkout අවශ්‍යතා සම්පූර්ණ කරන්න" : "Complete checkout requirements") : groceryPos ? grocery("completed") : splitPayment ? (si ? "බෙදා ගෙවීමෙන් විකිණීම සම්පූර්ණ කරන්න" : "Complete split-payment sale") : t("sales.complete")}
                  </button>
                </div>
              </ProCard>
            </aside>
          </section>
        )}

        {data.sales.length > 0 && (
          <section className="mt-6">
            <ProCard title={t("sales.recent")} action={<ProBadge tone="slate">Latest 10</ProBadge>}>
              <div className="hidden overflow-hidden rounded-xl border border-slate-200 md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{t("common.date")}</th>
                      <th className="px-4 py-3">{t("common.customer")}</th>
                      <th className="px-4 py-3">{t("common.payment")}</th>
                      <th className="px-4 py-3">{t("common.total")}</th>
                      {canSeeFinancials && <th className="px-4 py-3">{t("sales.profit")}</th>}
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.slice(0, 10).map((sale) => (
                      <tr key={sale.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-semibold text-slate-600">{new Date(sale.date).toLocaleString("en-LK")}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{sale.customerName || "—"}</td>
                        <td className="px-4 py-3"><ProBadge tone="slate">{sale.paymentMethod === "mixed" ? (si ? "බෙදා ගෙවීම" : "Mixed") : paymentLabel(t, sale.paymentMethod)}</ProBadge></td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{formatLkr(sale.total)}</td>
                        {canSeeFinancials && <td className="px-4 py-3 font-mono font-bold text-teal-700">{formatLkr(sale.profit)}</td>}
                        <td className="px-4 py-3 text-right"><Link href={`/bills/${sale.id}`} className="font-bold text-teal-700 hover:underline">{t("sales.bill")}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ProCard>
          </section>
        )}
      </ProMain>

      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-xl safe-area-pb xl:hidden">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{cartCount} items</p>
              <p className="text-lg font-bold text-slate-950">{formatLkr(netTotal)}</p>
              {splitPayment && <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600">{si ? "බෙදා ගෙවීම" : "Split payment"}</p>}
            </div>
            <button
              type="button"
              disabled={!canWrite || saving || identityBlocked || netTotal <= 0}
              onClick={() => void handleSale()}
              className="rounded-lg bg-teal-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? t("common.saving") : identityBlocked ? (si ? "අවශ්‍යතා" : "Requirements") : t("sales.complete")}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
