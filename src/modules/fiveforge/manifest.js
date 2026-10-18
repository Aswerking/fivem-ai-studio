/**
 * FiveForge Module Manifest & 20 Master Tools Registry
 * 
 * Complete 20-tool modding ecosystem for FiveM / GTA V modding.
 * Non-destructive, additive architecture with credits economy and 7-day re-export protection.
 */

export const FIVEFORGE_MANIFEST = {
  version: "3.0.0-pro",
  codename: "FiveForge Titan Suite",
  philosophy: "No Blender, no OpenIV, no CodeWalker needed — 100% browser-based 3D asset pipeline for FiveM / GTA V",

  economy: {
    freeDailyCredits: 10,
    reExportWindowDays: 7,
    creditPacks: [
      { id: 'pack_starter', name: 'Starter Pack', credits: 150, priceUSD: 9.99 },
      { id: 'pack_pro', name: 'Creator Pro', credits: 500, priceUSD: 24.99, popular: true },
      { id: 'pack_studio', name: 'Server Studio', credits: 2500, priceUSD: 89.99 }
    ]
  },

  // 5 Main Categories
  categories: [
    { id: 'all', nameAr: 'كل الأدوات (20)', nameEn: 'All Tools (20)', icon: 'Layers' },
    { id: 'props', nameAr: 'المجسمات والمابات', nameEn: 'Props & Maps', icon: 'Box' },
    { id: 'vehicles', nameAr: 'السيارات والقوارب', nameEn: 'Vehicles & Boats', icon: 'Car' },
    { id: 'characters', nameAr: 'الشخصيات والملابس والمجوهرات', nameEn: 'Peds, Clothes & Chains', icon: 'User' },
    { id: 'weapons', nameAr: 'الأسلحة والسكنات', nameEn: 'Weapons & Camos', icon: 'Crosshair' },
    { id: 'optimizers', nameAr: 'التحسين ومركز السيرفر', nameEn: 'Optimizers & Server Hub', icon: 'Zap' }
  ],

  // Navigation Tabs
  navSections: [
    { id: 'overview', nameAr: 'نظرة عامة', nameEn: 'Overview', icon: 'LayoutDashboard' },
    { id: 'tools', nameAr: 'الأدوات الـ 20', nameEn: 'All Tools', icon: 'Layers' },
    { id: 'projects', nameAr: 'مشاريعي', nameEn: 'My projects', icon: 'FolderGit2' },
    { id: 'parts', nameAr: 'مكتبة القطع', nameEn: 'My parts', icon: 'Wrench' },
    { id: 'exports', nameAr: 'سجل التصدير', nameEn: 'Exports', icon: 'Download' },
    { id: 'database', nameAr: 'قاعدة بيانات قراند', nameEn: 'GTA V Database', icon: 'Database' },
    { id: 'server_hub', nameAr: 'مركز السيرفر', nameEn: 'Server Hub', icon: 'Server' }
  ],

  // THE 20 DEDICATED TOOLS
  tools: [
    // -------------------------------------------------------------
    // 1. صانع الأجسام (Prop Creator)
    // -------------------------------------------------------------
    {
      id: "prop_creator",
      number: 1,
      name: "Prop Creator",
      nameAr: "صانع الأجسام",
      category: "props",
      costCredits: 5,
      badge: "Essential",
      inputFormats: [".obj", ".fbx", ".gltf", ".glb", ".dae"],
      description: "تحويل أي مجسم 3D عادي إلى Prop جاهز للرسبنة في FiveM مع بناء جدران التصادم وحساب مستويات الرؤية LODs تلقائياً.",
      features: [
        "قبول مجسمات OBJ, FBX, glTF, GLB, DAE مع التكستشرات",
        "توليد جدران تصادم حقيقية (Havok Collision: Box أو Mesh) تمنع اختراق اللاعبين والسيارات",
        "توليد 3 مستويات تفاصيل ورؤية تلقائية (LODs: High, Med, Low)",
        "إنشاء ملف التعريف CBaseArchetypeDef و .ytyp تلقائياً",
        "تصدير مجلد Stream جاهز بملفات .ydr, .ytd, .ytyp, fxmanifest.lua"
      ],
      exportFiles: [".ydr", ".ytd", ".ytyp", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 2. صانع الأجسام بالذكاء الاصطناعي (AI Prop Creator)
    // -------------------------------------------------------------
    {
      id: "ai_prop_creator",
      number: 2,
      name: "AI Prop Creator (Image-to-3D)",
      nameAr: "صانع الأجسام بالذكاء الاصطناعي",
      category: "props",
      costCredits: 20,
      badge: "AI Powered",
      inputFormats: [".png", ".jpg", ".webp", "text-prompt"],
      description: "توليد مجسم 3D Prop كامل مع التكستشر من صورة واحدة فقط وتمريره مباشرة لمحرر الأجسام لضبط الأبعاد والتصادم.",
      features: [
        "تحويل فوري لأي صورة 2D إلى نموذج 3D متكامل مع الخامة",
        "فرد تلقائي للـ UV Map وتوليد خامات الألوان PBR",
        "تمرير مباشر إلى محرر الـ Prop لضبط المقاس والتصادم والـ LODs",
        "تصدير مورد FiveM فوري جاهز للرسبنة"
      ],
      exportFiles: [".ydr", ".ytd", ".ytyp", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 3. مستورد السيارات (Add-on Car Importer)
    // -------------------------------------------------------------
    {
      id: "car_importer",
      number: 3,
      name: "Add-on Car Importer",
      nameAr: "مستورد السيارات من GTA5-Mods",
      category: "vehicles",
      costCredits: 2,
      badge: "1-Click",
      inputFormats: ["url: gta5-mods.com", ".zip", ".rar", ".7z"],
      description: "تحويل روابط موقع GTA5-Mods أو الملفات المضغوطة للسيارات إلى مورد سيارة FiveM Add-on متكامل مع كافة ملفات الميتا والأصوات.",
      features: [
        "إلصاق رابط أي سيارة من gta5-mods.com وسحب الملفات مباشرة",
        "استخراج dlc.rpf وتفكيك الموديلات والتكستشرات تلقائياً",
        "توليد ملفات vehicles.meta, carvariations.meta, handling.meta, carcols.meta",
        "ضبط أصوات المحرك وفئات السيارات ومسارات الـ stream ومولد fxmanifest"
      ],
      exportFiles: [".yft", "_hi.yft", ".ytd", "vehicles.meta", "handling.meta", "carvariations.meta", "carcols.meta", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 4. محرر السيارات المتقدم (Vehicle Editor V2)
    // -------------------------------------------------------------
    {
      id: "vehicle_editor",
      number: 4,
      name: "Vehicle Editor V2",
      nameAr: "محرر السيارات المتقدم",
      category: "vehicles",
      costCredits: 20,
      badge: "V2 Engine",
      inputFormats: [".zip", ".yft", ".ytd"],
      description: "تعديل السيارات في المتصفح: إزالة الشعارات Debadge مع سد الفراغات وتنعيم البودي Fill/Flush، تغيير الجنوط، إضافة بودي كيت، وتعديل الوقفة Stance.",
      features: [
        "عارض 3D متطور يظهر خامات وألوان وانعكاسات السيارة الأصلية الحقيقية",
        "أداة إزالة الشعارات وسد الفراغ (Debadge & Fill/Flush): سمكرة الحفرة ومطابقة لون البودي تلقائياً",
        "تبديل وتجربة الجنوط (Rims) وحفظ القطع المفصولة في مكتبة My parts لاستخدامها على سيارات أخرى",
        "إضافة وتعديل قطع البودي كيت (Bodykits: زوائد، جناح، كبوت، مخارج شكمان)",
        "تعديل الوقفة (Stance: ميلان العجلات Camber، الارتفاع Ride Height، بروز الجنط Offset)"
      ],
      exportFiles: [".yft", "_hi.yft", ".ytd", "vehicles.meta", "handling.meta", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 5. صانع قوالب الليفري (Livery Mapper)
    // -------------------------------------------------------------
    {
      id: "livery_mapper",
      number: 5,
      name: "Livery Mapper & 3D Painter",
      nameAr: "صانع قوالب الليفري والرسم 3D",
      category: "vehicles",
      costCredits: 15,
      badge: "Live Canvas",
      inputFormats: [".yft", ".ytd", ".zip"],
      description: "جعل أي سيارة غير مجهزة لليفري قابلة لتركيب الاستكرات عبر فرد أجزاء البودي في قالب UV نظيف ورسم الليفري مباشرة في المتصفح.",
      features: [
        "فرد أجزاء البودي (الكبوت، السقف، الأبواب، الصدامات) في صورة قالب UV Template Sheet عالية الدقة (PNG)",
        "رسم وتلوين وتركيب استكرات الرعاة والشعارات كطبقات Layers مباشرة على سطح السيارة 3D",
        "إنشاء خانة ليفري جديدة تلقائياً داخل موديل .yft وملف .ytd وتعديل carvariations.meta",
        "تصدير القالب للتعديل الخارجي في الفوتوشوب مع إمكانية رفعه مرة أخرى"
      ],
      exportFiles: [".yft", ".ytd", "template_uv.png", "carvariations.meta", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 6. مغير التكستشرات الثلاثي الأبعاد (Retexture)
    // -------------------------------------------------------------
    {
      id: "retexture_3d",
      number: 6,
      name: "3D Retexture Tool",
      nameAr: "مغير التكستشرات الثلاثي الأبعاد",
      category: "props",
      costCredits: 10,
      badge: "Click & Swap",
      inputFormats: [".ydr", ".ytd", ".ydd", ".zip"],
      description: "استبدال أي تكستشر داخل ماب داخلي (MLO) أو مجسم (Prop) أو جدار أو لوحة بمجرد النقر المباشر عليه في بيئة 3D.",
      features: [
        "النقر بالماوس المباشر (Raycasting) على أي سطح داخل المجسم 3D لمعرفة خامة التكستشر المرتبطة به",
        "رفع الصورة أو الشعار الجديد ليتم استبداله فورياً مع الحفاظ على مقاييس الإضاءة والـ Mipmaps",
        "استخراج جميع صور قواميس YTD دفعة واحدة وإعادة تجميعها بدون أي تشويه بصري",
        "تصدير فوري للملفات المعدلة جاهزة للسيرفر"
      ],
      exportFiles: [".ydr", ".ytd", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 7. مصمم تكستشرات الملابس (Clothing Textures)
    // -------------------------------------------------------------
    {
      id: "clothing_textures",
      number: 7,
      name: "Clothing Textures Studio",
      nameAr: "مصمم تكستشرات الملابس",
      category: "characters",
      costCredits: 5,
      badge: "Layers 3D",
      inputFormats: [".ydd", ".ytd", ".png", ".dds"],
      description: "تلوين وتصميم ملابس شخصيات FiveM Freemode مباشرة في المتصفح مع نظام طبقات وشعارات وخطوط إرشاد الـ UV دون الحاجة لـ OpenIV.",
      features: [
        "معاينة حية فورية على مجسم شخصية MP Male / MP Female مع دعم كافة القطع (تيشيرت، سترة، بنطال، حذاء، قناع)",
        "نظام طبقات متقدم (Layers): ألوان أساسية، خطوط رياضية، وتطريز شعارات مع قفل النسبة",
        "خطوط إرشاد الـ UV ومحاذاة التموضع لمنع تشوه الرسومات عند حواف القماش",
        "حفظ وتوليد Mipmaps تلقائياً داخل ملف الـ YTD لمنع وميض وتكسير التكستشر داخل اللعبة"
      ],
      exportFiles: [".ydd", ".ytd", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 8. مصمم سكنات الأسلحة (Weapon Skins)
    // -------------------------------------------------------------
    {
      id: "weapon_skins",
      number: 8,
      name: "Weapon Skins & Camos",
      nameAr: "مصمم سكنات الأسلحة والتمويهات",
      category: "weapons",
      costCredits: 10,
      badge: "Camo Studio",
      inputFormats: ["Vanilla Weapons Selector", ".png", ".jpg", ".dds"],
      description: "تصميم سكنات وتمويهات Camos لأسلحة GTA الأصلية في المتصفح مع تصدير حزمة سكنات مجمعة في مورد FiveM واحد.",
      features: [
        "مكتبة مسبقة لجميع أسلحة قراند الأصلية (Pistol, AP Pistol, Carbine, SMG, Sniper, Special Carbine)",
        "تطبيق نقوش التمويه الحية: ديجيتال، دمشقي، كاربون فايبر، تايجر أحمر، وذهب خالص 24 قيراط مع لمعان معدني",
        "تصميم عدة ألوان وتمويهات للسلاح نفسه وتصديرها معاً في حزمة مورد واحد جاهزة للتركيب",
        "دعم كامل لإضافات السلاح (كاتم، مخزن، ليزر، سكوب)"
      ],
      exportFiles: [".ydr", ".ytd", "weapons.meta", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 9. صانع الأسلحة المخصصة (Weapon Creator)
    // -------------------------------------------------------------
    {
      id: "weapon_creator",
      number: 9,
      name: "Custom Weapon Creator",
      nameAr: "صانع الأسلحة المخصصة Add-on",
      category: "weapons",
      costCredits: 25,
      badge: "Add-on Guns",
      inputFormats: [".obj", ".fbx", ".glb", ".zip"],
      description: "بناء سلاح إضافي جديد كلياً (Add-on Weapon) من مجسم 3D، مع محاذاة قبضة اليد ومكان المخزن وشعلة الإطلاق والمنظار.",
      features: [
        "استيراد مجسم 3D لأي بندقية أو مسدس أو سلاح أبيض",
        "محاذاة قبضة اليد (Align the grip) بدقة متناهية على يد شخصية Freemode",
        "تحديد نقاط التموضع التشريحية: خروج الطلقات (Muzzle flash)، مكان المخزن (Magazine)، والسكوب",
        "توليد ملفات weapons.meta و weaponcomponents.meta مع إعدادات الضرر والارتداد والصوت",
        "تصدير مورد سلاح Add-on كامل شغال للرسبنة الفورية"
      ],
      exportFiles: [".ydr", ".ytd", "weapons.meta", "weaponcomponents.meta", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 10. صانع السلاسل والمجوهرات (Chain Creator / Chain Tool V2)
    // -------------------------------------------------------------
    {
      id: "chain_creator",
      number: 10,
      name: "Chain Creator V2",
      nameAr: "صانع السلاسل والمجوهرات ثلاثية الأبعاد",
      category: "characters",
      costCredits: 200,
      badge: "Iced Out",
      inputFormats: [".png Logo", "3D Text String", ".obj", ".glb"],
      description: "تصميم سلاسل وقلائد وحروف 3D مجسمة ومضبوطة على رقبة شخصية GTA الأصلية مع خامات الذهب والفضة وشيدر الألماس المتوهج.",
      features: [
        "أنواع حلقات متعددة: Cuban Link 8mm/12mm, Tennis Chain, Rope Chain, Franco",
        "تحويل أي صورة شعار Logo أو كتابة نص إلى قلادة ثلاثية الأبعاد (3D Pendant) مع تأثير البروز والشامفر",
        "خامات واقعية: ذهب أصفر عيار 24، فضة إسترليني، روز جولد، وشيدر الألماس المفرغ (Iced-Out Pavé Diamond Glow)",
        "ربط عظام تلقائي مع رقبة وصدر الشخصية (SKEL_Neck_1 & SKEL_Spine3) بدون أي اختراق للجسد أثناء الحركة",
        "تصدير مورد ملابس وإكسسوارات Add-on جاهز (.ydd, .ytd, .ymt, fxmanifest.lua)"
      ],
      exportFiles: [".ydd", ".ytd", ".ymt", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 11. صانع الوشوم (Tattoo Creator)
    // -------------------------------------------------------------
    {
      id: "tattoo_creator",
      number: 11,
      name: "Tattoo Creator",
      nameAr: "صانع الوشوم وتراكب البشرة",
      category: "characters",
      costCredits: 0,
      badge: "Free 3/Day",
      inputFormats: [".png Transparent"],
      description: "وضع الصور والرسومات كوشوم مباشرة على جسم شخصية 3D Ped وتصديرها مع ملفات التوافق مع سكربتات التاتو مثل rcore_tattoos.",
      features: [
        "سحب وإفلات صورة الوشم وتحريكها وتكبيرها وتدويرها بحرية على أي جزء من جسم ورأس الشخصية 3D",
        "شيدر حبر وشم واقعي يتداخل مع خلايا ومسامات الجلد الطبيعية بدلاً من الظهور كملصق سطحي",
        "توليد قواميس الوشوم وتجهيز ملفات AddonTattoos.json المتوافقة مع سكربتات rcore و qb-tattoos",
        "تصدير مورد FiveM كامل بملفات .ydd, .ytd, .ymt"
      ],
      exportFiles: [".ydd", ".ytd", ".ymt", "AddonTattoos.json", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 12. صانع بشرة الوجه (Face Skin Creator)
    // -------------------------------------------------------------
    {
      id: "face_skin_creator",
      number: 12,
      name: "Face Skin Creator",
      nameAr: "صانع بشرة وملامح الوجه",
      category: "characters",
      costCredits: 15,
      badge: "Headshots",
      inputFormats: [".png", ".jpg", ".webp"],
      description: "تحويل صورة وجه حقيقية أمامية (Headshot) إلى تكستشر وجه دقيق ومفرود لشخصية FiveM مع تنعيم الحواف ومطابقة الملامح.",
      features: [
        "مطابقة معالم الوجه (العينين، الأنف، الفم، الخدين) وإسقاطها بدقة على خريطة الـ UV الرسمية لرأس Freemode",
        "خوارزمية تنعيم الحواف ودمج لون البشرة لضمان عدم وجود أي فواصل لونية بين الوجه والرقبة",
        "معاينة تفاعلية 3D لحظية على رأس الموديل الأصلي head_000_r",
        "تصدير صورة head_diff_000_a_whi.png وحقنها داخل YTD مباشرة"
      ],
      exportFiles: ["head_diff_000_a_whi.png", "head_diff_000_a_whi.ytd", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 13. صانع الشخصيات بالذكاء الاصطناعي (AI Ped Creator)
    // -------------------------------------------------------------
    {
      id: "ai_ped_creator",
      number: 13,
      name: "AI Ped Creator",
      nameAr: "صانع الشخصيات بالذكاء الاصطناعي",
      category: "characters",
      costCredits: 300,
      badge: "AI Rigging",
      inputFormats: [".png Full-body", ".jpg", "Concept Art"],
      description: "تحويل صورة شخصية واحدة إلى Ped كامل مع ربط الهيكل العظمي (Rigged Ped) ليعمل مع المشي والحركات والإيموتات في اللعبة.",
      features: [
        "استخلاص بنية الجسم والملابس والملامح من صورة الشخصية",
        "اختيار بنية الجسم (Body Build: عادي Normal، ضخم Heavy، أو ضخم جداً Very heavy)",
        "ربط عظام تلقائي وموثوق مع الهيكل العظمي الرسمي Freemode Skeleton (أكثر من 90 عظمة)",
        "دعم كامل لتشغيل المشي، الجري، قيادة السيارات، والأنيميشن التفاعلي بدون تمزق في المضلعات",
        "تصدير مورد Add-on Ped كامل بملفات .ydd, .yft, .ytd, .ymt, peds.meta, fxmanifest.lua"
      ],
      exportFiles: [".ydd", ".yft", ".ytd", ".ymt", "peds.meta", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 14. صانع القوارب (Boat Creator)
    // -------------------------------------------------------------
    {
      id: "boat_creator",
      number: 14,
      name: "Boat Creator",
      nameAr: "صانع القوارب واليخوت",
      category: "vehicles",
      costCredits: 25,
      badge: "Marine Physics",
      inputFormats: [".obj", ".fbx", ".glb", ".zip"],
      description: "تحويل أي مجسم قارب 3D إلى قارب FiveM قابل للقيادة والطفو على الماء ومطابق لفيزياء أمواج قراند.",
      features: [
        "رفع مجسم القارب وضبط المقياس وتحديد مقعد السائق والركاب",
        "معايرة خط الطفو على الماء (Waterline Buoyancy Calibration) لمنع الغرق أو الطيران",
        "توليد جدران التصادم المائية والفيزيائية (Marine Havok Collision)",
        "توليد ملف handling.meta مخصص للقوارب المائية وملفات vehicles.meta كاملة",
        "تصدير مورد قارب جاهز للرسبنة والقيادة في البحر"
      ],
      exportFiles: [".yft", "_hi.yft", ".ytd", "vehicles.meta", "handling.meta", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 15. صانع الشيلات السكنية (Shell Creator)
    // -------------------------------------------------------------
    {
      id: "shell_creator",
      number: 15,
      name: "Housing Shell Creator",
      nameAr: "صانع الشيلات السكنية والمنازل",
      category: "props",
      costCredits: 200,
      badge: "Housing",
      inputFormats: ["Interactive Architectural Grid", ".obj", ".glb"],
      description: "بناء تصميم داخلي لبيوت وشقق ومستودعات (Housing Shell) مباشرة في المتصفح وجاهزة للربط مع سكربتات العقارات.",
      features: [
        "أداة بناء معمارية شبكية (2D Floorplan Grid) لرسم الغرف، الجدران، الأبواب، والنوافذ بسهولة",
        "اختيار خامات الجدران والأرضيات والإضاءة من مكتبة خامات واقعية",
        "وضع نقاط التموضع للأبواب وممرات الدخول ونقاط الرسبنة الخاصة بسكربتات البيوت (NoPixel, Loaf, QBCore)",
        "توليد التصادم الكامل بدون فراغات تسرب اللاعب إلى الفراغ",
        "تصدير مورد Shell كامل (.ydr, .ytyp, .ytd, fxmanifest.lua)"
      ],
      exportFiles: [".ydr", ".ytd", ".ytyp", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 16. محول سيارات الشرطة (ELS to Non-ELS)
    // -------------------------------------------------------------
    {
      id: "els_converter",
      number: 16,
      name: "ELS to Non-ELS Converter",
      nameAr: "محول سيارات الشرطة (ELS إلى Non-ELS)",
      category: "vehicles",
      costCredits: 30,
      badge: "Lag Reducer",
      inputFormats: [".yft", ".ytd", ".xml VCF"],
      description: "تحويل سيارات الطوارئ والشرطة من نظام ELS المعقد المسبب للاق إلى نظام السفتي الأصلي المستقر (Native GTA Sirens).",
      features: [
        "قراءة ملف إعدادات الإضاءة VCF XML واستخراج فلاشات ونبضات السفتي",
        "تحويل قطع الإضاءة (Extras / Rotators) إلى Siren IDs أصلية لمحرك قراند",
        "توليد ملفات carcols.meta و carvariations.meta برمجياً بدون أخطاء وميض",
        "تخفيض استهلاك المعالج وتأخير الستريم للسيرفر مع مزامنة متقنة 100% بين اللاعبين"
      ],
      exportFiles: [".yft", "carcols.meta", "carvariations.meta", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 17. صانع اللوحات (Plate Creator)
    // -------------------------------------------------------------
    {
      id: "plate_creator",
      number: 17,
      name: "Custom License Plate Creator",
      nameAr: "صانع لوحات السيارات المخصصة",
      category: "vehicles",
      costCredits: 5,
      badge: "Server Branding",
      inputFormats: [".png Graphic", "Custom Font"],
      description: "تصميم لوحات أرقام سيارات مخصصة للسيرفر بالكامل مع الحروف البارزة وشعار السيرفر والانعكاسات الواقعية.",
      features: [
        "تصميم خلفية اللوحة وإضافة شعار السيرفر واسم المدينة أو الولاية",
        "توليد خريطة البروز (Normal Map / Bump) لجعل الأرقام والحروف نافرة ومجسمة مثل اللوحات المعدنية الحقيقية",
        "ضبط خط الأرقام ونمط التباين والانعكاسات اللامعة",
        "تصدير مورد FiveM يستبدل لوحات السيرفر أو يضيف لوحة مخصصة مع ملف vehshare.ytd"
      ],
      exportFiles: ["vehshare.ytd", "carvariations.meta", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 18. محسن المابات (Map Optimiser)
    // -------------------------------------------------------------
    {
      id: "map_optimiser",
      number: 18,
      name: "Map & MLO Optimiser",
      nameAr: "محسن المابات والـ MLO",
      category: "optimizers",
      costCredits: 10,
      badge: "FPS Boost",
      inputFormats: [".zip MLO Folder", ".ydr", ".ytd"],
      description: "تقليل استهلاك المابات والـ MLO الثقيلة لتخفيف دروب الفريمات (FPS Drops) وتفادي اختفاء المباني أثناء الستريم.",
      features: [
        "فحص تلقائي لكافة ملفات الـ MLO وكشف التكستشرات العملاقة 4K/8K",
        "تقليص ذكي للأبعاد وضغط DXT/BC مع المحافظة التامة على الجودة البصرية للنصوص والأخشاب",
        "تقليل عدد استدعاءات الرسم (Draw Calls) وتحسين طبقات الرؤية Occlusion Culling",
        "تصدير نسخة محسنة وخفيفة من الماب توفر حتى 60% من استهلاك الذاكرة"
      ],
      exportFiles: [".ydr", ".ytd", ".ytyp", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 19. محسن السيارات (Vehicle Optimiser)
    // -------------------------------------------------------------
    {
      id: "vehicle_optimiser",
      number: 19,
      name: "Vehicle Memory Optimiser",
      nameAr: "محسن ذاكرة وتكستشرات السيارات",
      category: "vehicles",
      costCredits: 10,
      badge: "Crash Fixer",
      inputFormats: [".yft", ".ytd", ".zip"],
      description: "تقليص حجم ذاكرة تكستشرات السيارات لإزالة تحذيرات الذاكرة باللون الأصفر/الأحمر وحل مشكلة اختفاء شوارع اللعبة (Texture Loss).",
      features: [
        "فحص ملفات .yft وكشف النماذج التي تتجاوز حد 16MB لتقسيمها أو ضغطها",
        "كشف وتصغير الصور الضخمة داخل ملفات .ytd وتحويلها إلى أبعاد متوافقة مع قوى العدد 2 (Power of 2)",
        "إصلاح وفحص مستويات Mipmaps المفقودة المسببة لتشويش الصورة على البعد",
        "تخفيض حجم ملف الـ YTD بنسبة تصل إلى 75% بدون أي هبوط ملحوظ في جودة العرض"
      ],
      exportFiles: [".yft", "_hi.yft", ".ytd", "fxmanifest.lua"]
    },

    // -------------------------------------------------------------
    // 20. فاحص ومحسن الموارد العام + مركز السيرفر (Optimiser & Server Hub)
    // -------------------------------------------------------------
    {
      id: "optimiser_hub",
      number: 20,
      name: "Resource Optimiser & Server Hub",
      nameAr: "فاحص الموارد الشامل ومركز السيرفر",
      category: "optimizers",
      costCredits: 10,
      badge: "Diagnostics & Hub",
      inputFormats: [".zip Any Resource", "Server Webhook / IP"],
      description: "فحص تكلفة أي مورد FiveM وحساب تأثيره على كرت الشاشة والرام (VRAM/Streaming) مع لوحة تحكم سحابية لربط السيرفر واللوقز والصور.",
      features: [
        "فاحص تكلفة الموارد (Resource Cost Scanner): حساب حجم الـ Streaming، عدد المضلعات Polygons، وحجم استهلاك الـ VRAM",
        "كشف المشاكل والأخطاء البرمجية وإصلاحها بضغطة زر واحدة (1-Click Auto-Fix)",
        "مركز السيرفر السحابي (Server Hub): مراقبة سجلات السيرفر المباشرة (Server Live Logs)",
        "معرض لقطات الشاشة والصور الملتقطة من كاميرات جوالات اللاعبين داخل السيرفر في مكان موحد",
        "تصدير تقرير تشخيصي بصيغة PDF / Markdown مع المورد المحسن"
      ],
      exportFiles: ["optimized_resource.zip", "resource_audit_report.json"]
    }
  ]
};
