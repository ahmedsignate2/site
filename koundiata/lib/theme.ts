import type { CSSProperties } from "react";
import { contrast, ensureContrast, isDark, mix, readableOn } from "@/lib/color";
import type { Theme } from "@/lib/types";

/**
 * Thème réellement appliqué : les couleurs choisies dans le studio sont conservées
 * quand elles sont lisibles, et corrigées automatiquement sinon.
 */
export function readableTheme(theme: Theme) {
  const bg = theme.background;
  const dark = isDark(bg);
  const card = theme.card || bg;
  const ink = ensureContrast(theme.foreground, [bg, card], 7);
  const muted = ensureContrast(theme.muted, [bg, card], 4.6);
  // Boutons : on garde la couleur choisie pour le texte et on fonce (ou éclaircit) le fond si besoin.
  const onPrimary = contrast(theme.primaryForeground, theme.primary) >= 4.5 ? theme.primaryForeground : readableOn(theme.primary);
  const primary = ensureContrast(theme.primary, [onPrimary], 4.5);
  const announcementInk = ensureContrast(theme.announcementForeground, [theme.announcement], 4.5);
  // Accent utilisé pour des liens, prix et icônes : au moins 3:1, 4,5:1 visé.
  const accentText = ensureContrast(theme.accent, [bg, card], 4.5);
  return {
    dark,
    bg,
    card,
    ink,
    muted,
    line: contrast(theme.border, bg) < 1.25 ? mix(bg, ink, 0.18) : theme.border,
    primary,
    onPrimary,
    accent: theme.accent,
    accentText,
    onAccent: readableOn(theme.accent),
    announcement: theme.announcement,
    announcementInk,
    soft: mix(card, ink, dark ? 0.08 : 0.04),
    danger: dark ? "#fda4af" : "#b91c1c",
    dangerBg: dark ? mix(card, "#e11d48", 0.18) : "#fff1f2",
    success: dark ? "#6ee7b7" : "#047857",
    successBg: dark ? mix(card, "#10b981", 0.18) : "#ecfdf5",
    warn: dark ? "#fcd34d" : "#92400e",
    warnBg: dark ? mix(card, "#f59e0b", 0.16) : "#fffbeb",
    info: dark ? "#93c5fd" : "#1e40af",
    infoBg: dark ? mix(card, "#3b82f6", 0.18) : "#eff6ff",
  };
}

export function themeStyle(theme: Theme): CSSProperties {
  const t = readableTheme(theme);
  return {
    colorScheme: t.dark ? "dark" : "light",
    "--kd-bg": t.bg,
    "--kd-ink": t.ink,
    "--kd-muted": t.muted,
    "--kd-card": t.card,
    "--kd-line": t.line,
    "--kd-soft": t.soft,
    "--kd-primary": t.primary,
    "--kd-on-primary": t.onPrimary,
    "--kd-accent": t.accent,
    "--kd-accent-text": t.accentText,
    "--kd-on-accent": t.onAccent,
    "--kd-announcement": t.announcement,
    "--kd-announcement-ink": t.announcementInk,
    "--kd-danger": t.danger,
    "--kd-danger-bg": t.dangerBg,
    "--kd-success": t.success,
    "--kd-success-bg": t.successBg,
    "--kd-warn": t.warn,
    "--kd-warn-bg": t.warnBg,
    "--kd-info": t.info,
    "--kd-info-bg": t.infoBg,
    "--kd-radius": `${theme.radius}px`,
  } as CSSProperties;
}

/** Rapport de lisibilité affiché dans le studio. */
export function contrastReport(theme: Theme) {
  const rows = [
    { label: "Texte sur le fond", ratio: contrast(theme.foreground, theme.background), min: 4.5 },
    { label: "Texte sur les cartes", ratio: contrast(theme.foreground, theme.card), min: 4.5 },
    { label: "Texte secondaire", ratio: contrast(theme.muted, theme.background), min: 4.5 },
    { label: "Texte des boutons", ratio: contrast(theme.primaryForeground, theme.primary), min: 4.5 },
    { label: "Bandeau d'annonce", ratio: contrast(theme.announcementForeground, theme.announcement), min: 4.5 },
    { label: "Couleur d'accent sur le fond", ratio: contrast(theme.accent, theme.background), min: 3 },
  ];
  return rows.map((row) => ({ ...row, ok: row.ratio >= row.min }));
}
