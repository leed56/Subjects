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


## Authenticated route integration — 11 October 2026

The dashboard (`/dashboard`), stock catalogue (`/stock`) and atomic retail POS (`/sales`, for sectors using that checkout) now use the reference light visual language in their actual application components. Shared page headers accept an optional sector and render a local photographic strip without importing demo state or data. Stock command metrics and category controls use white surfaces and restrained blue/teal accents. Retail POS balances catalogue and checkout columns and adds explicitly illustrative industry tiles to catalogue cards.

Existing data sources, owner-only cost visibility, stock filters, quantity controls, prescription/FEFO checks, payment handling and checkout commands remain the source of behavior. The imagery does not claim to depict a specific SKU. The special textile checkout and full authenticated owner mobile layout still require their own convergence work; the general inventory catalogue does not yet reproduce the demo shipment/landed-cost panels.

Validation: TypeScript, changed-file ESLint and all 259 tests pass. Authenticated browser verification is pending account access; the user previously declined login handoff. This is a route integration increment, not a claim that every reference composition or production workflow is complete.


The actual pharmacy/textile Owner Pulse now shares light surfaces, readable dark text, photographic sector title banners and a wider 650px mobile canvas. Its real alerts, period switch, financial calculations, action links and five-tab navigation are retained. Existing explicitly labelled sample states for organizations without transactions are unchanged. Other sectors still have the existing unsupported-sector state; this revision does not claim to implement their production analytics.


## Cosmetics product imagery correction

Eight cosmetics sample SKUs now map to distinct photographs in `lakbiz/app/public/images/cosmetics-products-atlas-v2.webp`: COS-0001 serum, COS-0002 lipstick, COS-0003 sunscreen, COS-0004 cream, COS-0005 foundation, COS-0006 perfume, COS-0007 brushes and COS-0008 hair mask. The shared ProductPhoto component applies this mapping across POS, inventory, overview and Owner Pulse. Existing prices, inventory, sale history and client-local mock records are preserved. Photography is generated illustrative sample packaging, not a real brand catalogue.

Asset generated using the built-in image-generation tool; encoded as WebP without compositional editing. Final generation prompt:

Use case: product-mockup. Asset type: a single photographic sprite sheet for an ERP cosmetics demo catalogue. Generate exactly 8 equally sized square cells, 4 columns by 2 rows, perfectly aligned edge to edge, no gutters, no text, no borders. Each cell has a clean pale white-blue studio background and one centered product with ample margins, fully visible, premium realistic product photography. Exact order left to right: TOP ROW: 1 amber glass skincare serum dropper bottle 30ml; 2 opened rosewood pink lipstick in elegant black case; 3 white sunscreen squeeze tube with yellow cap; 4 white moisturizer cream jar with teal lid. BOTTOM ROW: 5 beige liquid foundation glass pump bottle; 6 elegant clear perfume bottle with pale gold liquid and gold spray cap; 7 a set of makeup brushes with soft black bristles and rose gold handles; 8 green restorative hair mask tub with botanical detail. Products must be visually distinct and recognizable. No brand logos, letters, captions or watermark. Sheet aspect ratio 2:1, each cell square.
