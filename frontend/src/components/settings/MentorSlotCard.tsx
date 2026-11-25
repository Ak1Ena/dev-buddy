import { useEffect, useId, useMemo, useState } from "react";
import { aiApi } from "@/lib/api";
import type { AICredential, AIModel, AIProvider, AISlot, AITestResult } from "@/types";
import { describeErrorCode, describeRequestError, redact } from "./aiErrors";

/*
 * One provider slot (Text mentor or Live mentor, D17). Both cards share this component because
 * they share the same record shape and endpoints; the live card only hides the connection test
 * (its realtime test is not in M1) and lists live-capable providers.
 *
 * Key handling: the key lives in this component's local state only, is sent once on Save or on a
 * draft test, and is cleared right after Save. It never goes to a store, localStorage or console.
 * Afterwards only `key_hint` from the server is shown.
 */

type Tone = "ok" | "bad" | "info";
interface Status {
  tone: Tone;
  text: string;
  detail?: string;
}

interface Props {
  slot: AISlot;
  title: string;
  blurb: string;
  providers: AIProvider[];
  credential: AICredential | null;
  onChange: (credential: AICredential | null) => void;
}

const fieldLabel = "mb-1 block text-sm font-semibold text-[var(--ink)]";
const hint = "mt-1 text-sm text-[var(--muted)]";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(s) || s < 0) return "";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function MentorSlotCard({ slot, title, blurb, providers, credential, onChange }: Props) {
  const uid = useId();
  const isLive = slot === "live";
  const choices = useMemo(
    () => (isLive ? providers.filter((p) => p.supports_live) : providers),
    [isLive, providers]
  );

  const [providerId, setProviderId] = useState(credential?.provider ?? "");
  const [baseUrl, setBaseUrl] = useState(credential?.base_url ?? "");
  const [apiKey, setApiKey] = useState("");
  const [replacingKey, setReplacingKey] = useState(false);
  const [model, setModel] = useState(credential?.model ?? "");
  const [models, setModels] = useState<AIModel[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<null | "test" | "save" | "remove" | "models">(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // When the saved record changes (load, save, remove), reset the form to it.
  useEffect(() => {
    setProviderId(credential?.provider ?? "");
    setBaseUrl(credential?.base_url ?? "");
    setModel(credential?.model ?? "");
    setApiKey("");
    setReplacingKey(false);
    setConfirmRemove(false);
  }, [credential]);

  const provider = choices.find((p) => p.id === providerId) ?? null;
  const sameAsSaved = !!credential && credential.provider === providerId;
  const hasSavedKey = sameAsSaved && !!credential?.key_hint;
  // Self-hosted servers (vLLM, LM Studio, custom) may or may not want a key; the backend stores
  // one if given, so offer it as optional there. Hosted providers require it; Ollama has none.
  const keyOptional = !!provider && !provider.needs_key && provider.needs_base_url;
  const showKeyField = !!provider?.needs_key || keyOptional;
  const showKeyInput = showKeyField && (!hasSavedKey || replacingKey);
  const keyReady = !provider?.needs_key || apiKey.trim() !== "" || (hasSavedKey && !replacingKey);
  const urlReady = !provider?.needs_base_url || baseUrl.trim() !== "";
  const savedUrl = credential?.base_url ?? "";
  const connectionDirty =
    !sameAsSaved || apiKey.trim() !== "" || (!!provider?.needs_base_url && baseUrl.trim() !== savedUrl);
  const modelDirty = model !== (sameAsSaved ? credential?.model ?? "" : "");
  const canSave = !!provider && keyReady && urlReady && (connectionDirty || modelDirty);
  const canTest = !!provider && keyReady && urlReady;

  const say = (tone: Tone, text: string, detail?: string) => setStatus({ tone, text, detail });

  function pickProvider(id: string) {
    const next = choices.find((p) => p.id === id);
    const backToSaved = !!credential && credential.provider === id;
    setProviderId(id);
    setBaseUrl(backToSaved ? credential?.base_url ?? "" : next?.default_base_url ?? "");
    setModel(backToSaved ? credential?.model ?? "" : "");
    setModels(null);
    setApiKey("");
    setReplacingKey(false);
    setStatus(null);
  }

  async function loadModels(after?: string) {
    setBusy("models");
    try {
      const res = await aiApi.models(slot);
      setModels(res.data);
      const n = res.data.length;
      say("ok", `${after ? after + " " : ""}${n} model${n === 1 ? "" : "s"} loaded. Pick one, then save.`);
    } catch (err) {
      say("bad", `${after ? after + " " : ""}Couldn't load the model list.`, describeRequestError(err));
    } finally {
      setBusy(null);
    }
  }

  function reportTest(r: AITestResult) {
    if (r.ok) {
      const ms = r.latency_ms != null ? ` in ${Math.round(r.latency_ms)} ms` : "";
      // A draft test returns the model list, so the picker fills before the first save.
      if (r.models && r.models.length > 0) {
        setModels(r.models);
        const n = r.models.length;
        say("ok", `Connected${ms}. ${n} model${n === 1 ? "" : "s"} found. Pick one, then save.`);
      } else {
        const count = r.model_count != null ? ` ${r.model_count} models available.` : "";
        say("ok", `Connected${ms}.${count}`);
      }
    } else {
      say("bad", describeErrorCode(r.error_code), r.message ? redact(r.message, apiKey.trim()) : undefined);
    }
  }

  async function testConnection() {
    if (!provider) return;
    setBusy("test");
    say("info", "Testing…");
    try {
      if (connectionDirty) {
        // Unsaved setup: test it without storing anything.
        const res = await aiApi.testDraft({
          provider: provider.id,
          base_url: provider.needs_base_url ? baseUrl.trim() : undefined,
          api_key: apiKey.trim() || undefined,
          slot,
        });
        reportTest(res.data);
      } else {
        const res = await aiApi.test(slot);
        // Refresh the record so the status badge shows the new result.
        const list = await aiApi.credentials();
        onChange(list.data.find((c) => c.slot === slot) ?? null);
        if (res.data.ok) {
          const ms = res.data.latency_ms != null ? ` in ${Math.round(res.data.latency_ms)} ms` : "";
          setBusy(null);
          await loadModels(`Connected${ms}.`);
        } else {
          reportTest(res.data);
        }
      }
    } catch (err) {
      say("bad", "The test didn't finish.", redact(describeRequestError(err), apiKey.trim()));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!provider) return;
    setBusy("save");
    const key = apiKey.trim();
    try {
      const res = await aiApi.save(slot, {
        provider: provider.id,
        model: model || null,
        base_url: provider.needs_base_url ? baseUrl.trim() : null,
        ...(key ? { api_key: key } : {}),
      });
      setApiKey("");
      setReplacingKey(false);
      onChange(res.data);
      if (!model) {
        setBusy(null);
        await loadModels("Saved.");
      } else {
        say("ok", isLive ? "Saved. The live test comes in a later update." : "Saved.");
      }
    } catch (err) {
      say("bad", "Couldn't save.", redact(describeRequestError(err), key));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await aiApi.remove(slot);
      onChange(null);
      setModels(null);
      say("info", isLive ? "Live mentor removed." : "Removed. Nexora uses its default AI until you set one.");
    } catch (err) {
      say("bad", "Couldn't remove it.", describeRequestError(err));
    } finally {
      setBusy(null);
      setConfirmRemove(false);
    }
  }

  // Model options: the loaded list, else just the saved model so a reload shows it without
  // calling the provider.
  const loaded = models ?? [];
  const modelOptions: AIModel[] =
    model && !loaded.some((m) => m.id === model) ? [{ id: model }, ...loaded] : loaded;

  const badge = !credential
    ? { cls: "bg-[var(--surface2)] text-[var(--muted)]", text: isLive ? "Not set up" : "Not set: Nexora's default AI" }
    : isLive
      ? { cls: "bg-[var(--accent-soft)] text-[var(--accent-text)]", text: "Saved · live test comes later" }
      : credential.status === "ok"
        ? { cls: "bg-[var(--ok-soft)] text-[var(--ok)]", text: `Connected · checked ${timeAgo(credential.last_checked_at)}` }
        : credential.status === "failed"
          ? { cls: "bg-[var(--bad-soft)] text-[var(--bad)]", text: "Last test failed" }
          : { cls: "bg-[var(--warn-soft)] text-[var(--warn)]", text: "Saved · not tested yet" };

  const statusColor =
    status?.tone === "ok" ? "text-[var(--ok)]" : status?.tone === "bad" ? "text-[var(--bad)]" : "text-[var(--muted)]";

  return (
    <section
      aria-labelledby={`${uid}-h`}
      className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <h2 id={`${uid}-h`} className="text-2xl">
        {title}
      </h2>
      <p className="mt-1 text-[var(--muted)]">{blurb}</p>
      <p className="mt-3">
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${badge.cls}`}>{badge.text}</span>
      </p>

      <form className="mt-5 grid gap-5" noValidate onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor={`${uid}-p`} className={fieldLabel}>
            Provider
          </label>
          <select
            id={`${uid}-p`}
            className="path-input"
            value={providerId}
            onChange={(e) => pickProvider(e.target.value)}
          >
            <option value="">Choose a provider</option>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {isLive && <p className={hint}>Only providers with a live model are listed. It can differ from your text mentor.</p>}
        </div>

        {provider?.needs_base_url && (
          <div>
            <label htmlFor={`${uid}-u`} className={fieldLabel}>
              Endpoint
            </label>
            <input
              id={`${uid}-u`}
              className="path-input"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={provider.default_base_url ?? "https://your-server/v1"}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className={hint}>
              {provider.local ? "Where the model answers on your own machine." : "Where your server answers."}
            </p>
          </div>
        )}

        {showKeyField && (
          <div>
            {showKeyInput ? (
              <>
                <label htmlFor={`${uid}-k`} className={fieldLabel}>
                  API key{keyOptional ? " (optional)" : ""}
                </label>
                <input
                  id={`${uid}-k`}
                  className="path-input"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  data-1p-ignore
                  data-lpignore="true"
                  placeholder={keyOptional ? "Only if your server asks for one" : "Paste a key"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </>
            ) : (
              <div role="group" aria-labelledby={`${uid}-kl`}>
                <span id={`${uid}-kl`} className={fieldLabel}>
                  API key
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-xl bg-[var(--surface2)] px-3 py-2 font-mono text-sm">
                    Saved, ends {credential?.key_hint}
                  </span>
                  <button type="button" className="path-btn" onClick={() => setReplacingKey(true)}>
                    Replace key
                  </button>
                </div>
              </div>
            )}
            <p className={hint}>Kept on the Nexora server, never in your browser. You won't see it again after saving.</p>
          </div>
        )}

        {provider && (
          <div>
            <label htmlFor={`${uid}-m`} className={fieldLabel}>
              Model
            </label>
            <select
              id={`${uid}-m`}
              className="path-input"
              value={model}
              disabled={modelOptions.length === 0}
              onChange={(e) => setModel(e.target.value)}
            >
              {modelOptions.length === 0 ? (
                <option value="">{isLive ? "Save to load the models" : "Test the connection to load the models"}</option>
              ) : (
                <>
                  <option value="">Choose a model</option>
                  {modelOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label && m.label !== m.id ? `${m.label} (${m.id})` : m.id}
                    </option>
                  ))}
                </>
              )}
            </select>
            {!models && model && sameAsSaved && (
              <p className={hint}>{isLive ? "Save again to reload the list." : "Test the connection to see the full list."}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!isLive && (
            <button type="button" className="path-btn" disabled={!canTest || busy !== null} onClick={testConnection}>
              {busy === "test" ? "Testing…" : "Test connection"}
            </button>
          )}
          <button type="button" className="path-btn primary" disabled={!canSave || busy !== null} onClick={save}>
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          {credential &&
            (confirmRemove ? (
              <>
                <button type="button" className="path-btn danger" disabled={busy !== null} onClick={remove}>
                  {busy === "remove" ? "Removing…" : credential.key_hint ? "Yes, delete key" : "Yes, remove"}
                </button>
                <button type="button" className="path-btn" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="path-btn danger" disabled={busy !== null} onClick={() => setConfirmRemove(true)}>
                {credential.key_hint ? "Delete key" : "Remove setup"}
              </button>
            ))}
        </div>

        <div role="status" aria-live="polite" className={`min-h-[1.5rem] text-sm ${statusColor}`}>
          {status && (
            <>
              <p className="font-semibold">{status.text}</p>
              {status.detail && <p className="mt-1 text-[var(--muted)]">{status.detail}</p>}
            </>
          )}
        </div>

        {isLive && (
          <p className={hint}>
            For now Nexora saves the provider and model. Testing a live voice call comes in a later update.
          </p>
        )}
      </form>
    </section>
  );
}
