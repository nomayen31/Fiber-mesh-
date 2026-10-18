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
  /** False when the *server* has no usable Firebase Admin credentials. */
  pushConfigured: boolean;
  missingServerKeys: string[];
  /**
   * Present when `pushConfigured` is false *and* no variable is missing — i.e.
   * the credential is set but unusable. Field names only, never values.
   */
  pushConfigIssue: PushConfigIssue | null;
  enabledEvents: string[];
};

/** Why the server cannot send a push. Carries no credential material. */
export type PushConfigIssue = {
  code:
    | "no-credentials"
    | "invalid-json"
    | "missing-fields"
    | "invalid-private-key"
    | "init-failed";
  detail: string;
};

export type DeviceRegisterResponse = { ok: true; device: RegisteredDevice };

/* ────────────────── reference data for the manual-order form ────────────────── */

export type AdminMetaDistrict = {
  /** Stored value, e.g. "Feni". */
  value: string;
  /** Bengali name shown in the picker. */
  label: string;
  division: string;
  delivery: string;
};

export type AdminMetaProduct = {
  slug: string;
  name: string;
  nameEn: string | null;
  gsm: number | null;
  /** Current server-side price per roll — the app never invents one. */
  price: number;
  unit: string;
};

export type AdminMetaResponse = {
  districts: AdminMetaDistrict[];
  products: AdminMetaProduct[];
};

/**
 * Body of `POST /api/admin/orders`, i.e. the website's `adminOrderSchema`.
 *
 * `unitPrice` is required by that schema. The app sends the price it was given
 * by `GET /api/admin/meta` (never a typed-in one), and the server recomputes
 * subtotal / discount / total from it, so the client can never set the total.
 */
export type ManualOrderInput = {
  customerName: string;
  phone: string;
  district?: string;
  address?: string;
  productSlug?: string;
  productName?: string;
  unitPrice: number;
  quantity: number;
  applyBulkDiscount?: boolean;
  status?: OrderStatus;
  source?: OrderSource;
  note?: string;
};

/** What `createManualOrder()` actually returns (a subset of `Order`). */
export type CreatedOrder = {
  id: string;
  orderNo: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  status: OrderStatus;
  district: string | null;
  createdAt: string;
};

export type ManualOrderResponse = { ok: true; order: CreatedOrder };

/* ──────────────────────── notification self-test ──────────────────────── */

export type PushTestOutcome = "sent" | "invalid-token" | "failed" | "skipped";

export type PushTestDeviceResult = {
  deviceId: string;
  label: string | null;
  outcome: PushTestOutcome;
  /** A sanitized FCM code, never a token. */
  error?: string;
};

export type PushTestResponse = {
  ok: true;
  sentCount: number;
  results: PushTestDeviceResult[];
};

/** `POST /api/admin/mobile/login` */
export type MobileLoginResponse = {
  ok: true;
  token: string;
  tokenType: "Bearer";
  /** Seconds. */
  expiresIn: number;
};
