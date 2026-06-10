import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, arrayUnion, updateDoc, onSnapshot } from 'firebase/firestore';
import { Message, Conversation } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, AlertCircle, MapPin, Phone, MessageCircle, Mail } from 'lucide-react';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const DEFAULT_GREETING = 'مرحباً بك في متجرنا الذكي للأجهزة المنزلية والكهربائية! كيف يمكنني مساعدتك في تصفح الأجهزة المتوفرة والأسعار اليوم؟';

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
      
      const botMessage: Message = {
        sender: 'bot',
        text: data.text || 'أعتذر، حدثت مشكلة فنية. يرجى تكرار السؤال.',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMessages = [...newMessages, botMessage];
      setMessages(finalMessages);
      setIsBotTyping(false);

      // Save complete log with bot response
      syncConversationToFirestore(finalMessages);

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
      <header className="flex items-center justify-between px-8 h-16 bg-white border-b border-gray-100 flex-none">
        <div className="flex items-center gap-3">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="logo" className="w-8 h-8 rounded object-contain border border-gray-100" />
          ) : (
            <div 
              className="w-8 h-8 rounded flex items-center justify-center transition-colors shrink-0 text-white font-bold text-sm"
              style={{ backgroundColor: settings?.botPrimaryColor || '#000000' }}
            >
              <span className="w-3 h-3 border-2 border-white rounded-xs"></span>
            </div>
          )}
          <div>
            <h1 className="text-base font-bold tracking-tight text-gray-900">
              {settings?.storeName || 'المساعد الذكي للمتجر'}
            </h1>
            <p className="text-xs text-gray-400 font-medium">خدمة الرد الآلي والمباشر بخصوص المنتجات والأسعار الحالية</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-neutral-100 text-neutral-800 border border-neutral-200">
            مباشر ونشط
          </span>
          <span className="text-xs text-gray-400 font-mono hidden sm:inline" dir="ltr">{conversationId}</span>
        </div>
      </header>

      {/* Dynamic Store Contact Details Bar (Location, WhatsApp, Call, Email) */}
      {settings && (settings.location || settings.whatsapp || settings.contactNumber || settings.email) && (
        <div className="bg-neutral-50 border-b border-gray-100 px-8 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-gray-500 font-semibold justify-center sm:justify-start flex-none">
          {settings.location && (
            <span className="flex items-center gap-1.5 shrink-0 text-gray-600">
              <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>{settings.location}</span>
            </span>
          )}
          {settings.whatsapp && (
            <a 
              href={`https://wa.me/${settings.whatsapp.replace(/\+/g, '').replace(/[\s-]/g, '')}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-1.5 shrink-0 text-emerald-600 hover:text-emerald-700 hover:underline transition-colors font-mono"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>واتساب: {settings.whatsapp}</span>
            </a>
          )}
          {settings.contactNumber && (
            <a 
              href={`tel:${settings.contactNumber}`} 
              className="flex items-center gap-1.5 shrink-0 text-indigo-600 hover:text-indigo-700 hover:underline transition-colors font-mono"
            >
              <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>اتصال: {settings.contactNumber}</span>
            </a>
          )}
          {settings.email && (
            <a 
              href={`mailto:${settings.email}`} 
              className="flex items-center gap-1.5 shrink-0 text-amber-600 hover:text-amber-700 hover:underline transition-colors font-mono"
            >
              <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{settings.email}</span>
            </a>
          )}
        </div>
      )}

      {/* Messaging Panel */}
      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 max-w-4xl w-full mx-auto space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded text-[14px] leading-relaxed whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'font-medium'
                    : 'bg-white text-gray-800 border border-gray-150 shadow-sm'
                }`}
                style={
                  msg.sender === 'user'
                    ? {
                        backgroundColor: settings?.botPrimaryColor || '#000000',
                        color: settings?.botTextColor || '#ffffff'
                      }
                    : undefined
                }
              >
                <div>{msg.text}</div>
                <div
                  className={`text-[10px] mt-1.5 select-none text-left ${
                    msg.sender === 'user' ? 'text-zinc-200/80' : 'text-gray-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isBotTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-white border border-gray-150 shadow-sm px-4 py-3 rounded flex items-center gap-3">
              <div className="flex gap-1 items-center justify-center h-4">
                <motion.span
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.0, ease: "easeInOut", delay: 0 }}
                  className="w-1.5 h-1.5 bg-black rounded-full"
                  style={{ backgroundColor: settings?.botPrimaryColor || '#000000' }}
                />
                <motion.span
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.0, ease: "easeInOut", delay: 0.15 }}
                  className="w-1.5 h-1.5 bg-black rounded-full"
                  style={{ backgroundColor: settings?.botPrimaryColor || '#000000' }}
                />
                <motion.span
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.0, ease: "easeInOut", delay: 0.3 }}
                  className="w-1.5 h-1.5 bg-black rounded-full"
                  style={{ backgroundColor: settings?.botPrimaryColor || '#000000' }}
                />
              </div>
              <span className="text-xs text-gray-400 font-medium mr-1 select-none">جاري كتابة الرد الآن...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input panel */}
      <footer className="bg-white border-t border-gray-100 py-4 px-6 flex-none">
        <div className="max-w-4xl w-full mx-auto">
          <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="اكتب سؤالك هنا عن الأجهزة المتوفرة والأسعار الحالية..."
              className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-gray-900 transition-all placeholder-gray-400"
              disabled={isBotTyping}
            />
            <button
              type="submit"
              disabled={isBotTyping || !inputText.trim()}
              className="px-6 py-2.5 disabled:opacity-40 rounded text-xs font-bold cursor-pointer transition-colors duration-150 flex items-center justify-center gap-2 shrink-0"
              style={{
                backgroundColor: settings?.botPrimaryColor || '#000000',
                color: settings?.botTextColor || '#ffffff'
              }}
            >
              <span>إرسال</span>
              <Send className="w-3.5 h-3.5 transform rotate-180" />
            </button>
          </form>
          <div className="mt-2 text-center">
            <span className="text-[10.5px] text-gray-400 font-medium">
              الرد يتم تلقائياً بواسطة مساعد كهربائي ذكي متصل بقاعدة البيانات الحية للمتجر للتأكد من تيسير المبيعات.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
