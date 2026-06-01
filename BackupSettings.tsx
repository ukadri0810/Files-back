import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { getSettings, Settings, saveSettings } from "@/services/settingsService";
import { resetDemoData } from "@/services/resetDataService";
import {
  deletePaymentQrAccount,
  getPaymentQrAccounts,
  PaymentQrAccount,
  savePaymentQrAccount,
} from "@/services/paymentQrService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Download,
  Upload,
  AlertTriangle,
  ShieldCheck,
  Trash2,
  QrCode,
  Plus,
  Star,
  Trash,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

export default function BackupSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isResettingDemoData, setIsResettingDemoData] = useState(false);
  const [qrAccounts, setQrAccounts] = useState<PaymentQrAccount[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setSettings(getSettings());
    setQrAccounts(getPaymentQrAccounts());
  }, []);

  const refreshQrAccounts = () => {
    setQrAccounts(getPaymentQrAccounts());
  };

  const handleSaveSettings = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    const updated: Settings = {
      businessName: fd.get("businessName") as string,
      ownerPhone: fd.get("ownerPhone") as string,
      businessAddress: fd.get("businessAddress") as string,
      defaultTermsAndConditions: fd.get(
        "defaultTermsAndConditions"
      ) as string,
      currencySymbol: fd.get("currencySymbol") as string,
      receiptFooterNote: fd.get("receiptFooterNote") as string,

      bookingBillingMode:
        fd.get("bookingBillingMode") === "HOURLY" ? "HOURLY" : "DAILY",
      defaultHourlyRent: Number(fd.get("defaultHourlyRent") || 0),
      minimumRentalHours: Number(fd.get("minimumRentalHours") || 1),
      publicBookingInstructions: fd.get("publicBookingInstructions") as string,

      fixedBookingWindowEnabled:
        fd.get("fixedBookingWindowEnabled") === "true",
      defaultPickupTime: fd.get("defaultPickupTime") as string,
      defaultReturnTime: fd.get("defaultReturnTime") as string,
      minimumRentalDays: Number(fd.get("minimumRentalDays") || 1),
      allowCustomBookingTime: fd.get("allowCustomBookingTime") === "true",

      defaultSecurityDeposit: Number(fd.get("defaultSecurityDeposit") || 0),
      offerSecurityDeposit: Number(fd.get("offerSecurityDeposit") || 0),

      vehicleDocumentReminderDays: Number(
        fd.get("vehicleDocumentReminderDays") || 15
      ),
    };

    saveSettings(updated);
    setSettings(updated);

    toast({
      title: "Settings saved successfully",
      description: "Business profile and booking rules have been updated.",
    });
  };

  const handleAddQrAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    const label = String(fd.get("label") || "").trim();
    const upiId = String(fd.get("upiId") || "").trim();
    const payeeName = String(fd.get("payeeName") || "").trim();
    const notes = String(fd.get("notes") || "").trim();
    const isDefault = fd.get("isDefault") === "on";

    if (!label || !upiId || !payeeName) {
      toast({
        title: "Missing QR account details",
        description: "Label, UPI ID and Payee Name are required.",
        variant: "destructive",
      });
      return;
    }

    const now = new Date().toISOString();

    savePaymentQrAccount({
      id: Math.random().toString(36).substring(2, 11),
      label,
      upiId,
      payeeName,
      notes,
      isDefault,
      createdAt: now,
      updatedAt: now,
    });

    refreshQrAccounts();
    e.currentTarget.reset();

    toast({
      title: "Payment QR account added",
      description: `${label} has been added successfully.`,
    });
  };

  const handleMakeDefaultQr = (account: PaymentQrAccount) => {
    savePaymentQrAccount({
      ...account,
      isDefault: true,
    });

    refreshQrAccounts();

    toast({
      title: "Default QR account updated",
      description: `${account.label} is now the default payment account.`,
    });
  };

  const handleDeleteQrAccount = (account: PaymentQrAccount) => {
    const confirmed = confirm(
      `Delete ${account.label}? This will remove the UPI account from payment selection.`
    );

    if (!confirmed) {
      return;
    }

    deletePaymentQrAccount(account.id);
    refreshQrAccounts();

    toast({
      title: "Payment QR account deleted",
    });
  };

  const handleExport = () => {
    const data = {
      cars: localStorage.getItem("drivelog_cars"),
      customers: localStorage.getItem("drivelog_customers"),
      bookings: localStorage.getItem("drivelog_bookings"),
      service_records: localStorage.getItem("drivelog_service_records"),
      services: localStorage.getItem("drivelog_services"),
      payment_qr_accounts: localStorage.getItem("drivelog_payment_qr_accounts"),
      settings: localStorage.getItem("drivelog_settings"),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `DriveLog_Backup_${
      new Date().toISOString().split("T")[0]
    }.json`;

    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Backup exported successfully",
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);

        if (data.cars) {
          localStorage.setItem("drivelog_cars", data.cars);
        }

        if (data.customers) {
          localStorage.setItem("drivelog_customers", data.customers);
        }

        if (data.bookings) {
          localStorage.setItem("drivelog_bookings", data.bookings);
        }

        if (data.service_records) {
          localStorage.setItem(
            "drivelog_service_records",
            data.service_records
          );
        }

        if (data.services) {
          localStorage.setItem("drivelog_services", data.services);
        }

        if (data.payment_qr_accounts) {
          localStorage.setItem(
            "drivelog_payment_qr_accounts",
            data.payment_qr_accounts
          );
        }

        if (data.settings) {
          localStorage.setItem("drivelog_settings", data.settings);
        }

        toast({
          title: "Backup imported successfully",
          description: "Reloading app...",
        });

        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
      } catch (err) {
        console.error("Invalid backup file", err);

        toast({
          title: "Invalid backup file",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);
  };

  const handleResetDemoData = async () => {
    const confirmed = confirm(
      "Are you sure you want to delete all cars, customers, bookings, and service records? This will reset demo/test data from the cloud database and this browser. Business settings and payment QR accounts will not be deleted."
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsResettingDemoData(true);

      await resetDemoData();

      toast({
        title: "Demo data reset successfully",
        description:
          "Cars, customers, bookings, and service records have been cleared.",
      });

      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (error) {
      console.error("Failed to reset demo data", error);

      toast({
        title: "Failed to reset demo data",
        description: "Please check Firestore rules and try again.",
        variant: "destructive",
      });
    } finally {
      setIsResettingDemoData(false);
    }
  };

  if (!settings) {
    return null;
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Settings & Backup
          </h1>
          <p className="text-muted-foreground">
            Configure your business profile, booking rules, payment QR accounts,
            and app data.
          </p>
        </div>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings">Business</TabsTrigger>
            <TabsTrigger value="payments">Payment QR</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Business Profile</CardTitle>
                <CardDescription>
                  This information appears on generated PDF receipts, app
                  branding, and booking rules.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Business Name
                      </label>
                      <Input
                        name="businessName"
                        defaultValue={settings.businessName}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Owner/Business Phone
                      </label>
                      <Input
                        name="ownerPhone"
                        defaultValue={settings.ownerPhone}
                        required
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">
                        Business Address
                      </label>
                      <Textarea
                        name="businessAddress"
                        defaultValue={settings.businessAddress}
                        required
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">
                        Default Terms & Conditions For Invoices
                      </label>
                      <Textarea
                        name="defaultTermsAndConditions"
                        defaultValue={settings.defaultTermsAndConditions}
                        rows={5}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Currency Symbol
                      </label>
                      <Input
                        name="currencySymbol"
                        defaultValue={settings.currencySymbol}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Receipt Footer Note
                      </label>
                      <Input
                        name="receiptFooterNote"
                        defaultValue={settings.receiptFooterNote}
                        required
                      />
                    </div>

                    <div className="md:col-span-2 border rounded-xl p-4 bg-muted/30 space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Public Booking Page Rules
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          These rules control how customers select date/time on
                          /book-now and what business information they see.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Customer Booking Type
                          </label>
                          <select
                            name="bookingBillingMode"
                            defaultValue={settings.bookingBillingMode}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="DAILY">
                              Per Day / Fixed day booking
                            </option>
                            <option value="HOURLY">
                              Hourly booking
                            </option>
                          </select>
                          <p className="text-xs text-muted-foreground">
                            Daily mode shows pickup date + number of days.
                            Hourly mode shows pickup and return date/time.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Default Hourly Rent (₹)
                          </label>
                          <Input
                            type="number"
                            min="0"
                            name="defaultHourlyRent"
                            defaultValue={settings.defaultHourlyRent}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Used when customer booking type is hourly.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Minimum Rental Hours
                          </label>
                          <Input
                            type="number"
                            min="1"
                            name="minimumRentalHours"
                            defaultValue={settings.minimumRentalHours}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Example: 4 means customer must book at least 4 hours.
                          </p>
                        </div>

                        <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground mb-1">
                            Customer Page
                          </p>
                          <p>
                            Business name, phone, address, terms, booking type,
                            and deposit rules are published safely for customers.
                          </p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">
                            Public Booking Instructions
                          </label>
                          <Textarea
                            name="publicBookingInstructions"
                            defaultValue={settings.publicBookingInstructions}
                            rows={3}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            This appears on the /book-now page near the business
                            information.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 border rounded-xl p-4 bg-muted/30 space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Booking Time Rules
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Use this for businesses that follow a fixed 24-hour
                          rental cycle, for example 12 PM to 12 PM. This helps
                          staff create bookings faster with fewer mistakes.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Fixed Booking Window
                          </label>
                          <select
                            name="fixedBookingWindowEnabled"
                            defaultValue={String(
                              settings.fixedBookingWindowEnabled
                            )}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="false">
                              Off - Custom pickup/return time
                            </option>
                            <option value="true">
                              On - Fixed pickup/return time
                            </option>
                          </select>
                          <p className="text-xs text-muted-foreground">
                            Turn ON for 12-to-12 or similar fixed booking
                            cycles.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Allow Custom Time Override
                          </label>
                          <select
                            name="allowCustomBookingTime"
                            defaultValue={String(
                              settings.allowCustomBookingTime
                            )}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="true">
                              Yes - Staff can change time if needed
                            </option>
                            <option value="false">
                              No - Staff must follow fixed time
                            </option>
                          </select>
                          <p className="text-xs text-muted-foreground">
                            For non-tech staff, keeping this OFF reduces
                            mistakes.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Default Pickup Time
                          </label>
                          <Input
                            type="time"
                            name="defaultPickupTime"
                            defaultValue={settings.defaultPickupTime}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Example: 12:00 for 12 PM pickup.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Default Return Time
                          </label>
                          <Input
                            type="time"
                            name="defaultReturnTime"
                            defaultValue={settings.defaultReturnTime}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Example: 12:00 for 12 PM return.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Minimum Rental Days
                          </label>
                          <Input
                            type="number"
                            min="1"
                            name="minimumRentalDays"
                            defaultValue={settings.minimumRentalDays}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Usually 1 day for self-drive car rental.
                          </p>
                        </div>

                        <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground mb-1">
                            Example
                          </p>
                          <p>
                            If pickup time is 12:00 and return time is 12:00, a
                            3-day booking from 10 May will automatically become:
                          </p>
                          <p className="mt-1 font-medium text-foreground">
                            10 May 12:00 PM → 13 May 12:00 PM
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 border rounded-xl p-4 bg-muted/30 space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Security Deposit Rules
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Set a normal deposit amount and a lower offer deposit
                          amount. Staff can quickly select either while creating
                          a booking.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Default Security Deposit
                          </label>
                          <Input
                            type="number"
                            min="0"
                            name="defaultSecurityDeposit"
                            defaultValue={settings.defaultSecurityDeposit}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Normal deposit amount. Example: ₹3000.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Offer Security Deposit
                          </label>
                          <Input
                            type="number"
                            min="0"
                            name="offerSecurityDeposit"
                            defaultValue={settings.offerSecurityDeposit}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Promotional lower deposit amount. Example: ₹1500.
                          </p>
                        </div>

                        <div className="md:col-span-2 rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground mb-1">
                            Booking Form Buttons
                          </p>
                          <p>
                            Staff will see quick buttons like Default ₹
                            {Number(
                              settings.defaultSecurityDeposit || 0
                            ).toLocaleString("en-IN")}{" "}
                            and Offer ₹
                            {Number(
                              settings.offerSecurityDeposit || 0
                            ).toLocaleString("en-IN")}
                            . They can still type a custom amount when needed.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 border rounded-xl p-4 bg-muted/30 space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Vehicle Document Expiry Reminders
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Set how many days before PUC or insurance expiry the
                          app should show warnings on the Cars page.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Reminder Before Expiry Days
                          </label>
                          <Input
                            type="number"
                            min="1"
                            name="vehicleDocumentReminderDays"
                            defaultValue={settings.vehicleDocumentReminderDays}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Example: 15 means show warning 15 days before PUC or
                            insurance expiry.
                          </p>
                        </div>

                        <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground mb-1">
                            How it works
                          </p>
                          <p>
                            Cars page will show Expired, Expiring Soon, or Valid
                            badges for insurance and PUC dates.
                          </p>
                        </div>
                      </div>

                  </div>

                  <Button type="submit" className="mt-4">
                    Save Settings
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Add Payment QR / UPI Account
                </CardTitle>
                <CardDescription>
                  Add multiple UPI accounts like Owner GPay, Business PhonePe,
                  or Manager UPI. These will appear in booking payment screen.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleAddQrAccount} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Label</label>
                      <Input
                        name="label"
                        placeholder="Owner GPay / Business PhonePe"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">UPI ID</label>
                      <Input
                        name="upiId"
                        placeholder="business@upi"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Payee Name</label>
                      <Input
                        name="payeeName"
                        placeholder="Business or account holder name"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Notes</label>
                      <Input name="notes" placeholder="Optional note" />
                    </div>

                    <div className="md:col-span-2 flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                      <div>
                        <p className="text-sm font-medium">
                          Make this default QR account
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Default account can be selected first for payments.
                        </p>
                      </div>
                      <Switch name="isDefault" />
                    </div>
                  </div>

                  <Button type="submit" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add UPI Account
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Saved Payment QR Accounts</CardTitle>
                <CardDescription>
                  Manage UPI accounts available in the booking payment form.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {qrAccounts.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <QrCode className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">
                      No payment QR accounts added yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add at least one UPI account to use QR selection during
                      booking.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {qrAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="rounded-lg border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{account.label}</p>
                            {account.isDefault && (
                              <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {account.upiId} · {account.payeeName}
                          </p>
                          {account.notes && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {account.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {!account.isDefault && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleMakeDefaultQr(account)}
                              className="gap-1"
                            >
                              <Star className="h-3.5 w-3.5" />
                              Default
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteQrAccount(account)}
                            className="gap-1"
                          >
                            <Trash className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup" className="mt-4 space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-4 flex gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-500 shrink-0" />
              <div>
                <h4 className="font-medium text-emerald-800 dark:text-emerald-400">
                  Cloud Database Enabled
                </h4>
                <p className="text-sm text-emerald-700/80 dark:text-emerald-500/80 mt-1">
                  Cars and customers are synced using Firebase Firestore.
                  Bookings and service records will be moved to Firestore in the
                  next production step.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0" />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-400">
                  Backup Notice
                </h4>
                <p className="text-sm text-amber-700/80 dark:text-amber-500/80 mt-1">
                  Export and import currently work with local cached app data.
                  Cloud backup and full Firestore export can be added in a later
                  upgrade.
                </p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Export Data</CardTitle>
                <CardDescription>
                  Download a JSON copy of locally cached app data.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Button onClick={handleExport} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export JSON Backup
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Import Data</CardTitle>
                <CardDescription>
                  Restore data from a previously exported JSON file. This
                  updates local cached data only.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="max-w-xs"
                  />
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Use this before giving the app to a client for trial. Business
                  settings and payment QR accounts will not be deleted.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <Button
                  variant="destructive"
                  onClick={handleResetDemoData}
                  disabled={isResettingDemoData}
                >
                  {isResettingDemoData
                    ? "Resetting..."
                    : "Reset Demo Data"}
                </Button>

                <p className="text-xs text-muted-foreground">
                  This clears cars, customers, bookings, and service records
                  from Firestore and clears local cached demo data from this
                  browser.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
