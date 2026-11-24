import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Phone,
  X,
} from 'lucide-react';
import type { BusinessSettings, Project } from '../types.ts';
import { BeforeAfterSlider } from './BeforeAfterSlider.tsx';
import { ResilientImage } from './ResilientImage.tsx';

interface ProjectDetailViewProps {
  project: Project;
  settings: BusinessSettings;
  onBack: () => void;
  onInquireProject: (project: Project) => void;
}

export function ProjectDetailView({
  project,
  settings,
  onBack,
  onInquireProject,
}: ProjectDetailViewProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const allPhotos = Array.from(
    new Set([project.after_image, ...project.gallery_images, project.before_image].filter(Boolean))
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev === null ? null : (prev + 1) % allPhotos.length));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev - 1 + allPhotos.length) % allPhotos.length
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, allPhotos.length]);

  const whatsappText = encodeURIComponent(
    `Hello Bipin Kumar (Vishwakarma Interior Services Centre), I viewed your "${project.title}" project in ${project.location_name} and would like to discuss a similar project.`
  );
  const whatsappUrl = `https://wa.me/${settings.whatsapp_number}?text=${whatsappText}`;
  const telHref = `tel:${settings.business_phone.replace(/\s+/g, '')}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#5C574F] hover:text-[#171614] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Projects
        </button>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C574F]">
          <span className="font-semibold text-[#9E6B3B]">{project.work_type}</span>
          <span aria-hidden="true">·</span>
          <span>{project.location_name}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">Completed {project.completion_date}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#171614] tracking-tight leading-tight max-w-4xl">
          {project.title}
        </h1>
        <p className="text-base sm:text-lg text-[#5C574F] leading-relaxed max-w-3xl">
          {project.summary}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-y border-[#E2DDD4]">
        <div>
          <p className="text-xs text-[#5C574F]">Location</p>
          <p className="text-sm font-semibold text-[#171614] mt-1">{project.location_name}</p>
        </div>
        <div>
          <p className="text-xs text-[#5C574F]">Completion Date</p>
          <p className="text-sm font-semibold text-[#171614] mt-1 tabular-nums">{project.completion_date}</p>
        </div>
        <div>
          <p className="text-xs text-[#5C574F]">Built Area</p>
          <p className="text-sm font-semibold text-[#171614] mt-1 tabular-nums">
            {project.area_sqft || 'Custom Scope'}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#5C574F]">Execution Timeline</p>
          <p className="text-sm font-semibold text-[#171614] mt-1 tabular-nums">
            {project.duration_weeks || 'Turnkey Schedule'}
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[#171614]">Before &amp; After Transformation</h2>
            <p className="text-sm text-[#5C574F] mt-1">
              Drag the divider to compare the original bare site condition with the completed handover.
            </p>
          </div>
        </div>
        <BeforeAfterSlider
          beforeImage={project.before_image}
          afterImage={project.after_image}
          title={project.title}
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-[#171614]">Project Photo Gallery</h2>
          <span className="text-xs text-[#5C574F] tabular-nums">{allPhotos.length} photographs</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allPhotos.map((imgUrl, idx) => (
            <button
              key={`${imgUrl}-${idx}`}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className="group aspect-[4/3] rounded-xl overflow-hidden border border-[#E2DDD4] bg-[#ECE8E1] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E6B3B]"
            >
              <ResilientImage
                src={imgUrl}
                alt={`${project.title} photograph ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-[#E2DDD4]">
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-2xl font-semibold text-[#171614]">Materials, Craftsmanship &amp; Execution</h2>
          <p className="text-sm sm:text-base text-[#5C574F] leading-relaxed">
            {project.scope_details || project.summary}
          </p>
          {project.client_name && (
            <p className="text-sm text-[#171614] pt-2">
              <span className="text-[#5C574F]">Client / Residence: </span>
              <span className="font-medium">{project.client_name}</span>
            </p>
          )}
          <div className="pt-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${project.lat},${project.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#9E6B3B] hover:underline"
            >
              View {project.location_name} on Google Maps
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E2DDD4] rounded-xl p-6 space-y-4 h-fit">
          <h3 className="text-xl font-semibold text-[#171614]">
            Planning a similar project in {project.city}?
          </h3>
          <p className="text-sm text-[#5C574F] leading-relaxed">
            Speak directly with Bipin Kumar for a site visit, material samples, and an itemized woodworking or turnkey estimate.
          </p>
          <div className="flex flex-col gap-3 pt-1">
            <button
              type="button"
              onClick={() => onInquireProject(project)}
              className="w-full px-5 py-3 text-sm font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg transition-colors cursor-pointer"
            >
              Request Estimate for Similar Work
            </button>
            <div className="grid grid-cols-2 gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#2D5A3C] hover:bg-[#23472F] rounded-lg transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp Chat
              </a>
              <a
                href={telHref}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#171614] bg-[#F1EFEA] hover:bg-[#E5E1D8] border border-[#E2DDD4] rounded-lg transition-colors whitespace-nowrap"
              >
                <Phone className="w-4 h-4" />
                Call Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Project photograph viewer"
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close photograph viewer"
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {allPhotos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((lightboxIndex - 1 + allPhotos.length) % allPhotos.length)
                }
                aria-label="Previous photograph"
                className="absolute left-4 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxIndex((lightboxIndex + 1) % allPhotos.length)}
                aria-label="Next photograph"
                className="absolute right-4 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div className="max-w-5xl w-full max-h-[85vh] flex flex-col items-center gap-3">
            <img
              src={allPhotos[lightboxIndex]}
              alt={`${project.title} full view ${lightboxIndex + 1}`}
              referrerPolicy="no-referrer"
              className="max-h-[78vh] w-auto object-contain rounded-lg"
            />
            <div className="text-xs text-white/80 tabular-nums">
              {project.title} · Photo {lightboxIndex + 1} of {allPhotos.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
