import { Caveat, Silkscreen } from "next/font/google";

// Shared next/font instance - imported both by the root layout (to register the
// @font-face/preload) and by anything needing the literal font-family string, e.g. Phaser
// canvas text, which can't resolve a CSS variable.
export const silkscreen = Silkscreen({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-silkscreen",
});

// Handwriting face for the journal tome's written pages - paragraphs of
// Silkscreen are illegible, so the pixel font stays chrome-only.
export const caveat = Caveat({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-caveat",
});
