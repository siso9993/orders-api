import express from 'express';
import csv from 'csv-parser';
import { pipeline } from 'stream';
import { promisify } from 'util';

const PORT    = process.env.PORT || 3000;
const CSV_URL = process.env.CSV_URL;     // nastavíš v Railway

const pipe = promisify(pipeline);
const app  = express();

/* 🔹 pomocná funkcia – vždy string, bez medzier, CR, BOM … */
const clean = v => (v ?? '').toString().replace(/^\uFEFF/, '').trim();

/* ---------- robustné skrátenie hlavičky ------------------ */
function shorten(row) {
  const o = {};
  for (const [k, v] of Object.entries(row)) {
    let short = k.includes('-') ? k.split('-').pop() : k;           // 1️⃣ po „-“
    const m   = short.match(/(OBJ\.[\w.]+)$/);                     // 2️⃣ posledný OBJ.
    if (m) short = m[1];
    o[clean(short)] = v;
  }
  return o;
}
/* ---------------------------------------------------------- */

/* ----------- mapovanie na pekné kľúče + clean() ----------- */
function normalize(r) {
  return {
    id_objednavky:                   clean(r['OBJ.ID']),
    cislo_objednavky:                clean(r['OBJ.PDoklad']),
    datum_objednavky:                clean(r['OBJ.Datum']),
    zdroj_objednavky:                clean(r['OBJ.SText']),

    nazov_firmy:                     clean(r['OBJ.Firma']),
    ico:                             clean(r['OBJ.ICO']),
    dic:                             clean(r['OBJ.DIC']),
    icdph:                           clean(r['OBJ.ICDPH']),

    meno:                            clean(r['OBJ.Jmeno']),
    ulica:                           clean(r['OBJ.Ulica']),
    psc:                             clean(r['OBJ.PSC']),
    obec:                            clean(r['OBJ.Obec']),
    tel:                             clean(r['OBJ.Tel']),
    email:                           clean(r['OBJ.Email']),

    dod_firma:                       clean(r['OBJ.Firma2']),
    dod_meno:                        clean(r['OBJ.Jmeno2']),
    dod_ulica:                       clean(r['OBJ.Ulice2']),
    dod_psc:                         clean(r['OBJ.PSC2']),
    dod_obec:                        clean(r['OBJ.Obec2']),
    dod_krajina:                     clean(r['OBJ.RefZeme2']),
    dod_tel:                         clean(r['OBJ.Tel2']),
    dod_email:                       clean(r['OBJ.Email2']),

    polozky:                         clean(r['Polozky objednavky']),
    forma_uhrady:                    clean(r['OBJ.RelForUh']),
    prepravca:                       clean(r['OBJ.RefDopravci']),

    mena_cudzia:                     clean(r['OBJ.RefCM']),
    suma_cudzia:                     clean(r['OBJ.CmCelkem']),
    suma_eur:                        clean(r['OBJ.KcCelkem']),

    stav:                            clean(r['OBJ.Labels']),
    datum_storna:                    clean(r['OBJ.DatStorn']),
    vyfakturovana:                   clean(r['OBJ.Vyrizeno']),

    poznamka:                        clean(r['OBJ.Pozn']),
    dovod_storna:                    clean(r['OBJ.RefVPrDovodstorn']),
    cislo_faktury:                   clean(r['OBJ.VPrCislofakturyt']),
    objednane_u_dodavatela:          clean(r['OBJ.VPrObjednaneUdod']),
    planovane_naskladnenie:          clean(r['OBJ.VPrDatDodKuNam']),
    dovod_meskania:                  clean(r['OBJ.VPrDovodMeskanTo']),
  };
}
/* ---------------------------------------------------------- */

/* ------------ vždy stiahne ČERSTVÉ CSV -------------------- */
async function fetchCsv() {
  const url = `${CSV_URL}${CSV_URL.includes('?') ? '&' : '?'}t=${Date.now()}`; // cache‑buster
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error('Fetch failed: ' + res.status);

  const rows = [];
  await pipe(
    res.body,
    csv({ separator: ';' })
      .on('data', row => rows.push(normalize(shorten(row))))
  );

  console.log(`CSV načítané: ${rows.length} riadkov`);
  return rows;
}
/* ---------------------------------------------------------- */

app.get('/orders', async (req, res) => {
  const q = clean(req.query.query);
  if (!q) return res.status(400).json({ error: 'pridaj ?query=' });

  try {
    const data = await fetchCsv();          // ⬅ žiadna cache, vždy nové dáta

    let result = data.filter(r => r.cislo_objednavky === q);
    if (!result.length) result = data.filter(r => r.cislo_faktury === q);

    if (!result.length) return res.status(404).json({ error: 'nič sme nenašli' });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CSV sa nepodarilo načítať' });
  }
});

app.listen(PORT, () => console.log(`API beží na porte ${PORT}`));
