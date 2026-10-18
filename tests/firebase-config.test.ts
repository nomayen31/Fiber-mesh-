/**
 * Tests for the Firebase Admin credential reader.
 *
 * This is the regression suite for the bug that kept push disabled in
 * production: the reader expected `projectId` / `clientEmail` / `privateKey`,
 * but a real service-account file uses `project_id` / `client_email` /
 * `private_key`. Every test below uses a **locally generated throwaway key** —
 * no real credential is read, written or logged.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

import {
  decodeServiceAccountBlob,
  getPushMessaging,
  isPushConfigured,
  parseServiceAccountJson,
  pushConfigIssue,
} from "@/lib/notifications/firebase-admin";

/** A freshly generated RSA key — valid PEM, worthless, never leaves this test. */
function throwawayPem(): string {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  }).privateKey;
}

/** Exactly the shape Google's "Generate new private key" downloads. */
function googleServiceAccountFile(privateKey: string) {
  return {
    type: "service_account",
    project_id: "fiber-mesh-test",
    private_key_id: "0000000000000000000000000000000000000000",
    private_key: privateKey,
    client_email: "lead-notify@fiber-mesh-test.iam.gserviceaccount.com",
    client_id: "000000000000000000000",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url:
      "https://www.googleapis.com/robot/v1/metadata/x509/lead-notify%40fiber-mesh-test.iam.gserviceaccount.com",
    universe_domain: "googleapis.com",
  };
}

/* ─────────────────── the regression that mattered ─────────────────── */

describe("service-account parsing", () => {
  it("accepts the snake_case file Google actually produces", () => {
    const parts = parseServiceAccountJson(
      JSON.stringify(googleServiceAccountFile(throwawayPem())),
    );
    assert.equal(parts.projectId, "fiber-mesh-test");
    assert.equal(
      parts.clientEmail,
      "lead-notify@fiber-mesh-test.iam.gserviceaccount.com",
    );
    assert.match(parts.privateKey, /-----BEGIN PRIVATE KEY-----/);
  });

  it("still accepts the camelCase spelling an older config may use", () => {
    const parts = parseServiceAccountJson(
      JSON.stringify({
        projectId: "fiber-mesh-test",
        clientEmail: "lead-notify@fiber-mesh-test.iam.gserviceaccount.com",
        privateKey: throwawayPem(),
      }),
    );
    assert.equal(parts.projectId, "fiber-mesh-test");
    assert.match(parts.privateKey, /-----BEGIN PRIVATE KEY-----/);
  });

  it("turns the escaped \\n spelling of a private key into real newlines", () => {
    const pem = throwawayPem();
    const file = googleServiceAccountFile(pem.replace(/\n/g, "\\n"));
    const text = JSON.stringify(file);
    assert.ok(text.includes("\\n"), "the fixture should carry an escaped newline");

    const parts = parseServiceAccountJson(text);
    assert.equal(parts.privateKey.includes("\\n"), false);
    // A PEM's trailing newline is insignificant; compare on the trimmed form.
    assert.equal(parts.privateKey.trim(), pem.trim());
  });

  it("passes real newlines through untouched", () => {
    const pem = throwawayPem();
    const parts = parseServiceAccountJson(
      JSON.stringify(googleServiceAccountFile(pem)),
    );
    assert.equal(parts.privateKey.includes("\\n"), false);
    assert.equal(parts.privateKey.trim(), pem.trim());
  });
});

/* ──────────────────────── error reporting ──────────────────────── */

describe("service-account parsing — failures stay sanitized", () => {
  it("names the missing fields and nothing else", () => {
    try {
      parseServiceAccountJson(JSON.stringify({ project_id: "x" }));
      assert.fail("expected a throw");
    } catch (error) {
      const issue = error as { code?: string; detail?: string; message?: string };
      assert.equal(issue.code, "missing-fields");
      assert.match(issue.detail ?? "", /client_email/);
      assert.match(issue.detail ?? "", /private_key/);
      assert.equal(issue.detail?.includes("project_id"), false);
      assert.equal(issue.message?.includes("-----BEGIN"), false);
    }
  });

  it("reports unparseable JSON without echoing the payload", () => {
    const secretLookingValue = "super-secret-value-that-must-not-be-echoed";
    try {
      parseServiceAccountJson(`{ "project_id": ${secretLookingValue}`);
      assert.fail("expected a throw");
    } catch (error) {
      const issue = error as { code?: string; detail?: string; message?: string };
      assert.equal(issue.code, "invalid-json");
      assert.equal(issue.message?.includes(secretLookingValue), false);
      assert.equal(issue.detail?.includes(secretLookingValue), false);
    }
  });

  it("rejects a private_key that is not a PEM block", () => {
    try {
      parseServiceAccountJson(
        JSON.stringify({
          project_id: "p",
          client_email: "a@b.iam.gserviceaccount.com",
          private_key: "not-a-pem",
        }),
      );
      assert.fail("expected a throw");
    } catch (error) {
      const issue = error as { code?: string; detail?: string };
      assert.equal(issue.code, "invalid-private-key");
      assert.equal(issue.detail?.includes("not-a-pem"), false);
    }
  });
});

/* ───────────────────────── blob decoding ───────────────────────── */

describe("service-account blob decoding", () => {
  it("accepts raw JSON", () => {
    const text = JSON.stringify(googleServiceAccountFile(throwawayPem()));
    assert.equal(decodeServiceAccountBlob(text), text);
  });

  it("accepts base64-encoded JSON (the recommended, newline-proof form)", () => {
    const text = JSON.stringify(googleServiceAccountFile(throwawayPem()));
    const encoded = Buffer.from(text, "utf8").toString("base64");
    assert.equal(decodeServiceAccountBlob(encoded), text);
  });

  it("tolerates surrounding whitespace and a trailing newline", () => {
    const text = JSON.stringify(googleServiceAccountFile(throwawayPem()));
    const encoded = `  ${Buffer.from(text, "utf8").toString("base64")}\n`;
    assert.equal(decodeServiceAccountBlob(encoded), text);
  });  it("refuses a value that is neither JSON nor base64 JSON", () => {
    for (const bad of ["[SENSITIVE]", "hunter2", "", "  "]) {
      assert.throws(() => decodeServiceAccountBlob(bad), /invalid-json/);
    }
  });
});

/* ──────────────── the Admin SDK must actually accept it ──────────────── */

describe("the parsed credential is usable by the Admin SDK", () => {
  it("initialises Messaging from a parsed service-account file", async () => {
    const parts = parseServiceAccountJson(
      JSON.stringify(googleServiceAccountFile(throwawayPem())),
    );

    const app = initializeApp({ credential: cert(parts) }, `verify-${Date.now()}`);
    try {
      // `getMessaging` constructing successfully is the contract that matters:
      // that is exactly what `getPushMessaging()` does at startup.
      assert.ok(getMessaging(app));
    } finally {
      await deleteApp(app);
    }
  });

  it("initialises Messaging from a base64 blob with escaped newlines", async () => {
    const pem = throwawayPem().replace(/\n/g, "\\n");
    const text = JSON.stringify(googleServiceAccountFile(pem));
    const parts = parseServiceAccountJson(
      decodeServiceAccountBlob(Buffer.from(text, "utf8").toString("base64")),
    );

    const app = initializeApp({ credential: cert(parts) }, `verify-b64-${Date.now()}`);
    try {
      assert.ok(getMessaging(app));
    } finally {
      await deleteApp(app);
    }
  });
});

/* ───────────── the end-to-end config check that was failing ───────────── */

/**
 * Left last on purpose: `getPushMessaging()` caches its result for the lifetime
 * of the process, and this is the only block that lets it initialise.
 *
 * This is the direct regression test for production: with a genuine
 * service-account file in the environment — snake_case keys, exactly as Google
 * writes them — push must report as *configured*, which it never did before.
 */
describe("isPushConfigured with a genuine service-account file", () => {
  it("reports configured and gives no issue for a well-formed blob", () => {
    const text = JSON.stringify(googleServiceAccountFile(throwawayPem()));
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = Buffer.from(
      text,
      "utf8",
    ).toString("base64");

    try {
      assert.equal(isPushConfigured(), true);
      assert.equal(pushConfigIssue(), null);
      assert.ok(getPushMessaging());
    } finally {
      delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    }
  });
});
