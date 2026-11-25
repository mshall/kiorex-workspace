/* Running header and footer, injected after Paged.js has laid out the pages (browser side).
   Header: Kiorex micro mark (verbatim from _brand/kiorex-micro.svg), document id and title, current chapter.
   Footer: confidentiality, document id and revision, page x of y. The cover and chapter dividers carry none. */
window.kxChrome = function kxChrome(cfg) {
  const pages = [...document.querySelectorAll('.pagedjs_page')];
  const N = pages.length; let current = 'Document control';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  pages.forEach((pg, i) => {
    const area = pg.querySelector('.pagedjs_page_content'); if (!area) return;
    if (pg.querySelector('.cover')) return;
    const dv = pg.querySelector('.divider h2'); if (dv) { current = dv.textContent.trim(); return; }
    let sec = current;
    if (area.querySelector('.control')) sec = 'Document control';
    else if (area.querySelector('.toc')) sec = 'Contents';
    else {
      const ar = area.getBoundingClientRect();
      const h = [...area.querySelectorAll('h2')].find((x) => x.getBoundingClientRect().top - ar.top < ar.height * 0.45);
      if (h) sec = h.textContent.trim();
    }
    current = sec;
    const last = [...area.querySelectorAll('h2')].pop(); if (last && !area.querySelector('.control,.toc')) current = last.textContent.trim();
    const sheet = pg.querySelector('.pagedjs_sheet'); if (!sheet) return;
    const wide = pg.classList.contains('pagedjs_wide_page');
    const el = document.createElement('div'); el.className = 'kx-run' + (wide ? ' wide' : '');
    el.innerHTML = `<div class="kx-head"><span class="kx-mark">${cfg.mark}</span><span class="kx-doc"><b>${esc(cfg.code)}</b><i></i>${esc(cfg.title)}</span><span class="kx-sec">${esc(sec)}</span></div>`
      + `<div class="kx-foot"><span class="kx-conf">Kiorex &nbsp;·&nbsp; Confidential</span><span class="kx-rev">${esc(cfg.code)} &nbsp;·&nbsp; ${esc(cfg.rev)}</span><span class="kx-pg">Page <b>${i + 1}</b> of ${N}</span></div>`;
    sheet.appendChild(el);
  });
  return N;
};
