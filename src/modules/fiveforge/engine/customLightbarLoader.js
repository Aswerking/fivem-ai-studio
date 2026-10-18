/**
 * Load custom LCPDFR lightbar props from .OBJ / .ZIP / .YFT for 3D preview.
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import JSZip from 'jszip';
import { parseYftToThreeScene } from '../../../utils/yftVehicleLoader.js';

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
            // Prefer dark housing + emissive-ready look for emergency props
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

async function loadFromZip(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);

  const objName = names.find((n) => /\.obj$/i.test(n));
  if (objName) {
    const text = await zip.file(objName).async('string');
    return {
      scene: await loadObjText(text),
      format: 'obj',
      sourceName: objName,
      files: names
    };
  }

  const yftName = names.find((n) => /\.yft$/i.test(n) && !/_hi\.yft$/i.test(n))
    || names.find((n) => /\.yft$/i.test(n));
  if (yftName) {
    const buf = await zip.file(yftName).async('uint8array');
    return {
      scene: await loadYftBytes(buf),
      format: 'yft',
      sourceName: yftName,
      files: names,
      yftBytes: buf
    };
  }

  const ydrName = names.find((n) => /\.ydr$/i.test(n));
  if (ydrName) {
    throw new Error('الملف يحتوي .ydr — حوّله لـ .yft/.obj عبر OpenIV أو ارفع الـ OBJ مباشرة');
  }

  throw new Error('لم يتم العثور على .OBJ أو .YFT داخل الـ ZIP. تأكد أن الحزمة من LCPDFR Lightbars.');
}

/**
 * @param {File|Blob} file
 * @returns {Promise<{ objectUrl: string|null, format: string, sourceName: string, scene: THREE.Group|null, yftBytes?: Uint8Array, files?: string[] }>}
 */
export async function loadCustomLightbarFile(file) {
  if (!file) throw new Error('لا يوجد ملف');
  const name = file.name || 'lightbar.bin';
  const lower = name.toLowerCase();

  if (lower.endsWith('.obj')) {
    const text = await file.text();
    const scene = await loadObjText(text);
    const objectUrl = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    return { objectUrl, format: 'obj', sourceName: name, scene };
  }

  if (lower.endsWith('.yft')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const scene = await loadYftBytes(buf);
    const objectUrl = URL.createObjectURL(file);
    return { objectUrl, format: 'yft', sourceName: name, scene, yftBytes: buf };
  }

  if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z')) {
    if (lower.endsWith('.rar') || lower.endsWith('.7z')) {
      throw new Error('ادعم حالياً .ZIP / .OBJ / .YFT — فك ضغط RAR/7Z يدوياً ثم ارفع ZIP أو الملفات مباشرة');
    }
    const ab = await file.arrayBuffer();
    const loaded = await loadFromZip(ab);
    return {
      objectUrl: null,
      format: loaded.format,
      sourceName: loaded.sourceName || name,
      scene: loaded.scene,
      yftBytes: loaded.yftBytes,
      files: loaded.files
    };
  }

  throw new Error('صيغة غير مدعومة. استخدم .ZIP أو .OBJ أو .YFT من LCPDFR');
}

/**
 * Guess best built-in siren preset from uploaded file name / zip entries.
 */
export function guessSirenTypeFromNames(names = []) {
  const blob = names.join(' ').toLowerCase();
  if (/visor|stealth|inner.?edge|axix/i.test(blob)) return 'visor_unmarked';
  if (/ion|plate|sound.?off|grille/i.test(blob)) return 'soundoff_ion';
  if (/hide|vertex|headlight|corner/i.test(blob)) return 'hideaway_vertex';
  if (/valor|v.?shape/i.test(blob)) return 'valor_vshape';
  if (/viper|dash/i.test(blob)) return 'viper_s2';
  if (/beacon|l31/i.test(blob)) return 'roof_single_beacon';
  if (/lightbar|liberty|federal|whelen|generic/i.test(blob)) return 'lightbar_led';
  return 'custom_obj';
}
