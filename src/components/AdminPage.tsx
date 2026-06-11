import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  limit,
  setDoc
} from 'firebase/firestore';
import { Product, Conversation } from '../types';
import { 
  Plus, Edit2, Trash2, LogOut, CheckCircle, Search, 
  Filter, Calendar, Archive, MessageSquare, Package, 
  Eye, CornerDownLeft, Circle, Sparkles, LogIn, Lock,
  Sun, Moon, QrCode, Printer, Download, ExternalLink, Copy, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth form states
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('admin@store.com');
  const [password, setPassword] = useState('123456');
  const [authError, setAuthError] = useState('');

  // Tab state (supporting direct deep linking)
  const [activeTab, setActiveTab] = useState<'products' | 'chats' | 'settings'>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'chats' || tab === 'settings' || tab === 'products') {
      return tab;
    }
    return 'products';
  });

  // Firestore states: Settings
  const [storeNameValue, setStoreNameValue] = useState('');
  const [businessTypeValue, setBusinessTypeValue] = useState<'متجر' | 'شركة'>('شركة');
  const [currencyValue, setCurrencyValue] = useState<'ليرة سورية' | 'دولار' | 'ر.س'>('ليرة سورية');
  const [logoUrlValue, setLogoUrlValue] = useState('');
  const [locationValue, setLocationValue] = useState('');
  const [whatsappValue, setWhatsappValue] = useState('');
  const [contactNumberValue, setContactNumberValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [botPrimaryColorValue, setBotPrimaryColorValue] = useState('#800020');
  const [botTextColorValue, setBotTextColorValue] = useState('#ffffff');
  const [botInstructionsValue, setBotInstructionsValue] = useState('');
  const [botWelcomeMessageValue, setBotWelcomeMessageValue] = useState('');
  const [botEmployeeNameValue, setBotEmployeeNameValue] = useState('سارة (ممثلة المبيعات)');
  const [botResponseSpeedValue, setBotResponseSpeedValue] = useState('medium');
  const [botAvatarValue, setBotAvatarValue] = useState('');
  const [maintenanceModeValue, setMaintenanceModeValue] = useState(false);
  const [maintenanceMessageValue, setMaintenanceMessageValue] = useState('نحن نقوم ببعض عمليات الصيانة والتحديثات لخدمتكم بشكل أفضل؛ سنعود في أقرب وقت!');
  const [knowledgeBaseValue, setKnowledgeBaseValue] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Dark Mode state (initialized from localStorage)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('admin-dark-mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('admin-dark-mode', String(darkMode));
  }, [darkMode]);

  // Firestore states: Products
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Product form input states
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('ثلاجات');
  const [prodBrand, setProdBrand] = useState('');
  const [prodPrice, setProdPrice] = useState(0);
  const [prodQuantity, setProdQuantity] = useState(1);
  const [prodDesc, setProdDesc] = useState('');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodAvailable, setProdAvailable] = useState(true);

  // States for live direct inline products table editing
  const [viewMode, setViewMode] = useState<'cards' | 'quick-table'>('quick-table');
  const [modifiedRows, setModifiedRows] = useState<Record<string, Partial<Product>>>({});
  const [inlineSavingId, setInlineSavingId] = useState<string | null>(null);

  // Quick add row states inside the table
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddBrand, setQuickAddBrand] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('ثلاجات');
  const [quickAddPrice, setQuickAddPrice] = useState<number>(0);
  const [quickAddQty, setQuickAddQty] = useState<number>(1);
  const [quickAddDesc, setQuickAddDesc] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  const handleCellChange = (pId: string, field: keyof Product, value: any) => {
    setModifiedRows(prev => ({
      ...prev,
      [pId]: {
        ...prev[pId],
        [field]: value
      }
    }));
  };

  const getCellValue = (p: Product, field: keyof Product) => {
    if (modifiedRows[p.id!] && modifiedRows[p.id!][field] !== undefined) {
      return modifiedRows[p.id!][field];
    }
    return p[field];
  };

  const saveRowInline = async (p: Product) => {
    const rowChanges = modifiedRows[p.id!];
    if (!rowChanges) return;
    
    setInlineSavingId(p.id!);
    try {
      const docRef = doc(db, 'products', p.id!);
      const finalPayload = {
        ...p,
        ...rowChanges,
        updatedAt: new Date().toISOString()
      };
      delete finalPayload.id;

      await updateDoc(docRef, finalPayload);
      
      setModifiedRows(prev => {
        const copy = { ...prev };
        delete copy[p.id!];
        return copy;
      });
      alert('تم تحديث تفاصيل الجهاز فورا في قاعدة البيانات!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${p.id}`);
    } finally {
      setInlineSavingId(null);
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddName.trim() || !quickAddBrand.trim() || quickAddPrice <= 0) {
      alert('يرجى كتابة الاسم والماركة وسعراً صحيحاً لإضافة الجهاز!');
      return;
    }
    setIsQuickAdding(true);
    try {
      const payload = {
        name: quickAddName.trim(),
        brand: quickAddBrand.trim(),
        category: quickAddCategory,
        price: Number(quickAddPrice),
        quantity: Number(quickAddQty),
        description: quickAddDesc.trim(),
        imageUrl: '',
        isAvailable: true,
        updatedAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'products'), payload);
      
      // Reset
      setQuickAddName('');
      setQuickAddBrand('');
      setQuickAddCategory('ثلاجات');
      setQuickAddPrice(0);
      setQuickAddQty(1);
      setQuickAddDesc('');
      alert('تمت إضافة الجهاز مباشرة وتحديث السجل فورا في Firestore!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'products');
    } finally {
      setIsQuickAdding(false);
    }
  };

  // Firestore states: Customer Chats Log
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'active' | 'archived'>('all');
  const [dateSort, setDateSort] = useState<'newest' | 'oldest'>('newest');

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Listen to Products in Firestore (real-time updates)
  useEffect(() => {
    if (!currentUser) return;
    setLoadingProducts(true);
    
    // Bind snapshot query to automatically update the dashboard state
    const productsQuery = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(items);
      setLoadingProducts(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoadingProducts(false);
    });

    return unsubscribe;
  }, [currentUser]);

  // Listen to Conversation logs in Firestore (real-time logs for the merchant)
  useEffect(() => {
    if (!currentUser) return;
    setLoadingConversations(true);

    const conversationsQuery = query(collection(db, 'conversations'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
      const logs: Conversation[] = [];
      snapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() } as Conversation);
      });
      setConversations(logs);
      setLoadingConversations(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
      setLoadingConversations(false);
    });

    return unsubscribe;
  }, [currentUser]);

  // Listen to Settings in Firestore (real-time updates)
  useEffect(() => {
    if (!currentUser) return;
    setLoadingSettings(true);
    const settingsDocRef = doc(db, 'settings', 'store');
    
    const unsubscribe = onSnapshot(settingsDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setStoreNameValue(data.storeName || '');
        setBusinessTypeValue(data.businessType || 'شركة');
        setCurrencyValue(data.currency || 'ليرة سورية');
        setLogoUrlValue(data.logoUrl || '');
        setLocationValue(data.location || '');
        setWhatsappValue(data.whatsapp || '');
        setContactNumberValue(data.contactNumber || '');
        setEmailValue(data.email || '');
        setBotPrimaryColorValue(data.botPrimaryColor || '#800020');
        setBotTextColorValue(data.botTextColor || '#ffffff');
        setBotInstructionsValue(data.botInstructions || '');
        setBotWelcomeMessageValue(data.botWelcomeMessage || '');
        setBotEmployeeNameValue(data.botEmployeeName || 'سارة (ممثلة المبيعات)');
        setBotResponseSpeedValue(data.botResponseSpeed || 'medium');
        setBotAvatarValue(data.botAvatar || '');
        setMaintenanceModeValue(!!data.maintenanceMode);
        setMaintenanceMessageValue(data.maintenanceMessage || 'نحن نقوم ببعض عمليات الصيانة والتحديثات لخدمتكم بشكل أفضل؛ سنعود في أقرب وقت!');
        setKnowledgeBaseValue(data.knowledgeBase || '');
      } else {
        // Instantiate defaults if settings doesn't exist
        setStoreNameValue('شركة مامو للأجهزة المنزلية والكهربائية');
        setBusinessTypeValue('شركة');
        setCurrencyValue('ليرة سورية');
        setLogoUrlValue('');
        setLocationValue('الرياض، المملكة العربية السعودية');
        setWhatsappValue('966500000000');
        setContactNumberValue('966500000000');
        setEmailValue('info@store.com');
        setBotPrimaryColorValue('#800020');
        setBotTextColorValue('#ffffff');
        setBotWelcomeMessageValue('مرحباً بك في شركة مامو للأجهزة المنزلية والكهربائية الذكية! كيف يمكنني مساعدتكم اليوم في تصفح الأجهزة المتوفرة والأسعار؟');
        setBotInstructionsValue('يرجى الالتزام بالرد على الأسئلة المتعلقة بأسعار وتوفر الأجهزة المنزلية، وتجنب الإجابة على أي أسئلة خارج نطاق ذلك.');
        setBotEmployeeNameValue('سارة (ممثلة المبيعات)');
        setBotResponseSpeedValue('medium');
        setBotAvatarValue('');
        setMaintenanceModeValue(false);
        setMaintenanceMessageValue('نحن نقوم ببعض عمليات الصيانة والتحديثات لخدمتكم بشكل أفضل؛ سنعود في أقرب وقت!');
        setKnowledgeBaseValue('');
      }
      setLoadingSettings(false);
    }, (error) => {
      console.warn("Could not load settings in AdminPage snapshot:", error);
      setLoadingSettings(false);
    });

    return unsubscribe;
  }, [currentUser]);

  const saveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const docRef = doc(db, 'settings', 'store');
      await setDoc(docRef, {
        storeName: storeNameValue.trim(),
        businessType: businessTypeValue,
        logoUrl: logoUrlValue.trim(),
        location: locationValue.trim(),
        whatsapp: whatsappValue.trim(),
        contactNumber: contactNumberValue.trim(),
        email: emailValue.trim(),
        botPrimaryColor: botPrimaryColorValue.trim(),
        botTextColor: botTextColorValue.trim(),
        botInstructions: botInstructionsValue.trim(),
        botWelcomeMessage: botWelcomeMessageValue.trim(),
        botEmployeeName: botEmployeeNameValue.trim(),
        botResponseSpeed: botResponseSpeedValue.trim(),
        botAvatar: botAvatarValue.trim(),
        maintenanceMode: !!maintenanceModeValue,
        maintenanceMessage: maintenanceMessageValue.trim(),
        knowledgeBase: knowledgeBaseValue.trim(),
        currency: currencyValue,
        updatedAt: new Date().toISOString()
      });
      alert('تم حفظ إعدادات المنشأة والشات بوت بنجاح!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/store');
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle Login or Signup securely
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!email || !password) {
      setAuthError('يرجى كتابة البريد الإلكتروني وكلمة المرور.');
      return;
    }

    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setAuthError('بيانات الدخول غير صحيحة، يرجى إعادة المحاولة.');
      } else if (err.code === 'auth/weak-password') {
        setAuthError('كلمة المرور ضعيفة جداً، يرجى كتابة 6 أحرف على الأقل.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('البريد الإلكتروني مسجل بالفعل لمستخدم آخر.');
      } else {
        setAuthError('حدث خطأ أثناء الاتصال بالنظام، يرجى المحاولة لاحقاً.');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSelectedConversation(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Product Actions (CRUD)
  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodBrand || prodPrice <= 0) {
      alert('يرجى ملء جميع الحقول الإلزامية برقم صحيح.');
      return;
    }

    const payload = {
      name: prodName.trim(),
      category: prodCategory,
      brand: prodBrand.trim(),
      price: Number(prodPrice),
      quantity: Number(prodQuantity),
      description: prodDesc.trim(),
      imageUrl: prodImageUrl ? prodImageUrl.trim() : '',
      isAvailable: prodAvailable,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        // UPDATE Product
        const docRef = doc(db, 'products', editingId);
        await updateDoc(docRef, payload);
      } else {
        // CREATE Product
        const collRef = collection(db, 'products');
        await addDoc(collRef, payload);
      }
      
      // Cleanup visual states
      resetProductForm();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const resetProductForm = () => {
    setEditingId(null);
    setProdName('');
    setProdCategory('ثلاجات');
    setProdBrand('');
    setProdPrice(0);
    setProdQuantity(1);
    setProdDesc('');
    setProdImageUrl('');
    setProdAvailable(true);
    setShowProductForm(false);
  };

  const startEditProduct = (p: Product) => {
    setEditingId(p.id || null);
    setProdName(p.name);
    setProdCategory(p.category);
    setProdBrand(p.brand);
    setProdPrice(p.price);
    setProdQuantity(p.quantity);
    setProdDesc(p.description);
    setProdImageUrl(p.imageUrl);
    setProdAvailable(p.isAvailable);
    setShowProductForm(true);
  };

  const deleteProductItem = async (id?: string) => {
    if (!id || !window.confirm('هل أنت متأكد من رغبتك في حذف هذا المنتج نهائياً من المتجر؟')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
    }
  };

  // Chat Administration
  const setChatStatus = async (convId: string, newStatus: 'pending' | 'active' | 'resolved' | 'archived') => {
    try {
      const docRef = doc(db, 'conversations', convId);
      await updateDoc(docRef, { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      // Update selected inspector conversation automatically matching change
      if (selectedConversation && selectedConversation.id === convId) {
        setSelectedConversation(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${convId}`);
    }
  };

  const deleteChatLog = async (id?: string) => {
    if (!id || !window.confirm('هل تريد مسح سجل هذه المحادثة نهائياً من قاعدة البيانات؟')) return;
    try {
      await deleteDoc(doc(db, 'conversations', id));
      setSelectedConversation(null);
      alert('تم حذف المحادثة بنجاح من قاعدة البيانات.');
    } catch (err: any) {
      console.error("Delete conversation error:", err);
      alert('فشل حذف المحادثة: ' + (err?.message || 'خطأ غير معروف في الصلاحيات.'));
      handleFirestoreError(err, OperationType.DELETE, `conversations/${id}`);
    }
  };

  const clearAllConversations = async () => {
    if (conversations.length === 0) {
      alert('لا توجد محادثات لتصفيرها حالياً.');
      return;
    }
    if (!window.confirm('هل أنت متأكد تماماً من رغبتك في تصفير (مسح) جميع سجلات المحادثات نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
      setLoadingConversations(true);
      const querySnapshot = await getDocs(collection(db, 'conversations'));
      const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, 'conversations', docSnap.id)));
      await Promise.all(deletePromises);
      setSelectedConversation(null);
      alert('تم تصفير وحذف جميع المحادثات بنجاح من الخادم!');
    } catch (err: any) {
      console.error("Clear all conversations error:", err);
      alert('فشل تصفير المحادثات: ' + (err?.message || 'تأكد من صلاحيات الخادم والاتصال بقاعدة البيانات.'));
      handleFirestoreError(err, OperationType.DELETE, 'conversations');
    } finally {
      setLoadingConversations(false);
    }
  };

  // Filtering Logic for Chat Logs
  const filteredConversations = conversations
    .filter(log => {
      // Name Search
      const matchesSearch = log.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            log.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            log.messages.some(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()));
      // Category Match
      const matchesStatus = statusFilter === 'all' ? true : log.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateSort === 'newest' ? dateB - dateA : dateA - dateB;
    });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-sans" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-500 font-medium">جاري التحقق من الهوية...</span>
        </div>
      </div>
    );
  }

  // Not Logged In View
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12 font-sans selection:bg-neutral-100" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-150 shadow-sm rounded p-8 max-w-sm w-full"
        >
          {/* Form Header */}
          <div className="text-center mb-6">
            <div className="inline-flex w-10 h-10 bg-zinc-100 text-black rounded items-center justify-center border border-zinc-200 mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">لوحة تحكم التاجر</h1>
            <p className="text-xs text-gray-500 mt-1 font-medium">سجل الدخول لإدارة المخزون وتصفح سجل محادثات العملاء</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 focus:outline-none">البريد الإلكتروني للتاجر</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@store.com"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-gray-900 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">كلمة مرور الحساب</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-gray-900 transition-all"
                required
              />
            </div>

            {authError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-3 font-semibold flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-black hover:bg-neutral-900 text-white rounded text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{isRegisterMode ? 'إنشاء حساب تاجر جديد' : 'الدخول إلى لوحة التحكم'}</span>
            </button>
          </form>

          {/* Dummy account tips */}
          <div className="bg-zinc-50 border border-zinc-150 rounded p-3.5 mt-5 text-[11px] leading-relaxed text-zinc-600 font-medium">
            💡 <strong>ملاحظة تجريبية:</strong> يمكنك إنشاء حساب جديد مباشرة، أو الاستفادة من البريد التجريبي الافتراضي المعبّأ أعلاه لتجربة لوحة التاجر على وجه السرعة.
          </div>

          <div className="text-center mt-6 border-t border-gray-50 pt-4">
            <button
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setAuthError('');
              }}
              className="text-xs font-bold text-black hover:underline cursor-pointer"
            >
              {isRegisterMode ? 'لديك حساب بالفعل؟ سجل الدخول الآن' : 'ليس لديك حساب؟ أنشئ حساباً جديداً'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Admin Workspace View
  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      darkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-gray-900'
    }`} dir="rtl">
      {/* Admin Navbar */}
      <nav className={`border-b h-16 px-8 sticky top-0 z-45 flex items-center transition-colors duration-200 ${
        darkMode ? 'bg-zinc-90 w-full border-zinc-800 bg-zinc-900' : 'bg-white border-gray-100'
      }`}>
        <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded flex items-center justify-center ${darkMode ? 'bg-zinc-100' : 'bg-black'}`}>
              <div className={`w-4 h-4 border-2 ${darkMode ? 'border-zinc-900' : 'border-white'}`}></div>
            </div>
            <div>
              <h1 className={`text-base font-bold tracking-tight transition-colors ${
                darkMode ? 'text-zinc-100' : 'text-gray-900'
              }`}>لوحة إدارة المتجر</h1>
              <span className={`text-[11px] font-medium font-mono ${darkMode ? 'text-zinc-500' : 'text-gray-400'}`} dir="ltr">{currentUser.email}</span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('products')}
              className={`relative p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                activeTab === 'products'
                  ? (darkMode ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-bold' : 'bg-black border-black text-white font-bold')
                  : (darkMode ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-850' : 'bg-white text-gray-500 border-gray-150 hover:bg-gray-50/50')
              }`}
              title={`إدارة المنتجات والمخزن (${products.length} من المنتجات)`}
            >
              <Package className="w-5 h-5" />
              {products.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-indigo-500 text-white font-mono font-bold text-[8px] rounded-full px-1.5 py-0.5 shadow-sm scale-90">
                  {products.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('chats')}
              className={`relative p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                activeTab === 'chats'
                  ? (darkMode ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-bold' : 'bg-black border-black text-white font-bold')
                  : (darkMode ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-850' : 'bg-white text-gray-500 border-gray-150 hover:bg-gray-50/50')
              }`}
              title={`المحادثات الجارية والعملاء (${conversations.length} محادثة)`}
            >
              <MessageSquare className="w-5 h-5" />
              {conversations.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white font-mono font-bold text-[8px] rounded-full px-1.5 py-0.5 shadow-sm scale-90">
                  {conversations.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`relative p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                activeTab === 'settings'
                  ? (darkMode ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-bold' : 'bg-black border-black text-white font-bold')
                  : (darkMode ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-850' : 'bg-white text-gray-500 border-gray-150 hover:bg-gray-50/50')
              }`}
              title="إعدادات المتجر وهوية الشات بوت"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className={`h-4 w-px mx-1 ${darkMode ? 'bg-zinc-800' : 'bg-gray-200'}`}></div>

            {/* Dark Mode Toggle Switch */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded border transition-all cursor-pointer flex items-center justify-center ${
                darkMode 
                  ? 'bg-zinc-900 border-zinc-800 text-yellow-400 hover:bg-zinc-800' 
                  : 'bg-white border-gray-150 text-gray-500 hover:bg-gray-50'
              }`}
              title={darkMode ? 'الوضع المضيء' : 'الوضع الداكن'}
              type="button"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleLogout}
              className={`px-3 py-2 border rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                darkMode
                  ? 'text-red-400 hover:text-red-350 bg-red-950/20 hover:bg-red-950/40 border-red-900/50'
                  : 'text-red-500 hover:text-red-600 bg-red-50/30 hover:bg-red-50 border-red-100'
              }`}
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        
        {/* TAB 1: PRODUCTS INVENTORY */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className={`flex items-center justify-between border-b pb-2.5 ${
              darkMode ? 'border-zinc-800' : 'border-gray-100'
            }`}>
              <div>
                <h2 className={`text-md font-bold transition-colors ${
                  darkMode ? 'text-zinc-100' : 'text-gray-900'
                }`}>إدارة المخزون</h2>
              </div>
              <button
                onClick={() => {
                  if (showProductForm) resetProductForm();
                  else setShowProductForm(true);
                }}
                className={`px-4 py-2 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  darkMode ? 'bg-zinc-100 text-neutral-950 hover:bg-zinc-250' : 'bg-black hover:bg-neutral-900 text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>إضافة منتج جديد</span>
              </button>
            </div>

            {/* EXPANDABLE ADD/EDIT PRODUCT FORM */}
            <AnimatePresence>
              {showProductForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`border rounded p-6 overflow-hidden ${
                    darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-150'
                  }`}
                >
                  <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 ${
                    darkMode ? 'text-zinc-500' : 'text-gray-400'
                  }`}>
                    <div className={`w-2.5 h-2.5 rounded ${darkMode ? 'bg-zinc-100' : 'bg-black'}`}></div>
                    <span>{editingId ? 'تعديل بيانات المنتج الحالي' : 'إضافة منتج جديد'}</span>
                  </h3>

                  <form onSubmit={saveProduct} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={`text-xs font-medium block mb-1 ${
                        darkMode ? 'text-zinc-300' : 'text-gray-600'
                      }`}>اسم المنتج</label>
                      <input
                        type="text"
                        value={prodName}
                        onChange={(e) => setProdName(e.target.value)}
                        placeholder="مثال: ثلاجة ذكية"
                        className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 text-gray-900 ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-zinc-600 focus:border-zinc-600 placeholder-zinc-700' 
                            : 'bg-white border-gray-200 focus:ring-black focus:border-black'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label className={`text-xs font-medium block mb-1 ${
                        darkMode ? 'text-zinc-300' : 'text-gray-600'
                      }`}>الماركة (براند)</label>
                      <input
                        type="text"
                        value={prodBrand}
                        onChange={(e) => setProdBrand(e.target.value)}
                        placeholder="مثال: LG, Samsung"
                        className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 text-gray-900 ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-zinc-600 focus:border-zinc-600 placeholder-zinc-700' 
                            : 'bg-white border-gray-200 focus:ring-black focus:border-black'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label className={`text-xs font-medium block mb-1 ${
                        darkMode ? 'text-zinc-300' : 'text-gray-600'
                      }`}>التصنيف</label>
                      <select
                        value={prodCategory}
                        onChange={(e) => setProdCategory(e.target.value)}
                        className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 text-gray-900 ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-zinc-600 focus:border-zinc-600' 
                            : 'bg-white border-gray-200 focus:ring-black focus:border-black'
                        }`}
                      >
                        <option value="ثلاجات" className={darkMode ? 'bg-zinc-900' : ''}>ثلاجات ومجمدات</option>
                        <option value="غسالات" className={darkMode ? 'bg-zinc-900' : ''}>غسالات ونشافات</option>
                        <option value="مكيفات" className={darkMode ? 'bg-zinc-900' : ''}>أجهزة تكييف وتدفئة</option>
                        <option value="شاشات ورسيفرات" className={darkMode ? 'bg-zinc-900' : ''}>تلفزيونات وشاشات عرض</option>
                        <option value="ميكروويف وأفران" className={darkMode ? 'bg-zinc-900' : ''}>ميكروويف ومطابخ</option>
                        <option value="أجهزة صغيرة" className={darkMode ? 'bg-zinc-900' : ''}>أجهزة خلاطات ومكاوٍ وأخرى</option>
                      </select>
                    </div>

                    <div>
                      <label className={`text-xs font-medium block mb-1 ${
                        darkMode ? 'text-zinc-300' : 'text-gray-600'
                      }`}>
                        السعر ({currencyValue === 'دولار' ? 'دولار ($)' : currencyValue === 'ليرة سورية' ? 'ليرة سورية (ل.س)' : 'ر.س'})
                      </label>
                      <input
                        type="number"
                        value={prodPrice || ''}
                        onChange={(e) => setProdPrice(Number(e.target.value))}
                        placeholder="0.00"
                        className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 text-gray-900 ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-zinc-600 focus:border-zinc-600 placeholder-zinc-700' 
                            : 'bg-white border-gray-200 focus:ring-black focus:border-black'
                        }`}
                        min="1"
                        required
                      />
                    </div>

                    <div>
                      <label className={`text-xs font-medium block mb-1 ${
                        darkMode ? 'text-zinc-300' : 'text-gray-600'
                      }`}>الكمية المتوفرة</label>
                      <input
                        type="number"
                        value={prodQuantity}
                        onChange={(e) => setProdQuantity(Number(e.target.value))}
                        placeholder="0"
                        className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 text-gray-900 ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-zinc-600 focus:border-zinc-600 placeholder-zinc-700' 
                            : 'bg-white border-gray-200 focus:ring-black focus:border-black'
                        }`}
                        min="0"
                        required
                      />
                    </div>

                    <div>
                      <label className={`text-xs font-medium block mb-1 ${
                        darkMode ? 'text-zinc-300' : 'text-gray-600'
                      }`}>رابط صورة المنتج (اختياري)</label>
                      <input
                        type="url"
                        value={prodImageUrl}
                        onChange={(e) => setProdImageUrl(e.target.value)}
                        placeholder="رابط مباشر للصورة (اختياري)"
                        className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 text-gray-900 ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-zinc-600 focus:border-zinc-600 placeholder-zinc-700' 
                            : 'bg-white border-gray-200 focus:ring-black focus:border-black'
                        }`}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className={`text-xs font-medium block mb-1 ${
                        darkMode ? 'text-zinc-300' : 'text-gray-600'
                      }`}>المواصفات</label>
                      <input
                        type="text"
                        value={prodDesc}
                        onChange={(e) => setProdDesc(e.target.value)}
                        placeholder="سعة لترية، الألوان، شروط الكفالة..."
                        className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 text-gray-900 ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-zinc-650 focus:border-zinc-650 placeholder-zinc-700' 
                            : 'bg-white border-gray-200 focus:ring-black focus:border-black'
                        }`}
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        id="prodAvailable"
                        checked={prodAvailable}
                        onChange={(e) => setProdAvailable(e.target.checked)}
                        className={`w-4 h-4 rounded ${
                          darkMode ? 'bg-zinc-950 border-zinc-700 text-white focus:ring-0' : 'text-black border-gray-300 focus:ring-black'
                        }`}
                      />
                      <label htmlFor="prodAvailable" className={`text-xs font-medium cursor-pointer ${
                        darkMode ? 'text-zinc-300' : 'text-gray-600'
                      }`}>المنتج متوفر بالمخزن وجاهز للبيع</label>
                    </div>

                    <div className={`md:col-span-3 flex justify-end gap-2 border-t pt-4 ${
                      darkMode ? 'border-zinc-800' : 'border-gray-100'
                    }`}>
                      <button
                        type="button"
                        onClick={resetProductForm}
                        className={`px-4 py-2 rounded text-xs font-bold transition-colors cursor-pointer ${
                          darkMode ? 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-750' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        إلغاء التعديل
                      </button>
                      <button
                        type="submit"
                        className={`px-6 py-2 rounded text-xs font-bold transition-colors cursor-pointer ${
                          darkMode ? 'bg-zinc-100 text-zinc-950 hover:bg-zinc-200' : 'bg-black hover:bg-neutral-900 text-white'
                        }`}
                      >
                        {editingId ? 'حفظ التغييرات' : 'حفظ المنتج'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* VIEW MODE SELECTOR SWITCH */}
            <div className={`p-1 flex items-center gap-1 border rounded-xl max-w-md ${
              darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-gray-50 border-gray-200'
            }`}>
              <button
                type="button"
                onClick={() => setViewMode('quick-table')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  viewMode === 'quick-table'
                    ? (darkMode ? 'bg-zinc-100 text-zinc-950 shadow-sm font-extrabold' : 'bg-white border text-black shadow-xs font-extrabold')
                    : (darkMode ? 'text-zinc-400 hover:text-zinc-250' : 'text-gray-500 hover:text-gray-800')
                }`}
              >
                <span>محرر الأجهزة السريع (تعديل وتحديث فوري)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  viewMode === 'cards'
                    ? (darkMode ? 'bg-zinc-100 text-zinc-950 shadow-sm' : 'bg-white border text-black shadow-xs font-extrabold')
                    : (darkMode ? 'text-zinc-400 hover:text-zinc-250' : 'text-gray-500 hover:text-gray-800')
                }`}
              >
                <span>عرض كبطاقات للأجهزة</span>
              </button>
            </div>

            {/* PRODUCTS LIST GRID */}
            {loadingProducts ? (
              <div className="flex justify-center py-12">
                <span className="text-xs text-gray-400 font-medium">جاري قراءة المنتجات...</span>
              </div>
            ) : products.length === 0 ? (
              <div className={`border rounded p-12 text-center ${
                darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100'
              }`}>
                <Package className={`w-12 h-12 mx-auto mb-3 ${darkMode ? 'text-zinc-700' : 'text-gray-300'}`} />
                <h3 className={`text-base font-bold ${darkMode ? 'text-zinc-200' : 'text-gray-800'}`}>لا يوجد أجهزة في المستودع حالياً</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">تفضل بتعبئة صف الإضافة الفوري في الجدول أو اضغط على (إضافة منتج جديد) للبدء.</p>
              </div>
            ) : viewMode === 'quick-table' ? (
              /* DYNAMIC INLINE SPREADSHEET TABLE EDITING WITH INSTANT FIRESTORE RECONCILIATION */
              <div className={`border rounded-xl spill-auto transition-all shadow-xs ${
                darkMode ? 'bg-zinc-900 border-zinc-805' : 'bg-white border-gray-150'
              }`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse min-w-[900px]">
                    <thead>
                      <tr className={`border-b text-xs font-bold ${
                        darkMode ? 'bg-zinc-950/40 text-zinc-350 border-zinc-800' : 'bg-slate-50/70 text-gray-600 border-gray-200'
                      }`}>
                        <th className="p-3 w-44">اسم الجهاز الكهربائي</th>
                        <th className="p-3 w-28">الماركة</th>
                        <th className="p-3 w-40">التصنيف</th>
                        <th className="p-3 w-28 font-semibold">السعر ({currencyValue === 'دولار' ? '$' : currencyValue === 'ليرة سورية' ? 'ل.س' : 'ر.س'})</th>
                        <th className="p-3 w-24">الكمية</th>
                        <th className="p-3">المواصفات الفنية المباشرة</th>
                        <th className="p-3 w-16 text-center">التوفر</th>
                        <th className="p-3 w-32 text-center">تحديث فوري</th>
                        <th className="p-3 w-12 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-850/40 text-xs">
                      
                      {/* INTERACTIVE INTEGRATED QUICK-ADD ROW */}
                      <tr className={` transition-colors ${
                        darkMode ? 'bg-green-950/10 hover:bg-green-950/15' : 'bg-green-50/15 hover:bg-green-50/30'
                      }`}>
                        <td className="p-2">
                          <input
                            type="text"
                            value={quickAddName}
                            onChange={(e) => setQuickAddName(e.target.value)}
                            placeholder="مثال: غسالة أتوماتيك LG..."
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 ${
                              darkMode 
                                ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-green-600 focus:border-green-600' 
                                : 'bg-white border-gray-200 text-gray-800 focus:ring-green-500 focus:border-green-500'
                            }`}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={quickAddBrand}
                            onChange={(e) => setQuickAddBrand(e.target.value)}
                            placeholder="سوني، إلجي..."
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 ${
                              darkMode 
                                ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-green-600' 
                                : 'bg-white border-gray-200 text-gray-800 focus:ring-green-500'
                            }`}
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={quickAddCategory}
                            onChange={(e) => setQuickAddCategory(e.target.value)}
                            className={`w-full px-1.5 py-1.5 border rounded-lg text-xs font-medium focus:outline-none ${
                              darkMode 
                                ? 'bg-zinc-950 border-zinc-800 text-zinc-100' 
                                : 'bg-white border-gray-200 text-gray-800'
                            }`}
                          >
                            <option value="ثلاجات">ثلاجات ومجمدات</option>
                            <option value="غسالات">غسالات ونشافات</option>
                            <option value="مكيفات">أجهزة تكييف وتدفئة</option>
                            <option value="شاشات ورسيفرات">تلفزيونات وشاشات عرض</option>
                            <option value="ميكروويف وأفران">ميكروويف ومطابخ</option>
                            <option value="أجهزة صغيرة">أجهزة خلاطات ومكاوٍ وأخرى</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={quickAddPrice || ''}
                            onChange={(e) => setQuickAddPrice(Number(e.target.value))}
                            placeholder="0.0"
                            className={`w-full px-2 py-1.5 border rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 ${
                              darkMode 
                                ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-green-600' 
                                : 'bg-white border-gray-200 text-gray-800 focus:ring-green-500'
                            }`}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={quickAddQty}
                            onChange={(e) => setQuickAddQty(Number(e.target.value))}
                            placeholder="1"
                            className={`w-full px-2 py-1.5 border rounded-lg text-xs font-bold focus:outline-none focus:ring-1 ${
                              darkMode 
                                ? 'bg-zinc-950 border-zinc-800 text-zinc-100' 
                                : 'bg-white border-gray-200 text-gray-800'
                            }`}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={quickAddDesc}
                            onChange={(e) => setQuickAddDesc(e.target.value)}
                            placeholder="موديل، سعة، فترة الكفالة..."
                            className={`w-full px-2 py-1.5 border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 ${
                              darkMode 
                                ? 'bg-zinc-950 border-zinc-800 text-zinc-100' 
                                : 'bg-white border-gray-200 text-gray-800'
                            }`}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">نشط</span>
                        </td>
                        <td className="p-2 text-center" colSpan={2}>
                          <button
                            type="button"
                            onClick={handleQuickAdd}
                            disabled={isQuickAdding}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold text-[11px] py-1.5 px-3 rounded-lg transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1 active:scale-95 disabled:opacity-40"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isQuickAdding ? 'جاري الإضافة...' : 'إضافة للجرد فورا'}</span>
                          </button>
                        </td>
                      </tr>

                      {/* LIVE PRODUCT EDITING STREAMS */}
                      {products.map((p) => {
                        const isEdited = modifiedRows[p.id!] !== undefined;
                        const isSaving = inlineSavingId === p.id;
                        
                        return (
                          <tr key={p.id} className={`hover:bg-slate-50/20 dark:hover:bg-zinc-900/40 transition-all ${
                            isEdited ? (darkMode ? 'bg-indigo-950/15' : 'bg-indigo-50/20') : ''
                          }`}>
                            {/* Device Name input */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={getCellValue(p, 'name')}
                                onChange={(e) => handleCellChange(p.id!, 'name', e.target.value)}
                                className={`w-full px-2 py-1.5 rounded-lg text-xs font-semibold focus:outline-none border border-transparent transition-all ${
                                  darkMode 
                                    ? 'hover:border-zinc-700 focus:bg-zinc-950 focus:border-zinc-605 text-zinc-100 bg-transparent' 
                                    : 'hover:border-gray-250 focus:bg-white focus:border-gray-300 text-gray-800 bg-transparent'
                                }`}
                              />
                            </td>

                            {/* Brand input */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={getCellValue(p, 'brand')}
                                onChange={(e) => handleCellChange(p.id!, 'brand', e.target.value)}
                                className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium focus:outline-none border border-transparent transition-all ${
                                  darkMode 
                                    ? 'hover:border-zinc-700 focus:bg-zinc-950 focus:border-zinc-650 text-zinc-100 bg-transparent' 
                                    : 'hover:border-gray-250 focus:bg-white focus:border-gray-300 text-gray-800 bg-transparent'
                                }`}
                              />
                            </td>

                            {/* Category selector */}
                            <td className="p-2">
                              <select
                                value={getCellValue(p, 'category')}
                                onChange={(e) => handleCellChange(p.id!, 'category', e.target.value)}
                                className={`w-full px-1.5 py-1.5 rounded-lg text-xs font-semibold focus:outline-none border border-transparent transition-all ${
                                  darkMode 
                                    ? 'hover:border-zinc-700 focus:bg-zinc-950 text-zinc-100 bg-transparent' 
                                    : 'hover:border-gray-251 focus:bg-white text-gray-800 bg-transparent'
                                }`}
                              >
                                <option value="ثلاجات" className={darkMode ? 'bg-zinc-900' : ''}>ثلاجات ومجمدات</option>
                                <option value="غسالات" className={darkMode ? 'bg-zinc-900' : ''}>غسالات ونشافات</option>
                                <option value="مكيفات" className={darkMode ? 'bg-zinc-900' : ''}>أجهزة تكييف وتدفئة</option>
                                <option value="شاشات ورسيفرات" className={darkMode ? 'bg-zinc-900' : ''}>تلفزيونات وشاشات عرض</option>
                                <option value="ميكروويف وأفران" className={darkMode ? 'bg-zinc-900' : ''}>ميكروويف ومطابخ</option>
                                <option value="أجهزة صغيرة" className={darkMode ? 'bg-zinc-900' : ''}>أجهزة خلاطات ومكاوٍ وأخرى</option>
                              </select>
                            </td>

                            {/* Price input */}
                            <td className="p-2">
                              <input
                                type="number"
                                value={getCellValue(p, 'price')}
                                onChange={(e) => handleCellChange(p.id!, 'price', Number(e.target.value))}
                                className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono font-bold focus:outline-none border border-transparent transition-all ${
                                  darkMode 
                                    ? 'hover:border-zinc-700 focus:bg-zinc-950 focus:border-zinc-605 text-zinc-100 bg-transparent' 
                                    : 'hover:border-gray-250 focus:bg-white focus:border-gray-300 text-gray-800 bg-transparent'
                                }`}
                              />
                            </td>

                            {/* Quantity input */}
                            <td className="p-2">
                              <input
                                type="number"
                                value={getCellValue(p, 'quantity')}
                                onChange={(e) => handleCellChange(p.id!, 'quantity', Number(e.target.value))}
                                className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono font-bold focus:outline-none border border-transparent transition-all ${
                                  darkMode 
                                    ? 'hover:border-zinc-700 focus:bg-zinc-950 focus:border-zinc-605 text-zinc-100 bg-transparent' 
                                    : 'hover:border-gray-250 focus:bg-white focus:border-gray-300 text-gray-800 bg-transparent'
                                }`}
                              />
                            </td>

                            {/* Spec/description input */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={getCellValue(p, 'description') || ''}
                                onChange={(e) => handleCellChange(p.id!, 'description', e.target.value)}
                                className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium focus:outline-none border border-transparent transition-all ${
                                  darkMode 
                                    ? 'hover:border-zinc-700 focus:bg-zinc-950 focus:border-zinc-650 text-zinc-100 bg-transparent' 
                                    : 'hover:border-gray-250 focus:bg-white focus:border-gray-300 text-gray-800 bg-transparent'
                                }`}
                              />
                            </td>

                            {/* Available checkbox */}
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={getCellValue(p, 'isAvailable')}
                                onChange={(e) => handleCellChange(p.id!, 'isAvailable', e.target.checked)}
                                className={`w-4 h-4 rounded cursor-pointer transition-transform active:scale-95 ${
                                  darkMode ? 'bg-zinc-950 border-zinc-700 text-white' : 'text-black border-gray-300'
                                }`}
                              />
                            </td>

                            {/* Live Fire sync control */}
                            <td className="p-2 text-center">
                              {isEdited ? (
                                <button
                                  type="button"
                                  onClick={() => saveRowInline(p)}
                                  disabled={isSaving}
                                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black py-1.5 px-2 rounded-lg shadow-md cursor-pointer transition-all flex items-center justify-center gap-1 active:scale-95"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>{isSaving ? 'حفظ...' : 'تحديث فوري'}</span>
                                </button>
                              ) : (
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                                  darkMode ? 'text-zinc-500 bg-zinc-950/20' : 'text-gray-400 bg-neutral-50/40'
                                }`}>
                                  محفوظ بالكامل ✔
                                </span>
                              )}
                            </td>

                            {/* Delete inline button */}
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => deleteProductItem(p.id)}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  darkMode 
                                    ? 'bg-zinc-800 border-zinc-750 text-zinc-400 hover:text-red-400 hover:border-red-900 bg-zinc-950/35' 
                                    : 'bg-white border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50/20 hover:border-red-150'
                                }`}
                                title="مسح من مستودع المتجر"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>

                          </tr>
                        );
                      })}

                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* CARD GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((p) => (
                  <div key={p.id} className={`border rounded overflow-hidden flex flex-col transition-all ${
                    darkMode ? 'bg-zinc-90 w-full border-zinc-805 hover:border-zinc-700' : 'bg-white border-gray-100 hover:border-gray-300'
                  }`}>
                    <div className={`h-44 border-b relative group overflow-hidden ${
                      darkMode ? 'bg-zinc-950 border-zinc-805' : 'bg-gray-50 border-gray-100'
                    }`}>
                      <img 
                        src={p.imageUrl || 'https://placehold.co/600x400/f3f4f6/9ca3af?text=Appliance'} 
                        alt={p.name}
                        className="w-full h-full object-contain p-4 group-hover:scale-102 transition-transform"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/f3f4f6/9ca3af?text=Appliance';
                        }}
                      />
                      <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded ${
                        p.isAvailable && p.quantity > 0 
                          ? (darkMode ? 'bg-zinc-850 text-zinc-300 border border-zinc-750' : 'bg-neutral-100 text-neutral-800 border border-neutral-200') 
                          : 'bg-red-50 text-red-600 border border-red-200'
                      }`}>
                        {p.isAvailable && p.quantity > 0 ? `${p.quantity} متوفر` : 'نفد'}
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between font-sans">
                      <div>
                        <div className={`flex items-center gap-1.5 text-[10px] font-bold block mb-1 ${
                          darkMode ? 'text-zinc-550' : 'text-neutral-400'
                        }`}>
                          <span>{p.category}</span>
                          <span>•</span>
                          <span>{p.brand}</span>
                        </div>
                        <h4 className={`text-sm font-bold mt-1 line-clamp-1 ${
                          darkMode ? 'text-zinc-150' : 'text-gray-900'
                        }`}>{p.name}</h4>
                        <p className={`text-xs mt-1 line-clamp-2 ${darkMode ? 'text-zinc-400' : 'text-gray-400'}`}>{p.description || 'لا يوجد مواصفات مضافة.'}</p>
                      </div>

                      <div className={`mt-4 pt-3.5 border-t flex items-center justify-between ${
                        darkMode ? 'border-zinc-800' : 'border-gray-100'
                      }`}>
                        <div>
                          <span className="text-[10px] text-gray-400 block font-semibold leading-none">السعر</span>
                          <span className="text-sm font-bold block mt-1">{p.price.toLocaleString('ar-EG')} {currencyValue === 'دولار' ? '$' : currencyValue === 'ليرة سورية' ? 'ل.س' : 'ر.س'}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-400 block font-semibold text-left leading-none mb-1">الكمية</span>
                          <span className={`text-[11px] font-mono font-bold block px-2 py-0.5 rounded text-center ${
                            darkMode ? 'text-zinc-350 bg-zinc-950 border border-zinc-800' : 'text-gray-700 bg-gray-50 border border-gray-200'
                          }`}>{p.quantity} وحدة</span>
                        </div>
                      </div>
                    </div>

                    <div className={`px-4 py-3 border-t flex items-center justify-between gap-2 shrink-0 ${
                      darkMode ? 'bg-zinc-900/50 border-zinc-805' : 'bg-gray-50/50 border-gray-100'
                    }`}>
                      <button
                        onClick={() => startEditProduct(p)}
                        className={`flex-1 py-1.5 border rounded text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          darkMode ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-750 text-zinc-100' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span>تعديل</span>
                      </button>
                      <button
                        onClick={() => deleteProductItem(p.id)}
                        className={`py-1.5 px-3 border rounded transition-all flex items-center justify-center cursor-pointer font-bold text-xs ${
                          darkMode 
                            ? 'bg-zinc-805 border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-900' 
                            : 'bg-white border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-150'
                        }`}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CHATS INSPECTOR */}
        {activeTab === 'chats' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN: CONVERSATION LISTS (5Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className={`border-b pb-2.5 ${darkMode ? 'border-zinc-800' : 'border-gray-100'}`}>
                <h2 className={`text-md font-bold ${darkMode ? 'text-zinc-100' : 'text-gray-900'}`}>محادثات العملاء</h2>
              </div>

              {/* Advanced Filter Bars */}
              <div className={`border rounded p-4 space-y-3 ${
                darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-150'
              }`}>
                {/* Search customer Name */}
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم العميل أو نص الرسالة..."
                    className={`w-full pr-9 pl-3 py-2 border rounded text-xs focus:outline-none focus:ring-1 font-medium transition-colors ${
                      darkMode 
                        ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-zinc-650 focus:border-zinc-650 placeholder-zinc-700' 
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-black focus:border-black placeholder-gray-400'
                    }`}
                  />
                </div>

                 <div className="flex flex-wrap items-center gap-2 justify-between">
                  {/* Status buttons */}
                  <div className="flex items-center gap-1">
                    <span className={`text-[11px] font-bold ml-1.5 ${darkMode ? 'text-zinc-500' : 'text-gray-400'}`}>تصفية:</span>
                    {(['all', 'pending', 'active', 'resolved', 'archived'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                          statusFilter === st
                            ? (darkMode ? 'bg-zinc-100 border-zinc-100 text-zinc-950' : 'bg-black border-black text-white')
                            : (darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-405 hover:bg-zinc-850' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50/50')
                        }`}
                      >
                        {st === 'all' ? 'الكل' : st === 'pending' ? 'انتظار' : st === 'active' ? 'نشطة' : st === 'resolved' ? 'منتهية' : 'مؤرشفة'}
                      </button>
                    ))}
                  </div>

                  {/* Date sort option */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDateSort(prev => prev === 'newest' ? 'oldest' : 'newest')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] border rounded font-bold transition-all cursor-pointer ${
                        darkMode 
                          ? 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-850' 
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span>{dateSort === 'newest' ? 'الأحدث أولاً' : 'الأقدم أولاً'}</span>
                    </button>

                    <button
                      onClick={clearAllConversations}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] border rounded font-bold transition-all cursor-pointer bg-red-50 border-red-150 text-red-600 hover:bg-red-100 hover:border-red-200 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/40"
                      title="حذف وتصفير جميع سجلات المحادثات بالكامل"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>تصفير كافة المحادثات</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Logger Entries */}
              {loadingConversations ? (
                <div className="text-center py-8">
                  <span className="text-xs text-gray-400 font-medium font-medium">جاري تحديث المحادثات...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className={`border rounded p-8 text-center ${
                  darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100'
                }`}>
                  <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <span className="text-xs text-gray-500 block font-medium">لم يتم العثور على أي محادثات مطابقة للفهرس.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredConversations.map((log) => {
                    const lastMsg = log.messages[log.messages.length - 1];
                    const dateFormatted = new Date(log.updatedAt).toLocaleDateString('ar-EG', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={log.id}
                        onClick={() => setSelectedConversation(log)}
                        className={`p-4 rounded border transition-all cursor-pointer text-right relative ${
                          selectedConversation?.id === log.id
                            ? (darkMode ? 'bg-zinc-850 border-zinc-100 ring-1 ring-zinc-100' : 'bg-neutral-50 border-black ring-1 ring-black')
                            : (darkMode ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-gray-150 hover:border-gray-300')
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold ${darkMode ? 'text-zinc-150 transition-colors' : 'text-gray-950'}`}>{log.customerName}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            log.status === 'resolved' 
                              ? (darkMode ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' : 'bg-neutral-100 text-neutral-800 border border-neutral-200')
                              : log.status === 'active'
                              ? 'bg-emerald-950/40 text-emerald-350 border border-emerald-900/50'
                              : log.status === 'archived'
                              ? 'bg-amber-950/40 text-amber-300 border border-amber-900/50'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          }`}>
                            {log.status === 'resolved' ? 'مجابة' : log.status === 'active' ? 'جارية' : log.status === 'archived' ? 'مؤرشفة' : 'تنتظر'}
                          </span>
                        </div>

                        <p className={`text-[11.5px] truncate pl-4 ${darkMode ? 'text-zinc-400' : 'text-gray-400'}`}>
                          {lastMsg ? lastMsg.text : 'بدأت المحادثة...'}
                        </p>

                        <div className={`flex items-center justify-between mt-3 pt-2 border-t text-[10px] text-gray-400 font-semibold ${
                          darkMode ? 'border-zinc-800' : 'border-gray-50'
                        }`}>
                          <span className="font-mono">{log.messages.length} رسائل</span>
                          <span>{dateFormatted}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: DETAIL CHAT INSPECTOR (7Cols) */}
            <div className="lg:col-span-7">
              {selectedConversation ? (
                <div className={`border rounded flex flex-col h-[640px] transition-all ${
                  darkMode ? 'bg-zinc-90 w-full border-zinc-805' : 'bg-white border-gray-150 shadow-xs'
                }`}>
                  {/* Detailed inspector header */}
                  <div className={`px-6 h-16 border-b flex items-center justify-between shrink-0 mb-4 ${
                    darkMode ? 'border-zinc-800 bg-zinc-900/40' : 'bg-white border-gray-100'
                  }`}>
                    <div>
                      <h3 className={`text-sm font-bold ${darkMode ? 'text-zinc-100' : 'text-gray-900'}`}>{selectedConversation.customerName}</h3>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">المعرف الفني: <span className="font-mono">{selectedConversation.id}</span></p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Active status button */}
                      <button
                        onClick={() => setChatStatus(selectedConversation.id!, 'active')}
                        className={`px-2.5 py-1.5 border rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          selectedConversation.status === 'active'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : (darkMode ? 'bg-zinc-950 border-zinc-805 text-zinc-400 hover:bg-zinc-850' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50')
                        }`}
                        title="تحديد كنشطة جارية"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>نشطة</span>
                      </button>

                      {/* Resolved status button */}
                      <button
                        onClick={() => setChatStatus(selectedConversation.id!, 'resolved')}
                        className={`px-2.5 py-1.5 border rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          selectedConversation.status === 'resolved'
                            ? 'bg-neutral-100 border-neutral-300 text-neutral-800'
                            : (darkMode ? 'bg-zinc-950 border-zinc-805 text-zinc-400 hover:bg-zinc-850' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50')
                        }`}
                        title="تحديد كمنتهية مجابة"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-neutral-500" />
                        <span>منتهية</span>
                      </button>

                      {/* Archived status button */}
                      <button
                        onClick={() => setChatStatus(selectedConversation.id!, 'archived')}
                        className={`px-2.5 py-1.5 border rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          selectedConversation.status === 'archived'
                            ? 'bg-amber-50 border-amber-200 text-amber-700 font-bold'
                            : (darkMode ? 'bg-zinc-950 border-zinc-805 text-zinc-400 hover:bg-zinc-850' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50')
                        }`}
                        title="أرشفة هذه المحادثة"
                      >
                        <Archive className="w-3.5 h-3.5 text-amber-500" />
                        <span>أرشفة</span>
                      </button>

                      <div className="h-4 w-px bg-gray-200 dark:bg-zinc-800 mx-1" />

                      <button
                        onClick={() => deleteChatLog(selectedConversation.id)}
                        className={`p-1.5 rounded transition-all cursor-pointer font-bold text-xs border ${
                          darkMode 
                            ? 'bg-red-950/20 border-red-900/50 text-red-400 hover:bg-red-900/40 hover:text-red-300' 
                            : 'bg-red-50 border-red-100/50 text-red-600 hover:bg-red-100 hover:border-red-250'
                        }`}
                        title="مسح السجل نهائياً"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Transcript Body */}
                  <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${
                    darkMode ? 'bg-zinc-950/20' : 'bg-gray-50/50'
                  }`}>
                    {selectedConversation.messages.map((m, idx) => (
                      <div 
                        key={idx} 
                        className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] px-4 py-2.5 rounded shadow-xs text-xs leading-relaxed whitespace-pre-wrap ${
                          m.sender === 'user'
                            ? (darkMode ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'bg-black text-white font-medium')
                            : (darkMode ? 'bg-zinc-90 w-full border border-zinc-800 text-zinc-100' : 'bg-white text-gray-800 border border-gray-150')
                        }`}>
                          <p>{m.text}</p>
                          <span className={`text-[9px] block text-left mt-1.5 ${
                            m.sender === 'user' 
                              ? (darkMode ? 'text-zinc-500' : 'text-zinc-400') 
                              : 'text-gray-400'
                          }`}>
                            {m.timestamp}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Read-only notes inside footer */}
                  <div className={`border-t px-6 py-4 shrink-0 flex items-center gap-2 ${
                    darkMode ? 'border-zinc-800 bg-zinc-900/40' : 'bg-white border-gray-100'
                  }`}>
                    <CornerDownLeft className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-[10px] text-gray-400 font-medium">سجل المحادثة هذا مغلق للأغراض الإدارية والتحليل ومتابعة جودة خدمة المبيعات.</span>
                  </div>
                </div>
              ) : (
                <div className={`border rounded h-[640px] flex flex-col items-center justify-center p-8 text-center ${
                  darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100'
                }`}>
                  <Archive className={`w-12 h-12 mb-3 ${darkMode ? 'text-zinc-700' : 'text-gray-200'}`} />
                  <h3 className={`text-base font-bold ${darkMode ? 'text-zinc-250' : 'text-gray-800'}`}>تفاصيل المحادثة الفورية</h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">اضغط على أي جلسة عميل يسار الشاشة لتصفح الرسائل ومراجعة تفاصيل المحادثة مع الذكاء الاصطناعي بالكامل.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: STORE & CHATBOT SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className={`border-b pb-2.5 ${darkMode ? 'border-zinc-800' : 'border-gray-100'}`}>
              <h2 className={`text-md font-bold ${darkMode ? 'text-zinc-100' : 'text-gray-900'}`}>إعدادات هوية المتجر والذكاء الاصطناعي</h2>
            </div>

            {loadingSettings ? (
              <div className="py-12 text-center">
                <span className="text-xs text-gray-500 animate-pulse">جاري تحميل إعدادات المتجر المتزامنة...</span>
              </div>
            ) : (
              <form onSubmit={saveStoreSettings} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* SETTINGS FIELDS (8 Cols) */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* Part 1: Basic Identity */}
                  <div className={`border rounded p-6 space-y-4 ${
                    darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-150 shadow-xs'
                  }`}>
                    <h3 className="text-xs font-bold font-sans uppercase tracking-wider flex items-center gap-2 text-zinc-500">
                      <span className="w-1.5 h-3 bg-indigo-500 rounded-full" />
                      <span>🛒 هوية {businessTypeValue === 'شركة' ? 'الشركة' : 'المتجر'} والبيانات الأساسية</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>نوع المنشأة</label>
                        <select
                          value={businessTypeValue}
                          onChange={(e) => setBusinessTypeValue(e.target.value as 'شركة' | 'متجر')}
                          className={`w-full px-3 py-2 border rounded text-xs focus:outline-none transition-all cursor-pointer ${
                            darkMode 
                              ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                              : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                          }`}
                        >
                          <option value="شركة">شركة</option>
                          <option value="متجر">متجر</option>
                        </select>
                      </div>

                      <div>
                        <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>اسم {businessTypeValue === 'شركة' ? 'الشركة' : 'المتجر'}</label>
                        <input
                          type="text"
                          value={storeNameValue}
                          onChange={(e) => setStoreNameValue(e.target.value)}
                          placeholder={businessTypeValue === 'شركة' ? "مثال: شركة مامو للأجهزة المنزلية" : "مثال: متجر الأدوات الذكي"}
                          className={`w-full px-3 py-2 border rounded text-xs focus:outline-none transition-all ${
                            darkMode 
                              ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                              : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                          }`}
                          required
                        />
                      </div>

                      <div>
                        <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>رابط شعار {businessTypeValue === 'شركة' ? 'الشركة' : 'المتجر'}</label>
                        <input
                          type="url"
                          value={logoUrlValue}
                          onChange={(e) => setLogoUrlValue(e.target.value)}
                          placeholder="مثال: https://example.com/logo.png"
                          className={`w-full px-3 py-2 border rounded text-xs focus:outline-none transition-all ${
                            darkMode 
                              ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                              : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>العملة المحلية المعتمدة</label>
                        <select
                          value={currencyValue}
                          onChange={(e) => setCurrencyValue(e.target.value as any)}
                          className={`w-full px-3 py-2 border rounded text-xs focus:outline-none transition-all cursor-pointer ${
                            darkMode 
                              ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                              : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                          }`}
                        >
                          <option value="ليرة سورية" className={darkMode ? 'bg-zinc-900 text-zinc-100' : ''}>ليرة سورية (ل.س)</option>
                          <option value="دولار" className={darkMode ? 'bg-zinc-900 text-zinc-100' : ''}>دولار أمريكي ($)</option>
                          <option value="ر.س" className={darkMode ? 'bg-zinc-900 text-zinc-100' : ''}>ريال سعودي (ر.س)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>موقع / عنوان الفرع الرئيسي</label>
                      <input
                        type="text"
                        value={locationValue}
                        onChange={(e) => setLocationValue(e.target.value)}
                        placeholder="مثال: الرياض - حي المروج - طريق الملك عبدالعزيز"
                        className={`w-full px-3 py-2 border rounded text-xs focus:outline-none transition-all ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                            : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Part 2: Contact Channels */}
                  <div className={`border rounded p-6 space-y-4 ${
                    darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-150 shadow-xs'
                  }`}>
                    <h3 className="text-xs font-bold font-sans uppercase tracking-wider flex items-center gap-2 text-zinc-500">
                      <span className="w-1.5 h-3 bg-emerald-500 rounded-full" />
                      <span>📞 قنوات التواصل وخدمة العملاء</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>رقم الواتساب</label>
                        <input
                          type="text"
                          value={whatsappValue}
                          onChange={(e) => setWhatsappValue(e.target.value)}
                          placeholder="العالمي: 9665XXXXXXXX"
                          className={`w-full px-3 py-2 border rounded text-xs focus:outline-none transition-all ${
                            darkMode 
                              ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                              : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>رقم الاتصال المباشر</label>
                        <input
                          type="text"
                          value={contactNumberValue}
                          onChange={(e) => setContactNumberValue(e.target.value)}
                          placeholder="مثال: 0500000000"
                          className={`w-full px-3 py-2 border rounded text-xs focus:outline-none transition-all ${
                            darkMode 
                              ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                              : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>البريد الإلكتروني</label>
                        <input
                          type="email"
                          value={emailValue}
                          onChange={(e) => setEmailValue(e.target.value)}
                          placeholder="info@yourstore.com"
                          className={`w-full px-3 py-2 border rounded text-xs focus:outline-none transition-all ${
                            darkMode 
                              ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                              : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Part 3: Chatbot Design & Instructions */}
                  <div className={`border rounded p-6 space-y-4 ${
                    darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-150 shadow-xs'
                  }`}>
                    <h3 className="text-xs font-bold font-sans uppercase tracking-wider flex items-center gap-2 text-zinc-500">
                      <span className="w-1.5 h-3 bg-amber-500 rounded-full" />
                      <span>🤖 تخصيص وتوجيهات الشات بوت الذكي</span>
                    </h3>

                    {/* Color customizer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>اللون الأساسي للشات بوت</label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={botPrimaryColorValue}
                            onChange={(e) => setBotPrimaryColorValue(e.target.value)}
                            className="w-10 h-8 border border-gray-200 rounded cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={botPrimaryColorValue}
                            onChange={(e) => setBotPrimaryColorValue(e.target.value)}
                            placeholder="#800020"
                            className={`w-full px-3 py-1.5 border rounded text-xs focus:outline-none transition-all font-mono uppercase ${
                              darkMode 
                                ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                                : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                            }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>لون الخط لرسائل الشات بوت المخصصة</label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            value={botTextColorValue}
                            onChange={(e) => setBotTextColorValue(e.target.value)}
                            className="w-10 h-8 border border-gray-200 rounded cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={botTextColorValue}
                            onChange={(e) => setBotTextColorValue(e.target.value)}
                            placeholder="#ffffff"
                            className={`w-full px-3 py-1.5 border rounded text-xs focus:outline-none transition-all font-mono uppercase ${
                              darkMode 
                                ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                                : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>اسم الموظف أو الموظفة الافتراضي (اسم البوت)</label>
                        <input
                          type="text"
                          value={botEmployeeNameValue}
                          onChange={(e) => setBotEmployeeNameValue(e.target.value)}
                          placeholder="مثال: سارة (ممثلة المبيعات) أو أحمد"
                          className={`w-full px-3 py-1.5 border rounded text-xs focus:outline-none transition-all ${
                            darkMode 
                              ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                              : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>سرعة استجابة الرد الآلي في المحادثة</label>
                        <select
                          value={botResponseSpeedValue}
                          onChange={(e) => setBotResponseSpeedValue(e.target.value)}
                          className={`w-full px-3 py-1.5 border rounded text-xs focus:outline-none transition-all ${
                            darkMode 
                              ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                              : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                          }`}
                        >
                          <option value="instant">تلقائية وفورية (بدون انتظار)</option>
                          <option value="fast">سريعة جداً (حوالي ثانية واحدة)</option>
                          <option value="medium">طبيعية ومتوسطة (حوالي ثانيتين)</option>
                          <option value="slow">متأنية وهادئة (حوالي 3.5 ثانية)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>الصورة المصغرة للبوت (رابط الصورة Avatar URL)</label>
                      <input
                        type="url"
                        value={botAvatarValue}
                        onChange={(e) => setBotAvatarValue(e.target.value)}
                        placeholder="مثال: https://images.unsplash.com/... أو رابط مباشر للصورة"
                        className={`w-full px-3 py-1.5 border rounded text-xs focus:outline-none transition-all ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                            : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>رسالة الترحيب التلقائية الأولى للعميل</label>
                      <textarea
                        value={botWelcomeMessageValue}
                        onChange={(e) => setBotWelcomeMessageValue(e.target.value)}
                        placeholder="المحادثة ستبدأ بهذه الجملة فور جلب الصفحة..."
                        rows={3}
                        className={`w-full px-3 py-2 border rounded text-xs focus:outline-none transition-all leading-relaxed ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                            : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-bold mb-1.5 ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>تعليمات وتوجيهات الشات بوت (System Instructions)</label>
                      <textarea
                        value={botInstructionsValue}
                        onChange={(e) => setBotInstructionsValue(e.target.value)}
                        placeholder="اكتب هنا التوجيهات الهامة؛ مثل: 'يرجى التركيز على الأسعار والمنتجات فقط وتجنب الرد بخصوص شروط تفعيل الضمان أو توصيل الأجهزة الكهربائية.'"
                        rows={5}
                        className={`w-full p-3 border rounded text-xs focus:outline-none transition-all leading-relaxed ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                            : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                        }`}
                      />
                      <span className="text-[10px] text-gray-400 block mt-1.5 font-semibold">
                        💡 تلميح: سيتم حقن هذه التوجيهات والتعليمات مباشرة في معالج الذكاء الاصطناعي (Gemini) ليتبع قوانينك المحددة عند تواصل وإجابة العملاء بالمتجر.
                      </span>
                    </div>
                  </div>

                  {/* Part 4: Maintenance Customization & Knowledge Base */}
                  <div className={`border rounded p-6 space-y-4 ${
                    darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-150 shadow-xs'
                  }`}>
                    <h3 className="text-xs font-bold font-sans uppercase tracking-wider flex items-center gap-2 text-zinc-500">
                      <span className="w-1.5 h-3 bg-rose-500 rounded-full" />
                      <span>🛠️ وضع الصيانة الفورية وقاعدة المعرفة (Knowledge Base)</span>
                    </h3>

                    {/* Maintenance Toggle */}
                    <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                      maintenanceModeValue 
                        ? (darkMode ? 'bg-red-950/20 border-red-950 text-red-150' : 'bg-red-50 border-red-200 text-red-950') 
                        : (darkMode ? 'bg-zinc-950/40 border-zinc-800/60' : 'bg-zinc-50 border-zinc-150')
                    }`}>
                      <div className="space-y-1">
                        <label className={`text-xs font-bold flex items-center gap-2 cursor-pointer ${darkMode ? 'text-zinc-200' : 'text-gray-900'}`}>
                          <input
                            type="checkbox"
                            checked={maintenanceModeValue}
                            onChange={(e) => setMaintenanceModeValue(e.target.checked)}
                            className="w-4 h-4 rounded text-red-600 border-gray-300 focus:ring-red-500 cursor-pointer"
                          />
                          <span>تفعيل وضع صيانة الشات بوت (Maintenance Mode)</span>
                        </label>
                        <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-zinc-400' : 'text-gray-500'}`}>
                          عند تفعيل هذا الخيار، سيتم حجب واجهة المحادثة للعملاء مؤقتاً، وعرض رسالة تفيد بوجود صيانة أو تحديثات دون تفعيل المعالجة التلقائية.
                        </p>
                      </div>
                      <div className="shrink-0 col-span-1">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider border ${
                          maintenanceModeValue 
                            ? 'bg-red-500/15 text-red-500 border-red-500/30 animate-pulse' 
                            : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                        }`}>
                          {maintenanceModeValue ? 'تحت الصيانة حالياً' : 'متصل ونشط'}
                        </span>
                      </div>
                    </div>

                    {/* Maintenance Message Field - Visible always, but highlighted when mode is active */}
                    <div className="space-y-1.5">
                      <label className={`block text-[11px] font-bold ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>
                        رسالة جدار الصيانة المعروضة للجمهور
                      </label>
                      <textarea
                        value={maintenanceMessageValue}
                        onChange={(e) => setMaintenanceMessageValue(e.target.value)}
                        placeholder="مثال: نحن نقوم ببعض العمليات والصيانة والتحديثات لخدمتكم بشكل أفضل، سنعود قريباً جداً!"
                        rows={2}
                        className={`w-full px-3 py-2 border rounded text-xs focus:outline-none transition-all leading-relaxed ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                            : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                        }`}
                      />
                    </div>

                    {/* Knowledge Base Section */}
                    <div className="space-y-1.5 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                      <label className={`block text-[11px] font-bold ${darkMode ? 'text-zinc-300' : 'text-gray-600'}`}>
                        قاعدة معرفة المتجر الإضافية وحلول المشاكل (Knowledge Base)
                      </label>
                      <textarea
                        value={knowledgeBaseValue}
                        onChange={(e) => setKnowledgeBaseValue(e.target.value)}
                        placeholder="مثال:
- عنوان المتجر: الرياض، حي الياسمين، شارع التخصصي.
- أوقات العمل الرسمية: يومياً من 10 صباحًا وحتى 10 مساءً، ما عدا الجمعة من 4 مساءً حتى 10 مساءً.
- سياسة التوصيل: نوفر توصيلًا مجانيًا للأجهزة الكهربائية الكبيرة داخل مدينة الرياض، والولايات القريبة يستغرق التوصيل من 2-4 أيام عمل.
- الأسئلة الشائعة: هل يوجد تقسيط؟ نعم، نوفر خدمة تقسيط ميسر عن طريق تابي وتمارا بدون فوائد."
                        rows={6}
                        className={`w-full p-3 border rounded text-xs focus:outline-none transition-all leading-relaxed font-sans ${
                          darkMode 
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-150 focus:border-zinc-700' 
                            : 'bg-white border-gray-200 text-gray-950 focus:border-black'
                        }`}
                      />
                      <span className="text-[10px] text-gray-400 block mt-1 font-semibold leading-relaxed">
                        💡 تلميح: استخدم قاعدة المعرفة هذه لتغذية الشات بوت الذكي بسياسات وتفاصيل المنشأة الدقيقة. سيقوم Gemini بدمج هذه الحقائق والإجابة بدقة على أسئلة العملاء بدون الخروج عنها!
                      </span>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="px-8 py-3 bg-black hover:bg-zinc-900 disabled:opacity-50 text-white font-bold rounded text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      {savingSettings ? 'جاري الحفظ والتدوين والتعميم...' : 'حفظ ونشر التغييرات'}
                    </button>
                  </div>
                </div>

                {/* INTERACTIVE PREVIEW COL (4 Cols) */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="sticky top-20 space-y-6">
                    {/* Simulated Chat Screen */}
                    <div className={`border rounded overflow-hidden ${
                      darkMode ? 'bg-zinc-900 border-zinc-850' : 'bg-gray-50 border-gray-150'
                    }`}>
                      {/* Visual head banner */}
                      <div className="bg-zinc-100 p-4 border-b border-gray-200 flex items-center justify-between text-xs font-bold text-gray-400">
                        <span>عرض محاكاة الشات بوت للعميل</span>
                        <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                      </div>

                      <div className="p-4 bg-white/70 backdrop-blur-md h-[450px] flex flex-col justify-between">
                        {/* Chat Header Mock */}
                        <div className="border-b border-zinc-100 pb-3 flex items-center gap-2.5">
                          {logoUrlValue ? (
                            <img src={logoUrlValue} alt="logo preview" className="w-8 h-8 rounded object-contain border border-gray-100" />
                          ) : (
                            <div className="w-8 h-8 rounded flex items-center justify-center text-white" style={{ backgroundColor: botPrimaryColorValue }}>
                              <div className="w-4 h-4 border-2 border-white"></div>
                            </div>
                          )}
                          <div>
                            <h4 className="text-xs font-bold text-zinc-900">{storeNameValue || 'المساعد الذكي'}</h4>
                            <span className="text-[9px] text-zinc-400 font-semibold block leading-tight">متوفر الآن ومساعد فوري</span>
                          </div>
                        </div>

                        {/* Msg stream mock */}
                        <div className="flex-1 overflow-y-auto py-4 space-y-3">
                          {/* Bot msg */}
                          <div className="flex justify-start items-end gap-2 text-right">
                            {botAvatarValue ? (
                              <img src={botAvatarValue} alt="Bot Avatar Mock" className="w-6 h-6 rounded-full object-cover border border-zinc-100 shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[8px] shrink-0 bg-neutral-100" style={{ backgroundColor: botPrimaryColorValue }}>
                                <span className="w-1.5 h-1.5 border border-white rounded-xs bg-white/20"></span>
                              </div>
                            )}
                            <div className="flex flex-col text-right max-w-[85%]">
                              <span className="text-[8px] text-zinc-450 font-bold mb-0.5 mr-0.5 text-right block">{botEmployeeNameValue || 'سارة'}</span>
                              <div className="bg-[#F0F2F5] text-zinc-900 border border-transparent rounded-[15px] rounded-br-xs px-3 py-2 text-xs leading-relaxed text-right">
                                {botWelcomeMessageValue || 'مرحباً بك! كيف يمكنني مساعدتك اليوم؟'}
                              </div>
                            </div>
                          </div>

                          {/* User msg mock */}
                          <div className="flex justify-end">
                            <div className="max-w-[80%] rounded px-3 py-2 text-xs font-semibold leading-relaxed" style={{ backgroundColor: botPrimaryColorValue, color: botTextColorValue }}>
                              أريد الاستفسار عن الأجهزة المتوفرة وأسعارها
                            </div>
                          </div>
                        </div>

                        {/* Mock input row */}
                        <div className="border-t border-zinc-100 pt-3 flex gap-2">
                          <input
                            type="text"
                            disabled
                            placeholder="اكتب رسالتك لجميع الأجهزة والأسعار..."
                            className="flex-1 bg-zinc-50 border border-gray-150 rounded px-2 py-1.5 text-[11px] focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled
                            className="px-3 rounded text-xs font-semibold text-white cursor-not-allowed shrink-0"
                            style={{ backgroundColor: botPrimaryColorValue }}
                          >
                            إرسال
                          </button>
                        </div>
                      </div>
                      {/* Info bar */}
                      <div className="bg-zinc-100/60 p-3 text-[10px] border-t border-gray-150 leading-relaxed text-zinc-500 font-medium">
                        ⚠️ <strong>ملاحظة:</strong> سيظهر هذا التصميم وهذه الألوان المحددة مباشرة للعميل داخل صفحة المساعد العام مع تحديث مستمر للهوية.
                      </div>
                    </div>

                    {/* Chatbot QR Code / Barcode Card */}
                    <div className={`border rounded p-6 text-center space-y-4 ${
                      darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-150 shadow-xs'
                    }`}>
                      <h3 className="text-xs font-bold font-sans uppercase tracking-wider flex items-center justify-center gap-1.5 text-zinc-500">
                        <QrCode className="w-4 h-4 text-indigo-500" />
                        <span>الرموز السريعة والمباشرة للمساعد الذكي</span>
                      </h3>
                      
                      <p className={`text-[11px] font-medium leading-relaxed max-w-xs mx-auto ${
                        darkMode ? 'text-zinc-400' : 'text-gray-500'
                      }`}>
                        امسح الباركود بكاميرا الجوال للانتقال لصفحة المحادثة مباشرة.
                      </p>

                      {/* QR Image Frame */}
                      <div className="relative inline-block bg-white p-3.5 border rounded-lg shadow-inner mx-auto my-1 border-gray-200">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + '/chat')}&color=${botPrimaryColorValue.replace('#', '')}&bgcolor=ffffff&qzone=1`}
                          alt="Store Chatbot QR Code"
                          className="w-36 h-36 object-contain mx-auto transition-transform duration-200"
                        />
                        {/* Center branding badge tightly integrated as a native part of the QR code */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                          <div 
                            className="bg-white border-3 rounded-md w-[48px] h-[48px] flex flex-col items-center justify-center text-center px-0.5" 
                            style={{ borderColor: botPrimaryColorValue }}
                          >
                            <span 
                              className="text-[8px] font-black tracking-tighter uppercase leading-none text-center block max-w-full truncate px-0.5" 
                              style={{ color: botPrimaryColorValue }}
                            >
                              {storeNameValue ? storeNameValue.split(' ')[0] : 'MAMO'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* URL display row */}
                      <div className={`rounded p-2 text-[10px] font-mono select-all text-center flex items-center justify-between gap-1 border ${
                        darkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-gray-50 border-gray-150 text-gray-600'
                      }`}>
                        <span className="truncate flex-1 text-left select-all" dir="ltr">
                          {window.location.origin + '/chat'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.origin + '/chat');
                            setLinkCopied(true);
                            setTimeout(() => setLinkCopied(false), 2000);
                          }}
                          className={`p-1.5 rounded hover:bg-opacity-8 transition-colors shrink-0 cursor-pointer flex items-center gap-1 font-sans ${
                            darkMode ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-200 text-gray-500'
                          }`}
                          title="نسخ الرابط"
                        >
                          <Copy className={`w-3.5 h-3.5 ${linkCopied ? 'text-emerald-500' : ''}`} />
                          <span className="text-[9px] font-bold">{linkCopied ? 'تم!' : 'نسخ'}</span>
                        </button>
                      </div>

                      {/* Action tools */}
                      <div className="grid grid-cols-2 gap-2 pt-1 font-sans">
                        <a
                          href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(window.location.origin + '/chat')}&color=${botPrimaryColorValue.replace('#', '')}&bgcolor=ffffff&qzone=2`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-center gap-1 py-2 px-2 border rounded text-[11px] font-bold transition-all ${
                            darkMode 
                              ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-100' 
                              : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <Download className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span>تحميل الباركود</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            const printWindow = window.open('', '_blank');
                            if (printWindow) {
                              printWindow.document.write(`
                                <html>
                                <head>
                                  <title>طباعة باركود المتجر - ${storeNameValue || 'المساعد الذكي'}</title>
                                  <style>
                                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
                                    body {
                                      font-family: 'Inter', system-ui, -apple-system, sans-serif;
                                      display: flex;
                                      flex-direction: column;
                                      align-items: center;
                                      justify-content: center;
                                      min-height: 90vh;
                                      text-align: center;
                                      padding: 20px;
                                      direction: rtl;
                                      color: #000000;
                                    }
                                    .card {
                                      border: 3px solid #000000;
                                      border-radius: 20px;
                                      padding: 40px;
                                      max-width: 450px;
                                      box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                                    }
                                    .logo {
                                      max-height: 60px;
                                      margin-bottom: 20px;
                                    }
                                    h1 {
                                      font-size: 26px;
                                      margin: 10px 0;
                                      color: ${botPrimaryColorValue};
                                    }
                                    p {
                                      font-size: 14px;
                                      color: #555;
                                      margin-bottom: 30px;
                                      line-height: 1.6;
                                    }
                                    .qr-container {
                                      background: #fff;
                                      border: 1px solid #ddd;
                                      padding: 15px;
                                      border-radius: 12px;
                                      display: inline-block;
                                    }
                                    .qr {
                                      width: 280px;
                                      height: 280px;
                                    }
                                    .footer {
                                      margin-top: 35px;
                                      font-size: 12px;
                                      font-weight: bold;
                                      color: #aaa;
                                      letter-spacing: 1px;
                                    }
                                    @media print {
                                      .no-print { display: none; }
                                      body { min-height: auto; }
                                    }
                                    .btn-print {
                                      margin-top: 20px;
                                      padding: 10px 24px;
                                      background: #000;
                                      color: #fff;
                                      border: none;
                                      border-radius: 8px;
                                      font-size: 13px;
                                      font-weight: bold;
                                      cursor: pointer;
                                    }
                                  </style>
                                </head>
                                <body>
                                  <div class="card">
                                    ${logoUrlValue ? `<img src="${logoUrlValue}" class="logo" />` : ''}
                                    <h1>${storeNameValue || 'المساعد الذكي للمتجر'}</h1>
                                    <p>امسح الرمز المباشر أدناه بكاميرا الجوال للتحدث الفوري وطرح الاستفسارات الذكية حول الأجهزة المتوفرة والأسعار!</p>
                                    <div class="qr-container">
                                      <img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(window.location.origin + '/chat')}&color=${botPrimaryColorValue.replace('#', '')}&bgcolor=ffffff&qzone=2" class="qr" />
                                    </div>
                                    <div class="footer">تواصل معنا ومسح آمن</div>
                                    <button class="no-print btn-print" onclick="window.print()">إصدار نسخة للطباعة</button>
                                  </div>
                                </body>
                                </html>
                              `);
                              printWindow.document.close();
                            }
                          }}
                          className={`flex items-center justify-center gap-1 py-2 px-2 border rounded text-[11px] font-bold transition-all cursor-pointer ${
                            darkMode 
                              ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-100' 
                              : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <Printer className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span>تجهيز للطباعة</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </form>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
