import { doc, getDoc, setDoc } from "firebase/firestore";

import { businessConfig } from "@/config/businessConfig";
import { db } from "@/lib/firebase";

export type BookingBillingMode = "DAILY" | "HOURLY";

export type Settings = {
  businessName: string;
  ownerPhone: string;
  businessAddress: string;
  defaultTermsAndConditions: string;
  currencySymbol: string;
  receiptFooterNote: string;

  /**
   * Public/customer booking rules.
   * DAILY = customer selects pickup date + number of days.
   * HOURLY = customer selects pickup and return date/time.
   */
  bookingBillingMode: BookingBillingMode;
  defaultHourlyRent: number;
  minimumRentalHours: number;
  publicBookingInstructions: string;

  /**
   * Booking time rules
   * Useful for businesses that follow fixed 24-hour rental cycles,
   * for example 12 PM to 12 PM.
   */
  fixedBookingWindowEnabled: boolean;
  defaultPickupTime: string;
  defaultReturnTime: string;
  minimumRentalDays: number;
  allowCustomBookingTime: boolean;

  /**
   * Deposit rules
   * Default deposit is the normal amount.
   * Offer deposit is used when business owner wants to attract customers
   * with a lower promotional deposit.
   */
  defaultSecurityDeposit: number;
  offerSecurityDeposit: number;

  /**
   * Vehicle document reminder rules.
   * Used for PUC and insurance expiry warnings.
   */
  vehicleDocumentReminderDays: number;
};

export type PublicBusinessSettings = Pick<
  Settings,
  | "businessName"
  | "ownerPhone"
  | "businessAddress"
  | "defaultTermsAndConditions"
  | "currencySymbol"
  | "receiptFooterNote"
  | "bookingBillingMode"
  | "defaultHourlyRent"
  | "minimumRentalHours"
  | "publicBookingInstructions"
  | "fixedBookingWindowEnabled"
  | "defaultPickupTime"
  | "defaultReturnTime"
  | "minimumRentalDays"
  | "allowCustomBookingTime"
  | "defaultSecurityDeposit"
  | "offerSecurityDeposit"
>;

const defaultSettings: Settings = {
  businessName: businessConfig.businessName,
  ownerPhone: businessConfig.ownerPhone,
  businessAddress: businessConfig.businessAddress,
  defaultTermsAndConditions: businessConfig.defaultTermsAndConditions,
  currencySymbol: businessConfig.currencySymbol,
  receiptFooterNote: businessConfig.receiptFooterNote,

  bookingBillingMode: "DAILY",
  defaultHourlyRent: 250,
  minimumRentalHours: 4,
  publicBookingInstructions:
    "Select your booking date/time, choose an available vehicle, submit your details, then pay the deposit. Booking is confirmed only after owner approval.",

  fixedBookingWindowEnabled: false,
  defaultPickupTime: "12:00",
  defaultReturnTime: "12:00",
  minimumRentalDays: 1,
  allowCustomBookingTime: true,

  defaultSecurityDeposit: 3000,
  offerSecurityDeposit: 1500,

  vehicleDocumentReminderDays: 15,
};

const SETTINGS_KEY = "drivelog_settings";
const SETTINGS_DOC_PATH = ["settings", "business"] as const;
const PUBLIC_SETTINGS_DOC_PATH = ["public_business_settings", "default"] as const;

function normalizeBookingBillingMode(value: unknown): BookingBillingMode {
  return value === "HOURLY" ? "HOURLY" : "DAILY";
}

function normalizeSettings(settings: Partial<Settings>): Settings {
  return {
    ...defaultSettings,
    ...settings,

    bookingBillingMode: normalizeBookingBillingMode(
      settings.bookingBillingMode ?? defaultSettings.bookingBillingMode
    ),

    defaultHourlyRent: Math.max(
      0,
      Number(settings.defaultHourlyRent ?? defaultSettings.defaultHourlyRent)
    ),

    minimumRentalHours: Math.max(
      1,
      Number(settings.minimumRentalHours ?? defaultSettings.minimumRentalHours)
    ),

    publicBookingInstructions:
      settings.publicBookingInstructions ||
      defaultSettings.publicBookingInstructions,

    fixedBookingWindowEnabled: Boolean(
      settings.fixedBookingWindowEnabled ??
        defaultSettings.fixedBookingWindowEnabled
    ),

    defaultPickupTime:
      settings.defaultPickupTime || defaultSettings.defaultPickupTime,

    defaultReturnTime:
      settings.defaultReturnTime || defaultSettings.defaultReturnTime,

    minimumRentalDays: Math.max(
      1,
      Number(settings.minimumRentalDays ?? defaultSettings.minimumRentalDays)
    ),

    allowCustomBookingTime: Boolean(
      settings.allowCustomBookingTime ?? defaultSettings.allowCustomBookingTime
    ),

    defaultSecurityDeposit: Math.max(
      0,
      Number(
        settings.defaultSecurityDeposit ??
          defaultSettings.defaultSecurityDeposit
      )
    ),

    offerSecurityDeposit: Math.max(
      0,
      Number(
        settings.offerSecurityDeposit ?? defaultSettings.offerSecurityDeposit
      )
    ),

    vehicleDocumentReminderDays: Math.max(
      1,
      Number(
        settings.vehicleDocumentReminderDays ??
          defaultSettings.vehicleDocumentReminderDays
      )
    ),
  };
}

function toPublicBusinessSettings(settings: Settings): PublicBusinessSettings {
  return {
    businessName: settings.businessName,
    ownerPhone: settings.ownerPhone,
    businessAddress: settings.businessAddress,
    defaultTermsAndConditions: settings.defaultTermsAndConditions,
    currencySymbol: settings.currencySymbol,
    receiptFooterNote: settings.receiptFooterNote,
    bookingBillingMode: settings.bookingBillingMode,
    defaultHourlyRent: settings.defaultHourlyRent,
    minimumRentalHours: settings.minimumRentalHours,
    publicBookingInstructions: settings.publicBookingInstructions,
    fixedBookingWindowEnabled: settings.fixedBookingWindowEnabled,
    defaultPickupTime: settings.defaultPickupTime,
    defaultReturnTime: settings.defaultReturnTime,
    minimumRentalDays: settings.minimumRentalDays,
    allowCustomBookingTime: settings.allowCustomBookingTime,
    defaultSecurityDeposit: settings.defaultSecurityDeposit,
    offerSecurityDeposit: settings.offerSecurityDeposit,
  };
}

function notifySettingsUpdated() {
  window.dispatchEvent(new Event("drivelog_settings_updated"));
}

export function getSettings(): Settings {
  const data = localStorage.getItem(SETTINGS_KEY);

  if (data) {
    try {
      return normalizeSettings(JSON.parse(data) as Partial<Settings>);
    } catch (e) {
      console.error("Failed to parse settings", e);
    }
  }

  return defaultSettings;
}

export function saveSettings(settings: Settings): void {
  const normalizedSettings = normalizeSettings(settings);

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizedSettings));
  notifySettingsUpdated();

  const settingsRef = doc(db, ...SETTINGS_DOC_PATH);
  const publicSettingsRef = doc(db, ...PUBLIC_SETTINGS_DOC_PATH);

  void Promise.all([
    setDoc(settingsRef, normalizedSettings, { merge: true }),
    setDoc(publicSettingsRef, toPublicBusinessSettings(normalizedSettings), {
      merge: true,
    }),
  ]).catch((error) => {
    console.error("Failed to save settings to Firestore", error);
  });
}

export async function syncSettingsFromFirestore(): Promise<Settings> {
  const settingsRef = doc(db, ...SETTINGS_DOC_PATH);
  const snapshot = await getDoc(settingsRef);

  if (!snapshot.exists()) {
    await Promise.all([
      setDoc(settingsRef, defaultSettings, { merge: true }),
      setDoc(doc(db, ...PUBLIC_SETTINGS_DOC_PATH), toPublicBusinessSettings(defaultSettings), {
        merge: true,
      }),
    ]);

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
    notifySettingsUpdated();
    return defaultSettings;
  }

  const firestoreSettings = normalizeSettings(
    snapshot.data() as Partial<Settings>
  );

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(firestoreSettings));
  notifySettingsUpdated();

  await setDoc(
    doc(db, ...PUBLIC_SETTINGS_DOC_PATH),
    toPublicBusinessSettings(firestoreSettings),
    { merge: true }
  );

  return firestoreSettings;
}

export async function getPublicBusinessSettings(): Promise<PublicBusinessSettings> {
  const snapshot = await getDoc(doc(db, ...PUBLIC_SETTINGS_DOC_PATH));

  if (!snapshot.exists()) {
    return toPublicBusinessSettings(defaultSettings);
  }

  return toPublicBusinessSettings(
    normalizeSettings(snapshot.data() as Partial<Settings>)
  );
}
