"use client";

// Extract the text layer from a PDF entirely in the browser. The file never
// leaves the machine — only the extracted text is sent to /api/parse. Works on
// OCR'd scanned contracts (like the Cohoes sample) because they carry a text layer.

export async function extractPdfText(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<{ pages: string[] }> {
  const pdfjs = await import("pdfjs-dist");
  // Turbopack/Webpack bundle the worker from this URL.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Preserve the PDF's own line breaks: pdfjs marks line ends with `hasEOL`.
    // This makes the document reader render with real line structure instead of
    // one run-on block. (Anchor matching collapses whitespace, so newlines are
    // transparent to highlighting.)
    let buf = "";
    for (const it of content.items) {
      if (!("str" in it)) continue;
      buf += it.str;
      buf += "hasEOL" in it && it.hasEOL ? "\n" : " ";
    }
    const text = buf
      .replace(/[ \t]+/g, " ") // collapse runs of spaces
      .replace(/ *\n/g, "\n") // trim spaces before newlines
      .replace(/\n{3,}/g, "\n\n") // cap blank-line runs
      .trim();
    pages.push(text);
    onProgress?.(i, doc.numPages);
  }

  // Per-page text powers the document reader; callers join pages for the parser
  // payload and derive page count / char length as needed.
  return { pages };
}
