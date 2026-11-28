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
