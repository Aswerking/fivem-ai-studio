import React, { useState, useMemo, useEffect } from 'react';
import { 
  Box, Car, User, Crosshair, Zap, Database, Server, Download, Sparkles, 
  Coins, ShieldCheck, RefreshCw, FileCode, Check, Search, Layers, Sliders, 
  Scissors, Copy, AlertCircle, ExternalLink, Grid, List, Camera, Image as ImageIcon, 
  Wrench, FolderGit2, LayoutDashboard, Play, Pause, Palette, Eye, Share2, 
  Compass, Maximize2, ChevronRight, ChevronDown, ChevronUp, Trash2, Plus, Anchor, FileText, 
  CheckCircle2, Info, Terminal, Smartphone, Flame, ArrowUpRight, Gauge,
  SlidersHorizontal, Lightbulb, Sun, Moon, UploadCloud, HardDrive, CheckCircle
} from 'lucide-react';
import FiveForgeViewport from './FiveForgeViewport.jsx';
import { FIVEFORGE_MANIFEST } from '../manifest.js';
import { useCurrentUser, useCreditBalance } from '../adapters/bridge.js';
import { packageFiveMResource, triggerDownload, generateYtypXml } from '../engine/gtaAssetPipeline.js';
import { buildSirenExportMeta } from '../engine/lcpdfrLightbarCatalog.js';
import { GTA_DATABASE } from '../database-explorer/gtaDatabase.js';
import RealisticGtaVehicle from './models/RealisticGtaVehicle.jsx';
import RealisticGtaPed from './models/RealisticGtaPed.jsx';
import RealisticGtaWeapon from './models/RealisticGtaWeapon.jsx';
import RealisticGtaChain from './models/RealisticGtaChain.jsx';
import RealisticGtaPlate from './models/RealisticGtaPlate.jsx';
import { VanillaCarCatalog, RealGta5ModsImporter } from './RealCarTools.jsx';
import { VANILLA_VEHICLES } from '../engine/vanillaVehicles.js';
import BlenderCarViewportPage from './BlenderCarViewportPage.jsx';

export default function FiveForgeSuite({ className = "" }) {
  const { user } = useCurrentUser();
  useCreditBalance(); // economy disabled — hook kept for export history side-effects only

  // Navigation state (Supports URL query params for seamless testing & deep-linking)
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === 'undefined') return 'tools';
    const params = new URLSearchParams(window.location.search);
    return params.get('section') || 'tools';
  });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeToolId, setActiveToolId] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('tool') || null;
  });
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [searchQuery, setSearchQuery] = useState('');

  // Tool Workspace State
  const [modelNameInput, setModelNameInput] = useState('custom_asset');
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState(null);
  const [copiedYtyp, setCopiedYtyp] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState(null);

  // ==========================================
  // TOOL 3: ADD-ON CAR IMPORTER STATE & PRESETS
  // ==========================================
  const [importerTab, setImporterTab] = useState('url'); // 'url' | 'file'
  const [importerUrl, setImporterUrl] = useState('https://www.gta5-mods.com/vehicles/2000-ferrari-550-barchetta-pininfarina-add-on-template');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(100);
  const [importStage, setImportStage] = useState(4);
  const [importerActiveTab, setImporterActiveTab] = useState('meta'); // 'meta' | 'handling' | 'lighting'
  const [importedCarMeta, setImportedCarMeta] = useState({
    displayName: '2001 Ferrari 550 Barchetta Pininfarina',
    spawnCode: '00barch',
    category: 'Super',
    audioHash: 'turismor',
    topSpeed: 305,
    accelMultiplier: 1.75,
    brakeForce: 1.4,
    drivetrain: 'RWD',
    mass: 1690
  });

  // ==========================================
  // OFFICIAL FIVEM & GTA V VEHICLES CATALOG (15 CARS)
  // ==========================================
  const OFFICIAL_FIVEM_CARS = [
    {
      name: '2001 Ferrari 550 Barchetta Pininfarina',
      spawn: '00barch',
      preset: '00barch',
      gta5ModsUrl: 'https://www.gta5-mods.com/vehicles/2000-ferrari-550-barchetta-pininfarina-add-on-template',
      category: 'Super',
      audio: 'turismor',
      speed: 305,
      accel: 1.75,
      brake: 1.4,
      drivetrain: 'RWD',
      mass: 1690,
      color: '#c81414',
      badge: 'YFT+YTD الأصلي 3D',
      rim: 'sport_vossen',
      classAr: 'سوبركار وخارقة',
      desc: 'مجسم فيراري 550 باركيتا بينينفارينا الأصلي الكامل (.YFT + .YTD) مستخرج من GTA5-Mods'
    },
    {
      name: 'Karin Sultan RS',
      spawn: 'sultanrs',
      category: 'Sports',
      audio: 'sultanrs',
      speed: 285,
      accel: 1.6,
      brake: 1.3,
      drivetrain: 'AWD',
      mass: 1450,
      color: '#0ea5e9',
      badge: 'تونينج ياباني AWD',
      rim: 'sport_vossen',
      classAr: 'رياضية وتونينج',
      desc: 'سيارة التونينج والسباقات الأسطورية بمحرك توربو ياباني ودفع كلي'
    },
    {
      name: 'Annis Elegy Retro Custom',
      spawn: 'elegy2',
      category: 'Sports',
      audio: 'sultanrs',
      speed: 280,
      accel: 1.58,
      brake: 1.28,
      drivetrain: 'AWD',
      mass: 1480,
      color: '#1e3a8a',
      badge: 'سكايلاين R32 JDM',
      rim: 'sport_vossen',
      classAr: 'رياضية وتونينج',
      desc: 'طراز Skyline GT-R R32 الكلاسيكي مع شكمان التيتانيوم وجناح الدريفت'
    },
    {
      name: 'Pegassi Zentorno V12',
      spawn: 'zentorno',
      category: 'Super',
      audio: 'zentorno',
      speed: 340,
      accel: 2.1,
      brake: 1.45,
      drivetrain: 'AWD',
      mass: 1500,
      color: '#f97316',
      badge: 'هايبركار V12',
      rim: 'deep_dish_chrome',
      classAr: 'سوبركار وخارقة',
      desc: 'وحش الهايبركار الإيطالي بفتحات المحرك السداسية وسكوب السقف'
    },
    {
      name: 'Bravado Buffalo STX Widebody',
      spawn: 'buffalo4',
      category: 'Muscle',
      audio: 'jugular',
      speed: 270,
      accel: 1.65,
      brake: 1.22,
      drivetrain: 'RWD',
      mass: 1790,
      color: '#18181b',
      badge: 'عضلات هيلكات 707',
      rim: 'satin_black',
      classAr: 'عضلات V8',
      desc: 'محرك هيمي V8 سوبرتشارج مع فتحة كبوت هوائية وبودي كيت عريض'
    },
    {
      name: 'Progen T20 Active Aero',
      spawn: 't20',
      category: 'Super',
      audio: 'zentorno',
      speed: 345,
      accel: 2.15,
      brake: 1.48,
      drivetrain: 'AWD',
      mass: 1420,
      color: '#ea580c',
      badge: 'هايبركار بريطاني',
      rim: 'rotiform_monoblock',
      classAr: 'سوبركار وخارقة',
      desc: 'أبواب الفراشة مع جناح خلفي هيدروليكي هوائي متكيف مع الفرامل'
    },
    {
      name: 'Karin Armored Kuruma',
      spawn: 'kuruma2',
      category: 'Armored',
      audio: 'sultanrs',
      speed: 225,
      accel: 1.35,
      brake: 1.3,
      drivetrain: 'AWD',
      mass: 1980,
      color: '#334155',
      badge: 'مصفحة مضادة للرصاص',
      rim: 'satin_black',
      classAr: 'مصفحة وتكتيكية',
      desc: 'السيارة المصفحة الأكثر تحصيناً بصفائح فولاذية للنوافذ ودعامة صدم أمامية'
    },
    {
      name: 'Vapid Police Cruiser Interceptor',
      spawn: 'police3',
      category: 'Emergency',
      audio: 'sultanrs',
      speed: 255,
      accel: 1.45,
      brake: 1.35,
      drivetrain: 'AWD',
      mass: 1850,
      color: '#0369a1',
      badge: 'دورية أمن الطرق LSPD',
      rim: 'sport_vossen',
      classAr: 'طوارئ وشرطة',
      desc: 'دورية شرطة لوس سانتوس كاملة بإنارة السقف LED الحمراء والزرقاء والدعامة'
    },
    {
      name: 'Pfister Comet S2 Turbo',
      spawn: 'comet6',
      category: 'Sports',
      audio: 'drafter',
      speed: 310,
      accel: 1.8,
      brake: 1.4,
      drivetrain: 'RWD',
      mass: 1450,
      color: '#10b981',
      badge: 'بورش جي تي 3',
      rim: 'rotiform_monoblock',
      classAr: 'رياضية وتونينج',
      desc: 'سيارة الحلبات الألمانية بدفع خلفي وجناح داونفورس عالي وجنوط ذهبية'
    },
    {
      name: 'Dinka Jester RR (Supra MK5)',
      spawn: 'jester4',
      category: 'Sports',
      audio: 'drafter',
      speed: 295,
      accel: 1.7,
      brake: 1.35,
      drivetrain: 'RWD',
      mass: 1530,
      color: '#eab308',
      badge: 'سوبرا MK5 تونينج',
      rim: 'sport_vossen',
      classAr: 'رياضية وتونينج',
      desc: 'طراز الدريفت والتونينج بتصميم ديناميكي هوائي ومخارج شكمان رياضية'
    },
    {
      name: 'Grotti Turismo R',
      spawn: 'turismor',
      category: 'Super',
      audio: 'zentorno',
      speed: 330,
      accel: 1.9,
      brake: 1.4,
      drivetrain: 'RWD',
      mass: 1440,
      color: '#dc2626',
      badge: 'فيراري إيطالية',
      rim: 'rotiform_monoblock',
      classAr: 'سوبركار وخارقة',
      desc: 'سيارة فيراري الهجينة بصوت محرك لاهث وانسيابية سباق متطورة'
    },
    {
      name: 'Obey 8F Drafter RS',
      spawn: 'drafter',
      category: 'Sports',
      audio: 'drafter',
      speed: 290,
      accel: 1.7,
      brake: 1.35,
      drivetrain: 'AWD',
      mass: 1610,
      color: '#94a3b8',
      badge: 'أودي كواترو RS',
      rim: 'sport_vossen',
      classAr: 'رياضية وتونينج',
      desc: 'محرك V6 توين توربو ونظام كواترو دفع كلي ثابت على المنعطفات'
    },
    {
      name: 'Benefactor Schafter V12',
      spawn: 'schafter3',
      category: 'Sedans',
      audio: 'jugular',
      speed: 285,
      accel: 1.6,
      brake: 1.3,
      drivetrain: 'RWD',
      mass: 1720,
      color: '#09090b',
      badge: 'مرسيدس V12 AMG',
      rim: 'sport_vossen',
      classAr: 'سوبركار وخارقة',
      desc: 'سيدان فاخرة بمحرك V12 هادر وسرعة خط هائلة مريحة للمطاردات'
    },
    {
      name: 'Bravado Gauntlet Hellfire',
      spawn: 'gauntlet4',
      category: 'Muscle',
      audio: 'jugular',
      speed: 275,
      accel: 1.7,
      brake: 1.2,
      drivetrain: 'RWD',
      mass: 1820,
      color: '#7c2d12',
      badge: 'تشالنجر هيلكات',
      rim: 'satin_black',
      classAr: 'عضلات V8',
      desc: 'وحش عضلات السحب والاستعراض بدخان كفرات كثيف وعزم دوران جبار'
    },
    {
      name: 'Ubermacht Revolter M4 G82',
      spawn: 'revolter',
      category: 'Sports',
      audio: 'sultanrs',
      speed: 285,
      accel: 1.65,
      brake: 1.3,
      drivetrain: 'AWD',
      mass: 1650,
      color: '#0284c7',
      badge: 'كوبيه M-Power',
      rim: 'sport_vossen',
      classAr: 'رياضية وتونينج',
      desc: 'كوبيه رياضية ألمانية فاخرة بمقصورة متقدمة وثبات فائق'
    },
    {
      name: 'Benefactor Dubsta G63 AMG',
      spawn: 'dubsta3',
      preset: 'g63',
      category: 'SUVs',
      audio: 'jugular',
      speed: 245,
      accel: 1.55,
      brake: 1.25,
      drivetrain: 'AWD',
      mass: 2450,
      color: '#0f172a',
      badge: 'دفع رباعي G63 4x4',
      rim: 'satin_black',
      classAr: 'دفع رباعي SUV',
      desc: 'سيارة الدفع الرباعي الفاخرة مرسيدس G63 AMG بمحرك V8 باي تيربو'
    }
  ];

  // Quick 1-Click Presets (including Real YFT+YTD Ferrari 550 Barchetta + 6 distinct 3D GLB archetypes)
  const CAR_PRESETS = [
    OFFICIAL_FIVEM_CARS[0], // 2001 Ferrari 550 Barchetta Pininfarina (Real YFT+YTD 3D)
    OFFICIAL_FIVEM_CARS[14], // Ubermacht Revolter M4 G82 (BMW M4 G82 3D)
    OFFICIAL_FIVEM_CARS[15], // Benefactor Dubsta G63 AMG (Mercedes G63 SUV 3D)
    OFFICIAL_FIVEM_CARS[3], // Pegassi Zentorno V12 (Lamborghini Aventador V12 3D)
    OFFICIAL_FIVEM_CARS[7], // Vapid Police Cruiser Interceptor (4-Door Police Sedan 3D)
    OFFICIAL_FIVEM_CARS[1]  // Karin Sultan RS (Tuner Coupe 3D)
  ];

  const [officialCategoryFilter, setOfficialCategoryFilter] = useState('all');
  const [officialSearchQuery, setOfficialSearchQuery] = useState('');

  const filteredOfficialCars = useMemo(() => {
    return OFFICIAL_FIVEM_CARS.filter(car => {
      const matchCategory = officialCategoryFilter === 'all' || car.classAr === officialCategoryFilter;
      const matchSearch = !officialSearchQuery.trim() ||
        car.name.toLowerCase().includes(officialSearchQuery.toLowerCase()) ||
        car.spawn.toLowerCase().includes(officialSearchQuery.toLowerCase()) ||
        car.badge.includes(officialSearchQuery) ||
        car.desc.includes(officialSearchQuery);
      return matchCategory && matchSearch;
    });
  }, [OFFICIAL_FIVEM_CARS, officialCategoryFilter, officialSearchQuery]);

  // Smart URL parser for GTA5-Mods links & 680 Vanilla GTA V vehicles
  const parseGtaCarFromUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    const clean = url.toLowerCase().trim();
    const parts = clean.split('/').filter(Boolean);
    const slug = parts[parts.length - 1] || clean;

    const matchedOfficial = OFFICIAL_FIVEM_CARS.find(c =>
      slug === c.spawn ||
      new RegExp(`(?:^|[^a-z0-9])${c.spawn}(?:$|[^a-z0-9])`, 'i').test(slug) ||
      (c.spawn === '00barch' && /550|barchetta|pininfarina|00barch/.test(slug)) ||
      (c.spawn === 'police3' && /police|cop|sheriff|interceptor|lspd|fbi|patrol/.test(slug)) ||
      (c.spawn === 'dubsta3' && /g63|gwagon|brabus|dubsta|baller|tahoe|suburban|escalade|jeep|wrangler|landcruiser|prado|hilux|raptor|trx|hummer|suv|4x4/.test(slug)) ||
      (c.spawn === 'zentorno' && /lambo|aventador|huracan|revuelto|veneno|countach|zentorno|torero|chiron|bugatti/.test(slug)) ||
      (c.spawn === 'turismor' && /ferrari|458|488|f8|turismo/.test(slug) && !/550|barchetta/.test(slug)) ||
      (c.spawn === 't20' && /mclaren|t20|p1|senna|720s/.test(slug)) ||
      (c.spawn === 'comet6' && /porsche|comet|gt3|911/.test(slug)) ||
      (c.spawn === 'buffalo4' && /dodge|charger|hellcat|buffalo|mustang|camaro/.test(slug)) ||
      (c.spawn === 'elegy2' && /skyline|gtr|elegy|r32|r34|r35|nissan|rx7|mazda|e30/.test(slug)) ||
      (c.spawn === 'sultanrs' && /sultan|subaru|\bevo\b|mitsubishi/.test(slug)) ||
      (c.spawn === 'jester4' && /supra|jester|toyota/.test(slug)) ||
      (c.spawn === 'kuruma2' && /kuruma|armored|insurgent|nightshark/.test(slug)) ||
      (c.spawn === 'drafter' && /audi|rs6|rs7|drafter/.test(slug)) ||
      (c.spawn === 'schafter3' && /schafter|s500|e63|c63|camry|accord|sonata|lexus|crown|caprice|sedan/.test(slug)) ||
      (c.spawn === 'gauntlet4' && /gauntlet|challenger/.test(slug)) ||
      (c.spawn === 'revolter' && /revolter|bmw|m4|m3|m5|m8/.test(slug))
    );

    if (matchedOfficial) return matchedOfficial;

    // Check if slug matches any of the 680 Vanilla GTA V vehicles using strict token boundaries
    const matchedVanilla = VANILLA_VEHICLES.find(
      v => slug === v.spawn || new RegExp(`(?:^|[^a-z0-9])${v.spawn}(?:$|[^a-z0-9])`, 'i').test(slug)
    );
    if (matchedVanilla) return matchedVanilla;

    // Check SUV / G63 / 4x4 keywords
    // AMG GT / GT R sports coupes (NOT G63 SUV — bare "amg" must not match)
    if (/amg[-\s]?gt|gt[-\s]?r|mercedes.?benz.?amg.?gt|mb.?amg.?gt/.test(slug) && !/g63|gwagon|g[-\s]?class/.test(slug)) {
      const words = slug.replace(/-/g, ' ').replace(/add on|tuning|2024|2023|2022|gta5|mods/gi, '').trim().split(' ').filter(Boolean);
      const titleName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Mercedes-AMG GT R';
      const cleanSpawn = slug.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase() || 'amggtr';
      return {
        name: titleName,
        spawn: cleanSpawn,
        preset: 'sports',
        category: 'Sports',
        audio: 'comet2',
        speed: 325,
        accel: 1.85,
        brake: 1.4,
        drivetrain: 'RWD',
        mass: 1630,
        color: '#16a34a',
        badge: 'AMG GT R',
        rim: 'sport_vossen',
        classAr: 'رياضية ألمانية',
        desc: 'كوبيه AMG GT — يُحمَّل مجسم YFT الأصلي من الرابط'
      };
    }

    if (/g63|gwagon|g[-\s]?class|dubsta|baller|tahoe|suburban|escalade|jeep|wrangler|landcruiser|prado|hilux|raptor|trx|hummer|suv|truck|4x4/.test(slug)) {
      const words = slug.replace(/-/g, ' ').replace(/add on|tuning|2024|2023|2022|gta5|mods/gi, '').trim().split(' ').filter(Boolean);
      const titleName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Mercedes-AMG G63 4x4';
      const cleanSpawn = slug.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase() || 'g63amg';
      return {
        name: titleName,
        spawn: cleanSpawn,
        preset: 'g63',
        category: 'SUVs',
        audio: 'dubsta',
        speed: 245,
        accel: 1.55,
        brake: 1.25,
        drivetrain: 'AWD',
        mass: 2450,
        color: '#0284c7',
        badge: 'دفع رباعي G63 4x4',
        rim: 'satin_black',
        classAr: 'دفع رباعي SUV',
        desc: 'سيارة دفع رباعي فاخرة بمجسم G63 ثلاثي الأبعاد كامل'
      };
    }

    // Fallback: Clean up slug into Title Case
    const words = slug.replace(/-/g, ' ').replace(/add on|tuning|2024|2023|2022|gta5|mods/gi, '').trim().split(' ').filter(Boolean);
    const titleName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Custom Supercar';
    const cleanSpawn = slug.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase() || 'customcar';

    return {
      name: titleName,
      spawn: cleanSpawn,
      preset: slug,
      category: 'Sports',
      audio: 'sultanrs',
      speed: 280,
      accel: 1.6,
      brake: 1.3,
      drivetrain: 'AWD',
      mass: 1550,
      color: '#0ea5e9',
      badge: 'سيارة معدلة',
      rim: 'sport_vossen',
      classAr: 'رياضية معدلة',
      desc: 'تم استخراج وتحليل مواصفات السيارة من الرابط بنجاح'
    };
  };

  // Tool Specific Interactive States
  // 1. Vehicle Editor V2, Badge Customizer & Siren/Wanan Studio
  const [carPreset, setCarPreset] = useState('00barch');
  const [carColor, setCarColor] = useState('#c81414');
  const [debadged, setDebadged] = useState(false);
  const [filledFlush, setFilledFlush] = useState(false);
  const [badgeMode, setBadgeMode] = useState('original');
  const [customBadgeTexture, setCustomBadgeTexture] = useState(null);
  const [badgeScale, setBadgeScale] = useState(1.0);
  const [sirenType, setSirenType] = useState('auto');
  const [sirenColorMode, setSirenColorMode] = useState('red_blue');
  const [sirenOffsetX, setSirenOffsetX] = useState(0);
  const [sirenOffsetY, setSirenOffsetY] = useState(0);
  const [sirenOffsetZ, setSirenOffsetZ] = useState(0);
  const [sirenRotX, setSirenRotX] = useState(0);
  const [sirenRotY, setSirenRotY] = useState(0);
  const [sirenRotZ, setSirenRotZ] = useState(0);
  const [sirenScale, setSirenScale] = useState(1.0);
  const [customLightbarUrl, setCustomLightbarUrl] = useState(null);
  const [customLightbarFormat, setCustomLightbarFormat] = useState('obj');
  const [customLightbarCacheId, setCustomLightbarCacheId] = useState(null);
  const [customLightbarName, setCustomLightbarName] = useState(null);
  const [lcpdfrPackId, setLcpdfrPackId] = useState(null);
  const [sirenAudioPack, setSirenAudioPack] = useState(null);
  const [pushbarEnabled, setPushbarEnabled] = useState(null);
  const [isBlenderPageOpen, setIsBlenderPageOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.location.search.includes('blender=true');
  });
  const [selectedRim, setSelectedRim] = useState('sport_vossen');
  const [selectedBodykit, setSelectedBodykit] = useState({ splitter: true, spoiler: true, exhaust: true });
  const [stanceCamber, setStanceCamber] = useState(0);
  const [stanceHeight, setStanceHeight] = useState(0);
  const [stanceOffset, setStanceOffset] = useState(0);
  const [customVehicleUrl, setCustomVehicleUrl] = useState(null);
  const [customVehicleFormat, setCustomVehicleFormat] = useState('glb');
  const [customVehicleYtdUrl, setCustomVehicleYtdUrl] = useState(null);
  const [customVehicleLivery, setCustomVehicleLivery] = useState(null);
  const [importStatusMsg, setImportStatusMsg] = useState('');

  // Lighting & Toggles
  const [headlightsOn, setHeadlightsOn] = useState(true);
  const [underglowOn, setUnderglowOn] = useState(false);
  const [underglowColor, setUnderglowColor] = useState('#06b6d4');

  // Database Tab Filter
  const [dbTab, setDbTab] = useState('vehicles');

  // 2. Chain Creator
  const [chainType, setChainType] = useState('cuban_12mm');
  const [chainMetal, setChainMetal] = useState('gold_24k');
  const [pendantText, setPendantText] = useState('LOS SANTOS');
  const [diamondGlow, setDiamondGlow] = useState(true);

  // 3. Prop Creator & AI
  const [collisionType, setCollisionType] = useState('mesh');
  const [lodLevels, setLodLevels] = useState(3);
  const [propScale, setPropScale] = useState(1.0);
  const [aiPropPrompt, setAiPropPrompt] = useState('مكتب إداري مودرن كربون مع إضاءة نيون');
  const [aiPropStyle, setAiPropStyle] = useState('modern');
  const [isGeneratingAiProp, setIsGeneratingAiProp] = useState(false);
  const [showYtypPreview, setShowYtypPreview] = useState(false);

  // 4. Weapon Skins & Creator
  const [selectedWeapon, setSelectedWeapon] = useState('WEAPON_CARBINE');
  const [camoSkin, setCamoSkin] = useState('damascus');
  const [weaponDamage, setWeaponDamage] = useState(38);

  // 5. Plate Creator
  const [plateText, setPlateText] = useState('SAN ANDREAS');
  const [plateNumber, setPlateNumber] = useState('5F 777');
  const [embossed3D, setEmbossed3D] = useState(true);

  // 6. Shell Creator
  const [shellRooms, setShellRooms] = useState(2);
  const [wallStyle, setWallStyle] = useState('modern_wood');
  const [shellPreset, setShellPreset] = useState('apartment_2room');
  const [ceilingHeight, setCeilingHeight] = useState(3.2);

  // 7. Retexture 3D
  const [selectedMeshPart, setSelectedMeshPart] = useState('Front Wall');
  const [retextureColor, setRetextureColor] = useState('#f59e0b');

  // 8. Tattoo Creator
  const [tattooZone, setTattooZone] = useState('ZONE_CHEST');
  const [tattooScale, setTattooScale] = useState(1.0);

  // 9. Livery Mapper
  const [liverySlot, setLiverySlot] = useState('livery_default');
  const [liveryFinish, setLiveryFinish] = useState('gloss');
  const [selectedSticker, setSelectedSticker] = useState('brembo');

  // 10. ELS Converter
  const [elsDetectedSirens, setElsDetectedSirens] = useState(8);
  const [sirenPatternSpeed, setSirenPatternSpeed] = useState('standard');

  // 11. Clothing Textures
  const [clothingSlot, setClothingSlot] = useState('upper');
  const [clothingPattern, setClothingPattern] = useState('streetwear');
  const [clothingColor, setClothingColor] = useState('#18181b');

  // 12. Boat Creator
  const [boatBuoyancy, setBoatBuoyancy] = useState(0.85);
  const [boatSpeed, setBoatSpeed] = useState(145);

  // 13. AI Ped Creator
  const [pedBuild, setPedBuild] = useState('normal');
  const [pedGender, setPedGender] = useState('mp_m_freemode_01');

  // 14. Optimizers & Hub
  const [targetTexRes, setTargetTexRes] = useState('2048');
  const [enableMipmaps, setEnableMipmaps] = useState(true);
  const [vramSavedMb, setVramSavedMb] = useState(64.2);

  // Persistent User Library States
  const [savedProjects, setSavedProjects] = useState([
    { id: 'proj_1', name: 'GTR Nismo Carbon Kit', tool: 'Vehicle Editor V2', date: '2026-10-15', thumbColor: '#38bdf8' },
    { id: 'proj_2', name: 'Diamond Cuban Chain', tool: 'Chain Creator', date: '2026-10-16', thumbColor: '#f59e0b' },
    { id: 'proj_3', name: 'Penthouse Housing Shell', tool: 'Shell Creator', date: '2026-10-16', thumbColor: '#10b981' }
  ]);

  const [savedParts, setSavedParts] = useState([
    { id: 'part_1', name: 'Carbon Fiber GT Wing', type: 'Spoiler', sourceVehicle: 'GTR Nismo' },
    { id: 'part_2', name: 'Vossen CV3 20-inch', type: 'Rim', sourceVehicle: 'Challenger Hellcat' },
    { id: 'part_3', name: 'Titanium Dual Exhaust Tips', type: 'Exhaust', sourceVehicle: 'Supra MK5' },
    { id: 'part_4', name: '3D Gold Demon Pendant', type: 'Jewelry', sourceVehicle: 'Custom Ped' }
  ]);

  const [exportHistoryLog, setExportHistoryLog] = useState([
    { id: 'exp_1', name: 'nismo_widebody.zip', tool: 'Vehicle Editor V2', size: '24.2 MB', date: 'قبل 2 ساعة', freeReExportDays: 7 },
    { id: 'exp_2', name: 'iced_cuban_chain.zip', tool: 'Chain Creator', size: '3.8 MB', date: 'قبل 5 ساعات', freeReExportDays: 7 },
    { id: 'exp_3', name: 'modern_luxury_shell.zip', tool: 'Shell Creator', size: '14.1 MB', date: 'أمس', freeReExportDays: 6 }
  ]);

  // Server Hub Logs Stream
  const [serverLogs] = useState([
    { time: '02:14:10', type: 'INFO', msg: '[FiveForge] Resource "nismo_widebody" streaming validated (0 warnings, 0 red assets).' },
    { time: '02:14:15', type: 'SYNC', msg: '[Server] 48 players connected to Los Santos Roleplay.' },
    { time: '02:14:22', type: 'RESOURCE', msg: '[FiveForge] Texture memory budget: 852MB / 2048MB (Healthy).' },
    { time: '02:14:29', type: 'SCREENSHOT', msg: '[Player] ID 14 uploaded in-game phone camera photo #img_9918.' }
  ]);

  // Active Tool Object
  const currentTool = useMemo(() => {
    return FIVEFORGE_MANIFEST.tools.find(t => t.id === activeToolId) || null;
  }, [activeToolId]);

  // Filtered Tools for browsing
  const filteredTools = useMemo(() => {
    return FIVEFORGE_MANIFEST.tools.filter(t => {
      const matchCategory = selectedCategory === 'all' || t.category === selectedCategory;
      const matchSearch = !searchQuery.trim() || 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.nameAr.includes(searchQuery) ||
        t.description.includes(searchQuery);
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Live GTA5-Mods RPF -> YFT + YTD Downloader & Unpacker
  const fetchRealGta5ModsCar = async (queryOrUrl) => {
    if (!queryOrUrl || typeof queryOrUrl !== 'string') return false;
    try {
      setIsImporting(true);
      setImportProgress(35);
      setImportStage(2);
      setImportStatusMsg('جاري تحميل وفك ضغط مجسم السيارة الأصلي (.RPF / .YFT + .YTD) من GTA5-Mods...');

      let data = null;
      try {
        const resp = await fetch(`/api/fetch-gta5mods-car?url=${encodeURIComponent(queryOrUrl.trim())}`);
        if (resp.ok) {
          data = await resp.json();
        }
      } catch {}

      if ((!data || !data.ok) && typeof window !== 'undefined' && window.require) {
        try {
          const { ipcRenderer } = window.require('electron');
          data = await ipcRenderer.invoke('fetch-gta5mods-car', queryOrUrl.trim());
        } catch {}
      }

      if (data && data.ok && data.yftUrl) {
        setCustomVehicleUrl(data.yftUrl);
        setCustomVehicleFormat('yft');
        setCustomVehicleYtdUrl(data.ytdUrl || null);

        const cleanTitle = (data.title || '')
          .replace(/\[.*?\]/g, '')
          .replace(/\s+/g, ' ')
          .trim() || data.spawnCode;

        setImportedCarMeta((prev) => ({
          ...prev,
          displayName: cleanTitle,
          spawnCode: data.spawnCode || prev.spawnCode
        }));
        if (data.spawnCode) {
          setModelNameInput(data.spawnCode);
          setCarPreset(data.spawnCode);
        }
        if (/ferrari|550|barchetta/i.test(cleanTitle)) {
          setCarColor('#c81414');
        } else if (/amg|mercedes|gt\s*r/i.test(cleanTitle)) {
          setCarColor('#16a34a');
        }
        setImportStatusMsg(`✅ تم استيراد المجسم الأصلي (${data.yftName}) + التكستشرات (${data.ytdName || 'YTD'}) بنجاح!`);
        setImportProgress(100);
        setImportStage(4);
        setIsImporting(false);
        return true;
      }

      const errMsg = data?.error || data?.message || 'الموقع ما رجّع ملف YFT صالح';
      setImportStatusMsg(`❌ فشل سحب الموديل من الرابط: ${errMsg}. المعاينة الحالية مؤقتة — جرّب رابط مباشرة أو ارفع ZIP.`);
    } catch (err) {
      console.warn('[GTA5Mods Fetch Error]', err);
      setImportStatusMsg(`❌ خطأ أثناء الاستيراد: ${err?.message || err}`);
    }
    setImportProgress(100);
    setImportStage(4);
    setIsImporting(false);
    return false;
  };

  // Auto-load real YFT+YTD when car_importer opens with 00barch or ?carUrl=...
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const carUrlParam = params.get('carUrl');
    if (carUrlParam) {
      setImporterUrl(carUrlParam);
      fetchRealGta5ModsCar(carUrlParam);
    }
    // Do NOT auto-fetch Ferrari on open — that caused wrong-car mismatch vs typed URL
  }, [activeToolId]);

  // Handle Real-time URL Input Changes & Dynamic Vehicle Recognition
  const handleUrlChange = (newUrl) => {
    setImporterUrl(newUrl);
    const parsed = parseGtaCarFromUrl(newUrl);
    if (parsed) {
      setImportedCarMeta(prev => ({
        ...prev,
        displayName: parsed.name,
        spawnCode: parsed.spawn,
        category: parsed.category,
        audioHash: parsed.audio,
        topSpeed: parsed.speed,
        accelMultiplier: parsed.accel,
        brakeForce: parsed.brake,
        drivetrain: parsed.drivetrain,
        mass: parsed.mass
      }));
      setModelNameInput(parsed.spawn);
      setCarPreset(parsed.preset || parsed.spawn);
      if (parsed.color) setCarColor(parsed.color);
      if (parsed.rim) setSelectedRim(parsed.rim);
    }
  };

  // Execute Car Extraction Pipeline (Stage 1 -> 4)
  const handleStartImportCar = async (target = null) => {
    setIsImporting(true);
    setImportProgress(12);
    setImportStage(1);

    let chosen;
    let urlToFetch = null;

    if (target && typeof target === 'object') {
      chosen = target;
      if (target.gta5ModsUrl) {
        urlToFetch = target.gta5ModsUrl;
        setImporterUrl(target.gta5ModsUrl);
      } else {
        setCustomVehicleUrl(null);
        setCustomVehicleYtdUrl(null);
      }
    } else {
      const urlToParse = typeof target === 'string' ? target : importerUrl;
      chosen = parseGtaCarFromUrl(urlToParse) || OFFICIAL_FIVEM_CARS[0];
      if (
        urlToParse &&
        (urlToParse.includes('gta5-mods.com') ||
          chosen.gta5ModsUrl ||
          !/^(sultanrs|zentorno|turismor|revolter|police3|dubsta3|g63)$/i.test(urlToParse.trim()))
      ) {
        urlToFetch = urlToParse.includes('gta5-mods.com') ? urlToParse : (chosen.gta5ModsUrl || urlToParse);
      } else {
        setCustomVehicleUrl(null);
        setCustomVehicleYtdUrl(null);
      }
    }

    setImportedCarMeta({
      displayName: chosen.name,
      spawnCode: chosen.spawn,
      category: chosen.category,
      audioHash: chosen.audio,
      topSpeed: chosen.speed,
      accelMultiplier: chosen.accel,
      brakeForce: chosen.brake,
      drivetrain: chosen.drivetrain,
      mass: chosen.mass
    });
    setModelNameInput(chosen.spawn);
    setCarPreset(chosen.preset || chosen.spawn);
    if (chosen.color) setCarColor(chosen.color);
    if (chosen.rim) setSelectedRim(chosen.rim);

    // Immediately open the Full-Screen Blender 3D Viewport Page with the imported car centered on the grid
    setIsBlenderPageOpen(true);

    if (urlToFetch) {
      // Clear previous YFT/GLB so old Ferrari/etc. never stays while a new URL loads
      setCustomVehicleUrl(null);
      setCustomVehicleYtdUrl(null);
      setCustomVehicleLivery(null);
      const ok = await fetchRealGta5ModsCar(urlToFetch);
      if (!ok) {
        setImportStatusMsg((prev) =>
          prev?.startsWith('❌')
            ? prev
            : '❌ ما انسحب الموديل من الرابط — تأكد إن الصفحة فيها Download وأن السيرفر يقدر يوصل لـ gta5-mods'
        );
      }
      return;
    }

    setTimeout(() => {
      setImportProgress(38);
      setImportStage(2);
    }, 350);

    setTimeout(() => {
      setImportProgress(72);
      setImportStage(3);
    }, 700);

    setTimeout(() => {
      setImportProgress(100);
      setImportStage(4);
      setIsImporting(false);
    }, 1050);
  };

  // Handle Export Resource with Credit Logic
  const handleExportCurrentTool = async () => {
    if (!currentTool) return;
    setIsExporting(true);
    setExportNotice(null);

    try {
      const hasSirenActive =
        (sirenType && sirenType !== 'none' && sirenType !== 'auto') ||
        (sirenType === 'auto' && (importedCarMeta.category === 'Emergency' || /police|sheriff|fbi|pranger/i.test(carPreset))) ||
        Boolean(sirenAudioPack);

      const sirenExport = buildSirenExportMeta({
        sirenType: hasSirenActive ? (sirenType === 'auto' ? 'lightbar_led' : sirenType) : 'none',
        sirenColorMode,
        lcpdfrPackId,
        audioPack: sirenAudioPack,
        customLightbarName,
        sirenOffsetY,
        sirenOffsetZ,
        sirenScale
      });

      const customMeta = {
        brand: 'FiveForge',
        displayName: importedCarMeta.displayName,
        vehicleClass: hasSirenActive
          ? 'VC_EMERGENCY'
          : importedCarMeta.category === 'Super'
          ? 'VC_SUPER'
          : importedCarMeta.category === 'Muscle'
          ? 'VC_MUSCLE'
          : 'VC_SPORT',
        audioHash: importedCarMeta.audioHash,
        hasSiren: hasSirenActive,
        sirenType,
        sirenColorMode,
        sirenExport,
        badgeMode,
        topSpeed: importedCarMeta.topSpeed,
        accelMultiplier: importedCarMeta.accelMultiplier,
        brakeForce: importedCarMeta.brakeForce,
        drivetrain: importedCarMeta.drivetrain,
        mass: importedCarMeta.mass,
        handling: {
          topSpeed: importedCarMeta.topSpeed,
          accelMultiplier: importedCarMeta.accelMultiplier,
          brakeForce: importedCarMeta.brakeForce,
          drivetrain: importedCarMeta.drivetrain,
          mass: importedCarMeta.mass,
          buoyancy: boatBuoyancy
        }
      };

      const { blob, filename } = await packageFiveMResource({
        resourceName: modelNameInput,
        modelName: modelNameInput,
        toolId: currentTool.id,
        toolCategory: currentTool.category,
        customMeta
      });

      triggerDownload(blob, filename);

      setExportNotice({
        type: 'success',
        text: '✅ تم تصدير حزمة FiveM Addon بنجاح — مجاناً بدون نظام عملات'
      });

      // Add to export history
      setExportHistoryLog(prev => [
        { id: 'exp_' + Date.now(), name: filename, tool: currentTool.name, size: '8.4 MB', date: 'الآن', freeReExportDays: 7 },
        ...prev
      ]);
    } catch (err) {
      setExportNotice({ type: 'error', text: `فشل تجهيز المورد: ${err.message}` });
    } finally {
      setIsExporting(false);
    }
  };

  // Launch a tool into its 3D workspace
  const launchTool = (tool) => {
    setActiveToolId(tool.id);
    setModelNameInput(tool.id.replace(/[^a-z0-9_]/g, '_'));
    setExportNotice(null);
    setUploadedFileName(null);
    if (tool.id === 'car_importer') {
      setModelNameInput('00barch');
      setCarPreset('00barch');
      setCarColor('#c81414');
    }
  };

  // Bridge for the Arabic AI assistant in App.jsx — any FiveM car/siren/ped request
  if (typeof window !== 'undefined') {
    window.__fiveforge = {
      openCarStudio: (preset = 'police3') => {
        const tool = FIVEFORGE_MANIFEST.tools.find((t) => t.id === 'car_importer');
        if (tool) launchTool(tool);
        setCarPreset(preset);
        setModelNameInput(preset);
        setIsBlenderPageOpen(true);
      },
      setSirenType: (t) => setSirenType(t),
      setSirenColorMode: (c) => setSirenColorMode(c),
      setBadgeMode: (b) => {
        setBadgeMode(b);
        setDebadged(b === 'debadged');
      },
      setCarColor: (c) => setCarColor(c),
      setLcpdfrPackId: (id) => setLcpdfrPackId(id),
      setPushbarEnabled: (v) => setPushbarEnabled(v),
      exportZip: () => handleExportCurrentTool(),
      resetSirenOffsets: () => {
        setSirenOffsetX(0);
        setSirenOffsetY(0);
        setSirenOffsetZ(0);
        setSirenRotX(0);
        setSirenRotY(0);
        setSirenRotZ(0);
        setSirenScale(1);
      }
    };
  }

  // Save current part into My Parts
  const savePartToLibrary = (partName, partType) => {
    setSavedParts(prev => [
      { id: 'part_' + Date.now(), name: partName, type: partType, sourceVehicle: modelNameInput },
      ...prev
    ]);
    alert(`✅ تم حفظ القطعة "${partName}" في مكتبة My parts الخاصة بك! يمكنك استخدامها على أي سيارة أخرى.`);
  };

  return (
    <div className={`w-full bg-[#0d0d11] text-neutral-100 rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden flex flex-col font-sans ${className}`}>
      
      {/* 1. TOP HEADER NAVIGATION BAR */}
      <header className="px-5 py-3.5 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between gap-4 flex-wrap">
        
        {/* Brand & Suite Codename */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-black font-black text-sm">
            5F
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide">FiveForge Titan Studio</h2>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/30">
                20 أدوات متكاملة
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">المنظومة السحابية الكاملة لتعديل أصول FiveM و GTA V بدون برامج</p>
          </div>
        </div>

        {/* Master Navigation Links */}
        <nav className="flex items-center gap-1 bg-neutral-950 p-1 rounded-2xl border border-neutral-800/80 flex-wrap">
          {FIVEFORGE_MANIFEST.navSections.map(sec => {
            const Icon = sec.id === 'overview' ? LayoutDashboard :
              sec.id === 'tools' ? Layers :
              sec.id === 'projects' ? FolderGit2 :
              sec.id === 'parts' ? Wrench :
              sec.id === 'exports' ? Download :
              sec.id === 'database' ? Database : Server;

            const isActive = activeSection === sec.id && !activeToolId;

            return (
              <button
                key={sec.id}
                onClick={() => {
                  setActiveSection(sec.id);
                  setActiveToolId(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.nameAr}</span>
              </button>
            );
          })}
        </nav>

        {/* User Pill — no coin/credits wallet */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-neutral-950 border border-emerald-500/25 px-3 py-1.5 rounded-2xl">
            <span className="text-[10px] font-bold text-emerald-400">Studio Pro · تصدير مجاني</span>
          </div>
          <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 px-2.5 py-1 rounded-2xl">
            <img src={user.avatar} alt="User" className="w-6 h-6 rounded-full bg-neutral-800" />
            <span className="text-[11px] font-medium text-neutral-200 hidden sm:inline">{user.username}</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTENT BODY */}
      <div className="flex-1 overflow-y-auto min-h-[620px] p-4 lg:p-6">

        {/* SECTION A: OVERVIEW DASHBOARD */}
        {activeSection === 'overview' && !activeToolId && (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Top Hero Banner */}
            <div className="bg-gradient-to-r from-amber-950/40 via-neutral-900/80 to-neutral-950 p-6 rounded-3xl border border-amber-500/30 shadow-2xl flex items-center justify-between gap-6 flex-wrap">
              <div className="space-y-2 max-w-xl">
                <span className="text-[10px] bg-amber-500/20 text-amber-400 font-mono px-2.5 py-1 rounded-full border border-amber-500/30">
                  ⚡ FiveForge Ecosystem v3.0
                </span>
                <h1 className="text-2xl font-black text-white">منظومة FiveForge الكاملة (20 أداة متطورة)</h1>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  أنشئ وعدل وصدر سياراتك، شخصياتك، أسلحتك، مجسماتك، وسلاسل الذهب واللوحات وشيلات الإسكان مباشرة من المتصفح في 3 خطوات سهلة وبدون الحاجة لبرامج خارجية.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveSection('tools')}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                  >
                    <span>استعراض الأدوات الـ 20</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => launchTool(FIVEFORGE_MANIFEST.tools[3])} // Vehicle Editor V2
                    className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>تجربة محرر السيارات V2</span>
                  </button>
                </div>
              </div>

              {/* Quick Metrics Badges */}
              <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
                <div className="p-4 bg-neutral-950/80 rounded-2xl border border-neutral-800 text-center">
                  <div className="text-2xl font-black text-amber-400 font-mono">20</div>
                  <div className="text-[10px] text-neutral-400">أداة نشطة ومكتملة</div>
                </div>
                <div className="p-4 bg-neutral-950/80 rounded-2xl border border-neutral-800 text-center">
                  <div className="text-2xl font-black text-emerald-400 font-mono">1,420+</div>
                  <div className="text-[10px] text-neutral-400">أصل تم بناؤه</div>
                </div>
                <div className="p-4 bg-neutral-950/80 rounded-2xl border border-neutral-800 text-center">
                  <div className="text-2xl font-black text-blue-400 font-mono">99.98%</div>
                  <div className="text-[10px] text-neutral-400">جهوزية واستقرار</div>
                </div>
                <div className="p-4 bg-neutral-950/80 rounded-2xl border border-neutral-800 text-center">
                  <div className="text-2xl font-black text-purple-400 font-mono">7 Days</div>
                  <div className="text-[10px] text-neutral-400">إعادة تصدير مجاني</div>
                </div>
              </div>
            </div>

            {/* Popular Tools Carousel / Quick Access */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-200">الأدوات الأكثر استخداماً</h3>
                <span className="text-[10px] text-neutral-400">تشغيل فوري بضغطة زر</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {[
                  FIVEFORGE_MANIFEST.tools[0], // Prop Creator
                  FIVEFORGE_MANIFEST.tools[3], // Vehicle Editor V2
                  FIVEFORGE_MANIFEST.tools[9], // Chain Creator
                  FIVEFORGE_MANIFEST.tools[7]  // Weapon Skins
                ].map(tool => (
                  <div 
                    key={tool.id}
                    onClick={() => launchTool(tool)}
                    className="p-4 bg-neutral-950 hover:bg-neutral-900/80 border border-neutral-800 hover:border-amber-500/60 rounded-2xl transition cursor-pointer group shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/30">
                          {tool.badge}
                        </span>
                        <span className="text-[10px] text-amber-400 font-mono font-bold">
                          مجاني
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-2 group-hover:text-amber-400 transition">{tool.nameAr}</h4>
                      <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">{tool.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-neutral-900 text-xs text-amber-400 font-semibold">
                      <span>فتح الأداة</span>
                      <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SECTION B: ALL TOOLS EXPLORER (GRID & LIST) */}
        {activeSection === 'tools' && !activeToolId && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Search and Category Filter Toolbar */}
            <div className="bg-neutral-950 p-4 rounded-3xl border border-neutral-800 flex items-center justify-between gap-4 flex-wrap">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {FIVEFORGE_MANIFEST.categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      selectedCategory === cat.id
                        ? 'bg-amber-500 text-black font-bold shadow'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-850'
                    }`}
                  >
                    {cat.nameAr}
                  </button>
                ))}
              </div>

              {/* Search & Grid/List View Controls */}
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث في الـ 20 أداة..."
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                  />
                </div>

                <div className="flex items-center bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-amber-500 text-black' : 'text-neutral-400'}`}
                    title="عرض البطاقات (Grid)"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-amber-500 text-black' : 'text-neutral-400'}`}
                    title="عرض القائمة (List)"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Results Counter */}
            <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
              <span>عرض {filteredTools.length} من أصل 20 أداة متطورة</span>
              <span>نظام الـ 3 خطوات الموحد: الرفع ← المعاينة 3D ← التصدير</span>
            </div>

            {/* Tools Container (Grid View) */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTools.map(tool => (
                  <div
                    key={tool.id}
                    onClick={() => launchTool(tool)}
                    className="p-5 bg-neutral-950 hover:bg-neutral-900/90 border border-neutral-800 hover:border-amber-500/60 rounded-3xl transition cursor-pointer group shadow-xl flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges & Number */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center font-mono font-bold text-xs text-amber-400">
                            {tool.number}
                          </span>
                          <span className="text-[9px] bg-neutral-900 text-neutral-300 font-mono px-2 py-0.5 rounded-full border border-neutral-800">
                            {tool.badge}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-amber-400">
                          مجاني
                        </span>
                      </div>

                      {/* Tool Title & Description */}
                      <h4 className="text-base font-bold text-white mt-3 group-hover:text-amber-400 transition">
                        {tool.nameAr}
                      </h4>
                      <span className="text-[10px] text-neutral-500 font-mono block mt-0.5">{tool.name}</span>
                      <p className="text-xs text-neutral-400 mt-2 line-clamp-3 leading-relaxed">
                        {tool.description}
                      </p>

                      {/* Input File Formats Badges */}
                      <div className="flex items-center gap-1 flex-wrap mt-3 pt-3 border-t border-neutral-900">
                        {tool.inputFormats.map((fmt, fIdx) => (
                          <span key={fIdx} className="text-[9px] bg-neutral-900/80 text-amber-300/80 font-mono px-1.5 py-0.5 rounded border border-neutral-800">
                            {fmt}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Launch Action Footer */}
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-neutral-900">
                      <span className="text-xs font-bold text-amber-400 group-hover:underline">فتح الأداة والبدء</span>
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-1 rounded-xl group-hover:bg-amber-500 group-hover:text-black transition">
                        Launch 3D
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Tools Container (List View) */
              <div className="space-y-2.5">
                {filteredTools.map(tool => (
                  <div
                    key={tool.id}
                    onClick={() => launchTool(tool)}
                    className="p-4 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-500/60 rounded-2xl transition cursor-pointer flex items-center justify-between gap-4 shadow group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center font-mono font-bold text-sm text-amber-400 shrink-0">
                        {tool.number}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition">{tool.nameAr}</h4>
                          <span className="text-[10px] text-neutral-500 font-mono">({tool.name})</span>
                          <span className="text-[9px] bg-neutral-900 text-neutral-300 px-2 py-0.2 rounded-full border border-neutral-800">
                            {tool.badge}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 truncate mt-0.5">{tool.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs font-mono font-bold text-emerald-400">مجاني</span>
                      <button className="px-3 py-1.5 rounded-xl bg-amber-500/20 group-hover:bg-amber-500 text-amber-300 group-hover:text-black text-xs font-bold transition">
                        تشغيل
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION C: ACTIVE TOOL WORKSPACE (THE UNIFIED 3-STEP PIPELINE) */}
        {activeToolId && currentTool && (
          <div className="space-y-4 max-w-7xl mx-auto">
            {/* Top Workspace Breadcrumb & Return Button */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800">
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setActiveToolId(null)}
                  className="text-amber-400 hover:underline flex items-center gap-1 font-bold"
                >
                  ← العودة لكافة الأدوات الـ 20
                </button>
                <span className="text-neutral-600">/</span>
                <span className="text-white font-bold">{currentTool.nameAr} ({currentTool.name})</span>
                <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/30">
                  الأداة #{currentTool.number}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 font-mono">التصدير: <b className="text-emerald-400">مجاني</b></span>
                <span className="text-[10px] bg-neutral-900 text-emerald-400 px-2 py-0.5 rounded-lg border border-neutral-800">
                  🛡️ حماية 7 أيام مجانية
                </span>
              </div>
            </div>

            {/* Split View: Left Controls (Step 1 & Step 3) + Right 3D Viewport (Step 2) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              
              {/* Left Column: Input + Tool Controls + Export (5 cols on lg) */}
              <div className="lg:col-span-5 space-y-3.5 flex flex-col justify-between">
                
                <div className="space-y-3">
                  {/* STEP 1: INPUT AREA */}
                  <div className="bg-neutral-950 p-4 rounded-3xl border border-neutral-800 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-[10px]">1</span>
                        <span>الرفع / الاختيار (Input)</span>
                      </span>
                      <span className="text-[9px] text-neutral-400 font-mono">الصيغ: {currentTool.inputFormats.slice(0, 3).join(', ')}</span>
                    </div>

                    {/* A) CAR IMPORTER (Tool #3) */}
                    {currentTool.id === 'car_importer' ? (
                      <div className="space-y-3">
                        {/* Source Tab Switcher (3 Modes) */}
                        <div className="flex items-center bg-neutral-900 p-1 rounded-2xl border border-neutral-800 text-xs gap-1">
                          <button
                            type="button"
                            onClick={() => setImporterTab('url')}
                            className={`flex-1 py-1.5 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs ${
                              importerTab === 'url' ? 'bg-amber-500 text-black shadow-md' : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">رابط مباشر</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImporterTab('official')}
                            className={`flex-1 py-1.5 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs ${
                              importerTab === 'official' ? 'bg-amber-500 text-black shadow-md' : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            <Car className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">سيارات قراند الأصلية</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImporterTab('file')}
                            className={`flex-1 py-1.5 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-xs ${
                              importerTab === 'file' ? 'bg-amber-500 text-black shadow-md' : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">رفع ZIP من gta5-mods</span>
                          </button>
                        </div>

                        {/* MODE 1: DIRECT GTA5-MODS URL INPUT */}
                        {importerTab === 'url' && (
                          <div className="space-y-2.5">
                            <label className="text-[10px] text-neutral-400 block font-semibold">
                              أدخل رابط السيارة من gta5-mods.com أو اسم الموديل:
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={importerUrl}
                                onChange={(e) => handleUrlChange(e.target.value)}
                                placeholder="https://www.gta5-mods.com/vehicles/..."
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pr-3 pl-8 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                              />
                              {importerUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleUrlChange('')}
                                  className="absolute left-2.5 top-2.5 text-neutral-500 hover:text-white text-xs cursor-pointer"
                                >
                                  ✕
                                </button>
                              )}
                            </div>

                            {/* Live Recognized Vehicle Status Banner */}
                            {importedCarMeta && (
                              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div 
                                    className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 shadow-sm"
                                    style={{ backgroundColor: carColor }} 
                                  />
                                  <div className="min-w-0">
                                    <div className="text-[11px] font-bold text-white flex items-center gap-1.5 truncate">
                                      <span className="text-emerald-400 shrink-0">● تم التعرف:</span>
                                      <span className="truncate">{importedCarMeta.displayName}</span>
                                    </div>
                                    <div className="text-[9px] text-neutral-400 font-mono truncate">
                                      Spawn: <b className="text-amber-400">{importedCarMeta.spawnCode}</b> | الفئة: {importedCarMeta.category} | الدفع: {importedCarMeta.drivetrain}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-mono shrink-0 border border-amber-500/30">
                                  مُحدّث بالـ 3D
                                </span>
                              </div>
                            )}

                            {/* Quick Demo Presets */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] text-neutral-400 font-semibold block">أو اختر سيارة للتجربة المباشرة (1-Click Test):</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {CAR_PRESETS.map(preset => (
                                  <button
                                    key={preset.spawn}
                                    type="button"
                                    onClick={() => handleStartImportCar(preset)}
                                    className={`p-2 rounded-xl border text-right transition flex items-center justify-between cursor-pointer ${
                                      importedCarMeta.spawnCode === preset.spawn
                                        ? 'bg-amber-500/15 border-amber-500 text-white'
                                        : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-[11px] font-bold truncate">{preset.name}</div>
                                      <div className="text-[9px] text-amber-400 font-mono">Spawn: {preset.spawn}</div>
                                    </div>
                                    <span className="text-[9px] bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400 shrink-0">
                                      {preset.badge}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Execute Import Action Button (Enters Full-Screen Blender 3D Viewport Page) */}
                            <button
                              type="button"
                              onClick={() => handleStartImportCar(importerUrl)}
                              disabled={isImporting}
                              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-black" />}
                              <span>{isImporting ? 'جاري فتح مساحة بلندر 3D...' : '⚡ استرداد / استيراد السيارة وفتح صفحة بلندر 3D الكاملة'}</span>
                            </button>
                          </div>
                        )}

                        {/* MODE 2: OFFICIAL FIVEM & GTA V VEHICLES GALLERY (14 Featured + 680 Vanilla) */}
                        {importerTab === 'official' && (
                          <VanillaCarCatalog
                            featuredCars={OFFICIAL_FIVEM_CARS}
                            selectedSpawn={importedCarMeta.spawnCode}
                            onSelect={(car) => handleStartImportCar(car)}
                          />
                        )}

                        {/* MODE 3: FILE UPLOAD (ZIP / YFT / YTD / GLB / OBJ) */}
                        {importerTab === 'file' && (
                          <RealGta5ModsImporter
                            urlHint={importerUrl && importerUrl.includes('gta5-mods') ? importerUrl : ''}
                            onDetected={(spawn, gameName) =>
                              handleStartImportCar({
                                ...(parseGtaCarFromUrl(spawn) || {}),
                                name: gameName || spawn,
                                spawn
                              })
                            }
                            onCustomModelLoaded={(blobUrl, ext, ytdBlobUrl) => {
                              setCustomVehicleUrl(blobUrl);
                              setCustomVehicleFormat(ext);
                              setCustomVehicleYtdUrl(ytdBlobUrl || null);
                              setIsBlenderPageOpen(true);
                            }}
                            onApplyLivery={(dataUrl) => setCustomVehicleLivery(dataUrl)}
                          />
                        )}

                        {/* INSTANT SIREN (WANAN) & BADGE CUSTOMIZER ON IMPORTED CAR */}
                        <div className="p-3 bg-gradient-to-br from-blue-950/40 via-neutral-900 to-amber-950/30 rounded-2xl border border-amber-500/40 space-y-2.5 shadow-inner">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-black text-white flex items-center gap-1.5">
                              <span>🚨</span>
                              <span>تعديل الشعارات وإضافة ونان على السيارة المستوردة:</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsBlenderPageOpen(true)}
                              className="text-[9px] bg-[#4772b3] hover:bg-[#5885c9] text-white px-2.5 py-1 rounded-lg border border-blue-400/50 font-bold cursor-pointer shadow"
                            >
                              🖥️ فتح صفحة بلندر 3D الكاملة
                            </button>
                          </div>

                          {/* 1. Siren / Wanan Quick Buttons */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-neutral-300 font-semibold">
                              <span>1️⃣ إضافة ونان وسفتي للسيارة (Vehicle Siren / Wanan):</span>
                              <button
                                type="button"
                                onClick={() => setPushbarEnabled((prev) => !prev)}
                                className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition cursor-pointer ${
                                  pushbarEnabled
                                    ? 'bg-emerald-500 text-black'
                                    : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-white'
                                }`}
                              >
                                {pushbarEnabled ? '✅ دعامة الصدم مركبة' : '➕ دعامة صدم أمامية'}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                              {[
                                { id: 'none', label: '❌ بدون ونان' },
                                { id: 'setina_pb400_led', label: '🛡️ دعامة Setina + 4 فلاشات' },
                                { id: 'lightbar_led', label: '🚓 ونان سقف شرطة LED' },
                                { id: 'visor_unmarked', label: '🕵️ ونان سري داخلي + شبك' },
                                { id: 'soundoff_ion', label: '🚨 SoundOff Ion + لوحة' },
                                { id: 'hideaway_vertex', label: '⚡ Hide-A-Way مخفي' },
                                { id: 'roof_single_beacon', label: '🚨 ونان مغناطيسي فردي' },
                                { id: 'beacon_classic', label: '🚔 ونان كشافات دائرية' }
                              ].map((sOpt) => (
                                <button
                                  key={sOpt.id}
                                  type="button"
                                  onClick={() => setSirenType(sOpt.id)}
                                  className={`py-1.5 px-2 rounded-xl text-[9px] font-bold transition cursor-pointer truncate ${
                                    sirenType === sOpt.id
                                      ? 'bg-blue-600 text-white border border-blue-400 shadow'
                                      : 'bg-neutral-950 text-neutral-300 border border-neutral-800 hover:border-neutral-700'
                                  }`}
                                >
                                  {sOpt.label}
                                </button>
                              ))}
                              <select
                                value={sirenColorMode}
                                onChange={(e) => setSirenColorMode(e.target.value)}
                                className="bg-neutral-950 border border-neutral-800 rounded-xl px-1.5 py-1 text-[9px] text-amber-300 font-bold cursor-pointer"
                              >
                                <option value="red_blue">🔵🔴 أحمر وأزرق</option>
                                <option value="blue_only">🔵🔵 أزرق بالكامل</option>
                                <option value="red_white">🔴⚪ أحمر وأبيض</option>
                                <option value="amber_gold">🟠🟡 برتقالي ذهبي</option>
                              </select>
                            </div>
                          </div>

                          {/* 2. Badge / Emblem Replacer Quick Buttons */}
                          <div className="space-y-1 pt-1 border-t border-neutral-800/80">
                            <div className="flex items-center justify-between text-[10px] text-neutral-300 font-semibold">
                              <span>2️⃣ تغيير أو إزالة شعارات السيارة (3D Emblems):</span>
                              <label className="text-[9px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-lg border border-amber-500/40 cursor-pointer font-bold">
                                <span>🖼️ رفع صورة شعار PNG</span>
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
                            <div className="grid grid-cols-3 gap-1">
                              {[
                                { id: 'original', label: '🛡️ شعار الوكالة' },
                                { id: 'debadged', label: '✨ بدون شعار (سمكرة)' },
                                { id: 'gold_crown', label: '👑 شعار ملكي ذهبي' },
                                { id: 'carbon_sport', label: '🏁 شعار كاربون M/AMG' },
                                { id: 'lspd_star', label: '⭐ نجمة الشرطة + الأبواب' },
                                { id: 'neon_led', label: '💎 شعار مضيء LED' }
                              ].map((bOpt) => (
                                <button
                                  key={bOpt.id}
                                  type="button"
                                  onClick={() => {
                                    setBadgeMode(bOpt.id);
                                    setDebadged(bOpt.id === 'debadged');
                                  }}
                                  className={`py-1.5 px-1.5 rounded-xl text-[9px] font-bold transition cursor-pointer truncate ${
                                    badgeMode === bOpt.id
                                      ? 'bg-amber-500 text-black shadow'
                                      : 'bg-neutral-950 text-neutral-300 border border-neutral-800 hover:border-neutral-700'
                                  }`}
                                >
                                  {bOpt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Animated 4-Stage Extraction Pipeline Tracker */}
                        <div className="p-3 bg-neutral-900/90 rounded-2xl border border-neutral-800 space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-300 font-bold flex items-center gap-1.5">
                              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                              <span>مراحل معالجة واستخراج الحزمة:</span>
                            </span>
                            <span className="font-mono text-amber-400 font-bold">{importProgress}%</span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden p-0.5 border border-neutral-800">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 rounded-full transition-all duration-300"
                              style={{ width: `${importProgress}%` }}
                            />
                          </div>

                          {/* 4 Pipeline Milestones */}
                          <div className="space-y-1.5 text-[10px] font-sans">
                            {[
                              { stage: 1, text: 'فك ضغط dlc.rpf واستخراج المحتويات' },
                              { stage: 2, text: 'استخراج موديلات .yft و .ytd وفحص المضلعات (LODs)' },
                              { stage: 3, text: 'قراءة وتعديل handling.meta و vehicles.meta والأصوات' },
                              { stage: 4, text: 'إعداد حزمة الستريم وملف fxmanifest.lua بنجاح' }
                            ].map(step => (
                              <div 
                                key={step.stage} 
                                className={`flex items-center gap-2 ${importStage >= step.stage ? 'text-emerald-300' : 'text-neutral-500'}`}
                              >
                                {importStage >= step.stage ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full border border-neutral-700 shrink-0" />
                                )}
                                <span className={importStage === step.stage && isImporting ? 'animate-pulse font-bold text-amber-300' : ''}>
                                  {step.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : currentTool.id === 'ai_prop_creator' ? (
                      /* B) AI PROP CREATOR */
                      <div className="space-y-2.5">
                        <label className="text-[10px] text-neutral-400 block font-semibold">وصف المجسم المطلوب أو رفع صورة 2D:</label>
                        <input
                          type="text"
                          value={aiPropPrompt}
                          onChange={(e) => setAiPropPrompt(e.target.value)}
                          placeholder="مثال: مكتب إداري مودرن كربون مع إضاءة نيون..."
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                        />
                        <div className="flex items-center gap-2">
                          <label className="flex-1 py-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-xl text-center text-[10px] font-bold text-neutral-300 cursor-pointer">
                            <span>📷 رفع صورة مرجعية</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) setUploadedFileName(e.target.files[0].name);
                              }}
                            />
                          </label>
                          <button
                            onClick={() => {
                              setIsGeneratingAiProp(true);
                              setTimeout(() => {
                                setIsGeneratingAiProp(false);
                                alert('✅ تم توليد المجسم ثلاثي الأبعاد بنجاح ونقله إلى محرر الأجسام!');
                              }, 1200);
                            }}
                            disabled={isGeneratingAiProp}
                            className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {isGeneratingAiProp ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            <span>{isGeneratingAiProp ? 'جاري التوليد...' : 'توليد 3D الآن'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* C) STANDARD FILE UPLOAD FOR OTHER TOOLS */
                      <label className="border-2 border-dashed border-neutral-800 hover:border-amber-500/60 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-neutral-900/40 hover:bg-neutral-900/80 transition text-center">
                        <Download className="w-6 h-6 text-amber-400 animate-bounce" />
                        <span className="text-xs font-bold text-neutral-200">
                          {uploadedFileName ? `تم اختيار: ${uploadedFileName}` : 'اسحب وأفلت الملفات هنا أو اضغط للاستعراض'}
                        </span>
                        <div className="flex items-center gap-1 flex-wrap justify-center">
                          {currentTool.inputFormats.map((fmt, idx) => (
                            <span key={idx} className="text-[8px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono">
                              {fmt}
                            </span>
                          ))}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) setUploadedFileName(e.target.files[0].name);
                          }}
                        />
                      </label>
                    )}

                    {/* Model / Resource Name */}
                    <div className="space-y-1 pt-1 border-t border-neutral-900">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-neutral-400 font-semibold">اسم الموديل في السيرفر (Spawn Code):</label>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(modelNameInput);
                            alert(`تم نسخ كود الرسبنة: ${modelNameInput}`);
                          }}
                          className="text-[9px] text-amber-400 hover:underline flex items-center gap-1 font-mono cursor-pointer"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>نسخ الكود</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={modelNameInput}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                          setModelNameInput(val);
                          if (currentTool.id === 'car_importer') {
                            setImportedCarMeta(prev => ({ ...prev, spawnCode: val }));
                          }
                        }}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* STEP 2: TOOL-SPECIFIC INTERACTIVE CONTROLS */}
                  <div className="bg-neutral-950 p-4 rounded-3xl border border-neutral-800 space-y-3 shadow-lg">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-[10px]">2</span>
                      <span>أدوات التعديل والمعاينة لـ ({currentTool.nameAr})</span>
                    </span>

                    {/* 1. ADD-ON CAR IMPORTER (TOOL #3) */}
                    {currentTool.id === 'car_importer' && (
                      <div className="space-y-3 text-xs">
                        {/* Sub-tabs: Meta | Handling | Appearance | Siren & Badges */}
                        <div className="grid grid-cols-4 gap-1 bg-neutral-900 p-1 rounded-2xl border border-neutral-800 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => setImporterActiveTab('meta')}
                            className={`py-1.5 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                              importerActiveTab === 'meta' ? 'bg-amber-500 text-black shadow' : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            <FileText className="w-3 h-3 shrink-0" />
                            <span>الميتا</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImporterActiveTab('handling')}
                            className={`py-1.5 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                              importerActiveTab === 'handling' ? 'bg-amber-500 text-black shadow' : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            <Gauge className="w-3 h-3 shrink-0" />
                            <span>الوزنية</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImporterActiveTab('lighting')}
                            className={`py-1.5 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                              importerActiveTab === 'lighting' ? 'bg-amber-500 text-black shadow' : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            <Palette className="w-3 h-3 shrink-0" />
                            <span>المظهر</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImporterActiveTab('siren_badges')}
                            className={`py-1.5 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                              importerActiveTab === 'siren_badges'
                                ? 'bg-gradient-to-r from-red-500 to-blue-600 text-white shadow-md'
                                : 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
                            }`}
                          >
                            <span>🚨</span>
                            <span className="truncate">الونان والشعارات</span>
                          </button>
                        </div>

                        {/* QUICK ACCESS BAR FOR SIREN & BADGE (Always visible in Car Importer Step 2 when not on siren_badges tab) */}
                        {importerActiveTab !== 'siren_badges' && (
                          <div className="p-2.5 bg-gradient-to-r from-blue-950/50 via-neutral-900 to-red-950/50 rounded-2xl border border-blue-500/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-white flex items-center gap-1.5">
                                <span>🚨</span>
                                <span>إضافة ونان سفتي وتغيير شعار السيارة المستوردة:</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setImporterActiveTab('siren_badges')}
                                className="text-[9px] bg-amber-500 hover:bg-amber-400 text-black font-black px-2 py-0.5 rounded-lg transition cursor-pointer"
                              >
                                فتح الاستوديو الكامل ←
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <select
                                value={sirenType}
                                onChange={(e) => setSirenType(e.target.value)}
                                className="bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1 text-[10px] text-amber-300 font-bold"
                              >
                                <option value="auto">🚨 الونان: تلقائي حسب الفئة</option>
                                <option value="none">❌ بدون ونان (مدنية)</option>
                                <option value="setina_pb400_led">🛡️ دعامة صدم Setina PB-400 + 4 فلاشات LED (LCPDFR)</option>
                                <option value="hideaway_vertex">⚡ فلاشات مخفية بالشمعات Whelen Vertex (LCPDFR)</option>
                                <option value="visor_unmarked">🕵️ سفتي زجاج داخلي Axixtech / Inner Edge (مباحث)</option>
                                <option value="soundoff_ion">🚨 SoundOff Ion + حامل لوحة أمامية (LCPDFR)</option>
                                <option value="viper_s2">🚨 فلاش طبلون مزدوج Federal Signal Viper S2</option>
                                <option value="lightbar_led">🚓 ونان سقف Generic / Liberty II LED</option>
                                <option value="valor_vshape">⚡ ونان سقف V إيروديناميك Federal Signal Valor</option>
                                <option value="roof_single_beacon">🚨 ونان مغناطيسي فردي Whelen L31 LED</option>
                                <option value="beacon_classic">🚔 ونان كلاسيك قبتين دوارة Federal Aerodynic</option>
                                <option value="custom_obj">📦 بروبة مرفوعة من ملف LCPDFR</option>
                              </select>

                              <select
                                value={badgeMode}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBadgeMode(val);
                                  setDebadged(val === 'debadged');
                                }}
                                className="bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1 text-[10px] text-emerald-300 font-bold"
                              >
                                <option value="original">🛡️ الشعار: وكالة أصلي</option>
                                <option value="debadged">✨ إزالة الشعار + سمكرة (Debadge)</option>
                                <option value="gold_crown">👑 شعار ملكي ذهبي 24K</option>
                                <option value="carbon_sport">🏁 شعار كاربون رياضي M / AMG</option>
                                <option value="lspd_star">⭐ نجمة الشرطة وأمن الطرق</option>
                                <option value="neon_led">💎 شعار مضيء LED متوهج</option>
                                <option value="custom_image">🖼️ شعار مخصص من جهازك (PNG)</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {/* TAB A: VEHICLE METADATA */}
                        {importerActiveTab === 'meta' && (
                          <div className="space-y-2.5">
                            <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                              <label className="text-[10px] text-neutral-400 block font-semibold">اسم السيارة الظاهر داخل اللعبة (In-Game Label):</label>
                              <input
                                type="text"
                                value={importedCarMeta.displayName}
                                onChange={(e) => setImportedCarMeta({ ...importedCarMeta, displayName: e.target.value })}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-1.5">
                                <label className="text-[10px] text-neutral-400 block font-semibold">فئة المركبة (Class):</label>
                                <select
                                  value={importedCarMeta.category}
                                  onChange={(e) => setImportedCarMeta({ ...importedCarMeta, category: e.target.value })}
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1.5 text-xs text-amber-300 font-bold"
                                >
                                  <option value="Sports">Sports (رياضية)</option>
                                  <option value="Super">Super (سوبركار)</option>
                                  <option value="Muscle">Muscle (عضلات)</option>
                                  <option value="Sedan">Sedan (سيدان)</option>
                                  <option value="SUV">SUV (جيب / دفع رباعي)</option>
                                  <option value="Emergency">Emergency (طوارئ/شرطة)</option>
                                </select>
                              </div>

                              <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-1.5">
                                <label className="text-[10px] text-neutral-400 block font-semibold">نغمة صوت المحرك (Audio):</label>
                                <select
                                  value={importedCarMeta.audioHash}
                                  onChange={(e) => setImportedCarMeta({ ...importedCarMeta, audioHash: e.target.value })}
                                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1.5 text-xs text-amber-300 font-bold"
                                >
                                  <option value="sultanrs">Sultan RS (تيربو ياباني)</option>
                                  <option value="drafter">Drafter (V6 توين تيربو)</option>
                                  <option value="jugular">Jugular (V8 صوت خشن)</option>
                                  <option value="zentorno">Zentorno (V12 إيطالي)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TAB B: LIVE HANDLING TUNER */}
                        {importerActiveTab === 'handling' && (
                          <div className="space-y-2.5">
                            {/* Drivetrain selector */}
                            <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                              <div className="flex items-center justify-between font-bold text-white text-[11px]">
                                <span>نظام الدفع (Drivetrain):</span>
                                <span className="text-amber-400 font-mono">{importedCarMeta.drivetrain}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                {['RWD', 'AWD', 'FWD'].map(drive => (
                                  <button
                                    key={drive}
                                    onClick={() => setImportedCarMeta({ ...importedCarMeta, drivetrain: drive })}
                                    className={`py-1.5 rounded-xl font-bold text-[10px] transition cursor-pointer ${
                                      importedCarMeta.drivetrain === drive
                                        ? 'bg-amber-500 text-black shadow'
                                        : 'bg-neutral-950 text-neutral-400 hover:text-white'
                                    }`}
                                  >
                                    {drive === 'RWD' ? 'دفع خلفي (RWD)' : drive === 'AWD' ? 'دفع كلي (AWD)' : 'دفع أمامي (FWD)'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Sliders */}
                            <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                              <div className="flex justify-between text-[10px] text-neutral-400">
                                <span>السرعة القصوى (Top Speed):</span>
                                <span className="font-mono text-amber-300 font-bold">{importedCarMeta.topSpeed} km/h</span>
                              </div>
                              <input
                                type="range" min="180" max="360" step="5"
                                value={importedCarMeta.topSpeed}
                                onChange={(e) => setImportedCarMeta({ ...importedCarMeta, topSpeed: parseInt(e.target.value) })}
                                className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
                              />

                              <div className="flex justify-between text-[10px] text-neutral-400 pt-1">
                                <span>قوة التسارع والعزم (Acceleration Multiplier):</span>
                                <span className="font-mono text-amber-300 font-bold">{importedCarMeta.accelMultiplier}x</span>
                              </div>
                              <input
                                type="range" min="0.8" max="2.6" step="0.05"
                                value={importedCarMeta.accelMultiplier}
                                onChange={(e) => setImportedCarMeta({ ...importedCarMeta, accelMultiplier: parseFloat(e.target.value) })}
                                className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
                              />

                              <div className="flex justify-between text-[10px] text-neutral-400 pt-1">
                                <span>قوة الفرامل وحساسية الـ ABS:</span>
                                <span className="font-mono text-amber-300 font-bold">{importedCarMeta.brakeForce}x</span>
                              </div>
                              <input
                                type="range" min="0.6" max="2.2" step="0.05"
                                value={importedCarMeta.brakeForce}
                                onChange={(e) => setImportedCarMeta({ ...importedCarMeta, brakeForce: parseFloat(e.target.value) })}
                                className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
                              />
                            </div>
                          </div>
                        )}

                        {/* TAB C: APPEARANCE & 3D LIGHTING */}
                        {importerActiveTab === 'lighting' && (
                          <div className="space-y-2.5">
                            {/* Paint Shaders */}
                            <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                              <div className="flex items-center justify-between font-bold text-white text-[11px]">
                                <span>لون الطلاء المعدني (Paint Shader):</span>
                                <span className="text-[10px] text-neutral-400 font-mono">{carColor}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {[
                                  { label: 'أزرق معدني', color: '#0ea5e9' },
                                  { label: 'رمادي ناردو', color: '#64748b' },
                                  { label: 'أحمر قرمزي', color: '#dc2626' },
                                  { label: 'أسود ساتان', color: '#18181b' },
                                  { label: 'أبيض لؤلؤي', color: '#f8fafc' },
                                  { label: 'ذهبي غروب', color: '#f59e0b' },
                                  { label: 'أخضر سام', color: '#16a34a' },
                                  { label: 'بنفسجي ملكي', color: '#9333ea' }
                                ].map(c => (
                                  <button
                                    key={c.color}
                                    onClick={() => setCarColor(c.color)}
                                    style={{ backgroundColor: c.color }}
                                    className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${carColor === c.color ? 'border-amber-400 scale-110 shadow-lg' : 'border-neutral-700 opacity-80'}`}
                                    title={c.label}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Xenon Headlights & Neon Underglow */}
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setHeadlightsOn(!headlightsOn)}
                                className={`p-2.5 rounded-2xl font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                                  headlightsOn
                                    ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                                }`}
                              >
                                <Lightbulb className={`w-3.5 h-3.5 ${headlightsOn ? 'text-amber-400 fill-amber-400' : ''}`} />
                                <span>{headlightsOn ? 'أنوار الزينون (مضاءة)' : 'أنوار الزينون (مطفأة)'}</span>
                              </button>

                              <button
                                onClick={() => setUnderglowOn(!underglowOn)}
                                className={`p-2.5 rounded-2xl font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                                  underglowOn
                                    ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                                }`}
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>{underglowOn ? 'نيون الأرضية (شغال)' : 'نيون الأرضية (مغلق)'}</span>
                              </button>
                            </div>

                            {/* Underglow Color Palette (if enabled) */}
                            {underglowOn && (
                              <div className="p-2.5 bg-neutral-900 rounded-2xl border border-cyan-500/40 flex items-center justify-between">
                                <span className="text-[10px] text-cyan-300 font-bold">لون النيون السفلي:</span>
                                <div className="flex items-center gap-1.5">
                                  {['#06b6d4', '#f59e0b', '#ec4899', '#ef4444', '#10b981'].map(color => (
                                    <button
                                      key={color}
                                      onClick={() => setUnderglowColor(color)}
                                      style={{ backgroundColor: color }}
                                      className={`w-5 h-5 rounded-full border transition cursor-pointer ${underglowColor === color ? 'border-white scale-110 shadow' : 'border-neutral-700'}`}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* TAB D: SIREN (WANAN) & BADGE CUSTOMIZER STUDIO */}
                        {importerActiveTab === 'siren_badges' && (
                          <div className="space-y-2.5">
                            {/* 1. Vehicle Siren / Wanan Selector */}
                            <div className="p-3 bg-neutral-900 rounded-2xl border border-blue-500/30 space-y-2.5">
                              <div className="flex items-center justify-between font-bold text-white text-[11px]">
                                <span className="flex items-center gap-1.5">
                                  <span>🚨</span>
                                  <span>تركيب ونان وسفتي للسيارة (Vehicle Siren / Wanan):</span>
                                </span>
                                <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 font-mono">
                                  يركب على أي سيارة
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {[
                                  { id: 'none', label: '❌ بدون ونان (مدنية)', desc: 'إزالة كافة الفلاشات والمعدات' },
                                  { id: 'setina_pb400_led', label: '🛡️ دعامة Setina PB-400 + 4 فلاشات LED (LCPDFR)', desc: 'دعامة صدم Setina أصلية مع 4 فلاشات ملونة وشعار SETINA' },
                                  { id: 'hideaway_vertex', label: '⚡ فلاشات مخفية بالشمعات (LCPDFR)', desc: 'Whelen Vertex / Hide-A-Way داخل الشمعات والاسطبات' },
                                  { id: 'visor_unmarked', label: '🕵️ سفتي شماسية زجاج (مباحث)', desc: 'Axixtech Stealth Visor / Inner Edge خلف الزجاج' },
                                  { id: 'soundoff_ion', label: '🚨 SoundOff Ion + لوحة', desc: 'فلاشات Ion مع حامل لوحة أرقام أمامية (LCPDFR)' },
                                  { id: 'viper_s2', label: '🚨 فلاش طبلون مزدوج (Dash)', desc: 'Federal Signal Viper S2 بقواعد شفط على الطبلون' },
                                  { id: 'lightbar_led', label: '🚓 ونان سقف شرطة LED كامل', desc: 'Generic Light Pack / Liberty II Duo للسقف' },
                                  { id: 'valor_vshape', label: '⚡ ونان سقف V إيروديناميك', desc: 'Federal Signal Valor زوايا مثلثة حديثة' },
                                  { id: 'roof_single_beacon', label: '🚨 ونان مغناطيسي فردي', desc: 'Whelen L31 LED بقاعدة مغناطيسية للمواكب' },
                                  { id: 'beacon_classic', label: '🚔 ونان كلاسيك قبتين دوارة', desc: 'Federal Signal Aerodynic مع سماعة وسطية' },
                                  { id: 'custom_obj', label: '📦 بروبة مرفوعة (ZIP/OBJ/YFT)', desc: 'ارفع ملف LCPDFR من صفحة الـ Blender Viewport' }
                                ].map((sItem) => (
                                  <button
                                    key={sItem.id}
                                    type="button"
                                    onClick={() => setSirenType(sItem.id)}
                                    className={`p-2 rounded-xl border text-right transition cursor-pointer ${
                                      sirenType === sItem.id
                                        ? 'bg-blue-600/20 border-blue-400 text-white shadow'
                                        : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                                    }`}
                                  >
                                    <div className="text-[10px] font-bold">{sItem.label}</div>
                                    <div className="text-[8px] text-neutral-400">{sItem.desc}</div>
                                  </button>
                                ))}
                              </div>

                              {/* Strobe Colors & Pushbar */}
                              <div className="pt-1 border-t border-neutral-800 space-y-2">
                                <div className="flex items-center justify-between text-[10px] text-neutral-300 font-bold">
                                  <span>ألوان فلاشات الونان (Strobe Colors):</span>
                                  <span className="font-mono text-amber-400">{sirenColorMode}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                  {[
                                    { id: 'red_blue', label: '🔵🔴 أحمر وأزرق (شرطة)' },
                                    { id: 'blue_only', label: '🔵🔵 أزرق بالكامل (مباحث)' },
                                    { id: 'red_white', label: '🔴⚪ أحمر وأبيض (طوارئ)' },
                                    { id: 'amber_gold', label: '🟠🟡 برتقالي ذهبي (مرور)' }
                                  ].map((cMode) => (
                                    <button
                                      key={cMode.id}
                                      type="button"
                                      onClick={() => setSirenColorMode(cMode.id)}
                                      className={`py-1.5 px-1.5 rounded-xl text-[9px] font-bold transition cursor-pointer ${
                                        sirenColorMode === cMode.id
                                          ? 'bg-amber-500 text-black shadow'
                                          : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                                      }`}
                                    >
                                      {cMode.label}
                                    </button>
                                  ))}
                                </div>

                                {/* Front Police Pushbar Toggle */}
                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-[10px] text-neutral-300 font-semibold">دعامة صدم أمامية حديدية (Police Pushbar):</span>
                                  <button
                                    type="button"
                                    onClick={() => setPushbarEnabled((prev) => !prev)}
                                    className={`px-3 py-1 rounded-xl text-[10px] font-bold transition cursor-pointer ${
                                      pushbarEnabled
                                        ? 'bg-emerald-500 text-black shadow'
                                        : 'bg-neutral-950 text-neutral-400 border border-neutral-800'
                                    }`}
                                  >
                                    {pushbarEnabled ? '✅ الدعامة مركّبة' : '➕ تركيب دعامة أمامية'}
                                  </button>
                                </div>

                                {/* Quick Rotation & Flip Controls for Sirens */}
                                {sirenType !== 'none' && (
                                  <div className="pt-2 border-t border-neutral-800/80 space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] text-neutral-300 font-semibold">
                                      <span>🔄 توجيه وقلب الونان (Flip & Orientation):</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSirenRotX?.(0);
                                          setSirenRotY?.(0);
                                          setSirenRotZ?.(0);
                                        }}
                                        className="text-[9px] text-neutral-400 hover:text-white underline cursor-pointer"
                                      >
                                        إعادة ضبط
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setSirenRotY?.((prev) => prev + Math.PI)}
                                        className="py-1.5 rounded-lg bg-neutral-950 hover:bg-amber-500/20 border border-neutral-800 text-[10px] font-bold text-amber-300 cursor-pointer"
                                        title="قلب 180° أفقياً"
                                      >
                                        ↻ قلب أفقياً 180°
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSirenRotX?.((prev) => prev + Math.PI)}
                                        className="py-1.5 rounded-lg bg-neutral-950 hover:bg-amber-500/20 border border-neutral-800 text-[10px] font-bold text-amber-300 cursor-pointer"
                                        title="قلب رأسي 180°"
                                      >
                                        ⇅ قلب رأسي 180°
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSirenRotZ?.((prev) => prev + Math.PI / 2)}
                                        className="py-1.5 rounded-lg bg-neutral-950 hover:bg-amber-500/20 border border-neutral-800 text-[10px] font-bold text-amber-300 cursor-pointer"
                                        title="تدوير 90°"
                                      >
                                        ⟲ دوران 90°
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 2. Vehicle Badge / Emblem Customizer & Replacer */}
                            <div className="p-3 bg-neutral-900 rounded-2xl border border-amber-500/30 space-y-2.5">
                              <div className="flex items-center justify-between font-bold text-white text-[11px]">
                                <span className="flex items-center gap-1.5">
                                  <span>🛡️</span>
                                  <span>تغيير أو إزالة شعارات السيارة (3D Badge Customizer):</span>
                                </span>
                                <span className="text-[9px] text-amber-400 font-mono">{badgeMode}</span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {[
                                  { id: 'original', label: '🛡️ شعار الوكالة الأصلي' },
                                  { id: 'debadged', label: '✨ بدون شعار + سمكرة' },
                                  { id: 'gold_crown', label: '👑 شعار ملكي ذهبي 24K' },
                                  { id: 'carbon_sport', label: '🏁 كاربون رياضي M / AMG' },
                                  { id: 'lspd_star', label: '⭐ نجمة الشرطة + الأبواب' },
                                  { id: 'neon_led', label: '💎 شعار مضيء LED نيون' }
                                ].map((bItem) => (
                                  <button
                                    key={bItem.id}
                                    type="button"
                                    onClick={() => {
                                      setBadgeMode(bItem.id);
                                      setDebadged(bItem.id === 'debadged');
                                    }}
                                    className={`py-1.5 px-2 rounded-xl text-[9px] font-bold transition cursor-pointer ${
                                      badgeMode === bItem.id
                                        ? 'bg-amber-500 text-black shadow'
                                        : 'bg-neutral-950 text-neutral-300 hover:text-white border border-neutral-800'
                                    }`}
                                  >
                                    {bItem.label}
                                  </button>
                                ))}
                              </div>

                              {/* Custom Badge PNG Upload */}
                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-800">
                                <label className="flex-1 py-1.5 px-2.5 bg-neutral-950 hover:bg-neutral-800 border border-dashed border-amber-500/50 rounded-xl text-center text-[10px] font-bold text-amber-300 cursor-pointer transition">
                                  <span>🖼️ رفع صورة شعار سيرفرك الخاص (PNG / JPG)</span>
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
                                {customBadgeTexture && (
                                  <span className="text-[9px] text-emerald-400 font-bold shrink-0">✓ تم تركيب شعارك</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. VEHICLE EDITOR V2 */}
                    {currentTool.id === 'vehicle_editor' && (
                      <div className="space-y-3 text-xs">
                        {/* GTA V Base Vehicle Selector */}
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>موديل السيارة الأساسي (GTA Base Vehicle):</span>
                            <span className="text-[10px] text-amber-400 font-mono">{carPreset.toUpperCase()}</span>
                          </div>
                          <select
                            value={carPreset}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomVehicleUrl(null);
                              setCarPreset(val);
                              setModelNameInput(val);
                            }}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-bold"
                          >
                            <option value="sultanrs">🏎️ Karin Sultan RS / E30 M3 (تونر ياباني/أوروبي)</option>
                            <option value="zentorno">⚡ Pegassi Zentorno / Aventador V12 (هايبركار إيطالي)</option>
                            <option value="turismor">🏁 Grotti Turismo R / Ferrari 458 (سوبركار مكشوفة)</option>
                            <option value="revolter">🔥 Ubermacht Revolter / BMW M4 G82 (كوبيه رياضية)</option>
                            <option value="police3">🚓 Vapid Police Cruiser (دورية شرطة سيدان 4 أبواب)</option>
                            <option value="schafter3">🚘 Benefactor Schafter V12 (سيدان فاخرة 4 أبواب)</option>
                            <option value="g63">🚙 Mercedes-AMG G63 / Dubsta 4x4 (جيب دفع رباعي SUV)</option>
                            <option value="kuruma2">🛡️ Karin Armored Kuruma / G63 (مصفحة تكتيكية)</option>
                            <option value="buffalo4">💥 Bravado Buffalo STX (عضلات أمريكية Widebody)</option>
                          </select>
                        </div>

                        {/* Car Paint Palette */}
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>لون الطلاء المعدني (Car Paint Shader):</span>
                            <span className="text-[10px] text-neutral-400 font-mono">{carColor}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {[
                              { label: 'أزرق', color: '#0ea5e9' },
                              { label: 'ناردو', color: '#64748b' },
                              { label: 'أحمر', color: '#dc2626' },
                              { label: 'أسود', color: '#18181b' },
                              { label: 'أبيض', color: '#f8fafc' },
                              { label: 'ذهبي', color: '#f59e0b' },
                              { label: 'أخضر', color: '#16a34a' },
                              { label: 'بنفسجي', color: '#9333ea' }
                            ].map(c => (
                              <button
                                key={c.color}
                                onClick={() => setCarColor(c.color)}
                                style={{ backgroundColor: c.color }}
                                className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${carColor === c.color ? 'border-amber-400 scale-110 shadow-lg' : 'border-neutral-700 opacity-80'}`}
                                title={c.label}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Upgraded Badge Customizer & Debadger */}
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-amber-500/30 space-y-2">
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>🛡️ تغيير أو إزالة الشعارات (Badge Customizer & Debadge):</span>
                            <span className="text-[10px] text-amber-400 font-mono">{badgeMode}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: 'original', label: 'شعار الوكالة' },
                              { id: 'debadged', label: 'إزالة + سمكرة' },
                              { id: 'gold_crown', label: '👑 ملكي ذهبي' },
                              { id: 'carbon_sport', label: '🏁 كاربون M/AMG' },
                              { id: 'lspd_star', label: '⭐ نجمة الشرطة' },
                              { id: 'neon_led', label: '💎 شعار مضيء LED' }
                            ].map((bItem) => (
                              <button
                                key={bItem.id}
                                type="button"
                                onClick={() => {
                                  setBadgeMode(bItem.id);
                                  setDebadged(bItem.id === 'debadged');
                                  if (bItem.id === 'debadged') setFilledFlush(true);
                                }}
                                className={`py-1.5 px-1.5 rounded-xl text-[9px] font-bold transition cursor-pointer ${
                                  badgeMode === bItem.id
                                    ? 'bg-amber-500 text-black shadow'
                                    : 'bg-neutral-950 text-neutral-300 hover:text-white border border-neutral-800'
                                }`}
                              >
                                {bItem.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <label className="flex-1 py-1.5 bg-neutral-950 hover:bg-neutral-800 border border-dashed border-amber-500/50 rounded-xl text-center text-[10px] font-bold text-amber-300 cursor-pointer">
                              <span>🖼️ رفع شعار خاص (PNG/JPG)</span>
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
                            <button
                              type="button"
                              onClick={() => {
                                setBadgeMode('debadged');
                                setDebadged(true);
                                setFilledFlush(true);
                                alert('✅ تم إزالة الشعار وسد الفراغ وتنعيمه بلون البودي تلقائياً (Fill & Flush)!');
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition cursor-pointer ${
                                filledFlush ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-black'
                              }`}
                            >
                              {filledFlush ? '✓ مسمكر ومطلي' : 'سد الفراغ (Fill/Flush)'}
                            </button>
                          </div>
                        </div>

                        {/* Vehicle Siren / Wanan Studio inside Vehicle Editor V2 */}
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-blue-500/30 space-y-2">
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>🚨 إضافة ونان وسفتي للسيارة (Vehicle Siren Studio):</span>
                            <span className="text-[10px] text-blue-400 font-mono">{sirenType}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <select
                              value={sirenType}
                              onChange={(e) => setSirenType(e.target.value)}
                              className="bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1.5 text-[10px] text-amber-300 font-bold"
                            >
                              <option value="auto">🚨 تلقائي حسب نوع السيارة</option>
                              <option value="none">❌ بدون ونان (مدنية)</option>
                              <option value="lightbar_led">🚓 ونان سقف شرطة LED كامل</option>
                              <option value="visor_unmarked">🕵️ ونان سري داخلي + شبك (مباحث)</option>
                              <option value="roof_single_beacon">🚨 ونان مغناطيسي فردي على السقف</option>
                              <option value="beacon_classic">🚔 ونان كشافات دائرية كلاسيك</option>
                            </select>

                            <select
                              value={sirenColorMode}
                              onChange={(e) => setSirenColorMode(e.target.value)}
                              className="bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-1.5 text-[10px] text-blue-300 font-bold"
                            >
                              <option value="red_blue">🔵🔴 أحمر وأزرق (شرطة)</option>
                              <option value="blue_only">🔵🔵 أزرق بالكامل (أمن طرق/مباحث)</option>
                              <option value="red_white">🔴⚪ أحمر وأبيض (طوارئ/إسعاف)</option>
                              <option value="amber_gold">🟠🟡 برتقالي ذهبي (مرور/حراسات)</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-neutral-400">دعامة الصدم الأمامية (Police Pushbar):</span>
                            <button
                              type="button"
                              onClick={() => setPushbarEnabled((prev) => !prev)}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition cursor-pointer ${
                                pushbarEnabled ? 'bg-emerald-500 text-black' : 'bg-neutral-950 text-neutral-400 border border-neutral-800'
                              }`}
                            >
                              {pushbarEnabled ? '✅ الدعامة مفعلة' : '➕ إضافة دعامة صدم'}
                            </button>
                          </div>
                        </div>

                        {/* Rims & Stance */}
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>اختيار الجنوط والوقفة (Stance & Rims):</span>
                            <button
                              onClick={() => savePartToLibrary(selectedRim, 'Rim')}
                              className="text-[9px] text-amber-400 hover:underline cursor-pointer"
                            >
                              + حفظ في My parts
                            </button>
                          </div>
                          <select
                            value={selectedRim}
                            onChange={(e) => setSelectedRim(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="sport_vossen">Vossen CV3 Sport (رياضي 5 شعب)</option>
                            <option value="deep_dish_chrome">Deep Dish Chrome (كروم عميق شبكي)</option>
                            <option value="rotiform_monoblock">Rotiform Monoblock (سباق آيروديسك)</option>
                            <option value="offroad_beadlock">Off-road Beadlock (دفع رباعي بمسامير)</option>
                          </select>

                          {/* Stance Sliders */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between text-[10px] text-neutral-400">
                              <span>الميلان (Camber):</span>
                              <span className="font-mono text-amber-300">{stanceCamber}°</span>
                            </div>
                            <input
                              type="range" min="-8" max="8" step="1"
                              value={stanceCamber} onChange={(e) => setStanceCamber(parseInt(e.target.value))}
                              className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
                            />

                            <div className="flex justify-between text-[10px] text-neutral-400">
                              <span>التهبيط (Ride Height):</span>
                              <span className="font-mono text-amber-300">{stanceHeight} cm</span>
                            </div>
                            <input
                              type="range" min="-5" max="5" step="1"
                              value={stanceHeight} onChange={(e) => setStanceHeight(parseInt(e.target.value))}
                              className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
                            />

                            <div className="flex justify-between text-[10px] text-neutral-400">
                              <span>عرض المحاور والبروز (Wheel Offset):</span>
                              <span className="font-mono text-amber-300">{stanceOffset} mm</span>
                            </div>
                            <input
                              type="range" min="-4" max="4" step="1"
                              value={stanceOffset} onChange={(e) => setStanceOffset(parseInt(e.target.value))}
                              className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Bodykits */}
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>قطع البودي كيت (Bodykits):</span>
                            <button
                              onClick={() => savePartToLibrary('Carbon Wing Pro', 'Spoiler')}
                              className="text-[9px] text-amber-400 hover:underline cursor-pointer"
                            >
                              + حفظ الجناح في My parts
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => setSelectedBodykit({ ...selectedBodykit, splitter: !selectedBodykit.splitter })}
                              className={`py-1 rounded-xl text-[10px] font-bold cursor-pointer ${selectedBodykit.splitter ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}
                            >
                              زوائد أمامية
                            </button>
                            <button
                              onClick={() => setSelectedBodykit({ ...selectedBodykit, spoiler: !selectedBodykit.spoiler })}
                              className={`py-1 rounded-xl text-[10px] font-bold cursor-pointer ${selectedBodykit.spoiler ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}
                            >
                              جناح كاربون
                            </button>
                            <button
                              onClick={() => setSelectedBodykit({ ...selectedBodykit, exhaust: !selectedBodykit.exhaust })}
                              className={`py-1 rounded-xl text-[10px] font-bold cursor-pointer ${selectedBodykit.exhaust ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}
                            >
                              شكمان رياضي
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. PROP CREATOR & AI PROP CREATOR */}
                    {(currentTool.id === 'prop_creator' || currentTool.id === 'ai_prop_creator') && (
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="text-[10px] text-neutral-400 block font-semibold">نوع جدار التصادم (Havok Collision Geometry):</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {['box', 'capsule', 'mesh'].map(t => (
                              <button
                                key={t}
                                onClick={() => setCollisionType(t)}
                                className={`py-1.5 rounded-xl font-bold capitalize transition cursor-pointer ${
                                  collisionType === t ? 'bg-amber-500 text-black shadow' : 'bg-neutral-950 text-neutral-400'
                                }`}
                              >
                                {t === 'box' ? 'صندوق Box' : t === 'capsule' ? 'كبسولة Capsule' : 'مجسم دقيق Mesh'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <div className="flex justify-between text-[10px] text-neutral-400">
                            <span>حجم ومقياس المجسم (Prop Scale):</span>
                            <span className="font-mono text-amber-300 font-bold">{propScale.toFixed(1)}x</span>
                          </div>
                          <input
                            type="range" min="0.2" max="3.0" step="0.1"
                            value={propScale} onChange={(e) => setPropScale(parseFloat(e.target.value))}
                            className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
                          />
                        </div>

                        <button
                          onClick={() => setShowYtypPreview(!showYtypPreview)}
                          className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-xl text-neutral-300 text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5 text-amber-400" />
                          <span>{showYtypPreview ? 'إخفاء كود .ytyp Archetype' : 'معاينة كود تعريف الأجسام .ytyp'}</span>
                        </button>

                        {showYtypPreview && (
                          <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800 font-mono text-[9px] text-amber-300 max-h-36 overflow-y-auto">
                            <pre>{generateYtypXml({ modelName: modelNameInput })}</pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. HOUSING SHELL CREATOR */}
                    {currentTool.id === 'shell_creator' && (
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="text-[10px] text-neutral-400 block font-semibold">مخطط الشيلة المعماري (Floorplan Template):</label>
                          <select
                            value={shellPreset}
                            onChange={(e) => setShellPreset(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-bold"
                          >
                            <option value="studio">استوديو مفتوح (غرفة + صالة)</option>
                            <option value="apartment_2room">شقة مودرن (غرفتين نوم + صالة)</option>
                            <option value="penthouse">بنتهاوس فاخر دورين</option>
                            <option value="warehouse">مستودع / كراج تخزين سيارات</option>
                          </select>
                        </div>

                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="text-[10px] text-neutral-400 block font-semibold">طراز الجدران والأرضيات:</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {['modern_wood', 'white_marble', 'concrete'].map(w => (
                              <button
                                key={w}
                                onClick={() => setWallStyle(w)}
                                className={`py-1 rounded-xl text-[10px] font-bold transition cursor-pointer ${
                                  wallStyle === w ? 'bg-amber-500 text-black' : 'bg-neutral-950 text-neutral-400'
                                }`}
                              >
                                {w === 'modern_wood' ? 'خشب مودرن' : w === 'white_marble' ? 'رخام أبيض' : 'كونكريت'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-1.5">
                          <div className="flex justify-between text-[10px] text-neutral-400">
                            <span>ارتفاع السقف (Ceiling Height):</span>
                            <span className="font-mono text-amber-300 font-bold">{ceilingHeight}m</span>
                          </div>
                          <input
                            type="range" min="2.4" max="4.8" step="0.2"
                            value={ceilingHeight} onChange={(e) => setCeilingHeight(parseFloat(e.target.value))}
                            className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* 5. LIVERY MAPPER */}
                    {currentTool.id === 'livery_mapper' && (
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] text-neutral-400 font-semibold">قالب الـ UV عالي الدقة (2048x2048):</label>
                            <button
                              onClick={() => alert('✅ جاري تحميل قالب UV Template Sheet عالي الدقة (PNG) للتصميم في الفوتوشوب!')}
                              className="text-[9px] text-amber-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>تحميل القالب PNG</span>
                            </button>
                          </div>
                          <select
                            value={liverySlot}
                            onChange={(e) => setLiverySlot(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="livery_default">livery_default (الخانة الأساسية)</option>
                            <option value="livery_racing_01">livery_racing_01 (سكن سباقات)</option>
                            <option value="livery_police_02">livery_police_02 (دورية أمنية)</option>
                          </select>
                        </div>
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="text-[10px] text-neutral-400 block font-semibold">إنهاء اللمعان (Finish):</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {['gloss', 'matte', 'chrome'].map(f => (
                              <button
                                key={f}
                                onClick={() => setLiveryFinish(f)}
                                className={`py-1 rounded-xl text-[10px] font-bold capitalize cursor-pointer ${liveryFinish === f ? 'bg-amber-500 text-black' : 'bg-neutral-950 text-neutral-400'}`}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 6. 3D RETEXTURE TOOL */}
                    {currentTool.id === 'retexture_3d' && (
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="text-[10px] text-neutral-400 block font-semibold">السطح المستهدف للنقر والاستبدال (Raycast Surface):</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {['Front Wall', 'Wood Floor', 'Ceiling Light', 'Billboard Sign'].map(part => (
                              <button
                                key={part}
                                onClick={() => setSelectedMeshPart(part)}
                                className={`py-1.5 rounded-xl text-[10px] font-bold cursor-pointer ${selectedMeshPart === part ? 'bg-amber-500 text-black' : 'bg-neutral-950 text-neutral-400'}`}
                              >
                                {part}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 7. CLOTHING TEXTURES */}
                    {currentTool.id === 'clothing_textures' && (
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="text-[10px] text-neutral-400 block font-semibold">قطعة الملابس (Component Slot):</label>
                          <div className="grid grid-cols-4 gap-1">
                            {['upper', 'lower', 'shoes', 'mask'].map(slot => (
                              <button
                                key={slot}
                                onClick={() => setClothingSlot(slot)}
                                className={`py-1.5 rounded-xl text-[10px] font-bold capitalize transition cursor-pointer ${
                                  clothingSlot === slot ? 'bg-amber-500 text-black' : 'bg-neutral-950 text-neutral-400'
                                }`}
                              >
                                {slot === 'upper' ? 'تيشيرت' : slot === 'lower' ? 'بنطال' : slot === 'shoes' ? 'حذاء' : 'قناع'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 8. ELS TO NON-ELS CONVERTER */}
                    {currentTool.id === 'els_converter' && (
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-bold text-white">
                            <span>تحليل ملف VCF XML:</span>
                            <span className="text-emerald-400 font-mono">8 فلاشات جاهزة</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {['slow', 'standard', 'strobe'].map(spd => (
                              <button
                                key={spd}
                                onClick={() => setSirenPatternSpeed(spd)}
                                className={`py-1.5 rounded-xl text-[10px] font-bold capitalize transition cursor-pointer ${
                                  sirenPatternSpeed === spd ? 'bg-amber-500 text-black' : 'bg-neutral-950 text-neutral-400'
                                }`}
                              >
                                {spd === 'slow' ? 'بطيء Slow' : spd === 'standard' ? 'أصلي Native' : 'ستروب سريع'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 9. BOAT CREATOR */}
                    {currentTool.id === 'boat_creator' && (
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <div className="flex justify-between text-[10px] text-neutral-400">
                            <span>معايرة خط الطفو على الماء (Buoyancy):</span>
                            <span className="font-mono text-amber-300 font-bold">{boatBuoyancy.toFixed(2)}</span>
                          </div>
                          <input
                            type="range" min="0.4" max="1.3" step="0.05"
                            value={boatBuoyancy} onChange={(e) => setBoatBuoyancy(parseFloat(e.target.value))}
                            className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* 10. AI PED CREATOR */}
                    {currentTool.id === 'ai_ped_creator' && (
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="text-[10px] text-neutral-400 block font-semibold">بنية وهيكل الجسم (Rigging Skeleton):</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {['normal', 'athletic', 'heavy'].map(b => (
                              <button
                                key={b}
                                onClick={() => setPedBuild(b)}
                                className={`py-1.5 rounded-xl text-[10px] font-bold capitalize cursor-pointer ${pedBuild === b ? 'bg-amber-500 text-black' : 'bg-neutral-950 text-neutral-400'}`}
                              >
                                {b === 'normal' ? 'عادي Normal' : b === 'athletic' ? 'رياضي' : 'ضخم Heavy'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 11. CHAIN CREATOR */}
                    {currentTool.id === 'chain_creator' && (
                      <div className="space-y-3 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="font-bold text-white block">نوع حلقة السلسلة والمعدن:</label>
                          <select
                            value={chainType}
                            onChange={(e) => setChainType(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="cuban_8mm">Miami Cuban Link 8mm</option>
                            <option value="cuban_12mm">Heavy Cuban Link 12mm</option>
                            <option value="tennis_diamond">Tennis Diamond Chain</option>
                            <option value="rope_gold">Rope Gold Chain</option>
                          </select>

                          <div className="grid grid-cols-3 gap-1.5 pt-1">
                            {['gold_24k', 'silver_925', 'rose_gold'].map(m => (
                              <button
                                key={m}
                                onClick={() => setChainMetal(m)}
                                className={`py-1 rounded-xl text-[10px] font-bold capitalize cursor-pointer ${chainMetal === m ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}
                              >
                                {m.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="font-bold text-white block">نص أو شعار القلادة (3D Pendant):</label>
                          <input
                            type="text"
                            value={pendantText}
                            onChange={(e) => setPendantText(e.target.value)}
                            placeholder="اكتب نص القلادة المجسم..."
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-bold"
                          />
                          <label className="flex items-center gap-2 cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={diamondGlow}
                              onChange={(e) => setDiamondGlow(e.target.checked)}
                              className="rounded accent-amber-500 cursor-pointer"
                            />
                            <span className="text-[11px] text-neutral-300">تفعيل شيدر ترصيع الألماس المتوهج (Iced-Out Glow)</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* 12. WEAPON SKINS & CREATOR */}
                    {(currentTool.id === 'weapon_skins' || currentTool.id === 'weapon_creator') && (
                      <div className="space-y-3 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="font-bold text-white block">اختيار السلاح:</label>
                          <select
                            value={selectedWeapon}
                            onChange={(e) => setSelectedWeapon(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="WEAPON_CARBINE">Carbine Rifle (كاربين)</option>
                            <option value="WEAPON_PISTOL">Combat Pistol (فرد 9 ملم)</option>
                            <option value="WEAPON_SMG">Submachine Gun (رشاش)</option>
                            <option value="WEAPON_SNIPER">Heavy Sniper (قناص ثقيل)</option>
                          </select>
                        </div>

                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="font-bold text-white block">نمط التمويه (Camo Skin):</label>
                          <div className="grid grid-cols-2 gap-2">
                            {['damascus', 'gold_24k', 'red_tiger', 'digital_camo'].map(c => (
                              <button
                                key={c}
                                onClick={() => setCamoSkin(c)}
                                className={`py-1.5 rounded-xl text-[10px] font-bold capitalize cursor-pointer ${camoSkin === c ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}
                              >
                                {c.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 13. PLATE CREATOR */}
                    {currentTool.id === 'plate_creator' && (
                      <div className="space-y-3 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="font-bold text-white block">نصوص اللوحة:</label>
                          <input
                            type="text"
                            value={plateText}
                            onChange={(e) => setPlateText(e.target.value.toUpperCase())}
                            placeholder="اسم الولاية / السيرفر (أعلى)"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-mono font-bold"
                          />
                          <input
                            type="text"
                            value={plateNumber}
                            onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                            placeholder="أرقام وحروف اللوحة"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-sm text-white font-mono font-black tracking-widest text-center"
                          />
                        </div>
                      </div>
                    )}

                    {/* 14. OPTIMIZERS & SERVER HUB */}
                    {['map_optimiser', 'vehicle_optimiser', 'optimiser_hub'].includes(currentTool.id) && (
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <div className="flex justify-between text-[11px] font-bold text-white">
                            <span>تقليص وضغط التكستشرات:</span>
                            <span className="text-emerald-400 font-mono">وفرت {vramSavedMb} MB</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => setTargetTexRes('2048')}
                              className={`py-1.5 rounded-xl font-bold text-[10px] cursor-pointer ${targetTexRes === '2048' ? 'bg-amber-500 text-black' : 'bg-neutral-950 text-neutral-400'}`}
                            >
                              2K (2048x2048)
                            </button>
                            <button
                              onClick={() => setTargetTexRes('1024')}
                              className={`py-1.5 rounded-xl font-bold text-[10px] cursor-pointer ${targetTexRes === '1024' ? 'bg-amber-500 text-black' : 'bg-neutral-950 text-neutral-400'}`}
                            >
                              1K (1024x1024)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 15. TATTOO & FACE SKIN CREATOR */}
                    {(currentTool.id === 'tattoo_creator' || currentTool.id === 'face_skin_creator') && (
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-2">
                          <label className="text-[10px] text-neutral-400 block font-semibold">منطقة الجسم (Body Zone):</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {['ZONE_CHEST', 'ZONE_BACK', 'ZONE_LEFT_ARM', 'ZONE_RIGHT_ARM', 'ZONE_NECK', 'ZONE_HEAD'].map(z => (
                              <button
                                key={z}
                                onClick={() => setTattooZone(z)}
                                className={`py-1.5 rounded-xl text-[9px] font-bold cursor-pointer ${tattooZone === z ? 'bg-amber-500 text-black' : 'bg-neutral-950 text-neutral-400'}`}
                              >
                                {z.replace('ZONE_', '')}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* STEP 3: VISUAL FIVEM RESOURCE DIRECTORY TREE & EXPORT */}
                <div className="bg-neutral-950 p-4 rounded-3xl border border-neutral-800 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-[10px]">3</span>
                      <span>التصدير وهيكلة حزمة FiveM Addon</span>
                    </span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono border border-emerald-500/30">
                      Ready to Stream
                    </span>
                  </div>

                  {/* Visual FiveM Stream Tree Box */}
                  <div className="p-3 bg-neutral-900/90 rounded-2xl border border-neutral-800 font-mono text-[11px] space-y-1 select-none">
                    <div className="text-amber-400 font-bold flex items-center gap-1.5">
                      <span>📁 {modelNameInput}/</span>
                    </div>
                    <div className="pl-4 text-neutral-300 flex items-center gap-1.5">
                      <span className="text-amber-500">📄</span>
                      <span>fxmanifest.lua</span>
                      <span className="text-[9px] text-neutral-500 font-sans">(cerulean gta5)</span>
                    </div>

                    {/* data folder */}
                    <div className="pl-4 text-blue-400 font-semibold flex items-center gap-1.5">
                      <span>📁 data/</span>
                    </div>
                    {currentTool.category === 'vehicles' && (
                      <>
                        <div className="pl-8 text-neutral-400 flex items-center gap-1.5">
                          <span className="text-neutral-500">📄</span>
                          <span>vehicles.meta</span>
                          <span className="text-[9px] text-amber-400 font-sans">({importedCarMeta.audioHash})</span>
                        </div>
                        <div className="pl-8 text-neutral-400 flex items-center gap-1.5">
                          <span className="text-neutral-500">📄</span>
                          <span>handling.meta</span>
                          <span className="text-[9px] text-amber-400 font-sans">({importedCarMeta.drivetrain} • {importedCarMeta.topSpeed} km/h)</span>
                        </div>
                        <div className="pl-8 text-neutral-400 flex items-center gap-1.5">
                          <span className="text-neutral-500">📄</span>
                          <span>carvariations.meta</span>
                        </div>
                        <div className="pl-8 text-neutral-400 flex items-center gap-1.5">
                          <span className="text-neutral-500">📄</span>
                          <span>carcols.meta</span>
                        </div>
                      </>
                    )}
                    {(currentTool.category === 'props' || currentTool.id === 'shell_creator') && (
                      <div className="pl-8 text-neutral-400 flex items-center gap-1.5">
                        <span className="text-neutral-500">📄</span>
                        <span>{modelNameInput}.ytyp</span>
                        <span className="text-[9px] text-amber-400 font-sans">(CBaseArchetypeDef)</span>
                      </div>
                    )}
                    {currentTool.category === 'weapons' && (
                      <>
                        <div className="pl-8 text-neutral-400 flex items-center gap-1.5">
                          <span className="text-neutral-500">📄</span>
                          <span>weapons.meta</span>
                        </div>
                        <div className="pl-8 text-neutral-400 flex items-center gap-1.5">
                          <span className="text-neutral-500">📄</span>
                          <span>weaponcomponents.meta</span>
                        </div>
                      </>
                    )}
                    {currentTool.id === 'tattoo_creator' && (
                      <div className="pl-8 text-neutral-400 flex items-center gap-1.5">
                        <span className="text-neutral-500">📄</span>
                        <span>AddonTattoos.json</span>
                      </div>
                    )}
                    {currentTool.category === 'optimizers' && (
                      <div className="pl-8 text-neutral-400 flex items-center gap-1.5">
                        <span className="text-neutral-500">📄</span>
                        <span>resource_audit_report.json</span>
                      </div>
                    )}

                    {/* stream folder */}
                    <div className="pl-4 text-emerald-400 font-semibold flex items-center gap-1.5">
                      <span>📁 stream/</span>
                    </div>
                    {currentTool.category === 'vehicles' && (
                      <>
                        <div className="pl-8 text-emerald-300 flex items-center gap-1.5">
                          <span className="text-emerald-500">📦</span>
                          <span>{modelNameInput}.yft</span>
                          <span className="text-[9px] text-neutral-500 font-sans">(High-poly Mesh)</span>
                        </div>
                        <div className="pl-8 text-emerald-300 flex items-center gap-1.5">
                          <span className="text-emerald-500">📦</span>
                          <span>{modelNameInput}_hi.yft</span>
                          <span className="text-[9px] text-neutral-500 font-sans">(LOD0 Geometry)</span>
                        </div>
                        <div className="pl-8 text-emerald-300 flex items-center gap-1.5">
                          <span className="text-emerald-500">🎨</span>
                          <span>{modelNameInput}.ytd</span>
                          <span className="text-[9px] text-neutral-500 font-sans">(Mipmaps + PBR)</span>
                        </div>
                      </>
                    )}
                    {(currentTool.category === 'props' || currentTool.id === 'shell_creator') && (
                      <>
                        <div className="pl-8 text-emerald-300 flex items-center gap-1.5">
                          <span className="text-emerald-500">📦</span>
                          <span>{modelNameInput}.ydr</span>
                        </div>
                        <div className="pl-8 text-emerald-300 flex items-center gap-1.5">
                          <span className="text-emerald-500">🎨</span>
                          <span>{modelNameInput}.ytd</span>
                        </div>
                      </>
                    )}
                    {(currentTool.category === 'characters' || currentTool.id === 'chain_creator') && (
                      <>
                        <div className="pl-8 text-emerald-300 flex items-center gap-1.5">
                          <span className="text-emerald-500">📦</span>
                          <span>{modelNameInput}.ydd</span>
                        </div>
                        <div className="pl-8 text-emerald-300 flex items-center gap-1.5">
                          <span className="text-emerald-500">🎨</span>
                          <span>{modelNameInput}.ytd</span>
                        </div>
                      </>
                    )}
                    {currentTool.category === 'weapons' && (
                      <>
                        <div className="pl-8 text-emerald-300 flex items-center gap-1.5">
                          <span className="text-emerald-500">📦</span>
                          <span>w_{modelNameInput}.ydr</span>
                        </div>
                        <div className="pl-8 text-emerald-300 flex items-center gap-1.5">
                          <span className="text-emerald-500">🎨</span>
                          <span>w_{modelNameInput}.ytd</span>
                        </div>
                      </>
                    )}
                  </div>

                  {exportNotice && (
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed flex items-start gap-2 ${
                      exportNotice.type === 'success'
                        ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
                        : 'bg-rose-950/80 border border-rose-500/50 text-rose-200'
                    }`}>
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{exportNotice.text}</span>
                    </div>
                  )}

                  <button
                    onClick={handleExportCurrentTool}
                    disabled={isExporting}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs rounded-2xl shadow-xl shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span>تصدير حزمة FiveM Addon جاهزة للستريم (.ZIP)</span>
                  </button>
                </div>
              </div>

              {/* Right Column: 3D Viewport (7 cols on lg) */}
              <div className="lg:col-span-7 flex flex-col h-[620px] max-h-[84vh] lg:sticky lg:top-2">
                <FiveForgeViewport toolTitle={`FiveForge 3D - ${currentTool.nameAr}`}>
                  {/* Dynamic 3D Scene Geometry depending on Tool */}
                  <group position={[0, 0.45, 0]}>
                    
                    {/* Vehicle Tools 3D View: 6 Real High-Fidelity 3D Car GLBs + Custom Uploads */}
                    {currentTool.category === 'vehicles' && (
                      <RealisticGtaVehicle
                        carPreset={carPreset}
                        vehicleCategory={importedCarMeta.category}
                        carColor={carColor}
                        debadged={debadged}
                        filledFlush={filledFlush}
                        badgeMode={badgeMode}
                        customBadgeTexture={customBadgeTexture}
                        badgeScale={badgeScale}
                        sirenType={sirenType}
                        sirenColorMode={sirenColorMode}
                        sirenOffsetX={sirenOffsetX}
                        sirenOffsetY={sirenOffsetY}
                        sirenOffsetZ={sirenOffsetZ}
                        sirenScale={sirenScale}
                        customLightbarUrl={customLightbarUrl}
                        customLightbarFormat={customLightbarFormat}
                        customLightbarCacheId={customLightbarCacheId}
                        pushbarEnabled={pushbarEnabled}
                        selectedRim={selectedRim}
                        selectedBodykit={selectedBodykit}
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
                      />
                    )}

                    {/* Character & Ped Tools 3D View (Real GTA V Freemode Ped) */}
                    {currentTool.category === 'characters' && (
                      <RealisticGtaPed toolId={currentTool.id} />
                    )}

                    {/* Chain & Jewelry Tool 3D View (Realistic Miami Cuban Link + Iced Pendant) */}
                    {currentTool.id === 'chain_creator' && (
                      <RealisticGtaChain
                        chainType={chainType}
                        chainMetal={chainMetal}
                        pendantText={pendantText}
                        diamondGlow={diamondGlow}
                      />
                    )}

                    {/* Weapon 3D View (Realistic GTA Carbine M4 with Camo) */}
                    {currentTool.category === 'weapons' && (
                      <RealisticGtaWeapon
                        camoSkin={camoSkin}
                        weaponModel={selectedWeapon}
                      />
                    )}

                    {/* Plate Creator 3D View (Realistic 3D Embossed Stamped Plate) */}
                    {currentTool.id === 'plate_creator' && (
                      <RealisticGtaPlate
                        plateText={plateNumber}
                        stateBanner={plateText}
                      />
                    )}

                    {/* Prop & Shell 3D View */}
                    {(currentTool.category === 'props' || currentTool.id === 'shell_creator') && (
                      <mesh castShadow receiveShadow scale={propScale}>
                        <boxGeometry args={[0.9, 0.9, 0.9]} />
                        <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.5} />
                      </mesh>
                    )}

                    {/* Optimizers & Generic View */}
                    {currentTool.category === 'optimizers' && (
                      <mesh castShadow>
                        <octahedronGeometry args={[0.75, 1]} />
                        <meshStandardMaterial color="#10b981" wireframe roughness={0.4} />
                      </mesh>
                    )}
                  </group>
                </FiveForgeViewport>
              </div>
            </div>
          </div>
        )}

        {/* SECTION D: MY PROJECTS TAB */}
        {activeSection === 'projects' && !activeToolId && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">مشاريعي المحفوظة (My projects)</h3>
                <p className="text-xs text-neutral-400">إعادة فتح وتعديل وتصدير مشاريعك السابقة في أي وقت</p>
              </div>
              <button
                onClick={() => setActiveSection('tools')}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>مشروع جديد</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedProjects.map(proj => (
                <div key={proj.id} className="p-4 bg-neutral-950 rounded-3xl border border-neutral-800 space-y-3 shadow-lg">
                  <div className="h-28 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center relative overflow-hidden">
                    <div className="w-12 h-12 rounded-2xl" style={{ backgroundColor: proj.thumbColor }} />
                    <span className="absolute bottom-2 right-2 text-[9px] bg-black/80 text-white font-mono px-2 py-0.5 rounded-full">
                      {proj.tool}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white">{proj.name}</h4>
                    <span className="text-[10px] text-neutral-400 font-mono mt-0.5 block">تاريخ الإنشاء: {proj.date}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-900">
                    <button
                      onClick={() => alert(`جاري فتح مشروع "${proj.name}" داخل محرر FiveForge...`)}
                      className="flex-1 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-bold text-xs transition"
                    >
                      فتح وتعديل
                    </button>
                    <button
                      onClick={() => alert(`جاري تصدير حزمة الـ ZIP لمشروع "${proj.name}" مجاناً...`)}
                      className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition"
                      title="تحميل فوري"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION E: MY PARTS TAB */}
        {activeSection === 'parts' && !activeToolId && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">مكتبة القطع المحفوظة (My parts)</h3>
                <p className="text-xs text-neutral-400">الجنوط، الزوائد، والأجنحة المفصولة من السيارات لإعادة استخدامها</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {savedParts.map(part => (
                <div key={part.id} className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                      {part.type}
                    </span>
                    <Wrench className="w-3.5 h-3.5 text-neutral-500" />
                  </div>
                  <h4 className="text-xs font-bold text-white mt-1">{part.name}</h4>
                  <span className="text-[10px] text-neutral-400 block font-mono">المصدر: {part.sourceVehicle}</span>
                  <button
                    onClick={() => alert(`تم تحديد القطعة "${part.name}" لتطبيقها على السيارة النشطة!`)}
                    className="w-full mt-2 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-amber-400 text-[10px] font-bold border border-neutral-800 transition"
                  >
                    استخدام على سيارة
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION F: EXPORTS HISTORY TAB */}
        {activeSection === 'exports' && !activeToolId && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">سجل التصدير (Exports Log)</h3>
                <p className="text-xs text-neutral-400">تحميل مجاني غير محدود لمدة 7 أيام بعد التصدير الأول</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {exportHistoryLog.map(exp => (
                <div key={exp.id} className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      ZIP
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white font-mono">{exp.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400">
                        <span>{exp.tool}</span>
                        <span>•</span>
                        <span>{exp.size}</span>
                        <span>•</span>
                        <span>{exp.date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-lg border border-emerald-500/30 font-mono">
                      متبقي {exp.freeReExportDays} أيام مجاناً
                    </span>
                    <button
                      onClick={() => alert(`جاري تنزيل الملف "${exp.name}" مجاناً...`)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تحميل</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION G: GTA V DATABASE TAB */}
        {activeSection === 'database' && !activeToolId && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-white">قاعدة بيانات أصول وموديلات GTA V المعتمدة</h3>
                <p className="text-xs text-neutral-400">تصفح أصول قراند الأصلية واستيرادها فورياً إلى أدوات التعديل ثلاثية الأبعاد</p>
              </div>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="بحث في الأصول أو Spawn Code..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                />
              </div>
            </div>

            {/* Catalog Sub-tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 flex-wrap">
              {[
                { id: 'vehicles', label: `🚗 المركبات والسيارات (${GTA_DATABASE.vehicles.length})` },
                { id: 'peds', label: `👤 الشخصيات (${GTA_DATABASE.peds.length})` },
                { id: 'weapons', label: `🔫 الأسلحة (${GTA_DATABASE.weapons.length})` },
                { id: 'animations', label: `🎬 الأنيميشن (${GTA_DATABASE.animations.length})` },
                { id: 'props', label: `📦 المجسمات (${GTA_DATABASE.props.length})` }
              ].map(tb => (
                <button
                  key={tb.id}
                  onClick={() => setDbTab(tb.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    dbTab === tb.id
                      ? 'bg-amber-500 text-black shadow'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white'
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            {/* 1. Vehicles Grid */}
            {dbTab === 'vehicles' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {GTA_DATABASE.vehicles.map(veh => (
                  <div key={veh.model} className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3 hover:border-amber-500/50 transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">{veh.name}</h4>
                        <span className="text-[10px] text-amber-400 font-mono">Spawn: {veh.spawn}</span>
                      </div>
                      <span className="text-[10px] bg-neutral-900 text-neutral-300 px-2 py-0.5 rounded-full border border-neutral-800">
                        {veh.class}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-400 line-clamp-2">{veh.desc}</p>

                    <div className="grid grid-cols-3 gap-2 text-[10px] font-mono bg-neutral-900/60 p-2 rounded-xl text-neutral-300">
                      <div>السرعة: <b className="text-white">{veh.maxSpeed}</b></div>
                      <div>الدفع: <b className="text-white">{veh.drivetrain}</b></div>
                      <div>القطع: <b className="text-amber-400">{veh.tuningParts} قطعة</b></div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          setCarPreset(veh.model);
                          setModelNameInput(veh.spawn);
                          setActiveToolId('vehicle_editor');
                        }}
                        className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/10"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>فتح وتعديل في محرر السيارات V2</span>
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(veh.spawn);
                          alert(`تم نسخ Spawn Code: ${veh.spawn}`);
                        }}
                        className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-mono transition"
                      >
                        نسخ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. Peds Grid */}
            {dbTab === 'peds' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {GTA_DATABASE.peds.map(ped => (
                  <div key={ped.id} className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-neutral-200">{ped.name}</h4>
                      <span className="text-[9px] bg-neutral-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">{ped.category}</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block font-mono">Spawn: {ped.spawn}</span>
                    <p className="text-[11px] text-neutral-400 line-clamp-2">{ped.desc}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          setModelNameInput(ped.spawn);
                          setActiveToolId('clothing_textures');
                        }}
                        className="flex-1 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black text-[10px] font-bold transition"
                      >
                        فتح في استوديو الملابس
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(ped.spawn);
                          alert(`تم نسخ: ${ped.spawn}`);
                        }}
                        className="px-2 py-1.5 rounded-xl bg-neutral-900 text-[10px] text-neutral-300 font-mono"
                      >
                        نسخ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Weapons Grid */}
            {dbTab === 'weapons' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GTA_DATABASE.weapons.map(wpn => (
                  <div key={wpn.id} className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white">{wpn.name}</h4>
                      <span className="text-[9px] bg-neutral-900 text-amber-300 px-2 py-0.5 rounded font-mono">{wpn.class}</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono block">Code: {wpn.spawn}</span>
                    <p className="text-xs text-neutral-400">{wpn.desc}</p>
                    <button
                      onClick={() => {
                        setSelectedWeapon(wpn.spawn);
                        setModelNameInput(wpn.id);
                        setActiveToolId('weapon_skins');
                      }}
                      className="w-full py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition"
                    >
                      فتح وتصميم سكن في Weapon Skins
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 4. Animations Grid */}
            {dbTab === 'animations' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {GTA_DATABASE.animations.map((anm, idx) => (
                  <div key={idx} className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between gap-2">
                    <div>
                      <h5 className="text-xs font-bold text-white">{anm.label}</h5>
                      <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                        <span className="text-amber-400">{anm.dict}</span> / {anm.anim}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${anm.dict} ${anm.anim}`);
                        alert(`تم نسخ قاموس وحركة الأنيميشن!`);
                      }}
                      className="px-2.5 py-1 rounded bg-neutral-900 text-[10px] font-mono text-neutral-300"
                    >
                      نسخ
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 5. Props Grid */}
            {dbTab === 'props' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GTA_DATABASE.props.map((prp, idx) => (
                  <div key={idx} className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white">{prp.label}</h4>
                      <span className="text-[9px] bg-neutral-900 text-amber-300 px-2 py-0.5 rounded font-mono">{prp.size}</span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 block">{prp.name}</span>
                    <button
                      onClick={() => {
                        setModelNameInput(prp.name);
                        setActiveToolId('prop_creator');
                      }}
                      className="w-full py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black text-xs font-bold transition"
                    >
                      فتح وتعديل في صانع الأجسام (Prop Creator)
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION H: SERVER HUB TAB */}
        {activeSection === 'server_hub' && !activeToolId && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">مركز السيرفر السحابي (Server Hub)</h3>
                <p className="text-xs text-neutral-400">ربط السيرفر ومراقبة اللوقز المباشرة ومعرض الصور ولقطات الشاشة</p>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>متصل بالسيرفر (Connected)</span>
              </span>
            </div>

            {/* Server Live Console Logs */}
            <div className="bg-neutral-950 p-4 rounded-3xl border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-300 font-bold border-b border-neutral-900 pb-2">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span>سجل أحداث السيرفر المباشر (Live Server Logs):</span>
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">Port: 30120</span>
              </div>
              <div className="space-y-1.5 font-mono text-xs pt-1">
                {serverLogs.map((log, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[11px]">
                    <span className="text-neutral-500">[{log.time}]</span>
                    <span className="bg-neutral-900 text-amber-400 px-1 rounded text-[9px]">{log.type}</span>
                    <span className="text-neutral-300">{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Server Photos & Phone Gallery Grid */}
            <div className="bg-neutral-950 p-4 rounded-3xl border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>معرض صور اللاعبين بالجوال داخل السيرفر (Phone Photos Gallery):</span>
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">4 صور جديدة</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['Sunset at Pier', 'Police Chase Vinewood', 'Drift Meet LS Customs', 'Legion Square Night'].map((title, i) => (
                  <div key={i} className="h-28 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col justify-end p-2.5 relative group overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <span className="text-xs font-bold text-white relative z-10">{title}</span>
                    <span className="text-[9px] text-neutral-400 font-mono relative z-10">بواسطة لاعب #{12 + i}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* FULL-SCREEN BLENDER 3D VIEWPORT PAGE FOR IMPORTED VEHICLES */}
      <BlenderCarViewportPage
        isOpen={isBlenderPageOpen}
        onClose={() => setIsBlenderPageOpen(false)}
        carPreset={carPreset}
        setCarPreset={setCarPreset}
        importedCarMeta={importedCarMeta}
        setImportedCarMeta={setImportedCarMeta}
        carColor={carColor}
        setCarColor={setCarColor}
        debadged={debadged}
        setDebadged={setDebadged}
        filledFlush={filledFlush}
        setFilledFlush={setFilledFlush}
        badgeMode={badgeMode}
        setBadgeMode={setBadgeMode}
        customBadgeTexture={customBadgeTexture}
        setCustomBadgeTexture={setCustomBadgeTexture}
        badgeScale={badgeScale}
        setBadgeScale={setBadgeScale}
        sirenType={sirenType}
        setSirenType={setSirenType}
        sirenColorMode={sirenColorMode}
        setSirenColorMode={setSirenColorMode}
        sirenOffsetX={sirenOffsetX}
        setSirenOffsetX={setSirenOffsetX}
        sirenOffsetY={sirenOffsetY}
        setSirenOffsetY={setSirenOffsetY}
        sirenOffsetZ={sirenOffsetZ}
        setSirenOffsetZ={setSirenOffsetZ}
        sirenRotX={sirenRotX}
        setSirenRotX={setSirenRotX}
        sirenRotY={sirenRotY}
        setSirenRotY={setSirenRotY}
        sirenRotZ={sirenRotZ}
        setSirenRotZ={setSirenRotZ}
        sirenScale={sirenScale}
        setSirenScale={setSirenScale}
        pushbarEnabled={pushbarEnabled}
        setPushbarEnabled={setPushbarEnabled}
        selectedRim={selectedRim}
        setSelectedRim={setSelectedRim}
        stanceCamber={stanceCamber}
        setStanceCamber={setStanceCamber}
        stanceHeight={stanceHeight}
        setStanceHeight={setStanceHeight}
        stanceOffset={stanceOffset}
        setStanceOffset={setStanceOffset}
        headlightsOn={headlightsOn}
        setHeadlightsOn={setHeadlightsOn}
        underglowOn={underglowOn}
        setUnderglowOn={setUnderglowOn}
        underglowColor={underglowColor}
        setUnderglowColor={setUnderglowColor}
        customVehicleUrl={customVehicleUrl}
        customVehicleFormat={customVehicleFormat}
        customVehicleYtdUrl={customVehicleYtdUrl}
        customVehicleLivery={customVehicleLivery}
        onClearCustomVehicle={() => {
          setCustomVehicleUrl(null);
          setCustomVehicleYtdUrl(null);
        }}
        onImportUrl={(url) => handleStartImportCar(url)}
        isImporting={isImporting}
        importStatusMsg={importStatusMsg}
        onExportZip={handleExportCurrentTool}
        isExporting={isExporting}
        customLightbarUrl={customLightbarUrl}
        setCustomLightbarUrl={setCustomLightbarUrl}
        customLightbarFormat={customLightbarFormat}
        setCustomLightbarFormat={setCustomLightbarFormat}
        customLightbarCacheId={customLightbarCacheId}
        setCustomLightbarCacheId={setCustomLightbarCacheId}
        customLightbarName={customLightbarName}
        setCustomLightbarName={setCustomLightbarName}
        lcpdfrPackId={lcpdfrPackId}
        setLcpdfrPackId={setLcpdfrPackId}
        sirenAudioPack={sirenAudioPack}
        setSirenAudioPack={setSirenAudioPack}
      />
    </div>
  );
}
