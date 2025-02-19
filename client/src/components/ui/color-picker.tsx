import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Check, Palette } from "lucide-react";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const { user } = useAuth();
  const hasBrandColors = user?.brandPrimaryColor || user?.brandSecondaryColor;

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-10 p-1"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1"
      />
      {hasBrandColors && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Brand Colors</h4>
              {user.brandPrimaryColor && (
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => onChange(user.brandPrimaryColor!)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: user.brandPrimaryColor }}
                    />
                    <span>Primary Brand Color</span>
                  </div>
                  {value === user.brandPrimaryColor && (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              )}
              {user.brandSecondaryColor && (
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => onChange(user.brandSecondaryColor!)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: user.brandSecondaryColor }}
                    />
                    <span>Secondary Brand Color</span>
                  </div>
                  {value === user.brandSecondaryColor && (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
