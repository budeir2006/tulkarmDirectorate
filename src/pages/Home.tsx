import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

interface School {
  id: number;
  name: string;
  has_submitted: number;
}

export default function Home() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/schools')
      .then((res) => res.json())
      .then((data) => {
        setSchools(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">متابعة المدارس</h1>
          <p className="text-slate-500 mt-2">يرجى اختيار مدرستك لتعبئة النموذج اليومي</p>
        </div>
        <Link 
          to="/admin/login" 
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200"
        >
          <ShieldCheck className="w-4 h-4" />
          لوحة المسؤول
        </Link>
      </header>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">المدرسة</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 w-48">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schools.map((school) => (
                <tr key={school.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link 
                      to={`/school/${school.id}`}
                      className="text-lg font-medium text-slate-800 hover:text-indigo-600 block"
                    >
                      {school.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {school.has_submitted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4" />
                        تم التعبئة
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                        <XCircle className="w-4 h-4" />
                        لم يتم التعبئة
                      </span>
                    )}
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
      )}
    </div>
  );
}
