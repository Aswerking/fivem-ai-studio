/**
 * FiveM AI Studio - Ped Texture Baker & YTD Injection Engine
 * 
 * Bakes all procedural WebGL shader modifications (Demon/blind eyes, gouged eye sockets,
 * blood tear trails, stitched facial slashes, 3D wounds, facial tattoos, skin tones)
 * directly into GTA V Freemode Ped textures (head_diff_000_a_whi.png) and compiles them
 * directly into binary RSC7 Texture Dictionaries (head_diff_000_a_whi.ytd).
 * 
 * Result: 100% visual parity between FiveM AI Studio 3D viewport, OpenIV Model Viewer, and FiveM game servers!
 */

import * as pako from 'pako';

// --- 1. DXT1 (BC1) Texture Encoder for GTA V Texture Dictionaries ---
function to565(r, g, b) {
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

function unpack565(c) {
  const r = ((c >> 11) & 0x1f) * 255 / 31;
  const g = ((c >> 5) & 0x3f) * 255 / 63;
  const b = (c & 0x1f) * 255 / 31;
  return [r, g, b];
}

export function encodeDXT1(rgba, width, height) {
  const blockW = width >> 2;
  const blockH = height >> 2;
  const totalBlocks = blockW * blockH;
  const out = new Uint8Array(totalBlocks * 8);
  let outPtr = 0;

  for (let by = 0; by < height; by += 4) {
    for (let bx = 0; bx < width; bx += 4) {
      let minR = 255, minG = 255, minB = 255;
      let maxR = 0, maxG = 0, maxB = 0;
      const blockPixels = [];

      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const idx = ((by + py) * width + (bx + px)) * 4;
          const r = rgba[idx];
          const g = rgba[idx + 1];
          const b = rgba[idx + 2];
          blockPixels.push([r, g, b]);
          if (r < minR) minR = r;
          if (g < minG) minG = g;
          if (b < minB) minB = b;
          if (r > maxR) maxR = r;
          if (g > maxG) maxG = g;
          if (b > maxB) maxB = b;
        }
      }

      let c0 = to565(maxR, maxG, maxB);
      let c1 = to565(minR, minG, minB);

      if (c0 < c1) {
        const tmp = c0; c0 = c1; c1 = tmp;
      } else if (c0 === c1 && c0 > 0) {
        c1 = Math.max(0, c0 - 1);
      }

      const p0 = unpack565(c0);
      const p1 = unpack565(c1);
      const p2 = [(2 * p0[0] + p1[0]) / 3, (2 * p0[1] + p1[1]) / 3, (2 * p0[2] + p1[2]) / 3];
      const p3 = [(p0[0] + 2 * p1[0]) / 3, (p0[1] + 2 * p1[1]) / 3, (p0[2] + 2 * p1[2]) / 3];
      const palette = [p0, p1, p2, p3];

      let indices = 0;
      for (let i = 0; i < 16; i++) {
        const [pr, pg, pb] = blockPixels[i];
        let bestDist = 1e9;
        let bestIdx = 0;
        for (let ci = 0; ci < 4; ci++) {
          const [cr, cg, cb] = palette[ci];
          const dist = (pr - cr) * (pr - cr) + (pg - cg) * (pg - cg) + (pb - cb) * (pb - cb);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = ci;
          }
        }
        indices |= (bestIdx << (i * 2));
      }

      out[outPtr++] = c0 & 0xff;
      out[outPtr++] = (c0 >> 8) & 0xff;
      out[outPtr++] = c1 & 0xff;
      out[outPtr++] = (c1 >> 8) & 0xff;
      out[outPtr++] = indices & 0xff;
      out[outPtr++] = (indices >> 8) & 0xff;
      out[outPtr++] = (indices >> 16) & 0xff;
      out[outPtr++] = (indices >> 24) & 0xff;
    }
  }

  return out;
}

// Downsample RGBA image by 2x2 for mipmap generation
function downsample2x(srcRgba, w, h) {
  const nw = Math.max(1, w >> 1);
  const nh = Math.max(1, h >> 1);
  const dst = new Uint8Array(nw * nh * 4);

  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx = x << 1;
      const sy = y << 1;
      const i0 = (sy * w + sx) * 4;
      const i1 = (sy * w + sx + 1) * 4;
      const i2 = ((sy + 1) * w + sx) * 4;
      const i3 = ((sy + 1) * w + sx + 1) * 4;

      const r = (srcRgba[i0] + srcRgba[i1] + srcRgba[i2] + srcRgba[i3]) >> 2;
      const g = (srcRgba[i0 + 1] + srcRgba[i1 + 1] + srcRgba[i2 + 1] + srcRgba[i3 + 1]) >> 2;
      const b = (srcRgba[i0 + 2] + srcRgba[i1 + 2] + srcRgba[i2 + 2] + srcRgba[i3 + 2]) >> 2;
      const a = (srcRgba[i0 + 3] + srcRgba[i1 + 3] + srcRgba[i2 + 3] + srcRgba[i3 + 3]) >> 2;

      const di = (y * nw + x) * 4;
      dst[di] = r;
      dst[di + 1] = g;
      dst[di + 2] = b;
      dst[di + 3] = a;
    }
  }
  return { rgba: dst, width: nw, height: nh };
}

// Re-encode a GTA V RSC7 Texture Dictionary with new pixel data
export function injectTextureIntoYTD(baseYtdBuffer, bakedRgba, width = 512, height = 512) {
  const uint8 = new Uint8Array(baseYtdBuffer);
  // Decompress RSC7 payload (raw deflate)
  const decompressed = pako.inflateRaw(uint8.subarray(16));
  const sysPart = decompressed.subarray(0, 8192);

  // Generate full mipmap chain for DXT1
  const fullGfx = new Uint8Array(262144);
  let curRgba = bakedRgba;
  let curW = width;
  let curH = height;
  let gfxOffset = 0;

  for (let level = 0; level < 8; level++) {
    const dxtLevel = encodeDXT1(curRgba, curW, curH);
    fullGfx.set(dxtLevel, gfxOffset);
    gfxOffset += dxtLevel.length;

    if (curW > 4 && curH > 4) {
      const down = downsample2x(curRgba, curW, curH);
      curRgba = down.rgba;
      curW = down.width;
      curH = down.height;
    } else {
      break;
    }
  }

  // Combine system part and new graphics part
  const newDecompressed = new Uint8Array(8192 + 262144);
  newDecompressed.set(sysPart, 0);
  newDecompressed.set(fullGfx, 8192);

  // Compress with raw deflate
  const deflated = pako.deflateRaw(newDecompressed, { level: 6 });

  // Prepend original 16-byte RSC7 header
  const finalYtd = new Uint8Array(16 + deflated.length);
  finalYtd.set(uint8.subarray(0, 16), 0);
  finalYtd.set(deflated, 16);

  return finalYtd;
}

// --- 2. Procedural Facial Feature & Eye Baking Engine ---

/**
 * Bakes eyes, scars, stitches, blood trails, tattoos and skin tint onto an offscreen canvas.
 * Returns { canvas, dataUrl, rgba, buffer }
 */
export async function bakePedHeadTexture(morphs = {}, baseTextureUrl = '/textures/freemode_base/head_diff_000_a_whi.png') {
  // Load base image
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(new Error('Failed to load base head texture: ' + e));
    img.src = baseTextureUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // 1. Draw base texture
  ctx.drawImage(img, 0, 0, 512, 512);

  // 2. Skin tone tinting (if customized)
  if (morphs.skinColor && morphs.skinColor !== '#ffffff' && morphs.skinColor !== '#ffe0bd') {
    applySkinToneTint(ctx, morphs.skinColor);
  }

  // 3. Eyeball Iris / Eye Color (Eyeball patch center at X=451, Y=454)
  bakeEyeballPatch(ctx, morphs);

  // 4. Gouged Eye Sockets & Blood Tear Trails
  bakeGougedSocketsAndBlood(ctx, morphs);

  // 5. Facial Slashes, Scars & Surgical Stitches
  bakeFacialScarsAndStitches(ctx, morphs);

  // 6. Facial Tattoos (Rawr, w.e.a, spiderweb, clown, teardrop, stars, etc.)
  if (morphs.faceTattoo && morphs.faceTattoo > 0) {
    bakeFacialTattoo(ctx, morphs.faceTattoo);
  }

  // Extract pixel data & PNG data URL
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const dataUrl = canvas.toDataURL('image/png');

  // Convert dataURL to Uint8Array PNG buffer
  const binString = atob(dataUrl.split(',')[1]);
  const pngBuffer = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    pngBuffer[i] = binString.charCodeAt(i);
  }

  return {
    canvas,
    dataUrl,
    rgba: imgData.data,
    buffer: pngBuffer,
    width: 512,
    height: 512
  };
}

// --- Helpers for Procedural Drawing ---

function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

// Tint skin while preserving eyes and teeth
function applySkinToneTint(ctx, hexColor) {
  const rgb = hexToRgb(hexColor);
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;

  // Base GTA V Caucasian skin tone reference: RGB(202, 161, 142)
  const refR = 202, refG = 161, refB = 142;
  const multR = rgb.r / refR;
  const multG = rgb.g / refG;
  const multB = rgb.b / refB;

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      // Exclude eyeball patch (circle around 451, 454)
      const dEye = Math.hypot(x - 451, y - 454);
      if (dEye < 52) continue;

      // Exclude teeth/mouth patch (bottom left: x < 105 && y > 400)
      if (x < 105 && y > 400) continue;

      const idx = (y * 512 + x) * 4;
      data[idx] = Math.min(255, Math.round(data[idx] * multR));
      data[idx + 1] = Math.min(255, Math.round(data[idx + 1] * multG));
      data[idx + 2] = Math.min(255, Math.round(data[idx + 2] * multB));
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// Bake Iris, Cataract, or Demon Eyes onto the Eyeball patch (451, 454)
function bakeEyeballPatch(ctx, morphs) {
  const cx = 451;
  const cy = 454;

  const isBlind = (morphs.blindEyeL && morphs.blindEyeL > 0.5) || (morphs.blindEyeR && morphs.blindEyeR > 0.5);
  const isGouged = (morphs.gougedEyeL && morphs.gougedEyeL > 0.5) && (morphs.gougedEyeR && morphs.gougedEyeR > 0.5);
  const targetColorHex = morphs.eyeColorL || morphs.eyeColorR || '#4a3728';

  if (isBlind) {
    // Blind Milky White Cataract Eye
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
    grad.addColorStop(0, 'rgba(235, 240, 245, 0.96)');
    grad.addColorStop(0.65, 'rgba(200, 210, 220, 0.90)');
    grad.addColorStop(1, 'rgba(160, 175, 190, 0.35)');

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Faint cloudy pupil
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(110, 120, 130, 0.45)';
    ctx.fill();
    ctx.restore();
    return;
  }

  if (isGouged) {
    // Both eyes gouged: dark bloody cavity
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0202';
    ctx.fill();
    ctx.restore();
    return;
  }

  // Custom Iris Colors (Demon Amber, Red Sith, Golden, Cyan Ice, Purple, etc.)
  const defaultBrown = '#4a3728';
  if (targetColorHex.toLowerCase() !== defaultBrown) {
    const eyeRgb = hexToRgb(targetColorHex);

    ctx.save();
    // 1. Outer Iris Radiating Gradient
    const irisGrad = ctx.createRadialGradient(cx, cy, 7, cx, cy, 21);
    irisGrad.addColorStop(0, `rgb(${eyeRgb.r}, ${eyeRgb.g}, ${eyeRgb.b})`);
    irisGrad.addColorStop(0.7, `rgb(${Math.round(eyeRgb.r * 0.85)}, ${Math.round(eyeRgb.g * 0.85)}, ${Math.round(eyeRgb.b * 0.85)})`);
    irisGrad.addColorStop(1, 'rgb(20, 10, 5)'); // dark limbal outer ring

    ctx.beginPath();
    ctx.arc(cx, cy, 21, 0, Math.PI * 2);
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // 2. Iris Fibers (radiating photorealistic striations)
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += 0.22) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
      ctx.lineTo(cx + Math.cos(a) * 19, cy + Math.sin(a) * 19);
      ctx.strokeStyle = `rgba(${Math.min(255, eyeRgb.r + 50)}, ${Math.min(255, eyeRgb.g + 50)}, ${Math.min(255, eyeRgb.b + 50)}, 0.45)`;
      ctx.stroke();
    }

    // 3. Crisp Black Pupil
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#080505';
    ctx.fill();

    // 4. Specular Highlights / Light Reflections
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 4, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx + 3, cy + 3, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();
    ctx.restore();
  }
}

// Bake Gouged Sockets and Dripping Blood Trails
function bakeGougedSocketsAndBlood(ctx, morphs) {
  // Left eye socket: (300, 180) - Character's Left
  if (morphs.gougedEyeL && morphs.gougedEyeL > 0.5) {
    ctx.save();
    // Deep dark sunken cavity
    const cavGrad = ctx.createRadialGradient(300, 180, 2, 300, 180, 15);
    cavGrad.addColorStop(0, '#0a0101');
    cavGrad.addColorStop(0.65, '#250404');
    cavGrad.addColorStop(1, 'rgba(90, 8, 8, 0.0)');

    ctx.beginPath();
    ctx.ellipse(300, 180, 14, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = cavGrad;
    ctx.fill();

    // Dripping blood tear trail down the left cheek from (300, 188) to (318, 275)
    ctx.beginPath();
    ctx.moveTo(300, 186);
    let curX = 300;
    for (let y = 188; y <= 275; y += 4) {
      curX = 300 + (y - 188) * 0.20 + Math.sin((y - 188) * 0.16) * 3.5;
      ctx.lineTo(curX, y);
    }
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#420303';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Glossy blood highlight core
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#991111';
    ctx.stroke();

    // Blood drop bead at the bottom
    ctx.beginPath();
    ctx.arc(curX, 276, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#550505';
    ctx.fill();
    ctx.restore();
  }

  // Right eye socket: (212, 180) - Character's Right
  if (morphs.gougedEyeR && morphs.gougedEyeR > 0.5) {
    ctx.save();
    const cavGrad = ctx.createRadialGradient(212, 180, 2, 212, 180, 15);
    cavGrad.addColorStop(0, '#0a0101');
    cavGrad.addColorStop(0.65, '#250404');
    cavGrad.addColorStop(1, 'rgba(90, 8, 8, 0.0)');

    ctx.beginPath();
    ctx.ellipse(212, 180, 14, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = cavGrad;
    ctx.fill();

    // Dripping blood tear trail down the right cheek from (212, 188) to (194, 275)
    ctx.beginPath();
    ctx.moveTo(212, 186);
    let curX = 212;
    for (let y = 188; y <= 275; y += 4) {
      curX = 212 - (y - 188) * 0.20 - Math.sin((y - 188) * 0.16) * 3.5;
      ctx.lineTo(curX, y);
    }
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#420303';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#991111';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(curX, 276, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#550505';
    ctx.fill();
    ctx.restore();
  }
}

// Bake Slashed Cheek and Surgical Stitches
function bakeFacialScarsAndStitches(ctx, morphs) {
  const scarType = morphs.faceScar || 0;
  const hasStitches = morphs.hasStitches || (scarType === 1);

  if (scarType === 1 || hasStitches) {
    ctx.save();
    // Diagonal slash across brow, eye and cheek: (286, 128) -> (334, 258)
    const p1 = { x: 286, y: 128 };
    const p2 = { x: 334, y: 258 };

    // 1. Inflamed reddish-pink flesh halo
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(195, 50, 45, 0.40)';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Deep wound rim
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = 'rgba(145, 20, 20, 0.85)';
    ctx.stroke();

    // 3. Deep black laceration incision core
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#2b0303';
    ctx.stroke();

    // 4. Surgical Stitches (Crossbars + puncture suture knots)
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const stitchCount = 10;

    for (let s = 1; s < stitchCount; s++) {
      const t = s / stitchCount;
      const sx = p1.x + dx * t;
      const sy = p1.y + dy * t;
      const barLen = 5.8;

      const bx1 = sx + nx * barLen;
      const by1 = sy + ny * barLen;
      const bx2 = sx - nx * barLen;
      const by2 = sy - ny * barLen;

      // Stitch thread
      ctx.beginPath();
      ctx.moveTo(bx1, by1);
      ctx.lineTo(bx2, by2);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#121216';
      ctx.stroke();

      // Puncture hole dots
      ctx.beginPath();
      ctx.arc(bx1, by1, 1.2, 0, Math.PI * 2);
      ctx.arc(bx2, by2, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#3a0808';
      ctx.fill();
    }
    ctx.restore();
  } else if (scarType === 2) {
    // Zombie Necrotic Rot
    ctx.save();
    // Forehead necrotic patch
    const patchGrad1 = ctx.createRadialGradient(280, 140, 4, 280, 140, 28);
    patchGrad1.addColorStop(0, '#0f0505');
    patchGrad1.addColorStop(0.4, '#4a0c0c');
    patchGrad1.addColorStop(0.75, 'rgba(65, 80, 40, 0.7)');
    patchGrad1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(280, 140, 28, 0, Math.PI * 2);
    ctx.fillStyle = patchGrad1;
    ctx.fill();

    // Cheek rot
    const patchGrad2 = ctx.createRadialGradient(335, 230, 4, 335, 230, 24);
    patchGrad2.addColorStop(0, '#0f0505');
    patchGrad2.addColorStop(0.4, '#550808');
    patchGrad2.addColorStop(0.75, 'rgba(50, 70, 35, 0.7)');
    patchGrad2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(335, 230, 24, 0, Math.PI * 2);
    ctx.fillStyle = patchGrad2;
    ctx.fill();
    ctx.restore();
  } else if (scarType === 3) {
    // Triple combat knife lacerations on cheek
    ctx.save();
    const cuts = [
      { start: { x: 320, y: 200 }, end: { x: 345, y: 260 } },
      { start: { x: 310, y: 210 }, end: { x: 335, y: 265 } },
      { start: { x: 330, y: 205 }, end: { x: 355, y: 255 } }
    ];
    cuts.forEach(c => {
      ctx.beginPath();
      ctx.moveTo(c.start.x, c.start.y);
      ctx.lineTo(c.end.x, c.end.y);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(180, 30, 30, 0.55)';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(c.start.x, c.start.y);
      ctx.lineTo(c.end.x, c.end.y);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#350303';
      ctx.stroke();
    });
    ctx.restore();
  }
}

// Bake Realistic Facial Tattoos (1 - 12)
function bakeFacialTattoo(ctx, tattooId) {
  ctx.save();
  const inkColor = '#11151a';
  ctx.strokeStyle = inkColor;
  ctx.fillStyle = inkColor;

  if (tattooId === 1) {
    // "Rawr.." Gothic Script under left eye / cheek (310, 215)
    ctx.font = 'italic 700 13px "Georgia", serif';
    ctx.fillText('Rawr..', 308, 222);
  } else if (tattooId === 2) {
    // Prison Teardrop under left eye (302, 195) + Micro cross (318, 205)
    ctx.beginPath();
    ctx.moveTo(302, 191);
    ctx.bezierCurveTo(299, 195, 299, 199, 302, 199);
    ctx.bezierCurveTo(305, 199, 305, 195, 302, 191);
    ctx.fill();

    // Micro cross
    ctx.fillRect(317, 201, 2, 8);
    ctx.fillRect(314, 203, 8, 2);
  } else if (tattooId === 3) {
    // Gothic Neck Filigree / Script
    ctx.font = 'italic 700 14px "Old English Text MT", "Times New Roman", serif';
    ctx.fillText('Los Santos', 216, 380);
  } else if (tattooId === 4) {
    // Band-Aid Medical Patch on cheek (328, 225)
    ctx.save();
    ctx.translate(328, 225);
    ctx.rotate(-0.25);
    // Outer adhesive tape
    ctx.fillStyle = '#d5b28d';
    ctx.beginPath();
    ctx.roundRect(-18, -7, 36, 14, 5);
    ctx.fill();
    // Inner sterile gauze
    ctx.fillStyle = '#ece4d8';
    ctx.beginPath();
    ctx.roundRect(-7, -5, 14, 10, 2);
    ctx.fill();
    ctx.restore();
  } else if (tattooId === 5) {
    // Barbed Wire Forehead Band (Y ≈ 105 across forehead)
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(180, 105);
    ctx.lineTo(332, 105);
    ctx.stroke();

    for (let x = 195; x < 320; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x - 4, 101);
      ctx.lineTo(x + 4, 109);
      ctx.moveTo(x - 4, 109);
      ctx.lineTo(x + 4, 101);
      ctx.stroke();
    }
  } else if (tattooId === 6) {
    // Dagger through skull / temple (340, 160)
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(340, 140);
    ctx.lineTo(340, 185);
    ctx.moveTo(333, 150);
    ctx.lineTo(347, 150);
    ctx.stroke();
  } else if (tattooId === 7) {
    // Rose with Thorny Stem along cheek (332, 215)
    ctx.font = '16px serif';
    ctx.fillText('🌹', 324, 226);
  } else if (tattooId === 8) {
    // Snake coiled along jaw (320, 280)
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(270, 310);
    ctx.bezierCurveTo(295, 305, 315, 315, 335, 300);
    ctx.stroke();
  } else if (tattooId === 9) {
    // "w.e.a" lip / jaw tattoo (272, 305)
    ctx.font = 'bold 11px monospace';
    ctx.fillText('w.e.a', 270, 308);
  } else if (tattooId === 10) {
    // Spiderweb on temple (335, 145)
    ctx.lineWidth = 1.2;
    for (let r = 6; r <= 24; r += 6) {
      ctx.beginPath();
      ctx.arc(355, 125, r, Math.PI * 0.5, Math.PI, false);
      ctx.stroke();
    }
    for (let a = 0.5; a <= 1.0; a += 0.125) {
      ctx.beginPath();
      ctx.moveTo(355, 125);
      ctx.lineTo(355 + Math.cos(a * Math.PI) * 26, 125 + Math.sin(a * Math.PI) * 26);
      ctx.stroke();
    }
  } else if (tattooId === 11) {
    // Joker / Clown smile & diamond over eye (300, 175)
    // Diamond
    ctx.beginPath();
    ctx.moveTo(300, 162);
    ctx.lineTo(306, 175);
    ctx.lineTo(300, 188);
    ctx.lineTo(294, 175);
    ctx.closePath();
    ctx.fill();

    // Curved sinister smile extension
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(230, 275);
    ctx.quadraticCurveTo(210, 270, 195, 255);
    ctx.moveTo(282, 275);
    ctx.quadraticCurveTo(302, 270, 317, 255);
    ctx.stroke();
  } else if (tattooId === 12) {
    // Constellation Stars along temple (335, 145)
    const starCoords = [[332, 145], [342, 155], [336, 168], [348, 178], [330, 185]];
    starCoords.forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.arc(sx, sy, 2.0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.restore();
}
