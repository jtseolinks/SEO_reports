type HashMarkProps = {
  /** Rendered width/height in px. */
  size?: number;
  /** Fill color - accepts any CSS color value, including CSS variables. */
  color?: string;
};

/**
 * The Rankey "#" brand mark - bold and italic with flat-cut ends, matching the
 * company logo glyph. Drawn as four filled, sheared parallelograms (not a font
 * glyph) so it is perfectly centered at any size and renders identically
 * everywhere (sidebar, login, favicon). Centered on a 24×24 viewBox at (12, 12).
 */
export function HashMark({ size = 24, color = "currentColor" }: HashMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      {/* two italic vertical strokes */}
      <polygon points="10.74,3.5 12.74,3.5 7.86,20.5 5.86,20.5" />
      <polygon points="16.14,3.5 18.14,3.5 13.26,20.5 11.26,20.5" />
      {/* two horizontal strokes (sheared to match the italic) */}
      <polygon points="5.56,8.3 20.56,8.3 19.99,10.3 4.99,10.3" />
      <polygon points="4.01,13.7 19.01,13.7 18.44,15.7 3.44,15.7" />
    </svg>
  );
}
