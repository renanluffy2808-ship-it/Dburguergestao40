const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generateAppIconPng(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = 1 + size * 4;
  const raw = Buffer.alloc(rowSize * size);

  const cornerRadius = size * 0.22;
  const margin = size * 0.06;
  const boxLeft = margin;
  const boxTop = margin;
  const boxRight = size - margin;
  const boxBottom = size - margin;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;
    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 4;

      // Squircle background check
      let inSquircle = false;
      const cl = boxLeft + cornerRadius;
      const cr = boxRight - cornerRadius;
      const ct = boxTop + cornerRadius;
      const cb = boxBottom - cornerRadius;

      if (x >= cl && x <= cr && y >= boxTop && y <= boxBottom) {
        inSquircle = true;
      } else if (y >= ct && y <= cb && x >= boxLeft && x <= boxRight) {
        inSquircle = true;
      } else {
        const cx = x < cl ? cl : cr;
        const cy = y < ct ? ct : cb;
        const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (distSq <= cornerRadius * cornerRadius) {
          inSquircle = true;
        }
      }

      if (inSquircle) {
        // Gradient from amber-500 (245, 158, 11) to amber-600 (217, 119, 6)
        const t = y / size;
        const r = Math.round(245 * (1 - t) + 217 * t);
        const g = Math.round(158 * (1 - t) + 119 * t);
        const b = Math.round(11 * (1 - t) + 6 * t);

        // Simple burger patty shape or D mark in center
        const dy = Math.abs(y - size * 0.5);
        const dx = Math.abs(x - size * 0.48);

        // Burger top bun, patty, bottom bun in dark zinc (#09090b)
        const inBunTop = y >= size * 0.32 && y <= size * 0.42 && dx <= size * 0.28;
        const inPatty = y >= size * 0.46 && y <= size * 0.54 && dx <= size * 0.30;
        const inBunBottom = y >= size * 0.58 && y <= size * 0.66 && dx <= size * 0.28;

        if (inBunTop || inPatty || inBunBottom) {
          raw[px] = 9;
          raw[px + 1] = 9;
          raw[px + 2] = 11;
          raw[px + 3] = 255;
        } else {
          raw[px] = r;
          raw[px + 1] = g;
          raw[px + 2] = b;
          raw[px + 3] = 255;
        }
      } else {
        // Pure dark background (#09090b)
        raw[px] = 9;
        raw[px + 1] = 9;
        raw[px + 2] = 11;
        raw[px + 3] = 255;
      }
    }
  }

  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', idat),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

function main() {
  const rootDir = process.cwd();
  const publicDir = path.join(rootDir, 'public');
  const distDir = path.join(rootDir, 'dist');
  const bundleDir = path.join(publicDir, 'bundle');
  const bundleAssetsDir = path.join(bundleDir, 'assets');

  // 1. Gera ícones PWA e Android
  const icon192 = generateAppIconPng(192);
  const icon512 = generateAppIconPng(512);

  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), icon192);

  // SVG Icon
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#09090b" rx="110"/>
  <rect x="30" y="30" width="452" height="452" fill="url(#amber-grad)" rx="96"/>
  <defs>
    <linearGradient id="amber-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect x="110" y="160" width="292" height="50" rx="25" fill="#09090b"/>
  <rect x="96" y="235" width="320" height="42" rx="21" fill="#09090b"/>
  <rect x="110" y="302" width="292" height="46" rx="23" fill="#09090b"/>
</svg>`;
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);

  const androidWwwDir = path.join(rootDir, 'app', 'src', 'main', 'assets', 'www');
  const androidWwwAssetsDir = path.join(androidWwwDir, 'assets');

  // Garante diretórios
  if (!fs.existsSync(bundleDir)) {
    fs.mkdirSync(bundleDir, { recursive: true });
  }
  if (!fs.existsSync(bundleAssetsDir)) {
    fs.mkdirSync(bundleAssetsDir, { recursive: true });
  }
  if (!fs.existsSync(androidWwwDir)) {
    fs.mkdirSync(androidWwwDir, { recursive: true });
  }
  if (!fs.existsSync(androidWwwAssetsDir)) {
    fs.mkdirSync(androidWwwAssetsDir, { recursive: true });
  }

  // 3. Se dist existir, sincroniza os assets frescos para public/bundle e app/src/main/assets/www
  if (fs.existsSync(distDir)) {
    const distHtml = path.join(distDir, 'index.html');
    if (fs.existsSync(distHtml)) {
      let htmlContent = fs.readFileSync(distHtml, 'utf-8');

      // Remove type="module" e crossorigin para permitir execucao sem restricao de CORS no Android WebView e file:///
      htmlContent = htmlContent.replace(/<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/i, '<script defer src="$1"></script>');
      htmlContent = htmlContent.replace(/<script\s+type="module"\s+src="([^"]+)"><\/script>/i, '<script defer src="$1"></script>');
      htmlContent = htmlContent.replace(/<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/i, '<link rel="stylesheet" href="$1">');

      // Adiciona tela de carregamento amigavel para evitar tela preta caso o JS leve tempo ou de erro
      const splashHtml = `<div id="root"><div id="app-loading-screen" style="position:fixed;inset:0;background:#09090b;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;color:#f4f4f5;z-index:99999;"><div style="width:44px;height:44px;border:3px solid #27272a;border-top-color:#f59e0b;border-radius:50%;animation:dburger-spin 0.8s linear infinite;"></div><p style="margin-top:16px;font-size:14px;font-weight:800;letter-spacing:0.05em;color:#f4f4f5;">D’ BURGER GESTÃO</p><p id="app-loading-status" style="margin-top:6px;font-size:12px;color:#a1a1aa;">Carregando painel e cardápio...</p><div id="app-error-box" style="display:none;margin-top:14px;max-width:320px;padding:12px;background:#271b1b;border:1px solid #7f1d1d;border-radius:8px;font-size:11px;color:#fca5a5;word-break:break-word;text-align:center;"></div><style>@keyframes dburger-spin{to{transform:rotate(360deg)}}</style></div></div><script>window.addEventListener('error',function(e){var b=document.getElementById('app-error-box'),s=document.getElementById('app-loading-status');if(b){b.style.display='block';b.textContent='Erro ao iniciar: '+(e.message||e);}if(s){s.textContent='Falha ao abrir os componentes';}});</script>`;

      if (!htmlContent.includes('app-loading-screen')) {
        htmlContent = htmlContent.replace(/<div id="root"><\/div>/i, splashHtml);
      }

      fs.writeFileSync(distHtml, htmlContent);
      fs.writeFileSync(path.join(bundleDir, 'index.html'), htmlContent);
      fs.writeFileSync(path.join(androidWwwDir, 'index.html'), htmlContent);
    }

    const distAssetsDir = path.join(distDir, 'assets');
    if (fs.existsSync(distAssetsDir)) {
      // Limpa assets antigos em ambos os diretórios
      for (const targetDir of [bundleAssetsDir, androidWwwAssetsDir]) {
        if (fs.existsSync(targetDir)) {
          const existing = fs.readdirSync(targetDir);
          for (const f of existing) {
            const fullPath = path.join(targetDir, f);
            if (fs.statSync(fullPath).isFile()) {
              fs.unlinkSync(fullPath);
            }
          }
        }
      }

      // Copia novos
      const newAssets = fs.readdirSync(distAssetsDir);
      for (const f of newAssets) {
        const src = path.join(distAssetsDir, f);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, path.join(bundleAssetsDir, f));
          fs.copyFileSync(src, path.join(androidWwwAssetsDir, f));
        }
      }
    }

    // Copia ícones e manifest para ambos os diretórios
    for (const targetDir of [bundleDir, androidWwwDir]) {
      fs.copyFileSync(path.join(publicDir, 'icon-192.png'), path.join(targetDir, 'icon-192.png'));
      fs.copyFileSync(path.join(publicDir, 'icon-512.png'), path.join(targetDir, 'icon-512.png'));
      fs.copyFileSync(path.join(publicDir, 'manifest.json'), path.join(targetDir, 'manifest.json'));
    }

    // Info do bundle atualizada
    const bundleInfo = {
      geradoEm: new Date().toISOString(),
      versao: '2.6.0',
      arquivos: fs.readdirSync(androidWwwAssetsDir),
    };
    fs.writeFileSync(path.join(bundleDir, 'bundle-info.json'), JSON.stringify(bundleInfo, null, 2));
    fs.writeFileSync(path.join(androidWwwDir, 'bundle-info.json'), JSON.stringify(bundleInfo, null, 2));

    console.log('[Sync-Bundle] Sucesso! Assets sincronizados em public/bundle e app/src/main/assets/www:');
    console.log(bundleInfo.arquivos);
  }
}

main();
