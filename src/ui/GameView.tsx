import { useEffect, useRef, useState } from 'react';
import type { ClockView } from '../engine/clock';
import type { GameId, PlayerId } from '../engine/shared';
import * as ablukaMatch from '../games/abluka/engine/match';
import { legalBlocks, legalMoves } from '../games/abluka/engine/rules';
import { characterById, type CharacterId } from '../games/abluka/characters';
import type { MatchState as AblukaMatch } from '../games/abluka/engine/types';
import { AblukaBoard } from '../games/abluka/ui/Board';
import { AblukaRules } from '../games/abluka/ui/Rules';
import * as pentagoMatch from '../games/pentago/engine/match';
import { legalRotations, runCells } from '../games/pentago/engine/rules';
import type { EndReason as PentagoEndReason, MatchState as PentagoMatch } from '../games/pentago/engine/types';
import { BoardView } from '../games/pentago/ui/Board';
import { PentagoRules } from '../games/pentago/ui/Rules';
import {
  colorName,
  describeAblukaMove,
  describePentagoMove,
  describePentagoSet,
  formatClock,
  formatPoint,
  setLabel,
} from './format';

type SharedProps = {
  names: [string, string];
  seat: PlayerId | null;
  thinking: boolean;
  clock: Pick<ClockView, 'config' | 'remaining' | 'active'> | null;
  connected?: [boolean, boolean];
  notice?: string | null;
  onContinue: () => void;
  onRematch: () => void;
  onExit: () => void;
};

type Props =
  | (SharedProps & {
      gameId: 'pentago';
      match: PentagoMatch;
      spinQ: number | null;
      onPlace: (r: number, c: number) => void;
      onRotate: (q: number) => void;
      onSpinDone: () => void;
    })
  | (SharedProps & {
      gameId: 'abluka';
      match: AblukaMatch;
      characters?: [CharacterId, CharacterId];
      onCell: (r: number, c: number) => void;
    });

export function GameView(props: Props) {
  const { match, names, seat, thinking, clock, connected, notice, onContinue, onRematch, onExit, gameId } = props;
  const [rules, setRules] = useState(false);
  const advanced = useRef(false);
  const defeat = useRef<HTMLAudioElement | null>(null);
  const victory = useRef<HTMLAudioElement | null>(null);
  const primed = useRef(false);
  const statusBefore = useRef(match.status);
  const oneSetWin =
    match.setsToWin === 1 && match.status === 'playing' && match.set.winner != null && match.set.winner !== 'draw';

  const colorOf = gameId === 'pentago' ? pentagoMatch.colorOfPlayer : ablukaMatch.colorOfPlayer;
  const playerOf = gameId === 'pentago' ? pentagoMatch.playerOfColor : ablukaMatch.playerOfColor;
  const turnOf = gameId === 'pentago' ? pentagoMatch.turnPlayer : ablukaMatch.turnPlayer;
  const pointsFor =
    gameId === 'pentago'
      ? pentagoMatch.pointsForWinner
      : (m: AblukaMatch, winner: NonNullable<AblukaMatch['set']['winner']>) => ablukaMatch.pointsForWinner(m, winner);

  useEffect(() => {
    if (!oneSetWin) {
      advanced.current = false;
      return;
    }
    if (advanced.current) return;
    advanced.current = true;
    onContinue();
  }, [oneSetWin, onContinue]);

  useEffect(() => {
    const loss = new Audio('/yenilgi-sesi.mp3');
    const win = new Audio('/kazandin.ogg');
    loss.preload = 'auto';
    win.preload = 'auto';
    defeat.current = loss;
    victory.current = win;
    const clips = [loss, win];
    const prime = () => {
      if (primed.current) return;
      primed.current = true;
      for (const clip of clips) {
        clip.muted = true;
        void clip
          .play()
          .then(() => {
            if (!clip.muted) return;
            clip.pause();
            clip.currentTime = 0;
            clip.muted = false;
          })
          .catch(() => {
            primed.current = false;
          });
      }
    };
    window.addEventListener('pointerdown', prime);
    return () => {
      window.removeEventListener('pointerdown', prime);
      loss.pause();
      win.pause();
    };
  }, []);

  useEffect(() => {
    const previous = statusBefore.current;
    statusBefore.current = match.status;
    if (previous === 'match_over' || match.status !== 'match_over' || match.winner == null) return;
    const clip = seat === match.winner ? victory.current : defeat.current;
    if (!clip) return;
    clip.muted = false;
    clip.pause();
    clip.currentTime = 0;
    void clip.play().catch(() => {});
  }, [match.status, match.winner, seat]);

  const active = match.status === 'playing' && !match.set.winner ? turnOf(match as never) : null;
  const mine = active != null && (seat == null || seat === active);
  const spinQ = props.gameId === 'pentago' ? props.spinQ : null;
  const canAct = mine && !thinking && spinQ == null;

  return (
    <>
      <main className="table">
        <PlayerCard
          className="seat-0"
          index={0}
          color={colorOf(match as never, 0)}
          names={names}
          active={active}
          clock={clock}
          connected={connected}
          characterId={props.gameId === 'abluka' ? props.characters?.[0] : undefined}
        />
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
            <p className="hint">{hint(gameId, match, names, seat, thinking, turnOf)}</p>
          </div>
          {props.gameId === 'pentago' ? (
            <BoardView
              board={props.match.set.board}
              phase={props.match.set.phase}
              turn={props.match.set.turn}
              legalQuads={canAct && props.match.set.phase === 'rotate' ? legalRotations(props.match.set) : []}
              canPlace={canAct && props.match.set.phase === 'place'}
              canRotate={canAct && props.match.set.phase === 'rotate'}
              spinQ={props.spinQ}
              highlights={
                props.match.set.winner && props.match.set.winner !== 'draw'
                  ? runCells(props.match.set.board, props.match.set.winner)
                  : []
              }
              last={
                props.match.set.phase === 'rotate'
                  ? props.match.set.pendingPlace
                  : (props.match.set.moves[props.match.set.moves.length - 1]?.landed ?? null)
              }
              fresh={props.match.set.phase === 'rotate' ? props.match.set.pendingPlace : null}
              onPlace={props.onPlace}
              onRotate={props.onRotate}
              onSpinDone={props.onSpinDone}
            />
          ) : (
            <AblukaBoard
              board={props.match.set.board}
              phase={props.match.set.phase}
              turn={props.match.set.turn}
              legalTargets={
                !canAct
                  ? []
                  : props.match.set.phase === 'move'
                    ? legalMoves(props.match.set)
                    : legalBlocks(props.match.set)
              }
              canAct={canAct}
              lastFrom={props.match.set.moves[props.match.set.moves.length - 1]?.from ?? null}
              lastTo={props.match.set.moves[props.match.set.moves.length - 1]?.to ?? null}
              lastBlock={props.match.set.moves[props.match.set.moves.length - 1]?.block ?? null}
              pendingTo={props.match.set.pendingTo}
              characters={{
                black: props.characters
                  ? props.characters[props.match.blackPlayer]
                  : null,
                white: props.characters
                  ? props.characters[props.match.blackPlayer === 0 ? 1 : 0]
                  : null,
              }}
              onCell={props.onCell}
            />
          )}
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
        <PlayerCard
          className="seat-1"
          index={1}
          color={colorOf(match as never, 1)}
          names={names}
          active={active}
          clock={clock}
          connected={connected}
          characterId={props.gameId === 'abluka' ? props.characters?.[1] : undefined}
        />
        <section className="history">
          <h2>Hamleler</h2>
          {match.set.moves.length === 0 ? (
            <p>Bu sette henüz hamle yok.</p>
          ) : props.gameId === 'pentago' ? (
            <ol>
              {props.match.set.moves.map((move, index) => (
                <li key={`${move.place.r}${move.place.c}${index}`}>{describePentagoMove(index, move)}</li>
              ))}
            </ol>
          ) : (
            <ol>
              {props.match.set.moves.map((move, index) => (
                <li key={`${move.to.r}${move.to.c}${index}`}>{describeAblukaMove(index, move)}</li>
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
      {match.status === 'match_over' && match.winner != null && gameId === 'abluka' && (
        <AblukaFinale
          winnerName={names[match.winner]}
          winnerCharacterId={props.gameId === 'abluka' ? props.characters?.[match.winner] : undefined}
          youWon={seat != null && seat === match.winner}
          setWins={match.setWins}
          onExit={onExit}
          onRematch={onRematch}
        />
      )}
      {match.status === 'match_over' && match.winner != null && gameId === 'pentago' && (
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
      {match.status === 'playing' && match.set.winner && match.set.winner !== 'draw' && !oneSetWin && (
        <SetResult
          gameId={gameId}
          match={match}
          names={names}
          characters={props.gameId === 'abluka' ? props.characters : undefined}
          seat={seat}
          playerOf={playerOf as never}
          pointsFor={pointsFor as never}
          onContinue={onContinue}
        />
      )}
      {match.status === 'playing' && match.set.winner === 'draw' && !oneSetWin && props.gameId === 'pentago' && (
        <SetResult
          gameId="pentago"
          match={props.match}
          names={names}
          playerOf={pentagoMatch.playerOfColor}
          pointsFor={pentagoMatch.pointsForWinner}
          onContinue={onContinue}
        />
      )}
      {rules && gameId === 'pentago' && <PentagoRules onClose={() => setRules(false)} />}
      {rules && gameId === 'abluka' && <AblukaRules onClose={() => setRules(false)} />}
    </>
  );
}

function hint(
  gameId: GameId,
  match: PentagoMatch | AblukaMatch,
  names: [string, string],
  seat: PlayerId | null,
  thinking: boolean,
  turnOf: (match: never) => PlayerId,
): string {
  if (match.status === 'match_over') return 'Maç bitti.';
  if (match.set.winner) return 'Set kapandı.';
  if (thinking) return 'Bilgisayar düşünüyor.';
  const name = names[turnOf(match as never)];
  if (seat != null && turnOf(match as never) !== seat) return `${name} oynuyor.`;
  if (gameId === 'pentago') {
    const phase = (match as PentagoMatch).set.phase;
    if (phase === 'place') return `${name}, bilyeni boş bir kareye koy.`;
    return `${name}, içinde bilye olan bir parçayı saat yönünde çevir.`;
  }
  const phase = (match as AblukaMatch).set.phase;
  if (phase === 'move') return `${name}, ablukadan kaç — taşını komşu boş kareye kaydır.`;
  return `${name}, boş bir kareye engel koy.`;
}

function PlayerCard({
  index,
  color,
  names,
  active,
  clock,
  connected,
  characterId,
  className,
}: {
  className?: string;
  index: PlayerId;
  color: 'black' | 'white';
  names: [string, string];
  active: PlayerId | null;
  clock: Pick<ClockView, 'remaining' | 'active'> | null;
  connected?: [boolean, boolean];
  characterId?: CharacterId;
}) {
  const ms = clock?.remaining[index];
  const low = active === index && ms != null && ms < 10_000;
  const character = characterById(characterId);
  return (
    <article className={`player-card ${className ?? ''}${active === index ? ' on' : ''}`}>
      {character ? (
        <span className={`pip face ${color}`}>
          <img src={character.src} alt="" />
        </span>
      ) : (
        <span className={`pip ${color}`} />
      )}
      <div>
        <strong>{names[index]}</strong>
        <em>
          {character ? character.name : colorName(color)}
          {connected && !connected[index] ? ' · bağlantı koptu' : ''}
        </em>
      </div>
      {ms != null && <b className={low ? 'low' : ''}>{formatClock(ms)}</b>}
    </article>
  );
}

function SetResult({
  gameId,
  match,
  names,
  characters,
  seat,
  playerOf,
  pointsFor,
  onContinue,
}: {
  gameId: GameId;
  match: PentagoMatch | AblukaMatch;
  names: [string, string];
  characters?: [CharacterId, CharacterId];
  seat?: PlayerId | null;
  playerOf: (match: never, color: 'black' | 'white') => PlayerId;
  pointsFor: (match: never, winner: never) => [number, number];
  onContinue: () => void;
}) {
  const winner = match.set.winner;
  if (!winner || !match.set.reason) return null;
  const gained = pointsFor(match as never, winner as never);
  const total: [number, number] = [match.scores[0] + gained[0], match.scores[1] + gained[1]];
  const winnerPlayer = winner === 'draw' ? null : playerOf(match as never, winner);
  const winnerName = winnerPlayer == null ? null : names[winnerPlayer];
  const setWins: [number, number] = [match.setWins[0], match.setWins[1]];
  if (winnerPlayer != null) setWins[winnerPlayer] += 1;
  const ends = setWins[0] >= match.setsToWin || setWins[1] >= match.setsToWin;
  const youWon = seat != null && winnerPlayer === seat;
  const character = winnerPlayer != null ? characterById(characters?.[winnerPlayer]) : null;

  if (gameId === 'abluka' && winnerName) {
    const line =
      match.set.reason === 'mutual-lock'
        ? youWon
          ? 'Son engel ikinizi de kilitledi — ama hamle senindi!'
          : `${winnerName} son engelle herkesi kilitledi.`
        : match.set.reason === 'timeout'
          ? youWon
            ? 'Rakibin süresi bitti. Tur senin!'
            : `${winnerName} süreyle turu aldı.`
          : youWon
            ? 'Rakibi hareketsiz bıraktın. Abluka tamam!'
            : `${winnerName} rakibi köşeye sıkıştırdı.`;
    return (
      <div className="veil">
        <article className="panel abluka-finale">
          <TrophyIcon />
          {character && <img src={character.src} alt="" className="finale-avatar" />}
          <p className="eyebrow">Set {match.setsPlayed + 1}</p>
          <h2>{youWon ? 'Bu tur senin!' : `${winnerName} turu aldı`}</h2>
          <p>{line}</p>
          <button type="button" className="btn primary" onClick={onContinue}>
            {ends ? 'Kupayı gör' : 'Sonraki tur'}
          </button>
        </article>
      </div>
    );
  }

  const description = describePentagoSet(match.set.reason as PentagoEndReason, winnerName);
  return (
    <div className="veil">
      <article className="panel">
        <p className="eyebrow">Set {match.setsPlayed + 1}</p>
        <h2>{winner === 'draw' ? 'Berabere' : `${winnerName} seti aldı`}</h2>
        <p>{description}</p>
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

function AblukaFinale({
  winnerName,
  winnerCharacterId,
  youWon,
  setWins,
  onExit,
  onRematch,
}: {
  winnerName: string;
  winnerCharacterId?: CharacterId;
  youWon: boolean;
  setWins: [number, number];
  onExit: () => void;
  onRematch: () => void;
}) {
  const character = characterById(winnerCharacterId);
  const title = youWon ? 'Ablukadan kaçtın!' : `${winnerName} ablukadan kaçtı!`;
  const lines = youWon
    ? [
        'Engeller geride kaldı. Yol açık, kupa senin.',
        'Rakip dondu kaldı — sen sıyrıldın.',
        'Kaçış tamam. Abluka kırıldı!',
      ]
    : [
        `${winnerName} engelleri aşıp sıyrıldı.`,
        'Bu tur ablukada kaldın. Bir daha dene!',
        `${character?.name ?? winnerName} kaçtı, sen kaldın.`,
      ];
  const line = lines[(winnerName.length + setWins[0] + setWins[1]) % lines.length];

  return (
    <div className="veil">
      <article className="panel abluka-finale">
        <TrophyIcon />
        {character && <img src={character.src} alt="" className="finale-avatar" />}
        <p className="eyebrow">{youWon ? 'Zafer' : 'Abluka'}</p>
        <h2>{title}</h2>
        <p className="finale-line">{line}</p>
        <div className="row">
          <button type="button" className="btn ghost" onClick={onExit}>
            Ana sayfa
          </button>
          <button type="button" className="btn primary" onClick={onRematch}>
            Tekrar kaç
          </button>
        </div>
      </article>
    </div>
  );
}

function TrophyIcon() {
  return (
    <div className="trophy" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="72" height="72">
        <path
          fill="#f0d7a8"
          d="M18 8h28v6c0 8-5.5 14.5-14 16.5V38h6v4H24v-4h6v-7.5C21.5 28.5 16 22 16 14V8h2zm-6 4h4v6c0 2.8.7 5.3 1.9 7.5C13.6 23.8 10 19.4 10 14v-2h2zm40 0h2v2c0 5.4-3.6 9.8-7.9 11.5 1.2-2.2 1.9-4.7 1.9-7.5v-6z"
        />
        <rect x="22" y="42" width="20" height="4" rx="1" fill="#d7b483" />
        <path fill="#b89055" d="M18 48h28l-3 8H21l-3-8z" />
        <circle cx="32" cy="18" r="3" fill="#fff6e4" opacity="0.55" />
      </svg>
    </div>
  );
}

function Lottery({
  match,
  names,
}: {
  match: PentagoMatch | AblukaMatch;
  names: [string, string];
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 3400);
    return () => window.clearTimeout(timer);
  }, [match.setsPlayed, match.blackPlayer]);
  if (!visible || match.set.moves.length > 0 || match.set.winner) return null;
  return <p className="ribbon">Kura sonucu siyah: {names[match.blackPlayer]}. Siyah başlar.</p>;
}
