import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const GOOGLE_FONTS_API = 'https://www.googleapis.com/webfonts/v1/webfonts';

interface FontOption {
  family: string;
  category: string;
  variants: string[];
}

export interface FontSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function FontSelector({ value, onValueChange, placeholder = "Select font...", className }: FontSelectorProps) {
  const [open, setOpen] = useState(false);
  const [fonts, setFonts] = useState<FontOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFonts() {
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_FONTS_API_KEY;
        console.log('API Key available:', !!apiKey); // Debug log

        if (!apiKey) {
          throw new Error('Google Fonts API key is not configured');
        }

        console.log('Fetching fonts from Google API...'); // Debug log
        const response = await fetch(`${GOOGLE_FONTS_API}?key=${apiKey}&sort=popularity`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Response:', response.status, errorText); // Debug log
          throw new Error(`Failed to fetch fonts: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Fonts fetched successfully:', data.items?.length || 0, 'fonts'); // Debug log

        // Add system fonts at the beginning
        const systemFonts: FontOption[] = [
          { family: 'Inter', category: 'sans-serif', variants: ['400', '700'] },
          { family: 'Roboto', category: 'sans-serif', variants: ['400', '700'] },
          { family: 'Open Sans', category: 'sans-serif', variants: ['400', '700'] },
        ];

        setFonts([...systemFonts, ...data.items.slice(0, 100)]); // Get system fonts + top 100 Google fonts
        setError(null);
      } catch (error) {
        console.error('Failed to fetch Google Fonts:', error); // Debug log
        // Fallback to system fonts if Google Fonts API fails
        setFonts([
          { family: 'Inter', category: 'sans-serif', variants: ['400', '700'] },
          { family: 'Roboto', category: 'sans-serif', variants: ['400', '700'] },
          { family: 'Open Sans', category: 'sans-serif', variants: ['400', '700'] },
          { family: 'Arial', category: 'sans-serif', variants: ['400', '700'] },
          { family: 'Helvetica', category: 'sans-serif', variants: ['400', '700'] },
        ]);
        setError(error instanceof Error ? error.message : 'Could not load Google Fonts. Using system fonts instead.');
      } finally {
        setLoading(false);
      }
    }

    fetchFonts();
  }, []);

  useEffect(() => {
    // Load the selected font
    if (value && !['Arial', 'Helvetica'].includes(value)) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${value.replace(' ', '+')}:wght@400;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <span style={{ fontFamily: value }}>{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search fonts..." />
          <CommandEmpty>No font found.</CommandEmpty>
          {loading ? (
            <div className="py-6 text-center text-sm">Loading fonts...</div>
          ) : error ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{error}</div>
          ) : (
            <CommandGroup className="max-h-[300px] overflow-auto">
              {fonts.map((font) => (
                <CommandItem
                  key={font.family}
                  value={font.family}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === font.family ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span style={{ fontFamily: font.family }}>{font.family}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}