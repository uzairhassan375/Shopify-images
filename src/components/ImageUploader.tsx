"use client";

import { useRef, useState } from "react";

type UploadResult = {
  id: string;
  url: string;
  filename: string;
  width?: number;
  height?: number;
};

export default function ImageUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  function resetFileInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function onFileChange(file: File | null) {
    setError(null);
    setResult(null);
    setCopied(false);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (!file) {
      setPreviewUrl(null);
      setSelectedName(null);
      return;
    }

    setSelectedName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);
    setResult(null);
    setCopied(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setResult(data as UploadResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    await handleUpload(file);
  }

  async function copyUrl() {
    if (!result?.url) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-12 sm:py-16">
      <header className="space-y-3">
        <p className="text-sm tracking-[0.18em] text-[var(--accent)] uppercase">
          Shopify Files
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Upload image → CDN URL
        </h1>
        <p className="max-w-xl text-[var(--muted)]">
          Pick an image, upload it to your store&apos;s Shopify Files, then copy
          the permanent CDN link.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 sm:p-7"
      >
        <label
          htmlFor="image"
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-soft)] px-4 py-10 text-center transition hover:border-[var(--accent)]"
        >
          <span className="text-base font-medium">
            {selectedName ? selectedName : "Drop or choose an image"}
          </span>
          <span className="text-sm text-[var(--muted)]">
            JPEG, PNG, GIF, WebP · max 20MB
          </span>
          <input
            ref={inputRef}
            id="image"
            name="file"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isUploading || !selectedName}
            className="rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium text-[#042f2e] transition enabled:hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? "Uploading to Shopify…" : "Upload to Shopify Files"}
          </button>
          <button
            type="button"
            onClick={() => {
              onFileChange(null);
              resetFileInput();
            }}
            className="rounded-lg border border-[var(--border)] px-5 py-2.5 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
          >
            Clear
          </button>
        </div>

        {error && (
          <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </form>

      {(previewUrl || result) && (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 sm:p-7">
          <h2 className="text-lg font-medium">Preview & URL</h2>

          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-black/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result?.url || previewUrl || ""}
              alt={result?.filename || selectedName || "Uploaded preview"}
              className="mx-auto max-h-[420px] w-full object-contain"
            />
          </div>

          {result ? (
            <div className="space-y-3">
              <label className="block text-sm text-[var(--muted)]">
                Shopify CDN URL
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  readOnly
                  value={result.url}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] outline-none ring-[var(--ring)] focus:ring-2"
                />
                <button
                  type="button"
                  onClick={copyUrl}
                  className="shrink-0 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm transition hover:border-[var(--accent)]"
                >
                  {copied ? "Copied" : "Copy URL"}
                </button>
              </div>
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm text-[var(--accent)] underline-offset-4 hover:underline"
              >
                Open CDN image
              </a>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Local preview ready. Upload to get the Shopify CDN URL.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
