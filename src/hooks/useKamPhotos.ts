import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { apiBlob, API_URL } from '../api/client';

// Las fotos las sirve el backend (/api/kam-photos) desde la carpeta de Drive: el
// navegador ya no necesita permiso sobre el Drive del usuario.
const RESIZE_PX  = 200;
const SKIP_RESIZE_BYTES = 40_000; // blobs < 40 KB ya son pequeños, saltar resize

function normKey(s: string): string {
  return s
    .replace(/\.[^.]+$/, '')      // strip extension
    .replace(/-/g, ' ')           // hyphens → spaces (johanna-calzada → johanna calzada)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // strip combining accents
}

async function resizeBlobTo(blob: Blob, maxPx: number): Promise<string> {
  try {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxPx / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    if (typeof OffscreenCanvas !== 'undefined') {
      const oc = new OffscreenCanvas(w, h);
      oc.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const outBlob = await oc.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
      return URL.createObjectURL(outBlob);
    }

    // Fallback: canvas en main thread
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return URL.createObjectURL(blob);
  }
}

export function findKamPhoto(
  photos: Record<string, string> | undefined,
  nombre: string
): string | undefined {
  if (!photos || !nombre) return undefined;
  const key = normKey(nombre);

  if (photos[key]) return photos[key];

  // Filename starts with full name (e.g. "benjamin castro 2.jpg")
  const exactStart = Object.keys(photos).find(k => k.startsWith(key));
  if (exactStart) return photos[exactStart];

  // First name match
  const firstName = key.split(' ')[0];
  const firstMatch = Object.keys(photos).find(k => k.split(' ')[0] === firstName);
  if (firstMatch) return photos[firstMatch];

  // Last name match (some folders named by apellido)
  const lastName = key.split(' ').slice(-1)[0];
  if (lastName.length > 3) {
    const lastMatch = Object.keys(photos).find(k => k.includes(lastName));
    if (lastMatch) return photos[lastMatch];
  }

  return undefined;
}

async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit = 5
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null);
  const executing = new Set<Promise<void>>();
  let i = 0;
  while (i < tasks.length) {
    const idx = i;
    const p: Promise<void> = tasks[idx]().then(r => { results[idx] = r; }).catch(() => { results[idx] = null; }).finally(() => executing.delete(p));
    executing.add(p);
    i++;
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
  return results;
}

export function useKamPhotos() {
  const { token } = useAuth();

  return useQuery<Record<string, string>>({
    queryKey: ['kam-photos'],
    queryFn: async () => {
      const listRes = await fetch(`${API_URL}/api/kam-photos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!listRes.ok) throw new Error(`Fotos KAM lista: ${listRes.status}`);
      const imageFiles = await listRes.json() as { id: string; name: string }[];

      const entries = await withConcurrency(
        imageFiles.map(file => async () => {
          try {
            const blob = await apiBlob(`/api/kam-photos/${file.id}`, token!);
            // Skip canvas resize for small blobs — already display-sized
            const dataUrl = blob.size < SKIP_RESIZE_BYTES
              ? URL.createObjectURL(blob)
              : await resizeBlobTo(blob, RESIZE_PX);
            return [normKey(file.name), dataUrl] as [string, string];
          } catch {
            return null;
          }
        }),
        10  // concurrencia 10 (era 5)
      );

      return Object.fromEntries(entries.filter(Boolean) as [string, string][]);
    },
    enabled: !!token,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}
