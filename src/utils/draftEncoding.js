// Keep complete writing history while fitting long essays into one D1 value.
export async function encodeDraft(draft) {
  const input = new Blob([JSON.stringify(draft)]).stream();
  const bytes = new Uint8Array(await new Response(input.pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return `gzip:${btoa(binary)}`;
}

export async function decodeDraft(value) {
  if (!value.startsWith("gzip:")) return JSON.parse(value);
  const bytes = Uint8Array.from(atob(value.slice(5)), (character) => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}
