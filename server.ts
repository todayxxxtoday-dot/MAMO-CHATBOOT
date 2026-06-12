import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import dotenv from 'dotenv';

dotenv.config();

// Safe lazy-loader for GoogleGenAI to ensure environment variables are correctly read at runtime
let aiInstance: any = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

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

// Helper function to match and generate highly intelligent contextual replies in Arabic
function getSmartFallbackReply(userMessage: string, productsList: any[], storeSettings: any, currencySuffix: string): string {
  if (!userMessage) return 'مرحباً بك! كيف يمكنني مساعدتك اليوم؟';
  const storeName = storeSettings?.storeName || 'الأجهزة المنزلية والكهربائية';
  const businessType = storeSettings?.businessType || 'شركة';
  const location = storeSettings?.location || 'الرياض، المملكة العربية السعودية';
  const whatsapp = storeSettings?.whatsapp || 'غير متاح حالياً';
  const phone = storeSettings?.contactNumber || 'غير متاح حالياً';
  
  const msgLower = userMessage.toLowerCase().trim();

  // Developer / Creator identification query matching
  const isDevKeywords = [
    'من صنعك', 'من طورك', 'من برمجك', 'من سواك', 'مين عملك', 'مين طورك', 'مين برمجك', 'من المبرمج',
    'من المطور', 'مين المبرمج', 'مين المطور', 'من صنع هذا البوت', 'من برمج هذا البوت', 'من طور هذا البوت',
    'صانع البوت', 'مبرمج البوت', 'مطور البوت', 'صانع المساعد', 'مبرمج المساعد', 'مطور المساعد',
    'من صممك', 'مين صممك', 'من صمم هذا البوت', 'مين صمم هذا البوت', 'مبرمجك', 'صانعك', 'مطورك',
    'من صنع المساعد', 'من برمج المساعد', 'من طور المساعد', 'من هو مطورك', 'من هو مبرمجك'
  ].some(kw => msgLower.includes(kw)) || 
  /(من\s+)?(برمج|طوّر|صنع|صمّم|أنشأ|عمل)\s+(البوت|المساعد|الذكاء|النظام|هذا)/.test(msgLower) ||
  /برمجك|صنعك|طوّرك|مطورك|مبرمجك|صانعك/.test(msgLower);

  if (isDevKeywords) {
    return 'لقد تم تطويري وتصميمي وبرمجتي بالكامل بواسطة الأخ المبدع والكريم "أبو لؤي" حفظه الله ورعاه، لخدمتكم بأحدث تقنيات الذكاء الاصطناعي التفاعلية.';
  }

  // 1. GREETINGS
  if (/^(مرحبا|مرحباً|السلام|سلام|أهلاً|اهلا|صباح|مساء|كيف الحال|مرحبتين|مرحبا بك|أهلين|اهلين)/.test(msgLower)) {
    return `أهلاً ومرحباً بكم في ${businessType} "${storeName}" للأجهزة المنزلية والكهربائية. يسعدنا جداً الرد على استفساراتكم ومساعدتكم في تصفح عروضنا الرائعة والأجهزة المتاحة بالمستودعات بأسعارها الحالية. كيف يمكننا خدمتكم اليوم؟`;
  }

  // 2. CONTACT AND ADDRESS / SHIPPING
  if (/(مكان|موقع|عنوان|وين|وينكم|بلد|مدينة|فرع|فروع|تواصل|رقم|هاتف|تلفون|موبايل|واتس|واتساب|إيميل|ايميل|شراء|حجز|طلب|طريقة الشراء|كيف اشتري)/.test(msgLower)) {
    let response = `يسعدنا ويشرفنا تواصلكم وخدمتكم في ${businessType} "${storeName}". إليكم تفاصيل العنوان والاتصال المباشر لخدمتكم وإتمام طلباتكم وحجز الأجهزة:\n\n`;
    if (location) response += `📍 **الموقع الرئيسي:** ${location}\n`;
    if (whatsapp) response += `💬 **المبيعات الفورية (واتساب):** ${whatsapp}\n`;
    if (phone) response += `📞 **رقم الاتصال المباشر:** ${phone}\n`;
    response += `\nتفضل بالمراسلة معنا في أي وقت لتأكيد حجز أي جهاز وتنسيق الشحن والتوصيل السريع!`;
    return response;
  }

  // 3. PRODUCT-SPECIFIC SEARCH
  const matchedProducts: any[] = [];
  productsList.forEach(p => {
    const pName = (p.name || '').toLowerCase();
    const pCat = (p.category || '').toLowerCase();
    const pBrand = (p.brand || '').toLowerCase();
    const pDesc = (p.description || '').toLowerCase();

    // Split query and search for keywords
    const keywords = msgLower.split(/[\s,]+/);
    const hasMatch = keywords.some(kw => {
      if (kw.length <= 2) return false;
      return pName.includes(kw) || pCat.includes(kw) || pBrand.includes(kw) || pDesc.includes(kw);
    });

    if (hasMatch || msgLower.includes(pCat) || msgLower.includes(pBrand)) {
      matchedProducts.push(p);
    }
  });

  if (matchedProducts.length > 0) {
    let response = `أهلاً بكم! إليكم تفاصيل الأجهزة المتوفرة لدينا حالياً والتي تطابق استفساركم في صالات عرض "${storeName}":\n\n`;
    matchedProducts.slice(0, 3).forEach((p, idx) => {
      const avail = p.isAvailable && p.quantity > 0 ? `متوفر (الكمية المتاحة: ${p.quantity})` : 'غير متوفر حالياً';
      response += `${idx + 1}. **${p.name}**\n   - **الماركة:** ${p.brand}\n   - **السعر الحالي:** ${p.price} ${currencySuffix}\n   - **التوفر:** ${avail}\n   - **المواصفات:** ${p.description || 'جهاز كهربائي أصلي بكفالة وجودة ممتازة'}\n\n`;
    });
    response += `لإتمام الشراء وحجز الجهاز، يمكنكم المراسلة عير الواتساب: ${whatsapp} أو بالهاتف: ${phone}. هل ترغب بطلب تفاصيل أخرى؟`;
    return response;
  }

  // 4. GENERAL STATUS & PRODUCTS LISTING
  if (/(أجهزة|اجهزة|منتجات|متوفر|موجود|عرض|عروض|عنكم|شو في|ماذا يوجد|المستودع|قائمة|قسم|تبيعوا)/.test(msgLower)) {
    let response = `أهلاً بكم في ${businessType} "${storeName}". يسعدنا تزويدكم بنماذج من الأجهزة الكهربائية العالية الجودة المتوفرة في مستودعنا حالياً:\n\n`;
    productsList.slice(0, 5).forEach((p, idx) => {
      response += `🔹 **${p.name}** - السعر: ${p.price} ${currencySuffix} (${p.isAvailable ? 'متوفر' : 'غير متوفر'})\n`;
    });
    response += `\nلدينا تشكيلة متكاملة ومكفولة من الغسالات، الثلاجات، المكيفات، الشاشات، والأفران بماركات عالمية وأصلية. للطلب الفوري، يرجى تزويدنا باسم الجهاز، أو للتواصل عبر واتساب: ${whatsapp}.`;
    return response;
  }

  // 4.5. KNOWLEDGE BASE MATCHING (Fallback check against custom store facts)
  const kbText = storeSettings?.knowledgeBase || '';
  if (kbText) {
    const kbLines = kbText.split('\n');
    const matchedLines = kbLines.filter((line: string) => {
      const lineClean = line.toLowerCase().trim();
      const words = msgLower.split(/[\s,]+/);
      return words.some(w => w.length > 2 && lineClean.includes(w));
    });
    if (matchedLines.length > 0) {
      return `أهلاً بك! بناءً على معلومات وقاعدة المعرفة المعتمدة لدينا في "${storeName}":\n\n${matchedLines.slice(0, 4).join('\n')}\n\nللحصول على المزيد من التفاصيل أو لتلقي الدعم الفوري، يسعدنا تواصلكم عبر الواتساب على الرقم: ${whatsapp} أو هاتفياً: ${phone}.`;
    }
  }

  // 5. DEFAULT POLITE COUNTER-QUESTION
  return `مرحباً بك! نحن نرحب بك في ${businessType} "${storeName}". أنا مساعدك الذكي المخصص لخدمتك وتزويدك بأسعار ومواصفات أجهزتنا الكهربائية والمنزلية.\n\nلمساعدتك بأفضل شكل، هل تبحث عن جهاز محدد بالاسم أو الماركة (مثل غسالة، ثلاجة، شاشة، مكيف هواء أو ميكروويف)؟\nكما يمكنك دائماً التواصل المباشر مع صالة المبيعات عبر الواتساب للطلب الفوري: ${whatsapp} أو الهاتف: ${phone}.`;
}

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
    const knowledgeBase = storeSettings?.knowledgeBase || '';

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

${knowledgeBase ? `قاعدة المعرفة والمعلومات الحقيقية الرسمية المعتمدة للمنشأة (Knowledge Base):\n${knowledgeBase}\n\nيجب عليك دمج واستشارة هذه الحقائق عند الإجابة على أي سؤال متعلق بها بدقة بالغة وبنفس تفاصيلها.` : ''}

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

5. التدريب على الاستفسار عن المسابقات والجوائز الذكية ودعم صفحة الفيسبوك الخاصة بكم:
- السؤال: "أنا مهتم بالمسابقات والجوائز" أو "ما هي شروط الربح؟" أو "كيف يمكنني دعم صفحة الفيسبوك" أو "كيف أشترك بالمسابقة وهل يوجد جوائز؟"
- الرد التدريبي: "أهلاً ومرحباً بك يا صديقنا العزيز! يسعدنا جداً اهتمامك بالمشاركة ودعمنا. للمشاركة في مسابقاتنا وجوائزنا الأسبوعية الكبرى ودخول السحب للفوز بأحد أجهزتنا المنزلية أو الكهربائية المميزة، يرجى القيام ببعض خطوات الدعم البسيطة: (1) الإعجاب والمتابعة لصفحتنا الرسمية على الفيسبوك، (2) مشاركة المنشور التعريفي أو منشور المسابقات المثبت على صفحتك العامة مع تفعيل هاشتاج المتجر المعتمد، (3) كتابة تعليق مميز يذكر جهازك المفضّل من مستودعاتنا ودعوة أصدقائك للإعجاب بالتعليق. السحوبات حقيقية وموثوقة كلياً وتتم بشفافية تامة في بث مباشر أسبوعي. نتمنى لك حظاً رائعاً وفريداً ومستمر للربح معنا!"

ضوابط إرشادية هامة:
1. لا تقدم أي وعود أو تدرج معلومات بخصوص شروط تفعيل الضمانات أو مميزات إضافية أو مجانية الشحن والتوصيل وطرق السداد الإضافية (مثل كاشير أو تابي أو ميزة تقسيط محددة) إلا إذا كانت واردة ومسجلة في توجيهات الشات بوت المخصصة الموضحة أعلاه.
2. التزم بالرد بنبرة مهذبة وموثوقة، وباللغة العربية الفصحى المبسطة والمهنية، وتجنب استخدام أي كلمات من اللهجة السورية أو المبالغات أو عبارات المديح، وكن واضحاً ومختصراً قدر الإمكان.
3. إذا سأل العميل عن أمور لم يتم تدريبه عليها أو غير مسجلة صراحة، ولكنها تتعلق بدعم المتجر والفيسبوك والمسابقات والربح أو المسائل المعتمدة للمتجر، فجاوبه بلباقة شديدة ودعه يشعر دائماً بالحماس والترحيب لدعم المتجر والمشاركة. وبغير ذلك، إذا سأل العميل عن أمور بعيدة عن نطاق الأجهزة والمسابقات والمنشأة كلياً، فاعتذر بلطف واحترافية وبشكل مقتضب باللغة العربية الفصحى المبسطة والمهنية دون اللجوء لأي لهجات أخرى.`;

    // Map and sanitize conversation history to Gemini schema (user / model)
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
          lastMsg.parts[0].text += '\n' + m.text;
        } else {
          formattedContents.push({
            role,
            parts: [{ text: m.text }]
          });
        }
      }
    });

    if (formattedContents.length === 0) {
      formattedContents.push({
        role: 'user',
        parts: [{ text: 'مرحباً، كيف حالكم؟' }]
      });
    }

    const lastUserQuery = sortedHistory.filter((m: any) => m && m.sender === 'user').pop()?.text || 'مرحباً';
    const msgLower = lastUserQuery.trim().toLowerCase();

    // Direct super-fast interceptor for developer / creator identification queries to guarantee speed & consistency
    const isDevQuery = [
      'من صنعك', 'من طورك', 'من برمجك', 'من سواك', 'مين عملك', 'مين طورك', 'مين برمجك', 'من المبرمج',
      'من المطور', 'مين المبرمج', 'مين المطور', 'من صنع هذا البوت', 'من برمج هذا البوت', 'من طور هذا البوت',
      'صانع البوت', 'مبرمج البوت', 'مطور البوت', 'صانع المساعد', 'مبرمج المساعد', 'مطور المساعد',
      'من صممك', 'مين صممك', 'من صمم هذا البوت', 'مين صمم هذا البوت', 'مبرمجك', 'صانعك', 'مطورك',
      'من صنع المساعد', 'من برمج المساعد', 'من طور المساعد', 'من هو مطورك', 'من هو مبرمجك'
    ].some(kw => msgLower.includes(kw)) || 
    /(من\s+)?(برمج|طوّر|صنع|صمّم|أنشأ|عمل)\s+(البوت|المساعد|الذكاء|النظام|هذا)/.test(msgLower) ||
    /برمجك|صنعك|طوّرك|مطورك|مبرمجك|صانعك/.test(msgLower);

    if (isDevQuery) {
      console.log('Developer query intercepted. Returning premium developer attribution instantly.');
      return res.json({ 
        text: 'لقد تم تطويري وتصميمي وبرمجتي بالكامل بواسطة الأخ المبدع والكريم "أبو لؤي" حفظه الله ورعاه، لخدمتكم بأحدث تقنيات الذكاء الاصطناعي التفاعلية.' 
      });
    }

    let replyText = '';
    const aiClient = getGeminiClient();

    if (aiClient) {
      try {
        console.log('Attempting primary Gemini call using model gemini-3.5-flash with low latency configuration...');
        const response = await aiClient.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: formattedContents,
          config: {
            systemInstruction: systemInstruction + '\n⚠️ تنبيه هام لسرعة فائقة وسياق دقيق: يجب أن تكون الإجابات موضوعية، مباشرة، لبقة، ومقنعة جداً للعميل في حدود سطرين إلى 3 أسطر فقط كحد أقصى، وباللغة العربية الفصحى الفائقة والواضحة.\nإذا كان السؤال يتعلق بمطورك أو صانعك فالمبرمج هو "الأخ أبو لؤي".',
            temperature: 0.1, // Set lower temperature for higher speed, focus, and logical determinism
            maxOutputTokens: 250
          }
        });
        replyText = response.text || '';
      } catch (primaryErr: any) {
        console.error('Gemini call failed, executing fallback matcher:', primaryErr.message || primaryErr);
        replyText = getSmartFallbackReply(lastUserQuery, productsList, storeSettings, currencySuffix);
      }
    } else {
      console.log('Gemini client not initialized, executing fallback matcher directly.');
      replyText = getSmartFallbackReply(lastUserQuery, productsList, storeSettings, currencySuffix);
    }

    res.json({ text: replyText });

  } catch (error: any) {
    console.error('Critical Router Exception in Chat endpoint, implementing safe local query mapping:', error);
    try {
      // Direct graceful safety net in case of extreme failures
      let queryVal = 'أهلاً ومرحباً';
      if (req.body && Array.isArray(req.body.messages)) {
        queryVal = req.body.messages.filter((m: any) => m && m.sender === 'user').pop()?.text || queryVal;
      }
      const absoluteFallback = `أعتذر عن الاضطراب المؤقت في الخوادم السحابية الذكية حالياً. ومع ذلك، يسعدنا تلبية طلباتكم فوراً! تفضلوا بالتواصل مع فريق المبيعات مباشرة عبر الواتساب على الرقم المخصص للحجوزات لتأكيد طلبكم وإعطائكم عرض السعر الفوري للأجهزة المطلوبة. تفاصيل التواصل متوفرة في لوحة معلومات المتجر.`;
      res.json({ text: absoluteFallback });
    } catch (nestedErr) {
      res.json({ text: 'أهلاً بك. الخوادم السحابية تحت الصيانة لثوانٍ معدودة. تفضل بالتواصل معنا عبر رقم الواتساب لحجز أجهزتكم والاستفسار مباشرة!' });
    }
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
