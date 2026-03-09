import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Save, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function SchoolForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [school, setSchool] = useState<{ id: number; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    report_date: format(new Date(), 'yyyy-MM-dd'),
    attendance_type: 'وجاهي',
    executed_classes: '',
    executed_classes_online: '',
    executed_classes_offline: '',
    total_students: '',
    absent_students_offline: '',
    absent_students_online: '',
    total_teachers: '',
    core_teachers: '',
    absent_teachers: '',
    challenges_offline: '',
    challenges_online: '',
    challenges_blended: ''
  });

  useEffect(() => {
    fetch(`/api/schools/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.school) {
          setSchool(data.school);
          if (data.submission) {
            setFormData({
              report_date: data.submission.report_date || format(new Date(), 'yyyy-MM-dd'),
              attendance_type: data.submission.attendance_type || 'وجاهي',
              executed_classes: data.submission.executed_classes?.toString() || '',
              executed_classes_online: data.submission.executed_classes_online?.toString() || '',
              executed_classes_offline: data.submission.executed_classes_offline?.toString() || '',
              total_students: data.submission.total_students?.toString() || '',
              absent_students_offline: data.submission.absent_students_offline?.toString() || '',
              absent_students_online: data.submission.absent_students_online?.toString() || '',
              total_teachers: data.submission.total_teachers?.toString() || '',
              core_teachers: data.submission.core_teachers?.toString() || '',
              absent_teachers: data.submission.absent_teachers?.toString() || '',
              challenges_offline: data.submission.challenges_offline || '',
              challenges_online: data.submission.challenges_online || '',
              challenges_blended: data.submission.challenges_blended || ''
            });
          }
        }
        setLoading(false);
      });
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const res = await fetch(`/api/schools/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_date: formData.report_date,
          attendance_type: formData.attendance_type,
          executed_classes: parseInt(formData.executed_classes) || 0,
          executed_classes_online: parseInt(formData.executed_classes_online) || 0,
          executed_classes_offline: parseInt(formData.executed_classes_offline) || 0,
          total_students: parseInt(formData.total_students) || 0,
          absent_students_offline: parseInt(formData.absent_students_offline) || 0,
          absent_students_online: parseInt(formData.absent_students_online) || 0,
          total_teachers: parseInt(formData.total_teachers) || 0,
          core_teachers: parseInt(formData.core_teachers) || 0,
          absent_teachers: parseInt(formData.absent_teachers) || 0,
          challenges_offline: formData.challenges_offline,
          challenges_online: formData.challenges_online,
          challenges_blended: formData.challenges_blended
        })
      });
      
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/'), 2000);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!school) {
    return <div className="p-12 text-center text-red-500">المدرسة غير موجودة</div>;
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto mt-24 p-8 bg-white rounded-3xl shadow-sm border border-emerald-100 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">تم الحفظ بنجاح!</h2>
        <p className="text-slate-500 mb-8">شكراً لك، تم استلام بيانات {school.name}.</p>
        <p className="text-sm text-slate-400">جاري العودة للصفحة الرئيسية...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 pb-24">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-8 transition-colors">
        <ArrowRight className="w-4 h-4" />
        العودة للقائمة
      </Link>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-6">
          <h1 className="text-2xl font-bold text-slate-800">{school.name}</h1>
          <p className="text-slate-500 mt-1">نموذج المتابعة اليومي</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          {/* القسم الأساسي */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">البيانات الأساسية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">اليوم والتاريخ</label>
                <input
                  type="date"
                  name="report_date"
                  required
                  value={formData.report_date}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">طبيعة الدوام</label>
                <select
                  name="attendance_type"
                  value={formData.attendance_type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
                >
                  <option value="وجاهي">وجاهي</option>
                  <option value="إلكتروني">إلكتروني</option>
                  <option value="مدمج">مدمج</option>
                </select>
              </div>
            </div>
          </div>

          {/* قسم الحصص */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">الحصص المنفذة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formData.attendance_type === 'مدمج' ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">عدد الحصص الإلكترونية</label>
                    <input
                      type="number"
                      name="executed_classes_online"
                      required
                      min="0"
                      value={formData.executed_classes_online}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">عدد الحصص الوجاهية</label>
                    <input
                      type="number"
                      name="executed_classes_offline"
                      required
                      min="0"
                      value={formData.executed_classes_offline}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">عدد الحصص المنفذة</label>
                  <input
                    type="number"
                    name="executed_classes"
                    required
                    min="0"
                    value={formData.executed_classes}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>
              )}
            </div>
          </div>

          {/* قسم الطلاب */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">بيانات الطلبة</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">عدد طلاب المدرسة</label>
                <input
                  type="number"
                  name="total_students"
                  required
                  min="0"
                  value={formData.total_students}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">الطلاب الغائبين (وجاهي)</label>
                <input
                  type="number"
                  name="absent_students_offline"
                  required
                  min="0"
                  value={formData.absent_students_offline}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">الطلاب الغائبين (إلكتروني)</label>
                <input
                  type="number"
                  name="absent_students_online"
                  required
                  min="0"
                  value={formData.absent_students_online}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* قسم المعلمين */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">بيانات المعلمين</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">عدد معلمي المدرسة</label>
                <input
                  type="number"
                  name="total_teachers"
                  required
                  min="0"
                  value={formData.total_teachers}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">معلمي المواد الأساسية</label>
                <input
                  type="number"
                  name="core_teachers"
                  required
                  min="0"
                  value={formData.core_teachers}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">المعلمين الغائبين</label>
                <input
                  type="number"
                  name="absent_teachers"
                  required
                  min="0"
                  value={formData.absent_teachers}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* قسم التحديات */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">الصعوبات والتحديات</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">أبرز الصعوبات التي تواجه التعليم الوجاهي</label>
                <textarea
                  name="challenges_offline"
                  rows={2}
                  value={formData.challenges_offline}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">أبرز الصعوبات التي تواجه التعليم الإلكتروني</label>
                <textarea
                  name="challenges_online"
                  rows={2}
                  value={formData.challenges_online}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">أبرز الصعوبات التي تواجه التعليم المدمج</label>
                <textarea
                  name="challenges_blended"
                  rows={2}
                  value={formData.challenges_blended}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-4 px-8 rounded-xl transition-colors disabled:opacity-70"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  حفظ البيانات
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
