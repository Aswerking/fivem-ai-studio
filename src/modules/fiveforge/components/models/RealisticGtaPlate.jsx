import React, { useMemo } from 'react';
import * as THREE from 'three';

export default function RealisticGtaPlate({
  plateText = 'SAN FIERRO',
  stateBanner = 'SAN ANDREAS',
  plateColor = 'blue'
}) {
  const plateMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: plateColor === 'black' ? '#09090b' : (plateColor === 'yellow' ? '#fef08a' : '#f8fafc'),
    metalness: 0.85,
    roughness: 0.25
  }), [plateColor]);

  const embossedMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: plateColor === 'black' ? '#f59e0b' : '#0369a1',
    metalness: 0.6,
    roughness: 0.3
  }), [plateColor]);

  const screwMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    metalness: 0.95,
    roughness: 0.1
  }), []);

  return (
    <group name="realistic_gta_plate" position={[0, 0.35, 0]}>
      {/* 1. Main Plate */}
      <mesh castShadow receiveShadow material={plateMaterial}>
        <boxGeometry args={[1.2, 0.62, 0.02]} />
      </mesh>

      {/* 2. Raised Border */}
      <mesh position={[0, 0, 0.012]} material={embossedMaterial}>
        <boxGeometry args={[1.16, 0.58, 0.01]} />
      </mesh>
      <mesh position={[0, 0, 0.018]} material={plateMaterial}>
        <boxGeometry args={[1.12, 0.54, 0.008]} />
      </mesh>

      {/* 3. State Banner Header */}
      <mesh position={[0, 0.20, 0.024]} material={embossedMaterial}>
        <boxGeometry args={[0.55, 0.06, 0.008]} />
      </mesh>

      {/* 4. Embossed 3D Plate Number Blocks */}
      <group position={[0, -0.02, 0.026]}>
        {[-0.32, -0.19, -0.06, 0.06, 0.19, 0.32].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]} castShadow material={embossedMaterial}>
            <boxGeometry args={[0.09, 0.22, 0.014]} />
          </mesh>
        ))}
      </group>

      {/* 5. 4 Corner Screws */}
      {[
        [-0.48, 0.22],
        [0.48, 0.22],
        [-0.48, -0.22],
        [0.48, -0.22]
      ].map(([x, y], idx) => (
        <group key={idx} position={[x, y, 0.018]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={screwMaterial}>
            <cylinderGeometry args={[0.022, 0.022, 0.015, 16]} />
          </mesh>
          <mesh position={[0, 0, 0.009]}>
            <boxGeometry args={[0.02, 0.004, 0.004]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
        </group>
      ))}

      {/* 6. Expiration Validation Decal */}
      <mesh position={[0.42, 0.20, 0.024]}>
        <boxGeometry args={[0.08, 0.06, 0.006]} />
        <meshStandardMaterial color="#dc2626" roughness={0.4} />
      </mesh>
    </group>
  );
}
