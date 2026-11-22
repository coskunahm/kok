/* ortak yardımcılar */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* çıkış: bu telefondaki giriş bilgisi silinir; sunucudaki oy, fikir ve puanlara dokunulmaz (aynı ID ile tekrar girince devam edilir) */
function cikisYap() {
  if (!confirm('Çıkış yapılsın mı?\n\nTekrar girmek için ID\'nizi yazmanız gerekir. Verdiğiniz oylar ve yazdıklarınız silinmez.')) return;
  try { localStorage.removeItem('kokToken'); } catch (e) { /* yut */ }
  location.href = '/';
}
/* moderatör için sabit rol çubuğu: Moderatör paneli ↔ Katılımcı görünümü (salt okunur) */
function rolBar(aktif, tok, masaId) {
  if (!tok || !masaId) return '';
  return `<div class="rolbar"><a class="rb ${aktif === 'mod' ? 'on' : ''}" href="/masa/${esc(masaId)}?t=${encodeURIComponent(tok)}">Moderatör paneli</a><a class="rb ${aktif === 'kat' ? 'on' : ''}" href="/p/${encodeURIComponent(tok)}?izle=1">Katılımcı görünümü</a></div>`;
}
/* öneri detay formu (katılımcı ve moderatör ekranları ortak) */
function detayForm(f, alanlar, kilit) {
  const sw = `<div class="card flat" style="margin:10px 0;--ac:var(--teal)"><div class="dfn" style="color:var(--teall,#6ee7c8)">Dayandığı SWOT bulguları <span style="font-weight:400;font-size:13px">(fikir girişinden otomatik)</span></div>${(f.swot || []).length ? f.swot.map(x => `<div style="font-size:14px;margin-top:3px">${esc(x)}</div>`).join('') : '<div class="dfh">Seçilmedi</div>'}</div>`;
  return sw + alanlar.map(a => `<label class="dfl"><span class="dfn">${esc(a.ad)}</span><span class="dfh">${esc(a.ipucu)}</span>${a.ornek ? `<span class="dfe">Örnek: ${esc(a.ornek)}</span>` : ''}<textarea data-df="${esc(f.id)}|${a.k}" maxlength="${a.max}" rows="${a.k === 'sunumcu' ? 1 : 3}" ${kilit ? 'disabled' : ''}>${esc((f.alan || {})[a.k] || '')}</textarea><span class="dfc" data-dc="${esc(f.id)}|${a.k}">${((f.alan || {})[a.k] || '').length} / ${a.max}</span></label>`).join('');
}
/* öneri detayı: karakter sayacı (sınıra yaklaşınca sarı, dolunca pembe) */
document.addEventListener('input', e => { const t = e.target; if (!t || !t.matches || !t.matches('textarea[data-df]')) return; const c = document.querySelector('[data-dc="' + t.dataset.df.replace(/"/g, '') + '"]'); if (!c) return; const n = t.value.length, mx = +t.getAttribute('maxlength') || 0; c.textContent = n + ' / ' + mx; c.className = 'dfc' + (n >= mx ? ' dolu' : n >= mx * 0.9 ? ' yakin' : ''); });
let SKEW = 0;
const now = () => Date.now() + SKEW;
function setSkew(t) { if (t) SKEW = t - Date.now(); }

function cihazId() {
  try { let c = localStorage.getItem('kokCihaz'); if (!c) { c = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)); localStorage.setItem('kokCihaz', c); } return c; }
  catch (e) { return 'ls-' + (navigator.userAgent || '').length + '-' + screen.width + 'x' + screen.height; }
}
async function api(path, body, headers) {
  const dene = () => fetch(path, { method: body !== undefined ? 'POST' : 'GET', headers: Object.assign({ 'content-type': 'application/json', 'x-cihaz': cihazId() }, headers || {}),
    body: body !== undefined ? JSON.stringify(body) : undefined });
  let r;
  try { r = await dene(); } catch (e0) { // ağ kesintisi ("Failed to fetch"): katılımcı uçlarında bir kez otomatik yeniden dene (bu işlemler tekrarlanınca aynı sonucu verir)
    if (body === undefined || path.startsWith('/api/p/')) { await new Promise(x => setTimeout(x, 1200)); try { r = await dene(); } catch (e1) { r = null; } }
    if (!r) { const er = new Error('Sunucuya ulaşılamadı. Telefonunuzun Wi-Fi bağlantısını kontrol edip tekrar deneyin; yazdıklarınız silinmedi.'); er.status = 0; throw er; }
  }
  let j = {}; try { j = await r.json(); } catch (e) { /* boş */ }
  if (!r.ok) { const e = new Error(j.hata || r.statusText); e.status = r.status; throw e; }
  return j;
}
function toast(msg, err) {
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), err ? 4200 : 2200);
}
/* canlı güncelleme: SSE + yedek yoklama */
function canli(fn) {
  let es, busy = false, again = false;
  const run = async () => { if (busy) { again = true; return; } busy = true; try { await fn(); } catch (e) { /* ağ */ } busy = false; if (again) { again = false; run(); } };
  const baglan = () => { try { es = new EventSource('/api/events'); es.addEventListener('v', run); es.addEventListener('s', e => { if (window.__surum && window.__surum !== e.data) { location.reload(); return; } window.__surum = e.data; }); es.onerror = () => { es.close(); setTimeout(baglan, 2000); }; } catch (e) { /* yut */ } };
  baglan(); setInterval(run, 8000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
  window.addEventListener('online', run);
  run(); return run;
}
const mmss = ms => { ms = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(ms / 60) + ':' + String(ms % 60).padStart(2, '0'); };
const fmt = n => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');

/* temalar ve renkler */
const TEMA_ADLARI = ['Sürekli öğrenme fırsatları', 'Sorgulama ve diyalog', 'Takım halinde öğrenme ve işbirliği', 'Öğrenmeyi yakalayan ve paylaşan sistemler',
  'Ortak vizyon doğrultusunda yetkilendirme', 'Kurumun dış çevreyle bağlantısı', 'Öğrenmeyi destekleyen stratejik liderlik'];
const TEMA_RENK = ['#F2A900', '#2EC4A0', '#FF5C93', '#7FB5FF', '#B79CFF', '#FF8A4C', '#8CF0D6'];
const temaRenk = t => TEMA_RENK[((t || 1) - 1) % 7];
const CEYREK = {
  hizli: { ad: 'Hızlı kazanım', renk: '#2EC4A0', acik: '#8CF0D6', not: 'Yüksek etki, yüksek uygulanabilirlik', ac: 'Etkisi yüksek, uygulaması kolay: hemen başlanabilir.' },
  stratejik: { ad: 'Stratejik dönüşüm', renk: '#7FB5FF', acik: '#BBD6FF', not: 'Yüksek etki, düşük uygulanabilirlik', ac: 'Etkisi yüksek ama uygulaması zor: planlı ve kaynaklı bir yatırım gerektirir.' },
  sinirli: { ad: 'Sınırlı iyileştirme', renk: '#F2A900', acik: '#FFD166', not: 'Düşük etki, yüksek uygulanabilirlik', ac: 'Uygulaması kolay ama etkisi sınırlı: küçük, hızlı iyileştirmeler.' },
  beklet: { ad: 'Bekle / yeniden tasarla', renk: '#B9C3DE', acik: '#DDE3F2', not: 'Düşük etki, düşük uygulanabilirlik', ac: 'Etkisi sınırlı ve uygulaması zor: şimdilik bekletilir ya da yeniden tasarlanır.' }
};

/* QR (qrcode-generator kütüphanesi, çevrimdışı) */
function qrSvg(text, px) {
  if (typeof qrcode === 'undefined') return '';
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const svg = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  return '<div class="qrbox" style="width:' + px + 'px;height:' + px + 'px;background:#fff;border-radius:12px;padding:6px;line-height:0">' + svg + '</div>';
}

/* etki × uygulanabilirlik matrisi (SVG) */
function matrisSVG(mt, o = {}) {
  const W = o.w || 800, H = o.h || 540, L = 78, B = 64, T = 22, R = 24, r = o.r || 16;
  const pw = W - L - R, ph = H - T - B;
  const X = u => L + (u - 1) / 4 * pw, Y = e => T + (5 - e) / 4 * ph;
  const ex = X(mt.esikUyg), ey = Y(mt.esikEtki);
  const q = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${c}" fill-opacity=".20" stroke="${c}" stroke-width="2"/>`;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  s += q(L, T, ex - L - 4, ey - T - 4, CEYREK.stratejik.renk) + q(ex + 4, T, W - R - ex - 4, ey - T - 4, CEYREK.hizli.renk);
  s += q(L, ey + 4, ex - L - 4, T + ph - ey - 4, CEYREK.beklet.renk) + q(ex + 4, ey + 4, W - R - ex - 4, T + ph - ey - 4, CEYREK.sinirli.renk);
  const lab = (x, y, t, c, anc) => `<text x="${x}" y="${y}" fill="${c}" font-size="${o.fs || 15}" font-weight="700" letter-spacing="2.5" text-anchor="${anc || 'start'}">${t}</text>`;
  s += lab(L + 14, T + 26, 'STRATEJİK DÖNÜŞÜM', CEYREK.stratejik.acik) + lab(W - R - 14, T + 26, 'HIZLI KAZANIM', CEYREK.hizli.acik, 'end');
  s += lab(L + 14, T + ph - 14, 'BEKLET / YENİDEN TASARLA', CEYREK.beklet.acik) + lab(W - R - 14, T + ph - 14, 'SINIRLI İYİLEŞTİRME', CEYREK.sinirli.acik, 'end');
  for (let i = 1; i <= 5; i++) {
    s += `<text x="${X(i)}" y="${H - B + 24}" fill="#9FB0D3" font-size="14" text-anchor="middle">${i}</text>`;
    s += `<text x="${L - 14}" y="${Y(i) + 5}" fill="#9FB0D3" font-size="14" text-anchor="end">${i}</text>`;
  }
  s += `<text x="${L + pw / 2}" y="${H - 12}" fill="#F2A900" font-size="16" font-weight="700" letter-spacing="4" text-anchor="middle">UYGULANABİLİRLİK  →</text>`;
  s += `<text transform="translate(18 ${T + ph / 2}) rotate(-90)" fill="#F2A900" font-size="16" font-weight="700" letter-spacing="4" text-anchor="middle">ETKİ  →</text>`;
  // noktalar (üst üste binmeyi azaltmak için basit itme)
  const P = mt.oge.map(g => ({ g, x: X(g.uyg), y: Y(g.etki) }));
  { // tam aynı konumdaki öneriler: merkezi içeri alınmış bir sarmal (kümeleme) olarak dizilir; böylece köşede de üst üste binmezler
    const grup = {}; P.forEach(p => { (grup[Math.round(p.x) + ',' + Math.round(p.y)] = grup[Math.round(p.x) + ',' + Math.round(p.y)] || []).push(p); });
    for (const gl of Object.values(grup)) { if (gl.length < 2) continue; const c0 = (r * 2 + 2) * 0.62, rmax = c0 * Math.sqrt(gl.length) + r;
      const cx = Math.max(L + rmax, Math.min(W - R - rmax, gl[0].x)), cy = Math.max(T + rmax, Math.min(T + ph - rmax, gl[0].y));
      gl.forEach((p, k) => { const an = k * 2.399963, rr = c0 * Math.sqrt(k); p.x = cx + rr * Math.cos(an); p.y = cy + rr * Math.sin(an); }); }
  }
  for (let it = 0; it < 60; it++) for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    let dx = P[j].x - P[i].x, dy = P[j].y - P[i].y; if (!dx && !dy) { const an = i * 12.9898 + j * 78.233; dx = Math.cos(an) * 0.01; dy = Math.sin(an) * 0.01; } // tam aynı konumdakiler farklı yönlere itilir
    const d = Math.hypot(dx, dy) || 0.01, min = r * 2 + 2;
    if (d < min) { const k = (min - d) / 2 / d; P[i].x -= dx * k; P[i].y -= dy * k; P[j].x += dx * k; P[j].y += dy * k; }
  }
  for (const p of P) {
    p.x = Math.max(L + r, Math.min(W - R - r, p.x)); p.y = Math.max(T + r, Math.min(T + ph - r, p.y));
    const c = temaRenk(p.g.tema);
    s += `<g><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${c}" stroke="#0B1F4A" stroke-width="2.5"/>` +
      `<text x="${p.x.toFixed(1)}" y="${(p.y + r * 0.36).toFixed(1)}" fill="#0B1F4A" font-size="${Math.round(r * 0.95)}" font-weight="800" text-anchor="middle">${p.g.no}</text>`;
    if (p.g.ayrilik) s += `<path d="M${(p.x + r * .85).toFixed(1)} ${(p.y - r * 1.25).toFixed(1)} l${(r * .42).toFixed(1)} ${(r * .42).toFixed(1)} l-${(r * .42).toFixed(1)} ${(r * .42).toFixed(1)} l-${(r * .42).toFixed(1)} -${(r * .42).toFixed(1)}z" fill="#fff" stroke="#0B1F4A" stroke-width="1.5"/>`;
    s += '</g>';
  }
  return s + '</svg>';
}
function ceyrekKart(key, liste, o = {}) {
  const c = CEYREK[key];
  let h = `<div class="quad" style="--qc:${c.renk};--qcl:${c.acik}"><h3>${c.ad} <span class="muted" style="letter-spacing:0;text-transform:none;font-weight:400">· ${liste.length}</span></h3>`;
  h += `<div class="qnot">${c.ac}</div>`;
  if (!liste.length) h += '<div class="muted" style="font-size:14px">Bu bölgede öneri yok.</div>';
  else h += '<div class="qh"><span>Öneri</span><span>Etki · Uygulanabilirlik</span></div>';
  for (const g of liste) h += `<div class="qi"><span class="qn" style="color:${temaRenk(g.tema)}">${g.no}</span><span style="${o.big ? 'font-size:' + o.big + 'px' : ''}">${esc(g.ad)}${g.ayrilik ? ' <span title="yüksek görüş ayrılığı">◆</span>' : ''}</span><span class="qs">${fmt(g.etki)} · ${fmt(g.uyg)}</span></div>`;
  return h + '</div>';
}
function matrisAciklama(mt) { // ◆ notu yalnızca görüş ayrılığı yüksek bir öneri varsa gösterilir
  const ayr = mt && mt.oge && mt.oge.some(o => o.ayrilik);
  return '<div class="muted" style="font-size:14px">Etki ve uygulanabilirlik ortalamalarıdır.' + (ayr ? ' ◆ puanlar çok farklı (fikir birliği yok).' : '') + ' Yüksek etkili ama zor öneriler elenmez. Bu sonuçlar katılımcı önceliğidir; nihai karar değildir.</div>';
}
