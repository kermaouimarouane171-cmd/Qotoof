import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resDir = join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

const SIZES = [
  { dir: 'mipmap-mdpi',    size: 48 },
  { dir: 'mipmap-hdpi',    size: 72 },
  { dir: 'mipmap-xhdpi',   size: 96 },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const FOREGROUND_SIZES = [
  { dir: 'mipmap-mdpi',    size: 108 },
  { dir: 'mipmap-hdpi',    size: 162 },
  { dir: 'mipmap-xhdpi',   size: 216 },
  { dir: 'mipmap-xxhdpi',  size: 324 },
  { dir: 'mipmap-xxxhdpi', size: 432 },
];

function drawIcon(size, isForeground = false) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (!isForeground) {
    // Background: green circle
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw the Arabic letter "ق" centered
  const fontSize = Math.floor(size * (isForeground ? 0.62 : 0.58));
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${fontSize}px Cairo, Tajawal, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ق', size / 2, size / 2 + fontSize * 0.05);

  return canvas;
}

// Generate ic_launcher and ic_launcher_round
for (const { dir, size } of SIZES) {
  const outDir = join(resDir, dir);
  mkdirSync(outDir, { recursive: true });

  const iconCanvas = drawIcon(size, false);
  writeFileSync(join(outDir, 'ic_launcher.png'), iconCanvas.toBuffer('image/png'));
  writeFileSync(join(outDir, 'ic_launcher_round.png'), iconCanvas.toBuffer('image/png'));
  console.log(`Generated ${dir}/ic_launcher.png (${size}x${size})`);
}

// Generate ic_launcher_foreground (for adaptive icons)
for (const { dir, size } of FOREGROUND_SIZES) {
  const outDir = join(resDir, dir);
  mkdirSync(outDir, { recursive: true });

  const fgCanvas = drawIcon(size, true);
  writeFileSync(join(outDir, 'ic_launcher_foreground.png'), fgCanvas.toBuffer('image/png'));
  console.log(`Generated ${dir}/ic_launcher_foreground.png (${size}x${size})`);
}

// Generate splash screen
const splashDir = join(resDir, 'drawable');
mkdirSync(splashDir, { recursive: true });
const splashCanvas = createCanvas(1080, 1920);
const splashCtx = splashCanvas.getContext('2d');

// Green background
splashCtx.fillStyle = '#16a34a';
splashCtx.fillRect(0, 0, 1080, 1920);

// White "ق" centered
splashCtx.fillStyle = '#FFFFFF';
splashCtx.font = 'bold 420px Cairo, Tajawal, Arial, sans-serif';
splashCtx.textAlign = 'center';
splashCtx.textBaseline = 'middle';
splashCtx.fillText('ق', 540, 960);

writeFileSync(join(splashDir, 'splash.png'), splashCanvas.toBuffer('image/png'));
console.log('Generated drawable/splash.png (1080x1920)');

console.log('\nAll icons generated successfully!');
