/**
 * CarSilhouette: flat side-view car (anthracite body #3E4144, grey glass,
 * dark wheels) used as the "Foto folgt" placeholder when a vehicle has no
 * photo, and as the hero stand-in. The design rule is: a card without a photo
 * shows a silhouette with a "Foto folgt" label, never an empty box.
 *
 *   <CarSilhouette variant="estate" className="w-[88%]" />
 *   <CarSilhouette variant="suv" title="Beispielbild: SUV von der Seite" />
 *
 * Props:
 *  - variant: 'estate' (Kombi) | 'sedan' (Limousine, default) | 'suv'. Map the API
 *    `type`: estate -> 'estate', suv -> 'suv', everything else -> 'sedan'.
 *  - title: if given, exposes the image to screen readers (role="img"); otherwise it
 *    is decorative (aria-hidden). Put the visible "Foto folgt" label next to it.
 *  - className: size it with width utilities (the SVG keeps its 400:148 ratio).
 */
import { cn } from './cn';

export type CarVariant = 'estate' | 'sedan' | 'suv';

interface CarShape {
  body: string;
  glass: string[];
  wheels: number[];
  wheelY: number;
  wheelR: number;
  rails?: string;
  light: string;
  tail: string;
}

const SHAPES: Record<CarVariant, CarShape> = {
  sedan: {
    body:
      'M16 110 L14 94 L22 86 L88 81 L120 58 L150 41 L248 41 L296 76 L366 83 L386 94 L386 110 L338 110 A28 28 0 0 0 282 110 L120 110 A28 28 0 0 0 64 110 Z',
    glass: ['M110 76 L138 51 L198 51 L198 76 Z', 'M208 76 L208 51 L256 51 L289 76 Z'],
    wheels: [92, 310],
    wheelY: 110,
    wheelR: 22,
    light: 'M372 90 L384 93 L384 99 L370 99 Z',
    tail: 'M15 95 L21 95 L21 104 L15 104 Z',
  },
  estate: {
    body:
      'M14 110 L12 92 L28 52 L46 42 L242 42 L292 76 L364 84 L386 96 L386 110 L334 110 A28 28 0 0 0 278 110 L114 110 A28 28 0 0 0 58 110 Z',
    glass: [
      'M28 76 L34 53 L92 53 L92 76 Z',
      'M100 76 L100 50 L152 50 L152 76 Z',
      'M160 76 L160 50 L248 50 L281 76 Z',
    ],
    wheels: [86, 306],
    wheelY: 110,
    wheelR: 22,
    rails: 'M62 39 H228',
    light: 'M372 92 L384 95 L384 101 L370 101 Z',
    tail: 'M13 94 L19 94 L19 103 L13 103 Z',
  },
  suv: {
    body:
      'M16 114 L14 70 L26 48 L44 36 L238 36 L290 74 L362 82 L386 96 L386 114 L342 114 A33 33 0 0 0 276 114 L130 114 A33 33 0 0 0 64 114 Z',
    glass: [
      'M28 74 L32 50 L112 50 L112 74 Z',
      'M120 74 L120 48 L178 48 L178 74 Z',
      'M186 74 L186 48 L244 48 L282 74 Z',
    ],
    wheels: [97, 309],
    wheelY: 114,
    wheelR: 25,
    rails: 'M54 33 H228',
    light: 'M372 92 L384 95 L384 102 L370 102 Z',
    tail: 'M15 78 L21 78 L21 90 L15 90 Z',
  },
};

export interface CarSilhouetteProps {
  variant?: CarVariant;
  title?: string;
  className?: string;
}

export function CarSilhouette({ variant = 'sedan', title, className }: CarSilhouetteProps) {
  const shape = SHAPES[variant];
  const ground = shape.wheelY + shape.wheelR;
  return (
    <svg
      viewBox="0 0 400 148"
      preserveAspectRatio="xMidYMax meet"
      className={cn('block h-auto', className)}
      focusable="false"
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      <ellipse cx="200" cy={ground + 3} rx="172" ry="5" fill="rgba(0,0,0,.14)" />
      {shape.rails && <path d={shape.rails} stroke="#2C2E30" strokeWidth="3" strokeLinecap="round" fill="none" />}
      <path d={shape.body} fill="#3E4144" />
      {shape.glass.map((d) => (
        <path key={d} d={d} fill="#A0A0A0" />
      ))}
      <path d={shape.light} fill="#DADADA" />
      <path d={shape.tail} fill="#A60E0E" />
      {shape.wheels.map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={shape.wheelY} r={shape.wheelR} fill="#2C2E30" stroke="#5F6265" strokeWidth="2" />
          <circle cx={cx} cy={shape.wheelY} r={shape.wheelR * 0.42} fill="#A0A0A0" />
        </g>
      ))}
    </svg>
  );
}
