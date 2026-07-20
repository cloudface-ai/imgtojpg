// jobs/convert_libraw.js
// Clean LibRaw-based RAW conversion (NO dcraw, NO Sharp for RAW)
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { execSync, execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const archiver = require('archiver');

const RAW_EXTS = ['.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2', '.raf', '.orf', '.pef', '.rw2', '.3fr', '.rdc', '.iiq', '.dcr', '.k25', '.kdc', '.mef', '.mos', '.erf'];

function isRawExt(ext) {
  return RAW_EXTS.includes(ext.toLowerCase());
}

function sanitizePath(filePath) {
  // Ensure path is absolute and within expected bounds
  const resolved = path.resolve(filePath);
  // Basic validation - no command injection characters
  if (resolved.includes(';') || resolved.includes('|') || resolved.includes('&') || resolved.includes('`')) {
    throw new Error(`Invalid file path: ${filePath}`);
  }
  return resolved;
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
  return await sharp(svgBuffer).png({ compressionLevel: 9 }).toBuffer();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]+/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

async function processWithLibRaw(inputPath, sessionPath, outputFormat, outputPath) {
  console.log(`🔧 LibRaw: Processing ${path.basename(inputPath)} → ${outputFormat}`);
  
  const pythonScript = path.join(__dirname, '..', 'libraw-converter-simple.py');
  const tempOutput = path.join(sessionPath, `libraw_${path.basename(outputPath)}`);
  // Prefer project venv (rawpy/numpy/pillow) when present
  const venvPython = path.join(__dirname, '..', '.venv', 'bin', 'python3');
  const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python3';
  
  // Sanitize all paths
  let safeInputPath, safeTempOutput, safePythonScript;
  try {
    safeInputPath = sanitizePath(inputPath);
    safeTempOutput = sanitizePath(tempOutput);
    safePythonScript = sanitizePath(pythonScript);
  } catch (pathError) {
    throw new Error(`Path validation failed: ${pathError.message}`);
  }
  
  try {
    console.log(`🔧 LibRaw command: ${pythonBin} ${safePythonScript} ${safeInputPath} ${safeTempOutput} ${outputFormat}`);
    
    // Use execFile with timeout instead of execSync
             const { stdout, stderr } = await execFileAsync(pythonBin, [
               safePythonScript,
               safeInputPath, 
               safeTempOutput,
               outputFormat
             ], {
               timeout: 1800000, // 30 minutes timeout for LibRaw processing
               encoding: 'utf8'
             });
    
    console.log(`🔧 LibRaw stdout: ${stdout}`);
    if (stderr) console.log(`🔧 LibRaw stderr: ${stderr}`);
    
    if (!fs.existsSync(tempOutput)) {
      throw new Error(`LibRaw did not create output file: ${tempOutput}`);
    }
    
    const buffer = fs.readFileSync(tempOutput);
    console.log(`✅ LibRaw conversion successful: ${buffer.length} bytes`);
    
    return buffer;
    
  } catch (error) {
    console.log(`❌ LibRaw failed: ${error.message}`);
    if (error.stderr) console.log(`❌ LibRaw stderr: ${error.stderr}`);
    if (error.stdout) console.log(`❌ LibRaw stdout: ${error.stdout}`);
             if (error.code === 'TIMEOUT') console.log(`❌ LibRaw timed out after 30 minutes`);
    
    // Fallback to ImageMagick direct conversion
    try {
      const cmd = getMagickCmd();
      console.log(`🔄 Falling back to ImageMagick for ${path.basename(inputPath)}`);
      
      const magickArgs = [safeInputPath, '-auto-orient', '-strip'];
      
      if (outputFormat.toLowerCase() === 'jpg' || outputFormat.toLowerCase() === 'jpeg') {
        magickArgs.push('-quality', '95');
      } else if (outputFormat.toLowerCase() === 'tiff') {
        magickArgs.push('-compress', 'LZW');
      }
      
      magickArgs.push(safeTempOutput);
      
               const { stdout: magickStdout, stderr: magickStderr } = await execFileAsync(cmd, magickArgs, {
                 timeout: 600000, // 10 minutes timeout for ImageMagick
                 encoding: 'utf8'
               });
      
      if (magickStdout) console.log(`🔧 ImageMagick stdout: ${magickStdout}`);
      if (magickStderr) console.log(`🔧 ImageMagick stderr: ${magickStderr}`);
      
      if (fs.existsSync(tempOutput)) {
        const buffer = fs.readFileSync(tempOutput);
        console.log(`✅ ImageMagick fallback successful: ${buffer.length} bytes`);
        return buffer;
      }
             } catch (fallbackError) {
               console.log(`❌ ImageMagick fallback also failed: ${fallbackError.message}`);
               if (fallbackError.stderr) console.log(`❌ ImageMagick fallback stderr: ${fallbackError.stderr}`);
               if (fallbackError.code === 'TIMEOUT') console.log(`❌ ImageMagick timed out after 10 minutes`);
             }
    
    throw new Error('Both LibRaw and ImageMagick failed');
  } finally {
    // Always clean up temp file
    try { 
      if (fs.existsSync(tempOutput)) {
        fs.unlinkSync(tempOutput); 
        console.log(`🧹 Cleaned up temp file: ${path.basename(tempOutput)}`);
      }
    } catch (cleanupError) {
      console.log(`⚠️ Failed to cleanup temp file: ${cleanupError.message}`);
    }
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
          // HEIC processing (keep existing logic)
          const inputBuffer = fs.readFileSync(inputPath);
          let heicOut = outputFormat.toUpperCase();
          if (heicOut !== 'JPEG' && heicOut !== 'PNG') heicOut = 'JPEG';
          buffer = await heicConvert({ buffer: inputBuffer, format: heicOut, quality: 0.9 });
          if (heicOut !== outputFormat.toUpperCase()) {
            const inst = sharp(buffer);
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
        } else if (ext === '.svg') {
          // SVG processing (keep existing logic)
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
          // RAW processing with LibRaw (NO dcraw, NO Sharp)
          console.log(`🎯 Processing RAW file ${originalName} (${ext}) → ${outputFormat}`);
          buffer = await processWithLibRaw(inputPath, sessionPath, outputFormat, outputPath);
        } else {
          // Regular image processing with Sharp
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

        // Write output
        fs.writeFileSync(outputPath, buffer);

        // Get actual file size after writing (with retry for file system sync)
        let actualFileSize = buffer.length;
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (fs.existsSync(outputPath)) {
            actualFileSize = fs.statSync(outputPath).size;
            console.log(`📁 File written: ${path.basename(outputPath)} (buffer: ${buffer.length} bytes, disk: ${actualFileSize} bytes)`);
          } else {
            console.log(`⚠️ File not found after write: ${outputPath}, using buffer size: ${buffer.length}`);
          }
        } catch (statError) {
          console.log(`⚠️ Error getting file stats: ${statError.message}, using buffer size: ${buffer.length}`);
        }

        convertedFiles.push({ filename: path.basename(outputPath), size: actualFileSize });
        
        // Update progress with current file info
        try {
          const progressPath = path.join(sessionPath, 'progress.json');
          let prog = { 
            total: files.length, 
            done: i + 1, 
            status: 'processing',
            currentFile: originalName,
            percent: Math.round(((i + 1) / files.length) * 100)
          };
          try { 
            const existing = JSON.parse(fs.readFileSync(progressPath, 'utf8')); 
            prog.total = existing.total || files.length; 
          } catch (_) {}
          fs.writeFileSync(progressPath, JSON.stringify({ 
            ...prog, 
            sessionId, 
            updatedAt: new Date().toISOString() 
          }));
          console.log(`📊 Progress: ${prog.done}/${prog.total} (${prog.percent}%) - ${originalName}`);
        } catch (_) {}
        
      } catch (err) {
        console.log(`❌ Conversion failed for ${originalName}: ${err.message}`);
        // Produce valid image placeholder instead of blank/invalid file
        const placeholder = await makeErrorPlaceholder(outputFormat, originalName, err.message);
        fs.writeFileSync(outputPath, placeholder);
        convertedFiles.push({ filename: path.basename(outputPath), size: placeholder.length });
        
        // Update progress even on failure
        try {
          const progressPath = path.join(sessionPath, 'progress.json');
          let prog = { 
            total: files.length, 
            done: i + 1, 
            status: 'processing',
            currentFile: originalName,
            percent: Math.round(((i + 1) / files.length) * 100)
          };
          try { 
            const existing = JSON.parse(fs.readFileSync(progressPath, 'utf8')); 
            prog.total = existing.total || files.length; 
          } catch (_) {}
          fs.writeFileSync(progressPath, JSON.stringify({ 
            ...prog, 
            sessionId, 
            updatedAt: new Date().toISOString() 
          }));
          console.log(`📊 Progress (failed): ${prog.done}/${prog.total} (${prog.percent}%) - ${originalName}`);
        } catch (_) {}
      }
    }

    // Create ZIP file
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    for (const fileInfo of convertedFiles) {
      const filePath = path.join(sessionPath, fileInfo.filename);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: fileInfo.filename });
      }
    }

    await archive.finalize();

    // Final progress update - mark as complete
    try {
      const progressPath = path.join(sessionPath, 'progress.json');
      const finalProgress = {
        total: files.length,
        done: files.length,
        status: 'done',
        currentFile: '',
        percent: 100,
        sessionId,
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(progressPath, JSON.stringify(finalProgress));
      console.log(`✅ Conversion complete: ${files.length}/${files.length} files processed`);
    } catch (_) {}

    // Send success message
    parentPort.postMessage({
      success: true,
      convertedFiles,
      zipPath,
      processingTime: 'N/A'
    });

  } catch (error) {
    console.error('Worker error:', error);
    parentPort.postMessage({
      success: false,
      error: error.message
    });
  }
})();
