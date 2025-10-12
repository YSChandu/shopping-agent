export interface Phone {
  id: number;
  brand: string;
  model: string;
  price: number;
  release_year: number | null;
  os: string | null;
  ram: string | null;
  storage: string | null;
  display_type: string | null;
  display_size: string | null;
  resolution: string | null;
  refresh_rate: number | null;
  camera_main: string | null;
  camera_front: string | null;
  camera_features: string[] | null;
  battery: string | null;
  charging: string | null;
  processor: string | null;
  connectivity: string[] | null;
  sensors: string[] | null;
  features: string[] | null;
  weight: string | null;
  dimensions: string | null;
  rating: number | null;
  stock_status: string | null;
  category: string | null;
  colours: string[] | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  phoneRecommendations?: Phone[];
}

export interface SearchFilters {
  maxPrice?: number;
  minPrice?: number;
  brand?: string;
  os?: string;
  ram?: string;
  storage?: string;
  features?: string[];
}

export interface AIResponse {
  message: string;
  recommendations?: Phone[];
  searchFilters?: SearchFilters;
  isAdversarial?: boolean;
}
