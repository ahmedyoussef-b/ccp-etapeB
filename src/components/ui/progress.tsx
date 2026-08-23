import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const progressVariants = cva(
  "relative h-2 w-full overflow-hidden rounded-full bg-primary/20 shadow-3d",
  {
    variants: {
      variant: {
        default: "",
        destructive: "bg-destructive/20",
        success: "bg-emerald-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof progressVariants> {
  value?: number
}

function Progress({ className, variant = "default", value = 0, ...props }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn(progressVariants({ variant }), className)}
      {...props}
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-300 ease-in-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export { Progress, progressVariants }
