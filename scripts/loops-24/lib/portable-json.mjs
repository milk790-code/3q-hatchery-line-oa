export function stringifyPortableJson(value) {
  return `${escapeNonAscii(JSON.stringify(value, null, 2))}\n`;
}

export function escapeNonAscii(text) {
  return String(text).replace(/[^\x00-\x7F]/gu, character => {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0xFFFF) return `\\u${codePoint.toString(16).padStart(4, '0')}`;
    const offset = codePoint - 0x10000;
    const high = 0xD800 + Math.floor(offset / 0x400);
    const low = 0xDC00 + (offset % 0x400);
    return `\\u${high.toString(16).padStart(4, '0')}\\u${low.toString(16).padStart(4, '0')}`;
  });
}

export function findFirstRawNonAscii(text) {
  const source = String(text || '');
  const match = /[^\x00-\x7F]/u.exec(source);
  if (!match) return null;

  const before = source.slice(0, match.index);
  const line = before.split('\n').length;
  const lastNewline = before.lastIndexOf('\n');
  const column = match.index - lastNewline;
  const codePoint = match[0].codePointAt(0);

  return {
    index: match.index,
    line,
    column,
    codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
  };
}
