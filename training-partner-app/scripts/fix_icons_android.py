#!/usr/bin/env python3
"""
Generate correct Android adaptive icon with WHITE foreground on dark navy background.
This fixes the issue where dark navy logo blends with dark navy background.
"""

from PIL import Image, ImageDraw
import os

# Configuration
SOURCE_FOREGROUND = "assets/brand/adaptive-icon-foreground.png"
OUTPUT_DIR = "android/app/src/main/res"
BRAND_DIR = "assets/brand"

# Colors
DARK_NAVY = (13, 27, 42)  # #0D1B2A
WHITE = (255, 255, 255)
RED = (255, 65, 54)  # #FF4136

# Density configurations
DENSITIES = [
    ("mdpi", 48),
    ("hdpi", 72),
    ("xhdpi", 96),
    ("xxhdpi", 144),
    ("xxxhdpi", 192),
]

def create_white_foreground(source_path, target_size):
    """Create a white version of the foreground logo for Android adaptive icon."""
    # Open source image
    src = Image.open(source_path).convert('RGBA')
    
    # Resize to target size
    src = src.resize((target_size, target_size), Image.Resampling.LANCZOS)
    
    # Get pixel data
    pixels = src.load()
    width, height = src.size
    
    # Create output image
    output = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    out_pixels = output.load()
    
    # Define color ranges to replace
    # Dark navy: RGB close to (13, 27, 42)
    # Red: RGB close to (255, 65, 54)
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            
            if a < 128:  # Skip transparent pixels
                continue
            
            # Check if pixel is dark navy (logo parts)
            if r < 50 and g < 80 and b < 100:
                # Replace with WHITE
                out_pixels[x, y] = (255, 255, 255, 255)
            # Check if pixel is red (accent)
            elif r > 200 and g < 100 and b < 100:
                # Keep RED as-is
                out_pixels[x, y] = (255, 65, 54, 255)
            else:
                # Keep other pixels as-is
                out_pixels[x, y] = (r, g, b, a)
    
    return output

def create_composite_icon(foreground, size, background_color):
    """Create a composite icon with foreground on colored background."""
    # Create background
    bg = Image.new('RGBA', (size, size), background_color + (255,))
    
    # Resize foreground if needed
    fg = foreground.resize((size, size), Image.Resampling.LANCZOS)
    
    # Composite foreground onto background
    result = Image.alpha_composite(bg, fg)
    return result.convert('RGB')

def main():
    """Generate all Android icon files."""
    print("Generating Android adaptive icon with WHITE foreground...")
    
    # Create white foreground for xxxhdpi (192x192) as source
    source_size = 1024
    print(f"\nCreating white foreground ({source_size}x{source_size})...")
    white_fg = create_white_foreground(SOURCE_FOREGROUND, source_size)
    
    # Save the white foreground to brand directory
    white_fg_path = os.path.join(BRAND_DIR, "adaptive-icon-foreground-white.png")
    white_fg.save(white_fg_path, 'PNG')
    print(f"  Saved: {white_fg_path}")
    
    # Generate icons for all densities
    for density, size in DENSITIES:
        print(f"\nProcessing {density} ({size}x{size})...")
        
        # Create mipmap directory path
        mipmap_dir = os.path.join(OUTPUT_DIR, f"mipmap-{density}")
        os.makedirs(mipmap_dir, exist_ok=True)
        
        # 1. Generate ic_launcher_background.webp (solid dark navy)
        bg_img = Image.new('RGB', (size, size), DARK_NAVY)
        bg_path = os.path.join(mipmap_dir, "ic_launcher_background.webp")
        bg_img.save(bg_path, 'WEBP', lossless=True, quality=100)
        print(f"  Created: ic_launcher_background.webp")
        
        # 2. Generate foreground (white logo)
        fg_img = create_white_foreground(SOURCE_FOREGROUND, size)
        fg_path = os.path.join(mipmap_dir, "ic_launcher_foreground.webp")
        fg_img.save(fg_path, 'WEBP', lossless=True, quality=100)
        print(f"  Created: ic_launcher_foreground.webp")
        
        # 3. Generate ic_launcher.webp (composite: dark navy bg + white fg)
        launcher_img = create_composite_icon(fg_img, size, DARK_NAVY)
        launcher_path = os.path.join(mipmap_dir, "ic_launcher.webp")
        launcher_img.save(launcher_path, 'WEBP', lossless=True, quality=100)
        print(f"  Created: ic_launcher.webp")
        
        # 4. Generate ic_launcher_round.webp (same as launcher)
        round_path = os.path.join(mipmap_dir, "ic_launcher_round.webp")
        launcher_img.save(round_path, 'WEBP', lossless=True, quality=100)
        print(f"  Created: ic_launcher_round.webp")
    
    print("\nAll Android icon files generated successfully!")
    print(f"Background: #{DARK_NAVY[0]:02X}{DARK_NAVY[1]:02X}{DARK_NAVY[2]:02X}")
    print("Foreground: WHITE logo on transparent background")

if __name__ == "__main__":
    main()
