import { describe, expect, it, vi } from "vitest";
import { consumeWebOriginResetRequest } from "./web-origin-reset";

function createWindowLike(href: string) {
  const replace = vi.fn();
  const clear = vi.fn();
  const deleteDatabase = vi.fn();

  return {
    windowLike: {
      location: {
        href,
        replace,
      },
      localStorage: {
        clear,
      },
      indexedDB: {
        deleteDatabase,
      },
    } as unknown as Window,
    replace,
    clear,
    deleteDatabase,
  };
}

describe("web-origin-reset", () => {
  it("does nothing without the reset query parameter", () => {
    const input = createWindowLike("https://paseo.example/#offer=abc");

    expect(consumeWebOriginResetRequest(input.windowLike)).toBe(false);
    expect(input.clear).not.toHaveBeenCalled();
    expect(input.deleteDatabase).not.toHaveBeenCalled();
    expect(input.replace).not.toHaveBeenCalled();
  });

  it("clears origin storage and preserves the offer hash", () => {
    const input = createWindowLike("https://paseo.example/?resetPaseo=1#offer=abc");

    expect(consumeWebOriginResetRequest(input.windowLike)).toBe(true);
    expect(input.clear).toHaveBeenCalledTimes(1);
    expect(input.deleteDatabase).toHaveBeenCalledWith("paseo-attachment-bytes");
    expect(input.replace).toHaveBeenCalledWith("https://paseo.example/#offer=abc");
  });
});
