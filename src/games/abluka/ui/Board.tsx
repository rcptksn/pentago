import { characterById, type CharacterId } from '../characters';
import { SIZE } from '../engine/board';
import type { Board, Color, Coord, Phase } from '../engine/types';
import { squareName } from '../../../ui/format';

export function AblukaBoard({
  board,
  phase,
  turn,
  legalTargets,
  canAct,
  lastFrom,
  lastTo,
  lastBlock,
  pendingTo,
  characters,
  onCell,
}: {
  board: Board;
  phase: Phase;
  turn: Color;
  legalTargets: Coord[];
  canAct: boolean;
  lastFrom: Coord | null;
  lastTo: Coord | null;
  lastBlock: Coord | null;
  pendingTo: Coord | null;
  characters?: Partial<Record<Color, CharacterId | null>>;
  onCell: (r: number, c: number) => void;
}) {
  const legal = new Set(legalTargets.map((cell) => `${cell.r},${cell.c}`));

  function token(color: Color, pending: boolean) {
    const character = characterById(characters?.[color] ?? null);
    if (character) {
      return (
        <span className={`abluka-face-wrap ${color}${pending ? ' fresh' : ''}`}>
          <img src={character.src} alt={character.name} className="abluka-face" />
        </span>
      );
    }
    return <span className={`abluka-token ${color}${pending ? ' fresh' : ''}`} />;
  }

  return (
    <div className="board-shell abluka-shell">
      <div className="abluka-board" role="grid" aria-label="Abluka tahtası">
        {Array.from({ length: SIZE }, (_, r) =>
          Array.from({ length: SIZE }, (_, c) => {
            const cell = board[r][c];
            const key = `${r},${c}`;
            const open = canAct && legal.has(key);
            const marked =
              (lastFrom?.r === r && lastFrom?.c === c) ||
              (lastTo?.r === r && lastTo?.c === c) ||
              (lastBlock?.r === r && lastBlock?.c === c);
            const pending = pendingTo?.r === r && pendingTo?.c === c;
            const checker = (r + c) % 2 === 0 ? ' light' : ' dark';
            const hint = open && phase === 'move' ? ' move-hint' : open ? ' block-hint' : '';
            const label =
              phase === 'move'
                ? `${squareName(r, c)}, ${turn === 'black' ? 'siyah' : 'beyaz'} taşı buraya kaydır`
                : `${squareName(r, c)} engel koy`;
            const inner = (
              <>
                {cell === 'black' || cell === 'white' ? token(cell, pending) : null}
                {cell === 'block' ? <span className="abluka-block" /> : null}
              </>
            );
            const className = `abluka-cell${checker}${hint}${marked ? ' last' : ''}`;
            if (open) {
              return (
                <button
                  key={key}
                  type="button"
                  className={className}
                  aria-label={label}
                  onClick={() => onCell(r, c)}
                >
                  {inner}
                </button>
              );
            }
            return (
              <div key={key} className={className}>
                {inner}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
