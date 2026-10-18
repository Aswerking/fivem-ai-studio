import React, { Suspense, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, TransformControls } from '@react-three/drei';
import {
  ArrowRight,
  Download,
  Eye,
  EyeOff,
  Layers,
  Maximize2,
  Minimize2,
  Move,
  Palette,
  RefreshCw,
  RotateCw,
  Shield,
  Sliders,
  Sparkles,
  Zap
} from 'lucide-react';
import RealisticGtaVehicle from './models/RealisticGtaVehicle';
import {
  LCPDFR_LIGHTBAR_CATALOG,
  isLcpdfrUrl,
  resolveLcpdfrPackFromUrl
} from '../engine/lcpdfrLightbarCatalog';
import { STUDIO_LIBRARIES } from '../engine/fivemLibraries.js';
import {
  loadCustomLightbarFile,
  cacheCustomLightbarScene,
  guessSirenTypeFromNames
} from '../engine/customLightbarLoader';

function BlenderCameraAndStats({ cameraPreset, setStats }) {
  const { camera, scene, gl, controls } = useThree();

  useEffect(() => {
    const presets = {
      perspective: { pos: [-3.2, 1.65, -3.2], target: [0, 0.35, 0] },
      front: { pos: [0, 0.75, -3.9], target: [0, 0.38, 0] },
      back: { pos: [0, 0.75, 3.9], target: [0, 0.38, 0] },
      left: { pos: [-4.0, 0.75, 0], target: [0, 0.38, 0] },
      right: { pos: [4.0, 0.75, 0], target: [0, 0.38, 0] },
      top: { pos: [0, 4.8, 0.01], target: [0, 0, 0] }
    };
    const cfg = presets[cameraPreset] || presets.perspective;
    camera.position.set(...cfg.pos);
    if (controls) {
      controls.target.set(...cfg.target);
      controls.update();
    } else {
      camera.lookAt(...cfg.target);
    }
  }, [cameraPreset, camera, controls]);

  const computeStats = React.useCallback(() => {
    let tris = 0;
    let verts = 0;
    scene.traverse((obj) => {
      if (obj.isMesh && obj.visible && obj.geometry) {
        if (obj.geometry.index) {
          tris += obj.geometry.index.count / 3;
        } else if (obj.geometry.attributes?.position) {
          tris += obj.geometry.attributes.position.count / 3;
        }
        if (obj.geometry.attributes?.position) {
          verts += obj.geometry.attributes.position.count;
        }
      }
    });
    setStats({
      triangles: Math.round(tris),
      vertices: Math.round(verts),
      drawCalls: Math.max(1, gl.info?.render?.calls || 24)
    });
  }, [scene, gl, setStats]);

  useEffect(() => {
    computeStats();
    const timer = setInterval(computeStats, 500);
    return () => clearInterval(timer);
  }, [computeStats]);

  const frameRef = useRef(0);
  useFrame(() => {
    frameRef.current++;
    if (frameRef.current % 30 === 0) computeStats();
  });

  return null;
}

/**
 * Full-Screen Blender 3D Viewport Page for Imported Cars
 * Replicates the authentic Blender 3D Viewport (#393939 background, subdivision grid,
 * Red X-Axis, Green Y-Axis, and Red/White 3D Cursor at [0,0,0]) with the imported 3D car
 * right in the center, plus collapsible N-Panel, T-Panel, and interactive 3D TransformControls Gizmo.
 */
export default function BlenderCarViewportPage({
  isOpen,
  onClose,
  carPreset,
  setCarPreset,
  importedCarMeta,
  setImportedCarMeta,
  carColor,
  setCarColor,
  debadged,
  setDebadged,
  filledFlush,
  setFilledFlush,
  badgeMode,
  setBadgeMode,
  customBadgeTexture,
  setCustomBadgeTexture,
  badgeScale,
  setBadgeScale,
  sirenType,
  setSirenType,
  sirenColorMode,
  setSirenColorMode,
  sirenOffsetX = 0,
  setSirenOffsetX,
  sirenOffsetY,
  setSirenOffsetY,
  sirenOffsetZ,
  setSirenOffsetZ,
  sirenRotX = 0,
  setSirenRotX,
  sirenRotY = 0,
  setSirenRotY,
  sirenRotZ = 0,
  setSirenRotZ,
  sirenScale,
  setSirenScale,
  pushbarEnabled,
  setPushbarEnabled,
  selectedRim,
  setSelectedRim,
  stanceCamber,
  setStanceCamber,
  stanceHeight,
  setStanceHeight,
  stanceOffset,
  setStanceOffset,
  headlightsOn,
  setHeadlightsOn,
  underglowOn,
  setUnderglowOn,
  underglowColor,
  setUnderglowColor,
  customVehicleUrl,
  customVehicleFormat,
  customVehicleYtdUrl,
  customVehicleLivery,
  onClearCustomVehicle,
  onImportUrl,
  isImporting,
  importStatusMsg,
  onExportZip,
  isExporting,
  customLightbarUrl,
  setCustomLightbarUrl,
  customLightbarFormat,
  setCustomLightbarFormat,
  customLightbarCacheId,
  setCustomLightbarCacheId,
  customLightbarName,
  setCustomLightbarName,
  lcpdfrPackId,
  setLcpdfrPackId,
  sirenAudioPack,
  setSirenAudioPack
}) {
  const [cameraPreset, setCameraPreset] = useState('perspective');
  const [showNPanel, setShowNPanel] = useState(true);
  const [activeNTab, setActiveNTab] = useState('siren'); // 'siren' | 'badge' | 'paint'
  const [stats, setStats] = useState({ triangles: 0, vertices: 0, drawCalls: 0 });
  const [quickUrlInput, setQuickUrlInput] = useState('');
  const [lcpdfrUrlInput, setLcpdfrUrlInput] = useState('');
  const [lcpdfrStatus, setLcpdfrStatus] = useState('');
  const [isLoadingLightbar, setIsLoadingLightbar] = useState(false);

  // Fine Badge & Siren Alignment States
  const [frontBadgeMount, setFrontBadgeMount] = useState('auto'); // 'auto' | 'hood' | 'grille'
  const [showDoorBadges, setShowDoorBadges] = useState(false);
  const [badgeOffsetY, setBadgeOffsetY] = useState(0);
  const [badgeOffsetZ, setBadgeOffsetZ] = useState(0);
  const [badgePitch, setBadgePitch] = useState(0);
  const [showGrilleStrobes, setShowGrilleStrobes] = useState(true);

  // Interactive 3D Blender Transform Gizmo ('none' | 'siren' | 'badge')
  const [gizmoTarget, setGizmoTarget] = useState('none');
  const [gizmoMode, setGizmoMode] = useState('translate'); // 'translate' | 'rotate' | 'scale'
  const sirenGroupRef = useRef(null);
  const badgeGroupRef = useRef(null);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [gizmoKey, setGizmoKey] = useState(0);

  // When siren / badge mode changes, remount gizmo and clear baked offsets so prop snaps to car
  useEffect(() => {
    if (sirenGroupRef.current) {
      sirenGroupRef.current.position.set(0, 0, 0);
      sirenGroupRef.current.rotation.set(0, 0, 0);
      sirenGroupRef.current.scale.set(1, 1, 1);
    }
    setSirenOffsetX?.(0);
    setSirenOffsetY?.(0);
    setSirenOffsetZ?.(0);
    setSirenRotX?.(0);
    setSirenRotY?.(0);
    setSirenRotZ?.(0);
    if (sirenType && sirenType !== 'none') {
      setGizmoTarget('siren');
      setGizmoMode('translate');
    }
    setGizmoKey((k) => k + 1);
  }, [sirenType]);

  useEffect(() => {
    if (badgeGroupRef.current) {
      badgeGroupRef.current.position.set(0, 0, 0);
      badgeGroupRef.current.rotation.set(0, 0, 0);
      badgeGroupRef.current.scale.set(1, 1, 1);
    }
    setGizmoKey((k) => k + 1);
  }, [badgeMode]);

  const applyLcpdfrPack = (pack) => {
    if (!pack) return;
    setLcpdfrPackId?.(pack.id);
    setLcpdfrUrlInput(pack.url);
    if (pack.kind === 'audio') {
      setSirenAudioPack?.(pack.audioPack || pack.id);
      setLcpdfrStatus(`🔊 تم تفعيل حزمة الصوت: ${pack.titleAr} — ستُدرج تعليمات الصوت في التصدير`);
      return;
    }
    if (pack.sirenType) {
      setSirenType(pack.sirenType);
      setGizmoTarget('siren');
    }
    // Honest UX: catalog = studio preview style, NOT the gated LCPDFR mesh download
    setLcpdfrStatus(
      `معاينة استوديو لـ «${pack.titleAr}» — مو ملف الموقع. حمّل الـ ZIP من LCPDFR وارفعه تحت عشان يصير نفس القطعة بالضبط.`
    );
  };

  const handleImportLcpdfrUrl = () => {
    const url = lcpdfrUrlInput.trim();
    if (!url) {
      setLcpdfrStatus('الصق رابط LCPDFR أولاً');
      return;
    }
    if (!isLcpdfrUrl(url)) {
      setLcpdfrStatus('الرابط لازم يكون من lcpdfr.com');
      return;
    }
    const pack = resolveLcpdfrPackFromUrl(url);
    if (!pack) {
      setLcpdfrStatus('ما لقينا تطابق جاهز — حمّل الـ ZIP من الموقع وارفعه تحت');
      return;
    }
    applyLcpdfrPack(pack);
  };

  const handleLightbarFile = async (file) => {
    if (!file) return;
    setIsLoadingLightbar(true);
    setLcpdfrStatus(`جاري قراءة: ${file.name}...`);
    try {
      const loaded = await loadCustomLightbarFile(file);
      const cacheId = `lb_${Date.now()}`;
      if (loaded.scene) cacheCustomLightbarScene(cacheId, loaded.scene);

      if (customLightbarUrl) {
        try { URL.revokeObjectURL(customLightbarUrl); } catch { /* ignore */ }
      }

      setCustomLightbarCacheId?.(cacheId);
      setCustomLightbarUrl?.(loaded.objectUrl);
      setCustomLightbarFormat?.(loaded.format || 'obj');
      setCustomLightbarName?.(loaded.sourceName || file.name);

      const guessed = guessSirenTypeFromNames([
        file.name,
        loaded.sourceName,
        ...(loaded.files || [])
      ]);
      // Prefer real uploaded mesh in viewport; fall back to matching built-in style
      setSirenType(loaded.scene ? 'custom_obj' : guessed);
      setGizmoTarget('siren');
      setLcpdfrStatus(`✅ تم تركيب البروب: ${loaded.sourceName || file.name} — حرّكه بالأسهم 3D`);
    } catch (err) {
      setLcpdfrStatus(`❌ ${err.message || String(err)}`);
    } finally {
      setIsLoadingLightbar(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] w-screen h-screen bg-[#393939] text-neutral-100 overflow-hidden select-none font-sans flex flex-col"
      dir="rtl"
    >
      {/* 1. BLENDER TOP HEADER BAR (Blender 4.0 Style) */}
      <header className="h-10 bg-[#282828] border-b border-[#1d1d1d] px-3 flex items-center justify-between gap-2 z-20 shrink-0 text-xs">
        {/* Right side (RTL): Back button + Blender Mode + Car Name */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-md bg-[#3d3d3d] hover:bg-[#4d4d4d] text-amber-300 font-bold flex items-center gap-1.5 border border-[#525252] transition cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة لصفحة الاستيراد</span>
          </button>

          <div className="flex items-center gap-1 bg-[#1e1e1e] px-2.5 py-1 rounded border border-[#383838] font-mono text-[11px]">
            <span className="text-amber-400 font-bold">Object Mode</span>
            <span className="text-neutral-500">|</span>
            <span className="text-emerald-400 font-bold truncate max-w-[180px]">{importedCarMeta?.displayName || carPreset.toUpperCase()}</span>
            <span className="text-neutral-400">({importedCarMeta?.spawnCode || carPreset})</span>
            {customVehicleUrl && customVehicleFormat === 'yft' && (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded text-[9px] font-sans font-bold">
                YFT+YTD الأصلي ✓
              </span>
            )}
          </div>

          {/* Quick Vehicle Switcher inside Blender Viewport */}
          <select
            value={customVehicleUrl && importedCarMeta?.spawnCode === '00barch' ? '00barch' : carPreset}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '00barch') {
                if (onImportUrl) {
                  onImportUrl('https://www.gta5-mods.com/vehicles/2000-ferrari-550-barchetta-pininfarina-add-on-template');
                }
                return;
              }
              if (onClearCustomVehicle) onClearCustomVehicle();
              setCarPreset(val);
              if (setImportedCarMeta) {
                setImportedCarMeta((prev) => ({ ...prev, spawnCode: val, displayName: val.toUpperCase() }));
              }
            }}
            className="bg-[#1e1e1e] border border-[#3d3d3d] rounded px-2 py-1 text-[11px] text-amber-300 font-bold cursor-pointer"
          >
            <option value="police3">🚓 سيارة شرطة (Police Interceptor) — للتجربة</option>
            <option value="g63">🚙 Mercedes-AMG G63 (SUV)</option>
            <option value="revolter">🔥 BMW M4 Competition</option>
            <option value="zentorno">⚡ Lamborghini Aventador</option>
            <option value="turismor">🏁 Ferrari 458 Spider</option>
            <option value="sultanrs">🏎️ Karin Sultan RS</option>
            <option value="schafter3">🚘 Benefactor Schafter</option>
            <option value="00barch">🏎️ Ferrari 550 (YFT من الرابط)</option>
          </select>
        </div>

        {/* Center: Blender Camera View Presets & 3D Gizmo Mode */}
        <div className="hidden md:flex items-center gap-1.5" dir="ltr">
          <div className="flex items-center gap-1 bg-[#1e1e1e] p-0.5 rounded border border-[#383838]">
            {[
              { id: 'perspective', label: 'Persp (0)' },
              { id: 'front', label: 'Front (1)' },
              { id: 'right', label: 'Right (3)' },
              { id: 'top', label: 'Top (7)' },
              { id: 'back', label: 'Back (9)' }
            ].map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => setCameraPreset(cam.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                  cameraPreset === cam.id ? 'bg-[#4772b3] text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          {/* 3D Transform Gizmo Selector */}
          <div className="flex items-center gap-1 bg-[#1e1e1e] p-0.5 rounded border border-[#383838]">
            <button
              type="button"
              onClick={() => setGizmoTarget((prev) => (prev === 'siren' ? 'none' : 'siren'))}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                gizmoTarget === 'siren' ? 'bg-amber-500 text-black' : 'text-neutral-300 hover:text-white'
              }`}
            >
              🧲 تحريك الونان
            </button>
            <button
              type="button"
              onClick={() => setGizmoTarget((prev) => (prev === 'badge' ? 'none' : 'badge'))}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                gizmoTarget === 'badge' ? 'bg-amber-500 text-black' : 'text-neutral-300 hover:text-white'
              }`}
            >
              🧲 تحريك الشعار
            </button>
            {gizmoTarget !== 'none' && (
              <>
                <button
                  type="button"
                  onClick={() => setGizmoMode('translate')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                    gizmoMode === 'translate' ? 'bg-[#4772b3] text-white' : 'text-neutral-400'
                  }`}
                >
                  Move (G)
                </button>
                <button
                  type="button"
                  onClick={() => setGizmoMode('rotate')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                    gizmoMode === 'rotate' ? 'bg-[#4772b3] text-white' : 'text-neutral-400'
                  }`}
                >
                  Rot (R)
                </button>
                <button
                  type="button"
                  onClick={() => setGizmoMode('scale')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                    gizmoMode === 'scale' ? 'bg-[#4772b3] text-white' : 'text-neutral-400'
                  }`}
                >
                  Scale (S)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Left side (RTL): Stats + Toggle N-Panel + Direct FiveM Export */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-2 bg-[#1e1e1e] px-2.5 py-1 rounded border border-[#383838] font-mono text-[10px] text-neutral-300" dir="ltr">
            <span>Tris: <b className="text-white">{stats.triangles.toLocaleString()}</b></span>
            <span>|</span>
            <span>Verts: <b className="text-white">{stats.vertices.toLocaleString()}</b></span>
          </div>

          <button
            type="button"
            onClick={() => setShowNPanel((prev) => !prev)}
            className={`px-2.5 py-1 rounded font-bold text-[11px] border transition flex items-center gap-1 cursor-pointer ${
              showNPanel
                ? 'bg-[#4772b3] border-[#5c8ad2] text-white'
                : 'bg-[#383838] border-[#4d4d4d] text-neutral-200 hover:bg-[#454545]'
            }`}
          >
            {showNPanel ? <EyeOff className="w-3.5 h-3.5" /> : <Sliders className="w-3.5 h-3.5" />}
            <span>{showNPanel ? 'إخفاء القوائم (صافي)' : 'إظهار أدوات الونان والشعار (N)'}</span>
          </button>

          <button
            type="button"
            onClick={onExportZip}
            disabled={isExporting}
            className="px-3 py-1 rounded bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-[11px] flex items-center gap-1.5 shadow cursor-pointer"
          >
            {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>تصدير للفايف إم (.ZIP)</span>
          </button>
        </div>
      </header>

      {/* 2. FULL-SCREEN BLENDER 3D VIEWPORT CANVAS */}
      <div className="relative flex-1 w-full h-full">
        {isImporting && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-[#1e1e1e]/95 border border-amber-500/60 text-amber-300 px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold pointer-events-none">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>{importStatusMsg || 'جاري تحميل وفك ضغط مجسم السيارة الأصلي (.RPF / .YFT + .YTD) من GTA5-Mods...'}</span>
          </div>
        )}
        <Canvas
          shadows
          gl={{ preserveDrawingBuffer: true, antialias: true, alpha: false }}
          camera={{ position: [-3.2, 1.65, -3.2], fov: 44 }}
          style={{ width: '100%', height: '100%' }}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          {/* Exact Blender 3D Viewport Dark Grey Background (#393939) */}
          <color attach="background" args={['#393939']} />

          {/* Blender Studio Lighting */}
          <ambientLight intensity={0.95} />
          <directionalLight position={[6, 10, 6]} intensity={1.7} castShadow shadow-mapSize={2048} />
          <directionalLight position={[-6, 5, -6]} intensity={0.85} />
          <pointLight position={[0, 3, -3]} intensity={0.6} color="#ffffff" />

          <Suspense fallback={null}>
            {/* THE 3D IMPORTED VEHICLE CENTERED RIGHT ON THE BLENDER 3D CURSOR */}
            <group position={[0, 0.38, 0]}>
              <RealisticGtaVehicle
                carPreset={carPreset}
                vehicleCategory={importedCarMeta?.category || ''}
                carColor={carColor}
                debadged={debadged}
                filledFlush={filledFlush}
                badgeMode={badgeMode}
                customBadgeTexture={customBadgeTexture}
                badgeScale={badgeScale}
                badgeOffsetY={badgeOffsetY}
                badgeOffsetZ={badgeOffsetZ}
                badgePitch={badgePitch}
                frontBadgeMount={frontBadgeMount}
                showDoorBadges={showDoorBadges}
                sirenType={sirenType}
                sirenColorMode={sirenColorMode}
                sirenOffsetX={sirenOffsetX}
                sirenOffsetY={sirenOffsetY}
                sirenOffsetZ={sirenOffsetZ}
                sirenRotX={sirenRotX}
                sirenRotY={sirenRotY}
                sirenRotZ={sirenRotZ}
                sirenScale={sirenScale}
                showGrilleStrobes={showGrilleStrobes}
                pushbarEnabled={pushbarEnabled}
                selectedRim={selectedRim}
                stanceCamber={stanceCamber}
                stanceHeight={stanceHeight}
                stanceOffset={stanceOffset}
                headlightsOn={headlightsOn}
                underglowOn={underglowOn}
                underglowColor={underglowColor}
                customModelUrl={customVehicleUrl}
                customModelFormat={customVehicleFormat}
                customYtdUrl={customVehicleYtdUrl}
                customLiveryTexture={customVehicleLivery}
                customLightbarUrl={customLightbarUrl}
                customLightbarFormat={customLightbarFormat}
                customLightbarCacheId={customLightbarCacheId}
                sirenGroupRef={sirenGroupRef}
                badgeGroupRef={badgeGroupRef}
              />

              {/* Gizmo moves INNER offset group only — outer anchor stays glued to car body */}
              {gizmoTarget === 'siren' && sirenType !== 'none' && sirenGroupRef.current && (
                <TransformControls
                  key={`siren-gizmo-${gizmoKey}-${sirenType}`}
                  object={sirenGroupRef.current}
                  mode={gizmoMode}
                  size={0.7}
                  onMouseDown={() => setOrbitEnabled(false)}
                  onMouseUp={() => {
                    setOrbitEnabled(true);
                    const obj = sirenGroupRef.current;
                    if (!obj) return;
                    // Bake drag into sliders so React transform stays in sync
                    if (gizmoMode === 'translate') {
                      const dx = obj.position.x;
                      const dy = obj.position.y;
                      const dz = obj.position.z;
                      setSirenOffsetX?.((prev) => prev + dx);
                      setSirenOffsetY((prev) => prev + dy);
                      setSirenOffsetZ((prev) => prev + dz);
                    }
                    if (gizmoMode === 'rotate') {
                      // Persist rotation — previously wiped to 0 so flip never stuck
                      if (typeof setSirenRotX === 'function') {
                        setSirenRotX((prev) => prev + obj.rotation.x);
                      }
                      if (typeof setSirenRotY === 'function') {
                        setSirenRotY((prev) => prev + obj.rotation.y);
                      }
                      if (typeof setSirenRotZ === 'function') {
                        setSirenRotZ((prev) => prev + obj.rotation.z);
                      }
                    }
                    if (gizmoMode === 'scale') {
                      const s = (obj.scale.x + obj.scale.y + obj.scale.z) / 3;
                      setSirenScale((prev) => Math.max(0.4, Math.min(2.2, prev * s)));
                    }
                    obj.position.set(0, 0, 0);
                    obj.rotation.set(0, 0, 0);
                    obj.scale.set(1, 1, 1);
                  }}
                />
              )}
              {gizmoTarget === 'badge' && badgeMode !== 'original' && badgeMode !== 'debadged' && badgeGroupRef.current && (
                <TransformControls
                  key={`badge-gizmo-${gizmoKey}-${badgeMode}`}
                  object={badgeGroupRef.current}
                  mode={gizmoMode}
                  size={0.7}
                  onMouseDown={() => setOrbitEnabled(false)}
                  onMouseUp={() => setOrbitEnabled(true)}
                />
              )}
            </group>

            {/* AUTHENTIC BLENDER FLOOR GRID + RED X-AXIS + GREEN Y-AXIS + 3D CURSOR AT ORIGIN [0,0,0] */}
            <group position={[0, 0, 0]}>
              <Grid
                infiniteGrid
                position={[0, -0.001, 0]}
                cellSize={0.5}
                cellThickness={0.7}
                cellColor="#4c4c4c"
                sectionSize={2.5}
                sectionThickness={1.2}
                sectionColor="#2e2e2e"
                fadeDistance={45}
                fadeStrength={1.5}
              />

              {/* Red X-Axis Line */}
              <mesh position={[0, 0.001, 0]}>
                <boxGeometry args={[80, 0.004, 0.015]} />
                <meshBasicMaterial color="#e63946" />
              </mesh>

              {/* Green Y-Axis Line */}
              <mesh position={[0, 0.001, 0]} rotation={[0, Math.PI / 2, 0]}>
                <boxGeometry args={[80, 0.004, 0.015]} />
                <meshBasicMaterial color="#65b741" />
              </mesh>

              {/* Blender 3D Cursor at [0, 0, 0] (Red & White Dashed Ring + Black Crosshair) */}
              <group position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <mesh>
                  <ringGeometry args={[0.13, 0.155, 36]} />
                  <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
                </mesh>
                {[0, 1, 2, 3, 4, 5].map((seg) => (
                  <mesh key={seg} rotation={[0, 0, (seg * Math.PI) / 3]}>
                    <ringGeometry args={[0.128, 0.157, 8, 1, 0, Math.PI / 6]} />
                    <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
                  </mesh>
                ))}
                <mesh>
                  <planeGeometry args={[0.38, 0.012]} />
                  <meshBasicMaterial color="#111111" side={THREE.DoubleSide} />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <planeGeometry args={[0.38, 0.012]} />
                  <meshBasicMaterial color="#111111" side={THREE.DoubleSide} />
                </mesh>
              </group>
            </group>
          </Suspense>

          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            enabled={orbitEnabled}
            minDistance={1.4}
            maxDistance={18}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2.08}
            target={[0, 0.42, 0]}
          />

          <BlenderCameraAndStats cameraPreset={cameraPreset} setStats={setStats} />
        </Canvas>

        {/* Top-Left Blender Viewport Overlay Text ("User Perspective (1)") */}
        <div className="absolute top-3 left-4 pointer-events-none font-mono text-[11px] text-neutral-200/90 drop-shadow space-y-0.5" dir="ltr">
          <div>User Perspective (1)</div>
          <div className="text-[10px] text-neutral-300/80">
            (1) {importedCarMeta?.spawnCode || carPreset} | Siren: {sirenType} | Badge: {badgeMode}
          </div>
          {gizmoTarget !== 'none' && (
            <div className="text-[10px] text-amber-400 font-bold">
              [3D Gizmo Active: {gizmoTarget.toUpperCase()} - {gizmoMode.toUpperCase()}] Drag arrows in 3D!
            </div>
          )}
        </div>

        {/* Left Blender T-Panel Quick Tool Icons */}
        <div className="absolute top-16 left-3 bg-[#282828]/95 border border-[#3d3d3d] rounded-xl p-1.5 flex flex-col gap-1.5 shadow-xl z-10" dir="ltr">
          <button
            type="button"
            onClick={() => {
              setShowNPanel(true);
              setActiveNTab('siren');
            }}
            title="إضافة وتعديل ونان السيارة (Siren Studio)"
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition cursor-pointer ${
              activeNTab === 'siren' && showNPanel ? 'bg-[#4772b3] text-white shadow' : 'bg-[#353535] hover:bg-[#454545]'
            }`}
          >
            🚨
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNPanel(true);
              setActiveNTab('badge');
            }}
            title="تغيير أو إزالة شعارات السيارة (Badge Customizer)"
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition cursor-pointer ${
              activeNTab === 'badge' && showNPanel ? 'bg-[#4772b3] text-white shadow' : 'bg-[#353535] hover:bg-[#454545]'
            }`}
          >
            🛡️
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNPanel(true);
              setActiveNTab('paint');
            }}
            title="تعديل الطلاء والجنوط والوقفة (Paint & Stance)"
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition cursor-pointer ${
              activeNTab === 'paint' && showNPanel ? 'bg-[#4772b3] text-white shadow' : 'bg-[#353535] hover:bg-[#454545]'
            }`}
          >
            🎨
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeNTab === 'badge') {
                setGizmoTarget((prev) => (prev === 'badge' ? 'none' : 'badge'));
              } else {
                setGizmoTarget((prev) => (prev === 'siren' ? 'none' : 'siren'));
              }
            }}
            title="تحريك بالماوس مباشرة مثل بلندر (3D Transform Gizmo)"
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition cursor-pointer ${
              gizmoTarget !== 'none' ? 'bg-amber-500 text-black shadow' : 'bg-[#353535] hover:bg-[#454545]'
            }`}
          >
            <Move className="w-4 h-4" />
          </button>
        </div>

        {/* Right Collapsible Blender N-Panel (Siren Studio + Badge Customizer + Paint) */}
        {showNPanel && (
          <div className="absolute top-3 right-3 bottom-3 w-80 max-w-[90vw] bg-[#282828]/95 backdrop-blur-md border border-[#3e3e3e] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10">
            {/* Direct GTA5-Mods YFT+YTD Importer Bar inside Blender N-Panel */}
            {onImportUrl && (
              <div className="p-2 bg-[#1a1a1a] border-b border-[#333333] space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-amber-300 font-bold">🔗 استيراد مجسم YFT أصلي من GTA5-Mods:</span>
                  {customVehicleUrl && customVehicleFormat === 'yft' && (
                    <span className="text-[9px] text-emerald-400 font-mono">YFT Active ✓</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={quickUrlInput}
                    onChange={(e) => setQuickUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && quickUrlInput.trim()) {
                        onImportUrl(quickUrlInput.trim());
                      }
                    }}
                    placeholder="https://www.gta5-mods.com/vehicles/..."
                    className="flex-1 bg-[#111111] border border-[#383838] rounded-lg px-2 py-1 text-[10px] text-white font-mono focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    disabled={isImporting || !quickUrlInput.trim()}
                    onClick={() => {
                      if (quickUrlInput.trim()) onImportUrl(quickUrlInput.trim());
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-black text-[10px] shrink-0 cursor-pointer"
                  >
                    {isImporting ? '...' : 'استيراد'}
                  </button>
                </div>
              </div>
            )}

            {/* N-Panel Tabs */}
            <div className="grid grid-cols-3 bg-[#1e1e1e] p-1 border-b border-[#383838] text-[11px] font-bold gap-1">
              <button
                type="button"
                onClick={() => setActiveNTab('siren')}
                className={`py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeNTab === 'siren' ? 'bg-[#4772b3] text-white shadow' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>🚨</span>
                <span>الونان</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveNTab('badge')}
                className={`py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeNTab === 'badge' ? 'bg-[#4772b3] text-white shadow' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>🛡️</span>
                <span>الشعارات</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveNTab('paint')}
                className={`py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                  activeNTab === 'paint' ? 'bg-[#4772b3] text-white shadow' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>🎨</span>
                <span>الطلاء والجنوط</span>
              </button>
            </div>

            {/* N-Panel Content */}
            <div className="p-3 space-y-3 overflow-y-auto flex-1 text-xs">
              {/* TAB 1: SIREN / WANAN STUDIO */}
              {activeNTab === 'siren' && (
                <div className="space-y-3">
                  <div className="p-2.5 bg-[#1f1f1f] rounded-xl border border-[#3a3a3a] space-y-2">
                    <div className="font-bold text-amber-300 text-[11px] flex items-center justify-between">
                      <span>🚨 نوع ونان وسفتي السيارة (LCPDFR Dev Resources):</span>
                      <span className="text-[9px] text-emerald-400 font-mono">Whelen & FedSig</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1">
                      {STUDIO_LIBRARIES.map((lib) => (
                        <a
                          key={lib.id}
                          href={lib.url}
                          target="_blank"
                          rel="noreferrer"
                          title={lib.noteAr}
                          className="px-2 py-1 rounded-lg bg-[#141414] border border-[#3a3a3a] hover:border-amber-400 text-[9px] font-bold text-neutral-200 truncate"
                        >
                          {lib.titleAr}
                        </a>
                      ))}
                    </div>

                    {/* Import from LCPDFR link */}
                    <div className="p-2 rounded-xl border border-amber-500/40 bg-[#18140c] space-y-1.5">
                      <span className="font-bold text-amber-300 text-[10px] block">🔗 استيراد بروبة ونان من رابط LCPDFR:</span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={lcpdfrUrlInput}
                          onChange={(e) => setLcpdfrUrlInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleImportLcpdfrUrl()}
                          placeholder="الصق رابط lightbars من lcpdfr.com..."
                          className="flex-1 bg-[#0d0d0d] border border-[#444] rounded-lg px-2 py-1.5 text-[10px] text-white outline-none focus:border-amber-400"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={handleImportLcpdfrUrl}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-[10px] hover:bg-amber-400 cursor-pointer shrink-0"
                        >
                          تطبيق
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto">
                        {LCPDFR_LIGHTBAR_CATALOG.map((pack) => (
                          <button
                            key={pack.id}
                            type="button"
                            onClick={() => applyLcpdfrPack(pack)}
                            className={`w-full text-right px-2 py-1.5 rounded-lg border text-[9px] font-bold transition cursor-pointer flex items-center justify-between gap-1 ${
                              lcpdfrPackId === pack.id
                                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                : 'bg-[#222] border-[#3a3a3a] text-neutral-300 hover:border-amber-500/50'
                            }`}
                          >
                            <span className="truncate">{pack.titleAr}</span>
                            <span className="text-[8px] px-1 rounded bg-black/40 text-amber-300 shrink-0">{pack.badge}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* LCPDFR Lightbar Dev Resources Quick Drop/Upload */}
                    <label className={`p-3 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition text-[10px] ${
                      isLoadingLightbar
                        ? 'border-amber-400 bg-amber-500/10 text-amber-200'
                        : 'border-amber-500/70 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 text-amber-100'
                    }`}>
                      <span className="text-base">📦</span>
                      <span className="font-black text-[11px]">
                        {isLoadingLightbar
                          ? 'جاري تركيب البروب الحقيقي...'
                          : customLightbarName
                            ? `مركّب الحقيقي: ${customLightbarName}`
                            : 'ارفع ملف LCPDFR الحقيقي هنا (.ZIP / .RAR / .Z3D / .OBJ / .YDR / .YFT)'}
                      </span>
                      <span className="text-[9px] text-neutral-400 font-normal">
                        يدعم كافة الصيغ: ZIP و RAR و Z3D و YDR و OBJ و YFT — تركيب مجسم حقيقي ومباشر
                      </span>
                      <input
                        type="file"
                        accept=".zip,.rar,.z3d,.obj,.ydr,.yft"
                        className="hidden"
                        disabled={isLoadingLightbar}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) handleLightbarFile(f);
                        }}
                      />
                    </label>
                    {lcpdfrStatus && (
                      <p className="text-[9px] text-emerald-300/90 leading-relaxed px-0.5">{lcpdfrStatus}</p>
                    )}
                    {sirenAudioPack && (
                      <p className="text-[9px] text-sky-300 px-0.5">🔊 حزمة صوت مفعّلة للتصدير: {sirenAudioPack}</p>
                    )}

                    <p className="text-[9px] text-neutral-400 leading-relaxed bg-[#141414] border border-[#333] rounded-lg px-2 py-1.5">
                      أزرار الكتالوج = <span className="text-amber-300">معاينة داخل الاستوديو</span> (مش ملف LCPDFR الأصلي).
                      عشان القطعة تكون نفس الموقع: افتح الرابط → حمّل ZIP/RAR/Z3D/YDR → ارفعه تحت. لو الاتجاه غلط اضغط قلب Y.
                    </p>

                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'lightbar_led', label: 'سقف', tip: 'ونان سقف' },
                        { id: 'soundoff_ion', label: 'صدام', tip: 'فلاشات أمام' },
                        { id: 'visor_unmarked', label: 'شماسية', tip: 'داخل الزجاج' }
                      ].map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          title={q.tip}
                          onClick={() => setSirenType(q.id)}
                          className={`py-2 rounded-lg text-[11px] font-black border cursor-pointer ${
                            sirenType === q.id
                              ? 'bg-amber-500 text-black border-amber-300'
                              : 'bg-[#2b2b2b] text-neutral-200 border-[#3d3d3d] hover:bg-[#353535]'
                          }`}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      {[
                        { id: 'setina_pb400_led', label: '🛡️ دعامة صدم Setina PB-400 + 4 فلاشات LED (أبيض/أزرق/أحمر/برتقالي)', badge: 'LCPDFR' },
                        { id: 'hideaway_vertex', label: '🚨 فلاشات شمعات وأنوار مخفية (Whelen Vertex Hide-A-Way)', badge: 'LCPDFR' },
                        { id: 'visor_unmarked', label: '🕵️ شريط تظليل داخلي كامل (Axixtech / Inner Edge)', badge: 'مباحث' },
                        { id: 'soundoff_ion', label: '🚨 SoundOff Ion + حامل لوحة أمامية', badge: 'شبك' },
                        { id: 'lightbar_led', label: '🚓 ونان سقف شرطة فائق الواقعية (Generic / Liberty)', badge: 'سقف' },
                        { id: 'valor_vshape', label: '🚔 ونان سقف V-Shape احترافي (Federal Signal Valor)', badge: 'سقف' },
                        { id: 'viper_s2', label: '🚨 فلاشر طبلون فردي/مزدوج (Federal Signal Viper S2)', badge: 'طبلون' },
                        { id: 'roof_single_beacon', label: '🚨 ونان مغناطيسي فردي على السقف (Whelen L31)', badge: 'VIP' },
                        { id: 'beacon_classic', label: '🚔 ونان كشافات دائرية كلاسيك (Aerodynic)', badge: 'كلاسيك' },
                        { id: 'custom_obj', label: '📦 بروب من ملفك ZIP/RAR/Z3D/YDR/OBJ', badge: 'مخصص' },
                        { id: 'none', label: '❌ بدون ونان (سيارة مدنية بالكامل)', badge: 'مدنية' }
                      ].map((sOpt) => (
                        <button
                          key={sOpt.id}
                          type="button"
                          onClick={() => setSirenType(sOpt.id)}
                          className={`w-full py-2 px-2.5 rounded-xl text-right font-bold text-[11px] transition cursor-pointer border flex items-center justify-between ${
                            sirenType === sOpt.id
                              ? 'bg-[#4772b3] border-blue-400 text-white shadow'
                              : 'bg-[#2b2b2b] border-[#3d3d3d] text-neutral-300 hover:bg-[#353535]'
                          }`}
                        >
                          <span className="truncate">{sOpt.label}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-amber-300 font-mono shrink-0">
                            {sOpt.badge}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Strobe Color Mode */}
                  <div className="p-2.5 bg-[#1f1f1f] rounded-xl border border-[#3a3a3a] space-y-2">
                    <span className="font-bold text-white text-[11px] block">ألوان فلاشات الونان (Strobe Colors):</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'red_blue', label: '🔵🔴 أحمر وأزرق' },
                        { id: 'blue_only', label: '🔵🔵 أزرق بالكامل' },
                        { id: 'red_white', label: '🔴⚪ أحمر وأبيض' },
                        { id: 'amber_gold', label: '🟠🟡 برتقالي ذهبي' }
                      ].map((cOpt) => (
                        <button
                          key={cOpt.id}
                          type="button"
                          onClick={() => setSirenColorMode(cOpt.id)}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                            sirenColorMode === cOpt.id
                              ? 'bg-amber-500 text-black border-amber-300'
                              : 'bg-[#2b2b2b] text-neutral-300 border-[#3d3d3d]'
                          }`}
                        >
                          {cOpt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3D Transform Controls for Siren (Gizmo + Sliders) */}
                  <div className="p-2.5 bg-[#1f1f1f] rounded-xl border border-[#3a3a3a] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 text-[11px]">📐 تحريك وتكبير الونان (Transform):</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSirenOffsetX?.(0);
                          setSirenOffsetY(0);
                          setSirenOffsetZ(0);
                          setSirenRotX?.(0);
                          setSirenRotY?.(0);
                          setSirenRotZ?.(0);
                          setSirenScale(1.0);
                          if (sirenGroupRef.current) {
                            sirenGroupRef.current.position.set(0, 0, 0);
                            sirenGroupRef.current.rotation.set(0, 0, 0);
                          }
                        }}
                        className="text-[9px] text-neutral-400 hover:text-white underline cursor-pointer"
                      >
                        إعادة ضبط
                      </button>
                    </div>

                    {/* Flip / Rotate quick actions — fix props facing into the car */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setGizmoTarget('siren');
                          setGizmoMode('rotate');
                          setSirenRotY?.((prev) => prev + Math.PI);
                        }}
                        className="py-1.5 rounded-lg bg-[#2b2b2b] hover:bg-amber-500/20 border border-[#3d3d3d] text-[10px] font-bold text-amber-300 cursor-pointer"
                        title="قلب 180° حول المحور العمودي"
                      >
                        ↻ قلب Y 180°
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGizmoTarget('siren');
                          setGizmoMode('rotate');
                          setSirenRotX?.((prev) => prev + Math.PI);
                        }}
                        className="py-1.5 rounded-lg bg-[#2b2b2b] hover:bg-amber-500/20 border border-[#3d3d3d] text-[10px] font-bold text-amber-300 cursor-pointer"
                        title="قلب رأسي — يصلح الونان الطالع على السيارة"
                      >
                        ⇅ قلب X 180°
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGizmoTarget('siren');
                          setGizmoMode('rotate');
                          setSirenRotZ?.((prev) => prev + Math.PI / 2);
                        }}
                        className="py-1.5 rounded-lg bg-[#2b2b2b] hover:bg-amber-500/20 border border-[#3d3d3d] text-[10px] font-bold text-amber-300 cursor-pointer"
                        title="تدوير 90°"
                      >
                        ⟲ Z 90°
                      </button>
                    </div>

                    {/* Interactive 3D Mouse Gizmo Toggle */}
                    <button
                      type="button"
                      onClick={() => setGizmoTarget((prev) => (prev === 'siren' ? 'none' : 'siren'))}
                      className={`w-full py-1.5 px-2.5 rounded-xl font-bold text-[11px] transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                        gizmoTarget === 'siren'
                          ? 'bg-amber-500 text-black border-amber-300 shadow'
                          : 'bg-[#2b2b2b] text-amber-300 border-[#3d3d3d] hover:bg-[#353535]'
                      }`}
                    >
                      <Move className="w-3.5 h-3.5" />
                      <span>
                        {gizmoTarget === 'siren'
                          ? `✅ جيزمو ${gizmoMode === 'rotate' ? 'دوران' : gizmoMode === 'scale' ? 'تكبير' : 'تحريك'} مفعّل`
                          : '🧲 تفعيل تحريك/قلب الونان بالماوس (3D Gizmo)'}
                      </span>
                    </button>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>يمين / يسار:</span>
                        <span className="font-mono text-amber-400">{sirenOffsetX.toFixed(2)}m</span>
                      </div>
                      <input
                        type="range"
                        min="-3"
                        max="3"
                        step="0.01"
                        value={sirenOffsetX}
                        onChange={(e) => setSirenOffsetX?.(parseFloat(e.target.value))}
                        className="w-full accent-[#4772b3] cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>ارتفاع الونان:</span>
                        <span className="font-mono text-amber-400">{sirenOffsetY.toFixed(2)}m</span>
                      </div>
                      <input
                        type="range"
                        min="-3"
                        max="3"
                        step="0.01"
                        value={sirenOffsetY}
                        onChange={(e) => setSirenOffsetY(parseFloat(e.target.value))}
                        className="w-full accent-[#4772b3] cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>قدام / ورا:</span>
                        <span className="font-mono text-amber-400">{sirenOffsetZ.toFixed(2)}m</span>
                      </div>
                      <input
                        type="range"
                        min="-3"
                        max="3"
                        step="0.01"
                        value={sirenOffsetZ}
                        onChange={(e) => setSirenOffsetZ(parseFloat(e.target.value))}
                        className="w-full accent-[#4772b3] cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>حجم الونان (Scale):</span>
                        <span className="font-mono text-amber-400">{sirenScale.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.6"
                        max="1.5"
                        step="0.05"
                        value={sirenScale}
                        onChange={(e) => setSirenScale(parseFloat(e.target.value))}
                        className="w-full accent-[#4772b3] cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>دوران X (قلب رأسي):</span>
                        <span className="font-mono text-amber-400">{((sirenRotX || 0) * 180 / Math.PI).toFixed(0)}°</span>
                      </div>
                      <input
                        type="range"
                        min={-Math.PI}
                        max={Math.PI}
                        step="0.05"
                        value={sirenRotX || 0}
                        onChange={(e) => setSirenRotX?.(parseFloat(e.target.value))}
                        className="w-full accent-[#4772b3] cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>دوران Y (قلب يمين/يسار):</span>
                        <span className="font-mono text-amber-400">{((sirenRotY || 0) * 180 / Math.PI).toFixed(0)}°</span>
                      </div>
                      <input
                        type="range"
                        min={-Math.PI}
                        max={Math.PI}
                        step="0.05"
                        value={sirenRotY || 0}
                        onChange={(e) => setSirenRotY?.(parseFloat(e.target.value))}
                        className="w-full accent-[#4772b3] cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>دوران Z (ميل):</span>
                        <span className="font-mono text-amber-400">{((sirenRotZ || 0) * 180 / Math.PI).toFixed(0)}°</span>
                      </div>
                      <input
                        type="range"
                        min={-Math.PI}
                        max={Math.PI}
                        step="0.05"
                        value={sirenRotZ || 0}
                        onChange={(e) => setSirenRotZ?.(parseFloat(e.target.value))}
                        className="w-full accent-[#4772b3] cursor-pointer"
                      />
                    </div>

                    {/* Front Grille Strobes Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowGrilleStrobes((prev) => !prev)}
                      className={`w-full py-1.5 rounded-xl font-bold text-[11px] transition cursor-pointer border ${
                        showGrilleStrobes
                          ? 'bg-[#4772b3]/40 text-blue-200 border-blue-400/60'
                          : 'bg-[#2b2b2b] text-neutral-400 border-[#3d3d3d]'
                      }`}
                    >
                      {showGrilleStrobes ? '✅ فلاشات الشبك الأمامي (مفعّلة)' : '➕ إظهار فلاشات الشبك الأمامي'}
                    </button>

                    {/* Front Pushbar Toggle */}
                    <button
                      type="button"
                      onClick={() => setPushbarEnabled((prev) => !prev)}
                      className={`w-full py-1.5 rounded-xl font-bold text-[11px] transition cursor-pointer border ${
                        pushbarEnabled
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : 'bg-[#2b2b2b] text-neutral-300 border-[#3d3d3d]'
                      }`}
                    >
                      {pushbarEnabled ? '✅ دعامة الصدم الأمامية (مركّبة)' : '➕ تركيب دعامة صدم أمامية (Pushbar)'}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: 3D BADGE CUSTOMIZER & REPLACER */}
              {activeNTab === 'badge' && (
                <div className="space-y-3">
                  <div className="p-2.5 bg-[#1f1f1f] rounded-xl border border-[#3a3a3a] space-y-2">
                    <span className="font-bold text-amber-300 text-[11px] block">
                      🛡️ اختيار أو إزالة شعار السيارة (3D Emblems):
                    </span>
                    <p className="text-[9px] text-neutral-400 leading-relaxed">
                      اضغط <span className="text-amber-300">إزالة الشعارات</span> عشان تختفي نجوم/حروف الوكالة من الشبك والشنطة. لو السيارة من رابط YFT، أعد الاستيراد مرة بعد التحديث.
                    </p>
                    <div className="space-y-1.5">
                      {[
                        { id: 'original', label: '🛡️ شعار الوكالة الأصلي (Factory)' },
                        { id: 'debadged', label: '✨ إزالة الشعارات + سمكرة كاملة' },
                        { id: 'gold_crown', label: '👑 شعار ملكي ذهبي عيار 24K' },
                        { id: 'carbon_sport', label: '🏁 شعار كاربون رياضي M-Power / AMG' },
                        { id: 'lspd_star', label: '⭐ نجمة الشرطة وأمن الطرق + الأبواب' },
                        { id: 'neon_led', label: '💎 شعار مضيء LED نيون متوهج' }
                      ].map((bOpt) => (
                        <button
                          key={bOpt.id}
                          type="button"
                          onClick={() => {
                            setBadgeMode(bOpt.id);
                            setDebadged(bOpt.id === 'debadged');
                            if (bOpt.id === 'debadged') setFilledFlush(true);
                          }}
                          className={`w-full py-2 px-2.5 rounded-xl text-right font-bold text-[11px] transition cursor-pointer border ${
                            badgeMode === bOpt.id
                              ? 'bg-amber-500 text-black border-amber-300 shadow'
                              : 'bg-[#2b2b2b] border-[#3d3d3d] text-neutral-300 hover:bg-[#353535]'
                          }`}
                        >
                          {bOpt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Upload Custom Badge Image */}
                  <div className="p-2.5 bg-[#1f1f1f] rounded-xl border border-[#3a3a3a] space-y-2">
                    <span className="font-bold text-white text-[11px] block">🖼️ رفع شعار سيرفرك الخاص (PNG / JPG):</span>
                    <label className="w-full py-2.5 px-3 bg-[#2b2b2b] hover:bg-[#353535] border border-dashed border-amber-500/60 rounded-xl text-center text-[11px] font-bold text-amber-300 cursor-pointer block transition">
                      <span>اختر صورة الشعار من جهازك...</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setCustomBadgeTexture(ev.target.result);
                            setBadgeMode('custom_image');
                            setDebadged(true);
                          };
                          reader.readAsDataURL(f);
                        }}
                      />
                    </label>
                  </div>

                  {/* Badge Surface Mount & Alignment Controls */}
                  <div className="p-2.5 bg-[#1f1f1f] rounded-xl border border-[#3a3a3a] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 text-[11px]">📐 موقع وموازنة الشعار على البودي:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setBadgeScale(1.0);
                          setBadgeOffsetY(0);
                          setBadgeOffsetZ(0);
                          setBadgePitch(0);
                          setFrontBadgeMount('auto');
                          if (badgeGroupRef.current) {
                            badgeGroupRef.current.position.set(0, 0, 0);
                            badgeGroupRef.current.rotation.set(0, 0, 0);
                          }
                        }}
                        className="text-[9px] text-neutral-400 hover:text-white underline cursor-pointer"
                      >
                        إعادة ضبط
                      </button>
                    </div>

                    {/* Front Badge Mount Selector (Hood vs Grille) */}
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'auto', label: 'تلقائي ذكي' },
                        { id: 'hood', label: 'على الكبوت' },
                        { id: 'grille', label: 'على الشبك' }
                      ].map((mOpt) => (
                        <button
                          key={mOpt.id}
                          type="button"
                          onClick={() => setFrontBadgeMount(mOpt.id)}
                          className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                            frontBadgeMount === mOpt.id
                              ? 'bg-[#4772b3] text-white border-blue-400'
                              : 'bg-[#2b2b2b] text-neutral-300 border-[#3d3d3d]'
                          }`}
                        >
                          {mOpt.label}
                        </button>
                      ))}
                    </div>

                    {/* Toggle Side Door Crests */}
                    <button
                      type="button"
                      onClick={() => setShowDoorBadges((prev) => !prev)}
                      className={`w-full py-1.5 rounded-xl font-bold text-[11px] transition cursor-pointer border ${
                        showDoorBadges || badgeMode === 'lspd_star'
                          ? 'bg-emerald-600/80 text-white border-emerald-400'
                          : 'bg-[#2b2b2b] text-neutral-300 border-[#3d3d3d]'
                      }`}
                    >
                      {showDoorBadges || badgeMode === 'lspd_star'
                        ? '✅ شعار الأبواب الجانبية (مفعّل وملاصق للباب)'
                        : '➕ إضافة الشعار على الأبواب الجانبية أيضاً'}
                    </button>

                    {/* Interactive 3D Mouse Gizmo Toggle for Badge */}
                    <button
                      type="button"
                      onClick={() => setGizmoTarget((prev) => (prev === 'badge' ? 'none' : 'badge'))}
                      className={`w-full py-1.5 px-2.5 rounded-xl font-bold text-[11px] transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                        gizmoTarget === 'badge'
                          ? 'bg-amber-500 text-black border-amber-300 shadow'
                          : 'bg-[#2b2b2b] text-amber-300 border-[#3d3d3d] hover:bg-[#353535]'
                      }`}
                    >
                      <Move className="w-3.5 h-3.5" />
                      <span>
                        {gizmoTarget === 'badge'
                          ? '✅ أسهم التحريك 3D مفعّلة (اسحب الشعار بالماوس)'
                          : '🧲 تحريك الشعار بالماوس مباشرة (3D Gizmo)'}
                      </span>
                    </button>

                    {/* Badge Scale Slider */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>حجم الشعار (Badge Scale):</span>
                        <span className="font-mono text-amber-400">{badgeScale.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.4"
                        max="2.2"
                        step="0.05"
                        value={badgeScale}
                        onChange={(e) => setBadgeScale(parseFloat(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    {/* Badge Height Offset Y */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>ارتفاع الشعار للأعلى/الأسفل (Offset Y):</span>
                        <span className="font-mono text-amber-400">{badgeOffsetY.toFixed(3)}m</span>
                      </div>
                      <input
                        type="range"
                        min="-0.15"
                        max="0.15"
                        step="0.005"
                        value={badgeOffsetY}
                        onChange={(e) => setBadgeOffsetY(parseFloat(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    {/* Badge Depth Offset Z */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>تقديم/تأخير الشعار (Offset Z):</span>
                        <span className="font-mono text-amber-400">{badgeOffsetZ.toFixed(3)}m</span>
                      </div>
                      <input
                        type="range"
                        min="-0.15"
                        max="0.15"
                        step="0.005"
                        value={badgeOffsetZ}
                        onChange={(e) => setBadgeOffsetZ(parseFloat(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    {/* Badge Surface Tilt / Pitch */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>زاوية ميلان الشعار على الكبوت (Tilt):</span>
                        <span className="font-mono text-amber-400">{Math.round((badgePitch * 180) / Math.PI)}°</span>
                      </div>
                      <input
                        type="range"
                        min="-1.2"
                        max="1.2"
                        step="0.05"
                        value={badgePitch}
                        onChange={(e) => setBadgePitch(parseFloat(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PAINT, RIMS & STANCE */}
              {activeNTab === 'paint' && (
                <div className="space-y-3">
                  <div className="p-2.5 bg-[#1f1f1f] rounded-xl border border-[#3a3a3a] space-y-2">
                    <span className="font-bold text-white text-[11px] block">🎨 لون طلاء السيارة (Metallic Paint):</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        '#0ea5e9',
                        '#18181b',
                        '#f8fafc',
                        '#dc2626',
                        '#f59e0b',
                        '#64748b',
                        '#16a34a',
                        '#9333ea'
                      ].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setCarColor(col)}
                          style={{ backgroundColor: col }}
                          className={`w-7 h-7 rounded-full border-2 transition cursor-pointer ${
                            carColor === col ? 'border-amber-400 scale-110 shadow-lg' : 'border-neutral-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#1f1f1f] rounded-xl border border-[#3a3a3a] space-y-2">
                    <span className="font-bold text-white text-[11px] block">⚙️ الجنوط والوقفة (Rims & Stance):</span>
                    <select
                      value={selectedRim}
                      onChange={(e) => setSelectedRim(e.target.value)}
                      className="w-full bg-[#2b2b2b] border border-[#3d3d3d] rounded-lg px-2 py-1.5 text-xs text-white"
                    >
                      <option value="sport_vossen">Vossen CV3 Sport (فضي رياضي)</option>
                      <option value="satin_black">Tactical Satin Black (أسود تكتيكي)</option>
                      <option value="rotiform_monoblock">Racing Gold (ذهبي سباقات)</option>
                      <option value="deep_dish_chrome">Mirror Chrome (كروم لامع)</option>
                    </select>

                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>ارتفاع السيارة (Ride Height):</span>
                        <span className="font-mono text-amber-400">{stanceHeight}</span>
                      </div>
                      <input
                        type="range"
                        min="-5"
                        max="5"
                        step="1"
                        value={stanceHeight}
                        onChange={(e) => setStanceHeight(parseInt(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-300">
                        <span>ميلان الكفرات (Camber):</span>
                        <span className="font-mono text-amber-400">{stanceCamber}°</span>
                      </div>
                      <input
                        type="range"
                        min="-8"
                        max="8"
                        step="1"
                        value={stanceCamber}
                        onChange={(e) => setStanceCamber(parseInt(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
