import { useState } from 'react';
import type { Difficulty, TimerConfig } from './engine/types';
import { Home } from './ui/Home';
import { LocalGame } from './ui/LocalGame';
import { Online } from './ui/Online';
import { Setup } from './ui/Setup';

export interface LocalConfig {
  mode: 'ai' | 'hotseat';
  names: [string, string];
  difficulty: Difficulty;
  timer: TimerConfig;
  setsToWin: number;
}

type Screen =
  | { name: 'home' }
  | { name: 'setup'; mode: 'ai' | 'hotseat' }
  | { name: 'local'; config: LocalConfig }
  | { name: 'online' };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  return (
    <>
      <div className="grain" aria-hidden="true" />
      {screen.name === 'home' && (
        <Home
          onChoose={(mode) => {
            if (mode === 'online') setScreen({ name: 'online' });
            else setScreen({ name: 'setup', mode });
          }}
        />
      )}
      {screen.name === 'setup' && (
        <Setup
          mode={screen.mode}
          onBack={() => setScreen({ name: 'home' })}
          onStart={(config) => setScreen({ name: 'local', config })}
        />
      )}
      {screen.name === 'local' && <LocalGame config={screen.config} onExit={() => setScreen({ name: 'home' })} />}
      {screen.name === 'online' && <Online onExit={() => setScreen({ name: 'home' })} />}
    </>
  );
}
