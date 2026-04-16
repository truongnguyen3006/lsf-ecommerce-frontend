'use client';

import { useEffect, useState, useMemo } from 'react';
import { Row, Col, Button, Rate, Skeleton, message, Image as AntImage } from 'antd';
import { ShoppingCartOutlined, HeartOutlined } from '@ant-design/icons';
import { useParams } from 'next/navigation';
import { productApi } from '@/services/productApi';
import { Product, ProductVariant } from '@/types';
import { useCartStore } from '@/store/useCartStore'; // Giả sử bạn có store giỏ hàng

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // STATE QUAN TRỌNG
  const [selectedColor, setSelectedColor] = useState<string>(''); // Màu đang chọn
  const [selectedSize, setSelectedSize] = useState<string>('');   // Size đang chọn
  const [currentSku, setCurrentSku] = useState<string>('');       // SKU cuối cùng để add giỏ hàng
  
  // 1. Lấy dữ liệu
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await productApi.getById(Number(id)) as unknown as Product;
        setProduct(data);

        // LOGIC MẶC ĐỊNH: Tự chọn màu đầu tiên khi mới vào trang
        if (data.variants && data.variants.length > 0) {
           // Tìm màu đầu tiên có trong danh sách
           const firstColor = data.variants[0].color;
           setSelectedColor(firstColor);
        }
      } catch (error) {
        message.error('Không tải được sản phẩm');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProduct();
  }, [id]);

  // 2. LOGIC GOM NHÓM (GROUPING)
  // Tính toán lại mỗi khi product thay đổi
  const { colorOptions, sizeOptionsForColor, currentVariantImages, currentPrice } = useMemo(() => {
    if (!product || !product.variants) return { 
        colorOptions: [], sizeOptionsForColor: [], currentVariantImages: [], currentPrice: 0 
    };

    // A. Lấy danh sách các màu duy nhất (Unique Colors)
    // Để hiển thị list các ô vuông màu nhỏ bên phải
    const uniqueColors = Array.from(new Set(product.variants.map(v => v.color)));

    // B. Lấy các Size khả dụng cho Màu đang chọn (selectedColor)
    const variantsOfColor = product.variants.filter(v => v.color === selectedColor);
    const sizes = variantsOfColor.map(v => ({ 
        size: v.size, 
        sku: v.skuCode, 
        quantity: 100 // Giả sử lấy từ API, nếu =0 thì disable nút
    }));

    // C. Lấy bộ ảnh (Gallery) cho Màu đang chọn
    // Lấy variant đầu tiên của màu này để làm đại diện ảnh
    const representVariant = variantsOfColor[0]; 
    
    // Logic hiển thị ảnh:
    // Ưu tiên: Gallery của Variant -> Ảnh đơn của Variant -> Gallery của Cha -> Ảnh đơn của Cha
    let images: string[] = [];
    if (representVariant) {
        if (representVariant.galleryImages && representVariant.galleryImages.length > 0) {
            images = representVariant.galleryImages;
        } else if (representVariant.imageUrl) {
            images = [representVariant.imageUrl];
        }
    }
    // Fallback: Nếu màu này chưa có ảnh riêng, lấy ảnh chung của Product Cha
    if (images.length === 0) {
        images = product.galleryImages && product.galleryImages.length > 0 
                 ? product.galleryImages 
                 : [product.imageUrl || ''];
    }

    // D. Giá tiền (Nếu màu này có giá khác, lấy giá đó, ko thì lấy giá Cha)
    const price = representVariant?.price && representVariant.price > 0 
                  ? representVariant.price 
                  : product.price;

    return {
        colorOptions: uniqueColors,
        sizeOptionsForColor: sizes,
        currentVariantImages: images,
        currentPrice: price
    };
  }, [product, selectedColor]);

  // Xử lý khi chọn Size -> Xác định được SKU cụ thể
  const handleSelectSize = (size: string, sku: string) => {
      setSelectedSize(size);
      setCurrentSku(sku);
  };

  const { addToCart } = useCartStore(); // Giả sử

  const handleAddToCart = () => {
      if (!selectedSize || !currentSku) {
          message.warning('Vui lòng chọn Size!');
          return;
      }
      // Gọi hàm add to cart
      // addToCart({ id: product.id, sku: currentSku, ... })
      message.success(`Đã thêm: ${product?.name} - ${selectedColor} - Size ${selectedSize}`);
  };

  if (loading || !product) return <div className="p-10"><Skeleton active /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <Row gutter={[48, 24]}>
        
        {/* ================= CỘT TRÁI: GALLERY ẢNH (GIỐNG NIKE) ================= */}
        {/* Nike thường để lưới ảnh dọc hoặc lưới 2 cột */}
        <Col xs={24} md={14}>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sticky top-24">
              {currentVariantImages.map((img, index) => (
                  <div key={index} className="bg-gray-100 rounded-lg overflow-hidden cursor-pointer">
                      <AntImage 
                        src={img} 
                        alt={`${product.name} view ${index}`} 
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      />
                  </div>
              ))}
           </div>
        </Col>

        {/* ================= CỘT PHẢI: THÔNG TIN CHI TIẾT ================= */}
        <Col xs={24} md={10}>
           <div className="sticky top-24">
              <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
              <div className="text-gray-500 mb-4">{product.category} • {selectedColor}</div>
              
              <div className="text-2xl font-medium mb-6">
                {currentPrice?.toLocaleString()} đ
              </div>

              {/* 1. CHỌN MÀU (THUMBNAILS) */}
              <div className="mb-8">
                  <div className="font-semibold mb-3">Chọn màu sắc: <span className="text-gray-500">{selectedColor}</span></div>
                  <div className="flex flex-wrap gap-3">
                      {colorOptions.map((color) => {
                          // Tìm ảnh đại diện cho màu này để hiển thị thumbnail
                          const variantOfThisColor = product.variants?.find(v => v.color === color);
                          const thumbUrl = variantOfThisColor?.imageUrl || product.imageUrl;

                          return (
                              <div 
                                key={color}
                                onClick={() => {
                                    setSelectedColor(color);
                                    setSelectedSize(''); // Reset size khi đổi màu
                                    setCurrentSku('');
                                }}
                                className={`
                                    w-20 h-20 rounded-md overflow-hidden border-2 cursor-pointer hover:border-gray-400 transition-all
                                    ${selectedColor === color ? 'border-black' : 'border-transparent'}
                                `}
                              >
                                  <img src={thumbUrl} alt={color} className="w-full h-full object-cover" />
                              </div>
                          );
                      })}
                  </div>
              </div>

              {/* 2. CHỌN SIZE */}
              <div className="mb-8">
                  <div className="flex justify-between mb-3">
                     <span className="font-semibold">Chọn Size</span>
                     <span className="text-gray-500 underline cursor-pointer">Bảng quy đổi size</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                      {sizeOptionsForColor.map((option) => (
                          <button
                             key={option.size}
                             onClick={() => handleSelectSize(option.size, option.sku)}
                             disabled={option.quantity === 0} // Hết hàng thì disable
                             className={`
                                py-3 rounded border text-center transition-all
                                ${selectedSize === option.size 
                                    ? 'border-black bg-black text-white' 
                                    : 'border-gray-300 hover:border-black bg-white text-gray-900'}
                                ${option.quantity === 0 ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}
                             `}
                          >
                              {option.size}
                          </button>
                      ))}
                  </div>
                   {sizeOptionsForColor.length === 0 && (
                       <div className="text-red-500 mt-2">Màu này tạm hết hàng mọi size.</div>
                   )}
              </div>

              {/* 3. BUTTONS ACTION */}
              <div className="flex flex-col gap-3">
                  <Button 
                    type="primary" 
                    size="large" 
                    block 
                    className="h-14 text-lg bg-black hover:bg-gray-800 rounded-full"
                    onClick={handleAddToCart}
                    disabled={!selectedSize} // Chưa chọn size thì disable
                  >
                     {selectedSize ? 'Thêm vào giỏ hàng' : 'Vui lòng chọn Size'}
                  </Button>
                  
                  <Button 
                    size="large" 
                    block 
                    icon={<HeartOutlined />}
                    className="h-14 text-lg rounded-full border-gray-300 hover:border-black"
                  >
                     Yêu thích
                  </Button>
              </div>

              {/* 4. MÔ TẢ & CHI TIẾT */}
              <div className="mt-10 border-t pt-6">
                 <p className="leading-relaxed text-gray-700">
                    {product.description || "Mô tả đang cập nhật..."}
                 </p>
                 <ul className="list-disc pl-5 mt-4 space-y-2 text-gray-600">
                     <li>Màu hiển thị: {selectedColor}</li>
                     <li>SKU: {currentSku || "Chưa chọn"}</li>
                     {/* Các thông tin static khác */}
                 </ul>
              </div>

           </div>
        </Col>
      </Row>
    </div>
  );
}