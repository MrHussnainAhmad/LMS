import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { institutions } from '@/db/schema';
import { hash } from '@node-rs/argon2';
import { registerInstitutionSchema } from '@/lib/validators/institution';
import { withRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const rateLimit = await withRateLimit(req, 'api');
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const parsed = registerInstitutionSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const data = parsed.data;
    const adminPasswordHash = await hash(data.adminPassword);

    await db.insert(institutions).values({
      name: data.name,
      type: data.type,
      username: data.username,
      country: data.country,
      city: data.city,
      address: data.address,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      registrationNumber: data.registrationNumber,
      logoKey: data.logoKey,
      proofDocumentKey: data.proofDocumentKey,
      adminPasswordHash,
      status: 'PENDING',
    });

    return NextResponse.json({ message: 'Institution registered successfully. Pending approval.' }, { status: 201 });
  } catch (err: any) {
    if (err.code === '23505') { // Postgres unique constraint violation
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 409 });
    }
    console.error('Registration Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
