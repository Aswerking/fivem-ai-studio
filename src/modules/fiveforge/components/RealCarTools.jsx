import React, { useMemo, useState } from 'react';
import {
  Search, Download, Zap, UploadCloud, AlertCircle, CheckCircle2,
  FileCode, Car, RefreshCw, Layers, Eye, Copy, Check
} from 'lucide-react';
import { VANILLA_VEHICLES, VANILLA_CLASSES } from '../engine/vanillaVehicles.js';
import {
  analyzeCarArchive,
  buildResourceFromArchive,
  buildVanillaHandlingResource,
  downloadBlob
} from '../engine/realCarImporter.js';
import { resolveVehiclePresetType } from './models/RealisticGtaVehicle.jsx';

const ARCHETYPE_BADGES = {
  hypercar: 'Aventador V12 3D',
  supercar: 'Ferrari 458 3D',
  jdm: 'Tuner Coupe 3D',
  sports: 'BMW M4 G82 3D',
  muscle: 'Widebody Muscle 3D',
  sedan: 'Executive Sedan 3D',
  police: 'Police Interceptor 3D',
  suv: 'AMG G63 4x4 3D',
  armored: 'Armored Tactical 3D'
};

// =====================================================================
// كتالوج سيارات GTA V / FiveM الأصلية الموحد (14 مميزة + 680 سيارة أصلية)
// =====================================================================
export function VanillaCarCatalog({ selectedSpawn, onSelect, featuredCars = [] }) {
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('featured');
  const [limit, setLimit] = useState(48);
  const [edit, setEdit] = useState(null);
  const [copiedSpawn, setCopiedSpawn] = useState(false);

  const combinedVehicles = useMemo(() => {
    const featMap = new Map(featuredCars.map((c) => [c.spawn, { ...c, isFeatured: true }]));
    const merged = [...featuredCars.map((c) => ({ ...c, isFeatured: true }))];
    for (const v of VANILLA_VEHICLES) {
      if (!featMap.has(v.spawn)) {
        merged.push(v);
      }
    }
    return merged;
  }, [featuredCars]);

  const list = useMemo(() => {
    const query = q.toLowerCase().trim();
    return combinedVehicles.filter((c) => {
      if (query) {
        return (
          c.spawn.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query) ||
          (c.classAr && c.classAr.includes(query)) ||
          (c.badge && c.badge.includes(query))
        );
      }
      if (cls === 'featured') return !!c.isFeatured;
      if (cls === 'all') return true;
      return c.category === cls;
    });
  }, [combinedVehicles, q, cls]);

  const selected = useMemo(
    () => combinedVehicles.find((c) => c.spawn === selectedSpawn) || featuredCars[0],
    [combinedVehicles, selectedSpawn, featuredCars]
  );

  const exportHandling = async () => {
    if (!edit) return;
    const { blob, resourceName } = await buildVanillaHandlingResource(edit.car, edit);
    downloadBlob(blob, `${resourceName}.zip`);
  };

  const handleCopySpawn = (spawnCode) => {
    navigator.clipboard?.writeText(spawnCode);
    setCopiedSpawn(true);
    setTimeout(() => setCopiedSpawn(false), 1500);
  };

  return (
    <div className="space-y-2.5">
      {/* Header Banner */}
      <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-2 text-[10px] text-neutral-400">
        <div>
          <b className="text-white text-[11px] block">
            مكتبة سيارات قراند وفايف إم الرسمية ({VANILLA_VEHICLES.length} سيارة كاملة)
          </b>
          <span>اختر أي سيارة لمعاينتها فوراً بمجسم 3D حقيقي، نسخ كود الرسبنة، أو تعديل وتصدير الهاندلنق والميتا.</span>
        </div>
        <span className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold shrink-0">
          6 مجسمات GLB حقيقية
        </span>
      </div>

      {/* Instant Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-3 top-2.5" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(48);
          }}
          placeholder="ابحث بالاسم أو كود الرسبنة (مثل: zentorno, police3, sultanrs, g63, adder)..."
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pr-9 pl-8 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="absolute left-2.5 top-2.5 text-neutral-500 hover:text-white text-xs cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Category Filter Bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-[10px] no-scrollbar">
        {[
          { id: 'featured', labelAr: '⭐ مميزة 3D', count: featuredCars.length || 14 },
          { id: 'all', labelAr: 'الكل', count: combinedVehicles.length },
          ...VANILLA_CLASSES
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCls(c.id);
              setQ('');
              setLimit(48);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold shrink-0 border transition cursor-pointer ${
              cls === c.id && !q
                ? 'bg-amber-500 text-black border-amber-500 shadow-sm'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
            }`}
          >
            {c.labelAr} ({c.count})
          </button>
        ))}
      </div>

      {/* Scrollable Vehicle Cards Grid */}
      <div className="max-h-[250px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-0.5 custom-scrollbar">
        {list.slice(0, limit).map((car) => {
          const isSelected = selectedSpawn === car.spawn;
          const archType = resolveVehiclePresetType(car.spawn, car.category);
          const archBadge = ARCHETYPE_BADGES[archType] || 'Sports 3D';
          return (
            <button
              key={car.spawn}
              type="button"
              onClick={() => {
                onSelect(car);
                setEdit(null);
              }}
              className={`p-2 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between gap-1 ${
                isSelected
                  ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/40'
                  : 'bg-neutral-900/85 border-neutral-800 hover:border-neutral-600'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                    style={{ backgroundColor: car.color }}
                  />
                  <span className="text-[11px] font-bold text-white truncate">{car.name}</span>
                </div>
                {isSelected && (
                  <span className="text-[8px] bg-amber-500 text-black px-1.5 py-0.2 rounded font-black shrink-0">
                    نشطة 3D
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono w-full pt-0.5">
                <span className="text-amber-400">
                  {car.spawn} <span className="text-neutral-500">· {car.classAr || car.category}</span>
                </span>
                <span className="text-[8px] bg-black/50 text-neutral-300 px-1.5 py-0.2 rounded border border-neutral-800">
                  {car.badge || archBadge}
                </span>
              </div>
            </button>
          );
        })}

        {list.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + 60)}
            className="col-span-full py-1.5 text-[10px] font-bold text-amber-300 bg-neutral-900 hover:bg-neutral-800 rounded-xl border border-neutral-800 cursor-pointer"
          >
            عرض المزيد ({list.length - limit} سيارة متبقية)
          </button>
        )}

        {!list.length && (
          <div className="col-span-full text-center text-xs text-neutral-500 py-5 bg-neutral-900/40 rounded-xl border border-neutral-800">
            لا توجد سيارة تطابق البحث الحالي
          </div>
        )}
      </div>

      {/* Selected Vehicle Quick Actions & Handling Tuner */}
      {selected && (
        <div className="p-2.5 rounded-xl bg-neutral-900/95 border border-amber-500/30 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                style={{ backgroundColor: selected.color }}
              />
              <div className="text-[11px] text-white font-bold truncate">{selected.name}</div>
            </div>
            <button
              type="button"
              onClick={() => handleCopySpawn(selected.spawn)}
              className="text-[10px] font-mono bg-black/60 hover:bg-black text-amber-300 px-2 py-0.5 rounded border border-neutral-700 flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {copiedSpawn ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSpawn ? 'تم النسخ!' : `نسخ: ${selected.spawn}`}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono bg-black/30 px-2 py-1 rounded-lg">
            <span>
              أمر الرسبنة: <b className="text-emerald-400">/car {selected.spawn}</b>
            </span>
            <span>
              ⚡ {selected.speed} كم/س · {selected.drivetrain} · {selected.mass} كغ
            </span>
          </div>

          {!edit ? (
            <button
              type="button"
              onClick={() =>
                setEdit({
                  car: selected,
                  speed: selected.speed,
                  mass: selected.mass,
                  drivetrain: selected.drivetrain,
                  accel: selected.accel,
                  brake: selected.brake
                })
              }
              className="w-full py-1.5 text-[11px] font-bold rounded-lg bg-neutral-800 text-amber-300 hover:bg-amber-500 hover:text-black transition cursor-pointer"
            >
              ⚙️ فتح محرر هاندلنق {selected.spawn} وتصدير حزمة مستقلة
            </button>
          ) : (
            <div className="space-y-1.5 text-[10px] pt-1 border-t border-neutral-800">
              {[
                ['speed', 'السرعة القصوى (كم/س)', 80, 450, 5],
                ['mass', 'الوزن (كغ)', 500, 8000, 50],
                ['accel', 'قوة التسارع (fInitialDriveForce)', 0.5, 3.0, 0.05],
                ['brake', 'قوة الفرامل (fBrakeForce)', 0.4, 2.5, 0.05]
              ].map(([k, l, mn, mx, st]) => (
                <label key={k} className="block">
                  <div className="flex justify-between text-neutral-400">
                    <span>{l}</span>
                    <b className="text-amber-300 font-mono">{edit[k]}</b>
                  </div>
                  <input
                    type="range"
                    min={mn}
                    max={mx}
                    step={st}
                    value={edit[k]}
                    onChange={(e) => setEdit({ ...edit, [k]: +e.target.value })}
                    className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </label>
              ))}
              <div className="flex gap-1">
                {['RWD', 'AWD', 'FWD'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setEdit({ ...edit, drivetrain: d })}
                    className={`flex-1 py-1 rounded font-bold cursor-pointer ${
                      edit.drivetrain === d ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={exportHandling}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> تحميل مورد {selected.spawn}_handling.zip
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// مستورد GTA5-Mods و OpenIV / Sollumz الحقيقي (.ZIP / .YFT / .YTD / .GLB / .OBJ)
// =====================================================================
export function RealGta5ModsImporter({
  urlHint,
  onDetected,
  onCustomModelLoaded,
  onApplyLivery
}) {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resName, setResName] = useState('');
  const [audio, setAudio] = useState('');
  const [done, setDone] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setDone(null);
    const r = await analyzeCarArchive(file);
    setReport(r);

    const spawn = r.spawnCodes[0];
    setResName(spawn || file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_]/g, '_'));

    // If archive or upload contains a 3D mesh (.yft/.glb/.gltf/.obj), load it into the 3D viewport!
    if (r.meshes3d?.length > 0 && onCustomModelLoaded) {
      onCustomModelLoaded(r.meshes3d[0].blobUrl, r.meshes3d[0].ext, r.meshes3d[0].ytdBlobUrl || null);
    }

    // If archive has extracted YTD textures and user hasn't set livery, allow 1-click preview
    if (spawn && onDetected) {
      onDetected(spawn, r.vehicleNames[spawn]);
    }
    setBusy(false);
  };

  const build = async () => {
    setBusy(true);
    const out = await buildResourceFromArchive(report, {
      resourceName: resName,
      overrides: audio ? { audio } : {}
    });
    downloadBlob(out.blob, `${out.resourceName}.zip`);
    setDone(out);
    setBusy(false);
  };

  const fmt = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + 'MB' : (b / 1024).toFixed(0) + 'KB');

  return (
    <div className="space-y-2.5">
      {urlHint && (
        <a
          href={urlHint}
          target="_blank"
          rel="noreferrer"
          className="block p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-[10px] text-sky-300 truncate hover:border-sky-500/40"
        >
          ① رابط السيارة المحدد: {urlHint}
        </a>
      )}

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className="border-2 border-dashed border-neutral-800 hover:border-amber-500/60 rounded-2xl p-4 flex flex-col items-center gap-1.5 cursor-pointer bg-neutral-900/40 hover:bg-neutral-900/70 transition text-center"
      >
        {busy ? (
          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
        ) : (
          <UploadCloud className="w-6 h-6 text-amber-400" />
        )}
        <span className="text-xs font-bold text-neutral-200">
          {report ? `تم فحص: ${report.fileName}` : 'اسحب ملف السيارة (.ZIP من gta5-mods أو .YFT / .YTD / .GLB / .OBJ)'}
        </span>
        <span className="text-[9px] text-neutral-500 font-mono">
          يدعم فك ضغط حزم السيارات وفحص عظام وشيدرات RSC7 YFT وتكستشرات YTD مباشرة في المتصفح
        </span>
        <input
          type="file"
          accept=".zip,.yft,.ytd,.glb,.gltf,.obj,.rar,.7z,.rpf,.oiv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>

      {report && (
        <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2 text-[10px]">
          {/* Asset Counters */}
          <div className="grid grid-cols-4 gap-1 text-center">
            {[
              ['YFT / 3D', report.models.length + (report.meshes3d?.length || 0)],
              ['YTD تكستشر', report.textures.length],
              ['ملفات Meta', report.metas.length],
              ['صوت AWC/REL', report.audio.length]
            ].map(([l, n]) => (
              <div key={l} className="bg-black/40 rounded-lg py-1 border border-neutral-800/80">
                <b className="text-amber-400 text-xs block font-mono">{n}</b>
                <span className="text-neutral-400 text-[9px]">{l}</span>
              </div>
            ))}
          </div>

          {/* Detected Spawn Codes */}
          {report.spawnCodes.length > 0 && (
            <div className="text-neutral-300 flex items-center gap-1 flex-wrap">
              <span>أكواد الرسبنة المكتشفة:</span>
              {report.spawnCodes.map((s) => (
                <b key={s} className="font-mono text-amber-300 bg-black/50 px-1.5 py-0.5 rounded border border-amber-500/30">
                  {s}
                </b>
              ))}
            </div>
          )}

          {/* OpenIV / Sollumz RSC7 YFT Bone & Shader Inspector */}
          {report.yftInspections?.length > 0 && (
            <div className="p-2 rounded-lg bg-black/40 border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-amber-300">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  <span>فاحص هيكل الموديل (Sollumz / OpenIV YFT Inspector):</span>
                </span>
                <span className="text-[9px] font-mono text-emerald-400">{report.yftInspections[0].format}</span>
              </div>
              <div className="text-[9px] text-neutral-400 font-mono">
                العظام المكتشفة ({report.yftInspections[0].bones.length}):{' '}
                <span className="text-neutral-200">{report.yftInspections[0].bones.slice(0, 10).join(', ')}</span>
              </div>
              <div className="text-[9px] text-neutral-400 font-mono">
                الشيدرات ({report.yftInspections[0].shaders.length}):{' '}
                <span className="text-sky-300">{report.yftInspections[0].shaders.slice(0, 6).join(', ')}</span>
              </div>
            </div>
          )}

          {/* Extracted YTD Texture Previews */}
          {report.extractedTextures?.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-neutral-300">تكستشرات مستخرجة من .YTD (اضغط لتطبيقها على السيارة 3D):</div>
              <div className="grid grid-cols-3 gap-1.5">
                {report.extractedTextures.map((tex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onApplyLivery && onApplyLivery(tex.dataUrl)}
                    className="p-1 rounded-lg bg-black/50 border border-neutral-800 hover:border-amber-500 transition flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <img src={tex.dataUrl} alt={tex.name} className="w-full h-12 object-cover rounded" />
                    <span className="text-[8px] font-mono text-neutral-300 truncate w-full">{tex.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* File Stream Tree */}
          {(report.models.length > 0 || report.textures.length > 0 || report.metas.length > 0) && (
            <div className="max-h-24 overflow-y-auto font-mono text-[9px] text-neutral-400 bg-black/30 rounded-lg p-1.5 custom-scrollbar">
              {[...report.models, ...report.textures].map((f) => (
                <div key={f.path}>
                  stream/{f.name.toLowerCase()} <span className="text-neutral-600">({fmt(f.size)})</span>
                </div>
              ))}
              {report.metas.map((m) => (
                <div key={m.path} className="text-emerald-400">
                  data/{m.kind} ← {m.name}
                </div>
              ))}
            </div>
          )}

          {report.errors.map((e, i) => (
            <div key={i} className="flex gap-1 text-rose-400">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              {e}
            </div>
          ))}
          {report.warnings.map((w, i) => (
            <div key={i} className="flex gap-1 text-amber-300">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}

          {!report.errors.length && (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="text-neutral-400">
                  اسم المورد (Resource Name)
                  <input
                    value={resName}
                    onChange={(e) => setResName(e.target.value)}
                    className="w-full mt-0.5 bg-black/40 border border-neutral-800 rounded px-2 py-1 font-mono text-white"
                  />
                </label>
                <label className="text-neutral-400">
                  صوت المحرك (Audio Hash)
                  <input
                    value={audio}
                    onChange={(e) => setAudio(e.target.value)}
                    placeholder="sultanrs"
                    className="w-full mt-0.5 bg-black/40 border border-neutral-800 rounded px-2 py-1 font-mono text-white"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={build}
                disabled={busy}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" /> بناء وتحميل مورد FiveM جاهز ({resName || 'addon'}.zip)
              </button>
            </>
          )}

          {done && (
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-0.5">
              <div className="flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> تم إنشاء وتحميل {done.resourceName}.zip بنجاح
              </div>
              <div className="font-mono">server.cfg ← ensure {done.resourceName}</div>
              <div className="font-mono">داخل اللعبة ← /car {done.spawn}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
