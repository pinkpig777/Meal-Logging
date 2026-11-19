import { cssVar, type ChartHue } from './colors';

/**
 * Diagonal stripes in the nutrient hue on the card surface: the "AI estimate"
 * texture. Same hue as the solid "checked" fill, so identity stays the same
 * and the difference survives grayscale and color-vision deficiency
 * (texture, not a second color and not transparency).
 */
export function StripePattern({ id, hue = 'kcal' }: { id: string; hue?: ChartHue }) {
  return (
    <pattern
      id={id}
      width={5}
      height={5}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width={5} height={5} style={{ fill: cssVar('card') }} />
      <rect width={2.5} height={5} style={{ fill: cssVar(hue) }} />
    </pattern>
  );
}
