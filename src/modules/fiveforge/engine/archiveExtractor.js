/**
 * Extract entries from ZIP / RAR archives in the browser.
 */

import JSZip from 'jszip';

let rarWasmBinaryPromise = null;

async function loadRarWasmBinary() {
  if (rarWasmBinaryPromise) return rarWasmBinaryPromise;
  rarWasmBinaryPromise = (async () => {
    const base = (import.meta.env && import.meta.env.BASE_URL) || './';
    const relative = `${base}${base.endsWith('/') ? '' : '/'}unrar.wasm`.replace(/([^:]\/)\/+/g, '$1');
    const url = typeof window !== 'undefined'
      ? new URL(relative, window.location.href).href
      : relative;
    const res = await fetch(url);
    if (!res.ok) throw new Error('تعذر تحميل محرك فك الـ RAR (unrar.wasm)');
    return res.arrayBuffer();
  })();
  return rarWasmBinaryPromise;
}

/**
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<Array<{ name: string, data: Uint8Array }>>}
 */
export async function extractZipEntries(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const entries = [];
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    const data = await entry.async('uint8array');
    entries.push({ name, data });
  }
  return entries;
}

/**
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<Array<{ name: string, data: Uint8Array }>>}
 */
export async function extractRarEntries(arrayBuffer) {
  // Use package main (CJS interop) — ESM build has extensionless imports that break in Node/Vite.
  const unrar = await import('node-unrar-js');
  const createExtractorFromData = unrar.createExtractorFromData || unrar.default?.createExtractorFromData;
  if (!createExtractorFromData) throw new Error('محرك RAR غير متوفر');
  const wasmBinary = await loadRarWasmBinary();
  const extractor = await createExtractorFromData({ data: arrayBuffer, wasmBinary });
  const headers = [...extractor.getFileList().fileHeaders].filter((h) => !h.flags?.directory);
  const extracted = [...extractor.extract({ files: headers.map((h) => h.name) }).files];
  return extracted
    .filter((f) => f.extraction)
    .map((f) => ({
      name: f.fileHeader.name,
      data: f.extraction instanceof Uint8Array ? f.extraction : new Uint8Array(f.extraction)
    }));
}

/**
 * @param {string} fileName
 * @param {ArrayBuffer} arrayBuffer
 */
export async function extractArchiveEntries(fileName, arrayBuffer) {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.zip')) return extractZipEntries(arrayBuffer);
  if (lower.endsWith('.rar')) return extractRarEntries(arrayBuffer);
  throw new Error('صيغة الأرشيف غير مدعومة — استخدم .ZIP أو .RAR');
}
