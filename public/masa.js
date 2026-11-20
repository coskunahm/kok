const ID = location.pathname.split('/').filter(Boolean)[1];
const KEY = new URLSearchParams(location.search).get('k') || '';
const TOK = new URLSearchParams(location.search).get('t') || ''; // kolaylaştırıcı katılımcı olarak giriş
const app = $('#app');
let V = null, lastInput = 0;
const form = { G: null, Z: null, fikir: {} };
const Q = p => `/api/masa/${ID}${p}?${TOK ? 't=' + encodeURIComponent(TOK) : 'k=' + encodeURIComponent(KEY)}`;
const AC = { G: 'var(--teal)', Z: 'var(--pink)' }, AD = { G: 'Güçlü yönler', Z: 'Zayıf yönler' }, EB = { G: 'teal', Z: 'pink' };
const oneriOy = p => Math.min(15, Math.max(1, Math.round((p || 0) / 2)));
const oneriMax = (a, o) => (!a || !o) ? 2 : Math.max(2, Math.ceil(o / a));

async function yenile() {
  try { V = await api(Q('/view')); setSkew(V.t); } catch (e) { app.innerHTML = `<div class="card" style="--ac:var(--pink);margin-top:40px"><h2>Masa ekranı açılamadı</h2><p class="muted">${esc(e.message)} Bağlantıyı yönetim panelinden yeniden alın.</p></div>`; return; }
  for (const t of ['G', 'Z']) { const x = V.tur[t]; if (!form[t]) form[t] = { postit: x.postit || '', sunucu: x.postit || 0 }; else if (form[t].sunucu !== (x.postit || 0)) { form[t].sunucu = x.postit || 0; const ae = document.activeElement; if (!(ae && ae.dataset && ae.dataset.f === t + '.postit')) form[t].postit = x.postit || ''; } } // yönetim değiştirdiyse form güncellenir (kullanıcı yazmıyorsa)
  for (const f of V.fikirler) if (form.fikir[f.sira] === undefined) form.fikir[f.sira] = f.ad;
  render();
}
canli(yenile);

/* program: kolaylaştırıcı her adımın tahsis edilen süresini ve şu anki seansı görür */
const hm = dk => String(Math.floor(dk / 60)).padStart(2, '0') + '.' + String(Math.round(dk % 60)).padStart(2, '0');
const dkSimdi = () => { const d = new Date(now()); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
function oge(re) { return (V.program || []).find(x => re.test(x.ad)); }
function sure(re, etiket) {
  const x = oge(re); if (!x) return ''; const dk = dkSimdi(), simdi = dk >= x.b && dk < x.e;
  return `<span class="sure ${simdi ? 'simdi' : ''}">⏱ ${esc(etiket)} <b>${Math.round(x.e - x.b)} dk</b> <span class="saat">${hm(x.b)}–${hm(x.e)}</span></span>`;
}
const sureSatir = l => { const s = l.map(([re, et]) => sure(re, et)).join(''); return s ? `<div class="sureler">${s}</div>` : ''; };
function progSerit() { // şu an hangi seanstayız, ne kadar kaldı, sırada ne var
  const o = V.program || []; if (!o.length) return '';
  const dk = dkSimdi(), i = o.findIndex(x => dk >= x.b && dk < x.e), sn = o.findIndex(x => x.b > dk);
  if (i >= 0) { const x = o[i], nx = o[i + 1]; return `<div class="pserit"><span class="badge warn">Şu an</span><b class="pa">${esc(x.ad)}</b><span class="saat">${hm(x.b)}–${hm(x.e)}</span><b class="pk" id="ptk" data-e="${x.e}">${mmss((x.e - dk) * 60000)}</b><span class="muted">kalan</span>${nx ? `<span class="muted psn">Sıradaki: <b>${esc(nx.ad)}</b> ${hm(nx.b)}</span>` : ''}</div>`; }
  if (sn >= 0) return `<div class="pserit"><span class="badge off">${sn === 0 ? 'Program başlamadı' : 'Seans arası'}</span><span class="muted">Sıradaki:</span><b class="pa">${esc(o[sn].ad)}</b><span class="saat">${hm(o[sn].b)}</span><b class="pk">${mmss((o[sn].b - dk) * 60000)}</b></div>`;
  return '<div class="pserit"><span class="badge ok">Program tamamlandı</span></div>';
}
function turSureleri(tur, durum) { // SWOT turunun adımları ve süreleri
  const g = tur === 'G', t1 = g ? /^Tur 1 \(güçlü\)/ : /^Tur 2 \(zayıf\)/, t2 = g ? /^Tur 1: okuma/ : /^Tur 2: okuma/, oy = g ? /^Güçlü yan oylaması/ : /^Zayıf yan oylaması/, kp = g ? /^Güçlü yan: içerik/ : /^Zayıf yan: içerik/;
  return sureSatir(durum === 'hazir' ? [[t1, 'Brainwriting'], [t2, 'Okuma ve eleme'], [oy, 'Oylama'], [kp, 'İçerik ve seans kapanışı']] : durum === 'acik' ? [[oy, 'Oylama'], [kp, 'Ardından içerik ve seans kapanışı']] : [[kp, 'İçerik ve seans kapanışı']]);
}
function render() {
  if (!V) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && app.contains(a) && Date.now() - lastInput < 8000) { setTimeout(render, 1500); return; }
  const m = V.masa;
  let h = rolBar('kolay', TOK, m.id) + zamanBar() + progSerit() + `<div class="mh"><div><div class="eyebrow">KÖK · Kolaylaştırıcı paneli</div><h1 class="serif" style="margin-top:6px">${esc(m.ad)}</h1><div class="goldl serif" style="font-style:italic;font-size:20px;margin-top:4px">${esc(m.temaAd)}</div></div><span class="sp"></span>
    <span class="pill" style="--ac:var(--teal)"><i></i>${V.bagli} / ${V.katilimci} bağlı</span></div>
    <div class="g2">${kk('G', turKart('G'))}${kk('Z', turKart('Z'))}</div>${kk('secim', secimKart())}${kk('fikir', fikirKart())}${kk('detay', detayKart())}`;
  app.innerHTML = h; katlanir(); otoBoy();
}

/* aşama kutuları açılır/kapanır: aktif aşama açık, diğerleri yalnızca başlık (kaydırmayı azaltır); elle açıp kapatılan hatırlanır */
const kdurum = {};
const kk = (id, html) => html ? `<section data-kk="${id}">${html}</section>` : '';
function aktifKart() {
  const G = V.tur.G, Z = V.tur.Z, s = V.secim;
  if (!G.seansKapali) return 'G';
  if (!Z.seansKapali) return 'Z';
  if (!s.onay) return 'secim';
  return 'detay';
}
function katlanir() {
  const act = aktifKart();
  document.querySelectorAll('section[data-kk]').forEach(s => {
    const id = s.dataset.kk, card = s.firstElementChild; if (!card) return;
    const head = card.querySelector(':scope > .row'); if (!head) return;
    const body = document.createElement('div'); body.className = 'kbody';
    [...card.children].forEach(c => { if (c !== head) body.appendChild(c); });
    card.appendChild(body);
    head.classList.add('khead'); head.dataset.kid = id; head.insertAdjacentHTML('beforeend', '<span class="kok">▾</span>');
    card.classList.toggle('kapali', (kdurum[id] || (id === act ? 'a' : 'k')) !== 'a');
  });
}
document.addEventListener('click', e => {
  const h = e.target.closest('.khead'); if (!h) return; const card = h.parentElement; const kapali = card.classList.toggle('kapali');
  kdurum[h.dataset.kid] = kapali ? 'k' : 'a';
});
/* post-it içerik kutuları metne göre uzar/kısalır (gereksiz yer kaplamaz) */
function otoBoy(el) { (el ? [el] : [...document.querySelectorAll('textarea[data-e]')]).forEach(t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; }); }

function zamanBar() {
  const z = V.zaman; if (!z || !z.bitis || z.bitis <= now() - 20000) return '';
  const bit = z.bitis <= now();
  return `<div class="zbar ${bit ? 'bit' : ''}"><span>${esc(z.etiket || 'Kalan süre')}</span><b id="zb" data-t="${z.bitis}">${bit ? 'Süre doldu' : mmss(z.bitis - now())}</b></div>`;
}
function turKart(tur) {
  const t = V.tur[tur], f = form[tur], ac = AC[tur];
  const kilit = tur === 'Z' && V.tur.G.durum !== 'bitti' && t.durum === 'hazir';
  const rozet = t.durum === 'acik' ? '<span class="badge ok">Oylama açık</span>' : t.durum === 'bitti' ? '<span class="badge warn">Kapandı</span>' : '<span class="badge off">Hazırlanıyor</span>';
  let h = `<div class="card" style="--ac:${ac}"><div class="row"><span class="eyebrow ${EB[tur]}">${tur === 'G' ? '1 · ' : '2 · '}${AD[tur]}</span><span class="sp"></span>${rozet}</div>`;
  if (kilit) return h + `<p class="muted" style="margin-top:14px">Önce güçlü yönler oylaması yapılıp kapatılmalı. Sonra zayıf yönler açılır.</p></div>`;
  h += turSureleri(tur, t.durum);
  if (t.durum === 'hazir') {
    const p = +f.postit || 0, ozelAktif = t.ozel && p === t.postit;
    const oo = ozelAktif ? t.oy : oneriOy(p), om = ozelAktif ? t.maxPer : oneriMax(p, oo);
    const eksik = !(p >= 1) ? 'Flipchart\'taki post-it sayısını girin.' : '';
    h += `<p class="muted" style="margin:10px 0 0">Aynı şeyi söyleyen post-it'leri eledikten sonra flipchart'a kalan post-it'leri numaralayın ve sayısını girin.</p>
      <label class="f" style="margin-top:12px">Flipchart'taki post-it sayısı<input data-f="${tur}.postit" inputmode="numeric" value="${esc(f.postit)}" placeholder="örn. 28"></label>
      <div class="card flat" style="margin-top:12px;--ac:var(--gold)"><div class="eyebrow">Oy bilgisi (otomatik)</div>
        <div class="row wrap-f" style="gap:22px;margin-top:6px"><div><span class="serif goldl" style="font-size:40px;font-weight:700">${p ? oo : '–'}</span><span class="muted"> oy / kişi</span></div><div><span class="serif goldl" style="font-size:40px;font-weight:700">${p ? om : '–'}</span><span class="muted"> en fazla / post-it</span></div></div>
        <div class="muted" style="font-size:13px;margin-top:6px">Kişi başı oy, post-it sayısının yarısıdır (en çok 15). Katılımcılar bu oyları flipchart numaralarına verir; tümünü kullanmadan gönderemez.${ozelAktif ? ' <b class="warn">Bu masa için yönetim özel bir değer belirledi.</b>' : ''}</div></div>
      ${eksik ? `<div class="err">${esc(eksik)}</div>` : ''}<button class="btn xl ${EB[tur] === 'pink' ? 'pink' : 'teal'}" style="margin-top:14px" data-a="ac" data-t="${tur}" ${eksik ? 'disabled' : ''}>Oylamayı aç</button></div>`;
    return h;
  }
  const oran = t.atanan ? Math.min(100, t.oyVeren / t.atanan * 100) : 0;
  if (t.durum === 'acik') {
    return h + `<div class="row" style="margin:14px 0 8px"><div><span class="serif" style="font-size:54px;font-weight:700;color:var(--ac)">${t.oyVeren}</span><span class="muted" style="font-size:22px"> / ${t.atanan}</span></div><span class="muted">kişi oyunu gönderdi</span></div>
      <div class="bar"><i style="width:${oran}%"></i></div>
      ${oyKisiler(tur)}
      <div class="muted" style="margin-top:10px">${t.postit} post-it · kişi başı ${t.oy} oy · aynı post-it'e en fazla ${t.maxPer}</div>
      <button class="btn xl" style="margin-top:16px" data-a="kapat" data-t="${tur}">Oylamayı kapat ve sonucu göster</button></div>`;
  }
  const r = V.sonuc[tur];
  if (t.seansKapali && t.bulgular) {
    h += `<div class="muted" style="margin:8px 0">${t.oyVeren}/${t.atanan} kişi oy kullandı · ${r.toplamOy} oy</div><div class="eyebrow ${EB[tur]}" style="margin-bottom:6px">Seans kapandı · ${t.bulgular.length} bulgu kaydedildi</div>`
      + t.bulgular.map(x => `<div class="rs top"><span class="no">${x.no}</span><span class="v">${x.oy}</span><div style="flex:1;font-size:16px">${esc(x.metin)}</div></div>`).join('')
      + `<button class="btn ghost" style="margin-top:12px" data-a="seans-ac" data-t="${tur}">Seansı yeniden aç (düzenle)</button></div>`;
    return h;
  }
  const bh = bulguHesap(tur), max = Math.max(1, ...r.sirali.map(x => x.oy)), oyz = (V.kisiler || []).filter(k => !k.oy[tur]).map(k => esc(k.etiket));
  h += `<div class="muted" style="margin:8px 0">${t.oyVeren}/${t.atanan} kişi oy kullandı · ${r.toplamOy} oy${oyz.length ? ' · oy kullanmayanlar: ' + oyz.join(', ') : ''}</div>`;
  h += bh.kesin.concat(bh.adaylar).map(x => { const aday = bh.secimGerek && bh.adaylar.some(y => y.no === x.no), secili = bh.son.some(y => y.no === x.no);
    return `<div class="rs ${secili ? 'top' : ''}"><span class="no">${x.no}</span><div class="bar"><i style="width:${x.oy / max * 100}%"></i></div><span class="v">${x.oy}</span>
    <textarea data-e="${tur}.${x.no}" rows="1" maxlength="150" placeholder="Post-it içeriği (en çok 150 karakter)">${esc(bh.metin(x))}</textarea>${aday ? `<label class="sel"><input type="checkbox" data-sel="${tur}.${x.no}" ${secili ? 'checked' : ''}> seç</label>` : ''}</div>`; }).join('');
  h += darKutu(tur, bh) + `<div class="hint" id="bip-${tur}" style="margin-top:8px">${esc(bulguIpucu(bh))}</div>
    <div class="row wrap-f" style="margin-top:12px;gap:10px"><button class="btn ghost" data-a="yeniden" data-t="${tur}">Oylamayı yeniden aç</button><button class="btn ${EB[tur] === 'pink' ? 'pink' : 'teal'}" id="kapat-${tur}" data-a="seans" data-t="${tur}" ${bh.tamam ? '' : 'disabled'}>Seansı kapat</button></div></div>`;
  return h;
}
function oyKisiler(tur) { // masadakilerin oy durumu (oy vermeyenler önde)
  const l = V.kisiler || []; if (!l.length) return '';
  const s = l.slice().sort((a, b) => (a.oy[tur] - b.oy[tur]) || a.etiket.localeCompare(b.etiket, 'tr'));
  return `<div class="vk"><div class="muted" style="font-size:13px;margin:12px 0 4px">${l.filter(k => k.oy[tur]).length}/${l.length} kişi oyunu gönderdi · oy vermeyenler önde</div>` + s.map(k => `<span class="vc ${k.oy[tur] ? 'ok' : 'no'}">${k.oy[tur] ? '✓' : '○'} ${esc(k.etiket)}</span>`).join('') + '</div>';
}
const edits = { G: {}, Z: {} }, secimSet = { G: new Set(), Z: new Set() };
function bulguHesap(tur) { // ilk K: kesin girenler + eşitlikte masanın seçtikleri; her birinin içeriği dolu mu?
  const r = V.sonuc[tur], oylu = r.sirali.filter(x => x.oy > 0), K = Math.min(r.K, oylu.length);
  const esik = K ? oylu[K - 1].oy : 0, kesin = oylu.filter(x => x.oy > esik), adaylar = K ? oylu.filter(x => x.oy === esik) : [], yer = K - kesin.length;
  const sec = secimSet[tur]; for (const n of [...sec]) if (!adaylar.some(x => x.no === n)) sec.delete(n);
  const dar = V.tur[tur].dar, darSec = dar && dar.secilen;
  const secimGerek = adaylar.length > yer && !darSec, secilen = darSec ? adaylar.filter(x => darSec.includes(x.no)) : secimGerek ? adaylar.filter(x => sec.has(x.no)) : adaylar, son = kesin.concat(secilen);
  const metin = x => String(edits[tur][x.no] !== undefined ? edits[tur][x.no] : (x.etiket || '')).trim();
  const eksik = son.filter(x => !metin(x)).length;
  return { kesin, adaylar, yer, secimGerek, secilen, son, metin, eksik, tamam: son.length > 0 && eksik === 0 && (!secimGerek || secilen.length === yer) && !(dar && (dar.durum === 'acik' || dar.kuraGerek)) };
}
/* eşitlik: önce masa kendi çözer (konuşma/birleştirme/elle seçim); olmazsa dar oylama; yine eşitse kura */
function darKutu(tur, bh) {
  const t = V.tur[tur], d = t.dar; if (!bh.secimGerek && !d) return '';
  const ad = no => '<b>' + no + '</b>';
  if (!d) return `<div class="card flat" style="margin-top:10px;--ac:var(--gold)"><div class="eyebrow">Eşitlik</div>
    <div class="muted" style="font-size:14px;margin:4px 0 8px">Önce masa kendisi çözmeyi denesin: benzer post-it'leri birleştirin ya da konuşarak karar verip aşağıdan "seç" kutularını işaretleyin. Olmazsa <b class="goldl">dar oylama</b>: yalnızca eşit oy alan ${bh.adaylar.length} post-it arasında herkes ${Math.max(1, Math.min(bh.adaylar.length - 1, Math.ceil(bh.adaylar.length / 2)))} oy kullanır.</div>
    <button class="btn" data-a="dar-ac" data-t="${tur}">Dar oylamayı başlat</button></div>`;
  const kisiler = d.oyVeren + ' / ' + d.atanan;
  if (d.durum === 'acik') return `<div class="card flat" style="margin-top:10px;--ac:var(--gold)"><div class="eyebrow">Dar oylama açık</div>
    <div class="muted" style="font-size:14px;margin:4px 0">Aday post-it'ler: ${d.adaylar.map(ad).join(', ')} · kişi başı ${d.hak} oy · ${d.yer} kişi seçilecek</div>
    <div class="row" style="margin:8px 0"><span class="serif" style="font-size:34px;font-weight:700">${d.oyVeren}</span><span class="muted"> / ${d.atanan} kişi oy verdi</span></div>
    ${(d.sayim || []).map(x => `<span class="pill" style="margin:2px">${ad(x.no)} · ${x.oy}</span>`).join('')}
    <div class="row wrap-f" style="margin-top:10px;gap:8px"><button class="btn" data-a="dar-kapat" data-t="${tur}">Dar oylamayı kapat ve say</button><button class="btn ghost" data-a="dar-iptal" data-t="${tur}">Vazgeç</button></div></div>`;
  const say = (d.sayim || []).map(x => `<span class="pill" style="margin:2px">${ad(x.no)} · ${x.oy} oy</span>`).join('');
  if (d.kuraGerek) return `<div class="card flat" style="margin-top:10px;--ac:var(--pink)"><div class="eyebrow pink">Dar oylamada da eşitlik</div>
    <div class="muted" style="font-size:14px;margin:4px 0">${say}<br>${d.kuraGerek.kesin.length ? 'Kesin giren: ' + d.kuraGerek.kesin.map(ad).join(', ') + '. ' : ''}Eşit kalanlar: ${d.kuraGerek.adaylar.map(ad).join(', ')} · bunlardan ${d.kuraGerek.yer} tanesi <b>kura</b> ile seçilecek.</div>
    <button class="btn pink" data-a="dar-kura" data-t="${tur}">Kura çek</button> <button class="btn ghost" data-a="dar-iptal" data-t="${tur}">Dar oylamayı iptal et</button></div>`;
  return `<div class="card flat" style="margin-top:10px;--ac:var(--teal)"><div class="eyebrow teal">Eşitlik çözüldü</div>
    <div class="muted" style="font-size:14px;margin:4px 0">${say}<br>Seçilen: ${d.secilen.map(ad).join(', ')}${d.kura ? ' · <b class="pinkl">kura ile seçildi (' + d.kura.secilenler.map(ad).join(', ') + ')</b>' : ''}</div>
    <button class="btn sm ghost" data-a="dar-iptal" data-t="${tur}">Sonucu geri al</button></div>`;
}
function bulguIpucu(b) {
  if (V.tur[Object.keys(V.tur).find(k => V.tur[k].dar && (V.tur[k].dar.durum === 'acik' || V.tur[k].dar.kuraGerek)) || ''] ) return 'Dar oylama ya da kura tamamlanmadan seans kapatılamaz.';
  if (b.secimGerek && b.secilen.length !== b.yer) return 'Eşitlik var: ' + b.adaylar[0].oy + ' oylu ' + b.adaylar.length + ' post-it\'ten ' + b.yer + ' tanesini seçin (' + b.secilen.length + '/' + b.yer + '). Masada kısa bir konuşmayla karar verin.';
  if (b.eksik) return b.eksik + ' post-it\'in içeriğini yazın.';
  return b.son.length ? 'Hazır: "Seansı kapat" ile en çok oy alan ' + b.son.length + ' post-it sisteme kaydedilir.' : 'Hiç oy kullanılmadı.';
}
function bulguGuncelle(tur) {
  if (!V || !V.sonuc || !V.sonuc[tur]) return; const bh = bulguHesap(tur), k = $('#kapat-' + tur), ip = $('#bip-' + tur);
  if (k) k.disabled = !bh.tamam; if (ip) ip.textContent = bulguIpucu(bh);
}

let secSet = null, secSig = '';
function secimKart() {
  const s = V.secim, rz = { hazir: '<span class="badge off">Fikir girişi</span>', sunum: '<span class="badge ok">Sunum ve puanlama</span>', gozden: '<span class="badge warn">Gözden geçirme</span>', bitti: '<span class="badge warn">Sonuç</span>' }[s.durum];
  let h = `<div class="card" style="--ac:var(--blue);margin-top:16px"><div class="row"><span class="eyebrow blue">3 · Fikir seçimi</span><span class="sp"></span>${rz}</div>`;
  h += sureSatir(s.durum === 'hazir' ? [[/^Tema tablosu/, 'Tema tablosu'], [/^Sessiz brainstorming/, 'Sessiz brainstorming'], [/^Masada anlatma/, 'Masada anlatma ve puanlama']] : [[/^Masada anlatma/, 'Masada anlatma ve puanlama'], [/^Sunuma hazırlık/, 'Ardından sunuma hazırlık']]);
  const dugme = (i, ad, cls, ekstra) => `<button class="btn ${cls || ''}" data-a="sec" data-i="${i}" ${ekstra || ''}>${ad}</button>`;
  if (s.durum === 'hazir') {
    const eksik = s.kisiler.filter(k => !k.var).map(k => k.etiket);
    h += `<p class="muted" style="margin:10px 0 0">Tema tablosunu sesli okuyun. Aşağıdaki düğmeyle tablo masadaki herkesin telefonunda aynı anda açılır. Sonra herkes kendi hızında fikir geliştirip seçtiği <b class="goldl">birini</b> kendi telefonundan girer.</p>
      <div style="margin-top:10px">${s.tablo ? dugme('tablo-kapat', '✓ Tablo herkesin telefonunda açık (kapat)', 'ghost') : dugme('tablo-ac', 'Tema tablosunu herkesin telefonunda aç', 'teal')}</div>
      <div class="row" style="margin:14px 0 8px"><span class="serif" style="font-size:48px;font-weight:700;color:var(--ac)">${s.ham.length}</span><span class="muted" style="font-size:22px"> / ${s.kisiler.length}</span><span class="muted" style="margin-left:8px">kişi fikrini girdi</span></div>
      <div class="bar"><i style="width:${s.kisiler.length ? s.ham.length / s.kisiler.length * 100 : 0}%"></i></div>`;
    if (s.ham.length) h += `<div style="margin-top:12px">${s.ham.map(f => `<div class="fi" style="flex-wrap:wrap"><input data-bf="${f.id}" maxlength="110" value="${esc(f.ad)}"><div class="hint" style="width:100%;margin:2px 0 0">Dayanak: ${(f.swot || []).length ? f.swot.map(esc).join(' · ') : '<span class="warn">seçilmedi</span>'}</div></div>`).join('')}</div><div class="hint">Yazım hatası varsa buradan düzeltebilirsiniz.</div>`;
    if (eksik.length) h += `<div class="hint" style="margin-top:10px">Henüz girmeyenler: ${eksik.map(esc).join(', ')}</div>`;
    return h + `<div class="ctl" style="margin-top:14px">${dugme('baslat', 'Sunumları başlat (' + s.ham.length + ' fikir)', 'xl', s.ham.length < 2 ? 'disabled' : '')}</div></div>`;
  }
  if (s.durum === 'sunum') {
    const toplamP = Object.values(s.puanSay || {}).reduce((x, y) => x + y, 0), olasi = s.toplam * s.puanlayabilir;
    h += `<p class="muted" style="margin:10px 0 0">Katılımcıların telefonunda <b class="goldl">tüm fikirler ve puan skalası</b> açık. Fikirler masada <b class="goldl">1 numaralıdan başlayarak sırayla</b> anlatılır; herkes (siz de) <b class="goldl">dinledikçe puanlar</b>. Anlatımı yürütmek için panelde işlem yapmanız gerekmez; telefonunuzdan siz de puan verin, tümü bitince "Puanlamayı sonlandır" deyin.</p>
      <div class="row" style="margin:14px 0 6px"><span class="serif" style="font-size:44px;font-weight:700;color:var(--teall)">${toplamP}</span><span class="muted" style="font-size:20px"> / ${olasi} puan verildi</span></div>
      <div class="bar" style="margin-bottom:6px"><i style="width:${olasi ? toplamP / olasi * 100 : 0}%"></i></div><div class="muted" style="font-size:13px;margin-bottom:12px">${s.toplam} fikir · her katılımcı kendi fikri dışındakileri puanlar</div>
      <div class="row wrap-f ctl">${dugme('hesapla', 'Puanlamayı sonlandır ve sırala', 'teal')}</div></div>`;
    return h;
  }
  if (s.durum === 'gozden') {
    return h + `<p class="muted" style="margin:10px 0 0">Katılımcılar telefonlarında tüm fikirleri ve kendi puanlarını görüyor; değiştirebilir veya eksikleri puanlayabilir.</p>
      <div class="row" style="margin:14px 0"><span class="serif" style="font-size:44px;font-weight:700;color:var(--goldl)" id="cd3" data-t="${s.gozdenKapanis || 0}">${s.gozdenKapanis ? '--:--' : 'süresiz'}</span></div><div class="row wrap-f ctl">${dugme('hesapla', 'Sonucu hesapla')}${dugme('yeniden', 'Baştan başla', 'ghost sm')}</div></div>`;
  }
  /* bitti */
  const sig = s.sonuc.map(x => x.id).join(',') + s.onay + JSON.stringify((s.dar || {}).secilen || ''); if (sig !== secSig) { secSig = sig; secSet = new Set((s.onay || (s.dar && s.dar.secilen) || s.sonuc.slice(0, V.masa.fikirSayisi).map(x => x.id))); }
  h += fikirDarKutu(s);
  h += `<p class="muted" style="margin:10px 0 6px">Puanlayanın kendi ölçeği düzeltilerek sıralandı. Masanın önerisi olacak fikirleri işaretleyin (en fazla ${V.masa.fikirSayisi}).${s.yakin ? ' <b class="warn">2. ve 3. fikir neredeyse eşit; masayla kısaca konuşun.</b>' : ''}</p><div>`;
  for (const x of s.sonuc) h += `<label class="sr"><input type="checkbox" data-sc="${x.id}" ${secSet.has(x.id) ? 'checked' : ''}><span class="serif sn">${x.no}</span><span class="sa">${esc(x.ad)}</span><span class="so">${fmt(x.ort)}<small>${x.n} kişi</small></span></label>`;
  h += `</div><div class="hint" style="margin:8px 0">Çeşitlilik: seçilen fikirler aynı hedef kitle + aynı mekanizmaysa ikincisi yerine sıradaki fikri işaretleyin.</div><div class="row wrap-f ctl">${dugme('onayla', s.onay ? '✓ Kaydedildi; yeniden kaydet' : 'Masanın önerisi olarak kaydet', s.onay ? 'ghost' : 'teal')}${dugme('yeniden', 'Baştan başla', 'ghost sm')}</div></div>`;
  return h;
}

function fikirDarKutu(s) { // fikirlerde TAM eşit puan: önce masa çözsün, olmazsa dar oylama, yine eşitse kura
  const d = s.dar, ad = x => '<b>' + x.no + '</b>';
  const fk = id => { const f = (s.sonuc || []).find(y => y.id === id); return f ? f : { no: '?', id }; };
  if (!d) {
    if (!s.esit) return '';
    const n = s.esit.adaylar.length, hak = Math.max(1, Math.min(n - 1, Math.ceil(n / 2)));
    return `<div class="card flat" style="margin:10px 0;--ac:var(--gold)"><div class="eyebrow">Tam eşit puan</div><div class="muted" style="font-size:14px;margin:4px 0 8px">${s.esit.adaylar.map(id => ad(fk(id))).join(', ')} numaralı ${n} fikir <b>tam aynı puanı</b> aldı; bunlardan ${s.esit.yer} tanesi masanın önerisi olacak. Önce masa kendisi konuşup karar versin (aşağıdan işaretleyin). Olmazsa <b class="goldl">dar oylama</b>: yalnızca bu fikirler arasında herkes ${hak} oy kullanır (kendi fikrine oy veremez).</div><button class="btn" data-a="sec" data-i="dar-ac">Dar oylamayı başlat</button></div>`;
  }
  const say = (d.sayim || []).map(x => `<span class="pill" style="margin:2px">${ad(x)} · ${x.oy}</span>`).join('');
  if (d.durum === 'acik') return `<div class="card flat" style="margin:10px 0;--ac:var(--gold)"><div class="eyebrow">Dar oylama açık</div><div class="muted" style="font-size:14px;margin:4px 0">Aday fikirler: ${d.adaylar.map(ad).join(', ')} · kişi başı ${d.hak} oy · ${d.yer} fikir seçilecek</div>
    <div class="row" style="margin:8px 0"><span class="serif" style="font-size:34px;font-weight:700">${d.oyVeren}</span><span class="muted"> / ${d.atanan} kişi oy verdi</span></div>${say}
    <div class="row wrap-f" style="margin-top:10px;gap:8px"><button class="btn" data-a="sec" data-i="dar-kapat">Dar oylamayı kapat ve say</button><button class="btn ghost" data-a="sec" data-i="dar-iptal">Vazgeç</button></div></div>`;
  if (d.kuraGerek) return `<div class="card flat" style="margin:10px 0;--ac:var(--pink)"><div class="eyebrow pink">Dar oylamada da eşitlik</div><div class="muted" style="font-size:14px;margin:4px 0">${say}<br>${d.kuraGerek.kesin.length ? 'Kesin giren: ' + d.kuraGerek.kesin.map(ad).join(', ') + '. ' : ''}Eşit kalanlar: ${d.kuraGerek.adaylar.map(ad).join(', ')} · bunlardan ${d.kuraGerek.yer} tanesi <b>kura</b> ile seçilecek.</div>
    <button class="btn pink" data-a="sec" data-i="dar-kura">Kura çek</button> <button class="btn ghost" data-a="sec" data-i="dar-iptal">Dar oylamayı iptal et</button></div>`;
  return `<div class="card flat" style="margin:10px 0;--ac:var(--teal)"><div class="eyebrow teal">Eşitlik çözüldü</div><div class="muted" style="font-size:14px;margin:4px 0">${say}<br>Seçilen: ${(d.secilen || []).map(id => ad(fk(id))).join(', ')}${d.kura ? ' · <b class="pinkl">kura ile seçildi (' + d.kura.secilenler.map(id => ad(fk(id))).join(', ') + ')</b>' : ''} · aşağıda işaretlendi; "Masanın önerisi olarak kaydet" deyin.</div>
    <button class="btn sm ghost" data-a="sec" data-i="dar-iptal">Sonucu geri al</button></div>`;
}
function detayKart() { // 5 · öneri detayları: izleme (yazma işi katılımcı ekranından yapılır; burada yalnızca durum ve yazar yönetimi)
  const d = V.detay; if (!d) return '';
  let h = `<div class="card" style="--ac:var(--teal);margin-top:16px"><div class="row"><span class="eyebrow teal">5 · Önerilerin detayı (sunum içeriği)</span><span class="sp"></span><span class="badge ${d.every(f => f.gonder) ? 'ok' : 'warn'}">${d.filter(f => f.gonder).length}/${d.length} gönderildi</span></div>
    ${sureSatir([[/^Sunuma hazırlık/, 'Sunuma hazırlık']])}<p class="muted" style="margin:10px 0 0">Her öneriyi grupta <b class="goldl">bir kişi (yazar)</b> kendi telefonundan yazıp gönderir. Burada yalnızca izlersiniz. Yazmayı siz üstlenecekseniz üstteki <b class="goldl">Katılımcı ekranı</b> düğmesiyle geçip önerinin altında "Yazmayı ben yapacağım" deyin. Yazar ayrılırsa ya da çevrimdışı kalırsa "Yazarı serbest bırak"ı kullanın.</p>`;
  const al = V.detayAlan || [];
  for (const f of d) {
    const dolu = al.filter(a => (f.alan[a.k] || '').trim()).length;
    h += `<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.1)"><div class="row" style="align-items:flex-start;gap:8px"><b style="flex:1">Öneri ${f.sira}: ${esc(f.ad)}</b>${f.gonder ? '<span class="badge ok">✓ gönderildi</span>' : '<span class="badge warn">taslak</span>'}</div>
      <div class="muted" style="font-size:14px;margin:6px 0">✍ Yazan: ${f.takim.length ? '<b>' + f.takim.map(esc).join(', ') + '</b>' : 'henüz kimse yazmıyor'} · Alanlar: <b>${dolu}/${al.length}</b> dolu</div>
      <div class="row wrap-f" style="gap:8px">${f.takim.length ? `<button class="btn sm ghost" data-a="dbirak" data-f="${esc(f.id)}">Yazarı serbest bırak</button>` : ''}${f.gonder ? `<button class="btn sm ghost" data-a="dac" data-f="${esc(f.id)}">Düzenlemeye aç</button>` : ''}</div>
      <details class="dd" data-did="${esc(f.id)}" ${dacik.has(f.id) ? 'open' : ''} style="margin-top:8px"><summary style="cursor:pointer;font-size:14px" class="muted">Yazılanı göster (salt okunur)</summary>${al.map(a => { const t = (f.alan[a.k] || '').trim(); return `<div style="margin-top:8px"><div class="eyebrow" style="font-size:11px">${esc(a.ad)}</div><div style="${t ? '' : 'opacity:.5;font-style:italic'}">${t ? esc(t) : '(henüz yazılmadı)'}</div></div>`; }).join('')}</details></div>`;
  }
  return h + '</div>';
}
const dacik = new Set();
function fikirKart() {
  const m = V.masa, kilit = m.fikirKilit;
  let h = `<div class="card" style="--ac:var(--gold);margin-top:16px"><div class="row"><span class="eyebrow">4 · Masanın nihai proje fikirleri <span class="muted" style="letter-spacing:0;text-transform:none;font-weight:400">(isteğe bağlı)</span></span><span class="sp"></span>${kilit ? '<span class="badge warn">Kilitli</span>' : ''}</div>
    ${sureSatir([[/^Sunuma hazırlık/, 'Sunuma hazırlık']])}
    <p class="muted" style="margin:10px 0 0">Önerilerin adı genel kurul slaydında başlık olur. <b class="goldl">Ad uygunsa olduğu gibi bırakabilirsiniz; değiştirmek zorunda değilsiniz</b> ve bu adımı yapmadan devam edebilirsiniz. Düzeltmek isterseniz tek cümleyle, proje adı gibi yazıp kaydedin.</p>`;
  for (let i = 1; i <= m.fikirSayisi; i++) {
    const f = V.fikirler.find(x => x.sira === i);
    h += `<div class="fi"><span class="n">${f && f.no != null ? f.no : i}</span><input data-fk="${i}" maxlength="110" placeholder="Fikir ${i} adı" value="${esc(form.fikir[i] || '')}" ${kilit ? 'disabled' : ''}>
      <button class="btn sm teal" data-a="fkaydet" data-i="${i}" ${kilit ? 'disabled' : ''}>Kaydet</button></div>
      ${f && f.ad ? `<div class="hint" style="margin-left:54px">${f.ad === form.fikir[i] ? '✓ Kayıtlı' : 'Kayıtlı: ' + esc(f.ad)}</div>` : ''}`;
  }
  return h + '</div>';
}

document.addEventListener('input', e => {
  const el = e.target; lastInput = Date.now();
  if (el.dataset.f) { const [t, k] = el.dataset.f.split('.'); form[t][k] = el.value.replace(/[^\d]/g, ''); clearTimeout(window.__rt); window.__rt = setTimeout(() => { lastInput = 0; render(); }, 700); }
  else if (el.dataset.fk) form.fikir[el.dataset.fk] = el.value;
  else if (el.dataset.e) { const [t, no] = el.dataset.e.split('.'); edits[t][+no] = el.value; otoBoy(el); bulguGuncelle(t); }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.sel) { const [t, no] = el.dataset.sel.split('.'); if (el.checked) secimSet[t].add(+no); else secimSet[t].delete(+no); lastInput = 0; render(); return; }
  if (el.dataset.df) { const [fid, k] = el.dataset.df.split('|'); try { V = await api(Q('/detay'), { islem: 'kaydet', fikirId: fid, alan: { [k]: el.value } }); toast('Kaydedildi'); lastInput = 0; render(); } catch (er) { toast(er.message, 1); } return; }
  if (!el.dataset.e) return; const [t, no] = el.dataset.e.split('.');
  try { await api(Q('/etiket'), { tur: t, no: +no, ad: el.value }); toast('İçerik kaydedildi'); } catch (er) { toast(er.message, 1); }
});
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el) return; const a = el.dataset.a, t = el.dataset.t;
  try {
    if (a === 'ac') { const f = form[t]; V = await api(Q('/tur'), { tur: t, islem: 'ac', postit: +f.postit || 0 }); toast('Oylama açıldı'); lastInput = 0; render(); }
    else if (a === 'seans') { const bh = bulguHesap(t), metinler = {}; bh.son.forEach(x => { metinler[x.no] = bh.metin(x); }); V = await api(Q('/tur'), { tur: t, islem: 'seans-kapat', secim: [...secimSet[t]], metinler }); toast('Seans kapandı: bulgular kaydedildi'); lastInput = 0; render(); }
    else if (a === 'seans-ac') { V = await api(Q('/tur'), { tur: t, islem: 'seans-ac' }); lastInput = 0; render(); }
    else if (a === 'dar-ac') { if (!confirm('Eşit oy alan post-it\'ler arasında dar oylama başlatılsın mı? Katılımcıların telefonunda açılır.')) return; V = await api(Q('/tur'), { tur: t, islem: 'dar-ac' }); toast('Dar oylama açıldı'); lastInput = 0; render(); }
    else if (a === 'dar-kapat') { if (!confirm('Dar oylama kapatılıp sayılsın mı?')) return; V = await api(Q('/tur'), { tur: t, islem: 'dar-kapat' }); lastInput = 0; render(); }
    else if (a === 'dar-iptal') { if (!confirm('Dar oylama iptal edilsin mi?')) return; V = await api(Q('/tur'), { tur: t, islem: 'dar-iptal' }); lastInput = 0; render(); }
    else if (a === 'dar-kura') { V = await api(Q('/tur'), { tur: t, islem: 'dar-kura' }); toast('Kura çekildi'); lastInput = 0; render(); }
    else if (a === 'kapat') { if (!confirm('Oylama kapatılsın mı? Katılımcılar artık oy veremez.')) return; V = await api(Q('/tur'), { tur: t, islem: 'kapat' }); lastInput = 0; render(); }
    else if (a === 'yeniden') { V = await api(Q('/tur'), { tur: t, islem: 'yeniden-ac' }); lastInput = 0; render(); }
    else if (a === 'sec') {
      const i = el.dataset.i, body = { islem: i };
      if (i === 'onayla') { body.secilen = [...secSet]; const sn = V.secim.sonuc || []; if (body.secilen.some(id => (sn.find(x => x.id === id) || { n: 1 }).n === 0)) { if (!confirm('Seçilen fikirlerden bazıları hiç puan almadı. Yine de onaylansın mı?')) return; body.zorla = true; } }
      if (i === 'yeniden' && !confirm('Seçim baştan başlayacak; verilen puanlar silinir. Emin misiniz?')) return;
      if (i === 'dar-ac' && !confirm('Tam eşit puan alan fikirler arasında dar oylama başlatılsın mı? Katılımcıların telefonunda açılır.')) return;
      if (i === 'dar-iptal' && !confirm('Dar oylama iptal edilsin mi?')) return;
      if (i === 'dar-kapat' && !confirm('Dar oylama kapatılıp sayılsın mı?')) return;
      if (i === 'hesapla' && !confirm('Puanlama sonlandırılıp fikirler puanlarına göre sıralansın mı? Masadaki herkes sıralamayı görecek.')) return;
      V = await api(Q('/secim'), body); if (i === 'yeniden') secSig = ''; toast('Tamam'); lastInput = 0; render();
    }
    else if (a === 'dgonder' || a === 'dac' || a === 'dbirak') { V = await api(Q('/detay'), { islem: a === 'dgonder' ? 'gonder' : a === 'dbirak' ? 'birak' : 'ac', fikirId: el.dataset.f }); toast('Tamam'); lastInput = 0; render(); }
    else if (a === 'fkaydet') { const i = el.dataset.i; await api(Q('/fikir'), { sira: +i, ad: form.fikir[i] || '' }); toast('Fikir kaydedildi'); await yenile(); }
  } catch (er) { toast(er.message, 1); }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.sc) { if (el.checked) { if (secSet.size >= V.masa.fikirSayisi) { el.checked = false; toast('En fazla ' + V.masa.fikirSayisi + ' fikir seçilebilir', 1); return; } secSet.add(el.dataset.sc); } else secSet.delete(el.dataset.sc); }
  else if (el.dataset.bf) { try { V = await api(Q('/bfikir'), { id: el.dataset.bf, ad: el.value }); toast('Fikir güncellendi'); lastInput = 0; render(); } catch (er) { toast(er.message, 1); } }
});
setInterval(() => { const c = $('#cd3'); if (c && +c.dataset.t) c.textContent = mmss(+c.dataset.t - now()); const p = $('#ptk'); if (p) { const k = (+p.dataset.e - dkSimdi()) * 60000; p.textContent = mmss(k); p.classList.toggle('az', k < 120000); } }, 250);

setInterval(() => { const zb = $('#zb'); if (zb) { const k = +zb.dataset.t - now(); zb.textContent = k > 0 ? mmss(k) : 'Süre doldu'; zb.parentElement.classList.toggle('bit', k <= 0); } }, 250);

document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.did) { if (d.open) dacik.add(d.dataset.did); else dacik.delete(d.dataset.did); } }, true);
