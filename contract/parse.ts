/** Readers of HMRC guide pages, shared by the live contract tests. */

/** The header names a method page lists as its own h3 headings, in page order. */
export function headingHeaders(html: string): string[] {
  const names: string[] = [];
  const rx = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  for (let m = rx.exec(html); m !== null; m = rx.exec(html)) {
    const text = (m[1] ?? "").replace(/<[^>]+>/g, "").trim();
    const name = /^(Gov-(?:Client|Vendor)-[A-Za-z-]+)$/.exec(text)?.[1];
    if (name) names.push(name);
  }
  return names;
}

/** The highest "x.y" version the change log names. */
export function newestVersion(html: string): string | undefined {
  const text = html.replace(/<[^>]+>/g, " ");
  const found = [...text.matchAll(/\b(?:version|v)\s*(\d+)\.(\d+)\b/gi)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
  found.sort((a, b) => (b[0] as number) - (a[0] as number) || (b[1] as number) - (a[1] as number));
  const top = found[0];
  return top ? `${top[0]}.${top[1]}` : undefined;
}
