import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { getCars, Car } from "@/services/carService";
import { getBookings, Booking, PaymentEntry } from "@/services/bookingService";
import { getCustomers, Customer } from "@/services/customerService";
import { calculateFinalPayable } from "@/utils/billingUtils";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime } from "@/utils/dateUtils";
import { Link } from "wouter";
import {
  Car as CarIcon,
  CalendarCheck,
  TrendingUp,
  AlertCircle,
  ArrowDownCircle,
  Wrench,
  Clock,
  Plus,
  Search,
  ChevronRight,
  Phone,
  MessageSquare,
  Instagram,
  MapPin,
  CalendarDays,
} from "lucide-react";

const sourceIcon: Record<string, React.ReactNode> = {
  Phone: <Phone className="w-3 h-3" />,
  WhatsApp: <MessageSquare className="w-3 h-3" />,
  Instagram: <Instagram className="w-3 h-3" />,
  "Walk-in": <MapPin className="w-3 h-3" />,
};

function isDateToday(dateValue: string | null | undefined): boolean {
  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function getBookingPayments(booking: Partial<Booking>): PaymentEntry[] {
  return Array.isArray(booking.payments) ? booking.payments : [];
}

function getRentPaid(booking: Partial<Booking>): number {
  return getBookingPayments(booking)
    .filter(
      (payment) => payment.stage === "Advance" || payment.stage === "Return"
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function getDashboardPendingAmount(bookings: Booking[]): number {
  return bookings
    .filter((booking) => booking.bookingStatus !== "Cancelled")
    .reduce((sum, booking) => {
      const finalFare = calculateFinalPayable(booking);
      const rentPaid = getRentPaid(booking);

      return sum + Math.max(0, finalFare - rentPaid);
    }, 0);
}

function getDashboardMonthlyIncome(bookings: Booking[]): number {
  const now = new Date();

  return bookings
    .filter((booking) => {
      if (booking.bookingStatus !== "Completed") {
        return false;
      }

      const completedDate = new Date(
        booking.actualReturnDateTime || booking.updatedAt || booking.createdAt
      );

      if (Number.isNaN(completedDate.getTime())) {
        return false;
      }

      return (
        completedDate.getFullYear() === now.getFullYear() &&
        completedDate.getMonth() === now.getMonth()
      );
    })
    .reduce((sum, booking) => sum + calculateFinalPayable(booking), 0);
}

export default function Dashboard() {
  const [cars, setCars] = useState<Car[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});

  const reloadData = () => {
    setCars(getCars());

    const loadedBookings = getBookings();
    setBookings(loadedBookings);

    const customerMap: Record<string, Customer> = {};

    getCustomers().forEach((customer) => {
      customerMap[customer.id] = customer;
    });

    setCustomers(customerMap);
  };

  useEffect(() => {
    reloadData();

    const handleRefresh = () => reloadData();

    window.addEventListener("drivelog_cars_updated", handleRefresh);
    window.addEventListener("drivelog_bookings_updated", handleRefresh);
    window.addEventListener("drivelog_customers_updated", handleRefresh);

    return () => {
      window.removeEventListener("drivelog_cars_updated", handleRefresh);
      window.removeEventListener("drivelog_bookings_updated", handleRefresh);
      window.removeEventListener("drivelog_customers_updated", handleRefresh);
    };
  }, []);

  const carMap: Record<string, Car> = {};

  cars.forEach((car) => {
    carMap[car.id] = car;
  });

  const availableCars = cars.filter((car) => car.status === "Available").length;

  const currentlyBooked = bookings.filter(
    (booking) => booking.bookingStatus === "Active"
  ).length;

  const inMaintenance = cars.filter(
    (car) => car.status === "Maintenance" || car.status === "In Service"
  ).length;

  const monthlyIncome = getDashboardMonthlyIncome(bookings);
  const pendingAmount = getDashboardPendingAmount(bookings);

  const returningToday = bookings.filter((booking) => {
    if (booking.bookingStatus !== "Active") {
      return false;
    }

    return isDateToday(
      booking.actualReturnDateTime || booking.expectedReturnDateTime
    );
  });

  const pendingBookings = bookings.filter((booking) => {
    if (
      booking.bookingStatus === "Cancelled" ||
      booking.bookingStatus === "Completed"
    ) {
      return false;
    }

    const finalFare = calculateFinalPayable(booking);
    const rentPaid = getRentPaid(booking);

    return Math.max(0, finalFare - rentPaid) > 0;
  });

  const overdueBookings = bookings.filter((booking) => {
    if (booking.bookingStatus !== "Active") {
      return false;
    }

    const expectedReturn = new Date(booking.expectedReturnDateTime);

    if (Number.isNaN(expectedReturn.getTime())) {
      return false;
    }

    return expectedReturn.getTime() < new Date().getTime();
  });

  const upcomingBookings = bookings.filter(
    (booking) => booking.bookingStatus === "Upcoming"
  );

  const recentBookings = [...bookings]
    .sort((a, b) => {
      const bTime = new Date(b.createdAt || b.updatedAt).getTime();
      const aTime = new Date(a.createdAt || a.updatedAt).getTime();

      return bTime - aTime;
    })
    .slice(0, 5);

  const stats = [
    {
      label: "Available Cars",
      value: availableCars,
      sub: `of ${cars.length} total`,
      icon: <CarIcon className="w-5 h-5" />,
      iconBg: "bg-emerald-100 text-emerald-600",
      accent: "border-l-emerald-400",
    },
    {
      label: "Active Rentals",
      value: currentlyBooked,
      sub:
        returningToday.length > 0
          ? `${returningToday.length} returning today`
          : "no returns today",
      icon: <CalendarCheck className="w-5 h-5" />,
      iconBg: "bg-blue-100 text-blue-600",
      accent: "border-l-blue-400",
    },
    {
      label: "Monthly Income",
      value: <CurrencyDisplay amount={monthlyIncome} />,
      sub: "completed bookings this month",
      icon: <TrendingUp className="w-5 h-5" />,
      iconBg: "bg-violet-100 text-violet-600",
      accent: "border-l-violet-400",
      large: true,
    },
    {
      label: "Pending Amount",
      value: <CurrencyDisplay amount={pendingAmount} />,
      sub: `${pendingBookings.length} booking${
        pendingBookings.length !== 1 ? "s" : ""
      }`,
      icon: <AlertCircle className="w-5 h-5" />,
      iconBg: "bg-amber-100 text-amber-600",
      accent:
        pendingAmount > 0 ? "border-l-amber-400" : "border-l-slate-200",
      large: true,
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <Link href="/bookings/new">
            <button className="hidden sm:flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />
              New Booking
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`bg-card rounded-xl border border-l-4 ${stat.accent} p-4 card-lifted`}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </p>
                <span className={`p-1.5 rounded-lg ${stat.iconBg}`}>
                  {stat.icon}
                </span>
              </div>

              <p
                className={`font-bold text-foreground ${
                  stat.large ? "text-xl" : "text-3xl"
                }`}
              >
                {stat.value}
              </p>

              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>

        {(returningToday.length > 0 ||
          inMaintenance > 0 ||
          pendingBookings.length > 0 ||
          overdueBookings.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {returningToday.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1.5 text-xs font-medium">
                <ArrowDownCircle className="w-3.5 h-3.5" />
                {returningToday.length} car
                {returningToday.length !== 1 ? "s" : ""} returning today
              </div>
            )}

            {overdueBookings.length > 0 && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1.5 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {overdueBookings.length} overdue booking
                {overdueBookings.length !== 1 ? "s" : ""}
              </div>
            )}

            {inMaintenance > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-3 py-1.5 text-xs font-medium">
                <Wrench className="w-3.5 h-3.5" />
                {inMaintenance} car{inMaintenance !== 1 ? "s" : ""} in
                service/maintenance
              </div>
            )}

            {pendingBookings.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1.5 text-xs font-medium">
                <Clock className="w-3.5 h-3.5" />
                {pendingBookings.length} pending payment
                {pendingBookings.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-card rounded-xl border card-lifted">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-base">Recent Bookings</h2>

              <Link href="/bookings">
                <span className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer">
                  View all
                  <ChevronRight className="w-3 h-3" />
                </span>
              </Link>
            </div>

            <div className="divide-y">
              {recentBookings.length === 0 && (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  No bookings yet.
                </div>
              )}

              {recentBookings.map((booking) => {
                const car = carMap[booking.carId];
                const customer = customers[booking.customerId];

                const expectedReturn = new Date(
                  booking.expectedReturnDateTime
                );

                const isOverdue =
                  booking.bookingStatus === "Active" &&
                  !Number.isNaN(expectedReturn.getTime()) &&
                  expectedReturn.getTime() < new Date().getTime();

                return (
                  <Link key={booking.id} href={`/bookings/${booking.id}`}>
                    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-primary font-bold text-xs">
                          {customer?.fullName?.charAt(0) ?? "?"}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">
                            {customer?.fullName ?? "Unknown Customer"}
                          </p>

                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            {sourceIcon[booking.bookingSource] ?? null}
                            {booking.bookingSource}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground truncate">
                          {car?.carName ?? "Unknown Vehicle"} ·{" "}
                          {car?.vehicleNumber ?? "—"}
                        </p>

                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {formatDateTime(booking.startDateTime)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={booking.bookingStatus} />

                        {isOverdue && (
                          <span className="text-[10px] text-destructive font-medium">
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card rounded-xl border card-lifted p-4">
              <h2 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">
                Quick Actions
              </h2>

              <div className="space-y-2">
                <Link href="/bookings/new">
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group">
                    <span className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Plus className="w-3.5 h-3.5 text-primary" />
                    </span>
                    <span className="text-sm font-medium">New Booking</span>
                  </div>
                </Link>

                <Link href="/fleet-board">
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group">
                    <span className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                    </span>
                    <span className="text-sm font-medium">Fleet Board</span>
                  </div>
                </Link>

                <Link href="/challan">
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-amber-50 cursor-pointer transition-colors group border border-transparent hover:border-amber-200">
                    <span className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center">
                      <Search className="w-3.5 h-3.5 text-amber-600" />
                    </span>
                    <span className="text-sm font-medium text-amber-700">
                      Challan Finder
                    </span>
                  </div>
                </Link>

                <Link href="/customers">
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group">
                    <span className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                      <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                    </span>
                    <span className="text-sm font-medium">Add Customer</span>
                  </div>
                </Link>
              </div>
            </div>

            <div className="bg-card rounded-xl border card-lifted p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Fleet Status
                </h2>

                <Link href="/fleet-board">
                  <span className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer">
                    Open board
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>

              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {cars.slice(0, 12).map((car) => (
                  <div
                    key={car.id}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {car.carName}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {car.vehicleNumber}
                      </p>
                    </div>

                    <StatusBadge status={car.status} />
                  </div>
                ))}

                {cars.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No cars added yet.
                  </p>
                )}

                {cars.length > 12 && (
                  <Link href="/fleet-board">
                    <div className="text-xs text-primary font-medium hover:underline cursor-pointer pt-2">
                      View all {cars.length} vehicles
                    </div>
                  </Link>
                )}
              </div>
            </div>

            <div className="bg-card rounded-xl border card-lifted p-4">
              <h2 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">
                Today Summary
              </h2>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Returning</p>
                  <p className="text-xl font-bold">{returningToday.length}</p>
                </div>

                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                  <p className="text-xl font-bold">{upcomingBookings.length}</p>
                </div>

                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="text-xl font-bold">{overdueBookings.length}</p>
                </div>

                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Pending Pay</p>
                  <p className="text-xl font-bold">{pendingBookings.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
