/**
 * LCPDFR Dev-Resources Lightbar / Siren Prop Catalog
 * Maps public LCPDFR download pages to FiveForge siren presets.
 * User can paste a link OR upload the ZIP they downloaded from LCPDFR.
 */

export const LCPDFR_LIGHTBAR_CATALOG = [
  {
    id: 'generic_light_pack',
    titleAr: 'Generic Light Pack — حزمة ونان عامة',
    titleEn: 'Generic Light Pack',
    author: 'Dev Resource',
    kind: 'lightbar',
    sirenType: 'lightbar_led',
    mount: 'roof',
    extrasHint: ['extra_1', 'extra_2', 'extra_3'],
    badge: 'سقف',
    descAr: 'حزمة أضواء عامة للسقف والشبك — مناسبة لسيارات الشرطة في FiveM (Non-ELS).',
    url: 'https://www.lcpdfr.com/downloads/dev-resources/lightbars/18715-generic-light-pack/',
    match: [/18715/, /generic[-_]?light[-_]?pack/i]
  },
  {
    id: 'axixtech_stealth_visor',
    titleAr: 'Axixtech Stealth Visor — شماسية مخفية',
    titleEn: 'Axixtech Stealth Visor (Unlocked)',
    author: 'Axixtech',
    kind: 'lightbar',
    sirenType: 'visor_unmarked',
    mount: 'visor',
    extrasHint: ['extra_1', 'extra_12'],
    badge: 'مباحث',
    descAr: 'شريط تظليل داخلي stealth خلف الزجاج الأمامي — مثالي للسيارات السرية.',
    url: 'https://www.lcpdfr.com/downloads/dev-resources/lightbars/4400-axixtech-stealth-visor-unlocked/',
    match: [/4400/, /axixtech/, /stealth[-_]?visor/i]
  },
  {
    id: 'soundoff_ion_plate',
    titleAr: 'SoundOff Ion + لوحة أرقام',
    titleEn: 'SoundOff Ion & License Plate Mount',
    author: 'SoundOff Signal',
    kind: 'lightbar',
    sirenType: 'soundoff_ion',
    mount: 'grille_plate',
    extrasHint: ['extra_5', 'extra_6'],
    badge: 'شبك',
    descAr: 'فلاشات SoundOff Ion مع حامل على لوحة الأرقام الأمامية — مظهر شرطة واقعي.',
    url: 'https://www.lcpdfr.com/downloads/dev-resources/lightbars/48277-sound-off-ion-and-license-plate-mount/',
    match: [/48277/, /sound[-_]?off[-_]?ion/i, /license[-_]?plate[-_]?mount/i]
  },
  {
    id: 'hideaway_vertex',
    titleAr: 'Hide-A-Way — فلاشات مخفية',
    titleEn: 'Hide-A-Way / Whelen Vertex Style',
    author: 'Dev Resource',
    kind: 'lightbar',
    sirenType: 'hideaway_vertex',
    mount: 'headlights',
    extrasHint: ['extra_7', 'extra_8', 'extra_9'],
    badge: 'مخفي',
    descAr: 'فلاشات داخل الشمعات والاسطبات بدون ونان سقف — سيارة مدنية الظاهر.',
    url: 'https://www.lcpdfr.com/downloads/dev-resources/lightbars/?q=Hide-A-Way',
    match: [/hide[-_]?a[-_]?way/i, /hideaway/i, /vertex/i]
  },
  {
    id: 'realistic_siren_audio',
    titleAr: 'أصوات سفتي واقعية (صوت فقط)',
    titleEn: 'Realistic Siren Weapon Sounds Pack',
    author: 'Audio Pack',
    kind: 'audio',
    sirenType: null,
    audioPack: 'realistic_siren_weapons',
    mount: 'audio',
    extrasHint: [],
    badge: 'صوت',
    descAr: 'حزمة أصوات سفتي/سلاح واقعية — تُضاف لملفات الصوت في التصدير (ليس مجسم 3D).',
    url: 'https://www.lcpdfr.com/downloads/gta5mods/audio/54162-realistic-siren-weapon-sounds-pack/',
    match: [/54162/, /realistic[-_]?siren[-_]?weapon/i, /audio/i]
  }
];

export function isLcpdfrUrl(raw) {
  if (!raw || typeof raw !== 'string') return false;
  return /lcpdfr\.com/i.test(raw.trim());
}

export function resolveLcpdfrPackFromUrl(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!url) return null;

  for (const pack of LCPDFR_LIGHTBAR_CATALOG) {
    if (pack.match.some((re) => re.test(url))) return pack;
  }

  // Generic lightbars section without specific id → Hide-A-Way search page
  if (/lcpdfr\.com\/downloads\/dev-resources\/lightbars/i.test(url)) {
    return LCPDFR_LIGHTBAR_CATALOG.find((p) => p.id === 'hideaway_vertex') || null;
  }

  return null;
}

export function getLcpdfrPackById(id) {
  return LCPDFR_LIGHTBAR_CATALOG.find((p) => p.id === id) || null;
}

/**
 * Build FiveM-friendly siren export notes + suggested extras for stream folder.
 */
export function buildSirenExportMeta({
  sirenType = 'none',
  sirenColorMode = 'red_blue',
  lcpdfrPackId = null,
  audioPack = null,
  customLightbarName = null,
  sirenOffsetY = 0,
  sirenOffsetZ = 0,
  sirenScale = 1
} = {}) {
  const pack = lcpdfrPackId ? getLcpdfrPackById(lcpdfrPackId) : null;
  const hasSiren = Boolean(sirenType && sirenType !== 'none' && sirenType !== 'auto');

  const colorMap = {
    red_blue: { primary: 'blue', secondary: 'red', note: 'LSPD style alternating' },
    blue_only: { primary: 'blue', secondary: 'blue', note: 'Unmarked / detective' },
    red_white: { primary: 'red', secondary: 'white', note: 'Fire / EMS hybrid' },
    amber_gold: { primary: 'amber', secondary: 'amber', note: 'Traffic / tow' }
  };

  return {
    hasSiren,
    sirenType: hasSiren ? sirenType : 'none',
    sirenColorMode,
    colors: colorMap[sirenColorMode] || colorMap.red_blue,
    lcpdfr: pack
      ? {
          id: pack.id,
          title: pack.titleEn,
          url: pack.url,
          mount: pack.mount,
          kind: pack.kind,
          credit: `Prop style inspired by LCPDFR: ${pack.titleEn}. Download original from ${pack.url} and credit the author.`
        }
      : null,
    audioPack: audioPack || pack?.audioPack || null,
    customLightbarName,
    transform: {
      offsetY: sirenOffsetY,
      offsetZ: sirenOffsetZ,
      scale: sirenScale
    },
    fivemNotes: [
      'Use Non-ELS native sirens via carcols.meta + carvariations.meta sirenSettings.',
      'Place lightbar drawable extras as vehicle extras (extra_1 …) or attach as props.',
      'If you imported a custom ZIP from LCPDFR, keep the original author credit in your resource README.',
      'Audio packs go under audioconfig / sfx — not inside stream/*.yft.'
    ]
  };
}
