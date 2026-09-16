# Uygulama denetimi — 16 Eylül 2026

## Kapsam ve sınırlar

Yerel demo uygulamasındaki 10 menü tarayıcıda incelendi. Menü geçişleri, bazı filtreler ve form davranışları etkileşimle sınandı; kayıt işlevleri ve veritabanı geçişleri kod üzerinden incelendi. Kullanıcının kayıtları değiştirilmedi. Canlı Supabase oturumu, yazma işlemleri, yetkiler ve geçişlerin sunucuda uygulanmış olması doğrulanmadı. Mevcut 9 test ve üretim derlemesi başarılı. Mevcut testler tüm kullanıcı akışlarını kapsamıyor.

## Öncelikli bulgular

| Öncelik | Bulgu ve kanıt | Öneri |
|---|---|---|
| Yüksek | Yeni görev formunda Tamamlandı seçilince gerçekleşme tarihi/açıklaması açılmıyor. İptal için de gerekçe alanı yok. Güncelleme formu bu alanları istiyor; canlı şemada tamamlanma ve iptal için kısıtlar var. Demo kayıt yolu aynı doğrulamayı yapmıyor. | Oluşturma ve güncellemede aynı durum doğrulamasını kullan; gerekirse yeni görevi yalnızca Planlandı durumunda başlat. |
| Yüksek | Uygulama gerektirmiyor görünen Karar 8 yeni görev seçeneklerinde bulunuyor. Durum hesaplaması bilgi amaçlı/görev alanı dışındaki kararlarda görev ilerlemesini dikkate almıyor. | Görev açma uygunluğunu karar kapsamı ile birlikte değerlendir. |
| Yüksek | Karar 3 ayrıntısında yalnız Ulaşım sorumlu, fakat Fen İşleri görevi mevcut. Görev müdürlüğü seçimi kararın sorumlu müdürlüklerinden bağımsız. | Karardan görev açarken ilgili müdürlükleri öner; farklı bir müdürlük atandığında açık bir sorumluluk güncelleme akışı uygula. |
| Yüksek | Karar ayrıntısındaki görev ve yazışmalar salt metin. Görev ekleme/düzenleme ve yazışma ekleme kısayolu yok. Görevden karara geri bağlantı da yok. | Karar → görev/yazışma ve görev/yazışma → karar yönlerinde bağlantılar ekle; karar kimliğini otomatik taşı. |
| Yüksek | Yazışmalarda Gelen filtresi seçildiğinde mevcut giden evrak listede kaldı. İlgili karar numarası tıklanabilir değil; taslak güncelleme ve cevabı kapatma akışı yok. | Filtreyi veriye bağla, yazışma düzenlemeyi ve cevap–görev ilişkisini tamamla. |
| Orta | Paket 2026/01 dört madde sayıyor ancak yalnız 1, 3 ve 5 gösteriliyor; Karar 8'e paket ekranından erişilemiyor. Kod ilk üç maddeyi kesiyor. | Paket ayrıntısı veya Tüm maddeleri gör bağlantısı ekle. |
| Orta | Konum listesi seçim yapmıyor; sağdaki geçmiş tüm kararları gösteriyor. Mahalle konum gruplamasında kullanılmıyor. | Mahalle/konum seçimini geçmiş filtresine bağla; aynı isimli farklı mahalle konumlarını ayır. |
| Orta | Görevsiz müdürlükler özet ekranına girebiliyor ama Görevlerim müdürlük seçenekleri yalnız mevcut görevlerden üretiliyor. Böyle bir müdürlükten geçildiğinde seçili filtre listede bulunmayabilir. | İki ekran için ortak müdürlük seçenekleri ve açık boş durum kullan. |
| Orta | Görev açılmamış hesabı bilgi amaçlı ve görev alanı dışındaki kararları dışlamıyor. İptal edilmiş görev ise görev var kabul ediliyor. | Takip gerektiren kararları ve aktif/iptal görev politikasını açıkça tanımla. |
| Orta | Genel Bakış / Tümünü gör düğmesi işlem yapmadı. Bu hafta kartındaki hesaplar tarih filtresi uygulamıyor. | Düğmeyi filtreli karar listesine bağla; haftalık hesaplama veya doğru başlık kullan. |
| Orta | Raporu hazırla düğmesi çıktı üretmedi; rapor düğmelerine kodda işlem bağlanmamış. Ayar yönetim düğmeleri de işlevsiz. | Rapor üretimi ve yönetim ekranlarını tamamla veya tamamlanmamış özellikleri açıkça belirt. |
| Orta | Belge içe aktarma ekranında karar seçme ve yüklenen belgeleri listeleme/açma akışı yok. Yükleme çağrısı karar kimliği taşımıyor. Kaldırılan kaynak referansı alanı hâlâ açıklama metninde vaat ediliyor. | Belgeyi karara/pakete bağlama ve belge listesi ekle; açıklamaları güncelle. |
| Orta | Paket içinden karara girilip Kararlara dön seçildiğinde paket ekranına dönüyor. Genel arama karar ayrıntısı açıkken seçili kararı kapatmıyor. Evrak no araması vaat edilmesine rağmen arama yazışmaları taramıyor. | Geri dönüş başlığını geldikleri ekranla eşleştir; arama sonuçlarını görünür aç ve evrak aramasını bağla. |
| Canlıya geçiş öncesi | Görev kaydı kişi/müdürlük adını gönderiyor; yetki kuralları assigned_to/responsible_unit_id kimliklerini kullanıyor. Ad seçmek kullanıcıya gerçek atama yapmıyor. | Personel ve birimleri kimliklerle bağla; personel hesabıyla erişim testleri yap. |
| Canlıya geçiş öncesi | Karar ve konum ilişkileri ayrı isteklerle yazılıyor; güncellemede eski konum ilişkileri yenileri eklenmeden siliniyor. Ara hata kısmi kayıt bırakabilir. | Karar ve ilişkilerini tek veritabanı işlemiyle kaydet; hata halinde tamamını geri al. |

## Doğrulanan çalışan akışlar

- On menünün ekranı açıldı.
- Paket içindeki görünen karar maddesi karar ayrıntısını açtı; doğru iki bağlı görev gösterildi.
- Fen İşleri / Görevleri gör, Görevlerim'e geçti; Fen İşleri filtresi ve 1/3 görev sayısı doğru geldi.
- Kararlar / Reddedildi filtresi dört kaydı bir kayda indirdi.
- Reddedilen Karar 1 yeni görev seçeneklerinde bulunmadı.
- Görev durumunun karar durumuna dönüşmesi için mevcut birim testleri geçti; tüm durum kombinasyonları ve kalıcı kayıt akışı bu testlerin kapsamında değil.

## Önerilen uygulama sırası

1. Görev oluşturma/güncelleme kurallarını ve karar–müdürlük tutarlılığını düzelt.
2. Karar ayrıntısından görev/yazışma oluşturma ve geri bağlantıları tamamla.
3. Yazışma, konum ve paket filtre/geçişlerini düzelt.
4. Görevsiz müdürlük ve boş liste senaryolarını tamamla.
5. Raporlar, belge bağlantıları ve yönetim ekranlarını tamamla.
6. Canlı kullanıcı atamaları, yetkiler, kayıt bütünlüğü ve kalıcı verilerle uçtan uca test yap.

Denetim sırasında uygulama kodunda işlevsel değişiklik yapılmadı.
# Uygulama sonrası durum — 16.09.2026

Bu raporda belirlenen menü ilişkisi ve veri bütünlüğü sorunları giderildi:

- Genel Bakış, karar detayları, paketler, konumlar, görevler, müdürlük takibi ve yazışmalar arasında bağlamsal geçişler eklendi.
- Uygulama gerektirmeyen kararlar görev seçiminden çıkarıldı; aynı kural veritabanı tetikleyicisine de taşındı.
- Yeni görev formunda tamamlanma, iptal ve bekleme durumlarının zorunlu alanları görünür hale getirildi.
- Yazışma yön filtresi, düzenleme, cevap takibi ve karar bağlantısı çalışır hale getirildi.
- Belge yükleme kararla ilişkilendirildi ve yüklenen belge listesi eklendi.
- Rapor kartları CSV üretir hale getirildi; ayar kartları içeriklerini açıp kapatıyor.
- Karar ve konum bağlantılarının canlı veritabanına tek transaction ile kaydedilmesi sağlandı.
- İlgili otomatik testler 13 senaryoya çıkarıldı ve tarayıcı akışları yeniden doğrulandı.
- “Kontrol bekliyor” görev ve karar durumu kaldırıldı; görev akışı Planlandı, İşlemde, Bekliyor, Tamamlandı veya İptal olarak sadeleştirildi.
- Demo başlangıç kararları, görevleri, yazışmaları ve belge kayıtları temizlendi; yeni demo depolama anahtarlarıyla eski tarayıcı kayıtlarının geri gelmesi önlendi.

## Ek bulgular sonrası güncellemeler — 16.09.2026

- Görev müdürlüğü değiştirildiğinde de karar–müdürlük tutarlılığını denetleyen veritabanı tetikleyicisi çalışacak şekilde genişletildi.
- Aktif görevi bulunan kararın kapsamı “Bilgi amaçlı” veya “Görev alanı dışında” yapılamıyor; demo ve canlı veri yolları aynı kuralı uyguluyor.
- Aynı konumun birden fazla yazılması hem formda hem atomik veritabanı işleminde tekilleştirildi.
- Görev değişikliklerinden sonra açık karar ayrıntısındaki uygulama durumu güncel kayıtla yenileniyor.
- Demo modunda yeni görev açıldığında kararın hesaplanan durumu kalıcı olarak güncelleniyor.
- Yazışmalar isteğe bağlı olarak göreve bağlanabiliyor; karar değiştirilirse önceki görev seçimi temizleniyor ve gönderim zamanı düzenleme sırasında korunuyor.
- Karar ayrıntısına bağlı belgeler eklendi; canlı kayıtlarda güvenli belge bağlantısı açılıyor.
- Paket sonucu “tümü reddedildi”, “tümü kabul edildi” ve “karma” durumlarını doğru gösteriyor.
- Tamamlanan kararlar Genel Bakış’taki öncelikli takip listesinden çıkarıldı; geciken görev sayacı eklendi.
- Genel arama görev başlığı, sorumlu müdürlük, sorumlu kişi, bekleme nedeni ve sonraki adımı da tarıyor; `Ctrl/Cmd + K` arama alanına odaklanıyor.
- Bildirim düğmesi geciken görevleri ve cevap beklenen yazışmaları gösteriyor.
- Raporların CSV başlıkları eklendi; mahalle alanı isteğe bağlı yapıldı ve müdürlük takibine boş durum eklendi.
- Belediye müdürlükleri canlı veritabanına başlangıç verisi olarak eklendi; karar okuma yetkileri tanımlı rollere genişletildi.
- Kullanılmayan eski karar/görev modal bileşenleri kaldırıldı ve görev panosu altı etkin durum sütununa uyarlandı.
- Her karar için tek ana uygulama görevi kuralı eklendi: görev atanmış kararlar yeni görev listesinden çıkarılıyor, karar ayrıntısındaki ekleme düğmesi gizleniyor ve yinelenen kayıt demo/canlı veri katmanında engelleniyor.
- Karar ayrıntısındaki “Bağlı belgeler ve ekler” bölümüne doğrudan dosya seçme ve seçili karara yükleme akışı eklendi; dosya türü, boş dosya ve 25 MB boyut sınırı demo ve canlı modda aynı şekilde doğrulanıyor. Demo modunda dosyanın kendisi IndexedDB içinde saklanıyor ve yeniden görüntülenebiliyor.
- Bağlı belge yüklemelerinde KMZ dosya türü destekleniyor; canlı Storage yüklemesinde standart `application/vnd.google-earth.kmz` MIME türü kullanılıyor.
- Kararlar tablosunda sütun genişlikleri sabitlendi; uzun teklif metinleri üç satırla sınırlandırılarak satırların ve durum etiketlerinin birbirine karışması önlendi.
- Konumlar ve Karar Geçmişi ekranında mahalleler ile cadde, kavşak ve mevki türündeki konumlar ayrı listelere ayrıldı; iki grup kendi karar geçmişini bağımsız filtreliyor.
