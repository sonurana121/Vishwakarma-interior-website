export interface ProjectLocation {
  id: string;
  area_name: string;
  city: string;
  lat: number;
  lng: number;
  description: string;
  created_at: string;
  project_count?: number;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  work_type: string;
  location_id: string | null;
  location_name: string;
  city: string;
  lat: number;
  lng: number;
  completion_date: string;
  area_sqft: string;
  duration_weeks: string;
  client_name: string;
  summary: string;
  scope_details: string;
  before_image: string;
  after_image: string;
  gallery_images: string[];
  featured: boolean;
  created_at: string;
}

export interface ServiceItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  short_description: string;
  materials_spec: string;
  timeline_estimate: string;
  image_url: string;
  display_order: number;
  active: boolean;
}

export type InquiryStatus = 'New' | 'Contacted' | 'Site Visit Scheduled' | 'Completed';

export interface CustomerInquiry {
  id: string;
  customer_name: string;
  mobile_number: string;
  location: string;
  service_required: string;
  project_details: string;
  project_ref_slug: string | null;
  status: InquiryStatus;
  created_at: string;
}

export interface BusinessSettings {
  business_phone: string;
  whatsapp_number: string;
  business_email: string;
  workshop_address: string;
  working_hours: string;
}

export interface PublicBootstrapData {
  projects: Project[];
  locations: ProjectLocation[];
  services: ServiceItem[];
  settings: BusinessSettings;
  mapsApiKey: string;
}
