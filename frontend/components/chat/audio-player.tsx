"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  audioUrl: string;
  transcription?: string;
  isInbound: boolean;
  isFlow?: boolean;
}

const PLAYBACK_SPEEDS = [1, 1.5, 2] as const;

export function AudioPlayer({ audioUrl, transcription, isInbound, isFlow }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.playbackRate = PLAYBACK_SPEEDS[speedIndex];
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const cycleSpeed = () => {
    const audio = audioRef.current;
    const nextIndex = (speedIndex + 1) % PLAYBACK_SPEEDS.length;
    setSpeedIndex(nextIndex);
    if (audio) {
      audio.playbackRate = PLAYBACK_SPEEDS[nextIndex];
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Audio Player */}
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg min-w-[240px]",
          isInbound || isFlow ? "bg-background/50" : "bg-white/10"
        )}
      >
        <audio ref={audioRef} src={audioUrl} preload="metadata" />

        {/* Play/Pause Button */}
        <Button
          size="icon"
          variant="ghost"
          onClick={togglePlay}
          className={cn(
            "h-8 w-8 rounded-full flex-shrink-0",
            isInbound || isFlow
              ? "hover:bg-primary/10"
              : "hover:bg-white/20 text-white"
          )}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" fill="currentColor" />
          ) : (
            <Play className="h-4 w-4" fill="currentColor" />
          )}
        </Button>

        {/* Waveform / Progress Bar */}
        <div className="flex-1 space-y-1">
          {/* Progress Bar */}
          <div className="relative h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={cn(
                "absolute h-full transition-all duration-100",
                isInbound || isFlow ? "bg-primary" : "bg-white"
              )}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Time + Speed */}
          <div className="flex items-center justify-between">
            <div className={cn(
              "text-xs",
              isInbound || isFlow ? "text-muted-foreground" : "text-white/70"
            )}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <button
              type="button"
              onClick={cycleSpeed}
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors",
                isInbound || isFlow
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "bg-white/15 text-white hover:bg-white/25"
              )}
            >
              {PLAYBACK_SPEEDS[speedIndex]}x
            </button>
          </div>
        </div>
      </div>

      {/* Transcription — apenas para áudios recebidos */}
      {transcription && isInbound && (
        <div
          className={cn(
            "text-xs p-2 rounded-md italic border-l-2",
            isInbound
              ? "bg-muted/50 border-primary/50 text-muted-foreground"
              : "bg-white/5 border-white/30 text-white/70"
          )}
        >
          <span className="font-medium not-italic">Transcrição: </span>
          {transcription}
        </div>
      )}
    </div>
  );
}
