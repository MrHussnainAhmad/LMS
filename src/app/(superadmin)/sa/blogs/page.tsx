import { Metadata } from "next";
import BlogClient from "../../../components/blogs/BlogClient";

export const metadata: Metadata = {
  title: "Manage Blogs | Super Admin",
};

export default function SuperAdminBlogsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-display text-stone-900 mb-6">Manage Blogs</h1>
      <BlogClient />
    </div>
  );
}
