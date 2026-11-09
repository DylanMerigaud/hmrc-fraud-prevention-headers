function parseIpv4(value: string): number[] | undefined {
  const parts = value.split(".");
  if (parts.length !== 4) return undefined;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^(0|[1-9][0-9]{0,2})$/.test(p)) return undefined;
    const n = Number(p);
    if (n > 255) return undefined;
    out.push(n);
  }
  return out;
}

/** Parses an IPv6 address into 8 groups of 16 bits, or undefined when invalid. */
function parseIpv6(value: string): number[] | undefined {
  if (value === "" || value.includes("%")) return undefined;
  const halves = value.split("::");
  if (halves.length > 2) return undefined;
  // an IPv4 tail may only end the whole address: the tail half, or the only half
  const toGroups = (s: string, allowV4: boolean): number[] | undefined => {
    if (s === "") return [];
    const out: number[] = [];
    const parts = s.split(":");
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i] as string;
      if (allowV4 && i === parts.length - 1 && p.includes(".")) {
        const v4 = parseIpv4(p);
        if (!v4) return undefined;
        out.push(
          ((v4[0] as number) << 8) | (v4[1] as number),
          ((v4[2] as number) << 8) | (v4[3] as number),
        );
      } else {
        if (!/^[0-9A-Fa-f]{1,4}$/.test(p)) return undefined;
        out.push(Number.parseInt(p, 16));
      }
    }
    return out;
  };
  const head = toGroups(halves[0] as string, halves.length === 1);
  if (!head) return undefined;
  if (halves.length === 1) return head.length === 8 ? head : undefined;
  const tail = toGroups(halves[1] as string, true);
  if (!tail) return undefined;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return undefined;
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

/** Returns 4 for a strict dotted-quad IPv4, 6 for IPv6 (including `::` forms and IPv4 tails, no zone id), else 0. */
export function ipVersion(value: string): 0 | 4 | 6 {
  if (parseIpv4(value)) return 4;
  if (parseIpv6(value)) return 6;
  return 0;
}

/** Trims, strips `[...]` brackets and the `::ffff:` IPv4-mapped prefix. Returns the input unchanged when it is not an IP. */
export function normalizeIp(value: string): string {
  let v = value.trim();
  if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1);
  const g = parseIpv6(v);
  if (g) {
    if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
      const a = g[6] as number;
      const b = g[7] as number;
      return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
    }
  }
  return ipVersion(v) === 0 ? value : v;
}

/** True for a globally routable address: false for private, loopback, link-local, CGNAT, unspecified, multicast and unique-local ranges, and for non-IPs. */
export function isPublicIp(value: string): boolean {
  const ip = normalizeIp(value);
  const v4 = parseIpv4(ip);
  if (v4) {
    const [a, b] = v4 as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a >= 224) return false;
    return true;
  }
  const v6 = parseIpv6(ip);
  if (v6) {
    const first = v6[0] as number;
    if (v6.every((x) => x === 0)) return false;
    if (v6.slice(0, 7).every((x) => x === 0) && v6[7] === 1) return false;
    if ((first & 0xfe00) === 0xfc00) return false;
    if ((first & 0xffc0) === 0xfe80) return false;
    if ((first & 0xff00) === 0xff00) return false;
    return true;
  }
  return false;
}

/** True for the documentation ranges 192.0.2/24, 198.51.100/24, 203.0.113/24 and 2001:db8::/32. */
export function isDocumentationIp(value: string): boolean {
  const ip = normalizeIp(value);
  const v4 = parseIpv4(ip);
  if (v4) {
    const [a, b, c] = v4 as [number, number, number, number];
    return (
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  const v6 = parseIpv6(ip);
  return !!v6 && v6[0] === 0x2001 && v6[1] === 0x0db8;
}

/**
 * One spelling per address, for comparing two IPs: IPv4-mapped IPv6 becomes dotted IPv4, IPv6
 * becomes its RFC 5952 text (lowercase, no leading zeros, the longest run of two or more zero
 * groups written `::`). A value that is not an IP comes back trimmed and lowercased.
 */
export function canonicalIp(value: string): string {
  const v = normalizeIp(value).trim();
  const g = parseIpv6(v);
  if (!g) return v.toLowerCase();
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (g[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > bestLen && j - i >= 2) {
      bestStart = i;
      bestLen = j - i;
    }
    i = j;
  }
  const hex = g.map((x) => x.toString(16));
  if (bestStart < 0) return hex.join(":");
  return `${hex.slice(0, bestStart).join(":")}::${hex.slice(bestStart + bestLen).join(":")}`;
}

/** True when both values are IP addresses naming the same address, whatever their spelling. */
export function sameIp(a: string, b: string): boolean {
  return ipVersion(normalizeIp(a)) !== 0 && canonicalIp(a) === canonicalIp(b);
}
