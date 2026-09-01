import {
  originMapToRanges,
  reconstructOriginMap,
  sanitizeOriginRanges,
} from "./characterOrigins.js";

export function getHighlightedSegments(
  finalText,
  pasteEvents = [],
  eventLog = [],
  originRanges = null
) {
  if (!finalText) return [];

  const matches = getPasteRanges(
    finalText,
    pasteEvents,
    eventLog,
    originRanges
  );

  if (!matches.length) return [{ text: finalText, pasted: false }];

  matches.sort((a, b) => a.start - b.start);
  const segments = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.start > cursor) {
      segments.push({
        text: finalText.slice(cursor, match.start),
        pasted: false,
      });
    }

    segments.push({
      text: finalText.slice(match.start, match.end),
      pasted: true,
      pasteEvent: match.pasteEvent,
    });
    cursor = match.end;
  }

  if (cursor < finalText.length) {
    segments.push({ text: finalText.slice(cursor), pasted: false });
  }

  return segments;
}

export function getHighlightedHtml(
  html,
  pasteEvents = [],
  eventLog = [],
  plainText = "",
  originRanges = null
) {
  if (!html || typeof window === "undefined" || !window.DOMParser) return "";

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  sanitizeHtmlTree(doc.body);

  const textNodes = [];
  let fullText = "";

  collectTextNodes(doc.body, textNodes, (text) => {
    fullText += text;
  });

  const sourceText = plainText || fullText;
  const sourceRanges = getPasteRanges(
    sourceText,
    pasteEvents,
    eventLog,
    originRanges
  );
  const ranges =
    sourceText === fullText
      ? sourceRanges
      : mapRangesBetweenText(sourceText, fullText, sourceRanges);
  if (!ranges.length) return doc.body.innerHTML;

  for (let nodeIndex = textNodes.length - 1; nodeIndex >= 0; nodeIndex -= 1) {
    const item = textNodes[nodeIndex];
    const nodeStart = item.start;
    const nodeEnd = item.end;
    const overlaps = ranges.filter(
      (range) => range.start < nodeEnd && range.end > nodeStart
    );

    if (!overlaps.length) continue;

    const fragment = doc.createDocumentFragment();
    let cursor = 0;
    const localCuts = [];

    for (const range of overlaps) {
      localCuts.push({
        start: Math.max(0, range.start - nodeStart),
        end: Math.min(item.text.length, range.end - nodeStart),
      });
    }

    localCuts.sort((a, b) => a.start - b.start);

    for (const cut of localCuts) {
      if (cut.start > cursor) {
        fragment.appendChild(doc.createTextNode(item.text.slice(cursor, cut.start)));
      }

      const mark = doc.createElement("mark");
      mark.className = "pasted-segment";
      mark.textContent = item.text.slice(cut.start, cut.end);
      fragment.appendChild(mark);
      cursor = cut.end;
    }

    if (cursor < item.text.length) {
      fragment.appendChild(doc.createTextNode(item.text.slice(cursor)));
    }

    item.node.parentNode.replaceChild(fragment, item.node);
  }

  return doc.body.innerHTML;
}

function mapRangesBetweenText(sourceText, targetText, ranges) {
  if (!ranges.length) return [];

  const targetNormalized = normalizeWithMap(targetText);
  let searchCursor = 0;

  return ranges
    .map((range) => {
      const sourceSegment = sourceText.slice(range.start, range.end);
      const normalizedSegment = normalizeForSearch(sourceSegment);
      if (normalizedSegment.length < 3) return null;

      const normalizedIndex = targetNormalized.text.indexOf(
        normalizedSegment,
        searchCursor
      );
      const fallbackIndex =
        normalizedIndex >= 0
          ? normalizedIndex
          : targetNormalized.text.indexOf(normalizedSegment);
      if (fallbackIndex < 0) return null;

      searchCursor = fallbackIndex + normalizedSegment.length;
      return {
        ...range,
        start: targetNormalized.map[fallbackIndex],
        end: targetNormalized.map[fallbackIndex + normalizedSegment.length - 1] + 1,
      };
    })
    .filter(Boolean);
}

function sanitizeHtmlTree(root) {
  const allowedTags = new Set([
    "BODY",
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "H1",
    "H2",
    "H3",
    "MARK",
  ]);

  [...root.querySelectorAll("*")].forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }

    [...element.attributes].forEach((attribute) => {
      if (element.tagName === "MARK" && attribute.name === "class") return;
      element.removeAttribute(attribute.name);
    });
  });
}

function collectTextNodes(root, textNodes, appendText) {
  const walker = window.document.createTreeWalker(
    root,
    window.NodeFilter.SHOW_TEXT
  );
  let node = walker.nextNode();
  let start = 0;

  while (node) {
    const text = node.nodeValue || "";
    const end = start + text.length;
    textNodes.push({ node, text, start, end });
    appendText(text);
    start = end;
    node = walker.nextNode();
  }
}

export function getPasteRangesForText(
  finalText,
  pasteEvents = [],
  eventLog = [],
  originRanges = null
) {
  return getPasteRanges(finalText, pasteEvents, eventLog, originRanges);
}

function getPasteRanges(
  finalText,
  pasteEvents = [],
  eventLog = [],
  originRanges = null
) {
  if (Array.isArray(originRanges)) {
    const exactRanges = sanitizeOriginRanges(originRanges, finalText.length);
    return exactRanges.map((range) => ({ ...range, pasteEvent: null }));
  }

  const eventRanges = getPasteRangesFromEvents(finalText, eventLog, pasteEvents);
  if (eventRanges.length) return trimRangeWhitespace(finalText, eventRanges);

  const matches = [];
  const occupied = new Array(finalText.length).fill(false);

  for (const pasteEvent of pasteEvents) {
    const pastedText = pasteEvent.pasted_text || pasteEvent.pastedText || pasteEvent.text || "";
    if (!pastedText.trim()) continue;

    const candidates = getPasteCandidates(pastedText);

    for (const candidate of candidates) {
      const match = findAvailableMatchFlexible(finalText, candidate, occupied);
      if (!match) continue;

      for (let offset = match.start; offset < match.end; offset += 1) {
        occupied[offset] = true;
      }

      matches.push({
        start: match.start,
        end: match.end,
        pasteEvent,
      });
    }
  }

  return trimRangeWhitespace(finalText, matches).sort((a, b) => a.start - b.start);
}

function trimRangeWhitespace(text, ranges) {
  return ranges
    .map((range) => {
      let start = range.start;
      let end = range.end;

      while (start < end && /\s/u.test(text[start])) start += 1;
      while (end > start && /\s/u.test(text[end - 1])) end -= 1;

      return { ...range, start, end };
    })
    .filter((range) => range.end > range.start);
}

function getPasteRangesFromEvents(finalText, eventLog = [], pasteEvents = []) {
  if (!finalText || !eventLog.length) return [];

  const originMap = reconstructOriginMap(eventLog, pasteEvents);
  const sortedEvents = [...eventLog].sort(
    (a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0)
  );
  let reconstructedText = "";

  for (const event of sortedEvents) {
    const position = Math.max(
      0,
      Math.min(reconstructedText.length, event.position || 0)
    );
    const deletedCount = Math.max(0, event.deleted_character_count || 0);
    const insertedText = event.inserted_text || event.pasted_text || "";
    reconstructedText =
      reconstructedText.slice(0, position) +
      insertedText +
      reconstructedText.slice(position + deletedCount);
  }

  if (reconstructedText !== finalText) return [];

  return originMapToRanges(originMap).map((range) => ({
    ...range,
    pasteEvent: null,
  }));
}

function getPasteCandidates(pastedText) {
  const cleanedText = stripCommonMarkdownMarks(pastedText);
  const parts = [
    pastedText,
    cleanedText,
    ...pastedText.split(/\n+/g),
    ...pastedText.split(/\n{2,}/g),
    ...cleanedText.split(/\n+/g),
    ...cleanedText.split(/\n{2,}/g),
  ]
    .map((part) => part.trim())
    .filter((part) => part.length >= 8);

  return [...new Set(parts)].sort((a, b) => b.length - a.length);
}

function stripCommonMarkdownMarks(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

function findAvailableMatchFlexible(finalText, pastedText, occupied) {
  const directIndex = findAvailableMatch(finalText, pastedText, occupied);
  if (directIndex >= 0) {
    return { start: directIndex, end: directIndex + pastedText.length };
  }

  const finalNormalized = normalizeWithMap(finalText);
  const pastedNormalized = normalizeForSearch(pastedText);
  if (!pastedNormalized) return null;

  const normalizedIndex = finalNormalized.text.indexOf(pastedNormalized);
  if (normalizedIndex >= 0) {
    const start = finalNormalized.map[normalizedIndex];
    const end =
      finalNormalized.map[normalizedIndex + pastedNormalized.length - 1] + 1;

    if (occupied.slice(start, end).some(Boolean)) return null;
    return { start, end };
  }

  return findTokenWindowMatch(finalNormalized, pastedNormalized, occupied);
}

function normalizeForSearch(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeWithMap(text) {
  let normalized = "";
  const map = [];
  let pendingSpaceIndex = null;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (/\s/u.test(char)) {
      if (normalized.length > 0 && pendingSpaceIndex === null) {
        pendingSpaceIndex = index;
      }
      continue;
    }

    if (pendingSpaceIndex !== null) {
      normalized += " ";
      map.push(pendingSpaceIndex);
      pendingSpaceIndex = null;
    }

    normalized += char.toLowerCase();
    map.push(index);
  }

  return { text: normalized, map };
}

function findTokenWindowMatch(finalNormalized, pastedNormalized, occupied) {
  const tokens = pastedNormalized
    .split(/\s+/g)
    .map((token) => token.replace(/[^\p{L}\p{N}№-]+/gu, ""))
    .filter((token) => token.length >= 3);

  if (tokens.length < 3) return null;

  let best = null;
  const startTokenLimit = Math.min(8, tokens.length);
  const minimumMatches = Math.max(3, Math.ceil(tokens.length * 0.45));

  for (let startTokenIndex = 0; startTokenIndex < startTokenLimit; startTokenIndex += 1) {
    const startToken = tokens[startTokenIndex];
    const occurrences = getTokenOccurrences(finalNormalized.text, startToken);

    for (const occurrence of occurrences) {
      let cursor = occurrence + startToken.length;
      let lastEnd = cursor;
      let matched = 1;

      for (let tokenIndex = startTokenIndex + 1; tokenIndex < tokens.length; tokenIndex += 1) {
        const token = tokens[tokenIndex];
        const nextIndex = finalNormalized.text.indexOf(token, cursor);
        if (nextIndex < 0) continue;

        const gap = nextIndex - lastEnd;
        if (gap > 180) continue;

        matched += 1;
        lastEnd = nextIndex + token.length;
        cursor = lastEnd;
      }

      if (matched < minimumMatches) continue;

      const start = finalNormalized.map[occurrence];
      const end = finalNormalized.map[lastEnd - 1] + 1;
      if (occupied.slice(start, end).some(Boolean)) continue;

      const score = matched / Math.max(1, end - start);
      if (!best || score > best.score) {
        best = { start, end, score };
      }
    }
  }

  return best ? { start: best.start, end: best.end } : null;
}

function getTokenOccurrences(text, token) {
  const occurrences = [];
  let cursor = 0;

  while (cursor < text.length) {
    const index = text.indexOf(token, cursor);
    if (index < 0) break;
    occurrences.push(index);
    cursor = index + token.length;
  }

  return occurrences;
}

function findAvailableMatch(finalText, pastedText, occupied) {
  let searchFrom = 0;

  while (searchFrom < finalText.length) {
    const index = finalText.indexOf(pastedText, searchFrom);
    if (index < 0) return -1;

    const overlaps = occupied
      .slice(index, index + pastedText.length)
      .some(Boolean);

    if (!overlaps) return index;
    searchFrom = index + 1;
  }

  return -1;
}
