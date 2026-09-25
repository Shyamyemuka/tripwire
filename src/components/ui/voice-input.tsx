"use client"

import React from "react"
import { Mic, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"

interface VoiceInputProps {
  onStart?: () => void
  onStop?: () => void
  onCancel?: () => void
  isRecording?: boolean
}

export function VoiceInput({
  className,
  onStart,
  onStop,
  onCancel,
  isRecording,
  ...props
}: React.ComponentProps<"div"> & VoiceInputProps) {
  const [internalListening, setInternalListening] = React.useState<boolean>(false)
  const [_time, _setTime] = React.useState<number>(0)

  const listening = isRecording !== undefined ? isRecording : internalListening

  React.useEffect(() => {
    if (!listening) {
      return
    }

    const intervalId = setInterval(() => {
      _setTime((t) => t + 1)
    }, 1000)

    return () => {
      clearInterval(intervalId)
      _setTime(0)
    }
  }, [listening])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const onClickHandler = () => {
    if (listening) {
      onStop?.()
      if (isRecording === undefined) setInternalListening(false)
    } else {
      onStart?.()
      if (isRecording === undefined) setInternalListening(true)
    }
  }

  return (
    <div className={cn("flex flex-col items-center justify-center", className)} {...props}>
      <motion.div
        className="flex p-2 border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] items-center justify-center rounded-full cursor-pointer transition-colors shadow-sm"
        layout
        transition={{
          layout: {
            duration: 0.4,
          },
        }}
        onClick={onClickHandler}
      >
        <div className="h-6 w-6 items-center justify-center flex text-white">
          {listening ? (
            <motion.div
              className="w-3.5 h-3.5 bg-rose-500 rounded-xs shadow-xs"
              animate={{
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
          ) : (
            <Mic className="w-4 h-4 text-neutral-300 hover:text-white" />
          )}
        </div>
        <AnimatePresence mode="wait">
          {listening && (
            <motion.div
              initial={{ opacity: 0, width: 0, marginLeft: 0 }}
              animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
              exit={{ opacity: 0, width: 0, marginLeft: 0 }}
              transition={{
                duration: 0.4,
              }}
              className="overflow-hidden flex gap-2.5 items-center justify-center pr-1"
            >
              {/* Frequency Animation */}
              <div className="flex gap-0.5 items-center justify-center">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 bg-primary rounded-full"
                    initial={{ height: 2 }}
                    animate={{
                      height: listening
                        ? [2, 3 + ((i * 7) % 11), 3 + ((i * 5) % 8), 2]
                        : 2,
                    }}
                    transition={{
                      duration: listening ? 1 : 0.3,
                      repeat: listening ? Infinity : 0,
                      delay: listening ? i * 0.05 : 0,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
              {/* Timer */}
              <div className="text-xs font-mono text-muted-foreground w-10 text-center">
                {formatTime(_time)}
              </div>
              {/* Cancel Button */}
              {onCancel && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCancel()
                    if (isRecording === undefined) setInternalListening(false)
                  }}
                  className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
                  title="Cancel transcription"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
