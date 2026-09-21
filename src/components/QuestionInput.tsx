"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUp, Loader2, Mic, Check, X } from "lucide-react";
import { VoiceInput } from "@/components/ui/voice-input";

interface QuestionInputProps {
  onSubmitQuestion: (question: string) => void;
  isStreaming: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const QuestionInput: React.FC<QuestionInputProps> = ({
  onSubmitQuestion,
  isStreaming,
}) => {
  const [question, setQuestion] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopAllResources = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAllResources();
    };
  }, [stopAllResources]);

  // Timer effect during recording
  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isRecording]);

  const startVoiceRecording = async () => {
    setValidationError(null);
    audioChunksRef.current = [];

    // Authenticate LiveKit room token in background
    fetch("/api/livekit-token", { method: "POST" }).catch(() => {});

    try {
      // 1. Capture microphone audio via MediaRecorder
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250);
      setRecordingSeconds(0);
      setIsRecording(true);

      // 2. Also run browser SpeechRecognition if available for live interim feedback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recognition.onresult = (event: any) => {
            const current = event.resultIndex;
            const transcript = event.results[current][0].transcript;
            if (transcript && transcript.trim()) {
              setQuestion(transcript.trim());
            }
          };

          recognition.onerror = () => {
            // MediaRecorder handles audio capture
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch {
          // MediaRecorder handles capture
        }
      }
    } catch (err) {
      console.error("Microphone access error:", err);
      setValidationError("Microphone permission denied or not available. Please allow mic access in your browser.");
      setIsRecording(false);
    }
  };

  const handleDoneAndTranscribe = async () => {
    setIsRecording(false);

    // Stop Web Speech
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    // Stop MediaRecorder and trigger transcription
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setIsTranscribing(true);

      mediaRecorderRef.current.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        // If Web Speech already populated question text, we can use it
        if (question.trim()) {
          setIsTranscribing(false);
          return;
        }

        // Transcribe audio using Deepgram / Gemini endpoint
        if (audioBlob.size > 1000) {
          try {
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");

            const res = await fetch("/api/transcribe", {
              method: "POST",
              body: formData,
            });
            const data = await res.json();
            if (data.transcript && data.transcript.trim()) {
              setQuestion(data.transcript.trim());
            } else {
              setValidationError("Could not detect clear speech. Please try speaking again or type your question.");
            }
          } catch (err) {
            console.error("Transcription error:", err);
            setValidationError("Voice transcription encountered an issue. Please type your question.");
          } finally {
            setIsTranscribing(false);
          }
        } else {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current.stop();
    } else {
      setIsTranscribing(false);
    }
  };

  const handleCancelRecording = () => {
    stopAllResources();
    setIsRecording(false);
    setIsTranscribing(false);
    audioChunksRef.current = [];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecording) {
      handleDoneAndTranscribe();
      return;
    }

    if (!question.trim()) {
      setValidationError("Ask a question before continuing.");
      return;
    }
    if (isStreaming || isTranscribing) return;

    setValidationError(null);
    onSubmitQuestion(question.trim());
    setQuestion("");
  };

  return (
    <div className="border-t border-white/[0.08] bg-black/80 backdrop-blur-xl p-4 sm:p-5 sticky bottom-0 z-30 transition-colors">
      <div className="max-w-4xl mx-auto space-y-2.5">
        {/* Validation Error Message */}
        {validationError && (
          <div className="text-[11px] text-[#EF4444] font-medium px-2 flex items-center justify-between">
            <span>{validationError}</span>
            <button onClick={() => setValidationError(null)} className="text-neutral-400 hover:text-white">✕</button>
          </div>
        )}

        {/* ACTIVE VOICE RECORDING CONTROL BAR */}
        {isRecording || isTranscribing ? (
          <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] animate-fade-in">
            {/* Left: VoiceInput frequency animation & Timer */}
            <div className="flex items-center gap-3 pl-2">
              <VoiceInput 
                isRecording={isRecording}
                onStop={handleDoneAndTranscribe}
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white tracking-wide">
                    {isTranscribing ? "Transcribing Audio..." : "Voice Recording Active"}
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 hidden sm:inline">
                  {isTranscribing ? "Processing transcription..." : "Speak your question, then click 'OK / Transcribe'"}
                </span>
              </div>
            </div>

            {/* Right: Actions (Cancel & Done/OK) */}
            <div className="flex items-center gap-2 pr-1">
              <button
                type="button"
                onClick={handleCancelRecording}
                disabled={isTranscribing}
                className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-all text-xs"
                title="Cancel voice recording"
              >
                <X className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleDoneAndTranscribe}
                disabled={isTranscribing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-semibold shadow-sm transition-all tactile-btn"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Transcribing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-black" />
                    <span>OK / Transcribe</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD TEXT INPUT WITH VOICEINPUT BUTTON */
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={isStreaming || isTranscribing}
              placeholder={
                isStreaming
                  ? "Answer streaming & verifying claim by claim..."
                  : "Ask a question or click the mic to speak..."
              }
              className="w-full pl-5 pr-28 py-3.5 rounded-full border border-white/10 bg-white/[0.03] text-sm text-white placeholder-white/40 focus:outline-hidden focus:border-white/40 focus:ring-1 focus:ring-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.5)] disabled:opacity-50 transition-all font-sans"
            />

            <div className="absolute right-2 flex items-center gap-1.5">
              {/* VoiceInput Mic Button */}
              <VoiceInput
                onStart={startVoiceRecording}
                isRecording={false}
              />

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!question.trim() || isStreaming || isTranscribing}
                aria-label="Submit Question"
                className="p-2.5 rounded-full bg-white text-black hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-white transition-all tactile-btn flex items-center justify-center shadow-sm"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : (
                  <ArrowUp className="w-4 h-4 text-black" />
                )}
              </button>
            </div>
          </form>
        )}

        {/* Streaming feedback note */}
        {isStreaming && (
          <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-subtle-pulse" />
            <span>Streaming answer tokens · Executing independent Moss queries per sentence</span>
          </div>
        )}
      </div>
    </div>
  );
};