import { z } from "zod";

// Limits from config/kachi.php (catalog) and the BackOffice FormRequests.
export const MAX_OPTIONS = 2;
export const MAX_OPTION_VALUES = 20;
export const MAX_VARIANTS = 50;
export const MAX_IMAGES = 9;
export const TAX_CLASSES = ["standard", "zero_rated", "exempt"] as const;

const MONEY = /^\d{1,7}(\.\d{1,2})?$/;
const SELLER_SKU = /^[A-Z0-9][A-Z0-9._-]*$/;

type Ctx = z.RefinementCtx;
type Path = (string | number)[];

// ---------------------------------------------------------------------------
// Field checks shared by the create form and the variant dialogs. Inputs stay strings in the
// form so an empty box is "", and these helpers add issues at the right path.
// ---------------------------------------------------------------------------

function checkMoney(ctx: Ctx, path: Path, value: string, label: string, required: boolean): number | null {
  const text = value.trim();
  if (text === "") {
    if (required) ctx.addIssue({ code: "custom", path, message: `Enter the ${label}.` });
    return null;
  }
  if (!MONEY.test(text)) {
    ctx.addIssue({ code: "custom", path, message: "Use a number with up to 2 decimals, e.g. 49.90." });
    return null;
  }
  const amount = Number(text);
  if (amount < 0.01) {
    ctx.addIssue({ code: "custom", path, message: `The ${label} must be at least 0.01.` });
    return null;
  }
  return amount;
}

function checkInt(
  ctx: Ctx,
  path: Path,
  value: string,
  { label, min, max, required }: { label: string; min: number; max: number; required: boolean },
): number | null {
  const text = value.trim();
  if (text === "") {
    if (required) ctx.addIssue({ code: "custom", path, message: `Enter the ${label}.` });
    return null;
  }
  if (!/^-?\d+$/.test(text)) {
    ctx.addIssue({ code: "custom", path, message: "Use a whole number." });
    return null;
  }
  const n = Number(text);
  if (n < min || n > max) {
    ctx.addIssue({ code: "custom", path, message: `Use a number from ${min.toLocaleString()} to ${max.toLocaleString()}.` });
    return null;
  }
  return n;
}

function checkSellerSku(ctx: Ctx, path: Path, value: string) {
  const text = value.trim().toUpperCase();
  if (text === "") return;
  if (text.length > 64) ctx.addIssue({ code: "custom", path, message: "Keep the seller SKU under 64 characters." });
  else if (!SELLER_SKU.test(text))
    ctx.addIssue({ code: "custom", path, message: "Use letters, digits, dots, dashes and underscores, starting with a letter or digit." });
}

function checkPrices(ctx: Ctx, prefix: Path, price: string, salePrice: string, priceRequired: boolean) {
  const p = checkMoney(ctx, [...prefix, "price"], price, "price", priceRequired);
  const s = checkMoney(ctx, [...prefix, "sale_price"], salePrice, "sale price", false);
  if (p !== null && s !== null && s >= p) {
    ctx.addIssue({ code: "custom", path: [...prefix, "sale_price"], message: "The sale price must be lower than the price." });
  }
  if (p !== null && p > 9_999_999.99) {
    ctx.addIssue({ code: "custom", path: [...prefix, "price"], message: "The price is too high." });
  }
}

/** Length, width and height go together: all three or none. */
function checkDimensions(ctx: Ctx, prefix: Path, dims: { length_mm: string; width_mm: string; height_mm: string }) {
  const keys = ["length_mm", "width_mm", "height_mm"] as const;
  const filled = keys.filter((k) => dims[k].trim() !== "");
  for (const k of keys) {
    checkInt(ctx, [...prefix, k], dims[k], { label: "size", min: 1, max: 3000, required: filled.length > 0 });
  }
}

// ---------------------------------------------------------------------------
// Product details (create and edit)
// ---------------------------------------------------------------------------

const metadataEntry = z.object({
  name: z.string().trim().min(1, "Name the detail.").max(50, "Keep it under 50 characters."),
  value: z.string().trim().min(1, "Enter a value.").max(255, "Keep it under 255 characters."),
});

const detailsShape = {
  name: z.string().trim().min(3, "Use at least 3 characters.").max(200, "Keep the name under 200 characters."),
  description: z
    .string()
    .trim()
    .min(20, "Describe the product in at least 20 characters.")
    .max(10000, "Keep the description under 10,000 characters."),
  category_id: z.string().min(1, "Choose a category."),
  brand_id: z.string(),
  tax_class: z.enum(TAX_CLASSES),
  ships_from_provider: z.boolean(),
  metadata: z.array(metadataEntry).max(30, "Add at most 30 details."),
};

function checkMetadataNames(ctx: Ctx, metadata: { name: string }[]) {
  const seen = new Set<string>();
  metadata.forEach((m, i) => {
    const key = m.name.trim().toLowerCase();
    if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["metadata", i, "name"], message: "Each detail name once." });
    seen.add(key);
  });
}

/** UpdateProductRequest */
export const productDetailsSchema = z.object(detailsShape).superRefine((v, ctx) => checkMetadataNames(ctx, v.metadata));

// ---------------------------------------------------------------------------
// Create: options, generated variants and their rows
// ---------------------------------------------------------------------------

const optionInput = z.object({
  name: z.string().min(1, "Choose an attribute."),
  values: z
    .array(z.string().trim().min(1).max(30, "Keep each value under 30 characters."))
    .min(1, "Add at least one value.")
    .max(MAX_OPTION_VALUES, `Add at most ${MAX_OPTION_VALUES} values.`),
});

// Rows are registered as their combination appears, so every field may still be missing.
const variantRow = z.object({
  include: z.boolean().optional(),
  seller_sku: z.string().optional(),
  price: z.string().optional(),
  sale_price: z.string().optional(),
  stock: z.string().optional(),
  weight_grams: z.string().optional(),
});

export type VariantRow = Required<z.infer<typeof variantRow>>;
export type OptionInput = z.infer<typeof optionInput>;

export const EMPTY_ROW: VariantRow = { include: true, seller_sku: "", price: "", sale_price: "", stock: "", weight_grams: "" };

/** A variant row with its blanks filled in (included unless unticked). */
export function rowOf(rows: Record<string, z.infer<typeof variantRow>>, key: string): VariantRow {
  return { ...EMPTY_ROW, ...Object.fromEntries(Object.entries(rows[key] ?? {}).filter(([, v]) => v !== undefined)) };
}

export interface Combo {
  /** A form-safe key for the combination (no dots or brackets). */
  key: string;
  options: Record<string, string>;
  label: string;
}

/** A combination's form key: the values hex-encoded, so any text is a safe field path. */
function comboKey(values: string[]): string {
  if (values.length === 0) return "default";
  const text = JSON.stringify(values.map((v) => v.trim().toLowerCase()));
  return `c${Array.from(new TextEncoder().encode(text), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** Every combination of the options' values (one "Default" row without options). */
export function variantCombos(options: OptionInput[]): Combo[] {
  const usable = options.filter((o) => o.name && o.values.length > 0);
  let combos: { values: string[]; options: Record<string, string> }[] = [{ values: [], options: {} }];
  for (const option of usable) {
    combos = combos.flatMap((c) =>
      option.values.map((value) => ({ values: [...c.values, value], options: { ...c.options, [option.name]: value } })),
    );
  }
  return combos.map((c) => ({
    key: comboKey(c.values),
    options: c.options,
    label: c.values.length > 0 ? c.values.join(" / ") : "Default",
  }));
}

export const productCreateSchema = z
  .object({
    ...detailsShape,
    options: z.array(optionInput).max(MAX_OPTIONS, `Use at most ${MAX_OPTIONS} options.`),
    variants: z.record(z.string(), variantRow),
    length_mm: z.string(),
    width_mm: z.string(),
    height_mm: z.string(),
    low_stock_threshold: z.string(),
  })
  .superRefine((v, ctx) => {
    checkMetadataNames(ctx, v.metadata);

    const names = new Set<string>();
    v.options.forEach((o, i) => {
      const key = o.name.toLowerCase();
      if (key && names.has(key)) ctx.addIssue({ code: "custom", path: ["options", i, "name"], message: "Use each attribute once." });
      names.add(key);
      const values = o.values.map((x) => x.trim().toLowerCase());
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: "custom", path: ["options", i, "values"], message: "Each value once." });
    });

    const combos = variantCombos(v.options);
    const included = combos.filter((c) => rowOf(v.variants, c.key).include);
    if (included.length === 0) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Include at least one variant." });
    }
    if (included.length > MAX_VARIANTS) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: `A product can have at most ${MAX_VARIANTS} variants.` });
    }

    const skus = new Set<string>();
    for (const combo of included) {
      const row = rowOf(v.variants, combo.key);
      const at: Path = ["variants", combo.key];
      checkPrices(ctx, at, row.price, row.sale_price, true);
      checkInt(ctx, [...at, "stock"], row.stock, { label: "stock", min: 0, max: 1_000_000, required: true });
      checkInt(ctx, [...at, "weight_grams"], row.weight_grams, { label: "weight", min: 1, max: 50_000, required: true });
      checkSellerSku(ctx, [...at, "seller_sku"], row.seller_sku);
      const sku = row.seller_sku.trim().toUpperCase();
      if (sku) {
        if (skus.has(sku)) ctx.addIssue({ code: "custom", path: [...at, "seller_sku"], message: "Each seller SKU once." });
        skus.add(sku);
      }
    }

    checkDimensions(ctx, [], v);
    checkInt(ctx, ["low_stock_threshold"], v.low_stock_threshold, { label: "threshold", min: 0, max: 100_000, required: false });
  });

export type ProductDetailsValues = z.input<typeof productDetailsSchema>;
export type ProductCreateValues = z.input<typeof productCreateSchema>;

// ---------------------------------------------------------------------------
// Variants on the detail page
// ---------------------------------------------------------------------------

const variantShape = {
  seller_sku: z.string(),
  price: z.string(),
  sale_price: z.string(),
  weight_grams: z.string(),
  length_mm: z.string(),
  width_mm: z.string(),
  height_mm: z.string(),
};

function checkVariantShape(ctx: Ctx, v: { [K in keyof typeof variantShape]: string }) {
  checkSellerSku(ctx, ["seller_sku"], v.seller_sku);
  checkPrices(ctx, [], v.price, v.sale_price, true);
  checkInt(ctx, ["weight_grams"], v.weight_grams, { label: "weight", min: 1, max: 50_000, required: true });
  checkDimensions(ctx, [], v);
}

/** StoreProductVariantRequest */
export const newVariantSchema = z
  .object({
    ...variantShape,
    /** One value per product option, in the product's option order. */
    options: z.array(z.string().trim().min(1, "Enter a value.").max(30, "Keep it under 30 characters.")),
    stock: z.string(),
    low_stock_threshold: z.string(),
  })
  .superRefine((v, ctx) => {
    checkVariantShape(ctx, v);
    checkInt(ctx, ["stock"], v.stock, { label: "stock", min: 0, max: 1_000_000, required: true });
    checkInt(ctx, ["low_stock_threshold"], v.low_stock_threshold, { label: "threshold", min: 0, max: 100_000, required: false });
  });

/** UpdateProductVariantRequest */
export const editVariantSchema = z
  .object({
    ...variantShape,
    status: z.enum(["active", "inactive"]),
    image_id: z.string(),
  })
  .superRefine((v, ctx) => checkVariantShape(ctx, v));

export type NewVariantValues = z.input<typeof newVariantSchema>;
export type EditVariantValues = z.input<typeof editVariantSchema>;

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

const wholeNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, "Enter a number.")
    .regex(/^-?\d+$/, "Use a whole number.")
    .refine((s) => Number(s) >= min && Number(s) <= max, `Use a number from ${min.toLocaleString()} to ${max.toLocaleString()}.`);

/** SetInventoryRequest: a stock count. */
export const stockSchema = z.object({
  on_hand: wholeNumber(0, 1_000_000),
  low_stock_threshold: wholeNumber(0, 100_000),
  note: z.string().trim().max(500, "Keep the note under 500 characters."),
});

/** StoreInventoryMovementRequest */
export const movementSchema = z
  .object({
    type: z.enum(["purchase", "adjustment"]),
    quantity: wholeNumber(-1_000_000, 1_000_000),
    note: z.string().trim().max(500, "Keep the note under 500 characters."),
  })
  .superRefine((v, ctx) => {
    const qty = Number(v.quantity);
    if (v.type === "purchase" && qty < 1)
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Stock received adds at least 1 unit." });
    if (v.type === "adjustment" && qty === 0)
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "An adjustment must change the stock." });
    if (v.type === "adjustment" && v.note === "")
      ctx.addIssue({ code: "custom", path: ["note"], message: "Say why the stock is adjusted." });
  });

export type StockValues = z.input<typeof stockSchema>;
export type MovementValues = z.input<typeof movementSchema>;

// ---------------------------------------------------------------------------
// Value helpers for building request bodies from the string inputs
// ---------------------------------------------------------------------------

/** "" -> null, "12" -> 12. */
export function intOrNull(value: string): number | null {
  const text = value.trim();
  return text === "" ? null : Number(text);
}

/** "" -> null, "49.9" -> "49.90". Money stays a string. */
export function moneyOrNull(value: string): string | null {
  const text = value.trim();
  return text === "" ? null : Number(text).toFixed(2);
}

/** The seller SKU as the API stores it (upper-case), or null. */
export function sellerSku(value: string): string | null {
  const text = value.trim().toUpperCase();
  return text === "" ? null : text;
}
