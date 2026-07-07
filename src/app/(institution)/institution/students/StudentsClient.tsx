"use client";

import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Plus, Upload, MoreHorizontal, Eye, Edit, Trash } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";

type StudentRow = {
  id: number;
  loginRollNumber: string;
  name: string;
  gender: string;
  yearOfJoining: number;
  classId: number;
  sectionId: number;
  classRollNumber: string;
  phone: string | null;
};

type CreateStudentResponse = {
  credentials?: {
    loginRollNumber?: string;
  };
};

type StudentTableRow = StudentRow & {
  searchString: string;
};

type StudentColumn = {
  header: string;
  accessorKey?: keyof StudentTableRow;
  cell?: (student: StudentTableRow) => ReactNode;
  sortable?: boolean;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function StudentsClient({
  students,
  campuses,
  classes,
  sections
}: {
  students: StudentRow[];
  campuses: { id: number; name: string }[];
  classes: { id: number; name: string }[];
  sections: { id: number; classId: number; name: string }[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editStudent, setEditStudent] = useState<StudentRow | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<StudentRow | null>(null);

  // Filters state
  const [filterClassId, setFilterClassId] = useState<string>("");
  const [filterSectionId, setFilterSectionId] = useState<string>("");

  // Create form state
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const createFilteredSections = selectedClassId 
    ? sections.filter(s => s.classId === parseInt(selectedClassId))
    : [];

  const mainFilteredSections = filterClassId 
    ? sections.filter(s => s.classId === parseInt(filterClassId))
    : [];

  // Prepare table data with combined search field
  const tableData = useMemo(() => {
    let filtered = students;
    if (filterClassId) {
      filtered = filtered.filter(s => s.classId === parseInt(filterClassId));
    }
    if (filterSectionId) {
      filtered = filtered.filter(s => s.sectionId === parseInt(filterSectionId));
    }
    return filtered.map(s => ({
      ...s,
      searchString: `${s.name} ${s.loginRollNumber}`
    }));
  }, [students, filterClassId, filterSectionId]);

  const columns: StudentColumn[] = [
    { header: "Roll Number", accessorKey: "loginRollNumber" as const, sortable: true },
    { header: "Name", accessorKey: "name" as const, cell: (s) => <span className="font-medium text-brand-900">{s.name}</span> },
    { header: "Gender", accessorKey: "gender" as const },
    { header: "Year", accessorKey: "yearOfJoining" as const },
    { 
      header: "Actions", 
      cell: (s) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4 text-stone-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/institution/students/${s.id}`)}>
              <Eye className="h-4 w-4 mr-2" /> View Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditStudent(s)}>
              <Edit className="h-4 w-4 mr-2" /> Edit Student
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={() => setDeleteStudent(s)}>
              <Trash className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    try {
      const res = await api.post<CreateStudentResponse>("/api/institution/students", data);
      toast({ 
        title: "Student Created", 
        description: `Login ID generated: ${res.credentials?.loginRollNumber || 'Success'}`, 
        variant: "success" 
      });
      setIsCreateOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editStudent) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    try {
      await api.patch(`/api/institution/students/${editStudent.id}`, data);
      toast({ title: "Student Updated", variant: "success" });
      setEditStudent(null);
      router.refresh();
    } catch (err: unknown) {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteStudent) return;
    try {
      await api.delete(`/api/institution/students/${deleteStudent.id}`);
      toast({ title: "Student Deleted", variant: "success" });
      setDeleteStudent(null);
      router.refresh();
    } catch (err: unknown) {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
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
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2 bg-brand-800 hover:bg-brand-900 text-white">
            <Plus className="h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>

      <Card className="p-4 flex gap-4 flex-wrap bg-stone-50/50">
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-stone-500 uppercase">Filter by Class</label>
          <select 
            className="w-full h-10 rounded-md border border-border bg-white px-3 py-2 text-sm focus-ring"
            value={filterClassId}
            onChange={(e) => { setFilterClassId(e.target.value); setFilterSectionId(""); }}
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-stone-500 uppercase">Filter by Section</label>
          <select 
            className="w-full h-10 rounded-md border border-border bg-white px-3 py-2 text-sm focus-ring"
            value={filterSectionId}
            onChange={(e) => setFilterSectionId(e.target.value)}
            disabled={!filterClassId}
          >
            <option value="">All Sections</option>
            {mainFilteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <DataTable 
          data={tableData} 
          columns={columns} 
          searchKey="searchString" 
          searchPlaceholder="Search students by name or roll number..."
        />
      </Card>

      {/* CREATE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
                  {createFilteredSections.map(s => (
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

            <div className="space-y-1">
              <label className="text-sm font-medium">Phone Number</label>
              <Input name="phone" placeholder="Optional" />
            </div>
            
            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={isSubmitting} className="bg-brand-800 hover:bg-brand-900 text-white w-full">
                {isSubmitting ? "Creating Student..." : "Create Student"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={!!editStudent} onOpenChange={(open) => !open && setEditStudent(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          {editStudent && (
            <form onSubmit={handleEdit} className="space-y-4 mt-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Full Name</label>
                <Input name="name" defaultValue={editStudent.name} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Class</label>
                  <select name="classId" defaultValue={editStudent.classId} className="w-full h-10 rounded-md border border-border bg-white px-3 py-2 text-sm focus-ring">
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Section</label>
                  <select name="sectionId" defaultValue={editStudent.sectionId} className="w-full h-10 rounded-md border border-border bg-white px-3 py-2 text-sm focus-ring">
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Class Roll Number</label>
                <Input name="classRollNumber" defaultValue={editStudent.classRollNumber} required />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Phone</label>
                <Input name="phone" defaultValue={editStudent.phone || ''} />
              </div>
              
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={isSubmitting} className="bg-brand-800 hover:bg-brand-900 text-white w-full">
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={!!deleteStudent} onOpenChange={(open) => !open && setDeleteStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to permanently delete <strong>{deleteStudent?.name}</strong>?</p>
            <p className="text-sm text-red-600 mt-2">This action cannot be undone and will remove all their records, marks, and logins.</p>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setDeleteStudent(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Yes, Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
