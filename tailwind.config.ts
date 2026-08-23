import type { Config } from "tailwindcss";

/**
 * The same restrained palette as the native app: warm paper, calm ink, one
 * accent, four quiet member tints.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#FBF8F4",
        surface: "#FFFFFF",
        muted: "#F2EDE6",
        hairline: "#E6DFD5",
        ink: "#1C1B19",
        "ink-secondary": "#6B675F",
        // Retired. A third ink level cannot reach 4.5:1 on this warm canvas
        // without becoming ink-secondary, and everything it was carrying was
        // small print that has to be readable — renewal terms, and the notes
        // saying which parts of the prototype are simulated. Aliased rather
        // than deleted so a stray `text-ink-tertiary` renders readable text
        // instead of failing silently.
        "ink-tertiary": "#6B675F",
        accent: "#1F6F6B",
        "accent-muted": "#E3F0EE",
        attention: "#9A5B27",
        member: {
          teal: "#1F6F6B",
          plum: "#7A4A63",
          amber: "#A9752B",
          sage: "#5C7350",
        },
        fur: {
          light: "#E7CFB2",
          shade: "#CBAA85",
          cream: "#F7ECDD",
          ear: "#A8734A",
          "ear-shade": "#8B5C38",
        },
        waistcoat: "#333F4C",
        "waistcoat-shade": "#26303A",
        shirt: "#FAF7F2",
        bowtie: "#7A3B45",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      maxWidth: {
        phone: "430px",
      },
    },
  },
  plugins: [],
};

export default config;
