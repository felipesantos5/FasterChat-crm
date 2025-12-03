"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  audioUrl: string;
  transcription?: string;
  isInbound: boolean;
}

export function AudioPlayer({ audioUrl, transcription, isInbound }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
      audio.play();
    }
    setIsPlaying(!isPlaying);
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
          isInbound ? "bg-background/50" : "bg-white/10"
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
            isInbound
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
                isInbound ? "bg-primary" : "bg-white"
              )}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Time */}
          <div className={cn(
            "text-xs",
            isInbound ? "text-muted-foreground" : "text-white/70"
          )}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>

      {/* Transcription */}
      {transcription && (
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
