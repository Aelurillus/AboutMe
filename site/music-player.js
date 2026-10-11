import { parseLRC, activeCueIndex } from './music-library.js';
import { createAudioOutput } from './audio-output.js';
import { createFrameQueue } from './animation-frame.js';

export function createMusicPlayer({ config, reduced, storage, isEntered }) {
  const $ = selector => document.querySelector(selector);
  const audio = $('#audio'), lyricsBox = $('#lyrics');
  const player = $('#player'), seek = $('#seek'), seekFill = $('#seekFill');
  const currentTimeLabel = $('#currentTime'), durationLabel = $('#duration');
  const tracks = config.tracks || [];
  const formatTime = value => {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };
  const write = (selector, value) => { $(selector).textContent = value; };
  const svg = name => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.classList.add('icon'); node.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(node.namespaceURI, 'use'); use.setAttribute('href', `#i-${name}`); node.append(use);
    return node;
  };
  let trackIndex = Math.max(0, tracks.findIndex(track => track.id === storage.get('itzming-track')));
  let mode = storage.get('itzming-music-mode') || config.mode;
  if (!['list', 'single'].includes(mode)) mode = 'list';
  let cues = [], lineNodes = [], activeLine = -1, manualUntil = 0, epoch = 0;
  let lyricsController, lyricsLoaded = false, suspended = false;
  let audioController, audioUrl, audioLoaded = false, wantsPlay = false;
  let cueOffsets = [], lastRatio = -1, lastSeekTick = -1, lastSecond = -1, lastDuration = -1, playerVisible = false;
  const progressFrames = createFrameQueue(() => {
    if (suspended || document.hidden || !playerVisible || !audioLoaded || audio.paused) return false;
    progress(); return true;
  });
  const lyricGeometry = createFrameQueue(() => { measureCues(); progress(); });
  function measureCues() { cueOffsets = lineNodes.map(line => line ? line.offsetTop : 0); }
  const lyricObserver = new ResizeObserver(() => lyricGeometry.request()); lyricObserver.observe(lyricsBox);
  document.fonts?.ready.then(() => lyricGeometry.request());
  const playerObserver = new IntersectionObserver(entries => {
    playerVisible = entries[0].isIntersecting; player.classList.toggle('is-on-screen', playerVisible);
    if (playerVisible) { progress(); progressFrames.request(); } else progressFrames.cancel();
  });
  playerObserver.observe(player);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) progressFrames.cancel(); else { progress(); progressFrames.request(); }
  });
  const savedVolume = Number(storage.get('itzming-volume') ?? config.volume);
  audio.muted = storage.get('itzming-muted') === 'true';
  const output = createAudioOutput(audio, savedVolume);

  const queueRows = tracks.map((track, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button'); button.type = 'button'; button.className = 'playlist-track';
    button.setAttribute('aria-label', `播放 ${track.title}，${track.artist}`); button.dataset.trackId = track.id;
    const number = document.createElement('span'); number.className = 'playlist-number'; number.textContent = String(index + 1).padStart(2, '0');
    const cover = document.createElement('img'); cover.src = track.cover; cover.alt = ''; cover.width = 36; cover.height = 36; cover.loading = 'lazy';
    const info = document.createElement('span'); info.className = 'playlist-info';
    const title = document.createElement('span'); title.className = 'playlist-title'; title.textContent = track.title;
    const artist = document.createElement('span'); artist.className = 'playlist-artist'; artist.textContent = track.artist;
    info.append(title, artist); button.append(number, cover, info, svg('play')); item.append(button); $('#playlist').append(item);
    button.addEventListener('click', () => { index === trackIndex ? play() : loadTrack(index, true); closeQueue(); });
    return button;
  });

  function updateQueue() {
    write('#trackCounter', `${String(trackIndex + 1).padStart(2, '0')} / ${String(tracks.length).padStart(2, '0')}`);
    queueRows.forEach((button, index) => {
      button.classList.toggle('is-current', index === trackIndex);
      if (index === trackIndex) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
    });
  }
  function updateMode() {
    audio.loop = mode === 'single';
    write('#loopLabel', mode === 'single' ? '单曲循环' : '列表循环');
    $('#loopBtn').setAttribute('aria-label', mode === 'single' ? '单曲循环，点击切换为列表循环' : '列表循环，点击切换为单曲循环');
    $('#loopBtn').setAttribute('aria-pressed', String(mode === 'single'));
  }
  function lyricMessage(message, retry = false) {
    const node = document.createElement('p'); node.className = 'lyrics-message'; node.textContent = message; node.setAttribute('role', 'status');
    lyricsBox.replaceChildren(node);
    if (retry) {
      const button = document.createElement('button'); button.className = 'lyrics-retry'; button.textContent = '重新载入';
      button.addEventListener('click', () => loadLyrics(tracks[trackIndex], epoch)); lyricsBox.append(button);
    }
  }
  async function loadLyrics(track, version) {
    lyricsController?.abort();
    const controller = new AbortController(); lyricsController = controller;
    lyricsLoaded = false; cues = []; lineNodes = []; activeLine = -1;
    lyricMessage('歌词载入中…');
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(track.lrc, { signal: controller.signal, cache: 'no-cache' });
      if (!response.ok) throw new Error('Lyrics unavailable');
      const result = parseLRC(await response.text());
      if (version !== epoch || controller !== lyricsController) return;
      cues = result; lyricsLoaded = true;
      if (!cues.some(cue => cue.text)) { lyricMessage('这首歌暂无同步歌词。'); return; }
      lyricsBox.replaceChildren();
      lineNodes = cues.map(cue => {
        if (!cue.text) return null;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'lyric';
        button.textContent = cue.text; button.dataset.time = cue.t;
        button.setAttribute('aria-label', `${cue.text}，跳到 ${formatTime(cue.t)}`);
        button.addEventListener('click', () => {
          if (Number.isFinite(audio.duration)) { manualUntil = 0; audio.currentTime = Math.min(cue.t, audio.duration); progress(); }
        });
        lyricsBox.append(button); return button;
      });
      lyricsBox.scrollTop = 0; measureCues(); progress();
    } catch {
      if (version === epoch && controller === lyricsController && !suspended) lyricMessage('歌词暂时无法载入。', true);
    } finally {
      clearTimeout(timer);
      if (controller === lyricsController) lyricsController = undefined;
    }
  }
  function progress() {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const time = audio.currentTime || 0;
    const ratio = duration ? Math.max(0, Math.min(1, time / duration)) : 0;
    if (ratio !== lastRatio) { seekFill.style.transform = `scaleX(${ratio})`; lastRatio = ratio; }
    if (duration !== lastDuration) {
      seek.disabled = !duration; seek.max = duration || 1;
      durationLabel.textContent = duration ? formatTime(duration) : '--:--'; lastDuration = duration;
    }
    const tick = Math.floor(time * 10), second = Math.floor(time);
    if (tick !== lastSeekTick) { seek.value = time; lastSeekTick = tick; }
    if (second !== lastSecond) { currentTimeLabel.textContent = formatTime(time); lastSecond = second; }
    const spokenTime = `${formatTime(time)} / ${duration ? formatTime(duration) : '--:--'}`;
    if (seek.getAttribute('aria-valuetext') !== spokenTime) seek.setAttribute('aria-valuetext', spokenTime);
    const next = activeCueIndex(cues, time);
    if (next === activeLine) return;
    const previous = lineNodes[activeLine]; previous?.classList.remove('is-active'); previous?.removeAttribute('aria-current');
    activeLine = next;
    const line = lineNodes[next];
    line?.classList.add('is-active'); line?.setAttribute('aria-current', 'true');
    if (line && Date.now() > manualUntil) {
      const top = (cueOffsets[next] ?? line.offsetTop) - lyricsBox.clientHeight / 2 + line.clientHeight / 2;
      lyricsBox.scrollTo({ top, behavior: reduced.matches ? 'instant' : 'smooth' });
    }
  }
  function playerState() {
    const playing = audioLoaded && !audio.paused && !audio.ended;
    const pending = Boolean(audioController && wantsPlay);
    $('#player').classList.toggle('is-playing', playing);
    $('#player').classList.toggle('is-audio-loading', Boolean(audioController));
    $('#playIcon').setAttribute('href', playing || pending ? '#i-pause' : '#i-play');
    $('#playBtn').setAttribute('aria-label', pending ? '音乐载入中，点击取消播放' : playing ? '暂停音乐' : '播放音乐');
    $('#playBtn').setAttribute('aria-pressed', String(playing || pending));
    $('#playBtn').setAttribute('aria-busy', String(Boolean(audioController)));
    queueRows[trackIndex]?.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }
  async function loadAudio(track, version) {
    audioController?.abort();
    const controller = new AbortController(); audioController = controller;
    const timer = setTimeout(() => controller.abort(), 60000);
    playerState();
    try {
      // Some hosts omit byte-range support and Content-Length. A local Blob URL
      // lets the media decoder seek accurately even for these VBR MP3 files.
      // Only the selected track is fetched; its URL is released on every switch.
      const response = await fetch(track.src, { signal: controller.signal });
      if (!response.ok) throw new Error('Audio unavailable');
      const blob = await response.blob();
      if (version !== epoch || controller !== audioController || suspended) return;
      if (!blob.size) throw new Error('Empty audio');
      audioUrl = URL.createObjectURL(blob); audio.src = audioUrl; audioLoaded = true; audio.load();
      $('#playerError').hidden = true;
      if (wantsPlay) play();
    } catch {
      if (version === epoch && controller === audioController && !suspended) {
        wantsPlay = false; $('#playerError').hidden = false;
      }
    } finally {
      clearTimeout(timer);
      if (controller === audioController) audioController = undefined;
      playerState();
    }
  }
  async function play() {
    if (!tracks.length) return;
    output.activate();
    wantsPlay = true;
    if (!audioLoaded) {
      if (!audioController && !suspended) loadAudio(tracks[trackIndex], epoch);
      playerState(); return;
    }
    const version = epoch;
    try { await audio.play(); if (version === epoch) $('#playerError').hidden = true; }
    catch (error) {
      if (version === epoch) {
        wantsPlay = false;
        if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') $('#playerError').hidden = false;
        playerState();
      }
    }
  }
  function pause() { wantsPlay = false; audio.pause(); playerState(); }
  function loadTrack(index, autoplay = false) {
    if (!tracks.length) return;
    trackIndex = (index + tracks.length) % tracks.length;
    const track = tracks[trackIndex]; epoch++; manualUntil = 0;
    lyricsController?.abort(); audioController?.abort(); pause();
    audioLoaded = false; audio.removeAttribute('src'); audio.load();
    if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = undefined; }
    cues = []; lineNodes = []; cueOffsets = []; activeLine = -1;
    write('#trackTitle', track.title); write('#trackArtist', track.artist);
    $('#coverImg').src = track.cover; $('#coverImg').alt = `${track.title} 音乐封面`;
    $('#coverImg').title = `${track.title} · ${track.artist}`;
    $('#playerError').hidden = true;
    queueRows.forEach(button => button.querySelector('use').setAttribute('href', '#i-play'));
    storage.set('itzming-track', track.id); updateQueue(); updateMode(); progress(); playerState();
    loadAudio(track, epoch);
    loadLyrics(track, epoch);
    if ('mediaSession' in navigator && 'MediaMetadata' in window) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, artwork: [{ src: new URL(track.cover, location.href).href }] });
    }
    if (autoplay) play();
  }
  const step = direction => loadTrack(trackIndex + direction, isEntered());
  $('#prevTrack').addEventListener('click', () => step(-1));
  $('#nextTrack').addEventListener('click', () => step(1));
  $('#playBtn').addEventListener('click', () => wantsPlay || !audio.paused ? pause() : play());
  $('#loopBtn').addEventListener('click', () => {
    mode = mode === 'list' ? 'single' : 'list'; storage.set('itzming-music-mode', mode); updateMode();
  });
  function setQueue(opened) {
    $('#playlistPanel').hidden = !opened;
    $('#playlistToggle').setAttribute('aria-expanded', String(opened));
    $('#playlistToggle').setAttribute('aria-label', opened ? '收起播放列表' : '打开播放列表');
  }
  function closeQueue() { setQueue(false); }
  $('#playlistToggle').addEventListener('click', () => setQueue($('#playlistPanel').hidden));
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('#playlistPanel,#playlistToggle')) closeQueue();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#playlistPanel').hidden) { closeQueue(); $('#playlistToggle').focus(); }
  });
  audio.addEventListener('play', () => { wantsPlay = true; playerState(); progressFrames.request(); });
  audio.addEventListener('pause', () => { progressFrames.cancel(); playerState(); progress(); });
  audio.addEventListener('loadedmetadata', progress);
  audio.addEventListener('timeupdate', () => { if (playerVisible && !document.hidden) progress(); });
  audio.addEventListener('ended', () => {
    if (mode === 'single') { audio.currentTime = 0; play(); } else step(1);
  });
  audio.addEventListener('error', () => { wantsPlay = false; $('#playerError').hidden = false; playerState(); });
  $('#seek').addEventListener('input', event => {
    if (Number.isFinite(audio.duration)) { manualUntil = 0; audio.currentTime = Number(event.target.value); progress(); }
  });
  ['wheel', 'touchstart'].forEach(event => lyricsBox.addEventListener(event, () => { manualUntil = Date.now() + 4000; }, { passive: true }));
  function volumeState() {
    const muted = output.muted || output.volume === 0;
    $('#volumeIcon').setAttribute('href', muted ? '#i-muted' : '#i-volume');
    $('#muteBtn').setAttribute('aria-label', muted ? '取消静音' : '静音');
    $('#muteBtn').setAttribute('aria-pressed', String(muted)); $('#volume').value = output.volume;
    $('#volume').setAttribute('aria-valuetext', `${Math.round(output.volume * 100)}%`);
    $('#volume').style.setProperty('--volume', `${output.volume * 100}%`);
  }
  $('#volume').addEventListener('input', event => {
    output.setVolume(event.target.value); output.setMuted(false); volumeState();
    storage.set('itzming-volume', output.volume); storage.set('itzming-muted', false);
  });
  $('#muteBtn').addEventListener('click', () => {
    if (output.volume === 0) { output.setVolume(config.volume || 0.35); output.setMuted(false); storage.set('itzming-volume', output.volume); }
    else output.setMuted(!output.muted);
    volumeState();
    storage.set('itzming-muted', output.muted);
  });
  audio.addEventListener('volumechange', volumeState);
  if ('mediaSession' in navigator) {
    const actions = { play, pause, previoustrack: () => step(-1), nexttrack: () => step(1) };
    Object.entries(actions).forEach(([action, handler]) => { try { navigator.mediaSession.setActionHandler(action, handler); } catch {} });
  }
  volumeState(); loadTrack(trackIndex);
  return {
    play,
    suspend() { suspended = true; progressFrames.cancel(); lyricGeometry.cancel(); lyricsController?.abort(); audioController?.abort(); pause(); },
    resume() {
      suspended = false;
      if (!lyricsLoaded && tracks.length) loadLyrics(tracks[trackIndex], epoch);
      if (!audioLoaded && tracks.length) loadAudio(tracks[trackIndex], epoch);
    },
  };
}
