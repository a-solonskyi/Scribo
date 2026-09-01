import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs;

const COLOR_MAP = {
  yellow: "#fff2b8",
  blue: "#dbeafe",
  pink: "#fde2e2",
};

function safeFileName(value) {
  return (value || "annotated-response")
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}

function getTextRuns(text, annotations) {
  const ranges = annotations
    .filter((item) => ["highlight", "comment"].includes(item.type))
    .filter((item) => Number.isFinite(item.start_offset) && Number.isFinite(item.end_offset))
    .filter((item) => item.end_offset > item.start_offset)
    .sort((a, b) => a.start_offset - b.start_offset);
  const runs = [];
  let cursor = 0;
  let commentNumber = 1;

  for (const annotation of ranges) {
    const start = Math.max(cursor, Math.min(text.length, annotation.start_offset));
    const end = Math.max(start, Math.min(text.length, annotation.end_offset));
    if (start > cursor) runs.push({ text: text.slice(cursor, start) });
    if (end > start) {
      const marker = annotation.type === "comment" ? ` [${commentNumber}]` : "";
      runs.push({
        text: `${text.slice(start, end)}${marker}`,
        background: COLOR_MAP[annotation.color] || COLOR_MAP.yellow,
      });
      if (annotation.type === "comment") commentNumber += 1;
    }
    cursor = end;
  }

  if (cursor < text.length) runs.push({ text: text.slice(cursor) });
  return runs.length ? runs : [{ text }];
}

function getDrawingSvg(drawings) {
  if (!drawings.length) return "";

  const paths = drawings
    .map((drawing) => {
      const points = drawing.drawing_path_json?.points || [];
      if (points.length < 2) return "";
      const d = points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");
      return `<path d="${d}" fill="none" stroke="#000000" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");

  if (!paths) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">${paths}</svg>`;
}

export function downloadAnnotatedResponsePdf({ submission, annotations }) {
  const text = submission.final_text || "";
  const comments = annotations.filter((item) => item.type === "comment");
  const drawings = annotations.filter((item) => item.type === "drawing");
  const drawingSvg = getDrawingSvg(drawings);
  const title = submission.title || submission.assignments?.topic || "Essay";

  const docDefinition = {
    pageMargins: [48, 54, 48, 54],
    defaultStyle: {
      font: "Roboto",
      fontSize: 11,
      lineHeight: 1.32,
    },
    content: [
      { text: "Annotated Response", style: "title" },
      {
        text: `${submission.student_name} - ${title} - submitted ${formatDate(
          submission.submitted_at
        )}`,
        color: "#666666",
        margin: [0, 0, 0, 22],
      },
      { text: "Essay text", style: "section" },
      {
        text: getTextRuns(text, annotations),
        preserveLeadingSpaces: true,
        margin: [0, 0, 0, 20],
      },
      comments.length
        ? { text: "Professor comments", style: "section" }
        : { text: "", margin: [0, 0, 0, 0] },
      ...comments.map((comment, index) => ({
        stack: [
          {
            text: `Comment ${index + 1}`,
            bold: true,
            margin: [0, index === 0 ? 0 : 10, 0, 3],
          },
          {
            text: `Excerpt: "${comment.text_quote || text.slice(comment.start_offset, comment.end_offset)}"`,
            color: "#666666",
          },
          { text: comment.comment_text || "No comment text." },
        ],
      })),
      drawingSvg
        ? { text: "Pen drawings", style: "section", margin: [0, 18, 0, 8] }
        : { text: "", margin: [0, 0, 0, 0] },
      drawingSvg
        ? { svg: drawingSvg, width: 500, height: 220 }
        : { text: "", margin: [0, 0, 0, 0] },
    ],
    styles: {
      title: {
        fontSize: 26,
        bold: true,
        margin: [0, 0, 0, 8],
      },
      section: {
        fontSize: 16,
        bold: true,
        margin: [0, 16, 0, 8],
      },
    },
  };

  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${safeFileName(`${title}-${submission.student_name}`)}-response-${date}.pdf`;
  pdfMake.createPdf(docDefinition).download(fileName);
}
