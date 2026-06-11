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
              {/* Button 1: Customer Service Assistant (مساعد خدمة العملاء) */}
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-18 h-18 rounded-2xl bg-zinc-100 text-black hover:bg-zinc-200 transition-all flex items-center justify-center cursor-pointer border border-zinc-200/60 shadow-xs"
                onClick={() => navigateTo('/chat')}
                title="مساعد خدمة العملاء الذكي"
              >
                <MessageSquare className="w-7 h-7" />
              </motion.button>

              {/* Button 2: Merchant Platform (منصة التاجر) */}
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-18 h-18 rounded-2xl bg-zinc-900 text-white hover:bg-neutral-850 transition-all flex items-center justify-center cursor-pointer border border-zinc-800 shadow-md"
                onClick={() => navigateTo('/admin?tab=products')}
                title="منصة التاجر وإدارة الأجهزة والأسعار"
              >
                <ShoppingBag className="w-7 h-7" />
              </motion.button>

              {/* Button 3: Inspector / Supervisor (الإشراف) */}
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-18 h-18 rounded-2xl bg-zinc-100 text-zinc-900 hover:bg-neutral-200 transition-all flex items-center justify-center cursor-pointer border border-zinc-200 shadow-sm"
                onClick={() => navigateTo('/admin?tab=chats')}
                title="بوابة الرقابة والإشراف على المحادثات"
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
              {/* Premium Integrated Ticket/Barcode Frame */}
              <div className="bg-white p-4 border border-gray-200 rounded-2xl shrink-0 shadow-md relative mx-auto flex flex-col items-center gap-2">
                {/* Store Name Badge - acts as the header of the barcode ticket */}
                <div 
                  className="text-[9px] font-extrabold px-3 py-1 rounded-full text-white tracking-wide max-w-[140px] truncate block shadow-xs"
                  style={{ backgroundColor: settings?.botPrimaryColor || '#800020' }}
                >
                  {settings?.storeName || 'الأجهزة المنزلية'}
                </div>

                <div className="relative bg-white p-1 rounded-lg">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/chat')}&color=${(settings?.botPrimaryColor || '#800020').replace('#', '')}&bgcolor=ffffff&qzone=1`}
                    alt="Store Chatbot Barcode"
                    className="w-28 h-28 object-contain"
                  />
                  {/* Center branding badge tightly integrated as a native part of the QR code */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                    <div 
                      className="bg-white border-3 rounded-md w-[42px] h-[42px] flex flex-col items-center justify-center text-center px-0.5" 
                      style={{ borderColor: settings?.botPrimaryColor || '#800020' }}
                    >
                      <span 
                        className="text-[7.5px] font-black tracking-tighter uppercase leading-none text-center block max-w-full truncate px-0.5" 
                        style={{ color: settings?.botPrimaryColor || '#800020' }}
                      >
                        {settings?.storeName ? settings.storeName.split(' ')[0] : 'MAMO'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Simulated barcode serial ticket text */}
                <div className="w-full flex flex-col items-center gap-0.5 pt-1.5 border-t border-gray-100">
                  <div className="font-mono text-[8px] tracking-[0.25em] text-gray-400 font-extrabold select-none">
                    * MAMO-{settings?.storeName ? settings.storeName.split(' ')[0].toUpperCase() : 'CHAT'} *
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
