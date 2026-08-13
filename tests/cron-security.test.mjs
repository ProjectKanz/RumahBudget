import assert from "node:assert/strict";
import test from "node:test";

import {
  isAuthorizedCronRequest,
  prepareCronResultsForResponse,
} from "../src/lib/cron-security.ts";

function request(headers = {}) {
  return new Request("https://rumahbudget.test/api/cron/send-scheduled-reports", {
    headers,
  });
}

test("cron authorization fails closed when CRON_SECRET is missing or blank", () => {
  assert.equal(isAuthorizedCronRequest(request(), undefined), false);
  assert.equal(isAuthorizedCronRequest(request(), ""), false);
  assert.equal(
    isAuthorizedCronRequest(
      request({ authorization: "Bearer secret" }),
      "   ",
    ),
    false,
  );
});

test("cron authorization rejects the former x-vercel-cron fallback", () => {
  assert.equal(
    isAuthorizedCronRequest(request({ "x-vercel-cron": "1" }), "secret"),
    false,
  );
});

test("cron authorization requires an exact Authorization bearer value", () => {
  assert.equal(
    isAuthorizedCronRequest(
      request({ authorization: "Bearer wrong" }),
      "secret",
    ),
    false,
  );
  assert.equal(
    isAuthorizedCronRequest(
      request({ authorization: "Bearer  secret" }),
      "secret",
    ),
    false,
  );
  assert.equal(
    isAuthorizedCronRequest(
      request({ authorization: "Bearer secret extra" }),
      "secret",
    ),
    false,
  );
  assert.equal(
    isAuthorizedCronRequest(
      request({ authorization: "bearer secret" }),
      "secret",
    ),
    false,
  );
  assert.equal(
    isAuthorizedCronRequest(
      request({ authorization: "Bearer secret" }),
      "secret",
    ),
    true,
  );
});

test("production cron responses redact user IDs", () => {
  const results = [
    {
      userId: "private-user-id",
      status: "success",
      reportType: "weekly",
    },
  ];

  assert.deepEqual(prepareCronResultsForResponse(results, true), [
    { status: "success", reportType: "weekly" },
  ]);
  assert.deepEqual(prepareCronResultsForResponse(results, false), results);
});
