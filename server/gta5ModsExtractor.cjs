/**
 * FiveForge Studio — Live GTA5-Mods.com Downloader & RPF7/YFT/YTD Extractor
 * Supports fetching any vehicle mod page or search query from gta5-mods.com,
 * downloading its archive (.zip / .rar / .7z), unpacking nested OpenIV RPF7 archives
 * (dlc.rpf -> x64/vehicles.rpf), and extracting the real .yft 3D model, .ytd textures, and .meta files.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const JSZip = require('jszip');

const CACHE_ROOT = path.join(process.cwd(), '.cache', 'gta5mods');

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

/**
 * Recursively parses an unencrypted RPF7 archive buffer (dlc.rpf, vehicles.rpf, etc.)
 */
function parseRpf7Buffer(u8, parentPath = '') {
  if (!u8 || u8.byteLength < 16) return [];
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== 0x52504637) return []; // 'RPF7'

  const entryCount = view.getUint32(4, true);
  const entriesOffset = 16;
  const namesOffset = entriesOffset + entryCount * 16;

  const readName = (noff) => {
    let end = namesOffset + noff;
    while (end < u8.length && u8[end] !== 0) end++;
    return Buffer.from(u8.subarray(namesOffset + noff, end)).toString('utf8');
  };

  const rawEntries = [];
  for (let i = 0; i < entryCount; i++) {
    const off = entriesOffset + i * 16;
    if (off + 16 > u8.length) break;
    const v0 = view.getUint32(off, true);
    const v1 = view.getUint32(off + 4, true);
    const v2 = view.getUint32(off + 8, true);
    const v3 = view.getUint32(off + 12, true);
    if (v1 === 0x7fffff00) {
      rawEntries.push({
        isDir: true,
        name: readName(v0 & 0xffff),
        entriesIndex: v2,
        entriesCount: v3
      });
    } else {
      rawEntries.push({
        isDir: false,
        name: readName(v0 & 0xffff),
        compSize: (v0 >>> 16) | ((v1 & 0xff) << 16),
        byteOffset: ((v1 >>> 8) & 0x7fffff) * 512,
        isResource: ((v1 >>> 31) & 1) === 1,
        v2,
        v3
      });
    }
  }

  const results = [];
  function walk(dirIdx, prefix) {
    const dir = rawEntries[dirIdx];
    if (!dir || !dir.isDir) return;
    for (let i = 0; i < dir.entriesCount; i++) {
      const e = rawEntries[dir.entriesIndex + i];
      if (!e) continue;
      const fullPath = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDir) {
        walk(dir.entriesIndex + i, fullPath);
      } else {
        let data;
        if (e.isResource) {
          let realSize = e.compSize;
          if (realSize === 0xffffff || realSize === 0) {
            realSize = u8.length - e.byteOffset;
          }
          const rawSlice = u8.subarray(e.byteOffset, Math.min(u8.length, e.byteOffset + realSize));
          const rsc7 = new Uint8Array(rawSlice.length);
          rsc7.set(rawSlice);
          rsc7[0] = 0x52;
          rsc7[1] = 0x53;
          rsc7[2] = 0x43;
          rsc7[3] = 0x37;
          const rView = new DataView(rsc7.buffer);
          const version = (((e.v3 >>> 28) & 0xf) << 4) | ((e.v2 >>> 28) & 0xf);
          rView.setUint32(4, version, true);
          rView.setUint32(8, e.v2, true);
          rView.setUint32(12, e.v3, true);
          data = rsc7;
        } else {
          const isCompressed = e.compSize !== 0;
          const sliceSize = isCompressed ? e.compSize : e.v2;
          const rawSlice = u8.subarray(e.byteOffset, Math.min(u8.length, e.byteOffset + sliceSize));
          if (isCompressed) {
            try {
              data = new Uint8Array(zlib.inflateRawSync(rawSlice));
            } catch {
              data = rawSlice;
            }
          } else {
            data = rawSlice;
          }
        }

        if (e.name.toLowerCase().endsWith('.rpf') && data && data.length > 16) {
          results.push(...parseRpf7Buffer(data, fullPath));
        } else if (data) {
          results.push({
            path: fullPath,
            name: e.name,
            isResource: e.isResource,
            data
          });
        }
      }
    }
  }

  walk(0, parentPath);
  return results;
}

/**
 * Given a list of raw files [{ path, name, data }], unpacks any .rpf files and picks the best vehicle .yft, .ytd, and .meta files
 */
function selectBestVehicleAssetsFromFiles(rawFiles) {
  const allFiles = [];
  for (const f of rawFiles) {
    if (f.name.toLowerCase().endsWith('.rpf') && f.data && f.data.length > 16) {
      const unpacked = parseRpf7Buffer(f.data, f.path);
      allFiles.push(...unpacked);
    } else {
      allFiles.push(f);
    }
  }

  const yftFiles = allFiles.filter(
    (f) =>
      f.name.toLowerCase().endsWith('.yft') &&
      !f.path.toLowerCase().includes('vehiclemods') &&
      f.data.length > 50 * 1024
  );
  const ytdFiles = allFiles.filter(
    (f) => f.name.toLowerCase().endsWith('.ytd') && f.data.length > 4 * 1024
  );
  const metaFiles = allFiles.filter((f) => /\.(meta|xml)$/i.test(f.name));

  // Prefer *_hi.yft with the largest byte size
  const hiYfts = yftFiles.filter((f) => f.name.toLowerCase().endsWith('_hi.yft'));
  const candidateYfts = hiYfts.length > 0 ? hiYfts : yftFiles;
  candidateYfts.sort((a, b) => b.data.length - a.data.length);
  const bestYft = candidateYfts[0] || null;

  let spawnCode = 'customcar';
  if (bestYft) {
    spawnCode = bestYft.name.toLowerCase().replace(/(_hi)?\.yft$/i, '');
  }

  // Find matching .ytd for spawnCode, or largest .ytd
  let bestYtd =
    ytdFiles.find((f) => f.name.toLowerCase() === `${spawnCode}.ytd`) ||
    ytdFiles.find((f) => f.name.toLowerCase() === `${spawnCode}+hi.ytd`) ||
    null;
  if (!bestYtd && ytdFiles.length > 0) {
    const sortedYtds = [...ytdFiles].sort((a, b) => b.data.length - a.data.length);
    bestYtd = sortedYtds[0];
  }

  // Extract metadata from vehicles.meta & handling.meta if available
  const metaSummary = {
    spawnCode,
    gameName: spawnCode.toUpperCase(),
    audioHash: 'sultanrs',
    vehicleClass: 'VC_SPORT'
  };

  for (const m of metaFiles) {
    try {
      const text = Buffer.from(m.data).toString('utf8');
      if (text.includes('<CVehicleModelInfo__InitDataList')) {
        const modelMatch = text.match(/<modelName>\s*([^<\s]+)\s*<\/modelName>/i);
        const gameMatch = text.match(/<gameName>\s*([^<]+)\s*<\/gameName>/i);
        const audioMatch = text.match(/<audioNameHash>\s*([^<\s]+)\s*<\/audioNameHash>/i);
        if (modelMatch?.[1]) metaSummary.spawnCode = modelMatch[1].trim().toLowerCase();
        if (gameMatch?.[1]) metaSummary.gameName = gameMatch[1].trim();
        if (audioMatch?.[1] && audioMatch[1].trim().toLowerCase() !== 'null') {
          metaSummary.audioHash = audioMatch[1].trim().toLowerCase();
        }
      }
    } catch {}
  }

  return {
    bestYft,
    bestYtd,
    metaSummary,
    totalYftCount: yftFiles.length,
    totalYtdCount: ytdFiles.length,
    totalMetaCount: metaFiles.length
  };
}

/**
 * Resolves a gta5-mods.com URL or search query to a valid vehicle page HTML & URL
 */
async function resolveGta5ModsVehiclePage(urlOrQuery) {
  const input = (urlOrQuery || '').trim();
  let targetUrl = input;

  const extractDownloadFromHtml = (html, pageUrl) => {
    const dlMatch = html.match(/href="(\/vehicles\/[^"]+\/download\/\d+)"/i);
    if (!dlMatch) return null;
    const titleMatch =
      html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
      html.match(/<title>([^<]+)<\/title>/i);
    const imgMatch = html.match(/https:\/\/img\.gta5-mods\.com\/[^\s"']+\.(?:jpg|png|webp)/i);
    const rawTitle = (titleMatch?.[1] || '')
      .replace(/\s*-\s*GTA5-Mods\.com.*$/i, '')
      .replace(/\[Add-On[^\]]*\]/gi, '')
      .trim();
    return {
      pageUrl,
      downloadPath: dlMatch[1],
      title: rawTitle || 'GTA5-Mods Vehicle',
      previewImage: imgMatch?.[0] || null
    };
  };

  // 1. If input is already a direct gta5-mods.com/vehicles/... URL, try fetching it directly first
  if (/^https?:\/\/(www\.|ar\.|de\.|fr\.|es\.)?gta5-mods\.com\/vehicles\//i.test(input)) {
    const normalizedUrl = input.replace(/^https?:\/\/[^/]+/i, 'https://www.gta5-mods.com');
    try {
      const res = await fetch(normalizedUrl, { headers: BROWSER_HEADERS });
      if (res.ok) {
        const html = await res.text();
        const info = extractDownloadFromHtml(html, normalizedUrl);
        if (info) return info;
      }
    } catch {}
  }

  // 2. Fallback: Extract keywords from the URL slug or query and search gta5-mods.com/search/...
  const rawSlug = input
    .replace(/^https?:\/\/[^/]+\/vehicles\//i, '')
    .replace(/\/download\/.*$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\b(add|on|addon|template|tuning|replace|fivem|lods|vehfuncs|vehfuncsv|sound|sounds|pack)\b/gi, ' ')
    .trim();

  // Try full keywords first, then strip 4-digit year if needed (e.g. 2001 Ferrari 550 Barchetta -> Ferrari 550 Barchetta)
  const queriesToTry = [
    rawSlug,
    rawSlug.replace(/\b(19|20)\d{2}\b/g, '').trim(),
    rawSlug.split(/\s+/).slice(0, 3).join(' ')
  ].filter(Boolean);

  for (const q of [...new Set(queriesToTry)]) {
    const searchUrl = `https://www.gta5-mods.com/search/${encodeURIComponent(q).replace(/%20/g, '+')}`;
    try {
      const sRes = await fetch(searchUrl, { headers: BROWSER_HEADERS });
      if (!sRes.ok) continue;
      const sHtml = await sRes.text();
      const vLinks = [...sHtml.matchAll(/href="(\/vehicles\/[^"#?]+)"/gi)]
        .map((m) => m[1])
        .filter((l) => !l.includes('/download/') && !l.startsWith('/vehicles/tags'));
      if (vLinks.length > 0) {
        const candidateUrl = `https://www.gta5-mods.com${vLinks[0]}`;
        const vRes = await fetch(candidateUrl, { headers: BROWSER_HEADERS });
        if (vRes.ok) {
          const vHtml = await vRes.text();
          const info = extractDownloadFromHtml(vHtml, candidateUrl);
          if (info) return info;
        }
      }
    } catch {}
  }

  throw new Error(`تعذر العثور على صفحة تحميل السيارة في gta5-mods للرابط/البحث: ${input}`);
}

/**
 * Downloads & extracts a vehicle from gta5-mods.com (with disk caching in .cache/gta5mods/<slug>)
 */
async function fetchAndExtractGta5ModsCar(urlOrQuery) {
  const pageInfo = await resolveGta5ModsVehiclePage(urlOrQuery);
  const slug = pageInfo.pageUrl.split('/vehicles/')[1]?.split('/')[0]?.replace(/[^a-z0-9_-]/gi, '_') || 'mod_car';
  const cacheDir = path.join(CACHE_ROOT, slug);
  const cachedYftPath = path.join(cacheDir, 'model.yft');
  const cachedYtdPath = path.join(cacheDir, 'textures.ytd');
  const cachedMetaPath = path.join(cacheDir, 'meta.json');

  if (fs.existsSync(cachedYftPath) && fs.existsSync(cachedMetaPath)) {
    const meta = JSON.parse(fs.readFileSync(cachedMetaPath, 'utf8'));
    return {
      ...meta,
      slug,
      cached: true,
      yftPath: cachedYftPath,
      ytdPath: fs.existsSync(cachedYtdPath) ? cachedYtdPath : null
    };
  }

  // Fetch download page to get direct files.gta5-mods.com URL
  const dlPageUrl = `https://www.gta5-mods.com${pageInfo.downloadPath}`;
  const dlPageRes = await fetch(dlPageUrl, {
    headers: { ...BROWSER_HEADERS, Referer: pageInfo.pageUrl }
  });
  const dlPageHtml = await dlPageRes.text();
  const fileUrlMatch = dlPageHtml.match(/href="(https:\/\/files\.gta5-mods\.com\/[^"]+)"/i);
  if (!fileUrlMatch?.[1]) {
    throw new Error('تعذر استخراج رابط الملف المباشر من صفحة التحميل في gta5-mods.com');
  }

  const directFileUrl = fileUrlMatch[1];
  const fileRes = await fetch(directFileUrl, { headers: BROWSER_HEADERS });
  if (!fileRes.ok) {
    throw new Error(`فشل تحميل أرشيف السيارة (${fileRes.status})`);
  }

  const archiveBuf = Buffer.from(await fileRes.arrayBuffer());
  fs.mkdirSync(cacheDir, { recursive: true });

  const rawFiles = [];
  const lowerUrl = decodeURIComponent(directFileUrl).toLowerCase();

  if (lowerUrl.endsWith('.zip') || (archiveBuf[0] === 0x50 && archiveBuf[1] === 0x4b)) {
    const zip = await JSZip.loadAsync(archiveBuf);
    const entries = Object.values(zip.files).filter((e) => !e.dir);
    for (const entry of entries) {
      const data = await entry.async('uint8array');
      rawFiles.push({
        path: entry.name,
        name: path.basename(entry.name),
        data
      });
    }
  } else {
    // Extract .rar / .7z / archive using Windows built-in bsdtar (tar.exe)
    const ext = lowerUrl.endsWith('.7z') ? '.7z' : '.rar';
    const tmpArchive = path.join(cacheDir, `archive${ext}`);
    const extractDir = path.join(cacheDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });
    fs.writeFileSync(tmpArchive, archiveBuf);
    try {
      execFileSync('tar', ['-xf', tmpArchive, '-C', extractDir]);
    } catch (err) {
      throw new Error(`تعذر فك ضغط الأرشيف (${ext}): ${err.message}`);
    }

    const walkFs = (dir, rel = '') => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        const rPath = rel ? `${rel}/${ent.name}` : ent.name;
        if (ent.isDirectory()) walkFs(full, rPath);
        else {
          rawFiles.push({
            path: rPath,
            name: ent.name,
            data: new Uint8Array(fs.readFileSync(full))
          });
        }
      }
    };
    walkFs(extractDir);
  }

  const selected = selectBestVehicleAssetsFromFiles(rawFiles);
  if (!selected.bestYft) {
    throw new Error('لم يتم العثور على ملف مجسم سيارة (.yft) داخل أرشيف المود');
  }

  fs.writeFileSync(cachedYftPath, Buffer.from(selected.bestYft.data));
  if (selected.bestYtd) {
    fs.writeFileSync(cachedYtdPath, Buffer.from(selected.bestYtd.data));
  }

  const metadata = {
    slug,
    title: pageInfo.title,
    pageUrl: pageInfo.pageUrl,
    previewImage: pageInfo.previewImage,
    spawnCode: selected.metaSummary.spawnCode,
    gameName: selected.metaSummary.gameName || pageInfo.title,
    audioHash: selected.metaSummary.audioHash,
    yftFileName: selected.bestYft.name,
    ytdFileName: selected.bestYtd?.name || null,
    yftSize: selected.bestYft.data.length,
    ytdSize: selected.bestYtd?.data.length || 0
  };
  fs.writeFileSync(cachedMetaPath, JSON.stringify(metadata, null, 2));

  return {
    ...metadata,
    cached: false,
    yftPath: cachedYftPath,
    ytdPath: selected.bestYtd ? cachedYtdPath : null
  };
}

module.exports = {
  CACHE_ROOT,
  parseRpf7Buffer,
  selectBestVehicleAssetsFromFiles,
  fetchAndExtractGta5ModsCar
};
