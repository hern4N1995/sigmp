import type { ReactNode } from "react";
import { FileQuestion, type LucideIcon } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  icon: Icon = FileQuestion,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="font-semibold text-foreground">{title}</h2>
        {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
