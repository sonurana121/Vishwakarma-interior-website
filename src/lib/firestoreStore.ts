import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  DEFAULT_INQUIRIES,
  DEFAULT_LOCATIONS,
  DEFAULT_PROJECTS,
  DEFAULT_SERVICES,
  DEFAULT_SETTINGS,
} from '../data/seedCatalog.ts';
import type {
  BusinessSettings,
  CustomerInquiry,
  InquiryStatus,
  Project,
  ProjectLocation,
  ServiceItem,
} from '../types.ts';
import { db, handleFirestoreError, OperationType } from './firebase.ts';

function toSafeId(input: string, fallbackPrefix = 'item'): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || `${fallbackPrefix}-${Date.now()}`;
}

function generateUniqueDocId(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${toSafeId(prefix, 'doc')}-${suffix}`.slice(0, 120);
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.trim()) {
    return val;
  }
  return new Date().toISOString();
}

function mapLocation(id: string, data: DocumentData): ProjectLocation {
  return {
    id,
    area_name: String(data.area_name ?? ''),
    city: String(data.city ?? 'Cuttack'),
    lat: Number(data.lat ?? 20.4625),
    lng: Number(data.lng ?? 85.883),
    description: String(data.description ?? ''),
    created_at: timestampToIso(data.created_at),
  };
}

function mapProject(id: string, data: DocumentData): Project {
  const rawGallery = Array.isArray(data.gallery_images) ? data.gallery_images.map(String) : [];
  return {
    id,
    slug: String(data.slug ?? id),
    title: String(data.title ?? ''),
    work_type: String(data.work_type ?? ''),
    location_id: data.location_id ? String(data.location_id) : null,
    location_name: String(data.location_name ?? ''),
    city: String(data.city ?? 'Cuttack'),
    lat: Number(data.lat ?? 20.4625),
    lng: Number(data.lng ?? 85.883),
    completion_date: String(data.completion_date ?? ''),
    area_sqft: String(data.area_sqft ?? ''),
    duration_weeks: String(data.duration_weeks ?? ''),
    client_name: String(data.client_name ?? ''),
    summary: String(data.summary ?? ''),
    scope_details: String(data.scope_details ?? ''),
    before_image: String(data.before_image ?? ''),
    after_image: String(data.after_image ?? ''),
    gallery_images: rawGallery.length > 0 ? rawGallery : [String(data.after_image ?? '')].filter(Boolean),
    featured: Boolean(data.featured),
    created_at: timestampToIso(data.created_at),
  };
}

function mapService(id: string, data: DocumentData): ServiceItem {
  return {
    id,
    slug: String(data.slug ?? id),
    title: String(data.title ?? ''),
    category: String(data.category ?? 'Turnkey Interiors'),
    short_description: String(data.short_description ?? ''),
    materials_spec: String(data.materials_spec ?? ''),
    timeline_estimate: String(data.timeline_estimate ?? ''),
    image_url: String(data.image_url ?? ''),
    display_order: Number(data.display_order ?? 0),
    active: data.active !== false,
  };
}

function mapInquiry(id: string, data: DocumentData): CustomerInquiry {
  return {
    id,
    customer_name: String(data.customer_name ?? ''),
    mobile_number: String(data.mobile_number ?? ''),
    location: String(data.location ?? ''),
    service_required: String(data.service_required ?? ''),
    project_details: String(data.project_details ?? ''),
    project_ref_slug: data.project_ref_slug ? String(data.project_ref_slug) : null,
    status: (String(data.status ?? 'New') as InquiryStatus) || 'New',
    created_at: timestampToIso(data.created_at),
  };
}

export async function fetchPublicCatalog(): Promise<{
  projects: Project[];
  locations: ProjectLocation[];
  services: ServiceItem[];
  settings: BusinessSettings;
}> {
  let locations: ProjectLocation[] = [];
  let projects: Project[] = [];
  let services: ServiceItem[] = [];
  let settings: BusinessSettings = DEFAULT_SETTINGS;

  try {
    const locSnap = await getDocs(collection(db, 'locations'));
    locations = locSnap.docs.map((d) => mapLocation(d.id, d.data()));
  } catch (err) {
    if (String(err).toLowerCase().includes('permission')) {
      handleFirestoreError(err, OperationType.LIST, 'locations');
    }
  }

  try {
    const projSnap = await getDocs(collection(db, 'projects'));
    projects = projSnap.docs
      .map((d) => mapProject(d.id, d.data()))
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return b.created_at.localeCompare(a.created_at);
      });
  } catch (err) {
    if (String(err).toLowerCase().includes('permission')) {
      handleFirestoreError(err, OperationType.LIST, 'projects');
    }
  }

  try {
    const srvQuery = query(collection(db, 'services'), where('active', '==', true));
    const srvSnap = await getDocs(srvQuery);
    services = srvSnap.docs
      .map((d) => mapService(d.id, d.data()))
      .sort((a, b) => a.display_order - b.display_order);
  } catch (err) {
    if (String(err).toLowerCase().includes('permission')) {
      handleFirestoreError(err, OperationType.LIST, 'services');
    }
  }

  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'business'));
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      settings = {
        business_phone: String(data.business_phone ?? DEFAULT_SETTINGS.business_phone),
        whatsapp_number: String(data.whatsapp_number ?? DEFAULT_SETTINGS.whatsapp_number).replace(/\D/g, ''),
        business_email: String(data.business_email ?? DEFAULT_SETTINGS.business_email),
        workshop_address: String(data.workshop_address ?? DEFAULT_SETTINGS.workshop_address),
        working_hours: String(data.working_hours ?? DEFAULT_SETTINGS.working_hours),
      };
    }
  } catch (err) {
    if (String(err).toLowerCase().includes('permission')) {
      handleFirestoreError(err, OperationType.GET, 'settings/business');
    }
  }

  const finalLocations = locations.length > 0 ? locations : DEFAULT_LOCATIONS;
  const finalProjects = projects.length > 0 ? projects : DEFAULT_PROJECTS;
  const finalServices = services.length > 0 ? services : DEFAULT_SERVICES;

  const locationsWithCounts = finalLocations.map((loc) => ({
    ...loc,
    project_count: finalProjects.filter(
      (p) =>
        p.location_id === loc.id ||
        p.location_name.toLowerCase().includes(loc.area_name.toLowerCase())
    ).length,
  }));

  return {
    locations: locationsWithCounts,
    projects: finalProjects,
    services: finalServices,
    settings,
  };
}

export async function submitPublicInquiry(input: {
  customer_name: string;
  mobile_number: string;
  location: string;
  service_required: string;
  project_details: string;
  project_ref_slug: string | null;
}): Promise<{ id: string }> {
  const customer_name = input.customer_name.trim().slice(0, 120);
  const mobile_number = input.mobile_number.trim().replace(/[^\d+]/g, '').slice(0, 24);
  const digits = mobile_number.replace(/\D/g, '');
  const location = input.location.trim().slice(0, 160);
  const service_required = input.service_required.trim().slice(0, 120);
  const project_details = input.project_details.trim().slice(0, 2000);
  const project_ref_slug = input.project_ref_slug ? input.project_ref_slug.trim().slice(0, 120) : null;

  if (customer_name.length < 2) {
    throw new Error('Please enter your full name (at least 2 characters).');
  }
  if (digits.length < 10 || digits.length > 13) {
    throw new Error('Please enter a valid 10-digit mobile number.');
  }
  if (location.length < 2) {
    throw new Error('Please enter your city or area in Cuttack / Odisha.');
  }
  if (service_required.length < 2) {
    throw new Error('Please select a required service.');
  }

  const id = generateUniqueDocId('inq');
  const path = `inquiries/${id}`;
  try {
    await setDoc(doc(db, 'inquiries', id), {
      customer_name,
      mobile_number,
      location,
      service_required,
      project_details,
      project_ref_slug,
      status: 'New',
      created_at: serverTimestamp(),
    });
    return { id };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function ensureFirestoreSeeded(): Promise<void> {
  const [locSnap, projSnap, srvSnap, inqSnap, setSnap] = await Promise.all([
    getDocs(collection(db, 'locations')),
    getDocs(collection(db, 'projects')),
    getDocs(collection(db, 'services')),
    getDocs(collection(db, 'inquiries')),
    getDoc(doc(db, 'settings', 'business')),
  ]);

  const batch = writeBatch(db);
  let hasWrites = false;

  if (!setSnap.exists()) {
    batch.set(doc(db, 'settings', 'business'), {
      business_phone: DEFAULT_SETTINGS.business_phone,
      whatsapp_number: DEFAULT_SETTINGS.whatsapp_number,
      business_email: DEFAULT_SETTINGS.business_email,
      workshop_address: DEFAULT_SETTINGS.workshop_address,
      working_hours: DEFAULT_SETTINGS.working_hours,
    });
    hasWrites = true;
  }

  if (locSnap.empty) {
    for (const loc of DEFAULT_LOCATIONS) {
      batch.set(doc(db, 'locations', loc.id), {
        area_name: loc.area_name,
        city: loc.city,
        lat: loc.lat,
        lng: loc.lng,
        description: loc.description.slice(0, 400),
        created_at: serverTimestamp(),
      });
    }
    hasWrites = true;
  }

  if (srvSnap.empty) {
    for (const srv of DEFAULT_SERVICES) {
      batch.set(doc(db, 'services', srv.id), {
        slug: srv.slug,
        title: srv.title,
        category: srv.category,
        short_description: srv.short_description,
        materials_spec: srv.materials_spec,
        timeline_estimate: srv.timeline_estimate,
        image_url: srv.image_url,
        display_order: srv.display_order,
        active: srv.active,
      });
    }
    hasWrites = true;
  }

  if (projSnap.empty) {
    for (const proj of DEFAULT_PROJECTS) {
      batch.set(doc(db, 'projects', proj.id), {
        slug: proj.slug,
        title: proj.title,
        work_type: proj.work_type,
        location_id: proj.location_id,
        location_name: proj.location_name,
        city: proj.city,
        lat: proj.lat,
        lng: proj.lng,
        completion_date: proj.completion_date,
        area_sqft: proj.area_sqft,
        duration_weeks: proj.duration_weeks,
        client_name: proj.client_name,
        summary: proj.summary,
        scope_details: proj.scope_details,
        before_image: proj.before_image,
        after_image: proj.after_image,
        gallery_images: proj.gallery_images,
        featured: proj.featured,
        created_at: serverTimestamp(),
      });
    }
    hasWrites = true;
  }

  if (inqSnap.empty) {
    for (const inq of DEFAULT_INQUIRIES) {
      batch.set(doc(db, 'inquiries', inq.id), {
        customer_name: inq.customer_name,
        mobile_number: inq.mobile_number,
        location: inq.location,
        service_required: inq.service_required,
        project_details: inq.project_details,
        project_ref_slug: inq.project_ref_slug,
        status: 'New',
        created_at: serverTimestamp(),
      });
    }
    hasWrites = true;
  }

  if (hasWrites) {
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'seed_batch');
    }
  }
}

export function subscribeAdminOverview(callbacks: {
  onProjects: (projects: Project[]) => void;
  onLocations: (locations: ProjectLocation[]) => void;
  onServices: (services: ServiceItem[]) => void;
  onInquiries: (inquiries: CustomerInquiry[]) => void;
  onSettings: (settings: BusinessSettings) => void;
}): Unsubscribe {
  const unsubLoc = onSnapshot(
    collection(db, 'locations'),
    (snap) => {
      callbacks.onLocations(snap.docs.map((d) => mapLocation(d.id, d.data())));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'locations');
    }
  );

  const unsubProj = onSnapshot(
    collection(db, 'projects'),
    (snap) => {
      const list = snap.docs
        .map((d) => mapProject(d.id, d.data()))
        .sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return b.created_at.localeCompare(a.created_at);
        });
      callbacks.onProjects(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    }
  );

  const unsubSrv = onSnapshot(
    query(collection(db, 'services'), orderBy('display_order', 'asc')),
    (snap) => {
      callbacks.onServices(snap.docs.map((d) => mapService(d.id, d.data())));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
    }
  );

  const unsubInq = onSnapshot(
    query(collection(db, 'inquiries'), orderBy('created_at', 'desc')),
    (snap) => {
      callbacks.onInquiries(snap.docs.map((d) => mapInquiry(d.id, d.data())));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inquiries');
    }
  );

  const unsubSet = onSnapshot(
    doc(db, 'settings', 'business'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        callbacks.onSettings({
          business_phone: String(data.business_phone ?? DEFAULT_SETTINGS.business_phone),
          whatsapp_number: String(data.whatsapp_number ?? DEFAULT_SETTINGS.whatsapp_number).replace(/\D/g, ''),
          business_email: String(data.business_email ?? DEFAULT_SETTINGS.business_email),
          workshop_address: String(data.workshop_address ?? DEFAULT_SETTINGS.workshop_address),
          working_hours: String(data.working_hours ?? DEFAULT_SETTINGS.working_hours),
        });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/business');
    }
  );

  return () => {
    unsubLoc();
    unsubProj();
    unsubSrv();
    unsubInq();
    unsubSet();
  };
}

export async function saveProjectInFirestore(
  editingId: string | null,
  input: Omit<Project, 'id' | 'slug' | 'created_at'> & { slug?: string }
): Promise<void> {
  const title = input.title.trim().slice(0, 180);
  const work_type = input.work_type.trim().slice(0, 100);
  const location_name = input.location_name.trim().slice(0, 140);
  const city = (input.city || 'Cuttack').trim().slice(0, 80);
  const completion_date = input.completion_date.trim().slice(0, 60);
  const summary = input.summary.trim().slice(0, 1200);
  const scope_details = (input.scope_details || '').trim().slice(0, 2000);
  const area_sqft = (input.area_sqft || '').trim().slice(0, 60);
  const duration_weeks = (input.duration_weeks || '').trim().slice(0, 60);
  const client_name = (input.client_name || '').trim().slice(0, 120);
  const before_image = input.before_image.trim().slice(0, 500);
  const after_image = input.after_image.trim().slice(0, 500);
  const gallery_images = (input.gallery_images.length > 0 ? input.gallery_images : [after_image])
    .slice(0, 20)
    .map((u) => u.trim().slice(0, 500));

  if (title.length < 2 || work_type.length < 2 || location_name.length < 2 || summary.length < 5) {
    throw new Error('Title, work type, location, completion date, and summary are required.');
  }
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new Error('Valid latitude and longitude coordinates are required.');
  }

  const basePayload = {
    title,
    work_type,
    location_id: input.location_id ? String(input.location_id).slice(0, 128) : null,
    location_name,
    city,
    lat: Number(input.lat),
    lng: Number(input.lng),
    completion_date,
    area_sqft,
    duration_weeks,
    client_name,
    summary,
    scope_details,
    before_image,
    after_image,
    gallery_images,
    featured: Boolean(input.featured),
  };

  if (editingId) {
    const path = `projects/${editingId}`;
    try {
      await updateDoc(doc(db, 'projects', editingId), {
        slug: toSafeId(input.slug || title, 'project'),
        ...basePayload,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
    return;
  }

  const docId = generateUniqueDocId(title);
  const path = `projects/${docId}`;
  try {
    await setDoc(doc(db, 'projects', docId), {
      slug: docId,
      ...basePayload,
      created_at: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteProjectInFirestore(id: string): Promise<void> {
  const path = `projects/${id}`;
  try {
    await deleteDoc(doc(db, 'projects', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function createLocationInFirestore(input: {
  area_name: string;
  city: string;
  lat: number;
  lng: number;
  description: string;
}): Promise<void> {
  const area_name = input.area_name.trim().slice(0, 120);
  const city = (input.city || 'Cuttack').trim().slice(0, 80);
  const description = (input.description || '').trim().slice(0, 400);
  if (area_name.length < 2 || !Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new Error('Area name and valid coordinates are required.');
  }
  const id = generateUniqueDocId(area_name);
  const path = `locations/${id}`;
  try {
    await setDoc(doc(db, 'locations', id), {
      area_name,
      city,
      lat: Number(input.lat),
      lng: Number(input.lng),
      description,
      created_at: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteLocationInFirestore(id: string): Promise<void> {
  const path = `locations/${id}`;
  try {
    await deleteDoc(doc(db, 'locations', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveServiceInFirestore(
  editingId: string | null,
  input: {
    title: string;
    category: string;
    short_description: string;
    materials_spec: string;
    timeline_estimate: string;
    image_url: string;
    display_order: number;
    active: boolean;
  }
): Promise<void> {
  const title = input.title.trim().slice(0, 120);
  const category = (input.category || 'Turnkey Interiors').trim().slice(0, 80);
  const short_description = input.short_description.trim().slice(0, 500);
  const materials_spec = (input.materials_spec || '').trim().slice(0, 240);
  const timeline_estimate = (input.timeline_estimate || '').trim().slice(0, 80);
  const image_url = (input.image_url || '/src/assets/images/hero_living_room_1795511701089.jpg').trim().slice(0, 500);

  if (title.length < 2 || short_description.length < 5) {
    throw new Error('Service title and description are required.');
  }

  if (editingId) {
    const path = `services/${editingId}`;
    try {
      await updateDoc(doc(db, 'services', editingId), {
        slug: toSafeId(title, 'service'),
        title,
        category,
        short_description,
        materials_spec,
        timeline_estimate,
        image_url,
        display_order: Math.max(0, Math.round(input.display_order)),
        active: Boolean(input.active),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
    return;
  }

  const docId = generateUniqueDocId(title);
  const path = `services/${docId}`;
  try {
    await setDoc(doc(db, 'services', docId), {
      slug: docId,
      title,
      category,
      short_description,
      materials_spec,
      timeline_estimate,
      image_url,
      display_order: Math.max(0, Math.round(input.display_order)),
      active: Boolean(input.active),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteServiceInFirestore(id: string): Promise<void> {
  const path = `services/${id}`;
  try {
    await deleteDoc(doc(db, 'services', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function updateInquiryStatusInFirestore(id: string, status: InquiryStatus): Promise<void> {
  const path = `inquiries/${id}`;
  try {
    await updateDoc(doc(db, 'inquiries', id), { status });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteInquiryInFirestore(id: string): Promise<void> {
  const path = `inquiries/${id}`;
  try {
    await deleteDoc(doc(db, 'inquiries', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveBusinessSettingsInFirestore(settings: BusinessSettings): Promise<void> {
  const path = 'settings/business';
  try {
    await setDoc(doc(db, 'settings', 'business'), {
      business_phone: settings.business_phone.trim().slice(0, 32),
      whatsapp_number: settings.whatsapp_number.replace(/\D/g, '').slice(0, 20),
      business_email: settings.business_email.trim().slice(0, 180),
      workshop_address: settings.workshop_address.trim().slice(0, 240),
      working_hours: settings.working_hours.trim().slice(0, 120),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
