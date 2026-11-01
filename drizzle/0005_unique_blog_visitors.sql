CREATE TABLE "blog_visits" (
	"blog_id" integer NOT NULL,
	"visitor_id" varchar(36) NOT NULL,
	CONSTRAINT "blog_visits_blog_id_visitor_id_pk" PRIMARY KEY("blog_id","visitor_id")
);
--> statement-breakpoint
ALTER TABLE "blog_visits" ADD CONSTRAINT "blog_visits_blog_id_blogs_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blogs"("id") ON DELETE cascade ON UPDATE no action;