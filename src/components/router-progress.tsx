import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

export function RouterProgress() {
  const isPending = useRouterState({ select: (state) => state.status === "pending" });
  const [visible, setVisible] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (isPending) {
      setComplete(false);
      timer = setTimeout(() => setVisible(true), 150);
      return () => clearTimeout(timer);
    }

    if (visible) {
      setComplete(true);
      timer = setTimeout(() => {
        setVisible(false);
        setComplete(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isPending, visible]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]" aria-hidden="true">
      <div
        className={`router-progress-bar h-full origin-left bg-primary transition-[transform,opacity] duration-200 ease-out ${
          complete ? "scale-x-100 opacity-0" : "scale-x-[.85] opacity-100"
        }`}
      />
    </div>
  );
}
