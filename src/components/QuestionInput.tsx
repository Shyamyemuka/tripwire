"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ArrowUp, Loader2, X } from "lucide-react";
import { VoiceInput } from "@/components/ui/voice-input";

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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopAllResources = useCallback(() => {
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
    <div className="glass-nav border-t border-white/15 bg-black/60 backdrop-blur-2xl p-4 sm:p-5 sticky bottom-0 z-30 transition-colors">
      <div className="max-w-4xl mx-auto space-y-2.5">
        {/* Validation Error Message */}
        {validationError && (
          <div className="text-[11px] text-[#EF4444] font-medium px-2 flex items-center justify-between">
            <span>{validationError}</span>
            <button onClick={() => setValidationError(null)} className="text-neutral-400 hover:text-white">✕</button>
          </div>
        )}

        {/* ACTIVE VOICE RECORDING / TRANSCRIBING CONTROL BAR */}
        {isRecording || isTranscribing ? (
          <div className="flex items-center justify-center p-2 rounded-full glass-panel border border-white/20 shadow-2xl animate-fade-in">
            {isTranscribing ? (
              <div className="flex items-center gap-2.5 px-4 py-1 text-xs text-neutral-300 font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Transcribing audio...</span>
                <button
                  type="button"
                  onClick={handleCancelRecording}
                  className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
                  title="Cancel transcription"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <VoiceInput
                isRecording={isRecording}
                onStop={handleDoneAndTranscribe}
                onCancel={handleCancelRecording}
              />
            )}
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
              className="w-full pl-5 pr-28 py-3.5 rounded-full border border-white/20 bg-white/[0.05] backdrop-blur-xl text-sm text-white placeholder-white/40 focus:outline-hidden focus:border-white/50 focus:ring-1 focus:ring-white/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] disabled:opacity-50 transition-all font-sans"
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