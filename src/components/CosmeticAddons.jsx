import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * FiveM Studio - Cosmetic Addons & External Attachments Engine (FiveForge Style)
 * Renders 3D procedural cosmetic accessories attached to the ped's skeleton and body:
 * - Chains & Jewelry (Cuban Link, Diamond Medallion, Silver Cross, Rolex Watch)
 * - Tactical & Combat Gear (Plate Carrier Vest, Thigh Holster, Shoulder Radio, Duty Belt)
 * - Headwear & Eyewear (Sunglasses, Snapback Cap, Ballistic Helmet)
 * - Face Covers (Balaclava, Tactical Shemagh)
 * - Bags & Backpacks (Assault Backpack, Heist Duffle Bag)
 * - Custom Props (Katana, Assault Rifle, Baseball Bat, Briefcase)
 * - Decals & Emblems (LSPD, SWAT, FIB, EMS, Custom Decal Stamper)
 */

export default function CosmeticAddons({ cosmetics = {}, morphs = {} }) {
  // PBR Materials for gold, silver, diamonds, fabrics, and plastics
  const materials = useMemo(() => {
    return {
      gold: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ffc83b'),
        metalness: 0.95,
        roughness: 0.16,
        envMapIntensity: 1.8
      }),
      silver: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#e2e8f0'),
        metalness: 0.92,
        roughness: 0.20,
        envMapIntensity: 1.5
      }),
      diamond: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#f0f9ff'),
        metalness: 0.3,
        roughness: 0.05,
        envMapIntensity: 2.5
      }),
      tacticalBlack: new THREE.MeshStandardMaterial({
        color: new THREE.Color(cosmetics.vestColor || '#18181b'),
        roughness: 0.82,
        metalness: 0.15
      }),
      tacticalStrap: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#111113'),
        roughness: 0.90,
        metalness: 0.10
      }),
      darkGlass: new THREE.MeshStandardMaterial({
        color: new THREE.Color(cosmetics.glassesTint || '#09090b'),
        roughness: 0.05,
        metalness: 0.95,
        transparent: true,
        opacity: 0.88,
        envMapIntensity: 2.0
      }),
      capFabric: new THREE.MeshStandardMaterial({
        color: new THREE.Color(cosmetics.capColor || '#1e1b4b'),
        roughness: 0.80,
        metalness: 0.10
      }),
      shemaghFabric: new THREE.MeshStandardMaterial({
        color: new THREE.Color(cosmetics.shemaghColor || '#d4b996'),
        roughness: 0.88,
        metalness: 0.05
      }),
      leatherHolster: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1c1917'),
        roughness: 0.65,
        metalness: 0.30
      }),
      weaponMetal: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#27272a'),
        metalness: 0.85,
        roughness: 0.30
      })
    };
  }, [cosmetics.vestColor, cosmetics.glassesTint, cosmetics.capColor, cosmetics.shemaghColor]);

  // Adjustments based on body morphs (e.g. belly fat and chest bulk)
  const chestOffsetZ = (morphs.chest ? (morphs.chest - 1.0) * 0.05 : 0) + (morphs.bellyFat ? (morphs.bellyFat - 1.0) * 0.04 : 0);
  const neckScale = morphs.faceFat ? 1.0 + (morphs.faceFat - 1.0) * 0.25 : 1.0;
  const vestZOffset = cosmetics.tacticalVest ? 0.042 : 0;

  return (
    <group name="fiveforge_cosmetics_root">
      {/* 1. سلاسل ومجوهرات (Chains & Jewelry) */}
      {/* أ) سلسلة كوبان ذهبية عريضة (Heavy Cuban Link Gold Chain) */}
      {cosmetics.goldChain && (
        <group position={[0, 0.435, 0.080 + chestOffsetZ * 0.6 + vestZOffset]} rotation={[0.42, 0, 0]}>
          {/* حلقة السلسلة الرئيسية حول العنق */}
          <mesh material={materials.gold} scale={[neckScale * 1.05, 1.15, 1.05]}>
            <torusGeometry args={[0.078, 0.008, 12, 36, Math.PI * 1.55]} />
          </mesh>
          {/* وصلات السلسلة السميكة البارزة */}
          <mesh material={materials.gold} position={[0, -0.075, 0.025]} rotation={[0.2, 0, 0]} scale={[1, 1, 1.2]}>
            <torusGeometry args={[0.024, 0.007, 10, 24]} />
          </mesh>
        </group>
      )}

      {/* ب) سلسلة مدلاة ألماس مثلجة (Iced-Out Diamond Medallion) */}
      {cosmetics.diamondPendant && (
        <group position={[0, 0.410, 0.092 + chestOffsetZ * 0.7 + vestZOffset]} rotation={[0.35, 0, 0]}>
          {/* سلك السلسلة الدقيق */}
          <mesh material={materials.silver}>
            <torusGeometry args={[0.082, 0.0035, 10, 32, Math.PI * 1.6]} />
          </mesh>
          {/* قلادة الميدالية الألماسية الكبيرة البارزة على الصدر */}
          <group position={[0, -0.095, 0.022]} rotation={[-0.25, 0, 0]}>
            {/* الإطار المعدني الذهبي */}
            <mesh material={materials.gold}>
              <cylinderGeometry args={[0.028, 0.028, 0.006, 32]} />
            </mesh>
            {/* وجه الميدالية المرصع بالألماس اللامع */}
            <mesh material={materials.diamond} position={[0, 0.0035, 0]}>
              <cylinderGeometry args={[0.023, 0.023, 0.003, 32]} />
            </mesh>
            {/* نجمة / صليب بارز في منتصف الميدالية */}
            <mesh material={materials.gold} position={[0, 0.006, 0]}>
              <boxGeometry args={[0.006, 0.026, 0.004]} />
            </mesh>
            <mesh material={materials.gold} position={[0, 0.006, 0]}>
              <boxGeometry args={[0.020, 0.006, 0.004]} />
            </mesh>
          </group>
        </group>
      )}

      {/* ج) سلسلة فضية مع صليب قوطي (Silver Rope Chain with Cross) */}
      {cosmetics.silverCross && (
        <group position={[0, 0.425, 0.088 + chestOffsetZ * 0.6 + vestZOffset]} rotation={[0.38, 0, 0]}>
          <mesh material={materials.silver}>
            <torusGeometry args={[0.080, 0.004, 10, 32, Math.PI * 1.58]} />
          </mesh>
          {/* الصليب الفضي القوطي المتدلي */}
          <group position={[0, -0.10, 0.020]} rotation={[-0.20, 0, 0]}>
            <mesh material={materials.silver}>
              <boxGeometry args={[0.005, 0.038, 0.004]} />
            </mesh>
            <mesh material={materials.silver} position={[0, 0.007, 0]}>
              <boxGeometry args={[0.024, 0.005, 0.004]} />
            </mesh>
          </group>
        </group>
      )}

      {/* د) ساعة رولكس مثلجة فخمة على المعصم الأيسر (Luxury Iced Rolex Watch) */}
      {cosmetics.luxuryWatch && !morphs.hideLeftArm && (
        <group position={[0.278, -0.065, -0.038]} rotation={[0.45, 0.25, -0.75]}>
          {/* سوار الساعة المعدني الذهبي */}
          <mesh material={materials.gold}>
            <cylinderGeometry args={[0.038, 0.038, 0.022, 24, 1, true]} />
          </mesh>
          {/* إطار الساعة الدائري الرولكس */}
          <mesh material={materials.gold} position={[0, 0, 0.036]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.006, 32]} />
          </mesh>
          {/* ميناء الساعة الداخلي الألماسي */}
          <mesh material={materials.diamond} position={[0, 0, 0.040]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.012, 24]} />
          </mesh>
          {/* تاج ضبط الساعة الجانبي */}
          <mesh material={materials.gold} position={[0.017, 0, 0.036]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.003, 0.003, 0.005, 12]} />
          </mesh>
        </group>
      )}

      {/* 2. دروع وتجهيزات تكتيكية (Tactical & Combat Gear) */}
      {/* أ) سترة درع واقي عسكري/شرطي (Tactical Plate Carrier Vest) */}
      {cosmetics.tacticalVest && (
        <group position={[0, 0.32, 0.005 + chestOffsetZ]} scale={[1.04, 1.0, 1.06]}>
          {/* اللوح البالستي الأمامي المنحني على الصدر والبطن */}
          <mesh material={materials.tacticalBlack} position={[0, 0.015, 0.118]}>
            <boxGeometry args={[0.27, 0.29, 0.045]} />
          </mesh>
          {/* قصة الأكتاف العريضة المريحة للدرع */}
          <mesh material={materials.tacticalBlack} position={[0, 0.150, 0.105]}>
            <boxGeometry args={[0.20, 0.065, 0.040]} />
          </mesh>
          {/* اللوح البالستي الخلفي للظهر */}
          <mesh material={materials.tacticalBlack} position={[0, 0.015, -0.115]}>
            <boxGeometry args={[0.27, 0.30, 0.040]} />
          </mesh>
          {/* أحزمة الأكتاف التكتيكية الثقيلة */}
          <mesh material={materials.tacticalStrap} position={[-0.095, 0.170, 0.0]}>
            <boxGeometry args={[0.048, 0.024, 0.24]} />
          </mesh>
          <mesh material={materials.tacticalStrap} position={[0.095, 0.170, 0.0]}>
            <boxGeometry args={[0.048, 0.024, 0.24]} />
          </mesh>
          {/* أحزمة الجوانب القابلة للشد (Cummerbund) */}
          <mesh material={materials.tacticalStrap} position={[-0.142, 0.0, 0.0]}>
            <boxGeometry args={[0.024, 0.15, 0.23]} />
          </mesh>
          <mesh material={materials.tacticalStrap} position={[0.142, 0.0, 0.0]}>
            <boxGeometry args={[0.024, 0.15, 0.23]} />
          </mesh>
          {/* جعب مخازن الذخيرة الثلاثية على البطن (MOLLE Triple Mag Pouches) */}
          <group position={[0, -0.065, 0.142]}>
            {[-0.075, 0.0, 0.075].map((xOffset, idx) => (
              <mesh key={idx} material={materials.tacticalBlack} position={[xOffset, 0, 0]}>
                <boxGeometry args={[0.056, 0.11, 0.032]} />
              </mesh>
            ))}
          </group>
          {/* لوحة الفيلكرو للرتب والشارات العسكرية / الشرطية */}
          <mesh material={materials.tacticalStrap} position={[0, 0.105, 0.142]}>
            <boxGeometry args={[0.15, 0.048, 0.006]} />
          </mesh>
          {/* كتابة الرتبة المضيئة أو شارة الدرع */}
          {cosmetics.vestPatch && cosmetics.vestPatch !== 'none' && (
            <mesh position={[0, 0.105, 0.146]}>
              <planeGeometry args={[0.14, 0.040]} />
              <meshBasicMaterial 
                color={
                  cosmetics.vestPatch === 'lspd' ? '#ffffff' :
                  cosmetics.vestPatch === 'swat' ? '#38bdf8' :
                  cosmetics.vestPatch === 'fib' ? '#fbbf24' :
                  cosmetics.vestPatch === 'sheriff' ? '#eab308' :
                  cosmetics.vestPatch === 'ems' ? '#ef4444' : '#ffffff'
                } 
              />
            </mesh>
          )}
        </group>
      )}

      {/* ب) هولستر مسدس تكتيكي على الفخذ الأيمن (Tactical Thigh Gun Holster) */}
      {cosmetics.thighHolster && !morphs.hideRightLeg && (
        <group position={[-0.150, -0.36, 0.02]} rotation={[0.05, 0.10, -0.06]}>
          {/* حزام التثبيت المزدوج حول الفخذ */}
          <mesh material={materials.tacticalStrap} position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.126, 0.124, 0.024, 24, 1, true]} />
          </mesh>
          <mesh material={materials.tacticalStrap} position={[0, -0.04, 0]}>
            <cylinderGeometry args={[0.118, 0.116, 0.024, 24, 1, true]} />
          </mesh>
          {/* بيت المسدس الكايدكس (Kydex Holster) */}
          <mesh material={materials.leatherHolster} position={[-0.042, 0, 0.045]} rotation={[0.10, -0.15, 0]}>
            <boxGeometry args={[0.048, 0.16, 0.070]} />
          </mesh>
          {/* قبضة مسدس تكتيكي غلوك بارزة جاهزة للسحب (Pistol Grip) */}
          <group position={[-0.045, 0.080, 0.055]} rotation={[-0.35, -0.15, 0]}>
            <mesh material={materials.weaponMetal}>
              <boxGeometry args={[0.024, 0.075, 0.038]} />
            </mesh>
            <mesh material={materials.weaponMetal} position={[0, 0.035, -0.025]}>
              <boxGeometry args={[0.026, 0.028, 0.075]} />
            </mesh>
          </group>
        </group>
      )}

      {/* ج) جهاز لاسلكي تكتيكي مع مايك الكتف (Shoulder Radio & Mic) */}
      {cosmetics.shoulderRadio && (
        <group position={[0.130, 0.41, 0.105 + chestOffsetZ]} rotation={[0.15, -0.20, 0]}>
          {/* هيكل اللاسلكي الأسود */}
          <mesh material={materials.tacticalBlack}>
            <boxGeometry args={[0.038, 0.085, 0.028]} />
          </mesh>
          {/* إريل / هوائي اللاسلكي المرن الممتد للأعلى */}
          <mesh material={materials.tacticalStrap} position={[0.012, 0.08, 0]}>
            <cylinderGeometry args={[0.0025, 0.0035, 0.09, 8]} />
          </mesh>
          {/* أزرار وقنوات اللاسلكي العلوية */}
          <mesh material={materials.weaponMetal} position={[-0.010, 0.048, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.012, 12]} />
          </mesh>
          {/* مايك الكتف المشبوك على الياقة (Shoulder PTT Mic) */}
          <group position={[-0.035, 0.085, 0.015]} rotation={[-0.15, 0.35, 0.20]}>
            <mesh material={materials.tacticalBlack}>
              <boxGeometry args={[0.028, 0.038, 0.018]} />
            </mesh>
            <mesh material={materials.weaponMetal} position={[0, 0, 0.010]}>
              <circleGeometry args={[0.008, 16]} />
            </mesh>
          </group>
        </group>
      )}

      {/* د) حزام العمليات التكتيكي (Tactical Duty Belt) */}
      {cosmetics.dutyBelt && (
        <group position={[0, -0.070, 0.005]} scale={[1.05, 1.0, 1.06]}>
          {/* الحزام النايلون العريض */}
          <mesh material={materials.tacticalStrap}>
            <cylinderGeometry args={[0.176, 0.178, 0.048, 32, 1, false]} />
          </mesh>
          {/* إبزيم الحزام المعدني كوبرا كويك ريليس */}
          <mesh material={materials.weaponMetal} position={[0, 0, 0.180]}>
            <boxGeometry args={[0.055, 0.052, 0.016]} />
          </mesh>
          {/* جعبة الأصفاد على الجانب الأيسر */}
          <mesh material={materials.leatherHolster} position={[0.170, 0, 0.04]} rotation={[0, 1.1, 0]}>
            <boxGeometry args={[0.038, 0.060, 0.042]} />
          </mesh>
          {/* جعبة تيزر كهربائي أو مخازن إضافية على الجانب الأيمن */}
          <mesh material={materials.tacticalBlack} position={[-0.170, 0, 0.04]} rotation={[0, -1.1, 0]}>
            <boxGeometry args={[0.035, 0.070, 0.040]} />
          </mesh>
          {/* كشاف تكتيكي في الخلف */}
          <mesh material={materials.weaponMetal} position={[-0.09, 0, -0.175]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.080, 16]} />
          </mesh>
        </group>
      )}

      {/* 3. أغطية الرأس والنظارات (Headwear & Eyewear) */}
      {/* أ) نظارات شمسية تكتيكية أفياتور سوداء (Tactical Sunglasses / Aviators) */}
      {cosmetics.sunglasses && (
        <group position={[0, 0.708, 0.108]}>
          {/* العدسة اليسرى */}
          <mesh material={materials.darkGlass} position={[0.032, 0, 0]}>
            <boxGeometry args={[0.032, 0.024, 0.005]} />
          </mesh>
          {/* العدسة اليمنى */}
          <mesh material={materials.darkGlass} position={[-0.032, 0, 0]}>
            <boxGeometry args={[0.032, 0.024, 0.005]} />
          </mesh>
          {/* جسر الأنف المعدني الأنيق */}
          <mesh material={materials.gold} position={[0, 0.006, 0.002]}>
            <boxGeometry args={[0.018, 0.003, 0.003]} />
          </mesh>
          {/* ذراعا النظارة الممتدان للخلف فوق الأذنين */}
          <mesh material={materials.gold} position={[0.052, 0, -0.050]} rotation={[0, 0.08, 0]}>
            <boxGeometry args={[0.003, 0.004, 0.105]} />
          </mesh>
          <mesh material={materials.gold} position={[-0.052, 0, -0.050]} rotation={[0, -0.08, 0]}>
            <boxGeometry args={[0.003, 0.004, 0.105]} />
          </mesh>
        </group>
      )}

      {/* ب) كاب سناب باك راب معكوس (Backward Snapback Cap) */}
      {cosmetics.snapbackCap && (
        <group position={[0, 0.718, 0.015]} rotation={[-0.08, 0, 0]}>
          {/* قبة الكاب الرئيسية المحيطة بالجمجمة */}
          <mesh material={materials.capFabric} position={[0, 0.02, 0]} scale={[1.04, 0.86, 1.08]}>
            <sphereGeometry args={[0.096, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          </mesh>
          {/* حافة/مظلة الكاب المسطحة المتجهة للخلف (Flat Visor pointing backwards) */}
          <mesh material={materials.capFabric} position={[0, 0.010, -0.115]} rotation={[0.08, 0, 0]}>
            <boxGeometry args={[0.135, 0.006, 0.085]} />
          </mesh>
          {/* فتحة وحزام السناب باك البلاستيكي في الأمام فوق الجبين */}
          <mesh material={materials.tacticalStrap} position={[0, 0.010, 0.096]}>
            <boxGeometry args={[0.045, 0.012, 0.004]} />
          </mesh>
          {/* زر قمة الكاب المعدني (Top Button) */}
          <mesh material={materials.gold} position={[0, 0.098, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.004, 16]} />
          </mesh>
        </group>
      )}

      {/* ج) خوذة قتال تكتيكية عسكرية (Tactical Combat Ballistic Helmet) */}
      {cosmetics.combatHelmet && (
        <group position={[0, 0.725, 0.035]}>
          {/* صدفة الخوذة البالستية المقاومة للرصاص مع قصات الأذن */}
          <mesh material={materials.tacticalBlack} scale={[1.08, 0.95, 1.14]}>
            <sphereGeometry args={[0.100, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          </mesh>
          {/* قاعدة تثبيت منظار الرؤية الليلية الأمامية (NVG Shroud) */}
          <mesh material={materials.weaponMetal} position={[0, 0.045, 0.114]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.038, 0.038, 0.012]} />
          </mesh>
          {/* سكك تثبيت الإكسسوارات الجانبية (ARC Rails) */}
          <mesh material={materials.tacticalStrap} position={[0.108, 0.01, 0.01]} rotation={[0, 0, -0.2]}>
            <boxGeometry args={[0.012, 0.022, 0.095]} />
          </mesh>
          <mesh material={materials.tacticalStrap} position={[-0.108, 0.01, 0.01]} rotation={[0, 0, 0.2]}>
            <boxGeometry args={[0.012, 0.022, 0.095]} />
          </mesh>
          {/* حزام الذقن المحكم (Chin Strap) */}
          <mesh material={materials.tacticalStrap} position={[0, -0.155, 0.065]}>
            <torusGeometry args={[0.085, 0.0035, 8, 24, Math.PI]} />
          </mesh>
        </group>
      )}

      {/* 4. أقنعة ولثام (Masks & Face Covers) */}
      {/* أ) قناع بالافكلافا تكتيكي أسود (Tactical Balaclava) */}
      {cosmetics.balaclava && (
        <group position={[0, 0.655, 0.062]}>
          {/* غطاء الرأس والفك والرقبة المتصل */}
          <mesh material={materials.tacticalBlack} scale={[1.04, 1.16, 1.06]}>
            <sphereGeometry args={[0.092, 24, 18]} />
          </mesh>
          {/* تمدد قماش القناع لأسفل الرقبة */}
          <mesh material={materials.tacticalBlack} position={[0, -0.14, -0.01]}>
            <cylinderGeometry args={[0.078, 0.095, 0.15, 24, 1, true]} />
          </mesh>
          {/* فتحة العينين البيضاوية المقصوصة بدقة تظهر النظرات */}
          <mesh material={materials.weaponMetal} position={[0, 0.020, 0.098]}>
            <ringGeometry args={[0.035, 0.048, 24]} />
          </mesh>
        </group>
      )}

      {/* ب) شماغ ولثام عربي تكتيكي (Tactical Shemagh / Scarf) */}
      {cosmetics.shemagh && (
        <group position={[0, 0.48, 0.040]}>
          {/* طوق قماش الشماغ الملتف حول الرقبة بتعرجات طبيعية */}
          <mesh material={materials.shemaghFabric} rotation={[0.35, 0, 0]}>
            <torusGeometry args={[0.086, 0.034, 16, 32]} />
          </mesh>
          {/* لثام القماش المقوس الذي يغطي الفم والذقن بانسيابية */}
          <mesh material={materials.shemaghFabric} position={[0, 0.115, 0.038]} rotation={[0.15, -Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.078, 0.086, 0.075, 24, 1, false, 0, Math.PI]} />
          </mesh>
          {/* طية الشماغ المثلثية الشهيرة المتدلية على الصدر (Triangle Shemagh Fold) */}
          <mesh material={materials.shemaghFabric} position={[0, -0.075, 0.075]} rotation={[0.45, 0, Math.PI]}>
            <coneGeometry args={[0.085, 0.13, 4]} />
          </mesh>
        </group>
      )}

      {/* 5. حقائب وشنط (Bags & Backpacks) */}
      {/* أ) حقيبة ظهر عسكرية تكتيكية (MOLLE Assault Backpack) */}
      {cosmetics.tacticalBackpack && (
        <group position={[0, 0.31, -0.165]} scale={[1.0, 1.0, 1.0]}>
          {/* المقصورة الرئيسية الكبيرة */}
          <mesh material={materials.tacticalBlack}>
            <boxGeometry args={[0.26, 0.36, 0.12]} />
          </mesh>
          {/* الجيب الخارجي الإضافي مع شرائط موللي */}
          <mesh material={materials.tacticalBlack} position={[0, -0.03, -0.07]}>
            <boxGeometry args={[0.22, 0.24, 0.06]} />
          </mesh>
          {/* خطوط الـ MOLLE التكتيكية على الحقيبة */}
          {[-0.06, 0.0, 0.06].map((yOffset, idx) => (
            <mesh key={idx} material={materials.tacticalStrap} position={[0, yOffset, -0.102]}>
              <boxGeometry args={[0.20, 0.012, 0.005]} />
            </mesh>
          ))}
          {/* مقبض الحمل العلوي للحقيبة */}
          <mesh material={materials.tacticalStrap} position={[0, 0.19, -0.02]}>
            <torusGeometry args={[0.035, 0.006, 8, 16, Math.PI]} />
          </mesh>
        </group>
      )}

      {/* ب) شنطة سرقة بنك قماشية متدلية (Heist Duffle Bag) */}
      {cosmetics.heistDuffleBag && (
        <group position={[0.15, 0.16, -0.06]} rotation={[0.35, 0.20, -0.45]}>
          {/* جسم الشنطة الأسطواني القماشي المحشو بالأموال */}
          <mesh material={materials.tacticalBlack} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.085, 0.085, 0.34, 24]} />
          </mesh>
          {/* سحاب الشنطة الفضي العلوي */}
          <mesh material={materials.silver} position={[0, 0.086, 0]}>
            <boxGeometry args={[0.28, 0.006, 0.012]} />
          </mesh>
          {/* حزام الشنطة الكتفي الملتف عبر الصدر */}
          <mesh material={materials.tacticalStrap} position={[-0.10, 0.14, 0.06]} rotation={[0.4, 0.3, -0.8]}>
            <boxGeometry args={[0.038, 0.01, 0.42]} />
          </mesh>
        </group>
      )}

      {/* 6. بروبات مخصصة ومثبتة على العظام (Custom Prop Attachments) */}
      {cosmetics.propAttached && (
        <group 
          position={[
            cosmetics.propOffsetX || 0, 
            (cosmetics.propOffsetY || 0) + (cosmetics.propBone === 'SKEL_Spine3' ? 0.35 : cosmetics.propBone === 'SKEL_Head' ? 0.70 : -0.10), 
            (cosmetics.propOffsetZ || 0) + (cosmetics.propBone === 'SKEL_Spine3' ? -0.14 : 0.05)
          ]}
          rotation={[
            cosmetics.propRotX || (cosmetics.propType === 'katana' ? 0.2 : 0),
            cosmetics.propRotY || (cosmetics.propType === 'katana' ? 0.4 : 0),
            cosmetics.propRotZ || (cosmetics.propType === 'katana' ? -0.7 : 0)
          ]}
        >
          {/* سيف كاتانا ياباني حربي على الظهر (Back Katana) */}
          {cosmetics.propType === 'katana' && (
            <group scale={[0.9, 0.9, 0.9]}>
              {/* غمد السيف الخشبي الأسود اللامع (Saya) */}
              <mesh material={materials.tacticalBlack}>
                <cylinderGeometry args={[0.014, 0.012, 0.75, 16]} />
              </mesh>
              {/* واقية اليد الدائرية الذهبية (Tsuba) */}
              <mesh material={materials.gold} position={[0, 0.38, 0]}>
                <cylinderGeometry args={[0.038, 0.038, 0.006, 24]} />
              </mesh>
              {/* مقبض الكاتانا المغلف بخيوط الساموراي (Tsuka) */}
              <mesh material={materials.tacticalStrap} position={[0, 0.50, 0]}>
                <cylinderGeometry args={[0.013, 0.014, 0.22, 16]} />
              </mesh>
              {/* قمة المقبض الذهبية (Kashira) */}
              <mesh material={materials.gold} position={[0, 0.615, 0]}>
                <sphereGeometry args={[0.014, 16, 16]} />
              </mesh>
            </group>
          )}

          {/* بندقية هجومية معلقة M4 / AR-15 (Assault Rifle) */}
          {cosmetics.propType === 'assault_rifle' && (
            <group scale={[0.8, 0.8, 0.8]} rotation={[0.4, 0.1, 0.6]}>
              {/* الهيكل الرئيسي للبندقية ومستقبل النار */}
              <mesh material={materials.weaponMetal}>
                <boxGeometry args={[0.035, 0.075, 0.38]} />
              </mesh>
              {/* سبطانة البندقية مع فوهة اللهب */}
              <mesh material={materials.weaponMetal} position={[0, 0.015, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.008, 0.008, 0.28, 16]} />
              </mesh>
              {/* مخزن الذخيرة المقوس 30 طلقة */}
              <mesh material={materials.weaponMetal} position={[0, -0.08, 0.04]} rotation={[-0.3, 0, 0]}>
                <boxGeometry args={[0.024, 0.14, 0.05]} />
              </mesh>
              {/* مقبض الإطلاق والزناد */}
              <mesh material={materials.tacticalBlack} position={[0, -0.065, -0.08]} rotation={[0.35, 0, 0]}>
                <boxGeometry args={[0.026, 0.09, 0.04]} />
              </mesh>
              {/* أخمص البندقية التكتيكي القابل للتعديل (Tactical Stock) */}
              <mesh material={materials.tacticalBlack} position={[0, 0.01, -0.28]}>
                <boxGeometry args={[0.032, 0.11, 0.18]} />
              </mesh>
            </group>
          )}

          {/* مضرب بيسبول حديدي / خشبي (Baseball Bat) */}
          {cosmetics.propType === 'bat' && (
            <group scale={[0.85, 0.85, 0.85]}>
              <mesh material={materials.silver} rotation={[0, 0, 0]}>
                <cylinderGeometry args={[0.028, 0.012, 0.72, 18]} />
              </mesh>
              <mesh material={materials.tacticalStrap} position={[0, -0.28, 0]}>
                <cylinderGeometry args={[0.013, 0.013, 0.18, 16]} />
              </mesh>
            </group>
          )}
        </group>
      )}

      {/* 7. شارة صدر معدنية ثلاثية الأبعاد (3D Police / Agency Badge) */}
      {cosmetics.decalActive && (
        <group 
          position={
            cosmetics.decalPlacement === 'chest_left' ? [0.075, 0.38, 0.090 + chestOffsetZ + (cosmetics.tacticalVest ? 0.025 : 0)] :
            cosmetics.decalPlacement === 'chest_center' ? [0.0, 0.38, 0.094 + chestOffsetZ + (cosmetics.tacticalVest ? 0.025 : 0)] :
            cosmetics.decalPlacement === 'back' ? [0.0, 0.38, -0.112 - (cosmetics.tacticalVest ? 0.025 : 0)] :
            [0.18, 0.36, 0.0]
          }
          rotation={
            cosmetics.decalPlacement === 'back' ? [0, Math.PI, 0] : [0.12, 0, 0]
          }
          scale={[cosmetics.decalScale || 1.0, cosmetics.decalScale || 1.0, cosmetics.decalScale || 1.0]}
        >
          {/* الدرع المعدني الذهبي المقوس ثلاثي الأبعاد */}
          <mesh material={cosmetics.decalMetallic ? materials.gold : materials.tacticalBlack}>
            <cylinderGeometry args={[0.018, 0.022, 0.004, 24]} />
          </mesh>
          {/* نجمة الشرطة / الشعار المفرغ في المنتصف */}
          <mesh material={materials.silver} position={[0, 0.0025, 0]}>
            <cylinderGeometry args={[0.013, 0.013, 0.003, 16]} />
          </mesh>
          <mesh material={materials.gold} position={[0, 0.0045, 0]}>
            <sphereGeometry args={[0.005, 12, 12]} />
          </mesh>
        </group>
      )}
    </group>
  );
}
