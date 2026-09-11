import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Image that fades up once decoded, with a soft shimmer placeholder. */
export function SmoothImage({
  className,
  wrapperClassName,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { wrapperClassName?: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <span className={cn("relative block overflow-hidden", wrapperClassName)}>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] bg-muted/40 transition-opacity duration-500",
          loaded ? "opacity-0" : "animate-pulse opacity-100",
        )}
      />
      <img
        {...props}
        loading={props.loading ?? "lazy"}
        decoding="async"
        onLoad={(e) => {
          setLoaded(true);
          props.onLoad?.(e);
        }}
        onError={(e) => {
          setLoaded(true);
          props.onError?.(e);
        }}
        className={cn(
          "transition-[opacity,transform,filter] duration-500 ease-out",
          loaded ? "scale-100 opacity-100 blur-0" : "scale-[1.02] opacity-0 blur-sm",
          className,
        )}
      />
    </span>
  );
}
