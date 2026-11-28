"use client";

import { useState } from "react";

/* Owner-supplied product photos use the regular img element because product
 * assets may be uploaded to the shop or bundled with the catalogue. */
/* eslint-disable @next/next/no-img-element */

const BARCODE_PRODUCT_IMAGES: ReadonlyArray<{
  barcodes: readonly string[];
  terms: readonly string[];
  src: string;
}> = [
  { barcodes: ["8697449910575"], terms: ["altunsa cola drink"], src: "/images/grocery/brands/altunsa-cola.jpg" },
  { barcodes: ["8697449910735"], terms: ["altunsa mango drink"], src: "/images/grocery/brands/altunsa-mango.jpg" },
  { barcodes: ["8697449910810"], terms: ["altunsa orange drink"], src: "/images/grocery/brands/altunsa-orange.jpg" },
  { barcodes: ["4791085292034"], terms: ["anchor drinking yoghurt mango 180ml"], src: "/images/grocery/brands/anchor-mango-yoghurt-180ml.jpg" },
  { barcodes: ["4791085011079"], terms: ["anchor 400g"], src: "/images/grocery/brands/anchor-full-cream-milk-powder-400g.jpg" },
  { barcodes: ["4791085292997"], terms: ["anchor 200g"], src: "/images/grocery/brands/anchor-full-cream-milk-powder-200g.jpg" },
  { barcodes: ["4792081022410"], terms: ["clear shampoo cfc 80ml"], src: "/images/grocery/brands/clear-complete-soft-care-80ml.jpg" },
  { barcodes: ["3086126691565"], terms: ["bic comfort3", "bic 3 sencitive razor", "bic 3 sensitive razor"], src: "/images/grocery/brands/bic-3-sensitive-razor.jpg" },
  { barcodes: ["3086127501122"], terms: ["bic easy2 racer", "bic easy 2 razor"], src: "/images/grocery/brands/bic-easy-2-razor.jpg" },
  { barcodes: ["4791111142159"], terms: ["baby cheramy soap 90g"], src: "/images/grocery/brands/baby-cheramy-soap-almond-oil-90g.jpg" },
  { barcodes: ["4792172003526"], terms: ["bee honey 30ml", "siddhalepa pure bee honey 30ml"], src: "/images/grocery/brands/siddhalepa-pure-bee-honey-30ml.jpg" },
  { barcodes: ["4791034027410"], terms: ["maliban gold marie 75g", "maliban gold mari 75g"], src: "/images/grocery/brands/maliban-gold-marie-75g.jpg" },
  { barcodes: ["4791034005111"], terms: ["maliban chocolate cream 100g", "maliban real chocolate cream biscuit 100g"], src: "/images/grocery/brands/maliban-chocolate-cream-100g.jpg" },
  { barcodes: ["4791034072366"], terms: ["maliban chocolate biscits 200g", "maliban chocolate biscuits 200g", "maliban real chocolate cream biscuit 200g"], src: "/images/grocery/brands/maliban-chocolate-cream-200g.jpg" },
  { barcodes: ["4791034070270"], terms: ["maliban chocolate puff 100g", "maliban chocolate puff biscuits 100g"], src: "/images/grocery/brands/maliban-chocolate-puff-100g.jpg" },
  { barcodes: ["4791034070287"], terms: ["maliban chocolate puff 200g", "maliban chocolate puff biscuits 200g"], src: "/images/grocery/brands/maliban-chocolate-puff-200g.jpg" },
  { barcodes: ["8888101281205"], terms: ["munchee chocolate marie biscuits 90g", "munchee chocolate marie 90g"], src: "/images/grocery/brands/munchee-chocolate-marie-90g.jpg" },
  { barcodes: ["8888101502003"], terms: ["munchee choco wafers 85g", "munchee chocolate cream wafers 85g", "munchee chocolate cream wafer 85g"], src: "/images/grocery/brands/munchee-chocolate-cream-wafer-85g.jpg" },
  { barcodes: ["8904060000005"], terms: ["amins black henna 10g", "amin s black henna 10g"], src: "/images/grocery/brands/amins-black-henna-10g.jpg" },
  { barcodes: ["4792057039220"], terms: ["alli gram flour 200g"], src: "/images/grocery/brands/alli-gram-flour-200g.jpg" },
  { barcodes: ["4792057037011"], terms: ["alli oried flour 200g", "alli oreid flour 200g", "alli orid flour 200g"], src: "/images/grocery/brands/alli-oried-flour-200g.jpg" },
  { barcodes: [], terms: ["cherish choco wafers 30g", "cherish chocolate wafers 30g"], src: "/images/grocery/brands/cherish-choco-wafers-30g.jpg" },
  { barcodes: ["4796001410400"], terms: ["chello yougut drink v 180ml", "chello yogurt drink v 180ml"], src: "/images/grocery/brands/chello-rich-yoghurt-drink-vanilla-180ml.png" },
  { barcodes: ["4792116609609"], terms: ["ambewela fresh milk 450ml", "ambewela fresh mlk450ml"], src: "/images/grocery/brands/ambewela-fresh-milk-450ml.jpg" },
  { barcodes: ["4796001410318"], terms: ["chello set kiri 450g"], src: "/images/grocery/brands/chello-set-kiri-450g.jpg" },
  { barcodes: ["4792190132598"], terms: ["sunquick orange f drink"], src: "/images/grocery/brands/sunquick-orange-125ml.jpg" },
  { barcodes: ["4792190132611"], terms: ["sunquick orange flv drink"], src: "/images/grocery/brands/sunquick-orange-200ml.jpg" },
  { barcodes: ["4792190132628"], terms: ["sunquick mix drink 200ml", "sunquick mixed fruit drink 200ml"], src: "/images/grocery/brands/sunquick-mixed-200ml.jpg" },
  { barcodes: ["4792190132833"], terms: ["sunquick berry flv drink 200ml", "sunquick berry mix fruit drink 200ml"], src: "/images/grocery/brands/sunquick-berry-200ml.jpg" },
  { barcodes: ["4792232007099"], terms: ["littlelion maderira cake 325g", "little lion madeira cake 325g"], src: "/images/grocery/brands/little-lion-madeira-cake-325g.jpg" },
  { barcodes: ["4792232083055"], terms: ["little lion choco roll cake 200g"], src: "/images/grocery/brands/little-lion-chocolate-roll-200g.jpg" },
  { barcodes: ["4792116204132"], terms: ["apple juice", "my juicee apple nectar 180ml"], src: "/images/grocery/brands/my-juicee-apple-180ml.jpg" },
  { barcodes: ["4792024021838"], terms: ["milo 15g", "nestle milo 15g"], src: "/images/grocery/brands/milo-15g.jpg" },
  { barcodes: ["4796000040042"], terms: ["coconut oil 200ml", "n joy pure coconut oil 200ml"], src: "/images/grocery/brands/njoy-coconut-oil-200ml.jpg" },
  { barcodes: ["4792212000256"], terms: ["ed coconut vinegar 350ml", "edinborough coconut vinegar 350ml"], src: "/images/grocery/brands/edinborough-coconut-vinegar-350ml.jpg" },
  { barcodes: ["4792090045028"], terms: ["kotmale vanilla icecream 1l", "kotmale vanilla ice cream 1l"], src: "/images/grocery/brands/kotmale-vanilla-icecream-1l.webp" },
  { barcodes: ["4792090030024"], terms: ["chocolate icecream 1l", "kotmale chocolate ice cream 1l"], src: "/images/grocery/brands/kotmale-chocolate-icecream-1l.jpg" },
  { barcodes: ["4792090030031"], terms: ["chocolate icecream 2l", "kotmale chocolate ice cream 2l"], src: "/images/grocery/brands/kotmale-chocolate-icecream-2l.jpg" },
  { barcodes: ["4792090115004"], terms: ["kotmale yoghurt 80g", "kotmale set yoghurt 80g"], src: "/images/grocery/brands/kotmale-set-yoghurt-80g.jpg" },
  { barcodes: [], terms: ["amritha red rose incense sticks"], src: "/images/grocery/brands/amritha-red-rose-incense-sticks.jpg" },
  { barcodes: ["4791010002219"], terms: ["amritha insence sticks r", "amritha incense sticks r", "amritha original red incense sticks"], src: "/images/grocery/brands/amritha-original-red-incense-sticks.jpg" },
  // The imported barcode is not independently corroborated; require the exact
  // Orange 5 g name and use the verified single-sachet package photo.
  { barcodes: [], terms: ["eno orange 5g", "eno orange flavour 5g sachet"], src: "/images/grocery/brands/eno-orange-5g.jpg" },
  { barcodes: ["4792090120015"], terms: ["kotmale milk chocolate 170ml", "kotmale chocolate flavoured milk 170ml"], src: "/images/grocery/brands/kotmale-chocolate-milk-170ml.jpg" },
  { barcodes: ["4791061115227"], terms: ["ke chicken meatballs 200g", "krest chicken meatballs 200g"], src: "/images/grocery/brands/keells-krest-chicken-meatballs-200g.jpg" },
  { barcodes: ["4791061111052"], terms: ["ke chicken sausages 150g", "krest chicken sausages 150g", "krest skinless chicken sausages 150g"], src: "/images/grocery/brands/keells-krest-skinless-chicken-sausages-150g.jpg" },
  { barcodes: ["4791061212032"], terms: ["krest chicken drumsticks 300g", "ke chicken drumsticks 300g"], src: "/images/grocery/brands/keells-krest-chicken-drumsticks-300g.jpg" },
  { barcodes: ["4796022661980"], terms: ["abha herbal black henna", "abha herbal black hennna"], src: "/images/grocery/brands/abha-henna-black-10g.jpg" },
  { barcodes: ["4792057036014"], terms: ["alli thosai mixture"], src: "/images/grocery/brands/alli-thosai-mixture-400g.jpg" },
  { barcodes: [], terms: ["akshata rice kuruluthuda 800g"], src: "/images/grocery/brands/akshata-rice-kuruluthuda-800g.jpg" },
  { barcodes: ["4796025380024"], terms: ["astra 100g"], src: "/images/grocery/brands/astra-fat-spread-100g.jpg" },
  { barcodes: [], terms: ["astra 18g", "astra multipurpose 18g"], src: "/images/grocery/brands/astra-multipurpose-18g.jpg" },
  { barcodes: ["4796025380031", "4796025380741"], terms: ["astra 250g"], src: "/images/grocery/brands/astra-fat-spread-250g.jpg" },
  { barcodes: [], terms: ["chicken liver"], src: "/images/grocery/brands/chicken-liver.jpg" },
  { barcodes: ["4791111149011"], terms: ["clogard chooty tooth brush"], src: "/images/grocery/brands/clogard-chooty-toothbrush.jpg" },
  { barcodes: ["4791111102016"], terms: ["clogard toothpaste 40g", "clogard tooth paste 40g"], src: "/images/grocery/brands/clogard-toothpaste-40g.jpg" },
  { barcodes: ["4791111102030"], terms: ["clogard toothpaste 120g", "clogard tooth paste 120g"], src: "/images/grocery/brands/clogard-toothpaste-120g.jpg" },
  { barcodes: ["4791111196138"], terms: ["clogard toothpaste 200g"], src: "/images/grocery/brands/clogard-toothpaste-200g.jpg" },
  { barcodes: ["4792229106705"], terms: ["cocacola 1050ml", "coca cola 1050ml", "coca cola 1.05l"], src: "/images/grocery/brands/coca-cola-1050ml.jpg" },
  { barcodes: ["4792229042430"], terms: ["cocacola 400ml", "coca cola 400ml"], src: "/images/grocery/brands/coca-cola-400ml.jpg" },
  { barcodes: ["4792037188115"], terms: ["dettol fresh soap 70g"], src: "/images/grocery/brands/dettol-fresh-soap-70g.jpg" },
  { barcodes: ["4792037315337"], terms: ["dettol orange soap 70g"], src: "/images/grocery/brands/dettol-orange-burst-soap-70g.jpg" },
  { barcodes: ["4792037313234"], terms: ["dettol skin care soap 70g"], src: "/images/grocery/brands/dettol-skin-care-soap-70g.jpg" },
  { barcodes: ["4791066101065"], terms: ["egb 1l"], src: "/images/grocery/brands/egb-1l.jpg" },
  { barcodes: ["4791066003642"], terms: ["egb 250ml"], src: "/images/grocery/brands/elephant-house-egb-250ml.jpg" },
  { barcodes: ["4791066100600"], terms: ["e h cream soda 1l", "elephant house cream soda 1l"], src: "/images/grocery/brands/elephant-house-cream-soda-1l.jpg" },
  { barcodes: ["4792085002258"], terms: ["kotmale milky berry", "kotmale milky pop strawberry 60ml"], src: "/images/grocery/brands/kotmale-milky-pop-strawberry-60ml.jpg" },
  { barcodes: ["4792085002395"], terms: ["choc c ice cream 75ml"], src: "/images/grocery/brands/kotmale-milky-choc-stick-75ml.jpg" },
  { barcodes: ["4792085002388"], terms: ["choc c ice cream 75ml"], src: "/images/grocery/brands/kotmale-milky-choc-vanilla-75ml.jpg" },
  { barcodes: ["4792229067334"], terms: ["fanta portello 400ml"], src: "/images/grocery/brands/fanta-portello-400ml.jpg" },
  { barcodes: [], terms: ["fanta portello 1 05ml", "fanta portello 1050ml"], src: "/images/grocery/brands/fanta-portello-1050ml.jpg" },
  { barcodes: ["4796011471392"], terms: ["fortune coconut oil 1l"], src: "/images/grocery/brands/fortune-coconut-oil-1l.jpg" },
  { barcodes: ["4796011471187"], terms: ["fortune sunflower oil 500ml"], src: "/images/grocery/brands/fortune-sunflower-oil-500ml.jpg" },
  { barcodes: ["4792083040139"], terms: ["harischandra coffee 100g"], src: "/images/grocery/brands/harischandra-coffee-100g.jpg" },
  { barcodes: ["4792068211745"], terms: ["khomba deo talc"], src: "/images/grocery/brands/khomba-deo-talc-100g.jpg" },
  { barcodes: ["4792024020237"], terms: ["maggi chicken 49g"], src: "/images/grocery/brands/maggi-chicken-noodles-49g.jpg" },
  { barcodes: ["4792024020190"], terms: ["maggi chicken 73g"], src: "/images/grocery/brands/maggi-chicken-noodles-73g.jpg" },
  { barcodes: [], terms: ["maggi chicken soup cubes 25 x 4g tin", "maggi chicken soup cubes 25x4g tin", "maggi seasoning cube chicken 25 x 4g", "maggi seasoning cube chicken 25x4g"], src: "/images/grocery/brands/maggi-chicken-cubes-25x4g.jpg" },
  { barcodes: ["4792024016803"], terms: ["maggi vege soup cubes 25 4g tin", "maggi vegetable seasoning cube 25x4g"], src: "/images/grocery/brands/maggi-vegetable-cubes-25x4g.jpg" },
  { barcodes: ["4791034070232"], terms: ["maliban inguru 80g"], src: "/images/grocery/brands/maliban-inguru-biscuits-80g.jpg" },
  { barcodes: ["4792551036039"], terms: ["motha baking powder 100g"], src: "/images/grocery/brands/motha-baking-powder-100g.jpg" },
  { barcodes: ["4792551032017"], terms: ["motha gelatine 30g"], src: "/images/grocery/brands/motha-gelatine-30g.jpg" },
  { barcodes: ["4792551000313"], terms: ["motha orange jelly 100g"], src: "/images/grocery/brands/motha-orange-jelly-100g.jpg" },
  { barcodes: ["8888101080402"], terms: ["munchee hawaian cookies 200g"], src: "/images/grocery/brands/munchee-hawaiian-cookies-200g.jpg" },
  { barcodes: ["8888101287238"], terms: ["munchee lite marie 50g"], src: "/images/grocery/brands/munchee-lite-marie-50g.jpg" },
  { barcodes: ["8888101030407"], terms: ["munchee milk short cake 200g"], src: "/images/grocery/brands/munchee-milk-short-cake-200g.jpg" },
  { barcodes: ["8888101430337"], terms: ["munchee super cream cracker 190g"], src: "/images/grocery/brands/munchee-super-cream-crackers-190g.jpg" },
  { barcodes: ["8888101931193"], terms: ["munchee tifin onion 125g"], src: "/images/grocery/brands/munchee-tifin-onion-125g.jpg" },
  { barcodes: ["8888101932190"], terms: ["munchee tifin original 125g"], src: "/images/grocery/brands/munchee-tifin-original-125g.jpg" },
  { barcodes: ["4791066100617"], terms: ["necto 1l"], src: "/images/grocery/brands/necto-1l.jpg" },
  { barcodes: ["4791066004113"], terms: ["necto 500ml"], src: "/images/grocery/brands/necto-500ml.jpg" },
  { barcodes: ["4797001021016"], terms: ["ocean star jack mackerel 425g", "ocean star jack mackerel canned fish 425g", "ocean star jack mackerel fish 425g"], src: "/images/grocery/brands/ocean-star-jack-mackerel-425g.jpg" },
  { barcodes: ["4791066100631"], terms: ["orange crush 500ml"], src: "/images/grocery/brands/orange-crush-500ml.jpg" },
  { barcodes: ["4792229048739"], terms: ["sprite 400ml"], src: "/images/grocery/brands/sprite-400ml.jpg" },
  { barcodes: ["4792068121525"], terms: ["panda baby soap rathmal 75g"], src: "/images/grocery/brands/panda-baby-soap-rathmal-75g.jpg" },
  { barcodes: ["4792149050140"], terms: ["raigam coconut vinegar 350ml"], src: "/images/grocery/brands/raigam-coconut-vinegar-350ml.jpg" },
  { barcodes: ["4792149050164"], terms: ["raigam coconut vinegar 750ml"], src: "/images/grocery/brands/raigam-coconut-vinegar-750ml.jpg" },
  { barcodes: ["4797777007085"], terms: ["richlife cheese wedges 120g"], src: "/images/grocery/brands/richlife-cheese-wedges-120g.jpg" },
  { barcodes: ["4797777002196"], terms: ["richlife faluda milk 180ml"], src: "/images/grocery/brands/richlife-faluda-milk-180ml.jpg" },
  { barcodes: ["4797777002042"], terms: ["richlife iced coffee 180ml"], src: "/images/grocery/brands/richlife-iced-coffee-180ml.jpg" },
  { barcodes: ["4792192061209"], terms: ["tiara vanilla swiss roll 200g"], src: "/images/grocery/brands/tiara-vanilla-swiss-roll-200g.jpg" },
  { barcodes: ["4796005675850"], terms: ["vim liquid anti bacterial 500ml", "vim dishwash liquid anti bacterial 500ml"], src: "/images/grocery/brands/vim-antibacterial-dishwash-500ml.jpg" },
  { barcodes: [], terms: ["glucolin 100g"], src: "/images/grocery/brands/glucolin-100g.jpg" },
  { barcodes: ["4792099011130"], terms: ["iodex 9g"], src: "/images/grocery/brands/iodex-9g.jpg" },
  { barcodes: ["4792083010118"], terms: ["harischandra noodles 400g"], src: "/images/grocery/brands/harischandra-plain-noodles-400g.jpg" },
  { barcodes: ["4792083000225"], terms: ["hari rice flour 400g", "harischandra white rice flour 400g"], src: "/images/grocery/brands/harischandra-rice-flour-400g.jpg" },
  { barcodes: ["4792083000119"], terms: ["hari ulundu flour 200g", "harischandra ulundu flour 200g"], src: "/images/grocery/brands/harischandra-ulundu-flour-200g.jpg" },
  { barcodes: ["4792083030383"], terms: ["aththora soap70g", "aththora soap 70g", "harischandra aththora soap 70g", "harischandra aththora herbal soap 70g"], src: "/images/grocery/brands/harischandra-aththora-soap-70g.jpg" },
  { barcodes: ["4792024022088"], terms: ["milo drink 180ml"], src: "/images/grocery/brands/milo-drink-180ml.jpg" },
  { barcodes: ["4791034015424"], terms: ["maliban krisco 215g"], src: "/images/grocery/brands/maliban-krisco-215g.jpg" },
  { barcodes: ["4792081040940", "4792081040803"], terms: ["lux soap gardenia 100g"], src: "/images/grocery/brands/lux-gardenia-soap-100g.jpg" },
  { barcodes: ["4796002070160"], terms: ["lankasoy chicken 90g", "lanka soy chicken 90g", "lankasoy chicken 90 g", "lanka soy chicken 90 g"], src: "/images/grocery/brands/lankasoy-chicken-90g.jpg" },
  { barcodes: ["4796002070313"], terms: ["lankasoy devilled prawn soya 90g", "lanka soy devilled prawn 90g", "lankasoy devilled prawn soya 90 g", "lanka soy devilled prawn 90 g"], src: "/images/grocery/brands/lankasoy-devilled-prawn-90g.jpg" },
  { barcodes: ["4796002070306"], terms: ["cbl cuttlefish soya meat 90g", "lankasoy malu soy cuttle fish 90g", "cbl cuttlefish soya meat 90 g", "lankasoy malu soy cuttle fish 90 g"], src: "/images/grocery/brands/lankasoy-malu-cuttlefish-90g.jpg" },
  // Ammar's loose dried-fish rows have no brand, barcode, or net weight; use
  // photos of the fish itself without implying a pack or supplier.
  { barcodes: [], terms: ["katta karawala"], src: "/images/grocery/brands/katta-karawala.jpg" },
  { barcodes: [], terms: ["keeramin karawala", "keeramin krawala"], src: "/images/grocery/brands/keeramin-karawala.jpg" },
  { barcodes: ["4796016600025"], terms: ["prima flour 1kg"], src: "/images/grocery/brands/prima-chakki-atta-1kg.jpg" },
  { barcodes: ["4792018425024"], terms: ["kottu mee raman cheese 114g", "prima kottu mee korean ramen fiery cheese 114g"], src: "/images/grocery/brands/prima-kottu-mee-fiery-cheese-114g.jpg" },
  { barcodes: ["8888101611262"], terms: ["munchee cheese buttons 20g"], src: "/images/grocery/brands/munchee-cheese-buttons-20g.jpg" },
  { barcodes: ["8888101131203"], terms: ["munchee cheese cracker 100g"], src: "/images/grocery/brands/munchee-cheese-cracker-100g.jpg" },
  { barcodes: ["4792018234312"], terms: ["prima stella chicken 74g", "prima stella chicken 74 g"], src: "/images/grocery/brands/prima-stella-chicken-74g.jpg" },
  { barcodes: ["4792018424997"], terms: ["prima kottu mee korean ramen fiery chicken 110g", "prima kottu mee korean ramen fiery chicken 110 g", "kottu mee raman fiery chicken 110g", "kottu mee raman fiery chicken 110 g"], src: "/images/grocery/brands/prima-korean-ramen-fiery-chicken-110g.jpg" },
  { barcodes: ["4792018425079"], terms: ["prima kottu mee korean ramen seafood flavour 116g", "prima kottu mee korean ramen seafood flavour 116 g", "kottu mee raman seafood flavour 116g", "kottu mee raman seafood flavour 116 g"], src: "/images/grocery/brands/prima-korean-ramen-seafood-116g.jpg" },
  { barcodes: ["4792212008238"], terms: ["ed tomato sauce 200g"], src: "/images/grocery/brands/edinborough-tomato-sauce-200g.jpg" },
  { barcodes: ["4792212002403"], terms: ["ed tomato sauce 1kg", "ed tomato sause 1kg"], src: "/images/grocery/brands/edinborough-tomato-sauce-1kg.jpg" },
  { barcodes: ["4792212008566"], terms: ["ed fish sauce 170ml", "ed fish sause170ml"], src: "/images/grocery/brands/edinborough-fish-sauce-170ml.jpg" },
  { barcodes: ["4792212002823"], terms: ["edin boro tomato sauce 15g", "edinborough tomato ketchup 15g"], src: "/images/grocery/brands/edinborough-tomato-ketchup-15g.jpg" },
  { barcodes: ["4792083030512"], terms: ["harischandra coffee 20g", "hari coffee 20g"], src: "/images/grocery/brands/harischandra-coffee-20g.jpg" },
  { barcodes: ["4792083040122"], terms: ["harischandra coffee 50g", "hari coffee 50g"], src: "/images/grocery/brands/harischandra-coffee-50g.jpg" },
  { barcodes: ["4792024005814"], terms: ["maggi real coconut powder 25g", "maggi coconut milk powder 25g"], src: "/images/grocery/brands/maggi-coconut-milk-powder-25g.jpg" },
  { barcodes: ["4792024021173"], terms: ["nescafe 3 in 1 coffee 18g", "nescafe coffee 18g", "nescafe 18g"], src: "/images/grocery/brands/nescafe-3in1-18g.jpg" },
  { barcodes: ["4792024014601"], terms: ["nescafe ice coffee 180ml", "nescafe iced coffee 180ml"], src: "/images/grocery/brands/nescafe-ice-coffee-180ml.jpg" },
  { barcodes: ["4796002514008"], terms: ["sera coconut milk 180ml"], src: "/images/grocery/brands/sera-coconut-milk-180ml.jpg" },
  { barcodes: ["4796011471217"], terms: ["fortune coconut oil 200ml"], src: "/images/grocery/brands/fortune-coconut-oil-200ml.jpg" },
  { barcodes: ["4796011471385"], terms: ["fortune coconut oil 500ml"], src: "/images/grocery/brands/fortune-coconut-oil-500ml.jpg" },
  { barcodes: ["4792143130329"], terms: ["kist mixed fruit nectar 200ml"], src: "/images/grocery/brands/kist-mixed-fruit-nectar-200ml.jpg" },
  { barcodes: ["4792143130428"], terms: ["kist woodapple nectar 200ml", "kist wood apple nectar 200ml"], src: "/images/grocery/brands/kist-woodapple-nectar-200ml.jpg" },
  { barcodes: ["4792098073528"], terms: ["md mixed fruit cordial 400ml"], src: "/images/grocery/brands/md-mixed-fruit-cordial-400ml.jpg" },
  { barcodes: ["4792098075522"], terms: ["md orange cordial 400ml"], src: "/images/grocery/brands/md-orange-cordial-400ml.jpg" },
  { barcodes: ["4791066101072"], terms: ["e h soda 1l", "elephant house soda 1l"], src: "/images/grocery/brands/elephant-house-soda-1l.jpg" },
  { barcodes: ["4791066004137"], terms: ["e h soda 500ml", "elephant house soda 500ml"], src: "/images/grocery/brands/elephant-house-soda-500ml.jpg" },
  { barcodes: ["4791066100624"], terms: ["e h lemonade 1l", "elephant house lemonade 1l"], src: "/images/grocery/brands/elephant-house-lemonade-1l.jpg" },
  { barcodes: ["4791066100723"], terms: ["e h kik cola 1l", "elephant house kik cola 1l"], src: "/images/grocery/brands/elephant-house-kik-cola-1l.jpg" },
  { barcodes: ["8901157102208"], terms: ["hitline chalk"], src: "/images/grocery/brands/good-knight-hitline-chalk.jpg" },
  // Batch B1 — verified Sri Lankan retail pack photos for Ammar Farmshop
  { barcodes: [], terms: ["e h orange barley 1 5l","elephant house orange barley 1 5l"], src: "/images/grocery/brands/elephant-house-orange-barley-1-5l.jpg" },
  { barcodes: ["4792551000047"], terms: ["motha blackcurrant jelly 100g","motha blackcurrant flavoured jelly 100g"], src: "/images/grocery/brands/motha-blackcurrant-flavoured-jelly-100g.jpg" },
  { barcodes: ["4796005650550"], terms: ["vim soap 100g"], src: "/images/grocery/brands/vim-soap-100g.jpg" },
  { barcodes: ["4791034017015"], terms: ["maliban lemon puff 200g"], src: "/images/grocery/brands/maliban-lemon-puff-200g.jpg" },
  { barcodes: ["4792068132521"], terms: ["rani soap sw 90g","rani sandlwood with rose water saffron soap"], src: "/images/grocery/brands/rani-sandlwood-with-rose-water-saffron-soap.jpg" },
  { barcodes: ["4792024021616"], terms: ["nestomalt 400g","nestomalt malted food 400g"], src: "/images/grocery/brands/nestomalt-malted-food-400g.jpg" },
  { barcodes: ["4792090120008"], terms: ["kotmale kiri vanila 170ml","kotmale vanila flavoured milk 170ml"], src: "/images/grocery/brands/kotmale-vanila-flavoured-milk-170ml.jpg" },
  { barcodes: ["4792037120207"], terms: ["lysol lavender 200ml","lysol tile cleaner lavender 200ml"], src: "/images/grocery/brands/lysol-tile-cleaner-lavender-200ml.jpg" },
  { barcodes: ["4791034070546"], terms: ["maliban chocolate cream 400g","maliban real chocolate cream biscuit 400g"], src: "/images/grocery/brands/maliban-real-chocolate-cream-biscuit-400g.jpg" },
  { barcodes: ["4796005673290"], terms: ["marmite 50g","marmite yeast extract spread 50g"], src: "/images/grocery/brands/marmite-yeast-extract-spread-50g.jpg" },
  { barcodes: ["4791010006354"], terms: ["amritha hadunkuru rs150","amritha pineapple incense sticks"], src: "/images/grocery/brands/amritha-pineapple-incense-sticks.png" },
  { barcodes: ["4796005673153"], terms: ["sunlight detetgent powder sakura 1kg","sunlight 2 in 1 sakura fresh powder 1kg"], src: "/images/grocery/brands/sunlight-2-in-1-sakura-fresh-powder-1kg.png" },
  { barcodes: ["4792068111137"], terms: ["kohomba original soap 70g","khomba soap budget pack 70g"], src: "/images/grocery/brands/khomba-soap-budget-pack-70g.jpg" },
  { barcodes: ["4792140000014"], terms: ["cavadi kapuru pkt","cavadi refined camphor 8211 105 tablets"], src: "/images/grocery/brands/cavadi-refined-camphor-8211-105-tablets.jpg" },
  { barcodes: ["4792018244960"], terms: ["kottu mee nai miris 80g","prima kottu mee nai miris instant noodles 80g"], src: "/images/grocery/brands/prima-kottu-mee-nai-miris-instant-noodles-80g.jpg" },
  { barcodes: ["4796005678226"], terms: ["knor seasoning powder","knorr chicken seasoning powder 7 5g"], src: "/images/grocery/brands/knorr-chicken-seasoning-powder-7-5g.jpg" },
  { barcodes: ["4791034070812"], terms: ["maliban cream cracker buddy 85g","maliban smart cream cracker buddy 85g"], src: "/images/grocery/brands/maliban-smart-cream-cracker-buddy-85g.jpg" },
  { barcodes: ["4792551031010"], terms: ["motha cornflour 100g","motha corn flour 100g"], src: "/images/grocery/brands/motha-corn-flour-100g.png" },
  { barcodes: ["4792068132637"], terms: ["rani soap sw 90g","rani sandalwood with jasmine vitamin e soap"], src: "/images/grocery/brands/rani-sandalwood-with-jasmine-vitamin-e-soap.jpg" },
  { barcodes: ["4792135020508"], terms: ["tipi tip","uswatte cheesy ball tipi tip 20g"], src: "/images/grocery/brands/uswatte-cheesy-ball-tipi-tip-20g.jpg" },
  { barcodes: [], terms: ["ruhunu gram flour 200g"], src: "/images/grocery/brands/ruhunu-gram-flour-200g.jpg" },
  { barcodes: ["4791085292225"], terms: ["ratthi 75g","ratthi full cream milk powder75g"], src: "/images/grocery/brands/ratthi-full-cream-milk-powder75g.jpg" },
  { barcodes: ["4791111112312"], terms: ["diva white power 1kg","diva flowers detergent powder jasmine lime 1kg"], src: "/images/grocery/brands/diva-flowers-detergent-powder-jasmine-lime-1kg.png" },
  { barcodes: [], terms: ["rani soap sw 90g","rani soap sandalwood 90g"], src: "/images/grocery/brands/rani-soap-sandalwood-90g.jpg" },
  { barcodes: ["4791111141374"], terms: ["baby cheramy soap 75g","baby cheramy floral baby soap 75g"], src: "/images/grocery/brands/baby-cheramy-floral-baby-soap-75g.jpg" },
  { barcodes: [], terms: ["meadowlea fat spread 100g"], src: "/images/grocery/brands/meadowlea-fat-spread-100g.jpg" },
  { barcodes: [], terms: ["lankasoy soya 90g","lankasoy soya regular 90g"], src: "/images/grocery/brands/lankasoy-soya-regular-90g.jpg" },
  { barcodes: ["4792212003110"], terms: ["eaden soya sauce 650ml"], src: "/images/grocery/brands/eaden-soya-sauce-650ml.png" },
  { barcodes: [], terms: ["e h cream soda 500ml","elephant house cream soda 500ml"], src: "/images/grocery/brands/elephant-house-cream-soda-500ml.jpg" },
  { barcodes: ["4791010005678"], terms: ["amritha insence sticks rose","amritha gia 12 sticks 15g"], src: "/images/grocery/brands/amritha-gia-12-sticks-15g.jpg" },
  { barcodes: ["4791034042116"], terms: ["maliban smart cream cracker 190g","maliban smart cream crackers 190g"], src: "/images/grocery/brands/maliban-smart-cream-crackers-190g.jpg" },
  { barcodes: ["4792019419800"], terms: ["eva purpel 10pads","eva dritex wings 10 sanitary napkins"], src: "/images/grocery/brands/eva-dritex-wings-10-sanitary-napkins.jpg" },
  { barcodes: ["4792081022229"], terms: ["fair lovely ayurvedic care 15g","fair lovely advanced multi vitamin cute pack 15g"], src: "/images/grocery/brands/fair-lovely-advanced-multi-vitamin-cute-pack-15g.png" },
  { barcodes: ["4792551010015"], terms: ["motha caramel","motha caramel pudding mix 100g"], src: "/images/grocery/brands/motha-caramel-pudding-mix-100g.png" },
  { barcodes: ["4792018233148"], terms: ["prima toppz spice up flavour 80g","prima toppz broad instant noodles 80g"], src: "/images/grocery/brands/prima-toppz-broad-instant-noodles-80g.jpg" },
  { barcodes: ["4792149602004"], terms: ["ravan haircolour shampoo 21ml","ravana black hair colour liquid 21ml"], src: "/images/grocery/brands/ravana-black-hair-colour-liquid-21ml.jpg" },
  { barcodes: ["4792024011792"], terms: ["nestle milkmaid 390g"], src: "/images/grocery/brands/nestle-milkmaid-390g.jpg" },
  { barcodes: ["4792024022217"], terms: ["nestle milkmaid 510g"], src: "/images/grocery/brands/nestle-milkmaid-510g.jpg" },
  { barcodes: ["8901499008305"], terms: ["nutriline corn flakes honey 125g","kellogg 8217 s corn flakes real honey 125g"], src: "/images/grocery/brands/kellogg-8217-s-corn-flakes-real-honey-125g.jpg" },
  { barcodes: ["4791111154244"], terms: ["gold hair wax almond 100ml","gold hair styling wax nourishing almond 100ml"], src: "/images/grocery/brands/gold-hair-styling-wax-nourishing-almond-100ml.png" },
  { barcodes: ["4792551010237"], terms: ["motha faluda mix 100g","motha rose flavoured faluda mix 100g"], src: "/images/grocery/brands/motha-rose-flavoured-faluda-mix-100g.png" },
  { barcodes: ["4796005673986"], terms: ["knor seasoning powder","knorr maldive fish powder mixture 8g"], src: "/images/grocery/brands/knorr-maldive-fish-powder-mixture-8g.jpg" },
  { barcodes: ["4792232001158"], terms: ["little lion milky cookies","little lion batter carol cookies 270g"], src: "/images/grocery/brands/little-lion-batter-carol-cookies-270g.jpg" },
  { barcodes: ["4792098455751"], terms: ["md strawberry jam 150g","md strawberry flavour melon jam 150g"], src: "/images/grocery/brands/md-strawberry-flavour-melon-jam-150g.jpg" },
  { barcodes: ["4791034071567"], terms: ["maliban gold marie 350g"], src: "/images/grocery/brands/maliban-gold-marie-350g.jpg" },
  { barcodes: ["4792068112233"], terms: ["rani soap sw 70g","rani sandalwood soap budget pack 70g"], src: "/images/grocery/brands/rani-sandalwood-soap-budget-pack-70g.jpg" },
  { barcodes: ["4792098687145"], terms: ["md tomato sauce 400g","md super chef tomato sauce 400g"], src: "/images/grocery/brands/md-super-chef-tomato-sauce-400g.jpg" },
  { barcodes: ["4792098089031"], terms: ["md tomato sause 200g","md original tomato sauce 200g"], src: "/images/grocery/brands/md-original-tomato-sauce-200g.jpg" },
  { barcodes: ["8888101430153"], terms: ["munchee super cream cracker 125g"], src: "/images/grocery/brands/munchee-super-cream-cracker-125g.jpg" },
  { barcodes: ["4792081030279"], terms: ["pears bed time 70g","pears bedtime baby soap 70g"], src: "/images/grocery/brands/pears-bedtime-baby-soap-70g.jpg" },
  { barcodes: ["4792037107703"], terms: ["harpic power 200ml","harpic toilet cleaner power plus 200ml"], src: "/images/grocery/brands/harpic-toilet-cleaner-power-plus-200ml.jpg" },
  { barcodes: ["4792212011863"], terms: ["eaden tomato sauce 1kg","eaden tomato sauce 1kg economy pack"], src: "/images/grocery/brands/eaden-tomato-sauce-1kg-economy-pack.webp" },
  { barcodes: ["8901499007704"], terms: ["kelloggs oats 200g","kellog 8217 s rolled oats 200g"], src: "/images/grocery/brands/kellog-8217-s-rolled-oats-200g.png" },
  // Batch B2 — exact-barcode-corroborated Sri Lankan retail pack photos for Ammar Farmshop
  { barcodes: ["4792081013685"], terms: ["vaseline deep restore 40ml","vaseline deep restore serum in lotion 40ml"], src: "/images/grocery/brands/vaseline-deep-restore-serum-in-lotion-40ml.jpg" },
  { barcodes: ["4792081019243"], terms: ["pears baby cologne 100ml","pears happy hero baby cologne 100ml"], src: "/images/grocery/brands/pears-happy-hero-baby-cologne-100ml.jpg" },
  { barcodes: ["4792081019250"], terms: ["pears baby cologne 100ml","pears flower fairy baby cologne 100ml"], src: "/images/grocery/brands/pears-flower-fairy-baby-cologne-100ml.jpg" },
  { barcodes: ["4792067406364"], terms: ["n joy white coconut oil 500ml","n joy pure white coconut oil 500ml"], src: "/images/grocery/brands/n-joy-pure-white-coconut-oil-500ml.jpg" },
  { barcodes: ["8888101430276"], terms: ["munchee super cream cracker 85g"], src: "/images/grocery/brands/munchee-super-cream-cracker-85g.jpg" },
  { barcodes: ["4792172002024"], terms: ["siddha supiriwiki 40g","siddhalepa original supirivicky ayurvedic toothpaste 40g"], src: "/images/grocery/brands/siddhalepa-original-supirivicky-ayurvedic-toothpaste-40g.jpg" },
  { barcodes: ["4791010002066"], terms: ["denta comfort t brush m","denta comfort adult toothbrush medium"], src: "/images/grocery/brands/denta-comfort-adult-toothbrush-medium.jpg" },
  { barcodes: ["4791111100203"], terms: ["cheramy baby talc classic 100g","baby cheramy baby talc 100g"], src: "/images/grocery/brands/baby-cheramy-baby-talc-100g.jpg" },
  { barcodes: ["4792081038572"], terms: ["pears baby kokum 70g","pears pure gentle baby soap 70gx2"], src: "/images/grocery/brands/pears-pure-gentle-baby-soap-70gx2.jpg" },
  { barcodes: ["4792081038336"], terms: ["pears rathmal soap 70g","pears bee s honey baby soap 70g"], src: "/images/grocery/brands/pears-bee-s-honey-baby-soap-70g.jpg" },
  { barcodes: ["8888101270018"], terms: ["munchee chocolate cream 100g","munchee chocolate cream biscuits 100g"], src: "/images/grocery/brands/munchee-chocolate-cream-biscuits-100g.jpg" },
  { barcodes: ["4792098011070"], terms: ["md strawberry jam 300g","md strawberry flavoured melon jam 300g"], src: "/images/grocery/brands/md-strawberry-flavoured-melon-jam-300g.jpg" },
  { barcodes: ["4792081031337"], terms: ["vaseline ice cool 40ml","vaseline ice hydratio body lotion 40ml"], src: "/images/grocery/brands/vaseline-ice-hydratio-body-lotion-40ml.jpg" },
  { barcodes: ["4792024019163"], terms: ["rasa musu","maggi rasa musu 6g"], src: "/images/grocery/brands/maggi-rasa-musu-6g.jpg" },
  { barcodes: ["4792081036929"], terms: ["rexona soap olive oil 80g","rexona with jasmine and olive oil 80g"], src: "/images/grocery/brands/rexona-with-jasmine-and-olive-oil-80g.png" },
  { barcodes: ["8888101090401"], terms: ["munchee lemon puff 200g"], src: "/images/grocery/brands/munchee-lemon-puff-200g.jpg" },
  { barcodes: ["4792054008489"], terms: ["papaya soft facial wash 100ml","natures secrets papaya facial wash 100ml"], src: "/images/grocery/brands/natures-secrets-papaya-facial-wash-100ml.jpg" },
  { barcodes: ["4792081029471"], terms: ["signal fresh mint 200g","signal strong teeth toothpaste 200g"], src: "/images/grocery/brands/signal-strong-teeth-toothpaste-200g.png" },
  { barcodes: ["8888101271404"], terms: ["munchee chocolate puff 200g","cbl munchee orginal chocolate puff biscuits 200g"], src: "/images/grocery/brands/cbl-munchee-orginal-chocolate-puff-biscuits-200g.jpg" },
  { barcodes: ["4796005650567"], terms: ["vim soap 200g"], src: "/images/grocery/brands/vim-soap-200g.jpg" },
  { barcodes: ["4791111144054"], terms: ["dandex deep clean 80ml","dandex deep clean noursh shampo lemon vitamin e 80ml"], src: "/images/grocery/brands/dandex-deep-clean-noursh-shampo-lemon-vitamin-e-80ml.png" },
  { barcodes: ["4791111100005"], terms: ["babycheramy cream almond 50ml","baby cheramy baby cream almond extracts vitamin e milk 50ml"], src: "/images/grocery/brands/baby-cheramy-baby-cream-almond-extracts-vitamin-e-milk-50ml.jpg" },
  { barcodes: ["4792172005063"], terms: ["kekulu baby cologne 50ml","siddhalepa hibiscus ayuruveda baby cologne 50ml"], src: "/images/grocery/brands/siddhalepa-hibiscus-ayuruveda-baby-cologne-50ml.webp" },
  { barcodes: ["4791111141664"], terms: ["babycheramy cream floral 50ml","baby cheramy floral baby cream 50ml"], src: "/images/grocery/brands/baby-cheramy-floral-baby-cream-50ml.png" },
  { barcodes: ["4792081011513"], terms: ["lifebuoy health shampoo s t 80ml","lifebuoy anti dandruff shampoo piroctone olamine formula 80ml"], src: "/images/grocery/brands/lifebuoy-anti-dandruff-shampoo-piroctone-olamine-formula-80m.jpg" },
  { barcodes: ["4792022090058"], terms: ["link sudantha 45g","link sudantha toothpaste 45g"], src: "/images/grocery/brands/link-sudantha-toothpaste-45g.jpg" },
  { barcodes: ["4792081029440"], terms: ["signal complete toothpaste 70g","signal strong teeth toothpaste 70g"], src: "/images/grocery/brands/signal-strong-teeth-toothpaste-70g.jpg" },
  { barcodes: ["4797777002059"], terms: ["strawberry milk juice 180ml","rich life strawberry flavoured milk 180ml"], src: "/images/grocery/brands/rich-life-strawberry-flavoured-milk-180ml.jpg" },
  { barcodes: ["4791111180021"], terms: ["diva white power400g","diva fresh detergent powder rose lime 400g"], src: "/images/grocery/brands/diva-fresh-detergent-powder-rose-lime-400g.png" },
  { barcodes: ["8888101275204"], terms: ["munchee custard cream 100g","munchee custard cream buiscuit 100g"], src: "/images/grocery/brands/munchee-custard-cream-buiscuit-100g.jpg" },
  { barcodes: ["4792098326013"], terms: ["md jam cup mixed fruit100g","md mixed fruit flavoured melon jam 100g"], src: "/images/grocery/brands/md-mixed-fruit-flavoured-melon-jam-100g.jpg" },
  { barcodes: ["4796005674556"], terms: ["rin detergent powder 500g","rin refresh detergent powder 500g"], src: "/images/grocery/brands/rin-refresh-detergent-powder-500g.png" },
  { barcodes: ["4791111146034"], terms: ["fems 8napkin","fems cotton feel wings 8 napkins"], src: "/images/grocery/brands/fems-cotton-feel-wings-8-napkins.jpg" },
  { barcodes: ["4792212010392"], terms: ["edin tomato sause pkt 200g","eaden tomato sauce 200g"], src: "/images/grocery/brands/eaden-tomato-sauce-200g.jpg" },
  { barcodes: ["4791111106519"], terms: ["kumarika hair oil g 100ml","kumarika nourishing herbal hair oil 100ml"], src: "/images/grocery/brands/kumarika-nourishing-herbal-hair-oil-100ml.jpg" },
  { barcodes: ["4792024011372"], terms: ["maggi coconut milk powder 125g","maggi real coconut milk powder 125g"], src: "/images/grocery/brands/maggi-real-coconut-milk-powder-125g.jpg" },
  { barcodes: ["4792212008276"], terms: ["ed tomato sauce 4 4kg","edinborough tomato sauce economy pack 4 4kg"], src: "/images/grocery/brands/edinborough-tomato-sauce-economy-pack-4-4kg.webp" },
  { barcodes: ["4792083050435"], terms: ["papadam","harischandra papadam 70g"], src: "/images/grocery/brands/harischandra-papadam-70g.jpg" },
  { barcodes: ["4796027480104"], terms: ["sn red apple 250ml","sun crush appifizz red 250ml"], src: "/images/grocery/brands/sun-crush-appifizz-red-250ml.jpg" },
  { barcodes: ["4791052500407"], terms: ["ran kahata 50g","ran kahata tea 50g"], src: "/images/grocery/brands/ran-kahata-tea-50g.jpg" },
  { barcodes: ["4792109000024"], terms: ["samaposha 200g"], src: "/images/grocery/brands/samaposha-200g.jpg" },
  { barcodes: ["4792109000482"], terms: ["samaposha 500g"], src: "/images/grocery/brands/samaposha-500g.jpg" },
  { barcodes: ["4792081029433"], terms: ["signal fresh mint 40g","signal strong teeth toothpaste 40g"], src: "/images/grocery/brands/signal-strong-teeth-toothpaste-40g.jpg" },
  { barcodes: ["4792019465616"], terms: ["black knight hair gel 25g","black knight hair gel wet look 25g"], src: "/images/grocery/brands/black-knight-hair-gel-wet-look-25g.png" },
  { barcodes: ["4792232071052"], terms: ["little lion sopng roll srawberry 200g","little lion soft log sponge roll vanilla flavoured 200g"], src: "/images/grocery/brands/little-lion-soft-log-sponge-roll-vanilla-flavoured-200g.jpg" },
  { barcodes: ["4793002404032"], terms: ["specail noodles 500g","supiri noodles 500g"], src: "/images/grocery/brands/supiri-noodles-500g.jpg" },
  { barcodes: ["5014176004101"], terms: ["star vanilla flavour 28ml","star brand vanilla flavour 28ml"], src: "/images/grocery/brands/star-brand-vanilla-flavour-28ml.jpg" },
  { barcodes: ["5063305007513"], terms: ["laojee 100g","laojee tea 100g"], src: "/images/grocery/brands/laojee-tea-100g.jpg" },
  { barcodes: ["4792098004041"], terms: ["md strwberry jam 225g","md strawberry flavoured melon jam 225g"], src: "/images/grocery/brands/md-strawberry-flavoured-melon-jam-225g.jpg" },
  { barcodes: ["5014176004125"], terms: ["motha banana assence","star brand banana flavouring 28ml"], src: "/images/grocery/brands/star-brand-banana-flavouring-28ml.webp" },
  { barcodes: ["4792024020152"], terms: ["maggi papara blast 76g","maggi papare chilli chicken flavour 76g"], src: "/images/grocery/brands/maggi-papare-chilli-chicken-flavour-76g.png" },
  { barcodes: ["4791111154084"], terms: ["gold hair gel 25g"], src: "/images/grocery/brands/gold-hair-gel-25g.png" },
  { barcodes: ["4792054006287"], terms: ["panda cologne y 50ml","panda baby cologne mother s love 50ml"], src: "/images/grocery/brands/panda-baby-cologne-mother-s-love-50ml.jpg" },
  { barcodes: ["4792068221645"], terms: ["kohomba talc herbal 100g","khomba baby herbal talc"], src: "/images/grocery/brands/khomba-baby-herbal-talc.png" },
  { barcodes: ["4792098022014"], terms: ["md st melon jam 100g","md strawberry flavoured melon jam 100g"], src: "/images/grocery/brands/md-strawberry-flavoured-melon-jam-100g.jpg" },
  { barcodes: ["4791010008297"], terms: ["sunny detergent powder1kg","sunny mogra with aloevera 1kg"], src: "/images/grocery/brands/sunny-mogra-with-aloevera-1kg.jpg" },
  { barcodes: ["4792098494224"], terms: ["md strawberry jam 500g","md strawberry flavoured melon jam 500g"], src: "/images/grocery/brands/md-strawberry-flavoured-melon-jam-500g.jpg" },
  { barcodes: ["4792037130978"], terms: ["mortien vaporizer machine","mortein vaporizer machine 30 night"], src: "/images/grocery/brands/mortein-vaporizer-machine-30-night.webp" },
  { barcodes: ["4792154060226"], terms: ["smack mango nectar 200ml","smak mango nectar 200ml"], src: "/images/grocery/brands/smak-mango-nectar-200ml.jpg" },
  { barcodes: ["4792551033014"], terms: ["motha cocoa powder 50g","motha coco powder 50g"], src: "/images/grocery/brands/motha-coco-powder-50g.jpg" },
  { barcodes: ["4791052500179"], terms: ["watawala tea 100g","watawala pure ceylon tea 100g"], src: "/images/grocery/brands/watawala-pure-ceylon-tea-100g.jpg" },
  { barcodes: ["8901088051132"], terms: ["parachute coconut oll 200ml","parachute pure coconut oil 200ml"], src: "/images/grocery/brands/parachute-pure-coconut-oil-200ml.png" },
  { barcodes: ["4792212008283"], terms: ["ed chille sauce 200g","edinborough chilli sauce 200g"], src: "/images/grocery/brands/edinborough-chilli-sauce-200g.png" },
  { barcodes: ["4791111153230"], terms: ["velvet orange 70g","velvet orange and honey for soft skin 70g"], src: "/images/grocery/brands/velvet-orange-and-honey-for-soft-skin-70g.png" },
  { barcodes: ["4792081011520"], terms: ["lifebuoy health shampoo s t 80ml","lifebuoy health shampoo strong long 80ml"], src: "/images/grocery/brands/lifebuoy-health-shampoo-strong-long-80ml.jpg" },
  { barcodes: ["8886350000127"], terms: ["prima chakki atta flour 1kg","prima aroma soft chakki fresh atta 1kg"], src: "/images/grocery/brands/prima-aroma-soft-chakki-fresh-atta-1kg.jpg" },
  { barcodes: ["4793003041250"], terms: ["n s cotton buds","kids joy pure soft 100 cotton swabs"], src: "/images/grocery/brands/kids-joy-pure-soft-100-cotton-swabs.jpg" },
  { barcodes: ["4792551034011"], terms: ["motha vanilla flavour 28ml","motha vanila food flavouring 28ml"], src: "/images/grocery/brands/motha-vanila-food-flavouring-28ml.jpg" },
  { barcodes: ["4792212011856"], terms: ["ed tomato sauce 375g","eaden tomato sauce 375g"], src: "/images/grocery/brands/eaden-tomato-sauce-375g.jpg" },
  { barcodes: ["4791010000284"], terms: ["denta kid t brush","denta kid soft junior toothbrush"], src: "/images/grocery/brands/denta-kid-soft-junior-toothbrush.jpg" },
  { barcodes: ["5014176004187"], terms: ["egg yellow powder food color","star brand egg yellow colouring 28ml"], src: "/images/grocery/brands/star-brand-egg-yellow-colouring-28ml.webp" },
  { barcodes: ["4792019148809"], terms: ["eva pink 10pads","eva cotton feel wings sanitary napkins 10 pads"], src: "/images/grocery/brands/eva-cotton-feel-wings-sanitary-napkins-10-pads.png" },
  { barcodes: ["8888101280208"], terms: ["munchee tikiri marie 80g"], src: "/images/grocery/brands/munchee-tikiri-marie-80g.jpg" },
  { barcodes: ["4792081041190"], terms: ["life buoy soap rs85","lifebuoy venivel olive oil 50g"], src: "/images/grocery/brands/lifebuoy-venivel-olive-oil-50g.jpg" },
  { barcodes: ["4792551030013"], terms: ["motha icing sugar 250g"], src: "/images/grocery/brands/motha-icing-sugar-250g.jpg" },
  { barcodes: ["4792551010145"], terms: ["motha vanilla custard powder 300g","motha vanila flavoured custard powder 300g"], src: "/images/grocery/brands/motha-vanila-flavoured-custard-powder-300g.jpg" },
  { barcodes: ["4792024021654"], terms: ["nestomalt","nestomalt 28g malted food"], src: "/images/grocery/brands/nestomalt-28g-malted-food.png" },
  { barcodes: ["4792081036936"], terms: ["rexona rose","rexona refreshing soap 80 g"], src: "/images/grocery/brands/rexona-refreshing-soap-80-g.jpg" },
  { barcodes: ["4792212012112"], terms: ["mayonnaise 180g","edinborough mayonnaise 180g"], src: "/images/grocery/brands/edinborough-mayonnaise-180g.jpg" },
  { barcodes: ["4791066003635"], terms: ["orange crush 250ml"], src: "/images/grocery/brands/orange-crush-250ml.jpg" },
  { barcodes: ["4792101000312"], terms: ["mdk string 500g","mdk white raw rice string 500g"], src: "/images/grocery/brands/mdk-white-raw-rice-string-500g.jpg" },
  { barcodes: ["4792212007873"], terms: ["md mango chutney 200g","edinborough mango chutney 200g"], src: "/images/grocery/brands/edinborough-mango-chutney-200g.webp" },
  { barcodes: ["8901088051125"], terms: ["parachute coconut oll 100ml","parachute pure coconut oil 100ml"], src: "/images/grocery/brands/parachute-pure-coconut-oil-100ml.jpg" },
  { barcodes: ["8888101500207"], terms: ["munchee vanilla wafers 85g","munchee cream vanilla wafers 85g"], src: "/images/grocery/brands/munchee-cream-vanilla-wafers-85g.jpg" },
  { barcodes: ["4791052500162"], terms: ["watawala tea 50g","watawala ceylon tea 50g"], src: "/images/grocery/brands/watawala-ceylon-tea-50g.jpg" },
  { barcodes: ["4791111136202"], terms: ["fems cotton feel rose 10 pads","fems cotton feel wings 3x protection 10 sanitary napkins"], src: "/images/grocery/brands/fems-cotton-feel-wings-3x-protection-10-sanitary-napkins.jpg" },
  { barcodes: ["4792037297244"], terms: ["detol","dettol cologne fresh 12hr 70g"], src: "/images/grocery/brands/dettol-cologne-fresh-12hr-70g.webp" },
  { barcodes: ["4791010001434"], terms: ["ninja refill 45n","ninja refill 45"], src: "/images/grocery/brands/ninja-refill-45.jpg" },
  { barcodes: ["4792081024872"], terms: ["sunsilk lusciously thick long s 80ml","sunsilk thick long shampoo 80ml"], src: "/images/grocery/brands/sunsilk-thick-long-shampoo-80ml.jpg" },
  { barcodes: ["4791111150239"], terms: ["kumarika oil nh 100ml","kumarika thick volume shine nourishing hair oil 100ml"], src: "/images/grocery/brands/kumarika-thick-volume-shine-nourishing-hair-oil-100ml.webp" },
  { barcodes: ["4792022090041"], terms: ["link sudantha 80g","link sudantha toothpaste 80g"], src: "/images/grocery/brands/link-sudantha-toothpaste-80g.jpg" },
  { barcodes: ["4792212000270"], terms: ["ed artificial vinger 750ml","edinborough artificial vinegar 750ml"], src: "/images/grocery/brands/edinborough-artificial-vinegar-750ml.png" },
  { barcodes: ["4792081038343"], terms: ["pears soap p g 70g","pears komba baby soap 70g"], src: "/images/grocery/brands/pears-komba-baby-soap-70g.jpg" },
  { barcodes: ["4796000302003"], terms: ["freelan rasam 90g"], src: "/images/grocery/brands/freelan-rasam-90g.jpg" },
  { barcodes: ["4792068221546"], terms: ["kohomba floral talc 100g","khomba baby talc floral 100g"], src: "/images/grocery/brands/khomba-baby-talc-floral-100g.jpg" },
  { barcodes: ["5063305007506"], terms: ["laojee 50g","laojee tea 50g"], src: "/images/grocery/brands/laojee-tea-50g.jpg" },
  { barcodes: ["4792081024681"], terms: ["sunsilk shampoo damage r 80ml","sunsilk damage restore shampoo 80ml"], src: "/images/grocery/brands/sunsilk-damage-restore-shampoo-80ml.jpg" },
  { barcodes: ["4791066003611"], terms: ["necto 250ml","elephant house necto 250ml"], src: "/images/grocery/brands/elephant-house-necto-250ml.png" },
  { barcodes: ["4792054006300"], terms: ["panda cologne floral 50ml","panda baby cologne sweet floral 50ml"], src: "/images/grocery/brands/panda-baby-cologne-sweet-floral-50ml.jpg" },
  { barcodes: ["4792054006294"], terms: ["panda cologne touch 50ml","panda baby cologne fairy s touch 50ml"], src: "/images/grocery/brands/panda-baby-cologne-fairy-s-touch-50ml.jpg" },
  { barcodes: ["4791111154237"], terms: ["gold hair wax aloevera 100ml","gold hair styling wax moisturizing aloe vera 100ml"], src: "/images/grocery/brands/gold-hair-styling-wax-moisturizing-aloe-vera-100ml.png" },
  { barcodes: ["4792081021116"], terms: ["signal fighter brush m","signal fighter medium"], src: "/images/grocery/brands/signal-fighter-medium.jpg" },
  { barcodes: ["4792210103201"], terms: ["atlas chooty","atlas pen chooty black 50 pen box"], src: "/images/grocery/brands/atlas-pen-chooty-black-50-pen-box.webp" },
  { barcodes: ["4791111153186"], terms: ["velvet cuti 70g","velvet rose petals and milk for soft skin 70g"], src: "/images/grocery/brands/velvet-rose-petals-and-milk-for-soft-skin-70g.png" },
  { barcodes: ["4796000601120"], terms: ["king custard powder 100g"], src: "/images/grocery/brands/king-custard-powder-100g.jpg" },
  { barcodes: ["4791010002141"], terms: ["ninja vaporiser liquid","ninja refill 30 night 25ml"], src: "/images/grocery/brands/ninja-refill-30-night-25ml.jpg" },
  { barcodes: ["4792098488223"], terms: ["md mixed fruit jam 500g"], src: "/images/grocery/brands/md-mixed-fruit-jam-500g.jpg" },
  { barcodes: ["8888101020200"], terms: ["munchee nice 100g","munchee nice biscuit 100g"], src: "/images/grocery/brands/munchee-nice-biscuit-100g.jpg" },
  { barcodes: ["4792081019229"], terms: ["pears baby cologne 100ml","pears galaxy star baby cologne 100ml"], src: "/images/grocery/brands/pears-galaxy-star-baby-cologne-100ml.jpg" },
  { barcodes: ["4792551036022"], terms: ["motha baking powder 50g"], src: "/images/grocery/brands/motha-baking-powder-50g.png" },
  { barcodes: ["8888101080204"], terms: ["munchee hawaian cookies 100g","munchee hawain cookies 100g"], src: "/images/grocery/brands/munchee-hawain-cookies-100g.jpg" },
  { barcodes: ["4792018425062"], terms: ["kottu mee raman masala 117g","prima kottu mee korean ramen chicken masala 117g"], src: "/images/grocery/brands/prima-kottu-mee-korean-ramen-chicken-masala-117g.jpg" },
  { barcodes: ["4796005680472"], terms: ["comfort sachet 54ml","comfort morning fresh value pack 54ml"], src: "/images/grocery/brands/comfort-morning-fresh-value-pack-54ml.jpg" },
  { barcodes: ["4796001653241"], terms: ["chupa chups lollipop","chapa chups bubble gum filled lollipop 14g"], src: "/images/grocery/brands/chapa-chups-bubble-gum-filled-lollipop-14g.jpg" },
  { barcodes: ["4792081029457"], terms: ["signal 120g","signal strong teeth 120g"], src: "/images/grocery/brands/signal-strong-teeth-120g.jpg" },
  { barcodes: ["4796005687341"], terms: ["comfort lily fresh rose 90ml","comfort morning fresh 90ml"], src: "/images/grocery/brands/comfort-morning-fresh-90ml.jpg" },
  { barcodes: ["8906007280150"], terms: ["fortune soya","fortune soyabean oil 1 l"], src: "/images/grocery/brands/fortune-soyabean-oil-1-l.jpg" },
  { barcodes: ["4796005688249"], terms: ["sunlight detegent powder orange 500g","sunlight 2 in 1 clean citrus fresh 500g"], src: "/images/grocery/brands/sunlight-2-in-1-clean-citrus-fresh-500g.png" },
  { barcodes: ["4792037109837"], terms: ["lysol citrus 200ml","lysol tile cleaner citrus 200ml"], src: "/images/grocery/brands/lysol-tile-cleaner-citrus-200ml.jpg" },
  { barcodes: ["4792054000315"], terms: ["n s carrot facial wash 100ml","natures secrets carrot facial wash 100ml"], src: "/images/grocery/brands/natures-secrets-carrot-facial-wash-100ml.jpg" },
  { barcodes: ["4791111136226"], terms: ["fems cotton feel rose 10 pads","fems drytex wings 10 sanitary napkins"], src: "/images/grocery/brands/fems-drytex-wings-10-sanitary-napkins.jpg" },
  { barcodes: ["4792143018115"], terms: ["kist mixed fruit jam 200g"], src: "/images/grocery/brands/kist-mixed-fruit-jam-200g.jpg" },
  { barcodes: ["4792551030044"], terms: ["icing sugar","motha icing sugar 2 4g"], src: "/images/grocery/brands/motha-icing-sugar-2-4g.jpg" },
  { barcodes: ["4791085292980"], terms: ["ratthi 200g","ratthi full cream milk powder 200g"], src: "/images/grocery/brands/ratthi-full-cream-milk-powder-200g.jpg" },
  { barcodes: ["4791085081072"], terms: ["ratthi 400g","ratthi full cream milk powder 400g"], src: "/images/grocery/brands/ratthi-full-cream-milk-powder-400g.jpg" },
  { barcodes: ["8888101090203"], terms: ["munchee lemon puff 100g"], src: "/images/grocery/brands/munchee-lemon-puff-100g.jpg" },
  { barcodes: ["4792212005770"], terms: ["rb tomato sause 1kg","edinborough r b soy sauce 1kg"], src: "/images/grocery/brands/edinborough-r-b-soy-sauce-1kg.jpg" },
  { barcodes: ["4796005673245"], terms: ["know chicken cube 10g","knorr chicken 28 cubes of 10g each"], src: "/images/grocery/brands/knorr-chicken-28-cubes-of-10g-each.jpg" },
  { barcodes: ["4792068212247"], terms: ["rani powder p g 90g","rani sandalwood natural sunscreen talc"], src: "/images/grocery/brands/rani-sandalwood-natural-sunscreen-talc.jpg" },
  { barcodes: ["4791111143491"], terms: ["nod cotton buds","baby cheramy cotton buds 100psc"], src: "/images/grocery/brands/baby-cheramy-cotton-buds-100psc.jpg" },
  { barcodes: ["4791010000260"], terms: ["denta kid t brush","denta adult toothbrush medium"], src: "/images/grocery/brands/denta-adult-toothbrush-medium.jpg" },
  { barcodes: ["3516664540006"], terms: ["dcl 11g yeast","dcl instant yeast 11g"], src: "/images/grocery/brands/dcl-instant-yeast-11g.jpg" },
  { barcodes: ["4792154501118"], terms: ["smak woodapple nectar 200ml"], src: "/images/grocery/brands/smak-woodapple-nectar-200ml.jpg" },
  { barcodes: ["4792232069059"], terms: ["little lion choco roll cake 200g367","little lion soft log sponge roll coffee flavoured 200g"], src: "/images/grocery/brands/little-lion-soft-log-sponge-roll-coffee-flavoured-200g.jpg" },
  { barcodes: ["4792024021630"], terms: ["nestomolt 175g","nestomalt malt drink pack 175g"], src: "/images/grocery/brands/nestomalt-malt-drink-pack-175g.jpg" },
  { barcodes: ["4792098008070"], terms: ["md mixed fruit jam 300g"], src: "/images/grocery/brands/md-mixed-fruit-jam-300g.png" },
  { barcodes: ["4796002506003"], terms: ["sera coconut milk 330ml","sera real coconut milk 330ml"], src: "/images/grocery/brands/sera-real-coconut-milk-330ml.jpg" },
  { barcodes: ["4792551010138"], terms: ["motha vanilla custard powder 100g","motha vanila flavoured custard powder 100g"], src: "/images/grocery/brands/motha-vanila-flavoured-custard-powder-100g.jpg" },
  { barcodes: ["4792212000249"], terms: ["ed artificial vinger 350ml","edinborough artificial vinegar 350ml"], src: "/images/grocery/brands/edinborough-artificial-vinegar-350ml.jpg" },
  { barcodes: ["4792172000020"], terms: ["siddhalepa balm 5g","siddhalepa herbal ayurvedic balm 5g"], src: "/images/grocery/brands/siddhalepa-herbal-ayurvedic-balm-5g.png" },
  { barcodes: ["4792551000016"], terms: ["motha strawberry jelly 100g","motha strawberry flavoured jelly 100g"], src: "/images/grocery/brands/motha-strawberry-flavoured-jelly-100g.png" },
  { barcodes: ["4792054000261"], terms: ["n s carrot facewash 50ml","natures secrets carrot facial wash 50ml"], src: "/images/grocery/brands/natures-secrets-carrot-facial-wash-50ml.jpg" },
  { barcodes: ["4796011470159"], terms: ["fortune vegetable oil 500ml","fortune cooking oil rbd palm superolein 500ml"], src: "/images/grocery/brands/fortune-cooking-oil-rbd-palm-superolein-500ml.jpg" },
  { barcodes: ["4792081041183"], terms: ["life buoy soap rs85","lifebuoy venivel olive oil 75g"], src: "/images/grocery/brands/lifebuoy-venivel-olive-oil-75g.jpg" },
  { barcodes: ["4796005666490"], terms: ["viva box 400g","viva malted food drink 400g"], src: "/images/grocery/brands/viva-malted-food-drink-400g.jpg" },
  { barcodes: ["4792098002047"], terms: ["md mixed fruit jam 225g"], src: "/images/grocery/brands/md-mixed-fruit-jam-225g.jpg" },
  { barcodes: ["4792054000223"], terms: ["n s cucumber facialwash 50ml","natures secrets cucumber facial wash 50ml"], src: "/images/grocery/brands/natures-secrets-cucumber-facial-wash-50ml.jpg" },
  { barcodes: ["4792172000037"], terms: ["siddhalepa 10g","siddhalepa herbal ayurvedic balm 10g"], src: "/images/grocery/brands/siddhalepa-herbal-ayurvedic-balm-10g.jpg" },
  { barcodes: ["4792083030352"], terms: ["saman soap 70g","harischandra jasmine soap 70g"], src: "/images/grocery/brands/harischandra-jasmine-soap-70g.webp" },
  { barcodes: ["4791111153193"], terms: ["velvet milk 70g","velvet milk and almond for soft skin 70g"], src: "/images/grocery/brands/velvet-milk-and-almond-for-soft-skin-70g.png" },
  { barcodes: ["4792020301088"], terms: ["egg yellow powder food color","delmege egg yellow colouring 28ml"], src: "/images/grocery/brands/delmege-egg-yellow-colouring-28ml.jpg" },
  { barcodes: ["4792054013537"], terms: ["panda baby cream venvel 50ml","panda baby cream with venivel rathmal 50ml"], src: "/images/grocery/brands/panda-baby-cream-with-venivel-rathmal-50ml.jpg" },
  { barcodes: ["4792081021109"], terms: ["signal fighter brush m","signal fighter tooth brush"], src: "/images/grocery/brands/signal-fighter-tooth-brush.jpg" },
  { barcodes: ["4792192060202"], terms: ["tiara swiss roll chocolate 200g","tiara chocolate swiss roll 200g"], src: "/images/grocery/brands/tiara-chocolate-swiss-roll-200g.jpg" },
  { barcodes: ["4792212008412"], terms: ["rb soya sause catering 5kg","r b soya catering sauce 5kg"], src: "/images/grocery/brands/r-b-soya-catering-sauce-5kg.jpg" },
  { barcodes: ["4792098089604"], terms: ["tomato sauce 15g","md original tomato sauce 15g"], src: "/images/grocery/brands/md-original-tomato-sauce-15g.jpg" },
];

// These isolated photographs are for unbranded produce and bulk staples only.
// Match the whole product name (optionally followed by a unit/quantity) so an
// item such as Apple Hair Colour or Banana Chewing Gum cannot inherit fruit art.
const COMMODITY_PHOTOS: ReadonlyArray<{ terms: readonly string[]; src: string }> = [
  { terms: ["banana", "bananas", "plantain", "කෙසෙල්", "வாழைப்பழம்"], src: "/images/grocery/banana.png" },
  { terms: ["apple", "apples", "ඇපල්", "ஆப்பிள்"], src: "/images/grocery/apple.png" },
  { terms: ["tomato", "tomatoes", "තක්කාලි", "தக்காளி"], src: "/images/grocery/tomato.png" },
  { terms: ["potato", "potatoes", "අර්තාපල්", "உருளைக்கிழங்கு"], src: "/images/grocery/potato.png" },
  { terms: ["red onion", "onion", "ලූනු", "வெங்காயம்"], src: "/images/grocery/red-onion.png" },
  { terms: ["carrot", "carrots", "කැරට්", "கேரட்"], src: "/images/grocery/carrot.png" },
  { terms: ["ginger", "ඉඟුරු", "இஞ்சி"], src: "/images/grocery/ginger.png" },
  { terms: ["green chilli", "green chili", "අමු මිරිස්", "பச்சை மிளகாய்"], src: "/images/grocery/green-chilli.png" },
  { terms: ["bread", "පාන්", "ரொட்டி"], src: "/images/grocery/bread.png" },
  { terms: ["wheat flour", "flour", "wheat", "පිටි", "மா"], src: "/images/grocery/wheat-flour.png" },
  { terms: ["rice", "basmathi", "basmati", "samba", "keeri samba", "rathu kakulu", "kekulu", "හාල්", "සහල්", "அரிசி"], src: "/images/grocery/rice.png" },
  { terms: ["sugar", "seeni", "sini", "සීනි", "சீனி"], src: "/images/grocery/sugar.png" },
  { terms: ["coconut", "පොල්", "தேங்காய்"], src: "/images/grocery/coconut.png" },
  { terms: ["egg", "eggs", "බිත්තර", "முட்டை"], src: "/images/grocery/eggs.png" },
  // Batch A — loose Singlish spices, grains, and meat items using bundled grocery assets
  { terms: ["nadu rice", "sudu samba", "samba lus"], src: "/images/grocery/rice.png" },
  { terms: ["rathu lunu"], src: "/images/grocery/red-onion.png" },
  { terms: ["panpiti"], src: "/images/grocery/wheat-flour.png" },
  { terms: ["aba ata", "aba kudu"], src: "/images/grocery/grinding-mill/mus.svg" },
  { terms: ["karabu nati"], src: "/images/grocery/grinding-mill/clo.svg" },
  { terms: ["bedapu miris kudu"], src: "/images/grocery/grinding-mill/rch.svg" },
  { terms: ["miris kudu lus"], src: "/images/grocery/grinding-mill/chp.svg" },
  { terms: ["kali miris", "miris karal lus"], src: "/images/grocery/grinding-mill/chl.svg" },
  { terms: ["suduru"], src: "/images/grocery/grinding-mill/cum.svg" },
  { terms: ["kurudu"], src: "/images/grocery/grinding-mill/cin.svg" },
  { terms: ["goraka", "rasa goraka"], src: "/images/grocery/grinding-mill/gor.svg" },
  { terms: ["sudu lunu"], src: "/images/grocery/grinding-mill/gar.svg" },
  { terms: ["thunpaha"], src: "/images/grocery/grinding-mill/raw.svg" },
  { terms: ["mas karry kudu"], src: "/images/grocery/grinding-mill/mea.svg" },
  { terms: ["malu curry kudu"], src: "/images/grocery/grinding-mill/fis.svg" },
  { terms: ["kottamalli ata"], src: "/images/grocery/grinding-mill/cor.svg" },
  { terms: ["maduru"], src: "/images/grocery/grinding-mill/fen.svg" },
  { terms: ["karadamungu packet"], src: "/images/grocery/grinding-mill/car.svg" },
  { terms: ["udu ata"], src: "/images/grocery/grinding-mill/und.svg" },
  { terms: ["kurakkan lus"], src: "/images/grocery/grinding-mill/kur.svg" },
  { terms: ["tetha hal piti"], src: "/images/grocery/grinding-mill/wrf.svg" },
  { terms: ["meat balls"], src: "/images/grocery/meat/meatballs.svg" },
  { terms: ["sausages"], src: "/images/grocery/meat/sausages-small.svg" },
];

const CATEGORY_IMAGES: ReadonlyArray<{ terms: readonly string[]; src: string }> = [
  { terms: ["fruit"], src: "/images/grocery/apple.png" },
  { terms: ["vegetable"], src: "/images/grocery/carrot.png" },
  { terms: ["bread", "bakery"], src: "/images/grocery/bread.png" },
  { terms: ["milk", "dairy"], src: "/images/grocery/fresh-milk.png" },
  { terms: ["meat", "seafood", "poultry"], src: "/images/grocery/chicken.png" },
  { terms: ["rice", "flour", "grain"], src: "/images/grocery/rice.png" },
  { terms: ["sugar", "salt"], src: "/images/grocery/sugar.png" },
  { terms: ["coconut"], src: "/images/grocery/coconut.png" },
  { terms: ["egg"], src: "/images/grocery/eggs.png" },
];

const GENERIC_GROCERY_ILLUSTRATION_SOURCES = new Set(
  [...COMMODITY_PHOTOS, ...CATEGORY_IMAGES].map((item) => item.src),
);

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function containsTerm(value: string, term: string): boolean {
  const haystack = normalize(value);
  const needle = normalize(term);
  if (!haystack || !needle) return false;
  if (/[\u0B80-\u0BFF\u0D80-\u0DFF]/u.test(needle)) return haystack.includes(needle);
  return (` ${haystack} `).includes(` ${needle} `);
}

function quantityTailOnly(value: string, phrase: string): boolean {
  const normalized = normalize(value);
  const normalizedPhrase = normalize(phrase);
  if (normalized === normalizedPhrase) return true;
  if (!normalized.startsWith(`${normalizedPhrase} `)) return false;
  const tail = normalized.slice(normalizedPhrase.length).trim();
  return /^(?:\d+(?:\.\d+)?\s*)?(?:kg|g|mg|l|ml|pcs|pc|pack|packs|units?)?$/.test(tail);
}

function specificImageFor(name: string, sku?: string | null, barcode?: string | null): string | undefined {
  const productCodes = [barcode, sku]
    .map((code) => code?.trim())
    .filter((code): code is string => Boolean(code));
  const exactBarcodeMatch = BARCODE_PRODUCT_IMAGES.find((item) =>
    item.barcodes.some((code) => productCodes.includes(code)) &&
    item.terms.some((term) => quantityTailOnly(name, term)),
  );
  if (exactBarcodeMatch) return exactBarcodeMatch.src;

  const brandedNameMatch = BARCODE_PRODUCT_IMAGES.find((item) =>
    item.terms.some((term) => quantityTailOnly(name, term)) &&
    // If a store supplies a code, don't bypass a known barcode mismatch with
    // a name-only match to a possibly different package or flavor.
    (item.barcodes.length === 0 || productCodes.length === 0),
  );
  if (brandedNameMatch) return brandedNameMatch.src;

  // Ajinomoto is the shop's bulk monosodium-glutamate product. Its source row
  // has a stock code rather than a retail barcode, so match the product name.
  if (["ajinomoto", "ajinamoto", "ajinomota", "aji no moto", "monosodium glutamate", "msg powder"]
    .some((term) => quantityTailOnly(name, term))) {
    return "/images/grocery/brands/ajinomoto-msg-100g.jpg";
  }

  return COMMODITY_PHOTOS.find((item) => item.terms.some((term) => quantityTailOnly(name, term)))?.src;
}

function imageForCategory(label: string): string | undefined {
  return CATEGORY_IMAGES.find((item) => item.terms.some((term) => containsTerm(label, term)))?.src;
}

function safeProductImageUrl(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.includes("\\")) return undefined;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function ProductArt({ source, className = "" }: { source?: string; className?: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  if (!source || failedSource === source) {
    return (
      <span aria-hidden="true" className={`flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 ${className}`}>
        <svg viewBox="0 0 48 48" fill="none" className="h-9 w-9" aria-hidden="true">
          <path d="M10 16.5h28v21H10zM17 16.5l2.5-5h9l2.5 5M10 22h28" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="24" cy="29.5" r="5.5" stroke="currentColor" strokeWidth="2.4" />
        </svg>
      </span>
    );
  }

  return (
    <img
      src={source}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailedSource(source)}
      className={`block object-contain object-center ${className}`}
    />
  );
}

export function GroceryProductArt({
  name,
  sku,
  barcode,
  imageUrl,
  className = "",
}: {
  name: string;
  category?: string;
  sku?: string | null;
  barcode?: string | null;
  imageUrl?: string;
  className?: string;
}) {
  const ownerImage = imageUrl ? safeProductImageUrl(imageUrl) : undefined;
  const exactImage = specificImageFor(name, sku, barcode);
  const isGenericIllustration = ownerImage && GENERIC_GROCERY_ILLUSTRATION_SOURCES.has(ownerImage);
  // Older shop imports sometimes stored a category illustration as if it were
  // a product photo (for example, coconut art on a perfume). Prefer a verified
  // item match, and ignore those generic URLs when they do not match the item.
  const source = (ownerImage && !isGenericIllustration ? ownerImage : undefined) || exactImage;
  return <ProductArt source={source} className={className} />;
}

export function GroceryCategoryArt({ label, className = "" }: { label: string; className?: string }) {
  return <ProductArt source={imageForCategory(label)} className={className} />;
}
