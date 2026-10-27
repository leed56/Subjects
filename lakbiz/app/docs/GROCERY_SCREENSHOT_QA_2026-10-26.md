# Grocery screenshot-by-screenshot QA — 2026-10-26

The five screenshots supplied by the owner show the current deployed screens
before this branch. Checks below compare that evidence with an isolated local
build. The live Lanka Grocery shop has **not** been edited for this review.

| Screenshot | Visible issue | Branch correction | Local result / remaining check |
| --- | --- | --- | --- |
| 10:52:23 Sinhala POS | Three narrow product columns force Sinhala names and units into tall uneven cards. Category chips and toolbar are crowded. | Keep product grid at two columns beside desktop cart until 2xl; place stock on its own line and show only the selling unit. Preserve horizontal category scrolling. | 1280px Sinhala no horizontal overflow; cards retain readable words. Exact deployment still needs QA. |
| 10:52:23 Sinhala POS | Product images and labels have inconsistent visual space; cart starts far below in the long full-page capture. | Fixed-height contained product art, equal image region and compact card content. Cart remains next to the first product row on desktop; mobile stacks cart below the catalogue. | Local desktop/mobile visual pass; inspect active cart after staging sale. |
| 10:52:12 Sinhala dashboard | POS badge becomes a vertical column in the search row; navigation labels are cut off. | Search text can shrink while POS badge stays horizontal. Grocery sidebar labels wrap into two lines. | Local 1280px and 390px visual pass. |
| 10:52:12 Sinhala dashboard | Empty chart shows a large blank box with misleading tiny bars; category donut squeezes long empty-state text into its centre. | Show an honest no-sales message. Centre the zero and short no-sales label in the ring, with detailed explanation beside/below it. | Local empty-state visual pass. Real completed-sale chart awaits isolated staging data. |
| 10:51:58 plans | Free-plan screen says cloud backup is active; the actual project has no scheduled backups. Sinhala copy contains transliterated English fragments, and card badges use English words. | Changed the claim to cloud sync; clarified plan and account wording, localized trial days and replaced text badges with symbols. Added Tamil coverage for this page. | Local EN/SI/TA desktop/mobile render pass. Native wording review remains open. |
| 10:51:39 Tamil POS | Product cards stack one Tamil character per line, producing extremely tall uneven rows; category strip overflows. | Two-column desktop cards, one-column mobile cards, `min-width: 0` grid children and scrollable category strip. | Automated 1280px/390px EN/SI/TA route check has zero document overflow. 390px POS overflow of 319px was detected and corrected. |
| 10:51:26 Tamil dashboard | Vertical POS badge, cramped shortcut labels, ring text and sidebar truncation. | Horizontal POS badge, wrapping navigation and shorter ring centre text. | Local visual pass at 1280px and 390px. Some Tamil terms still need native reviewer approval. |

The layout browser check covers POS, dashboard and plans at **1280px** and
**390px** in **English, Sinhala and Tamil** (18 route/locale/width combinations).
It checks document overflow and saves full-page captures to a temporary local
directory. The check uses a demo-only starter catalogue, not the actual shop.
Stock's two optional import confirmations were also checked at both widths.

Remaining visual gates: exact PR preview, authenticated owner and cashier,
real cart and bill state, keyboard focus/contrast review, and device printer
and scanner checks. These cannot be claimed from the local demo captures.
