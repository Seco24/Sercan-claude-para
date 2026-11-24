# Para Defteri

Kişisel gelir, gider ve yatırım takip uygulaması. Ana para, aylık harcamalar (aylık borç),
para piyasası fonu (PPF) ve ABD borsası tek ekranda; tüm veriler tarayıcınızda kalıcı olarak saklanır.
Sunucu, hesap veya veritabanı kurulumu gerekmez.

- **Özet:** Ana para, güncel net varlık, bu ayın harcaması, yatırımdaki toplam ve kalan likidite.
  "Hesap dökümü" her rakamın nasıl hesaplandığını satır satır gösterir.
- **Harcamalar:** Tutar, kategori, açıklama ve tarih girilir. Ay bazında toplam, kategori dağılımı,
  son 12 ay grafiği ve tüm ayların listesi görünür. Harcama silinir ya da düzenlenirse bakiyeler kendiliğinden düzelir.
- **Para piyasası fonu:** Aylık %2,45 (değiştirilebilir) getiri günlüğe bölünür ve bakiye her gün artar.
  Basit (her gün eşit tutar) ya da günlük bileşik hesap seçilebilir. Oran değiştiğinde o güne kadarki getiri korunur.
- **ABD borsası:** Hisse ekleme (adet ve maliyet ya da tutar ve alış fiyatı), canlı fiyat, günlük değişim,
  kâr/zarar, USD ve TL karşılığı. API çalışmazsa son bilinen fiyat gösterilir, istenirse fiyat elle girilir.
- Aydınlık/karanlık tema (sistemi izler), mobil uyumlu, ana ekrana eklenebilir. JSON yedek indirme ve geri yükleme.

## Çalıştırma

Gereksinim: [Node.js](https://nodejs.org) 20 veya üstü.

```bash
npm install
npm run dev        # http://localhost:5173 adresinde açılır
```

Telefonda aynı ağdan denemek için: `npm run dev -- --host`, ardından terminalde görünen ağ adresini açın.

### Tek dosya olarak kullanma

```bash
npm run build
```

`dist/index.html` tek başına çalışan bir dosyadır: çift tıklayıp tarayıcıda açabilir ya da herhangi
bir statik hostinge (GitHub Pages, Netlify, Cloudflare Pages) yükleyebilirsiniz.

GitHub Pages için hazır iş akışı `.github/workflows/deploy.yml` içinde; ayrıntılar aşağıda, "Telefona yükleme" bölümünde.

> Veriler tarayıcıya ve adrese özeldir. `localhost` ile GitHub Pages adresindeki veriler ayrı tutulur;
> taşımak için **Ayarlar → Yedeği indir / Yedekten geri yükle** kullanın.

## Telefona yükleme

Uygulama bir web uygulamasıdır (PWA): bir adreste yayınlanır, telefonda o adres açılıp ana ekrana eklenir.
Ana ekrandan açıldığında tarayıcı çubukları olmadan tam ekran çalışır, internet yokken de açılır.

**1. Yayınlayın** (bir kez):

- **GitHub Pages:** Repo herkese açıksa ya da GitHub Pro kullanıyorsanız **Settings → Pages → Source: GitHub Actions**
  seçin, ardından **Actions → Deploy to GitHub Pages → Run workflow**. Adres: `https://<kullanıcı>.github.io/<repo>/`.
  Repoyu herkese açık yapmak yalnızca kodu açar; verileriniz ve API anahtarınız repoda değil, telefonunuzda durur.
- **Repo özel kalsın:** [Netlify](https://app.netlify.com) veya [Cloudflare Pages](https://pages.cloudflare.com)'e
  GitHub ile giriş yapın, bu repoyu seçin. Build komutu `npm run build`, yayın klasörü `dist`.

**2. Telefona ekleyin:**

- **iPhone (Safari):** Adresi açın → Paylaş düğmesi → **Ana Ekrana Ekle**.
- **Android (Chrome):** Adresi açın → sağ üstteki ⋮ menü → **Uygulamayı yükle** (veya **Ana ekrana ekle**).

Sonra **Ayarlar**'dan Finnhub anahtarınızı bir kez girin.

> Veriler her cihazın kendi tarayıcısında saklanır. Bilgisayardaki kayıtları telefona taşımak için
> bilgisayarda **Ayarlar → Yedeği indir**, telefonda **Yedekten geri yükle**. iPhone'da uygulamayı
> Safari sekmesinden değil ana ekran simgesinden kullanın; Safari uzun süre açılmayan sitelerin verisini silebilir.
> Ara sıra yedek almanız önerilir.

### Testler

```bash
npm test           # hesaplama mantığı birim testleri (vitest)
npm run typecheck
```

## Canlı hisse fiyatı (API bağlama)

1. Bir sağlayıcıdan ücretsiz anahtar alın:

   | Sağlayıcı | Ücretsiz limit | Not |
   |---|---|---|
   | [Finnhub](https://finnhub.io/register) (önerilen) | 60 istek/dakika | ABD hisseleri anlık |
   | [Twelve Data](https://twelvedata.com/pricing) | 8 sembol/dakika, 800/gün | 8'den fazla hissede her yenilemede en eski fiyatlar sırayla güncellenir |
   | [Alpha Vantage](https://www.alphavantage.co/support/#api-key) | 25 istek/gün | Az sayıda hisse için |

2. Uygulamada **Ayarlar → Hisse fiyat verisi** bölümünden sağlayıcıyı seçin, anahtarı yapıştırın,
   **Kaydet ve bağlantıyı dene**'ye basın. Başarılıysa AAPL fiyatı gösterilir.
3. **Otomatik yenileme** süresini seçin (uygulama açık ve ekrandayken çalışır) ya da
   Yatırımlar → ABD borsası'nda **Fiyatları yenile**'ye basın.

Hata durumları:

- İstek limiti, ağ hatası veya geçersiz anahtarda mevcut fiyatlar silinmez; son bilinen fiyat ve zamanı gösterilir, ekranda uyarı çıkar.
- Hiç fiyat alınamamış hissede değer hesabı için maliyet fiyatı kullanılır ve "fiyat yok" olarak işaretlenir.
- Fiyata dokunarak elle fiyat girebilirsiniz. Sağlayıcıyı **Elle** yaparsanız hiç API kullanılmaz.

API anahtarı yalnızca bu tarayıcının yerel deposunda tutulur ve yedek dosyasına yazılmaz.

**USD/TRY kuru** anahtarsız alınır: önce [Frankfurter](https://frankfurter.dev) (ECB), olmazsa
[ExchangeRate-API](https://www.exchangerate-api.com/docs/free). İstenirse kur elle girilir.

## Hesaplama mantığı

Hiçbir bakiye ayrıca saklanmaz; hepsi kayıtlardan her seferinde yeniden hesaplanır
(`src/domain/ledger.ts`). Bu sayede bir kayıt düzenlendiğinde ya da silindiğinde tüm rakamlar tutarlı kalır.

```
Nakit (likidite) = Başlangıç + Eklemeler − Çekimler − Tüm harcamalar + Kapanan yatırımlardan dönen
                   − Nakitten yatırıma aktarılan
Ana para         = Nakit + PPF'in bugünkü bakiyesi + ABD hisselerinin bugünkü TL değeri
Aylık borç       = Seçilen ayın harcamaları toplamı
```

Ana para anlık değişir: PPF her gün getirisi kadar artar, hisselerin fiyatı veya kur değiştikçe
ana para da aynı anda artar ya da azalır. Özet ekranında bugünkü değişim ayrıca gösterilir.

- **Yatırımlardaki para nereden geldi?** (Özet → Hesap dökümü): Yatırımlara koyduğunuz para başlangıç
  ana paranızın içindeyse **Başlangıç ana paramın içinden** seçin, tutar nakitten düşülür. Ayrıca
  var olan paraysa **Ayrıca vardı** seçin. Doğru seçim, "Nakit" satırının gerçek nakdinizle aynı çıkmasıdır;
  yanlış seçim parayı iki kez sayar ya da eksik gösterir. Aynı ayar her yatırımın düzenleme ekranında da var.
- Hisse için nakitten düşülen tutar `adet × maliyet × alış kuru` ile hesaplanır.
- **Bozdur / Sat** pozisyonu kapatır, dönen tutarı ana paraya ekler ve gerçekleşen kâr/zararı "Kapanan yatırımlar" listesine yazar.

**PPF günlük getiri** (`src/domain/ppf.ts`), aylık oran `r`, ay gün sayısı `D` (30 ya da 365/12):

- Basit: `bakiye = anapara × (1 + r × gün / D)`. Her gün `anapara × r / D` kadar artar.
  Örnek: 100.000 ₺ için %2,45 → günde 81,67 ₺, 30 günde 102.450 ₺.
- Bileşik: `bakiye = anapara × (1 + r)^(gün / D)`. Günlük oran `(1 + r)^(1/D) − 1`.

## Proje yapısı

```
src/
  domain/      Saf iş mantığı: tipler, tarih, para biçimi, PPF, hisse, harcama, defter (+ testler)
  services/    Dış dünya: localStorage kalıcılığı, fiyat sağlayıcıları (quotes/), döviz kuru
  state/       Uygulama durumu (reducer + context) ve piyasa verisi yenileme
  components/  Ortak arayüz parçaları: form alanları, pencere, grafikler
  features/    Ekranlar: dashboard, expenses, investments, settings
  styles/      Tema belirteçleri ve stiller (aydınlık/karanlık)
```

Yeni bir fiyat sağlayıcısı eklemek için `src/services/quotes/types.ts` içindeki `QuoteProvider`
arayüzünü uygulayan bir dosya yazıp `src/services/quotes/index.ts` dosyasına eklemek yeterlidir.
