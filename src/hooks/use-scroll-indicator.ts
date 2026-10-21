import { useCallback, useLayoutEffect, useRef, useState } from "react";

type ScrollMetrics = {
  visible: boolean;
  thumbHeight: number;
  thumbTop: number;
};

export function useScrollIndicator() {
  const viewportElementRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<ScrollMetrics>({
    visible: false,
    thumbHeight: 0,
    thumbTop: 0,
  });

  const update = useCallback(() => {
    const element = viewportElementRef.current;
    if (!element) return;

    const { clientHeight, scrollHeight, scrollTop } = element;
    if (scrollHeight <= clientHeight) {
      setMetrics((current) =>
        current.visible ? { visible: false, thumbHeight: 0, thumbTop: 0 } : current,
      );
      return;
    }

    const trackHeight = clientHeight - 16;
    const thumbHeight = Math.max(20, (clientHeight / scrollHeight) * trackHeight);
    const thumbTop =
      (scrollTop / (scrollHeight - clientHeight)) * (trackHeight - thumbHeight);
    setMetrics({ visible: true, thumbHeight, thumbTop });
  }, []);

  const viewportRef = useCallback((element: HTMLDivElement | null) => {
    viewportElementRef.current = element;
    setViewport(element);
  }, []);

  useLayoutEffect(() => {
    if (!viewport) return;

    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(viewport);
    if (viewport.firstElementChild) resizeObserver.observe(viewport.firstElementChild);
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(viewport, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [update, viewport]);

  return { viewportRef, metrics, onScroll: update };
}
