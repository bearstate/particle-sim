# Fizik Formül Külliyatı

Bu belge projenin fizik sözleşmesidir. `src/physics/` altındaki her saf
fonksiyon buradaki bir denklemi uygular ve `tests/` içinde yayımlanmış bir
referans değere karşı doğrulanır.

Bölüm numaraları (1.0, 1.A, 1.B ...) kaynak kodda docstring referansı olarak
kullanılır; birini değiştirirsen diğerini de güncelle.

---


### 1.0 Sabitler ve relativistik kinematik

```
c   = 2.997 924 58e8 m/s          e    = 1.602 176 634e-19 C
ε₀  = 8.854 187 8128e-12 F/m      k_B  = 8.617 333 262e-5 eV/K
h   = 6.626 070 15e-34 J·s        N_A  = 6.022 140 76e23 /mol
r_e = 2.817 940 3262e-15 m        a₀   = 5.291 772 109e-11 m
σ_SB= 5.670 374 419e-8 W/m²K⁴     R_∞  = 1.097 373 1568e7 /m
m_e c² = 0.510 998 95 MeV         m_p c² = 938.272 088 MeV
m_n c² = 939.565 421 MeV          u c²   = 931.494 102 MeV
1 barn = 1e-28 m²                 1 eV   = 1.602 176 634e-19 J
```

Kinetik enerji `T`, durgun enerji `E₀ = m₀c²`:

```
γ  = 1 + T/E₀
β  = √(1 − 1/γ²)
pc = √(T² + 2·T·E₀)
E_top = T + E₀                    (E² = (pc)² + E₀²)
v  = β·c
```

Manyetik sertlik (rigidity), hızlandırıcı bölümünün belkemiği:

```
Bρ [T·m] = pc[MeV] / (299.792 458 · z)        z = yük sayısı
```

Referans kontrol değerleri (birim testleri bunları tutturmalı):
`T = 1 MeV e⁻ → γ=2.9569, β=0.94108, pc=1.4221 MeV`
`T = 250 MeV p → γ=1.2665, β=0.61370, pc=729.13 MeV`

### 1.A — Bölüm 1: Elektrostatik kaynaklar

**Van de Graaff**

```
Kayış yük akımı        I = σ · w · v_kayış              [σ: C/m², w: m, v: m/s]
Terminal kapasitansı   C = 4πε₀R                        (R=0.15 m → 16.7 pF)
Gerilim yükselmesi     dV/dt = (I − I_kaçak(V)) / C
Denge                  V_∞ = I · R_kaçak
Depolanan enerji       U = ½CV²
Delinme sınırı         V_max = E_delinme · R
```

Korona başlangıcı (Peek yasası, silindirik iletken, r cm):

```
E_c = 31·δ·(1 + 0.308/√(δ·r))  kV/cm
δ   = (p/101.325 kPa)·(293/T[K])        bağıl hava yoğunluğu
```

Korona kaçak akımı, başlangıç üstünde kabaca kuadratik:
`I_korona = k·V·(V − V_onset)`, `V < V_onset` iken 0.

**Kıvılcım uzunluğu.** Kullanıcının istediği kural (`1 cm ≈ 30 kV`) düzgün alanda, deniz seviyesinde hava için doğru:

```
d[cm] = V[kV] / 30        →  yapılandırılabilir sabit E_br = 30 kV/cm
```

Not: uzun çubuk-düzlem aralıklarında gerçek değer ~5 kV/cm'e kadar düşer (uzay yükü etkisi). Varsayılan 30 kV/cm kalsın, "gerçekçi uzun aralık" anahtarı 5 kV/cm'e geçirsin. 300 kV → 10 cm, birebir kullanıcının istediği davranış.

**Marx jeneratörü** (N kademe, her biri C, her biri V₀'a şarj)

```
İdeal çıkış        V_out = N · V₀
Ayağa kalkmış kap. C_erect = C / N
Toplam enerji      U = ½ · N · C · V₀²
Gerilim verimi     η = C_erect / (C_erect + C_yük)
Gerçek çıkış       V_out = N · V₀ · η          (η tipik 0.85–0.95)
```

Çift üstel darbe dalga şekli (standart yıldırım darbesi 1.2/50 µs):

```
V(t) = V₀ · k · (e^(−αt) − e^(−βt))
1.2/50 µs için:  α = 1.4667e4 s⁻¹, β = 2.4670e6 s⁻¹, k = 1.0372
Cephe süresi     T₁ ≈ 3·R_ön·C_yük
Kuyruk süresi    T₂ ≈ 0.7·R_kuyruk·(C_erect + C_yük)
```

Kıvılcım aralıkları zincirleme ateşlenir: ilk aralık tetiklenince sonraki aralıklar 2V₀ aşırı gerilim görür ve ns mertebesinde ardışık delinir ("erection"). Görselde bu zincirleme gecikme gösterilmeli.

**Cockcroft–Walton merdiveni** (N kademe, besleme tepe gerilimi V_p, frekans f, kademe kapasitansı C, yük akımı I)

```
İdeal çıkış     V_out = 2·N·V_p
Gerilim düşümü  ΔV   = (I/(f·C)) · (2N³/3 + N²/2 − N/6)
Dalgalanma      δV   = (I/(f·C)) · N(N+1)/2
Gerçek çıkış    V_out = 2·N·V_p − ΔV
Optimum kademe  N_opt = √(V_p·f·C / I)
```

Her kondansatör ve diyot `2V_p` görür — görsel şemada bu etiketlenmeli. `N` büyüdükçe `ΔV` küple arttığı için "daha çok kademe daha çok gerilim" sezgisi kırılır; bu simülasyonun öğrettiği güzel bir şey.

### 1.B — Bölüm 1: Hızlandırıcılar

**Doğrusal hızlandırıcı (Wideröe / Alvarez)**

```
Sürüklenme tüpü boyu (Wideröe)  L_n = β_n·λ/2 = v_n/(2f)
Rölativistik olmayan hız        v_n = √(2·n·q·V₀/m)
Alvarez (2π mod)                L_n = β_n·λ
Geçiş süresi faktörü            T = sin(πg/(βλ)) / (πg/(βλ))     g: aralık boyu
Boşluk başına kazanç            ΔW = q·V₀·T·cos(φ_s)
n boşluk sonrası                W_n = n·q·V₀·T·cos(φ_s)
```

RF delinme sınırı (Kilpatrick): `f[MHz] = 1.64·E²·e^(−8.5/E)`, E MV/m. Modern yapılar 10–50 MV/m. Kullanıcı gradyanı bunun üstüne çıkarırsa → boşlukta ark, görsel olarak gösterilmeli.

**Siklotron**

```
Siklotron frekansı   f_c = qB/(2πγm)
Yörünge yarıçapı     r   = γmv/(qB) = p/(qB)
Rölativistik olmayan T_final = (qBR)²/(2m)
Rölativistik         T_final = √((qBRc)² + E₀²) − E₀
İzokron düzeltme     B(r) = B₀·γ(r)
```

Klasik siklotronun rölativistik faz kayması nedeniyle proton için ~20–25 MeV'de tıkanması, bu simülasyonda doğal olarak ortaya çıkmalı: γ arttıkça `f_c` düşer, sabit RF ile faz kayar, kazanç sıfıra iner. Kullanıcı "izokron" veya "senkro" moduna geçerek bunu aşabilmeli.

**Sinkrotron**

```
Momentum         p[GeV/c] = 0.299 792 · B[T] · ρ[m] · z
Dolanma frekansı f_rev = βc/(2πR)
```

Sinkrotron ışıması, tur başına enerji kaybı:

```
Genel      ΔE = q²β³γ⁴ / (3ε₀ρ)
Elektron   ΔE[keV] = 88.46 · E⁴[GeV] / ρ[m]
Proton     ΔE[keV] = 7.78e-12 · E⁴[GeV] / ρ[m]    (= 88.46·(m_e/m_p)⁴)
Işıma gücü P = (q²c/6πε₀)·(β⁴γ⁴/ρ²)
```

Elektronla protonun aynı halkada neden bambaşka davrandığı (m⁻⁴ bağımlılığı) burada görülür — iyi bir öğretim anı.

**Kaynak / demet üretimi**

```
Child–Langmuir (uzay yükü sınırlı)
  J = (4ε₀/9)·√(2q/m)·V^(3/2)/d²
  elektron: J = 2.334e-6 · V^(3/2)/d²   [A/m², V volt, d m]
  iyon:     J = 5.44e-8·√(Z/A)·V^(3/2)/d²

Richardson–Dushman (termiyonik)
  J = A₀·T²·exp(−W/(k_B·T)),  A₀ = 1.20173e6 A/(m²K²)
  W [eV]: W 4.55 · Ta 4.25 · Th-W 2.63 · LaB₆ 2.70 · BaO 1.10 · Cu 4.70

Fowler–Nordheim (alan emisyonu)
  J = (1.54e-6·(βE)²/φ)·exp(−6.83e9·φ^(3/2)·v(y)/(βE))

Parçacık debisi   Ṅ = I/(z·e)
Demet gücü        P = I·V  (DC)  |  P = Ṅ·T_kin
Perveans          P_v = I/V^(3/2)
```

Çoklu saçılma (Highland), demet genişlemesi için:

```
θ₀ = (13.6 MeV/(β·pc))·z·√(x/X₀)·[1 + 0.038·ln(x/X₀)]
```

### 1.C — Bölüm 2: Gaz ortamı, delinme, plazma

```
Parçacık yoğunluğu   n = p/(k_B·T)            1 atm, 293 K → 2.5e25 /m³
Ortalama serbest yol λ = k_B·T/(√2·π·d²·p)    hava: ~68 nm @ STP
Genel                λ = 1/(n·σ)
```

**Paschen yasası** — basınç anahtarının kalbi:

```
V_b = (B·p·d) / (ln(A·p·d) − ln(ln(1 + 1/γ_se)))

Hava:  A = 11.25 (m·Pa)⁻¹,  B = 273.8 V/(m·Pa),  γ_se ≈ 0.01
  → minimum V_b ≈ 305 V @ p·d ≈ 1.12 Pa·m
     (yayımlanmış hava minimumları 300–360 V bandındadır; fark katsayı
      setinden ve katot malzemesinin γ_se değerinden gelir)
Ar:    A = 11.5 /(cm·Torr), B = 176 V/(cm·Torr)
He:    A = 3.0,  B = 34
N₂:    A = 12.0, B = 342
```

Paschen eğrisinin solundaki dal (çok düşük basınç → delinme gerilimi TEKRAR yükselir) çoğu kişinin sezgisine aykırıdır ve simülasyonun en öğretici grafiği olacak: basınç kaydırıcısını çekince tüp önce parlar, sonra söner.

```
Townsend birinci katsayısı  α = A·p·exp(−B·p/E)
Delinme kriteri             γ_se·(e^(αd) − 1) = 1  →  αd = ln(1 + 1/γ_se)
Streamer (Meek) kriteri     ∫α_eff dx ≈ 18–20
Debye uzunluğu              λ_D = 7430·√(T_e[eV]/n_e[m⁻³])  m
Plazma frekansı             f_pe = 8980·√(n_e[cm⁻³])  Hz
```

**Saha denklemi** — iyonlaşma kesri, plazma parlaklığını ve rengini sürer:

```
(n_{i+1}·n_e)/n_i = 2·(g_{i+1}/g_i)·(2π·m_e·k_B·T/h²)^(3/2)·exp(−χ_i/(k_B·T))
```

**Dielektrik dayanım** (düzgün alan, 1 bar, 20 °C):

```
Hava 3.0 MV/m · N₂ 3.4 · CO₂ 2.7 · SF₆ 8.9 · trafo yağı 12–25
Vakum: Paschen geçersiz — yüzey flashover sınırlı, 10–30 MV/m
SF₆ basınç bağımlılığı:  E_br[kV/cm] ≈ 88.5 · p[bar]
Vakum (Cranberg):        V_b = K·d^α,  α ≈ 0.5–0.7
```

SF₆'nın havadan ~3× iyi olması elektronegatifliğinden (elektron yakalama) gelir — kullanıcı SF₆ seçince aynı gerilimde arkın kesilmesi bunu gösterir.

**Basınca göre deşarj rejimleri** (görsel sahnelerin doğrudan karşılığı):

| Basınç | Görünen | Fizik |
|---|---|---|
| ~1 atm | Ark / kıvılcım kanalı | Streamer, 20 000–30 000 K |
| ~10 Torr | Dolu parıltı deşarjı | Klasik glow, pozitif sütun |
| ~1 Torr | Çizgili (striation) sütun | İyonlaşma dalgaları |
| ~10⁻² Torr | Crookes karanlık alanı tüpü doldurur, cam yeşil floresan | Katot ışınları |
| <10⁻⁴ Torr | Parıltı yok, saf elektron demeti + X-ışını | Çarpışmasız taşınım |

**Gaz deşarj renkleri** (spektral çizgilerden, emisyon dokusu için):
Hava/N₂ pembe-mor · Ne kırmızı-turuncu (640 nm) · Ar soluk lavanta-mor (696–812 nm) · He soluk şeftali-pembe · Kr yeşilimsi beyaz · Xe mavi-beyaz · H₂ magenta · Hg mavi-beyaz + kuvvetli UV · Na sarı (589 nm)

### 1.D — Bölüm 2: Parçacık–madde etkileşimi

**Bethe–Bloch** (ağır yüklü parçacıklar: proton, alfa, iyon):

```
−dE/dx = K·z²·(Z/A)·(1/β²)·[ ½·ln(2m_ec²β²γ²T_max/I²) − β² − δ(βγ)/2 ]

K = 4π·N_A·r_e²·m_ec² = 0.307 075 MeV·mol⁻¹·cm²
T_max = 2m_ec²β²γ² / (1 + 2γm_e/M + (m_e/M)²)
I ≈ 16·Z^0.9 eV   (Z > 1; tablo varsa tablo tercih edilir)
```

**Berger–Seltzer** (elektronlar, çarpışmasal):

```
−(dE/dx)_çarp = (K/2)·(Z/A)·(1/β²)·[ ln(τ²(τ+2)/(2(I/m_ec²)²)) + F⁻(τ) − δ ]
F⁻(τ) = 1 − β² + [τ²/8 − (2τ+1)·ln2]/(τ+1)²,      τ = T/m_ec²
```

**Işımasal kayıp (bremsstrahlung) / çarpışmasal oranı** — X-ışını üretiminin anahtarı:

```
(dE/dx)_ışıma / (dE/dx)_çarp ≈ Z·E[MeV] / 700
```

Bu tek satır, "neden anot tungsten?" sorusunu cevaplar: Z=74 ile oran Z=13 alüminyuma göre ~6 kat.

```
Işıma boyu      X₀ = 716.4·A / (Z(Z+1)·ln(287/√Z))  g/cm²
  W 6.76 g/cm² (0.35 cm) · Pb 6.37 (0.56 cm) · Al 24.01 · H₂O 36.08
Kritik enerji   E_c = 610/(Z+1.24) MeV (katı), 710/(Z+0.92) (gaz)
Molière yarıçapı R_M = 21.2 MeV · X₀/E_c
```

**Menzil** (elektron). DİKKAT: Katz–Penfold **pratik (ekstrapole) menzili**
verir, CSDA menzilini değil. Elektron zikzak ilerlediği için kat edilen yol ile
kat edilen derinlik farklıdır; oranı "dolambaç çarpanı"dır (1 MeV'de ~0.73).
CSDA menzili durdurma gücünden integre edilmelidir: `R = ∫dE/S(E)`.


```
R[g/cm²] = 0.412·E^(1.265 − 0.0954·lnE)      0.01 ≤ E ≤ 3 MeV
R[g/cm²] = 0.530·E − 0.106                   1 ≤ E ≤ 20 MeV
```

Bu simülasyonda doğrudan görünür olmalı: 1 MeV elektron alüminyumda ~1.5 mm gider, aynı enerjide X-ışını metrelerce.

### 1.E — Bölüm 2: X-ışını üretimi

```
Duane–Hunt sınırı   E_max = e·V   →   λ_min[nm] = 1.2398 / V[kV]
Kramers spektrumu   I(E)·dE = K·Z·(E_max − E)·dE
                    I(λ) ∝ (Z/λ²)·(λ/λ_min − 1)
Üretim verimi       η ≈ 1.1e-9 · Z · V[V]
                    (W anot @ 100 kV → η ≈ 0.8 % ; gerisi ISI)
Anot ısı yükü       P_ısı = (1 − η)·I·V
```

**Karakteristik çizgiler — Moseley yasası:**

```
Kα:  E = (3/4)·13.606·(Z−1)²  eV
Kβ:  E = (8/9)·13.606·(Z−1)²  eV
Lα:  E = 13.606·(5/36)·(Z−7.4)²  eV

Gerçek: W Kα1 59.32 keV, Kβ1 67.24, Lα1 8.40 | Mo Kα1 17.48 | Cu Kα1 8.048
```

Karakteristik çizgiler ancak hızlandırma gerilimi K-kabuk bağlanma enerjisini geçince belirir (W için 69.5 kV). Spektrum grafiğinde bu ani "diken çıkışı" çok tatmin edici bir etkileşim olacak.

**Foton zayıflaması:**

```
I = I₀·exp(−(µ/ρ)·ρ·x)        HVL = ln2/µ
Fotoelektrik      τ ∝ Z^(4–5)/E³
Compton           E' = E/(1 + (E/m_ec²)(1 − cosθ))
                  Δλ = λ_C·(1 − cosθ),  λ_C = 2.426 31 pm
Klein–Nishina     dσ/dΩ = ½r_e²·(E'/E)²·(E'/E + E/E' − sin²θ)
Çift oluşum       eşik 2m_ec² = 1.022 MeV,  σ ∝ Z²·lnE
Toplam            µ = τ + σ_incoh + σ_coh + κ
```

**Cherenkov** (su/cam pencere için görsel mavi parıltı):

```
Eşik   β > 1/n        (su n=1.33 → 0.26 MeV elektron)
Açı    θ_C = arccos(1/(βn))
```

### 1.F — Bölüm 2: Fotonükleer reaksiyon ve nötron üretimi

Kullanıcının istediği "6 MeV'de tungstenden nötron fırlaması" tam olarak burada. Mekanizma: elektron → bremsstrahlung fotonu → dev dipol rezonansı → (γ,n).

**Dev Dipol Rezonansı (GDR):**

```
Tepe enerjisi  E_GDR = 31.2·A^(−1/3) + 20.6·A^(−1/6)  MeV     (Berman–Fultz)
               (kaba yaklaşım, A>20: E_GDR ≈ 78·A^(−1/3))
Genişlik       Γ ≈ 4–8 MeV
Lorentz profili σ(E) = σ_m / (1 + ((E² − E_m²)/(E·Γ))²)
TRK toplam kuralı  ∫σ_abs·dE = 60·N·Z/A  MeV·mb
```

**(γ,n) eşikleri — nötron ayrılma enerjisi S_n** (AME2020):

```
H-2     2.2246 MeV       W-183   6.191 MeV   ← kullanıcının "W için 6 MeV"i
Be-9    1.6645           W-184   7.412
C-13    4.946            W-186   7.193
U-238   6.154            Pb-207  6.738
Th-232  6.438            Pb-208  7.368
Cu-63  10.864            Ta-181  7.577
Fe-56  11.197            Al-27  13.058
O-16   15.664            C-12   18.722
```

Be-9 ve H-2'nin neden "fotonötron kaynağı" olarak anıldığı buradan görünüyor: eşikleri 2 MeV'in altında, diğer her şeyin 3–5 katı düşük.

**Kalın hedef nötron verimi** (elektron demeti, Swanson ampirik kuralı):

```
Eşik altı → 0
Eşik üstü, doyuma giden: Y ≈ 1.2e12 n/s per kW   (W, ≳15 MeV)
                         Y ≈ 0.9e12               (Pb)
                         Y ≈ 0.5e12               (Ta)
İnce hedef                Y = N_γ · n_hedef · σ̄ · x
```

Ayrıca eşik üstü U/Th'de **fotofisyon** (~5.5 MeV üzeri) devreye girer.

### 1.G — Bölüm 2: Bohr atom modeli görselleştirmesi

```
Enerji seviyesi   E_n = −13.606·Z_eff²/n²  eV
Yörünge yarıçapı  r_n = n²·a₀/Z_eff
Geçiş enerjisi    ΔE = 13.606·Z_eff²·(1/n₁² − 1/n₂²)
Rydberg           1/λ = R_∞·Z²·(1/n₁² − 1/n₂²)
Dalga boyu        λ[nm] = 1239.84 / ΔE[eV]
```

Canlı gösterim: gelen elektron çarpınca kabuk elektronu üst seviyeye atlar (uyarılma) veya kopar (iyonlaşma); geri düşerken `λ` hesabından gelen GERÇEK renkte foton yayılır. İç kabuk boşluğu doldurulunca karakteristik X-ışını çıkar — bu, 1.E'deki spektrum dikeni ile aynı olay, iki farklı pencerede aynı anda görünür. Bu bağlantı simülatörün en değerli öğretici anı.

### 1.H — Bölüm 3: Nükleer dönüşüm ve bozunma

**Kullanıcının istediği toryum zinciri:**

```
Th-232 + n → Th-233      σ_th = 7.34 b,  RI = 85 b
Th-233 → Pa-233 + β⁻     T½ = 21.83 dk
Pa-233 → U-233  + β⁻     T½ = 26.975 gün
U-233                    T½ = 1.592e5 yıl, bölünebilir
```

**Diğer hazır zincirler / tepkiler:**

```
U-238 (n,γ) U-239 [2.68 b] → Np-239 (23.45 dk) → Pu-239 (2.356 gün)
Li-6  (n,α) T              σ_th = 940 b
B-10  (n,α) Li-7           σ_th = 3840 b      (nötron kalkanı demosu)
Cd-113 (n,γ)               σ_th = 20 600 b
Co-59 (n,γ) Co-60          37.2 b, T½ 5.27 yıl
Au-197 (n,γ) Au-198        98.7 b, T½ 2.695 gün   ("kurşunu altına çevirme"nin tersi)
U-235 fisyon               σ_f = 585 b, ν = 2.43, E ≈ 202.5 MeV
```

**Bozunma matematiği:**

```
λ = ln2/T½                N(t) = N₀·e^(−λt)           A = λN   [Bq]
Aktivasyon:  A(t) = N_hedef·φ·σ·(1 − e^(−λt)),  A_doyum = N·φ·σ
Bateman (zincir):
  N_n(t) = N₁(0)·(Π_{i=1}^{n-1} λ_i)·Σ_{i=1}^{n} e^(−λ_i t)/Π_{j≠i}(λ_j − λ_i)
```

`λ_j ≈ λ_i` olduğunda Bateman payda sıfıra gider — uygulamada yakın λ'lar için limit dalını ele almak ya da matris üstel (Padé) kullanmak gerekir. Bu somut bir uygulama tuzağı, testte yakalanmalı.

```
Q değeri (kütle fazlasından)  Q = Σ Δ_başlangıç − Σ Δ_ürün
Weizsäcker yarı-ampirik kütle formülü:
  B = a_V·A − a_S·A^(2/3) − a_C·Z(Z−1)/A^(1/3) − a_A·(A−2Z)²/A ± δ
  a_V=15.75, a_S=17.8, a_C=0.711, a_A=23.7, a_P=11.18  MeV
```

### 1.I — Bölüm 3: Nötron taşınımı ve yavaşlatma

```
Makroskopik kesit   Σ = N·σ,  N = ρ·N_A/M
Çarpışmasız akı     φ = φ₀·e^(−Σ_t·x)
Elastik enerji kaybı  E'/E ∈ [α, 1],   α = ((A−1)/(A+1))²
Ortalama log azalım   ξ = 1 + α·lnα/(1−α)
  ξ_H = 1.000 · ξ_D = 0.725 · ξ_C = 0.158 · ξ_U = 0.0084
Termalleşme çarpışma sayısı  n = ln(E₀/E_th)/ξ
  2 MeV → 0.025 eV:  H ≈ 18,  C ≈ 115,  U ≈ 2172
Yavaşlatma oranı    ξ·Σ_s/Σ_a
1/v yasası          σ(E) = σ₀·√(E₀/E),   E₀ = 0.0253 eV
Termal nötron       E = 0.0253 eV, v = 2200 m/s @ 20 °C
Difüzyon boyu       L = √(D/Σ_a),  D = 1/(3Σ_tr)
```

Simülasyonda bu şu anlama gelir: hızlı fotonötronu doğrudan toryuma çarptırırsan yakalama tesir kesiti minik; araya su/parafin moderatör koyarsan `σ` 1000 kat büyür ve U-233 üretimi patlar. Kullanıcıya moderatör seçtirmek, bu bölümü ezberden gerçek anlayışa çeviren şey.

### 1.J — Bölüm 3: Doz ve biyolojik etki

```
Soğurulan doz   D = E_soğurulan/m   [Gy = J/kg]
Eşdeğer doz     H = Σ w_R·D_R       [Sv]
  w_R:  γ/X/β = 1 · proton = 2 · alfa = 20 · nötron = f(E)
Etkin doz       E = Σ w_T·H_T
  w_T: kırmızı ilik 0.12 · akciğer 0.12 · mide 0.12 · gonad 0.08 · tiroid 0.04
```

**Nötron ağırlık faktörü (ICRP 103), enerjiye bağlı:**

```
E < 1 MeV       w_R = 2.5  + 18.2·exp(−(ln E)²/6)
1 ≤ E ≤ 50 MeV  w_R = 5.0  + 17.0·exp(−(ln(2E))²/6)
E > 50 MeV      w_R = 2.5  + 3.25·exp(−(ln(0.04E))²/6)
```

Nötronun ~1 MeV'de w_R ≈ 20'ye tırmanması, "aynı joule, 20 kat hasar" gerçeğini gösterir.

```
LET   L_Δ = dE/dl [keV/µm]
  X-ışını ~0.2–2 · 1 MeV e⁻ 0.25 · 1 MeV p 25 · 5 MeV α ~90 · hızlı n 20–50
RBE, LET ile ~100 keV/µm'de tepe yapar (RBE ≈ 3–8), sonra düşer ("overkill")
```

**Hücre hayatta kalma — Lineer-Kuadratik model** (hücre yakın plan görünümünün matematiği):

```
S(D) = exp(−α·D − β·D²)
  α/β = 10 Gy (erken yanıt veren doku) · 3 Gy (geç yanıt veren)
  tipik α = 0.3 Gy⁻¹, β = 0.03 Gy⁻²
BED = D·(1 + D/(α/β))
```

**Gy başına DNA hasarı (düşük LET, hücre başına):**

```
~1000 tek zincir kırığı (SSB) · ~35–40 çift zincir kırığı (DSB)
~2000 baz hasarı · ~150 DNA-protein çapraz bağı
```

DSB'ler hücre ölümünün ana sürücüsü. Yüksek LET (alfa, nötron) aynı dozda **kümelenmiş** DSB üretir; onarım çok daha zor — animasyonda alfa izi boyunca yoğun hasar noktaları, X-ışınında dağınık tek hasarlar olarak çizilmeli. Görsel fark, `w_R` tablosunun görsel karşılığı.

**Doz eşikleri (referans etiketleri için):**

```
Doğal fon 2.4 mSv/yıl · 0.5 Gy kan sayımı değişir · 1 Gy bulantı
2 Gy cilt eritemi · 3 Gy geçici saç dökülmesi · 0.5 Gy lens opasitesi
LD50/60 ≈ 4–4.5 Gy (tedavisiz) · 6–10 Gy GI sendromu · >10 Gy SSS
Stokastik risk katsayısı ≈ 5.5 %/Sv (ICRP 103)
Nokta kaynak doz hızı  Ḋ = Γ·A/r²        Ters kare: D ∝ 1/r²
```

### 1.K — Termal model ve enerji muhasebesi

```
Demet gücü       P = I·V
Biriken ısı      Q = ∫P_dep·dt,  P_dep = P·(1−η_X)·f_geçen
Sıcaklık artışı  ΔT = Q/(m·c_p)
Geçici ısı       ρ·c_p·∂T/∂t = ∇·(k∇T) + q'''
İletim           P = k·A·ΔT/L
Işıma (S-B)      P = ε·σ_SB·A·(T⁴ − T_amb⁴)
Erime            Q = m·(c_p·ΔT + L_f);  buharlaşma  += m·L_v
```

**Erime noktaları (K)** — katot malzemesi seçiminin sonucu:

```
W 3695 · Re 3459 · Ta 3290 · Mo 2896 · Nb 2750 · Ir 2719 · Cr 2180
Ti 1941 · Fe 1811 · Ni 1728 · Cu 1358 · Au 1337 · Ag 1235 · Al 933
Zn 693 · Pb 601 · Bi 544 · Sn 505 · In 430 · Ga 303 · Hg 234
Wood metali 343
```

Kullanıcı katot olarak indiyum (430 K) seçip gücü açınca: kızıllaşma ~800 K'de başlamaz bile, doğrudan erir. Tungsten seçince 3000 K'de beyaz-akkor parlar ve Richardson'dan termiyonik emisyon patlar → akım kendi kendini besler. Bu geri besleme döngüsü modellenmeli.

**Akkor rengi (Planck → sRGB):**

```
B(λ,T) = (2hc²/λ⁵)/(exp(hc/(λk_BT)) − 1)
Wien:  λ_max·T = 2.8978e-3 m·K
Draper noktası: ~798 K'de gözle görünür ilk kızıllık
Pipeline: Planck → CIE XYZ (CMF ile integral) → sRGB → shader emissive
```

**Enerji muhasebesi:**

```
Duvar prizi gücü  P_priz = P_demet/η_toplam
  η: HV besleme 0.85–0.95 · RF klistron 0.40–0.65 · mıknatıs sürücü değişken
Tüketim  E[kWh] = ∫P·dt / 3.6e6
```

### 1.L — Görsel modellerin fiziği

**Şimşek / ark üretimi.** Fiziksel doğru yöntem, dielektrik delinme modeli (Niemeyer–Pietronero–Wiesmann): Laplace denklemi çözülür, büyüme olasılığı `p_i ∝ φ_i^η` (yıldırım için η ≈ 1). Gerçek zaman için pahalı. Pratik yaklaşım: **özyinelemeli orta nokta yer değiştirme** (fractal subdivision) + olasılıksal dallanma, fraktal boyut hedefi D ≈ 1.7, dal açısı 16–30°. Kanal uzunluğu `L = V/E_br` ile ölçeklenir → 300 kV @ 30 kV/cm = 10 cm, kullanıcının şartnamesi.

Ark rengi: kanal 20 000–30 000 K → mavi-beyaz; çevresindeki korona N₂ ikinci pozitif bandı (337 nm) ve N₂⁺ birinci negatif bandından (391 nm) menekşe-mavi.

**Demet parlaklığı:** Yüksek vakumda demet görünmezdir — bunu gizlemek değil, göstermek gerek. Rezidüel gaz basıncına göre iyonlaşma parlaklığı `∝ n_gaz · I_demet` ile ölçeklenmeli; kullanıcı basıncı düşürdükçe demet sönmeli, geriye sadece hedefteki parıltı ve floresan kalmalı.

---

