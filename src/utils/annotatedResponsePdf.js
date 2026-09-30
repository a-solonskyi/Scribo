import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { buildResponseSegments } from './responseAnnotations';

pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs || pdfFonts;
const YELLOW = '#fff2b8',
  BLUE = '#dbeafe';
function safeFileName(value) {
  return (value || 'annotated-response')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function responsePdfDefinition({ submission, annotations }) {
  const text = submission.final_text || '';
  const notes = annotations.filter((a) => ['comment', 'note'].includes(a.type));
  const runs = buildResponseSegments(text, annotations).map((segment) => {
    const comments = segment.annotations.filter((a) => a.type === 'comment');
    return {
      text: segment.text,
      background: comments.length
        ? BLUE
        : segment.annotations.length
          ? YELLOW
          : undefined,
      _responseHighlight: segment.annotations.length > 0,
      _responseNoteIds: [...comments, ...segment.notes].map((a) => a.id),
    };
  });
  const title = submission.title || submission.assignments?.topic || 'Essay';
  return {
    pageMargins: [48, 54, 48, 54],
    defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.32 },
    content: [
      {
        text: 'Annotated Response',
        fontSize: 26,
        bold: true,
        margin: [0, 0, 0, 8],
      },
      {
        text: `${submission.student_name} - ${title} - submitted ${submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : 'Not recorded'}`,
        color: '#666666',
        margin: [0, 0, 0, 18],
      },
      {
        text: runs.length
          ? runs
          : [{ text: ' ', _responseNoteIds: notes.map((a) => a.id) }],
        preserveLeadingSpaces: true,
        preserveTrailingSpaces: true,
        margin: [0, 0, 0, 20],
      },
      ...(notes.length
        ? [
            {
              text: 'Professor notes',
              fontSize: 16,
              bold: true,
              margin: [0, 16, 0, 8],
            },
          ]
        : []),
      ...notes.map((note, i) => ({
        unbreakable: false,
        stack: [
          {
            text: [{ text: `Note ${i + 1}`, _responseNoteIds: [note.id] }],
            bold: true,
            margin: [0, 10, 0, 3],
          },
          ...(note.type === 'comment'
            ? [
                {
                  text: `Excerpt: “${note.text_quote || text.slice(note.start_offset, note.end_offset)}”`,
                  color: '#666666',
                  margin: [0, 0, 0, 3],
                },
              ]
            : []),
          { text: note.comment_text || '' },
        ],
      })),
    ],
  };
}

// pdfmake 0.2's buffered PDFKit stream provides laid-out text coordinates.
// Add real PDF Text/Highlight annotations before ending the stream, so notes
// also open in PDF viewers. The printed notes section remains an accessible fallback.
export async function downloadAnnotatedResponsePdf({
  submission,
  annotations,
}) {
  const definition = responsePdfDefinition({ submission, annotations });
  const stream = pdfMake.createPdf(definition).getStream({ bufferPages: true });
  const notes = new Map(
    annotations
      .filter((a) => ['comment', 'note'].includes(a.type))
      .map((a) => [a.id, a]),
  );
  const placed = new Set();
  for (const [pageIndex, page] of stream._pdfMakePages.entries()) {
    stream.switchToPage(pageIndex);
    for (const item of page.items) {
      if (item.type !== 'line') continue;
      const line = item.item;
      for (const inline of line.inlines) {
        const x = line.x + (inline.x || 0),
          y = line.y,
          height = line.getHeight();
        if (inline._responseHighlight && inline.width > 0)
          stream.highlight(x, y, inline.width, height, {
            color: inline.background || YELLOW,
          });
        for (const id of inline._responseNoteIds || []) {
          if (placed.has(id) || !notes.has(id)) continue;
          const note = notes.get(id),
            p = note.note_position;
          const nx =
            note.type === 'note' && p
              ? 48 + p.xRatio * (page.pageSize.width - 96)
              : x;
          const ny = note.type === 'note' && p ? y + p.lineOffset * height : y;
          stream.note(
            Math.max(20, Math.min(page.pageSize.width - 32, nx)),
            Math.max(20, Math.min(page.pageSize.height - 32, ny)),
            18,
            18,
            note.comment_text || '',
            {
              Name: 'Note',
              color: note.type === 'comment' ? BLUE : YELLOW,
              T: new String('Professor note'),
              Open: false,
            },
          );
          placed.add(id);
        }
      }
    }
  }
  // Never silently export a note without its interactive annotation.
  if (placed.size !== notes.size)
    throw new Error(
      'A note could not be positioned in the PDF. Please retry the export.',
    );
  const chunks = [];
  const blob = await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () =>
      resolve(new Blob(chunks, { type: 'application/pdf' })),
    );
    stream.end();
  });
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(submission.title || submission.assignments?.topic || 'essay')}-response-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
