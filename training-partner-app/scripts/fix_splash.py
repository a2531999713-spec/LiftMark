#!/usr/bin/env python3
"""
Generate correct splash screen images with square dimensions.
Fixes the splash screen display issue on Android.
"""

from PIL import Image, ImageDraw
import os

# Configuration
SOURCE_LOGO = "assets/brand/splash-logo.png"
OUTPUT_DIR = "android/app/src/main/res"
BRAND_DIR = "assets/brand"

# Splash screen density configurations (name, size in pixels)
SPLASH_DENSITIES = [
    ("mdpi", 144),
    ("hdpi", 216),
    ("xhdpi", 288),
    ("xxhdpi", 432),
    ("xxxhdpi", 576),
]

def create_square_splash_logo(source_path, target_size):
    """Create a square splash logo with centered icon (no text)."""
    # Open source image
    src = Image.open(source_path).convert('RGBA')
    src_width, src_height = src.size
    
    # The source is 900x360 (wide rectangle) with logo on left, text on right
    # The circular logo is approximately centered in the left 35% of the image
    # Logo center is roughly at x=180, y=180, radius ~130px
    
    # Crop the logo area (circular part only, no text)
    # Logo is roughly from x=30 to x=320, y=20 to y=340
    logo_left = 30
    logo_top = 20
    logo_right = 320
    logo_bottom = 340
    
    logo_crop = src.crop((logo_left, logo_top, logo_right, logo_bottom))
    
    # Create square canvas with white background
    canvas = Image.new('RGBA', (target_size, target_size), (255, 255, 255, 255))
    
    # Resize logo to fit in square (with some padding)
    padding = int(target_size * 0.1)  # 10% padding
    logo_size = target_size - (padding * 2)
    logo_resized = logo_crop.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    
    # Center the logo on canvas
    x_offset = (target_size - logo_size) // 2
    y_offset = (target_size - logo_size) // 2
    canvas.paste(logo_resized, (x_offset, y_offset), logo_resized)
    
    return canvas.convert('RGB')

def create_splash_bitmap(source_path, size, background_color=(242, 244, 247)):
    """Create a splash screen bitmap with centered logo and background color."""
    # Create background
    bg = Image.new('RGB', (size, size), background_color)
    
    # Create square logo
    logo = create_square_splash_logo(source_path, size)
    
    # Composite logo onto background
    result = Image.alpha_composite(bg.convert('RGBA'), logo.convert('RGBA'))
    return result.convert('RGB')

def main():
    """Generate all splash screen files."""
    print("Generating splash screen files...")
    
    # Create brand directory if it doesn't exist
    os.makedirs(BRAND_DIR, exist_ok=True)
    
    # 1. Generate square splash logo for brand assets (1024x1024)
    print("\nCreating square splash logo (1024x1024)...")
    square_logo = create_square_splash_logo(SOURCE_LOGO, 1024)
    square_path = os.path.join(BRAND_DIR, "splash-logo-square.png")
    square_logo.save(square_path, 'PNG')
    print(f"  Created: {square_path}")
    
    # 2. Generate splash screen bitmaps for all densities
    for density, size in SPLASH_DENSITIES:
        print(f"\nProcessing {density} ({size}x{size})...")
        
        # Create drawable directory path
        drawable_dir = os.path.join(OUTPUT_DIR, f"drawable-{density}")
        os.makedirs(drawable_dir, exist_ok=True)
        
        # Generate splashscreen_logo.png
        splash_img = create_splash_bitmap(SOURCE_LOGO, size)
        splash_path = os.path.join(drawable_dir, "splashscreen_logo.png")
        splash_img.save(splash_path, 'PNG', optimize=True)
        print(f"  Created: {splash_path}")
    
    print("\n✓ All splash screen files generated successfully!")
    print("Note: You may need to update app.json to reference the new square splash logo.")

if __name__ == "__main__":
    main()
