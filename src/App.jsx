import React, { useState, useRef, useEffect } from 'react';
import PedViewer from './components/PedViewer';
import ClothingStudio from './components/ClothingStudio';
import FiveForgeSuite from './modules/fiveforge/components/FiveForgeSuite';
import { exportFiveMResource, exportBakedHeadTexturePng } from './utils/exportFivem';
import { handleUniversalFiveMFile, detectPedSlot } from './utils/fivemFormatParser';
import { 
  Sparkles, 
  Play, 
  Pause, 
  Download, 
  Sliders, 
  Shirt,
  Send, 
  RotateCcw,
  Cpu,
  Palette,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Activity,
  Sun,
  Eye,
  EyeOff,
  User,
  Shield,
  HelpCircle,
  Scissors,
  CheckCircle2,
  Box,
  Compass,
  Copy,
  FileCode,
  Check,
  FileUp
} from 'lucide-react';

// درجات ألوان البشرة الطبيعية المعتمدة
const skinTonePresets = [
  { id: 'natural', name: 'أصلي', color: '#ffffff', bg: '#ffffff', border: '#a3a3a3' },
  { id: 'fair', name: 'بيضاء', color: '#ffe2d1', bg: '#ffe2d1', border: '#fca5a5' },
  { id: 'warm', name: 'حنطية', color: '#f3cbb0', bg: '#f3cbb0', border: '#fdba74' },
  { id: 'tan', name: 'قمحية', color: '#d99f73', bg: '#d99f73', border: '#fb923c' },
  { id: 'bronze', name: 'برونزية', color: '#b57448', bg: '#b57448', border: '#ea580c' },
  { id: 'brown', name: 'سمراء', color: '#7b4829', bg: '#7b4829', border: '#9a3412' },
  { id: 'dark', name: 'داكنة', color: '#4d2a16', bg: '#4d2a16', border: '#7c2d12' },
  { id: 'zombie', name: 'زومبي', color: '#889882', bg: '#889882', border: '#4ade80' }
];

// تدرجات ألوان العيون المميزة
const eyeColorPresets = [
  { id: 'brown', name: 'بني طبيعي', color: '#4a3728' },
  { id: 'blue', name: 'أزرق جليدي', color: '#06b6d4' },
  { id: 'red', name: 'أحمر شيطاني', color: '#dc2626' },
  { id: 'yellow', name: 'أصفر ذئبي', color: '#eab308' },
  { id: 'green', name: 'أخضر زمردي', color: '#10b981' },
  { id: 'purple', name: 'بنفسجي غامض', color: '#9333ea' },
  { id: 'black', name: 'أسود دامس', color: '#18181b' },
];

export default function App() {
  // الحالات الافتراضية لأبعاد ومقاييس الجسم
  const initialMorphs = {
    height: 1.0,
    shoulders: 1.0,
    armMuscles: 1.0,
    bellyFat: 1.0,
    chest: 1.0,
    thighs: 1.0,
    faceFat: 1.0,
    head: 1.0,
    // تشوهات الوجه والجسم
    faceDistortion: 0.0,
    crookedNose: 0.0,
    jawTwist: 0.0,
    hunchback: 0.0,
    bodyAsymmetry: 0.0,
    grotesqueLumps: 0.0,
    // ملامح العيون، الجروح، والوشوم (Eyes, Wounds & Tattoos)
    eyeColorL: '#4a3728',     // لون العين اليسرى
    eyeColorR: '#4a3728',     // لون العين اليمنى
    blindEyeL: false,         // عين يسرى عمياء / بيضاء (Milky Cataract)
    blindEyeR: false,         // عين يمنى عمياء / بيضاء
    gougedEyeL: false,        // عين يسرى مفقوعة دامية (Gouged Socket with Blood)
    gougedEyeR: false,        // عين يمنى مفقوعة دامية
    faceTattoo: 0,            // 0: none, 1: Rawr under eye, 2: Teardrop & cross, 3: Neck script, 4: Bandaid
    faceScar: 0,              // 0: none, 1: Diagonal slash + stitches, 2: Zombie decay, 3: Lacerations
    // ميزة تشويه الوجه والضربات والشقوق العميقة ثلاثية الأبعاد (3D Facial Slash Trauma)
    faceSlashType: 0,         // 0: none, 1: ضربة ساطور غائرة, 2: شق خد قتال شوارع ممزق, 3: شقوق X متقاطعة, 4: تمزق الفك والشفة
    faceSlashDepth: 1.0,      // عمق التجويف والحفر ثلاثي الأبعاد (0.0 to 2.0)
    faceSlashFresh: 1.0,      // حالة الجرح (1.0 دم طازج لامع <---> 0.0 ندبة قديمة)
    faceSlashStitches: false, // غرز جراحية طبية على طول الشق
    stripShirt: false,        // تعرية البلوزة (صدر مكشوف)
    stripPants: false,        // تعرية السروال (أرجل مكشوفة / بوكسر)
    bodyTattoo: false,        // وشوم كاملة على الصدر والذراعين والأرجل
    bodyScar: false,          // ندبات وجروح على الصدر والأرجل
    clothingColor: '#ffffff',
    skinColor: '#ffffff',
    hideLeftArm: false,
    hideRightArm: false,
    hideLeftLeg: false,
    hideRightLeg: false,
    // إضافات خارجية تجميلية بأسلوب FiveForge (FiveForge 3D Cosmetic Addons)
    goldChain: false,
    diamondPendant: false,
    silverCross: false,
    luxuryWatch: false,
    tacticalVest: false,
    vestColor: '#18181b',
    vestPatch: 'lspd',
    thighHolster: false,
    shoulderRadio: false,
    dutyBelt: false,
    sunglasses: false,
    glassesTint: '#09090b',
    snapbackCap: false,
    capColor: '#1e1b4b',
    combatHelmet: false,
    balaclava: false,
    shemagh: false,
    shemaghColor: '#d4b996',
    tacticalBackpack: false,
    heistDuffleBag: false,
    propAttached: false,
    propType: 'katana',
    propBone: 'SKEL_Spine3',
    propOffsetX: 0.0,
    propOffsetY: 0.0,
    propOffsetZ: 0.0,
    propRotX: 0.0,
    propRotY: 0.0,
    propRotZ: 0.0,
    decalActive: false,
    decalPlacement: 'chest_left',
    decalMetallic: true,
    decalScale: 1.0
  };

  // التكسشرات الافتراضية الرسمية لفايف إم
  const defaultTextures = {
    head: { url: '/textures/freemode_base/head_diff_000_a_whi.png', name: 'head_diff_000_a_whi.png' },
    uppr: { url: '/textures/freemode_base/uppr_diff_000_a_whi.png', name: 'uppr_diff_000_a_whi.png' },
    lowr: { url: '/textures/freemode_base/lowr_diff_000_a_whi.png', name: 'lowr_diff_000_a_whi.png' },
    jbib: { url: '/textures/freemode_base/jbib_diff_000_a_uni.png', name: 'jbib_diff_000_a_uni.png' },
    feet: { url: '/textures/freemode_base/feet_diff_000_a_uni.png', name: 'feet_diff_000_a_uni.png' }
  };

  const [morphs, setMorphs] = useState(initialMorphs);
  useEffect(() => {
    window.__setMorphs = setMorphs;
  }, []);
  const [textures, setTextures] = useState(defaultTextures);
  const [visibility, setVisibility] = useState({
    head: true,
    uppr: true,
    lowr: true,
    jbib: true,
    feet: true
  });

  // إعدادات العرض والأدوات الشبيهة ببلندر
  const [shadingMode, setShadingMode] = useState('rendered'); // rendered, clay, wireframe
  const [lightingEnv, setLightingEnv] = useState('studio');   // studio, cinematic, night, daylight
  const [cameraView, setCameraView] = useState('front');
  const [walkStyle, setWalkStyle] = useState('casual');       // casual, gangster, jog, idle, combat, tpose
  const [animSpeed, setAnimSpeed] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);

  // التبويب النشط في القائمة الجانبية
  const [activeTab, setActiveTab] = useState('ai'); // ai, clothing, morphs, textures, motion
  const [showStandaloneSuite, setShowStandaloneSuite] = useState(
    typeof window !== 'undefined' && (
      window.location.search.includes('fiveforge=true') ||
      window.location.search.includes('tool=') ||
      window.location.search.includes('section=')
    )
  );
  useEffect(() => {
    window.__setActiveTab = setActiveTab;
    window.__setCameraView = setCameraView;
    window.__setShowStandaloneSuite = setShowStandaloneSuite;
  }, []);

  // إعدادات استوديو تفصيل وقص وتصميم الملابس (Custom Clothing Studio)
  const initialClothingPattern = {
    length: 78,          // cm (من 30 سم كروب توب إلى 110 سم تونيك طويل)
    width: 56,           // cm (من 35 سم ضيق إلى 90 سم واسع)
    sleeveLength: 28,    // cm (من 5 سم كتف إلى 80 سم كم كامل حتى المعصم)
    sleeveLengthL: 28,   // cm طول الكم الأيسر
    sleeveLengthR: 28,   // cm طول الكم الأيمن
    sleeveWidth: 40,     // cm (من 20 سم ضيق إلى 60 سم واسع)
    neckline: 28,        // cm (من 10 سم دائري ضيق إلى 45 سم سبعة عميقة)
    hemLeftOffset: 0,    // قصة مائلة غير متناظرة (مثل صورة 3)
    hemRightOffset: 0,
    hemFrontL: 0,        // يسار تحت أمامي
    hemFrontR: 0,        // يمين تحت أمامي
    hemBackL: 0,         // ورا تحت يسار
    hemBackR: 0,         // ورا تحت يمين
    shoulderL: 0,        // فوق يسار أمامي
    shoulderR: 0,        // يمين فوق أمامي
    backShoulderL: 0,    // ورا يسار فوق
    backShoulderR: 0,    // ورا يمين فوق
    waistL: 0,           // يسار وسط
    waistR: 0,           // يمين وسط
    fabric: 'knit',      // cotton, denim, silk, leather, knit
    color: '#ecc94b',    // أصفر الاستوديو المعتمد في الصور المرفقة
    detail: 'normal',    // fast, normal, fine
    showPed: true,
    showSeams: false,
    isDraping: false,
    isPaused: false
  };

  const [clothingPattern, setClothingPattern] = useState(initialClothingPattern);

  // إطلاق موجة الانسدال وإعادة الحياكة (Sew and drape)
  const triggerSewAndDrape = () => {
    setClothingPattern(prev => ({ ...prev, isDraping: true }));
    setTimeout(() => {
      setClothingPattern(prev => ({ ...prev, isDraping: false }));
    }, 1200);
  };

  // الذكاء الاصطناعي والمحادثة
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    { 
      role: 'ai', 
      text: 'مرحباً بك في FiveM Ped Studio! تم ضبط شخصية فايف إم الرسمية مع تكسشراتها الطبيعية الأصلية. يمكنك استيراد أي تكسشرات فايف إم (مثل مجلد freemode_base)، وتعديل طول وحجم عضلات وقوة الشخصية، وتجربة المشيات المتنوعة (مشية عصابات، هرولة، تنفس)، أو طلب أي تعديل عبر الذكاء الاصطناعي.' 
    }
  ]);

  // مراجع عناصر الإدخال المخفية
  const folderInputRef = useRef(null);
  const filesInputRef = useRef(null);
  const singleSlotInputRef = useRef(null);
  const targetSlotRef = useRef(null);

  // اختيار ملف موديل 3D
  const selectPedFile = async () => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('open-file-dialog');
        if (result) {
          window.dispatchEvent(new CustomEvent('load-ped-model', { detail: result }));
          setMessages((prev) => [...prev, { role: 'ai', text: `تم استيراد موديل الـ Ped: ${result.name} بنجاح!` }]);
        }
      } catch (err) {
        console.error("Electron dialog error", err);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.glb,.gltf,.obj';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.readAsArrayBuffer(file);
          reader.onload = (ev) => {
            window.dispatchEvent(new CustomEvent('load-ped-model', { 
              detail: { name: file.name, buffer: ev.target.result } 
            }));
            setMessages((prev) => [...prev, { role: 'ai', text: `تم استيراد موديل الـ Ped: ${file.name} بنجاح!` }]);
          };
        }
      };
      input.click();
    }
  };

  // استيراد مجلد تكسشرات فايف إم بالكامل (مثل مجلد freemode_base)
  const importTexturesFolder = async () => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const res = await ipcRenderer.invoke('open-textures-folder');
        if (res && res.files) {
          applyBatchTextureFiles(res.files);
          setMessages((prev) => [
            ...prev,
            { role: 'ai', text: `تم استيراد مجلد التكسشرات [${res.folderName}] بنجاح! تم فحص ${res.files.length} ملف وتركيب التكسشرات المطابقة.` }
          ]);
        }
      } catch (err) {
        console.error("Electron folder picker error", err);
      }
    } else {
      if (folderInputRef.current) {
        folderInputRef.current.click();
      }
    }
  };

  // استيراد ملفات تكسشر متعددة
  const importTextureFiles = async () => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const res = await ipcRenderer.invoke('open-texture-files');
        if (res && res.files) {
          applyBatchTextureFiles(res.files);
          setMessages((prev) => [
            ...prev,
            { role: 'ai', text: `تم استيراد وتطبيق ${res.files.length} ملف تكسشر بنجاح على مجسم فايف إم!` }
          ]);
        }
      } catch (err) {
        console.error("Electron files picker error", err);
      }
    } else {
      if (filesInputRef.current) {
        filesInputRef.current.click();
      }
    }
  };

  // تطبيق مجموعة ملفات تكسشر والتعرف على أجزاء فايف إم تلقائياً
  const applyBatchTextureFiles = (filesList) => {
    const updated = { ...textures };
    let matchedCount = 0;

    filesList.forEach((file) => {
      const name = file.name.toLowerCase();
      const url = file.dataUrl || file.url;

      if (!url) return;

      if (name.includes('head') || name.includes('face')) {
        updated.head = { url, name: file.name };
        matchedCount++;
      } else if (name.includes('uppr') || name.includes('arm') || name.includes('hand') || name.includes('body')) {
        updated.uppr = { url, name: file.name };
        matchedCount++;
      } else if (name.includes('lowr') || name.includes('pant') || name.includes('leg')) {
        updated.lowr = { url, name: file.name };
        matchedCount++;
      } else if (name.includes('jbib') || name.includes('shirt') || name.includes('jacket') || name.includes('top')) {
        updated.jbib = { url, name: file.name };
        matchedCount++;
      } else if (name.includes('feet') || name.includes('shoe')) {
        updated.feet = { url, name: file.name };
        matchedCount++;
      }
    });

    setTextures(updated);
  };

  // معالجة اختيار مجلد عبر متصفح الويب (Fallback)
  const handleWebFolderChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    const fileObjects = [];
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (['png', 'jpg', 'jpeg', 'webp', 'dds'].includes(ext)) {
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            fileObjects.push({ name: file.name, dataUrl: ev.target.result });
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
    }

    if (fileObjects.length > 0) {
      applyBatchTextureFiles(fileObjects);
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: `تم فحص وقراءة ${fileObjects.length} تكسشر من المجلد وتطبيقها على الشخصية بنجاح.` }
      ]);
    }
  };

  const [importedFiveMAssets, setImportedFiveMAssets] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [propModelName, setPropModelName] = useState('custom_ped_addon');
  const [copiedYtyp, setCopiedYtyp] = useState(false);
  const [fiveForgeSubTab, setFiveForgeSubTab] = useState('cosmetics');

  // معالجة استيراد كافة صيغ فايف إم الشاملة (.ytd, .ytt, .ydr, .ydd, .yft, .dds, .png, .jpg)
  const handleUniversalImport = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    let totalExtracted = 0;
    const batchTextures = [];
    const newAssets = [];

    for (const file of files) {
      try {
        const parsed = await handleUniversalFiveMFile(file);
        newAssets.push(parsed);

        if (parsed.allTextures && parsed.allTextures.length > 0) {
          for (const tex of parsed.allTextures) {
            batchTextures.push({
              name: tex.name,
              slot: tex.slot || detectPedSlot(tex.name),
              dataUrl: tex.dataUrl
            });
            totalExtracted++;
          }
        } else if (parsed.primaryTexture) {
          batchTextures.push({
            name: parsed.primaryTexture.name,
            slot: parsed.primaryTexture.slot || detectPedSlot(parsed.name),
            dataUrl: parsed.primaryTexture.dataUrl
          });
          totalExtracted++;
        }
      } catch (err) {
        console.error("Universal FiveM file parse error:", file.name, err);
      }
    }

    if (newAssets.length > 0) {
      setImportedFiveMAssets((prev) => [...prev, ...newAssets]);
    }

    if (batchTextures.length > 0) {
      applyBatchTextureFiles(batchTextures);
      setMessages((prev) => [
        ...prev,
        { 
          role: 'ai', 
          text: `⚡ نجح استيراد وقراءة ${totalExtracted} تكسشر من ملفات فايف إم (${files.map(f => f.name).join(', ')}) وتم فك ضغط قواميس YTD/YTT وتطبيقها على الشخصية بنجاح!` 
        }
      ]);
    }
  };

  // معالجة اختيار صور وملفات فايف إم متعددة
  const handleWebFilesChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;
    await handleUniversalImport(files);
  };

  // استبدال تكسشر جزء فردي محدد
  const promptSingleSlotTexture = (slotName) => {
    targetSlotRef.current = slotName;
    if (singleSlotInputRef.current) {
      singleSlotInputRef.current.click();
    }
  };

  const handleSingleSlotChange = async (e) => {
    const file = e.target.files[0];
    const slot = targetSlotRef.current;
    if (file && slot) {
      try {
        const res = await handleUniversalFiveMFile(file);
        if (res.primaryTexture) {
          setTextures((prev) => ({
            ...prev,
            [slot]: { url: res.primaryTexture.dataUrl, name: file.name }
          }));
          setMessages((prev) => [
            ...prev,
            { role: 'ai', text: `تم استبدال تكسشر [${slot}] من ملف فايف إم: ${file.name}` }
          ]);
        }
      } catch (err) {
        console.error("Single slot parse failed:", err);
      }
    }
  };

  // إعادة ضبط التكسشرات إلى الوضع الافتراضي لفايف إم
  const resetToDefaultTextures = () => {
    setTextures(defaultTextures);
    setMorphs((prev) => ({ ...prev, clothingColor: '#ffffff' }));
    setMessages((prev) => [
      ...prev,
      { role: 'ai', text: 'تمت استعادة تكسشرات فايف إم الرسمية الافتراضية بنجاح.' }
    ]);
  };

  // محرك الذكاء الاصطناعي لتفسير الأوامر الشاملة لفايف إم
  const runAiCommand = async (e) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || isLoading) return;

    const userText = inputVal.trim();
    setInputVal('');
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const systemPrompt = `
You are an expert FiveM Ped & 3D Character Studio modifier.
User request in Arabic: "${userText}".

Current App State:
- height: ${morphs.height} (Scale where 1.0 = 175cm. 0.88 = 155cm, 1.18 = 206cm)
- shoulders: ${morphs.shoulders} (Shoulders only, does NOT affect waist or belly)
- armMuscles: ${morphs.armMuscles} (Arm biceps/triceps muscles only)
- bellyFat: ${morphs.bellyFat} (Stomach/belly fat only, does NOT affect arms/shoulders)
- chest: ${morphs.chest} (Chest/ribs only)
- thighs: ${morphs.thighs} (Thighs/legs only)
- head: ${morphs.head}
- faceDistortion: ${morphs.faceDistortion || 0} (0.0 to 1.0, facial asymmetry, eye droop & flesh distortion)
- crookedNose: ${morphs.crookedNose || 0} (-1.0 to 1.0, broken / bent crooked nose)
- jawTwist: ${morphs.jawTwist || 0} (-1.0 to 1.0, wry / twisted jaw)
- hunchback: ${morphs.hunchback || 0} (0.0 to 1.0, hump on upper back & hunched neck)
- bodyAsymmetry: ${morphs.bodyAsymmetry || 0} (0.0 to 1.0, uneven shoulders / scoliosis)
- grotesqueLumps: ${morphs.grotesqueLumps || 0} (0.0 to 1.0, skin tumors/lumps)
- clothingColor: "${morphs.clothingColor}"
- hideLeftArm: ${morphs.hideLeftArm}
- hideRightArm: ${morphs.hideRightArm}
- hideLeftLeg: ${morphs.hideLeftLeg}
- hideRightLeg: ${morphs.hideRightLeg}
- walkStyle: "${walkStyle}" (Options: 'casual', 'gangster', 'jog', 'idle', 'combat', 'tpose')
- isPlaying: ${isPlaying}
- shadingMode: "${shadingMode}" (Options: 'rendered', 'clay', 'wireframe')
- lightingEnv: "${lightingEnv}" (Options: 'studio', 'cinematic', 'night', 'daylight')
- openFolderDialog: false
- exportAddon: false

Rules:
1. Parse Arabic height in cm (e.g. 190سم -> 190/175 = 1.08 scale).
2. If user mentions "دب" or "كرش" or "بطن" or "سمين": ONLY increase bellyFat = 1.35! Do NOT change shoulders or arms!
3. If user mentions "معضل اليد" or "عضلات اليد" or "باي": ONLY increase armMuscles = 1.30!
4. If user mentions "أكتاف" or "عرض الكتف": ONLY increase shoulders = 1.25!
5. If user mentions "معضل كامل" or "ضخم كامل": armMuscles = 1.25, shoulders = 1.20, chest = 1.20, thighs = 1.15.
6. If user mentions "نحيف" or "ضعيف": bellyFat = 0.90, armMuscles = 0.90, shoulders = 0.92.
7. Walking styles & Animations:
   - Gangster ("مشية عصابات", "هيبة", "باد بوي"): walkStyle = "gangster", isPlaying = true
   - Jog ("ركض", "سريع", "جري", "سبرنت"): walkStyle = "jog", isPlaying = true
   - Casual ("مشية عادية", "طبيعي", "مشية فايف ام", "انسيابية"): walkStyle = "casual", isPlaying = true
   - Dance ("رقص", "بارتي", "ديسكو", "دبكة"): walkStyle = "dance", isPlaying = true
   - Combat ("قتال", "ملاكمة", "تأهب", "لكمات"): walkStyle = "combat", isPlaying = true
   - Drunk ("سكران", "يترنح", "شارب"): walkStyle = "drunk", isPlaying = true
   - Squat ("سكوات", "تمرين", "رياضة"): walkStyle = "squat", isPlaying = true
   - Salute ("تحية", "عسكرية", "سلام"): walkStyle = "salute", isPlaying = true
   - Cheer ("تصفيق", "فرحان", "احتفال"): walkStyle = "cheer", isPlaying = true
   - Idle ("تنفس", "وقفة", "استراحة"): walkStyle = "idle", isPlaying = true
   - Zombie ("زومبي", "موتى سائرون", "وحش"): walkStyle = "zombie", isPlaying = true
   - Wave ("يلوح", "سلم", "اشر", "تحية باليد"): walkStyle = "wave", isPlaying = true
   - Guard ("حارس امن", "بودي جارد", "وقفة هيبة"): walkStyle = "guard", isPlaying = true
   - Sad ("حزين", "مكتئب", "محبط", "تعبان"): walkStyle = "sad", isPlaying = true
   - Model ("عارض ازياء", "مودل", "فاشن"): walkStyle = "model", isPlaying = true
   - Karate ("كاراتيه", "ركلات", "كونغ فو"): walkStyle = "karate", isPlaying = true
   - ANY custom requested animation: Pick or assign the most suitable animation style, isPlaying = true
   - TPose ("تي بوز", "مودلينج"): walkStyle = "tpose", isPlaying = false
8. Skin color:
   - "بشرة سمراء" -> skinColor = "#7b4829"
   - "بشرة داكنة" / "سوداء" -> skinColor = "#4d2a16"
   - "بشرة بيضاء" / "فاتحة" -> skinColor = "#ffe2d1"
   - "بشرة قمحية" / "حنطية" -> skinColor = "#d99f73"
   - "بشرة برونزية" -> skinColor = "#b57448"
   - "بشرة طبيعية" / "أصلية" -> skinColor = "#ffffff"
9. Amputations:
   - "احذف يده اليمين" / "قص اليد اليمنى" -> hideRightArm = true
   - "احذف يده اليسار" / "قص اليد اليسرى" -> hideLeftArm = true
   - "احذف رجله اليمين" -> hideRightLeg = true
   - "احذف رجله اليسار" -> hideLeftLeg = true
   - "رجع يدينه" / "استعد الأطراف" -> hideRightArm = false, hideLeftArm = false, hideRightLeg = false, hideLeftLeg = false
10. Deformities & Distortions (تشوهات الوجه والجسم):
   - "تشوه في الوجه" / "تشوهات الوجه" / "وجه مشوه": faceDistortion = 0.85, crookedNose = 0.70, jawTwist = 0.55
   - "أنف مكسور" / "انحراف الأنف" / "كسر بالخشم": crookedNose = 0.85
   - "فك معوج" / "انحراف الفك" / "التواء الفك": jawTwist = 0.75
   - "حدبة في الظهر" / "أحدب" / "تشوه الظهر": hunchback = 0.85
   - "تشوه في الجسم" / "كتف مشوه" / "عمود فقري مائل": bodyAsymmetry = 0.75, hunchback = 0.55
   - "كتل وأورام" / "وحش مشوه": grotesqueLumps = 0.80, faceDistortion = 0.65
   - "تشوهات كاملة مرعبة": faceDistortion = 0.90, crookedNose = 0.80, jawTwist = 0.75, hunchback = 0.85, bodyAsymmetry = 0.65, grotesqueLumps = 0.70
   - "عالج التشوهات" / "امسح التشوهات" / "وجه طبيعي" / "استعد الملامح": faceDistortion = 0.0, crookedNose = 0.0, jawTwist = 0.0, hunchback = 0.0, bodyAsymmetry = 0.0, grotesqueLumps = 0.0
11. Eyes, Wounds & Tattoos (العيون والجروح والوشوم):
   - "عين مفقوعة" / "افقع عينه" / "عين وحدة مفقوعة" -> gougedEyeL = true, gougedEyeR = false
   - "العينين مفقوعة" -> gougedEyeL = true, gougedEyeR = true
   - "عين بيضاء" / "عين عمياء" / "عين زومبي بيضاء" -> blindEyeL = true
   - "العينين بيضاء" / "أعمى" -> blindEyeL = true, blindEyeR = true
   - "غير لون العين" / "لون العين" (أحمر: #dc2626, أزرق: #06b6d4, أصفر: #eab308, أخضر: #10b981, بنفسجي: #9333ea, أسود: #18181b, بني/طبيعي: #4a3728)
   - "وشم تحت العين" / "وشم rawr" / "وشم وجه" -> faceTattoo = 1
   - "وشم دمعة" / "صليب تحت العين" -> faceTattoo = 2
   - "وشم رقبة" / "وشوم الرقبة" -> faceTattoo = 3
   - "لصقة جروح" / "لصقة خده" -> faceTattoo = 4
   - "وشم عنكبوت" / "سلك شائك" / "وشم سلك شائك" / "صليب عصابات" -> faceTattoo = 5
   - "وشم جمجمة" / "أسنان جمجمة" / "فك جمجمة" / "جمجمة الموت" -> faceTattoo = 6
   - "وشم خنجر" / "أرقام رومانية" / "خنجر تحت العين" -> faceTattoo = 7
   - "وشوم كثيرة" / "مليان وشوم" / "زيد الوشوم" / "وشوم عصابات كثيفة" -> faceTattoo = 8
   - "وشم الحاجب" / "وشم w.e.a" / "شق الحاجب" / "وشم الحنجرة" / "حلق الشفة" -> faceTattoo = 9
   - "وشم نجوم" / "نجوم على الوجه" / "نجوم الصدغ" / "وشم الرقبة الكامل" -> faceTattoo = 10
   - "وشم مهرج" / "خطوط العين" / "مهرج عصابات" -> faceTattoo = 11
   - "جرح قطعي" / "جرح على العين" / "خياطة" / "ندبة" -> faceScar = 1
   - "تعفن" / "جروح زومبي" / "لحم مكشوف" -> faceScar = 2
   - "خدوش" / "طعنات سكين" / "دم على الوجه" -> faceScar = 3
   - "حروق" / "حرق نار" / "تشوه أسيد" -> faceScar = 4
   - "فرانكنشتاين" / "خياطة كاملة" / "خياطة متعددة" -> faceScar = 5
   - "شظايا" / "طلقات" / "رصاصة" / "كدمات" -> faceScar = 6
   - "جروح كثيرة" / "مليان جروح" / "زيد الجروح" / "جروح معارك كثيفة" -> faceScar = 7
   - "زومبي أخضر" / "تشوه إشعاعي" / "عروق صفراء" / "زومبي متعفن أخضر" -> faceScar = 8
   - "دم كثيف" / "طعنات نجمية" / "دم على الذقن والرقبة" / "تشوه دموي" -> faceScar = 9
   - "ابتسامة غلاسكو" / "فم ممزق" / "ابتسامة الجوكر" -> faceScar = 10
   - "مليان وشوم وجروح" / "تشويه ووشوم كاملة" -> faceTattoo = 8, faceScar = 7
   - "امسح الوشم" -> faceTattoo = 0
   - "امسح الجروح" -> faceScar = 0
   - "رجع العيون طبيعية" -> gougedEyeL = false, gougedEyeR = false, blindEyeL = false, blindEyeR = false, eyeColorL = "#4a3728", eyeColorR = "#4a3728"
12. Stripping & Body Tattoos/Scars (تعرية الملابس، وشوم وندبات الجسم والرجول):
   - "افصخ البلوزة" / "افصخ البلوزه" / "صدر مكشوف" / "بدون بلوزة" / "شيل القميص" / "بدون قميص" -> stripShirt = true
   - "البس البلوزة" / "البس القميص" / "رجع البلوزة" -> stripShirt = false
   - "افصخ السروال" / "شيل السروال" / "بوكسر" / "ارجل مكشوفة" / "شورت" / "بدون بنطلون" -> stripPants = true
   - "البس السروال" / "البس البنطلون" / "رجع السروال" -> stripPants = false
   - "افصخ الملابس" / "بدون ملابس" / "عريان" / "افصخ كله" -> stripShirt = true, stripPants = true
   - "البس الملابس" / "رجع الملابس" -> stripShirt = false, stripPants = false
   - "وشم على الجسم" / "وشوم على الجسم والرجول" / "وشم الجسم" / "وشم الرجول" / "وشوم الصدر" -> bodyTattoo = true, stripShirt = true
   - "ندبات على الجسم" / "ندبات على الجسم والرجول" / "جروح على الصدر" / "ندبات الرجول" -> bodyScar = true, stripShirt = true
   - "امسح وشوم الجسم" -> bodyTattoo = false
   - "امسح ندبات الجسم" -> bodyScar = false
13. Shading: "كلاي" / "طين" / "نحت" -> shadingMode = "clay". "وايرفريم" / "شبكي" -> shadingMode = "wireframe". "واقعي" / "ملون" -> shadingMode = "rendered".
14. Return ONLY clean JSON without codeblocks:
{
  "height": number,
  "shoulders": number,
  "armMuscles": number,
  "bellyFat": number,
  "chest": number,
  "thighs": number,
  "faceFat": number,
  "head": number,
  "faceDistortion": number,
  "crookedNose": number,
  "jawTwist": number,
  "hunchback": number,
  "bodyAsymmetry": number,
  "grotesqueLumps": number,
  "eyeColorL": "HEX",
  "eyeColorR": "HEX",
  "blindEyeL": boolean,
  "blindEyeR": boolean,
  "gougedEyeL": boolean,
  "gougedEyeR": boolean,
  "faceTattoo": number,
  "faceScar": number,
  "stripShirt": boolean,
  "stripPants": boolean,
  "bodyTattoo": boolean,
  "bodyScar": boolean,
  "skinColor": "HEX",
  "clothingColor": "HEX",
  "hideLeftArm": boolean,
  "hideRightArm": boolean,
  "hideLeftLeg": boolean,
  "hideRightLeg": boolean,
  "walkStyle": "casual"|"gangster"|"jog"|"dance"|"combat"|"drunk"|"squat"|"salute"|"cheer"|"idle"|"zombie"|"wave"|"guard"|"sad"|"model"|"karate"|"tpose",
  "isPlaying": boolean,
  "shadingMode": "rendered"|"clay"|"wireframe",
  "lightingEnv": "studio"|"cinematic"|"night"|"daylight",
  "openFolderDialog": boolean,
  "exportAddon": boolean,
  "reply": "Arabic explanation message"
}
`;

      let data = null;

      // محاولة استدعاء Gemini عبر Node.js في Electron أو Fetch
      if (window.require) {
        try {
          const { ipcRenderer } = window.require('electron');
          const res = await ipcRenderer.invoke('ask-gemini', systemPrompt);
          let rawText = res?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          data = JSON.parse(rawText);
        } catch (e) {
          console.warn("Electron Gemini error, falling back:", e);
        }
      }

      if (!data) {
        // المعالج المحلي الذكي والشامل لكل أوامر وأنيميشن فايف إم
        const query = userText.toLowerCase();
        let updatedMorphs = { ...morphs };
        let updatedWalk = walkStyle;
        let updatedPlaying = isPlaying;
        let updatedShading = shadingMode;
        let updatedLighting = lightingEnv;
        let reply = "تم تحليل طلبك وتطبيق التعديل على الشخصية فوراً.";

        // 1. أوامر المشي والأنيميشن الشاملة لفايف إم
        if (query.includes('زومبي') || query.includes('موتى') || query.includes('وحش') || query.includes('zombie')) {
          updatedWalk = 'zombie';
          updatedPlaying = true;
          reply = "تم تفعيل مشية الزومبي المرعبة (Zombie Walk) مع مد الذراعين للأمام والترنح.";
        } else if (query.includes('لوح') || query.includes('يلوح') || query.includes('سلم باليد') || query.includes('سلام باليد') || query.includes('اشر') || query.includes('wave')) {
          updatedWalk = 'wave';
          updatedPlaying = true;
          reply = "تم تفعيل أنيميشن التلويح والترحيب باليد اليمنى (Wave Hello).";
        } else if (query.includes('حارس') || query.includes('امن') || query.includes('بودي جارد') || query.includes('guard')) {
          updatedWalk = 'guard';
          updatedPlaying = true;
          reply = "تم تفعيل وقفة حارس الأمن والهيبة وتشبيك اليدين (Security Guard).";
        } else if (query.includes('حزين') || query.includes('محبط') || query.includes('مكتئب') || query.includes('تعبان') || query.includes('sad')) {
          updatedWalk = 'sad';
          updatedPlaying = true;
          reply = "تم تفعيل أنيميشن المشية الحزينة والمحبطة مع انحناء القامة وثقل الخطوات.";
        } else if (query.includes('عارض') || query.includes('مودل') || query.includes('فاشن') || query.includes('model') || query.includes('كت ووك')) {
          updatedWalk = 'model';
          updatedPlaying = true;
          reply = "تم تفعيل مشية عارض الأزياء الانسيابية وتمايل الحوض الأنيق (Runway Fashion Walk).";
        } else if (query.includes('كاراتيه') || query.includes('ركلات') || query.includes('ركل') || query.includes('شوت') || query.includes('كونغ فو') || query.includes('karate')) {
          updatedWalk = 'karate';
          updatedPlaying = true;
          reply = "تم تفعيل أنيميشن الركلات والفنون القتالية المتناوبة (Martial Arts / High Kicks).";
        } else if (query.includes('رقص') || query.includes('بارتي') || query.includes('ديسكو') || query.includes('دبكة') || query.includes('dance')) {
          updatedWalk = 'dance';
          updatedPlaying = true;
          reply = "تم تفعيل أنيميشن الرقص والاحتفال (Party Dance & Dabke) للشخصية.";
        } else if (query.includes('سكران') || query.includes('يترنح') || query.includes('شارب') || query.includes('drunk') || query.includes('تسكير')) {
          updatedWalk = 'drunk';
          updatedPlaying = true;
          reply = "تم تفعيل أنيميشن مشية السكران والترنح الواقعي (Drunk Stagger).";
        } else if (query.includes('سكوات') || query.includes('تمرين') || query.includes('رياضة') || query.includes('squat')) {
          updatedWalk = 'squat';
          updatedPlaying = true;
          reply = "تم تفعيل أنيميشن تمرين السكوات الرياضي الكامل (Fitness Squats).";
        } else if (query.includes('تحية') || query.includes('عسكرية') || query.includes('سلام') || query.includes('salute')) {
          updatedWalk = 'salute';
          updatedPlaying = true;
          reply = "تم تفعيل وقفة الانضباط والتحية العسكرية الرسمية (Military Salute).";
        } else if (query.includes('تصفيق') || query.includes('فرحان') || query.includes('احتفال') || query.includes('حماس') || query.includes('cheer')) {
          updatedWalk = 'cheer';
          updatedPlaying = true;
          reply = "تم تفعيل أنيميشن التصفيق والاحتفال الحماسي (Cheer & Clapping).";
        } else if (query.includes('عصابات') || query.includes('هيبة') || query.includes('باد بوي')) {
          updatedWalk = 'gangster';
          updatedPlaying = true;
          reply = "تم تفعيل مشية العصابات والهيبة (Gangster Swagger) للشخصية.";
        } else if (query.includes('ركض') || query.includes('جري') || query.includes('سريع') || query.includes('يهرول') || query.includes('سبرنت')) {
          updatedWalk = 'jog';
          updatedPlaying = true;
          reply = "تم تفعيل حركة الهرولة والجري السريع للشخصية.";
        } else if (query.includes('مشي') || query.includes('يمشي') || query.includes('طبيعي') || query.includes('انسيابي') || query.includes('فايف ام') || query.includes('عادية')) {
          updatedWalk = 'casual';
          updatedPlaying = true;
          reply = "تم تفعيل مشية فايف إم الطبيعية مع انسيابية كاملة للأرجل والأذرع وثني ركب واقعي.";
        } else if (query.includes('تنفس') || query.includes('استراحة') || query.includes('وقفة') || query.includes('هدوء')) {
          updatedWalk = 'idle';
          updatedPlaying = true;
          reply = "تم تفعيل وضع التنفس والوقفة الحية الطبيعية.";
        } else if (query.includes('قتال') || query.includes('ملاكمة') || query.includes('تأهب') || query.includes('بوكسينغ') || query.includes('لكمات')) {
          updatedWalk = 'combat';
          updatedPlaying = true;
          reply = "تم تفعيل الوقفة القتالية واللكمات وتأهب الملاكمة.";
        } else if (query.includes('تي بوز') || query.includes('t-pose') || query.includes('tpose') || query.includes('مودلينج')) {
          updatedWalk = 'tpose';
          updatedPlaying = false;
          reply = "تمت العودة إلى وضعية T-Pose المرجعية.";
        } else if (query.includes('انميشن') || query.includes('أنيميشن') || query.includes('حركة') || query.includes('سوي') || query.includes('سو')) {
          // استجابة ذكية فورية لأي طلب أنيميشن مفتوح
          let matched = 'casual';
          if (query.includes('سباح') || query.includes('swim')) matched = 'jog';
          else if (query.includes('خوف') || query.includes('رعب')) matched = 'sad';
          else if (query.includes('روبوت')) matched = 'gangster';
          else matched = 'casual';

          updatedWalk = matched;
          updatedPlaying = true;
          reply = `تم توليد وتفعيل أنيميشن حركي مخصص لطلبك (${userText}) بنجاح!`;
        } else if (query.includes('شغل') && query.includes('حركة')) {
          updatedPlaying = true;
          reply = "تم تشغيل الأنيميشن.";
        } else if (query.includes('وقف') && query.includes('حركة')) {
          updatedPlaying = false;
          reply = "تم إيقاف الأنيميشن.";
        }

        // أوامر لون البشرة
        if (query.includes('بشرة') || query.includes('جلد') || query.includes('لون')) {
          if (query.includes('سمراء') || query.includes('أسمر') || query.includes('اسمر')) {
            updatedMorphs.skinColor = '#7b4829';
            reply = "تم تغيير لون البشرة إلى الدرجة السمراء الدافئة.";
          } else if (query.includes('داكن') || query.includes('اسود') || query.includes('سوداء')) {
            updatedMorphs.skinColor = '#4d2a16';
            reply = "تم تغيير لون البشرة إلى الدرجة الداكنة العميقة.";
          } else if (query.includes('قمحي') || query.includes('حنطي')) {
            updatedMorphs.skinColor = '#d99f73';
            reply = "تم تغيير لون البشرة إلى الدرجة القمحية/الحنطية الطبيعية.";
          } else if (query.includes('برونزي') || query.includes('تان')) {
            updatedMorphs.skinColor = '#b57448';
            reply = "تم تغيير لون البشرة إلى الدرجة البرونزية.";
          } else if (query.includes('ابيض') || query.includes('بيضاء') || query.includes('فاتح')) {
            updatedMorphs.skinColor = '#ffe2d1';
            reply = "تم تغيير لون البشرة إلى الدرجة البيضاء الفاتحة.";
          } else if (query.includes('اصلي') || query.includes('افتراضي') || query.includes('طبيعي')) {
            updatedMorphs.skinColor = '#ffffff';
            reply = "تمت استعادة لون البشرة الأصلي للتكسشر.";
          }
        }

        // 2. أوامر الطول بالسنتيمتر والمقاييس
        if (query.match(/\d+/)) {
          const cm = parseInt(query.match(/\d+/)[0], 10);
          if (cm >= 150 && cm <= 210) {
            updatedMorphs.height = parseFloat((cm / 175).toFixed(2));
            reply = `تم ضبط طول الشخصية على مقاس (${cm} سم) بنجاح.`;
          }
        } else if (query.includes('عملاق') || query.includes('طويل') || query.includes('طول')) {
          updatedMorphs.height = 1.12;
          reply = "تمت زيادة طول قامة الشخصية بشكل واقعي.";
        } else if (query.includes('قزم') || query.includes('قصير') || query.includes('قصر')) {
          updatedMorphs.height = 0.90;
          reply = "تم تقصير قامة الشخصية بشكل واقعي.";
        }

        // 3. أوامر العضلات والضخامة والبطن "دب"
        if (query.includes('دب') || query.includes('كرش') || query.includes('بطن') || query.includes('سمين')) {
          if (query.includes('كامل') || query.includes('كله') || query.includes('واقعي') || query.includes('دب')) {
            updatedMorphs.bellyFat = 1.68;
            updatedMorphs.faceFat = 1.45;
            updatedMorphs.thighs = 1.30;
            updatedMorphs.chest = 1.25;
            updatedMorphs.shoulders = 1.20;
            reply = "تم تحويل الشخصية إلى بنية دب كامل متناسق وواقعي (كرش ضخم بارز للأمام، تدوير الوجه وتسمين الخدود كالدب، قفص صدري برميلي، وفخذين وأكتاف عريضة).";
          } else {
            updatedMorphs.bellyFat = 1.62;
            reply = "تم تضخيم عظم وبروز البطن ('كرش واقعي') للأمام وتوسيع الخصر بشكل واقعي.";
          }
        } else if (query.includes('وجه') && (query.includes('دب') || query.includes('سمين') || query.includes('خدود') || query.includes('لغلوغ'))) {
          updatedMorphs.faceFat = 1.55;
          reply = "تم تسمين الخدود وتدوير الوجه وإضافة لغلوغ وذقن كالدب.";
        } else if (query.includes('معضل اليد') || query.includes('عضلات اليد') || query.includes('باي') || query.includes('تراي') || query.includes('ذراع')) {
          updatedMorphs.armMuscles = 1.30;
          reply = "تم تضخيم عضلات اليدين والذراعين فقط دون تغيير البطن أو الأكتاف.";
        } else if (query.includes('أكتاف') || query.includes('اكتاف') || query.includes('كتف')) {
          updatedMorphs.shoulders = 1.25;
          reply = "تم توسيع عظام الأكتاف فقط دون المساس بالخصر أو البطن.";
        } else if (query.includes('صدر')) {
          updatedMorphs.chest = 1.25;
          reply = "تم تضخيم وبروز عضلات الصدر فقط.";
        } else if (query.includes('فخذ') || query.includes('ارجل') || query.includes('أرجل')) {
          updatedMorphs.thighs = 1.20;
          reply = "تم تضخيم عضلات الفخذين فقط.";
        } else if (query.includes('معضل') || query.includes('ضخم') || query.includes('كمال أجسام')) {
          updatedMorphs.armMuscles = 1.25;
          updatedMorphs.shoulders = 1.20;
          updatedMorphs.chest = 1.20;
          updatedMorphs.thighs = 1.15;
          reply = "تم تضخيم عضلات اليدين والأكتاف والصدر بشكل متناسق.";
        } else if (query.includes('نحف') || query.includes('ضعيف') || query.includes('سمبتيك')) {
          updatedMorphs.bellyFat = 0.88;
          updatedMorphs.armMuscles = 0.90;
          updatedMorphs.shoulders = 0.92;
          reply = "تم تنحيف قوام وعضلات الشخصية.";
        }

        // 4. أوامر تشوهات الوجه والجسم المتقدمة (Facial & Body Deformities)
        if (query.includes('تشوه') || query.includes('مشوه') || query.includes('عوج') || query.includes('انحراف') || query.includes('كسر') || query.includes('احدب') || query.includes('أحدب') || query.includes('حدبة') || query.includes('ورم') || query.includes('اورام') || query.includes('أورام')) {
          if (query.includes('عالج') || query.includes('طبيعي') || query.includes('امسح') || query.includes('إزالة') || query.includes('ازالة') || query.includes('رجع')) {
            updatedMorphs.faceDistortion = 0.0;
            updatedMorphs.crookedNose = 0.0;
            updatedMorphs.jawTwist = 0.0;
            updatedMorphs.hunchback = 0.0;
            updatedMorphs.bodyAsymmetry = 0.0;
            updatedMorphs.grotesqueLumps = 0.0;
            reply = "تمت إزالة كافة التشوهات واستعادة الملامح الطبيعية السليمة للشخصية.";
          } else if (query.includes('وجه') || query.includes('ملامح') || query.includes('عين') || query.includes('خد')) {
            updatedMorphs.faceDistortion = 0.85;
            updatedMorphs.crookedNose = 0.70;
            updatedMorphs.jawTwist = 0.55;
            reply = "تم تطبيق تشوهات واقعية في ملامح الوجه (عدم تناسق الخدين، تدلي العين، كسر الأنف، والتواء الفك).";
          } else if (query.includes('انف') || query.includes('أنف') || query.includes('خشم')) {
            updatedMorphs.crookedNose = 0.85;
            reply = "تم تطبيق كسر وانحراف حاد في عظمة الأنف.";
          } else if (query.includes('فك')) {
            updatedMorphs.jawTwist = 0.75;
            reply = "تم تطبيق اعوجاج والتواء حاد في عظام الفك السفلي.";
          } else if (query.includes('حدبة') || query.includes('أحدب') || query.includes('احدب') || query.includes('ظهر')) {
            updatedMorphs.hunchback = 0.85;
            reply = "تم تكوين حدبة كبيرة في أعلى الظهر مع انحناء الرقبة والرأس للأمام.";
          } else if (query.includes('جسم') || query.includes('كتف') || query.includes('عمود فقري')) {
            updatedMorphs.bodyAsymmetry = 0.75;
            updatedMorphs.hunchback = 0.55;
            reply = "تم تطبيق تشوه وعدم تناسق في الجذع وميلان الأكتاف (Scoliosis).";
          } else if (query.includes('ورم') || query.includes('اورام') || query.includes('أورام') || query.includes('كتل') || query.includes('وحش')) {
            updatedMorphs.grotesqueLumps = 0.80;
            updatedMorphs.faceDistortion = 0.70;
            reply = "تم إنشاء كتل وأورام جلدية مشوهة وبارزة على الجسم والوجه.";
          } else {
            updatedMorphs.faceDistortion = 0.80;
            updatedMorphs.crookedNose = 0.65;
            updatedMorphs.jawTwist = 0.50;
            reply = "تم تطبيق تشوهات واقعية في ملامح الوجه.";
          }
        }

        // 5. أوامر بتر واستعادة الأطراف
        if (query.includes('قص') || query.includes('احذف') || query.includes('شيل') || query.includes('بتر')) {
          if (query.includes('يمين') || query.includes('يمنى')) {
            if (query.includes('رجل') || query.includes('ساق')) {
              updatedMorphs.hideRightLeg = true;
              reply = "تم بتر الساق اليمنى للشخصية.";
            } else {
              updatedMorphs.hideRightArm = true;
              reply = "تم بتر وإخفاء اليد اليمنى مع وضع سدادة جراحية واقعية.";
            }
          } else if (query.includes('يسار') || query.includes('يسرى')) {
            if (query.includes('رجل') || query.includes('ساق')) {
              updatedMorphs.hideLeftLeg = true;
              reply = "تم بتر الساق اليسرى للشخصية.";
            } else {
              updatedMorphs.hideLeftArm = true;
              reply = "تم بتر وإخفاء اليد اليسرى مع وضع سدادة جراحية واقعية.";
            }
          }
        } else if (query.includes('رجع') || query.includes('استعد')) {
          updatedMorphs.hideRightArm = false;
          updatedMorphs.hideLeftArm = false;
          updatedMorphs.hideRightLeg = false;
          updatedMorphs.hideLeftLeg = false;
          reply = "تمت استعادة كافة الأطراف الطبيعية للشخصية.";
        }

        // 5. أوامر تفاصيل العيون والجروح والوشوم (Eyes, Wounds, Tattoos & Gouged Eyes)
        // أ. العين المفقوعة (Gouged Eye)
        if (query.includes('مفقوع') || query.includes('افقع') || query.includes('فقء') || query.includes('مقلوعة') || query.includes('مفقوء')) {
          if (query.includes('يمين') || query.includes('يمنى')) {
            updatedMorphs.gougedEyeR = true;
            updatedMorphs.blindEyeR = false;
            reply = "تم تطبيق تجويف عين يمنى مفقوعة غائرة مع سيلان خطوط دماء متخثرة على الخد وتجويف عظمي هابط للداخل.";
          } else if (query.includes('يسار') || query.includes('يسرى')) {
            updatedMorphs.gougedEyeL = true;
            updatedMorphs.blindEyeL = false;
            reply = "تم تطبيق تجويف عين يسرى مفقوعة غائرة مع سيلان خطوط دماء متخثرة على الخد وتجويف عظمي هابط للداخل.";
          } else if (query.includes('عينين') || query.includes('العينين') || query.includes('الاثنين') || query.includes('اثنتين')) {
            updatedMorphs.gougedEyeL = true;
            updatedMorphs.gougedEyeR = true;
            updatedMorphs.blindEyeL = false;
            updatedMorphs.blindEyeR = false;
            reply = "تم فقع وتجويف كلتا العينين مع سيلان دموي وتجويف المحجرين عظمياً.";
          } else {
            updatedMorphs.gougedEyeL = true;
            updatedMorphs.blindEyeL = false;
            reply = "تم تطبيق تجويف عين مفقوعة غائرة مع سيلان دماء واقعي على الخد وتجويف عظمي للداخل.";
          }
        }

        // ب. العين العمياء / البيضاء (Blind Cataract White Eye - كالصورة 2)
        if (query.includes('عين بيضاء') || query.includes('عين عمياء') || query.includes('عين زومبي') || query.includes('اعمى') || query.includes('أعمى') || query.includes('ساد')) {
          if (query.includes('يمين') || query.includes('يمنى')) {
            updatedMorphs.blindEyeR = true;
            updatedMorphs.gougedEyeR = false;
            reply = "تم تطبيق عين يمنى بيضاء عمياء (Milky White Cataract) مع غشاوة وبؤبؤ باهت.";
          } else if (query.includes('يسار') || query.includes('يسرى')) {
            updatedMorphs.blindEyeL = true;
            updatedMorphs.gougedEyeL = false;
            reply = "تم تطبيق عين يسرى بيضاء عمياء (Milky White Cataract) تماماً كالصورة المرفقة.";
          } else if (query.includes('عينين') || query.includes('العينين') || query.includes('الاثنين') || query.includes('كلتا')) {
            updatedMorphs.blindEyeL = true;
            updatedMorphs.blindEyeR = true;
            updatedMorphs.gougedEyeL = false;
            updatedMorphs.gougedEyeR = false;
            reply = "تم تحويل كلتا العينين إلى عيون عمياء بيضاء بالكامل.";
          } else {
            updatedMorphs.blindEyeL = true;
            updatedMorphs.gougedEyeL = false;
            reply = "تم تحويل العين اليسرى إلى عين بيضاء عمياء كالصورة المرفقة.";
          }
        }

        // ج. تغيير ألوان العيون (Eye Color Customizer)
        if (query.includes('لون العين') || query.includes('لون عين') || query.includes('عيون') || query.includes('عين')) {
          let targetColor = null;
          let colorName = '';
          if (query.includes('احمر') || query.includes('أحمر') || query.includes('شيطان') || query.includes('دموي')) {
            targetColor = '#dc2626'; colorName = 'الأحمر الشيطاني الدموي';
          } else if (query.includes('ازرق') || query.includes('أزرق') || query.includes('جليد') || query.includes('سماوي')) {
            targetColor = '#06b6d4'; colorName = 'الأزرق الجليدي المتوهج';
          } else if (query.includes('اصفر') || query.includes('أصفر') || query.includes('ذئب') || query.includes('ذهبي')) {
            targetColor = '#eab308'; colorName = 'الأصفر الذئبي المتوحش';
          } else if (query.includes('اخضر') || query.includes('أخضر') || query.includes('زمرد')) {
            targetColor = '#10b981'; colorName = 'الأخضر الزمردي';
          } else if (query.includes('بنفسج') || query.includes('ارجوان')) {
            targetColor = '#9333ea'; colorName = 'البنفسجي الغامض';
          } else if (query.includes('اسود') || query.includes('أسود') || query.includes('داكن')) {
            targetColor = '#18181b'; colorName = 'الأسود الدامس الكامل';
          } else if (query.includes('بني') || query.includes('عسلي') || query.includes('طبيعي') || query.includes('اصلي')) {
            targetColor = '#4a3728'; colorName = 'البني الطبيعي الأصلي';
          }

          if (targetColor) {
            if (query.includes('يمين') || query.includes('يمنى')) {
              updatedMorphs.eyeColorR = targetColor;
              reply = `تم تغيير لون العين اليمنى إلى ${colorName}.`;
            } else if (query.includes('يسار') || query.includes('يسرى')) {
              updatedMorphs.eyeColorL = targetColor;
              reply = `تم تغيير لون العين اليسرى إلى ${colorName}.`;
            } else {
              updatedMorphs.eyeColorL = targetColor;
              updatedMorphs.eyeColorR = targetColor;
              reply = `تم تغيير لون كلتا العينين إلى ${colorName}.`;
            }
          }
        }

        // د. وشوم الوجه والرقبة (Face & Neck Tattoos)
        if (query.includes('وشم') || query.includes('تاتو') || query.includes('وشوم') || query.includes('لصقة') || query.includes('حاجب') || query.includes('نجوم') || query.includes('مهرج')) {
          if (query.includes('امسح') || query.includes('احذف') || query.includes('ازالة') || query.includes('إزالة') || query.includes('بدون')) {
            updatedMorphs.faceTattoo = 0;
            reply = "تمت إزالة ومسح كافة وشوم الوجه والرقبة.";
          } else if (query.includes('حاجب') || query.includes('w.e.a') || query.includes('حنجرة') || query.includes('حلق الشفة')) {
            updatedMorphs.faceTattoo = 9;
            reply = "تم تطبيق وشم الحاجبين القوطي (w.e.a) مع شق الحاجب المزدوج، دمعتين تحت العين، حلق الشفة المعدني، ووشم الحنجرة الأمامي!";
          } else if (query.includes('نجوم') || query.includes('صدغ') || query.includes('رقبة كامل')) {
            updatedMorphs.faceTattoo = 10;
            reply = "تم تطبيق وشم نجوم الصدغ الخماسية المتدرجة، الكتابة القوطية المقوسة فوق الحاجب، الدمعة، وطوق وشم الرقبة الكامل الكثيف!";
          } else if (query.includes('مهرج') || query.includes('خطوط العين') || query.includes('كلاون')) {
            updatedMorphs.faceTattoo = 11;
            reply = "تم تطبيق وشم المهرج العصابات (Chicano Clown) مع خطوط العيون الرأسية المدببة ومخطوطات الوجنتين!";
          } else if (query.includes('كثير') || query.includes('مليان') || query.includes('كامل') || query.includes('عصابات') || query.includes('زيد الوشوم') || query.includes('وشم عصابات')) {
            updatedMorphs.faceTattoo = 8;
            reply = "تم تطبيق حزمة وشوم العصابات الكاملة الكثيفة: كتابات قوطية مقوسة على الجبين، سلك شائك، خنجر، دمعة ونقاط عصابات، وطوق رقبة قوطي كامل!";
          } else if (query.includes('سلك شائك') || query.includes('شائك') || query.includes('اسلاك') || query.includes('عنكبوت') || query.includes('شبكة')) {
            updatedMorphs.faceTattoo = 5;
            reply = "تم رسم وشم سلك شائك عصابات مجدول وصليب قوطي دقيق على الصدغ والجبين.";
          } else if (query.includes('جمجمة') || query.includes('اسنان') || query.includes('أسنان') || query.includes('فك')) {
            updatedMorphs.faceTattoo = 6;
            reply = "تم رسم وشم فك وأسنان جمجمة الموت الواقعي مع فواصل الأسنان وتجويف الخد الهيكلي.";
          } else if (query.includes('خنجر') || query.includes('سيف') || query.includes('لاتين') || query.includes('رومان')) {
            updatedMorphs.faceTattoo = 7;
            reply = "تم رسم خنجر عصابات عمودي مغروس تحت العين وأرقام رومانية XIII.";
          } else if (query.includes('رقبة') || query.includes('رقبه') || query.includes('حلق')) {
            updatedMorphs.faceTattoo = 3;
            reply = "تم تطبيق وشم الرقبة القوطي الممتد على الحلق والرقبة بالكامل.";
          } else if (query.includes('دمعة') || query.includes('صليب')) {
            updatedMorphs.faceTattoo = 2;
            reply = "تم تطبيق وشم دمعة العصابات وصليب قوطي تحت العين.";
          } else if (query.includes('لصقة') || query.includes('بلاستر') || query.includes('ضمادة')) {
            updatedMorphs.faceTattoo = 4;
            reply = "تم وضع لصقة جروح طبية واقعية ثلاثية الأبعاد على الخد.";
          } else {
            updatedMorphs.faceTattoo = 1;
            reply = "تم رسم وشم قوطي مقوس ('Rawr..') تحت العين اليسرى على عظمة الوجنة.";
          }
        }

        // هـ. الجروح والندبات والتعفن (Facial Scars & Wounds)
        if (query.includes('جرح') || query.includes('جروح') || query.includes('ندبة') || query.includes('ندبات') || query.includes('خياطة') || query.includes('سكين') || query.includes('طعن') || query.includes('دم') || query.includes('تعفن') || query.includes('حروق') || query.includes('حرق') || query.includes('شظايا') || query.includes('فرانكنشتاين') || query.includes('زومبي اخضر') || query.includes('زومبي أخضر') || query.includes('إشعاعي') || query.includes('نجمية') || query.includes('غلاسكو') || query.includes('جوكر')) {
          if (query.includes('امسح') || query.includes('عالج') || query.includes('ازالة') || query.includes('إزالة') || query.includes('طبيعي')) {
            updatedMorphs.faceScar = 0;
            reply = "تمت معالجة وإزالة كافة جروح وندبات الوجه.";
          } else if (query.includes('اخضر') || query.includes('أخضر') || query.includes('إشعاعي') || query.includes('اشعاعي') || query.includes('عروق صفراء')) {
            updatedMorphs.faceScar = 8;
            reply = "تم تطبيق تشوه الزومبي الإشعاعي الأخضر مع العروق الصفراء والبرتقالية المتوهجة ومحاجر العيون الغائرة المحمرة!";
          } else if (query.includes('نجمية') || query.includes('نجمي') || query.includes('دم كثيف') || query.includes('ذقن')) {
            updatedMorphs.faceScar = 9;
            reply = "تم تطبيق التشوه الدموي الكثيف على الجبين والوجنتين وسيلان الدماء على الذقن مع الطعنات النجمية الدامية على الرقبة والحنجرة!";
          } else if (query.includes('غلاسكو') || query.includes('جوكر') || query.includes('فم ممزق')) {
            updatedMorphs.faceScar = 10;
            reply = "تم تطبيق تشوه ابتسامة غلاسكو الممزقة مع الغرز المتقاطعة وجرح جسر الأنف!";
          } else if (query.includes('كثير') || query.includes('مليان') || query.includes('كامل') || query.includes('معارك') || query.includes('زيد الجروح')) {
            updatedMorphs.faceScar = 7;
            reply = "تم تطبيق جروح المعارك الكثيفة الشاملة: ضربات سكين متعددة وخياطة جراحية وكدمات وشظايا تملأ الوجه بالكامل!";
          } else if (query.includes('حرق') || query.includes('حروق') || query.includes('اسيد') || query.includes('أسيد') || query.includes('نار')) {
            updatedMorphs.faceScar = 4;
            reply = "تم تطبيق حروق وتسلخات نارية وأسيد غائرة من الدرجة الثالثة مع تندبات جلدية متصلبة.";
          } else if (query.includes('فرانكنشتاين') || query.includes('غرز متعددة') || query.includes('خياطة كاملة')) {
            updatedMorphs.faceScar = 5;
            reply = "تم تطبيق خياطة فرانكنشتاين الطبية بجروح متعددة وغرز سلكية سميكة عبر الجبهة والأنف والخد.";
          } else if (query.includes('شظايا') || query.includes('طلقات') || query.includes('رصاصة') || query.includes('كدمات')) {
            updatedMorphs.faceScar = 6;
            reply = "تم تطبيق شظايا انفجار وأخدود رصاصة كاشطة وكدمات دموية على الوجه.";
          } else if (query.includes('تعفن') || query.includes('زومبي') || query.includes('لحم مكشوف')) {
            updatedMorphs.faceScar = 2;
            reply = "تم تطبيق بقع تعفن وجروح زومبي ولحم متآكل متقيح وعروق عنكبوتية مسمومة.";
          } else if (query.includes('خدوش') || query.includes('طعنات') || query.includes('مخالب') || query.includes('سكين')) {
            updatedMorphs.faceScar = 3;
            reply = "تم تطبيق خدوش وضربات سكين دموية ثلاثية مدببة وواقعية على الخد.";
          } else {
            updatedMorphs.faceScar = 1;
            reply = "تم تطبيق جرح قطعي عميق يعبر الجبهة والحاجب والعين والخد مع غرز خياطة جراحية طبية متقاطعة ودماء متخثرة.";
          }
        }

        // و. استعادة مظهر العيون الطبيعي
        if (query.includes('عين') && (query.includes('طبيعي') || query.includes('عادي') || query.includes('سليم') || query.includes('استعد') || query.includes('رجع'))) {
          updatedMorphs.gougedEyeL = false;
          updatedMorphs.gougedEyeR = false;
          updatedMorphs.blindEyeL = false;
          updatedMorphs.blindEyeR = false;
          updatedMorphs.eyeColorL = '#4a3728';
          updatedMorphs.eyeColorR = '#4a3728';
          reply = "تمت استعادة العيون الطبيعية السليمة باللون البني الأصلي وإزالة أي فقع أو عماء.";
        }

        // 6. أوامر تعرية الملابس ووشوم وندبات الجسم والرجول (Clothing Stripping & Body Art)
        // أ. تعرية كاملة للجسم (بدون ملابس)
        if ((query.includes('افصخ') || query.includes('شيل') || query.includes('بدون') || query.includes('تعرية')) && (query.includes('ملابس') || query.includes('كله') || query.includes('كامل') || query.includes('عريان'))) {
          if (query.includes('البس') || query.includes('رجع') || query.includes('استعد')) {
            updatedMorphs.stripShirt = false;
            updatedMorphs.stripPants = false;
            reply = "تمت استعادة الملابس الكاملة للشخصية (القميص والبنطلون).";
          } else {
            updatedMorphs.stripShirt = true;
            updatedMorphs.stripPants = true;
            reply = "تمت تعرية ملابس الشخصية بالكامل (صدر مكشوف وعضلات مشدودة + بوكسر وأرجل مكشوفة).";
          }
        }
        // ب. تعرية أو لبس البلوزة / القميص
        else if (query.includes('بلوز') || query.includes('قميص') || query.includes('تيشيرت') || query.includes('تي شيرت') || query.includes('فانيل') || query.includes('صدر مكشوف')) {
          if (query.includes('البس') || query.includes('رجع') || query.includes('ارتد')) {
            updatedMorphs.stripShirt = false;
            reply = "تمت إعادة ارتداء البلوزة / القميص للشخصية.";
          } else if (query.includes('افصخ') || query.includes('شيل') || query.includes('بدون') || query.includes('مكشوف') || query.includes('عري')) {
            updatedMorphs.stripShirt = true;
            reply = "تم فصخ وتعرية البلوزة وإظهار صدر وعضلات جذع مشدودة وواقعية.";
          }
        }
        // ج. تعرية أو لبس السروال / البنطلون
        else if (query.includes('سروال') || query.includes('بنطلون') || query.includes('بنتلون') || query.includes('بوكسر') || query.includes('شورت') || query.includes('ارجل مكشوفة') || query.includes('أرجل مكشوفة')) {
          if (query.includes('البس') || query.includes('رجع') || query.includes('ارتد')) {
            updatedMorphs.stripPants = false;
            reply = "تمت إعادة ارتداء السروال / البنطلون للشخصية.";
          } else if (query.includes('افصخ') || query.includes('شيل') || query.includes('بدون') || query.includes('بوكسر') || query.includes('مكشوف')) {
            updatedMorphs.stripPants = true;
            reply = "تم فصخ وتعرية السروال وتحويله إلى بوكسر رياضي وأرجل مكشوفة واقعية.";
          }
        }

        // د. وشوم الجسم والرجول
        if ((query.includes('وشم') || query.includes('وشوم') || query.includes('تاتو')) && (query.includes('جسم') || query.includes('صدر') || query.includes('بطن') || query.includes('ظهر') || query.includes('يد') || query.includes('رجول') || query.includes('رجل') || query.includes('ساق'))) {
          if (query.includes('امسح') || query.includes('احذف') || query.includes('ازالة') || query.includes('إزالة') || query.includes('بدون')) {
            updatedMorphs.bodyTattoo = false;
            reply = "تمت إزالة ومسح كافة وشوم الجسم والأذرع والأرجل.";
          } else {
            updatedMorphs.bodyTattoo = true;
            updatedMorphs.stripShirt = true; // إظهار الصدر تلقائياً لرؤية الوشوم
            reply = "تم تطبيق وشوم العصابات الكاملة على الصدر والبطن والذراعين والأرجل مع تعرية الصدر لرؤيتها بوضوح!";
          }
        }

        // هـ. ندبات وجروح الجسم والرجول
        if ((query.includes('ندب') || query.includes('ندبات') || query.includes('جرح') || query.includes('جروح') || query.includes('طعن') || query.includes('رصاص')) && (query.includes('جسم') || query.includes('صدر') || query.includes('بطن') || query.includes('رجول') || query.includes('رجل') || query.includes('ساق') || query.includes('ركب'))) {
          if (query.includes('امسح') || query.includes('عالج') || query.includes('ازالة') || query.includes('إزالة') || query.includes('طبيعي')) {
            updatedMorphs.bodyScar = false;
            reply = "تمت معالجة وإزالة كافة ندبات وجروح الجسم والأرجل.";
          } else {
            updatedMorphs.bodyScar = true;
            updatedMorphs.stripShirt = true; // إظهار الصدر لرؤية الندبات
            reply = "تم تطبيق ندبات وجروح معارك قطعية ورصاصة متندبة على الصدر وعضلات البطن والركبة!";
          }
        }

        // 7. أوامر الشيدينج ونمط بلندر
        if (query.includes('كلاي') || query.includes('طين') || query.includes('نحت')) {
          updatedShading = 'clay';
          reply = "تم تحويل الشاشة إلى وضع بلندر كلاي (Clay Matcap) لفحص تفاصيل المجسم.";
        } else if (query.includes('وايرفريم') || query.includes('شبك')) {
          updatedShading = 'wireframe';
          reply = "تم تفعيل نمط الوايرفريم (Wireframe) لإظهار شبكة المودلينج ثلاثية الأبعاد.";
        } else if (query.includes('واقعي') || query.includes('ريندر') || query.includes('تكسشر')) {
          updatedShading = 'rendered';
          reply = "تم تفعيل النمط الواقعي بالألوان والتكسشرات الأصلية.";
        }

        // 8. أوامر الإضاءة
        if (query.includes('سينمائ') || query.includes('دافئ')) {
          updatedLighting = 'cinematic';
          reply = "تم تطبيق إضاءة سينمائية دافئة.";
        } else if (query.includes('ليل') || query.includes('نيون')) {
          updatedLighting = 'night';
          reply = "تم تطبيق إضاءة ليلية ونيون تحاكي أجواء فايف إم.";
        } else if (query.includes('استوديو') || query.includes('محايد')) {
          updatedLighting = 'studio';
          reply = "تم تطبيق إضاءة استوديو متوازنة.";
        }

        // 9. أوامر استيراد المجلد والتصدير
        if (query.includes('استورد') || query.includes('مجلد') || query.includes('freemode')) {
          importTexturesFolder();
          reply = "جاري فتح نافذة استيراد مجلد التكسشرات...";
        } else if (query.includes('حمل') || query.includes('تصدير') || query.includes('zip')) {
          exportFiveMResource('custom_ped_addon', updatedMorphs, textures, updatedWalk);
          reply = "تم بدء حزم وتنزيل مجلد FiveM Addon الجاهز (.ZIP).";
        }

        // 10. أوامر استوديو تفصيل وقص وتصميم الملابس (Custom Clothing Studio AI Controls)
        if (query.includes('كروب توب') || query.includes('قصر البلوزة') || query.includes('بلوزة قصيرة') || query.includes('تيشيرت قصير')) {
          setClothingPattern(p => ({ ...p, length: 32 }));
          setActiveTab('clothing');
          triggerSewAndDrape();
          reply = "تم تفصيل التيشيرت إلى كروب توب قصير (Crop Top) بطول 32 سم مع كشف البطن وإظهار خطوط الخياطة.";
        } else if (query.includes('طول البلوزة') || query.includes('تيشيرت طويل') || query.includes('تونيك')) {
          setClothingPattern(p => ({ ...p, length: 96 }));
          setActiveTab('clothing');
          triggerSewAndDrape();
          reply = "تم تطويل التيشيرت إلى طول 96 سم بنمط تونيك ممتد على الفخذين.";
        } else if (query.includes('قصة مائلة') || query.includes('مائل') || query.includes('غير متناظر') || query.includes('طرف مائل')) {
          setClothingPattern(p => ({ ...p, hemLeftOffset: 24 }));
          setActiveTab('clothing');
          triggerSewAndDrape();
          reply = "تم تطبيق قصة مائلة غير متناظرة (Asymmetrical Cut) للتيشيرت مع سحب الطرف الأيسر لأسفل.";
        } else if (query.includes('حرير') || query.includes('silk')) {
          setClothingPattern(p => ({ ...p, fabric: 'silk' }));
          setActiveTab('clothing');
          reply = "تم تحويل قماش التيشيرت إلى الحرير الانسيابي الفاخر (Silk) ذو البريق العالي.";
        } else if (query.includes('جينز') || query.includes('دنيم') || query.includes('denim')) {
          setClothingPattern(p => ({ ...p, fabric: 'denim' }));
          setActiveTab('clothing');
          reply = "تم تحويل قماش التيشيرت إلى قماش الدنيم والجينز المتين (Denim).";
        } else if (query.includes('صوف') || query.includes('تريكو') || query.includes('knit')) {
          setClothingPattern(p => ({ ...p, fabric: 'knit' }));
          setActiveTab('clothing');
          reply = "تم تحويل قماش التيشيرت إلى صوف التريكو المحبوك (Knit) مع درزات خياطة ثلاثية الأبعاد.";
        } else if (query.includes('جلد') || query.includes('leather')) {
          setClothingPattern(p => ({ ...p, fabric: 'leather' }));
          setActiveTab('clothing');
          reply = "تم تحويل قماش التيشيرت إلى الجلد الفاخر الملمع (Leather).";
        } else if (query.includes('أصفر') || query.includes('اصفر') || query.includes('yellow')) {
          setClothingPattern(p => ({ ...p, color: '#ecc94b' }));
          setActiveTab('clothing');
          reply = "تم تلوين التيشيرت بلون أصفر الاستوديو المعتمد (#ecc94b).";
        } else if (query.includes('تفصيل') || query.includes('باترون') || query.includes('خياطة') || query.includes('استوديو الملابس')) {
          setActiveTab('clothing');
          triggerSewAndDrape();
          reply = "تم فتح استوديو تفصيل وقص الملابس ثلاثي الأبعاد مع الباترون المسطح ودرزات الخياطة المعتمدة.";
        } else if (query.includes('ضبط') || query.includes('اعادة')) {
          updatedMorphs = initialMorphs;
          setClothingPattern(initialClothingPattern);
          reply = "تمت إعادة ضبط مقاييس الجسم إلى الأبعاد الافتراضية.";
        }

        // 11. أوامر السيارات / الونان / LCPDFR / FiveForge (FiveM Vehicle Studio)
        let fiveforgeCmd = null;
        if (
          query.includes('ونان') || query.includes('سفتي') || query.includes('lightbar') ||
          query.includes('سيارة شرطة') || query.includes('بوليس') || query.includes('lcpdfr') ||
          query.includes('ساوند اوف') || query.includes('soundoff') || query.includes('hide-a-way') ||
          query.includes('hideaway') || query.includes('شماسية') || query.includes('visor') ||
          query.includes('فتح السيارة') || query.includes('استوديو السيارة') || query.includes('بلندر')
        ) {
          fiveforgeCmd = { openCar: true, carPreset: 'police3', resetSiren: true };
          if (query.includes('hide') || query.includes('مخفي') || query.includes('شمعات')) {
            fiveforgeCmd.sirenType = 'hideaway_vertex';
            fiveforgeCmd.lcpdfrPackId = 'hideaway_vertex';
            reply = 'تم فتح استوديو السيارة وتثبيت فلاشات Hide-A-Way المخفية (LCPDFR) على الشمعات.';
          } else if (query.includes('visor') || query.includes('شماسية') || query.includes('axix') || query.includes('مباحث')) {
            fiveforgeCmd.sirenType = 'visor_unmarked';
            fiveforgeCmd.lcpdfrPackId = 'axixtech_stealth_visor';
            reply = 'تم تركيب شماسية Axixtech Stealth Visor داخل الزجاج (مباحث).';
          } else if (query.includes('ion') || query.includes('ساوند') || query.includes('لوحة')) {
            fiveforgeCmd.sirenType = 'soundoff_ion';
            fiveforgeCmd.lcpdfrPackId = 'soundoff_ion_plate';
            reply = 'تم تركيب SoundOff Ion مع حامل اللوحة الأمامية على الشبك.';
          } else if (query.includes('مغناطيس') || query.includes('beacon') || query.includes('l31')) {
            fiveforgeCmd.sirenType = 'roof_single_beacon';
            reply = 'تم تثبيت ونان مغناطيسي L31 على سطح السيارة (أو سطح الصندوق للمكشوفة).';
          } else if (query.includes('valor') || query.includes('v-shape') || query.includes('في شيب')) {
            fiveforgeCmd.sirenType = 'valor_vshape';
            reply = 'تم تركيب ونان Federal Signal Valor بشكل V على السقف.';
          } else if (query.includes('سقف') || query.includes('ليبرتي') || query.includes('lightbar') || query.includes('ونان')) {
            fiveforgeCmd.sirenType = 'lightbar_led';
            fiveforgeCmd.lcpdfrPackId = 'generic_light_pack';
            fiveforgeCmd.pushbar = true;
            fiveforgeCmd.badgeMode = 'lspd_star';
            reply = 'تم فتح سيارة شرطة مع ونان سقف LED + دعامة صدم + نجمة LSPD — جاهز لفايف إم.';
          } else {
            fiveforgeCmd.sirenType = 'lightbar_led';
            reply = 'تم فتح استوديو السيارة (Blender 3D) مع معدات طوارئ FiveM.';
          }
          if (query.includes('ferrari') || query.includes('فيراري') || query.includes('بارشيتا')) {
            fiveforgeCmd.carPreset = '00barch';
          }
          setActiveTab('fiveforge');
        }

        // أطقم تجميلية سريعة (بوتات / ضباط / عصابات)
        if (query.includes('ضابط') || query.includes('شرطي') || query.includes('lspd')) {
          updatedMorphs = {
            ...updatedMorphs,
            tacticalVest: true, vestPatch: 'lspd', thighHolster: true,
            shoulderRadio: true, dutyBelt: true, sunglasses: true
          };
          reply = (reply.includes('تم ') ? reply + ' ' : '') + 'تم تطبيق طقم ضابط LSPD (درع + هولستر + لاسلكي + حزام).';
        } else if (query.includes('بلاك اوبس') || query.includes('swat') || query.includes('عمليات خاصة')) {
          updatedMorphs = {
            ...updatedMorphs,
            tacticalVest: true, vestPatch: 'swat', combatHelmet: true,
            balaclava: true, tacticalBackpack: true, thighHolster: true
          };
          reply = 'تم تطبيق طقم عمليات خاصة Black Ops / SWAT.';
        }

        data = {
          height: updatedMorphs.height,
          shoulders: updatedMorphs.shoulders,
          armMuscles: updatedMorphs.armMuscles,
          bellyFat: updatedMorphs.bellyFat,
          chest: updatedMorphs.chest,
          thighs: updatedMorphs.thighs,
          faceFat: updatedMorphs.faceFat,
          head: updatedMorphs.head,
          faceDistortion: updatedMorphs.faceDistortion,
          crookedNose: updatedMorphs.crookedNose,
          jawTwist: updatedMorphs.jawTwist,
          hunchback: updatedMorphs.hunchback,
          bodyAsymmetry: updatedMorphs.bodyAsymmetry,
          grotesqueLumps: updatedMorphs.grotesqueLumps,
          eyeColorL: updatedMorphs.eyeColorL,
          eyeColorR: updatedMorphs.eyeColorR,
          blindEyeL: updatedMorphs.blindEyeL,
          blindEyeR: updatedMorphs.blindEyeR,
          gougedEyeL: updatedMorphs.gougedEyeL,
          gougedEyeR: updatedMorphs.gougedEyeR,
          faceTattoo: updatedMorphs.faceTattoo,
          faceScar: updatedMorphs.faceScar,
          stripShirt: updatedMorphs.stripShirt,
          stripPants: updatedMorphs.stripPants,
          bodyTattoo: updatedMorphs.bodyTattoo,
          bodyScar: updatedMorphs.bodyScar,
          skinColor: updatedMorphs.skinColor,
          clothingColor: updatedMorphs.clothingColor,
          hideLeftArm: updatedMorphs.hideLeftArm,
          hideRightArm: updatedMorphs.hideRightArm,
          hideLeftLeg: updatedMorphs.hideLeftLeg,
          hideRightLeg: updatedMorphs.hideRightLeg,
          tacticalVest: updatedMorphs.tacticalVest,
          vestPatch: updatedMorphs.vestPatch,
          thighHolster: updatedMorphs.thighHolster,
          shoulderRadio: updatedMorphs.shoulderRadio,
          dutyBelt: updatedMorphs.dutyBelt,
          sunglasses: updatedMorphs.sunglasses,
          combatHelmet: updatedMorphs.combatHelmet,
          balaclava: updatedMorphs.balaclava,
          tacticalBackpack: updatedMorphs.tacticalBackpack,
          walkStyle: updatedWalk,
          isPlaying: updatedPlaying,
          shadingMode: updatedShading,
          lightingEnv: updatedLighting,
          fiveforge: fiveforgeCmd,
          reply
        };
      }

      // تطبيق التغييرات الصادرة من الذكاء الاصطناعي
      setMorphs((prev) => ({
        ...prev,
        height: typeof data.height === 'number' ? data.height : prev.height,
        shoulders: typeof data.shoulders === 'number' ? data.shoulders : prev.shoulders,
        armMuscles: typeof data.armMuscles === 'number' ? data.armMuscles : prev.armMuscles,
        bellyFat: typeof data.bellyFat === 'number' ? data.bellyFat : prev.bellyFat,
        chest: typeof data.chest === 'number' ? data.chest : prev.chest,
        thighs: typeof data.thighs === 'number' ? data.thighs : prev.thighs,
        faceFat: typeof data.faceFat === 'number' ? data.faceFat : prev.faceFat,
        head: typeof data.head === 'number' ? data.head : prev.head,
        faceDistortion: typeof data.faceDistortion === 'number' ? data.faceDistortion : prev.faceDistortion,
        crookedNose: typeof data.crookedNose === 'number' ? data.crookedNose : prev.crookedNose,
        jawTwist: typeof data.jawTwist === 'number' ? data.jawTwist : prev.jawTwist,
        hunchback: typeof data.hunchback === 'number' ? data.hunchback : prev.hunchback,
        bodyAsymmetry: typeof data.bodyAsymmetry === 'number' ? data.bodyAsymmetry : prev.bodyAsymmetry,
        grotesqueLumps: typeof data.grotesqueLumps === 'number' ? data.grotesqueLumps : prev.grotesqueLumps,
        eyeColorL: data.eyeColorL || prev.eyeColorL,
        eyeColorR: data.eyeColorR || prev.eyeColorR,
        blindEyeL: typeof data.blindEyeL === 'boolean' ? data.blindEyeL : prev.blindEyeL,
        blindEyeR: typeof data.blindEyeR === 'boolean' ? data.blindEyeR : prev.blindEyeR,
        gougedEyeL: typeof data.gougedEyeL === 'boolean' ? data.gougedEyeL : prev.gougedEyeL,
        gougedEyeR: typeof data.gougedEyeR === 'boolean' ? data.gougedEyeR : prev.gougedEyeR,
        faceTattoo: typeof data.faceTattoo === 'number' ? data.faceTattoo : prev.faceTattoo,
        faceScar: typeof data.faceScar === 'number' ? data.faceScar : prev.faceScar,
        stripShirt: typeof data.stripShirt === 'boolean' ? data.stripShirt : prev.stripShirt,
        stripPants: typeof data.stripPants === 'boolean' ? data.stripPants : prev.stripPants,
        bodyTattoo: typeof data.bodyTattoo === 'boolean' ? data.bodyTattoo : prev.bodyTattoo,
        bodyScar: typeof data.bodyScar === 'boolean' ? data.bodyScar : prev.bodyScar,
        skinColor: data.skinColor || prev.skinColor,
        clothingColor: data.clothingColor || prev.clothingColor,
        hideLeftArm: typeof data.hideLeftArm === 'boolean' ? data.hideLeftArm : prev.hideLeftArm,
        hideRightArm: typeof data.hideRightArm === 'boolean' ? data.hideRightArm : prev.hideRightArm,
        hideLeftLeg: typeof data.hideLeftLeg === 'boolean' ? data.hideLeftLeg : prev.hideLeftLeg,
        hideRightLeg: typeof data.hideRightLeg === 'boolean' ? data.hideRightLeg : prev.hideRightLeg,
        tacticalVest: typeof data.tacticalVest === 'boolean' ? data.tacticalVest : prev.tacticalVest,
        vestPatch: data.vestPatch || prev.vestPatch,
        thighHolster: typeof data.thighHolster === 'boolean' ? data.thighHolster : prev.thighHolster,
        shoulderRadio: typeof data.shoulderRadio === 'boolean' ? data.shoulderRadio : prev.shoulderRadio,
        dutyBelt: typeof data.dutyBelt === 'boolean' ? data.dutyBelt : prev.dutyBelt,
        sunglasses: typeof data.sunglasses === 'boolean' ? data.sunglasses : prev.sunglasses,
        combatHelmet: typeof data.combatHelmet === 'boolean' ? data.combatHelmet : prev.combatHelmet,
        balaclava: typeof data.balaclava === 'boolean' ? data.balaclava : prev.balaclava,
        tacticalBackpack: typeof data.tacticalBackpack === 'boolean' ? data.tacticalBackpack : prev.tacticalBackpack,
      }));

      if (data.walkStyle) setWalkStyle(data.walkStyle);
      if (typeof data.isPlaying === 'boolean') setIsPlaying(data.isPlaying);
      if (data.shadingMode) setShadingMode(data.shadingMode);
      if (data.lightingEnv) setLightingEnv(data.lightingEnv);

      if (data.openFolderDialog) importTexturesFolder();
      if (data.exportAddon) exportFiveMResource('custom_ped_addon', morphs, textures, walkStyle);

      // FiveM vehicle / siren / LCPDFR commands via FiveForge bridge
      if (data.fiveforge && window.__fiveforge) {
        const ff = window.__fiveforge;
        if (data.fiveforge.openCar) ff.openCarStudio(data.fiveforge.carPreset || 'police3');
        if (data.fiveforge.sirenType) ff.setSirenType(data.fiveforge.sirenType);
        if (data.fiveforge.sirenColorMode) ff.setSirenColorMode(data.fiveforge.sirenColorMode);
        if (data.fiveforge.badgeMode) ff.setBadgeMode(data.fiveforge.badgeMode);
        if (data.fiveforge.carColor) ff.setCarColor(data.fiveforge.carColor);
        if (data.fiveforge.lcpdfrPackId) ff.setLcpdfrPackId(data.fiveforge.lcpdfrPackId);
        if (typeof data.fiveforge.pushbar === 'boolean') ff.setPushbarEnabled(data.fiveforge.pushbar);
        if (data.fiveforge.exportZip) ff.exportZip();
        if (data.fiveforge.resetSiren) ff.resetSirenOffsets();
      }

      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: data.reply || "تم تنفيذ وتطبيق التعديل المطلوب بنجاح." }
      ]);
    } catch (err) {
      console.error("AI command failed:", err);
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: "حدث خطأ أثناء معالجة الطلب، يرجى المحاولة مرة أخرى." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className={`flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans antialiased relative ${isDragging ? 'ring-4 ring-amber-500' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer && e.dataTransfer.files) {
          await handleUniversalImport(e.dataTransfer.files);
        }
      }}
    >
      {/* مؤشر السحب والإفلات الشامل لملفات فايف إم */}
      {isDragging && (
        <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md z-50 flex flex-col items-center justify-center border-4 border-dashed border-amber-500 pointer-events-none space-y-4">
          <div className="p-4 bg-amber-500/20 text-amber-400 rounded-full animate-bounce">
            <Sparkles className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-amber-200">أفلت ملفات فايف إم هنا الآن</h2>
          <p className="text-sm text-neutral-300">يقبل قواميس .ytd, .ytt والمجسمات .ydr, .ydd, .yft والصور .dds, .png, .jpg</p>
        </div>
      )}

      {/* عناصر الإدخال المخفية للملفات والمجلدات */}
      <input 
        type="file" 
        ref={folderInputRef} 
        webkitdirectory="true" 
        directory="true" 
        multiple 
        className="hidden" 
        onChange={handleWebFolderChange} 
      />
      <input 
        type="file" 
        ref={filesInputRef} 
        multiple 
        accept="image/*,.dds,.ytd,.ytt,.ydr,.ydd,.yft,.glb,.obj,.gltf" 
        className="hidden" 
        onChange={handleWebFilesChange} 
      />
      <input 
        type="file" 
        ref={singleSlotInputRef} 
        accept="image/*,.dds,.ytd,.ytt,.ydr,.ydd,.yft,.glb,.obj,.gltf" 
        className="hidden" 
        onChange={handleSingleSlotChange} 
      />

      {/* الشريط الجانبي المتقدم والمنظم (Blender Style Sidebar) */}
      <aside className="w-84 md:w-96 flex flex-col border-l border-neutral-800 bg-neutral-900/95 backdrop-blur-xl z-20 shadow-2xl">
        {/* ترويسة الاستوديو */}
        <header className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl shadow-lg shadow-indigo-600/30">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide flex items-center gap-1.5 text-neutral-100">
                FiveM Studio Pro
                <span className="text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded-full font-mono">
                  v2.5
                </span>
              </h1>
              <p className="text-[10px] text-neutral-400">Blender Easy Engine & Textures</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setMorphs(initialMorphs);
              resetToDefaultTextures();
            }} 
            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition"
            title="إعادة ضبط الكل إلى الحالة الافتراضية"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </header>

        {/* أزرار التبويبات العلوية */}
        <nav className="grid grid-cols-6 border-b border-neutral-800 bg-neutral-950/40 text-[10px] font-medium p-1 gap-1">
          <button
            onClick={() => setActiveTab('ai')}
            className={`py-2 px-0.5 rounded-lg flex flex-col items-center gap-1 transition ${
              activeTab === 'ai' 
                ? 'bg-indigo-600 text-white font-semibold shadow-md' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>المساعد</span>
          </button>

          <button
            onClick={() => setActiveTab('clothing')}
            className={`py-2 px-0.5 rounded-lg flex flex-col items-center gap-1 transition relative ${
              activeTab === 'clothing' 
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold shadow-md' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Shirt className="w-3.5 h-3.5 text-amber-400" />
            <span>تفصيل</span>
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
          </button>

          <button
            onClick={() => setActiveTab('morphs')}
            className={`py-2 px-0.5 rounded-lg flex flex-col items-center gap-1 transition ${
              activeTab === 'morphs' 
                ? 'bg-indigo-600 text-white font-semibold shadow-md' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>المقاييس</span>
          </button>

          <button
            onClick={() => setActiveTab('textures')}
            className={`py-2 px-0.5 rounded-lg flex flex-col items-center gap-1 transition relative ${
              activeTab === 'textures' 
                ? 'bg-indigo-600 text-white font-semibold shadow-md' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>التكسشرات</span>
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          </button>

          <button
            onClick={() => setActiveTab('fiveforge')}
            className={`py-2 px-0.5 rounded-lg flex flex-col items-center gap-1 transition relative ${
              activeTab === 'fiveforge' 
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-semibold shadow-md' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold">FiveForge</span>
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-yellow-400 rounded-full" />
          </button>

          <button
            onClick={() => setActiveTab('motion')}
            className={`py-2 px-0.5 rounded-lg flex flex-col items-center gap-1 transition ${
              activeTab === 'motion' 
                ? 'bg-indigo-600 text-white font-semibold shadow-md' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>المشي</span>
          </button>
        </nav>

        {/* محتوى التبويبات */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'clothing' ? 'p-0' : 'p-4 space-y-4'}`}>
          {/* تبويب استوديو تفصيل وقص وتصميم الملابس (Clothing Studio) */}
          {activeTab === 'clothing' && (
            <ClothingStudio
              pattern={clothingPattern}
              onChangePattern={setClothingPattern}
              morphs={morphs}
              onChangeMorphs={setMorphs}
              onTriggerDrape={triggerSewAndDrape}
              onReset={() => setClothingPattern(initialClothingPattern)}
            />
          )}
          {/* تبويب 1: الذكاء الاصطناعي والمساعد الفوري */}
          {activeTab === 'ai' && (
            <div className="flex flex-col h-full space-y-3">
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[380px]">
                {messages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`p-3 rounded-xl text-xs leading-relaxed transition ${
                      msg.role === 'ai' 
                        ? 'bg-neutral-950 border border-neutral-800 text-neutral-300 shadow-sm' 
                        : 'bg-indigo-600 text-white mr-5 shadow-md shadow-indigo-600/20'
                    }`}
                  >
                    {msg.role === 'ai' && (
                      <div className="flex items-center gap-1 text-[11px] text-indigo-400 font-semibold mb-1">
                        <Sparkles className="w-3 h-3" /> مساعد الاستوديو
                      </div>
                    )}
                    {msg.text}
                  </div>
                ))}
                {isLoading && (
                  <div className="p-3 rounded-xl text-xs bg-neutral-950 border border-neutral-800 text-neutral-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    جاري التفكير وتعديل الشخصية...
                  </div>
                )}
              </div>

              {/* اقتراحات أوامر سريعة */}
              <div className="pt-2 border-t border-neutral-800/80">
                <p className="text-[10px] text-neutral-400 mb-2">أوامر سريعة مقترحة:</p>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <button 
                    onClick={() => {
                      setMorphs(prev => ({ ...prev, stripShirt: false, stripPants: false }));
                      setTextures(defaultTextures);
                    }}
                    className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 px-2.5 py-1 rounded-lg text-emerald-300 font-semibold transition"
                  >
                    👔 إعادة اللباس الكامل الأصلي
                  </button>
                  <button 
                    onClick={() => { setInputVal('افصخ البلوزة وخله بصدر مكشوف'); }}
                    className="bg-neutral-800/90 hover:bg-neutral-700 px-2.5 py-1 rounded-lg text-amber-300 font-medium transition"
                  >
                    🎽 افصخ البلوزة
                  </button>
                  <button 
                    onClick={() => { setInputVal('افصخ السروال وخله بوكسر وأرجل مكشوفة'); }}
                    className="bg-neutral-800/90 hover:bg-neutral-700 px-2.5 py-1 rounded-lg text-amber-300 font-medium transition"
                  >
                    🩳 افصخ السروال
                  </button>
                  <button 
                    onClick={() => { setInputVal('وشوم عصابات كاملة على الصدر والجسم والرجول'); }}
                    className="bg-neutral-800/90 hover:bg-neutral-700 px-2.5 py-1 rounded-lg text-cyan-300 font-medium transition"
                  >
                    ✒️ وشوم الجسم والرجول
                  </button>
                  <button 
                    onClick={() => { setInputVal('ندبات وجروح معارك ورصاص على الصدر والرجول'); }}
                    className="bg-neutral-800/90 hover:bg-neutral-700 px-2.5 py-1 rounded-lg text-rose-300 font-medium transition"
                  >
                    ⚔️ ندبات الجسم والرجول
                  </button>
                  <button 
                    onClick={() => { setInputVal('فصل التيشيرت كروب توب قصير مع إظهار درزات الخياطة'); }}
                    className="bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 px-2.5 py-1 rounded-lg text-amber-300 font-semibold transition"
                  >
                    ✂️ تفصيل كروب توب
                  </button>
                  <button 
                    onClick={() => { setInputVal('حول قماش التيشيرت إلى صوف تريكو أصفر مفصل'); }}
                    className="bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 px-2.5 py-1 rounded-lg text-amber-300 font-semibold transition"
                  >
                    🧶 تريكو أصفر مفصل
                  </button>
                  <button 
                    onClick={() => { setInputVal('طبق قصة مائلة غير متناظرة للتيشيرت مع طرف مائل'); }}
                    className="bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 px-2.5 py-1 rounded-lg text-amber-300 font-semibold transition"
                  >
                    📐 قصة مائلة غير متناظرة
                  </button>
                  <button 
                    onClick={() => { setInputVal('كبر عضلاته وخليه ضخم ومعضل'); }}
                    className="bg-neutral-800/90 hover:bg-neutral-700 px-2.5 py-1 rounded-lg text-neutral-300 transition"
                  >
                    💪 ضخم عضلاته
                  </button>
                  <button 
                    onClick={() => { setInputVal('خل مشيته عصابات وهيبة FiveM'); }}
                    className="bg-neutral-800/90 hover:bg-neutral-700 px-2.5 py-1 rounded-lg text-neutral-300 transition"
                  >
                    🕶️ مشية عصابات
                  </button>
                  <button 
                    onClick={() => { setInputVal('قص يده اليمين مع سدادة واقعية'); }}
                    className="bg-neutral-800/90 hover:bg-neutral-700 px-2.5 py-1 rounded-lg text-neutral-300 transition"
                  >
                    ✂️ بتر اليد اليمنى
                  </button>
                  <button 
                    onClick={() => { setInputVal('اضبط طوله على 185 سم'); }}
                    className="bg-neutral-800/90 hover:bg-neutral-700 px-2.5 py-1 rounded-lg text-neutral-300 transition"
                  >
                    📏 طول 185 سم
                  </button>
                  <button 
                    onClick={() => { setInputVal('فعل وضع بلندر كلاي Matcap'); }}
                    className="bg-neutral-800/90 hover:bg-neutral-700 px-2.5 py-1 rounded-lg text-neutral-300 transition"
                  >
                    🗿 وضع الكلاي
                  </button>
                </div>
              </div>

              {/* حقل إدخال الرسالة */}
              <form onSubmit={runAiCommand} className="pt-2">
                <div className="relative">
                  <input
                    type="text"
                    value={inputVal}
                    disabled={isLoading}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="اطلب أي تعديل (مثال: خله معضل ومشية عصابات)..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-2.5 pr-3 pl-10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition disabled:opacity-50"
                  />
                  <button 
                    type="submit" 
                    disabled={isLoading || !inputVal.trim()}
                    className="absolute left-2.5 top-2.5 text-neutral-400 hover:text-indigo-400 transition disabled:opacity-30"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* تبويب 2: التكسشرات والخامات لفايف إم */}
          {activeTab === 'textures' && (
            <div className="space-y-4">
              {/* أزرار الاستيراد السريعة */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={importTexturesFolder}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>استيراد مجلد تكسشرات</span>
                </button>

                <button
                  onClick={importTextureFiles}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 p-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  <span>استيراد صور (.PNG)</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
                <span>أجزاء وتكسشرات فايف إم النشطة:</span>
                <button 
                  onClick={resetToDefaultTextures} 
                  className="text-indigo-400 hover:underline text-[11px]"
                >
                  استعادة الأصلية
                </button>
              </div>

              {/* قائمة أجزاء الـ Ped وتكسشراتها */}
              <div className="space-y-2.5">
                {[
                  { id: 'head', name: 'الرأس والوجه (Head)', slot: '000_r', desc: 'تكسشر ملامح الوجه ولون البشرة' },
                  { id: 'jbib', name: 'القميص والسترة (Jbib)', slot: '000_u', desc: 'تكسشر الملابس العلوية' },
                  { id: 'uppr', name: 'الجذع واليدين (Uppr)', slot: '000_r', desc: 'تكسشر اليدين وعضلات الصدر' },
                  { id: 'lowr', name: 'البنطال والساقين (Lowr)', slot: '000_r', desc: 'تكسشر الجينز والملابس السفلية' },
                  { id: 'feet', name: 'الأحذية والقدمين (Feet)', slot: '000_u', desc: 'تكسشر الكوتشي أو الحذاء' }
                ].map((item) => {
                  const currentTex = textures[item.id];
                  const isVisible = visibility[item.id] !== false;

                  return (
                    <div 
                      key={item.id} 
                      className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-3 flex flex-col gap-2 hover:border-neutral-700 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setVisibility({ ...visibility, [item.id]: !isVisible })}
                            className={`p-1 rounded-md transition ${isVisible ? 'text-indigo-400 hover:bg-neutral-800' : 'text-neutral-500 hover:bg-neutral-800'}`}
                            title={isVisible ? "إخفاء الجزء" : "إظهار الجزء"}
                          >
                            {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <div>
                            <p className="text-xs font-semibold text-neutral-200">{item.name}</p>
                            <p className="text-[10px] text-neutral-400 font-mono truncate max-w-[160px]">
                              {currentTex?.name || 'تكسشر افتراضي'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {currentTex?.url && (
                            <img 
                              src={currentTex.url} 
                              alt={item.id} 
                              className="w-8 h-8 rounded-lg object-cover border border-neutral-700 bg-neutral-900" 
                            />
                          )}
                          <button
                            onClick={() => promptSingleSlotTexture(item.id)}
                            className="bg-neutral-800 hover:bg-neutral-700 p-1.5 rounded-lg text-neutral-300 text-xs transition cursor-pointer"
                            title="تغيير هذا التكسشر بصورة من الجهاز"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                          </button>
                        </div>
                      </div>

                      {/* صبغة لون إضافية إذا كان التيشيرت */}
                      {item.id === 'jbib' && (
                        <div className="flex items-center justify-between pt-1 border-t border-neutral-900 text-[11px] text-neutral-400">
                          <span>صبغة لون التيشيرت:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-neutral-500">{morphs.clothingColor || '#ffffff'}</span>
                            <input 
                              type="color" 
                              value={morphs.clothingColor || '#ffffff'} 
                              onChange={(e) => setMorphs({ ...morphs, clothingColor: e.target.value })} 
                              className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                            />
                          </div>
                        </div>
                      )}

                      {/* صبغة لون البشرة للرأس والذراعين */}
                      {(item.id === 'head' || item.id === 'uppr') && (
                        <div className="flex items-center justify-between pt-1 border-t border-neutral-900 text-[11px] text-neutral-400">
                          <span className="flex items-center gap-1">
                            <span>🎨 لون البشرة:</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-neutral-500">{morphs.skinColor || '#ffffff'}</span>
                            <input 
                              type="color" 
                              value={morphs.skinColor || '#ffffff'} 
                              onChange={(e) => setMorphs({ ...morphs, skinColor: e.target.value })} 
                              className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                              title="تغيير لون البشرة"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* تبويب 3: مقاييس وعضلات الجسم */}
          {activeTab === 'morphs' && (
            <div className="space-y-4">
              {/* أزرار سريعة لأنماط البنية الجسدية */}
              <div className="bg-neutral-950 border border-neutral-800/80 p-3 rounded-2xl space-y-2">
                <span className="text-[11px] font-semibold text-neutral-400 block">⚡ قوالب جاهزة لبنية الجسم:</span>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    onClick={() => setMorphs({ ...morphs, bellyFat: 1.55, chest: 1.50, shoulders: 1.38, armMuscles: 1.45, thighs: 1.50, faceFat: 1.45 })}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 bg-amber-950/40 border border-amber-600/40 hover:bg-amber-900/60 text-amber-200 rounded-xl transition text-[11px] font-semibold"
                    title="تضخيم متناسق للقفص والفخذين واليدين والأكتاف والوجه والرقبة كالدب"
                  >
                    <span>🐻</span>
                    <span>بنية الدب (Bear)</span>
                  </button>
                  <button
                    onClick={() => setMorphs({ ...morphs, bellyFat: 0.95, chest: 1.50, shoulders: 1.45, armMuscles: 1.50, thighs: 1.30, faceFat: 0.95 })}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-950/40 border border-indigo-600/40 hover:bg-indigo-900/60 text-indigo-200 rounded-xl transition text-[11px] font-semibold"
                    title="تضخيم عضلات الصدر واليدين والأكتاف مع خصر نحيف"
                  >
                    <span>🏋️</span>
                    <span>معضل (Fitness)</span>
                  </button>
                  <button
                    onClick={() => setMorphs({ ...morphs, height: 1.0, shoulders: 1.0, armMuscles: 1.0, bellyFat: 1.0, chest: 1.0, thighs: 1.0, faceFat: 1.0, head: 1.0, skinColor: '#ffffff' })}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 bg-neutral-900 border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 rounded-xl transition text-[11px]"
                    title="إعادة ضبط المقاييس إلى الوضع الافتراضي"
                  >
                    <span>🧍</span>
                    <span>قياسي (Reset)</span>
                  </button>
                </div>
              </div>

              {/* قسم اختيار وتخصيص لون البشرة */}
              <div className="bg-neutral-950 border border-neutral-800/80 p-3 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
                    <span>🎨</span>
                    <span>لون وتدرج البشرة (Skin Tone):</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                      {morphs.skinColor || '#ffffff'}
                    </span>
                    <label 
                      className="relative cursor-pointer flex items-center justify-center w-6 h-6 rounded-lg border border-neutral-700 overflow-hidden shadow-inner hover:scale-105 transition"
                      title="اختر أي لون مخصص للبشرة"
                    >
                      <input 
                        type="color" 
                        value={morphs.skinColor || '#ffffff'} 
                        onChange={(e) => setMorphs({ ...morphs, skinColor: e.target.value })} 
                        className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                      />
                      <div className="w-full h-full rounded" style={{ backgroundColor: morphs.skinColor || '#ffffff' }} />
                    </label>
                  </div>
                </div>

                {/* خيارات سريعة لدرجات البشرة الطبيعية */}
                <div className="grid grid-cols-4 gap-1.5">
                  {skinTonePresets.map((preset) => {
                    const isSelected = (morphs.skinColor || '#ffffff').toLowerCase() === preset.color.toLowerCase();
                    return (
                      <button
                        key={preset.id}
                        onClick={() => setMorphs({ ...morphs, skinColor: preset.color })}
                        className={`flex items-center gap-1.5 p-1.5 rounded-xl border text-[10px] transition text-right ${
                          isSelected 
                            ? 'bg-neutral-800/90 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500/50' 
                            : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200'
                        }`}
                        title={preset.name}
                      >
                        <span 
                          className="w-3.5 h-3.5 rounded-full border shrink-0 shadow-sm"
                          style={{ backgroundColor: preset.bg, borderColor: preset.border }}
                        />
                        <span className="truncate">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3.5 bg-neutral-950 border border-neutral-800/80 p-3.5 rounded-2xl">
                {/* طول القامة */}
                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-1">
                    <span className="font-medium">📏 طول القامة (Height)</span>
                    <span className="text-indigo-400 font-semibold font-mono">
                      {Math.round(morphs.height * 175)} سم ({morphs.height.toFixed(2)}x)
                    </span>
                  </div>
                  <input 
                    type="range" min="0.85" max="1.25" step="0.01" 
                    value={morphs.height} 
                    onChange={(e) => setMorphs({ ...morphs, height: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                  />
                  <div className="flex justify-between text-[10px] text-neutral-500 mt-0.5">
                    <span>149 سم</span>
                    <span>175 سم (قياسي)</span>
                    <span>219 سم</span>
                  </div>
                </div>

                {/* سمنة وتدوير الوجه والرقبة كالدب */}
                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-0.5">
                    <span className="font-medium">🐻 سمنة وتدوير الوجه والرقبة (Face & Neck Fat)</span>
                    <span className="text-indigo-400 font-semibold font-mono">{(morphs.faceFat ?? 1.0).toFixed(2)}x</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mb-1">تسمين الخدود وتدوير الوجه، تعريض الفك، إضافة لغلوغ (ذقن مزدوج)، وتضخيم الرقبة كالدب</p>
                  <input 
                    type="range" min="0.80" max="1.75" step="0.01" 
                    value={morphs.faceFat ?? 1.0} 
                    onChange={(e) => setMorphs({ ...morphs, faceFat: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                  />
                </div>

                {/* عرض الأكتاف */}
                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-0.5">
                    <span className="font-medium">🏋️ عظام وأكتاف الدب (Shoulders)</span>
                    <span className="text-indigo-400 font-semibold font-mono">{morphs.shoulders.toFixed(2)}x</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mb-1">تضخيم وتوسيع عظام الكتف والترقوة شعاعياً في مكانها بتناسق تام</p>
                  <input 
                    type="range" min="0.85" max="1.60" step="0.01" 
                    value={morphs.shoulders} 
                    onChange={(e) => setMorphs({ ...morphs, shoulders: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                  />
                </div>

                {/* عضلات اليدين */}
                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-0.5">
                    <span className="font-medium">💪 عضلات وأكمام اليدين (Arm Muscles)</span>
                    <span className="text-indigo-400 font-semibold font-mono">{morphs.armMuscles.toFixed(2)}x</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mb-1">تضخيم عضلات الذراعين والأكمام في الأبعاد الثلاثية لتبدو كذراعي دب قوي</p>
                  <input 
                    type="range" min="0.85" max="1.65" step="0.01" 
                    value={morphs.armMuscles} 
                    onChange={(e) => setMorphs({ ...morphs, armMuscles: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                  />
                </div>

                {/* حجم البطن والكرش "دب" */}
                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-0.5">
                    <span className="font-medium">🍔 حجم البطن والكرش (Belly / "دب كامل")</span>
                    <span className="text-indigo-400 font-semibold font-mono">{morphs.bellyFat.toFixed(2)}x</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mb-1">يكبر منطقة البطن والجذع بالكامل بانسيابية ونعومة دون أي تمزق أو بروز حاد</p>
                  <input 
                    type="range" min="0.80" max="1.85" step="0.01" 
                    value={morphs.bellyFat} 
                    onChange={(e) => setMorphs({ ...morphs, bellyFat: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                  />
                </div>

                {/* عضلات القفص الصدري */}
                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-0.5">
                    <span className="font-medium">🎽 عضلات وعظم القفص الصدري (Barrel Chest)</span>
                    <span className="text-indigo-400 font-semibold font-mono">{morphs.chest.toFixed(2)}x</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mb-1">توسيع القفص الصدري البرميلي وعضلات المجنص للأمام والجوانب كبنية الدب</p>
                  <input 
                    type="range" min="0.85" max="1.70" step="0.01" 
                    value={morphs.chest} 
                    onChange={(e) => setMorphs({ ...morphs, chest: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                  />
                </div>

                {/* عضلات وسمنة الفخذين */}
                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-0.5">
                    <span className="font-medium">👖 عضلات وسمنة الفخذين (Thighs Bulk)</span>
                    <span className="text-indigo-400 font-semibold font-mono">{morphs.thighs.toFixed(2)}x</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mb-1">تضخيم عظام وسمنة الفخذين بالكامل لمنع أي مظهر نحيف أسفل البطن الكبير</p>
                  <input 
                    type="range" min="0.85" max="1.70" step="0.01" 
                    value={morphs.thighs} 
                    onChange={(e) => setMorphs({ ...morphs, thighs: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                  />
                </div>

                {/* حجم الرأس المتناسق */}
                <div>
                  <div className="flex justify-between text-xs text-neutral-300 mb-1">
                    <span className="font-medium">👤 تناسق الرأس (Head Scale)</span>
                    <span className="text-indigo-400 font-semibold font-mono">{morphs.head.toFixed(2)}x</span>
                  </div>
                  <input 
                    type="range" min="0.90" max="1.15" step="0.01" 
                    value={morphs.head} 
                    onChange={(e) => setMorphs({ ...morphs, head: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                  />
                </div>
              </div>

              {/* قسم تشوهات الوجه والجسم المتقدمة */}
              <div className="bg-neutral-950 border border-neutral-800/80 p-3.5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                    <span className="text-base">🎭</span>
                    <span>تشوهات الوجه والجسم (Deformities & Asymmetry)</span>
                  </div>
                  <button
                    onClick={() => setMorphs(prev => ({
                      ...prev,
                      faceDistortion: 0,
                      crookedNose: 0,
                      jawTwist: 0,
                      hunchback: 0,
                      bodyAsymmetry: 0,
                      grotesqueLumps: 0
                    }))}
                    className="text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition"
                  >
                    استعادة الملامح الطبيعية
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400">
                  تحكم فوري بدقة العظام بتشوهات الوجه (كسر الأنف، التواء الفك، تدلي العين) وتشوهات الجسم (حدبة الظهر وميلان الأكتاف).
                </p>

                {/* خيارات سريعة للتشوهات */}
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <button
                    onClick={() => setMorphs(prev => ({
                      ...prev,
                      faceDistortion: 0.85,
                      crookedNose: 0.70,
                      jawTwist: 0.55
                    }))}
                    className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 transition text-center"
                  >
                    🧟 تشوه وجه كامل
                  </button>
                  <button
                    onClick={() => setMorphs(prev => ({ ...prev, crookedNose: 0.85 }))}
                    className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 transition text-center"
                  >
                    👃 كسر وانحراف الأنف
                  </button>
                  <button
                    onClick={() => setMorphs(prev => ({ ...prev, jawTwist: 0.80 }))}
                    className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 transition text-center"
                  >
                    🦷 اعوجاج الفك
                  </button>
                  <button
                    onClick={() => setMorphs(prev => ({ ...prev, hunchback: 0.85 }))}
                    className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 transition text-center"
                  >
                    🐪 حدبة الظهر
                  </button>
                  <button
                    onClick={() => setMorphs(prev => ({ ...prev, bodyAsymmetry: 0.80, hunchback: 0.50 }))}
                    className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 transition text-center"
                  >
                    🩻 ميلان الأكتاف
                  </button>
                  <button
                    onClick={() => setMorphs(prev => ({
                      ...prev,
                      faceDistortion: 0.90,
                      crookedNose: 0.80,
                      jawTwist: 0.75,
                      hunchback: 0.85,
                      bodyAsymmetry: 0.65,
                      grotesqueLumps: 0.70
                    }))}
                    className="p-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/60 text-rose-300 transition text-center font-semibold"
                  >
                    ☣️ تشوه مرعب شامل
                  </button>
                  <button
                    onClick={() => setMorphs(prev => ({
                      ...prev,
                      faceScar: 8,
                      skinColor: '#889882',
                      eyeColorL: '#dc2626',
                      eyeColorR: '#dc2626',
                      faceDistortion: 0.35
                    }))}
                    className="p-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/70 text-emerald-300 transition text-center font-semibold col-span-1"
                    title="زومبي إشعاعي أخضر مع عروق صفراء ومحاجر عيون غائرة محمرة"
                  >
                    🧪 زومبي إشعاعي أخضر
                  </button>
                  <button
                    onClick={() => setMorphs(prev => ({
                      ...prev,
                      faceScar: 9,
                      faceDistortion: 0.25
                    }))}
                    className="p-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-700/70 text-red-200 transition text-center font-semibold col-span-2"
                    title="تشوه دموي كثيف على الوجه والذقن مع طعنات نجمية سوداء وحمراء على الرقبة"
                  >
                    🩸 تشوه دموي وطعنات نجمية (وجه ورقبة)
                  </button>
                </div>

                {/* السلايدرات الفردية للتشوهات */}
                <div className="space-y-2.5 pt-1 border-t border-neutral-900">
                  {/* تشوه وعدم تناسق الوجه */}
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-300 mb-0.5">
                      <span>🧟 عدم تناسق وتشوّه الوجه</span>
                      <span className="text-rose-400 font-mono font-semibold">{((morphs.faceDistortion || 0) * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.02" 
                      value={morphs.faceDistortion || 0} 
                      onChange={(e) => setMorphs({ ...morphs, faceDistortion: parseFloat(e.target.value) })}
                      className="w-full accent-rose-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                    />
                  </div>

                  {/* كسر وانحراف الأنف */}
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-300 mb-0.5">
                      <span>👃 كسر وميلان الأنف (Crooked Nose)</span>
                      <span className="text-rose-400 font-mono font-semibold">{(morphs.crookedNose || 0).toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" min="-1" max="1" step="0.05" 
                      value={morphs.crookedNose || 0} 
                      onChange={(e) => setMorphs({ ...morphs, crookedNose: parseFloat(e.target.value) })}
                      className="w-full accent-rose-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                    />
                  </div>

                  {/* التواء واعوجاج الفك */}
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-300 mb-0.5">
                      <span>🦷 التواء واعوجاج الفك (Twisted Jaw)</span>
                      <span className="text-rose-400 font-mono font-semibold">{(morphs.jawTwist || 0).toFixed(2)}</span>
                    </div>
                    <input 
                      type="range" min="-1" max="1" step="0.05" 
                      value={morphs.jawTwist || 0} 
                      onChange={(e) => setMorphs({ ...morphs, jawTwist: parseFloat(e.target.value) })}
                      className="w-full accent-rose-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                    />
                  </div>

                  {/* حدبة الظهر */}
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-300 mb-0.5">
                      <span>🐪 حدبة وتحدب أعلى الظهر (Hunchback)</span>
                      <span className="text-rose-400 font-mono font-semibold">{((morphs.hunchback || 0) * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.02" 
                      value={morphs.hunchback || 0} 
                      onChange={(e) => setMorphs({ ...morphs, hunchback: parseFloat(e.target.value) })}
                      className="w-full accent-rose-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                    />
                  </div>

                  {/* عدم تناسق الأكتاف والجسم */}
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-300 mb-0.5">
                      <span>🩻 ميلان الأكتاف والعمود الفقري (Scoliosis)</span>
                      <span className="text-rose-400 font-mono font-semibold">{((morphs.bodyAsymmetry || 0) * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.02" 
                      value={morphs.bodyAsymmetry || 0} 
                      onChange={(e) => setMorphs({ ...morphs, bodyAsymmetry: parseFloat(e.target.value) })}
                      className="w-full accent-rose-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                    />
                  </div>

                  {/* كتل وأورام جلدية */}
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-300 mb-0.5">
                      <span>☣️ تكتلات وأورام جلدية (Grotesque Lumps)</span>
                      <span className="text-rose-400 font-mono font-semibold">{((morphs.grotesqueLumps || 0) * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="1" step="0.02" 
                      value={morphs.grotesqueLumps || 0} 
                      onChange={(e) => setMorphs({ ...morphs, grotesqueLumps: parseFloat(e.target.value) })}
                      className="w-full accent-rose-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                    />
                  </div>
                </div>
              </div>

              {/* قسم العيون، الجروح والوشوم (Eyes, Scars & Tattoos) */}
              <div className="bg-neutral-950 border border-neutral-800/80 p-3.5 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                    <span className="text-base">👁️</span>
                    <span>العيون، الجروح والوشوم (Eyes, Scars & Tattoos)</span>
                  </div>
                  <button
                    onClick={() => setMorphs(prev => ({
                      ...prev,
                      gougedEyeL: false,
                      gougedEyeR: false,
                      blindEyeL: false,
                      blindEyeR: false,
                      eyeColorL: '#4a3728',
                      eyeColorR: '#4a3728',
                      faceScar: 0,
                      faceTattoo: 0
                    }))}
                    className="text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition"
                  >
                    استعادة المظهر الطبيعي
                  </button>
                </div>

                {/* 1. حالة ومظهر العينين (Eye Sockets & Status) */}
                <div className="space-y-2 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-850">
                  <div className="text-[11px] font-semibold text-neutral-300 flex items-center justify-between">
                    <span>👀 حالة كل عين (مفقوعة / عمياء بيضاء / سليمة):</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {/* العين اليسرى (Left Eye) */}
                    <div className="space-y-1.5 p-2 rounded-lg bg-neutral-950/80 border border-neutral-800">
                      <div className="font-semibold text-neutral-300 flex items-center justify-between">
                        <span>العين اليسرى (Left Eye):</span>
                        <span className="text-[9px] text-indigo-400">
                          {morphs.gougedEyeL ? 'مفقوعة 🩸' : morphs.blindEyeL ? 'عمياء بيضاء ⚪' : 'طبيعية 👁️'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => setMorphs(prev => ({ ...prev, gougedEyeL: false, blindEyeL: false }))}
                          className={`p-1 rounded text-center transition ${!morphs.gougedEyeL && !morphs.blindEyeL ? 'bg-indigo-600 text-white font-bold' : 'bg-neutral-900 text-neutral-400 hover:text-white'}`}
                        >
                          طبيعية
                        </button>
                        <button
                          onClick={() => setMorphs(prev => ({ ...prev, blindEyeL: true, gougedEyeL: false }))}
                          className={`p-1 rounded text-center transition ${morphs.blindEyeL ? 'bg-neutral-200 text-black font-bold' : 'bg-neutral-900 text-neutral-400 hover:text-white'}`}
                          title="عين عمياء بيضاء كالصورة 2"
                        >
                          بيضاء ⚪
                        </button>
                        <button
                          onClick={() => setMorphs(prev => ({ ...prev, gougedEyeL: true, blindEyeL: false }))}
                          className={`p-1 rounded text-center transition ${morphs.gougedEyeL ? 'bg-rose-700 text-white font-bold' : 'bg-neutral-900 text-neutral-400 hover:text-white'}`}
                          title="عين مفقوعة دامية مع سيلان دم"
                        >
                          مفقوعة 🩸
                        </button>
                      </div>
                    </div>

                    {/* العين اليمنى (Right Eye) */}
                    <div className="space-y-1.5 p-2 rounded-lg bg-neutral-950/80 border border-neutral-800">
                      <div className="font-semibold text-neutral-300 flex items-center justify-between">
                        <span>العين اليمنى (Right Eye):</span>
                        <span className="text-[9px] text-indigo-400">
                          {morphs.gougedEyeR ? 'مفقوعة 🩸' : morphs.blindEyeR ? 'عمياء بيضاء ⚪' : 'طبيعية 👁️'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => setMorphs(prev => ({ ...prev, gougedEyeR: false, blindEyeR: false }))}
                          className={`p-1 rounded text-center transition ${!morphs.gougedEyeR && !morphs.blindEyeR ? 'bg-indigo-600 text-white font-bold' : 'bg-neutral-900 text-neutral-400 hover:text-white'}`}
                        >
                          طبيعية
                        </button>
                        <button
                          onClick={() => setMorphs(prev => ({ ...prev, blindEyeR: true, gougedEyeR: false }))}
                          className={`p-1 rounded text-center transition ${morphs.blindEyeR ? 'bg-neutral-200 text-black font-bold' : 'bg-neutral-900 text-neutral-400 hover:text-white'}`}
                        >
                          بيضاء ⚪
                        </button>
                        <button
                          onClick={() => setMorphs(prev => ({ ...prev, gougedEyeR: true, blindEyeR: false }))}
                          className={`p-1 rounded text-center transition ${morphs.gougedEyeR ? 'bg-rose-700 text-white font-bold' : 'bg-neutral-900 text-neutral-400 hover:text-white'}`}
                        >
                          مفقوعة 🩸
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. تلوين القزحية (Eye Color Presets) */}
                <div className="space-y-2 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-850">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                    <span>🎨 لون القزحية (Eye Color Customizer):</span>
                    <div className="flex items-center gap-1.5">
                      <label className="relative cursor-pointer flex items-center justify-center w-5 h-5 rounded-md border border-neutral-700 overflow-hidden" title="لون مخصص">
                        <input
                          type="color"
                          value={morphs.eyeColorL || '#4a3728'}
                          onChange={(e) => setMorphs({ ...morphs, eyeColorL: e.target.value, eyeColorR: e.target.value })}
                          className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                        />
                        <div className="w-full h-full" style={{ backgroundColor: morphs.eyeColorL || '#4a3728' }} />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-[10px]">
                    {eyeColorPresets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setMorphs(prev => ({ ...prev, eyeColorL: preset.color, eyeColorR: preset.color }))}
                        className="flex items-center gap-1.5 p-1.5 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition text-right"
                      >
                        <span className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-neutral-600" style={{ backgroundColor: preset.color }} />
                        <span className="truncate">{preset.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, eyeColorL: '#06b6d4', eyeColorR: '#dc2626' }))}
                      className="flex items-center gap-1.5 p-1.5 rounded-lg bg-neutral-950 border border-indigo-700/60 text-indigo-300 hover:border-indigo-500 transition text-right font-medium"
                      title="عين زرقاء جليدية وعين حمراء شيطانية"
                    >
                      <span className="text-[10px]">🌗</span>
                      <span className="truncate">تغاير (مزدوج)</span>
                    </button>
                  </div>
                </div>

                {/* حزم كثيفة جاهزة وسريعة */}
                <div className="p-2.5 bg-gradient-to-r from-rose-950/40 via-neutral-900 to-amber-950/40 rounded-xl border border-neutral-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-neutral-200">
                    <span>⚡ حزم وشوم وجروح كثيفة جاهزة:</span>
                    <span className="text-[9px] text-amber-400 font-normal">نقرة واحدة للمظهر الكامل</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 7 }))}
                      className={`p-2 rounded-lg border transition text-center font-bold flex items-center justify-center gap-1 ${morphs.faceScar === 7 ? 'bg-rose-900/80 border-rose-500 text-rose-100 shadow-md shadow-rose-950/50' : 'bg-neutral-950/90 border-rose-900/40 text-rose-300 hover:border-rose-500'}`}
                      title="الوجه مليان جروح بالكامل: ضربات سكين، خياطة جراحية، شظايا، وكدمات دموية"
                    >
                      <span>⚔️</span>
                      <span>مليان جروح معارك</span>
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 8 }))}
                      className={`p-2 rounded-lg border transition text-center font-bold flex items-center justify-center gap-1 ${morphs.faceTattoo === 8 ? 'bg-amber-900/80 border-amber-500 text-amber-100 shadow-md shadow-amber-950/50' : 'bg-neutral-950/90 border-amber-900/40 text-amber-300 hover:border-amber-500'}`}
                      title="الوجه مليان وشوم بالكامل: شبكة عنكبوت، خنجر، دمعة، حروف وكتابات، ووشم رقبة كامل"
                    >
                      <span>🌪️</span>
                      <span>مليان وشوم عصابات</span>
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 7, faceTattoo: 8, blindEyeL: true }))}
                      className="p-2 rounded-lg border border-red-600/70 bg-gradient-to-r from-rose-950 to-purple-950 text-red-100 hover:border-red-400 transition text-center font-bold flex items-center justify-center gap-1 col-span-2 shadow-sm"
                      title="مظهر مرعب وحرب عصابات شاملة: مليان جروح + مليان وشوم + عين مصابة عمياء"
                    >
                      <span>💀</span>
                      <span>مظهر مرعب وحرب شاملة (وشوم + جروح + عين بيضاء)</span>
                    </button>
                  </div>
                </div>

                {/* 3. الجروح والندبات (Facial Scars & Wounds) */}
                <div className="space-y-2 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-850">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                    <span>⚔️ الجروح والندبات والتعفن (Scars & Decay):</span>
                    <span className="text-[9px] text-rose-400 font-bold">
                      {morphs.faceScar === 1 ? 'جرح مع خياطة' : morphs.faceScar === 2 ? 'تعفن زومبي' : morphs.faceScar === 3 ? 'خدوش دموية' : morphs.faceScar === 4 ? 'حروق وأسيد' : morphs.faceScar === 5 ? 'خياطة فرانكنشتاين' : morphs.faceScar === 6 ? 'شظايا ورصاص' : morphs.faceScar === 7 ? 'مليان جروح معارك كثيفة' : morphs.faceScar === 8 ? 'زومبي إشعاعي أخضر' : morphs.faceScar === 9 ? 'تشوه دموي وطعنات نجمية' : morphs.faceScar === 10 ? 'ابتسامة غلاسكو الممزقة' : 'بدون'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 0 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceScar === 0 ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                    >
                      بدون جروح
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 1 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceScar === 1 ? 'bg-rose-950/80 border-rose-600 text-rose-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="جرح قطعي قطري يعبر العين مع غرز خياطة طبية"
                    >
                      🪡 جرح قطعي وخياطة
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 2 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceScar === 2 ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="بقع تعفن زومبي ولحم مكشوف متقيح مع عروق متفرعة"
                    >
                      🧟 تعفن وجروح زومبي
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 3 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceScar === 3 ? 'bg-red-950/80 border-red-600 text-red-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="خدوش سكين دموية متوازية ومخالب حادة"
                    >
                      🩸 خدوش سكين دموية
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 4 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceScar === 4 ? 'bg-orange-950/80 border-orange-600 text-orange-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="حروق وتسلخات نارية وأسيد متفحمة وندبات كلويد"
                    >
                      🔥 حروق وتسلخات نارية
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 5 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceScar === 5 ? 'bg-rose-950/80 border-rose-600 text-rose-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="خياطة فرانكنشتاين وجروح متعددة عبر الجبين والأنف والخد"
                    >
                      🪓 خياطة فرانكنشتاين
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 6 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceScar === 6 ? 'bg-red-950/80 border-red-600 text-red-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="أخدود رصاصة كاشطة على الخد وشظايا متناثرة وكدمة دموية"
                    >
                      💥 شظايا ورصاص كاشط
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 7 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceScar === 7 ? 'bg-rose-900 border-rose-500 text-white font-bold ring-1 ring-rose-400' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="الوجه مليان جروح بالكامل! طعنات سكين، خياطة جراحية، شظايا، وكدمات دموية"
                    >
                      ⚔️ جروح معارك كثيفة
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 8 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceScar === 8 ? 'bg-emerald-900 border-emerald-400 text-emerald-100 font-bold ring-1 ring-emerald-400' : 'bg-neutral-950 border-emerald-900/50 text-emerald-300 hover:text-white'}`}
                      title="تشوه زومبي إشعاعي أخضر مع عروق صفراء وبرتقالية متقيحة ومحاجر عيون غائرة محمرة (صورة 1)"
                    >
                      ☣️ زومبي إشعاعي أخضر وعروق
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 9 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceScar === 9 ? 'bg-red-900 border-red-400 text-red-100 font-bold ring-1 ring-red-400' : 'bg-neutral-950 border-red-900/50 text-red-300 hover:text-white'}`}
                      title="تشوه دموي كثيف على الجبين والوجنتين وسيلان دماء على الذقن مع طعنات نجمية سوداء وحمراء على الرقبة (صورة 2)"
                    >
                      🩸 دم كثيف وطعنات نجمية
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceScar: 10 }))}
                      className={`p-2 rounded-xl border transition text-center col-span-2 ${morphs.faceScar === 10 ? 'bg-rose-900 border-rose-400 text-white font-bold ring-1 ring-rose-400' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="ابتسامة غلاسكو الممزقة من زوايا الفم حتى الوجنتين مع غرز خياطة متقاطعة وجرح جسر الأنف"
                    >
                      🦷 ابتسامة غلاسكو الممزقة (فم مشقوق وغرز)
                    </button>
                  </div>
                </div>

                {/* 3. ميزة تشويه الوجه والضربات والشقوق العميقة 3D (3D Facial Slash Wounds & Deep Trauma) */}
                <div className="space-y-3 bg-gradient-to-b from-rose-950/40 to-neutral-900/70 p-3 rounded-2xl border border-rose-900/60 shadow-lg shadow-rose-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-200 flex items-center gap-1.5">
                      <span>🗡️</span>
                      <span>تشوه الوجه والضربات والشقوق 3D:</span>
                    </span>
                    <span className="text-[9px] bg-rose-900/80 text-rose-200 px-2 py-0.5 rounded-full font-bold border border-rose-500/40">
                      {morphs.faceSlashType === 1 ? 'ضربة ساطور غائرة' : morphs.faceSlashType === 2 ? 'شق قتال شوارع' : morphs.faceSlashType === 3 ? 'طعنات متقاطعة X' : morphs.faceSlashType === 4 ? 'تمزق غلاسكو المفتوح' : 'بدون شق'}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    حفر عظمي ثلاثي الأبعاد حقيقي في هندسة الوجه، مع أطراف منتفخة، قاع لحم نيء، دماء متخثرة، وخياطة طبية اختيارية.
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceSlashType: 0 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceSlashType === 0 ? 'bg-neutral-800 border-neutral-600 text-white font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                    >
                      بدون شق (سليم)
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceSlashType: 1, faceSlashDepth: Math.max(0.8, prev.faceSlashDepth || 1.0) }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceSlashType === 1 ? 'bg-rose-900 border-rose-400 text-rose-100 font-bold ring-1 ring-rose-400' : 'bg-neutral-950 border-rose-900/40 text-rose-300 hover:text-white'}`}
                      title="ضربة ساطور غائرة تقسم الوجه من الجبين مروراً بجسر الأنف حتى الوجنة مع حفر عظمي حقيقي ولحم نيء"
                    >
                      🪓 ضربة ساطور تقسم الوجه
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceSlashType: 2, faceSlashDepth: Math.max(0.8, prev.faceSlashDepth || 1.0) }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceSlashType === 2 ? 'bg-rose-900 border-rose-400 text-rose-100 font-bold ring-1 ring-rose-400' : 'bg-neutral-950 border-rose-900/40 text-rose-300 hover:text-white'}`}
                      title="شق سكين قتال شوارع ممزق يمتد عبر الخد مع حواف متورمة دموية"
                    >
                      🩸 شق خد قتال شوارع
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceSlashType: 3, faceSlashDepth: Math.max(0.8, prev.faceSlashDepth || 1.0) }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceSlashType === 3 ? 'bg-rose-900 border-rose-400 text-rose-100 font-bold ring-1 ring-rose-400' : 'bg-neutral-950 border-rose-900/40 text-rose-300 hover:text-white'}`}
                      title="طعنات وشقوق مطواة متقاطعة على شكل X محفورة في عظمة الخد"
                    >
                      ⚔️ شقوق مطواة متقاطعة X
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceSlashType: 4, faceSlashDepth: Math.max(0.8, prev.faceSlashDepth || 1.0) }))}
                      className={`p-2 rounded-xl border transition text-center col-span-2 ${morphs.faceSlashType === 4 ? 'bg-rose-900 border-rose-400 text-white font-bold ring-1 ring-rose-400' : 'bg-neutral-950 border-rose-900/40 text-rose-300 hover:text-white'}`}
                      title="تمزق عميق مفتوح من زاوية الفم عبر الشفة والخد يظهر باطن اللحم"
                    >
                      💀 تمزق الفك والشفة المفتوح (Glasgow Trauma)
                    </button>
                  </div>

                  {morphs.faceSlashType > 0 && (
                    <div className="space-y-2.5 pt-2 border-t border-rose-900/40">
                      {/* عمق الحفر ثلاثي الأبعاد */}
                      <div>
                        <div className="flex justify-between text-[11px] text-neutral-300 mb-0.5">
                          <span>📐 عمق التجويف والحفر 3D:</span>
                          <span className="text-rose-400 font-mono font-semibold">{(morphs.faceSlashDepth || 1.0).toFixed(2)}x</span>
                        </div>
                        <input
                          type="range" min="0.2" max="2.0" step="0.05"
                          value={morphs.faceSlashDepth || 1.0}
                          onChange={(e) => setMorphs({ ...morphs, faceSlashDepth: parseFloat(e.target.value) })}
                          className="w-full accent-rose-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                        />
                      </div>

                      {/* حالة الجرح: دم طازج ولحم نيء أم ندبة قديمة متليفة */}
                      <div>
                        <div className="flex justify-between text-[11px] text-neutral-300 mb-0.5">
                          <span>🩸 حالة الجرح والنزيف:</span>
                          <span className="text-rose-400 font-semibold text-[10px]">
                            {(morphs.faceSlashFresh ?? 1.0) > 0.65 ? 'دم طازج لامع ولحم نيء' : (morphs.faceSlashFresh ?? 1.0) > 0.30 ? 'تخثر ودماء متجلطة' : 'ندبة متليفة قديمة'}
                          </span>
                        </div>
                        <input
                          type="range" min="0.0" max="1.0" step="0.05"
                          value={morphs.faceSlashFresh ?? 1.0}
                          onChange={(e) => setMorphs({ ...morphs, faceSlashFresh: parseFloat(e.target.value) })}
                          className="w-full accent-rose-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                        />
                        <div className="flex justify-between text-[9px] text-neutral-500 mt-0.5">
                          <span>ندبة بيضاء متليفة</span>
                          <span>نزيف طازج ولحم غائر</span>
                        </div>
                      </div>

                      {/* خياطة وغرز جراحية طبية */}
                      <label className="flex items-center justify-between p-2 bg-neutral-950/80 rounded-xl border border-neutral-800 cursor-pointer hover:border-neutral-700 transition">
                        <div className="flex items-center gap-2">
                          <span className="text-base">🧵</span>
                          <div>
                            <p className="text-[11px] text-neutral-200 font-medium">غرز خياطة طبية متقاطعة (Stitches)</p>
                            <p className="text-[9px] text-neutral-500">خيوط جراحية سميكة مع ثقوب إبر ونقاط دماء</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={!!morphs.faceSlashStitches}
                          onChange={(e) => setMorphs({ ...morphs, faceSlashStitches: e.target.checked })}
                          className="w-4 h-4 rounded accent-rose-500 cursor-pointer"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* 4. وشوم الوجه والرقبة (Face & Neck Tattoos) */}
                <div className="space-y-2 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-855">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                    <span>✒️ وشوم الوجه والرقبة (Tattoos & Patches):</span>
                    <span className="text-[9px] text-amber-400 font-bold">
                      {morphs.faceTattoo === 1 ? 'وشم Rawr قوطي تحت العين' : morphs.faceTattoo === 2 ? 'دمعة وصليب' : morphs.faceTattoo === 3 ? 'وشم الرقبة القوطي' : morphs.faceTattoo === 4 ? 'لصقة جروح طبية' : morphs.faceTattoo === 5 ? 'سلك شائك وصليب عصابات' : morphs.faceTattoo === 6 ? 'فك وأسنان جمجمة' : morphs.faceTattoo === 7 ? 'خنجر وأرقام رومانية' : morphs.faceTattoo === 8 ? 'شبكة عنكبوت وسلك شائك' : morphs.faceTattoo === 9 ? 'وشم w.e.a وحلق الشفة وحنجرة (صورة 4)' : morphs.faceTattoo === 10 ? 'نجوم الصدغ وتاتو الرقبة الكامل (صورة 5)' : morphs.faceTattoo === 11 ? 'قناع المهرج الجوكر والعيون' : 'بدون'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 0 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceTattoo === 0 ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                    >
                      بدون وشم
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 1 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceTattoo === 1 ? 'bg-neutral-800 border-amber-500 text-amber-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="وشم كتابة قوطية مقوسة 'Rawr' تحت العين بمحاذاة الجفن السفلي (صورة 3)"
                    >
                      🐯 وشم Rawr قوطي تحت العين
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 2 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceTattoo === 2 ? 'bg-neutral-800 border-amber-500 text-amber-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="وشم دمعة قتلة وصليب عصابات تحت العين"
                    >
                      💧 دمعة وصليب عصابات
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 3 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceTattoo === 3 ? 'bg-neutral-800 border-amber-500 text-amber-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="وشم قوطي كامل يلتف حول الرقبة"
                    >
                      📿 وشم الرقبة القوطي
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 4 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceTattoo === 4 ? 'bg-neutral-800 border-amber-500 text-amber-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="لصقة جروح طبية معقمة ثلاثية الأبعاد على الوجنة"
                    >
                      🩹 لصقة جروح طبية 3D
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 5 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceTattoo === 5 ? 'bg-neutral-800 border-amber-500 text-amber-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="سلك شائك عصابات مجدول عبر الجبين وصليب قوطي دقيق على الصدغ"
                    >
                      ⛓️ سلك شائك وصليب
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 6 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceTattoo === 6 ? 'bg-neutral-800 border-amber-500 text-amber-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="وشم فك وأسنان جمجمة الموت وتجويف الخد"
                    >
                      💀 فك وأسنان جمجمة
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 7 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceTattoo === 7 ? 'bg-neutral-800 border-amber-500 text-amber-200 font-bold' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="خنجر عصابات عمودي تحت العين وأرقام لاتينية XIII"
                    >
                      🗡️ خنجر وأرقام رومانية
                    </button>
                    <button
                      data-tattoo="9"
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 9 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceTattoo === 9 ? 'bg-amber-900/90 border-amber-400 text-amber-100 font-bold ring-1 ring-amber-400' : 'bg-neutral-950 border-amber-900/50 text-amber-300 hover:text-white'}`}
                      title="حروف w.e.a فوق الحاجب الأيمن + شق الحاجب المزدوج + شرطتان مائلتان تحت العين + حلق الشفة السفلى الفضي + وشم الحنجرة الأمامي Chicano (صورة 4)"
                    >
                      👑 وشم w.e.a وحلق الشفة (صورة 4)
                    </button>
                    <button
                      data-tattoo="10"
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 10 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceTattoo === 10 ? 'bg-amber-900/90 border-amber-400 text-amber-100 font-bold ring-1 ring-amber-400' : 'bg-neutral-950 border-amber-900/50 text-amber-300 hover:text-white'}`}
                      title="5 نجوم خماسية بارزة على الصدغ والجبين الأيسر + دمعة وندبة تحت العين اليمنى + تاتو الرقبة الكامل الداكن 360 درجة (صورة 5)"
                    >
                      ⭐ نجوم الصدغ وتاتو الرقبة الكامل (صورة 5)
                    </button>
                    <button
                      data-tattoo="8"
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 8 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceTattoo === 8 ? 'bg-amber-900/90 border-amber-400 text-amber-100 font-bold ring-1 ring-amber-400' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="شبكة عنكبوت شعاعية كبيرة على الجبين + سلك شائك ملتف على الصدغ والفك + أرقام رومانية XIII وخنجر حربي"
                    >
                      🕷️ شبكة عنكبوت وسلك شائك عصابات
                    </button>
                    <button
                      data-tattoo="11"
                      onClick={() => setMorphs(prev => ({ ...prev, faceTattoo: 11 }))}
                      className={`p-2 rounded-xl border transition text-center ${morphs.faceTattoo === 11 ? 'bg-amber-900/90 border-amber-400 text-amber-100 font-bold ring-1 ring-amber-400' : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:text-white'}`}
                      title="قناع الجوكر والمهرج: مثلثات وخطوط مدببة عملاقة تخترق العينين + ابتسامة الجوكر السوداء الممتدة للأعلى عبر الوجنتين"
                    >
                      🎭 قناع المهرج الجوكر والعيون
                    </button>
                  </div>
                </div>
              </div>

              {/* قسم تعرية الملابس ووشوم وندبات الجسم والرجول */}
              <div className="bg-neutral-950 border border-neutral-800/80 p-3.5 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                    <span className="text-base">🎽</span>
                    <span>الملابس وتعرية الجسم، ووشوم وندبات الجسم والرجول</span>
                  </div>
                  <button
                    onClick={() => setMorphs(prev => ({
                      ...prev,
                      stripShirt: false,
                      stripPants: false,
                      bodyTattoo: false,
                      bodyScar: false
                    }))}
                    className="text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition"
                  >
                    إعادة اللباس الكامل
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400 leading-relaxed">
                  تحكم بفسخ وتعرية البلوزة (صدر مكشوف وعضلات مشدودة)، وفصخ السروال (بوكسر وأرجل مكشوفة)، مع وشوم عصابات وندبات معارك على الصدر والذراعين والرجول.
                </p>

                {/* 1. أزرار تعرية الملابس الفورية */}
                <div className="space-y-2 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-850">
                  <div className="text-[11px] font-semibold text-neutral-300 flex items-center justify-between">
                    <span>👕 حالة الملابس (تعرية الصدر والأرجل):</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {/* فصخ البلوزة */}
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, stripShirt: !prev.stripShirt }))}
                      className={`p-2.5 rounded-xl border transition flex flex-col items-center gap-1 font-semibold text-center ${
                        morphs.stripShirt 
                          ? 'bg-amber-950/80 border-amber-500 text-amber-200 shadow-sm ring-1 ring-amber-500/40' 
                          : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <span className="text-base">🎽</span>
                      <span>{morphs.stripShirt ? 'البلوزة: مفصوخة (صدر مكشوف)' : 'البلوزة: ملبوسة'}</span>
                      <span className="text-[9px] text-neutral-400 font-normal">
                        {morphs.stripShirt ? 'انقر لإعادة ارتداء البلوزة' : 'انقر لفسخ البلوزة وإظهار الصدر'}
                      </span>
                    </button>

                    {/* فصخ السروال */}
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, stripPants: !prev.stripPants }))}
                      className={`p-2.5 rounded-xl border transition flex flex-col items-center gap-1 font-semibold text-center ${
                        morphs.stripPants 
                          ? 'bg-amber-950/80 border-amber-500 text-amber-200 shadow-sm ring-1 ring-amber-500/40' 
                          : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <span className="text-base">🩳</span>
                      <span>{morphs.stripPants ? 'السروال: مفصوخ (بوكسر وأرجل)' : 'السروال: ملبوس (جينز)'}</span>
                      <span className="text-[9px] text-neutral-400 font-normal">
                        {morphs.stripPants ? 'انقر لإعادة ارتداء البنطلون' : 'انقر لفسخ السروال للبوكسر'}
                      </span>
                    </button>
                  </div>

                  {/* أزرار سريعة شاملة */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, stripShirt: true, stripPants: true }))}
                      className="p-1.5 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-amber-600/60 text-amber-300 transition text-center font-medium"
                    >
                      🩱 تعرية كاملة (صدر مكشوف + بوكسر)
                    </button>
                    <button
                      onClick={() => setMorphs(prev => ({ ...prev, stripShirt: false, stripPants: false }))}
                      className="p-1.5 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-300 transition text-center"
                    >
                      👔 إعادة اللباس الكامل للشخصية
                    </button>
                  </div>
                </div>

                {/* 2. وشوم وندبات الجسم والرجول */}
                <div className="space-y-2 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-850">
                  <div className="text-[11px] font-semibold text-neutral-300 flex items-center justify-between">
                    <span>✒️ وشوم وندبات الجسم والرجول (Body Art & Scars):</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {/* وشوم الجسم والرجول */}
                    <button
                      onClick={() => setMorphs(prev => ({ 
                        ...prev, 
                        bodyTattoo: !prev.bodyTattoo,
                        stripShirt: !prev.bodyTattoo ? true : prev.stripShirt 
                      }))}
                      className={`p-2.5 rounded-xl border transition flex flex-col items-center gap-1 font-semibold text-center ${
                        morphs.bodyTattoo 
                          ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-sm ring-1 ring-cyan-500/40' 
                          : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <span className="text-base">✒️</span>
                      <span>{morphs.bodyTattoo ? 'وشوم الجسم: مفعّلة' : 'وشوم الجسم: ملغية'}</span>
                      <span className="text-[9px] text-neutral-400 font-normal">
                        وشم صليب وعبارات الصدر + أكمام اليدين + خنجر الرجول
                      </span>
                    </button>

                    {/* ندبات وجروح الصدر والرجول */}
                    <button
                      onClick={() => setMorphs(prev => ({ 
                        ...prev, 
                        bodyScar: !prev.bodyScar,
                        stripShirt: !prev.bodyScar ? true : prev.stripShirt 
                      }))}
                      className={`p-2.5 rounded-xl border transition flex flex-col items-center gap-1 font-semibold text-center ${
                        morphs.bodyScar 
                          ? 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-sm ring-1 ring-rose-500/40' 
                          : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <span className="text-base">⚔️</span>
                      <span>{morphs.bodyScar ? 'ندبات الجسم: مفعّلة' : 'ندبات الجسم: ملغية'}</span>
                      <span className="text-[9px] text-neutral-400 font-normal">
                        جرح قطعي وغرز الصدر + طلقة نارية + جروح الركبة
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* قسم بتر الأطراف الجراحي */}
              <div className="bg-neutral-950 border border-neutral-800/80 p-3.5 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                  <Scissors className="w-3.5 h-3.5 text-rose-400" />
                  <span>بتر وتعديل الأطراف (Amputations)</span>
                </div>
                <p className="text-[10px] text-neutral-400">
                  قص الأطراف عبر الـ Shader مع تركيب سدادات جراحية ثلاثية الأبعاد واقعية.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-neutral-900 rounded-xl cursor-pointer hover:bg-neutral-850 transition">
                    <input 
                      type="checkbox"
                      checked={morphs.hideRightArm}
                      onChange={(e) => setMorphs({ ...morphs, hideRightArm: e.target.checked })}
                      className="rounded accent-rose-500"
                    />
                    <span>بتر اليد اليمنى</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-neutral-900 rounded-xl cursor-pointer hover:bg-neutral-850 transition">
                    <input 
                      type="checkbox"
                      checked={morphs.hideLeftArm}
                      onChange={(e) => setMorphs({ ...morphs, hideLeftArm: e.target.checked })}
                      className="rounded accent-rose-500"
                    />
                    <span>بتر اليد اليسرى</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-neutral-900 rounded-xl cursor-pointer hover:bg-neutral-850 transition">
                    <input 
                      type="checkbox"
                      checked={morphs.hideRightLeg}
                      onChange={(e) => setMorphs({ ...morphs, hideRightLeg: e.target.checked })}
                      className="rounded accent-rose-500"
                    />
                    <span>بتر الساق اليمنى</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-neutral-900 rounded-xl cursor-pointer hover:bg-neutral-850 transition">
                    <input 
                      type="checkbox"
                      checked={morphs.hideLeftLeg}
                      onChange={(e) => setMorphs({ ...morphs, hideLeftLeg: e.target.checked })}
                      className="rounded accent-rose-500"
                    />
                    <span>بتر الساق اليسرى</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* تبويب FiveForge المتكامل: استوديو الإضافات التجميلية الخارجية، تثبيت البروبات، وقواميس YTD */}
          {activeTab === 'fiveforge' && (
            <div className="space-y-3.5">
              {/* ترويسة FiveForge الاحترافية */}
              <div className="bg-gradient-to-r from-amber-950/60 via-yellow-950/40 to-neutral-900/80 border border-amber-600/40 p-3 rounded-2xl shadow-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
                      <Cpu className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-amber-200">FiveForge Studio Pro</h3>
                      <p className="text-[10px] text-amber-400/80">نظام الإضافات الخارجية التجميلية، تثبيت البروبات، وقواميس YTD</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/30">
                      Cosmetics 3D
                    </span>
                    <button
                      onClick={() => setShowStandaloneSuite(true)}
                      className="text-[10px] bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold px-2.5 py-1 rounded-xl shadow-lg transition flex items-center gap-1 cursor-pointer"
                      title="فتح استوديو FiveForge الكامل المستقل"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>استوديو FiveForge المستقل</span>
                    </button>
                  </div>
                </div>

                {/* أزرار التنقل الفرعية داخل FiveForge Studio */}
                <div className="grid grid-cols-5 gap-1 pt-1 text-[10px]">
                  <button
                    onClick={() => setShowStandaloneSuite(true)}
                    className="py-1.5 px-1 rounded-xl font-bold transition text-center bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black shadow-md flex items-center justify-center gap-0.5 cursor-pointer"
                    title="فتح استوديو الـ 20 أداة الكامل"
                  >
                    <span>⚡ الأدوات الـ 20</span>
                  </button>
                  <button
                    onClick={() => setFiveForgeSubTab('cosmetics')}
                    className={`py-1.5 px-1 rounded-xl font-semibold transition text-center ${
                      fiveForgeSubTab === 'cosmetics' 
                        ? 'bg-amber-500 text-black shadow-md' 
                        : 'bg-neutral-900/80 text-neutral-300 hover:text-white'
                    }`}
                  >
                    💎 إضافات
                  </button>
                  <button
                    onClick={() => setFiveForgeSubTab('props')}
                    className={`py-1.5 px-1 rounded-xl font-semibold transition text-center ${
                      fiveForgeSubTab === 'props' 
                        ? 'bg-amber-500 text-black shadow-md' 
                        : 'bg-neutral-900/80 text-neutral-300 hover:text-white'
                    }`}
                  >
                    🗡️ بروبات
                  </button>
                  <button
                    onClick={() => setFiveForgeSubTab('textures')}
                    className={`py-1.5 px-1 rounded-xl font-semibold transition text-center ${
                      fiveForgeSubTab === 'textures' 
                        ? 'bg-amber-500 text-black shadow-md' 
                        : 'bg-neutral-900/80 text-neutral-300 hover:text-white'
                    }`}
                  >
                    📂 قواميس
                  </button>
                  <button
                    onClick={() => setFiveForgeSubTab('export')}
                    className={`py-1.5 px-1 rounded-xl font-semibold transition text-center ${
                      fiveForgeSubTab === 'export' 
                        ? 'bg-amber-500 text-black shadow-md' 
                        : 'bg-neutral-900/80 text-neutral-300 hover:text-white'
                    }`}
                  >
                    🚀 تصدير
                  </button>
                </div>
              </div>

              {/* 1. قسم الإضافات التجميلية الخارجية والدروع (Cosmetics & Tactical Gear) */}
              {fiveForgeSubTab === 'cosmetics' && (
                <div className="space-y-3.5">
                  {/* أطقم تجميلية سريعة بنقرة واحدة (1-Click Cosmetic Presets) */}
                  <div className="bg-neutral-950 border border-neutral-800/80 p-3 rounded-2xl space-y-2">
                    <span className="text-[11px] font-bold text-amber-300 block">⚡ أطقم تجميلية جاهزة بنقرة واحدة:</span>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <button
                        onClick={() => setMorphs(prev => ({
                          ...prev,
                          tacticalVest: true,
                          vestPatch: 'lspd',
                          shoulderRadio: true,
                          thighHolster: true,
                          dutyBelt: true,
                          sunglasses: true,
                          goldChain: false,
                          combatHelmet: false,
                          balaclava: false
                        }))}
                        className="p-2 rounded-xl bg-blue-950/50 hover:bg-blue-900/50 border border-blue-700/60 text-blue-200 transition text-right font-medium"
                      >
                        👮 طقم ضابط شرطة LSPD
                        <span className="block text-[8px] text-blue-400">درع شرطة + هولستر + لاسلكي + حزام + نظارة</span>
                      </button>

                      <button
                        onClick={() => setMorphs(prev => ({
                          ...prev,
                          goldChain: true,
                          luxuryWatch: true,
                          snapbackCap: true,
                          sunglasses: true,
                          heistDuffleBag: true,
                          tacticalVest: false,
                          combatHelmet: false,
                          balaclava: false
                        }))}
                        className="p-2 rounded-xl bg-amber-950/50 hover:bg-amber-900/50 border border-amber-600/60 text-amber-200 transition text-right font-medium"
                      >
                        🕶️ طقم راب وعصابات فخم
                        <span className="block text-[8px] text-amber-400">سلسلة ذهب + رولكس + كاب + شنطة سرقة</span>
                      </button>

                      <button
                        onClick={() => setMorphs(prev => ({
                          ...prev,
                          balaclava: true,
                          combatHelmet: true,
                          tacticalVest: true,
                          vestPatch: 'swat',
                          thighHolster: true,
                          tacticalBackpack: true,
                          dutyBelt: true,
                          goldChain: false
                        }))}
                        className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-700 text-neutral-200 transition text-right font-medium"
                      >
                        🥷 طقم عمليات خاصة (Black Ops)
                        <span className="block text-[8px] text-neutral-400">بالافكلافا + خوذة + درع SWAT + شنطة MOLLE</span>
                      </button>

                      <button
                        onClick={() => setMorphs(prev => ({
                          ...prev,
                          shemagh: true,
                          sunglasses: true,
                          tacticalVest: true,
                          vestPatch: 'fib',
                          tacticalBackpack: true,
                          propAttached: true,
                          propType: 'katana',
                          goldChain: false,
                          balaclava: false
                        }))}
                        className="p-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/40 border border-amber-700/50 text-amber-300 transition text-right font-medium"
                      >
                        🏜️ طقم مقاتل صحراوي
                        <span className="block text-[8px] text-amber-400">شماغ ولثام + أفياتور + درع + كاتانا بالظهر</span>
                      </button>
                    </div>

                    <button
                      onClick={() => setMorphs(prev => ({
                        ...prev,
                        goldChain: false,
                        diamondPendant: false,
                        silverCross: false,
                        luxuryWatch: false,
                        tacticalVest: false,
                        thighHolster: false,
                        shoulderRadio: false,
                        dutyBelt: false,
                        sunglasses: false,
                        snapbackCap: false,
                        combatHelmet: false,
                        balaclava: false,
                        shemagh: false,
                        tacticalBackpack: false,
                        heistDuffleBag: false,
                        decalActive: false,
                        propAttached: false
                      }))}
                      className="w-full py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-[10px] text-neutral-400 hover:text-white transition text-center"
                    >
                      🧍 تفريغ كافة الإضافات التجميلية (Clear All)
                    </button>
                  </div>

                  {/* 1. سلاسل ومجوهرات فخمة (Chains & Jewelry) */}
                  <div className="bg-neutral-950 border border-neutral-800/80 p-3 rounded-2xl space-y-2">
                    <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <span>🥇</span>
                      <span>سلاسل ومجوهرات فخمة (Chains & Jewelry):</span>
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, goldChain: !prev.goldChain }))}
                        className={`p-2 rounded-xl border transition text-right font-medium ${
                          morphs.goldChain ? 'bg-amber-950/80 border-amber-500 text-amber-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        🥇 سلسلة كوبان ذهبية عريضة
                      </button>
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, diamondPendant: !prev.diamondPendant }))}
                        className={`p-2 rounded-xl border transition text-right font-medium ${
                          morphs.diamondPendant ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        💎 مدلاة ألماس مثلجة (Pendant)
                      </button>
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, silverCross: !prev.silverCross }))}
                        className={`p-2 rounded-xl border transition text-right font-medium ${
                          morphs.silverCross ? 'bg-neutral-800 border-neutral-400 text-white' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        🥈 سلسلة فضية مع صليب
                      </button>
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, luxuryWatch: !prev.luxuryWatch }))}
                        className={`p-2 rounded-xl border transition text-right font-medium ${
                          morphs.luxuryWatch ? 'bg-amber-950/80 border-amber-500 text-amber-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        👑 ساعة رولكس مثلجة بالمعصم
                      </button>
                    </div>
                  </div>

                  {/* 2. دروع ومعدات تكتيكية عسكرية/شرطية (Tactical Gear & Armor) */}
                  <div className="bg-neutral-950 border border-neutral-800/80 p-3 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-blue-400" />
                        <span>دروع ومعدات تكتيكية (Tactical Armor):</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, tacticalVest: !prev.tacticalVest }))}
                        className={`p-2 rounded-xl border transition text-right font-medium col-span-2 ${
                          morphs.tacticalVest ? 'bg-blue-950/80 border-blue-500 text-blue-200 shadow-sm' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        🛡️ سترة درع واقي عسكري/شرطي (Plate Carrier)
                      </button>

                      {morphs.tacticalVest && (
                        <div className="col-span-2 p-2 bg-neutral-900/90 rounded-xl border border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between text-[10px] text-neutral-300">
                            <span>رتبة وشارة الدرع:</span>
                            <div className="flex items-center gap-1">
                              {['lspd', 'swat', 'fib', 'sheriff', 'ems'].map((p) => (
                                <button
                                  key={p}
                                  onClick={() => setMorphs(prev => ({ ...prev, vestPatch: p }))}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                                    morphs.vestPatch === p 
                                      ? 'bg-amber-500 text-black' 
                                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, thighHolster: !prev.thighHolster }))}
                        className={`p-2 rounded-xl border transition text-right font-medium ${
                          morphs.thighHolster ? 'bg-amber-950/80 border-amber-500 text-amber-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        🔫 هولستر مسدس على الفخذ
                      </button>

                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, shoulderRadio: !prev.shoulderRadio }))}
                        className={`p-2 rounded-xl border transition text-right font-medium ${
                          morphs.shoulderRadio ? 'bg-amber-950/80 border-amber-500 text-amber-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        📻 جهاز لاسلكي ومايك الكتف
                      </button>

                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, dutyBelt: !prev.dutyBelt }))}
                        className={`p-2 rounded-xl border transition text-right font-medium col-span-2 ${
                          morphs.dutyBelt ? 'bg-amber-950/80 border-amber-500 text-amber-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        🎖️ حزام العمليات التكتيكي (Duty Belt مع جعب وأصفاد)
                      </button>
                    </div>
                  </div>

                  {/* 3. أغطية الرأس، النظارات، والأقنعة (Headwear & Eyewear) */}
                  <div className="bg-neutral-950 border border-neutral-800/80 p-3 rounded-2xl space-y-2">
                    <span className="text-[11px] font-bold text-amber-300 block">👑 أغطية الرأس، النظارات، والأقنعة:</span>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, sunglasses: !prev.sunglasses }))}
                        className={`p-2 rounded-xl border transition text-right font-medium ${
                          morphs.sunglasses ? 'bg-amber-950/80 border-amber-500 text-amber-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        🕶️ نظارات شمسية أفياتور سوداء
                      </button>
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, snapbackCap: !prev.snapbackCap }))}
                        className={`p-2 rounded-xl border transition text-right font-medium ${
                          morphs.snapbackCap ? 'bg-amber-950/80 border-amber-500 text-amber-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        🧢 كاب سناب باك راب معكوس
                      </button>
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, combatHelmet: !prev.combatHelmet }))}
                        className={`p-2 rounded-xl border transition text-right font-medium ${
                          morphs.combatHelmet ? 'bg-amber-950/80 border-amber-500 text-amber-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        ⛑️ خوذة قتال تكتيكية NVG
                      </button>
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, balaclava: !prev.balaclava }))}
                        className={`p-2 rounded-xl border transition text-right font-medium ${
                          morphs.balaclava ? 'bg-amber-950/80 border-amber-500 text-amber-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        🥷 قناع بالافكلافا تكتيكي أسود
                      </button>
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, shemagh: !prev.shemagh }))}
                        className={`p-2 rounded-xl border transition text-right font-medium col-span-2 ${
                          morphs.shemagh ? 'bg-amber-950/80 border-amber-500 text-amber-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        🧣 شماغ ولثام عربي تكتيكي يلتف حول العنق
                      </button>
                    </div>
                  </div>

                  {/* 4. الحقائب والتجهيزات (Bags & Backpacks) */}
                  <div className="bg-neutral-950 border border-neutral-800/80 p-3 rounded-2xl space-y-2">
                    <span className="text-[11px] font-bold text-amber-300 block">🎒 الحقائب والتجهيزات (Bags):</span>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, tacticalBackpack: !prev.tacticalBackpack }))}
                        className={`p-2 rounded-xl border transition text-right font-medium ${
                          morphs.tacticalBackpack ? 'bg-amber-950/80 border-amber-500 text-amber-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        🎒 حقيبة ظهر عسكرية MOLLE
                      </button>
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, heistDuffleBag: !prev.heistDuffleBag }))}
                        className={`p-2 rounded-xl border transition text-right font-medium ${
                          morphs.heistDuffleBag ? 'bg-amber-950/80 border-amber-500 text-amber-200' : 'bg-neutral-900/80 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        💼 شنطة سرقة بنك قماشية
                      </button>
                    </div>
                  </div>

                  {/* 5. شارات الصدر المعدنية ثلاثية الأبعاد (3D Badges) */}
                  <div className="bg-neutral-950 border border-neutral-800/80 p-3 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-300">🏷️ شارة الصدر المعدنية ثلاثية الأبعاد:</span>
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, decalActive: !prev.decalActive }))}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          morphs.decalActive ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {morphs.decalActive ? 'مفعلة' : 'معطلة'}
                      </button>
                    </div>

                    {morphs.decalActive && (
                      <div className="space-y-2 pt-1 text-[10px]">
                        <div className="flex items-center justify-between text-neutral-300">
                          <span>موضع التثبيت:</span>
                          <select
                            value={morphs.decalPlacement || 'chest_left'}
                            onChange={(e) => setMorphs(prev => ({ ...prev, decalPlacement: e.target.value }))}
                            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-amber-300 font-mono text-[9px]"
                          >
                            <option value="chest_left">صدر أيسر (Police Badge)</option>
                            <option value="chest_center">منتصف الصدر</option>
                            <option value="back">الظهر</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. قسم مثبت البروبات والأسلحة على العظام (Props & Bone Attachments) */}
              {fiveForgeSubTab === 'props' && (
                <div className="space-y-3.5">
                  <div className="bg-neutral-950 border border-neutral-800/80 p-3.5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                        <Box className="w-3.5 h-3.5 text-amber-400" />
                        <span>مثبت البروبات على عظام فايف إم:</span>
                      </div>
                      <button
                        onClick={() => setMorphs(prev => ({ ...prev, propAttached: !prev.propAttached }))}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition ${
                          morphs.propAttached ? 'bg-amber-500 text-black shadow-md' : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {morphs.propAttached ? 'البروب: مفعّل' : 'تفعيل البروب'}
                      </button>
                    </div>

                    {morphs.propAttached && (
                      <div className="space-y-3 pt-2 border-t border-neutral-900 text-xs">
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: 'katana', label: '🗡️ سيف كاتانا' },
                            { id: 'assault_rifle', label: '🔫 بندقية M4' },
                            { id: 'bat', label: '🏏 مضرب بيسبول' }
                          ].map(p => (
                            <button
                              key={p.id}
                              onClick={() => setMorphs(prev => ({ ...prev, propType: p.id }))}
                              className={`p-2 rounded-xl border text-center transition ${
                                morphs.propType === p.id 
                                  ? 'bg-amber-950/80 border-amber-500 text-amber-200 font-bold' 
                                  : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-neutral-300">
                          <span>العظم المثبت عليه (Bone Anchor):</span>
                          <select
                            value={morphs.propBone || 'SKEL_Spine3'}
                            onChange={(e) => setMorphs(prev => ({ ...prev, propBone: e.target.value }))}
                            className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-amber-300 font-mono text-[10px]"
                          >
                            <option value="SKEL_Spine3">الظهر والعمود الفقري (Spine3)</option>
                            <option value="SKEL_Head">الرأس (Head)</option>
                            <option value="SKEL_R_Hand">اليد اليمنى (R_Hand)</option>
                            <option value="SKEL_Pelvis">الحوض والخصر (Pelvis)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* مولد وتنسيق مجسمات وبروبات FiveForge (Prop & Archetype .YTYP Generator) */}
                  <div className="bg-neutral-950 border border-neutral-800/80 p-3.5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                        <Box className="w-3.5 h-3.5 text-amber-400" />
                        <span>مولد أركيتايب FiveForge للبروبات (.ytyp):</span>
                      </div>
                      <span className="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-700 px-1.5 py-0.5 rounded font-mono">
                        CBaseArchetypeDef
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-400">اسم الموديل / Model & TXD Name:</label>
                      <input
                        type="text"
                        value={propModelName}
                        onChange={(e) => setPropModelName(e.target.value.trim().toLowerCase().replace(/\s+/g, '_'))}
                        placeholder="custom_ped_addon"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* كود .ytyp جاهز للنسخ الفوري */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-neutral-400">
                        <span className="flex items-center gap-1 font-mono">
                          <FileCode className="w-3.5 h-3.5 text-amber-400" />
                          {propModelName}.ytyp
                        </span>
                        <button
                          onClick={() => {
                            const ytypCode = `<?xml version="1.0" encoding="UTF-8"?>
<CMapTypes>
  <extensions />
  <archetypes>
    <Item type="CBaseArchetypeDef">
      <lodDist value="150.000000" />
      <flags value="32" />
      <specialAttribute value="0" />
      <bbMin x="-0.420000" y="-0.280000" z="-0.950000" />
      <bbMax x="0.420000" y="0.280000" z="0.980000" />
      <bsCentre x="0.000000" y="0.000000" z="0.015000" />
      <bsRadius value="1.180000" />
      <hdTextureDist value="60.000000" />
      <name>${propModelName}</name>
      <textureDictionary>${propModelName}</textureDictionary>
      <clipDictionary />
      <drawableDictionary />
      <physicsDictionary>${propModelName}</physicsDictionary>
      <assetType>ASSET_TYPE_DRAWABLE</assetType>
      <assetName>${propModelName}</assetName>
    </Item>
  </archetypes>
  <name>${propModelName}_ytyp</name>
</CMapTypes>`;
                            navigator.clipboard.writeText(ytypCode);
                            setCopiedYtyp(true);
                            setTimeout(() => setCopiedYtyp(false), 2000);
                          }}
                          className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition bg-amber-950/60 hover:bg-amber-900/60 px-2 py-0.5 rounded border border-amber-600/40"
                        >
                          {copiedYtyp ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedYtyp ? 'تم النسخ!' : 'نسخ كود YTYP'}</span>
                        </button>
                      </div>

                      <pre className="p-2.5 bg-neutral-900/90 border border-neutral-800 rounded-xl text-[9px] font-mono text-neutral-300 max-h-28 overflow-y-auto leading-relaxed">
{`<?xml version="1.0" encoding="UTF-8"?>
<CMapTypes>
  <archetypes>
    <Item type="CBaseArchetypeDef">
      <name>${propModelName}</name>
      <textureDictionary>${propModelName}</textureDictionary>
      <physicsDictionary>${propModelName}</physicsDictionary>
      <lodDist value="150.000000" />
      <flags value="32" />
      <bsRadius value="1.180000" />
    </Item>
  </archetypes>
</CMapTypes>`}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. قسم قواميس YTD وتفكيك التكسشرات (Texture Dictionaries) */}
              {fiveForgeSubTab === 'textures' && (
                <div className="space-y-3.5">
                  {/* منطقة استيراد وسحب وإفلات ملفات فايف إم الشاملة */}
                  <div 
                    onClick={() => filesInputRef.current && filesInputRef.current.click()}
                    className="group border-2 border-dashed border-amber-500/50 hover:border-amber-400 bg-amber-950/20 hover:bg-amber-950/30 transition p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer space-y-2.5"
                  >
                    <div className="p-3 bg-amber-500/20 text-amber-300 rounded-2xl group-hover:scale-110 transition shadow-lg shadow-amber-500/20">
                      <FileUp className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-200">اسحب وأفلت أي ملف لفايف إم هنا أو انقر للاختيار</p>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        فك ضغط فوري لمعايير RSC7/RSC8 وتنسيقات DXT1/DXT5 تلقائياً
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-1 pt-1">
                      {['.YTD', '.YTT', '.YDR', '.YDD', '.YFT', '.DDS', '.GLB', '.OBJ'].map((ext) => (
                        <span key={ext} className="text-[9px] bg-neutral-900 border border-neutral-700 text-amber-300 font-mono px-1.5 py-0.5 rounded">
                          {ext}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* أزرار سريعة للاستيراد */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => filesInputRef.current && filesInputRef.current.click()}
                      className="flex items-center justify-center gap-1.5 p-2.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-200 rounded-xl transition text-[11px] font-semibold"
                    >
                      <FileUp className="w-3.5 h-3.5 text-amber-400" />
                      <span>استيراد ملفات YTD/DDS</span>
                    </button>
                    <button
                      onClick={importTexturesFolder}
                      className="flex items-center justify-center gap-1.5 p-2.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-200 rounded-xl transition text-[11px] font-semibold"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                      <span>استيراد مجلد تكسشرات</span>
                    </button>
                  </div>

                  {/* مستكشف قواميس التكسشرات المستوردة (Texture Dictionary Explorer) */}
                  <div className="bg-neutral-950 border border-neutral-800/80 p-3.5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        <span>مستكشف قواميس التكسشر (Texture Dictionary):</span>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {importedFiveMAssets.length > 0 ? `${importedFiveMAssets.length} ملفات محملة` : 'تكسشرات المجسم النشط'}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {Object.entries(textures).map(([slotKey, texData]) => (
                        <div 
                          key={slotKey} 
                          className="p-2.5 bg-neutral-900/70 border border-neutral-800 rounded-xl flex items-center justify-between gap-2 hover:border-neutral-700 transition"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img 
                              src={texData.url} 
                              alt={slotKey} 
                              className="w-10 h-10 rounded-lg object-cover bg-neutral-950 border border-neutral-800 shrink-0" 
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-neutral-200 truncate">{texData.name || slotKey}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-500/40 px-1 rounded font-mono">
                                  {slotKey.toUpperCase()}
                                </span>
                                <span className="text-[9px] text-neutral-500 font-mono">DXT5/BC3</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setTextures(prev => ({ ...prev, head: { url: texData.url, name: texData.name } }));
                              }}
                              className="p-1 px-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[9px] text-neutral-300 hover:text-white transition"
                              title="تطبيق على الوجه والرأس"
                            >
                              👤 رأس
                            </button>
                            <button
                              onClick={() => {
                                setTextures(prev => ({ ...prev, jbib: { url: texData.url, name: texData.name }, uppr: { url: texData.url, name: texData.name } }));
                              }}
                              className="p-1 px-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[9px] text-neutral-300 hover:text-white transition"
                              title="تطبيق على القميص والتيشيرت"
                            >
                              👕 بلوزة
                            </button>
                            <button
                              onClick={() => {
                                setTextures(prev => ({ ...prev, lowr: { url: texData.url, name: texData.name } }));
                              }}
                              className="p-1 px-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[9px] text-neutral-300 hover:text-white transition"
                              title="تطبيق على السروال والبنطلون"
                            >
                              👖 بنطلون
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. قسم حزم وتصدير المورد لفايف إم (FiveM Resource Stream Export) */}
              {fiveForgeSubTab === 'export' && (
                <div className="space-y-3.5">
                  <div className="bg-gradient-to-r from-amber-950/40 to-neutral-900 border border-amber-500/30 p-3.5 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                        <Download className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-amber-200">تجهيز وحزم مورد فايف إم جاهز للستريم</h4>
                        <p className="text-[10px] text-neutral-400">ملفات Addon مرتبة ومجهزة بضغطة زر واحدة</p>
                      </div>
                    </div>

                    <div className="p-2.5 bg-neutral-950/80 rounded-xl border border-neutral-800 text-[10px] space-y-1 font-mono text-neutral-300">
                      <div className="text-amber-400 font-bold">📦 هيكلية المجلد الناتج:</div>
                      <div>📁 [custom_ped_addon]/</div>
                      <div className="pl-3 text-neutral-400">├── 📄 fxmanifest.lua</div>
                      <div className="pl-3 text-neutral-400">├── 📁 data/</div>
                      <div className="pl-6 text-neutral-500">└── 📄 {propModelName}.ytyp</div>
                      <div className="pl-3 text-neutral-400">└── 📁 stream/</div>
                      <div className="pl-6 text-neutral-500">├── 📄 {propModelName}.ytd</div>
                      <div className="pl-6 text-neutral-500">└── 📄 {propModelName}.ydr / .ydd</div>
                    </div>

                    <button
                      onClick={() => exportFiveMResource(propModelName || 'custom_ped_addon', morphs, textures, walkStyle)}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 py-3 rounded-xl text-xs font-bold text-white shadow-xl shadow-amber-600/30 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>توليد وتنزيل حزمة FiveM Addon Stream (.ZIP)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* تبويب 4: المشي والأنيميشن وأنماط الحركة */}
          {activeTab === 'motion' && (
            <div className="space-y-4">
              <div className="bg-neutral-950 border border-neutral-800/80 p-3.5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-300">أنماط المشي والحركة (Walk Styles):</span>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      isPlaying ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-600 text-white shadow-lg'
                    }`}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isPlaying ? "إيقاف الحركة" : "تشغيل الحركة"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'casual', label: '🚶 مشية فايف إم', desc: 'خطوات انسيابية وثني ركب واقعي' },
                    { id: 'gangster', label: '🕶️ مشية عصابات', desc: 'هيبة وثقة وتمايل الشارع' },
                    { id: 'jog', label: '🏃 هرولة وجري', desc: 'إيقاع سريع ورياضي' },
                    { id: 'dance', label: '🪩 رقص واحتفال', desc: 'تمايل إيقاعي ودبكة حماسية' },
                    { id: 'combat', label: '🥊 ملاكمة ولكمات', desc: 'وقفة قتال ولكمات متناوبة' },
                    { id: 'drunk', label: '🍺 سكران وترنح', desc: 'مشية سكران وترنح أقدام واقعي' },
                    { id: 'squat', label: '🏋️ تمرين سكوات', desc: 'هبوط وصعود الأرجل للياقة' },
                    { id: 'salute', label: '🫡 تحية عسكرية', desc: 'وقفة انضباط ورفع التحية' },
                    { id: 'cheer', label: '👏 تصفيق وفرح', desc: 'احتفال وتصفيق باليدين' },
                    { id: 'idle', label: '🫁 تنفس طبيعي', desc: 'وقفة استراحة وتمدد الصدر' },
                    { id: 'zombie', label: '🧟 مشية زومبي', desc: 'أذرع ممدودة وترنح مرعب' },
                    { id: 'wave', label: '👋 تلويح وترحيب', desc: 'رفع اليد والتلويح بها' },
                    { id: 'guard', label: '🛡️ حارس أمن', desc: 'وقفة هيبة وتشبيك اليدين' },
                    { id: 'sad', label: '😞 حزن وإحباط', desc: 'انحناء رأس وخطوات بطيئة' },
                    { id: 'model', label: '💃 عارض أزياء', desc: 'تمايل حوض ممشوق وخطوات أنيقة' },
                    { id: 'karate', label: '🥋 كاراتيه وركلات', desc: 'ركلات مرتفعة ولكمات سريعة' },
                    { id: 'tpose', label: '🧍 وضع T-Pose', desc: 'الوقفة المرجعية للبلندر' }
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => {
                        setWalkStyle(style.id);
                        if (style.id !== 'tpose') setIsPlaying(true);
                        else setIsPlaying(false);
                      }}
                      className={`p-2.5 rounded-xl text-right transition border ${
                        walkStyle === style.id 
                          ? 'bg-indigo-600/30 border-indigo-500 text-white font-semibold' 
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-850'
                      }`}
                    >
                      <p className="text-xs">{style.label}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{style.desc}</p>
                    </button>
                  ))}
                </div>

                {/* سرعة الحركة */}
                <div className="pt-2 border-t border-neutral-900">
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>سرعة الأنيميشن</span>
                    <span className="font-mono text-indigo-400">{animSpeed.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" min="0.3" max="2.0" step="0.1" 
                    value={animSpeed} 
                    onChange={(e) => setAnimSpeed(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg" 
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* زر التصدير الدائم في الأسفل */}
        <footer className="p-3.5 border-t border-neutral-800 bg-neutral-950/80 space-y-2">
          <button 
            onClick={() => exportFiveMResource('custom_ped_addon', morphs, textures, walkStyle)}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 py-3 rounded-xl text-xs font-bold text-white shadow-xl shadow-indigo-600/30 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تحميل مجلد FiveM مدمج بالكامل (.ZIP Addon)</span>
          </button>

          <button 
            onClick={async () => {
              try {
                await exportBakedHeadTexturePng(morphs);
                alert('✅ تم تصدير تكسشر الرأس المدمج (head_diff_000_a_whi.png) بنجاح!\n\nطريقة تطبيقه في OpenIV:\n1. افتح OpenIV وافتح ملف head_diff_000_a_whi.ytd\n2. اضغط Replace واختر هذه الصورة المحملة\n3. اضغط Save، وستظهر ملامح وجهك والعيون والجروح والغرز والوشوم مطابقة 100%!');
              } catch (err) {
                alert('فشل تصدير تكسشر الرأس: ' + err.message);
              }
            }}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600/20 to-yellow-600/20 hover:from-amber-600/30 hover:to-yellow-600/30 border border-amber-500/40 hover:border-amber-400 py-2.5 rounded-xl text-[11px] font-bold text-amber-300 transition cursor-pointer"
            title="تنزيل تكسشر الرأس المدمج (PNG) لاستبداله مباشرة في OpenIV head_diff_000_a_whi.ytd"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>تصدير تكسشر الرأس المدمج لـ OpenIV (.PNG)</span>
          </button>
        </footer>
      </aside>

      {/* نافذة العرض ثلاثية الأبعاد المركزية (Blender 3D Viewport) */}
      <main className="flex-1 flex flex-col relative bg-neutral-950">
        {!showStandaloneSuite && (
          <PedViewer 
            morphs={morphs} 
            textures={textures}
            visibility={visibility}
            shadingMode={shadingMode}
            lightingEnv={lightingEnv}
            walkStyle={walkStyle}
            animSpeed={animSpeed}
            isPlaying={isPlaying} 
            cameraView={cameraView}
            onCameraViewChange={setCameraView}
            onTexturesDropped={applyBatchTextureFiles}
            clothingPattern={activeTab === 'clothing' ? clothingPattern : null}
            onChangeClothingPattern={setClothingPattern}
            onTriggerDrape={triggerSewAndDrape}
          />
        )}

        {/* 1. ترويسة استوديو تفصيل وقص الملابس العائمة العلوية (Image 1 Header) */}
        {activeTab === 'clothing' && (
          <div className="absolute top-4 left-6 right-6 z-20 flex items-center justify-between pointer-events-none">
            {/* مؤشر الحالة والتعليمات الحركية */}
            <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800/80 px-3.5 py-1.5 rounded-xl text-xs text-neutral-300 font-medium pointer-events-auto shadow-2xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-emerald-400">Settled.</span>
              <span className="text-neutral-400 text-[11px]">Pull the cloth or change the cut.</span>
            </div>

            {/* إرشادات التحكم ثلاثي الأبعاد في المنتصف */}
            <div className="hidden lg:flex items-center text-[10px] text-neutral-400 bg-neutral-950/60 backdrop-blur px-3 py-1 rounded-full border border-neutral-800/60">
              Drag the cloth to pull it · drag empty space to orbit · wheel to zoom · right drag to pan
            </div>

            {/* أزرار الإيقاف والحياكة العلوية */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => setClothingPattern(prev => ({ ...prev, isPaused: !prev.isPaused }))}
                className="bg-neutral-900/95 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-xl"
              >
                {clothingPattern.isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                <span className="font-medium text-[11px]">{clothingPattern.isPaused ? "Drape" : "Pause"}</span>
              </button>

              <button
                onClick={triggerSewAndDrape}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold px-4 py-1.5 rounded-xl text-xs flex items-center gap-2 shadow-xl shadow-orange-600/30 transition cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Sew and drape</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. اللوحة العائمة اليمنى السريعة لخامات وألوان وتفاصيل الملابس (Image 1 Right Panel) */}
        {activeTab === 'clothing' && (
          <div className="absolute top-16 right-5 z-20 bg-neutral-900/95 backdrop-blur-xl border border-neutral-800/90 p-4 rounded-2xl shadow-2xl space-y-4 w-56">
            {/* خامة القماش Fabric */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Fabric</p>
              <div className="flex flex-wrap gap-1">
                {['Cotton', 'Denim', 'Silk', 'Leather', 'Knit'].map(f => {
                  const fid = f.toLowerCase();
                  return (
                    <button
                      key={fid}
                      onClick={() => setClothingPattern(prev => ({ ...prev, fabric: fid }))}
                      className={`px-2.5 py-1 rounded-full text-[11px] transition font-medium border ${
                        clothingPattern.fabric === fid
                          ? 'bg-amber-600 border-amber-500 text-white font-bold shadow-md shadow-amber-600/30'
                          : 'bg-neutral-800/80 border-neutral-700 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* الألوان Colour */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Colour</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {['#f2ede4', '#232326', '#4a688b', '#e09575', '#7c343a', '#546e50', '#734c38', '#ecc94b'].map(c => (
                  <button
                    key={c}
                    onClick={() => setClothingPattern(prev => ({ ...prev, color: c }))}
                    className={`w-5 h-5 rounded-full border transition-all ${
                      clothingPattern.color?.toLowerCase() === c.toLowerCase() 
                        ? 'border-white scale-125 shadow-md shadow-amber-500/50' 
                        : 'border-neutral-700 hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* مستوى التفاصيل Detail */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Detail</p>
              <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-0.5 rounded-lg text-[10px]">
                {['Fast', 'Normal', 'Fine'].map(lvl => {
                  const lid = lvl.toLowerCase();
                  return (
                    <button
                      key={lid}
                      onClick={() => setClothingPattern(prev => ({ ...prev, detail: lid }))}
                      className={`py-0.5 rounded transition ${
                        clothingPattern.detail === lid ? 'bg-amber-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* مفاتيح التبديل Show ped & Show seams */}
            <div className="space-y-2 pt-2 border-t border-neutral-800 text-xs">
              <label className="flex items-center gap-2 cursor-pointer hover:text-white text-neutral-300">
                <input
                  type="checkbox"
                  checked={clothingPattern.showPed}
                  onChange={e => setClothingPattern(prev => ({ ...prev, showPed: e.target.checked }))}
                  className="rounded accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-[11px]">Show ped</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:text-white text-neutral-300">
                <input
                  type="checkbox"
                  checked={clothingPattern.showSeams}
                  onChange={e => setClothingPattern(prev => ({ ...prev, showSeams: e.target.checked }))}
                  className="rounded accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-[11px]">Show seams</span>
              </label>
            </div>
          </div>
        )}

        {/* شريط الأدوات العائم في الأسفل (Blender Studio Toolbar) */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-xl border border-neutral-800/90 px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-2xl z-20">
          {/* تشغيل وإيقاف الحركة */}
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 px-3.5 py-1.5 rounded-xl text-xs font-medium transition"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isPlaying ? "إيقاف" : "تشغيل"}</span>
          </button>

          <div className="h-5 w-px bg-neutral-800" />

          {/* محدد نمط الشيدينج (Rendered / Clay / Wireframe) */}
          <div className="flex items-center gap-1 bg-neutral-950/80 p-1 rounded-xl text-[11px]">
            <button
              onClick={() => setShadingMode('rendered')}
              className={`px-2.5 py-1 rounded-lg transition ${shadingMode === 'rendered' ? 'bg-indigo-600 text-white font-bold' : 'text-neutral-400 hover:text-white'}`}
              title="النمط الواقعي الطبيعي بالتكسشرات الكاملة"
            >
              🎨 واقعي
            </button>
            <button
              onClick={() => setShadingMode('clay')}
              className={`px-2.5 py-1 rounded-lg transition ${shadingMode === 'clay' ? 'bg-indigo-600 text-white font-bold' : 'text-neutral-400 hover:text-white'}`}
              title="وضع بلندر كلاي (MatCap) لفحص البنية والنحت"
            >
              🗿 كلاي
            </button>
            <button
              onClick={() => setShadingMode('wireframe')}
              className={`px-2.5 py-1 rounded-lg transition ${shadingMode === 'wireframe' ? 'bg-indigo-600 text-white font-bold' : 'text-neutral-400 hover:text-white'}`}
              title="النمط الشبكي ثلاثي الأبعاد"
            >
              🕸️ وايرفريم
            </button>
          </div>

          <div className="h-5 w-px bg-neutral-800" />

          {/* محدد بيئة الإضاءة */}
          <div className="flex items-center gap-1 bg-neutral-950/80 p-1 rounded-xl text-[11px]">
            <button
              onClick={() => setLightingEnv('studio')}
              className={`px-2 py-1 rounded-lg transition ${lightingEnv === 'studio' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="إضاءة استوديو متوازنة"
            >
              🏢 استوديو
            </button>
            <button
              onClick={() => setLightingEnv('cinematic')}
              className={`px-2 py-1 rounded-lg transition ${lightingEnv === 'cinematic' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="إضاءة سينمائية دافئة"
            >
              🌅 سينمائي
            </button>
            <button
              onClick={() => setLightingEnv('night')}
              className={`px-2 py-1 rounded-lg transition ${lightingEnv === 'night' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="إضاءة ليلية ونيون"
            >
              🌃 نيون
            </button>
            <button
              onClick={() => setLightingEnv('daylight')}
              className={`px-2 py-1 rounded-lg transition ${lightingEnv === 'daylight' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'}`}
              title="ضوء النهار الطبيعي"
            >
              ☀️ نهار
            </button>
          </div>

          <div className="h-5 w-px bg-neutral-800" />

          {/* زر فتح استوديو FiveForge الشامل (20 أداة) */}
          <button
            onClick={() => setShowStandaloneSuite(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold px-3 py-1.5 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
            title="فتح استوديو FiveForge الكامل (20 أداة متطورة)"
          >
            <Sparkles className="w-3.5 h-3.5 text-black" />
            <span>FiveForge Studio (20 أداة)</span>
          </button>
        </div>
      </main>

      {/* مودال استوديو FiveForge المستقل الشامل (Titan-Forge Suite Modal) */}
      {showStandaloneSuite && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md p-3 sm:p-6 flex items-center justify-center animate-fade-in">
          <div className="relative w-full max-w-7xl h-[92vh] flex flex-col">
            <button
              onClick={() => setShowStandaloneSuite(false)}
              className="absolute -top-3 -right-3 z-50 bg-rose-600 hover:bg-rose-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-xl transition cursor-pointer"
              title="إغلاق استوديو FiveForge"
            >
              ✕
            </button>
            <FiveForgeSuite className="flex-1 h-full" />
          </div>
        </div>
      )}
    </div>
  );
}