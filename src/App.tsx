import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Compass,
  Hammer,
  Menu,
  MessageCircle,
  Mic,
  Phone,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { BeforeAfterSlider } from './components/BeforeAfterSlider.tsx';
import { BrandMark } from './components/BrandMark.tsx';
import { InquirySection } from './components/InquirySection.tsx';
import { ProjectCard } from './components/ProjectCard.tsx';
import { ProjectDetailView } from './components/ProjectDetailView.tsx';
import { ProjectLocationsMap } from './components/ProjectLocationsMap.tsx';
import { ResilientImage } from './components/ResilientImage.tsx';
import { VoiceConsultant } from './components/VoiceConsultant.tsx';
import {
  DEFAULT_LOCATIONS,
  DEFAULT_PROJECTS,
  DEFAULT_SERVICES,
  DEFAULT_SETTINGS,
} from './data/seedCatalog.ts';
import { auth } from './lib/firebase.ts';
import { fetchPublicCatalog } from './lib/firestoreStore.ts';
import type {
  BusinessSettings,
  Project,
  ProjectLocation,
  ServiceItem,
} from './types.ts';

type RouteView =
  | { page: 'home' }
  | { page: 'projects' }
  | { page: 'project-detail'; slug: string }
  | { page: 'locations' }
  | { page: 'services' }
  | { page: 'about' }
  | { page: 'contact' }
  | { page: 'admin' };

function parseRoute(pathname: string): RouteView {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/admin') return { page: 'admin' };
  if (clean === '/projects') return { page: 'projects' };
  if (clean.startsWith('/projects/')) {
    const slug = decodeURIComponent(clean.slice('/projects/'.length));
    if (slug) return { page: 'project-detail', slug };
  }
  if (clean === '/locations') return { page: 'locations' };
  if (clean === '/services') return { page: 'services' };
  if (clean === '/about') return { page: 'about' };
  if (clean === '/contact') return { page: 'contact' };
  return { page: 'home' };
}

const TESTIMONIALS = [
  {
    name: 'Subrat Patnaik',
    role: 'Homeowner · Badambadi, Cuttack',
    project: 'Walnut & Quartz Modular Kitchen',
    quote:
      'Our old kitchen suffered from moisture damage and cramped counter space. Bipin Kumar replaced every unit with waterproof HDHMR carcasses, quartz island counters, and soft-close drawers in four weeks—finished exactly as promised.',
  },
  {
    name: 'Dr. R. K. Panda',
    role: 'Homeowner · College Square, Cuttack',
    project: 'Master Suite & Fluted Teak Wardrobe',
    quote:
      'We needed floor-to-ceiling wardrobes that blended with our family home architecture. The carpentry team crafted fluted Burma teak shutters with zero visible gaps and delivered clean electrical cove lighting.',
  },
  {
    name: 'CA Niranjan Sahoo',
    role: 'Managing Partner · Sahoo & Associates, Link Road',
    project: 'Executive Office & Boardroom',
    quote:
      'Our client meeting room had severe street-noise echo. Vishwakarma Interior installed acoustic oak slat paneling and custom walnut desks on schedule over a single month without disrupting our practice.',
  },
];

const WORKING_PROCESS = [
  {
    step: '01.',
    title: 'Site Visit & Laser Measurement',
    detail:
      'Bipin Kumar personally inspects your home or office in Cuttack and nearby areas to record wall plumb, electrical points, plumbing lines, and sunlight orientation.',
  },
  {
    step: '02.',
    title: 'Layout Planning & Material Selection',
    detail:
      'Review floor layouts, seasoned teak samples, BWR 710 plywood cores, veneers, laminates, and Hettich/Ebco hardware with a transparent, itemized estimate.',
  },
  {
    step: '03.',
    title: 'Madhupatna Workshop Fabrication',
    detail:
      'Modular shutters, custom furniture, and solid wood joinery are precision-built at our Cuttack facility to minimize dust and noise inside your home.',
  },
  {
    step: '04.',
    title: 'On-Site Installation & Handover',
    detail:
      'Trained carpenters complete fitting, false ceiling lighting, and satin PU polishing followed by a room-by-room hardware alignment check before handover.',
  },
];

export default function App() {
  const [route, setRoute] = useState<RouteView>(() => parseRoute(window.location.pathname));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS);
  const [locations, setLocations] = useState<ProjectLocation[]>(DEFAULT_LOCATIONS);
  const [services, setServices] = useState<ServiceItem[]>(DEFAULT_SERVICES);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [mapsApiKey, setMapsApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [voiceOpenSignal, setVoiceOpenSignal] = useState(0);

  const [workTypeFilter, setWorkTypeFilter] = useState<string>('All');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('All');
  const [inquiryPreselectService, setInquiryPreselectService] = useState<string>('');
  const [inquiryPreselectProjectSlug, setInquiryPreselectProjectSlug] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const fetchBootstrap = useCallback(async () => {
    try {
      const [catalog, configResp] = await Promise.all([
        fetchPublicCatalog(),
        fetch('/api/config').catch(() => null),
      ]);
      setProjects(catalog.projects);
      setLocations(catalog.locations);
      setServices(catalog.services);
      setSettings(catalog.settings);
      if (configResp && configResp.ok) {
        const cfg = (await configResp.json()) as { mapsApiKey?: string };
        setMapsApiKey(cfg.mapsApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');
      } else {
        setMapsApiKey(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');
      }
    } catch {
      // Keep default catalog if offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady) {
      void fetchBootstrap();
    }
  }, [authReady, fetchBootstrap]);

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRoute(window.location.pathname));
      setMobileMenuOpen(false);
    };
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
    };
  }, []);

  const navigate = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setRoute(parseRoute(path));
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openProjectDetail = useCallback(
    (project: Project) => {
      navigate(`/projects/${encodeURIComponent(project.slug)}`);
    },
    [navigate]
  );

  const selectedProject = useMemo(() => {
    if (route.page !== 'project-detail') return null;
    return projects.find((p) => p.slug === route.slug) ?? null;
  }, [route, projects]);

  useEffect(() => {
    if (route.page === 'project-detail' && selectedProject) {
      document.title = `${selectedProject.title} | Vishwakarma Interior Cuttack`;
    } else if (route.page === 'projects') {
      document.title = 'Completed Projects & Portfolio | Vishwakarma Interior Cuttack';
    } else if (route.page === 'locations') {
      document.title = 'Project Locations in Cuttack & Odisha | Vishwakarma Interior';
    } else if (route.page === 'services') {
      document.title = 'Interior Design & Carpentry Services | Vishwakarma Interior Cuttack';
    } else if (route.page === 'about') {
      document.title = 'About Bipin Kumar | Vishwakarma Interior Services Centre';
    } else if (route.page === 'contact') {
      document.title = 'Contact & Free Quote | Vishwakarma Interior Services Centre';
    } else if (route.page === 'admin') {
      document.title = 'Owner Admin Dashboard | Vishwakarma Interior';
    } else {
      document.title = 'Vishwakarma Interior | Custom Interiors & Furniture Cuttack';
    }
  }, [route, selectedProject]);

  const workTypes = useMemo(() => {
    const types = Array.from(new Set(projects.map((p) => p.work_type)));
    return ['All', ...types];
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (workTypeFilter === 'All') return projects;
    return projects.filter((p) => p.work_type === workTypeFilter);
  }, [projects, workTypeFilter]);

  const featuredProjects = useMemo(() => {
    const feat = projects.filter((p) => p.featured);
    return feat.length > 0 ? feat.slice(0, 6) : projects.slice(0, 6);
  }, [projects]);

  const filteredServices = useMemo(() => {
    if (serviceCategoryFilter === 'All') return services;
    return services.filter((s) => s.category === serviceCategoryFilter);
  }, [services, serviceCategoryFilter]);

  const handleRequestQuoteForService = (serviceTitle: string) => {
    setInquiryPreselectService(serviceTitle);
    setInquiryPreselectProjectSlug(null);
    navigate('/contact');
  };

  const handleInquireAboutProject = (project: Project) => {
    setInquiryPreselectService(project.work_type);
    setInquiryPreselectProjectSlug(project.slug);
    navigate('/contact');
  };

  const cleanWhatsapp = settings.whatsapp_number.replace(/\D/g, '');
  const whatsappDirectUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
    'Hello Bipin Kumar (Vishwakarma Interior Services Centre), I would like to discuss an interior design or furniture project.'
  )}`;
  const telHref = `tel:${settings.business_phone.replace(/\s+/g, '')}`;

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F8F6] text-[#171614]">
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#F9F8F6]/95 backdrop-blur-sm border-b border-[#E2DDD4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            className="inline-flex items-center gap-2.5 text-lg font-display font-semibold tracking-tight text-[#171614] whitespace-nowrap shrink-0"
          >
            <BrandMark className="w-6 h-6 text-[#171614]" />
            <span>Vishwakarma Interior</span>
          </a>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#5C574F]" aria-label="Primary navigation">
            {(
              [
                ['/projects', 'Projects', 'projects'],
                ['/locations', 'Locations', 'locations'],
                ['/services', 'Services', 'services'],
                ['/about', 'About', 'about'],
                ['/admin', 'Admin', 'admin'],
              ] as const
            ).map(([path, label, key]) => (
              <a
                key={path}
                href={path}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(path);
                }}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#171614] ${
                  route.page === key ? 'text-[#171614] underline underline-offset-4 decoration-[#9E6B3B] decoration-2' : ''
                }`}
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Zone 3: 1 primary CTA + Mobile Drawer Trigger */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/contact')}
              className="hidden sm:inline-flex px-4 py-2 text-xs font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Book Consultation
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-lg border border-[#E2DDD4] bg-white text-[#171614] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E2DDD4] bg-white px-4 py-4 space-y-2">
            {(
              [
                ['/', 'Home'],
                ['/projects', 'Completed Projects'],
                ['/locations', 'Project Locations'],
                ['/services', 'Our Services'],
                ['/about', 'About Us'],
                ['/contact', 'Contact & Free Quote'],
                ['/admin', 'Owner Admin'],
              ] as const
            ).map(([path, label]) => (
              <a
                key={path}
                href={path}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(path);
                }}
                className="block py-2 px-3 rounded-lg text-sm font-medium text-[#171614] hover:bg-[#F1EFEA]"
              >
                {label}
              </a>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1">
        {route.page === 'admin' ? (
          <AdminDashboard
            onDataChanged={() => void fetchBootstrap()}
            onExitAdmin={() => navigate('/')}
          />
        ) : route.page === 'project-detail' ? (
          selectedProject ? (
            <ProjectDetailView
              project={selectedProject}
              settings={settings}
              onBack={() => navigate('/projects')}
              onInquireProject={handleInquireAboutProject}
            />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
              <h1 className="text-2xl font-semibold text-[#171614]">
                {loading ? 'Loading Project Details...' : 'Project Not Found'}
              </h1>
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#171614] rounded-lg cursor-pointer"
              >
                Browse All Completed Projects
              </button>
            </div>
          )
        ) : route.page === 'projects' ? (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
            <div className="space-y-3 max-w-3xl">
              <p className="text-xs font-semibold text-[#9E6B3B]">
                Portfolio · Cuttack &amp; Odisha Completed Works
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-[#171614] tracking-tight leading-tight">
                Completed Interior &amp; Carpentry Projects
              </h1>
              <p className="text-base text-[#5C574F] leading-relaxed">
                Explore real residential and commercial interiors executed by Vishwakarma Interior Services Centre, complete with before-and-after site transformations, materials, and neighborhood locations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {workTypes.map((wt) => (
                <button
                  key={wt}
                  type="button"
                  onClick={() => setWorkTypeFilter(wt)}
                  className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    workTypeFilter === wt
                      ? 'bg-[#171614] text-white border-[#171614]'
                      : 'bg-white text-[#5C574F] border-[#E2DDD4] hover:text-[#171614]'
                  }`}
                >
                  {wt}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} onSelect={openProjectDetail} />
              ))}
            </div>
          </section>
        ) : route.page === 'locations' ? (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
            <div className="space-y-3 max-w-3xl">
              <p className="text-xs font-semibold text-[#9E6B3B]">
                Service Footprint · Cuttack &amp; Nearby Areas
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-[#171614] tracking-tight leading-tight">
                Completed Project Locations Map
              </h1>
              <p className="text-base text-[#5C574F] leading-relaxed">
                Click any neighborhood marker on the map or filter by Cuttack area to inspect completed interior projects and photographs near you.
              </p>
            </div>

            <ProjectLocationsMap
              mapsApiKey={mapsApiKey}
              locations={locations}
              projects={projects}
              onSelectProject={openProjectDetail}
            />
          </section>
        ) : route.page === 'services' ? (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
            <div className="space-y-3 max-w-3xl">
              <p className="text-xs font-semibold text-[#9E6B3B]">
                Craftsmanship &amp; Turnkey Execution
              </p>
              <h1 className="text-3xl sm:text-5xl font-semibold text-[#171614] tracking-tight leading-tight">
                Interior Design, Modular &amp; Carpentry Services
              </h1>
              <p className="text-base text-[#5C574F] leading-relaxed">
                From full-home turnkey interiors and modular kitchens to bespoke Burma teak furniture manufactured in our Madhupatna workshop.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['All', 'Turnkey Interiors', 'Woodwork & Furniture', 'Architectural Finishes'] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setServiceCategoryFilter(cat)}
                    className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      serviceCategoryFilter === cat
                        ? 'bg-[#171614] text-white border-[#171614]'
                        : 'bg-white text-[#5C574F] border-[#E2DDD4] hover:text-[#171614]'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredServices.map((srv, idx) => (
                <article
                  key={srv.id}
                  className="bg-white border border-[#E2DDD4] rounded-xl overflow-hidden grid grid-cols-1 sm:grid-cols-12"
                >
                  <div className="sm:col-span-5 aspect-[4/3] sm:aspect-auto bg-[#ECE8E1]">
                    <ResilientImage
                      src={srv.image_url}
                      alt={srv.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="sm:col-span-7 p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="text-xs text-[#9E6B3B] font-medium">
                        {String(idx + 1).padStart(2, '0')}. {srv.category}
                      </div>
                      <h2 className="text-xl font-semibold text-[#171614]">{srv.title}</h2>
                      <p className="text-sm text-[#5C574F] leading-relaxed">{srv.short_description}</p>
                      {srv.materials_spec && (
                        <p className="text-xs text-[#5C574F] pt-1">{srv.materials_spec}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#EFECE6]">
                      <span className="text-xs font-medium text-[#5C574F] tabular-nums">
                        {srv.timeline_estimate || 'Custom Schedule'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRequestQuoteForService(srv.title)}
                        className="text-xs font-semibold text-[#9E6B3B] hover:underline whitespace-nowrap cursor-pointer"
                      >
                        Request Quote →
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : route.page === 'about' ? (
          <AboutSection settings={settings} onBookConsultation={() => navigate('/contact')} />
        ) : route.page === 'contact' ? (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <InquirySection
              services={services}
              settings={settings}
              preselectedService={inquiryPreselectService}
              preselectedProjectSlug={inquiryPreselectProjectSlug}
            />
          </section>
        ) : (
          /* HOME PAGE */
          <div>
            {/* 1. Split Hero Banner */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-center space-y-6 py-2">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-[#9E6B3B]">
                      Vishwakarma Interior Services Centre · Cuttack, Odisha
                    </p>
                    <h1
                      className="font-semibold text-[#171614] tracking-tight leading-[1.08]"
                      style={{ fontSize: 'clamp(2.25rem, 4vw, 3.6rem)', textWrap: 'balance' }}
                    >
                      Bespoke Interiors &amp; Solid Wood Craftsmanship Built to Last
                    </h1>
                    <p className="text-base sm:text-lg text-[#5C574F] leading-relaxed max-w-xl">
                      Led by <span className="font-semibold text-[#171614]">Bipin Kumar</span> in Cuttack, we design and build turnkey home interiors, modular kitchens, custom Burma teak furniture, wardrobes, and architectural carpentry with direct workshop accountability.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/projects')}
                      className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Explore Completed Projects
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <a
                      href={whatsappDirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#2D5A3C] hover:bg-[#23472F] rounded-lg transition-colors whitespace-nowrap"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp Chat
                    </a>
                    <a
                      href={telHref}
                      className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[#171614] bg-white hover:bg-[#F1EFEA] border border-[#E2DDD4] rounded-lg transition-colors whitespace-nowrap tabular-nums"
                    >
                      <Phone className="w-4 h-4 text-[#9E6B3B]" />
                      Call
                    </a>
                    <button
                      type="button"
                      onClick={() => setVoiceOpenSignal((n) => n + 1)}
                      className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[#171614] bg-white hover:bg-[#F1EFEA] border border-[#E2DDD4] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Mic className="w-4 h-4 text-[#9E6B3B]" />
                      Voice Desk
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="w-full aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[440px] rounded-xl overflow-hidden border border-[#E2DDD4] bg-[#ECE8E1]">
                    <ResilientImage
                      src="/src/assets/images/hero_living_room_1795511701089.jpg"
                      alt="Vishwakarma Interior Services Centre luxury living room interior in Cuttack"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* Full-width 4-column craft metrics strip below hero */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-10 pt-8 border-t border-[#E2DDD4]">
                <div>
                  <p className="text-2xl sm:text-3xl font-semibold text-[#171614] tabular-nums">25+ Years</p>
                  <p className="text-xs sm:text-sm text-[#5C574F] mt-1">
                    Master Carpentry &amp; Turnkey Execution in Odisha
                  </p>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-semibold text-[#171614] tabular-nums">10,000+ Sites</p>
                  <p className="text-xs sm:text-sm text-[#5C574F] mt-1">
                    Homes, Kitchens &amp; Offices Delivered Across Cuttack
                  </p>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-semibold text-[#171614] tabular-nums">BWR 710</p>
                  <p className="text-xs sm:text-sm text-[#5C574F] mt-1">
                    Moisture-Resistant Marine Plywood &amp; Seasoned Teak
                  </p>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-semibold text-[#171614] tabular-nums">Direct Studio</p>
                  <p className="text-xs sm:text-sm text-[#5C574F] mt-1">
                    Madhupatna Workshop Pricing with Zero Middlemen
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Featured Completed Projects + Interactive Before/After Spotlight */}
            <section className="py-14 border-t border-[#E2DDD4] bg-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="space-y-2 max-w-2xl">
                    <p className="text-xs font-semibold text-[#9E6B3B]">
                      Featured Portfolio · Verified Work
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-semibold text-[#171614] tracking-tight">
                      Completed Projects Across Cuttack
                    </h2>
                    <p className="text-sm sm:text-base text-[#5C574F]">
                      Click any completed project to inspect its full before-and-after transformation, gallery photographs, and material specifications.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/projects')}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#9E6B3B] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    View All {projects.length} Projects
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} onSelect={openProjectDetail} />
                  ))}
                </div>

                {featuredProjects[0] && (
                  <div className="pt-8 border-t border-[#EFECE6] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className="lg:col-span-5 space-y-4">
                      <p className="text-xs font-semibold text-[#9E6B3B]">
                        Before &amp; After Spotlight
                      </p>
                      <h3 className="text-2xl sm:text-3xl font-semibold text-[#171614] leading-snug">
                        {featuredProjects[0].title}
                      </h3>
                      <p className="text-sm text-[#5C574F] leading-relaxed">
                        {featuredProjects[0].scope_details || featuredProjects[0].summary}
                      </p>
                      <div className="text-xs text-[#5C574F] tabular-nums">
                        {featuredProjects[0].location_name} · Completed {featuredProjects[0].completion_date}
                      </div>
                      <button
                        type="button"
                        onClick={() => openProjectDetail(featuredProjects[0])}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg transition-colors cursor-pointer"
                      >
                        Open Full Project Gallery
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="lg:col-span-7">
                      <BeforeAfterSlider
                        beforeImage={featuredProjects[0].before_image}
                        afterImage={featuredProjects[0].after_image}
                        title={featuredProjects[0].title}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 3. Project Locations & Google Maps Explorer */}
            <section className="py-14 border-t border-[#E2DDD4]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="space-y-2 max-w-2xl">
                    <p className="text-xs font-semibold text-[#9E6B3B]">
                      Local Footprint · Google Maps Integration
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-semibold text-[#171614] tracking-tight">
                      Where We Have Completed Work in Cuttack
                    </h2>
                    <p className="text-sm sm:text-base text-[#5C574F]">
                      Select any neighborhood pin on the map to filter our completed projects and view site photographs from that area.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/locations')}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#9E6B3B] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Open Full Map Explorer
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <ProjectLocationsMap
                  mapsApiKey={mapsApiKey}
                  locations={locations}
                  projects={projects}
                  onSelectProject={openProjectDetail}
                />
              </div>
            </section>

            {/* 4. Our Services (10 Core Offerings) */}
            <section className="py-14 border-t border-[#E2DDD4] bg-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="space-y-2 max-w-2xl">
                    <p className="text-xs font-semibold text-[#9E6B3B]">
                      Specialized Capabilities
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-semibold text-[#171614] tracking-tight">
                      Our Interior, Furniture &amp; Carpentry Services
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/services')}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#9E6B3B] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Compare All {services.length} Services
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {services.map((srv, idx) => (
                    <div
                      key={srv.id}
                      className="border border-[#E2DDD4] rounded-xl p-5 bg-[#F9F8F6] flex flex-col justify-between gap-4 hover:border-[#C9C1B4] transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-[#9E6B3B]">
                          {String(idx + 1).padStart(2, '0')}. {srv.category}
                        </div>
                        <h3 className="text-lg font-semibold text-[#171614]">{srv.title}</h3>
                        <p className="text-sm text-[#5C574F] leading-relaxed">
                          {srv.short_description}
                        </p>
                      </div>
                      <div className="pt-3 border-t border-[#E2DDD4] flex items-center justify-between gap-2 text-xs">
                        <span className="text-[#5C574F] tabular-nums">
                          {srv.timeline_estimate || 'Custom Timeline'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRequestQuoteForService(srv.title)}
                          className="font-semibold text-[#9E6B3B] hover:underline cursor-pointer whitespace-nowrap"
                        >
                          Get Quote →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 5. About Us & Client Testimonials */}
            <AboutSection
              settings={settings}
              onBookConsultation={() => navigate('/contact')}
              compact
            />

            <section className="py-14 border-t border-[#E2DDD4] bg-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                <div className="space-y-2 max-w-2xl">
                  <p className="text-xs font-semibold text-[#9E6B3B]">
                    Client Proof · Cuttack Homeowners &amp; Businesses
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-semibold text-[#171614] tracking-tight">
                    What Our Customers Say
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {TESTIMONIALS.map((t) => (
                    <blockquote
                      key={t.name}
                      className="bg-[#F9F8F6] border border-[#E2DDD4] rounded-xl p-6 flex flex-col justify-between gap-5"
                    >
                      <p className="text-sm text-[#171614] leading-relaxed">
                        &ldquo;{t.quote}&rdquo;
                      </p>
                      <footer className="pt-4 border-t border-[#E2DDD4]">
                        <p className="text-sm font-semibold text-[#171614]">{t.name}</p>
                        <p className="text-xs text-[#5C574F] mt-0.5">{t.role}</p>
                        <p className="text-xs text-[#9E6B3B] font-medium mt-1">{t.project}</p>
                      </footer>
                    </blockquote>
                  ))}
                </div>
              </div>
            </section>

            {/* 6. Customer Contact & Inquiry Section */}
            <section id="contact" className="py-14 border-t border-[#E2DDD4]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <InquirySection
                  services={services}
                  settings={settings}
                  preselectedService={inquiryPreselectService}
                  preselectedProjectSlug={inquiryPreselectProjectSlug}
                />
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Quiet Architectural Footer */}
      <footer className="border-t border-[#E2DDD4] bg-[#171614] text-[#F9F8F6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-white/10">
            <div className="md:col-span-5 space-y-3">
              <div className="inline-flex items-center gap-2.5 text-lg font-display font-semibold text-white">
                <BrandMark className="w-6 h-6 text-white" />
                <span>Vishwakarma Interior Services Centre</span>
              </div>
              <p className="text-sm text-white/75 leading-relaxed max-w-md">
                Owned and led by Bipin Kumar Rana. Turnkey interior design, modular kitchens, bespoke teak furniture manufacturing, and precision carpentry in Cuttack, Odisha.
              </p>
              <p className="text-xs text-white/60">{settings.workshop_address}</p>
            </div>

            <div className="md:col-span-3 space-y-2.5 text-sm">
              <p className="text-xs font-semibold text-[#D6A676]">Navigation</p>
              <div className="flex flex-col gap-2 text-white/80">
                <a href="/projects" onClick={(e) => { e.preventDefault(); navigate('/projects'); }} className="hover:text-white">
                  Completed Projects
                </a>
                <a href="/locations" onClick={(e) => { e.preventDefault(); navigate('/locations'); }} className="hover:text-white">
                  Project Locations Map
                </a>
                <a href="/services" onClick={(e) => { e.preventDefault(); navigate('/services'); }} className="hover:text-white">
                  Our Services
                </a>
                <a href="/about" onClick={(e) => { e.preventDefault(); navigate('/about'); }} className="hover:text-white">
                  About Us
                </a>
                <a href="/admin" onClick={(e) => { e.preventDefault(); navigate('/admin'); }} className="hover:text-white">
                  Owner Admin Console
                </a>
              </div>
            </div>

            <div className="md:col-span-4 space-y-3 text-sm">
              <p className="text-xs font-semibold text-[#D6A676]">Direct Contact</p>
              <p className="text-white/80 tabular-nums">{settings.business_phone}</p>
              <p className="text-white/80 flex flex-col gap-1">
                {settings.business_email
                  .split(',')
                  .map((e) => e.trim())
                  .filter(Boolean)
                  .map((email) => (
                    <a
                      key={email}
                      href={`mailto:${email}`}
                      className="hover:text-white transition-colors w-fit"
                    >
                      {email}
                    </a>
                  ))}
              </p>
              <p className="text-white/70 text-xs">{settings.working_hours}</p>
              <div className="flex flex-wrap gap-2.5 pt-1">
                <a
                  href={whatsappDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#2D5A3C] hover:bg-[#23472F] rounded-lg"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
                <a
                  href={telHref}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#171614] bg-white hover:bg-[#EFECE6] rounded-lg"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call Bipin Kumar
                </a>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60">
            <p>
              &copy; {new Date().getFullYear()} Vishwakarma Interior Services Centre, Cuttack, Odisha.
            </p>
            <p>Interior Design · Modular Kitchens · Custom Teak Furniture &amp; Carpentry</p>
          </div>
        </div>
      </footer>

      <VoiceConsultant
        settings={settings}
        onBookConsultation={() => navigate('/contact')}
        externalOpenSignal={voiceOpenSignal}
      />
    </div>
  );
}

function AboutSection({
  settings,
  onBookConsultation,
  compact = false,
}: {
  settings: BusinessSettings;
  onBookConsultation: () => void;
  compact?: boolean;
}) {
  return (
    <section className="py-14 border-t border-[#E2DDD4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 space-y-4">
            <p className="text-xs font-semibold text-[#9E6B3B]">
              About Vishwakarma Interior Services Centre
            </p>
            {compact ? (
              <h2 className="text-3xl sm:text-4xl font-semibold text-[#171614] tracking-tight leading-tight">
                Master Craftsmanship &amp; Honest Execution Under Bipin Kumar Rana
              </h2>
            ) : (
              <h1 className="text-3xl sm:text-5xl font-semibold text-[#171614] tracking-tight leading-tight">
                Master Craftsmanship &amp; Honest Execution Under Bipin Kumar
              </h1>
            )}
            <p className="text-sm sm:text-base text-[#5C574F] leading-relaxed">
              Founded in Cuttack, Odisha, Vishwakarma Interior Services Centre bridges traditional Vishwakarma woodworking heritage with modern architectural interior design. Every project is personally supervised by owner <span className="font-semibold text-[#171614]">Bipin Kumar</span>—from timber selection at our Madhupatna workshop to final hinge alignment at your home.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-white border border-[#E2DDD4] rounded-xl p-4 space-y-1.5">
                <ShieldCheck className="w-5 h-5 text-[#9E6B3B]" />
                <h3 className="text-sm font-semibold text-[#171614]">Certified Plywood</h3>
                <p className="text-xs text-[#5C574F] leading-relaxed">
                  Only verified BWR 710 marine plywood, HDHMR boards, and seasoned teakwood.
                </p>
              </div>
              <div className="bg-white border border-[#E2DDD4] rounded-xl p-4 space-y-1.5">
                <Hammer className="w-5 h-5 text-[#9E6B3B]" />
                <h3 className="text-sm font-semibold text-[#171614]">In-House Artisans</h3>
                <p className="text-xs text-[#5C574F] leading-relaxed">
                  Dedicated team of experienced carpenters, polishers, and ceiling technicians.
                </p>
              </div>
              <div className="bg-white border border-[#E2DDD4] rounded-xl p-4 space-y-1.5">
                <Award className="w-5 h-5 text-[#9E6B3B]" />
                <h3 className="text-sm font-semibold text-[#171614]">Clear Pricing</h3>
                <p className="text-xs text-[#5C574F] leading-relaxed">
                  Square-foot &amp; hardware-grade itemized estimates with zero hidden charges.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-[#E2DDD4] rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#EFECE6] pb-3">
              <h3 className="text-xl font-semibold text-[#171614]">Our 4-Stage Working Process</h3>
              <Compass className="w-5 h-5 text-[#9E6B3B]" />
            </div>
            <div className="space-y-4">
              {WORKING_PROCESS.map((item) => (
                <div key={item.step} className="flex gap-4">
                  <span className="text-sm font-semibold text-[#9E6B3B] font-mono-tabular shrink-0 pt-0.5">
                    {item.step}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-[#171614]">{item.title}</h4>
                    <p className="text-xs sm:text-sm text-[#5C574F] leading-relaxed mt-0.5">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E2DDD4] rounded-xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h3 className="text-2xl font-semibold text-[#171614]">
              Why Cuttack Families Choose Vishwakarma Interior
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1 text-sm text-[#5C574F]">
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D5A3C] shrink-0" />
                Direct owner supervision by Bipin Kumar
              </p>
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D5A3C] shrink-0" />
                Termite-resistant timber &amp; branded fittings
              </p>
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D5A3C] shrink-0" />
                On-time completion across Cuttack &amp; Odisha
              </p>
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D5A3C] shrink-0" />
                Workshop at {settings.workshop_address}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBookConsultation}
            className="px-6 py-3 text-sm font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Schedule Site Visit
          </button>
        </div>
      </div>
    </section>
  );
}
