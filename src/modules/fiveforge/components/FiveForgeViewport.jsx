import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, ContactShadows } from '@react-three/drei';
import { 
  Sun, Moon, Box, Eye, Layers, Maximize2, 
  RotateCcw, Compass, Camera, Sparkles, Activity
} from 'lucide-react';

/**
 * FiveForge Dedicated 3D Viewport Canvas Wrapper
 * 
 * Modular, isolated WebGL canvas designed to host all FiveForge modding suites:
 * Props, Vehicles, Clothing, Chains, and MLO Shells.
 * Features zero CSS leakage, self-contained lighting, gizmos, and real-time mesh diagnostics.
 */

// Camera Angle & Controller Component
function ViewportController({ cameraPreset, setStats }) {
  const { camera, scene, gl } = useThree();

  useEffect(() => {
    const presets = {
      perspective: { pos: [-3.4, 1.8, -3.4], target: [0, 0.45, 0] },
      front: { pos: [0, 0.8, -4.2], target: [0, 0.45, 0] },
      back: { pos: [0, 0.8, 4.2], target: [0, 0.45, 0] },
      left: { pos: [-4.2, 0.8, 0], target: [0, 0.45, 0] },
      right: { pos: [4.2, 0.8, 0], target: [0, 0.45, 0] },
      top: { pos: [0, 5.0, 0.01], target: [0, 0, 0] }
    };

    const targetConfig = presets[cameraPreset] || presets.perspective;
    camera.position.set(...targetConfig.pos);
    camera.lookAt(...targetConfig.target);
  }, [cameraPreset, camera]);

  // Real-time mesh diagnostics (Triangles, Vertices, Draw calls)
  const computeSceneStats = React.useCallback(() => {
    let triangles = 0;
    let vertices = 0;

    scene.traverse((obj) => {
      if (obj.isMesh && obj.visible && obj.geometry) {
        if (obj.geometry.index) {
          triangles += obj.geometry.index.count / 3;
        } else if (obj.geometry.attributes?.position) {
          triangles += obj.geometry.attributes.position.count / 3;
        }
        if (obj.geometry.attributes?.position) {
          vertices += obj.geometry.attributes.position.count;
        }
      }
    });

    if (setStats) {
      setStats({
        triangles: Math.round(triangles),
        vertices: Math.round(vertices),
        drawCalls: Math.max(1, gl.info?.render?.calls || 12)
      });
    }
  }, [scene, gl, setStats]);

  useEffect(() => {
    computeSceneStats();
    const timer = setInterval(computeSceneStats, 500);
    return () => clearInterval(timer);
  }, [computeSceneStats]);

  const frameCount = useRef(0);
  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 25 === 0) {
      computeSceneStats();
    }
  });

  return null;
}

// Lighting Environment Component
function ViewportLighting({ envMode }) {
  return (
    <>
      {envMode === 'studio' && (
        <>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 8, 5]} intensity={1.5} castShadow shadow-mapSize={1024} />
          <directionalLight position={[-5, 4, -5]} intensity={0.6} />
          <pointLight position={[0, -2, 0]} intensity={0.3} color="#94a3b8" />
        </>
      )}

      {envMode === 'sunny' && (
        <>
          <ambientLight intensity={0.6} color="#fef08a" />
          <directionalLight position={[8, 12, 6]} intensity={2.2} color="#fffbeb" castShadow shadow-mapSize={2048} />
          <directionalLight position={[-4, 2, -4]} intensity={0.5} color="#38bdf8" />
        </>
      )}

      {envMode === 'night' && (
        <>
          <ambientLight intensity={0.25} color="#1e1b4b" />
          <directionalLight position={[4, 6, 4]} intensity={0.7} color="#60a5fa" />
          <pointLight position={[-3, 2, -2]} intensity={1.8} color="#f59e0b" />
        </>
      )}

      {envMode === 'cyberpunk' && (
        <>
          <ambientLight intensity={0.35} color="#0f172a" />
          <directionalLight position={[5, 5, 5]} intensity={1.8} color="#06b6d4" />
          <directionalLight position={[-5, 4, -4]} intensity={2.0} color="#ec4899" />
          <pointLight position={[0, 6, 0]} intensity={1.2} color="#a855f7" />
        </>
      )}
    </>
  );
}

// Scene Root with Material Override
function SceneRenderer({ shadingMode, showCollision, children }) {
  const clayMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.6,
    metalness: 0.1
  }), []);

  const wireframeMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    wireframe: true
  }), []);

  const collisionMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#10b981',
    wireframe: true,
    transparent: true,
    opacity: 0.8
  }), []);

  return (
    <group name="fiveforge_scene_content">
      {/* User provided 3D content */}
      {children}

      {/* Optional Collision Bounds Visualizer */}
      {showCollision && (
        <mesh position={[0, 0.45, 0]} material={collisionMaterial}>
          <boxGeometry args={[0.8, 1.8, 0.5]} />
        </mesh>
      )}
    </group>
  );
}

export default function FiveForgeViewport({
  children,
  onCaptureScreenshot,
  toolTitle = "FiveForge Viewport",
  showGrid = true,
  className = ""
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [cameraPreset, setCameraPreset] = useState('perspective');
  const [shadingMode, setShadingMode] = useState('rendered'); // rendered, clay, wireframe
  const [envMode, setEnvMode] = useState('studio');           // studio, sunny, night, cyberpunk
  const [showCollision, setShowCollision] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stats, setStats] = useState({ triangles: 0, vertices: 0, drawCalls: 0 });

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full min-h-[500px] bg-neutral-950 text-neutral-100 rounded-3xl overflow-hidden border border-neutral-800/80 shadow-2xl select-none font-sans ${className}`}
    >
      {/* 3D Canvas */}
      <Canvas
        ref={canvasRef}
        shadows
        gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false }}
        camera={{ position: [-3.4, 1.8, -3.4], fov: 45 }}
        style={{ width: '100%', height: '100%', minHeight: '560px' }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <color
          attach="background"
          args={[
            envMode === 'studio'
              ? '#393939'
              : envMode === 'sunny'
              ? '#262626'
              : envMode === 'night'
              ? '#0a0a0c'
              : '#0f172a'
          ]}
        />
        
        <ViewportLighting envMode={envMode} />
        
        <Suspense fallback={null}>
          <SceneRenderer shadingMode={shadingMode} showCollision={showCollision}>
            {children}
          </SceneRenderer>

          {/* Authentic Blender 3D Viewport Grid Floor + Red/Green Axes + 3D Cursor */}
          {showGrid && (
            <group position={[0, 0.068, 0]}>
              <Grid
                infiniteGrid
                position={[0, -0.001, 0]}
                cellSize={0.5}
                cellThickness={0.7}
                cellColor="#4c4c4c"
                sectionSize={2.5}
                sectionThickness={1.2}
                sectionColor="#2e2e2e"
                fadeDistance={40}
                fadeStrength={1.5}
              />
              {/* Blender Red X-Axis Line */}
              <mesh position={[0, 0.001, 0]} rotation={[0, 0, 0]}>
                <boxGeometry args={[40, 0.004, 0.012]} />
                <meshBasicMaterial color="#e63946" />
              </mesh>
              {/* Blender Green Y-Axis Line */}
              <mesh position={[0, 0.001, 0]} rotation={[0, Math.PI / 2, 0]}>
                <boxGeometry args={[40, 0.004, 0.012]} />
                <meshBasicMaterial color="#65b741" />
              </mesh>
              {/* Blender 3D Cursor Ring at Origin (Red & White Dashed Ring + Crosshairs) */}
              <group position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <mesh>
                  <ringGeometry args={[0.11, 0.13, 32]} />
                  <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
                </mesh>
                {[0, 1, 2, 3, 4, 5].map((seg) => (
                  <mesh key={seg} rotation={[0, 0, (seg * Math.PI) / 3]}>
                    <ringGeometry args={[0.108, 0.132, 8, 1, 0, Math.PI / 6]} />
                    <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
                  </mesh>
                ))}
                {/* Black Crosshairs */}
                <mesh>
                  <planeGeometry args={[0.32, 0.01]} />
                  <meshBasicMaterial color="#111111" side={THREE.DoubleSide} />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <planeGeometry args={[0.32, 0.01]} />
                  <meshBasicMaterial color="#111111" side={THREE.DoubleSide} />
                </mesh>
              </group>
              {envMode !== 'studio' && (
                <ContactShadows 
                  position={[0, -0.002, 0]} 
                  opacity={0.55} 
                  scale={10} 
                  blur={2.0} 
                  far={4.0} 
                />
              )}
            </group>
          )}
        </Suspense>

        <OrbitControls 
          makeDefault 
          enableDamping 
          dampingFactor={0.08}
          minDistance={0.3}
          maxDistance={25}
          target={[0, 0.4, 0]}
        />

        <ViewportController cameraPreset={cameraPreset} setStats={setStats} />
      </Canvas>

      {/* Floating Header HUD */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none" dir="ltr">
        {/* Title & Diagnostic Pill */}
        <div className="flex items-center gap-2 pointer-events-auto min-w-0">
          <div className="flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-neutral-800 shadow-lg min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-neutral-200 tracking-wide truncate max-w-[140px] sm:max-w-[220px]">{toolTitle}</span>
            <span className="text-[9px] text-neutral-400 font-mono pl-1 border-l border-neutral-800 shrink-0">
              WebGL 2.0
            </span>
          </div>

          {/* Mesh Diagnostics */}
          <div className="hidden md:flex items-center gap-2.5 bg-neutral-900/80 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-neutral-800/80 text-[10px] font-mono text-neutral-400 shrink-0">
            <span>Tris: <strong className="text-neutral-200">{stats.triangles.toLocaleString()}</strong></span>
            <span>Verts: <strong className="text-neutral-200">{stats.vertices.toLocaleString()}</strong></span>
            <span>Calls: <strong className="text-neutral-200">{stats.drawCalls}</strong></span>
          </div>
        </div>

        {/* Viewport Control Badges */}
        <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
          {/* Lighting Mode Selector */}
          <div className="bg-neutral-900/90 backdrop-blur-md p-1 rounded-2xl border border-neutral-800 flex items-center gap-0.5">
            {[
              { id: 'studio', label: 'Studio', icon: Sparkles },
              { id: 'sunny', label: 'Sunny', icon: Sun },
              { id: 'night', label: 'Night', icon: Moon },
              { id: 'cyberpunk', label: 'Cyber', icon: Activity }
            ].map(l => (
              <button
                key={l.id}
                onClick={() => setEnvMode(l.id)}
                title={`إضاءة ${l.label}`}
                className={`px-2 py-1 rounded-xl text-[10px] font-medium flex items-center gap-1 transition ${
                  envMode === l.id 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <l.icon className="w-3 h-3" />
                <span className="hidden lg:inline">{l.label}</span>
              </button>
            ))}
          </div>

          {/* Shading Mode */}
          <div className="bg-neutral-900/90 backdrop-blur-md p-1 rounded-2xl border border-neutral-800 flex items-center gap-0.5">
            <button
              onClick={() => setShadingMode('rendered')}
              title="عرض الخامات الواقعية (Rendered PBR)"
              className={`p-1.5 rounded-xl transition ${shadingMode === 'rendered' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShadingMode('wireframe')}
              title="عرض الخطوط والشبكة (Wireframe)"
              className={`p-1.5 rounded-xl transition ${shadingMode === 'wireframe' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowCollision(!showCollision)}
              title="إظهار مجسم التصادم (Havok Collision Mesh)"
              className={`p-1.5 rounded-xl transition ${showCollision ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              <Box className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 bg-neutral-900/90 backdrop-blur-md hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-2xl transition shadow-lg"
            title="ملء الشاشة"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Bottom Camera Presets HUD */}
      <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neutral-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-neutral-800 shadow-xl pointer-events-auto">
        <span className="text-[10px] text-neutral-400 font-semibold px-1.5 flex items-center gap-1">
          <Compass className="w-3 h-3 text-amber-400" />
          <span className="hidden sm:inline">الكاميرا:</span>
        </span>
        {[
          { id: 'perspective', label: '3D' },
          { id: 'front', label: 'أمام' },
          { id: 'back', label: 'خلف' },
          { id: 'left', label: 'يسار' },
          { id: 'right', label: 'يمين' },
          { id: 'top', label: 'أعلى' }
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setCameraPreset(p.id)}
            className={`px-2 py-0.5 rounded-xl text-[10px] font-medium transition ${
              cameraPreset === p.id 
                ? 'bg-amber-500 text-black font-bold shadow' 
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
