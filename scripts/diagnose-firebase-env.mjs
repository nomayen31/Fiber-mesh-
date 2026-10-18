/**
 * Diagnose the *shape* of the Firebase Admin credential as it actually arrives
 * from the deployment environment. Prints NO secret material: only lengths,
 * booleans and key names.
 *
 *   node scripts/diagnose-firebase-env.mjs <dotenv-file>
 */

import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/diagnose-firebase-env.mjs <dotenv-file>");
  process.exit(2);
}

const raw = readFileSync(file, "utf8");

/** Minimal dotenv reader that keeps multi-line quoted values intact. */
function readValue(text, key) {
  const line = text
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));
  if (!line) return undefined;
  let value = line.slice(key.length + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

const blob = readValue(raw, "FIREBASE_SERVICE_ACCOUNT_JSON");

console.log("FIREBASE_SERVICE_ACCOUNT_JSON present :", Boolean(blob));
if (!blob) {
  console.log("→ no blob; the discrete FIREBASE_* trio is the fallback path.");
  process.exit(0);
}

const trimmed = blob.trim();
console.log("length                              :", trimmed.length);
console.log("starts with '{'                     :", trimmed.startsWith("{"));
console.log("contains a literal backslash-n     :", trimmed.includes("\\n"));
console.log("contains a real newline             :", trimmed.includes("\n"));
console.log("looks like base64 charset           :", /^[A-Za-z0-9+/=_-]+$/.test(trimmed));

let text = trimmed;
let decodeMode = "raw";
if (!trimmed.startsWith("{")) {
  decodeMode = "base64";
  try {
    text = Buffer.from(trimmed, "base64").toString("utf8");
  } catch (error) {
    console.log("base64 decode                       : FAILED", String(error));
    process.exit(0);
  }
}
console.log("decode mode                         :", decodeMode);
console.log("decoded starts with '{'             :", text.trim().startsWith("{"));
console.log("decoded length                      :", text.length);

let parsed;
try {
  parsed = JSON.parse(text.trim());
} catch (error) {
  console.log("JSON.parse                          : FAILED");
  console.log("  reason                            :", String(error.message).slice(0, 120));
  console.log("  first 1 char of decoded           :", JSON.stringify(text.trim().slice(0, 1)));
  console.log("  last 1 char of decoded            :", JSON.stringify(text.trim().slice(-1)));
  process.exit(0);
}

console.log("JSON.parse                          : OK");
console.log("top-level keys                      :", Object.keys(parsed).sort().join(", "));
for (const key of ["type", "project_id", "client_email", "private_key_id"]) {
  console.log(
    `${key.padEnd(35)}:`,
    parsed[key] === undefined ? "MISSING" : `present (${String(parsed[key]).length} chars)`,
  );
}
const key = parsed.private_key;
console.log(
  "private_key present                 :",
  typeof key === "string" && key.length > 0,
);
if (typeof key === "string") {
  console.log("private_key length                  :", key.length);
  console.log("private_key has literal \\n         :", key.includes("\\n"));
  console.log("private_key has real newlines       :", key.includes("\n"));
  console.log(
    "private_key PEM header              :",
    key.trimStart().startsWith("-----BEGIN PRIVATE KEY-----"),
  );
}
console.log(
  "client_email domain looks valid     :",
  typeof parsed.client_email === "string" &&
    /@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(parsed.client_email.trim()),
);
