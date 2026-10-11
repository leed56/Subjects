# Reference UI alignment

The four RetailPro screenshots supplied by the user supersede the earlier navy showcase direction. The first demo release covered the suggested page list but did not match those images; page coverage must not be described as visual fidelity.

## Adopted visual contract

- White/light blue desktop navigation with a blue-to-teal active item.
- Wide global search, branch context, inspection alerts and role context.
- Pale blue/teal image banners, compact white KPI cards and colored icon tiles.
- Dense operating tables and side-by-side chart/list panels.
- Product photography in POS, stock, ranking and alert lists.
- Owner Mobile uses a light canvas, branch selector/context, compact metrics, bar/line chart, branch/stock/expiry panels and five bottom shortcuts.
- Keep LakBiz identity, LKR, Sri Lankan sample companies and timezone. The reference's RetailPro name, SAR prices, Riyadh locations and employee portrait are illustrative rather than application configuration.

## Implemented

All 17 showcase pages now share the reference light shell and image banner. Overview is rebuilt with six metrics, sales bars and trend line, top products, branch performance, expiry, recent activity and inspection panels. Inventory combines shipments, landed cost, batch/expiry, location stock and working inventory actions. POS uses photographic industry cards, an expanded itemized cart and payment controls. Owner Pulse is rebuilt with the supplied mobile composition and five real navigation links.

The live app's shared desktop sidebar and ProPageHeader / metric surfaces also adopt the light direction. Existing authenticated routes retain their business engines and route-specific layouts. This is **not certification that every live production route now exactly matches the mockups**. The published client showcase is the reviewable visual target; production route convergence remains tracked in ERP_CAPABILITY_AUDIT.md.

## Images

Asset: `lakbiz/app/public/images/industry-products-atlas.webp`. Generated with the built-in image tool, then encoded to WebP without compositional edits. One locally served 4x4 photographic atlas avoids third-party image requests; CSS selects each industry cell. Product photos are illustrative industry photography, not exact catalog product photographs.

Prompt: photographic 4x4 contact sheet of grocery basket; pharmaceutical carton/blister; cosmetics bottles/jar/lipstick; television; phone; electrical wire/switch; brake disc/filter; footwear; textile shirt/fabric; AC unit; sedan; hardware tools; stationery; shipping cartons; cargo ship; pharmacy aisle. Pale backgrounds, consistent light, no text, no UI.

## Validation

The existing 14-industry × 17-workspace render suite checks all layouts; the command engine remains unchanged. Lint, TypeScript, 259 tests and the clean 321-route build passed. Deployed browser inspection verified the light overview, photographed POS grid, shipment/landed-cost stock composition and Owner Pulse. The final refinements additionally passed all 238 page renders and a fresh build. No Supabase migration or real business transaction is introduced by visual alignment.
