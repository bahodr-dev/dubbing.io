# dubla.uz — rivojlanish rejasi

## Maqsad

Foydalanuvchi inglizcha videoni yuklaydi. Tizim avval tarifida qolgan daqiqalarni va videoning haqiqiy davomiyligini tekshiradi, gapirayotgan odamlarni ajratadi, nutqni o‘zbekchaga tarjima qiladi va har bir odamning o‘z ovoziga o‘xshash ovozda tayyor videoni beradi.

Ishlar quyidagi tartibda bajariladi. Har bir yangi bosqichni boshlashdan oldin bajariladigan ish va uning sababi tushuntiriladi hamda foydalanuvchi tasdig‘i olinadi.

## Hozirgi holat

- Video yuklash, loyiha yaratish, transkripsiya, tarjima, ovoz sintezi va video yig‘ish uchun kod mavjud.
- Odamlarni ajratish, har biri uchun audio namuna olish va alohida ovoz klonini ishlatish oqimi qo‘shilgan.
- “Start dubbing” bosilganda daqiqa balansi oldindan tekshiriladi; video yuklangach server uning haqiqiy davomiyligi bilan balansni solishtiradi. Yakuniy dublyaj ishida daqiqalar atomik band qilinadi va xatoda qaytariladi.
- 2026-10-10 holatida 182 ta avtomatik test o‘tgan va ilova yig‘ilgan.
- Haqiqiy OpenAI va ElevenLabs kalitlari bilan butun jarayon yakuniy videoda hali sinovdan o‘tmagan. Kalitlar va sinov videosi kerak.
- Bir soatlik video uchun audio bo‘laklash va katta hajmdagi qayta ishlashni alohida mustahkamlash zarur. Hozir transkripsiyaga bitta WAV yuboriladi; OpenAI transkripsiya fayli chegarasi 25 MB. [OpenAI qo‘llanmasi](https://developers.openai.com/api/docs/guides/speech-to-text).

## Bosqichlar

| Navbat | Ish | Natija va qabul mezoni |
| --- | --- | --- |
| 1 | 2–5 daqiqalik, ikki odam gapirgan real videoni boshidan oxirigacha sinash | Odamlar to‘g‘ri ajratiladi, o‘zbekcha matn va ikki alohida ovoz hosil bo‘ladi, tayyor video yuklab olinadi. Xatolar va xizmat xarajati qayd etiladi. |
| 2 | Uzun videolarni bo‘laklab qayta ishlash | Transkripsiya bo‘laklari hajm chegarasiga mos; vaqt belgilari va odam identifikatorlari bo‘laklar orasida saqlanadi. Ish uzilsa davom ettirish mumkin. Bir soatlik sinov videosi muvaffaqiyatli yakunlanadi. |
| 3 | Ovoz va tarjima sifatini kuchaytirish | Har bir odam uchun toza namuna tanlanadi; foydalanuvchi ovoz va tarjimani ko‘rib chiqadi. Yetarli yoki sifatli nutq bo‘lmasa aniq xabar oladi. |
| 4 | Tarif, xarajat va operatsion nazorat | Daqiqa hisobi, band qilish va qaytarish real to‘lov holatlari bilan tekshiriladi. API xarajati, ish davomiyligi, xatolar va vaqtinchalik fayllar kuzatiladi. |
| 5 | Kichik foydalanuvchi sinovi va chiqarishga tayyorgarlik | Bir nechta foydalanuvchi yordamsiz video yuklab natijani oladi; topilgan muammolar tuzatiladi; zaxira nusxa, tiklash va xizmat holati tekshiriladi. |

## Birinchi bosqichga kerak bo‘ladigan narsalar

1. `OPENAI_API_KEY` va `ELEVENLABS_API_KEY` serverdagi `.env` faylida sozlanadi. Kalitlar chatga yoki repozitoriyga yozilmaydi.
2. Kamida ikki odam gapirgan, ularning ovozini ishlatishga ruxsat olingan 2–5 daqiqalik video tanlanadi.
3. Sinovdan oldin kutilgan natija yoziladi: odamlar soni, til, taxminiy davomiylik va tayyor video sifati.
4. Haqiqiy provayder chaqiruvlari pulli resurs sarflashi mumkin; sinovda sarf qayd etiladi.

## Muhim sifat mezonlari

- Odam identifikatori video davomida aralashib ketmasligi kerak.
- Ovoz kloni uchun ishlatiladigan namuna toza va bitta odamga tegishli bo‘lishi kerak. ElevenLabs odatda 1–2 daqiqa toza audio tavsiya qiladi; amaldagi 10–30 soniyalik namunalar real sinovda baholanadi. [ElevenLabs qo‘llanmasi](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning).
- Tarjima tabiiy o‘zbekcha eshitilishi va audio segment o‘z vaqtiga sig‘ishi kerak.
- Xatoda foydalanuvchining daqiqalari yo‘qolmasligi, ortiqcha ovoz klonlari va vaqtinchalik fayllar qolmasligi kerak.
- Ekranda video yuklash, transkripsiya, dublyaj va xato holatlari aniq ko‘rinishi kerak.

## Jamoa vazifalari

- **Mahsulot egasi:** ustuvorlik, sinov videosi, sifat mezoni va yakuniy qabul qarorlari.
- **Backend/video mutaxassisi:** uzun video bo‘laklari, ishlar navbati, FFmpeg, saqlash, daqiqa hisobi va tiklash.
- **AI/ovoz mutaxassisi:** odamlarni ajratish, tarjima, audio namuna va klon sifati.
- **Frontend va test ishlari:** foydalanuvchi oqimi, jarayon holati, xato xabarlari va real ssenariylarni tekshirish. Dastlab bu ishlar mavjud jamoa ichida taqsimlanishi mumkin.

Har bir bosqich yakunida natija mezonlarga solishtiriladi. Keyingi bosqich faqat shu natija ko‘rib chiqilgach boshlanadi.
