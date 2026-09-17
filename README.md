# Parçacık Hızlandırma & Işınlama Simülatörü

PhET Colorado tarzı, ama tek bir alana odaklandığı için çok daha derin bir web
simülatörü: yüksek gerilim üretimi → parçacık hızlandırma → hedefle etkileşim →
ikincil ışınım, nükleer dönüşüm ve biyolojik etki.

Üç bölümlü bir tezgâh:

1. **Elektrik kaynağı** — Van de Graaff, Marx jeneratörü, Cockcroft–Walton
   merdiveni, doğrusal hızlandırıcı, siklotron/sinkrotron. Komponentler doğru
   çizilir ve doğru bağlanır; voltaj, akım, frekans, manyetik alan ayarlanabilir.
2. **Etkileşim hücresi** — hedef elementi, tüp ortamı (vakum / hava / Ar / SF₆),
   basınç, anot ve katot malzemesi seçilir. Plazma, bremsstrahlung X-ışını,
   akkor ve erime, eşik üstünde fotonötron üretimi.
3. **Sonuç** — ikincil parçacıklar ikinci bir hedefe çarpar: nükleer dönüşüm
   zincirleri (Th-232 → U-233), aktivasyon, doz ve hücresel hasar.

## Durum

- **Aşama 1 — fizik çekirdeği:** `src/physics/` saf TypeScript'tir: React,
  three.js veya DOM bilmez, Node'da test edilir, tarayıcıda Web Worker içinde
  koşar. `tests/purity.test.ts` bu sınırı bekçi test olarak korur.
- **Aşama 2 — tezgâh (şematik katman):** PhET tarzı sürükle-bırak palet,
  tipli portlar arasında kablolama, seçili cihaz için otomatik üretilen
  kontrol dock'u, Bohr modelli mikro görünüm ve nüklid etiketleme
  (`Be-9 → Be-8`, `Th-232 → Th-233`). Tasarım: `docs/DESIGN.md`.
- Sırada: three.js sahne katmanı (sabit kamera, bloom, demet parçacıkları,
  ark), LINAC/siklotron/Marx/Cockcroft–Walton cihazları.

## Kurulum

Node.js 20+ gerekir.

```
npm install
npm test        # fizik altın testleri
npm run dev     # geliştirme sunucusu
```

## Fizik doğruluğu

Her fizik fonksiyonu `docs/PHYSICS.md` içindeki bir denkleme referans verir ve
yayımlanmış bir referans değere karşı test edilir (NIST ESTAR/XCOM, IAEA
fotonükleer, AME2020, ICRP 103). Yaklaşım yapılan her yer kaynak kodda açıkça
işaretlenmiştir — özellikle:

- Fotoelektrik tesir kesiti kabuk kenarları içermez; XCOM tablosu gelene kadar
  yalnızca mertebe doğruluğundadır.
- Yoğunluk etkisi düzeltmesi yüksek enerji asimptotudur.
- Katz–Penfold **pratik** menzili verir, CSDA menzilini değil.

## Uyarı

Bu yazılım **eğitim amaçlıdır**. Radyasyon korunması, klinik dozimetri, kalkan
tasarımı veya herhangi bir gerçek maruziyet değerlendirmesi için kullanılamaz.

## Lisans

MIT. Kullanılan veri kaynaklarının atıfları `docs/DATA_SOURCES.md` içindedir.
