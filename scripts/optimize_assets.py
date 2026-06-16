from PIL import Image
import os

INPUT_DIR = r"D:\Max\Mars2050\public\assets\buildings"
OUTPUT_DIR = r"D:\Max\Mars2050\public\assets\buildings"

def optimize_images():
    for filename in os.listdir(INPUT_DIR):
        if filename.endswith(".png"):
            file_path = os.path.join(INPUT_DIR, filename)
            img = Image.open(file_path)
            
            # 1. Resize to a reasonable max size (512px is plenty for our grid)
            target_width = 512
            if img.width > target_width:
                aspect_ratio = img.height / img.width
                img = img.resize((target_width, int(target_width * aspect_ratio)), Image.LANCZOS)
            
            # 2. Save as WebP with 80% quality (massive size reduction)
            new_filename = filename.replace(".png", ".webp")
            output_path = os.path.join(OUTPUT_DIR, new_filename)
            img.save(output_path, "WEBP", quality=80)
            
            original_size = os.path.getsize(file_path) / 1024
            new_size = os.path.getsize(output_path) / 1024
            
            print(f"Optimized {filename}: {original_size:.1f}KB -> {new_size:.1f}KB ({new_size/original_size:.1%})")
            
            # Optionally remove original PNG to keep public folder clean
            # os.remove(file_path)

if __name__ == "__main__":
    optimize_images()
