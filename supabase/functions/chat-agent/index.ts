// =========================================================
// KEYS99 - CHAT AGENT (Supabase Edge Function)
//
// Server-side proxy to the Google Gemini API so the API key
// never reaches the browser. Powers the floating chat widget
// (js/chat-widget.js) on every page.
//
// Deploy:   supabase functions deploy chat-agent
// Secret:   supabase secrets set GEMINI_API_KEY=AIza...
// (Get a free-tier key at https://aistudio.google.com/apikey -
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided
// automatically by the Edge Functions runtime.)
//
// NOTE: unlike the Claude version of this file, this is
// written directly against Google's documented REST shape
// (no bundled/verified SDK reference was available while
// writing this) and has since been corrected against two
// live errors from the real API (retired model name, and
// role "function" being rejected - function results now go
// back as role "user", confirmed working).
// =========================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// gemini-2.0-flash was retired by Google (confirmed via a live 404 from
// the API itself, which pointed at this replacement). Check
// https://ai.google.dev/gemini-api/docs/models if this one is ever
// retired too - swap the constant, nothing else needs to change.
const MODEL = "gemini-3.6-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_TOOL_ITERATIONS = 4;
const MAX_HISTORY_MESSAGES = 16;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are the Keys99.com real estate assistant, embedded as a chat widget on a real estate listings website in India.

When a visitor describes what they're looking for (city, locality, budget, BHK, buy vs rent), ALWAYS call the search_properties function before answering - never guess or invent listings, prices, RERA status, or availability. Only describe properties actually returned by the function.

When you list a property, format each one like this:
**<Developer> - <BHK>** in <Locality>, <City> - <Price>
[View Property](property-details.html?id=<id>)

If search_properties returns zero matches, say so plainly and suggest the visitor widen their budget/location, or browse search.html directly - don't pretend something is available.

For general questions (home loans, EMI basics, RERA, the buying/renting process, how Keys99 works), answer helpfully and concisely from your own knowledge - the function isn't needed for these.

Keep replies short and conversational (roughly 2-5 sentences, plus any property results) - this is a chat bubble, not an essay.

Never invent contact numbers, legal guarantees, or price negotiations. For anything requiring a human (site visits, negotiation, legal advice), point the visitor to the Enquire button on the property's page, or the contact details in the site footer.

After your reply, on its own new line, suggest up to 3 short follow-up replies the visitor might want to tap next (each under 6 words - things like "Show more options", "What about 3 BHK?", "Calculate EMI for this"). Use exactly this format for that line, with no other text on it:
SUGGESTIONS: First suggestion | Second suggestion | Third suggestion
Only include that line when there's a genuinely useful next step - skip it entirely for a simple closed-ended answer. Never use the literal text "SUGGESTIONS:" anywhere else in your reply.

Today's date is ${new Date().toISOString().slice(0, 10)}.`;

// Gemini function-declaration schema uses an OpenAPI-style subset with
// UPPERCASE type names (STRING/NUMBER/OBJECT/...), not JSON Schema's
// lowercase - this is different from Claude/OpenAI's tool schema shape.
const SEARCH_TOOL_DECLARATION = {
  name: "search_properties",
  description:
    "Search Keys99's live property listings by city, locality, buy/rent status, BHK type, and budget. Always use this before recommending specific properties - never invent listings.",
  parameters: {
    type: "OBJECT",
    properties: {
      city: { type: "STRING", description: "City name, e.g. 'Mumbai', 'Pune'" },
      locality: { type: "STRING", description: "Neighborhood / locality name" },
      status: {
        type: "STRING",
        enum: ["sale", "rent"],
        description: "Whether the visitor wants to buy or rent",
      },
      bhk: { type: "STRING", description: "BHK type, e.g. '1 BHK', '2 BHK', '3 BHK'" },
      min_price: { type: "NUMBER", description: "Minimum budget in INR" },
      max_price: { type: "NUMBER", description: "Maximum budget in INR" },
      limit: { type: "NUMBER", description: "Max results to return (default 5, max 8)" },
    },
    required: [],
  },
};

type BhkOption = { type?: string; price?: number | string };

function getNumericPrice(option: BhkOption): number | null {
  const price = Number(option?.price);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function getMinPrice(bhkOptions: BhkOption[]): number | null {
  const prices = (bhkOptions || [])
    .map(getNumericPrice)
    .filter((p): p is number => p !== null);
  return prices.length ? Math.min(...prices) : null;
}

function formatPrice(price: number | null): string {
  if (price === null) return "Price on request";
  if (price >= 10000000) {
    const crore = price / 10000000;
    return `₹ ${crore.toFixed(crore % 1 === 0 ? 0 : 2).replace(/\.00$/, "")} Cr`;
  }
  if (price >= 100000) {
    const lakh = price / 100000;
    return `₹ ${lakh.toFixed(lakh % 1 === 0 ? 0 : 2).replace(/\.00$/, "")} Lakh`;
  }
  return `₹ ${price.toLocaleString("en-IN")}`;
}

// Mirrors getStatusClass() used on every other page (search.html etc.) -
// property.status is free text ("For Sale", "Available", ...), not an enum.
function getStatusClass(status: unknown): "sale" | "rent" | "sold" {
  const value = String(status || "").toLowerCase();
  if (value.includes("rent") || value.includes("lease")) return "rent";
  if (value.includes("sold") || value.includes("closed")) return "sold";
  return "sale";
}

interface PropertyRow {
  id: string;
  developer: string | null;
  city: string | null;
  locality: string | null;
  state: string | null;
  status: string | null;
  bhk_options: BhkOption[] | null;
  rera_id: string | null;
}

async function searchProperties(rawInput: unknown): Promise<Record<string, unknown>> {
  const input = (rawInput && typeof rawInput === "object" ? rawInput : {}) as Record<string, unknown>;
  const limit = Math.min(Math.max(Number(input.limit) || 5, 1), 8);

  let query = supabaseAdmin
    .from("projects")
    .select("id, developer, city, locality, state, status, bhk_options, rera_id")
    .order("created_at", { ascending: false })
    .limit(50);

  if (typeof input.city === "string" && input.city.trim()) {
    query = query.ilike("city", `%${input.city.trim()}%`);
  }
  if (typeof input.locality === "string" && input.locality.trim()) {
    query = query.ilike("locality", `%${input.locality.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("search_properties query failed:", error);
    return { error: "Property search failed. Please try again." };
  }

  let results = ((data || []) as PropertyRow[]).map((p) => {
    const bhkOptions = Array.isArray(p.bhk_options) ? p.bhk_options : [];
    const price = getMinPrice(bhkOptions);
    const bhkTypes = [
      ...new Set(bhkOptions.map((o) => String(o?.type || "").trim()).filter(Boolean)),
    ];
    return {
      id: p.id,
      developer: p.developer || "Untitled Property",
      location: [p.locality, p.city].filter(Boolean).join(", "),
      bhk: bhkTypes.join(" / "),
      statusClass: getStatusClass(p.status),
      price,
      priceText: formatPrice(price),
      rera: Boolean(p.rera_id),
    };
  });

  if (typeof input.status === "string" && (input.status === "sale" || input.status === "rent")) {
    results = results.filter((r) => r.statusClass === input.status);
  }

  if (typeof input.bhk === "string" && input.bhk.trim()) {
    const wanted = input.bhk.trim().toLowerCase().replace(/\s+/g, "");
    results = results.filter((r) => r.bhk.toLowerCase().replace(/\s+/g, "").includes(wanted));
  }

  if (Number.isFinite(Number(input.min_price))) {
    const min = Number(input.min_price);
    results = results.filter((r) => r.price !== null && r.price >= min);
  }

  if (Number.isFinite(Number(input.max_price))) {
    const max = Number(input.max_price);
    results = results.filter((r) => r.price !== null && r.price <= max);
  }

  results = results.slice(0, limit);

  return { count: results.length, properties: results };
}

// ---- Gemini request/response shapes (subset we use) ----

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: Array<{
    content?: GeminiContent;
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

// Pulls a trailing "SUGGESTIONS: a | b | c" line off the model's reply
// (if present) and returns it as a separate array for the widget to
// render as tappable quick-reply chips.
function extractSuggestions(text: string): { reply: string; suggestions: string[] } {
  const match = text.match(/\n?SUGGESTIONS:\s*(.+?)\s*$/i);

  if (!match) {
    return { reply: text.trim(), suggestions: [] };
  }

  const suggestions = match[1]
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  return { reply: text.slice(0, match.index).trim(), suggestions };
}

// Distinguishes "Google's free tier rate-limited us" (status 429) from
// other failures, so the visitor gets an honest message instead of a
// generic error - the free tier caps this model at a small number of
// requests per day, which is easy to hit under real traffic.
class GeminiApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function callGemini(contents: GeminiContent[]): Promise<GeminiResponse> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: [{ functionDeclarations: [SEARCH_TOOL_DECLARATION] }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new GeminiApiError(response.status, `Gemini API error ${response.status}: ${errorBody}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const incoming = Array.isArray((body as { messages?: unknown })?.messages)
    ? (body as { messages: unknown[] }).messages
    : [];

  const history = incoming
    .filter(
      (m): m is { role: string; content: string } =>
        !!m &&
        typeof m === "object" &&
        ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant") &&
        typeof (m as { content?: unknown }).content === "string",
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.slice(0, 4000),
    }));

  if (!history.length || history[history.length - 1].role !== "user") {
    return jsonResponse({ error: "No user message provided." }, 400);
  }

  const contents: GeminiContent[] = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    let finalText = "";
    let finalSuggestions: string[] = [];

    for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
      const response = await callGemini(contents);

      if (response.promptFeedback?.blockReason) {
        finalText =
          "I'm not able to help with that. Is there something else about buying, renting, or a listing I can help with?";
        finalSuggestions = ["Browse properties", "Contact us"];
        break;
      }

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      const functionCalls = parts.filter((p): p is GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> } =>
        Boolean(p.functionCall),
      );

      if (functionCalls.length === 0) {
        const textPart = parts.find((p) => typeof p.text === "string");
        const rawText = textPart?.text || "Sorry, I couldn't come up with a response - could you rephrase that?";
        const extracted = extractSuggestions(rawText);
        finalText = extracted.reply || rawText;
        finalSuggestions = extracted.suggestions;
        break;
      }

      // Model's turn (the function call requests) goes back into history verbatim.
      contents.push({ role: "model", parts });

      const responseParts: GeminiPart[] = [];
      for (const call of functionCalls) {
        if (call.functionCall.name === "search_properties") {
          const result = await searchProperties(call.functionCall.args);
          responseParts.push({ functionResponse: { name: "search_properties", response: result } });
        } else {
          responseParts.push({
            functionResponse: { name: call.functionCall.name, response: { error: "Unknown function." } },
          });
        }
      }

      // Google's API rejects role "function" (confirmed via a live 400) -
      // function results go back as a "user" turn, same as the model's
      // own turns use "model".
      contents.push({ role: "user", parts: responseParts });

      if (iteration === MAX_TOOL_ITERATIONS) {
        finalText =
          "I found some information but I'm having trouble finishing my answer - could you narrow your search a bit (city, budget, BHK)?";
        finalSuggestions = ["Try a simpler search", "Browse properties"];
      }
    }

    return jsonResponse({ reply: finalText, suggestions: finalSuggestions });
  } catch (error) {
    console.error("chat-agent error:", error);

    const isRateLimited = error instanceof GeminiApiError && error.status === 429;

    return jsonResponse({
      reply: isRateLimited
        ? "I'm getting a lot of questions right now and hit a temporary limit - please try again in a few minutes, or reach us directly from the Contact section."
        : "Sorry, I'm having trouble responding right now. Please try again in a moment, or reach us from the Contact section.",
      suggestions: ["Browse properties", "Contact us"],
    });
  }
});
