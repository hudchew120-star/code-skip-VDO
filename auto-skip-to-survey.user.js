// ==UserScript==
// @name         Auto skip to survey
// @namespace    auto-skip
// @version      1.0
// @description  ข้ามวิดีโอ กดบทถัดไปอัตโนมัติ จนถึงหน้าแบบสำรวจ
// @match        *://elearning.set.or.th/*
// @match        *://*.elearning.set.or.th/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

console.log('🚀 สคริปต์เริ่มทำงานแล้ว', location.href);

(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const NEXT_WORDS    = ['เรียนบทถัดไป', 'บทถัดไป', 'ถัดไป', 'ต่อไป', 'ดำเนินการต่อ', 'next', 'continue'];
  const CONFIRM_WORDS = ['เรียนบทถัดไป', 'ตกลง', 'ยืนยัน', 'ใช่', 'ok', 'yes', 'confirm'];
  const AVOID_WORDS   = ['ยกเลิก', 'ย้อน', 'ก่อนหน้า', 'ไม่', 'cancel', 'prev', 'back', 'no'];
  const STOP_WORDS    = ['แบบสำรวจ', 'แบบประเมิน', 'survey', 'questionnaire'];
  window.stopSkip = false; // พิมพ์ stopSkip = true ใน Console เพื่อหยุด (เฉพาะหน้านั้น)

  await sleep(3000); // รอหน้าโหลดให้เสร็จก่อน

  // document หลัก + iframe ที่เข้าถึงได้
  const docs = () => {
    const list = [document];
    document.querySelectorAll('iframe').forEach(f => {
      try { if (f.contentDocument) list.push(f.contentDocument); } catch (e) {}
    });
    return list;
  };

  // กด OK ให้อัตโนมัติถ้าเว็บใช้ confirm()/alert() ของเบราว์เซอร์
  const patchDialogs = () => docs().forEach(d => {
    try { d.defaultView.confirm = () => true; d.defaultView.alert = () => {}; } catch (e) {}
  });

  const isVisible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const textOf = b => (b.innerText || b.value || b.title || b.getAttribute('aria-label') || '').trim().toLowerCase();
  const has = (t, words) => words.some(w => t.includes(w.toLowerCase()));

  // ถึงแบบสำรวจเมื่อ: URL มีคำว่า survey หรือ หัวข้อหน้าเป็นแบบสำรวจ + มีช่องให้ตอบ + ไม่มีวิดีโอ
  const reachedSurvey = () => {
    if (has(location.href.toLowerCase(), ['survey', 'questionnaire'])) return true;
    return docs().some(d => {
      if (d.querySelector('video')) return false;
      const heads = [...d.querySelectorAll('h1,h2,h3,h4,.title,.header')].filter(isVisible).map(h => h.innerText.toLowerCase());
      const hasForm = [...d.querySelectorAll('input[type=radio], input[type=checkbox], textarea')].some(isVisible);
      return heads.some(h => has(h, STOP_WORDS)) && hasForm;
    });
  };

  const findButton = (root, words) => {
    const btns = [...root.querySelectorAll('button, a, [role=button], input[type=button], input[type=submit], .btn')];
    return btns.find(b => {
      const t = textOf(b);
      return t && isVisible(b) && !b.disabled && has(t, words) && !has(t, AVOID_WORDS);
    });
  };

  const clickNext = () => {
    for (const d of docs()) {
      // 1) ปุ่มในป๊อปอัปก่อน
      const popups = [...d.querySelectorAll('[role=dialog], .modal.show, .modal.in, .swal2-popup, .swal-modal, .ui-dialog, .popup, dialog[open]')].filter(isVisible);
      for (const p of popups) {
        const b = findButton(p, [...NEXT_WORDS, ...CONFIRM_WORDS]);
        if (b) { b.click(); console.log('🟢 กดในป๊อปอัป:', textOf(b)); return true; }
      }
      // 2) ปุ่มถัดไปบนหน้า
      const b = findButton(d, NEXT_WORDS);
      if (b) { b.click(); console.log('➡️ กด:', textOf(b)); return true; }
    }
    return false;
  };

  for (let round = 1; round <= 500 && !window.stopSkip; round++) {
    patchDialogs();
    if (reachedSurvey()) { console.log('✅ ถึงแบบสำรวจแล้ว หยุดทำงาน'); break; }
    console.log(`🔄 รอบที่ ${round}`);

    for (const v of docs().flatMap(d => [...d.querySelectorAll('video')])) {
      if (v.ended) continue;
      try {
        v.muted = true;
        v.playbackRate = 16;
        await v.play().catch(() => {});
        if (isFinite(v.duration) && v.duration > 0) {
          v.currentTime = Math.max(0, v.duration - 0.3);
          await sleep(1500);
          v.dispatchEvent(new Event('ended'));
          console.log(`⏩ ข้ามวิดีโอ (${Math.round(v.duration)} วิ)`);
        }
      } catch (e) { console.warn('ข้ามวิดีโอไม่ได้:', e); }
    }

    await sleep(1500);
    clickNext();          // กดปุ่มถัดไป หรือปุ่มในป๊อปอัป
    await sleep(1500);
    clickNext();          // เผื่อมีป๊อปอัปยืนยันเด้งซ้อนอีกชั้น
    await sleep(3000);
  }
})();
