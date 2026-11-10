import { useEffect, useRef } from 'react';
import { quadrantOrigin } from '../engine/board';
import type { Board, Color, Coord, Phase } from '../engine/types';
import { QUADRANT_NAMES, squareName } from '../../../ui/format';

const ORIGINS = [0, 1, 2, 3].map((q) => quadrantOrigin(q));

export function BoardView({
  board,
  phase,
  turn,
  legalQuads,
  canPlace,
  canRotate,
  spinQ,
  highlights,
  last,
  fresh,
  onPlace,
  onRotate,
  onSpinDone,
}: {
  board: Board;
  phase: Phase;
  turn: Color;
  legalQuads: number[];
  canPlace: boolean;
  canRotate: boolean;
  spinQ: number | null;
  highlights: Coord[];
  last: Coord | null;
  fresh: Coord | null;
  onPlace: (r: number, c: number) => void;
  onRotate: (q: number) => void;
  onSpinDone: () => void;
}) {
  const onDone = useRef(onSpinDone);
  onDone.current = onSpinDone;

  useEffect(() => {
    if (spinQ == null) return;
    const timer = window.setTimeout(() => onDone.current(), 540);
    return () => window.clearTimeout(timer);
  }, [spinQ]);

  const lit = new Set(highlights.map((cell) => `${cell.r},${cell.c}`));

  return (
    <div className="board-shell">
      <div className="board" role="grid" aria-label="Pentago tahtası">
        {ORIGINS.map((origin, q) => {
          const legal = legalQuads.includes(q);
          return (
            <div
              key={q}
              className={`quadrant${spinQ === q ? ' spinning' : ''}${canRotate && !legal ? ' dim' : ''}${canRotate && legal ? ' legal' : ''}`}
            >
              {Array.from({ length: 9 }, (_, i) => {
                const r = origin.r + Math.floor(i / 3);
                const c = origin.c + (i % 3);
                const cell = board[r][c];
                const win = lit.has(`${r},${c}`);
                const marked = last?.r === r && last?.c === c;
                const dropped = fresh?.r === r && fresh?.c === c;
                const open = canPlace && phase === 'place' && cell === null;
                const inner = (
                  <>
                    {cell && <span className={`marble ${cell}${dropped ? ' fresh' : ''}`} />}
                  </>
                );
                if (open) {
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`cell legal${win ? ' win' : ''}`}
                      aria-label={`${squareName(r, c)} boş, ${turn === 'black' ? 'siyah' : 'beyaz'} bilye koy`}
                      onClick={() => onPlace(r, c)}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <div key={i} className={`cell${win ? ' win' : ''}${marked ? ' last' : ''}`}>
                    {inner}
                  </div>
                );
              })}
              {canRotate && legal && (
                <button
                  type="button"
                  className="spin-hit"
                  aria-label={`${QUADRANT_NAMES[q]} parçayı saat yönünde çevir`}
                  onClick={() => onRotate(q)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
