"use client";

// Extract the text layer from a PDF entirely in the browser. The file never
// leaves the machine — only the extracted text is sent to /api/parse. Works on
// OCR'd scanned contracts (like the Cohoes sample) because they carry a text layer.

export async function extractPdfText(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  // Turbopack/Webpack bundle the worker from this URL.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const out: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ");
    out.push(line);
    onProgress?.(i, doc.numPages);
  }

  return { text: out.join("\n\n"), pages: doc.numPages };
}
