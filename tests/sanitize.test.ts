/**
 * Tests for the credential scrubber.
 *
 * Every "secret" below is a fabricated, non-functional string. The point is the
 * shape, not the value: if a real key of that shape ever reaches a logger,
 * `safeErrorText` must have removed it before the line was written.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAX_SAFE_LENGTH, redact, safeErrorText } from "@/lib/sanitize";

/** A PEM block with a junk body — never a usable key. */
const FAKE_PEM = [
  "-----BEGIN PRIVATE KEY-----",
  "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj",
  "MzEfYyjiWA4R4/M2bS1GB4t7NXp98C3SC6dVMvDuictGeurT8jNbBqJv1h2g4vXK",
  "-----END PRIVATE KEY-----",
].join("\n");

describe("redact", () => {
  it("removes a private key block entirely", () => {
    const out = redact(`failed to load credential ${FAKE_PEM} for project`);
    assert.equal(out.includes("BEGIN PRIVATE KEY"), false);
    assert.equal(out.includes("MIIEvQIBADANBgkqhkiG9w0BAQEF"), false);
    assert.equal(out.includes("[redacted private key]"), true);
    // Surrounding text survives, so the log line is still useful.
    assert.equal(out.includes("failed to load credential"), true);
    assert.equal(out.includes("for project"), true);
  });

  it("removes a JSON private_key field", () => {
    const out = redact(
      '{"project_id":"fiber-mesh","private_key":"-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n"}',
    );
    assert.equal(out.includes("abc"), false);
    assert.equal(out.includes('"private_key":"[redacted]"'), true);
  });

  it("removes a JWT", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.c2lnbmF0dXJl";
    const out = redact(`cookie fm_admin_session=${jwt}`);
    assert.equal(out.includes(jwt), false);
    assert.equal(out.includes("[redacted jwt]"), true);
  });

  it("removes a bearer credential", () => {
    const out = redact("Authorization: Bearer abc123def456ghi789");
    assert.equal(out.includes("abc123def456ghi789"), false);
    assert.equal(out.includes("Bearer [redacted]"), true);
  });

  it("removes a Firebase web API key", () => {
    const out = redact("key=AIzaSyChNkbAbcdefghijklmnopqrstuvwxyz012345");
    assert.equal(out.includes("AIzaSyChNkbAbcdefghijklmnopqrstuvwxyz012345"), false);
    assert.equal(out.includes("[redacted api key]"), true);
  });

  it("removes a database URL with an embedded password", () => {
    const out = redact(
      "connect failed postgresql://neondb_owner:sup3rs3cret@ep-cool-name-1.aws.neon.tech/neondb",
    );
    assert.equal(out.includes("sup3rs3cret"), false);
    assert.equal(out.includes("postgresql://[redacted]"), true);
  });

  it("removes a long base64 run, such as a service-account blob or FCM token", () => {
    const blob = "A".repeat(220);
    const out = redact(`token=${blob}`);
    assert.equal(out.includes(blob), false);
    assert.equal(out.includes("[redacted blob]"), true);
  });

  it("leaves ordinary Bengali and English text alone", () => {
    const text = "নতুন অর্ডার FM-20261018-0001 গ্রাহক ফেনী থেকে অর্ডার করেছেন";
    assert.equal(redact(text), text);
    assert.equal(redact("PrismaClientKnownRequestError: not found"), "PrismaClientKnownRequestError: not found");
  });
});

describe("safeErrorText", () => {
  it("keeps the error name and message, so the failure is still diagnosable", () => {
    const text = safeErrorText(new Error("connection refused"));
    assert.equal(text.includes("Error"), true);
    assert.equal(text.includes("connection refused"), true);
  });

  it("scrubs a secret that travelled inside an error message", () => {
    const text = safeErrorText(new Error(`bad credential: ${FAKE_PEM}`));
    assert.equal(text.includes("BEGIN PRIVATE KEY"), false);
    assert.equal(text.includes("MIIEvQIBADANBgkqhkiG9w0BAQEF"), false);
  });

  it("collapses newlines, so one failure stays on one log line", () => {
    assert.equal(safeErrorText(new Error("line one\nline two\tline three")), "Error: line one line two line three");
  });

  it("clamps the length, without mistaking non-credential text for a blob", () => {
    const text = safeErrorText(new Error("ক".repeat(5000)));
    assert.equal(text.length, MAX_SAFE_LENGTH);
    assert.equal(text.startsWith("Error: ক"), true);
  });

  it("accepts a thrown string, and never returns undefined for junk", () => {
    assert.equal(safeErrorText("plain failure"), "plain failure");
    assert.equal(safeErrorText(undefined), "unknown error");
    assert.equal(safeErrorText({ weird: true }), "unknown error");
    assert.equal(safeErrorText(null), "unknown error");
  });

  it("never leaks a token that a Prisma error might quote", () => {
    const text = safeErrorText(
      new Error(
        'Invalid `prisma.deviceToken.create()` invocation: token: "eUx4aG1vY2tfZmFrZV90b2tlbl92YWx1ZV90aGF0X2lzX2xvbmdfZW5vdWdoX3RvX3RyaXBfdGhlX2Jhc2U2NF9ydWxlX2FuZF9nZXRfcmVkYWN0ZWRfY29tcGxldGVseQ"',
      ),
    );
    assert.equal(text.includes("eUx4aG1vY2tfZmFrZV90b2tl"), false);
    assert.equal(text.includes("[redacted blob]"), true);
  });
});
