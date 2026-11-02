const LINES = [
  'Siyah her setin ilk hamlesini yapar. İlk sette renkler kura ile dağıtılır, sonraki setlerde yer değiştirir.',
  'Boş bir kareye bilyeni koy. Konulan bilye geri alınmaz. Ardından içinde bilye bulunan bir parçayı saat yönünde 90° çevir. Boş parça dönmez.',
  'Yatay, dikey veya çapraz beş ve daha fazla bilye seti bitirir. Kazanan 1, kaybeden 0, beraberlik 0,5 puandır.',
  'Hamle hem senin hem rakibin beşlisini tamamlarsa hamleyi yapan kazanır. Yalnız rakip dizilirse rakip kazanır.',
  'Tahta dolup kimse dizemezse set berabere biter. Maçtan önce kaç set gerektiği seçilir. Varsayılan bir settir; o seti alan maçı alır. Beraberlikte set yenilenir.',
  'Geçmiş hamlelere itiraz edilmez.',
];

export function Rules({ onClose }: { onClose: () => void }) {
  return (
    <div className="veil" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <article className="panel">
        <p className="eyebrow">Turnuva masası</p>
        <h2 id="rules-title">Kurallar</h2>
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
