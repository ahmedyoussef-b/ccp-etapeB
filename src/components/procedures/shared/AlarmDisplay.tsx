"use client";

import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, AlertTriangle, Shield, AlertCircle, Info } from "lucide-react";
import { proceduresFR } from "@/lib/i18n/procedures";
import { TAlarmConfig } from "@/lib/procedures/services/validator.service";

const alarmTypeIcons: Record<string, React.ReactNode> = {
  DANGER: <AlertTriangle className="h-4 w-4 text-alarm-danger" />,
  WARNING: <AlertCircle className="h-4 w-4 text-alarm-warning" />,
  INFO: <Info className="h-4 w-4 text-alarm-info" />,
  SECURITY_CHECK: <Shield className="h-4 w-4 text-alarm-security" />,
};

const alarmTypeColors: Record<string, string> = {
  DANGER: "border-l-alarm-danger bg-alarm-danger-bg",
  WARNING: "border-l-alarm-warning bg-alarm-warning-bg",
  INFO: "border-l-alarm-info bg-alarm-info-bg",
  SECURITY_CHECK: "border-l-alarm-security bg-alarm-security-bg",
};

interface AlarmDisplayProps {
  value: TAlarmConfig[];
  onChange: (value: TAlarmConfig[]) => void;
}

export function AlarmDisplay({ value, onChange }: AlarmDisplayProps) {
  const addAlarm = useCallback(() => {
    onChange([
      ...value,
      { condition: "", threshold: "", type: "INFO", message: "" },
    ]);
  }, [value, onChange]);

  const removeAlarm = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange]
  );

  const updateAlarm = useCallback(
    (index: number, updates: Partial<TAlarmConfig>) => {
      const next = [...value];
      next[index] = { ...next[index], ...updates };
      onChange(next);
    },
    [value, onChange]
  );

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={addAlarm} className="gap-1.5">
        <Plus className="h-3 w-3" />
        {proceduresFR.alarms.addAlarm}
      </Button>

      <div className="space-y-2">
        {value.map((alarm, index) => (
          <div
            key={index}
            className={`rounded-lg border-l-4 p-3 space-y-2 ${alarmTypeColors[alarm.type] || alarmTypeColors.INFO}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {alarmTypeIcons[alarm.type]}
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {alarm.type}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => removeAlarm(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {proceduresFR.alarms.conditionLabel}
                </label>
                <Input
                  placeholder={proceduresFR.alarms.conditionPlaceholder}
                  value={alarm.condition}
                  onChange={(e) => updateAlarm(index, { condition: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {proceduresFR.alarms.thresholdLabel}
                </label>
                <Input
                  placeholder={proceduresFR.alarms.thresholdPlaceholder}
                  value={alarm.threshold || ""}
                  onChange={(e) => updateAlarm(index, { threshold: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {proceduresFR.alarms.messageLabel}
              </label>
              <Input
                placeholder={proceduresFR.alarms.messagePlaceholder}
                value={alarm.message}
                onChange={(e) => updateAlarm(index, { message: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {proceduresFR.alarms.typeLabel}
              </label>
              <Select
                value={alarm.type}
                onValueChange={(v) =>
                  updateAlarm(index, { type: v as "DANGER" | "WARNING" | "INFO" | "SECURITY_CHECK" })
                }
              >
                <SelectTrigger className="h-7">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DANGER">{proceduresFR.alarms.typeDanger}</SelectItem>
                  <SelectItem value="WARNING">{proceduresFR.alarms.typeWarning}</SelectItem>
                  <SelectItem value="INFO">{proceduresFR.alarms.typeInfo}</SelectItem>
                  <SelectItem value="SECURITY_CHECK">
                    {proceduresFR.alarms.typeSecurityCheck}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}