/**
 * Vehicle card thumbnails — FiveM docs webp + local colored fallback.
 */

const SPAWN_ALIASES = {
  '00barch': 'turismo2',
  g63: 'dubsta3',
  amggtr: 'revolter'
};

function svgFallback(label = 'CAR', color = '#334155') {
  const safe = String(label || 'CAR').slice(0, 10).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="#0a0a0c"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="#0b0b0f"/>
  <rect x="40" y="40" width="560" height="280" rx="28" fill="url(#g)" opacity="0.9"/>
  <ellipse cx="180" cy="250" rx="48" ry="48" fill="#111827"/>
  <ellipse cx="460" cy="250" rx="48" ry="48" fill="#111827"/>
  <path d="M110 220 L170 140 H420 L530 220 Z" fill="#e5e7eb" opacity="0.18"/>
  <text x="320" y="120" text-anchor="middle" fill="#f8fafc" font-family="Arial,sans-serif" font-size="42" font-weight="700">${safe}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getVehicleThumbUrl(spawn, color = '#334155') {
  const raw = String(spawn || '').toLowerCase().trim();
  const cleaned = raw.replace(/[^a-z0-9_]/g, '');
  if (!cleaned) return svgFallback('CAR', color);
  const code = SPAWN_ALIASES[cleaned] || cleaned;
  return `https://docs.fivem.net/vehicles/${code}.webp`;
}

export function getVehicleThumbFallback(spawn, color = '#334155') {
  return svgFallback(spawn || 'CAR', color);
}
