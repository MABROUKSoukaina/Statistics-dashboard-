import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import type { PlotFeature } from '../services/api';

// Ported from Geonavigateur-Forestier's exportUtils.ts, with the column set swapped
// for this app's dendrometric fields instead of topo/pédologie ones.

// ─── Shared ───────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const statutLabel = (s: string) => s === 'controle' ? 'Contrôlée' : s === 'visitee' ? 'Réalisée' : 'En cours';
const controleLabel = (s: string) => s === 'controle' ? 'Contrôlée' : s === 'visitee' ? 'Non contrôlée' : '';

// ─── CSV ──────────────────────────────────────────────────────────────────────

export function exportCSV(features: PlotFeature[], basename = 'placettes_stats_ifn') {
  const COLS: { header: string; get: (f: PlotFeature) => string | number | null }[] = [
    { header: 'num_placette',          get: f => f.properties.num_placette },
    { header: 'longitude',             get: f => f.geometry.coordinates[0] },
    { header: 'latitude',              get: f => f.geometry.coordinates[1] },
    { header: 'statut',                get: f => statutLabel(f.properties.statut) },
    { header: 'controle',              get: f => controleLabel(f.properties.statut) },
    { header: 'equipe',                get: f => f.properties.equipe },
    { header: 'ecosysteme',            get: f => f.properties.formation },
    { header: 'strate',                get: f => f.properties.strate },
    { header: 'dpanef',                get: f => f.properties.dpanef },
    { header: 'accessibilite',         get: f => f.properties.accessibilite },
    { header: 'nb_arbres_total',       get: f => f.properties.nb_arbres_total },
    { header: 'nb_echantillons',       get: f => f.properties.nb_echantillons },
    { header: 'nb_coupes',             get: f => f.properties.nb_coupes },
    { header: 'nb_morts',              get: f => f.properties.nb_morts },
    { header: 'nbre_tiges_ha',         get: f => f.properties.nbre_tiges_ha },
    { header: 'surface_terriere_ha',   get: f => f.properties.surface_terriere_ha },
    { header: 'volume_ha',             get: f => f.properties.volume_ha },
    { header: 'circonference_moyenne', get: f => f.properties.circonference_moyenne },
    { header: 'hauteur_moyenne',       get: f => f.properties.hauteur_moyenne },
  ];

  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = COLS.map(c => c.header).join(',');
  const rows = features.map(f => COLS.map(c => esc(c.get(f))).join(','));
  const csv = '﻿' + [header, ...rows].join('\r\n');

  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${basename}.csv`);
}

// ─── Excel (XLSX) ─────────────────────────────────────────────────────────────

export function exportXLSX(features: PlotFeature[], basename = 'placettes_stats_ifn') {
  const rows = features.map(f => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    return {
      num_placette:          p.num_placette,
      longitude:             lon,
      latitude:              lat,
      statut:                statutLabel(p.statut),
      controle:              controleLabel(p.statut),
      equipe:                p.equipe ?? '',
      ecosysteme:            p.formation ?? '',
      strate:                p.strate ?? '',
      dpanef:                p.dpanef ?? '',
      accessibilite:         p.accessibilite ?? '',
      nb_arbres_total:       p.nb_arbres_total,
      nb_echantillons:       p.nb_echantillons,
      nb_coupes:             p.nb_coupes,
      nb_morts:              p.nb_morts,
      nbre_tiges_ha:         p.nbre_tiges_ha ?? '',
      surface_terriere_ha:   p.surface_terriere_ha ?? '',
      volume_ha:             p.volume_ha ?? '',
      circonference_moyenne: p.circonference_moyenne ?? '',
      hauteur_moyenne:       p.hauteur_moyenne ?? '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Placettes');
  XLSX.writeFile(wb, `${basename}.xlsx`);
}

// ─── KML ──────────────────────────────────────────────────────────────────────

export function exportKML(features: PlotFeature[], basename = 'placettes_stats_ifn') {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const placemarks = features.map(f => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const fields: [string, unknown][] = [
      ['statut', statutLabel(p.statut)], ['controle', controleLabel(p.statut) || null],
      ['equipe', p.equipe], ['ecosysteme', p.formation],
      ['strate', p.strate], ['dpanef', p.dpanef], ['accessibilite', p.accessibilite],
      ['nb_arbres_total', p.nb_arbres_total], ['nb_echantillons', p.nb_echantillons],
      ['nb_coupes', p.nb_coupes], ['nb_morts', p.nb_morts],
      ['nbre_tiges_ha', p.nbre_tiges_ha], ['surface_terriere_ha', p.surface_terriere_ha],
      ['volume_ha', p.volume_ha], ['circonference_moyenne', p.circonference_moyenne],
      ['hauteur_moyenne', p.hauteur_moyenne],
    ];
    const extData = fields
      .filter(([, v]) => v != null)
      .map(([k, v]) => `      <Data name="${k}"><value>${esc(String(v))}</value></Data>`)
      .join('\n');

    return `  <Placemark>
    <name>${esc(p.num_placette)}</name>
    <Point><coordinates>${lon},${lat},0</coordinates></Point>
    <ExtendedData>
${extData}
    </ExtendedData>
  </Placemark>`;
  }).join('\n');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Placettes IFN — Statistiques</name>
${placemarks}
</Document>
</kml>`;

  triggerDownload(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }), `${basename}.kml`);
}

// ─── Shapefile (SHP + SHX + DBF + PRJ zipped) ────────────────────────────────

interface DbfField {
  name: string;   // max 10 chars
  type: 'C' | 'N';
  length: number;
  decimals: number;
  get: (f: PlotFeature) => string;
}

const sl = (s: string) => s === 'controle' ? 'Controlee' : s === 'visitee' ? 'Realisee' : 'En cours';
const cl = (s: string) => s === 'controle' ? 'Controlee' : s === 'visitee' ? 'Non ctrl' : '';

const DBF_FIELDS: DbfField[] = [
  { name: 'PLACETTE',  type: 'C', length: 20, decimals: 0, get: f => f.properties.num_placette ?? '' },
  { name: 'STATUT',    type: 'C', length: 15, decimals: 0, get: f => sl(f.properties.statut) },
  { name: 'CONTROLE',  type: 'C', length: 15, decimals: 0, get: f => cl(f.properties.statut) },
  { name: 'EQUIPE',    type: 'C', length: 80, decimals: 0, get: f => f.properties.equipe ?? '' },
  { name: 'ECOSYST',   type: 'C', length: 50, decimals: 0, get: f => f.properties.formation ?? '' },
  { name: 'STRATE',    type: 'C', length: 30, decimals: 0, get: f => f.properties.strate ?? '' },
  { name: 'DPANEF',    type: 'C', length: 30, decimals: 0, get: f => f.properties.dpanef ?? '' },
  { name: 'TIGES_HA',  type: 'N', length: 10, decimals: 1, get: f => f.properties.nbre_tiges_ha != null ? f.properties.nbre_tiges_ha.toFixed(1) : '' },
  { name: 'ST_HA',     type: 'N', length: 10, decimals: 2, get: f => f.properties.surface_terriere_ha != null ? f.properties.surface_terriere_ha.toFixed(2) : '' },
  { name: 'VOL_HA',    type: 'N', length: 10, decimals: 2, get: f => f.properties.volume_ha != null ? f.properties.volume_ha.toFixed(2) : '' },
  { name: 'HT_MOY',    type: 'N', length:  8, decimals: 1, get: f => f.properties.hauteur_moyenne != null ? f.properties.hauteur_moyenne.toFixed(1) : '' },
  { name: 'CIRC_MOY',  type: 'N', length:  8, decimals: 1, get: f => f.properties.circonference_moyenne != null ? f.properties.circonference_moyenne.toFixed(1) : '' },
  { name: 'NB_ARBRES', type: 'N', length:  6, decimals: 0, get: f => String(f.properties.nb_arbres_total ?? 0) },
  { name: 'NB_ECHANT', type: 'N', length:  6, decimals: 0, get: f => String(f.properties.nb_echantillons ?? 0) },
  { name: 'NB_COUPES', type: 'N', length:  6, decimals: 0, get: f => String(f.properties.nb_coupes ?? 0) },
  { name: 'NB_MORTS',  type: 'N', length:  6, decimals: 0, get: f => String(f.properties.nb_morts ?? 0) },
  { name: 'LONGITUDE', type: 'N', length: 18, decimals: 8, get: f => f.geometry.coordinates[0].toFixed(8) },
  { name: 'LATITUDE',  type: 'N', length: 18, decimals: 8, get: f => f.geometry.coordinates[1].toFixed(8) },
];

function toLatin1(str: string, len: number): Uint8Array {
  const out = new Uint8Array(len).fill(0x20);
  for (let i = 0; i < Math.min(str.length, len); i++) {
    const c = str.charCodeAt(i);
    out[i] = c <= 0xff ? c : 0x3f;
  }
  return out;
}

function buildSHP(points: [number, number][]): ArrayBuffer {
  const n = points.length;
  const contentLen = 10; // words (20 bytes per point record)
  const fileLen = 50 + n * 14; // words: 100 hdr + n*(8+20) bytes
  const buf = new ArrayBuffer(100 + n * 28);
  const dv = new DataView(buf);

  dv.setInt32(0, 9994, false);
  dv.setInt32(24, fileLen, false);
  dv.setInt32(28, 1000, true);
  dv.setInt32(32, 1, true); // Point

  const lons = points.map(p => p[0]);
  const lats = points.map(p => p[1]);
  dv.setFloat64(36, Math.min(...lons), true);
  dv.setFloat64(44, Math.min(...lats), true);
  dv.setFloat64(52, Math.max(...lons), true);
  dv.setFloat64(60, Math.max(...lats), true);

  for (let i = 0; i < n; i++) {
    const off = 100 + i * 28;
    dv.setInt32(off,     i + 1,      false); // record number
    dv.setInt32(off + 4, contentLen, false); // content length
    dv.setInt32(off + 8, 1,          true);  // shape type
    dv.setFloat64(off + 12, points[i][0], true); // X
    dv.setFloat64(off + 20, points[i][1], true); // Y
  }

  return buf;
}

function buildSHX(points: [number, number][]): ArrayBuffer {
  const n = points.length;
  const fileLen = 50 + n * 4; // words
  const buf = new ArrayBuffer(100 + n * 8);
  const dv = new DataView(buf);

  dv.setInt32(0, 9994, false);
  dv.setInt32(24, fileLen, false);
  dv.setInt32(28, 1000, true);
  dv.setInt32(32, 1, true);

  const lons = points.map(p => p[0]);
  const lats = points.map(p => p[1]);
  dv.setFloat64(36, Math.min(...lons), true);
  dv.setFloat64(44, Math.min(...lats), true);
  dv.setFloat64(52, Math.max(...lons), true);
  dv.setFloat64(60, Math.max(...lats), true);

  for (let i = 0; i < n; i++) {
    const off = 100 + i * 8;
    dv.setInt32(off,     50 + i * 14, false); // SHP record offset in words
    dv.setInt32(off + 4, 10,          false); // content length in words
  }

  return buf;
}

function buildDBF(features: PlotFeature[]): ArrayBuffer {
  const fields = DBF_FIELDS;
  const n = features.length;
  const headerSize = 32 + fields.length * 32 + 1;
  const recSize = 1 + fields.reduce((s, f) => s + f.length, 0);
  const buf = new ArrayBuffer(headerSize + n * recSize + 1);
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // Header
  dv.setUint8(0, 3);
  const now = new Date();
  dv.setUint8(1, now.getFullYear() - 1900);
  dv.setUint8(2, now.getMonth() + 1);
  dv.setUint8(3, now.getDate());
  dv.setInt32(4, n, true);
  dv.setInt16(8, headerSize, true);
  dv.setInt16(10, recSize, true);
  dv.setUint8(29, 0x76); // UTF-8 codepage hint

  // Field descriptors
  for (let fi = 0; fi < fields.length; fi++) {
    const base = 32 + fi * 32;
    bytes.set(toLatin1(fields[fi].name, 10), base);
    bytes[base + 11] = fields[fi].type.charCodeAt(0);
    bytes[base + 16] = fields[fi].length;
    bytes[base + 17] = fields[fi].decimals;
  }
  bytes[32 + fields.length * 32] = 0x0d; // header terminator

  // Records
  for (let ri = 0; ri < n; ri++) {
    let off = headerSize + ri * recSize;
    bytes[off++] = 0x20; // not deleted
    for (const fld of fields) {
      const raw = fld.get(features[ri]).slice(0, fld.length);
      const padded = fld.type === 'N'
        ? raw.padStart(fld.length, ' ')
        : raw.padEnd(fld.length, ' ');
      bytes.set(toLatin1(padded, fld.length), off);
      off += fld.length;
    }
  }
  bytes[headerSize + n * recSize] = 0x1a; // EOF

  return buf;
}

const WGS84_PRJ =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],' +
  'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

export async function exportSHP(features: PlotFeature[], basename = 'placettes_stats_ifn') {
  const points = features.map(f => f.geometry.coordinates as [number, number]);

  const zip = new JSZip();
  zip.file(`${basename}.shp`, buildSHP(points));
  zip.file(`${basename}.shx`, buildSHX(points));
  zip.file(`${basename}.dbf`, buildDBF(features));
  zip.file(`${basename}.prj`, WGS84_PRJ);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  triggerDownload(blob, `${basename}.zip`);
}
