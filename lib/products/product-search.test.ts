import { describe, expect, it } from "vitest";

import type { Product } from "@/components/pos/types";
import {
  filterAndRankProductsBySearch,
  getProductSearchRank,
} from "@/lib/products/product-search";

function product(partial: Partial<Product> & { id: string; name: string }): Product {
  return {
    price: 1,
    category: "Livres scolaires",
    image: "",
    imageAlt: partial.name,
    stockQty: 1,
    stockLabel: "1",
    stockLow: false,
    ...partial,
  } as Product;
}

describe("getProductSearchRank", () => {
  it("matches digit prefixes: 1→1/10/100, 10→10/100, not 20 or 11", () => {
    const choc1 = product({ id: "1", name: "شكلاط 1 ريال" });
    const choc10 = product({ id: "2", name: "شكلاط 10 ريال" });
    const choc100 = product({ id: "3", name: "سيرجيو شكلاط 100غ" });
    const choc20 = product({ id: "4", name: "شكلاط 20 ريال" });
    const choc11 = product({ id: "5", name: "شكلاط 11 ريال" });

    expect(getProductSearchRank(choc1, "شكلاط 1")).not.toBeNull();
    expect(getProductSearchRank(choc10, "شكلاط 1")).not.toBeNull();
    expect(getProductSearchRank(choc100, "شكلاط 1")).not.toBeNull();

    expect(getProductSearchRank(choc10, "شكلاط 10")).not.toBeNull();
    expect(getProductSearchRank(choc100, "شكلاط 10")).not.toBeNull();
    expect(getProductSearchRank(choc20, "شكلاط 10")).toBeNull();
    expect(getProductSearchRank(choc11, "شكلاط 10")).toBeNull();
    expect(getProductSearchRank(choc1, "شكلاط 10")).toBeNull();
  });

  it("matches start or contain on name and glued sizes like شكلاط10غ", () => {
    const glued = product({ id: "1", name: "سيرجيو شكلاط10غ" });
    const mid = product({ id: "2", name: "بسكويت شكلاط دارك" });

    expect(getProductSearchRank(glued, "شكلاط 10")).not.toBeNull();
    expect(getProductSearchRank(mid, "كلاط")).not.toBeNull();
    expect(getProductSearchRank(mid, "دارك")).not.toBeNull();
  });

  it("requires every typed word for multi-word queries", () => {
    const choc100 = product({ id: "1", name: "سيرجيو شكلاط 100غ" });
    const inwi100 = product({ id: "2", name: "انوي 100" });
    const dolo1000 = product({ id: "3", name: "دلبران 1000" });

    expect(getProductSearchRank(choc100, "شكلاط 100")).not.toBeNull();
    expect(getProductSearchRank(inwi100, "شكلاط 100")).toBeNull();
    expect(getProductSearchRank(dolo1000, "شكلاط 100")).toBeNull();
  });

  it("ranks exact digit size before longer prefixes", () => {
    const products = [
      product({ id: "2", name: "سيرجيو شكلاط 100غ" }),
      product({ id: "1", name: "شكلاط 10 ريال" }),
      product({ id: "3", name: "شكلاط 100" }),
    ];
    const ranked = filterAndRankProductsBySearch(products, "شكلاط 10");
    expect(ranked.map((p) => p.id)).toEqual(["1", "3", "2"]);
  });

  it("ranks the closest name first for an exact size query", () => {
    const products = [
      product({ id: "2", name: "سيرجيو شكلاط 100غ" }),
      product({ id: "1", name: "شكلاط 100" }),
    ];
    const ranked = filterAndRankProductsBySearch(products, "شكلاط 100");
    expect(ranked.map((p) => p.id)).toEqual(["1", "2"]);
  });
});
