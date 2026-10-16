"use client";

export function PrintButton() {
  return (
    <button className="kd-btn" type="button" onClick={() => window.print()}>
      Imprimer ou enregistrer en PDF
    </button>
  );
}
