# Veri Kaynakları

Simülatörün kullandığı her fiziksel veri kümesi burada kaynağı, lisansı ve
zorunlu atıfıyla listelenir. **Veri hattı (`npm run data`), manifest'te `license`
ve `citation` alanı boş olan bir tablo için build'i kırar** — atıf unutmak
mümkün değildir.

Yeniden dağıttığımız şey ham dosyalar değil, **türetilmiş / grup-ortalamalı
tablolardır** (toplam ~1.3 MB, ham hâli gigabaytlar). Bu hem teknik hem hukuki
olarak daha savunulabilir.

## Şu anda kod içinde küratörlü olan veriler

| Veri | Dosya | Kaynak |
|---|---|---|
| Element termofiziksel özellikleri | `src/physics/data/elements.ts` | CRC Handbook of Chemistry and Physics |
| İş fonksiyonları | aynı dosya | CRC + Michaelson, *J. Appl. Phys.* 48, 4729 (1977) |
| Karakteristik X-ışını çizgileri | `src/physics/interaction/bremsstrahlung.ts` | NIST X-Ray Transition Energies Database (SRD 128) |
| Nötron ayrılma enerjileri S_n | `src/physics/interaction/photoneutron.ts` | AME2020, Wang ve ark., *Chinese Physics C* 45, 030003 (2021) |
| Yarı ömürler ve bozunma modları | `src/physics/nuclear/chains.ts` | NNDC ENSDF / NUBASE2020 |
| Termal tesir kesitleri | aynı dosya | ENDF/B-VIII.0, Brown ve ark., *Nuclear Data Sheets* 148, 1 (2018) |
| Townsend katsayıları | `src/physics/gas/gases.ts` | Lieberman & Lichtenberg; Naidu & Kamaraju |
| Işınım ve doku ağırlık faktörleri | `src/physics/dosimetry/dose.ts` | ICRP Publication 103 (2007) |

## Veri hattının getireceği tablolar (Aşama 2)

| Tablo | Kaynak | Lisans / şart |
|---|---|---|
| Elektron durdurma gücü, menzil | NIST **ESTAR** (SRD 124) | ABD kamu malı |
| Proton / alfa durdurma gücü | NIST **PSTAR / ASTAR** | ABD kamu malı |
| Foton zayıflama (µ/ρ) | NIST **XCOM** (SRD 8) | ABD kamu malı |
| Nötron tesir kesitleri | **ENDF/B-VIII.0** (NNDC, BNL) | Serbest; atıf zorunlu |
| Fotonükleer (γ,n) | **IAEA Photonuclear Data Library 2019** | Serbest; atıf zorunlu |
| Atom kütleleri | **AME2020** | Yayımlanmış; atıf zorunlu |
| Nüklid özellikleri | **NUBASE2020 / ENSDF** | Serbest; atıf zorunlu |
| İyonlaşma enerjileri | NIST **ASD** (SRD 78) | ABD kamu malı |

Ham indirmeler `tools/data-pipeline/.cache/` altında tutulur ve **asla commit
edilmez** (`.gitignore`).

## Uyarı

Bu veriler burada **eğitim amaçlı** bir simülasyonda kullanılmaktadır.
Türetilmiş tablolar grup ortalamalıdır ve rezonans yapısı taşımaz; orijinal
kaynakların yerine geçmez.
