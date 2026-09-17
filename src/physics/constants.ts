/**
 * Temel fiziksel sabitler (CODATA 2018) ve birim donusumleri.
 * PHYSICS.md bolum 1.0.
 *
 * Birim kurali: degisken adlari birimi tasir. Belirsizlik olan her yerde
 * sonek zorunludur (`energyMeV`, `lengthM`, `pressurePa`). Ic hesaplar SI'da
 * yapilir; parcacik enerjileri gelenege uyup MeV'de tasinir.
 */

// --- Evrensel sabitler (SI) ---
export const C = 2.99792458e8; // isik hizi, m/s
export const ELEMENTARY_CHARGE = 1.602176634e-19; // C
export const EPSILON_0 = 8.8541878128e-12; // vakum gecirgenligi, F/m
export const MU_0 = 1.25663706212e-6; // vakum geciriciligi, N/A^2
export const PLANCK = 6.62607015e-34; // J*s
export const HBAR = 1.054571817e-34; // J*s
export const BOLTZMANN = 1.380649e-23; // J/K
export const BOLTZMANN_EV = 8.617333262e-5; // eV/K
export const AVOGADRO = 6.02214076e23; // 1/mol
export const STEFAN_BOLTZMANN = 5.670374419e-8; // W/(m^2*K^4)
export const RYDBERG_INF = 1.0973731568160e7; // 1/m
export const RYDBERG_ENERGY_EV = 13.605693122994; // eV
export const BOHR_RADIUS = 5.29177210903e-11; // m
export const CLASSICAL_ELECTRON_RADIUS = 2.8179403262e-15; // m
export const COMPTON_WAVELENGTH = 2.42631023867e-12; // m (elektron)
export const COULOMB_K = 1 / (4 * Math.PI * EPSILON_0); // 8.9875517923e9 N*m^2/C^2

// --- Durgun enerjiler (MeV) ---
export const ELECTRON_MASS_MEV = 0.51099895;
export const PROTON_MASS_MEV = 938.272088;
export const NEUTRON_MASS_MEV = 939.565421;
export const DEUTERON_MASS_MEV = 1875.612942;
export const ALPHA_MASS_MEV = 3727.379412;
export const ATOMIC_MASS_UNIT_MEV = 931.494102;

// --- Durgun kutleler (kg) ---
export const ELECTRON_MASS_KG = 9.1093837015e-31;
export const PROTON_MASS_KG = 1.67262192369e-27;
export const NEUTRON_MASS_KG = 1.67492749804e-27;
export const ATOMIC_MASS_UNIT_KG = 1.66053906660e-27;

// --- Birim donusumleri ---
export const EV_TO_J = 1.602176634e-19;
export const MEV_TO_J = 1.602176634e-13;
export const J_TO_MEV = 1 / MEV_TO_J;
export const BARN_TO_M2 = 1e-28;
export const M2_TO_BARN = 1e28;
export const TORR_TO_PA = 133.322368421;
export const PA_TO_TORR = 1 / TORR_TO_PA;
export const ATM_TO_PA = 101325;
export const BAR_TO_PA = 1e5;
export const KWH_TO_J = 3.6e6;
export const J_TO_KWH = 1 / KWH_TO_J;
export const CURIE_TO_BQ = 3.7e10;
export const BQ_TO_CURIE = 1 / CURIE_TO_BQ;
export const DAY_S = 86400;
export const YEAR_S = 365.25 * DAY_S;

/** hc, foton enerjisi <-> dalga boyu icin. E[eV] = HC_EV_NM / lambda[nm]. */
export const HC_EV_NM = 1239.841984;

/** Standart kosullar. */
export const T_STANDARD_K = 293.15;
export const P_STANDARD_PA = ATM_TO_PA;

/** Bethe-Bloch sabiti K = 4*pi*N_A*r_e^2*m_e*c^2, MeV*mol^-1*cm^2. */
export const BETHE_K = 0.307075;

/** Richardson-Dushman evrensel sabiti, A/(m^2*K^2). */
export const RICHARDSON_A0 = 1.20173e6;

/** Child-Langmuir elektron katsayisi: J = k * V^1.5 / d^2, A/m^2 (V volt, d m). */
export const CHILD_LANGMUIR_ELECTRON = 2.334e-6;

/** Termal notron referansi. */
export const THERMAL_NEUTRON_EV = 0.0253;
export const THERMAL_NEUTRON_SPEED = 2200; // m/s

/** Hava icin varsayilan delinme alani, V/m (30 kV/cm, duzgun alan, deniz seviyesi). */
export const AIR_BREAKDOWN_V_PER_M = 3.0e6;
