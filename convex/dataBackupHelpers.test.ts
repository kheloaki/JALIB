import { describe, expect, it } from "vitest";

import {
  docsToCsv,
  parseBackupRecipients,
  sanitizeUserDoc,
} from "./dataBackupHelpers";

describe("parseBackupRecipients", () => {
  it("splits comma-separated emails", () => {
    expect(
      parseBackupRecipients("a@x.com, b@y.com;c@z.com"),
    ).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
  });

  it("drops invalid entries", () => {
    expect(parseBackupRecipients("not-an-email, ok@ok.com")).toEqual([
      "ok@ok.com",
    ]);
  });
});

describe("docsToCsv", () => {
  it("escapes commas and quotes", () => {
    const csv = docsToCsv([{ name: 'A, "B"', qty: 2 }]);
    expect(csv).toContain('"A, ""B"""');
    expect(csv.split("\n")).toHaveLength(2);
  });
});

describe("sanitizeUserDoc", () => {
  it("keeps identity fields only", () => {
    const out = sanitizeUserDoc({
      _id: "users:1",
      name: "Ada",
      email: "ada@x.com",
      phone: "0600",
      roleId: "roles:1",
      image: "secret-url",
      isAnonymous: false,
    });
    expect(out).toMatchObject({
      name: "Ada",
      email: "ada@x.com",
      phone: "0600",
      roleId: "roles:1",
    });
    expect(out).not.toHaveProperty("image");
    expect(out).not.toHaveProperty("isAnonymous");
  });
});
