import { strict as assert } from "node:assert";
import { test } from "node:test";
import { SPEC_VERSION } from "../src/spec.js";
import { validateFraudPreventionHeaders } from "../src/validate.js";
import { SPEC_EXAMPLES } from "./fixtures/spec-examples.js";

// Replays every HMRC Test API response published in docs/SPEC.md sections 6.1 and 6.2.

const OS_WARNING =
  "Check you are using the correct Gov-Client-Connection-Method. Web applications do not usually provide the os field as browsers do not expose this information.";

/** A WEB_APP_VIA_SERVER set with non-example IPs and port, so nothing but the case under test fires. */
function web(): Record<string, string> {
  return {
    ...(SPEC_EXAMPLES.WEB_APP_VIA_SERVER as Record<string, string>),
    "Gov-Client-Public-IP": "81.2.69.142",
    "Gov-Client-Public-Port": "51123",
    "Gov-Vendor-Public-IP": "176.30.57.118",
    "Gov-Vendor-Forwarded": "by=176.30.57.118&for=81.2.69.142",
  };
}

test("6.1 no headers", () => {
  assert.deepEqual(validateFraudPreventionHeaders({}), {
    specVersion: SPEC_VERSION,
    code: "INVALID_HEADERS",
    message:
      "No fraud prevention headers submitted. These are required by law. Check the specification.",
  });
});

test("6.1 all valid", () => {
  assert.deepEqual(validateFraudPreventionHeaders(web()), {
    specVersion: SPEC_VERSION,
    code: "VALID_HEADERS",
    message:
      "All headers required for your connection method have been supplied and all appear to be valid. Validation is based on a single request. We have access to all requests and can draw additional conclusions.",
  });
});

test("6.1 advisories only", () => {
  const headers = web();
  headers["Gov-Client-User-IDs"] = "os=alice&my-application=alice123";
  assert.deepEqual(validateFraudPreventionHeaders(headers), {
    specVersion: SPEC_VERSION,
    code: "POTENTIALLY_INVALID_HEADERS",
    message: "At least 1 header is potentially invalid",
    warnings: [
      { code: "POTENTIALLY_INVALID_HEADER", message: OS_WARNING, headers: ["gov-client-user-ids"] },
    ],
  });
});

test("6.1 invalid", () => {
  const headers: Record<string, string | undefined> = { ...SPEC_EXAMPLES.WEB_APP_VIA_SERVER };
  headers["Gov-Client-Timezone"] = "GMT";
  headers["Gov-Vendor-Version"] = undefined; // an undefined value counts as absent
  headers["Gov-Vendor-Forwarded"] = "by=203.0.113.6&for=198.51.100.1";
  headers["Gov-Client-User-IDs"] = "os=alice&my-application=alice123";
  const result = validateFraudPreventionHeaders(headers);
  assert.equal(result.specVersion, SPEC_VERSION);
  assert.equal(result.code, "INVALID_HEADERS");
  assert.equal(result.message, "At least 1 header is invalid");
  assert.deepEqual(result.errors, [
    {
      code: "INVALID_HEADER",
      message: "Value must be a recognised timezone in UTC format, submitted as UTC±<hh>:<mm>",
      headers: ["gov-client-timezone"],
    },
    { code: "MISSING_HEADER", message: "Header required", headers: ["gov-vendor-version"] },
    {
      code: "INVALID_HEADERS",
      message:
        "At least 1 pair of IPs in Gov-Vendor-Forwarded must include Gov-Client-Public-IP in the 'for' field and Gov-Vendor-Public-IP in the 'by' field. Check all 3 headers are consistent.",
      headers: ["gov-vendor-forwarded", "gov-vendor-public-ip", "gov-client-public-ip"],
    },
  ]);
  assert.ok(
    result.warnings?.some(
      (w) =>
        w.code === "POTENTIALLY_INVALID_HEADER" &&
        w.message === OS_WARNING &&
        w.headers.length === 1 &&
        w.headers[0] === "gov-client-user-ids",
    ),
  );
});

test("6.2 validation feedback on DESKTOP_APP_VIA_SERVER", () => {
  const headers: Record<string, string | undefined> = {
    ...SPEC_EXAMPLES.DESKTOP_APP_VIA_SERVER,
    "Gov-Client-Multi-Factor":
      "type=AUTH_CODE&timestamp=2017-04-21T13%3A23Z&unique-reference=c672b8d1ef56ed28,type=TOTP&timestamp=2017-05-19T13%3A10Z&unique-reference=ac73430ffdfd9",
    "Gov-Client-User-IDs": "os=user123",
    "Gov-Client-Screens": "width=1920&height=1080",
    "Gov-Vendor-Version": "my-desktop-app=2.2.2",
  };
  headers["Gov-Client-MAC-Addresses"] = undefined;
  const result = validateFraudPreventionHeaders(headers);
  assert.equal(result.code, "INVALID_HEADERS");

  const byHeader = (name: string) => ({
    errors: (result.errors ?? []).filter((i) => i.headers.includes(name)),
    warnings: (result.warnings ?? []).filter((i) => i.headers.includes(name)),
  });

  // gov-client-connection-method: VALID_HEADER
  assert.deepEqual(byHeader("gov-client-connection-method"), { errors: [], warnings: [] });
  // gov-client-mac-addresses: MISSING_HEADER ["Header required"]
  assert.deepEqual(byHeader("gov-client-mac-addresses"), {
    errors: [
      { code: "MISSING_HEADER", message: "Header required", headers: ["gov-client-mac-addresses"] },
    ],
    warnings: [],
  });
  // gov-client-screens: INVALID_HEADER with both messages
  assert.deepEqual(byHeader("gov-client-screens"), {
    errors: [
      {
        code: "INVALID_HEADER",
        message: "At least 1 screen is missing a value for scaling factor",
        headers: ["gov-client-screens"],
      },
      {
        code: "INVALID_HEADER",
        message: "At least 1 screen is missing a value for colour depth",
        headers: ["gov-client-screens"],
      },
    ],
    warnings: [],
  });
  // gov-vendor-version: POTENTIALLY_INVALID_HEADER
  assert.deepEqual(byHeader("gov-vendor-version"), {
    errors: [],
    warnings: [
      {
        code: "POTENTIALLY_INVALID_HEADER",
        message:
          "For client server architectures, submit a version for the client and the server. For all other architectures, submit at least 1 version.",
        headers: ["gov-vendor-version"],
      },
    ],
  });
  // the example's short multi-factor hashes and os user id are accepted
  assert.deepEqual(byHeader("gov-client-multi-factor"), { errors: [], warnings: [] });
  assert.deepEqual(byHeader("gov-client-user-ids"), { errors: [], warnings: [] });
  // crossValidation: VALID_HEADERS
  assert.ok(!(result.errors ?? []).some((i) => i.code === "INVALID_HEADERS"));
  // nothing else is an error
  assert.equal(result.errors?.length, 3);
});
