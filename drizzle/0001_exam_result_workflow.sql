ALTER TABLE "batch_exam_results" ADD COLUMN "details" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "batch_exam_subjects" ADD COLUMN "policy" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "batch_exams" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
-- Preserve results that were already visible under the former deadline policy.
-- Pending results stay private; deadlines never publish new results after this upgrade.
UPDATE batch_exams e SET official_published_at = COALESCE((
  SELECT max(CASE WHEN s.is_published THEN COALESCE(s.published_at,e.created_at) ELSE s.review_deadline END)
  FROM batch_exam_subjects s WHERE s.batch_exam_id=e.id
),e.created_at)
WHERE e.type <> 'PROMOTION' AND e.official_published_at IS NULL
  AND EXISTS (SELECT 1 FROM batch_exam_subjects s WHERE s.batch_exam_id=e.id)
  AND NOT EXISTS (SELECT 1 FROM batch_exam_subjects s WHERE s.batch_exam_id=e.id
    AND NOT s.is_published AND s.review_deadline > now());
--> statement-breakpoint
UPDATE batch_exams e SET settings = jsonb_build_object('workflow','LEGACY','reportVersion',1)
  || CASE WHEN e.type='PROMOTION' AND e.official_published_at IS NOT NULL
       THEN jsonb_build_object('promotionAppliedAt',e.official_published_at) ELSE '{}'::jsonb END
  || COALESCE((SELECT jsonb_build_object('gradingSnapshot',jsonb_build_object('passingPercentage',g.passing_percentage,'grades',g.grades_json))
       FROM grading_scales g WHERE g.institution_id=e.institution_id AND e.official_published_at IS NOT NULL),
       CASE WHEN e.official_published_at IS NOT NULL
         THEN jsonb_build_object('gradingSnapshot',jsonb_build_object('passingPercentage',40,'grades','[]'::jsonb))
         ELSE '{}'::jsonb END);
--> statement-breakpoint
UPDATE batch_exam_subjects s SET is_published=true,published_at=COALESCE(s.published_at,e.official_published_at)
FROM batch_exams e WHERE e.id=s.batch_exam_id AND e.official_published_at IS NOT NULL;
