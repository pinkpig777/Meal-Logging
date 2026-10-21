import { isDevAuth } from '@/lib/env';
import { MEAL_PHOTOS_BUCKET, supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';

/** M1 design §3.8: longest edge 1024 px, JPEG quality 0.8, EXIF orientation applied, metadata stripped. */
export const MAX_EDGE = 1024;
export const JPEG_QUALITY = 0.8;

export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Applies EXIF orientation so portrait phone photos are upright.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through (older Safari / unsupported format) */
    }
  }
  // Fallback: modern browsers also apply EXIF orientation to <img> by default.
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Resize and re-encode a photo. Drawing to a canvas and re-encoding drops
 * all EXIF metadata (including GPS location).
 */
export async function resizePhoto(file: Blob): Promise<Blob> {
  const source = await decode(file);
  const w = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const size = fitWithin(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(source, 0, 0, size.width, size.height);
  if ('close' in source) source.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode photo'))),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  );
}

/**
 * Upload to the private `meal-photos` bucket at `{userId}/{uuid}.jpg` and
 * return the storage path for POST /meals/analyze.
 *
 * Dev auth mode has no Supabase session (storage RLS would reject the upload),
 * so the upload is skipped and a fake path in the dev user's folder is
 * returned. The backend in fixture mode / MSW mocks accept it.
 */
export async function uploadMealPhoto(blob: Blob, userId: string): Promise<string> {
  const path = `${userId}/${uuid()}.jpg`;
  if (isDevAuth) return path;
  const { error } = await supabase.storage
    .from(MEAL_PHOTOS_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}
