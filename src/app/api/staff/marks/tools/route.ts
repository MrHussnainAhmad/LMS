import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { inputErrorResponse } from '@/lib/input-error-response';
import { uploadMarksCsvAction, publishStaffAssessmentResultsAction } from '@/app/actions/assessment-actions';

// Both transports use the same assignment, roster, overwrite and publication checks.
export const POST = requireRole(['STAFF'], async (req) => {
  try {
    const form = await req.formData();
    const action = form.get('action');
    if (action === 'upload') {
      const file = form.get('csv');
      if (!(file instanceof File) || file.size > 1024 * 1024)
        return NextResponse.json({ error: 'Choose a CSV file no larger than 1 MB.' }, { status: 400 });
      await uploadMarksCsvAction(form);
    } else if (action === 'publish') {
      await publishStaffAssessmentResultsAction(form);
    } else return NextResponse.json({ error: 'Invalid marks action.' }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = inputErrorResponse(error);
    if (result) return NextResponse.json(result.body, { status: result.status });
    throw error;
  }
});
