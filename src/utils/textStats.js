export function getTextStats(text) {
  const normalized = text.trim();
  const words = normalized ? normalized.match(/\S+/gu) || [] : [];
  const characters = text.length;
  const charactersNoSpaces = (text.match(/\S/gu) || []).length;
  const paragraphs = text
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return {
    wordCount: words.length,
    characterCount: characters,
    characterCountNoSpaces: charactersNoSpaces,
    paragraphCount: paragraphs.length,
  };
}

export function formatNumber(value) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value || 0);
}
