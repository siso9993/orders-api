import express from 'express';
import fetch from 'node-fetch';           // Node < 18 pridaj do dependencies
import { parse } from 'csv-parse/sync';

const PORT    = process.env.PORT || 3000;
const CSV_URL = process.env.CSV_URL;      // nastavíš v Railway

const app = express();

/* 🔹 common helper */
const clean = v => (v ?? '').toString().replace(/^\uFEFF/, '').trim();

/* 🔹 skrátenie hlavičky na OBJ.* */
function shortenKeys(row) {
  const o = {};
  for (const [k, v] of Object.entries(row)) {
    if (!k) continue;
    let key = k.includes('-') ? k.split('-').pop() : k;
    const m  = key.match(/(OBJ\.[\w.]+)$/);
    if (m) key = m[1];
    o[clean(key)] = v;
  }
  return o;
}

/* 🔹 mapujeme na pekné názvy */
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
    dovod_meskania:                  clean(r['OBJ.VPrDovodMeskanTo'])
  };
}

/* 🔹 vždy čerstvé CSV (cache‑buster) */
async function loadCsv() {
  const url  = `${CSV_URL}${CSV_URL.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const resp = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }});
  if (!resp.ok) throw new Error(`CSV fetch failed: ${resp.status}`);

  const text = await resp.text();
  const raw  = parse(text, {
    delimiter: ';',
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true
  });

  const rows = raw.map(r => normalize(shortenKeys(r)));
  console.log(`CSV načítané: ${rows.length} riadkov`);
  return rows;
}

/* 🔹 /orders endpoint */
app.get('/orders', async (req, res) => {
  const q = clean(req.query.query);
  if (!q) return res.status(400).json({ error: 'pridaj ?query=' });

  try {
    const data = await loadCsv();

    let result = data.filter(r => r.cislo_objednavky === q);
    if (!result.length) result = data.filter(r => r.cislo_faktury === q);

    if (!result.length) return res.status(404).json({ error: 'nič sme nenašli' });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'CSV sa nepodarilo načítať' });
  }
});

app.listen(PORT, () => console.log(`API beží na porte ${PORT}`));

