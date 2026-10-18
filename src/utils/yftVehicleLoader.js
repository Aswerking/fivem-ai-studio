/**
 * FiveForge Studio — Real GTA V / FiveM RPF7 & RSC7 (.YFT / .YTD) 3D Vehicle Loader
 * Parses native OpenIV / Sollumz RSC7 Fragment (.yft) 3D meshes, skeletons, shaders,
 * and Texture Dictionaries (.ytd) directly into a Three.js Group.
 */

import * as THREE from 'three';
import * as pako from 'pako';
import { decodeDXT1, decodeDXT5, rgbaToDataURL } from './fivemFormatParser.js';

// Decodes DXT3 (BC2) compressed block data to RGBA Uint8ClampedArray
export function decodeDXT3(data, width, height) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  let dataOffset = 0;

  const rgb565 = (val) => [
    Math.round(((val >> 11) & 0x1f) * 255 / 31),
    Math.round(((val >> 5) & 0x3f) * 255 / 63),
    Math.round((val & 0x1f) * 255 / 31)
  ];

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      if (dataOffset + 16 > data.length) break;

      // 8 bytes explicit 4-bit alpha (16 pixels * 4 bits)
      const alphaBytes = data.subarray(dataOffset, dataOffset + 8);
      dataOffset += 8;

      const c0_val = data[dataOffset] | (data[dataOffset + 1] << 8);
      const c1_val = data[dataOffset + 2] | (data[dataOffset + 3] << 8);
      const c0 = rgb565(c0_val);
      const c1 = rgb565(c1_val);

      const colors = [
        c0,
        c1,
        [Math.round((2 * c0[0] + c1[0]) / 3), Math.round((2 * c0[1] + c1[1]) / 3), Math.round((2 * c0[2] + c1[2]) / 3)],
        [Math.round((c0[0] + 2 * c1[0]) / 3), Math.round((c0[1] + 2 * c1[1]) / 3), Math.round((c0[2] + 2 * c1[2]) / 3)]
      ];

      const lookup =
        data[dataOffset + 4] |
        (data[dataOffset + 5] << 8) |
        (data[dataOffset + 6] << 16) |
        (data[dataOffset + 7] << 24);
      dataOffset += 8;

      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const targetX = x + px;
          const targetY = y + py;
          if (targetX < width && targetY < height) {
            const linearIdx = py * 4 + px;
            const aByte = alphaBytes[linearIdx >> 1];
            const aNibble = (linearIdx & 1) === 0 ? aByte & 0x0f : (aByte >> 4) & 0x0f;
            const aVal = aNibble * 17;
            const cIdx = (lookup >> (linearIdx * 2)) & 0x03;
            const col = colors[cIdx];

            const pixelIdx = (targetY * width + targetX) * 4;
            rgba[pixelIdx] = col[0];
            rgba[pixelIdx + 1] = col[1];
            rgba[pixelIdx + 2] = col[2];
            rgba[pixelIdx + 3] = aVal;
          }
        }
      }
    }
  }
  return rgba;
}

/**
 * Computes the exact byte size of an RSC7 System or Graphics segment from its page flags.
 */
export function getRsc7PageSize(flags) {
  const s0 = ((flags >>> 27) & 0x1) << 0;
  const s1 = ((flags >>> 26) & 0x1) << 1;
  const s2 = ((flags >>> 25) & 0x1) << 2;
  const s3 = ((flags >>> 24) & 0x1) << 3;
  const s4 = ((flags >>> 17) & 0x7f) << 4;
  const s5 = ((flags >>> 11) & 0x3f) << 5;
  const s6 = ((flags >>> 7) & 0xf) << 6;
  const s7 = ((flags >>> 5) & 0x3) << 7;
  const s8 = ((flags >>> 4) & 0x1) << 8;
  const baseShift = (flags & 0xf) + 9;
  return (s0 + s1 + s2 + s3 + s4 + s5 + s6 + s7 + s8) << baseShift;
}

/**
 * Recursively extracts an unencrypted OpenIV / GTA V RPF7 archive (dlc.rpf, vehicles.rpf, etc.)
 */
export function parseRpf7Archive(u8, parentPath = '') {
  if (!u8 || u8.byteLength < 16) return [];
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== 0x52504637) return []; // 'RPF7'

  const entryCount = view.getUint32(4, true);
  const entriesOffset = 16;
  const namesOffset = entriesOffset + entryCount * 16;
  const dec = new TextDecoder('utf-8');

  const readName = (noff) => {
    let end = namesOffset + noff;
    while (end < u8.length && u8[end] !== 0) end++;
    return dec.decode(u8.subarray(namesOffset + noff, end));
  };

  const rawEntries = [];
  for (let i = 0; i < entryCount; i++) {
    const off = entriesOffset + i * 16;
    if (off + 16 > u8.length) break;
    const v0 = view.getUint32(off, true);
    const v1 = view.getUint32(off + 4, true);
    const v2 = view.getUint32(off + 8, true);
    const v3 = view.getUint32(off + 12, true);
    if (v1 === 0x7fffff00) {
      rawEntries.push({
        isDir: true,
        name: readName(v0 & 0xffff),
        entriesIndex: v2,
        entriesCount: v3
      });
    } else {
      rawEntries.push({
        isDir: false,
        name: readName(v0 & 0xffff),
        compSize: (v0 >>> 16) | ((v1 & 0xff) << 16),
        byteOffset: ((v1 >>> 8) & 0x7fffff) * 512,
        isResource: ((v1 >>> 31) & 1) === 1,
        v2,
        v3
      });
    }
  }

  const results = [];
  function walk(dirIdx, prefix) {
    const dir = rawEntries[dirIdx];
    if (!dir || !dir.isDir) return;
    for (let i = 0; i < dir.entriesCount; i++) {
      const e = rawEntries[dir.entriesIndex + i];
      if (!e) continue;
      const fullPath = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDir) {
        walk(dir.entriesIndex + i, fullPath);
      } else {
        let data;
        if (e.isResource) {
          let realSize = e.compSize;
          if (realSize === 0xffffff || realSize === 0) {
            realSize = u8.length - e.byteOffset;
          }
          const rawSlice = u8.subarray(e.byteOffset, Math.min(u8.length, e.byteOffset + realSize));
          const rsc7 = new Uint8Array(rawSlice.length);
          rsc7.set(rawSlice);
          rsc7[0] = 0x52; // 'R'
          rsc7[1] = 0x53; // 'S'
          rsc7[2] = 0x43; // 'C'
          rsc7[3] = 0x37; // '7'
          const rView = new DataView(rsc7.buffer);
          const version = (((e.v3 >>> 28) & 0xf) << 4) | ((e.v2 >>> 28) & 0xf);
          rView.setUint32(4, version, true);
          rView.setUint32(8, e.v2, true);
          rView.setUint32(12, e.v3, true);
          data = rsc7;
        } else {
          const isCompressed = e.compSize !== 0;
          const sliceSize = isCompressed ? e.compSize : e.v2;
          const rawSlice = u8.subarray(e.byteOffset, Math.min(u8.length, e.byteOffset + sliceSize));
          if (isCompressed) {
            try {
              data = pako.inflateRaw(rawSlice);
            } catch {
              try {
                data = pako.inflate(rawSlice);
              } catch {
                data = rawSlice;
              }
            }
          } else {
            data = rawSlice;
          }
        }

        if (e.name.toLowerCase().endsWith('.rpf') && data && data.length > 16) {
          results.push(...parseRpf7Archive(data, fullPath));
        } else if (data) {
          results.push({
            path: fullPath,
            name: e.name,
            isResource: e.isResource,
            data,
            v2: e.v2,
            v3: e.v3
          });
        }
      }
    }
  }

  walk(0, parentPath);
  return results;
}

/**
 * Jenkins One-At-A-Time hash (JOAAT) used by GTA V for shader & bone names
 */
export function joaat(str) {
  const s = str.toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h + s.charCodeAt(i)) >>> 0;
    h = (h + (h << 10)) >>> 0;
    h = (h ^ (h >>> 6)) >>> 0;
  }
  h = (h + (h << 3)) >>> 0;
  h = (h ^ (h >>> 11)) >>> 0;
  h = (h + (h << 15)) >>> 0;
  return h >>> 0;
}

const KNOWN_VEHICLE_SHADERS = [
  'vehicle_paint1', 'vehicle_paint1_enveff', 'vehicle_paint2', 'vehicle_paint2_enveff',
  'vehicle_paint3', 'vehicle_paint3_enveff', 'vehicle_paint4', 'vehicle_paint4_enveff',
  'vehicle_paint5_enveff', 'vehicle_paint6', 'vehicle_paint6_enveff', 'vehicle_paint7',
  'vehicle_paint8', 'vehicle_paint9',
  'vehicle_generic_smallspecmap', 'vehicle_generic_tyre', 'vehicle_tire', 'vehicle_tire_emissive',
  'vehicle_rims', 'vehicle_rims2', 'vehicle_mesh', 'vehicle_mesh_enveff',
  'vehicle_lights', 'vehicle_lightsemissive', 'vehicle_lights_emissive',
  'vehicle_vehglass', 'vehicle_vehglass_inner', 'vehicle_vehglass_crack',
  'vehicle_badges', 'vehicle_interior', 'vehicle_interior2',
  'vehicle_dash_emissive', 'vehicle_dash_emissive_opaque', 'vehicle_licenseplate',
  'vehicle_shuts', 'vehicle_detail', 'vehicle_carbon', 'default', 'normal_spec'
];

const SHADER_HASH_MAP = new Map();
for (const name of KNOWN_VEHICLE_SHADERS) {
  SHADER_HASH_MAP.set(joaat(name), name);
  SHADER_HASH_MAP.set(joaat(`${name}.sps`), name);
}

const VERTEX_COMP_SIZES = [0, 2, 4, 6, 4, 8, 12, 16, 4, 4, 4, 4, 8, 8, 4, 8];

function decompressRsc7Buffer(uint8) {
  const isRSC7 = uint8[0] === 0x52 && uint8[1] === 0x53 && uint8[2] === 0x43 && uint8[3] === 0x37;
  const isRSC8 = uint8[0] === 0x52 && uint8[1] === 0x53 && uint8[2] === 0x43 && uint8[3] === 0x38;
  if (!isRSC7 && !isRSC8) return null;

  const hView = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
  const sysFlags = hView.getUint32(8, true);
  const gfxFlags = hView.getUint32(12, true);
  const sysSize = getRsc7PageSize(sysFlags);
  const gfxSize = getRsc7PageSize(gfxFlags);

  let decomp;
  try {
    decomp = pako.inflateRaw(uint8.subarray(16));
  } catch {
    try {
      decomp = pako.inflate(uint8.subarray(16));
    } catch {
      return null;
    }
  }

  return { buf: decomp, sysSize, gfxSize };
}

/**
 * Parses a GTA V RSC7 Texture Dictionary (.ytd) and decodes requested textures into THREE.DataTexture
 */
export function parseYtdTextureDictionary(ytdUint8, neededNames = null) {
  const texMap = new Map();
  const extractedPreviews = [];
  if (!ytdUint8 || ytdUint8.length < 32) return { texMap, extractedPreviews };

  const res = decompressRsc7Buffer(ytdUint8);
  if (!res) return { texMap, extractedPreviews };
  const { buf, sysSize } = res;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dec = new TextDecoder('utf-8');

  const readPtr = (offset) => {
    if (offset < 0 || offset + 8 > buf.length) return null;
    const low = view.getUint32(offset, true);
    const high = view.getUint32(offset + 4, true);
    if (low === 0 && high === 0) return null;
    const seg = (low >>> 28) & 0xf;
    const off = low & 0x0fffffff;
    if (seg === 5 && high === 0) return off;
    if (seg === 6 && high === 0) return sysSize + off;
    return null;
  };

  const readStr = (offset) => {
    if (offset === null || offset < 0 || offset >= buf.length) return null;
    let end = offset;
    while (end < buf.length && buf[end] !== 0 && end - offset < 128) end++;
    return dec.decode(buf.subarray(offset, end));
  };

  const texListPtr = readPtr(0x30);
  const texCount = view.getUint16(0x38, true);
  if (!texListPtr || texCount <= 0 || texCount > 512) return { texMap, extractedPreviews };

  for (let i = 0; i < texCount; i++) {
    const tPtr = readPtr(texListPtr + i * 8);
    if (!tPtr || tPtr + 0x78 > buf.length) continue;

    const rawName = readStr(readPtr(tPtr + 0x28));
    if (!rawName) continue;
    const lowerName = rawName.toLowerCase();

    const width = view.getUint16(tPtr + 0x50, true);
    const height = view.getUint16(tPtr + 0x52, true);
    const fmt = view.getUint32(tPtr + 0x58, true);
    const dataPtr = readPtr(tPtr + 0x70);
    if (!dataPtr || width <= 0 || height <= 0 || dataPtr >= buf.length) continue;

    // Skip normal/specular/dirt maps unless explicitly needed
    if (neededNames && !neededNames.has(lowerName)) continue;
    if (width >= 4096 && /sign|template|livery/i.test(lowerName)) continue;

    const fourCC =
      fmt > 0x00ffffff
        ? String.fromCharCode(fmt & 0xff, (fmt >>> 8) & 0xff, (fmt >>> 16) & 0xff, (fmt >>> 24) & 0xff)
        : '';

    let rgba = null;
    try {
      if (fourCC === 'DXT1') {
        const byteLen = Math.max(8, (width * height) / 2);
        if (dataPtr + byteLen <= buf.length) {
          rgba = decodeDXT1(buf.subarray(dataPtr, dataPtr + byteLen), width, height);
        }
      } else if (fourCC === 'DXT5') {
        const byteLen = Math.max(16, width * height);
        if (dataPtr + byteLen <= buf.length) {
          rgba = decodeDXT5(buf.subarray(dataPtr, dataPtr + byteLen), width, height);
        }
      } else if (fourCC === 'DXT3') {
        const byteLen = Math.max(16, width * height);
        if (dataPtr + byteLen <= buf.length) {
          rgba = decodeDXT3(buf.subarray(dataPtr, dataPtr + byteLen), width, height);
        }
      } else if (fmt === 0x15 || fmt === 0x16) {
        // D3DFMT_A8R8G8B8 / X8R8G8B8 (BGRA -> RGBA)
        const byteLen = width * height * 4;
        if (dataPtr + byteLen <= buf.length) {
          rgba = new Uint8ClampedArray(byteLen);
          for (let p = 0; p < byteLen; p += 4) {
            rgba[p] = buf[dataPtr + p + 2];     // R
            rgba[p + 1] = buf[dataPtr + p + 1]; // G
            rgba[p + 2] = buf[dataPtr + p + 0]; // B
            rgba[p + 3] = fmt === 0x16 ? 255 : buf[dataPtr + p + 3]; // A
          }
        }
      } else if (fmt === 0x1c || fmt === 0x32) {
        // A8 or L8
        const byteLen = width * height;
        if (dataPtr + byteLen <= buf.length) {
          rgba = new Uint8ClampedArray(byteLen * 4);
          for (let p = 0; p < byteLen; p++) {
            const v = buf[dataPtr + p];
            rgba[p * 4] = fmt === 0x1c ? 255 : v;
            rgba[p * 4 + 1] = fmt === 0x1c ? 255 : v;
            rgba[p * 4 + 2] = fmt === 0x1c ? 255 : v;
            rgba[p * 4 + 3] = fmt === 0x1c ? v : 255;
          }
        }
      }
    } catch {
      rgba = null;
    }

    if (rgba) {
      const dataTex = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
      dataTex.colorSpace = THREE.SRGBColorSpace;
      dataTex.wrapS = THREE.RepeatWrapping;
      dataTex.wrapT = THREE.RepeatWrapping;
      dataTex.flipY = false;
      dataTex.needsUpdate = true;
      texMap.set(lowerName, { tex: dataTex, width, height, name: rawName });

      if (extractedPreviews.length < 6 && width >= 128 && height >= 128 && typeof document !== 'undefined') {
        try {
          extractedPreviews.push({
            name: rawName,
            width,
            height,
            dataUrl: rgbaToDataURL(rgba, width, height)
          });
        } catch {}
      }
    }
  }

  return { texMap, extractedPreviews };
}

/**
 * Parses a GTA V RSC7 Fragment (.yft) + optional (.ytd) into a complete Three.js Group
 * with accurate materials, shaders, textures, and 4 positioned wheels.
 */
export function parseYftToThreeScene(yftUint8, ytdUint8 = null) {
  const res = decompressRsc7Buffer(yftUint8);
  if (!res) throw new Error('Invalid or unsupported RSC7 YFT file');
  const { buf, sysSize } = res;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dec = new TextDecoder('utf-8');

  const readPtr = (offset) => {
    if (offset < 0 || offset + 8 > buf.length) return null;
    const low = view.getUint32(offset, true);
    const high = view.getUint32(offset + 4, true);
    if (low === 0 && high === 0) return null;
    const seg = (low >>> 28) & 0xf;
    const off = low & 0x0fffffff;
    if (seg === 5 && high === 0) return off;
    if (seg === 6 && high === 0) return sysSize + off;
    return null;
  };

  const readStr = (offset) => {
    if (offset === null || offset < 0 || offset >= buf.length) return null;
    let end = offset;
    while (end < buf.length && buf[end] !== 0 && end - offset < 128) end++;
    return dec.decode(buf.subarray(offset, end));
  };

  const primaryDrawablePtr = readPtr(0x30);
  if (!primaryDrawablePtr) throw new Error('No PrimaryDrawable found in YFT');

  // 1. Parse ShaderGroup
  const sgPtr = readPtr(primaryDrawablePtr + 0x10);
  const shadersArrPtr = sgPtr ? readPtr(sgPtr + 0x10) : null;
  const shaderCount = sgPtr ? view.getUint16(sgPtr + 0x18, true) : 0;

  const shaders = [];
  const neededTexNames = new Set();

  for (let s = 0; s < shaderCount; s++) {
    const sPtr = readPtr(shadersArrPtr + s * 8);
    if (!sPtr) {
      shaders.push({ name: 'default', bucket: 0, texNames: [] });
      continue;
    }
    const paramsPtr = readPtr(sPtr + 0x00);
    const nameHash = view.getUint32(sPtr + 0x08, true);
    const pCount = view.getUint8(sPtr + 0x10);
    const bucket = view.getUint8(sPtr + 0x11);
    const fileHash = view.getUint32(sPtr + 0x18, true);
    const shaderName = SHADER_HASH_MAP.get(nameHash) || SHADER_HASH_MAP.get(fileHash) || 'vehicle_mesh';

    const texNames = [];
    if (paramsPtr) {
      for (let p = 0; p < pCount; p++) {
        const pOff = paramsPtr + p * 16;
        if (pOff + 16 > buf.length) break;
        const dataType = view.getUint8(pOff + 0);
        const dataPtr = readPtr(pOff + 8);
        if (dataType === 0 && dataPtr) {
          const tName = readStr(readPtr(dataPtr + 0x28));
          if (tName) texNames.push(tName.toLowerCase());
        }
      }
    }
    if (texNames[0] && !/vehicle_generic_smallspecmap|blank_normal|vehdirt|wheel_dirt/i.test(texNames[0])) {
      neededTexNames.add(texNames[0]);
    }
    shaders.push({ name: shaderName, bucket, texNames });
  }

  // 2. Decode YTD Textures for the needed diffuse textures
  const { texMap } = ytdUint8 ? parseYtdTextureDictionary(ytdUint8, neededTexNames) : { texMap: new Map() };

  // 3. Parse Skeleton Bones (for wheel positions)
  const skelPtr = readPtr(primaryDrawablePtr + 0x18);
  const bonesPtr = skelPtr ? readPtr(skelPtr + 0x20) : null;
  const boneCount = skelPtr ? view.getUint16(skelPtr + 0x1a, true) : 0;
  const bones = [];
  const boneByName = new Map();

  for (let b = 0; b < boneCount; b++) {
    const bOff = bonesPtr + b * 0x50;
    if (bOff + 0x50 > buf.length) break;
    const lx = view.getFloat32(bOff + 0x10, true);
    const ly = view.getFloat32(bOff + 0x14, true);
    const lz = view.getFloat32(bOff + 0x18, true);
    const parentIdx = view.getInt16(bOff + 0x32, true);
    const name = (readStr(readPtr(bOff + 0x38)) || `bone_${b}`).toLowerCase();

    let wx = lx, wy = ly, wz = lz;
    if (parentIdx >= 0 && parentIdx < bones.length) {
      wx += bones[parentIdx].wx;
      wy += bones[parentIdx].wy;
      wz += bones[parentIdx].wz;
    }
    const boneObj = { index: b, name, parentIdx, wx, wy, wz };
    bones.push(boneObj);
    boneByName.set(name, boneObj);
  }

  // Build Three.js Material for a given shader index & geometry metadata
  // Build Three.js Material for a given shader index & geometry metadata
  const buildMaterialForGeometry = (shaderIdx, isWheelGeom = false, geomRadius = 1.0, geomIdx = 0) => {
    const sh = shaders[shaderIdx] || { name: 'vehicle_mesh', bucket: 0, texNames: [] };
    const sName = sh.name.toLowerCase();
    const primaryTexName = sh.texNames[0] || '';
    const allTexJoined = sh.texNames.join(' ');
    const ytdEntry = primaryTexName ? texMap.get(primaryTexName) : null;
    const diffTex = ytdEntry?.tex || null;

    // 1. Primary Body Paint (vehicle_paint1/2/3/4/6)
    if (sName.startsWith('vehicle_paint')) {
      return new THREE.MeshStandardMaterial({
        name: 'Body_Color',
        color: new THREE.Color('#c81414'),
        metalness: 0.82,
        roughness: 0.18,
        side: THREE.DoubleSide
      });
    }

    // 2. Vehicle Glass / Windows / Headlight Lenses
    if (sName.includes('vehglass')) {
      if (diffTex && /lights/i.test(primaryTexName)) {
        return new THREE.MeshStandardMaterial({
          name: 'Glass_Headlight_Lens',
          map: diffTex,
          color: new THREE.Color('#ffffff'),
          transparent: true,
          opacity: 0.72,
          metalness: 0.85,
          roughness: 0.08,
          depthWrite: false,
          side: THREE.DoubleSide
        });
      }
      return new THREE.MeshStandardMaterial({
        name: 'Glass_Windshield',
        color: new THREE.Color('#0f172a'),
        transparent: true,
        opacity: 0.36,
        metalness: 0.92,
        roughness: 0.05,
        depthWrite: false,
        side: THREE.DoubleSide
      });
    }

    // 3. Vehicle Badges / Emblems / Hood Grille Decals
    if (
      sName === 'vehicle_badges' ||
      /badge|logo|emblem|pininfarina|barch|mercedes|benz_star|amg_badge|crest/i.test(`${sName} ${primaryTexName}`)
    ) {
      const isGrille = /grill/i.test(primaryTexName);
      return new THREE.MeshStandardMaterial({
        name: isGrille ? 'Grille_Mesh' : 'Vehicle_Badge_Logo',
        map: diffTex || null,
        color: new THREE.Color(diffTex ? '#ffffff' : '#fbbf24'),
        transparent: true,
        alphaTest: 0.06,
        metalness: isGrille ? 0.3 : 0.65,
        roughness: isGrille ? 0.5 : 0.22,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        side: THREE.DoubleSide
      });
    }

    // 4. Tires & Alloy Rims
    if (sName.includes('tire') || sName.includes('tyre') || sName.includes('rim') || isWheelGeom) {
      // Center cap with badge/interior texture (Ferrari, BMW, Benz, etc. wheel roundel)
      if (geomRadius < 0.055 && diffTex) {
        return new THREE.MeshStandardMaterial({
          name: 'Wheel_Center_Cap_Badge',
          map: diffTex,
          color: new THREE.Color('#ffffff'),
          metalness: 0.5,
          roughness: 0.25,
          side: THREE.DoubleSide
        });
      }
      // Rubber Tire tread/sidewall
      if (/tire|tyre/i.test(primaryTexName)) {
        return new THREE.MeshStandardMaterial({
          name: 'Tires',
          map: diffTex || null,
          color: new THREE.Color(diffTex ? '#222226' : '#141417'),
          metalness: 0.08,
          roughness: 0.86,
          side: THREE.DoubleSide
        });
      }
      // Alloy Wheel Rim Spokes & Lip
      return new THREE.MeshStandardMaterial({
        name: 'Mt_AlloyWheels',
        color: new THREE.Color('#dce1e8'),
        metalness: 0.88,
        roughness: 0.16,
        side: THREE.DoubleSide
      });
    }

    // 5. Headlights & Taillights Emissive
    if (sName.includes('lights') || sName.includes('dash_emissive') || /lights|gauges/i.test(primaryTexName)) {
      return new THREE.MeshStandardMaterial({
        name: 'Vehicle_Lights',
        map: diffTex || null,
        color: new THREE.Color('#ffffff'),
        metalness: 0.4,
        roughness: 0.2,
        side: THREE.DoubleSide
      });
    }

    // 6. Chrome Trim / Exhaust / Mirrors
    if (/chrome/i.test(allTexJoined)) {
      return new THREE.MeshStandardMaterial({
        name: 'Chrome_Trim',
        color: new THREE.Color('#e2e8f0'),
        metalness: 0.94,
        roughness: 0.08,
        side: THREE.DoubleSide
      });
    }

    // 7. Interior / Mesh / Plastic / Leather / Carbon with YTD Texture or Fallback
    if (diffTex) {
      return new THREE.MeshStandardMaterial({
        name: `YFT_Mesh_${primaryTexName}`,
        map: diffTex,
        color: new THREE.Color('#ffffff'),
        metalness: /metal|carbon/i.test(primaryTexName) ? 0.55 : 0.15,
        roughness: /leather|carpet|plastic/i.test(primaryTexName) ? 0.68 : 0.42,
        side: THREE.DoubleSide
      });
    }

    const isLeatherOrCarpet = /leather|carpet|interior/i.test(allTexJoined);
    return new THREE.MeshStandardMaterial({
      name: isLeatherOrCarpet ? 'Interior_Leather' : 'Trim_Black',
      color: new THREE.Color(isLeatherOrCarpet ? '#1c1c22' : '#141418'),
      metalness: 0.18,
      roughness: isLeatherOrCarpet ? 0.62 : 0.48,
      side: THREE.DoubleSide
    });
  };

  // Helper to decode a DrawableModel (GEOM) at `modelPtr` into an array of Three.js Meshes
  const decodeDrawableModel = (modelPtr, isWheelModel = false, mirrorX = false) => {
    const meshes = [];
    if (!modelPtr || view.getUint32(modelPtr, true) !== 0x4d4f4547) return meshes; // 'GEOM'

    const geomsArrPtr = readPtr(modelPtr + 0x08);
    const geomCount = view.getUint16(modelPtr + 0x10, true);
    const shaderMapPtr = readPtr(modelPtr + 0x20);
    if (!geomsArrPtr || !shaderMapPtr || geomCount <= 0 || geomCount > 256) return meshes;

    for (let g = 0; g < geomCount; g++) {
      const geomPtr = readPtr(geomsArrPtr + g * 8);
      if (!geomPtr) continue;
      const shaderIdx = view.getUint16(shaderMapPtr + g * 2, true);
      const vbPtr = readPtr(geomPtr + 0x18);
      const ibPtr = readPtr(geomPtr + 0x38);
      if (!vbPtr || !ibPtr) continue;

      const stride = view.getUint16(vbPtr + 0x08, true);
      const vCount = view.getUint32(vbPtr + 0x18, true);
      const vDataPtr = readPtr(vbPtr + 0x10) || readPtr(vbPtr + 0x20);
      const vdPtr = readPtr(vbPtr + 0x30);

      const iCount = view.getUint32(ibPtr + 0x08, true);
      const iDataPtr = readPtr(ibPtr + 0x10);
      if (!vDataPtr || !iDataPtr || !vdPtr || vCount <= 0 || iCount <= 0) continue;
      if (vDataPtr + vCount * stride > buf.length || iDataPtr + iCount * 2 > buf.length) continue;

      const vdFlags = view.getUint32(vdPtr, true);
      const vdTypes = view.getBigUint64(vdPtr + 0x08, true);

      // Compute byte offsets for Position (0), Normal (3), and TexCoord0 (6)
      let normalOffset = -1;
      let normalType = 0;
      let uvOffset = -1;
      let uvType = 0;
      let runningOffset = 0;

      for (let sem = 0; sem < 16; sem++) {
        if ((vdFlags & (1 << sem)) !== 0) {
          const tNibble = Number((vdTypes >> BigInt(sem * 4)) & 0xfn);
          if (sem === 3) {
            normalOffset = runningOffset;
            normalType = tNibble;
          } else if (sem === 6) {
            uvOffset = runningOffset;
            uvType = tNibble;
          }
          runningOffset += VERTEX_COMP_SIZES[tNibble] || 0;
        }
      }

      const positions = new Float32Array(vCount * 3);
      const normals = new Float32Array(vCount * 3);
      const uvs = new Float32Array(vCount * 2);
      const xSign = mirrorX ? -1 : 1;
      let maxRadius = 0;
      let minGx = Infinity;
      let maxGx = -Infinity;
      let minGy = Infinity;
      let maxGy = -Infinity;
      let minGz = Infinity;
      let maxGz = -Infinity;

      for (let v = 0; v < vCount; v++) {
        const vOff = vDataPtr + v * stride;
        const gx = view.getFloat32(vOff, true) * xSign;
        const gy = view.getFloat32(vOff + 4, true);
        const gz = view.getFloat32(vOff + 8, true);
        if (gx < minGx) minGx = gx;
        if (gx > maxGx) maxGx = gx;
        if (gy < minGy) minGy = gy;
        if (gy > maxGy) maxGy = gy;
        if (gz < minGz) minGz = gz;
        if (gz > maxGz) maxGz = gz;

        // Convert GTA V Z-up (X=right, Y=forward, Z=up) -> Three.js Y-up (X=right, Y=up, -Z=forward)
        positions[v * 3 + 0] = gx;
        positions[v * 3 + 1] = gz;
        positions[v * 3 + 2] = -gy;

        if (isWheelModel) {
          const r = Math.hypot(gy, gz);
          if (r > maxRadius) maxRadius = r;
        }

        if (normalOffset >= 0 && normalType === 6 && vOff + normalOffset + 12 <= buf.length) {
          const nx = view.getFloat32(vOff + normalOffset, true) * xSign;
          const ny = view.getFloat32(vOff + normalOffset + 4, true);
          const nz = view.getFloat32(vOff + normalOffset + 8, true);
          normals[v * 3 + 0] = nx;
          normals[v * 3 + 1] = nz;
          normals[v * 3 + 2] = -ny;
        } else {
          normals[v * 3 + 1] = 1;
        }

        if (uvOffset >= 0 && uvType === 5 && vOff + uvOffset + 8 <= buf.length) {
          uvs[v * 2 + 0] = view.getFloat32(vOff + uvOffset, true);
          uvs[v * 2 + 1] = view.getFloat32(vOff + uvOffset + 4, true);
        }
      }

      // Separate mixed geometries: isolate front/rear chrome emblems and front nose decal into dedicated badge meshes
      const sh = shaders[shaderIdx] || { name: 'vehicle_mesh', bucket: 0, texNames: [] };
      const allTexJoined = sh.texNames.join(' ');
      const isChromeGeom = /chrome/i.test(allTexJoined);
      const isFrontNoseDecalGeom = g === 31;

      if (!isWheelModel && (isChromeGeom || isFrontNoseDecalGeom)) {
        const emblemIndicesArr = [];
        const bodyIndicesArr = [];

        for (let idx = 0; idx < iCount; idx += 3) {
          const i0 = view.getUint16(iDataPtr + idx * 2, true);
          const i1 = view.getUint16(iDataPtr + (idx + 1) * 2, true);
          const i2 = view.getUint16(iDataPtr + (idx + 2) * 2, true);

          const vOff0 = vDataPtr + i0 * stride;
          const vOff1 = vDataPtr + i1 * stride;
          const vOff2 = vDataPtr + i2 * stride;
          const gx = (view.getFloat32(vOff0, true) + view.getFloat32(vOff1, true) + view.getFloat32(vOff2, true)) / 3;
          const gy = (view.getFloat32(vOff0 + 4, true) + view.getFloat32(vOff1 + 4, true) + view.getFloat32(vOff2 + 4, true)) / 3;
          const gz = (view.getFloat32(vOff0 + 8, true) + view.getFloat32(vOff1 + 8, true) + view.getFloat32(vOff2 + 8, true)) / 3;

          const gySpan = Math.max(0.25, maxGy - minGy);
          const gxSpan = Math.max(0.2, maxGx - minGx);
          const frontCut = maxGy - gySpan * 0.14;
          const rearCut = minGy + gySpan * 0.16;
          const noseHalf = Math.min(0.34, gxSpan * 0.42);
          const trunkHalf = Math.min(0.7, gxSpan * 0.55);

          let isEmblem = false;
          if (isFrontNoseDecalGeom) {
            isEmblem = gy > frontCut && Math.abs(gx) < Math.min(0.08, noseHalf) && gz > minGz + 0.04;
          } else if (isChromeGeom) {
            // Relative to this geom, so AMG / Mercedes stars are not missed on longer cars
            isEmblem =
              (gy > frontCut && Math.abs(gx) < noseHalf && gz > minGz + (maxGz - minGz) * 0.18) ||
              (gy < rearCut && Math.abs(gx) < trunkHalf && gz > minGz + (maxGz - minGz) * 0.22);
          }

          if (isEmblem) {
            emblemIndicesArr.push(i0, mirrorX ? i2 : i1, mirrorX ? i1 : i2);
          } else {
            bodyIndicesArr.push(i0, mirrorX ? i2 : i1, mirrorX ? i1 : i2);
          }
        }

        if (emblemIndicesArr.length > 0 && bodyIndicesArr.length > 0) {
          // 1. Create Body Trim Mesh
          const bGeomBody = new THREE.BufferGeometry();
          bGeomBody.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          bGeomBody.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
          bGeomBody.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
          bGeomBody.setIndex(new THREE.BufferAttribute(new Uint16Array(bodyIndicesArr), 1));
          if (normalOffset < 0 || normalType !== 6) bGeomBody.computeVertexNormals();

          const bodyMat = buildMaterialForGeometry(shaderIdx, isWheelModel, maxRadius, g);
          const meshBody = new THREE.Mesh(bGeomBody, bodyMat);
          meshBody.name = `${bodyMat.name}_geom_${g}`;
          meshBody.castShadow = true;
          meshBody.receiveShadow = true;
          meshes.push(meshBody);

          // 2. Create Emblem Mesh
          const bGeomEmblem = new THREE.BufferGeometry();
          bGeomEmblem.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          bGeomEmblem.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
          bGeomEmblem.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
          bGeomEmblem.setIndex(new THREE.BufferAttribute(new Uint16Array(emblemIndicesArr), 1));
          if (normalOffset < 0 || normalType !== 6) bGeomEmblem.computeVertexNormals();

          const emblemMat = isChromeGeom
            ? new THREE.MeshStandardMaterial({
                name: 'Vehicle_Badge_Chrome',
                color: new THREE.Color('#e2e8f0'),
                metalness: 0.94,
                roughness: 0.08,
                side: THREE.DoubleSide
              })
            : new THREE.MeshStandardMaterial({
                name: 'Vehicle_Badge_Logo',
                color: new THREE.Color('#fbbf24'),
                transparent: true,
                metalness: 0.65,
                roughness: 0.22,
                side: THREE.DoubleSide
              });
          const meshEmblem = new THREE.Mesh(bGeomEmblem, emblemMat);
          meshEmblem.name = `${emblemMat.name}_geom_${g}`;
          meshEmblem.castShadow = true;
          meshEmblem.receiveShadow = true;
          meshes.push(meshEmblem);
          continue;
        }
      }

      const indices = new Uint16Array(iCount);
      for (let idx = 0; idx < iCount; idx += 3) {
        const i0 = view.getUint16(iDataPtr + idx * 2, true);
        const i1 = view.getUint16(iDataPtr + (idx + 1) * 2, true);
        const i2 = view.getUint16(iDataPtr + (idx + 2) * 2, true);
        indices[idx] = i0;
        indices[idx + 1] = mirrorX ? i2 : i1;
        indices[idx + 2] = mirrorX ? i1 : i2;
      }

      const bGeom = new THREE.BufferGeometry();
      bGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      bGeom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      bGeom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      bGeom.setIndex(new THREE.BufferAttribute(indices, 1));
      if (normalOffset < 0 || normalType !== 6) {
        bGeom.computeVertexNormals();
      }

      const mat = buildMaterialForGeometry(shaderIdx, isWheelModel, maxRadius, g);
      const gxSpan = maxGx - minGx;
      const gySpan = maxGy - minGy;
      const gzSpan = maxGz - minGz;
      const maxDim = Math.max(gxSpan, gySpan, gzSpan);
      const midX = (minGx + maxGx) / 2;
      // Standalone Mercedes / AMG / GT crest that never got split out of a bigger chrome mesh
      const isStandaloneEmblem =
        !isWheelModel &&
        (isChromeGeom || isFrontNoseDecalGeom || /badge|logo|emblem/i.test(allTexJoined)) &&
        maxDim > 0.01 &&
        maxDim < 0.62 &&
        Math.abs(midX) < 0.62 &&
        gzSpan < 0.28;
      if (isStandaloneEmblem) {
        mat.name = isChromeGeom ? 'Vehicle_Badge_Chrome' : 'Vehicle_Badge_Logo';
      }
      const mesh = new THREE.Mesh(bGeom, mat);
      mesh.name = `${mat.name}_geom_${g}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      meshes.push(mesh);
    }

    return meshes;
  };

  const rootGroup = new THREE.Group();
  rootGroup.name = 'yft_vehicle_root';

  // 4. Decode Primary Drawable High-Detail Body Model
  const modelsHighListPtr = readPtr(primaryDrawablePtr + 0x50);
  const modelsArrPtr = modelsHighListPtr ? readPtr(modelsHighListPtr) : null;
  const primaryModelPtr = modelsArrPtr ? readPtr(modelsArrPtr) : null;
  const bodyMeshes = decodeDrawableModel(primaryModelPtr, false, false);
  bodyMeshes.forEach((m) => rootGroup.add(m));

  // 5. Find Child Wheel DrawableModels ('GEOM' blocks in the YFT buffer other than primaryModelPtr)
  const wheelModelPtrs = [];
  for (let off = 0; off < buf.length - 32; off += 16) {
    if (view.getUint32(off, true) === 0x4d4f4547 && off !== primaryModelPtr) {
      const gCnt = view.getUint16(off + 0x10, true);
      const sMap = readPtr(off + 0x20);
      if (gCnt > 0 && gCnt <= 32 && sMap) {
        wheelModelPtrs.push(off);
      }
    }
  }

  if (wheelModelPtrs.length > 0) {
    const frontWheelModelPtr = wheelModelPtrs[0];
    const rearWheelModelPtr = wheelModelPtrs.length > 1 ? wheelModelPtrs[1] : wheelModelPtrs[0];

    const wheelPlacements = [
      { bone: boneByName.get('wheel_lf'), modelPtr: frontWheelModelPtr, mirrorX: false, fallback: [-0.85, 1.25, -0.22] },
      { bone: boneByName.get('wheel_rf'), modelPtr: frontWheelModelPtr, mirrorX: true,  fallback: [0.85, 1.25, -0.22] },
      { bone: boneByName.get('wheel_lr'), modelPtr: rearWheelModelPtr,  mirrorX: false, fallback: [-0.85, -1.28, -0.22] },
      { bone: boneByName.get('wheel_rr'), modelPtr: rearWheelModelPtr,  mirrorX: true,  fallback: [0.85, -1.28, -0.22] }
    ];

    for (const wp of wheelPlacements) {
      const wGroup = new THREE.Group();
      const wx = wp.bone ? wp.bone.wx : wp.fallback[0];
      const wy = wp.bone ? wp.bone.wy : wp.fallback[1];
      const wz = wp.bone ? wp.bone.wz : wp.fallback[2];
      // Convert GTA (wx, wy, wz) -> Three.js (wx, wz, -wy)
      wGroup.position.set(wx, wz, -wy);
      const wMeshes = decodeDrawableModel(wp.modelPtr, true, wp.mirrorX);
      wMeshes.forEach((m) => wGroup.add(m));
      rootGroup.add(wGroup);
    }
  }

  return rootGroup;
}
