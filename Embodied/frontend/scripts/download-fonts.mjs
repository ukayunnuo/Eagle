/**
 * 从 Google Fonts 国内镜像下载字体文件到 public/fonts/
 * 运行: node scripts/download-fonts.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', 'public', 'fonts');

// 国内镜像（按优先级排列）
const MIRRORS = [
  'https://fonts.font.im',
  'https://fonts.loli.net',
];

// 字体配置：family, weight, 输出文件名
const FONTS = [
  { family: 'DM Sans', weight: 400, file: 'DMSans-Regular.ttf' },
  { family: 'DM Sans', weight: 500, file: 'DMSans-Medium.ttf' },
  { family: 'DM Sans', weight: 700, file: 'DMSans-Bold.ttf' },
  { family: 'Space Grotesk', weight: 400, file: 'SpaceGrotesk-Regular.ttf' },
  { family: 'Space Grotesk', weight: 500, file: 'SpaceGrotesk-Medium.ttf' },
  { family: 'Space Grotesk', weight: 600, file: 'SpaceGrotesk-SemiBold.ttf' },
  { family: 'Space Grotesk', weight: 700, file: 'SpaceGrotesk-Bold.ttf' },
  { family: 'Fira Code', weight: 400, file: 'FiraCode-Regular.ttf' },
  { family: 'Fira Code', weight: 500, file: 'FiraCode-Medium.ttf' },
];

async function fetchFromMirrors(path) {
  for (const mirror of MIRRORS) {
    try {
      const resp = await fetch(`${mirror}${path}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (resp.ok) return resp;
    } catch {
      continue;
    }
  }
  throw new Error(`所有镜像均失败: ${path}`);
}

async function getFontUrl(family, weight) {
  const cssPath = `/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const resp = await fetchFromMirrors(cssPath);
  const css = await resp.text();

  // 从 CSS 中提取字体文件 URL
  const match = css.match(/url\((https:\/\/[^)]+)\)/);
  if (!match) throw new Error(`未找到字体 URL: ${family} w${weight}`);
  return match[1];
}

async function downloadFont(family, weight, filename) {
  const dest = join(FONTS_DIR, filename);
  if (existsSync(dest)) {
    console.log(`  ✓ 已存在: ${filename}`);
    return;
  }

  console.log(`  ⬇ 下载: ${family} ${weight}...`);
  const fontUrl = await getFontUrl(family, weight);

  // 直接从 gstatic 镜像下载
  const gstaticUrl = fontUrl.replace('fonts.gstatic.com', 'fonts.gstatic.font.im');
  const resp = await fetch(gstaticUrl);
  const buffer = Buffer.from(await resp.arrayBuffer());
  writeFileSync(dest, buffer);
  console.log(`  ✓ 完成: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  if (!existsSync(FONTS_DIR)) {
    mkdirSync(FONTS_DIR, { recursive: true });
  }

  console.log('正在从国内镜像下载字体文件...\n');

  let success = 0;
  for (const font of FONTS) {
    try {
      await downloadFont(font.family, font.weight, font.file);
      success++;
    } catch (err) {
      console.error(`  ✗ 失败: ${font.family} ${font.weight} - ${err.message}`);
    }
  }

  console.log(`\n完成：${success}/${FONTS.length} 个字体下载成功`);
}

main();
