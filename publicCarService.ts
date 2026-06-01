import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { Car, VehicleType } from "@/services/carService";

/**
 * Public car records are safe for customers.
 * Vehicle registration number is published only when admin explicitly enables it.
 * IMPORTANT: Do not add currentKm, service notes, or private fields here.
 */
export type PublicCar = {
  id: string;
  vehicleType: VehicleType;
  carName: string;
  fuelType: "Petrol" | "Diesel" | "CNG" | "Electric";
  transmissionType: "Manual" | "Automatic";
  defaultDailyRent: number;
  defaultHourlyRent: number;
  securityDeposit: number;
  status: "Available" | "Booked" | "In Service" | "Maintenance";
  showRegistrationNumber: boolean;
  registrationNumber: string;
  publicRules: string;
  imageUrl: string;
  photoUrls: string[];
  features: string[];
  publicDescription: string;
  sortOrder: number;
  updatedAt: string;
};

export type PublicCarFormValues = {
  enabled: boolean;
  carName: string;
  publicDescription: string;
  imageUrl: string;
  photoUrlsText: string;
  featuresText: string;
  defaultDailyRent: number;
  defaultHourlyRent: number;
  securityDeposit: number;
  showRegistrationNumber: boolean;
  publicRules: string;
  sortOrder: number;
};

const PUBLIC_CARS_COLLECTION = "public_cars";

function normalizeText(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function splitLinesOrCommas(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePublicCar(
  data: Partial<PublicCar> & { id: string }
): PublicCar {
  return {
    id: data.id,
    vehicleType: data.vehicleType ?? "Car",
    carName: normalizeText(data.carName),
    fuelType: data.fuelType ?? "Petrol",
    transmissionType: data.transmissionType ?? "Manual",
    defaultDailyRent: Number(data.defaultDailyRent ?? 0),
    defaultHourlyRent: Number(data.defaultHourlyRent ?? 0),
    securityDeposit: Number(data.securityDeposit ?? 0),
    status: data.status ?? "Available",
    showRegistrationNumber: Boolean(data.showRegistrationNumber ?? false),
    registrationNumber: Boolean(data.showRegistrationNumber)
      ? normalizeText(data.registrationNumber)
      : "",
    publicRules:
      data.publicRules ??
      "Extra hourly charges, fuel difference, toll/Fastag/challan, scratches, damage, cleaning, and late return charges may be deducted from the refundable security deposit as per business policy.",
    imageUrl: data.imageUrl ?? "",
    photoUrls: Array.isArray(data.photoUrls) ? data.photoUrls : [],
    features: Array.isArray(data.features) ? data.features : [],
    publicDescription: data.publicDescription ?? "",
    sortOrder: Number(data.sortOrder ?? 999),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

export async function getPublicCars(): Promise<PublicCar[]> {
  const publicCarsRef = collection(db, PUBLIC_CARS_COLLECTION);
  const snapshot = await getDocs(publicCarsRef);

  return snapshot.docs
    .map((documentSnapshot) =>
      normalizePublicCar({
        id: documentSnapshot.id,
        ...(documentSnapshot.data() as Partial<PublicCar>),
      })
    )
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }

      return a.carName.localeCompare(b.carName);
    });
}

export async function getAllPublicCarsForAdmin(): Promise<PublicCar[]> {
  const publicCarsRef = collection(db, PUBLIC_CARS_COLLECTION);
  const snapshot = await getDocs(publicCarsRef);

  return snapshot.docs
    .map((documentSnapshot) =>
      normalizePublicCar({
        id: documentSnapshot.id,
        ...(documentSnapshot.data() as Partial<PublicCar>),
      })
    )
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }

      return a.carName.localeCompare(b.carName);
    });
}

export async function publishCarToPublicListing(
  car: Car,
  values: PublicCarFormValues
): Promise<void> {
  const now = new Date().toISOString();

  const publicCar: PublicCar = normalizePublicCar({
    id: car.id,
    vehicleType: car.vehicleType,
    carName: values.carName || car.carName,
    fuelType: car.fuelType,
    transmissionType: car.transmissionType,
    defaultDailyRent: Number(values.defaultDailyRent || car.defaultDailyRent || 0),
    defaultHourlyRent: Number(values.defaultHourlyRent || car.lateHourlyCharge || 0),
    securityDeposit: Number(values.securityDeposit || 0),
    status: car.status,
    showRegistrationNumber: Boolean(values.showRegistrationNumber),
    registrationNumber: values.showRegistrationNumber ? car.vehicleNumber : "",
    publicRules: normalizeText(values.publicRules),
    imageUrl: normalizeText(values.imageUrl),
    photoUrls: splitLinesOrCommas(values.photoUrlsText),
    features: splitLinesOrCommas(values.featuresText),
    publicDescription: normalizeText(values.publicDescription),
    sortOrder: Number(values.sortOrder || 999),
    updatedAt: now,
  });

  await setDoc(doc(db, PUBLIC_CARS_COLLECTION, car.id), publicCar, {
    merge: true,
  });
}

export async function unpublishCarFromPublicListing(carId: string): Promise<void> {
  await deleteDoc(doc(db, PUBLIC_CARS_COLLECTION, carId));
}
