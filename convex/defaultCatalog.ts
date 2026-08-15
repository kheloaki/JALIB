export const DEFAULT_PRODUCT_CATEGORIES = [
  "Alimentation",
  "Nettoyage",
  "Papeterie",
  "Électronique",
] as const;

export const DEFAULT_PRODUCTS = [
  {
    legacyId: "pos-seed:1",
    categoryLabel: "Alimentation",
    name: "Huile d'Olive Extra Vierge 1L",
    barcode: "3760263500123",
    sellPriceMadCents: 8500,
    costMadCents: 6200,
    stockQty: 42,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB3QdAol8oRCoLpDWTENYvXwFojapopQwehWN69XEGxBsPQrkflldZ2bnbKvv4vBPp8LX2Pr_J9uwR9V47F-xVMXBU4-wedgKjTD5J-u6IQxb3umQDBRdstq3Z1QmPDFCHgITScVKqPWIFj2WUiB3xnvmcPnPlgz4IiajiKhvWdadCA45mXEidzTOeHjNagRzm6CD5dgDxhENypS_YPyRvhcjzW5BJtwU0_Aot8KhKEoWg35X5NU9xWtmB3uIht6GtC45ViAEH7SuIk",
    imageAlt: "Bouteille d'huile d'olive extra vierge",
  },
  {
    legacyId: "pos-seed:2",
    categoryLabel: "Alimentation",
    name: "Baguette Traditionnelle",
    barcode: "3245412567335",
    sellPriceMadCents: 250,
    costMadCents: 155,
    stockQty: 8,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBdc7ehSHdw5TYAnjvE_yyAJT0L8_R_W2LuFzU0_2G06-gLVTDkM8KBepPUZu39L10Qk80AOijSXq2B8AO5BvLl5OTcNi0GCaYKmqN1IU1_6CneLexjRqLhjz8754X8yQSwlz4AcVbhlAKhUSzDm9EMa5pazmfGI4FLBdF9800BrI5dw9vpaHPMAuvaJJpHdmoS-w7g3nnRt5re8BjOBDDIwsNNS-9x7UskQuGCxexzsj6q3DAH5emk5PxpG4d7HmxgFHMuyRi3WuxM",
    imageAlt: "Baguette traditionnelle",
  },
  {
    legacyId: "pos-seed:3",
    categoryLabel: "Nettoyage",
    name: "Papier Toilette - Pack de 12",
    barcode: "3560070968886",
    sellPriceMadCents: 4500,
    costMadCents: 3150,
    stockQty: 120,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCrsuDqDdB_PzcLpsvDYsx-0TPlKCTerVHqvzzqFmUknayMmmcuVI_Ux9QOzekcRZxR5TgyLFoVYwmYZ_PNbFm1SfHQHG2Wl-QKDluZOR97yRAG9VYQT55nG8QReygtGISvCarf3NgtrWiiJ4z5VDVy5t1dClgX8uyvKmQZTKl1w-MX3qyGxJnJ7JCA-OIYlMY161d56IKfN8lqSiijrZ4Anj9JPXwpJOBCAA7LAiEtg8NG6RMXsh5-EPWSKYBTVNx4nVQyuhP1Uxik",
    imageAlt: "Papier toilette",
  },
  {
    legacyId: "pos-seed:4",
    categoryLabel: "Électronique",
    name: "Piles AA Duracell x4",
    sellPriceMadCents: 3200,
    costMadCents: 2150,
    stockQty: 15,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDxtozHdktVcWjP6ath0HjgO5XsXqh7UFzVPnFdE7lxUHd7hYcjLnwMWuSCNpMXxiaLDtcJt0Z1F-c1jxuEf5KGu9wsZ1SP8PS8vsvAqQQKDPZAI2TwnhaXcNjXvM3PB4TBknICFqs9eabB6RYyOtbVPUHkO26DldiuOccmbDM_Eq0fkY7C-MWVeFl5t-W8j_U_QLEYezBXNTvnLf29fIPb0n5lwecI8q8WkE1LnpA0yy_KhUEeSiEPk1eyYm50v81H4ncThjma10W1",
    imageAlt: "Piles alcalines AA",
  },
  {
    legacyId: "pos-seed:5",
    categoryLabel: "Alimentation",
    name: "Bananes Importées (kg)",
    sellPriceMadCents: 1450,
    costMadCents: 980,
    stockQty: 12,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDha4By3cf6b3xRCUWu3dnX-NQPQduLcBomn5m1vg7qHMJPGMblWDtpenQyZpaVuEneCwNClUgtvVo8I8v0qABvcN-ICaIZYf3OJUx-qeLu5jU8L4iTgINxNJJk9vZwQMl3LxVJ9i9zH4iauhIFxIxFSV8MjNV-eYdzZa3CO7GvdfAdpS-750v848NIhJpriwtVSTGesOtmA9wsFo6xEqXWTFnCfADx9Y7WYwG768aeZ9qwoFPjDAEyVA3iYSeyDPP5KGo9AyKMTE04",
    imageAlt: "Bananes mûres",
  },
  {
    legacyId: "pos-seed:6",
    categoryLabel: "Nettoyage",
    name: "Lessive Liquide 3L Ariel",
    sellPriceMadCents: 11500,
    costMadCents: 7800,
    stockQty: 24,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAkqvA7ZctogiJXxCge46-3B00IA3ziNT0DoCVnouHKh9FZvV3YCqZeGVSFWwUR6HnMdSR7LAD5f4eDpIZM7cxiUnya71IgVWAy_l_p5d9RBvC6QaeVxxmdt8ExrFW03El3fhnYB-_7Lf8DmXhAsadVFm5DeuNaf8TqhgUTLLOnXB73b2wM9jdRaQtdOIxGUhzinTLdpcpjuKvqfEbrWcQoRYrEsY8Ix24NxovujEOwNE8s5xDF225ecnvsmiS-AU9F_8xp0mOWcIs7",
    imageAlt: "Lessive liquide",
  },
] as const;
