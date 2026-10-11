-- ==============================================================================
-- İdari360 - Başlangıç Verileri (Seed Data)
-- Migration: 003_seed_data.sql
-- ==============================================================================

-- Not: Bu dosya, sisteme ilk denetim soru şablonlarını ve varsayılan
-- ayarları yükler. Şirket-spesifik veriler çalışma zamanında oluşturulur.

-- ==============================================================================
-- 1. VARSAYILAN DENETİM TÜRLERİ (ŞABLON - company_id NULL = global şablon)
-- ==============================================================================

-- Not: Gerçek audit_types her şirket oluşturulduğunda bu şablonlardan
-- kopyalanacaktır. Aşağıdaki yapı referans amaçlıdır.

-- ==============================================================================
-- 2. YEMEKHANE YERİNDE ÜRETİM - DENETİM SORULARI ŞABLONU
-- ==============================================================================

-- Bu veriler, yeni bir şirket oluşturulduğunda otomatik olarak
-- ilgili tablolara kopyalanacak şablon verilerdir.

CREATE TABLE IF NOT EXISTS public.audit_question_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    module audit_module NOT NULL,
    category_name text NOT NULL,
    question_text text NOT NULL,
    max_points integer NOT NULL DEFAULT 1,
    sort_order integer NOT NULL DEFAULT 0,
    category_sort_order integer NOT NULL DEFAULT 0,
    category_max_score integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT clock_timestamp() NOT NULL
);

-- Yemekhane Yerinde Üretim - Hazırlık, Pişirme ve Sevkiyat (36p)
INSERT INTO public.audit_question_templates (module, category_name, question_text, max_points, sort_order, category_sort_order, category_max_score) VALUES
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'El yıkama lavaboları fiziksel özellikleri uygun mu?', 2, 1, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'El yıkama lavaboları ulaşılabilir, kullanıma uygun durumda mı?', 2, 2, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'El yıkama dışında herhangi başka bir amaç için kullanılmıyor', 2, 3, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Üretim boyunca sıcak (ılık) su sağlanıyor mu?', 2, 4, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'El yıkama talimatları mevcut mu?', 2, 5, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Antibakteriyel sabun, el dezenfektanı, tek kullanımlık kağıt havlu temiz ve kullanılabilir durumda mı?', 2, 6, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'El yıkama lavaboları yanında sadece pedallı çöp kovası mevcut mu?', 2, 7, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Tüm personel gıda maddeleri ile temas etmeden önce ellerini yıkıyor mu?', 2, 8, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Gerekli durumlarda talimatlara uygun eldiven kullanılıyor?', 2, 9, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Sebze-Meyve Dezenfeksiyonu talimata uygun mu?', 2, 10, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Tüm kritik limitler ile ilgili çalışanlar yeterli bilgiye sahip mi?', 2, 11, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Gıda ürünlerinin tüm hazırlık aşamalarında çapraz kontaminasyona karşı önlem alınmış mı?', 2, 12, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Ortamda üzeri açık gıda maddesi var mı?', 2, 13, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Direkt yere bırakılmış ürün, ekipman vb. var mı?', 2, 14, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Temiz ve kirli bölümler tanımlanmış mı?', 2, 15, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Ürün grup ve risklerine göre renk koduna göre tezgah/bıçak kapasitesi yeterli ve ayrımı yapılmış mı?', 2, 16, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Üretim alanında atık ve yabancı malzeme var mı?', 2, 17, 1, 36),
('yemekhane_yerinde', 'Hazırlık, Pişirme ve Sevkiyat', 'Üretim alanında cam malzeme ve cam ambalaj var mı?', 2, 18, 1, 36),

-- Yemekhane Yerinde Üretim - Servis Alanı ve Yemek Salonu (20p)
('yemekhane_yerinde', 'Servis Alanı ve Yemek Salonu', 'Servis personelinin kıyafeti, davranışları hijyen kurallarına uygun mu?', 2, 1, 2, 20),
('yemekhane_yerinde', 'Servis Alanı ve Yemek Salonu', 'Servis bölümünün genel temizlik ve düzeni uygun mu?', 2, 2, 2, 20),
('yemekhane_yerinde', 'Servis Alanı ve Yemek Salonu', 'Servis ekipmanları temiz mi?', 2, 3, 2, 20),
('yemekhane_yerinde', 'Servis Alanı ve Yemek Salonu', 'Servis alanındaki tüm ekipmanlar kullanılabilir durumda mı?', 1, 4, 2, 20),
('yemekhane_yerinde', 'Servis Alanı ve Yemek Salonu', 'Alanda alerjen afişleri mevcut mu?', 1, 5, 2, 20),
('yemekhane_yerinde', 'Servis Alanı ve Yemek Salonu', 'Yemeklere yakın yerlerde besin etiketleri, kantin/kafeteryalarda alerjen besin bilgi tablosu mevcut mu?', 2, 6, 2, 20),
('yemekhane_yerinde', 'Servis Alanı ve Yemek Salonu', 'Yemek salonu tertip ve düzeni talimatlara uygun mu?', 2, 7, 2, 20),
('yemekhane_yerinde', 'Servis Alanı ve Yemek Salonu', 'Yemek salonu temiz ve düzenli mi? (masa, sandalye, masa örtüsü vs)', 2, 8, 2, 20),
('yemekhane_yerinde', 'Servis Alanı ve Yemek Salonu', 'Servis ekipmanlarının temizliği uygun mu? (tuzluk, biberlik vb.)', 1, 9, 2, 20),
('yemekhane_yerinde', 'Servis Alanı ve Yemek Salonu', 'Su sebilleri paslı değil ve temiz mi?', 2, 10, 2, 20),
('yemekhane_yerinde', 'Servis Alanı ve Yemek Salonu', 'Saladbar, sos masaları, ekmek dolabı vs. temiz ve düzenli mi?', 2, 11, 2, 20),
('yemekhane_yerinde', 'Servis Alanı ve Yemek Salonu', 'Yemek salonunda cam, yer, kalorifer petekleri, duvarlar vs. temizliği uygun mu?', 1, 12, 2, 20),

-- Yemekhane Yerinde Üretim - Bina, Alet, Ekipmanlar (21p)
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Alet ve Ekipmanlar uygun ve temiz mi?', 2, 1, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Yer, raf, duvar, tavan, mazgal, çekmece, dolap, kapı vs. temizlikleri uygun mu?', 1, 2, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Ocak, fırın, davlumbaz, ben-mari v.b. büyük ekipman temizlikleri uygun mu?', 1, 3, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Tepsi, gastronom, tencere vs. ekipman temizliği uygun mu?', 1, 4, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Küçük ekipman temizliği uygun mu?', 1, 5, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Kıyma makinası, sebze makinesi hamur makinesi vs. ve parçalarının temizliği uygun mu?', 1, 6, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Ekipmanların dezenfeksiyonu talimata uygun yapılıyor mu?', 1, 7, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Stalizatör çalışır durumda ve kullanılıyor mu?', 1, 8, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'UV lambalarının bakımı güncel mi?', 1, 9, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Stalizatör içinde yabancı malzeme mevcut mu?', 1, 10, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Stalizatör temizliği yeterli mi?', 1, 11, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Alanda dezenfektan havuzu mevcut mu?', 1, 12, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Kesim tezgahlarında yıpranma veya derin çizik var mı?', 1, 13, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Çöp kovaları temiz, poşetli ve kapaklı mı?', 1, 14, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Tahtadan yapılmış malzeme var mı?', 1, 15, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Aydınlatma yeterli ve korumaları mevcut mu?', 1, 16, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Çalışma tezgahları, evye içleri ve eyvelerin iç süzgeç altları vs. temiz. Eyvelerin boruları gidere takılı mı?', 1, 17, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Haşere kontrolü talimata göre planlanıyor mu?', 1, 18, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Yemli haşere kontrol noktaları uygun mu?', 1, 19, 3, 21),
('yemekhane_yerinde', 'Bina, Alet, Ekipmanlar', 'Elektrikli pest kontrol önlem cihazları uygun mu?', 1, 20, 3, 21),

-- Yemekhane Yerinde Üretim - Sanitasyon (16p)
('yemekhane_yerinde', 'Sanitasyon', 'Temizlik planları ve talimatlara uygun temizlik maddeleri kullanılıyor. Kimyasalların MSDS bilgileri mevcut mu?', 2, 1, 4, 16),
('yemekhane_yerinde', 'Sanitasyon', 'Temizlik maddeleri ile gıdaların ve gıdaya direkt temas eden malzemelerin birbirine teması kesilmiş mi?', 2, 2, 4, 16),
('yemekhane_yerinde', 'Sanitasyon', 'Temizlik maddeleri kuralına uygun muhafaza ediliyor mu?', 2, 3, 4, 16),
('yemekhane_yerinde', 'Sanitasyon', 'Mutfak girişlerinde dezenfektanlı paspas/galoş, bone ve ziyaretçi önlüğü var ve kullanılıyor mu?', 2, 4, 4, 16),
('yemekhane_yerinde', 'Sanitasyon', 'Bulaşık makinasında son durulama suyu sıcaklığı 75°C ve üzerinde mi?', 2, 5, 4, 16),
('yemekhane_yerinde', 'Sanitasyon', 'Bulaşık makinası ön yıkama, yıkama ve durulama suyu sıcaklığı talimata uygun mu?', 2, 6, 4, 16),
('yemekhane_yerinde', 'Sanitasyon', 'Temizlik bezleri, mop püskülleri vb. temiz ve uygun yere bırakılıyor mu?', 2, 7, 4, 16),
('yemekhane_yerinde', 'Sanitasyon', 'Temizlik bezleri renk tanımlaması mevcut mu?', 2, 8, 4, 16),

-- Yemekhane Yerinde Üretim - Soyunma Odaları (7p)
('yemekhane_yerinde', 'Soyunma Odaları', 'Soyunma odaları genel hijyen ve düzenleri uygun mu?', 2, 1, 5, 7),
('yemekhane_yerinde', 'Soyunma Odaları', 'İş kıyafetleri ve sivil kıyafetler ayrılmış, ayakkabılar poşetli, duvar, yer, kapı temizliği uygun mu?', 2, 2, 5, 7),
('yemekhane_yerinde', 'Soyunma Odaları', 'Dezenfektan içeren lavabolar temiz mi? (el dezenfektanı, kağıt havlu, lavabo yanında kapaklı atık kovası mevcut)', 1, 3, 5, 7),
('yemekhane_yerinde', 'Soyunma Odaları', 'Tuvalet giriş-çıkışları kontrol altına alınmış mı? (hijyen paspası, galoş, farklı terlik vs.)', 1, 4, 5, 7),
('yemekhane_yerinde', 'Soyunma Odaları', 'Kirli kıyafetler, örtüler vb. kontrol altına alınmış mı?', 1, 5, 5, 7),

-- ==============================================================================
-- TEMİZLİK DENETİMİ SORULARI
-- ==============================================================================

-- Temizlik - Operasyon Alanı (31p)
('temizlik', 'Operasyon Alanı', 'Streç ve karton atıkları toplanmış mı / toplanıyor mu?', 3, 1, 1, 31),
('temizlik', 'Operasyon Alanı', 'Binicili makina ile yıkama yapılıyor mu?', 3, 2, 1, 31),
('temizlik', 'Operasyon Alanı', 'Operasyon alanında yıkama araçlarına ait kullanma talimatları mevcut mu?', 3, 3, 1, 31),
('temizlik', 'Operasyon Alanı', 'Operasyon alanında bulunan temizlik ekipmanları düzenli ve tanımlı yerlerde mi?', 2, 4, 1, 31),
('temizlik', 'Operasyon Alanı', 'Temizlik ekipmanlarının fiziki ve temizlik şartları uygun mu?', 3, 5, 1, 31),
('temizlik', 'Operasyon Alanı', 'Operasyon alanı içerisindeki dolapların içerik tanımlamaları mevcut mu?', 2, 6, 1, 31),
('temizlik', 'Operasyon Alanı', 'Zeminlerde ve yüzeylerde toz, kir mevcut mu?', 3, 7, 1, 31),
('temizlik', 'Operasyon Alanı', 'Rampa kapıları, kapı kumandaları ve aydınlatmalar temiz mi?', 3, 8, 1, 31),
('temizlik', 'Operasyon Alanı', 'Spiraller ve sorter temiz mi?', 3, 9, 1, 31),
('temizlik', 'Operasyon Alanı', 'Merdiven korkulukları temiz mi?', 3, 10, 1, 31),
('temizlik', 'Operasyon Alanı', 'Yüksek alan yangın boruları ve doğalgaz ranyantları temiz mi?', 3, 11, 1, 31),

-- Temizlik - WC ve Soyunma Odaları (21p)
('temizlik', 'WC ve Soyunma Odaları', 'Temizlik talimatlarında tanımlanmış bez ve kimyasallar ile temizlik yapılıyor mu?', 3, 1, 2, 21),
('temizlik', 'WC ve Soyunma Odaları', 'Çöpler alınmış ve temiz mi?', 3, 2, 2, 21),
('temizlik', 'WC ve Soyunma Odaları', 'Tuvalet ekipmanları (sifon, sabun ve su armatürleri, kapı kilidi vs.) çalışır durumda mı?', 3, 3, 2, 21),
('temizlik', 'WC ve Soyunma Odaları', 'Açık alanda kimyasal malzeme bulunuyor mu?', 3, 4, 2, 21),
('temizlik', 'WC ve Soyunma Odaları', 'Zemin temizliği uygun mu?', 3, 5, 2, 21),
('temizlik', 'WC ve Soyunma Odaları', 'WC ekipmanları kullanıma uygun mu?', 3, 6, 2, 21),
('temizlik', 'WC ve Soyunma Odaları', 'Kokulandırma ve hijyen cihazları çalışıyor mu?', 3, 7, 2, 21),

-- Temizlik - Ortak ve Mola Alanları (24p)
('temizlik', 'Ortak ve Mola Alanları', 'Masalar ve oturaklar temiz mi?', 3, 1, 3, 24),
('temizlik', 'Ortak ve Mola Alanları', 'Camlar cam kenarları temiz mi?', 3, 2, 3, 24),
('temizlik', 'Ortak ve Mola Alanları', 'Çay alanı sarf malzeme tam mı?', 3, 3, 3, 24),
('temizlik', 'Ortak ve Mola Alanları', 'Çay alanı temiz mi?', 3, 4, 3, 24),
('temizlik', 'Ortak ve Mola Alanları', 'Çay demlenmiş mi?', 3, 5, 3, 24),
('temizlik', 'Ortak ve Mola Alanları', 'Zemin temiz mi?', 3, 6, 3, 24),
('temizlik', 'Ortak ve Mola Alanları', 'Küllükler temiz mi?', 3, 7, 3, 24),
('temizlik', 'Ortak ve Mola Alanları', 'Çöpler alınmış ve ISG kurallarına uygun poşet takılmış mı?', 3, 8, 3, 24),

-- Temizlik - Ofis Alanları (24p)
('temizlik', 'Ofis Alanları', 'Ofis mutfak alanı temiz mi?', 3, 1, 4, 24),
('temizlik', 'Ofis Alanları', 'Zeminler temiz mi?', 3, 2, 4, 24),
('temizlik', 'Ofis Alanları', 'Masalar temiz mi?', 3, 3, 4, 24),
('temizlik', 'Ofis Alanları', 'Toplantı odaları temiz mi?', 3, 4, 4, 24),
('temizlik', 'Ofis Alanları', 'İç alan camları temiz mi?', 3, 5, 4, 24),
('temizlik', 'Ofis Alanları', 'Toplantı odaları camları temiz mi?', 3, 6, 4, 24),
('temizlik', 'Ofis Alanları', 'Kırtasiye dolapları temiz düzenli ve tanımlı mı?', 3, 7, 4, 24),
('temizlik', 'Ofis Alanları', 'Ofis WC''ler temiz mi?', 3, 8, 4, 24),

-- ==============================================================================
-- YEMEKHANE TAŞIMA DENETİMİ SORULARI
-- ==============================================================================

-- Yemekhane Taşıma - Servis Alanı ve Yemek Salonu (33p)
('yemekhane_tasima', 'Servis Alanı ve Yemek Salonu', 'Servis personelinin kıyafeti, davranışları hijyen kurallarına uygun mu?', 3, 1, 1, 33),
('yemekhane_tasima', 'Servis Alanı ve Yemek Salonu', 'Servis bölümünün genel temizlik ve düzeni uygun mu?', 3, 2, 1, 33),
('yemekhane_tasima', 'Servis Alanı ve Yemek Salonu', 'Servis ekipmanları temiz mi?', 3, 3, 1, 33),
('yemekhane_tasima', 'Servis Alanı ve Yemek Salonu', 'Servis alanındaki tüm ekipmanlar kullanılabilir durumda mı?', 2, 4, 1, 33),
('yemekhane_tasima', 'Servis Alanı ve Yemek Salonu', 'Alanda alerjen afişleri mevcut mu?', 3, 5, 1, 33),
('yemekhane_tasima', 'Servis Alanı ve Yemek Salonu', 'Yemeklere yakın yerlerde besin etiketleri, kantin/kafeteryalarda alerjen besin bilgi tablosu mevcut mu?', 2, 6, 1, 33),
('yemekhane_tasima', 'Servis Alanı ve Yemek Salonu', 'Yemek salonu tertip ve düzeni talimatlara uygun mu?', 3, 7, 1, 33),
('yemekhane_tasima', 'Servis Alanı ve Yemek Salonu', 'Yemek salonu temiz ve düzenli mi? (masa, sandalye, masa örtüsü vs)', 3, 8, 1, 33),
('yemekhane_tasima', 'Servis Alanı ve Yemek Salonu', 'Servis ekipmanlarının temizliği uygun mu? (tuzluk, biberlik vb.)', 3, 9, 1, 33),
('yemekhane_tasima', 'Servis Alanı ve Yemek Salonu', 'Su sebilleri paslı değil ve temiz mi?', 3, 10, 1, 33),
('yemekhane_tasima', 'Servis Alanı ve Yemek Salonu', 'Saladbar, sos masaları, ekmek dolabı vs. temiz ve düzenli mi?', 3, 11, 1, 33),
('yemekhane_tasima', 'Servis Alanı ve Yemek Salonu', 'Yemek salonunda cam, yer, kalorifer petekleri, duvarlar vs. temizliği uygun mu?', 2, 12, 1, 33),

-- Yemekhane Taşıma - Bina, Alet, Ekipmanlar (33p)
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Alet ve Ekipmanlar uygun ve temiz mi?', 2, 1, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Yer, raf, duvar, tavan, mazgal, çekmece, dolap, kapı vs. temizlikleri uygun mu?', 2, 2, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Tepsi, gastronom, tencere vs. ekipman temizliği uygun mu?', 3, 3, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Küçük ekipman temizliği uygun mu?', 2, 4, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Ekipmanların dezenfeksiyonu talimata uygun yapılıyor mu?', 2, 5, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Stalizatör çalışır durumda ve kullanılıyor mu?', 2, 6, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'UV lambalarının bakımı güncel mi?', 2, 7, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Stalizatör içinde yabancı malzeme mevcut mu?', 2, 8, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Stalizatör temizliği yeterli mi?', 2, 9, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Çöp kovaları temiz, poşetli ve kapaklı mı?', 2, 10, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Tahtadan yapılmış malzeme var mı?', 2, 11, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Aydınlatma yeterli ve korumaları mevcut mu?', 2, 12, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Çalışma tezgahları, evye içleri ve eyvelerin iç süzgeç altları vs. temiz. Eyvelerin boruları gidere takılı mı?', 2, 13, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Haşere kontrolü talimata göre planlanıyor mu?', 2, 14, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Yemli haşere kontrol noktaları uygun mu?', 2, 15, 2, 33),
('yemekhane_tasima', 'Bina, Alet, Ekipmanlar', 'Elektrikli pest kontrol önlem cihazları uygun mu?', 2, 16, 2, 33),

-- Yemekhane Taşıma - Sanitasyon (24p)
('yemekhane_tasima', 'Sanitasyon', 'Temizlik planları ve talimatlara uygun temizlik maddeleri kullanılıyor. Kimyasalların MSDS bilgileri mevcut mu?', 3, 1, 3, 24),
('yemekhane_tasima', 'Sanitasyon', 'Temizlik maddeleri ile gıdaların ve gıdaya direkt temas eden malzemelerin birbirine teması kesilmiş mi?', 3, 2, 3, 24),
('yemekhane_tasima', 'Sanitasyon', 'Temizlik maddeleri kuralına uygun muhafaza ediliyor mu?', 3, 3, 3, 24),
('yemekhane_tasima', 'Sanitasyon', 'Mutfak girişlerinde dezenfektanlı paspas/galoş, bone ve ziyaretçi önlüğü var ve kullanılıyor mu?', 3, 4, 3, 24),
('yemekhane_tasima', 'Sanitasyon', 'Bulaşık makinasında son durulama suyu sıcaklığı 75°C ve üzerinde mi?', 3, 5, 3, 24),
('yemekhane_tasima', 'Sanitasyon', 'Bulaşık makinası ön yıkama, yıkama ve durulama suyu sıcaklığı talimata uygun mu?', 3, 6, 3, 24),
('yemekhane_tasima', 'Sanitasyon', 'Temizlik bezleri, mop püskülleri vb. temiz ve uygun yere bırakılıyor mu?', 3, 7, 3, 24),
('yemekhane_tasima', 'Sanitasyon', 'Temizlik bezleri renk tanımlaması mevcut mu?', 3, 8, 3, 24),

-- Yemekhane Taşıma - Soyunma Odaları (10p)
('yemekhane_tasima', 'Soyunma Odaları', 'Soyunma odaları genel hijyen ve düzenleri uygun mu?', 2, 1, 4, 10),
('yemekhane_tasima', 'Soyunma Odaları', 'İş kıyafetleri ve sivil kıyafetler ayrılmış, ayakkabılar poşetli, duvar, yer, kapı temizliği uygun mu?', 2, 2, 4, 10),
('yemekhane_tasima', 'Soyunma Odaları', 'Dezenfektan içeren lavabolar temiz mi? (el dezenfektanı, kağıt havlu, lavabo yanında kapaklı atık kovası mevcut)', 2, 3, 4, 10),
('yemekhane_tasima', 'Soyunma Odaları', 'Tuvalet giriş-çıkışları kontrol altına alınmış mı? (hijyen paspası, galoş, farklı terlik vs.)', 2, 4, 4, 10),
('yemekhane_tasima', 'Soyunma Odaları', 'Kirli kıyafetler, örtüler vb. kontrol altına alınmış mı?', 2, 5, 4, 10);

-- ==============================================================================
-- SERVİS DENETİMİ SORULARI
-- ==============================================================================

INSERT INTO public.audit_question_templates (module, category_name, question_text, max_points, sort_order, category_sort_order, category_max_score) VALUES
-- Servis - Servis Aracı
('servis', 'Servis Aracı', 'Aracın markası?', 0, 1, 1, 0),
('servis', 'Servis Aracı', 'Servis Model Yılı?', 0, 2, 1, 0),
('servis', 'Servis Aracı', 'Aracın iç ve dış temizliği uygun mu?', 5, 3, 1, 0),
('servis', 'Servis Aracı', 'Klima sistemi çalışıyor ve yeterli performans gösteriyor mu?', 5, 4, 1, 0),
('servis', 'Servis Aracı', 'Emniyet kemerleri tüm koltuklarda çalışır durumda mı?', 5, 5, 1, 0),
('servis', 'Servis Aracı', 'Yangın söndürücü mevcut, dolum tarihi geçerli ve kolay ulaşılabilir mi?', 5, 6, 1, 0),
('servis', 'Servis Aracı', 'İlk yardım çantası eksiksiz ve son kullanma tarihleri uygun mu?', 5, 7, 1, 0),
('servis', 'Servis Aracı', 'Acil çıkışlar, acil çıkış çekici ve güvenlik ekipmanları çalışır durumda mı?', 5, 8, 1, 0),
('servis', 'Servis Aracı', 'Lastiklerin diş derinliği ve genel durumu uygun mu?', 5, 9, 1, 0),
('servis', 'Servis Aracı', 'Farlar, sinyaller, stop lambaları ve geri vites lambaları çalışıyor mu?', 5, 10, 1, 0),
('servis', 'Servis Aracı', 'Camlar, aynalar ve silecekler sağlam ve çalışır durumda mı?', 5, 11, 1, 0),
('servis', 'Servis Aracı', 'Araç içerisinde kötü koku, sigara kokusu veya hijyen sorunu var mı?', 5, 12, 1, 0),
('servis', 'Servis Aracı', 'Koltuklar sağlam, temiz ve yolcu kullanımına uygun mu?', 5, 13, 1, 0),
('servis', 'Servis Aracı', 'Sürücü personellere karşı saygılı ve profesyonel bir iletişim sergiliyor mu?', 5, 14, 1, 0),

-- Servis - Evraklar
('servis', 'Evraklar', 'Sürücü üzerinde kimlik kartı ve gerekli sürücü belgeleri (SRC, Psikoteknik vb.) güncel ve yanında mı?', 5, 1, 2, 0);

-- ==============================================================================
-- RLS: audit_question_templates tablosu herkes okuyabilir
-- ==============================================================================
ALTER TABLE public.audit_question_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_question_templates_select_all"
ON public.audit_question_templates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "audit_question_templates_insert_super_admin"
ON public.audit_question_templates FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "audit_question_templates_update_super_admin"
ON public.audit_question_templates FOR UPDATE
TO authenticated
USING (public.is_super_admin());

CREATE POLICY "audit_question_templates_delete_super_admin"
ON public.audit_question_templates FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- ==============================================================================
-- FONKSİYON: Yeni şirket oluşturulduğunda şablon soruları kopyala
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.copy_audit_templates_for_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_type_id uuid;
    v_cat_id uuid;
    rec_mod RECORD;
    rec_cat RECORD;
BEGIN
    -- Her modül için audit_type oluştur
    FOR rec_mod IN (SELECT DISTINCT module FROM audit_question_templates) LOOP
        INSERT INTO audit_types (company_id, module, name, description, max_score, is_active)
        VALUES (
            NEW.id,
            rec_mod.module,
            CASE rec_mod.module
                WHEN 'yemekhane_yerinde' THEN 'Yemekhane Yerinde Üretim Denetimi'
                WHEN 'yemekhane_tasima' THEN 'Yemekhane Taşıma Denetimi'
                WHEN 'servis' THEN 'Servis Denetimi'
                WHEN 'temizlik' THEN 'Temizlik Denetimi'
                WHEN 'guvenlik' THEN 'Güvenlik Denetimi'
            END,
            CASE rec_mod.module
                WHEN 'yemekhane_yerinde' THEN 'Yerinde üretim yapan yemekhane hijyen denetimi'
                WHEN 'yemekhane_tasima' THEN 'Taşıma yemekhane hijyen denetimi'
                WHEN 'servis' THEN 'Personel servis aracı denetimi'
                WHEN 'temizlik' THEN 'Genel temizlik denetimi'
                WHEN 'guvenlik' THEN 'Güvenlik hizmetleri denetimi'
            END,
            100,
            true
        )
        RETURNING id INTO v_type_id;

        -- Her kategori için audit_category oluştur
        FOR rec_cat IN (
            SELECT DISTINCT category_name, category_sort_order, category_max_score
            FROM audit_question_templates
            WHERE module = rec_mod.module
            ORDER BY category_sort_order
        ) LOOP
            INSERT INTO audit_categories (audit_type_id, name, max_score, sort_order)
            VALUES (v_type_id, rec_cat.category_name, rec_cat.category_max_score, rec_cat.category_sort_order)
            RETURNING id INTO v_cat_id;

            -- Soruları kopyala
            INSERT INTO audit_questions (category_id, question_text, max_points, sort_order, is_active)
            SELECT v_cat_id, question_text, max_points, sort_order, true
            FROM audit_question_templates
            WHERE module = rec_mod.module AND category_name = rec_cat.category_name
            ORDER BY sort_order;
        END LOOP;
    END LOOP;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_copy_audit_templates_on_company_create
    AFTER INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.copy_audit_templates_for_company();

-- ==============================================================================
-- BİTİŞ
-- ==============================================================================
