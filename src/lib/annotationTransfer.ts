// Lightweight in-memory transfer of images from SetupSheet to AnnotationEditor.
// This avoids localStorage quota issues (base64 images are too large for ~5MB limit).
// Data is cleared immediately after reading.

interface TransferImage {
  imageData: string;
  annotations: any[];
  source: "localStorage" | "database" | "upload";
}

let pendingImages: TransferImage[] | null = null;
let pendingIndex = 0;

export function setPendingAnnotationImages(images: TransferImage[], index: number) {
  pendingImages = images.map(img => ({ ...img }));
  pendingIndex = index;
}

export function getPendingAnnotationImages(): { images: TransferImage[] | null; index: number } {
  const result = { images: pendingImages, index: pendingIndex };
  pendingImages = null;
  pendingIndex = 0;
  return result;
}
