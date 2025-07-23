// ------------------------------------------------------------
//  Slovak / Czech / Hungarian “word‑date” helper
// ------------------------------------------------------------
//
//  import { datumOrRangeByCountry } from './dateWordsMulti.js';
//
//  datumOrRangeByCountry(rawDate, dod_krajina)
//
//  • rawDate:  'dd.MM.yy' | 'dd.MM.yyyy'
//              alebo rozsah 'dd.MM.yy-dd.MM.yy'
//  • dod_krajina:  "Slovensko", "Česko", "Maďarsko", resp. anglické varianty
//
//  Vracia (príklady):
//    SK: „štrnásteho augusta dvetisíc dvadsaťpäť“
//    CZ: „čtrnáctého srpna dva tisíce dvacet pět“
//    HU: „kétezer-huszonöt augusztus tizennegyedike“
//    SK/CZ rozsah: „od … do …“
//    HU rozsah  : „kétezer-huszonöt augusztus tizennegyedike–huszonpäťödike“
// ------------------------------------------------------------
import { parse } from 'date-fns';

/* ---------- všeobecné drobnosti ---------------------------- */
const strip   = s => (s ?? '').toString().trim();
const isNull  = s => /^null$/i.test(strip(s) || '');
const normC   = s => strip(s).toLowerCase()
                             .normalize('NFD')
                             .replace(/\p{Diacritic}/gu, '');

function parseDateLoose(str) {
  const raw = strip(str);
  if (!raw) return null;

  // 00–68 ⇒ 2000–2068, 69–99 ⇒ 1969–1999
  const fix = s =>
    s.length === 8
      ? s.slice(0,6) + ((+s.slice(-2) <= 68 ? '20' : '19') + s.slice(-2))
      : s;

  const val = fix(raw);
  const fmt = val.length === 10 ? 'dd.MM.yyyy' : 'dd.MM.yy';
  const d   = parse(val, fmt, new Date());
  return Number.isNaN(d) ? null : d;
}

/* ---------- S L O V A K ------------------------------------ */
const dniSk = [,
  'prvého','druhého','tretieho','štvrtého','piateho','šiesteho','siedmeho',
  'ôsmeho','deviateho','desiateho','jedenásteho','dvanásteho','trinásteho',
  'štrnásteho','pätnásteho','šestnásteho','sedemnásteho','osemnásteho',
  'devätnásteho','dvadsiateho','dvadsiateho prvého','dvadsiateho druhého',
  'dvadsiateho tretieho','dvadsiateho štvrtého','dvadsiateho piateho',
  'dvadsiateho šiesteho','dvadsiateho siedmeho','dvadsiateho ôsmeho',
  'dvadsiateho deviateho','tridsiateho','tridsiateho prvého'
];
const mesiaceSk = [
  'januára','februára','marca','apríla','mája','júna',
  'júla','augusta','septembra','októbra','novembra','decembra'
];
const numSk = n => {
  const baz = ['', 'jeden', 'dva', 'tri', 'štyri', 'päť',
               'šesť', 'sedem', 'osem', 'deväť'];
  const teen = ['desať','jedenásť','dvanásť','trinásť','štrnásť','pätnásť',
                'šestnásť','sedemnásť','osemnásť','devätnásť'];
  const des = ['', '', 'dvadsať','tridsať','štyridsať','päťdesiat',
               'šesťdesiat','sedemdesiat','osemdesiat','deväťdesiat'];
  if (n < 10)  return baz[n];
  if (n < 20)  return teen[n-10];
  return des[Math.floor(n/10)] + (n%10 ? ' ' + baz[n%10] : '');
};
const rokSk = y =>
  y >= 2000
    ? 'dvetisíc' + (y%100 ? ' ' + numSk(y%100) : '')
    : 'tisíc deväťsto ' + numSk(y%100);

function skDate(str){
  const d = parseDateLoose(str);
  if (!d) return strip(str);
  return `${dniSk[d.getDate()]} ${mesiaceSk[d.getMonth()]} ${rokSk(d.getFullYear())}`;
}
const skRange = (raw) => {
  const [f,t] = raw.split('-').map(strip);
  return t ? `od ${skDate(f)} do ${skDate(t)}` : skDate(f);
};

/* ---------- C Z E C H -------------------------------------- */
const dniCz = [,
  'prvního','druhého','třetího','čtvrtého','pátého','šestého','sedmého',
  'osmého','devátého','desátého','jedenáctého','dvanáctého','třináctého',
  'čtrnáctého','patnáctého','šestnáctého','sedmnáctého','osmnáctého',
  'devatenáctého','dvacátého','dvacátého prvního','dvacátého druhého',
  'dvacátého třetího','dvacátého čtvrtého','dvacátého pátého',
  'dvacátého šestého','dvacátého sedmého','dvacátého osmého',
  'dvacátého devátého','třicátého','třicátého prvního'
];
const mesiaceCz = [
  'ledna','února','března','dubna','května','června',
  'července','srpna','září','října','listopadu','prosince'
];
const numCz = n => {
  const baz = ['', 'jeden', 'dva', 'tři', 'čtyři', 'pět',
               'šest', 'sedm', 'osm', 'devět'];
  const teen = ['deset','jedenáct','dvanáct','třináct','čtrnáct','patnáct',
                'šestnáct','sedmnáct','osmnáct','devatenáct'];
  const des = ['', '', 'dvacet','trřicet','čtyřicet','padesát',
               'šedesát','sedmdesát','osmdesát','devadesát'];
  if (n < 10)  return baz[n];
  if (n < 20)  return teen[n-10];
  return des[Math.floor(n/10)] + (n%10 ? ' ' + baz[n%10] : '');
};
const rokCz = y =>
  y >= 2000
    ? 'dva tisíce' + (y%100 ? ' ' + numCz(y%100) : '')
    : 'tisíc devět set ' + numCz(y%100);

function czDate(str){
  const d = parseDateLoose(str);
  if (!d) return strip(str);
  return `${dniCz[d.getDate()]} ${mesiaceCz[d.getMonth()]} ${rokCz(d.getFullYear())}`;
}
const czRange = (raw) => {
  const [f,t] = raw.split('-').map(strip);
  return t ? `od ${czDate(f)} do ${czDate(t)}` : czDate(f);
};

/* ---------- H U N G A R I A N ------------------------------- */
const napHu = [,
  'elseje','másodika','harmadika','negyedike','ötödike','hatodika','hetedike',
  'nyolcadika','kilencedike','tizedike','tizenegyedike','tizenkettedike',
  'tizenharmadika','tizennegyedike','tizenötödike','tizenhatodika',
  'tizenhetedike','tizennyolcadika','tizenkilencedike','huszadika',
  'huszonegyedike','huszonkettedike','huszonharmadika','huszonnegyedike',
  'huszonötödike','huszonhatodika','huszonhetedike','huszonnyolcadika',
  'huszonkilencedike','harmincadika','harmincegyedike'
];
const honapHu = [
  'január','február','március','április','május','június',
  'július','augusztus','szeptember','október','november','december'
];
const numHu = n => {
  const egyes = ['', 'egy', 'kettő', 'három', 'négy', 'öt',
                 'hat', 'hét', 'nyolc', 'kilenc'];
  const teen  = ['tíz','tizenegy','tizenkettő','tizenhárom','tizennégy','tizenöt',
                 'tizenhat','tizenhét','tizennyolc','tizenkilenc'];
  const tiz   = ['', '', 'húsz','harminc','negyven','ötven','hatvan',
                 'hetven','nyolcvan','kilencven'];
  if (n < 10)  return egyes[n];
  if (n < 20)  return teen[n-10];
  return tiz[Math.floor(n/10)] + (n%10 ? egyes[n%10] : '');
};
const huYear = y =>
  y >= 2000
    ? 'kétezer' + (y%100 ? '-' + numHu(y%100) : '')
    : 'ezerkilencszáz' + (y%100 ? '-' + numHu(y%100) : '');

function huDate(str){
  const d = parseDateLoose(str);
  if (!d) return strip(str);
  return `${huYear(d.getFullYear())} ${honapHu[d.getMonth()]} ${napHu[d.getDate()]}`;
}
const huRange = (raw) => {
  const [f,t] = raw.split('-').map(strip);
  if (!t) return huDate(f);
  const d1 = parseDateLoose(f);
  const d2 = parseDateLoose(t);
  if (d1 && d2 && d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth()){
    const base = `${huYear(d1.getFullYear())} ${honapHu[d1.getMonth()]}`;
    return `${base} ${napHu[d1.getDate()]}–${napHu[d2.getDate()]}`;
  }
  return `${huDate(f)} – ${huDate(t)}`;
};

/* ---------- Public API ------------------------------------- */
export function datumOrRangeByCountry(raw, dod_krajina){
  if (isNull(raw)) return null;
  const c = normC(dod_krajina);

  if (/(cesko|czech|ceska\s*republik)/.test(c))       return czRange(raw);
  if (/(madarsk|hungar)/.test(c))                    return huRange(raw);
                                                     return skRange(raw); // default SK
}
