type InstitutionLike = {
  type: string;
  username: string;
};

type ClassLike = {
  name: string;
};

type SectionLike = {
  name: string;
};

function appDomain() {
  return (process.env.NEXT_PUBLIC_APP_DOMAIN || "myapp.pk").trim();
}

function cleanAlphaNumeric(value: string) {
  return value.replace(/[^a-z0-9]/gi, "");
}

function sectionCode(sectionName: string) {
  const tokens = sectionName.match(/[a-z0-9]+/gi) || [];
  const compact = cleanAlphaNumeric(sectionName).toUpperCase();

  return (tokens.at(-1) || compact).toUpperCase();
}

export function generateStudentLoginRollNumber({
  institution,
  classRow,
  sectionRow,
  yearOfJoining,
  gender,
  classRollNumber,
}: {
  institution: InstitutionLike;
  classRow: ClassLike;
  sectionRow: SectionLike;
  yearOfJoining: number;
  gender: string;
  classRollNumber: string;
}) {
  const typeLetter = institution.type.charAt(0).toUpperCase();
  const yearLastTwo = yearOfJoining.toString().slice(-2);
  const genderCode = gender === "MALE" ? "M" : gender === "FEMALE" ? "F" : "";
  const classNumberMatch = classRow.name.match(/\d+/);
  const classNumber = classNumberMatch ? classNumberMatch[0] : cleanAlphaNumeric(classRow.name).substring(0, 3).toUpperCase();
  const section = sectionCode(sectionRow.name);

  if (!typeLetter) throw new Error("Institution type is required to generate a student login ID");
  if (!classNumber) throw new Error("Class name must contain at least one letter or number");
  if (!section) throw new Error("Section name must contain at least one letter or number");
  if (!genderCode) throw new Error("Gender must be MALE or FEMALE to generate a student login ID");

  return `${typeLetter}${yearLastTwo}${genderCode}${classNumber}${section}${classRollNumber}@${institution.username}.${appDomain()}`;
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
