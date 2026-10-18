import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows, Center, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { 
  FolderOpen, 
  Layers, 
  Sun, 
  Eye, 
  EyeOff, 
  Camera, 
  Sparkles,
  Maximize2,
  RotateCcw
} from 'lucide-react';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import CosmeticAddons from './CosmeticAddons';

// كاش عام عالمي في الذاكرة لمجسم الشخصية والتكسشرات لتسريع التحميل الفوري بدون ثقل أو تعليق
let globalCachedGltf = null;
let globalGltfPromise = null;
const globalTextureCache = new Map();

function getOrCreateTexture(url, textureLoader) {
  if (!url) return Promise.resolve(null);
  if (globalTextureCache.has(url)) {
    return Promise.resolve(globalTextureCache.get(url));
  }
  return new Promise((resolve) => {
    textureLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.generateMipmaps = true;
        globalTextureCache.set(url, tex);
        resolve(tex);
      },
      undefined,
      (err) => {
        console.warn('فشل تحميل التكسشر:', url, err);
        resolve(null);
      }
    );
  });
}

function loadPedScene() {
  if (globalCachedGltf) {
    return Promise.resolve(SkeletonUtils.clone(globalCachedGltf));
  }
  if (globalGltfPromise) {
    return globalGltfPromise.then((scene) => SkeletonUtils.clone(scene));
  }
  globalGltfPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      '/models/ped.glb',
      (gltf) => {
        globalCachedGltf = gltf.scene;
        resolve(SkeletonUtils.clone(gltf.scene));
      },
      undefined,
      (err) => {
        globalGltfPromise = null;
        reject(err);
      }
    );
  });
  return globalGltfPromise;
}

// بيئة استوديو إضاءة وانعكاسات PBR محلية وفورية 100% دون أي تحميل من الإنترنت أو شاشة سوداء
function LocalStudioEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    pmremGenerator.compileEquirectangularShader();
    const envScene = new RoomEnvironment();
    const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
    scene.environment = renderTarget.texture;

    return () => {
      scene.environment = null;
      renderTarget.dispose();
      pmremGenerator.dispose();
    };
  }, [gl, scene]);

  return null;
}

// متحكم زوايا الكاميرا المتقدم (مثل أرقام Numpad في بلندر)
function CameraController({ cameraView, controlsRef }) {
  const { camera, scene } = useThree();

  useEffect(() => {
    window.__three = { THREE, scene, camera, raycaster: new THREE.Raycaster() };
  }, [camera, scene]);

  useEffect(() => {
    if (!cameraView) return;

    const views = {
      front: { pos: [0, 0.05, 3.15], target: [0, -0.05, 0] },
      back: { pos: [0, 0.05, -3.15], target: [0, -0.05, 0] },
      left: { pos: [-3.15, 0.05, 0], target: [0, -0.05, 0] },
      right: { pos: [3.15, 0.05, 0], target: [0, -0.05, 0] },
      top: { pos: [0, 2.2, 0.01], target: [0, -0.15, 0] },
      face: { pos: [0, 0.62, 0.65], target: [0, 0.62, 0.05] },
      body: { pos: [0, 0.15, 1.6], target: [0, 0.15, 0] },
      feet: { pos: [0, -0.65, 1.0], target: [0, -0.85, 0] }
    };

    const targetView = views[cameraView];
    if (targetView) {
      camera.position.set(...targetView.pos);
      if (controlsRef.current) {
        controlsRef.current.target.set(...targetView.target);
        controlsRef.current.update();
      }
    }
  }, [cameraView, camera, controlsRef]);

  return null;
}

// المجسم الديناميكي مع محاكي الحركة والتكسشرات والتحكم الدقيق بالعظام الفردية
function DynamicPedModel({ 
  modelScene, 
  morphs, 
  textures, 
  visibility, 
  shadingMode, 
  walkStyle, 
  animSpeed, 
  isPlaying,
  clothingPattern,
  onChangeClothingPattern,
  onTriggerDrape,
  controlsRef,
  setActiveDragHUD
}) {
  const modelRef = useRef();
  const nodesRef = useRef({});
  const loadedTextureObjects = useRef({});
  const morphsRef = useRef(morphs);
  morphsRef.current = morphs;
  const clothingPatternRef = useRef(clothingPattern);
  clothingPatternRef.current = clothingPattern;
  const drapeTimerRef = useRef(0.0);

  // السحب المباشر من اللبس ثلاثي الأبعاد بالماوس (Direct 3D Cloth Pulling)
  const handleClothPointerDown = (e) => {
    if (!clothingPatternRef.current) return;
    const meshName = (e.object?.name || '').toLowerCase();
    const isCloth = meshName.includes('jbib') || meshName.includes('0e4f123c') || meshName.includes('uppr') || meshName.includes('57aff7fb');
    if (!isCloth) return;

    e.stopPropagation();
    const local = e.point.clone();
    if (modelRef.current) {
      modelRef.current.worldToLocal(local);
    }
    window.dispatchEvent(new CustomEvent('garment-cloth-direct-drag', {
      detail: { local, clientX: e.clientX, clientY: e.clientY }
    }));
  };

  const getEffectiveSkinColor = (skinColorHex) => {
    if (!skinColorHex || skinColorHex.toLowerCase() === '#ffffff') {
      // لون البشرة الأصلي المتناسق مع تكسشرات فايف إم الطبيعية للرأس والذراعين
      return '#caa18e';
    }
    return skinColorHex;
  };

  const createDummyTexture = () => {
    const data = new Uint8Array([202, 161, 142, 255]); // #caa18e skin tone
    const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
    return tex;
  };

  // يونيفورمات متزامنة وثابتة في الذاكرة تضمن استجابة فورية 100% لكل حركة سلايدر
  const sharedUniforms = useRef({
    uUpprTex: { value: createDummyTexture() },
    uLowrTex: { value: createDummyTexture() },
    uShoulderWidth: { value: 1.0 },
    uArmMuscles: { value: 1.0 },
    uBellyFat: { value: 1.0 },
    uChestBulk: { value: 1.0 },
    uThighBulk: { value: 1.0 },
    uFaceFat: { value: 1.0 },
    uHeadScale: { value: 1.0 },
    uHideRightArm: { value: 0.0 },
    uHideLeftArm: { value: 0.0 },
    uHideRightLeg: { value: 0.0 },
    uHideLeftLeg: { value: 0.0 },
    // يونيفورمات تشوهات الوجه والجسم (Facial & Body Deformities)
    uFaceDistortion: { value: 0.0 },
    uCrookedNose: { value: 0.0 },
    uJawTwist: { value: 0.0 },
    uHunchback: { value: 0.0 },
    uBodyAsymmetry: { value: 0.0 },
    uGrotesqueLumps: { value: 0.0 },
    // يونيفورمات تفاصيل العيون والجروح والوشوم ولون البشرة (Eyes, Scars, Tattoos & Skin)
    uPedSkinColor: { value: new THREE.Color(getEffectiveSkinColor(morphs.skinColor)) },
    uEyeColorL: { value: new THREE.Color('#4a3728') },
    uEyeColorR: { value: new THREE.Color('#4a3728') },
    uBlindEyeL: { value: 0.0 },
    uBlindEyeR: { value: 0.0 },
    uGougedEyeL: { value: 0.0 },
    uGougedEyeR: { value: 0.0 },
    uFaceTattoo: { value: 0.0 },
    uFaceScar: { value: 0.0 },
    // يونيفورمات الوجه المشوه بالضربات والشقوق العميقة ثلاثية الأبعاد (3D Facial Slash Trauma)
    uFaceSlashType: { value: 0.0 },
    uFaceSlashDepth: { value: 0.0 },
    uFaceSlashFresh: { value: 1.0 },
    uFaceSlashStitches: { value: 0.0 },
    // يونيفورمات تعرية الملابس ووشوم وندبات الجسم والرجول
    uStripShirt: { value: 0.0 },
    uStripPants: { value: 0.0 },
    uBodyTattoo: { value: 0.0 },
    uBodyScar: { value: 0.0 },
    // استوديو تفصيل وقص وتطريز الملابس وتناسق المقاسات لكل الأجسام (Clothing Studio)
    uTailorActive: { value: 0.0 },
    uClothLength: { value: 78.0 },
    uClothWidth: { value: 56.0 },
    uSleeveLength: { value: 28.0 },
    uSleeveLengthL: { value: 28.0 },
    uSleeveLengthR: { value: 28.0 },
    uSleeveWidth: { value: 40.0 },
    uNeckline: { value: 28.0 },
    uHemLeftOffset: { value: 0.0 },
    uHemRightOffset: { value: 0.0 },
    uHemFrontL: { value: 0.0 },
    uHemFrontR: { value: 0.0 },
    uHemBackL: { value: 0.0 },
    uHemBackR: { value: 0.0 },
    uShoulderL: { value: 0.0 },
    uShoulderR: { value: 0.0 },
    uBackShoulderL: { value: 0.0 },
    uBackShoulderR: { value: 0.0 },
    uWaistL: { value: 0.0 },
    uWaistR: { value: 0.0 },
    uClothColor: { value: new THREE.Color('#ecc94b') },
    uFabricType: { value: 4.0 }, // 0: Cotton, 1: Denim, 2: Silk, 3: Leather, 4: Knit
    uShowSeams: { value: 1.0 },
    uDetailLevel: { value: 1.0 },
    uDrapeWave: { value: 0.0 },
    uDrapeTime: { value: 0.0 },
    // يونيفورمات المحاكاة الحركية الواقعية للأرجل والأذرع والحوض
    uLegSwingL: { value: 0.0 },
    uKneeBendL: { value: 0.0 },
    uFootPitchL: { value: 0.0 },
    uLegSwingR: { value: 0.0 },
    uKneeBendR: { value: 0.0 },
    uFootPitchR: { value: 0.0 },
    uPelvisBob: { value: 0.0 },
    uPelvisRoll: { value: 0.0 },
    uArmSwingL: { value: 0.0 },
    uElbowBendL: { value: 0.0 },
    uArmSwingR: { value: 0.0 },
    uElbowBendR: { value: 0.0 },
    uSpineTwist: { value: 0.0 },
    uAnimActive: { value: 0.0 }
  });

  // استخراج وتصنيف شبكات (Meshes) فايف إم الرئيسية بدقة مطلقة
  useEffect(() => {
    if (!modelScene) return;

    const parts = {
      head: null,
      uppr: null,
      lowr: null,
      jbib: null,
      feet: null,
      uppr_bare: null,
      lowr_bare: null
    };

    modelScene.traverse((child) => {
      if (!child.isMesh) return;
      const name = (child.name || '').toLowerCase();
      if (name.includes('uppr_bare')) parts.uppr_bare = child;
      else if (name.includes('lowr_bare')) parts.lowr_bare = child;
      else if (name.includes('skel_root') || name.includes('head')) parts.head = child;
      else if (name.includes('57aff7fb') || name.includes('uppr')) parts.uppr = child;
      else if (name.includes('0e4f123c') || name.includes('jbib')) parts.jbib = child;
      else if (name.includes('3fbbef0a') || name.includes('lowr')) parts.lowr = child;
      else if (name.includes('38aed724') || name.includes('feet')) parts.feet = child;
    });

    nodesRef.current = parts;
    window.__pedParts = parts;
    window.__pedScene = modelScene;
  }, [modelScene]);

  // تهيئة وتجهيز الماتيريال والـ Custom Deform Shader مرة واحدة فقط للمجسم أو عند تغيير وضع التظليل
  useEffect(() => {
    if (!modelScene) return;

    modelScene.traverse((node) => {
        if (node.isMesh && node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];

          mats.forEach((mat) => {
            const meshName = (node.name || '').toLowerCase();
            const matName = (mat.name || '').toLowerCase();

            const isUpprBare = meshName.includes('uppr_bare') || matName.includes('uppr_bare');
            const isLowrBare = meshName.includes('lowr_bare') || matName.includes('lowr_bare');
            const isHead = meshName.includes('head') || matName.includes('head') || matName.includes('face') || meshName.includes('skel_root');
            const isUppr = isUpprBare || meshName.includes('uppr') || matName.includes('uppr') || matName.includes('body') || matName.includes('hand') || matName.includes('arm') || meshName.includes('57aff7fb');
            const isLowr = isLowrBare || meshName.includes('lowr') || matName.includes('lowr') || matName.includes('pant') || matName.includes('leg') || meshName.includes('3fbbef0a');
            const isJbib = !isUpprBare && (meshName.includes('jbib') || matName.includes('jbib') || matName.includes('shirt') || matName.includes('jacket') || meshName.includes('0e4f123c'));
            const isFeet = meshName.includes('feet') || matName.includes('feet') || matName.includes('shoe') || meshName.includes('38aed724');

            let targetSlot = null;
            if (isHead) targetSlot = 'head';
            else if (isUpprBare) targetSlot = 'uppr_bare';
            else if (isLowrBare) targetSlot = 'lowr_bare';
            else if (isUppr) targetSlot = 'uppr';
            else if (isLowr) targetSlot = 'lowr';
            else if (isJbib) targetSlot = 'jbib';
            else if (isFeet) targetSlot = 'feet';

            // حماية تامة من مشاكل الشفافية وتجويف الفم
            mat.transparent = false;
            mat.depthWrite = true;
            mat.depthTest = true;
            mat.side = THREE.DoubleSide;
            mat.vertexColors = false;
            mat.needsUpdate = true;

            if (shadingMode === 'clay') {
              mat.map = null;
              mat.color = new THREE.Color('#b8aca3');
              mat.roughness = 0.72;
              mat.metalness = 0.05;
              mat.wireframe = false;
            } else if (shadingMode === 'wireframe') {
              mat.wireframe = true;
              mat.color = new THREE.Color('#4f46e5');
            } else {
              mat.wireframe = false;

              if (isUpprBare) {
                // مجسم الصدر والبطن والذراعين العاري الأصلي من فايف إم
                mat.map = loadedTextureObjects.current['uppr'] || loadedTextureObjects.current['uppr_bare'];
                mat.color = new THREE.Color(getEffectiveSkinColor(morphs.skinColor));
                mat.roughness = 0.55;
              } else if (isLowrBare) {
                // مجسم البوكسر الرياضي والرجول العضلية الحقيقية من فايف إم
                mat.map = loadedTextureObjects.current['lowr_bare'];
                mat.color = new THREE.Color('#ffffff');
                mat.roughness = 0.58;
              } else if (targetSlot === 'jbib') {
                mat.map = loadedTextureObjects.current['jbib'];
                mat.color = new THREE.Color(morphs.clothingColor || '#ffffff');
                mat.roughness = 0.75;
              } else if (targetSlot === 'lowr') {
                mat.map = loadedTextureObjects.current['lowr'];
                mat.color = new THREE.Color('#ffffff');
                mat.roughness = 0.82;
              } else if (targetSlot && loadedTextureObjects.current[targetSlot]) {
                mat.map = loadedTextureObjects.current[targetSlot];
                if ((targetSlot === 'head' || targetSlot === 'uppr') && morphs.skinColor) {
                  mat.color = new THREE.Color(getEffectiveSkinColor(morphs.skinColor));
                } else {
                  mat.color = new THREE.Color('#ffffff');
                }
              } else {
                if (isHead || isUppr) {
                  mat.color = new THREE.Color(getEffectiveSkinColor(morphs.skinColor));
                  mat.roughness = 0.58;
                } else if (isLowr) {
                  mat.color = new THREE.Color('#1e293b');
                  mat.roughness = 0.82;
                } else if (isJbib) {
                  mat.color = new THREE.Color(morphs.clothingColor || '#f8fafc');
                  mat.roughness = 0.75;
                } else if (isFeet) {
                  mat.color = new THREE.Color('#18181b');
                  mat.roughness = 0.5;
                }
              }

              mat.metalness = 0.02;
              if (isHead || isUppr) mat.roughness = 0.55;
            }

            // ضمان مفتاح فريد لإعادة الترجمة دون تضارب مع كاش الحالة
            mat.customProgramCacheKey = () => `ped_custom_deform_v25_${targetSlot || 'def'}_${shadingMode}_s${morphs.stripShirt ? 1 : 0}_p${morphs.stripPants ? 1 : 0}`;

            // تطبيق الـ Shader المعزول تشريحياً لكل عظمة وجزء من الجسم
            mat.onBeforeCompile = (shader) => {
              // ربط مراجع اليونيفورم المشتركة لضمان التحديث اللحظي دائماً
              const su = sharedUniforms.current;
              shader.uniforms.uUpprTex = su.uUpprTex;
              shader.uniforms.uLowrTex = su.uLowrTex;
              shader.uniforms.uPedSkinColor = su.uPedSkinColor;
              shader.uniforms.uShoulderWidth = su.uShoulderWidth;
              shader.uniforms.uArmMuscles = su.uArmMuscles;
              shader.uniforms.uBellyFat = su.uBellyFat;
              shader.uniforms.uChestBulk = su.uChestBulk;
              shader.uniforms.uThighBulk = su.uThighBulk;
              shader.uniforms.uFaceFat = su.uFaceFat;
              shader.uniforms.uHeadScale = su.uHeadScale;
              shader.uniforms.uHideRightArm = su.uHideRightArm;
              shader.uniforms.uHideLeftArm = su.uHideLeftArm;
              shader.uniforms.uHideRightLeg = su.uHideRightLeg;
              shader.uniforms.uHideLeftLeg = su.uHideLeftLeg;
              shader.uniforms.uFaceDistortion = su.uFaceDistortion;
              shader.uniforms.uCrookedNose = su.uCrookedNose;
              shader.uniforms.uJawTwist = su.uJawTwist;
              shader.uniforms.uHunchback = su.uHunchback;
              shader.uniforms.uBodyAsymmetry = su.uBodyAsymmetry;
              shader.uniforms.uGrotesqueLumps = su.uGrotesqueLumps;
              shader.uniforms.uEyeColorL = su.uEyeColorL;
              shader.uniforms.uEyeColorR = su.uEyeColorR;
              shader.uniforms.uBlindEyeL = su.uBlindEyeL;
              shader.uniforms.uBlindEyeR = su.uBlindEyeR;
              shader.uniforms.uGougedEyeL = su.uGougedEyeL;
              shader.uniforms.uGougedEyeR = su.uGougedEyeR;
              shader.uniforms.uFaceTattoo = su.uFaceTattoo;
              shader.uniforms.uFaceScar = su.uFaceScar;
              shader.uniforms.uFaceSlashType = su.uFaceSlashType;
              shader.uniforms.uFaceSlashDepth = su.uFaceSlashDepth;
              shader.uniforms.uFaceSlashFresh = su.uFaceSlashFresh;
              shader.uniforms.uFaceSlashStitches = su.uFaceSlashStitches;
              shader.uniforms.uStripShirt = su.uStripShirt;
              shader.uniforms.uStripPants = su.uStripPants;
              shader.uniforms.uBodyTattoo = su.uBodyTattoo;
              shader.uniforms.uBodyScar = su.uBodyScar;
              // استوديو تفصيل وقص وتطريز الملابس (Clothing Studio)
              shader.uniforms.uTailorActive = su.uTailorActive;
              shader.uniforms.uClothLength = su.uClothLength;
              shader.uniforms.uClothWidth = su.uClothWidth;
              shader.uniforms.uSleeveLength = su.uSleeveLength;
              shader.uniforms.uSleeveLengthL = su.uSleeveLengthL;
              shader.uniforms.uSleeveLengthR = su.uSleeveLengthR;
              shader.uniforms.uSleeveWidth = su.uSleeveWidth;
              shader.uniforms.uNeckline = su.uNeckline;
              shader.uniforms.uHemLeftOffset = su.uHemLeftOffset;
              shader.uniforms.uHemRightOffset = su.uHemRightOffset;
              shader.uniforms.uHemFrontL = su.uHemFrontL;
              shader.uniforms.uHemFrontR = su.uHemFrontR;
              shader.uniforms.uHemBackL = su.uHemBackL;
              shader.uniforms.uHemBackR = su.uHemBackR;
              shader.uniforms.uShoulderL = su.uShoulderL;
              shader.uniforms.uShoulderR = su.uShoulderR;
              shader.uniforms.uBackShoulderL = su.uBackShoulderL;
              shader.uniforms.uBackShoulderR = su.uBackShoulderR;
              shader.uniforms.uWaistL = su.uWaistL;
              shader.uniforms.uWaistR = su.uWaistR;
              shader.uniforms.uClothColor = su.uClothColor;
              shader.uniforms.uFabricType = su.uFabricType;
              shader.uniforms.uShowSeams = su.uShowSeams;
              shader.uniforms.uDetailLevel = su.uDetailLevel;
              shader.uniforms.uDrapeWave = su.uDrapeWave;
              shader.uniforms.uDrapeTime = su.uDrapeTime;

              shader.uniforms.uLegSwingL = su.uLegSwingL;
              shader.uniforms.uKneeBendL = su.uKneeBendL;
              shader.uniforms.uFootPitchL = su.uFootPitchL;
              shader.uniforms.uLegSwingR = su.uLegSwingR;
              shader.uniforms.uKneeBendR = su.uKneeBendR;
              shader.uniforms.uFootPitchR = su.uFootPitchR;
              shader.uniforms.uPelvisBob = su.uPelvisBob;
              shader.uniforms.uPelvisRoll = su.uPelvisRoll;
              shader.uniforms.uArmSwingL = su.uArmSwingL;
              shader.uniforms.uElbowBendL = su.uElbowBendL;
              shader.uniforms.uArmSwingR = su.uArmSwingR;
              shader.uniforms.uElbowBendR = su.uElbowBendR;
              shader.uniforms.uSpineTwist = su.uSpineTwist;
              shader.uniforms.uAnimActive = su.uAnimActive;

              // معرّفات الجزء المحدد
              shader.uniforms.uIsHead = { value: isHead ? 1.0 : 0.0 };
              shader.uniforms.uIsUppr = { value: isUppr ? 1.0 : 0.0 };
              shader.uniforms.uIsJbib = { value: isJbib ? 1.0 : 0.0 };
              shader.uniforms.uIsLowr = { value: isLowr ? 1.0 : 0.0 };
              shader.uniforms.uIsFeet = { value: isFeet ? 1.0 : 0.0 };
              shader.uniforms.uIsBareMesh = { value: (isUpprBare || isLowrBare) ? 1.0 : 0.0 };

              shader.vertexShader = `
                uniform float uShoulderWidth;
                uniform float uArmMuscles;
                uniform float uBellyFat;
                uniform float uChestBulk;
                uniform float uThighBulk;
                uniform float uFaceFat;
                uniform float uHeadScale;
                uniform float uFaceDistortion;
                uniform float uFaceSlashType;
                uniform float uFaceSlashDepth;
                uniform float uCrookedNose;
                uniform float uJawTwist;
                uniform float uHunchback;
                uniform float uBodyAsymmetry;
                uniform float uGrotesqueLumps;
                uniform float uGougedEyeL;
                uniform float uGougedEyeR;
                uniform float uIsHead;
                uniform float uIsUppr;
                uniform float uIsJbib;
                uniform float uIsLowr;
                uniform float uIsFeet;
                uniform float uIsBareMesh;
                uniform float uStripShirt;
                uniform float uStripPants;
                uniform float uTailorActive;
                uniform float uClothLength;
                uniform float uClothWidth;
                uniform float uSleeveLength;
                uniform float uSleeveLengthL;
                uniform float uSleeveLengthR;
                uniform float uSleeveWidth;
                uniform float uNeckline;
                uniform float uHemLeftOffset;
                uniform float uHemRightOffset;
                uniform float uHemFrontL;
                uniform float uHemFrontR;
                uniform float uHemBackL;
                uniform float uHemBackR;
                uniform float uShoulderL;
                uniform float uShoulderR;
                uniform float uBackShoulderL;
                uniform float uBackShoulderR;
                uniform float uWaistL;
                uniform float uWaistR;
                uniform float uFabricType;
                uniform float uDrapeWave;
                uniform float uDrapeTime;
                uniform float uLegSwingL;
                uniform float uKneeBendL;
                uniform float uFootPitchL;
                uniform float uLegSwingR;
                uniform float uKneeBendR;
                uniform float uFootPitchR;
                uniform float uPelvisBob;
                uniform float uPelvisRoll;
                uniform float uArmSwingL;
                uniform float uElbowBendL;
                uniform float uArmSwingR;
                uniform float uElbowBendR;
                uniform float uSpineTwist;
                uniform float uAnimActive;
                varying vec3 vCutLocalPos;
                varying vec3 vOrigPos;
                varying vec2 vCutUv;
                varying float vIsJbibCap;
                ${shader.vertexShader}
              `.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vec3 defPos = position;

                // حساب عامل السمنة الأساسي للتكامل المتناسق لكافة أجزاء الجسم (Bear Body Proportions)
                float fatAmount = uBellyFat - 1.0;
                float fatBonus = max(0.0, fatAmount);
                float effectiveFaceFat = (uFaceFat - 1.0) + fatBonus * 0.45;

                // 1. تضخيم وتوسيع الرقبة كرقبة الدب في الرأس وأعلى الصدر وياقة التيشيرت (Thick Bull Neck)
                float neckSpanY = smoothstep(0.60, 0.53, position.y) * smoothstep(0.36, 0.44, position.y);
                if (neckSpanY > 0.001) {
                  vec2 neckCenter = vec2(0.0, 0.015);
                  vec2 deltaNeck = defPos.xz - neckCenter;
                  float distNeck = length(deltaNeck);
                  if (distNeck < 0.14) {
                    vec2 dirNeck = distNeck > 0.001 ? (deltaNeck / distNeck) : vec2(0.0, 1.0);
                    float neckWeight = smoothstep(0.14, 0.03, distNeck) * neckSpanY;
                    defPos.xz += dirNeck * effectiveFaceFat * 0.040 * neckWeight;
                  }
                }

                // 2. تناسق وسمنة الوجه كالدب (Chubby Bear Face, Smooth Cheeks & Double Chin)
                if (uIsHead > 0.5) {
                  // تحجيم الرأس العام
                  vec3 headCenter = vec3(0.0, 0.663, 0.072);
                  defPos = headCenter + (defPos - headCenter) * uHeadScale;

                  // أ. الخدود الممتلئة وتدوير الوجه كالدب بدون زوايا حادة مربعة (Soft Chubby Bear Cheeks)
                  float cheekY = smoothstep(0.54, 0.64, position.y) * smoothstep(0.76, 0.64, position.y);
                  float cheekZ = smoothstep(-0.01, 0.08, position.z);
                  float cheekX = smoothstep(0.015, 0.08, abs(position.x));
                  float cheekWeight = cheekY * cheekZ * cheekX;
                  defPos.x += sign(position.x) * effectiveFaceFat * 0.028 * cheekWeight;
                  defPos.z += effectiveFaceFat * 0.016 * cheekWeight;

                  // ب. تعريض زوايا الفك السفلي (Wide Bear Jawline)
                  float jawY = smoothstep(0.53, 0.61, position.y) * smoothstep(0.68, 0.61, position.y);
                  float jawSide = smoothstep(0.02, 0.075, abs(position.x));
                  float jawWeight = jawY * jawSide;
                  defPos.x += sign(position.x) * effectiveFaceFat * 0.024 * jawWeight;

                  // ج. اللغلوغ والذقن المزدوج تحت الفك (Double Chin & Jowls)
                  float chinY = smoothstep(0.51, 0.57, position.y) * smoothstep(0.63, 0.57, position.y);
                  float chinFront = smoothstep(-0.01, 0.06, position.z);
                  float chinCenter = smoothstep(0.07, 0.01, abs(position.x));
                  float chinWeight = chinY * chinFront * chinCenter;
                  defPos.y -= effectiveFaceFat * 0.016 * chinWeight;
                  defPos.z += effectiveFaceFat * 0.022 * chinWeight;

                  // د. تدوير عرض الوجه والجمجمة (Full Round Head Shape)
                  float headFullY = smoothstep(0.54, 0.65, position.y) * smoothstep(0.79, 0.67, position.y);
                  float headSide = smoothstep(0.025, 0.085, abs(position.x));
                  defPos.x += sign(position.x) * effectiveFaceFat * 0.016 * headFullY * headSide;
                }

                // 3. عظام وأكتاف الدب المتناسقة (Harmonious Shoulder & Deltoid Bulk)
                vec3 shCenter = vec3(sign(position.x) * 0.22, 0.38, -0.05);
                vec3 deltaSh = position - shCenter;
                float distSh = length(deltaSh);
                if (distSh < 0.26) {
                  float shWeight = smoothstep(0.26, 0.04, distSh);
                  vec3 radialDir = normalize(deltaSh);
                  float effectiveShoulder = (uShoulderWidth - 1.0) + fatBonus * 0.25;
                  defPos += radialDir * effectiveShoulder * 0.12 * shWeight;
                }

                // 4. عظام وعضلات اليدين والذراعين المتناسقة مع الأكمام فقط (Harmonious Heavy Arms & Sleeves Bulk)
                if (uIsUppr > 0.5 || (uIsJbib > 0.5 && position.y > 0.18)) {
                  float armWeightY = smoothstep(0.38, 0.26, position.y) * smoothstep(-0.16, -0.04, position.y);
                  float armWeightX = smoothstep(0.18, 0.28, abs(position.x));
                  float armWeight = armWeightY * armWeightX;

                  float armCenterY = -0.06 + (0.21 - (-0.06)) * smoothstep(0.0, 0.25, position.y);
                  float armCenterZ = -0.035 + (-0.06 - (-0.035)) * smoothstep(0.0, 0.25, position.y);
                  vec2 radialArm = defPos.yz - vec2(armCenterY, armCenterZ);

                  float effectiveArm = (uArmMuscles - 1.0) + fatBonus * 0.30;
                  defPos.yz += radialArm * effectiveArm * 0.40 * armWeight;
                  defPos.x += sign(position.x) * effectiveArm * 0.08 * armWeight;
                }

                // 5. مجسم دب كامل واقعي للمنطقة بالكامل (Full Torso Heavy-Set Fat Body / دب كامل ناعم)
                float torsoSpanY = smoothstep(0.40, 0.16, position.y) * smoothstep(-0.45, -0.15, position.y);
                if (torsoSpanY > 0.001) {
                  vec2 torsoCenter = vec2(0.0, -0.02);
                  vec2 deltaXZ = defPos.xz - torsoCenter;
                  float distXZ = length(deltaXZ);
                  vec2 dirXZ = distXZ > 0.001 ? (deltaXZ / distXZ) : vec2(0.0, 1.0);

                  // انحناء ناعم للكرش بدون أي أطراف حادة تسبب خطوطاً
                  float frontWeight = smoothstep(-0.25, 0.70, dirXZ.y);
                  float bellyDome = smoothstep(0.34, 0.02, position.y) * smoothstep(-0.25, 0.02, position.y);

                  float forwardPush = (dirXZ.y * 0.18 + frontWeight * bellyDome * 0.20) * fatAmount * torsoSpanY;
                  float sideWiden = dirXZ.x * 0.16 * fatAmount * torsoSpanY;

                  defPos.z += forwardPush;
                  defPos.x += sideWiden;
                  defPos.y -= fatAmount * 0.032 * torsoSpanY * frontWeight;
                }

                // 6. عضلات وعظم القفص الصدري المتناسق (3D Barrel Chest & Ribcage Bulk كالدب)
                float chestSpanY = smoothstep(0.46, 0.32, position.y) * smoothstep(0.10, 0.24, position.y);
                float chestSpanX = smoothstep(0.26, 0.04, abs(position.x));
                float chestTorso = chestSpanY * chestSpanX;
                if (chestTorso > 0.001) {
                  float effectiveChest = (uChestBulk - 1.0) + fatBonus * 0.35;
                  // صدر أمامي قوي وبارز
                  float frontPec = smoothstep(-0.06, 0.08, position.z);
                  defPos.z += effectiveChest * 0.20 * chestTorso * frontPec;
                  // توسعة جوانب القفص الصدري (عضلات المجنص والقفص كالدب)
                  defPos.x += sign(position.x) * effectiveChest * 0.12 * chestTorso;
                  // توسعة الظهر العلوي واللوح ليعطي شكل البرميل الصلب
                  float backRib = smoothstep(-0.02, -0.12, position.z);
                  defPos.z -= effectiveChest * 0.07 * chestTorso * backRib;
                }

                // 7. عضلات وسمنة الفخذين المتناسقة (Harmonious Heavy Thighs Bulk)
                if (uIsLowr > 0.5) {
                  float thighWeightY = smoothstep(-0.76, -0.48, position.y) * smoothstep(-0.06, -0.18, position.y);
                  float signThighX = sign(position.x);
                  vec2 thighCenterXZ = vec2(signThighX * 0.11, -0.015);
                  vec2 radialThigh = defPos.xz - thighCenterXZ;
                  float effectiveThigh = (uThighBulk - 1.0) + fatBonus * 0.45;
                  defPos.xz += radialThigh * effectiveThigh * 0.44 * thighWeightY;
                }

                // 8. محاكاة حركة الأرجل والأذرع والجذع الواقعية لفايف إم (FiveM Authentic Smooth Kinematics)
                if (uAnimActive > 0.5) {
                  // أ. هبوط وصعود الحوض وتمايل الجذع (Pelvis Bob & Hip Sway)
                  defPos.y += uPelvisBob;
                  float hipRollW = smoothstep(0.40, -0.25, position.y);
                  defPos.x += uPelvisRoll * hipRollW;

                  // التواء العمود الفقري الطبيعي مع حركة المشي
                  float spineW = smoothstep(-0.08, 0.40, position.y);
                  if (abs(uSpineTwist) > 0.0001 && spineW > 0.001) {
                    float aSp = uSpineTwist * spineW;
                    float cSp = cos(aSp);
                    float sSp = sin(aSp);
                    defPos.xz = vec2(defPos.x * cSp - defPos.z * sSp, defPos.x * sSp + defPos.z * cSp);
                  }

                  // ب. حركة الرجلين بانسيابية وثني ركب وتثبيت الحجر لمنع التمزق
                  if (uIsLowr > 0.5 || uIsFeet > 0.5) {
                    float legActiveY = smoothstep(-0.04, -0.16, position.y);
                    float crotchSeam = smoothstep(0.012, 0.065, abs(position.x));
                    float legBlend = legActiveY * crotchSeam;

                    if (legBlend > 0.001) {
                      if (position.x > 0.0) {
                        // الرجل اليسرى (Left Leg)
                        vec3 hipL = vec3(0.095, -0.08, -0.015);
                        float aThigh = uLegSwingL * legBlend;
                        float cT = cos(aThigh);
                        float sT = sin(aThigh);
                        
                        vec3 vThigh = defPos - hipL;
                        defPos.z = hipL.z + (vThigh.z * cT - vThigh.y * sT);
                        defPos.y = hipL.y + (vThigh.z * sT + vThigh.y * cT);

                        float thighLen = 0.38;
                        vec3 kneeL = hipL + vec3(0.0, -thighLen * cT, -thighLen * sT);

                        float kneeWeight = smoothstep(-0.44, -0.56, position.y) * crotchSeam;
                        if (kneeWeight > 0.001) {
                          float aKnee = uKneeBendL * kneeWeight;
                          float cK = cos(aKnee);
                          float sK = sin(aKnee);
                          vec3 vKnee = defPos - kneeL;
                          defPos.z = kneeL.z + (vKnee.z * cK + vKnee.y * sK);
                          defPos.y = kneeL.y + (-vKnee.z * sK + vKnee.y * cK);

                          float footWeight = smoothstep(-0.74, -0.84, position.y) * crotchSeam;
                          if (footWeight > 0.001) {
                            float aFoot = uFootPitchL * footWeight;
                            float cF = cos(aFoot);
                            float sF = sin(aFoot);
                            vec3 ankleL = kneeL + vec3(0.0, -0.32, -0.02);
                            vec3 vFoot = defPos - ankleL;
                            defPos.z = ankleL.z + (vFoot.z * cF - vFoot.y * sF);
                            defPos.y = ankleL.y + (vFoot.z * sF + vFoot.y * cF);
                          }
                        }
                      } else {
                        // الرجل اليمنى (Right Leg)
                        vec3 hipR = vec3(-0.095, -0.08, -0.015);
                        float aThighR = uLegSwingR * legBlend;
                        float cTR = cos(aThighR);
                        float sTR = sin(aThighR);

                        vec3 vThighR = defPos - hipR;
                        defPos.z = hipR.z + (vThighR.z * cTR - vThighR.y * sTR);
                        defPos.y = hipR.y + (vThighR.z * sTR + vThighR.y * cTR);

                        float thighLenR = 0.38;
                        vec3 kneeR = hipR + vec3(0.0, -thighLenR * cTR, -thighLenR * sTR);

                        float kneeWeightR = smoothstep(-0.44, -0.56, position.y) * crotchSeam;
                        if (kneeWeightR > 0.001) {
                          float aKneeR = uKneeBendR * kneeWeightR;
                          float cKR = cos(aKneeR);
                          float sKR = sin(aKneeR);
                          vec3 vKneeR = defPos - kneeR;
                          defPos.z = kneeR.z + (vKneeR.z * cKR + vKneeR.y * sKR);
                          defPos.y = kneeR.y + (-vKneeR.z * sKR + vKneeR.y * cKR);

                          float footWeightR = smoothstep(-0.74, -0.84, position.y) * crotchSeam;
                          if (footWeightR > 0.001) {
                            float aFootR = uFootPitchR * footWeightR;
                            float cFR = cos(aFootR);
                            float sFR = sin(aFootR);
                            vec3 ankleR = kneeR + vec3(0.0, -0.32, -0.02);
                            vec3 vFootR = defPos - ankleR;
                            defPos.z = ankleR.z + (vFootR.z * cFR - vFootR.y * sFR);
                            defPos.y = ankleR.y + (vFootR.z * sFR + vFootR.y * cFR);
                          }
                        }
                      }
                    }
                  }

                  // ج. حركة الذراعين وأكمام التيشيرت مع حماية تامة لجسم التيشيرت من التمزق
                  bool isArmMesh = (uIsUppr > 0.5 && abs(position.x) > 0.16) || (uIsJbib > 0.5 && position.y > 0.18 && abs(position.x) > 0.18);
                  if (isArmMesh) {
                    if (position.x > 0.0) {
                      // الذراع اليسرى
                      vec3 shL = vec3(0.20, 0.35, -0.03);
                      float armW = smoothstep(0.16, 0.24, position.x) * smoothstep(0.42, 0.32, position.y);
                      if (armW > 0.001) {
                        float aArm = uArmSwingL * armW;
                        float cA = cos(aArm);
                        float sA = sin(aArm);
                        vec3 vArm = defPos - shL;
                        defPos.z = shL.z + (vArm.z * cA - vArm.y * sA);
                        defPos.y = shL.y + (vArm.z * sA + vArm.y * cA);

                        float upperArmLen = 0.25;
                        vec3 elbowL = shL + vec3(0.03, -upperArmLen * cA, -upperArmLen * sA);

                        float elbowW = smoothstep(0.20, 0.08, position.y);
                        if (elbowW > 0.001) {
                          float aElb = uElbowBendL * elbowW;
                          float cE = cos(aElb);
                          float sE = sin(aElb);
                          vec3 vElb = defPos - elbowL;
                          defPos.z = elbowL.z + (vElb.z * cE - vElb.y * sE);
                          defPos.y = elbowL.y + (vElb.z * sE + vElb.y * cE);
                        }
                      }
                    } else {
                      // الذراع اليمنى
                      vec3 shR = vec3(-0.20, 0.35, -0.03);
                      float armWR = smoothstep(0.16, 0.24, abs(position.x)) * smoothstep(0.42, 0.32, position.y);
                      if (armWR > 0.001) {
                        float aArmR = uArmSwingR * armWR;
                        float cAR = cos(aArmR);
                        float sAR = sin(aArmR);
                        vec3 vArmR = defPos - shR;
                        defPos.z = shR.z + (vArmR.z * cAR - vArmR.y * sAR);
                        defPos.y = shR.y + (vArmR.z * sAR + vArmR.y * cAR);

                        float upperArmLenR = 0.25;
                        vec3 elbowR = shR + vec3(-0.03, -upperArmLenR * cAR, -upperArmLenR * sAR);

                        float elbowWR = smoothstep(0.20, 0.08, position.y);
                        if (elbowWR > 0.001) {
                          float aElbR = uElbowBendR * elbowWR;
                          float cER = cos(aElbR);
                          float sER = sin(aElbR);
                          vec3 vElbR = defPos - elbowR;
                          defPos.z = elbowR.z + (vElbR.z * cER - vElbR.y * sER);
                          defPos.y = elbowR.y + (vElbR.z * sER + vElbR.y * cER);
                        }
                      }
                    }
                  }
                }

                // 9. تشوهات الوجه والجسم المتقدمة (Facial & Body Deformities & Asymmetry)
                // أ. تشوهات الوجه الخاصة بالرأس (Crooked Nose, Twisted Jaw, Asymmetric Eyes/Cheeks)
                if (uIsHead > 0.5) {
                  // كسر وانحراف الأنف (Crooked / Broken Nose)
                  if (abs(uCrookedNose) > 0.001) {
                    float noseY = smoothstep(0.59, 0.63, position.y) * smoothstep(0.68, 0.63, position.y);
                    float noseZ = smoothstep(0.06, 0.12, position.z);
                    float noseX = smoothstep(0.035, 0.005, abs(position.x));
                    float noseWeight = noseY * noseZ * noseX;
                    defPos.x += uCrookedNose * 0.022 * noseWeight;
                    defPos.z -= abs(uCrookedNose) * 0.010 * noseWeight * smoothstep(0.63, 0.66, position.y);
                  }

                  // اعوجاج والتواء الفك السفلي نحو اليمين أو اليسار (Twisted / Wry Jaw)
                  if (abs(uJawTwist) > 0.001) {
                    float jawDistortY = smoothstep(0.61, 0.52, position.y) * smoothstep(0.48, 0.53, position.y);
                    float jawDistortZ = smoothstep(0.01, 0.06, position.z);
                    float jawWeight = jawDistortY * jawDistortZ;
                    defPos.x += uJawTwist * 0.024 * jawWeight;
                    defPos.y += abs(uJawTwist) * 0.008 * jawWeight * sign(position.x);
                  }

                  // تشوهات وعدم تناسق ملامح الوجه وتدلي العين وانتفاخ الخد (Horror Facial Disfigurement)
                  if (uFaceDistortion > 0.001) {
                    // تدلي محجر وجفن العين اليسرى
                    float eyeL = smoothstep(0.63, 0.67, position.y) * smoothstep(0.72, 0.67, position.y) 
                               * smoothstep(0.01, 0.045, position.x) * smoothstep(0.07, 0.045, position.x)
                               * smoothstep(0.04, 0.09, position.z);
                    defPos.y -= uFaceDistortion * 0.016 * eyeL;
                    defPos.z += uFaceDistortion * 0.012 * eyeL;

                    // تورم وانتفاخ غير متناسق في الخد الأيمن
                    float cheekR = smoothstep(0.56, 0.63, position.y) * smoothstep(0.69, 0.63, position.y)
                                 * smoothstep(-0.015, -0.055, position.x) * smoothstep(-0.08, -0.055, position.x)
                                 * smoothstep(0.02, 0.07, position.z);
                    defPos.x -= uFaceDistortion * 0.022 * cheekR;
                    defPos.z += uFaceDistortion * 0.018 * cheekR;

                    // تكتلات وتجاعيد جلدية غير منتظمة على بشرة الوجه
                    float skinLump = sin(position.y * 65.0) * cos(position.x * 55.0) * sin(position.z * 60.0);
                    float faceFront = smoothstep(0.02, 0.08, position.z) * smoothstep(0.52, 0.65, position.y);
                    vec3 headCenterLocal = vec3(0.0, 0.663, 0.072);
                    defPos += (position - headCenterLocal) * skinLump * 0.05 * uFaceDistortion * faceFront;
                  }

                  // الحفر والتجويف ثلاثي الأبعاد لجروح وضربات الوجه المشوه (3D Physical Facial Slash Trench)
                  if (uFaceSlashType > 0.5 && uFaceSlashDepth > 0.001) {
                    float dToSlash = 1.0;
                    float slashMask = 0.0;

                    if (uFaceSlashType > 0.5 && uFaceSlashType < 1.5) {
                      float sX = -0.036 + (position.y - 0.70) * 0.22;
                      dToSlash = abs(position.x - sX);
                      slashMask = step(0.610, position.y) * step(position.y, 0.785) * step(0.045, position.z);
                    } else if (uFaceSlashType > 1.5 && uFaceSlashType < 2.5) {
                      float sY = 0.648 + sin((position.x - 0.038) * 40.0) * 0.005;
                      dToSlash = abs(position.y - sY);
                      slashMask = step(0.015, position.x) * step(position.x, 0.068) * step(0.050, position.z);
                    } else if (uFaceSlashType > 2.5 && uFaceSlashType < 3.5) {
                      float d1 = abs(position.y - (0.680 + position.x * 0.85));
                      float d2 = abs(position.y - (0.680 - position.x * 0.85));
                      dToSlash = min(d1, d2);
                      slashMask = step(abs(position.x), 0.052) * step(0.625, position.y) * step(position.y, 0.730) * step(0.055, position.z);
                    } else if (uFaceSlashType > 3.5) {
                      float sY = 0.612 - (position.x - 0.022) * 0.65;
                      dToSlash = abs(position.y - sY);
                      slashMask = step(0.018, position.x) * step(position.x, 0.062) * step(0.575, position.y) * step(position.y, 0.635) * step(0.045, position.z);
                    }

                    if (slashMask > 0.5 && dToSlash < 0.016) {
                      float indent = smoothstep(0.014, 0.000, dToSlash) * uFaceSlashDepth * 0.016;
                      float lipSwell = smoothstep(0.016, 0.010, dToSlash) * smoothstep(0.003, 0.010, dToSlash) * uFaceSlashDepth * 0.005;
                      defPos.z -= indent;
                      defPos.x += (position.x > 0.0 ? 1.0 : -1.0) * lipSwell;
                    }
                  }

                  // هبوط وتجويف العين المفقوعة للداخل ثلاثي الأبعاد (Gouged Eye Socket 3D Depression)
                  if (uGougedEyeL > 0.5) {
                    vec3 eyeCenterL = vec3(0.0300, 0.7007, 0.0880);
                    float distGougeL = length(position - eyeCenterL);
                    if (distGougeL < 0.022) {
                      float gougeDepth = smoothstep(0.022, 0.003, distGougeL);
                      defPos.z -= 0.024 * gougeDepth;
                      defPos.xy -= (position.xy - eyeCenterL.xy) * 0.15 * gougeDepth;
                    }
                  }
                  if (uGougedEyeR > 0.5) {
                    vec3 eyeCenterR = vec3(-0.0300, 0.7007, 0.0880);
                    float distGougeR = length(position - eyeCenterR);
                    if (distGougeR < 0.022) {
                      float gougeDepthR = smoothstep(0.022, 0.003, distGougeR);
                      defPos.z -= 0.024 * gougeDepthR;
                      defPos.xy -= (position.xy - eyeCenterR.xy) * 0.15 * gougeDepthR;
                    }
                  }
                }

                // ب. حدبة وانحناء أعلى الظهر مع دفع الرقبة للأمام (Hunchback / Kyphosis)
                if (uHunchback > 0.001) {
                  if (uIsUppr > 0.5 || uIsJbib > 0.5) {
                    float humpSpanY = smoothstep(0.18, 0.34, position.y) * smoothstep(0.48, 0.34, position.y);
                    float humpBackZ = smoothstep(0.01, -0.10, position.z);
                    float humpCenterX = smoothstep(0.18, 0.02, abs(position.x));
                    float humpWeight = humpSpanY * humpBackZ * humpCenterX;
                    defPos.z -= uHunchback * 0.14 * humpWeight;
                    defPos.y += uHunchback * 0.05 * humpWeight;
                  }

                  if (uIsHead > 0.5 || position.y > 0.45) {
                    float headHunchW = smoothstep(0.42, 0.65, position.y);
                    defPos.z += uHunchback * 0.075 * headHunchW;
                    defPos.y -= uHunchback * 0.040 * headHunchW;
                  }
                }

                // ج. ميلان وعدم تناسق الأكتاف والعمود الفقري (Uneven Shoulders / Scoliosis)
                if (uBodyAsymmetry > 0.001) {
                  if (uIsUppr > 0.5 || uIsJbib > 0.5) {
                    float shoulderSpan = smoothstep(0.15, 0.40, position.y);
                    defPos.y += position.x * uBodyAsymmetry * 0.12 * shoulderSpan;
                    float spineCurve = sin(smoothstep(-0.20, 0.40, position.y) * 3.14159);
                    defPos.x += uBodyAsymmetry * 0.045 * spineCurve;
                  }
                }

                // د. كتل وأورام مشوهة بارزة في الجسم (Grotesque Body Lumps)
                if (uGrotesqueLumps > 0.001) {
                  float bodyLumpNoise = sin(position.y * 35.0) * cos(position.x * 30.0 + position.z * 25.0);
                  if (bodyLumpNoise > 0.35) {
                    float lumpWeight = smoothstep(0.35, 0.9, bodyLumpNoise) * uGrotesqueLumps;
                    defPos += normalize(vec3(position.x, 0.0, position.z)) * lumpWeight * 0.045;
                  }
                }

                // تسوية ومحاذاة طية وحاشية الخصر اليسرى لتطابق انحناءة وتناسق الخصر الأيمن بشكل طبيعي متناسق
                if (uIsJbib > 0.5 && position.x > 0.10 && position.y < 0.05) {
                  float leftHemPull = smoothstep(0.10, 0.18, position.x) * smoothstep(0.05, -0.085, position.y);
                  defPos.x -= leftHemPull * 0.018;
                  defPos.z = min(defPos.z, 0.115);
                }
                if (uIsLowr > 0.5 && position.x > 0.10 && position.y > -0.09 && position.z > 0.015) {
                  float hipWaistPull = smoothstep(0.10, 0.18, position.x);
                  defPos.x -= hipWaistPull * 0.015;
                  defPos.z = min(defPos.z, 0.110);
                }

                // النحت التشريحي المخصص للملابس القديمة فقط (يتم تجاوزه بالكامل عند استخدام شبكات فايف إم العارية الأصلية uIsBareMesh)
                if (uIsBareMesh < 0.5) {
                  // هـ. النحت التشريحي للجذع والصدر عند فصخ البلوزة
                  if (uIsJbib > 0.5 && uStripShirt > 0.5) {
                    // 1. تسطيح ودمج ياقة الرقبة بالكامل مع أسطوانة الرقبة
                    if (position.y > 0.42) {
                      float collarPull = smoothstep(0.42, 0.52, position.y);
                      vec2 neckCenter = vec2(0.0, 0.015);
                      vec2 dirInward = defPos.xz - neckCenter;
                      defPos.xz -= dirInward * 0.28 * collarPull;
                      defPos.y -= 0.012 * collarPull;
                    }

                    // 2. إزالة أكمام التيشيرت تماماً وضمها بإحكام لسطح الذراع والكتف
                    if (abs(position.x) > 0.16 && position.y < 0.42) {
                      float armSignX = sign(position.x);
                      vec2 armAxis = vec2(armSignX * 0.22, -0.04);
                      vec2 deltaArm = defPos.xz - armAxis;
                      float armDist = length(deltaArm);
                      float sleeveFactor = smoothstep(0.16, 0.24, abs(position.x)) * smoothstep(0.42, 0.28, position.y);
                      if (sleeveFactor > 0.001 && armDist > 0.048) {
                        float targetR = mix(armDist, 0.048, sleeveFactor * 0.85);
                        defPos.xz = armAxis + normalize(deltaArm) * targetR;
                      }
                      // سحب الحاشية السفلية المنسدلة للكم للداخل
                      if (position.y < 0.24) {
                        float cuffDrop = smoothstep(0.24, 0.16, position.y);
                        defPos.y += 0.015 * cuffDrop;
                      }
                    }

                    // 3. تسطيح وإدخال حاشية التيشيرت المترهلة عند الخصر لتلتحم بالبطن والحزام flush
                    if (position.y < 0.10) {
                      float hemTuck = smoothstep(0.10, -0.08, position.y);
                      if (defPos.z > 0.0) {
                        defPos.z -= 0.024 * hemTuck;
                      } else {
                        defPos.z += 0.030 * hemTuck;
                      }
                      defPos.x -= sign(defPos.x) * 0.018 * hemTuck;
                      defPos.y += 0.014 * hemTuck;
                    }

                    // 4. تجسيم وتحديد عضلات الصدر (Pectorals) وعظمة القص الرجولية
                    if (position.y > 0.18 && position.y < 0.42 && position.z > 0.02) {
                      float pecY = smoothstep(0.18, 0.30, position.y) * smoothstep(0.42, 0.30, position.y);
                      float pecX = smoothstep(0.012, 0.07, abs(position.x)) * smoothstep(0.18, 0.09, abs(position.x));
                      defPos.z += 0.016 * pecY * pecX;
                      // أخدود عظم القص في المنتصف (Sternal Groove)
                      float sternumGroove = smoothstep(0.022, 0.002, abs(position.x)) * step(0.20, position.y) * step(position.y, 0.38);
                      defPos.z -= 0.009 * sternumGroove;
                    }

                    // 5. نحت عضلات الظهر واللوحين (Scapula & Latissimus Dorsi) وإزالة تجاعيد التيشيرت
                    if (position.y > 0.10 && position.y < 0.44 && position.z < -0.02) {
                      float backY = smoothstep(0.10, 0.28, position.y) * smoothstep(0.44, 0.28, position.y);
                      float latX = smoothstep(0.06, 0.16, abs(position.x));
                      defPos.x += sign(position.x) * 0.012 * backY * latX;
                      // انخفاض العمود الفقري الطبيعي في منتصف الظهر
                      float spineDepress = smoothstep(0.028, 0.003, abs(position.x)) * backY;
                      defPos.z += 0.010 * spineDepress;
                    }
                  }

                  // و. النحت التشريحي الواقعي للأرجل العارية والبوكسر الرياضي عند فصخ السروال (Anatomical Legs Sculpting)
                  if (uIsLowr > 0.5 && uStripPants > 0.5) {
                    float legSignX = position.x < 0.0 ? -0.095 : 0.095;
                    vec2 legCenter = vec2(legSignX, -0.010);
                    vec2 dirLeg = defPos.xz - legCenter;
                    float curR = length(dirLeg);

                    // 1. إزالة كفة الجينز المتسعة التي تغطي الحذاء ورفعها لأعلى الحذاء تماماً
                    if (position.y < -0.72) {
                      float ankleWeight = smoothstep(-0.72, -0.88, position.y);
                      // تنحيف كاحل الساق البشري الطبيعي
                      float targetAnkleR = 0.043;
                      if (curR > targetAnkleR) {
                        defPos.xz = legCenter + normalize(dirLeg) * mix(curR, targetAnkleR, ankleWeight * 0.90);
                      }
                      // رفع كفة القماش التي تتدلى تحت مستوى فتحة الحذاء (-0.85)
                      if (position.y < -0.84) {
                        float cuffDrop = smoothstep(-0.84, -0.98, position.y);
                        defPos.y += ((-0.845) - defPos.y) * cuffDrop;
                      }
                    }

                    // 2. نحت عضلة الساق والبطة (Gastrocnemius Calf Muscle) وإزالة تجاعيد القماش
                    if (position.y >= -0.72 && position.y < -0.48) {
                      float calfY = smoothstep(-0.72, -0.60, position.y) * smoothstep(-0.48, -0.60, position.y);
                      // بروز بطة الساق للخلف والجانبين
                      float backBulge = smoothstep(0.0, -0.04, dirLeg.y);
                      defPos.z -= 0.012 * calfY * backBulge;
                      defPos.x += sign(dirLeg.x) * 0.008 * calfY;
                      // صقل وتنعيم تجاعيد البنطلون العشوائية لتصبح أسطوانة عضلية ملساء
                      float targetCalfR = mix(0.048, 0.066, calfY);
                      if (curR > targetCalfR) {
                        defPos.xz = legCenter + normalize(dirLeg) * mix(curR, targetCalfR, 0.65);
                      }
                    }

                    // 3. نحت صابونة الركبة البارزة تشريحياً وتجويف خلف الركبة
                    if (position.y >= -0.53 && position.y <= -0.43) {
                      float dKneeP = length(vec2(abs(position.x) - 0.095, position.y - (-0.48)));
                      // صابونة الركبة الأمامية
                      if (dirLeg.y > 0.0 && dKneeP < 0.035) {
                        defPos.z += 0.012 * smoothstep(0.035, 0.008, dKneeP);
                      }
                      // تجويف خلف الركبة (Popliteal Fossa)
                      if (dirLeg.y < -0.01 && dKneeP < 0.035) {
                        defPos.z += 0.010 * smoothstep(0.035, 0.008, dKneeP);
                      }
                    }

                    // 4. شد ونحت الفخذين (Quadriceps) والتخلص من طيات الجينز الواسعة
                    if (position.y > -0.45 && position.y < -0.22) {
                      float thighY = smoothstep(-0.45, -0.32, position.y) * smoothstep(-0.22, -0.32, position.y);
                      // تنعيم الفخذ ليكون عضلياً ومتناسقاً
                      float targetThighR = mix(0.064, 0.078, thighY);
                      if (curR > targetThighR) {
                        defPos.xz = legCenter + normalize(dirLeg) * mix(curR, targetThighR, 0.60);
                      }
                      // بروز عضلات الفخذ الأمامية (Rectus Femoris)
                      if (dirLeg.y > 0.01) {
                        defPos.z += 0.010 * thighY;
                      }
                    }

                    // 5. شورت البوكسر الرياضي (Boxer Briefs) على الحوض والأرداف
                    if (position.y >= -0.24) {
                      // جعل شورت البوكسر ملاصقاً تماماً للحوض بدون ثنيات الجينز الضخمة
                      float boxerTight = smoothstep(-0.24, -0.12, position.y);
                      defPos.xz = mix(defPos.xz, legCenter + normalize(dirLeg) * min(curR, 0.088), boxerTight * 0.45);
                    }
                  }
                }

                // ز. استوديو تفصيل وقص وتطريز الملابس وتناسق المقاسات لكل الأجسام (Clothing Studio 3D Fit)
                if (uTailorActive > 0.5) {
                  if (uIsJbib > 0.5) {
                    // 1. التكيف التلقائي مع المقاييس لمنع التمزق والاختراق مع أي جسم (Fit for All Bodies Anti-Clipping)
                    float torsoMarginMask = smoothstep(0.22, 0.16, abs(position.x));
                    float clothMargin = 0.010 + clamp((uClothWidth - 56.0) * 0.0012, -0.002, 0.035);
                    vec2 centerTorso = vec2(0.0, -0.02);
                    vec2 dirFromCenter = defPos.xz - centerTorso;
                    float distFromCenter = length(dirFromCenter);
                    if (distFromCenter > 0.001) {
                      defPos.x += (dirFromCenter.x / distFromCenter) * clothMargin * torsoMarginMask;
                      defPos.z += (dirFromCenter.y / distFromCenter) * clothMargin;
                    }

                    // 2. نحت فتحة الرقبة الهندسي الانسيابي بدون أي تقطيع أو حواف حادة (Smooth Sculpted Neckline)
                    if (position.y > 0.35 && abs(position.x) < 0.16 && position.z > 0.01) {
                      float neckRatio = clamp((uNeckline - 15.0) / 30.0, 0.0, 1.0);
                      float collarMask = smoothstep(0.14, 0.01, abs(position.x)) * smoothstep(0.48, 0.37, position.y);
                      defPos.y -= neckRatio * 0.054 * collarMask;
                      defPos.z -= neckRatio * 0.018 * collarMask;
                      float collarWiden = smoothstep(0.45, 0.37, position.y) * smoothstep(0.03, 0.12, abs(position.x));
                      defPos.x += sign(position.x) * neckRatio * 0.018 * collarWiden;
                    }

                    // 3. تعديل الأكتاف الأربعة المستقلة بانسيابية تامة ثنائية الأبعاد بدون أي تقطيع (Smooth 2D Bilinear Shoulder Morph)
                    if (position.y > 0.35 && abs(position.x) > 0.06 && abs(position.x) < 0.23) {
                      float frontWeight = smoothstep(-0.06, 0.06, position.z);
                      float leftWeight  = smoothstep(-0.04, 0.04, position.x);

                      float backOffset  = mix(uBackShoulderR, uBackShoulderL, leftWeight);
                      float frontOffset = mix(uShoulderR,     uShoulderL,     leftWeight);
                      float shOffset    = mix(backOffset,     frontOffset,    frontWeight);

                      float shMask = smoothstep(0.06, 0.16, abs(position.x)) * smoothstep(0.35, 0.44, position.y);
                      defPos.y += shOffset * 0.005 * shMask;
                      defPos.x += sign(position.x) * shOffset * 0.003 * shMask;
                    }

                    // 4. تعديل عرض التيشيرت المستقل للجانبين بتمدد أسطواني شعاعي متصل 360 درجة بدون أي تمزق
                    float wRatio = (uClothWidth - 56.0) / 56.0;
                    if (position.y < 0.42 && abs(position.x) < 0.25) {
                      float sideSign = sign(position.x);
                      float indivWaist = sideSign > 0.0 ? uWaistL : uWaistR;
                      // عزل تأثير الخصر حصرياً لمنطقة أسفل الصدر والبطن دون التأثير على الأكمام أو الأكتاف
                      float waistMask = smoothstep(0.34, 0.22, position.y) * smoothstep(0.04, 0.16, abs(position.x));
                      float totalW = wRatio * 0.035 + indivWaist * 0.003 * waistMask;
                      
                      // تمدد شعاعي ناعم ومتصل حول محور الجذع (0.0, -0.015)
                      vec2 torsoCenter = vec2(0.0, -0.015);
                      vec2 dCenter = position.xz - torsoCenter;
                      float dLen = length(dCenter);
                      vec2 dirOut = dLen > 0.001 ? (dCenter / dLen) : vec2(sideSign, 0.0);
                      
                      defPos.x += dirOut.x * totalW;
                      defPos.z += dirOut.y * (totalW * 0.75);

                      // استطالة الحاشية السفلية عند زيادة الطول فوق المعدل الافتراضي
                      if (uClothLength > 78.0) {
                        float hemExt = (uClothLength - 78.0) * 0.0035;
                        float hemMask = smoothstep(0.24, -0.15, position.y);
                        defPos.y -= hemExt * hemMask;
                      }
                    }

                    // 5. استطالة وتطريز الأكمام المستقلة للكمين الأيسر والأيمن بانسيابية واقعية على طول الذراع حتى المعصم
                    float armSign = sign(position.x);
                    float sLen = armSign > 0.0 ? uSleeveLengthL : uSleeveLengthR;
                    float sWidRatio = (uSleeveWidth - 40.0) / 40.0;

                    vec3 armS = vec3(0.24, 0.38, -0.07);
                    vec3 armW = vec3(0.56, -0.10, -0.033);
                    vec3 armVec = armW - armS;
                    float armLen = length(armVec);
                    vec3 armDir = armVec / armLen;
                    vec3 localArmP = vec3(abs(position.x), position.y, position.z);
                    float tArm = dot(localArmP - armS, armDir) / armLen;
                    vec3 bonePtLocal = armS + clamp(tArm, 0.0, 1.0) * armVec;
                    float perpD = length(localArmP - bonePtLocal);

                    // ضم حافة الكم القصير المتسعة للداخل عند تطويل الكم لتندمج مع الكم الطويل كقطعة واحدة انسيابية بدون أي بروز أو طبقتين
                    if (sLen > 28.5 && abs(position.x) > 0.19 && position.y < 0.44 && tArm > 0.05 && perpD < 0.105) {
                      float longBlend = clamp((sLen - 28.5) / 5.0, 0.0, 1.0);
                      vec3 rVec = localArmP - bonePtLocal;
                      float rLen = length(rVec);
                      if (rLen > 0.001) {
                        vec3 rDir = (rVec / rLen);
                        rDir.x *= armSign;
                        float innerMask = smoothstep(0.31, 0.255, position.y);
                        float wallTaper = (0.0055 + innerMask * 0.0095) * smoothstep(0.06, 0.14, tArm);
                        defPos -= rDir * (wallTaper * longBlend);
                      }
                    }

                    // 6. ثنيات وانسيابية القماش الطبيعية وسقوط الجاذبية (Flowing Cloth Drape & Gravity Folds)
                    float wave1 = sin(position.x * 12.0 + sin(position.y * 6.0) * 0.8) * 0.0035;
                    float wave2 = cos(position.x * 20.0 - position.y * 8.0) * 0.0018;
                    float drapeMask = smoothstep(0.38, 0.02, position.y) * smoothstep(0.20, 0.14, abs(position.x));
                    float totalWave = (wave1 + wave2) * drapeMask;

                    // اتساع وتمايل القماش الفضفاض عند زيادة العرض
                    float billow = max(0.0, wRatio) * 0.0035 * sin(position.x * 8.0 + position.y * 6.0);
                    totalWave += billow * drapeMask;

                    if (uFabricType > 1.5 && uFabricType < 2.5) totalWave *= 1.35; // الحرير أكثر انسيابية وتمايل
                    if (uFabricType > 3.5) totalWave *= 0.85; // التريكو نسيج أثقل ومحبوك
                    vec2 outTorso = position.xz - vec2(0.0, -0.015);
                    float outLen = length(outTorso);
                    vec2 outDir = outLen > 0.001 ? (outTorso / outLen) : vec2(0.0, 1.0);
                    defPos.xz += outDir * totalWave;

                    // بروز الحاشية السفلية للخارج بانسيابية أسطوانية بدون انقطاع عند قصر التيشيرت
                    if (uClothLength < 50.0 && position.y < 0.24) {
                      float cropFlare = smoothstep(0.24, 0.12, position.y) * 0.012;
                      vec2 dCenter = position.xz - vec2(0.0, -0.015);
                      float dLen = length(dCenter);
                      vec2 dirOut = dLen > 0.001 ? (dCenter / dLen) : vec2(0.0, 1.0);
                      defPos.xz += dirOut * cropFlare;
                    }

                    // 7. موجة الانسدال والاسترخاء الفيزيائي عند الضغط على Sew and drape
                    if (uDrapeWave > 0.001) {
                      float wavePhase = uDrapeTime * 14.0 - position.y * 12.0;
                      float relaxWave = sin(wavePhase) * uDrapeWave * 0.008;
                      defPos.xz += outDir * relaxWave;
                    }
                  }

                  // تجسيم أكمام الذراع كقماش موحد واقعي ممتد كقطعة واحدة من الكتف حتى المعصم
                  if (uIsUppr > 0.5 && uTailorActive > 0.5 && uStripShirt < 0.5) {
                    float armSign = sign(position.x);
                    float sLen = armSign > 0.0 ? uSleeveLengthL : uSleeveLengthR;
                    vec3 armS = vec3(0.24, 0.38, -0.07);
                    vec3 armW = vec3(0.56, -0.10, -0.033);
                    vec3 armVec = armW - armS;
                    float armLen = length(armVec);
                    vec3 armDir = armVec / armLen;
                    vec3 localArmP = vec3(abs(position.x), position.y, position.z);
                    float tArm = dot(localArmP - armS, armDir) / armLen;
                    vec3 bonePtLocal = armS + clamp(tArm, 0.0, 1.0) * armVec;
                    float perpD = length(localArmP - bonePtLocal);

                    if (sLen > 28.5 && tArm > 0.04) {
                      float sProg = clamp((sLen - 28.5) / 51.5, 0.0, 1.0);
                      float tCuff = mix(0.176, 0.76, sProg);
                      float sWidRatio = (uSleeveWidth - 40.0) / 40.0;
                      if (tArm <= tCuff) {
                        // تجسيم قماش الكم بمحاذاة سطح العضد والساعد الطبيعي ليلتحم مع كم البلوزة بدقة < 0.5 ملم دون أي درجة فاصلة
                        float widthScale = 1.0 + sWidRatio * 0.25;
                        float upperBridge = mix(0.0042, 0.0085, smoothstep(0.42, 0.15, tArm)) * smoothstep(0.04, 0.08, tArm) * widthScale;
                        float cuffLip = smoothstep(tCuff - 0.035, tCuff, tArm) * 0.0012;
                        float foldMask = smoothstep(0.08, 0.18, tArm) * smoothstep(tCuff, tCuff - 0.04, tArm);
                        float sleeveFold = sin(tArm * 36.0 + position.y * 24.0) * 0.0007 * foldMask;

                        defPos += normal * (upperBridge + cuffLip + sleeveFold);
                        defPos.z += (defPos.z - (-0.02)) * 0.08 * smoothstep(0.28, 0.12, tArm);
                      }
                    }
                    if (tArm <= 0.055 && position.y > 0.40 && position.y < 0.495 && abs(position.x) > 0.095) {
                      // خفض وإدخال منطقة أعلى الكتف الداخلية لمنع أي بروز جلدي عبر قماش الكتف
                      defPos.y -= 0.014;
                      defPos -= normal * 0.010;
                    }
                    if (abs(position.x) < 0.18 && tArm <= 0.04) {
                      // إدخال وتصغير جذع uppr_bare الداخلي ليبقى دائماً داخل التيشيرت لمنع أي بروز جانبي
                      vec2 centerTorso = vec2(0.0, -0.02);
                      vec2 dirIn = defPos.xz - centerTorso;
                      float dIn = length(dirIn);
                      if (dIn > 0.001) {
                        defPos.xz -= (dirIn / dIn) * 0.016;
                      }
                    }
                  }
                }

                vIsJbibCap = 0.0;
                if (uIsJbib > 0.5 && abs(position.x) > 0.19 && position.y > 0.20 && position.y < 0.44) {
                  vec3 capR = normalize(vec3(abs(position.x) - 0.28, position.y - 0.31, position.z - (-0.065)));
                  vec3 symN = vec3(normal.x * sign(position.x), normal.y, normal.z);
                  if (dot(symN, capR) < -0.10) {
                    vIsJbibCap = 1.0;
                  }
                }

                transformed = defPos;
                vCutLocalPos = defPos;
                vOrigPos = position;
                vCutUv = uv;
                `
              );

              shader.fragmentShader = `
                uniform sampler2D uUpprTex;
                uniform sampler2D uLowrTex;
                uniform float uHideRightArm;
                uniform float uHideLeftArm;
                uniform float uHideRightLeg;
                uniform float uHideLeftLeg;
                uniform float uIsHead;
                uniform float uIsUppr;
                uniform float uIsJbib;
                uniform float uIsLowr;
                uniform float uIsFeet;
                uniform float uBlindEyeL;
                uniform float uBlindEyeR;
                uniform float uGougedEyeL;
                uniform float uGougedEyeR;
                uniform vec3 uEyeColorL;
                uniform vec3 uEyeColorR;
                uniform vec3 uPedSkinColor;
                uniform float uFaceScar;
                uniform float uFaceTattoo;
                uniform float uFaceSlashType;
                uniform float uFaceSlashDepth;
                uniform float uFaceSlashFresh;
                uniform float uFaceSlashStitches;
                uniform float uStripShirt;
                uniform float uStripPants;
                uniform float uBodyTattoo;
                uniform float uBodyScar;
                uniform float uTailorActive;
                uniform float uClothLength;
                uniform float uClothWidth;
                uniform float uSleeveLength;
                uniform float uSleeveLengthL;
                uniform float uSleeveLengthR;
                uniform float uSleeveWidth;
                uniform float uNeckline;
                uniform float uHemLeftOffset;
                uniform float uHemRightOffset;
                uniform float uHemFrontL;
                uniform float uHemFrontR;
                uniform float uHemBackL;
                uniform float uHemBackR;
                uniform vec3  uClothColor;
                uniform float uFabricType;
                uniform float uShowSeams;
                uniform float uDetailLevel;
                varying vec3 vCutLocalPos;
                varying vec3 vOrigPos;
                varying vec2 vCutUv;
                varying float vIsJbibCap;

                // وظيفة محاكاة امتصاص حبر التاتو الواقعي في طبقة الأدمة تحت البشرة (Subdermal Ink Light Absorption)
                vec3 applyRealisticTattooInk(vec3 curColor, float inkStrength, vec3 pLocal, float isColorInk) {
                  if (inkStrength <= 0.001) return curColor;
                  float skinLum = dot(curColor, vec3(0.299, 0.587, 0.114));
                  vec3 pigment = isColorInk > 0.5 
                    ? vec3(0.30, 0.05, 0.07) 
                    : mix(vec3(0.032, 0.045, 0.058), vec3(0.065, 0.082, 0.100), skinLum * 0.45);
                  float stipple = 0.91 + 0.18 * fract(sin(dot(pLocal.xy * 2400.0, vec2(12.9898, 78.233))) * 43758.5453);
                  vec3 inked = clamp(curColor * pigment * 4.6 * stipple, pigment * 0.82, curColor);
                  return mix(curColor, inked, smoothstep(0.04, 0.92, inkStrength));
                }
                ${shader.fragmentShader}
              `.replace(
                '#include <map_fragment>',
                `
                #include <map_fragment>

                // 1. خامة بشرة الصدر والبطن لفايف إم عند فصخ البلوزة
                if (uIsJbib > 0.5 && uStripShirt > 0.5) {
                  vec3 p = vCutLocalPos;
                  vec2 torsoUV;
                  if (p.z > -0.015) {
                    torsoUV.x = clamp(0.50 + p.x * 2.0, 0.06, 0.94);
                  } else {
                    torsoUV.x = clamp(0.50 - p.x * 2.0, 0.06, 0.94);
                  }
                  torsoUV.y = clamp(0.58 + ((0.46 - p.y) / 0.52) * 0.38, 0.56, 0.96);
                  if (p.y > 0.44) {
                    torsoUV.y = clamp(0.58 - (p.y - 0.44) * 0.15, 0.55, 0.59);
                  }
                  if (abs(p.x) > 0.16) {
                    float armP = clamp((0.44 - p.y) / 0.22, 0.0, 1.0);
                    vec2 armUV = vec2(clamp(0.25 + p.z * 0.6, 0.02, 0.48), clamp(0.12 + armP * 0.30, 0.04, 0.48));
                    torsoUV = mix(torsoUV, armUV, smoothstep(0.16, 0.22, abs(p.x)));
                  }

                  #ifdef USE_MAP
                    vec3 texSkin = texture2D(map, torsoUV).rgb;
                  #else
                    vec3 texSkin = vec3(0.792, 0.631, 0.557);
                  #endif
                  vec3 skinToneMultiplier = uPedSkinColor / vec3(0.792, 0.631, 0.557);
                  diffuseColor.rgb = texSkin * skinToneMultiplier;
                }

                // 2. خامة شورت البوكسر وبشرة الأرجل عند فصخ السروال
                if (uIsLowr > 0.5 && uStripPants > 0.5) {
                  vec3 p = vCutLocalPos;
                  if (p.y > -0.24) {
                    // بوكسر رياضي قطني داكن
                    vec3 boxerCol = vec3(0.12, 0.13, 0.16);
                    if (p.y > -0.125) {
                      boxerCol = vec3(0.16, 0.18, 0.22);
                      if (abs(p.y - (-0.100)) < 0.002 || abs(p.y - (-0.120)) < 0.002) {
                        boxerCol = vec3(0.68, 0.70, 0.75);
                      }
                    }
                    diffuseColor.rgb = boxerCol;
                  } else {
                    float legSignX = p.x < 0.0 ? -0.095 : 0.095;
                    float dx = p.x - legSignX;
                    vec2 legUV = vec2(clamp(0.25 + dx * 2.0, 0.06, 0.44), clamp(0.55 + ((-0.24 - p.y) / 0.74) * 0.40, 0.54, 0.96));
                    #ifdef USE_MAP
                      vec3 rawLeg = texture2D(map, legUV).rgb;
                    #else
                      vec3 rawLeg = vec3(0.792, 0.631, 0.557);
                    #endif
                    vec3 skinToneMultiplier = uPedSkinColor / vec3(0.792, 0.631, 0.557);
                    diffuseColor.rgb = clamp(rawLeg * skinToneMultiplier, 0.0, 1.0);
                  }
                }

                // 3. توحيد خامة القماش والإضاءة للتيشيرت والأكمام في استوديو تفصيل الملابس
                if (uTailorActive > 0.5 && uStripShirt < 0.5) {
                  if (uIsJbib > 0.5) {
                    diffuseColor = vec4(1.0, 1.0, 1.0, 1.0);
                  } else if (uIsUppr > 0.5) {
                    vec3 armS = vec3(0.24, 0.38, -0.07);
                    vec3 armW = vec3(0.56, -0.10, -0.033);
                    vec3 armVec = armW - armS;
                    float armLen = length(armVec);
                    vec3 armDir = armVec / armLen;
                    vec3 localArmP = vec3(abs(vOrigPos.x), vOrigPos.y, vOrigPos.z);
                    float tArm = dot(localArmP - armS, armDir) / armLen;
                    float armSign = sign(vOrigPos.x);
                    float sLenCheck = (armSign > 0.0) ? uSleeveLengthL : uSleeveLengthR;
                    if (sLenCheck > 28.5 && tArm > 0.04) {
                      float sProg = clamp((sLenCheck - 28.5) / 51.5, 0.0, 1.0);
                      float tCuff = mix(0.176, 0.76, sProg);
                      if (tArm <= tCuff) {
                        diffuseColor = vec4(1.0, 1.0, 1.0, 1.0);
                      }
                    }
                  }
                }
                `
              ).replace(
                '#include <roughnessmap_fragment>',
                `
                #include <roughnessmap_fragment>
                if (uIsJbib > 0.5 && uStripShirt > 0.5) {
                  roughnessFactor = 0.52;
                }
                if (uIsLowr > 0.5 && uStripPants > 0.5 && vCutLocalPos.y <= -0.24) {
                  roughnessFactor = 0.52;
                }
                if (uTailorActive > 0.5 && uStripShirt < 0.5) {
                  if (uIsJbib > 0.5) {
                    roughnessFactor = 0.85;
                  } else if (uIsUppr > 0.5) {
                    vec3 armS = vec3(0.24, 0.38, -0.07);
                    vec3 armW = vec3(0.56, -0.10, -0.033);
                    vec3 armVec = armW - armS;
                    float armLen = length(armVec);
                    vec3 armDir = armVec / armLen;
                    vec3 localArmP = vec3(abs(vOrigPos.x), vOrigPos.y, vOrigPos.z);
                    float tArm = dot(localArmP - armS, armDir) / armLen;
                    float armSign = sign(vOrigPos.x);
                    float sLenCheck = (armSign > 0.0) ? uSleeveLengthL : uSleeveLengthR;
                    if (sLenCheck > 28.5 && tArm > 0.04) {
                      float sProg = clamp((sLenCheck - 28.5) / 51.5, 0.0, 1.0);
                      float tCuff = mix(0.176, 0.76, sProg);
                      if (tArm <= tCuff) {
                        roughnessFactor = 0.85;
                      }
                    }
                  }
                }
                `
              ).replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>
                // بتر اليد اليسرى: إخفاء الذراع من داخل كم التيشيرت بالكامل
                if (uHideLeftArm > 0.5 && uIsUppr > 0.5 && vCutLocalPos.x > 0.20) {
                  discard;
                }

                // بتر اليد اليمنى: إخفاء الذراع من داخل كم التيشيرت بالكامل
                if (uHideRightArm > 0.5 && uIsUppr > 0.5 && vCutLocalPos.x < -0.20) {
                  discard;
                }

                // بتر الساق اليسرى
                if (uHideLeftLeg > 0.5) {
                  if (uIsFeet > 0.5 && vCutLocalPos.x > 0.0) discard;
                  if (uIsLowr > 0.5 && vCutLocalPos.x > 0.02 && vCutLocalPos.y < -0.38) discard;
                }

                // بتر الساق اليمنى
                if (uHideRightLeg > 0.5) {
                  if (uIsFeet > 0.5 && vCutLocalPos.x < 0.0) discard;
                  if (uIsLowr > 0.5 && vCutLocalPos.x < -0.02 && vCutLocalPos.y < -0.38) discard;
                }

                // تفاصيل وملامح الوجه والعيون والوشوم والجروح (Face Details, Eyes, Scars & Tattoos)
                if (uIsHead > 0.5) {
                  vec3 p = vCutLocalPos;

                  // تحديد ما إذا كانت هذه النقطة تقع ضمن مقلة العين الحقيقية ثلاثية الأبعاد (Authentic 3D Eyeball)
                  // تم عزل العين تشريحياً 100%: إحداثيات مقلة العين U in [0.785, 0.98] و V in [0.790, 0.985] مع y > 0.66 و z > 0.075
                  // جميع رؤوس جفون الوجه تقع في V < 0.75 وبالتالي نضمن استحالة تلطيخ الجفن بأي دوائر أو سواد!
                  bool isEyeball = (vCutUv.x >= 0.785 && vCutUv.y >= 0.790 && p.y > 0.66 && p.z > 0.075);

                  if (isEyeball) {
                    bool isLeftEye = (p.x > 0.0);
                    float isGouged = isLeftEye ? uGougedEyeL : uGougedEyeR;
                    float isBlind = isLeftEye ? uBlindEyeL : uBlindEyeR;
                    vec3 targetEyeColor = isLeftEye ? uEyeColorL : uEyeColorR;

                    // إزالة صبغة لون البشرة من العين إذا تم تغيير لون جلد الوجه للحفاظ على بياض العين الناصع والواقعي
                    if (length(uPedSkinColor) > 0.05) {
                      gl_FragColor.rgb = clamp(gl_FragColor.rgb / max(uPedSkinColor, vec3(0.25)), 0.0, 1.0);
                    }

                    // أ) العين المفقوعة (Gouged Eye Socket - تجويف مظلم غائر مع لحم دموي ممزق)
                    if (isGouged > 0.5) {
                      vec3 eyeCenter = isLeftEye ? vec3(0.02996, 0.70072, 0.088) : vec3(-0.02996, 0.70072, 0.088);
                      float distSocket = length(p - eyeCenter);
                      float cavityGloom = smoothstep(0.003, 0.020, distSocket);
                      vec3 darkPit = vec3(0.012, 0.002, 0.002);
                      vec3 rawFlesh = vec3(0.22, 0.025, 0.025);
                      gl_FragColor.rgb = mix(darkPit, rawFlesh, cavityGloom * 0.75);
                    }
                    // ب) العين العمياء / البيضاء المعتمة (Blind Milky White Cataract Eye)
                    else if (isBlind > 0.5) {
                      float dUV = length(vCutUv - vec2(0.8808, 0.8867));
                      if (dUV < 0.045) {
                        float cataractCore = smoothstep(0.045, 0.010, dUV);
                        vec3 milkyWhite = mix(vec3(0.89, 0.91, 0.93), vec3(0.72, 0.76, 0.80), dUV * 12.0);
                        float faintPupil = smoothstep(0.009, 0.002, dUV) * 0.15;
                        milkyWhite -= faintPupil;
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, milkyWhite, cataractCore * 0.92);
                      }
                    }
                    // ج) تلوين القزحية الطبيعي أو المخصص (Photorealistic Iris Tinting)
                    else {
                      vec3 defaultBrown = vec3(0.29, 0.21, 0.15); // #4a3728
                      float colorDiff = length(targetEyeColor - defaultBrown);
                      if (colorDiff > 0.04) {
                        float dUV = length(vCutUv - vec2(0.8808, 0.8867));
                        // تلوين منطقة القزحية فقط مع الحفاظ على البؤبؤ الداكن والانعكاس اللامع وبياض العين الطبيعي
                        if (dUV < 0.040 && dUV > 0.008) {
                          float irisWeight = smoothstep(0.040, 0.035, dUV) * smoothstep(0.008, 0.012, dUV);
                          float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
                          vec3 tintedIris = targetEyeColor * (lum * 2.35);
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, tintedIris, irisWeight * 0.88);
                        }
                      }
                      // إذا كان اللون بني طبيعي: تبقى خامة فايف إم الواقعية الأصلية 100% دون أي تعديل!
                    }
                  }

                  // كل ما يلي يخص بشرة وجلد الوجه فقط (Skin Only) - ولا يمس العين أبداً
                  if (!isEyeball) {
                    // أ. مسار سيلان الدم من محجر العين المفقوعة اليسرى على جلد الخد (Blood Tear Trail)
                    if (uGougedEyeL > 0.5 && p.z > 0.065 && p.y < 0.695 && p.y > 0.605) {
                      float dripWave = sin(p.y * 120.0) * 0.0022;
                      float distDrip = abs(p.x - (0.02996 + dripWave));
                      if (distDrip < 0.0030) {
                        float dripAlpha = smoothstep(0.0030, 0.0008, distDrip);
                        vec3 clottedBlood = vec3(0.32, 0.02, 0.02);
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, clottedBlood, dripAlpha * 0.88);
                      }
                    }

                    // ب. مسار سيلان الدم من محجر العين المفقوعة اليمنى على جلد الخد
                    if (uGougedEyeR > 0.5 && p.z > 0.065 && p.y < 0.695 && p.y > 0.605) {
                      float dripWaveR = sin(p.y * 120.0) * 0.0022;
                      float distDripR = abs(p.x - (-0.02996 + dripWaveR));
                      if (distDripR < 0.0030) {
                        float dripAlphaR = smoothstep(0.0030, 0.0008, distDripR);
                        vec3 clottedBloodR = vec3(0.32, 0.02, 0.02);
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, clottedBloodR, dripAlphaR * 0.88);
                      }
                    }

                  // 2. الجروح والندبات والتعفن (Facial Scars & Wounds)
                  if (uFaceScar > 0.5 && (p.z > 0.015 || (uFaceScar > 7.5 && uFaceScar < 8.5))) {
                    // النوع 1: جرح قطعي قطري يعبر الحاجب والعين والخد مع غرز خياطة طبية (Diagonal Slash & Stitches)
                    if (uFaceScar > 0.5 && uFaceScar < 1.5) {
                      vec2 slashA = vec2(0.022, 0.745);
                      vec2 slashB = vec2(0.048, 0.635);
                      vec2 pa = p.xy - slashA;
                      vec2 ba = slashB - slashA;
                      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
                      vec2 closest = slashA + h * ba;
                      float distSlash = length(p.xy - closest);

                      if (distSlash < 0.0062) {
                        float scarCore = smoothstep(0.0018, 0.0004, distSlash);
                        float scarBorder = smoothstep(0.0062, 0.0016, distSlash);
                        vec3 inflamedColor = vec3(0.70, 0.28, 0.26);
                        vec3 deepBlood = vec3(0.28, 0.02, 0.02);
                        vec3 scarFinal = mix(inflamedColor, deepBlood, scarCore);
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, scarFinal, scarBorder * 0.86);

                        // غرز الخياطة الجراحية المتقاطعة دورياً (Surgical Stitches)
                        float stitchPeriod = mod(h * 12.0, 1.0);
                        if (stitchPeriod < 0.20 && distSlash < 0.0048) {
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.08, 0.08, 0.10), 0.90);
                        }
                      }
                    }
                    // النوع 2: تعفن زومبي وتحلل نسيجي ولحم مكشوف واقعي 100% بدون أي انقطاع أو خطوط دائرية
                    else if (uFaceScar > 1.5 && uFaceScar < 2.5) {
                      // 3 مراكز تعفن رئيسية بإحداثيات ثلاثية الأبعاد دقيقة على سطح الوجه (جبين، صدغ، خد)
                      float dA = length(p - vec3(0.022, 0.730, 0.078)); // الجبين
                      float dB = length(p - vec3(0.048, 0.702, 0.064)); // الصدغ الأيسر
                      float dC = length(p - vec3(-0.040, 0.638, 0.070)); // الخد الأيمن
                      float minRotDist = min(dA, min(dB * 1.05, dC * 0.95));

                      // تمزق خلوي طبيعي غير متناظر بدون دوائر متحدة المركز
                      float tearFBM = sin(p.x * 260.0 + p.y * 210.0) * 0.0035
                                    + cos(p.y * 360.0 - p.z * 280.0) * 0.0025
                                    + sin(p.x * 520.0 + p.z * 400.0) * 0.0015;
                      float raggedDist = minRotDist + tearFBM;

                      // تدرج ناعم يذوب في البشرة طبيعياً حتى مسافة 0.038 بدون أي حد قاطع أو انفصال!
                      if (raggedDist < 0.038) {
                        float rotAlpha = smoothstep(0.036, 0.018, raggedDist);

                        // 1) هالة التقيح والتسمم الخلوي (أخضر وبنفسجي يمتزجان بسلاسة مع لون البشرة)
                        vec3 gangreneGreen = vec3(0.30, 0.38, 0.18);
                        vec3 bruisedPurple = vec3(0.26, 0.12, 0.16);
                        vec3 haloColor = mix(gangreneGreen, bruisedPurple, sin(p.x * 120.0 + p.y * 90.0) * 0.5 + 0.5);

                        // 2) قشور الجلد الميت المتدلي الشاحب (Peeling Dead Epidermis)
                        float skinFlap = smoothstep(0.024, 0.019, raggedDist) * (1.0 - smoothstep(0.019, 0.014, raggedDist));
                        vec3 deadSkin = vec3(0.55, 0.48, 0.40);

                        // 3) لحم عضلي متعفن مكشوف ممزق مع خطوط ألياف دموية
                        float exposedFlesh = smoothstep(0.020, 0.010, raggedDist);
                        float muscleStria = sin(p.y * 550.0 + p.x * 220.0) * 0.04;
                        vec3 putridMeat = vec3(0.38, 0.035, 0.025) + muscleStria;

                        // 4) عمق النخر والتعفن الأسود الغائر في القلب
                        float necroticCore = smoothstep(0.010, 0.002, raggedDist);
                        vec3 blackRot = vec3(0.04, 0.015, 0.012);

                        // دمج الطبقات التشريحية
                        vec3 rotColor = mix(haloColor, deadSkin, skinFlap * 0.85);
                        rotColor = mix(rotColor, putridMeat, exposedFlesh);
                        rotColor = mix(rotColor, blackRot, necroticCore);

                        // رطوبة القيح والدم اللزج في اللحم المكشوف
                        float moistGlint = exposedFlesh * (1.0 - necroticCore) * 0.14;
                        rotColor += vec3(moistGlint);

                        // عروق دموية مسمومة متعرجة بتفرع زاوي طبيعي (بدون دوائر)
                        if (raggedDist > 0.015 && raggedDist < 0.034) {
                          vec2 dCenter = (minRotDist == dA) ? (p.xy - vec2(0.022, 0.730)) : (p.xy - vec2(-0.040, 0.638));
                          float ang = atan(dCenter.y, dCenter.x);
                          float vWave = sin(ang * 7.0 + sin(minRotDist * 140.0) * 2.0);
                          if (abs(vWave) < 0.14) {
                            float vMask = smoothstep(0.14, 0.02, abs(vWave)) * smoothstep(0.034, 0.022, raggedDist);
                            rotColor = mix(rotColor, vec3(0.10, 0.16, 0.08), vMask * 0.70);
                          }
                        }

                        gl_FragColor.rgb = mix(gl_FragColor.rgb, rotColor, rotAlpha * 0.94);
                      }
                    }
                    // النوع 3: خدوش وضربات سكين دموية واقعية (Photorealistic Bloody Combat Knife Lacerations)
                    else if (uFaceScar > 2.5 && uFaceScar < 3.5) {
                      // ضربات سكين ثلاثية غائرة ومتفاوتة الطول والانحناء على الخد
                      for (int i = 0; i < 3; i++) {
                        float iF = float(i);
                        vec2 pStart, pEnd;
                        float maxCoreW = 0.0016;
                        float curveShift = 0.0;

                        if (i == 0) {
                          pStart = vec2(-0.033, 0.696);
                          pEnd   = vec2(-0.052, 0.612);
                          maxCoreW = 0.0019;
                          curveShift = 0.0018;
                        } else if (i == 1) {
                          pStart = vec2(-0.024, 0.692);
                          pEnd   = vec2(-0.042, 0.622);
                          maxCoreW = 0.0014;
                          curveShift = 0.0012;
                        } else {
                          pStart = vec2(-0.043, 0.686);
                          pEnd   = vec2(-0.060, 0.626);
                          maxCoreW = 0.0013;
                          curveShift = 0.0022;
                        }

                        vec2 pa = p.xy - pStart;
                        vec2 ba = pEnd - pStart;
                        float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
                        vec2 segPoint = pStart + t * ba;
                        segPoint.x += sin(t * 3.14159) * curveShift;
                        float microTear = sin(p.y * 360.0 + iF * 20.0) * 0.00045 + cos(p.x * 320.0) * 0.00025;
                        float distCut = length(p.xy - segPoint) + microTear;
                        float taper = sin(t * 3.14159);
                        float coreW = maxCoreW * smoothstep(0.0, 0.22, taper);
                        float haloW = coreW * 3.8;

                        if (distCut < haloW && taper > 0.01) {
                          float deepCore = smoothstep(coreW * 0.45, 0.0, distCut);
                          float bloodCore = smoothstep(coreW, coreW * 0.35, distCut);
                          float skinLip = smoothstep(coreW * 1.6, coreW * 0.9, distCut) * (1.0 - bloodCore);

                          vec3 darkClot = vec3(0.12, 0.012, 0.012);
                          vec3 richBlood = vec3(0.55, 0.035, 0.035);
                          vec3 paleLip = vec3(0.80, 0.58, 0.54);
                          vec3 inflamedRed = vec3(0.68, 0.22, 0.20);

                          vec3 cutFinal = mix(inflamedRed, paleLip, skinLip);
                          cutFinal = mix(cutFinal, richBlood, bloodCore);
                          cutFinal = mix(cutFinal, darkClot, deepCore);

                          float totalAlpha = smoothstep(haloW, coreW * 0.8, distCut) * 0.92;
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, cutFinal, totalAlpha);

                          float beadNoise = sin(t * 80.0 + iF * 15.0);
                          if (beadNoise > 0.72 && distCut < coreW * 1.8) {
                            gl_FragColor.rgb = mix(gl_FragColor.rgb, darkClot, 0.75);
                          }
                        }
                      }
                    }
                    // النوع 4: حروق وتسلخات نارية وأسيد من الدرجة الثالثة شديدة الواقعية (3rd Degree Severe Burns)
                    else if (uFaceScar > 3.5 && uFaceScar < 4.5) {
                      // 3 مراكز حرق متداخلة تمتد طبيعياً على الوجنة وتتسلق نحو الصدغ وتتدفق مع عظم الفك
                      float dB1 = length(p - vec3(0.038, 0.655, 0.072)); // المركز الرئيسي على الخد
                      float dB2 = length(p - vec3(0.048, 0.688, 0.062)) * 1.12; // امتداد الصدغ
                      float dB3 = length(p - vec3(0.030, 0.626, 0.070)) * 1.22; // تسلخات الفك
                      float minBurn = min(dB1, min(dB2, dB3));

                      // تموجات وتسلخات كلويد وحواف غير متناظرة ذات تردد متعدد
                      float burnFBM = sin(p.x * 220.0 + p.y * 180.0) * 0.0038
                                    + cos(p.y * 360.0 - p.z * 240.0) * 0.0024
                                    + sin(p.x * 520.0 + p.y * 420.0) * 0.0014;
                      float raggedBurn = minBurn + burnFBM;

                      if (raggedBurn < 0.042) {
                        float burnAlpha = smoothstep(0.042, 0.020, raggedBurn);

                        // 1) جلد محمر متورم وندبات كلويد متصلبة مشدودة (Hypertrophic Keloid Dermis)
                        vec3 keloidSkin = vec3(0.68, 0.26, 0.26);

                        // لمعة سطحية مشدودة شمعية كجلد الحروق الحقيقي (Waxy Keloid Scar Sheen)
                        float keloidSheen = burnAlpha * (sin(p.y * 300.0 + p.x * 220.0) * 0.08 + 0.12);

                        // 2) حواف التسلخات والفقاعات المتقشرة الباهتة (Blistering Peeling Edges)
                        float blisterEdge = smoothstep(0.026, 0.021, raggedBurn) * (1.0 - smoothstep(0.021, 0.016, raggedBurn));
                        vec3 blisterCol = vec3(0.82, 0.64, 0.54);

                        // 3) لحم أحمر متسلخ نازف مكشوف (Raw Weeping Dermis)
                        float rawDermis = smoothstep(0.021, 0.009, raggedBurn);
                        vec3 rawMeat = vec3(0.56, 0.06, 0.045);
                        float moistShine = rawDermis * (sin(p.x * 420.0) * sin(p.y * 420.0) * 0.06 + 0.06);
                        rawMeat += moistShine;

                        // 4) قشور تفحم أسود وبني كربوني خشن (Charred Carbonized Eschar Crust)
                        float charFlakes = sin(p.x * 560.0 + p.y * 480.0) * cos(p.y * 620.0 - p.z * 350.0);
                        float charFactor = smoothstep(0.013, 0.002, raggedBurn) * step(0.05, charFlakes + 0.30);
                        vec3 burntUmber = vec3(0.18, 0.06, 0.04);
                        vec3 charredBlack = vec3(0.07, 0.03, 0.03);
                        vec3 crustCol = mix(burntUmber, charredBlack, smoothstep(0.05, 0.55, charFlakes));

                        // تركيب الطبقات
                        vec3 finalBurn = mix(keloidSkin, blisterCol, blisterEdge * 0.78);
                        finalBurn = mix(finalBurn, rawMeat, rawDermis);
                        finalBurn = mix(finalBurn, crustCol, charFactor);
                        finalBurn += vec3(keloidSheen);

                        gl_FragColor.rgb = mix(gl_FragColor.rgb, finalBurn, burnAlpha * 0.94);
                      }
                    }
                    // النوع 5: خياطة فرانكنشتاين الجراحية الواقعية مع ثقوب إبر وغرز مشدودة وتكميش الجلد
                    else if (uFaceScar > 4.5 && uFaceScar < 5.5) {
                      for (int k = 0; k < 3; k++) {
                        float kF = float(k);
                        vec2 sA, sB;
                        if (k == 0) {
                          // جرح أفقي مقوس عبر الجبين
                          sA = vec2(-0.035, 0.740); sB = vec2(0.035, 0.736);
                        } else if (k == 1) {
                          // جرح رأسي عبر الخد الأيسر
                          sA = vec2(0.040, 0.690); sB = vec2(0.046, 0.622);
                        } else {
                          // جرح قطري عبر عظمة الأنف والخد الأيمن
                          sA = vec2(-0.026, 0.668); sB = vec2(0.018, 0.648);
                        }

                        vec2 paK = p.xy - sA;
                        vec2 baK = sB - sA;
                        float tK = clamp(dot(paK, baK) / dot(baK, baK), 0.0, 1.0);
                        vec2 segK = sA + tK * baK;
                        
                        // انحناء وتمزق ميكرو للجرح المقطوع جراحياً
                        float jagCut = sin(tK * 60.0 + kF * 14.0) * 0.00035;
                        float distK = length(p.xy - segK);
                        float distIncision = abs(distK + jagCut);

                        if (distK < 0.0058 && p.z > 0.040) {
                          // 1) شق الجرح الداكن العميق الرفيع (وليس شريطاً أحمر عريضاً!)
                          float deepSlit = smoothstep(0.0012, 0.0002, distIncision);
                          float borderInflamed = smoothstep(0.0042, 0.0010, distIncision);
                          vec3 inflamedDermis = vec3(0.65, 0.22, 0.20);
                          vec3 darkClottedIncision = vec3(0.12, 0.015, 0.012);
                          vec3 cutTissue = mix(inflamedDermis, darkClottedIncision, deepSlit);
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, cutTissue, borderInflamed * 0.88);

                          // 2) ثقوب الإبرة الجراحية (Needle Puncture Holes) على جانبي الجرح
                          float stitchSpacing = mod(tK * 12.0, 1.0) - 0.5;
                          float isStitchSite = step(abs(stitchSpacing), 0.16);
                          float distToPuncture = abs(distK - 0.0028);
                          if (isStitchSite > 0.5 && distToPuncture < 0.00085) {
                            // ثقب إبرة وخثرة دموية داكنة متجلطة
                            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.08, 0.01, 0.01), 0.92);
                          }

                          // 3) غرز الخياطة الجراحية المشدودة العابرة للجرح (Heavy Surgical Suture Cords / Staples)
                          if (abs(stitchSpacing) < 0.075 && distK < 0.0034) {
                            vec3 sutureColor = vec3(0.04, 0.05, 0.06); // خيط جراحي أسود داكن
                            vec3 stapleGleam = vec3(step(0.002, abs(distK)) * 0.15); // لمعة معدنية خفيفة عند عقدة الغرزة
                            gl_FragColor.rgb = mix(gl_FragColor.rgb, sutureColor + stapleGleam, 0.95);
                          }

                          // 4) تكميش وتوتر الجلد المحيط بالغرز (Skin Puckering / Dimpling Tension)
                          if (abs(stitchSpacing) > 0.22 && distIncision < 0.0028) {
                            float bulgeHighlight = sin(abs(stitchSpacing) * 3.14159) * 0.06;
                            gl_FragColor.rgb += vec3(bulgeHighlight);
                          }
                        }
                      }
                    }
                    // النوع 6: شظايا وطلقات نارية حقيقية واقعية 100% (Real Gunshot Graze & Explosive Shrapnel Wound)
                    else if (uFaceScar > 5.5 && uFaceScar < 6.5) {
                      // أ) أخدود رصاصة كاشطة حقيقي على عظمة الخد الأيمن (Photorealistic Bullet Graze Trench)
                      vec2 pA = vec2(-0.024, 0.672);
                      vec2 pB = vec2(-0.056, 0.650);
                      vec2 pLine = pB - pA;
                      float tG = clamp(dot(p.xy - pA, pLine) / dot(pLine, pLine), 0.0, 1.0);
                      vec2 segG = pA + tG * pLine;
                      float distG = length(p.xy - segG);
                      
                      // حواف ممزقة حقيقية لمرور الرصاصة الساخنة
                      float microGraze = sin(p.y * 420.0 + p.x * 280.0) * 0.0004;
                      float grazeD = distG + microGraze;

                      if (grazeD < 0.0090 && p.z > 0.050) {
                        float trenchCore = smoothstep(0.0018, 0.0003, grazeD); // قلب أخدود الرصاصة
                        float rawFleshG = smoothstep(0.0042, 0.0014, grazeD);  // لحم متسلخ ساخن
                        float bruiseHalo = smoothstep(0.0090, 0.0035, grazeD);  // ورم دموي كدمي حول الرصاصة
                        
                        vec3 darkClotG = vec3(0.09, 0.012, 0.012);
                        vec3 searingMeat = vec3(0.55, 0.05, 0.04);
                        vec3 hematomaPurple = vec3(0.32, 0.14, 0.20);
                        
                        vec3 grazeResult = mix(hematomaPurple, searingMeat, rawFleshG);
                        grazeResult = mix(grazeResult, darkClotG, trenchCore);

                        // بقع بارود محروق متناثرة مجهرية حول أخدود الرصاصة (Gunpowder Stippling & Tattooing)
                        float powderStipple = sin(p.x * 750.0 + p.y * 680.0) * cos(p.y * 820.0 - p.z * 520.0);
                        if (powderStipple > 0.40 && grazeD < 0.0070 && grazeD > 0.0020) {
                          grazeResult = mix(grazeResult, vec3(0.05, 0.04, 0.04), 0.85);
                        }

                        gl_FragColor.rgb = mix(gl_FragColor.rgb, grazeResult, bruiseHalo * 0.94);
                      }

                      // سيلان دماء متخثرة من أخدود الرصاصة نحو أسفل الخد
                      if (p.x > -0.052 && p.x < -0.038 && p.y < 0.650 && p.y > 0.605 && p.z > 0.055) {
                        float dripG = abs(p.x - (-0.044 + sin(p.y * 90.0) * 0.0016));
                        if (dripG < 0.0015) {
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.24, 0.02, 0.02), smoothstep(0.0015, 0.0003, dripG) * 0.90);
                        }
                      }

                      // ب) جرح مقذوف شظية انفجارية ثاقبة على الجبهة (Explosive Shrapnel Entry Cavity)
                      vec2 shrapC = vec2(0.036, 0.728);
                      float dShrap = length(p.xy - shrapC);
                      float angShrap = atan(p.y - shrapC.y, p.x - shrapC.x);
                      // تمزق نجمي حقيقي لحواف الشظية الساخنة
                      float raggedShrap = dShrap + sin(angShrap * 6.0 + sin(dShrap * 180.0)) * 0.0016;

                      if (raggedShrap < 0.016 && p.z > 0.050) {
                        float holePit = smoothstep(0.0035, 0.0008, raggedShrap);
                        float sootScorch = smoothstep(0.0068, 0.0028, raggedShrap);
                        float shrapBruise = smoothstep(0.016, 0.0055, raggedShrap);
                        
                        vec3 holeBlack = vec3(0.04, 0.01, 0.01);
                        vec3 sootChar = vec3(0.09, 0.06, 0.05);
                        vec3 contusion = vec3(0.30, 0.12, 0.18);
                        
                        vec3 shrapFinal = mix(contusion, sootChar, sootScorch);
                        shrapFinal = mix(shrapFinal, holeBlack, holePit);
                        
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, shrapFinal, shrapBruise * 0.94);
                      }
                    }
                    // النوع 7: جروح المعارك الكثيفة الشاملة (Full Carnage Heavy Combat Wounds - الوجه مليان جروح بالكامل!)
                    else if (uFaceScar > 6.5 && uFaceScar < 7.5) {
                      // 1) ضربات سكين ثلاثية على الخد الأيمن
                      for (int i = 0; i < 3; i++) {
                        float iF = float(i);
                        vec2 pStart = vec2(-0.033 - iF * 0.009, 0.696 - iF * 0.006);
                        vec2 pEnd   = vec2(-0.052 - iF * 0.007, 0.612 + iF * 0.008);
                        vec2 pa = p.xy - pStart; vec2 ba = pEnd - pStart;
                        float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
                        vec2 segPoint = pStart + t * ba;
                        segPoint.x += sin(t * 3.14159) * 0.0016;
                        float distCut = length(p.xy - segPoint) + sin(p.y * 360.0) * 0.0004;
                        float taper = sin(t * 3.14159);
                        float coreW = 0.0017 * smoothstep(0.0, 0.22, taper);
                        if (distCut < coreW * 3.5 && taper > 0.01) {
                          vec3 richBlood = vec3(0.55, 0.035, 0.035);
                          vec3 darkClot = vec3(0.12, 0.012, 0.012);
                          float cutWeight = smoothstep(coreW * 3.5, coreW * 0.8, distCut);
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(richBlood, darkClot, smoothstep(coreW * 0.5, 0.0, distCut)), cutWeight * 0.92);
                        }
                      }
                      // 2) جرح كبير مقطوع ومخيط عبر الجبهة والحاجب الأيسر
                      vec2 slashA = vec2(0.022, 0.745); vec2 slashB = vec2(0.048, 0.635);
                      vec2 pa2 = p.xy - slashA; vec2 ba2 = slashB - slashA;
                      float h2 = clamp(dot(pa2, ba2) / dot(ba2, ba2), 0.0, 1.0);
                      float distSlash2 = length(p.xy - (slashA + h2 * ba2));
                      if (distSlash2 < 0.0058 && p.z > 0.065) {
                        vec3 inflamedColor = vec3(0.70, 0.28, 0.26);
                        vec3 deepBlood = vec3(0.25, 0.02, 0.02);
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(inflamedColor, deepBlood, smoothstep(0.0016, 0.0003, distSlash2)), smoothstep(0.0058, 0.0014, distSlash2) * 0.88);
                        if (mod(h2 * 12.0, 1.0) < 0.20 && distSlash2 < 0.0044) {
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.08, 0.08, 0.10), 0.90);
                        }
                      }
                      // 3) خدوش دموية عبر عظمة الأنف والخد
                      if (abs(p.x) < 0.025 && p.y > 0.640 && p.y < 0.675 && p.z > 0.080) {
                        float distNose = abs(p.y - (0.658 + p.x * 0.4));
                        if (distNose < 0.0022) {
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.50, 0.03, 0.03), smoothstep(0.0022, 0.0004, distNose) * 0.88);
                        }
                      }
                      // 4) كدمات دموية منتشرة على الوجنتين
                      if (p.z > 0.070 && p.y > 0.620 && p.y < 0.690) {
                        float splatter = sin(p.x * 320.0) * sin(p.y * 300.0);
                        if (splatter > 0.68) {
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.20, 0.03, 0.03), 0.70);
                        }
                      }
                    }
                    // النوع 8: تشوه زومبي إشعاعي أخضر وعروق صفراء متقيحة ومحاجر غائرة (Toxic Green Mutant Zombie - صورة 1)
                    else if (uFaceScar > 7.5 && uFaceScar < 8.5) {
                      float lumSkin = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
                      vec3 mutantGreen = vec3(0.36, 0.52, 0.42) * (lumSkin * 1.45 + 0.12);
                      float mottling = sin(p.x * 95.0 + cos(p.y * 80.0)) * 0.5 + 0.5;
                      mutantGreen = mix(mutantGreen, vec3(0.26, 0.40, 0.32) * (lumSkin * 1.35), mottling * 0.45);
                      gl_FragColor.rgb = mix(gl_FragColor.rgb, mutantGreen, 0.82);

                      // محاجر عيون غائرة محمرة وملتهبة كالصورة 1
                      float dEyeL = length(vec2((p.x - 0.030) * 0.85, (p.y - 0.701) * 1.25));
                      float dEyeR = length(vec2((p.x - (-0.030)) * 0.85, (p.y - 0.701) * 1.25));
                      float dEyeMin = min(dEyeL, dEyeR);
                      if (dEyeMin < 0.024 && p.z > 0.065) {
                        float socketShade = smoothstep(0.024, 0.008, dEyeMin);
                        vec3 bloodSocket = mix(vec3(0.28, 0.06, 0.04), vec3(0.08, 0.01, 0.01), smoothstep(0.016, 0.007, dEyeMin));
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, bloodSocket, socketShade * 0.88);
                      }

                      // عروق وبثور صفراء وبرتقالية إشعاعية على الجبهة والصدغين وأسفل الرقبة
                      float veinWave1 = abs(sin(p.x * 160.0 + sin(p.y * 130.0) * 1.8));
                      float veinWave2 = abs(cos(p.y * 190.0 - sin(p.x * 140.0) * 1.6));
                      float templeMask = smoothstep(0.015, 0.045, abs(p.x)) * smoothstep(0.66, 0.75, p.y);
                      float neckRotMask = smoothstep(0.55, 0.50, p.y);
                      float veinZone = max(templeMask, neckRotMask);
                      if (veinZone > 0.05) {
                        float vLine = smoothstep(0.14, 0.01, min(veinWave1, veinWave2)) * veinZone;
                        float pustule = smoothstep(0.55, 0.85, sin(p.x * 280.0) * cos(p.y * 260.0)) * veinZone;
                        vec3 toxicYellow = mix(vec3(0.76, 0.48, 0.12), vec3(0.88, 0.72, 0.22), pustule);
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, toxicYellow, max(vLine * 0.78, pustule * 0.65));
                      }
                    }
                    // النوع 9: تشوه دموي كثيف على الوجه والذقن وطعنات نجمية دامية على الرقبة (Bloody Smears, Chin Drips & Neck Star Wounds - صورة 2)
                    else if (uFaceScar > 8.5 && uFaceScar < 9.5) {
                      vec3 brightCrimson = vec3(0.68, 0.05, 0.06);
                      vec3 darkCrimson   = vec3(0.36, 0.015, 0.02);
                      vec3 blackCore     = vec3(0.04, 0.01, 0.015);

                      // 1) 3 لطخات دموية عريضة عبر الجبين (Forehead Blood Streaks)
                      if (p.y > 0.715 && p.y < 0.775 && abs(p.x) < 0.056 && p.z > 0.062) {
                        for (int b = 0; b < 3; b++) {
                          float bF = float(b);
                          float rowY = 0.726 + bF * 0.016 - (p.x * p.x) * 1.4;
                          float dRow = abs(p.y - rowY + sin(p.x * 120.0 + bF) * 0.0012);
                          float xSpan = smoothstep(0.052 - bF * 0.005, 0.020, abs(p.x)) * step(0.003, abs(p.x) + (b == 1 ? 0.01 : 0.0));
                          float streak = smoothstep(0.0055, 0.0012, dRow) * xSpan;
                          if (streak > 0.05) {
                            vec3 colB = mix(brightCrimson, darkCrimson, smoothstep(0.0035, 0.0005, dRow));
                            gl_FragColor.rgb = mix(gl_FragColor.rgb, colB, streak * 0.90);
                          }
                        }
                      }

                      // 2) لطخات دموية عريضة مائلة على الوجنتين والصدغ (Cheek & Temple Blood Smears)
                      if (p.y > 0.615 && p.y < 0.705 && abs(p.x) > 0.016 && p.z > 0.045) {
                        float cheekCenterY = 0.658 + (abs(p.x) - 0.035) * 0.38;
                        float dCheek = length(vec2((abs(p.x) - 0.038) * 0.65, p.y - cheekCenterY + sin(p.x * 180.0) * 0.0018));
                        if (dCheek < 0.016) {
                          float smearAlpha = smoothstep(0.016, 0.005, dCheek);
                          vec3 smearCol = mix(brightCrimson, darkCrimson, smoothstep(0.010, 0.002, dCheek));
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, smearCol, smearAlpha * 0.88);
                        }
                        // جرح رأسي دامي بجوار الصدغ
                        float dTempleSlash = length(vec2(abs(p.x) - 0.052, (p.y - 0.692) * 0.45));
                        if (dTempleSlash < 0.0055) {
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, darkCrimson, smoothstep(0.0055, 0.0015, dTempleSlash) * 0.88);
                        }
                      }

                      // 3) سيلان خطوط الدم الكثيفة من الفم على كامل الذقن (Dripping Chin Blood Streams)
                      if (p.y > 0.525 && p.y < 0.622 && abs(p.x) < 0.032 && p.z > 0.060) {
                        float dripFreq = sin(p.x * 380.0 + sin(p.y * 90.0) * 0.8);
                        float dripFreq2 = cos(p.x * 240.0 - p.y * 50.0);
                        float envChin = smoothstep(0.032, 0.008, abs(p.x)) * smoothstep(0.525, 0.555, p.y) * smoothstep(0.622, 0.608, p.y);
                        float stream = smoothstep(0.15, 0.75, dripFreq * 0.6 + dripFreq2 * 0.4) * envChin;
                        float baseWash = envChin * 0.45;
                        float totalChinBlood = max(stream, baseWash);
                        if (totalChinBlood > 0.05) {
                          vec3 chinCol = mix(brightCrimson, darkCrimson, stream);
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, chinCol, totalChinBlood * 0.90);
                        }
                      }

                      // 4) طعنات وجروح نجمية سوداء المركز بحواف قرمزية على الرقبة (Crimson-Edged Black Star Wounds on Neck)
                      if (p.y < 0.575 && p.z > 0.015) {
                        for (int s = 0; s < 5; s++) {
                          vec2 sPos;
                          float sRad = 0.011;
                          if (s == 0) { sPos = vec2(-0.042, 0.542); sRad = 0.012; }
                          else if (s == 1) { sPos = vec2(-0.028, 0.515); sRad = 0.010; }
                          else if (s == 2) { sPos = vec2(0.040, 0.538); sRad = 0.012; }
                          else if (s == 3) { sPos = vec2(0.026, 0.512); sRad = 0.010; }
                          else { sPos = vec2(0.0, 0.502); sRad = 0.016; }
                          vec2 dS = p.xy - sPos;
                          float rS = length(dS);
                          float aS = atan(dS.y, dS.x);
                          float starR = rS * (1.0 + 0.32 * cos(aS * 6.0));
                          if (starR < sRad) {
                            float redHalo = smoothstep(sRad, sRad * 0.45, starR);
                            float blkCenter = smoothstep(sRad * 0.55, sRad * 0.20, starR);
                            vec3 starCol = mix(brightCrimson, blackCore, blkCenter);
                            gl_FragColor.rgb = mix(gl_FragColor.rgb, starCol, redHalo * 0.95);
                          }
                        }
                      }
                    }
                    // النوع 10: ابتسامة غلاسكو الممزقة وخدوش الوجه المتقاطعة (Glasgow Torn Smile & Cross-Stitched Cheek Rip)
                    else if (uFaceScar > 9.5) {
                      // 1) شق الفم الممزق من زاويتي الشفتين حتى الوجنتين مع غرز جراحية ولحم مكشوف
                      if (abs(p.x) > 0.020 && abs(p.x) < 0.060 && p.y > 0.605 && p.y < 0.665 && p.z > 0.055) {
                        float smileCurveY = 0.618 + pow((abs(p.x) - 0.020) * 24.0, 1.40) * 0.012;
                        float dSmile = abs(p.y - smileCurveY + sin(p.x * 320.0) * 0.0005);
                        if (dSmile < 0.0065) {
                          float coreTrench = smoothstep(0.0018, 0.0003, dSmile);
                          float rawLip     = smoothstep(0.0040, 0.0012, dSmile);
                          float haloBruise = smoothstep(0.0065, 0.0022, dSmile);
                          vec3 colSmile = mix(vec3(0.65, 0.18, 0.18), vec3(0.48, 0.03, 0.03), rawLip);
                          colSmile = mix(colSmile, vec3(0.08, 0.008, 0.008), coreTrench);
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, colSmile, haloBruise * 0.94);

                          // غرز خياطة متقاطعة X على طول الشق الممزق
                          float stPhase = mod((abs(p.x) - 0.020) * 180.0, 1.0) - 0.5;
                          float xStitch1 = smoothstep(0.12, 0.02, abs(stPhase - (p.y - smileCurveY) * 90.0)) * step(dSmile, 0.0042);
                          float xStitch2 = smoothstep(0.12, 0.02, abs(stPhase + (p.y - smileCurveY) * 90.0)) * step(dSmile, 0.0042);
                          if (max(xStitch1, xStitch2) > 0.15) {
                            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.05, 0.05, 0.06), max(xStitch1, xStitch2) * 0.92);
                          }
                        }
                      }
                      // 2) جرح غائر عرضي عبر جسر الأنف والحاجب
                      if (abs(p.x) < 0.024 && abs(p.y - 0.665) < 0.0045 && p.z > 0.080) {
                        float dNoseBridge = abs(p.y - (0.665 - p.x * 0.15));
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.28, 0.02, 0.02), smoothstep(0.0032, 0.0005, dNoseBridge) * 0.90);
                      }
                    }
                  }

                  // 2.ب ميزة الوجه المشوه بالضربات والشقوق العميقة ثلاثية الأبعاد (3D Facial Slash Wounds & Deep Flesh Trauma)
                  if (uFaceSlashType > 0.5) {
                    float dSlash = 1.0;
                    float sMask = 0.0;

                    if (uFaceSlashType > 0.5 && uFaceSlashType < 1.5) {
                      float sX = -0.036 + (p.y - 0.70) * 0.22;
                      dSlash = abs(p.x - sX);
                      sMask = step(0.610, p.y) * step(p.y, 0.785) * step(0.045, p.z);
                    } else if (uFaceSlashType > 1.5 && uFaceSlashType < 2.5) {
                      float sY = 0.648 + sin((p.x - 0.038) * 40.0) * 0.005;
                      dSlash = abs(p.y - sY);
                      sMask = step(0.015, p.x) * step(p.x, 0.068) * step(0.050, p.z);
                    } else if (uFaceSlashType > 2.5 && uFaceSlashType < 3.5) {
                      float d1 = abs(p.y - (0.680 + p.x * 0.85));
                      float d2 = abs(p.y - (0.680 - p.x * 0.85));
                      dSlash = min(d1, d2);
                      sMask = step(abs(p.x), 0.052) * step(0.625, p.y) * step(p.y, 0.730) * step(0.055, p.z);
                    } else if (uFaceSlashType > 3.5) {
                      float sY = 0.612 - (p.x - 0.022) * 0.65;
                      dSlash = abs(p.y - sY);
                      sMask = step(0.018, p.x) * step(p.x, 0.062) * step(0.575, p.y) * step(p.y, 0.635) * step(0.045, p.z);
                    }

                    if (sMask > 0.5 && dSlash < 0.015) {
                      float trenchDepth = smoothstep(0.0022, 0.0002, dSlash);
                      float fleshSpread = smoothstep(0.0065, 0.0015, dSlash);
                      float bruiseHalo  = smoothstep(0.0150, 0.0040, dSlash);

                      vec3 freshBlood = vec3(0.55, 0.04, 0.05);
                      vec3 deepFlesh  = vec3(0.28, 0.02, 0.03);
                      vec3 clottedDark = vec3(0.06, 0.008, 0.010);
                      vec3 bruiseCol   = vec3(0.36, 0.10, 0.18);
                      vec3 scarTissue  = vec3(0.72, 0.45, 0.48);

                      vec3 woundColor = mix(deepFlesh, freshBlood, uFaceSlashFresh * 0.65);
                      woundColor = mix(woundColor, clottedDark, trenchDepth * (1.0 - uFaceSlashFresh * 0.4));
                      woundColor = mix(scarTissue, woundColor, uFaceSlashFresh);

                      vec3 bruisedSkin = mix(gl_FragColor.rgb, bruiseCol, bruiseHalo * 0.75);
                      gl_FragColor.rgb = mix(bruisedSkin, woundColor, fleshSpread * 0.95);

                      if (uFaceSlashFresh > 0.3 && dSlash < 0.0035) {
                        gl_FragColor.rgb += vec3(0.28, 0.05, 0.05) * uFaceSlashFresh;
                      }

                      if (uFaceSlashStitches > 0.5) {
                        float stitchStep = (uFaceSlashType > 1.5 && uFaceSlashType < 2.5) ? p.x : p.y;
                        float stMod = abs(mod(stitchStep * 130.0, 1.0) - 0.5);
                        // غرز خياطة طبية متقاطعة بيضاء واضحة (White Medical Suture Cross-Threads)
                        if (stMod < 0.14 && dSlash < 0.0095) {
                          float threadShape = smoothstep(0.14, 0.02, stMod);
                          vec3 sutureThread = vec3(0.92, 0.94, 0.96);
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, sutureThread, threadShape * 0.98);
                        }
                        // ثقوب وخز إبر الخياطة الدامية على جانبي الجرح
                        if (stMod < 0.20 && abs(dSlash - 0.0085) < 0.0022) {
                          vec3 punctureBlood = vec3(0.18, 0.01, 0.02);
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, punctureBlood, 0.92);
                        }
                      }
                    }
                  }

                  // 3. وشوم الوجه والرقبة (Face & Neck Tattoos)
                  if (uFaceTattoo > 0.5) {
                    // النوع 1: وشم كتابة قوطية مقوسة تحت العين اليسرى "Rawr.." كما بالصورة المرفقة (Curved Gothic Under-Eye Script)
                    if (uFaceTattoo > 0.5 && uFaceTattoo < 1.5) {
                      float curveBaseY = 0.671 + pow(max(0.0, p.x - 0.018) * 18.0, 1.35) * 0.0095;
                      float localY = p.y - curveBaseY;
                      if (p.x > 0.018 && p.x < 0.058 && localY > 0.0 && localY < 0.017 && p.z > 0.072) {
                        float uTx = (p.x - 0.018) / (0.058 - 0.018);
                        float uTy = localY / 0.017;
                        
                        float stroke = 0.0;
                        if (uTx < 0.28) {
                          float rx = uTx / 0.28;
                          float rStem = smoothstep(0.09, 0.015, abs(rx - 0.24));
                          float rSerif = smoothstep(0.11, 0.02, abs(uTy - 0.85) + abs(rx - 0.24) * 0.6);
                          float rLoop = smoothstep(0.12, 0.02, abs(length(vec2(rx - 0.55, uTy - 0.68)) - 0.26));
                          float rLeg = smoothstep(0.09, 0.015, abs((uTy - 0.12) - (0.95 - rx) * 1.15)) * step(0.38, rx) * step(uTy, 0.56);
                          stroke = max(max(rStem, rSerif), max(rLoop, rLeg));
                        } else if (uTx < 0.52) {
                          float ax = (uTx - 0.28) / 0.24;
                          float aCircle = smoothstep(0.12, 0.02, abs(length(vec2(ax - 0.45, uTy - 0.40)) - 0.25));
                          float aStem = smoothstep(0.09, 0.015, abs(ax - 0.74)) * step(uTy, 0.68);
                          stroke = max(aCircle, aStem);
                        } else if (uTx < 0.78) {
                          float wx = (uTx - 0.52) / 0.26;
                          float wV1 = smoothstep(0.10, 0.015, abs(uTy - abs(wx - 0.28) * 2.2));
                          float wV2 = smoothstep(0.10, 0.015, abs(uTy - abs(wx - 0.72) * 2.2));
                          stroke = max(wV1, wV2) * step(uTy, 0.68);
                        } else {
                          float rx2 = (uTx - 0.78) / 0.22;
                          float rStem2 = smoothstep(0.10, 0.015, abs(rx2 - 0.26)) * step(uTy, 0.64);
                          float rArch = smoothstep(0.10, 0.015, abs(uTy - (0.56 + sin(rx2 * 3.14) * 0.14))) * step(0.2, rx2) * step(rx2, 0.72);
                          stroke = max(rStem2, rArch);
                        }

                        if (stroke > 0.12) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, stroke * 0.94, p, 0.0);
                        }
                      }
                    }
                    // النوع 2: وشم دمعة عصابات وصليب تحت العين
                    else if (uFaceTattoo > 1.5 && uFaceTattoo < 2.5) {
                      vec2 tearPos = vec2(0.046, 0.686);
                      vec2 dt = p.xy - tearPos;
                      if (abs(dt.x) < 0.005 && dt.y > -0.006 && dt.y < 0.007 && p.z > 0.075) {
                        float tearShape = length(vec2(dt.x, dt.y < 0.0 ? dt.y * 1.5 : dt.y * 0.9));
                        if (tearShape < 0.0035) {
                          float tearStr = smoothstep(0.0035, 0.0005, tearShape);
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, tearStr * 0.92, p, 0.0);
                        }
                      }
                      vec2 crossPos = vec2(0.050, 0.674);
                      vec2 dc = p.xy - crossPos;
                      if (p.z > 0.075 && ( (abs(dc.x) < 0.0008 && abs(dc.y) < 0.0040) || (abs(dc.y) < 0.0008 && abs(dc.x) < 0.0028 && dc.y > -0.001) )) {
                        gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, 0.92, p, 0.0);
                      }
                    }
                    // النوع 3: وشم الرقبة الكامل (Gothic Neck Script Tattoo) كما بالصورة 3
                    else if (uFaceTattoo > 2.5 && uFaceTattoo < 3.5) {
                      if (p.y > 0.46 && p.y < 0.54 && abs(p.x) < 0.068 && p.z > 0.040) {
                        float neckBand = sin(p.y * 180.0) * sin(p.x * 120.0 + sin(p.y * 90.0) * 2.0);
                        float neckFiligree = sin(atan(p.x, p.z) * 16.0 + p.y * 60.0);
                        if (neckBand > 0.28 || (neckFiligree > 0.55 && abs(p.x) > 0.025)) {
                          float str = max(smoothstep(0.28, 0.55, neckBand), smoothstep(0.55, 0.75, neckFiligree));
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, str * 0.88, p, 0.0);
                        }
                      }
                    }
                    // النوع 4: لصقة جروح طبية واقعية على الخد (Photorealistic Medical Adhesive Bandage / Band-Aid)
                    else if (uFaceTattoo > 3.5 && uFaceTattoo < 4.5) {
                      // مركز اللصقة على الخد مائلة مع امتداد عظمة الخد الطبيعية
                      vec2 patchCenter = vec2(0.044, 0.672);
                      float ang = -0.24; // زاوية ميلان واقعية تتبع خط الوجنة
                      float cosA = cos(ang), sinA = sin(ang);
                      vec2 relP = p.xy - patchCenter;
                      vec2 bCoord = vec2(relP.x * cosA - relP.y * sinA, relP.x * sinA + relP.y * cosA);

                      // أبعاد اللصقة الطبية بيضاوية الأطراف (Rounded Capsule / Pill Band-Aid)
                      float halfW = 0.0150;
                      float halfH = 0.0056;
                      float cornerR = 0.0032;

                      vec2 qBox = abs(bCoord) - vec2(halfW - cornerR, halfH - cornerR);
                      float dBandage = length(max(qBox, vec2(0.0))) + min(max(qBox.x, qBox.y), 0.0) - cornerR;

                      // 1. ظل تماس اللصقة على البشرة (Ambient Contact Drop Shadow أسفل ويمين اللصقة لإعطاء عمق مجسم 3D)
                      if (dBandage > 0.0 && dBandage < 0.0018 && (bCoord.y < 0.001 || bCoord.x > 0.004) && p.z > 0.072) {
                        float shadowStrength = smoothstep(0.0018, 0.0001, dBandage) * 0.42;
                        gl_FragColor.rgb *= (1.0 - shadowStrength);
                      }

                      // 2. جسم اللصقة الطبية الحقيقي (The Adhesive Plaster)
                      if (dBandage <= 0.0004 && p.z > 0.072) {
                        float edgeAlpha = smoothstep(0.0004, -0.0003, dBandage);

                        // أبعاد الشاش الطبي المعقم القطني في المنتصف (Central Sterile Gauze Pad)
                        float padHalfW = 0.0048;
                        float padHalfH = 0.0040;
                        float padR = 0.0010;
                        vec2 qPad = abs(bCoord) - vec2(padHalfW - padR, padHalfH - padR);
                        float dPad = length(max(qPad, vec2(0.0))) + min(max(qPad.x, qPad.y), 0.0) - padR;

                        vec3 finalBandageColor;

                        if (dPad <= 0.0) {
                          // الشاش المعقم الداخلي المرتفع قليلاً (Raised Sterile Gauze Pad)
                          // نسيج قماش قطني معقم شبكي (Woven Cotton Mesh Microtexture)
                          float weave = sin(bCoord.x * 2400.0) * sin(bCoord.y * 2400.0) * 0.035;
                          vec3 gauzeBase = vec3(0.93, 0.90, 0.85) + weave;

                          // حواف بارزة ثلاثية الأبعاد (Embossed Bevel Highlight & Shadow)
                          float bevelX = smoothstep(-padHalfW, -padHalfW + 0.0008, bCoord.x) - smoothstep(padHalfW - 0.0008, padHalfW, bCoord.x);
                          float bevelY = smoothstep(-padHalfH, -padHalfH + 0.0008, bCoord.y) - smoothstep(padHalfH - 0.0008, padHalfH, bCoord.y);
                          float bevel = (bevelX * bevelY);
                          gauzeBase = mix(gauzeBase * 0.88, gauzeBase * 1.06, smoothstep(0.0, 0.8, bevel));

                          // مسحة مطهر دافئة خفيفة في المركز (Antiseptic Center Hint)
                          float centerGlow = smoothstep(0.0035, 0.0, length(bCoord));
                          gauzeBase = mix(gauzeBase, vec3(0.91, 0.83, 0.72), centerGlow * 0.35);

                          finalBandageColor = gauzeBase;
                        } else {
                          // أجنحة اللصقة اللاصقة المسامية المرنة (Perforated Flexible Breathable Wings)
                          vec3 tapeBase = vec3(0.83, 0.69, 0.55);

                          // شبكة مسامات التنفس الدقيقة المثقبة (Perforation Breathable Micro-Pore Grid)
                          vec2 poreGrid = mod(bCoord * 950.0, 1.0) - vec2(0.5);
                          float poreDist = length(poreGrid);
                          float isPore = smoothstep(0.24, 0.12, poreDist) * 0.18;
                          tapeBase -= isPore;

                          // ألياف نسيج اللصقة الدقيقة المرنة (Fabric Texture)
                          float fabricNoise = sin(bCoord.x * 600.0 + bCoord.y * 500.0) * 0.015;
                          tapeBase += fabricNoise;

                          // حافة شريط لاصق شفاف ناعم عند الأطراف يندمج مع الجلد
                          float adhesiveBorder = smoothstep(-0.0008, 0.0, dBandage);
                          tapeBase = mix(tapeBase, tapeBase * 0.92, adhesiveBorder * 0.4);

                          finalBandageColor = tapeBase;
                        }

                        gl_FragColor.rgb = mix(gl_FragColor.rgb, finalBandageColor, edgeAlpha * 0.96);
                      }
                    }
                    // النوع 5: سلك شائك عصابات واقعي وصليب قوطي (Barbed Wire & Chicano Gang Cross)
                    else if (uFaceTattoo > 4.5 && uFaceTattoo < 5.5) {
                      vec3 inkColor = vec3(0.06, 0.08, 0.11);
                      // أ) سلك شائك واقعي مجدول يلتف عبر الجبين ومحاذاة خط الشعر
                      if (p.y > 0.720 && p.y < 0.748 && abs(p.x) < 0.058 && p.z > 0.060) {
                        float wireCenterY = 0.734 + sin(p.x * 20.0) * 0.003;
                        float wireTwist = sin(p.x * 420.0);
                        float strand1 = smoothstep(0.0007, 0.0001, abs(p.y - (wireCenterY + wireTwist * 0.0008)));
                        float strand2 = smoothstep(0.0007, 0.0001, abs(p.y - (wireCenterY - wireTwist * 0.0008)));
                        float wireBody = max(strand1, strand2);

                        // عقد وأشواك السلك الشائك الحادة المتقاطعة رباعية الأطراف (4-Point Barbs)
                        float barbPhase = mod((p.x + 0.06) * 44.0, 1.0) - 0.5;
                        float barbSpike1 = smoothstep(0.0006, 0.0001, abs((p.y - wireCenterY) - barbPhase * 0.016)) * step(abs(barbPhase), 0.15);
                        float barbSpike2 = smoothstep(0.0006, 0.0001, abs((p.y - wireCenterY) + barbPhase * 0.016)) * step(abs(barbPhase), 0.15);
                        float barbKnot = smoothstep(0.0015, 0.0003, length(vec2(barbPhase * 0.022, p.y - wireCenterY)));
                        float totalWire = max(wireBody, max(max(barbSpike1, barbSpike2), barbKnot));

                        if (totalWire > 0.15) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, totalWire * 0.92, p, 0.0);
                        }
                      }
                      // ب) صليب قوطي عصابات دقيق ومفصل مع أشعة على الصدغ الأيمن
                      vec2 crossCenter = vec2(-0.046, 0.672);
                      vec2 dc = p.xy - crossCenter;
                      if (length(dc) < 0.014 && p.z > 0.065) {
                        float vStem = smoothstep(0.0011, 0.0002, abs(dc.x)) * step(abs(dc.y), 0.0085);
                        float hArm = smoothstep(0.0010, 0.0002, abs(dc.y - 0.0015)) * step(abs(dc.x), 0.0055);
                        // نهايات الصليب العريضة (Flared Gothic Ends)
                        float flareT = smoothstep(0.0018, 0.0002, abs(dc.x) - (0.0085 - abs(dc.y)) * 0.4) * step(0.006, abs(dc.y)) * step(abs(dc.y), 0.0088);
                        float flareH = smoothstep(0.0018, 0.0002, abs(dc.y - 0.0015) - (0.0055 - abs(dc.x)) * 0.4) * step(0.0035, abs(dc.x)) * step(abs(dc.x), 0.0058);
                        float crossTotal = max(max(vStem, hArm), max(flareT, flareH));
                        if (crossTotal > 0.15) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, crossTotal * 0.92, p, 0.0);
                        }
                      }
                    }
                    // النوع 6: وشم فك وأسنان جمجمة الموت الحقيقي مع فك مشدود وتجاويف عظمية واقعية
                    else if (uFaceTattoo > 5.5 && uFaceTattoo < 6.5) {
                      // 1) أسنان الهيكل العظمي المتشابكة مع جذور اللثة وفواصل الأسنان الدقيقة
                      if (p.y > 0.565 && p.y < 0.618 && abs(p.x) < 0.035 && p.z > 0.070) {
                        float toothWidth = 0.0060;
                        float toothCol = mod(p.x + toothWidth * 0.5, toothWidth) - toothWidth * 0.5;
                        
                        // فواصل الأسنان الرأسية (Interdental Slits)
                        float slit = smoothstep(0.0007, 0.0001, abs(toothCol)) * step(abs(p.x), 0.031);
                        
                        // خط إطباق الفم الأوسط (Bite Seam)
                        float biteSeam = smoothstep(0.0012, 0.0002, abs(p.y - 0.592)) * step(abs(p.x), 0.032);
                        
                        // أقواس قمم الأسنان العلوية والسفلية (Scalloped Tooth Crowns)
                        float toothArchU = smoothstep(0.0010, 0.0001, abs(p.y - (0.606 - cos(toothCol * 520.0) * 0.0018)));
                        float toothArchL = smoothstep(0.0010, 0.0001, abs(p.y - (0.578 + cos(toothCol * 520.0) * 0.0018)));
                        
                        // جذور الأسنان المغروسة في الفك
                        float roots = slit * (step(0.606, p.y) + step(p.y, 0.578)) * 0.75;
                        
                        float teethInk = max(max(slit, biteSeam), max(max(toothArchU, toothArchL), roots));
                        if (teethInk > 0.15) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, teethInk * 0.94, p, 0.0);
                        }
                      }

                      // 2) ابتسامة الخياطة الممتدة للفك من زاويتي الفم (Split Jaw Stitched Grin)
                      if (abs(p.x) > 0.028 && abs(p.x) < 0.054 && p.y > 0.580 && p.y < 0.630 && p.z > 0.065) {
                        float grinY = 0.592 + pow((abs(p.x) - 0.028) * 32.0, 1.35) * 0.0065;
                        float distGrin = abs(p.y - grinY);
                        float grinLine = smoothstep(0.0009, 0.0002, distGrin);
                        // غرز متقاطعة عبر مسار الابتسامة
                        float stitchMod = mod(abs(p.x) * 220.0, 1.0);
                        float stitchCross = smoothstep(0.12, 0.02, abs(stitchMod - 0.5)) * smoothstep(0.0035, 0.0005, distGrin);
                        float smileTotal = max(grinLine, stitchCross);
                        if (smileTotal > 0.15) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, smileTotal * 0.90, p, 0.0);
                        }
                      }

                      // 3) تظليل تجويف عظم الخد الهيكلي الانسيابي (Zygomatic Arch Shading - تظليل وشم ناعم وليس مربعاً أسود!)
                      if (abs(p.x) > 0.032 && abs(p.x) < 0.060 && p.y > 0.605 && p.y < 0.650 && p.z > 0.065) {
                        float dHollow = length(vec2((abs(p.x) - 0.046) * 1.3, (p.y - 0.628) * 1.0));
                        float stipple = sin(p.x * 400.0) * sin(p.y * 400.0) * 0.10;
                        float hollowShadow = smoothstep(0.016, 0.003, dHollow) * (0.85 + stipple);
                        if (hollowShadow > 0.05) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, hollowShadow * 0.55, p, 0.0);
                        }
                      }

                      // 4) تجويف الأنف الهيكلي لجمجمة الموت (Piriform Aperture)
                      if (abs(p.x) < 0.013 && p.y > 0.624 && p.y < 0.648 && p.z > 0.080) {
                        float noseAperture = smoothstep(0.0065, 0.0015, length(vec2(abs(p.x) - 0.0035, (p.y - 0.635) * 1.25)));
                        if (noseAperture > 0.1) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, noseAperture * 0.94, p, 0.0);
                        }
                      }
                    }
                    // النوع 7: خنجر عصابات وأرقام رومانية ورموز (Gang Dagger & Roman Numerals)
                    else if (uFaceTattoo > 6.5 && uFaceTattoo < 7.5) {
                      // خنجر عمودي مغروس تحت العين اليمنى
                      if (abs(p.x - (-0.044)) < 0.006 && p.y > 0.625 && p.y < 0.690 && p.z > 0.075) {
                        float dxDagger = abs(p.x - (-0.044));
                        float blade = smoothstep(0.0016, 0.0004, dxDagger) * step(p.y, 0.672) * step(0.628, p.y);
                        float guard = smoothstep(0.0014, 0.0003, abs(p.y - 0.672)) * step(dxDagger, 0.0055);
                        float hilt = smoothstep(0.0012, 0.0003, dxDagger) * step(0.672, p.y) * step(p.y, 0.686);
                        float daggerShape = max(blade, max(guard, hilt));
                        if (daggerShape > 0.15) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, daggerShape * 0.92, p, 0.0);
                        }
                      }
                      // أرقام لاتينية "XIII" فوق الحاجب الأيمن
                      if (p.x > -0.048 && p.x < -0.020 && p.y > 0.725 && p.y < 0.742 && p.z > 0.075) {
                        float normX = (p.x - (-0.048)) / 0.028;
                        float stem1 = smoothstep(0.06, 0.01, abs(normX - 0.20));
                        float stem2 = smoothstep(0.06, 0.01, abs(normX - 0.38));
                        float stem3 = smoothstep(0.06, 0.01, abs(normX - 0.56));
                        float crossX1 = smoothstep(0.08, 0.01, abs(normX - 0.76 - (p.y - 0.733) * 3.0));
                        float crossX2 = smoothstep(0.08, 0.01, abs(normX - 0.76 + (p.y - 0.733) * 3.0));
                        float romanNum = max(max(stem1, max(stem2, stem3)), max(crossX1, crossX2));
                        if (romanNum > 0.15) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, romanNum * 0.90, p, 0.0);
                        }
                      }
                    }
                    // النوع 8: شبكة عنكبوت وسلك شائك وأرقام رومانية (Spiderweb, Barbed Wire & Roman Numerals)
                    else if (uFaceTattoo > 7.5 && uFaceTattoo < 8.5) {
                      vec3 inkColor = vec3(0.05, 0.07, 0.10);

                      // 1) شبكة عنكبوت شعاعية كبيرة في أعلى الجبين (Radial Spiderweb on Forehead)
                      vec2 webCenter = vec2(0.0, 0.770);
                      vec2 dWeb = p.xy - webCenter;
                      float rWeb = length(dWeb);
                      if (rWeb < 0.052 && p.y < 0.770 && p.z > 0.065) {
                        float aWeb = atan(dWeb.y, dWeb.x);
                        // خطوط شعاعية ممتدة كأضلاع الشبكة
                        float spokes = smoothstep(0.06, 0.01, abs(sin(aWeb * 8.0))) * smoothstep(0.052, 0.010, rWeb);
                        // خيوط دائرية متحدة المركز
                        float webRings = smoothstep(0.0014, 0.0002, abs(mod(rWeb * 140.0, 1.0) - 0.5));
                        float spiderWeb = max(spokes, webRings * 0.75);
                        if (spiderWeb > 0.15) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, spiderWeb * 0.90, p, 0.0);
                        }
                      }

                      // 2) أرقام رومانية عريضة "XIII" على الخد الأيمن
                      if (p.x > -0.054 && p.x < -0.024 && p.y > 0.635 && p.y < 0.665 && p.z > 0.072) {
                        float uxR = (p.x - (-0.054)) / 0.030;
                        float stem1 = smoothstep(0.07, 0.01, abs(uxR - 0.20));
                        float stem2 = smoothstep(0.07, 0.01, abs(uxR - 0.40));
                        float stem3 = smoothstep(0.07, 0.01, abs(uxR - 0.60));
                        float x1 = smoothstep(0.09, 0.01, abs(uxR - 0.82 - (p.y - 0.650) * 4.0));
                        float x2 = smoothstep(0.09, 0.01, abs(uxR - 0.82 + (p.y - 0.650) * 4.0));
                        float bars = smoothstep(0.0012, 0.0002, min(abs(p.y - 0.662), abs(p.y - 0.638))) * step(0.12, uxR) * step(uxR, 0.92);
                        float numXIII = max(max(stem1, max(stem2, stem3)), max(max(x1, x2), bars));
                        if (numXIII > 0.15) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, numXIII * 0.90, p, 0.0);
                        }
                      }

                      // 3) سلك شائك عصابات يلتف على الصدغ والفك الأيسر (Coiled Barbed Wire along Temple/Jaw)
                      if (p.x > 0.030 && p.x < 0.062 && p.y > 0.600 && p.y < 0.730 && p.z > 0.050) {
                        float wireCurve = 0.046 + sin(p.y * 35.0) * 0.005;
                        float dWire = abs(p.x - wireCurve);
                        float wCore = smoothstep(0.0012, 0.0002, dWire);
                        float barbPhase = mod(p.y * 70.0, 1.0) - 0.5;
                        float barbs = smoothstep(0.0010, 0.0002, abs(dWire - abs(barbPhase) * 0.007)) * step(abs(barbPhase), 0.22);
                        float wireTotal = max(wCore, barbs);
                        if (wireTotal > 0.15) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, wireTotal * 0.88, p, 0.0);
                        }
                      }

                      // 4) خنجر حربي غائر تحت العين اليسرى
                      if (abs(p.x - 0.044) < 0.006 && p.y > 0.625 && p.y < 0.690 && p.z > 0.075) {
                        float dxD = abs(p.x - 0.044);
                        float blade = smoothstep(0.0016, 0.0003, dxD) * step(p.y, 0.672) * step(0.628, p.y);
                        float guard = smoothstep(0.0013, 0.0002, abs(p.y - 0.672)) * step(dxD, 0.0052);
                        float hilt = smoothstep(0.0011, 0.0002, dxD) * step(0.672, p.y) * step(p.y, 0.686);
                        float dagger = max(blade, max(guard, hilt));
                        if (dagger > 0.15) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, dagger * 0.90, p, 0.0);
                        }
                      }
                    }
                    // النوع 9: وشم عصابات الحاجبين (w.e.a) + شق الحاجب المزدوج + دمعتين + حلق الشفة + وشم الحنجرة الأمامي (صورة 4)
                    else if (uFaceTattoo > 8.5 && uFaceTattoo < 9.5) {
                      vec3 inkColor = vec3(0.06, 0.07, 0.09);

                      // 1) حروف قوطية نقية ودقيقة "w.e.a" فوق الحاجب الأيمن (Right Eyebrow Old English "w.e.a")
                      if (p.x > -0.046 && p.x < -0.015 && p.y > 0.720 && p.y < 0.736 && p.z > 0.072) {
                        float ux = (p.x - (-0.046)) / 0.031;
                        float uy = (p.y - 0.720) / 0.016;
                        float wStroke = 0.0;
                        if (ux < 0.35) {
                          float lx = ux / 0.35;
                          float s1 = smoothstep(0.12, 0.02, abs(lx - 0.18));
                          float s2 = smoothstep(0.12, 0.02, abs(lx - 0.50));
                          float s3 = smoothstep(0.12, 0.02, abs(lx - 0.82));
                          float bBot = smoothstep(0.14, 0.02, abs(uy - 0.18)) * step(0.15, lx) * step(lx, 0.85);
                          wStroke = max(max(s1, max(s2, s3)) * step(0.15, uy) * step(uy, 0.88), bBot);
                        } else if (ux < 0.42) {
                          wStroke = smoothstep(0.18, 0.03, length(vec2((ux - 0.38) * 3.0, uy - 0.20)));
                        } else if (ux < 0.66) {
                          float ex = (ux - 0.42) / 0.24;
                          float eLoop = smoothstep(0.14, 0.02, abs(length(vec2(ex - 0.50, uy - 0.50)) - 0.28));
                          float eBar  = smoothstep(0.11, 0.02, abs(uy - 0.54)) * step(0.22, ex) * step(ex, 0.78);
                          wStroke = max(eLoop, eBar);
                        } else if (ux < 0.74) {
                          wStroke = smoothstep(0.18, 0.03, length(vec2((ux - 0.70) * 3.0, uy - 0.20)));
                        } else {
                          float ax = (ux - 0.74) / 0.26;
                          float aLoop = smoothstep(0.14, 0.02, abs(length(vec2(ax - 0.44, uy - 0.46)) - 0.26));
                          float aStem = smoothstep(0.11, 0.02, abs(ax - 0.74)) * step(0.15, uy) * step(uy, 0.82);
                          wStroke = max(aLoop, aStem);
                        }
                        if (wStroke > 0.15) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, wStroke * 0.92, p, 0.0);
                        }
                      }

                      // 2) مخطوطة مائلة انسيابية رشيقة فوق الحاجب الأيسر + شقّين قطريين في الحاجب الأيسر (Left Brow Script & Double Slit)
                      if (p.x > 0.016 && p.x < 0.048 && p.y > 0.722 && p.y < 0.738 && p.z > 0.068) {
                        float archL = 0.729 + sin((p.x - 0.016) * 95.0) * 0.0028;
                        float dSc = abs(p.y - archL + sin(p.x * 380.0) * 0.0018);
                        float scriptAlpha = smoothstep(0.0022, 0.0004, dSc) * smoothstep(0.016, 0.019, p.x) * smoothstep(0.048, 0.044, p.x);
                        if (scriptAlpha > 0.1) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, scriptAlpha * 0.86, p, 0.0);
                        }
                      }
                      // شقّان حادّان يقطعان شعر طرف الحاجب الأيسر (Double Eyebrow Razor Slits)
                      if (p.x > 0.035 && p.x < 0.048 && p.y > 0.708 && p.y < 0.724 && p.z > 0.072) {
                        float slit1 = smoothstep(0.0012, 0.0002, abs((p.x - 0.039) - (p.y - 0.716) * 0.35));
                        float slit2 = smoothstep(0.0012, 0.0002, abs((p.x - 0.044) - (p.y - 0.716) * 0.35));
                        float slitMask = max(slit1, slit2);
                        if (slitMask > 0.15) {
                          vec3 shavedSkin = clamp(uPedSkinColor * 0.82, vec3(0.35, 0.24, 0.18), vec3(0.88, 0.72, 0.62));
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, shavedSkin, slitMask * 0.94);
                        }
                      }

                      // 3) شرطتان مائلتان متوازيتان تحت العين اليمنى // كما بالصورة 4 تماماً
                      if (p.x < -0.032 && p.x > -0.048 && p.y > 0.672 && p.y < 0.688 && p.z > 0.075) {
                        for (int t = 0; t < 2; t++) {
                          vec2 tCenter = (t == 0) ? vec2(-0.037, 0.681) : vec2(-0.043, 0.678);
                          vec2 dSlash = p.xy - tCenter;
                          float slashLine = abs(dSlash.x - dSlash.y * 0.55);
                          float slashLen  = abs(dSlash.y);
                          if (slashLine < 0.00085 && slashLen < 0.0035) {
                            float sAlpha = smoothstep(0.00085, 0.0002, slashLine) * smoothstep(0.0035, 0.0020, slashLen);
                            gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, sAlpha * 0.90, p, 0.0);
                          }
                        }
                      }

                      // 4) حلق الشفة السفلى الفضي اللامع ثلاثي الأبعاد (Metallic Silver Lower Lip Stud Piercing)
                      vec2 studCenter = vec2(-0.014, 0.608);
                      float dStud = length(p.xy - studCenter);
                      if (dStud < 0.0024 && p.z > 0.078) {
                        float studSpec = smoothstep(0.0012, 0.0002, length(p.xy - (studCenter + vec2(-0.0005, 0.0005))));
                        vec3 silverCol = mix(vec3(0.55, 0.58, 0.62), vec3(0.98, 0.99, 1.0), studSpec);
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, silverCol, smoothstep(0.0024, 0.0014, dStud) * 0.96);
                      }

                      // 5) وشم الحنجرة الأمامي المركز Chicano فقط على تفاحة آدم (بدون تلطيخ جانبي الرقبة - صورة 4)
                      if (p.y > 0.450 && p.y < 0.575 && abs(p.x) < 0.046 && p.z > 0.035) {
                        float throatEnv = smoothstep(0.046, 0.015, abs(p.x)) * smoothstep(0.575, 0.535, p.y) * smoothstep(0.450, 0.485, p.y);
                        float scriptWave = sin(p.x * 240.0 + sin(p.y * 190.0) * 1.8) * cos(p.y * 160.0 - abs(p.x) * 130.0);
                        float flourish = sin(length(vec2(p.x * 1.4, p.y - 0.510)) * 290.0 + atan(p.y - 0.510, p.x) * 6.0);
                        float inkDensity = max(smoothstep(0.18, 0.68, scriptWave), smoothstep(0.28, 0.78, flourish) * 0.85) * throatEnv;
                        if (inkDensity > 0.08) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, inkDensity * 0.90, p, 0.0);
                        }
                      }
                    }
                    // النوع 10: نجوم الصدغ الخماسية البارزة + تاتو الرقبة الكامل الدائري (صورة 5)
                    else if (uFaceTattoo > 9.5 && uFaceTattoo < 10.5) {
                      vec3 inkColor = vec3(0.06, 0.07, 0.09);
                      vec3 starBurgundy = vec3(0.26, 0.07, 0.08);

                      // 1) كلمة مقوسة انسيابية واحدة أنيقة فوق الحاجب الأيمن (Single Arched Word - بدون سلم ولا خطوط رأسية!)
                      if (p.x > -0.048 && p.x < -0.012 && p.y > 0.722 && p.y < 0.742 && p.z > 0.068) {
                        float browCurveY = 0.728 + (1.0 - pow((p.x - (-0.030)) / 0.018, 2.0)) * 0.0065;
                        float dCurve = abs(p.y - browCurveY + sin(p.x * 320.0) * 0.0014);
                        if (dCurve < 0.0024) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, smoothstep(0.0024, 0.0004, dCurve) * 0.88, p, 0.0);
                        }
                      }

                      // 2) مجموعة النجوم الخماسية البارزة الكبيرة على الصدغ والجبين الأيسر (5 Prominent Stars - صورة 5)
                      if (p.x > 0.022 && p.x < 0.068 && p.y > 0.690 && p.y < 0.780 && p.z > 0.038) {
                        for (int k = 0; k < 5; k++) {
                          vec2 stPos;
                          float stSize = 0.0075;
                          if (k == 0) { stPos = vec2(0.044, 0.732); stSize = 0.0125; } // النجمة الرئيسية الكبرى
                          else if (k == 1) { stPos = vec2(0.040, 0.758); stSize = 0.0080; } // النجمة العلوية
                          else if (k == 2) { stPos = vec2(0.032, 0.772); stSize = 0.0058; } // نجمة خط الشعر
                          else if (k == 3) { stPos = vec2(0.056, 0.724); stSize = 0.0068; } // نجمة جانب الصدغ
                          else { stPos = vec2(0.054, 0.702); stSize = 0.0055; } // النجمة السفلية

                          vec2 dSt = p.xy - stPos;
                          float rSt = length(dSt);
                          float aSt = atan(dSt.y, dSt.x) - 1.5708;
                          float starShape = rSt * (1.0 + 0.44 * cos(aSt * 5.0));
                          if (starShape < stSize) {
                            float stAlpha = smoothstep(stSize, stSize * 0.50, starShape);
                            gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, stAlpha * 0.92, p, 1.0);
                          }
                        }
                      }

                      // 3) دمعة عصابات واحدة تحت العين اليمنى + ندبة رقيقة أسفلها
                      vec2 tearR = vec2(-0.044, 0.680);
                      vec2 dtR = p.xy - tearR;
                      if (abs(dtR.x) < 0.004 && dtR.y > -0.005 && dtR.y < 0.006 && p.z > 0.072) {
                        float tShapeR = length(vec2(dtR.x, dtR.y < 0.0 ? dtR.y * 1.5 : dtR.y * 0.9));
                        if (tShapeR < 0.0030) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, 0.90, p, 0.0);
                        }
                      }
                      // ندبة رقيقة كالصورة 5 تحت العين اليمنى
                      if (p.x < -0.024 && p.x > -0.052 && abs(p.y - (0.665 + (p.x - (-0.038)) * 0.22)) < 0.0010 && p.z > 0.072) {
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.28, 0.12, 0.14), 0.75);
                      }
                      // شعار رأسي مميز على الوجنة اليسرى
                      if (p.x > 0.044 && p.x < 0.056 && p.y > 0.650 && p.y < 0.682 && p.z > 0.062) {
                        float dEmblem = abs(p.x - (0.049 + sin(p.y * 280.0) * 0.0020));
                        if (dEmblem < 0.0013) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, smoothstep(0.0013, 0.0003, dEmblem) * 0.85, p, 0.0);
                        }
                      }

                      // 4) تاتو الرقبة الداكن الكامل 360 درجة (Full 360 Dark Neck Sleeve - صورة 5)
                      if (p.y < 0.575 && abs(p.x) < 0.086 && p.z > -0.020) {
                        float neckPattern = sin(p.x * 210.0 + sin(p.y * 160.0) * 1.6) * cos(p.y * 180.0 - p.x * 140.0);
                        float darkShading = smoothstep(0.575, 0.530, p.y) * 0.50;
                        float totalNeck = max(smoothstep(0.04, 0.52, neckPattern) * 0.88, darkShading);
                        gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, totalNeck * 0.92, p, 0.0);
                      }
                    }
                    // النوع 11: قناع وشم المهرج الجوكر (Chicano Joker Clown Spikes & Wicked Grin)
                    else if (uFaceTattoo > 10.5) {
                      // 1) خطوط وأسياخ المهرج الماسية الحادة عبر كلا العينين (Giant Diamond Spikes through Eyes)
                      float dxEyeL = abs(p.x - 0.036);
                      float dxEyeR = abs(p.x - (-0.036));
                      float dxEye = min(dxEyeL, dxEyeR);

                      // الهرم العلوي فوق العين (Upper Spikes piercing forehead)
                      if (p.y > 0.702 && p.y < 0.760 && p.z > 0.062) {
                        float tUp = clamp((p.y - 0.702) / 0.056, 0.0, 1.0);
                        float wUp = 0.0072 * (1.0 - tUp);
                        if (dxEye < wUp) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, smoothstep(wUp, wUp * 0.25, dxEye) * 0.94, p, 0.0);
                        }
                      }
                      // الهرم السفلي تحت العين (Lower Spikes piercing cheek)
                      if (p.y > 0.630 && p.y < 0.686 && p.z > 0.065) {
                        float tDown = clamp((0.686 - p.y) / 0.054, 0.0, 1.0);
                        float wDown = 0.0068 * (1.0 - tDown);
                        if (dxEye < wDown) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, smoothstep(wDown, wDown * 0.25, dxEye) * 0.94, p, 0.0);
                        }
                      }

                      // نقاط ماسية صلبة فوق قمة الأسياخ (Diamond tips)
                      if (p.y > 0.758 && p.y < 0.766 && dxEye < 0.0028 && p.z > 0.060) {
                        gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, 0.92, p, 0.0);
                      }

                      // 2) ابتسامة الجوكر العريضة المقوسة الممتدة للأعلى مع غرز عمودية (Stitched Sinister Joker Grin)
                      if (abs(p.x) > 0.020 && abs(p.x) < 0.064 && p.y > 0.612 && p.y < 0.665 && p.z > 0.060) {
                        float jokerY = 0.619 + pow((abs(p.x) - 0.020) * 23.0, 1.65) * 0.016;
                        float dJoker = abs(p.y - jokerY);
                        // الخط الرئيسي للابتسامة
                        if (dJoker < 0.0032) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, smoothstep(0.0032, 0.0005, dJoker) * 0.94, p, 0.0);
                        }
                        // غرز عمودية متقاطعة كابتسامة الجوكر والمهرج (Cross stitches)
                        float stitchMod = abs(mod((abs(p.x) - 0.020) * 120.0, 1.0) - 0.5);
                        if (stitchMod < 0.16 && dJoker < 0.0080) {
                          gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, smoothstep(0.0080, 0.0020, dJoker) * 0.90, p, 0.0);
                        }
                      }

                      // 3) دمعة شيكانو صلبة تحت العين اليسرى
                      vec2 jTear = vec2(0.040, 0.664);
                      float dJT = length(vec2((p.x - jTear.x) * 1.5, p.y - jTear.y));
                      if (dJT < 0.0035 && p.z > 0.070) {
                        gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, 0.94, p, 0.0);
                      }
                    }
                  }
                  } // نهاية حماية البشرة (!isEyeball)
                }

                // 1. التيشيرت عند اللبس العادي: إضافة تكسشر قطني منسوج دقيق
                if (uIsJbib > 0.5 && uStripShirt <= 0.5 && uTailorActive < 0.5) {
                  vec3 p = vCutLocalPos;
                  float fabricGrain = sin(p.x * 900.0) * sin(p.y * 900.0) * 0.025;
                  gl_FragColor.rgb += vec3(fabricGrain);
                }

                // 1.ب تكملة وشوم وجروح الرقبة والحنجرة وزومبي الإشعاع على الجزء العلوي من الجسم (Seamless Neck & Mutant Body Continuation on Uppr)
                if (uIsUppr > 0.5 && uTailorActive < 0.5) {
                  vec3 p = vCutLocalPos;
                  // تكملة وشم الرقبة والحنجرة ليمتد حتى الترقوة وأسفل الرقبة بسلاسة تامة (للأنواع 3 و 8 و 9 و 10)
                  if ((uFaceTattoo > 2.5 && uFaceTattoo < 3.5) || (uFaceTattoo > 7.5 && uFaceTattoo < 10.5)) {
                    if (p.y > 0.425 && p.y < 0.555 && abs(p.x) < 0.076 && p.z > -0.01) {
                      vec3 neckInk = vec3(0.06, 0.07, 0.09);
                      if (uFaceTattoo > 8.5 && uFaceTattoo < 9.5) {
                        // وشم الحنجرة الأمامي المركز (صورة 4)
                        if (abs(p.x) < 0.052 && p.z > 0.025) {
                          float throatEnv = smoothstep(0.050, 0.012, abs(p.x)) * smoothstep(0.428, 0.455, p.y);
                          float scriptWave = sin(p.x * 210.0 + sin(p.y * 170.0) * 1.8) * cos(p.y * 140.0 - abs(p.x) * 120.0);
                          float flourish = sin(length(vec2(p.x * 1.2, p.y - 0.480)) * 260.0 + atan(p.y - 0.480, p.x) * 6.0);
                          float inkD = max(smoothstep(0.15, 0.65, scriptWave), smoothstep(0.25, 0.75, flourish) * 0.85) * throatEnv;
                          if (inkD > 0.08) {
                            gl_FragColor.rgb = mix(gl_FragColor.rgb, neckInk, inkD * 0.88);
                          }
                        }
                      } else if (uFaceTattoo > 9.5 && uFaceTattoo < 10.5) {
                        // طوق الرقبة الكامل الداكن والكثيف (صورة 5)
                        float neckPattern = sin(p.x * 190.0 + sin(p.y * 150.0) * 1.5) * cos(p.y * 170.0 - p.x * 130.0);
                        float envY = smoothstep(0.425, 0.448, p.y);
                        float totalNeck = max(smoothstep(0.05, 0.55, neckPattern) * 0.85, 0.42) * envY;
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, neckInk, totalNeck * 0.90);
                      } else {
                        // طوق سلسلة وسلك شائك للنوع 8 والنوع 3
                        float chainY = abs(p.y - 0.470);
                        float chainRing = smoothstep(0.0035, 0.0006, chainY) * smoothstep(0.080, 0.020, abs(p.x));
                        float chainLinks = smoothstep(0.18, 0.03, abs(mod(p.x * 120.0, 1.0) - 0.5)) * step(chainY, 0.008);
                        if (max(chainRing, chainLinks) > 0.15) {
                          gl_FragColor.rgb = mix(gl_FragColor.rgb, neckInk, 0.90);
                        }
                      }
                    }
                  }
                  // تكملة الطعنات النجمية الدامية على أسفل الرقبة والحنجرة (صورة 2 - النوع 9)
                  if (uFaceScar > 8.5 && uFaceScar < 9.5 && p.y > 0.415 && p.y < 0.555 && abs(p.x) < 0.085 && p.z > 0.01) {
                    vec3 brightCrimson = vec3(0.68, 0.05, 0.06);
                    vec3 blackCore     = vec3(0.04, 0.01, 0.015);
                    for (int s = 0; s < 5; s++) {
                      vec2 sPos;
                      float sRad = 0.011;
                      if (s == 0) { sPos = vec2(-0.042, 0.495); sRad = 0.012; }
                      else if (s == 1) { sPos = vec2(-0.024, 0.472); sRad = 0.010; }
                      else if (s == 2) { sPos = vec2(0.038, 0.488); sRad = 0.011; }
                      else if (s == 3) { sPos = vec2(0.022, 0.468); sRad = 0.009; }
                      else { sPos = vec2(0.0, 0.448); sRad = 0.026; } // النجمة السوداء الكبيرة في وسط الحنجرة كالصورة 2
                      vec2 dS = p.xy - sPos;
                      float rS = length(dS);
                      float aS = atan(dS.y, dS.x);
                      float starR = rS * (1.0 + 0.30 * cos(aS * 6.0));
                      if (starR < sRad) {
                        float redHalo = smoothstep(sRad, sRad * 0.50, starR);
                        float blkCenter = smoothstep(sRad * 0.62, sRad * 0.25, starR);
                        vec3 starCol = mix(brightCrimson, blackCore, blkCenter);
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, starCol, redHalo * 0.96);
                      }
                    }
                  }
                  // تكملة جلد وعروق الزومبي الإشعاعي الأخضر على الرقبة والكتفين والذراعين (صورة 1 - النوع 8)
                  if (uFaceScar > 7.5 && uFaceScar < 8.5) {
                    float lumU = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
                    vec3 mutantGreenU = vec3(0.36, 0.52, 0.42) * (lumU * 1.45 + 0.10);
                    gl_FragColor.rgb = mix(gl_FragColor.rgb, mutantGreenU, 0.82);
                    float collarGlow = smoothstep(0.50, 0.43, p.y) * smoothstep(0.36, 0.42, p.y) * smoothstep(0.12, 0.03, abs(p.x));
                    float armSpot = smoothstep(0.45, 0.85, sin(p.x * 55.0 + p.y * 45.0) * cos(p.y * 70.0));
                    vec3 toxicOrange = vec3(0.76, 0.48, 0.14);
                    gl_FragColor.rgb = mix(gl_FragColor.rgb, toxicOrange, max(collarGlow * 0.72, armSpot * 0.30));
                  }
                }

                // 2. وشوم الصدر والبطن الكثيفة (تظهر على الصدر العاري uppr_bare وعند فصخ التيشيرت)
                if ((uIsJbib > 0.5 || uIsUppr > 0.5) && (uStripShirt > 0.5 || uIsUppr > 0.5)) {
                  vec3 p = vCutLocalPos;

                  if (uBodyTattoo > 0.5) {
                    // أ) كتابة عصابات قوطية مقوسة عريضة عبر أعلى الصدر (WEST COAST / LOYALTY)
                    if (abs(p.x) < 0.14 && p.y > 0.36 && p.y < 0.44 && p.z > 0.04) {
                      float archChestY = 0.395 + (1.0 - (p.x * p.x) / (0.14 * 0.14)) * 0.025;
                      float dChestBanner = abs(p.y - archChestY);
                      float chestStroke = smoothstep(0.18, 0.03, abs(mod(p.x * 90.0, 1.0) - 0.5)) * smoothstep(0.016, 0.002, dChestBanner);
                      float chestBarTop = smoothstep(0.0016, 0.0002, abs(p.y - (archChestY + 0.014))) * step(abs(p.x), 0.13);
                      float chestBarBot = smoothstep(0.0016, 0.0002, abs(p.y - (archChestY - 0.014))) * step(abs(p.x), 0.13);
                      float bannerInk = max(chestStroke, max(chestBarTop, chestBarBot));
                      if (bannerInk > 0.15) {
                        gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, bannerInk * 0.90, p, 0.0);
                      }
                    }
                    // ب) صليب قوطي وأجنحة عصابات عريضة على عظم القص في منتصف الصدر
                    if (abs(p.x) < 0.075 && p.y > 0.24 && p.y < 0.37 && p.z > 0.04) {
                      float vCross = smoothstep(0.0025, 0.0004, abs(p.x)) * step(p.y, 0.36) * step(0.25, p.y);
                      float hCross = smoothstep(0.0022, 0.0004, abs(p.y - 0.325)) * step(abs(p.x), 0.028);
                      float wings = sin(abs(p.x) * 90.0 - (p.y - 0.30) * 80.0) * step(0.015, abs(p.x)) * step(p.y, 0.34) * step(0.28, p.y);
                      float crossWingInk = max(max(vCross, hCross), step(0.55, wings) * 0.7);
                      if (crossWingInk > 0.15) {
                        gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, crossWingInk * 0.88, p, 0.0);
                      }
                    }
                    // ج) وشم بطن عصابات عريض (THUG LIFE / BEAST)
                    if (abs(p.x) < 0.11 && p.y > 0.04 && p.y < 0.14 && p.z > 0.04) {
                      float abStrokes = smoothstep(0.20, 0.04, abs(mod(p.x * 75.0, 1.0) - 0.5)) * smoothstep(0.022, 0.003, abs(p.y - 0.09));
                      float abBorderT = smoothstep(0.0018, 0.0003, abs(p.y - 0.125)) * step(abs(p.x), 0.10);
                      float abBorderB = smoothstep(0.0018, 0.0003, abs(p.y - 0.055)) * step(abs(p.x), 0.10);
                      float stomachTattoo = max(abStrokes, max(abBorderT, abBorderB));
                      if (stomachTattoo > 0.15) {
                        gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, stomachTattoo * 0.90, p, 0.0);
                      }
                    }
                  }

                  // 3. ندبات وجروح الصدر والبطن (Chest & Abdominal Combat Scars, Bullets & Frankenstein Stitches)
                  if (uBodyScar > 0.5) {
                    // أ) ضربة سيف / سكين قطعية مائلة تعبر القفص الصدري من الكتف حتى الأضلاع
                    vec2 cutA = vec2(-0.11, 0.42);
                    vec2 cutB = vec2(0.07, 0.22);
                    vec2 cutBA = cutB - cutA;
                    float tC = clamp(dot(p.xy - cutA, cutBA) / dot(cutBA, cutBA), 0.0, 1.0);
                    float distBodyCut = length(p.xy - (cutA + tC * cutBA));
                    if (distBodyCut < 0.0075 && p.z > 0.04) {
                      float cutTrench = smoothstep(0.0018, 0.0003, distBodyCut);
                      float cutInflamed = smoothstep(0.0065, 0.0015, distBodyCut);
                      vec3 slashCol = mix(vec3(0.68, 0.22, 0.20), vec3(0.12, 0.015, 0.012), cutTrench);
                      gl_FragColor.rgb = mix(gl_FragColor.rgb, slashCol, cutInflamed * 0.90);
                      // دبابيس خياطة جراحية دورية على طول الجرح
                      if (mod(tC * 14.0, 1.0) < 0.20 && distBodyCut < 0.0045) {
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.05, 0.06, 0.07), 0.92);
                      }
                    }

                    // ب) طلقات نارية واقعية متفحمة مع هالة بارود وسيلان دماء (Photorealistic Ballistic Gunshot Wounds)
                    for (int b = 0; b < 2; b++) {
                      vec2 bulletCenter = (b == 0) ? vec2(-0.075, 0.355) : vec2(0.065, 0.285);
                      vec2 dP = p.xy - bulletCenter;
                      float dChestBullet = length(dP);
                      if (dChestBullet < 0.022 && p.z > 0.035) {
                        float angleB = atan(dP.y, dP.x);
                        float starburst = dChestBullet + sin(angleB * 7.0 + cos(angleB * 3.0) * 2.0) * 0.0016;
                        
                        float bulletVoid = smoothstep(0.0035, 0.0010, starburst);
                        float abrasionRing = smoothstep(0.0080, 0.0030, starburst);
                        float contusionHalo = smoothstep(0.022, 0.0070, starburst);
                        
                        vec3 charredPit = vec3(0.015, 0.004, 0.004);
                        vec3 clottedBlood = vec3(0.28, 0.02, 0.02);
                        vec3 abrasionRed = vec3(0.65, 0.08, 0.08);
                        vec3 bruisedDermis = vec3(0.38, 0.14, 0.22);
                        
                        vec3 woundColor = mix(bruisedDermis, abrasionRed, abrasionRing);
                        woundColor = mix(woundColor, clottedBlood, smoothstep(0.0055, 0.0022, starburst));
                        woundColor = mix(woundColor, charredPit, bulletVoid);
                        
                        float sootNoise = sin(p.x * 650.0 + float(b) * 12.0) * cos(p.y * 620.0);
                        if (sootNoise > 0.35 && starburst < 0.016 && starburst > 0.0032) {
                          woundColor = mix(woundColor, vec3(0.03, 0.02, 0.02), 0.85);
                        }
                        
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, woundColor, contusionHalo * 0.94);
                        
                        if (dP.x > -0.004 && dP.x < 0.004 && dP.y < -0.002 && dP.y > -0.045) {
                          float dripLine = abs(dP.x + sin(p.y * 85.0) * 0.0015);
                          if (dripLine < 0.0020) {
                            float dripAlpha = smoothstep(0.0020, 0.0004, dripLine) * smoothstep(-0.045, -0.010, dP.y);
                            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.20, 0.015, 0.015), dripAlpha * 0.90);
                          }
                        }
                      }
                    }

                    // ج) خياطة فرانكنشتاين الجراحية العملاقة على طول عظمة القص (Massive Sternal Frankenstein Autopsy Suture)
                    vec2 frankA = vec2(0.005, 0.43);
                    vec2 frankB = vec2(0.002, 0.14);
                    vec2 fBA = frankB - frankA;
                    float tF = clamp(dot(p.xy - frankA, fBA) / dot(fBA, fBA), 0.0, 1.0);
                    vec2 segF = frankA + tF * fBA;
                    float distFrank = length(p.xy - segF);
                    if (distFrank < 0.016 && p.z > 0.035) {
                      float incisionSlit = smoothstep(0.0018, 0.0003, distFrank);
                      float scarRidge = smoothstep(0.0075, 0.0016, distFrank);
                      vec3 incisionCol = mix(vec3(0.68, 0.22, 0.20), vec3(0.08, 0.01, 0.01), incisionSlit);
                      gl_FragColor.rgb = mix(gl_FragColor.rgb, incisionCol, scarRidge * 0.92);
                      
                      float fStitchSpacing = mod(tF * 16.0, 1.0) - 0.5;
                      float isStitchLine = smoothstep(0.08, 0.02, abs(fStitchSpacing)) * step(distFrank, 0.0085);
                      if (isStitchLine > 0.15) {
                        vec3 stapleColor = vec3(0.04, 0.05, 0.06);
                        float stapleGlint = step(0.004, distFrank) * 0.25;
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, stapleColor + stapleGlint, isStitchLine * 0.95);
                      }
                      float punctureDist = abs(distFrank - 0.0072);
                      if (abs(fStitchSpacing) < 0.14 && punctureDist < 0.0014) {
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.05, 0.01, 0.01), 0.90);
                      }
                    }
                  }
                }

                // 2. وشوم وندبات الذراعين (Arm Sleeves Tattoos & Scars on Uppr)
                if (uIsUppr > 0.5) {
                  vec3 p = vCutLocalPos;
                  // وشوم أكمام الذراعين الكاملة (Full Arm Sleeves)
                  if (uBodyTattoo > 0.5) {
                    float armAngle = atan(p.z, abs(p.x) - 0.20);
                    float armBands = sin(p.y * 110.0 + armAngle * 6.0) * cos(p.y * 60.0);
                    float tribalInk = sin(p.y * 180.0 + abs(p.x) * 70.0);
                    if ((armBands > 0.22 || tribalInk > 0.55) && abs(p.x) > 0.18) {
                      float armStr = max(smoothstep(0.22, 0.45, armBands), smoothstep(0.55, 0.75, tribalInk));
                      gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, armStr * 0.90, p, 0.0);
                    }
                  }
                  // جروح وندبات دفاعية على الساعدين
                  if (uBodyScar > 0.5) {
                    if (p.y > -0.05 && p.y < 0.12 && abs(p.x) > 0.24) {
                      float armSlash = smoothstep(0.0022, 0.0004, abs(p.y - (0.04 + (abs(p.x) - 0.24) * 0.5)));
                      if (armSlash > 0.1) {
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.55, 0.08, 0.06), armSlash * 0.85);
                      }
                    }
                  }
                }

                // 3. تعرية السروال (شورت بوكسر وأرجل مكشوفة) مع وشوم وندبات الرجول (Pants, Boxer, Leg Tattoos & Scars)
                if (uIsLowr > 0.5) {
                  vec3 p = vCutLocalPos;

                  // توحيد خصر بنطلون الجينز الأيسر بقماش الجينز الأزرق الأصلي وإزالة أي رقعة شاذة
                  if (uStripPants < 0.5 && p.x > 0.065 && p.y > -0.095 && p.z > 0.015) {
                    bool isPeachOrBuckle = (gl_FragColor.r > 0.35 && gl_FragColor.r > gl_FragColor.b * 1.02) || 
                                           (gl_FragColor.r > 0.28 && abs(gl_FragColor.r - gl_FragColor.b) < 0.08 && abs(gl_FragColor.g - gl_FragColor.b) < 0.08);
                    if (isPeachOrBuckle) {
                      vec3 denimWaist = vec3(0.11, 0.14, 0.20);
                      float twillGrain = sin((p.x + p.y) * 800.0) * 0.025;
                      vec3 sceneLight = clamp(gl_FragColor.rgb * 1.6, 0.45, 1.25);
                      gl_FragColor.rgb = (denimWaist + twillGrain) * sceneLight;
                    }
                  }

                  // فصخ السروال: تحويل الجزء العلوي إلى شورت بوكسر رياضي متقن، وأسفل منه أرجل مكشوفة واقعية
                  if (uStripPants > 0.5) {
                    if (p.y > -0.24) {
                      // شورت بوكسر رياضي قطني أنيق ومفصل (Tailored Athletic Compression Boxer Briefs)
                      vec3 boxerCol = vec3(0.12, 0.13, 0.16);
                      // نسيج القماش الرياضي المتداخل
                      float clothWeave = sin(p.x * 750.0) * sin(p.y * 750.0) * 0.035;
                      boxerCol += clothWeave;

                      // حزام الخصر الرياضي المطاطي مع خطوط ضغط فضية أنيقة
                      if (p.y > -0.125) {
                        boxerCol = vec3(0.16, 0.18, 0.22);
                        float ribStripe = sin(p.y * 1100.0) * 0.04;
                        boxerCol += ribStripe;
                        // خطوط رياضية فضية أفقية مزدوجة على الحزام
                        if (abs(p.y - (-0.100)) < 0.0016 || abs(p.y - (-0.120)) < 0.0016) {
                          boxerCol = vec3(0.68, 0.70, 0.75);
                        }
                      }

                      // خط خياطة الحاشية السفلية المزدوجة
                      if (abs(p.y - (-0.230)) < 0.0016 || abs(p.y - (-0.235)) < 0.0016) {
                        boxerCol += vec3(0.08);
                      }

                      // درزات الخياطة الأمامية للبوكسر
                      if (abs(p.x) < 0.003 && p.y > -0.22 && p.y < -0.125 && p.z > 0.07) {
                        boxerCol *= 0.72;
                      }

                      // إبقاء إضاءة المشهد الطبيعية على البوكسر ليكون ثلاثي الأبعاد وواقعياً
                      vec3 sceneLight = clamp(gl_FragColor.rgb * 1.6, 0.35, 1.3);
                      gl_FragColor.rgb = boxerCol * sceneLight;
                    } else {
                      // تجسيم صابونة الركبة البارزة تشريحياً
                      if (p.z > -0.01 && p.y > -0.53 && p.y < -0.43) {
                        float dKnee = length(vec2(abs(p.x) - 0.095, p.y - (-0.48)));
                        if (dKnee < 0.024 && p.z > 0.02) {
                          gl_FragColor.rgb += vec3(0.04 * smoothstep(0.024, 0.008, dKnee));
                        }
                      }
                      // تكملة جلد الزومبي الإشعاعي الأخضر والبرتقالي على الأرجل العارية (صورة 1 - النوع 8)
                      if (uFaceScar > 7.5 && uFaceScar < 8.5) {
                        float lumL = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
                        vec3 legGreen = vec3(0.42, 0.58, 0.28) * (lumL * 1.45 + 0.08);
                        float innerGlow = smoothstep(0.095, 0.045, abs(p.x));
                        vec3 legOrange = vec3(0.78, 0.42, 0.12) * (lumL * 1.35 + 0.10);
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(legGreen, legOrange, innerGlow * 0.65), 0.85);
                      }
                    }
                  }

                  // وشوم وندبات الأرجل (Leg Tattoos & Scars)
                  // وشوم الساق والفخذ
                  if (uBodyTattoo > 0.5) {
                    // خنجر وثعبان عصابات على الساق اليمنى
                    if (p.x < -0.04 && p.x > -0.15 && p.y < -0.42 && p.y > -0.78 && p.z > 0.01) {
                      float legDagger = smoothstep(0.0025, 0.0005, abs(p.x - (-0.095))) * step(p.y, -0.46) * step(-0.74, p.y);
                      float snakeCoil = sin(p.y * 65.0) * 0.018;
                      float legSnake = smoothstep(0.0022, 0.0004, abs(p.x - (-0.095 + snakeCoil))) * step(p.y, -0.44) * step(-0.76, p.y);
                      float legInk = max(legDagger, legSnake);
                      if (legInk > 0.15) {
                        gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, legInk * 0.90, p, 0.0);
                      }
                    }
                    // كتابات لاتينية وأرقام على الساق اليسرى
                    if (p.x > 0.04 && p.x < 0.15 && p.y < -0.44 && p.y > -0.72 && p.z > 0.01) {
                      float legNumerals = smoothstep(0.18, 0.03, abs(mod(p.y * 60.0, 1.0) - 0.5)) * smoothstep(0.016, 0.002, abs(p.x - 0.095));
                      if (legNumerals > 0.15) {
                        gl_FragColor.rgb = applyRealisticTattooInk(gl_FragColor.rgb, legNumerals * 0.88, p, 0.0);
                      }
                    }
                  }

                  // ندبات وجروح المعارك على الركب والساق
                  if (uBodyScar > 0.5) {
                    // جرح قطعي على الركبة اليمنى
                    if (p.x < -0.04 && p.x > -0.15 && p.y > -0.52 && p.y < -0.44 && p.z > 0.02) {
                      float kneeCut = smoothstep(0.0024, 0.0004, abs(p.y - (-0.48 + (p.x - (-0.095)) * 0.3)));
                      if (kneeCut > 0.1) {
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.55, 0.06, 0.05), kneeCut * 0.88);
                      }
                    }
                  }
                }

                // 4. استوديو تفصيل وقص وتطريز الملابس ثلاثي الأبعاد الواقعي (3D Custom Tailored Clothing Studio)
                if (uTailorActive > 0.5) {
                  vec3 p = vCutLocalPos;
                  bool isTailorCloth = false;
                  float finalHemY = 0.0;
                  float armCuffDist = 1.0;
                  float sleeveCoordT = 0.0;

                  // حساب إحداثيات ومحور الذراع المشتركة بدقة هندسية موحدة
                  vec3 armS = vec3(0.24, 0.38, -0.07);
                  vec3 armW = vec3(0.56, -0.10, -0.033);
                  vec3 armVec = armW - armS;
                  float armLen = length(armVec);
                  vec3 armDir = armVec / armLen;
                  vec3 localArmP = vec3(abs(vOrigPos.x), vOrigPos.y, vOrigPos.z);
                  float tArm = dot(localArmP - armS, armDir) / armLen;
                  vec3 bonePtLocal = armS + clamp(tArm, 0.0, 1.0) * armVec;
                  float perpD = length(localArmP - bonePtLocal);

                  // حساب خط الحاشية السفلية الموحد بدقة هندسية 360 درجة للجذع والملابس
                  float baseHemY = mix(0.24, -0.22, clamp((uClothLength - 30.0) / 80.0, 0.0, 1.0));
                  float wx = smoothstep(-0.18, 0.18, p.x);
                  float wz = smoothstep(-0.06, 0.06, p.z);

                  // توحيد الحاشية السفلية 360 درجة بدون أي تمزق أو شق جانبي نهائياً (Seamless Unified Hem)
                  // دمج الخياطة الجانبية (Side Seams) بحيث تتطابق حاشية الأمام والخلف تماماً
                  float sideBlend = smoothstep(0.04, 0.15, abs(p.x));
                  float seamShiftR = (uHemFrontR + uHemBackR) * 0.5 * 0.007;
                  float seamShiftL = (uHemFrontL + uHemBackL) * 0.5 * 0.007;

                  float frontShift = mix(uHemFrontR * 0.007, uHemFrontL * 0.007, wx);
                  float backShift  = mix(uHemBackR * 0.007, uHemBackL * 0.007, wx);
                  float seamShift  = mix(seamShiftR, seamShiftL, wx);

                  float cornerHemShift = mix(
                    mix(backShift, seamShift, sideBlend),
                    mix(frontShift, seamShift, sideBlend),
                    wz
                  );

                  // إزاحة الميلان غير المتناظر
                  float asymShift = mix(uHemRightOffset * 0.007, uHemLeftOffset * 0.007, smoothstep(-0.20, 0.20, p.x));

                  // تصحيح اتجاه السحب: سحب الجزء للأسفل ينزل الحاشية لأسفل، وللأعلى يرفعها لأعلى
                  finalHemY = min(baseHemY - (cornerHemShift + asymShift), 0.23);

                  if (uIsJbib > 0.5) {
                    if (vIsJbibCap > 0.5) discard;
                    if (p.y < 0.26 && p.y < finalHemY) discard;

                    // تقصير الكم القصير للتيشيرت فقط إذا كان أقل من 26 سم على محور عظمة الذراع بدون أي تشويه للكتف
                    float sLenCheck = (vOrigPos.x > 0.0) ? uSleeveLengthL : uSleeveLengthR;
                    if (sLenCheck < 26.0 && abs(vOrigPos.x) > 0.18) {
                      float tCut = mix(0.04, 0.176, clamp((sLenCheck - 5.0) / 21.0, 0.0, 1.0));
                      if (tArm > tCut) discard;
                    } else if (sLenCheck > 29.5 && abs(vOrigPos.x) > 0.21 && vOrigPos.y < 0.285 && tArm > 0.148) {
                      // إزالة الزاوية السفلية المربعة لحافة الكم القصير عند تطويل الكم ليبقى منحنى العضد انسيابياً كقطعة واحدة
                      discard;
                    }

                    isTailorCloth = true;
                  } else if (uIsUppr > 0.5 && uStripShirt < 0.5) {
                    // امتداد الأكمام الطويلة حتى المعصم كقطعة واحدة متصلة دون أي ثقب أو فتحة بالإبط
                    float armSign = sign(vOrigPos.x);
                    float sLenCheck = (armSign > 0.0) ? uSleeveLengthL : uSleeveLengthR;
                    if (sLenCheck > 28.5 && tArm > 0.04) {
                      float sProg = clamp((sLenCheck - 28.5) / 51.5, 0.0, 1.0);
                      float tCuff = mix(0.176, 0.76, sProg);
                      if (tArm <= tCuff) {
                        isTailorCloth = true;
                        armCuffDist = (tCuff - tArm) * armLen;
                        sleeveCoordT = tArm;
                      }
                    }
                    if (!isTailorCloth) {
                      // إخفاء جذع وأعلى كتف والجزء المغطى داخل الكم القصير من uppr_bare لمنع أي بروز جلدي تحت البلوزة
                      float innerSleeveCut = mix(0.03, 0.172, clamp((sLenCheck - 8.0) / 18.0, 0.0, 1.0));
                      if ((p.y >= finalHemY && abs(vOrigPos.x) < 0.18) || (vOrigPos.y > 0.40 && vOrigPos.y < 0.495 && abs(vOrigPos.x) > 0.095 && tArm <= 0.055) || (abs(vOrigPos.x) >= 0.18 && tArm < innerSleeveCut)) {
                        discard;
                      }
                    }
                  }

                  if (isTailorCloth) {
                    // ج. خامات وأقمشة واقعية عالية الدقة بدون أي تشويه أو خطوط حمار وحشي (Photorealistic PBR Fabrics)
                    // 0: Cotton, 1: Denim, 2: Silk, 3: Leather, 4: Knit
                    vec3 fabricBase = uClothColor;

                    // توحيد إحداثيات نسيج القماش بين الجذع والأكمام بالمتر بدقة هندسية مطلقة
                    float coordU = p.x;
                    float coordV = p.y;
                    if (uIsUppr > 0.5 || (uIsJbib > 0.5 && abs(p.x) > 0.18 && p.y < 0.42)) {
                      vec3 armS = vec3(0.24, 0.38, -0.07);
                      vec3 armW = vec3(0.56, -0.10, -0.033);
                      vec3 armVec = armW - armS;
                      float armLen = length(armVec);
                      vec3 armDir = armVec / armLen;
                      vec3 localArmP = vec3(abs(p.x), p.y, p.z);
                      float tArmCoord = (uIsUppr > 0.5) ? sleeveCoordT : (dot(localArmP - armS, armDir) / armLen);
                      vec3 bonePtRadial = armS + clamp(tArmCoord, 0.0, 1.0) * armVec;
                      bonePtRadial.x *= sign(p.x);
                      vec3 radVec = p - bonePtRadial;
                      float radAng = atan(radVec.z, radVec.y);
                      coordU = radAng * 0.065;
                      coordV = -tArmCoord * armLen;
                    }

                    if (uFabricType < 0.5) {
                      // 1. القطن الطبيعي (Pure Cotton): نسيج قطني ناعم يمتص الضوء بنعومة
                      float cGrain = (sin(coordU * 750.0) * sin(coordV * 750.0)) * 0.016;
                      fabricBase += cGrain * fabricBase;
                    } else if (uFabricType < 1.5) {
                      // 2. الجينز (Denim): نسيج مائل 45 درجة مع غسيل كلاسيكي خفيف
                      float twill = sin((coordU + coordV) * 850.0) * 0.024;
                      float wash = sin(coordV * 60.0 + sin(coordU * 35.0)) * 0.018;
                      fabricBase = mix(fabricBase, fabricBase * 0.90 + vec3(0.015, 0.025, 0.04), 0.22) + twill + wash;
                    } else if (uFabricType < 2.5) {
                      // 3. الحرير (Silk): بريق وانعكاسات حريرية لامعة انسيابية
                      float sRim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.4) * 0.22;
                      float sWave = sin(coordV * 50.0 + coordU * 30.0) * 0.035;
                      fabricBase = fabricBase * 0.94 + vec3(sRim) + sWave;
                    } else if (uFabricType < 3.5) {
                      // 4. الجلد (Leather): مسامات وحبيبات جلدية راقية مع لمعة ناعمة
                      float lCell = sin(coordU * 650.0) * cos(coordV * 620.0) * 0.022;
                      float lSpec = pow(max(0.0, dot(vNormal, vec3(0.15, 0.45, 0.85))), 8.0) * 0.12;
                      fabricBase = fabricBase * (0.96 + lCell) + vec3(lSpec);
                    } else {
                      // 5. التريكو / الصوف (Knit): نسيج محبوك دافئ بخطوط ميكرو ناعمة موحدة 100% بين الجذع والأكمام
                      float kRib = sin(coordV * 420.0) * 0.022;
                      float kWeave = (sin(coordV * 360.0) * cos(coordU * 360.0)) * 0.012;
                      fabricBase = fabricBase * (1.0 + kRib + kWeave);
                    }

                    // د. خط خياطة وثنية الحاشية السفلية الواقعية أو المعصم
                    if (uIsJbib > 0.5) {
                      float distToHem = p.y - finalHemY;
                      if (distToHem < 0.008) {
                        float hemShadow = smoothstep(0.008, 0.0, distToHem) * 0.16;
                        fabricBase *= (1.0 - hemShadow);
                        if (distToHem > 0.0035 && distToHem < 0.0055) {
                          fabricBase *= 0.88;
                        }
                      }
                    } else if (uIsUppr > 0.5) {
                      // خط خياطة وثنية كُم المعصم الواقعية 360 درجة
                      if (armCuffDist < 0.012 && armCuffDist >= 0.0) {
                        float cuffShadow = smoothstep(0.012, 0.0, armCuffDist) * 0.22;
                        fabricBase *= (1.0 - cuffShadow);
                        if (armCuffDist > 0.0035 && armCuffDist < 0.0070) {
                          fabricBase *= 0.82;
                        }
                      }
                    }

                    // هـ. دمج الإضاءة ثلاثية الأبعاد وظلال الانثناءات الطبيعية موحدة 100% للجذع والأكمام
                    vec3 sceneLight = clamp(gl_FragColor.rgb * 1.52, 0.42, 1.35);
                    gl_FragColor.rgb = fabricBase * sceneLight;
                  }
                }
                `
              );

              mat.userData.shader = shader;
            };

            mat.needsUpdate = true;
          });
        }
      });
  }, [modelScene, shadingMode]);

  // إدارة وتحميل التكسشرات بسرعة فائقة عبر الكاش العالمي دون إعادة تجميع الشيدر (Zero GPU Recompiles)
  useEffect(() => {
    if (!modelScene) return;

    const textureLoader = new THREE.TextureLoader();

    // 1. تكسشر البوكسر والرجول الافتراضي من الكاش المباشر
    getOrCreateTexture('/textures/freemode_base/lowr_diff_014_a_whi.png', textureLoader).then((tex) => {
      if (!tex) return;
      loadedTextureObjects.current['lowr_bare'] = tex;
      const mesh = nodesRef.current?.lowr_bare;
      if (mesh && mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(m => { m.map = tex; m.needsUpdate = true; });
      }
    });

    // 2. تطبيق تكسشرات الفتحات مباشرة
    Object.entries(textures).forEach(([slotName, texData]) => {
      if (texData && texData.url) {
        getOrCreateTexture(texData.url, textureLoader).then((tex) => {
          if (!tex) return;
          loadedTextureObjects.current[slotName] = tex;
          if (slotName === 'uppr') {
            sharedUniforms.current.uUpprTex.value = tex;
          } else if (slotName === 'lowr') {
            sharedUniforms.current.uLowrTex.value = tex;
          }
          const targetMesh = nodesRef.current?.[slotName];
          if (targetMesh && targetMesh.material) {
            const mats = Array.isArray(targetMesh.material) ? targetMesh.material : [targetMesh.material];
            mats.forEach(m => { m.map = tex; m.needsUpdate = true; });
          }
          if (slotName === 'uppr' && nodesRef.current?.uppr_bare?.material) {
            const bareMats = Array.isArray(nodesRef.current.uppr_bare.material) ? nodesRef.current.uppr_bare.material : [nodesRef.current.uppr_bare.material];
            bareMats.forEach(m => { m.map = tex; m.needsUpdate = true; });
          }
        });
      }
    });
  }, [modelScene, textures]);

  // تحديث مباشر وفوري للون البشرة ولون الملابس بدون إعادة تهيئة الماتيريال بالكامل
  useEffect(() => {
    if (!modelScene || shadingMode !== 'rendered') return;
    const skinCol = new THREE.Color(getEffectiveSkinColor(morphs.skinColor));
    const clothCol = new THREE.Color(morphs.clothingColor || '#ffffff');

    modelScene.traverse((node) => {
      if (node.isMesh && node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((mat) => {
          const meshName = (node.name || '').toLowerCase();
          const matName = (mat.name || '').toLowerCase();
          const isHead = meshName.includes('head') || matName.includes('head') || matName.includes('face') || meshName.includes('skel_root');
          const isUppr = meshName.includes('uppr') || matName.includes('uppr') || matName.includes('body') || matName.includes('hand') || matName.includes('arm') || meshName.includes('57aff7fb');
          const isJbib = meshName.includes('jbib') || matName.includes('jbib') || matName.includes('shirt') || matName.includes('jacket') || meshName.includes('0e4f123c');

          if (isHead || isUppr) {
            mat.color.copy(skinCol);
          } else if (isJbib) {
            if (morphs.stripShirt) {
              mat.color.copy(skinCol);
            } else {
              mat.color.copy(clothCol);
            }
          }
        });
      }
    });
  }, [modelScene, morphs.skinColor, morphs.clothingColor, morphs.stripShirt, shadingMode]);

  // تحديث مباشر لكافة قيم اليونيفورمات عند تغير الـ Props
  useEffect(() => {
    const su = sharedUniforms.current;
    su.uShoulderWidth.value = Number(morphs.shoulders ?? 1.0);
    su.uArmMuscles.value = Number(morphs.armMuscles ?? 1.0);
    su.uBellyFat.value = Number(morphs.bellyFat ?? 1.0);
    su.uChestBulk.value = Number(morphs.chest ?? 1.0);
    su.uThighBulk.value = Number(morphs.thighs ?? 1.0);
    su.uHeadScale.value = Number(morphs.head ?? 1.0);
    su.uHideRightArm.value = morphs.hideRightArm ? 1.0 : 0.0;
    su.uHideLeftArm.value = morphs.hideLeftArm ? 1.0 : 0.0;
    su.uHideRightLeg.value = morphs.hideRightLeg ? 1.0 : 0.0;
    su.uHideLeftLeg.value = morphs.hideLeftLeg ? 1.0 : 0.0;
    su.uFaceDistortion.value = Number(morphs.faceDistortion ?? 0.0);
    su.uCrookedNose.value = Number(morphs.crookedNose ?? 0.0);
    su.uJawTwist.value = Number(morphs.jawTwist ?? 0.0);
    su.uHunchback.value = Number(morphs.hunchback ?? 0.0);
    su.uBodyAsymmetry.value = Number(morphs.bodyAsymmetry ?? 0.0);
    su.uGrotesqueLumps.value = Number(morphs.grotesqueLumps ?? 0.0);
    su.uEyeColorL.value.set(morphs.eyeColorL || '#4a3728');
    su.uEyeColorR.value.set(morphs.eyeColorR || '#4a3728');
    su.uBlindEyeL.value = morphs.blindEyeL ? 1.0 : 0.0;
    su.uBlindEyeR.value = morphs.blindEyeR ? 1.0 : 0.0;
    su.uGougedEyeL.value = morphs.gougedEyeL ? 1.0 : 0.0;
    su.uGougedEyeR.value = morphs.gougedEyeR ? 1.0 : 0.0;
    su.uFaceTattoo.value = Number(morphs.faceTattoo || 0);
    su.uFaceScar.value = Number(morphs.faceScar || 0);
    su.uFaceSlashType.value = Number(morphs.faceSlashType || 0);
    su.uFaceSlashDepth.value = Number(morphs.faceSlashDepth ?? 0.0);
    su.uFaceSlashFresh.value = Number(morphs.faceSlashFresh ?? 1.0);
    su.uFaceSlashStitches.value = morphs.faceSlashStitches ? 1.0 : 0.0;
    su.uPedSkinColor.value.set(getEffectiveSkinColor(morphs.skinColor));
    su.uStripShirt.value = morphs.stripShirt ? 1.0 : 0.0;
    su.uStripPants.value = morphs.stripPants ? 1.0 : 0.0;
    su.uBodyTattoo.value = morphs.bodyTattoo ? 1.0 : 0.0;
    su.uBodyScar.value = morphs.bodyScar ? 1.0 : 0.0;
  }, [
    morphs.shoulders, 
    morphs.armMuscles, 
    morphs.bellyFat, 
    morphs.chest, 
    morphs.thighs,
    morphs.head,
    morphs.skinColor,
    morphs.hideRightArm, 
    morphs.hideLeftArm, 
    morphs.hideRightLeg, 
    morphs.hideLeftLeg,
    morphs.faceDistortion,
    morphs.crookedNose,
    morphs.jawTwist,
    morphs.hunchback,
    morphs.bodyAsymmetry,
    morphs.grotesqueLumps,
    morphs.eyeColorL,
    morphs.eyeColorR,
    morphs.blindEyeL,
    morphs.blindEyeR,
    morphs.gougedEyeL,
    morphs.gougedEyeR,
    morphs.faceTattoo,
    morphs.faceScar,
    morphs.faceSlashType,
    morphs.faceSlashDepth,
    morphs.faceSlashFresh,
    morphs.faceSlashStitches,
    morphs.stripShirt,
    morphs.stripPants,
    morphs.bodyTattoo,
    morphs.bodyScar
  ]);

  // إخفاء وإظهار الأجزاء والتبديل الحقيقي بين ملابس فايف إم والمجسم العاري الأصلي
  useEffect(() => {
    if (!modelScene) return;

    modelScene.traverse((node) => {
      const name = (node.name || '').toLowerCase();
      const isUpprBare = name.includes('uppr_bare');
      const isLowrBare = name.includes('lowr_bare');

      if (clothingPattern) {
        // في وضع استوديو تفصيل وقص الملابس (Clothing Studio Mode)
        const showPed = clothingPattern.showPed !== false;
        if (name.includes('head') || name.includes('skel_root')) {
          node.visible = showPed && visibility.head !== false;
        } else if (isUpprBare) {
          // إظهار مجسم الجسم والجسد العاري الحقيقي تحت الملابس (الجذع، البطن، الصدر، الظهر، الذراعين)
          node.visible = showPed && visibility.uppr !== false;
        } else if (isLowrBare) {
          // إخفاء مجسم البوكسر العاري لأن الشخصية ترتدي بنطلون الجينز الأصلي
          node.visible = false;
        } else if (name.includes('uppr') || name.includes('57aff7fb')) {
          // إخفاء uppr الناقص لأن uppr_bare يحتوي على الجذع والذراعين والأيدي كاملة
          node.visible = false;
        } else if (name.includes('jbib') || name.includes('0e4f123c')) {
          // التيشيرت المفصل يظهر دائماً
          node.visible = true;
        } else if (name.includes('lowr') || name.includes('3fbbef0a')) {
          // بنطلون الجينز الأصلي الأنيق
          node.visible = showPed && visibility.lowr !== false;
        } else if (name.includes('feet') || name.includes('38aed724')) {
          node.visible = showPed && visibility.feet !== false;
        }
      } else {
        if (name.includes('head') || name.includes('skel_root')) {
          node.visible = visibility.head !== false;
        } else if (isUpprBare) {
          // المجسم العاري الحقيقي للصدر والذراعين: يظهر فقط عند فصخ التيشيرت
          node.visible = (visibility.uppr !== false) && Boolean(morphs.stripShirt);
        } else if (name.includes('uppr') || name.includes('57aff7fb')) {
          // أذرع التيشيرت: تظهر فقط عند لبس التيشيرت
          node.visible = (visibility.uppr !== false) && !morphs.stripShirt;
        } else if (name.includes('jbib') || name.includes('0e4f123c')) {
          // بلوزة التيشيرت: تظهر فقط عند لبس التيشيرت
          node.visible = (visibility.jbib !== false) && !morphs.stripShirt;
        } else if (isLowrBare) {
          // مجسم البوكسر والرجول العضلية الحقيقية: يظهر فقط عند فصخ السروال
          node.visible = (visibility.lowr !== false) && Boolean(morphs.stripPants);
        } else if (name.includes('lowr') || name.includes('3fbbef0a')) {
          // بنطلون الجينز: يظهر فقط عند لبس البنطلون
          node.visible = (visibility.lowr !== false) && !morphs.stripPants;
        } else if (name.includes('feet') || name.includes('38aed724')) {
          node.visible = visibility.feet !== false;
        }
      }
    });
  }, [modelScene, visibility, morphs.stripShirt, morphs.stripPants, clothingPattern]);

  // تحديث فوري ليونيفورمات استوديو تفصيل وقص وتطريز الملابس عند تعديل الباترون
  useEffect(() => {
    const su = sharedUniforms.current;
    if (clothingPattern) {
      su.uTailorActive.value = 1.0;
      su.uClothLength.value = Number(clothingPattern.length ?? 78);
      su.uClothWidth.value = Number(clothingPattern.width ?? 56);
      su.uSleeveLength.value = Number(clothingPattern.sleeveLength ?? 28);
      su.uSleeveLengthL.value = Number(clothingPattern.sleeveLengthL ?? clothingPattern.sleeveLength ?? 28);
      su.uSleeveLengthR.value = Number(clothingPattern.sleeveLengthR ?? clothingPattern.sleeveLength ?? 28);
      su.uSleeveWidth.value = Number(clothingPattern.sleeveWidth ?? 40);
      su.uNeckline.value = Number(clothingPattern.neckline ?? 28);
      su.uHemLeftOffset.value = Number(clothingPattern.hemLeftOffset ?? 0);
      su.uHemRightOffset.value = Number(clothingPattern.hemRightOffset ?? 0);
      su.uHemFrontL.value = Number(clothingPattern.hemFrontL ?? 0);
      su.uHemFrontR.value = Number(clothingPattern.hemFrontR ?? 0);
      su.uHemBackL.value = Number(clothingPattern.hemBackL ?? 0);
      su.uHemBackR.value = Number(clothingPattern.hemBackR ?? 0);
      su.uShoulderL.value = Number(clothingPattern.shoulderL ?? 0);
      su.uShoulderR.value = Number(clothingPattern.shoulderR ?? 0);
      su.uBackShoulderL.value = Number(clothingPattern.backShoulderL ?? 0);
      su.uBackShoulderR.value = Number(clothingPattern.backShoulderR ?? 0);
      su.uWaistL.value = Number(clothingPattern.waistL ?? 0);
      su.uWaistR.value = Number(clothingPattern.waistR ?? 0);
      su.uClothColor.value.set(clothingPattern.color || '#ecc94b');

      const fabricMap = { cotton: 0.0, denim: 1.0, silk: 2.0, leather: 3.0, knit: 4.0 };
      su.uFabricType.value = fabricMap[clothingPattern.fabric] ?? 4.0;
      su.uShowSeams.value = clothingPattern.showSeams ? 1.0 : 0.0;
      const detailMap = { fast: 0.0, normal: 1.0, fine: 2.0 };
      su.uDetailLevel.value = detailMap[clothingPattern.detail] ?? 1.0;
    } else {
      su.uTailorActive.value = 0.0;
    }
  }, [clothingPattern]);

  // محاكي الأنيميشن والمشيات الحركية والانسدال بأداء 60fps خفيف جداً
  useFrame((state, delta) => {
    if (!modelRef.current || !modelScene) return;

    const su = sharedUniforms.current;

    // موجة الانسدال الفيزيائي المتحركة
    if (clothingPattern?.isDraping) {
      drapeTimerRef.current = 1.2;
    }
    if (drapeTimerRef.current > 0) {
      drapeTimerRef.current = Math.max(0, drapeTimerRef.current - delta);
      su.uDrapeWave.value = drapeTimerRef.current / 1.2;
      su.uDrapeTime.value = state.clock.getElapsedTime();
    } else if (su.uDrapeWave.value > 0.0) {
      su.uDrapeWave.value = 0.0;
    }

    // ضبط الطول مع الحفاظ على الأقدام مثبتة على الأرض تماماً (Ground Pinning)
    const heightVal = morphsRef.current?.height || 1.0;
    if (modelScene.scale.y !== heightVal) {
      modelScene.scale.set(1.0, heightVal, 1.0);
    }
    const groundBaseY = 1.002 * (heightVal - 1.0);

    const parts = nodesRef.current;
    const t = state.clock.getElapsedTime();
    const speed = animSpeed || 1.0;

    let animOffsetY = 0;

    if (isPlaying && walkStyle !== 'tpose') {
      su.uAnimActive.value = 1.0;

      if (walkStyle === 'casual') {
        // مشية فايف إم الطبيعية الانسيابية (Smooth Authentic FiveM Natural Walk)
        const cycle = t * 3.6 * speed;
        su.uLegSwingL.value = Math.sin(cycle) * 0.40;
        su.uKneeBendL.value = Math.max(0.0, -Math.sin(cycle)) * 0.65;
        su.uFootPitchL.value = -Math.sin(cycle + 0.3) * 0.18;

        su.uLegSwingR.value = -Math.sin(cycle) * 0.40;
        su.uKneeBendR.value = Math.max(0.0, Math.sin(cycle)) * 0.65;
        su.uFootPitchR.value = Math.sin(cycle + 0.3) * 0.18;

        su.uPelvisBob.value = -Math.abs(Math.sin(cycle)) * 0.022;
        su.uPelvisRoll.value = Math.sin(cycle) * 0.018;
        su.uSpineTwist.value = -Math.sin(cycle) * 0.035;

        su.uArmSwingL.value = -Math.sin(cycle) * 0.35;
        su.uElbowBendL.value = 0.15 + Math.max(0.0, -Math.sin(cycle)) * 0.22;
        su.uArmSwingR.value = Math.sin(cycle) * 0.35;
        su.uElbowBendR.value = 0.15 + Math.max(0.0, Math.sin(cycle)) * 0.22;

        animOffsetY = Math.sin(cycle * 2.0) * 0.010;
        modelRef.current.rotation.set(0.01, Math.sin(cycle) * 0.03, Math.sin(cycle) * 0.01);
      } else if (walkStyle === 'gangster') {
        // مشية عصابات فايف إم وهيبة الشارع (Gangster Swagger)
        const cycle = t * 2.7 * speed;
        su.uLegSwingL.value = Math.sin(cycle) * 0.36;
        su.uKneeBendL.value = Math.max(0.0, -Math.sin(cycle)) * 0.50;
        su.uFootPitchL.value = -Math.sin(cycle) * 0.15;

        su.uLegSwingR.value = -Math.sin(cycle) * 0.36;
        su.uKneeBendR.value = Math.max(0.0, Math.sin(cycle)) * 0.50;
        su.uFootPitchR.value = Math.sin(cycle) * 0.15;

        su.uPelvisBob.value = -Math.abs(Math.sin(cycle)) * 0.035;
        su.uPelvisRoll.value = Math.sin(cycle) * 0.045;
        su.uSpineTwist.value = -Math.sin(cycle) * 0.06;

        su.uArmSwingL.value = -Math.sin(cycle) * 0.45;
        su.uElbowBendL.value = 0.28 + Math.sin(cycle) * 0.12;
        su.uArmSwingR.value = Math.sin(cycle) * 0.45;
        su.uElbowBendR.value = 0.28 - Math.sin(cycle) * 0.12;

        animOffsetY = (Math.abs(Math.sin(cycle)) - 0.5) * 0.030;
        modelRef.current.rotation.set(-0.02, Math.sin(cycle) * 0.05, Math.sin(cycle) * 0.045);
      } else if (walkStyle === 'jog') {
        // جري وهرولة رياضية سريعة (Fast Athletic Jog / Sprint)
        const cycle = t * 5.8 * speed;
        su.uLegSwingL.value = Math.sin(cycle) * 0.68;
        su.uKneeBendL.value = Math.max(0.0, -Math.sin(cycle)) * 1.05;
        su.uFootPitchL.value = -Math.sin(cycle + 0.4) * 0.30;

        su.uLegSwingR.value = -Math.sin(cycle) * 0.68;
        su.uKneeBendR.value = Math.max(0.0, Math.sin(cycle)) * 1.05;
        su.uFootPitchR.value = Math.sin(cycle + 0.4) * 0.30;

        su.uPelvisBob.value = -Math.abs(Math.sin(cycle)) * 0.040;
        su.uPelvisRoll.value = Math.sin(cycle) * 0.025;
        su.uSpineTwist.value = -Math.sin(cycle) * 0.08;

        su.uArmSwingL.value = -Math.sin(cycle) * 0.70;
        su.uElbowBendL.value = 0.85;
        su.uArmSwingR.value = Math.sin(cycle) * 0.70;
        su.uElbowBendR.value = 0.85;

        animOffsetY = Math.abs(Math.sin(cycle)) * 0.040;
        modelRef.current.rotation.set(0.08, Math.sin(cycle) * 0.07, Math.sin(cycle) * 0.02);
      } else if (walkStyle === 'dance') {
        // رقص واحتفال ودبكة فايف إم (Party Dance & Dabke)
        const cycle = t * 4.2 * speed;
        su.uLegSwingL.value = Math.sin(cycle * 0.5) * 0.22;
        su.uKneeBendL.value = Math.abs(Math.sin(cycle)) * 0.45;
        su.uFootPitchL.value = 0.08;

        su.uLegSwingR.value = -Math.sin(cycle * 0.5) * 0.22;
        su.uKneeBendR.value = Math.abs(Math.cos(cycle)) * 0.45;
        su.uFootPitchR.value = 0.08;

        su.uPelvisBob.value = -Math.abs(Math.sin(cycle * 2.0)) * 0.038;
        su.uPelvisRoll.value = Math.sin(cycle) * 0.055;
        su.uSpineTwist.value = Math.sin(cycle) * 0.10;

        su.uArmSwingL.value = 0.40 + Math.sin(cycle) * 0.35;
        su.uElbowBendL.value = 0.70 + Math.cos(cycle) * 0.30;
        su.uArmSwingR.value = 0.40 - Math.sin(cycle) * 0.35;
        su.uElbowBendR.value = 0.70 - Math.cos(cycle) * 0.30;

        animOffsetY = Math.sin(cycle * 2.0) * 0.020;
        modelRef.current.rotation.set(0.03, Math.sin(cycle) * 0.10, Math.sin(cycle * 0.5) * 0.035);
      } else if (walkStyle === 'combat') {
        // وقفة قتالية وملاكمة وتأهب (Boxing / Combat Punches)
        const cycle = t * 3.4 * speed;
        su.uLegSwingL.value = 0.20;
        su.uKneeBendL.value = 0.32;
        su.uFootPitchL.value = 0.0;

        su.uLegSwingR.value = -0.20;
        su.uKneeBendR.value = 0.26;
        su.uFootPitchR.value = 0.05;

        su.uPelvisBob.value = Math.sin(cycle * 2.0) * 0.015;
        su.uPelvisRoll.value = Math.sin(cycle) * 0.02;
        su.uSpineTwist.value = Math.sin(cycle) * 0.14;

        su.uArmSwingL.value = 0.60 + Math.max(0.0, Math.sin(cycle)) * 0.55;
        su.uElbowBendL.value = 0.75 - Math.max(0.0, Math.sin(cycle)) * 0.50;
        su.uArmSwingR.value = 0.60 + Math.max(0.0, -Math.sin(cycle)) * 0.55;
        su.uElbowBendR.value = 0.75 - Math.max(0.0, -Math.sin(cycle)) * 0.50;

        animOffsetY = -0.030 + Math.sin(cycle * 2) * 0.008;
        modelRef.current.rotation.set(0.06, 0.28 + Math.sin(cycle) * 0.07, 0.02);
      } else if (walkStyle === 'drunk') {
        // ترنح ومشية سكران فايف إم (FiveM Drunk Stumble)
        const cycle = t * 2.2 * speed;
        su.uLegSwingL.value = Math.sin(cycle) * 0.40 + Math.sin(cycle * 0.3) * 0.12;
        su.uKneeBendL.value = Math.abs(Math.sin(cycle)) * 0.45 + 0.10;
        su.uFootPitchL.value = Math.sin(cycle) * 0.20;

        su.uLegSwingR.value = -Math.sin(cycle + 0.4) * 0.40;
        su.uKneeBendR.value = Math.abs(Math.cos(cycle)) * 0.45 + 0.10;
        su.uFootPitchR.value = -Math.sin(cycle) * 0.20;

        su.uPelvisBob.value = -Math.abs(Math.sin(cycle)) * 0.040;
        su.uPelvisRoll.value = Math.sin(cycle * 0.8) * 0.08;
        su.uSpineTwist.value = Math.sin(cycle * 0.7) * 0.12;

        su.uArmSwingL.value = -Math.sin(cycle * 0.9) * 0.50 + 0.15;
        su.uElbowBendL.value = 0.40 + Math.sin(cycle) * 0.25;
        su.uArmSwingR.value = Math.sin(cycle * 0.8) * 0.50 - 0.15;
        su.uElbowBendR.value = 0.40 - Math.sin(cycle) * 0.25;

        animOffsetY = (Math.abs(Math.sin(cycle)) - 0.5) * 0.035;
        modelRef.current.rotation.set(-0.04, Math.sin(cycle * 0.6) * 0.10, Math.sin(cycle * 0.8) * 0.09);
      } else if (walkStyle === 'squat') {
        // تمرين سكوات رياضي كامل (Fitness Squats)
        const cycle = t * 2.2 * speed;
        const squatAmt = Math.sin(cycle) * 0.5 + 0.5;
        su.uLegSwingL.value = squatAmt * 0.55;
        su.uKneeBendL.value = squatAmt * 0.95;
        su.uFootPitchL.value = squatAmt * 0.15;

        su.uLegSwingR.value = squatAmt * 0.55;
        su.uKneeBendR.value = squatAmt * 0.95;
        su.uFootPitchR.value = squatAmt * 0.15;

        su.uPelvisBob.value = -squatAmt * 0.18;
        su.uPelvisRoll.value = 0.0;
        su.uSpineTwist.value = 0.0;

        su.uArmSwingL.value = squatAmt * 0.75;
        su.uElbowBendL.value = 0.15;
        su.uArmSwingR.value = squatAmt * 0.75;
        su.uElbowBendR.value = 0.15;

        animOffsetY = 0;
        modelRef.current.rotation.set(squatAmt * 0.12, 0, 0);
      } else if (walkStyle === 'salute') {
        // تحية عسكرية رسمية (Military Salute)
        su.uLegSwingL.value = 0.0;
        su.uKneeBendL.value = 0.0;
        su.uFootPitchL.value = 0.0;
        su.uLegSwingR.value = 0.0;
        su.uKneeBendR.value = 0.0;
        su.uFootPitchR.value = 0.0;
        su.uPelvisBob.value = 0.0;
        su.uPelvisRoll.value = 0.0;
        su.uSpineTwist.value = 0.0;

        su.uArmSwingL.value = -0.05;
        su.uElbowBendL.value = 0.05;
        su.uArmSwingR.value = 0.90;
        su.uElbowBendR.value = 1.30;

        animOffsetY = 0;
        modelRef.current.rotation.set(0, 0, 0);
      } else if (walkStyle === 'cheer') {
        // تصفيق واحتفال حماسي (Cheer & Clapping)
        const cycle = t * 4.8 * speed;
        su.uLegSwingL.value = Math.sin(cycle) * 0.10;
        su.uKneeBendL.value = Math.abs(Math.sin(cycle)) * 0.20;
        su.uFootPitchL.value = 0.05;

        su.uLegSwingR.value = -Math.sin(cycle) * 0.10;
        su.uKneeBendR.value = Math.abs(Math.cos(cycle)) * 0.20;
        su.uFootPitchR.value = 0.05;

        su.uPelvisBob.value = Math.abs(Math.sin(cycle)) * 0.025;
        su.uPelvisRoll.value = Math.sin(cycle * 0.5) * 0.02;
        su.uSpineTwist.value = 0.0;

        su.uArmSwingL.value = 0.58;
        su.uElbowBendL.value = 0.85 + Math.sin(cycle * 2.0) * 0.35;
        su.uArmSwingR.value = 0.58;
        su.uElbowBendR.value = 0.85 + Math.sin(cycle * 2.0) * 0.35;

        animOffsetY = Math.abs(Math.sin(cycle)) * 0.02;
        modelRef.current.rotation.set(0, 0, 0);
      } else if (walkStyle === 'idle') {
        // تنفس طبيعي ووقفة حية (Natural Breathing Idle)
        const cycle = t * 1.8 * speed;
        su.uLegSwingL.value = 0.04;
        su.uKneeBendL.value = 0.05;
        su.uFootPitchL.value = 0.0;
        su.uLegSwingR.value = -0.04;
        su.uKneeBendR.value = 0.03;
        su.uFootPitchR.value = 0.0;
        su.uPelvisBob.value = Math.sin(cycle) * 0.007;
        su.uPelvisRoll.value = Math.sin(cycle * 0.5) * 0.01;
        su.uSpineTwist.value = 0.0;
        su.uArmSwingL.value = Math.sin(cycle) * 0.04;
        su.uElbowBendL.value = 0.10 + Math.sin(cycle) * 0.03;
        su.uArmSwingR.value = -Math.sin(cycle) * 0.04;
        su.uElbowBendR.value = 0.10 - Math.sin(cycle) * 0.03;

        animOffsetY = Math.sin(cycle) * 0.004;
        modelRef.current.rotation.set(0, Math.sin(cycle * 0.3) * 0.015, Math.sin(cycle * 0.5) * 0.01);
      } else if (walkStyle === 'zombie') {
        // مشية زومبي مرعبة وأذرع ممدودة (Zombie Walk)
        const cycle = t * 2.0 * speed;
        su.uArmSwingL.value = 1.30;
        su.uElbowBendL.value = 0.08;
        su.uArmSwingR.value = 1.30;
        su.uElbowBendR.value = 0.08;
        su.uLegSwingL.value = Math.sin(cycle) * 0.32;
        su.uKneeBendL.value = Math.max(0.0, -Math.sin(cycle)) * 0.50;
        su.uFootPitchL.value = 0.0;
        su.uLegSwingR.value = -Math.sin(cycle) * 0.18;
        su.uKneeBendR.value = 0.15;
        su.uFootPitchR.value = 0.0;
        su.uPelvisBob.value = -Math.abs(Math.sin(cycle)) * 0.030;
        su.uPelvisRoll.value = Math.sin(cycle) * 0.06;
        su.uSpineTwist.value = Math.sin(cycle) * 0.08;

        animOffsetY = Math.sin(cycle) * 0.015;
        modelRef.current.rotation.set(0.08, Math.sin(cycle * 0.5) * 0.08, Math.sin(cycle) * 0.05);
      } else if (walkStyle === 'wave') {
        // تلويح وترحيب باليد اليمنى (Wave Hello)
        const cycle = t * 4.5 * speed;
        su.uLegSwingL.value = 0.03;
        su.uKneeBendL.value = 0.04;
        su.uFootPitchL.value = 0.0;
        su.uLegSwingR.value = -0.03;
        su.uKneeBendR.value = 0.04;
        su.uFootPitchR.value = 0.0;
        su.uPelvisBob.value = Math.sin(t * 1.5) * 0.006;
        su.uPelvisRoll.value = 0.0;
        su.uSpineTwist.value = 0.0;
        su.uArmSwingL.value = 0.04;
        su.uElbowBendL.value = 0.12;
        su.uArmSwingR.value = 1.60 + Math.sin(cycle) * 0.10;
        su.uElbowBendR.value = 1.25 + Math.sin(cycle) * 0.35;

        animOffsetY = 0;
        modelRef.current.rotation.set(0, 0, 0);
      } else if (walkStyle === 'guard') {
        // وقفة حارس أمن وتشبيك اليدين بثقة (Security Guard / Bouncer)
        const cycle = t * 1.6 * speed;
        su.uLegSwingL.value = 0.07;
        su.uKneeBendL.value = 0.06;
        su.uFootPitchL.value = 0.0;
        su.uLegSwingR.value = -0.07;
        su.uKneeBendR.value = 0.06;
        su.uFootPitchR.value = 0.0;
        su.uPelvisBob.value = Math.sin(cycle) * 0.006;
        su.uArmSwingL.value = 0.42;
        su.uElbowBendL.value = 1.35;
        su.uArmSwingR.value = 0.42;
        su.uElbowBendR.value = 1.35;
        su.uPelvisRoll.value = 0.0;
        su.uSpineTwist.value = 0.0;

        animOffsetY = 0;
        modelRef.current.rotation.set(-0.01, 0, 0);
      } else if (walkStyle === 'sad') {
        // مشية حزن وإحباط وثقل خطوات (Depressed / Sad Walk)
        const cycle = t * 2.0 * speed;
        su.uLegSwingL.value = Math.sin(cycle) * 0.22;
        su.uKneeBendL.value = Math.max(0.0, -Math.sin(cycle)) * 0.35;
        su.uFootPitchL.value = 0.0;
        su.uLegSwingR.value = -Math.sin(cycle) * 0.22;
        su.uKneeBendR.value = Math.max(0.0, Math.sin(cycle)) * 0.35;
        su.uFootPitchR.value = 0.0;
        su.uPelvisBob.value = -Math.abs(Math.sin(cycle)) * 0.018;
        su.uPelvisRoll.value = Math.sin(cycle) * 0.02;
        su.uSpineTwist.value = 0.0;
        su.uArmSwingL.value = -0.15 - Math.sin(cycle) * 0.18;
        su.uElbowBendL.value = 0.10;
        su.uArmSwingR.value = -0.15 + Math.sin(cycle) * 0.18;
        su.uElbowBendR.value = 0.10;

        animOffsetY = 0;
        modelRef.current.rotation.set(0.12, Math.sin(cycle) * 0.02, 0);
      } else if (walkStyle === 'model') {
        // مشية عارض أزياء وتمايل الحوض الأنيق (Runway Fashion Walk)
        const cycle = t * 3.2 * speed;
        su.uLegSwingL.value = Math.sin(cycle) * 0.44;
        su.uKneeBendL.value = Math.max(0.0, -Math.sin(cycle)) * 0.60;
        su.uFootPitchL.value = -Math.sin(cycle) * 0.18;
        su.uLegSwingR.value = -Math.sin(cycle) * 0.44;
        su.uKneeBendR.value = Math.max(0.0, Math.sin(cycle)) * 0.60;
        su.uFootPitchR.value = Math.sin(cycle) * 0.18;
        su.uPelvisBob.value = -Math.abs(Math.sin(cycle)) * 0.028;
        su.uPelvisRoll.value = Math.sin(cycle) * 0.075;
        su.uSpineTwist.value = -Math.sin(cycle) * 0.05;
        su.uArmSwingL.value = -Math.sin(cycle) * 0.42;
        su.uElbowBendL.value = 0.20;
        su.uArmSwingR.value = Math.sin(cycle) * 0.42;
        su.uElbowBendR.value = 0.20;

        animOffsetY = Math.sin(cycle * 2.0) * 0.012;
        modelRef.current.rotation.set(0.01, Math.sin(cycle) * 0.04, Math.sin(cycle) * 0.02);
      } else if (walkStyle === 'karate') {
        // ركلات وقتال وفنون قتالية (Martial Arts / High Kicks)
        const cycle = t * 3.2 * speed;
        const kickPhase = Math.sin(cycle);
        su.uLegSwingL.value = kickPhase > 0.0 ? kickPhase * 1.15 : -0.20;
        su.uKneeBendL.value = kickPhase > 0.5 ? 0.05 : 0.40;
        su.uFootPitchL.value = 0.1;
        su.uLegSwingR.value = kickPhase < 0.0 ? -kickPhase * 1.15 : -0.20;
        su.uKneeBendR.value = kickPhase < -0.5 ? 0.05 : 0.40;
        su.uFootPitchR.value = 0.1;
        su.uPelvisBob.value = Math.sin(cycle * 2.0) * 0.02;
        su.uPelvisRoll.value = 0.0;
        su.uSpineTwist.value = Math.sin(cycle) * 0.12;
        su.uArmSwingL.value = 0.70 + Math.sin(cycle * 2.0) * 0.35;
        su.uElbowBendL.value = 0.80;
        su.uArmSwingR.value = 0.70 - Math.sin(cycle * 2.0) * 0.35;
        su.uElbowBendR.value = 0.80;

        animOffsetY = Math.abs(kickPhase) * 0.03;
        modelRef.current.rotation.set(0.04, Math.sin(cycle) * 0.15, 0);
      } else {
        // أنيميشن مخصص ديناميكي لأي طلب حركي جديد من الذكاء الاصطناعي (Dynamic Custom Procedural Animation)
        const cycle = t * 3.0 * speed;
        su.uLegSwingL.value = Math.sin(cycle) * 0.35;
        su.uKneeBendL.value = Math.max(0.0, -Math.sin(cycle)) * 0.55;
        su.uFootPitchL.value = -Math.sin(cycle) * 0.15;
        su.uLegSwingR.value = -Math.sin(cycle) * 0.35;
        su.uKneeBendR.value = Math.max(0.0, Math.sin(cycle)) * 0.55;
        su.uFootPitchR.value = Math.sin(cycle) * 0.15;
        su.uPelvisBob.value = -Math.abs(Math.sin(cycle)) * 0.020;
        su.uPelvisRoll.value = Math.sin(cycle) * 0.025;
        su.uSpineTwist.value = -Math.sin(cycle) * 0.04;
        su.uArmSwingL.value = -Math.sin(cycle) * 0.40;
        su.uElbowBendL.value = 0.20 + Math.abs(Math.sin(cycle)) * 0.20;
        su.uArmSwingR.value = Math.sin(cycle) * 0.40;
        su.uElbowBendR.value = 0.20 + Math.abs(Math.cos(cycle)) * 0.20;
        animOffsetY = Math.sin(cycle * 2.0) * 0.010;
        modelRef.current.rotation.set(0.01, Math.sin(cycle) * 0.03, 0);
      }
    } else {
      // إيقاف أو وضع T-Pose المرجعي
      su.uAnimActive.value = 0.0;
      su.uLegSwingL.value = 0.0;
      su.uKneeBendL.value = 0.0;
      su.uFootPitchL.value = 0.0;
      su.uLegSwingR.value = 0.0;
      su.uKneeBendR.value = 0.0;
      su.uFootPitchR.value = 0.0;
      su.uPelvisBob.value = 0.0;
      su.uPelvisRoll.value = 0.0;
      su.uArmSwingL.value = 0.0;
      su.uElbowBendL.value = 0.0;
      su.uArmSwingR.value = 0.0;
      su.uElbowBendR.value = 0.0;
      su.uSpineTwist.value = 0.0;

      modelRef.current.rotation.set(0, 0, 0);
      if (parts.uppr) parts.uppr.rotation.set(0, 0, 0);
      if (parts.jbib) parts.jbib.rotation.set(0, 0, 0);
      if (parts.head) parts.head.rotation.set(0, 0, 0);
    }

    modelRef.current.position.y = groundBaseY + animOffsetY;
  });

  return (
    <group ref={modelRef} position={[0, 0, 0]}>
      <primitive 
        object={modelScene} 
        onPointerDown={handleClothPointerDown}
        onPointerOver={(e) => {
          if (!clothingPatternRef.current) return;
          const name = (e.object?.name || '').toLowerCase();
          if (name.includes('jbib') || name.includes('0e4f123c') || name.includes('uppr')) {
            document.body.style.cursor = 'grab';
          }
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      />

      {/* المحرك الشامل للإضافات الخارجية التجميلية (FiveForge 3D Cosmetic Addons) */}
      <CosmeticAddons cosmetics={morphs.cosmetics || morphs} morphs={morphs} />

      {/* سدادة كم التيشيرت الجراحية المحكمة لليد اليسرى */}
      {morphs.hideLeftArm && (
        <group 
          position={[0.293, 0.323, -0.054]} 
          rotation={[0.35, 0.20, -0.72]}
        >
          {/* سدادة قماش التيشيرت الداخلية لمنع أي تجويف مفرغ */}
          <mesh scale={[1.05, 0.88, 1.15]}>
            <cylinderGeometry args={[0.070, 0.074, 0.025, 32]} />
            <meshStandardMaterial 
              color={morphs.clothingColor || '#ffffff'} 
              roughness={0.8} 
              side={THREE.DoubleSide} 
            />
          </mesh>
          {/* سدادة البتر الجلدية الواقعية المحكمة المتصلة بنهاية الكم */}
          <mesh position={[0, -0.008, 0]} rotation={[Math.PI, 0, 0]} scale={[0.96, 0.78, 1.02]}>
            <sphereGeometry args={[0.064, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
            <meshStandardMaterial color={morphs.skinColor && morphs.skinColor !== '#ffffff' ? morphs.skinColor : "#c98e77"} roughness={0.58} />
          </mesh>
          {/* خياطة جراحية دقيقة في المنتصف */}
          <mesh position={[0, -0.024, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.018, 16]} />
            <meshStandardMaterial color="#8c4e3e" roughness={0.65} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {/* سدادة كم التيشيرت الجراحية المحكمة لليد اليمنى */}
      {morphs.hideRightArm && (
        <group 
          position={[-0.293, 0.323, -0.054]} 
          rotation={[0.35, -0.20, 0.72]}
        >
          {/* سدادة قماش التيشيرت الداخلية لمنع أي تجويف مفرغ */}
          <mesh scale={[1.05, 0.88, 1.15]}>
            <cylinderGeometry args={[0.070, 0.074, 0.025, 32]} />
            <meshStandardMaterial 
              color={morphs.clothingColor || '#ffffff'} 
              roughness={0.8} 
              side={THREE.DoubleSide} 
            />
          </mesh>
          {/* سدادة البتر الجلدية الواقعية المحكمة المتصلة بنهاية الكم */}
          <mesh position={[0, -0.008, 0]} rotation={[Math.PI, 0, 0]} scale={[0.96, 0.78, 1.02]}>
            <sphereGeometry args={[0.064, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
            <meshStandardMaterial color={morphs.skinColor && morphs.skinColor !== '#ffffff' ? morphs.skinColor : "#c98e77"} roughness={0.58} />
          </mesh>
          {/* خياطة جراحية دقيقة في المنتصف */}
          <mesh position={[0, -0.024, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.018, 16]} />
            <meshStandardMaterial color="#8c4e3e" roughness={0.65} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {/* سدادة البتر الواقعية للساق اليسرى */}
      {morphs.hideLeftLeg && (
        <group position={[0.113, -0.380, -0.015]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.066, 0.068, 0.02, 24]} />
            <meshStandardMaterial color="#1e293b" roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.012, 0]} rotation={[Math.PI, 0, 0]}>
            <sphereGeometry args={[0.064, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
            <meshStandardMaterial color="#c98e77" roughness={0.55} />
          </mesh>
        </group>
      )}

      {/* سدادة البتر الواقعية للساق اليمنى */}
      {morphs.hideRightLeg && (
        <group position={[-0.113, -0.380, -0.015]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.066, 0.068, 0.02, 24]} />
            <meshStandardMaterial color="#1e293b" roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.012, 0]} rotation={[Math.PI, 0, 0]}>
            <sphereGeometry args={[0.064, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
            <meshStandardMaterial color="#c98e77" roughness={0.55} />
          </mesh>
        </group>
      )}

      {/* مقابض السحب التفاعلية ثلاثية الأبعاد المباشرة على اللبس (3D Direct Garment Pull Handles) */}
      {clothingPattern && (
        <Garment3DPullGizmo 
          pattern={clothingPattern} 
          onChange={onChangeClothingPattern} 
          onTriggerDrape={onTriggerDrape}
          controlsRef={controlsRef}
          setActiveDragHUD={setActiveDragHUD}
        />
      )}

      {/* درزات وخيوط الخياطة ثلاثية الأبعاد بالنقاط البرتقالية (Show seams) */}
      <SeamLinesOverlay pattern={clothingPattern} morphs={morphs} />
    </group>
  );
}

// مقابض السحب التفاعلية ثلاثية الأبعاد المباشرة على اللبس (3D Direct Garment Pull Handles)
function Garment3DPullGizmo({ pattern, onChange, onTriggerDrape, controlsRef, setActiveDragHUD }) {
  const [hoveredHandle, setHoveredHandle] = useState(null);
  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  const handles = [
    {
      id: 'sleeveL',
      title: 'طول الكم الأيسر',
      key: 'sleeveLengthL',
      color: '#38bdf8',
      getPos: (cp) => {
        const sLen = cp.sleeveLengthL ?? cp.sleeveLength ?? 28;
        if (sLen > 28.5) {
          const sProg = Math.min(1.0, Math.max(0.0, (sLen - 28.5) / 51.5));
          const tCuff = 0.176 + sProg * (0.76 - 0.176);
          return [0.24 + tCuff * 0.32, 0.38 - tCuff * 0.48, -0.07 + tCuff * 0.037];
        } else {
          const t = (28.5 - sLen) / 23.5;
          const tCuff = 0.176 - t * 0.09;
          return [0.24 + tCuff * 0.32, 0.38 - tCuff * 0.48, -0.07 + tCuff * 0.037];
        }
      },
      min: 10, max: 85, default: 28, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = (dy - dx * 0.40) * 0.32;
        return Math.round(Math.min(85, Math.max(10, startVal + d)));
      }
    },
    {
      id: 'sleeveR',
      title: 'طول الكم الأيمن',
      key: 'sleeveLengthR',
      color: '#38bdf8',
      getPos: (cp) => {
        const sLen = cp.sleeveLengthR ?? cp.sleeveLength ?? 28;
        if (sLen > 28.5) {
          const sProg = Math.min(1.0, Math.max(0.0, (sLen - 28.5) / 51.5));
          const tCuff = 0.176 + sProg * (0.76 - 0.176);
          return [-(0.24 + tCuff * 0.32), 0.38 - tCuff * 0.48, -0.07 + tCuff * 0.037];
        } else {
          const t = (28.5 - sLen) / 23.5;
          const tCuff = 0.176 - t * 0.09;
          return [-(0.24 + tCuff * 0.32), 0.38 - tCuff * 0.48, -0.07 + tCuff * 0.037];
        }
      },
      min: 10, max: 85, default: 28, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = (dy + dx * 0.40) * 0.32;
        return Math.round(Math.min(85, Math.max(10, startVal + d)));
      }
    },
    {
      id: 'hemFrontL',
      title: 'زاوية الحاشية يسار تحت',
      key: 'hemFrontL',
      color: '#ec4899',
      getPos: (cp) => {
        const baseHemY = 0.24 - Math.min(1, Math.max(0, ((cp.length || 78) - 30) / 80)) * 0.46;
        return [0.17, baseHemY - (cp.hemFrontL || 0) * 0.007, 0.11];
      },
      min: -35, max: 35, default: 0, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = dy * 0.16;
        return Math.round(Math.min(35, Math.max(-35, startVal + d)));
      }
    },
    {
      id: 'hemFrontR',
      title: 'زاوية الحاشية يمين تحت',
      key: 'hemFrontR',
      color: '#ec4899',
      getPos: (cp) => {
        const baseHemY = 0.24 - Math.min(1, Math.max(0, ((cp.length || 78) - 30) / 80)) * 0.46;
        return [-0.17, baseHemY - (cp.hemFrontR || 0) * 0.007, 0.11];
      },
      min: -35, max: 35, default: 0, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = dy * 0.16;
        return Math.round(Math.min(35, Math.max(-35, startVal + d)));
      }
    },
    {
      id: 'hemBackL',
      title: 'زاوية الحاشية ورا تحت يسار',
      key: 'hemBackL',
      color: '#f43f5e',
      getPos: (cp) => {
        const baseHemY = 0.24 - Math.min(1, Math.max(0, ((cp.length || 78) - 30) / 80)) * 0.46;
        return [0.17, baseHemY - (cp.hemBackL || 0) * 0.007, -0.11];
      },
      min: -35, max: 35, default: 0, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = dy * 0.16;
        return Math.round(Math.min(35, Math.max(-35, startVal + d)));
      }
    },
    {
      id: 'hemBackR',
      title: 'زاوية الحاشية ورا تحت يمين',
      key: 'hemBackR',
      color: '#f43f5e',
      getPos: (cp) => {
        const baseHemY = 0.24 - Math.min(1, Math.max(0, ((cp.length || 78) - 30) / 80)) * 0.46;
        return [-0.17, baseHemY - (cp.hemBackR || 0) * 0.007, -0.11];
      },
      min: -35, max: 35, default: 0, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = dy * 0.16;
        return Math.round(Math.min(35, Math.max(-35, startVal + d)));
      }
    },
    {
      id: 'shoulderL',
      title: 'كتف فوق يسار',
      key: 'shoulderL',
      color: '#a855f7',
      getPos: (cp) => [0.15, 0.45 + (cp.shoulderL || 0) * 0.005, 0.06],
      min: -20, max: 20, default: 0, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = -dy * 0.16;
        return Math.round(Math.min(20, Math.max(-20, startVal + d)));
      }
    },
    {
      id: 'shoulderR',
      title: 'كتف يمين فوق',
      key: 'shoulderR',
      color: '#a855f7',
      getPos: (cp) => [-0.15, 0.45 + (cp.shoulderR || 0) * 0.005, 0.06],
      min: -20, max: 20, default: 0, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = -dy * 0.16;
        return Math.round(Math.min(20, Math.max(-20, startVal + d)));
      }
    },
    {
      id: 'backShoulderL',
      title: 'كتف ورا يسار فوق',
      key: 'backShoulderL',
      color: '#6366f1',
      getPos: (cp) => [0.15, 0.45 + (cp.backShoulderL || 0) * 0.005, -0.06],
      min: -20, max: 20, default: 0, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = -dy * 0.16;
        return Math.round(Math.min(20, Math.max(-20, startVal + d)));
      }
    },
    {
      id: 'backShoulderR',
      title: 'كتف ورا يمين فوق',
      key: 'backShoulderR',
      color: '#6366f1',
      getPos: (cp) => [-0.15, 0.45 + (cp.backShoulderR || 0) * 0.005, -0.06],
      min: -20, max: 20, default: 0, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = -dy * 0.16;
        return Math.round(Math.min(20, Math.max(-20, startVal + d)));
      }
    },
    {
      id: 'lengthCenter',
      title: 'طول البلوزة الكلي',
      key: 'length',
      color: '#eab308',
      getPos: (cp) => {
        const baseHemY = 0.24 - Math.min(1, Math.max(0, ((cp.length || 78) - 30) / 80)) * 0.46;
        return [0.0, baseHemY, 0.12];
      },
      min: 30, max: 110, default: 78, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = dy * 0.22;
        return Math.round(Math.min(110, Math.max(30, startVal + d)));
      }
    },
    {
      id: 'waistL',
      title: 'خصر يسار وسط',
      key: 'waistL',
      color: '#10b981',
      getPos: (cp) => [0.21 + (cp.waistL || 0) * 0.003, 0.12, 0.0],
      min: -25, max: 25, default: 0, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = dx * 0.18;
        return Math.round(Math.min(25, Math.max(-25, startVal + d)));
      }
    },
    {
      id: 'waistR',
      title: 'خصر يمين وسط',
      key: 'waistR',
      color: '#10b981',
      getPos: (cp) => [-0.21 - (cp.waistR || 0) * 0.003, 0.12, 0.0],
      min: -25, max: 25, default: 0, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = -dx * 0.18;
        return Math.round(Math.min(25, Math.max(-25, startVal + d)));
      }
    },
    {
      id: 'widthChest',
      title: 'عرض الصدر والبلوزة',
      key: 'width',
      color: '#3b82f6',
      getPos: (cp) => [0.0, 0.28, 0.12],
      min: 35, max: 85, default: 56, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = (Math.abs(dx) > Math.abs(dy) ? dx : -dy) * 0.18;
        return Math.round(Math.min(85, Math.max(35, startVal + d)));
      }
    },
    {
      id: 'neckline',
      title: 'فتحة الياقة والرقبة',
      key: 'neckline',
      color: '#f59e0b',
      getPos: (cp) => [0.0, 0.42, 0.08],
      min: 15, max: 45, default: 28, unit: 'cm',
      calcDelta: (dx, dy, startVal) => {
        const d = dy * 0.18;
        return Math.round(Math.min(45, Math.max(15, startVal + d)));
      }
    }
  ];

  const startDragHandle = (clientX, clientY, handleDef) => {
    if (controlsRef?.current) controlsRef.current.enabled = false;
    document.body.style.cursor = 'grabbing';
    const startX = clientX;
    const startY = clientY;
    const currentPattern = { ...patternRef.current };
    const startVal = currentPattern[handleDef.key] ?? handleDef.default;

    if (setActiveDragHUD) {
      setActiveDragHUD({
        title: handleDef.title,
        value: startVal,
        unit: handleDef.unit,
        min: handleDef.min
      });
    }

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const newVal = handleDef.calcDelta(dx, dy, startVal);
      currentPattern[handleDef.key] = newVal;
      patternRef.current = { ...currentPattern };
      onChange?.({ ...currentPattern });
      if (setActiveDragHUD) {
        setActiveDragHUD({
          title: handleDef.title,
          value: newVal,
          unit: handleDef.unit,
          min: handleDef.min
        });
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (controlsRef?.current) controlsRef.current.enabled = true;
      document.body.style.cursor = 'auto';
      if (setActiveDragHUD) setActiveDragHUD(null);
      onTriggerDrape?.();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useEffect(() => {
    const handleDirectDrag = (e) => {
      const { local, clientX, clientY } = e.detail;
      let chosenId = null;
      if (Math.abs(local.x) > 0.18 && local.y < 0.44) {
        // ذراع وأكمام مستقلة تماماً لكل جهة
        chosenId = local.x > 0 ? 'sleeveL' : 'sleeveR';
      } else if (local.y > 0.40 && Math.abs(local.x) < 0.09 && local.z > 0.02) {
        chosenId = 'neckline';
      } else if (local.y > 0.35) {
        if (local.z > 0) {
          chosenId = local.x > 0 ? 'shoulderL' : 'shoulderR';
        } else {
          chosenId = local.x > 0 ? 'backShoulderL' : 'backShoulderR';
        }
      } else if (local.y < 0.14) {
        if (Math.abs(local.x) < 0.08) {
          chosenId = 'lengthCenter';
        } else if (local.z > 0) {
          chosenId = local.x > 0 ? 'hemFrontL' : 'hemFrontR';
        } else {
          chosenId = local.x > 0 ? 'hemBackL' : 'hemBackR';
        }
      } else if (Math.abs(local.x) > 0.12 && local.y <= 0.28) {
        chosenId = local.x > 0 ? 'waistL' : 'waistR';
      } else {
        chosenId = 'widthChest';
      }

      const h = handles.find(item => item.id === chosenId);
      if (h) {
        startDragHandle(clientX, clientY, h);
      }
    };

    window.addEventListener('garment-cloth-direct-drag', handleDirectDrag);
    return () => window.removeEventListener('garment-cloth-direct-drag', handleDirectDrag);
  }, []);

  // السحب المباشر الطبيعي من نفس مكان القماش في البلوزة بدون إظهار أي دوائر عائمة
  return null;
}

// درزات وخيوط الخياطة ثلاثية الأبعاد بالنقاط البرتقالية المطابقة تماماً لصور المرجع
function SeamLinesOverlay({ pattern, morphs }) {
  if (!pattern || !pattern.showSeams) return null;

  const points = [];
  const bellyFat = morphs?.bellyFat || 1.0;
  const chest = morphs?.chest || 1.0;
  const shoulders = morphs?.shoulders || 1.0;
  const armMuscles = morphs?.armMuscles || 1.0;

  const widthFactor = (pattern.width || 56) / 56.0;
  const lengthRatio = Math.max(0.0, Math.min(1.0, ((pattern.length || 78) - 30.0) / 80.0));
  const baseHemY = 0.24 - lengthRatio * 0.46;
  const hemLeftY = baseHemY + (pattern.hemFrontL || 0) * 0.007 - (pattern.hemLeftOffset || 0) * 0.007;
  const hemRightY = baseHemY + (pattern.hemFrontR || 0) * 0.007 - (pattern.hemRightOffset || 0) * 0.007;

  // عامل إزاحة عرض التيشيرت والكرش الجانبي
  const sideSpread = (widthFactor - 1.0) * 0.030;
  const fatSpread = (bellyFat - 1.0) * 0.080;
  const chestSpread = (chest - 1.0) * 0.040;

  // 1. درزات قمة الكتفين (Shoulder Seams - Left & Right)
  for (let t = 0; t <= 1; t += 0.10) {
    const shX = 0.075 + t * (0.125 * shoulders + chestSpread * 0.5);
    const shY = 0.442 - t * 0.045 + (t > 0.5 ? (pattern.shoulderL || 0) * 0.002 : 0);
    const shZ = -0.012 + (chest - 1.0) * 0.015;
    points.push(-shX, shY, shZ);
    points.push(shX, shY, shZ);
  }

  // 2. درزات فتحة الرقبة الياقة المنحنية (Neckline Collar Seam Loop)
  const neckRatio = Math.max(0.0, Math.min(1.0, ((pattern.neckline || 28) - 15.0) / 30.0));
  for (let a = 0; a < Math.PI * 2; a += 0.28) {
    const rx = 0.072 + neckRatio * 0.022;
    const ry = 0.040 + neckRatio * 0.035;
    const cX = Math.sin(a) * rx;
    const cY = 0.425 - Math.cos(a) * ry - (a < Math.PI ? neckRatio * 0.020 : 0.0);
    const cZ = Math.cos(a) > 0.0 ? (0.045 + (chest - 1.0) * 0.025) : -0.048;
    points.push(cX, cY, cZ);
  }

  // 3. درزات اتصال الكم بالكتف محاذاة لسطح القماش (Armhole Seams محاذاة لتشريح الكتف دون أي طفو)
  const armholeCenterY = 0.385;
  const armholeCenterZ = -0.040;
  const armholeRadiusY = 0.055;
  const armholeRadiusZ = 0.060;

  for (let a = 0; a < Math.PI * 2; a += 0.32) {
    const cA = Math.cos(a);
    const sA = Math.sin(a);
    const pYL = armholeCenterY + cA * armholeRadiusY;
    const pZL = armholeCenterZ + sA * armholeRadiusZ;
    const pXL = 0.178 + (shoulders - 1.0) * 0.035 + Math.max(0.0, cA) * 0.038 + (chest - 1.0) * 0.01;
    points.push(pXL, pYL, pZL);
    points.push(-pXL, pYL, pZL);
  }

  // 4. درزات الجوانب المنسدلة حتى الحاشية (Lateral Side Seams)
  for (let y = 0.28; y >= hemLeftY; y -= 0.020) {
    const yProg = (0.28 - y) / 0.45;
    const localFat = fatSpread * Math.sin(Math.min(1.0, yProg * 1.5) * Math.PI * 0.5);
    const xL = -(0.165 + sideSpread + localFat + (pattern.waistL || 0) * 0.002);
    const zL = -0.018 + (bellyFat - 1.0) * 0.025 * yProg;
    points.push(xL, y, zL);
  }
  for (let y = 0.28; y >= hemRightY; y -= 0.020) {
    const yProg = (0.28 - y) / 0.45;
    const localFat = fatSpread * Math.sin(Math.min(1.0, yProg * 1.5) * Math.PI * 0.5);
    const xR = (0.165 + sideSpread + localFat + (pattern.waistR || 0) * 0.002);
    const zR = -0.018 + (bellyFat - 1.0) * 0.025 * yProg;
    points.push(xR, y, zR);
  }

  // 5. درزات الظهر المنحنية المتقاطعة (Back Dart Seams كما بالصورة 2)
  for (let y = 0.16; y <= 0.38; y += 0.024) {
    const dX = 0.038 + (0.38 - y) * 0.08;
    const dZ = -0.062 - (bellyFat - 1.0) * 0.015;
    points.push(-dX, y, dZ);
    points.push(dX, y, dZ);
  }

  // 6. درزات باطن الأكمام وكفة المعصم المستقلة للذراع الأيسر والأيمن (Underarm & Cuff Sleeve Seams)
  const calcTCuff = (lenVal) => {
    const val = lenVal ?? 28;
    if (val > 28.5) {
      const sProg = Math.min(1.0, Math.max(0.0, (val - 28.5) / 51.5));
      return 0.17 + sProg * (0.95 - 0.17);
    }
    return Math.max(0.06, 0.17 - ((28.5 - val) / 23.5) * 0.10);
  };
  const tCuffL = calcTCuff(pattern.sleeveLengthL ?? pattern.sleeveLength);
  const tCuffR = calcTCuff(pattern.sleeveLengthR ?? pattern.sleeveLength);

  // متجهات المحاذاة المتعامدة لأسطوانة الذراع لضمان رسم حلقة كفة الكم بدقة 360 درجة
  const uArm = [0.832, 0.555, 0.0];
  const vArm = [-0.035, 0.053, 0.998];

  // درزات باطن الكم الأيسر
  for (let t = 0.10; t <= tCuffL; t += 0.035) {
    const rCloth = (0.062 - t * 0.016) * (1.0 + Math.max(0, (widthFactor - 1.0) * 0.20));
    const pX = 0.24 + t * 0.32 - 0.012;
    const pY = 0.38 - t * 0.48 - rCloth * 0.85;
    const pZ = -0.07 + t * 0.037 - 0.018;
    points.push(pX, pY, pZ);
  }
  // حلقة درزات كفة الكم الأيسر الدائرية 360 درجة
  const cuffCenterL = [0.24 + tCuffL * 0.32, 0.38 - tCuffL * 0.48, -0.07 + tCuffL * 0.037];
  const cuffRadiusL = (0.058 - (tCuffL - 0.17) * 0.016) * (1.0 + Math.max(0, (widthFactor - 1.0) * 0.20));
  for (let a = 0; a < Math.PI * 2; a += 0.32) {
    const ca = Math.cos(a) * cuffRadiusL;
    const sa = Math.sin(a) * cuffRadiusL;
    points.push(
      cuffCenterL[0] + ca * uArm[0] + sa * vArm[0],
      cuffCenterL[1] + ca * uArm[1] + sa * vArm[1],
      cuffCenterL[2] + ca * uArm[2] + sa * vArm[2]
    );
  }

  // درزات باطن الكم الأيمن
  for (let t = 0.10; t <= tCuffR; t += 0.035) {
    const rCloth = (0.062 - t * 0.016) * (1.0 + Math.max(0, (widthFactor - 1.0) * 0.20));
    const pX = -(0.24 + t * 0.32 - 0.012);
    const pY = 0.38 - t * 0.48 - rCloth * 0.85;
    const pZ = -0.07 + t * 0.037 - 0.018;
    points.push(pX, pY, pZ);
  }
  // حلقة درزات كفة الكم الأيمن الدائرية 360 درجة
  const cuffCenterR = [-(0.24 + tCuffR * 0.32), 0.38 - tCuffR * 0.48, -0.07 + tCuffR * 0.037];
  const cuffRadiusR = (0.058 - (tCuffR - 0.17) * 0.016) * (1.0 + Math.max(0, (widthFactor - 1.0) * 0.20));
  for (let a = 0; a < Math.PI * 2; a += 0.32) {
    const ca = Math.cos(a) * cuffRadiusR;
    const sa = Math.sin(a) * cuffRadiusR;
    points.push(
      cuffCenterR[0] - (ca * uArm[0] + sa * vArm[0]),
      cuffCenterR[1] + ca * uArm[1] + sa * vArm[1],
      cuffCenterR[2] + ca * uArm[2] + sa * vArm[2]
    );
  }

  const positions = new Float32Array(points);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#f97316"
        size={0.0085}
        sizeAttenuation={true}
        transparent={true}
        opacity={0.95}
        depthWrite={false}
      />
    </points>
  );
}

// محدد إعدادات الإضاءة السينمائية
function StudioLighting({ environment }) {
  if (environment === 'cinematic') {
    return (
      <>
        <ambientLight intensity={0.6} color="#ffe8d6" />
        <directionalLight position={[4, 5, 4]} intensity={2.0} color="#ffb07c" castShadow />
        <directionalLight position={[-4, 3, -3]} intensity={1.2} color="#6ba6ff" />
        <directionalLight position={[0, 4, -4]} intensity={1.5} color="#ffffff" />
      </>
    );
  }

  if (environment === 'night') {
    return (
      <>
        <ambientLight intensity={0.25} color="#0c0e1a" />
        <directionalLight position={[4, 4, 3]} intensity={2.2} color="#f43f5e" castShadow />
        <directionalLight position={[-4, 3, -2]} intensity={2.0} color="#06b6d4" />
        <directionalLight position={[0, 5, -4]} intensity={1.4} color="#8b5cf6" />
      </>
    );
  }

  if (environment === 'daylight') {
    return (
      <>
        <ambientLight intensity={0.9} color="#e0f2fe" />
        <directionalLight position={[5, 9, 3]} intensity={2.4} color="#fffbeb" castShadow />
        <directionalLight position={[-3, 4, -2]} intensity={0.7} color="#93c5fd" />
      </>
    );
  }

  return (
    <>
      <ambientLight intensity={0.85} color="#ffffff" />
      <directionalLight position={[4, 6, 4]} intensity={1.7} color="#fff" castShadow />
      <directionalLight position={[-4, 4, -3]} intensity={0.9} color="#94a3b8" />
      <directionalLight position={[0, 4, -4]} intensity={1.1} color="#cbd5e1" />
    </>
  );
}

export default function PedViewer({ 
  morphs, 
  textures, 
  visibility = {}, 
  shadingMode = 'rendered', 
  lightingEnv = 'studio', 
  walkStyle = 'casual', 
  animSpeed = 1.0, 
  isPlaying = false, 
  cameraView = 'front', 
  onCameraViewChange, 
  onTexturesDropped, 
  onSelectPed,
  clothingPattern = null,
  onChangeClothingPattern,
  onTriggerDrape
}) {
  const [loadedScene, setLoadedScene] = useState(null);
  const [modelName, setModelName] = useState('شخصية فايف إم الرسمية (mp_m_freemode_01)');
  const [isDragging, setIsDragging] = useState(false);
  const [activeDragHUD, setActiveDragHUD] = useState(null);
  const controlsRef = useRef();

  useEffect(() => {
    loadPedScene()
      .then((scene) => {
        setLoadedScene(scene);
      })
      .catch((err) => console.error("[DEBUG] GLTF load error:", err));
  }, []);

  useEffect(() => {
    const handleLoadModel = (e) => {
      const { name, buffer } = e.detail;
      setModelName(name);

      if (name.toLowerCase().endsWith('.glb') || name.toLowerCase().endsWith('.gltf')) {
        const loader = new GLTFLoader();
        loader.parse(buffer, '', (gltf) => setLoadedScene(gltf.scene));
      } else if (name.toLowerCase().endsWith('.obj')) {
        const text = new TextDecoder().decode(buffer);
        const loader = new OBJLoader();
        setLoadedScene(loader.parse(text));
      }
    };

    window.addEventListener('load-ped-model', handleLoadModel);
    return () => window.removeEventListener('load-ped-model', handleLoadModel);
  }, []);

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (!files || files.length === 0) return;

    const detected = {};
    for (const file of files) {
      const lower = file.name.toLowerCase();
      const reader = new FileReader();

      await new Promise((resolve) => {
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          if (lower.includes('head') || lower.includes('face')) detected.head = { url: dataUrl, name: file.name };
          else if (lower.includes('uppr') || lower.includes('arm') || lower.includes('hand')) detected.uppr = { url: dataUrl, name: file.name };
          else if (lower.includes('lowr') || lower.includes('pant') || lower.includes('leg')) detected.lowr = { url: dataUrl, name: file.name };
          else if (lower.includes('jbib') || lower.includes('shirt') || lower.includes('jacket') || lower.includes('top')) detected.jbib = { url: dataUrl, name: file.name };
          else if (lower.includes('feet') || lower.includes('shoe')) detected.feet = { url: dataUrl, name: file.name };
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    if (Object.keys(detected).length > 0 && onTexturesDropped) {
      onTexturesDropped(detected);
    }
  };

  return (
    <div 
      className="w-full h-full relative bg-neutral-950 overflow-hidden select-none"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-950/80 backdrop-blur-md border-4 border-dashed border-indigo-400 flex flex-col items-center justify-center pointer-events-none transition-all">
          <Sparkles className="w-16 h-16 text-indigo-300 animate-bounce mb-3" />
          <h2 className="text-xl font-bold text-white mb-1">أفلت تكسشرات فايف إم هنا!</h2>
          <p className="text-sm text-indigo-200">سيتم التعرف على أجزاء الشخصية (الرأس، التيشيرت، الجينز، الحذاء) وتركيبها تلقائياً</p>
        </div>
      )}

      {/* شاشة تحميل أنيقة وخفيفة وسريعة جداً عند الفتح أو التحديث */}
      {!loadedScene && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-neutral-950/70 backdrop-blur-sm pointer-events-none transition-all duration-300">
          <div className="relative flex items-center justify-center mb-3">
            <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <Sparkles className="w-5 h-5 text-indigo-400 absolute animate-pulse" />
          </div>
          <p className="text-xs font-bold text-neutral-200 tracking-wide">جاري تجهيز استوديو الشخصية...</p>
        </div>
      )}

      <Canvas 
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.05, 3.15], fov: 42 }}
        gl={{ 
          antialias: true, 
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
          outputColorSpace: THREE.SRGBColorSpace,
          preserveDrawingBuffer: false
        }}
      >
        <CameraController cameraView={cameraView} controlsRef={controlsRef} />
        <LocalStudioEnvironment />
        <StudioLighting environment={lightingEnv} />

        {loadedScene && (
          <DynamicPedModel 
            modelScene={loadedScene} 
            morphs={morphs} 
            textures={textures}
            visibility={visibility}
            shadingMode={shadingMode}
            walkStyle={walkStyle}
            animSpeed={animSpeed}
            isPlaying={isPlaying} 
            clothingPattern={clothingPattern}
            onChangeClothingPattern={onChangeClothingPattern}
            onTriggerDrape={onTriggerDrape}
            controlsRef={controlsRef}
            setActiveDragHUD={setActiveDragHUD}
          />
        )}

        <ContactShadows opacity={0.65} scale={3.8} blur={1.8} resolution={256} frames={1} far={3.0} position={[0, -1.002, 0]} />
        <Grid 
          infiniteGrid 
          fadeDistance={18} 
          cellColor="#262626" 
          sectionColor="#404040" 
          position={[0, -1.002, 0]} 
        />
        <OrbitControls 
          ref={controlsRef}
          target={[0, -0.15, 0]} 
          minDistance={0.5} 
          maxDistance={5.5} 
          enableDamping 
          dampingFactor={0.08}
        />
      </Canvas>

      {/* مؤشر السحب المباشر ثلاثي الأبعاد على اللبس (3D Direct Garment Pull HUD) */}
      {activeDragHUD && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-neutral-900/95 backdrop-blur-xl border border-indigo-500/80 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in-95 pointer-events-none">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
          <span className="text-xs font-bold text-white tracking-wide">
            سحب ثلاثي الأبعاد: <span className="text-indigo-300 font-extrabold">{activeDragHUD.title}</span>
          </span>
          <span className="text-xs bg-indigo-600 px-2.5 py-0.5 rounded-lg font-mono font-bold text-white shadow-inner">
            {activeDragHUD.value > 0 && activeDragHUD.min < 0 ? `+${activeDragHUD.value}` : activeDragHUD.value} {activeDragHUD.unit}
          </span>
        </div>
      )}

      <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
        <button
          onClick={onSelectPed}
          className="bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/80 px-3.5 py-2 rounded-xl flex items-center gap-2.5 transition shadow-xl cursor-pointer backdrop-blur"
          title="تغيير أو استيراد ملف 3D Ped جديد"
        >
          <FolderOpen className="w-4 h-4 text-indigo-400" />
          <div className="text-right">
            <p className="text-xs font-semibold text-neutral-200">{modelName}</p>
            <p className="text-[9px] text-neutral-400">انقر لتغيير أو استيراد Ped (.glb, .obj)</p>
          </div>
        </button>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur border border-neutral-800/80 px-2 py-1.5 rounded-xl flex items-center gap-1 shadow-2xl z-10 text-[11px] font-medium text-neutral-300">
        <button
          onClick={() => onCameraViewChange && onCameraViewChange('front')}
          className={`px-2.5 py-1 rounded-lg transition ${cameraView === 'front' ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-neutral-800 text-neutral-400'}`}
          title="المنظور الأمامي (Front)"
        >
          أمام
        </button>
        <button
          onClick={() => onCameraViewChange && onCameraViewChange('back')}
          className={`px-2.5 py-1 rounded-lg transition ${cameraView === 'back' ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-neutral-800 text-neutral-400'}`}
          title="المنظور الخلفي (Back)"
        >
          خلف
        </button>
        <button
          onClick={() => onCameraViewChange && onCameraViewChange('left')}
          className={`px-2.5 py-1 rounded-lg transition ${cameraView === 'left' ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-neutral-800 text-neutral-400'}`}
          title="المنظور الجانبي (Left)"
        >
          يسار
        </button>
        <button
          onClick={() => onCameraViewChange && onCameraViewChange('right')}
          className={`px-2.5 py-1 rounded-lg transition ${cameraView === 'right' ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-neutral-800 text-neutral-400'}`}
          title="المنظور الجانبي (Right)"
        >
          يمين
        </button>
        <button
          onClick={() => onCameraViewChange && onCameraViewChange('top')}
          className={`px-2.5 py-1 rounded-lg transition ${cameraView === 'top' ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-neutral-800 text-neutral-400'}`}
          title="المنظور العلوي (Top)"
        >
          أعلى
        </button>

        <div className="w-px h-4 bg-neutral-800 mx-1" />

        <button
          onClick={() => onCameraViewChange && onCameraViewChange('face')}
          className={`px-2 py-1 rounded-lg transition ${cameraView === 'face' ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-neutral-800 text-neutral-400'}`}
          title="تركيز الكاميرا على الوجه والرأس"
        >
          الوجه
        </button>
        <button
          onClick={() => onCameraViewChange && onCameraViewChange('feet')}
          className={`px-2 py-1 rounded-lg transition ${cameraView === 'feet' ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-neutral-800 text-neutral-400'}`}
          title="تركيز الكاميرا على الأحذية"
        >
          الأقدام
        </button>
        <button
          onClick={() => onCameraViewChange && onCameraViewChange('body')}
          className={`px-2 py-1 rounded-lg transition ${cameraView === 'body' ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-neutral-800 text-neutral-400'}`}
          title="تركيز الكاميرا على كامل الجسم"
        >
          كامل
        </button>
      </div>
    </div>
  );
}