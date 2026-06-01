import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { getCars, deleteCar, Car, saveCar, VehicleType } from "@/services/carService";
import { getBookings } from "@/services/bookingService";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Car as CarIcon, Bike, Truck, Fuel, Gauge, Banknote, Globe2, Image as ImageIcon, SlidersHorizontal, Eye, EyeOff } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getSettings } from "@/services/settingsService";
import {
  getAllPublicCarsForAdmin,
  publishCarToPublicListing,
  unpublishCarFromPublicListing,
  PublicCar,
} from "@/services/publicCarService";

const statusColors: Record<string, string> = {
  Available:    "bg-emerald-400",
  Booked:       "bg-blue-400",
  "In Service": "bg-orange-400",
  Maintenance:  "bg-red-400",
};

const vehicleTypeIcon: Record<VehicleType, React.ReactNode> = {
  Car:    <CarIcon className="w-4 h-4" />,
  Bike:   <Bike className="w-4 h-4" />,
  Scooter:<Bike className="w-4 h-4" />,
  Van:    <Truck className="w-4 h-4" />,
  Other:  <CarIcon className="w-4 h-4" />,
};

const vehicleTypeOptions: VehicleType[] = ["Car", "Bike", "Scooter", "Van", "Other"];

type CarSortOption =
  | "price-low-high"
  | "price-high-low"
  | "available-first"
  | "name-a-z"
  | "status";

type StatusFilterOption =
  | "All"
  | "Available"
  | "Booked"
  | "In Service"
  | "Maintenance";

const carSchema = z.object({
  id: z.string().optional(),
  vehicleType: z.enum(["Car", "Bike", "Scooter", "Van", "Other"]),
  carName: z.string().min(1, "Name is required"),
  vehicleNumber: z.string().min(1, "Vehicle number is required"),
  fuelType: z.enum(["Petrol", "Diesel", "CNG", "Electric"]),
  transmissionType: z.enum(["Manual", "Automatic"]),
  currentKm: z.coerce.number().min(0),
  defaultDailyRent: z.coerce.number().min(0),
  defaultPerKmRate: z.coerce.number().min(0),
  extraKmRate: z.coerce.number().min(0),
  lateHourlyCharge: z.coerce.number().min(0),
  status: z.enum(["Available", "Booked", "In Service", "Maintenance"]),
  notes: z.string().optional(),
});

function VehicleFormModal({ car, onSave, onClose, open }: {
  car?: Car | null; onSave: () => void; onClose: () => void; open: boolean;
}) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof carSchema>>({
    resolver: zodResolver(carSchema),
    defaultValues: car || {
      vehicleType: "Car",
      carName: "", vehicleNumber: "", fuelType: "Petrol", transmissionType: "Manual",
      currentKm: 0, defaultDailyRent: 1500, defaultPerKmRate: 10, extraKmRate: 10,
      lateHourlyCharge: 200, status: "Available", notes: "",
    },
  });

  const vehicleType = form.watch("vehicleType");

  const onSubmit = (values: z.infer<typeof carSchema>) => {
    saveCar({
      ...values,
      id: values.id || Math.random().toString(36).substr(2, 9),
      createdAt: car?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Car);
    toast({ title: car ? "Vehicle updated" : "Vehicle added" });
    onSave(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={val => !val && onClose()}>
      <DialogContent className="w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{car ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Vehicle Type selector — prominent at the top */}
            <FormField control={form.control} name="vehicleType" render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Type</FormLabel>
                <div className="flex gap-2 flex-wrap">
                  {vehicleTypeOptions.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => field.onChange(type)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                        field.value === type
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      {vehicleTypeIcon[type as VehicleType]} {type}
                    </button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField control={form.control} name="carName" render={({ field }) => (
                <FormItem>
                  <FormLabel>{vehicleType === "Bike" || vehicleType === "Scooter" ? "Bike/Scooter Name" : "Vehicle Name"}</FormLabel>
                  <FormControl><Input placeholder={vehicleType === "Bike" ? "e.g. Honda Activa" : "e.g. Maruti Swift"} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="vehicleNumber" render={({ field }) => (
                <FormItem><FormLabel>Vehicle Number</FormLabel><FormControl><Input placeholder="MH12AB1234" {...field} className="uppercase" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="fuelType" render={({ field }) => (
                <FormItem><FormLabel>Fuel Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["Petrol","Diesel","CNG","Electric"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="transmissionType" render={({ field }) => (
                <FormItem><FormLabel>Transmission</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Manual">Manual</SelectItem>
                      <SelectItem value="Automatic">Automatic</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currentKm" render={({ field }) => (
                <FormItem><FormLabel>Current KM</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["Available","Booked","In Service","Maintenance"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="defaultDailyRent" render={({ field }) => (
                <FormItem><FormLabel>Daily Rent (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="defaultPerKmRate" render={({ field }) => (
                <FormItem><FormLabel>Per KM Rate (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="extraKmRate" render={({ field }) => (
                <FormItem><FormLabel>Extra KM Rate (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lateHourlyCharge" render={({ field }) => (
                <FormItem><FormLabel>Late Hourly Charge (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1">Save Vehicle</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PublicListingModal({
  car,
  publicCar,
  open,
  onClose,
  onSaved,
}: {
  car: Car;
  publicCar?: PublicCar | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const settings = getSettings();

  const [enabled, setEnabled] = useState(Boolean(publicCar));
  const [publicName, setPublicName] = useState(publicCar?.carName || car.carName);
  const [publicDescription, setPublicDescription] = useState(
    publicCar?.publicDescription || car.notes || ""
  );
  const [imageUrl, setImageUrl] = useState(publicCar?.imageUrl || "");
  const [photoUrlsText, setPhotoUrlsText] = useState(
    publicCar?.photoUrls?.join("\n") || ""
  );
  const [featuresText, setFeaturesText] = useState(
    publicCar?.features?.join(", ") ||
      `${car.vehicleType}, ${car.fuelType}, ${car.transmissionType}`
  );
  const [dailyRent, setDailyRent] = useState(
    Number(publicCar?.defaultDailyRent ?? car.defaultDailyRent ?? 0)
  );
  const [securityDeposit, setSecurityDeposit] = useState(
    Number(publicCar?.securityDeposit ?? settings.defaultSecurityDeposit ?? 0)
  );
  const [showRegistrationNumber, setShowRegistrationNumber] = useState(
    Boolean(publicCar?.showRegistrationNumber ?? false)
  );
  const [publicRules, setPublicRules] = useState(
    publicCar?.publicRules ||
      "Extra hourly charges, fuel difference, toll/Fastag/challan, scratches, damage, cleaning, and late return charges may be deducted from the refundable security deposit as per business policy."
  );
  const [sortOrder, setSortOrder] = useState(Number(publicCar?.sortOrder ?? 999));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);

    try {
      if (!enabled) {
        await unpublishCarFromPublicListing(car.id);

        toast({
          title: "Removed from public page",
          description: `${car.carName} will not be shown on /book-now.`,
        });

        onSaved();
        onClose();
        return;
      }

      await publishCarToPublicListing(car, {
        enabled,
        carName: publicName,
        publicDescription,
        imageUrl,
        photoUrlsText,
        featuresText,
        defaultDailyRent: dailyRent,
        defaultHourlyRent: Number(car.lateHourlyCharge || 0),
        securityDeposit,
        showRegistrationNumber,
        publicRules,
        sortOrder,
      });

      toast({
        title: "Published to public booking page",
        description:
          showRegistrationNumber
            ? "Customer can now see this vehicle on /book-now with registration number."
            : "Customer can now see this vehicle on /book-now without registration number.",
      });

      onSaved();
      onClose();
    } catch (error) {
      console.error("Failed to update public listing", error);

      toast({
        title: "Could not update public listing",
        description: "Please check Firebase rules and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-primary" />
            Public Booking Listing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border bg-amber-50 border-amber-200 p-3 text-sm text-amber-800">
            By default registration number is hidden. Enable it only if the owner
            wants customers to see it on /book-now.
          </div>

          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <p className="font-semibold">Show this vehicle on /book-now</p>
              <p className="text-xs text-muted-foreground">
                Customers can see this vehicle and submit a booking request.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setEnabled((current) => !current)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                enabled
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {enabled ? "Published" : "Not Published"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Public Vehicle Name</label>
              <Input
                value={publicName}
                onChange={(event) => setPublicName(event.target.value)}
                placeholder="e.g. Swift Manual Petrol"
              />
              <p className="text-xs text-muted-foreground">
                Use customer-friendly name. Registration visibility is controlled below.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Daily Rent (₹)</label>
              <Input
                type="number"
                min="0"
                value={dailyRent}
                onChange={(event) => setDailyRent(Number(event.target.value || 0))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Security Deposit (₹)</label>
              <Input
                type="number"
                min="0"
                value={securityDeposit}
                onChange={(event) =>
                  setSecurityDeposit(Number(event.target.value || 0))
                }
              />
            </div>

            <div className="sm:col-span-2 rounded-xl border p-4 flex items-start justify-between gap-3">
              <div>
                <label className="text-sm font-semibold flex items-center gap-2">
                  {showRegistrationNumber ? (
                    <Eye className="h-4 w-4 text-primary" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  Show registration number on customer page
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Current number: <span className="font-mono uppercase">{car.vehicleNumber}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowRegistrationNumber((current) => !current)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border shrink-0 ${
                  showRegistrationNumber
                    ? "bg-blue-100 text-blue-700 border-blue-200"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {showRegistrationNumber ? "Visible" : "Hidden"}
              </button>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Main Image URL</label>
              <Input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                For now paste image URL. Later we can add image upload.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">More Photo URLs</label>
              <Textarea
                value={photoUrlsText}
                onChange={(event) => setPhotoUrlsText(event.target.value)}
                rows={3}
                placeholder="One image URL per line"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Features</label>
              <Input
                value={featuresText}
                onChange={(event) => setFeaturesText(event.target.value)}
                placeholder="AC, 5 Seater, Manual, Petrol"
              />
              <p className="text-xs text-muted-foreground">
                Separate features with comma.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Public Description</label>
              <Textarea
                value={publicDescription}
                onChange={(event) => setPublicDescription(event.target.value)}
                rows={3}
                placeholder="Short customer-friendly description"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Customer Rules / Extra Charges</label>
              <Textarea
                value={publicRules}
                onChange={(event) => setPublicRules(event.target.value)}
                rows={4}
                placeholder="Extra hourly charge, fuel difference, toll/Fastag, scratches, damage, cleaning, late return charges..."
              />
              <p className="text-xs text-muted-foreground">
                These rules are shown when customer opens vehicle details before selecting.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sort Order</label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(event) => setSortOrder(Number(event.target.value || 999))}
              />
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <p className="text-xs text-muted-foreground">
                Customer page registration
              </p>
              <p className="font-mono font-semibold">
                {showRegistrationNumber ? car.vehicleNumber : "••••••••"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {showRegistrationNumber
                  ? "Visible to customers on /book-now."
                  : "Hidden from customers on /book-now."}
              </p>
            </div>
          </div>

          {imageUrl && (
            <div className="rounded-xl border overflow-hidden">
              <div className="h-52 bg-muted flex items-center justify-center">
                <img
                  src={imageUrl}
                  alt={publicName}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : enabled ? "Publish / Update" : "Remove Listing"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


export default function Cars() {
  const [cars, setCars]               = useState<Car[]>([]);
  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>("All");
  const [sortBy, setSortBy] = useState<CarSortOption>("price-low-high");
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [editingCar, setEditingCar]   = useState<Car | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [publicCars, setPublicCars] = useState<PublicCar[]>([]);
  const [publicListingCar, setPublicListingCar] = useState<Car | null>(null);
  const { toast } = useToast();

  const loadPublicCars = () => {
    getAllPublicCarsForAdmin()
      .then(setPublicCars)
      .catch((error) => {
        console.error("Failed to load public cars", error);
      });
  };

  const loadCars = () => {
    setCars(getCars());
    loadPublicCars();
  };

  useEffect(() => { loadCars(); }, []);

  const handleDelete = () => {
    if (!deleteId) {
      return;
    }

    const carBookings = getBookings().filter(
      (booking) => booking.carId === deleteId
    );

    if (carBookings.length > 0) {
      toast({
        title: "Vehicle cannot be deleted",
        description:
          "This vehicle has booking history. Keep it for records and mark it as Maintenance or In Service instead.",
        variant: "destructive",
      });

      setDeleteId(null);
      return;
    }

    deleteCar(deleteId);
    loadCars();
    setDeleteId(null);

    toast({ title: "Vehicle deleted" });
  };

  const filteredCars = useMemo(() => {
    const query = search.toLowerCase().trim();

    const filtered = cars.filter((car) => {
      const matchSearch =
        !query ||
        car.carName.toLowerCase().includes(query) ||
        car.vehicleNumber.toLowerCase().includes(query) ||
        car.fuelType.toLowerCase().includes(query) ||
        car.transmissionType.toLowerCase().includes(query);

      const matchType = typeFilter === "All" || car.vehicleType === typeFilter;
      const matchStatus =
        statusFilter === "All" || car.status === statusFilter;

      return matchSearch && matchType && matchStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "price-high-low") {
        return Number(b.defaultDailyRent || 0) - Number(a.defaultDailyRent || 0);
      }

      if (sortBy === "available-first") {
        if (a.status !== b.status) {
          if (a.status === "Available") return -1;
          if (b.status === "Available") return 1;
        }

        return Number(a.defaultDailyRent || 0) - Number(b.defaultDailyRent || 0);
      }

      if (sortBy === "name-a-z") {
        return a.carName.localeCompare(b.carName);
      }

      if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      }

      return Number(a.defaultDailyRent || 0) - Number(b.defaultDailyRent || 0);
    });
  }, [cars, search, typeFilter, statusFilter, sortBy]);

  const typeCount = (type: string) => type === "All" ? cars.length : cars.filter(c => c.vehicleType === type).length;

  const getPublicCar = (carId: string) =>
    publicCars.find((publicCar) => publicCar.id === carId);

  const publicListingCount = publicCars.length;

  return (
    <Layout>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fleet Management</h1>
            <p className="text-muted-foreground text-sm">Manage cars, bikes, and all vehicles.</p>
          </div>
          <Button onClick={() => { setEditingCar(null); setIsModalOpen(true); }} className="gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Add Vehicle
          </Button>
        </div>

        {/* Type filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["All", "Car", "Bike", "Scooter", "Van", "Other"] as const).map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                typeFilter === type
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {type !== "All" && vehicleTypeIcon[type as VehicleType]}
              {type}
              <span className={`text-xs ${typeFilter === type ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {typeCount(type)}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-xl border bg-card p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Search, sort & filter
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search name, number, fuel, transmission..."
                className="pl-8"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as CarSortOption)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="price-low-high">Price: Low to High</option>
              <option value="price-high-low">Price: High to Low</option>
              <option value="available-first">Available First</option>
              <option value="name-a-z">Name: A to Z</option>
              <option value="status">Status</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilterOption)
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="All">All Status</option>
              <option value="Available">Available</option>
              <option value="Booked">Booked</option>
              <option value="In Service">In Service</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs text-muted-foreground">
            <span>
              Showing <span className="font-semibold text-foreground">{filteredCars.length}</span> of{" "}
              <span className="font-semibold text-foreground">{cars.length}</span> vehicles
            </span>

            <span>
              <span className="font-semibold text-foreground">{publicListingCount}</span>{" "}
              vehicle{publicListingCount !== 1 ? "s" : ""} published on customer page
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCars.map(car => {
            const publishedCar = getPublicCar(car.id);

            return (
            <div key={car.id} className="bg-card border rounded-xl overflow-hidden card-lifted flex flex-col">
              <div className={`h-1.5 w-full ${statusColors[car.status] ?? "bg-slate-300"}`} />
              {publishedCar?.imageUrl && (
                <div className="h-36 bg-muted overflow-hidden">
                  <img
                    src={publishedCar.imageUrl}
                    alt={publishedCar.carName}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              {!publishedCar?.imageUrl && publishedCar && (
                <div className="h-20 bg-muted/40 flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
              <div className="p-4 flex-1">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-muted-foreground">{vehicleTypeIcon[car.vehicleType ?? "Car"]}</span>
                      <span className="text-xs text-muted-foreground font-medium">{car.vehicleType ?? "Car"}</span>
                    </div>
                    <h3 className="font-bold text-base truncate">{car.carName}</h3>
                    <span className="inline-block font-mono text-xs bg-muted px-2 py-0.5 rounded mt-0.5 uppercase tracking-wide">
                      {car.vehicleNumber}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={car.status} />
                    {publishedCar && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                        <Globe2 className="w-3 h-3" />
                        Public
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Banknote className="w-3.5 h-3.5" />Daily Rent</span>
                    <span className="font-semibold"><CurrencyDisplay amount={car.defaultDailyRent} /></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Gauge className="w-3.5 h-3.5" />Odometer</span>
                    <span className="font-medium">{car.currentKm.toLocaleString("en-IN")} km</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Fuel className="w-3.5 h-3.5" />Type</span>
                    <span className="font-medium">{car.fuelType} · {car.transmissionType}</span>
                  </div>
                </div>
              </div>
              <div className="border-t px-4 py-2.5 flex flex-wrap justify-end gap-1 bg-muted/20">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { setEditingCar(car); setIsModalOpen(true); }}>
                  <Edit className="w-3.5 h-3.5" /> Edit
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 gap-1.5 text-xs ${
                    publishedCar
                      ? "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setPublicListingCar(car)}
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  {publishedCar ? "Published" : "Publish"}
                </Button>

                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteId(car.id)}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            </div>
          );
          })}

          {filteredCars.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              <CarIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No vehicles found</p>
              <p className="text-sm mt-1">Add your first car or bike to get started.</p>
            </div>
          )}
        </div>

        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
          title="Delete Vehicle"
          description="This vehicle will be deleted only if it has no booking history. Vehicles with bookings are protected for reports and records."
          onConfirm={handleDelete}
        />
        {isModalOpen && (
          <VehicleFormModal open={isModalOpen} car={editingCar}
            onClose={() => { setIsModalOpen(false); setEditingCar(null); }} onSave={loadCars} />
        )}

        {publicListingCar && (
          <PublicListingModal
            open={!!publicListingCar}
            car={publicListingCar}
            publicCar={getPublicCar(publicListingCar.id)}
            onClose={() => setPublicListingCar(null)}
            onSaved={loadPublicCars}
          />
        )}
      </div>
    </Layout>
  );
}
