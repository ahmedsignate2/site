/*
 * Outils de couleur pour garantir la lisibilité (normes WCAG 2.1).
 * Texte courant : contraste ≥ 4,5:1. Grands titres et icônes : ≥ 3:1.
 */

type Rgb = [number, number, number];

export function parseColor(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16)) as Rgb;
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  const rgb = value.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function toHex([r, g, b]: Rgb) {
  return `#${[r, g, b].map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")).join("")}`;
}

function luminance([r, g, b]: Rgb) {
  const channel = (n: number) => {
    const c = n / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string) {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return 21;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function isDark(color: string) {
  const c = parseColor(color);
  return c ? luminance(c) < 0.25 : false;
}

export function mix(a: string, b: string, weightOfB: number) {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return a;
  return toHex(ca.map((v, i) => v + (cb[i] - v) * weightOfB) as Rgb);
}

/** Noir ou blanc, celui qui se lit le mieux sur ce fond. */
export function readableOn(background: string) {
  return contrast("#ffffff", background) >= contrast("#111111", background) ? "#ffffff" : "#111111";
}

/**
 * Garde la teinte choisie si elle est lisible ; sinon la rapproche progressivement
 * du noir ou du blanc jusqu'à atteindre le contraste demandé sur tous les fonds donnés.
 */
export function ensureContrast(color: string, backgrounds: string[], minimum: number) {
  if (!parseColor(color)) return color;
  const worst = (c: string) => Math.min(...backgrounds.map((bg) => contrast(c, bg)));
  if (worst(color) >= minimum) return color;
  const target = readableOn(backgrounds[0]);
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mix(color, target, step / 20);
    if (worst(candidate) >= minimum) return candidate;
  }
  return target;
}
