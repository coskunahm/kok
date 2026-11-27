'use strict';
/*
 * KÖK Yönetici Çalıştayı - Telefonla Oylama ve Puanlama Sistemi
 * Bağımlılık yok: yalnızca Node.js (18+) yerleşik modülleri.
 * Çalıştırma:  ADMIN_PIN=1234 node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = parseInt(process.env.PORT || '3000', 10);
const SURUM = String(Date.now()); // sunucu her başladığında değişir; açık sayfalar kod değiştiyse kendini yeniler
const ADMIN_PIN = process.env.ADMIN_PIN || 'kok2026';
const KAYIT_PIN = process.env.KAYIT_PIN || 'kayit2026'; // kayıt masası PIN'i (yalnızca kayıt ekranı)
const CLOUDFLARE = /^cloudflare$/i.test(process.env.TRUST_PROXY || ''); // Cloudflare proxy arkasındaysa gerçek istemci IP'si CF-Connecting-IP'den alınır (istemci bunu sahteleyemez)
const TRUST_PROXY = CLOUDFLARE || /^(1|true|evet)$/i.test(process.env.TRUST_PROXY || ''); // ters vekil (Caddy/Nginx) arkasındaysa gerçek istemci IP'si X-Forwarded-For'dan alınır
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'state.json');
const PUB = path.join(__dirname, 'public');

const TEMALAR = [
  'Sürekli öğrenme fırsatları',
  'Sorgulama ve diyalog',
  'Takım halinde öğrenme ve işbirliği',
  'Öğrenmeyi yakalayan ve paylaşan sistemler',
  'Ortak vizyon doğrultusunda yetkilendirme',
  'Kurumun dış çevreyle bağlantısı',
  'Öğrenmeyi destekleyen stratejik liderlik'
];


/* ---------------------------------------------------- yönetici programı (yalnızca yönetim) */
function pdk(s) { const m = String(s).match(/(\d{1,2})[.:](\d{2})/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : NaN; }
function programVarsayilan() {
  const L = [
    ['07.30', '07.40', 'Sunucu ve adres', "Sunucuyu başlat; adres ve QR'ı telefondan dene (Wi-Fi veya tünel).", ''],
    ['07.40', '07.50', 'Hızlı prova ve sıfırlama', 'Ayarlar › Deneme araçları ile uçtan uca dene, sonra "Her şeyi sıfırla".', ''],
    ['07.50', '08.10', 'ID listesi ve kartlar', 'Katılımcılar › ID listesi yapıştır; masa ve tema kontrolü; kartları yazdır.', ''],
    ['08.10', '08.30', 'Ayarlar ve bağlantılar', 'Süreler: sunum 165 sn (2:45), puanlama 30 sn, masa içi puan 20 sn, gözden geçirme 120 sn. Masa bağlantılarını moderatörlere gönder; perdeyi aç.', ''],
    ['08.30', '09.00', 'Karşılama ve kahvaltı (kayıt, bağlanma)', 'Genel: bağlı sayısını izle (hedef 120/126 ve üzeri); takılanlara yardım et (masa değiştir, cihazı sıfırla). Aşama: Hazırlık.', 'hazirlik'],
    ['09.00', '09.10', 'Açılış: Halil İbrahim YILDIZ', 'İnsan ve Kültür Grup Başkanı.', 'hazirlik'],
    ['09.10', '09.20', 'Açılış: Dr. Ömer EMEÇ', 'Strateji, Dönüşüm ve Ekosistem Genel Müdür Yardımcısı.', 'hazirlik'],
    ['09.20', '09.40', 'Açılış: Recep Süleyman ÖZDİL', 'Genel Müdür.', 'hazirlik'],
    ['09.40', '10.00', 'KÖK Projesi Tanıtımı: Ahmet Coşkun', 'Konu ve yöntem (20 dk). SWOT oylamasını 3 dk açıkla: her post-it flipchart\'ta numaralı bir seçenek, oylar telefondan.', 'hazirlik'],
    ['10.00', '10.20', 'Kahve molası', 'Masalarda flipchart, tepsi ve post-it hazır mı? Moderatörler panele girebiliyor mu?', ''],
    ['10.20', '10.42', 'Tur 1 (güçlü): yönerge ve brainwriting', '2 dk yönerge + tam tur (7–8 katılımcı × 2 dk = 14–16 dk; moderatör yazmaz, süreyi yönetir). Telefon kullanılmaz. İsterse ortak sayaç başlat.', 'hazirlik'],
    ['10.42', '11.10', 'Tur 1: okuma, yapıştırma, eleme', 'Post-it\'ler tek tek okunur, aynı şeyi söyleyenler elenir, flipchart\'a numaralı yapıştırılır (28 dk). Gerekirse sohbet ve tartışma için kullan.', 'hazirlik'],
    ['11.10', '11.15', 'Güçlü yan oylaması', 'Aşama: Güçlü yön oylaması. Moderatörler panelden flipchart üzerindeki post-it sayısını girip oylamayı açar (oy hakkı post-it/2, en çok 15; en fazla 2). 5 dk.', 'guclu'],
    ['11.15', '11.20', 'Güçlü yan: içerik ve seans kapanışı', 'Oylama kapanınca moderatör ilk 5 post-it\'in içeriğini yazar (eşitlik varsa masayla seçer) ve "Seansı kapat" der; bulgular sisteme kaydedilir. 5 dk.', ''],
    ['11.20', '11.40', 'Ara (20 dk)', 'Güçlü oylama "Kapandı" mı? Zayıf yan için masaları hazırla: flipchart\'ta yeni sayfa, tepsiler.', ''],
    ['11.40', '12.02', 'Tur 2 (zayıf): yönerge ve brainwriting', '2 dk yönerge + tam tur (7–8 katılımcı × 2 dk = 14–16 dk). Güçlü yan kapanmadan zayıf yan açılmaz.', ''],
    ['12.02', '12.30', 'Tur 2: okuma, yapıştırma, eleme', 'Aynı akış; zayıf yönler (28 dk).', ''],
    ['12.30', '12.35', 'Zayıf yan oylaması', 'Aşama: Zayıf yön oylaması. 5 dk.', 'zayif'],
    ['12.35', '12.40', 'Zayıf yan: içerik ve seans kapanışı, pano', 'Moderatörler zayıf yanların ilk 5 post-it içeriğini yazıp "Seansı kapat" der. Yönetim › SWOT aşaması: tüm masalarda iki seans "seans kapandı" mı? 5 dk.', ''],
    ['12.40', '14.00', 'Öğle yemeği (80 dk)', 'SWOT oyları CSV yedeği al. 13.45\'te aşamayı Fikir yazımı yap.', ''],
    ['14.00', '14.10', 'Tema tablosu', 'Genel › Tema tablosu: "Tüm telefonlarda aç". Moderatörler tabloyu sesli okur. 10 dk.', 'fikir'],
    ['14.10', '14.35', 'Sessiz brainstorming', 'Genel › Süre sayacı: "Fikir geliştirme" 25 dk. Herkes tablodan ilham alıp kâğıda bir dizi fikir yazar; en etkili üçünü, sonra birini seçip telefonundan girer.', 'fikir'],
    ['14.35', '14.55', 'Masada anlatma ve puanlama', 'Moderatörler: sunumları başlat (fikirler 1\'den sırayla anlatılır, herkes dinledikçe puanlar), puanlamayı sonlandır, 2. ve 3. fikir ekranda aynı puanı gösteriyorsa (örn. 4,4 ve 4,4) dar oylama (gerekirse kura), ilk 2\'yi kaydet. Genel tablodan masaları izle. 20 dk.', 'fikir'],
    ['14.55', '15.15', 'Sunuma hazırlık ve numaralandırma', 'Masalar iki öneriyi detaylandırıp gönderir (yazar telefondan yazar). İsteğe bağlı: moderatör öneri adlarını masa ekranında tek cümleye getirebilir; zorunlu değil. 20 dk. Önerisi 2/2 olmayan masaları kontrol et. Sonunda Fikirler ve sunum › "Masa sırasıyla numaralandır" (28 öneri, 1A→7B) ve aşama: Sunumlar.', 'fikir'],
    ['15.15', '15.35', 'Kahve molası (20 dk)', 'İlk öneriyi seç ("İlk öneriyi seç"); perde ve telefonlar hazır.', ''],
    ['15.35', '17.15', 'Genel kurul: 28 öneri (tek seans)', 'Öneri başına 3:15 (2 dk 45 sn sunum + 30 sn puan ve geçiş) = 91:00; 17.06\'da biter, kalan 9 dk taşma payıdır. Başlangıçlar: 1→15.35, 5→15.48, 9→16.01, 13→16.14, 17→16.27, 21→16.40, 25→16.53, 28→17.02:45. Sunum süresini sıkı tut; gecikme olursa +dk düğmesiyle kaydır. Gecikme olmadıysa 17.06\'da sonuca geç.', 'sunum'],
    ['17.15', '17.30', 'Sonuç ve kapanış', 'Sonuçları yayına al: matris (2 dk), öne çıkan öneriler (3 dk). Sonra mesajlar: sahiplenme, proje bıkkınlığı, kılcal damarlara inme, yönetim düzeyinde kalmama (üst katılımcı, 5 dk); ekiplere anlatma görevi (3 dk); teşekkür (2 dk) = 15 dk.', 'sonuc'],
    ['17.30', '18.00', 'Toplama ve kayıt', 'CSV\'leri indir (matris, puanlar, SWOT oyları, adlı katılımcı listesi); sonra veriyi sil.', ''],
  ];
  return { oge: L.map(([b, e, ad, not, asama]) => ({ b: pdk(b), e: pdk(e), ad, not, asama })) };
}
function programParse(metin) {
  const oge = [], hata = [];
  for (const [i, ln] of String(metin || '').split(/\r?\n/).entries()) {
    if (!ln.trim()) continue;
    const parca = ln.split('|').map(x => x.trim());
    const m = parca[0].match(/(\d{1,2})[.:](\d{2})\s*[–—-]\s*(\d{1,2})[.:](\d{2})/);
    if (!m) { hata.push((i + 1) + '. satır: saat aralığı okunamadı'); continue; }
    const b = +m[1] * 60 + +m[2], e = +m[3] * 60 + +m[4];
    if (!(e > b) || e > 1440 || !parca[1]) { hata.push((i + 1) + '. satır: bitiş başlangıçtan sonra olmalı ve başlık yazılmalı'); continue; }
    const asama = ['hazirlik', 'guclu', 'zayif', 'fikir', 'sunum', 'sonuc'].includes(parca[3]) ? parca[3] : '';
    oge.push({ b, e, ad: metin1(parca[1], 80), not: metin1(parca[2] || '', 300), asama });
  }
  oge.sort((x, y) => x.b - y.b);
  return { oge, hata };
}
function kes(s, n) { const a = Array.from(s); return a.length <= n ? s : a.slice(0, n).join(''); } // Unicode bütünlüğünü korur (emoji ortadan kesilmez)
function metin1(s, n) { return kes(String(s == null ? '' : s).replace(/\s+/g, ' ').trim(), n); }

/* ------------------------------------------------------------------ durum */
function uid(n = 10) {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  const b = crypto.randomBytes(n);
  let s = '';
  for (let i = 0; i < n; i++) s += a[b[i] % a.length];
  return s;
}
function yeniTur() { return { alan: 0, postit: 0, oy: 0, maxPer: 2, ilkK: 5, durum: 'hazir' }; }
function yeniMasa(id, tema, ad) {
  return { id, tema, ad: ad || ('Masa ' + id), key: uid(6), fikirSayisi: 2, fikirKilit: false,
    tur: { G: yeniTur(), Z: yeniTur() }, etiket: { G: {}, Z: {} }, bulgular: { G: null, Z: null } };
}
function masalarKur(sablon) {
  const m = {};
  if (sablon === 'demo') {
    m['A'] = yeniMasa('A', 3, 'A masası'); m['B'] = yeniMasa('B', 3, 'B masası');
  } else {
    for (let t = 1; t <= 7; t++) for (const h of ['A', 'B']) m[t + h] = yeniMasa(t + h, t, 'Masa ' + t + h);
  }
  return m;
}
function bosDurum(sablon = 'ana') {
  return {
    v: 1, sablon, olusturma: Date.now(),
    asama: 'hazirlik', // hazirlik | guclu | zayif | fikir | sunum | sonuc
    ayar: { baseUrl: (process.env.BASE_URL || '').replace(/\/$/, ''), zorunluTam: true, kendiMasaPuan: false, esik: 'orta', esikDeger: 3, ayrilikEsigi: 1.2,
      sunumSn: 165, puanSn: 30, minPuanYuzde: 80, otoKapat: true, acikKatilim: false, kayitKapali: false, sonucSlayt: 0,
      secimPuanSn: 20, gozdenSn: 120, cihazKilidi: false, otoPuan: true },
    masalar: masalarKur(sablon),
    katilimcilar: {},
    oylar: {},            // "masa|tur" -> { pid: {alloc, ts} }
    fikirler: [],         // {id, masa, sira, ad, no}
    sunum: { aktif: null, durum: 'bos', sunumBas: 0, sunumSn: 0, puanKapanis: 0, puanSn: 0 },
    puanlar: {},          // fikirId -> { pid: {etki, uyg, ts} }
    bireyFikir: {},       // pid -> { masa, ad, ts }  (katılımcının kendi fikri)
    zaman: { etiket: '', bitis: 0, toplam: 0 }, // ortak geri sayım (telefonlarda ve perdede)
    program: programVarsayilan(),               // günün programı: yalnızca yönetici paneli
    secim: {},            // masaId -> masa içi fikir seçimi durumu
    detay: {},            // fikirId -> { takim:[pid], alan:{anahtar:metin}, gonder:bool, ts }  (önerinin sunum içeriği)
    secimPuan: {}         // masaId -> { fikirId(sahip pid) -> { puanlayan pid -> {p, ts} } }
  };
}
let S = bosDurum();
function durumGecerli(j) { return j && typeof j === 'object' && j.masalar && typeof j.masalar === 'object' && j.katilimcilar && typeof j.katilimcilar === 'object'; }
function yukle() { // ana dosya bozuksa sessizce boş başlamaz: sırayla geçici/önceki/yedek dosyalar denenir; hiçbiri yoksa açılış durur (üzerine boş yazılmaz)
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { console.error('Veri klasörü açılamadı:', e.message); process.exit(1); }
  if (!fs.existsSync(FILE)) { for (const ek of ['.tmp', '.onceki']) if (fs.existsSync(FILE + ek)) { try { if (durumGecerli(JSON.parse(fs.readFileSync(FILE + ek, 'utf8')))) { console.error('Ana durum dosyası yok; ' + ek + ' kullanılıyor.'); fs.copyFileSync(FILE + ek, FILE); break; } } catch (e) { /* sıradakini dene */ } } }
  if (!fs.existsSync(FILE)) return; // ilk kurulum: boş çalıştay
  const adaylar = [FILE]; try { for (const f of fs.readdirSync(DATA_DIR).filter(x => /^state\.json\.(tmp|onceki|yedek-.*)$/.test(x)).sort((x, y) => fs.statSync(path.join(DATA_DIR, y)).mtimeMs - fs.statSync(path.join(DATA_DIR, x)).mtimeMs)) adaylar.push(path.join(DATA_DIR, f)); } catch (e) { /* yut */ }
  let ilkHata = null;
  for (const dosya of adaylar) {
    try {
      const j = JSON.parse(fs.readFileSync(dosya, 'utf8')); if (!durumGecerli(j)) throw new Error('geçersiz durum yapısı');
      if (dosya !== FILE) { try { fs.copyFileSync(FILE, FILE + '.bozuk-' + Date.now()); } catch (e) { /* yut */ } console.error('UYARI: ana durum dosyası okunamadı (' + ilkHata + '); ' + path.basename(dosya) + ' ile devam ediliyor. Bozuk dosya ".bozuk-…" olarak saklandı.'); }
      S = Object.assign(bosDurum(j.sablon || 'ana'), j);
      S.ayar = Object.assign(bosDurum().ayar, j.ayar || {});
      for (const m of Object.values(S.masalar || {})) for (const k of ['G', 'Z']) if (m.tur && m.tur[k] && m.tur[k].durum === 'hazir') { m.tur[k].alan = m.tur[k].postit || 0; if (!m.tur[k].oy) m.tur[k].maxPer = 2; }
      return;
    } catch (e) { if (dosya === FILE) ilkHata = e.message; }
  }
  console.error('HATA: durum dosyası okunamadı ve sağlam bir yedek bulunamadı (' + ilkHata + '). Veri korunsun diye sunucu açılmadı. Dosya: ' + FILE);
  process.exit(1);
}
let persistT = null, persistIlk = 0, sonOnceki = 0;
function yaz() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    if (Date.now() - sonOnceki > 30000 && fs.existsSync(FILE)) { try { fs.copyFileSync(FILE, FILE + '.onceki'); sonOnceki = Date.now(); } catch (e) { /* yut */ } } // sağlam bir önceki sürüm (bozulmaya karşı)
    fs.writeFileSync(tmp, JSON.stringify(S));
    fs.renameSync(tmp, FILE);
  } catch (e) { console.error('Kayıt hatası:', e.message); }
}
function persist(sync = false) { // değişiklikler birleştirilir ama diske yazma en geç ~1 sn gecikir (kesintisiz trafikte bile)
  if (sync) { clearTimeout(persistT); persistT = null; persistIlk = 0; return yaz(); }
  if (!persistIlk) persistIlk = Date.now();
  clearTimeout(persistT);
  persistT = setTimeout(() => { persistIlk = 0; persistT = null; yaz(); }, Math.max(0, Math.min(400, persistIlk + 1000 - Date.now())));
}

/* ------------------------------------------------------------- canlı yayın */
const clients = new Set();
let bcastT = null;
function commit() {
  S.v++;
  persist();
  clearTimeout(bcastT);
  bcastT = setTimeout(() => {
    for (const r of clients) { try { r.write('event: v\ndata: ' + S.v + '\n\n'); } catch (e) { clients.delete(r); } }
  }, 120);
}
setInterval(() => { for (const r of clients) { try { r.write(': hb\n\n'); } catch (e) { clients.delete(r); } } }, 20000);
const seen = {}; // pid -> son görülme (bellekte)
const BASLANGIC = Date.now(); // sunucu açılış anı: yeniden başlatmadan sonra 2 dk boyunca yazarlık devralınamaz

/* ------------------------------------------------------------- yardımcılar */
const temaAd = (n) => TEMALAR[(n || 1) - 1] || ('Tema ' + n);
function hata(res, kod, msg) { json(res, { hata: msg }, kod); }
function json(res, obj, kod = 200) {
  const b = JSON.stringify(obj);
  res.writeHead(kod, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(b);
}
function body(req) {
  return new Promise((ok, no) => {
    let d = ''; req.on('data', c => { d += c; if (d.length > 2e6) { no(new Error('çok büyük')); req.destroy(); } });
    req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { no(e); } });
    req.on('error', no);
  });
}
function lanIps() {
  const out = [];
  for (const l of Object.values(os.networkInterfaces())) for (const a of l || [])
    if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}
function baseUrl(req) {
  if (S.ayar.baseUrl) return S.ayar.baseUrl.replace(/\/$/, '');
  const ip = lanIps()[0];
  if (ip) return 'http://' + ip + ':' + PORT;
  return 'http://' + (req && req.headers.host ? req.headers.host : 'localhost:' + PORT);
}
const clampInt = (v, a, b, d) => { v = parseInt(v, 10); if (isNaN(v)) return d; return Math.max(a, Math.min(b, v)); };
const metin = (s, n) => kes(String(s == null ? '' : s).replace(/\s+/g, ' ').trim(), n);

function katilimciBul(token) {
  for (const k of Object.values(S.katilimcilar)) if (k.token === token) return k;
  return null;
}
function moderatorTemizle() { for (const k of Object.values(S.katilimcilar)) if (k.kolay) katilimciTemizle(k.id); } // moderatör katılımcı değildir: varsa eski oy, fikir ve puan kayıtları silinir
function masaUyeleri(masaId) { return Object.values(S.katilimcilar).filter(k => k.masa === masaId); } // masadaki herkes (moderatör dahil)
function atananlar(masaId) { return masaUyeleri(masaId).filter(k => !k.kolay); } // yalnızca katılımcılar: moderatör oy, fikir ve puan sürecine girmez
function yeniKod() {
  const kullanilan = new Set(Object.values(S.katilimcilar).map(k => k.kod));
  for (let i = 0; i < 20000; i++) { const k = String(10000 + crypto.randomInt(90000)); if (!kullanilan.has(k)) return k; }
  return String(crypto.randomInt(1000000, 9999999));
}
function katilimciEkle(masa, etiket, kod, pozisyon) {
  const id = 'k' + uid(7);
  S.katilimcilar[id] = { id, token: uid(10), kod: kod || yeniKod(), etiket: metin(etiket, 60), pozisyon: metin(pozisyon, 60), masa: masa || '', ts: Date.now(), cihazlar: [] };
  return S.katilimcilar[id];
}
/* katılım kimliği (ID): büyük harfe çevrilir, 3-12 harf/rakam */
const kodDuzelt = s => String(s == null ? '' : s).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
function kodBul(kod) { const c = kodDuzelt(kod); return c ? Object.values(S.katilimcilar).find(x => kodDuzelt(x.kod) === c) : null; }
/* cihaz izleme: aynı kimliğin kaç farklı tarayıcıdan kullanıldığı kaydedilir; kilit açıksa ikinci cihaza izin verilmez */
function cihazKontrol(k, req) {
  const c = String(req.headers['x-cihaz'] || '').slice(0, 64);
  if (!c) return S.ayar.cihazKilidi ? 'Tarayıcı tanımlanamadı. Sayfayı yenileyin.' : null;
  k.cihazlar = k.cihazlar || [];
  if (k.cihazlar.includes(c)) return null;
  if (S.ayar.cihazKilidi && k.cihazlar.length >= 1) return 'Bu katılım kimliği başka bir cihazda kullanılıyor. Lütfen masanızın moderatörüne başvurun.';
  if (k.cihazlar.length < 5) { k.cihazlar.push(c); persist(); }
  return null;
}
/* kimlik denemelerinde kaba kuvvet sınırı: IP başına 10 dakikada en fazla 20 hatalı deneme */
const denemeler = {};
function istemciIp(req) { if (CLOUDFLARE) { const c = String(req.headers['cf-connecting-ip'] || '').trim(); if (c) return c.slice(0, 64); } if (TRUST_PROXY) { const x = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim(); if (x) return x.slice(0, 64); } return req.socket.remoteAddress || '?'; }
const pinDeneme = {}; /* yönetim/kayıt PIN'i: IP başına 10 dakikada en çok 15 hatalı deneme */
function pinSiniri(req) {
  const hp = req.headers['x-pin'] !== undefined && req.headers['x-pin'] !== ADMIN_PIN, hk = req.headers['x-kayit-pin'] !== undefined && req.headers['x-kayit-pin'] !== KAYIT_PIN && req.headers['x-pin'] !== ADMIN_PIN;
  const ip = istemciIp(req), t = Date.now(), d = pinDeneme[ip] = (pinDeneme[ip] || []).filter(x => t - x < 600000);
  if (d.length >= 15) return false;
  if ((req.headers['x-pin'] !== undefined && hp) || (req.headers['x-kayit-pin'] !== undefined && hk && req.headers['x-pin'] === undefined)) d.push(t);
  return true;
}
function denemeSiniri(ip, basarili) {
  const t = Date.now(), d = denemeler[ip] = (denemeler[ip] || []).filter(x => t - x < 600000);
  if (basarili) return d.length < 80;
  d.push(t); return d.length <= 80;
}
function oyKey(masa, tur) { return masa + '|' + tur; }

/* ------------------------------------------------------------ SWOT sonuçları */
function turKontrol(t) {
  if (!t.postit || t.postit < 1) return 'Flipchart\'taki post-it sayısını girin.';
  if (!t.oy || t.oy < 1) return 'Oy hakkını girin.';
  if (!t.maxPer || t.maxPer < 1) return 'Aynı alana verilebilecek en fazla oyu girin.';
  if (t.postit * t.maxPer < t.oy) return 'Oy hakkı, post-it sayısı × en fazla oy değerinden büyük; tüm oylar kullanılamaz.';
  return null;
}
const OY_UST = 15; // kişi başı oy hakkı üst sınırı (telefonda çok sayıda dokunuş gerekmesin)
function oneriOy(postit) { return Math.min(OY_UST, Math.max(1, Math.round((postit || 0) / 2))); }
function oneriMaxPer(alan, oy) {
  if (!alan || !oy) return 2;
  return Math.max(2, Math.ceil(oy / alan)); // varsayılan: post-it başına en fazla 2 oy
}
function ilkAdaylar(r) { // ilk K: kesin girenler ve (eşitlikte yer sayısından fazlaysa) seçim bekleyen adaylar
  const oylu = r.sirali.filter(x => x.oy > 0), K = Math.min(r.K, oylu.length);
  if (!K) return { kesin: [], adaylar: [], yer: 0 };
  const esik = oylu[K - 1].oy, kesin = oylu.filter(x => x.oy > esik);
  return { kesin, adaylar: oylu.filter(x => x.oy === esik), yer: K - kesin.length };
}
function turSonuc(masaId, tur) {
  const m = S.masalar[masaId]; if (!m) return null;
  const t = m.tur[tur];
  const kayit = S.oylar[oyKey(masaId, tur)] || {};
  const say = {}; let toplam = 0; const oyVeren = Object.keys(kayit).length;
  for (const e of Object.values(kayit)) for (const [no, c] of Object.entries(e.alloc)) { say[no] = (say[no] || 0) + c; toplam += c; }
  const liste = [];
  for (let n = 1; n <= (t.alan || 0); n++) liste.push({ no: n, oy: say[n] || 0, etiket: m.etiket[tur][n] || '' });
  const sirali = liste.slice().sort((a, b) => b.oy - a.oy || a.no - b.no);
  const K = Math.min(t.ilkK || 5, sirali.length);
  let esik = K > 0 ? sirali[K - 1].oy : 0;
  const ilk = esik > 0 ? sirali.filter(x => x.oy >= esik) : [];
  const esitlik = ilk.length > K;
  return { liste, sirali, ilk, K, esitlik, oyVeren, toplamOy: toplam, atanan: atananlar(masaId).length };
}

/* --------------------------------------------------------------- puan/matris */
function ort(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function sd(a) { if (a.length < 2) return 0; const m = ort(a); return Math.sqrt(ort(a.map(x => (x - m) * (x - m)))); }
function matris() {
  const oge = [];
  for (const f of S.fikirler) {
    if (f.no == null || !f.ad) continue;
    const p = Object.values(S.puanlar[f.id] || {});
    if (!p.length) continue;
    const e = p.map(x => x.etki), u = p.map(x => x.uyg);
    const m = S.masalar[f.masa];
    oge.push({ id: f.id, no: f.no, ad: f.ad, masa: f.masa, tema: m ? m.tema : 0, n: p.length,
      etki: ort(e), uyg: ort(u), sdE: sd(e), sdU: sd(u), ayrilik: Math.max(sd(e), sd(u)) >= S.ayar.ayrilikEsigi });
  }
  let eE = S.ayar.esikDeger, eU = S.ayar.esikDeger;
  if (S.ayar.esik === 'ortalama' && oge.length >= 2) { eE = ort(oge.map(o => o.etki)); eU = ort(oge.map(o => o.uyg)); }
  const c = { hizli: [], stratejik: [], sinirli: [], beklet: [] };
  for (const o of oge) {
    const yE = o.etki >= eE, yU = o.uyg >= eU;
    o.ceyrek = yE && yU ? 'hizli' : yE ? 'stratejik' : yU ? 'sinirli' : 'beklet';
    c[o.ceyrek].push(o);
  }
  for (const k of Object.keys(c)) c[k].sort((a, b) => (b.etki + b.uyg) - (a.etki + a.uyg));
  oge.sort((a, b) => a.no - b.no);
  const puansiz = S.fikirler.filter(f => f.no != null && f.ad && !oge.find(o => o.id === f.id)).sort((a, b) => a.no - b.no).map(f => ({ no: f.no, ad: f.ad, masa: f.masa }));
  return { esikEtki: eE, esikUyg: eU, esikTur: S.ayar.esik, oge, ceyrekler: c, puansiz };
}
function aktifFikir() { return S.sunum.aktif ? S.fikirler.find(f => f.id === S.sunum.aktif) || null : null; }
function fikirGor(f) {
  if (!f) return null;
  const m = S.masalar[f.masa];
  const toplamF = S.fikirler.filter(x => x.no != null && x.ad).length;
  const dt = S.detay[f.id] || {};
  return { id: f.id, no: f.no, ad: f.ad, masa: f.masa, tema: m ? m.tema : 0, temaAd: m ? temaAd(m.tema) : '', toplam: toplamF,
    swot: swotListe(m, f.swot || []), alan: dt.alan || {}, gonder: !!dt.gonder };
}
function sunumGor() {
  const s = S.sunum, f = aktifFikir();
  const hak = Object.values(S.katilimcilar).filter(k => k.masa && !k.kolay && (S.ayar.kendiMasaPuan || !f || k.masa !== f.masa)).length;
  const p = f ? Object.keys(S.puanlar[f.id] || {}).length : 0;
  const liste = S.fikirler.filter(x => x.no != null && x.ad).sort((a, b) => a.no - b.no), ix = f ? liste.findIndex(x => x.id === f.id) : -1, sd = ix >= 0 ? liste[ix + 1] : liste[0];
  return { sira: liste.map(x => ({ no: x.no, masa: x.masa })), siradaki: sd ? { no: sd.no, masa: sd.masa } : null, durum: s.durum, fikir: fikirGor(f), sunumBas: s.sunumBas, sunumSn: s.sunumSn, puanKapanis: s.puanKapanis, puanSn: s.puanSn,
    puanVeren: p, katilimci: hak, esik: Math.ceil(hak * (S.ayar.minPuanYuzde == null ? 80 : S.ayar.minPuanYuzde) / 100) }; // hak: puanlayabilecek kişi sayısı (kendi masa hariç); esik: kabul için gereken puan sayısı
}

let puanTimer = null;
function puanZamanla() {
  clearTimeout(puanTimer);
  const s = S.sunum;
  if (s.durum === 'sunum' && s.sunumBas && S.ayar.otoPuan !== false) { // sunum süresi dolunca puanlama kendiliğinden açılır ("Puanlamayı aç" düğmesiyle daha erken de açılabilir)
    const w = Math.max(0, s.sunumBas + s.sunumSn * 1000 - Date.now());
    puanTimer = setTimeout(() => {
      const x = S.sunum;
      if (x.durum === 'sunum' && Date.now() >= x.sunumBas + x.sunumSn * 1000 - 50) { x.durum = 'puan'; x.puanSn = S.ayar.puanSn; x.puanKapanis = x.puanSn > 0 ? Date.now() + x.puanSn * 1000 : 0; commit(); puanZamanla(); } else puanZamanla();
    }, w + 30);
    return;
  }
  if (s.durum === 'puan' && s.puanKapanis && S.ayar.otoKapat) {
    const w = Math.max(0, s.puanKapanis - Date.now());
    puanTimer = setTimeout(() => {
      if (S.sunum.durum === 'puan' && S.sunum.puanKapanis && Date.now() >= S.sunum.puanKapanis - 50) {
        S.sunum.durum = 'kapali'; commit();
      } else puanZamanla();
    }, w + 30);
  }
}

/* ------------------------------------------------- masa içi fikir seçimi (anında puan) */
function yeniSecim() { return { durum: 'hazir', tablo: false, sira: [], aktif: 0, puanAcik: false, puanKapanis: 0, gozdenKapanis: 0, sonuc: null, onay: null, dar: null }; }
function molaGor() { const m = S.mola; if (!m || !m.ac) return null; return { baslik: m.baslik, bitis: m.bitis || 0 }; }
function zamanGor() { const z = S.zaman || {}; return { etiket: z.etiket || '', bitis: z.bitis || 0, toplam: z.toplam || 0 }; }
/* ------------------------------------------------------------ öneri detayları (sunum içeriği) */
const DETAY_ALAN = [ // genel kurulda 2-3 dakikalık sunum için sade tutuldu; SWOT dayanağı fikir girişindeki seçimden otomatik gelir
  { k: 'uygulama', ad: 'Ne yapılacak?', ipucu: 'Somut uygulama: bir iki cümle', ornek: 'Her cuma 15 dakikalık ayakta toplantı yapılır; ekip üç soruyu yanıtlar: ne öğrendik, ne işe yaradı, neyi değiştirelim?', max: 200 },
  { k: 'kapsam', ad: 'Kimler için, nerede?', ipucu: 'Kapsam ve katılım', ornek: 'Şube ve genel müdürlük ekipleri; ilk aşamada 3 bölge, yaklaşık 40 katılımcı.', max: 200 },
  { k: 'katki', ad: 'Beklenen öğrenme katkısı', ipucu: 'Öğrenme, paylaşım veya işe aktarımda ne değişecek?', ornek: 'Öğrenilenler ekipler arasında hızla paylaşılır; aynı hata farklı birimlerde tekrarlanmaz.', max: 200 },
  { k: 'basari', ad: 'Başarı göstergesi', ipucu: 'İşe yaradığını hangi değişimden anlayacağız?', ornek: 'Üç ay sonra ekiplerin %70\'i haftalık toplantıya düzenli katılıyor; tekrar eden hata sayısı azalıyor.', max: 200 },
  { k: 'ilkadim', ad: 'İlk adım ve sahiplik', ipucu: 'Nasıl başlanacak, sorumlu kim, ilk deneme ne kadar sürecek?', ornek: 'İlk ay bir pilot bölgede deneme; sorumlu bölge koordinatörü.', max: 200 }
];
function detayOf(fid) { return S.detay[fid] || (S.detay[fid] = { takim: [], alan: {}, gonder: false, ts: 0 }); }
function masaFikirListe(masaId) { return S.fikirler.filter(f => f.masa === masaId && f.ad).sort((a, b) => a.sira - b.sira); }
function detayGor(masaId, pid) {
  const fl = masaFikirListe(masaId); if (!fl.length) return null;
  return fl.map(f => { const d = S.detay[f.id] || { takim: [], alan: {}, gonder: false };
    return { id: f.id, sira: f.sira, no: f.no, ad: f.ad, gonder: !!d.gonder, alan: d.alan || {}, swot: swotListe(S.masalar[masaId], f.swot || []), benim: !!pid && d.takim.includes(pid),
      takim: d.takim.map(x => (S.katilimcilar[x] || {}).etiket).filter(Boolean) }; });
}
function detayIslem(m, k, b, yetkili) { // k: katılımcı (moderatör/yönetim için null olabilir)
  const f = S.fikirler.find(x => x.id === b.fikirId && x.masa === m.id && x.ad); if (!f) return 'Bu masada böyle bir öneri yok.';
  const d = detayOf(f.id), uye = !!k && d.takim.includes(k.id), yet = yetkili || (!!k && !!k.kolay);
  if (b.islem === 'katil') { // "yazmayı ben üstleniyorum": öneri başına tek yazar; başkası yazıyorsa devralınamaz (yazar çevrimdışıysa 2 dk sonra devralınabilir)
    if (!k) return 'Yazar seçimi katılımcı ekranından yapılır.';
    const yz = d.takim[0];
    if (yz && yz !== k.id) { const o = S.katilimcilar[yz]; if (o && Date.now() - Math.max(seen[yz] || 0, BASLANGIC) < 120000) return 'Şu an ' + o.etiket + ' yazıyor. O kişi "Yazmayı bırak" derse siz devralabilirsiniz.'; }
    for (const g of masaFikirListe(m.id)) { const x = S.detay[g.id]; if (x) x.takim = x.takim.filter(i => i !== k.id); }
    d.takim = [k.id]; seen[k.id] = Date.now(); return null; // yazar olan çevrimiçi sayılır
  }
  if (b.islem === 'birak') { if (!uye && !yet) return 'Bu öneriyi şu an siz yazmıyorsunuz.'; d.takim = []; return null; }
  if (!uye && !yet) return d.takim.length ? 'Şu an ' + ((S.katilimcilar[d.takim[0]] || {}).etiket || 'başka biri') + ' yazıyor; yazan kişi dışında değişiklik yapılamaz.' : 'Önce "Yazmayı ben yapacağım" deyin.';
  if (b.islem === 'kaydet') {
    if (d.gonder) return 'Gönderildi; değiştirmek için önce "Düzenlemeye aç" deyin.';
    for (const a of DETAY_ALAN) if (b.alan && a.k in b.alan) { const v = metin1(b.alan[a.k], a.max); if (v) d.alan[a.k] = v; else delete d.alan[a.k]; }
    d.ts = Date.now(); return null;
  }
  if (b.islem === 'gonder') { if (!Object.keys(d.alan).length) return 'Göndermeden önce en az bir alanı doldurun.'; d.gonder = true; d.ts = Date.now(); return null; }
  if (b.islem === 'ac') { d.gonder = false; return null; }
  return 'Bilinmeyen işlem';
}
function sunumVeri() { // genel kurul sırasıyla (kura numarası); numarasızlar masa sırasıyla sona
  const l = S.fikirler.filter(f => f.ad).sort((a, b) => (a.no == null ? 1e9 : a.no) - (b.no == null ? 1e9 : b.no) || a.masa.localeCompare(b.masa) || a.sira - b.sira);
  return { slaytlar: l.map((f, i) => { const m = S.masalar[f.masa] || {}, d = S.detay[f.id] || { alan: {} };
    return { no: f.no != null ? f.no : i + 1, toplam: l.length, masa: f.masa, tema: m.tema || 0, temaAd: m.tema ? temaAd(m.tema) : '', ad: f.ad, swot: swotListe(m, f.swot || []), alan: d.alan || {}, gonder: !!d.gonder }; }) };
}
function detayDurum() { // yönetim paneli: masa başına gönderilen / toplam öneri
  const o = {}; for (const f of S.fikirler.filter(x => x.ad)) { const d = o[f.masa] = o[f.masa] || { toplam: 0, gonderilen: 0 }; d.toplam++; if ((S.detay[f.id] || {}).gonder) d.gonderilen++; }
  return o;
}
/* fikrin dayandığı SWOT maddeleri: temanın iki masasının kapatılmış bulguları (kod: 3AG-5 / 3AZ-12) */
function swotSecenek(m) {
  const o = {}; const t = temaTablo(m.tema);
  for (const mm of t.masalar) for (const tur of ['G', 'Z']) for (const x of (mm[tur] || [])) o[mm.id + tur + '-' + x.no] = { kod: mm.id + tur + '-' + x.no, oy: x.oy, etiket: x.etiket || '' };
  return o;
}
function swotListe(m, kodlar) { const o = m ? swotSecenek(m) : {}; return kodlar.map(k => k + (o[k] && o[k].etiket ? ' · ' + metin1(o[k].etiket, 150) : '')); }
function swotMetin(m, kodlar) { const o = swotSecenek(m); return metin1(kodlar.map(k => k + (o[k] && o[k].etiket ? ': ' + metin1(o[k].etiket, 45) : '')).join('; '), 200); }
function secimOf(masaId) { if (!S.secim[masaId]) S.secim[masaId] = yeniSecim(); return S.secim[masaId]; }
function masaFikirleri(masaId) {
  return Object.entries(S.bireyFikir).filter(([pid, f]) => f.masa === masaId && f.ad && S.katilimcilar[pid] && !S.katilimcilar[pid].kolay && S.katilimcilar[pid].masa === masaId).map(([pid, f]) => ({ id: pid, ad: f.ad, swot: f.swot || [], ts: f.ts })).sort((a, b) => a.ts - b.ts);
}
function katilimciTemizle(id) { // silinen katılımcıya bağlı fikir, oy, puan ve yazarlık kayıtları
  delete S.bireyFikir[id]; delete seen[id];
  for (const k of Object.keys(S.oylar)) if (S.oylar[k]) delete S.oylar[k][id];
  for (const f of Object.keys(S.puanlar)) if (S.puanlar[f]) delete S.puanlar[f][id];
  for (const P of Object.values(S.secimPuan)) { delete P[id]; for (const x of Object.values(P)) if (x) delete x[id]; }
  for (const d of Object.values(S.detay)) d.takim = (d.takim || []).filter(x => x !== id);
  for (const sc of Object.values(S.secim)) { sc.sira = (sc.sira || []).filter(x => x !== id); if (sc.aktif >= sc.sira.length) sc.aktif = Math.max(0, sc.sira.length - 1); }
}
const secimTimers = {};
function secimZamanla(masaId) {
  clearTimeout(secimTimers[masaId]);
  const s = S.secim[masaId]; if (!s) return;
  if (s.durum === 'sunum' && s.puanAcik && s.puanKapanis && S.ayar.otoKapat) {
    const w = Math.max(0, s.puanKapanis - Date.now());
    secimTimers[masaId] = setTimeout(() => {
      const x = S.secim[masaId];
      if (x && x.puanAcik && x.puanKapanis && Date.now() >= x.puanKapanis - 50) { x.puanAcik = false; commit(); } else secimZamanla(masaId);
    }, w + 30);
  }
}
function secimPuanKabul(s, fikirId) {
  const t = Date.now();
  if (s.durum === 'sunum') return s.sira.includes(fikirId); // sunumlar başlayınca dinledikçe herkes istediği fikri puanlar; moderatör "puanlamayı sonlandır" der
  if (s.durum === 'gozden') return s.sira.includes(fikirId) && (!s.gozdenKapanis || t <= s.gozdenKapanis + 500);
  return false;
}
/* her puanlayanın kendi ölçeği düzeltilir (z-skoru); eşitlikte önce 5 puan sayısı, sonra puanlayan sayısı */
function secimHesapla(masaId) {
  const s = secimOf(masaId), P = S.secimPuan[masaId] || {};
  const puanlayan = {};
  for (const [fid, m] of Object.entries(P)) for (const [rid, x] of Object.entries(m)) (puanlayan[rid] = puanlayan[rid] || {})[fid] = x.p;
  const zt = {}, ham = {}, n = {}, bes = {};
  for (const id of s.sira) { zt[id] = 0; ham[id] = 0; n[id] = 0; bes[id] = 0; }
  for (const r of Object.values(puanlayan)) {
    const v = Object.values(r), mu = ort(v), sdv = Math.sqrt(ort(v.map(x => (x - mu) * (x - mu))));
    for (const [id, p] of Object.entries(r)) {
      if (!(id in zt)) continue;
      zt[id] += (v.length >= 2 && sdv > 0) ? (p - mu) / sdv : 0; ham[id] += p; n[id]++; if (p === 5) bes[id]++;
    }
  }
  const liste = s.sira.map((id, i) => ({ id, no: i + 1, ad: (S.bireyFikir[id] || {}).ad || '', n: n[id], ort: n[id] ? ham[id] / n[id] : 0, z: n[id] ? zt[id] / n[id] : 0, bes: bes[id] }));
  liste.sort((a, b) => Math.round(b.ort * 10) - Math.round(a.ort * 10) || b.z - a.z || b.bes - a.bes || b.n - a.n || a.no - b.no); // sıralama ekranda görünen ortalamayla uyumlu (virgülden sonra 1 hane); eşitte z-skoru, sonra 5 sayısı
  s.sonuc = { liste, yakin: liste.length >= 3 && Math.round(liste[1].ort * 10) === Math.round(liste[2].ort * 10), ts: Date.now() };
  return s.sonuc;
}
/* masanın önerisi olacak ilk K fikrin sınırında TAM AYNI puan (z) varsa: eşit kalan fikirler arasında dar oylama */
function secimEsit(m) {
  const s = secimOf(m.id), L = s.sonuc && s.sonuc.liste, k = m.fikirSayisi; if (!L || L.length <= k) return null;
  const r1 = x => Math.round(x.ort * 10); // ekranda görünen puan (virgülden sonra ilk hane): katılımcılar aynı görüyorsa eşit sayılır (4,4 ile 4,4)
  const yakin = (x, y) => r1(x) === r1(y);
  if (!yakin(L[k - 1], L[k])) return null;
  const idx = L.map((x, i) => (yakin(x, L[k - 1]) || yakin(x, L[k])) ? i : -1).filter(i => i >= 0), bas = Math.min(...idx, k - 1), son = Math.max(...idx, k);
  const adaylar = L.slice(bas, son + 1), kesin = L.slice(0, bas);
  return { adaylar: adaylar.map(x => x.id), kesin: kesin.map(x => x.id), yer: k - kesin.length };
}
function secimDarSayim(m, d) { const say = {}; for (const [pid, ids] of Object.entries(d.oylar || {})) if (S.katilimcilar[pid] && S.katilimcilar[pid].masa === m.id) for (const id of ids) say[id] = (say[id] || 0) + 1; return d.adaylar.map(id => ({ id, oy: say[id] || 0 })).sort((a, b) => b.oy - a.oy); }
function secimIslem(m, b) {
  const s = secimOf(m.id), i = b.islem;
  if (i === 'baslat') {
    const f = masaFikirleri(m.id); if (f.length < 2) return 'En az 2 fikir girilmiş olmalı.';
    const ids = f.map(x => x.id);
    for (let k = ids.length - 1; k > 0; k--) { const j = crypto.randomInt(k + 1); [ids[k], ids[j]] = [ids[j], ids[k]]; }
    Object.assign(s, yeniSecim(), { durum: 'sunum', sira: ids }); S.secimPuan[m.id] = {}; return null;
  }
  if (i === 'yeniden') { Object.assign(s, yeniSecim()); delete S.secimPuan[m.id]; clearTimeout(secimTimers[m.id]); return null; }
  if (i === 'tablo-ac') { if (s.durum !== 'hazir') return 'Fikir girişi aşamasında değil.'; s.tablo = true; return null; }
  if (i === 'tablo-kapat') { s.tablo = false; return null; }
  if (s.durum === 'hazir') return 'Önce sunumları başlatın.';
  if (i === 'puan-ac') { if (s.durum !== 'sunum') return 'Sunum aşamasında değil.'; s.puanAcik = true; s.puanKapanis = S.ayar.secimPuanSn > 0 ? Date.now() + S.ayar.secimPuanSn * 1000 : 0; secimZamanla(m.id); return null; }
  if (i === 'puan-kapat') { s.puanAcik = false; return null; }
  if (i === 'uzat') { if (s.durum === 'sunum' && s.puanAcik) { s.puanKapanis = Math.max(Date.now(), s.puanKapanis || Date.now()) + 10000; secimZamanla(m.id); } return null; }
  if (i === 'sonraki') { if (s.durum !== 'sunum') return 'Sunum aşamasında değil.'; if (s.aktif >= s.sira.length - 1) return 'Son fikir. Gözden geçirmeyi açın.'; s.aktif++; s.puanAcik = false; s.puanKapanis = 0; return null; }
  if (i === 'onceki') { if (s.durum !== 'sunum' || s.aktif <= 0) return 'Önceki fikir yok.'; s.aktif--; s.puanAcik = false; s.puanKapanis = 0; return null; }
  if (i === 'gozden') { s.durum = 'gozden'; s.puanAcik = false; s.puanKapanis = 0; s.gozdenKapanis = S.ayar.gozdenSn > 0 ? Date.now() + S.ayar.gozdenSn * 1000 : 0; return null; }
  if (i === 'hesapla') { secimHesapla(m.id); s.durum = 'bitti'; s.puanAcik = false; s.dar = null; return null; }
  if (i === 'dar-ac') {
    if (s.durum !== 'bitti' || !s.sonuc) return 'Önce puanlamayı sonlandırın.';
    const e = secimEsit(m); if (!e) return 'Ekranda aynı görünen (eşit) puan yok; dar oylama gerekmiyor.';
    if (s.dar && s.dar.durum === 'acik') return 'Dar oylama zaten açık.';
    const n = e.adaylar.length; s.dar = { durum: 'acik', adaylar: e.adaylar, kesin: e.kesin, yer: e.yer, hak: Math.max(1, Math.min(n - 1, Math.ceil(n / 2))), oylar: {}, kuraGerek: null, secilen: null, kura: null }; return null;
  }
  if (i === 'dar-iptal') { s.dar = null; return null; }
  if (i === 'dar-kapat') {
    const d = s.dar; if (!d || d.durum !== 'acik') return 'Açık dar oylama yok.';
    d.durum = 'bitti'; const liste = secimDarSayim(m, d), esik = liste[d.yer - 1].oy, kes = liste.filter(x => x.oy > esik), ad = liste.filter(x => x.oy === esik), yer2 = d.yer - kes.length;
    if (ad.length <= yer2) d.secilen = d.kesin.concat(kes.map(x => x.id), ad.map(x => x.id)); else d.kuraGerek = { kesin: d.kesin.concat(kes.map(x => x.id)), adaylar: ad.map(x => x.id), yer: yer2 };
    return null;
  }
  if (i === 'dar-kura') {
    const d = s.dar; if (!d || d.durum !== 'bitti' || !d.kuraGerek) return 'Kura gerekmiyor.';
    const havuz = d.kuraGerek.adaylar.slice(), sec = []; for (let k = 0; k < d.kuraGerek.yer; k++) sec.push(havuz.splice(crypto.randomInt(havuz.length), 1)[0]);
    d.kura = { adaylar: d.kuraGerek.adaylar.slice(), secilenler: sec, ts: Date.now() }; d.secilen = d.kuraGerek.kesin.concat(sec); d.kuraGerek = null; return null;
  }
  if (i === 'onayla') {
    if (s.durum !== 'bitti' || !s.sonuc) return 'Önce sonucu hesaplayın.';
    if (s.dar && s.dar.durum === 'acik') return 'Dar oylama sürüyor; önce kapatın.';
    if (s.dar && s.dar.kuraGerek) return 'Dar oylamada da eşitlik var; önce kura çekin.';
    const sec = (b.secilen || []).filter(id => s.sira.includes(id)).slice(0, m.fikirSayisi); if (!sec.length) return 'En az bir fikir seçin.';
    const liste = s.sonuc.liste || [];
    if (!b.zorla && sec.some(id => { const x = liste.find(y => y.id === id); return !x || !x.n; })) return 'Seçilen fikirlerden bazıları hiç puan almadı. Yine de onaylamak için onay verin.';
    const mevcut = S.fikirler.filter(x => x.masa === m.id), eski = s.onay || [];
    if (eski.length === sec.length && sec.every(id => eski.includes(id)) && mevcut.length === sec.length) { s.onay = sec; return null; } // aynı seçim tekrarlanırsa hiçbir şey silinmez
    const korunan = new Map(); for (const id of sec) { const e = mevcut.find(x => x.kaynak === id); if (e) korunan.set(id, e); } // değişmeyen fikirler detay ve numaralarıyla kalır
    const kalan = new Set([...korunan.values()].map(e => e.id));
    for (const f of mevcut) if (!kalan.has(f.id)) { delete S.puanlar[f.id]; delete S.detay[f.id]; }
    const yeniListe = [], kullanilan = new Set(kalan);
    sec.forEach((id, k) => {
      const e = korunan.get(id); if (e) { e.sira = k + 1; yeniListe.push(e); return; }
      let n = 1; while (kullanilan.has(m.id + '-' + n)) n++; const fid = m.id + '-' + n; kullanilan.add(fid);
      const bf = S.bireyFikir[id] || {};
      yeniListe.push({ id: fid, masa: m.id, sira: k + 1, ad: bf.ad || '', no: null, swot: bf.swot || [], kaynak: id });
    });
    S.fikirler = S.fikirler.filter(f => f.masa !== m.id).concat(yeniListe);
    s.onay = sec; return null;
  }
  return 'Bilinmeyen işlem';
}
function secimDarGor(m, pid) {
  const s = secimOf(m.id), d = s.dar; if (!d) return null; const ad = id => ({ id, no: s.sira.indexOf(id) + 1, ad: (S.bireyFikir[id] || {}).ad || '' });
  const uygun = pid ? d.adaylar.filter(id => id !== pid) : d.adaylar, say = secimDarSayim(m, d);
  return { durum: d.durum, adaylar: d.adaylar.map(ad), yer: d.yer, hak: pid ? Math.min(d.hak, uygun.length) : d.hak, uygun: pid ? uygun : null, oyVeren: Object.keys(d.oylar).filter(x => S.katilimcilar[x] && S.katilimcilar[x].masa === m.id).length, atanan: atananlar(m.id).length,
    sayim: !pid || d.durum === 'bitti' ? say.map(x => Object.assign(ad(x.id), { oy: x.oy })) : null, benim: pid ? (d.oylar[pid] || null) : null,
    kuraGerek: d.kuraGerek ? { kesin: d.kuraGerek.kesin.map(ad), adaylar: d.kuraGerek.adaylar.map(ad), yer: d.kuraGerek.yer } : null, secilen: d.secilen ? d.secilen.slice() : null, kura: d.kura ? { secilenler: d.kura.secilenler.slice() } : null };
}
function secimGor(masaId, pid) {
  const s = S.secim[masaId] || yeniSecim(), P = S.secimPuan[masaId] || {}, t = Date.now();
  const fikirler = s.sira.map((id, i) => ({ id, no: i + 1, ad: (S.bireyFikir[id] || {}).ad || '', swot: (S.bireyFikir[id] || {}).swot || [], swotM: swotListe(S.masalar[masaId], (S.bireyFikir[id] || {}).swot || []), benim: id === pid }));
  const aktifId = s.durum === 'sunum' ? s.sira[s.aktif] : null;
  const benimP = {}; if (pid) for (const id of s.sira) { const x = (P[id] || {})[pid]; if (x) benimP[id] = x.p; }
  const bf = pid && S.bireyFikir[pid] && S.bireyFikir[pid].masa === masaId ? S.bireyFikir[pid].ad : null, bsw = pid && bf !== null ? (S.bireyFikir[pid].swot || []) : [];
  return { durum: s.durum, tablo: !!s.tablo, toplam: s.sira.length, fikirler, benimPuanlar: benimP, benimFikir: bf, benimSwot: bsw,
    aktif: aktifId ? { id: aktifId, no: s.aktif + 1, ad: (S.bireyFikir[aktifId] || {}).ad || '', swot: (S.bireyFikir[aktifId] || {}).swot || [], swotM: swotListe(S.masalar[masaId], (S.bireyFikir[aktifId] || {}).swot || []), benim: aktifId === pid } : null,
    puanAcik: s.durum === 'sunum' && s.puanAcik && (!s.puanKapanis || t <= s.puanKapanis + 500), puanKapanis: s.puanKapanis,
    gozdenAcik: s.durum === 'gozden' && (!s.gozdenKapanis || t <= s.gozdenKapanis + 500), gozdenKapanis: s.gozdenKapanis,
    puanVeren: aktifId ? Object.keys(P[aktifId] || {}).length : 0, puanSay: Object.fromEntries(s.sira.map(id => [id, Object.keys(P[id] || {}).length])), puanlayabilir: Math.max(0, atananlar(masaId).length - 1),
    sonuc: s.durum === 'bitti' && s.sonuc ? s.sonuc.liste.map(x => ({ id: x.id, no: x.no, ad: x.ad, ort: x.ort, z: x.z, n: x.n, benim: x.id === pid })) : null,
    yakin: s.sonuc ? s.sonuc.yakin : false, esit: s.durum === 'bitti' && S.masalar[masaId] ? (() => { const e = secimEsit(S.masalar[masaId]); return e ? { adaylar: e.adaylar, yer: e.yer } : null; })() : null, dar: S.masalar[masaId] ? secimDarGor(S.masalar[masaId], pid) : null, onay: s.onay, girilen: masaFikirleri(masaId).length };
}
function masaSecimGor(m) {
  const g = secimGor(m.id, null);
  g.kisiler = atananlar(m.id).map(k => ({ etiket: k.etiket, var: !!(S.bireyFikir[k.id] && S.bireyFikir[k.id].masa === m.id && S.bireyFikir[k.id].ad) }));
  g.ham = masaFikirleri(m.id).map(f => ({ id: f.id, ad: f.ad, swot: f.swot }));
  g.ayar = { puanSn: S.ayar.secimPuanSn, gozdenSn: S.ayar.gozdenSn };
  return g;
}
function temaTablo(temaNo) {
  const out = { tema: temaNo, ad: temaAd(temaNo), masalar: [] };
  for (const m of Object.values(S.masalar)) if (m.tema === temaNo) {
    const g = tur => { const b = m.bulgular && m.bulgular[tur]; return b ? b.map(x => ({ no: x.no, oy: x.oy, etiket: x.metin })) : null; }; // yalnızca moderatörün "Seansı kapat" ile kaydettiği son hal
    out.masalar.push({ id: m.id, G: g('G'), Z: g('Z') });
  }
  out.masalar.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}
function ekranMasaView(m) {
  return { t: Date.now(), asama: S.asama, masa: { id: m.id, ad: m.ad, tema: m.tema, temaAd: temaAd(m.tema) }, tema: temaTablo(m.tema), secim: secimGor(m.id, null), atanan: atananlar(m.id).length };
}

/* ------------------------------------------------------------------ görünümler */
function turGorunum(m, tur) {
  const t = m.tur[tur];
  const o = { durum: t.durum, alan: t.alan, postit: t.postit, oy: t.oy, maxPer: t.maxPer, ilkK: t.ilkK, ozel: !!t.ozel, seansKapali: !!t.seansKapali, bulgular: (m.bulgular && m.bulgular[tur]) || null };
  if (t.durum !== 'hazir') {
    const k = S.oylar[oyKey(m.id, tur)] || {};
    o.oyVeren = Object.keys(k).length; o.atanan = atananlar(m.id).length;
  }
  if (t.dar) { const d = t.dar; o.dar = { durum: d.durum, adaylar: d.adaylar.slice(), yer: d.yer, hak: d.hak, oyVeren: Object.keys(d.oylar).filter(id => S.katilimcilar[id]).length, atanan: atananlar(m.id).length,
    kuraGerek: d.kuraGerek ? { adaylar: d.kuraGerek.adaylar.slice(), yer: d.kuraGerek.yer, kesin: d.kuraGerek.kesin.slice() } : null, secilen: d.secilen ? d.secilen.slice() : null, kura: d.kura || null }; }
  return o;
}
function sonucGor(m, tur) {
  const t = m.tur[tur];
  if (t.durum !== 'bitti') return null;
  const r = turSonuc(m.id, tur), kayit = m.bulgular && m.bulgular[tur];
  const ilk = kayit ? kayit.map(x => ({ no: x.no, oy: x.oy, etiket: x.metin })) : r.ilk.map(x => ({ no: x.no, oy: x.oy, etiket: x.etiket })); // seans kapandıysa kaydedilen bulgular
  return { ilk, esitlik: kayit ? false : r.esitlik, K: r.K, liste: r.liste, oyVeren: r.oyVeren, atanan: r.atanan };
}
function pView(k) {
  seen[k.id] = Date.now();
  const m = S.masalar[k.masa];
  const v = { t: Date.now(), ben: { etiket: k.etiket, masa: k.masa, kod: k.kod, kolay: !!k.kolay }, asama: S.asama,
    ayar: { zorunluTam: S.ayar.zorunluTam, kendiMasaPuan: S.ayar.kendiMasaPuan }, masa: null, sunum: sunumGor(), benimPuan: null };
  if (m) {
    v.masa = { id: m.id, ad: m.ad, tema: m.tema, temaAd: temaAd(m.tema), tur: {}, sonuc: {}, benim: {} };
    for (const tur of ['G', 'Z']) {
      v.masa.tur[tur] = turGorunum(m, tur);
      v.masa.sonuc[tur] = sonucGor(m, tur);
      const e = (S.oylar[oyKey(m.id, tur)] || {})[k.id];
      v.masa.benim[tur] = e ? e.alloc : null;
      (v.masa.darBenim = v.masa.darBenim || {})[tur] = (m.tur[tur].dar && m.tur[tur].dar.oylar[k.id]) || null;
    }
  }
  const f = aktifFikir();
  if (f) { const p = (S.puanlar[f.id] || {})[k.id]; v.benimPuan = p ? { etki: p.etki, uyg: p.uyg } : null; }
  v.benimSira = S.fikirler.filter(x => x.no != null && x.ad && x.masa === k.masa).map(x => x.no).sort((a, b) => a - b); // masamın önerilerinin genel kurul sırası
  v.zaman = zamanGor(); v.mola = molaGor();
  v.secim = m ? secimGor(m.id, k.id) : null;
  v.detay = m ? detayGor(m.id, k.id) : null; v.detayAlan = DETAY_ALAN;
  v.temaTablo = m ? temaTablo(m.tema) : null;
  if (S.asama === 'sonuc') { v.matris = matris(); v.sonucSlayt = S.ayar.sonucSlayt; }
  return v;
}
function masaView(m) {
  const v = { t: Date.now(), asama: S.asama, masa: { id: m.id, ad: m.ad, tema: m.tema, temaAd: temaAd(m.tema), fikirSayisi: m.fikirSayisi, fikirKilit: m.fikirKilit },
    tur: {}, sonuc: {}, onerilen: {}, katilimci: atananlar(m.id).length,
    bagli: atananlar(m.id).filter(k => Date.now() - (seen[k.id] || 0) < 90000).length,
    fikirler: S.fikirler.filter(f => f.masa === m.id).sort((a, b) => a.sira - b.sira).map(f => ({ sira: f.sira, ad: f.ad, no: f.no })), sunum: sunumGor() };
  for (const tur of ['G', 'Z']) {
    v.tur[tur] = Object.assign({}, turGorunum(m, tur)); if (m.tur[tur].dar) v.tur[tur].dar.sayim = darSayim(m.tur[tur]); // sayım yalnızca moderatöre
    const r = turSonuc(m.id, tur);
    v.tur[tur].oyVeren = r.oyVeren; v.tur[tur].atanan = r.atanan;
    v.tur[tur].hata = turKontrol(m.tur[tur]);
    v.onerilen[tur] = { oy: oneriOy(m.tur[tur].postit), maxPer: oneriMaxPer(m.tur[tur].alan, m.tur[tur].oy || oneriOy(m.tur[tur].postit)) };
    v.sonuc[tur] = m.tur[tur].durum === 'hazir' ? null : { sirali: r.sirali, ilk: r.ilk, K: r.K, esitlik: r.esitlik, toplamOy: r.toplamOy, liste: r.liste };
  }
  v.program = (S.program.oge || []).filter(x => x.b >= 510 && x.e <= 1050).map(x => ({ ad: x.ad, b: x.b, e: x.e })); // moderatör yalnızca seans adı ve saatlerini görür (yönetici notları değil)
  v.secim = masaSecimGor(m);
  v.detay = detayGor(m.id, null); v.detayAlan = DETAY_ALAN;
  v.zaman = zamanGor(); v.mola = molaGor();
  v.temaTablo = temaTablo(m.tema); // temanın iki masasının kayıtlı SWOT bulguları (moderatör de görsün)
  v.kisiler = atananlar(m.id).map(k => ({ id: k.id, etiket: k.etiket, kolay: !!k.kolay, bagli: Date.now() - (seen[k.id] || 0) < 90000, oy: { G: oyVar(k, 'G'), Z: oyVar(k, 'Z') } })); // yalnızca oy kullanıp kullanmadığı; oyun içeriği değil
  return v;
}
function ekranView(req) {
  const masalar = Object.values(S.masalar).map(m => ({ id: m.id, ad: m.ad, tema: m.tema, temaAd: temaAd(m.tema), atanan: atananlar(m.id).length,
    bagli: atananlar(m.id).filter(k => Date.now() - (seen[k.id] || 0) < 90000).length,
    tur: { G: Object.assign(turGorunum(m, 'G'), { sonuc: sonucGor(m, 'G') && { ilk: sonucGor(m, 'G').ilk } }),
           Z: Object.assign(turGorunum(m, 'Z'), { sonuc: sonucGor(m, 'Z') && { ilk: sonucGor(m, 'Z').ilk } }) },
    fikirHazir: S.fikirler.filter(f => f.masa === m.id && f.ad).length, fikirSayisi: m.fikirSayisi,
    secim: (() => { const g = secimGor(m.id, null); const olasi = g.toplam * (g.puanlayabilir || 0), top = Object.values(g.puanSay || {}).reduce((x, y) => x + y, 0); return { durum: g.durum, girilen: g.girilen, toplam: g.toplam, puanOran: olasi ? Math.min(1, top / olasi) : 0, onay: !!g.onay }; })() }));
  const toplam = Object.keys(S.katilimcilar).length;
  const bagli = Object.values(S.katilimcilar).filter(k => Date.now() - (seen[k.id] || 0) < 90000).length;
  const v = { t: Date.now(), asama: S.asama, baseUrl: baseUrl(req), toplam, bagli, masalar, sunum: sunumGor(), sonucSlayt: S.ayar.sonucSlayt, acikKatilim: S.ayar.acikKatilim, zaman: zamanGor(), mola: molaGor() };
  if (S.asama === 'sonuc') v.matris = matris();
  return v;
}
function kayitView() { // kayıt masası görünümü: jeton (oy bağlantısı) içermez
  const masalar = Object.values(S.masalar).map(m => { const l = masaUyeleri(m.id); return { id: m.id, ad: m.ad, tema: m.tema, temaAd: temaAd(m.tema), atanan: l.length, geldi: l.filter(k => k.geldi).length }; });
  const kat = Object.values(S.katilimcilar).map(k => ({ id: k.id, kod: k.kod, etiket: k.etiket, pozisyon: k.pozisyon || '', masa: k.masa, kolay: !!k.kolay, geldi: !!k.geldi, yedek: !!k.yedek, gelmeyecek: !!k.gelmeyecek,
    cihaz: (k.cihazlar || []).length, bagli: Date.now() - (seen[k.id] || 0) < 90000 }));
  return { t: Date.now(), kapali: !!S.ayar.kayitKapali, masalar, katilimcilar: kat };
}
const oyVar = (k, tur) => !!(S.oylar[oyKey(k.masa, tur)] || {})[k.id];
function adminView(req) {
  const masalar = Object.values(S.masalar).map(m => {
    const r = { G: turSonuc(m.id, 'G'), Z: turSonuc(m.id, 'Z') };
    return { id: m.id, ad: m.ad, tema: m.tema, temaAd: temaAd(m.tema), key: m.key, fikirSayisi: m.fikirSayisi, fikirKilit: m.fikirKilit,
      atanan: atananlar(m.id).length, bagli: atananlar(m.id).filter(k => Date.now() - (seen[k.id] || 0) < 90000).length,
      tur: { G: Object.assign({}, m.tur.G, { oyVeren: r.G.oyVeren, hata: turKontrol(m.tur.G), onerilenOy: oneriOy(m.tur.G.postit) }),
             Z: Object.assign({}, m.tur.Z, { oyVeren: r.Z.oyVeren, hata: turKontrol(m.tur.Z), onerilenOy: oneriOy(m.tur.Z.postit) }) } };
  });
  const kat = Object.values(S.katilimcilar).map(k => ({ id: k.id, token: k.token, kod: k.kod, etiket: k.etiket, pozisyon: k.pozisyon || '', masa: k.masa, kolay: !!k.kolay, geldi: !!k.geldi, yedek: !!k.yedek, gelmeyecek: !!k.gelmeyecek, oy: { G: oyVar(k, 'G'), Z: oyVar(k, 'Z') },
    bagli: Date.now() - (seen[k.id] || 0) < 90000, cihaz: (k.cihazlar || []).length }));
  return { t: Date.now(), sablon: S.sablon, asama: S.asama, ayar: S.ayar, baseUrl: baseUrl(req), ips: lanIps(), port: PORT, temalar: TEMALAR,
    zaman: zamanGor(), mola: molaGor(), program: S.program,
    detayDurum: detayDurum(), hazirlik: S.hazirlik || {}, pinVarsayilan: ['kok2026', '1234'].includes(ADMIN_PIN), kayitPinVarsayilan: KAYIT_PIN === 'kayit2026',
    secimler: Object.fromEntries(Object.values(S.masalar).map(m => [m.id, { durum: (S.secim[m.id] || {}).durum || 'hazir', fikir: masaFikirleri(m.id).length, onay: !!(S.secim[m.id] || {}).onay }])), demoHiz: !!S.demoHiz,
    masalar, katilimcilar: kat, fikirler: S.fikirler, sunum: sunumGor(), matris: matris(),
    puanSayilari: Object.fromEntries(S.fikirler.map(f => [f.id, Object.keys(S.puanlar[f.id] || {}).length])) };
}

/* -------------------------------------------------------------- CSV dışa aktarım */
function csv(rows) { return '﻿' + rows.map(r => r.map(c => { let s = String(c == null ? '' : c); if (typeof c === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; /* tablo programında formül gibi çalışmasın */ return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n'); }
function csvBulgular() { // her masanın kaydedilen (ya da henüz kapanmadıysa geçici) ilk bulguları
  const rows = [['masa', 'tema', 'tur', 'sira', 'post_it_no', 'oy', 'icerik', 'seans']];
  for (const m of Object.values(S.masalar)) for (const tur of ['G', 'Z']) {
    const b = m.bulgular && m.bulgular[tur]; let l = b;
    if (!l) { const r = m.tur[tur].durum === 'bitti' ? turSonuc(m.id, tur) : null; l = r ? r.ilk.map(x => ({ no: x.no, oy: x.oy, metin: x.etiket })) : []; }
    l.forEach((x, i) => rows.push([m.id, temaAd(m.tema), tur === 'G' ? 'güçlü' : 'zayıf', i + 1, x.no, x.oy, x.metin || '', b ? 'kapandı' : 'kapanmadı']));
  }
  return csv(rows);
}
function csvOylar() {
  const rows = [['masa', 'tema', 'tur', 'alan_no', 'oy', 'etiket']];
  for (const m of Object.values(S.masalar)) for (const tur of ['G', 'Z']) {
    const r = turSonuc(m.id, tur); if (m.tur[tur].durum === 'hazir') continue;
    for (const x of r.liste) rows.push([m.id, m.tema, tur === 'G' ? 'Güçlü' : 'Zayıf', x.no, x.oy, x.etiket]);
  }
  return csv(rows);
}
function csvPuanlar() {
  const rows = [['fikir_no', 'fikir_adi', 'fikir_masasi', 'puan_veren_masa', 'etki', 'uygulanabilirlik', 'zaman']];
  for (const f of S.fikirler) for (const [pid, p] of Object.entries(S.puanlar[f.id] || {})) {
    const k = S.katilimcilar[pid];
    rows.push([f.no == null ? '' : f.no, f.ad, f.masa, k ? k.masa : '', p.etki, p.uyg, new Date(p.ts).toISOString()]);
  }
  return csv(rows);
}
function csvKatilimcilar() { // yalnızca yönetim: ID, ad soyad, pozisyon, masa, tema
  const rows = [['id', 'ad_soyad', 'pozisyon', 'masa', 'tema']];
  for (const k of Object.values(S.katilimcilar)) { const m = S.masalar[k.masa]; rows.push([k.kod, k.etiket, k.pozisyon || '', k.masa, m ? temaAd(m.tema) : '']); }
  return csv(rows);
}
function csvMatris() {
  const mt = matris();
  const ad = { hizli: 'Hızlı kazanım', stratejik: 'Stratejik dönüşüm', sinirli: 'Sınırlı iyileştirme', beklet: 'Bekle / yeniden tasarla' };
  const rows = [['no', 'fikir', 'masa', 'tema', 'etki_ort', 'uygulanabilirlik_ort', 'puan_sayisi', 'gorus_ayriligi', 'ceyrek']];
  for (const o of mt.oge) rows.push([o.no, o.ad, o.masa, o.tema, o.etki.toFixed(2), o.uyg.toFixed(2), o.n, o.ayrilik ? 'evet' : '', ad[o.ceyrek]]);
  return csv(rows);
}

/* ------------------------------------------------------------------ eylemler */
function rastgeleOy(m, tur, oran) { // deneme: masadaki herkes için ağırlıklı rastgele oy dağılımı
  const t = m.tur[tur], key = oyKey(m.id, tur); S.oylar[key] = S.oylar[key] || {};
  const w = []; for (let i = 0; i < t.alan; i++) w.push(Math.pow(Math.random(), 2.4) + 0.02);
  for (const k of atananlar(m.id)) {
    if (S.oylar[key][k.id]) continue; if (oran && Math.random() > oran) continue;
    const alloc = {}; let kalan = t.oy, guv = 0;
    while (kalan > 0 && guv++ < 2000) {
      let r = Math.random() * w.reduce((x, y) => x + y, 0), n = 0; for (; n < w.length - 1; n++) { r -= w[n]; if (r <= 0) break; }
      const no = n + 1; if ((alloc[no] || 0) < t.maxPer) { alloc[no] = (alloc[no] || 0) + 1; kalan--; }
    }
    S.oylar[key][k.id] = { alloc, ts: Date.now() };
  }
}
function demoFikir(m, adim) { // moderatör eğitimi: fikir aşamasını istenen adıma getir ("Fikir 1A-1" ...)
  const id = m.id;
  for (let i = atananlar(id).length + 1; i <= 8; i++) katilimciEkle(id, 'Deneme ' + id + '-' + i);
  const kisiler = atananlar(id);
  secimIslem(m, { islem: 'yeniden' });
  for (const k of kisiler) delete S.bireyFikir[k.id];
  for (const f of S.fikirler.filter(x => x.masa === id)) { delete S.puanlar[f.id]; delete S.detay[f.id]; }
  S.fikirler = S.fikirler.filter(f => f.masa !== id); m.fikirKilit = false;
  if (adim === 'giris') return null;
  const sec = Object.keys(swotSecenek(m));
  kisiler.forEach((k, i) => { S.bireyFikir[k.id] = { masa: id, ad: 'Fikir ' + id + '-' + (i + 1), swot: sec.length ? [sec[i % sec.length], sec[(i * 3 + 1) % sec.length]].filter((x, j, l) => l.indexOf(x) === j) : [], ts: Date.now() + i }; }); // masadaki herkes için bir fikir (ilişkili SWOT maddeleriyle)
  if (adim === 'hazir') return null;
  const h = secimIslem(m, { islem: 'baslat' }); if (h) return h;
  const s = secimOf(id), P = S.secimPuan[id] = S.secimPuan[id] || {};
  const puanla = fid => { let x = 0; for (const c of fid) x = (x * 31 + c.charCodeAt(0)) % 1000; const me = 2.2 + (x % 30) / 12; P[fid] = {};
    for (const k of kisiler) if (k.id !== fid) P[fid][k.id] = { p: Math.max(1, Math.min(5, Math.round(me + (Math.random() + Math.random() - 1) * 1.6))), ts: Date.now() }; };
  if (adim === 'sunum') { s.aktif = Math.min(2, s.sira.length - 1); for (let i = 0; i < s.aktif; i++) puanla(s.sira[i]); return null; }
  s.sira.forEach(puanla);
  secimIslem(m, { islem: 'hesapla' }); if (adim === 'sonuc') return null;
  const e = secimIslem(m, { islem: 'onayla', secilen: secimOf(id).sonuc.liste.slice(0, m.fikirSayisi).map(x => x.id) }); if (e || adim === 'onay') return e;
  const fl = masaFikirListe(id), yar = Math.ceil(kisiler.length / 2);
  fl.forEach((f, i) => { const d = detayOf(f.id); d.takim = [kisiler[(i * 2 + 1) % kisiler.length].id];
    if (adim === 'detay' && i > 0) return; // yalnızca ilk takım taslak yazmış olsun
    d.alan = { uygulama: f.ad + ' için demo uygulama: haftalık kısa toplantılarla başlanır.', kapsam: 'Demo: iki bölge, pilot ekipler.', katki: 'Demo: öğrenme paylaşımı artar, tekrar eden hatalar azalır.', ilkadim: 'Demo: 4 haftalık pilot; sorumlu bölge koordinatörü.', basari: 'Demo: üç ayda katılım %70, tekrar eden hata sayısı düşer.' };
    d.gonder = adim === 'gonderildi'; d.ts = Date.now(); });
  return null;
}
function demoBulgu(m, tur, tam) { // post-it sayısı, oylar ve (tam ise) içerikler: "1A masası - Güçlü Yön - Post-It #1"
  const t = m.tur[tur]; delete S.oylar[oyKey(m.id, tur)]; if (m.bulgular) m.bulgular[tur] = null; m.etiket[tur] = {};
  t.postit = 30 + crypto.randomInt(21); t.alan = t.postit; t.oy = oneriOy(t.postit); t.maxPer = oneriMaxPer(t.postit, t.oy); t.ozel = false; t.seansKapali = false;
  rastgeleOy(m, tur, 0); t.durum = 'bitti';
  if (!tam) return;
  const { kesin, adaylar, yer } = ilkAdaylar(turSonuc(m.id, tur)), son = kesin.concat(adaylar.slice(0, yer)), ad = tur === 'G' ? 'Güçlü Yön' : 'Zayıf Yön';
  m.bulgular = m.bulgular || { G: null, Z: null };
  for (const x of son) m.etiket[tur][x.no] = m.id + ' masası - ' + ad + ' - Post-It #' + x.no;
  m.bulgular[tur] = son.map(x => ({ no: x.no, oy: x.oy, metin: m.etiket[tur][x.no] })); t.seansKapali = true;
}

/* ---------------- yönetici demo akışı: yardımcılar ---------------- */
const DEMO_HIZ = { sunumSn: 12, puanSn: 10, secimPuanSn: 10, gozdenSn: 30 };
function demoHiz(ac) { // genel kurulu kısa sürelerle denemek için; kapatılınca asıl süreler geri gelir
  if (ac) { if (!S.demoHiz) S.demoHiz = { sunumSn: S.ayar.sunumSn, puanSn: S.ayar.puanSn, secimPuanSn: S.ayar.secimPuanSn, gozdenSn: S.ayar.gozdenSn }; Object.assign(S.ayar, DEMO_HIZ); }
  else if (S.demoHiz) { Object.assign(S.ayar, S.demoHiz); S.demoHiz = null; }
}
function icerikSifirla() { // oylar, fikirler, puanlar, sunum, süreç durumu silinir; katılımcılar, masa bağlantıları, ayarlar, program ve hazırlık listesi kalır
  try { fs.writeFileSync(FILE + '.yedek-' + Date.now(), JSON.stringify(S)); } catch (e) { /* yedek alınamadıysa da devam */ }
  const eski = S, yeni = bosDurum(eski.sablon);
  yeni.ayar = eski.ayar; yeni.program = eski.program; yeni.hazirlik = eski.hazirlik || {}; yeni.katilimcilar = eski.katilimcilar; yeni.demoHiz = eski.demoHiz || null;
  yeni.masalar = {}; for (const m of Object.values(eski.masalar)) { const n = yeniMasa(m.id, m.tema, m.ad); n.key = m.key; n.fikirSayisi = m.fikirSayisi; yeni.masalar[m.id] = n; }
  for (const k of Object.values(yeni.katilimcilar)) k.cihazlar = [];
  yeni.ayar.sonucSlayt = 0; S = yeni;
  for (const id of Object.keys(secimTimers)) clearTimeout(secimTimers[id]);
}
function swotBitir(m, tur) { // moderatör yapmadıysa: oylamayı aç/oyları tamamla/kapat/ilk 5'in içeriğini yaz/seansı kapat
  const t = m.tur[tur]; if (t.seansKapali) return;
  if (t.durum === 'hazir') { t.postit = 24 + crypto.randomInt(10); t.alan = t.postit; t.oy = oneriOy(t.postit); t.maxPer = oneriMaxPer(t.alan, t.oy); t.ozel = false; t.durum = 'acik'; }
  if (t.durum === 'acik') { rastgeleOy(m, tur, 0); t.durum = 'bitti'; }
  t.dar = null;
  const { kesin, adaylar, yer } = ilkAdaylar(turSonuc(m.id, tur)), son = kesin.concat(adaylar.slice(0, yer)), ad = tur === 'G' ? 'Güçlü Yön' : 'Zayıf Yön';
  m.bulgular = m.bulgular || { G: null, Z: null }; m.etiket[tur] = m.etiket[tur] || {};
  for (const x of son) if (!m.etiket[tur][x.no]) m.etiket[tur][x.no] = m.id + ' masası - ' + ad + ' - Post-It #' + x.no;
  m.bulgular[tur] = son.map(x => ({ no: x.no, oy: x.oy, metin: m.etiket[tur][x.no] })); t.seansKapali = true;
}
function secimTamamla(m) { // moderatör yapmadıysa: eksik fikirleri yaz, puanla, sırala, ilk 2'yi kaydet
  const id = m.id, s = secimOf(id); if (s.onay) return null;
  const kisiler = atananlar(id), sec = Object.keys(swotSecenek(m));
  kisiler.forEach((k, i) => { if (!(S.bireyFikir[k.id] && S.bireyFikir[k.id].ad)) S.bireyFikir[k.id] = { masa: id, ad: ORNEK_FIKIRLER[(i * 7 + m.id.length) % ORNEK_FIKIRLER.length], swot: sec.length ? [sec[i % sec.length]] : [], ts: Date.now() + i }; });
  if (s.durum === 'hazir') { const h = secimIslem(m, { islem: 'baslat' }); if (h) return h; }
  const P = S.secimPuan[id] = S.secimPuan[id] || {};
  for (const fid of s.sira) { let h = 0; for (const ch of fid) h = (h * 31 + ch.charCodeAt(0)) % 1000; const me = 2.2 + (h % 30) / 12; P[fid] = P[fid] || {};
    for (const k of kisiler) if (k.id !== fid && !P[fid][k.id]) P[fid][k.id] = { p: Math.max(1, Math.min(5, Math.round(me + (Math.random() + Math.random() - 1) * 1.6))), ts: Date.now() }; }
  if (s.durum !== 'bitti') secimIslem(m, { islem: 'hesapla' });
  return secimIslem(m, { islem: 'onayla', secilen: secimOf(id).sonuc.liste.slice(0, m.fikirSayisi).map(x => x.id) });
}
function detayDoldur(m) { // gönderilmemiş önerilerin detayını örnek metinle tamamlayıp gönderir (yazılmış alanlar korunur)
  for (const f of masaFikirListe(m.id)) {
    const d = detayOf(f.id); if (d.gonder) continue;
    if (!(d.takim || []).length) { const k = atananlar(m.id)[0]; if (k) d.takim = [k.id]; }
    const ornek = { uygulama: f.ad + ' için demo uygulama: haftalık kısa toplantılarla başlanır.', kapsam: 'Demo: iki bölge, pilot ekipler.', katki: 'Demo: öğrenme paylaşımı artar, tekrar eden hatalar azalır.', ilkadim: 'Demo: 4 haftalık pilot; sorumlu bölge koordinatörü.', basari: 'Demo: üç ayda katılım %70, tekrar eden hata sayısı düşer.' };
    d.alan = d.alan || {}; for (const [k, v] of Object.entries(ornek)) if (!(d.alan[k] || '').trim()) d.alan[k] = v;
    d.gonder = true; d.ts = Date.now();
  }
}

/* ---- demo: eşitlik ve dar oylama üretimi ---- */
function darOylar(kisiler, adaylar, hak, kendi, esit) { // her kişi için dar oylama seçimi; esit: aday sayıları eşitlenir (kura denemek için)
  const sonuc = {}, say = Object.fromEntries(adaylar.map(a => [a, 0]));
  for (const k of kisiler) { const uygun = adaylar.filter(a => a !== kendi(k)), h = Math.min(hak, uygun.length); const sec = uygun.slice().sort(() => Math.random() - 0.5).slice(0, h); sonuc[k.id] = sec; sec.forEach(a => say[a]++); }
  if (esit) { const min = Math.min(...Object.values(say)); for (const a of adaylar) { let g = 0; while (say[a] > min && g++ < 500) { const k = kisiler.find(x => sonuc[x.id].includes(a)); if (!k) break; sonuc[k.id] = sonuc[k.id].filter(y => y !== a); say[a]--; } } }
  return sonuc;
}
function darOyUret(esit) { // açık dar oylamalarda (SWOT ve fikir) katılımcı oylarını üretir
  for (const m of Object.values(S.masalar)) {
    const kisiler = atananlar(m.id);
    for (const tur of ['G', 'Z']) { const d = m.tur[tur].dar; if (!d || d.durum !== 'acik') continue;
      const o = darOylar(kisiler, d.adaylar, d.hak, () => null, esit); for (const k of kisiler) if (esit || !d.oylar[k.id]) d.oylar[k.id] = o[k.id]; }
    const sd = secimOf(m.id).dar; if (sd && sd.durum === 'acik') {
      const o = darOylar(kisiler, sd.adaylar, sd.hak, k => k.id, esit); for (const k of kisiler) if (esit || !sd.oylar[k.id]) sd.oylar[k.id] = o[k.id]; }
  }
}
function esitSwot(m, tur) { // oylar, ilk K'nın sınırında eşit çıkacak biçimde ayarlanır
  const t = m.tur[tur], kayit = S.oylar[oyKey(m.id, tur)] || {}; if (t.dar || t.seansKapali) return;
  const r = turSonuc(m.id, tur), K = Math.min(t.ilkK || 5, r.sirali.length); if (r.sirali.length <= K) return;
  const A = r.sirali[K - 1].no, B = r.sirali[K].no; let ca = r.sirali[K - 1].oy, cb = r.sirali[K].oy;
  for (let tur2 = 0; tur2 < 6 && ca > cb; tur2++) for (const e of Object.values(kayit)) {
    if (ca <= cb) break; if (!(e.alloc[A] > 0)) continue;
    e.alloc[A]--; ca--; if (!e.alloc[A]) delete e.alloc[A];
    if (ca > cb && (e.alloc[B] || 0) < t.maxPer) { e.alloc[B] = (e.alloc[B] || 0) + 1; cb++; }
  }
}
function esitFikir(m) { // masa içi puanlar: sıralamanın K. ve K+1. fikri tam aynı puanı alacak şekilde ayarlanır (K sınırında kalması için gerekirse düzeltilir)
  const s = secimOf(m.id); if (s.onay || !s.sira.length || s.durum === 'hazir') return;
  const liste0 = secimHesapla(m.id).liste, K = m.fikirSayisi; if (liste0.length <= K) return;
  const a = liste0[K - 1].id, b = liste0[K].id, P = S.secimPuan[m.id] = S.secimPuan[m.id] || {}; P[a] = P[a] || {}; P[b] = P[b] || {};
  delete P[a][b]; delete P[b][a];
  const raters = atananlar(m.id).filter(k => k.id !== a && k.id !== b);
  for (const k of raters) { const p = (P[a][k.id] || P[b][k.id] || { p: 1 + crypto.randomInt(5) }).p; P[a][k.id] = { p, ts: Date.now() }; P[b][k.id] = { p, ts: Date.now() }; }
  for (let i = 0; i < 40; i++) { // çift, listede tam K. ve K+1. sırada kalsın
    const l = secimHesapla(m.id).liste, ia = l.findIndex(x => x.id === a), ib = l.findIndex(x => x.id === b), lo = Math.min(ia, ib);
    if (lo === K - 1) break; const k = raters[crypto.randomInt(raters.length)]; if (!k) break; const d = lo < K - 1 ? -1 : 1;
    const p = Math.max(1, Math.min(5, P[a][k.id].p + d)); P[a][k.id].p = p; P[b][k.id].p = p;
  }
  if (s.durum === 'bitti') { s.dar = null; secimHesapla(m.id); }
}

function turAyarla(m, tur, b, yon) { // hata metni döndürür (null = tamam)
  const t = m.tur[tur], eski = t.postit;
  const oyVar = Object.keys(S.oylar[oyKey(m.id, tur)] || {}).length > 0;
  if (oyVar && ((b.postit != null && clampInt(b.postit, 0, 200, t.postit) !== t.postit) || (yon && ((b.oy != null && clampInt(b.oy, 0, 200, t.oy) !== t.oy) || (b.maxPer != null && clampInt(b.maxPer, 1, 50, t.maxPer) !== t.maxPer))))) return 'Bu turda oy kullanıldı; post-it sayısı ve oy kuralları değiştirilemez. Önce oyları sıfırlayın (yönetim).';
  if (b.postit != null) t.postit = clampInt(b.postit, 0, 200, t.postit);
  t.alan = t.postit; // flipchart'taki her post-it oylanabilir bir seçenektir
  if (!yon) { // moderatör yalnızca post-it sayısını girer; oy hakkı ve en fazla oy otomatik üretilir (yönetimin özel ayarı, post-it değişmedikçe korunur)
    if (!(t.ozel && t.postit === eski)) { t.oy = oneriOy(t.postit); t.maxPer = oneriMaxPer(t.postit, t.oy); t.ozel = false; }
    return null;
  }
  if (b.oy != null) t.oy = clampInt(b.oy, 0, 200, t.oy);
  if (b.maxPer != null) t.maxPer = clampInt(b.maxPer, 1, 50, t.maxPer);
  if (b.ilkK != null) t.ilkK = clampInt(b.ilkK, 1, 20, t.ilkK);
  t.ozel = t.postit > 0 && (t.oy !== oneriOy(t.postit) || t.maxPer !== oneriMaxPer(t.postit, t.oy));
  return null;
}
function darSayim(t) { const d = t.dar, say = {}; for (const [pid, nos] of Object.entries(d.oylar)) if (S.katilimcilar[pid]) for (const n of nos) say[n] = (say[n] || 0) + 1; return d.adaylar.map(n => ({ no: n, oy: say[n] || 0 })).sort((a, b) => b.oy - a.oy || a.no - b.no); }
function turIslem(m, tur, b, yonetici) {
  const t = m.tur[tur];
  const islem = b.islem;
  if (islem === 'ayarla') return turAyarla(m, tur, b, yonetici);
  if (islem === 'dar-ac') { // eşitlikte: eşit oy alan post-it'ler arasında, sayılarının yarısı kadar oy hakkıyla dar oylama
    if (t.durum !== 'bitti' || t.seansKapali) return 'Dar oylama, oylama kapandıktan sonra ve seans kapanmadan açılır.';
    const { adaylar, yer } = ilkAdaylar(turSonuc(m.id, tur)); if (!(adaylar.length > yer)) return 'Eşitlik yok; dar oylama gerekmiyor.';
    if (t.dar && t.dar.durum === 'acik') return 'Dar oylama zaten açık.';
    t.dar = { durum: 'acik', adaylar: adaylar.map(x => x.no), yer, hak: Math.max(1, Math.min(adaylar.length - 1, Math.ceil(adaylar.length / 2))), oylar: {}, kuraGerek: null, secilen: null, kura: null }; return null;
  }
  if (islem === 'dar-iptal') { t.dar = null; return null; }
  if (islem === 'dar-kapat') {
    const d = t.dar; if (!d || d.durum !== 'acik') return 'Açık dar oylama yok.';
    d.durum = 'bitti'; const liste = darSayim(t), esik = liste[d.yer - 1].oy, kesin = liste.filter(x => x.oy > esik), adaylar = liste.filter(x => x.oy === esik), yer2 = d.yer - kesin.length;
    if (adaylar.length <= yer2) d.secilen = kesin.concat(adaylar).map(x => x.no); else d.kuraGerek = { kesin: kesin.map(x => x.no), adaylar: adaylar.map(x => x.no), yer: yer2 };
    return null;
  }
  if (islem === 'dar-kura') { // dar oylamada da eşitlik sürerse: tarafsız kura (kayıtlı)
    const d = t.dar; if (!d || d.durum !== 'bitti' || !d.kuraGerek) return 'Kura gerekmiyor.';
    const havuz = d.kuraGerek.adaylar.slice(), secilenler = []; for (let i = 0; i < d.kuraGerek.yer; i++) secilenler.push(havuz.splice(crypto.randomInt(havuz.length), 1)[0]);
    d.kura = { adaylar: d.kuraGerek.adaylar.slice(), secilenler, ts: Date.now() }; d.secilen = d.kuraGerek.kesin.concat(secilenler); d.kuraGerek = null; return null;
  }
  if (islem === 'seans-kapat') { // oylama kapandıktan sonra ilk K post-it'in içeriği girilir ve masanın bulguları kaydedilir
    if (t.durum !== 'bitti') return 'Önce oylamayı kapatın.';
    if (t.dar && t.dar.durum === 'acik') return 'Dar oylama sürüyor; önce kapatın.';
    if (t.dar && t.dar.kuraGerek) return 'Dar oylamada da eşitlik var; önce kura çekin.';
    const r = turSonuc(m.id, tur), { kesin, adaylar, yer } = ilkAdaylar(r);
    if (!kesin.length && !adaylar.length) return 'Hiç oy kullanılmadı; seans kapatılamaz.';
    const secim = new Set((Array.isArray(b.secim) ? b.secim : []).map(x => parseInt(x, 10)));
    const darSec = t.dar && t.dar.secilen; const secilen = adaylar.length <= yer ? adaylar : darSec ? adaylar.filter(x => darSec.includes(x.no)) : adaylar.filter(x => secim.has(x.no));
    if (secilen.length !== yer) return 'Eşitlik var: ' + adaylar[0].oy + ' oylu ' + adaylar.length + ' post-it\'ten ' + yer + ' tanesini seçin.';
    const son = kesin.concat(secilen), girilen = b.metinler || {}, mt = {};
    for (const x of son) { const s = metin(girilen[x.no] != null ? girilen[x.no] : (m.etiket[tur][x.no] || ''), 150); if (!s) return x.no + ' numaralı post-it\'in içeriğini yazın.'; mt[x.no] = s; }
    m.bulgular = m.bulgular || { G: null, Z: null };
    for (const x of son) m.etiket[tur][x.no] = mt[x.no];
    m.bulgular[tur] = son.map(x => ({ no: x.no, oy: x.oy, metin: mt[x.no] }));
    t.seansKapali = true; return null;
  }
  if (islem === 'seans-ac') { if (m.bulgular) m.bulgular[tur] = null; t.seansKapali = false; return null; }
  if (islem === 'ac' || islem === 'yeniden-ac') {
    const yedekT = Object.assign({}, t), yedekB = m.bulgular ? m.bulgular[tur] : undefined; // hata olursa önceki duruma dönülür
    t.dar = null; // yeni oylama: eski dar oylama geçersiz
    const hata = (msg) => { Object.assign(t, yedekT); if (m.bulgular) m.bulgular[tur] = yedekB; return msg; };
    if (t.seansKapali) { if (!yonetici) return 'Seans kapandı; önce "Seansı yeniden aç" deyin.'; if (m.bulgular) m.bulgular[tur] = null; t.seansKapali = false; } // yönetim doğrudan yeniden açabilir; kaydedilen bulgular geçersiz olur
    const ah = turAyarla(m, tur, b, yonetici); if (ah) return hata(ah);
    if (tur === 'Z' && m.tur.G.durum === 'acik') return hata('Önce güçlü yönler oylamasını kapatın.');
    if (tur === 'Z' && m.tur.G.durum === 'hazir' && !yonetici && !b.zorla) return hata('Önce güçlü yönler oylanıp kapatılmalı.');
    if (tur === 'G' && m.tur.Z.durum === 'acik') return hata('Zayıf yönler oylaması açık.');
    const h = turKontrol(t); if (h) return hata(h);
    t.durum = 'acik'; return null;
  }
  if (islem === 'kapat') { if (t.durum === 'acik') t.durum = 'bitti'; return null; }
  if (islem === 'sifirla') { delete S.oylar[oyKey(m.id, tur)]; Object.assign(t, { durum: 'hazir', postit: 0, alan: 0, oy: 0, maxPer: 2, ozel: false, seansKapali: false, dar: null }); if (m.bulgular) m.bulgular[tur] = null; return null; } // oylama ve post-it sayısı baştan girilir
  return 'Bilinmeyen işlem';
}
const ORNEK_FIKIRLER = [
  'Haftalık 15 dakikalık ayakta değerlendirme toplantısı', 'Birimler arası bilgi paylaşım saati', 'Aylık "ne öğrendik" bülteni',
  'Şube ve bölge eşleşmeli akran öğrenme çiftleri', 'Proje sonrası ders çıkarma oturumu', 'Ortak çözüm havuzu: sık sorulanlar',
  'Yeni ürün çıkışında 20 dakikalık video eğitim', 'Mentorluk eşleşme programı', 'Çapraz birim iş gözlemleme günü',
  'Hata paylaşımı için güvenli forum', 'Kısa öğrenme videoları kütüphanesi', 'Birimlerde öğrenme elçisi rolü',
  'Karar gerekçesi kayıt formu', 'Ortak hedef atölyesi: çeyreklik', 'Müşteri geri bildirimini birime taşıyan aylık özet',
  'Ayrılan çalışan için bilgi devir şablonu', 'Yönetici koçluk görüşmesi: 20 dakika', 'İç eğitmen havuzu',
  'Saha sorunlarını toplayan hızlı kanal', 'Pilot şubelerde karar yetkisi genişletme', 'Soru sorma cesaret oturumu',
  'Başarı hikâyesi paylaşımı: 5 dakikalık anlatı', 'Dönüşümlü birim ziyaretleri', 'Toplantı sonu "tek öğrenme" notu',
  'Dijital bilgi haritası: kim neyi biliyor', 'Yeni gelenler için öğrenme yol arkadaşı', 'Ekip hedeflerini birlikte yazma',
  'Dış gelişmeleri izleyen aylık radar notu', 'Öğrenme saatinin takvimde korunması', 'Bölge içi vaka paylaşımı'
];

/* ---------------------------------------------------------------- yönlendirme */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
// ana adres (/) yalnızca katılım ekranıdır; tüm menü /menu adresindedir
const SAYFALAR = [[/^\/$/, 'katil.html'], [/^\/menu\/?$/, 'index.html'], [/^\/katil\/?$/, 'katil.html'], [/^\/p\/[a-z0-9]+\/?$/, 'p.html'], [/^\/masa\/[A-Za-z0-9]+\/?$/, 'masa.html'],
  [/^\/yonetim\/?$/, 'yonetim.html'], [/^\/ekran\/?$/, 'ekran.html'], [/^\/kayit\/?$/, 'kayit.html'], [/^\/izle\/?$/, 'izle.html']];
function dosya(res, rel) {
  const p = path.normalize(path.join(PUB, rel));
  if (!p.startsWith(PUB)) return hata(res, 403, 'yasak');
  fs.readFile(p, (e, d) => {
    if (e) return hata(res, 404, 'bulunamadı');
    if (path.extname(p) === '.html') d = Buffer.from(d.toString('utf8').replace(/(\/static\/[\w\/.\-]+\.(?:js|css))/g, '$1?v=' + SURUM)); // Cloudflare/tarayıcı önbelleği eski js/css sunmasın: her sürümde adres değişir
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(d);
  });
}
function yonetici(req) { return req.headers['x-pin'] === ADMIN_PIN; }
function masaYetki(req, m, url) {
  if (yonetici(req)) return true;
  const k = url.searchParams.get('k'); if (k && k === m.key) return true;
  const t = url.searchParams.get('t'); // moderatör olarak işaretli katılımcı, kendi masasının panelini kendi bağlantısıyla açar
  if (t) { const p = katilimciBul(t); if (p && p.kolay && p.masa === m.id) return true; }
  return false;
}

async function api(req, res, url) {
  const p = url.pathname, M = req.method;
  let mm;
  if (p === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write('retry: 2000\n\nevent: s\ndata: ' + SURUM + '\n\nevent: v\ndata: ' + S.v + '\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (p === '/api/saat') return json(res, { t: Date.now() });
  /* ---- katılımcı ---- */
  if ((mm = p.match(/^\/api\/kod\/([A-Za-z0-9]{3,12})$/)) && M === 'GET') {
    const ip = istemciIp(req);
    if (!denemeSiniri(ip, true)) return hata(res, 429, 'Çok fazla hatalı deneme. Birkaç dakika sonra tekrar deneyin.');
    const k = kodBul(mm[1]);
    if (!k) { denemeSiniri(ip, false); return hata(res, 404, 'Bu ID ile katılımcı bulunamadı. Kartınızdaki ID\'yi kontrol edin.'); }
    const ch = cihazKontrol(k, req); if (ch) return hata(res, 403, ch);
    const m = S.masalar[k.masa];
    return json(res, { token: k.token, kolay: !!k.kolay, etiket: k.etiket, pozisyon: k.pozisyon || '', masa: k.masa, masaAd: m ? m.ad : '', tema: m ? m.tema : 0, temaAd: m ? temaAd(m.tema) : '' });
  }
  if (p === '/api/masalar-liste' && M === 'GET') return json(res, { acik: S.ayar.acikKatilim, masalar: Object.values(S.masalar).map(m => ({ id: m.id, ad: m.ad, tema: temaAd(m.tema) })) });
  if (p === '/api/katil' && M === 'POST') {
    if (!S.ayar.acikKatilim) return hata(res, 403, 'Açık katılım kapalı. Lütfen yaka kartınızdaki QR kodu kullanın.');
    const b = await body(req); const m = S.masalar[b.masa]; if (!m) return hata(res, 400, 'Masa seçin.');
    const k = katilimciEkle(m.id, 'Kayıtsız'); commit(); return json(res, { token: k.token });
  }
  if ((mm = p.match(/^\/api\/tema\/([1-7])$/)) && M === 'GET') return json(res, temaTablo(parseInt(mm[1], 10)));
  if ((mm = p.match(/^\/api\/ekran\/masa\/([A-Za-z0-9]+)$/)) && M === 'GET') { const m0 = S.masalar[mm[1]]; return m0 ? json(res, ekranMasaView(m0)) : hata(res, 404, 'Masa yok.'); }
  if ((mm = p.match(/^\/api\/p\/([a-z0-9]+)\/(view|oy|dar-oy|puan|fikir|secim-puan|detay)$/))) {
    const k = katilimciBul(mm[1]); if (!k) return hata(res, 404, 'Geçersiz bağlantı.');
    { const ch = cihazKontrol(k, req); if (ch) return hata(res, 403, ch); }
    if (mm[2] === 'view' && M === 'GET') return json(res, pView(k));
    if (k.kolay && M === 'POST') return hata(res, 403, 'Moderatörler oy, puan ve fikir sürecine katılmaz; bu işlemi katılımcılar yapar.');
    if (mm[2] === 'fikir' && M === 'POST') {
      const m = S.masalar[k.masa]; if (!m) return hata(res, 400, 'Henüz bir masaya atanmadınız.');
      if (secimOf(m.id).durum !== 'hazir') return hata(res, 409, 'Fikir girişi kapandı. Sunumlar başladı.');
      const b = await body(req); const ad = metin(b.ad, 110), onceki = S.bireyFikir[k.id], secenek = swotSecenek(m);
      let swot = onceki && onceki.masa === m.id ? (onceki.swot || []) : [];
      if (Array.isArray(b.swot)) swot = [...new Set(b.swot.map(x => String(x)))].filter(x => Object.prototype.hasOwnProperty.call(secenek, x)).slice(0, 3);
      if (ad && !swot.length && Object.keys(secenek).length) return hata(res, 400, 'Fikrinizin dayandığı en az bir SWOT maddesini seçin.');
      if (!ad) delete S.bireyFikir[k.id]; else S.bireyFikir[k.id] = { masa: m.id, ad, swot, ts: Date.now() };
      commit(); return json(res, { ok: true });
    }
    if (mm[2] === 'detay' && M === 'POST') {
      const m = S.masalar[k.masa]; if (!m) return hata(res, 400, 'Henüz bir masaya atanmadınız.');
      const h = detayIslem(m, k, await body(req), false); if (h) return hata(res, 409, h);
      commit(); return json(res, { ok: true });
    }
    if (mm[2] === 'secim-puan' && M === 'POST') {
      const m = S.masalar[k.masa]; if (!m) return hata(res, 400, 'Henüz bir masaya atanmadınız.');
      const b = await body(req), s = secimOf(m.id);
      if (!secimPuanKabul(s, b.fikirId)) return hata(res, 409, 'Puanlama şu an açık değil.');
      if (b.fikirId === k.id) return hata(res, 403, 'Kendi fikrinize puan veremezsiniz.');
      const p = parseInt(b.puan, 10); if (!(p >= 1 && p <= 5)) return hata(res, 400, 'Puan 1 ile 5 arasında olmalı.');
      const P = S.secimPuan[m.id] = S.secimPuan[m.id] || {}; (P[b.fikirId] = P[b.fikirId] || {})[k.id] = { p, ts: Date.now() };
      commit(); return json(res, { ok: true });
    }
    if (mm[2] === 'dar-oy' && M === 'POST') { // eşitlik için dar oylama oyu
      const b = await body(req); const m = S.masalar[k.masa]; if (!m) return hata(res, 400, 'Henüz bir masaya atanmadınız.');
      if (b.tur === 'F') {
        const sd = secimOf(m.id).dar; if (!sd || sd.durum !== 'acik') return hata(res, 409, 'Dar oylama şu an açık değil.');
        const uygun = sd.adaylar.filter(id => id !== k.id), hak = Math.min(sd.hak, uygun.length), ids = [...new Set((Array.isArray(b.nos) ? b.nos : []).map(String))];
        if (ids.some(id => !uygun.includes(id))) return hata(res, 400, 'Yalnızca eşit puan alan (ve kendinize ait olmayan) fikirlere oy verebilirsiniz.');
        if (ids.length > hak) return hata(res, 400, 'En fazla ' + hak + ' oy kullanabilirsiniz.');
        if (S.ayar.zorunluTam ? ids.length !== hak : ids.length < 1) return hata(res, 400, 'Dar oylamada ' + hak + ' oyunuzun tamamını kullanın (' + ids.length + '/' + hak + ').');
        sd.oylar[k.id] = ids; commit(); return json(res, { ok: true });
      }
      const tur = b.tur === 'Z' ? 'Z' : 'G', d = m.tur[tur].dar;
      if (!d || d.durum !== 'acik') return hata(res, 409, 'Dar oylama şu an açık değil.');
      const nos = [...new Set((Array.isArray(b.nos) ? b.nos : []).map(x => parseInt(x, 10)))];
      if (nos.some(n => !d.adaylar.includes(n))) return hata(res, 400, 'Yalnızca eşit oy alan post-it numaralarına oy verebilirsiniz.');
      if (nos.length > d.hak) return hata(res, 400, 'En fazla ' + d.hak + ' oy kullanabilirsiniz.');
      if (S.ayar.zorunluTam ? nos.length !== d.hak : nos.length < 1) return hata(res, 400, 'Dar oylamada ' + d.hak + ' oyunuzun tamamını kullanın (' + nos.length + '/' + d.hak + ').');
      d.oylar[k.id] = nos; commit(); return json(res, { ok: true });
    }
    if (mm[2] === 'oy' && M === 'POST') {
      const b = await body(req); const m = S.masalar[k.masa]; if (!m) return hata(res, 400, 'Henüz bir masaya atanmadınız.');
      const tur = b.tur === 'Z' ? 'Z' : 'G'; const t = m.tur[tur];
      if (t.durum !== 'acik') return hata(res, 409, 'Oylama şu an açık değil.');
      const alloc = {}; let top = 0;
      for (const [no, c] of Object.entries(b.alloc || {})) {
        const n = parseInt(no, 10), c2 = parseInt(c, 10);
        if (!(n >= 1 && n <= t.alan) || !(c2 >= 1)) continue;
        if (alloc[n] != null) return hata(res, 400, 'Aynı numara birden fazla kez gönderilmiş.');
        if (c2 > t.maxPer) return hata(res, 400, 'Aynı numaraya en fazla ' + t.maxPer + ' oy verebilirsiniz.');
        alloc[n] = c2; top += c2;
      }
      if (top > t.oy) return hata(res, 400, 'En fazla ' + t.oy + ' oy kullanabilirsiniz.');
      if (S.ayar.zorunluTam && top !== t.oy) return hata(res, 400, 'Tüm oylarınızı kullanmalısınız (' + top + '/' + t.oy + ').');
      if (top === 0) return hata(res, 400, 'En az bir oy kullanın.');
      const key = oyKey(m.id, tur); (S.oylar[key] = S.oylar[key] || {})[k.id] = { alloc, ts: Date.now() };
      commit(); return json(res, { ok: true });
    }
    if (mm[2] === 'puan' && M === 'POST') {
      const b = await body(req); const f = aktifFikir();
      if (S.sunum.durum !== 'puan' || !f || f.id !== b.fikirId) return hata(res, 409, 'Puanlama şu an açık değil.');
      if (!S.ayar.kendiMasaPuan && f.masa === k.masa) return hata(res, 403, 'Kendi masanızın önerisini puanlayamazsınız.');
      const e = parseInt(b.etki, 10), u = parseInt(b.uyg, 10);
      if (!(e >= 1 && e <= 5 && u >= 1 && u <= 5)) return hata(res, 400, 'Puanlar 1 ile 5 arasında olmalı.');
      (S.puanlar[f.id] = S.puanlar[f.id] || {})[k.id] = { etki: e, uyg: u, ts: Date.now() };
      const hak = Object.values(S.katilimcilar).filter(x => x.masa && !x.kolay && (S.ayar.kendiMasaPuan || x.masa !== f.masa)).length;
      if (S.ayar.otoKapat && Object.keys(S.puanlar[f.id]).length >= hak) S.sunum.durum = 'kapali'; // herkes puan verdiyse pencere erken kapanır
      commit(); return json(res, { ok: true });
    }
    return hata(res, 405, 'yöntem');
  }
  /* ---- kayıt masası (kayıt PIN'i veya yönetim PIN'i) ---- */
  if (p.startsWith('/api/kayit/')) {
    if (!(yonetici(req) || (req.headers['x-kayit-pin'] || '') === KAYIT_PIN)) return hata(res, 401, 'Kayıt PIN\'i hatalı.');
    if (p === '/api/kayit/view' && M === 'GET') return json(res, kayitView());
    const b = await body(req);
    if (p === '/api/kayit/ekle' && M === 'POST') {
      if (S.ayar.kayitKapali) return hata(res, 409, 'Kayıt kapandı; yeni kişiyi yönetim ekibi ekler.');
      const m = S.masalar[b.masa]; if (!m) return hata(res, 400, 'Masa seçin.');
      const ad = metin(b.etiket, 60); if (!ad) return hata(res, 400, 'Ad soyad girin.');
      let k = b.yeniID ? null : Object.values(S.katilimcilar).find(x => x.yedek && !x.masa); // önce yedek ID kullanılır
      const yedekti = !!k; if (k) { k.etiket = ad; k.pozisyon = metin(b.pozisyon, 60); k.masa = m.id; k.yedek = false; } else k = katilimciEkle(m.id, ad, null, b.pozisyon);
      k.geldi = true; k.geldiTs = Date.now();
      commit(); return json(res, { ok: true, kod: k.kod, id: k.id, yedek: yedekti });
    }
    const km = p.match(/^\/api\/kayit\/katilimci\/(k[a-z0-9]+)$/);
    if (km && M === 'POST') {
      const k = S.katilimcilar[km[1]]; if (!k) return hata(res, 404, 'Katılımcı yok.');
      if (b.masa != null) { if (S.ayar.kayitKapali) return hata(res, 409, 'Kayıt kapandı; masa değişikliğini yönetim ekibi yapar.'); k.masa = S.masalar[b.masa] ? b.masa : ''; }
      if (b.etiket != null && k.yedek) { const ad = metin(b.etiket, 60); if (!ad) return hata(res, 400, 'Ad soyad girin.'); k.etiket = ad; k.pozisyon = metin(b.pozisyon, 60); k.yedek = false; } // yedek ID bir kişiye atanır
      if (b.geldi != null) { k.geldi = !!b.geldi; k.geldiTs = k.geldi ? Date.now() : 0; }
      if (b.gelmeyecek != null) { if (S.ayar.kayitKapali) return hata(res, 409, 'Kayıt kapandı; değişikliği yönetim ekibi yapar.'); if (b.gelmeyecek && !k.gelmeyecek) { k.oncekiMasa = k.masa; k.masa = ''; k.gelmeyecek = true; k.geldi = false; k.geldiTs = 0; } else if (!b.gelmeyecek && k.gelmeyecek) { k.masa = S.masalar[k.oncekiMasa] ? k.oncekiMasa : ''; k.gelmeyecek = false; } } // gelmeyen masadan çıkar (sayaçlar ve eşikler gerçek katılımcıya göre hesaplanır)
      if (b.cihazSifirla) k.cihazlar = [];
      commit(); return json(res, { ok: true });
    }
    return hata(res, 404, 'Bulunamadı.');
  }
  /* ---- ekran (herkese açık, kişisel veri yok) ---- */
  if (p === '/api/ekran/view' && M === 'GET') return json(res, ekranView(req));
  /* ---- masa ---- */
  if ((mm = p.match(/^\/api\/masa\/([A-Za-z0-9]+)\/(view|tur|etiket|fikir|secim|bfikir|cihaz|detay)$/))) {
    const m = S.masalar[mm[1]]; if (!m) return hata(res, 404, 'Masa yok.');
    if (!masaYetki(req, m, url)) return hata(res, 401, 'Yetkisiz: masa bağlantısı hatalı.');
    if (mm[2] === 'view' && M === 'GET') return json(res, masaView(m));
    const b = await body(req);
    if (mm[2] === 'cihaz' && M === 'POST') { // katılımcı telefonunu değiştirdiyse cihaz kaydını sıfırla
      const k = S.katilimcilar[b.id]; if (!k || k.masa !== m.id) return hata(res, 404, 'Katılımcı bu masada değil.');
      k.cihazlar = []; commit(); return json(res, masaView(m));
    }
    if (mm[2] === 'detay' && M === 'POST') {
      const h = detayIslem(m, null, b, true); if (h) return hata(res, 409, h);
      commit(); return json(res, masaView(m));
    }
    if (mm[2] === 'secim' && M === 'POST') {
      const h = secimIslem(m, b); if (h) return hata(res, 409, h);
      commit(); return json(res, masaView(m));
    }
    if (mm[2] === 'bfikir' && M === 'POST') {
      if (secimOf(m.id).durum !== 'hazir' && !yonetici(req)) return hata(res, 409, 'Sunumlar başladı; fikirler değiştirilemez.');
      const f = S.bireyFikir[b.id]; if (!f || f.masa !== m.id) return hata(res, 404, 'Fikir yok.');
      const ad = metin(b.ad, 110); if (ad) f.ad = ad; else delete S.bireyFikir[b.id];
      commit(); return json(res, masaView(m));
    }
    if (mm[2] === 'tur' && M === 'POST') {
      const tur = b.tur === 'Z' ? 'Z' : 'G';
      const h = turIslem(m, tur, b, yonetici(req)); if (h) return hata(res, 409, h);
      commit(); return json(res, masaView(m));
    }
    if (mm[2] === 'etiket' && M === 'POST') {
      const tur = b.tur === 'Z' ? 'Z' : 'G'; const no = parseInt(b.no, 10);
      if (!(no >= 1 && no <= m.tur[tur].alan)) return hata(res, 400, 'Alan numarası geçersiz.');
      const ad = metin(b.ad, 150); if (ad) m.etiket[tur][no] = ad; else delete m.etiket[tur][no];
      commit(); return json(res, { ok: true });
    }
    if (mm[2] === 'fikir' && M === 'POST') {
      const sira = clampInt(b.sira, 1, m.fikirSayisi, 1);
      if (m.fikirKilit && !yonetici(req)) return hata(res, 409, 'Fikir adları kilitlendi. Yönetim ekibine başvurun.');
      const id = m.id + '-' + sira; let f = S.fikirler.find(x => x.id === id);
      const ad = metin(b.ad, 110);
      if (!f) { f = { id, masa: m.id, sira, ad: '', no: null }; S.fikirler.push(f); }
      f.ad = ad; commit(); return json(res, { ok: true });
    }
    return hata(res, 405, 'yöntem');
  }
  /* ---- yönetim ---- */
  if (p.startsWith('/api/admin/')) {
    if (!yonetici(req)) return hata(res, 401, 'PIN hatalı.');
    const rest = p.slice(11);
    if (rest === 'view' && M === 'GET') return json(res, adminView(req));
    if (['export/oylar.csv', 'export/puanlar.csv', 'export/matris.csv', 'export/katilimcilar.csv', 'export/bulgular.csv'].includes(rest)) {
      const ad = rest.split('/')[1]; const c = ad === 'oylar.csv' ? csvOylar() : ad === 'puanlar.csv' ? csvPuanlar() : ad === 'katilimcilar.csv' ? csvKatilimcilar() : ad === 'bulgular.csv' ? csvBulgular() : csvMatris();
      res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="kok_' + ad + '"' }); return res.end(c);
    }
    if (M !== 'POST') return hata(res, 405, 'yöntem');
    const b = await body(req);
    if (rest === 'ayar') {
      const a = S.ayar;
      if (b.baseUrl != null) a.baseUrl = metin(b.baseUrl, 120);
      for (const k of ['zorunluTam', 'kendiMasaPuan', 'otoKapat', 'otoPuan', 'acikKatilim', 'cihazKilidi', 'kayitKapali']) if (b[k] != null) a[k] = !!b[k];
      if (b.esik === 'orta' || b.esik === 'ortalama') a.esik = b.esik;
      if (b.esikDeger != null) a.esikDeger = Math.max(1, Math.min(5, parseFloat(b.esikDeger) || 3));
      if (b.ayrilikEsigi != null) a.ayrilikEsigi = Math.max(0.3, Math.min(3, parseFloat(b.ayrilikEsigi) || 1.2));
      if (b.sunumSn != null) a.sunumSn = clampInt(b.sunumSn, 5, 1200, a.sunumSn);
      if (b.puanSn != null) a.puanSn = clampInt(b.puanSn, 0, 300, a.puanSn);
      if (b.minPuanYuzde != null) a.minPuanYuzde = clampInt(b.minPuanYuzde, 0, 100, a.minPuanYuzde == null ? 80 : a.minPuanYuzde);
      if (b.secimPuanSn != null) a.secimPuanSn = clampInt(b.secimPuanSn, 0, 120, a.secimPuanSn);
      if (b.gozdenSn != null) a.gozdenSn = clampInt(b.gozdenSn, 0, 900, a.gozdenSn);
      if (b.sonucSlayt != null) a.sonucSlayt = clampInt(b.sonucSlayt, 0, 9, 0);
      commit(); return json(res, { ok: true });
    }
    if (rest === 'hazirlik') { // çalıştay öncesi kontrol listesi: elle işaretlenen maddeler (herkesle ortak, yeniden başlatmada korunur)
      S.hazirlik = S.hazirlik || {};
      if (b.sifirla) S.hazirlik = {}; else if (typeof b.id === 'string' && /^[a-z0-9\-]{1,30}$/.test(b.id)) { if (b.ok) S.hazirlik[b.id] = Date.now(); else delete S.hazirlik[b.id]; } else return hata(res, 400, 'Madde geçersiz.');
      commit(); return json(res, { ok: true });
    }
    if (rest === 'asama') {
      if (!['hazirlik', 'guclu', 'zayif', 'fikir', 'sunum', 'sonuc'].includes(b.asama)) return hata(res, 400, 'Aşama geçersiz.');
      S.asama = b.asama; if (b.asama === 'sonuc') S.ayar.sonucSlayt = 0; commit(); return json(res, { ok: true });
    }
    if (rest === 'kurulum') {
      const sablon = b.sablon === 'demo' ? 'demo' : 'ana';
      const eski = S.ayar, eskiP = S.program; S = bosDurum(sablon); S.ayar = Object.assign(S.ayar, { baseUrl: eski.baseUrl }); S.program = eskiP; commit(); return json(res, { ok: true });
    }
    if ((mm = rest.match(/^masa\/([A-Za-z0-9]+)$/))) {
      let m = S.masalar[mm[1]];
      if (b.sil) { delete S.masalar[mm[1]]; for (const k of Object.values(S.katilimcilar)) if (k.masa === mm[1]) k.masa = ''; commit(); return json(res, { ok: true }); }
      if (!m) { m = yeniMasa(metin(mm[1], 8), clampInt(b.tema, 1, 7, 1), b.ad); S.masalar[m.id] = m; }
      if (b.ad != null) m.ad = metin(b.ad, 30) || m.ad;
      if (b.tema != null) m.tema = clampInt(b.tema, 1, 7, m.tema);
      if (b.fikirSayisi != null) m.fikirSayisi = clampInt(b.fikirSayisi, 1, 5, 2);
      if (b.fikirKilit != null) m.fikirKilit = !!b.fikirKilit;
      if (b.tur && b.islem) {
        const tur = b.tur === 'Z' ? 'Z' : 'G';
        const h = turIslem(m, tur, b, true); if (h) return hata(res, 409, h);
      }
      commit(); return json(res, { ok: true });
    }
    if (rest === 'toplu-oy') { // tüm masalarda aynı işlemi uygula (ac/kapat)
      const tur = b.tur === 'Z' ? 'Z' : 'G'; const hatalar = [];
      for (const m of Object.values(S.masalar)) {
        if (b.islem === 'ac' && m.tur[tur].durum !== 'hazir') continue;
        if (b.islem === 'ac') { const t = m.tur[tur]; if (!t.oy && t.postit) { t.oy = oneriOy(t.postit); t.maxPer = oneriMaxPer(t.alan, t.oy); } }
        const h = turIslem(m, tur, { islem: b.islem }, true); if (h) hatalar.push(m.id + ': ' + h);
      }
      commit(); return json(res, { ok: true, hatalar });
    }
    if (rest === 'kolaylastirici/ekle') { // yeni moderatör: masadaki katılımcılara ek bir katılımcı
      const m = S.masalar[b.masa]; if (!m) return hata(res, 400, 'Masa seçin.');
      const ad = metin(b.etiket, 60); if (!ad) return hata(res, 400, 'Ad soyad girin.');
      const k = katilimciEkle(m.id, ad, null, b.pozisyon); k.kolay = true;
      commit(); return json(res, { ok: true, kod: k.kod });
    }
    if (rest === 'kolaylastirici/eksik-olustur') { // moderatörü olmayan her masaya geçici bir moderatör (deneme için)
      let n = 0; for (const m of Object.values(S.masalar)) if (!masaUyeleri(m.id).some(k => k.kolay)) { katilimciEkle(m.id, 'Moderatör ' + m.id).kolay = true; n++; }
      commit(); return json(res, { ok: true, eklenen: n });
    }
    if (rest === 'katilimci/olustur') {
      const m = S.masalar[b.masa]; const n = clampInt(b.adet, 1, 60, 9);
      const mevcut = atananlar(b.masa || '').length;
      for (let i = 1; i <= n; i++) katilimciEkle(m ? m.id : '', (b.onek || (m ? m.id : 'K')) + '-' + String(mevcut + i).padStart(2, '0'));
      commit(); return json(res, { ok: true });
    }
    if (rest === 'katilimci/yedek') { // etkinlik günü gelen yeni kişiler ve gelmeyenlerin yerine kullanılmak üzere isimsiz yedek ID'ler
      const adet = clampInt(b.adet, 1, 100, 10); let sonNo = 0; for (const k of Object.values(S.katilimcilar)) { const x = /^Yedek (\d+)$/.exec(k.etiket || ''); if (x) sonNo = Math.max(sonNo, +x[1]); }
      for (let i = 1; i <= adet; i++) { const k = katilimciEkle('', 'Yedek ' + String(sonNo + i).padStart(2, '0')); k.yedek = true; }
      commit(); return json(res, { ok: true, eklenen: adet });
    }
    if (rest === 'katilimci/toplu') { // her masa için adet katılımcı
      const n = clampInt(b.adet, 1, 30, 9);
      for (const m of Object.values(S.masalar)) { const mevcut = atananlar(m.id).length; for (let i = mevcut + 1; i <= n; i++) katilimciEkle(m.id, m.id + '-' + String(i).padStart(2, '0')); }
      commit(); return json(res, { ok: true });
    }
    if (rest === 'katilimci/ice-aktar') {
      let eklenen = 0, bilinmeyen = [];
      for (const ln of String(b.metin || '').split(/\r?\n/)) {
        const parca = ln.split(/[;,\t]/).map(x => x.trim()); if (!parca[0]) continue;
        const masa = (parca[1] || '').toUpperCase();
        if (masa && !S.masalar[masa]) bilinmeyen.push(masa);
        katilimciEkle(S.masalar[masa] ? masa : '', parca[0]); eklenen++;
      }
      commit(); return json(res, { ok: true, eklenen, bilinmeyen: [...new Set(bilinmeyen)] });
    }
    if (rest === 'katilimci/id-aktar') { // satır: ID;masa[;etiket]  (ID zaten varsa masası güncellenir)
      let eklenen = 0, guncellenen = 0; const uyari = [];
      for (const ln of String(b.metin || '').split(/\r?\n/)) {
        const parca = ln.split(/[;,\t]/).map(x => x.trim()); if (!parca[0]) continue;
        const kod = kodDuzelt(parca[0]), masa = (parca[1] || '').toUpperCase();
        if (kod.length < 3) { uyari.push('"' + parca[0] + '" geçerli bir ID değil (3-12 harf/rakam)'); continue; }
        if (masa && !S.masalar[masa]) uyari.push(kod + ': bilinmeyen masa "' + masa + '" (atamasız bırakıldı)');
        const varOlan = kodBul(kod), hedef = S.masalar[masa] ? masa : '';
        const kol = /^(k|m|kolay|moderatör|moderator|moderatör|kolaylastirici|1|evet)$/i.test(parca[4] || '');
        if (varOlan) { if (kol) varOlan.kolay = true; varOlan.masa = hedef; if (parca[2]) varOlan.etiket = metin(parca[2], 60); if (parca[3]) varOlan.pozisyon = metin(parca[3], 60); guncellenen++; }
        else { const yk = katilimciEkle(hedef, parca[2] || (hedef ? hedef + '-' + kod : kod), kod, parca[3]); if (kol && yk) yk.kolay = true; eklenen++; }
      }
      moderatorTemizle(); commit(); return json(res, { ok: true, eklenen, guncellenen, uyari });
    }
    if ((mm = rest.match(/^katilimci\/(k[a-z0-9]+)$/))) {
      const k = S.katilimcilar[mm[1]]; if (!k) return hata(res, 404, 'Katılımcı yok.');
      if (b.sil) { katilimciTemizle(k.id); delete S.katilimcilar[k.id]; }
      else {
        if (b.masa != null) k.masa = S.masalar[b.masa] ? b.masa : '';
        if (b.etiket != null) k.etiket = metin(b.etiket, 60);
        if (b.pozisyon != null) k.pozisyon = metin(b.pozisyon, 60);
        if (b.kolay != null) { k.kolay = !!b.kolay; if (k.kolay) moderatorTemizle(); }
        if (b.kod != null) { const c = kodDuzelt(b.kod); if (c.length < 3) return hata(res, 400, 'ID en az 3 harf/rakam olmalı.'); const o = kodBul(c); if (o && o.id !== k.id) return hata(res, 409, 'Bu ID başka bir katılımcıda kullanılıyor.'); k.kod = c; }
        if (b.cihazSifirla) k.cihazlar = [];
      }
      commit(); return json(res, { ok: true });
    }
    if (rest === 'katilimci/atamasiz-sil') { // masası olmayan tüm katılımcıları (ve onlara bağlı fikir/oy kayıtlarını) siler
      const idler = Object.values(S.katilimcilar).filter(k => !k.masa && !k.yedek && !k.gelmeyecek).map(k => k.id); // yedek ID'ler ve gelmeyecekler silinmez
      for (const id of idler) {
        delete S.katilimcilar[id]; delete S.bireyFikir[id];
        for (const m of Object.values(S.oylar)) delete m[id];
        for (const f of Object.values(S.puanlar)) delete f[id];
        for (const m of Object.values(S.secimPuan)) for (const f of Object.values(m)) delete f[id];
      }
      commit(); return json(res, { ok: true, silinen: idler.length });
    }
    if (rest === 'katilimci/toplu-tasi') { // seçilenleri bir masaya taşı
      for (const id of b.idler || []) { const k = S.katilimcilar[id]; if (k) k.masa = S.masalar[b.masa] ? b.masa : ''; }
      commit(); return json(res, { ok: true });
    }
    if (rest === 'program') { // yönetici programı: metin ile değiştir, varsayılana dön veya gecikmeyi kaydır
      if (b.varsayilan) S.program = programVarsayilan();
      else if (b.metin != null) { const p = programParse(b.metin); if (p.hata.length) return hata(res, 400, p.hata.slice(0, 3).join(' | ')); if (!p.oge.length) return hata(res, 400, 'En az bir seans yazın.'); S.program = { oge: p.oge }; }
      else if (b.kaydir != null) {
        const dk = clampInt(b.kaydir, -120, 120, 0), idx = clampInt(b.idx, 0, S.program.oge.length - 1, -1);
        if (!dk || idx < 0) return hata(res, 400, 'Kaydırma için geçerli bir seans ve dakika gerekli.');
        S.program.oge.forEach((x, i) => { if (i === idx) { x.e = Math.min(1440, Math.max(x.b + 1, x.e + dk)); } else if (i > idx) { x.b = Math.max(0, Math.min(1439, x.b + dk)); x.e = Math.max(x.b + 1, Math.min(1440, x.e + dk)); } });
      } else return hata(res, 400, 'Geçersiz program isteği.');
      commit(); return json(res, { ok: true });
    }
    if (rest === 'zaman') { // ortak geri sayım: sn = 0 ise durdurur
      const sn = clampInt(b.sn, 0, 7200, 0);
      S.zaman = sn > 0 ? { etiket: metin(b.etiket, 60), bitis: Date.now() + sn * 1000, toplam: sn } : { etiket: '', bitis: 0, toplam: 0 };
      commit(); return json(res, { ok: true });
    }
    if (rest === 'mola') { // mola duyurusu: tüm telefonlarda ve perdede "şimdi molaya çıkabilirsiniz"; dk verilirse dönüş saati gösterilir
      const dk = clampInt(b.dk, 0, 240, 0);
      S.mola = b.ac === false ? null : { ac: true, baslik: metin(b.baslik, 40) || 'Mola', bitis: dk > 0 ? Date.now() + dk * 60000 : 0 };
      commit(); return json(res, { ok: true });
    }
    if (rest === 'toplu-secim') { // tüm masalarda tema tablosunu telefonlarda aç/kapat
      if (b.islem !== 'tablo-ac' && b.islem !== 'tablo-kapat') return hata(res, 400, 'İşlem geçersiz.');
      for (const m of Object.values(S.masalar)) secimIslem(m, { islem: b.islem });
      commit(); return json(res, { ok: true });
    }
    if (rest === 'fikir/numaralandir') {
      const grup = {};
      for (const f of S.fikirler) if (f.ad) (grup[f.masa] = grup[f.masa] || []).push(f);
      let sira = Object.keys(grup);
      if (b.mod === 'kura') for (let i = sira.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [sira[i], sira[j]] = [sira[j], sira[i]]; }
      else sira.sort();
      let n = 1;
      for (const f of S.fikirler) f.no = null;
      for (const id of sira) for (const f of grup[id].sort((a, c) => a.sira - c.sira)) f.no = n++;
      commit(); return json(res, { ok: true, toplam: n - 1 });
    }
    if ((mm = rest.match(/^fikir\/([A-Za-z0-9\-]+)$/))) {
      let f = S.fikirler.find(x => x.id === mm[1]);
      if (b.sil) { S.fikirler = S.fikirler.filter(x => x.id !== mm[1]); delete S.puanlar[mm[1]]; if (S.sunum.aktif === mm[1]) S.sunum = bosDurum().sunum; commit(); return json(res, { ok: true }); }
      if (!f) return hata(res, 404, 'Fikir yok.');
      if (b.ad != null) f.ad = metin(b.ad, 110);
      if (b.no !== undefined) f.no = b.no === '' || b.no === null ? null : clampInt(b.no, 1, 999, null);
      commit(); return json(res, { ok: true });
    }
    if (rest === 'sunum') {
      const s = S.sunum;
      if ((b.islem === 'sonraki' || b.islem === 'onceki') && b.kimden && s.aktif && b.kimden !== s.aktif) return json(res, { ok: true, atlandi: true }); // çift tıklama: ikinci istek yok sayılır
      if (b.islem === 'sec') {
        const f = S.fikirler.find(x => x.id === b.fikirId); if (!f || f.no == null) return hata(res, 400, 'Önce fikirleri numaralandırın.');
        S.sunum = { aktif: f.id, durum: 'hazir', sunumBas: 0, sunumSn: S.ayar.sunumSn, puanKapanis: 0, puanSn: S.ayar.puanSn };
        S.asama = 'sunum';
      } else if (b.islem === 'sonraki') {
        const liste = S.fikirler.filter(x => x.no != null && x.ad).sort((a, c) => a.no - c.no);
        const i = liste.findIndex(x => x.id === s.aktif); const f = liste[i + 1];
        if (!f) return hata(res, 409, 'Sırada başka öneri yok.');
        S.sunum = { aktif: f.id, durum: 'hazir', sunumBas: 0, sunumSn: S.ayar.sunumSn, puanKapanis: 0, puanSn: S.ayar.puanSn }; S.asama = 'sunum';
      } else if (b.islem === 'onceki') {
        const liste = S.fikirler.filter(x => x.no != null && x.ad).sort((a, c) => a.no - c.no);
        const i = liste.findIndex(x => x.id === s.aktif); const f = i > 0 ? liste[i - 1] : null;
        if (!f) return hata(res, 409, 'Önceki öneri yok.');
        S.sunum = { aktif: f.id, durum: 'hazir', sunumBas: 0, sunumSn: S.ayar.sunumSn, puanKapanis: 0, puanSn: S.ayar.puanSn }; S.asama = 'sunum';
      } else if (!s.aktif) return hata(res, 409, 'Önce bir öneri seçin.');
      else if (b.islem === 'baslat') { s.durum = 'sunum'; s.sunumBas = Date.now(); s.sunumSn = S.ayar.sunumSn; }
      else if (b.islem === 'puan-ac') { s.durum = 'puan'; s.puanSn = S.ayar.puanSn; s.puanKapanis = s.puanSn > 0 ? Date.now() + s.puanSn * 1000 : 0; }
      else if (b.islem === 'puan-kapat') { s.durum = 'kapali'; }
      else if (b.islem === 'uzat') { if (s.durum === 'puan') s.puanKapanis = Math.max(Date.now(), s.puanKapanis || Date.now()) + 15000; }
      else if (b.islem === 'temizle') { delete S.puanlar[s.aktif]; }
      else return hata(res, 400, 'Bilinmeyen işlem');
      puanZamanla(); commit(); return json(res, { ok: true });
    }
    if (rest === 'sifirla') {
      if (b.kapsam === 'oy') { S.oylar = {}; for (const m of Object.values(S.masalar)) for (const t of ['G', 'Z']) { m.tur[t].durum = 'hazir'; m.tur[t].seansKapali = false; if (m.bulgular) m.bulgular[t] = null; m.etiket[t] = {}; } }
      else if (b.kapsam === 'puan') { S.puanlar = {}; S.sunum = bosDurum().sunum; }
      else if (b.kapsam === 'icerik') { icerikSifirla(); S.asama = 'hazirlik'; puanZamanla(); }
      else if (b.kapsam === 'hepsi') { fs.writeFileSync(FILE + '.yedek-' + Date.now(), JSON.stringify(S)); const ay = S.ayar, pr = S.program; const hz = S.hazirlik; S = bosDurum(S.sablon); S.ayar = Object.assign(S.ayar, { baseUrl: ay.baseUrl }); S.program = pr; S.hazirlik = hz || {}; }
      else return hata(res, 400, 'Kapsam geçersiz.');
      commit(); return json(res, { ok: true });
    }
    if (rest === 'simule') { // deneme araçları
      if (b.tur === 'katilimci') { for (const m of Object.values(S.masalar)) { const mev = atananlar(m.id).length; for (let i = mev + 1; i <= 9; i++) katilimciEkle(m.id, 'Deneme ' + m.id + '-' + i); } }
      else if (b.tur === 'swot') { // her masaya rastgele post-it/alan sayısı yaz ve oylamayı aç
        const tur = b.turKodu === 'Z' ? 'Z' : 'G';
        for (const m of Object.values(S.masalar)) { const t = m.tur[tur]; if (t.durum !== 'hazir') continue;
          t.postit = 20 + crypto.randomInt(25); t.alan = t.postit; t.oy = oneriOy(t.postit); t.maxPer = oneriMaxPer(t.alan, t.oy); if (t.alan * t.maxPer < t.oy) t.maxPer = Math.ceil(t.oy / t.alan); t.durum = 'acik'; }
      } else if (b.tur === 'oy') {
        for (const m of Object.values(S.masalar)) for (const tur of ['G', 'Z']) if (m.tur[tur].durum === 'acik') rastgeleOy(m, tur, b.oran);
      } else if (b.tur === 'bulgu-demo') { // moderatör eğitimi için geçici demo verisi
        const turlar = b.turKodu === 'Z' ? ['Z'] : b.turKodu === 'GZ' ? ['G', 'Z'] : ['G'];
        const hedef = b.masa ? [S.masalar[b.masa]].filter(Boolean) : Object.values(S.masalar);
        for (const m of hedef) for (const tur of turlar) demoBulgu(m, tur, b.seviye === 'tam');
      } else if (b.tur === 'fikir-demo') { // moderatör eğitimi: fikir seçimi aşamasını istenen adıma getir
        const hedef = b.masa ? [S.masalar[b.masa]].filter(Boolean) : Object.values(S.masalar);
        for (const m of hedef) { const h = demoFikir(m, ['giris', 'hazir', 'sunum', 'sonuc', 'onay', 'detay', 'gonderildi'].includes(b.adim) ? b.adim : 'giris'); if (h) return hata(res, 409, h); }
      } else if (b.tur === 'dar-oy-uret') { darOyUret(!!b.esit);
      } else if (b.tur === 'esit-swot') { for (const m of Object.values(S.masalar)) esitSwot(m, b.turKodu === 'Z' ? 'Z' : 'G');
      } else if (b.tur === 'esit-fikir') { for (const m of Object.values(S.masalar)) esitFikir(m);
      } else if (b.tur === 'swot-bitir') { for (const m of Object.values(S.masalar)) swotBitir(m, b.turKodu === 'Z' ? 'Z' : 'G');
      } else if (b.tur === 'secim-tamamla') { for (const m of Object.values(S.masalar)) { if (masaFikirleri(m.id).length === 0 && atananlar(m.id).length < 2) continue; secimTamamla(m); }
      } else if (b.tur === 'detay-doldur') { for (const m of Object.values(S.masalar)) if (secimOf(m.id).onay) detayDoldur(m);
      } else if (b.tur === 'demo-hiz') { demoHiz(!!b.ac);
      } else if (b.tur === 'demo-bitir') { icerikSifirla(); demoHiz(false); S.asama = 'hazirlik'; S.zaman = { etiket: '', bitis: 0, toplam: 0 }; puanZamanla();
      } else if (b.tur === 'bulgu-temizle') {
        const turlar = b.turKodu === 'Z' ? ['Z'] : b.turKodu === 'GZ' ? ['G', 'Z'] : ['G'];
        const hedef = b.masa ? [S.masalar[b.masa]].filter(Boolean) : Object.values(S.masalar);
        for (const m of hedef) for (const tur of turlar) turIslem(m, tur, { islem: 'sifirla' }, true);
      } else if (b.tur === 'fikir') {
        let i = 0; for (const m of Object.values(S.masalar)) for (let s2 = 1; s2 <= m.fikirSayisi; s2++) {
          const id = m.id + '-' + s2; let f = S.fikirler.find(x => x.id === id);
          if (!f) { f = { id, masa: m.id, sira: s2, ad: '', no: null }; S.fikirler.push(f); }
          if (!f.ad) f.ad = ORNEK_FIKIRLER[i % ORNEK_FIKIRLER.length]; i++;
        }
      } else if (b.tur === 'puan') {
        const f = aktifFikir(); if (!f) return hata(res, 409, 'Aktif öneri yok.');
        let h = 0; for (const ch of f.id) h = (h * 31 + ch.charCodeAt(0)) % 1000;
        const me = 2 + (h % 30) / 12, mu = 2 + ((h * 7) % 30) / 12;
        S.puanlar[f.id] = S.puanlar[f.id] || {};
        for (const k of Object.values(S.katilimcilar)) {
          if (S.puanlar[f.id][k.id]) continue; if (k.kolay || !k.masa) continue; if (!S.ayar.kendiMasaPuan && f.masa === k.masa) continue; if (b.oran && Math.random() > b.oran) continue;
          const r = (m0) => Math.max(1, Math.min(5, Math.round(m0 + (Math.random() + Math.random() - 1) * 1.8)));
          S.puanlar[f.id][k.id] = { etki: r(me), uyg: r(mu), ts: Date.now() };
        }
      } else if (b.tur === 'tum-puan') { // tüm numaralı fikirler için puan üret (prova)
        for (const f of S.fikirler) { if (f.no == null) continue; let h = 0; for (const ch of f.id) h = (h * 31 + ch.charCodeAt(0)) % 1000;
          const me = 1.8 + (h % 33) / 11, mu = 1.8 + ((h * 7) % 33) / 11; S.puanlar[f.id] = S.puanlar[f.id] || {};
          for (const k of Object.values(S.katilimcilar)) { if (S.puanlar[f.id][k.id]) continue; if (k.kolay || !k.masa) continue; if (!S.ayar.kendiMasaPuan && f.masa === k.masa) continue;
            const r = (m0) => Math.max(1, Math.min(5, Math.round(m0 + (Math.random() + Math.random() - 1) * 1.8)));
            S.puanlar[f.id][k.id] = { etki: r(me), uyg: r(mu), ts: Date.now() }; } }
      } else if (b.tur === 'bfikir') { // her katılımcıya örnek fikir yazdır; dayanağı (SWOT maddesi) olmayan mevcut demo fikirlerine de dayanak eklenir
        let j = 0; for (const k of Object.values(S.katilimcilar)) { const f = S.bireyFikir[k.id]; j++; if (!f || !f.ad || (f.swot || []).length || !k.masa || k.kolay) continue; const dy = Object.keys(swotSecenek(S.masalar[k.masa])); if (dy.length) f.swot = [...new Set([dy[j % dy.length], dy[(j * 3 + 1) % dy.length]])]; }
        let i = 0; for (const k of Object.values(S.katilimcilar)) {
          if (!k.masa || (S.bireyFikir[k.id] && S.bireyFikir[k.id].ad) || k.kolay) { i++; continue; }
          if (secimOf(k.masa).durum !== 'hazir') continue;
          const dy = Object.keys(swotSecenek(S.masalar[k.masa])); // her demo fikrine en az bir dayanak (SWOT maddesi) seçilir
          S.bireyFikir[k.id] = { masa: k.masa, ad: ORNEK_FIKIRLER[(i * 7 + k.masa.length) % ORNEK_FIKIRLER.length], swot: dy.length ? [...new Set([dy[i % dy.length], dy[(i * 3 + 1) % dy.length]])] : [], ts: Date.now() + i }; i++;
        }
      } else if (b.tur === 'secim-puan') { // açık anında puan veya gözden geçirme için eksik puanları rastgele doldur
        for (const m of Object.values(S.masalar)) {
          const s = secimOf(m.id); const P = S.secimPuan[m.id] = S.secimPuan[m.id] || {};
          const hedef = s.durum === 'sunum' || s.durum === 'gozden' ? s.sira : [];
          for (const fid of hedef) {
            let h = 0; for (const ch of fid) h = (h * 31 + ch.charCodeAt(0)) % 1000; const me = 2.2 + (h % 30) / 12;
            for (const k of atananlar(m.id)) {
              if (k.id === fid || (P[fid] || {})[k.id]) continue; if (b.oran && Math.random() > b.oran) continue;
              const p = Math.max(1, Math.min(5, Math.round(me + (Math.random() + Math.random() - 1) * 1.6))); (P[fid] = P[fid] || {})[k.id] = { p, ts: Date.now() };
            }
          }
        }
      } else if (b.tur === 'secim-otomatik') { // tüm masalarda seçimi baştan sona tamamla (prova)
        for (const m of Object.values(S.masalar)) {
          { const dy = Object.keys(swotSecenek(m)); atananlar(m.id).forEach((k, i) => { if (!(S.bireyFikir[k.id] && S.bireyFikir[k.id].ad)) S.bireyFikir[k.id] = { masa: m.id, ad: ORNEK_FIKIRLER[(i * 7 + m.id.length) % ORNEK_FIKIRLER.length], swot: dy.length ? [dy[i % dy.length]] : [], ts: Date.now() + crypto.randomInt(1000) }; }); }
          secimIslem(m, { islem: 'yeniden' }); if (secimIslem(m, { islem: 'baslat' })) continue;
          const s = secimOf(m.id); const P = S.secimPuan[m.id];
          for (const fid of s.sira) {
            let h = 0; for (const ch of fid) h = (h * 31 + ch.charCodeAt(0)) % 1000; const me = 2.2 + (h % 30) / 12; P[fid] = {};
            for (const k of atananlar(m.id)) if (k.id !== fid) P[fid][k.id] = { p: Math.max(1, Math.min(5, Math.round(me + (Math.random() + Math.random() - 1) * 1.6))), ts: Date.now() };
          }
          secimIslem(m, { islem: 'gozden' }); secimIslem(m, { islem: 'hesapla' });
          secimIslem(m, { islem: 'onayla', secilen: secimOf(m.id).sonuc.liste.slice(0, m.fikirSayisi).map(x => x.id) });
        }
      } else return hata(res, 400, 'Bilinmeyen simülasyon.');
      commit(); return json(res, { ok: true });
    }
    return hata(res, 404, 'Bilinmeyen yönetim işlemi.');
  }
  return hata(res, 404, 'bulunamadı');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (url.pathname.startsWith('/api/')) { if (!pinSiniri(req)) return hata(res, 429, 'Çok fazla hatalı PIN denemesi. 10 dakika sonra tekrar deneyin.'); return await api(req, res, url); }
    if (url.pathname.startsWith('/static/')) return dosya(res, url.pathname.slice(8));
    for (const [re, f] of SAYFALAR) if (re.test(url.pathname)) return dosya(res, f);
    hata(res, 404, 'bulunamadı');
  } catch (e) { console.error(e); try { hata(res, 400, 'İstek hatalı: ' + e.message); } catch (e2) { /* yut */ } }
});

yukle();
moderatorTemizle();
puanZamanla();
for (const id of Object.keys(S.secim)) secimZamanla(id);
process.on('SIGINT', () => { persist(true); process.exit(0); });
process.on('SIGTERM', () => { persist(true); process.exit(0); });
server.listen(PORT, '0.0.0.0', () => {
  console.log('\nKÖK Oylama Sistemi çalışıyor.');
  console.log('  Bu bilgisayar : http://localhost:' + PORT);
  for (const ip of lanIps()) console.log('  Ağdaki cihazlar: http://' + ip + ':' + PORT);
  console.log('  Yönetim PIN   : ' + (process.env.ADMIN_PIN ? '(ADMIN_PIN ortam değişkeni)' : ADMIN_PIN + '  (değiştirmek için ADMIN_PIN=... node server.js)') + '\n');
});
