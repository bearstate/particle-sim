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
| `beam` | Kesikli demet hattı | Tüp çıkışı → hedef |

`beam` bir kablo değil, **hizalama**dır: demetin ulaştığı şey neyse ona gider.

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

## Aşama 2 dilimi

1. Tezgâh iskeleti: palet, sürükle-bırak, kablo, seçim, dock. (SVG)
2. Nüklid adlandırma + Bohr atom bileşeni + mikro görünüm.
3. Fizik bağlantısı: kablo varsa gerilim tüpe ulaşır, demet akar, hedef ısınır,
   eşik geçilince nötron olayı mikro görünümde oynar.
4. three.js sahne katmanı: sabit kamera, bloom, demet parçacıkları, ark.
