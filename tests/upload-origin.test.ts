import assert from "node:assert/strict";
import { test } from "node:test";
import { sameOrigin } from "../lib/marketplace-api";
import { POST } from "../app/api/upload/route";

// In production the Next.js standalone server builds request.url from its own listen address and port
// (HOSTNAME || 0.0.0.0, PORT), with the protocol from X-Forwarded-Proto: never https://joro.pk.
const PRODUCTION_URL = "https://0.0.0.0:3000/api/upload";
const LOCAL_URL = "http://localhost:3000/api/upload";

function withNodeEnv<T>(value: string, run: () => T): T {
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: value });
  const restore = () => { Object.assign(process.env, { NODE_ENV: previous }); };
  try {
    const result = run();
    if (result instanceof Promise) return result.finally(restore) as T;
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

const request = (url: string, origin?: string) => new Request(url, { method: "POST", headers: origin ? { origin } : {} });
const allowed = (url: string, origin?: string) => { try { sameOrigin(request(url, origin)); return true; } catch { return false; } };

test("production: the public JORO origins are accepted although request.url is internal", () => withNodeEnv("production", () => {
  assert.equal(allowed(PRODUCTION_URL, "https://joro.pk"), true);
  assert.equal(allowed(PRODUCTION_URL, "https://www.joro.pk"), true);
  assert.equal(allowed(PRODUCTION_URL), true, "requests without an Origin header are unchanged");
}));

test("production: untrusted and malformed origins are rejected", () => withNodeEnv("production", () => {
  for (const origin of [
    "https://evil.example",
    "https://joro.pk.evil.example",
    "http://joro.pk",
    "https://joro.pk:8443",
    "null",
    "https://0.0.0.0:3000",
    "http://localhost:3000",
  ]) {
    assert.equal(allowed(PRODUCTION_URL, origin), false, origin);
  }
  assert.throws(() => sameOrigin(request(PRODUCTION_URL, "https://evil.example")), /Cross-origin requests are not allowed\./);
}));

test("development: the local origin is accepted, other origins are not", () => withNodeEnv("development", () => {
  assert.equal(allowed(LOCAL_URL, "http://localhost:3000"), true);
  assert.equal(allowed("http://127.0.0.1:3001/api/upload", "http://127.0.0.1:3001"), true);
  assert.equal(allowed(LOCAL_URL, "http://evil.example"), false);
  assert.equal(allowed(LOCAL_URL, "http://localhost:4000"), false);
}));

/** Multipart request without a file: an allowed request stops at "No file" before any auth, database or disk work. */
async function upload(url: string, folder: string, origin?: string) {
  const form = new FormData();
  form.set("folder", folder);
  const response = await POST(new Request(url, { method: "POST", headers: origin ? { origin } : {}, body: form }) as never);
  if (!response) throw new Error("upload route returned no response");
  return { status: response.status, body: await response.json() };
}

const NO_FILE = { status: 400, body: { error: "No file" } };

test("/api/upload in production: Post a Want photos and category images pass the origin check", () => withNodeEnv("production", async () => {
  for (const folder of ["inrange-wants", "categories-local"]) {
    for (const origin of ["https://joro.pk", "https://www.joro.pk"]) {
      assert.deepEqual(await upload(PRODUCTION_URL, folder, origin), NO_FILE, `${folder} from ${origin}`);
    }
  }
}));

test("/api/upload in production: an untrusted origin is rejected before anything is read", () => withNodeEnv("production", async () => {
  for (const origin of ["https://evil.example", "https://0.0.0.0:3000"]) {
    assert.deepEqual(await upload(PRODUCTION_URL, "inrange-wants", origin), { status: 403, body: { error: "Cross-origin requests are not allowed." } }, origin);
  }
}));

test("/api/upload in development: same-origin localhost uploads still pass the origin check", () => withNodeEnv("development", async () => {
  assert.deepEqual(await upload(LOCAL_URL, "inrange-wants", "http://localhost:3000"), NO_FILE);
  assert.deepEqual(await upload(LOCAL_URL, "categories-local", "http://localhost:3000"), NO_FILE);
  assert.equal((await upload(LOCAL_URL, "inrange-wants", "http://evil.example")).status, 403);
}));
