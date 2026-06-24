/** Shared LakBiz mark for PWA / favicon ImageResponse routes. */
export function LakBizIconImage({
  fontSize,
  radius,
}: {
  fontSize: number;
  radius: number;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)",
        borderRadius: radius,
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        L
      </span>
    </div>
  );
}
