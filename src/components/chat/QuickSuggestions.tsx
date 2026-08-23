"use client";

import { Button } from "@/components/ui/button";
import { use3DTilt } from "@/hooks/use3DTilt";

interface QuickSuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export function QuickSuggestions({ suggestions, onSelect }: QuickSuggestionsProps) {
  const containerRef = use3DTilt({ intensity: 3, scale: 1.01, speed: 300 });

  return (
    <div ref={containerRef} className="mx-auto max-w-4xl px-4 pb-3 sm:px-6">
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion}
            variant="outline"
            size="sm"
            className="rounded-full border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border text-xs h-7 px-3 transition-all duration-200 hover:shadow-md hover:shadow-primary/5 transform-style-3d hover:rotate-y-2 hover:depth-1"
            onClick={() => onSelect(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}
