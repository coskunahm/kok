// Kalıcılık katmanı testi: durum Postgres'e yazılıp geri okununca birebir aynı olmalı (kayıpsız dönüşüm),
// yalnızca değişen satırlar yazılmalı ve değişiklikler (ekleme, güncelleme, silme) doğru uygulanmalı.
// İsteğe bağlı: KOK_DURUM_DIZINI=<klasör> içindeki *.json durum dosyaları da denenir.
const fs = require('fs'); const path = require('path');
const db = require('../db');
const { geciciVeritabani } = require('./pg-yardimci');

let ok = 0, fail = 0;
const t = (ad, c, ek) => { if (c) { ok++; console.log('  ✓', ad); } else { fail++; console.log('  ✗', ad, ek || ''); } };

// Değerler ve dizi sırası birebir; nesne alanlarının sırası önemsiz (haritaların sırası ayrıca denetlenir)
function esit(a, b, yol, hatalar) {
  if (a === b) return;
  if (typeof a !== typeof b || a === null || b === null || Array.isArray(a) !== Array.isArray(b) || typeof a !== 'object') { hatalar.push(yol + ': ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); return; }
  if (Array.isArray(a)) { if (a.length !== b.length) hatalar.push(yol + ': dizi uzunluğu ' + a.length + ' != ' + b.length); for (let i = 0; i < Math.min(a.length, b.length); i++) esit(a[i], b[i], yol + '[' + i + ']', hatalar); return; }
  const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b);
  for (const k of new Set([...ka, ...kb])) { if (!(k in a) || a[k] === undefined) hatalar.push(yol + '.' + k + ': fazladan'); else if (!(k in b)) hatalar.push(yol + '.' + k + ': eksik'); else esit(a[k], b[k], yol + '.' + k, hatalar); }
}
// Sırası anlamlı haritalar: Object.keys sırası korunmalı
function siralar(S) {
  const o = {}; const ekle = (ad, v) => { if (v && typeof v === 'object' && !Array.isArray(v)) o[ad] = Object.keys(v); };
  ekle('S', S); for (const k of ['ayar', 'hazirlik', 'masalar', 'katilimcilar', 'oylar', 'puanlar', 'bireyFikir', 'secim', 'detay', 'secimPuan']) ekle(k, S[k]);
  for (const [g, v] of Object.entries(S.oylar || {})) { ekle('oylar.' + g, v); for (const [p, x] of Object.entries(v || {})) if (x) ekle('oylar.' + g + '.' + p + '.alloc', x.alloc); }
  for (const [g, v] of Object.entries(S.puanlar || {})) ekle('puanlar.' + g, v);
  for (const [g, v] of Object.entries(S.secimPuan || {})) { ekle('secimPuan.' + g, v); for (const [f, x] of Object.entries(v || {})) ekle('secimPuan.' + g + '.' + f, x); }
  for (const [g, v] of Object.entries(S.detay || {})) if (v) ekle('detay.' + g + '.alan', v.alan);
  return JSON.stringify(o);
}
async function yazOku(dbUrl, S) {
  const c = await db.havuz().connect();
  try {
    await c.query('BEGIN'); for (const tb of db.TABLOLAR) await c.query('DELETE FROM ' + tb.ad); await db.farkUygula(c, db.farkHesapla(null, db.satirlaraCevir(S))); await c.query('COMMIT');
  } finally { c.release(); }
  return (await db.durumOku()).S;
}
function dene(ad, S, S2) {
  const hatalar = []; esit(JSON.parse(JSON.stringify(S)), S2, 'S', hatalar);
  t(ad + ': içerik birebir aynı', hatalar.length === 0, hatalar.slice(0, 5).join(' | '));
  t(ad + ': harita sıraları korunur', siralar(S) === siralar(S2));
}

// Zor durumlar: null'lar, boş haritalar, beklenmedik tipler, eksik alanlar, Unicode, sıra
function zorDurum() {
  return {
    v: 42, sablon: 'ana', olusturma: 1795790126548, asama: 'fikir',
    ayar: { baseUrl: '', esikDeger: 3, ayrilikEsigi: 1.2, otoKapat: true, bos: null, liste: [1, 2] },
    masalar: {
      '2A': { id: '2A', tema: 2, ad: 'Masa 2A', key: 'abc', fikirSayisi: 2, fikirKilit: false, tur: { G: { durum: 'acik', dar: null }, Z: { durum: 'hazir' } }, etiket: { G: { 2: 'iki', 1: 'bir' }, Z: {} }, bulgular: { G: null, Z: [] } },
      '1A': { id: 'baska', tema: 1.5, ad: 'Masa 1A', key: 'xyz', fazladan: { a: 1 } },
      '3A': { tema: 3, ad: null },
    },
    katilimcilar: {
      kb: { id: 'kb', token: 't1', kod: '12345', etiket: 'Şükrü Öztürk 😀', pozisyon: '', masa: '2A', ts: 1795790126809, cihazlar: [], kolay: true, geldiTs: 0 },
      ka: { id: 'ka', token: 't2', kod: '54321', etiket: "O'Brien \"tırnak\" \\ ters", pozisyon: 'NUL\u0000içeren', onceki: 'yarım \ud800 vekil', masa: '', ts: 1795790126810, cihazlar: ['tel1', 'tel2'], yedek: false, gelmeyecek: true, oncekiMasa: '2A' },
    },
    oylar: {
      '2A|G': { kb: { alloc: { 1: 2, 3: 1, 12: 2 }, ts: 1 }, ka: { alloc: {}, ts: 2 }, kc: { ts: 3 }, kd: { alloc: { 1: 'x' }, ts: 4 }, ke: null },
      '2A|Z': {}, 'bozuk|G': 'metin',
    },
    fikirler: [{ id: '2A-1', masa: '2A', sira: 1, ad: 'Fikir', no: null, swot: ['2AG-1'], kaynak: 'kb' }, { id: '2A-2', masa: '2A', sira: 2, ad: 'İkinci', no: 3, swot: [] }, null, 'tuhaf'],
    sunum: { aktif: null, durum: 'bos', sunumBas: 0, sunumSn: 0, puanKapanis: 0, puanSn: 0 },
    puanlar: { '2A-1': { kb: { etki: 3, uyg: 4.5, ts: 5 }, ka: { etki: 'x' } }, '2A-2': {} },
    bireyFikir: { kb: { masa: '2A', ad: 'Benim fikrim', swot: ['2AG-1'], ts: 9 }, ka: { masa: '2A', ad: '', swot: [], ts: 0 } },
    zaman: { etiket: 'Mola', bitis: 1795790999999, toplam: 600 },
    program: { oge: [{ b: 450, e: 460, ad: 'Açılış', not: 'Not', asama: 'hazirlik' }, { b: 1.5, ad: 'Kesirli' }], baslik: 'Gün' },
    secim: { '2A': { durum: 'sunum', tablo: true, sira: ['kb', 'ka'], aktif: 0, puanAcik: true, puanKapanis: 0, gozdenKapanis: 0, sonuc: null, onay: null, dar: { durum: 'acik', oylar: { kb: ['ka'] }, kura: null } } },
    detay: { kb: { takim: ['kb'], alan: { ozet: 'Özet', ilkadim: 'Adım' }, gonder: false, ts: 0 }, ka: { takim: [], alan: { sayi: 5 }, gonder: true, ts: 1 } },
    secimPuan: { '2A': { kb: { ka: { p: 4, ts: 1 } }, ka: {}, kc: null }, '3A': {} },
    hazirlik: { sunucu: 1795790126809, kesintisiz0: true },
    demoHiz: null, mola: { ac: true, baslik: 'Kahve', bitis: 1795790126809 }, bilinmeyenAlan: { x: [1, { y: 2 }] },
  };
}

(async () => {
  const vt = await geciciVeritabani();
  try {
    await db.baglan(vt.url); await db.semaKur();
    console.log('Kayıpsız dönüşüm');
    const Z = zorDurum(); dene('zor durum', Z, await yazOku(vt.url, Z));
    const dizin = process.env.KOK_DURUM_DIZINI;
    if (dizin) for (const f of fs.readdirSync(dizin).filter(x => x.endsWith('.json')).sort()) { const S = JSON.parse(fs.readFileSync(path.join(dizin, f), 'utf8')); dene(f, S, await yazOku(vt.url, S)); }

    console.log('Yalnızca değişen satırlar yazılır');
    const A = zorDurum(); await yazOku(vt.url, A);
    let R0 = (await db.durumOku()).R;
    t('değişiklik yoksa fark boştur', db.farkHesapla(R0, db.satirlaraCevir(A)).adet === 0);
    const B = zorDurum(); B.oylar['2A|G'].kb.alloc[3] = 2; B.katilimcilar.ka.geldi = true;
    const f1 = db.farkHesapla(R0, db.satirlaraCevir(B));
    t('bir oy ve bir katılımcı değişince yalnızca o satırlar yazılır', f1.adet === 2 && f1.fark.map(x => x.t.ad).sort().join() === 'katilimcilar,oy_dagilimlari', JSON.stringify(f1.fark.map(x => [x.t.ad, x.sil.length, x.yaz.length])));

    console.log('Ekleme, güncelleme ve silme');
    const C = zorDurum(); delete C.katilimcilar.kb; delete C.oylar['2A|G'].kb; C.fikirler.splice(0, 1); C.katilimcilar.yeni = { id: 'yeni', token: 't9', kod: '99999', etiket: 'Yeni', pozisyon: '', masa: '3A', ts: 7, cihazlar: [] };
    delete C.detay.kb.alan.ozet; C.secimPuan['2A'].kb.kz = { p: 1, ts: 2 }; C.ayar.yeniAyar = 'x'; delete C.mola;
    const cc = await db.havuz().connect();
    try { await cc.query('BEGIN'); await db.farkUygula(cc, db.farkHesapla(R0, db.satirlaraCevir(C))); await cc.query('COMMIT'); } finally { cc.release(); }
    dene('silme ve ekleme sonrası', C, (await db.durumOku()).S);

    console.log('Sürüm ve bildirim');
    const bildirimler = []; await db.dinle(vt.url, v => bildirimler.push(v));
    await db.islemde(async c => { t('sürüm kilitli okunur', (await db.surumKilitle(c)) === 42); await db.bildir(c, 43); });
    await new Promise(r => setTimeout(r, 300));
    t('başka kopyalara değişiklik bildirimi gider (LISTEN/NOTIFY)', bildirimler.includes(43), JSON.stringify(bildirimler));
    t('şema yeniden kurulabilir (açılışta tekrar çalışması güvenli)', await db.semaKur().then(() => true, () => false));
  } finally { await db.kapat(); await vt.sil(); }
  console.log('\n' + ok + ' geçti, ' + fail + ' kaldı');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
