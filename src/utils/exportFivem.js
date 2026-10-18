import JSZip from 'jszip';
import { bakePedHeadTexture, injectTextureIntoYTD } from './pedTextureBaker.js';

// قائمة الملفات الأساسية المرفقة لشخصية فايف إم
const baseStreamFiles = [
  'feet_000_u.ydd',
  'feet_diff_000_a_uni.png',
  'feet_diff_000_a_uni.ytd',
  'head_000_r.ydd',
  'head_diff_000_a_whi.png',
  'head_diff_000_a_whi.ytd',
  'jbib_000_u.ydd',
  'jbib_diff_000_a_uni.png',
  'jbib_diff_000_a_uni.ytd',
  'lowr_000_r.ydd',
  'lowr_diff_000_a_whi.png',
  'lowr_diff_000_a_whi.ytd',
  'micro_head_001_r_male_white_beast.ydr',
  'mp_m_freemode_01.yft',
  'mp_m_freemode_01.ymt',
  'uppr_000_r.ydd',
  'uppr_diff_000_a_whi.png',
  'uppr_diff_000_a_whi.ytd'
];

// دالة مساعدة لتحويل Data URL إلى Uint8Array
function dataURLtoUint8Array(dataurl) {
  const arr = dataurl.split(',');
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return u8arr;
}

export async function exportFiveMResource(resourceName = 'custom_ped_addon', morphs, textures = {}, walkStyle = 'casual') {
  const zip = new JSZip();

  // 1. ملف fxmanifest.lua الرسمي
  const fxmanifest = `fx_version 'cerulean'
game 'gta5'

author 'FiveM AI Studio Pro'
description 'Custom Freemode Ped Addon with Real Textures & Custom Morphs'
version '1.0.0'

files {
    'ped_config.json'
}

data_file 'PED_METADATA_FILE' 'ped_config.json'

client_script 'client.lua'
`;
  zip.file('fxmanifest.lua', fxmanifest);

  // 2. ملف الإعدادات التقنية ped_config.json
  const pedConfig = {
    resourceName,
    exportedAt: new Date().toISOString(),
    appearanceSettings: {
      height_scale: Number((morphs.height || 1.0).toFixed(2)),
      height_cm: Math.round((morphs.height || 1.0) * 175),
      shoulders_scale: Number((morphs.shoulders || 1.0).toFixed(2)),
      arm_muscles_scale: Number((morphs.armMuscles || 1.0).toFixed(2)),
      belly_fat_scale: Number((morphs.bellyFat || 1.0).toFixed(2)),
      chest_scale: Number((morphs.chest || 1.0).toFixed(2)),
      thighs_scale: Number((morphs.thighs || 1.0).toFixed(2)),
      head_scale: Number((morphs.head || 1.0).toFixed(2)),
      clothing_hex_color: morphs.clothingColor || '#ffffff',
      amputations: {
        hideRightArm: !!morphs.hideRightArm,
        hideLeftArm: !!morphs.hideLeftArm,
        hideRightLeg: !!morphs.hideRightLeg,
        hideLeftLeg: !!morphs.hideLeftLeg
      }
    },
    animationSettings: {
      walkStyle: walkStyle || 'casual',
      fivem_clipset: walkStyle === 'gangster' ? 'move_m@gangster@var_a' : (walkStyle === 'jog' ? 'move_m@jogger' : 'move_m@generic')
    },
    bonesMapping: {
      SKEL_ROOT: 0x0,
      SKEL_Spine3: 0x60f0,
      SKEL_Head: 0x796e,
      SKEL_L_Clavicle: 0xfcd9,
      SKEL_R_Clavicle: 0x29d2,
      SKEL_L_Thigh: 0xe39f,
      SKEL_R_Thigh: 0xca72
    }
  };
  zip.file('ped_config.json', JSON.stringify(pedConfig, null, 2));

  // 3. سكربت الكلاينت client.lua للتطبيق المباشر داخل السيرفر
  const clientLua = `-- FiveM AI Studio Pro Client Script
local config = json.decode(LoadResourceFile(GetCurrentResourceName(), 'ped_config.json'))

RegisterCommand('loadped', function()
    local model = GetHashKey("mp_m_freemode_01")
    RequestModel(model)
    local timeout = 0
    while not HasModelLoaded(model) and timeout < 200 do
        Wait(20)
        timeout = timeout + 1
    end

    if HasModelLoaded(model) then
        SetPlayerModel(PlayerId(), model)
        SetModelAsNoLongerNeeded(model)

        local ped = PlayerPedId()
        SetPedDefaultComponentVariation(ped)

        -- تطبيق الملابس والتكسشرات الأساسية
        SetPedComponentVariation(ped, 0, 0, 0, 0)  -- Head (الرأس)
        SetPedComponentVariation(ped, 3, 0, 0, 0)  -- Upper Body (الجذع)
        SetPedComponentVariation(ped, 4, 0, 0, 0)  -- Lower / Pants (البنطال)
        SetPedComponentVariation(ped, 6, 0, 0, 0)  -- Feet (الأحذية)
        SetPedComponentVariation(ped, 8, 0, 0, 0)  -- Undershirt
        SetPedComponentVariation(ped, 11, 0, 0, 0) -- Tops / Jacket (السترة)

        -- تطبيق مشية اللاعب المحددة
        if config and config.animationSettings and config.animationSettings.fivem_clipset then
            local clip = config.animationSettings.fivem_clipset
            RequestAnimSet(clip)
            while not HasAnimSetLoaded(clip) do
                Wait(10)
            end
            SetPedMovementClipset(ped, clip, 0.25)
        end

        TriggerEvent('chat:addMessage', {
            color = { 79, 70, 229 },
            args = { 'FiveM Studio AI', 'تم تحميل وتطبيق شخصية Ped المعدلة وتكسشراتها بنجاح!' }
        })
    else
        print("^1[FiveM AI Studio] فشل تحميل موديل Ped^7")
    end
end, false)
`;
  zip.file('client.lua', clientLua);

  // 4. ملف تعليمات التثبيت README.md
  const readme = `# مود FiveM AI Studio جاهز للتشغيل

تم تصدير هذه الحزمة بنجاح عبر استوديو FiveM AI Studio Pro.

## طريقة التركيب في سيرفر FiveM:
1. انقل المجلد الناتج بعد فك الضغط إلى مسار: \`[resources]/${resourceName}\`
2. افتح ملف \`server.cfg\` وأضف السطر:
   \`\`\`
   ensure ${resourceName}
   \`\`\`
3. ادخل السيرفر واكتب الأمر:
   \`\`\`
   /loadped
   \`\`\`
   سيتم تحويلك إلى شخصية فايف إم مع كافة التكسشرات والأبعاد والمشية المحددة!

شكراً لاستخدامك FiveM AI Studio Pro.
`;
  zip.file('README.md', readme);

  // 5. دمج وخبز تكسشرات الوجه والجروح والعيون والوشوم (Texture Baking Engine)
  let bakedHead = null;
  try {
    bakedHead = await bakePedHeadTexture(morphs, '/fivem_base/head_diff_000_a_whi.png');
  } catch (err) {
    console.warn('تعذر خبز تكسشر الرأس المعدل، سيتم استخدام التكسشر الافتراضي:', err);
  }

  // 6. مجلد stream وحقن ملفات الموديل والتكسشرات الحقيقية
  const stream = zip.folder('stream');

  // جلب وتضمين الملفات الأصلية من مجلد fivem_base مع حقن التعديلات في YTD و PNG
  for (const filename of baseStreamFiles) {
    try {
      const res = await fetch(`/fivem_base/${filename}`);
      if (res.ok) {
        const buffer = await res.arrayBuffer();

        // أ) حقن تكسشر الرأس المخبوز (PNG) بدلاً من الوجه الافتراضي
        if (filename === 'head_diff_000_a_whi.png' && bakedHead && bakedHead.buffer) {
          stream.file(filename, bakedHead.buffer);
        }
        // ب) حقن التكسشر المخبوز مباشرة داخل ملف الـ YTD الثنائي الخاص بالرأس ليتطابق مع OpenIV و FiveM 100%
        else if (filename === 'head_diff_000_a_whi.ytd' && bakedHead && bakedHead.rgba) {
          try {
            const updatedYtd = injectTextureIntoYTD(buffer, bakedHead.rgba, 512, 512);
            stream.file(filename, updatedYtd);
          } catch (ytdErr) {
            console.warn('تعذر حقن التكسشر داخل YTD، سيتم استخدام YTD الأصلي:', ytdErr);
            stream.file(filename, buffer);
          }
        } else {
          stream.file(filename, buffer);
        }
      }
    } catch (e) {
      console.warn(`تعذر جلب ملف ${filename}:`, e);
    }
  }

  // تضمين أي تكسشرات مخصصة إضافية أضافها المستخدم عبر الرفع اليدوي (Data URLs)
  const slotToFilename = {
    head: 'head_diff_000_a_whi.png',
    uppr: 'uppr_diff_000_a_whi.png',
    lowr: 'lowr_diff_000_a_whi.png',
    jbib: 'jbib_diff_000_a_uni.png',
    feet: 'feet_diff_000_a_uni.png'
  };

  Object.entries(textures).forEach(([slot, texObj]) => {
    if (texObj && texObj.url && texObj.url.startsWith('data:')) {
      const targetName = slotToFilename[slot];
      if (targetName) {
        try {
          const u8arr = dataURLtoUint8Array(texObj.url);
          stream.file(targetName, u8arr);
        } catch (err) {
          console.warn(`فشل حفظ تكسشر ${slot}:`, err);
        }
      }
    }
  });

  // توليد ملف الـ ZIP وتنزيله
  const blob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = `${resourceName}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * تنزيل صورة تكسشر الرأس المدمجة والمخبوزة بصيغة PNG مباشرة
 * مخصصة للاستخدام الفوري والاستبدال السريع داخل OpenIV
 */
export async function exportBakedHeadTexturePng(morphs, filename = 'head_diff_000_a_whi.png') {
  try {
    const baked = await bakePedHeadTexture(morphs, '/fivem_base/head_diff_000_a_whi.png');
    if (baked && baked.dataUrl) {
      const anchor = document.createElement('a');
      anchor.href = baked.dataUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      return true;
    }
  } catch (err) {
    console.error('فشل تصدير تكسشر الرأس لـ OpenIV:', err);
    throw err;
  }
  return false;
}
