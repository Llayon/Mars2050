from PIL import Image
import os

input_path = r"C:\Users\Max\.gemini\tmp\mars2050\images\clipboard-1781430143843.png"
output_path = r"D:\Max\Mars2050\public\assets\buildings\water_extractor.png"

def make_transparent(img_path, output_path):
    img = Image.open(img_path)
    img = img.convert("RGBA")
    
    datas = img.getdata()
    new_data = []
    
    # Threshold for "black" background
    threshold = 15 
    
    for item in datas:
        # Check if pixel is close to black (R, G, B < threshold)
        if item[0] < threshold and item[1] < threshold and item[2] < threshold:
            new_data.append((0, 0, 0, 0)) # Fully transparent
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    
    # Auto-crop to remove empty space around the building
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(output_path, "PNG")
    print(f"Processed and saved to {output_path}")

if __name__ == "__main__":
    if not os.path.exists(os.path.dirname(output_path)):
        os.makedirs(os.path.dirname(output_path))
    make_transparent(input_path, output_path)
