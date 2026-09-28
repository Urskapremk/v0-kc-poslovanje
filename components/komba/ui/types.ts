// Shared types for Komba Cabana app

export interface OrderItem {
  id: string;
  name: string;
  category: string;
  qty: number;
  priceAr: number;
  paymentStatus?: string | null;
}

export interface TransferData {
  route: string;
  time: string;
  flightNumber?: string;
  flightTime?: string;
  pickupDate?: string;
  pax?: number;
  notes?: string;
  boatId?: string;
  boatPortTime?: string;
  hermanAirportTime?: string;
  dilipOrderedAt?: string | null;
  hermanOrderedAt?: string | null;
  guestPrice: number;
  paymentStatus: string; // 'PREPAID', 'UNPAID', 'PAID'
  executed?: boolean;
  executedAt?: string | null;
}

export interface Reservation {
  id: string;
  guestName: string;
  bungalow: string;
  pax: number;
  arrival: string;
  departure: string;
  status: string;
  bookingSource?: string | null;
  agencyName?: string | null;
  nationality?: string | null;
  passport?: string | null;
  email?: string | null;
  phone?: string | null;
  allergies?: string | null;
  honeymoon?: boolean | null;
  notes?: string | null;
  mealPlan?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  transfers: {
    arrival: TransferData;
    departure: TransferData;
  };
  orderItems: OrderItem[];
}
