import type { ShippingProfile, SizeId } from '@/lib/content/types';

/**
 * Approved transport packaging per case size (owner-confirmed).
 * Used when `sizes.shipping_*` columns are not filled yet; DB values win when present.
 */
export const APPROVED_SIZE_SHIPPING: Record<SizeId, ShippingProfile> = {
  S: { lengthCm: 40, widthCm: 28, heightCm: 7, weightKg: 2 },
  M: { lengthCm: 50, widthCm: 28, heightCm: 7, weightKg: 2.5 },
  L: { lengthCm: 60, widthCm: 28, heightCm: 7, weightKg: 3 },
  XL: { lengthCm: 80, widthCm: 28, heightCm: 7, weightKg: 4 },
};

/** Standard Nova Poshta postomat limits (owner-confirmed). */
export const POSTOMAT_MAX_DIMENSIONS_CM = [60, 40, 30] as const;
export const POSTOMAT_MAX_WEIGHT_KG = 20;

export interface OrderPackage {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
}

export interface PackageLineInput {
  size: string;
  quantity: number;
  shippingProfile?: ShippingProfile | null;
}

export interface WarehouseLimits {
  /** TotalMaxWeightAllowed, kg; null when API did not provide a usable value. */
  totalMaxWeightKg: number | null;
  /** PlaceMaxWeightAllowed, kg; null when absent. */
  placeMaxWeightKg: number | null;
  /** SendingLimitationsOnDimensions (cm); null when absent. */
  sendingMaxDimensionsCm: { lengthCm: number; widthCm: number; heightCm: number } | null;
  /** DenyToSelect=1 — documents cannot be created to/from this warehouse. */
  denyToSelect: boolean;
}

export type PackageField = 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg';

export type LimitCheckStatus = 'fits' | 'exceeds' | 'unknown';

export interface LimitCheck {
  status: LimitCheckStatus;
  /** Package fields that exceed confirmed limits (for red highlighting). */
  exceeded: PackageField[];
}

const NO_LIMITS: LimitCheck = { status: 'unknown', exceeded: [] };

function positive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function profileOf(input: PackageLineInput): ShippingProfile | null {
  const fromDb = input.shippingProfile;
  if (fromDb && positive(fromDb.lengthCm) && positive(fromDb.widthCm) && positive(fromDb.heightCm) && positive(fromDb.weightKg)) {
    return fromDb;
  }
  const key = String(input.size).toUpperCase() as SizeId;
  return APPROVED_SIZE_SHIPPING[key] ?? null;
}

/**
 * One shared shipping box: cases stack on each other in a single package.
 * Length = longest case, width = widest case, height = sum of case heights,
 * weight = sum of case weights. Badges and paid fixations add nothing.
 */
export function calculateOrderPackage(lines: PackageLineInput[]): OrderPackage | null {
  let lengthCm = 0;
  let widthCm = 0;
  let heightCm = 0;
  let weightKg = 0;
  let units = 0;
  for (const line of lines) {
    const quantity = Math.max(0, Math.trunc(Number(line.quantity) || 0));
    if (quantity === 0) continue;
    const profile = profileOf(line);
    if (!profile) return null;
    lengthCm = Math.max(lengthCm, profile.lengthCm);
    widthCm = Math.max(widthCm, profile.widthCm);
    heightCm += profile.heightCm * quantity;
    weightKg += profile.weightKg * quantity;
    units += quantity;
  }
  if (units === 0) return null;
  return {
    lengthCm,
    widthCm,
    heightCm,
    weightKg: Math.round(weightKg * 100) / 100,
  };
}

export function packageMaxSideCm(pkg: OrderPackage) {
  return Math.max(pkg.lengthCm, pkg.widthCm, pkg.heightCm);
}

function checkWeight(weightKg: number, maxWeightKg: number | null): LimitCheck {
  if (!maxWeightKg) return NO_LIMITS;
  return weightKg > maxWeightKg
    ? { status: 'exceeds', exceeded: ['weightKg'] }
    : { status: 'fits', exceeded: [] };
}

/**
 * Compare package sides against allowed sides, largest to largest
 * (no box-rotation logic). Maps failures back to the original fields.
 */
function checkSidesPairwise(
  pkg: OrderPackage,
  maxDimensionsCm: { lengthCm: number; widthCm: number; heightCm: number } | null,
): LimitCheck {
  if (!maxDimensionsCm) return NO_LIMITS;
  const sides: Array<{ field: PackageField; value: number }> = (
    [
      { field: 'lengthCm', value: pkg.lengthCm },
      { field: 'widthCm', value: pkg.widthCm },
      { field: 'heightCm', value: pkg.heightCm },
    ] as Array<{ field: PackageField; value: number }>
  ).sort((left, right) => right.value - left.value);
  const limits = [
    positive(maxDimensionsCm.lengthCm),
    positive(maxDimensionsCm.widthCm),
    positive(maxDimensionsCm.heightCm),
  ].sort((left, right) => (right ?? 0) - (left ?? 0));
  if (limits.some(limit => limit === null)) return NO_LIMITS;
  const exceeded = sides
    .filter((side, index) => side.value > (limits[index] as number))
    .map(side => side.field);
  return exceeded.length > 0 ? { status: 'exceeds', exceeded } : { status: 'fits', exceeded: [] };
}

/**
 * Branch/warehouse rule: only the longest package side is checked against the
 * largest documented dimension limit. If the API sent no limits the result is
 * 'unknown' — never a fake green and never a sales block.
 */
export function checkWarehousePackage(pkg: OrderPackage, limits: WarehouseLimits | null): LimitCheck {
  if (!limits) return NO_LIMITS;
  if (limits.denyToSelect) {
    return {
      status: 'exceeds',
      exceeded: ['lengthCm', 'widthCm', 'heightCm', 'weightKg'],
    };
  }
  const dimensionLimit = limits.sendingMaxDimensionsCm;
  const limitMaxSide = dimensionLimit
    ? Math.max(...[dimensionLimit.lengthCm, dimensionLimit.widthCm, dimensionLimit.heightCm].map(v => positive(v) ?? 0))
    : 0;
  const sideCheck: LimitCheck = !dimensionLimit || limitMaxSide <= 0
    ? NO_LIMITS
    : packageMaxSideCm(pkg) > limitMaxSide
      ? {
        status: 'exceeds',
        exceeded: (
          [
            ['lengthCm', pkg.lengthCm],
            ['widthCm', pkg.widthCm],
            ['heightCm', pkg.heightCm],
          ] as Array<[PackageField, number]>
        ).filter(([, value]) => value > limitMaxSide).map(([field]) => field),
      }
      : { status: 'fits', exceeded: [] };

  const maxWeightKg = [positive(limits.totalMaxWeightKg), positive(limits.placeMaxWeightKg)]
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right)[0] ?? null;
  const weightCheck = checkWeight(pkg.weightKg, maxWeightKg);

  const exceeded = [...sideCheck.exceeded, ...weightCheck.exceeded];
  if (exceeded.length > 0) return { status: 'exceeds', exceeded: Array.from(new Set(exceeded)) };
  if (sideCheck.status === 'fits' || weightCheck.status === 'fits') {
    return { status: 'fits', exceeded: [] };
  }
  return NO_LIMITS;
}

/**
 * Postomat rule: sides are matched largest-to-largest against 60×40×30 cm,
 * actual weight against 20 kg. Stricter per-postomat API limits apply when present.
 */
export function checkPostomatPackage(pkg: OrderPackage, limits?: WarehouseLimits | null): LimitCheck {
  const standardSides: LimitCheck = checkSidesPairwise(pkg, {
    lengthCm: POSTOMAT_MAX_DIMENSIONS_CM[0],
    widthCm: POSTOMAT_MAX_DIMENSIONS_CM[1],
    heightCm: POSTOMAT_MAX_DIMENSIONS_CM[2],
  });
  const standardWeight = checkWeight(pkg.weightKg, POSTOMAT_MAX_WEIGHT_KG);

  let stricterSides: LimitCheck = NO_LIMITS;
  let stricterWeight: LimitCheck = NO_LIMITS;
  if (limits) {
    if (limits.denyToSelect) {
      return {
        status: 'exceeds',
        exceeded: ['lengthCm', 'widthCm', 'heightCm', 'weightKg'],
      };
    }
    stricterSides = checkSidesPairwise(pkg, limits.sendingMaxDimensionsCm);
    const maxWeightKg = [positive(limits.totalMaxWeightKg), positive(limits.placeMaxWeightKg)]
      .filter((value): value is number => value !== null)
      .sort((left, right) => left - right)[0] ?? null;
    stricterWeight = checkWeight(pkg.weightKg, maxWeightKg);
  }

  const exceeded = [
    ...standardSides.exceeded,
    ...standardWeight.exceeded,
    ...stricterSides.exceeded,
    ...stricterWeight.exceeded,
  ];
  return exceeded.length > 0
    ? { status: 'exceeds', exceeded: Array.from(new Set(exceeded)) }
    : { status: 'fits', exceeded: [] };
}

/** "5.5" → "5,5"; integers stay compact. */
export function formatNumberUk(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace('.', ',');
}

export interface PackageLinePart {
  text: string;
  field: PackageField | null;
}

/**
 * Display parts for the "Габарити пакування" line so the UI can colour
 * only the exceeded values red.
 */
export function packageLineParts(
  pkg: OrderPackage,
  exceeded: readonly PackageField[] = [],
): PackageLinePart[] {
  const flagged = new Set(exceeded);
  return [
    { text: 'Габарити пакування: ', field: null },
    { text: String(pkg.lengthCm), field: flagged.has('lengthCm') ? 'lengthCm' : null },
    { text: ' × ', field: null },
    { text: String(pkg.widthCm), field: flagged.has('widthCm') ? 'widthCm' : null },
    { text: ' × ', field: null },
    { text: String(pkg.heightCm), field: flagged.has('heightCm') ? 'heightCm' : null },
    { text: ' см (', field: null },
    { text: `${formatNumberUk(pkg.weightKg)} кг`, field: flagged.has('weightKg') ? 'weightKg' : null },
    { text: ')', field: null },
  ];
}
