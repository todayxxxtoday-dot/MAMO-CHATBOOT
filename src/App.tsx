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
      setCurrentPath(window.location.pathname);
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

  // Route switcher
  if (currentPath === '/admin') {
    return (
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
    );
  }

  if (currentPath === '/chat') {
    return (
      <div className="relative">
        <ChatPage />
        {/* Floating access-admin button exclusively for preview testing convenience */}
        <div className="fixed bottom-24 left-4 z-50">
          <button
            onClick={() => navigateTo('/admin')}
            className="px-3 py-1.5 bg-white border border-gray-200 text-black rounded text-xs font-bold shadow hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-black" />
            <span>لوحة التاجر</span>
          </button>
        </div>
      </div>
    );
  }

  // default: Elegantly styled Arabic portal landing page
  return (
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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">بوابة إدارة والمتحدث الذكي للمتجر</h1>
          <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
            تطبيق متكامل وبسيط مدعوم بالذكاء الاصطناعي لمتابعة وتحديث مخزون الأواني والأجهزة الكهربائية في الوقت الفعلي.
          </p>
        </motion.div>

        {/* Path Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          
          {/* Card 1: Chat Client */}
          <motion.div 
            whileHover={{ y: -2 }}
            className="bg-white border border-gray-100 p-6 rounded text-right flex flex-col justify-between hover:border-gray-300 hover:shadow-xs transition-all cursor-pointer"
            onClick={() => navigateTo('/chat')}
          >
            <div className="space-y-2">
              <div className="w-8 h-8 bg-zinc-100 text-black rounded flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-gray-900">مساعد خدمة العملاء</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                افتح صفحة الشات للتواصل الفوري وطرح الأسئلة الذكية حول الأجهزة وأسعارها وتوفرها بالمتجر.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between text-xs font-bold text-black">
              <span>بدء المحادثة</span>
              <span className="font-mono text-[10px] bg-gray-50 px-2 py-0.5 rounded text-gray-500 font-medium" dir="ltr">/chat</span>
            </div>
          </motion.div>

          {/* Card 2: Admin Dashboard */}
          <motion.div 
            whileHover={{ y: -2 }}
            className="bg-white border border-gray-100 p-6 rounded text-right flex flex-col justify-between hover:border-gray-300 hover:shadow-xs transition-all cursor-pointer"
            onClick={() => navigateTo('/admin')}
          >
            <div className="space-y-2">
              <div className="w-8 h-8 bg-black text-white rounded flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-gray-900">منصة التاجر والإشراف</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                أضف المنتجات، عدّل الأسعار والمخزون، وراجع التقارير، وتصفح سجل محادثات العملاء وتصفيتها.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between text-xs font-bold text-black font-semibold">
              <span>إدارة المخزن والمبيعات</span>
              <span className="font-mono text-[10px] bg-gray-900 text-white px-2 py-0.5 rounded font-medium" dir="ltr">/admin</span>
            </div>
          </motion.div>
          
        </div>

        {/* Dynamic QR Code Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-6 border border-gray-150 rounded-xl bg-neutral-50/50 flex flex-col md:flex-row items-center gap-6 text-right shadow-sm"
        >
          <div className="bg-white p-3 border border-gray-200 rounded-lg shrink-0 shadow-inner relative">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/chat')}&color=${(settings?.botPrimaryColor || '#000000').replace('#', '')}&bgcolor=ffffff&qzone=1`}
              alt="Store Chatbot Barcode"
              className="w-28 h-28 object-contain"
            />
            {/* Mini core design color dot in center */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-4 h-4 bg-white border p-0.5 rounded shadow-xs" style={{ borderColor: settings?.botPrimaryColor || '#000000' }}>
                <div className="w-full h-full rounded-xs" style={{ backgroundColor: settings?.botPrimaryColor || '#000000' }} />
              </div>
            </div>
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-1.5 justify-center md:justify-start text-xs font-bold text-indigo-600">
              <QrCode className="w-4 h-4" />
              <span>الرمز السريع للشات (QR Code)</span>
            </div>
            <h3 className="text-sm font-bold text-gray-900 font-sans">امسح الباركود لتجربة الشات بوت فوراً على الهاتف</h3>
            <p className="text-xs text-gray-500 leading-relaxed font-sans">
              عند تصوير هذا الباركود بآلة تصوير الجوال، ستفتح لك نافذة المحادثة الذكية لـ <strong style={{ color: settings?.botPrimaryColor || '#000000' }}>{settings?.storeName ?? 'المتجر الذكي للأجهزة المنزلية'}</strong> مباشرة المخصصة للتصفح والاستفسار عن الأسعار دون الدخول إلى لوحة التحكم.
            </p>
            <div className="pt-1.5 flex justify-end md:justify-start">
              <button
                onClick={() => navigateTo('/chat')}
                className="text-[11px] font-bold text-white px-3.5 py-2 rounded transition-all hover:opacity-90 flex items-center gap-1.5 inline-flex cursor-pointer font-sans"
                style={{ backgroundColor: settings?.botPrimaryColor || '#000000' }}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>فتح صفحة الشات بوت المباشر</span>
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
  );
}
