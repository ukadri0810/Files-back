import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
  SlidersHorizontal,
  User,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getPublicCars, PublicCar } from "@/services/publicCarService";
import {
  getAvailabilityBlocks,
  AvailabilityBlock,
} from "@/services/availabilityBlockService";
import { getPublicCarAvailabilityForRange } from "@/utils/availabilityUtils";
import { createBookingRequest } from "@/services/bookingRequestService";
import { generateWhatsAppLink } from "@/utils/whatsappUtils";
import { useToast } from "@/hooks/use-toast";
import {
  getPublicBusinessSettings,
  PublicBusinessSettings,
} from "@/services/settingsService";

type BookingStep = "dates" | "vehicle" | "details" | "review";

type VehicleSortOption =
  | "price-low-high"
  | "price-high-low"
  | "available-first"
  | "name-a-z";

type VehicleFilterOption =
  | "all"
  | "available"
  | "car"
  | "bike"
  | "automatic"
  | "manual"
  | "petrol"
  | "diesel"
  | "cng"
  | "electric";

function getDateInputValue(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().substring(0, 10);
}

function getDateTimeLocalValue(offsetDays = 0, fallbackTime = "12:00"): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  const [hoursText, minutesText] = fallbackTime.split(":");
  date.setHours(Number(hoursText || 12), Number(minutesText || 0), 0, 0);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());

  return date.toISOString().substring(0, 16);
}

function getTodayDateInputValue(): string {
  return getDateInputValue(0);
}

function getNowDateTimeLocalValue(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().substring(0, 16);
}

function clampDateToToday(dateInput: string): string {
  if (!dateInput || dateInput < getTodayDateInputValue()) {
    return getTodayDateInputValue();
  }

  return dateInput;
}

function clampDateTimeToNow(dateTimeInput: string): string {
  const now = getNowDateTimeLocalValue();

  if (!dateTimeInput || dateTimeInput < now) {
    return now;
  }

  return dateTimeInput;
}

function buildDateTime(dateInput: string, timeInput: string): string {
  return `${dateInput}T${timeInput || "12:00"}`;
}

function addDaysToDateInput(dateInput: string, days: number): string {
  const date = new Date(`${dateInput}T00:00`);
  date.setDate(date.getDate() + Math.max(1, Number(days || 1)));
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().substring(0, 10);
}

function calculateRentalDays(
  pickupDateTime: string,
  returnDateTime: string
): number {
  const pickup = new Date(pickupDateTime).getTime();
  const drop = new Date(returnDateTime).getTime();

  if (Number.isNaN(pickup) || Number.isNaN(drop) || drop <= pickup) {
    return 1;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((drop - pickup) / dayMs));
}

function calculateRentalHours(
  pickupDateTime: string,
  returnDateTime: string
): number {
  const pickup = new Date(pickupDateTime).getTime();
  const drop = new Date(returnDateTime).getTime();

  if (Number.isNaN(pickup) || Number.isNaN(drop) || drop <= pickup) {
    return 1;
  }

  const hourMs = 60 * 60 * 1000;
  return Math.max(1, Math.ceil((drop - pickup) / hourMs));
}

function formatTimeForDisplay(time: string): string {
  if (!time) return "12:00";
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText || 0);
  if (Number.isNaN(hour)) return time;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatPublicDateTime(value: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cleanPhone(value: string): string {
  return value.replace(/[^\d+]/g, "").trim();
}

function getStepNumber(step: BookingStep): number {
  const order: BookingStep[] = ["dates", "vehicle", "details", "review"];
  return order.indexOf(step) + 1;
}

export default function PublicBookingLanding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<BookingStep>("dates");
  const [businessSettings, setBusinessSettings] =
    useState<PublicBusinessSettings | null>(null);
  const [cars, setCars] = useState<PublicCar[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<
    AvailabilityBlock[]
  >([]);
  const [selectedCarId, setSelectedCarId] = useState("");
  const [vehicleSort, setVehicleSort] =
    useState<VehicleSortOption>("price-low-high");
  const [vehicleFilter, setVehicleFilter] =
    useState<VehicleFilterOption>("all");
  const [loadingCars, setLoadingCars] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [pickupDate, setPickupDate] = useState(getDateInputValue(1));
  const [rentalDays, setRentalDays] = useState(1);
  const [rentalDaysInput, setRentalDaysInput] = useState("1");
  const [pickupDateTime, setPickupDateTime] = useState(
    getDateTimeLocalValue(1)
  );
  const [returnDateTime, setReturnDateTime] = useState(
    getDateTimeLocalValue(2)
  );

  const [formData, setFormData] = useState({
    customerName: "",
    phone: "",
    aadhaarNumberOrLast4: "",
    drivingLicenseNumber: "",
    address: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    customerNote: "",
  });

  useEffect(() => {
    let mounted = true;

    Promise.all([
      getPublicBusinessSettings(),
      getPublicCars(),
      getAvailabilityBlocks(),
    ])
      .then(([publicSettings, publicCars, blocks]) => {
        if (!mounted) {
          return;
        }

        setBusinessSettings(publicSettings);
        setCars(publicCars);
        setAvailabilityBlocks(blocks);

        if (publicSettings.bookingBillingMode === "DAILY") {
          const minimumDays = Math.max(
            1,
            Number(publicSettings.minimumRentalDays || 1)
          );
          const date = getDateInputValue(1);
          const pickup = buildDateTime(date, publicSettings.defaultPickupTime);
          const returnDate = addDaysToDateInput(date, minimumDays);
          const drop = buildDateTime(
            returnDate,
            publicSettings.defaultReturnTime
          );

          setPickupDate(date);
          setRentalDays(minimumDays);
          setRentalDaysInput(String(minimumDays));
          setPickupDateTime(pickup);
          setReturnDateTime(drop);
        } else {
          const minimumHours = Math.max(
            1,
            Number(publicSettings.minimumRentalHours || 1)
          );
          const pickup = getDateTimeLocalValue(
            1,
            publicSettings.defaultPickupTime
          );
          const dropDate = new Date(pickup);
          dropDate.setHours(dropDate.getHours() + minimumHours);
          dropDate.setMinutes(dropDate.getMinutes() - dropDate.getTimezoneOffset());

          setPickupDateTime(pickup);
          setReturnDateTime(dropDate.toISOString().substring(0, 16));
        }
      })
      .catch((error) => {
        console.error("Failed to load public cars", error);

        toast({
          title: "Could not load vehicles",
          description: "Please contact the owner on WhatsApp.",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (mounted) {
          setLoadingCars(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [toast]);

  const carAvailabilityOptions = useMemo(() => {
    return cars.map((car) => ({
      car,
      availability: getPublicCarAvailabilityForRange(
        car,
        pickupDateTime,
        returnDateTime,
        availabilityBlocks
      ),
    }));
  }, [cars, pickupDateTime, returnDateTime, availabilityBlocks]);

  const selectedOption = carAvailabilityOptions.find(
    (option) => option.car.id === selectedCarId
  );

  const selectedCar = selectedOption?.car;
  const selectedCarAvailability = selectedOption?.availability;
  const bookingMode = businessSettings?.bookingBillingMode ?? "DAILY";
  const minimumRentalDays = Math.max(
    1,
    Number(businessSettings?.minimumRentalDays || 1)
  );
  const minimumRentalHours = Math.max(
    1,
    Number(businessSettings?.minimumRentalHours || 1)
  );
  const calculatedRentalDays = calculateRentalDays(
    pickupDateTime,
    returnDateTime
  );
  const calculatedRentalHours = calculateRentalHours(
    pickupDateTime,
    returnDateTime
  );
  const rentalDaysInputNumber = Number(rentalDaysInput);
  const validRentalDaysInput =
    rentalDaysInput.trim() !== "" &&
    !Number.isNaN(rentalDaysInputNumber) &&
    rentalDaysInputNumber > 0;
  const rentalDaysForEstimate = validRentalDaysInput
    ? Math.max(minimumRentalDays, rentalDaysInputNumber)
    : Math.max(minimumRentalDays, calculatedRentalDays);
  const rentalHoursForEstimate = Math.max(
    minimumRentalHours,
    calculatedRentalHours
  );
  const rentalDurationLabel =
    bookingMode === "HOURLY"
      ? `${rentalHoursForEstimate} hour${
          rentalHoursForEstimate !== 1 ? "s" : ""
        }`
      : `${rentalDaysForEstimate} day${
          rentalDaysForEstimate !== 1 ? "s" : ""
        }`;

  useEffect(() => {
    if (selectedCarId && selectedCarAvailability?.available) {
      return;
    }

    const firstAvailable = carAvailabilityOptions.find(
      (option) => option.availability.available
    );

    setSelectedCarId(firstAvailable?.car.id ?? "");
  }, [carAvailabilityOptions, selectedCarAvailability?.available, selectedCarId]);

  const estimatedRent = useMemo(() => {
    if (bookingMode === "HOURLY") {
      const hourlyRent = Number(
        selectedCar?.defaultHourlyRent ||
          businessSettings?.defaultHourlyRent ||
          Math.ceil(Number(selectedCar?.defaultDailyRent || 0) / 24)
      );

      return hourlyRent * rentalHoursForEstimate;
    }

    return Number(selectedCar?.defaultDailyRent || 0) * rentalDaysForEstimate;
  }, [
    selectedCar,
    bookingMode,
    businessSettings?.defaultHourlyRent,
    rentalDaysForEstimate,
    rentalHoursForEstimate,
  ]);

  const securityDeposit = Number(
    businessSettings?.defaultSecurityDeposit ?? selectedCar?.securityDeposit ?? 0
  );
  const totalEstimate = estimatedRent + securityDeposit;

  const businessName = businessSettings?.businessName || "DriveLog";
  const ownerPhone = businessSettings?.ownerPhone || "";
  const businessAddress = businessSettings?.businessAddress || "";
  const publicInstructions =
    businessSettings?.publicBookingInstructions ||
    "Select your dates, choose an available vehicle, submit your details, and the owner will confirm your booking after verification.";

  const whatsappMessage = `Hi, I want to book a self-drive vehicle from ${businessName}.`;
  const whatsappLink = generateWhatsAppLink(ownerPhone, whatsappMessage);

  const getVehicleDisplayPrice = (car: PublicCar): number => {
    if (bookingMode === "HOURLY") {
      return Number(
        car.defaultHourlyRent ||
          businessSettings?.defaultHourlyRent ||
          Math.ceil(Number(car.defaultDailyRent || 0) / 24)
      );
    }

    return Number(car.defaultDailyRent || 0);
  };

  const visibleCarOptions = useMemo(() => {
    const filtered = carAvailabilityOptions.filter(({ car, availability }) => {
      switch (vehicleFilter) {
        case "available":
          return availability.available;
        case "car":
          return car.vehicleType === "Car";
        case "bike":
          return car.vehicleType === "Bike";
        case "automatic":
          return car.transmissionType === "Automatic";
        case "manual":
          return car.transmissionType === "Manual";
        case "petrol":
          return car.fuelType === "Petrol";
        case "diesel":
          return car.fuelType === "Diesel";
        case "cng":
          return car.fuelType === "CNG";
        case "electric":
          return car.fuelType === "Electric";
        default:
          return true;
      }
    });

    return [...filtered].sort((a, b) => {
      if (vehicleSort === "available-first") {
        if (a.availability.available !== b.availability.available) {
          return a.availability.available ? -1 : 1;
        }

        return getVehicleDisplayPrice(a.car) - getVehicleDisplayPrice(b.car);
      }

      if (vehicleSort === "price-high-low") {
        return getVehicleDisplayPrice(b.car) - getVehicleDisplayPrice(a.car);
      }

      if (vehicleSort === "name-a-z") {
        return a.car.carName.localeCompare(b.car.carName);
      }

      return getVehicleDisplayPrice(a.car) - getVehicleDisplayPrice(b.car);
    });
  }, [
    carAvailabilityOptions,
    vehicleFilter,
    vehicleSort,
    bookingMode,
    businessSettings?.defaultHourlyRent,
  ]);

  const updateFormData = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const applyDailyWindow = (nextDate: string, nextDays: number) => {
    const safeDate = clampDateToToday(nextDate);
    const safeDays = Math.max(
      minimumRentalDays,
      Number(nextDays || minimumRentalDays)
    );
    const pickup = buildDateTime(
      safeDate,
      businessSettings?.defaultPickupTime || "12:00"
    );
    const returnDate = addDaysToDateInput(safeDate, safeDays);
    const drop = buildDateTime(
      returnDate,
      businessSettings?.defaultReturnTime || "12:00"
    );

    setPickupDate(safeDate);
    setRentalDays(safeDays);
    setRentalDaysInput(String(safeDays));
    setPickupDateTime(pickup);
    setReturnDateTime(drop);
  };

  const handleRentalDaysInputChange = (value: string) => {
    setRentalDaysInput(value);

    if (value.trim() === "") {
      setRentalDays(0);
      return;
    }

    const parsedDays = Number(value);

    if (Number.isNaN(parsedDays) || parsedDays <= 0) {
      setRentalDays(0);
      return;
    }

    applyDailyWindow(pickupDate, parsedDays);
  };

  const applyHourlyReturn = (nextPickupDateTime: string) => {
    const safePickupDateTime = clampDateTimeToNow(nextPickupDateTime);
    const pickup = new Date(safePickupDateTime);
    if (Number.isNaN(pickup.getTime())) return;

    const drop = new Date(pickup);
    drop.setHours(drop.getHours() + minimumRentalHours);
    drop.setMinutes(drop.getMinutes() - drop.getTimezoneOffset());

    setPickupDateTime(safePickupDateTime);
    setReturnDateTime(drop.toISOString().substring(0, 16));
  };

  const validateDateSelection = () => {
    const now = new Date();

    if (new Date(pickupDateTime).getTime() < now.getTime()) {
      toast({
        title: "Invalid pickup time",
        description: "Please select today or a future pickup date/time.",
        variant: "destructive",
      });
      return false;
    }

    if (new Date(returnDateTime).getTime() <= new Date(pickupDateTime).getTime()) {
      toast({
        title: "Invalid return time",
        description: "Return date/time must be after pickup date/time.",
        variant: "destructive",
      });
      return false;
    }

    if (
      bookingMode === "DAILY" &&
      (!validRentalDaysInput || rentalDaysInputNumber < minimumRentalDays)
    ) {
      toast({
        title: "Invalid rental duration",
        description: `Minimum booking duration is ${minimumRentalDays} day${
          minimumRentalDays !== 1 ? "s" : ""
        }.` ,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const validateVehicleSelection = () => {
    if (!selectedCar) {
      toast({
        title: "Select vehicle",
        description: "Please select an available vehicle before continuing.",
        variant: "destructive",
      });
      return false;
    }

    if (!selectedCarAvailability?.available) {
      toast({
        title: "Vehicle not available",
        description:
          selectedCarAvailability?.description ||
          "Please choose another vehicle or date/time.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const validateCustomerDetails = () => {
    if (!formData.customerName.trim()) {
      toast({ title: "Enter full name", variant: "destructive" });
      return false;
    }

    if (cleanPhone(formData.phone).length < 10) {
      toast({ title: "Enter valid phone number", variant: "destructive" });
      return false;
    }

    if (formData.aadhaarNumberOrLast4.trim().length < 4) {
      toast({
        title: "Enter Aadhaar number or last 4 digits",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.drivingLicenseNumber.trim()) {
      toast({
        title: "Enter driving license number",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.address.trim()) {
      toast({
        title: "Enter address",
        description: "Customer address is required for booking verification.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.emergencyContactName.trim()) {
      toast({
        title: "Enter emergency contact name",
        variant: "destructive",
      });
      return false;
    }

    if (cleanPhone(formData.emergencyContactPhone).length < 10) {
      toast({
        title: "Enter valid emergency contact phone",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const validateForm = () => {
    return (
      validateDateSelection() &&
      validateVehicleSelection() &&
      validateCustomerDetails()
    );
  };

  const goToVehicleStep = () => {
    if (!validateDateSelection()) return;
    setStep("vehicle");
  };

  const goToDetailsStep = () => {
    if (!validateDateSelection() || !validateVehicleSelection()) return;
    setStep("details");
  };

  const goToReviewStep = () => {
    if (
      !validateDateSelection() ||
      !validateVehicleSelection() ||
      !validateCustomerDetails()
    ) {
      return;
    }
    setStep("review");
  };

  const handleSubmitRequest = async () => {
    if (!validateForm() || !selectedCar) return;

    setSubmitting(true);

    try {
      const requestId = await createBookingRequest({
        customerName: formData.customerName,
        phone: cleanPhone(formData.phone),
        aadhaarNumberOrLast4: formData.aadhaarNumberOrLast4,
        drivingLicenseNumber: formData.drivingLicenseNumber,
        address: formData.address,
        emergencyContactName: formData.emergencyContactName,
        emergencyContactPhone: cleanPhone(formData.emergencyContactPhone),
        selectedCarId: selectedCar.id,
        selectedCarName: selectedCar.carName,
        pickupDateTime: new Date(pickupDateTime).toISOString(),
        returnDateTime: new Date(returnDateTime).toISOString(),
        estimatedRent,
        securityDeposit,
        customerNote: `${formData.customerNote}${
          formData.customerNote ? "\n" : ""
        }Booking mode: ${bookingMode} · Duration: ${rentalDurationLabel}`,
        leadSource: "Public booking page",
      });

      toast({
        title: "Booking request submitted",
        description: "Owner will verify availability and contact you.",
      });

      setLocation(`/booking-success/${requestId}`);
    } catch (error) {
      console.error("Failed to submit booking request", error);

      toast({
        title: "Could not submit request",
        description: "Please try again or contact owner on WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => {
    const steps: { key: BookingStep; label: string }[] = [
      { key: "dates", label: "Dates" },
      { key: "vehicle", label: "Vehicle" },
      { key: "details", label: "Details" },
      { key: "review", label: "Review" },
    ];

    return (
      <div className="rounded-2xl border bg-card p-3 shadow-sm">
        <div className="grid grid-cols-4 gap-2">
          {steps.map((item, index) => {
            const active = item.key === step;
            const completed = index + 1 < getStepNumber(step);

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.key === "vehicle" && !validateDateSelection()) return;
                  if (item.key === "details" && !validateVehicleSelection()) return;
                  if (item.key === "review" && !validateCustomerDetails()) return;
                  setStep(item.key);
                }}
                className={`rounded-xl px-2 py-2 text-center text-[11px] font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : completed
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-muted/50 text-muted-foreground"
                }`}
              >
                <span className="block text-xs">{index + 1}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderEstimateCard = () => (
    <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 font-semibold">
        <Clock className="h-4 w-4 text-primary" />
        Booking Estimate
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Vehicle</span>
          <span className="font-medium text-right">
            {selectedCar?.carName || "Not selected"}
          </span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Pickup</span>
          <span className="font-medium text-right">
            {formatPublicDateTime(pickupDateTime)}
          </span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Return</span>
          <span className="font-medium text-right">
            {formatPublicDateTime(returnDateTime)}
          </span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Duration</span>
          <span className="font-medium">{rentalDurationLabel}</span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Rent</span>
          <span className="font-medium">
            ₹{estimatedRent.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Security deposit</span>
          <span className="font-medium">
            ₹{securityDeposit.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex justify-between gap-3 border-t pt-2 font-bold">
          <span>Total estimate</span>
          <span>₹{totalEstimate.toLocaleString("en-IN")}</span>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Final booking is confirmed only after owner approval and payment
        verification.
      </p>
    </div>
  );

  const renderDateStep = () => (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-5">
      <div>
        <h2 className="text-xl font-bold">When do you need the vehicle?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose pickup and return period first. Vehicle availability will update
          according to this time.
        </p>
      </div>

      {bookingMode === "DAILY" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Pickup date</Label>
            <Input
              type="date"
              min={getTodayDateInputValue()}
              value={pickupDate}
              onChange={(event) =>
                applyDailyWindow(
                  event.target.value,
                  validRentalDaysInput ? rentalDaysInputNumber : minimumRentalDays
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Pickup time: {formatTimeForDisplay(businessSettings?.defaultPickupTime || "12:00")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Rental duration</Label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((days) => (
                <Button
                  key={days}
                  type="button"
                  variant={rentalDays === days ? "default" : "outline"}
                  onClick={() => applyDailyWindow(pickupDate, days)}
                >
                  {days}D
                </Button>
              ))}
            </div>

            <Input
              type="number"
              min={0}
              value={rentalDaysInput}
              onChange={(event) => handleRentalDaysInputChange(event.target.value)}
              onBlur={() => {
                if (!validRentalDaysInput) {
                  setRentalDaysInput("");
                  return;
                }

                if (rentalDaysInputNumber < minimumRentalDays) {
                  applyDailyWindow(pickupDate, minimumRentalDays);
                }
              }}
              placeholder={`Minimum ${minimumRentalDays} day${minimumRentalDays !== 1 ? "s" : ""}`}
            />

            {(!validRentalDaysInput || rentalDaysInputNumber < minimumRentalDays) && (
              <p className="text-xs text-amber-600 font-medium">
                Minimum booking duration is {minimumRentalDays} day{minimumRentalDays !== 1 ? "s" : ""}.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Return time: {formatTimeForDisplay(businessSettings?.defaultReturnTime || "12:00")}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Pickup date & time</Label>
            <Input
              type="datetime-local"
              min={getNowDateTimeLocalValue()}
              value={pickupDateTime}
              onChange={(event) => applyHourlyReturn(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Return date & time</Label>
            <Input
              type="datetime-local"
              min={pickupDateTime}
              value={returnDateTime}
              onChange={(event) => setReturnDateTime(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Minimum {minimumRentalHours} hour{minimumRentalHours !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-muted/30 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Selected duration</span>
          <span className="font-semibold">{rentalDurationLabel}</span>
        </div>
      </div>

      <Button type="button" className="w-full sm:w-auto gap-2" onClick={goToVehicleStep}>
        Continue to vehicles
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );

  const renderVehicleStep = () => (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-xl font-bold">Choose your vehicle</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Available vehicles can be selected. Booked vehicles stay visible as Not Available.
          </p>
          <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-800">
            Images shown are for reference purpose only. Actual vehicle may vary.
          </p>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold mb-3">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Sort & filter vehicles
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sort by</Label>
              <select
                value={vehicleSort}
                onChange={(event) =>
                  setVehicleSort(event.target.value as VehicleSortOption)
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="price-low-high">Price: Low to High</option>
                <option value="price-high-low">Price: High to Low</option>
                <option value="available-first">Available First</option>
                <option value="name-a-z">Name: A to Z</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Filter</Label>
              <select
                value={vehicleFilter}
                onChange={(event) =>
                  setVehicleFilter(event.target.value as VehicleFilterOption)
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All vehicles</option>
                <option value="available">Available only</option>
                <option value="car">Cars only</option>
                <option value="bike">Bikes only</option>
                <option value="automatic">Automatic</option>
                <option value="manual">Manual</option>
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="cng">CNG</option>
                <option value="electric">Electric</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Default order shows lowest price first.
          </p>
        </div>
      </div>

      {loadingCars && (
        <div className="rounded-xl border bg-card p-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading vehicles...
        </div>
      )}

      {!loadingCars && cars.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="font-semibold">No vehicles published yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Please contact the owner on WhatsApp for availability.
          </p>
        </div>
      )}

      {!loadingCars && cars.length > 0 && visibleCarOptions.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
          <p className="font-semibold">No vehicles match this filter</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try changing the filter or date/time.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleCarOptions.map(({ car, availability }) => {
          const selected = selectedCarId === car.id;
          const image = car.imageUrl || car.photoUrls[0] || "";

          return (
            <button
              key={car.id}
              type="button"
              disabled={!availability.available}
              onClick={() => {
                if (availability.available) setSelectedCarId(car.id);
              }}
              className={`text-left rounded-2xl border bg-card overflow-hidden transition ${
                availability.available
                  ? "hover:shadow-md"
                  : "opacity-70 cursor-not-allowed bg-muted/30"
              } ${selected ? "ring-2 ring-primary border-primary" : ""}`}
            >
              <div className="h-36 sm:h-44 bg-muted flex items-center justify-center overflow-hidden">
                {image ? (
                  <img src={image} alt={car.carName} className="h-full w-full object-cover" />
                ) : (
                  <Car className="h-12 w-12 text-muted-foreground" />
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg">{car.carName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {car.vehicleType} · {car.fuelType} · {car.transmissionType}
                    </p>
                  </div>

                  {availability.available ? (
                    selected ? (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 shrink-0">Available</span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 shrink-0">
                      <XCircle className="h-4 w-4" />
                      Not Available
                    </span>
                  )}
                </div>

                {car.publicDescription && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {car.publicDescription}
                  </p>
                )}

                {!availability.available && (
                  <p className="text-xs text-red-600 font-medium mt-2">{availability.description}</p>
                )}

                <div className="flex flex-wrap gap-2 mt-3">
                  {car.features.slice(0, 4).map((feature) => (
                    <span key={feature} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      {feature}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">Rent</p>
                    <p className="font-bold">
                      ₹{getVehicleDisplayPrice(car).toLocaleString("en-IN")}
                      {bookingMode === "HOURLY" ? "/hr" : "/day"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">Deposit</p>
                    <p className="font-bold">
                      ₹{Number(businessSettings?.defaultSecurityDeposit ?? car.securityDeposit ?? 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" onClick={() => setStep("dates")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Change dates
        </Button>

        <Button type="button" className="gap-2" onClick={goToDetailsStep}>
          Continue to details
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderDetailsStep = () => (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Fill customer details</h2>
          <p className="text-sm text-muted-foreground mt-1">
            These details are needed for document verification before confirming booking.
          </p>
        </div>

        <Button type="button" variant="outline" onClick={() => setStep("vehicle")}>Change vehicle</Button>
      </div>

      {selectedCar && (
        <div className="rounded-xl border bg-muted/30 p-3 text-sm">
          <p className="text-muted-foreground">Selected vehicle</p>
          <p className="font-semibold">{selectedCar.carName}</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Full name</Label>
          <Input value={formData.customerName} onChange={(event) => updateFormData("customerName", event.target.value)} placeholder="Your full name" />
        </div>

        <div className="space-y-2">
          <Label>Phone number / WhatsApp</Label>
          <Input type="tel" value={formData.phone} onChange={(event) => updateFormData("phone", event.target.value)} placeholder="9XXXXXXXXX" />
        </div>

        <div className="space-y-2">
          <Label>Driving license number</Label>
          <Input value={formData.drivingLicenseNumber} onChange={(event) => updateFormData("drivingLicenseNumber", event.target.value.toUpperCase())} placeholder="MHXXXXXXXXXXXX" className="uppercase" />
        </div>

        <div className="space-y-2">
          <Label>Aadhaar number / last 4 digits</Label>
          <Input value={formData.aadhaarNumberOrLast4} onChange={(event) => updateFormData("aadhaarNumberOrLast4", event.target.value.replace(/\D/g, ""))} placeholder="XXXX" maxLength={12} />
        </div>

        <div className="space-y-2">
          <Label>Address</Label>
          <Textarea value={formData.address} onChange={(event) => updateFormData("address", event.target.value)} placeholder="Your address" rows={2} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Emergency contact name</Label>
            <Input value={formData.emergencyContactName} onChange={(event) => updateFormData("emergencyContactName", event.target.value)} placeholder="Emergency contact" />
          </div>

          <div className="space-y-2">
            <Label>Emergency contact phone</Label>
            <Input type="tel" value={formData.emergencyContactPhone} onChange={(event) => updateFormData("emergencyContactPhone", event.target.value)} placeholder="9XXXXXXXXX" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Note / requirement</Label>
          <Textarea value={formData.customerNote} onChange={(event) => updateFormData("customerNote", event.target.value)} placeholder="Any note for owner" rows={2} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" onClick={() => setStep("vehicle")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Button type="button" className="gap-2" onClick={goToReviewStep}>
          Review request
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-5">
      <div>
        <h2 className="text-xl font-bold">Review and submit</h2>
        <p className="text-sm text-muted-foreground mt-1">Check details before sending request to owner.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Customer</p>
          <p className="font-semibold">{formData.customerName || "—"}</p>
          <p className="text-xs text-muted-foreground">{formData.phone || "—"}</p>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Vehicle</p>
          <p className="font-semibold">{selectedCar?.carName || "—"}</p>
          <p className="text-xs text-muted-foreground">{selectedCar?.fuelType} · {selectedCar?.transmissionType}</p>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Pickup</p>
          <p className="font-semibold">{formatPublicDateTime(pickupDateTime)}</p>
        </div>

        <div className="rounded-xl border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Return</p>
          <p className="font-semibold">{formatPublicDateTime(returnDateTime)}</p>
        </div>
      </div>

      {renderEstimateCard()}

      {businessSettings?.defaultTermsAndConditions && (
        <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground max-h-32 overflow-y-auto">
          <p className="font-semibold text-foreground mb-1">Terms</p>
          <p className="whitespace-pre-line">{businessSettings.defaultTermsAndConditions}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" onClick={() => setStep("details")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Button type="button" className="gap-2" onClick={handleSubmitRequest} disabled={submitting || !selectedCar || !selectedCarAvailability?.available}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Booking Request"
          )}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        By submitting, you agree that the owner will contact you for document and payment verification before confirming the booking.
      </p>
    </div>
  );

  return (
    <main className="min-h-screen bg-background text-foreground pb-28 md:pb-0">
      <section className="bg-gradient-to-b from-primary/10 to-background border-b">
        <div className="max-w-6xl mx-auto px-4 py-8 md:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Self-drive car rental booking request
              </div>

              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
                Book your self-drive vehicle with {businessName}
              </h1>

              <p className="text-muted-foreground mt-4 text-base md:text-lg">{publicInstructions}</p>

              <div className="grid grid-cols-3 gap-3 mt-6">
                <div className="rounded-xl border bg-background/80 p-3">
                  <CalendarDays className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-semibold">{bookingMode === "HOURLY" ? "Hourly" : "Daily"}</p>
                  <p className="text-xs text-muted-foreground">Booking rules</p>
                </div>

                <div className="rounded-xl border bg-background/80 p-3">
                  <Car className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-semibold">Vehicles</p>
                  <p className="text-xs text-muted-foreground">Live availability</p>
                </div>

                <div className="rounded-xl border bg-background/80 p-3">
                  <User className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-semibold">Verify</p>
                  <p className="text-xs text-muted-foreground">Owner approval</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-background/80 p-4 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">{businessName}</p>
                  {businessAddress && <p className="text-xs text-muted-foreground mt-0.5">{businessAddress}</p>}
                </div>
              </div>

              {ownerPhone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {ownerPhone}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {bookingMode === "HOURLY"
                  ? `Hourly bookings · minimum ${minimumRentalHours} hour${minimumRentalHours !== 1 ? "s" : ""}`
                  : businessSettings?.fixedBookingWindowEnabled
                    ? `${formatTimeForDisplay(businessSettings.defaultPickupTime)} to ${formatTimeForDisplay(businessSettings.defaultReturnTime)} · minimum ${minimumRentalDays} day${minimumRentalDays !== 1 ? "s" : ""}`
                    : `Daily bookings · minimum ${minimumRentalDays} day${minimumRentalDays !== 1 ? "s" : ""}`}
              </div>

              <a href={whatsappLink} target="_blank" rel="noreferrer">
                <Button type="button" variant="outline" className="w-full gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Chat on WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {renderStepIndicator()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            {step === "dates" && renderDateStep()}
            {step === "vehicle" && renderVehicleStep()}
            {step === "details" && renderDetailsStep()}
            {step === "review" && renderReviewStep()}
          </div>

          <aside className="hidden lg:block lg:col-span-1">
            <div className="sticky top-4 space-y-4">
              {renderEstimateCard()}

              {selectedCar && (
                <div className="rounded-2xl border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">Selected vehicle</p>
                  <p className="font-bold">{selectedCar.carName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedCar.vehicleType} · {selectedCar.fuelType} · {selectedCar.transmissionType}
                  </p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setStep("vehicle")}>
                    Change vehicle
                  </Button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      {selectedCar && step !== "review" && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Selected vehicle</p>
              <p className="text-sm font-bold truncate">{selectedCar.carName}</p>
              <p className="text-xs text-muted-foreground">₹{totalEstimate.toLocaleString("en-IN")} estimated</p>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (step === "dates") goToVehicleStep();
                else if (step === "vehicle") goToDetailsStep();
                else if (step === "details") goToReviewStep();
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
