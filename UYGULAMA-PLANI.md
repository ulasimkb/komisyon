# İl Trafik Komisyonu Karar Takip Sistemi — Uygulama Planı

Kurum: Kütahya Belediyesi Ulaşım Hizmetleri Müdürlüğü  
Plan tarihi: 15.09.2026  
Kapsam: Uygulama geliştirilmeden önce iş kurallarının, ekranların, veri modelinin ve teslim aşamalarının belirlenmesi.

## 1. Amaç

Personelin bir cadde, sokak veya kavşakla ilgili kararları tek aramayla bulması; özgün karar metnine ulaşması; kabul edilen ve görev alanına giren işlerin sorumlu, yazışma, uygulama ve kontrol süreçlerini izlemesi.

Başarı ölçütü: Kararın ne istediği, hangi birimin işlem yapacağı, neyin beklendiği ve tamamlanmanın hangi kayıtla doğrulandığı aynı karar ekranından görülebilmeli.

## 2. Örnek belgeden elde edilen tasarım gereksinimleri

Kaynak: `2026 İL TRF. KOMİSYON KARARLARI.docx`. İnceleme, belgenin metin ve tablo içerikleri üzerinden yapılmıştır; fiziksel sayfa numaraları ve imza geçerliliği doğrulanmamıştır.

| Gözlem | Uygulamaya etkisi |
|---|---|
| Belgede 2026/01–2026/05 üst karar numaraları ve tekrar eden başlıklar var. | Tek belge birden fazla karar paketine bağlanacak; tekrar eden başlıklar yeni paket oluşturmayacak. Sıra numarası ay kabul edilmeyecek. |
| 2026/01, madde 1: Belediye Sokak yön değişikliği talebi reddediliyor, mevcut yön korunuyor. | Karar arşivde ve konum geçmişinde bulunacak; uygulama bilgisi istenmeyecek. |
| 2026/01, madde 2: cep açılması talebi oyçokluğuyla reddediliyor. | Üyelerden birinin kabul oyu kararın kabul edildiği anlamına gelmeyecek; nihai hüküm esas alınacak. |
| 2026/01, madde 3: Osmanlı ve Meydan caddeleri, kavşak düzenlemesi, önceden kamuoyu bilgilendirmesi ve işaretlemeler birlikte ele alınıyor. | Tek madde altında birden fazla konum, alt hüküm, görev ve görev sırası tutulacak. Fen İşleri gibi görev atamaları ayrıca kullanıcı tarafından doğrulanacak. |
| 2026/01, madde 5–7: Karayolları 14. Bölge Müdürlüğünün görüş ve onayına sunulma şartı var. | Kabul sonucu yanında koşul ve onay takibi bulunacak; hazırlık/yazışma yapılabilirken koşula bağlı saha işi başlatılamayacak. |
| 2026/01, madde 8: önceki sinyalizasyon kararının kaldırılması kabul ediliyor. | Kabul otomatik saha işi yaratmayacak; önceki kararla “kaldırır” ilişkisi kurulacak. |
| 2026/05, madde 51 içinde alıntılanan Tavşanlı kararlarının 9. maddesinde bir kabul ve üç ret alt sonucu var. | İl ana maddesi ile alıntı ilçe maddesi ayrılacak; karma sonuçlar alt hüküm seviyesinde saklanacak. |
| 2026/05 bölümünde farklı konular için iki “KARAR 52” başlığı bulunuyor. | Numara çelişkisi inceleme uyarısı olacak; kayıtlar otomatik birleştirilmeyecek veya yeniden numaralandırılmayacak. |
| Ek atıfları, kişisel bilgiler ve boş OLUR tarih alanları bulunuyor. | Ekler eşleştirilecek, eksikler işaretlenecek; genel raporlarda gereksiz kişisel bilgi gösterilmeyecek; imza bloğu onay kanıtı sayılmayacak. |

## 3. Karar sonucu ve ret kuralı

Karar girişinde “Karar sonucu” zorunlu olacak. “Kabul Edildi” ve “Reddedildi” doğrudan seçilebilir olacak. Kaynakta farklı hüküm olduğunda “Kısmen Kabul Edildi”, “Şartlı Kabul Edildi”, “Ertelendi” ve “Diğer” seçenekleri kullanılabilecek. İçe aktarmada sonuç kesin değilse taslak “Kontrol gerekli” olarak kalacak; varsayılan kabul atanmayacak.

### Reddedildi seçildiğinde

- Uygulama durumu, gerçekleşme tarihi, uygulama açıklaması, uygulama sorumlusu ve saha kanıtı alanları gösterilmeyecek ve zorunlu olmayacak.
- Kullanıcıdan ayrıca “Uygulama gerektirmiyor” seçmesi istenmeyecek. Sistem bunu karar sonucundan türetecek; listede “— (Ret kararı)” gösterilebilecek.
- Yeni uygulama görevi açılamayacak. Bu kural sunucuda/veritabanında da uygulanacak.
- Karar metni, mevcut ret gerekçesi, kaynak, konumlar ve arşiv bilgileri saklanacak. Gerekçeyi özgün metinden ayrıca tekrar yazma zorunluluğu olmayacak.
- Gerekirse kararın tebliğine ilişkin yazışma ve belge eklenebilecek; bunlar saha uygulaması sayılmayacak.
- Ret kararı geciken veya tamamlanmamış işler listesine ve uygulama tamamlanma oranının paydasına girmeyecek.
- Daha önce görev açılmış bir kaydın sonucu sonradan ret olarak düzeltilirse görev ve kanıt geçmişi silinmeyecek. Yetkili düzeltme işlemi gerekçesiyle kaydedilecek; aktif uygulama görevleri iptal edilerek takip kapsamından çıkarılacak. Bu işlem tek ve tutarlı bir işlem olarak yürütülecek.

### Kabul edildiğinde

Koordinatör önce Müdürlüğün ilgisini ve uygulama gerekip gerekmediğini belirleyecek. Kabul, tek başına “uygulandı” veya “saha işi gerekiyor” anlamına gelmeyecek. Şart varsa açıkça kaydedilecek. Kısmen kabul edilen maddelerin yalnızca kabul edilen alt hükümleri için uygulama takibi açılabilecek.

Birbirinden ayrı dört bilgi tutulacak:

1. Karar sonucu.
2. Belgenin doğrulama durumu.
3. Güncel uygulanabilirlik: değerlendirme bekliyor, koşul bekliyor, uygulanabilir, kaldırılmış/değiştirilmiş veya uygulama kapsamı dışında.
4. Uygulama gerektiren işlerin gerçekleşme durumu.

## 4. Temel kullanıcı akışı

1. **Belge veya manuel kayıt:** Karar paketi, kurum, karar tarihi, numara, gelen evrak bilgisi ve kaynak belge girilir.
2. **Madde kaydı:** Teklif, özgün karar metni, kontrol edilmiş özet, sonuç, konumlar ve kaynak referansı eklenir.
3. **Kapsam değerlendirmesi:** Doğrudan görev, koordinasyon, bilgi amaçlı, görev alanı dışında veya değerlendirme bekliyor seçilir. Ret kaydında uygulama adımı açılmaz.
4. **İş planı:** Gerekli alt işler, ana sorumlu birim, destek birimleri, personel, ön koşullar ve varsa hedef tarihler belirlenir.
5. **Yazışma ve yürütme:** Gönderilen yazılar, gelen cevaplar, dış onaylar ve saha işlemleri takip edilir.
6. **Kontrol:** Personel gerçekleşme açıklaması, tarihi ve kanıt ekleyerek işi kontrol bekliyor durumuna getirir.
7. **Kapatma:** Kontrol yetkilisi onaylar veya gerekçeyle geri gönderir. Kararın genel durumu zorunlu alt işlerden hesaplanır.

Örnek iş sırası: Fen İşleri yapım işi → saha kontrolü → Ulaşım işaretlemesi → nihai kontrol. Görev bağımlılıklarında döngüye izin verilmeyecek.

## 5. Ekran planı

Tüm ekranlarda Türkçe metinler, belirgin genel arama, kurumsal lacivert/beyaz/açık gri renkler, okunaklı tablolar ve açıklamalı durum etiketleri kullanılacak. Logo temin edilirse eklenecek.

| Ekran | Ana içerik |
|---|---|
| Genel Bakış | Uygulama gerektiren kararlar, geciken işler, cevap/onay/kontrol bekleyenler, hedef tarihi olmayan işler. |
| Toplantılar ve Karar Paketleri | Toplantı bilgileri, paketler, maddeler, özgün belgeler, doğrulama bilgileri. |
| Kararlar | Tarih, numara, madde, konu, sonuç, kapsam, uygulama özeti; filtre, sıralama, sayfalama ve kayıtlı filtreler. |
| Karar Detayı | Özet, teklif ve özgün metin, sonuç, konumlar, ilgili kararlar, belgeler, yazışmalar ve işlem geçmişi. Uygulama sekmesi yalnızca ilgili kayıtlarda. |
| Konumlar ve Karar Geçmişi | Standart/alternatif/eski adlar, ilçe-mahalle-yol ilişkileri ve kaynak bağlantılı zaman sıralı kararlar. |
| Görevlerim | Atanmış işler, ön koşullar, hedef tarihler, bekleme nedenleri, fotoğraf ve kanıt ekleme. |
| Müdürlükler Arası Takip | Birimlere göre açık işler, beklenen cevaplar, sonraki işlem ve takip tarihi. |
| Yazışmalar | Gelen/giden evraklar, taslak/gönderildi ayrımı, ekler ve cevap bağlantıları. |
| Belge İçe Aktarma | İlk sürümde yükleme ve elle madde ilişkilendirme; ikinci aşamada kaynak ile çıkarılan taslakları yan yana düzenleme. |
| Raporlar | Aylık durum, müdürlük bazlı bekleyen işler, konum geçmişi ve geciken işler; Excel/PDF çıktısı. |
| Kullanıcılar ve Ayarlar | Kullanıcı, rol, birim, ad sözlüğü, iş kategorileri ve erişim kapsamı. |

Mobilde görev güncelleme ve fotoğraf yükleme öncelikli olacak. Boş sonuç, yükleme, hata, yetkisiz erişim ve eşzamanlı düzenleme çakışması için anlaşılır ekranlar hazırlanacak.

## 6. Veri modeli

Ana ilişki: **Toplantı → Karar paketi → Karar maddesi → Alt hükümler → Görevler → Kanıt ve kontrol kayıtları.**

| Kayıt grubu | Tutulacak bilgiler ve ilişkiler |
|---|---|
| Kurum, toplantı, karar paketi | Kararı alan komisyon, toplantı tarihi, üst karar numarası, karar tarihi, gelen evrak, belge doğrulaması. |
| Karar maddesi ve alt hüküm | Madde numarası, üst madde, teklif, özgün metin, özet, sonuç, koşullar, kapsam ve koordinatör. |
| Alıntılanan karar | İlçe komisyonu kimliği, kendi tarih/numarası ve il kararındaki bağlamı; ana il maddesine bağlantı. |
| Konum ve konum adları | İlçe, mahalle, tür, standart/alternatif/eski ad, kesişim, yol kesimi, varsa doğrulanmış koordinat. |
| Karar-konum bağlantısı | Çoklu konum; düzenleme yapılan yer veya gerekçede anılan yer ayrımı. |
| Birimler ve kullanıcı yetkileri | Kullanıcının rolü, birimi, atanmış görev ve kayıt erişim kapsamı. |
| Görev ve bağımlılık | Sorumlu/destek birimleri, personel, öncelik, durum, tarih, ön koşul, bekleme nedeni, sonraki işlem. |
| Yazışma ve bağlantıları | Gelen/giden evrak, tarih/sayı, taraflar, ekler, gönderim kaydı, cevap beklentisi ve cevap ilişkisi; bir yazının birden çok karar/göreve bağlanması. |
| Belge ve sürümleri | Özgün dosya, dosya özeti, kaynak referansları, erişim kapsamı; yeni belge sürümleri ayrı kayıt. |
| Kanıt ve kontrol | Gerçekleşme açıklaması/tarihi, fotoğraf/tutanak/cevap/yetkili kontrol kaydı, kontrol eden, sonuç ve gerekçe. |
| Karar ilişkileri | Değiştirir, kaldırır, tamamlar veya ilgilidir; kaynak ve kullanıcı doğrulaması. |
| İçe aktarma | İşlem durumu, dosya özeti, taslaklar, uyarılar, kontrol eden, onaylanan kayıt bağlantıları. |
| İşlem geçmişi | Kim, ne zaman, hangi kaydı değiştirdi; önceki ve yeni değerler. |

Her kaydın bağımsız teknik kimliği olacak. Karar numarası tek başına kimlik olmayacak; kurum, paket ve hiyerarşi korunacak. Gerçek belge numarası çelişkilerinde taslaklar saklanacak, kullanıcı çözümü beklenecek. Benzersizlik ve mükerrerlik kuralları alıntı/alt madde bağlamını dikkate alacak.

## 7. Yetki matrisi

| Rol | Okuma kapsamı | Kayıt/görev/yazışma | Tamamlanma onayı | Kullanıcı ve ayarlar |
|---|---|---|---|---|
| Sistem yöneticisi | Tanımlı kurum kapsamı | Ek operasyon rolü varsa | Ek kontrol rolü varsa | Yönetir |
| Ulaşım koordinatörü | Müdürlüğün takip kapsamı | Oluşturur, düzenler, atar | Ek kontrol rolü varsa | İş sözlükleri; kullanıcı rolü değiştiremez |
| Birim personeli | Yetkili/atanmış görevler ve gerekli karar bağlamı | Yetkili görev güncelleme, kanıt ve ilişkili yazışma | Yok | Yok |
| Kontrol/onay yetkilisi | Kendisine tanımlı kontrol kapsamı | Kontrol kaydı ve geri gönderme | Var | Yok |
| Görüntüleyici | Kendisine tanımlı kayıtlar | Yok | Yok | Yok |

Diğer müdürlükler için kullanıcı açılması zorunlu olmayacak. Koordinatör, dış birim yazışmalarını sistemde kaydedebilecek. Kullanıcı kendi rolünü/birimini değiştiremeyecek. Önerilen kontrol kuralı, işi gerçekleştiren kişinin kendi tamamlanmasını onaylayamamasıdır.

## 8. Arama ve konum geçmişi

- Başlık, özgün metin, özet, konum adları, karar numarası ve evrak sayısı birlikte aranacak.
- “FSM Bulvarı” ile “Fatih Sultan Mehmet Bulvarı” bağlantısı yönetilebilir ad sözlüğünden gelecek.
- Türkçe büyük/küçük harf ve karaktersiz yazım desteklenecek; benzer sonuçlar kesin eşleşmelerden sonra, ayrı etiketle gösterilecek.
- Aynı isimli farklı ilçelerdeki yollar ayrı kalacak. Yalnızca benzer yazımdan dolayı konumlar birleştirilmeyecek.
- Sonuçlarda eşleşen metin ve özgün belge bağlantısı gösterilecek. PDF'de gerçek sayfa, DOCX'te paragraf/tablo referansı kullanılacak.
- Ret kararları geçmişte kalacak. Yeni tarihli karar eskisini otomatik hükümsüz kılmayacak.

## 9. Uygulama, yazışma ve rapor kuralları

Görev durumları: Planlanmadı, Planlandı, İşlemde, Yazışma/Cevap Bekleniyor, Dış Kurum Onayı Bekleniyor, Engel Nedeniyle Bekliyor, Kontrol Bekliyor, Tamamlandı, Gerekçeyle İptal Edildi.

Kararın uygulama özeti manuel seçilmeyecek. Değerlendirme tamamlanmadıysa “Değerlendirme bekliyor” gösterilecek. Kapsam belirlendikten sonra:

- Uygulama yükümlülüğü yoksa: Uygulama gerektirmiyor.
- İşler başlamadıysa: Hiç başlamamış.
- Bir bölümü yürütülüyor, tamamlanan yoksa: Devam ediyor.
- Bazı zorunlu işler tamamlandı, diğerleri açık ise: Kısmen tamamlanmış.
- Kalan zorunlu işler yalnızca kontrol aşamasındaysa: Kontrol bekliyor.
- Tüm zorunlu yükümlülükler yetkili kontrolünden geçtiyse: Tamamlanmış.

İptal edilen iş tamamlanmış sayılmayacak. Yetkili, yükümlülüğün kaldırıldığını veya yerine başka iş açıldığını gerekçesiyle değerlendirecek. Yeni zorunlu görev eklenince genel durum yeniden hesaplanacak.

Resmî süre, kurum içi hedef tarih ve gerçekleşme tarihi ayrı tutulacak. Tarihi olmayan iş gecikmiş sayılmayacak. Yazı hazırlanması ile gönderilmesi ayrılacak; gönderim kaydı olmadan gönderilmiş kabul edilmeyecek. İlk sürümde EBYS gönderimi yerine kullanıcı tarafından evrak kaydı yapılacak.

Karar ve görev sayıları ayrı raporlanacak. Tamamlanma oranı = tamamlanan uygulama gerektiren karar / takip kapsamındaki uygulama gerektiren karar. Ret, bilgi amaçlı ve uygulama gerektirmeyen kayıtlar paydaya alınmayacak. Gecikme hesabı açık görevlerin hedef bitişine göre yapılacak. Her raporda tarih filtresinin karar tarihine mi, hedef bitişe mi uygulandığı açık olacak; çıktı üretim tarihi, filtreler ve karar referansları bulunacak.

## 10. Teknik yapı ve veri güvenliği planı

- Türkçe, masaüstü ve mobil uyumlu web arayüzü; teknoloji ve sürümler uygulama başlangıcında mevcut proje durumuna göre kesinleştirilecek.
- Supabase PostgreSQL: kalıcı ilişkisel veriler; Supabase Auth: kullanıcı girişi; özel Supabase Storage alanları: belge ve fotoğraflar.
- Verilen proje adresi ortam değişkeninde tutulacak: `https://fhbrazpnbmgyfpqmfjej.supabase.co`.
- Bu plan aşamasında canlı projeye bağlantı kurulmadı ve şema değiştirilmedi. Uygulamaya geçerken erişim, uygun publishable anahtar ve mevcut şema incelenecek. Erişim yoksa çalıştırılabilir kurulum/migration dosyaları hazırlanacak.
- API'ye açık tablolar, bağlantılar, arama, raporlar ve dosya erişimleri aynı rol ve kayıt kapsamını koruyacak. RLS ile veritabanı seviyesinde erişim sınırlandırılacak; arayüzde düğme gizlemek yeterli olmayacak.
- Gizli/service_role anahtarları tarayıcıya konulmayacak. Dosya bağlantıları yalnızca yetkili erişimle veya süreli bağlantıyla açılacak.
- İşlem geçmişi sunucu/veritabanı tarafında üretilecek; normal kullanıcılar değiştiremeyecek veya silemeyecek. Özgün dosyaların üzerine yazılmayacak.
- Eşzamanlı düzenlemelerde sürüm kontrolüyle çakışma gösterilecek. Kritik durum değişiklikleri ilişkili kayıtlarla birlikte tek işlem olarak uygulanacak.
- Tarih alanları saat içermeden; olay zamanları saat dilimi bilgisiyle saklanacak. Gösterim Türkiye biçiminde ve Europe/Istanbul olacak.
- Sunucu tarafında arama/sayfalama, uygun indeksler, dosya türü/boyutu kontrolleri ve hata durumunda yeniden deneme tasarlanacak.
- Canlı kullanım öncesinde yedekleme ve geri yükleme yöntemi doğrulanacak. Demo kayıtları gerçek verilerden ayrı tutulacak.

## 11. Aşamalı geliştirme ve teslim

### Aşama 1 — Çalışan temel sürüm

1. Veri modeli, iş kuralları, yetki kapsamı ve Supabase mevcut şema incelemesi.
2. Giriş, kullanıcı/birim yetkileri, özel belge saklama ve işlem geçmişi.
3. Paket/madde/alt hüküm için manuel kayıt, PDF/DOCX yükleme ve kaynak ilişkilendirme; kabul/ret davranışı.
4. Konum sözlüğü, arama ve karar geçmişi.
5. Görevler, bağımlılıklar, müdürlükler arası takip ve yazışmalar.
6. Kanıtla tamamlanma, yetkili kontrolü ve genel durum hesapları.
7. Genel bakış, temel raporlar, Excel/PDF dışa aktarma, mobil kullanım.
8. Kabul senaryolarının doğrulanması ve pilot kullanım.

İlk sürümde belge yükleme ve elle kayıt tam çalışacak. Başlangıç isteğindeki metin çıkarma ile aşamalı teslim maddesi arasındaki kapsam farkı şu şekilde çözülmüştür: otomatik metin çıkarma ve madde ayrıştırma ikinci aşamaya alınmıştır; manuel kaynak referansı ilk sürümdedir.

### Aşama 2 — Kontrollü belge çıkarımı

- DOCX ve metin tabanlı PDF'den metin çıkarma; taranmış PDF için ayrı OCR işlemi.
- Kaynak ve önerilen kayıtları yan yana gösterme; bölme/birleştirme, alıntı/alt madde düzeltme.
- İnsan onaylı taslak → esas kayıt geçişi; eksik tarih, çelişkili numara ve bulunamayan ek uyarıları.
- Dosya özeti ve işlem kimliğiyle güvenli yeniden deneme; aynı kaydı tekrar üretmeme.
- OCR/yapay zekâ servisi yoksa açık durum mesajı ve manuel devam. Belge metni komut olarak çalıştırılmayacak.

### Aşama 3 — Gelişmiş takip

Gelişmiş hatırlatmalar ve yalnızca doğrulanmış koordinatlarla harita. EBYS bağlantısı ayrıca talep ve erişim sağlanırsa bağımsız entegrasyon olarak ele alınacak.

Geliştirme teslimatı: kaynak kodu, migration ve RLS dosyaları, ortam değişkeni örneği, kurulum/kullanım açıklaması, test sonuçları ve eksik entegrasyon listesi. Takvim tahmini, mevcut proje ve erişimler incelendikten sonra çıkarılacak.

## 12. Kabul ve doğrulama planı

Bu liste planlanan testlerdir; uygulama henüz geliştirilmediğinden çalıştırılmış test sonucu değildir.

1. Aynı paket içindeki ayrı maddeler ve aynı numaralı alt maddeler doğru bağlamda saklanır.
2. Alıntılanan ilçe kararları ana il maddeleriyle karışmaz; çelişen iki 52 numaralı madde sessizce birleşmez.
3. Aynı dosyayı tekrar yüklemek veya çıkarımı yeniden denemek mükerrer esas kayıt üretmez.
4. FSM alternatif adı doğru bulvarı getirir; farklı ilçelerdeki aynı adlı yollar ayrı kalır.
5. Ret kararı uygulama alanları doldurulmadan kaydedilir; yeniden açıldığında da bu alanlar istenmez.
6. Ret kaydına doğrudan API ile uygulama görevi ekleme engellenir; ret kayıtları geciken iş ve tamamlanma hesabına girmez.
7. Karma sonuçlu maddede yalnızca kabul edilen alt hükümler izlenir.
8. Dış onay gelmeden ilgili saha işi başlayamaz; onay yazışması takip edilebilir.
9. Fen İşlerine yazı göndermek kararı tamamlamaz; taslak yazı gönderilmiş sayılmaz.
10. Zorunlu işlerden biri tamamlandığında karar kısmen tamamlanmış görünür; tümü kontrol edildiğinde tamamlanır.
11. Kanıt, gerçekleşme tarihi/açıklaması ve yetkili kontrol olmadan tamamlama gerçekleşmez.
12. Tarihi olmayan işler gecikmiş sayılmaz; iptal edilen görevler tamamlanmış kabul edilmez.
13. Yeni zorunlu görev eklenince genel durum güncellenir; sonradan ret düzeltmesinde geçmiş korunur.
14. Yetkisiz kullanıcı API, arama, rapor ve dosya bağlantısıyla yetki dışındaki kayda erişemez; kendi rolünü değiştiremez.
15. Oturum kapanıp açıldığında veriler korunur; eşzamanlı değişiklikler sessizce birbirini ezmez.
16. Arama sonucu özgün belge bölümüne izlenebilir; kaldırılan/değiştirilen kararların geçmişi korunur.
17. Excel/PDF raporları filtreleri, üretim tarihini ve karar referanslarını içerir; rapor toplamları listelerle tutarlıdır.

## 13. Geliştirmeye geçerken netleştirilecek kurum bilgileri

Bu bilgiler planın hazırlanmasını engellemez: başlangıç kullanıcıları ve birimleri, kontrol yetkilileri, resmî logo, erişim kapsamları, varsa mevcut veri/EBYS bilgileri ve Supabase proje erişimi. Hiçbiri için tahminî kullanıcı, resmî evrak veya tamamlanma kaydı oluşturulmayacak.
