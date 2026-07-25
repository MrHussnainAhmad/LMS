type InstitutionLike = {
  type: string;
  username: string;
};


function appDomain() {
  return (process.env.NEXT_PUBLIC_APP_DOMAIN || "myapp.pk").trim();
}

function cleanAlphaNumeric(value: string) {
  return value.replace(/[^a-z0-9]/gi, "");
}

export function generateStudentLoginRollNumber({
  institution,
  yearOfJoining,
  admissionSequence,
}: {
  institution: InstitutionLike;
  yearOfJoining: number;
  admissionSequence: number;
}) {
  const typeLetter = institution.type.charAt(0).toUpperCase();
  const yearLastTwo = yearOfJoining.toString().slice(-2);

  if (!typeLetter) throw new Error("Institution type is required to generate a student login ID");
  if (!Number.isInteger(admissionSequence) || admissionSequence < 1 || admissionSequence > 99_999_999) throw new Error("Invalid admission sequence");

  return `${typeLetter}${yearLastTwo}-${String(admissionSequence).padStart(8, "0")}@${institution.username}.${appDomain()}`;
}

export function generateStaffEmail({
  name,
  phone,
  institution,
}: {
  name: string;
  phone?: string | null;
  institution: Pick<InstitutionLike, "username">;
}) {
  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const firstInitial = cleanAlphaNumeric(parts[0] || "").charAt(0);
  const secondName = cleanAlphaNumeric(parts[1] || parts.slice(1).join("") || parts[0] || "").toLowerCase();
  const phoneDigits = (phone || "").replace(/\D/g, "");
  const phoneLastFour = phoneDigits.slice(-4);

  if (!firstInitial || !secondName) throw new Error("Staff name must include enough letters to generate an email");
  if (phoneLastFour.length !== 4) throw new Error("Staff phone number must include at least 4 digits");

  return `${firstInitial}${secondName}${phoneLastFour}@${institution.username}.${appDomain()}`;
}
