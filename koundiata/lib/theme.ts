import type { CSSProperties } from "react";
import type { Theme } from "@/lib/types";

export function themeStyle(theme: Theme): CSSProperties {
  return {
    "--kd-bg": theme.background,
    "--kd-ink": theme.foreground,
    "--kd-muted": theme.muted,
    "--kd-card": theme.card,
    "--kd-line": theme.border,
    "--kd-primary": theme.primary,
    "--kd-on-primary": theme.primaryForeground,
    "--kd-accent": theme.accent,
    "--kd-announcement": theme.announcement,
    "--kd-announcement-ink": theme.announcementForeground,
    "--kd-radius": `${theme.radius}px`,
  } as CSSProperties;
}
