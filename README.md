# Pentago

6×6 salon masası. Tahta dört adet 3×3 parçaya bölünür. Hamle iki adımdır: boş bir kareye bilye koy, sonra içinde bilye olan bir parçayı saat yönünde 90° çevir. Yatay, dikey veya çapraz beşli seti bitirir.

Canlı masa: [pentago-production.up.railway.app](https://pentago-production.up.railway.app/)

## Nasıl oynanır

Siyah her setin ilk hamlesini yapar. İlk sette renkler kura ile dağılır, sonraki setlerde yer değiştirir. Konulan bilye geri alınmaz. Boş parça dönmez.

Beş veya daha fazla bilye dizilince set biter. Kazanan 1, kaybeden 0, beraberlik 0,5 puan alır. Hamle hem senin hem rakibin beşlisini tamamlarsa hamleyi yapan kazanır. Yalnız rakip dizilirse rakip kazanır. Tahta dolup kimse dizemezse set berabere biter ve yenilenir.

Maçtan önce kaç set gerektiği seçilir. Varsayılan bir settir. Saat kapalı olabilir, hamle süresi tutulabilir ya da toplam süreye Fischer artışı eklenebilir.

## Oyun türleri

- **Bilgisayara karşı.** Kolay, orta veya zor. Arama tarayıcıda ayrı bir iş parçacığında yürür.
- **Aynı ekran.** İki kişi sırayla aynı tahtada oynar.
- **Açık odalar.** Bir oda adı kurarsın. Rakip listedeki ada tıklayınca masaya oturur. Dolu odalar listede görünmez.

## Çalıştırma

```bash
npm install
npm run dev
```

Arayüz `http://localhost:5173` adresinde açılır. Soket sunucusu `3001` portundadır; geliştirme sunucusu `/ws` isteklerini oraya iletir.

```bash
npm test
npm run build
npm start
```

`npm start` derlenmiş arayüzü ve soketi aynı süreçte sunar. Railway bu komutla yayına alır.

Başka bir adreste çalışan sokete bağlanmak için:

```bash
VITE_SOCKET_DOMAIN=pentago-production.up.railway.app
```

Boş bırakılırsa sayfanın kendi adresi kullanılır.
