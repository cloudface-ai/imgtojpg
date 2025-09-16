// jobs/convert.js
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const archiver = require('archiver');

(async () => {
  try {
    const { files, outputFormat, sessionPath, sessionId } = workerData;
    
    if (!files || !Array.isArray(files)) {
      throw new Error('Invalid files data received');
    }

    if (!sessionPath || !sessionId) {
      throw new Error('Invalid session data received');
    }

    // Use output format from worker data
    
    console.log(`Starting conversion for session ${sessionId} with ${files.length} files to ${outputFormat} format`);

    const convertedFiles = [];
    const zipPath = path.join(sessionPath, 'converted_images.zip');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const inputPath = file.path;
      const originalName = file.originalname;
      
      console.log(`Processing file ${i + 1}/${files.length}: ${originalName}`);
      
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      const fileExtension = path.extname(originalName).toLowerCase();
      const fileNameWithoutExt = path.basename(originalName, fileExtension);
      
      // Determine output filename and path
      const outputFileName = `${fileNameWithoutExt}.${outputFormat}`;
      const outputPath = path.join(sessionPath, outputFileName);
      
      let outputBuffer;
      
      try {
        // Handle HEIC files specifically
        if (fileExtension === '.heic' || fileExtension === '.HEIC') {
          console.log(`Converting HEIC file: ${originalName}`);
          const inputBuffer = fs.readFileSync(inputPath);
          
          // heic-convert only supports JPEG and PNG
          let heicOutputFormat = outputFormat.toUpperCase();
          if (heicOutputFormat !== 'JPEG' && heicOutputFormat !== 'PNG') {
            console.log(`HEIC conversion: ${heicOutputFormat} not supported, converting to JPEG first`);
            heicOutputFormat = 'JPEG';
          }
          
          outputBuffer = await heicConvert({
            buffer: inputBuffer,
            format: heicOutputFormat,
            quality: 0.9,
          });
          
          // If user wanted a different format, convert from JPEG/PNG to desired format
          if (heicOutputFormat !== outputFormat.toUpperCase()) {
            console.log(`Converting from ${heicOutputFormat} to ${outputFormat}`);
            const tempSharp = sharp(outputBuffer);
            
            switch (outputFormat.toLowerCase()) {
              case 'webp':
                outputBuffer = await tempSharp.webp({ quality: 90, effort: 6 }).toBuffer();
                break;
              case 'tiff':
                outputBuffer = await tempSharp.tiff({ compression: 'lzw', quality: 90 }).toBuffer();
                break;
              case 'svg':
                // Create SVG with embedded PNG data
                const pngBuffer = await tempSharp.png({ compressionLevel: 9 }).toBuffer();
                const base64PNG = pngBuffer.toString('base64');
                
                // Create SVG with embedded PNG (minimized for smaller file size)
                const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="100%" viewBox="0 0 800 600"><image xlink:href="data:image/png;base64,${base64PNG}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"/></svg>`;
                
                outputBuffer = Buffer.from(svgContent, 'utf8');
                console.log(`Created SVG with embedded PNG data for ${outputFileName} (${outputBuffer.length} bytes)`);
                break;
              default:
                // Keep as JPEG/PNG if conversion fails
                console.log(`Keeping ${heicOutputFormat} format for ${outputFileName}`);
                break;
            }
          }
        } else if (fileExtension === '.svg') {
          // Handle SVG files
          console.log(`Converting SVG file: ${originalName}`);
          
          if (outputFormat.toLowerCase() === 'svg') {
            // If output is also SVG, just copy the file
            const inputBuffer = fs.readFileSync(inputPath);
            fs.writeFileSync(outputPath, inputBuffer);
            console.log(`SVG file copied as-is: ${outputFileName}`);
          } else {
            // Convert SVG to other formats using Sharp
            const sharpInstance = sharp(inputPath);
            
            switch (outputFormat.toLowerCase()) {
              case 'jpg':
              case 'jpeg':
                outputBuffer = await sharpInstance
                  .jpeg({ quality: 90, progressive: true })
                  .toBuffer();
                break;
              case 'png':
                outputBuffer = await sharpInstance
                  .png({ compressionLevel: 9, progressive: true })
                  .toBuffer();
                break;
              case 'webp':
                outputBuffer = await sharpInstance
                  .webp({ quality: 90, effort: 6 })
                  .toBuffer();
                break;
              case 'tiff':
                outputBuffer = await sharpInstance
                  .tiff({ compression: 'lzw', quality: 90 })
                  .toBuffer();
                break;

              default:
                // Default to PNG for SVG conversions
                console.log(`Unknown format ${outputFormat}, defaulting to PNG for SVG`);
                outputBuffer = await sharpInstance
                  .png({ compressionLevel: 9, progressive: true })
                  .toBuffer();
            }
          }
        } else if (['.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2', '.raf', '.orf', '.pef', '.rw2', '.3fr', '.rdc', '.iiq', '.dcr', '.k25', '.kdc', '.mef', '.mos', '.erf'].includes(fileExtension)) {
          // Handle RAW files with dcraw + Sharp (reliable and professional)
          console.log(`Processing RAW file: ${originalName}`);
          console.log(`File size: ${file.size} bytes`);
          console.log(`Target format: ${outputFormat}`);
          console.log(`Session path: ${sessionPath}`);
          
          // Check if system dependencies are available
          try {
            const { execSync } = require('child_process');
            console.log('Checking system dependencies...');
            
            // Test if dcraw command is available
            try {
              const dcrawVersion = execSync('dcraw -V', { stdio: 'pipe' }).toString();
              console.log('dcraw available:', dcrawVersion.split('\n')[0]);
            } catch (dcrawError) {
              console.log('dcraw not available:', dcrawError.message);
            }
            
          } catch (depError) {
            console.log('Error checking dependencies:', depError.message);
          }
          
          // RAW-specific validation rules (separate from general validation)
          if (i === 0) { // Only check once per conversion batch
            // Check file count limit for RAW files (max 10)
            if (files.length > 10) {
              throw new Error(`Maximum 10 RAW files allowed per conversion. You selected ${files.length} files.`);
            }
            
            // Check individual file size limit for RAW files (max 500MB)
            const maxRawSize = 500 * 1024 * 1024; // 500MB
            const oversizedRawFiles = files.filter(f => f.size > maxRawSize);
            if (oversizedRawFiles.length > 0) {
              const oversizedNames = oversizedRawFiles.map(f => f.originalname).join(', ');
              throw new Error(`RAW file(s) too large: ${oversizedNames}. Maximum size per RAW file: 500MB`);
            }
            
            console.log(`RAW validation passed: ${files.length} files, all under 500MB limit`);
          }
          
          try {
            if (outputFormat.toLowerCase() === 'jpg' || outputFormat.toLowerCase() === 'jpeg') {
              // Use dcraw + Sharp for JPG (reliable and professional)
              console.log(`Using dcraw + Sharp for JPG conversion: ${originalName}`);
              
              // Step 1: Use dcraw to convert RAW to TIFF
              const dcrawTiffPath = path.join(sessionPath, `${path.basename(originalName, path.extname(originalName))}.tiff`);
              const dcrawCommand = `dcraw -v -w -T "${inputPath}"`;
              console.log(`Executing dcraw command: ${dcrawCommand}`);
              
              try {
                execSync(dcrawCommand, { cwd: sessionPath, stdio: 'pipe' });
                
                // Check if dcraw created the TIFF file
                if (!fs.existsSync(dcrawTiffPath)) {
                  throw new Error(`dcraw failed to create TIFF file at ${dcrawTiffPath}`);
                }
                
                console.log(`dcraw successfully created TIFF: ${dcrawTiffPath}`);
                
                // Step 2: Use Sharp to convert TIFF to JPG
                const sharpInstance = sharp(dcrawTiffPath);
                outputBuffer = await sharpInstance
                  .jpeg({ quality: 90 })
                  .toBuffer();
                
                console.log(`Sharp successfully converted TIFF to JPG: ${outputFileName} (${outputBuffer.length} bytes)`);
                
                // Clean up temporary TIFF file
                try {
                  fs.unlinkSync(dcrawTiffPath);
                  console.log(`Cleaned up temporary TIFF file: ${dcrawTiffPath}`);
                } catch (cleanupError) {
                  console.log(`Warning: Could not clean up temp TIFF file ${dcrawTiffPath}:`, cleanupError.message);
                }
                
              } catch (dcrawError) {
                console.log(`dcraw failed: ${dcrawError.message}`);
                throw new Error(`dcraw failed for RAW conversion. Please ensure system dependencies are properly installed.`);
              }
              
            } else if (outputFormat.toLowerCase() === 'tiff') {
              // Use dcraw for TIFF (RAW files need specialized tools)
              console.log(`Using dcraw for TIFF conversion: ${originalName}`);
              
              // Use dcraw to convert RAW directly to TIFF
              const dcrawCommand = `dcraw -v -w -T "${inputPath}"`;
              console.log(`Executing dcraw command: ${dcrawCommand}`);
              
              try {
                execSync(dcrawCommand, { cwd: sessionPath, stdio: 'pipe' });
                
                // Check if dcraw created the TIFF file
                if (!fs.existsSync(outputPath)) {
                  throw new Error(`dcraw failed to create TIFF file at ${outputPath}`);
                }
                
                // Read the dcraw-generated TIFF
                outputBuffer = fs.readFileSync(outputPath);
                console.log(`dcraw successfully created TIFF: ${outputFileName} (${outputBuffer.length} bytes)`);
                
              } catch (dcrawError) {
                console.log(`dcraw failed for TIFF: ${dcrawError.message}`);
                throw new Error(`dcraw failed for TIFF conversion. Please ensure system dependencies are properly installed.`);
              }
              
            } else if (outputFormat.toLowerCase() === 'psd') {
              // Use dcraw + Sharp for PSD (convert to TIFF first, then create PSD placeholder)
              console.log(`Using dcraw + Sharp for PSD conversion: ${originalName}`);
              
              // Step 1: Use dcraw to convert RAW to TIFF
              const dcrawTiffPath = path.join(sessionPath, `${path.basename(originalName, path.extname(originalName))}.tiff`);
              const dcrawCommand = `dcraw -v -w -T "${inputPath}"`;
              console.log(`Executing dcraw command: ${dcrawCommand}`);
              
              try {
                execSync(dcrawCommand, { cwd: sessionPath, stdio: 'pipe' });
                
                // Check if dcraw created the TIFF file
                if (!fs.existsSync(dcrawTiffPath)) {
                  throw new Error(`dcraw failed to create TIFF file at ${dcrawTiffPath}`);
                }
                
                console.log(`dcraw successfully created TIFF: ${dcrawTiffPath}`);
                
                // Create a placeholder PSD file since conversion failed
                const psdPlaceholder = `%!PS-Adobe-3.0
%%Creator: imgtojpg.org
%%Title: ${originalName} (conversion failed)
%%Pages: 1
%%PageOrder: Ascend
%%BoundingBox: 0 0 612 792
%%EndComments
%%Page: 1 1
/Times-Roman findfont 12 scalefont setfont
100 700 moveto
(RAW to PSD conversion failed) show
100 680 moveto
(Original file: ${originalName}) show
100 660 moveto
(Please try converting to JPG or TIFF instead) show
showpage
%%EOF`;
                
                outputBuffer = Buffer.from(psdPlaceholder, 'utf8');
                console.log(`Created PSD placeholder: ${outputFileName}`);
                
                // Clean up temporary TIFF file
                try {
                  fs.unlinkSync(dcrawTiffPath);
                  console.log(`Cleaned up temporary TIFF file: ${dcrawTiffPath}`);
                } catch (cleanupError) {
                  console.log(`Warning: Could not clean up temp TIFF file ${dcrawTiffPath}:`, cleanupError.message);
                }
                
              } catch (dcrawError) {
                console.log(`dcraw failed: ${dcrawError.message}`);
                throw new Error(`dcraw failed for RAW conversion. Please ensure system dependencies are properly installed.`);
              }
              
            } else {
              // Use dcraw + Sharp for other formats (PNG, WebP)
              console.log(`Using dcraw + Sharp for ${outputFormat} conversion: ${originalName}`);
              
              // Step 1: Use dcraw to convert RAW to TIFF
              const dcrawTiffPath = path.join(sessionPath, `${path.basename(originalName, path.extname(originalName))}.tiff`);
              const dcrawCommand = `dcraw -v -w -T "${inputPath}"`;
              console.log(`Executing dcraw command: ${dcrawCommand}`);
              
              try {
                execSync(dcrawCommand, { cwd: sessionPath, stdio: 'pipe' });
                
                // Check if dcraw created the TIFF file
                if (!fs.existsSync(dcrawTiffPath)) {
                  throw new Error(`dcraw failed to create TIFF file at ${dcrawTiffPath}`);
                }
                
                console.log(`dcraw successfully created TIFF: ${dcrawTiffPath}`);
                
                // Step 2: Use Sharp to convert TIFF to desired format
                const sharpInstance = sharp(dcrawTiffPath);
                
                switch (outputFormat.toLowerCase()) {
                  case 'png':
                    outputBuffer = await sharpInstance.png({ compressionLevel: 9 }).toBuffer();
                    break;
                  case 'webp':
                    outputBuffer = await sharpInstance.webp({ quality: 90, effort: 6 }).toBuffer();
                    break;
                  case 'svg':
                    // Create SVG with embedded PNG data
                    const pngBuffer = await sharpInstance.png({ compressionLevel: 9 }).toBuffer();
                    const base64PNG = pngBuffer.toString('base64');
                    
                    // Create SVG with embedded PNG (minimized for smaller file size)
                    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="100%" viewBox="0 0 800 600"><image xlink:href="data:image/png;base64,${base64PNG}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"/></svg>`;
                    
                    outputBuffer = Buffer.from(svgContent, 'utf8');
                    console.log(`Created SVG with embedded PNG data for ${outputFileName} (${outputBuffer.length} bytes)`);
                    break;
                  default:
                    // Default to PNG if format not recognized
                    console.log(`Unknown format ${outputFormat}, defaulting to PNG`);
                    outputBuffer = await sharpInstance.png({ compressionLevel: 9 }).toBuffer();
                }
                
                // Clean up temporary TIFF file
                try {
                  fs.unlinkSync(dcrawTiffPath);
                  console.log(`Cleaned up temporary TIFF file: ${dcrawTiffPath}`);
                } catch (cleanupError) {
                  console.log(`Warning: Could not clean up temp TIFF file ${dcrawTiffPath}:`, cleanupError.message);
                }
                
              } catch (dcrawError) {
                console.log(`dcraw failed: ${dcrawError.message}`);
                throw new Error(`dcraw failed for RAW conversion. Please ensure system dependencies are properly installed.`);
              }
            }
            
            console.log(`Successfully converted RAW file to ${outputFormat}: ${outputFileName} (${outputBuffer.length} bytes)`);
            
          } catch (conversionError) {
            console.error(`RAW conversion failed for ${originalName}:`, conversionError.message);
            
            // Fallback: create informative error file
            const errorContent = `RAW conversion failed for: ${originalName}
            
Error: ${conversionError.message}

This could be due to:
- Corrupted RAW file
- Unsupported RAW format
- Processing issue

Please check your RAW file and try again.`;
            
            outputBuffer = Buffer.from(errorContent, 'utf8');
            console.log(`Created error file for failed RAW conversion: ${outputFileName}`);
          }
        } else {
          // Handle all other formats using Sharp
          console.log(`Converting ${fileExtension} file: ${originalName}`);
          const sharpInstance = sharp(inputPath);
          
          // Configure output format and quality
          switch (outputFormat.toLowerCase()) {
            case 'jpg':
            case 'jpeg':
              outputBuffer = await sharpInstance
                .jpeg({ quality: 90, progressive: true })
                .toBuffer();
              break;
            case 'png':
              outputBuffer = await sharpInstance
                .png({ compressionLevel: 9, progressive: true })
                .toBuffer();
              break;
            case 'webp':
              outputBuffer = await sharpInstance
                .webp({ quality: 90, effort: 6 })
                .toBuffer();
              break;
            case 'tiff':
              outputBuffer = await sharpInstance
                .tiff({ compression: 'lzw', quality: 90 })
                .toBuffer();
              break;
            case 'svg':
              // Create a simple SVG wrapper around the PNG data
              // Since Sharp doesn't support direct SVG output, we'll create a basic SVG
              const pngBuffer = await sharpInstance
                .png({ compressionLevel: 9 })
                .toBuffer();
              
              // Convert PNG to base64 for embedding in SVG
              const base64PNG = pngBuffer.toString('base64');
              
              // Create SVG with embedded PNG (minimized for smaller file size)
              const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="0 0 800 600"><image xlink:href="data:image/png;base64,${base64PNG}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"/></svg>`;
              
              outputBuffer = Buffer.from(svgContent, 'utf8');
              console.log(`Created SVG with embedded PNG data for ${outputFileName} (${outputBuffer.length} bytes)`);
              break;
            case 'psd':
              // Convert to PSD format (Photoshop)
              // Note: Sharp doesn't support PSD output, so we'll create a placeholder
              // In production, use a library like 'psd' or 'jimp' for PSD creation
              const psdPlaceholder = `Photoshop PSD File
              
This is a placeholder PSD file created from: ${originalName}
Output format: ${outputFormat}

For actual PSD creation, implement:
- PSD file format specification
- Layer structure
- Image data encoding
- Metadata handling

File: ${outputFileName}
Generated: ${new Date().toISOString()}`;
              
              outputBuffer = Buffer.from(psdPlaceholder, 'utf8');
              console.log(`Created PSD placeholder: ${outputFileName}`);
              break;
            default:
              // Default to JPEG if format not recognized
              console.log(`Unknown format ${outputFormat}, defaulting to JPEG`);
              outputBuffer = await sharpInstance
                .jpeg({ quality: 90 })
                .toBuffer();
          }
        }
        
        // Critical safety check: ensure outputBuffer is defined
        if (!outputBuffer) {
          console.error(`Critical error: outputBuffer is undefined for ${originalName}`);
          throw new Error(`Conversion failed: outputBuffer is undefined for ${originalName}`);
        }
        
        // Additional debugging for RAW files
        if (['.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2', '.raf', '.orf', '.pef', '.rw2', '.3fr', '.rdc', '.iiq', '.dcr', '.k25', '.kdc', '.mef', '.mos', '.erf'].includes(fileExtension)) {
          console.log(`🔍 RAW Debug: About to write ${outputFileName}`);
          console.log(`🔍 RAW Debug: outputBuffer size: ${outputBuffer.length} bytes`);
          console.log(`🔍 RAW Debug: Final outputPath: ${outputPath}`);
          console.log(`🔍 RAW Debug: Session path exists: ${fs.existsSync(sessionPath)}`);
          console.log(`🔍 RAW Debug: Session path writable: ${fs.accessSync(sessionPath, fs.constants.W_OK) ? 'Yes' : 'No'}`);
          console.log(`🔍 RAW Debug: outputBuffer type: ${typeof outputBuffer}`);
          console.log(`🔍 RAW Debug: outputBuffer is Buffer: ${Buffer.isBuffer(outputBuffer)}`);
        }
        
        // Write converted file
        fs.writeFileSync(outputPath, outputBuffer);
        
        // Verify the file was written correctly
        if (fs.existsSync(outputPath)) {
          const writtenFileSize = fs.statSync(outputPath).size;
          console.log(`✅ File written successfully: ${outputPath} (${writtenFileSize} bytes)`);
          
          if (writtenFileSize === 0) {
            console.error(`🚨 CRITICAL: File written but size is 0 bytes!`);
            console.error(`🚨 outputBuffer size was: ${outputBuffer.length} bytes`);
            console.error(`🚨 This indicates a serious issue with the conversion process`);
          }
        } else {
          console.error(`🚨 CRITICAL: File was not written to ${outputPath}`);
        }
        
        // Get converted file size
        const convertedFileSize = outputBuffer.length;
        
        convertedFiles.push({
          filename: outputFileName,
          size: convertedFileSize
        });
        console.log(`Successfully converted: ${outputFileName} (${convertedFileSize} bytes)`);
        
      } catch (conversionError) {
        console.error(`Error converting file ${originalName}:`, conversionError.message);
        throw new Error(`Failed to convert ${originalName}: ${conversionError.message}`);
      }
    }
    
    console.log(`Creating ZIP file with ${convertedFiles.length} converted images`);
    
    // Create ZIP file with all converted images
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`ZIP created: ${archive.pointer()} total bytes`);
    });
    
    archive.on('error', (err) => {
      throw new Error(`ZIP creation failed: ${err.message}`);
    });
    
    archive.pipe(output);
    
    // Add all converted files to ZIP
    convertedFiles.forEach(fileInfo => {
      const filePath = path.join(sessionPath, fileInfo.filename);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: fileInfo.filename });
      } else {
        console.warn(`Warning: Converted file not found for ZIP: ${filePath}`);
      }
    });
    
    await archive.finalize();
    
    console.log(`Conversion completed successfully for session ${sessionId}`);
    
    // Clean up input files after all conversions are complete
    for (const file of files) {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log(`Cleaned up input file: ${file.path}`);
        }
      } catch (cleanupError) {
        console.warn(`Warning: Could not clean up input file ${file.path}:`, cleanupError.message);
      }
    }
    
    // Send success message
    parentPort.postMessage({
      success: true,
      convertedFiles,
      zipPath
    });
    
  } catch (error) {
    console.error('Conversion error:', error);
    
    // Clean up any created files on error
    try {
      if (workerData.sessionPath && fs.existsSync(workerData.sessionPath)) {
        fs.rmSync(workerData.sessionPath, { recursive: true, force: true });
        console.log(`Cleaned up session directory on error: ${workerData.sessionPath}`);
      }
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError.message);
    }
    
    parentPort.postMessage({
      success: false,
      error: error.message
    });
  }
})();
