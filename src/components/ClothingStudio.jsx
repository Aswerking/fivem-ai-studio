import React, { useState, useRef, useEffect } from 'react';
import { 
  Scissors, 
  Play, 
  Pause, 
  RotateCcw, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Eye, 
  EyeOff,
  User,
  Layers,
  Sparkle,
  Shirt
} from 'lucide-react';

// لوحة الأقمشة المعتمدة مع خصائصها الفيزيائية
export const FABRIC_TYPES = [
  { id: 'cotton', name: 'Cotton', nameAr: 'قطن', roughness: 0.82, desc: 'نسيج قطني ناعم ومريح' },
  { id: 'denim', name: 'Denim', nameAr: 'جينز', roughness: 0.74, desc: 'قماش دنيم متين بتطريز مائل' },
  { id: 'silk', name: 'Silk', nameAr: 'حرير', roughness: 0.22, desc: 'حرير انسيابي لامع عالي البريق' },
  { id: 'leather', name: 'Leather', nameAr: 'جلد', roughness: 0.35, desc: 'جلد طبيعي حبيبي بمظهر فاخر' },
  { id: 'knit', name: 'Knit', nameAr: 'تريكو / صوف', roughness: 0.90, desc: 'نسيج محبوك دافئ بخطوط طولية' }
];

// لوحة الألوان المعتمدة المطابقة للصور المرفقة
export const COLOR_SWATCHES = [
  { hex: '#f2ede4', name: 'أبيض عاجي' },
  { hex: '#232326', name: 'أسود فحمي' },
  { hex: '#4a688b', name: 'أزرق كحلي' },
  { hex: '#e09575', name: 'مرجاني / مشمشي' },
  { hex: '#7c343a', name: 'عنابي دافئ' },
  { hex: '#546e50', name: 'زيتي عسكري' },
  { hex: '#734c38', name: 'بني جملي' },
  { hex: '#ecc94b', name: 'أصفر الاستوديو' }
];

// قوالب الأجسام الجاهزة لتجربة مقاسات كل الأجسام فوراً
export const BODY_PRESETS = [
  { id: 'average', name: 'عادي', icon: '🧍‍♂️', morphs: { bellyFat: 1.0, chest: 1.0, armMuscles: 1.0, shoulders: 1.0 } },
  { id: 'muscular', name: 'معضل', icon: '🏋️‍♂️', morphs: { bellyFat: 0.95, chest: 1.65, armMuscles: 1.55, shoulders: 1.30 } },
  { id: 'heavy', name: 'سمين / كرش', icon: '🍔', morphs: { bellyFat: 1.85, chest: 1.35, armMuscles: 1.15, shoulders: 1.15 } },
  { id: 'slim', name: 'نحيف', icon: '🏃‍♂️', morphs: { bellyFat: 0.70, chest: 0.85, armMuscles: 0.80, shoulders: 0.90 } },
  { id: 'giant', name: 'ضخم عريض', icon: '🦍', morphs: { bellyFat: 1.40, chest: 1.80, armMuscles: 1.70, shoulders: 1.50 } }
];

// عنصر الدائرة البرتقالية التفاعلية لسحب الباترون مع هالة متحركة وتلميح فوري باسم النقطة
function PatternHandle({ id, cx, cy, label, value, unit = 'cm', isDragging, onPointerDown }) {
  const [hovered, setHovered] = useState(false);
  const showTooltip = isDragging || hovered;
  const valStr = value !== undefined ? ` (${value > 0 ? '+' : ''}${value}${unit})` : '';
  const tooltipText = `${label}${valStr}`;
  const tooltipW = Math.max(54, tooltipText.length * 6.5 + 14);
  const tooltipX = Math.max(4, Math.min(320 - tooltipW - 4, cx - tooltipW / 2));
  const tooltipY = cy < 32 ? cy + 10 : cy - 20;

  return (
    <g
      className="cursor-grab active:cursor-grabbing"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={(e) => onPointerDown(id, e)}
    >
      {/* هالة تفاعلية نابضة عند السحب */}
      {isDragging && (
        <circle cx={cx} cy={cy} r="8.5" fill="#f97316" fillOpacity="0.45" className="animate-ping" />
      )}
      {/* مساحة لمس موسعة لسهولة النقر والسحب */}
      <circle cx={cx} cy={cy} r="10" fill="transparent" />
      {/* الدائرة البرتقالية الرئيسية */}
      <circle
        cx={cx}
        cy={cy}
        r={isDragging ? 5.4 : 4.4}
        fill={isDragging ? "#ea580c" : "#f97316"}
        stroke="#ffffff"
        strokeWidth="1.4"
        className="transition-transform duration-100 hover:scale-125 drop-shadow-md"
      />
      {/* التلميح التوضيحي بالاسم العربي والقيمة */}
      {showTooltip && (
        <g className="pointer-events-none z-50">
          <rect
            x={tooltipX}
            y={tooltipY}
            width={tooltipW}
            height="17"
            rx="4"
            fill="#18181b"
            stroke="#f97316"
            strokeWidth="0.9"
            opacity="0.96"
          />
          <text
            x={tooltipX + tooltipW / 2}
            y={tooltipY + 12}
            fill="#fef08a"
            fontSize="8.5"
            fontWeight="bold"
            textAnchor="middle"
          >
            {tooltipText}
          </text>
        </g>
      )}
    </g>
  );
}

export default function ClothingStudio({
  pattern,
  onChangePattern,
  morphs,
  onChangeMorphs,
  onTriggerDrape,
  onReset
}) {
  const [activePreset, setActivePreset] = useState('average');
  const [showNextAccordion, setShowNextAccordion] = useState(false);
  const [showCornerSliders, setShowCornerSliders] = useState(true);
  const [draggingHandle, setDraggingHandle] = useState(null);
  const svgRef = useRef(null);

  // تحديث القيم السريعة للسلايدرات
  const handleSlider = (key, value) => {
    onChangePattern(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // تفاعل السحب لقطع الباترون المسطحة 2D (Pattern Pieces)
  const handlePointerDown = (handleId, e) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingHandle(handleId);
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!draggingHandle || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 320;
      const y = ((e.clientY - rect.top) / rect.height) * 290;

      onChangePattern(prev => {
        let updated = { ...prev };
        const curHemBaseY = 85 + ((prev.length ?? 78) - 30) * 0.35;

        // 1. يمين تحت (الزاوية السفلية اليمنى للقطعة الأمامية)
        if (draggingHandle === 'front_hem_right') {
          const offset = Math.max(-25, Math.min(45, Math.round((y - curHemBaseY) * 1.5)));
          updated.hemFrontR = offset;
        }
        // 2. يسار تحت (الزاوية السفلية اليسرى للقطعة الأمامية)
        else if (draggingHandle === 'front_hem_left') {
          const offset = Math.max(-25, Math.min(45, Math.round((y - curHemBaseY) * 1.5)));
          updated.hemFrontL = offset;
        }
        // 3. ورا تحت يمين (الزاوية السفلية اليمنى للظهر)
        else if (draggingHandle === 'back_hem_right') {
          const offset = Math.max(-25, Math.min(45, Math.round((y - curHemBaseY) * 1.5)));
          updated.hemBackR = offset;
        }
        // 4. ورا تحت يسار (الزاوية السفلية اليسرى للظهر)
        else if (draggingHandle === 'back_hem_left') {
          const offset = Math.max(-25, Math.min(45, Math.round((y - curHemBaseY) * 1.5)));
          updated.hemBackL = offset;
        }
        // 5. يمين فوق (الكتف الأيمن للقطعة الأمامية)
        else if (draggingHandle === 'front_shoulder_right') {
          const offset = Math.max(-10, Math.min(25, Math.round((24 - y) * 1.4)));
          updated.shoulderR = offset;
        }
        // 6. فوق يسار (الكتف الأيسر للقطعة الأمامية)
        else if (draggingHandle === 'front_shoulder_left') {
          const offset = Math.max(-10, Math.min(25, Math.round((24 - y) * 1.4)));
          updated.shoulderL = offset;
        }
        // 7. ورا يمين فوق (الكتف الأيمن للظهر)
        else if (draggingHandle === 'back_shoulder_right') {
          const offset = Math.max(-10, Math.min(25, Math.round((24 - y) * 1.4)));
          updated.backShoulderR = offset;
        }
        // 8. ورا يسار فوق (الكتف الأيسر للظهر)
        else if (draggingHandle === 'back_shoulder_left') {
          const offset = Math.max(-10, Math.min(25, Math.round((24 - y) * 1.4)));
          updated.backShoulderL = offset;
        }
        // 9. طول الكم الأيسر (Left Sleeve Length حتى المعصم 85 سم)
        else if (draggingHandle === 'left_sleeve_len') {
          const len = Math.max(5, Math.min(85, Math.round(5 + (y - 152) / 1.15)));
          updated.sleeveLengthL = len;
        }
        // 10. طول الكم الأيمن (Right Sleeve Length حتى المعصم 85 سم)
        else if (draggingHandle === 'right_sleeve_len') {
          const len = Math.max(5, Math.min(85, Math.round(5 + (y - 152) / 1.15)));
          updated.sleeveLengthR = len;
        }
        // 11. فتحة الرقبة
        else if (draggingHandle === 'front_neck') {
          const neckDepth = Math.max(10, Math.min(45, Math.round(15 + (y - 20) * 0.7)));
          updated.neckline = neckDepth;
        }
        // 12. طول التيشيرت كاملاً
        else if (draggingHandle === 'front_hem_center' || draggingHandle === 'back_hem_center') {
          const len = Math.max(30, Math.min(115, Math.round(30 + (y - 45) * 1.05)));
          updated.length = len;
        }
        // 13. يسار وسط
        else if (draggingHandle === 'front_waist_left') {
          const w = Math.max(-15, Math.min(30, Math.round((52 - x) * 1.2)));
          updated.waistL = w;
        }
        // 14. يمين وسط
        else if (draggingHandle === 'front_waist_right') {
          const w = Math.max(-15, Math.min(30, Math.round((x - 92) * 1.2)));
          updated.waistR = w;
        }
        // 15. اتساع الكم الأيسر أو الأيمن
        else if (draggingHandle === 'left_sleeve_width' || draggingHandle === 'right_sleeve_width') {
          const centerX = draggingHandle === 'left_sleeve_width' ? 72 : 228;
          const sWid = Math.max(20, Math.min(65, Math.round(20 + Math.abs(x - centerX) * 0.9)));
          updated.sleeveWidth = sWid;
        }

        return updated;
      });
    };

    const handlePointerUp = () => {
      if (draggingHandle) {
        setDraggingHandle(null);
        // عند إفلات النقطة، يتم إعادة الحياكة والانسدال فوراً (Sew and drape)
        if (onTriggerDrape) onTriggerDrape();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingHandle, onChangePattern, onTriggerDrape]);

  // تطبيق بريزيت الجسم للتأكد من التناسق مع كل الأجسام
  const applyBodyPreset = (preset) => {
    setActivePreset(preset.id);
    if (onChangeMorphs) {
      onChangeMorphs(prev => ({
        ...prev,
        ...preset.morphs
      }));
    }
  };

  // إحداثيات الباترون المسطح المحسوبة ديناميكياً مع السلايدرات ونقاط السحب
  const frontWaistW = 38 + (pattern.width - 35) * 0.28;
  const hemBaseY = 85 + (pattern.length - 30) * 0.35;
  const hemFL = hemBaseY + (pattern.hemFrontL || 0) * 0.8 + (pattern.hemLeftOffset || 0) * 0.8;
  const hemFR = hemBaseY + (pattern.hemFrontR || 0) * 0.8 + (pattern.hemRightOffset || 0) * 0.8;
  const hemBL = hemBaseY + (pattern.hemBackL || 0) * 0.8;
  const hemBR = hemBaseY + (pattern.hemBackR || 0) * 0.8;
  const frontNeckY = 22 + (pattern.neckline - 10) * 0.55;

  // إحداثيات الأكتاف
  const shLX = 72 - frontWaistW * 0.70 - (pattern.shoulderL || 0) * 0.5;
  const shLY = 24 - (pattern.shoulderL || 0) * 0.5;
  const shRX = 72 + frontWaistW * 0.70 + (pattern.shoulderR || 0) * 0.5;
  const shRY = 24 - (pattern.shoulderR || 0) * 0.5;

  const bShLX = 228 - frontWaistW * 0.70 - (pattern.backShoulderL || 0) * 0.5;
  const bShLY = 24 - (pattern.backShoulderL || 0) * 0.5;
  const bShRX = 228 + frontWaistW * 0.70 + (pattern.backShoulderR || 0) * 0.5;
  const bShRY = 24 - (pattern.backShoulderR || 0) * 0.5;

  // إحداثيات الأكمام المستقلة
  const sleeveLenL = pattern.sleeveLengthL ?? pattern.sleeveLength ?? 28;
  const sleeveLenR = pattern.sleeveLengthR ?? pattern.sleeveLength ?? 28;
  const cuffYL = 152 + (sleeveLenL - 5) * 1.15;
  const cuffYR = 152 + (sleeveLenR - 5) * 1.15;
  const sleeveWL = 26 + (pattern.sleeveWidth - 20) * 0.32;
  const sleeveWR = 26 + (pattern.sleeveWidth - 20) * 0.32;

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-200 select-none overflow-y-auto">
      {/* 1. الترويسة العلوية الأنيقة (Clothing Studio Header) */}
      <div className="p-3.5 border-b border-neutral-800/80 bg-neutral-900/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl shadow-md shadow-amber-600/20 text-white">
            <Shirt className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm tracking-wide text-neutral-100 flex items-center gap-1.5">
                Clothing Studio
                <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono uppercase font-semibold">
                  Admin Preview
                </span>
              </h2>
            </div>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Settled. Pull the cloth or change the cut.
            </p>
          </div>
        </div>

        {/* أزرار التحكم والانسدال السريع */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSlider('isPaused', !pattern.isPaused)}
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs flex items-center gap-1.5 transition"
            title="إيقاف / استئناف محاكاة القماش"
          >
            {pattern.isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
            <span className="text-[11px] font-medium">{pattern.isPaused ? "Drape" : "Pause"}</span>
          </button>

          <button
            onClick={onTriggerDrape}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-orange-600/30 transition cursor-pointer"
            title="إعادة خياطة وانسدال القماش على الجسم"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Sew and drape</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* 2. قسم الباترون المسطح مع نقاط السحب التفاعلية (Pattern Pieces) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
              <span>Pattern</span>
              <span className="text-[10px] font-normal text-neutral-400 lowercase">(قطع الباترون)</span>
            </h3>
            <button
              onClick={onReset}
              className="text-[10px] text-neutral-400 hover:text-amber-400 flex items-center gap-1 transition"
              title="إعادة ضبط قطع الباترون للوضع الافتراضي"
            >
              <RotateCcw className="w-3 h-3" />
              <span>إعادة ضبط</span>
            </button>
          </div>

          <p className="text-[11px] text-neutral-400 leading-relaxed">
            These are the flat pieces of the shirt, as a tailor cuts them. Drag the orange dots to change the cut, then the shirt is sewn again on the ped.
          </p>

          {/* لوح قص الباترون التفاعلي SVG */}
          <div className="relative rounded-2xl border border-neutral-800 bg-neutral-900/90 overflow-hidden shadow-inner p-2">
            {/* خلفية شبكية كألواح القص والتفصيل الاحترافية */}
            <div 
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle, #a3a3a3 1px, transparent 1px)`,
                backgroundSize: '14px 14px'
              }}
            />

            <svg
              ref={svgRef}
              viewBox="0 0 320 290"
              className="w-full h-auto cursor-crosshair relative z-10"
              style={{ touchAction: 'none' }}
            >
              <defs>
                {/* نمط قماش الباترون الداخلي */}
                <pattern id="clothHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#f59e0b" strokeWidth="0.5" strokeOpacity="0.25" />
                </pattern>
              </defs>

              {/* -------------------- 1. القطعة الأمامية (Front Piece) -------------------- */}
              <g className="transition-all duration-75">
                {/* مسار حدود القطعة الأمامية مع درزات الخياطة وزوايا التحكم الديناميكية */}
                <path
                  d={`
                    M ${72 - frontWaistW * 0.55 - (pattern.waistL || 0) * 0.4} ${hemFL}
                    L ${72 - frontWaistW * 0.50 - (pattern.waistL || 0) * 0.4} 62
                    L ${72 - frontWaistW * 0.45 - (pattern.waistL || 0) * 0.25} 44
                    Q ${72 - frontWaistW * 0.45} 34 ${shLX} ${shLY}
                    L 54 14
                    Q 72 ${frontNeckY} 90 14
                    L ${shRX} ${shRY}
                    Q ${72 + frontWaistW * 0.45} 34 ${72 + frontWaistW * 0.45 + (pattern.waistR || 0) * 0.25} 44
                    L ${72 + frontWaistW * 0.50 + (pattern.waistR || 0) * 0.4} 62
                    L ${72 + frontWaistW * 0.55 + (pattern.waistR || 0) * 0.4} ${hemFR}
                    Q 72 ${(hemFL + hemFR) * 0.5} ${72 - frontWaistW * 0.55 - (pattern.waistL || 0) * 0.4} ${hemFL}
                    Z
                  `}
                  fill="url(#clothHatch)"
                  stroke="#38bdf8"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />

                {/* تلوين الدرزات المحددة للقطع (كتف وردي، رقبة سماوي، أكمام أخضر، جوانب برتقالي) */}
                <path d={`M 54 14 Q 72 ${frontNeckY} 90 14`} stroke="#38bdf8" strokeWidth="2.4" fill="none" />
                <line x1="54" y1="14" x2={shLX} y2={shLY} stroke="#f472b6" strokeWidth="2.2" />
                <line x1="90" y1="14" x2={shRX} y2={shRY} stroke="#f472b6" strokeWidth="2.2" />
                <path d={`M ${shLX} ${shLY} Q ${72 - frontWaistW * 0.45} 34 ${72 - frontWaistW * 0.45 - (pattern.waistL || 0) * 0.25} 44`} stroke="#34d399" strokeWidth="2.2" fill="none" />
                <path d={`M ${shRX} ${shRY} Q ${72 + frontWaistW * 0.45} 34 ${72 + frontWaistW * 0.45 + (pattern.waistR || 0) * 0.25} 44`} stroke="#34d399" strokeWidth="2.2" fill="none" />
                <line x1={72 - frontWaistW * 0.45 - (pattern.waistL || 0) * 0.25} y1="44" x2={72 - frontWaistW * 0.55 - (pattern.waistL || 0) * 0.4} y2={hemFL} stroke="#fb923c" strokeWidth="2.2" />
                <line x1={72 + frontWaistW * 0.45 + (pattern.waistR || 0) * 0.25} y1="44" x2={72 + frontWaistW * 0.55 + (pattern.waistR || 0) * 0.4} y2={hemFR} stroke="#fb923c" strokeWidth="2.2" />

                <text x="72" y="52" fill="#e5e5e5" fontSize="10" fontWeight="bold" textAnchor="middle" opacity="0.85">Front (أمام)</text>

                {/* دوائر السحب التفاعلية البرتقالية المحددة والمستقلة لكل زاوية */}
                {/* 1. فوق يسار (Front Shoulder Left) */}
                <PatternHandle
                  id="front_shoulder_left"
                  cx={shLX}
                  cy={shLY}
                  label="فوق يسار"
                  value={pattern.shoulderL || 0}
                  isDragging={draggingHandle === 'front_shoulder_left'}
                  onPointerDown={handlePointerDown}
                />

                {/* 2. يمين فوق (Front Shoulder Right) */}
                <PatternHandle
                  id="front_shoulder_right"
                  cx={shRX}
                  cy={shRY}
                  label="يمين فوق"
                  value={pattern.shoulderR || 0}
                  isDragging={draggingHandle === 'front_shoulder_right'}
                  onPointerDown={handlePointerDown}
                />

                {/* 3. فتحة الرقبة (Neckline) */}
                <PatternHandle
                  id="front_neck"
                  cx={72}
                  cy={frontNeckY}
                  label="فتحة الرقبة"
                  value={pattern.neckline}
                  isDragging={draggingHandle === 'front_neck'}
                  onPointerDown={handlePointerDown}
                />

                {/* 4. يسار وسط (Front Waist Left) */}
                <PatternHandle
                  id="front_waist_left"
                  cx={72 - frontWaistW * 0.50 - (pattern.waistL || 0) * 0.4}
                  cy={62}
                  label="يسار وسط"
                  value={pattern.waistL || 0}
                  isDragging={draggingHandle === 'front_waist_left'}
                  onPointerDown={handlePointerDown}
                />

                {/* 5. يمين وسط (Front Waist Right) */}
                <PatternHandle
                  id="front_waist_right"
                  cx={72 + frontWaistW * 0.50 + (pattern.waistR || 0) * 0.4}
                  cy={62}
                  label="يمين وسط"
                  value={pattern.waistR || 0}
                  isDragging={draggingHandle === 'front_waist_right'}
                  onPointerDown={handlePointerDown}
                />

                {/* 6. يسار تحت (Front Bottom Left Corner) */}
                <PatternHandle
                  id="front_hem_left"
                  cx={72 - frontWaistW * 0.55 - (pattern.waistL || 0) * 0.4}
                  cy={hemFL}
                  label="يسار تحت"
                  value={pattern.hemFrontL || 0}
                  isDragging={draggingHandle === 'front_hem_left'}
                  onPointerDown={handlePointerDown}
                />

                {/* 7. يمين تحت (Front Bottom Right Corner) */}
                <PatternHandle
                  id="front_hem_right"
                  cx={72 + frontWaistW * 0.55 + (pattern.waistR || 0) * 0.4}
                  cy={hemFR}
                  label="يمين تحت"
                  value={pattern.hemFrontR || 0}
                  isDragging={draggingHandle === 'front_hem_right'}
                  onPointerDown={handlePointerDown}
                />

                {/* 8. طول التيشيرت كاملاً (Front Hem Center) */}
                <PatternHandle
                  id="front_hem_center"
                  cx={72}
                  cy={(hemFL + hemFR) * 0.5}
                  label="طول التيشيرت"
                  value={pattern.length}
                  isDragging={draggingHandle === 'front_hem_center'}
                  onPointerDown={handlePointerDown}
                />
              </g>

              {/* -------------------- 2. القطعة الخلفية (Back Piece) -------------------- */}
              <g className="transition-all duration-75">
                {/* مسار حدود الظهر مع الزوايا المستقلة */}
                <path
                  d={`
                    M ${228 - frontWaistW * 0.55 - (pattern.waistL || 0) * 0.4} ${hemBL}
                    L ${228 - frontWaistW * 0.50 - (pattern.waistL || 0) * 0.4} 62
                    L ${228 - frontWaistW * 0.45 - (pattern.waistL || 0) * 0.25} 44
                    Q ${228 - frontWaistW * 0.45} 34 ${bShLX} ${bShLY}
                    L 210 14
                    Q 228 18 246 14
                    L ${bShRX} ${bShRY}
                    Q ${228 + frontWaistW * 0.45} 34 ${228 + frontWaistW * 0.45 + (pattern.waistR || 0) * 0.25} 44
                    L ${228 + frontWaistW * 0.50 + (pattern.waistR || 0) * 0.4} 62
                    L ${228 + frontWaistW * 0.55 + (pattern.waistR || 0) * 0.4} ${hemBR}
                    Q 228 ${(hemBL + hemBR) * 0.5} ${228 - frontWaistW * 0.55 - (pattern.waistL || 0) * 0.4} ${hemBL}
                    Z
                  `}
                  fill="url(#clothHatch)"
                  stroke="#38bdf8"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />

                {/* درزات الظهر */}
                <path d="M 210 14 Q 228 18 246 14" stroke="#38bdf8" strokeWidth="2.4" fill="none" />
                <line x1="210" y1="14" x2={bShLX} y2={bShLY} stroke="#f472b6" strokeWidth="2.2" />
                <line x1="246" y1="14" x2={bShRX} y2={bShRY} stroke="#f472b6" strokeWidth="2.2" />
                <path d={`M ${bShLX} ${bShLY} Q ${228 - frontWaistW * 0.45} 34 ${228 - frontWaistW * 0.45 - (pattern.waistL || 0) * 0.25} 44`} stroke="#34d399" strokeWidth="2.2" fill="none" />
                <path d={`M ${bShRX} ${bShRY} Q ${228 + frontWaistW * 0.45} 34 ${228 + frontWaistW * 0.45 + (pattern.waistR || 0) * 0.25} 44`} stroke="#34d399" strokeWidth="2.2" fill="none" />
                <line x1={228 - frontWaistW * 0.45 - (pattern.waistL || 0) * 0.25} y1="44" x2={228 - frontWaistW * 0.55 - (pattern.waistL || 0) * 0.4} y2={hemBL} stroke="#fb923c" strokeWidth="2.2" />
                <line x1={228 + frontWaistW * 0.45 + (pattern.waistR || 0) * 0.25} y1="44" x2={228 + frontWaistW * 0.55 + (pattern.waistR || 0) * 0.4} y2={hemBR} stroke="#fb923c" strokeWidth="2.2" />

                <text x="228" y="52" fill="#e5e5e5" fontSize="10" fontWeight="bold" textAnchor="middle" opacity="0.85">Back (ظهر)</text>

                {/* دوائر السحب التفاعلية الخاصة بظهر التيشيرت */}
                {/* 1. ورا يسار فوق (Back Shoulder Left) */}
                <PatternHandle
                  id="back_shoulder_left"
                  cx={bShLX}
                  cy={bShLY}
                  label="ورا يسار فوق"
                  value={pattern.backShoulderL || 0}
                  isDragging={draggingHandle === 'back_shoulder_left'}
                  onPointerDown={handlePointerDown}
                />

                {/* 2. ورا يمين فوق (Back Shoulder Right) */}
                <PatternHandle
                  id="back_shoulder_right"
                  cx={bShRX}
                  cy={bShRY}
                  label="ورا يمين فوق"
                  value={pattern.backShoulderR || 0}
                  isDragging={draggingHandle === 'back_shoulder_right'}
                  onPointerDown={handlePointerDown}
                />

                {/* 3. ورا تحت يسار (Back Bottom Left Corner) */}
                <PatternHandle
                  id="back_hem_left"
                  cx={228 - frontWaistW * 0.55 - (pattern.waistL || 0) * 0.4}
                  cy={hemBL}
                  label="ورا تحت يسار"
                  value={pattern.hemBackL || 0}
                  isDragging={draggingHandle === 'back_hem_left'}
                  onPointerDown={handlePointerDown}
                />

                {/* 4. ورا تحت يمين (Back Bottom Right Corner) */}
                <PatternHandle
                  id="back_hem_right"
                  cx={228 + frontWaistW * 0.55 + (pattern.waistR || 0) * 0.4}
                  cy={hemBR}
                  label="ورا تحت يمين"
                  value={pattern.hemBackR || 0}
                  isDragging={draggingHandle === 'back_hem_right'}
                  onPointerDown={handlePointerDown}
                />

                {/* 5. طول الظهر كاملاً */}
                <PatternHandle
                  id="back_hem_center"
                  cx={228}
                  cy={(hemBL + hemBR) * 0.5}
                  label="طول الظهر"
                  value={pattern.length}
                  isDragging={draggingHandle === 'back_hem_center'}
                  onPointerDown={handlePointerDown}
                />
              </g>

              {/* -------------------- 3. الكم الأيسر (Left Sleeve) -------------------- */}
              <g className="transition-all duration-75">
                {/* مسار شكل الكم الأيسر الممتد حتى المعصم مع تنحيف تدريجي طبيعي للساعد */}
                {(() => {
                  const cuffTaperL = sleeveLenL > 45 ? 0.78 : 1.0;
                  return (
                    <>
                      <path
                        d={`
                          M ${72 - sleeveWL * cuffTaperL} ${cuffYL}
                          L ${72 - sleeveWL * 0.92} 152
                          Q 72 136 ${72 + sleeveWL * 0.92} 152
                          L ${72 + sleeveWL * cuffTaperL} ${cuffYL}
                          Z
                        `}
                        fill="url(#clothHatch)"
                        stroke="#38bdf8"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />

                      <path d={`M ${72 - sleeveWL * 0.92} 152 Q 72 136 ${72 + sleeveWL * 0.92} 152`} stroke="#34d399" strokeWidth="2.4" fill="none" />
                      <line x1={72 - sleeveWL * 0.92} y1="152" x2={72 - sleeveWL * cuffTaperL} y2={cuffYL} stroke="#fb923c" strokeWidth="2.2" />
                      <line x1={72 + sleeveWL * 0.92} y1="152" x2={72 + sleeveWL * cuffTaperL} y2={cuffYL} stroke="#fb923c" strokeWidth="2.2" />
                      <line x1={72 - sleeveWL * cuffTaperL} y1={cuffYL} x2={72 + sleeveWL * cuffTaperL} y2={cuffYL} stroke="#38bdf8" strokeWidth="2.0" />

                      <text x="72" y="162" fill="#e5e5e5" fontSize="9" fontWeight="bold" textAnchor="middle" opacity="0.85">Left sleeve (كم يسار)</text>

                      {/* سحب طول الكم الأيسر المستقل حتى 85 سم (معصم كامل) */}
                      <PatternHandle
                        id="left_sleeve_len"
                        cx={72}
                        cy={cuffYL}
                        label="طول الكم يسار"
                        value={sleeveLenL}
                        isDragging={draggingHandle === 'left_sleeve_len'}
                        onPointerDown={handlePointerDown}
                      />

                      {/* سحب اتساع كفة الكم */}
                      <PatternHandle
                        id="left_sleeve_width"
                        cx={72 + sleeveWL * cuffTaperL}
                        cy={cuffYL}
                        label="عرض الكم"
                        value={pattern.sleeveWidth || 40}
                        isDragging={draggingHandle === 'left_sleeve_width'}
                        onPointerDown={handlePointerDown}
                      />
                    </>
                  );
                })()}
              </g>

              {/* -------------------- 4. الكم الأيمن (Right Sleeve) -------------------- */}
              <g className="transition-all duration-75">
                {/* مسار شكل الكم الأيمن الممتد حتى المعصم */}
                {(() => {
                  const cuffTaperR = sleeveLenR > 45 ? 0.78 : 1.0;
                  return (
                    <>
                      <path
                        d={`
                          M ${228 - sleeveWR * cuffTaperR} ${cuffYR}
                          L ${228 - sleeveWR * 0.92} 152
                          Q 228 136 ${228 + sleeveWR * 0.92} 152
                          L ${228 + sleeveWR * cuffTaperR} ${cuffYR}
                          Z
                        `}
                        fill="url(#clothHatch)"
                        stroke="#38bdf8"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />

                      <path d={`M ${228 - sleeveWR * 0.92} 152 Q 228 136 ${228 + sleeveWR * 0.92} 152`} stroke="#34d399" strokeWidth="2.4" fill="none" />
                      <line x1={228 - sleeveWR * 0.92} y1="152" x2={228 - sleeveWR * cuffTaperR} y2={cuffYR} stroke="#fb923c" strokeWidth="2.2" />
                      <line x1={228 + sleeveWR * 0.92} y1="152" x2={228 + sleeveWR * cuffTaperR} y2={cuffYR} stroke="#fb923c" strokeWidth="2.2" />
                      <line x1={228 - sleeveWR * cuffTaperR} y1={cuffYR} x2={228 + sleeveWR * cuffTaperR} y2={cuffYR} stroke="#38bdf8" strokeWidth="2.0" />

                      <text x="228" y="162" fill="#e5e5e5" fontSize="9" fontWeight="bold" textAnchor="middle" opacity="0.85">Right sleeve (كم يمين)</text>

                      {/* سحب طول الكم الأيمن المستقل حتى 85 سم (معصم كامل) */}
                      <PatternHandle
                        id="right_sleeve_len"
                        cx={228}
                        cy={cuffYR}
                        label="طول الكم يمين"
                        value={sleeveLenR}
                        isDragging={draggingHandle === 'right_sleeve_len'}
                        onPointerDown={handlePointerDown}
                      />

                      {/* سحب اتساع كفة الكم الأيمن */}
                      <PatternHandle
                        id="right_sleeve_width"
                        cx={228 + sleeveWR * cuffTaperR}
                        cy={cuffYR}
                        label="عرض الكم"
                        value={pattern.sleeveWidth || 40}
                        isDragging={draggingHandle === 'right_sleeve_width'}
                        onPointerDown={handlePointerDown}
                      />
                    </>
                  );
                })()}
              </g>
            </svg>
          </div>
        </div>

        {/* 3. سلايدرات التحكم بالأبعاد والمقاس بالسنتيمتر (Shape Sliders) */}
        <div className="space-y-3 pt-1 border-t border-neutral-800/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Shape <span className="text-[10px] font-normal text-neutral-400 lowercase">(أبعاد ومقاسات التيشيرت)</span>
          </h3>

          <div className="space-y-3 bg-neutral-900/60 p-3 rounded-2xl border border-neutral-800/80">
            {/* الطول الكلي Length */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300 font-medium">Length <span className="text-[10px] text-neutral-400">(الطول)</span></span>
                <span className="font-mono text-amber-400 font-semibold">{pattern.length} cm</span>
              </div>
              <input
                type="range"
                min="30"
                max="110"
                step="1"
                value={pattern.length}
                onChange={(e) => handleSlider('length', parseInt(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-[9px] text-neutral-400">
                <span>30 cm (كروب توب)</span>
                <span>78 cm (طبيعي)</span>
                <span>110 cm (تونيك طويل)</span>
              </div>
            </div>

            {/* العرض Width */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300 font-medium">Width <span className="text-[10px] text-neutral-400">(العرض)</span></span>
                <span className="font-mono text-amber-400 font-semibold">{pattern.width} cm</span>
              </div>
              <input
                type="range"
                min="35"
                max="90"
                step="1"
                value={pattern.width}
                onChange={(e) => handleSlider('width', parseInt(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-[9px] text-neutral-400">
                <span>35 cm (ضيق سليم)</span>
                <span>56 cm (معتدل)</span>
                <span>90 cm (أوفر سايز واسع)</span>
              </div>
            </div>

            {/* طول الكم Sleeve length */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300 font-medium">Sleeve length <span className="text-[10px] text-neutral-400">(طول الأكمام)</span></span>
                <span className="font-mono text-amber-400 font-semibold">{pattern.sleeveLength} cm</span>
              </div>
              <input
                type="range"
                min="5"
                max="85"
                step="1"
                value={pattern.sleeveLength}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  onChangePattern(prev => ({
                    ...prev,
                    sleeveLength: val,
                    sleeveLengthL: val,
                    sleeveLengthR: val
                  }));
                }}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-[9px] text-neutral-400">
                <span>5 cm (كت كتف)</span>
                <span>28 cm (نصف كم)</span>
                <span>85 cm (كم كامل للمعصم)</span>
              </div>
            </div>

            {/* طول الأكمام المستقلة Left & Right Sleeve Length */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-800/60">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-neutral-300">Left (كم يسار)</span>
                  <span className="font-mono text-sky-400 font-semibold">{pattern.sleeveLengthL ?? pattern.sleeveLength ?? 28} cm</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="85"
                  step="1"
                  value={pattern.sleeveLengthL ?? pattern.sleeveLength ?? 28}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    onChangePattern(prev => ({
                      ...prev,
                      sleeveLengthL: val
                    }));
                  }}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-neutral-300">Right (كم يمين)</span>
                  <span className="font-mono text-sky-400 font-semibold">{pattern.sleeveLengthR ?? pattern.sleeveLength ?? 28} cm</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="85"
                  step="1"
                  value={pattern.sleeveLengthR ?? pattern.sleeveLength ?? 28}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    onChangePattern(prev => ({
                      ...prev,
                      sleeveLengthR: val
                    }));
                  }}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </div>

            {/* عرض الكم Sleeve width */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300 font-medium">Sleeve width <span className="text-[10px] text-neutral-400">(اتساع الكم)</span></span>
                <span className="font-mono text-amber-400 font-semibold">{pattern.sleeveWidth} cm</span>
              </div>
              <input
                type="range"
                min="20"
                max="60"
                step="1"
                value={pattern.sleeveWidth}
                onChange={(e) => handleSlider('sleeveWidth', parseInt(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            {/* عمق فتحة الرقبة Neckline */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300 font-medium">Neckline <span className="text-[10px] text-neutral-400">(فتحة الرقبة)</span></span>
                <span className="font-mono text-amber-400 font-semibold">{pattern.neckline} cm</span>
              </div>
              <input
                type="range"
                min="10"
                max="45"
                step="1"
                value={pattern.neckline}
                onChange={(e) => handleSlider('neckline', parseInt(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-[9px] text-neutral-400">
                <span>10 cm (دائري ضيق)</span>
                <span>28 cm (واسع)</span>
                <span>45 cm (فتحة عميقة V)</span>
              </div>
            </div>

            {/* قص مائل غير متناظر (Asymmetrical Cut) */}
            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
              <div className="text-xs">
                <p className="text-neutral-200 font-medium">قصة مائلة (Asymmetrical Hem)</p>
                <p className="text-[10px] text-neutral-400">ميلان جانب التيشيرت الأيسر كما بالصورة 3</p>
              </div>
              <button
                onClick={() => {
                  const newOffset = pattern.hemLeftOffset > 0 ? 0 : 20;
                  handleSlider('hemLeftOffset', newOffset);
                  if (onTriggerDrape) onTriggerDrape();
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                  pattern.hemLeftOffset > 0 
                    ? 'bg-amber-600/30 border-amber-500 text-amber-300' 
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'
                }`}
              >
                {pattern.hemLeftOffset > 0 ? "مائل مفعّل" : "تفعيل الميلان"}
              </button>
            </div>
          </div>

          {/* 3.1 بطاقة التحكم الفردي للزوايا والأكمام التي طلبها المستخدم بدقة */}
          <div className="bg-neutral-900/80 rounded-2xl border border-amber-500/30 overflow-hidden shadow-lg">
            <button
              onClick={() => setShowCornerSliders(!showCornerSliders)}
              className="w-full p-3 bg-gradient-to-r from-amber-950/40 to-neutral-900 flex items-center justify-between text-xs font-bold text-amber-300 hover:text-amber-200 transition"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>التحكم التفصيلي بالزوايا والأكمام (الدوائر البرتقالية)</span>
              </div>
              {showCornerSliders ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
            </button>

            {showCornerSliders && (
              <div className="p-3.5 space-y-4 border-t border-neutral-800 text-xs">
                {/* 1. أطوال الأكمام حتى المعصم */}
                <div className="space-y-2.5 bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/80">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5">
                      <span>طول الأكمام المستقل (حتى المعصم 85 cm)</span>
                    </span>
                    <button
                      onClick={() => {
                        const maxVal = Math.max(pattern.sleeveLengthL ?? 28, pattern.sleeveLengthR ?? 28);
                        onChangePattern(prev => ({
                          ...prev,
                          sleeveLengthL: maxVal,
                          sleeveLengthR: maxVal,
                          sleeveLength: maxVal
                        }));
                      }}
                      className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded border border-neutral-700 transition"
                    >
                      مزامنة الكمين
                    </button>
                  </div>

                  {/* طول الكم الأيسر */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-300">طول الكم الأيسر (Left Sleeve)</span>
                      <span className="font-mono text-amber-400 font-bold">{pattern.sleeveLengthL ?? pattern.sleeveLength ?? 28} cm</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="85"
                      step="1"
                      value={pattern.sleeveLengthL ?? pattern.sleeveLength ?? 28}
                      onChange={(e) => handleSlider('sleeveLengthL', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>

                  {/* طول الكم الأيمن */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-300">طول الكم الأيمن (Right Sleeve)</span>
                      <span className="font-mono text-amber-400 font-bold">{pattern.sleeveLengthR ?? pattern.sleeveLength ?? 28} cm</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="85"
                      step="1"
                      value={pattern.sleeveLengthR ?? pattern.sleeveLength ?? 28}
                      onChange={(e) => handleSlider('sleeveLengthR', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>
                </div>

                {/* 2. أطراف الحاشية السفلية الأربعة */}
                <div className="space-y-2.5 bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/80">
                  <span className="font-bold text-amber-400">أطراف البلوزة السفلية (الحاشية Hem):</span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* يمين تحت */}
                    <div className="space-y-1 bg-neutral-900/80 p-2 rounded-lg border border-neutral-800">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-300">يمين تحت (أمام)</span>
                        <span className="font-mono text-amber-400">{pattern.hemFrontR || 0} cm</span>
                      </div>
                      <input
                        type="range"
                        min="-25"
                        max="45"
                        step="1"
                        value={pattern.hemFrontR || 0}
                        onChange={(e) => handleSlider('hemFrontR', parseInt(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    {/* يسار تحت */}
                    <div className="space-y-1 bg-neutral-900/80 p-2 rounded-lg border border-neutral-800">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-300">يسار تحت (أمام)</span>
                        <span className="font-mono text-amber-400">{pattern.hemFrontL || 0} cm</span>
                      </div>
                      <input
                        type="range"
                        min="-25"
                        max="45"
                        step="1"
                        value={pattern.hemFrontL || 0}
                        onChange={(e) => handleSlider('hemFrontL', parseInt(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    {/* ورا تحت يمين */}
                    <div className="space-y-1 bg-neutral-900/80 p-2 rounded-lg border border-neutral-800">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-300">ورا تحت يمين (ظهر)</span>
                        <span className="font-mono text-amber-400">{pattern.hemBackR || 0} cm</span>
                      </div>
                      <input
                        type="range"
                        min="-25"
                        max="45"
                        step="1"
                        value={pattern.hemBackR || 0}
                        onChange={(e) => handleSlider('hemBackR', parseInt(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    {/* ورا تحت يسار */}
                    <div className="space-y-1 bg-neutral-900/80 p-2 rounded-lg border border-neutral-800">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-300">ورا تحت يسار (ظهر)</span>
                        <span className="font-mono text-amber-400">{pattern.hemBackL || 0} cm</span>
                      </div>
                      <input
                        type="range"
                        min="-25"
                        max="45"
                        step="1"
                        value={pattern.hemBackL || 0}
                        onChange={(e) => handleSlider('hemBackL', parseInt(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. أكتاف البلوزة الأربعة */}
                <div className="space-y-2.5 bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800/80">
                  <span className="font-bold text-amber-400">أكتاف البلوزة العلوية (Shoulders):</span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* يمين فوق */}
                    <div className="space-y-1 bg-neutral-900/80 p-2 rounded-lg border border-neutral-800">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-300">يمين فوق (أمام)</span>
                        <span className="font-mono text-amber-400">{pattern.shoulderR || 0} cm</span>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="25"
                        step="1"
                        value={pattern.shoulderR || 0}
                        onChange={(e) => handleSlider('shoulderR', parseInt(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    {/* فوق يسار */}
                    <div className="space-y-1 bg-neutral-900/80 p-2 rounded-lg border border-neutral-800">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-300">فوق يسار (أمام)</span>
                        <span className="font-mono text-amber-400">{pattern.shoulderL || 0} cm</span>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="25"
                        step="1"
                        value={pattern.shoulderL || 0}
                        onChange={(e) => handleSlider('shoulderL', parseInt(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    {/* ورا يمين فوق */}
                    <div className="space-y-1 bg-neutral-900/80 p-2 rounded-lg border border-neutral-800">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-300">ورا يمين فوق (ظهر)</span>
                        <span className="font-mono text-amber-400">{pattern.backShoulderR || 0} cm</span>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="25"
                        step="1"
                        value={pattern.backShoulderR || 0}
                        onChange={(e) => handleSlider('backShoulderR', parseInt(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    {/* ورا يسار فوق */}
                    <div className="space-y-1 bg-neutral-900/80 p-2 rounded-lg border border-neutral-800">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-neutral-300">ورا يسار فوق (ظهر)</span>
                        <span className="font-mono text-amber-400">{pattern.backShoulderL || 0} cm</span>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="25"
                        step="1"
                        value={pattern.backShoulderL || 0}
                        onChange={(e) => handleSlider('backShoulderL', parseInt(e.target.value))}
                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* زر تصفير كل الزوايا */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => {
                      onChangePattern(prev => ({
                        ...prev,
                        hemFrontL: 0,
                        hemFrontR: 0,
                        hemBackL: 0,
                        hemBackR: 0,
                        shoulderL: 0,
                        shoulderR: 0,
                        backShoulderL: 0,
                        backShoulderR: 0,
                        waistL: 0,
                        waistR: 0
                      }));
                      if (onTriggerDrape) onTriggerDrape();
                    }}
                    className="text-[10px] text-neutral-400 hover:text-amber-400 flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>تصفير وضبط جميع الزوايا إلى 0</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. تناسق الحجم لكل الأجسام (Fit All Body Types) */}
        <div className="space-y-2 pt-1 border-t border-neutral-800/80">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
              <span>Fit for All Bodies</span>
              <span className="text-[10px] text-amber-400 font-normal lowercase">(لكل الأجسام)</span>
            </h3>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              انعدام التمزق 100%
            </span>
          </div>

          <p className="text-[11px] text-neutral-400 leading-relaxed">
            يتكيف القماش تلقائياً مع أي بنية جسدية (سمين، معضل، نحيف) بدون أي تداخل أو اختراق للجلد:
          </p>

          {/* أزرار البريزيت السريعة للأجسام */}
          <div className="grid grid-cols-5 gap-1.5">
            {BODY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyBodyPreset(preset)}
                className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                  activePreset === preset.id
                    ? 'bg-gradient-to-b from-amber-600/30 to-amber-900/30 border-amber-500 text-amber-200 font-bold shadow-md shadow-amber-600/20'
                    : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
                }`}
              >
                <span className="text-base">{preset.icon}</span>
                <span className="text-[10px] truncate max-w-full">{preset.name}</span>
              </button>
            ))}
          </div>

          {/* سلايدرات سريعة لوزن وضخامة الجسم في الاستوديو */}
          <div className="bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400 text-[11px]">سمنة البطن (كرش):</span>
              <span className="font-mono text-amber-400 font-bold">{((morphs?.bellyFat || 1.0) * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={morphs?.bellyFat || 1.0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (onChangeMorphs) onChangeMorphs(prev => ({ ...prev, bellyFat: val }));
              }}
              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />

            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400 text-[11px]">عضلات وضخامة الصدر:</span>
              <span className="font-mono text-amber-400 font-bold">{((morphs?.chest || 1.0) * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={morphs?.chest || 1.0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (onChangeMorphs) onChangeMorphs(prev => ({ ...prev, chest: val }));
              }}
              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>

        {/* 5. نوع خامة القماش (Fabric) */}
        <div className="space-y-2 pt-1 border-t border-neutral-800/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Fabric <span className="text-[10px] font-normal text-neutral-400 lowercase">(نوع القماش)</span>
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {FABRIC_TYPES.map((fab) => (
              <button
                key={fab.id}
                onClick={() => handleSlider('fabric', fab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                  pattern.fabric === fab.id
                    ? 'bg-amber-600/40 border-amber-500 text-amber-200 font-bold shadow-md shadow-amber-600/20'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                }`}
                title={fab.desc}
              >
                {fab.name}
              </button>
            ))}
          </div>
        </div>

        {/* 6. درجات الألوان (Colour) */}
        <div className="space-y-2 pt-1 border-t border-neutral-800/80">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Colour <span className="text-[10px] font-normal text-neutral-400 lowercase">(لون التيشيرت)</span>
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full border border-neutral-700 shadow-sm" style={{ backgroundColor: pattern.color }} />
              <span className="text-[10px] font-mono text-neutral-400 uppercase">{pattern.color}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_SWATCHES.map((swatch, idx) => (
              <button
                key={idx}
                onClick={() => handleSlider('color', swatch.hex)}
                className={`w-7 h-7 rounded-full border-2 transition-all relative ${
                  pattern.color?.toLowerCase() === swatch.hex.toLowerCase()
                    ? 'border-amber-400 scale-110 shadow-lg shadow-amber-500/30'
                    : 'border-neutral-700 hover:scale-105 hover:border-neutral-500'
                }`}
                style={{ backgroundColor: swatch.hex }}
                title={swatch.name}
              >
                {pattern.color?.toLowerCase() === swatch.hex.toLowerCase() && (
                  <Check className={`w-3.5 h-3.5 absolute inset-0 m-auto ${swatch.hex === '#f2ede4' || swatch.hex === '#ecc94b' ? 'text-neutral-900' : 'text-white'}`} />
                )}
              </button>
            ))}

            {/* محدد اللون الحر (Custom Color Picker) */}
            <label 
              className="w-7 h-7 rounded-full border-2 border-neutral-700 hover:border-amber-400 flex items-center justify-center cursor-pointer transition relative overflow-hidden bg-gradient-to-tr from-rose-500 via-emerald-500 to-indigo-500"
              title="اختيار لون مخصص"
            >
              <input
                type="color"
                value={pattern.color || '#ecc94b'}
                onChange={(e) => handleSlider('color', e.target.value)}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
              />
            </label>
          </div>
        </div>

        {/* 7. مستوى التفاصيل (Detail Level) */}
        <div className="space-y-2 pt-1 border-t border-neutral-800/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Detail <span className="text-[10px] font-normal text-neutral-400 lowercase">(دقة المحاكاة)</span>
          </h3>

          <div className="grid grid-cols-3 gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
            {['Fast', 'Normal', 'Fine'].map((lvl) => {
              const id = lvl.toLowerCase();
              return (
                <button
                  key={id}
                  onClick={() => handleSlider('detail', id)}
                  className={`py-1 rounded-lg text-xs transition font-medium ${
                    pattern.detail === id
                      ? 'bg-amber-600 text-white font-bold shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </div>

        {/* 8. خيارات العرض (Toggles) */}
        <div className="space-y-2 pt-1 border-t border-neutral-800/80">
          <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={pattern.showPed}
              onChange={(e) => handleSlider('showPed', e.target.checked)}
              className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-amber-600 focus:ring-amber-500 accent-amber-500 cursor-pointer"
            />
            <span>Show ped <span className="text-[10px] text-neutral-400">(إظهار جسم ومجسم الشخصية)</span></span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer hover:text-white transition">
            <input
              type="checkbox"
              checked={pattern.showSeams}
              onChange={(e) => handleSlider('showSeams', e.target.checked)}
              className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-amber-600 focus:ring-amber-500 accent-amber-500 cursor-pointer"
            />
            <span>Show seams <span className="text-[10px] text-neutral-400">(إظهار خيوط ودرزات الخياطة بالنقاط البرتقالية)</span></span>
          </label>
        </div>

        {/* 9. الأكورديون الإرشادي (What comes next) */}
        <div className="pt-2 border-t border-neutral-800/80">
          <button
            onClick={() => setShowNextAccordion(!showNextAccordion)}
            className="w-full flex items-center justify-between text-xs text-neutral-400 hover:text-neutral-200 transition py-1"
          >
            <span className="font-semibold text-neutral-300">What comes next</span>
            {showNextAccordion ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showNextAccordion && (
            <div className="mt-2 p-3 bg-neutral-900/90 rounded-xl border border-neutral-800 text-[11px] text-neutral-400 leading-relaxed space-y-1.5">
              <p>
                This preview sews one shirt pattern. Next: your own pieces drawn with a pen, colours and prints on the pattern, more garment starts, and export to FiveM.
              </p>
              <p className="text-[10px] text-amber-400">
                • تم دمج التكيف التلقائي مع المقاييس لمنع التداخل مع أي جسم في فايف إم.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
