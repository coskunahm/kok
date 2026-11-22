const ID = location.pathname.split('/').filter(Boolean)[1];
const KEY = new URLSearchParams(location.search).get('k') || '';
const TOK = new URLSearchParams(location.search).get('t') || ''; // moderatör girişi (katılımcı değildir)
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

/* program: moderatör her adımın tahsis edilen süresini ve şu anki seansı görür */
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
/* ---------------------------------------------------------------- moderatör ekranı: sürecin akışına göre, tek odak kartı */
const ASM = ['hazirlik', 'guclu', 'zayif', 'fikir', 'sunum', 'sonuc'];
const detAcik = new Set(); // elle açılan <details> kutuları yenilemede açık kalır
const gor = new Set(), devam = new Set(); // elle açılan tamamlanmış adımlar / yönetici başlatmadan devam edilen adımlar
function adimlar() {
  const s = V.secim, d = V.detay, L = [];
  const tur = (t, grup, asama) => { const x = V.tur[t];
    L.push({ id: t + '1', grup, ad: 'Post-it sayısı', asama, tur: t, bitti: x.durum !== 'hazir' });
    L.push({ id: t + '2', grup, ad: 'Oylama', asama, tur: t, bitti: x.durum === 'bitti' });
    L.push({ id: t + '3', grup, ad: 'İçerik ve kapanış', asama, tur: t, bitti: !!x.seansKapali }); };
  tur('G', 'Güçlü yan', 'guclu'); tur('Z', 'Zayıf yan', 'zayif');
  L.push({ id: 'F1', grup: 'Fikirler', ad: 'Fikir girişi', asama: 'fikir', bitti: s.durum !== 'hazir' });
  L.push({ id: 'F2', grup: 'Fikirler', ad: 'Anlatma ve puanlama', asama: 'fikir', bitti: s.durum === 'bitti' });
  L.push({ id: 'F3', grup: 'Fikirler', ad: 'Masanın önerileri', asama: 'fikir', bitti: !!s.onay });
  L.push({ id: 'D', grup: 'Detay', ad: 'Öneri detayı', asama: 'fikir', bitti: !!(d && d.length && d.every(f => f.gonder)) });
  return L;
}
function render() {
  if (!V) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && app.contains(a) && Date.now() - lastInput < 8000) { setTimeout(render, 1500); return; }
  const m = V.masa, L = adimlar(), cur = L.find(x => !x.bitti) || null, ai = ASM.indexOf(V.asama);
  let h = rolBar('mod', TOK, m.id) + zamanBar() + progSerit() + `<div class="mh"><div><div class="eyebrow">KÖK · Moderatör paneli</div><h1 class="serif" style="margin-top:6px">${esc(m.ad)}</h1><div class="goldl serif" style="font-style:italic;font-size:19px;margin-top:4px">${esc(m.temaAd)}</div></div><span class="sp"></span>
    <span class="pill" style="--ac:var(--teal)"><i></i>${V.bagli} / ${V.katilimci} katılımcı bağlı</span></div>` + serit(L, cur);
  if (!cur) h += sonKart();
  else if (ASM.indexOf(cur.asama) > ai && !devam.has(cur.id)) h += beklemeKart(cur);
  else h += karti(cur, true);
  const acik = L.filter(x => gor.has(x.id) && x !== cur);
  for (const x of acik) h += karti(x, false);
  h += ozetListe(L, cur);
  app.innerHTML = h + cikisAlt('a'); otoBoy();
}
const ASAMAAD = { guclu: 'Güçlü yan turu', zayif: 'Zayıf yan turu', fikir: 'Fikir geliştirme', sunum: 'Genel kurul', sonuc: 'Sonuç' };
function serit(L, cur) { // grup grup ilerleme: ✓ tamam · ● şu an · ○ sırada
  const g = []; L.forEach(x => { let o = g.find(y => y.ad === x.grup); if (!o) g.push(o = { ad: x.grup, a: [] }); o.a.push(x); });
  return `<div class="strip">${g.map(o => { const n = o.a.filter(x => x.bitti).length, tam = n === o.a.length, simdi = cur && o.a.includes(cur);
    return `<div class="sc ${tam ? 'ok' : simdi ? 'on' : ''}"><b>${tam ? '✓' : simdi ? '●' : '○'} ${esc(o.ad)}</b><span>${o.a.length > 1 ? n + '/' + o.a.length : ''}</span></div>`; }).join('')}</div>`;
}
function beklemeKart(st) {
  return `<div class="card focus" style="--ac:var(--gold)"><div class="eyebrow">Sırada</div><h2 class="serif" style="margin:6px 0 4px">${esc(st.grup)}: ${esc(st.ad)}</h2>
    <p class="muted" style="margin:6px 0 10px">${esc(ASAMAAD[st.asama] || 'Bu adım')} henüz başlamadı. Yönetici başlatınca bu ekran kendiliğinden açılır.</p>
    <button class="btn ghost" data-a="devam" data-id="${st.id}">Beklemeden devam et</button></div>`;
}
function sonKart() {
  const as = V.asama;
  return `<div class="card focus" style="--ac:var(--teal)"><div class="eyebrow teal">Masanız hazır</div><h2 class="serif" style="margin:6px 0 4px">${as === 'sonuc' ? 'Sonuçlar yayında' : 'Genel kurulu bekleyin'}</h2>
    <p class="muted">${as === 'sonuc' ? 'Matris perdede ve telefonlarda. Bu aşamada moderatör işlemi yok.' : 'Masanızın iki önerisi gönderildi. Genel kurulda moderatör işlemi yok; sunum sırası perdede görünür. Katılımcıların telefonlarını açık tutmasını hatırlatın.'}</p></div>`;
}
function ozetListe(L, cur) { // tamamlanan ve bekleyen adımlar: tek satır
  const kisa = x => {
    if (x.tur) { const t = V.tur[x.tur];
      if (x.id.endsWith('1')) return t.postit ? t.postit + ' post-it · ' + t.oy + ' oy' : '';
      if (x.id.endsWith('2')) return t.oyVeren + '/' + t.atanan + ' katılımcı oy verdi';
      return t.bulgular ? t.bulgular.length + ' bulgu kaydedildi' : ''; }
    if (x.id === 'F1') return V.secim.toplam ? V.secim.toplam + ' fikir' : V.secim.ham.length + ' fikir';
    if (x.id === 'F2') return 'Puanlama tamamlandı';
    if (x.id === 'F3') return V.secim.onay ? 'İlk 2 kaydedildi' : '';
    if (x.id === 'D') return V.detay.filter(f => f.gonder).length + '/' + V.detay.length + ' öneri gönderildi';
    return '';
  };
  const satir = x => { const acik = gor.has(x.id), bu = x === cur;
    return `<div class="os ${x.bitti ? 'ok' : bu ? 'on' : ''}"><span class="ic">${x.bitti ? '✓' : bu ? '●' : '○'}</span><div style="flex:1;min-width:0"><b>${esc(x.grup)} · ${esc(x.ad)}</b><div class="muted mini">${esc(x.bitti ? kisa(x) : bu ? 'şu an' : 'sırada')}</div></div>${x.bitti ? `<button class="btn sm ghost" data-a="goster" data-id="${x.id}">${acik ? 'Gizle' : 'Aç'}</button>` : ''}</div>`; };
  return `<div class="eyebrow" style="margin:18px 4px 6px">Tüm adımlar</div><div class="card flat" style="padding:6px 12px">${L.map(satir).join('')}</div>`;
}
function karti(st, aktif) {
  const t = st.tur;
  if (t) return turAdim(st, aktif);
  if (st.id === 'F1' || st.id === 'F2' || st.id === 'F3') return fikirAdim(st, aktif);
  if (st.id === 'D') return detayKart() + fikirKart();
  return '';
}
/* post-it içerik kutuları metne göre uzar/kısalır (gereksiz yer kaplamaz) */
function otoBoy(el) { (el ? [el] : [...document.querySelectorAll('textarea[data-e],textarea[data-bf]')]).forEach(t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; }); }

function zamanBar() {
  const z = V.zaman; if (!z || !z.bitis || z.bitis <= now() - 20000) return '';
  const bit = z.bitis <= now();
  return `<div class="zbar ${bit ? 'bit' : ''}"><span>${esc(z.etiket || 'Kalan süre')}</span><b id="zb" data-t="${z.bitis}">${bit ? 'Süre doldu' : mmss(z.bitis - now())}</b></div>`;
}
function turAdim(st, aktif) {
  const tur = st.tur, t = V.tur[tur], f = form[tur], ac = AC[tur], eb = EB[tur], n = st.id.slice(1), btnc = eb === 'pink' ? 'pink' : 'teal';
  const bas = `<div class="card focus" style="--ac:${ac}"><div class="row"><span class="eyebrow ${eb}">${esc(st.grup)} · ${esc(st.ad)}</span><span class="sp"></span>${st.bitti ? '<span class="badge ok">✓ tamam</span>' : aktif ? '<span class="badge warn">şu an</span>' : ''}</div>`;
  if (tur === 'Z' && V.tur.G.durum !== 'bitti' && t.durum === 'hazir') return bas + `<p class="muted" style="margin-top:12px">Önce güçlü yan oylaması kapanmalı. Sonra zayıf yan açılır.</p></div>`;
  if (n === '1') { // post-it sayısı
    const p = +f.postit || 0, ozelAktif = t.ozel && p === t.postit, oo = ozelAktif ? t.oy : oneriOy(p), om = ozelAktif ? t.maxPer : oneriMax(p, oo), eksik = !(p >= 1);
    if (st.bitti) return bas + `<div class="muted" style="margin-top:10px">${t.postit} post-it · kişi başı ${t.oy} oy · aynı post-it'e en fazla ${t.maxPer}</div></div>`;
    return bas + `<p class="muted" style="margin:10px 0 0">Flipchart'ı numaralayın, post-it sayısını girin.</p>
      <input class="bigin" data-f="${tur}.postit" inputmode="numeric" value="${esc(f.postit)}" placeholder="örn. 28" aria-label="Flipchart'taki post-it sayısı">
      <div class="oyb"><div><b class="serif goldl">${p ? oo : '–'}</b><span class="muted"> oy / kişi</span></div><div><b class="serif goldl">${p ? om : '–'}</b><span class="muted"> en fazla / post-it</span></div></div>
      ${ozelAktif ? '<div class="hint warn">Bu masa için yönetici özel bir değer belirledi.</div>' : ''}
      <div class="ctl"><button class="btn xl ${btnc}" data-a="ac" data-t="${tur}" ${eksik ? 'disabled' : ''}>${eksik ? 'Önce post-it sayısını girin' : 'Oylamayı aç'}</button></div></div>`;
  }
  if (n === '2') { // oylama
    const oran = t.atanan ? Math.min(100, t.oyVeren / t.atanan * 100) : 0, oyz = (V.kisiler || []).filter(k => !k.oy[tur]);
    if (st.bitti) return bas + `<div class="muted" style="margin-top:10px">${t.oyVeren}/${t.atanan} katılımcı oy kullandı · ${V.sonuc[tur].toplamOy} oy</div></div>`;
    return bas + `<div class="row" style="margin:12px 0 6px"><span class="serif" style="font-size:60px;font-weight:700;color:var(--ac);line-height:1">${t.oyVeren}</span><span class="muted" style="font-size:24px"> / ${t.atanan}</span><span class="muted" style="margin-left:8px">katılımcı oyunu gönderdi</span></div>
      <div class="bar"><i style="width:${oran}%"></i></div>
      ${oyz.length ? `<div class="miss"><span class="muted">Bekleyenler:</span> ${oyz.map(k => `<span class="vc no">○ ${esc(k.etiket)}</span>`).join('')}</div>` : '<div class="miss ok">✓ Herkes oyunu gönderdi</div>'}
      <div class="muted mini" style="margin-top:8px">${t.postit} post-it · kişi başı ${t.oy} oy · aynı post-it'e en fazla ${t.maxPer}</div>
      <div class="ctl"><button class="btn xl" data-a="kapat" data-t="${tur}">Oylamayı kapat ve sonucu göster</button></div></div>`;
  }
  // 3 · içerik ve kapanış
  const r = V.sonuc[tur];
  if (t.seansKapali && t.bulgular) return bas + `<div class="muted" style="margin:8px 0">${t.oyVeren}/${t.atanan} katılımcı oy kullandı · ${r.toplamOy} oy</div>` + t.bulgular.map(x => `<div class="rs top"><span class="no">${x.no}</span><span class="v">${x.oy}</span><div style="flex:1;font-size:16px">${esc(x.metin)}</div></div>`).join('')
    + `<button class="btn ghost" style="margin-top:12px" data-a="seans-ac" data-t="${tur}">Seansı yeniden aç (düzenle)</button></div>`;
  const bh = bulguHesap(tur), max = Math.max(1, ...r.sirali.map(x => x.oy));
  let h = bas + `<p class="muted" style="margin:8px 0">En çok oy alan ${bh.son.length || (V.sonuc[tur].K)} post-it'in içeriğini yazın (en çok 150 karakter).</p>`;
  const dSec = V.tur[tur].dar && V.tur[tur].dar.secilen; // dar oylama/kura bittiyse elenenler listeden çıkar
  h += (dSec ? bh.son : bh.kesin.concat(bh.adaylar)).map(x => { const aday = bh.secimGerek && bh.adaylar.some(y => y.no === x.no), secili = bh.son.some(y => y.no === x.no);
    return `<div class="rs ${secili ? 'top' : ''}"><span class="no">${x.no}</span><div class="bar"><i style="width:${x.oy / max * 100}%"></i></div><span class="v">${x.oy}</span>
    <textarea data-e="${tur}.${x.no}" rows="1" maxlength="150" placeholder="Post-it içeriği">${esc(bh.metin(x))}</textarea>${aday ? `<label class="sel"><input type="checkbox" data-sel="${tur}.${x.no}" ${secili ? 'checked' : ''}> seç</label>` : ''}</div>`; }).join('');
  h += darKutu(tur, bh) + `<div class="hint" id="bip-${tur}" style="margin-top:8px">${esc(bulguIpucu(bh))}</div>
    <div class="ctl"><button class="btn ghost sm" data-a="yeniden" data-t="${tur}">Oylamayı yeniden aç</button><button class="btn xl ${btnc}" id="kapat-${tur}" data-a="seans" data-t="${tur}" ${bh.tamam ? '' : 'disabled'}>Seansı kapat</button></div></div>`;
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
function fikirAdim(st, aktif) {
  const s = V.secim, dugme = (i, ad, cls, ekstra) => `<button class="btn ${cls || ''}" data-a="sec" data-i="${i}" ${ekstra || ''}>${ad}</button>`;
  const bas = `<div class="card focus" style="--ac:var(--blue)"><div class="row"><span class="eyebrow blue">${esc(st.grup)} · ${esc(st.ad)}</span><span class="sp"></span>${st.bitti ? '<span class="badge ok">✓ tamam</span>' : aktif ? '<span class="badge warn">şu an</span>' : ''}</div>`;
  if (st.id === 'F1') {
    const eksik = s.kisiler.filter(k => !k.var).map(k => k.etiket), oran = s.kisiler.length ? s.ham.length / s.kisiler.length * 100 : 0;
    if (st.bitti) return bas + `<div class="muted" style="margin-top:10px">${s.toplam} fikir girildi.</div></div>`;
    return bas + `<p class="muted" style="margin:10px 0 0">Tema tablosunu sesli okuyun; katılımcılar kâğıda fikir yazıp en iyisini telefondan girer.</p>
      <div style="margin-top:10px">${s.tablo ? dugme('tablo-kapat', '✓ Tablo herkesin telefonunda açık (kapat)', 'ghost') : dugme('tablo-ac', 'Tema tablosunu herkesin telefonunda aç', 'teal')}</div>
      <div class="row" style="margin:14px 0 6px"><span class="serif" style="font-size:60px;font-weight:700;color:var(--blue);line-height:1">${s.ham.length}</span><span class="muted" style="font-size:24px"> / ${s.kisiler.length}</span><span class="muted" style="margin-left:8px">katılımcı fikrini girdi</span></div><div class="bar"><i style="width:${oran}%"></i></div>
      ${eksik.length ? `<div class="miss"><span class="muted">Girmeyenler:</span> ${eksik.map(k => `<span class="vc no">○ ${esc(k)}</span>`).join('')}</div>` : '<div class="miss ok">✓ Herkes fikrini girdi</div>'}
      ${s.ham.length ? `<details data-det="fikirler" ${detAcik.has('fikirler') ? 'open' : ''} style="margin-top:10px"><summary class="muted" style="cursor:pointer">Fikirleri gör / düzelt (${s.ham.length})</summary>${s.ham.map(f => `<div class="fi bf" style="flex-wrap:wrap"><textarea data-bf="${f.id}" rows="2" maxlength="110">${esc(f.ad)}</textarea><div class="hint" style="width:100%;margin:2px 0 0">Dayanak: ${(f.swot || []).length ? f.swot.map(esc).join(' · ') : '<span class="warn">seçilmedi</span>'}</div></div>`).join('')}</details>` : ''}
      <div class="ctl">${dugme('baslat', 'Sunumları başlat (' + s.ham.length + ' fikir)', 'xl', s.ham.length < 2 ? 'disabled' : '')}</div></div>`;
  }
  if (st.id === 'F2') {
    if (st.bitti) return bas + `<div class="muted" style="margin-top:10px">Puanlama tamamlandı; sıralama oluştu.</div></div>`;
    if (s.durum === 'gozden') return bas + `<p class="muted" style="margin:10px 0 0">Katılımcılar puanlarını gözden geçiriyor ve eksikleri tamamlayabiliyor.</p>
      <div class="row" style="margin:14px 0"><span class="serif" style="font-size:48px;font-weight:700;color:var(--goldl)" id="cd3" data-t="${s.gozdenKapanis || 0}">${s.gozdenKapanis ? '--:--' : 'süresiz'}</span></div><div class="ctl">${dugme('yeniden', 'Baştan başla', 'ghost sm')}${dugme('hesapla', 'Sonucu hesapla', 'xl teal')}</div></div>`;
    const toplamP = Object.values(s.puanSay || {}).reduce((x, y) => x + y, 0), olasi = s.toplam * s.puanlayabilir;
    return bas + `<p class="muted" style="margin:10px 0 0">Fikirler 1 numaradan başlayarak sırayla anlatılır; katılımcılar dinledikçe puanlar. Moderatör puan vermez.</p>
      <div class="row" style="margin:14px 0 6px"><span class="serif" style="font-size:60px;font-weight:700;color:var(--teall);line-height:1">${toplamP}</span><span class="muted" style="font-size:22px"> / ${olasi}</span><span class="muted" style="margin-left:8px">puan verildi</span></div>
      <div class="bar"><i style="width:${olasi ? toplamP / olasi * 100 : 0}%"></i></div><div class="muted mini" style="margin-top:6px">${s.toplam} fikir · katılımcı kendi fikri dışındakileri puanlar</div>
      <div class="ctl">${dugme('hesapla', 'Puanlamayı sonlandır ve sırala', 'xl teal')}</div></div>`;
  }
  // F3 · sıralama ve masanın önerileri
  if (s.durum !== 'bitti') return bas + `<p class="muted" style="margin-top:10px">Puanlama sonlandırılınca sıralama burada görünür.</p></div>`;
  const sig = s.sonuc.map(x => x.id).join(',') + s.onay + JSON.stringify((s.dar || {}).secilen || ''); if (sig !== secSig) { secSig = sig; secSet = new Set((s.onay || (s.dar && s.dar.secilen) || s.sonuc.slice(0, V.masa.fikirSayisi).map(x => x.id))); }
  let h = bas + fikirDarKutu(s);
  h += `<p class="muted" style="margin:10px 0 6px">Masanın önerisi olacak ${V.masa.fikirSayisi} fikri işaretleyin.</p><div>`;
  for (const x of s.sonuc) h += `<label class="sr"><input type="checkbox" data-sc="${x.id}" ${secSet.has(x.id) ? 'checked' : ''}><span class="serif sn">${x.no}</span><span class="sa">${esc(x.ad)}</span><span class="so">${fmt(x.ort)}<small>${x.n} kişi</small></span></label>`;
  h += `</div><div class="hint" style="margin:8px 0">Aynı hedef kitle ve mekanizmaya sahip iki fikri birlikte seçmeyin; ikincisi yerine sıradakini işaretleyin.</div>
    <div class="ctl">${dugme('yeniden', 'Baştan başla', 'ghost sm')}${dugme('onayla', s.onay ? '✓ Kaydedildi; yeniden kaydet' : 'Masanın önerisi olarak kaydet', 'xl ' + (s.onay ? 'ghost' : 'teal'))}</div></div>`;
  return h;
}

function fikirDarKutu(s) { // fikirlerde TAM eşit puan: önce masa çözsün, olmazsa dar oylama, yine eşitse kura
  const d = s.dar, ad = x => '<b>' + x.no + '</b>';
  const fk = id => { const f = (s.sonuc || []).find(y => y.id === id); return f ? f : { no: '?', id }; };
  if (!d) {
    if (!s.esit) return '';
    const n = s.esit.adaylar.length, hak = Math.max(1, Math.min(n - 1, Math.ceil(n / 2)));
    return `<div class="card flat" style="margin:10px 0;--ac:var(--gold)"><div class="eyebrow">Eşit puan (ekranda aynı görünen)</div><div class="muted" style="font-size:14px;margin:4px 0 8px">${s.esit.adaylar.map(id => ad(fk(id))).join(', ')} numaralı ${n} fikir ekranda <b>aynı puanı</b> gösteriyor (virgülden sonraki ilk hane aynı); bunlardan ${s.esit.yer} tanesi masanın önerisi olacak. Önce masa kendisi konuşup karar versin (aşağıdan işaretleyin). Olmazsa <b class="goldl">dar oylama</b>: yalnızca bu fikirler arasında herkes ${hak} oy kullanır (kendi fikrine oy veremez).</div><button class="btn" data-a="sec" data-i="dar-ac">Dar oylamayı başlat</button></div>`;
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
  let h = `<div class="card" style="--ac:var(--teal);margin-top:16px"><div class="row"><span class="eyebrow teal">Öneri detayı (sunum içeriği)</span><span class="sp"></span><span class="badge ${d.every(f => f.gonder) ? 'ok' : 'warn'}">${d.filter(f => f.gonder).length}/${d.length} gönderildi</span></div>
    ${sureSatir([[/^Sunuma hazırlık/, 'Sunuma hazırlık']])}<p class="muted" style="margin:10px 0 0">Her öneriyi grupta <b class="goldl">bir kişi (yazar)</b> kendi telefonundan yazıp gönderir. Burada yalnızca izlersiniz. Yazarı katılımcılar kendileri seçer ("Yazmayı ben yapacağım"). Yazar ayrılırsa ya da çevrimdışı kalırsa "Yazarı serbest bırak"ı kullanın.</p>`;
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
  let h = `<details class="card" style="--ac:var(--gold);margin-top:12px"><summary class="eyebrow" style="cursor:pointer">Öneri adlarını düzelt (isteğe bağlı)</summary><div class="row"><span class="sp"></span><span class="sp"></span>${kilit ? '<span class="badge warn">Kilitli</span>' : ''}</div>
    ${sureSatir([[/^Sunuma hazırlık/, 'Sunuma hazırlık']])}
    <p class="muted" style="margin:10px 0 0">Önerilerin adı genel kurul slaydında başlık olur. <b class="goldl">Ad uygunsa olduğu gibi bırakabilirsiniz; değiştirmek zorunda değilsiniz</b> ve bu adımı yapmadan devam edebilirsiniz. Düzeltmek isterseniz tek cümleyle, proje adı gibi yazıp kaydedin.</p>`;
  for (let i = 1; i <= m.fikirSayisi; i++) {
    const f = V.fikirler.find(x => x.sira === i);
    h += `<div class="fi"><span class="n">${f && f.no != null ? f.no : i}</span><input data-fk="${i}" maxlength="110" placeholder="Fikir ${i} adı" value="${esc(form.fikir[i] || '')}" ${kilit ? 'disabled' : ''}>
      <button class="btn sm teal" data-a="fkaydet" data-i="${i}" ${kilit ? 'disabled' : ''}>Kaydet</button></div>
      ${f && f.ad ? `<div class="hint" style="margin-left:54px">${f.ad === form.fikir[i] ? '✓ Kayıtlı' : 'Kayıtlı: ' + esc(f.ad)}</div>` : ''}`;
  }
  return h + '</details>';
}

document.addEventListener('input', e => {
  const el = e.target; lastInput = Date.now();
  if (el.dataset.f) { const [t, k] = el.dataset.f.split('.'); form[t][k] = el.value.replace(/[^\d]/g, ''); clearTimeout(window.__rt); window.__rt = setTimeout(() => { lastInput = 0; render(); }, 700); }
  else if (el.dataset.fk) form.fikir[el.dataset.fk] = el.value;
  else if (el.dataset.bf) otoBoy(el);
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
    if (a === 'cikis') { cikisYap(); return; }
    if (a === 'goster') { gor.has(el.dataset.id) ? gor.delete(el.dataset.id) : gor.add(el.dataset.id); lastInput = 0; render(); return; }
    if (a === 'devam') { devam.add(el.dataset.id); lastInput = 0; render(); return; }
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
      if (i === 'dar-ac' && !confirm('Ekranda aynı puanı gösteren fikirler arasında dar oylama başlatılsın mı? Katılımcıların telefonunda açılır.')) return;
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

document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.det) { if (d.open) { detAcik.add(d.dataset.det); otoBoy(); } else detAcik.delete(d.dataset.det); } if (d && d.dataset && d.dataset.did) { if (d.open) dacik.add(d.dataset.did); else dacik.delete(d.dataset.did); } }, true);
