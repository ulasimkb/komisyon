# İl Trafik Komisyonu Karar Takip Sistemi

Kütahya Belediyesi Ulaşım Hizmetleri Müdürlüğü için hazırlanmış, Supabase tabanlı karar ve uygulama takip uygulaması.

## Neler çalışır?

- Supabase Auth ile yetkili kullanıcı girişi
- Karar, karar sonucu, konum ve kaynak referansı kaydı
- Kabul Edildi / Reddedildi / Kısmen Kabul / Şartlı Kabul ayrımı
- Reddedilen karar için uygulama bilgilerini gizleme ve görev açmayı hem arayüzde hem veritabanında engelleme
- Görev, müdürlük ve yazışma takibi
- Görev kartından durum, gerçek başlangıç tarihi, bekleme nedeni, sonraki işlem ve gerçekleşme bilgilerini sonradan düzeltme
- Görevlerde Ulaşım Hizmetleri, Fen İşleri veya elle girilen diğer müdürlük seçimi ve sorumlu kişi ataması
- Mevcut komisyon kararlarını ayrıntı ekranından düzenleme
- Karar uygulama durumunu bağlı görevlerin ilerlemesinden otomatik hesaplama; karar formunda elle durum seçimi bulunmaz
- Karar kayıtlarında ayrı bir kısa özet alanı yerine başlık ve özgün karar metnini kullanma
- Görev ilerledikçe bağlı kararın uygulama durumunu otomatik güncelleme
- Belge ve saha dosyalarını özel Supabase Storage alanına yükleme
- Konum geçmişi, genel arama, durum özeti ve temel rapor ekranları
- Değiştirilemeyen sunucu tarafı işlem geçmişi
- Masaüstü ve mobil uyumlu Türkçe arayüz

## Yerel çalıştırma

```powershell
npm install
npm run dev
```

Depodaki `.env.local` uygulamayı açıkça etiketlenmiş demo ortamında başlatır. Demo verileri yalnızca tarayıcıdaki demo alanına kaydedilir.

## Supabase bağlantısı

1. `.env.local` içinde `VITE_DEMO_MODE=false` yapın.
2. Supabase Dashboard → Project Settings → API bölümündeki publishable anahtarı `VITE_SUPABASE_PUBLISHABLE_KEY` alanına yazın.
3. `supabase/migrations` klasöründeki SQL dosyalarını tarih sırasıyla Supabase SQL Editor içinde çalıştırın.
4. Auth bölümünden ilk kullanıcıyı oluşturun. Kullanıcının `app_metadata` alanına rol ve birim kimliğini yönetici yetkisiyle ekleyin:

```json
{ "role": "admin", "unit_id": null }
```

5. Geliştirme sunucusunu yeniden başlatın.

Tarayıcıda yalnızca publishable anahtar kullanılır. `service_role`, secret veya JWT secret değerlerini hiçbir `VITE_` değişkenine eklemeyin.

## Doğrulama

```powershell
npm test
npm run build
```

Yerel Supabase kurulumu açıksa veritabanı testleri `supabase test db` ile çalıştırılabilir. Canlı Supabase projesine bu çalışma sırasında erişilmediği için migration otomatik uygulanmamıştır.
