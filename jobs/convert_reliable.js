// jobs/convert_reliable.js
// Reliable RAW pipeline: try libvips first, fallback to dcraw, then Sharp for final format
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const archiver = require('archiver');

const RAW_EXTS = ['.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2', '.raf', '.orf', '.pef', '.rw2', '.3fr', '.rdc', '.iiq', '.dcr', '.k25', '.kdc', '.mef', '.mos', '.erf'];

function isRawExt(ext) {
  return RAW_EXTS.includes(ext.toLowerCase());
}

function getMagickCmd() {
  try {
    execSync('magick -version', { stdio: 'pipe' });
    return 'magick';
  } catch (_) {
    return 'convert';
  }
}

async function makeErrorPlaceholder(outputFormat, originalName, message) {
  const text = `Conversion failed\n${originalName}\n${message}`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">\n  <rect width="100%" height="100%" fill="#111827"/>\n  <text x="50%" y="40%" dominant-baseline="middle" text-anchor="middle" fill="#ef4444" font-family="Arial" font-size="42">Conversion failed</text>\n  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#e5e7eb" font-family="Arial" font-size="24">${escapeHtml(originalName)}</text>\n  <text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="20">${escapeHtml(message)}</text>\n</svg>`;
  const svgBuffer = Buffer.from(svg, 'utf8');
  if (['jpg', 'jpeg'].includes(outputFormat.toLowerCase())) {
    return await sharp(svgBuffer).jpeg({ quality: 85 }).toBuffer();
  }
  if (outputFormat.toLowerCase() === 'tiff') {
    return await sharp(svgBuffer).tiff({ compression: 'lzw', quality: 90 }).toBuffer();
  }
  if (outputFormat.toLowerCase() === 'psd') {
    // Return PNG buffer – will be written as PSD via ImageMagick fallback, or as JPEG if PSD not supported
    return await sharp(svgBuffer).png({ compressionLevel: 9 }).toBuffer();
  }
  return await sharp(svgBuffer).png({ compressionLevel: 9 }).toBuffer();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]+/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

async function processWithVips(inputPath, sessionPath, outputFormat) {
  const tempPngPath = path.join(sessionPath, `__vips_temp_${path.basename(inputPath)}.png`);
  const vipsCmd = `vips copy "${inputPath}" "${tempPngPath}"`;
  execSync(vipsCmd, { stdio: 'pipe' });
  if (!fs.existsSync(tempPngPath)) {
    throw new Error('libvips did not produce output');
  }
  const instance = sharp(tempPngPath);
  let buffer;
  switch (outputFormat.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      buffer = await instance.jpeg({ quality: 90, progressive: true }).toBuffer();
      break;
    case 'png':
      buffer = await instance.png({ compressionLevel: 9, progressive: true }).toBuffer();
      break;
    case 'webp':
      buffer = await instance.webp({ quality: 90, effort: 6 }).toBuffer();
      break;
    case 'tiff':
      buffer = await instance
        .removeAlpha()
        .tiff({ compression: 'jpeg', quality: 92 })
        .toBuffer();
      break;
    case 'svg': {
      const png = await instance.png({ compressionLevel: 9 }).toBuffer();
      const base64 = png.toString('base64');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 800 600"><image href="data:image/png;base64,${base64}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"/></svg>`;
      buffer = Buffer.from(svg, 'utf8');
      break;
    }
    case 'psd': {
      // produce high-quality JPEG base to keep PSD small yet visually lossless
      buffer = await instance
        .removeAlpha()
        .jpeg({ quality: 92 })
        .toBuffer();
      break;
    }
    default:
      buffer = await instance.jpeg({ quality: 90 }).toBuffer();
  }
  try { fs.unlinkSync(tempPngPath); } catch (_) {}
  return buffer;
}

async function processWithDcraw(inputPath, sessionPath, outputFormat, outputPath) {
  const tiffPath = path.join(sessionPath, `${path.basename(outputPath, path.extname(outputPath))}.tiff`);
  const dcrawCommand = `dcraw -v -w -T "${inputPath}"`;
  try {
    execSync(dcrawCommand, { cwd: sessionPath, stdio: 'pipe' });
  } catch (e) {
    // fallback: try ImageMagick directly to TIFF
    const cmd = getMagickCmd();
    try {
      execSync(`${cmd} "${inputPath}" -alpha off -depth 8 -compress LZW "${tiffPath}"`, { stdio: 'pipe' });
    } catch (imErr) {
      throw new Error('dcraw and ImageMagick both failed to produce TIFF');
    }
  }
  if (!fs.existsSync(tiffPath)) throw new Error('dcraw did not produce TIFF');
  const inst = sharp(tiffPath);
  let buffer;
  switch (outputFormat.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      buffer = await inst.jpeg({ quality: 90 }).toBuffer();
      break;
    case 'png':
      buffer = await inst.png({ compressionLevel: 9 }).toBuffer();
      break;
    case 'webp':
      buffer = await inst.webp({ quality: 90, effort: 6 }).toBuffer();
      break;
    case 'tiff':
      buffer = await inst.removeAlpha().tiff({ compression: 'jpeg', quality: 92 }).toBuffer();
      break;
    case 'svg': {
      const png = await inst.png({ compressionLevel: 9 }).toBuffer();
      const base64 = png.toString('base64');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 800 600"><image href="data:image/png;base64,${base64}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"/></svg>`;
      buffer = Buffer.from(svg, 'utf8');
      break;
    }
    case 'psd':
      buffer = fs.readFileSync(tiffPath); // hand off to PSD writer
      break;
    default:
      buffer = await inst.jpeg({ quality: 90 }).toBuffer();
  }
  try { fs.unlinkSync(tiffPath); } catch (_) {}
  return buffer;
}

// Prefer LibRaw's dcraw_emu when available – better CR3 support
async function processWithDcrawEmu(inputPath, sessionPath, outputFormat, outputPath) {
  const tiffPath = path.join(sessionPath, `${path.basename(outputPath, path.extname(outputPath))}.tiff`);
  try {
    // probe dcraw_emu (some builds don't support -V)
    try { execSync('dcraw_emu -h', { stdio: 'pipe' }); }
    catch (e) { execSync('which dcraw_emu', { stdio: 'pipe' }); }
  } catch (_) {
    throw new Error('dcraw_emu not available');
  }
  try {
    const cmd = `dcraw_emu -w -T "${inputPath}"`;
    execSync(cmd, { cwd: sessionPath, stdio: 'pipe' });
  } catch (e) {
    throw new Error('dcraw_emu failed');
  }

  if (!fs.existsSync(tiffPath)) throw new Error('dcraw_emu did not produce TIFF');
  const inst = sharp(tiffPath);
  let buffer;
  switch (outputFormat.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      buffer = await inst.jpeg({ quality: 90 }).toBuffer();
      break;
    case 'png':
      buffer = await inst.png({ compressionLevel: 9 }).toBuffer();
      break;
    case 'webp':
      buffer = await inst.webp({ quality: 90, effort: 6 }).toBuffer();
      break;
    case 'tiff':
      buffer = await inst.removeAlpha().tiff({ compression: 'jpeg', quality: 92 }).toBuffer();
      break;
    case 'svg': {
      const png = await inst.png({ compressionLevel: 9 }).toBuffer();
      const base64 = png.toString('base64');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 800 600"><image href="data:image/png;base64,${base64}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"/></svg>`;
      buffer = Buffer.from(svg, 'utf8');
      break;
    }
    case 'psd':
      buffer = fs.readFileSync(tiffPath);
      break;
    default:
      buffer = await inst.jpeg({ quality: 90 }).toBuffer();
  }
  try { fs.unlinkSync(tiffPath); } catch (_) {}
  return buffer;
}

async function writePsd(fromBufferOrPath, outputPath) {
  const tmpTiff = outputPath.replace(/\.psd$/i, '.tiff');
  if (Buffer.isBuffer(fromBufferOrPath)) {
    fs.writeFileSync(tmpTiff, fromBufferOrPath);
  } else {
    fs.copyFileSync(fromBufferOrPath, tmpTiff);
  }
  const cmd = getMagickCmd();
  try {
    // Force 8-bit, flatten, ZIP compression (usually smaller than RLE for photos), strip metadata
    execSync(`${cmd} "${tmpTiff}" -alpha off -depth 8 -compress Zip -strip -flatten "${outputPath}"`, { stdio: 'pipe' });
    try { fs.unlinkSync(tmpTiff); } catch (_) {}
    if (!fs.existsSync(outputPath)) {
      throw new Error('ImageMagick did not create PSD');
    }
  } catch (err) {
    // Fallback: write placeholder JPEG named .psd to indicate failure
    const placeholder = await makeErrorPlaceholder('jpg', path.basename(outputPath), 'PSD export failed');
    fs.writeFileSync(outputPath, placeholder);
    try { fs.unlinkSync(tmpTiff); } catch (_) {}
  }
}

(async () => {
  try {
    const { files, outputFormat, sessionPath, sessionId } = workerData;
    if (!files || !Array.isArray(files)) throw new Error('Invalid files data');
    if (!sessionPath || !sessionId) throw new Error('Invalid session data');

    const convertedFiles = [];
    const zipPath = path.join(sessionPath, 'converted_images.zip');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const inputPath = file.path;
      const originalName = file.originalname;
      const ext = path.extname(originalName).toLowerCase();
      const base = path.basename(originalName, ext);
      const targetName = `${base}.${outputFormat}`;
      const outputPath = path.join(sessionPath, targetName);

      try {
        let buffer;
        if (ext === '.heic' || ext === '.HEIC') {
          const inputBuffer = fs.readFileSync(inputPath);
          let heicOut = outputFormat.toUpperCase();
          if (heicOut !== 'JPEG' && heicOut !== 'PNG') heicOut = 'JPEG';
          buffer = await heicConvert({ buffer: inputBuffer, format: heicOut, quality: 0.9 });
          if (heicOut !== outputFormat.toUpperCase()) {
            const inst = sharp(buffer);
            switch (outputFormat.toLowerCase()) {
              case 'webp': buffer = await inst.webp({ quality: 90, effort: 6 }).toBuffer(); break;
              case 'tiff': buffer = await inst.tiff({ compression: 'lzw', quality: 90 }).toBuffer(); break;
              case 'svg': {
                const png = await inst.png({ compressionLevel: 9 }).toBuffer();
                const b64 = png.toString('base64');
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 800 600"><image href="data:image/png;base64,${b64}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"/></svg>`;
                buffer = Buffer.from(svg, 'utf8');
                break;
              }
              case 'psd': buffer = await inst.tiff({ compression: 'lzw', quality: 90 }).toBuffer(); break;
              default: break;
            }
          }
        } else if (ext === '.svg') {
          if (outputFormat.toLowerCase() === 'svg') {
            buffer = fs.readFileSync(inputPath);
          } else {
            const inst = sharp(inputPath);
            switch (outputFormat.toLowerCase()) {
              case 'jpg':
              case 'jpeg': buffer = await inst.jpeg({ quality: 90, progressive: true }).toBuffer(); break;
              case 'png': buffer = await inst.png({ compressionLevel: 9, progressive: true }).toBuffer(); break;
              case 'webp': buffer = await inst.webp({ quality: 90, effort: 6 }).toBuffer(); break;
              case 'tiff': buffer = await inst.tiff({ compression: 'lzw', quality: 90 }).toBuffer(); break;
              case 'psd': buffer = await inst.tiff({ compression: 'lzw', quality: 90 }).toBuffer(); break;
              default: buffer = await inst.png({ compressionLevel: 9 }).toBuffer();
            }
          }
        } else if (isRawExt(ext)) {
          // RAW: special handling for TIFF/PSD direct paths first
          if (outputFormat.toLowerCase() === 'tiff') {
            try {
              // 1) Try libvips direct to TIFF (8-bit, no alpha)
              const vipsTiffCmd = `vips copy "${inputPath}" "${outputPath}"`;
              execSync(vipsTiffCmd, { stdio: 'pipe' });
              if (!fs.existsSync(outputPath)) {
                throw new Error('vips did not write TIFF');
              }
              // Normalize to JPEG-in-TIFF Q92 to reduce size, visually lossless
              const norm = await sharp(outputPath).removeAlpha().tiff({ compression: 'jpeg', quality: 92 }).toBuffer();
              fs.writeFileSync(outputPath, norm);
              convertedFiles.push({ filename: path.basename(outputPath), size: norm.length });
              continue;
            } catch (_) {
              try {
                // 2) Fallback to ImageMagick direct
                const cmd = getMagickCmd();
                execSync(`${cmd} "${inputPath}" -alpha off -depth 8 -compress JPEG -quality 92 "${outputPath}"`, { stdio: 'pipe' });
                if (!fs.existsSync(outputPath)) throw new Error('magick did not write TIFF');
                convertedFiles.push({ filename: path.basename(outputPath), size: fs.statSync(outputPath).size });
                continue;
              } catch (imErr) {
                // 3) Last fallback: dcraw route
                buffer = await processWithDcraw(inputPath, sessionPath, outputFormat, outputPath);
              }
            }
          } else if (outputFormat.toLowerCase() === 'psd') {
            try {
              // Try ImageMagick direct PSD (flatten 8-bit)
              const cmd = getMagickCmd();
              execSync(`${cmd} "${inputPath}" -alpha off -depth 8 "${outputPath}"`, { stdio: 'pipe' });
              if (!fs.existsSync(outputPath)) throw new Error('magick did not write PSD');
              convertedFiles.push({ filename: path.basename(outputPath), size: fs.statSync(outputPath).size });
              continue;
            } catch (psdErr) {
              // fallback: generate high‑quality JPEG base then write PSD
              let baseJpg;
              try { baseJpg = await processWithVips(inputPath, sessionPath, 'jpg'); } catch (_) {}
              if (!baseJpg) baseJpg = await processWithDcraw(inputPath, sessionPath, 'jpg', outputPath);
              await writePsd(baseJpg, outputPath);
              convertedFiles.push({ filename: path.basename(outputPath), size: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : baseJpg.length });
              continue;
            }
          } else {
            // RAW other formats
            if (outputFormat.toLowerCase() === 'jpg' || outputFormat.toLowerCase() === 'jpeg') {
              // Try dcraw_emu → dcraw → vips
              let ok = false;
              try {
                buffer = await processWithDcrawEmu(inputPath, sessionPath, 'jpg', outputPath);
                ok = true;
              } catch (_) {}
              if (!ok) {
                try {
                  buffer = await processWithDcraw(inputPath, sessionPath, 'jpg', outputPath);
                  ok = true;
                } catch (_) {}
              }
              if (!ok) {
                buffer = await processWithVips(inputPath, sessionPath, 'jpg');
              }
              // If suspiciously tiny (<16KB), retry alternate path once (vips)
              if (!buffer || buffer.length < 16384) {
                try {
                  const alt = await processWithVips(inputPath, sessionPath, 'jpg');
                  if (alt && alt.length >= 16384) buffer = alt;
                } catch (_) {}
              }
            } else {
              // non-JPG raw targets: try dcraw_emu → vips → dcraw
              let ok = false;
              try { buffer = await processWithDcrawEmu(inputPath, sessionPath, outputFormat, outputPath); ok = true; } catch (_) {}
              if (!ok) {
                try { buffer = await processWithVips(inputPath, sessionPath, outputFormat); ok = true; } catch (_) {}
              }
              if (!ok) {
                buffer = await processWithDcraw(inputPath, sessionPath, outputFormat, outputPath);
              }
            }
          }
        } else {
          const inst = sharp(inputPath);
          switch (outputFormat.toLowerCase()) {
            case 'jpg':
            case 'jpeg': buffer = await inst.jpeg({ quality: 90, progressive: true }).toBuffer(); break;
            case 'png': buffer = await inst.png({ compressionLevel: 9, progressive: true }).toBuffer(); break;
            case 'webp': buffer = await inst.webp({ quality: 90, effort: 6 }).toBuffer(); break;
            case 'tiff': buffer = await inst.tiff({ compression: 'lzw', quality: 90 }).toBuffer(); break;
            case 'svg': {
              const png = await inst.png({ compressionLevel: 9 }).toBuffer();
              const b64 = png.toString('base64');
              const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="0 0 800 600"><image href="data:image/png;base64,${b64}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"/></svg>`;
              buffer = Buffer.from(svg, 'utf8');
              break;
            }
            case 'psd': buffer = await inst.tiff({ compression: 'lzw', quality: 90 }).toBuffer(); break;
            default: buffer = await inst.jpeg({ quality: 90 }).toBuffer();
          }
        }

        // Write output (handle PSD separately if needed)
        if (outputFormat.toLowerCase() === 'psd') {
          await writePsd(buffer, outputPath);
        } else {
          fs.writeFileSync(outputPath, buffer);
        }

        convertedFiles.push({ filename: path.basename(outputPath), size: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : buffer.length });
        // update progress
        try {
          const progressPath = path.join(sessionPath, 'progress.json');
          let prog = { total: files.length, done: i + 1, status: 'processing' };
          try { const existing = JSON.parse(fs.readFileSync(progressPath, 'utf8')); prog.total = existing.total || files.length; } catch (_) {}
          fs.writeFileSync(progressPath, JSON.stringify({ ...prog, sessionId, updatedAt: new Date().toISOString() }));
        } catch (_) {}
      } catch (err) {
        // Produce valid image placeholder instead of blank/invalid file
        const placeholder = await makeErrorPlaceholder(outputFormat, originalName, err.message);
        fs.writeFileSync(outputPath, placeholder);
        convertedFiles.push({ filename: path.basename(outputPath), size: placeholder.length });
        // update progress even on failure
        try {
          const progressPath = path.join(sessionPath, 'progress.json');
          let prog = { total: files.length, done: i + 1, status: 'processing' };
          try { const existing = JSON.parse(fs.readFileSync(progressPath, 'utf8')); prog.total = existing.total || files.length; } catch (_) {}
          fs.writeFileSync(progressPath, JSON.stringify({ ...prog, sessionId, updatedAt: new Date().toISOString() }));
        } catch (_) {}
      } finally {
        try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch (_) {}
      }
    }

    // ZIP
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      convertedFiles.forEach(f => {
        const p = path.join(sessionPath, f.filename);
        if (fs.existsSync(p)) archive.file(p, { name: f.filename });
      });
      archive.finalize();
    });

    // mark complete
    try {
      const progressPath = path.join(sessionPath, 'progress.json');
      let done = { total: files.length, done: files.length, status: 'done' };
      fs.writeFileSync(progressPath, JSON.stringify({ ...done, sessionId, updatedAt: new Date().toISOString() }));
    } catch (_) {}
    parentPort.postMessage({ success: true, convertedFiles, zipPath });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
})();


