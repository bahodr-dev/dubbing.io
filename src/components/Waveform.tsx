import React, { useEffect, useRef } from 'react';

interface WaveformProps {
  isPlaying?: boolean;
  progress?: number; // 0 to 1
  barsCount?: number;
  height?: number;
  color?: 'black' | 'white';
  interactive?: boolean;
  onSeek?: (progress: number) => void;
  seed?: number;
}

export const Waveform: React.FC<WaveformProps> = ({
  isPlaying = false,
  progress = 0,
  barsCount = 48,
  height = 36,
  color = 'black',
  interactive = false,
  onSeek,
  seed = 42,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Generate deterministic bar heights based on seed
  const heights = React.useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < barsCount; i++) {
      // Natural speech envelope with varying peaks and quiet pauses
      const x = i / barsCount;
      const envelope = Math.sin(x * Math.PI) * 0.7 + 0.3;
      const pseudoNoise = ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1;
      const barHeight = Math.max(0.15, Math.min(1.0, envelope * (0.3 + pseudoNoise * 0.7)));
      arr.push(barHeight);
    }
    return arr;
  }, [barsCount, seed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let tick = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const canvasHeight = height;

      if (canvas.width !== width * dpr || canvas.height !== canvasHeight * dpr) {
        canvas.width = width * dpr;
        canvas.height = canvasHeight * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, canvasHeight);

      const totalBars = heights.length;
      const barWidth = Math.max(2, (width / totalBars) * 0.6);
      const gap = (width - barWidth * totalBars) / Math.max(1, totalBars - 1);

      const activeColor = color === 'black' ? '#000000' : '#ffffff';
      const inactiveColor = color === 'black' ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.25)';

      for (let i = 0; i < totalBars; i++) {
        const x = i * (barWidth + gap);
        const barNormalized = heights[i];
        
        // Add subtle wave oscillation when playing
        let animatedFactor = barNormalized;
        if (isPlaying) {
          const wave = Math.sin(tick * 0.15 + i * 0.4) * 0.25;
          animatedFactor = Math.max(0.15, Math.min(1.0, barNormalized + wave));
        }

        const barPxHeight = Math.max(3, animatedFactor * (canvasHeight - 6));
        const y = (canvasHeight - barPxHeight) / 2;

        const isPastProgress = (i / totalBars) <= progress;
        ctx.fillStyle = isPastProgress ? activeColor : inactiveColor;

        // Draw crisp rectangle bar
        ctx.fillRect(x, y, barWidth, barPxHeight);
      }

      ctx.restore();

      if (isPlaying) {
        tick++;
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, progress, height, color, heights]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !onSeek || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(newProgress);
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        width: '100%',
        height: `${height}px`,
        display: 'block',
        cursor: interactive ? 'pointer' : 'default',
      }}
    />
  );
};
