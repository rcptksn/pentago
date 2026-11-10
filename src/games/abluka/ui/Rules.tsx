const LINES = [
  'Abluka 7×7 tahtada oynanır. Siyah ve beyaz ana taşlar kendi başlangıç sırasının ortasına konur; siyah başlar.',
  'Her turda önce ana taşını komşu boş bir kareye kaydırırsın (ileri, geri, yan veya çapraz). Taşlar ve engeller üzerinden atlanamaz.',
  'Ardından tahtadaki boş bir kareye kırmızı engel koyarsın. Engel bir daha kalkmaz.',
  'Sırası geldiğinde taşını hareket ettiremeyen oyuncu seti kaybeder. Son hamle her iki taşı da kilitliyorsa son hamleyi yapan kazanır.',
  'İlk sette renkler kura ile dağıtılır, sonraki setlerde yer değiştirir. Maçtan önce kaç set gerektiği seçilir.',
  'Kural dışı hamleler kabul edilmez.',
];

export function AblukaRules({ onClose }: { onClose: () => void }) {
  return (
    <div className="veil" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <article className="panel">
        <p className="eyebrow">Turnuva masası</p>
        <h2 id="rules-title">Abluka kuralları</h2>
        <ul className="rule-list">
          {LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <button type="button" className="btn primary" onClick={onClose}>
          Kapat
        </button>
      </article>
    </div>
  );
}
