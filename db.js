'use strict';
/*
 * KÖK: PostgreSQL kalıcılık katmanı.
 *
 * Uygulama durumu (server.js içindeki S nesnesi) ilişkisel tablolara ayrıştırılır:
 * katılımcılar, masalar, oylar ve oy dağılımları, fikirler, puanlar, bireysel fikirler,
 * seçimler, seçim puanları, detaylar ve detay alanları, ayarlar, program, hazırlık listesi,
 * sunum ve ortak sayaç. Masaların ve seçimlerin iç akış durumu (tur, dar oylama, kura, sonuç)
 * kendi satırlarında JSON kolonu olarak durur.
 *
 * Dönüşüm kayıpsızdır: satirlaraCevir(S) -> satirlardanKur(...) aynı S'yi verir.
 * Beklenmeyen tipte bir alan kaybolmaz; satırın "ek" (JSON) kolonuna yazılır.
 * Bir haritada nesne olmayan bir değer varsa "deger" kolonunda {d: değer} olarak saklanır.
 * Haritaların anahtar sırası "sira" kolonuyla korunur.
 *
 * Yazma: farkHesapla(eski, yeni) yalnızca değişen satırları bulur; farkUygula aynı işlem
 * (transaction) içinde siler/ekler/günceller.
 */
const { Pool, Client, types } = require('pg');

types.setTypeParser(20, v => Number(v)); // bigint: ms zaman damgaları 2^53'ün altında, sayı olarak döner

const SQL_TIP = { text: 'text', int: 'bigint', num: 'double precision', bool: 'boolean', json: 'json' };
const UYGUN = {
  text: v => typeof v === 'string' && !v.includes('\u0000') && v.isWellFormed(), // NUL ya da yarım Unicode içeren metin text kolonuna yazılamaz: kayıpsız saklansın diye "ek" (JSON) kolonuna gider
  int: v => Number.isSafeInteger(v),
  num: v => typeof v === 'number' && Number.isFinite(v),
  bool: v => typeof v === 'boolean',
  json: v => v !== null && v !== undefined, // null, "alan yok" ile karışmasın diye "ek" kolonuna gider
};
const duz = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const koy = (o, k, v) => { Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true }); }; // "__proto__" gibi anahtarlar güvenle yazılır

/* ------------------------------------------------------------------ tablolar */
// k: kolon -> tip. pk: birincil anahtar kolonları. Kolon sırası SQL'deki sıradır.
const TABLOLAR = [
  { ad: 'calistay', pk: ['id'], k: { id: 'int', v: 'int', sablon: 'text', olusturma: 'int', asama: 'text', mevcut: 'json', program_ek: 'json', program_oge_var: 'bool', ek: 'json' } },
  { ad: 'ayarlar', pk: ['anahtar'], k: { anahtar: 'text', sira: 'int', deger: 'json' } },
  { ad: 'sunum', pk: ['id'], k: { id: 'int', aktif: 'text', durum: 'text', sunum_bas: 'int', sunum_sn: 'int', puan_kapanis: 'int', puan_sn: 'int', ek: 'json' } },
  { ad: 'zaman', pk: ['id'], k: { id: 'int', etiket: 'text', bitis: 'int', toplam: 'int', ek: 'json' } },
  { ad: 'program_ogeleri', pk: ['sira'], k: { sira: 'int', b: 'int', e: 'int', ad: 'text', notu: 'text', asama: 'text', ek: 'json', deger: 'json' } },
  { ad: 'hazirlik', pk: ['madde'], k: { madde: 'text', sira: 'int', deger: 'json' } },
  { ad: 'masalar', pk: ['id'], k: { id: 'text', sira: 'int', id_alani: 'bool', tema: 'int', ad: 'text', anahtar: 'text', fikir_sayisi: 'int', fikir_kilit: 'bool', tur: 'json', etiket: 'json', bulgular: 'json', ek: 'json', deger: 'json' } },
  { ad: 'katilimcilar', pk: ['id'], k: { id: 'text', sira: 'int', id_alani: 'bool', token: 'text', kod: 'text', etiket: 'text', pozisyon: 'text', masa: 'text', ts: 'int', cihazlar: 'json', kolay: 'bool', onceki_masa: 'text', gelmeyecek: 'bool', geldi: 'bool', geldi_ts: 'int', yedek: 'bool', ek: 'json', deger: 'json' } },
  { ad: 'oy_gruplari', pk: ['grup'], k: { grup: 'text', sira: 'int', deger: 'json' } },
  { ad: 'oylar', pk: ['grup', 'katilimci_id'], k: { grup: 'text', katilimci_id: 'text', sira: 'int', ts: 'int', alloc_var: 'bool', ek: 'json', deger: 'json' } },
  { ad: 'oy_dagilimlari', pk: ['grup', 'katilimci_id', 'no'], k: { grup: 'text', katilimci_id: 'text', no: 'text', sira: 'int', adet: 'num' } },
  { ad: 'fikirler', pk: ['sira'], k: { sira: 'int', fikir_id: 'text', masa: 'text', masa_sirasi: 'int', ad: 'text', no: 'int', swot: 'json', kaynak: 'text', ek: 'json', deger: 'json' } },
  { ad: 'puan_gruplari', pk: ['fikir_id'], k: { fikir_id: 'text', sira: 'int', deger: 'json' } },
  { ad: 'puanlar', pk: ['fikir_id', 'katilimci_id'], k: { fikir_id: 'text', katilimci_id: 'text', sira: 'int', etki: 'num', uyg: 'num', ts: 'int', ek: 'json', deger: 'json' } },
  { ad: 'birey_fikirler', pk: ['katilimci_id'], k: { katilimci_id: 'text', sira: 'int', masa: 'text', ad: 'text', swot: 'json', ts: 'int', ek: 'json', deger: 'json' } },
  { ad: 'secimler', pk: ['masa_id'], k: { masa_id: 'text', sira: 'int', durum: 'text', tablo: 'bool', sira_listesi: 'json', aktif: 'int', puan_acik: 'bool', puan_kapanis: 'int', gozden_kapanis: 'int', sonuc: 'json', onay: 'json', dar: 'json', ek: 'json', deger: 'json' } },
  { ad: 'detaylar', pk: ['fikir_id'], k: { fikir_id: 'text', sira: 'int', takim: 'json', gonder: 'bool', ts: 'int', alan_var: 'bool', ek: 'json', deger: 'json' } },
  { ad: 'detay_alanlari', pk: ['fikir_id', 'anahtar'], k: { fikir_id: 'text', anahtar: 'text', sira: 'int', metin: 'text' } },
  { ad: 'secim_puan_masalari', pk: ['masa_id'], k: { masa_id: 'text', sira: 'int', deger: 'json' } },
  { ad: 'secim_puan_fikirleri', pk: ['masa_id', 'fikir_id'], k: { masa_id: 'text', fikir_id: 'text', sira: 'int', deger: 'json' } },
  { ad: 'secim_puanlari', pk: ['masa_id', 'fikir_id', 'puanlayan_id'], k: { masa_id: 'text', fikir_id: 'text', puanlayan_id: 'text', sira: 'int', p: 'num', ts: 'int', ek: 'json', deger: 'json' } },
];
for (const t of TABLOLAR) t.kolonlar = Object.keys(t.k);
const TB = Object.fromEntries(TABLOLAR.map(t => [t.ad, t]));
// NOT NULL kolonlar: birincil anahtar, sira, ek (boş nesne) ve ham değer tutan "deger" kolonları
const HAM_DEGER = new Set(['ayarlar', 'hazirlik']);
const DIZINLER = [
  'CREATE INDEX IF NOT EXISTS katilimcilar_token_ix ON katilimcilar (token)',
  'CREATE INDEX IF NOT EXISTS katilimcilar_kod_ix ON katilimcilar (kod)',
  'CREATE INDEX IF NOT EXISTS katilimcilar_masa_ix ON katilimcilar (masa)',
  'CREATE INDEX IF NOT EXISTS oylar_katilimci_ix ON oylar (katilimci_id)',
  'CREATE INDEX IF NOT EXISTS puanlar_katilimci_ix ON puanlar (katilimci_id)',
  'CREATE INDEX IF NOT EXISTS fikirler_masa_ix ON fikirler (masa)',
  'CREATE INDEX IF NOT EXISTS secim_puanlari_puanlayan_ix ON secim_puanlari (puanlayan_id)',
  'CREATE INDEX IF NOT EXISTS yedekler_olusturma_ix ON yedekler (olusturma)',
];
function semaSql() {
  const out = [];
  for (const t of TABLOLAR) {
    const cols = t.kolonlar.map(c => {
      const notNull = t.pk.includes(c) || c === 'sira' || c === 'ek' || (c === 'deger' && HAM_DEGER.has(t.ad));
      return `${c} ${SQL_TIP[t.k[c]]}${notNull ? ' NOT NULL' : ''}${c === 'ek' ? " DEFAULT '{}'" : ''}`;
    });
    out.push(`CREATE TABLE IF NOT EXISTS ${t.ad} (${cols.join(', ')}, PRIMARY KEY (${t.pk.join(', ')}))`);
    // sonraki sürümlerde eklenen kolonlar var olan tablolara da eklenir (birincil anahtar dışındakiler boş olabilir)
    for (const c of t.kolonlar) if (!t.pk.includes(c) && c !== 'sira') out.push(`ALTER TABLE ${t.ad} ADD COLUMN IF NOT EXISTS ${c} ${SQL_TIP[t.k[c]]}${c === 'ek' ? " NOT NULL DEFAULT '{}'" : ''}`);
  }
  out.push('CREATE TABLE IF NOT EXISTS yedekler (id bigserial PRIMARY KEY, olusturma timestamptz NOT NULL DEFAULT now(), neden text NOT NULL, veri json NOT NULL)');
  out.push('CREATE TABLE IF NOT EXISTS sema_surumu (id int PRIMARY KEY, surum int NOT NULL)');
  out.push('INSERT INTO sema_surumu (id, surum) VALUES (1, 1) ON CONFLICT (id) DO NOTHING');
  return out.concat(DIZINLER);
}

/* --------------------------------------------------------- alan eşlemeleri */
// [js alanı, kolon, tip]
const CALISTAY = [['v', 'v', 'int'], ['sablon', 'sablon', 'text'], ['olusturma', 'olusturma', 'int'], ['asama', 'asama', 'text']];
const SUNUM = [['aktif', 'aktif', 'text'], ['durum', 'durum', 'text'], ['sunumBas', 'sunum_bas', 'int'], ['sunumSn', 'sunum_sn', 'int'], ['puanKapanis', 'puan_kapanis', 'int'], ['puanSn', 'puan_sn', 'int']];
const ZAMAN = [['etiket', 'etiket', 'text'], ['bitis', 'bitis', 'int'], ['toplam', 'toplam', 'int']];
const PROGRAM_OGE = [['b', 'b', 'int'], ['e', 'e', 'int'], ['ad', 'ad', 'text'], ['not', 'notu', 'text'], ['asama', 'asama', 'text']];
const MASA = [['tema', 'tema', 'int'], ['ad', 'ad', 'text'], ['key', 'anahtar', 'text'], ['fikirSayisi', 'fikir_sayisi', 'int'], ['fikirKilit', 'fikir_kilit', 'bool'], ['tur', 'tur', 'json'], ['etiket', 'etiket', 'json'], ['bulgular', 'bulgular', 'json']];
const KATILIMCI = [['token', 'token', 'text'], ['kod', 'kod', 'text'], ['etiket', 'etiket', 'text'], ['pozisyon', 'pozisyon', 'text'], ['masa', 'masa', 'text'], ['ts', 'ts', 'int'], ['cihazlar', 'cihazlar', 'json'],
  ['kolay', 'kolay', 'bool'], ['oncekiMasa', 'onceki_masa', 'text'], ['gelmeyecek', 'gelmeyecek', 'bool'], ['geldi', 'geldi', 'bool'], ['geldiTs', 'geldi_ts', 'int'], ['yedek', 'yedek', 'bool']];
const OY = [['ts', 'ts', 'int']];
const FIKIR = [['id', 'fikir_id', 'text'], ['masa', 'masa', 'text'], ['sira', 'masa_sirasi', 'int'], ['ad', 'ad', 'text'], ['no', 'no', 'int'], ['swot', 'swot', 'json'], ['kaynak', 'kaynak', 'text']];
const PUAN = [['etki', 'etki', 'num'], ['uyg', 'uyg', 'num'], ['ts', 'ts', 'int']];
const BIREY = [['masa', 'masa', 'text'], ['ad', 'ad', 'text'], ['swot', 'swot', 'json'], ['ts', 'ts', 'int']];
const SECIM = [['durum', 'durum', 'text'], ['tablo', 'tablo', 'bool'], ['sira', 'sira_listesi', 'json'], ['aktif', 'aktif', 'int'], ['puanAcik', 'puan_acik', 'bool'], ['puanKapanis', 'puan_kapanis', 'int'],
  ['gozdenKapanis', 'gozden_kapanis', 'int'], ['sonuc', 'sonuc', 'json'], ['onay', 'onay', 'json'], ['dar', 'dar', 'json']];
const DETAY = [['takim', 'takim', 'json'], ['gonder', 'gonder', 'bool'], ['ts', 'ts', 'int']];
const SECIM_PUAN = [['p', 'p', 'num'], ['ts', 'ts', 'int']];

const indeksler = new WeakMap();
const indeks = alanlar => { let m = indeksler.get(alanlar); if (!m) { m = new Map(alanlar.map(([js, kol, tip]) => [js, [kol, tip]])); indeksler.set(alanlar, m); } return m; };
const CALISTAY_IX = indeks(CALISTAY);

/** Nesneyi tipli kolonlara ve "ek" nesnesine ayırır. Tipi uymayan ya da tanımsız alanlar ek'e gider. */
function kodla(o, alanlar, atla) {
  const c = {}, ek = {}, ix = indeks(alanlar);
  for (const [, kol] of alanlar) c[kol] = null;
  for (const key of Object.keys(o)) {
    if (atla && atla.has(key)) continue;
    const val = o[key]; if (val === undefined) continue; // JSON'da olduğu gibi tanımsız alan yazılmaz
    const a = ix.get(key);
    if (a && UYGUN[a[1]](val)) c[a[0]] = val; else koy(ek, key, val);
  }
  return { c, ek };
}
/** kodla'nın tersi: tipli kolonlardan ve ek'ten nesneyi kurar. */
function coz(o, row, alanlar) {
  for (const [js, kol] of alanlar) if (row[kol] !== null && row[kol] !== undefined) koy(o, js, row[kol]);
  const ek = row.ek || {}; for (const key of Object.keys(ek)) koy(o, key, ek[key]);
  return o;
}

/* ------------------------------------------- haritalar (iç içe olabilir) */
// sev: ara seviyeler [{tablo, kol}], yap: yaprak {tablo, kol, alanlar, kimlik, ozel, ham}
function haritaYaz(harita, sev, yap, ekle, ust, d) {
  ust = ust || {}; d = d || 0;
  Object.keys(harita).forEach((k, i) => {
    const v = harita[k]; if (v === undefined) return;
    const anahtar = Object.assign({}, ust); anahtar[d < sev.length ? sev[d].kol : yap.kol] = k;
    if (d < sev.length) {
      if (duz(v)) { ekle(sev[d].tablo, Object.assign({}, anahtar, { sira: i, deger: null })); haritaYaz(v, sev, yap, ekle, anahtar, d + 1); }
      else ekle(sev[d].tablo, Object.assign({}, anahtar, { sira: i, deger: { d: v } }));
      return;
    }
    if (yap.ham) { ekle(yap.tablo, Object.assign({}, anahtar, { sira: i, deger: { d: v } })); return; }
    if (!duz(v)) { ekle(yap.tablo, Object.assign({}, anahtar, { sira: i, deger: { d: v } })); return; }
    const atla = new Set(), ekstra = {};
    if (yap.kimlik) { ekstra.id_alani = v.id === k; if (ekstra.id_alani) atla.add('id'); }
    if (yap.ozel) yap.ozel.yaz(v, anahtar, atla, ekstra, ekle);
    const { c, ek } = kodla(v, yap.alanlar, atla);
    ekle(yap.tablo, Object.assign({}, anahtar, { sira: i }, c, ekstra, { ek, deger: null }));
  });
}
const siraIle = (a, b) => a.sira - b.sira;
function cocuklar(R, tablo, kols) { // ebeveyn anahtarı -> sıralı satırlar
  const m = new Map();
  for (const r of [...R[tablo].values()].sort(siraIle)) { const k = JSON.stringify(kols.map(c => r[c])); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
}
function haritaKur(R, sev, yap) {
  const kok = {}, dugum = new Map([['[]', kok]]);
  const yol = (r, d) => JSON.stringify(sev.slice(0, d).map(s => r[s.kol]));
  for (let d = 0; d < sev.length; d++) {
    for (const r of [...R[sev[d].tablo].values()].sort(siraIle)) {
      const ebeveyn = dugum.get(yol(r, d)); if (!ebeveyn) continue; // sahipsiz satır (olmamalı) atlanır
      if (r.deger) { koy(ebeveyn, r[sev[d].kol], r.deger.d); continue; }
      const o = {}; koy(ebeveyn, r[sev[d].kol], o); dugum.set(yol(r, d + 1), o);
    }
  }
  const ozelIx = yap.ozel ? yap.ozel.indeks(R) : null;
  for (const r of [...R[yap.tablo].values()].sort(siraIle)) {
    const ebeveyn = dugum.get(yol(r, sev.length)); if (!ebeveyn) continue;
    if (yap.ham || r.deger) { koy(ebeveyn, r[yap.kol], r.deger ? r.deger.d : null); continue; }
    const o = {};
    if (yap.kimlik && r.id_alani) koy(o, 'id', r[yap.kol]);
    coz(o, r, yap.alanlar);
    if (yap.ozel) yap.ozel.kur(o, r, ozelIx);
    koy(ebeveyn, r[yap.kol], o);
  }
  return kok;
}

// oylar: alloc ({post-it no: oy adedi}) ayrı tabloda satır satır durur
const ALLOC = {
  yaz(v, anahtar, atla, ekstra, ekle) {
    const a = v.alloc, rel = duz(a) && Object.keys(a).every(n => UYGUN.num(a[n]));
    ekstra.alloc_var = rel; if (!rel) return;
    atla.add('alloc');
    Object.keys(a).forEach((no, n) => ekle('oy_dagilimlari', Object.assign({}, anahtar, { no, sira: n, adet: a[no] })));
  },
  indeks: R => cocuklar(R, 'oy_dagilimlari', ['grup', 'katilimci_id']),
  kur(o, r, ix) { if (!r.alloc_var) return; const a = {}; for (const d of ix.get(JSON.stringify([r.grup, r.katilimci_id])) || []) koy(a, d.no, d.adet); koy(o, 'alloc', a); },
};
// detaylar: alan ({alan anahtarı: metin}) ayrı tabloda satır satır durur
const ALAN = {
  yaz(v, anahtar, atla, ekstra, ekle) {
    const a = v.alan, rel = duz(a) && Object.keys(a).every(n => UYGUN.text(a[n]));
    ekstra.alan_var = rel; if (!rel) return;
    atla.add('alan');
    Object.keys(a).forEach((k, n) => ekle('detay_alanlari', { fikir_id: anahtar.fikir_id, anahtar: k, sira: n, metin: a[k] }));
  },
  indeks: R => cocuklar(R, 'detay_alanlari', ['fikir_id']),
  kur(o, r, ix) { if (!r.alan_var) return; const a = {}; for (const d of ix.get(JSON.stringify([r.fikir_id])) || []) koy(a, d.anahtar, d.metin); koy(o, 'alan', a); },
};

const harita = (sev, yap) => ({ uygun: duz, yaz: (v, ekle) => haritaYaz(v, sev, yap, ekle), kur: R => haritaKur(R, sev, yap) });
const tekil = (tablo, alanlar) => ({
  uygun: duz,
  yaz(v, ekle) { const { c, ek } = kodla(v, alanlar); ekle(tablo, Object.assign({ id: 1 }, c, { ek })); },
  kur(R) { const r = R[tablo].get('[1]'); return r ? coz({}, r, alanlar) : {}; },
});
// S'nin üst düzey alanları ve tabloları. Burada olmayan alanlar calistay.ek'te saklanır.
const KOLEKSIYON = {
  ayar: harita([], { tablo: 'ayarlar', kol: 'anahtar', ham: true }),
  hazirlik: harita([], { tablo: 'hazirlik', kol: 'madde', ham: true }),
  masalar: harita([], { tablo: 'masalar', kol: 'id', alanlar: MASA, kimlik: true }),
  katilimcilar: harita([], { tablo: 'katilimcilar', kol: 'id', alanlar: KATILIMCI, kimlik: true }),
  oylar: harita([{ tablo: 'oy_gruplari', kol: 'grup' }], { tablo: 'oylar', kol: 'katilimci_id', alanlar: OY, ozel: ALLOC }),
  puanlar: harita([{ tablo: 'puan_gruplari', kol: 'fikir_id' }], { tablo: 'puanlar', kol: 'katilimci_id', alanlar: PUAN }),
  bireyFikir: harita([], { tablo: 'birey_fikirler', kol: 'katilimci_id', alanlar: BIREY }),
  secim: harita([], { tablo: 'secimler', kol: 'masa_id', alanlar: SECIM }),
  detay: harita([], { tablo: 'detaylar', kol: 'fikir_id', alanlar: DETAY, ozel: ALAN }),
  secimPuan: harita([{ tablo: 'secim_puan_masalari', kol: 'masa_id' }, { tablo: 'secim_puan_fikirleri', kol: 'fikir_id' }], { tablo: 'secim_puanlari', kol: 'puanlayan_id', alanlar: SECIM_PUAN }),
  sunum: tekil('sunum', SUNUM),
  zaman: tekil('zaman', ZAMAN),
  fikirler: {
    uygun: Array.isArray,
    yaz(v, ekle) { v.forEach((f, i) => { if (duz(f)) { const { c, ek } = kodla(f, FIKIR); ekle('fikirler', Object.assign({ sira: i }, c, { ek, deger: null })); } else ekle('fikirler', { sira: i, deger: { d: f === undefined ? null : f } }); }); },
    kur: R => [...R.fikirler.values()].sort(siraIle).map(r => r.deger ? r.deger.d : coz({}, r, FIKIR)),
  },
  program: {
    uygun: v => duz(v) && (v.oge === undefined || (Array.isArray(v.oge))),
    yaz(v, ekle, cal) {
      cal.program_oge_var = Array.isArray(v.oge);
      const ek = {}; for (const k of Object.keys(v)) if (k !== 'oge' && v[k] !== undefined) koy(ek, k, v[k]);
      cal.program_ek = ek;
      (v.oge || []).forEach((o, i) => { if (duz(o)) { const r = kodla(o, PROGRAM_OGE); ekle('program_ogeleri', Object.assign({ sira: i }, r.c, { ek: r.ek, deger: null })); } else ekle('program_ogeleri', { sira: i, deger: { d: o === undefined ? null : o } }); });
    },
    kur(R, cal) {
      const p = {};
      if (cal.program_oge_var) koy(p, 'oge', [...R.program_ogeleri.values()].sort(siraIle).map(r => r.deger ? r.deger.d : coz({}, r, PROGRAM_OGE)));
      const ek = cal.program_ek || {}; for (const k of Object.keys(ek)) koy(p, k, ek[k]);
      return p;
    },
  },
};

/* ------------------------------------------------------- S <-> satırlar */
const pkAnahtar = (t, r) => JSON.stringify(t.pk.map(c => r[c]));
const satirMetni = (t, r) => JSON.stringify(t.kolonlar.map(c => r[c]));

/** S'yi tablo satırlarına çevirir: { tablo: Map(birincil anahtar -> satır) } */
function satirlaraCevir(S) {
  const R = {}; for (const t of TABLOLAR) R[t.ad] = new Map();
  const ekle = (ad, row) => {
    const t = TB[ad], r = {};
    for (const c of t.kolonlar) r[c] = row[c] === undefined ? null : row[c];
    if ('ek' in t.k && r.ek === null) r.ek = {};
    R[ad].set(pkAnahtar(t, r), r);
  };
  const cal = { id: 1, mevcut: [], program_ek: null, program_oge_var: null };
  const ust = {}, skaler = {};
  for (const key of Object.keys(S)) {
    const val = S[key]; if (val === undefined) continue;
    cal.mevcut.push(key);
    if (CALISTAY_IX.has(key)) { skaler[key] = val; continue; }
    const k = Object.prototype.hasOwnProperty.call(KOLEKSIYON, key) ? KOLEKSIYON[key] : null;
    if (k && k.uygun(val)) k.yaz(val, ekle, cal); else koy(ust, key, val); // tanınmayan ya da beklenmedik biçimli alan olduğu gibi saklanır
  }
  const { c, ek } = kodla(skaler, CALISTAY);
  for (const key of Object.keys(ek)) koy(ust, key, ek[key]);
  ekle('calistay', Object.assign(cal, c, { ek: ust }));
  return R;
}

/** satirlaraCevir'in tersi. Çalıştay satırı yoksa null döner. */
function satirlardanKur(R) {
  const cal = R.calistay.get('[1]'); if (!cal) return null;
  const S = {}, ek = cal.ek || {};
  for (const key of cal.mevcut || []) {
    if (Object.prototype.hasOwnProperty.call(ek, key)) { koy(S, key, ek[key]); continue; }
    if (CALISTAY_IX.has(key)) { koy(S, key, cal[CALISTAY_IX.get(key)[0]]); continue; }
    const k = Object.prototype.hasOwnProperty.call(KOLEKSIYON, key) ? KOLEKSIYON[key] : null;
    if (k) koy(S, key, k.kur(R, cal));
  }
  return S;
}

/** İki satır kümesi arasındaki farkı bulur. eski null ise her şey yenidir. */
function farkHesapla(eski, yeni) {
  const fark = []; let adet = 0;
  for (const t of TABLOLAR) {
    const E = eski ? eski[t.ad] : new Map(), Y = yeni[t.ad], sil = [], yaz = [];
    for (const [k, r] of E) if (!Y.has(k)) sil.push(r);
    for (const [k, r] of Y) { const e = E.get(k); if (!e || satirMetni(t, e) !== satirMetni(t, r)) yaz.push(r); }
    if (sil.length || yaz.length) { fark.push({ t, sil, yaz }); adet += sil.length + yaz.length; }
  }
  return { fark, adet };
}

/* ----------------------------------------------------------- veritabanı */
let havuz = null, dinleyici = null, dinlemeKapat = false;
const parametre = (tip, v) => (v === null || v === undefined) ? null : (tip === 'json' ? JSON.stringify(v) : (tip === 'text' ? String(v).toWellFormed().replace(/\u0000/g, '') : v)); // anahtar kolonlarında da yazılamayan karakter kalmasın

async function farkUygula(c, { fark }) {
  for (const { t, sil, yaz } of fark) {
    for (let i = 0; i < sil.length; i += 500) {
      const parca = sil.slice(i, i + 500), p = [], deg = [];
      for (const r of parca) deg.push('(' + t.pk.map(col => { p.push(parametre(t.k[col], r[col])); return `$${p.length}::${SQL_TIP[t.k[col]]}`; }).join(', ') + ')');
      await c.query(`DELETE FROM ${t.ad} WHERE (${t.pk.join(', ')}) IN (VALUES ${deg.join(', ')})`, p);
    }
    const adim = Math.max(1, Math.min(500, Math.floor(30000 / t.kolonlar.length)));
    const guncelle = t.kolonlar.filter(col => !t.pk.includes(col)).map(col => `${col} = EXCLUDED.${col}`).join(', ');
    for (let i = 0; i < yaz.length; i += adim) {
      const parca = yaz.slice(i, i + adim), p = [], deg = [];
      for (const r of parca) deg.push('(' + t.kolonlar.map(col => { p.push(parametre(t.k[col], r[col])); return `$${p.length}::${SQL_TIP[t.k[col]]}`; }).join(', ') + ')');
      await c.query(`INSERT INTO ${t.ad} (${t.kolonlar.join(', ')}) VALUES ${deg.join(', ')} ON CONFLICT (${t.pk.join(', ')}) DO UPDATE SET ${guncelle}`, p);
    }
  }
}

/** Bütün tabloları okur. Tutarlı bir anlık görüntü için bir işlem (transaction) içinde çağrılmalı. */
async function hepsiniOku(c) {
  const R = {};
  for (const t of TABLOLAR) {
    const { rows } = await c.query(`SELECT ${t.kolonlar.join(', ')} FROM ${t.ad}`);
    const m = new Map(); for (const r of rows) m.set(pkAnahtar(t, r), r); R[t.ad] = m;
  }
  return R;
}

async function baglan(url) {
  havuz = new Pool({
    connectionString: url, max: parseInt(process.env.PG_HAVUZ || '10', 10), application_name: 'kok',
    // veritabanı yanıt vermezse istekler sonsuza kadar beklemesin: bağlantı 5 sn, sorgu 10 sn, açık bırakılmış işlem 15 sn
    connectionTimeoutMillis: 5000, query_timeout: 10000, statement_timeout: 10000, idle_in_transaction_session_timeout: 15000,
  });
  havuz.on('error', e => console.error('Postgres bağlantı hatası:', e.message));
  await havuz.query('SELECT 1');
}
async function semaKur() {
  const c = await havuz.connect();
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(7340501)'); // aynı anda açılan kopyalar şemayı birlikte kurmaya çalışmasın
    for (const q of semaSql()) await c.query(q);
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}
/** İşlem (transaction) yardımcısı: hata olursa geri alır. */
async function islemde(fn, baslangic) {
  const c = await havuz.connect();
  try {
    await c.query(baslangic || 'BEGIN');
    const sonuc = await fn(c);
    await c.query('COMMIT');
    return sonuc;
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}
/** Tutarlı bir anlık görüntüden durumu okur: { S, R } ya da çalıştay hiç kurulmadıysa null. */
function durumOku(c) {
  const oku = async cc => { const R = await hepsiniOku(cc); const S = satirlardanKur(R); return S ? { S, R } : null; };
  return c ? oku(c) : islemde(oku, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
}
async function surumOku(c) { const { rows } = await (c || havuz).query('SELECT v FROM calistay WHERE id = 1'); return rows.length ? rows[0].v : null; }
async function surumKilitle(c) { const { rows } = await c.query('SELECT v FROM calistay WHERE id = 1 FOR UPDATE'); return rows.length ? rows[0].v : null; }
async function bildir(c, v) { await c.query("SELECT pg_notify('kok_degisti', $1)", [String(v)]); }
async function yedekEkle(c, neden, veriJson) { await c.query('INSERT INTO yedekler (neden, veri) VALUES ($1, $2::json)', [neden, veriJson]); }
/** Çalıştay satırı yoksa S'yi ilk kez yazar. Başka bir kopya önce yazdıysa false döner. */
function ilkKayit(S, yedek) {
  return islemde(async c => {
    await c.query('SELECT pg_advisory_xact_lock(7340502)');
    if ((await surumOku(c)) !== null) return false;
    await farkUygula(c, farkHesapla(null, satirlaraCevir(S)));
    if (yedek) await yedekEkle(c, yedek.neden, yedek.veri);
    return true;
  });
}
/** Başka kopyaların yazdığı değişiklikleri dinler (LISTEN). Bağlantı koparsa yeniden bağlanır. */
async function dinle(url, fn) {
  dinlemeKapat = false;
  const kur = async () => {
    if (dinlemeKapat) return;
    const c = new Client({ connectionString: url, application_name: 'kok-dinleyici', connectionTimeoutMillis: 5000 });
    const yeniden = () => { if (dinleyici !== c) return; dinleyici = null; c.end().catch(() => {}); if (!dinlemeKapat) setTimeout(() => kur().catch(() => {}), 2000); };
    c.on('error', e => { console.error('Postgres dinleyici hatası:', e.message); yeniden(); });
    c.on('end', yeniden);
    c.on('notification', m => { const v = Number(m.payload); if (Number.isFinite(v)) fn(v); });
    dinleyici = c;
    try { await c.connect(); await c.query('LISTEN kok_degisti'); fn(null); } // null: bağlantı (yeniden) kuruldu, aradaki değişiklikler için sürümü denetle
    catch (e) { console.error('Postgres dinleyici bağlanamadı:', e.message); yeniden(); }
  };
  await kur();
}
async function kapat() {
  dinlemeKapat = true;
  if (dinleyici) { const c = dinleyici; dinleyici = null; await c.end().catch(() => {}); }
  if (havuz) { const h = havuz; havuz = null; await h.end().catch(() => {}); }
}

module.exports = {
  TABLOLAR, semaSql, satirlaraCevir, satirlardanKur, farkHesapla, farkUygula,
  baglan, semaKur, islemde, durumOku, surumOku, surumKilitle, bildir, yedekEkle, ilkKayit, dinle, kapat,
  havuz: () => havuz,
};
