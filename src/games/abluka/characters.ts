export type CharacterId =
  | 'recep'
  | 'seyma'
  | 'seyda'
  | 'furkan'
  | 'selim'
  | 'asya'
  | 'komiser'
  | 'trtcocuk'
  | 'ogretmen';

export interface Character {
  id: CharacterId;
  name: string;
  blurb: string;
  traits: string[];
  src: string;
}

export const ABLUKA_CHARACTERS: Character[] = [
  {
    id: 'recep',
    name: 'Recep',
    blurb: 'Net kaçış.',
    traits: ['Soğukkanlı', 'Uzun menzil'],
    src: '/abluka/characters/recep.png',
  },
  {
    id: 'seyma',
    name: 'Şeyma',
    blurb: 'Ani sprint.',
    traits: ['Strateji', 'Çeviklik'],
    src: '/abluka/characters/seyma.png',
  },
  {
    id: 'seyda',
    name: 'Şeyda',
    blurb: 'Tuzak kurar.',
    traits: ['Kurnaz', 'Şanslı adım'],
    src: '/abluka/characters/seyda.png',
  },
  {
    id: 'furkan',
    name: 'Furkan',
    blurb: 'Ablukayı delen.',
    traits: ['Cesur', 'Sürpriz hamle'],
    src: '/abluka/characters/furkan.png',
  },
  {
    id: 'selim',
    name: 'Selim',
    blurb: 'Büyük kaçış.',
    traits: ['Çevik', 'Sessiz kaçış'],
    src: '/abluka/characters/selim.png',
  },
  {
    id: 'asya',
    name: 'Asya',
    blurb: 'Engeli aşar.',
    traits: ['Meraklı', 'Hızlı karar'],
    src: '/abluka/characters/asya.png',
  },
  {
    id: 'komiser',
    name: 'Komiser',
    blurb: 'Sorgu zamanı.',
    traits: ['Keskin bakış', 'Sorgu ustası'],
    src: '/abluka/characters/komiser.png',
  },
  {
    id: 'trtcocuk',
    name: 'TRT Çocuk',
    blurb: 'Ablukayı yıktı.',
    traits: ['Avukat', 'Servis'],
    src: '/abluka/characters/trtcocuk.png',
  },
  {
    id: 'ogretmen',
    name: 'Öğretmen',
    blurb: 'Ders zamanı.',
    traits: ['Bilge', 'Disiplin'],
    src: '/abluka/characters/ogretmen.png',
  },
];

export function characterById(id: CharacterId | string | null | undefined): Character | null {
  if (!id) return null;
  return ABLUKA_CHARACTERS.find((item) => item.id === id) ?? null;
}

export function sanitizeCharacterId(value: unknown, fallback: CharacterId = 'recep'): CharacterId {
  if (typeof value === 'string' && ABLUKA_CHARACTERS.some((item) => item.id === value)) {
    return value as CharacterId;
  }
  return fallback;
}

export function pickOtherCharacter(taken: CharacterId, rng: () => number = Math.random): CharacterId {
  const pool = ABLUKA_CHARACTERS.filter((item) => item.id !== taken);
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))].id;
}
