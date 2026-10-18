/**
 * The diagnostic half of the Firebase Admin config reader, in its own file so
 * it gets its own process: `getPushMessaging()` caches its result, so a process
 * can only ever observe one configuration state.
 *
 * This is what an administrator now sees when the credential is *set* but
 * unusable — the state production was unknowingly in.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// The module is imported normally: it reads the environment lazily, inside the
// first `getPushMessaging()` call, so assigning here is early enough.
import {
  isPushConfigured,
  missingPushEnvKeys,
  pushConfigIssue,
} from "@/lib/notifications/firebase-admin";

process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
  type: "service_account",
  project_id: "fiber-mesh",
  client_email: "lead-notify@fiber-mesh.iam.gserviceaccount.com",
  private_key_id: "0000000000000000000000000000000000000000",
  // private_key deliberately absent — the exact failure production hit.
});

describe("a set-but-unusable credential is explained, not hidden", () => {
  it("reports push as not configured", () => {
    assert.equal(isPushConfigured(), false);
  });

  it("does not claim a variable is missing when it is present", () => {
    // The variable is set, so the "missing variables" list is empty — which is
    // precisely why `missingServerKeys` alone was misleading in production.
    assert.deepEqual(missingPushEnvKeys(), []);
  });

  it("names the offending field and nothing else", () => {
    const issue = pushConfigIssue();
    assert.notEqual(issue, null);
    assert.equal(issue?.code, "missing-fields");
    assert.match(issue?.detail ?? "", /private_key/);
    // No credential material, and no value of the blob variable, leaks through.
    assert.equal(JSON.stringify(issue).includes("service_account"), false);
    assert.equal(JSON.stringify(issue).includes("fiber-mesh.iam"), false);
  });
});
