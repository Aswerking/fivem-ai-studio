import React, { useMemo } from 'react';
import * as THREE from 'three';

export default function RealisticGtaChain({
  chainType = 'cuban_12mm',
  chainMetal = 'gold_24k',
  pendantText = 'LOS SANTOS',
  diamondGlow = true
}) {
  const isHeavy = chainType.includes('12mm');

  const metalMaterial = useMemo(() => {
    let color = '#f59e0b';
    if (chainMetal === 'silver_925') color = '#e2e8f0';
    if (chainMetal === 'rose_gold') color = '#fb7185';

    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.98,
      roughness: 0.12,
      envMapIntensity: 1.8
    });
  }, [chainMetal]);

  const diamondMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: diamondGlow ? '#38bdf8' : '#000000',
    emissiveIntensity: diamondGlow ? 0.6 : 0,
    metalness: 0.95,
    roughness: 0.05
  }), [diamondGlow]);

  const links = useMemo(() => {
    const list = [];
    const count = 38;
    const radiusX = 0.38;
    const radiusZ = 0.32;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.sin(angle) * radiusX;
      const z = Math.cos(angle) * radiusZ;
      const y = Math.sin(angle * 2) * 0.04 - (z > 0 ? 0.08 : 0);
      list.push({ x, y, z, rotY: -angle, rotZ: i % 2 === 0 ? 0.3 : -0.3 });
    }
    return list;
  }, []);

  return (
    <group name="realistic_gta_chain" position={[0, 0.4, 0]}>
      {/* 1. Chain Links Curve */}
      {links.map((lnk, idx) => (
        <group key={idx} position={[lnk.x, lnk.y, lnk.z]} rotation={[0, lnk.rotY, lnk.rotZ]}>
          <mesh castShadow material={metalMaterial}>
            <torusGeometry args={[isHeavy ? 0.038 : 0.026, isHeavy ? 0.014 : 0.009, 12, 20]} />
          </mesh>
          {diamondGlow && (
            <mesh position={[0, 0.02, 0]} material={diamondMaterial}>
              <sphereGeometry args={[isHeavy ? 0.008 : 0.005, 6, 6]} />
            </mesh>
          )}
        </group>
      ))}

      {/* 2. Center Bail */}
      <mesh position={[0, -0.09, 0.34]} material={metalMaterial}>
        <cylinderGeometry args={[0.028, 0.028, 0.04, 16]} />
      </mesh>

      {/* 3. 3D Iced-Out Custom Pendant */}
      <group position={[0, -0.22, 0.35]}>
        <mesh castShadow material={metalMaterial}>
          <boxGeometry args={[0.34, 0.18, 0.04]} />
        </mesh>

        {diamondGlow && (
          <mesh position={[0, 0, 0.025]} material={diamondMaterial}>
            <boxGeometry args={[0.36, 0.20, 0.01]} />
          </mesh>
        )}

        <mesh position={[0, 0, 0.032]}>
          <boxGeometry args={[0.31, 0.15, 0.015]} />
          <meshStandardMaterial color="#09090b" roughness={0.7} />
        </mesh>

        <group position={[0, 0, 0.045]}>
          <mesh material={metalMaterial}>
            <boxGeometry args={[0.26, 0.08, 0.012]} />
          </mesh>
          {diamondGlow && (
            <mesh position={[0, 0, 0.008]} material={diamondMaterial}>
              <sphereGeometry args={[0.012, 8, 8]} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}
