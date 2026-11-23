const app = $('#app');
let V = null;
const AC = { guclu: 'var(--teal)', zayif: 'var(--pink)' };
const ADIM = { hazirlik: 'Hazırlık', guclu: 'Güçlü yönler · oylama', zayif: 'Zayıf yönler · oylama', fikir: 'Proje fikirleri', sunum: 'Öneri sunumları', sonuc: 'Sonuç' };
const MASA = new URLSearchParams(location.search).get('masa');
let M = null;
async function yenile() {
  if (MASA) { M = await api('/api/ekran/masa/' + encodeURIComponent(MASA)); setSkew(M.t); return renderMasa(); }
  V = await api('/api/ekran/view'); setSkew(V.t); render();
}
/* ---- masa ekranı: tema tablosu, anlık fikir, gözden geçirme, sıralama ---- */
function renderMasa() {
  const s = M.secim;
  const f = { hazir: masaTema, sunum: masaSunum, gozden: masaGozden, bitti: masaSonuc }[s.durum] || masaTema;
  app.innerHTML = f() + '<div class="foot">KÖK · ' + esc(M.masa.ad) + '</div>';
}
function masaTema() {
  const s = M.secim, t = M.tema;
  const kol = (tur, ad, renk) => {
    let items = '';
    for (const m of t.masalar) { const r = m[tur]; if (!r) continue; items += r.map((x, i) => `<div class="tt"><span class="tc" style="color:${renk}">${esc(m.id)}${tur === 'G' ? 'G' : 'Z'}-${x.no}</span><span class="tx">${x.etiket ? esc(x.etiket) : '<span class="muted">Post-it ' + x.no + '</span>'}</span></div>`).join(''); }
    return `<div class="card" style="--ac:${renk};flex:1;padding:1.2rem 1.6rem"><div class="eb" style="color:${renk};margin-bottom:.6rem">${ad}</div>${items || '<div class="muted" style="font-size:1.4rem">Henüz sonuç yok.</div>'}</div>`;
  };
  return `<div class="hd"><div><div class="eb">Fikir geliştirme · ${esc(M.masa.ad)}</div><h1 class="t1" style="margin-top:.5rem;font-size:3rem">${esc(M.masa.temaAd)}</h1></div><span class="sp"></span><span class="pillx" style="--ac:var(--gold)">${s.girilen} / ${s.puanlayabilir + 1} fikir girildi</span></div>
    <div style="display:flex;gap:1.4rem;flex:1;min-height:0">${kol('G', 'Güçlü yönler', 'var(--teal)')}${kol('Z', 'Zayıf yönler', 'var(--pink)')}</div>`;
}
function masaSunum() {
  const s = M.secim; if (s.durum !== 'sunum') return '';
  const ac = 'var(--teal)';
  return `<div class="hd" style="--ac:${ac}"><div class="eb" style="color:${ac}">Fikir seçimi</div><span class="sp"></span><span class="pillx" style="--ac:${ac}">Dinleyip puanlıyoruz</span></div>
    <div class="split" style="--ac:${ac}"><div style="flex:1.6"><h1 class="serif" style="font-size:3.8rem;line-height:1.15">${s.toplam} fikir 1 numaradan başlayarak sırayla anlatılıyor</h1><p class="muted" style="font-size:1.5rem;margin-top:1rem">Telefonunuzdan dinledikçe puanlayın.</p></div>
    <div style="flex:1;min-width:22rem"><div class="serif" style="font-size:3rem;font-weight:700;color:var(--teall)">${s.puanVeren}<span class="muted" style="font-size:1.8rem"> / ${s.puanlayabilir}</span></div><span class="muted" style="font-size:1.2rem">kişi puanlıyor</span></div></div>`;
}
function masaGozden() {
  const s = M.secim;
  return `<div class="hd" style="--ac:var(--gold)"><div><div class="eb">Gözden geçirme</div><h1 class="t1" style="margin-top:.5rem;font-size:3rem">Puanlarınızı telefonunuzdan gözden geçirin</h1></div><span class="sp"></span><span class="cdn" id="cdm" data-t="${s.gozdenKapanis || 0}" style="font-size:4.5rem">${s.gozdenKapanis ? mmss(s.gozdenKapanis - now()) : ''}</span></div>
    <div class="ql" style="flex:1">${s.fikirler.map(f => `<div class="qi"><span class="qn" style="color:var(--gold)">${f.no}</span><span>${esc(f.ad)}</span></div>`).join('')}</div>`;
}
function masaSonuc() {
  const s = M.secim, max = Math.max(1, ...s.sonuc.map(x => x.ort));
  return `<div class="hd" style="--ac:var(--gold)"><div><div class="eb">Fikir seçimi · sonuç</div><h1 class="t1" style="margin-top:.5rem;font-size:3rem">Masamızın fikir sıralaması</h1></div><span class="sp"></span>${s.onay ? '<span class="pillx" style="--ac:var(--teal)">İlk fikirler masa önerisi olarak kaydedildi</span>' : ''}</div>
    <div style="flex:1">${s.sonuc.map((x, i) => `<div class="mr"><span class="qn" style="color:${i < 2 ? 'var(--gold)' : 'var(--muted)'};font-size:2.4rem;min-width:4rem">${x.no}</span><div style="flex:1"><div style="font-size:1.6rem;font-weight:700">${esc(x.ad)}</div><div class="bar" style="height:.7rem;margin-top:.4rem;--ac:${i < 2 ? 'var(--gold)' : 'var(--blue)'}"><i style="width:${x.ort / max * 100}%"></i></div></div><span class="serif" style="font-size:2rem;font-weight:700;min-width:5rem;text-align:right">${fmt(x.ort)}</span></div>`).join('')}</div>`;
}
canli(yenile);
const mgStil = () => { const n = V.masalar.length; return '--cols:' + (n <= 4 ? Math.max(n, 1) : 7) + ';--rowh:' + (n <= 4 ? '22rem' : '17rem'); };
const foot = '<div class="foot">KÖK · Yönetici Çalıştayı</div>';

function render() {
  if (!V) return;
  const f = { hazirlik, guclu: swot, zayif: swot, fikir, sunum, sonuc }[V.asama] || hazirlik;
  app.innerHTML = (V.mola ? molaBar(V.mola, true).replace('class="molabar"', 'class="molabar" style="font-size:1.6rem;margin:0 0 1rem"') : '') + f() + zamanPill() + foot; sigdir(); sigdirListe();
}
function hazirlik() {
  const url = V.baseUrl + '/katil';
  return `<div class="hd"><div><div class="eb">Türkiye Halk Bankası · KÖK Projesi</div><h1 class="t1" style="margin-top:.6rem">Yönetici Çalıştayı</h1><div class="goldl serif" style="font-size:1.9rem;font-style:italic;margin-top:.4rem">Telefonunuzla oylama ve puanlama</div></div></div>
  <div class="split"><div class="qrw">${qrSvg(url, Math.round(innerHeight * 0.4))}<div class="eb" style="color:var(--teall)">Katılmak için okutun</div><div class="muted" style="font-size:1.1rem">veya ${esc(url.replace('http://', ''))}</div></div>
  <div style="flex:1"><div class="eb" style="color:var(--teall)">Bağlı katılımcı</div><div class="big">${V.bagli}<span class="muted" style="font-size:3.5rem"> / ${V.toplam}</span></div><div class="bar" style="height:1rem;margin:1rem 0 1.6rem;--ac:var(--teal)"><i style="width:${V.toplam ? V.bagli / V.toplam * 100 : 0}%"></i></div>
  <div class="eb" style="margin-bottom:.7rem">Yaka kartınızdaki QR kodu veya 4 haneli kodu kullanın</div>
  <div style="display:flex;flex-wrap:wrap;gap:.5rem">${V.masalar.map(m => `<span class="pillx" style="--ac:${m.atanan && m.bagli >= m.atanan ? 'var(--teal)' : 'rgba(159,176,211,.5)'};font-size:1rem;padding:.3rem .8rem">${esc(m.id)} <span class="muted">${m.bagli}/${m.atanan}</span></span>`).join('')}</div></div></div>`;
}
function swot() {
  const tur = V.asama === 'guclu' ? 'G' : 'Z', ac = AC[V.asama], bas = tur === 'G' ? 'Güçlü yönler' : 'Zayıf yönler';
  const ort = V.masalar.reduce((a, m) => a + (m.tur[tur].oyVeren || 0), 0), top = V.masalar.reduce((a, m) => a + (m.tur[tur].atanan || 0), 0);
  let h = `<div class="hd" style="--ac:${ac}"><div><div class="eb" style="color:${ac}">${bas} · oylama</div><h1 class="t1" style="margin-top:.5rem">Duvardaki numaralara oy verin</h1></div><span class="sp"></span>
    <span class="pillx" style="--ac:${ac}">${ort} / ${top} oy kullandı</span></div><div class="mg" style="${mgStil()}">`;
  for (const m of V.masalar) {
    const t = m.tur[tur], oran = t.atanan ? (t.oyVeren || 0) / t.atanan * 100 : 0;
    const st = t.durum === 'acik' ? `<span style="color:var(--teall)">Açık</span>` : t.durum === 'bitti' ? (t.dar && t.dar.durum === 'acik' ? `<span style="color:var(--pinkl,#ff8fb5)">Dar oylama</span>` : `<span class="goldl">Kapandı</span>`) : `<span class="muted">Hazırlanıyor</span>`;
    h += `<div class="mc ${t.durum === 'bitti' ? 'done' : ''}" style="--ac:${t.durum === 'hazir' ? 'rgba(159,176,211,.4)' : ac}"><div class="row"><span class="id">${esc(m.id)}</span><span class="sp"></span>${st}</div><div class="tn">${esc(m.temaAd)}</div>
      ${t.durum === 'hazir' ? '<div class="muted" style="font-size:.9rem">Oy sayısı ayarlanıyor</div>' : `<div class="bar"><i style="width:${oran}%"></i></div><div class="st"><span>${t.oyVeren || 0} / ${t.atanan}</span><span class="muted">${t.oy} oy</span></div>`}
      ${t.durum === 'bitti' && t.sonuc ? `<div class="ilk">${t.sonuc.ilk.map(x => `<b>${x.no}</b>`).join('')}</div>` : ''}</div>`;
  }
  return h + '</div>';
}
function fikir() {
  const ad = { hazir: 'Fikir yazıyor', sunum: 'Sunum ve puanlama', gozden: 'Gözden geçirme', bitti: 'Sonuç' };
  const tamam = V.masalar.filter(m => m.secim.onay).length;
  let h = `<div class="hd" style="--ac:var(--gold)"><div><div class="eb">Fikir geliştirme ve masa içi seçim</div><h1 class="t1" style="margin-top:.5rem">Masalar fikirlerini seçiyor</h1></div><span class="sp"></span><span class="pillx" style="--ac:var(--teal)">${tamam} / ${V.masalar.length} masa tamamladı</span></div><div class="mg" style="${mgStil()}">`;
  for (const m of V.masalar) {
    const s = m.secim, ok = s.onay;
    const durum = ok ? 'Tamamlandı' : ad[s.durum];
    const ilerleme = s.durum === 'hazir' ? s.girilen + ' / ' + m.atanan + ' fikir girildi' : s.durum === 'sunum' ? 'Dinleyip puanlıyorlar · ' + s.toplam + ' fikir' : s.durum === 'gozden' ? 'Puanlar gözden geçiriliyor' : ok ? 'İlk fikirler seçildi' : 'Sonuç hesaplandı';
    const oran = s.durum === 'hazir' ? (m.atanan ? s.girilen / m.atanan * 100 : 0) : s.durum === 'sunum' ? (s.puanOran || 0) * 100 : 100;
    h += `<div class="mc" style="--ac:${ok ? 'var(--teal)' : s.durum === 'hazir' ? 'rgba(159,176,211,.45)' : 'var(--gold)'}"><div class="row"><span class="id">${esc(m.id)}</span><span class="sp"></span><span style="font-weight:700;color:${ok ? 'var(--teall)' : 'var(--goldl)'}">${durum}</span></div><div class="tn">${esc(m.temaAd)}</div><div class="bar"><i style="width:${oran}%"></i></div><div class="st"><span>${ilerleme}</span></div></div>`;
  }
  return h + '</div>';
}
function zamanPill() {
  const z = V.zaman; if (!z || !z.bitis || z.bitis <= now() - 20000) return '';
  const bit = z.bitis <= now();
  return `<div class="zpill ${bit ? 'bit' : ''}"><span>${esc(z.etiket || 'Kalan süre')}</span><b id="zpd" data-t="${z.bitis}">${bit ? 'Süre doldu' : mmss(z.bitis - now())}</b></div>`;
}
function sunum() {
  const s = V.sunum, f = s.fikir;
  const siraTablo = () => { const g = {}; for (const x of (s.sira || [])) (g[x.masa] = g[x.masa] || []).push(x.no);
    return `<div class="hd"><div><div class="eb">Genel kurul</div><h1 class="t1" style="margin-top:.5rem">Sunum sırası</h1></div></div><div class="mg" style="--cols:7;--rowh:9rem">${Object.entries(g).map(([m, l]) => `<div class="mc" style="--ac:var(--gold)"><span class="id">${esc(m)}</span><div class="ilk">${l.map(n => `<b>${n}</b>`).join('')}</div></div>`).join('')}</div>`; };
  if (!f || (s.durum === 'hazir' && f.no === 1)) return siraTablo();
  const durumAd = { hazir: 'Sunum birazdan başlıyor', sunum: 'Sunum', puan: 'Puanlama açık', kapali: 'Puanlama kapandı' }[s.durum];
  const ac = s.durum === 'puan' ? 'var(--gold)' : s.durum === 'sunum' ? 'var(--teal)' : 'var(--blue)';
  const ALAN = [['uygulama', 'Ne yapılacak?'], ['kapsam', 'Kimler için, nerede?'], ['katki', 'Beklenen öğrenme katkısı'], ['basari', 'Başarı göstergesi'], ['ilkadim', 'İlk adım ve sahiplik']];
  const durumPill = s.durum === 'sunum' ? `<span class="pillx" style="--ac:var(--teal)">Kalan süre <b class="serif" id="cd" style="font-size:1.6rem;color:#fff">${mmss(Math.max(0, s.sunumBas + s.sunumSn * 1000 - now()))}</b></span>`
    : s.durum === 'puan' ? `<span class="pillx" style="--ac:var(--gold)">Puanlama açık <b class="serif" id="cd" style="font-size:1.6rem;color:var(--goldl)">${s.puanKapanis ? mmss(s.puanKapanis - now()) : 'AÇIK'}</b></span>`
    : `<span class="pillx" style="--ac:${ac}">${durumAd}</span>`;
  const swot = (f.swot || []).map(x => { const [kod, ...r] = x.split(' · '); return `<div class="swl"><b style="color:${/Z-/.test(kod) ? 'var(--pinkl,#ff8fb5)' : 'var(--teall)'}">${esc(kod)}</b><span>${esc(r.join(' · '))}</span></div>`; }).join('') || '<div class="swl muted">(SWOT maddesi seçilmedi)</div>';
  const kart = ([k, et]) => { const m = ((f.alan || {})[k] || '').trim(); const bs = m.length <= 90 ? 'l' : m.length <= 150 ? 'm' : 's';
    return `<div class="sk ${k === 'ilkadim' ? 'tam' : ''}"><div class="skl">${et}</div><div class="skt ${bs} ${m ? '' : 'bos'}">${m ? esc(m) : '(henüz doldurulmadı)'}</div></div>`; };
  const alt = s.durum === 'puan' ? `<div class="skalt"><span>Telefonunuzdan puanlayın</span><div class="bar" style="flex:1;--ac:var(--teal)"><i style="width:${s.katilimci ? s.puanVeren / s.katilimci * 100 : 0}%"></i></div><b class="serif" style="font-size:1.6rem;color:var(--teall)">${s.puanVeren}<span class="muted" style="font-size:1.1rem"> / ${s.katilimci}</span></b></div>` : '';
  return `<div class="slayt" style="--ac:${ac}"><div class="hd" style="margin-bottom:.9rem"><div><div class="eb" style="color:var(--goldl)">Öneri ${f.no} / ${f.toplam} · Masa ${esc(f.masa)}</div>${s.siradaki ? `<div style="font-size:1rem;color:var(--muted);margin-top:.3rem">Sıradaki: Öneri ${s.siradaki.no} · Masa ${esc(s.siradaki.masa)}</div>` : ''}</div><span class="sp"></span><span class="pillx" style="--ac:${temaRenk(f.tema)};font-size:1.05rem">Tema ${f.tema} · ${esc(f.temaAd)}</span>${durumPill}</div>
  <h1 class="serif sbas ${f.ad.length > 70 ? 'u' : ''}">${esc(f.ad)}</h1>
  <div class="swb"><div class="skl" style="color:var(--teall)">Dayandığı SWOT bulguları</div>${swot}</div>
  <div class="sg">${ALAN.map(kart).join('')}</div>${alt}</div>`;
}
/* öneri listeleri taşarsa küçült (tek bölgede çok öneri olabilir) */
function sigdirListe() { document.querySelectorAll('.ql, .lgw').forEach(l => { l.style.zoom = ''; let z = 1, n = 0; while ((l.scrollHeight > l.clientHeight + 2 || l.scrollWidth > l.clientWidth + 2) && z > 0.45 && n++ < 30) { z -= 0.03; l.style.zoom = z; } }); }
/* slayt kartlarındaki metin taşarsa yazıyı küçült (en uzun içerik ve küçük projeksiyon için) */
function sigdir() { document.querySelectorAll('.sk').forEach(k => { const x = k.querySelector('.skt'); if (!x) return; let fs = parseFloat(getComputedStyle(x).fontSize); let n = 0; while (k.scrollHeight > k.clientHeight + 1 && fs > 11 && n++ < 30) { fs -= 1; x.style.fontSize = fs + 'px'; } }); }
let slayt = 0;
function sonuc() {
  const mt = V.matris, i = V.sonucSlayt || 0; slayt = i;
  const nav = `<div class="dots">${[0, 1, 2, 3, 4].map(k => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>`;
  if (i === 0) {
    const grup = ['hizli', 'stratejik', 'sinirli', 'beklet'].map(k => { const c = CEYREK[k], l = mt.ceyrekler[k];
      return `<div class="lg" style="--ac:${c.renk}"><div class="lgh" style="color:${c.acik}"><span>${c.ad}</span><span>${l.length}</span></div><div class="lgd">${c.ac}</div><div class="lgc"><span>Öneri</span><span>Etki · Uygulanabilirlik</span></div>${l.map(g => `<div class="lgi"><span class="lgn" style="color:${temaRenk(g.tema)}">${g.no}</span><span class="lga">${esc(g.ad)}${g.ayrilik ? ' ◆' : ''}</span><span class="lgs">${fmt(g.etki)} · ${fmt(g.uyg)}</span></div>`).join('') || '<div class="lgi muted">Öneri yok</div>'}</div>`; }).join('');
    return `<div class="hd"><div><div class="eb">Sonuç</div><h1 class="t1" style="margin-top:.5rem">Etki × Uygulanabilirlik matrisi</h1></div></div>
    <div class="split" style="align-items:flex-start;gap:2rem;min-height:0"><div class="mat" style="flex:1.1">${matrisSVG(mt, { w: 900, h: 620, r: 19, fs: 16 })}<div class="muted" style="margin-top:.6rem;font-size:.95rem">${mt.oge.length} öneri · çizgiler ${mt.esikTur === 'ortalama' ? 'ortalama' : 'orta nokta'} (${fmt(mt.esikUyg)})${mt.oge.some(o => o.ayrilik) ? ' · ◆ puanlar çok farklı (fikir birliği yok)' : ''}</div>${mt.puansiz && mt.puansiz.length ? `<div style="margin-top:.4rem;font-size:.95rem;color:var(--goldl)">Puanlanmayan öneri: ${mt.puansiz.map(p => p.no).join(', ')}</div>` : ''}</div>
    <div class="lgw ${mt.oge.length > 22 ? 'sm' : ''}" style="flex:1">${grup}</div></div>${nav}`; }
  const key = ['hizli', 'stratejik', 'sinirli', 'beklet'][i - 1], c = CEYREK[key];
  return `<div class="hd" style="--ac:${c.renk}"><div><div class="eb" style="color:${c.acik}">${esc(c.not)}</div><h1 class="t1" style="margin-top:.5rem;color:${c.acik}">${c.ad}</h1></div><span class="sp"></span><span class="pillx" style="--ac:${c.renk}">${mt.ceyrekler[key].length} öneri</span></div><div style="margin:-.6rem 0 1rem;font-size:1.3rem;color:var(--muted)">${c.ac}</div>
    <div class="ql ${mt.ceyrekler[key].length <= 8 ? 'few' : mt.ceyrekler[key].length <= 16 ? 'mid' : mt.ceyrekler[key].length > 24 ? 'many' : ''}" style="flex:1;overflow:hidden">${mt.ceyrekler[key].map(g => `<div class="qi"><span class="qn" style="color:${temaRenk(g.tema)}">${g.no}</span><span>${esc(g.ad)}${g.ayrilik ? ' ◆' : ''}</span><span class="qs">E ${fmt(g.etki)} · U ${fmt(g.uyg)}</span></div>`).join('') || '<div class="muted" style="font-size:1.4rem">Bu bölgede öneri yok.</div>'}</div>${nav}`;
}
setInterval(() => { const zp = $('#zpd'); if (zp) { const k = +zp.dataset.t - now(); zp.textContent = k > 0 ? mmss(k) : 'Süre doldu'; zp.parentElement.classList.toggle('bit', k <= 0); } const cm = $('#cdm'); if (cm && +cm.dataset.t) cm.textContent = mmss(+cm.dataset.t - now()); const c = $('#cd'); if (!c || !V) return; const s = V.sunum; c.textContent = s.durum === 'sunum' ? mmss(s.sunumBas + s.sunumSn * 1000 - now()) : s.puanKapanis ? mmss(s.puanKapanis - now()) : 'AÇIK'; }, 250);
document.addEventListener('keydown', async e => {
  const pin = localStorage.getItem('kokPin'); if (!pin || !V || V.asama !== 'sonuc') return;
  let n = slayt; if (e.key === 'ArrowRight' || e.key === ' ') n++; else if (e.key === 'ArrowLeft') n--; else return;
  n = Math.max(0, Math.min(4, n)); try { await api('/api/admin/ayar', { sonucSlayt: n }, { 'x-pin': pin }); } catch (er) { /* yetkisiz */ }
});
