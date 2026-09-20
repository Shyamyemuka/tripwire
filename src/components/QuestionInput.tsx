"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Loader2, Mic, MicOff } from "lucide-react";

interface QuestionInputProps {
  onSubmitQuestion: (question: string) => void;
  isStreaming: boolean;
}

export const QuestionInput: React.FC<QuestionInputProps> = ({
  onSubmitQuestion,
  isStreaming,
}) => {
  const [question, setQuestion] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopRecordingResources();
    };
  }, []);

  const stopRecordingResources = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
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
  };

  const handleStopListening = async () => {
    setIsListening(false);

    // Stop Web Speech
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    // Stop MediaRecorder and transcribe if needed
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const toggleVoiceInput = async () => {
    if (isListening) {
      handleStopListening();
      return;
    }

    setValidationError(null);
    audioChunksRef.current = [];

    // Authenticate LiveKit room token in background
    fetch("/api/livekit-token", { method: "POST" }).catch(() => {});

    try {
      // 1. Request microphone access via getUserMedia (works 100% in Brave, Chrome, Edge, Safari, Firefox)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        // If Web Speech already populated question text, we're done
        if (question.trim()) {
          return;
        }

        // If Web Speech was blocked (e.g. in Brave browser), use fast server-side Gemini transcription
        if (audioBlob.size > 2000) {
          setIsTranscribing(true);
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
            }
          } catch (err) {
            console.error("Transcription error:", err);
          } finally {
            setIsTranscribing(false);
          }
        }
      };

      mediaRecorder.start(250);
      setIsListening(true);

      // 2. Also try Web Speech API for real-time live typing preview if available
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
            if (transcript) {
              setQuestion(transcript);
            }
          };

          recognition.onerror = () => {
            // Non-fatal: MediaRecorder handles the audio
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch {
          // MediaRecorder handles audio capture
        }
      }
    } catch (err) {
      console.error("Microphone access error:", err);
      setValidationError("Microphone permission denied or not available. Please allow mic access in your browser.");
      setIsListening(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) {
      handleStopListening();
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
          <div className="text-[11px] text-[#EF4444] font-medium px-2">
            {validationError}
          </div>
        )}

        {/* Input Container */}
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (validationError) setValidationError(null);
            }}
            disabled={isStreaming}
            placeholder={
              isListening
                ? "Listening... speak your question..."
                : isStreaming
                ? "Answer streaming & verifying claim by claim..."
                : "Ask a question about this document..."
            }
            className={`w-full pl-5 pr-24 py-3.5 rounded-full border bg-white/[0.03] text-sm text-white placeholder-white/40 focus:outline-hidden focus:ring-1 shadow-[0_4px_20px_rgba(0,0,0,0.5)] disabled:opacity-50 transition-all font-sans ${
              isListening
                ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-950/10"
                : "border-white/10 focus:border-white/40 focus:ring-white/20"
            }`}
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            {/* LiveKit Voice Input Trigger */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={isStreaming}
              title={isListening ? "Stop listening" : "Voice input (LiveKit)"}
              className={`p-2 rounded-full transition-all flex items-center justify-center ${
                isListening
                  ? "bg-rose-500 text-white animate-pulse"
                  : "bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white"
              }`}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!question.trim() || isStreaming}
              aria-label="Submit Question"
              className="p-2 rounded-full bg-white text-black hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-white transition-all tactile-btn flex items-center justify-center shadow-sm"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <ArrowUp className="w-4 h-4 text-black" />
              )}
            </button>
          </div>
        </form>

        {/* Live status feedback note */}
        {isListening && (
          <div className="flex items-center justify-center gap-2 text-[11px] text-rose-400 font-mono animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>LiveKit Audio Stream Active · Speak now</span>
          </div>
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