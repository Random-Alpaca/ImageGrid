import { photos as staticPhotos, type Photo } from "./photos";

export type { Photo };
export { staticPhotos };

// Read the published photos from the backend. The gallery is public, so this
// needs no passphrase. If the API isn't reachable (e.g. local `vite` dev with
// no functions, or before the backend is set up), we fall back to the static
// seed list in photos.ts so the site always renders.
export async function fetchPhotos(): Promise<Photo[]> {
  try {
    const res = await fetch("/api/photos", { cache: "no-store" });
    if (!res.ok) return staticPhotos;
    const data = await res.json();
    const list: Photo[] = Array.isArray(data?.photos) ? data.photos : [];
    return list.length > 0 ? list : staticPhotos;
  } catch {
    return staticPhotos;
  }
}

// Confirm a passphrase against the server before revealing the editor.
export async function verifyPassphrase(passphrase: string): Promise<boolean> {
  try {
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${passphrase}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    return false;
  }
}

// Publish the full photo list. The passphrase travels in the Authorization
// header over HTTPS and is checked server-side; it is never stored or bundled.
export async function savePhotos(
  list: Photo[],
  passphrase: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/photos", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${passphrase}`,
      },
      body: JSON.stringify({ photos: list }),
    });
    let data: { ok?: boolean; error?: string } = {};
    try {
      data = await res.json();
    } catch {
      return { ok: false, error: "Unexpected response — is the backend deployed?" };
    }
    if (res.ok && data.ok) return { ok: true };
    return { ok: false, error: data.error || `Save failed (${res.status}).` };
  } catch {
    return { ok: false, error: "Network error while saving." };
  }
}
