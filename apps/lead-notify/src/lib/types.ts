/**
 * Response shapes of the existing backend, mirrored for the app.
 *
 * Kept in sync with `src/lib/types.ts` on the website. Only the fields the app
 * actually renders are declared — TypeScript only needs the shape it reads, and
 * an extra server-side field can never break the app.
 */

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELLED";

export type OrderSource = "WEBSITE" | "PHONE" | "MANUAL";

/** One row of `GET /api/admin/orders` and the `order` of `GET /api/admin/orders/:id`. */
export type Order = {
  id: string;
  orderNo: string;
  customerName: string;
  phone: string;
  district: string | null;
  address: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discount: number;
  total: number;
  status: OrderStatus;
  source: OrderSource;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderListResponse = {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filteredRevenue: number;
  filteredRolls: number;
};

export type SingleOrderResponse = { ok: true; order: Order };

/* ─────────────────────────── inquiries ─────────────────────────── */

export type Inquiry = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  subject: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type InquiryListResponse = {
  inquiries: Inquiry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/* ──────────────────────────── stats ──────────────────────────── */

export type StatsRangeKey = "7d" | "30d" | "90d";

export type StatsSeriesPoint = {
  date: string;
  label: string;
  orders: number;
  revenue: number;
  rolls: number;
};

export type RecentOrder = {
  id: string;
  orderNo: string;
  customerName: string;
  phone: string;
  productName: string;
  quantity: number;
  total: number;
  status: OrderStatus;
  source: OrderSource;
  createdAt: string;
};

export type AdminStats = {
  range: StatsRangeKey;
  days: number;
  windowStart: string;
  generatedAt: string;
  cards: {
    ordersToday: number;
    ordersWeek: number;
    ordersMonth: number;
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    rollsThisMonth: number;
    totalOrders: number;
    totalRevenue: number;
    totalRolls: number;
    avgOrderValue: number;
    websiteSubmissions: number;
    manualOrders: number;
    phoneOrders: number;
    totalFormSubmissions: number;
    inquiries: number;
    unreadInquiries: number;
    todaySubmissions: number;
  };
  series: StatsSeriesPoint[];
  statusBreakdown: { status: string; count: number }[];
  sourceBreakdown: { source: string; count: number }[];
  topProducts: {
    productName: string;
    orders: number;
    rolls: number;
    revenue: number;
  }[];
  recentOrders: RecentOrder[];
};

/* ─────────────────────── device registration ─────────────────────── */

export type RegisteredDevice = {
  id: string;
  platform: string;
  label: string | null;
  isActive: boolean;
  lastSeenAt: string;
  createdAt: string;
  tokenPreview: string;
};

export type DeviceListResponse = {
  ok: true;
  devices: RegisteredDevice[];
  /** False when the *server* has no Firebase Admin credentials yet. */
  pushConfigured: boolean;
  missingServerKeys: string[];
  enabledEvents: string[];
};

export type DeviceRegisterResponse = { ok: true; device: RegisteredDevice };

/** `POST /api/admin/mobile/login` */
export type MobileLoginResponse = {
  ok: true;
  token: string;
  tokenType: "Bearer";
  /** Seconds. */
  expiresIn: number;
};
