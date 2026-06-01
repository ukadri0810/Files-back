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

export type VehicleType = "Car" | "Bike" | "Scooter" | "Van" | "Other";

export type Car = {
  id: string;
  vehicleType: VehicleType;
  carName: string;
  vehicleNumber: string;
  fuelType: "Petrol" | "Diesel" | "CNG" | "Electric";
  transmissionType: "Manual" | "Automatic";
  currentKm: number;
  defaultDailyRent: number;
  defaultPerKmRate: number;
  extraKmRate: number;
  lateHourlyCharge: number;
  status: "Available" | "Booked" | "In Service" | "Maintenance";
  insuranceExpiryDate: string;
  pucExpiryDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const CARS_KEY = "drivelog_cars";
const CARS_COLLECTION = "cars";
const DELETED_CARS_COLLECTION = "deleted_cars";

function normalizeText(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function normalizeCar(car: Partial<Car> & { id: string }): Car {
  const now = new Date().toISOString();

  return {
    id: car.id,
    vehicleType: (car.vehicleType ?? "Car") as VehicleType,
    carName: normalizeText(car.carName),
    vehicleNumber: normalizeText(car.vehicleNumber)
      .toUpperCase()
      .replace(/\s+/g, ""),
    fuelType: car.fuelType ?? "Petrol",
    transmissionType: car.transmissionType ?? "Manual",
    currentKm: Number(car.currentKm ?? 0),
    defaultDailyRent: Number(car.defaultDailyRent ?? 0),
    defaultPerKmRate: Number(car.defaultPerKmRate ?? 0),
    extraKmRate: Number(car.extraKmRate ?? 0),
    lateHourlyCharge: Number(car.lateHourlyCharge ?? 0),
    status: car.status ?? "Available",
    insuranceExpiryDate: normalizeText(car.insuranceExpiryDate),
    pucExpiryDate: normalizeText(car.pucExpiryDate),
    notes: normalizeText(car.notes),
    createdAt: car.createdAt ?? now,
    updatedAt: car.updatedAt ?? now,
  };
}

function notifyCarsUpdated() {
  window.dispatchEvent(new Event("drivelog_cars_updated"));
}

function saveCarsToCache(cars: Car[]): void {
  localStorage.setItem(CARS_KEY, JSON.stringify(cars));
  notifyCarsUpdated();
}

function getCarsFromCache(): Car[] {
  const data = localStorage.getItem(CARS_KEY);

  if (!data) {
    return [];
  }

  try {
    const cars = JSON.parse(data) as Car[];
    return cars.map((car) => normalizeCar(car));
  } catch (e) {
    console.error("Failed to parse cars", e);
    return [];
  }
}

function mergeCars(localCars: Car[], firestoreCars: Car[]): Car[] {
  const map = new Map<string, Car>();

  for (const car of localCars) {
    map.set(car.id, normalizeCar(car));
  }

  for (const firestoreCar of firestoreCars) {
    const existing = map.get(firestoreCar.id);

    if (!existing) {
      map.set(firestoreCar.id, normalizeCar(firestoreCar));
      continue;
    }

    const existingTime = new Date(existing.updatedAt).getTime();
    const firestoreTime = new Date(firestoreCar.updatedAt).getTime();

    map.set(
      firestoreCar.id,
      firestoreTime >= existingTime
        ? normalizeCar(firestoreCar)
        : normalizeCar(existing)
    );
  }

  return Array.from(map.values()).sort((a, b) =>
    a.carName.localeCompare(b.carName)
  );
}

async function saveCarsToFirestore(cars: Car[]): Promise<void> {
  await Promise.all(
    cars.map((car) => {
      const carRef = doc(db, CARS_COLLECTION, car.id);
      return setDoc(carRef, car, { merge: true });
    })
  );
}

async function getDeletedCarIds(): Promise<Set<string>> {
  const deletedRef = collection(db, DELETED_CARS_COLLECTION);
  const snapshot = await getDocs(deletedRef);

  return new Set(snapshot.docs.map((documentSnapshot) => documentSnapshot.id));
}

export function getCars(): Car[] {
  return getCarsFromCache();
}

export function getCar(id: string): Car | undefined {
  return getCars().find((car) => car.id === id);
}

export function saveCar(car: Car): void {
  const now = new Date().toISOString();
  const cars = getCarsFromCache();
  const existing = cars.findIndex((item) => item.id === car.id);

  const savedCar: Car =
    existing >= 0
      ? normalizeCar({
          ...cars[existing],
          ...car,
          updatedAt: now,
        })
      : normalizeCar({
          ...car,
          createdAt: car.createdAt || now,
          updatedAt: now,
        });

  if (existing >= 0) {
    cars[existing] = savedCar;
  } else {
    cars.push(savedCar);
  }

  saveCarsToCache(cars);

  const carRef = doc(db, CARS_COLLECTION, savedCar.id);

  void setDoc(carRef, savedCar, { merge: true }).catch((error) => {
    console.error("Failed to save car to Firestore", error);
  });
}

export function deleteCar(id: string): void {
  const now = new Date().toISOString();

  const cars = getCarsFromCache().filter((car) => car.id !== id);
  saveCarsToCache(cars);

  const carRef = doc(db, CARS_COLLECTION, id);
  const deletedCarRef = doc(db, DELETED_CARS_COLLECTION, id);

  void Promise.all([
    deleteDoc(carRef),
    setDoc(
      deletedCarRef,
      {
        id,
        deletedAt: now,
      },
      { merge: true }
    ),
  ]).catch((error) => {
    console.error("Failed to delete car from Firestore", error);
  });
}

export function updateCarStatus(id: string, status: Car["status"]): void {
  const car = getCar(id);

  if (car) {
    saveCar({
      ...car,
      status,
    });
  }
}

export async function syncCarsFromFirestore(): Promise<Car[]> {
  const resetInProgress =
    localStorage.getItem(RESET_IN_PROGRESS_KEY) === "true";

  const shouldIgnoreLocalCache = await shouldIgnoreLocalCacheForReset();

  const deletedCarIds = await getDeletedCarIds();

  const carsRef = collection(db, CARS_COLLECTION);
  const snapshot = await getDocs(carsRef);

  const firestoreCars = snapshot.docs
    .map((documentSnapshot) =>
      normalizeCar({
        id: documentSnapshot.id,
        ...(documentSnapshot.data() as Partial<Car>),
      })
    )
    .filter((car) => !deletedCarIds.has(car.id));

  if (resetInProgress || shouldIgnoreLocalCache) {
    saveCarsToCache(firestoreCars);
    return firestoreCars;
  }

  const localCars = getCarsFromCache().filter(
    (car) => !deletedCarIds.has(car.id)
  );

  const mergedCars = mergeCars(localCars, firestoreCars);

  saveCarsToCache(mergedCars);

  if (mergedCars.length > 0) {
    await saveCarsToFirestore(mergedCars);
  }

  return mergedCars;
}

export function listenToCarsSync(): () => void {
  const carsRef = collection(db, CARS_COLLECTION);
  const deletedCarsRef = collection(db, DELETED_CARS_COLLECTION);

  let latestCars: Car[] = [];
  let deletedCarIds = new Set<string>();

  const applyRealtimeCache = () => {
    const safeCars = latestCars
      .filter((car) => !deletedCarIds.has(car.id))
      .sort((a, b) => a.carName.localeCompare(b.carName));

    saveCarsToCache(safeCars);
  };

  const unsubscribeCars = onSnapshot(
    carsRef,
    (snapshot) => {
      latestCars = snapshot.docs.map((documentSnapshot) =>
        normalizeCar({
          id: documentSnapshot.id,
          ...(documentSnapshot.data() as Partial<Car>),
        })
      );

      applyRealtimeCache();
    },
    (error) => {
      console.error("Realtime cars sync failed", error);
    }
  );

  const unsubscribeDeletedCars = onSnapshot(
    deletedCarsRef,
    (snapshot) => {
      deletedCarIds = new Set(
        snapshot.docs.map((documentSnapshot) => documentSnapshot.id)
      );

      applyRealtimeCache();
    },
    (error) => {
      console.error("Realtime deleted cars sync failed", error);
    }
  );

  return () => {
    unsubscribeCars();
    unsubscribeDeletedCars();
  };
}
