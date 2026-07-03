// Gera os ícones PNG do PWA a partir do logo do Grana.
// Uso: node scripts/gen-icons.mjs   (requer sharp como devDependency)
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public");

// Full-bleed (sem cantos arredondados) — o SO aplica a máscara.
const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#22304A"/>
  <rect x="120" y="286" width="64" height="90"  rx="18" fill="#2E8B7C"/>
  <rect x="224" y="226" width="64" height="150" rx="18" fill="#2E8B7C"/>
  <rect x="328" y="166" width="64" height="210" rx="18" fill="#2E8B7C"/>
  <circle cx="360" cy="150" r="70" fill="#D3A44B"/>
  <text x="360" y="150" font-family="Arial, Helvetica, sans-serif" font-size="66" font-weight="700"
        fill="#22304A" text-anchor="middle" dominant-baseline="central">R$</text>
</svg>`;

const targets = [
  { file: "pwa-192x192.png", size: 192 },
  { file: "pwa-512x512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of targets) {
  await sharp(Buffer.from(svg(size)))
    .png()
    .toFile(join(outDir, file));
  console.log(`✓ ${file} (${size}x${size})`);
}
