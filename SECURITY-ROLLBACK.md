# 24 Eylül 2026 güvenlik düzeltmeleri ve geri dönüş

Bu değişikliklerden önceki kod `codex/pre-security-hardening-20260924` dalında,
`8f921c49b8f4efb8937e74f696dbe79dc83cef38` commit'inde korunur. Bu dalı
herkese açık GitHub deposuna göndermeyin: eski karar belgesi geçmişte bulunur.

Canlı `komisyon` Supabase projesine uygulanan migration'lar:

- `harden_authorization_and_assignments` (`20260924083843`)
- `revoke_anonymous_legacy_task_rpc` (`20260924084131`)
- `restrict_direct_staff_task_insert` (`20260924084247`)

Bu migration'lar mevcut karar, görev, yazışma veya kullanıcı satırlarını silmez
ya da topluca değiştirmez. Geri alma gerekirse önce
[`supabase/rollback/20260924083843_harden_authorization_and_assignments.sql`](supabase/rollback/20260924083843_harden_authorization_and_assignments.sql)
dosyasını veritabanı yöneticisi olarak tek sefer çalıştırın. Bu, eski RLS
politikalarını ve fonksiyonları geri getirir; eski anonim RPC yetkisini güvenlik
nedeniyle geri vermez. Ardından uygulama kodunu yukarıdaki dala döndürebilirsiniz.
Veritabanı geri alma işlemi, güvenlik düzeltmesinden sonra oluşturulmuş veri
satırlarını silmez. Canlıda daha sonra yapılan başka şema değişiklikleri varsa
geri alma SQL'ini önce onlarla karşılaştırın.

`2026 İL TRF. KOMİSYON KARARLARI.docx` ve `belge-inceleme.txt` yerel diskte
korunur fakat yeni Git commit'lerinde izlenmez. Önceki Git commit'lerinde ve
uzak dallarda bulunan kopyalar ayrıca geçmiş temizliği gerektirir. Geri dönüş
dalı bu eski geçmişi yerel olarak korur; onu herkese açık uzak depoya göndermek
belgeleri yeniden yayımlar.

Canlı Supabase Auth `disable_signup` ayarı bu migration'ların parçası değildir.
Kayıt ayarı değiştirilirse geri almak için Dashboard'da aynı ayarı eski değerine
getirmek gerekir. Yerel `config.toml` dosyasını doğrudan `config push` ile canlıya
göndermeyin: başka Auth ayarlarını da değiştirebilir.
