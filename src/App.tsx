import React, { useState, useEffect } from 'react';
import ChatPage from './components/ChatPage';
import AdminPage from './components/AdminPage';
import { MessageSquare, ShieldAlert, Sparkles, ShoppingBag, QrCode } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [settings, setSettings] = useState<any>(null);
  const [loadingPage, setLoadingPage] = useState(false);

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'store');
    const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data());
      }
    }, (error) => {
      console.warn("Could not load settings on Portal Home:", error);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      setLoadingPage(true);
      const timer = setTimeout(() => {
        setCurrentPath(window.location.pathname);
        setLoadingPage(false);
      }, 550); // beautiful seamless 550ms spinner transition
      return () => clearTimeout(timer);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('locationchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('locationchange', handleLocationChange);
    };
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('locationchange'));
  };

  return (
    <div className="relative min-h-screen">
      {/* Premium Loader Overlay */}
      {loadingPage && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-xs z-[9999] flex flex-col items-center justify-center transition-all duration-350" dir="rtl">
          <div className="relative flex items-center justify-center">
            {/* Smooth dynamic dual border spinner tuned to store theme colors */}
            <div 
              className="w-14 h-14 rounded-full border-4 border-gray-100 animate-spin"
              style={{ borderTopColor: settings?.botPrimaryColor || '#800020' }}
            />
            <div className="absolute">
              <Sparkles className="w-5 h-5 animate-pulse" style={{ color: settings?.botPrimaryColor || '#800020' }} />
            </div>
          </div>
          <p className="mt-4 text-xs font-bold text-gray-600 tracking-wide animate-pulse font-sans">
            يرجى الانتظار، جاري تحميل الصفحة...
          </p>
        </div>
      )}

      {/* Pages Switcher Layout */}
      {currentPath === '/admin' ? (
        <div className="relative">
          <AdminPage />
          {/* Floating return-to-chat button exclusively for preview testing convenience */}
          <div className="fixed bottom-4 left-4 z-50">
            <button
              onClick={() => navigateTo('/chat')}
              className="px-3 py-1.5 bg-black text-white rounded text-xs font-bold shadow hover:bg-neutral-900 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>عرض شات العميل</span>
            </button>
          </div>
        </div>
      ) : currentPath === '/chat' ? (
        <ChatPage />
      ) : (
        /* Default: Elegantly styled Arabic portal landing page */
        <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12 font-sans selection:bg-neutral-100" dir="rtl">
          <div className="max-w-xl w-full text-center space-y-8">
            
            {/* Brand visual header */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="inline-flex w-10 h-10 bg-black rounded items-center justify-center mx-auto shadow-sm">
                <div className="w-5 h-5 border-2 border-white"></div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">بوابة إدارة والرد الذكي للشركة</h1>
              <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                تطبيق متكامل وبسيط مدعوم بالذكاء الاصطناعي لمتابعة وتحديث مخزون الأواني والأجهزة الكهربائية في الوقت الفعلي.
              </p>
            </motion.div>

            {/* Path Selection Cards - Simplified to beautiful, text-free premium icon buttons */}
            <div className="flex items-center justify-center gap-6 pt-2">
              {/* Button 1: Chat Client */}
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-18 h-18 rounded-2xl bg-zinc-100 text-black hover:bg-zinc-200 transition-all flex items-center justify-center cursor-pointer border border-zinc-200/60 shadow-xs"
                onClick={() => navigateTo('/chat')}
                title="مساعد خدمة العملاء الذكي (الشات)"
              >
                <MessageSquare className="w-7 h-7" />
              </motion.button>

              {/* Button 2: Admin Dashboard */}
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-18 h-18 rounded-2xl bg-black text-white hover:bg-neutral-900 transition-all flex items-center justify-center cursor-pointer shadow-md"
                onClick={() => navigateTo('/admin')}
                title="لوحة الإشراف ومنصة التاجر"
              >
                <ShieldAlert className="w-7 h-7" />
              </motion.button>
            </div>

            {/* Dynamic QR Code Card - Simplified as requested */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="p-6 border border-gray-150 rounded-xl bg-neutral-50/50 flex flex-col md:flex-row items-center gap-6 justify-center md:text-right shadow-sm"
            >
              <div className="bg-white p-3 border border-gray-200 rounded-lg shrink-0 shadow-inner relative mx-auto">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/chat')}&color=${(settings?.botPrimaryColor || '#800020').replace('#', '')}&bgcolor=ffffff&qzone=1`}
                  alt="Store Chatbot Barcode"
                  className="w-28 h-28 object-contain"
                />
                {/* Center branding badge with store name inside */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div 
                    className="bg-white border rounded px-1.5 py-0.5 shadow-md flex items-center justify-center select-none max-w-[58px] overflow-hidden" 
                    style={{ borderColor: settings?.botPrimaryColor || '#800020' }}
                  >
                    <span 
                      className="text-[7px] font-extrabold tracking-tight truncate leading-none text-center block w-full" 
                      style={{ color: settings?.botPrimaryColor || '#800020' }}
                    >
                      {settings?.storeName ? settings.storeName.split(' ')[0] : 'مامو'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-3 flex-1 text-center md:text-right">
                <h3 className="text-base font-extrabold text-gray-900 font-sans leading-snug">
                  امسح الباركود لتجربة الشات على هاتفك فوراً
                </h3>
                <div className="pt-1 flex justify-center md:justify-start">
                  <button
                    onClick={() => navigateTo('/chat')}
                    className="text-xs font-extrabold text-white px-4.5 py-3 rounded-xl transition-all hover:opacity-95 flex items-center gap-2 inline-flex cursor-pointer font-sans shadow-xs active:scale-95 animate-none"
                    style={{ backgroundColor: settings?.botPrimaryColor || '#800020' }}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>فتح صفحة الشات بشكل مباشر</span>
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Small hint footer */}
            <div className="text-[11px] text-gray-400 font-medium">
              تم تصميمه بالكامل بأسلوب البساطة النظيفة ودعم فوري لقواعد بيانات Firebase.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
