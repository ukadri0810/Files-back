import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  getBooking,
  getBookings,
  saveBooking,
  Booking,
  PaymentEntry,
} from "@/services/bookingService";
import {
  getCar,
  updateCarStatus,
  Car,
  saveCar,
} from "@/services/carService";
import { getCustomer, Customer } from "@/services/customerService";
import { getSettings, Settings } from "@/services/settingsService";
import { Button } from "@/components/ui/button";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/utils/dateUtils";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WhatsAppButton } from "@/components/shared/WhatsAppButton";
import { generateWhatsAppLink } from "@/utils/whatsappUtils";
import { generatePDF } from "@/utils/pdfUtils";
import {
  calculateFinalPayable,
  calculateBalance,
  calculateRent,
  calculateTotalPaid,
  calculateDepositAvailableForRefund,
  calculateRefundDue,
  calculateAmountDue,
} from "@/utils/billingUtils";
import {
  createPaymentEntry,
  getCashPaid,
  getPaymentModeFromAmounts,
  getTotalPaidFromLedger,
  getUpiPaid,
} from "@/utils/paymentUtils";
import {
  FileDown,
  Edit,
  ArrowLeft,
  CheckCircle2,
  PlayCircle,
  MoreVertical,
  ShieldCheck,
  Wallet,
  Wand2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ReturnFormState {
  actualReturnDateTime: string;
  returnKm: number;
  returnFuelLevel: string;

  damageCharge: number;
  cleaningCharge: number;
  lateCharge: number;
  otherCharges: number;
  otherChargeReason: string;

  cashCollectedNow: number;
  upiCollectedNow: number;
  upiReferenceNumber: string;

  depositDeducted: number;
  depositRefunded: number;
  depositSettlementNote: string;

  fareRefunded: number;
  fareRefundMode: "Cash" | "UPI" | "Other" | "";
  fareRefundReferenceNumber: string;

  returnNotes: string;
}

export default function BookingDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [car, setCar] = useState<Car | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  const [returnForm, setReturnForm] = useState<ReturnFormState>({
    actualReturnDateTime: new Date().toISOString().substring(0, 16),
    returnKm: 0,
    returnFuelLevel: "Full",

    damageCharge: 0,
    cleaningCharge: 0,
    lateCharge: 0,
    otherCharges: 0,
    otherChargeReason: "",

    cashCollectedNow: 0,
    upiCollectedNow: 0,
    upiReferenceNumber: "",

    depositDeducted: 0,
    depositRefunded: 0,
    depositSettlementNote: "",

    fareRefunded: 0,
    fareRefundMode: "",
    fareRefundReferenceNumber: "",

    returnNotes: "",
  });

  useEffect(() => {
    if (!id) return;

    const currentBooking = getBooking(id);

    if (!currentBooking) {
      toast({ title: "Booking not found", variant: "destructive" });
      setLocation("/bookings");
      return;
    }

    setBooking(currentBooking);

    const currentCar = getCar(currentBooking.carId);
    if (currentCar) setCar(currentCar);

    const currentCustomer = getCustomer(currentBooking.customerId);
    if (currentCustomer) setCustomer(currentCustomer);

    setSettings(getSettings());
  }, [id, setLocation, toast]);

  useEffect(() => {
    if (car && booking) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

      setReturnForm((prev) => ({
        ...prev,
        actualReturnDateTime:
          booking.actualReturnDateTime?.substring(0, 16) ||
          now.toISOString().substring(0, 16),
        returnKm: booking.returnKm ?? car.currentKm,
        returnFuelLevel: booking.returnFuelLevel || booking.pickupFuelLevel,

        damageCharge: booking.damageCharge ?? 0,
        cleaningCharge: booking.cleaningCharge ?? 0,
        lateCharge: booking.lateCharge ?? 0,
        otherCharges: booking.otherCharges ?? 0,
        otherChargeReason: booking.otherChargeReason ?? "",

        depositDeducted: booking.depositDeducted ?? 0,
        depositRefunded:
          booking.depositRefunded ??
          Math.max(
            0,
            (booking.securityDeposit ?? 0) - (booking.depositDeducted ?? 0)
          ),
        depositSettlementNote: booking.depositSettlementNote ?? "",

        fareRefunded: booking.fareRefunded ?? 0,
        fareRefundMode: booking.fareRefundMode ?? "",
        fareRefundReferenceNumber: booking.fareRefundReferenceNumber ?? "",

        returnNotes: booking.returnNotes ?? "",
      }));
    }
  }, [car, booking]);

  if (!booking || !car || !customer || !settings) {
    return (
      <Layout>
        <div className="p-8">Loading...</div>
      </Layout>
    );
  }

  const rentAmount = calculateRent(booking);
  const finalPayable = calculateFinalPayable(booking);
  const rawBalance = calculateBalance(booking);
  const amountDue = calculateAmountDue(booking);
  const refundDue = calculateRefundDue(booking);
  const totalPaidOrSettled = calculateTotalPaid(booking);
  const cashPaid = getCashPaid(booking);
  const upiPaid = getUpiPaid(booking);
  const depositAvailableForRefund = calculateDepositAvailableForRefund(booking);
  const businessName = settings.businessName || "DriveLog";

  const isOverdue =
    booking.bookingStatus === "Active" &&
    new Date() > new Date(booking.expectedReturnDateTime);

  const returnPreviewBooking: Partial<Booking> = {
    ...booking,
    actualReturnDateTime: returnForm.actualReturnDateTime
      ? new Date(returnForm.actualReturnDateTime).toISOString()
      : booking.actualReturnDateTime,
    returnKm: returnForm.returnKm,
    returnFuelLevel: returnForm.returnFuelLevel,
    damageCharge: returnForm.damageCharge,
    cleaningCharge: returnForm.cleaningCharge,
    lateCharge: returnForm.lateCharge,
    otherCharges: returnForm.otherCharges,
    otherChargeReason: returnForm.otherChargeReason,
    depositDeducted: returnForm.depositDeducted,
    depositRefunded: returnForm.depositRefunded,
    fareRefunded: returnForm.fareRefunded,
    fareRefundMode: returnForm.fareRefundMode,
    fareRefundReferenceNumber: returnForm.fareRefundReferenceNumber,
  };

  const liveRent = calculateRent(returnPreviewBooking);

  const liveExtras =
    Number(returnForm.damageCharge || 0) +
    Number(returnForm.cleaningCharge || 0) +
    Number(returnForm.lateCharge || 0) +
    Number(returnForm.otherCharges || 0);

  const liveDiscount = booking.discountAdjustmentAmount ?? 0;

  const livePayable =
    booking.ownerFinalAmount ??
    Math.max(0, liveRent + liveExtras - liveDiscount);

  const alreadyPaidBeforeReturn = getTotalPaidFromLedger(booking);

  const liveCashUpiNow =
    Number(returnForm.cashCollectedNow || 0) +
    Number(returnForm.upiCollectedNow || 0);

  const liveBalanceBeforeDeposit = livePayable - alreadyPaidBeforeReturn;

  const liveBalanceAfterSettlement =
    livePayable -
    alreadyPaidBeforeReturn -
    Number(returnForm.depositDeducted || 0) -
    liveCashUpiNow +
    Number(returnForm.fareRefunded || 0);

  const liveAmountDue =
    liveBalanceAfterSettlement > 0 ? liveBalanceAfterSettlement : 0;

  const liveRefundDue =
    liveBalanceAfterSettlement < 0 ? Math.abs(liveBalanceAfterSettlement) : 0;

  const suggestedDepositDeduction = Math.min(
    Number(booking.securityDeposit || 0),
    liveExtras
  );

  const suggestedDepositRefund = Math.max(
    0,
    Number(booking.securityDeposit || 0) -
      Number(returnForm.depositDeducted || 0)
  );

  const totalKm = returnForm.returnKm - booking.pickupKm;

  const setField = (key: keyof ReturnFormState, value: string | number) => {
    setReturnForm((prev) => {
      const updated = { ...prev, [key]: value };

      if (key === "depositDeducted") {
        const deducted = Math.max(0, Number(value || 0));
        updated.depositDeducted = deducted;
        updated.depositRefunded = Math.max(
          0,
          Number(booking.securityDeposit || 0) - deducted
        );
      }

      return updated;
    });
  };

  const applyDeductChargesFromDeposit = () => {
    const deduction = Math.min(Number(booking.securityDeposit || 0), liveExtras);

    setReturnForm((prev) => ({
      ...prev,
      depositDeducted: deduction,
      depositRefunded: Math.max(
        0,
        Number(booking.securityDeposit || 0) - deduction
      ),
      depositSettlementNote:
        deduction > 0
          ? `₹${deduction.toLocaleString(
              "en-IN"
            )} deducted from deposit for extra charges.`
          : prev.depositSettlementNote,
    }));
  };

  const applyRefundFullDeposit = () => {
    setReturnForm((prev) => ({
      ...prev,
      depositDeducted: 0,
      depositRefunded: Number(booking.securityDeposit || 0),
      depositSettlementNote: "Full security deposit refunded.",
    }));
  };

  const applyRefundOverpaidFare = () => {
    const refundAmount = Math.max(
      0,
      alreadyPaidBeforeReturn +
        Number(returnForm.depositDeducted || 0) +
        liveCashUpiNow -
        livePayable
    );

    setReturnForm((prev) => ({
      ...prev,
      fareRefunded: refundAmount,
      fareRefundMode: refundAmount > 0 ? "Cash" : "",
    }));
  };

  const applyCollectBalanceAsCash = () => {
    setReturnForm((prev) => ({
      ...prev,
      cashCollectedNow: Math.max(0, liveAmountDue),
      upiCollectedNow: 0,
    }));
  };

  const applyCollectBalanceAsUpi = () => {
    setReturnForm((prev) => ({
      ...prev,
      cashCollectedNow: 0,
      upiCollectedNow: Math.max(0, liveAmountDue),
    }));
  };


  const returnCollectionMode =
    Number(returnForm.upiCollectedNow || 0) > 0 ? "UPI" : "Cash";

  const returnCollectionAmount =
    Number(returnForm.cashCollectedNow || 0) +
    Number(returnForm.upiCollectedNow || 0);

  const setReturnCollection = (amount: number, mode = returnCollectionMode) => {
    const safeAmount = Math.max(0, Number(amount || 0));

    setReturnForm((prev) => ({
      ...prev,
      cashCollectedNow: mode === "Cash" ? safeAmount : 0,
      upiCollectedNow: mode === "UPI" ? safeAmount : 0,
    }));
  };

  const setReturnCollectionMode = (mode: "Cash" | "UPI") => {
    setReturnCollection(returnCollectionAmount, mode);
  };

  const collectFullPendingRent = () => {
    setReturnCollection(Math.max(0, liveAmountDue));
  };

  const collectNoPendingRentNow = () => {
    setReturnCollection(0);
  };

  const handleStartBooking = () => {
    if (booking.bookingStatus !== "Upcoming") {
      toast({
        title: "Booking already started",
        description: "Only upcoming bookings can be started.",
        variant: "destructive",
      });
      return;
    }

    const now = new Date().toISOString();

    const updatedBooking: Booking = {
      ...booking,
      bookingStatus: "Active",
      actualPickupDateTime: now,
      handoverNotes: booking.handoverNotes || "Vehicle handed over to customer.",
      updatedAt: now,
    };

    const updatedCar: Car = {
      ...car,
      status: "Booked",
      updatedAt: now,
    };

    saveBooking(updatedBooking);
    saveCar(updatedCar);
    updateCarStatus(car.id, "Booked");

    setBooking(updatedBooking);
    setCar(updatedCar);

    toast({
      title: "Booking started",
      description: "Vehicle handover marked. This rental is now active.",
    });
  };

  const handleCompleteReturn = () => {
    if (returnForm.returnKm < booking.pickupKm) {
      toast({
        title: "Invalid return KM",
        description: "Return KM cannot be less than pickup KM.",
        variant: "destructive",
      });
      return;
    }

    if (returnForm.depositDeducted > booking.securityDeposit) {
      toast({
        title: "Invalid deposit deduction",
        description: "Deposit deducted cannot be more than security deposit.",
        variant: "destructive",
      });
      return;
    }

    if (
      returnForm.depositRefunded + returnForm.depositDeducted >
      booking.securityDeposit
    ) {
      toast({
        title: "Invalid deposit settlement",
        description:
          "Deposit refunded plus deposit deducted cannot exceed security deposit.",
        variant: "destructive",
      });
      return;
    }

    if (returnForm.fareRefunded < 0) {
      toast({
        title: "Invalid fare refund",
        description: "Fare refund cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    if (returnForm.fareRefunded > 0 && !returnForm.fareRefundMode) {
      toast({
        title: "Select refund mode",
        description: "Please select Cash, UPI, or Other for fare refund.",
        variant: "destructive",
      });
      return;
    }

    const existingNonReturnPayments: PaymentEntry[] =
      booking.payments?.filter((payment) => payment.stage !== "Return") ?? [];

    const returnPayments: PaymentEntry[] = [];

    if (Number(returnForm.cashCollectedNow || 0) > 0) {
      returnPayments.push(
        createPaymentEntry(
          "Return",
          "Cash",
          Number(returnForm.cashCollectedNow || 0),
          "",
          "",
          "Cash collected during return settlement"
        )
      );
    }

    if (Number(returnForm.upiCollectedNow || 0) > 0) {
      returnPayments.push(
        createPaymentEntry(
          "Return",
          "UPI",
          Number(returnForm.upiCollectedNow || 0),
          returnForm.upiReferenceNumber || "",
          "",
          "UPI collected during return settlement"
        )
      );
    }

    const updatedPayments = [...existingNonReturnPayments, ...returnPayments];

    const cashTotal = getCashPaid({ payments: updatedPayments });
    const upiTotal = getUpiPaid({ payments: updatedPayments });

    const updatedBooking: Booking = {
      ...booking,
      bookingStatus: "Completed",
      actualReturnDateTime: new Date(
        returnForm.actualReturnDateTime
      ).toISOString(),
      returnKm: returnForm.returnKm,
      returnFuelLevel: returnForm.returnFuelLevel,

      damageCharge: Number(returnForm.damageCharge || 0),
      cleaningCharge: Number(returnForm.cleaningCharge || 0),
      lateCharge: Number(returnForm.lateCharge || 0),
      otherCharges: Number(returnForm.otherCharges || 0),
      otherChargeReason: returnForm.otherChargeReason,

      depositDeducted: Number(returnForm.depositDeducted || 0),
      depositRefunded: Number(returnForm.depositRefunded || 0),
      depositSettlementNote: returnForm.depositSettlementNote,

      fareRefunded: Number(returnForm.fareRefunded || 0),
      fareRefundMode: returnForm.fareRefundMode,
      fareRefundReferenceNumber: returnForm.fareRefundReferenceNumber,

      amountPaidNow:
        Number(returnForm.cashCollectedNow || 0) +
        Number(returnForm.upiCollectedNow || 0),
      paymentMode: getPaymentModeFromAmounts(
        cashTotal,
        upiTotal
      ) as Booking["paymentMode"],
      payments: updatedPayments,

      returnNotes: returnForm.returnNotes,
      updatedAt: new Date().toISOString(),
    };

    saveBooking(updatedBooking);

    const hasAnotherActiveBookingForCar = getBookings().some(
      (item) =>
        item.id !== booking.id &&
        item.carId === car.id &&
        item.bookingStatus === "Active"
    );

    const updatedCar: Car = {
      ...car,
      status: hasAnotherActiveBookingForCar ? "Booked" : "Available",
      currentKm: returnForm.returnKm,
      updatedAt: new Date().toISOString(),
    };

    saveCar(updatedCar);
    updateCarStatus(car.id, updatedCar.status);

    setBooking(updatedBooking);
    setCar(updatedCar);
    setIsReturnModalOpen(false);

    toast({
      title: "Return completed",
      description: "Smart settlement, refund, and deposit details saved.",
    });
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0"
            onClick={() => setLocation("/bookings")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight flex flex-wrap items-center gap-2">
              <span className="truncate">
                Booking #{booking.id.substring(0, 8).toUpperCase()}
              </span>
              <StatusBadge status={booking.bookingStatus} />
            </h1>
            <p className="text-sm text-muted-foreground">
              {customer.fullName} · {car.carName}
            </p>
          </div>

          <div className="hidden sm:flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => generatePDF(booking, customer, car, settings)}
            >
              <FileDown className="w-4 h-4" /> PDF
            </Button>

            {booking.bookingStatus !== "Completed" &&
              booking.bookingStatus !== "Cancelled" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setLocation(`/bookings/${booking.id}/edit`)}
                >
                  <Edit className="w-4 h-4" /> Edit
                </Button>
              )}

            {booking.bookingStatus === "Upcoming" && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleStartBooking}
              >
                <PlayCircle className="w-4 h-4" /> Start Booking
              </Button>
            )}

            {booking.bookingStatus === "Active" && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setIsReturnModalOpen(true)}
              >
                <CheckCircle2 className="w-4 h-4" /> Complete Return
              </Button>
            )}
          </div>

          <div className="sm:hidden shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => generatePDF(booking, customer, car, settings)}
                >
                  <FileDown className="w-4 h-4 mr-2" /> Download PDF
                </DropdownMenuItem>

                {booking.bookingStatus !== "Completed" &&
                  booking.bookingStatus !== "Cancelled" && (
                    <DropdownMenuItem
                      onClick={() =>
                        setLocation(`/bookings/${booking.id}/edit`)
                      }
                    >
                      <Edit className="w-4 h-4 mr-2" /> Edit Booking
                    </DropdownMenuItem>
                  )}

                {booking.bookingStatus === "Upcoming" && (
                  <DropdownMenuItem onClick={handleStartBooking}>
                    <PlayCircle className="w-4 h-4 mr-2" /> Start Booking
                  </DropdownMenuItem>
                )}

                {booking.bookingStatus === "Active" && (
                  <DropdownMenuItem onClick={() => setIsReturnModalOpen(true)}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Complete Return
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {booking.bookingStatus === "Upcoming" && (
          <Button
            className="sm:hidden w-full gap-2"
            onClick={handleStartBooking}
          >
            <PlayCircle className="w-4 h-4" /> Start Booking
          </Button>
        )}

        {booking.bookingStatus === "Active" && (
          <Button
            className="sm:hidden w-full gap-2"
            onClick={() => setIsReturnModalOpen(true)}
          >
            <CheckCircle2 className="w-4 h-4" /> Complete Return
          </Button>
        )}

        {booking.bookingStatus === "Upcoming" && (
          <Card className="border-blue-200 bg-blue-50/70 dark:bg-blue-950/20">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-300">
                  Vehicle not handed over yet
                </p>
                <p className="text-sm text-blue-800/80 dark:text-blue-400/80">
                  Verify customer, payment, and documents. Then click Start
                  Booking when the vehicle is actually handed over.
                </p>
              </div>
              <Button type="button" className="gap-2" onClick={handleStartBooking}>
                <PlayCircle className="w-4 h-4" />
                Start Booking
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rental Period</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Pickup
                    </p>
                    <p className="font-semibold text-sm">
                      {formatDateTime(booking.startDateTime)}
                    </p>
                    {booking.actualPickupDateTime && (
                      <p className="text-xs text-emerald-700 mt-1">
                        Started: {formatDateTime(booking.actualPickupDateTime)}
                      </p>
                    )}
                    <p className="text-sm mt-1">
                      KM: {booking.pickupKm.toLocaleString("en-IN")}
                    </p>
                    <p className="text-sm">Fuel: {booking.pickupFuelLevel}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Return
                    </p>
                    <p
                      className={`font-semibold text-sm ${
                        isOverdue ? "text-destructive" : ""
                      }`}
                    >
                      {formatDateTime(
                        booking.actualReturnDateTime ||
                          booking.expectedReturnDateTime
                      )}
                      {isOverdue && (
                        <span className="text-xs ml-1">(Overdue)</span>
                      )}
                    </p>
                    <p className="text-sm mt-1">
                      KM: {booking.returnKm?.toLocaleString("en-IN") || "—"}
                    </p>
                    <p className="text-sm">
                      Fuel: {booking.returnFuelLevel || "—"}
                    </p>
                  </div>
                </div>

                {booking.returnKm && (
                  <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                    Total KM used:{" "}
                    <span className="font-medium text-foreground">
                      {(booking.returnKm - booking.pickupKm).toLocaleString(
                        "en-IN"
                      )}{" "}
                      km
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Billing — {booking.pricingMode.replace(/_/g, " ")}
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Base Rent</span>
                    <span className="font-medium">
                      <CurrencyDisplay amount={rentAmount} />
                    </span>
                  </div>

                  {booking.damageCharge > 0 && (
                    <div className="flex justify-between py-1 border-b text-destructive">
                      <span>Damage Charge</span>
                      <span>
                        +<CurrencyDisplay amount={booking.damageCharge} />
                      </span>
                    </div>
                  )}

                  {booking.cleaningCharge > 0 && (
                    <div className="flex justify-between py-1 border-b text-amber-600">
                      <span>Cleaning Charge</span>
                      <span>
                        +<CurrencyDisplay amount={booking.cleaningCharge} />
                      </span>
                    </div>
                  )}

                  {booking.lateCharge > 0 && (
                    <div className="flex justify-between py-1 border-b text-amber-600">
                      <span>Late Charge</span>
                      <span>
                        +<CurrencyDisplay amount={booking.lateCharge} />
                      </span>
                    </div>
                  )}

                  {booking.otherCharges > 0 && (
                    <div className="flex justify-between py-1 border-b">
                      <span>
                        Other{" "}
                        {booking.otherChargeReason
                          ? `(${booking.otherChargeReason})`
                          : ""}
                      </span>
                      <span>
                        +<CurrencyDisplay amount={booking.otherCharges} />
                      </span>
                    </div>
                  )}

                  {booking.discountAdjustmentAmount > 0 && (
                    <div className="flex justify-between py-1 border-b text-green-600">
                      <span>Discount</span>
                      <span>
                        -
                        <CurrencyDisplay
                          amount={booking.discountAdjustmentAmount}
                        />
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 text-base font-bold">
                    <span>Total Payable</span>
                    <span>
                      <CurrencyDisplay amount={finalPayable} />
                    </span>
                  </div>

                  <div className="flex justify-between py-1 text-muted-foreground text-xs">
                    <span>Cash Paid</span>
                    <span>
                      <CurrencyDisplay amount={cashPaid} />
                    </span>
                  </div>

                  <div className="flex justify-between py-1 text-muted-foreground text-xs">
                    <span>UPI Paid</span>
                    <span>
                      <CurrencyDisplay amount={upiPaid} />
                    </span>
                  </div>

                  {booking.depositDeducted > 0 && (
                    <div className="flex justify-between py-1 text-muted-foreground text-xs">
                      <span>Deposit Deducted</span>
                      <span>
                        <CurrencyDisplay amount={booking.depositDeducted} />
                      </span>
                    </div>
                  )}

                  {booking.fareRefunded > 0 && (
                    <div className="flex justify-between py-1 text-muted-foreground text-xs">
                      <span>
                        Fare Refund Given
                        {booking.fareRefundMode
                          ? ` (${booking.fareRefundMode})`
                          : ""}
                      </span>
                      <span>
                        -<CurrencyDisplay amount={booking.fareRefunded} />
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 text-muted-foreground text-xs">
                    <span>Total Paid/Settled</span>
                    <span>
                      <CurrencyDisplay amount={totalPaidOrSettled} />
                    </span>
                  </div>

                  {amountDue > 0 ? (
                    <div className="flex justify-between py-2 text-lg font-bold pt-2 border-t text-destructive">
                      <span>Balance Due</span>
                      <span>
                        <CurrencyDisplay amount={amountDue} />
                      </span>
                    </div>
                  ) : refundDue > 0 ? (
                    <div className="flex justify-between py-2 text-lg font-bold pt-2 border-t text-green-600">
                      <span>Refund Due</span>
                      <span>
                        <CurrencyDisplay amount={refundDue} />
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between py-2 text-lg font-bold pt-2 border-t text-green-600">
                      <span>Balance Settled</span>
                      <span>
                        <CurrencyDisplay amount={0} />
                      </span>
                    </div>
                  )}

                  {rawBalance !== 0 && (
                    <p className="text-xs text-muted-foreground">
                      Internal balance value: ₹
                      {rawBalance.toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Security Deposit Settlement
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Deposit Collected
                  </span>
                  <span>
                    <CurrencyDisplay amount={booking.securityDeposit} />
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Deposit Deducted
                  </span>
                  <span>
                    <CurrencyDisplay amount={booking.depositDeducted} />
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Deposit Refunded
                  </span>
                  <span>
                    <CurrencyDisplay amount={booking.depositRefunded} />
                  </span>
                </div>

                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Available For Refund</span>
                  <span>
                    <CurrencyDisplay amount={depositAvailableForRefund} />
                  </span>
                </div>

                {booking.depositSettlementNote && (
                  <p className="text-xs text-muted-foreground border-t pt-2">
                    Note: {booking.depositSettlementNote}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Customer</CardTitle>
              </CardHeader>

              <CardContent className="space-y-1 text-sm">
                <p className="font-bold">{customer.fullName}</p>
                <p>{customer.phone}</p>
                <p className="text-muted-foreground text-xs">
                  {customer.address}
                </p>
                <div className="pt-2 mt-2 border-t text-xs text-muted-foreground">
                  <p>Aadhaar: *{customer.aadhaarNumberOrLast4}</p>
                  <p>DL: {customer.drivingLicenseNumber}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Car</CardTitle>
              </CardHeader>

              <CardContent className="space-y-1 text-sm">
                <p className="font-bold">{car.carName}</p>
                <p className="uppercase font-mono bg-muted inline-block px-2 py-0.5 rounded text-xs">
                  {car.vehicleNumber}
                </p>
                <p className="text-muted-foreground">
                  {car.fuelType} · {car.transmissionType}
                </p>
                <p className="text-muted-foreground text-xs">
                  Source: {booking.bookingSource}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-800 dark:text-green-500">
                  WhatsApp Messages
                </CardTitle>
              </CardHeader>

              <CardContent className="flex flex-col gap-2">
                <WhatsAppButton
                  link={generateWhatsAppLink(
                    customer.phone,
                    `Thank you for choosing ${businessName}!

Hi ${customer.fullName}, your booking is confirmed.

Vehicle: ${car.carName}
Pickup: ${formatDateTime(booking.startDateTime)}
Return: ${formatDateTime(booking.expectedReturnDateTime)}
Total payable: ₹${finalPayable.toLocaleString("en-IN")}

Please carry your original driving license and Aadhaar for verification.`
                  )}
                  label="Booking Confirmation"
                  className="w-full justify-start text-xs"
                />

                <WhatsAppButton
                  link={generateWhatsAppLink(
                    customer.phone,
                    `Hi ${customer.fullName}, this is a pickup reminder from ${businessName}.

Vehicle: ${car.carName}
Pickup time: ${formatDateTime(booking.startDateTime)}

Please arrive on time and carry your original driving license and Aadhaar.`
                  )}
                  label="Pickup Reminder"
                  className="w-full justify-start text-xs"
                />

                <WhatsAppButton
                  link={generateWhatsAppLink(
                    customer.phone,
                    `Hi ${customer.fullName}, this is a return reminder from ${businessName}.

Vehicle: ${car.carName}
Return time: ${formatDateTime(booking.expectedReturnDateTime)}

Please return the vehicle on time to avoid late charges.`
                  )}
                  label="Return Reminder"
                  className="w-full justify-start text-xs"
                />

                {amountDue > 0 && (
                  <WhatsAppButton
                    link={generateWhatsAppLink(
                      customer.phone,
                      `Hi ${customer.fullName}, this is a payment reminder from ${businessName}.

Pending amount: ₹${amountDue.toLocaleString("en-IN")}

Please clear the pending amount at the earliest.`
                    )}
                    label="Payment Reminder"
                    className="w-full justify-start text-xs"
                  />
                )}

                {booking.bookingStatus === "Completed" && (
                  <WhatsAppButton
                    link={generateWhatsAppLink(
                      customer.phone,
                      `Thank you for choosing ${businessName}!

Hi ${customer.fullName}, your final bill is ready.

Vehicle: ${car.carName}
Total payable: ₹${finalPayable.toLocaleString("en-IN")}
Paid/settled: ₹${totalPaidOrSettled.toLocaleString("en-IN")}
Balance: ₹${calculateBalance(booking).toLocaleString("en-IN")}

Safe travels!`
                    )}
                    label="Final Bill"
                    className="w-full justify-start text-xs"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
          <DialogContent className="w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Complete Return & Final Settlement</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <p className="font-semibold">Simple return flow</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter return details, add extra charges, collect pending rent
                  if needed, then settle/refund the security deposit.
                </p>
              </div>

              <div className="rounded-2xl border p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold">1. Return Details</p>
                  <p className="text-xs text-muted-foreground">
                    These details update the vehicle and final bill.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Actual Return Date & Time</Label>
                    <Input
                      type="datetime-local"
                      value={returnForm.actualReturnDateTime}
                      onChange={(event) =>
                        setField("actualReturnDateTime", event.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Return KM Reading</Label>
                    <Input
                      type="number"
                      value={returnForm.returnKm}
                      onChange={(event) =>
                        setField("returnKm", Number(event.target.value))
                      }
                    />
                    {returnForm.returnKm > booking.pickupKm && (
                      <p className="text-xs text-muted-foreground">
                        Total used: {totalKm.toLocaleString("en-IN")} km
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Return Fuel Level</Label>
                    <Select
                      value={returnForm.returnFuelLevel}
                      onValueChange={(value) =>
                        setField("returnFuelLevel", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Full">Full</SelectItem>
                        <SelectItem value="3/4">3/4</SelectItem>
                        <SelectItem value="Half">Half</SelectItem>
                        <SelectItem value="1/4">1/4</SelectItem>
                        <SelectItem value="Empty">Empty</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold">2. Extra Charges</p>
                  <p className="text-xs text-muted-foreground">
                    Add only real charges found during return.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Damage (₹)</Label>
                    <Input
                      type="number"
                      value={returnForm.damageCharge}
                      onChange={(event) =>
                        setField("damageCharge", Number(event.target.value))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Cleaning (₹)</Label>
                    <Input
                      type="number"
                      value={returnForm.cleaningCharge}
                      onChange={(event) =>
                        setField("cleaningCharge", Number(event.target.value))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Late Charge (₹)</Label>
                    <Input
                      type="number"
                      value={returnForm.lateCharge}
                      onChange={(event) =>
                        setField("lateCharge", Number(event.target.value))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Other (₹)</Label>
                    <Input
                      type="number"
                      value={returnForm.otherCharges}
                      onChange={(event) =>
                        setField("otherCharges", Number(event.target.value))
                      }
                    />
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <Label>Other Charges Reason</Label>
                    <Input
                      placeholder="e.g. Fastag, toll, missing accessory"
                      value={returnForm.otherChargeReason}
                      onChange={(event) =>
                        setField("otherChargeReason", event.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/30 p-4 space-y-2 text-sm">
                <p className="font-semibold">Live Final Bill</p>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Rent ({booking.pricingMode.replace(/_/g, " ")})
                  </span>
                  <span>
                    <CurrencyDisplay amount={liveRent} />
                  </span>
                </div>

                {liveExtras > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Extra Charges</span>
                    <span>
                      +<CurrencyDisplay amount={liveExtras} />
                    </span>
                  </div>
                )}

                {liveDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>
                      -<CurrencyDisplay amount={liveDiscount} />
                    </span>
                  </div>
                )}

                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total Payable</span>
                  <span>
                    <CurrencyDisplay amount={livePayable} />
                  </span>
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Rent already paid</span>
                  <span>
                    <CurrencyDisplay amount={alreadyPaidBeforeReturn} />
                  </span>
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Balance before deposit settlement</span>
                  <span>
                    <CurrencyDisplay amount={liveBalanceBeforeDeposit} />
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold">3. Pending Rent Collection</p>
                  <p className="text-xs text-muted-foreground">
                    Collect pending rent here only if customer is paying during
                    return.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={returnCollectionAmount === liveAmountDue && liveAmountDue > 0 ? "default" : "outline"}
                    onClick={collectFullPendingRent}
                    disabled={liveAmountDue <= 0}
                  >
                    Collect Full Pending
                  </Button>

                  <Button
                    type="button"
                    variant={returnCollectionAmount > 0 && returnCollectionAmount !== liveAmountDue ? "default" : "outline"}
                    onClick={() =>
                      setReturnCollection(returnCollectionAmount || liveAmountDue)
                    }
                    disabled={liveAmountDue <= 0}
                  >
                    Custom Amount
                  </Button>

                  <Button
                    type="button"
                    variant={returnCollectionAmount === 0 ? "default" : "outline"}
                    onClick={collectNoPendingRentNow}
                  >
                    Not Collected Now
                  </Button>
                </div>

                {liveAmountDue > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Amount Collected Now (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={returnCollectionAmount}
                        onChange={(event) =>
                          setReturnCollection(Number(event.target.value))
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Payment Mode</Label>
                      <Select
                        value={returnCollectionMode}
                        onValueChange={(value) =>
                          setReturnCollectionMode(value as "Cash" | "UPI")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {returnCollectionMode === "UPI" && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>UPI Reference / UTR</Label>
                        <Input
                          placeholder="Transaction ID / UTR"
                          value={returnForm.upiReferenceNumber}
                          className="uppercase"
                          onChange={(event) =>
                            setField(
                              "upiReferenceNumber",
                              event.target.value.toUpperCase()
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border p-4 space-y-4">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 mt-0.5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">
                      4. Security Deposit Settlement
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Deposit is refundable. Enter deduction only if there are
                      valid charges.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border bg-blue-50 border-blue-200 p-3">
                    <p className="text-xs text-muted-foreground">
                      Deposit Held
                    </p>
                    <p className="text-xl font-bold text-blue-700">
                      <CurrencyDisplay amount={booking.securityDeposit} />
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Deduct From Deposit (₹)</Label>
                    <Input
                      type="number"
                      value={returnForm.depositDeducted}
                      onChange={(event) =>
                        setField("depositDeducted", Number(event.target.value))
                      }
                    />
                  </div>

                  <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-3">
                    <p className="text-xs text-muted-foreground">
                      Refund to Customer
                    </p>
                    <p className="text-xl font-bold text-emerald-700">
                      <CurrencyDisplay amount={returnForm.depositRefunded} />
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyDeductChargesFromDeposit}
                  >
                    Deduct Extras
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyRefundFullDeposit}
                  >
                    Refund Full Deposit
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setField(
                        "depositDeducted",
                        Number(booking.securityDeposit || 0)
                      );
                      setField(
                        "depositSettlementNote",
                        "Full deposit deducted by owner decision."
                      );
                    }}
                    disabled={Number(booking.securityDeposit || 0) <= 0}
                  >
                    Deduct Full Deposit
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label>Deposit Settlement Note</Label>
                  <Input
                    placeholder="e.g. ₹700 deducted for scratch repair"
                    value={returnForm.depositSettlementNote}
                    onChange={(event) =>
                      setField("depositSettlementNote", event.target.value)
                    }
                  />
                </div>
              </div>

              {liveRefundDue > 0 && (
                <div className="rounded-2xl border p-4 space-y-4">
                  <div className="flex items-start gap-2">
                    <Wallet className="h-4 w-4 mt-0.5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">Fare Refund</p>
                      <p className="text-xs text-muted-foreground">
                        Use only when customer paid more rent than final fare.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Fare Refund Given (₹)</Label>
                      <Input
                        type="number"
                        value={returnForm.fareRefunded}
                        onChange={(event) =>
                          setField("fareRefunded", Number(event.target.value))
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Refund Mode</Label>
                      <Select
                        value={returnForm.fareRefundMode || "none"}
                        onValueChange={(value) =>
                          setField(
                            "fareRefundMode",
                            value === "none" ? "" : value
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not refunded</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Refund Reference / Note</Label>
                      <Input
                        placeholder="UPI transaction ID / note"
                        value={returnForm.fareRefundReferenceNumber}
                        onChange={(event) =>
                          setField(
                            "fareRefundReferenceNumber",
                            event.target.value
                          )
                        }
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyRefundOverpaidFare}
                  >
                    Auto-fill Refund Due
                  </Button>
                </div>
              )}

              <div className="rounded-xl border bg-background p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Final amount due</span>
                  <span className="font-semibold text-destructive">
                    <CurrencyDisplay amount={liveAmountDue} />
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Deposit refund to customer
                  </span>
                  <span className="font-semibold text-emerald-700">
                    <CurrencyDisplay amount={returnForm.depositRefunded} />
                  </span>
                </div>

                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>
                    {liveAmountDue > 0
                      ? "Still Pending After This"
                      : liveRefundDue > 0
                      ? "Extra Fare Refund Due"
                      : "Final Settlement"}
                  </span>
                  <span>
                    <CurrencyDisplay
                      amount={
                        liveAmountDue > 0
                          ? liveAmountDue
                          : liveRefundDue > 0
                          ? liveRefundDue
                          : 0
                      }
                    />
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Return Notes</Label>
                <Textarea
                  placeholder="Any issues, feedback, or settlement note..."
                  value={returnForm.returnNotes}
                  onChange={(event) =>
                    setField("returnNotes", event.target.value)
                  }
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsReturnModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-2"
                  onClick={handleCompleteReturn}
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirm Return
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
