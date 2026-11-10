import { chooseMove as chooseAbluka } from './games/abluka/engine/ai';
import type { Board as AblukaBoard, Color, Difficulty } from './games/abluka/engine/types';
import { chooseMove as choosePentago } from './games/pentago/engine/ai';
import type { Board as PentagoBoard } from './games/pentago/engine/types';

type Request =
  | { id: number; gameId: 'pentago'; board: PentagoBoard; turn: Color; difficulty: Difficulty }
  | { id: number; gameId: 'abluka'; board: AblukaBoard; turn: Color; difficulty: Difficulty };

self.onmessage = (event: MessageEvent<Request>) => {
  const data = event.data;
  if (data.gameId === 'abluka') {
    const move = chooseAbluka(data.board, data.turn, data.difficulty);
    self.postMessage({ id: data.id, to: move.to, block: move.block });
    return;
  }
  const move = choosePentago(data.board, data.turn, data.difficulty);
  self.postMessage({ id: data.id, place: move.place, quadrant: move.quadrant });
};
