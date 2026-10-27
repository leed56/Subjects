import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const catalogue = await readFile(path.join(root, "src/lib/grinding-mill-catalogue.ts"), "utf8");
const items = [...catalogue.matchAll(/^  \["([^"]+)", "([A-Z]+)", "([^"]+)", "(spice|blend|flour)"\],?$/gm)];
const destination = path.join(root, "public/images/grocery/grinding-mill");
await mkdir(destination, { recursive: true });

const palettes = [
  ["#b9412c", "#e88c4e"], ["#c77e27", "#efbf61"], ["#91732d", "#d4ad55"],
  ["#80654b", "#bd9975"], ["#8d4b38", "#d99069"], ["#678348", "#a8c374"],
  ["#875d70", "#c79bac"], ["#8d6b2f", "#caae63"],
];

const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
for (const [index, match] of items.entries()) {
  const [, name, code, pack, kind] = match;
  const [dark, light] = kind === "flour" ? ["#b89a71", "#ebdbc1"] : palettes[index % palettes.length];
  const [first, ...rest] = name.split(" ");
  const title = rest.length && name.length > 17
    ? `<text x="120" y="35" text-anchor="middle" class="title">${escapeXml(first)}</text><text x="120" y="52" text-anchor="middle" class="title">${escapeXml(rest.join(" "))}</text>`
    : `<text x="120" y="43" text-anchor="middle" class="title">${escapeXml(name)}</text>`;
  const art = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160" role="img" aria-label="Illustration of ${escapeXml(name)}">
  <defs><linearGradient id="paper" x2="1" y2="1"><stop stop-color="#fffdf8"/><stop offset="1" stop-color="#f4eee3"/></linearGradient><linearGradient id="powder" x2="0" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
  <rect width="240" height="160" rx="18" fill="url(#paper)"/>
  <circle cx="29" cy="33" r="15" fill="${light}" opacity=".25"/><circle cx="211" cy="123" r="24" fill="${light}" opacity=".23"/>
  <g fill="${dark}" opacity=".58"><circle cx="48" cy="96" r="2.5"/><circle cx="62" cy="110" r="1.8"/><circle cx="190" cy="97" r="2.5"/><circle cx="179" cy="108" r="1.8"/></g>
  <ellipse cx="120" cy="131" rx="79" ry="12" fill="#9b8069" opacity=".12"/>
  <path d="M56 104c10 27 28 39 64 39s54-12 64-39" fill="#f8f8f4" stroke="#d6cab8" stroke-width="2"/>
  <ellipse cx="120" cy="104" rx="65" ry="16" fill="#eee8dc" stroke="#d6cab8" stroke-width="2"/>
  <path d="M64 107c13-5 23-24 38-29 15-6 18-10 29-4 18 8 29 26 45 33-24 11-87 13-112 0Z" fill="url(#powder)"/>
  <path d="M87 97c17-6 38-8 64 0" fill="none" stroke="#fff9e9" stroke-width="2" opacity=".3"/>
  <text x="120" y="15" text-anchor="middle" font-family="Arial,sans-serif" font-size="7" font-weight="700" letter-spacing="2" fill="${dark}">LAKBIZ · MILL RANGE</text>
  <style>.title{font:700 13px Arial,sans-serif;fill:#30353a}</style>${title}
  <text x="120" y="155" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="#776f67">${escapeXml(pack)} · ILLUSTRATION</text>
</svg>`;
  await writeFile(path.join(destination, `${code.toLowerCase()}.svg`), art);
}
console.log(`Created ${items.length} original catalogue illustrations.`);
