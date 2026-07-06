"use client";

import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Plus, Upload, MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";

export function StudentsClient({
  students,
  campuses,
  classes,
  sections
}: {
  students: any[];
  campuses: { id: number; name: string }[];
  classes: { id: number; name: string }[];
  sections: { id: number; classId: number; name: string }[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  const filteredSections = selectedClassId 
    ? sections.filter(s => s.classId === parseInt(selectedClassId))
    : [];

  const columns = [
    { header: "Roll Number", accessorKey: "loginRollNumber", sortable: true },
    { header: "Name", accessorKey: "name", cell: (s: any) => <span className="font-medium text-brand-900">{s.name}</span> },
    { header: "Gender", accessorKey: "gender" },
    { header: "Year", accessorKey: "yearOfJoining" },
    { 
      header: "Actions", 
      cell: () => (
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4 text-stone-500" />
        </Button>
      )
    }
  ];

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    try {
      const res = await api.post("/api/institution/students", data) as any;
      toast({ 
        title: "Student Created", 
        description: `Login ID generated: ${res.credentials?.loginRollNumber || 'Success'}`, 
        variant: "success" 
      });
      setIsCreateOpen(false);
      router.refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Students</h1>
          <p className="text-stone-500 mt-1">Manage all enrolled students across campuses.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Bulk Import
          </Button>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-brand-800 hover:bg-brand-900 text-white">
                <Plus className="h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">First Name</label>
                    <Input name="firstName" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Last Name</label>
                    <Input name="lastName" required />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Campus</label>
                  <select name="campusId" required className="w-full h-10 rounded-md border border-border bg-white px-3 py-2 text-sm focus-ring">
                    <option value="">Select Campus</option>
                    {campuses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Class</label>
                    <select 
                      name="classId" 
                      required 
                      className="w-full h-10 rounded-md border border-border bg-white px-3 py-2 text-sm focus-ring"
                      value={selectedClassId}
                      onChange={e => setSelectedClassId(e.target.value)}
                    >
                      <option value="">Select Class</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Section</label>
                    <select name="sectionId" required className="w-full h-10 rounded-md border border-border bg-white px-3 py-2 text-sm focus-ring">
                      <option value="">Select Section</option>
                      {filteredSections.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Gender</label>
                    <select name="gender" className="w-full h-10 rounded-md border border-border bg-white px-3 py-2 text-sm focus-ring">
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Year of Joining</label>
                    <Input type="number" name="yearOfJoining" defaultValue={new Date().getFullYear()} required min={2000} max={2100} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Class Roll Number</label>
                  <Input name="classRollNumber" required placeholder="e.g. 001" />
                </div>
                
                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={isSubmitting} className="bg-brand-800 hover:bg-brand-900 text-white w-full">
                    {isSubmitting ? "Creating Student..." : "Create Student"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <DataTable 
          data={students} 
          columns={columns} 
          searchKey="name" 
          searchPlaceholder="Search students by name..."
        />
      </Card>
    </div>
  );
}
