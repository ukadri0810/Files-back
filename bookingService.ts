import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  RESET_IN_PROGRESS_KEY,
  shouldIgnoreLocalCacheForReset,
} from "@/services/resetDataService";
import {
  deleteAvailabilityBlock,
  upsertAvailabilityBlockFromBooking,
} from "@/services/availabilityBlockService";

export type BookingStatus = "Upcoming" | "Active" | "Completed" | "Cancelled";
export type BookingSource = "Phone" | "WhatsApp" | "Instagram" | "Walk-in";
export type PaymentMode = "Cash" | "UPI" | "Mixed" | "Pending";
export type PricingMode =
  | "FIXED_UNLIMITED"
  | "PER_KM"
  | "BASE_LIMITED_KM"
  | "CUSTOM_MANUAL";

export type PaymentStage = "Deposit" | "Advance" | "Return";
export type PaymentEntryMode = "Cash" | "UPI";

export type PaymentEntry = {
  id: string;
  stage: PaymentStage;
  mode: PaymentEntryMode;
  amount: number;
  referenceNumber: string;
  qrCodeId: string;
  note: string;
  receivedAt: string;
};

export type Booking = {
  id: string;

  customerId: string;
  carId: string;
  bookingSource: BookingSource;

  startDateTime: string;
  expectedReturnDateTime: string;
  actualPickupDateTime: string | null;
  actualReturnDateTime: string | null;

  pickupKm: number;
  pickupFuelLevel: string;
  returnKm: number | null;
  returnFuelLevel: string | null;

  pricingMode: PricingMode;
  fixedRentAmount: number | null;
  ratePerKm: number | null;
  baseRent: number | null;
  includedKm: number | null;
  extraKmRate: number | null;
  customFinalRent: number | null;
  customPricingNote: string;
  discountAdjustmentAmount: number;
  ownerFinalAmount: number | null;
  overrideReason: string;

  securityDeposit: number;
  advancePaid: number;
  amountPaidNow: number;
  paymentMode: PaymentMode;
  payments: PaymentEntry[];

  bookingStatus: BookingStatus;
  bookingNotes: string;
  autoCalculatedAmount: number | null;

  carConditionNote: string;
  existingDamageNote: string;
  accessoriesGiven: {
    rcCopy: boolean;
    insuranceCopy: boolean;
    spareTyre: boolean;
    jack: boolean;
    toolkit: boolean;
  };
  documentsChecked: boolean;
  handoverNotes: string;

  damageFound: boolean;
  damageCharge: number;
  cleaningCharge: number;
  lateCharge: number;
  otherCharges: number;
  otherChargeReason: string;
  returnNotes: string;

  depositDeducted: number;
  depositRefunded: number;
  depositSettlementNote: string;

  fareRefunded: number;
  fareRefundMode: string;
  fareRefundReferenceNumber: string;

  createdAt: string;
  updatedAt: string;
};

const BOOKINGS_KEY = "drivelog_bookings";
const BOOKINGS_COLLECTION = "bookings";
const DELETED_BOOKINGS_COLLECTION = "deleted_bookings";

function normalizeText(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function normalizeNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function normalizeNullableNumber(
  value: number | string | null | undefined
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return Number(value);
}

function normalizePaymentEntry(payment: Partial<PaymentEntry>): PaymentEntry {
  return {
    id: payment.id || Math.random().toString(36).substring(2, 11),
    stage: payment.stage ?? "Advance",
    mode: payment.mode ?? "Cash",
    amount: normalizeNumber(payment.amount),
    referenceNumber: normalizeText(payment.referenceNumber),
    qrCodeId: normalizeText(payment.qrCodeId),
    note: normalizeText(payment.note),
    receivedAt: payment.receivedAt || new Date().toISOString(),
  };
}

function normalizeBooking(booking: Partial<Booking> & { id: string }): Booking {
  const now = new Date().toISOString();

  return {
    id: booking.id,

    customerId: normalizeText(booking.customerId),
    carId: normalizeText(booking.carId),
    bookingSource: booking.bookingSource ?? "Walk-in",

    startDateTime: booking.startDateTime || now,
    expectedReturnDateTime: booking.expectedReturnDateTime || now,
    actualPickupDateTime: booking.actualPickupDateTime ?? null,
    actualReturnDateTime: booking.actualReturnDateTime ?? null,

    pickupKm: normalizeNumber(booking.pickupKm),
    pickupFuelLevel: normalizeText(booking.pickupFuelLevel || "Full"),
    returnKm: normalizeNullableNumber(booking.returnKm),
    returnFuelLevel: booking.returnFuelLevel ?? null,

    pricingMode: booking.pricingMode ?? "FIXED_UNLIMITED",
    fixedRentAmount: normalizeNullableNumber(booking.fixedRentAmount),
    ratePerKm: normalizeNullableNumber(booking.ratePerKm),
    baseRent: normalizeNullableNumber(booking.baseRent),
    includedKm: normalizeNullableNumber(booking.includedKm),
    extraKmRate: normalizeNullableNumber(booking.extraKmRate),
    customFinalRent: normalizeNullableNumber(booking.customFinalRent),
    customPricingNote: normalizeText(booking.customPricingNote),
    discountAdjustmentAmount: normalizeNumber(booking.discountAdjustmentAmount),
    ownerFinalAmount: normalizeNullableNumber(booking.ownerFinalAmount),
    overrideReason: normalizeText(booking.overrideReason),

    securityDeposit: normalizeNumber(booking.securityDeposit),
    advancePaid: normalizeNumber(booking.advancePaid),
    amountPaidNow: normalizeNumber(booking.amountPaidNow),
    paymentMode: booking.paymentMode ?? "Pending",
    payments: Array.isArray(booking.payments)
      ? booking.payments.map(normalizePaymentEntry)
      : [],

    bookingStatus: booking.bookingStatus ?? "Upcoming",
    bookingNotes: normalizeText(booking.bookingNotes),
    autoCalculatedAmount: normalizeNullableNumber(booking.autoCalculatedAmount),

    carConditionNote: normalizeText(booking.carConditionNote),
    existingDamageNote: normalizeText(booking.existingDamageNote),
    accessoriesGiven: {
      rcCopy: Boolean(booking.accessoriesGiven?.rcCopy),
      insuranceCopy: Boolean(booking.accessoriesGiven?.insuranceCopy),
      spareTyre: Boolean(booking.accessoriesGiven?.spareTyre),
      jack: Boolean(booking.accessoriesGiven?.jack),
      toolkit: Boolean(booking.accessoriesGiven?.toolkit),
    },
    documentsChecked: Boolean(booking.documentsChecked),
    handoverNotes: normalizeText(booking.handoverNotes),

    damageFound: Boolean(booking.damageFound),
    damageCharge: normalizeNumber(booking.damageCharge),
    cleaningCharge: normalizeNumber(booking.cleaningCharge),
    lateCharge: normalizeNumber(booking.lateCharge),
    otherCharges: normalizeNumber(booking.otherCharges),
    otherChargeReason: normalizeText(booking.otherChargeReason),
    returnNotes: normalizeText(booking.returnNotes),

    depositDeducted: normalizeNumber(booking.depositDeducted),
    depositRefunded: normalizeNumber(booking.depositRefunded),
    depositSettlementNote: normalizeText(booking.depositSettlementNote),

    fareRefunded: normalizeNumber(booking.fareRefunded),
    fareRefundMode: normalizeText(booking.fareRefundMode),
    fareRefundReferenceNumber: normalizeText(booking.fareRefundReferenceNumber),

    createdAt: booking.createdAt || now,
    updatedAt: booking.updatedAt || now,
  };
}

function notifyBookingsUpdated() {
  window.dispatchEvent(new Event("drivelog_bookings_updated"));
}

function saveBookingsToCache(bookings: Booking[]): void {
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  notifyBookingsUpdated();
}

function getBookingsFromCache(): Booking[] {
  const data = localStorage.getItem(BOOKINGS_KEY);

  if (!data) {
    return [];
  }

  try {
    const bookings = JSON.parse(data) as Booking[];
    return bookings.map((booking) => normalizeBooking(booking));
  } catch (error) {
    console.error("Failed to parse bookings", error);
    return [];
  }
}

function mergeBookings(
  localBookings: Booking[],
  firestoreBookings: Booking[]
): Booking[] {
  const map = new Map<string, Booking>();

  for (const booking of localBookings) {
    map.set(booking.id, normalizeBooking(booking));
  }

  for (const firestoreBooking of firestoreBookings) {
    const existing = map.get(firestoreBooking.id);

    if (!existing) {
      map.set(firestoreBooking.id, normalizeBooking(firestoreBooking));
      continue;
    }

    const existingTime = new Date(existing.updatedAt).getTime();
    const firestoreTime = new Date(firestoreBooking.updatedAt).getTime();

    map.set(
      firestoreBooking.id,
      firestoreTime >= existingTime
        ? normalizeBooking(firestoreBooking)
        : normalizeBooking(existing)
    );
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.createdAt || b.updatedAt).getTime() -
      new Date(a.createdAt || a.updatedAt).getTime()
  );
}

async function saveBookingsToFirestore(bookings: Booking[]): Promise<void> {
  await Promise.all(
    bookings.map(async (booking) => {
      const bookingRef = doc(db, BOOKINGS_COLLECTION, booking.id);
      await setDoc(bookingRef, booking, { merge: true });
      await upsertAvailabilityBlockFromBooking(booking);
    })
  );
}

async function getDeletedBookingIds(): Promise<Set<string>> {
  const deletedRef = collection(db, DELETED_BOOKINGS_COLLECTION);
  const snapshot = await getDocs(deletedRef);

  return new Set(snapshot.docs.map((documentSnapshot) => documentSnapshot.id));
}

export function getBookings(): Booking[] {
  return getBookingsFromCache();
}

export function getBooking(id: string): Booking | undefined {
  return getBookings().find((booking) => booking.id === id);
}

export function saveBooking(booking: Booking): void {
  const now = new Date().toISOString();
  const bookings = getBookingsFromCache();
  const existing = bookings.findIndex((item) => item.id === booking.id);

  const savedBooking: Booking =
    existing >= 0
      ? normalizeBooking({
          ...bookings[existing],
          ...booking,
          updatedAt: now,
        })
      : normalizeBooking({
          ...booking,
          createdAt: booking.createdAt || now,
          updatedAt: now,
        });

  if (existing >= 0) {
    bookings[existing] = savedBooking;
  } else {
    bookings.push(savedBooking);
  }

  saveBookingsToCache(bookings);

  const bookingRef = doc(db, BOOKINGS_COLLECTION, savedBooking.id);

  void setDoc(bookingRef, savedBooking, { merge: true })
    .then(() => upsertAvailabilityBlockFromBooking(savedBooking))
    .catch((error) => {
      console.error("Failed to save booking to Firestore", error);
    });
}

export function deleteBooking(id: string): void {
  const now = new Date().toISOString();

  const bookings = getBookingsFromCache().filter(
    (booking) => booking.id !== id
  );

  saveBookingsToCache(bookings);

  const bookingRef = doc(db, BOOKINGS_COLLECTION, id);
  const deletedBookingRef = doc(db, DELETED_BOOKINGS_COLLECTION, id);

  void Promise.all([
    deleteDoc(bookingRef),
    deleteAvailabilityBlock(id),
    setDoc(
      deletedBookingRef,
      {
        id,
        deletedAt: now,
      },
      { merge: true }
    ),
  ]).catch((error) => {
    console.error("Failed to delete booking from Firestore", error);
  });
}

export async function syncBookingsFromFirestore(): Promise<Booking[]> {
  const resetInProgress =
    localStorage.getItem(RESET_IN_PROGRESS_KEY) === "true";

  const shouldIgnoreLocalCache = await shouldIgnoreLocalCacheForReset();

  const deletedBookingIds = await getDeletedBookingIds();

  const bookingsRef = collection(db, BOOKINGS_COLLECTION);
  const snapshot = await getDocs(bookingsRef);

  const firestoreBookings = snapshot.docs
    .map((documentSnapshot) =>
      normalizeBooking({
        id: documentSnapshot.id,
        ...(documentSnapshot.data() as Partial<Booking>),
      })
    )
    .filter((booking) => !deletedBookingIds.has(booking.id));

  if (resetInProgress || shouldIgnoreLocalCache) {
    saveBookingsToCache(firestoreBookings);
    return firestoreBookings;
  }

  const localBookings = getBookingsFromCache().filter(
    (booking) => !deletedBookingIds.has(booking.id)
  );

  const mergedBookings = mergeBookings(localBookings, firestoreBookings);

  saveBookingsToCache(mergedBookings);

  if (mergedBookings.length > 0) {
    await saveBookingsToFirestore(mergedBookings);
  }

  return mergedBookings;
}

export function listenToBookingsSync(): () => void {
  const bookingsRef = collection(db, BOOKINGS_COLLECTION);
  const deletedBookingsRef = collection(db, DELETED_BOOKINGS_COLLECTION);

  let latestBookings: Booking[] = [];
  let deletedBookingIds = new Set<string>();

  const applyRealtimeCache = () => {
    const safeBookings = latestBookings
      .filter((booking) => !deletedBookingIds.has(booking.id))
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.updatedAt).getTime() -
          new Date(a.createdAt || a.updatedAt).getTime()
      );

    saveBookingsToCache(safeBookings);
  };

  const unsubscribeBookings = onSnapshot(
    bookingsRef,
    (snapshot) => {
      latestBookings = snapshot.docs.map((documentSnapshot) =>
        normalizeBooking({
          id: documentSnapshot.id,
          ...(documentSnapshot.data() as Partial<Booking>),
        })
      );

      applyRealtimeCache();
    },
    (error) => {
      console.error("Realtime bookings sync failed", error);
    }
  );

  const unsubscribeDeletedBookings = onSnapshot(
    deletedBookingsRef,
    (snapshot) => {
      deletedBookingIds = new Set(
        snapshot.docs.map((documentSnapshot) => documentSnapshot.id)
      );

      applyRealtimeCache();
    },
    (error) => {
      console.error("Realtime deleted bookings sync failed", error);
    }
  );

  return () => {
    unsubscribeBookings();
    unsubscribeDeletedBookings();
  };
}
