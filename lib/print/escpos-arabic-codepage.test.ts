import { describe, expect, it } from "vitest";

import {
  encodeEscPosTicketText,
  prepareTicketVisualOrder,
} from "@/lib/print/escpos-arabic-codepage";
import { EscPosBuilder } from "@/lib/print/escpos-builder";

describe("escpos ticket code pages", () => {
  it("reverses RTL Arabic for LTR Font A print order", () => {
    expect(prepareTicketVisualOrder("محمد")).toBe("دمحم");
  });

  it("encodes Arabic on WPC1256", () => {
    const encoded = encodeEscPosTicketText("سكر");
    expect(encoded).not.toBeNull();
    expect(encoded!.codePage).toBe(50);
    expect(encoded!.label).toBe("WPC1256");
  });

  it("encodes French accents on WPC1252", () => {
    const encoded = encodeEscPosTicketText("Café");
    expect(encoded).not.toBeNull();
    expect(encoded!.codePage).toBe(16);
    expect(encoded!.label).toBe("WPC1252");
  });

  it("encodes ASCII on PC437", () => {
    const encoded = encodeEscPosTicketText("TOTAL 12.50");
    expect(encoded).not.toBeNull();
    expect(encoded!.codePage).toBe(0);
  });

  it("rejects characters outside code pages", () => {
    expect(encodeEscPosTicketText("سكر 😀")).toBeNull();
  });

  it("emits ESC t 16 before French text", async () => {
    const ticket = new EscPosBuilder().init();
    await ticket.lineAuto("Café", { bold: true });
    const haystack = Array.from(ticket.build());
    const found = haystack.some(
      (_, i) =>
        haystack[i] === 0x1b &&
        haystack[i + 1] === 0x74 &&
        haystack[i + 2] === 16,
    );
    expect(found).toBe(true);
  });
});
