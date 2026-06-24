import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LakBiz — Stock & Accounts",
    short_name: "LakBiz",
    description:
      "Stock, sales, banking and VAT for Sri Lankan shops — grocery, AC, vehicles and more.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#0d9488",
    lang: "si",
    dir: "ltr",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
