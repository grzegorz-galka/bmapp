/**
 * Both palettes have to stay legible.
 *
 * The tokens are read out of theme.css and resolved to sRGB here rather than
 * being restated, so a colour darkened by hand in the stylesheet is checked by
 * this test rather than quietly dropping below the threshold.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Read from disk rather than imported: Vite would hand back the processed
// stylesheet, and it is the source tokens that are being audited.
const css = readFileSync(resolve(process.cwd(), 'src/styles/theme.css'), 'utf8');

type Tokens = Map<string, string>;
type Rgb = [number, number, number];

function tokensFor(theme: 'dark' | 'light'): Tokens {
  const block = new RegExp(`html\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`).exec(css);
  const body = block?.[1];
  if (body === undefined) {
    throw new Error(`theme.css declares no block for the ${theme} theme`);
  }
  const tokens: Tokens = new Map();
  for (const line of body.split('\n')) {
    const declaration = /^\s*(--[\w-]+):\s*(.+);\s*$/.exec(line);
    if (declaration?.[1] !== undefined && declaration[2] !== undefined) {
      tokens.set(declaration[1], declaration[2].trim());
    }
  }
  return tokens;
}

function token(tokens: Tokens, name: string): string {
  const value = tokens.get(name);
  if (value === undefined) {
    throw new Error(`theme.css declares no ${name} in this theme`);
  }
  return value;
}

const encode = (channel: number): number =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;

function oklabToRgb(lightness: number, a: number, b: number): Rgb {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear: Rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((value) => encode(Math.min(1, Math.max(0, value))) * 255) as Rgb;
}

function oklchToRgb(lightness: number, chroma: number, hue: number): Rgb {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  return oklabToRgb(lightness, a, b);
}

const decode = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

function rgbToOklab(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgb.map(decode) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * `color-mix(in oklch, front share%, behind)` for opaque colours.
 *
 * Mixed in Oklab, the Cartesian form of the same space, rather than in polar
 * OKLCh: the surfaces are near-grey, so their hue is all but undefined and a
 * polar mix would swing on it. At a tint of 10-12% the two differ by far less
 * than the margin the ink keeps on the result.
 */
function mix(front: string, share: number, behind: string): Rgb {
  const one = rgbToOklab(parse(front).rgb);
  const two = rgbToOklab(parse(behind).rgb);
  const [l, a, b] = one.map((value, index) => value * share + two[index]! * (1 - share));
  return oklabToRgb(l!, a!, b!);
}

/** A colour token resolved to sRGB, plus the alpha it is painted at. */
function parse(value: string): { rgb: Rgb; alpha: number } {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (hex) {
    return {
      rgb: [hex[1], hex[2], hex[3]].map((part) => parseInt(part ?? '0', 16)) as Rgb,
      alpha: 1,
    };
  }
  const oklch = /^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/.exec(value);
  if (oklch) {
    return { rgb: oklchToRgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3])), alpha: 1 };
  }
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value);
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      alpha: Number(rgba[4]),
    };
  }
  throw new Error(`theme.css holds a colour this test cannot read: ${value}`);
}

/** Composite a possibly translucent colour onto an opaque surface. */
function composite(colour: string, surface: string): Rgb {
  const front = parse(colour);
  const behind = parse(surface).rgb;
  return front.rgb.map(
    (channel, index) => channel * front.alpha + behind[index]! * (1 - front.alpha),
  ) as Rgb;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(decode) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: Rgb, background: Rgb): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const INKS = ['--ink', '--ink-2', '--ink-3', '--good', '--warn', '--bad', '--accent'];
const SURFACES = ['--bg', '--panel', '--panel-2'];
const STATUSES = ['--status-green', '--status-amber', '--status-red'];
const PDCA_MARKS = ['--pdca-ring', '--pdca-done'];
const PAIRINGS = SURFACES.flatMap((surface) => INKS.map((ink) => [ink, surface] as const));

describe.each(['dark', 'light'] as const)('the %s theme', (theme) => {
  const tokens = tokensFor(theme);

  it.each(PAIRINGS)('renders %s on %s at 4.5:1 or better', (ink, surface) => {
    const background = token(tokens, surface);

    const ratio = contrast(composite(token(tokens, ink), background), parse(background).rgb);

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SURFACES)('draws control boundaries on %s at 3:1 or better', (surface) => {
    const background = token(tokens, surface);

    const ratio = contrast(
      composite(token(tokens, '--line-control'), background),
      parse(background).rgb,
    );

    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it.each(STATUSES)('shows the %s status mark on every surface at 3:1 or better', (status) => {
    for (const surface of SURFACES) {
      const background = token(tokens, surface);

      const ratio = contrast(composite(token(tokens, status), background), parse(background).rgb);

      expect(ratio, surface).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(PDCA_MARKS)('draws the %s PDCA mark on every surface at 3:1 or better', (mark) => {
    for (const surface of SURFACES) {
      const background = token(tokens, surface);

      const ratio = contrast(composite(token(tokens, mark), background), parse(background).rgb);

      expect(ratio, surface).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(STATUSES)('keeps text on the %s status fill readable', (status) => {
    const ratio = contrast(
      parse(token(tokens, '--on-status')).rgb,
      parse(token(tokens, status)).rgb,
    );

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps text on the solid accent readable', () => {
    const ratio = contrast(
      parse(token(tokens, '--on-accent-solid')).rgb,
      parse(token(tokens, '--accent-solid')).rgb,
    );

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

// The default action is drawn in --accent on the panels a form or a tile sits on.
const DEFAULT_SURFACES = ['--panel', '--panel-2'];

it.each(['dark', 'light'] as const)(
  'The default action is legible in both themes (%s)',
  (theme) => {
    const tokens = tokensFor(theme);
    for (const surface of DEFAULT_SURFACES) {
      const background = token(tokens, surface);

      const ratio = contrast(
        composite(token(tokens, '--accent'), background),
        parse(background).rgb,
      );

      expect(ratio, `caption on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio, `border on ${surface}`).toBeGreaterThanOrEqual(3);
    }
  },
);

it.each(['dark', 'light'] as const)('keeps an action legible on its hover tint (%s)', (theme) => {
  const tokens = tokensFor(theme);
  const share = Number(/^([\d.]+)%$/.exec(token(tokens, '--tint'))?.[1]) / 100;
  const tinted = mix(token(tokens, '--accent'), share, token(tokens, '--panel'));

  const ratio = contrast(parse(token(tokens, '--ink')).rgb, tinted);

  expect(share).toBeGreaterThan(0);
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

it.each(['dark', 'light'] as const)('The colours are shown in colour (%s)', (theme) => {
  // The recording view's status list writes Green, Amber and Red as text in
  // their status colour, so here they are held to the text threshold.
  const tokens = tokensFor(theme);
  for (const status of STATUSES) {
    for (const surface of SURFACES) {
      const background = token(tokens, surface);

      const ratio = contrast(composite(token(tokens, status), background), parse(background).rgb);

      expect(ratio, `${status} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
