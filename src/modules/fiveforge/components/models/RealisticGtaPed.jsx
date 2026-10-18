import React, { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

let cachedPedGltf = null;
let cachedPromise = null;

function loadBasePed() {
  if (cachedPedGltf) {
    return Promise.resolve(SkeletonUtils.clone(cachedPedGltf.scene));
  }
  if (cachedPromise) {
    return cachedPromise.then(scene => SkeletonUtils.clone(scene));
  }
  const loader = new GLTFLoader();
  cachedPromise = new Promise((resolve) => {
    // Try ped_textured.glb first, fallback to ped.glb
    loader.load(
      '/models/ped_textured.glb',
      (gltf) => {
        cachedPedGltf = gltf;
        resolve(SkeletonUtils.clone(gltf.scene));
      },
      undefined,
      () => {
        loader.load(
          '/models/ped.glb',
          (gltf2) => {
            cachedPedGltf = gltf2;
            resolve(SkeletonUtils.clone(gltf2.scene));
          },
          undefined,
          () => resolve(null)
        );
      }
    );
  });
  return cachedPromise;
}

export default function RealisticGtaPed({
  skinColor = '#ffffff',
  tattooPreset = 0,
  toolId = 'clothing_textures'
}) {
  const [pedScene, setPedScene] = useState(null);

  useEffect(() => {
    let active = true;
    loadBasePed().then(scene => {
      if (active && scene) {
        scene.position.set(0, -0.9, 0);
        scene.scale.set(1.0, 1.0, 1.0);
        scene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.roughness = 0.6;
              child.material.metalness = 0.05;
            }
          }
        });
        setPedScene(scene);
      }
    });
    return () => { active = false; };
  }, []);

  if (!pedScene) {
    // Elegant fallback avatar silhouette while loading
    return (
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.6, 0]}>
          <capsuleGeometry args={[0.22, 0.8, 16, 32]} />
          <meshStandardMaterial color="#334155" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <sphereGeometry args={[0.15, 24, 24]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
        </mesh>
      </group>
    );
  }

  return (
    <primitive object={pedScene} />
  );
}
