import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const spinnerSizes = {
  sm: "size-4",
  md: "size-6",
  lg: "size-9",
} as const;

type SpinnerProps = {
  size?: keyof typeof spinnerSizes;
  label?: string;
  className?: string;
};

function Spinner({ size = "md", label, className }: SpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin text-current", spinnerSizes[size], className)}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export { Spinner };
