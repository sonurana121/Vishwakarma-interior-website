import { ArrowUpRight } from 'lucide-react';
import type { Project } from '../types.ts';
import { ResilientImage } from './ResilientImage.tsx';

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
}

export function ProjectCard({ project, onSelect }: ProjectCardProps) {
  return (
    <article className="group bg-white border border-[#E2DDD4] rounded-xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#C9C1B4]">
      <button
        type="button"
        onClick={() => onSelect(project)}
        className="text-left flex flex-col h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E6B3B]"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#ECE8E1]">
          <ResilientImage
            src={project.after_image}
            alt={`${project.title} in ${project.location_name}`}
            fallbackTitle={project.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-[#171614]/80 text-white text-[11px] font-medium rounded">
            Before &amp; After · {project.gallery_images.length} Photos
          </div>
        </div>

        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5C574F]">
              <span className="font-medium text-[#9E6B3B]">{project.work_type}</span>
              <span aria-hidden="true">·</span>
              <span>{project.location_name}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{project.completion_date}</span>
            </div>

            <h3 className="text-lg font-semibold text-[#171614] leading-snug group-hover:text-[#9E6B3B] transition-colors">
              {project.title}
            </h3>

            <p className="text-sm text-[#5C574F] leading-relaxed line-clamp-2">
              {project.summary}
            </p>
          </div>

          <div className="pt-3 border-t border-[#EFECE6] flex items-center justify-between text-xs font-medium text-[#171614]">
            <span className="tabular-nums text-[#5C574F]">
              {project.area_sqft ? `${project.area_sqft} · ` : ''}{project.duration_weeks || 'Turnkey Delivery'}
            </span>
            <span className="inline-flex items-center gap-1 text-[#9E6B3B] whitespace-nowrap shrink-0">
              View Project
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}
