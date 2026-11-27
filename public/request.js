// The custom order form: three tabs (your item, inspiration, details). Everything typed is kept in R while you move between tabs.

let R = null;
const REQ_TABS = ['Your item', 'References', 'Details'];
const freshRequest = () => ({ step: 0, shown: -1, product: '', color: '', item: '', handle: '', reference: '', brief: '', links: '', budget: '', deadline: '', pics: [], artists: [], works: [] });

async function openRequest(preset = {}) {
  if (!S.user) { pending = () => openRequest(preset); return openAuth('login', 'Log in to send your custom order. It only takes a moment.'); }
  if (preset.handle && S.user.seller?.handle === preset.handle) return toast("That's your own page");
  if (!R) R = freshRequest();
  Object.assign(R, Object.fromEntries(Object.entries(preset).filter(([, v]) => v)), { step: 0, shown: -1 });
  openDyn('<div class="pad req" id="reqBox"><div class="empty-s">Loading…</div></div>', 'wide');
  const j = await call('GET', '/api/sellers'); R.artists = (j.sellers || []).filter(a => a.handle !== S.user.seller?.handle && !a.contactOnly);
  if (!R.artists.some(a => a.handle === R.handle)) { R.handle = R.artists.length === 1 ? R.artists[0].handle : ''; }
  await loadRefs(); paintRequest();
}
async function loadRefs() {
  R.works = R.handle ? await sellerArt(R.handle) : [];
  if (!R.works.some(w => w.id === R.reference)) R.reference = '';
}
const sellerWorks = new Map();
async function sellerArt(handle) {
  if (!sellerWorks.has(handle)) { const j = await call('GET', '/api/sellers/' + encodeURIComponent(handle)); sellerWorks.set(handle, j.art || []); }
  return sellerWorks.get(handle);
}

function paintRequest() {
  const box = $('#reqBox'); if (!box) return;
  const p = prodById(R.product), moved = R.shown !== R.step, scroller = box.closest('.modal'), top = moved ? 0 : scroller.scrollTop; R.shown = R.step;
  const tabs = `<div class="req-tabs" role="tablist" style="--at:${R.step}"><span class="req-ink"></span>${REQ_TABS.map((t, i) => `<button type="button" role="tab" aria-selected="${i === R.step}" class="${i === R.step ? 'on' : ''}" data-step="${i}"><i>${i + 1}</i>${t}</button>`).join('')}</div>`;
  let body = '';
  if (R.step === 0) body = `
    <p class="req-q">What should we customise?</p>
    <div class="req-prods">${[...PRODUCTS.map(x => [x.id, x.name, mockup(x.id, x.colors[0][1], '')]), ['other', 'Something else', '<span class="req-plus">+</span>']].map(([id, name, art], i) => `<button type="button" class="req-prod ${R.product === id ? 'on' : ''}" data-rp="${id}" style="--i:${i}">${art}<small>${name}</small></button>`).join('')}</div>
    <label class="field"><span>Describe your item</span><input name="item" maxlength="80" value="${esc(R.item)}" placeholder="e.g. black Logitech mouse, plain canvas tote, white sneakers"></label>
    ${p ? `<div class="field"><span>Colour you want it to be <em class="opt">(optional)</em></span><div class="sw-row">${p.colors.map(c => `<button type="button" class="sw ${R.color === c[0] ? 'on' : ''}" data-rc="${c[0]}" style="--sw:${c[1]}" title="${c[0]}" aria-label="${c[0]}"></button>`).join('')}</div></div>` : `<label class="field"><span>Colour you want it to be <em class="opt">(optional)</em></span><input name="color" maxlength="30" value="${esc(R.color)}" placeholder="e.g. matte lilac"></label>`}
    <label class="field"><span>Artist</span><select name="handle"><option value="">Choose an artist</option>${R.artists.map(a => `<option value="${esc(a.handle)}" ${a.handle === R.handle ? 'selected' : ''}>${esc(a.name)}${a.place ? ' · ' + esc(a.place) : ''}</option>`).join('')}</select></label>`;
  if (R.step === 1) body = `
    <p class="req-q">Show the artist what you have in mind</p>
    <label class="drop" id="drop"><input type="file" id="inspFile" accept="${REF_TYPES}" multiple hidden><span class="drop-ic">${ic('upright')}</span><b>Drop reference files here, or click to choose</b><small>Up to 6 pictures or PDFs: sketches, screenshots, a photo of your item, a mood board. PDFs up to 5 MB. Only you, your artist and Tweak’d admins can see them.</small></label>
    <div class="req-pics" id="reqPics">${R.pics.map(x => `<figure>${x.pdf ? `<span class="ref-pdf"><b>PDF</b><small>${esc(x.name)}</small></span>` : `<img src="${x.url}" alt="${esc(x.name)}">`}<button type="button" data-unpic="${x.id}" aria-label="Remove file">${ic('x')}</button></figure>`).join('')}</div>
    <label class="field"><span>Links <em class="opt">(optional, one per line)</em></span><textarea name="links" rows="3" maxlength="1000" placeholder="https://… a pin, a post, a song cover">${esc(R.links)}</textarea></label>
    <div class="field"><span>Style from this artist’s showcase <em class="opt">(optional)</em></span><div class="cz-art">${R.works.length ? `<label class="art-opt"><input type="radio" name="reference" value="" ${R.reference ? '' : 'checked'}><span class="art-none">No preference</span></label>` + R.works.map(w => `<label class="art-opt"><input type="radio" name="reference" value="${esc(w.id)}" ${R.reference === w.id ? 'checked' : ''}><img src="${esc(w.url)}" alt="${esc(w.title)}" title="${esc(w.title)}"></label>`).join('') : `<small>${R.handle ? 'This artist hasn’t uploaded work yet.' : 'Choose an artist on the first tab to see their work.'}</small>`}</div></div>`;
  if (R.step === 2) {
    const artist = R.artists.find(a => a.handle === R.handle);
    body = `
    <p class="req-q">Tell them the details</p>
    <label class="field"><span>What do you want done?</span><textarea name="brief" rows="5" maxlength="1500" placeholder="The idea, any names or text, where on the item, and anything to avoid.">${esc(R.brief)}</textarea></label>
    <div class="row2"><label class="field"><span>Budget in ₹ <em class="opt">(optional)</em></span><input name="budget" type="number" min="0" max="500000" value="${esc(R.budget)}" placeholder="1500"></label><label class="field"><span>Needed by <em class="opt">(optional)</em></span><input name="deadline" type="date" min="${new Date().toISOString().slice(0, 10)}" value="${esc(R.deadline)}"></label></div>
    <div class="req-sum"><span class="req-sum-art">${p ? mockup(p.id, (p.colors.find(c => c[0] === R.color) || p.colors[0])[1], '') : '<span class="req-plus">+</span>'}</span><div><b>${esc(R.item || 'Your item')}</b><small>${esc([p?.name || (R.product ? 'Custom item' : 'Nothing chosen yet'), R.color, artist ? 'for ' + artist.name : 'no artist chosen', R.pics.length ? plural(R.pics.length, 'file') : ''].filter(Boolean).join(' · '))}</small></div></div>
    <p class="req-note">The artist replies with a price and delivery time. Nothing starts, and nothing is charged, until you accept.</p>`;
  }
  box.innerHTML = `<h2>Customise your thing</h2>${tabs}<form id="orderForm" novalidate><div class="req-body${moved ? ' slide' : ''}">${body}</div><div id="reqErr"></div>
    <div class="req-nav">${R.step ? '<button type="button" class="btn btn-line" data-go="-1">Back</button>' : '<span></span>'}${R.step < 2 ? '<button type="button" class="btn btn-ink" data-go="1">Next</button>' : '<button class="btn btn-pop btn-lg" id="orderGo">Send to artist</button>'}</div></form>`;
  scroller.scrollTop = top;
}
const reqError = msg => { $('#reqErr').innerHTML = msg ? `<div class="form-err" role="alert">${esc(msg)}</div>` : ''; };
// what is still missing, and which tab fixes it
function missing() {
  if (!R.product) return [0, 'Choose what you want customised.'];
  if (R.item.trim().length < 3) return [0, 'Describe your item in a few words.'];
  if (!R.handle) return [0, R.artists.length ? 'Choose an artist.' : 'No artists are taking orders yet.'];
  if (R.brief.trim().length < 15) return [2, 'Tell the artist what you want (at least 15 characters).'];
  return null;
}

const REF_TYPES = 'image/png,image/jpeg,image/webp,application/pdf';
// uploads one reference file; pictures are shrunk in the browser first, PDFs are sent as they are
async function uploadReference(file) {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (pdf && file.size > 5 * 1024 * 1024) throw new Error('PDFs can be up to 5 MB.');
  const body = pdf ? file : await prepareImage(file);
  const r = await fetch('/api/inspiration?name=' + encodeURIComponent(file.name), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({ error: 'The upload failed.' })); if (j.error) throw new Error(j.error);
  return j;
}
async function addPictures(files) {
  for (const file of [...files].slice(0, 6 - R.pics.length)) {
    try { const j = await uploadReference(file); if (!R) return; R.pics.push(j); paintRequest(); }
    catch (e) { reqError(e.message || 'That file could not be used.'); }
  }
}

dyn.addEventListener('click', e => {
  if (!e.target.closest('#reqBox') || !R) return;
  const step = e.target.closest('[data-step]'); if (step) { R.step = +step.dataset.step; return paintRequest(); }
  const go = e.target.closest('[data-go]'); if (go) { R.step = Math.max(0, Math.min(2, R.step + +go.dataset.go)); return paintRequest(); }
  const pr = e.target.closest('[data-rp]'); if (pr) { R.product = pr.dataset.rp; R.color = ''; return paintRequest(); }
  const col = e.target.closest('[data-rc]'); if (col) { R.color = R.color === col.dataset.rc ? '' : col.dataset.rc; return paintRequest(); }
  const un = e.target.closest('[data-unpic]'); if (un) { call('DELETE', '/api/inspiration/' + un.dataset.unpic); R.pics = R.pics.filter(x => x.id !== un.dataset.unpic); paintRequest(); }
});
dyn.addEventListener('input', e => { if (R && e.target.closest('#orderForm') && e.target.name) R[e.target.name] = e.target.value; });
dyn.addEventListener('change', async e => {
  if (!R || !e.target.closest('#orderForm')) return;
  if (e.target.id === 'inspFile') return addPictures(e.target.files);
  if (e.target.name === 'handle') { R.handle = e.target.value; await loadRefs(); }
});
for (const type of ['dragover', 'dragleave', 'drop']) dyn.addEventListener(type, e => {
  const d = e.target.closest('#drop'); if (!d) return; e.preventDefault(); d.classList.toggle('over', type === 'dragover');
  if (type === 'drop') addPictures(e.dataTransfer.files);
});
dyn.addEventListener('submit', async e => {
  if (e.target.id !== 'orderForm') return; e.preventDefault();
  const gap = missing(); if (gap) { R.step = gap[0]; paintRequest(); return reqError(gap[1]); }
  const btn = $('#orderGo'); busy(btn, true);
  const j = await call('POST', '/api/requests', { handle: R.handle, product: R.product, item: R.item, color: R.color, brief: R.brief, budget: R.budget, deadline: R.deadline, links: R.links, reference: R.reference, inspiration: R.pics.map(x => x.id) });
  if (j.error) { busy(btn, false, 'Send to artist'); return reqError(j.error); }
  R = null;
  $('#reqBox').innerHTML = `<div class="sent-card big"><span class="ti">${ic('check')}</span><h3>Sent to ${esc(j.order.peer.name)}</h3><p>You’ll get a quote with a price and delivery time. Follow it under Orders, and chat in Messages.</p><div class="btn-row"><button class="btn btn-ink" data-act="orders">View my order</button><button class="btn btn-line" data-open-chat="${j.peer.id}">Open conversation</button></div></div>`;
  if (typeof confetti === 'function') confetti();
});
