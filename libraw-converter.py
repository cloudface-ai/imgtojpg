#!/usr/bin/env python3
"""
LibRaw-based RAW image converter
Replaces dcraw with proper LibRaw processing
"""

import sys
import rawpy
import numpy as np
from PIL import Image
import os

def convert_raw_to_format(input_path, output_path, output_format='tiff'):
    """
    Convert RAW file to specified format using LibRaw
    """
    try:
        print(f"🔧 LibRaw: Processing {os.path.basename(input_path)} → {output_format.upper()}")
        
        # Open RAW file with rawpy (LibRaw)
        with rawpy.imread(input_path) as raw:
            # Process RAW with optimized settings for proper exposure
            rgb = raw.postprocess(
                use_camera_wb=True,          # Use camera white balance
                half_size=False,             # Full resolution
                no_auto_bright=True,         # Manual brightness control
                output_bps=16,               # 16-bit output for quality
                gamma=(1.8, 4.5),           # More aggressive gamma for Canon RAW
                bright=1.8,                  # Increased brightness for proper exposure
                highlight_mode=0,            # No highlight clipping
                user_wb=None,                # Use camera WB
                auto_bright_thr=0.01,       # Auto brightness threshold
                use_auto_wb=False,           # Stick to camera WB
                output_color=1               # sRGB color space
            )
        
        print(f"✅ LibRaw processed: {rgb.shape} array, dtype: {rgb.dtype}")
        
        # Handle different output formats with proper bit depth
        if output_format.lower() == 'psd':
            # For PSD: Keep 16-bit and use ImageMagick for proper PSD format
            if rgb.dtype == np.uint16:
                # Save as 16-bit TIFF first, then convert to PSD with ImageMagick
                temp_tiff = output_path.replace('.psd', '_temp.tiff')
                image_16bit = Image.fromarray(rgb, 'RGB')
                image_16bit.save(temp_tiff, 'TIFF', compression=None)
                
                # Use ImageMagick to convert to proper PSD with layers
                import subprocess
                try:
                    subprocess.run(['convert', temp_tiff, '-depth', '16', '-colorspace', 'sRGB', output_path], 
                                 check=True, capture_output=True)
                    os.remove(temp_tiff)  # Clean up temp file
                    print(f"🎨 Created 16-bit PSD: {os.path.basename(output_path)}")
                except subprocess.CalledProcessError as e:
                    print(f"⚠️ ImageMagick PSD conversion failed: {e}")
                    # Fallback to high-quality TIFF
                    image_16bit.save(output_path.replace('.psd', '.tiff'), 'TIFF', compression='lzw')
                    os.rename(output_path.replace('.psd', '.tiff'), output_path)
            else:
                # 8-bit fallback
                rgb_8bit = rgb
                image = Image.fromarray(rgb_8bit, 'RGB')
                image.save(output_path, 'TIFF', compression='lzw')
        else:
            # For other formats: Convert to 8-bit
            if rgb.dtype == np.uint16:
                rgb_8bit = (rgb / 256).astype(np.uint8)
            else:
                rgb_8bit = rgb
                
            # Create PIL Image
            image = Image.fromarray(rgb_8bit, 'RGB')
            
            # Save in requested format
            if output_format.lower() in ['jpg', 'jpeg']:
                image.save(output_path, 'JPEG', quality=95, optimize=True)
            elif output_format.lower() == 'png':
                image.save(output_path, 'PNG', compress_level=6)
            elif output_format.lower() == 'tiff':
                # For TIFF: Keep higher quality, less compression
                image.save(output_path, 'TIFF', compression='lzw', quality=100)
            elif output_format.lower() == 'webp':
                image.save(output_path, 'WEBP', quality=95, lossless=False)
            else:
                # Default to JPEG
                image.save(output_path, 'JPEG', quality=95, optimize=True)
            
        # Check output file
        if os.path.exists(output_path):
            size = os.path.getsize(output_path)
            print(f"✅ LibRaw conversion successful: {os.path.basename(output_path)} ({size} bytes)")
            return True
        else:
            print(f"❌ LibRaw failed to create output file: {output_path}")
            return False
            
    except Exception as e:
        print(f"❌ LibRaw conversion failed: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python3 libraw-converter.py <input_raw> <output_file> <format>")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    format_type = sys.argv[3]
    
    success = convert_raw_to_format(input_file, output_file, format_type)
    sys.exit(0 if success else 1)
