type ScrollMetrics = {
  visible: boolean;
  thumbHeight: number;
  thumbTop: number;
};

export function ScrollIndicator({ metrics }: { metrics: ScrollMetrics }) {
  if (!metrics.visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-2 right-0.5 top-2 w-2 rounded-full bg-muted"
    >
      <div
        className="absolute inset-x-0 rounded-full border-2 border-solid border-muted bg-muted-foreground"
        style={{
          height: `${metrics.thumbHeight}px`,
          transform: `translateY(${metrics.thumbTop}px)`,
        }}
      />
    </div>
  );
}
