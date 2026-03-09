import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Trash2, Edit2, BarChart3, Settings, Users, BookOpen, Building2, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface School {
  id: number;
  name: string;
  has_submitted: number;
}

interface Stats {
  total_schools: number;
  submitted_schools: number;
  commitment_percentage: number;
  student_attendance_percentage: number;
  teacher_attendance_percentage: number;
  total_students: number;
  total_teachers: number;
  total_classes: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'schools' | 'reports'>('reports');
  const [schools, setSchools] = useState<School[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [editingSchool, setEditingSchool] = useState<{ id: number; name: string } | null>(null);
  const infographicRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schoolsRes, statsRes] = await Promise.all([
        fetch('/api/schools'),
        fetch('/api/admin/stats')
      ]);
      const schoolsData = await schoolsRes.json();
      const statsData = await statsRes.json();
      setSchools(schoolsData);
      setStats(statsData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/');
  };

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;
    
    try {
      const res = await fetch('/api/admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSchoolName })
      });
      if (res.ok) {
        setNewSchoolName('');
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteSchool = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المدرسة؟')) return;
    try {
      const res = await fetch(`/api/admin/schools/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool || !editingSchool.name.trim()) return;
    
    try {
      const res = await fetch(`/api/admin/schools/${editingSchool.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingSchool.name })
      });
      if (res.ok) {
        setEditingSchool(null);
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        // Assuming school names are in the first column
        const schoolNames = data.map((row: any) => row[0]).filter(Boolean);
        
        if (schoolNames.length > 0) {
          const res = await fetch('/api/admin/schools/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schools: schoolNames })
          });
          if (res.ok) {
            alert('تم استيراد المدارس بنجاح');
            fetchData();
          }
        }
      } catch (error) {
        console.error('Error importing file:', error);
        alert('حدث خطأ أثناء استيراد الملف');
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    if (e.target) e.target.value = '';
  };

  const exportToPDF = async () => {
    if (!infographicRef.current) return;
    try {
      const canvas = await html2canvas(infographicRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`تقرير_الدوام_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const exportToExcel = () => {
    if (!stats) return;
    
    const data = [
      ['تقرير الدوام اليومي وحالة الدوام'],
      ['اليوم والتاريخ', format(new Date(), 'yyyy-MM-dd')],
      [],
      ['المؤشر', 'القيمة'],
      ['إجمالي المدارس', stats.total_schools],
      ['المدارس الملتزمة بالتعبئة', stats.submitted_schools],
      ['نسبة الالتزام بالتعبئة (%)', stats.commitment_percentage],
      ['إجمالي المعلمين', stats.total_teachers],
      ['نسبة التزام المعلمين (%)', stats.teacher_attendance_percentage],
      ['إجمالي الطلبة', stats.total_students],
      ['نسبة حضور الطلبة (%)', stats.student_attendance_percentage],
      ['إجمالي الحصص المنفذة', stats.total_classes]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
    XLSX.writeFile(wb, `تقرير_الدوام_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
            <Settings className="w-5 h-5 text-indigo-600" />
            لوحة تحكم المسؤول
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'reports' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            التقارير والإنفوغرافيك
          </button>
          <button
            onClick={() => setActiveTab('schools')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'schools' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            إدارة المدارس
          </button>
        </div>

        {activeTab === 'reports' && stats && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-end gap-4">
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                تصدير إكسل
              </button>
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                تصدير PDF
              </button>
            </div>

            <div 
              ref={infographicRef}
              className="bg-white rounded-3xl p-10 shadow-sm border border-slate-200 relative overflow-hidden"
            >
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-50"></div>
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-50 rounded-full -ml-40 -mb-40 opacity-50"></div>
              
              <div className="relative z-10">
                <div className="text-center mb-12 border-b border-slate-100 pb-8">
                  <h1 className="text-3xl font-bold text-slate-800 mb-3">مديرية التربية والتعليم / طولكرم</h1>
                  <h2 className="text-xl font-semibold text-indigo-600 mb-2">تقرير الدوام اليومي وحالة الدوام</h2>
                  <p className="text-slate-500 font-medium">{format(new Date(), 'yyyy/MM/dd')}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Commitment */}
                  <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white shadow-md transform hover:scale-105 transition-transform">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-indigo-100 font-medium">نسبة الالتزام بالتعبئة</h3>
                      <CheckCircle2 className="w-6 h-6 text-indigo-200" />
                    </div>
                    <div className="text-4xl font-bold">{stats.commitment_percentage}%</div>
                    <div className="text-sm text-indigo-200 mt-2">
                      {stats.submitted_schools} من أصل {stats.total_schools} مدرسة
                    </div>
                  </div>

                  {/* Student Attendance */}
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-md transform hover:scale-105 transition-transform">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-emerald-100 font-medium">نسبة حضور الطلبة</h3>
                      <Users className="w-6 h-6 text-emerald-200" />
                    </div>
                    <div className="text-4xl font-bold">{stats.student_attendance_percentage}%</div>
                    <div className="text-sm text-emerald-200 mt-2">
                      إجمالي الطلبة: {stats.total_students.toLocaleString()}
                    </div>
                  </div>

                  {/* Teacher Attendance */}
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-md transform hover:scale-105 transition-transform">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-blue-100 font-medium">نسبة التزام المعلمين</h3>
                      <Users className="w-6 h-6 text-blue-200" />
                    </div>
                    <div className="text-4xl font-bold">{stats.teacher_attendance_percentage}%</div>
                    <div className="text-sm text-blue-200 mt-2">
                      إجمالي المعلمين: {stats.total_teachers.toLocaleString()}
                    </div>
                  </div>

                  {/* Total Classes */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-center items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                      <BookOpen className="w-6 h-6 text-amber-600" />
                    </div>
                    <h3 className="text-slate-500 font-medium mb-1">إجمالي الحصص المنفذة</h3>
                    <div className="text-3xl font-bold text-slate-800">{stats.total_classes.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schools' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                <h2 className="text-xl font-bold text-slate-800">إدارة المدارس</h2>
                
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer border border-emerald-200">
                    <Upload className="w-4 h-4" />
                    استيراد من إكسل
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      className="hidden" 
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>

              <form onSubmit={handleAddSchool} className="flex gap-4">
                <input
                  type="text"
                  required
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  placeholder="إضافة مدرسة جديدة يدوياً..."
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  إضافة
                </button>
              </form>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600">المدرسة</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 w-32">الحالة</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 w-32 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schools.map((school) => (
                    <tr key={school.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        {editingSchool?.id === school.id ? (
                          <form onSubmit={handleEditSchool} className="flex gap-2">
                            <input
                              type="text"
                              required
                              autoFocus
                              value={editingSchool.name}
                              onChange={(e) => setEditingSchool({ ...editingSchool, name: e.target.value })}
                              className="flex-1 px-3 py-1.5 rounded-lg border border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                            />
                            <button type="submit" className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-200">حفظ</button>
                            <button type="button" onClick={() => setEditingSchool(null)} className="text-sm bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-medium hover:bg-slate-200">إلغاء</button>
                          </form>
                        ) : (
                          <span className="text-slate-800 font-medium">{school.name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {school.has_submitted ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            تم التعبئة
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                            لم يتم التعبئة
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditingSchool(school)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="تعديل"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSchool(school.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {schools.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  لا توجد مدارس مضافة حالياً
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
