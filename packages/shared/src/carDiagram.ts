// ─── Car diagram (damage tool + damage report PDF) ───────────────
//
// ONE definition of the five views is used by the admin UI (rendered as <svg>) and by the API (the damage
// report PDF draws the same paths with pdf-lib's drawSvgPath), so the diagram on screen and on paper is
// identical. All paths use absolute M / L / C / Q / Z commands in the view's own coordinate system
// (origin top-left, y down, 1 unit = 1 px of `width` x `height`).
//
// Damage pins are stored as fractions (x, y in 0..1) of the view's width / height, so they stay correct at any
// rendering size: pin position in the SVG = (x * width, y * height).
//
// Rendering hint (SVG):
//   <svg viewBox={`0 0 ${v.width} ${v.height}`}>
//     {v.details.map(d => <path d={d} fill="none" stroke="#9aa" strokeWidth="1" />)}   // windows, doors, lights (light lines)
//     {v.paths.map(d => <path d={d} fill="#f4f4f4" stroke="#222" strokeWidth="1.6" strokeLinejoin="round" />)}  // body + wheels
//   </svg>
// View orientation: 'top' has the front of the car at the top of the image; 'left' is the car seen from its
// left side (front faces left), 'right' from its right side (front faces right).

export type CarDiagramViewKey = 'top' | 'left' | 'right' | 'front' | 'rear';

export interface CarDiagramView {
  width: number;
  height: number;
  /** Outline of the body and the wheels: draw with the main stroke. */
  paths: string[];
  /** Glass, doors, lights, handles: draw as light, thin lines. */
  details: string[];
}

export interface CarDiagram {
  views: Record<CarDiagramViewKey, CarDiagramView>;
}

export const CAR_DIAGRAM: CarDiagram = {
  views: {
    top: {
      width: 180,
      height: 400,
      paths: [
        'M90 8 C124 8 148 18 154 50 C158 74 160 100 161 130 L162 160 L162 300 C162 330 160 350 155 368 C149 386 124 394 90 394 C56 394 31 386 25 368 C20 350 18 330 18 300 L18 160 L19 130 C20 100 22 74 26 50 C32 18 56 8 90 8 Z',
        'M12 66 L16 66 Q20 66 20 70 L20 118 Q20 122 16 122 L12 122 Q8 122 8 118 L8 70 Q8 66 12 66 Z',
        'M164 66 L168 66 Q172 66 172 70 L172 118 Q172 122 168 122 L164 122 Q160 122 160 118 L160 70 Q160 66 164 66 Z',
        'M12 280 L16 280 Q20 280 20 284 L20 332 Q20 336 16 336 L12 336 Q8 336 8 332 L8 284 Q8 280 12 280 Z',
        'M164 280 L168 280 Q172 280 172 284 L172 332 Q172 336 168 336 L164 336 Q160 336 160 332 L160 284 Q160 280 164 280 Z',
      ],
      details: [
        'M40 126 C60 114 120 114 140 126',
        'M42 138 C60 132 120 132 138 138 L128 188 C110 192 70 192 52 188 Z',
        'M52 192 C70 196 110 196 128 192 L128 256 C110 260 70 260 52 256 Z',
        'M52 260 C70 264 110 264 128 260 L138 300 C115 306 65 306 42 300 Z',
        'M38 312 C60 322 120 322 142 312',
        'M30 190 L30 262',
        'M150 190 L150 262',
        'M34 146 L18 142 C14 142 13 150 16 152 L34 158 Z',
        'M146 146 L162 142 C166 142 167 150 164 152 L146 158 Z',
        'M30 34 C44 26 60 22 72 22 L72 34 C60 36 44 40 32 48 Z',
        'M150 34 C136 26 120 22 108 22 L108 34 C120 36 136 40 148 48 Z',
        'M32 356 C48 362 62 364 72 364 L72 374 C58 374 42 370 36 362 Z',
        'M148 356 C132 362 118 364 108 364 L108 374 C122 374 138 370 144 362 Z',
      ],
    },
    left: {
      width: 400,
      height: 160,
      paths: [
        'M24 116 C16 114 12 104 13 92 C14 82 20 77 34 75 L128 64 C150 44 168 30 192 28 L254 28 C286 30 308 50 328 62 L372 68 C382 70 388 78 389 90 C390 102 388 112 380 116 L342 116 C342 98 328 86 310 86 C292 86 278 98 278 116 L122 116 C122 98 108 86 90 86 C72 86 58 98 58 116 Z',
        'M115 118 C115 131.81 103.81 143 90 143 C76.19 143 65 131.81 65 118 C65 104.19 76.19 93 90 93 C103.81 93 115 104.19 115 118 Z',
        'M335 118 C335 131.81 323.81 143 310 143 C296.19 143 285 131.81 285 118 C285 104.19 296.19 93 310 93 C323.81 93 335 104.19 335 118 Z',
      ],
      details: [
        'M138 62 C158 42 172 34 192 33 L218 33 L218 62 Z',
        'M226 33 L254 33 C280 35 298 50 316 62 L226 62 Z',
        'M132 66 L130 112',
        'M222 62 L222 112',
        'M322 64 L324 112',
        'M190 74 L204 74',
        'M250 74 L264 74',
        'M146 62 L136 57 C132 57 131 63 134 64 L146 67 Z',
        'M16 90 C16 84 22 82 34 82 L34 92 L16 96 Z',
        'M388 86 L366 84 L366 94 L388 96 Z',
        'M62 108 L118 108',
        'M282 108 L338 108',
        'M105 118 C105 126.28 98.28 133 90 133 C81.72 133 75 126.28 75 118 C75 109.72 81.72 103 90 103 C98.28 103 105 109.72 105 118 Z',
        'M325 118 C325 126.28 318.28 133 310 133 C301.72 133 295 126.28 295 118 C295 109.72 301.72 103 310 103 C318.28 103 325 109.72 325 118 Z',
        'M94 118 C94 120.21 92.21 122 90 122 C87.79 122 86 120.21 86 118 C86 115.79 87.79 114 90 114 C92.21 114 94 115.79 94 118 Z',
        'M314 118 C314 120.21 312.21 122 310 122 C307.79 122 306 120.21 306 118 C306 115.79 307.79 114 310 114 C312.21 114 314 115.79 314 118 Z',
      ],
    },
    right: {
      width: 400,
      height: 160,
      paths: [
        'M376 116C384 114 388 104 387 92C386 82 380 77 366 75L272 64C250 44 232 30 208 28L146 28C114 30 92 50 72 62L28 68C18 70 12 78 11 90C10 102 12 112 20 116L58 116C58 98 72 86 90 86C108 86 122 98 122 116L278 116C278 98 292 86 310 86C328 86 342 98 342 116Z',
        'M285 118C285 131.81 296.19 143 310 143C323.81 143 335 131.81 335 118C335 104.19 323.81 93 310 93C296.19 93 285 104.19 285 118Z',
        'M65 118C65 131.81 76.19 143 90 143C103.81 143 115 131.81 115 118C115 104.19 103.81 93 90 93C76.19 93 65 104.19 65 118Z',
      ],
      details: [
        'M262 62C242 42 228 34 208 33L182 33L182 62Z',
        'M174 33L146 33C120 35 102 50 84 62L174 62Z',
        'M268 66L270 112',
        'M178 62L178 112',
        'M78 64L76 112',
        'M210 74L196 74',
        'M150 74L136 74',
        'M254 62L264 57C268 57 269 63 266 64L254 67Z',
        'M384 90C384 84 378 82 366 82L366 92L384 96Z',
        'M12 86L34 84L34 94L12 96Z',
        'M338 108L282 108',
        'M118 108L62 108',
        'M295 118C295 126.28 301.72 133 310 133C318.28 133 325 126.28 325 118C325 109.72 318.28 103 310 103C301.72 103 295 109.72 295 118Z',
        'M75 118C75 126.28 81.72 133 90 133C98.28 133 105 126.28 105 118C105 109.72 98.28 103 90 103C81.72 103 75 109.72 75 118Z',
        'M306 118C306 120.21 307.79 122 310 122C312.21 122 314 120.21 314 118C314 115.79 312.21 114 310 114C307.79 114 306 115.79 306 118Z',
        'M86 118C86 120.21 87.79 122 90 122C92.21 122 94 120.21 94 118C94 115.79 92.21 114 90 114C87.79 114 86 115.79 86 118Z',
      ],
    },
    front: {
      width: 200,
      height: 160,
      paths: [
        'M100 24 L66 24 C58 24 54 28 50 40 L42 70 C28 74 20 82 20 94 L20 114 C20 124 26 130 36 130 L164 130 C174 130 180 124 180 114 L180 94 C180 82 172 74 158 70 L150 40 C146 28 142 24 134 24 Z',
        'M18 112 L30 112 Q36 112 36 118 L36 142 Q36 148 30 148 L18 148 Q12 148 12 142 L12 118 Q12 112 18 112 Z',
        'M170 112 L182 112 Q188 112 188 118 L188 142 Q188 148 182 148 L170 148 Q164 148 164 142 L164 118 Q164 112 170 112 Z',
      ],
      details: [
        'M56 68 L62 40 C63 37 66 34 70 34 L130 34 C134 34 137 37 138 40 L144 68 Z',
        'M26 90 C36 86 50 84 62 84 L62 98 C50 100 36 102 26 104 Z',
        'M174 90 C164 86 150 84 138 84 L138 98 C150 100 164 102 174 104 Z',
        'M72 92 L128 92 L128 112 L72 112 Z',
        'M84 114 L116 114 L116 126 L84 126 Z',
        'M42 62 L30 58 C26 58 25 64 28 66 L42 70 Z',
        'M158 62 L170 58 C174 58 175 64 172 66 L158 70 Z',
        'M44 74 C70 80 130 80 156 74',
      ],
    },
    rear: {
      width: 200,
      height: 160,
      paths: [
        'M100 28 L70 28 C62 28 58 32 56 42 L50 70 C34 74 22 82 20 94 L20 114 C20 124 26 130 36 130 L164 130 C174 130 180 124 180 114 L180 94 C178 82 166 74 150 70 L144 42 C142 32 138 28 130 28 Z',
        'M18 112 L30 112 Q36 112 36 118 L36 142 Q36 148 30 148 L18 148 Q12 148 12 142 L12 118 Q12 112 18 112 Z',
        'M170 112 L182 112 Q188 112 188 118 L188 142 Q188 148 182 148 L170 148 Q164 148 164 142 L164 118 Q164 112 170 112 Z',
      ],
      details: [
        'M60 68 L64 44 C65 40 68 38 72 38 L128 38 C132 38 135 40 136 44 L140 68 Z',
        'M24 88 L62 90 L62 104 L24 106 Z',
        'M176 88 L138 90 L138 104 L176 106 Z',
        'M46 74 C70 80 130 80 154 74',
        'M82 98 L118 98 L118 114 L82 114 Z',
        'M30 120 L170 120',
        'M46 66 L34 62 C30 62 29 68 32 70 L46 72 Z',
        'M154 66 L166 62 C170 62 171 68 168 70 L154 72 Z',
      ],
    },
  },
};

/** German view names, in display order. */
export const DAMAGE_VIEW_LABELS: Record<CarDiagramViewKey, string> = {
  top: 'Oben',
  left: 'Links',
  right: 'Rechts',
  front: 'Vorne',
  rear: 'Hinten',
};

/** Colour of the numbered damage pins (ruby), the same in the UI and in the PDF. */
export const DAMAGE_PIN_COLOR = '#9b1b1b';

/**
 * Suggests the body area for a pin placed at (x, y) of a view ("Motorhaube", "Tür vorne links", ...).
 * Only a suggestion for the `zone` text field: the user may type anything.
 */
export function suggestDamageZone(view: CarDiagramViewKey, x: number, y: number): string {
  const px = Math.min(1, Math.max(0, x));
  const py = Math.min(1, Math.max(0, y));
  if (view === 'top') {
    const side = px < 0.3 ? ' links' : px > 0.7 ? ' rechts' : '';
    if (py < 0.08) return 'Stossstange vorne';
    if (py < 0.32) return `Motorhaube${side}`;
    if (py < 0.48) return 'Windschutzscheibe';
    if (py < 0.65) return `Dach${side}`;
    if (py < 0.77) return 'Heckscheibe';
    if (py < 0.92) return `Kofferraum${side}`;
    return 'Stossstange hinten';
  }
  if (view === 'left' || view === 'right') {
    const side = view === 'left' ? 'links' : 'rechts';
    // Orientation: the front of the car is at the left of the 'left' view and at the right of the 'right' view.
    const f = view === 'left' ? px : 1 - px; // 0 = front end, 1 = rear end
    for (const [wx, label] of [[0.225, 'vorne'], [0.775, 'hinten']] as const) {
      if (Math.abs(f - wx) < 0.085 && py > 0.55) return `Felge / Reifen ${label} ${side}`;
    }
    if (py < 0.2 && f > 0.3 && f < 0.82) return 'Dach';
    if (f < 0.07) return 'Stossstange vorne';
    if (f > 0.93) return 'Stossstange hinten';
    if (f < 0.33) return `Kotflügel vorne ${side}`;
    if (f < 0.55) return py < 0.4 ? `Fenster vorne ${side}` : `Tür vorne ${side}`;
    if (f < 0.8) return py < 0.4 ? `Fenster hinten ${side}` : `Tür hinten ${side}`;
    return `Kotflügel hinten ${side}`;
  }
  const front = view === 'front';
  // Seen from the front the car's left side is on the right of the image; seen from behind it is on the left.
  const imgLeft = front ? ' rechts' : ' links';
  const imgRight = front ? ' links' : ' rechts';
  const side = px < 0.3 ? imgLeft : px > 0.7 ? imgRight : '';
  if (py < 0.45) return front ? 'Windschutzscheibe' : 'Heckscheibe';
  if (py < 0.7) return front ? `Motorhaube / Scheinwerfer${side}` : `Kofferraum / Rückleuchte${side}`;
  return front ? 'Stossstange vorne' : 'Stossstange hinten';
}
