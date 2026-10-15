import { readFileSync } from 'node:fs';
import { validateXML } from 'xmllint-wasm';
import { periodBounds, xmlDate } from './vatFiling';
import type { FilingProfile, FilingReview, FilingType } from './vatFilingTypes';

const schemaText = Object.fromEntries(
  ['DPHDP3', 'DPHKH1', 'DPHSHV'].map((t) => [
    t,
    readFileSync(
      new URL(`./vatSchemas/${t.toLowerCase()}_epo2.xsd`, import.meta.url),
      'utf8',
    ),
  ]),
);
const escape = (v: string | number) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
const element = (name: string, attrs: Record<string, string | number>) =>
  `<${name} ${Object.entries(attrs)
    .map(([k, v]) => `${k}="${escape(v)}"`)
    .join(' ')}/>`;
// Attribute names and row mapping: pinned official EPO structure, see docs/vat-filings.md.
export function generateFilingXml(
  review: FilingReview,
  p: FilingProfile,
  createdDate: string,
): string {
  if (!review.applicable || review.issues.some((i) => i.severity === 'blocker'))
    throw new Error('blocked');
  const b = periodBounds(review.period);
  const type = review.type;
  const header: Record<string, string | number> = {
    dokument: type.slice(3),
    k_uladis: 'DPH',
    rok: b.year,
    d_poddp: xmlDate(createdDate),
    ...(b.quarter ? { ctvrt: Number(review.period[6]) } : { mesic: b.month }),
  };
  if (type === 'DPHDP3')
    Object.assign(header, {
      dapdph_forma: review.mode === 'replacement' ? 'O' : 'B',
      typ_platce: p.status === 'identified' ? 'I' : 'P',
      c_okec: p.activityCode,
      trans: Object.values(review.rows).some((r) => r.base || r.tax)
        ? 'A'
        : 'N',
    });
  if (type === 'DPHKH1')
    header.khdph_forma = review.mode === 'replacement' ? 'O' : 'B';
  if (type === 'DPHSHV') header.shvies_forma = 'R';
  const identity: Record<string, string | number> = {
    c_ufo: p.taxOffice,
    c_pracufo: p.taxOfficeBranch,
    dic: p.vatId.slice(2),
    typ_ds: 'F',
    jmeno: p.firstName,
    prijmeni: p.lastName,
    naz_obce: p.city,
    psc: p.postcode,
    c_pop: p.houseNumber,
    stat: 'ČESKÁ REPUBLIKA',
  };
  if (p.street) identity.ulice = p.street;
  if (p.houseOrientation) identity.c_orient = p.houseOrientation;
  if (p.email && type !== 'DPHSHV') identity.email = p.email;
  const body = [element('VetaD', header), element('VetaP', identity)];
  if (type === 'DPHDP3') {
    const base = (n: number) => review.rows[n]?.base || 0;
    const tax = (n: number) => review.rows[n]?.tax || 0;
    body.push(
      element('Veta1', {
        obrat23: base(1),
        dan23: tax(1),
        obrat5: base(2),
        dan5: tax(2),
        p_sl23_e: base(5),
        dan_psl23_e: tax(5),
        rez_pren23: base(10),
        dan_rpren23: tax(10),
        rez_pren5: base(11),
        dan_rpren5: tax(11),
      }),
    );
    if (p.status === 'payer') {
      body.push(
        element('Veta2', { pln_sluzby: base(21), pln_rez_pren: base(25) }),
      );
      body.push(
        element('Veta4', {
          pln23: base(40),
          odp_tuz23_nar: tax(40),
          pln5: base(41),
          odp_tuz5_nar: tax(41),
          nar_zdp23: base(43),
          od_zdp23: tax(43),
          nar_zdp5: base(44),
          od_zdp5: tax(44),
          odp_sum_nar: tax(46),
        }),
      );
    }
    body.push(
      element('Veta6', {
        dan_zocelk: tax(62),
        odp_zocelk: tax(63),
        dano_da: tax(64),
        dano_no: tax(65),
      }),
    );
  } else if (type === 'DPHKH1') {
    let line = 0;
    for (const section of ['A1', 'A2', 'A4', 'A5', 'B1', 'B2', 'B3'])
      for (const r of review.statement.filter((r) => r.section === section))
        body.push(
          element(`Veta${section}`, {
            ...r.attributes,
            ...(['A5', 'B3'].includes(section) ? {} : { c_radku: ++line }),
          }),
        );
    const total = (sections: string[], key: string) =>
      Math.round(
        review.statement
          .filter((r) => sections.includes(r.section))
          .reduce((s, r) => s + Number(r.attributes[key] || 0), 0) * 100,
      ) / 100;
    body.push(
      element('VetaC', {
        obrat23: total(['A4', 'A5'], 'zakl_dane1'),
        obrat5: total(['A4', 'A5'], 'zakl_dane2'),
        pln23: total(['B2', 'B3'], 'zakl_dane1'),
        pln5: total(['B2', 'B3'], 'zakl_dane2'),
        pln_rez_pren: total(['A1'], 'zakl_dane1'),
        rez_pren23: total(['B1'], 'zakl_dane1'),
        rez_pren5: total(['B1'], 'zakl_dane2'),
        celk_zd_a2: total(['A2'], 'zakl_dane1'),
      }),
    );
  } else
    review.statement
      .filter((r) => r.section === 'R')
      .forEach((r, i) =>
        body.push(element('VetaR', { ...r.attributes, c_rad: i + 1 })),
      );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Pisemnost nazevSW="Essential Invoice" verzeSW="1"><${type} verzePis="${review.schemaVersion}">\n${body.join('\n')}\n</${type}></Pisemnost>\n`;
}
export async function validateFilingXml(type: FilingType, xml: string) {
  // All schemas are bundled and self-contained; validation performs no network IO.
  // Never log parser errors: libxml messages can contain taxpayer identifiers.
  const result = await validateXML({
    xml: [{ fileName: 'filing.xml', contents: xml }],
    schema: [schemaText[type]],
    maxMemoryPages: 1024,
  });
  return {
    valid: result.valid,
    errors: result.errors.map((e) => ({ message: e.message || e.rawMessage })),
  };
}
