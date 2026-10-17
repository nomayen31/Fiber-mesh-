/** Types shared between server and client components (no server-only imports). */

export type ProductSpec = { label: string; value: string };

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  tagline: string | null;
  description: string;
  gsm: number | null;
  price: number;
  unit: string;
  badge: string | null;
  imageUrl: string | null;
  specs: ProductSpec[];
};

export type OrderRow = {
  id: string;
  orderNo: string;
  customerName: string;
  phone: string;
  address: string | null;
  district: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discount: number;
  total: number;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "COMPLETED" | "CANCELLED";
  source: "WEBSITE" | "PHONE" | "MANUAL";
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderListResponse = {
  orders: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filteredRevenue: number;
  filteredRolls: number;
};

export type InquiryRow = {
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
  inquiries: InquiryRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/* ─────────────────────── admin analytics ─────────────────────── */

export type StatsRangeKey = "7d" | "30d" | "90d";

export type StatsSeriesPoint = {
  date: string;
  label: string;
  orders: number;
  revenue: number;
  rolls: number;
};

export type RecentOrderRow = {
  id: string;
  orderNo: string;
  customerName: string;
  phone: string;
  productName: string;
  quantity: number;
  total: number;
  status: OrderRow["status"];
  source: OrderRow["source"];
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
  recentOrders: RecentOrderRow[];
};
