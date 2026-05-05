import { describe, expect, it } from "vitest";
import { isOriginAllowedByList } from "./origin-allowlist.js";

describe("isOriginAllowedByList", () => {
  it("allows exact origins", () => {
    expect(isOriginAllowedByList("https://app.paseo.sh", new Set(["https://app.paseo.sh"]))).toBe(
      true,
    );
  });

  it("allows configured wildcard subdomains", () => {
    expect(
      isOriginAllowedByList(
        "https://bc3e52e6.paseo-app-eef.pages.dev",
        new Set(["https://*.paseo-app-eef.pages.dev"]),
      ),
    ).toBe(true);
  });

  it("does not allow the wildcard root domain", () => {
    expect(
      isOriginAllowedByList(
        "https://paseo-app-eef.pages.dev",
        new Set(["https://*.paseo-app-eef.pages.dev"]),
      ),
    ).toBe(false);
  });
});
