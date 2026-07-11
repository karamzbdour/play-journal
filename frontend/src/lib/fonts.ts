import { Silkscreen } from "next/font/google";

// Shared next/font instance - imported both by the root layout (to register the
// @font-face/preload) and by anything needing the literal font-family string, e.g. Phaser
// canvas text, which can't resolve a CSS variable.
export const silkscreen = Silkscreen({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-silkscreen",
});
