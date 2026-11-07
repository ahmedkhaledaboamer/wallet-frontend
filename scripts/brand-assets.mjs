// Derives web-ready brand assets from the client's original logo files.
// Run: node scripts/brand-assets.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const dir = "public/brand";
const dark = `${dir}/apexaora-logo-on-dark-original.png`;
const light = `${dir}/apexaora-logo-on-light-original.png`;

await mkdir(dir, { recursive: true });

// Full lockups, trimmed of transparent padding.
await sharp(dark).trim({ threshold: 10 }).resize({ width: 880 }).png().toFile(`${dir}/apexaora-logo-on-dark.png`);
await sharp(light).trim({ threshold: 10 }).resize({ width: 880 }).png().toFile(`${dir}/apexaora-logo-on-light.png`);

// The mark alone (rows 0–1000 of the dark lockup contain only the infinity symbol).
const markRaw = await sharp(dark).extract({ left: 0, top: 0, width: 2600, height: 1000 }).png().toBuffer();
const markBuf = await sharp(markRaw).trim({ threshold: 10 }).png().toBuffer();
await sharp(markBuf).resize({ width: 512 }).png().toFile(`${dir}/apexaora-mark.png`);

// Square icons: mark centred on a transparent square, and on deep-space for apple-touch.
const square = async (size, bg) =>
  sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: await sharp(markBuf).resize({ width: Math.round(size * 0.86) }).png().toBuffer(), gravity: "center" }])
    .png();
await (await square(512, { r: 0, g: 0, b: 0, alpha: 0 })).toFile("src/app/icon.png");
await (await square(180, { r: 12, g: 12, b: 27, alpha: 1 })).toFile("src/app/apple-icon.png");
console.log("brand assets written");

// Wordmark only ("APEXAORA INNOVATIONS"), rows 1000+ of each lockup — for the horizontal sidebar lockup.
for (const [src, name] of [[dark, "on-dark"], [light, "on-light"]]) {
  const m = await sharp(src).metadata();
  const top = Math.round((1000 / 1690) * m.height);
  const raw = await sharp(src).extract({ left: 0, top, width: m.width, height: m.height - top }).png().toBuffer();
  await sharp(raw).trim({ threshold: 10 }).resize({ width: 640 }).png().toFile(`${dir}/apexaora-wordmark-${name}.png`);
}
console.log("wordmarks written");
