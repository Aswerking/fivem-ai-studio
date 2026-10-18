// كتالوج سيارات GTA V / FiveM الأصلية (أكواد الرسبنة الرسمية) — مدمجة في اللعبة ولا تحتاج stream
// كل فئة: [اسم عربي, سرعة افتراضية, وزن, دفع, صوت, شكل المعاينة 3D, لون, قائمة الأكواد]
const CLASSES = {
  Super: ['خارقة', 330, 1450, 'AWD', 'zentorno', 'zentorno', '#f97316',
    'adder autarch banshee2 bullet cheetah cyclone deveste emerus entity2 entityxf fmj furia gp1 ignus infernus infernus2 italigtb italigtb2 krieger le7b nero nero2 osiris penetrator pfister811 prototipo reaper s80 sc1 sheava sultanrs t20 taipan tempesta tezeract thrax tigon turismor turismo2 tyrant tyrus vacca vagner visione voltic xa21 zentorno zorrusso torero2 lm87 champion'],
  Sports: ['رياضية', 290, 1450, 'RWD', 'sultanrs', 'elegy2', '#0ea5e9',
    'alpha banshee bestiagts blista2 buffalo buffalo2 buffalo3 calico carbonizzare comet2 comet3 comet4 comet5 comet6 comet7 coquette coquette4 cypher drafter elegy elegy2 euros feltzer2 flashgt furoregt fusilade futo2 growler gb200 hotring imorgon issi7 italigto italirsx jester jester2 jester3 jester4 jugular khamelion komoda kuruma kuruma2 locust lynx massacro massacro2 neo neon ninef ninef2 omnis paragon paragon2 pariah penumbra penumbra2 raiden rapidgt rapidgt2 raptor remus revolter rt3000 ruston schafter3 schafter4 schlagen schwarzer sentinel3 seven70 specter specter2 streiter sugoi sultan sultan2 sultan3 surano tampa2 tropos vectre verlierer2 vstr zr350 zr380 growler corsita sm722 omnisegt'],
  SportsClassic: ['كلاسيك رياضية', 240, 1300, 'RWD', 'elegy2', 'elegy2', '#b91c1c',
    'ardent btype btype2 btype3 casco cheburek cheetah2 coquette2 coquette3 deluxo dynasty fagaloa feltzer3 gt500 infernus2 jb700 jb7002 mamba manana michelli monroe nebula peyote pigalle rapidgt3 retinue retinue2 savestra stinger stingergt swinger torero tornado tornado2 tornado5 turismo2 viseris z190 zion3 ztype toreador'],
  Muscle: ['عضلات', 270, 1750, 'RWD', 'buffalo4', 'buffalo4', '#7c2d12',
    'blade buccaneer buccaneer2 buffalo4 chino chino2 clique coquette3 deviant dominator dominator2 dominator3 dominator4 dominator7 dominator8 dukes dukes2 dukes3 ellie faction faction2 faction3 gauntlet gauntlet2 gauntlet3 gauntlet4 gauntlet5 hermes hotknife hustler impaler impaler2 imperator lurcher moonbeam moonbeam2 nightshade phoenix picador ratloader ratloader2 ruiner ruiner2 sabregt sabregt2 slamvan slamvan2 slamvan3 stalion stalion2 tampa tampa3 tulip vamos vigero vigero2 virgo virgo2 virgo3 voodoo voodoo2 yosemite yosemite2 greenwood weevil2 tahoma broadway eudora'],
  Sedans: ['سيدان', 230, 1600, 'RWD', 'jugular', 'schafter3', '#09090b',
    'asea asterope asterope2 cinquemila cog55 cog552 cognoscenti cognoscenti2 deity emperor emperor2 fugitive glendale glendale2 ingot intruder limo2 premier primo primo2 regina rhinehart romero schafter2 schafter5 schafter6 stafford stanier stratum stretch superd surge tailgater tailgater2 warrener warrener2 washington chavosv6 impaler5'],
  Coupes: ['كوبيه', 250, 1550, 'RWD', 'jugular', 'schafter3', '#334155',
    'cogcabrio exemplar f620 felon felon2 jackal oracle oracle2 previon sentinel sentinel2 windsor windsor2 zion zion2 kanjosj postlude fr36'],
  Compacts: ['صغيرة', 200, 1100, 'FWD', 'sultanrs', 'elegy2', '#16a34a',
    'asbo blista brioso brioso2 brioso3 club dilettante issi2 issi3 kanjo panto prairie rhapsody weevil'],
  SUVs: ['دفع رباعي SUV', 220, 2200, 'AWD', 'jugular', 'dubsta', '#1f2937',
    'astron baller baller2 baller3 baller4 baller5 baller6 baller7 bjxl cavalcade cavalcade2 cavalcade3 contender dubsta dubsta2 fq2 granger granger2 gresley habanero huntley iwagen jubilee landstalker landstalker2 mesa novak patriot patriot2 radi rebla rocoto seminole seminole2 serrano squaddie toros xls xls2 aleutian baller8 castigator dorado vivanite'],
  OffRoad: ['أوف رود', 190, 2100, 'AWD', 'jugular', 'dubsta', '#78350f',
    'bfinjection bifta blazer blazer2 blazer3 blazer4 blazer5 bodhi2 brawler caracara caracara2 dloader draugur dubsta3 dune dune2 everon freecrawler hellion kalahari kamacho marshall mesa3 monster outlaw patriot3 rancherxl rebel rebel2 riata sandking sandking2 trophytruck trophytruck2 vagrant verus winky yosemite3 zhaba terminus ratel l35 boor'],
  Emergency: ['طوارئ وشرطة', 210, 1800, 'RWD', 'police3', 'police3', '#f8fafc',
    'ambulance fbi fbi2 firetruk lguard pbus police police2 police3 police4 policeb policeold1 policeold2 policet pranger riot riot2 sheriff sheriff2 polgauntlet poldorado poldominator10 polgreenwood polimpaler5 polimpaler6'],
  Motorcycles: ['دراجات نارية', 220, 220, 'RWD', 'bati', 'zentorno', '#dc2626',
    'akuma avarus bagger bati bati2 bf400 carbonrs chimera cliffhanger daemon daemon2 defiler diablous diablous2 double enduro esskey faggio faggio2 faggio3 fcr fcr2 gargoyle hakuchou hakuchou2 hexer innovation lectro manchez manchez2 nemesis nightblade pcj ratbike reever ruffian sanchez sanchez2 sanctus shinobi shotaro sovereign stryder thrust vader vindicator vortex wolfsbane zombiea zombieb powersurge'],
  Vans: ['فانات', 160, 2500, 'RWD', 'jugular', 'dubsta', '#e5e7eb',
    'bison bison2 bison3 bobcatxl boxville boxville2 boxville3 boxville4 burrito burrito2 burrito3 burrito4 burrito5 camper gburrito gburrito2 journey minivan minivan2 paradise pony pony2 rumpo rumpo2 rumpo3 speedo speedo2 speedo4 surfer surfer2 taco youga youga2 youga3 youga4'],
  Commercial: ['تجارية', 140, 7000, 'RWD', 'jugular', 'dubsta', '#a16207',
    'benson biff hauler hauler2 mule mule2 mule3 mule4 packer phantom phantom2 phantom3 pounder pounder2 stockade stockade3 terbyte'],
  Industrial: ['صناعية', 110, 9000, 'RWD', 'jugular', 'dubsta', '#ca8a04',
    'bulldozer cutter dump flatbed guardian handler mixer mixer2 rubble tiptruck tiptruck2'],
  Service: ['خدمات', 150, 3000, 'RWD', 'jugular', 'schafter3', '#facc15',
    'airbus brickade bus coach pbus2 rallytruck rentalbus taxi tourbus trash trash2 wastelander'],
  Military: ['عسكرية', 160, 6000, 'AWD', 'jugular', 'dubsta', '#3f6212',
    'apc barracks barracks2 barracks3 barrage chernobog crusader halftrack khanjali minitank rhino scarab thruster trailersmall2 vetir'],
  Utility: ['خدمية', 120, 2000, 'RWD', 'jugular', 'dubsta', '#64748b',
    'airtug caddy caddy2 caddy3 docktug forklift mower ripley sadler sadler2 scrap slamtruck towtruck towtruck2 tractor tractor2 tractor3 utillitruck utillitruck2 utillitruck3'],
  Cycles: ['دراجات هوائية', 50, 15, 'RWD', 'bmx', 'zentorno', '#22c55e',
    'bmx cruiser fixter scorcher tribike tribike2 tribike3'],
  Boats: ['قوارب', 120, 3000, 'RWD', 'jetmax', 'zentorno', '#0284c7',
    'dinghy dinghy2 dinghy3 dinghy4 jetmax longfin marquis predator seashark seashark2 seashark3 speeder speeder2 squalo submersible submersible2 suntrap toro toro2 tropic tropic2 tug avisa kosatka patrolboat'],
  Helicopters: ['هليكوبتر', 250, 5000, 'AWD', 'buzzard', 'zentorno', '#475569',
    'akula annihilator annihilator2 buzzard buzzard2 cargobob cargobob2 frogger frogger2 havok hunter maverick polmav savage seasparrow seasparrow2 skylift supervolito supervolito2 swift swift2 valkyrie volatus conada'],
  Planes: ['طائرات', 400, 9000, 'AWD', 'lazer', 'zentorno', '#94a3b8',
    'alphaz1 avenger besra bombushka cuban800 dodo duster howard hydra jet lazer luxor luxor2 mammatus microlight miljet mogul molotok nimbus nokota pyro rogue seabreeze shamal starling strikeforce stunt titan tula velum velum2 vestra volatol alkonost'],
};

const titleCase = (s) => s.replace(/(\d+)$/, ' $1').replace(/^./, c => c.toUpperCase());

export const VANILLA_CLASSES = Object.entries(CLASSES).map(([id, v]) => ({ id, labelAr: v[0], count: v[7].split(' ').length }));

export const VANILLA_VEHICLES = (() => {
  const seen = new Set();
  const out = [];
  for (const [cls, [labelAr, speed, mass, drive, audio, preset, color, list]] of Object.entries(CLASSES)) {
    for (const spawn of list.split(/\s+/).filter(Boolean)) {
      if (seen.has(spawn)) continue;
      seen.add(spawn);
      out.push({
        name: titleCase(spawn),
        spawn,
        category: cls,
        classAr: labelAr,
        audio: spawn, // الصوت الأصلي للسيارة نفسها
        speed, mass, drivetrain: drive,
        accel: +(speed / 180).toFixed(2),
        brake: 1.2,
        color,
        preset, // شكل المعاينة 3D التقريبي
        rim: 'sport_vossen',
        badge: 'أصلية GTA V',
        desc: `سيارة أصلية مدمجة في اللعبة — تكتب /car ${spawn} مباشرة بدون أي ملفات stream`,
        vanilla: true,
      });
    }
  }
  return out;
})();
