import { useCallback, useEffect, useState } from "react";
import { aiApi } from "@/lib/api";
import type { AICredential, AIProvider, AISlot } from "@/types";
import MentorSlotCard from "@/components/settings/MentorSlotCard";
import { describeRequestError } from "@/components/settings/aiErrors";
import "@/styles/theme-path.css";

/*
 * /settings: "Settings: your AI buddy" (M1 step 6, design A. Path, mock body.html lines 109-116).
 * A page in src/pages like the other routes; the per-slot form lives in components/settings.
 * Credentials are fetched fresh on every visit and kept in page state only (no Zustand store),
 * so nothing about them persists in the browser.
 */
export default function Settings() {
  const [providers, setProviders] = useState<AIProvider[] | null>(null);
  const [creds, setCreds] = useState<Record<AISlot, AICredential | null>>({ text: null, live: null });
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [p, c] = await Promise.all([aiApi.providers(), aiApi.credentials()]);
      setProviders(p.data);
      setCreds({
        text: c.data.find((x) => x.slot === "text") ?? null,
        live: c.data.find((x) => x.slot === "live") ?? null,
      });
    } catch (err) {
      setLoadError(describeRequestError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setSlot = (slot: AISlot) => (c: AICredential | null) => setCreds((prev) => ({ ...prev, [slot]: c }));

  return (
    <main className="theme-path min-h-[calc(100vh-4rem)]">
      <div className="mx-auto w-full max-w-[1160px] px-4 pb-24 pt-6 sm:px-8 sm:pt-9">
        <header className="max-w-[64ch]">
          <h1 className="text-[clamp(30px,4vw,44px)] leading-tight">Settings: your AI buddy</h1>
          <p className="mt-2 text-[19px] text-[var(--muted)]">
            Nexora works with the AI you choose. The text mentor and the live mentor are set up separately.
          </p>
          <p className="mt-2 text-[var(--ink)]">Your learning record stays with Nexora if you switch provider.</p>
        </header>

        {loadError ? (
          <div role="alert" className="mt-8 rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-6">
            <p className="font-semibold text-[var(--bad)]">Couldn't load your AI settings.</p>
            <p className="mt-1 text-[var(--muted)]">{loadError}</p>
            <button type="button" className="path-btn mt-4" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : !providers ? (
          <p className="mt-8 text-[var(--muted)]" role="status">
            Loading…
          </p>
        ) : (
          <div className="mt-8 grid items-start gap-6 min-[900px]:grid-cols-2">
            <MentorSlotCard
              slot="text"
              title="Text mentor"
              blurb="The chat in lessons: questions and hints, in writing."
              providers={providers}
              credential={creds.text}
              onChange={setSlot("text")}
            />
            <MentorSlotCard
              slot="live"
              title="Live mentor"
              blurb="An optional voice call beside the lesson, with captions. It can use a different provider from the text mentor."
              providers={providers}
              credential={creds.live}
              onChange={setSlot("live")}
            />
          </div>
        )}
      </div>
    </main>
  );
}
