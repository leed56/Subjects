# Grocery product image sources

These local product photographs are used only for the matching products. Barcode mappings live in `src/components/sales/grocery-product-art.tsx`.

| Product match | Local asset | Verification / image source |
| --- | --- | --- |
| Altunsa Cola Drink, barcode `8697449910575` | `public/images/grocery/brands/altunsa-cola.jpg` | [CompreMarket product image and 9 g listing](https://www.compremarket.com/catalog/refresco-instantaneo-sabor-cola-altunsa-9-g-303806); the 9 g Cola envelope is also shown in the [Altunsa manufacturer catalogue, printed page 25](https://altunkaya.com/KATALOGLAR_WEB20240516/Altunsa_gida_katalog_2017-son-CON.pdf). |
| Altunsa Mango Drink, barcode `8697449910735` | `public/images/grocery/brands/altunsa-mango.jpg` | [Altunsa manufacturer catalogue, printed page 25](https://altunkaya.com/KATALOGLAR_WEB20240516/Altunsa_gida_katalog_2017-son-CON.pdf), “Powder Drink Mango Envelope 9 Gr.” |
| Altunsa Orange Drink, barcode `8697449910810` | `public/images/grocery/brands/altunsa-orange.jpg` | [Altunsa manufacturer catalogue, printed page 26](https://altunkaya.com/KATALOGLAR_WEB20240516/Altunsa_gida_katalog_2017-son-CON.pdf), “Powder Drink Orange Envelope 9 Gr.” |
| Abha Colour Liquid, barcode `4796022660587` | `public/images/grocery/brands/abha-colour-liquid-21ml.jpg` | [Daraz product photo and listing](https://www.daraz.lk/products/abha-5-minute-hair-colour-liquid-21ml-i135373980.html); [barcode listing](https://mart.mrdeal.lk/product/abha-5-minute-hair-colour-liquid--21ml/4796022660587) identifies the 21 ml variant. |
| Abha Herbal Black Henna 10 g, barcode `4796022661980` | `public/images/grocery/brands/abha-henna-black-10g.jpg` | [ShopX product photo and listing](https://shopxonline.lk/products/abha-henna-herbal-black-10g); [barcode listing](https://mart.mrdeal.lk/product/abha-herbal-black-henna-10g/4796022661980). |
| Alli Thosai Mixture 400 g, barcode `4792057036014` | `public/images/grocery/brands/alli-thosai-mixture-400g.jpg` | [Daraz product photo and listing](https://www.daraz.lk/products/thosai-mixture-400g-i120847278.html); [matching barcode listing](https://mart.mrdeal.lk/product/alli_thosai_mixture_400g/4792057036014). |
| Ajinomoto / monosodium glutamate | `public/images/grocery/brands/ajinomoto-msg-100g.jpg` | [Daraz 100 g AJI-NO-MOTO pack photo](https://www.daraz.lk/products/ajinomoto-msg-seasonings-100g-i324710663.html); [Ajinomoto Malaysia product information](https://www.ajinomoto.com.my/brands/retail-product/aji-no-moto) confirms the product is MSG. The shop sells this line in bulk, so the pack is a brand reference rather than its measured sale quantity. |

## Image handling

- Images are cropped locally to remove surrounding listing whitespace and fit the square product-card frame. The product/package artwork itself has not been altered.
- Product photos and trademarks remain the property of their respective owners. This source log records provenance; it does not grant a commercial reuse license. Confirm reuse rights with the brand or supplier before a public production release.
- A generic name such as “Al - Nuaim Perfume” does not establish a scent or package size. It intentionally receives the neutral image placeholder until the shop confirms the exact variant or supplies its own photo.
- Unmatched products use the neutral placeholder rather than an unrelated product illustration. No image URL or shop record is written to the database by this mapping.
