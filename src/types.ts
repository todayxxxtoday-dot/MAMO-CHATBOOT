export interface Product {
  id?: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  quantity: number;
  description: string;
  imageUrl: string;
  isAvailable: boolean;
  updatedAt?: string;
}

export interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

export interface Conversation {
  id?: string;
  customerName: string;
  status: 'active' | 'resolved' | 'pending';
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface StoreSettings {
  storeName: string;
  welcomeMessage: string;
  currency: string;
}
