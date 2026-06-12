import React, { useState, useEffect } from 'react';
import ChatPage from './components/ChatPage';
import AdminPage from './components/AdminPage';
import { MessageSquare, ShieldAlert, Sparkles, ShoppingBag, QrCode, Download, Tv, Home, Share2, Check, Facebook, Instagram } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const hexToRgb = (hex: string): string => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 128;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 32;
  return `${r}, ${g}, ${b}`;
};

const getCleanQrName = (storeName?: string) => {
  if (!storeName) return 'MAMO';
  // Remove company, store and other commercial designation words
  const clean = storeName
    .replace(/(شركة|متجر|معرض|صالة|مؤسسة|محلات|محل|مركز|وكالة|جروب|مجموعة)\s+/gi, '')
    .trim();
  if (!clean) return 'MAMO';
  const word = clean.split(' ')[0];
  if (/(شركة|متجر|معرض|صالة|مؤسسة|محلات|محل|مركز|وكالة|جروب|مجموعة)/.test(word)) {
    return 'MAMO';
  }
  return word ? word.substring(0, 10).toUpperCase() : 'MAMO';
};

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [settings, setSettings] = useState<any>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [copied, setCopied] = useState(false);

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

            {/* Path Selection Cards - Beautifully paired with bold explicit Arabic labels below each button */}
            <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-2">
              {/* Button 1: Customer Service Assistant */}
              <div className="flex flex-col items-center gap-2">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-zinc-100 text-black hover:bg-zinc-200 transition-all flex items-center justify-center cursor-pointer border border-zinc-200/60 shadow-xs"
                  onClick={() => navigateTo('/chat')}
                  title="مساعد خدمة العملاء الذكي"
                >
                  <MessageSquare className="w-7 h-7" />
                </motion.button>
                <span className="text-[11px] sm:text-xs font-extrabold text-neutral-800 tracking-tight leading-none">مساعد العملاء</span>
              </div>

              {/* Button 2: Merchant Platform */}
              <div className="flex flex-col items-center gap-2">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-zinc-900 text-white hover:bg-neutral-850 transition-all flex items-center justify-center cursor-pointer border border-zinc-800 shadow-md"
                  onClick={() => navigateTo('/admin?tab=products')}
                  title="منصة التاجر وإدارة الأجهزة والأسعار"
                >
                  <ShoppingBag className="w-7 h-7" />
                </motion.button>
                <span className="text-[11px] sm:text-xs font-extrabold text-neutral-800 tracking-tight leading-none">لوحة التحكم</span>
              </div>

              {/* Button 3: Inspector / Supervisor */}
              <div className="flex flex-col items-center gap-2">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-18 h-18 rounded-2xl bg-zinc-100 text-zinc-900 hover:bg-neutral-200 transition-all flex items-center justify-center cursor-pointer border border-zinc-200 shadow-sm"
                  onClick={() => navigateTo('/admin?tab=chats')}
                  title="بوابة الرقابة والإشراف على المحادثات"
                >
                  <ShieldAlert className="w-7 h-7" />
                </motion.button>
                <span className="text-[11px] sm:text-xs font-extrabold text-neutral-800 tracking-tight leading-none">إشراف المحادثات</span>
              </div>
            </div>

            {/* Dynamic QR Code Card - Simplified as requested */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="p-6 border border-gray-150 rounded-xl bg-neutral-50/50 flex flex-col md:flex-row items-center gap-6 justify-center md:text-right shadow-sm"
            >
              {/* Premium Integrated Ticket/Barcode Frame */}
              <motion.div 
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: `0 15px 35px rgba(${hexToRgb(settings?.botPrimaryColor || '#800020')}, 0.25)`,
                  borderColor: settings?.botPrimaryColor || '#800020'
                }}
                transition={{ type: 'spring', stiffness: 350, damping: 15 }}
                className="bg-white p-4.5 border border-gray-200 rounded-2xl shrink-0 shadow-md relative mx-auto flex flex-col items-center gap-2.5 transition-all cursor-pointer group select-none"
              >
                {/* Store Name Badge & Category Icon - acts as the header of the barcode ticket */}
                <div className="flex flex-col items-center gap-1">
                  <div 
                    className="text-[9px] font-extrabold px-3 py-1 rounded-full text-white tracking-wide max-w-[140px] truncate flex items-center justify-center gap-1 shadow-xs"
                    style={{ backgroundColor: settings?.botPrimaryColor || '#800020' }}
                  >
                    <Tv className="w-2.5 h-2.5 shrink-0" />
                    <span>{settings?.storeName || 'شركة مأمو'}</span>
                  </div>
                  <span className="text-[8px] text-gray-400 font-extrabold tracking-wider select-none">معرض ومبيع الأجهزة الكهربائية والذكية</span>
                </div>

                <div className="relative bg-white p-1 rounded-lg">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/chat')}&color=${(settings?.botPrimaryColor || '#800020').replace('#', '')}&bgcolor=ffffff&qzone=1`}
                    alt="Store Chatbot Barcode"
                    className="w-28 h-28 object-contain"
                  />
                  {/* Center branding badge tightly integrated as a native part of the QR code (no curves, zero outer borders, blended as blocks) */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                    <div 
                      className="bg-white w-[50px] h-[34px] flex flex-col items-center justify-center text-center px-0.5 border-0 shadow-none" 
                    >
                      <span 
                        className="text-[10px] font-mono font-black tracking-widest uppercase leading-none text-center block max-w-full truncate" 
                        style={{ color: settings?.botPrimaryColor || '#800020' }}
                      >
                        {getCleanQrName(settings?.storeName)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Simulated barcode serial ticket text */}
                <div className="w-full flex flex-col items-center gap-0.5 pt-1.5 border-t border-gray-100">
                  <div className="font-mono text-[8px] tracking-[0.25em] text-gray-400 font-extrabold select-none">
                    * MAMO-{getCleanQrName(settings?.storeName)} *
                  </div>
                </div>

                {/* Action buttons under the QR ticket */}
                <div className="flex flex-col sm:flex-row gap-1.5 w-full mt-1.5 justify-center items-center z-10">
                  {/* Direct High-Quality PNG download option for business cards */}
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(window.location.origin + '/chat')}&color=${(settings?.botPrimaryColor || '#800020').replace('#', '')}&bgcolor=ffffff&qzone=1`;
                        const res = await fetch(qrUrl);
                        const blob = await res.blob();
                        const blobUrl = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = `qr-code-${getCleanQrName(settings?.storeName).toLowerCase()}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(blobUrl);
                      } catch (err) {
                        const directUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(window.location.origin + '/chat')}&color=${(settings?.botPrimaryColor || '#800020').replace('#', '')}&bgcolor=ffffff&qzone=1`;
                        window.open(directUrl, '_blank');
                      }
                    }}
                    className="px-2 py-1.5 bg-neutral-50 hover:bg-neutral-105 border border-neutral-200 text-[9.5px] text-neutral-700 font-extrabold rounded-lg flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap"
                    title="تحميل كصورة عالية الدقة لطباعتها على بطاقة العمل أو المطبوعات والتصاميم"
                  >
                    <Download className="w-3 h-3 text-indigo-600 shrink-0" />
                    <span>تحميل للطباعة 🧾</span>
                  </button>

                  {/* Share/Copy link button for easy messaging */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const chatUrl = `${window.location.origin}/chat`;
                      navigator.clipboard.writeText(chatUrl).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className="px-2 py-1.5 bg-neutral-50 hover:bg-neutral-105 border border-neutral-200 text-[9.5px] text-neutral-700 font-extrabold rounded-lg flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-2xs whitespace-nowrap"
                    title="مشاركة ونسخ رابط الشات المباشر"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700">تم النسخ! ✨</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span>مشاركة الرابط 🔗</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>

              <div className="space-y-3.5 flex-1 text-center md:text-right">
                {/* Store category with a visual representation icon */}
                <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-xl text-[11px] font-extrabold select-none mb-1 shadow-2xs">
                  <Tv className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>معرض وتجارة الأجهزة الكهربائية والمنزلية والذكية</span>
                </div>

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

            {/* Social Media & Official Platforms Footer */}
            <div className="pt-6 border-t border-gray-100 flex flex-col items-center gap-4">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider select-none">
                تابع قنواتنا ومنصاتنا الرسمية
              </span>
              <div className="flex justify-center items-center gap-3">
                {/* Facebook Button */}
                <a
                  href={settings?.facebookUrl || 'https://facebook.com/mamo_store'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-neutral-50 hover:bg-neutral-100 border border-gray-200 flex items-center justify-center text-[#1877F2] transition-all hover:scale-110 active:scale-95 shadow-2xs cursor-pointer"
                  title="صفحتنا على فيسبوك"
                >
                  <Facebook className="w-4 h-4" />
                </a>

                {/* Instagram Button */}
                <a
                  href={settings?.instagramUrl || 'https://instagram.com/mamo_store'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-neutral-50 hover:bg-neutral-100 border border-gray-200 flex items-center justify-center text-[#E4405F] transition-all hover:scale-110 active:scale-95 shadow-2xs cursor-pointer"
                  title="حسابنا على إنستغرام"
                >
                  <Instagram className="w-4 h-4" />
                </a>

                {/* WhatsApp Button */}
                <a
                  href={`https://wa.me/${settings?.whatsapp || '966500000000'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-neutral-50 hover:bg-neutral-100 border border-gray-200 flex items-center justify-center text-[#25D366] transition-all hover:scale-110 active:scale-95 shadow-2xs font-bold text-xs cursor-pointer"
                  title="تواصل معنا عبر واتساب"
                >
                  <span>W</span>
                </a>
              </div>
              
              <div className="text-[10px] text-gray-400 font-bold select-none">
                © جميع الحقوق محفوظة لـ {settings?.storeName || 'شركة مأمو للأجهزة الكهربائية والمنزلية والذكية'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
