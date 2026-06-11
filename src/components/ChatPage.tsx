import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, arrayUnion, updateDoc, onSnapshot } from 'firebase/firestore';
import { Message, Conversation } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, AlertCircle, MapPin, Phone, MessageCircle, Mail } from 'lucide-react';

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
  const [customerId, setCustomerId] = useState<string>('');
  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const DEFAULT_GREETING = 'مرحباً بك في شركة مامو للأجهزة المنزلية والكهربائية! كيف يمكنني مساعدتك في تصفح الأجهزة المتوفرة والأسعار اليوم؟';

  // Listen to Settings from Firestore
  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'store');
    const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings(data);
        setMessages((prev) => {
          if (prev.length === 0) {
            return [{
              sender: 'bot',
              text: data.botWelcomeMessage || DEFAULT_GREETING,
              timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            }];
          }
          return prev;
        });
      } else {
        setMessages((prev) => {
          if (prev.length === 0) {
            return [{
              sender: 'bot',
              text: DEFAULT_GREETING,
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
          return [{
            sender: 'bot',
            text: DEFAULT_GREETING,
            timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          }];
        }
        return prev;
      });
    });

    return unsubscribe;
  }, []);

  // Initialize unique IDs for this visitor session
  useEffect(() => {
    const randomId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const uniqueConvId = `CH-${Date.now().toString().slice(-6)}-${randomId}`;
    const custNum = Math.floor(Math.random() * 899 + 100);
    
    setConversationId(uniqueConvId);
    setCustomerId(`عميل #${custNum}`);
  }, []);

  // Soft auto-scroll to latest messaging context
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBotTyping]);

  // Sync state to Firebase doc
  const syncConversationToFirestore = async (updatedMessages: Message[]) => {
    if (!conversationId) return;
    try {
      const convRef = doc(db, 'conversations', conversationId);
      const payload = {
        customerName: customerId,
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
      userText = '💬 أريد رابط التواصل والتحويل السريع إلى الواتساب';
      botText = `تفضل يا فندم، يمكنك التواصل معنا مباشرة وتنسيق الطلبات عبر الواتساب بالضغط على الرابط التالي للتحويل المباشر:\n\n👉 https://wa.me/${cleanNum}\n\nأو يمكنك حفظ وتخزين الرقم المباشر للواتساب لدينا: ${waNumber}`;
    } else if (type === 'phone') {
      const phoneNum = settings.contactNumber || '966500000000';
      userText = '📞 أريد رقم الهاتف للاتصال الهاتفي المباشر بالشركة';
      botText = `أهلاً بك! نسعد باتصالك الهاتفي المباشر معنا للاستفسار أو الدعم عبر الرقم التالي:\n\n☎️ ${phoneNum}`;
    } else if (type === 'location') {
      const loc = settings.location || 'الرياض، المملكة العربية السعودية';
      userText = '📍 أريد معرفة موقع الشركة الجغرافي وعنوانها الرئيسي';
      botText = `عنوان وموقع شركتنا الرئيسي هو:\n\n🏢 ${loc}\n\nنرحب بكم ونسعد بتشريفكم لنا في أي وقت!`;
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

    const userMessage: Message = {
      sender: 'user',
      text: inputText.trim(),
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
      let delayMs = 1500; // default medium
      if (delaySpeed === 'instant') delayMs = 50;
      else if (delaySpeed === 'fast') delayMs = 700;
      else if (delaySpeed === 'slow') delayMs = 3200;

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
              {settings?.storeName || 'شركة مامو للأجهزة المنزلية والكهربائية'}
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
                title="موقع الشركة وعنواننا"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-50 text-amber-600 hover:bg-amber-100/80 active:scale-95 transition-all cursor-pointer disabled:opacity-40 border border-amber-100/50"
              >
                <MapPin className="w-4 h-4 shrink-0" />
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-gray-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-250">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span>نشط الآن</span>
            </span>
            <span className="text-[10px] text-gray-400 font-mono hidden lg:inline bg-neutral-50 px-2 py-0.5 rounded border border-neutral-150" dir="ltr">{conversationId}</span>
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
              placeholder="اكتب سؤالك هنا عن الأجهزة المتوفرة والأسعار الحالية..."
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
    </div>
  );
}
