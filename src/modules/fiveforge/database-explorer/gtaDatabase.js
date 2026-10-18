/**
 * GTA V Asset Catalog & Search Database
 * Curated database of Vanilla GTA 5 Peds, Animations, Vehicles, Weapons, and World Props.
 */

export const GTA_DATABASE = {
  vehicles: [
    { 
      model: "sultanrs", 
      name: "Karin Sultan RS", 
      class: "Sports / Tuner", 
      spawn: "sultanrs", 
      maxSpeed: "205 km/h",
      drivetrain: "AWD",
      tuningParts: 28,
      recommendedTool: "vehicle_editor",
      desc: "سيارة التونينج والسباقات اليابانية المفضلة بمحرك توربو ونظام دفع كلي ودعم بودي كيت عريض."
    },
    { 
      model: "elegy2", 
      name: "Annis Elegy Retro Custom", 
      class: "Sports / JDM", 
      spawn: "elegy2", 
      maxSpeed: "198 km/h",
      drivetrain: "AWD",
      tuningParts: 34,
      recommendedTool: "vehicle_editor",
      desc: "الأسطورة الكلاسيكية اليابانية المبنية على طراز Skyline GT-R R32 مع خيارات تعديل هائلة."
    },
    { 
      model: "zentorno", 
      name: "Pegassi Zentorno", 
      class: "Supercar", 
      spawn: "zentorno", 
      maxSpeed: "220 km/h",
      drivetrain: "AWD",
      tuningParts: 18,
      recommendedTool: "vehicle_editor",
      desc: "سيارة هايبركار إيطالية شرسة بتصميم لاهث ومحرك V12 هجين."
    },
    { 
      model: "buffalo4", 
      name: "Bravado Buffalo STX", 
      class: "Muscle", 
      spawn: "buffalo4", 
      maxSpeed: "202 km/h",
      drivetrain: "RWD",
      tuningParts: 26,
      recommendedTool: "vehicle_editor",
      desc: "وحش العضلات الأمريكية بمحرك هيمي سوبرتشارج وصوت هادر ونظام تحصين إيماني."
    },
    { 
      model: "t20", 
      name: "Progen T20 Hypercar", 
      class: "Supercar", 
      spawn: "t20", 
      maxSpeed: "225 km/h",
      drivetrain: "AWD",
      tuningParts: 14,
      recommendedTool: "vehicle_editor",
      desc: "هايبركار بريطانية بجناح خلفي هوائي متكيف (Active Aero Spoiler) وأبواب أجنحة الفراشة."
    },
    { 
      model: "kuruma2", 
      name: "Karin Armored Kuruma", 
      class: "Sports / Armored", 
      spawn: "kuruma2", 
      maxSpeed: "175 km/h",
      drivetrain: "AWD",
      tuningParts: 12,
      recommendedTool: "vehicle_editor",
      desc: "السيارة المصفحة الأكثر شهرة في مهام السرقات بزجاج ونوافذ مدرعة مضادة للرصاص."
    },
    { 
      model: "police3", 
      name: "Vapid Police Interceptor", 
      class: "Emergency", 
      spawn: "police3", 
      maxSpeed: "190 km/h",
      drivetrain: "RWD",
      tuningParts: 8,
      recommendedTool: "els_converter",
      desc: "سيارة دوريات شرطة لوس سانتوس الرئيسية المزودة بمصد الصدمات وصفارات الطوارئ."
    },
    { 
      model: "fbi2", 
      name: "Declasse FIB Granger SUV", 
      class: "Emergency", 
      spawn: "fbi2", 
      maxSpeed: "165 km/h",
      drivetrain: "4WD",
      tuningParts: 6,
      recommendedTool: "els_converter",
      desc: "مركبة دفع رباعي تكتيكية خاصة بالمباحث الفيدرالية مع إمكانية تمسك العملاء بالجانبين."
    },
    { 
      model: "comet6", 
      name: "Pfister Comet S2", 
      class: "Sports / Tuner", 
      spawn: "comet6", 
      maxSpeed: "208 km/h",
      drivetrain: "RWD",
      tuningParts: 32,
      recommendedTool: "livery_mapper",
      desc: "سيارة رياضية ألمانية راقية بمحرك خلفي تيربو وقوالب ليفري سباقات متعددة."
    },
    { 
      model: "jester4", 
      name: "Dinka Jester RR", 
      class: "Sports / Tuner", 
      spawn: "jester4", 
      maxSpeed: "204 km/h",
      drivetrain: "RWD",
      tuningParts: 30,
      recommendedTool: "vehicle_editor",
      desc: "أحدث طرازات التونينج بتصميم عدواني ودعم واسع لكافة قطع الكاربون والاستكرات."
    }
  ],

  peds: [
    { id: "mp_m_freemode_01", name: "Freemode Male Ped", category: "Multiplayer", hash: "0x705E61F2", spawn: "mp_m_freemode_01", tool: "clothing_textures", desc: "الشخصية الأساسية للاعبين الذكور في سيرفرات فايف إم مع دعم كامل للملابس والوشوم." },
    { id: "mp_f_freemode_01", name: "Freemode Female Ped", category: "Multiplayer", hash: "0x9C9EFFD8", spawn: "mp_f_freemode_01", tool: "clothing_textures", desc: "الشخصية الأساسية للاعبات الإناث مع توافق تام لكافة طبقات الملابس والإكسسوارات." },
    { id: "s_m_y_cop_01", name: "LSPD Patrol Officer", category: "Emergency", hash: "0x5E3DA4A4", spawn: "s_m_y_cop_01", tool: "ai_ped", desc: "شرطي دوريات لوس سانتوس بالزي الرسمي." },
    { id: "s_m_y_swat_01", name: "SWAT Tactical Officer", category: "Emergency", hash: "0x8D8F1B10", spawn: "s_m_y_swat_01", tool: "ai_ped", desc: "عنصر قوات التدخل السريع مع الدرع والخوذة التكتيكية." },
    { id: "s_m_m_paramedic_01", name: "EMS Paramedic", category: "Emergency", hash: "0x118D63DE", spawn: "s_m_m_paramedic_01", tool: "ai_ped", desc: "مسعف الطوارئ بالسترة الطبية العاكسة." },
    { id: "s_m_y_sheriff_01", name: "County Sheriff", category: "Emergency", hash: "0xD0C85387", spawn: "s_m_y_sheriff_01", tool: "ai_ped", desc: "شريف مقاطعة بلين كاونتي." },
    { id: "player_zero", name: "Michael De Santa", category: "Story", hash: "0x0D7114C9", spawn: "player_zero", tool: "ai_ped", desc: "مايكل دي سانتا - بطل طور القصة." },
    { id: "player_one", name: "Franklin Clinton", category: "Story", hash: "0x9B22DBAF", spawn: "player_one", tool: "ai_ped", desc: "فرانكلين كلينتون - بطل طور القصة." },
    { id: "player_two", name: "Trevor Philips", category: "Story", hash: "0x9B810FA2", spawn: "player_two", tool: "ai_ped", desc: "تريفور فيليبس - بطل طور القصة." }
  ],

  weapons: [
    { id: "weapon_carbinerifle", name: "Carbine Rifle (M4)", class: "Assault Rifle", spawn: "WEAPON_CARBINERIFLE", tool: "weapon_skins", desc: "البندقية الهجومية التكتيكية الأكثر استخداماً بين أفراد الشرطة والعصابات." },
    { id: "weapon_specialcarbine", name: "Special Carbine (G36)", class: "Assault Rifle", spawn: "WEAPON_SPECIALCARBINE", tool: "weapon_skins", desc: "بندقية متقدمة خفيفة الوزن ذات دقة تصويب استثنائية." },
    { id: "weapon_combatpistol", name: "Combat Pistol (Glock 17)", class: "Handgun", spawn: "WEAPON_COMBATPISTOL", tool: "weapon_skins", desc: "المسدس القياسي المعتمد لسيرفرات الحياة الواقعية." },
    { id: "weapon_heavysniper", name: "Heavy Sniper Rifle", class: "Sniper", spawn: "WEAPON_HEAVYSNIPER", tool: "weapon_skins", desc: "قناصة عيار .50 بعيدة المدى خارقة للدروع." }
  ],

  animations: [
    { dict: "amb@world_human_cop_idles@male@idle_a", anim: "idle_a", label: "Police Officer Idle Stance", flags: 49 },
    { dict: "anim@heists@heist_corona@single_team", anim: "single_team_loop_boss", label: "Heist Boss Arms Crossed", flags: 1 },
    { dict: "move_m@gangster@var_a", anim: "idle", label: "Gangster Heavy Walk Idle", flags: 33 },
    { dict: "anim@mp_player_intcelebrationmale@salute", anim: "salute", label: "Military Formal Salute", flags: 48 },
    { dict: "amb@world_human_security_guard@male@idle_a", anim: "idle_a", label: "Security Guard Flashlight Check", flags: 49 },
    { dict: "amb@world_human_leaning@male@wall@back@foot_up@idle_a", anim: "idle_a", label: "Leaning Against Wall", flags: 1 },
    { dict: "mp_ped_interaction@kisses@std_a", anim: "kiss_male", label: "Casual Celebration / Greeting", flags: 48 }
  ],

  props: [
    { name: "prop_barrier_work05", label: "Police Tactical Barrier", archetype: "CBaseArchetypeDef", size: "1.8m x 1.1m x 0.4m" },
    { name: "prop_ballistic_shield", label: "SWAT Riot Shield", archetype: "CBaseArchetypeDef", size: "0.6m x 1.2m x 0.1m" },
    { name: "prop_cs_heist_bag_02", label: "Duffle Heist Bag", archetype: "CBaseArchetypeDef", size: "0.7m x 0.4m x 0.3m" },
    { name: "prop_ld_greenscreen_01", label: "Studio Green Screen Studio Wall", archetype: "CBaseArchetypeDef", size: "4.0m x 2.8m x 0.2m" }
  ]
};
