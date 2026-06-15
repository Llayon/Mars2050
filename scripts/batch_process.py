from PIL import Image
import os
import glob

INPUT_DIR = r"D:\Max\Mars2050\assets"
OUTPUT_DIR = r"D:\Max\Mars2050\public\assets\buildings"

def make_transparent(img_path, output_path):
    img = Image.open(img_path).convert("RGBA")
    
    datas = img.getdata()
    new_data = []
    
    # Threshold for "black" background
    threshold = 20 
    
    # Track bounding box manually to crop efficiently
    min_x, min_y = img.width, img.height
    max_x, max_y = 0, 0
    
    for y in range(img.height):
        for x in range(img.width):
            item = datas[y * img.width + x]
            if item[0] < threshold and item[1] < threshold and item[2] < threshold:
                new_data.append((0, 0, 0, 0)) # Transparent
            else:
                new_data.append(item)
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y
                
    img.putdata(new_data)
    
    if min_x < max_x and min_y < max_y:
        # Add a tiny padding
        padding = 5
        crop_box = (
            max(0, min_x - padding),
            max(0, min_y - padding),
            min(img.width, max_x + padding),
            min(img.height, max_y + padding)
        )
        img = img.crop(crop_box)
        
    img.save(output_path, "PNG")
    print(f"Processed: {os.path.basename(img_path)}")

if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    files = [
        "research-lab.png",
        "solar-panels.png",
        "oxygen-generator.png",
        "mine.png",
        "farm.png",
        "dome.png"
    ]
    
    for filename in files:
        in_p = os.path.join(INPUT_DIR, filename)
        out_p = os.path.join(OUTPUT_DIR, filename)
        if os.path.exists(in_p):
            make_transparent(in_p, out_p)
        else:
            print(f"File not found: {in_p}")
