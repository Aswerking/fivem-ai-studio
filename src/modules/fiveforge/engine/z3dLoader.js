/**
 * ZModeler 3 (.z3d / ZM3S) mesh extractor for studio preview.
 * Inflates CZIPStream substream and rebuilds scene::CPolyMesh geometry.
 */

import * as THREE from 'three';
import { inflate } from 'pako';

function asciiAt(u8, offset, len = 4) {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(u8[offset + i] || 0);
  return s;
}

function readI32(u8, offset) {
  return new DataView(u8.buffer, u8.byteOffset + offset, 4).getInt32(0, true);
}

function readU32(u8, offset) {
  return new DataView(u8.buffer, u8.byteOffset + offset, 4).getUint32(0, true);
}

function readU16(u8, offset) {
  return new DataView(u8.buffer, u8.byteOffset + offset, 2).getUint16(0, true);
}

function readF32(u8, offset) {
  return new DataView(u8.buffer, u8.byteOffset + offset, 4).getFloat32(0, true);
}

function readZmString(u8, offset) {
  const len = readI32(u8, offset);
  if (len <= 0) return { value: '', next: offset + 4 };
  let value = '';
  for (let i = 0; i < len; i++) {
    const c = u8[offset + 4 + i];
    if (!c) break;
    value += String.fromCharCode(c);
  }
  return { value, next: offset + 4 + len };
}

function inflateZ3dPayload(u8) {
  const sig = asciiAt(u8, 0, 4);
  if (sig === 'DECL' || sig === 'DATA') return u8;

  if (sig !== 'ZM3S' && sig !== 'ZM2S') {
    throw new Error('ملف Z3D غير معروف (توقيع غير مدعوم)');
  }

  let p = sig === 'ZM3S' ? 12 : 0;
  while (p + 16 <= u8.length) {
    const type = asciiAt(u8, p, 4);
    const size = readU32(u8, p + 12);
    const dataStart = p + 16;
    if (dataStart + size > u8.length) break;

    if (type === 'SBST') {
      let o = dataStart;
      const classInfo = readZmString(u8, o);
      o = classInfo.next + 4; // skip uncompressed length
      const payload = u8.subarray(o, dataStart + size);
      try {
        return inflate(payload);
      } catch {
        throw new Error('فشل فك ضغط بيانات Z3D الداخلية');
      }
    }

    if (type === 'ENDF') break;
    p = dataStart + size;
  }

  throw new Error('لم يتم العثور على شبكة داخل ملف الـ Z3D');
}

function vertsLookValid(data, header, stride, nVerts) {
  const sample = Math.min(nVerts, 24);
  let ok = 0;
  for (let i = 0; i < sample; i++) {
    const o = header + i * stride;
    if (o + 24 > data.length) return false;
    const x = readF32(data, o);
    const y = readF32(data, o + 4);
    const z = readF32(data, o + 8);
    const nx = readF32(data, o + 12);
    const ny = readF32(data, o + 16);
    const nz = readF32(data, o + 20);
    const nl = Math.hypot(nx, ny, nz);
    if (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      Number.isFinite(z) &&
      Math.abs(x) < 200 &&
      Math.abs(y) < 200 &&
      Math.abs(z) < 200 &&
      nl > 0.45 &&
      nl < 1.55
    ) {
      ok += 1;
    }
  }
  return ok >= Math.max(2, Math.floor(sample * 0.75));
}

function parsePolygonIndices(data, start, nPolys, nVerts) {
  let o = start;
  const indices = [];

  for (let i = 0; i < nPolys; i++) {
    if (o + 8 > data.length) return null;
    const magic = readU32(data, o);
    o += 4;
    const n = readU32(data, o);
    o += 4;
    if (n < 3 || n > 16) return null;
    if (o + n * 2 > data.length) return null;

    const ring = [];
    for (let k = 0; k < n; k++) {
      const v = readU16(data, o);
      o += 2;
      if (v >= nVerts) return null;
      ring.push(v);
    }

    for (let k = 1; k < n - 1; k++) {
      indices.push(ring[0], ring[k], ring[k + 1]);
    }

    const leftPolys = nPolys - i - 1;
    if (leftPolys > 0) {
      let next = -1;
      for (let p = o; p + 4 <= data.length && p < o + 64; p++) {
        const word = readU32(data, p);
        if (word === magic || word === 0x01010530) {
          next = p;
          break;
        }
      }
      if (next >= 0) o = next;
      else o += Math.min(20, data.length - o);
    } else {
      o = data.length;
    }
  }

  return indices.length >= 3 ? indices : null;
}

function parsePolyMeshChunk(raw) {
  const data = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  if (data.length < 48) return null;

  let base = 0;
  if (asciiAt(data, 0, 4) === 'DATA') base = 16;

  const nVerts = readU32(data, base + 4);
  const nPolys = readU32(data, base + 12);
  if (nVerts < 3 || nVerts > 800000 || nPolys < 1 || nPolys > 800000) return null;

  const header = base + 32;
  let chosen = null;

  for (let stride = 48; stride <= 168; stride += 4) {
    const polyStart = header + nVerts * stride;
    if (polyStart >= data.length - 8) continue;
    if (!vertsLookValid(data, header, stride, nVerts)) continue;
    const indices = parsePolygonIndices(data, polyStart, nPolys, nVerts);
    if (!indices) continue;
    if (!chosen || indices.length > chosen.indices.length) {
      chosen = { nVerts, nPolys, stride, header, indices };
    }
  }

  if (!chosen) return null;

  const positions = new Float32Array(chosen.nVerts * 3);
  const normals = new Float32Array(chosen.nVerts * 3);
  for (let i = 0; i < chosen.nVerts; i++) {
    const o = chosen.header + i * chosen.stride;
    positions[i * 3] = readF32(data, o);
    positions[i * 3 + 1] = readF32(data, o + 4);
    positions[i * 3 + 2] = readF32(data, o + 8);
    normals[i * 3] = readF32(data, o + 12);
    normals[i * 3 + 1] = readF32(data, o + 16);
    normals[i * 3 + 2] = readF32(data, o + 20);
  }

  return {
    positions,
    normals,
    indices: chosen.indices,
    vertexCount: chosen.nVerts,
    polyCount: chosen.nPolys
  };
}

function collectPolyMeshes(innerU8) {
  const classById = new Map();
  const meshes = [];
  let p = 0;

  while (p + 16 <= innerU8.length) {
    const type = asciiAt(innerU8, p, 4);
    if (!/^[A-Z]{4}$/.test(type)) break;
    const id = readU32(innerU8, p + 4);
    const size = readU32(innerU8, p + 12);
    const dataStart = p + 16;
    if (dataStart + size > innerU8.length) break;

    if (type === 'DECL') {
      const className = readZmString(innerU8, dataStart + 4);
      classById.set(id, className.value);
    } else if (type === 'DATA' && classById.get(id) === 'scene::CPolyMesh') {
      const mesh = parsePolyMeshChunk(innerU8.subarray(dataStart, dataStart + size));
      if (mesh) meshes.push(mesh);
    }

    if (type === 'ENDF') break;
    p = dataStart + size;
  }

  return meshes;
}

/**
 * @param {ArrayBuffer|Uint8Array} bytes
 * @returns {THREE.Group}
 */
export function parseZ3dToThreeScene(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const inflated = inflateZ3dPayload(u8);
  const meshes = collectPolyMeshes(inflated);
  if (!meshes.length) {
    throw new Error('ملف Z3D بدون شبكة قابلة للقراءة — جرّب تصدير OBJ من ZModeler');
  }

  const root = new THREE.Group();
  root.name = 'z3d_import';

  for (let i = 0; i < meshes.length; i++) {
    const meshData = meshes[i];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
    geo.setIndex(meshData.indices);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.7,
      roughness: 0.35,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `z3d_mesh_${i}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  return root;
}

export function isZ3dBytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 4) return false;
  const sig = asciiAt(u8, 0, 4);
  return sig === 'ZM3S' || sig === 'ZM2S';
}
