/* kayıt masası: sabah ilk kayıt (geldi işareti, masa ataması, cihaz sıfırlama, yeni kişi) */
const app = $('#app');
let PIN = '', V = null, filtre = { masa: '', durum: '', ara: '' }, ekleAcik = false, hedefId = '';
try { PIN = localStorage.getItem('kokKayitPin') || ''; } catch (e) { /* yut */ }
const kapi = (p, b) => api('/api/kayit' + p, b === undefined ? undefined : b, { 'x-kayit-pin': PIN });
const tr = s => String(s || '').toLocaleLowerCase('tr');

async function yenile() {
  if (!PIN) return giris();
  try { V = await kapi('/view'); } catch (e) { if (e.status === 401) { PIN = ''; try { localStorage.removeItem('kokKayitPin'); } catch (x) { /* yut */ } return giris('PIN hatalı.'); } return; }
  render();
}
function giris(msg) {
  app.innerHTML = '<div style="max-width:420px;margin:12vh auto" class="card"><div class="eyebrow">KÖK · Kayıt</div><h1 style="font-size:34px;margin:8px 0 14px">Kayıt masası</h1>' + (msg ? '<div style="color:var(--pinkl,#ff9bb5);margin-bottom:8px">' + esc(msg) + '</div>' : '') +
    '<label class="f">Kayıt PIN\'i<input id="pin" type="password" autofocus></label><button class="btn xl" id="gir" style="margin-top:14px">Giriş</button></div>';
  const go = () => { PIN = $('#pin').value.trim(); try { localStorage.setItem('kokKayitPin', PIN); } catch (e) { /* yut */ } yenile(); };
  $('#gir').onclick = go; $('#pin').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}
canli(() => { if (PIN && document.activeElement && ['INPUT', 'SELECT'].includes(document.activeElement.tagName) && document.activeElement.id !== 'ara') return; yenile(); });

function liste() {
  const ara = tr(filtre.ara);
  return V.katilimcilar.filter(k =>
    (!filtre.masa || (filtre.masa === '_yedek' ? k.yedek : filtre.masa === '_yok' ? (!k.masa && !k.yedek && !k.gelmeyecek) : filtre.masa === '_gelmeyecek' ? k.gelmeyecek : k.masa === filtre.masa)) &&
    (!filtre.durum || (filtre.durum === 'geldi' ? k.geldi : !k.geldi)) &&
    (!ara || tr(k.etiket + ' ' + k.pozisyon + ' ' + k.kod).includes(ara))
  ).sort((a, b) => tr(a.etiket).localeCompare(tr(b.etiket), 'tr'));
}
function satir(k) {
  const mas = V.masalar.map(m => `<option value="${esc(m.id)}" ${k.masa === m.id ? 'selected' : ''}>${esc(m.id)}</option>`).join('');
  const ek = k.yedek ? `<span class="badge off">Yedek ID</span> <button class="btn sm teal" data-a="ata" data-id="${k.id}">Kişiye ata</button>` : k.gelmeyecek ? `<span class="badge warn">Gelmeyecek</span> <button class="btn sm ghost" data-a="gelecek" data-id="${k.id}">Geri al</button>` : (!k.geldi ? `<button class="btn sm ghost" data-a="gelmeyecek" data-id="${k.id}">Gelmeyecek</button>` : '');
  return `<div class="kp ${k.geldi ? 'geldi' : ''}"><div class="nm"><b>${esc(k.etiket)}</b>${k.kolay ? '<span class="kolaytag">Kolaylaştırıcı</span>' : ''}${k.pozisyon ? '<br><span class="muted">' + esc(k.pozisyon) + '</span>' : ''}</div>
    <div class="id">${esc(k.kod)}</div>
    <select data-ch="masa" data-id="${k.id}" ${V.kapali ? 'disabled' : ''}><option value="">Masa —</option>${mas}</select>
    ${k.yedek || k.gelmeyecek ? '' : `<button class="btn ${k.geldi ? 'ghost' : 'teal'}" data-a="geldi" data-id="${k.id}" data-v="${k.geldi ? '0' : '1'}">${k.geldi ? '✓ Geldi (geri al)' : 'Geldi'}</button>`} ${ek}
    ${k.cihaz ? `<button class="btn sm ghost" data-a="cihaz" data-id="${k.id}">Cihazı sıfırla</button>` : ''}</div>`;
}
function render() {
  const yon = V.katilimcilar.filter(k => !k.kolay), kol = V.katilimcilar.filter(k => k.kolay);
  const g = a => a.filter(k => k.geldi).length;
  const chips = [['', 'Tümü', ''], ...V.masalar.map(m => [m.id, m.id, m.geldi + '/' + m.atanan]), ['_yok', 'Atamasız', V.katilimcilar.filter(k => !k.masa && !k.yedek && !k.gelmeyecek).length + ''], ['_yedek', 'Yedek ID', V.katilimcilar.filter(k => k.yedek).length + ''], ['_gelmeyecek', 'Gelmeyecek', V.katilimcilar.filter(k => k.gelmeyecek).length + '']]
    .map(([id, ad, alt]) => `<div class="mchip ${filtre.masa === id ? 'on' : ''} ${alt && alt.includes('/') && alt.split('/')[0] === alt.split('/')[1] && alt.split('/')[1] !== '0' ? 'full' : ''}" data-a="mchip" data-v="${esc(id)}">${esc(ad)}${alt ? '<small>' + esc(alt) + '</small>' : ''}</div>`).join('');
  const mas = V.masalar.map(m => `<option value="${esc(m.id)}">${esc(m.id)} · ${esc(m.temaAd)}</option>`).join('');
  app.innerHTML = `<div class="kh"><div><div class="eyebrow">KÖK · Yönetici Çalıştayı</div><h1 class="serif">Kayıt masası</h1></div><span class="sp"></span>${V.kapali ? '<span class="badge warn">Kayıt kapandı: masa değişikliği yok</span>' : '<span class="badge ok">Kayıt açık</span>'}</div>
    <div class="kc"><div class="box"><b>${g(yon)} / ${yon.length}</b><span>yönetici geldi</span></div><div class="box"><b>${g(kol)} / ${kol.length}</b><span>kolaylaştırıcı geldi</span></div></div>
    <div class="ktb"><input id="ara" placeholder="Ad, soyad, pozisyon veya ID ara…" value="${esc(filtre.ara)}" autocomplete="off"><select id="durum"><option value="">Tümü</option><option value="gelmedi" ${filtre.durum === 'gelmedi' ? 'selected' : ''}>Gelmedi</option><option value="geldi" ${filtre.durum === 'geldi' ? 'selected' : ''}>Geldi</option></select></div>
    <div class="mchips">${chips}</div>
    <div class="kadd">${V.kapali ? '' : `<button class="btn sm ghost" data-a="ekleac">${ekleAcik ? 'Yeni kişi formunu kapat' : '+ Listede olmayan kişi ekle'}</button>`}
    ${ekleAcik && !V.kapali ? `<div class="card" style="--ac:var(--blue);margin-top:8px">${hedefId ? '<div class="eyebrow blue">Yedek ID: ' + esc((V.katilimcilar.find(x => x.id === hedefId) || {}).kod || '') + '</div>' : '<div class="muted mini">Önce boştaki yedek ID kullanılır; yedek yoksa yeni ID üretilir.</div>'}<div class="fg"><label class="f">Ad soyad<input id="e-ad"></label><label class="f">Pozisyon<input id="e-poz"></label><label class="f">Masa<select id="e-masa">${mas}</select></label></div><button class="btn" data-a="ekle" style="margin-top:10px">Ekle ve geldi olarak işaretle</button></div>` : ''}</div>
    <div id="liste"></div>`;
  listeYaz();
}
function listeYaz() {
  const l = liste(); const k = $('#liste'); if (!k) return;
  k.innerHTML = (l.length ? l.slice(0, 300).map(satir).join('') : '<div class="muted" style="padding:14px">Eşleşen kişi yok.</div>') + (l.length > 300 ? '<div class="muted">İlk 300 kişi gösteriliyor; aramayı daraltın.</div>' : '');
}
document.addEventListener('input', e => { if (e.target.id === 'ara') { filtre.ara = e.target.value; listeYaz(); } });
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'durum') { filtre.durum = el.value; render(); return; }
  if (el.dataset && el.dataset.ch === 'masa') { try { await kapi('/katilimci/' + el.dataset.id, { masa: el.value }); toast('Masa kaydedildi'); await yenile(); } catch (er) { toast(er.message, 1); yenile(); } }
});
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el) return; const a = el.dataset.a, d = el.dataset;
  try {
    if (a === 'mchip') { filtre.masa = d.v; render(); }
    else if (a === 'geldi') { await kapi('/katilimci/' + d.id, { geldi: d.v === '1' }); await yenile(); }
    else if (a === 'cihaz') { if (confirm('Bu kişinin cihaz kaydı sıfırlansın mı? (Telefon değiştiyse)')) { await kapi('/katilimci/' + d.id, { cihazSifirla: true }); toast('Cihaz sıfırlandı'); await yenile(); } }
    else if (a === 'ekleac') { ekleAcik = !ekleAcik; hedefId = ''; render(); }
    else if (a === 'ata') { hedefId = d.id; ekleAcik = true; render(); window.scrollTo(0, 0); }
    else if (a === 'gelmeyecek') { if (confirm('Bu kişi gelmeyecek olarak işaretlensin mi? Masadan çıkarılır; yerine yedek ID verilebilir.')) { await kapi('/katilimci/' + d.id, { gelmeyecek: true }); toast('Gelmeyecek olarak işaretlendi'); await yenile(); } }
    else if (a === 'gelecek') { await kapi('/katilimci/' + d.id, { gelmeyecek: false }); toast('Geri alındı'); await yenile(); }
    else if (a === 'ekle') {
      let r;
      if (hedefId) { const yk = V.katilimcilar.find(x => x.id === hedefId); await kapi('/katilimci/' + hedefId, { etiket: $('#e-ad').value, pozisyon: $('#e-poz').value, masa: $('#e-masa').value, geldi: true }); r = { kod: yk ? yk.kod : '' }; }
      else r = await kapi('/ekle', { etiket: $('#e-ad').value, pozisyon: $('#e-poz').value, masa: $('#e-masa').value });
      ekleAcik = false; hedefId = ''; toast('Eklendi. ID: ' + r.kod); filtre.ara = ''; await yenile();
      alert('Yeni kişinin ID\'si: ' + r.kod + (r.yedek ? '  (yedek ID kullanıldı)' : ''));
    }
  } catch (er) { toast(er.message, 1); }
});
yenile();
