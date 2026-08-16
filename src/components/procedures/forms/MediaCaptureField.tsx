"use client";

import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { proceduresFR } from "@/lib/i18n/procedures";
import { TStep } from "@/lib/procedures/services/validator.service";
import {
  Video,
  Mic,
  Hand,
  Trash2,
  MapPin,
  Clock,
  Camera,
} from "lucide-react";
import { MediaCapturePreview } from "./MediaCapturePreview";

interface MediaCaptureFieldProps {
  value: TStep["mediaRequirements"];
  onChange: (value: TStep["mediaRequirements"]) => void;
}

const mediaTypeIcons: Record<string, React.ReactNode> = {
  photo: <Camera className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  audio: <Mic className="h-4 w-4" />,
  signature: <Hand className="h-4 w-4" />,
};

export function MediaCaptureField({ value, onChange }: MediaCaptureFieldProps) {
  const addMedia = useCallback(
    (type: string) => {
      onChange([
        ...value,
        {
          type: type as "photo" | "video" | "audio" | "signature",
          mandatory: false,
          options: { geolocation: false, timestamp: false },
        },
      ]);
    },
    [value, onChange]
  );

  const removeMedia = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange]
  );

  const updateMedia = useCallback(
    (index: number, updates: Partial<TStep["mediaRequirements"][0]>) => {
      const next = [...value];
      const current = next[index];
      const currentOptions = { geolocation: false, timestamp: false, ...current?.options };
      const newOptions = updates.options
        ? { ...currentOptions, ...updates.options }
        : currentOptions;
      next[index] = { ...current, ...updates, options: newOptions };
      onChange(next);
    },
    [value, onChange]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["photo", "video", "audio", "signature"] as const).map((type) => {
          const exists = value.some((m) => m.type === type);
          return (
            <Button
              key={type}
              type="button"
              variant={exists ? "default" : "outline"}
              size="sm"
              onClick={() => !exists && addMedia(type)}
              className="gap-1.5"
            >
              {mediaTypeIcons[type]}
              {proceduresFR.media[type]}
            </Button>
          );
        })}
      </div>

      <div className="space-y-3">
        {value.map((media, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-card p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0">{mediaTypeIcons[media.type]}</span>
                <span className="text-sm font-medium">
                  {proceduresFR.media[media.type]}
                </span>
                {media.capturedUrl && (
                  <span className="text-[10px] text-emerald-500 font-medium">
                    Capturé
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removeMedia(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <Checkbox
                  id={`media-mandatory-${index}`}
                  checked={media.mandatory}
                  onCheckedChange={(checked) =>
                    updateMedia(index, { mandatory: checked as boolean })
                  }
                />
                <Label
                  htmlFor={`media-mandatory-${index}`}
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  {proceduresFR.media.mandatory}
                </Label>
              </div>
              <div className="flex items-center gap-1">
                <Checkbox
                  id={`media-geo-${index}`}
                  checked={media.options?.geolocation ?? false}
                  onCheckedChange={(checked) => {
                    const next = [...value];
                    const opts = {
                      geolocation: false,
                      timestamp: false,
                      ...next[index].options,
                    };
                    next[index] = {
                      ...next[index],
                      options: { ...opts, geolocation: checked as boolean },
                    };
                    onChange(next);
                  }}
                />
                <Label
                  htmlFor={`media-geo-${index}`}
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  <MapPin className="h-3 w-3 inline mr-1" />
                  {proceduresFR.media.geolocation}
                </Label>
              </div>
              <div className="flex items-center gap-1">
                <Checkbox
                  id={`media-ts-${index}`}
                  checked={media.options?.timestamp ?? false}
                  onCheckedChange={(checked) => {
                    const next = [...value];
                    const opts = {
                      geolocation: false,
                      timestamp: false,
                      ...next[index].options,
                    };
                    next[index] = {
                      ...next[index],
                      options: { ...opts, timestamp: checked as boolean },
                    };
                    onChange(next);
                  }}
                />
                <Label
                  htmlFor={`media-ts-${index}`}
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  <Clock className="h-3 w-3 inline mr-1" />
                  {proceduresFR.media.timestamp}
                </Label>
              </div>
            </div>

            <MediaCapturePreview
              type={media.type}
              options={media.options}
              onCapture={(dataUrl) =>
                updateMedia(index, { capturedUrl: dataUrl })
              }
              capturedUrl={media.capturedUrl}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
