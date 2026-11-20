#!/usr/bin/env node
/* Test ortamı: SAHTE verili, geçici ve izole bir sunucu başlatır. Gerçek verilere (data/, data_deneme/) ve 3000/3001 portlarındaki sunuculara dokunmaz.
 *
 *   node tools/test_ortami.js                      (boş çalıştay: 14 masa, masa başı 9 kişi + 1 kolaylaştırıcı)
 *   node tools/test_ortami.js --asama=genel-kurul  (28 öneri hazır, genel kurul 1. öneride)
 *   node tools/test_ortami.js --port=3300 --asama=sonuc
 *
 * Aşamalar: bos | swot-acik | swot-bitti | fikir | detay | genel-kurul | sonuc
 * Kapatmak için Ctrl+C. Veri geçici klasörde tutulur ve kapanışta silinir.
 */
const { spawn } = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path');
const arg = (ad, v) => { const a = process.argv.find(x => x.startsWith('--' + ad + '=')); return a ? a.split('=')[1] : v; };
const PORT = +arg('port', 3200), ASAMA = arg('asama', 'bos'), PIN = 'test-pin-2026', KAYIT = 'test-kayit-2026';
const ASAMALAR = ['bos', 'swot-acik', 'swot-bitti', 'fikir', 'detay', 'genel-kurul', 'sonuc'];
if (!ASAMALAR.includes(ASAMA)) { console.error('Geçersiz --asama. Seçenekler: ' + ASAMALAR.join(', ')); process.exit(1); }
if ([3000, 3001].includes(PORT)) { console.error('3000 ve 3001 portları gerçek/deneme sunucularına ayrılmıştır. Başka bir port seçin.'); process.exit(1); }
const ROOT = path.join(__dirname, '..'), DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'kok-test-ortami-'));
const B = 'http://localhost:' + PORT, sleep = ms => new Promise(r => setTimeout(r, ms));
const srv = spawn('node', [path.join(ROOT, 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), ADMIN_PIN: PIN, KAYIT_PIN: KAYIT, DATA_DIR: DATA }), stdio: 'ignore' });
const kapat = () => { try { srv.kill(); } catch (e) { /* yut */ } try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* yut */ } process.exit(0); };
process.on('SIGINT', kapat); process.on('SIGTERM', kapat); srv.on('exit', () => { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* yut */ } process.exit(0); });
const api = async (p, b, h) => { const r = await fetch(B + p, { method: b ? 'POST' : 'GET', headers: h || { 'content-type': 'application/json', 'x-pin': PIN }, body: b ? JSON.stringify(b) : undefined }); let j = {}; try { j = await r.json(); } catch (e) { /* boş */ } return j; };
const adm = (p, b) => api('/api/admin' + p, b);
(async () => {
  for (let i = 0; i < 40; i++) { try { if ((await fetch(B + '/api/saat')).ok) break; } catch (e) { /* bekle */ } await sleep(250); }
  await adm('/ayar', { baseUrl: B });
  await adm('/simule', { tur: 'katilimci' }); await adm('/kolaylastirici/eksik-olustur', {});
  if (['swot-acik'].includes(ASAMA)) { await adm('/asama', { asama: 'guclu' }); await adm('/simule', { tur: 'swot', turKodu: 'G' }); }
  if (['swot-bitti', 'fikir', 'detay', 'genel-kurul', 'sonuc'].includes(ASAMA)) await adm('/simule', { tur: 'bulgu-demo', turKodu: 'GZ', seviye: 'tam' });
  if (ASAMA === 'fikir') { await adm('/asama', { asama: 'fikir' }); await adm('/toplu-secim', { islem: 'tablo-ac' }); }
  if (ASAMA === 'detay') { await adm('/asama', { asama: 'fikir' }); await adm('/simule', { tur: 'fikir-demo', adim: 'detay' }); }
  if (['genel-kurul', 'sonuc'].includes(ASAMA)) {
    await adm('/simule', { tur: 'fikir-demo', adim: 'gonderildi' }); await adm('/fikir/numaralandir', { mod: 'sira' });
    const L = ((await adm('/view')).fikirler || []).filter(f => f.no != null).sort((a, b) => a.no - b.no);
    if (L[0]) await adm('/sunum', { islem: 'sec', fikirId: L[0].id });
    if (ASAMA === 'sonuc') { await adm('/simule', { tur: 'tum-puan' }); await adm('/asama', { asama: 'sonuc' }); }
  }
  const v = await adm('/view'), mk = id => (v.masalar.find(m => m.id === id) || {}).key;
  const kat = v.katilimcilar.find(k => k.masa === '1A' && !k.kolay), kol = v.katilimcilar.find(k => k.masa === '1A' && k.kolay);
  console.log(`
KÖK TEST ORTAMI HAZIR  (aşama: ${ASAMA})  ·  tüm veriler SAHTE ve geçici; Ctrl+C ile kapanır ve silinir
------------------------------------------------------------------------------------------------
Sunucu          : ${B}
Yönetim PIN     : ${PIN}        (başlık: x-pin)
Kayıt PIN       : ${KAYIT}   (başlık: x-kayit-pin)
Yönetim paneli  : ${B}/yonetim
Perde           : ${B}/ekran
Menü            : ${B}/menu
Katılım (ana)   : ${B}/            (ID girilir)
Katılımcı       : ${kat ? kat.etiket + '  ID ' + kat.kod + '  ' + B + '/p/' + kat.token : '-'}
Kolaylaştırıcı  : ${kol ? kol.etiket + '  ID ' + kol.kod + '  ' + B + '/masa/1A?t=' + kol.token : '-'}
Masa 1A (anahtar): ${B}/masa/1A?k=${mk('1A')}
Toplam katılımcı: ${v.katilimcilar.length}  ·  masa: ${v.masalar.length}
------------------------------------------------------------------------------------------------`);
})().catch(e => { console.error(e); kapat(); });
