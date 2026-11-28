const MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_FINAL_BYTES = 1024 * 1024; // 1 MB
const IMAGE_TARGET_BYTES = 100 * 1024; // 100 KB
const PDF_TARGET_BYTES = 300 * 1024; // 300 KB
const MAX_IMAGE_DIM = 1280;
const MAX_PDF_PAGES = 15;

const ALLOWED_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export interface CompressedAttachmentResult {
  file: File;
  fileName: string;
  mimeType: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
}

export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function getFileExtension(name: string): string {
  const parts = (name || '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function classifyAttachmentFile(file: File): 'image' | 'pdf' {
  const mime = (file.type || '').toLowerCase();
  const ext = getFileExtension(file.name);

  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (ALLOWED_IMAGE_MIMES.has(mime) || ALLOWED_IMAGE_EXTS.has(ext)) {
    return 'image';
  }
  throw new Error(
    `Unsupported file type "${file.name}". Allowed types: JPG, PNG, WEBP, HEIC, PDF.`,
  );
}

function replaceExt(name: string, newExt: string): string {
  const idx = name.lastIndexOf('.');
  const base = idx > 0 ? name.slice(0, idx) : name;
  return `${base}.${newExt}`;
}

async function compressImageInWorker(file: File): Promise<Blob | null> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return null;
  }

  const workerCode = `
    self.onmessage = async (e) => {
      const { file, maxDim, targetBytes } = e.data;
      try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        const qualities = [0.6, 0.5, 0.4, 0.3];
        let bestBlob = null;
        for (const mime of ['image/webp', 'image/jpeg']) {
          try {
            for (const q of qualities) {
              const blob = await canvas.convertToBlob({ type: mime, quality: q });
              if (blob && blob.size > 0) {
                bestBlob = blob;
                if (blob.size <= targetBytes) {
                  self.postMessage({ ok: true, blob });
                  return;
                }
              }
            }
            if (bestBlob) {
              self.postMessage({ ok: true, blob: bestBlob });
              return;
            }
          } catch (_) {
            // Try fallback mime
          }
        }
        self.postMessage({ ok: false, error: 'Failed to encode image' });
      } catch (err) {
        self.postMessage({ ok: false, error: err && err.message ? err.message : 'Image decode failed' });
      }
    };
  `;

  return new Promise((resolve) => {
    const workerUrl = URL.createObjectURL(
      new Blob([workerCode], { type: 'application/javascript' }),
    );
    const worker = new Worker(workerUrl);
    worker.onmessage = (e) => {
      URL.revokeObjectURL(workerUrl);
      worker.terminate();
      if (e.data?.ok && e.data?.blob instanceof Blob) {
        resolve(e.data.blob);
      } else {
        resolve(null);
      }
    };
    worker.onerror = () => {
      URL.revokeObjectURL(workerUrl);
      worker.terminate();
      resolve(null);
    };
    worker.postMessage({
      file,
      maxDim: MAX_IMAGE_DIM,
      targetBytes: IMAGE_TARGET_BYTES,
    });
  });
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });
}

async function compressImageMainThread(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(
          new Error(
            `Could not decode "${file.name}". If this is a HEIC image, please convert it to JPG/PNG/WebP.`,
          ),
        );
      el.src = objectUrl;
    });

    const scale = Math.min(
      1,
      MAX_IMAGE_DIM / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height),
    );
    const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(img, 0, 0, width, height);

    const qualities = [0.6, 0.5, 0.4, 0.3];
    let bestBlob: Blob | null = null;

    for (const mime of ['image/webp', 'image/jpeg']) {
      for (const q of qualities) {
        const blob = await canvasToBlob(canvas, mime, q);
        if (blob && blob.size > 0 && blob.type === mime) {
          bestBlob = blob;
          if (blob.size <= IMAGE_TARGET_BYTES) {
            return blob;
          }
        }
      }
      if (bestBlob) return bestBlob;
    }

    throw new Error(`Failed to compress image "${file.name}".`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressImage(file: File): Promise<CompressedAttachmentResult> {
  let blob = await compressImageInWorker(file);
  if (!blob) {
    blob = await compressImageMainThread(file);
  }

  if (blob.size > MAX_FINAL_BYTES) {
    throw new Error('File too complex to compress, split or reduce it.');
  }

  const outMime = blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const outExt = outMime === 'image/webp' ? 'webp' : 'jpg';
  const outName = replaceExt(file.name, outExt);
  const outFile = new File([blob], outName, { type: outMime });

  return {
    file: outFile,
    fileName: outName,
    mimeType: outMime,
    originalSizeBytes: file.size,
    storedSizeBytes: outFile.size,
  };
}

async function compressPdf(file: File): Promise<CompressedAttachmentResult> {
  // Lazy-load pdfjs-dist and pdf-lib only when a PDF is selected
  const [pdfjsLib, { PDFDocument }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdf-lib'),
  ]);

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  if (pdf.numPages > MAX_PDF_PAGES) {
    await loadingTask.destroy();
    throw new Error(
      `PDF exceeds the ${MAX_PDF_PAGES}-page limit (${pdf.numPages} pages). Please split or reduce it.`,
    );
  }

  const presets: Array<{ dpi: number; quality: number }> = [
    { dpi: 110, quality: 0.5 },
    { dpi: 96, quality: 0.4 },
    { dpi: 84, quality: 0.35 },
    { dpi: 72, quality: 0.3 },
  ];

  let smallestRebuiltBytes: Uint8Array | null = null;

  try {
    for (const { dpi, quality } of presets) {
      const outDoc = await PDFDocument.create();
      const scale = dpi / 72;

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable for PDF rendering.');

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        const jpgBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
        if (!jpgBlob) throw new Error('Failed to encode PDF page to JPEG.');
        const jpgBytes = new Uint8Array(await jpgBlob.arrayBuffer());
        const embeddedImg = await outDoc.embedJpg(jpgBytes);

        const baseViewport = page.getViewport({ scale: 1 });
        const outPage = outDoc.addPage([baseViewport.width, baseViewport.height]);
        outPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: baseViewport.width,
          height: baseViewport.height,
        });
      }

      const rebuiltBytes = await outDoc.save();
      if (!smallestRebuiltBytes || rebuiltBytes.length < smallestRebuiltBytes.length) {
        smallestRebuiltBytes = rebuiltBytes;
      }

      if (rebuiltBytes.length <= PDF_TARGET_BYTES) {
        break;
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  // Text-only PDFs: if the rebuilt PDF is larger than or equal to the original, keep the original
  let finalFile: File;
  if (!smallestRebuiltBytes || smallestRebuiltBytes.length >= file.size) {
    finalFile = file;
  } else {
    const outName = replaceExt(file.name, 'pdf');
    finalFile = new File([smallestRebuiltBytes.slice().buffer], outName, {
      type: 'application/pdf',
    });
  }

  if (finalFile.size > MAX_FINAL_BYTES) {
    throw new Error('File too complex to compress, split or reduce it.');
  }

  return {
    file: finalFile,
    fileName: finalFile.name,
    mimeType: 'application/pdf',
    originalSizeBytes: file.size,
    storedSizeBytes: finalFile.size,
  };
}

export async function compressConsumableAttachment(
  file: File,
): Promise<CompressedAttachmentResult> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(
      `"${file.name}" exceeds the 25 MB input limit (${formatAttachmentSize(file.size)}).`,
    );
  }

  const kind = classifyAttachmentFile(file);
  if (kind === 'pdf') {
    return compressPdf(file);
  }
  return compressImage(file);
}
