import { Check, Palette } from "lucide-react";
import { usePaletteTheme } from "@/contexts/PaletteThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const ThemePalettePicker = () => {
  const { currentPalette, paletteOptions, setPaletteTheme } = usePaletteTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-foreground transition-colors hover:bg-accent outline-none">
        <Palette className="h-4 w-4 text-primary" />
        <span className="hidden lg:inline">{currentPalette.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] rounded-[1.5rem] border border-border bg-card p-2 shadow-xl">
        <div className="px-3 pb-2 pt-1">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">Palette</p>
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {paletteOptions.map((option) => {
            const isActive = option.id === currentPalette.id;

            return (
              <DropdownMenuItem
                key={option.id}
                onSelect={() => setPaletteTheme(option.id)}
                className="rounded-[1.1rem] p-0 focus:bg-transparent"
              >
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-4 rounded-[1.1rem] border px-3 py-3 text-left transition-colors ${
                    isActive
                      ? "border-primary/35 bg-primary/10"
                      : "border-transparent bg-transparent hover:border-border hover:bg-accent"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex gap-1.5">
                      {option.swatches.map((swatch) => (
                        <span
                          key={swatch}
                          className="h-4 w-4 rounded-full border border-black/5 shadow-sm"
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-foreground">{option.label}</p>
                  </div>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                      isActive ? "border-primary/30 bg-primary text-primary-foreground" : "border-border bg-card"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
