"use client";

import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface DataGridResizeHandleProps {
  onResize: (diff: number) => void;
  className?: string;
}

export function DataGridResizeHandle({
  onResize,
  className,
}: DataGridResizeHandleProps) {
  const startX = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;

      const onMouseMove = (ev: MouseEvent) => {
        const diff = ev.clientX - startX.current;
        onResize(diff);
        startX.current = ev.clientX;
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [onResize]
  );

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group/resize z-10",
        className
      )}
    >
      <div className="absolute inset-y-2 right-0 w-0.5 bg-border group-hover/resize:bg-primary transition-colors" />
    </div>
  );
}
