import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Mic, MicOff, PhoneCall, Send, Volume2, X } from 'lucide-react';
import type { BusinessSettings } from '../types.ts';

interface VoiceConsultantProps {
  settings: BusinessSettings;
  onBookConsultation: () => void;
  externalOpenSignal?: number;
}

interface TranscriptEntry {
  id: string;
  speaker: 'You' | 'Consultant';
  text: string;
}

type VoiceState = 'idle' | 'connecting' | 'connected' | 'error';

function float32ToInt16Base64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64PcmToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}

const STARTER_TOPICS = [
  'Estimate for a 3BHK interior in Cuttack',
  'Modular kitchen materials & timeline',
  'Book a site visit with Bipin Kumar',
];

export function VoiceConsultant({
  settings,
  onBookConsultation,
  externalOpenSignal = 0,
}: VoiceConsultantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isMutedRef = useRef<boolean>(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (externalOpenSignal > 0) {
      setIsOpen(true);
    }
  }, [externalOpenSignal]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const stopQueuedAudio = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setIsSpeaking(false);
  }, []);

  const cleanupSession = useCallback(() => {
    stopQueuedAudio();

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (inputCtxRef.current) {
      void inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }

    if (outputCtxRef.current) {
      void outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    setIsSpeaking(false);
    setIsMuted(false);
  }, [stopQueuedAudio]);

  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, [cleanupSession]);

  const appendTranscript = useCallback((speaker: 'You' | 'Consultant', text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && last.text.length < 320) {
        const joined = `${last.text} ${clean}`.replace(/\s+/g, ' ');
        return [...prev.slice(0, -1), { ...last, text: joined }];
      }
      return [
        ...prev.slice(-24),
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, speaker, text: clean },
      ];
    });
  }, []);

  const playPcmChunk = useCallback((base64Audio: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const float32 = base64PcmToFloat32(base64Audio);
    if (float32.length === 0) return;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    nextStartTimeRef.current = startTime + buffer.duration;

    activeSourcesRef.current.add(source);
    setIsSpeaking(true);

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setIsSpeaking(false);
      }
    };

    source.start(startTime);
  }, []);

  const startConversation = async () => {
    if (voiceState === 'connecting' || voiceState === 'connected') return;
    cleanupSession();
    setErrorMsg(null);
    setVoiceState('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/live-voice`);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        sourceNodeRef.current = source;
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          if (isMutedRef.current) return;
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          const channelData = event.inputBuffer.getChannelData(0);
          const base64 = float32ToInt16Base64(channelData);
          wsRef.current.send(JSON.stringify({ audio: base64 }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
        setVoiceState('connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as {
            audio?: string;
            interrupted?: boolean;
            userTranscript?: string;
            assistantTranscript?: string;
            error?: string;
          };
          if (msg.error) {
            setErrorMsg(msg.error);
            setVoiceState('error');
            cleanupSession();
            return;
          }
          if (msg.interrupted) {
            stopQueuedAudio();
          }
          if (msg.audio) {
            playPcmChunk(msg.audio);
          }
          if (msg.userTranscript) {
            appendTranscript('You', msg.userTranscript);
          }
          if (msg.assistantTranscript) {
            appendTranscript('Consultant', msg.assistantTranscript);
          }
        } catch {
          // ignore malformed frame
        }
      };

      ws.onerror = () => {
        setErrorMsg('Voice connection encountered an error. Please try again or call directly.');
        setVoiceState('error');
        cleanupSession();
      };

      ws.onclose = () => {
        setVoiceState((prev) => (prev === 'error' ? 'error' : 'idle'));
        cleanupSession();
      };
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access to start a voice consultation.'
          : err instanceof Error
          ? err.message
          : 'Could not start microphone or voice session.';
      setErrorMsg(msg);
      setVoiceState('error');
      cleanupSession();
    }
  };

  const endConversation = () => {
    cleanupSession();
    setVoiceState('idle');
  };

  const sendTextPrompt = (text: string) => {
    const clean = text.trim();
    if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text: clean }));
    appendTranscript('You', clean);
    setTextInput('');
  };

  const handleTextSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendTextPrompt(textInput);
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 px-4 py-3 rounded-full bg-[#171614] hover:bg-[#2E2B27] text-white text-xs font-semibold shadow-lg border border-white/15 transition-colors cursor-pointer"
          aria-label="Open live voice interior consultant"
        >
          <Mic className="w-4 h-4 text-[#D6A676]" />
          <span>Talk to Interior Consultant</span>
        </button>
      )}

      {isOpen && (
        <aside
          className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[400px] bg-white border border-[#E2DDD4] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
          aria-label="Vishwakarma Interior Live Voice Consultant"
        >
          <div className="bg-[#171614] text-white px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-[#D6A676]">
                Vishwakarma Interior · Cuttack Studio Desk
              </p>
              <h3 className="text-base font-semibold leading-snug">
                Live Voice Design Consultant
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                endConversation();
                setIsOpen(false);
              }}
              aria-label="Close voice consultant"
              className="p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-[#F9F8F6]">
            <div className="bg-white border border-[#E2DDD4] rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#171614]">
                  {voiceState === 'connected'
                    ? isSpeaking
                      ? 'Consultant is speaking...'
                      : isMuted
                      ? 'Microphone muted'
                      : 'Listening — speak naturally'
                    : voiceState === 'connecting'
                    ? 'Connecting voice line...'
                    : 'Start a real-time voice call'}
                </span>
                {voiceState === 'connected' && (
                  <span className="text-[11px] font-medium text-[#2D5A3C] flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" />
                    Live Audio
                  </span>
                )}
              </div>

              <p className="text-xs text-[#5C574F] leading-relaxed">
                Ask about modular kitchens, Burma teak wardrobes, Cuttack project timelines, plywood grades, or booking a site measurement with Bipin Kumar.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {voiceState !== 'connected' ? (
                  <button
                    type="button"
                    disabled={voiceState === 'connecting'}
                    onClick={() => void startConversation()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#2D5A3C] hover:bg-[#23472F] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    {voiceState === 'connecting' ? 'Connecting...' : 'Start Voice Call'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsMuted((m) => !m)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        isMuted
                          ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
                          : 'bg-white text-[#171614] border-[#E2DDD4] hover:bg-[#F1EFEA]'
                      }`}
                    >
                      {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      {isMuted ? 'Unmute Mic' : 'Mute Mic'}
                    </button>
                    <button
                      type="button"
                      onClick={endConversation}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#991B1B] hover:bg-[#7F1D1D] rounded-lg transition-colors cursor-pointer"
                    >
                      End Call
                    </button>
                  </>
                )}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B]">
                {errorMsg}
              </div>
            )}

            {voiceState === 'connected' && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-[#5C574F]">Quick spoken/text topics</p>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_TOPICS.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => sendTextPrompt(topic)}
                      className="px-2.5 py-1 text-[11px] bg-white hover:bg-[#EFECE6] border border-[#E2DDD4] rounded-md text-[#171614] cursor-pointer text-left"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {transcripts.length > 0 && (
              <div className="bg-white border border-[#E2DDD4] rounded-lg p-3 space-y-2.5 max-h-52 overflow-y-auto">
                {transcripts.map((item) => (
                  <div key={item.id} className="text-xs leading-relaxed">
                    <span
                      className={`font-semibold ${
                        item.speaker === 'You' ? 'text-[#171614]' : 'text-[#9E6B3B]'
                      }`}
                    >
                      {item.speaker}:{' '}
                    </span>
                    <span className="text-[#5C574F]">{item.text}</span>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>

          {voiceState === 'connected' && (
            <form
              onSubmit={handleTextSubmit}
              className="p-3 bg-white border-t border-[#E2DDD4] flex items-center gap-2"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Or type a quick question..."
                className="flex-1 px-3 py-2 text-xs bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg focus:outline-none focus:border-[#9E6B3B]"
              />
              <button
                type="submit"
                aria-label="Send message"
                className="p-2 rounded-lg bg-[#171614] hover:bg-[#2E2B27] text-white cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          <div className="px-4 py-2.5 bg-[#EFECE6] border-t border-[#E2DDD4] flex items-center justify-between gap-2 text-[11px] text-[#5C574F]">
            <span className="tabular-nums">Direct: {settings.business_phone}</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onBookConsultation();
              }}
              className="font-semibold text-[#9E6B3B] hover:underline cursor-pointer"
            >
              Open Quote Form →
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
