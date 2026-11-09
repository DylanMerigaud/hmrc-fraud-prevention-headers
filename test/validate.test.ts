import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CONNECTION_METHODS,
  type ConnectionMethod,
  REQUIRED_HEADERS,
  SPEC_VERSION,
} from "../src/spec.js";
import {
  type ValidationIssue,
  type ValidationResult,
  validateFraudPreventionHeaders,
} from "../src/validate.js";
import { SPEC_EXAMPLES } from "./fixtures/spec-examples.js";

const VALID_MESSAGE =
  "All headers required for your connection method have been supplied and all appear to be valid. Validation is based on a single request. We have access to all requests and can draw additional conclusions.";
const EXAMPLE_WARNING = "Value is an example from the specification";

/** A spec example with real-looking public IPs and port, so it draws no warning at all. */
function clean(method: ConnectionMethod): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(SPEC_EXAMPLES[method])) {
    if (v !== undefined) out[k] = v;
  }
  if ("Gov-Client-Public-IP" in out) {
    out["Gov-Client-Public-IP"] = "81.2.69.142";
    out["Gov-Client-Public-Port"] = "51123";
    out["Gov-Vendor-Public-IP"] = "176.30.57.118";
    out["Gov-Vendor-Forwarded"] = "by=176.30.57.118&for=81.2.69.142";
  }
  return out;
}

/** Validates a clean set of `method` with some headers replaced (a value) or removed (undefined). */
function run(
  method: ConnectionMethod,
  overrides: Record<string, string | undefined> = {},
): ValidationResult {
  const headers = clean(method);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete headers[k];
    else headers[k] = v;
  }
  return validateFraudPreventionHeaders(headers);
}

function on(issues: ValidationIssue[] | undefined, header: string): ValidationIssue[] {
  return (issues ?? []).filter((i) => i.headers.includes(header));
}

function only(result: ValidationResult, header: string): ValidationIssue[] {
  assert.equal(result.code, "INVALID_HEADERS");
  const errs = result.errors ?? [];
  assert.ok(errs.length > 0);
  for (const e of errs) assert.deepEqual(e.headers, [header], JSON.stringify(result));
  return errs;
}

function warned(result: ValidationResult, header: string, message: string): void {
  const w = on(result.warnings, header).find((i) => i.message === message);
  assert.ok(w, JSON.stringify(result));
  assert.equal(w.code, "POTENTIALLY_INVALID_HEADER");
}

function err(header: string, message: string, code = "INVALID_HEADER"): ValidationIssue {
  return { code: code as ValidationIssue["code"], message, headers: [header] };
}

test("every spec example has no errors and only example warnings", () => {
  for (const method of CONNECTION_METHODS) {
    const result = validateFraudPreventionHeaders(SPEC_EXAMPLES[method]);
    assert.equal(result.errors, undefined, `${method}: ${JSON.stringify(result.errors)}`);
    for (const w of result.warnings ?? []) {
      assert.equal(w.message, EXAMPLE_WARNING, `${method}: ${JSON.stringify(w)}`);
    }
    for (const h of REQUIRED_HEADERS[method]) assert.ok(SPEC_EXAMPLES[method][h], h);
  }
});

test("every clean set validates as VALID_HEADERS with the verbatim message", () => {
  for (const method of CONNECTION_METHODS) {
    assert.deepEqual(run(method), {
      specVersion: SPEC_VERSION,
      code: "VALID_HEADERS",
      message: VALID_MESSAGE,
    });
  }
});

test("header lookup is case-insensitive", () => {
  const upper: Record<string, string> = {};
  for (const [k, v] of Object.entries(clean("DESKTOP_APP_DIRECT"))) upper[k.toUpperCase()] = v;
  assert.equal(validateFraudPreventionHeaders(upper).code, "VALID_HEADERS");
});

test("multi-valued headers are joined with a comma", () => {
  const headers: Record<string, string | readonly string[]> = clean("DESKTOP_APP_DIRECT");
  headers["Gov-Client-Local-IPs"] = ["fc00%3A%3A", "10.1.2.3"];
  assert.equal(validateFraudPreventionHeaders(headers).code, "VALID_HEADERS");
  headers["Gov-Client-Local-IPs"] = ["fc00%3A%3A", "nope"];
  only(validateFraudPreventionHeaders(headers), "gov-client-local-ips");
});

test("a Headers-like object with forEach is read", () => {
  const map = new Map(Object.entries(clean("WEB_APP_VIA_SERVER")));
  assert.equal(validateFraudPreventionHeaders(map).code, "VALID_HEADERS");
});

test("no gov-* header at all gives the verbatim no-headers result", () => {
  const expected = {
    specVersion: SPEC_VERSION,
    code: "INVALID_HEADERS",
    message:
      "No fraud prevention headers submitted. These are required by law. Check the specification.",
  };
  assert.deepEqual(validateFraudPreventionHeaders({}), expected);
  assert.deepEqual(
    validateFraudPreventionHeaders({ accept: "application/vnd.hmrc.1.0+json" }),
    expected,
  );
});

test("a missing connection method gives MISSING_HEADER and stops", () => {
  const result = run("WEB_APP_VIA_SERVER", { "Gov-Client-Connection-Method": undefined });
  assert.deepEqual(result.errors, [
    err("gov-client-connection-method", "Header required", "MISSING_HEADER"),
  ]);
  assert.equal(result.warnings, undefined);
  assert.equal(result.message, "At least 1 header is invalid");
});

test("an unknown connection method gives INVALID_HEADER and stops", () => {
  const result = run("WEB_APP_VIA_SERVER", { "Gov-Client-Connection-Method": "WEB_APP" });
  assert.equal(result.code, "INVALID_HEADERS");
  assert.equal(result.errors?.length, 1);
  assert.equal(result.errors?.[0]?.code, "INVALID_HEADER");
  assert.deepEqual(result.errors?.[0]?.headers, ["gov-client-connection-method"]);
  assert.equal(result.warnings, undefined);
});

test("an absent required header gives MISSING_HEADER 'Header required'", () => {
  const result = run("OTHER_DIRECT", { "Gov-Client-MAC-Addresses": undefined });
  assert.deepEqual(result.errors, [
    err("gov-client-mac-addresses", "Header required", "MISSING_HEADER"),
  ]);
});

test("an empty required header gives EMPTY_HEADER 'Header value is empty'", () => {
  const result = run("MOBILE_APP_DIRECT", { "Gov-Client-Local-IPs": "" });
  assert.deepEqual(result.errors, [
    err("gov-client-local-ips", "Header value is empty", "EMPTY_HEADER"),
  ]);
});

test("a gov-client or gov-vendor header outside the method gives UNEXPECTED_HEADER", () => {
  const result = run("WEB_APP_VIA_SERVER", {
    "Gov-Client-Local-IPs": "10.1.2.3",
    "Gov-Client-Browser-Plugins": "x",
    "Gov-Client-Browser-Do-Not-Track": "false",
    "X-Other": "1",
  });
  assert.equal(result.code, "POTENTIALLY_INVALID_HEADERS");
  assert.equal(result.errors, undefined);
  assert.equal(result.warnings?.length, 1);
  assert.equal(result.warnings?.[0]?.code, "UNEXPECTED_HEADER");
  assert.deepEqual(result.warnings?.[0]?.headers, ["gov-client-local-ips"]);
});

test("a value outside US-ASCII printable gives INVALID_HEADER", () => {
  const result = run("WEB_APP_VIA_SERVER", { "Gov-Client-User-IDs": "my-application=alicé" });
  assert.deepEqual(only(result, "gov-client-user-ids"), [
    err("gov-client-user-ids", "Value must be US-ASCII, with other characters percent encoded"),
  ]);
  only(run("DESKTOP_APP_DIRECT", { "Gov-Vendor-Version": "a=1\tb" }), "gov-vendor-version");
});

test("placeholder values give INVALID_HEADER", () => {
  for (const p of ["null", "undefined", "Unknown", "N/A", "NONE"]) {
    assert.deepEqual(
      only(run("OTHER_DIRECT", { "Gov-Client-Device-ID": p }), "gov-client-device-id"),
      [err("gov-client-device-id", "Value must not be a placeholder")],
    );
  }
  const kv = run("OTHER_DIRECT", {
    "Gov-Client-User-Agent":
      "os-family=Windows&os-version=10&device-manufacturer=unknown&device-model=XPS13",
  });
  assert.deepEqual(only(kv, "gov-client-user-agent"), [
    err("gov-client-user-agent", "Value must not be a placeholder"),
  ]);
});

test("malformed percent escapes give INVALID_HEADER, never a throw", () => {
  only(
    run("DESKTOP_APP_DIRECT", { "Gov-Client-Local-IPs": "10.1.2.3,fc00%3" }),
    "gov-client-local-ips",
  );
  only(
    run("DESKTOP_APP_DIRECT", { "Gov-Vendor-Product-Name": "Product%2" }),
    "gov-vendor-product-name",
  );
  only(run("DESKTOP_APP_DIRECT", { "Gov-Client-User-IDs": "os=%ZZ" }), "gov-client-user-ids");
});

test("the validator never throws on random values for any header", () => {
  let seed = 7;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const alphabet = "%=&,:.-0123456789abcdefABCDEF xyzé\t";
  for (let n = 0; n < 300; n++) {
    for (const method of CONNECTION_METHODS) {
      const headers: Record<string, string> = clean(method);
      for (const h of REQUIRED_HEADERS[method]) {
        if (rand() < 0.3) {
          let s = "";
          const len = Math.floor(rand() * 20);
          for (let i = 0; i < len; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
          headers[h] = s;
        }
      }
      validateFraudPreventionHeaders(headers);
    }
  }
  assert.equal(validateFraudPreventionHeaders(null as never).code, "INVALID_HEADERS");
  assert.equal(
    validateFraudPreventionHeaders({ "gov-client-timezone": 5 } as never).code,
    "INVALID_HEADERS",
  );
});

test("Device-ID must be a UUID", () => {
  only(
    run("BATCH_PROCESS_DIRECT", { "Gov-Client-Device-ID": "beec798b-b366-47fa-b1f8" }),
    "gov-client-device-id",
  );
  assert.equal(
    run("BATCH_PROCESS_DIRECT", { "Gov-Client-Device-ID": "BEEC798B-B366-47FA-B1F8-92CEDE14A1CE" })
      .code,
    "VALID_HEADERS",
  );
});

test("Local-IPs values must each be an IP address", () => {
  only(
    run("DESKTOP_APP_DIRECT", { "Gov-Client-Local-IPs": "10.1.2.3,localhost" }),
    "gov-client-local-ips",
  );
  only(
    run("DESKTOP_APP_DIRECT", { "Gov-Client-Local-IPs": "10.1.2.3,,10.1.2.4" }),
    "gov-client-local-ips",
  );
  assert.equal(
    run("DESKTOP_APP_DIRECT", { "Gov-Client-Local-IPs": "10.1.2.3,10.3.4.2" }).code,
    "VALID_HEADERS",
  );
});

test("timestamps must be yyyy-MM-ddThh:mm:ss.sssZ and a real date", () => {
  for (const header of ["Gov-Client-Local-IPs-Timestamp", "Gov-Client-Public-IP-Timestamp"]) {
    for (const bad of [
      "2020-09-21T14:30:05Z",
      "2020-09-21 14:30:05.123Z",
      "2020-02-30T14:30:05.123Z",
      "2020-09-21T25:30:05.123Z",
    ]) {
      only(run("DESKTOP_APP_VIA_SERVER", { [header]: bad }), header.toLowerCase());
    }
  }
});

test("MAC addresses must be six octets; all zeros is a warning", () => {
  only(
    run("OTHER_DIRECT", { "Gov-Client-MAC-Addresses": "ea%3A43%3A1a%3A5d%3A21" }),
    "gov-client-mac-addresses",
  );
  assert.equal(
    run("OTHER_DIRECT", { "Gov-Client-MAC-Addresses": "EA-43-1A-5D-21-45" }).code,
    "VALID_HEADERS",
  );
  const zero = run("OTHER_DIRECT", { "Gov-Client-MAC-Addresses": "00%3A00%3A00%3A00%3A00%3A00" });
  assert.equal(zero.code, "POTENTIALLY_INVALID_HEADERS");
  assert.equal(on(zero.warnings, "gov-client-mac-addresses").length, 1);
});

test("Multi-Factor checks type, timestamp and unique-reference", () => {
  const h = "gov-client-multi-factor";
  only(
    run("OTHER_DIRECT", {
      "Gov-Client-Multi-Factor": "type=SMS&timestamp=2021-11-21T13%3A23Z&unique-reference=a",
    }),
    h,
  );
  only(
    run("OTHER_DIRECT", {
      "Gov-Client-Multi-Factor": "type=TOTP&timestamp=2021-11-21%2013%3A23&unique-reference=a",
    }),
    h,
  );
  only(
    run("OTHER_DIRECT", {
      "Gov-Client-Multi-Factor": "type=TOTP&timestamp=2021-11-21T13%3A23Z&unique-reference=",
    }),
    h,
  );
  only(
    run("OTHER_DIRECT", { "Gov-Client-Multi-Factor": "type=TOTP&timestamp=2021-11-21T13%3A23Z" }),
    h,
  );
  for (const ts of ["2021-11-21T13%3A23%3A05Z", "2021-11-21T13%3A23%3A05.123Z"]) {
    assert.equal(
      run("OTHER_DIRECT", {
        "Gov-Client-Multi-Factor": `type=OTHER&timestamp=${ts}&unique-reference=a`,
      }).code,
      "VALID_HEADERS",
    );
  }
});

test("public IPs must be public; documentation ranges are a warning", () => {
  for (const header of ["Gov-Client-Public-IP", "Gov-Vendor-Public-IP"]) {
    const lower = header.toLowerCase();
    for (const bad of ["10.0.0.1", "192.168.1.1", "::1", "not-an-ip"]) {
      const result = run("OTHER_VIA_SERVER", { [header]: bad });
      const errs = on(result.errors, lower).filter((e) => e.code === "INVALID_HEADER");
      assert.deepEqual(errs, [err(lower, "Value must be a public IP address")]);
    }
    const doc = run("OTHER_VIA_SERVER", { [header]: "2001:db8::1" });
    warned(doc, lower, EXAMPLE_WARNING);
  }
  const encoded = run("OTHER_VIA_SERVER", {
    "Gov-Client-Public-IP": "2a00%3A1450%3A4009%3A81f%3A%3A200e",
    "Gov-Vendor-Forwarded": "by=176.30.57.118&for=2a00%3A1450%3A4009%3A81f%3A%3A200e",
  });
  assert.equal(encoded.code, "VALID_HEADERS", JSON.stringify(encoded));
});

test("Public-Port must be 1..65535 and not 80 or 443; 12345 is a warning", () => {
  for (const bad of ["0", "65536", "80", "443", "12a", "-1", "1.5"]) {
    only(run("WEB_APP_VIA_SERVER", { "Gov-Client-Public-Port": bad }), "gov-client-public-port");
  }
  const example = run("WEB_APP_VIA_SERVER", { "Gov-Client-Public-Port": "12345" });
  assert.equal(example.code, "POTENTIALLY_INVALID_HEADERS");
  warned(example, "gov-client-public-port", EXAMPLE_WARNING);
});

test("Screens: missing scaling factor and colour depth give both verbatim errors", () => {
  const result = run("DESKTOP_APP_VIA_SERVER", { "Gov-Client-Screens": "width=1920&height=1080" });
  assert.deepEqual(only(result, "gov-client-screens"), [
    err("gov-client-screens", "At least 1 screen is missing a value for scaling factor"),
    err("gov-client-screens", "At least 1 screen is missing a value for colour depth"),
  ]);
});

test("Screens: width, height, scaling factor and colour depth must be positive numbers", () => {
  const h = "gov-client-screens";
  only(
    run("DESKTOP_APP_DIRECT", {
      "Gov-Client-Screens": "width=0&height=1080&scaling-factor=1&colour-depth=16",
    }),
    h,
  );
  only(
    run("DESKTOP_APP_DIRECT", {
      "Gov-Client-Screens": "width=1920.5&height=1080&scaling-factor=1&colour-depth=16",
    }),
    h,
  );
  only(
    run("DESKTOP_APP_DIRECT", {
      "Gov-Client-Screens": "width=1920&height=1080&scaling-factor=0&colour-depth=16",
    }),
    h,
  );
  only(
    run("DESKTOP_APP_DIRECT", {
      "Gov-Client-Screens": "width=1920&height=1080&scaling-factor=1&colour-depth=1.5",
    }),
    h,
  );
});

test("Timezone must be UTC+hh:mm with the verbatim message", () => {
  for (const bad of ["GMT", "UTC+1:00", "UTC+15:00", "UTC+01:10", "utc+01:00"]) {
    assert.deepEqual(
      only(run("BATCH_PROCESS_DIRECT", { "Gov-Client-Timezone": bad }), "gov-client-timezone"),
      [
        err(
          "gov-client-timezone",
          "Value must be a recognised timezone in UTC format, submitted as UTC±<hh>:<mm>",
        ),
      ],
    );
  }
  for (const ok of ["UTC-01:15", "UTC+05:30", "UTC+14:00", "UTC+05:45"]) {
    assert.equal(run("BATCH_PROCESS_DIRECT", { "Gov-Client-Timezone": ok }).code, "VALID_HEADERS");
  }
});

test("User-Agent needs all four keys non-empty", () => {
  only(
    run("BATCH_PROCESS_DIRECT", {
      "Gov-Client-User-Agent": "os-family=Windows&os-version=10&device-manufacturer=Dell",
    }),
    "gov-client-user-agent",
  );
  only(
    run("BATCH_PROCESS_DIRECT", {
      "Gov-Client-User-Agent":
        "os-family=Windows&os-version=&device-manufacturer=Dell&device-model=XPS13",
    }),
    "gov-client-user-agent",
  );
});

test("Browser-JS-User-Agent percent encoded is a warning", () => {
  const result = run("WEB_APP_VIA_SERVER", {
    "Gov-Client-Browser-JS-User-Agent": "Mozilla/5.0%20(X11;%20Linux%20x86_64)",
  });
  assert.equal(result.code, "POTENTIALLY_INVALID_HEADERS");
  warned(
    result,
    "gov-client-browser-js-user-agent",
    "Value should be the user agent as the browser reports it, not percent encoded",
  );
});

test("User-IDs needs a value; os on a web app is the verbatim warning", () => {
  only(run("DESKTOP_APP_DIRECT", { "Gov-Client-User-IDs": "os=" }), "gov-client-user-ids");
  const web = run("WEB_APP_VIA_SERVER", {
    "Gov-Client-User-IDs": "os=alice&my-application=alice123",
  });
  assert.deepEqual(web, {
    specVersion: SPEC_VERSION,
    code: "POTENTIALLY_INVALID_HEADERS",
    message: "At least 1 header is potentially invalid",
    warnings: [
      {
        code: "POTENTIALLY_INVALID_HEADER",
        message:
          "Check you are using the correct Gov-Client-Connection-Method. Web applications do not usually provide the os field as browsers do not expose this information.",
        headers: ["gov-client-user-ids"],
      },
    ],
  });
  assert.equal(
    run("DESKTOP_APP_DIRECT", { "Gov-Client-User-IDs": "os=alice&my-application=alice123" }).code,
    "VALID_HEADERS",
  );
});

test("Window-Size must be positive whole numbers", () => {
  only(
    run("MOBILE_APP_DIRECT", { "Gov-Client-Window-Size": "width=375" }),
    "gov-client-window-size",
  );
  only(
    run("MOBILE_APP_DIRECT", { "Gov-Client-Window-Size": "width=-375&height=812" }),
    "gov-client-window-size",
  );
});

test("a window larger than every screen is a cross warning", () => {
  const result = run("MOBILE_APP_DIRECT", { "Gov-Client-Window-Size": "width=376&height=812" });
  assert.equal(result.code, "POTENTIALLY_INVALID_HEADERS");
  assert.deepEqual(result.warnings, [
    {
      code: "POTENTIALLY_INVALID_HEADER",
      message: "Window size is larger than every screen in Gov-Client-Screens",
      headers: ["gov-client-window-size", "gov-client-screens"],
    },
  ]);
});

test("Vendor-Forwarded hops need by and for IPs", () => {
  only(
    run("MOBILE_APP_VIA_SERVER", {
      "Gov-Vendor-Forwarded": "by=176.30.57.118&for=81.2.69.142,by=x&for=1.2.3.4",
    }),
    "gov-vendor-forwarded",
  );
  only(
    run("MOBILE_APP_VIA_SERVER", {
      "Gov-Vendor-Forwarded": "by=176.30.57.118&for=81.2.69.142,for=1.2.3.4",
    }),
    "gov-vendor-forwarded",
  );
});

test("Vendor-Forwarded must hold the client and vendor IPs in one hop", () => {
  const result = run("MOBILE_APP_VIA_SERVER", {
    "Gov-Vendor-Forwarded": "by=176.30.57.118&for=81.2.69.143",
  });
  assert.deepEqual(result.errors, [
    {
      code: "INVALID_HEADERS",
      message:
        "At least 1 pair of IPs in Gov-Vendor-Forwarded must include Gov-Client-Public-IP in the 'for' field and Gov-Vendor-Public-IP in the 'by' field. Check all 3 headers are consistent.",
      headers: ["gov-vendor-forwarded", "gov-vendor-public-ip", "gov-client-public-ip"],
    },
  ]);
  const mapped = run("MOBILE_APP_VIA_SERVER", {
    "Gov-Client-Public-IP": "2A00:1450:4009:81F::200E",
    "Gov-Vendor-Forwarded":
      "by=176.30.57.118&for=2a00%3A1450%3A4009%3A81f%3A%3A200e,by=5.6.7.8&for=176.30.57.118",
  });
  assert.equal(mapped.code, "VALID_HEADERS", JSON.stringify(mapped));
});

test("License-IDs needs values; an unhashed value is a warning", () => {
  only(
    run("OTHER_DIRECT", { "Gov-Vendor-License-IDs": "my-licensed-software=" }),
    "gov-vendor-license-ids",
  );
  const plain = run("OTHER_DIRECT", { "Gov-Vendor-License-IDs": "my-licensed-software=ABC-123" });
  assert.equal(plain.code, "POTENTIALLY_INVALID_HEADERS");
  warned(plain, "gov-vendor-license-ids", "License value does not look hashed");
  assert.equal(
    run("OTHER_DIRECT", { "Gov-Vendor-License-IDs": "my%20licensed%20software=c672b8d1ef56ed28" })
      .code,
    "VALID_HEADERS",
  );
});

test("Product-Name must already be percent encoded", () => {
  assert.deepEqual(
    only(
      run("OTHER_DIRECT", { "Gov-Vendor-Product-Name": "Product Name" }),
      "gov-vendor-product-name",
    ),
    [err("gov-vendor-product-name", "Value must be percent encoded")],
  );
});

test("Vendor-Version needs a pair; via-server non-web methods need two", () => {
  only(run("OTHER_DIRECT", { "Gov-Vendor-Version": "=" }), "gov-vendor-version");
  const message =
    "For client server architectures, submit a version for the client and the server. For all other architectures, submit at least 1 version.";
  for (const method of [
    "DESKTOP_APP_VIA_SERVER",
    "MOBILE_APP_VIA_SERVER",
    "OTHER_VIA_SERVER",
  ] as const) {
    const result = run(method, { "Gov-Vendor-Version": "my-app=2.2.2" });
    assert.equal(result.code, "POTENTIALLY_INVALID_HEADERS");
    warned(result, "gov-vendor-version", message);
  }
  assert.equal(
    run("WEB_APP_VIA_SERVER", { "Gov-Vendor-Version": "my-web-app=2.2.2" }).code,
    "VALID_HEADERS",
  );
});

test("an error and a warning on the same header coexist; errors win the overall code", () => {
  const result = run("WEB_APP_VIA_SERVER", {
    "Gov-Client-User-IDs": "os=alice&my-application=null",
  });
  assert.equal(result.code, "INVALID_HEADERS");
  assert.equal(result.message, "At least 1 header is invalid");
  assert.equal(on(result.errors, "gov-client-user-ids").length, 1);
  assert.equal(on(result.warnings, "gov-client-user-ids").length, 1);
});

test("Forwarded cross check matches IPv6 addresses written differently", () => {
  const headers = { ...SPEC_EXAMPLES.WEB_APP_VIA_SERVER };
  headers["Gov-Client-Public-IP"] = "2a00:1450:4009:081f:0000:0000:0000:200e";
  headers["Gov-Vendor-Forwarded"] = "by=203.0.113.6&for=2a00%3A1450%3A4009%3A81f%3A%3A200e";
  const result = validateFraudPreventionHeaders(headers as Record<string, string>);
  assert.ok(!(result.errors ?? []).some((e) => e.code === "INVALID_HEADERS"));
});
