# Parçacık Hızlandırma ve Işınlama Simülatörü

Tarayıcıda çalışan bir fizik tezgâhı. Bir yüksek gerilim kaynağı kurup bir
vakum tüpüne bağlıyorsunuz, çıkan elektronlar bir hedefe çarpıyor, hedeften
çıkan X-ışınları ve nötronlar ikinci bir hedefi dönüştürüyor ya da bir hücre
örneğine doz veriyor. Her adımın altında gerçek formüller ve yayımlanmış veri
tabloları var; ekrandaki sayılar çizilen parçacıklardan değil, bu hesaplardan
geliyor.

Türkçe ve İngilizce arayüz.

## Çalıştırma

Gereken tek şey Node.js (20 veya daha yeni). Yoksa https://nodejs.org
adresinden LTS sürümünü kurun.

```
git clone https://github.com/bearstate/particle-sim.git
cd particle-sim
npm install
npm run dev
```

Son komut bir adres yazdırır, genellikle http://localhost:5173. Onu tarayıcıda
açın. Sunucu açık kaldığı sürece kaynak kodda yaptığınız değişiklikler sayfaya
anında yansır.

Diğer komutlar:

```
npm test           # fizik testleri (vitest)
npm run typecheck  # TypeScript denetimi
npm run build      # dist/ altına üretim derlemesi
npm run preview    # derlenmiş sürümü yerelde açar
```

Derlenmiş `dist/` klasörü düz dosyalardan oluşur; herhangi bir statik
sunucuya (GitHub Pages, Netlify, bir Apache dizini) kopyalanarak yayınlanabilir.

## Nasıl kullanılır

1. Sağdaki paletten bir cihazı tezgâha sürükleyin. En kısa zincir: Van de
   Graaff, vakum tüpü, toprak, bir hedef (tungsten veya berilyum).
2. Portları kabloyla bağlayın: jeneratörün yüksek gerilim portu tüpün anoduna,
   toprak tüpün katoduna. Demet için kablo gerekmez; tüpün ekseninde ne varsa
   ona çarpar.
3. Alttaki panelden gerilimi, küre yarıçapını, gazı ve basıncı ayarlayın.
   Kıvılcımlar gerilimle uzar; küreye sığmayan gerilim delinmeyle sınırlanır.
4. Bir hedefi seçince sağ altta atom görünümü açılır: gelen elektron saçılır,
   fren ışıması yapar, eşik üstündeyse çekirdekten nötron koparır. Kararsız
   çekirdekler bozunmalarını oynatır, zincir etiketlenir
   (Th-232, Th-233, Pa-233, U-233).
5. Toryum battaniyesini nötron kaynağının yakınına koyun ve üstteki zaman
   kaydırıcısını hızlandırın; envanter tablosu Bateman çözümüyle dolar.
6. Hücre örneğini X-ışını konisine veya nötron kaynağının yanına koyun; doz
   hızı, eşdeğer doz, hayatta kalma kesri ve DNA sarmalındaki kırıklar görünür.

Sağ alttaki "Hazır kurulumlar" bölümü bu zincirleri tek tıkla kurar. Tezgâh
tarayıcıda saklanır; sayfayı yenileyince kaldığınız yerden devam eder. "3D"
düğmesi three.js sahnesi ile düz şematik görünüm arasında geçiş yapar.

## Neler var

Kaynaklar: Van de Graaff, Cockcroft–Walton merdiveni, Marx jeneratörü,
klistron ile beslenen doğrusal hızlandırıcı (elektron veya proton).

Etkileşim: vakum, hava, azot, argon, neon, helyum, SF₆ ve CO₂ dolu tüp;
Paschen eğrisi, parıltı ve ark rejimleri; Kramers spektrumu ve karakteristik
çizgiler; dev dipol rezonansı ve fotonötron eşikleri; hedef ısınması ve erimesi.

Sonuç: nötron yakalama zincirleri, aktivasyon ve bozunma, 1× ile 10⁹× arası
zaman ölçeği, ICRP 103 ağırlık faktörleriyle eşdeğer doz, lineer-kuadratik
hayatta kalma modeli, hücre ve DNA yakın planı.

## Kodun yapısı

- `src/physics/` fizik çekirdeği. Saf TypeScript; React, three.js veya DOM
  kullanmaz. `tests/purity.test.ts` bu sınırı denetler.
- `src/workbench/` tezgâh: cihaz kataloğu, devre çözücü, SVG çizimler, atom ve
  hücre görünümleri.
- `src/scene/` three.js sahne katmanı.
- `src/ui/` kaydırıcı, seçici ve grafik bileşenleri.
- `src/i18n/` Türkçe ve İngilizce sözlükler.
- `docs/PHYSICS.md` kullanılan her formül, `docs/DESIGN.md` tezgâhın tasarım
  kararları, `docs/DATA_SOURCES.md` veri kaynakları ve atıfları.

Her fizik fonksiyonu `docs/PHYSICS.md` içindeki bir denkleme bağlıdır ve
yayımlanmış bir referans değere karşı test edilir (NIST ESTAR ve XCOM, IAEA
fotonükleer kütüphanesi, AME2020, NuBase2020, ICRP 103). Yaklaşıklık yapılan
yerler kaynak kodda işaretlidir; örneğin fotoelektrik tesir kesiti kabuk
kenarlarını içermez ve Katz–Penfold formülü CSDA menzilini değil pratik
menzili verir.

## Uyarı

Bu yazılım eğitim amaçlıdır. Radyasyon korunması, klinik dozimetri, kalkan
tasarımı veya gerçek bir maruziyet değerlendirmesi için kullanılamaz.

## Lisans

MIT. Veri kaynaklarının atıfları `docs/DATA_SOURCES.md` içindedir.

---

## English

A browser-based physics bench. Build a high-voltage source, wire it to a
vacuum tube, let the electrons hit a target, and follow the X-rays and neutrons
into a second target or a cell sample. Every number on screen comes from the
underlying formulas and published data tables, not from the drawn particles.
The interface is available in Turkish and English.

Requirements: Node.js 20 or newer.

```
git clone https://github.com/bearstate/particle-sim.git
cd particle-sim
npm install
npm run dev
```

Open the printed address (usually http://localhost:5173). `npm test` runs the
physics tests, `npm run build` writes a static site into `dist/`.

Drag devices from the palette on the right, wire the electrical ports, adjust
the controls at the bottom, and select a target to open the atom view. The
"presets" list sets up a complete chain in one click.

This software is for education only. It must not be used for radiation
protection, clinical dosimetry, shielding design or any real exposure
assessment. Licensed under MIT; data sources are credited in
`docs/DATA_SOURCES.md`.
