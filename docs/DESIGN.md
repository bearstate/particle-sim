# Tezgâh Tasarımı

Simülatör bir **tezgâh** (workbench) metaforuyla çalışır — PhET'teki gibi.
Kullanıcı cihazları paletten sürükleyip alana bırakır, kablolarla bağlar,
seçtiği cihazın kontrollerini alttaki dock'tan ayarlar, herhangi bir hedefe
tıklayınca mikro görünümde atomunu izler.

## Katmanlar

| Katman | Teknoloji | Ne yapar |
|---|---|---|
| Tezgâh (şematik) | React + SVG | Palet, sürükle-bırak, kablolar, seçim, portlar. **Kalıcı**; 3D gelince silinmez. |
| Sahne (render) | three.js, sabit kamera | Aynı tezgâh durumunu ışık, bloom, plazma, demet parçacıklarıyla çizer. Aşama 2b. |
| Mikro görünüm | React + SVG | Seçili hedefin Bohr atom modeli; çarpışma olaylarını gerçek zamanlı oynatır. |
| Dock | React | Seçili cihazın kontrolleri (`ControlSpec`'ten otomatik). |
| Telemetri | React | Sıcaklık, akım, verim, doz. Fizikten gelir, görselden asla. |

**Kamera sabittir.** Serbest orbit kamera sürükle-bırak ve kablolamayı bozar;
izometrik/yan bakış PhET hissini korur, three.js ise görsel kaliteyi.

## Portlar ve bağlantı kuralları

Her cihazın tipli portları vardır. Kablo yalnızca uyumlu portlar arasında çekilir.

| Port türü | Çizim | Örnek |
|---|---|---|
| `hv` | Kalın kablo | Van de Graaff küresi → tüp anodu |
| `ground` | İnce kablo, toprak sembolü | Tüp katodu → toprak |

**Demet bir port değildir, geometridir.** Tüpün çıkışından sağa doğru uçar ve
ekseni kesen ilk cihaza çarpar (`solve.firstHitToRight`). Hedeften X-ışını
ileri (koni), nötron her yöne çıkar; 340 px içindeki en yakın hedef nötronları
yakalar. Kullanıcı hiçbir şeyi "demete bağlamaz" — hizalar.

**Van de Graaff tavanı görünürdür.** Küre yalnızca `E_delinme · R` kadar
gerilim tutar (15 cm havada 450 kV). İstenen gerilim bunu aşarsa terminal
"kendini boşaltır": ark fırtınası, turuncu hale, dock'ta uyarı. Küreyi
büyütmek (görselde de büyür) ya da SF₆ tavanı kaldırır.

## Mikro görünüm: mekanizma doğru gösterilir

Elektron nötronu doğrudan koparmaz. Gösterilen zincir:

```
elektron gelir → çekirdek yakınında sapar → fren fotonu (bremsstrahlung) çıkar
→ foton çekirdekçe soğurulur → çekirdek "sallanır" (dev dipol rezonansı)
→ eşik üstündeyse nötron fırlar → etiket: W-184 → W-183
```

Eşik altındaysa foton çıkar ama çekirdek nötron vermez — bu fark görünür olmalı.

3. bölümde ters yön: `Th-232 + n → Th-233`, `H-1 + n → H-2 (döteryum)`.
Etiketleme iki yönü de bilir (`physics/data/nuclides.ts`).

## Bohr modeli

Kabuklar sırayla dolar (2, 8, 18, 32, 32, 18, 8). Bu gerçek Aufbau sırası
değildir; PhET de aynı sadeleştirmeyi yapar. Çekirdek Z proton + N nötron
kümesi olarak çizilir; W-184'te 184 nükleon paketlenmiş daire olarak görünür.
Nötron koptuğunda küme küçülür ve etiket A'yı günceller.

## Cihazlar (2026-09-18)

| Tür | Portlar | Ne yapar |
|---|---|---|
| Van de Graaff | hv | Kayış akımı, korona, `E·R` tavanı; tavan aşılınca sürekli deşarj |
| Cockcroft–Walton | hv, gnd | `2NV` ideal, yük altında `ΔV ∝ N³` düşümü (sabit-nokta iterasyonu) |
| Marx | hv, gnd | `NV₀·η` tepe, darbeli |
| Klistron | rf, gnd | RF gücü; LINAC'ın demet gücünü sınırlar |
| LINAC | rf, cathode | Sürüklenme tüpleri fizikten; Kilpatrick aşılırsa ark; e⁻ veya p⁺ |
| Vakum tüpü | anode(hv), cathode(gnd) | Vakumda demet; gazda Paschen'e göre parıltı/ark/tıkalı |
| Hedef | — | (γ,n) eşiği, X-ışını, ısı ve sıcaklık, nötron yakalama envanteri |
| Hücre örneği | — | Doz hızı (Gy/s, Sv/h), LQ hayatta kalma, DNA hasarı |
| Toprak | gnd | Dönüş yolu |

## Katmanlar (uygulanan)

- **Tezgâh (SVG)**: etkileşim, portlar, kablolar, seçim; şematik mod (3D kapalı) glyph'leri de çizer.
- **Sahne (three.js)**: `scene/BenchScene.tsx`, ortografik kamera 1 px = 1 birim, `RoomEnvironment` yansıması,
  selective bloom + ACES; parçacıklar vertex shader'da analitik (`scene/fx/Beam3D.tsx`), arklar drei `Line`.
- **Saat**: `workbench/clock.ts`, 1×…1e9×, hedef başına maruziyet; envanter Bateman ile (`inventory.ts`).
- **Kayıt**: topoloji `localStorage`'a (`bench.v1`); hazır kurulumlar `presets.ts`.

## Sırada

- Termal zaman entegrasyonu (şu an denge sıcaklığı), Marx darbe görselleri.
- Kablolar 3D'de; kamera hafif eğik izometrik seçenek.
- Veri hattı (NIST/ENDF LUT) ve fotoelektrik kenar yapısı.

## Mikro görünüm perdeleri (2026-09-18, ikinci tur)

Perdeleri `src/workbench/atomActs.ts` planlar, `BohrAtom.tsx` yalnızca çizer.
Kabuklar CSS ile değil JS ile döner: bir kabuk elektronunun dünya açısı
bilindiği için iyonlaşmada *tam o* elektron kopar, üst kabuktan *tam o*
boşluğa elektron düşer.

| Perde | Ne zaman | Ne görünür |
|---|---|---|
| `scatter` / `brems` / `photoneutron` | elektron gelir | öncekiyle aynı; fotonötron ürünü kararsızsa zincir devam eder |
| `ionize` | elektron/proton/foton (fotoelektrik) | K elektronu fırlar, L elektronu düşer, karakteristik X-ışını çıkar |
| `capture` | nötron gelir | yakalama + bağlanma enerjisi γ; ürün kararsızsa `decay` kuyruğa girer, fissile ise `fission` |
| `alpha` | kararsız çekirdek | 2p2n kümesi kenarda oluşur, fırlar, çekirdek geri teper |
| `betaMinus` / `betaPlus` / `ec` | kararsız çekirdek | kenardaki nükleon renk değiştirir, β parçacığı kıvrılarak çıkar, (anti)nötrino kesikli çizgi |
| `fission` | U-235/U-233/Pu-239 + n | bileşik çekirdek uzar, iki parça + ν nötron + 2 γ; parçalar etiketli |
| `breakup` | Be-8 | iki α'ya ayrılır |

Bozunma verisi `src/physics/nuclear/nuclideTable.ts` (NuBase2020/AME2020):
hedef izotopları, (γ,n)/(n,γ) ürünleri, Th-232/U-238/U-235 serileri. Zincir
100 yıldan uzun yarı ömürde durur (`CHAIN_LIMIT_S`); anlatı "21.8 dk sonra:"
diye bekleme süresini söyler ve panel yarı ömür + Q değerini gösterir.
Boşta (demet yok) kararsız hedef kendi bozunmasını oynatır; demet varken %12
karışır. Uranyum hedefte `isotope` parametresi (`natural` / `u235`) yalnızca
element U iken görünür (`ParamSpec.onlyIf`).

**Görsel zaman ≠ gerçek zaman.** U-238'in 4.5 milyar yıllık bozunması birkaç
saniyede bir oynar; not satırı bunu söyler. Telemetri (envanter tablosu)
yine Bateman'dan gelir, perdelerden değil.

## Hücre yakın planı: DNA çift sarmalı

`CellView.tsx` üstte hücreyi, altta çekirdekten büyütülmüş B-DNA sarmalını
çizer (10.5 bp/dönüş, iki omurga π faz farkı, ön/arka derinlik). İzleri
`src/workbench/dna.ts` planlar:

- **foton**: dalga gelir, Compton noktasında elektron fırlar; seyrek iyonlaşma,
  OH• radikalleri omurgaya yürür (dolaylı etki) → çoğunlukla SSB
- **elektron**: aynı iz, birincil foton yok
- **proton**: düz, yoğun iz; sarmalı kestiği yerde kümelenmiş DSB + SSB + baz hasarı (kalıcı)
- **nötron**: kesikli çizgi, "H" üzerinde saçılır, geri tepen proton kısa yoğun iz bırakır; nötron saparak devam eder

Lezyonlar baz çifti indeksine bağlıdır ve sarmalla döner: SSB tek omurgada
boşluk, DSB iki omurga + basamak kopuk ve iki parça birbirinden kayar, baz
hasarı basamak yarısını morartır. Onarım görsel ölçekte: SSB 5–9 s, DSB
14–20 s, kümelenmiş DSB kalıcı; kapasite 26 lezyon. Hücre ölünce zar
kabarır (bleb), kromatin parçalanır. Sayımlar `survival.ts`'den gelir; çizilen
lezyon sayısı telemetri değildir.
