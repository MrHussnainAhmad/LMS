"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/lib/api-client";
import { prepareContentUpload } from "@/lib/client-upload-file";
import { formatClassSection } from "@/lib/class-section-label";
import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";

type FeeHead = {
  id: number;
  name: string;
  kind: "RECURRING" | "ONE_TIME";
  isActive: boolean;
};
type SchoolClass = { id: number; name: string };
type ClassItem = {
  id: number;
  classId: number;
  feeHeadId: number;
  amount: number;
};
type Invoice = {
  id: number;
  studentId: number;
  studentName: string;
  loginRollNumber: string;
  className: string;
  sectionName: string;
  billingMonth: string;
  dueDate: string;
  status: "DUE" | "PARTIAL" | "PAID" | "VOID";
  totalAmount: number;
  paidAmount: number;
  balance: number;
};
type PaymentMethod = {
  id: string;
  providerName: string;
  accountTitle: string;
  accountNumber: string;
  qrUrl: string | null;
};
type PaymentMethodDraft = PaymentMethod & { qrFile?: File | null };
type Submission = {
  id: number;
  invoiceId: number;
  amount: number;
  sourceBankName: string;
  transactionId: string;
  status: "SUBMITTED" | "VERIFIED" | "REJECTED";
  reviewerNote: string | null;
  submittedAt: string;
};
type FeesResponse = {
  classes: SchoolClass[];
  heads: FeeHead[];
  classItems: ClassItem[];
  invoices: Invoice[];
  paymentMethods: PaymentMethod[];
  submissions: Submission[];
  summary: {
    invoiceCount: number;
    billed: number;
    collected: number;
    outstanding: number;
    defaulters: number;
  };
};
type FeesApiResponse = Partial<FeesResponse>;
type StudentOption = {
  id: number;
  name: string;
  loginRollNumber: string;
  className: string;
  sectionName: string;
};
type FeeSection = "setup" | "billing" | "collections" | "paid";

const currentMonth = new Date().toISOString().slice(0, 7);
const money = (amount: number) =>
  `PKR ${Number(amount || 0).toLocaleString("en-PK")}`;
const statusTone = (
  status: Invoice["status"],
): "default" | "secondary" | "destructive" | "outline" =>
  status === "PAID"
    ? "default"
    : status === "VOID"
      ? "secondary"
      : status === "DUE"
        ? "destructive"
        : "outline";

export function FeesManager({ mode }: { mode: FeeSection }) {
  const { toast } = useToast();
  const [data, setData] = useState<FeesResponse | null>(null);
  const [loading, setLoading] = useState(mode !== "billing");
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(
    null,
  );
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDraft[]>(
    [],
  );
  const [reviewSubmission, setReviewSubmission] = useState<Submission | null>(
    null,
  );
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (mode === "billing") {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ view: mode });
        if (mode === "collections" || mode === "paid") {
          params.set("month", month);
          if (status) params.set("status", status);
          if (debouncedQuery) params.set("q", debouncedQuery);
        }
        const result = await api.get<FeesApiResponse>(
          `/api/institution/fees?${params}`,
          { signal },
        );
        setData((current) => ({
          classes: result.classes ?? current?.classes ?? [],
          heads: result.heads ?? current?.heads ?? [],
          classItems: result.classItems ?? current?.classItems ?? [],
          invoices: result.invoices ?? current?.invoices ?? [],
          paymentMethods:
            result.paymentMethods ?? current?.paymentMethods ?? [],
          submissions: result.submissions ?? current?.submissions ?? [],
          summary: result.summary ??
            current?.summary ?? {
              invoiceCount: 0,
              billed: 0,
              collected: 0,
              outstanding: 0,
              defaulters: 0,
            },
        }));
        if (result.paymentMethods) setPaymentMethods(result.paymentMethods);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        toast({
          title: "Could not load fees",
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [mode, month, status, debouncedQuery, toast],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      async () => {
        if (mode !== "billing" || studentQuery.trim().length < 2) {
          setStudentOptions([]);
          return;
        }
        try {
          const result = await api.get<{ students: StudentOption[] }>(
            `/api/institution/students/picker?q=${encodeURIComponent(studentQuery)}&limit=8`,
            { signal: controller.signal },
          );
          setStudentOptions(result.students);
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError"))
            setStudentOptions([]);
        }
      },
      studentQuery.trim().length < 2 ? 0 : 250,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mode, studentQuery]);

  const post = async (body: unknown, success: string) => {
    setBusy(true);
    try {
      const result = await api.post<Record<string, unknown>>(
        "/api/institution/fees",
        body,
      );
      toast({
        title: success,
        description:
          typeof result.created === "number"
            ? `${result.created} student invoices created.`
            : undefined,
        variant: "success",
      });
      if (mode !== "billing") await load();
      return true;
    } catch (error) {
      toast({
        title: "Action failed",
        description:
          error instanceof Error
            ? error.message
            : "Please check the information.",
        variant: "destructive",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const recurringHeads = useMemo(
    () =>
      data?.heads.filter(
        (head) => head.kind === "RECURRING" && head.isActive,
      ) || [],
    [data],
  );
  const feeAmount = (classId: number, headId: number) =>
    data?.classItems.find(
      (item) => item.classId === classId && item.feeHeadId === headId,
    )?.amount || 0;

  const addPaymentMethod = () =>
    setPaymentMethods((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        providerName: "",
        accountTitle: "",
        accountNumber: "",
        qrUrl: null,
        qrFile: null,
      },
    ]);
  const updatePaymentMethod = (
    id: string,
    values: Partial<PaymentMethodDraft>,
  ) =>
    setPaymentMethods((current) =>
      current.map((method) =>
        method.id === id ? { ...method, ...values } : method,
      ),
    );
  async function savePaymentMethods() {
    if (!paymentMethods.length) {
      toast({
        title: "Add at least one payment method",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const completed: PaymentMethod[] = [];
      for (const method of paymentMethods) {
        let qrUrl = method.qrUrl;
        if (method.qrFile) {
          const file = await prepareContentUpload(method.qrFile, {
            allowedKinds: ["image"],
            maximumBytes: 2 * 1024 * 1024,
          });
          const signature = await api.post<{
            signature: string;
            timestamp: number;
            folder: string;
            allowedFormats: string;
            type: string;
            cloudName: string;
            apiKey: string;
          }>("/api/institution/public-site/images", { action: "signature" });
          const upload = new FormData();
          upload.append("file", file);
          upload.append("api_key", signature.apiKey);
          upload.append("timestamp", String(signature.timestamp));
          upload.append("signature", signature.signature);
          upload.append("folder", signature.folder);
          upload.append("allowed_formats", signature.allowedFormats);
          upload.append("type", signature.type);
          const response = await fetch(
            `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
            { method: "POST", body: upload },
          );
          const uploaded = await response.json();
          if (!response.ok)
            throw new Error(uploaded.error?.message || "QR upload failed");
          const verified = await api.post<{ url: string }>(
            "/api/institution/public-site/images",
            {
              action: "complete",
              publicId: uploaded.public_id,
              format: uploaded.format,
              resourceType: uploaded.resource_type,
            },
          );
          qrUrl = verified.url;
        }
        completed.push({
          id: method.id,
          providerName: method.providerName.trim(),
          accountTitle: method.accountTitle.trim(),
          accountNumber: method.accountNumber.trim(),
          qrUrl,
        });
      }
      await api.post("/api/institution/fees", {
        action: "savePaymentMethods",
        paymentMethods: completed,
      });
      setPaymentMethods(completed);
      toast({ title: "Payment methods saved", variant: "success" });
    } catch (error) {
      toast({
        title: "Could not save payment methods",
        description:
          error instanceof Error ? error.message : "Check every field.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function reviewStudentPayment(statusValue: "VERIFIED" | "REJECTED") {
    if (!reviewSubmission) return;
    if (statusValue === "REJECTED" && reviewNote.trim().length < 2) return;
    const okay = await post(
      {
        action: "reviewStudentPayment",
        submissionId: reviewSubmission.id,
        status: statusValue,
        note: reviewNote,
      },
      statusValue === "VERIFIED"
        ? "Payment verified and receipt created"
        : "Payment proof rejected",
    );
    if (okay) {
      setReviewSubmission(null);
      setReviewNote("");
      await load();
    }
  }

  const createHead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      await post(
        {
          action: "createHead",
          name: form.get("name"),
          kind: form.get("kind"),
        },
        "Fee head added",
      )
    )
      event.currentTarget.reset();
  };

  const saveClassFee = async (
    classId: number,
    feeHeadId: number,
    input: HTMLInputElement,
  ) => {
    await post(
      {
        action: "setClassFee",
        classId,
        feeHeadId,
        amount: Number(input.value || 0),
      },
      "Class fee updated",
    );
  };

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const billingMonth = String(form.get("billingMonth"));
    if (
      await post(
        { action: "generateMonth", billingMonth, dueDate: form.get("dueDate") },
        "Monthly challans generated",
      )
    )
      setMonth(billingMonth);
  };

  const addAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStudent) return;
    const form = new FormData(event.currentTarget);
    if (
      await post(
        {
          action: "addAdjustment",
          studentId: selectedStudent.id,
          label: form.get("label"),
          type: form.get("type"),
          amount: form.get("amount"),
        },
        "Student adjustment saved",
      )
    ) {
      setSelectedStudent(null);
      setStudentQuery("");
      event.currentTarget.reset();
    }
  };

  const recordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedInvoice) return;
    const form = new FormData(event.currentTarget);
    const okay = await post(
      {
        action: "recordPayment",
        invoiceId: selectedInvoice.id,
        amount: form.get("amount"),
        method: form.get("method"),
        reference: form.get("reference"),
        notes: form.get("notes"),
      },
      "Payment recorded and receipt created",
    );
    if (okay) setSelectedInvoice(null);
  };

  return (
    <div className="space-y-7">
      {mode === "collections" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "Students billed",
              value: data?.summary.invoiceCount || 0,
              Icon: Users,
            },
            {
              label: "Monthly billed",
              value: money(data?.summary.billed || 0),
              Icon: ReceiptText,
            },
            {
              label: "Collected",
              value: money(data?.summary.collected || 0),
              Icon: Banknote,
            },
            {
              label: "Outstanding",
              value: money(data?.summary.outstanding || 0),
              Icon: CircleDollarSign,
            },
            {
              label: "Overdue accounts",
              value: data?.summary.defaulters || 0,
              Icon: CalendarDays,
            },
          ].map(({ label, value, Icon }) => (
            <Card key={label} className="h-full">
              <CardContent className="flex min-h-28 items-center justify-between gap-4 p-5">
                <div className="min-w-0 text-left">
                  <p className="text-xs font-semibold uppercase leading-5 tracking-wide text-stone-500">
                    {label}
                  </p>
                  <p className="mt-1.5 whitespace-nowrap text-xl font-bold tabular-nums leading-tight text-brand-950">
                    {String(value)}
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
                  <Icon className="h-5 w-5 text-brand-600" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === "setup" && (
        <div>
          <Card>
            <CardHeader className="border-b border-border bg-stone-50/60">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings2 className="h-5 w-5 text-brand-600" /> Class fee
                structure
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-b border-border p-5">
                <form
                  onSubmit={createHead}
                  className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"
                >
                  <Input
                    name="name"
                    required
                    minLength={2}
                    placeholder="Fee head, e.g. Tuition fee"
                  />
                  <select
                    name="kind"
                    className="h-11 rounded-sm border border-border bg-white px-3 text-left text-sm text-brand-950"
                  >
                    <option value="RECURRING">Every month</option>
                    <option value="ONE_TIME">One time</option>
                  </select>
                  <Button className="h-11 whitespace-nowrap" disabled={busy}>
                    <Plus className="mr-2 h-4 w-4" /> Add head
                  </Button>
                </form>
                <p className="mt-2 text-xs text-stone-500">
                  Monthly heads are included automatically. One-time heads are
                  kept available for special charges.
                </p>
              </div>
              {loading ? (
                <div className="p-8 text-center text-sm text-stone-500">
                  Loading fee structure…
                </div>
              ) : !data ||
                data.classes.length === 0 ||
                recurringHeads.length === 0 ? (
                <div className="p-8 text-center text-sm text-stone-500">
                  Create classes and at least one monthly fee head to prepare
                  the structure.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                      <tr>
                        <th className="px-5 py-3 text-left align-middle">
                          Class
                        </th>
                        {recurringHeads.map((head) => (
                          <th
                            key={head.id}
                            className="px-3 py-3 text-right align-middle"
                          >
                            {head.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.classes.map((schoolClass) => (
                        <tr key={schoolClass.id}>
                          <td className="px-5 py-3 text-left align-middle font-semibold text-brand-950">
                            {schoolClass.name}
                          </td>
                          {recurringHeads.map((head) => (
                            <td
                              key={head.id}
                              className="px-3 py-2 align-middle"
                            >
                              <div className="ml-auto flex w-fit items-center justify-end gap-2">
                                <span className="text-xs font-medium text-stone-400">
                                  PKR
                                </span>
                                <input
                                  aria-label={`${head.name} for ${schoolClass.name}`}
                                  type="number"
                                  min="0"
                                  defaultValue={feeAmount(
                                    schoolClass.id,
                                    head.id,
                                  )}
                                  className="w-28 rounded-md border border-border px-2 py-1.5 text-right tabular-nums"
                                  onBlur={(event) => {
                                    if (
                                      Number(event.currentTarget.value) !==
                                      feeAmount(schoolClass.id, head.id)
                                    )
                                      void saveClassFee(
                                        schoolClass.id,
                                        head.id,
                                        event.currentTarget,
                                      );
                                  }}
                                />
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader className="border-b border-border bg-stone-50/60">
              <CardTitle className="text-lg">Student payment methods</CardTitle>
              <p className="mt-1 text-sm text-stone-500">
                These verified account details appear when a student pays a
                challan.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {paymentMethods.map((method, index) => (
                <div
                  key={method.id}
                  className="rounded-lg border border-stone-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <strong>Payment method {index + 1}</strong>
                    {paymentMethods.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPaymentMethods((current) =>
                            current.filter((item) => item.id !== method.id),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" /> Remove
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input
                      required
                      value={method.providerName}
                      onChange={(event) =>
                        updatePaymentMethod(method.id, {
                          providerName: event.target.value,
                        })
                      }
                      placeholder="Bank / wallet name"
                    />
                    <Input
                      required
                      value={method.accountTitle}
                      onChange={(event) =>
                        updatePaymentMethod(method.id, {
                          accountTitle: event.target.value,
                        })
                      }
                      placeholder="Account title / username"
                    />
                    <Input
                      required
                      value={method.accountNumber}
                      onChange={(event) =>
                        updatePaymentMethod(method.id, {
                          accountNumber: event.target.value,
                        })
                      }
                      placeholder="Account / IBAN / mobile number"
                    />
                    <Input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(event) =>
                        updatePaymentMethod(method.id, {
                          qrFile: event.target.files?.[0] || null,
                        })
                      }
                    />
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={paymentMethods.length >= 8}
                  onClick={addPaymentMethod}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add method
                </Button>
                <Button
                  disabled={busy || !paymentMethods.length}
                  onClick={() => void savePaymentMethods()}
                >
                  Save payment methods
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "billing" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="border-b border-border bg-stone-50/60">
              <CardTitle className="text-lg leading-6">
                Generate monthly challans
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={generate} className="space-y-4">
                <label className="block text-left text-sm font-medium leading-5 text-stone-700">
                  Billing month
                  <Input
                    className="mt-1.5 tabular-nums"
                    type="month"
                    name="billingMonth"
                    defaultValue={month}
                    required
                  />
                </label>
                <label className="block text-left text-sm font-medium leading-5 text-stone-700">
                  Payment due date
                  <Input
                    className="mt-1.5 tabular-nums"
                    type="date"
                    name="dueDate"
                    required
                  />
                </label>
                <p className="text-left text-xs leading-5 text-stone-500">
                  Only active students with a fee structure receive a challan.
                  Existing challans are safely skipped.
                </p>
                <Button className="h-11 w-full" disabled={busy}>
                  Generate challans
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border bg-stone-50/60">
              <CardTitle className="text-lg leading-6">
                Student concession or charge
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={addAdjustment} className="space-y-3 text-left">
                <div className="relative">
                  <Input
                    value={studentQuery}
                    onChange={(event) => {
                      setStudentQuery(event.target.value);
                      setSelectedStudent(null);
                    }}
                    placeholder="Search student name or roll number"
                  />
                  {studentOptions.length > 0 && !selectedStudent && (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-white shadow-lg">
                      {studentOptions.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => {
                            setSelectedStudent(student);
                            setStudentQuery(
                              `${student.name} — ${formatClassSection(student.className, student.sectionName)}`,
                            );
                            setStudentOptions([]);
                          }}
                          className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-stone-50"
                        >
                          <span className="font-medium">{student.name}</span>
                          <span className="mt-0.5 block text-xs leading-4 text-stone-500">
                            {student.loginRollNumber} · {formatClassSection(student.className, student.sectionName)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Input
                  name="label"
                  required
                  placeholder="Reason, e.g. Sibling concession"
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select
                    name="type"
                    className="h-11 rounded-sm border border-border bg-white px-3 text-left text-sm text-brand-950"
                  >
                    <option value="DISCOUNT">Discount</option>
                    <option value="CHARGE">Extra charge</option>
                  </select>
                  <Input
                    name="amount"
                    className="text-right tabular-nums"
                    type="number"
                    min="1"
                    required
                    placeholder="Amount"
                  />
                </div>
                <Button
                  variant="outline"
                  className="h-11 w-full"
                  disabled={busy || !selectedStudent}
                >
                  Save adjustment
                </Button>
                <p className="text-xs leading-5 text-stone-500">
                  Applies to future challans; already issued challans remain
                  unchanged for clean records.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {(mode === "collections" || mode === "paid") && (
        <Card>
          <CardHeader className="border-b border-border bg-stone-50/60">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="text-left">
                <CardTitle className="text-lg leading-6">
                  {mode === "paid"
                    ? "Paid fees / challans"
                    : "Collection register"}
                </CardTitle>
                <p className="mt-1 text-sm leading-5 text-stone-500">
                  {mode === "paid"
                    ? "The 50 most recent fully paid challans are shown."
                    : "The first 50 matching accounts are shown to keep the page fast."}
                </p>
              </div>
              {mode === "collections" && (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <Input
                    type="month"
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                    className="tabular-nums sm:w-40"
                  />
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="h-11 rounded-sm border border-border bg-white px-3 text-left text-sm text-brand-950"
                  >
                    <option value="">All statuses</option>
                    <option value="DUE">Due</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="PAID">Paid</option>
                  </select>
                  <div className="relative min-w-56">
                    <Search className="pointer-events-none absolute left-3 top-3.5 z-10 h-4 w-4 text-stone-400" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className="pl-9"
                      placeholder="Student or roll no."
                    />
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 text-center text-sm text-stone-500">
                Loading fee register…
              </div>
            ) : !data?.invoices.length ? (
              <div className="p-10 text-center">
                <ReceiptText className="mx-auto h-9 w-9 text-stone-300" />
                <p className="mt-3 font-medium text-stone-700">
                  No challans found
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Prepare the fee structure and generate this month’s challans.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="px-5 py-3 text-left align-middle">
                        Student
                      </th>
                      <th className="px-3 py-3 text-left align-middle">
                        Class
                      </th>
                      <th className="px-3 py-3 text-left align-middle">Due</th>
                      <th className="px-3 py-3 text-right align-middle">
                        Total
                      </th>
                      <th className="px-3 py-3 text-right align-middle">
                        Balance
                      </th>
                      <th className="px-3 py-3 text-center align-middle">
                        Status
                      </th>
                      <th className="px-5 py-3 text-right align-middle">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.invoices.map((invoice) => {
                      const pendingSubmission = data.submissions.find(
                        (submission) =>
                          submission.invoiceId === invoice.id &&
                          submission.status === "SUBMITTED",
                      );
                      return (
                        <tr key={invoice.id} className="hover:bg-stone-50/60">
                          <td className="px-5 py-3 text-left align-middle">
                            <p className="font-semibold leading-5 text-brand-950">
                              {invoice.studentName}
                            </p>
                            <p className="mt-0.5 text-xs leading-4 text-stone-500">
                              {invoice.loginRollNumber}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-left align-middle">
                            {formatClassSection(invoice.className, invoice.sectionName, " · ")}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-left align-middle tabular-nums">
                            {new Date(
                              `${invoice.dueDate}T00:00:00`,
                            ).toLocaleDateString("en-PK")}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right align-middle tabular-nums">
                            {money(invoice.totalAmount)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right align-middle font-semibold tabular-nums">
                            {money(invoice.balance)}
                          </td>
                          <td className="px-3 py-3 text-center align-middle">
                            <Badge variant={statusTone(invoice.status)}>
                              {invoice.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right align-middle">
                            {pendingSubmission && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setReviewSubmission(pendingSubmission);
                                  setReviewNote("");
                                }}
                              >
                                Review proof
                              </Button>
                            )}
                            {mode === "collections" && !pendingSubmission && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  invoice.status === "PAID" ||
                                  invoice.status === "VOID"
                                }
                                onClick={() => setSelectedInvoice(invoice)}
                              >
                                Collect
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {reviewSubmission && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy)
              setReviewSubmission(null);
          }}
        >
          <Card className="w-full max-w-lg">
            <CardHeader className="border-b text-left">
              <CardTitle>Verify student payment</CardTitle>
              <p className="mt-1 text-sm text-stone-500">
                Match the source bank, transaction ID, amount, and receipt
                before approving.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-6 text-left">
              <dl className="grid gap-3 rounded-lg bg-stone-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-stone-500">Amount</dt>
                  <dd className="font-bold">
                    {money(reviewSubmission.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">
                    Source bank / wallet
                  </dt>
                  <dd className="font-semibold">
                    {reviewSubmission.sourceBankName}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-stone-500">Transaction ID</dt>
                  <dd className="break-all font-mono font-bold">
                    {reviewSubmission.transactionId}
                  </dd>
                </div>
              </dl>
              <a
                href={`/api/institution/fees/files/${reviewSubmission.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block font-semibold text-brand-700 underline"
              >
                Open submitted receipt
              </a>
              <label className="block text-sm font-semibold">
                Review note
                <textarea
                  rows={3}
                  maxLength={500}
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  className="mt-1.5 w-full rounded-md border border-border px-3 py-2 font-normal"
                  placeholder="Optional when verifying; required when rejecting"
                />
              </label>
              <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setReviewSubmission(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={busy || reviewNote.trim().length < 2}
                  onClick={() => void reviewStudentPayment("REJECTED")}
                >
                  Reject proof
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => void reviewStudentPayment("VERIFIED")}
                >
                  Verify & create receipt
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedInvoice(null);
          }}
        >
          <Card className="w-full max-w-lg">
            <CardHeader className="border-b border-border text-left">
              <CardTitle className="leading-6">Record payment</CardTitle>
              <p className="mt-1 text-sm leading-5 text-stone-500">
                {selectedInvoice.studentName} · Balance{" "}
                <span className="whitespace-nowrap font-semibold tabular-nums text-stone-700">
                  {money(selectedInvoice.balance)}
                </span>
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={recordPayment} className="space-y-4 text-left">
                <label className="block text-sm font-medium leading-5">
                  Amount received
                  <Input
                    className="mt-1.5 text-right tabular-nums"
                    name="amount"
                    type="number"
                    min="1"
                    max={selectedInvoice.balance}
                    defaultValue={selectedInvoice.balance}
                    required
                  />
                </label>
                <label className="block text-sm font-medium leading-5">
                  Payment method
                  <select
                    name="method"
                    className="mt-1.5 h-11 w-full rounded-sm border border-border bg-white px-3 text-left text-sm text-brand-950"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank transfer</option>
                    <option value="EASYPAISA">Easypaisa</option>
                    <option value="JAZZCASH">JazzCash</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <Input
                  name="reference"
                  placeholder="Transaction/reference number (optional)"
                />
                <Input name="notes" placeholder="Notes (optional)" />
                <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedInvoice(null)}
                  >
                    Cancel
                  </Button>
                  <Button disabled={busy}>Record & create receipt</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
