import type { Config } from "tailwindcss";
import dartwicTailwindPreset from "@dartwic/interface-sdk/tailwind-preset";

const config: Config = {
  presets: [dartwicTailwindPreset as unknown as Config],
  content: [
    "./interface/src/**/*.{ts,tsx}",
  ],
};

export default config;
