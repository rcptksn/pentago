import { chooseMove } from './engine/ai';
import type { Board, Color, Difficulty } from './engine/types';

interface Request {
  id: number;
  board: Board;
  turn: Color;
  difficulty: Difficulty;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, board, turn, difficulty } = event.data;
  const move = chooseMove(board, turn, difficulty);
  self.postMessage({ id, place: move.place, quadrant: move.quadrant });
};
