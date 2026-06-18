import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { fetchPhotos, savePhotos, verifyPassphrase, type Photo } from "../photoStore";

// Build the contents of src/photos.ts from the current list, as an offline
// backup / way to seed the static fallback.
function toPhotosFile(list: Photo[]): string {
  const header = `// ─────────────────────────────────────────────────────────────────────────
// STATIC FALLBACK PHOTOS
//
// The live site reads photos from the backend (/api/photos). This list is only
// used if the backend is unavailable. You normally manage photos at /admin.
// ─────────────────────────────────────────────────────────────────────────

export type Photo = {
  src: string;
  title: string;
  caption: string;
  alt?: string;
  portfolios?: string[];
};

export const photos: Photo[] = [`;

  const body = list
    .map((p) => {
      const lines = [
        "  {",
        `    src: ${JSON.stringify(p.src)},`,
        `    title: ${JSON.stringify(p.title)},`,
        `    caption: ${JSON.stringify(p.caption)},`,
      ];
      if (p.alt) lines.push(`    alt: ${JSON.stringify(p.alt)},`);
      if (p.portfolios && p.portfolios.length) lines.push(`    portfolios: ${JSON.stringify(p.portfolios)},`);
      lines.push("  },");
      return lines.join("\n");
    })
    .join("\n");

  return `${header}\n${body}\n];\n`;
}

// One portfolio per line, so names may contain spaces and commas.
const parsePortfolios = (s: string): string[] =>
  s.split("\n").map((x) => x.trim()).filter(Boolean);

const inputClass =
  "w-full rounded-xl border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] px-4 py-3 text-white placeholder:text-[rgba(255,255,255,0.35)] outline-none transition focus:border-[rgba(255,255,255,0.4)]";

export default function Admin() {
  // Auth
  const [pw, setPw] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Data
  const [list, setList] = useState<Photo[]>([]);
  const [dirty, setDirty] = useState(false);

  // Add form
  const [src, setSrc] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [portfolios, setPortfolios] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  // Save / export
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Bulk import
  const [bulkJson, setBulkJson] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkParsed, setBulkParsed] = useState<Photo[] | null>(null);

  useEffect(() => {
    fetchPhotos().then(setList);
  }, []);

  const unlock = async () => {
    if (!pw) {
      setAuthError("Enter the passphrase.");
      return;
    }
    setUnlocking(true);
    setAuthError(null);
    const ok = await verifyPassphrase(pw);
    setUnlocking(false);
    if (ok) setUnlocked(true);
    else setAuthError("Incorrect passphrase (or the backend isn't deployed yet).");
  };

  const update = (next: Photo[]) => {
    setList(next);
    setDirty(true);
    setSaveMsg(null);
  };

  const addPhoto = () => {
    if (!src.trim()) return setFormError("An image URL is required.");
    if (!title.trim()) return setFormError("A title is required.");
    setFormError(null);
    const tags = parsePortfolios(portfolios);
    update([...list, { src: src.trim(), title: title.trim(), caption: caption.trim(), ...(tags.length ? { portfolios: tags } : {}) }]);
    setSrc("");
    setTitle("");
    setCaption("");
    setPortfolios("");
  };

  // Edit an existing photo in place; edits go straight into `list` and publish on Save.
  const editField = (index: number, patch: Partial<Photo>) =>
    update(list.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const remove = (index: number) => update(list.filter((_, i) => i !== index));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    const result = await savePhotos(list, pw);
    setSaving(false);
    if (result.ok) {
      setDirty(false);
      setSaveMsg({ ok: true, text: "Saved — your live portfolio is updated." });
    } else {
      setSaveMsg({ ok: false, text: result.error || "Save failed." });
    }
  };

  const parseBulk = (raw: string) => {
    setBulkError(null);
    setBulkParsed(null);
    if (!raw.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setBulkError("Invalid JSON — check for missing quotes or trailing commas.");
      return;
    }
    const arr = Array.isArray(parsed) ? parsed : (parsed as { photos?: unknown })?.photos;
    if (!Array.isArray(arr)) {
      setBulkError("Expected a JSON array [ {…}, … ] or an object with a \"photos\" key.");
      return;
    }
    const photos: Photo[] = [];
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i] as Record<string, unknown>;
      if (typeof p?.src !== "string" || !p.src) {
        setBulkError(`Item ${i + 1}: missing or invalid "src" (string required).`);
        return;
      }
      if (typeof p?.title !== "string" || !p.title) {
        setBulkError(`Item ${i + 1}: missing or invalid "title" (string required).`);
        return;
      }
      photos.push({
        src: p.src,
        title: p.title,
        caption: typeof p.caption === "string" ? p.caption : "",
        ...(typeof p.alt === "string" ? { alt: p.alt } : {}),
        ...(Array.isArray(p.portfolios)
          ? { portfolios: (p.portfolios as unknown[]).filter((s): s is string => typeof s === "string") }
          : {}),
      });
    }
    setBulkParsed(photos);
  };

  const bulkImport = (mode: "append" | "replace") => {
    if (!bulkParsed) return;
    update(mode === "replace" ? bulkParsed : [...list, ...bulkParsed]);
    setBulkJson("");
    setBulkParsed(null);
    setBulkError(null);
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(toPhotosFile(list));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the code is visible below to copy manually */
    }
  };

  // ── Locked gate ──────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <main className="grid min-h-screen place-items-center bg-black px-5 text-white">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[rgba(255,255,255,0.08)]">
              <Lock className="size-5" />
            </span>
            <div>
              <h1 className="text-xl tracking-tight">Manage photos</h1>
              <p className="text-sm text-[rgba(255,255,255,0.5)]">Enter your passphrase</p>
            </div>
          </div>
          <input
            type="password"
            className={inputClass}
            placeholder="Passphrase"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            autoFocus
          />
          {authError && <p className="mt-3 text-sm text-[#f0a3a3]">{authError}</p>}
          <button
            onClick={unlock}
            disabled={unlocking}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:scale-[1.02] disabled:opacity-60"
          >
            {unlocking && <Loader2 className="size-4 animate-spin" />}
            {unlocking ? "Checking…" : "Unlock"}
          </button>
          <a
            href="/"
            className="mt-6 block text-center text-sm text-[rgba(255,255,255,0.5)] underline-offset-4 hover:underline"
          >
            ← Back to portfolio
          </a>
        </div>
        <Analytics />
      </main>
    );
  }

  // ── Unlocked editor ──────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white md:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl tracking-tight">Manage photos</h1>
            <p className="mt-1 text-sm text-[rgba(255,255,255,0.55)]">
              {list.length} photo{list.length === 1 ? "" : "s"}
              {dirty && <span className="text-[#e7c987]"> · unsaved changes</span>}
            </p>
          </div>
          <a
            href="/"
            className="flex items-center gap-2 rounded-full bg-[#efe2c6] px-4 py-2 text-sm text-[#17130f] transition hover:scale-105"
          >
            View portfolio <ExternalLink className="size-4" />
          </a>
        </header>

        {/* Add form */}
        <section className="mb-8 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] p-5 md:p-6">
          <h2 className="mb-4 text-lg">Add a photo</h2>
          <div className="grid gap-3">
            <input
              className={inputClass}
              placeholder="Image URL (https://… or /photos/file.jpg)"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              placeholder="Caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              placeholder="Portfolios, one per line (optional)"
              value={portfolios}
              onChange={(e) => setPortfolios(e.target.value)}
            />
            {src.trim() && (
              <img
                src={src.trim()}
                alt="Preview"
                className="max-h-48 w-full rounded-xl object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
                onLoad={(e) => (e.currentTarget.style.display = "block")}
              />
            )}
            {formError && <p className="text-sm text-[#f0a3a3]">{formError}</p>}
            <button
              onClick={addPhoto}
              className="justify-self-start rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:scale-105"
            >
              Add photo
            </button>
          </div>
        </section>

        {/* Bulk import */}
        <section className="mb-8 rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] p-5 md:p-6">
          <h2 className="mb-1 text-lg">Bulk import</h2>
          <p className="mb-4 text-sm text-[rgba(255,255,255,0.5)]">
            Paste a JSON array of photos. Each item needs{" "}
            <code className="rounded bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5">src</code> and{" "}
            <code className="rounded bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5">title</code>;{" "}
            <code className="rounded bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5">caption</code>,{" "}
            <code className="rounded bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5">alt</code>, and{" "}
            <code className="rounded bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5">portfolios</code> (array of strings) are optional.
          </p>
          <textarea
            className={`${inputClass} min-h-36 resize-y font-mono text-xs`}
            placeholder={`[\n  { "src": "https://…", "title": "…", "caption": "…" },\n  …\n]`}
            value={bulkJson}
            onChange={(e) => {
              setBulkJson(e.target.value);
              parseBulk(e.target.value);
            }}
            spellCheck={false}
          />
          {bulkError && <p className="mt-2 text-sm text-[#f0a3a3]">{bulkError}</p>}
          {bulkParsed && (
            <p className="mt-2 text-sm text-[#9fd9a4]">
              {bulkParsed.length} photo{bulkParsed.length === 1 ? "" : "s"} ready to import.
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => bulkImport("append")}
              disabled={!bulkParsed}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
            >
              Append to list
            </button>
            <button
              onClick={() => bulkImport("replace")}
              disabled={!bulkParsed}
              className="rounded-full border border-[rgba(255,255,255,0.25)] px-5 py-2.5 text-sm transition hover:bg-[rgba(255,255,255,0.08)] disabled:opacity-40"
            >
              Replace all
            </button>
          </div>
        </section>

        {/* Current list */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg">Current photos</h2>
          {list.length === 0 ? (
            <p className="text-sm text-[rgba(255,255,255,0.5)]">No photos yet. Add one above.</p>
          ) : (
            <ul className="grid gap-3">
              {list.map((photo, index) => (
                <li
                  key={index}
                  className="flex items-start gap-4 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.03)] p-3"
                >
                  <img
                    src={photo.src}
                    alt={photo.alt ?? photo.title}
                    className="size-16 shrink-0 rounded-lg bg-[rgba(255,255,255,0.06)] object-cover"
                  />
                  {editing === index ? (
                    <div className="grid min-w-0 flex-1 gap-2">
                      <input className={inputClass} placeholder="Image URL" value={photo.src} onChange={(e) => editField(index, { src: e.target.value })} />
                      <input className={inputClass} placeholder="Title" value={photo.title} onChange={(e) => editField(index, { title: e.target.value })} />
                      <textarea className={`${inputClass} min-h-20 resize-y`} placeholder="Caption" value={photo.caption} onChange={(e) => editField(index, { caption: e.target.value })} />
                      <input className={inputClass} placeholder="Alt text (optional)" value={photo.alt ?? ""} onChange={(e) => editField(index, { alt: e.target.value || undefined })} />
                      <textarea
                        className={`${inputClass} min-h-20 resize-y`}
                        placeholder="Portfolios, one per line"
                        value={(photo.portfolios ?? []).join("\n")}
                        onChange={(e) => {
                          const tags = parsePortfolios(e.target.value);
                          editField(index, { portfolios: tags.length ? tags : undefined });
                        }}
                      />
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{photo.title}</p>
                      <p className="truncate text-sm text-[rgba(255,255,255,0.5)]">
                        {photo.caption || "No caption"}
                      </p>
                      <p className="mt-1 truncate text-xs text-[rgba(255,255,255,0.4)]">
                        {photo.portfolios?.length ? photo.portfolios.join(" · ") : "Uncategorized"}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditing(editing === index ? null : index)}
                      className={`grid size-9 place-items-center rounded-full transition ${editing === index ? "bg-white text-black hover:scale-105" : "bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.14)]"}`}
                      aria-label={editing === index ? "Done editing" : "Edit"}
                    >
                      {editing === index ? <Check className="size-4" /> : <Pencil className="size-4" />}
                    </button>
                    <button
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="grid size-9 place-items-center rounded-full bg-[rgba(255,255,255,0.06)] transition hover:bg-[rgba(255,255,255,0.14)] disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      onClick={() => move(index, 1)}
                      disabled={index === list.length - 1}
                      className="grid size-9 place-items-center rounded-full bg-[rgba(255,255,255,0.06)] transition hover:bg-[rgba(255,255,255,0.14)] disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      onClick={() => remove(index)}
                      className="grid size-9 place-items-center rounded-full bg-[rgba(255,255,255,0.06)] transition hover:bg-[rgba(212,24,61,0.5)]"
                      aria-label="Remove"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Save bar */}
        <section className="sticky bottom-4 z-10 mb-8 flex items-center justify-between gap-4 rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[rgba(10,10,12,0.85)] p-4 backdrop-blur-xl">
          <p className="text-sm">
            {saveMsg ? (
              <span className={saveMsg.ok ? "text-[#9fd9a4]" : "text-[#f0a3a3]"}>
                {saveMsg.text}
              </span>
            ) : dirty ? (
              <span className="text-[rgba(255,255,255,0.6)]">You have unsaved changes.</span>
            ) : (
              <span className="text-[rgba(255,255,255,0.4)]">Everything is saved.</span>
            )}
          </p>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Saving…" : "Save to site"}
          </button>
        </section>

        {/* Offline backup */}
        <section className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] p-5 md:p-6">
          <h2 className="mb-2 text-lg">Static fallback (optional)</h2>
          <p className="mb-4 text-sm leading-6 text-[rgba(255,255,255,0.55)]">
            The live site uses the backend. If you also want to update the built-in
            fallback list, copy this into{" "}
            <code className="rounded bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5">src/photos.ts</code>{" "}
            and redeploy.
          </p>
          <button
            onClick={copyExport}
            className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.2)] px-5 py-2.5 text-sm transition hover:bg-[rgba(255,255,255,0.08)]"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied!" : "Copy photos.ts"}
          </button>
          <pre className="mt-4 max-h-60 overflow-auto rounded-xl border border-[rgba(255,255,255,0.1)] bg-black/60 p-4 text-xs leading-5 text-[rgba(255,255,255,0.7)]">
            {toPhotosFile(list)}
          </pre>
        </section>
      </div>
      <Analytics />
    </main>
  );
}
