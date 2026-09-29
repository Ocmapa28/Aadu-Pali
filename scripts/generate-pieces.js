import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * Pure Node.js 32-bit RGBA PNG Generator with Zlib deflate compression.
 */
function createPNG(width, height, rgbaBuffer) {
  // CRC32 table
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf, offset, length) {
    let c = 0xffffffff;
    for (let i = offset; i < offset + length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function writeChunk(type, data) {
    const chunkLen = data.length;
    const buf = Buffer.alloc(12 + chunkLen);
    buf.writeUInt32BE(chunkLen, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf, 4, chunkLen + 4);
    buf.writeUInt32BE(crc, 8 + chunkLen);
    return buf;
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk: width(4), height(4), bitDepth(1), colorType(1), comp(1), filter(1), interlace(1)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // Color type 6 = RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter method
  ihdrData[12] = 0; // No interlace
  const ihdrChunk = writeChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0; // Filter byte: None
    rgbaBuffer.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressedData = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = writeChunk('IDAT', compressedData);
  const iendChunk = writeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * 2D Software Rasterizer with Anti-Aliasing for Drawing Crisp Game Tokens
 */
class ImageBuffer {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4); // RGBA
  }

  getPixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return [0, 0, 0, 0];
    const idx = (y * this.width + x) * 4;
    return [this.data[idx], this.data[idx + 1], this.data[idx + 2], this.data[idx + 3]];
  }

  setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    this.data[idx] = Math.round(Math.max(0, Math.min(255, r)));
    this.data[idx + 1] = Math.round(Math.max(0, Math.min(255, g)));
    this.data[idx + 2] = Math.round(Math.max(0, Math.min(255, b)));
    this.data[idx + 3] = Math.round(Math.max(0, Math.min(255, a)));
  }

  blendPixel(x, y, r, g, b, alpha) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height || alpha <= 0) return;
    const idx = (y * this.width + x) * 4;
    const srcA = alpha;
    const dstA = this.data[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;

    const outR = (r * srcA + this.data[idx] * dstA * (1 - srcA)) / outA;
    const outG = (g * srcA + this.data[idx + 1] * dstA * (1 - srcA)) / outA;
    const outB = (b * srcA + this.data[idx + 2] * dstA * (1 - srcA)) / outA;

    this.data[idx] = Math.round(outR);
    this.data[idx + 1] = Math.round(outG);
    this.data[idx + 2] = Math.round(outB);
    this.data[idx + 3] = Math.round(outA * 255);
  }
}

// -------------------------------------------------------------
// RENDER TIGER PIECE
// -------------------------------------------------------------
function generateTigerPiece(size = 512) {
  const img = new ImageBuffer(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.44;

  // 1. Antialiased Base Coin with Amber/Haldi Gold Gradient & Bevel
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r + 2) {
        const edgeAlpha = Math.max(0, Math.min(1, r + 1 - dist));
        if (edgeAlpha <= 0) continue;

        const normDist = dist / r;
        const angle = Math.atan2(dy, dx);
        const lightAngle = -Math.PI / 4;
        const diffuse = Math.cos(angle - lightAngle) * 0.5 + 0.5;

        // Radial gold & amber gradient
        let red, green, blue;
        if (normDist < 0.78) {
          // Inner coin body: Haldi gold to rich orange-amber
          const t = normDist / 0.78;
          red = 255 - t * 35;
          green = 210 - t * 75;
          blue = 70 - t * 50;
        } else if (normDist < 0.90) {
          // Brass inner ring groove
          red = 160 + diffuse * 60;
          green = 100 + diffuse * 50;
          blue = 20 + diffuse * 20;
        } else {
          // Outer polished rim with specular highlights
          red = 230 + diffuse * 25;
          green = 180 + diffuse * 35;
          blue = 45 + diffuse * 30;
        }

        // Inner shadow near outer rim
        if (normDist > 0.74 && normDist < 0.80) {
          const shadowT = (normDist - 0.74) / 0.06;
          red *= 1 - shadowT * 0.35;
          green *= 1 - shadowT * 0.35;
          blue *= 1 - shadowT * 0.35;
        }

        img.blendPixel(x, y, red, green, blue, edgeAlpha);
      }
    }
  }

  // Helper for drawing anti-aliased circles/ellipses
  function drawFilledCircle(centerX, centerY, radius, cr, cg, cb, ca = 1) {
    const minX = Math.floor(centerX - radius - 2);
    const maxX = Math.ceil(centerX + radius + 2);
    const minY = Math.floor(centerY - radius - 2);
    const maxY = Math.ceil(centerY + radius + 2);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - centerX, y - centerY);
        const a = Math.max(0, Math.min(1, radius + 1 - d)) * ca;
        if (a > 0) img.blendPixel(x, y, cr, cg, cb, a);
      }
    }
  }

  // Helper for drawing anti-aliased polygons
  function drawPolygon(points, cr, cg, cb, ca = 1) {
    let minX = size, maxX = 0, minY = size, maxY = 0;
    for (const p of points) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    minX = Math.floor(Math.max(0, minX - 2));
    maxX = Math.ceil(Math.min(size - 1, maxX + 2));
    minY = Math.floor(Math.max(0, minY - 2));
    maxY = Math.ceil(Math.min(size - 1, maxY + 2));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        // Point in polygon ray-casting with subpixel samples for AA
        let insideCount = 0;
        const samples = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
        for (const [sx, sy] of samples) {
          const px = x + sx;
          const py = y + sy;
          let inside = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i][0], yi = points[i][1];
            const xj = points[j][0], yj = points[j][1];
            const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
          }
          if (inside) insideCount++;
        }
        if (insideCount > 0) {
          img.blendPixel(x, y, cr, cg, cb, (insideCount / 4) * ca);
        }
      }
    }
  }

  // 2. Tiger Ears (Left & Right)
  // Outer Ears (Dark Chocolate/Black)
  drawPolygon([[cx - 145, cy - 80], [cx - 110, cy - 160], [cx - 60, cy - 110]], 40, 15, 5, 0.95);
  drawPolygon([[cx + 145, cy - 80], [cx + 110, cy - 160], [cx + 60, cy - 110]], 40, 15, 5, 0.95);
  // Inner Ear Fluff (Cream/Gold)
  drawPolygon([[cx - 130, cy - 85], [cx - 105, cy - 145], [cx - 75, cy - 110]], 255, 220, 160, 0.9);
  drawPolygon([[cx + 130, cy - 85], [cx + 105, cy - 145], [cx + 75, cy - 110]], 255, 220, 160, 0.9);

  // 3. Tiger Head Shape (Warm Amber Core)
  drawFilledCircle(cx, cy + 10, r * 0.65, 235, 140, 20, 0.95);

  // 4. White / Cream Muzzle & Cheek Fur
  drawFilledCircle(cx - 55, cy + 60, 48, 255, 245, 225, 0.95);
  drawFilledCircle(cx + 55, cy + 60, 48, 255, 245, 225, 0.95);
  drawFilledCircle(cx, cy + 85, 38, 255, 245, 225, 0.95);

  // 5. Forehead Royal Stripes (Traditional Indian Bengal Tiger Motifs)
  // Crown Center Diamond / Trishul Stripe
  drawPolygon([[cx, cy - 140], [cx - 14, cy - 75], [cx, cy - 50], [cx + 14, cy - 75]], 35, 12, 5, 0.95);
  drawPolygon([[cx - 30, cy - 110], [cx - 18, cy - 120], [cx - 28, cy - 65], [cx - 40, cy - 65]], 35, 12, 5, 0.95);
  drawPolygon([[cx + 30, cy - 110], [cx + 18, cy - 120], [cx + 28, cy - 65], [cx + 40, cy - 65]], 35, 12, 5, 0.95);

  // Forehead Side Stripes
  drawPolygon([[cx - 85, cy - 40], [cx - 45, cy - 25], [cx - 75, cy - 15]], 35, 12, 5, 0.95);
  drawPolygon([[cx + 85, cy - 40], [cx + 45, cy - 25], [cx + 75, cy - 15]], 35, 12, 5, 0.95);

  // Cheek Stripes
  drawPolygon([[cx - 115, cy + 15], [cx - 65, cy + 15], [cx - 105, cy + 32]], 35, 12, 5, 0.95);
  drawPolygon([[cx + 115, cy + 15], [cx + 65, cy + 15], [cx + 105, cy + 32]], 35, 12, 5, 0.95);

  drawPolygon([[cx - 105, cy + 45], [cx - 60, cy + 45], [cx - 95, cy + 62]], 35, 12, 5, 0.95);
  drawPolygon([[cx + 105, cy + 45], [cx + 60, cy + 45], [cx + 95, cy + 62]], 35, 12, 5, 0.95);

  // 6. Tiger Almond Eyes (Fierce Golden Eyes with Dark Eyelids)
  // Left Eye
  drawPolygon([[cx - 78, cy - 8], [cx - 40, cy - 20], [cx - 22, cy - 5], [cx - 45, cy + 6]], 35, 10, 5, 1.0);
  drawPolygon([[cx - 70, cy - 7], [cx - 40, cy - 16], [cx - 28, cy - 5], [cx - 44, cy + 2]], 255, 220, 40, 1.0);
  drawPolygon([[cx - 52, cy - 15], [cx - 44, cy - 15], [cx - 44, cy + 2], [cx - 52, cy + 2]], 30, 10, 5, 1.0); // Slit pupil
  drawFilledCircle(cx - 54, cy - 10, 3, 255, 255, 255, 0.9); // Catchlight

  // Right Eye
  drawPolygon([[cx + 78, cy - 8], [cx + 40, cy - 20], [cx + 22, cy - 5], [cx + 45, cy + 6]], 35, 10, 5, 1.0);
  drawPolygon([[cx + 70, cy - 7], [cx + 40, cy - 16], [cx + 28, cy - 5], [cx + 44, cy + 2]], 255, 220, 40, 1.0);
  drawPolygon([[cx + 44, cy - 15], [cx + 52, cy - 15], [cx + 52, cy + 2], [cx + 44, cy + 2]], 30, 10, 5, 1.0); // Slit pupil
  drawFilledCircle(cx + 46, cy - 10, 3, 255, 255, 255, 0.9); // Catchlight

  // 7. Terracotta / Rose Nose & Muzzle Details
  drawPolygon([[cx - 24, cy + 25], [cx + 24, cy + 25], [cx, cy + 50]], 210, 75, 45, 1.0);
  // Nostrils
  drawFilledCircle(cx - 10, cy + 42, 4, 60, 20, 10, 0.9);
  drawFilledCircle(cx + 10, cy + 42, 4, 60, 20, 10, 0.9);
  // Center philtrum line & mouth
  drawPolygon([[cx - 3, cy + 50], [cx + 3, cy + 50], [cx + 3, cy + 78], [cx - 3, cy + 78]], 40, 15, 5, 0.95);
  drawPolygon([[cx - 28, cy + 76], [cx, cy + 78], [cx + 28, cy + 76], [cx + 26, cy + 82], [cx, cy + 83], [cx - 26, cy + 82]], 40, 15, 5, 0.95);

  // Whisker Dots
  for (const [wx, wy] of [[cx - 40, cy + 50], [cx - 52, cy + 58], [cx - 38, cy + 66], [cx + 40, cy + 50], [cx + 52, cy + 58], [cx + 38, cy + 66]]) {
    drawFilledCircle(wx, wy, 3, 50, 20, 10, 0.9);
  }

  return img;
}

// -------------------------------------------------------------
// RENDER GOAT PIECE
// -------------------------------------------------------------
function generateGoatPiece(size = 512) {
  const img = new ImageBuffer(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.44;

  // 1. Antialiased Polished Ivory / Pearl Coin with Silver Bevel
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r + 2) {
        const edgeAlpha = Math.max(0, Math.min(1, r + 1 - dist));
        if (edgeAlpha <= 0) continue;

        const normDist = dist / r;
        const angle = Math.atan2(dy, dx);
        const lightAngle = -Math.PI / 4;
        const diffuse = Math.cos(angle - lightAngle) * 0.5 + 0.5;

        // Radial polished ivory & pearl gradient
        let red, green, blue;
        if (normDist < 0.78) {
          // Inner coin body: Pure ivory to warm sandstone cream
          const t = normDist / 0.78;
          red = 255 - t * 25;
          green = 250 - t * 30;
          blue = 240 - t * 40;
        } else if (normDist < 0.90) {
          // Inner groove
          red = 180 + diffuse * 30;
          green = 175 + diffuse * 30;
          blue = 165 + diffuse * 30;
        } else {
          // Outer polished silver/ivory rim with specular highlight
          red = 240 + diffuse * 15;
          green = 238 + diffuse * 17;
          blue = 230 + diffuse * 20;
        }

        // Ambient rim shadow
        if (normDist > 0.74 && normDist < 0.80) {
          const shadowT = (normDist - 0.74) / 0.06;
          red *= 1 - shadowT * 0.20;
          green *= 1 - shadowT * 0.20;
          blue *= 1 - shadowT * 0.20;
        }

        img.blendPixel(x, y, red, green, blue, edgeAlpha);
      }
    }
  }

  // Helpers
  function drawFilledCircle(centerX, centerY, radius, cr, cg, cb, ca = 1) {
    const minX = Math.floor(centerX - radius - 2);
    const maxX = Math.ceil(centerX + radius + 2);
    const minY = Math.floor(centerY - radius - 2);
    const maxY = Math.ceil(centerY + radius + 2);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - centerX, y - centerY);
        const a = Math.max(0, Math.min(1, radius + 1 - d)) * ca;
        if (a > 0) img.blendPixel(x, y, cr, cg, cb, a);
      }
    }
  }

  function drawPolygon(points, cr, cg, cb, ca = 1) {
    let minX = size, maxX = 0, minY = size, maxY = 0;
    for (const p of points) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    minX = Math.floor(Math.max(0, minX - 2));
    maxX = Math.ceil(Math.min(size - 1, maxX + 2));
    minY = Math.floor(Math.max(0, minY - 2));
    maxY = Math.ceil(Math.min(size - 1, maxY + 2));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let insideCount = 0;
        const samples = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
        for (const [sx, sy] of samples) {
          const px = x + sx;
          const py = y + sy;
          let inside = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i][0], yi = points[i][1];
            const xj = points[j][0], yj = points[j][1];
            const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
          }
          if (inside) insideCount++;
        }
        if (insideCount > 0) {
          img.blendPixel(x, y, cr, cg, cb, (insideCount / 4) * ca);
        }
      }
    }
  }

  // 2. Majestic Curved Horns (Left & Right)
  // Left Horn (Sweeping upward & outward with ridges)
  drawPolygon([[cx - 20, cy - 65], [cx - 60, cy - 130], [cx - 120, cy - 155], [cx - 150, cy - 110], [cx - 125, cy - 115], [cx - 85, cy - 105], [cx - 45, cy - 50]], 90, 70, 55, 0.95);
  // Left Horn Ridge Highlights
  drawPolygon([[cx - 30, cy - 75], [cx - 70, cy - 125], [cx - 115, cy - 142], [cx - 95, cy - 115], [cx - 55, cy - 65]], 145, 125, 105, 0.9);

  // Right Horn (Symmetrical)
  drawPolygon([[cx + 20, cy - 65], [cx + 60, cy - 130], [cx + 120, cy - 155], [cx + 150, cy - 110], [cx + 125, cy - 115], [cx + 85, cy - 105], [cx + 45, cy - 50]], 90, 70, 55, 0.95);
  // Right Horn Ridge Highlights
  drawPolygon([[cx + 30, cy - 75], [cx + 70, cy - 125], [cx + 120, cy - 142], [cx + 95, cy - 115], [cx + 55, cy - 65]], 145, 125, 105, 0.9);

  // 3. Graceful Pointed Ears (Left & Right)
  // Outer Ears
  drawPolygon([[cx - 50, cy - 20], [cx - 135, cy - 10], [cx - 150, cy + 20], [cx - 60, cy + 15]], 210, 195, 180, 0.95);
  drawPolygon([[cx + 50, cy - 20], [cx + 135, cy - 10], [cx + 150, cy + 20], [cx + 60, cy + 15]], 210, 195, 180, 0.95);
  // Inner Ear (Warm Sandstone Rose)
  drawPolygon([[cx - 60, cy - 12], [cx - 125, cy - 5], [cx - 135, cy + 15], [cx - 70, cy + 12]], 240, 190, 180, 0.9);
  drawPolygon([[cx + 60, cy - 12], [cx + 125, cy - 5], [cx + 135, cy + 15], [cx + 70, cy + 12]], 240, 190, 180, 0.9);

  // 4. Goat Head Base (Slender, Regal Silhouette)
  drawPolygon([[cx - 55, cy - 45], [cx + 55, cy - 45], [cx + 45, cy + 50], [cx + 28, cy + 105], [cx, cy + 120], [cx - 28, cy + 105], [cx - 45, cy + 50]], 248, 242, 230, 0.98);

  // Forehead Crown Fur
  drawFilledCircle(cx, cy - 35, 45, 255, 252, 245, 1.0);
  drawFilledCircle(cx, cy + 30, 48, 252, 248, 238, 1.0);

  // 5. Expressive Dark Eyes (Horizontal Pupils Characteristic of Goats)
  // Left Eye
  drawPolygon([[cx - 65, cy - 5], [cx - 36, cy - 15], [cx - 24, cy - 2], [cx - 42, cy + 8]], 60, 45, 35, 1.0);
  drawPolygon([[cx - 60, cy - 4], [cx - 38, cy - 12], [cx - 28, cy - 2], [cx - 42, cy + 5]], 180, 130, 60, 1.0);
  drawPolygon([[cx - 56, cy - 4], [cx - 32, cy - 4], [cx - 32, cy + 1], [cx - 56, cy + 1]], 30, 20, 15, 1.0); // Horizontal goat pupil
  drawFilledCircle(cx - 46, cy - 6, 2.5, 255, 255, 255, 0.9); // Highlight

  // Right Eye
  drawPolygon([[cx + 65, cy - 5], [cx + 36, cy - 15], [cx + 24, cy - 2], [cx + 42, cy + 8]], 60, 45, 35, 1.0);
  drawPolygon([[cx + 60, cy - 4], [cx + 38, cy - 12], [cx + 28, cy - 2], [cx + 42, cy + 5]], 180, 130, 60, 1.0);
  drawPolygon([[cx + 32, cy - 4], [cx + 56, cy - 4], [cx + 56, cy + 1], [cx + 32, cy + 1]], 30, 20, 15, 1.0); // Horizontal goat pupil
  drawFilledCircle(cx + 46, cy - 6, 2.5, 255, 255, 255, 0.9); // Highlight

  // 6. Muzzle, Nose & Smile
  drawPolygon([[cx - 18, cy + 75], [cx + 18, cy + 75], [cx + 12, cy + 92], [cx, cy + 96], [cx - 12, cy + 92]], 110, 85, 75, 1.0);
  // Nostrils
  drawFilledCircle(cx - 7, cy + 85, 3, 50, 35, 25, 0.9);
  drawFilledCircle(cx + 7, cy + 85, 3, 50, 35, 25, 0.9);
  // Mouth line
  drawPolygon([[cx - 2, cy + 96], [cx + 2, cy + 96], [cx + 2, cy + 108], [cx - 2, cy + 108]], 70, 50, 40, 0.95);
  drawPolygon([[cx - 16, cy + 106], [cx, cy + 108], [cx + 16, cy + 106], [cx + 14, cy + 110], [cx, cy + 111], [cx - 14, cy + 110]], 70, 50, 40, 0.95);

  // 7. Small Silky Chin Beard
  drawPolygon([[cx - 12, cy + 112], [cx + 12, cy + 112], [cx + 8, cy + 138], [cx, cy + 146], [cx - 8, cy + 138]], 235, 225, 210, 0.9);

  return img;
}

// -------------------------------------------------------------
// MAIN GENERATION
// -------------------------------------------------------------
const outputDir = path.resolve('web/assets/pieces');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Generating high-resolution transparent game piece assets...');

const tigerImg = generateTigerPiece(512);
const tigerPng = createPNG(512, 512, tigerImg.data);
fs.writeFileSync(path.join(outputDir, 'tiger-piece.png'), tigerPng);
console.log('✓ Created web/assets/pieces/tiger-piece.png (512x512 transparent PNG)');

const goatImg = generateGoatPiece(512);
const goatPng = createPNG(512, 512, goatImg.data);
fs.writeFileSync(path.join(outputDir, 'goat-piece.png'), goatPng);
console.log('✓ Created web/assets/pieces/goat-piece.png (512x512 transparent PNG)');
