import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sunu: {
          phantom: "#121212",
          arsenic: "#1C1C1C",
          cloud: "#EDEFF7",
          space: "#9DA2B3",
          graphite: "#6E7180",
          orange: "#FDA206",
          blue: "#2579fc",
        },
      },
    },
  },
  plugins: [],
};
export default config;
