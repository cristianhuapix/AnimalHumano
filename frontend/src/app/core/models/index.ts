// User & Profile
export interface User {
  id: string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  city?: string;
  country: string;
  language: string;
  photo_url?: string;
  is_admin: boolean;
  is_provider: boolean;
  created_at: string;
  updated_at: string;
}

// Species & Breeds
export interface Species {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Breed {
  id: string;
  species_id: string;
  name: string;
  code: string;
  species?: Species;
  created_at: string;
}

// Pets
export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  birth_date: string;
  species_id: string;
  breed_id: string;
  sex: 'M' | 'F';
  photo_url?: string;
  papers_url?: string;
  crossable: boolean;
  has_pedigree: boolean;
  dnia?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  species?: Species;
  breed?: Breed;
}

// Vaccines
export interface Vaccine {
  id: string;
  name: string;
  species_id?: string;
  required: boolean;
  description?: string;
  interval_days?: number;
  contagious_to_humans: boolean;
  created_at: string;
  species?: Species;
}

export interface PetVaccination {
  id: string;
  pet_id: string;
  vaccine_id: string;
  applied_on: string;
  next_due_on?: string;
  applied_by?: string;
  notes?: string;
  created_at: string;
  vaccine?: Vaccine;
}

// Medical Records
export interface MedicalRecord {
  id: string;
  pet_id: string;
  record_date: string;
  title: string;
  description: string;
  attachments?: any;
  created_by?: string;
  created_at: string;
}

// Providers
export type ServiceType = 'veterinarian' | 'groomer' | 'walker' | 'trainer' | 'sitter' | 'petshop' | 'shelter' | 'other';

export interface Provider {
  id: string;
  profile_id: string;
  service_type: ServiceType;
  description?: string;
  license_number?: string;
  license_verified: boolean;
  address?: string;
  google_place_id?: string;
  latitude?: number;
  longitude?: number;
  rating: number;
  rating_count: number;
  active: boolean;
  plan_type: 'free' | 'basic' | 'premium';
  plan_fee: number;
  plan_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderRating {
  id: string;
  provider_id: string;
  rated_by: string;
  rating: number;
  comment?: string;
  created_at: string;
}

// Appointments
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: string;
  user_id: string;
  provider_id: string;
  pet_id?: string;
  scheduled_at: string;
  duration_mins: number;
  status: AppointmentStatus;
  notes?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  provider?: Provider;
  pet?: Pet;
}

// Breeding
export type BreedingStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface BreedingIntent {
  id: string;
  from_pet_id: string;
  to_pet_id: string;
  status: BreedingStatus;
  message?: string;
  created_at: string;
  updated_at: string;
  responded_at?: string;
  from_pet?: Pet;
  to_pet?: Pet;
}

// Walks
export interface Walk {
  id: string;
  pet_id: string;
  walker_id: string;
  pickup_scanned_at?: string;
  dropoff_scanned_at?: string;
  auto_closed: boolean;
  notes?: string;
  route_data?: any;
  created_at: string;
  pet?: Pet;
  walker?: Provider;
}

// Lost Pets
export type ReportType = 'lost' | 'found';

export interface LostPetReport {
  id: string;
  pet_id?: string;
  reporter_id: string;
  report_type: ReportType;
  species_id?: string;
  breed_id?: string;
  description: string;
  contact_phone?: string;
  last_seen_at?: string;
  latitude?: number;
  longitude?: number;
  found: boolean;
  found_at?: string;
  created_at: string;
  updated_at: string;
  pet?: Pet;
  species?: Species;
  breed?: Breed;
  images?: LostPetImage[];
}

export interface LostPetImage {
  id: string;
  report_id: string;
  image_url: string;
  created_at: string;
}

// Conversations & Messages
export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  profile_id: string;
  is_provider: boolean;
  joined_at: string;
  hidden: boolean;
  profile?: User;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: User;
}

// Notifications
export type NotificationType = 'vaccine_reminder' | 'appointment_reminder' | 'message' |
  'lost_pet_alert' | 'breeding_request' | 'system' | 'walk_started' | 'walk_ended';

export interface Notification {
  id: string;
  profile_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
  is_read: boolean;
  created_at: string;
  expires_at?: string;
}

// QR Codes
export interface QRCode {
  id: string;
  pet_id: string;
  qr_code: string;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
}

export type ScanType = 'veterinary' | 'walk_start' | 'walk_end' | 'general';

export interface QRScan {
  id: string;
  pet_id: string;
  scanned_by: string;
  qr_code: string;
  scanned_at: string;
  expires_at: string;
  scan_type: ScanType;
  is_active: boolean;
  pet?: Pet;
}

// API Response wrappers
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
}
