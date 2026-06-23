import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ASSETS_DIR = process.argv[2] || 'D:\\Max\\Mars2050\\assets\\A_heavy_industrial_soldier_clad\\A_heavy_industrial_soldier_clad';
const OUTPUT_DIR = path.join('public', 'sprites', 'units');
const OUTPUT_NAME = 'flamethrower';
const TARGET_SIZE = 128; // Scale down to 128x128

async function packSprites() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const frames: { name: string; file: string }[] = [];

  // Parse Idle (rotations)
  const rotationsDir = path.join(ASSETS_DIR, 'rotations');
  if (fs.existsSync(rotationsDir)) {
    for (const file of fs.readdirSync(rotationsDir)) {
      if (file.endsWith('.png')) {
        const direction = path.basename(file, '.png');
        frames.push({ name: `${OUTPUT_NAME}_idle_${direction}_00`, file: path.join(rotationsDir, file) });
      }
    }
  }

  // Parse Animations
  const animationsDir = path.join(ASSETS_DIR, 'animations');
  if (fs.existsSync(animationsDir)) {
    for (const animFolder of fs.readdirSync(animationsDir)) {
      let animType = 'walk';
      if (animFolder.includes('bracing') || animFolder.includes('shoot')) animType = 'shoot';
      
      const dirs = path.join(animationsDir, animFolder);
      if (!fs.statSync(dirs).isDirectory()) continue;

      for (const direction of fs.readdirSync(dirs)) {
        const dirPath = path.join(dirs, direction);
        if (!fs.statSync(dirPath).isDirectory()) continue;

        for (const file of fs.readdirSync(dirPath)) {
          if (file.endsWith('.png')) {
            const frameNum = path.basename(file, '.png').replace('frame_', '');
            frames.push({ name: `${OUTPUT_NAME}_${animType}_${direction}_${frameNum}`, file: path.join(dirPath, file) });
          }
        }
      }
    }
  }

  if (frames.length === 0) {
    console.error('No frames found!');
    return;
  }

  console.log(`Found ${frames.length} frames.`);

  // Calculate spritesheet dimensions (try to make it somewhat square)
  const cols = Math.ceil(Math.sqrt(frames.length));
  const rows = Math.ceil(frames.length / cols);

  const sheetWidth = cols * TARGET_SIZE;
  const sheetHeight = rows * TARGET_SIZE;

  const metadata = {
    frames: {} as any,
    meta: {
      image: `${OUTPUT_NAME}.png`,
      format: "RGBA8888",
      size: { w: sheetWidth, h: sheetHeight },
      scale: "1"
    }
  };

  const compositeOperations = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const col = i % cols;
    const row = Math.floor(i / cols);

    const x = col * TARGET_SIZE;
    const y = row * TARGET_SIZE;

    // Buffer resized image
    const resizedBuffer = await sharp(frame.file)
      .resize(TARGET_SIZE, TARGET_SIZE, {
        kernel: sharp.kernel.nearest, // Preserve crisp edges
      })
      .toBuffer();

    compositeOperations.push({
      input: resizedBuffer,
      top: y,
      left: x
    });

    metadata.frames[frame.name] = {
      frame: { x, y, w: TARGET_SIZE, h: TARGET_SIZE },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: TARGET_SIZE, h: TARGET_SIZE },
      sourceSize: { w: TARGET_SIZE, h: TARGET_SIZE }
    };
  }

  // Create empty transparent image and composite all frames
  console.log(`Generating spritesheet ${sheetWidth}x${sheetHeight}...`);
  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent
    }
  })
  .composite(compositeOperations)
  .png()
  .toFile(path.join(OUTPUT_DIR, `${OUTPUT_NAME}.png`));

  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${OUTPUT_NAME}.json`),
    JSON.stringify(metadata, null, 2)
  );

  console.log('Done!');
}

packSprites().catch(console.error);
