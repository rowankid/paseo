export function isOriginAllowedByList(
  origin: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (!origin) {
    return false;
  }
  if (allowedOrigins.has("*") || allowedOrigins.has(origin)) {
    return true;
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  for (const allowedOrigin of allowedOrigins) {
    if (!allowedOrigin.includes("*")) {
      continue;
    }

    let parsedAllowed: URL;
    try {
      parsedAllowed = new URL(allowedOrigin);
    } catch {
      continue;
    }

    if (parsedAllowed.protocol !== parsedOrigin.protocol) {
      continue;
    }
    if (parsedAllowed.username || parsedAllowed.password) {
      continue;
    }
    if (parsedAllowed.pathname !== "/" || parsedAllowed.search || parsedAllowed.hash) {
      continue;
    }
    if (parsedAllowed.port !== parsedOrigin.port) {
      continue;
    }

    const allowedHostname = parsedAllowed.hostname.toLowerCase();
    const originHostname = parsedOrigin.hostname.toLowerCase();
    if (!allowedHostname.startsWith("*.")) {
      continue;
    }

    const suffix = allowedHostname.slice(1);
    if (originHostname.endsWith(suffix) && originHostname.length > suffix.length) {
      return true;
    }
  }

  return false;
}
