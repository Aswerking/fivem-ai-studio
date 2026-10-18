import React, { useMemo } from 'react';
import * as THREE from 'three';

export default function RealisticGtaWeapon({
  camoSkin = 'gold_24k',
  weaponModel = 'carbine_rifle'
}) {
  // Camo & Finish Material
  const camoMaterial = useMemo(() => {
    if (camoSkin === 'gold_24k') {
      return new THREE.MeshStandardMaterial({
        color: '#f59e0b',
        metalness: 0.95,
        roughness: 0.15,
        envMapIntensity: 1.5
      });
    }
    if (camoSkin === 'damascus') {
      return new THREE.MeshStandardMaterial({
        color: '#64748b',
        metalness: 0.88,
        roughness: 0.25
      });
    }
    if (camoSkin === 'red_tiger') {
      return new THREE.MeshStandardMaterial({
        color: '#dc2626',
        metalness: 0.6,
        roughness: 0.35
      });
    }
    return new THREE.MeshStandardMaterial({
      color: '#334155',
      metalness: 0.5,
      roughness: 0.4
    });
  }, [camoSkin]);

  const polymerBlack = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#0f172a',
    metalness: 0.3,
    roughness: 0.7
  }), []);

  const steelBlack = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#18181b',
    metalness: 0.9,
    roughness: 0.3
  }), []);

  return (
    <group name="realistic_gta_weapon" position={[0, 0.1, 0]} rotation={[0, Math.PI / 4, 0]}>
      {/* 1. Upper & Lower Receiver */}
      <mesh position={[0, 0, 0]} castShadow material={camoMaterial}>
        <boxGeometry args={[0.7, 0.18, 0.09]} />
      </mesh>

      {/* 2. Tactical Handguard with Picatinny Rails */}
      <mesh position={[0.55, 0.02, 0]} castShadow material={camoMaterial}>
        <boxGeometry args={[0.55, 0.14, 0.08]} />
      </mesh>
      {/* Top Rail */}
      <mesh position={[0.3, 0.11, 0]} material={steelBlack}>
        <boxGeometry args={[0.95, 0.03, 0.05]} />
      </mesh>

      {/* 3. Barrel & Flash Hider */}
      <mesh position={[0.95, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow material={steelBlack}>
        <cylinderGeometry args={[0.025, 0.025, 0.35, 16]} />
      </mesh>
      <mesh position={[1.14, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={steelBlack}>
        <cylinderGeometry args={[0.032, 0.028, 0.08, 12]} />
      </mesh>

      {/* 4. STANAG Curved Magazine */}
      <group position={[0.08, -0.20, 0]} rotation={[0, 0, 0.2]}>
        <mesh castShadow material={polymerBlack}>
          <boxGeometry args={[0.14, 0.32, 0.065]} />
        </mesh>
      </group>

      {/* 5. Pistol Grip */}
      <group position={[-0.22, -0.16, 0]} rotation={[0, 0, -0.45]}>
        <mesh castShadow material={polymerBlack}>
          <boxGeometry args={[0.09, 0.26, 0.06]} />
        </mesh>
      </group>

      {/* 6. Buffer Tube & Stock */}
      <mesh position={[-0.52, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={steelBlack}>
        <cylinderGeometry args={[0.03, 0.03, 0.42, 16]} />
      </mesh>
      <group position={[-0.68, -0.04, 0]}>
        <mesh castShadow material={camoMaterial}>
          <boxGeometry args={[0.26, 0.22, 0.075]} />
        </mesh>
        <mesh position={[-0.14, 0, 0]} material={polymerBlack}>
          <boxGeometry args={[0.025, 0.24, 0.08]} />
        </mesh>
      </group>

      {/* 7. Holographic Sight */}
      <group position={[0.1, 0.16, 0]}>
        <mesh material={steelBlack}>
          <boxGeometry args={[0.22, 0.09, 0.07]} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </group>
    </group>
  );
}
