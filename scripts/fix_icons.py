#!/usr/bin/env python3
"""
Generate correct Android icon files with proper background color.
Fixes the white background issue in ic_launcher_background.webp files.
"""

from PIL import Image, ImageDraw
import os

# Configuration
BACKGROUND_COLOR = (13, 27, 42)  # #0D1B2A (dark navy)
FOREGROUND_PATH = "assets/brand/adaptive-icon-foreground.png"
OUTPUT_DIR = "android/app/src/main/res"

# Density configurations (name, size in pixels)
DENSITIES = [
    ("mdpi", 48),
    ("hdpi", 72),
    ("xhdpi", 96),
    ("xxhdpi", 144),
    ("xxxhdpi", 192),
]

def create_solid_background(size, color):
    """Create a solid color background image."""
    img = Image.new('RGB', (size, size), color)
    return img

def create_composite_icon(foreground_path, size, background_color):
    """Create a composite icon with foreground on colored background."""
    # Create background
    bg = Image.new('RGBA', (size, size), background_color + (255,))
    
    # Load and resize foreground
    fg = Image.open(foreground_path).convert('RGBA')
    fg = fg.resize((size, size), Image.Resampling.LANCZOS)
    
    # Composite foreground onto background
    result = Image.alpha_composite(bg, fg)
    return result.convert('RGB')

def main():
    """Generate all icon files."""
    print("Generating Android icon files...")
    
    for density, size in DENSITIES:
        print(f"\nProcessing {density} ({size}x{size})...")
        
        # Create mipmap directory path
        mipmap_dir = os.path.join(OUTPUT_DIR, f"mipmap-{density}")
        os.makedirs(mipmap_dir, exist_ok=True)
        
        # 1. Generate ic_launcher_background.webp (solid color)
        bg_img = create_solid_background(size, BACKGROUND_COLOR)
        bg_path = os.path.join(mipmap_dir, "ic_launcher_background.webp")
        bg_img.save(bg_path, 'WEBP', lossless=True, quality=100)
        print(f"  Created: {bg_path}")
        
        # 2. Generate ic_launcher.webp (composite icon)
        launcher_img = create_composite_icon(FOREGROUND_PATH, size, BACKGROUND_COLOR)
        launcher_path = os.path.join(mipmap_dir, "ic_launcher.webp")
        launcher_img.save(launcher_path, 'WEBP', lossless=True, quality=100)
        print(f"  Created: {launcher_path}")
        
        # 3. Generate ic_launcher_round.webp (same as launcher for adaptive icons)
        round_path = os.path.join(mipmap_dir, "ic_launcher_round.webp")
        launcher_img.save(round_path, 'WEBP', lossless=True, quality=100)
        print(f"  Created: {round_path}")
    
    print("\n✓ All icon files generated successfully!")
    print(f"Background color: #{BACKGROUND_COLOR[0]:02X}{BACKGROUND_COLOR[1]:02X}{BACKGROUND_COLOR[2]:02X}")

if __name__ == "__main__":
    main()
