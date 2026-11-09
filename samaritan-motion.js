/* Samaritan's visual identity. Motion is never used as evidence of an active job. */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const records = new Map();
  let manuallyPaused = false, scheduled = false;
  function paused() { return reduced.matches || document.hidden || manuallyPaused || !!document.querySelector('.shell.motion-paused'); }
  function update(record) {
    if (!record.video) return;
    if (paused() || !record.visible || !record.host?.isConnected) record.video.pause();
    else record.video.play()?.catch(() => {});
  }
  function attach(record) {
    if (!record.video && !paused()) {
      const video = document.createElement('video');
      video.muted = true; video.loop = true; video.playsInline = true;
      video.preload = 'none'; video.poster = '/assets/samaritan/scanner.webp';
      video.setAttribute('aria-hidden', 'true'); video.setAttribute('tabindex', '-1');
      for (const [ext, type] of [['webm','video/webm'], ['mp4','video/mp4']]) {
        const source = document.createElement('source'); source.src = '/assets/samaritan/scanner.' + ext; source.type = type; video.append(source);
      }
      record.video = video;
    }
    if (record.video && record.video.parentElement !== record.host) record.host.append(record.video);
    update(record);
  }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    const record = records.get(entry.target.dataset.scannerKey);
    if (!record || record.host !== entry.target) return;
    record.visible = entry.isIntersecting; if (record.visible) attach(record); else update(record);
  }), { rootMargin:'40px' });
  function sync() {
    scheduled = false;
    const seen = new Set();
    document.querySelectorAll('[data-scanner-key]').forEach(host => {
      const key = host.dataset.scannerKey;
      // One animated host per key. A repeated key used to move the video between hosts on every pass,
      // and each move re-triggered this observer: an endless loop that froze the tab.
      if (seen.has(key)) return; seen.add(key);
      let record = records.get(key);
      if (!record) { record = {host:null, video:null, visible:false}; records.set(key, record); }
      if (record.host !== host) {
        if (record.host) observer.unobserve(record.host);
        record.host = host; record.visible = false; observer.observe(host);
        if (record.video) host.append(record.video);
      }
      if (record.visible) attach(record); else update(record);
    });
    for (const record of records.values()) update(record);
  }
  function queue() { if (!scheduled) { scheduled = true; queueMicrotask(sync); } }
  new MutationObserver(queue).observe(document.body, {childList:true, subtree:true});
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-site-motion]');
    if (!button) return;
    manuallyPaused = !manuallyPaused;
    document.body.classList.toggle('motion-paused', manuallyPaused);
    button.setAttribute('aria-pressed', String(manuallyPaused));
    button.textContent = manuallyPaused ? 'Resume motion' : 'Pause motion'; sync();
  });
  window.ImpacktMotion = {sync}; sync();
})();
