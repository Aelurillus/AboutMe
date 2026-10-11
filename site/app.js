import './profile.js';
import { createMusicPlayer } from './music-player.js';
import { parseWhisperConfig } from './whisper-config.js';
import { createPointerMotion } from './pointer-motion.js';

(() => {
  'use strict';
  const p = window.PROFILE;
  if (!p) return;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const isSameOriginPath = value => {
    try { return new URL(value, document.baseURI).origin === location.origin; } catch { return false; }
  };
  const isSteamEndpoint = value => {
    try {
      const url = new URL(value, document.baseURI);
      return url.origin === 'https://steam-status.luckinming.workers.dev' && url.pathname === '/api/steam';
    } catch { return false; }
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const sections = $$('[data-section]');
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, String(value)); return true; } catch { return false; } }
  };
  let entered = false;
  let activeSection = -1, sectionTops = [], pageBottom = 0, hintHidden;
  const text = (selector, value) => { const el = $(selector); if (el && el.textContent !== String(value)) el.textContent = value; };
  const icon = name => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.classList.add('icon'); el.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${name}`); el.append(use); return el;
  };
  const safeURL = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
  const main = $('#page'); main.inert = true; $('#rail').inert = true;
  document.title = `@${p.handle} | profile`;
  text('#displayName', p.name); text('#aboutText', p.about);
  text('.gate-label', p.gateLabel); text('#footerLocation', p.footer);
  $('#avatarImg').src = p.avatar; $('#contactAvatar').src = p.avatar;
  $('#avatarImg').alt = `${p.realName}的头像`;
  const messageURL = safeURL(p.messageURL);
  if (messageURL) $('#avatarMessage').href = messageURL; else $('#avatarMessage').hidden = true;
  p.socials.forEach(social => {
    const url = safeURL(social.url); if (!url) return;
    const link = document.createElement('a'); link.className = 'social'; link.href = url;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', social.name);
    link.append(icon(social.icon)); $('#socials').append(link);
  });
  text('#contactName', p.steam.name);
  $('#contactCard').href = safeURL(p.steam.url) || '#presence';
  const musicPlayer = createMusicPlayer({ config: p.music, reduced, storage, isEntered: () => entered });
  sections.forEach((section, i) => {
    const button = document.createElement('button'); button.className = 'rail-button';
    button.dataset.label = section.dataset.section; button.setAttribute('aria-label', section.dataset.section);
    button.setAttribute('aria-controls', section.id); button.append(document.createElement('span'));
    button.addEventListener('click', () => goTo(i)); $('#rail').append(button);
  });
  const railButtons = $$('.rail-button');
  function measureSections() {
    sectionTops = sections.map(section => section.offsetTop);
    pageBottom = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    updateRail();
  }
  function updateRail() {
    const middle = scrollY + innerHeight * 0.42;
    let next = 0;
    sectionTops.forEach((top, i) => { if (top <= middle) next = i; });
    if (next !== activeSection) {
      const previous = railButtons[activeSection]; previous?.classList.remove('is-active'); previous?.removeAttribute('aria-current');
      railButtons[next].classList.add('is-active'); railButtons[next].setAttribute('aria-current', 'step'); activeSection = next;
    }
    const hidden = scrollY > 40;
    if (hidden !== hintHidden) { $('#scrollHint').classList.toggle('is-hidden', hidden); hintHidden = hidden; }
  }
  function goTo(index) {
    if (!entered) return;
    const target = sections[Math.max(0, Math.min(index, sections.length - 1))];
    target.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${target.id}`);
  }
  let scrollQueued = false;
  addEventListener('scroll', () => {
    if (scrollQueued) return; scrollQueued = true;
    requestAnimationFrame(() => { updateRail(); scrollQueued = false; });
  }, { passive: true });
  let geometryQueued = false;
  function queueGeometry() {
    if (geometryQueued) return; geometryQueued = true;
    requestAnimationFrame(() => { geometryQueued = false; measureSections(); });
  }
  addEventListener('resize', queueGeometry);
  const sectionObserver = new ResizeObserver(queueGeometry); sections.forEach(section => sectionObserver.observe(section));
  document.fonts?.ready.then(queueGeometry);
  $('#scrollHint').addEventListener('click', () => goTo(1));
  measureSections();

  let phraseIndex = 0, letter = 0, deleting = false, typeTimer;
  let whisper = { phrases: [p.about], typingMs: 65, deletingMs: 28, holdMs: 1800, betweenMs: 350 };
  async function loadWhispers() {
    try {
      if (!isSameOriginPath(p.whisperConfig)) return;
      const response = await fetch(p.whisperConfig, { signal: AbortSignal.timeout(5000), cache: 'no-cache' });
      if (!response.ok) throw new Error('Unavailable');
      const config = parseWhisperConfig(await response.text());
      const phrases = Array.isArray(config.phrases) ? config.phrases.filter(line => typeof line === 'string' && line.trim()).slice(0, 100) : [];
      if (!phrases.length) return;
      whisper.phrases = phrases;
      ['typingMs', 'deletingMs', 'holdMs', 'betweenMs'].forEach(key => {
        if (Number.isFinite(config[key])) whisper[key] = Math.max(20, Math.min(10000, config[key]));
      });
      clearTimeout(typeTimer); phraseIndex = 0; letter = 0; deleting = false;
      text('#statusText', entered && !reduced.matches ? '' : whisper.phrases[0]);
      if (entered && !reduced.matches) typeTick();
    } catch { /* The introduction remains visible if the config is unavailable. */ }
  }
  function typeTick() {
    if (document.hidden || reduced.matches || !entered) return;
    const phrases = whisper.phrases;
    const phrase = Array.from(phrases[phraseIndex]);
    letter += deleting ? -1 : 1;
    text('#statusText', phrase.slice(0, Math.max(0, letter)).join(''));
    let delay = deleting ? whisper.deletingMs : whisper.typingMs;
    if (!deleting && letter >= phrase.length) { deleting = true; delay = whisper.holdMs; }
    else if (deleting && letter <= 0) { deleting = false; phraseIndex = (phraseIndex + 1) % phrases.length; delay = whisper.betweenMs; }
    typeTimer = setTimeout(typeTick, delay);
  }
  reduced.addEventListener('change', () => {
    clearTimeout(typeTimer);
    if (reduced.matches) { text('#statusText', whisper.phrases[0]); document.documentElement.classList.remove('cat-ready'); }
    else if (entered) typeTick();
  });
  text('#statusText', whisper.phrases[0]); loadWhispers();

  let clockFormat;
  try { clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: p.clock.zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
  catch { p.clock.zone = 'UTC'; clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
  const clockDateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: p.clock.zone, weekday: 'short', day: 'numeric', month: 'short' });
  const clockZoneFormat = new Intl.DateTimeFormat('en', { timeZone: p.clock.zone, timeZoneName: 'shortOffset' });
  const clockLocalFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const clockPartsFormat = new Intl.DateTimeFormat('en-GB', { timeZone: p.clock.zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  text('#clockLabel', p.clock.label);
  function updateClock() {
    if (document.hidden) return;
    const now = new Date();
    text('#clockTime', clockFormat.format(now)); $('#clockTime').dateTime = now.toISOString();
    text('#clockDate', clockDateFormat.format(now));
    const zoneName = clockZoneFormat.formatToParts(now).find(part => part.type === 'timeZoneName').value;
    text('#clockZone', zoneName);
    text('#clockLocal', clockLocalFormat.format(now));
    const parts = clockPartsFormat.formatToParts(now).reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});
    const zoneOffset = Math.round((Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - now.getTime()) / 60000);
    const diff = (zoneOffset + now.getTimezoneOffset()) / 60;
    text('#clockDifference', diff === 0 ? '(same)' : `(${diff > 0 ? '+' : ''}${Number(diff.toFixed(2))}h)`);
  }
  updateClock(); let clockTimer = setInterval(updateClock, 1000);

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entered && entry.isIntersecting) { entry.target.classList.add('is-in'); revealObserver.unobserve(entry.target); } });
  }, { threshold: 0.12 });
  const pointerMotion = createPointerMotion({ cursor: $('#catCursor'), poses: p.cursor, fine, reduced });
  const hideCursor = pointerMotion.hide;

  let countTimer;
  async function viewCount() {
    if (p.viewsEndpoint && /^\/(?!\/)/.test(p.viewsEndpoint)) {
      $('#viewStat').dataset.tooltip = '主页进入次数；相同浏览器 30 分钟内重复进入只计一次。';
      $('#viewStat').setAttribute('aria-label', '主页进入次数');
      const refresh = async method => {
        if (document.hidden) return;
        try {
          const response = await fetch(p.viewsEndpoint, { method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(6000) });
          if (!response.ok) throw new Error('Unavailable'); const data = await response.json();
          if (!Number.isSafeInteger(data.views) || data.views < 0) throw new Error('Invalid count');
          text('#viewCount', data.views.toLocaleString());
        } catch { text('#viewCount', '—'); }
      };
      await refresh('POST'); countTimer = setInterval(() => refresh('GET'), 30000); return;
    }
    let visits;
    try { visits = JSON.parse(storage.get('itzming-visits') || '{"count":0,"at":0}'); } catch { visits = { count: 0, at: 0 }; }
    if (!Number.isSafeInteger(visits.count) || visits.count < 0) visits.count = 0;
    if (!visits.at || Date.now() - visits.at >= 1800000) { visits.count++; visits.at = Date.now(); }
    text('#viewCount', storage.set('itzming-visits', JSON.stringify(visits)) ? visits.count.toLocaleString() : '—');
  }
  let presenceTimer, presencePending = false;
  const presenceStates = {
    online: '在线', offline: '离线', 'in-game': '游戏中', busy: '忙碌', away: '离开',
    snooze: '暂离', 'looking-to-trade': '想交易', 'looking-to-play': '想玩游戏',
    private: '资料未公开', unavailable: '状态暂时不可用'
  };
  function showPresence(data) {
    const status = Object.hasOwn(presenceStates, data.status) ? data.status : 'unavailable';
    const game = typeof data.game === 'string' ? data.game.slice(0, 200) : '';
    const activity = status === 'in-game' && game ? `正在玩 ${game}` : presenceStates[status];
    text('#contactName', typeof data.name === 'string' && data.name.trim() ? data.name : p.steam.name);
    text('#contactActivity', activity);
    text('#contactLabel', status === 'in-game' ? 'Steam · In game' : 'Steam');
    $('#presenceIndicator').dataset.status = status;
    $('#presenceIndicator').setAttribute('aria-label', `Steam：${presenceStates[status]}`);
    $('#contactCard').setAttribute('aria-label', `${p.steam.name} 的 Steam：${activity}，打开主页`);
    const checkedAt = Date.parse(data.checkedAt);
    const synced = Number.isFinite(checkedAt) ? new Date(checkedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
    $('#contactCard').title = status === 'unavailable' ? 'Steam 暂时未返回状态；点击查看公开主页。' : `每分钟同步 Steam 公开状态${synced ? ` · 最近同步 ${synced}` : ''}`;
    const avatar = safeURL(data.avatar);
    if (avatar && /(^|\.)(steamstatic\.com|steamcommunity\.com|steamcdn-a\.akamaihd\.net)$/.test(new URL(avatar).hostname)) $('#contactAvatar').src = avatar;
  }
  $('#contactAvatar').addEventListener('error', () => { if (!$('#contactAvatar').src.endsWith(p.avatar)) $('#contactAvatar').src = p.avatar; });
  async function refreshPresence() {
    if (!entered || presencePending || document.hidden || !isSteamEndpoint(p.steam.endpoint)) return;
    presencePending = true;
    try {
      const response = await fetch(p.steam.endpoint, { signal: AbortSignal.timeout(20000), cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      if (data.id && data.id !== p.steam.id) throw new Error('Wrong profile');
      showPresence(data);
    } catch { showPresence({ status: 'unavailable' }); }
    finally { presencePending = false; }
  }

  let gestureTimer, gestureArmed = true, wheelSum = 0, lastStepAt = 0;
  function nextStep(direction) {
    const points = [...sectionTops, pageBottom];
    let nearest = 0; points.forEach((point, i) => { if (Math.abs(point - scrollY) < Math.abs(points[nearest] - scrollY)) nearest = i; });
    const next = Math.max(0, Math.min(points.length - 1, nearest + direction));
    if (nearest === next) return;
    scrollTo({ top: points[next], behavior: reduced.matches ? 'instant' : 'smooth' });
  }
  addEventListener('wheel', event => {
    if (!entered || !fine.matches || reduced.matches || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const lyricBox = event.target.closest('.lyrics,.playlist-panel');
    if (lyricBox && (event.deltaY > 0 ? lyricBox.scrollTop + lyricBox.clientHeight < lyricBox.scrollHeight - 2 : lyricBox.scrollTop > 1)) return;
    if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    event.preventDefault(); clearTimeout(gestureTimer);
    gestureTimer = setTimeout(() => { gestureArmed = true; wheelSum = 0; }, 160);
    if (!gestureArmed || performance.now() - lastStepAt < 520) return;
    wheelSum += event.deltaY;
    if (Math.abs(wheelSum) < 8) return;
    gestureArmed = false; lastStepAt = performance.now(); nextStep(wheelSum > 0 ? 1 : -1);
  }, { passive: false });
  addEventListener('keydown', event => {
    if (!entered || event.metaKey || event.ctrlKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const interactive = event.target.closest('button,a');
    if (event.key === 'PageDown' || (event.key === 'ArrowDown' && !interactive) || (event.key === ' ' && !interactive)) { event.preventDefault(); nextStep(event.shiftKey ? -1 : 1); }
    else if (event.key === 'PageUp' || (event.key === 'ArrowUp' && !interactive)) { event.preventDefault(); nextStep(-1); }
    else if (event.key === 'Home') { event.preventDefault(); goTo(0); }
    else if (event.key === 'End') { event.preventDefault(); scrollTo({ top: document.documentElement.scrollHeight, behavior: reduced.matches ? 'instant' : 'smooth' }); }
    else if (event.key.toLowerCase() === 'm' && !interactive) $('#muteBtn').click();
  });
  $('#gate').addEventListener('click', () => {
    if (entered) return; entered = true;
    $('#gate').classList.add('is-gone'); document.body.classList.remove('is-loading');
    main.inert = false; $('#rail').inert = false;
    main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true });
    if (p.music.autoplayOnEntry) musicPlayer.play();
    $$('.entrance').forEach((el, i) => setTimeout(() => el.classList.add('is-in'), reduced.matches ? 0 : 150 + i * 110));
    $$('.reveal').forEach(el => revealObserver.observe(el));
    if (!reduced.matches) { text('#statusText', ''); typeTick(); }
    viewCount(); refreshPresence();
    presenceTimer = setInterval(refreshPresence, 60000);
    const hashSection = sections.findIndex(section => `#${section.id}` === location.hash);
    if (hashSection > 0) requestAnimationFrame(() => goTo(hashSection)); else scrollTo(0, 0);
    setTimeout(() => $('#gate')?.remove(), 700); updateRail();
  });
  document.addEventListener('visibilitychange', () => {
    clearTimeout(typeTimer); hideCursor();
    if (!document.hidden) { updateClock(); if (entered && !reduced.matches) typeTick(); refreshPresence(); }
  });
  addEventListener('pagehide', () => { clearTimeout(typeTimer); clearTimeout(gestureTimer); clearInterval(clockTimer); clearInterval(countTimer); clearInterval(presenceTimer); musicPlayer.suspend(); });
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    musicPlayer.resume();
    updateClock(); clockTimer = setInterval(updateClock, 1000);
    if (entered) {
      if (!reduced.matches) typeTick();
      viewCount(); refreshPresence();
      presenceTimer = setInterval(refreshPresence, 60000);
    }
  });
})();
