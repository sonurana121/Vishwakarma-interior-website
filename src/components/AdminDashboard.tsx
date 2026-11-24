import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  Check,
  Edit3,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DEFAULT_SETTINGS } from '../data/seedCatalog.ts';
import { ADMIN_OWNER_EMAIL, auth, googleAuthProvider, isVerifiedOwner } from '../lib/firebase.ts';
import {
  createLocationInFirestore,
  deleteInquiryInFirestore,
  deleteLocationInFirestore,
  deleteProjectInFirestore,
  deleteServiceInFirestore,
  ensureFirestoreSeeded,
  saveBusinessSettingsInFirestore,
  saveProjectInFirestore,
  saveServiceInFirestore,
  subscribeAdminOverview,
  updateInquiryStatusInFirestore,
} from '../lib/firestoreStore.ts';
import type {
  BusinessSettings,
  CustomerInquiry,
  InquiryStatus,
  Project,
  ProjectLocation,
  ServiceItem,
} from '../types.ts';
import { ResilientImage } from './ResilientImage.tsx';

interface AdminDashboardProps {
  onDataChanged: () => void;
  onExitAdmin: () => void;
}

type AdminTab = 'projects' | 'inquiries' | 'locations' | 'services' | 'settings';

const WORK_TYPES = [
  'Home Interior Design',
  'Modular Kitchen',
  'Bedroom Interior',
  'Living Room Interior',
  'Office Interior',
  'Furniture Manufacturing',
  'Custom Furniture',
  'Carpentry Work',
  'Wardrobe Design',
  'False Ceiling',
];

const CUTTACK_PRESETS = [
  { area_name: 'CDA Sector 6', city: 'Cuttack', lat: 20.4832, lng: 85.8345 },
  { area_name: 'Tulasipur', city: 'Cuttack', lat: 20.4718, lng: 85.8622 },
  { area_name: 'Buxi Bazaar', city: 'Cuttack', lat: 20.4648, lng: 85.8814 },
  { area_name: 'Mahanadi Vihar', city: 'Cuttack', lat: 20.4539, lng: 85.9189 },
  { area_name: 'Patia', city: 'Bhubaneswar', lat: 20.3533, lng: 85.8266 },
];

function extractFriendlyError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message) as { error?: string };
      if (parsed?.error) return parsed.error;
    } catch {
      return err.message;
    }
  }
  return fallback;
}

export function AdminDashboard({ onDataChanged, onExitAdmin }: AdminDashboardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<ProjectLocation[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [inquiries, setInquiries] = useState<CustomerInquiry[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);

  const [loadingData, setLoadingData] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Project Modal / Form state
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectSlug, setEditingProjectSlug] = useState<string | undefined>(undefined);
  const [projectSearch, setProjectSearch] = useState('');
  const [pTitle, setPTitle] = useState('');
  const [pWorkType, setPWorkType] = useState(WORK_TYPES[0]);
  const [pLocationId, setPLocationId] = useState<string>('');
  const [pLocationName, setPLocationName] = useState('CDA Sector 9, Cuttack');
  const [pCity, setPCity] = useState('Cuttack');
  const [pLat, setPLat] = useState('20.4789');
  const [pLng, setPLng] = useState('85.8396');
  const [pCompletionDate, setPCompletionDate] = useState('November 2026');
  const [pAreaSqft, setPAreaSqft] = useState('');
  const [pDurationWeeks, setPDurationWeeks] = useState('');
  const [pClientName, setPClientName] = useState('');
  const [pSummary, setPSummary] = useState('');
  const [pScopeDetails, setPScopeDetails] = useState('');
  const [pBeforeImage, setPBeforeImage] = useState('/src/assets/images/project_before_renovation_1795511705254.jpg');
  const [pAfterImage, setPAfterImage] = useState('/src/assets/images/hero_living_room_1795511701089.jpg');
  const [pGalleryImages, setPGalleryImages] = useState<string[]>([]);
  const [pFeatured, setPFeatured] = useState(true);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);

  // Inquiry Filter
  const [inquiryFilter, setInquiryFilter] = useState<'All' | InquiryStatus>('All');

  // Location Form
  const [locArea, setLocArea] = useState('');
  const [locCity, setLocCity] = useState('Cuttack');
  const [locLat, setLocLat] = useState('');
  const [locLng, setLocLng] = useState('');
  const [locDesc, setLocDesc] = useState('');

  // Service Form
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [sTitle, setSTitle] = useState('');
  const [sCategory, setSCategory] = useState('Turnkey Interiors');
  const [sDesc, setSDesc] = useState('');
  const [sMaterials, setSMaterials] = useState('');
  const [sTimeline, setSTimeline] = useState('');
  const [sImageUrl, setSImageUrl] = useState('/src/assets/images/hero_living_room_1795511701089.jpg');
  const [sActive, setSActive] = useState(true);

  const ownerVerified = isVerifiedOwner(user);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const freshToken = await firebaseUser.getIdToken();
          setIdToken(freshToken);
        } catch {
          setIdToken(null);
        }
      } else {
        setIdToken(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !ownerVerified) return;

    let cancelled = false;
    let unsubscribeOverview: (() => void) | undefined;

    const initAdmin = async () => {
      setLoadingData(true);
      try {
        await ensureFirestoreSeeded();
        if (cancelled) return;
        unsubscribeOverview = subscribeAdminOverview({
          onProjects: (list) => setProjects(list),
          onLocations: (list) => setLocations(list),
          onServices: (list) => setServices(list),
          onInquiries: (list) => setInquiries(list),
          onSettings: (s) => setSettings(s),
        });
        onDataChanged();
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(extractFriendlyError(err, 'Failed to synchronize admin records.'));
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    void initAdmin();
    return () => {
      cancelled = true;
      if (unsubscribeOverview) unsubscribeOverview();
    };
  }, [authReady, ownerVerified, onDataChanged]);

  const notify = useCallback((msg: string) => {
    setErrorMessage(null);
    setBannerMessage(msg);
    setTimeout(() => setBannerMessage(null), 4000);
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setIdToken(token);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google sign-in failed. Please allow the popup and retry.'
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setIdToken(null);
  };

  const uploadImages = async (
    files: FileList | null,
    target: 'before' | 'after' | 'gallery' | 'service'
  ) => {
    if (!files || files.length === 0 || !user) return;
    setUploadingField(target);
    setErrorMessage(null);
    try {
      const activeToken = (await user.getIdToken()) || idToken;
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('images', file));
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        body: formData,
      });
      const data = (await res.json()) as { urls?: string[]; error?: string };
      if (!res.ok || !data.urls) {
        setErrorMessage(data.error || 'Image upload failed.');
        return;
      }
      if (target === 'before') setPBeforeImage(data.urls[0]);
      if (target === 'after') setPAfterImage(data.urls[0]);
      if (target === 'gallery') setPGalleryImages((prev) => [...prev, ...data.urls!]);
      if (target === 'service') setSImageUrl(data.urls[0]);
      notify(`Uploaded ${data.urls.length} image${data.urls.length > 1 ? 's' : ''} securely.`);
    } catch {
      setErrorMessage('Error uploading images.');
    } finally {
      setUploadingField(null);
    }
  };

  const openNewProjectForm = () => {
    setEditingProjectId(null);
    setEditingProjectSlug(undefined);
    setPTitle('');
    setPWorkType(WORK_TYPES[0]);
    const firstLoc = locations[0];
    setPLocationId(firstLoc ? firstLoc.id : '');
    setPLocationName(firstLoc ? `${firstLoc.area_name}, ${firstLoc.city}` : 'CDA Sector 9, Cuttack');
    setPCity(firstLoc?.city || 'Cuttack');
    setPLat(firstLoc ? String(firstLoc.lat) : '20.4789');
    setPLng(firstLoc ? String(firstLoc.lng) : '85.8396');
    setPCompletionDate('November 2026');
    setPAreaSqft('');
    setPDurationWeeks('');
    setPClientName('');
    setPSummary('');
    setPScopeDetails('');
    setPBeforeImage('/src/assets/images/project_before_renovation_1795511705254.jpg');
    setPAfterImage('/src/assets/images/hero_living_room_1795511701089.jpg');
    setPGalleryImages(['/src/assets/images/hero_living_room_1795511701089.jpg']);
    setPFeatured(true);
    setShowProjectForm(true);
  };

  const openEditProjectForm = (proj: Project) => {
    setEditingProjectId(proj.id);
    setEditingProjectSlug(proj.slug);
    setPTitle(proj.title);
    setPWorkType(proj.work_type);
    setPLocationId(proj.location_id || '');
    setPLocationName(proj.location_name);
    setPCity(proj.city);
    setPLat(String(proj.lat));
    setPLng(String(proj.lng));
    setPCompletionDate(proj.completion_date);
    setPAreaSqft(proj.area_sqft);
    setPDurationWeeks(proj.duration_weeks);
    setPClientName(proj.client_name);
    setPSummary(proj.summary);
    setPScopeDetails(proj.scope_details);
    setPBeforeImage(proj.before_image);
    setPAfterImage(proj.after_image);
    setPGalleryImages(proj.gallery_images);
    setPFeatured(proj.featured);
    setShowProjectForm(true);
  };

  const handleSelectProjectLocation = (val: string) => {
    setPLocationId(val);
    const found = locations.find((l) => l.id === val);
    if (found) {
      setPLocationName(`${found.area_name}, ${found.city}`);
      setPCity(found.city);
      setPLat(String(found.lat));
      setPLng(String(found.lng));
    }
  };

  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProject(true);
    setErrorMessage(null);
    try {
      await saveProjectInFirestore(editingProjectId, {
        slug: editingProjectSlug,
        title: pTitle,
        work_type: pWorkType,
        location_id: pLocationId || null,
        location_name: pLocationName,
        city: pCity,
        lat: Number(pLat),
        lng: Number(pLng),
        completion_date: pCompletionDate,
        area_sqft: pAreaSqft,
        duration_weeks: pDurationWeeks,
        client_name: pClientName,
        summary: pSummary,
        scope_details: pScopeDetails,
        before_image: pBeforeImage,
        after_image: pAfterImage,
        gallery_images: pGalleryImages.length > 0 ? pGalleryImages : [pAfterImage],
        featured: pFeatured,
      });
      setShowProjectForm(false);
      onDataChanged();
      notify(editingProjectId ? 'Project updated and live on website.' : 'New project published to portfolio.');
    } catch (err) {
      setErrorMessage(extractFriendlyError(err, 'Could not save project.'));
    } finally {
      setSavingProject(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProjectInFirestore(id);
      onDataChanged();
      notify('Project deleted from portfolio.');
    } catch (err) {
      setErrorMessage(extractFriendlyError(err, 'Error deleting project.'));
    }
  };

  const handleAddLocation = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await createLocationInFirestore({
        area_name: locArea,
        city: locCity,
        lat: Number(locLat),
        lng: Number(locLng),
        description: locDesc,
      });
      setLocArea('');
      setLocLat('');
      setLocLng('');
      setLocDesc('');
      onDataChanged();
      notify('Project location added to Google Map.');
    } catch (err) {
      setErrorMessage(extractFriendlyError(err, 'Failed to add location.'));
    }
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      await deleteLocationInFirestore(id);
      onDataChanged();
      notify('Location removed.');
    } catch (err) {
      setErrorMessage(extractFriendlyError(err, 'Error deleting location.'));
    }
  };

  const handleEditService = (srv: ServiceItem) => {
    setEditingServiceId(srv.id);
    setSTitle(srv.title);
    setSCategory(srv.category);
    setSDesc(srv.short_description);
    setSMaterials(srv.materials_spec);
    setSTimeline(srv.timeline_estimate);
    setSImageUrl(srv.image_url);
    setSActive(srv.active);
  };

  const handleSaveService = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      const maxOrder = services.reduce((max, item) => Math.max(max, item.display_order), 0);
      const existingOrder = editingServiceId
        ? services.find((s) => s.id === editingServiceId)?.display_order ?? maxOrder + 1
        : maxOrder + 1;

      await saveServiceInFirestore(editingServiceId, {
        title: sTitle,
        category: sCategory,
        short_description: sDesc,
        materials_spec: sMaterials,
        timeline_estimate: sTimeline,
        image_url: sImageUrl,
        display_order: existingOrder,
        active: sActive,
      });

      setEditingServiceId(null);
      setSTitle('');
      setSDesc('');
      setSMaterials('');
      setSTimeline('');
      onDataChanged();
      notify('Service catalog updated.');
    } catch (err) {
      setErrorMessage(extractFriendlyError(err, 'Could not save service.'));
    }
  };

  const handleDeleteService = async (id: string) => {
    try {
      await deleteServiceInFirestore(id);
      onDataChanged();
      notify('Service deleted.');
    } catch (err) {
      setErrorMessage(extractFriendlyError(err, 'Error deleting service.'));
    }
  };

  const handleUpdateInquiryStatus = async (id: string, status: InquiryStatus) => {
    try {
      await updateInquiryStatusInFirestore(id, status);
      notify(`Inquiry marked as ${status}.`);
    } catch (err) {
      setErrorMessage(extractFriendlyError(err, 'Failed to update inquiry status.'));
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    try {
      await deleteInquiryInFirestore(id);
      notify('Inquiry removed.');
    } catch (err) {
      setErrorMessage(extractFriendlyError(err, 'Error deleting inquiry.'));
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await saveBusinessSettingsInFirestore(settings);
      onDataChanged();
      notify('Business contact settings saved.');
    } catch (err) {
      setErrorMessage(extractFriendlyError(err, 'Could not save settings.'));
    }
  };

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.location_name.toLowerCase().includes(q) ||
        p.work_type.toLowerCase().includes(q)
    );
  }, [projects, projectSearch]);

  const filteredInquiries = useMemo(() => {
    if (inquiryFilter === 'All') return inquiries;
    return inquiries.filter((i) => i.status === inquiryFilter);
  }, [inquiries, inquiryFilter]);

  if (!authReady) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white border border-[#E2DDD4] rounded-xl text-center text-sm text-[#5C574F]">
        Verifying owner session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-14 px-4">
        <div className="bg-white border border-[#E2DDD4] rounded-xl p-7 space-y-5">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-[#F1EFEA] border border-[#E2DDD4] flex items-center justify-center text-[#9E6B3B]">
              <KeyRound className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-semibold text-[#171614]">
              Owner Admin Sign In
            </h1>
            <p className="text-sm text-[#5C574F] leading-relaxed">
              Sign in with the verified Vishwakarma Interior owner Google account to publish projects, upload before/after photographs, manage Cuttack locations, and review customer inquiries.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B]">
              {authError}
            </div>
          )}

          <button
            type="button"
            disabled={signingIn}
            onClick={() => void handleGoogleSignIn()}
            className="w-full px-5 py-3 text-sm font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            {signingIn ? 'Opening Google Sign-In...' : 'Sign in with Google'}
          </button>

          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full text-center text-xs font-medium text-[#5C574F] hover:text-[#171614] cursor-pointer"
          >
            Return to Public Website
          </button>
        </div>
      </div>
    );
  }

  if (!ownerVerified) {
    return (
      <div className="max-w-md mx-auto my-14 px-4">
        <div className="bg-white border border-[#E2DDD4] rounded-xl p-7 space-y-5">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#991B1B]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-semibold text-[#171614]">Owner Access Required</h1>
            <p className="text-sm text-[#5C574F] leading-relaxed">
              Signed in as <span className="font-semibold text-[#171614]">{user.email}</span>. Only the verified owner account ({ADMIN_OWNER_EMAIL}) can access the Vishwakarma Interior admin console.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="w-full px-5 py-2.5 text-sm font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg cursor-pointer"
            >
              Sign Out &amp; Switch Account
            </button>
            <button
              type="button"
              onClick={onExitAdmin}
              className="w-full text-center text-xs font-medium text-[#5C574F] hover:text-[#171614] cursor-pointer py-1"
            >
              Return to Public Website
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E2DDD4]">
        <div>
          <p className="text-xs font-medium text-[#9E6B3B]">
            Vishwakarma Interior Services Centre · Owner Console ({user.email})
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#171614] mt-0.5">
            Portfolio, Locations &amp; Inquiries Manager
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExitAdmin}
            className="px-4 py-2 text-xs font-medium text-[#171614] bg-white border border-[#E2DDD4] hover:bg-[#F1EFEA] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            View Live Website
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2DDD4] rounded-xl p-4">
          <p className="text-xs text-[#5C574F]">Published Projects</p>
          <p className="text-2xl font-semibold text-[#171614] mt-1 tabular-nums">{projects.length}</p>
        </div>
        <div className="bg-white border border-[#E2DDD4] rounded-xl p-4">
          <p className="text-xs text-[#5C574F]">Mapped Locations</p>
          <p className="text-2xl font-semibold text-[#171614] mt-1 tabular-nums">{locations.length}</p>
        </div>
        <div className="bg-white border border-[#E2DDD4] rounded-xl p-4">
          <p className="text-xs text-[#5C574F]">Active Services</p>
          <p className="text-2xl font-semibold text-[#171614] mt-1 tabular-nums">
            {services.filter((s) => s.active).length}
          </p>
        </div>
        <div className="bg-white border border-[#E2DDD4] rounded-xl p-4">
          <p className="text-xs text-[#5C574F]">Customer Inquiries</p>
          <p className="text-2xl font-semibold text-[#171614] mt-1 tabular-nums">{inquiries.length}</p>
        </div>
      </div>

      {bannerMessage && (
        <div className="p-3.5 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-xs font-medium text-[#065F46] flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {bannerMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B]">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EFECE6] border border-[#E2DDD4] rounded-xl w-fit">
        {(
          [
            ['projects', 'Projects & Photos'],
            ['inquiries', `Inquiries (${inquiries.length})`],
            ['locations', 'Project Locations'],
            ['services', 'Services'],
            ['settings', 'Contact Settings'],
          ] as Array<[AdminTab, string]>
        ).map(([tabKey, label]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setActiveTab(tabKey)}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === tabKey
                ? 'bg-white text-[#171614] shadow-xs'
                : 'text-[#5C574F] hover:text-[#171614]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loadingData && (
        <div className="text-xs text-[#5C574F]">Loading dashboard records...</div>
      )}

      {/* PROJECTS TAB */}
      {activeTab === 'projects' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 text-[#5C574F] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search projects by title, location, or work type..."
                className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-[#E2DDD4] rounded-lg focus:outline-none focus:border-[#9E6B3B]"
              />
            </div>
            <button
              type="button"
              onClick={openNewProjectForm}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Completed Project
            </button>
          </div>

          {showProjectForm && (
            <form
              onSubmit={handleSaveProject}
              className="bg-white border border-[#E2DDD4] rounded-xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-[#EFECE6] pb-3">
                <h2 className="text-xl font-semibold text-[#171614]">
                  {editingProjectId ? 'Edit Project Details & Photos' : 'Add New Completed Project'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowProjectForm(false)}
                  className="p-1.5 text-[#5C574F] hover:text-[#171614] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">Project Name</label>
                  <input
                    type="text"
                    required
                    value={pTitle}
                    onChange={(e) => setPTitle(e.target.value)}
                    placeholder="e.g., CDA Sector 10 Duplex — Burma Teak Modular Kitchen"
                    className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">Type of Work</label>
                  <select
                    value={pWorkType}
                    onChange={(e) => setPWorkType(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                  >
                    {WORK_TYPES.map((wt) => (
                      <option key={wt} value={wt}>
                        {wt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">Saved Location Preset</label>
                  <select
                    value={pLocationId}
                    onChange={(e) => handleSelectProjectLocation(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                  >
                    <option value="">Custom Location</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.area_name}, {loc.city}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">Area / Neighborhood</label>
                  <input
                    type="text"
                    required
                    value={pLocationName}
                    onChange={(e) => setPLocationName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">City</label>
                  <input
                    type="text"
                    required
                    value={pCity}
                    onChange={(e) => setPCity(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">Completion Date</label>
                  <input
                    type="text"
                    required
                    value={pCompletionDate}
                    onChange={(e) => setPCompletionDate(e.target.value)}
                    placeholder="e.g., November 2026"
                    className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={pLat}
                    onChange={(e) => setPLat(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg font-mono-tabular"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={pLng}
                    onChange={(e) => setPLng(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg font-mono-tabular"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">Area (sq.ft)</label>
                  <input
                    type="text"
                    value={pAreaSqft}
                    onChange={(e) => setPAreaSqft(e.target.value)}
                    placeholder="1,450 sq.ft"
                    className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">Duration</label>
                  <input
                    type="text"
                    value={pDurationWeeks}
                    onChange={(e) => setPDurationWeeks(e.target.value)}
                    placeholder="6 Weeks"
                    className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">Client / Residence</label>
                  <input
                    type="text"
                    value={pClientName}
                    onChange={(e) => setPClientName(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">Short Project Summary</label>
                  <textarea
                    rows={3}
                    required
                    value={pSummary}
                    onChange={(e) => setPSummary(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#171614]">Materials &amp; Scope Details</label>
                  <textarea
                    rows={3}
                    value={pScopeDetails}
                    onChange={(e) => setPScopeDetails(e.target.value)}
                    placeholder="Timber type, plywood grade, hardware, finish..."
                    className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 border-t border-[#EFECE6]">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#171614]">Before Work Photograph</label>
                  <div className="aspect-[4/3] rounded-lg overflow-hidden border border-[#E2DDD4] bg-[#ECE8E1]">
                    <ResilientImage src={pBeforeImage} alt="Before preview" className="w-full h-full object-cover" />
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium bg-[#F1EFEA] hover:bg-[#E5E1D8] border border-[#E2DDD4] rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingField === 'before' ? 'Uploading...' : 'Upload Before Photo'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => void uploadImages(e.target.files, 'before')}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#171614]">After (Completed) Photograph</label>
                  <div className="aspect-[4/3] rounded-lg overflow-hidden border border-[#E2DDD4] bg-[#ECE8E1]">
                    <ResilientImage src={pAfterImage} alt="After preview" className="w-full h-full object-cover" />
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium bg-[#F1EFEA] hover:bg-[#E5E1D8] border border-[#E2DDD4] rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingField === 'after' ? 'Uploading...' : 'Upload After Photo'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => void uploadImages(e.target.files, 'after')}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#171614]">
                    Additional Gallery Photos ({pGalleryImages.length})
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {pGalleryImages.map((img, i) => (
                      <div key={`${img}-${i}`} className="relative aspect-square rounded overflow-hidden border border-[#E2DDD4]">
                        <ResilientImage src={img} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPGalleryImages((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center cursor-pointer"
                          aria-label="Remove gallery photo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium bg-[#F1EFEA] hover:bg-[#E5E1D8] border border-[#E2DDD4] rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingField === 'gallery' ? 'Uploading...' : 'Upload Multiple Photos'}
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => void uploadImages(e.target.files, 'gallery')}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#EFECE6]">
                <label className="inline-flex items-center gap-2 text-sm text-[#171614] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pFeatured}
                    onChange={(e) => setPFeatured(e.target.checked)}
                    className="w-4 h-4 accent-[#9E6B3B]"
                  />
                  Feature this project on the Home Page
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowProjectForm(false)}
                    className="px-4 py-2 text-xs font-medium text-[#5C574F] hover:text-[#171614] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProject}
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg transition-colors cursor-pointer"
                  >
                    {savingProject ? 'Saving...' : editingProjectId ? 'Save Changes' : 'Publish Project'}
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="bg-white border border-[#E2DDD4] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2DDD4] bg-[#F9F8F6] text-xs font-semibold text-[#5C574F]">
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Work Type</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Completed</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE6] text-sm">
                  {filteredProjects.map((proj) => (
                    <tr key={proj.id} className="hover:bg-[#F9F8F6]/70">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-11 rounded overflow-hidden bg-[#ECE8E1] shrink-0">
                            <ResilientImage src={proj.after_image} alt={proj.title} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="font-semibold text-[#171614]">{proj.title}</p>
                            <p className="text-xs text-[#5C574F] tabular-nums">
                              {proj.gallery_images.length} photos {proj.featured ? '· Featured on Home' : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#5C574F] whitespace-nowrap">{proj.work_type}</td>
                      <td className="py-3 px-4 text-xs text-[#171614]">{proj.location_name}</td>
                      <td className="py-3 px-4 text-xs text-[#5C574F] tabular-nums whitespace-nowrap">
                        {proj.completion_date}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditProjectForm(proj)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#171614] hover:bg-[#EFECE6] rounded cursor-pointer mr-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteProject(proj.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#991B1B] hover:bg-[#FEF2F2] rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INQUIRIES TAB */}
      {activeTab === 'inquiries' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['All', 'New', 'Contacted', 'Site Visit Scheduled', 'Completed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setInquiryFilter(st)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  inquiryFilter === st
                    ? 'bg-[#171614] text-white border-[#171614]'
                    : 'bg-white text-[#5C574F] border-[#E2DDD4] hover:text-[#171614]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="bg-white border border-[#E2DDD4] rounded-xl overflow-hidden">
            {filteredInquiries.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5C574F]">
                No customer inquiries match this filter yet.
              </div>
            ) : (
              <div className="divide-y divide-[#EFECE6]">
                {filteredInquiries.map((inq) => (
                  <div key={inq.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C574F]">
                        <span className="font-semibold text-[#9E6B3B]">{inq.service_required}</span>
                        <span aria-hidden="true">·</span>
                        <span>{inq.location}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {new Date(inq.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-[#171614]">
                        {inq.customer_name} — <span className="font-mono-tabular">{inq.mobile_number}</span>
                      </h3>
                      <p className="text-sm text-[#5C574F] leading-relaxed">
                        {inq.project_details || 'Requested a callback for project consultation.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
                        value={inq.status}
                        onChange={(e) =>
                          void handleUpdateInquiryStatus(inq.id, e.target.value as InquiryStatus)
                        }
                        className="px-3 py-1.5 text-xs font-medium bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                      >
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Site Visit Scheduled">Site Visit Scheduled</option>
                        <option value="Completed">Completed</option>
                      </select>

                      <a
                        href={`https://wa.me/91${inq.mobile_number.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(
                          `Namaste ${inq.customer_name}, this is Bipin Kumar from Vishwakarma Interior Services Centre regarding your ${inq.service_required} inquiry in ${inq.location}.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#2D5A3C] rounded-lg"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>

                      <a
                        href={`tel:${inq.mobile_number}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#171614] bg-[#F1EFEA] border border-[#E2DDD4] rounded-lg"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call
                      </a>

                      <button
                        type="button"
                        onClick={() => void handleDeleteInquiry(inq.id)}
                        className="p-1.5 text-[#991B1B] hover:bg-[#FEF2F2] rounded cursor-pointer"
                        aria-label="Delete inquiry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOCATIONS TAB */}
      {activeTab === 'locations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleAddLocation} className="lg:col-span-5 bg-white border border-[#E2DDD4] rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#171614]">Add Project Location</h2>
            <div className="space-y-1.5">
              <p className="text-xs text-[#5C574F]">Quick Cuttack &amp; Nearby Area Presets</p>
              <div className="flex flex-wrap gap-1.5">
                {CUTTACK_PRESETS.map((preset) => (
                  <button
                    key={preset.area_name}
                    type="button"
                    onClick={() => {
                      setLocArea(preset.area_name);
                      setLocCity(preset.city);
                      setLocLat(String(preset.lat));
                      setLocLng(String(preset.lng));
                    }}
                    className="px-2.5 py-1 text-xs bg-[#F1EFEA] hover:bg-[#E5E1D8] border border-[#E2DDD4] rounded cursor-pointer"
                  >
                    {preset.area_name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#171614]">Area Name</label>
                <input
                  type="text"
                  required
                  value={locArea}
                  onChange={(e) => setLocArea(e.target.value)}
                  placeholder="e.g., Mahanadi Vihar"
                  className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#171614]">City</label>
                <input
                  type="text"
                  required
                  value={locCity}
                  onChange={(e) => setLocCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#171614]">Latitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={locLat}
                  onChange={(e) => setLocLat(e.target.value)}
                  placeholder="20.4625"
                  className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg font-mono-tabular"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#171614]">Longitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={locLng}
                  onChange={(e) => setLocLng(e.target.value)}
                  placeholder="85.8830"
                  className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg font-mono-tabular"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#171614]">Description</label>
              <textarea
                rows={2}
                value={locDesc}
                onChange={(e) => setLocDesc(e.target.value)}
                placeholder="Types of projects completed in this area..."
                className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg cursor-pointer"
            >
              Add Location to Map
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-[#E2DDD4] rounded-xl divide-y divide-[#EFECE6]">
            {locations.map((loc) => (
              <div key={loc.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#9E6B3B]" />
                    <h3 className="text-sm font-semibold text-[#171614]">
                      {loc.area_name}, {loc.city}
                    </h3>
                    <span className="text-xs font-mono-tabular text-[#5C574F]">
                      ({loc.lat.toFixed(4)}, {loc.lng.toFixed(4)})
                    </span>
                  </div>
                  <p className="text-xs text-[#5C574F] mt-1">{loc.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteLocation(loc.id)}
                  className="p-2 text-[#991B1B] hover:bg-[#FEF2F2] rounded cursor-pointer shrink-0"
                  aria-label="Delete location"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SERVICES TAB */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleSaveService} className="lg:col-span-5 bg-white border border-[#E2DDD4] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#171614]">
                {editingServiceId ? 'Edit Service' : 'Add Service'}
              </h2>
              {editingServiceId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingServiceId(null);
                    setSTitle('');
                    setSDesc('');
                  }}
                  className="text-xs text-[#5C574F] hover:text-[#171614] cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#171614]">Service Title</label>
              <input
                type="text"
                required
                value={sTitle}
                onChange={(e) => setSTitle(e.target.value)}
                placeholder="e.g., Modular Kitchen"
                className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#171614]">Category</label>
                <select
                  value={sCategory}
                  onChange={(e) => setSCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                >
                  <option value="Turnkey Interiors">Turnkey Interiors</option>
                  <option value="Woodwork & Furniture">Woodwork &amp; Furniture</option>
                  <option value="Architectural Finishes">Architectural Finishes</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#171614]">Typical Timeline</label>
                <input
                  type="text"
                  value={sTimeline}
                  onChange={(e) => setSTimeline(e.target.value)}
                  placeholder="3 – 4 Weeks"
                  className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#171614]">Description</label>
              <textarea
                rows={3}
                required
                value={sDesc}
                onChange={(e) => setSDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#171614]">Materials &amp; Specifications</label>
              <input
                type="text"
                value={sMaterials}
                onChange={(e) => setSMaterials(e.target.value)}
                placeholder="BWR Plywood · Burma Teak · Soft-Close"
                className="w-full px-3 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium bg-[#F1EFEA] border border-[#E2DDD4] rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                {uploadingField === 'service' ? 'Uploading...' : 'Upload Service Photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => void uploadImages(e.target.files, 'service')}
                />
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-[#171614] cursor-pointer">
                <input
                  type="checkbox"
                  checked={sActive}
                  onChange={(e) => setSActive(e.target.checked)}
                  className="accent-[#9E6B3B]"
                />
                Visible on Site
              </label>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg cursor-pointer"
            >
              {editingServiceId ? 'Update Service' : 'Add Service'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-[#E2DDD4] rounded-xl divide-y divide-[#EFECE6]">
            {services.map((srv) => (
              <div key={srv.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-16 h-12 rounded overflow-hidden bg-[#ECE8E1] shrink-0">
                    <ResilientImage src={srv.image_url} alt={srv.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-[#9E6B3B] font-medium">
                      {srv.category} · {srv.active ? 'Active' : 'Hidden'}
                    </div>
                    <h3 className="text-sm font-semibold text-[#171614] truncate">{srv.title}</h3>
                    <p className="text-xs text-[#5C574F] line-clamp-1">{srv.materials_spec}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditService(srv)}
                    className="px-2.5 py-1.5 text-xs font-medium text-[#171614] hover:bg-[#EFECE6] rounded cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteService(srv.id)}
                    className="p-1.5 text-[#991B1B] hover:bg-[#FEF2F2] rounded cursor-pointer"
                    aria-label="Delete service"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="max-w-2xl bg-white border border-[#E2DDD4] rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-[#171614]">Business Contact &amp; Workshop Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#171614]">Display Phone Number</label>
              <input
                type="text"
                value={settings.business_phone}
                onChange={(e) => setSettings({ ...settings, business_phone: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#171614]">WhatsApp Number (with country code, e.g. 918270123438)</label>
              <input
                type="text"
                value={settings.whatsapp_number}
                onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg font-mono-tabular"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#171614]">Business Email(s)</label>
              <input
                type="text"
                value={settings.business_email}
                onChange={(e) => setSettings({ ...settings, business_email: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#171614]">Working Hours</label>
              <input
                type="text"
                value={settings.working_hours}
                onChange={(e) => setSettings({ ...settings, working_hours: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#171614]">Workshop &amp; Office Address</label>
            <input
              type="text"
              value={settings.workshop_address}
              onChange={(e) => setSettings({ ...settings, workshop_address: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-[#F9F8F6] border border-[#E2DDD4] rounded-lg"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 text-xs font-semibold text-white bg-[#171614] hover:bg-[#2E2B27] rounded-lg cursor-pointer"
          >
            Save Business Settings
          </button>
        </form>
      )}
    </div>
  );
}
