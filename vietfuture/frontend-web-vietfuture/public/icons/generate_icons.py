#!/usr/bin/env python3
"""Generate PWA icons for LumoHub app."""
from PIL import Image, ImageDraw, ImageFont
import os

# Icon sizes required for PWA manifest
SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

# Colors - gradient from indigo to purple (matching app theme)
COLOR_TOP = (79, 70, 229)      # #4F46E5 (indigo-600)
COLOR_BOTTOM = (139, 92, 246)  # #8B5CF6 (purple-500)
WHITE = (255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)


def make_gradient(size):
    """Create a radial gradient from indigo to purple."""
    img = Image.new("RGBA", (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2
    radius = size // 2

    for y in range(size):
        for x in range(size):
            dx, dy = x - cx, y - cy
            dist = (dx * dx + dy * dy) ** 0.5
            if dist <= radius:
                # Linear interpolation between top and bottom color
                t = y / size
                r = int(COLOR_TOP[0] + (COLOR_BOTTOM[0] - COLOR_TOP[0]) * t)
                g = int(COLOR_TOP[1] + (COLOR_BOTTOM[1] - COLOR_TOP[1]) * t)
                b = int(COLOR_TOP[2] + (COLOR_BOTTOM[2] - COLOR_TOP[2]) * t)
                img.putpixel((x, y), (r, g, b, 255))
            else:
                img.putpixel((x, y), TRANSPARENT)

    return img


def make_icon(size):
    """Create a complete icon with rounded background and letter."""
    # Create base with gradient circle
    img = make_gradient(size)
    draw = ImageDraw.Draw(img)

    # Add white letter "L" centered
    try:
        font_size = int(size * 0.45)
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except Exception:
        font_size = int(size * 0.45)
        font = ImageFont.load_default()

    # Draw "L" letter
    letter = "L"
    # Get text bounding box
    bbox = draw.textbbox((0, 0), letter, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    # Center the letter
    x = (size - text_w) // 2 - bbox[0]
    y = (size - text_h) // 2 - bbox[1]

    # Add subtle shadow for readability
    shadow_offset = max(1, size // 64)
    draw.text((x + shadow_offset, y + shadow_offset), letter, font=font, fill=(0, 0, 0, 80))
    draw.text((x, y), letter, font=font, fill=WHITE)

    return img


def make_maskable_icon(size):
    """Create an icon with safe zone for maskable icons (iOS ignores this but good practice)."""
    img = make_icon(size)

    if size >= 192:
        # Create a version with padding removed for maskable icons
        # The center 80% is safe, so we ensure the icon is centered
        # This is a simplified version - the main icon works as-is
        pass

    return img


def main():
    output_dir = os.path.join(os.path.dirname(__file__), "icons")
    os.makedirs(output_dir, exist_ok=True)

    for size in SIZES:
        icon = make_icon(size)

        # Save as PNG
        out_path = os.path.join(output_dir, f"icon-{size}.png")
        icon.save(out_path, "PNG")
        print(f"Created: {out_path}")

        # Also create a favicon version
        if size == 512:
            # Create favicon.ico with multiple sizes
            favicon_sizes = [16, 32, 48]
            favicon_imgs = [make_icon(s) for s in favicon_sizes]
            favicon_path = os.path.join(output_dir, "..", "favicon.ico")
            favicon_imgs[0].save(
                favicon_path,
                "ICO",
                sizes=[(s, s) for s in favicon_sizes],
            )
            print(f"Created: {favicon_path}")

            # Create apple-touch-icon
            apple_path = os.path.join(output_dir, "..", "apple-touch-icon.png")
            icon_180 = make_icon(180)
            icon_180.save(apple_path, "PNG")
            print(f"Created: {apple_path}")

    # Also create the main logo for the app root
    logo_512 = make_icon(512)
    logo_path = os.path.join(output_dir, "..", "logo_lumohub.png")
    logo_512.save(logo_path, "PNG")
    print(f"Created: {logo_path}")

    print("\nAll icons generated successfully!")


if __name__ == "__main__":
    main()
