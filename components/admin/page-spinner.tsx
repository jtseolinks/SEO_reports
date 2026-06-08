import { Loader2 } from "lucide-react";

export function PageSpinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 320,
        color: "var(--text-faint)",
      }}
    >
      <Loader2 size={28} className="animate-spin" />
    </div>
  );
}
