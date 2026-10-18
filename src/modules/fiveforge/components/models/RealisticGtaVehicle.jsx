import React, { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { parseYftToThreeScene } from '../../../../utils/yftVehicleLoader.js';
import { getCachedCustomLightbarScene } from '../../engine/customLightbarLoader.js';

// ============================================================================
// 6 REAL HIGH-POLY 3D VEHICLE GLB MODELS (CACHED IN MEMORY)
// ============================================================================
export const VEHICLE_GLB_MAP = {
  hypercar: '/models/raw_aventador.glb',     // Lamborghini Aventador V12 Hypercar
  supercar: '/models/gta_sports_car.glb',    // Ferrari 458 Spider Supercar
  jdm: '/models/raw_tuner_coupe.glb',        // BMW E30 M3 JDM / Euro Tuner Coupe
  sports: '/models/raw_bmw_m4.glb',          // BMW M4 Competition G82 Coupe
  muscle: '/models/raw_bmw_m4.glb',          // Widebody Coupe / Muscle
  sedan: '/models/raw_4door_sedan.glb',      // 2023 4-Door Executive Sedan
  police: '/models/raw_4door_sedan.glb',     // 4-Door Police Cruiser Interceptor
  suv: '/models/raw_g63_suv.glb',            // Mercedes-AMG G63 4x4 SUV
  armored: '/models/raw_g63_suv.glb'         // Armored Tactical SUV / Kuruma
};

const gltfCache = new Map();
const gltfPromises = new Map();

const sharedGltfLoader = new GLTFLoader();
sharedGltfLoader.setMeshoptDecoder(MeshoptDecoder);
const sharedObjLoader = new OBJLoader();
const sharedTextureLoader = new THREE.TextureLoader();

function cloneSceneWithMaterials(sourceScene) {
  const cloned = SkeletonUtils.clone(sourceScene);
  cloned.traverse((child) => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material = child.material.map((m) => m.clone());
      } else {
        child.material = child.material.clone();
      }
    }
  });
  return cloned;
}

/**
 * Normalizes any 3D vehicle scene so that:
 * 1. Ground/shadow backdrop planes are stripped.
 * 2. Vehicle longitudinal axis aligns along Z.
 * 3. Total vehicle length is exactly `targetLength` (default 2.65 units).
 * 4. Vehicle is horizontally centered at (X=0, Z=0) and tires sit at Y=0.
 */
function normalizeVehicleScene(rawScene, targetLength = 2.65, modelUrl = '') {
  // 1. Hide any studio floor / shadow plane meshes so bounding box is strictly the car
  rawScene.traverse((child) => {
    if (child.isMesh) {
      const n = `${child.name || ''} ${child.parent?.name || ''} ${child.material?.name || ''}`;
      if (/shadow_plane|shadowplane|ground_plane|studio_floor|backdrop/i.test(n)) {
        child.visible = false;
      } else {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            m.envMapIntensity = 1.6;
          });
        }
      }
    }
  });

  const rotGroup = new THREE.Group();
  rotGroup.add(rawScene);
  rotGroup.updateMatrixWorld(true);

  // Measure initial bounding box excluding hidden shadow planes
  const computeVisibleBox = (root) => {
    const box = new THREE.Box3();
    root.traverse((c) => {
      if (c.isMesh && c.visible && c.geometry) {
        c.geometry.computeBoundingBox();
        if (c.geometry.boundingBox) {
          const b = c.geometry.boundingBox.clone();
          b.applyMatrix4(c.matrixWorld);
          box.union(b);
        }
      }
    });
    if (box.isEmpty()) box.setFromObject(root);
    return box;
  };

  let box = computeVisibleBox(rotGroup);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);

  // 2. Align longitudinal axis along Z and ensure front bumper faces -Z (towards camera)
  if (size.x > size.z * 1.15) {
    rotGroup.rotation.y = -Math.PI / 2;
    rotGroup.updateMatrixWorld(true);
    box = computeVisibleBox(rotGroup);
    box.getSize(size);
  } else if (/raw_4door_sedan|raw_tuner_coupe|raw_g63_suv|raw_bmw_m4/i.test(modelUrl)) {
    rotGroup.rotation.y = Math.PI;
    rotGroup.updateMatrixWorld(true);
    box = computeVisibleBox(rotGroup);
    box.getSize(size);
  }

  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scaleFactor = targetLength / maxDim;

  const wrapper = new THREE.Group();
  wrapper.name = 'normalized_vehicle_root';
  wrapper.add(rotGroup);
  wrapper.scale.setScalar(scaleFactor);
  wrapper.position.set(
    -center.x * scaleFactor,
    -box.min.y * scaleFactor,
    -center.z * scaleFactor
  );

  wrapper.updateMatrixWorld(true);

  const dims = {
    width: size.x * scaleFactor,
    height: size.y * scaleFactor,
    length: size.z * scaleFactor
  };

  // 3. Compute exact 3D surface anchors (Hood, Grille, Trunk, Doors, Roof, Windshield Visor) via Raycasting
  const anchors = computeVehicleSurfaceAnchors(wrapper, dims, modelUrl);

  return {
    scene: wrapper,
    dimensions: dims,
    anchors
  };
}

/**
 * Uses THREE.Raycaster against the normalized vehicle meshes to find millimeter-accurate
 * surface positions and normals for front hood emblem, front grille emblem, rear trunk emblem,
 * left/right door decals, roof lightbar, and interior windshield visor strobes.
 */
function computeVehicleSurfaceAnchors(wrapper, dims, modelUrl = '') {
  const raycaster = new THREE.Raycaster();
  const bodyMeshes = [];
  const allVisibleMeshes = [];
  const frontBadgeVerts = [];
  const rearBadgeVerts = [];
  const tempVec = new THREE.Vector3();

  wrapper.traverse((c) => {
    if (c.isMesh && c.visible && c.geometry) {
      allVisibleMeshes.push(c);
      const matNames = (Array.isArray(c.material) ? c.material : [c.material])
        .map((m) => m?.name || '')
        .join(' ');
      const fullName = `${c.name || ''} ${matNames}`;
      if (!/glass|window|windscreen|lens|headlight|light|tire|tyre|rim|wheel|caliper|logo|badge|emblem/i.test(fullName)) {
        bodyMeshes.push(c);
      }

      // Extract centerline factory badge vertices (|x| < 0.12) near the front nose and rear trunk
      if (/badge|emblem|logo|BMW_E30_M3_EMBLEMS|Mt_Logos|Mesheslogo11Mtl|Benz_Logo/i.test(fullName)) {
        const posAttr = c.geometry.attributes?.position;
        if (posAttr) {
          for (let i = 0; i < posAttr.count; i++) {
            tempVec.fromBufferAttribute(posAttr, i).applyMatrix4(c.matrixWorld);
            if (Math.abs(tempVec.x) < 0.12 && tempVec.y > dims.height * 0.22) {
              if (tempVec.z < -dims.length * 0.42) {
                frontBadgeVerts.push(tempVec.clone());
              } else if (tempVec.z > dims.length * 0.42) {
                rearBadgeVerts.push(tempVec.clone());
              }
            }
          }
        }
      }
    }
  });

  const averagePoints = (pts) => {
    if (!pts.length) return null;
    const sum = new THREE.Vector3();
    pts.forEach((p) => sum.add(p));
    return sum.divideScalar(pts.length);
  };

  const factoryFrontCenter = averagePoints(frontBadgeVerts);
  const factoryRearCenter = averagePoints(rearBadgeVerts);

  const targetMeshes = bodyMeshes.length > 0 ? bodyMeshes : allVisibleMeshes;

  const castSurface = (originArr, dirArr, meshes = targetMeshes) => {
    const origin = new THREE.Vector3(...originArr);
    const dir = new THREE.Vector3(...dirArr).normalize();
    raycaster.set(origin, dir);
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      const hit = hits[0];
      const worldNormal = dir.clone().negate();
      if (hit.face) {
        const nm = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
        worldNormal.copy(hit.face.normal).applyMatrix3(nm).normalize();
        if (worldNormal.dot(dir) > 0) worldNormal.negate();
      }
      return { point: hit.point.clone(), normal: worldNormal };
    }
    return null;
  };

  // A. Roof Top — ONLY hit hard body panels high up (never seats / cabin floor / interior)
  // Convertibles (Barchetta etc.) have an open cabin; a naive down-ray hits the seats and
  // makes lightbars / beacons float in mid-air. Filter hits by minimum Y + mesh name.
  const castRoofSurface = (originArr) => {
    const origin = new THREE.Vector3(...originArr);
    raycaster.set(origin, new THREE.Vector3(0, -1, 0));
    const hits = raycaster.intersectObjects(allVisibleMeshes, true);
    const minRoofY = dims.height * 0.62;
    for (const hit of hits) {
      const n = `${hit.object.name || ''} ${hit.object.parent?.name || ''} ${hit.object.material?.name || ''}`;
      if (/seat|cabin|interior|steer|dash|carpet|floor|pedal|console|cage_interior/i.test(n)) continue;
      if (hit.point.y < minRoofY) continue;
      return hit;
    }
    return null;
  };

  const roofHit =
    castRoofSurface([0, dims.height * 2.2, 0.0]) ||
    castRoofSurface([0, dims.height * 2.2, 0.08]) ||
    castRoofSurface([0, dims.height * 2.2, -0.08]);

  // B. Exact Windshield Header & Interior Visor Anchor (scans vertices for upper windshield frame)
  let maxHeaderY = -999;
  let headerZ = -dims.length * 0.12;
  allVisibleMeshes.forEach((c) => {
    const n = `${c.name || ''} ${c.material?.name || ''}`;
    if (/seat|tire|tyre|wheel|rim/i.test(n)) return;
    const pos = c.geometry?.attributes?.position;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        tempVec.fromBufferAttribute(pos, i).applyMatrix4(c.matrixWorld);
        // Look within central 65% width and upper windshield region
        if (Math.abs(tempVec.x) < dims.width * 0.34 && tempVec.z > -dims.length * 0.32 && tempVec.z < -dims.length * 0.04) {
          if (tempVec.y > maxHeaderY) {
            maxHeaderY = tempVec.y;
            headerZ = tempVec.z;
          }
        }
      }
    }
  });

  const windshieldHeaderY = maxHeaderY > 0 ? maxHeaderY : dims.height * 0.88;
  const windshieldHeaderZ = headerZ;

  // Convertible / open-top: no solid roof panel high enough → mount on windshield header / rear deck
  const isConvertible =
    !roofHit ||
    roofHit.point.y < dims.height * 0.72 ||
    /barchetta|spider|roadster|convertible|cabrio/i.test(modelUrl);

  const roofY = isConvertible
    ? Math.max(dims.height * 0.78, windshieldHeaderY + 0.012)
    : (roofHit ? roofHit.point.y + 0.01 : dims.height * 0.94);
  const roofMountZ = isConvertible ? windshieldHeaderZ + 0.01 : 0.02;

  // Measure windshield slope / pitch
  const wsBottomHit = castSurface([0, dims.height * 0.44, -dims.length * 0.28], [0, 0, 1], allVisibleMeshes);
  const wsBottomY = wsBottomHit ? wsBottomHit.point.y : dims.height * 0.42;
  const wsBottomZ = wsBottomHit ? wsBottomHit.point.z : -dims.length * 0.26;
  const windshieldPitch = Math.atan2(windshieldHeaderY - wsBottomY, -(windshieldHeaderZ - wsBottomZ)) || 0.45;

  // Visor sits snugly flush against the inside edge of the upper windshield header rail
  const visorPos = [0, windshieldHeaderY - 0.016, windshieldHeaderZ + 0.018];
  const visorRot = [windshieldPitch * 0.65, 0, 0];

  // C. Interior Rear Window Deck Flashers
  const rearVisorY = roofY - 0.075;
  const rwHit = castSurface([0, rearVisorY, dims.length * 0.65], [0, 0, -1], allVisibleMeshes);
  const rearVisorZ = rwHit
    ? Math.max(0.05, Math.min(dims.length * 0.28, rwHit.point.z - 0.055))
    : dims.length * 0.18;

  // D. Front Hood Nose Emblem
  // Note: With Ry = Math.PI, local +Z of the badge points toward -Z (front of car).
  // Rotating around +X by a POSITIVE pitch angle `theta > 0` tilts the normal upward (+Y) and forward (-Z):
  // N = (0, +sin(theta), -cos(theta)).
  const hoodProbeZ = factoryFrontCenter
    ? factoryFrontCenter.z
    : /raw_g63_suv/i.test(modelUrl)
    ? -dims.length * 0.44
    : -dims.length * 0.455;
  const hoodProbeY = factoryFrontCenter ? factoryFrontCenter.y : dims.height * 0.44;

  const hoodHit =
    castSurface([0, hoodProbeY + 0.25, hoodProbeZ - 0.25], [0, -0.7, 0.7], allVisibleMeshes) ||
    castSurface([0, dims.height * 0.95, hoodProbeZ], [0, -1, 0], targetMeshes);

  let frontHoodPitch = +0.78; // ~45 deg upward slope on front nose
  let frontHoodPos = factoryFrontCenter
    ? [0, factoryFrontCenter.y + 0.005, factoryFrontCenter.z - 0.005]
    : [0, dims.height * 0.44, -dims.length * 0.46];

  if (hoodHit) {
    const ny = Math.max(0.25, Math.abs(hoodHit.normal.y));
    const nz = Math.min(-0.25, -Math.abs(hoodHit.normal.z || 0.7));
    frontHoodPitch = Math.atan2(ny, -nz);
    const basePt = factoryFrontCenter || hoodHit.point;
    frontHoodPos = [
      0,
      Math.max(basePt.y, hoodHit.point.y) + Math.sin(frontHoodPitch) * 0.005,
      Math.min(basePt.z, hoodHit.point.z) - Math.cos(frontHoodPitch) * 0.005
    ];
  }
  const frontHoodRot = [frontHoodPitch, Math.PI, 0];

  // E. Front Grille Center Emblem & Grille Strobe Surface
  const grilleY = /raw_g63_suv/i.test(modelUrl) ? dims.height * 0.46 : dims.height * 0.34;
  const grilleHit =
    castSurface([0, grilleY, -dims.length * 0.65], [0, 0, 1], allVisibleMeshes) ||
    castSurface([0.05, grilleY, -dims.length * 0.65], [0, 0, 1], allVisibleMeshes);

  const grilleSurfaceZ = grilleHit ? grilleHit.point.z : -dims.length * 0.482;
  const frontGrillePos = [0, grilleHit ? grilleHit.point.y : grilleY, grilleSurfaceZ - 0.005];
  const frontGrilleRot = [0.08, Math.PI, 0];

  // Front bumper lip from actual vertices (SoundOff / grille pods were falling to the floor
  // because a fixed height * missed ray put them at y≈0 under the car).
  const bumperSamples = [];
  allVisibleMeshes.forEach((c) => {
    const n = `${c.name || ''} ${c.material?.name || ''}`;
    if (/tire|tyre|wheel|rim|glass|seat|interior/i.test(n)) return;
    const pos = c.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i += 4) {
      tempVec.fromBufferAttribute(pos, i).applyMatrix4(c.matrixWorld);
      if (
        tempVec.z < -dims.length * 0.38 &&
        tempVec.y > dims.height * 0.12 &&
        tempVec.y < dims.height * 0.48 &&
        Math.abs(tempVec.x) < dims.width * 0.22
      ) {
        bumperSamples.push(tempVec.clone());
      }
    }
  });
  let bumperPos = [0, frontGrillePos[1] - 0.1, frontGrillePos[2] - 0.02];
  if (bumperSamples.length > 8) {
    let minZ = Infinity;
    bumperSamples.forEach((p) => {
      if (p.z < minZ) minZ = p.z;
    });
    const band = bumperSamples.filter((p) => p.z < minZ + 0.06);
    const avg = averagePoints(band.length ? band : bumperSamples);
    if (avg) {
      bumperPos = [0, avg.y, avg.z - 0.012];
    }
  }

  // F. Rear Trunk Emblem
  // Note: With Ry = 0, local +Z points toward +Z (rear of car).
  // Rotating around +X by a NEGATIVE angle `theta <= 0` tilts the normal upward (+Y) and backward (+Z):
  // N = (0, -sin(theta), +cos(theta)).
  const trunkY = factoryRearCenter
    ? factoryRearCenter.y
    : /raw_g63_suv/i.test(modelUrl)
    ? dims.height * 0.52
    : dims.height * 0.53;
  const trunkHit =
    castSurface([0, trunkY + 0.08, dims.length * 0.65], [0, -0.2, -1], allVisibleMeshes) ||
    castSurface([0, dims.height * 0.48, dims.length * 0.65], [0, 0, -1], allVisibleMeshes);

  let rearTrunkPitch = -0.18;
  let rearTrunkPos = factoryRearCenter
    ? [0, factoryRearCenter.y + 0.004, factoryRearCenter.z + 0.005]
    : [0, trunkY, dims.length * 0.485];

  if (trunkHit) {
    const ny = Math.max(0.05, Math.min(0.6, Math.abs(trunkHit.normal.y)));
    const nz = Math.max(0.5, Math.abs(trunkHit.normal.z));
    rearTrunkPitch = -Math.atan2(ny, nz);
    const basePt = factoryRearCenter || trunkHit.point;
    rearTrunkPos = [
      0,
      basePt.y + Math.sin(-rearTrunkPitch) * 0.005,
      Math.max(basePt.z, trunkHit.point.z) + Math.cos(-rearTrunkPitch) * 0.005
    ];
  }
  const rearTrunkRot = [rearTrunkPitch, 0, 0];

  // G. Left & Right Front Door Flush Decal Positions
  const doorY = dims.height * 0.41;
  const doorZ = -dims.length * 0.04;
  const leftDoorHit = castSurface([-dims.width * 0.75, doorY, doorZ], [1, 0, 0], allVisibleMeshes);
  const rightDoorHit = castSurface([dims.width * 0.75, doorY, doorZ], [-1, 0, 0], allVisibleMeshes);

  const leftDoorX = leftDoorHit ? leftDoorHit.point.x - 0.004 : -dims.width * 0.488;
  const rightDoorX = rightDoorHit ? rightDoorHit.point.x + 0.004 : dims.width * 0.488;
  const leftDoorRot = [0, -Math.PI / 2, 0];
  const rightDoorRot = [0, Math.PI / 2, 0];

  // Beacon / magnetic light: on hardtop → roof; on convertible → rear deck behind seats
  const beaconPos = isConvertible
    ? [
        -dims.width * 0.12,
        Math.max(rearTrunkPos[1], windshieldHeaderY - 0.04) + 0.04,
        Math.min(rearTrunkPos[2] - 0.08, dims.length * 0.22)
      ]
    : [-dims.width * 0.16, roofY + 0.02, roofMountZ];

  return {
    roofY,
    roofMountZ,
    isConvertible,
    visorPos,
    visorRot,
    visor: { pos: visorPos, rot: visorRot },
    rearVisorPos: [0, rearVisorY, rearVisorZ],
    beaconPos,
    lightbarPos: [0, roofY + 0.018, roofMountZ],
    bumperPos,
    grilleStrobePos: bumperPos,
    headlights: {
      left: [-dims.width * 0.35, dims.height * 0.37, -dims.length * 0.45],
      right: [dims.width * 0.35, dims.height * 0.37, -dims.length * 0.45]
    },
    taillights: {
      left: [-dims.width * 0.33, dims.height * 0.44, dims.length * 0.468],
      right: [dims.width * 0.33, dims.height * 0.44, dims.length * 0.468]
    },
    dashViper: {
      pos: [0, dims.height * 0.52, windshieldHeaderZ + dims.length * 0.08],
      rot: [windshieldPitch * 0.45, 0, 0]
    },
    frontHood: { pos: frontHoodPos, rot: frontHoodRot },
    frontGrille: { pos: frontGrillePos, rot: frontGrilleRot },
    rearTrunk: { pos: rearTrunkPos, rot: rearTrunkRot },
    leftDoor: { pos: [leftDoorX, doorY, doorZ], rot: leftDoorRot },
    rightDoor: { pos: [rightDoorX, doorY, doorZ], rot: rightDoorRot }
  };
}

function loadVehicleByUrl(url, format = 'glb', ytdUrl = null) {
  if (!url) return Promise.resolve(null);
  const cacheKey = ytdUrl ? `${url}|${ytdUrl}|emblem2` : `${url}|emblem2`;

  if (gltfCache.has(cacheKey)) {
    const cachedScene = cloneSceneWithMaterials(gltfCache.get(cacheKey));
    return Promise.resolve(normalizeVehicleScene(cachedScene, 2.65, url));
  }

  if (gltfPromises.has(cacheKey)) {
    return gltfPromises.get(cacheKey).then((baseScene) => {
      if (!baseScene) return null;
      return normalizeVehicleScene(cloneSceneWithMaterials(baseScene), 2.65, url);
    });
  }

  const promise = new Promise((resolve) => {
    const isYft = format === 'yft' || url.toLowerCase().endsWith('.yft');
    console.log('[VEHICLE] loadVehicleByUrl starting:', { url, format, isYft, ytdUrl });
    if (isYft) {
      Promise.all([
        fetch(url).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        }),
        ytdUrl
          ? fetch(ytdUrl)
              .then((r) => (r.ok ? r.arrayBuffer() : null))
              .catch((e) => {
                console.warn('[VEHICLE] Failed to fetch YTD:', e);
                return null;
              })
          : Promise.resolve(null)
      ])
        .then(([yftBuf, ytdBuf]) => {
          console.log('[VEHICLE] Fetched YFT bytes:', yftBuf.byteLength, 'YTD bytes:', ytdBuf?.byteLength);
          const yftScene = parseYftToThreeScene(
            new Uint8Array(yftBuf),
            ytdBuf ? new Uint8Array(ytdBuf) : null
          );
          console.log('[VEHICLE] Parsed YFT scene children:', yftScene.children.length);
          gltfCache.set(cacheKey, yftScene);
          resolve(yftScene);
        })
        .catch((err) => {
          console.error('[VEHICLE] Failed to parse YFT 3D model:', url, err);
          resolve(null);
        });
    } else if (format === 'obj' || url.toLowerCase().endsWith('.obj')) {
      sharedObjLoader.load(
        url,
        (obj) => {
          obj.traverse((c) => {
            if (c.isMesh) {
              c.material = new THREE.MeshPhysicalMaterial({
                name: 'Body_Color',
                color: '#0ea5e9',
                metalness: 0.85,
                roughness: 0.18,
                clearcoat: 1.0
              });
            }
          });
          gltfCache.set(cacheKey, obj);
          resolve(obj);
        },
        undefined,
        (err) => {
          console.error('[VEHICLE] Failed to load OBJ:', url, err);
          resolve(null);
        }
      );
    } else {
      sharedGltfLoader.load(
        url,
        (gltf) => {
          gltfCache.set(cacheKey, gltf.scene);
          resolve(gltf.scene);
        },
        undefined,
        (err) => {
          console.error('[VEHICLE] Failed to load GLB:', url, err);
          resolve(null);
        }
      );
    }
  });

  gltfPromises.set(cacheKey, promise);
  return promise.then((baseScene) => {
    if (!baseScene) return null;
    return normalizeVehicleScene(cloneSceneWithMaterials(baseScene), 2.65, url);
  });
}

function classifyByKeyword(str = '') {
  const s = (str || '').toLowerCase();
  if (!s) return null;

  // 1. Police / Emergency / Law Enforcement (4-Door Police Interceptor Sedan)
  if (/police|cop|sheriff|fbi|pranger|riot|lguard|ambulance|intercept|lspd|patrol|emergency|طوارئ|شرطة/.test(s)) {
    return 'police';
  }
  // 2. Armored / Military / Tactical 4x4 (G63 Armored Tactical)
  if (/kuruma2|armored|insurgent|nightshark|menacer|barrage|apc|rhino|khanjali|halftrack|scarab|zhaba|squaddie|مصفحة|عسكرية/.test(s)) {
    return 'armored';
  }
  // 3. SUVs / Off-Road / Pickups / Trucks / Vans (Mercedes-AMG G63 4x4)
  if (/g63|gwagon|dubsta|baller|granger|toros|rebla|novak|astron|issi8|huntley|rocoto|cavalcade|patriot|mesa|sandking|kamacho|caracara|riata|contender|guardian|bison|bobcat|sadler|rebel|trophy|brawler|hellion|everon|outlaw|vagrant|draugur|monstrociti|terminus|jeep|wrangler|tahoe|suburban|yukon|escalade|landcruiser|prado|hilux|raptor|trx|hummer|suv|off_road|offroad|vans|commercial|utility|عائلية|رباعي|بيك أب|شاحنات/.test(s)) {
    return 'suv';
  }
  // 4. 4-Door Executive Sedans (2023 4-Door Sedan)
  if (/schafter|tailgater|cinquemila|deity|jubilee|cognoscenti|superd|windsor|oracle|fugitive|intruder|premier|stanier|washington|stratum|stretch|asterope|glendale|ingot|primo|regina|romero|stafford|surge|warrener|rhinehart|vorshlaghammer|taxi|crown|caprice|camry|accord|sonata|lexus|s500|e63|c63|sedans|سيدان/.test(s)) {
    return 'sedan';
  }
  // 5. V12 Hypercars (Lamborghini Aventador V12)
  if (/zentorno|torero|adder|emerus|ignus|tempesta|reaper|vacca|infernus|tezeract|zorrusso|krieger|autarch|entity|tyrant|xa21|visione|vagner|cyclone|scramjet|vigilante|deveste|thrax|nero|tigon|zeno|virtue|pipistrello|lambo|aventador|huracan|revuelto|veneno|countach|bugatti|chiron|pagani|koenigsegg/.test(s)) {
    return 'hypercar';
  }
  // 6. Exotic Supercars (Ferrari 458 Spider Supercar)
  if (/turismo|t20|comet|itali|furia|osiris|fmj|cheetah|corsita|omnisegt|sm722|bestia|carbonizzare|seven70|pariah|raiden|neon|prototipo|pfister811|voltic|penetrator|gp1|sc1|tyrus|le7b|taipan|niobe|ferrari|mclaren|porsche|gt3|911|f8|458|488|corvette|coquette|banshee|super|سوبر/.test(s)) {
    return 'supercar';
  }
  // 7. Modern Euro/Sports Coupes (BMW M4 Competition G82)
  if (/revolter|drafter|cypher|sentinel|zion|schwartzer|schlagen|jugular|komoda|sugoi|vstr|bmw|m4|m3|m5|m8|audi|rs6|rs7|coupes|كوبيه/.test(s)) {
    return 'sports';
  }
  // 8. JDM / Tuner / Sports Classics / Compacts (BMW E30 M3 / Tuner Coupe)
  if (/sultan|elegy|jester|zr350|futo|calico|euros|remus|rt3000|vectre|previon|kanjo|penumbra|kuruma|blista|brioso|asbo|club|weevil|issi|panto|prairie|rhapsody|dilettante|casco|cheburek|feltzer3|gt500|infernus2|jb700|mamba|manana|michelli|monroe|nebula|peyote|pigalle|rapidgt3|retinue|savestra|stinger|stromberg|swinger|toreador|tornado|tropos|viseris|z190|zion3|ztype|skyline|supra|gtr|r32|r34|r35|subaru|mitsubishi|\bevo\b|nissan|toyota|mazda|rx7|honda|civic|e30|ae86|drift|jdm|classic|compacts|كلاسيك|مدمجة/.test(s)) {
    return 'jdm';
  }
  // 9. American Muscle (BMW M4 Widebody Coupe)
  if (/buffalo|gauntlet|dominator|vigero|sabregt|dukes|ellie|tampa|ruiner|blade|buccaneer|chino|clique|coquette3|deviant|faction|greenwood|hermes|hotknife|hustler|impaler|imperator|lurcher|moonbeam|nightshade|phoenix|picador|ratloader|slamvan|stallion|tulip|vamos|virgo|voodoo|weevil2|yosemite|dodge|charger|challenger|hellcat|mustang|camaro|muscle|عضلات/.test(s)) {
    return 'muscle';
  }
  return null;
}

/**
 * Classifies any GTA V spawn code, vehicle name, or GTA5-Mods slug into one of our
 * 6 distinct real 3D vehicle archetypes. Prioritizes carPreset before vehicleCategory.
 */
export function resolveVehiclePresetType(carPreset = '', vehicleCategory = '') {
  return classifyByKeyword(carPreset) || classifyByKeyword(vehicleCategory) || 'sports';
}

const badgeTextureCache = new Map();

/**
 * Generates a crisp 512x512 HD circular emblem texture for any preset badge mode
 * ('gold_crown', 'carbon_sport', 'lspd_star', 'neon_led') so emblems look like
 * authentic OEM / Brabus / M-Power / LSPD medallions with zero Z-fighting.
 */
function getProceduralBadgeTexture(mode) {
  if (!mode || mode === 'original' || mode === 'debadged' || mode === 'custom_image') return null;
  if (badgeTextureCache.has(mode)) return badgeTextureCache.get(mode);
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const cx = 256;
  const cy = 256;

  ctx.clearRect(0, 0, 512, 512);

  // Outer metallic rim
  const rimGrad = ctx.createLinearGradient(0, 0, 512, 512);
  if (mode === 'gold_crown' || mode === 'lspd_star') {
    rimGrad.addColorStop(0, '#fef08a');
    rimGrad.addColorStop(0.5, '#f59e0b');
    rimGrad.addColorStop(1, '#b45309');
  } else if (mode === 'neon_led') {
    rimGrad.addColorStop(0, '#bae6fd');
    rimGrad.addColorStop(0.5, '#38bdf8');
    rimGrad.addColorStop(1, '#0284c7');
  } else {
    rimGrad.addColorStop(0, '#f8fafc');
    rimGrad.addColorStop(0.5, '#94a3b8');
    rimGrad.addColorStop(1, '#334155');
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 244, 0, Math.PI * 2);
  ctx.fillStyle = rimGrad;
  ctx.fill();

  // Inner dark enamel shield background
  ctx.beginPath();
  ctx.arc(cx, cy, 214, 0, Math.PI * 2);
  ctx.fillStyle = mode === 'lspd_star' ? '#0f172a' : '#09090b';
  ctx.fill();

  // Inner accent ring
  ctx.beginPath();
  ctx.arc(cx, cy, 196, 0, Math.PI * 2);
  ctx.strokeStyle = mode === 'gold_crown' || mode === 'lspd_star' ? '#fbbf24' : '#38bdf8';
  ctx.lineWidth = 6;
  ctx.stroke();

  if (mode === 'gold_crown') {
    // Draw Royal 24K Gold Crown in center
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(146, 310);
    ctx.lineTo(126, 190);
    ctx.lineTo(196, 240);
    ctx.lineTo(256, 155);
    ctx.lineTo(316, 240);
    ctx.lineTo(386, 190);
    ctx.lineTo(366, 310);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crown jewels & base bar
    ctx.fillStyle = '#fef08a';
    [
      [126, 175],
      [256, 140],
      [386, 175]
    ].forEach(([jx, jy]) => {
      ctx.beginPath();
      ctx.arc(jx, jy, 14, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillRect(146, 322, 220, 24);

    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.fillText('ROYAL EDITION', cx, 392);
  } else if (mode === 'carbon_sport') {
    // M-Power / AMG style tri-color sport stripes + quadrant roundel
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 185, 0, Math.PI * 2);
    ctx.clip();

    // Classic Blue/White Roundel Quadrants + Tri-color slashes
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(cx - 185, cy - 185, 185, 185);
    ctx.fillRect(cx, cy, 185, 185);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx, cy - 185, 185, 185);
    ctx.fillRect(cx - 185, cy, 185, 185);

    // Outer M-Sport ring border
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, 176, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (mode === 'lspd_star') {
    // 8-Point Gold Sheriff / Highway Patrol Star
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -175);
      ctx.lineTo(38, -45);
      ctx.lineTo(-38, -45);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? '#fbbf24' : '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, 68, 0, Math.PI * 2);
    ctx.fillStyle = '#1e3a8a';
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('POLICE', cx, cy);
  } else if (mode === 'neon_led') {
    ctx.beginPath();
    ctx.arc(cx, cy, 145, 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 22;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 75, 0, Math.PI * 2);
    ctx.fillStyle = '#bae6fd';
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  badgeTextureCache.set(mode, tex);
  return tex;
}

const fresnelOpticCache = new Map();

/**
 * Procedural Whelen TIR3 / Linear-LED multi-faceted Fresnel optical lens texture.
 * Replicates genuine police emergency warning lightheads with chrome parabolic bowl,
 * micro-prisms, and center high-intensity LED die.
 */
function getProceduralFresnelOpticTexture(isLit, colorHex = '#dc2626') {
  const key = `${isLit}_${colorHex}`;
  if (fresnelOpticCache.has(key)) return fresnelOpticCache.get(key);
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // 1. Outer die-cast black bezel border
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, 256, 256);

  // 2. Parabolic reflector dish
  const dishGrad = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
  if (isLit) {
    dishGrad.addColorStop(0, '#ffffff');
    dishGrad.addColorStop(0.25, colorHex);
    dishGrad.addColorStop(0.75, colorHex);
    dishGrad.addColorStop(1, '#1e293b');
  } else {
    dishGrad.addColorStop(0, '#f1f5f9');
    dishGrad.addColorStop(0.35, '#94a3b8');
    dishGrad.addColorStop(0.75, '#475569');
    dishGrad.addColorStop(1, '#0f172a');
  }
  ctx.fillStyle = dishGrad;
  ctx.beginPath();
  ctx.roundRect(14, 14, 228, 228, 18);
  ctx.fill();

  // 3. Micro-faceted linear Fresnel prisms (authentic Whelen TIR lines)
  ctx.strokeStyle = isLit ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 2.5;
  for (let x = 28; x <= 228; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, 22);
    ctx.lineTo(x, 234);
    ctx.stroke();
  }

  // Cross horizontal diffusion lines
  ctx.strokeStyle = isLit ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1.5;
  for (let y = 36; y <= 220; y += 28) {
    ctx.beginPath();
    ctx.moveTo(22, y);
    ctx.lineTo(234, y);
    ctx.stroke();
  }

  // 4. Center High-Power LED Emitter Diode (Yellow phosphor chip when unlit)
  if (!isLit) {
    ctx.fillStyle = '#eab308';
    ctx.fillRect(116, 116, 24, 24);
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 2;
    ctx.strokeRect(116, 116, 24, 24);
    // Gold bond wire
    ctx.strokeStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(116, 116);
    ctx.lineTo(104, 104);
    ctx.stroke();
  } else {
    // Blinding white center core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(128, 128, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  fresnelOpticCache.set(key, tex);
  return tex;
}

let cachedSetinaLogoTex = null;
function getProceduralSetinaLogoTexture() {
  if (cachedSetinaLogoTex) return cachedSetinaLogoTex;
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 244, 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SETINA', 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    cachedSetinaLogoTex = tex;
    return tex;
  } catch {
    return null;
  }
}

function measureVehicleBody(scene) {
  if (!scene) return null;
  try {
  scene.updateMatrixWorld(true);
  const toParent = new THREE.Matrix4();
  if (scene.parent) toParent.copy(scene.parent.matrixWorld).invert();
  const parts = [];
  scene.traverse((child) => {
    if (!child.isMesh || !child.visible || !child.geometry || child.userData?.hiddenAsBadge) return;
    if (!child.geometry.attributes?.position) return;
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    if (!child.geometry.boundingBox) return;
    const box = child.geometry.boundingBox.clone();
    box.applyMatrix4(child.matrixWorld);
    if (scene.parent) box.applyMatrix4(toParent);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    if (![size.x, size.y, size.z, center.x, center.y, center.z].every(Number.isFinite)) return;
    parts.push({ child, size, center, box });
  });
  if (!parts.length) return null;
  const weight = (p) => p.child.geometry?.attributes?.position?.count || 0;
  const main = parts.reduce((best, p) => (weight(p) > weight(best) ? p : best), parts[0]);
  const reach = Math.max(main.size.x, main.size.y, main.size.z, 0.8) * 1.35;
  const cluster = parts.filter((p) => {
    const gap = p.center.distanceTo(main.center);
    const pad = Math.max(p.size.x, p.size.y, p.size.z) * 0.5;
    return gap <= reach + pad;
  });
  const body = new THREE.Box3();
  (cluster.length ? cluster : [main]).forEach((p) => body.union(p.box));
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  body.getSize(size);
  body.getCenter(center);
  return { parts, body, size, center, min: body.min.clone(), max: body.max.clone() };
  } catch {
    return null;
  }
}

export default function RealisticGtaVehicle({
  carPreset = 'sultanrs',
  vehicleCategory = '',
  carColor = '#0ea5e9',
  debadged = false,
  filledFlush = false,
  badgeMode = 'original',
  customBadgeTexture = null,
  badgeScale = 1.0,
  badgeOffsetY = 0,
  badgeOffsetZ = 0,
  badgePitch = 0,
  frontBadgeMount = 'auto', // 'auto' | 'hood' | 'grille'
  showDoorBadges = false,
  sirenType = 'auto',
  sirenColorMode = 'red_blue',
  sirenOffsetX = 0,
  sirenOffsetY = 0,
  sirenOffsetZ = 0,
  sirenRotX = 0,
  sirenRotY = 0,
  sirenRotZ = 0,
  sirenScale = 1.0,
  showGrilleStrobes = true,
  pushbarEnabled = null,
  selectedRim = 'sport_vossen',
  selectedBodykit = { splitter: true, spoiler: true, exhaust: true },
  stanceCamber = 0,
  stanceHeight = 0,
  stanceOffset = 0,
  headlightsOn = true,
  underglowOn = false,
  underglowColor = '#06b6d4',
  customModelUrl = null,
  customModelFormat = 'glb',
  customYtdUrl = null,
  customLightbarUrl = null,
  customLightbarFormat = 'obj',
  customLightbarCacheId = null,
  customLiveryTexture = null,
  sirenGroupRef = null,
  badgeGroupRef = null
}) {
  const [loadedData, setLoadedData] = useState(null);
  const [customLightbarObj, setCustomLightbarObj] = useState(null);
  const [strobeState, setStrobeState] = useState(false);

  const presetType = useMemo(
    () => resolveVehiclePresetType(carPreset, vehicleCategory),
    [carPreset, vehicleCategory]
  );

  const targetModelUrl = useMemo(() => {
    if (customModelUrl) return customModelUrl;
    return VEHICLE_GLB_MAP[presetType] || VEHICLE_GLB_MAP.sports;
  }, [customModelUrl, presetType]);

  // Effective Siren Type & Pushbar state
  const effectiveSirenType = useMemo(() => {
    if (sirenType && sirenType !== 'auto') return sirenType;
    return presetType === 'police' ? 'lightbar_led' : 'none';
  }, [sirenType, presetType]);

  const effectivePushbar = useMemo(() => {
    if (effectiveSirenType === 'setina_pb400_led') return true;
    if (typeof pushbarEnabled === 'boolean') return pushbarEnabled;
    return presetType === 'police';
  }, [pushbarEnabled, presetType, effectiveSirenType]);

  const effectiveBadgeMode = useMemo(() => {
    if (badgeMode && badgeMode !== 'original') return badgeMode;
    return debadged ? 'debadged' : 'original';
  }, [badgeMode, debadged]);

  // Siren Color Pair Resolver
  const sirenColors = useMemo(() => {
    switch (sirenColorMode) {
      case 'blue_only':
        return { left: '#0284c7', right: '#38bdf8' };
      case 'red_white':
        return { left: '#dc2626', right: '#f8fafc' };
      case 'amber_gold':
        return { left: '#f59e0b', right: '#fde047' };
      case 'red_blue':
      default:
        return { left: '#0284c7', right: '#dc2626' };
    }
  }, [sirenColorMode]);

  // Active Badge Texture (Either User Uploaded PNG/JPG or 512x512 HD Procedural Emblem)
  const activeBadgeTex = useMemo(() => {
    if (effectiveBadgeMode === 'custom_image' && customBadgeTexture) {
      const tex = sharedTextureLoader.load(customBadgeTexture);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    }
    return getProceduralBadgeTexture(effectiveBadgeMode);
  }, [effectiveBadgeMode, customBadgeTexture]);

  // Preload all 6 GLBs in the background once so switching vehicle archetypes is instantaneous
  useEffect(() => {
    const timer = setTimeout(() => {
      const uniqueUrls = [...new Set(Object.values(VEHICLE_GLB_MAP))];
      uniqueUrls.forEach((u) => {
        if (!gltfCache.has(u) && !gltfPromises.has(u)) {
          loadVehicleByUrl(u, 'glb');
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Emergency Police / Wanan Strobe Animation (active whenever any siren or pushbar is enabled)
  useEffect(() => {
    if (effectiveSirenType === 'none' && !effectivePushbar) return;
    const interval = setInterval(() => {
      setStrobeState((prev) => !prev);
    }, 165);
    return () => clearInterval(interval);
  }, [effectiveSirenType, effectivePushbar]);

  // Load custom LCPDFR lightbar prop (OBJ/YFT URL or in-memory ZIP cache)
  useEffect(() => {
    let active = true;

    const fromCache = getCachedCustomLightbarScene(customLightbarCacheId);
    if (fromCache) {
      const clone = fromCache.clone(true);
      clone.traverse((c) => {
        if (c.isMesh && c.material) {
          c.material = Array.isArray(c.material)
            ? c.material.map((m) => m.clone())
            : c.material.clone();
        }
      });
      setCustomLightbarObj(clone);
      return () => {
        active = false;
      };
    }

    if (!customLightbarUrl) {
      setCustomLightbarObj(null);
      return () => {
        active = false;
      };
    }

    const fmt = (customLightbarFormat || 'obj').toLowerCase();
    if (fmt === 'obj' || customLightbarUrl.toLowerCase().endsWith('.obj')) {
      sharedObjLoader.load(
        customLightbarUrl,
        (obj) => {
          if (!active) return;
          const g = new THREE.Group();
          g.name = 'custom_lcpdfr_lightbar';
          g.add(obj);
          const box = new THREE.Box3().setFromObject(g);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          const scale = 1.35 / (Math.max(size.x, size.y, size.z) || 1);
          obj.position.set(-center.x, -box.min.y, -center.z);
          g.scale.setScalar(scale);
          setCustomLightbarObj(g);
        },
        undefined,
        () => {
          if (active) setCustomLightbarObj(null);
        }
      );
    } else if (fmt === 'yft' || customLightbarUrl.toLowerCase().endsWith('.yft')) {
      fetch(customLightbarUrl)
        .then((r) => r.arrayBuffer())
        .then((buf) => {
          if (!active) return;
          const scene = parseYftToThreeScene(new Uint8Array(buf));
          if (!scene) return;
          const g = new THREE.Group();
          g.name = 'custom_lcpdfr_lightbar';
          g.add(scene);
          const box = new THREE.Box3().setFromObject(g);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          const scale = 1.35 / (Math.max(size.x, size.y, size.z) || 1);
          scene.position.set(-center.x, -box.min.y, -center.z);
          g.scale.setScalar(scale);
          setCustomLightbarObj(g);
        })
        .catch(() => {
          if (active) setCustomLightbarObj(null);
        });
    }

    return () => {
      active = false;
    };
  }, [customLightbarUrl, customLightbarFormat, customLightbarCacheId]);

  // Load & Normalize the Corresponding High-Poly 3D GLB/OBJ/YFT Model
  useEffect(() => {
    let active = true;
    loadVehicleByUrl(targetModelUrl, customModelFormat, customYtdUrl).then((res) => {
      if (!active || !res) return;
      setLoadedData(res);
    });
    return () => {
      active = false;
    };
  }, [targetModelUrl, customModelFormat, customYtdUrl]);

  // Dynamically Apply Paint Color, Rims, Rubber Tires, Debadge/Badge Replacer, and Livery Across All Models
  useEffect(() => {
    if (!loadedData?.scene) return;

    let effectiveColor = carColor || '#0ea5e9';
    let effectiveMetalness = 0.85;
    let effectiveRoughness = 0.18;

    if (presetType === 'police' && (!carColor || carColor === '#0ea5e9' || carColor === '#0369a1')) {
      effectiveColor = '#0a0a0f'; // LSPD Gloss Midnight Black
      effectiveMetalness = 0.9;
      effectiveRoughness = 0.14;
    } else if (presetType === 'armored' && (!carColor || carColor === '#0ea5e9')) {
      effectiveColor = '#1e293b'; // Tactical Armored Slate
      effectiveMetalness = 0.72;
      effectiveRoughness = 0.38;
    }

    let customTex = null;
    if (customLiveryTexture) {
      customTex = sharedTextureLoader.load(customLiveryTexture);
      customTex.colorSpace = THREE.SRGBColorSpace;
      customTex.flipY = false;
    }

    const hideOriginalBadges = effectiveBadgeMode !== 'original';
    const bodyFit = measureVehicleBody(loadedData.scene);
    const bodySize = bodyFit?.size;
    const bodyMin = bodyFit?.min;
    const bodyMax = bodyFit?.max;

    loadedData.scene.traverse((child) => {
      if (!child.isMesh) return;
      const nodeName = child.name || '';
      const mats = Array.isArray(child.material) ? child.material : [child.material];

      mats.forEach((mat) => {
        if (!mat) return;
        const matName = mat.name || '';
        const label = `${nodeName} ${matName}`;

        // 1. Debadging / Badge Replacement (Hide Factory Emblems, Logos, Chrome Crests, and Wheel Caps across all models)
        const namedBadge =
          /Vehicle_Badge|Wheel_Center_Cap|badge|emblem|logo|pininfarina|barch_badge|ferrari_badge|ferrari_logo|BMW_E30_M3_EMBLEMS|Mt_Logos|Mesheslogo11Mtl|Benz_Logo|V8_BITURBO|mercedes|amg_badge|crest/i.test(
            label
          );
        const skipPart =
          /tire|tyre|wheel|rim|glass|light|headlight|taillight|plate/i.test(label) &&
          !/badge|logo|emblem|center_cap/i.test(label);
        let emblemByPlace = false;
        if (bodyFit && !skipPart) {
          const part = bodyFit.parts.find((p) => p.child === child);
          if (part) {
            const { size, center } = part;
            const thin = size.z < 0.18 || size.y < 0.14;
            const onNose =
              center.z < bodyMin.z + bodySize.z * 0.18 &&
              center.y > bodyMin.y + bodySize.y * 0.16 &&
              Math.abs(center.x) < 0.36 &&
              size.x < 0.7 &&
              size.y < 0.36 &&
              size.z < 0.36;
            const onTrunk =
              center.z > bodyMax.z - bodySize.z * 0.14 &&
              center.y > bodyMin.y + bodySize.y * 0.42 &&
              Math.abs(center.x) < 0.62 &&
              size.x < 0.85 &&
              size.y < 0.2 &&
              size.z < 0.26;
            emblemByPlace = thin && (onNose || onTrunk);
          }
        }
        const isBadge = namedBadge || emblemByPlace;

        if (isBadge) {
          child.userData.hiddenAsBadge = true;
          child.visible = !hideOriginalBadges;
          return;
        }
        if (child.userData.hiddenAsBadge) {
          child.userData.hiddenAsBadge = false;
          child.visible = true;
        }

        // 2. Transparent Tinted Glass & Headlight Lenses (fixes opaque grey glass on gta_sports_car.glb)
        if (/^Glass_Gray$|^Projector_Glass$/i.test(matName)) {
          mat.transparent = true;
          mat.opacity = /Projector/i.test(matName) ? 0.45 : 0.36;
          mat.color.set('#0f172a');
          if ('metalness' in mat) mat.metalness = 0.92;
          if ('roughness' in mat) mat.roughness = 0.06;
          mat.depthWrite = false;
          mat.needsUpdate = true;
          return;
        }

        // 3. Dark Carbon / Grille Surround (fixes baby-blue _0098_DodgerBlue and bright grey Carbon_Fiber/Carpet on gta_sports_car.glb)
        if (/^_0098_DodgerBlue$|^Carbon_Fiber$|^Carpet$/i.test(matName)) {
          mat.color.set('#16161a');
          if ('metalness' in mat) mat.metalness = /Carbon/i.test(matName) ? 0.45 : 0.15;
          if ('roughness' in mat) mat.roughness = /Carbon/i.test(matName) ? 0.32 : 0.72;
          mat.needsUpdate = true;
          return;
        }

        // 4. Rubber Tires (Ensure Meshesm8rim0011Mtl on BMW M4 & tire materials across all cars are dark matte rubber)
        const isRubberTire =
          /Meshesm8rim0011Mtl|^tire$|^Tires$|Mt_Tyres|BMW_E30_M3_TIRE/i.test(matName);
        if (isRubberTire) {
          mat.color.set(mat.map ? '#222226' : '#141417');
          if ('metalness' in mat) mat.metalness = 0.08;
          if ('roughness' in mat) mat.roughness = 0.86;
          mat.needsUpdate = true;
          return;
        }

        // 5. Primary Vehicle Body Paint across all models (including YFT Body_Color & BMW M4 panels)
        const isBodyPaint =
          /Body_Color|Mt_Body|Mt_MirrorCover|MMAT_CarPaint|CarPaint|BMW_E30_M3_PAINT|Meshesbody151Mtl|Mesheszx1Mtl|Mesheslivery1Mtl/i.test(
            matName
          ) || nodeName === 'body';

        if (isBodyPaint) {
          child.visible = true;
          if (customTex) {
            mat.map = customTex;
            mat.color.set('#ffffff');
          } else {
            if (/Meshesbody151Mtl|Mesheszx1Mtl|Mesheslivery1Mtl/i.test(matName)) {
              mat.map = null;
            }
            mat.color.set(effectiveColor);
          }
          if ('metalness' in mat) mat.metalness = effectiveMetalness;
          if ('roughness' in mat) mat.roughness = effectiveRoughness;
          if ('clearcoat' in mat) {
            mat.clearcoat = presetType === 'armored' ? 0.25 : 1.0;
            mat.clearcoatRoughness = 0.05;
          }
          mat.needsUpdate = true;
        }

        // 6. Rims & Alloy Wheels across all models (including YFT Mt_AlloyWheels & gta_sports_car rim_*)
        const isRim =
          /metal_chrome|Mt_AlloyWheels|MMAT_Tire_Hub|BMW_E30_M3_RIM|^Meshesm8rim1Mtl$|Wheel1A/i.test(
            matName
          ) || /^rim_(fl|fr|rl|rr)$|^wheel$/i.test(nodeName);

        if (isRim) {
          if (selectedRim === 'satin_black' || presetType === 'police' || presetType === 'armored') {
            mat.color.set('#111827'); // Tactical Satin Black
            if ('metalness' in mat) mat.metalness = 0.65;
            if ('roughness' in mat) mat.roughness = 0.35;
          } else if (selectedRim === 'rotiform_monoblock') {
            mat.color.set('#eab308'); // Anodized Racing Gold
            if ('metalness' in mat) mat.metalness = 0.95;
            if ('roughness' in mat) mat.roughness = 0.14;
          } else if (selectedRim === 'deep_dish_chrome') {
            mat.color.set('#f8fafc'); // Mirror Chrome
            if ('metalness' in mat) mat.metalness = 0.99;
            if ('roughness' in mat) mat.roughness = 0.04;
          } else {
            mat.color.set('#d8dde6'); // Machined Alloy Silver
            if ('metalness' in mat) mat.metalness = 0.88;
            if ('roughness' in mat) mat.roughness = 0.16;
          }
          mat.needsUpdate = true;
        }
      });
    });
  }, [loadedData, carColor, presetType, selectedRim, effectiveBadgeMode, debadged, customLiveryTexture]);

  const bodyFit = useMemo(() => measureVehicleBody(loadedData?.scene), [loadedData]);

  const dims = loadedData?.dimensions || { width: 1.15, height: 0.78, length: 2.65 };
  const anchors = loadedData?.anchors || {
    roofY: dims.height * 0.92,
    roofMountZ: 0.02,
    isConvertible: false,
    lightbarPos: [0, dims.height * 0.94, 0.02],
    beaconPos: [-dims.width * 0.16, dims.height * 0.94, 0.02],
    visorPos: [0, dims.height * 0.91, -dims.length * 0.06],
    rearVisorPos: [0, dims.height * 0.89, dims.length * 0.18],
    bumperPos: [0, dims.height * 0.28, -dims.length * 0.49],
    grilleStrobePos: [0, dims.height * 0.28, -dims.length * 0.49],
    dashViper: { pos: [0, dims.height * 0.52, -dims.length * 0.12], rot: [0.35, 0, 0] },
    visor: { pos: [0, dims.height * 0.91, -dims.length * 0.06], rot: [0.4, 0, 0] },
    frontHood: { pos: [0, dims.height * 0.44, -dims.length * 0.46], rot: [0.78, Math.PI, 0] },
    frontGrille: { pos: [0, dims.height * 0.36, -dims.length * 0.485], rot: [0.08, Math.PI, 0] },
    rearTrunk: { pos: [0, dims.height * 0.53, dims.length * 0.484], rot: [-0.18, 0, 0] },
    leftDoor: { pos: [-dims.width * 0.488, dims.height * 0.41, -dims.length * 0.04], rot: [0, -Math.PI / 2, 0] },
    rightDoor: { pos: [dims.width * 0.488, dims.height * 0.41, -dims.length * 0.04], rot: [0, Math.PI / 2, 0] }
  };

  const roofY = anchors.roofY;
  const frontZ = -dims.length * 0.49;
  // Always mount from normalized dims/anchors (bodyFit was pulling mounts into empty air on YFT)
  const bumperLive = anchors.bumperPos || anchors.frontGrille?.pos || [0, dims.height * 0.28, -dims.length * 0.49];
  const grilleLive = anchors.grilleStrobePos || bumperLive;
  const visorLive = anchors.visor?.pos || anchors.visorPos || [0, dims.height * 0.91, -dims.length * 0.06];
  const lightbarBase = anchors.lightbarPos || [0, Math.max(roofY, dims.height * 0.92) + 0.018, anchors.roofMountZ || 0.02];
  const beaconBase = anchors.beaconPos || [-dims.width * 0.16, Math.max(roofY, dims.height * 0.92) + 0.02, 0.02];

  // Stable outer anchor + inner gizmo group (gizmo never fights React position props)
  const sirenOuterPos = (base) => [
    base[0] + (sirenOffsetX || 0),
    base[1] + (sirenOffsetY || 0),
    base[2] + (sirenOffsetZ || 0)
  ];
  // User flip/rotate offsets stacked on mount-facing base rotation
  const sirenOuterRot = (baseRot = [0, 0, 0]) => [
    (baseRot[0] || 0) + (sirenRotX || 0),
    (baseRot[1] || 0) + (sirenRotY || 0),
    (baseRot[2] || 0) + (sirenRotZ || 0)
  ];
  // Default facing: modules look OUT from the car (GTA front = -Z). Flip Y 180° unless already outward.
  let sirenFaceFix = [0, Math.PI, 0];
  if (effectiveSirenType === 'viper_s2') {
    sirenFaceFix = [-0.15, Math.PI, 0];
  } else if (effectiveSirenType === 'visor_unmarked') {
    sirenFaceFix = [0.15, Math.PI, 0];
  } else if (effectiveSirenType === 'soundoff_ion') {
    sirenFaceFix = [0.05, Math.PI, 0];
  }

  // Determine whether front badge sits on the sloped hood nose (BMW/Lambo/Ferrari/Sedan) or vertical grille (G63 SUV)
  const useGrilleForFront =
    frontBadgeMount === 'grille' ||
    (frontBadgeMount === 'auto' && (presetType === 'suv' || presetType === 'armored'));
  const activeFrontAnchor = useGrilleForFront ? anchors.frontGrille : anchors.frontHood;
  const shouldRenderDoors = showDoorBadges || effectiveBadgeMode === 'lspd_star';

  // Render a wafer-thin, flush, OEM-proportioned 3D Custom Emblem Medallion
  // Uses a single crisp 512x512 CanvasTexture / uploaded image on both faces of the medallion wafer so there is zero Z-fighting
  const renderCustomEmblem = (key, basePos, baseRot, scale = 1, isDoorDecal = false) => {
    if (effectiveBadgeMode === 'original' || effectiveBadgeMode === 'debadged') return null;

    const r = isDoorDecal ? 0.048 : 0.028; // Realistic OEM roundel vs door crest
    const finalRot = isDoorDecal
      ? baseRot
      : [baseRot[0] + badgePitch, baseRot[1], baseRot[2]];

    return (
      <group key={key} position={basePos} rotation={finalRot} scale={[scale, scale, scale]}>
        {/* Thin Metallic Bezel Rim */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r, r * 1.03, 0.0024, 48, 1, true]} />
          <meshStandardMaterial
            color={
              effectiveBadgeMode === 'gold_crown' || effectiveBadgeMode === 'lspd_star'
                ? '#fbbf24'
                : effectiveBadgeMode === 'neon_led'
                ? '#38bdf8'
                : '#e2e8f0'
            }
            metalness={0.5}
            roughness={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Front Textured Face (+Z) */}
        <mesh position={[0, 0, 0.0014]}>
          <circleGeometry args={[r, 48]} />
          <meshBasicMaterial
            map={activeBadgeTex}
            color="#ffffff"
            transparent
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-4}
          />
        </mesh>

        {/* Back Textured Face (-Z) so emblem is visible regardless of normal polarity */}
        <mesh position={[0, 0, -0.0014]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[r, 48]} />
          <meshBasicMaterial
            map={activeBadgeTex}
            color="#ffffff"
            transparent
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-4}
          />
        </mesh>
      </group>
    );
  };

  const frontPos = activeFrontAnchor.pos;

  return (
    <group
      name="realistic_gta_vehicle_wrapper"
      position={[0, -0.38 + stanceHeight * 0.08, 0]}
      rotation={[0, 0, (stanceCamber || 0) * 0.005]}
      scale={[1 + (stanceOffset || 0) * 0.02, 1, 1]}
    >
      {/* 1. REAL HIGH-POLY 3D VEHICLE MODEL (6 Distinct GLBs + Custom Uploads) */}
      {loadedData?.scene && <primitive object={loadedData.scene} />}

      {/* 2. 3D CUSTOM VEHICLE EMBLEMS & BADGES — outer glued to body, inner for gizmo drag */}
      {effectiveBadgeMode !== 'original' && effectiveBadgeMode !== 'debadged' && (
        <group
          name="custom_vehicle_badges"
          position={[frontPos[0], frontPos[1] + badgeOffsetY, frontPos[2] + badgeOffsetZ]}
        >
          <group ref={badgeGroupRef}>
          {/* Front Nose / Hood / Grille Emblem (at [0,0,0] of badgeGroupRef!) */}
          {renderCustomEmblem(
            'front_badge',
            [0, 0, 0],
            activeFrontAnchor.rot,
            1.0 * badgeScale,
            false
          )}
          {/* Rear Trunk Emblem */}
          {renderCustomEmblem(
            'rear_badge',
            [
              anchors.rearTrunk.pos[0] - frontPos[0],
              anchors.rearTrunk.pos[1] - frontPos[1],
              anchors.rearTrunk.pos[2] - frontPos[2]
            ],
            anchors.rearTrunk.rot,
            0.95 * badgeScale,
            false
          )}
          {/* Optional Side Door Police Star / Custom Flush Door Decals */}
          {shouldRenderDoors && (
            <>
              {renderCustomEmblem(
                'left_door_crest',
                [
                  anchors.leftDoor.pos[0] - frontPos[0],
                  anchors.leftDoor.pos[1] - frontPos[1],
                  anchors.leftDoor.pos[2] - frontPos[2]
                ],
                anchors.leftDoor.rot,
                1.15 * badgeScale,
                true
              )}
              {renderCustomEmblem(
                'right_door_crest',
                [
                  anchors.rightDoor.pos[0] - frontPos[0],
                  anchors.rightDoor.pos[1] - frontPos[1],
                  anchors.rightDoor.pos[2] - frontPos[2]
                ],
                anchors.rightDoor.rot,
                1.15 * badgeScale,
                true
              )}
            </>
          )}
          </group>
        </group>
      )}

      {/* Cabin emergency props (MDT + radio) — sit inside the car for FiveM realism */}
      {effectiveSirenType !== 'none' && (
        <group name="cabin_fivem_props" position={[0.18, dims.height * 0.48, -dims.length * 0.08]}>
          {/* MDT / laptop on dash */}
          <mesh position={[0, 0.02, 0]} rotation={[-0.55, 0.2, 0]} castShadow>
            <boxGeometry args={[0.14, 0.09, 0.012]} />
            <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.025, -0.002]} rotation={[-0.55, 0.2, 0]}>
            <planeGeometry args={[0.12, 0.07]} />
            <meshStandardMaterial
              color={strobeState ? '#38bdf8' : '#1d4ed8'}
              emissive={strobeState ? '#38bdf8' : '#1e3a8a'}
              emissiveIntensity={strobeState ? 0.63 : 0.30}
            />
          </mesh>
          {/* Center console radio */}
          <mesh position={[-0.16, -0.04, 0.06]} castShadow>
            <boxGeometry args={[0.1, 0.04, 0.08]} />
            <meshStandardMaterial color="#111827" metalness={0.55} roughness={0.4} />
          </mesh>
          <mesh position={[-0.16, -0.02, 0.1]}>
            <boxGeometry args={[0.06, 0.012, 0.008]} />
            <meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={1.2} />
          </mesh>
        </group>
      )}

      {/* 3. MULTI-STYLE EMERGENCY SIREN / WANAN STUDIO (LCPDFR Dev Resources Grade) */}
      {effectiveSirenType !== 'none' && (
        <group name="vehicle_siren_wanan_package">

          {/* ========================================================================= */}
          {/* STYLE 1: WHELEN VERTEX SUPER LED HIDE-A-WAY (LCPDFR DEV-RESOURCES STYLE)  */}
          {/* فلاشات مخفية داخل الشمعات الأمامية والأنوار الخلفية والشبك - مظهر مدني 100% */}
          {/* ========================================================================= */}
          {effectiveSirenType === 'hideaway_vertex' && (
            <group name="lcpdfr_whelen_vertex_hideaway">
              {/* Left Front Headlight Vertex Strobe Module */}
              <group position={anchors.headlights.left}>
                {/* Chrome Reflector Cup */}
                <mesh position={[0, 0, 0.015]} rotation={[-Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.024, 0.014, 0.018, 20]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
                </mesh>
                {/* Whelen Vertex Fluted Optic Dome */}
                <mesh position={[0, 0, 0.02]}>
                  <sphereGeometry args={[0.018, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshStandardMaterial
                    map={getProceduralFresnelOpticTexture(strobeState, sirenColors.left)}
                    color={strobeState ? sirenColors.left : '#ffffff'}
                    emissive={strobeState ? sirenColors.left : '#000000'}
                    emissiveIntensity={strobeState ? 2.27 : 0.00}
                    roughness={0.05}
                    metalness={0.1}
                    transparent
                    opacity={0.92}
                  />
                </mesh>
                {strobeState && (
                  <pointLight
                    position={[0, 0, -0.06]}
                    intensity={0.45}
                    distance={1.4}
                    color={sirenColors.left}
                  />
                )}
              </group>

              {/* Right Front Headlight Vertex Strobe Module */}
              <group position={anchors.headlights.right}>
                <mesh position={[0, 0, 0.015]} rotation={[-Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.024, 0.014, 0.018, 20]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, 0.02]}>
                  <sphereGeometry args={[0.018, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshStandardMaterial
                    map={getProceduralFresnelOpticTexture(!strobeState, sirenColors.right)}
                    color={!strobeState ? sirenColors.right : '#ffffff'}
                    emissive={!strobeState ? sirenColors.right : '#000000'}
                    emissiveIntensity={!strobeState ? 1.6 : 0.00}
                    roughness={0.05}
                    metalness={0.1}
                    transparent
                    opacity={0.92}
                  />
                </mesh>
                {!strobeState && (
                  <pointLight
                    position={[0, 0, -0.06]}
                    intensity={0.45}
                    distance={1.4}
                    color={sirenColors.right}
                  />
                )}
              </group>

              {/* Front Grille Whelen ION Surface Mounts */}
              <group position={[grilleLive[0] - dims.width * 0.15, grilleLive[1], grilleLive[2]]}>
                <mesh>
                  <boxGeometry args={[0.052, 0.018, 0.012]} />
                  <meshStandardMaterial color="#09090b" roughness={0.7} metalness={0.3} />
                </mesh>
                <mesh position={[0, 0, -0.005]}>
                  <planeGeometry args={[0.046, 0.014]} />
                  <meshStandardMaterial
                    map={getProceduralFresnelOpticTexture(strobeState, sirenColors.left)}
                    color={sirenColors.left}
                    emissive={sirenColors.left}
                    emissiveIntensity={strobeState ? 2.03 : 0.25}
                  />
                </mesh>
              </group>
              <group position={[grilleLive[0] + dims.width * 0.15, grilleLive[1], grilleLive[2]]}>
                <mesh>
                  <boxGeometry args={[0.052, 0.018, 0.012]} />
                  <meshStandardMaterial color="#09090b" roughness={0.7} metalness={0.3} />
                </mesh>
                <mesh position={[0, 0, -0.005]}>
                  <planeGeometry args={[0.046, 0.014]} />
                  <meshStandardMaterial
                    map={getProceduralFresnelOpticTexture(!strobeState, sirenColors.right)}
                    color={sirenColors.right}
                    emissive={sirenColors.right}
                    emissiveIntensity={!strobeState ? 2.03 : 0.25}
                  />
                </mesh>
              </group>

              {/* Left Rear Taillight/Reverse Hideaway Strobe */}
              <group position={anchors.taillights.left}>
                <mesh position={[0, 0, 0]}>
                  <sphereGeometry args={[0.016, 14, 14]} />
                  <meshStandardMaterial
                    map={getProceduralFresnelOpticTexture(!strobeState, sirenColors.right)}
                    color={!strobeState ? sirenColors.right : '#ffffff'}
                    emissive={!strobeState ? sirenColors.right : '#000000'}
                    emissiveIntensity={!strobeState ? 1.92 : 0.00}
                    transparent
                    opacity={0.88}
                  />
                </mesh>
                {!strobeState && (
                  <pointLight position={[0, 0, 0.06]} intensity={0.55} distance={1.60} color={sirenColors.right} />
                )}
              </group>

              {/* Right Rear Taillight/Reverse Hideaway Strobe */}
              <group position={anchors.taillights.right}>
                <mesh position={[0, 0, 0]}>
                  <sphereGeometry args={[0.016, 14, 14]} />
                  <meshStandardMaterial
                    map={getProceduralFresnelOpticTexture(strobeState, sirenColors.left)}
                    color={strobeState ? sirenColors.left : '#ffffff'}
                    emissive={strobeState ? sirenColors.left : '#000000'}
                    emissiveIntensity={strobeState ? 1.92 : 0.00}
                    transparent
                    opacity={0.88}
                  />
                </mesh>
                {strobeState && (
                  <pointLight position={[0, 0, 0.06]} intensity={0.55} distance={1.60} color={sirenColors.left} />
                )}
              </group>
            </group>
          )}

          {/* ========================================================================= */}
          {/* STYLE 2: WHELEN INNER EDGE FST DUAL VISOR BAR (LCPDFR UNMARKED POLICE)    */}
          {/* شريط تظليل زجاج داخلي عالي الدقة ملتصق بسقف الزجاج مع شيلد وقواعد تثبيت    */}
          {/* ========================================================================= */}
          {effectiveSirenType === 'visor_unmarked' && (
            <group
              name="lcpdfr_whelen_inner_edge"
              position={sirenOuterPos(visorLive)}
              rotation={sirenOuterRot([
                (anchors.visor?.rot?.[0] ?? 0.4) + sirenFaceFix[0],
                (anchors.visor?.rot?.[1] ?? 0) + sirenFaceFix[1],
                (anchors.visor?.rot?.[2] ?? 0) + sirenFaceFix[2]
              ])}
              scale={[sirenScale, sirenScale, sirenScale]}
            >
              <group ref={sirenGroupRef}>
              {/* 1. Contoured Matte Black Anodized Flashback Housing */}
              <mesh position={[0, 0.003, 0.018]}>
                <boxGeometry args={[dims.width * 0.58, 0.024, 0.046]} />
                <meshStandardMaterial color="#09090b" roughness={0.65} metalness={0.4} />
              </mesh>

              {/* Top Rubber Windshield Gasket Seal */}
              <mesh position={[0, 0.014, 0.016]}>
                <boxGeometry args={[dims.width * 0.59, 0.005, 0.048]} />
                <meshStandardMaterial color="#18181b" roughness={0.9} metalness={0.05} />
              </mesh>

              {/* Center Rearview Mirror Cutout & Steel Bracket Arms */}
              <mesh position={[0, 0.018, 0.038]}>
                <boxGeometry args={[0.042, 0.028, 0.032]} />
                <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
              </mesh>
              <mesh position={[-dims.width * 0.16, 0.022, 0.024]}>
                <boxGeometry args={[0.014, 0.024, 0.026]} />
                <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
              </mesh>
              <mesh position={[dims.width * 0.16, 0.022, 0.024]}>
                <boxGeometry args={[0.014, 0.024, 0.026]} />
                <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
              </mesh>

              {/* LEFT WING: 4 Separate Faceted TIR3 LED Optical Pods */}
              {[-0.24, -0.18, -0.12, -0.06].map((xFrac, pIdx) => {
                const isPodLit = pIdx % 2 === 0 ? strobeState : !strobeState;
                const podColor = pIdx < 2 ? sirenColors.left : (sirenColorMode === 'red_blue' ? sirenColors.left : sirenColors.right);
                return (
                  <group key={`l_pod_${pIdx}`} position={[dims.width * xFrac, -0.002, 0]}>
                    {/* Pod Bezel Housing */}
                    <mesh position={[0, 0, 0.002]}>
                      <boxGeometry args={[dims.width * 0.052, 0.018, 0.02]} />
                      <meshStandardMaterial color="#09090b" roughness={0.5} metalness={0.5} />
                    </mesh>
                    {/* Authentic Whelen Fresnel Optic Lens Surface */}
                    <mesh position={[0, 0, -0.008]}>
                      <planeGeometry args={[dims.width * 0.048, 0.015]} />
                      <meshStandardMaterial
                        map={getProceduralFresnelOpticTexture(isPodLit, podColor)}
                        color={podColor}
                        emissive={podColor}
                        emissiveIntensity={isPodLit ? 2.1 : 0.35}
                        roughness={0.1}
                      />
                    </mesh>
                  </group>
                );
              })}

              {/* RIGHT WING: 4 Separate Faceted TIR3 LED Optical Pods */}
              {[0.06, 0.12, 0.18, 0.24].map((xFrac, pIdx) => {
                const isPodLit = pIdx % 2 === 0 ? !strobeState : strobeState;
                const podColor = pIdx >= 2 ? sirenColors.right : (sirenColorMode === 'red_blue' ? sirenColors.right : sirenColors.left);
                return (
                  <group key={`r_pod_${pIdx}`} position={[dims.width * xFrac, -0.002, 0]}>
                    <mesh position={[0, 0, 0.002]}>
                      <boxGeometry args={[dims.width * 0.052, 0.018, 0.02]} />
                      <meshStandardMaterial color="#09090b" roughness={0.5} metalness={0.5} />
                    </mesh>
                    <mesh position={[0, 0, -0.008]}>
                      <planeGeometry args={[dims.width * 0.048, 0.015]} />
                      <meshStandardMaterial
                        map={getProceduralFresnelOpticTexture(isPodLit, podColor)}
                        color={podColor}
                        emissive={podColor}
                        emissiveIntensity={isPodLit ? 2.1 : 0.35}
                        roughness={0.1}
                      />
                    </mesh>
                  </group>
                );
              })}

              {/* Visor Strobe Light Reflections */}
              {strobeState ? (
                <pointLight position={[-dims.width * 0.15, -0.02, -0.08]} intensity={0.55} distance={1.60} color={sirenColors.left} />
              ) : (
                <pointLight position={[dims.width * 0.15, -0.02, -0.08]} intensity={0.55} distance={1.60} color={sirenColors.right} />
              )}

              {/* Rear Window Deck Strobes — soft, no harsh flood behind the car */}
              <group position={[0, -0.04, dims.length * 0.42]} rotation={[-0.25, 0, 0]}>
                <mesh position={[-dims.width * 0.16, 0, 0]}>
                  <boxGeometry args={[dims.width * 0.12, 0.012, 0.018]} />
                  <meshStandardMaterial
                    map={getProceduralFresnelOpticTexture(strobeState, sirenColors.right)}
                    color={sirenColors.right}
                    emissive={sirenColors.right}
                    emissiveIntensity={strobeState ? 0.85 : 0.12}
                  />
                </mesh>
                <mesh position={[dims.width * 0.16, 0, 0]}>
                  <boxGeometry args={[dims.width * 0.12, 0.012, 0.018]} />
                  <meshStandardMaterial
                    map={getProceduralFresnelOpticTexture(!strobeState, sirenColors.left)}
                    color={sirenColors.left}
                    emissive={sirenColors.left}
                    emissiveIntensity={!strobeState ? 0.85 : 0.12}
                  />
                </mesh>
              </group>
              </group>
            </group>
          )}

          {/* ========================================================================= */}
          {/* STYLE 3: WHELEN LIBERTY II DUO ROOF LIGHTBAR (LCPDFR ULTRA-REALISTIC)      */}
          {/* ========================================================================= */}
          {effectiveSirenType === 'lightbar_led' && (
            <group
              name="lcpdfr_whelen_liberty2"
              position={sirenOuterPos(lightbarBase)}
              rotation={sirenOuterRot(sirenFaceFix)}
              scale={[sirenScale, sirenScale, sirenScale]}
            >
              <group ref={sirenGroupRef}>
              {/* Extruded Aluminum Base Channel */}
              <mesh position={[0, -0.008, 0]} castShadow>
                <boxGeometry args={[dims.width * 0.68, 0.018, 0.14]} />
                <meshStandardMaterial color="#09090b" roughness={0.4} metalness={0.9} />
              </mesh>
              {/* Roof Mounting Foot Brackets & Stainless Gutter Straps */}
              <mesh position={[-dims.width * 0.28, -0.022, 0]}>
                <boxGeometry args={[0.038, 0.038, 0.095]} />
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
              </mesh>
              <mesh position={[dims.width * 0.28, -0.022, 0]}>
                <boxGeometry args={[0.038, 0.038, 0.095]} />
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
              </mesh>

              {/* Clear Polycarbonate Aerodynamic Outer Dome */}
              <mesh position={[0, 0.016, 0]}>
                <boxGeometry args={[dims.width * 0.67, 0.032, 0.135]} />
                <meshPhysicalMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.35}
                  roughness={0.05}
                  transmission={0.88}
                  thickness={0.04}
                  envMapIntensity={2.0}
                />
              </mesh>

              {/* Internal Left Red/Blue Multi-Module Pack */}
              <mesh position={[-dims.width * 0.19, 0.012, 0]}>
                <boxGeometry args={[dims.width * 0.26, 0.024, 0.11]} />
                <meshStandardMaterial
                  map={getProceduralFresnelOpticTexture(strobeState, sirenColors.left)}
                  color={sirenColors.left}
                  emissive={sirenColors.left}
                  emissiveIntensity={strobeState ? 2.38 : 0.30}
                  roughness={0.1}
                />
              </mesh>
              {strobeState && (
                <pointLight position={[-dims.width * 0.24, 0.2, 0]} intensity={0.55} distance={1.60} color={sirenColors.left} />
              )}

              {/* Internal Right Red/Blue Multi-Module Pack */}
              <mesh position={[dims.width * 0.19, 0.012, 0]}>
                <boxGeometry args={[dims.width * 0.26, 0.024, 0.11]} />
                <meshStandardMaterial
                  map={getProceduralFresnelOpticTexture(!strobeState, sirenColors.right)}
                  color={sirenColors.right}
                  emissive={sirenColors.right}
                  emissiveIntensity={!strobeState ? 2.38 : 0.30}
                  roughness={0.1}
                />
              </mesh>
              {!strobeState && (
                <pointLight position={[dims.width * 0.24, 0.2, 0]} intensity={0.55} distance={1.60} color={sirenColors.right} />
              )}

              {/* Dual Center High-Power White LED Takedowns */}
              <mesh position={[-0.042, 0.012, -0.058]}>
                <boxGeometry args={[0.034, 0.018, 0.016]} />
                <meshStandardMaterial color="#f8fafc" emissive="#f8fafc" emissiveIntensity={1.4} />
              </mesh>
              <mesh position={[0.042, 0.012, -0.058]}>
                <boxGeometry args={[0.034, 0.018, 0.016]} />
                <meshStandardMaterial color="#f8fafc" emissive="#f8fafc" emissiveIntensity={1.4} />
              </mesh>

              {/* Side Alley Lights */}
              <mesh position={[-dims.width * 0.33, 0.012, 0]}>
                <boxGeometry args={[0.01, 0.018, 0.05]} />
                <meshStandardMaterial color="#f8fafc" emissive="#f8fafc" emissiveIntensity={1.1} />
              </mesh>
              <mesh position={[dims.width * 0.33, 0.012, 0]}>
                <boxGeometry args={[0.01, 0.018, 0.05]} />
                <meshStandardMaterial color="#f8fafc" emissive="#f8fafc" emissiveIntensity={1.1} />
              </mesh>
              </group>
            </group>
          )}

          {/* ========================================================================= */}
          {/* STYLE 4: FEDERAL SIGNAL VALOR V-SHAPE ROOF LIGHTBAR (LCPDFR 360 DEGREE)   */}
          {/* ========================================================================= */}
          {effectiveSirenType === 'valor_vshape' && (
            <group
              name="lcpdfr_federal_valor"
              position={sirenOuterPos(lightbarBase)}
              rotation={sirenOuterRot(sirenFaceFix)}
              scale={[sirenScale, sirenScale, sirenScale]}
            >
              <group ref={sirenGroupRef}>
              {/* Left V-Wing (Angled forward) */}
              <group position={[-dims.width * 0.16, 0.012, -0.018]} rotation={[0, -0.16, 0]}>
                <mesh>
                  <boxGeometry args={[dims.width * 0.34, 0.026, 0.11]} />
                  <meshStandardMaterial
                    map={getProceduralFresnelOpticTexture(strobeState, sirenColors.left)}
                    color={sirenColors.left}
                    emissive={sirenColors.left}
                    emissiveIntensity={strobeState ? 2.27 : 0.30}
                  />
                </mesh>
              </group>
              {/* Right V-Wing (Angled forward) */}
              <group position={[dims.width * 0.16, 0.012, -0.018]} rotation={[0, 0.16, 0]}>
                <mesh>
                  <boxGeometry args={[dims.width * 0.34, 0.026, 0.11]} />
                  <meshStandardMaterial
                    map={getProceduralFresnelOpticTexture(!strobeState, sirenColors.right)}
                    color={sirenColors.right}
                    emissive={sirenColors.right}
                    emissiveIntensity={!strobeState ? 2.27 : 0.30}
                  />
                </mesh>
              </group>
              {strobeState ? (
                <pointLight position={[-dims.width * 0.22, 0.18, 0]} intensity={0.55} distance={1.60} color={sirenColors.left} />
              ) : (
                <pointLight position={[dims.width * 0.22, 0.18, 0]} intensity={0.55} distance={1.60} color={sirenColors.right} />
              )}
              </group>
            </group>
          )}

          {/* ========================================================================= */}
          {/* STYLE 5: FEDERAL SIGNAL VIPER S2 DASH LIGHT (LCPDFR DASH-MOUNT STROBE)    */}
          {/* ========================================================================= */}
          {effectiveSirenType === 'viper_s2' && (
            <group
              name="lcpdfr_viper_s2"
              position={sirenOuterPos(anchors.dashViper?.pos || [0, dims.height * 0.52, -dims.length * 0.12])}
              rotation={sirenOuterRot([
                (anchors.dashViper?.rot?.[0] ?? 0.35) + sirenFaceFix[0],
                (anchors.dashViper?.rot?.[1] ?? 0) + sirenFaceFix[1],
                (anchors.dashViper?.rot?.[2] ?? 0) + sirenFaceFix[2]
              ])}
              scale={[sirenScale, sirenScale, sirenScale]}
            >
              <group ref={sirenGroupRef}>
              {/* Curved Flashback Hood */}
              <mesh position={[0, 0.008, 0]}>
                <boxGeometry args={[0.13, 0.028, 0.055]} />
                <meshStandardMaterial color="#09090b" roughness={0.7} metalness={0.3} />
              </mesh>
              {/* Dual Silicone Suction Cups */}
              <mesh position={[-0.048, 0.018, -0.028]}>
                <cylinderGeometry args={[0.014, 0.014, 0.004, 16]} />
                <meshStandardMaterial color="#38bdf8" transparent opacity={0.5} />
              </mesh>
              <mesh position={[0.048, 0.018, -0.028]}>
                <cylinderGeometry args={[0.014, 0.014, 0.004, 16]} />
                <meshStandardMaterial color="#38bdf8" transparent opacity={0.5} />
              </mesh>
              {/* Left Pod */}
              <mesh position={[-0.032, 0, -0.024]}>
                <boxGeometry args={[0.048, 0.018, 0.012]} />
                <meshStandardMaterial
                  map={getProceduralFresnelOpticTexture(strobeState, sirenColors.left)}
                  color={sirenColors.left}
                  emissive={sirenColors.left}
                  emissiveIntensity={strobeState ? 2.10 : 0.30}
                />
              </mesh>
              {/* Right Pod */}
              <mesh position={[0.032, 0, -0.024]}>
                <boxGeometry args={[0.048, 0.018, 0.012]} />
                <meshStandardMaterial
                  map={getProceduralFresnelOpticTexture(!strobeState, sirenColors.right)}
                  color={sirenColors.right}
                  emissive={sirenColors.right}
                  emissiveIntensity={!strobeState ? 2.10 : 0.30}
                />
              </mesh>
              {strobeState ? (
                <pointLight position={[-0.04, 0.02, -0.06]} intensity={0.55} distance={1.60} color={sirenColors.left} />
              ) : (
                <pointLight position={[0.04, 0.02, -0.06]} intensity={0.55} distance={1.60} color={sirenColors.right} />
              )}
              </group>
            </group>
          )}

          {/* ========================================================================= */}
          {/* STYLE 6: WHELEN L31 LED SINGLE ROOF BEACON (ونان مغناطيسي فردي على السقف)  */}
          {/* ========================================================================= */}
          {effectiveSirenType === 'roof_single_beacon' && (
            <group
              name="lcpdfr_whelen_l31_beacon"
              position={sirenOuterPos(beaconBase)}
              rotation={sirenOuterRot(sirenFaceFix)}
              scale={[sirenScale, sirenScale, sirenScale]}
            >
              <group ref={sirenGroupRef}>
              {/* Magnetic Rubber Base */}
              <mesh position={[0, -0.022, 0]}>
                <cylinderGeometry args={[0.055, 0.065, 0.018, 24]} />
                <meshStandardMaterial color="#09090b" metalness={0.8} roughness={0.3} />
              </mesh>
              {/* Glowing Strobe Dome */}
              <mesh position={[0, 0.012, 0]}>
                <cylinderGeometry args={[0.042, 0.052, 0.062, 24]} />
                <meshStandardMaterial
                  map={getProceduralFresnelOpticTexture(true, strobeState ? sirenColors.left : sirenColors.right)}
                  color={strobeState ? sirenColors.left : sirenColors.right}
                  emissive={strobeState ? sirenColors.left : sirenColors.right}
                  emissiveIntensity={2.0}
                  roughness={0.1}
                />
              </mesh>
              <pointLight
                position={[0, 0.12, 0]}
                intensity={0.45}
                distance={1.4}
                color={strobeState ? sirenColors.left : sirenColors.right}
              />
              </group>
            </group>
          )}

          {/* ========================================================================= */}
          {/* STYLE 7: CLASSIC DUAL ROTARY BEACON BAR (ونان كشافات دائرية كلاسيك)        */}
          {/* ========================================================================= */}
          {effectiveSirenType === 'beacon_classic' && (
            <group
              name="lcpdfr_aerodynic_classic"
              position={sirenOuterPos(lightbarBase)}
              rotation={sirenOuterRot(sirenFaceFix)}
              scale={[sirenScale, sirenScale, sirenScale]}
            >
              <group ref={sirenGroupRef}>
              <mesh>
                <boxGeometry args={[dims.width * 0.62, 0.022, 0.08]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
              </mesh>
              <mesh position={[0, 0.036, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.048, 0.032, 0.11, 20]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.12} />
              </mesh>
              <mesh position={[-dims.width * 0.21, 0.042, 0]}>
                <cylinderGeometry args={[0.048, 0.06, 0.068, 24]} />
                <meshStandardMaterial
                  color={sirenColors.left}
                  emissive={sirenColors.left}
                  emissiveIntensity={strobeState ? 1.82 : 0.35}
                  roughness={0.1}
                />
              </mesh>
              <mesh position={[dims.width * 0.21, 0.042, 0]}>
                <cylinderGeometry args={[0.048, 0.06, 0.068, 24]} />
                <meshStandardMaterial
                  color={sirenColors.right}
                  emissive={sirenColors.right}
                  emissiveIntensity={!strobeState ? 1.82 : 0.35}
                  roughness={0.1}
                />
              </mesh>
              <pointLight
                position={[strobeState ? -0.25 : 0.25, 0.16, 0]}
                intensity={0.45}
                distance={1.4}
                color={strobeState ? sirenColors.left : sirenColors.right}
              />
              </group>
            </group>
          )}

          {/* STYLE: SOUNDOFF ION + FRONT LICENSE PLATE MOUNT (LCPDFR 48277) */}
          {effectiveSirenType === 'soundoff_ion' && (
            <group
              name="lcpdfr_soundoff_ion_plate"
              position={sirenOuterPos(bumperLive)}
              rotation={sirenOuterRot(anchors.frontGrille?.rot || [0.08, Math.PI, 0])}
              scale={[sirenScale, sirenScale, sirenScale]}
            >
              <group ref={sirenGroupRef}>
              {/* License plate mount housing */}
              <mesh position={[0, -0.01, 0.012]} castShadow>
                <boxGeometry args={[0.36, 0.11, 0.028]} />
                <meshStandardMaterial color="#0f172a" metalness={0.75} roughness={0.35} />
              </mesh>
              {/* Dual SoundOff Ion pods flanking plate — sit on the bumper, facing out */}
              {[-0.22, 0.22].map((x, i) => (
                <group key={`ion_${i}`} position={[x, 0.01, 0.025]}>
                  <mesh castShadow>
                    <boxGeometry args={[0.055, 0.028, 0.04]} />
                    <meshStandardMaterial color="#111827" metalness={0.85} roughness={0.25} />
                  </mesh>
                  <mesh position={[0, 0, 0.022]}>
                    <boxGeometry args={[0.048, 0.02, 0.01]} />
                    <meshStandardMaterial
                      map={getProceduralFresnelOpticTexture(i === 0 ? strobeState : !strobeState, i === 0 ? sirenColors.left : sirenColors.right)}
                      color={i === 0 ? sirenColors.left : sirenColors.right}
                      emissive={i === 0 ? sirenColors.left : sirenColors.right}
                      emissiveIntensity={(i === 0 ? strobeState : !strobeState) ? 2.1 : 0.35}
                    />
                  </mesh>
                  <pointLight
                    position={[0, 0, 0.08]}
                    intensity={(i === 0 ? strobeState : !strobeState) ? 0.5 : 0.15}
                    distance={1.2}
                    color={i === 0 ? sirenColors.left : sirenColors.right}
                  />
                </group>
              ))}
              </group>
            </group>
          )}

          {/* STYLE: CUSTOM UPLOADED LCPDFR PROP (.OBJ / .YFT / .ZIP) */}
          {effectiveSirenType === 'custom_obj' && customLightbarObj && (
            <group
              name="lcpdfr_custom_uploaded_prop"
              position={sirenOuterPos(lightbarBase)}
              rotation={sirenOuterRot(sirenFaceFix)}
              scale={[sirenScale, sirenScale, sirenScale]}
            >
              <group ref={sirenGroupRef}>
                <primitive object={customLightbarObj} />
                <pointLight
                  position={[0, 0.12, 0]}
                  intensity={strobeState ? 0.9 : 0.35}
                  distance={2.45}
                  color={strobeState ? sirenColors.left : sirenColors.right}
                />
              </group>
            </group>
          )}

          {/* FRONT GRILLE FLUSH STROBES (Active on all police setups when showGrilleStrobes is enabled) */}
          {showGrilleStrobes && effectiveSirenType !== 'hideaway_vertex' && effectiveSirenType !== 'soundoff_ion' && (
            <group position={[grilleLive[0], grilleLive[1], grilleLive[2]]}>
              <mesh position={[-dims.width * 0.13, 0, 0]}>
                <boxGeometry args={[0.042, 0.012, 0.008]} />
                <meshStandardMaterial
                  map={getProceduralFresnelOpticTexture(strobeState, sirenColors.left)}
                  color={sirenColors.left}
                  emissive={sirenColors.left}
                  emissiveIntensity={strobeState ? 1.92 : 0.25}
                />
              </mesh>
              <mesh position={[dims.width * 0.13, 0, 0]}>
                <boxGeometry args={[0.042, 0.012, 0.008]} />
                <meshStandardMaterial
                  map={getProceduralFresnelOpticTexture(!strobeState, sirenColors.right)}
                  color={sirenColors.right}
                  emissive={sirenColors.right}
                  emissiveIntensity={!strobeState ? 1.92 : 0.25}
                />
              </mesh>
            </group>
          )}
        </group>
      )}

      {/* 4. AUTHENTIC SETINA PB-400 POLICE PUSHBAR WITH 4 INTEGRATED LED WARNING PODS */}
      {effectivePushbar && (() => {
        const uprightSpacing = Math.min(dims.width * 0.22, 0.44);
        const pbY = dims.height * 0.33;
        const pbZ = frontZ - 0.04;
        const setinaTex = getProceduralSetinaLogoTexture();

        // 4 Multi-Color Warning Strobe Pods (White, Blue, Red, Amber/Yellow)
        // Matches exact LCPDFR dev-resource specification
        const podSpecs = [
          {
            id: 'pod_0_white',
            x: -uprightSpacing * 0.62,
            color: '#ffffff',
            lit: strobeState
          },
          {
            id: 'pod_1_blue',
            x: -uprightSpacing * 0.21,
            color: sirenColors.left || '#38bdf8',
            lit: strobeState
          },
          {
            id: 'pod_2_red',
            x: uprightSpacing * 0.21,
            color: sirenColors.right || '#ef4444',
            lit: !strobeState
          },
          {
            id: 'pod_3_amber',
            x: uprightSpacing * 0.62,
            color: '#f59e0b',
            lit: !strobeState
          }
        ];

        return (
          <group name="setina_pb400_police_pushbar" position={[0, pbY, pbZ]}>
            {/* --- A. Left & Right Heavy-Duty Steel Upright Blades --- */}
            {[-uprightSpacing, uprightSpacing].map((ux, idx) => (
              <group key={`upright_${idx}`} position={[ux, 0, 0]}>
                {/* Steel Core Blade */}
                <mesh position={[0, 0, 0]} castShadow>
                  <boxGeometry args={[0.024, 0.36, 0.075]} />
                  <meshStandardMaterial color="#0a0a0c" metalness={0.92} roughness={0.2} />
                </mesh>
                {/* Thick Front Rubber Push Cushion Strip (Extruded Rubber Bumper) */}
                <mesh position={[0, 0, -0.042]} castShadow>
                  <boxGeometry args={[0.038, 0.36, 0.022]} />
                  <meshStandardMaterial color="#14171f" roughness={0.94} metalness={0.06} />
                </mesh>
                {/* Chassis Gusset Mounting Bracket reaching into car bumper */}
                <mesh position={[0, -0.08, 0.07]} rotation={[0.05, 0, 0]} castShadow>
                  <boxGeometry args={[0.02, 0.05, 0.12]} />
                  <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
                </mesh>
              </group>
            ))}

            {/* --- B. Top Cylindrical Crossbar Tube --- */}
            <mesh position={[0, 0.125, -0.008]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.016, 0.016, uprightSpacing * 2, 24]} />
              <meshStandardMaterial color="#09090b" metalness={0.92} roughness={0.22} />
            </mesh>

            {/* --- C. SETINA Brand Nameplate (Embossed Center Medallion) --- */}
            <group position={[0, 0.125, -0.024]}>
              <mesh castShadow>
                <boxGeometry args={[0.096, 0.026, 0.006]} />
                <meshStandardMaterial color="#090d16" metalness={0.88} roughness={0.25} />
              </mesh>
              {setinaTex && (
                <mesh position={[0, 0, -0.0035]} rotation={[0, Math.PI, 0]}>
                  <planeGeometry args={[0.092, 0.024]} />
                  <meshBasicMaterial map={setinaTex} transparent side={THREE.DoubleSide} />
                </mesh>
              )}
            </group>

            {/* --- D. Center Equipment Crossbar (Houses the 4 LED Warning Pods) --- */}
            <mesh position={[0, 0.01, -0.012]} castShadow>
              <boxGeometry args={[uprightSpacing * 2, 0.046, 0.036]} />
              <meshStandardMaterial color="#09090b" metalness={0.92} roughness={0.22} />
            </mesh>

            {/* --- E. Lower Radiator Crossmember Tube --- */}
            <mesh position={[0, -0.11, -0.008]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.014, 0.014, uprightSpacing * 2, 24]} />
              <meshStandardMaterial color="#09090b" metalness={0.92} roughness={0.22} />
            </mesh>

            {/* --- F. 4 Integrated Warning LED Modules (White, Blue, Red, Amber) --- */}
            {podSpecs.map((pod) => (
              <group key={pod.id} position={[pod.x, 0.01, -0.032]}>
                {/* Black Die-Cast Aluminum Bezel Housing */}
                <mesh castShadow>
                  <boxGeometry args={[0.062, 0.028, 0.02]} />
                  <meshStandardMaterial color="#05070f" metalness={0.95} roughness={0.2} />
                </mesh>
                {/* Fresnel Optical Warning Flasher Lens facing front (-Z) */}
                <mesh position={[0, 0, -0.011]} rotation={[0, Math.PI, 0]}>
                  <planeGeometry args={[0.054, 0.022]} />
                  <meshStandardMaterial
                    map={getProceduralFresnelOpticTexture(pod.lit, pod.color)}
                    color={pod.color}
                    emissive={pod.color}
                    emissiveIntensity={pod.lit ? 2.6 : 0.25}
                    roughness={0.12}
                    metalness={0.1}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                {/* Forward-Facing Road Illumination Strobe Light */}
                {pod.lit && (
                  <pointLight
                    position={[0, 0, -0.10]}
                    intensity={0.65}
                    distance={2.4}
                    color={pod.color}
                  />
                )}
              </group>
            ))}

            {/* --- G. Headlight Wrap-Around Protector Wings (PB-9 Style Wraps) --- */}
            {/* Left Wing Wrap */}
            <group position={[-uprightSpacing, 0, 0]}>
              {/* Upper tube wrapping headlight horizontally */}
              <mesh position={[-dims.width * 0.11, 0.085, 0.03]} rotation={[0, -0.28, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.012, 0.012, dims.width * 0.23, 16]} />
                <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.25} />
              </mesh>
              {/* Lower tube wrapping headlight horizontally */}
              <mesh position={[-dims.width * 0.11, -0.065, 0.03]} rotation={[0, -0.28, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.012, 0.012, dims.width * 0.23, 16]} />
                <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.25} />
              </mesh>
              {/* Outer vertical connector */}
              <mesh position={[-dims.width * 0.22, 0.01, 0.06]} castShadow>
                <cylinderGeometry args={[0.012, 0.012, 0.16, 16]} />
                <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.25} />
              </mesh>
            </group>

            {/* Right Wing Wrap (Perfect Geometric Mirror of Left Wrap) */}
            <group position={[uprightSpacing, 0, 0]} scale={[-1, 1, 1]}>
              {/* Upper tube wrapping headlight horizontally */}
              <mesh position={[-dims.width * 0.11, 0.085, 0.03]} rotation={[0, -0.28, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.012, 0.012, dims.width * 0.23, 16]} />
                <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.25} />
              </mesh>
              {/* Lower tube wrapping headlight horizontally */}
              <mesh position={[-dims.width * 0.11, -0.065, 0.03]} rotation={[0, -0.28, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.012, 0.012, dims.width * 0.23, 16]} />
                <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.25} />
              </mesh>
              {/* Outer vertical connector */}
              <mesh position={[-dims.width * 0.22, 0.01, 0.06]} castShadow>
                <cylinderGeometry args={[0.012, 0.012, 0.16, 16]} />
                <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.25} />
              </mesh>
            </group>
          </group>
        );
      })()}

      {/* 5. Xenon Headlight Illumination */}
      {headlightsOn && (
        <group position={[0, dims.height * 0.38, frontZ - 0.05]}>
          <pointLight position={[-dims.width * 0.35, 0, -0.15]} intensity={0.55} distance={1.60} color="#38bdf8" />
          <pointLight position={[dims.width * 0.35, 0, -0.15]} intensity={0.55} distance={1.60} color="#38bdf8" />
        </group>
      )}

      {/* 6. Neon Underglow Kit */}
      {underglowOn && (
        <group position={[0, 0.02, 0]}>
          <pointLight position={[0, 0.05, 0]} intensity={1.8} distance={2.5} color={underglowColor} />
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[dims.width * 0.9, dims.length * 0.82]} />
            <meshBasicMaterial color={underglowColor} transparent opacity={0.42} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}


