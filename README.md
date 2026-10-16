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

Uygulama `komisyon` Supabase projesine bağlanacak şekilde yapılandırılmış ve `supabase/migrations` altındaki migration'lar canlı projeye uygulanmıştır. Başka bir ortam kurarken:

1. `.env.local` içinde `VITE_DEMO_MODE=false` yapın.
2. Supabase Dashboard → Project Settings → API bölümündeki publishable anahtarı `VITE_SUPABASE_PUBLISHABLE_KEY` alanına yazın.
3. Migration'ları Supabase CLI ile uygulayın (`supabase db push`).
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

Yerel Supabase kurulumu açıksa veritabanı testleri `supabase test db` ile çalıştırılabilir. Canlı projede şema, RLS politikaları, Storage bucket'ı ve migration geçmişi ayrıca doğrulanmıştır.

## Veritabanı yedeği

Supabase ücretsiz planı otomatik yedek sunmadığından yedek elle alınır.

**Bir kez:** PostgreSQL komut satırı araçlarını kurun (yalnızca `pg_dump` / `pg_restore` gerekir):

```bash
winget install PostgreSQL.PostgreSQL.17
```

**Yedek almak:** Proje klasöründe aşağıdaki komutu çalıştırın ve Supabase veritabanı parolasını girin (Project Settings → Database). Parola hiçbir dosyaya kaydedilmez.

```bash
npm run yedekle
```

Yedek `yedekler/YYYY-MM-DD_SSDD/` klasörüne yazılır ve Git'e gönderilmez:

| Dosya | İçerik |
|---|---|
| `komisyon-public.dump` | Tüm tablolar, kurallar ve veriler (geri yükleme için asıl dosya) |
| `komisyon-public.sql` | Aynı içeriğin okunabilir SQL kopyası |
| `auth-kullanicilar.sql` | Giriş hesapları (parola özetleri dahil; güvenli yerde saklayın) |

Yedekleri bilgisayar dışında da (harici disk, kurum sunucusu) saklayın.

**Geri yükleme** (yeni veya boş bir Supabase projesine; bağlantı bilgileri Connect → Session pooler):

```bash
pg_restore --host <pooler-sunucusu> --port 5432 --username postgres.<proje-ref> --dbname postgres --no-owner --clean --if-exists yedekler/<tarih>/komisyon-public.dump
```

Ardından `auth-kullanicilar.sql` dosyası `psql` ile aynı veritabanına yüklenir.
