import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PaletteThemeId =
  | "yellow"
  | "purple"
  | "red"
  | "green"
  | "blue";

export interface PaletteThemeOption {
  id: PaletteThemeId;
  label: string;
  swatches: [string, string, string];
}

const STORAGE_KEY = "simba.palette";

export const paletteThemeOptions: PaletteThemeOption[] = [
  {
    id: "yellow",
    label: "Yellow",
    swatches: ["#f37f1f", "#f2be1a", "#fff6d8"],
  },
  {
    id: "purple",
    label: "Purple",
    swatches: ["#f37f1f", "#6d43d8", "#f3edff"],
  },
  {
    id: "red",
    label: "Red",
    swatches: ["#f37f1f", "#d94141", "#fff0ee"],
  },
  {
    id: "green",
    label: "Green",
    swatches: ["#f37f1f", "#1f8c57", "#edf9f0"],
  },
  {
    id: "blue",
    label: "Blue",
    swatches: ["#f37f1f", "#2b73e0", "#eef5ff"],
  },
];

const defaultPaletteTheme: PaletteThemeId = "green";

const isPaletteThemeId = (value: string | null): value is PaletteThemeId =>
  paletteThemeOptions.some((option) => option.id === value);

interface PaletteThemeContextValue {
  paletteTheme: PaletteThemeId;
  currentPalette: PaletteThemeOption;
  paletteOptions: PaletteThemeOption[];
  setPaletteTheme: (palette: PaletteThemeId) => void;
}

const PaletteThemeContext = createContext<PaletteThemeContextValue | undefined>(undefined);

export const PaletteThemeProvider = ({ children }: { children: ReactNode }) => {
  const [paletteTheme, setPaletteTheme] = useState<PaletteThemeId>(() => {
    if (typeof window === "undefined") {
      return defaultPaletteTheme;
    }

    const storedPalette = window.localStorage.getItem(STORAGE_KEY);
    return isPaletteThemeId(storedPalette) ? storedPalette : defaultPaletteTheme;
  });

  useEffect(() => {
    document.documentElement.dataset.palette = paletteTheme;
    window.localStorage.setItem(STORAGE_KEY, paletteTheme);
  }, [paletteTheme]);

  const value = useMemo(() => {
    const currentPalette =
      paletteThemeOptions.find((option) => option.id === paletteTheme) ?? paletteThemeOptions[2];

    return {
      paletteTheme,
      currentPalette,
      paletteOptions: paletteThemeOptions,
      setPaletteTheme,
    };
  }, [paletteTheme]);

  return <PaletteThemeContext.Provider value={value}>{children}</PaletteThemeContext.Provider>;
};

export const usePaletteTheme = () => {
  const context = useContext(PaletteThemeContext);

  if (!context) {
    throw new Error("usePaletteTheme must be used within a PaletteThemeProvider");
  }

  return context;
};
