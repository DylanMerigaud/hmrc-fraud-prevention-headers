/** Raised when a header value cannot be encoded or decoded under HMRC's data structure rules. */
export class FraudHeaderFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FraudHeaderFormatError";
  }
}

/** Key-value pairs as an object or as an ordered array of tuples. */
export type Pairs =
  | Record<string, string | number>
  | ReadonlyArray<readonly [string, string | number]>;

const HEX = "0123456789ABCDEF";
const encoder = new TextEncoder();

function isUnreserved(byte: number): boolean {
  return (
    (byte >= 0x41 && byte <= 0x5a) ||
    (byte >= 0x61 && byte <= 0x7a) ||
    (byte >= 0x30 && byte <= 0x39) ||
    byte === 0x2d ||
    byte === 0x2e ||
    byte === 0x5f ||
    byte === 0x7e
  );
}

/**
 * Percent-encodes a string as UTF-8, keeping only the RFC 3986 unreserved set
 * (A-Z a-z 0-9 - . _ ~) and using uppercase hex.
 */
export function percentEncode(value: string): string {
  let out = "";
  for (const byte of encoder.encode(value)) {
    out += isUnreserved(byte) ? String.fromCharCode(byte) : `%${HEX[byte >> 4]}${HEX[byte & 15]}`;
  }
  return out;
}

/** Decodes a percent-encoded UTF-8 string. Throws {@link FraudHeaderFormatError} on a malformed escape. */
export function percentDecode(value: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const ch = value.charAt(i);
    if (ch === "%") {
      const hex = value.slice(i + 1, i + 3);
      if (!/^[0-9A-Fa-f]{2}$/.test(hex)) {
        throw new FraudHeaderFormatError(`malformed percent escape at position ${i}`);
      }
      bytes.push(Number.parseInt(hex, 16));
      i += 2;
    } else {
      const code = value.codePointAt(i) as number;
      if (code > 0xffff) i++;
      bytes.push(...encoder.encode(String.fromCodePoint(code)));
    }
  }
  // No `fatal` option: runtimes built without ICU reject it. Invalid sequences decode to
  // U+FFFD instead, so a decode that does not re-encode to the same bytes was not UTF-8.
  const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(new Uint8Array(bytes));
  const again = encoder.encode(text);
  if (again.length !== bytes.length || again.some((b, i) => b !== bytes[i])) {
    throw new FraudHeaderFormatError("percent escapes do not form valid UTF-8");
  }
  return text;
}

function entries(pairs: Pairs): ReadonlyArray<readonly [string, string | number]> {
  return Array.isArray(pairs)
    ? (pairs as ReadonlyArray<readonly [string, string | number]>)
    : Object.entries(pairs as Record<string, string | number>);
}

/** Encodes pairs as `key=value&key=value`, percent-encoding every key and value but not the separators. */
export function encodeKeyValue(pairs: Pairs): string {
  return entries(pairs)
    .map(([k, v]) => `${percentEncode(String(k))}=${percentEncode(String(v))}`)
    .join("&");
}

/** Encodes values as a comma-separated list, each percent-encoded. Empty values are rejected. */
export function encodeList(values: readonly string[]): string {
  return values
    .map((v) => {
      if (v === "") throw new FraudHeaderFormatError("list values must not be empty");
      return percentEncode(v);
    })
    .join(",");
}

/** Encodes several key-value structures joined by commas. */
export function encodeKeyValueList(structs: readonly Pairs[]): string {
  return structs.map(encodeKeyValue).join(",");
}

/** Decodes `k=v&k=v` into ordered tuples. An empty string gives an empty array. */
export function decodeKeyValue(value: string): Array<[string, string]> {
  if (value === "") return [];
  return value.split("&").map((part): [string, string] => {
    const eq = part.indexOf("=");
    if (eq < 0) return [percentDecode(part), ""];
    return [percentDecode(part.slice(0, eq)), percentDecode(part.slice(eq + 1))];
  });
}

/** Decodes a comma-separated list of percent-encoded values. An empty string gives an empty array. */
export function decodeList(value: string): string[] {
  if (value === "") return [];
  return value.split(",").map(percentDecode);
}

/** Decodes comma-joined key-value structures. An empty string gives an empty array. */
export function decodeKeyValueList(value: string): Array<Array<[string, string]>> {
  if (value === "") return [];
  return value.split(",").map(decodeKeyValue);
}
