import { useState } from 'react';
import type { Difficulty, GameId, TimerConfig } from './engine/shared';
import type { CharacterId } from './games/abluka/characters';
import { CharacterSelect } from './ui/CharacterSelect';
import { Home } from './ui/Home';
import { LocalGame } from './ui/LocalGame';
import { Online } from './ui/Online';
import { Setup } from './ui/Setup';

export interface LocalConfig {
  gameId: GameId;
  mode: 'ai' | 'hotseat';
  names: [string, string];
  difficulty: Difficulty;
  timer: TimerConfig;
  setsToWin: number;
  characters?: [CharacterId, CharacterId];
}

type Screen =
  | { name: 'home' }
  | { name: 'characters'; mode: 'ai' | 'hotseat' | 'online' }
  | { name: 'setup'; gameId: GameId; mode: 'ai' | 'hotseat'; characters?: [CharacterId, CharacterId] }
  | { name: 'local'; config: LocalConfig }
  | { name: 'online'; gameId: GameId; characterId?: CharacterId };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  return (
    <>
      <div className="grain" aria-hidden="true" />
      {screen.name === 'home' && (
        <Home
          onChoose={(gameId, mode) => {
            if (gameId === 'abluka') {
              setScreen({ name: 'characters', mode });
              return;
            }
            if (mode === 'online') setScreen({ name: 'online', gameId });
            else setScreen({ name: 'setup', gameId, mode });
          }}
        />
      )}
      {screen.name === 'characters' && (
        <CharacterSelect
          mode={screen.mode}
          onBack={() => setScreen({ name: 'home' })}
          onConfirm={(characters) => {
            if (screen.mode === 'online') {
              setScreen({ name: 'online', gameId: 'abluka', characterId: characters[0] });
              return;
            }
            setScreen({ name: 'setup', gameId: 'abluka', mode: screen.mode, characters });
          }}
        />
      )}
      {screen.name === 'setup' && (
        <Setup
          gameId={screen.gameId}
          mode={screen.mode}
          characters={screen.characters}
          onBack={() => {
            if (screen.gameId === 'abluka') setScreen({ name: 'characters', mode: screen.mode });
            else setScreen({ name: 'home' });
          }}
          onStart={(config) => setScreen({ name: 'local', config })}
        />
      )}
      {screen.name === 'local' && <LocalGame config={screen.config} onExit={() => setScreen({ name: 'home' })} />}
      {screen.name === 'online' && (
        <Online
          gameId={screen.gameId}
          characterId={screen.characterId}
          onBack={() => {
            if (screen.gameId === 'abluka') setScreen({ name: 'characters', mode: 'online' });
            else setScreen({ name: 'home' });
          }}
          onExit={() => setScreen({ name: 'home' })}
        />
      )}
    </>
  );
}
