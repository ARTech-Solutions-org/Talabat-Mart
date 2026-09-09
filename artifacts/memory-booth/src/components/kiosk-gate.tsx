import React, { useState } from 'react';
import { Camera, Sparkles, Lock, ArrowRight, ShieldCheck } from 'lucide-react';

interface KioskGateProps {
  onUnlock: () => void;
}

export const KioskGate: React.FC<KioskGateProps> = ({ onUnlock }) => {
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default master kiosk key
    if (pin === 'booth2026' || pin === '1234' || pin.toLowerCase() === 'admin') {
      localStorage.setItem('booth_authorized', 'true');
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1C0509] via-[#2A0810] to-[#120205] text-white flex flex-col items-center justify-between p-6 relative overflow-hidden font-sans select-none" dir="rtl">
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#FF5C00]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#FF9E00]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-md flex items-center justify-between z-10 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF5C00] to-[#FFA940] flex items-center justify-center shadow-lg shadow-[#FF5C00]/30">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide text-white leading-tight">AI Photobooth</h1>
            <p className="text-xs text-orange-200/60 font-medium">Memory Experience</p>
          </div>
        </div>

        <button
          onClick={() => setShowPinModal(true)}
          title="تفعيل الكشك"
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition-all text-xs flex items-center gap-1.5"
        >
          <Lock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">إعداد الكشك</span>
        </button>
      </header>

      {/* Main Center Card */}
      <main className="w-full max-w-md flex flex-col items-center text-center my-auto z-10 py-6">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/15 flex items-center justify-center shadow-2xl backdrop-blur-xl">
            <Sparkles className="w-12 h-12 text-[#FFA940] animate-pulse" />
          </div>
          <div className="absolute -bottom-2 -left-2 px-2.5 py-1 rounded-full bg-[#FF5C00] text-[10px] font-bold tracking-wider text-white shadow-md">
            BOOTH
          </div>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 tracking-tight leading-snug">
          أهلاً بك في كشك الذكريات
        </h2>
        
        <p className="text-sm sm:text-base text-white/75 leading-relaxed mb-8 max-w-xs sm:max-w-sm">
          هذه الشاشة مخصصة لتشغيل كشك التصوير. تفضل بزيارة الكشك لالتقاط صورتك وصناعة ذكرياتك الممتعة!
        </p>

        {/* Action Button to AR Camera */}
        <div className="w-full space-y-3">
          <a
            href="/ar"
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#FF5C00] to-[#FFA940] hover:from-[#FF6B1A] hover:to-[#FFB75E] text-white font-bold text-base shadow-xl shadow-[#FF5C00]/30 hover:shadow-[#FF5C00]/50 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <Sparkles className="w-5 h-5 text-yellow-100" />
            <span>فتح كاميرا الواقع المعزز (AR)</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </a>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-white/60 leading-normal text-right">
            💡 <strong className="text-white/80">هل لديك صورة مطبوعة؟</strong> اضغط على الزر أعلاه ووجّه كاميرا هاتفك نحو صورتك لتشاهدها تبرز وتتحول إلى مجسم ثلاثي الأبعاد!
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md text-center text-[11px] text-white/40 z-10 pb-2">
        AI Memory Photobooth &copy; {new Date().getFullYear()} &bull; جميع الحقوق محفوظة
      </footer>

      {/* PIN Unlock Modal for Booth Admin */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#24060C] border border-white/20 rounded-3xl p-6 text-center shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4 text-[#FFA940]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            
            <h3 className="text-lg font-bold text-white mb-1">تفعيل شاشة الكشك</h3>
            <p className="text-xs text-white/60 mb-5">أدخل رمز الإدارة لتفعيل هذا الجهاز كـ Photobooth</p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="أدخل الرمز السري (PIN)..."
                autoFocus
                className={`w-full px-4 py-3 rounded-xl bg-white/10 border ${
                  error ? 'border-red-500 bg-red-500/10' : 'border-white/20'
                } text-white placeholder:text-white/40 text-center font-mono text-lg focus:outline-none focus:border-[#FFA940] transition-colors`}
              />

              {error && (
                <p className="text-xs text-red-400">الرمز السري غير صحيح!</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#FF5C00] hover:bg-[#FF6B1A] text-white text-xs font-bold shadow-lg shadow-[#FF5C00]/30 transition-all"
                >
                  تأكيد ودخول
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
