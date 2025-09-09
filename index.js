import express from 'express';
import cors from 'cors';               // 🔹 pridané
import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';
import { datumOrRangeByCountry } from './dateWordsMulti.js';

const PORT    = process.env.PORT || 3000;
const CSV_URL = process.env.CSV_URL;

const app = express();

/* 1) CORS – musí byť pred všetkými routami ------------------- */
app.use(
  cors({
    origin: [
      'https://dashboard.vapi.ai',     // tester v dashboarde
      'https://app.vapi.ai'            // produkčné hovory
    ],
    methods: ['GET', 'OPTIONS']
  })
);
/* ------------------------------------------------------------ */

/* util – always string, trim, bez BOM */
const clean = v => (v ?? '').toString().replace(/^\uFEFF/, '').trim();

/* ---- parseItems ------------------------------------------- */
function parseItems(str = '') {
  return str
    .split('|')
    .map(s => s.trim())
    .filter(Boolean)
    .map(raw => {
      const idx  = raw.lastIndexOf('(');
      const left = idx !== -1 ? raw.slice(0, idx) : raw;
      const meta = idx !== -1 ? raw.slice(idx + 1, -1) : '';

      /* kód a názov */
      let kod = null, nazov = left.replace(/^-+/, '').trim();
      const mCode = nazov.match(/^(\d+)\s*[-\s]+(.+)$/);
      if (mCode) {
        kod   = mCode[1];
        nazov = mCode[2].trim();
      }

      /* množstvo */
      const qty = parseFloat(
        (meta.match(/Objednané množstvo\s*:\s*([\d.,]+)/i) || [, ''])[1]
          .replace(',', '.')
      ) || null;

      /* cena + mena (EUR, CZK …) */
      const mPrice = meta.match(/Suma položky\s*:\s*([\d.,]+)\s*([A-Z]{3})?/i);
      const cena   = mPrice ? parseFloat(mPrice[1].replace(',', '.')) : null;
      const mena   = mPrice && mPrice[2] ? mPrice[2] : null;

      return {
        kod_polozky:      kod,
        nazov_polozky:    nazov,
        mnozstvo_polozky: qty,
        cena_polozky:     cena,
        mena_polozky:     mena
      };
    });
}

/* skracovanie hlavičky na posledný „OBJ.…“ ------------------- */
function shortenKeys(r) {
  const o = {};
  for (const [k, v] of Object.entries(r)) {
    let key = k.includes('-') ? k.split('-').pop() : k;
    const m = key.match(/(OBJ\.[\w.]+)$/);
    if (m) key = m[1];
    o[clean(key)] = v;
  }
  return o;
}

/* normálizácia stĺpcov --------------------------------------- */
function normalize(r) {
  /* 👉 dôležité: získame krajinu hneď na začiatku,
     aby sme ju mohli poslať helperu pri každom dátume */
  const dod_krajina = clean(r['OBJ.RefZeme2']);

  return {
    id_objednavky:            clean(r['OBJ.ID']),
    cislo_objednavky:         clean(r['OBJ.PDoklad']),

    /* ⏰ číselný alebo rozsahový dátum → slovom */
    datum_objednavky:
      datumOrRangeByCountry(clean(r['OBJ.Datum']), dod_krajina),

    zdroj_objednavky:         clean(r['OBJ.SText']),

    /* … ostatné ne‑dátumové polia … */
    nazov_firmy:              clean(r['OBJ.Firma']),
    ico:                      clean(r['OBJ.ICO']),
    dic:                      clean(r['OBJ.DIC']),
    icdph:                    clean(r['OBJ.ICDPH']),

    meno:                     clean(r['OBJ.Jmeno']),
    ulica:                    clean(r['OBJ.Ulica']),
    psc:                      clean(r['OBJ.PSC']),
    obec:                     clean(r['OBJ.Obec']),
    tel:                      clean(r['OBJ.Tel']),
    email:                    clean(r['OBJ.Email']),

    dod_firma:                clean(r['OBJ.Firma2']),
    dod_meno:                 clean(r['OBJ.Jmeno2']),
    dod_ulica:                clean(r['OBJ.Ulice2']),
    dod_psc:                  clean(r['OBJ.PSC2']),
    dod_obec:                 clean(r['OBJ.Obec2']),
    dod_krajina,                              // už máme vyčistené
    dod_tel:                  clean(r['OBJ.Tel2']),
    dod_email:                clean(r['OBJ.Email2']),

    /* 🔹 položky rozparsované na pole objektov */
    polozky:                  parseItems(clean(r['Polozky objednavky'])),

    forma_uhrady:             clean(r['OBJ.RelForUh']),
    prepravca:                clean(r['OBJ.RefDopravci']),

    mena_cudzia:              clean(r['OBJ.RefCM']),
    suma_cudzia:              clean(r['OBJ.CmCelkem']),
    suma_eur:                 clean(r['OBJ.KcCelkem']),

    stav:                     clean(r['OBJ.Labels']),

    /* ⏰ ďalšie dátumy → slovom (môžu byť prázdne/NULL) */
    datum_storna:
      datumOrRangeByCountry(clean(r['OBJ.DatStorn']), dod_krajina),

    vyfakturovana:            clean(r['OBJ.Vyrizeno']),

    poznamka:                 clean(r['OBJ.Pozn']),
    dovod_storna:             clean(r['OBJ.RefVPrDovodstorn']),
    cislo_faktury:            clean(r['OBJ.VPrCislofakturyt']),
    objednane_u_dodavatela:   clean(r['OBJ.VPrObjednaneUdod']),

    planovane_odhadovane_naskladnenie_na_nas_sklad:
      datumOrRangeByCountry(clean(r['OBJ.VPrDatDodKuNam']), dod_krajina),

    predpokladany_datum_dodania_zakaznikovi:
      datumOrRangeByCountry(clean(r['OBJ.VPrDatumDodPom']), dod_krajina),

    dovod_meskania:           clean(r['OBJ.VPrDovodMeskanTo'])
  };
}
/* vždy čerstvé CSV ------------------------------------------- */
async function loadCsv() {
  const url  = `${CSV_URL}${CSV_URL.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const resp = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }});
  if (!resp.ok) throw new Error(`CSV fetch failed: ${resp.status}`);

  const raw = parse(await resp.text(), {
    delimiter: ';',
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_records_with_error: true
  });

  const rows = raw.map(r => normalize(shortenKeys(r)));
  console.log(`CSV načítané: ${rows.length} riadkov`);
  return rows;
}

/* --------- /orders ----------------------------------------- */
app.get('/orders', async (req, res) => {
  const q = clean(req.query.query);
  if (!q) return res.status(400).json({ error: 'pridaj ?query=' });

  try {
    const data = await loadCsv();
    let result = data.filter(r => r.cislo_objednavky === q);
    if (!result.length) result = data.filter(r => r.cislo_faktury === q);

    if (!result.length) return res.status(404).json({ error: 'nič sme nenašli' });

    // ✅ vráť jeden objekt 
    res.json(result);

    // (voliteľne) ak chceš vedieť, či bolo viac zásahov:
    // if (result.length > 1) res.set('X-Matches', String(result.length));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CSV sa nepodarilo načítať' });
  }
});

app.listen(PORT, () => console.log(`API beží na porte ${PORT}`));
