"use client";

import { useEffect, useRef, useState } from "react";

type ScannerLocale = "en" | "si" | "ta";
type CameraErrorKey = "unsupported" | "permission" | "noCamera" | "cameraBusy" | "secure";
type ScannerCopy = {
  title: string;
  hint: string;
  idle: string;
  starting: string;
  start: string;
  retry: string;
  close: string;
} & Record<CameraErrorKey, string>;

const COPY: Record<ScannerLocale, ScannerCopy> = {
  en: {
    title: "Scan product barcode",
    hint: "Hold the phone 10–20 cm from one barcode. Keep the bars sharp and tilt glossy packs to reduce glare.",
    idle: "Tap Start camera to scan. Your browser will ask for camera permission.",
    starting: "Opening camera…",
    start: "Start camera",
    retry: "Try again",
    close: "Close scanner",
    secure: "Camera access needs a secure HTTPS connection. Open LakBiz using its secure link.",
    unsupported: "This browser cannot open a camera. Try an up-to-date browser, use a Bluetooth scanner, or enter the code manually.",
    permission: "Camera access is blocked. Open this site's permissions from the address bar, allow Camera, then tap Try again.",
    noCamera: "No camera was found on this device. Use a camera-enabled device, a Bluetooth scanner, or enter the code manually.",
    cameraBusy: "The camera is busy or unavailable. Close other apps using it, then tap Try again.",
  },
  si: {
    title: "භාණ්ඩයේ තීරු කේතය ස්කෑන් කරන්න",
    hint: "දුරකථනය තීරු කේතයෙන් සෙ.මී. 10–20ක් දුරින් තබන්න. තීරු පැහැදිලිව තබා, දිලිසෙන ඇසුරුමක් නම් ආලෝක පරාවර්තනය අඩු කිරීමට මඳක් ඇල කරන්න.",
    idle: "ස්කෑන් කිරීමට “කැමරාව අරඹන්න” තට්ටු කරන්න. බ්‍රවුසරය කැමරා අවසරය විමසයි.",
    starting: "කැමරාව ආරම්භ කරමින්…",
    start: "කැමරාව අරඹන්න",
    retry: "නැවත උත්සාහ කරන්න",
    close: "ස්කෑනරය වසන්න",
    secure: "කැමරාවට HTTPS ආරක්ෂිත සම්බන්ධතාවයක් අවශ්‍යයි. LakBiz ආරක්ෂිත සබැඳියෙන් විවෘත කරන්න.",
    unsupported: "මෙම බ්‍රවුසරයට කැමරාව විවෘත කළ නොහැක. යාවත්කාලීන බ්‍රවුසරයක් හෝ Bluetooth ස්කෑනරයක් භාවිතා කරන්න, නැතහොත් කේතය ඇතුළත් කරන්න.",
    permission: "කැමරා අවසරය අවහිර වී ඇත. ලිපින තීරුව අසල අඩවි අවසර විවෘත කර කැමරාවට අවසර දෙන්න. පසුව නැවත උත්සාහ කරන්න.",
    noCamera: "මෙම උපාංගයේ කැමරාවක් හමු නොවීය. කැමරාවක් ඇති උපාංගයක් හෝ Bluetooth ස්කෑනරයක් භාවිතා කරන්න, නැතහොත් කේතය ඇතුළත් කරන්න.",
    cameraBusy: "කැමරාව වෙනත් යෙදුමකින් භාවිතා වේ හෝ ලබාගත නොහැක. එම යෙදුම වසා නැවත උත්සාහ කරන්න.",
  },
  ta: {
    title: "பொருள் பார்கோடை ஸ்கேன் செய்க",
    hint: "தொலைபேசியை பார்கோடிலிருந்து 10–20 செ.மீ. தொலைவில் வைக்கவும். பட்டைகள் தெளிவாக இருக்கட்டும்; பளபளப்பான பொட்டலத்தின் ஒளிப் பிரதிபலிப்பைக் குறைக்க சற்றே சாய்க்கவும்.",
    idle: "ஸ்கேன் செய்ய “கேமராவைத் தொடங்கு” என்பதைத் தட்டவும். உலாவி கேமரா அனுமதியைக் கேட்கும்.",
    starting: "கேமரா தொடங்குகிறது…",
    start: "கேமராவைத் தொடங்கு",
    retry: "மீண்டும் முயற்சி செய்க",
    close: "ஸ்கேனரை மூடு",
    secure: "கேமராவுக்கு HTTPS பாதுகாப்பான இணைப்பு தேவை. பாதுகாப்பான இணைப்பில் LakBiz-ஐத் திறக்கவும்.",
    unsupported: "இந்த உலாவியால் கேமராவைத் திறக்க முடியவில்லை. புதுப்பிக்கப்பட்ட உலாவி அல்லது Bluetooth ஸ்கேனரைப் பயன்படுத்தவும், அல்லது குறியீட்டை உள்ளிடவும்.",
    permission: "கேமரா அனுமதி தடுக்கப்பட்டுள்ளது. முகவரிப் பட்டியில் இந்த தளத்தின் அனுமதிகளைத் திறந்து கேமராவை அனுமதிக்கவும்; பின்னர் மீண்டும் முயற்சிக்கவும்.",
    noCamera: "இந்த சாதனத்தில் கேமரா இல்லை. கேமரா உள்ள சாதனம் அல்லது Bluetooth ஸ்கேனரைப் பயன்படுத்தவும், அல்லது குறியீட்டை உள்ளிடவும்.",
    cameraBusy: "கேமரா வேறு செயலியால் பயன்படுத்தப்படுகிறது அல்லது கிடைக்கவில்லை. அந்த செயலியை மூடி மீண்டும் முயற்சிக்கவும்.",
  },
};

type ReaderControls = { stop: () => void };

function cameraErrorKey(error: unknown): CameraErrorKey {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name ?? "")
      : "";

  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "noCamera";
  if (name === "NotReadableError" || name === "TrackStartError") return "cameraBusy";
  if (name === "NotAllowedError" || name === "SecurityError") return "permission";
  return "unsupported";
}

export function BarcodeCameraScanner({
  locale,
  onDetected,
  onClose,
}: {
  locale: string;
  onDetected: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ReaderControls | null>(null);
  const mountedRef = useRef(false);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "error">("idle");
  const [error, setError] = useState<CameraErrorKey | null>(null);
  const copy = COPY[locale === "si" || locale === "ta" ? locale : "en"];

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onCloseRef.current = onClose;
  }, [onClose, onDetected]);

  useEffect(() => {
    mountedRef.current = true;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("keydown", onKeyDown);
      controlsRef.current?.stop();
      controlsRef.current = null;
      const video = videoRef.current;
      const stream = video?.srcObject as MediaStream | null | undefined;
      stream?.getTracks().forEach((track) => track.stop());
      if (video) {
        video.pause();
        video.srcObject = null;
      }
    };
  }, []);

  const startScanner = async () => {
    if (status === "starting" || status === "scanning") return;
    detectedRef.current = false;
    setError(null);
    setStatus("starting");

    if (!window.isSecureContext) {
      setError("secure");
      setStatus("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      setStatus("error");
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setError("unsupported");
      setStatus("error");
      return;
    }

    try {
      const [
        { BrowserMultiFormatReader },
        { BarcodeFormat, DecodeHintType },
      ] = await Promise.all([
        import("@zxing/browser"),
        import("@zxing/library"),
      ]);
      if (!mountedRef.current) return;

      const hints = new Map<DecodeHintType, any>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE,
      ]);
      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 120,
        delayBetweenScanSuccess: 120,
      });
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
        },
        video,
        (result, _decodeError, scanControls) => {
          const value = result?.getText().trim();
          if (!value || detectedRef.current) return;
          detectedRef.current = true;
          scanControls?.stop();
          onDetectedRef.current(value);
        },
      );

      controlsRef.current = controls;
      if (!mountedRef.current || detectedRef.current) {
        controls.stop();
        return;
      }
      setStatus("scanning");
    } catch (startError) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      if (mountedRef.current) {
        setError(cameraErrorKey(startError));
        setStatus("error");
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="barcode-camera-title"
    >
      <section className="w-full max-w-lg rounded-t-[28px] border border-emerald-100 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:rounded-[28px]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">
              LakBiz · Grocery
            </p>
            <h2 id="barcode-camera-title" className="mt-1 text-lg font-bold text-slate-950">
              {copy.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {copy.close}
          </button>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-emerald-100 bg-slate-100">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
            aria-label={copy.hint}
          />
          {status !== "scanning" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-sky-50/95 p-6 text-center"
              aria-live="polite"
            >
              <p
                role={status === "error" ? "alert" : undefined}
                className="max-w-sm text-sm font-medium leading-6 text-slate-700"
              >
                {status === "starting"
                  ? copy.starting
                  : status === "error" && error
                    ? copy[error]
                    : copy.idle}
              </p>
              {status !== "starting" && (
                <button
                  type="button"
                  onClick={() => void startScanner()}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200"
                >
                  {status === "error" ? copy.retry : copy.start}
                </button>
              )}
            </div>
          )}
          {status === "scanning" && (
            <div className="pointer-events-none absolute inset-x-[9%] inset-y-[32%] rounded-2xl border-2 border-emerald-300 shadow-[0_0_0_999px_rgba(15,23,42,0.12)]" />
          )}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{copy.hint}</p>
      </section>
    </div>
  );
}
