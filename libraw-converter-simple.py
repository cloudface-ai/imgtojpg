#!/usr/bin/env python3
"""
Simple LibRaw-based RAW image converter
Fixed version with basic parameters to avoid compatibility issues
"""

import sys
import rawpy
import numpy as np
from PIL import Image
import os

def convert_raw_to_format(input_path, output_path, output_format='tiff'):
    """
    Convert RAW file to specified format using LibRaw with minimal parameters
    """
    try:
        print(f"🔧 LibRaw: Processing {os.path.basename(input_path)} → {output_format.upper()}")
        
        # Open RAW file with rawpy (LibRaw)
        with rawpy.imread(input_path) as raw:
            # Use simple, compatible parameters
            rgb = raw.postprocess(
                use_camera_wb=True,      # Use camera white balance
                half_size=False,         # Full resolution
                no_auto_bright=False,    # Let LibRaw handle brightness
                output_bps=8             # 8-bit output for compatibility
            )
        
        print(f"✅ LibRaw processed: {rgb.shape} array, dtype: {rgb.dtype}")
        
        # Convert to PIL Image
        image = Image.fromarray(rgb, 'RGB')
        
        # Save in requested format
        if output_format.lower() in ['jpg', 'jpeg']:
            image.save(output_path, 'JPEG', quality=95, optimize=True)
        elif output_format.lower() == 'png':
            image.save(output_path, 'PNG', compress_level=6)
        elif output_format.lower() == 'tiff':
            image.save(output_path, 'TIFF', compression='lzw')
        elif output_format.lower() == 'webp':
            image.save(output_path, 'WEBP', quality=95)
        elif output_format.lower() == 'psd':
            # Save as high-quality TIFF for PSD compatibility
            image.save(output_path, 'TIFF', compression='lzw')
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
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python3 libraw-converter-simple.py <input_raw> <output_file> <format>")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    format_type = sys.argv[3]
    
    success = convert_raw_to_format(input_file, output_file, format_type)
    sys.exit(0 if success else 1)
