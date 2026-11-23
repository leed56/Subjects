"use client";

import { useEffect, useRef, useState } from "react";

type BarcodeResult = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeResult[]>;
};
type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};
type BarcodeWindow = Window & { BarcodeDetector?: BarcodeDetectorConstructor };
type ScannerLocale = "en" | "si" | "ta";

const COPY: Record<ScannerLocale, {
  title: string;
  hint: string;
  secure: string;
  unsupported: string;
  permission: string;
  close: string;
}> = {
  en: {
    title: "Scan product barcode",
    hint: "Place one product barcode inside the frame and hold the phone steady.",
    secure: "Camera access needs a secure HTTPS connection. Open LakBiz using its secure link.",
    unsupported: "Camera scanning is not supported by this browser. Use a Bluetooth scanner or enter the code manually.",
    permission: "The camera could not start. Allow camera access in your browser settings, then try again.",
    close: "Close scanner",
  },
  si: {
    title: "භාණ්ඩයේ තීරු කේතය ස්කෑන් කරන්න",
    hint: "තීරු කේතය රාමුව තුළ තබා දුරකථනය නිශ්චලව තබන්න.",
    secure: "කැමරාවට HTTPS ආරක්ෂිත සම්බන්ධතාවයක් අවශ්‍යයි. LakBiz ආරක්ෂිත සබැඳියෙන් විවෘත කරන්න.",
    unsupported: "මෙම බ්‍රවුසරයේ කැමරා ස්කෑන් කිරීම සහාය නොදක්වයි. Bluetooth ස්කෑනරයක් භාවිතා කරන්න හෝ කේතය ඇතුළත් කරන්න.",
    permission: "කැමරාව ආරම්භ කළ නොහැකි විය. බ්‍රවුසර සැකසුම්වලින් කැමරා අවසරය ලබා දී නැවත උත්සාහ කරන්න.",
    close: "ස්කෑනරය වසන්න",
  },
  ta: {
    title: "பொருள் பார்கோடை ஸ்கேன் செய்க",
    hint: "பார்கோடை சட்டகத்திற்குள் வைத்து தொலைபேசியை அசையாமல் பிடிக்கவும்.",
    secure: "கேமராவுக்கு HTTPS பாதுகாப்பான இணைப்பு தேவை. பாதுகாப்பான இணைப்பில் LakBiz-ஐத் திறக்கவும்.",
    unsupported: "இந்த உலாவியில் கேமரா ஸ்கேனிங் இல்லை. Bluetooth ஸ்கேனரைப் பயன்படுத்தவும் அல்லது குறியீட்டை உள்ளிடவும்.",
    permission: "கேமராவைத் தொடங்க முடியவில்லை. உலாவி அமைப்புகளில் கேமரா அனுமதியை வழங்கி மீண்டும் முயற்சிக்கவும்.",
    close: "ஸ்கேனரை மூடு",
  },
};

const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

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
  const onDetectedRef = useRef(onDetected);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[locale === "si" || locale === "ta" ? locale : "en"];

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let detecting = false;

    const stopCamera = () => {
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    const startScanner = async () => {
      if (!window.isSecureContext) {
        setError(copy.secure);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(copy.unsupported);
        return;
      }

      const Detector = (window as BarcodeWindow).BarcodeDetector;
      if (!Detector) {
        setError(copy.unsupported);
        return;
      }

      try {
        const supported = Detector.getSupportedFormats
          ? await Detector.getSupportedFormats()
          : BARCODE_FORMATS;
        const formats = BARCODE_FORMATS.filter((format) => supported.includes(format));
        const detector = new Detector(formats.length ? { formats } : undefined);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (disposed) {
          stopCamera();
          return;
        }

        const video = videoRef.current;
        if (!video) {
          stopCamera();
          return;
        }
        video.srcObject = stream;
        await video.play();

        const scanFrame = async () => {
          if (disposed) return;
          if (!detecting && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            detecting = true;
            try {
              const results = await detector.detect(video);
              const value = results.find((result) => result.rawValue?.trim())?.rawValue?.trim();
              if (value) {
                disposed = true;
                stopCamera();
                onDetectedRef.current(value);
                return;
              }
            } catch {
              // Retry on the next frame; a single blurred frame should not stop scanning.
            } finally {
              detecting = false;
            }
          }
          if (!disposed) timer = window.setTimeout(() => void scanFrame(), 160);
        };

        void scanFrame();
      } catch {
        stopCamera();
        if (!disposed) setError(copy.permission);
      }
    };

    void startScanner();
    return () => {
      disposed = true;
      stopCamera();
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [copy.permission, copy.secure, copy.unsupported]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="barcode-camera-title">
      <section className="w-full max-w-lg rounded-t-[28px] border border-emerald-100 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:rounded-[28px]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">LakBiz · Grocery</p>
            <h2 id="barcode-camera-title" className="mt-1 text-lg font-bold text-slate-950">{copy.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {copy.close}
          </button>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-emerald-100 bg-slate-100">
          <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline aria-label={copy.hint} />
          {!error && <div className="pointer-events-none absolute inset-[17%] rounded-2xl border-2 border-emerald-300 shadow-[0_0_0_999px_rgba(15,23,42,0.12)]" />}
          {error && (
            <div role="alert" className="absolute inset-0 flex items-center justify-center bg-sky-50/95 p-6 text-center text-sm font-medium leading-6 text-slate-700">
              {error}
            </div>
          )}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{copy.hint}</p>
      </section>
    </div>
  );
}

