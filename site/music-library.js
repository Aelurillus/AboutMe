// Standard LRC timestamps, offsets, repeated timestamps, and the credits JSON
// included in these supplied files. Only text is read from credit objects.
export function parseLRC(source) {
  const rows = String(source).replace(/^\uFEFF/, '').split(/\r?\n/);
  const offset = Number(rows.map(row => row.match(/\[offset:([+-]?\d+)\]/i)?.[1]).filter(value => value !== undefined).at(-1) || 0) / 1000;
  const cues = [];
  for (const row of rows) {
    if (row.trim().startsWith('{')) {
      try {
        const credit = JSON.parse(row);
        if (Number.isFinite(credit.t) && Array.isArray(credit.c)) {
          const text = credit.c.map(item => typeof item.tx === 'string' ? item.tx : '').join('').trim();
          if (text) cues.push({ t: Math.max(0, credit.t / 1000 + offset), text });
        }
      } catch { /* Ignore malformed metadata. */ }
      continue;
    }
    const pattern = /\[(?:(\d+):)?(\d+):(\d{1,2})(?:\.(\d{1,3}))?\]/g;
    const stamps = [...row.matchAll(pattern)];
    if (!stamps.length) continue;
    const text = row.replace(pattern, '').replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim();
    for (const stamp of stamps) {
      const [, hours, minutes, seconds, fraction] = stamp;
      if (Number(seconds) >= 60 || (hours !== undefined && Number(minutes) >= 60)) continue;
      const t = Number(hours || 0) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(`0.${fraction || 0}`) + offset;
      if (!Number.isFinite(t)) continue;
      cues.push({ t: Math.max(0, Math.round(t * 1000) / 1000), text });
    }
  }
  cues.sort((a, b) => a.t - b.t);
  const merged = [];
  for (const cue of cues) {
    const previous = merged.at(-1);
    if (previous && Math.abs(previous.t - cue.t) < 0.00001) {
      if (cue.text && !previous.text.split('\n').includes(cue.text)) previous.text = [previous.text, cue.text].filter(Boolean).join('\n');
    } else merged.push({ ...cue });
  }
  return merged;
}

export function activeCueIndex(cues, time) {
  let left = 0, right = cues.length - 1, result = -1;
  while (left <= right) {
    const middle = (left + right) >> 1;
    if (cues[middle].t <= time) { result = middle; left = middle + 1; } else right = middle - 1;
  }
  return result;
}
