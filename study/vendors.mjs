// The vendor layer, shared by study/generate.mjs and study/reedit.mjs.
//
// Extracted from generate.mjs on 2026-09-01 when the re-edit experiment needed
// to hold a conversation rather than send one message. Both scripts talk to the
// same three APIs with the same retry rules, and a second copy of that logic
// would have drifted from this one within a week.
//
// The one change made during the extraction: every body() now takes a MESSAGES
// ARRAY rather than a single prompt string. A single-turn call is the array
// with one element in it, so generate.mjs sends what it always sent, with one
// exception worth recording: the Gemini body now carries an explicit
// role: "user" on each content block, which the old single-turn body omitted.
// Gemini defaults an omitted role to "user", so the request means the same
// thing, but it is not the identical JSON and this note is here so nobody
// later reads a Gemini rate shift as a model change when it was ours.

export const VERSION = "2023-06-01";

// Thinking tokens bill against max_tokens, and the thinking API itself differs
// between model generations. Send no thinking config and leave generous
// headroom: that combination works on every model this might pick.
// (Learned the hard way when the weekly refresh died silently on 2026-08-17.)
export const MAX_OUTPUT_TOKENS = 4000;

// Roles are normalised to OpenAI's names everywhere in this repository:
// "user" and "assistant". Gemini calls the second one "model" and rejects
// "assistant", so that translation happens here and nowhere else.
const geminiRole = (r) => (r === "assistant" ? "model" : "user");

export const VENDORS = {
  anthropic: {
    env: "ANTHROPIC_API_KEY",
    listUrl: () => "https://api.anthropic.com/v1/models?limit=40",
    listHeaders: (k) => ({ "x-api-key": k, "anthropic-version": VERSION }),
    listIds: (d) => (d.data || []).map((x) => x.id),
    // Anthropic ids sort newest-first from the API, and the family is
    // unambiguous, so this one can pick for itself.
    autoPick: (ids) => ids.filter((id) => /^claude/.test(id))[0],
    url: () => "https://api.anthropic.com/v1/messages",
    headers: (k) => ({ "x-api-key": k, "anthropic-version": VERSION, "content-type": "application/json" }),
    // max_tokens is required here. Elsewhere no cap is sent at all: the field
    // name for it has diverged between vendors and between model generations,
    // and a request field that only some models accept is exactly what broke
    // the weekly refresh on 2026-08-17.
    body: (model, messages) => ({ model, max_tokens: MAX_OUTPUT_TOKENS, messages }),
    text: (d) => (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n"),
    served: (d) => d.model,
    why: (d) => `stop_reason=${d.stop_reason}`,
  },
  openai: {
    env: "OPENAI_API_KEY",
    listUrl: () => "https://api.openai.com/v1/models",
    listHeaders: (k) => ({ authorization: `Bearer ${k}` }),
    listIds: (d) => (d.data || []).map((x) => x.id).sort(),
    autoPick: () => null,
    url: () => "https://api.openai.com/v1/chat/completions",
    headers: (k) => ({ authorization: `Bearer ${k}`, "content-type": "application/json" }),
    body: (model, messages) => ({ model, messages }),
    text: (d) => (d.choices || []).map((c) => c.message?.content || "").join("\n"),
    served: (d) => d.model,
    why: (d) => `finish_reason=${d.choices?.[0]?.finish_reason}`,
  },
  // Test-only. Sends nothing, costs nothing, and exists because the multi-turn
  // conversation logic in study/reedit.mjs - forking one baseline into two arms
  // that must never see each other's turns - is exactly the kind of thing that
  // looks right and is wrong, and verifying it against a live API means paying
  // to find that out.
  //
  // Its reply reports the history it was handed, so a test can assert that arm A
  // and arm B carry different turns and the same baseline. Any corpus built with
  // it records model "mock-echo-1" in the manifest and is self-identifying as
  // not real; nothing measured should ever contain it.
  mock: {
    env: "MOCK_NO_KEY_NEEDED",
    local: true,
    autoPick: () => "mock-echo-1",
    served: () => "mock-echo-1",
    reply: (messages) =>
      `[turns=${messages.length}] ` +
      messages.map((m) => `${m.role[0]}:${m.content.slice(0, 30).replace(/\s+/g, " ")}`).join(" | "),
  },
  gemini: {
    env: "GEMINI_API_KEY",
    listUrl: (k) => `https://generativelanguage.googleapis.com/v1beta/models?key=${k}`,
    listHeaders: () => ({}),
    listIds: (d) => (d.models || []).map((m) => m.name.replace(/^models\//, "")).sort(),
    autoPick: () => null,
    url: (k, model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${k}`,
    headers: () => ({ "content-type": "application/json" }),
    body: (model, messages) => ({
      contents: messages.map((m) => ({ role: geminiRole(m.role), parts: [{ text: m.content }] })),
    }),
    text: (d) => (d.candidates || []).flatMap((c) => (c.content?.parts || []).map((p) => p.text || "")).join("\n"),
    served: (d) => d.modelVersion,
    why: (d) => `finishReason=${d.candidates?.[0]?.finishReason}`,
  },
};

// Some failures will never fix themselves by trying again: a missing key, a
// revoked key, an account with no credit on it. Those abort the whole run.
// Others are transient: a per-minute rate limit, a 5xx. Those get a few backed
// off retries. The first version of this did neither and fired 39 more doomed
// requests after the first one came back saying the balance was zero.
export class Fatal extends Error {}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function req(V, VENDOR, url, opts = {}, attempt = 0) {
  const r = await fetch(url, opts);
  const body = await r.text();
  if (r.ok) return JSON.parse(body);

  const fatal =
    r.status === 401 || r.status === 403 ||
    /insufficient_quota|billing_not_active|invalid_api_key|account_deactivated|API_KEY_INVALID|PERMISSION_DENIED/i.test(body);
  if (fatal) {
    let hint = "";
    if (/insufficient_quota|billing/i.test(body)) {
      hint = VENDOR === "openai"
        ? "\n  Add credit at https://platform.openai.com/settings/organization/billing - API billing is separate from ChatGPT."
        : "\n  This account has no usable balance for the API.";
    } else if (r.status === 401 || /invalid_api_key|API_KEY_INVALID/i.test(body)) {
      hint = `\n  Check ${V.env} in .env. The key is shown once at creation and cannot be read back.`;
    }
    let msg = body;
    try { msg = JSON.parse(body)?.error?.message || body; } catch { /* not JSON */ }
    throw new Fatal(`${r.status} from ${VENDOR}: ${msg.toString().slice(0, 200)}${hint}`);
  }

  // Transient. Honour Retry-After when the vendor sends one.
  if ((r.status === 429 || r.status >= 500) && attempt < 3) {
    const wait = Number(r.headers.get("retry-after")) * 1000 || 2000 * Math.pow(2, attempt);
    console.log(`  ${r.status}, retrying in ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return req(V, VENDOR, url, opts, attempt + 1);
  }
  throw new Error(`${r.status}: ${body.slice(0, 300)}`);
}

export async function listModels(V, VENDOR, KEY) {
  if (V.local) return [V.autoPick()];
  return V.listIds(await req(V, VENDOR, V.listUrl(KEY), { headers: V.listHeaders(KEY) }));
}

// An alias like "chat-latest" is the most representative thing to sample,
// because it is what ordinary users are served, and the least reproducible
// thing to publish, because it moves. Vendors report the id they actually ran,
// so the caller gets it back on every turn rather than having it printed to the
// console and thrown away.
//
// messages is the FULL conversation so far, oldest first. The caller owns it.
// Nothing here mutates or remembers it: an experiment that needs three rounds
// of the same conversation must be able to fork it after round one and send
// two different continuations, and a client that kept its own history could not
// do that without the two branches contaminating each other.
export async function chat(V, VENDOR, KEY, model, messages) {
  if (V.local) return { text: V.reply(messages), served: V.served() };
  const d = await req(V, VENDOR, V.url(KEY, model), {
    method: "POST",
    headers: V.headers(KEY),
    body: JSON.stringify(V.body(model, messages)),
  });
  const text = (V.text(d) || "").trim();
  if (!text) throw new Error(`empty response (${V.why(d)})`);
  return { text, served: (V.served && V.served(d)) || null };
}
