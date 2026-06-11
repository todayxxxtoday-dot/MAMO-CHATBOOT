import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, arrayUnion, updateDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { Message, Conversation } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, AlertCircle, AlertTriangle, Bug, MapPin, Phone, MessageCircle, Mail, Trash2, Archive } from 'lucide-react';

function TypewriterText({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let index = 0;
    setDisplayedText('');
    
    // Smooth character typing loop with multi-byte safety
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 11);
    
    return () => clearInterval(interval);
  }, [text]);

  return <span>{displayedText}</span>;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [custNum] = useState(() => Math.floor(Math.random() * 899 + 100));
  const [customerId, setCustomerId] = useState<string>(() => {
    return localStorage.getItem('mamu_customer_name') || '';
  });
  const [isCollectingName, setIsCollectingName] = useState<boolean>(() => {
    return !localStorage.getItem('mamu_customer_name');
  });
  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // States for reporting bugs/errors to WhatsApp 0938850783
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugType, setBugType] = useState('بطء في استجابة المساعد الذكي');
  const [bugDetails, setBugDetails] = useState('');

  const getGreeting = (name?: string, currentSettings?: any) => {
    const bType = currentSettings?.businessType || 'شركة';
    const sName = currentSettings?.storeName || 'الأجهزة المنزلية والكهربائية';
    const activeName = name || localStorage.getItem('mamu_customer_name');
    if (activeName && !activeName.startsWith('عميل #')) {
      return `أهلاً ومرحباً بكم مجدداً يا ${activeName} في ${bType === 'شركة' ? 'شركة' : 'متجر'} ${sName}. يسعدنا الرد على استفساراتكم ومساعدتكم في تصفح الأجهزة المتوفرة وأسعارها الآن. كيف يمكنني مساعدتكم اليوم؟`;
    }
    return `أهلاً وسهلاً بكم في ${bType === 'شركة' ? 'شركة' : 'متجر'} ${sName} للأجهزة المنزلية والكهربائية. يسعدنا الرد على استفساراتكم ومساعدتكم في تصفح الأجهزة المتوفرة وأسعارها المتجددة الآن. قبل أن نبدأ، هل تفضلتم بكتابة اسمكم الكريم لنتمكن من مناداتكم به ومساعدتكم بشكل مخصص ومنظم؟`;
  };

  // Listen to Settings from Firestore
  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'store');
    const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings(data);
        setMessages((prev) => {
          if (prev.length === 0) {
            const savedName = localStorage.getItem('mamu_customer_name') || '';
            return [{
              sender: 'bot',
              text: data.botWelcomeMessage || getGreeting(savedName, data),
              timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            }];
          }
          return prev;
        });
      } else {
        setMessages((prev) => {
          if (prev.length === 0) {
            const savedName = localStorage.getItem('mamu_customer_name') || '';
            return [{
              sender: 'bot',
              text: getGreeting(savedName, null),
              timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            }];
          }
          return prev;
        });
      }
      setLoadingSettings(false);
    }, (error) => {
      console.warn("Could not load settings on ChatPage:", error);
      setLoadingSettings(false);
      setMessages((prev) => {
        if (prev.length === 0) {
          const savedName = localStorage.getItem('mamu_customer_name') || '';
          return [{
            sender: 'bot',
            text: getGreeting(savedName, null),
            timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          }];
        }
        return prev;
      });
    });

    return unsubscribe;
  }, []);

  const resetSession = (customGreeting?: string) => {
    const randomId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const uniqueConvId = `CH-${Date.now().toString().slice(-6)}-${randomId}`;
    
    setConversationId(uniqueConvId);
    
    const savedName = localStorage.getItem('mamu_customer_name');
    if (savedName) {
      setCustomerId(savedName);
      setIsCollectingName(false);
    } else {
      setCustomerId(`عميل #${custNum}`);
      setIsCollectingName(true);
    }
    
    // Clear messages and set default greeting
    setMessages([{
      sender: 'bot',
      text: customGreeting || settings?.botWelcomeMessage || getGreeting(savedName || undefined, settings),
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    }]);
  };

  // Initialize unique IDs for this visitor session
  useEffect(() => {
    const randomId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const uniqueConvId = `CH-${Date.now().toString().slice(-6)}-${randomId}`;
    setConversationId(uniqueConvId);
    
    const savedName = localStorage.getItem('mamu_customer_name');
    if (savedName) {
      setCustomerId(savedName);
      setIsCollectingName(false);
    } else {
      setCustomerId(`عميل #${custNum}`);
      setIsCollectingName(true);
    }
  }, [custNum]);

  // Monitor if the active conversation is deleted from Firestore (e.g., deleted by the merchant in the Admin Panel)
  // If it gets deleted and the chat client has active messages, we silently renew the conversation ID.
  // This prevents the chat client from re-creating or resurrecting the deleted conversation document.
  useEffect(() => {
    if (!conversationId) return;
    
    const docRef = doc(db, 'conversations', conversationId);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (!snapshot.exists() && messages.length > 1) {
        // Assign a brand-new ID for any future operations in this tab
        const randomId = Math.random().toString(36).substring(2, 10).toUpperCase();
        const uniqueConvId = `CH-${Date.now().toString().slice(-6)}-${randomId}`;
        setConversationId(uniqueConvId);
      }
    });

    return unsubscribe;
  }, [conversationId, messages.length]);

  // Archive current chat and start fresh
  const handleArchiveChat = async () => {
    if (!conversationId) return;
    if (!window.confirm('هل تريد أرشفة هذه المحادثة وبدء محادثة جديدة؟')) return;

    try {
      const convRef = doc(db, 'conversations', conversationId);
      await updateDoc(convRef, { 
        status: 'archived',
        updatedAt: new Date().toISOString()
      });

      // Generate a new clean session
      resetSession();
      alert('تمت أرشفة المحادثة بنجاح وبدء محادثة جديدة بقاعدة البيانات!');
    } catch (err) {
      console.error('Error archiving conversation:', err);
      // fallback reset session anyway
      resetSession();
    }
  };

  // Delete current chat completely from Firestore and start fresh
  const handleDeleteChat = async () => {
    if (!conversationId) return;
    if (!window.confirm('هل تريد حذف ومسح هذه المحادثة بالكامل من قاعدة البيانات وبدء محادثة جديدة؟')) return;

    try {
      const convRef = doc(db, 'conversations', conversationId);
      await deleteDoc(convRef);
      
      // Generate a new clean session
      resetSession();
      alert('تم حذف هذه المحادثة بالكامل وبدء محادثة جديدة!');
    } catch (err) {
      console.error('Error deleting conversation:', err);
      // fallback reset session anyway
      resetSession();
    }
  };

  // Compile specific bug/error report details and send directly to developer via WhatsApp
  const handleSendBugReport = () => {
    const cleanPhone = '963938850783'; 
    const messageText = `📋 *تقرير إبلاغ عن مشكلة/خطأ في المساعد الذكي*\n\n` +
      `👤 *نوع الخطأ:* ${bugType}\n` +
      `📝 *التفاصيل المحددة:* ${bugDetails.trim() ? bugDetails.trim() : 'لا توجد تفاصيل إضافية مضافة.'}\n\n` +
      `🆔 *رقم العميل:* ${customerId || 'غير معروف'}\n` +
      `💬 *معرف المحادثة:* ${conversationId || 'لا يوجد'}\n` +
      `🕒 *تاريخ البلاغ:* ${new Date().toLocaleString('ar-EG')}`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');
    setShowBugModal(false);
    setBugDetails('');
  };

  // Soft auto-scroll to latest messaging context
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBotTyping]);

  // Sync state to Firebase doc
  const syncConversationToFirestore = async (updatedMessages: Message[], activeName?: string) => {
    if (!conversationId) return;
    try {
      const convRef = doc(db, 'conversations', conversationId);
      const payload = {
        customerName: activeName || customerId,
        status: 'pending',
        messages: updatedMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(convRef, payload);
    } catch (error) {
      // Catch and trace permission issues securely as mandated
      handleFirestoreError(error, OperationType.WRITE, `conversations/${conversationId}`);
    }
  };

  const simulateContactInfo = async (type: 'whatsapp' | 'phone' | 'location') => {
    if (!settings || isBotTyping) return;
    setIsBotTyping(true);

    let userText = '';
    let botText = '';

    if (type === 'whatsapp') {
      const waNumber = settings.whatsapp || '966500000000';
      const cleanNum = waNumber.replace(/\+/g, '').replace(/[\s-]/g, '');
      userText = '💬 أرغب في الحصول على رابط التواصل السريع وتوجيهي للواتساب مباشرة';
      botText = `يسعدنا تواصلكم معنا وتنسيق طلباتكم واستفساراتكم مباشرة عبر تطبيق واتساب بالضغط على الرابط التالي للتحويل المباشر:\n\n👉 https://wa.me/${cleanNum}\n\nأو يمكنكم حفظ الرقم المباشر للواتساب لدينا للمراسلة لاحقاً: ${waNumber}`;
    } else if (type === 'phone') {
      const phoneNum = settings.contactNumber || '966500000000';
      userText = '📞 أرغب في معرفة رقم الهاتف المباشر للاتصال بكم';
      botText = `أهلاً ومرحباً بكم. نسعد باتصالكم الهاتفي المباشر بنا للاستفسار أو الدعم الفني والمبيعات عبر الرقم التالي:\n\n☎️ ${phoneNum}`;
    } else if (type === 'location') {
      const loc = settings.location || 'الرياض، المملكة العربية السعودية';
      userText = '📍 أرغب في معرفة موقع الشركة الجغرافي وعنوانها الرئيسي';
      botText = `العنوان والموقع الرئيسي لدينا هو:\n\n🏢 ${loc}\n\nنسعد بزيارتكم وتشريفكم لنا في أي وقت خلال أوقات العمل الرسمية.`;
    }

    const userMessage: Message = {
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    const intermediateMessages = [...messages, userMessage];
    setMessages(intermediateMessages);
    await syncConversationToFirestore(intermediateMessages);

    // Dynamic delay mapping from store response speed configurations
    const delaySpeed = settings.botResponseSpeed || 'medium';
    let delayMs = 1500;
    if (delaySpeed === 'instant') delayMs = 100;
    else if (delaySpeed === 'fast') delayMs = 700;
    else if (delaySpeed === 'slow') delayMs = 3200;

    setTimeout(async () => {
      const botMessage: Message = {
        sender: 'bot',
        text: botText,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMessages = [...intermediateMessages, botMessage];
      setMessages(finalMessages);
      setIsBotTyping(false);
      await syncConversationToFirestore(finalMessages);
    }, delayMs);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const typedText = inputText.trim();

    if (isCollectingName) {
      const name = typedText;
      localStorage.setItem('mamu_customer_name', name);
      setCustomerId(name);
      setIsCollectingName(false);

      const userMessage: Message = {
        sender: 'user',
        text: name,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      };

      const bType = settings?.businessType || 'شركة';
      const sName = settings?.storeName || 'الأجهزة المنزلية والكهربائية';
      const welcomeBackMessage = `أهلاً ومرحباً بك يا ${name}. تشرفنا بمعرفتك. كيف يمكنني مساعدتك اليوم في تصفح الأجهزة الكهربائية والمنزلية في ${bType === 'شركة' ? 'شركة' : 'متجر'} ${sName} والتعرف على أسعارها؟`;

      const botMessage: Message = {
        sender: 'bot',
        text: welcomeBackMessage,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      };

      const newMessages = [...messages, userMessage, botMessage];
      setMessages(newMessages);
      setInputText('');
      
      // Update with new customerName directly on Firestore
      await syncConversationToFirestore(newMessages, name);
      return;
    }

    const userMessage: Message = {
      sender: 'user',
      text: typedText,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsBotTyping(true);

    // Save progressively to Firestore
    syncConversationToFirestore(newMessages);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      
      const data = await response.json();
      const rawText = data.text || 'أعتذر، حدثت مشكلة فنية. يرجى تكرار السؤال.';

      // Get configuration delay
      const delaySpeed = settings?.botResponseSpeed || 'medium';
      let delayMs = 350; // default medium (highly optimized from 1500ms)
      if (delaySpeed === 'instant') delayMs = 40;
      else if (delaySpeed === 'fast') delayMs = 150;
      else if (delaySpeed === 'slow') delayMs = 1000;

      setTimeout(async () => {
        const botMessage: Message = {
          sender: 'bot',
          text: rawText,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        };

        const finalMessages = [...newMessages, botMessage];
        setMessages(finalMessages);
        setIsBotTyping(false);

        // Save complete log with bot response
        syncConversationToFirestore(finalMessages);
      }, delayMs);

    } catch (err) {
      console.error('Error fetching chat response:', err);
      setIsBotTyping(false);
      const fallbackMsg: Message = {
        sender: 'bot',
        text: 'عذراً، الخادم لا يستجيب حالياً. يرجى مراجعة إعدادات الاتصال والإنترنت.',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...newMessages, fallbackMsg]);
    }
  };

  if (settings?.maintenanceMode) {
    const waNumber = settings.whatsapp || '966500000000';
    const cleanNum = waNumber.replace(/\+/g, '').replace(/[\s-]/g, '');
    const phoneNum = settings.contactNumber || '';

    return (
      <div className="flex flex-col min-h-screen bg-gray-50 selection:bg-rose-50 font-sans" dir="rtl">
        {/* Simple Clean Header */}
        <header className="flex items-center justify-between px-4 sm:px-8 py-4 bg-white border-b border-gray-100 shadow-xs flex-none">
          <div className="flex items-center gap-3">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="logo" className="w-9 h-9 rounded-full object-contain border border-gray-100" />
            ) : (
              <div 
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: settings?.botPrimaryColor || '#800020' }}
              >
                <span className="w-3.5 h-3.5 border-2 border-white rounded-full bg-white/20"></span>
              </div>
            )}
            <div>
              <h1 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                {settings?.storeName || 'شركة الأجهزة الكهربائية والمنزلية'}
              </h1>
              <p className="text-[11px] text-gray-400 font-medium">مستشار الرد الآلي والمبيعات المباشر</p>
            </div>
          </div>
        </header>

        {/* Maintenance Container */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-xl mx-auto text-center w-full">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full bg-white border border-gray-150 rounded-3xl p-6 sm:p-10 shadow-md space-y-6"
          >
            {/* Maintenance Icon Circle */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">المساعد الذكي للمتجر في مرحلة الصيانة</h2>
              <span className="inline-block px-3 py-1 bg-red-105 text-red-700 text-[10px] font-bold rounded-full border border-red-200">
                سنعود قريباً جداً ⏱️
              </span>
            </div>

            {/* Custom Maintenance Message */}
            <div className="bg-gray-50 rounded-2xl p-4.5 border border-gray-100 text-xs sm:text-sm text-gray-650 leading-relaxed font-semibold">
              {settings.maintenanceMessage || 'نحن نقوم ببعض التحسينات والصيانة حالياً لتقديم أفضل خدمة ممكنة. سنعود للخدمة قريباً جداً لتلبية وتوفير كافة استفساراتكم!'}
            </div>

            {/* Direct contact alternatives */}
            <div className="space-y-4 pt-4 border-t border-gray-150">
              <p className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider">
                هل ترغب في طلب الأجهزة أو الاستفسار المباشر؟
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                ممثلو المبيعات والخدمة في المتجر متاحون لمساعدتك يدوياً في الحال، وتزويدك بالردود الكافية وتنسيق الحجز والشحن على الفور!
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {waNumber && (
                  <a
                    href={`https://wa.me/${cleanNum}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>تواصل مبيعات (واتساب)</span>
                  </a>
                )}
                {phoneNum && (
                  <a
                    href={`tel:${phoneNum}`}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-zinc-900 hover:bg-black active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    <Phone className="w-4 h-4" />
                    <span>اتصال دعم مباشر</span>
                  </a>
                )}
              </div>
            </div>
          </motion.div>

          {/* Footer branding */}
          <div className="mt-8 text-center text-[10px] text-zinc-400 font-semibold">
            &copy; {new Date().getFullYear()} {settings?.storeName || 'شركة الأجهزة الكهربائية والمنزلية'}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white selection:bg-neutral-100 font-sans" dir="rtl">
      {/* Dynamic Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between px-4 sm:px-8 py-3.5 md:h-16 bg-white border-b border-gray-100 flex-none gap-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="logo" className="w-9 h-9 rounded-full object-contain border border-gray-100" />
          ) : (
            <div 
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 text-white font-bold text-sm"
              style={{ backgroundColor: settings?.botPrimaryColor || '#800020' }}
            >
              <span className="w-3.5 h-3.5 border-2 border-white rounded-full bg-white/20"></span>
            </div>
          )}
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-gray-900 leading-tight">
              {settings?.storeName || 'شركة الأجهزة الكهربائية والمنزلية'}
            </h1>
            <p className="text-[11px] text-gray-400 font-medium">مستشار الرد الآلي والمبيعات المباشر على مدار الساعة</p>
          </div>
        </div>

        {/* Dynamic Store Contact Details via Micro-interactive Icons only. Raw info never exposes as text. Clicking triggers chat conversation bubble */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-neutral-50/85 p-1 rounded-full border border-neutral-100/90 shadow-2xs">
            {settings?.whatsapp && (
              <button 
                onClick={() => simulateContactInfo('whatsapp')}
                disabled={isBotTyping}
                title="تواصل معنا عبر الواتساب"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100/80 active:scale-95 transition-all cursor-pointer disabled:opacity-40 border border-emerald-100/50"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
              </button>
            )}
            {settings?.contactNumber && (
              <button 
                onClick={() => simulateContactInfo('phone')}
                disabled={isBotTyping}
                title="تواصل معنا هاتفياً"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-50 text-blue-650 hover:bg-blue-100/80 active:scale-95 transition-all cursor-pointer disabled:opacity-40 border border-blue-100/50"
              >
                <Phone className="w-4 h-4 shrink-0" />
              </button>
            )}
            {settings?.location && (
              <button 
                onClick={() => simulateContactInfo('location')}
                disabled={isBotTyping}
                title="موقعنا وعنواننا"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-50 text-amber-600 hover:bg-amber-100/80 active:scale-95 transition-all cursor-pointer disabled:opacity-40 border border-amber-100/50"
              >
                <MapPin className="w-4 h-4 shrink-0" />
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-gray-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            {/* Archive Chat button */}
            <button
              onClick={handleArchiveChat}
              title="أرشفة المحادثة وبدء جديد"
              className="p-1.5 px-3 text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">أرشفة وبدء محادثة جديدة</span>
            </button>

            {/* Delete Chat button */}
            <button
              onClick={handleDeleteChat}
              title="حذف المحادثة وبدء جديد"
              className="p-1.5 px-3 text-[11px] font-bold text-red-500 bg-red-50/50 border border-red-150 rounded-lg hover:bg-red-50 hover:text-red-700 transition-all flex items-center gap-1 cursor-pointer text-right"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">مسح المحادثة وحذفها</span>
            </button>

            {/* Report Bug button */}
            <button
              onClick={() => setShowBugModal(true)}
              title="إبلاغ عن خطأ أو مشكلة فنية"
              className="p-1.5 px-3 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 hover:text-amber-800 transition-all flex items-center gap-1 cursor-pointer shrink-0"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>إبلاغ عن خطأ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Messaging Panel */}
      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 max-w-4xl w-full mx-auto space-y-4 bg-gray-50/50">
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => {
            const isUser = msg.sender === 'user';
            const isLastBotMessage = !isUser && index === messages.length - 1;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`flex mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {isUser ? (
                  /* User Messenger Style Bubble */
                  <div
                    className="px-4.5 py-3 rounded-[20px] rounded-bl-xs text-[14px] leading-relaxed whitespace-pre-wrap font-medium max-w-[85%] sm:max-w-[75%] shadow-none transition-all duration-300 transform-gpu"
                    style={{
                      backgroundColor: settings?.botPrimaryColor || '#800020',
                      color: settings?.botTextColor || '#ffffff'
                    }}
                  >
                    <div>{msg.text}</div>
                    <div className="text-[9.5px] mt-1 text-left select-none opacity-85 hover:opacity-100 transition-opacity">
                      {msg.timestamp}
                    </div>
                  </div>
                ) : (
                  /* Bot Messenger Style Bubble with Profile Photo */
                  <div className="flex items-end gap-2.5 max-w-[85%] sm:max-w-[75%]">
                    {settings?.botAvatar ? (
                      <img 
                        src={settings.botAvatar} 
                        alt="Bot Avatar" 
                        className="w-8 h-8 rounded-full object-cover border border-neutral-150 shrink-0 mb-0.5" 
                      />
                    ) : settings?.logoUrl ? (
                      <img 
                        src={settings.logoUrl} 
                        alt="Store Logo" 
                        className="w-8 h-8 rounded-full object-contain border border-neutral-100 shrink-0 mb-0.5 " 
                      />
                    ) : (
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0 mb-0.5"
                        style={{ backgroundColor: settings?.botPrimaryColor || '#800020' }}
                      >
                        <span className="w-2.5 h-2.5 border border-white rounded-xs bg-white/20"></span>
                      </div>
                    )}
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-zinc-450 font-bold mb-1 mr-1 text-right block tracking-wide select-none">
                        {settings?.botEmployeeName || 'سارة (ممثلة المبيعات)'}
                      </span>
                      <div className="px-4.5 py-3 rounded-[20px] rounded-br-xs bg-[#F0F2F5] text-zinc-900 text-[14px] leading-relaxed border border-transparent shadow-none whitespace-pre-wrap text-right">
                        <div>
                          {isLastBotMessage ? (
                            <TypewriterText text={msg.text} />
                          ) : (
                            msg.text
                          )}
                        </div>
                        <div className="text-[9.5px] mt-1 text-right select-none text-zinc-400 hover:text-zinc-500 transition-colors">
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isBotTyping && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-start mb-2"
          >
            <div className="flex items-end gap-2.5 max-w-[85%] sm:max-w-[75%]">
              {settings?.botAvatar ? (
                <img 
                  src={settings.botAvatar} 
                  alt="Bot Avatar" 
                  className="w-8 h-8 rounded-full object-cover border border-neutral-150 shrink-0 mb-0.5" 
                />
              ) : settings?.logoUrl ? (
                <img 
                  src={settings.logoUrl} 
                  alt="Store Logo" 
                  className="w-8 h-8 rounded-full object-contain border border-neutral-100 shrink-0 mb-0.5" 
                />
              ) : (
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0 mb-0.5"
                  style={{ backgroundColor: settings?.botPrimaryColor || '#800020' }}
                >
                  <span className="w-2.5 h-2.5 border border-white rounded-xs bg-white/20"></span>
                </div>
              )}
              <div className="bg-[#F0F2F5] px-5 py-3 rounded-[20px] rounded-br-xs flex items-center gap-1.5 h-[38px] shadow-none">
                <motion.span
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut', delay: 0 }}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: settings?.botPrimaryColor || '#800020' }}
                />
                <motion.span
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut', delay: 0.15 }}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: settings?.botPrimaryColor || '#800020' }}
                />
                <motion.span
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut', delay: 0.3 }}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: settings?.botPrimaryColor || '#800020' }}
                />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input panel */}
      <footer className="bg-white border-t border-gray-100 py-4.5 px-6 flex-none">
        <div className="max-w-4xl w-full mx-auto">
          <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isCollectingName ? "فضلاً اكتب اسمك الكريم هنا والمس تفعيل/إرسال..." : "اكتب سؤالك هنا عن الأجهزة المتوفرة والأسعار الحالية..."}
              className="flex-1 px-4.5 py-3.5 bg-[#F0F2F5] border border-transparent rounded-[22px] text-sm focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white focus:border-gray-300 text-gray-900 transition-all placeholder-gray-400"
              disabled={isBotTyping}
            />
            <button
              type="submit"
              disabled={isBotTyping || !inputText.trim()}
              className="px-6 py-3 disabled:opacity-40 rounded-[22px] text-xs font-bold cursor-pointer transition-all duration-150 flex items-center justify-center gap-2 shrink-0 hover:brightness-105 active:scale-95 shadow-xs animate-none"
              style={{
                backgroundColor: settings?.botPrimaryColor || '#800020',
                color: settings?.botTextColor || '#ffffff'
              }}
            >
              <span>إرسال</span>
              <Send className="w-3.5 h-3.5 transform rotate-180" />
            </button>
          </form>
        </div>
      </footer>

      {/* Bug Report Modal */}
      <AnimatePresence>
        {showBugModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" dir="rtl">
            <div className="flex min-h-screen items-center justify-center p-4">
              {/* Back Drop Overlay with Motion */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setShowBugModal(false);
                  setBugDetails('');
                }}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              />

              {/* Modal Body with Entry Animation */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative transform overflow-hidden rounded-2xl bg-white p-6 justify-center w-full max-w-sm shadow-2xl border border-gray-150 transition-all z-10 text-right font-sans"
              >
                {/* Header with Title and Icon */}
                <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-gray-100">
                  <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <Bug className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-gray-905 leading-tight">إرسال تقرير إبلاغ عن خطأ فني</h3>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">سيتم تحويلك مباشرة مع التفاصيل لتطبيق الواتساب الخاص بالدعم</p>
                  </div>
                </div>

                {/* Bug Type selector */}
                <div className="space-y-2 mb-4">
                  <label className="block text-xs font-extrabold text-gray-750">حدد نوع الخطأ أو المشكلة الفنية:</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[
                      'بطء في استجابة المساعد الذكي',
                      'مواصفات أو أسعار المنتجات معروضة بشكل خاطئ',
                      'توقف المحادثة وعدم استقبال الرسائل',
                      'مشكلة تقنية في تصفح الصور أو الروابط المرجعية',
                      'غير ذلك (اكتب تفاصيل إضافية في الأسفل)'
                    ].map((typeOption) => (
                      <button
                        key={typeOption}
                        type="button"
                        onClick={() => setBugType(typeOption)}
                        className={`w-full text-right p-2.5 text-xs rounded-lg border font-medium transition-all flex items-center justify-between cursor-pointer ${
                          bugType === typeOption
                            ? 'bg-red-50/40 border-red-400 text-red-700 font-semibold'
                            : 'bg-gray-50 border-gray-150 text-gray-650 hover:bg-gray-100/70'
                        }`}
                      >
                        <span>{typeOption}</span>
                        {bugType === typeOption && (
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bug custom Description text area */}
                <div className="space-y-1.5 mb-5">
                  <label className="block text-xs font-bold text-gray-700">تفاصيل إضافية لتوضيح المشكلة (اختياري):</label>
                  <textarea
                    rows={3}
                    value={bugDetails}
                    onChange={(e) => setBugDetails(e.target.value)}
                    placeholder="اكتب هنا أي معلومات تساعد المطور على حل تلك المشكلة بأقرب وقت..."
                    className="w-full p-2.5 text-xs bg-gray-50 border border-gray-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-400 focus:bg-white focus:border-red-450 text-gray-800 transition-all placeholder-gray-400 resize-none h-20"
                  />
                </div>

                {/* CTA Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSendBugReport}
                    className="flex-1 text-white font-extrabold text-xs py-3 px-4 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                    style={{ backgroundColor: '#25D366' }} // Whatsapp Brand Green Color
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>إرسال البلاغ عبر الواتساب</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowBugModal(false);
                      setBugDetails('');
                    }}
                    className="p-3 text-[11px] font-bold text-gray-500 bg-gray-100 border border-gray-200 rounded-xl hover:bg-gray-150 hover:text-gray-700 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
