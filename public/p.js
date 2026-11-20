/* katılımcı (telefon) uygulaması */
const TOKEN = location.pathname.split('/').filter(Boolean)[1];
const app = $('#app');
let V = null, draft = {}, draftSig = '', dirty = false, editing = false, pd = { fikirId: null, etki: null, uyg: null }, pdDirty = false, pdEdit = false;
let lastHtml = '';
const P = path => '/api/p/' + TOKEN + path;

async function yenile() {
  try { V = await api(P('/view')); setSkew(V.t); } catch (e) { if (e.status === 403) { app.innerHTML = hata(e.message); return; } if (e.status === 404) { try { localStorage.removeItem('kokToken'); } catch (x) { /* yut */ }  app.innerHTML = hata('Bu bağlantı geçersiz. Lütfen yaka kartınızdaki QR kodu yeniden okutun veya kodunuzu girin.'); return; } throw e; }
  render();
}
canli(yenile);
const hata = m => `<div class="card" style="--ac:var(--pink);margin-top:40px"><div class="eyebrow pink">Bağlantı</div><p>${esc(m)}</p><a class="btn ghost" style="display:inline-block;text-decoration:none" href="/katil">Kodla giriş</a></div>`;
const AC = { G: 'var(--teal)', Z: 'var(--pink)' };
const TURAD = { G: 'Güçlü yönler', Z: 'Zayıf yönler' };

function zamanBar() {
  const z = V.zaman; if (!z || !z.bitis || z.bitis <= now() - 20000) return '';
  const bit = z.bitis <= now();
  return `<div class="zbar ${bit ? 'bit' : ''}"><span>${esc(z.etiket || 'Kalan süre')}</span><b id="zb" data-t="${z.bitis}">${bit ? 'Süre doldu' : mmss(z.bitis - now())}</b></div>`;
}
function ust(eb, cls) {
  const m = V.masa;
  const rb = m && V.ben.kolay ? rolBar('kat', TOKEN, m.id) : '';
  return rb + `<div class="top"><span class="eyebrow ${cls || ''}">${eb}</span><span class="masachip" style="margin-left:auto">${m ? esc(m.ad) : 'Masa yok'}</span></div>` + zamanBar();
}
function ayarlaHtml(h) { if (h !== lastHtml) { lastHtml = h; app.innerHTML = h; } }

let bekleyenRender = false, lastTablo = false;
function render() {
  if (!V) return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT') && app.contains(ae)) { bekleyenRender = true; return; }
  const m = V.masa;
  if (!m) return ayarlaHtml(ust('KÖK · Yönetici Çalıştayı') + `<div class="card" style="--ac:var(--gold)"><h2 class="big">Henüz bir masaya atanmadınız</h2><p class="muted">Yönetim ekibi sizi bir masaya atadığında bu ekran otomatik açılır. Katılım kodunuz: <b class="goldl">${esc(V.ben.kod)}</b></p></div>`);
  if (V.sunum.durum === 'puan' && V.sunum.fikir) return puanEkrani();
  for (const t of ['G', 'Z']) if (m.tur[t].durum === 'acik') return oyEkrani(t);
  for (const t of ['G', 'Z']) if (m.tur[t].dar && m.tur[t].dar.durum === 'acik') return darEkrani(t);
  const sc = V.secim;
  if (sc && sc.tablo !== lastTablo) { if (sc.tablo) ftab = 'tema'; lastTablo = sc.tablo; }
  if (sc && sc.durum === 'sunum' && sc.aktif) return secimSunum();
  if (sc && sc.durum === 'bitti' && sc.dar && sc.dar.durum === 'acik') return fikirDarEkrani();
  if (sc && sc.durum === 'gozden') return gozdenEkrani();
  if (sc && sc.durum === 'bitti' && V.detay && V.asama !== 'sunum' && V.asama !== 'sonuc') return detayEkrani();
  if (sc && sc.durum === 'hazir' && (V.asama === 'fikir' || sc.tablo)) return fikirGiris();
  if (V.asama === 'sonuc' && V.matris) return sonucEkrani();
  if (V.asama === 'sunum' && V.sunum.fikir) return sunumEkrani();
  return beklemeEkrani();
}

/* ------------------------------------------------------------- SWOT oylaması */
/* eşitlik için dar oylama: yalnızca eşit oy alan post-it'ler */
let darTaslak = [], darSig = '', darDuz = false;
function darEkrani(tur) {
  const m = V.masa, d = m.tur[tur].dar, benim = (m.darBenim || {})[tur], cls = tur === 'G' ? 'teal' : 'pink';
  const sig = m.id + tur + d.adaylar.join(','); if (sig !== darSig) { darSig = sig; darTaslak = (benim || []).slice(); }
  let h = `<div style="--ac:${AC[tur]}">` + ust('Dar oylama · ' + TURAD[tur], cls);
  if (benim && !darDuz) { return ayarlaHtml(h + `<div class="card" style="text-align:center"><div class="okc">✓</div><h2 class="big">Dar oyunuz alındı</h2><div class="row wrap-f" style="justify-content:center;gap:8px;margin:12px 0">${benim.map(n => `<span class="pill"><b class="serif" style="font-size:20px">${n}</b></span>`).join('')}</div><p class="muted">Dar oylama kapanana kadar değiştirebilirsiniz.</p><button class="btn ghost" data-a="dar-degistir">Oyumu değiştir</button></div><div class="card flat" style="margin-top:14px"><div class="row"><span class="muted">Dar oylamada oy kullananlar</span><span class="sp"></span><b>${d.oyVeren} / ${d.atanan}</b></div></div></div>`); }
  h += `<h1 class="big">Eşitlik: dar oylama</h1><p class="muted" style="margin:8px 0 0">Aşağıdaki post-it'ler eşit oy aldı. Masadan <b class="goldl">${d.yer}</b> tanesi seçilecek. Beğendiğiniz <b class="goldl">${d.hak}</b> numaraya dokunun (her numaraya en çok 1 oy).</p><div class="tiles">`;
  for (const n of d.adaylar) h += `<div class="tile ${darTaslak.includes(n) ? 'on' : ''}" data-a="dar-tile" data-n="${n}">${n}</div>`;
  h += `</div><div class="dock"><div class="in"><div class="row" style="margin-bottom:10px"><div class="count"><b>${d.hak - darTaslak.length}</b><span class="muted">oy kaldı</span></div></div><button class="btn xl ${cls}" data-a="dar-gonder" ${darTaslak.length === d.hak ? '' : 'disabled'}>${darTaslak.length === d.hak ? 'Oylarımı gönder' : (d.hak - darTaslak.length) + ' oy daha kullanın'}</button></div></div></div>`;
  ayarlaHtml(h);
}
/* fikirlerde tam eşit puan: yalnızca eşit kalan fikirler arasında dar oylama (kendi fikriniz listede çıkmaz) */
let fdarTaslak = [], fdarSig = '', fdarDuz = false;
function fikirDarEkrani() {
  const m = V.masa, d = V.secim.dar, benim = d.benim; const sig = m.id + d.adaylar.map(x => x.id).join(','); if (sig !== fdarSig) { fdarSig = sig; fdarTaslak = (benim || []).slice(); fdarDuz = false; }
  let h = `<div style="--ac:var(--gold)">` + ust('Dar oylama · fikirler', 'teal');
  if (benim && !fdarDuz) return ayarlaHtml(h + `<div class="card" style="text-align:center"><div class="okc">✓</div><h2 class="big">Dar oyunuz alındı</h2><div class="row wrap-f" style="justify-content:center;gap:8px;margin:12px 0">${benim.map(id => { const f = d.adaylar.find(x => x.id === id); return `<span class="pill"><b class="serif" style="font-size:20px">${f ? f.no : '?'}</b></span>`; }).join('')}</div><p class="muted">Dar oylama kapanana kadar değiştirebilirsiniz.</p><button class="btn ghost" data-a="fdar-degistir">Oyumu değiştir</button></div></div>`);
  const uygun = d.uygun || [], hak = d.hak;
  h += `<h1 class="big">Eşit puan: dar oylama</h1><p class="muted" style="margin:8px 0 0">Aşağıdaki fikirler <b class="goldl">tam aynı puanı</b> aldı. Masanın önerisi olarak <b class="goldl">${d.yer}</b> tanesi seçilecek. Daha çok istediğiniz <b class="goldl">${hak}</b> fikre dokunun (her fikre en çok 1 oy). Kendi fikriniz listede çıkmaz.</p><div style="margin-top:12px">`;
  for (const f of d.adaylar) { const kendi = !uygun.includes(f.id); h += `<div class="card flat ${fdarTaslak.includes(f.id) ? '' : ''}" data-a="${kendi ? '' : 'fdar-tile'}" data-id="${esc(f.id)}" style="margin-bottom:8px;display:flex;gap:12px;align-items:center;${fdarTaslak.includes(f.id) ? 'border:2px solid var(--gold)' : ''}${kendi ? ';opacity:.5' : ''}"><span class="serif" style="font-size:28px;font-weight:700;min-width:34px">${f.no}</span><span style="flex:1">${esc(f.ad)}${kendi ? ' <i class="muted">(sizin fikriniz)</i>' : ''}</span>${fdarTaslak.includes(f.id) ? '<span class="okc" style="margin:0">✓</span>' : ''}</div>`; }
  h += `</div><div class="dock"><div class="in"><div class="row" style="margin-bottom:10px"><div class="count"><b>${hak - fdarTaslak.length}</b><span class="muted">oy kaldı</span></div></div><button class="btn xl teal" data-a="fdar-gonder" ${fdarTaslak.length === hak ? '' : 'disabled'}>${fdarTaslak.length === hak ? 'Oylarımı gönder' : (hak - fdarTaslak.length) + ' oy daha kullanın'}</button></div></div></div>`;
  ayarlaHtml(h);
}
function oyEkrani(tur) {
  const m = V.masa, t = m.tur[tur];
  const sig = [m.id, tur, t.alan, t.oy, t.maxPer].join('|');
  if (sig !== draftSig) { draftSig = sig; draft = Object.assign({}, m.benim[tur] || {}); dirty = false; editing = false; }
  else if (!dirty && m.benim[tur] && !editing) draft = Object.assign({}, m.benim[tur]);
  const kullanilan = Object.values(draft).reduce((a, b) => a + b, 0), kalan = t.oy - kullanilan;
  const gonderildi = !!m.benim[tur] && !editing;
  const cls = tur === 'G' ? 'teal' : 'pink';
  let h = `<div style="--ac:${AC[tur]}">` + ust('Oylama · ' + TURAD[tur], cls);
  if (gonderildi) {
    const sec = Object.entries(m.benim[tur]).sort((a, b) => a[0] - b[0]);
    h += `<div class="card" style="text-align:center"><div class="okc">✓</div><h2 class="big">Oyunuz alındı</h2>
      <p class="muted">Oylama kapanana kadar değiştirebilirsiniz.</p>
      <div class="row wrap-f" style="justify-content:center;gap:8px;margin:12px 0">${sec.map(([n, c]) => `<span class="pill"><b class="serif" style="font-size:20px">${n}</b>${c > 1 ? ' × ' + c : ''}</span>`).join('')}</div>
      <button class="btn ghost" data-a="duzenle">Oylarımı değiştir</button></div>
      <div class="card flat" style="margin-top:14px"><div class="row"><span class="muted">Masanızda oy kullananlar</span><span class="sp"></span><b>${t.oyVeren || 0} / ${t.atanan || 0}</b></div>
      <div class="bar" style="margin-top:8px"><i style="width:${t.atanan ? Math.min(100, (t.oyVeren || 0) / t.atanan * 100) : 0}%"></i></div></div></div>`;
    return ayarlaHtml(h);
  }
  h += `<h1 class="big">Duvardaki numaralara oy verin</h1>
    <p class="muted" style="margin:8px 0 0">Flipchart'taki <b class="goldl">${t.alan}</b> numaralı post-it'ten beğendiklerinize dokunun. Toplam <b class="goldl">${t.oy}</b> oyunuz var${t.maxPer > 1 ? `, aynı post-it'e en fazla <b class="goldl">${t.maxPer}</b>` : ', aynı post-it\'e en fazla 1'} oy verebilirsiniz.${V.ayar.zorunluTam ? ' Tüm oylarınızı kullanın.' : ''}</p>
    <div class="tiles">`;
  for (let n = 1; n <= t.alan; n++) {
    const c = draft[n] || 0;
    h += `<div class="tile ${c ? 'on' : ''} ${c > 1 ? 'x' + Math.min(c, 3) : ''}" data-a="tile" data-n="${n}">${n}${c > 1 || (c && t.maxPer > 1) ? `<span class="n">${c}</span>` : ''}${c && t.maxPer > 1 ? `<span class="m" data-a="eksi" data-n="${n}">−</span>` : ''}</div>`;
  }
  h += `</div><div class="dock"><div class="in"><div class="row" style="margin-bottom:10px"><div class="count"><b>${kalan}</b><span class="muted">oy kaldı</span></div><span class="sp"></span><span class="muted">${kullanilan} / ${t.oy}</span></div>
    <div class="bar" style="margin-bottom:12px"><i style="width:${t.oy ? kullanilan / t.oy * 100 : 0}%"></i></div>
    <button class="btn xl ${cls}" data-a="gonder" ${(V.ayar.zorunluTam ? kalan !== 0 : kullanilan === 0) ? 'disabled' : ''}>${kalan === 0 ? 'Oylarımı gönder' : kalan + ' oy daha kullanın'}</button></div></div></div>`;
  ayarlaHtml(h);
}

/* ---------------------------------------------------------------- puanlama */
/* aktif önerinin slayt içeriği (telefonda): SWOT dayanağı + beş kısa alan */
function oneriDetay(f) {
  const AL = [['uygulama', 'Ne yapılacak?'], ['kapsam', 'Kimler için, nerede?'], ['katki', 'Beklenen öğrenme katkısı'], ['basari', 'Başarı göstergesi'], ['ilkadim', 'İlk adım ve sahiplik']];
  const sw = (f.swot || []).map(x => { const [k, ...r] = x.split(' · '); return `<div style="display:flex;gap:8px;font-size:14px;margin-top:4px"><b style="color:${/Z-/.test(k) ? 'var(--pink)' : 'var(--teal)'}">${esc(k)}</b><span>${esc(r.join(' · '))}</span></div>`; }).join('');
  return `<div class="card flat" style="margin-bottom:12px"><div class="eyebrow teal">Dayandığı SWOT bulguları</div>${sw || '<div class="muted" style="font-size:14px">(seçilmedi)</div>'}</div>` +
    AL.map(([k, et]) => { const m = ((f.alan || {})[k] || '').trim(); return `<div class="card flat" style="margin-bottom:10px"><div class="eyebrow">${et}</div><div style="margin-top:4px;font-size:16px;line-height:1.35;${m ? '' : 'opacity:.55;font-style:italic'}">${m ? esc(m) : '(henüz doldurulmadı)'}</div></div>`; }).join('');
}
function puanEkrani() {
  const f = V.sunum.fikir, ben = V.ben;
  if (pd.fikirId !== f.id) { pd = { fikirId: f.id, etki: null, uyg: null }; pdDirty = false; pdEdit = false; }
  if (!pdDirty && V.benimPuan && !pdEdit) { pd.etki = V.benimPuan.etki; pd.uyg = V.benimPuan.uyg; }
  const kendi = !V.ayar.kendiMasaPuan && f.masa === ben.masa;
  const gonderildi = !!V.benimPuan && !pdEdit;
  let h = `<div style="--ac:var(--gold)">` + ust(`Puanlama · Öneri ${f.no} / ${f.toplam}`);
  h += `<div class="card flat" style="margin-bottom:14px"><div class="row" style="align-items:flex-start;gap:14px"><div class="ideano">${f.no}</div><div class="ideaname" style="font-size:${f.ad.length > 60 ? 19 : 24}px">${esc(f.ad)}</div></div>
    <div class="row" style="margin-top:10px"><span class="badge off">Masa ${esc(f.masa)}</span><span class="sp"></span>${V.sunum.puanKapanis ? `<span class="cd" id="cd">--:--</span>` : ''}</div></div>`;
  const sk = siraKarti(), det = oneriDetay(f);
  if (kendi) {
    h += `<div class="card" style="--ac:var(--blue)"><h2 class="big" style="font-size:22px">Bu, kendi masanızın önerisi</h2><p class="muted">Kendi masanızın önerisini puanlamıyorsunuz. Bir sonraki öneriyi bekleyin.</p></div>${sk}${det}</div>`;
    return ayarlaHtml(h);
  }
  if (gonderildi) {
    h += `<div class="card" style="text-align:center"><div class="okc">✓</div><h2 class="big">Puanınız alındı</h2>
      <div class="row" style="justify-content:center;gap:10px;margin:12px 0"><span class="pill"><span class="muted">Etki</span> <b class="serif" style="font-size:22px">${V.benimPuan.etki}</b></span><span class="pill"><span class="muted">Uygulanabilirlik</span> <b class="serif" style="font-size:22px">${V.benimPuan.uyg}</b></span></div>
      <p class="muted">Puanlama kapanana kadar değiştirebilirsiniz. Diğer puanları göremezsiniz.</p><button class="btn ghost" data-a="pduzenle">Puanımı değiştir</button></div>
      <div class="card flat" style="margin-top:14px"><div class="row"><span class="muted">Puan veren</span><span class="sp"></span><b>${V.sunum.puanVeren} / ${V.sunum.katilimci}</b></div><div class="bar" style="margin-top:8px"><i style="width:${V.sunum.katilimci ? V.sunum.puanVeren / V.sunum.katilimci * 100 : 0}%"></i></div></div>${sk}${det}</div>`;
    return ayarlaHtml(h);
  }
  const olcek = (key, ad, alt, ac, cls) => `<div class="card flat" style="margin-bottom:12px"><div class="eyebrow ${cls === 't' ? 'teal' : ''}">${ad}</div><div class="muted" style="font-size:14px;margin-top:2px">${alt}</div>
    <div class="scale">${[1, 2, 3, 4, 5].map(i => `<div class="sc ${cls} ${pd[key] === i ? 'on' : ''}" data-a="${key}" data-v="${i}">${i}</div>`).join('')}</div>
    <div class="anc"><span>${ac[0]}</span><span>${ac[1]}</span></div></div>`;
  h += olcek('etki', 'Etki', 'Öğrenme kültürüne beklenen katkı', ['1 çok sınırlı', '5 çok yüksek'], '');
  h += olcek('uyg', 'Uygulanabilirlik', 'Yetki, kaynak, zaman ve süreç açısından kolaylık', ['1 çok zor', '5 çok kolay'], 't');
  h += `<div class="muted" style="font-size:13px;margin:-2px 0 14px">Etkisi yüksek ama zor bir önerinin etki puanını düşürmeyin; zorluğu uygulanabilirlikte puanlayın.</div>${sk}${det}
    <div class="dock"><div class="in"><button class="btn xl" data-a="pgonder" ${pd.etki && pd.uyg ? '' : 'disabled'}>${pd.etki && pd.uyg ? 'Puanımı gönder' : 'İki puanı da seçin'}</button></div></div></div>`;
  ayarlaHtml(h);
}

/* ------------------------------------------------------------ diğer ekranlar */
/* genel kurul sırası: masanın önerileri kaçıncı sırada, sıra ne zaman gelecek, sıradaki kim */
function siraKarti() {
  const s = V.sunum, bs = V.benimSira || []; if (!bs.length || !s) return '';
  const cur = s.fikir ? s.fikir.no : 0, ilk = bs.map(n => n + '.').join(' ve ');
  const sonraki = bs.find(n => n > cur);
  let d;
  if (!s.fikir) d = 'Sunumlar birazdan başlıyor.';
  else if (bs.includes(cur)) d = '<b style="color:var(--goldl)">' + (s.durum === 'hazir' ? 'Sıra masanızda: hazırlanın!' : s.durum === 'sunum' ? 'Şu an masanızın önerisi anlatılıyor.' : 'Masanızın önerisi puanlanıyor.') + '</b>';
  else if (!sonraki) d = 'Masanızın sunumları tamamlandı.';
  else { const k = sonraki - cur - (s.durum === 'hazir' || s.durum === 'sunum' || s.durum === 'puan' || s.durum === 'kapali' ? 1 : 0); d = k <= 0 ? '<b style="color:var(--goldl)">Sıra sizin masanızda: hazırlanın!</b>' : 'Masanızın sırası gelene kadar <b>' + k + '</b> öneri var.'; }
  const sd = s.siradaki ? `<div class="muted" style="font-size:13px;margin-top:4px">Sıradaki: Öneri ${s.siradaki.no} · Masa ${esc(s.siradaki.masa)}</div>` : '';
  return `<div class="card flat" style="margin-bottom:12px;border-left:4px solid var(--gold)"><div class="eyebrow" style="font-size:11px">Sunum sırası</div><div style="margin-top:4px">Masanızın önerileri <b>${ilk} sırada</b></div><div style="font-size:14px;margin-top:2px">${d}</div>${sd}</div>`;
}
function sunumEkrani() {
  const f = V.sunum.fikir, s = V.sunum;
  const bit = s.sunumBas + s.sunumSn * 1000;
  const durum = s.durum === 'sunum'
    ? `<div class="card flat" style="margin-bottom:12px;border:1.5px solid var(--teal)"><div class="row"><span class="badge ok">● Sunum sürüyor</span><span class="sp"></span><span class="muted" style="font-size:13px">Kalan süre</span><b class="serif" id="cd3" data-t="${bit}" style="font-size:26px;margin-left:8px">${mmss(Math.max(0, bit - now()))}</b></div><div class="muted" style="font-size:13px;margin-top:6px">Bittiğinde puanlama bu ekranda otomatik açılacak.</div></div>`
    : s.durum === 'kapali' ? `<div class="card flat" style="margin-bottom:12px"><span class="badge off">Puanlama kapandı</span><div class="muted" style="font-size:13px;margin-top:6px">Bir sonraki öneri bekleniyor.</div></div>`
    : `<div class="card flat" style="margin-bottom:12px"><span class="badge off">Sunum birazdan başlıyor</span></div>`;
  ayarlaHtml(`<div style="--ac:var(--gold)">` + ust(`Sunum · Öneri ${f.no} / ${f.toplam}`) + durum + siraKarti() +
    `<div class="card"><div class="ideano">${f.no}</div><div class="ideaname" style="margin-top:8px">${esc(f.ad)}</div>
    <div class="row" style="margin-top:12px"><span class="badge off">Masa ${esc(f.masa)}</span><span class="badge off">${esc(f.temaAd)}</span></div></div>` + oneriDetay(f) + `</div>`);
}
function sonucEkrani() {
  const mt = V.matris;
  let h = `<div style="--ac:var(--gold)">` + ust('Sonuç') + `<h1 class="big">Etki × Uygulanabilirlik matrisi</h1>
    <div class="mat card flat" style="margin:14px -6px;padding:8px">${matrisSVG(mt, { w: 640, h: 520, r: 17, fs: 11 })}</div>${matrisAciklama(mt)}<div class="col" style="margin-top:16px">`;
  for (const k of ['hizli', 'stratejik', 'sinirli', 'beklet']) h += ceyrekKart(k, mt.ceyrekler[k]);
  ayarlaHtml(h + '</div></div>');
}
function beklemeEkrani() {
  const m = V.masa;
  const metin = { hazirlik: 'Çalıştay birazdan başlıyor. Bu ekranı açık bırakın; oylama başladığında otomatik değişecek.', guclu: m.tur.G.durum === 'bitti' ? 'Güçlü yönler oylaması tamamlandı.' : 'Güçlü yönler oylaması masanızda henüz açılmadı. Açıldığında bu ekran değişecek.',
    zayif: m.tur.Z.durum === 'bitti' ? 'Zayıf yönler oylaması tamamlandı.' : 'Zayıf yönler oylaması masanızda henüz açılmadı. Açıldığında bu ekran değişecek.', fikir: (V.secim && V.secim.durum === 'bitti') ? (V.secim.onay ? 'Masanızın iki önerisi belli oldu. Şimdi bu öneriler sunuma hazırlanacak.' : 'Masanızın fikir sıralaması hazır. İlk ikisini kolaylaştırıcınız onaylayacak.') : 'Masalar proje fikirlerini yazıyor. Sunumlar başlayınca öneriler burada görünecek.', sunum: 'Bir sonraki öneri bekleniyor.', sonuc: 'Sonuçlar hazırlanıyor.' }[V.asama] || '';
  ayarlaHtml(`<div style="--ac:var(--gold)">` + ust('KÖK · Yönetici Çalıştayı') + `<div class="card"><div class="eyebrow">${esc(m.temaAd)}</div><h1 class="big" style="margin-top:8px">Hoş geldiniz</h1>
    <p class="muted">${esc(metin)}</p><div class="row" style="margin-top:6px"><span class="dot on"></span><span class="muted">Bağlısınız · ${esc(m.ad)}</span></div></div>${V.asama === 'sunum' ? siraKarti() : ''}${secimSonuc()}${temaBekle()}${temaBulgu('G')}${temaBulgu('Z')}</div>`);
}

/* ------------------------------------------- fikir girişi ve tema tablosu */
let ftab = 'fikir', fdraft = null, fdirty = false, fsw = null;
function swotSecenekleri() { // temanın iki masasının kapatılmış bulguları: [{kod, etiket, oy, tur}]
  const t = V.temaTablo, o = []; if (!t) return o;
  for (const tur of ['G', 'Z']) { const l = []; for (const m of t.masalar) for (const x of (m[tur] || [])) l.push({ kod: m.id + tur + '-' + x.no, etiket: x.etiket, oy: x.oy, tur }); l.sort((a, b) => b.oy - a.oy); o.push(...l); }
  return o;
}
const swEsit = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
function swotSecimHtml() {
  const sec = swotSecenekleri(); if (!sec.length) return '';
  const satir = x => `<div class="res" data-a="fsw" data-k="${esc(x.kod)}" style="align-items:flex-start;cursor:pointer;padding:10px 8px;border-radius:10px;${fsw.includes(x.kod) ? 'background:rgba(242,169,0,.16);outline:1.5px solid var(--gold)' : ''}"><span style="font-size:22px;min-width:28px">${fsw.includes(x.kod) ? '☑' : '☐'}</span><span class="no" style="color:${x.tur === 'G' ? 'var(--teal)' : 'var(--pink)'};font-size:16px;min-width:64px">${esc(x.kod)}</span><div class="b" style="font-size:15px">${x.etiket ? esc(x.etiket) : '<span class="muted">içerik giriliyor…</span>'}</div><span class="v" style="font-size:13px">${x.oy} oy</span></div>`;
  return `<div class="card flat" style="margin:12px 0"><div class="eyebrow">Bu fikir hangi SWOT maddelerine dayanıyor?</div><p class="muted" style="margin:6px 0 4px;font-size:14px">En az 1, en çok 3 madde seçin (<b class="goldl" id="swc">${fsw.length} / 3</b>). Seçtikleriniz fikrinizle birlikte sunumda görünür.</p>`
    + ['G', 'Z'].map(tur => { const l = sec.filter(x => x.tur === tur); return l.length ? `<div class="muted" style="margin:10px 0 2px;font-size:12px;letter-spacing:.1em;text-transform:uppercase">${tur === 'G' ? 'Güçlü yönler' : 'Zayıf yönler'}</div>` + l.map(satir).join('') : ''; }).join('') + '</div>';
}
/* anlatan kişi için: SWOT maddelerinin kodu ve metni (kendi fikri veya şu an anlatılan fikir) */
const swotMetinli = l => (l && l.length) ? `<div style="margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.06)"><div class="eyebrow teal" style="font-size:11px">Dayandığı SWOT maddeleri</div>${l.map(x => { const [k, ...r] = String(x).split(' · '); return `<div style="display:flex;gap:8px;margin-top:5px;font-size:14px;font-weight:400;line-height:1.3"><b style="color:${/Z-/.test(k) ? 'var(--pink)' : 'var(--teal)'};white-space:nowrap">${esc(k)}</b><span>${esc(r.join(' · '))}</span></div>`; }).join('')}</div>` : '';
const swotChip = l => (l && l.length) ? `<div style="margin-top:4px;font-size:13px;color:var(--goldl,#ffd166)">Dayanak: ${l.map(esc).join(' · ')}</div>` : '';
function temaBulgu(tur) { // temanın iki masasının (A ve B) bulguları tek listede, oy sayısına göre
  const t = V.temaTablo; if (!t) return '';
  const renk = tur === 'G' ? 'var(--teal)' : 'var(--pink)', cls = tur === 'G' ? 'teal' : 'pink', ad = tur === 'G' ? 'Güçlü yönler' : 'Zayıf yönler';
  const l = t.masalar.map(m => ({ id: m.id, r: m[tur] })), hazir = l.filter(x => x.r), bekleyen = l.filter(x => !x.r).map(x => x.id);
  if (!hazir.length) return '';
  const satir = [], en = Math.max(...hazir.map(x => x.r.length));
  for (let i = 0; i < en; i++) for (const x of hazir) if (x.r[i]) satir.push({ kod: x.id + (tur === 'G' ? 'G' : 'Z') + '-' + x.r[i].no, x: x.r[i], ben: x.id === V.masa.id });
  satir.sort((p, q) => q.x.oy - p.x.oy); // oy sayısına göre (eşitlikte masaların sırası korunur)
  return `<div class="card flat" style="--ac:${renk};margin-top:12px"><div class="row"><div class="eyebrow ${cls}">${ad}</div><span class="sp"></span><span class="muted" style="font-size:13px">${satir.length} bulgu · ${hazir.map(x => esc(x.id)).join(' + ')}</span></div>`
    + `<div class="res" style="border-top:0;padding-bottom:2px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut,#9fb0d3)"><span style="min-width:64px">Post-it No</span><div class="b">İçerik</div><span class="v" style="font-size:11px">Oy</span></div>`
    + satir.map(s => `<div class="res" style="align-items:flex-start"><span class="no" style="color:${renk};font-size:17px;min-width:64px">${esc(s.kod)}</span><div class="b" style="font-size:16px">${s.x.etiket ? esc(s.x.etiket) : '<span class="muted">Post-it ' + s.x.no + ' (içerik giriliyor…)</span>'}</div><span class="v muted" style="font-size:14px">${s.x.oy}</span></div>`).join('')
    + (bekleyen.length ? `<div class="muted" style="font-size:13px;margin-top:8px">${bekleyen.map(esc).join(', ')} masasının sonucu bekleniyor.</div>` : '') + '</div>';
}
function temaBekle() { // oylama kapandı ama kolaylaştırıcı henüz "Seansı kapat" demediyse bilgi ver
  const t = V.temaTablo, ben = t && t.masalar.find(x => x.id === V.masa.id); if (!ben) return '';
  const bekler = ['G', 'Z'].filter(k => V.masa.tur[k].durum === 'bitti' && !ben[k]).map(k => k === 'G' ? 'güçlü' : 'zayıf');
  return bekler.length ? `<div class="card flat" style="--ac:var(--gold);margin-top:12px"><div class="muted">Oylama tamamlandı. Kolaylaştırıcınız ${bekler.join(' ve ')} yönlerin son halini kaydedince, temanızın iki masasının birleşik bulguları burada görünecek.</div></div>` : '';
}
function temaTabloHtml() { return (temaBulgu('G') + temaBulgu('Z')) || '<div class="muted" style="margin-top:12px">Henüz sonuç yok.</div>'; }
function fikirGiris() {
  const sc = V.secim;
  if (fdraft === null || (!fdirty && sc.benimFikir !== null && fdraft !== sc.benimFikir)) fdraft = sc.benimFikir || '';
  if (fsw === null || (!fdirty && !swEsit(fsw, sc.benimSwot || []))) fsw = (sc.benimSwot || []).slice();
  let h = `<div style="--ac:var(--gold)">` + ust('Fikir geliştirme') + `<div class="row" style="gap:8px;margin-bottom:12px"><button class="btn sm ${ftab === 'fikir' ? '' : 'ghost'}" data-a="ftab" data-v="fikir">Fikrim</button><button class="btn sm ${ftab === 'tema' ? '' : 'ghost'}" data-a="ftab" data-v="tema">Tema tablosu</button></div>`;
  if (ftab === 'tema') return ayarlaHtml(h + `<h1 class="big" style="font-size:26px">${esc(V.masa.temaAd)}</h1><p class="muted" style="margin:6px 0 0">Fikirlerinizi bu bulgulara dayandırın (örn. 3AG-12: 3A masasının güçlü yön flipchart'ındaki 12 numaralı post-it; zayıf yön için 3AZ-12).</p>` + temaTabloHtml() + '</div>');
  const kay = sc.benimFikir && sc.benimFikir === fdraft && swEsit(fsw, sc.benimSwot || []), gerek = swotSecenekleri().length > 0, hazir = fdraft.trim() && (!gerek || fsw.length >= 1);
  h += `<h1 class="big" style="font-size:28px">Fikrinizi yazın</h1><p class="muted" style="margin:8px 0 12px">Tema tablosundan hareketle geliştirdiğiniz fikirlerden <b class="goldl">birini</b> seçin ve tek cümleyle, proje adı gibi yazın. Masadakiler fikrinizi sunumda ve puanlamada bu adla görecek.</p>
    <textarea id="fikir" maxlength="110" placeholder="Örn. Haftalık 15 dakikalık ayakta değerlendirme toplantısı" style="min-height:120px;font-size:19px">${esc(fdraft)}</textarea>
    <div class="row" style="margin:6px 0 4px"><span class="muted" style="font-size:13px" id="fcnt">${fdraft.length} / 110</span><span class="sp"></span>${kay ? '<span class="badge ok">✓ Kaydedildi</span>' : ''}</div>
    ${swotSecimHtml()}
    <div class="card flat" style="margin-bottom:12px"><div class="row"><span class="muted">Masanızda fikrini giren</span><span class="sp"></span><b>${sc.girilen} / ${sc.puanlayabilir + 1}</b></div></div>
    <div class="muted" style="font-size:13px">Sunumlar başlayana kadar fikrinizi değiştirebilirsiniz. Bulgu kodunu (örn. 3AG-12 ya da 3AZ-7) fikrinizi anlatırken söyleyin.</div>
    <div class="dock"><div class="in"><button class="btn xl" data-a="fsave" ${hazir && !kay ? '' : 'disabled'}>${kay ? 'Kaydedildi' : 'Fikrimi kaydet'}</button></div></div></div>`;
  ayarlaHtml(h);
}

/* ------------------------------------------------- masa içi: anında puan */
function olcekHtml(id, sec, kapali) {
  const ad = ['', 'Desteklemem', 'Zayıf', 'Orta', 'İyi', 'Çok güçlü'];
  return `<div class="scale">${[1, 2, 3, 4, 5].map(i => `<div class="sc ${sec === i ? 'on' : ''}" ${kapali ? 'style="opacity:.4;pointer-events:none"' : ''} data-a="sp" data-f="${id}" data-v="${i}">${i}</div>`).join('')}</div><div class="anc"><span>1 desteklemem</span><span>5 çok güçlü destek</span></div>`;
}
function secimSunum() {
  const sc = V.secim, verilen = Object.keys(sc.benimPuanlar).length, gereken = sc.fikirler.filter(f => !f.benim).length;
  let h = `<div style="--ac:var(--gold)">` + ust('Fikir puanlama') + `<h1 class="big" style="font-size:26px">Dinledikçe puanlayın</h1>
    <p class="muted" style="margin:6px 0 10px">Fikirler masada <b class="goldl">1 numaralıdan başlayarak sırayla</b> anlatılır. Dinledikçe her fikri 1 ile 5 arasında puanlayın; puanınızı kolaylaştırıcı puanlamayı bitirene kadar değiştirebilirsiniz.</p>
    <div class="card flat" style="margin-bottom:12px"><div class="row"><span class="muted">Puanladığınız fikir</span><span class="sp"></span><b>${verilen} / ${gereken}</b></div><div class="bar" style="margin-top:8px"><i style="width:${gereken ? verilen / gereken * 100 : 0}%"></i></div></div>`;
  for (const f of sc.fikirler) {
    const p = sc.benimPuanlar[f.id] || null;
    h += `<div class="card flat" style="margin-bottom:10px;padding:12px"><div class="row" style="align-items:flex-start;gap:10px"><span class="serif" style="font-size:26px;font-weight:700;color:var(--gold);min-width:30px">${f.no}</span><div style="flex:1;font-weight:700">${esc(f.ad)}${f.benim && f.swotM ? swotMetinli(f.swotM) : swotChip(f.swot)}</div>${!f.benim && !p ? '<span class="badge pk">puan yok</span>' : ''}</div>
      ${f.benim ? '<div class="muted" style="font-size:13px;margin-top:4px">Sizin fikriniz: puanı masadakiler verecek</div>' : `<div class="scale" style="gap:6px">${[1, 2, 3, 4, 5].map(i => `<div class="sc ${p === i ? 'on' : ''}" data-a="sp" data-f="${f.id}" data-v="${i}" style="font-size:22px">${i}</div>`).join('')}</div>`}</div>`;
  }
  ayarlaHtml(h + '<div class="muted" style="font-size:13px;margin:6px 0 40px">1 = desteklemem · 5 = çok güçlü destek</div></div>');
}
function detayEkrani() { // sıralama + yazar seçimi + öneri detay formu (öneri başına tek yazar)
  const d = V.detay, al = V.detayAlan;
  let h = `<div style="--ac:var(--gold)">` + ust('Öneriyi sunuma hazırlayın') + secimSonuc() +
    `<h1 class="big" style="font-size:26px;margin-top:16px">Önerinin detayını yazın</h1><p class="muted" style="margin:6px 0 12px">Masanız iki gruba ayrılır; her grup bir önerinin sunum içeriğini hazırlar. Her öneriyi grupta <b class="goldl">bir kişi</b> telefondan yazar, diğerleri sözlü katkı verir ve ekrandan izler. Yazacak kişi <b class="goldl">Yazmayı ben yapacağım</b> der. Bu içerik genel kurul slaydı olacak.</p>`;
  for (const f of d) {
    const yazar = f.takim[0] || '';
    h += `<div class="card" style="margin-bottom:14px;${f.benim ? 'border:2px solid var(--gold)' : ''}"><div class="eyebrow">Öneri ${f.sira}</div><div class="serif" style="font-size:22px;font-weight:700;margin:4px 0 6px">${esc(f.ad)}</div>
      <div class="muted" style="font-size:14px">${yazar ? '✍ Yazan: <b>' + esc(f.benim ? 'siz' : yazar) + '</b>' : 'Henüz yazan yok'} ${f.gonder ? '<span class="badge ok" style="margin-left:6px">✓ Gönderildi</span>' : ''}</div>`;
    if (f.benim) h += detayForm(f, al, f.gonder) +
      `<div class="row" style="margin-top:10px;gap:10px">${f.gonder ? `<button class="btn ghost" data-a="dac" data-f="${f.id}">Düzenlemeye aç</button>` : `<button class="btn" data-a="dgonder" data-f="${f.id}">Gönder</button>`}<button class="btn ghost" data-a="dbirak" data-f="${f.id}">Yazmayı bırak</button></div><div class="muted" style="font-size:12px;margin-top:6px">Yazmayı başkasına bırakmak için "Yazmayı bırak"a basın; o kişi kendi telefonundan devralır.</div>`;
    else if (!yazar) h += `<div style="margin-top:10px"><button class="btn sm" data-a="dkatil" data-f="${f.id}">${d.some(x => x.benim) ? 'Bu fikri yazmaya geçiyorum' : 'Yazmayı ben yapacağım'}</button></div>`;
    else h += `<div style="margin-top:10px" class="muted"><span class="badge warn">Şu an başkası yazıyor</span><div style="font-size:12px;margin-top:6px">Yazan kişi bırakırsa devralabilirsiniz. Aşağıda yazılanları izleyebilirsiniz.</div><button class="btn sm ghost" style="margin-top:8px" data-a="dkatil" data-f="${f.id}">Yazar çevrimdışıysa devral</button></div>` + detayForm(f, al, true);
    h += '</div>';
  }
  ayarlaHtml(h + '<div class="muted" style="font-size:13px;margin:6px 0 40px">Yazdıklarınız alandan çıktığınızda kaydedilir. Yazan kişi dışındakiler formu yalnızca okur.</div></div>');
}
function gozdenEkrani() {
  const sc = V.secim, acik = sc.gozdenAcik;
  let h = `<div style="--ac:var(--gold)">` + ust('Gözden geçirme') + `<div class="row"><h1 class="big" style="font-size:26px">Puanlarınızı gözden geçirin</h1></div>
    <div class="row" style="margin:6px 0 12px"><span class="muted">Gerekirse değiştirin; puan vermediklerinizi şimdi puanlayın.</span><span class="sp"></span>${sc.gozdenKapanis ? `<span class="cd" id="cd2" data-t="${sc.gozdenKapanis}">--:--</span>` : ''}</div>`;
  for (const f of sc.fikirler) {
    const p = sc.benimPuanlar[f.id] || null;
    h += `<div class="card flat" style="margin-bottom:10px;padding:12px"><div class="row" style="align-items:flex-start;gap:10px"><span class="no serif" style="font-size:26px;font-weight:700;color:var(--gold);min-width:30px">${f.no}</span><div style="flex:1;font-weight:700">${esc(f.ad)}</div>${!f.benim && !p ? '<span class="badge pk">puan yok</span>' : ''}</div>
      ${f.benim ? '<div class="muted" style="font-size:13px;margin-top:4px">Sizin fikriniz</div>' : `<div class="scale" style="gap:6px">${[1, 2, 3, 4, 5].map(i => `<div class="sc ${p === i ? 'on' : ''}" ${acik ? '' : 'style="opacity:.4;pointer-events:none"'} data-a="sp" data-f="${f.id}" data-v="${i}" style="font-size:22px">${i}</div>`).join('')}</div>`}</div>`;
  }
  ayarlaHtml(h + '</div>');
}
function secimSonuc() {
  const sc = V.secim; if (!sc || sc.durum !== 'bitti' || !sc.sonuc) return '';
  return `<div class="card flat" style="--ac:var(--gold);margin-top:14px"><div class="eyebrow">Masanızın fikir sıralaması</div><div style="display:flex;justify-content:space-between;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:8px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.12)"><span>Sıra · Fikir</span><span>Ortalama puan</span></div><div style="margin-top:4px">${sc.sonuc.map((x, i) => `<div class="res"><span class="no" style="color:${i < 2 ? 'var(--gold)' : 'var(--muted)'}">${x.no}</span><div class="b" style="font-size:16px">${esc(x.ad)}${x.benim ? ' <span class="muted">(sizin)</span>' : ''}</div><span class="v" style="font-size:14px">${fmt(x.ort)}</span></div>`).join('')}</div>
    <div class="muted" style="font-size:13px;margin-top:8px">${sc.onay ? 'İlk ikisi masanın önerisi olarak kaydedildi.' : 'İlk ikiyi kolaylaştırıcı onaylayacak.'}</div></div>`;
}

/* ------------------------------------------------------------------ olaylar */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a;
  if (a === 'tile' || a === 'eksi') {
    e.stopPropagation();
    const tur = ['G', 'Z'].find(t => V.masa.tur[t].durum === 'acik'); if (!tur) return;
    const t = V.masa.tur[tur], n = el.dataset.n, c = draft[n] || 0, kul = Object.values(draft).reduce((x, y) => x + y, 0);
    if (a === 'eksi') { if (c > 0) { c === 1 ? delete draft[n] : draft[n] = c - 1; } }
    else if (t.maxPer === 1) { c ? delete draft[n] : (kul < t.oy ? draft[n] = 1 : ret(el)); }
    else { if (c < t.maxPer && kul < t.oy) draft[n] = c + 1; else ret(el); }
    dirty = true; navigator.vibrate && navigator.vibrate(8); render();
  } else if (a === 'gonder') {
    const tur = ['G', 'Z'].find(t => V.masa.tur[t].durum === 'acik');
    try { await api(P('/oy'), { tur, alloc: draft }); dirty = false; editing = false; toast('Oyunuz kaydedildi'); navigator.vibrate && navigator.vibrate([15, 40, 15]); await yenile(); } catch (er) { toast(er.message, 1); }
  } else if (a === 'duzenle') { editing = true; dirty = false; render(); }
  else if (a === 'etki' || a === 'uyg') { pd[a] = parseInt(el.dataset.v, 10); pdDirty = true; navigator.vibrate && navigator.vibrate(8); render(); }
  else if (a === 'pgonder') {
    try { await api(P('/puan'), { fikirId: pd.fikirId, etki: pd.etki, uyg: pd.uyg }); pdDirty = false; pdEdit = false; toast('Puanınız kaydedildi'); navigator.vibrate && navigator.vibrate([15, 40, 15]); await yenile(); } catch (er) { toast(er.message, 1); }
  } else if (a === 'pduzenle') { pdEdit = true; pdDirty = false; render(); }
  else if (a === 'ftab') { ftab = el.dataset.v; render(); }
  else if (a === 'fsw') { const k = el.dataset.k, i = fsw.indexOf(k); if (i >= 0) fsw.splice(i, 1); else if (fsw.length < 3) fsw.push(k); else { ret(el); return; } fdirty = true; navigator.vibrate && navigator.vibrate(8); render(); }
  else if (a === 'dkatil' || a === 'dgonder' || a === 'dac' || a === 'dbirak') {
    try {
      if (a === 'dgonder') { const alan = {}; document.querySelectorAll('textarea[data-df^="' + el.dataset.f + '|"]').forEach(t => { alan[t.dataset.df.split('|')[1]] = t.value; }); await api(P('/detay'), { islem: 'kaydet', fikirId: el.dataset.f, alan }); } // son yazılan metin gönderimden önce kesin kaydedilir
      await api(P('/detay'), { islem: a === 'dkatil' ? 'katil' : a === 'dgonder' ? 'gonder' : a === 'dbirak' ? 'birak' : 'ac', fikirId: el.dataset.f }); if (a === 'dgonder') toast('Öneri içeriği gönderildi'); await yenile(); } catch (er) { toast(er.message, 1); await yenile(); }
  }
  else if (a === 'dar-tile') { const n = +el.dataset.n, i = darTaslak.indexOf(n); const d = V.masa.tur[V.masa.tur.G.dar && V.masa.tur.G.dar.durum === 'acik' ? 'G' : 'Z'].dar; if (i >= 0) darTaslak.splice(i, 1); else if (darTaslak.length < d.hak) darTaslak.push(n); render(); }
  else if (a === 'dar-gonder') { const tur = V.masa.tur.G.dar && V.masa.tur.G.dar.durum === 'acik' ? 'G' : 'Z'; try { await api(P('/dar-oy'), { tur, nos: darTaslak }); toast('Dar oyunuz alındı'); darDuz = false; await yenile(); } catch (er) { toast(er.message, 1); } }
  else if (a === 'fdar-tile') { const id = el.dataset.id, i = fdarTaslak.indexOf(id), d = V.secim.dar; if (i >= 0) fdarTaslak.splice(i, 1); else if (fdarTaslak.length < d.hak) fdarTaslak.push(id); render(); }
  else if (a === 'fdar-gonder') { try { await api(P('/dar-oy'), { tur: 'F', nos: fdarTaslak }); toast('Dar oyunuz alındı'); fdarDuz = false; await yenile(); } catch (er) { toast(er.message, 1); } }
  else if (a === 'fdar-degistir') { fdarDuz = true; fdarTaslak = ((V.secim.dar || {}).benim || []).slice(); render(); }
  else if (a === 'dar-degistir') { const tur = V.masa.tur.G.dar && V.masa.tur.G.dar.durum === 'acik' ? 'G' : 'Z'; darDuz = true; darTaslak = ((V.masa.darBenim || {})[tur] || []).slice(); render(); }
  else if (a === 'fsave') {
    try { await api(P('/fikir'), { ad: fdraft.trim(), swot: fsw }); fdirty = false; toast('Fikriniz kaydedildi'); navigator.vibrate && navigator.vibrate([15, 40, 15]); await yenile(); } catch (er) { toast(er.message, 1); }
  } else if (a === 'sp') {
    const fid = el.dataset.f, v = parseInt(el.dataset.v, 10);
    V.secim.benimPuanlar[fid] = v; navigator.vibrate && navigator.vibrate(10); render();
    try { await api(P('/secim-puan'), { fikirId: fid, puan: v }); } catch (er) { toast(er.message, 1); await yenile(); }
  }
});
document.addEventListener('input', e => {
  if (e.target.id !== 'fikir') return;
  fdraft = e.target.value; fdirty = true;
  const c = $('#fcnt'); if (c) c.textContent = fdraft.length + ' / 110';
  const b = $('[data-a="fsave"]'); if (b) { b.disabled = !(fdraft.trim() && (!swotSecenekleri().length || fsw.length >= 1)) || (V.secim.benimFikir === fdraft && swEsit(fsw, V.secim.benimSwot || [])); b.textContent = 'Fikrimi kaydet'; }
});
document.addEventListener('focusout', () => { setTimeout(() => { if (bekleyenRender && !(document.activeElement && ['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName))) { bekleyenRender = false; render(); } }, 200); });
function ret(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); navigator.vibrate && navigator.vibrate(30); }
setInterval(() => {
  const c = $('#cd'); if (c && V && V.sunum.puanKapanis) c.textContent = mmss(V.sunum.puanKapanis - now());
  const c3 = $('#cd3'); if (c3 && +c3.dataset.t) c3.textContent = mmss(Math.max(0, +c3.dataset.t - now()));
  const c2 = $('#cd2'); if (c2 && +c2.dataset.t) c2.textContent = mmss(+c2.dataset.t - now());
  const zb = $('#zb'); if (zb) { const k = +zb.dataset.t - now(); zb.textContent = k > 0 ? mmss(k) : 'Süre doldu'; zb.parentElement.classList.toggle('bit', k <= 0); }
}, 250);

document.addEventListener('change', async e => {
  const el = e.target; if (!el.dataset || !el.dataset.df) return; const [fid, k] = el.dataset.df.split('|');
  try { await api(P('/detay'), { islem: 'kaydet', fikirId: fid, alan: { [k]: el.value } }); toast('Kaydedildi'); await yenile(); } catch (er) { if (!(er.status === 409 && /Gönderildi/.test(er.message))) toast(er.message, 1); await yenile(); }
});
