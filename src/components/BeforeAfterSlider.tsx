import { useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import { ResilientImage } from './ResilientImage.tsx';

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  title: string;
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  title,
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(52);
  const [mode, setMode] = useState<'split' | 'side-by-side'>('split');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-[#5C574F] font-medium">
          Site Transformation Comparison
        </div>
        <div className="inline-flex items-center gap-1 p-1 bg-[#EFECE6] rounded-lg border border-[#E2DDD4]">
          <button
            type="button"
            onClick={() => setMode('split')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'split'
                ? 'bg-white text-[#171614] shadow-xs'
                : 'text-[#5C574F] hover:text-[#171614]'
            }`}
          >
            Interactive Slider
          </button>
          <button
            type="button"
            onClick={() => setMode('side-by-side')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'side-by-side'
                ? 'bg-white text-[#171614] shadow-xs'
                : 'text-[#5C574F] hover:text-[#171614]'
            }`}
          >
            Side by Side
          </button>
        </div>
      </div>

      {mode === 'split' ? (
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] overflow-hidden rounded-xl border border-[#E2DDD4] bg-[#ECE8E1] select-none">
          <ResilientImage
            src={afterImage}
            alt={`${title} completed interior`}
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
            <ResilientImage
              src={beforeImage}
              alt={`${title} before renovation`}
              className="w-full h-full object-cover"
            />
          </div>

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md pointer-events-none"
            style={{ left: `${position}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white text-[#171614] border border-[#E2DDD4] shadow-md flex items-center justify-center">
              <MoveHorizontal className="w-4 h-4" />
            </div>
          </div>

          <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-[#171614]/80 text-white text-xs font-medium rounded">
            Before Work
          </div>
          <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-[#171614]/80 text-white text-xs font-medium rounded">
            Completed Interior
          </div>

          <input
            type="range"
            min={5}
            max={95}
            value={position}
            aria-label="Before and after comparison slider"
            onChange={(e) => setPosition(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="aspect-[4/3] overflow-hidden rounded-xl border border-[#E2DDD4] bg-[#ECE8E1]">
              <ResilientImage
                src={beforeImage}
                alt={`${title} before renovation`}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs font-medium text-[#5C574F]">
              Before — Bare Site Condition
            </p>
          </div>
          <div className="space-y-2">
            <div className="aspect-[4/3] overflow-hidden rounded-xl border border-[#E2DDD4] bg-[#ECE8E1]">
              <ResilientImage
                src={afterImage}
                alt={`${title} completed interior`}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs font-medium text-[#171614]">
              After — Completed Handover
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
