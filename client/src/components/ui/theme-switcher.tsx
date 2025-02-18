import { Moon, Sun, Monitor, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/use-theme"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { useEffect } from "react"

function hexToHSL(hex: string) {
  // Remove the # from the beginning
  hex = hex.replace('#', '');

  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  // Convert to degrees and percentages
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return [h, s, l];
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()

  useEffect(() => {
    if (theme === 'brand' && user?.brandPrimaryColor && user?.brandSecondaryColor) {
      const root = document.documentElement;
      const [primaryH, primaryS, primaryL] = hexToHSL(user.brandPrimaryColor);
      const [secondaryH, secondaryS, secondaryL] = hexToHSL(user.brandSecondaryColor);

      root.style.setProperty('--brand-primary-h', primaryH.toString());
      root.style.setProperty('--brand-primary-s', primaryS + '%');
      root.style.setProperty('--brand-primary-l', primaryL + '%');

      root.style.setProperty('--brand-secondary-h', secondaryH.toString());
      root.style.setProperty('--brand-secondary-s', secondaryS + '%');
      root.style.setProperty('--brand-secondary-l', secondaryL + '%');
    }
  }, [theme, user?.brandPrimaryColor, user?.brandSecondaryColor]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
        {user?.brandPrimaryColor && user?.brandSecondaryColor && (
          <DropdownMenuItem onClick={() => setTheme("brand")}>
            <Palette className="mr-2 h-4 w-4" />
            <span>Brand</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}