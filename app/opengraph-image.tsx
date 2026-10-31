import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/site";

export const alt = "Islam Hafez — builds ERP systems on Odoo, frontend developer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#080D18",
          color: "#FFFFFF",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              backgroundColor: "#22D3EE",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 24, color: "#94A3B8", letterSpacing: 2 }}>
            CHAT WITH ISLAM HAFEZ
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 88, lineHeight: 1.05, color: "#FFFFFF" }}>
            Islam Hafez
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#94A3B8" }}>
            Odoo ERP systems (Python, OWL, PostgreSQL) · React · Next.js · TypeScript
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 24,
            color: "#64748B",
          }}
        >
          <div style={{ display: "flex" }}>
            Paid Odoo Apps module · Disaster-response platform · Fintech panels
          </div>
          <div style={{ display: "flex", color: "#22D3EE" }}>
            {SITE_URL.replace("https://", "")}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
