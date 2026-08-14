import * as React from "react"

import { cn } from "@/lib/utils"

type CheckboxProps = Omit<React.ComponentProps<"input">, "onChange"> & {
  onCheckedChange?: (checked: boolean) => void;
}

function Checkbox({
  className,
  checked,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCheckedChange?.(e.target.checked);
  };

  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      checked={checked}
      onChange={handleChange}
      className={cn(
        "size-4 shrink-0 rounded border border-input text-primary shadow-sm transition-all focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 checked:bg-primary checked:border-primary checked:text-primary-foreground dark:checked:bg-primary dark:checked:border-primary",
        className
      )}
      {...props}
    />
  )
}

export { Checkbox }
