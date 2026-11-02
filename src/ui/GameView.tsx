import { useEffect, useState } from 'react';
import type { ClockView } from '../engine/clock';
import { colorOfPlayer, playerOfColor, pointsForWinner, turnPlayer } from '../engine/match';
import { legalRotations, runCells } from '../engine/rules';
import type { MatchState, PlayerId } from '../engine/types';
import { BoardView } from './Board';
import { colorName, describeMove, describeSet, formatClock, formatPoint, setLabel } from './format';
import { Rules } from './Rules';

export function GameView({
  match,
  names,
  seat,
  thinking,
  spinQ,
  clock,
  connected,
  notice,
  onPlace,
  onRotate,
  onSpinDone,
  onContinue,
  onRematch,
  onExit,
}: {
  match: MatchState;
  names: [string, string];
  seat: PlayerId | null;
  thinking: boolean;
  spinQ: number | null;
  clock: Pick<ClockView, 'config' | 'remaining' | 'active'> | null;
  connected?: [boolean, boolean];
  notice?: string | null;
  onPlace: (r: number, c: number) => void;
  onRotate: (q: number) => void;
  onSpinDone: () => void;
  onContinue: () => void;
  onRematch: () => void;
  onExit: () => void;
}) {
  const [rules, setRules] = useState(false);
  const active = match.status === 'playing' && !match.set.winner ? turnPlayer(match) : null;
  const mine = active != null && (seat == null || seat === active);
  const canAct = mine && !thinking && spinQ == null;
  const canPlace = canAct && match.set.phase === 'place';
  const canRotate = canAct && match.set.phase === 'rotate';
  const lastMove = match.set.moves[match.set.moves.length - 1];
  const last = match.set.phase === 'rotate' ? match.set.pendingPlace : (lastMove?.landed ?? null);
  const highlights =
    match.set.winner && match.set.winner !== 'draw' ? runCells(match.set.board, match.set.winner) : [];

  return (
    <>
    <main className="table">
      <PlayerCard className="seat-0" index={0} match={match} names={names} active={active} clock={clock} connected={connected} />
      <section className="stage">
        <header className="match-head">
          <span>{setLabel(match.setsPlayed, match.status === 'match_over')}</span>
          <strong>
            {formatPoint(match.scores[0])} <i>–</i> {formatPoint(match.scores[1])}
          </strong>
          <span>
            set {match.setWins[0]}–{match.setWins[1]}
          </span>
        </header>
        <div className="status-slot">
          <Lottery match={match} names={names} />
          <p className="hint">{hint(match, names, seat, thinking)}</p>
        </div>
        <BoardView
          board={match.set.board}
          phase={match.set.phase}
          turn={match.set.turn}
          legalQuads={canRotate ? legalRotations(match.set) : []}
          canPlace={canPlace}
          canRotate={canRotate}
          spinQ={spinQ}
          highlights={highlights}
          last={last}
          fresh={match.set.phase === 'rotate' ? match.set.pendingPlace : null}
          onPlace={onPlace}
          onRotate={onRotate}
          onSpinDone={onSpinDone}
        />
        {notice && <p className="notice">{notice}</p>}
        <div className="row tight">
          <button type="button" className="btn ghost" onClick={() => setRules(true)}>
            Kurallar
          </button>
          <button type="button" className="btn ghost" onClick={onExit}>
            Ana sayfa
          </button>
        </div>
      </section>
      <PlayerCard className="seat-1" index={1} match={match} names={names} active={active} clock={clock} connected={connected} />
      <section className="history">
          <h2>Hamleler</h2>
          {match.set.moves.length === 0 ? (
            <p>Bu sette henüz hamle yok.</p>
          ) : (
            <ol>
              {match.set.moves.map((move, index) => (
                <li key={`${move.place.r}${move.place.c}${index}`}>{describeMove(index, move)}</li>
              ))}
            </ol>
          )}
          {match.history.length > 0 && (
            <>
              <h2>Setler</h2>
              <ol>
                {match.history.map((entry, index) => (
                  <li key={index}>
                    Set {index + 1}: {entry.winner === 'draw' ? 'berabere' : names[entry.winnerPlayer ?? 0]} ·{' '}
                    {formatPoint(entry.points[0])}–{formatPoint(entry.points[1])}
                  </li>
                ))}
              </ol>
            </>
          )}
      </section>
    </main>
      {match.status === 'match_over' && match.winner != null && (
        <div className="veil">
          <article className="panel">
            <p className="eyebrow">Maç bitti</p>
            <h2>{names[match.winner]} kazandı</h2>
            <p className="scoreline">
              {formatPoint(match.scores[0])} – {formatPoint(match.scores[1])}
            </p>
            <p>
              {match.setsToWin === 1
                ? 'Seti alan maçı kazandı.'
                : `${match.setsToWin} set alan kazandı. Setler ${match.setWins[0]}–${match.setWins[1]}.`}
            </p>
            <div className="row">
              <button type="button" className="btn ghost" onClick={onExit}>
                Ana sayfa
              </button>
              <button type="button" className="btn primary" onClick={onRematch}>
                Yeniden oyna
              </button>
            </div>
          </article>
        </div>
      )}
      {match.status === 'playing' && match.set.winner && (
        <SetResult match={match} names={names} onContinue={onContinue} />
      )}
      {rules && <Rules onClose={() => setRules(false)} />}
    </>
  );
}

function hint(match: MatchState, names: [string, string], seat: PlayerId | null, thinking: boolean): string {
  if (match.status === 'match_over') return 'Maç bitti.';
  if (match.set.winner) return 'Set kapandı.';
  if (thinking) return 'Bilgisayar düşünüyor.';
  const name = names[turnPlayer(match)];
  if (seat != null && turnPlayer(match) !== seat) return `${name} oynuyor.`;
  if (match.set.phase === 'place') return `${name}, bilyeni boş bir kareye koy.`;
  return `${name}, içinde bilye olan bir parçayı saat yönünde çevir.`;
}

function PlayerCard({
  index,
  match,
  names,
  active,
  clock,
  connected,
  className,
}: {
  className?: string;
  index: PlayerId;
  match: MatchState;
  names: [string, string];
  active: PlayerId | null;
  clock: Pick<ClockView, 'remaining' | 'active'> | null;
  connected?: [boolean, boolean];
}) {
  const color = colorOfPlayer(match, index);
  const ms = clock?.remaining[index];
  const low = active === index && ms != null && ms < 10_000;
  return (
    <article className={`player-card ${className ?? ''}${active === index ? ' on' : ''}`}>
      <span className={`pip ${color}`} />
      <div>
        <strong>{names[index]}</strong>
        <em>
          {colorName(color)}
          {connected && !connected[index] ? ' · bağlantı koptu' : ''}
        </em>
      </div>
      {ms != null && <b className={low ? 'low' : ''}>{formatClock(ms)}</b>}
    </article>
  );
}

function SetResult({
  match,
  names,
  onContinue,
}: {
  match: MatchState;
  names: [string, string];
  onContinue: () => void;
}) {
  const winner = match.set.winner;
  if (!winner || !match.set.reason) return null;
  const gained = pointsForWinner(match, winner);
  const total: [number, number] = [match.scores[0] + gained[0], match.scores[1] + gained[1]];
  const winnerName = winner === 'draw' ? null : names[playerOfColor(match, winner)];
  const setWins: [number, number] = [match.setWins[0], match.setWins[1]];
  if (winner !== 'draw') setWins[playerOfColor(match, winner)] += 1;
  const ends = setWins[0] >= match.setsToWin || setWins[1] >= match.setsToWin;
  return (
    <div className="veil">
      <article className="panel">
        <p className="eyebrow">Set {match.setsPlayed + 1}</p>
        <h2>{winner === 'draw' ? 'Berabere' : `${winnerName} seti aldı`}</h2>
        <p>{describeSet(match.set.reason, winnerName)}</p>
        <p className="scoreline">
          {formatPoint(total[0])} – {formatPoint(total[1])}
        </p>
        <button type="button" className="btn primary" onClick={onContinue}>
          {ends ? 'Sonucu gör' : 'Sonraki set'}
        </button>
      </article>
    </div>
  );
}

function Lottery({ match, names }: { match: MatchState; names: [string, string] }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 3400);
    return () => window.clearTimeout(timer);
  }, [match.setsPlayed, match.blackPlayer]);
  if (!visible || match.set.moves.length > 0 || match.set.winner) return null;
  return <p className="ribbon">Kura sonucu siyah: {names[match.blackPlayer]}. Siyah başlar.</p>;
}
