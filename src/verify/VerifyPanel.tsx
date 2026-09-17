import { useMemo, useState } from 'react';
import { Panel, Picker, Readout, Slider, si } from '../ui/Controls.tsx';
import { ArcCanvas } from '../ui/ArcCanvas.tsx';
import { PaschenChart } from '../ui/PaschenChart.tsx';
import { SpectrumChart } from '../ui/SpectrumChart.tsx';

import { gasProperties, relativeDensity, type GasId } from '../physics/gas/gases.ts';
import { sphereCoronaOnsetVoltageV, coronaIntensity } from '../physics/gas/corona.ts';
import { sparkLengthM, storedEnergyJ } from '../physics/gas/arc.ts';
import { sphereCapacitanceF } from '../physics/sources/vandeGraaff.ts';
import { productionEfficiency } from '../physics/interaction/bremsstrahlung.ts';
import {
  naturalThresholdMeV,
  thickTargetNeutronYieldPerS,
  gdrPeakEnergyMeV,
} from '../physics/interaction/photoneutron.ts';
import { ELEMENTS, elementBySymbol, densityKgPerM3 } from '../physics/data/elements.ts';
import { equilibriumTempK, type ThermalBody } from '../physics/thermal/heat.ts';
import { blackbodySrgb255, glowIntensity, DRAPER_POINT_K } from '../physics/thermal/blackbody.ts';

const GASES: readonly { value: GasId; label: string }[] = [
  { value: 'air', label: 'Hava' },
  { value: 'n2', label: 'Azot (N₂)' },
  { value: 'ar', label: 'Argon' },
  { value: 'ne', label: 'Neon' },
  { value: 'he', label: 'Helyum' },
  { value: 'sf6', label: 'SF₆ (yalıtkan)' },
  { value: 'co2', label: 'CO₂' },
];

const ANODES = [29, 42, 47, 74, 79].map((z) => {
  const e = ELEMENTS.find((x) => x.Z === z)!;
  return { value: z, label: `${e.symbol} (Z=${z})` };
});

const TARGETS = ['Be', 'Al', 'Cu', 'Ta', 'W', 'Pb', 'Th', 'U'].map((s) => {
  const e = elementBySymbol(s)!;
  return { value: s, label: `${e.symbol} · Z=${e.Z}` };
});

const CATHODES = ['W', 'Ta', 'Mo', 'Ni', 'Cu', 'Al', 'Pb', 'Sn', 'In'].map((s) => ({
  value: s,
  label: `${s} · erime ${elementBySymbol(s)!.meltingPointK.toFixed(0)} K`,
}));

export function VerifyPanel() {
  return (
    <div className="app">
      <div className="grid">
        <HighVoltagePanel />
        <XrayPanel />
        <NeutronPanel />
        <CathodePanel />
      </div>
    </div>
  );
}

function HighVoltagePanel() {
  const [voltageV, setVoltageV] = useState(300e3);
  const [radiusM, setRadiusM] = useState(0.15);
  const [gas, setGas] = useState<GasId>('air');
  const [pressurePa, setPressurePa] = useState(101325);
  const [grounded, setGrounded] = useState(false);

  const m = useMemo(() => {
    const delta = relativeDensity(pressurePa, 293.15);
    const eBr = gasProperties(gas).breakdownFieldVPerM * delta;
    const onset = sphereCoronaOnsetVoltageV(radiusM, delta);
    const cap = sphereCapacitanceF(radiusM);
    return {
      eBr,
      onset,
      cap,
      maxV: eBr * radiusM,
      spark: sparkLengthM(voltageV, eBr),
      corona: coronaIntensity(voltageV, onset),
      energy: storedEnergyJ(cap, voltageV),
    };
  }, [voltageV, radiusM, gas, pressurePa]);

  const over = voltageV > m.maxV;

  return (
    <Panel
      title="1 · Yüksek gerilim"
      hint="Kıvılcım uzunluğu V / E_delinme'den geliyor. Havada 30 kV/cm, yani 300 kV tam 10 cm."
    >
      <ArcCanvas
        lengthM={grounded ? 0 : m.spark}
        coronaIntensity={m.corona}
        sceneWidthM={0.9}
        grounded={grounded}
      />

      <div style={{ marginTop: 14 }}>
        <Slider
          label="Terminal gerilimi"
          value={voltageV}
          min={1e4}
          max={2e6}
          step={1e4}
          display={`${si(voltageV, 0)}V`}
          onChange={setVoltageV}
        />
        <Slider
          label="Küre yarıçapı"
          value={radiusM}
          min={0.05}
          max={0.6}
          step={0.01}
          display={`${(radiusM * 100).toFixed(0)} cm`}
          onChange={setRadiusM}
        />
        <Picker label="Ortam gazı" value={gas} options={GASES} onChange={setGas} />
        <Slider
          label="Basınç"
          value={pressurePa}
          min={1}
          max={1e6}
          step={0.02}
          log
          display={`${si(pressurePa, 1)}Pa`}
          onChange={setPressurePa}
        />
        <label
          style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center' }}
        >
          <input type="checkbox" checked={grounded} onChange={(e) => setGrounded(e.target.checked)} />
          Yük hedefe yönlendirildi (ark yok)
        </label>
      </div>

      <div className="readouts">
        <Readout
          k="Kıvılcım"
          v={grounded ? '—' : `${(m.spark * 100).toFixed(1)} cm`}
          {...(grounded ? { tone: 'zero' as const } : {})}
        />
        <Readout k="Korona başlangıcı" v={`${si(m.onset, 0)}V`} />
        <Readout k="Kapasitans" v={`${si(m.cap, 1)}F`} />
        <Readout k="Depolanan enerji" v={`${si(m.energy, 2)}J`} />
        <Readout k="Delinme sınırı" v={`${si(m.maxV, 0)}V`} {...(over ? { tone: 'hot' as const } : {})} />
      </div>

      {over ? (
        <p className="note">
          Gerilim kürenin kendi delinme sınırını geçti. Gerçek bir cihazda terminal burada boşalır;
          SF₆ seçmek veya yarıçapı büyütmek sınırı yükseltir.
        </p>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <PaschenChart gas={gas} pressurePa={pressurePa} gapM={0.01} />
        <p className="note">
          Paschen eğrisi (1 cm aralık). Basınç kaydırıcısını sola çekince delinme gerilimi önce
          düşer, minimumu geçince TEKRAR yükselir — çarpışacak molekül kalmaz.
        </p>
      </div>
    </Panel>
  );
}

function XrayPanel() {
  const [anodeZ, setAnodeZ] = useState(74);
  const [kv, setKv] = useState(120);
  const [currentMa, setCurrentMa] = useState(200);
  const [filterMm, setFilterMm] = useState(2.5);

  const m = useMemo(() => {
    const voltageV = kv * 1000;
    const beamW = voltageV * (currentMa / 1000);
    const eta = productionEfficiency(anodeZ, voltageV);
    return { beamW, eta, heatW: beamW * (1 - eta), xrayW: beamW * eta };
  }, [anodeZ, kv, currentMa]);

  return (
    <Panel
      title="2 · X-ışını tüpü"
      hint="Sürekli spektrum Kramers yasasından; karakteristik diken ancak gerilim K kabuk bağlanma enerjisini geçince doğar."
    >
      <SpectrumChart anodeZ={anodeZ} tubeVoltageV={kv * 1000} filterMm={filterMm} />

      <div style={{ marginTop: 14 }}>
        <Picker label="Anot malzemesi" value={anodeZ} options={ANODES} onChange={setAnodeZ} />
        <Slider
          label="Tüp gerilimi"
          value={kv}
          min={20}
          max={200}
          step={1}
          display={`${kv} kV`}
          onChange={(v) => setKv(Math.round(v))}
        />
        <Slider
          label="Tüp akımı"
          value={currentMa}
          min={1}
          max={800}
          step={1}
          display={`${currentMa.toFixed(0)} mA`}
          onChange={(v) => setCurrentMa(Math.round(v))}
        />
        <Slider
          label="Alüminyum filtre"
          value={filterMm}
          min={0}
          max={10}
          step={0.1}
          display={`${filterMm.toFixed(1)} mm`}
          onChange={setFilterMm}
        />
      </div>

      <div className="readouts">
        <Readout k="Demet gücü" v={`${si(m.beamW, 1)}W`} />
        <Readout k="X-ışını verimi" v={`${(m.eta * 100).toFixed(2)} %`} />
        <Readout k="X-ışını gücü" v={`${si(m.xrayW, 1)}W`} />
        <Readout k="Anot ısı yükü" v={`${si(m.heatW, 1)}W`} tone="hot" />
      </div>

      <p className="note">
        Tungstende 100 kV'ta verim yalnızca %0.8. Geri kalan her şey ısı — anot soğutmasının
        neden bu kadar büyük bir mühendislik problemi olduğu buradan görünüyor.
      </p>
    </Panel>
  );
}

function NeutronPanel() {
  const [targetSym, setTargetSym] = useState('W');
  const [energyMeV, setEnergyMeV] = useState(9);
  const [beamKw, setBeamKw] = useState(1);

  const m = useMemo(() => {
    const el = elementBySymbol(targetSym)!;
    const threshold = naturalThresholdMeV(el.Z, el.massNumber);
    const yieldPerS = thickTargetNeutronYieldPerS(el.Z, el.massNumber, energyMeV, beamKw * 1000);
    return {
      el,
      threshold,
      yieldPerS,
      gdr: gdrPeakEnergyMeV(el.massNumber),
      above: energyMeV > threshold,
    };
  }, [targetSym, energyMeV, beamKw]);

  return (
    <Panel
      title="3 · Fotonükleer eşik"
      hint="Elektron demeti → bremsstrahlung → dev dipol rezonansı → (γ,n). Eşiğin altında sıfır, tam olarak sıfır."
    >
      <ThresholdBar energyMeV={energyMeV} thresholdMeV={m.threshold} gdrMeV={m.gdr} />

      <div style={{ marginTop: 14 }}>
        <Picker label="Hedef element" value={targetSym} options={TARGETS} onChange={setTargetSym} />
        <Slider
          label="Elektron enerjisi"
          value={energyMeV}
          min={0.5}
          max={40}
          step={0.1}
          display={`${energyMeV.toFixed(1)} MeV`}
          onChange={setEnergyMeV}
        />
        <Slider
          label="Demet gücü"
          value={beamKw}
          min={0.01}
          max={50}
          step={0.01}
          log
          display={`${si(beamKw * 1000, 1)}W`}
          onChange={setBeamKw}
        />
      </div>

      <div className="readouts">
        <Readout k="(γ,n) eşiği" v={`${m.threshold.toFixed(2)} MeV`} />
        <Readout k="GDR tepesi" v={`${m.gdr.toFixed(1)} MeV`} />
        <Readout
          k="Nötron verimi"
          v={m.above ? `${si(m.yieldPerS, 2)}n/s` : '0'}
          tone={m.above ? 'neutron' : 'zero'}
        />
        <Readout k="Durum" v={m.above ? 'ÜSTÜNDE' : 'ALTINDA'} tone={m.above ? 'neutron' : 'zero'} />
      </div>

      <p className="note">
        {m.above
          ? `${m.el.symbol} eşiği ${m.threshold.toFixed(2)} MeV aşıldı; çekirdekten nötron kopuyor ve 3. bölüme geçiyor.`
          : `${m.el.symbol} için ${m.threshold.toFixed(2)} MeV gerekiyor. Berilyuma geç: eşiği 1.66 MeV, diğer her şeyin 3-5 katı düşük.`}
      </p>
    </Panel>
  );
}

function ThresholdBar(props: { energyMeV: number; thresholdMeV: number; gdrMeV: number }) {
  const max = 40;
  const pct = (v: number) => Math.min(100, (v / max) * 100);
  const above = props.energyMeV > props.thresholdMeV;
  return (
    <div style={{ position: 'relative', height: 44, background: '#05070a', borderRadius: 8, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: `${pct(props.energyMeV)}%`,
          background: above
            ? 'linear-gradient(90deg, rgba(70,214,196,0.15), rgba(70,214,196,0.45))'
            : 'linear-gradient(90deg, rgba(134,143,161,0.10), rgba(134,143,161,0.22))',
          transition: 'width 90ms linear',
        }}
      />
      <div style={{ position: 'absolute', left: `${pct(props.thresholdMeV)}%`, top: 0, bottom: 0, width: 2, background: '#ff8a3d' }} />
      <div style={{ position: 'absolute', left: `${pct(props.gdrMeV)}%`, top: 0, bottom: 0, width: 1, background: '#3a4150' }} />
      <span
        style={{
          position: 'absolute',
          left: 10,
          top: 12,
          fontFamily: 'var(--mono)',
          fontSize: 13,
          color: above ? 'var(--neutron)' : 'var(--muted)',
        }}
      >
        {props.energyMeV.toFixed(1)} MeV
      </span>
      <span
        style={{
          position: 'absolute',
          right: 10,
          top: 14,
          fontSize: 11,
          color: 'var(--muted)',
          fontFamily: 'var(--mono)',
        }}
      >
        eşik {props.thresholdMeV.toFixed(2)} · GDR {props.gdrMeV.toFixed(0)}
      </span>
    </div>
  );
}

function CathodePanel() {
  const [sym, setSym] = useState('W');
  const [powerW, setPowerW] = useState(60);

  const m = useMemo(() => {
    const el = elementBySymbol(sym)!;
    // 1 cm capinda, 1 mm kalinlikta bir disk; iki yuzunden isima yapiyor.
    const areaM2 = 2 * Math.PI * 0.005 * 0.005;
    const volumeM3 = Math.PI * 0.005 * 0.005 * 0.001;
    const body: ThermalBody = {
      massKg: densityKgPerM3(el) * volumeM3,
      specificHeatJPerKgK: el.specificHeatJPerKgK,
      surfaceAreaM2: areaM2,
      emissivity: 0.35,
      conductanceWPerK: 0.02,
      ambientTempK: 293.15,
      meltingPointK: el.meltingPointK,
      boilingPointK: el.boilingPointK,
      latentHeatFusionJPerKg: el.latentHeatFusionKJPerKg * 1000,
      latentHeatVaporJPerKg: el.latentHeatVaporKJPerKg * 1000,
    };
    const tEq = equilibriumTempK(body, powerW);
    const melted = tEq >= el.meltingPointK;
    const shown = melted ? el.meltingPointK : tEq;
    const [r, g, b] = blackbodySrgb255(shown);
    return {
      el,
      body,
      tEq,
      melted,
      shown,
      rgb: `rgb(${r},${g},${b})`,
      glow: glowIntensity(shown),
      visible: shown > DRAPER_POINT_K,
    };
  }, [sym, powerW]);

  return (
    <Panel
      title="4 · Katot ısıl dengesi"
      hint="Akkor rengi Planck spektrumundan CIE üzerinden türetiliyor — elle boyanmadı."
    >
      <div
        style={{
          height: 120,
          borderRadius: 8,
          background: '#05070a',
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: m.melted ? '46% 54% 62% 38% / 58% 42% 58% 42%' : '50%',
            background: m.visible ? m.rgb : '#2a2f39',
            boxShadow: m.visible
              ? `0 0 ${Math.min(90, 12 + m.glow * 26)}px ${Math.min(40, 4 + m.glow * 12)}px ${m.rgb}`
              : 'none',
            transition: 'background 140ms linear, border-radius 300ms ease',
          }}
        />
        {m.melted ? (
          <span
            style={{
              position: 'absolute',
              bottom: 8,
              fontSize: 11,
              fontFamily: 'var(--mono)',
              color: 'var(--danger)',
            }}
          >
            ERİDİ
          </span>
        ) : null}
      </div>

      <div style={{ marginTop: 14 }}>
        <Picker label="Katot malzemesi" value={sym} options={CATHODES} onChange={setSym} />
        <Slider
          label="Biriken güç"
          value={powerW}
          min={0.1}
          max={2000}
          step={0.01}
          log
          display={`${si(powerW, 1)}W`}
          onChange={setPowerW}
        />
      </div>

      <div className="readouts">
        <Readout
          k="Denge sıcaklığı"
          v={m.melted ? `> ${m.el.meltingPointK.toFixed(0)} K` : `${m.tEq.toFixed(0)} K`}
          tone={m.melted ? 'hot' : undefined}
        />
        <Readout k="Erime noktası" v={`${m.el.meltingPointK.toFixed(0)} K`} />
        <Readout k="Kütle" v={`${(m.body.massKg * 1000).toFixed(2)} g`} />
        <Readout
          k="Görünür parıltı"
          v={m.visible ? `×${m.glow.toFixed(2)}` : 'yok'}
          tone={m.visible ? 'hot' : 'zero'}
        />
      </div>

      <p className="note">
        {m.melted
          ? `${m.el.symbol} bu güçte eridi. Tungstene geç: 3695 K erime noktasıyla aynı güçte hâlâ katı ve göz alıcı parlıyor.`
          : m.visible
            ? `Draper noktasının (798 K) üstünde; ${m.tEq.toFixed(0)} K'de gözle görülür kızıllık var.`
            : `${m.tEq.toFixed(0)} K henüz Draper noktasının altında — ısınıyor ama görünür ışık yok.`}
      </p>
    </Panel>
  );
}
