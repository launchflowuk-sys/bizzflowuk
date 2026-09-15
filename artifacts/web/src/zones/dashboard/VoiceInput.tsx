import { useEffect, useRef, useState } from "react";

/**
 * Talking instead of typing.
 *
 * The browser does this itself — the Web Speech API runs the recognition, so
 * there is no audio upload, no per-minute bill, and nothing of the customer's
 * job leaves the phone except as text the person can see before it is sent.
 *
 * Support is genuinely patchy: Chrome and Safari have it, Firefox does not, and
 * some Android browsers ship the constructor and then fail on first use. So the
 * button only appears where it will actually work, and where it will not, the
 * hint points at the microphone on the phone's own keyboard — which every
 * trade already has, and which does the same job.
 *
 * Interim results are shown as they arrive. Watching the words appear is the
 * difference between trusting the thing and stopping after two seconds to check
 * whether it is listening.
 */

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceAvailable(): boolean {
  return recognitionClass() !== null;
}

/**
 * A textarea you can talk into.
 *
 * One component rather than a box and a separate button, so the two share the
 * text without either reaching into the other. Where the browser cannot do
 * speech the button is absent and the hint names the keyboard microphone,
 * instead of leaving a dead control on the screen.
 */
export default function DictatableTextarea({ value, onChange, className, placeholder, rows = 4, disabled }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const baseRef = useRef("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* already gone */ } }, []);

  function toggle() {
    if (listening) {
      try { recRef.current?.stop(); } catch { /* already stopped */ }
      setListening(false);
      return;
    }
    const Ctor = recognitionClass();
    if (!Ctor) return;
    setError(null);
    baseRef.current = value;

    const rec = new Ctor();
    rec.lang = "en-GB";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let heard = "";
      for (let i = 0; i < e.results.length; i++) heard += e.results[i][0].transcript;
      const base = baseRef.current.replace(/\s+$/, "");
      onChange(base ? `${base} ${heard.trim()}` : heard.trim());
    };
    rec.onerror = (e: any) => {
      setError(e?.error === "not-allowed"
        ? "Microphone access was blocked. Allow it in your browser settings, or use the microphone on your keyboard."
        : "Dictation stopped. You can carry on typing.");
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recRef.current = rec;
    try { rec.start(); setListening(true); }
    catch { setError("Could not start the microphone."); }
  }

  return (
    <div>
      <textarea
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={className}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {voiceAvailable() ? (
          <button type="button" onClick={toggle} disabled={disabled} aria-pressed={listening}
            className={`inline-flex items-center gap-2 rounded-[12px] border px-3 py-2 text-[13.5px] font-semibold transition disabled:opacity-50 ${
              listening ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}>
            <span aria-hidden className={listening ? "animate-pulse" : ""}>●</span>
            {listening ? "Listening — tap to stop" : "Say it instead"}
          </button>
        ) : (
          <span className="text-[12.5px] text-slate-400">
            Tip: use the microphone on your phone's keyboard to dictate this.
          </span>
        )}
        {error && <span className="text-[12.5px] text-amber-700">{error}</span>}
      </div>
    </div>
  );
}
