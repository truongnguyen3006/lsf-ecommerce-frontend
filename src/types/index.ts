// Định nghĩa Variant (Giống Backend ProductVariantResponse)
export interface ProductVariant {
  skuCode: string;
  color: string;
  size: string;
  price: number;
  imageUrl: string;
  galleryImages?: string[];
  isActive?: boolean;
}

// Định nghĩa Product (Giống Backend ProductResponse)
export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number; // Giá hiển thị (Base Price)
  // THÊM DÒNG NÀY ĐỂ FIX LỖI TS (Optional để tránh lỗi nếu backend không trả về)
  basePrice?: number;

  category?: string;
  imageUrl?: string;
  galleryImages?: string[];
  variants?: ProductVariant[]; // Backend trả về mảng này
}

// Định nghĩa CartItem (Độc lập, không extends Product để tránh lỗi thừa data)
export interface CartItem {
  id: number;          // ID của Product Cha
  skuCode: string;     // SKU của Variant con (QUAN TRỌNG: Order Service cần cái này)
  name: string;        // Tên hiển thị (VD: Jordan 1 - Red - 40)
  price: number;       // Giá của Variant
  imageUrl: string;    // Ảnh của Variant
  quantity: number;
  
  // Thông tin phụ để hiển thị
  category?: string;
  selectedColor?: string;
  selectedSize?: string;
}

export interface CreateVariantRequest {
  skuCode: string;
  color: string;
  size: string;
  price: number;
  imageUrl: string;
  galleryImages?: string[];
  initialQuantity: number;
  isActive?: boolean;
}

export interface CreateProductRequest {
  name: string;
  description: string;
  category: string;
  basePrice: number;
  imageUrl: string;
  galleryImages: string[];
  variants: CreateVariantRequest[];
}