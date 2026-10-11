// Allow a final comma when hand-editing the config, without changing commas
// inside phrases or evaluating any JavaScript.
export function parseWhisperConfig(source) {
  let json = '', quoted = false, escaped = false;
  source = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      json += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else {
      if (char === '"') quoted = true;
      if (char === ',') {
        let next = i + 1;
        while (/\s/.test(source[next] || '') && next < source.length) next++;
        if (source[next] === ']' || source[next] === '}') continue;
      }
      json += char;
    }
  }
  return JSON.parse(json);
}
