import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Save, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface Question {
  id: number;
  title: string;
  type: string;
  is_required: number;
  options: string | null;
}

export default function SchoolForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [school, setSchool] = useState<{ id: number; name: string } | null>(null);
  const [form, setForm] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/schools/${id}/form`)
      .then((res) => res.json())
      .then((data) => {
        if (data.school) {
          setSchool(data.school);
          setForm(data.form);
          setQuestions(data.questions || []);
          
          const initialAnswers: Record<number, string> = {};
          if (data.answers && data.answers.length > 0) {
            data.answers.forEach((a: any) => {
              initialAnswers[a.question_id] = a.answer_value;
            });
          } else {
            // Set defaults
            data.questions?.forEach((q: Question) => {
              if (q.type === 'date') initialAnswers[q.id] = format(new Date(), 'yyyy-MM-dd');
              else if (q.type === 'select') {
                const opts = q.options ? JSON.parse(q.options) : [];
                initialAnswers[q.id] = opts[0] || '';
              } else {
                initialAnswers[q.id] = '';
              }
            });
          }
          setAnswers(initialAnswers);
        }
        setLoading(false);
      });
  }, [id]);

  const handleChange = (questionId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    
    try {
      const res = await fetch(`/api/schools/${id}/form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_id: form.id,
          answers
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

  if (!form) {
    return <div className="p-12 text-center text-slate-500">لا يوجد نموذج نشط حالياً</div>;
  }

  // Check if form is active based on dates
  const now = new Date();
  const startTime = form.start_time ? new Date(form.start_time) : null;
  const endTime = form.end_time ? new Date(form.end_time) : null;
  
  if ((startTime && now < startTime) || (endTime && now > endTime)) {
    return (
      <div className="max-w-xl mx-auto mt-24 p-8 bg-white rounded-3xl shadow-sm border border-slate-200 text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">النموذج مغلق</h2>
        <p className="text-slate-500 mb-8">هذا النموذج غير متاح للردود في الوقت الحالي.</p>
        <Link to="/" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium">
          <ArrowRight className="w-4 h-4" />
          العودة للقائمة
        </Link>
      </div>
    );
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
          <p className="text-indigo-600 font-medium mt-2">{form.title}</p>
          {form.description && <p className="text-slate-500 mt-1 text-sm">{form.description}</p>}
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                {q.title} {q.is_required ? <span className="text-red-500">*</span> : ''}
              </label>
              
              {q.type === 'textarea' ? (
                <textarea
                  required={!!q.is_required}
                  value={answers[q.id] || ''}
                  onChange={(e) => handleChange(q.id, e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
                />
              ) : q.type === 'select' ? (
                <select
                  required={!!q.is_required}
                  value={answers[q.id] || ''}
                  onChange={(e) => handleChange(q.id, e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white"
                >
                  <option value="" disabled>اختر...</option>
                  {q.options && JSON.parse(q.options).map((opt: string, i: number) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={q.type}
                  required={!!q.is_required}
                  value={answers[q.id] || ''}
                  onChange={(e) => handleChange(q.id, e.target.value)}
                  min={q.type === 'number' ? '0' : undefined}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              )}
            </div>
          ))}

          <div className="pt-6 border-t border-slate-100">
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
                  إرسال الرد
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
