"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { prepareContentUpload } from "@/lib/client-upload-file";

export function ApplicantFeePayment({
  applicationId,
  accentColor,
}: {
  applicationId: number;
  accentColor: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("No file selected");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("proof");
    const payerReference = String(data.get("payerReference") || "").trim();
    const payerSourceBank = String(data.get("payerSourceBank") || "").trim();
    if (!(file instanceof File) || !file.size) {
      setError("Choose a payment proof file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const preparedFile = await prepareContentUpload(file, {
        allowedKinds: ["image", "pdf"],
      });
      const signatureResponse = await fetch(
        `/api/public/admissions/fees/${applicationId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "signature" }),
        },
      );
      const signature = await signatureResponse.json();
      if (!signatureResponse.ok)
        throw new Error(
          signature.error || "Unable to prepare payment proof upload",
        );
      const uploadForm = new FormData();
      uploadForm.append("file", preparedFile);
      uploadForm.append("api_key", signature.apiKey);
      uploadForm.append("timestamp", String(signature.timestamp));
      uploadForm.append("signature", signature.signature);
      uploadForm.append("folder", signature.folder);
      uploadForm.append("allowed_formats", signature.allowedFormats);
      uploadForm.append("type", signature.type);
      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/auto/upload`,
        { method: "POST", body: uploadForm },
      );
      const uploaded = await uploadResponse.json();
      if (
        !uploadResponse.ok ||
        !uploaded.public_id ||
        !uploaded.format ||
        !uploaded.resource_type
      )
        throw new Error(
          uploaded.error?.message || "Payment proof upload failed",
        );
      const completeResponse = await fetch(
        `/api/public/admissions/fees/${applicationId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete",
            publicId: uploaded.public_id,
            format: uploaded.format,
            resourceType: uploaded.resource_type,
            payerReference,
            payerSourceBank,
          }),
        },
      );
      const completed = await completeResponse.json();
      if (!completeResponse.ok)
        throw new Error(completed.error || "Unable to submit payment proof");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit payment proof",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-5 space-y-4 border-t border-emerald-200 pt-4"
    >
      <div>
        <label
          className="text-xs font-bold uppercase tracking-wider text-stone-600"
          htmlFor={`payment-source-${applicationId}`}
        >
          Your source bank / wallet
        </label>
        <input
          id={`payment-source-${applicationId}`}
          required
          name="payerSourceBank"
          maxLength={120}
          className="mt-2 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
          placeholder="Bank, Easypaisa, JazzCash, etc."
        />
      </div>
      <div>
        <label
          className="text-xs font-bold uppercase tracking-wider text-stone-600"
          htmlFor={`payment-reference-${applicationId}`}
        >
          Transaction ID or receipt number
        </label>
        <input
          id={`payment-reference-${applicationId}`}
          required
          name="payerReference"
          maxLength={160}
          className="mt-2 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
          placeholder="Enter the reference shown after payment"
        />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-stone-600">
          Payment receipt
        </p>
        <label className="mt-2 flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border border-dashed border-black/20 bg-white p-3 text-sm font-semibold">
          <span
            className="rounded-md px-3 py-2 text-white"
            style={{ backgroundColor: accentColor }}
          >
            Choose receipt file
          </span>
          <span className="min-w-0 truncate text-xs font-normal text-stone-600">
            {fileName}
          </span>
          <input
            required
            name="proof"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) =>
              setFileName(event.target.files?.[0]?.name || "No file selected")
            }
          />
        </label>
        <p className="mt-2 text-xs text-stone-500">
          Upload the bank/wallet receipt as PDF, JPG, PNG, or WebP; maximum 5
          MB. Images are compressed first.
        </p>
      </div>
      <button
        disabled={busy}
        className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        style={{ backgroundColor: accentColor }}
      >
        {busy
          ? "Compressing and submitting..."
          : "Submit transaction and receipt"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
