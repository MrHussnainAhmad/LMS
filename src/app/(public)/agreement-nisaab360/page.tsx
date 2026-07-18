import { db } from "@/db";
import { institutions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PrintButton } from "./PrintButton";
import { BackButton } from "./BackButton";
import Link from "next/link";

export default async function AgreementPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const idParam = params.id;
  
  let instName = "_________________________________";
  let instLocation = "______________________________________________________";
  let isFilled = false;
  let docTitle = "Nisaab360 Service Agreement";

  if (idParam && typeof idParam === "string") {
    const institutionId = parseInt(idParam, 10);
    if (Number.isInteger(institutionId)) {
      const [institution] = await db
        .select()
        .from(institutions)
        .where(eq(institutions.id, institutionId))
        .limit(1);

      if (institution) {
        instName = institution.name;
        instLocation = `${institution.address}, ${institution.city}, ${institution.country}`;
        isFilled = true;
        docTitle = `${instName} and Nisaab360`;
      }
    }
  }

  return (
    <div className="min-h-screen bg-stone-100 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:py-0 print:px-0">
      <div className="max-w-4xl mx-auto">
        {/* Controls Header - Hidden on Print */}
        <div className="flex justify-between items-center mb-6 print:hidden">
          {isFilled ? (
             <BackButton />
          ) : (
            <div /> // Empty div to keep alignment if we don't have back button
          )}
          {isFilled && <PrintButton title={docTitle} />}
        </div>

        {/* Document Container */}
        <div className="bg-white p-8 sm:p-12 shadow-sm rounded-lg border border-stone-200 print:shadow-none print:border-none print:p-0">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold font-serif mb-2">SERVICE AGREEMENT</h1>
            <p className="text-stone-600 font-serif">Between Nisaab360 and {isFilled ? instName : "Institution"}</p>
          </div>

          <div className="space-y-6 font-serif text-stone-800 leading-relaxed text-justify">
            <p>
              This Service Agreement ("Agreement") is entered into by and between <strong>Nisaab360</strong> ("Provider", "we", "us"), and <strong>{instName}</strong> located at <strong>{instLocation}</strong> ("Institution", "Client", "you").
            </p>

            <section className="space-y-4">
              <h2 className="text-lg font-bold">1. Fee</h2>
              <p>The fees and payment terms are as agreed upon in the Document Agreement and applicable invoices.</p>

              <h2 className="text-lg font-bold">2. Scope of Services</h2>
              <p>The Provider agrees to provide access to the Nisaab360 online Learning Management System (LMS) and associated digital services (the "Services"). All services are provided entirely <strong>online</strong>.</p>

              <h2 className="text-lg font-bold">3. Onboarding & Data</h2>
              <p>The onboarding process and initial data setup will be conducted <strong>online</strong> and is expected to be completed within <strong>7 days</strong> of account provisioning, provided the Institution submits all required information promptly.</p>

              <h2 className="text-lg font-bold">4. Contract Term, Renewal & Non-Renewal</h2>
              <p>This Agreement governs the use of the Services for the duration of the subscription term. Renewals, cancellations, and non-renewals are managed <strong>online</strong> through the platform's billing or administration portal.</p>

              <h2 className="text-lg font-bold">5. Provider Discontinuation of Service</h2>
              <p>Nisaab360 reserves the right to discontinue the Service or specific features. Notices regarding significant changes or discontinuation will be provided <strong>online</strong> via the platform or registered email.</p>

              <h2 className="text-lg font-bold">6. Temporary Suspension, Outages & Force Majeure</h2>
              <p>The Services may be temporarily suspended for maintenance, updates, or due to unforeseen outages. The Provider is not liable for service interruptions caused by Force Majeure events. Notices of planned outages will be communicated <strong>online</strong>.</p>

              <h2 className="text-lg font-bold">7. Termination for Breach</h2>
              <p>Either party may terminate this Agreement if the other party breaches a material term. The terminating party must provide <strong>15 days</strong> written notice (via <strong>online</strong> communication/email) to allow the breaching party to cure the breach.</p>

              <h2 className="text-lg font-bold">8. Support & Availability</h2>
              <p>Technical support and system availability are provided <strong>online</strong>. Response times and support channels are detailed in the platform's help center.</p>

              <h2 className="text-lg font-bold">9. Data Ownership, Export & Privacy</h2>
              <p>The Institution retains ownership of all its data. Data export functionalities are available <strong>online</strong> within the platform. Nisaab360 adheres to strict privacy standards to protect user data.</p>

              <h2 className="text-lg font-bold">10. Intellectual Property</h2>
              <p>All intellectual property rights in the Nisaab360 platform, software, and materials remain the exclusive property of the Provider. Access is granted <strong>online</strong> solely for the purpose of utilizing the Services.</p>

              <h2 className="text-lg font-bold">11. Warranties & Limitation of Liability</h2>
              <p>The Services are provided "as is" and "as available" <strong>online</strong>. The Provider disclaims all warranties, express or implied. The Provider's liability shall be limited to the maximum extent permitted by law.</p>

              <h2 className="text-lg font-bold">12. Confidentiality</h2>
              <p>Both parties agree to maintain the confidentiality of any proprietary information shared during the term of this Agreement. This obligation applies to all information exchanged, whether in person or <strong>online</strong>.</p>

              <h2 className="text-lg font-bold">13. Governing Law & Dispute Resolution</h2>
              <p>This Agreement shall be governed by the laws applicable in Pakistan. Any disputes arising under or in connection with this Agreement shall be resolved <strong>online</strong> where possible, or subject to the exclusive jurisdiction of the courts located in <strong>Multan/Lodhran</strong>.</p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
