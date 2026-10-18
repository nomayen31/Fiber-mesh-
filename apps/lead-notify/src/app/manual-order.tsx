/**
 * "ম্যানুয়াল অর্ডার যোগ করুন" — the phone-order entry form.
 *
 * This is the native port of the website's manual-order form. It talks to the
 * **existing** `POST /api/admin/orders` endpoint, which already:
 *
 *   - validates with `adminOrderSchema`,
 *   - snapshots the product name/price on the server (`createManualOrder`),
 *   - recomputes subtotal / discount / total with `priceFor()`,
 *   - and queues the `order.created` notification job.
 *
 * So nothing here is allowed to decide money: the price comes from
 * `GET /api/admin/meta` (i.e. from the database), and whatever the server
 * answers is what gets stored. The local `priceFor()` copy only powers the live
 * preview while the form is being filled in.
 *
 * Fields that the `Order` table genuinely does not have (a delivery charge, a
 * discount code, an inventory reservation) are deliberately absent rather than
 * faked in the UI.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Package,
  Save,
  Store,
  User,
  X,
} from "lucide-react-native";

import {
  Card,
  DetailRow,
  Divider,
  ErrorNotice,
  GhostButton,
  LoadingState,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui";
import {
  ORDER_STATUSES,
  formatBdt,
  formatNumber,
  priceFor,
  shortProductName,
  statusMeta,
} from "@/lib/format";
import { useSession } from "@/lib/session";
import { useApiData } from "@/lib/useApiData";
import type {
  AdminMetaDistrict,
  AdminMetaProduct,
  AdminMetaResponse,
  ManualOrderResponse,
  OrderStatus,
} from "@/lib/types";
import { colors, radius, space, typography } from "@/theme";

/** Mirrors `BD_PHONE_REGEX` in src/lib/validators.ts. */
const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;
const MAX_QUANTITY = 10000;
const MAX_UNIT_PRICE = 1_000_000;

/** Same normalisation the server performs before validating a phone number. */
function normalizePhone(value: string): string {
  const compact = value.replace(/[\s\-()]/g, "");
  if (compact.startsWith("+880")) return `0${compact.slice(4)}`;
  if (compact.startsWith("880")) return `0${compact.slice(3)}`;
  return compact;
}

type PickerItem = {
  key: string;
  label: string;
  hint?: string;
  selected: boolean;
};

export default function ManualOrderScreen() {
  const { request } = useSession();
  const router = useRouter();

  /* ── reference data: districts + products (with server-side prices) ── */
  const loadMeta = useCallback(
    () => request((api) => api.get<AdminMetaResponse>("/api/admin/meta")),
    [request],
  );
  const { data: meta, error: metaError, loading: metaLoading, reload } =
    useApiData(loadMeta);

  /* ── customer ── */
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");

  /* ── product line ── */
  const [productSlug, setProductSlug] = useState("");
  const [customProductName, setCustomProductName] = useState("");
  const [unitPriceText, setUnitPriceText] = useState("");
  const [quantityText, setQuantityText] = useState("1");
  const [applyBulkDiscount, setApplyBulkDiscount] = useState(true);

  /* ── everything else ── */
  const [status, setStatus] = useState<OrderStatus>("PENDING");
  const [note, setNote] = useState("");

  /* ── submission ── */
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [openPicker, setOpenPicker] = useState<null | "district" | "product" | "status">(null);

  // Memoised so the derived `selectedProduct` / `selectedDistrict` memos do not
  // recompute on every keystroke (the `?? []` literal is a new array each render).
  const districts: AdminMetaDistrict[] = useMemo(
    () => meta?.districts ?? [],
    [meta],
  );
  const products: AdminMetaProduct[] = useMemo(() => meta?.products ?? [], [meta]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.slug === productSlug) ?? null,
    [products, productSlug],
  );
  const selectedDistrict = useMemo(
    () => districts.find((item) => item.value === district) ?? null,
    [districts, district],
  );

  const unitPrice = useMemo(() => {
    const parsed = Number.parseInt(unitPriceText, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [unitPriceText]);

  const quantity = useMemo(() => {
    const parsed = Number.parseInt(quantityText, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [quantityText]);

  /** Live preview only — the server recomputes this on submit. */
  const preview = useMemo(() => {
    if (unitPrice <= 0 || quantity <= 0) return null;
    const breakdown = priceFor(unitPrice, quantity);
    if (applyBulkDiscount) return breakdown;
    return { ...breakdown, discountPercent: 0, discount: 0, total: unitPrice * breakdown.quantity };
  }, [unitPrice, quantity, applyBulkDiscount]);

  /** Pick a catalogue product → its price comes from the server, not the user. */
  const chooseProduct = useCallback(
    (slug: string) => {
      setProductSlug(slug);
      setOpenPicker(null);
      const product = products.find((item) => item.slug === slug);
      if (product) {
        setUnitPriceText(String(product.price));
        setCustomProductName("");
      }
    },
    [products],
  );

  const validate = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (customerName.trim().length < 3) {
      errors.customerName = "গ্রাহকের নাম কমপক্ষে ৩ অক্ষরের হতে হবে";
    } else if (customerName.trim().length > 80) {
      errors.customerName = "নাম অনেক বড় হয়ে গেছে";
    }

    if (!BD_PHONE_REGEX.test(normalizePhone(phone))) {
      errors.phone = "সঠিক মোবাইল নম্বর দিন (যেমন: 01711223344)";
    }

    if (address.trim().length > 300) {
      errors.address = "ঠিকানা অনেক বড় হয়ে গেছে";
    }

    if (!productSlug) {
      if (customProductName.trim().length === 0) {
        errors.product = "পণ্য নির্বাচন করুন, অথবা কাস্টম আইটেমের নাম লিখুন";
      } else if (customProductName.trim().length > 120) {
        errors.product = "পণ্যের নাম অনেক বড় হয়ে গেছে";
      }
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      errors.unitPrice = "একক দর ০ টাকার বেশি হতে হবে";
    } else if (unitPrice > MAX_UNIT_PRICE) {
      errors.unitPrice = "একক দর অনেক বেশি";
    }

    if (quantity < 1) {
      errors.quantity = "কমপক্ষে ১ রোল";
    } else if (quantity > MAX_QUANTITY) {
      errors.quantity = "একসাথে ১০,০০০ রোলের বেশি দিতে ফোন করুন";
    }

    if (note.trim().length > 500) {
      errors.note = "নোট ৫০০ অক্ষরের মধ্যে রাখুন";
    }

    return errors;
  }, [
    customerName,
    phone,
    address,
    productSlug,
    customProductName,
    unitPrice,
    quantity,
    note,
  ]);

  const submit = useCallback(async () => {
    // Second press while the first request is in flight is a no-op: the button
    // is also disabled, this is the belt-and-braces guard.
    if (submitting) return;

    const errors = validate();
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) {
      setFormError("ফর্মে কিছু তথ্য ঠিক নেই। লাল লেখা দেখে ঠিক করুন।");
      return;
    }

    setSubmitting(true);
    try {
      const response = await request((api) =>
        api.post<ManualOrderResponse>("/api/admin/orders", {
          customerName: customerName.trim(),
          phone: normalizePhone(phone),
          district: district || undefined,
          address: address.trim() || undefined,
          productSlug: productSlug || undefined,
          // Only a custom line needs a name; for a catalogue product the server
          // snapshots the real product name itself.
          productName: productSlug ? undefined : customProductName.trim(),
          unitPrice,
          quantity,
          applyBulkDiscount,
          status,
          source: "MANUAL",
          note: note.trim() || undefined,
        }),
      );

      // Straight to the saved order, which re-fetches it through the
      // authenticated API. `replace` so "back" does not return to a filled form.
      router.replace({
        pathname: "/order/[id]",
        params: { id: response.order.id, created: "1" },
      });
    } catch (error) {
      const apiError = error as Error & { fields?: Record<string, string> };
      if (apiError.fields) setFieldErrors(apiError.fields);
      setFormError(apiError.message ?? "অর্ডার যোগ করা যায়নি।");
      setSubmitting(false);
    }
  }, [
    submitting,
    validate,
    request,
    customerName,
    phone,
    district,
    address,
    productSlug,
    customProductName,
    unitPrice,
    quantity,
    applyBulkDiscount,
    status,
    note,
    router,
  ]);

  const resetForm = useCallback(() => {
    setCustomerName("");
    setPhone("");
    setDistrict("");
    setAddress("");
    setProductSlug("");
    setCustomProductName("");
    setUnitPriceText("");
    setQuantityText("1");
    setApplyBulkDiscount(true);
    setStatus("PENDING");
    setNote("");
    setFieldErrors({});
    setFormError(null);
  }, []);

  if (metaLoading && !meta) {
    return (
      <View style={styles.centered}>
        <LoadingState label="তথ্য আনা হচ্ছে..." />
      </View>
    );
  }

  if (metaError && !meta) {
    return (
      <View style={styles.centered}>
        <ErrorNotice message={metaError} onRetry={reload} />
      </View>
    );
  }

  const productLabel = selectedProduct
    ? `${shortProductName(selectedProduct.name)} — ${formatBdt(selectedProduct.price)}`
    : customProductName.trim().length > 0
      ? customProductName.trim()
      : "";

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {formError ? <ErrorNotice message={formError} /> : null}

        {/* ───────────────────────── গ্রাহকের তথ্য ───────────────────────── */}
        <Card>
          <View style={styles.titleRow}>
            <User size={16} color={colors.slate[700]} />
            <Text style={styles.cardTitle}>গ্রাহকের তথ্য</Text>
          </View>

          <Field label="গ্রাহকের নাম" required error={fieldErrors.customerName}>
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="যেমন: নোমায়েন হোসেন"
              placeholderTextColor={colors.slate[400]}
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </Field>

          <Field label="মোবাইল নম্বর" required error={fieldErrors.phone}>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="01711223344"
              placeholderTextColor={colors.slate[400]}
              style={styles.input}
              keyboardType="phone-pad"
              maxLength={20}
              returnKeyType="next"
            />
          </Field>

          <Field label="জেলা" error={fieldErrors.district}>
            <PickerField
              display={selectedDistrict ? selectedDistrict.label : ""}
              placeholder="জেলা নির্বাচন করুন"
              onPress={() => setOpenPicker("district")}
              disabled={districts.length === 0}
            />
            {selectedDistrict ? (
              <Text style={styles.hintText}>
                {selectedDistrict.division} • ডেলিভারি {selectedDistrict.delivery}
              </Text>
            ) : null}
          </Field>

          <Field label="ডেলিভারি ঠিকানা" error={fieldErrors.address}>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="গ্রাম/বাসা, রোড, থানা"
              placeholderTextColor={colors.slate[400]}
              style={[styles.input, styles.inputMultiline]}
              multiline
              numberOfLines={3}
              maxLength={300}
            />
          </Field>
        </Card>

        {/* ───────────────────────── পণ্য ───────────────────────── */}
        <Card>
          <View style={styles.titleRow}>
            <Package size={16} color={colors.slate[700]} />
            <Text style={styles.cardTitle}>পণ্য</Text>
          </View>

          <Field label="পণ্য নির্বাচন করুন" required error={fieldErrors.product}>
            <PickerField
              display={productLabel}
              placeholder="পণ্য নির্বাচন করুন"
              onPress={() => setOpenPicker("product")}
              disabled={products.length === 0}
            />
          </Field>

          {productSlug ? (
            <View style={styles.selectedProductBox}>
              <Text style={styles.selectedProductName}>
                {selectedProduct?.name ?? productSlug}
              </Text>
              <Text style={styles.selectedProductMeta}>
                দর: {formatBdt(unitPrice)} / {selectedProduct?.unit ?? "রোল"}
                {selectedProduct?.gsm ? ` • ${selectedProduct.gsm} GSM` : ""}
              </Text>
              <Text style={styles.selectedProductNote}>
                দরটি সার্ভার থেকে আসছে — নিজে লিখতে হবে না।
              </Text>
            </View>
          ) : (
            <>
              <Field label="কাস্টম আইটেমের নাম" error={undefined}>
                <TextInput
                  value={customProductName}
                  onChangeText={setCustomProductName}
                  placeholder="যেমন: ৪৫ GSM মেশ ১ মিটার কাটা"
                  placeholderTextColor={colors.slate[400]}
                  style={styles.input}
                  maxLength={120}
                />
              </Field>

              <Field label="একক দর (৳)" required error={fieldErrors.unitPrice}>
                <TextInput
                  value={unitPriceText}
                  onChangeText={setUnitPriceText}
                  placeholder="0"
                  placeholderTextColor={colors.slate[400]}
                  style={styles.input}
                  keyboardType="number-pad"
                  maxLength={7}
                />
              </Field>
            </>
          )}

          <Field label="পরিমাণ (রোল)" required error={fieldErrors.quantity}>
            <View style={styles.quantityRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="এক কম করুন"
                onPress={() =>
                  setQuantityText(String(Math.max(1, (quantity || 1) - 1)))
                }
                style={({ pressed }) => [styles.stepButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.stepButtonText}>−</Text>
              </Pressable>
              <TextInput
                value={quantityText}
                onChangeText={setQuantityText}
                placeholder="1"
                placeholderTextColor={colors.slate[400]}
                style={[styles.input, styles.quantityInput]}
                keyboardType="number-pad"
                maxLength={5}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="এক বাড়ান"
                onPress={() =>
                  setQuantityText(String(Math.min(MAX_QUANTITY, (quantity || 0) + 1)))
                }
                style={({ pressed }) => [styles.stepButton, pressed ? styles.pressed : null]}
              >
                <Text style={styles.stepButtonText}>+</Text>
              </Pressable>
            </View>
          </Field>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: applyBulkDiscount }}
            onPress={() => setApplyBulkDiscount((value) => !value)}
            style={({ pressed }) => [styles.checkRow, pressed ? styles.pressed : null]}
          >
            <View
              style={[
                styles.checkBox,
                applyBulkDiscount ? styles.checkBoxOn : null,
              ]}
            >
              {applyBulkDiscount ? (
                <Check size={13} color={colors.white} strokeWidth={3} />
              ) : null}
            </View>
            <Text style={styles.checkLabel}>
              পাইকারি ছাড় প্রয়োগ করুন (৫+ রোলে ২%, ১০+ এ ৫%, ২৫+ এ ১০%)
            </Text>
          </Pressable>
        </Card>

        {/* ───────────────────────── হিসাব ───────────────────────── */}
        <Card>
          <SectionTitle>হিসাব</SectionTitle>
          <DetailRow
            label="একক দর"
            value={formatBdt(preview?.unitPrice ?? unitPrice)}
          />
          <Divider />
          <DetailRow
            label={`পরিমাণ`}
            value={`${formatNumber(preview?.quantity ?? quantity)} রোল`}
          />
          <Divider />
          <DetailRow
            label="সাবটোটাল"
            value={formatBdt(preview?.subtotal ?? 0)}
          />
          {preview && preview.discount > 0 ? (
            <>
              <Divider />
              <DetailRow
                label={`পাইকারি ছাড় (${preview.discountPercent}%)`}
                value={`− ${formatBdt(preview.discount)}`}
                valueStyle={{ color: colors.emerald[700] }}
              />
            </>
          ) : null}
          <Divider />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>সর্বমোট</Text>
            <Text style={styles.totalValue}>{formatBdt(preview?.total ?? 0)}</Text>
          </View>
          <Text style={styles.totalNote}>
            টাকার হিসাব সার্ভারেই আবার যাচাই হয়। ডেলিভারি চার্জ এই অর্ডারে যোগ হয়
            না — ডেলিভারির সময় আলাদা নেওয়া হয়।
          </Text>
        </Card>

        {/* ───────────────────────── অন্যান্য ───────────────────────── */}
        <Card>
          <View style={styles.titleRow}>
            <Store size={16} color={colors.slate[700]} />
            <Text style={styles.cardTitle}>অর্ডারের অবস্থা ও নোট</Text>
          </View>

          <Field label="অবস্থা">
            <PickerField
              display={statusMeta(status).label}
              placeholder="অবস্থা নির্বাচন করুন"
              onPress={() => setOpenPicker("status")}
            />
          </Field>

          <Field label="নোট (ঐচ্ছিক)" error={fieldErrors.note}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="যেমন: কুরিয়ারে দেওয়া হয়েছে, গ্রাহক নিজে নেবেন"
              placeholderTextColor={colors.slate[400]}
              style={[styles.input, styles.inputMultiline]}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </Field>

          <View style={styles.sourceRow}>
            <Text style={styles.sourceText}>
              সোর্স: ম্যানুয়াল এন্ট্রি • সাবমিটের পর অর্ডারটি সাধারণ অর্ডারের মতোই
              নোটিফিকেশন পাঠাবে।
            </Text>
          </View>
        </Card>

        <View style={styles.submitRow}>
          <PrimaryButton
            label={submitting ? "সেভ হচ্ছে..." : "অর্ডার সেভ করুন"}
            icon={Save}
            onPress={() => void submit()}
            loading={submitting}
            disabled={submitting}
          />
          <GhostButton
            label="ফর্ম খালি করুন"
            icon={X}
            onPress={resetForm}
          />
        </View>

        {products.length === 0 ? (
          <View style={styles.noteBox}>
            <AlertTriangle size={15} color={colors.amber[700]} />
            <Text style={styles.noteText}>
              কোনো সক্রিয় পণ্য পাওয়া যায়নি। তখন কাস্টম আইটেম হিসেবে নাম ও দর
              লিখে অর্ডার যোগ করা যাবে।
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ───────────────────────── pickers ───────────────────────── */}
      <PickerSheet
        visible={openPicker === "district"}
        title="জেলা নির্বাচন করুন"
        items={districts.map((item) => ({
          key: item.value,
          label: item.label,
          hint: `${item.division} • ${item.delivery}`,
          selected: item.value === district,
        }))}
        onSelect={(key) => {
          setDistrict(key);
          setOpenPicker(null);
        }}
        onClose={() => setOpenPicker(null)}
      />

      <PickerSheet
        visible={openPicker === "product"}
        title="পণ্য নির্বাচন করুন"
        items={products.map((product) => ({
          key: product.slug,
          label: product.name,
          hint: `${formatBdt(product.price)} / ${product.unit}${
            product.gsm ? ` • ${product.gsm} GSM` : ""
          }`,
          selected: product.slug === productSlug,
        }))}
        onSelect={chooseProduct}
        onClose={() => setOpenPicker(null)}
      />

      <PickerSheet
        visible={openPicker === "status"}
        title="অর্ডারের অবস্থা"
        items={ORDER_STATUSES.map((key) => ({
          key,
          label: statusMeta(key).label,
          selected: key === status,
        }))}
        onSelect={(key) => {
          setStatus(key as OrderStatus);
          setOpenPicker(null);
        }}
        onClose={() => setOpenPicker(null)}
      />
    </KeyboardAvoidingView>
  );
}

/* ────────────────────────────── sub-components ────────────────────────────── */

function Field({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function PickerField({
  display,
  placeholder,
  onPress,
  disabled = false,
}: {
  display: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const empty = display.length === 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.input,
        styles.pickerField,
        disabled ? styles.pickerDisabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text
        style={empty ? styles.pickerPlaceholder : styles.pickerValue}
        numberOfLines={1}
      >
        {empty ? placeholder : display}
      </Text>
      <ChevronDown size={16} color={colors.slate[400]} />
    </Pressable>
  );
}

/** A tiny bottom-sheet list — no third-party picker dependency. */
function PickerSheet({
  visible,
  title,
  items,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: PickerItem[];
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="বন্ধ করুন"
            hitSlop={8}
          >
            <X size={18} color={colors.slate[500]} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          {items.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: item.selected }}
              onPress={() => onSelect(item.key)}
              style={({ pressed }) => [
                styles.sheetRow,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.sheetRowText}>
                <Text
                  style={[
                    styles.sheetRowLabel,
                    item.selected ? styles.sheetRowLabelActive : null,
                  ]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
                {item.hint ? (
                  <Text style={styles.sheetRowHint}>{item.hint}</Text>
                ) : null}
              </View>
              {item.selected ? (
                <Check size={16} color={colors.brand[600]} strokeWidth={2.6} />
              ) : null}
            </Pressable>
          ))}
          {items.length === 0 ? (
            <Muted>কোনো তথ্য পাওয়া যায়নি।</Muted>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate[100] },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  centered: {
    flex: 1,
    justifyContent: "center",
    padding: space.lg,
    backgroundColor: colors.slate[100],
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: space.md,
  },
  cardTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
  },

  field: { marginBottom: space.md },
  fieldLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.slate[700],
    marginBottom: 6,
  },
  requiredMark: { color: colors.rose[600] },
  fieldError: {
    marginTop: 5,
    fontSize: typography.size.xs,
    color: colors.rose[700],
  },

  input: {
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: typography.size.base,
    color: colors.slate[900],
  },
  inputMultiline: { minHeight: 76, textAlignVertical: "top" },

  pickerField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  pickerPlaceholder: {
    fontSize: typography.size.base,
    color: colors.slate[400],
    flex: 1,
  },
  pickerValue: {
    fontSize: typography.size.base,
    color: colors.slate[900],
    flex: 1,
  },
  pickerDisabled: { opacity: 0.5 },

  hintText: {
    marginTop: 5,
    fontSize: typography.size.xs,
    color: colors.slate[500],
  },

  quantityRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  quantityInput: { flex: 1, textAlign: "center" },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.slate[100],
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.slate[700],
  },
  pressed: { opacity: 0.75 },

  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.slate[300],
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkBoxOn: { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
  checkLabel: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.slate[700],
    lineHeight: 20,
  },

  selectedProductBox: {
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[100],
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
    gap: 3,
  },
  selectedProductName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.slate[900],
  },
  selectedProductMeta: {
    fontSize: typography.size.sm,
    color: colors.brand[700],
    fontWeight: typography.weight.medium,
  },
  selectedProductNote: { fontSize: typography.size.xs, color: colors.slate[500] },

  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.sm,
  },
  totalLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
  },
  totalValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.brand[700],
  },
  totalNote: {
    marginTop: 4,
    fontSize: typography.size.xs,
    color: colors.slate[500],
    lineHeight: 18,
  },

  sourceRow: { marginTop: space.sm },
  sourceText: {
    fontSize: typography.size.xs,
    color: colors.slate[500],
    lineHeight: 18,
  },

  submitRow: { gap: space.sm },

  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: colors.amber[50],
    borderWidth: 1,
    borderColor: colors.amber[200],
    borderRadius: radius.md,
    padding: space.md,
  },
  noteText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.amber[700],
    lineHeight: 20,
  },

  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)" },
  sheet: {
    maxHeight: "70%",
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: space.lg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  sheetTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  sheetRowText: { flex: 1, gap: 2 },
  sheetRowLabel: {
    fontSize: typography.size.sm,
    color: colors.slate[800],
  },
  sheetRowLabelActive: {
    color: colors.brand[700],
    fontWeight: typography.weight.semibold,
  },
  sheetRowHint: { fontSize: typography.size.xs, color: colors.slate[500] },
});
