from PIL import Image
import os

assets_to_process = [
    {
        "input": r"C:\Users\Max\.gemini\tmp\mars2050\images\clipboard-1781513597881.png",
        "output": r"D:\Max\Mars2050\public\assets\buildings\solar_panels.png"
    },
    {
        "input": r"C:\Users\Max\.gemini\tmp\mars2050\images\clipboard-1781514412351.png",
        "output": r"D:\Max\Mars2050\public\assets\buildings\mine.png"
    },
    {
        "input": r"C:\Users\Max\.gemini\tmp\mars2050\images\clipboard-1781514434947.png",
        "output": r"D:\Max\Mars2050\public\assets\buildings\greenhouse.png"
    }
]

def process_sprite(img_path, output_path, threshold=20):
    if not os.path.exists(img_path):
        print(f"Error: Source file {img_path} not found.")
        return

    img = Image.open(img_path)
    img = img.convert("RGBA")
    
    datas = img.getdata()
    new_data = []
    
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
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
    img.save(output_path, "PNG")
    print(f"Processed and saved to {output_path}")

if __name__ == "__main__":
    for asset in assets_to_process:
        process_sprite(asset["input"], asset["output"])
