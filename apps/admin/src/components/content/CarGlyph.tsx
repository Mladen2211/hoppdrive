/**
 * Flat side-view estate car (anthracite body, grey glass): the "Foto folgt" placeholder used in the
 * homepage preview and on the sign page when a vehicle has no photo. Decorative (aria-hidden).
 * Same drawing as the B2C site's CarSilhouette (estate variant), kept local because the admin
 * does not share the web app's UI package.
 *
 * The colours are theme tokens, pinned to the light palette (data-theme="light") because the
 * placeholder tile it sits on (bg-tile) stays light in both themes.
 */
import { cn } from '@/components/ui';

export function CarGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 148"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
      data-theme="light"
      className={cn('block h-auto', className)}
    >
      <ellipse cx="200" cy="135" rx="172" ry="5" fill="rgba(0,0,0,.14)" />
      <path d="M62 39 H228" className="stroke-ink-dark" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path
        d="M14 110 L12 92 L28 52 L46 42 L242 42 L292 76 L364 84 L386 96 L386 110 L334 110 A28 28 0 0 0 278 110 L114 110 A28 28 0 0 0 58 110 Z"
        className="fill-ink"
      />
      <path d="M28 76 L34 53 L92 53 L92 76 Z" className="fill-cool" />
      <path d="M100 76 L100 50 L152 50 L152 76 Z" className="fill-cool" />
      <path d="M160 76 L160 50 L248 50 L281 76 Z" className="fill-cool" />
      <path d="M372 92 L384 95 L384 101 L370 101 Z" className="fill-line" />
      <path d="M13 94 L19 94 L19 103 L13 103 Z" className="fill-ruby" />
      {[86, 306].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="110" r="22" className="fill-ink-dark stroke-graphite" strokeWidth="2" />
          <circle cx={cx} cy="110" r="9.2" className="fill-cool" />
        </g>
      ))}
    </svg>
  );
}
