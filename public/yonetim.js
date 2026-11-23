const app = $('#app');
let PIN = localStorage.getItem('kokPin') || '', A = null, tab = (location.hash || '#genel').slice(1), lastInput = 0, filtre = { masa: '', ara: '' }, sec = new Set();
const adm = (p, b) => api('/api/admin' + p, b === undefined ? undefined : b, { 'x-pin': PIN });
const TABS = [['genel', 'Genel'], ['demo', 'Demo akışı'], ['hazirlik', 'Hazırlık listesi'], ['program', 'Program'], ['katilimci', 'Katılımcılar'], ['kolay', 'Moderatörler'], ['masalar', 'SWOT aşaması'], ['sunum', 'Fikirler ve sunum'], ['sonuc', 'Sonuç'], ['ayar', 'Ayarlar']];
const ASAMA = [['hazirlik', 'Hazırlık'], ['guclu', 'Güçlü yön oylaması'], ['zayif', 'Zayıf yön oylaması'], ['fikir', 'Fikir yazımı'], ['sunum', 'Sunumlar'], ['sonuc', 'Sonuç']];
const oneriOy = p => Math.min(15, Math.max(1, Math.round((p || 0) / 2)));

async function yenile() {
  if (!PIN) return giris();
  try { A = await adm('/view'); setSkew(A.t); } catch (e) { if (e.status === 401) { PIN = ''; localStorage.removeItem('kokPin'); return giris('PIN hatalı.'); } return; }
  render();
}
function giris(msg) {
  app.innerHTML = '<div style="max-width:420px;margin:12vh auto" class="card"><div class="eyebrow">KÖK · Yönetim</div><h1 style="font-size:34px;margin:8px 0 14px">Yönetim paneli</h1>' + (msg ? '<div style="color:var(--pinkl)">' + msg + '</div>' : '') +
    '<label class="f">PIN<input id="pin" type="password" inputmode="numeric" autofocus></label><button class="btn xl" id="gir" style="margin-top:14px">Giriş</button></div>';
  const go = () => { PIN = $('#pin').value.trim(); localStorage.setItem('kokPin', PIN); yenile(); };
  $('#gir').onclick = go; $('#pin').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}
canli(yenile);

function render() {
  if (!A) return;
  const ak = document.activeElement;
  if (ak && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ak.tagName) && app.contains(ak) && Date.now() - lastInput < 9000) { clearTimeout(window.__rr); window.__rr = setTimeout(render, 1600); return; }
  const bagli = A.katilimcilar.filter(k => k.bagli).length;
  let h = `<div class="yh"><div><div class="eyebrow">KÖK · Yönetici Çalıştayı</div><h1 class="serif" style="margin-top:6px">Yönetim paneli</h1></div><span class="sp"></span>
    <span class="pill" style="--ac:var(--teal)"><i></i>${bagli} / ${A.katilimcilar.length} bağlı</span><a class="btn ghost sm" href="/menu" style="text-decoration:none">← Anasayfa</a>${A.sablon === 'demo' ? '<span class="pill" style="--ac:var(--gold)">Demo şablonu</span>' : ''}
    <a class="btn ghost sm" href="/ekran" target="_blank" style="text-decoration:none">Perde ekranı ↗</a></div>
    <div id="pbar" class="pbar">${progBarIc()}</div>
    <div class="tabs">${TABS.map(([k, v]) => `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}">${v}</button>`).join('')}</div>`;
  h += ({ genel, demo: demoAkis, hazirlik, program, katilimci, kolay, masalar, sunum, sonuc, ayar }[tab] || genel)();
  app.innerHTML = h + cikisAlt('act'); etiketle();
}
/* ---------------------------------------------------------- program (yalnızca yönetici) */
const fmtDk = m => String(Math.floor(m / 60)).padStart(2, '0') + '.' + String(Math.floor(m % 60)).padStart(2, '0');
function fmtSure(sn) { sn = Math.max(0, Math.round(sn)); const h = Math.floor(sn / 3600), m = Math.floor(sn % 3600 / 60), s = sn % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); }
function progDurum() {
  const o = (A && A.program && A.program.oge) || []; const d = new Date(now());
  const dk = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const i = o.findIndex(x => dk >= x.b && dk < x.e);
  const sonraki = o.findIndex(x => x.b > dk);
  return { o, dk, i, sonraki };
}
function progBarIc() {
  const P = progDurum(), o = P.o; if (!o.length) return '<span class="muted">Program tanımlı değil.</span>';
  if (P.i >= 0) {
    const x = o[P.i], nx = o[P.i + 1], oran = Math.min(100, (P.dk - x.b) / (x.e - x.b) * 100);
    return `<div class="prow"><span class="badge warn">Şu an buradasınız</span><b class="pa1">${esc(x.ad)}</b><span class="pk">${fmtSure((x.e - P.dk) * 60)}</span><span class="muted">kalan</span>${nx ? `<span class="muted psn">Sıradaki: <b>${esc(nx.ad)}</b> ${fmtDk(nx.b)}</span>` : ''}</div><div class="bar"><i class="pbi" style="width:${oran}%"></i></div>`;
  }
  if (P.sonraki >= 0) { const nx = o[P.sonraki]; return `<div class="prow"><span class="badge off">${P.sonraki === 0 ? 'Program başlamadı' : 'Seans arası'}</span><span class="muted">Sıradaki:</span><b class="pa1">${esc(nx.ad)}</b><span class="muted">${fmtDk(nx.b)}</span><span class="pk">${fmtSure((nx.b - P.dk) * 60)}</span><span class="muted">sonra</span></div>`; }
  return '<div class="prow"><span class="badge ok">Program tamamlandı</span></div>';
}
function progTopHtml() {
  const P = progDurum(), o = P.o;
  if (P.i >= 0) {
    const x = o[P.i], nx = o[P.i + 1], oran = Math.min(100, (P.dk - x.b) / (x.e - x.b) * 100);
    return `<div class="eyebrow">ŞU AN BURADASINIZ</div><div class="row wrap-f" style="align-items:flex-end;gap:18px;margin-top:6px"><h2 class="serif" style="font-size:30px;line-height:1.1">${esc(x.ad)}</h2><span class="serif goldl" style="font-size:44px;font-weight:700;line-height:1">${fmtSure((x.e - P.dk) * 60)}</span><span class="muted">kalan · ${fmtDk(x.b)}–${fmtDk(x.e)} (${x.e - x.b} dk)</span></div>
      <div class="bar" style="margin:12px 0"><i class="pbi" style="width:${oran}%"></i></div>${x.not ? `<div class="muted">${esc(x.not)}</div>` : ''}${nx ? `<div style="margin-top:10px" class="muted">Sıradaki: <b style="color:#fff">${esc(nx.ad)}</b> · ${fmtDk(nx.b)}${nx.b > x.e ? ' (' + (nx.b - x.e) + ' dk sonra başlar)' : ''}</div>` : ''}`;
  }
  if (P.sonraki >= 0) { const nx = o[P.sonraki]; return `<div class="eyebrow">${P.sonraki === 0 ? 'PROGRAM BAŞLAMADI' : 'SEANS ARASI'}</div><h2 class="serif" style="font-size:26px;margin-top:6px">Sıradaki: ${esc(nx.ad)} · ${fmtDk(nx.b)}</h2><div class="serif goldl" style="font-size:40px;font-weight:700">${fmtSure((nx.b - P.dk) * 60)} <span class="muted" style="font-size:16px;font-family:var(--sans)">sonra</span></div>${nx.not ? `<div class="muted" style="margin-top:6px">${esc(nx.not)}</div>` : ''}`; }
  return '<div class="eyebrow">PROGRAM TAMAMLANDI</div><h2 class="serif" style="font-size:26px;margin-top:6px">Günün programı bitti.</h2>';
}
function progListHtml() {
  const P = progDurum(); const al = Object.fromEntries(ASAMA);
  return P.o.map((x, k) => {
    const gec = P.dk >= x.e, simdi = k === P.i;
    return `<div class="pr ${simdi ? 'now' : ''} ${gec ? 'past' : ''}"><div class="pt">${fmtDk(x.b)}–${fmtDk(x.e)}<small>${x.e - x.b} dk</small></div><div class="pb"><b>${esc(x.ad)}</b>${simdi ? ' <span class="badge warn">Şu an buradasınız</span>' : ''}${x.not ? `<div class="muted">${esc(x.not)}</div>` : ''}</div>
      <div class="prc">${gec ? '<span class="teal" style="font-size:20px">✓</span>' : simdi ? '<span class="goldl pl" style="font-weight:700">' + fmtSure((x.e - P.dk) * 60) + '</span>' : ''}${x.asama && !gec ? `<button class="btn sm ghost" data-act="asama" data-v="${x.asama}">Aşama: ${al[x.asama]}</button>` : ''}</div></div>`;
  }).join('');
}
function program() {
  const metin = (A.program ? A.program.oge : []).map(x => fmtDk(x.b) + '–' + fmtDk(x.e) + ' | ' + x.ad + ' | ' + (x.not || '') + (x.asama ? ' | ' + x.asama : '')).join('\n');
  return `<div class="card" style="--ac:var(--gold)" id="progtop">${progTopHtml()}</div>
    <div class="card" style="--ac:var(--blue);margin-top:16px"><div class="row wrap-f"><div><div class="eyebrow blue">Gecikme veya erken bitiş</div><div class="muted" style="margin-top:4px">Şu anki seansın bitişini ve sonraki tüm seansları kaydırır.</div></div><span class="sp"></span>
      ${[-10, -5, 5, 10, 15].map(d => `<button class="btn sm ${d > 0 ? 'ghost' : 'teal'}" data-act="prog-kaydir" data-dk="${d}">${d > 0 ? '+' : '−'}${Math.abs(d)} dk</button>`).join('')}</div></div>
    <div class="card" style="--ac:var(--teal);margin-top:16px"><div class="eyebrow teal">Günün programı</div><div id="proglist" style="margin-top:8px">${progListHtml()}</div></div>
    <div class="card" style="--ac:var(--blue);margin-top:16px"><div class="eyebrow blue">Programı düzenle</div><div class="muted mini" style="margin:6px 0">Her satır: <b>SS.DD–SS.DD | Başlık | Not (isteğe bağlı) | aşama (isteğe bağlı: hazirlik, guclu, zayif, fikir, sunum, sonuc)</b>. Bu bölüm yalnızca yönetim panelinde görünür; katılımcılar ve perde bunu görmez.</div>
      <textarea id="progmetin" style="min-height:260px;font-size:14px">${esc(metin)}</textarea><div class="row wrap-f" style="margin-top:10px"><button class="btn sm teal" data-act="prog-kaydet">Programı kaydet</button><button class="btn sm ghost" data-act="prog-varsayilan">Varsayılan programa dön</button></div></div>`;
}
let progSig = '';
function progTik() {
  if (!A || !A.program) return;
  const P = progDurum(), sig = P.i + ':' + Math.floor(P.dk) + ':' + (A.program.oge.length) + ':' + tab;
  const bar = $('#pbar'); if (!bar) return;
  if (sig !== progSig) {
    progSig = sig; bar.innerHTML = progBarIc();
    if (tab === 'program' && !(document.activeElement && document.activeElement.id === 'progmetin')) { const t = $('#progtop'), l = $('#proglist'); if (t) t.innerHTML = progTopHtml(); if (l) l.innerHTML = progListHtml(); }
    return;
  }
  if (P.i >= 0) {
    const x = P.o[P.i], kalan = fmtSure((x.e - P.dk) * 60), oran = Math.min(100, (P.dk - x.b) / (x.e - x.b) * 100) + '%';
    $$('.pk, .pl').forEach(e => { e.textContent = kalan; }); $$('.pbi').forEach(e => { e.style.width = oran; });
    const big = $('#progtop .serif.goldl'); if (big) big.textContent = kalan;
  } else if (P.sonraki >= 0) { const nx = P.o[P.sonraki]; $$('.pk').forEach(e => { e.textContent = fmtSure((nx.b - P.dk) * 60); }); }
}
setInterval(progTik, 1000);
function etiketle() {
  $$('.yw table').forEach(t => { const hs = [...t.querySelectorAll('tr:first-child th')].map(x => x.textContent.trim()); $$('tr', t).forEach(tr => [...tr.children].forEach((td, i) => { if (td.tagName === 'TD') td.dataset.l = hs[i] || ''; })); });
}
const rozet = d => d === 'acik' ? '<span class="badge ok">Açık</span>' : d === 'bitti' ? '<span class="badge warn">Kapandı</span>' : '<span class="badge off">Hazır değil</span>';

/* ------------------------------------------------------------------ genel */
function genel() {
  let h = `<div class="g2"><div class="card" style="--ac:var(--gold)"><div class="eyebrow">Aşama</div><h2 style="margin:6px 0 4px">Çalıştay aşaması</h2><div class="muted" style="margin-bottom:12px">Perde ekranı ve telefonlardaki başlıklar bu aşamayı izler. Oylamaların kendisi masa bazında açılır/kapanır.</div>
    <div class="stage">${ASAMA.map(([k, v]) => `<button class="btn ${A.asama === k ? 'on' : ''}" data-act="asama" data-v="${k}">${v}</button>`).join('')}</div></div>
    <div class="card" style="--ac:var(--teal)"><div class="eyebrow teal">Katılım</div><div class="row" style="gap:18px;margin-top:10px;align-items:flex-start">${qrSvg(A.baseUrl + '/katil', 150)}<div><div class="serif" style="font-size:44px;font-weight:700;line-height:1">${A.katilimcilar.filter(k => k.bagli).length}<span class="muted" style="font-size:24px"> / ${A.katilimcilar.length}</span></div><div class="muted">katılımcı bağlı</div>
    <div style="margin-top:8px;font-size:14px" class="muted">Adres: <b class="goldl">${esc(A.baseUrl)}</b></div><div class="muted mini" style="margin-top:4px">Adres yanlışsa Ayarlar'dan değiştirin. Aynı Wi-Fi'ye bağlı olmak gerekir.</div></div></div></div></div>
    <div class="g2" style="margin-top:16px"><div class="card" style="--ac:var(--teal)"><div class="eyebrow teal">Süre sayacı</div><h2 style="margin:4px 0 4px">Ortak geri sayım</h2><div class="muted" style="margin-bottom:10px">Tüm telefonlarda ve perdede görünür (örn. serbest fikir geliştirme süresi). ${A.zaman && A.zaman.bitis > now() ? '<b class="goldl">Şu an: ' + esc(A.zaman.etiket || 'geri sayım') + ' · <span id="zadm">' + mmss(A.zaman.bitis - now()) + '</span></b>' : ''}</div>
    <label class="f" style="margin-bottom:10px">Etiket<input id="zetiket" placeholder="Örn. Fikir geliştirme" value="${esc(A.zaman ? A.zaman.etiket : '')}"></label>
    <div class="row wrap-f">${[5, 10, 15, 20].map(d => `<button class="btn sm teal" data-act="zaman" data-sn="${d * 60}">${d} dk</button>`).join('')}<input id="zozel" class="n" inputmode="numeric" placeholder="dk" style="width:70px;text-align:center"><button class="btn sm ghost" data-act="zaman-ozel">Başlat</button><button class="btn sm ghost" data-act="zaman" data-sn="0">Durdur</button></div></div>
    <div class="card" style="--ac:var(--gold)"><div class="eyebrow">Mola duyurusu</div><h2 style="margin:4px 0 4px">"Şimdi molaya çıkabilirsiniz"</h2><div class="muted" style="margin-bottom:10px">Tüm telefonlarda, moderatör panellerinde ve perdede mola uyarısı gösterir. ${A.mola ? '<b class="goldl">Şu an açık: ' + esc(A.mola.baslik) + '</b>' : ''}</div>
    <div class="row wrap-f"><button class="btn sm teal" data-act="mola" data-b="Kahve molası" data-dk="20">Kahve molası (20 dk)</button><button class="btn sm teal" data-act="mola" data-b="Ara" data-dk="20">Ara (20 dk)</button><button class="btn sm teal" data-act="mola" data-b="Öğle yemeği" data-dk="80">Öğle yemeği (80 dk)</button><button class="btn sm ghost" data-act="mola" data-b="" data-dk="0" data-kapat="1">Molayı bitir</button></div></div>
    <div class="card" style="--ac:var(--blue)"><div class="eyebrow blue">Masa içi fikir seçimi</div><h2 style="margin:4px 0 4px">Tema tablosu</h2><div class="muted" style="margin-bottom:10px">Tüm masaların telefonlarında tema tablosunu aynı anda açar veya kapatır. Her masanın moderatörü kendi masası için de açabilir.</div>
    <div class="row wrap-f"><button class="btn sm teal" data-act="tablo" data-i="tablo-ac">Tüm telefonlarda aç</button><button class="btn sm ghost" data-act="tablo" data-i="tablo-kapat">Kapat</button></div></div></div>
    <div class="card" style="--ac:var(--blue);margin-top:16px"><div class="row wrap-f"><div><div class="eyebrow blue">Masalar</div><h2 style="margin-top:4px">Oylama durumu</h2></div><span class="sp"></span>
    <button class="btn sm teal" data-act="toplu" data-t="G" data-i="ac">Tüm masalarda güçlü yön oylamasını aç</button><button class="btn sm ghost" data-act="toplu" data-t="G" data-i="kapat">Kapat</button>
    <button class="btn sm pink" data-act="toplu" data-t="Z" data-i="ac">Zayıf yön oylamasını aç</button><button class="btn sm ghost" data-act="toplu" data-t="Z" data-i="kapat">Kapat</button></div>
    <div class="scrollx" style="margin-top:8px"><table class="gt"><tr><th>Masa</th><th>Tema</th><th>Katılımcı</th><th>Güçlü</th><th>Zayıf</th><th>Fikir seçimi</th><th>Nihai fikir</th></tr>`;
  for (const m of A.masalar) {
    const f = A.fikirler.filter(x => x.masa === m.id && x.ad).length; const sg = (A.secimler || {})[m.id] || { durum: 'hazir', fikir: 0 };
    const hucre = t => { const x = m.tur[t]; return x.durum === 'hazir' ? `<span class="muted">${x.postit ? x.postit + ' post-it · ' + x.oy + ' oy' : '—'}</span>` : `${rozet(x.durum)} <b>${x.oyVeren}/${m.atanan}</b> <span class="muted mini">${x.oy} oy</span>`; };
    h += `<tr><td><b class="serif" style="font-size:20px">${esc(m.id)}</b></td><td class="muted">${esc(m.temaAd)}</td><td>${m.bagli}/${m.atanan}</td><td>${hucre('G')}</td><td>${hucre('Z')}</td><td>${({ hazir: 'Fikir girişi', sunum: 'Sunum', gozden: 'Gözden geçirme', bitti: 'Sonuç' })[sg.durum]} · <b>${sg.fikir}/${m.atanan}</b></td><td>${f}/${m.fikirSayisi}</td></tr>`;
  }
  return h + '</table></div></div>';
}

/* ------------------------------------------------------------ katılımcılar */
function filtreli() { return A.katilimcilar.filter(k => (filtre.masa === '' || (filtre.masa === '_yok' ? !k.masa : k.masa === filtre.masa)) && (!filtre.ara || (k.etiket + ' ' + (k.pozisyon || '') + ' ' + k.kod).toLowerCase().includes(filtre.ara.toLowerCase()))); }
function katilimci() {
  const masalar = A.masalar.map(m => m.id);
  const liste = filtreli();
  const sayac = Object.fromEntries(masalar.map(m => [m, A.katilimcilar.filter(k => k.masa === m).length])); const yok = A.katilimcilar.filter(k => !k.masa).length;
  let h = `<div class="card" style="--ac:var(--teal)"><div class="row wrap-f"><div><div class="eyebrow teal">Atama</div><h2 style="margin-top:4px">Katılımcılar ve masalar</h2></div><span class="sp"></span>
    <button class="btn sm teal" data-act="toplu-olustur">Her masaya 9 katılımcı oluştur</button><span class="muted mini">Yedek ID:</span><input id="yedek-adet" class="n" style="width:70px" value="10"><button class="btn sm ghost" data-act="yedek-uret">Üret (${A.katilimcilar.filter(k => k.yedek).length} boşta)</button>${A.katilimcilar.some(k => !k.masa && !k.yedek && !k.gelmeyecek) ? `<button class="btn sm ghost" data-act="atamasiz-sil">Atamasızları sil (${A.katilimcilar.filter(k => !k.masa && !k.yedek && !k.gelmeyecek).length})</button>` : ''}<button class="btn sm teal" data-act="liste-ac">ID listesi yapıştır</button><button class="btn sm" data-act="yazdir" data-v="id">Kartları yazdır (ID + ortak QR)</button><button class="btn sm ghost" data-act="yazdir" data-v="kisisel">Kişisel QR kartları</button></div>
    <div id="liste-kutu" class="hide" style="margin-top:12px"><div class="muted mini">Her satır: <b>ID;masa;ad soyad;pozisyon[;k]</b> (örnek: <i>4817;3A;Ayşe Yılmaz;Bölge Müdürü</i>; satırın sonuna <b>;k</b> yazılırsa o kişi masanın moderatörü olur). Hazır liste dosyasını (.txt/.csv) aşağıdan seçebilir ya da yapıştırabilirsiniz. Ad ve pozisyon sonradan da eklenebilir; aynı ID'yi tekrar yapıştırırsanız bilgiler güncellenir. ID kartta yazan kimliktir (3-12 harf/rakam). ID zaten varsa yalnızca masası güncellenir. Masa boşsa katılımcı atamasız kalır.</div><textarea id="liste-metin" placeholder="4817;3A;Ayşe Yılmaz;Bölge Müdürü&#10;4818;3A;Mehmet Kaya;Şube Müdürü&#10;5120;7B"></textarea><div class="row wrap-f" style="gap:8px;margin-top:8px"><button class="btn sm teal" data-act="liste-ekle">Ekle</button><label class="btn sm ghost" style="cursor:pointer">Dosyadan yükle (.txt / .csv)<input type="file" id="liste-dosya" accept=".txt,.csv,text/plain,text/csv" style="display:none"></label></div></div>
    <div class="row wrap-f" style="margin:12px 0;gap:6px">${masalar.map(m => `<span class="chip2" style="cursor:pointer;${filtre.masa === m ? 'border-color:var(--gold);color:var(--goldl)' : ''}" data-act="filtre" data-v="${m}">${m} · ${sayac[m]}</span>`).join('')}<span class="chip2" style="cursor:pointer;${filtre.masa === '_yok' ? 'border-color:var(--gold)' : ''}" data-act="filtre" data-v="_yok">Atanmamış · ${yok}</span><span class="chip2" style="cursor:pointer" data-act="filtre" data-v="">Tümü · ${A.katilimcilar.length}</span></div>
    <div class="tb"><input id="ara" placeholder="Ara (ad, pozisyon veya ID)" value="${esc(filtre.ara)}"><span class="muted">Seçilenleri taşı:</span><select id="tasi-masa"><option value="">(atamasız)</option>${masalar.map(m => `<option>${m}</option>`).join('')}</select><button class="btn sm" data-act="tasi">Taşı (${sec.size})</button><span class="sp"></span><span class="muted">${liste.length} kişi</span></div>
    <div class="scrollx"><table><tr><th><input type="checkbox" data-act="hepsi" style="width:auto"></th><th>Ad soyad</th><th>Pozisyon</th><th>Masa</th><th>ID</th><th title="Moderatör paneli açılır; yine de katılımcı olarak oy verir">Moderatör</th><th>Durum</th><th></th></tr>`;
  for (const k of liste.slice(0, 400)) {
    h += `<tr><td><input type="checkbox" data-act="sec" data-id="${k.id}" ${sec.has(k.id) ? 'checked' : ''} style="width:auto"></td><td><input data-ch="k.etiket" data-id="${k.id}" value="${esc(k.etiket)}" style="min-width:170px"></td><td><input data-ch="k.pozisyon" data-id="${k.id}" value="${esc(k.pozisyon || '')}" style="min-width:170px"></td>
      <td><select data-ch="k.masa" data-id="${k.id}"><option value="">—</option>${masalar.map(m => `<option ${k.masa === m ? 'selected' : ''}>${m}</option>`).join('')}</select></td><td><input data-ch="k.kod" data-id="${k.id}" value="${esc(k.kod)}" style="width:110px;font-weight:700;color:var(--goldl)"></td><td><input type="checkbox" data-ch="k.kolay" data-id="${k.id}" ${k.kolay ? 'checked' : ''} style="width:auto"></td>
      <td>${k.geldi ? '<span class="badge ok">geldi</span> ' : ''}<span class="dot ${k.bagli ? 'on' : ''}" title="${k.bagli ? 'bağlı' : 'bağlı değil'}"></span>${k.cihaz > 1 ? ' <span class="badge warn" title="Aynı ID birden fazla cihazdan kullanıldı">' + k.cihaz + ' cihaz</span>' : ''}</td><td style="white-space:nowrap"><button class="btn sm ghost" data-act="kopya" data-v="${A.baseUrl}/p/${k.token}">Bağlantı</button> ${k.cihaz ? `<button class="btn sm ghost" data-act="cihaz-sifirla" data-id="${k.id}">Cihazı sıfırla</button> ` : ''}<button class="btn sm ghost" data-act="ksil" data-id="${k.id}">Sil</button></td></tr>`;
  }
  return h + '</table></div></div>';
}

/* ------------------------------------------------------------------ masalar */
function kolay() {
  const kol = A.katilimcilar.filter(k => k.kolay).sort((a, b) => (a.masa || '~').localeCompare(b.masa || '~', 'tr') || a.etiket.localeCompare(b.etiket, 'tr'));
  const mas = A.masalar.map(m => m.id);
  const eksik = mas.filter(m => !kol.some(k => k.masa === m));
  const opt = `<option value="">Masa seçin…</option>` + mas.map(m => `<option>${m}</option>`).join('');
  const digerleri = A.katilimcilar.filter(k => !k.kolay).sort((a, b) => a.etiket.localeCompare(b.etiket, 'tr'));
  let h = `<div class="card" style="--ac:var(--gold)"><div class="eyebrow">Moderatörler</div><h2 style="margin:4px 0 6px">${kol.length} moderatör · ${mas.length - eksik.length} / ${mas.length} masada var</h2>
    <div class="muted" style="margin-bottom:10px">Moderatörler katılımcı değildir: oy vermez, fikir girmez, puanlamaz; yalnızca masayı yürütür. Telefonlarında "Moderatör paneli" açılır; ayrıca katılımcıların gördüğü ekranı salt okunur izleyebilirler.</div>
    <div class="row wrap-f" style="gap:6px">${mas.map(m => { const l = kol.filter(k => k.masa === m); return `<span class="chip2" style="${l.length ? '' : 'border-color:var(--pink);color:var(--pink)'}"><b>${m}</b> · ${l.length ? l.map(k => esc(k.etiket)).join(', ') : 'yok'}</span>`; }).join('')}</div>
    ${eksik.length ? `<div class="row wrap-f" style="margin-top:12px"><span class="warn">Moderatörü olmayan masalar: ${eksik.join(', ')}</span><span class="sp"></span><button class="btn sm ghost" data-act="kol-eksik" title="Deneme için; gerçek isimleri sonra düzeltin">Eksik masalara geçici moderatör oluştur</button></div>` : ''}</div>
    <div class="card" style="--ac:var(--teal);margin-top:16px"><div class="eyebrow teal">Ekle</div><h2 style="margin:4px 0 8px">Yeni moderatör</h2>
    <div class="row wrap-f" style="gap:10px;align-items:flex-end"><label class="f" style="flex:1;min-width:180px">Ad soyad<input id="kad"></label><label class="f" style="flex:1;min-width:160px">Pozisyon / birim<input id="kpoz"></label><label class="f" style="min-width:130px">Masa<select id="kmasa">${opt}</select></label><button class="btn" data-act="kol-ekle">Ekle</button></div>
    <div class="muted mini" style="margin:14px 0 6px">Ya da listedeki bir katılımcıyı moderatör yapın:</div>
    <div class="row wrap-f" style="gap:10px"><select id="kmevcut" style="flex:1;min-width:240px"><option value="">Katılımcı seçin…</option>${digerleri.map(k => `<option value="${k.id}">${esc(k.etiket)} · ${esc(k.masa || 'atamasız')} · ${esc(k.kod)}</option>`).join('')}</select><button class="btn sm ghost" data-act="kol-yap">Moderatör yap</button></div></div>
    <div class="card" style="--ac:var(--blue);margin-top:16px"><div class="eyebrow blue">Liste</div><div class="scrollx"><table><tr><th>Masa</th><th>Ad soyad</th><th>Pozisyon</th><th>ID</th><th>Durum</th><th>Bağlantı</th><th></th></tr>`;
  for (const k of kol) {
    h += `<tr><td><select data-ch="k.masa" data-id="${k.id}"><option value="">—</option>${mas.map(m => `<option ${k.masa === m ? 'selected' : ''}>${m}</option>`).join('')}</select></td>
      <td><input data-ch="k.etiket" data-id="${k.id}" value="${esc(k.etiket)}" style="min-width:170px"></td><td><input data-ch="k.pozisyon" data-id="${k.id}" value="${esc(k.pozisyon || '')}" style="min-width:150px"></td>
      <td><b class="goldl">${esc(k.kod)}</b></td><td>${k.geldi ? '<span class="badge ok">geldi</span> ' : ''}<span class="dot ${k.bagli ? 'on' : ''}" title="${k.bagli ? 'bağlı' : 'bağlı değil'}"></span></td>
      <td style="white-space:nowrap">${k.masa ? `<button class="btn sm ghost" data-act="kopya" data-v="${A.baseUrl}/masa/${k.masa}?t=${k.token}">Panel bağlantısı</button>` : ''}</td>
      <td><button class="btn sm ghost" data-act="kol-cikar" data-id="${k.id}" title="Kişi katılımcı olarak kalır">Moderatörlükten çıkar</button></td></tr>`;
  }
  return h + (kol.length ? '' : '<tr><td colspan="7" class="muted">Henüz moderatör yok.</td></tr>') + '</table></div></div>';
}
let oyTur = 'G', oyEksik = false;
function oyDurum() { // kim oy kullandı, kim kullanmadı (içerik değil, yalnızca durum)
  const kat = A.katilimcilar.filter(k => k.masa), voted = kat.filter(k => k.oy[oyTur]).length, ad = oyTur === 'G' ? 'Güçlü yönler' : 'Zayıf yönler';
  let h = `<div class="card" style="--ac:var(--blue);margin-top:16px"><div class="row wrap-f"><div><div class="eyebrow blue">Oy durumu</div><h2 style="margin:4px 0 0">${ad}: ${voted} / ${kat.length} kişi oy kullandı</h2></div><span class="sp"></span>
    <button class="btn sm ${oyTur === 'G' ? 'teal' : 'ghost'}" data-act="oy-tur" data-v="G">Güçlü</button><button class="btn sm ${oyTur === 'Z' ? 'pink' : 'ghost'}" data-act="oy-tur" data-v="Z">Zayıf</button>
    <label class="muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-act="oy-eksik" ${oyEksik ? 'checked' : ''} style="width:auto"> Yalnızca oy kullanmayanlar</label></div><div class="og" style="margin-top:12px">`;
  for (const m of A.masalar) {
    const l = kat.filter(k => k.masa === m.id).sort((a, b) => (a.oy[oyTur] - b.oy[oyTur]) || a.etiket.localeCompare(b.etiket, 'tr')), v = l.filter(k => k.oy[oyTur]).length, durum = m.tur[oyTur].durum;
    if (oyEksik && v === l.length) continue;
    h += `<div class="ob ${l.length && v === l.length ? 'tam' : ''}"><div class="row"><b class="serif" style="font-size:18px">${esc(m.id)}</b><span class="sp"></span><span class="mini muted">${durum === 'hazir' ? 'oylama yok' : durum === 'acik' ? 'açık' : 'kapandı'}</span><b class="${v === l.length && l.length ? 'teal' : 'warn'}">${v}/${l.length}</b></div>`
      + l.filter(k => !oyEksik || !k.oy[oyTur]).map(k => `<div class="or ${k.oy[oyTur] ? 'ok' : 'no'}">${k.oy[oyTur] ? '✓' : '○'} ${esc(k.etiket)}${k.kolay ? ' <span class="mini">(K)</span>' : ''}</div>`).join('') + '</div>';
  }
  return h + '</div></div>';
}
function masalar() {
  let h = `<div class="card" style="--ac:var(--gold)"><div class="row wrap-f"><div><div class="eyebrow">Masa ayarları</div><h2 style="margin-top:4px">Masalar</h2></div><span class="sp"></span><button class="btn sm ghost" data-act="masa-ekle">Masa ekle</button></div>
    <div class="scrollx"><table><tr><th>Masa</th><th>Ad</th><th>Tema</th><th>Fikir sayısı</th><th>Fikir adı kilidi</th><th>Masa ekranı</th><th></th></tr>`;
  for (const m of A.masalar) h += `<tr><td><b class="serif" style="font-size:20px">${esc(m.id)}</b></td><td><input data-ch="m.ad" data-id="${m.id}" value="${esc(m.ad)}" style="width:150px"></td>
    <td><select data-ch="m.tema" data-id="${m.id}">${A.temalar.map((t, i) => `<option value="${i + 1}" ${m.tema === i + 1 ? 'selected' : ''}>${i + 1} · ${esc(t)}</option>`).join('')}</select></td>
    <td><select data-ch="m.fikirSayisi" data-id="${m.id}">${[1, 2, 3, 4].map(n => `<option ${m.fikirSayisi === n ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
    <td><input type="checkbox" data-ch="m.fikirKilit" data-id="${m.id}" ${m.fikirKilit ? 'checked' : ''} style="width:auto"></td>
    <td style="white-space:nowrap"><button class="btn sm ghost" data-act="kopya" data-v="${A.baseUrl}/masa/${m.id}?k=${m.key}">Bağlantıyı kopyala</button> <a class="btn sm ghost" style="text-decoration:none" target="_blank" href="/masa/${m.id}?k=${m.key}">Aç ↗</a></td><td><button class="btn sm ghost" data-act="masa-sil" data-id="${m.id}">Sil</button></td></tr>`;
  h += `</table></div></div>${oyDurum()}<div class="card" style="--ac:var(--teal);margin-top:16px"><div class="eyebrow teal">SWOT oylaması</div><h2 style="margin:4px 0 6px">Oy sayıları (masa bazında)</h2>
    <div class="muted" style="margin-bottom:8px">Önerilen oy hakkı, flipchart'taki post-it sayısının yarısıdır (en çok 15); aynı post-it'e en fazla 2 oy verilir. Flipchart'taki her post-it oylanabilir bir seçenektir; oy sayısı post-it sayısından büyükse "aynı post-it'e en fazla" değerini de artırın. Güçlü yanlar kapanmadan zayıf yanlar açılmaz.</div>
    <div class="scrollx"><table><tr><th>Masa</th><th>Tür</th><th>Post-it</th><th>Oy (öneri)</th><th>Aynı post-it'e en fazla</th><th>İlk K</th><th>Durum</th><th>İşlem</th></tr>`;
  for (const m of A.masalar) for (const tur of ['G', 'Z']) {
    const t = m.tur[tur], dis = t.durum !== 'hazir' ? 'disabled' : '';
    h += `<tr data-row="${m.id}.${tur}"><td><b class="serif">${esc(m.id)}</b></td><td>${tur === 'G' ? '<span class="teal">Güçlü</span>' : '<span class="pinkc">Zayıf</span>'}</td>
      <td><input class="n" data-f="postit" value="${t.postit || ''}" ${dis}></td>
      <td><input class="n" data-f="oy" value="${t.oy || ''}" ${dis}> <span class="muted mini">(${t.postit ? oneriOy(t.postit) : '–'})</span></td><td><input class="n" data-f="maxPer" value="${t.maxPer}" ${dis}></td><td><input class="n" data-f="ilkK" value="${t.ilkK}" ${dis}></td>
      <td>${rozet(t.durum)} ${t.seansKapali ? '<span class="badge ok" title="Moderatör ilk bulguları kaydetti">seans kapandı</span> ' : ''}${t.durum !== 'hazir' ? `<span class="mini">${t.oyVeren}/${m.atanan}</span>` : ''}${t.durum === 'hazir' && t.hata && t.postit ? `<div class="mini warn">${esc(t.hata)}</div>` : ''}</td>
      <td style="white-space:nowrap">${t.durum === 'hazir' ? `<button class="btn sm ghost" data-act="tur-kaydet" data-m="${m.id}" data-t="${tur}">Kaydet</button> <button class="btn sm ${tur === 'G' ? 'teal' : 'pink'}" data-act="tur-ac" data-m="${m.id}" data-t="${tur}">Aç</button>`
        : t.durum === 'acik' ? `<button class="btn sm" data-act="tur-islem" data-i="kapat" data-m="${m.id}" data-t="${tur}">Kapat</button>` : `<button class="btn sm ghost" data-act="tur-islem" data-i="yeniden-ac" data-m="${m.id}" data-t="${tur}">Yeniden aç</button>`}
        ${t.seansKapali ? `<button class="btn sm ghost" data-act="tur-islem" data-i="seans-ac" data-m="${m.id}" data-t="${tur}" title="Oylama kapalı kalır; moderatör içerikleri düzeltip yeniden kaydeder">Seansı aç</button>` : ''}
        ${t.durum !== 'hazir' ? `<button class="btn sm ghost" data-act="tur-islem" data-i="sifirla" data-m="${m.id}" data-t="${tur}" title="Oyları siler">Sıfırla</button>` : ''}</td></tr>`;
  }
  return h + '</table></div></div>';
}

/* --------------------------------------------------------- fikirler ve sunum */
function sunum() {
  const s = A.sunum, f = s.fikir;
  const liste = A.fikirler.slice().sort((a, b) => (a.no == null ? 999 : a.no) - (b.no == null ? 999 : b.no) || a.id.localeCompare(b.id));
  let h = `<div class="card" style="--ac:var(--gold)"><div class="eyebrow">Sunum kontrolü</div>`;
  if (f) {
    const dur = { hazir: 'Hazır', sunum: 'Sunum sürüyor', puan: 'Puanlama açık', kapali: 'Puanlama kapandı' }[s.durum];
    h += `<div class="sun" style="margin-top:10px"><div class="no">${f.no}</div><div style="flex:1;min-width:260px"><div class="nm">${esc(f.ad)}</div><div class="muted" style="margin-top:6px">Masa ${esc(f.masa)} · ${esc(f.temaAd)} · <b class="goldl">${dur}</b> ${s.durum === 'puan' ? ` · <b id="acd" class="goldl">${s.puanKapanis ? mmss(s.puanKapanis - now()) : 'süresiz'}</b>` : ''}${s.durum === 'sunum' ? ` · <b id="acd" class="goldl">${mmss(s.sunumBas + s.sunumSn * 1000 - now())}</b>` : ''}</div></div>
      <div style="min-width:190px"><div class="muted mini">Puan veren</div><div class="serif" style="font-size:38px;font-weight:700"><span class="teal">${s.puanVeren}</span><span class="muted" style="font-size:22px"> / ${s.katilimci}</span></div><div class="bar" style="--ac:var(--teal)"><i style="width:${s.katilimci ? s.puanVeren / s.katilimci * 100 : 0}%"></i></div><div class="mini" style="margin-top:6px;font-weight:700;color:${s.puanVeren >= s.esik ? 'var(--teall)' : 'var(--goldl)'}">${s.puanVeren >= s.esik ? '✓' : '⚠'} %${s.katilimci ? Math.round(s.puanVeren / s.katilimci * 100) : 0} · kabul eşiği %${A.ayar.minPuanYuzde == null ? 80 : A.ayar.minPuanYuzde} (${s.esik} puan)${s.puanVeren >= s.esik ? '' : ' · pencereyi uzatın'}</div></div></div>
      <div class="row wrap-f" style="margin-top:14px"><button class="btn ghost" data-act="sunum" data-i="onceki">◀ Önceki</button><button class="btn teal" data-act="sunum" data-i="baslat">Sunumu başlat (${mmss(A.ayar.sunumSn * 1000)})</button><button class="btn" data-act="sunum" data-i="puan-ac">Puanlamayı aç${A.ayar.puanSn ? ' (' + A.ayar.puanSn + ' sn)' : ''}</button>
      <button class="btn ghost" data-act="sunum" data-i="uzat">+15 sn</button><button class="btn ghost" data-act="sunum" data-i="puan-kapat">Puanlamayı kapat</button><button class="btn" data-act="sunum" data-i="sonraki">Sonraki öneri ▶</button></div>`;
  } else h += `<p class="muted" style="margin-top:8px">Henüz öneri seçilmedi. Fikirleri numaralandırın, ardından listeden bir önerinin "Sun" düğmesine basın veya "İlk öneriyi seç" deyin.</p><button class="btn teal" data-act="ilk">İlk öneriyi seç</button>`;
  h += `</div><div class="card" style="--ac:var(--teal);margin-top:16px"><div class="row wrap-f"><div><div class="eyebrow teal">Proje fikirleri</div><h2 style="margin-top:4px">Masaların yazdığı fikirler</h2></div><span class="sp"></span>
    <button class="btn sm teal" data-act="numara" data-i="kura">Kura ile numaralandır</button><button class="btn sm ghost" data-act="numara" data-i="sirali">Masa sırasıyla numaralandır</button></div>
    <div class="muted mini" style="margin:6px 0">Kura: masaların sunum sırası rastgele belirlenir; her masanın fikirleri art arda numaralanır. Numarayı elle de değiştirebilirsiniz.</div>
    <div class="scrollx"><table><tr><th>No</th><th>Masa</th><th>Fikir adı</th><th>Puan</th><th></th></tr>`;
  for (const x of liste) h += `<tr><td><input class="n" data-ch="f.no" data-id="${x.id}" value="${x.no == null ? '' : x.no}"></td><td><b>${esc(x.masa)}</b></td><td><input data-ch="f.ad" data-id="${x.id}" value="${esc(x.ad)}" style="min-width:420px"></td><td>${A.puanSayilari[x.id] || 0}</td>
    <td style="white-space:nowrap">${x.no != null && x.ad ? `<button class="btn sm ${s.aktif === x.id ? '' : 'ghost'}" data-act="sun" data-id="${x.id}">Sun</button> ` : ''}<button class="btn sm ghost" data-act="fsil" data-id="${x.id}">Sil</button></td></tr>`;
  if (!liste.length) h += '<tr><td colspan="5" class="muted">Henüz fikir yok. Masalar kendi ekranlarından yazar (veya Ayarlar › Deneme araçları).</td></tr>';
  return h + '</table></div></div>' + pptxKart();
}
function pptxKart() { // masaların gönderdiği öneri detaylarından tek PowerPoint
  const dd = A.detayDurum || {}, ml = A.masalar.map(m => ({ id: m.id, d: dd[m.id] || { toplam: 0, gonderilen: 0 } })), top = ml.reduce((x, y) => x + y.d.toplam, 0), gon = ml.reduce((x, y) => x + y.d.gonderilen, 0);
  return `<div class="card" style="--ac:var(--blue);margin-top:16px"><div class="row wrap-f"><div><div class="eyebrow blue">Sunum slaytları</div><h2 style="margin:4px 0 0">Öneri detayları: ${gon} / ${top} gönderildi</h2></div></div>
    <div class="muted mini" style="margin:6px 0 10px">Genel kurulda önerinin slaytı perdede (/ekran) otomatik gösterilir: başlık, otomatik SWOT dayanağı ve beş kısa alan. Gönderilmemiş alanlar "(henüz doldurulmadı)" görünür; masalar düzeltip yeniden gönderirse slayt güncellenir.</div>
    <div class="og">${ml.map(x => `<div class="ob ${x.d.toplam && x.d.gonderilen === x.d.toplam ? 'tam' : ''}"><div class="row"><b class="serif" style="font-size:18px">${esc(x.id)}</b><span class="sp"></span><b class="${x.d.toplam && x.d.gonderilen === x.d.toplam ? 'teal' : 'warn'}">${x.d.gonderilen}/${x.d.toplam}</b></div></div>`).join('')}</div></div>`;
}

/* -------------------------------------------------------------------- sonuç */
function sonuc() {
  const mt = A.matris, i = A.ayar.sonucSlayt;
  return `<div class="g2"><div class="card" style="--ac:var(--gold)"><div class="eyebrow">Yayın</div><h2 style="margin:4px 0 8px">Sonuçları göster</h2><div class="muted" style="margin-bottom:10px">Sonuç aşamasında matris hem perdede hem telefonlarda görünür. Perdede 5 slayt vardır: matris ve dört bölgenin listeleri.</div>
    <div class="row wrap-f"><button class="btn ${A.asama === 'sonuc' ? '' : 'teal'}" data-act="asama" data-v="sonuc">${A.asama === 'sonuc' ? '✓ Sonuç yayında' : 'Sonuçları yayına al'}</button><button class="btn ghost" data-act="asama" data-v="sunum">Sunuma dön</button></div>
    <div class="row wrap-f" style="margin-top:14px;gap:8px"><span class="muted">Perde slaytı:</span><button class="btn sm ghost" data-act="slayt" data-v="${Math.max(0, i - 1)}">◀</button>${[0, 1, 2, 3, 4].map(k => `<button class="btn sm ${k === i ? '' : 'ghost'}" data-act="slayt" data-v="${k}">${['Matris', 'Hızlı', 'Stratejik', 'Sınırlı', 'Bekle'][k]}</button>`).join('')}<button class="btn sm ghost" data-act="slayt" data-v="${Math.min(4, i + 1)}">▶</button></div></div>
    <div class="card" style="--ac:var(--blue)"><div class="eyebrow blue">Matris ayarları</div><h2 style="margin:4px 0 8px">Bölge çizgileri</h2><div class="tb"><label class="f">Çizgi<select id="esik"><option value="orta" ${A.ayar.esik === 'orta' ? 'selected' : ''}>Sabit orta nokta</option><option value="ortalama" ${A.ayar.esik === 'ortalama' ? 'selected' : ''}>Önerilerin ortalaması</option></select></label>
    <label class="f">Orta nokta (1–5)<input id="esikdeger" class="n" style="width:90px" value="${A.ayar.esikDeger}"></label><label class="f">Görüş ayrılığı eşiği (std. sapma)<input id="ayrilik" class="n" style="width:90px" value="${A.ayar.ayrilikEsigi}"></label><button class="btn sm" data-act="esik-kaydet">Kaydet</button></div>
    ${mt.puansiz && mt.puansiz.length ? `<div style="margin:8px 0;font-weight:700;color:var(--goldl)">⚠ Puan almayan ${mt.puansiz.length} öneri matriste görünmez: ${mt.puansiz.map(p => p.no + ' (' + esc(p.masa) + ')').join(', ')}. Sunumda atlanmış olabilir; Fikirler ve sunum sekmesinden o öneriyi seçip puanlamayı açın.</div>` : ''}
    <div class="muted mini">Çizgiler şu an: etki ${fmt(mt.esikEtki)} · uygulanabilirlik ${fmt(mt.esikUyg)}. "Önerilerin ortalaması" seçilirse bölgeler, öneriler arasındaki farkı daha belirgin gösterir.</div>
    <div class="row wrap-f" style="margin-top:12px"><button class="btn sm ghost" data-act="csv" data-v="bulgular.csv">SWOT bulguları (CSV)</button><button class="btn sm ghost" data-act="csv" data-v="matris.csv">Matris (CSV)</button><button class="btn sm ghost" data-act="csv" data-v="puanlar.csv">Tüm puanlar (CSV)</button><button class="btn sm ghost" data-act="csv" data-v="oylar.csv">SWOT oyları (CSV)</button><button class="btn sm ghost" data-act="csv" data-v="katilimcilar.csv">ID–masa listesi (CSV, adlı)</button></div></div></div>
    <div class="g2" style="margin-top:16px;align-items:start"><div class="card mat" style="--ac:var(--gold)">${mt.oge.length ? matrisSVG(mt, { w: 760, h: 540, r: 16 }) : '<p class="muted">Henüz puanlanmış öneri yok.</p>'}</div><div class="col">${['hizli', 'stratejik', 'sinirli', 'beklet'].map(k => ceyrekKart(k, mt.ceyrekler[k])).join('')}</div></div>`;
}

/* ------------------------------------------------------------ hazırlık listesi */
function hazirlikMaddeler() {
  const a = A.ayar, kat = A.katilimcilar, ms = A.masalar, tek = (id) => kat.filter(k => k.masa === id), geceici = kat.filter(k => /^Deneme /.test(k.etiket) || /^Moderatör [0-9][AB]$/.test(k.etiket));
  const masasiz = kat.filter(k => !k.masa).length, kolaySiz = ms.filter(m => !tek(m.id).some(k => k.kolay)).map(m => m.id), azKisi = ms.filter(m => tek(m.id).filter(k => !k.kolay).length < 3).map(m => m.id);
  const oyVar = A.fikirler.length || (A.matris && A.matris.oge.length);
  const oto = (ok, not) => ({ ok, not });
  return [
    ['Çalıştaydan 1–2 gün önce', [
      ['sunucu', 'Sunucu bilgisayarı hazır: kablolu ağ, şarjda, uyku modu ve ekran koruyucu kapalı, bildirimler kapalı'],
      ['wifi', 'Salon Wi-Fi\'si 140+ cihazı kaldırıyor; "istemci yalıtımı" kapalı; telefondan sunucu adresi açılıyor (salonda denendi)'],
      ['perde', 'Perde/projeksiyon: Perde ekranı (/ekran) tam ekran, çözünürlük ve yazı okunabilirliği salonda denendi'],
      ['telefon', 'Katılımcı sayfası hem iPhone (Safari) hem Android (Chrome) telefonda denendi'],
      ['rehber', 'Yöneticiler ve moderatörler rehberlerini aldı ve okudu'],
      ['pin', 'Yönetim PIN\'i ve kayıt PIN\'i varsayılandan değiştirildi', oto(!A.pinVarsayilan && !A.kayitPinVarsayilan, A.pinVarsayilan ? 'Yönetim PIN\'i hâlâ varsayılan (ADMIN_PIN ile başlatın)' : A.kayitPinVarsayilan ? 'Kayıt PIN\'i hâlâ varsayılan (KAYIT_PIN ile başlatın)' : '')],
      ['adres', 'Telefonların açacağı adres ayarlandı (Ayarlar › QR adresi)', oto(!!a.baseUrl, 'Ayarlar sekmesinde adresi girin; QR ve bağlantılar bunu kullanır')],
    ]],
    ['Katılımcı ve masa verisi', [
      ['liste', 'Katılımcı listesi yüklendi (ad soyad, masa, moderatör işareti)', oto(kat.length > 0 && !masasiz, kat.length ? (masasiz + ' kişinin masası yok') : 'Katılımcı yok; Katılımcılar sekmesinden yükleyin')],
      ['kolay', 'Her masada tam 1 moderatör var', oto(!kolaySiz.length && ms.every(m => tek(m.id).filter(k => k.kolay).length === 1), kolaySiz.length ? 'Moderatörü olmayan masa: ' + kolaySiz.join(', ') : 'Bazı masalarda birden fazla moderatör var')],
      ['kisi', 'Her masada en az 3 katılımcı var (fikir seçimi için en az 2 fikir gerekir; moderatör sayılmaz)', oto(!azKisi.length, 'Az kişili masa: ' + azKisi.join(', '))],
      ['temiz', 'Deneme/demo verisi temizlendi (deneme katılımcıları, fikirler, puanlar)', oto(!geceici.length && !oyVar, (geceici.length ? geceici.length + ' deneme katılımcısı ' : '') + (oyVar ? 'öneri/puan verisi var ' : '') + '- Ayarlar › Deneme araçları › "Her şeyi sil" ile temizleyin')],
      ['kart', 'Katılım kimlikleri (ID kartı/QR) ve moderatör bağlantıları basıldı/dağıtıldı'],
      ['kayit', 'Kayıt masası ekibi var, kayıt PIN\'i kayıt ekibinde']
    ]],
    ['Sistem ayarları', [
      ['sure', 'Süreler: sunum 165 sn (2:45), puanlama 30 sn', oto(a.sunumSn === 165 && a.puanSn === 30, 'Şu an sunum ' + a.sunumSn + ' sn, puan ' + a.puanSn + ' sn (Ayarlar sekmesi)')],
      ['kendi', 'Kendi masanın önerisini puanlama kapalı', oto(!a.kendiMasaPuan, 'Ayarlar sekmesinden kapatın')],
      ['otokapat', 'Puanlama otomatik kapanıyor', oto(!!a.otoKapat, 'Ayarlar sekmesinden açın')],
      ['program', 'Program (Program sekmesi) gözden geçirildi; saatler Halkbank ile onaylandı'],
    ]],
    ['Çalıştay sabahı (08.10–08.30)', [
      ['sabah-sunucu', 'Sunucu açık, yönetim paneli ve perde açık; saat doğru'],
      ['sabah-baglanti', 'Birkaç telefon ve her masanın moderatör bağlantısı çalışıyor', oto(A.katilimcilar.filter(k => k.bagli).length > 0, 'Şu an hiç bağlı cihaz yok')],
      ['sabah-kolay', 'Moderatör kısa toplantısı yapıldı: süre uyarıları, 2:45 sunum, masada anlatma, detay doldurma'],
      ['sabah-mod', 'Yöneticiler süre uyarı düzenini ve kapanış mesajlarını hatırlıyor'],
      ['sabah-teknik', 'Teknik destek kişisi belli ve salonda'],
    ]],
    ['Gün sonu', [
      ['son-csv', 'Çıktılar indirildi: matris, puanlar, SWOT oyları, adlı katılımcı listesi (CSV)'],
      ['son-sil', 'Veri silindi (Ayarlar › Deneme araçları › Her şeyi sil), sunucu kapatıldı'],
    ]],
  ];
}
function hazirlik() {
  const gr = hazirlikMaddeler(), hz = A.hazirlik || {}; let top = 0, ok = 0;
  const satir = ([id, ad, o]) => { const otoMu = !!o, tamam = otoMu ? o.ok : !!hz[id]; top++; if (tamam) ok++;
    return `<label class="row" style="gap:12px;align-items:flex-start;padding:9px 4px;border-top:1px solid rgba(255,255,255,.07);cursor:${otoMu ? 'default' : 'pointer'}">
      ${otoMu ? `<span style="width:22px;text-align:center;font-weight:700;color:${tamam ? 'var(--teall)' : 'var(--pinkl,#ff8fb5)'}">${tamam ? '✓' : '!'}</span>` : `<input type="checkbox" data-hz="${id}" ${tamam ? 'checked' : ''} style="width:22px;height:22px;margin-top:2px">`}
      <span style="flex:1"><span style="${tamam ? 'opacity:.7' : ''}">${esc(ad)}</span>${otoMu ? ` <span class="muted mini">· otomatik kontrol</span>` : ''}${otoMu && !tamam && o.not ? `<br><span class="mini" style="color:var(--goldl)">${esc(o.not)}</span>` : ''}</span></label>`; };
  const govde = gr.map(([b, l]) => `<div class="card" style="--ac:var(--gold);margin-top:14px"><h2 style="margin:0 0 4px;font-size:20px">${esc(b)}</h2>${l.map(satir).join('')}</div>`).join('');
  return `<div class="card" style="--ac:var(--teal)"><div class="row wrap-f"><div><div class="eyebrow teal">Çalıştay öncesi</div><h2 style="margin:4px 0 0">Hazırlık listesi: ${ok} / ${top} tamam</h2></div><span class="sp"></span><button class="btn sm ghost" data-act="hz-sifirla">Elle işaretleri temizle</button></div>
    <div class="bar" style="margin-top:12px;--ac:var(--teal)"><i style="width:${top ? ok / top * 100 : 0}%"></i></div>
    <div class="muted mini" style="margin-top:8px">"otomatik kontrol" maddeleri sistemden okunur ve kendiliğinden işaretlenir. Diğerlerini ilgili kişi yaptığında işaretleyin; işaretler herkesle ortaktır ve kaydedilir.</div></div>${govde}`;
}

/* -------------------------------------------------------- yönetici demo akışı: adım adım, tek tıkla */
const ASAMA_SIRA = ['hazirlik', 'guclu', 'zayif', 'fikir', 'sunum', 'sonuc'];
let demoAcik = new Set();
function demoAdimlar() {
  const M = A.masalar, n = M.length, kat = A.katilimcilar, kol = kat.filter(k => k.kolay && k.masa), kolBagli = kol.filter(k => k.bagli).length;
  const say = f => M.filter(f).length, ai = ASAMA_SIRA.indexOf(A.asama);
  const sec = id => A.secimler[id] || { durum: 'hazir', fikir: 0, onay: false };
  const turAcildi = t => say(m => m.tur[t].durum !== 'hazir'), turKapali = t => say(m => m.tur[t].seansKapali);
  const oyTam = t => say(m => m.tur[t].durum !== 'hazir' && m.tur[t].oyVeren >= Math.max(1, m.atanan));
  const fikirTam = say(m => sec(m.id).fikir >= Math.max(2, m.atanan)), onayli = say(m => sec(m.id).onay);
  const dd = A.detayDurum || {}, dTop = Object.values(dd).reduce((x, y) => x + y.toplam, 0), dGon = Object.values(dd).reduce((x, y) => x + y.gonderilen, 0);
  const fk = A.fikirler.filter(f => f.ad), numarali = fk.length > 0 && fk.every(f => f.no != null);
  const puanlanan = fk.filter(f => (A.puanSayilari[f.id] || 0) > 0).length, sn = A.sunum || {};
  const eksikMasa = f => M.filter(m => !f(m)).map(m => m.id).join(', ');
  const sw = (t, ad, asm, sure) => [
    [t + '-basla', ad + ': tur başlıyor', 'Masada brainwriting yapılmış gibi davranılır (demoda yalnızca anlatılır). Flipchart\'taki post-it sayısı belirlenir.', ai >= ASAMA_SIRA.indexOf(asm), ai >= ASAMA_SIRA.indexOf(asm) ? 'Aşama açık' : 'Aşama henüz açılmadı', [['Aşamayı "' + ad + ' oylaması" yap', 'asama:' + asm], ['Süre sayacı ' + sure + ' dk', 'zaman:' + (sure * 60) + ':' + ad + ' · post-it yazımı', 1]]],
    [t + '-ac', ad + ': oylama açıldı', 'Moderatör flipchart\'taki post-it sayısını girip "Oylamayı aç" der.', turAcildi(t) === n, turAcildi(t) + ' / ' + n + ' masada oylama açıldı' + (turAcildi(t) < n ? ' · açmayanlar: ' + eksikMasa(m => m.tur[t].durum !== 'hazir') : ''), [['Açmayan masalarda oylamayı aç (yedek)', 'swot-ac:' + t, 1]]],
    [t + '-oy', ad + ': katılımcı oyları', 'Katılımcılar telefonlarından oy verir (tüm oylarını kullanmadan gönderemezler). Demoda katılımcılar salonda olmadığı için oyları sistem üretir; moderatör bu adımda yalnızca izler.', oyTam(t) === n, oyTam(t) + ' / ' + n + ' masada tüm katılımcı oyları tamam', [['Demo katılımcı oylarını üret', 'oy'], ['Eşitlik oluştur: ilk 5 sınırında', 'esit-swot:' + t, 2]]],
    [t + '-kapat', ad + ': kapanış', 'Moderatör oylamayı kapatır; eşitlik varsa masa çözer ya da dar oylama/kura; ilk 5 post-it\'in içeriğini yazar; seansı kapatır.', turKapali(t) === n, turKapali(t) + ' / ' + n + ' masada seans kapandı' + (turKapali(t) < n ? ' · bekleyenler: ' + eksikMasa(m => m.tur[t].seansKapali) : ''), [['Demo dar oylama oylarını üret', 'dar-oy'], ['Dar oylamada beraberlik çıkar (kura)', 'dar-oy-esit', 2], ['Kalan masaları otomatik tamamla (yedek)', 'swot-bitir:' + t, 1]]]
  ];
  return [
    ['Hazırlık', [
      ['giris', 'Moderatörler sisteme girdi', 'Her moderatör kendi ID\'siyle adresi açar; doğrudan masasının Moderatör paneli açılır (üstteki düğmeyle katılımcı görünümü salt okunur izlenebilir).', kol.length > 0 && kolBagli === kol.length, kolBagli + ' / ' + kol.length + ' moderatör bağlı' + (kolBagli < kol.length ? ' · bağlanmayanlar: ' + kol.filter(k => !k.bagli).map(k => k.masa).join(', ') : ''), []],
      ['hazir', 'Demo ortamını hazırla', 'Yönetici yapar: eski demo verisi silinir (katılımcılar kalır), genel kurul süreleri demo için kısaltılır.', !!A.demoHiz, A.demoHiz ? 'Demo hızı açık (sunum 12 sn · puan 10 sn)' : 'Demo hızı kapalı: genel kurulda sunum 2:45 + puan 30 sn sürer', [['Temiz başlat: demo verisini sil', 'temiz'], ['Demo hızını aç', 'hiz-ac']]]
    ]],
    ['Sabah · güçlü yanlar', sw('G', 'Güçlü yan', 'guclu', 3)],
    ['Sabah · zayıf yanlar', sw('Z', 'Zayıf yan', 'zayif', 3)],
    ['Öğleden sonra · fikir geliştirme', [
      ['f-basla', 'Fikir yazımı başlıyor', 'Moderatör tema tablosunu sesli okur; herkes tabloyu telefonunda açık tutar.', ai >= 3, ai >= 3 ? 'Aşama açık' : 'Aşama henüz açılmadı', [['Aşamayı "Fikir yazımı" yap', 'asama:fikir'], ['Tema tablosunu herkesin telefonunda aç', 'tablo-ac'], ['Süre sayacı 5 dk', 'zaman:300:Sessiz brainstorming', 1]]],
      ['f-gir', 'Fikir girişi', 'Her katılımcı fikrini ve dayandığı 1–3 SWOT maddesini girer. Moderatör "N / M kişi girdi" sayacını izler. Demoda fikirleri sistem yazar.', fikirTam === n, fikirTam + ' / ' + n + ' masada tüm katılımcı fikirleri girildi', [['Demo katılımcı fikirlerini yazdır', 'bfikir']]],
      ['f-puan', 'Masada anlatma ve puanlama', 'Moderatör "Sunumları başlat" der; fikirler 1\'den sırayla anlatılır, katılımcılar dinledikçe puanlar; moderatör "Puanlamayı sonlandır ve sırala" der, eşit puanda dar oylama yaptırır, ilk 2\'yi kaydeder. Demoda puanları sistem verir.', onayli === n, onayli + ' / ' + n + ' masa önerilerini kaydetti', [['Demo katılımcı puanlarını ver', 'secim-puan'], ['Eşitlik oluştur: 2. ve 3. fikir', 'esit-fikir', 2], ['Demo dar oylama oylarını üret', 'dar-oy'], ['Dar oylamada beraberlik çıkar (kura)', 'dar-oy-esit', 2], ['Kalan masaları otomatik tamamla (yedek)', 'secim-tamamla', 1]]],
      ['detay', 'Sunuma hazırlık: öneri detayı', 'Masa iki gruba ayrılır; her grupta bir yazar "Yazmayı ben yapacağım" der, 5 alanı yazıp "Gönder" der.', dTop > 0 && dGon === dTop, dGon + ' / ' + dTop + ' öneri gönderildi', [['Eksik detayları doldur ve gönder (yedek)', 'detay-doldur', 1]]]
    ]],
    ['Genel kurul ve kapanış', [
      ['numara', 'Genel kurul hazırlığı', 'Yönetici yapar: öneriler masa sırasıyla numaralanır (1A\'dan 7B\'ye) ve aşama "Sunumlar" olur.', numarali && ai >= 4, numarali ? fk.length + ' öneri numaralandı' : 'Henüz numaralanmadı', [['Masa sırasıyla numaralandır ve aşamayı Sunumlar yap', 'numara']]],
      ['kurul', 'Genel kurul: canlı öneriler', 'Katılımcılar sunumu dinler ve telefonlarından etki ve uygulanabilirlik puanı verir (kendi masalarının önerisine puan veremezler). Moderatörler puan vermez; demoda katılımcı puanlarını sistem üretir. Sunum süresi (demoda 12 sn) bitince puan ekranı kendiliğinden açılır, ardından (10 sn) kapanır; sonra "Sıradaki öneriyi başlat" deyin.', puanlanan >= 3, puanlanan + ' / ' + fk.length + ' öneri puanlandı · şu an: ' + (sn.fikir ? '#' + sn.fikir.no + ' ' + ({ hazir: 'hazır', sunum: 'sunuluyor', puan: 'puanlanıyor', kapali: 'puan kapandı' }[sn.durum] || '') : 'öneri seçilmedi'), [['Sıradaki öneriyi başlat + demo puanları ver', 'sunum-sonraki']]],
      ['kalan', 'Kalan önerileri puanla', 'Yönetici yapar: kalan önerilere demo puanları üretilir ki matris dolsun.', fk.length > 0 && puanlanan === fk.length, puanlanan + ' / ' + fk.length + ' öneri puanlandı', [['Tüm önerilere demo puanlarını ver', 'tum-puan']]],
      ['sonuc', 'Sonuç ve kapanış', 'Matris perdede ve telefonlarda; kapanış mesajları. Slaytları Sonuç sekmesinden ya da perdede ok tuşlarıyla geçin.', ai >= 5, ai >= 5 ? 'Sonuç yayında' : 'Sonuç henüz yayınlanmadı', [['Sonucu yayına al (matris)', 'asama:sonuc']]]
    ]],
    ['Demo sonrası', [
      ['bitir', 'Demo verisini temizle', 'Katılımcılar ve ID\'ler kalır; demo oyları, fikirler, puanlar silinir; süreler asıl değerlerine döner; aşama Hazırlık olur. (Sistem önce yedek alır.)', A.asama === 'hazirlik' && !A.demoHiz && !A.fikirler.length && !A.masalar.some(m => m.tur.G.durum !== 'hazir'), 'Çalıştay gününden önce mutlaka çalıştırın', [['Demo verisini temizle', 'bitir']]]
    ]]
  ];
}
function demoAkis() {
  const gruplar = demoAdimlar(), tum = gruplar.flatMap(([, l]) => l), ai0 = ASAMA_SIRA.indexOf(A.asama), simdiIx = tum.findIndex(x => !x[3] && !(x[0] === 'giris' && (ai0 > 0 || A.demoHiz))), simdi = simdiIx < 0 ? null : tum[simdiIx][0], tamam = tum.filter(x => x[3]).length;
  let no = 0, h = `<div class="card" style="--ac:var(--gold)"><div class="eyebrow">Yönetici</div><h2 style="margin:4px 0 6px">Demo akışı: adım adım</h2>
    <div class="muted">Adımlar çalıştay akışıyla aynı sırada. Sıradaki adım altın çerçevelidir: "Moderatörler" açıklamasını salona söyleyin, sonra altındaki düğmeye basın. Düğmeler yalnızca yönetici içindir. <b>"Yedek" düğmeleri</b> moderatör yapmadığında ya da zaman daralınca kullanılır. Durum satırları canlı güncellenir.</div>
    <div class="row wrap-f" style="gap:12px;margin-top:10px"><span class="pill" style="--ac:var(--teal)">${tamam} / ${tum.length} adım tamam</span>${A.demoHiz ? '<span class="pill" style="--ac:var(--gold)">Demo hızı açık</span>' : ''}</div><div class="bar" style="margin-top:10px"><i style="width:${tamam / tum.length * 100}%"></i></div></div>`;
  for (const [g, l] of gruplar) {
    h += `<div class="eyebrow" style="margin:18px 4px 8px">${esc(g)}</div>`;
    for (const [id, ad, kol, ok, durum, akt] of l) {
      no++; const bu = id === simdi, ac = bu || demoAcik.has(id) || (simdiIx > 0 && id === tum[simdiIx - 1][0]); // sıradaki adımla birlikte bir önceki adım da açık kalır (ek düğmeleri için)
      h += `<div class="card" style="--ac:${ok ? 'var(--teal)' : bu ? 'var(--gold)' : 'var(--blue)'};margin-top:8px;${bu ? 'border:2px solid var(--gold)' : ''}">
        <div class="row" data-act="demo-ac" data-id="${id}" style="gap:12px;cursor:pointer;align-items:center"><span class="serif" style="font-size:26px;font-weight:700;color:${ok ? 'var(--teall)' : bu ? 'var(--goldl)' : 'var(--muted,#9aa)'};min-width:34px">${ok ? '✓' : no}</span><div style="flex:1;min-width:0"><b style="font-size:18px">${esc(ad)}</b><div class="muted mini">${esc(durum)}</div></div>${bu ? '<span class="badge warn">SIRADAKİ</span>' : ''}</div>`;
      if (ac) h += `<div class="muted" style="margin:10px 0 8px;font-size:14px"><b>Moderatörler / sürecin işleyişi:</b> ${esc(kol)}</div>${akt.length ? `<div class="row wrap-f" style="gap:8px">${akt.map(([t, k, yd]) => `<button class="btn ${yd ? 'ghost sm' : bu ? '' : 'ghost'}" data-act="demo" data-k="${esc(k)}">${yd === 1 ? 'Yedek · ' : yd === 2 ? 'Deneme · ' : '▶ '}${esc(t)}</button>`).join('')}</div>` : '<div class="muted mini">Bu adımda yönetici düğmesi yok; durum kendiliğinden güncellenir.</div>'}`;
      h += '</div>';
    }
  }
  return h;
}
async function demoCalistir(k) {
  const sim = (tur, x) => adm('/simule', Object.assign({ tur }, x || {})); const [a, b] = k.split(':');
  if (a === 'temiz') { if (!confirm('Demo oyları, fikirler, puanlar ve sunum durumu silinecek; katılımcılar ve ID\'ler kalacak. Devam edilsin mi?')) return; await adm('/sifirla', { kapsam: 'icerik' }); }
  else if (a === 'bitir') { if (!confirm('Demo verisi temizlenecek (katılımcılar kalır), süreler asıl değerlerine dönecek ve aşama Hazırlık olacak. Devam edilsin mi?')) return; await sim('demo-bitir'); }
  else if (a === 'hiz-ac') await sim('demo-hiz', { ac: true });
  else if (a === 'asama') await adm('/asama', { asama: b });
  else if (a === 'zaman') await adm('/zaman', { sn: +b, etiket: k.slice(a.length + b.length + 2) });
  else if (a === 'swot-ac') await sim('swot', { turKodu: b });
  else if (a === 'oy') await sim('oy');
  else if (a === 'swot-bitir') await sim('swot-bitir', { turKodu: b });
  else if (a === 'tablo-ac') await adm('/toplu-secim', { islem: 'tablo-ac' });
  else if (a === 'bfikir') await sim('bfikir');
  else if (a === 'secim-puan') await sim('secim-puan');
  else if (a === 'secim-tamamla') await sim('secim-tamamla');
  else if (a === 'detay-doldur') await sim('detay-doldur');
  else if (a === 'numara') { await adm('/fikir/numaralandir', { mod: 'sirali' }); await adm('/asama', { asama: 'sunum' }); }
  else if (a === 'sunum-sonraki') {
    const f = A.sunum && A.sunum.fikir;
    if (!f) { const ilk = A.fikirler.filter(x => x.no != null && x.ad).sort((x, y) => x.no - y.no)[0]; if (!ilk) return toast('Önce fikirleri numaralandırın.', 1); await adm('/sunum', { islem: 'sec', fikirId: ilk.id }); }
    else await adm('/sunum', { islem: 'sonraki', kimden: f.id });
    await adm('/sunum', { islem: 'baslat' }); await sim('puan');
  }
  else if (a === 'tum-puan') await sim('tum-puan');
  else if (a === 'dar-oy') await sim('dar-oy-uret');
  else if (a === 'dar-oy-esit') await sim('dar-oy-uret', { esit: true });
  else if (a === 'esit-swot') await sim('esit-swot', { turKodu: b });
  else if (a === 'esit-fikir') await sim('esit-fikir');
  toast('Tamam');
}

/* -------------------------------------------------------- deneme araçları (sürecin akışına göre) */
function denemeKart() {
  const msec = id => `<label class="f">Masa<select id="${id}"><option value="">Tüm masalar</option>${A.masalar.map(m => `<option>${m.id}</option>`).join('')}</select></label>`;
  const btn = (v, ad, k) => `<button class="btn sm ghost" data-act="sim" data-v="${v}" ${k ? `data-k="${k}"` : ''}>${ad}</button>`;
  const kutu = (bas, ac, ic) => `<div style="margin:8px 0 10px;padding:12px;border:1px dashed var(--goldl);border-radius:12px"><div class="eyebrow">${bas}</div><div class="muted mini" style="margin:4px 0 8px">${ac}</div>${ic}</div>`;
  const elle = (ic) => `<div class="muted mini" style="margin:6px 0 6px"><b>Elle, adım adım:</b></div><div class="row wrap-f" style="gap:8px">${ic}</div>`;
  const asama = (no, bas, ac, ic) => `<div style="display:flex;gap:14px;padding:14px 0;border-top:1px solid rgba(255,255,255,.1)"><div class="serif" style="font-size:30px;font-weight:700;color:var(--goldl);min-width:30px">${no}</div><div style="flex:1;min-width:0"><h3 style="margin:0 0 2px;font-size:19px">${bas}</h3><div class="muted mini" style="margin-bottom:8px">${ac}</div>${ic}</div></div>`;
  return `<div class="card" style="--ac:var(--pink)"><div class="eyebrow pink">Deneme araçları</div><h2 style="margin:4px 0 8px">Prova için sahte veri</h2>
    <div style="margin-bottom:6px;padding:10px 12px;border-radius:10px;background:rgba(255,92,147,.12);border:1px solid var(--pink)"><b>Gerçek çalıştayda kullanmayın.</b> Sistemi sahte veriyle baştan sona denemek içindir. Bölümler çalıştayın akışıyla aynı sırada: yukarıdan aşağıya ilerleyin. Her aşamada hızlı yol için "hazır senaryo", tek tek denemek için "elle" düğmeleri var. İşiniz bitince en alttaki 5. bölümden temizleyin.</div>
    ${asama('1', 'Katılımcılar', 'Her masayı 9 kişiye tamamlar. Eklenenler "Deneme 1A-4" gibi adlarla görünür.', `<div class="row wrap-f" style="gap:8px">${btn('katilimci', 'Her masayı 9 kişiye tamamla')}</div>`)}
    ${asama('2', 'SWOT aşaması (güçlü ve zayıf yönler)', 'Post-it sayıları, oylar ve istenirse içerikler. Moderatör eğitimi için "hazır senaryo" en kolayı.',
      kutu('Hazır senaryo: SWOT demo verisi', 'Seçilen masalarda post-it sayısı, oylar ve (tam demoda) "1A masası - Güçlü Yön - Post-It #1" biçiminde içerikler üretir. Eğitimden sonra "Demo SWOT verisini temizle" deyin.',
        `<div class="row wrap-f" style="gap:8px;align-items:flex-end">${msec('dmasa')}<label class="f">Tür<select id="dtur"><option value="G">Güçlü yönler</option><option value="Z">Zayıf yönler</option><option value="GZ">Güçlü + zayıf</option></select></label>
        <button class="btn sm teal" data-act="demo-bulgu" data-v="oy">Oylamaları üret (içeriği moderatör girsin)</button><button class="btn sm teal" data-act="demo-bulgu" data-v="tam">Tam demo (içerikler dahil, seans kapalı)</button><button class="btn sm ghost" data-act="demo-temizle">Demo SWOT verisini temizle</button></div>`)
      + elle(btn('swot', '2a · Güçlü oylamasını aç', 'G') + btn('swot', '2b · Zayıf oylamasını aç', 'Z') + btn('oy', '2c · Açık oylamalara rastgele oy ver')))}
    ${asama('3', 'Fikir aşaması (fikir girişi, masa içi seçim, öneri detayı)', 'Herkes fikir yazar, masa içinde puanlanır, masanın 2 önerisi seçilir, takımlar öneriyi detaylandırır.',
      kutu('Hazır senaryo: fikir aşamasını istenen adıma getir', 'Seçilen masada (en az 8 kişiye tamamlanır) herkes için "Fikir 1A-1", "Fikir 1A-2" gibi birer fikir yazılır; ardından puanlar, sıralama, takımlar ve detaylar üretilir. Moderatör o adımdan devam ederek dener. Mevcut fikirler silinir.',
        `<div class="row wrap-f" style="gap:8px;align-items:flex-end">${msec('fmasa')}<label class="f">Adım<select id="fadim"><option value="giris">1 · Fikir girişi (boş)</option><option value="hazir">2 · Herkes fikrini girdi, sunumlar başlamadı</option><option value="sunum">3 · Sunum ve puanlama sürüyor (herkes ilk 2 fikri puanladı)</option><option value="sonuc">4 · Puanlama bitti, sıralama görünüyor</option><option value="onay">5 · Masanın 2 önerisi kaydedildi</option><option value="detay">6 · Detay yazımı (takımlar seçildi, bir takım taslak yazdı)</option><option value="gonderildi">7 · İki önerinin detayı da gönderildi</option></select></label>
        <button class="btn sm teal" data-act="demo-fikir">Demo fikir aşamasını kur</button></div>`)
      + elle(btn('bfikir', '3a · Herkese fikir yazdır') + btn('secim-puan', '3b · Eksik masa içi puanları doldur') + btn('secim-otomatik', '3c · Seçimi baştan sona tamamla') + btn('fikir', '3d · Kısa yol: her masaya 2 öneriyi doğrudan yaz')))}
    ${asama('4', 'Genel kurul (sunumlar, puanlama, matris)', 'Önerilere etki ve uygulanabilirlik puanı verdirir ve matrisi doldurur. Sunumu ilerletmek için "Fikirler ve sunum" sekmesini kullanın.',
      elle(btn('puan', '4a · Sunulan öneriye rastgele puan ver') + btn('tum-puan', '4b · Tüm 28 öneriye puan ver (matris dolsun)')))}
    ${asama('5', 'Temizlik (geri alınamaz)', 'Prova bitince temizleyin. Çalıştay gününden önce mutlaka "Her şeyi sil"i çalıştırın (sistem önce otomatik yedek alır).',
      `<div class="muted mini" style="margin-bottom:8px"><b>Oyları sil:</b> yalnızca SWOT oyları. <b>Puanları sil:</b> yalnızca genel kurul puanları ve sunum durumu. <b>Her şeyi sil:</b> katılımcılar, oylar, fikirler, puanlar, her şey.</div>
      <div class="row wrap-f" style="gap:8px"><button class="btn sm ghost" data-act="sifirla" data-v="oy">Oyları sil</button><button class="btn sm ghost" data-act="sifirla" data-v="puan">Puanları sil</button><button class="btn sm pink" data-act="sifirla" data-v="hepsi">Her şeyi sil (katılımcılar dahil)</button></div>`)}
  </div>`;
}

/* ------------------------------------------------------------------- ayarlar */
function ayar() {
  const a = A.ayar, ck = (k, ad, ac) => `<label class="row" style="gap:10px;cursor:pointer"><input type="checkbox" data-ay="${k}" ${a[k] ? 'checked' : ''} style="width:auto"><span><b>${ad}</b><br><span class="muted mini">${ac}</span></span></label>`;
  return `<div class="g2"><div class="card" style="--ac:var(--gold)"><div class="eyebrow">Sistem</div><h2 style="margin:4px 0 10px">Genel ayarlar</h2><div class="col">
    <label class="f">Telefonların açacağı adres (QR bunu kullanır)<input id="baseurl" value="${esc(a.baseUrl)}" placeholder="${esc(A.baseUrl)}"></label>
    <div class="muted mini">Bu bilgisayarın ağdaki adresleri: ${A.ips.map(ip => `<b class="goldl">http://${ip}:${A.port}</b>`).join(' · ') || 'bulunamadı'}</div>
    ${ck('zorunluTam', 'Tüm oyları kullanma zorunlu', 'Katılımcı, oy hakkının tamamını kullanmadan gönderemez.')}
    ${ck('kendiMasaPuan', 'Kendi masanın önerisini puanlayabilir', 'Kapalıysa masa, kendi fikirlerini puanlamaz.')}
    ${ck('otoPuan', 'Sunum süresi dolunca puanlama otomatik açılsın', 'Açıksa sunum süresi (örn. 2:45) bitince puan ekranı kendiliğinden açılır; "Puanlamayı aç" ile daha erken de açabilirsiniz. Kapalıysa siz açarsınız.')}
    ${ck('otoKapat', 'Puanlama süresi dolunca otomatik kapansın', 'Kapalıysa puanlamayı siz kapatırsınız.')}
    ${ck('acikKatilim', 'Listede olmayanlar masa seçerek katılabilsin', 'Yaka kartını unutanlar için /katil sayfasında masa seçimi.')}
    ${ck('kayitKapali', 'Kayıt kapansın (masa değişikliği ve yeni kişi eklenemez)', 'Kayıt masası /kayit adresinden kayıt PIN\'iyle çalışır. Kapatılınca yalnızca "Geldi" işareti ve cihaz sıfırlama kalır; masa değişikliğini yönetim yapar.')}
    ${ck('cihazKilidi', 'Bir ID yalnızca tek cihazdan kullanılabilsin', 'Açıksa ID ilk girildiği cihaza kilitlenir; telefon değişirse yönetim veya masa moderatörü "Cihazı sıfırla" der. Kapalıysa farklı cihaz kullanımı yalnızca uyarı olarak görünür.')}
    <div class="row wrap-f"><label class="f">Sunum süresi (sn)<input id="sunumsn" class="n" style="width:100px" value="${a.sunumSn}"></label><label class="f">Puanlama süresi (sn, 0 = süresiz)<input id="puansn" class="n" style="width:100px" value="${a.puanSn}"></label><label class="f">Puanlama kabul eşiği (%)<input id="minpuan" class="n" style="width:100px" value="${a.minPuanYuzde == null ? 80 : a.minPuanYuzde}"></label></div>
    <div class="row wrap-f"><label class="f">Masa içi anında puan süresi (sn)<input id="secimpuansn" class="n" style="width:100px" value="${a.secimPuanSn}"></label><label class="f">Gözden geçirme süresi (sn)<input id="gozdensn" class="n" style="width:100px" value="${a.gozdenSn}"></label></div>
    <button class="btn" data-act="ayar-kaydet">Kaydet</button></div></div>
    <div class="col"><div class="card" style="--ac:var(--blue)"><div class="eyebrow blue">Kurulum</div><h2 style="margin:4px 0 8px">Şablon</h2><div class="muted" style="margin-bottom:10px">Şablonu değiştirmek tüm masaları, katılımcıları, oyları ve puanları siler.</div>
    <div class="row wrap-f"><button class="btn sm ghost" data-act="kurulum" data-v="ana">Ana çalıştay: 14 masa</button><button class="btn sm ghost" data-act="kurulum" data-v="demo">Demo atölyesi: 2 masa (A, B)</button></div></div>
    ${denemeKart()}
</div></div>`;
}

/* ------------------------------------------------------------------- olaylar */
document.addEventListener('input', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) lastInput = Date.now();
  if (e.target.id === 'ara') { filtre.ara = e.target.value; clearTimeout(window.__ar); window.__ar = setTimeout(() => { lastInput = 0; render(); const a = $('#ara'); if (a) { a.focus(); a.setSelectionRange(a.value.length, a.value.length); lastInput = Date.now(); } }, 350); }
});
document.addEventListener('change', async e => {
  const el = e.target;
  try {
    if (el.dataset.hz) { await adm('/hazirlik', { id: el.dataset.hz, ok: el.checked }); await refresh(); return; }
    if (el.dataset.ch) {
      const [kind, f] = el.dataset.ch.split('.'), id = el.dataset.id, v = el.type === 'checkbox' ? el.checked : el.value;
      if (kind === 'k') await adm('/katilimci/' + id, { [f]: v });
      else if (kind === 'm') await adm('/masa/' + id, { [f]: v });
      else if (kind === 'f') await adm('/fikir/' + id, { [f]: v });
      lastInput = 0; await yenile();
    }
  } catch (er) { toast(er.message, 1); }
});
document.addEventListener('click', async e => {
  const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; location.hash = tab; lastInput = 0; render(); return; }
  const el = e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act, d = el.dataset;
  const refresh = async () => { lastInput = 0; await yenile(); };
  try {
    if (a === 'cikis') { if (!confirm('Çıkış yapılsın mı? Bu tarayıcıdan yönetim PIN\'i silinir; tekrar girmek için PIN gerekir.')) return; try { localStorage.removeItem('kokPin'); } catch (er) { /* yut */ } PIN = ''; A = null; giris(); }
    else if (a === 'asama') { await adm('/asama', { asama: d.v }); await refresh(); }
    else if (a === 'demo') { await demoCalistir(d.k); await refresh(); }
    else if (a === 'demo-ac') { demoAcik.has(d.id) ? demoAcik.delete(d.id) : demoAcik.add(d.id); lastInput = 0; render(); }
    else if (a === 'toplu') { const r = await adm('/toplu-oy', { tur: d.t, islem: d.i }); if (r.hatalar && r.hatalar.length) toast(r.hatalar.slice(0, 3).join(' | '), 1); else toast('Tamam'); await refresh(); }
    else if (a === 'filtre') { filtre.masa = d.v; sec.clear(); lastInput = 0; render(); }
    else if (a === 'sec') { el.checked ? sec.add(d.id) : sec.delete(d.id); }
    else if (a === 'hepsi') { $$('[data-act="sec"]').forEach(c => { c.checked = el.checked; el.checked ? sec.add(c.dataset.id) : sec.delete(c.dataset.id); }); lastInput = 0; render(); }
    else if (a === 'yedek-uret') { const r = await adm('/katilimci/yedek', { adet: $('#yedek-adet').value }); toast(r.eklenen + ' yedek ID üretildi (kartları basılabilir; kayıt masasında kişiye atanır)'); await refresh(); }
    else if (a === 'tasi') { await adm('/katilimci/toplu-tasi', { idler: [...sec], masa: $('#tasi-masa').value }); sec.clear(); toast('Taşındı'); await refresh(); }
    else if (a === 'toplu-olustur') {
      const eksik = A.masalar.reduce((t, m) => t + Math.max(0, 9 - A.katilimcilar.filter(k => k.masa === m.id).length), 0);
      if (!eksik) return toast('Her masada zaten en az 9 katılımcı var; yeni kayıt oluşturulmadı.');
      if (!confirm('Şu an ' + A.katilimcilar.length + ' katılımcı var. Her masayı 9 kişiye tamamlamak için ' + eksik + ' yeni katılımcı oluşturulacak (mevcutlar silinmez). Devam edilsin mi?')) return;
      await adm('/katilimci/toplu', { adet: 9 }); toast(eksik + ' katılımcı oluşturuldu'); await refresh();
    }
    else if (a === 'atamasiz-sil') {
      const n = A.katilimcilar.filter(k => !k.masa).length;
      if (!confirm(n + ' atamasız katılımcı (ve varsa oy/fikir kayıtları) silinecek. Bu işlem geri alınamaz. Emin misiniz?')) return;
      const r = await adm('/katilimci/atamasiz-sil', {}); toast(r.silinen + ' katılımcı silindi'); await refresh();
    }
    else if (a === 'liste-ac') $('#liste-kutu').classList.toggle('hide');
    else if (a === 'liste-ekle') { const r = await adm('/katilimci/id-aktar', { metin: $('#liste-metin').value }); toast(r.eklenen + ' eklendi, ' + r.guncellenen + ' güncellendi' + (r.uyari.length ? ' · ' + r.uyari.slice(0, 2).join(' | ') : ''), r.uyari.length > 0); await refresh(); }
    else if (a === 'oy-tur') { oyTur = d.v; render(); }
    else if (a === 'oy-eksik') { oyEksik = el.checked; render(); }
    else if (a === 'kol-ekle') { const r = await adm('/kolaylastirici/ekle', { etiket: $('#kad').value, pozisyon: $('#kpoz').value, masa: $('#kmasa').value }); toast('Eklendi. ID: ' + r.kod); await refresh(); }
    else if (a === 'kol-yap') { const id = $('#kmevcut').value; if (!id) return toast('Katılımcı seçin.', 1); await adm('/katilimci/' + id, { kolay: true }); toast('Moderatör yapıldı'); await refresh(); }
    else if (a === 'kol-cikar') { if (confirm('Bu kişi moderatörlükten çıkarılsın mı? Katılımcı olarak kalır.')) { await adm('/katilimci/' + d.id, { kolay: false }); await refresh(); } }
    else if (a === 'kol-eksik') { const r = await adm('/kolaylastirici/eksik-olustur', {}); toast(r.eklenen + ' geçici moderatör oluşturuldu'); await refresh(); }
    else if (a === 'ksil') { if (confirm('Katılımcı silinsin mi?')) { await adm('/katilimci/' + d.id, { sil: true }); await refresh(); } }
    else if (a === 'kopya') { try { await navigator.clipboard.writeText(d.v); toast('Bağlantı kopyalandı'); } catch (er) { prompt('Bağlantı:', d.v); } }
    else if (a === 'yazdir') {
      const kisi = filtreli();
      $('#printArea').innerHTML = kisi.map(k => `<div class="pc"><div class="e">KÖK · Yönetici Çalıştayı</div><div class="m">${esc(k.masa || '—')}</div>${d.v === 'kisisel' ? qrSvg(A.baseUrl + '/p/' + k.token, 150) + '<div class="k">ID: ' + esc(k.kod) + '</div>' : qrSvg(A.baseUrl + '/katil', 120) + '<div class="e">Okutun, sonra ID\'nizi girin</div><div class="m" style="font-size:34px;letter-spacing:.08em">' + esc(k.kod) + '</div>'}<div class="e" style="font-weight:700">${esc(k.etiket)}</div><div class="e">${esc(k.pozisyon || '')}</div></div>`).join('');
      setTimeout(() => window.print(), 250);
    }
    else if (a === 'mola') { await adm('/mola', d.kapat ? { ac: false } : { baslik: d.b, dk: +d.dk }); toast(d.kapat ? 'Mola bitti' : 'Mola duyurusu açıldı'); await refresh(); }
    else if (a === 'zaman') { await adm('/zaman', { sn: +d.sn, etiket: $('#zetiket') ? $('#zetiket').value : '' }); toast(+d.sn ? 'Geri sayım başladı' : 'Durduruldu'); await refresh(); }
    else if (a === 'zaman-ozel') { const dk = parseFloat(($('#zozel').value || '').replace(',', '.')); if (!(dk > 0)) return toast('Dakika girin.', 1); await adm('/zaman', { sn: Math.round(dk * 60), etiket: $('#zetiket').value }); toast('Geri sayım başladı'); await refresh(); }
    else if (a === 'tablo') { await adm('/toplu-secim', { islem: d.i }); toast(d.i === 'tablo-ac' ? 'Tema tablosu telefonlarda açıldı' : 'Kapatıldı'); await refresh(); }
    else if (a === 'cihaz-sifirla') { await adm('/katilimci/' + d.id, { cihazSifirla: true }); toast('Cihaz kaydı sıfırlandı'); await refresh(); }
    else if (a === 'prog-kaydir') { const P = progDurum(); const idx = P.i >= 0 ? P.i : P.sonraki; if (idx < 0) return toast('Kaydırılacak seans yok.', 1); await adm('/program', { kaydir: +d.dk, idx }); toast('Program ' + (+d.dk > 0 ? '+' : '') + d.dk + ' dk kaydırıldı'); await refresh(); }
    else if (a === 'prog-kaydet') { await adm('/program', { metin: $('#progmetin').value }); toast('Program kaydedildi'); await refresh(); }
    else if (a === 'prog-varsayilan') { if (confirm('Program varsayılan haline dönecek; yaptığınız düzenlemeler silinir. Emin misiniz?')) { await adm('/program', { varsayilan: true }); await refresh(); } }
    else if (a === 'masa-ekle') { const id = prompt('Yeni masa kodu (örn. 8A):'); if (id) { await adm('/masa/' + id.trim().toUpperCase(), { tema: 1 }); await refresh(); } }
    else if (a === 'masa-sil') { if (confirm('Masa ' + d.id + ' silinsin mi? Katılımcıları atamasız kalır.')) { await adm('/masa/' + d.id, { sil: true }); await refresh(); } }
    else if (a === 'tur-kaydet' || a === 'tur-ac' || a === 'tur-islem') {
      const row = $(`[data-row="${d.m}.${d.t}"]`); const v = {}; $$('[data-f]', row).forEach(i => { if (!i.disabled) v[i.dataset.f] = i.value; });
      const body = Object.assign({ tur: d.t, islem: a === 'tur-kaydet' ? 'ayarla' : a === 'tur-ac' ? 'ac' : d.i }, a === 'tur-islem' ? {} : v);
      if (a === 'tur-ac' && !body.oy && body.postit) body.oy = oneriOy(+body.postit);
      if (d.i === 'sifirla' && !confirm('Bu masanın bu türdeki tüm oyları silinecek. Emin misiniz?')) return;
      if ((d.i === 'seans-ac' || d.i === 'yeniden-ac') && A.masalar.find(x => x.id === d.m).tur[d.t].seansKapali && !confirm('Kaydedilen bulgular geçersiz olacak; moderatör içerikleri yeniden kaydetmeli. Devam?')) return;
      await adm('/masa/' + d.m, body); toast(a === 'tur-kaydet' ? 'Kaydedildi' : 'Tamam'); await refresh();
    }
    else if (a === 'numara') { const r = await adm('/fikir/numaralandir', { mod: d.i }); toast(r.toplam + ' öneri numaralandı'); await refresh(); }
    else if (a === 'sun') { await adm('/sunum', { islem: 'sec', fikirId: d.id }); await refresh(); }
    else if (a === 'ilk') { const f = A.fikirler.filter(x => x.no != null && x.ad).sort((x, y) => x.no - y.no)[0]; if (!f) return toast('Önce fikirleri numaralandırın.', 1); await adm('/sunum', { islem: 'sec', fikirId: f.id }); await refresh(); }
    else if (a === 'sunum') { if (d.i === 'sonraki' && A.sunum && A.sunum.fikir && ['puan', 'kapali'].includes(A.sunum.durum) && A.sunum.puanVeren < A.sunum.esik && !confirm('Bu öneri kabul eşiğinin altında kaldı (' + A.sunum.puanVeren + ' / en az ' + A.sunum.esik + ' puan). Yine de sonraki öneriye geçilsin mi?')) return; await adm('/sunum', { islem: d.i, kimden: (A.sunum && A.sunum.fikir) ? A.sunum.fikir.id : undefined }); await refresh(); }
    else if (a === 'fsil') { if (confirm('Fikir silinsin mi?')) { await adm('/fikir/' + d.id, { sil: true }); await refresh(); } }
    else if (a === 'hz-sifirla') { if (!confirm('Elle yapılan işaretler temizlensin mi?')) return; await adm('/hazirlik', { sifirla: true }); await refresh(); }
    else if (a === 'slayt') { await adm('/ayar', { sonucSlayt: +d.v }); await refresh(); }
    else if (a === 'esik-kaydet') { await adm('/ayar', { esik: $('#esik').value, esikDeger: $('#esikdeger').value, ayrilikEsigi: $('#ayrilik').value }); toast('Kaydedildi'); await refresh(); }
    else if (a === 'csv') { const r = await fetch('/api/admin/export/' + d.v, { headers: { 'x-pin': PIN } }); const b = await r.blob(); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = 'kok_' + d.v; l.click(); URL.revokeObjectURL(u); }
    else if (a === 'ayar-kaydet') {
      const b = { baseUrl: $('#baseurl').value, sunumSn: $('#sunumsn').value, puanSn: $('#puansn').value, minPuanYuzde: $('#minpuan').value, secimPuanSn: $('#secimpuansn').value, gozdenSn: $('#gozdensn').value };
      $$('[data-ay]').forEach(c => b[c.dataset.ay] = c.checked); await adm('/ayar', b); toast('Ayarlar kaydedildi'); await refresh();
    }
    else if (a === 'kurulum') { if (confirm('Tüm veriler silinecek ve şablon değişecek. Emin misiniz?')) { await adm('/kurulum', { sablon: d.v }); await refresh(); } }
    else if (a === 'demo-fikir') {
      const masa = $('#fmasa').value, adim = $('#fadim').value;
      if (!confirm((masa || 'Tüm masalarda') + ' için fikirler ve puanlar silinip seçilen adım kurulacak. Devam?')) return;
      await adm('/simule', { tur: 'fikir-demo', masa, adim }); toast('Tamam'); await refresh();
    }
    else if (a === 'demo-bulgu' || a === 'demo-temizle') {
      const masa = $('#dmasa').value, turKodu = $('#dtur').value;
      if (!confirm((masa || 'Tüm masalarda') + ' için seçili türde mevcut oylar ve bulgular silinip ' + (a === 'demo-temizle' ? 'temizlenecek' : 'demo verisi yazılacak') + '. Devam?')) return;
      await adm('/simule', { tur: a === 'demo-bulgu' ? 'bulgu-demo' : 'bulgu-temizle', masa, turKodu, seviye: d.v }); toast('Tamam'); await refresh();
    }
    else if (a === 'sim') { await adm('/simule', { tur: d.v, turKodu: d.k }); toast('Tamam'); await refresh(); }
    else if (a === 'sifirla') { if (confirm(d.v === 'hepsi' ? 'TÜM veriler silinecek: katılımcılar, oylar, fikirler, puanlar. (Sistem önce otomatik yedek alır.) Devam edilsin mi?' : 'Bu işlem geri alınamaz. Emin misiniz?')) { await adm('/sifirla', { kapsam: d.v }); await refresh(); } }
  } catch (er) { toast(er.message, 1); }
});
setInterval(() => { const za = $('#zadm'); if (za && A && A.zaman) za.textContent = mmss(A.zaman.bitis - now()); const c = $('#acd'); if (c && A) { const s = A.sunum; c.textContent = s.durum === 'sunum' ? mmss(s.sunumBas + s.sunumSn * 1000 - now()) : s.puanKapanis ? mmss(s.puanKapanis - now()) : 'süresiz'; } }, 300);

document.addEventListener('change', e => { const el = e.target; if (el && el.id === 'liste-dosya' && el.files && el.files[0]) { const fr = new FileReader(); fr.onload = () => { const t = $('#liste-metin'); if (t) { t.value = String(fr.result).replace(/^\uFEFF/, ''); toast(t.value.split(/\r?\n/).filter(x => x.trim()).length + ' satır okundu; kontrol edip "Ekle"ye basın'); } }; fr.readAsText(el.files[0], 'utf-8'); el.value = ''; } });
