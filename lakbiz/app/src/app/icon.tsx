import { ImageResponse } from "next/og";
import { LakBizIconImage } from "@/lib/pwa/icon-image";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <LakBizIconImage fontSize={220} radius={112} />,
    { ...size },
  );
}
