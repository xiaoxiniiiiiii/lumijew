import sharp from 'sharp';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('public/products');
const groups = ['earrings', 'necklaces', 'bracelets', 'rings', 'hair'];
await mkdir(dir, { recursive: true });
for (const group of groups) {
  const input = path.join(dir, `sheet-${group}.png`);
  const meta = await sharp(input).metadata();
  const gutterX = meta.width > 1400 ? 10 : 8;
  const marginX = Math.round(gutterX * .8);
  const gutterY = meta.height > 1000 ? 10 : 8;
  const marginY = Math.round(gutterY * .8);
  const cellW = Math.floor((meta.width - marginX * 2 - gutterX * 3) / 4);
  const cellH = Math.floor((meta.height - marginY * 2 - gutterY * 2) / 3);
  for (let i = 0; i < 12; i++) {
    const left = marginX + (i % 4) * (cellW + gutterX);
    const top = marginY + Math.floor(i / 4) * (cellH + gutterY);
    await sharp(input).extract({ left, top, width: cellW, height: cellH }).resize(640, 640, { fit: 'cover' }).webp({ quality: 88, effort: 5 }).toFile(path.join(dir, `${group}-${String(i + 1).padStart(2, '0')}.webp`));
  }
  await rm(input);
}
console.log('Created 60 unique product WebP files.');
