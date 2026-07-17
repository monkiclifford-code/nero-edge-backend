/**
 * Compress images for fast storage and transfer.
 * Resizes to max dimension, converts to JPEG with reduced quality.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  type?: string;
}

// Optimized for tablet shop floor — aggressive compression to avoid localStorage quota
const DEFAULT_OPTS: Required<CompressOptions> = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.55,
  type: "image/jpeg",
};

/**
 * Compress an image from a data URL or Blob URL.
 * Returns a compressed data URL (JPEG).
 */
export function compressImage(
  src: string,
  opts: CompressOptions = {}
): Promise<string> {
  const { maxWidth, maxHeight, quality, type } = { ...DEFAULT_OPTS, ...opts };

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }

      // Fill black background for transparent images
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Add ForgeTraceIQ watermark
      ctx.font = "bold 12px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillText(`ForgeTraceIQ | ${new Date().toLocaleString()}`, 8, height - 8);

      const dataUrl = canvas.toDataURL(type, quality);

      // Log compression stats
      const originalBytes = src.length * 0.75; // rough base64 estimate
      const compressedBytes = dataUrl.length * 0.75;
      const savings = ((1 - compressedBytes / originalBytes) * 100).toFixed(0);
      console.log(`[ForgeTraceIQ] Image compressed: ${(originalBytes / 1024).toFixed(0)}KB → ${(compressedBytes / 1024).toFixed(0)}KB (${savings}% smaller)`);

      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = src;
  });
}

/**
 * Compress a File object and return a data URL.
 */
export function compressFile(
  file: File,
  opts?: CompressOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) { reject(new Error("Empty file")); return; }
      compressImage(result, opts).then(resolve).catch(reject);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Fast batch compress multiple images.
 */
export async function compressBatch(
  sources: string[],
  opts?: CompressOptions
): Promise<string[]> {
  return Promise.all(sources.map((src) => compressImage(src, opts)));
}
