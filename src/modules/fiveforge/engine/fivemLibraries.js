/**
 * Official libraries the studio is built around.
 * These are the user's sources plus the FiveM / Blender toolchain that opens their files.
 */
export const STUDIO_LIBRARIES = [
  {
    id: 'lcpdfr_lightbars',
    titleAr: 'ونانات LCPDFR',
    titleEn: 'LCPDFR Lightbars',
    url: 'https://www.lcpdfr.com/downloads/dev-resources/lightbars/?q=Hide-A-Way',
    noteAr: 'مكتبة الونان. حمّل الـ ZIP من الموقع ثم ارفعه هنا.'
  },
  {
    id: 'lcpdfr',
    titleAr: 'LCPDFR',
    titleEn: 'LCPDFR',
    url: 'https://www.lcpdfr.com/',
    noteAr: 'سيارات الطوارئ والبروبات.'
  },
  {
    id: 'gta5mods',
    titleAr: 'GTA5-Mods',
    titleEn: 'GTA5-Mods',
    url: 'https://www.gta5-mods.com/',
    noteAr: 'سيارات الـ YFT. الصق رابط صفحة السيارة.'
  },
  {
    id: 'fiveforge',
    titleAr: 'FiveForge',
    titleEn: 'FiveForge',
    url: 'https://five-forge.com/',
    noteAr: 'موقع الاستوديو.'
  },
  {
    id: 'blender',
    titleAr: 'Blender',
    titleEn: 'Blender',
    url: 'https://www.blender.org/',
    noteAr: 'Blender 4.0 أو أحدث لفتح الملفات.'
  },
  {
    id: 'sollumz',
    titleAr: 'Sollumz',
    titleEn: 'Sollumz',
    url: 'https://github.com/Sollumz/Sollumz',
    noteAr: 'إضافة Blender لملفات .yft / .ydr / .ytd و CodeWalker XML.'
  }
];

export function sollumzWorkflowText(modelName = 'vehicle') {
  return [
    'FiveForge — Sollumz / Blender / FiveM',
    '======================================',
    `Model: ${modelName}`,
    '',
    'المكتبات:',
    ...STUDIO_LIBRARIES.map((lib) => `- ${lib.titleEn}: ${lib.url}`),
    '',
    'ملف Sollumz يعني:',
    '- .yft أو .yft.xml  = Fragment السيارة (Drawable + تصادم)',
    '- .ytd               = قاموس التكستشر',
    '- .ydr أو .ydr.xml  = مجسم ثابت (بروب / ونان منفصل)',
    '- _hi.yft           = مستوى التفاصيل العالي',
    '',
    'المسار الصحيح:',
    '1. حمّل السيارة من gta5-mods (ZIP فيه YFT + YTD) أو الونان من LCPDFR.',
    '2. افتح Blender 4+ بعد تثبيت إضافة Sollumz.',
    '3. File > Import > CodeWalker XML أو استيراد ملف RAGE الأصلي (.yft).',
    '4. ركّب الونان كـ extra أو ادمجه داخل الـ Fragment، ثم صدّر CodeWalker XML.',
    '5. حوّل الـ XML إلى ملف أصلي بـ CodeWalker، وضعه في مجلد stream/ مع vehicles.meta و carcols.meta و carvariations.meta.',
    '',
    'المعاينة داخل FiveForge للضبط. ملف اللعبة النهائي هو YFT/YTD بعد Sollumz و CodeWalker.',
    'Sollumz docs: https://docs.sollumz.org/',
    'Blender: https://www.blender.org/download/'
  ].join('\n');
}
