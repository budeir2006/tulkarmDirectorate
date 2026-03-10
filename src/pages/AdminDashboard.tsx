import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Trash2, Edit2, BarChart3, Settings, Users, BookOpen, Building2, CheckCircle2, Download, FileSpreadsheet, Upload, FileEdit, Save, GripVertical } from 'lucide-react';
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
  form_title: string;
  total_schools: number;
  submitted_schools: number;
  commitment_percentage: number;
  number_stats: { title: string; sum: number }[];
  excel_data: any[];
}

interface Question {
  id?: number;
  title: string;
  type: string;
  is_required: boolean;
  options?: string[];
}

interface FormConfig {
  id?: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  questions: Question[];
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'reports' | 'schools' | 'form' | 'settings'>('reports');
  const [schools, setSchools] = useState<School[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [editingSchool, setEditingSchool] = useState<{ id: number; name: string } | null>(null);
  const infographicRef = useRef<HTMLDivElement>(null);

  // Form Builder State
  const [formConfig, setFormConfig] = useState<FormConfig>({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    questions: []
  });
  const [savingForm, setSavingForm] = useState(false);

  // Settings State
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [savingPassword, setSavingPassword] = useState(false);

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
      const [schoolsRes, statsRes, formRes] = await Promise.all([
        fetch('/api/schools'),
        fetch('/api/admin/stats'),
        fetch('/api/admin/form')
      ]);
      const schoolsData = await schoolsRes.json();
      const statsData = await statsRes.json();
      const formData = await formRes.json();
      
      setSchools(schoolsData);
      setStats(statsData);
      
      if (formData) {
        setFormConfig({
          id: formData.id,
          title: formData.title || '',
          description: formData.description || '',
          start_time: formData.start_time ? formData.start_time.substring(0, 16) : '',
          end_time: formData.end_time ? formData.end_time.substring(0, 16) : '',
          questions: formData.questions.map((q: any) => ({
            id: q.id,
            title: q.title,
            type: q.type,
            is_required: q.is_required === 1,
            options: q.options ? JSON.parse(q.options) : []
          }))
        });
      }
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

  // --- School Management ---
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
    if (e.target) e.target.value = '';
  };

  // --- Form Builder ---
  const addQuestion = () => {
    setFormConfig({
      ...formConfig,
      questions: [...formConfig.questions, { title: 'سؤال جديد', type: 'text', is_required: false }]
    });
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQs = [...formConfig.questions];
    newQs[index] = { ...newQs[index], [field]: value };
    setFormConfig({ ...formConfig, questions: newQs });
  };

  const removeQuestion = (index: number) => {
    const newQs = [...formConfig.questions];
    newQs.splice(index, 1);
    setFormConfig({ ...formConfig, questions: newQs });
  };

  const moveQuestion = (index: number, dir: number) => {
    if (index + dir < 0 || index + dir >= formConfig.questions.length) return;
    const newQs = [...formConfig.questions];
    const temp = newQs[index];
    newQs[index] = newQs[index + dir];
    newQs[index + dir] = temp;
    setFormConfig({ ...formConfig, questions: newQs });
  };

  const saveForm = async () => {
    setSavingForm(true);
    try {
      const res = await fetch('/api/admin/form', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formConfig)
      });
      if (res.ok) {
        alert('تم حفظ النموذج بنجاح');
        fetchData();
      }
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setSavingForm(false);
    }
  };

  // --- Settings ---
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'كلمة المرور الجديدة غير متطابقة' });
      return;
    }
    if (passwordForm.newPassword.length < 4) {
      setPasswordMessage({ type: 'error', text: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' });
      return;
    }

    setSavingPassword(true);
    setPasswordMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/admin/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMessage({ type: 'success', text: 'تم تحديث كلمة المرور بنجاح' });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordMessage({ type: 'error', text: data.error || 'حدث خطأ أثناء تحديث كلمة المرور' });
      }
    } catch (error) {
      setPasswordMessage({ type: 'error', text: 'حدث خطأ في الاتصال' });
    } finally {
      setSavingPassword(false);
    }
  };

  // --- Exports ---
  const exportToPDF = async () => {
    if (!infographicRef.current) return;
    try {
      const canvas = await html2canvas(infographicRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`تقرير_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const exportToExcel = () => {
    if (!stats || !stats.excel_data || stats.excel_data.length === 0) {
      alert('لا توجد بيانات للتصدير');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(stats.excel_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الردود');
    XLSX.writeFile(wb, `ردود_النموذج_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
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
        <div className="flex flex-wrap gap-4 mb-8">
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
            onClick={() => setActiveTab('form')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'form' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileEdit className="w-4 h-4" />
            إدارة النموذج (Forms)
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
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'settings' 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            الإعدادات
          </button>
        </div>

        {/* --- REPORTS TAB --- */}
        {activeTab === 'reports' && stats && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-end gap-4">
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                تصدير الردود (إكسل)
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
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-50"></div>
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-50 rounded-full -ml-40 -mb-40 opacity-50"></div>
              
              <div className="relative z-10">
                <div className="text-center mb-12 border-b border-slate-100 pb-8">
                  <h1 className="text-3xl font-bold text-slate-800 mb-3">مديرية التربية والتعليم / طولكرم</h1>
                  <h2 className="text-xl font-semibold text-indigo-600 mb-2">{stats.form_title || 'تقرير الدوام اليومي'}</h2>
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

                  {/* Dynamic Number Stats */}
                  {stats.number_stats.map((stat, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-center items-center text-center transform hover:scale-105 transition-transform">
                      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <BarChart3 className="w-6 h-6 text-slate-600" />
                      </div>
                      <h3 className="text-slate-500 font-medium mb-1">{stat.title}</h3>
                      <div className="text-3xl font-bold text-slate-800">{stat.sum.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- FORM BUILDER TAB --- */}
        {activeTab === 'form' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                <h2 className="text-2xl font-bold text-slate-800">إعدادات النموذج</h2>
                <button
                  onClick={saveForm}
                  disabled={savingForm}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-70"
                >
                  {savingForm ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Save className="w-5 h-5" />}
                  حفظ النموذج
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">عنوان النموذج</label>
                  <input
                    type="text"
                    value={formConfig.title}
                    onChange={(e) => setFormConfig({...formConfig, title: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">وصف النموذج (اختياري)</label>
                  <input
                    type="text"
                    value={formConfig.description}
                    onChange={(e) => setFormConfig({...formConfig, description: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">تاريخ ووقت البدء (اختياري)</label>
                  <input
                    type="datetime-local"
                    value={formConfig.start_time}
                    onChange={(e) => setFormConfig({...formConfig, start_time: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">تاريخ ووقت الانتهاء (اختياري)</label>
                  <input
                    type="datetime-local"
                    value={formConfig.end_time}
                    onChange={(e) => setFormConfig({...formConfig, end_time: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-slate-800">الأسئلة والحقول</h3>
                  <button
                    onClick={addQuestion}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة سؤال
                  </button>
                </div>

                {formConfig.questions.map((q, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative group">
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveQuestion(idx, -1)} className="p-1.5 bg-white rounded shadow-sm text-slate-400 hover:text-indigo-600" disabled={idx === 0}>↑</button>
                      <button onClick={() => moveQuestion(idx, 1)} className="p-1.5 bg-white rounded shadow-sm text-slate-400 hover:text-indigo-600" disabled={idx === formConfig.questions.length - 1}>↓</button>
                      <button onClick={() => removeQuestion(idx)} className="p-1.5 bg-white rounded shadow-sm text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-6 space-y-2">
                        <label className="block text-xs font-medium text-slate-500">نص السؤال</label>
                        <input
                          type="text"
                          value={q.title}
                          onChange={(e) => updateQuestion(idx, 'title', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div className="md:col-span-3 space-y-2">
                        <label className="block text-xs font-medium text-slate-500">نوع الإجابة</label>
                        <select
                          value={q.type}
                          onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none bg-white"
                        >
                          <option value="text">نص قصير</option>
                          <option value="textarea">نص طويل</option>
                          <option value="number">رقم (يظهر في الإحصائيات)</option>
                          <option value="date">تاريخ</option>
                          <option value="select">قائمة منسدلة</option>
                        </select>
                      </div>
                      <div className="md:col-span-3 flex items-center pt-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.is_required}
                            onChange={(e) => updateQuestion(idx, 'is_required', e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-slate-700">مطلوب (إجباري)</span>
                        </label>
                      </div>
                    </div>

                    {q.type === 'select' && (
                      <div className="mt-4 space-y-2">
                        <label className="block text-xs font-medium text-slate-500">الخيارات (مفصولة بفاصلة)</label>
                        <input
                          type="text"
                          value={q.options?.join('، ') || ''}
                          onChange={(e) => updateQuestion(idx, 'options', e.target.value.split('،').map(s => s.trim()).filter(Boolean))}
                          placeholder="مثال: وجاهي، إلكتروني، مدمج"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
                
                {formConfig.questions.length === 0 && (
                  <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-200 rounded-2xl">
                    لا توجد أسئلة في هذا النموذج. اضغط على "إضافة سؤال" للبدء.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- SCHOOLS TAB --- */}
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

        {/* --- SETTINGS TAB --- */}
        {activeTab === 'settings' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 max-w-2xl">
              <div className="mb-8 border-b border-slate-100 pb-6">
                <h2 className="text-2xl font-bold text-slate-800">إعدادات الحساب</h2>
                <p className="text-slate-500 mt-2">تغيير كلمة المرور الخاصة بلوحة المسؤول</p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-6">
                {passwordMessage.text && (
                  <div className={`p-4 rounded-xl text-sm font-medium ${
                    passwordMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {passwordMessage.text}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">كلمة المرور الحالية</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">تأكيد كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-70"
                  >
                    {savingPassword ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Save className="w-5 h-5" />}
                    حفظ كلمة المرور
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
