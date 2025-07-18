import express from 'express';
import csv from 'csv-parser';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const PORT      = process.env.PORT || 3000;
/*  ak by si chcel súbor prehodiť inde / premennú z Railway,
    nastav CSV_FILE, inak sa berie `api/pohoda_orders.csv` v repo  */
const CSV_FILE  = process.env.CSV_FILE ||
                  join(dirname(fileURLToPath(import.meta.url)), 'api', 'pohoda_orders.csv');

const CACHE_TTL = 30 * 1000;            // 30 s

const pipe  = promisify(pipeline);
const app   = express();

let cache     = [];
let lastFetch = 0;

// ------------------------- normalizácia stĺpcov ----------------------------
function normalize(r) {
  return {
    id_objednavky:                   r['OBJ.ID'],
    cislo_objednavky:                r['OBJ.PDoklad'],
    datum_objednavky:                r['OBJ.Datum'],
    zdroj_objednavky:                r['OBJ.SText'],

    nazov_firmy:                     r['OBJ.Firma'],
    ico:                             r['OBJ.ICO'],
    dic:                             r['OBJ.DIC'],
    icdph:                           r['OBJ.ICDPH'],

    meno:                            r['OBJ.Jmeno'],
    ulica:                           r['OBJ.Ulica'],
    psc:                             r['OBJ.PSC'],
    obec:                            r['OBJ.Obec'],
    tel:                             r['OBJ.Tel'],
    email:                           r['OBJ.Email'],

    dod_firma:                       r['OBJ.Firma2'],
    dod_meno:                        r['OBJ.Jmeno2'],
    dod_ulica:                       r['OBJ.Ulice2'],
    dod_psc:                         r['OBJ.PSC2'],
    dod_obec:                        r['OBJ.Obec2'],
    dod_krajina:                     r['OBJ.RefZeme2'],
    dod_tel:                         r['OBJ.Tel2'],
    dod_email:                       r['OBJ.Email2'],

    polozky:                         r['Polozky objednavky'],
    forma_uhrady:                    r['OBJ.RelForUh'],
    prepravca:                       r['OBJ.RefDopravci'],

    mena_cudzia:                     r['OBJ.RefCM'],
    suma_cudzia:                     r['OBJ.CmCelkem'],
    suma_eur:                        r['OBJ.KcCelkem'],

    stav:                            r['OBJ.Labels'],
    datum_storna:                    r['OBJ.DatStorn'],
    vyfakturovana:                   r['OBJ.Vyrizeno'],

    poznamka:                        r['OBJ.Pozn'],
    dovod_storna:                    r['OBJ.RefVPrDovodstorn'],
    cislo_faktury:                   r['OBJ.VPrCislofakturyt'],
    objednane_u_dodavatela:          r['OBJ.VPrObjednaneUdod'],
    planovane_naskladnenie:          r['OBJ.VPrDatDodKuNam'],
    dovod_meskania:                  r['OBJ.VPrDovodMeskanTo'],
  };
}
// ---------------------------------------------------------------------------

async function reload () {
  const rows = [];
  await pipe(
    createReadStream(CSV_FILE),
    csv({ separator: ';' }).on('data', row => rows.push(normalize(row)))
  );

  cache     = rows;
  lastFetch = Date.now();
  console.log(`CSV reloaded: ${rows.length} riadkov`);
}

async function getData () {
  if (Date.now() - lastFetch > CACHE_TTL) await reload();
  return cache;
}

// ------------------------------- API ---------------------------------------
app.get('/orders', async (req, res) => {
  const q = (req.query.query || '').trim();
  if (!q) return res.status(400).json({ error: 'pridaj ?query=' });

  try {
    const data = await getData();

    const byOrder  = data.filter(r => r.cislo_objednavky === q);
    const byInvoice= data.filter(r => r.cislo_faktury   === q);
    const result   = byOrder.length ? byOrder : byInvoice;

    if (!result.length) return res.status(404).json({ error: 'nič sme nenašli' });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CSV sa nepodarilo načítať' });
  }
});

// jednoduchý health‑check
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.listen(PORT, () => console.log(`API beží na porte ${PORT}`));
