/**
 * Load custom LCPDFR / ZModeler lightbar props from
 * .OBJ / .YDR / .YFT / .Z3D / .ZIP / .RAR for 3D preview.
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { parseYftToThreeScene, parseYdrToThreeScene } from '../../../utils/yftVehicleLoader.js';
import { extractArchiveEntries } from './archiveExtractor.js';
import { parseZ3dToThreeScene } from './z3dLoader.js';

const objLoader = new OBJLoader();

/** In-memory cache so ZIP→scene imports can render without a blob URL */
const lightbarSceneCache = new Map();

export function cacheCustomLightbarScene(cacheId, scene) {
  if (!cacheId || !scene) return;
  lightbarSceneCache.set(cacheId, scene);
}

export function getCachedCustomLightbarScene(cacheId) {
  return cacheId ? lightbarSceneCache.get(cacheId) || null : null;
}

export function clearCachedCustomLightbarScene(cacheId) {
  if (cacheId) lightbarSceneCache.delete(cacheId);
}

function normalizeLightbarScene(rawScene, targetWidth = 1.35) {
  const group = new THREE.Group();
  group.name = 'custom_lcpdfr_lightbar';
  group.add(rawScene);
  group.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetWidth / maxDim;

  rawScene.position.set(-center.x, -box.min.y, -center.z);
  group.scale.setScalar(scale);

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m && m.color) {
            if (m.color.getHex() > 0xe0e0e0) m.color.set('#111827');
            m.metalness = typeof m.metalness === 'number' ? m.metalness : 0.65;
            m.roughness = typeof m.roughness === 'number' ? m.roughness : 0.35;
          }
        });
      }
    }
  });

  return group;
}

async function loadObjText(text) {
  const parsed = objLoader.parse(text);
  return normalizeLightbarScene(parsed);
}

async function loadYftBytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const scene = await parseYftToThreeScene(u8);
  if (!scene) throw new Error('تعذر قراءة ملف الـ YFT للونان');
  return normalizeLightbarScene(scene);
}

async function loadYdrBytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const scene = await parseYdrToThreeScene(u8);
  if (!scene) throw new Error('تعذر قراءة ملف الـ YDR للقطعة / البروب');
  return normalizeLightbarScene(scene);
}

async function loadZ3dBytes(bytes) {
  const scene = parseZ3dToThreeScene(bytes);
  return normalizeLightbarScene(scene);
}

function pickBestArchiveEntry(entries) {
  const scored = entries
    .map((entry) => {
      const name = entry.name || '';
      const lower = name.toLowerCase();
      let score = 0;
      if (/\.obj$/i.test(lower)) score = 100;
      else if (/\.ydr$/i.test(lower)) score = 95;
      else if (/\.yft$/i.test(lower) && !/_hi\.yft$/i.test(lower)) score = 90;
      else if (/\.yft$/i.test(lower)) score = 85;
      else if (/\.z3d$/i.test(lower)) score = 70;
      return { entry, score, lower, name };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}

async function loadFromArchive(fileName, arrayBuffer) {
  const entries = await extractArchiveEntries(fileName, arrayBuffer);
  const names = entries.map((e) => e.name);
  const best = pickBestArchiveEntry(entries);

  if (!best) {
    throw new Error('ما لقينا .OBJ / .YDR / .YFT / .Z3D داخل الأرشيف');
  }

  if (best.lower.endsWith('.obj')) {
    const text = new TextDecoder().decode(best.entry.data);
    return {
      scene: await loadObjText(text),
      format: 'obj',
      sourceName: best.name,
      files: names,
      bestBytes: best.entry.data
    };
  }

  if (best.lower.endsWith('.ydr')) {
    return {
      scene: await loadYdrBytes(best.entry.data),
      format: 'ydr',
      sourceName: best.name,
      files: names,
      ydrBytes: best.entry.data,
      bestBytes: best.entry.data
    };
  }

  if (best.lower.endsWith('.yft')) {
    return {
      scene: await loadYftBytes(best.entry.data),
      format: 'yft',
      sourceName: best.name,
      files: names,
      yftBytes: best.entry.data,
      bestBytes: best.entry.data
    };
  }

  if (best.lower.endsWith('.z3d')) {
    return {
      scene: await loadZ3dBytes(best.entry.data),
      format: 'z3d',
      sourceName: best.name,
      files: names,
      bestBytes: best.entry.data
    };
  }

  throw new Error('تعذر قراءة القطعة من الأرشيف');
}

/**
 * @param {File|Blob} file
 * @returns {Promise<{ objectUrl: string|null, format: string, sourceName: string, scene: THREE.Group|null, yftBytes?: Uint8Array, ydrBytes?: Uint8Array, files?: string[] }>}
 */
export async function loadCustomLightbarFile(file) {
  if (!file) throw new Error('لا يوجد ملف');
  const name = file.name || 'lightbar.bin';
  const lower = name.toLowerCase();

  if (lower.endsWith('.obj')) {
    const text = await file.text();
    const scene = await loadObjText(text);
    const objectUrl = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    return { objectUrl, format: 'obj', sourceName: name, scene, bestBytes: new TextEncoder().encode(text) };
  }

  if (lower.endsWith('.ydr')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const scene = await loadYdrBytes(buf);
    const objectUrl = URL.createObjectURL(file);
    return { objectUrl, format: 'ydr', sourceName: name, scene, ydrBytes: buf, bestBytes: buf };
  }

  if (lower.endsWith('.yft')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const scene = await loadYftBytes(buf);
    const objectUrl = URL.createObjectURL(file);
    return { objectUrl, format: 'yft', sourceName: name, scene, yftBytes: buf, bestBytes: buf };
  }

  if (lower.endsWith('.z3d')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const scene = await loadZ3dBytes(buf);
    const objectUrl = URL.createObjectURL(file);
    return { objectUrl, format: 'z3d', sourceName: name, scene, bestBytes: buf };
  }

  if (lower.endsWith('.zip') || lower.endsWith('.rar')) {
    const ab = await file.arrayBuffer();
    const loaded = await loadFromArchive(name, ab);
    let objectUrl = null;
    if (loaded.bestBytes) {
      const mime = loaded.format === 'obj' ? 'text/plain' : 'application/octet-stream';
      objectUrl = URL.createObjectURL(new Blob([loaded.bestBytes], { type: mime }));
    }
    return {
      objectUrl,
      format: loaded.format,
      sourceName: loaded.sourceName || name,
      scene: loaded.scene,
      yftBytes: loaded.yftBytes,
      ydrBytes: loaded.ydrBytes,
      files: loaded.files,
      bestBytes: loaded.bestBytes
    };
  }

  if (lower.endsWith('.7z')) {
    throw new Error('صيغة 7Z غير مدعومة حالياً — فكها وارفع ZIP أو RAR أو Z3D أو YDR أو OBJ');
  }

  throw new Error('صيغة غير مدعومة. استخدم .ZIP / .RAR / .Z3D / .OBJ / .YDR / .YFT');
}

/**
 * Guess best built-in siren preset from uploaded file name / zip entries.
 */
export function guessSirenTypeFromNames(names = []) {
  const blob = names.join(' ').toLowerCase();
  if (/setina|push.?bar|bull.?bar|ram.?bar|pb.?400|pb400|pb.?9|pb9|bumper.?guard/i.test(blob)) return 'setina_pb400_led';
  if (/visor|stealth|inner.?edge|axix/i.test(blob)) return 'visor_unmarked';
  if (/ion|plate|sound.?off|grille/i.test(blob)) return 'soundoff_ion';
  if (/hide|vertex|headlight|corner/i.test(blob)) return 'hideaway_vertex';
  if (/valor|v.?shape/i.test(blob)) return 'valor_vshape';
  if (/viper|dash/i.test(blob)) return 'viper_s2';
  if (/beacon|l31/i.test(blob)) return 'roof_single_beacon';
  if (/pioneer|nano|tir6|200.?series|lightbar|liberty|federal|whelen|generic/i.test(blob)) {
    return 'lightbar_led';
  }
  return 'custom_obj';
}
