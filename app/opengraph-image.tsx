import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "#1e3a8a",
          color: "#ffffff",
          padding: "80px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 20,
              background: "#ffffff",
              color: "#1e3a8a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 900,
            }}
          >
            §
          </div>
          <div style={{ fontSize: 72, fontWeight: 900 }}>Зад Закона</div>
        </div>
        <div style={{ marginTop: 24, fontSize: 34, color: "#d4d4d8" }}>
          историята на промените в българските закони
        </div>
      </div>
    ),
    { ...size },
  );
}
