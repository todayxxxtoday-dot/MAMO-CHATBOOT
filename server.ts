import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import dotenv from 'dotenv';

dotenv.config();

// Ensure GEMINI_API_KEY is available (lazy loaded or warning is printed)
const geminiApiKey = process.env.GEMINI_API_KEY || '';
if (!geminiApiKey) {
  console.warn('WARNING: GEMINI_API_KEY environment variable is not set. Chatbot will use fallback responses.');
}

const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Initialize Firebase App for Server-Side Context
let db: any = null;
try {
  const firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
} catch (err) {
  console.error('Error initializing Firebase on server side:', err);
}

const app = express();
app.use(express.json());

// Arabic Mock Products list as graceful fallback if Firestore is not provisioned or empty
const FALLBACK_PRODUCTS = [
  {
    name: 'ثلاجة إل جي نوفروست 450 لتر',
    category: 'ثلاجات',
    brand: 'LG',
    price: 32000,
    quantity: 5,
    description: 'ثلاجة ذكية مع نظام تبريد دوري موزع بالتساوي للحفاظ على الأطعمة طازجة، موفرة للطاقة كلاس A+.',
    isAvailable: true
  },
  {
    name: 'غسالة سامسونج اتوماتيك 9 كيلو',
    category: 'غسالات',
    brand: 'Samsung',
    price: 24500,
    quantity: 3,
    description: 'غسالة فائقة الأداء مزودة بتقنية الحبابات الفعالة Eco Bubble ومحرك عاكس رقمي هادئ.',
    isAvailable: true
  },
  {
    name: 'شاشة سوني 55 بوصة فور كي UHD ذكية',
    category: 'شاشات ورسيفرات',
    brand: 'Sony',
    price: 18900,
    quantity: 8,
    description: 'تلفزيون ذكي بنظام أندرويد ودقة وضوح فائقة 4K مع ألوان طبيعية غامرة بفضل تقنية Triluminos.',
    isAvailable: true
  },
  {
    name: 'ميكروويف تورنيدو 25 لتر رقمي شواية',
    category: 'ميكروويف وأفران',
    brand: 'Tornado',
    price: 5200,
    quantity: 12,
    description: 'ميكروويف متعدد الوظائف بقدرة 900 وات مع 8 قوائم طهي مسبقة الإعداد وقفل أمان للأطفال.',
    isAvailable: true
  },
  {
    name: 'مكيف جري سبليت 1.5 حصان بارد',
    category: 'مكيفات',
    brand: 'Gree',
    price: 21000,
    quantity: 2,
    description: 'مكيف هواء قوي وموفر للاستهلاك بفلتر عالي الكثافة لتنقية الهواء وخاصية التبريد السريع.',
    isAvailable: true
  }
];

// 1. API: Smart Chat endpoint (using Gemini API)
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'مطلوب مصفوفة رسائل صالحة.' });
    }

    // Try fetching products from Firestore dynamically to feed as context
    let productsList = [...FALLBACK_PRODUCTS];
    if (db) {
      try {
        const productsCol = collection(db, 'products');
        const q = query(productsCol, limit(50));
        const productsSnapshot = await getDocs(q);
        if (!productsSnapshot.empty) {
          const fetched: any[] = [];
          productsSnapshot.forEach((doc) => {
            const data = doc.data();
            fetched.push({
              name: data.name,
              category: data.category,
              brand: data.brand,
              price: data.price,
              quantity: data.quantity,
              description: data.description,
              isAvailable: data.isAvailable
            });
          });
          productsList = fetched;
        }
      } catch (firestoreFetchErr) {
        console.warn('Could not fetch target products from Firestore, using server-side placeholder list.');
      }
    }

    // Fetch custom store settings if existing
    let storeSettings: any = null;
    if (db) {
      try {
        const settingsRef = doc(db, 'settings', 'store');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          storeSettings = settingsSnap.data();
        }
      } catch (settingsError) {
        console.warn('Could not fetch store configurations from Firestore, using server defaults.');
      }
    }

    const storeCurrencyLabel = storeSettings?.currency || 'ليرة سورية';
    const currencySuffix = storeCurrencyLabel === 'دولار' ? 'دولار ($)' : storeCurrencyLabel === 'ليرة سورية' ? 'ليرة سورية (ل.س)' : 'ر.س';

    // Prepare Products Context String in Arabic
    let productsContext = productsList.map((p, idx) => {
      const statusStr = p.isAvailable && p.quantity > 0 ? `متوفر (الكمية: ${p.quantity})` : 'غير متوفر حالياً';
      return `${idx + 1}. المنتج: ${p.name} | القسم: ${p.category} | الماركة: ${p.brand} | السعر: ${p.price} ${currencySuffix} | الحالة: ${statusStr}\nالوصف: ${p.description}`;
    }).join('\n\n');

    // Build standard System Instruction dynamically using Store Settings
    const businessType = storeSettings?.businessType || 'شركة';
    const storeName = storeSettings?.storeName || 'الأجهزة المنزلية والكهربائية';
    const storeLocation = storeSettings?.location || 'الرياض، المملكة العربية السعودية';
    const storeWhatsapp = storeSettings?.whatsapp || 'غير متاح حالياً';
    const storePhone = storeSettings?.contactNumber || 'غير متاح حالياً';
    const storeEmail = storeSettings?.email || 'غير متاح حالياً';
    const customInstructions = storeSettings?.botInstructions || 'جاوب بأدب ومصداقية على الأسئلة الخاصة بأسعار ومواصفات وتوفر الأجهزة المنزلية فقط.';

    const systemInstruction = `أنت مساعد ذكي وممثل خدمة العملاء لـ ${businessType} "${storeName}".
مهمتك المطلقة والوحيدة هي الإجابة عن استفسارات العملاء حول المنتجات المتوفرة والأسعار والماركات والأقسام بناءً على قائمة المنتجات الحية المسجلة بالأسفل بمستودعنا.

⚠️ تنبيه هام ومطلق حول اللغة المستخدمة: يجب عليك الرد والتحدث دائماً باللغة العربية الفصحى المبسطة، اللبقة، والمهنية. يُمنع منعاً باتاً استخدام أي لهجة عامية (مثل اللهجة السورية، المصرية، أو غيرها). لا تستخدم عبارات مديح مفرطة أو مبالغات، وكن موضوعياً ومباشراً ومهذباً في ردودك.

⚠️ تنبيه هام حول العملة المعتمدة بالكامل في ${businessType}: العملة الرسمية هي "${storeCurrencyLabel}" (يرجى عرض الأسعار للعملاء دائماً باستخدام عملة ${storeCurrencyLabel}، وتجنب خلط العملات).

بيانات التواصل وعنوان ${businessType}:
- الموقع/الفرع الرئيسي: ${storeLocation}
- رقم الواتساب المباشر: ${storeWhatsapp}
- رقم الهاتف للاتصال بالدعم الفني: ${storePhone}
- البريد الإلكتروني للمبيعات: ${storeEmail}

قائمة المنتجات المتوفرة حالياً ولديك الصلاحية الكاملة لعرضها:
${productsContext}

التعليمات والقوانين الخاصة بك للتفاعل والرد على العميل:
${customInstructions}

📖 قاعدة المعرفة وطرق التدريب للردود (Knowledge Base Training Examples):
1. التدريب على الترحيب المهني واللطيف:
- السؤال: "مرحبا" أو "السلام عليكم" أو "أهلاً"
- الرد التدريبي: "أهلاً ومرحباً بكم في ${businessType} ${storeName} للأجهزة المنزلية والكهربائية. يسعدنا الرد على استفساراتكم ومساعدتكم في تصفح الأجهزة المتوفرة والأسعار الحالية لدينا. كيف يمكننا خدمتكم اليوم؟"

2. التدريب على الاستفسار عن الأسعار الحية:
- السؤال: "بكم هذا المكيف؟" أو "ما سعر الغسالة؟"
- الرد التدريبي: "أهلاً بكم. بالنسبة لـ [اسم المنتج] المتوفر لدينا في المستودعات، فإن سعره الحالي هو [سعر بالعملة]. إذا كنتم ترغبون في معرفة أي مواصفات أو تفاصيل أخرى حول هذا الجهاز، سأكون سعيدة بتزويدكم بها فوراً."

3. التدريب على حظر الإجابة خارج نطاق المنتجات:
- السؤال: "من فاز بالمباراة؟" أو "أعطني نصيحة طبية" أو "اكتب لي كود"
- الرد التدريبي: "نشكركم على تواصلكم معنا، ولكنني مساعدة ذكية مخصصة لمساعدتكم بكل ما يتعلق بمنتجات ${businessType} ${storeName} للأجهزة المنزلية والكهربائية والأسعار المتوفرة وفروعنا فقط. إذا كان لديكم أي استفسار حول الثلاجات، الغسالات، الشاشات، المكيفات أو الأفران، فأنا في خدمتكم في أي وقت!"

4. التدريب على إتمام البيع والتواصل مع الإدارة:
- السؤال: "أريد شراءه" أو "كيف أتواصل معكم بالهاتف أو الواتساب؟"
- الرد التدريبي: "يسعدنا ويشرفنا تواصلكم لطلب المنتج أو التنسيق للحجز. يمكنك التواصل مع الإدارة مباشرة عبر رقم الواتساب المباشر: ${storeWhatsapp} أو عبر الاتصال الهاتفي: ${storePhone}، كما يسعدنا تشريفكم لنا بالزيارة لفرعنا الرئيسي الموجود في: ${storeLocation}!"

ضوابط إرشادية هامة:
1. لا تقدم أي وعود أو تدرج معلومات بخصوص شروط تفعيل الضمانات أو مميزات إضافية أو مجانية الشحن والتوصيل وطرق السداد الإضافية (مثل كاشير أو تابي أو ميزة تقسيط محددة) إلا إذا كانت واردة ومسجلة في توجيهات الشات بوت المخصصة الموضحة أعلاه.
2. التزم بالرد بنبرة مهذبة وموثوقة، وباللغة العربية الفصحى المبسطة والمهنية، وتجنب استخدام أي كلمات من اللهجة السورية أو المبالغات أو عبارات المديح، وكن واضحاً ومختصراً قدر الإمكان.
3. إذا سأل العميل عن أمور تقع خارج إطار المنتجات المتوفرة لدى ${businessType} أو قنوات التواصل، فاعتذر بلطف واحترافية وبشكل مقتضب باللغة العربية الفصحى المبسطة والمهنية دون اللجوء لأي لهجات أخرى.`;

    // Map and sanitize conversation history to Gemini schema (user / model)
    // To ensure Gemini multi-turn runs without errors:
    // 1. Must alternate 'user' -> 'model'
    // 2. Must start with 'user'
    // 3. Consecutive messages of the same role are combined to avoid 400 bad request errors
    const sortedHistory = messages || [];
    const formattedContents: any[] = [];

    sortedHistory.forEach((m: any) => {
      if (!m || !m.text) return;
      const role = m.sender === 'user' ? 'user' : 'model';

      if (formattedContents.length === 0) {
        if (role === 'user') {
          formattedContents.push({
            role: 'user',
            parts: [{ text: m.text }]
          });
        }
      } else {
        const lastMsg = formattedContents[formattedContents.length - 1];
        if (lastMsg.role === role) {
          // Merge sequential messages of the same author
          lastMsg.parts[0].text += '\n' + m.text;
        } else {
          formattedContents.push({
            role,
            parts: [{ text: m.text }]
          });
        }
      }
    });

    // Fallback if empty context to ensure API call is valid
    if (formattedContents.length === 0) {
      formattedContents.push({
        role: 'user',
        parts: [{ text: 'مرحباً، كيف حالكم؟' }]
      });
    }

    if (!geminiApiKey) {
      // Graceful local chatbot simulation if Gemini API Key is missing
      const lastUserMessage = messages[messages.length - 1]?.text || '';
      let reply = `أهلاً بك في متجر ${storeName}. عذراً، لم يتم تهيئة مفتاح الذكاء الاصطناعي (Gemini API Key) في هذا الخادم بعد لتقديم الخدمة الذكية الكاملة.`;
      
      if (lastUserMessage.includes('سعر') || lastUserMessage.includes('بكم') || lastUserMessage.includes('أسعار')) {
        reply = `الأسعار في متجر ${storeName} تختلف بحسب الماركات ونوع الأجهزة المتوفرة في المخزن. لخدمتك مباشرة ومتابعة الشراء، يمكنك التواصل على الواتساب: ${storeWhatsapp} أو الهاتف: ${storePhone}.`;
      } else if (lastUserMessage.includes('موقع') || lastUserMessage.includes('مكان') || lastUserMessage.includes('عنوان')) {
        reply = `عنوان متجر ${storeName} الرئيسي هو: ${storeLocation}`;
      } else if (lastUserMessage.includes('تواصل') || lastUserMessage.includes('رقم') || lastUserMessage.includes('هاتف') || lastUserMessage.includes('ايميل')) {
        reply = `قنوات تواصل متجر ${storeName}:\n- الهاتف: ${storePhone}\n- الواتساب: ${storeWhatsapp}\n- البريد: ${storeEmail}`;
      } else if (lastUserMessage.includes('متوفر') || lastUserMessage.includes('عندك') || lastUserMessage.includes('متاح')) {
        reply = `لدينا العديد من الأجهزة المنزلية الممتازة المتاحة في المخزن حاليا (مثل ثلاجات، غسالات، شاشات ومكيفات). يمكنك تصفحها مباشرة في الصفحة الرئيسية، أو تواصل معنا مباشرة عبر واتساب: ${storeWhatsapp}.`;
      }
      return res.json({ text: reply });
    }

    // Call actual Gemini API (Modern SDK)
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: formattedContents,
      config: {
        systemInstruction: systemInstruction + '\n⚠️ تنبيه هام لسرعة فائقة: يجب أن تكون الإجابات مختصرة جداً، دقيقة ومباشرة (في حدود سطرين إلى 3 أسطر فقط كحد أقصى) لتوفير سرعة استجابة فائقة للعميل وسرعة الأداء.',
        temperature: 0.3,
        maxOutputTokens: 250
      }
    });

    const replyText = response.text || 'عذراً، لم أستطع صياغة رد مناسب حالياً. يرجى إعادة إرسال رسالتك.';
    res.json({ text: replyText });

  } catch (error: any) {
    console.error('Gemini API Integration Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء معالجة المحادثة الروتينية الذكية.' });
  }
});

// Serve Frontend client with hot-reloading in Development vs Static in Production
async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback for React SPA sub-routes (like /chat or /admin) in Development Mode
    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const fs = await import('fs');
        const indexPath = path.join(process.cwd(), 'index.html');
        let html = fs.readFileSync(indexPath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server loaded and listening on port ${PORT}`);
  });
}

startServer();
