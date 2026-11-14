export type GroceryCatalogArtKind =
  | "cola" | "juice" | "water" | "soda" | "coffee" | "tea" | "malt" | "cordial" | "rose-water"
  | "biscuit" | "cake" | "milk-powder" | "yogurt" | "curd" | "butter" | "cheese" | "ice-cream"
  | "perfume" | "soap" | "shampoo" | "hair-care" | "face-cream" | "henna" | "incense" | "detergent"
  | "toothpaste" | "toothbrush" | "sanitary" | "serviette" | "bulb" | "battery" | "broom" | "razor" | "colour"
  | "spice-powder" | "spice-seeds" | "chilli" | "cinnamon" | "curry-leaves" | "goraka" | "coconut-oil" | "coconut-powder"
  | "cooking-oil" | "coconut-milk" | "milk-drink" | "milk-can" | "jam" | "baking" | "essence" | "cereal" | "cleaning-liquid" | "medicine" | "ointment" | "talc"
  | "stationery" | "paper-goods" | "cotton-buds" | "insect-control" | "sausage" | "matches" | "sports-ball" | "snack" | "salt" | "peas" | "leafy-greens" | "bitter-gourd"
  | "dry-fish" | "canned-fish" | "soya" | "noodles" | "dhal" | "sauce" | "vinegar" | "honey"
  | "chocolate" | "chips" | "gum" | "nuts" | "yeast" | "okra" | "beans" | "cabbage" | "cassava";

type Props = { kind: GroceryCatalogArtKind; className?: string };

function Bottle({ liquid, cap = "#3a596a", clear = false }: { liquid: string; cap?: string; clear?: boolean }) {
  return (
    <g stroke="#315267" strokeWidth="2.4" strokeLinejoin="round">
      <path d="M104 26h32v15l10 13v12c16 10 22 20 22 34v43c0 8-6 14-14 14H86c-8 0-14-6-14-14v-43c0-14 6-24 22-34V54l10-13V26Z" fill={clear ? "#f5fbfd" : liquid} />
      <path d="M98 60h44v12H98z" fill={liquid} stroke="none" opacity=".9" />
      <path d="M107 27h26v11h-26z" fill={cap} />
      <path d="M88 89c17-8 47-8 72 0v39c0 8-6 14-14 14H101c-8 0-13-6-13-14V89Z" fill={liquid} opacity={clear ? ".34" : ".92"} stroke="none" />
      <path d="M96 81v49" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".72" />
      <path d="M84 99c20 8 53 8 76 0" stroke="#fff" strokeWidth="2" opacity=".48" />
      {clear && <g fill="#e8fdff" stroke="none"><circle cx="125" cy="104" r="3"/><circle cx="139" cy="118" r="2"/><circle cx="113" cy="126" r="2"/></g>}
    </g>
  );
}

function Pouch({ color, fold = "#f5eee2" }: { color: string; fold?: string }) {
  return (
    <g stroke="#8b7761" strokeWidth="2.2" strokeLinejoin="round">
      <path d="m78 37 17-13h50l17 13-8 112H86L78 37Z" fill={fold} />
      <path d="m78 37 17-13v14l-14 10m81-11-17-13v14l14 10" fill="#e5d8c6" />
      <path d="M87 67h66v54H87z" fill={color} stroke="none" opacity=".92" />
      <path d="M95 77h50M95 111h50" stroke="#fff" strokeWidth="3" opacity=".65" />
      <path d="m90 47 60 0" stroke="#fff" strokeWidth="3" opacity=".6" />
    </g>
  );
}

function Cup({ fill, rim = "#f8faf9" }: { fill: string; rim?: string }) {
  return (
    <g stroke="#718795" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M81 56h78l-9 88c-1 8-7 13-15 13h-30c-8 0-14-5-15-13l-9-88Z" fill={rim} />
      <path d="M88 82h64l-6 58c-.6 6-5 10-11 10h-30c-6 0-10-4-11-10l-6-58Z" fill={fill} stroke="none" />
      <path d="M76 50h88v14H76z" fill="#fff" />
      <path d="M90 72h60" stroke="#fff" strokeWidth="4" opacity=".7" />
    </g>
  );
}

function Bar({ color }: { color: string }) {
  return <g stroke="#a18d78" strokeWidth="2.2" strokeLinejoin="round"><path d="M77 78c0-9 7-16 16-16h54c9 0 16 7 16 16v43c0 9-7 16-16 16H93c-9 0-16-7-16-16V78Z" fill={color}/><path d="M89 74c5-3 10-4 17-4" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".72"/><path d="M92 145h56" stroke="#bcad9c" strokeWidth="4" strokeLinecap="round"/></g>;
}

function Bowl({ color, seed = false }: { color: string; seed?: boolean }) {
  return (
    <g stroke="#8d8174" strokeWidth="2.2" strokeLinejoin="round">
      <ellipse cx="120" cy="80" rx="62" ry="18" fill="#fffdf8" />
      {seed ? <g fill={color} stroke="none"><ellipse cx="88" cy="76" rx="7" ry="4"/><ellipse cx="105" cy="71" rx="6" ry="3.5"/><ellipse cx="123" cy="78" rx="7" ry="4"/><ellipse cx="140" cy="71" rx="6" ry="3.5"/><ellipse cx="153" cy="78" rx="7" ry="4"/><ellipse cx="99" cy="83" rx="6" ry="3.4"/><ellipse cx="132" cy="84" rx="6" ry="3.4"/></g> : <path d="M67 80c10 41 28 60 53 60s43-19 53-60c-26 16-80 16-106 0Z" fill={color} stroke="#a89988"/>}
      <path d="M59 80c20 21 102 21 122 0" fill="none" stroke="#c9bcaa" strokeWidth="4" />
    </g>
  );
}

export function GroceryCatalogArt({ kind, className = "" }: Props) {
  const colors: Record<GroceryCatalogArtKind, string> = {
    cola: "#583320", juice: "#f2a52c", water: "#d9f5fb", soda: "#e6f4f3", coffee: "#6e4228", tea: "#a56b39", malt: "#9a6132", cordial: "#c76131", "rose-water": "#e98ca5",
    biscuit: "#c9944c", cake: "#c98a4c", "milk-powder": "#e8d4a2", yogurt: "#e8a8b7", curd: "#fbf6e5", butter: "#f2cf4b", cheese: "#edba43", "ice-cream": "#c99de0",
    perfume: "#e8b95a", soap: "#9ac5d4", shampoo: "#54a8a3", "hair-care": "#b17ac0", "face-cream": "#ead7b8", henna: "#7b5b36", incense: "#b18154", detergent: "#57aebc",
    toothpaste: "#3c94c9", toothbrush: "#e86c78", sanitary: "#eaa4bd", serviette: "#e9ebed", bulb: "#f4cf54", battery: "#597b91", broom: "#b8905c", razor: "#6b91a5", colour: "#c95468",
    "spice-powder": "#9a4c31", "spice-seeds": "#a8753e", chilli: "#bf4436", cinnamon: "#8c5331", "curry-leaves": "#4c9866", goraka: "#a7573a", "coconut-oil": "#e9ce82", "coconut-powder": "#b4875b",
    "cooking-oil": "#d6a52f", "coconut-milk": "#f3efe4", "milk-drink": "#f4e6bd", "milk-can": "#d9e6ea", jam: "#bd4560", baking: "#e9d7a6", essence: "#b1744f", cereal: "#c79851", "cleaning-liquid": "#5aa8c1", medicine: "#5a9ec9", ointment: "#9bbd8b", talc: "#e8dcbf",
    stationery: "#5683ad", "paper-goods": "#f4f5f3", "cotton-buds": "#f1ece5", "insect-control": "#6ca987", sausage: "#ad6358", matches: "#d4a755", "sports-ball": "#e5893a", snack: "#e8b647", salt: "#f3f2ec", peas: "#68a857", "leafy-greens": "#559361", "bitter-gourd": "#55914c",
    "dry-fish": "#b88b5e", "canned-fish": "#7ea5b4", soya: "#b3814b", noodles: "#e5bd60", dhal: "#d5a344", sauce: "#b64837", vinegar: "#d7bf72", honey: "#d08a22",
    chocolate: "#684331", chips: "#e8bb42", gum: "#78b2cf", nuts: "#b78345", yeast: "#d3a970", okra: "#5f9c58", beans: "#4d8f58", cabbage: "#75a65f", cassava: "#b59468",
  };
  const liquid = colors[kind];
  const container = (clear = false) => <Bottle liquid={liquid} clear={clear} cap={kind === "perfume" ? "#bd914b" : undefined} />;

  return (
    <svg viewBox="0 0 240 180" aria-hidden="true" className={`block h-full w-full object-contain ${className}`}>
      <ellipse cx="120" cy="151" rx="64" ry="10" fill="#718195" opacity=".13" />
      <circle cx="120" cy="88" r="76" fill={liquid} opacity=".055" />

      {(["cola", "juice", "water", "soda", "cordial", "rose-water", "sauce", "vinegar"] as GroceryCatalogArtKind[]).includes(kind) && container(kind === "water" || kind === "soda" || kind === "vinegar")}
      {kind === "perfume" && <g stroke="#4a5560" strokeWidth="2.5" strokeLinejoin="round"><path d="M105 40h30v15l16 10v64c0 10-7 17-17 17h-28c-10 0-17-7-17-17V65l16-10V40Z" fill="#f2d78c"/><path d="M108 29h24v11h-24z" fill="#bc8b41"/><rect x="100" y="75" width="40" height="30" rx="8" fill="#f7e8b6"/><path d="M108 81h24" stroke="#fff" strokeWidth="4"/><path d="M99 122h42" stroke="#fff" strokeWidth="3" opacity=".75"/></g>}
      {(["coffee", "tea", "malt", "milk-powder", "coconut-powder", "henna", "detergent", "dhal", "noodles", "yeast"] as GroceryCatalogArtKind[]).includes(kind) && <Pouch color={liquid} fold="#efe3d1" />}
      {kind === "biscuit" && <g><path d="m75 57 90 0 8 84H67l8-84Z" fill="#f0bf63" stroke="#9a6b39" strokeWidth="2.5"/><rect x="79" y="70" width="82" height="56" rx="10" fill="#fff2cf"/><circle cx="99" cy="95" r="14" fill="#c48a45"/><circle cx="99" cy="95" r="8" fill="#e3bd78"/><circle cx="132" cy="95" r="14" fill="#b8783c"/><circle cx="132" cy="95" r="8" fill="#e8c47d"/><path d="M77 64h91" stroke="#fff7df" strokeWidth="4"/></g>}
      {kind === "cake" && <g><path d="M66 119 120 63l54 56-6 22H72l-6-22Z" fill="#e9b66f" stroke="#9b6942" strokeWidth="2.5"/><path d="M67 119c19 8 85 8 106 0v15c-25 11-80 11-102 0l-4-15Z" fill="#f8e6cb" stroke="#c18d56" strokeWidth="2"/><path d="m119 64 18 19-36 36-18-1 37-54Z" fill="#71452e"/><path d="m87 113 29-40" stroke="#fff4d8" strokeWidth="4"/></g>}
      {(["yogurt", "curd", "ice-cream"] as GroceryCatalogArtKind[]).includes(kind) && <Cup fill={liquid} />}
      {kind === "butter" && <g stroke="#a68e52" strokeWidth="2.2" strokeLinejoin="round"><path d="M67 79c0-12 11-21 24-21h58c13 0 24 9 24 21v50c0 10-9 18-20 18H87c-11 0-20-8-20-18V79Z" fill="#f4d04e"/><path d="M73 73h94v13H73z" fill="#fff4be"/><path d="M84 99h72" stroke="#fff9dc" strokeWidth="5"/></g>}
      {kind === "cheese" && <g stroke="#aa823f" strokeWidth="2.2" strokeLinejoin="round"><path d="m64 122 67-67 49 68-83 25-33-26Z" fill="#f2c94d"/><path d="m131 55 4 68 45 0-49-68Z" fill="#e8af35"/><circle cx="127" cy="98" r="5" fill="#fff1b7"/><circle cx="106" cy="124" r="4" fill="#fff1b7"/></g>}
      {kind === "soap" && <Bar color={liquid} />}
      {(["shampoo", "hair-care", "face-cream", "colour"] as GroceryCatalogArtKind[]).includes(kind) && <g stroke="#536b75" strokeWidth="2.2" strokeLinejoin="round"><path d="M94 55c0-8 8-14 26-14s26 6 26 14v14l12 13v55c0 10-7 16-17 16h-42c-10 0-17-6-17-16V82l12-13V55Z" fill={liquid}/><path d="M107 30h26v13h-26z" fill="#456d79"/><path d="M91 90h58" stroke="#fff" strokeWidth="5" opacity=".75"/><path d="M98 109h44" stroke="#fff" strokeWidth="2.5" opacity=".55"/></g>}
      {kind === "toothpaste" && <g stroke="#47718a" strokeWidth="2.2" strokeLinejoin="round"><path d="m83 47 78 0-13 93c-1 8-7 13-15 13h-28c-8 0-14-5-15-13L83 47Z" fill="#f8faf9"/><path d="M87 80h69l-4 28H91l-4-28Z" fill={liquid} stroke="none"/><path d="M87 49h70" stroke="#9fc3cf" strokeWidth="5"/><path d="M103 154h39v12h-39z" fill="#7295a5"/></g>}
      {kind === "toothbrush" && <g stroke="#4f7482" strokeWidth="2.2" strokeLinecap="round"><path d="M66 124c38-20 75-36 111-51" stroke={liquid} strokeWidth="12"/><path d="m160 60 27-12 9 19-27 12z" fill="#f8faf7"/><path d="m166 58 8 12m0-17 8 12m0-17 8 12" stroke="#80b8ca" strokeWidth="2"/></g>}
      {kind === "incense" && <g stroke="#8f6d45" strokeWidth="3" strokeLinecap="round"><path d="M83 139 116 48M103 144 135 49M123 145 151 52M143 139 168 62"/><path d="M116 48c-5-11 8-14 3-23m16 24c-4-8 8-11 4-19m15 22c-4-8 8-12 5-19" fill="none" stroke="#d8a86c" strokeWidth="2"/><path d="M76 146h98" stroke="#b48a58" strokeWidth="10"/></g>}
      {kind === "spice-powder" && <Bowl color={liquid} />}
      {kind === "chilli" && <g><Bowl color="#c34532"/><path d="M80 75c-5-8-1-13 5-14m-4 15 10-5m52-2c8-7 15-4 16 2" fill="none" stroke="#4e8c54" strokeWidth="4" strokeLinecap="round"/></g>}
      {kind === "spice-seeds" && <Bowl color={liquid} seed />}
      {kind === "cinnamon" && <g stroke="#8f5733" strokeWidth="2"><path d="m77 131 72-83 13 12-72 83z" fill="#a66a3c"/><path d="m97 143 72-83 12 12-72 83z" fill="#c1844c"/><path d="m75 133 10 9m72-83 8 8m-56 76 11 8m72-84 8 8" stroke="#e1b277" strokeWidth="3"/></g>}
      {kind === "curry-leaves" && <g fill="#4c9866" stroke="#33764c" strokeWidth="1.8"><path d="M118 142c-4-35-8-69 2-105" fill="none" strokeWidth="4"/><ellipse cx="97" cy="57" rx="18" ry="8" transform="rotate(23 97 57)"/><ellipse cx="143" cy="72" rx="18" ry="8" transform="rotate(-24 143 72)"/><ellipse cx="96" cy="90" rx="18" ry="8" transform="rotate(24 96 90)"/><ellipse cx="141" cy="107" rx="18" ry="8" transform="rotate(-19 141 107)"/><ellipse cx="104" cy="126" rx="16" ry="7" transform="rotate(20 104 126)"/></g>}
      {kind === "goraka" && <g fill="#9d5037" stroke="#6e3c30" strokeWidth="2"><path d="M78 105c8-22 21-42 39-51 18 9 31 29 39 51l-15 38H93l-15-38Z"/><path d="M93 106c9-9 39-9 48 0" fill="none" stroke="#d68b60" strokeWidth="4"/><path d="M98 66c-4-8 2-13 9-14m29 14c4-8-2-13-9-14" fill="none" stroke="#6c9a58" strokeWidth="4" strokeLinecap="round"/></g>}
      {kind === "dry-fish" && <g stroke="#89745a" strokeWidth="2.3" strokeLinejoin="round"><path d="M63 96c24-31 62-42 103-28l22-15-4 26 17 16-18 15 5 26-23-14c-40 15-78 5-102-26Z" fill="#c09b68"/><path d="M78 97c22 9 53 11 82 2M106 77c-3 14-2 28 3 41m18-46c-3 17-2 32 4 47" fill="none" stroke="#e5c99d" strokeWidth="3"/><circle cx="167" cy="91" r="3" fill="#3c4e55"/></g>}
      {kind === "canned-fish" && <g stroke="#607c87" strokeWidth="2.4" strokeLinejoin="round"><path d="M76 62h89v77c0 9-6 15-15 15H91c-9 0-15-6-15-15V62Z" fill="#9eb9c4"/><ellipse cx="120" cy="62" rx="44" ry="12" fill="#c4d4da"/><path d="M83 89h75v40H83z" fill="#6f9b9e" stroke="none"/><path d="M89 107c10-16 31-21 49-10l11 9-11 12c-18 9-38 5-49-11Z" fill="#e9c17a" stroke="#a0794a"/><circle cx="134" cy="104" r="2.5" fill="#41515a"/></g>}
      {kind === "soya" && <Bowl color="#bf935d" seed />}
      {kind === "noodles" && <g stroke="#a58348" strokeWidth="2.2" strokeLinejoin="round"><path d="m73 46 94 0 8 98H65l8-98Z" fill="#f3d274"/><path d="M80 71h80v55H80z" fill="#fff0b4"/><path d="M92 90c15-16 37-16 52 0m-52 17c15-16 37-16 52 0" fill="none" stroke="#d4a844" strokeWidth="5" strokeLinecap="round"/><path d="M76 55h88" stroke="#fff7d7" strokeWidth="4"/></g>}
      {kind === "dhal" && <Bowl color="#e2b34a" seed />}
      {kind === "honey" && <g stroke="#9b7134" strokeWidth="2.4" strokeLinejoin="round"><path d="M92 52h56v12l14 12v55c0 9-7 16-16 16h-52c-9 0-16-7-16-16V76l14-12V52Z" fill="#dc9a28"/><path d="M89 87h62v32H89z" fill="#f8d77b" stroke="none"/><path d="M105 44h30v9h-30z" fill="#b98e4b"/><path d="M98 91h44" stroke="#fff0bf" strokeWidth="4"/></g>}
      {kind === "chocolate" && <g stroke="#71513e" strokeWidth="2.2" strokeLinejoin="round"><path d="M74 65h92v79H74z" fill="#7a4c38"/><path d="M83 73h74v62H83z" fill="#b57b50"/><path d="M83 95h74m-37-22v62m-37-20h74" stroke="#704530" strokeWidth="4"/><path d="M78 70h18" stroke="#ead4aa" strokeWidth="4"/></g>}
      {kind === "chips" && <Pouch color="#e1b847" fold="#fff3cc" />}
      {kind === "gum" && <g stroke="#62899a" strokeWidth="2.2" strokeLinejoin="round"><rect x="75" y="55" width="90" height="94" rx="13" fill="#8bc4d7"/><rect x="85" y="68" width="70" height="58" rx="8" fill="#f4fbfc"/><g fill="#f1a8ac" stroke="#bc7a84"><rect x="95" y="80" width="18" height="16" rx="5"/><rect x="126" y="80" width="18" height="16" rx="5"/><rect x="95" y="103" width="18" height="16" rx="5"/><rect x="126" y="103" width="18" height="16" rx="5"/></g></g>}
      {kind === "nuts" && <Bowl color="#bd8c4f" seed />}
      {kind === "yeast" && <Pouch color="#d3a970" />}
      {kind === "okra" && <g fill="#639c52" stroke="#3f7545" strokeWidth="2"><path d="M75 118c6-31 25-59 56-67 12 28 6 57-17 82-14 15-35 10-39-15Z"/><path d="M116 134c8-29 27-52 52-59 7 25-2 50-24 69-12 10-29 5-28-10Z"/><path d="M91 124c10-27 23-45 40-58m3 56c8-20 18-33 31-43" fill="none" stroke="#a9cf79" strokeWidth="3"/></g>}
      {kind === "beans" && <g fill="#4d8f58" stroke="#347449" strokeWidth="2.2" strokeLinecap="round"><path d="M75 120c33-47 61-70 93-74-11 34-39 62-86 86-6 3-12-5-7-12Z"/><path d="M78 94c35 18 68 36 90 65-35-3-66-20-96-54-5-6-1-15 6-11Z"/><path d="M87 131c23-8 42-24 61-49" fill="none" stroke="#b2d98d" strokeWidth="3"/></g>}
      {kind === "cabbage" && <g stroke="#4f8550" strokeWidth="2"><circle cx="120" cy="98" r="47" fill="#a4c77b"/><path d="M120 54c-20 19-21 62 0 89m0-89c18 16 21 61 0 89m-43-48c27-11 59-10 86 0m-72-29c22 4 41 18 57 42m-57 0c17-24 35-38 57-42" fill="none" stroke="#d2e2ae" strokeWidth="5" strokeLinecap="round"/></g>}
      {kind === "cassava" && <g stroke="#9e896a" strokeWidth="2.3" strokeLinejoin="round"><path d="M88 64c17-10 34-7 43 4 17 19 28 51 16 71-7 13-23 16-39 8-23-12-42-50-37-68 2-7 8-12 17-15Z" fill="#ab8756"/><path d="M94 68c17 22 24 50 26 77" stroke="#eddfbf" strokeWidth="9"/><path d="M82 76c8-4 12-3 17 0m45 55c7 3 10 3 14 0" stroke="#745b42" strokeWidth="3"/></g>}
      {kind === "coconut-oil" && <g>{container(true)}<path d="M91 101h58v20H91z" fill="#f5f0df" opacity=".9"/><path d="M102 108h36" stroke="#c8a566" strokeWidth="4"/></g>}
      {kind === "cooking-oil" && <g stroke="#8a7544" strokeWidth="2.4" strokeLinejoin="round"><path d="M103 30h34v19l14 12v79c0 10-7 17-17 17h-28c-10 0-17-7-17-17V61l14-12V30Z" fill="#d8ab36"/><path d="M108 24h24v7h-24z" fill="#547b57"/><path d="M96 88h48v30H96z" fill="#fff6d7"/><path d="M105 98h30m-25 9h20" stroke="#c29934" strokeWidth="3"/></g>}
      {kind === "coconut-milk" && <g stroke="#927c59" strokeWidth="2.3" strokeLinejoin="round"><path d="m78 57 42-20 42 20v81c0 8-6 14-14 14H92c-8 0-14-6-14-14V57Z" fill="#f4f0e4"/><path d="M80 61h80v20H80z" fill="#e9dfc9"/><path d="M94 94h52v29H94z" fill="#fffdf5"/><path d="M105 103h30m-24 9h18" stroke="#b7a276" strokeWidth="3"/></g>}
      {kind === "milk-drink" && <g stroke="#728795" strokeWidth="2.3" strokeLinejoin="round"><path d="m79 61 34-20h45v100c0 8-6 14-14 14H93c-8 0-14-6-14-14V61Z" fill="#f3e4b5"/><path d="M113 42v34h45" fill="none" stroke="#d0b885" strokeWidth="3"/><path d="M90 91h58v29H90z" fill="#fffdf2"/><path d="M101 101h36m-30 9h25" stroke="#c4a96c" strokeWidth="3"/></g>}
      {kind === "milk-can" && <g stroke="#71808a" strokeWidth="2.3" strokeLinejoin="round"><path d="M87 61h66v82c0 9-6 15-15 15h-36c-9 0-15-6-15-15V61Z" fill="#d8e5e9"/><ellipse cx="120" cy="61" rx="33" ry="10" fill="#eff4f3"/><path d="M87 83h66v31H87z" fill="#f8faf8"/><path d="M100 96h40" stroke="#7eabb8" strokeWidth="4"/><path d="M100 106h40" stroke="#b8c9ca" strokeWidth="3"/></g>}
      {kind === "jam" && <g stroke="#785c50" strokeWidth="2.3" strokeLinejoin="round"><path d="M87 64h66l11 17v59c0 9-7 15-16 15H92c-9 0-16-6-16-15V81l11-17Z" fill="#c1475c"/><path d="M84 62h72v14H84z" fill="#f3e5c5"/><path d="M93 91h54v31H93z" fill="#f7e8c9"/><path d="M103 101h34" stroke="#bd6370" strokeWidth="4"/><path d="M91 51h58v11H91z" fill="#b28b5d"/></g>}
      {kind === "baking" && <g><Pouch color="#e8d6a1" fold="#fff8e6"/><path d="M97 82h46v30H97z" fill="#fffdf5" stroke="#aa956c" strokeWidth="2"/><path d="M105 92h30m-25 9h20" stroke="#c6ae76" strokeWidth="3"/></g>}
      {kind === "essence" && <g stroke="#566978" strokeWidth="2.3" strokeLinejoin="round"><path d="M103 43h34v12l10 12v68c0 9-6 15-15 15h-24c-9 0-15-6-15-15V67l10-12V43Z" fill="#bf8154"/><path d="M108 32h24v11h-24z" fill="#a98b62"/><path d="M100 86h40v27h-40z" fill="#f5ebd8"/><path d="M108 96h24" stroke="#c6956b" strokeWidth="3"/></g>}
      {kind === "cereal" && <g stroke="#8a6942" strokeWidth="2.3" strokeLinejoin="round"><path d="M78 49h84v105H78z" fill="#d9ad58"/><path d="M86 59h68v82H86z" fill="#fff1c5"/><path d="M92 101c9-18 17-18 26 0s17 18 26 0" fill="none" stroke="#b88243" strokeWidth="7" strokeLinecap="round"/><path d="M95 74h50" stroke="#fff" strokeWidth="4"/></g>}
      {kind === "cleaning-liquid" && <g stroke="#526d77" strokeWidth="2.3" strokeLinejoin="round"><path d="M99 52h43v15l13 13v64c0 8-6 14-14 14h-43c-8 0-14-6-14-14V80l15-13V52Z" fill="#62b4c5"/><path d="M105 39h31v13h-31z" fill="#477c83"/><path d="M91 94h58v28H91z" fill="#e9f7f6"/><path d="M103 104h34" stroke="#5ba8b8" strokeWidth="4"/></g>}
      {kind === "medicine" && <g stroke="#527184" strokeWidth="2.3" strokeLinejoin="round"><rect x="76" y="54" width="88" height="95" rx="8" fill="#fbfcfa"/><path d="M76 79h88v29H76z" fill="#5f9ec5"/><path d="M102 44h36v11h-36z" fill="#d8e6e8"/><path d="M102 92h36" stroke="#fff" strokeWidth="4"/><path d="M119 86v13" stroke="#fff" strokeWidth="4"/></g>}
      {kind === "ointment" && <g stroke="#657d62" strokeWidth="2.3" strokeLinejoin="round"><path d="m78 84 78-25 20 55-78 26-20-56Z" fill="#b2c99e"/><path d="m81 88 75-24 6 16-75 24z" fill="#edf4e6"/><path d="m99 121 67-22 6 17-67 23z" fill="#8da77b"/></g>}
      {kind === "talc" && <g stroke="#85775f" strokeWidth="2.3" strokeLinejoin="round"><path d="M99 49h42v11l11 12v67c0 9-7 16-16 16h-32c-9 0-16-7-16-16V72l11-12V49Z" fill="#eee2cd"/><path d="M103 39h34v11h-34z" fill="#c9b58f"/><path d="M97 94h46v29H97z" fill="#fffaf1"/><path d="M106 104h28" stroke="#d0bd9c" strokeWidth="3"/></g>}
      {kind === "stationery" && <g stroke="#536d81" strokeWidth="2.2" strokeLinejoin="round"><path d="m74 137 75-91 20 16-75 91z" fill="#5b93bd"/><path d="m149 46 11-13 22 18-13 11z" fill="#e0bd80"/><path d="m74 137-5 19 25-6z" fill="#d5bd94"/><path d="M104 123 159 57" stroke="#d9eff8" strokeWidth="5"/></g>}
      {kind === "paper-goods" && <g stroke="#a5adb0" strokeWidth="2.2" strokeLinejoin="round"><path d="m78 72 39-25 44 21v67l-43 24-40-26z" fill="#fff"/><path d="m78 72 40 21 43-25M118 93v66" fill="none" stroke="#d8dfe1" strokeWidth="3"/><path d="M92 111h22m12 9h26" stroke="#c8d0d1" strokeWidth="3"/></g>}
      {kind === "cotton-buds" && <g stroke="#b3a99a" strokeWidth="5" strokeLinecap="round"><path d="m84 130 72-78m-73 0 72 78m-58-88 43 98m-43 0 43-98"/><g fill="#fff" stroke="#d7d2ca" strokeWidth="2"><ellipse cx="84" cy="130" rx="8" ry="12" transform="rotate(42 84 130)"/><ellipse cx="156" cy="52" rx="8" ry="12" transform="rotate(42 156 52)"/><ellipse cx="83" cy="52" rx="8" ry="12" transform="rotate(-42 83 52)"/><ellipse cx="155" cy="130" rx="8" ry="12" transform="rotate(-42 155 130)"/></g></g>}
      {kind === "insect-control" && <g stroke="#557466" strokeWidth="2.3" strokeLinejoin="round"><path d="M98 69h47l14 16v63c0 8-6 14-14 14h-47c-8 0-14-6-14-14V85l14-16Z" fill="#6ba782"/><path d="M106 54h31v16h-31z" fill="#53785e"/><path d="M91 98h61v31H91z" fill="#eef5dc"/><path d="M104 109h36" stroke="#88a95b" strokeWidth="4"/><path d="M119 86v12" stroke="#e3f0d0" strokeWidth="3"/></g>}
      {kind === "sausage" && <g stroke="#95634e" strokeWidth="2.3" strokeLinejoin="round"><path d="M75 96c7-20 26-31 44-22 19-9 40 2 46 22 7 20-4 42-24 47-19 5-39-1-52-4-20-4-21-24-14-43Z" fill="#bd715f"/><path d="M84 100c16 7 56 8 72-1m-68 21c18 5 48 7 65 1" fill="none" stroke="#e8b6a2" strokeWidth="4"/><path d="M75 94 67 86m100 2 9-8m-100 73-7 8m97-7 8 8" stroke="#875342" strokeWidth="4" strokeLinecap="round"/></g>}
      {kind === "matches" && <g stroke="#73563c" strokeWidth="2.2" strokeLinejoin="round"><path d="M72 81h96v69H72z" fill="#dbb06c"/><path d="M82 90h76v52H82z" fill="#f5e7c8"/><g strokeWidth="5" strokeLinecap="round"><path d="m95 124 22-37m4 37 22-37" stroke="#b27b43"/></g><circle cx="117" cy="87" r="6" fill="#c6533e"/><circle cx="144" cy="87" r="6" fill="#c6533e"/></g>}
      {kind === "sports-ball" && <g stroke="#a65b27" strokeWidth="2.5"><circle cx="120" cy="100" r="49" fill="#ef983e"/><path d="M82 69c22 12 35 35 37 78m39-78c-21 13-34 37-38 78M75 101h90" fill="none" stroke="#fff0d8" strokeWidth="5"/></g>}
      {kind === "snack" && <g><Pouch color="#e5b443" fold="#fff2c8"/><path d="M92 83h56v36H92z" fill="#fff4d2" stroke="#a98746" strokeWidth="2"/><path d="M102 91c8-10 17-10 25 0 7-10 15-9 19 0v18c-6 8-13 8-19 0-8 8-17 8-25 0z" fill="#d58938"/><path d="M100 116h42" stroke="#fff" strokeWidth="3"/></g>}
      {kind === "salt" && <g><Pouch color="#f3f2ec" fold="#fff"/><path d="M91 80h58v39H91z" fill="#fff" stroke="#b5bec0" strokeWidth="2"/><path d="M102 91h36m-28 10h20" stroke="#9aa8aa" strokeWidth="3"/><path d="M100 52h40" stroke="#fff" strokeWidth="4"/></g>}
      {kind === "peas" && <g fill="#78ac5b" stroke="#4b8146" strokeWidth="2.4" strokeLinejoin="round"><path d="M68 116c26-40 74-61 108-50-4 35-41 66-98 77-11 2-17-16-10-27Z"/><circle cx="99" cy="116" r="8" fill="#b9d782"/><circle cx="119" cy="105" r="8" fill="#b9d782"/><circle cx="139" cy="92" r="8" fill="#b9d782"/></g>}
      {kind === "leafy-greens" && <g fill="#5f9e65" stroke="#39784b" strokeWidth="2"><path d="M120 148c-20-33-38-66-17-101 7 25 16 38 19 58 4-22 16-39 42-54-5 37-17 70-44 97Z"/><path d="M118 149c-16-31-38-48-63-52 11 31 32 47 63 52Zm6-12c19-30 44-41 67-38-13 27-34 40-67 38Z"/><path d="M120 146 108 68m9 58 47-42m-50 54-41-31" fill="none" stroke="#bddc9b" strokeWidth="3"/></g>}
      {kind === "bitter-gourd" && <g fill="#57924f" stroke="#346d42" strokeWidth="2.3" strokeLinejoin="round"><path d="M67 97c15-26 35-37 57-30 20-7 39 4 50 28-9 26-29 40-50 32-21 8-43-4-57-30Z"/><path d="M78 91c15-8 28-7 39 1m4 28c13-11 28-14 43-9m-62-33 8 51m14-54 4 54m15-47 1 43m14-34-5 29" fill="none" stroke="#9fc479" strokeWidth="3"/></g>}
      {kind === "sanitary" && <g stroke="#c47e98" strokeWidth="2.1" strokeLinejoin="round"><path d="M120 45c-25 0-43 14-43 34v45c0 20 18 34 43 34s43-14 43-34V79c0-20-18-34-43-34Z" fill="#f7e4ec"/><path d="M120 62c-12 0-21 7-21 18v44c0 11 9 18 21 18s21-7 21-18V80c0-11-9-18-21-18Z" fill="#fff"/><path d="M107 79c-11-4-20 1-25 11m51-11c11-4 20 1 25 11" fill="none" stroke="#dfa9be" strokeWidth="5" strokeLinecap="round"/></g>}
      {kind === "bulb" && <g stroke="#8c835d" strokeWidth="2.3" strokeLinejoin="round"><path d="M120 37c-30 0-51 21-51 49 0 17 9 30 22 41 8 7 12 15 12 23h34c0-8 4-16 12-23 13-11 22-24 22-41 0-28-21-49-51-49Z" fill="#f7d866"/><path d="M103 150h34v9h-34zm4 12h26v8h-26z" fill="#a99d78"/><path d="M107 63c-10 10-13 22-8 35m42-35c10 10 13 22 8 35" fill="none" stroke="#fff6c5" strokeWidth="5" strokeLinecap="round"/></g>}
      {kind === "battery" && <g stroke="#466273" strokeWidth="2.3" strokeLinejoin="round"><rect x="81" y="51" width="78" height="103" rx="12" fill="#5f8396"/><rect x="105" y="41" width="30" height="11" rx="3" fill="#aabdc5"/><path d="M94 82h52v43H94z" fill="#d4e1e4"/><path d="M104 103h32" stroke="#68818a" strokeWidth="5"/><path d="M120 91v24" stroke="#68818a" strokeWidth="4"/></g>}
      {kind === "broom" && <g stroke="#876b48" strokeWidth="2.2" strokeLinejoin="round"><path d="m111 45 13-5 31 88-13 5z" fill="#b38d5b"/><path d="M78 125c21-8 49-12 78-5l18 29c-30-9-57-6-88 5l-8-29Z" fill="#c9a465"/><path d="m91 128 8 26m9-29 7 26m9-28 6 26m8-26 6 26m9-25 6 24" stroke="#8f7448" strokeWidth="2"/></g>}
      {kind === "razor" && <g stroke="#536f7e" strokeWidth="2.3" strokeLinejoin="round"><path d="M89 57h62l-8 31-16 10 7 54c1 8-5 14-13 14h-10c-8 0-14-6-13-14l7-54-17-10-8-31Z" fill="#83a7b6"/><path d="M91 59h58m-51 15h44" stroke="#dce8eb" strokeWidth="5"/><path d="M108 105h24" stroke="#477087" strokeWidth="6" strokeLinecap="round"/></g>}
      {kind === "serviette" && <g stroke="#9ba8ad" strokeWidth="2.2" strokeLinejoin="round"><path d="m74 73 38-29 53 28-39 86-52-85Z" fill="#fff"/><path d="m112 44 14 31-40 17m78-20-38 25 0 51" fill="none" stroke="#d5dde0" strokeWidth="3"/><path d="M91 103c12-4 25-2 37 5" fill="none" stroke="#b6c3c7" strokeWidth="2"/></g>}
    </svg>
  );
}

