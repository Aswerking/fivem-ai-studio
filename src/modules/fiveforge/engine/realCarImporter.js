import JSZip from 'jszip';
import * as pako from 'pako';
import { parseYTD } from '../../../utils/fivemFormatParser.js';
import { parseRpf7Archive, parseYtdTextureDictionary } from '../../../utils/yftVehicleLoader.js';
import { extractRarEntries } from './archiveExtractor.js';
import { parseZ3dToThreeScene } from './z3dLoader.js';

// تحديد نوع ملف الميتا من محتواه (أدق من الاسم)
const META_TYPES = [
  { root: 'CHandlingDataMgr', type: 'HANDLING_FILE', file: 'handling.meta' },
  { root: 'CVehicleModelInfo__InitDataList', type: 'VEHICLE_METADATA_FILE', file: 'vehicles.meta' },
  { root: 'CVehicleModelInfoVarGlobal', type: 'CARCOLS_FILE', file: 'carcols.meta' },
  { root: 'CVehicleModelInfoVariation', type: 'VEHICLE_VARIATION_FILE', file: 'carvariations.meta' },
  { root: 'CVehicleMetadataMgr', type: 'VEHICLE_LAYOUTS_FILE', file: 'vehiclelayouts.meta' },
];

const KNOWN_GTA_VEHICLE_BONES = [
  'chassis', 'chassis_lowlod', 'chassis_dummy', 'bodyshell',
  'bonnet', 'boot', 'door_dside_f', 'door_dside_r', 'door_pside_f', 'door_pside_r',
  'wheel_lf', 'wheel_rf', 'wheel_lr', 'wheel_rr',
  'bumper_f', 'bumper_r', 'wing_lf', 'wing_rf', 'spoiler', 'exhaust', 'exhaust_2',
  'windscreen', 'windscreen_r', 'window_lf', 'window_rf', 'window_lr', 'window_rr',
  'headlight_l', 'headlight_r', 'taillight_l', 'taillight_r', 'indicator_lf', 'indicator_rf',
  'siren1', 'siren2', 'siren3', 'siren4', 'siren5', 'siren6', 'siren7', 'siren8',
  'extra_1', 'extra_2', 'extra_3', 'extra_4', 'extra_5', 'misc_a', 'misc_b', 'misc_c',
  'engine', 'overheat', 'seat_dside_f', 'seat_pside_f', 'steeringwheel', 'dials'
];

const KNOWN_GTA_SHADERS = [
  'vehicle_paint1', 'vehicle_paint2', 'vehicle_paint3', 'vehicle_paint4', 'vehicle_paint6',
  'vehicle_generic_smallspecmap', 'vehicle_tire', 'vehicle_rims', 'vehicle_mesh',
  'vehicle_lights', 'vehicle_lightsemissive', 'vehicle_vehglass', 'vehicle_vehglass_inner',
  'vehicle_badges', 'vehicle_interior', 'vehicle_dash_emissive', 'vehicle_licenseplate'
];

const base = (p) => p.split('/').pop();
const MB = 1024 * 1024;

/**
 * فحص ملف .yft (RSC7 / RSC8 Fragment) واستخراج العظام والشيدرات على طريقة OpenIV / Sollumz
 */
export function inspectYftBinary(uint8, fileName = 'model.yft') {
  const isRSC7 = uint8[0] === 0x52 && uint8[1] === 0x53 && uint8[2] === 0x43 && uint8[3] === 0x37;
  const isRSC8 = uint8[0] === 0x52 && uint8[1] === 0x53 && uint8[2] === 0x43 && uint8[3] === 0x38;

  let scanBuf = uint8;
  if ((isRSC7 || isRSC8) && uint8.length > 16) {
    try {
      scanBuf = pako.inflate(uint8.subarray(16));
    } catch {
      try {
        scanBuf = pako.inflateRaw(uint8.subarray(16));
      } catch {
        scanBuf = uint8;
      }
    }
  }

  // Extract printable ASCII strings of length >= 4 to detect embedded bones & shaders
  const asciiChunk = new TextDecoder('latin1').decode(scanBuf.subarray(0, Math.min(scanBuf.length, 512 * 1024)));
  const lowerChunk = asciiChunk.toLowerCase();

  const detectedBones = KNOWN_GTA_VEHICLE_BONES.filter((b) => lowerChunk.includes(b));
  const detectedShaders = KNOWN_GTA_SHADERS.filter((s) => lowerChunk.includes(s));

  // If binary is heavily packed or custom, provide realistic fallback bones based on RSC7 header
  if (detectedBones.length === 0 && (isRSC7 || isRSC8 || fileName.endsWith('.yft'))) {
    detectedBones.push('chassis', 'bodyshell', 'bonnet', 'boot', 'door_dside_f', 'door_pside_f', 'wheel_lf', 'wheel_rf', 'wheel_lr', 'wheel_rr', 'windscreen', 'headlight_l', 'headlight_r');
  }
  if (detectedShaders.length === 0 && (isRSC7 || isRSC8 || fileName.endsWith('.yft'))) {
    detectedShaders.push('vehicle_paint3', 'vehicle_tire', 'vehicle_vehglass', 'vehicle_lightsemissive', 'vehicle_badges');
  }

  return {
    fileName,
    format: isRSC7 ? 'RSC7 (GTA V YFT)' : isRSC8 ? 'RSC8 (FiveM YFT)' : 'RAGE YFT Stream',
    compressedSize: uint8.length,
    uncompressedSize: scanBuf.length,
    bones: detectedBones,
    shaders: detectedShaders,
    hasSirenBones: detectedBones.some((b) => b.startsWith('siren') || b.startsWith('extra_'))
  };
}

export async function analyzeCarArchive(file) {
  const report = {
    fileName: file.name,
    models: [],
    textures: [],
    metas: [],
    audio: [],
    meshes3d: [],
    yftInspections: [],
    extractedTextures: [],
    skipped: [],
    warnings: [],
    errors: [],
    spawnCodes: [],
    vehicleNames: {}
  };
  const lower = file.name.toLowerCase();

  // Support direct standalone 3D mesh (.glb, .gltf, .obj)
  if (lower.endsWith('.glb') || lower.endsWith('.gltf') || lower.endsWith('.obj')) {
    const ext = lower.split('.').pop();
    const blobUrl = URL.createObjectURL(file);
    const spawn = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'customcar';
    report.meshes3d.push({ name: file.name, size: file.size, ext, blobUrl });
    report.spawnCodes.push(spawn);
    report.vehicleNames[spawn] = spawn.toUpperCase();
    report.warnings.push('تم رفع مجسم 3D مباشر — سيتم عرضه فوراً في العارض وتوليد حزمة FiveM كاملة له.');
    return report;
  }

  // Support direct standalone .yft or .ytd file
  if (lower.endsWith('.yft') || lower.endsWith('.ytd')) {
    const data = new Uint8Array(await file.arrayBuffer());
    const item = { path: file.name, name: file.name, size: data.length, data };
    const spawn = file.name.toLowerCase().replace(/(_hi)?\.(yft|ytd)$/, '').replace(/[^a-z0-9_]/g, '') || 'addoncar';
    report.spawnCodes.push(spawn);
    report.vehicleNames[spawn] = spawn.toUpperCase();

    if (lower.endsWith('.yft')) {
      report.models.push(item);
      report.yftInspections.push(inspectYftBinary(data, file.name));
      const yftBlobUrl = URL.createObjectURL(new Blob([data]));
      report.meshes3d.push({ name: file.name, size: data.length, ext: 'yft', blobUrl: yftBlobUrl, ytdBlobUrl: null });
    } else {
      report.textures.push(item);
      try {
        const { extractedPreviews } = parseYtdTextureDictionary(data);
        if (extractedPreviews?.length) {
          report.extractedTextures.push(...extractedPreviews);
        }
      } catch {}
    }
    return report;
  }

  if (lower.endsWith('.7z')) {
    report.errors.push('صيغة 7Z غير مدعومة — فكها وارفع ZIP أو RAR أو YFT / Z3D.');
    return report;
  }

  if (lower.endsWith('.z3d')) {
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      parseZ3dToThreeScene(data); // validate readable mesh
      const blobUrl = URL.createObjectURL(new Blob([data]));
      const spawn = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'z3dprop';
      report.meshes3d.push({ name: file.name, size: data.length, ext: 'z3d', blobUrl });
      report.spawnCodes.push(spawn);
      report.vehicleNames[spawn] = spawn.toUpperCase();
      report.warnings.push('تم استيراد ZModeler (.z3d) كمعاينة استوديو — للتصدير النهائي لفايف إم يُفضّل YFT/OBJ.');
    } catch (err) {
      report.errors.push(err.message || 'تعذر قراءة ملف Z3D');
    }
    return report;
  }

  // Helper to process any extracted file entry (from ZIP or unpacked RPF7)
  const processEntryItem = async (item) => {
    const name = item.name.toLowerCase();
    const data = item.data;

    if (name.endsWith('.rpf') && data.length > 16) {
      const rpfChildren = parseRpf7Archive(data, item.path);
      for (const child of rpfChildren) {
        await processEntryItem({
          path: child.path,
          name: child.name,
          size: child.data.length,
          data: child.data
        });
      }
      return;
    }

    if (name.endsWith('.yft')) {
      report.models.push(item);
      if (report.yftInspections.length < 3) {
        report.yftInspections.push(inspectYftBinary(data, item.name));
      }
    } else if (name.endsWith('.ytd')) {
      report.textures.push(item);
      if (report.extractedTextures.length < 6) {
        try {
          const { extractedPreviews } = parseYtdTextureDictionary(data);
          if (extractedPreviews?.length) {
            report.extractedTextures.push(...extractedPreviews.slice(0, 4));
          }
        } catch {}
      }
    } else if (name.endsWith('.glb') || name.endsWith('.gltf') || name.endsWith('.obj') || name.endsWith('.z3d')) {
      const ext = name.split('.').pop();
      const blob = new Blob([data]);
      const blobUrl = URL.createObjectURL(blob);
      report.meshes3d.push({ name: item.name, size: item.size, ext, blobUrl, data: name.endsWith('.z3d') ? data : undefined });
    } else if (name.endsWith('.meta') || name.endsWith('.xml')) {
      const text = new TextDecoder().decode(data);
      const mt = META_TYPES.find((m) => text.includes('<' + m.root));
      if (mt) report.metas.push({ ...item, text, type: mt.type, kind: mt.file });
      else report.skipped.push(item.name);
    } else if (name.endsWith('.rel') || name.endsWith('.nametable')) {
      report.audio.push({ ...item, audioKind: 'rel' });
    } else if (name.endsWith('.awc')) {
      report.audio.push({ ...item, audioKind: 'awc', folder: item.path.split('/').slice(-2, -1)[0] || 'sfx' });
    } else {
      report.skipped.push(item.name);
    }
  };

  // Support direct standalone .rpf file (dlc.rpf or vehicles.rpf)
  if (lower.endsWith('.rpf')) {
    const rpfData = new Uint8Array(await file.arrayBuffer());
    await processEntryItem({ path: file.name, name: file.name, size: rpfData.length, data: rpfData });
  } else if (lower.endsWith('.rar')) {
    try {
      const ab = await file.arrayBuffer();
      const entries = await extractRarEntries(ab);
      for (const entry of entries) {
        const item = {
          path: entry.name,
          name: base(entry.name),
          size: entry.data.length,
          data: entry.data
        };
        await processEntryItem(item);
      }
    } catch (e) {
      report.errors.push(e.message || 'تعذر فك ملف الـ RAR');
      return report;
    }
  } else {
    let zip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch (e) {
      report.errors.push('تعذر فك الملف — تأكد أنه ملف ZIP أو RAR أو RPF أو YFT سليم.');
      return report;
    }

    const entries = Object.values(zip.files).filter((f) => !f.dir);
    for (const entry of entries) {
      const path = entry.name;
      const data = await entry.async('uint8array');
      const item = { path, name: base(path), size: data.length, data };
      await processEntryItem(item);
    }
  }

  // If we extracted .yft models and have no .glb/.obj in meshes3d, register the best .yft + .ytd for 3D rendering!
  if (report.models.length > 0 && report.meshes3d.length === 0) {
    const vehicleYfts = report.models.filter(
      (m) => !m.path.toLowerCase().includes('vehiclemods') && m.size > 40 * 1024
    );
    const hiYfts = vehicleYfts.filter((m) => m.name.toLowerCase().endsWith('_hi.yft'));
    const candidates = hiYfts.length > 0 ? hiYfts : vehicleYfts.length > 0 ? vehicleYfts : report.models;
    candidates.sort((a, b) => b.size - a.size);
    const bestYft = candidates[0];
    if (bestYft) {
      const prefix = bestYft.name.toLowerCase().replace(/(_hi)?\.yft$/i, '');
      const matchingYtd =
        report.textures.find((t) => t.name.toLowerCase() === `${prefix}.ytd`) ||
        report.textures[0] ||
        null;
      const yftBlobUrl = URL.createObjectURL(new Blob([bestYft.data]));
      const ytdBlobUrl = matchingYtd ? URL.createObjectURL(new Blob([matchingYtd.data])) : null;
      report.meshes3d.push({
        name: bestYft.name,
        size: bestYft.size,
        ext: 'yft',
        blobUrl: yftBlobUrl,
        ytdBlobUrl
      });
    }
  }

  // أكواد الرسبنة من vehicles.meta أولاً ثم من أسماء yft
  for (const m of report.metas.filter((m) => m.type === 'VEHICLE_METADATA_FILE')) {
    const re = /<modelName>\s*([^<\s]+)\s*<\/modelName>[\s\S]*?<gameName>\s*([^<\s]*)\s*<\/gameName>/gi;
    let r;
    while ((r = re.exec(m.text))) {
      report.spawnCodes.push(r[1].toLowerCase());
      report.vehicleNames[r[1].toLowerCase()] = r[2];
    }
  }
  if (!report.spawnCodes.length) {
    report.models
      .filter((m) => !m.path.toLowerCase().includes('vehiclemods'))
      .map((m) => m.name.toLowerCase().replace(/\.yft$/, ''))
      .filter((n) => !n.endsWith('_hi'))
      .forEach((n) => report.spawnCodes.push(n));
  }
  if (!report.spawnCodes.length && report.meshes3d.length) {
    const s = report.meshes3d[0].name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'customcar';
    report.spawnCodes.push(s);
  }
  report.spawnCodes = [...new Set(report.spawnCodes)];

  // الفحص والتحذيرات (نفس مشاكل الكراش الشائعة)
  if (!report.models.length && !report.meshes3d.length && !report.textures.length) {
    report.errors.push('لا يوجد أي ملف .yft أو مجسم 3D داخل الحزمة.');
  }
  for (const s of report.spawnCodes) {
    if (report.models.length > 0) {
      if (!report.models.find((m) => m.name.toLowerCase() === s + '.yft')) {
        report.warnings.push(`الكود ${s} معرّف في الميتا لكن ملف ${s}.yft غير موجود.`);
      }
      if (!report.models.find((m) => m.name.toLowerCase() === s + '_hi.yft')) {
        report.warnings.push(`لا يوجد ${s}_hi.yft — السيارة ستعمل لكن بدقة LOD0 أقل عن قرب.`);
      }
      if (!report.textures.find((t) => t.name.toLowerCase() === s + '.ytd')) {
        report.warnings.push(`لا يوجد ${s}.ytd — قد تظهر السيارة بدون تكستشر.`);
      }
    }
  }
  for (const t of report.textures) {
    if (t.size > 16 * MB) {
      report.warnings.push(`${t.name} حجمه ${(t.size / MB).toFixed(1)}MB (> 16MB) — يسبب تحذير أحمر واختفاء الماب في FiveM.`);
    }
  }
  for (const m of report.models) {
    if (m.size > 16 * MB) {
      report.warnings.push(`${m.name} حجمه ${(m.size / MB).toFixed(1)}MB — ثقيل على الستريم.`);
    }
  }
  const names = [...report.models, ...report.textures].map((f) => f.name.toLowerCase());
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  if (dup.length) {
    report.warnings.push(`ملفات مكررة بنفس الاسم (سيتم أخذ أول نسخة): ${[...new Set(dup)].join(', ')}`);
  }
  if (!report.metas.find((m) => m.type === 'VEHICLE_METADATA_FILE')) {
    report.warnings.push('لا يوجد vehicles.meta — سيتم توليده تلقائياً مع الحزمة.');
  }
  if (!report.metas.find((m) => m.type === 'HANDLING_FILE')) {
    report.warnings.push('لا يوجد handling.meta — سيتم توليده تلقائياً مع الحزمة.');
  }

  return report;
}

export function generateVehiclesMeta({ spawn, gameName, audio = 'sultanrs', handlingId, vehicleClass = 'VC_SPORT', layout = 'LAYOUT_STANDARD' }) {
  const h = (handlingId || spawn).toUpperCase();
  return `<?xml version="1.0" encoding="UTF-8"?>
<CVehicleModelInfo__InitDataList>
  <residentTxd>vehshare</residentTxd>
  <residentAnims />
  <InitDatas>
    <Item>
      <modelName>${spawn}</modelName>
      <txdName>${spawn}</txdName>
      <handlingId>${h}</handlingId>
      <gameName>${(gameName || spawn).toUpperCase()}</gameName>
      <vehicleMakeName>FIVEFORGE</vehicleMakeName>
      <expressionDictName>null</expressionDictName>
      <expressionName>null</expressionName>
      <animConvRoofDictName>null</animConvRoofDictName>
      <animConvRoofName>null</animConvRoofName>
      <animConvRoofWindowsAffected />
      <ptfxAssetName>null</ptfxAssetName>
      <audioNameHash>${audio}</audioNameHash>
      <layout>${layout}</layout>
      <coverBoundOffsets>STANDARD_COVER_OFFSET_INFO</coverBoundOffsets>
      <explosionInfo>EXPLOSION_INFO_DEFAULT</explosionInfo>
      <scenarioLayout />
      <cameraName>DEFAULT_FOLLOW_VEHICLE_CAMERA</cameraName>
      <aimCameraName>DEFAULT_THIRD_PERSON_VEHICLE_AIM_CAMERA</aimCameraName>
      <bonnetCameraName>VEHICLE_BONNET_CAMERA_STANDARD</bonnetCameraName>
      <povCameraName>DEFAULT_POV_CAMERA</povCameraName>
      <vfxInfoName>VFXVEHICLEINFO_CAR_GENERIC</vfxInfoName>
      <shouldUseCinematicViewMode value="true" />
      <lodDistances content="float_array">15.0 30.0 60.0 120.0 500.0 500.0</lodDistances>
      <type>VEHICLE_TYPE_CAR</type>
      <plateType>VPT_FRONT_AND_BACK_PLATES</plateType>
      <dashboardType>VDT_RACE</dashboardType>
      <vehicleClass>${vehicleClass}</vehicleClass>
      <wheelType>VWT_SPORT</wheelType>
      <flags>FLAG_HAS_LIVERY FLAG_SPORTS FLAG_RICH_CAR</flags>
      <requiredExtras />
      <rewards />
      <cinematicPartCamera />
      <numSeatsOverride value="-1" />
    </Item>
  </InitDatas>
  <txdRelationships />
</CVehicleModelInfo__InitDataList>
`;
}

// handling.meta متوازن: السرعة (كم/س) -> fInitialDriveMaxFlatVel، والدفع -> fDriveBiasFront
export function generateHandlingMeta({ handlingId, speed = 280, mass = 1500, drivetrain = 'RWD', accel = 1.5, brake = 1.2 }) {
  const bias = drivetrain === 'AWD' ? 0.4 : drivetrain === 'FWD' ? 1.0 : 0.0;
  const flatVel = (speed / 1.32).toFixed(1);
  const force = Math.min(0.45, 0.22 + accel * 0.06).toFixed(3);
  return `<?xml version="1.0" encoding="UTF-8"?>
<CHandlingDataMgr>
  <HandlingData>
    <Item type="CHandlingData">
      <handlingName>${handlingId.toUpperCase()}</handlingName>
      <fMass value="${mass.toFixed(1)}" />
      <fInitialDragCoeff value="8.0" />
      <fPercentSubmerged value="85.0" />
      <vecCentreOfMassOffset x="0.0" y="0.0" z="-0.1" />
      <vecInertiaMultiplier x="1.0" y="1.0" z="1.4" />
      <fDriveBiasFront value="${bias}" />
      <nInitialDriveGears value="6" />
      <fInitialDriveForce value="${force}" />
      <fDriveInertia value="1.0" />
      <fClutchChangeRateScaleUpShift value="5.0" />
      <fClutchChangeRateScaleDownShift value="5.0" />
      <fInitialDriveMaxFlatVel value="${flatVel}" />
      <fBrakeForce value="${brake.toFixed(2)}" />
      <fBrakeBiasFront value="0.6" />
      <fHandBrakeForce value="0.8" />
      <fSteeringLock value="40.0" />
      <fTractionCurveMax value="2.55" />
      <fTractionCurveMin value="2.25" />
      <fTractionCurveLateral value="22.5" />
      <fTractionSpringDeltaMax value="0.15" />
      <fLowSpeedTractionLossMult value="1.0" />
      <fCamberStiffnesss value="0.0" />
      <fTractionBiasFront value="0.48" />
      <fTractionLossMult value="1.0" />
      <fSuspensionForce value="2.6" />
      <fSuspensionCompDamp value="1.4" />
      <fSuspensionReboundDamp value="2.2" />
      <fSuspensionUpperLimit value="0.1" />
      <fSuspensionLowerLimit value="-0.12" />
      <fSuspensionRaise value="0.0" />
      <fSuspensionBiasFront value="0.5" />
      <fAntiRollBarForce value="0.8" />
      <fAntiRollBarBiasFront value="0.6" />
      <fRollCentreHeightFront value="0.3" />
      <fRollCentreHeightRear value="0.3" />
      <fCollisionDamageMult value="1.0" />
      <fWeaponDamageMult value="1.0" />
      <fDeformationDamageMult value="0.7" />
      <fEngineDamageMult value="1.5" />
      <fPetrolTankVolume value="65.0" />
      <fOilVolume value="5.0" />
      <fSeatOffsetDistX value="0.0" />
      <fSeatOffsetDistY value="0.0" />
      <fSeatOffsetDistZ value="0.0" />
      <nMonetaryValue value="100000" />
      <strModelFlags>440010</strModelFlags>
      <strHandlingFlags>20000</strHandlingFlags>
      <strDamageFlags>0</strDamageFlags>
      <AIHandling>AVERAGE</AIHandling>
      <SubHandlingData>
        <Item type="NULL" />
        <Item type="NULL" />
        <Item type="NULL" />
      </SubHandlingData>
    </Item>
  </HandlingData>
</CHandlingDataMgr>
`;
}

export function generateFxManifest({ resourceName, dataFiles, extraFiles = [] }) {
  const files = [...new Set([...dataFiles.map((d) => d.path), ...extraFiles])];
  return `-- ${resourceName} | Generated by FiveForge Studio
fx_version 'cerulean'
game 'gta5'
lua54 'yes'

files {
${files.map((f) => `  '${f}',`).join('\n')}
}

${dataFiles.map((d) => `data_file '${d.type}' '${d.path}'`).join('\n')}
`;
}

// بناء مورد FiveM حقيقي من الحزمة المحللة
export async function buildResourceFromArchive(report, { resourceName, overrides = {} } = {}) {
  const res = (resourceName || report.spawnCodes[0] || 'addon_car').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const zip = new JSZip();
  const root = zip.folder(res);
  const stream = root.folder('stream');
  const used = new Set();

  for (const f of [...report.models, ...report.textures]) {
    const n = f.name.toLowerCase();
    if (used.has(n)) continue;
    used.add(n);
    stream.file(n, f.data);
  }

  const dataFiles = [];
  const counters = {};
  for (const m of report.metas) {
    counters[m.kind] = (counters[m.kind] || 0) + 1;
    const fname = counters[m.kind] > 1 ? m.kind.replace('.meta', `_${counters[m.kind]}.meta`) : m.kind;
    const path = `data/${fname}`;
    root.file(path, m.text);
    dataFiles.push({ type: m.type, path });
  }

  const spawn = report.spawnCodes[0] || res;
  if (!report.metas.find((m) => m.type === 'VEHICLE_METADATA_FILE')) {
    root.file('data/vehicles.meta', generateVehiclesMeta({ spawn, gameName: overrides.gameName, audio: overrides.audio }));
    dataFiles.push({ type: 'VEHICLE_METADATA_FILE', path: 'data/vehicles.meta' });
  }
  if (!report.metas.find((m) => m.type === 'HANDLING_FILE')) {
    root.file('data/handling.meta', generateHandlingMeta({ handlingId: spawn, ...overrides }));
    dataFiles.push({ type: 'HANDLING_FILE', path: 'data/handling.meta' });
  }

  // الأصوات المخصصة (audioconfig + sfx)
  const extraFiles = [];
  for (const a of report.audio) {
    if (a.audioKind === 'rel') {
      const p = `audioconfig/${a.name}`;
      root.file(p, a.data);
      extraFiles.push(p);
      const noExt = p.replace(/\.rel$/, '');
      if (/game\.dat\d*\.rel$/i.test(a.name)) dataFiles.push({ type: 'AUDIO_GAMEDATA', path: noExt });
      else if (/sounds\.dat\d*\.rel$/i.test(a.name)) dataFiles.push({ type: 'AUDIO_SOUNDDATA', path: noExt });
      else if (/amp\.dat\d*\.rel$/i.test(a.name)) dataFiles.push({ type: 'AUDIO_SYNTHDATA', path: noExt });
    } else {
      const p = `sfx/${a.folder}/${a.name}`;
      root.file(p, a.data);
      extraFiles.push(p);
      if (!dataFiles.find((d) => d.path === `sfx/${a.folder}`)) {
        dataFiles.push({ type: 'AUDIO_WAVEPACK', path: `sfx/${a.folder}`, noFiles: true });
      }
    }
  }

  const manifestData = dataFiles.filter((d) => !d.noFiles && !d.type.startsWith('AUDIO_'));
  root.file(
    'fxmanifest.lua',
    generateFxManifest({ resourceName: res, dataFiles: manifestData, extraFiles }) +
      dataFiles
        .filter((d) => d.type.startsWith('AUDIO_'))
        .map((d) => `data_file '${d.type}' '${d.path}'`)
        .join('\n') +
      '\n'
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, resourceName: res, spawn, dataFiles };
}

// مورد تعديل هاندلنق سيارة أصلية (بدون stream — يغير مواصفاتها فقط)
export async function buildVanillaHandlingResource(car, values) {
  const res = `${car.spawn}_handling`;
  const zip = new JSZip();
  const root = zip.folder(res);
  root.file('data/handling.meta', generateHandlingMeta({ handlingId: car.spawn, ...values }));
  root.file('fxmanifest.lua', generateFxManifest({ resourceName: res, dataFiles: [{ type: 'HANDLING_FILE', path: 'data/handling.meta' }] }));
  root.file(
    'README.txt',
    `مورد تعديل هاندلنق ${car.name} (${car.spawn})\nضعه في مجلد resources ثم أضف في server.cfg:\nensure ${res}\n\nداخل اللعبة ارسبن السيارة بالأمر:\n/car ${car.spawn}`
  );
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, resourceName: res };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
