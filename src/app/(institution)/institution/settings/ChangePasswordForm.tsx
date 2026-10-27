"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { changePasswordSchema } from "@/lib/validators/auth";
import { validationError } from "@/lib/validation-errors";

export function ChangePasswordForm({ readOnly = false }: { readOnly?: boolean }) {
  const formId = useId();
  const pending = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || readOnly || success) return;
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = changePasswordSchema.safeParse({
      currentPassword: data.get("currentPassword"),
      newPassword: data.get("newPassword"),
    });
    if (!parsed.success) {
      setError(validationError(parsed.error).error);
      return;
    }
    if (parsed.data.newPassword !== data.get("confirmPassword")) {
      setError("New passwords do not match.");
      return;
    }

    pending.current = true;
    setIsLoading(true);
    try {
      await api.post("/api/auth/change-password", parsed.data);
      form.reset();
      setSuccess(true);
      window.location.replace("/institution-login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update your password. Please try again.");
    } finally {
      pending.current = false;
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isLoading}>
      <p id={`${formId}-guidance`} className="text-sm leading-6 text-stone-500">
        Use at least 8 characters and choose a password different from your current password and the default password.
        After updating, sign in again with your new password.
      </p>
      {readOnly && <p role="status" className="text-sm text-stone-500">Switch back to your own campus to update your password.</p>}
      <fieldset disabled={readOnly || isLoading || success} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor={`${formId}-current`} className="block text-sm font-medium text-stone-700">Current Password</label>
          <Input id={`${formId}-current`} name="currentPassword" type="password" autoComplete="current-password" required maxLength={1024} />
        </div>
        <div className="space-y-2">
          <label htmlFor={`${formId}-new`} className="block text-sm font-medium text-stone-700">New Password</label>
          <Input id={`${formId}-new`} name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={1024} aria-describedby={`${formId}-guidance`} />
        </div>
        <div className="space-y-2">
          <label htmlFor={`${formId}-confirm`} className="block text-sm font-medium text-stone-700">Confirm New Password</label>
          <Input id={`${formId}-confirm`} name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={1024} />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {success && <p role="status" className="text-sm text-success">Password updated. Redirecting to sign in.</p>}
        <Button type="submit" disabled={readOnly || isLoading || success}>
          {isLoading ? "Updating..." : "Update Password"}
        </Button>
      </fieldset>
    </form>
  );
}
