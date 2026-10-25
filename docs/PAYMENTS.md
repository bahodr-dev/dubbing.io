# Payme va Click sozlash

## Hozirgi oqim

- Foydalanuvchi tarif yoki daqiqa paketini tanlaydi. Narx va beriladigan daqiqalar serverda hisoblanadi.
- `/api/payments/checkout` buyurtma yaratadi va tanlangan provayderga havola beradi.
- Provayder tasdiqlagan callback buyurtma, tranzaksiya va daqiqa balansini bitta SQLite tranzaksiyasida yangilaydi. Takroriy callback daqiqalarni qayta qo‘shmaydi.
- To‘lov oynasi buyurtma holatini har 5 soniyada serverdan tekshiradi. Provayderdan qaytish URL’i to‘lov muvaffaqiyatli bo‘lganining dalili emas.
- Haqiqiy rekvizitlari kiritilmagan provayder ishlamaydi; namunaviy merchant havolalari berilmaydi. Uzum hozir ulanmagan.

## Kerakli rekvizitlar

Payme Business va Click merchant hisoblari ochilganini ularning kabinetidan tekshiring. Koddagi yoki `.env`dagi ID mavjudligi shartnoma yoki faol merchant hisobi borligini tasdiqlamaydi.

Maxfiy qiymatlarni faqat serverdagi `.env` yoki deploy muhitiga kiriting. Chatga va Git’ga yubormang.

Payme:

- `PAYME_MERCHANT_ID`: kassa ID.
- `PAYME_SECRET_KEY`: asosiy Merchant API kaliti.
- `PAYME_TEST_SECRET_KEY`: sandbox kaliti, agar alohida berilgan bo‘lsa.
- `PAYME_TEST_MODE=true`: mahalliy/sandbox sinov uchun. Production’da `false` bo‘lishi shart.
- Hisob maydoni: `order_id` (checkout `ac.order_id` yuboradi).

Click:

- `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`.
- `CLICK_TEST_MODE`: deploy konfiguratsiyasida production uchun `false`. Ushbu flag alohida sandbox yaratmaydi; sinov rejimi va test rekvizitlarini Click bilan kelishish kerak.

`APP_URL` foydalanuvchi interfeysining HTTPS domeni bo‘lishi kerak. Checkout qaytish manzili shu origin bilan cheklanadi.

## Merchant kabinetida ko‘rsatiladigan manzillar

`https://dubla.uz` o‘rniga amaldagi domeningizni yozing:

| Xizmat | Callback URL |
| --- | --- |
| Payme Merchant API | `https://dubla.uz/api/payments/payme` |
| Click Prepare | `https://dubla.uz/api/payments/click/prepare` |
| Click Complete | `https://dubla.uz/api/payments/click/complete` |

Payme HTTP Basic foydalanuvchisi — `Paycom`. Click callbacklari POST forma (`application/x-www-form-urlencoded`) va imzo bilan keladi. Reverse proxy Authorization sarlavhasini va callback tanasini serverga yetkazishi kerak.

Click Prepare yangi tranzaksiyalar uchun doimiy raqamli `merchant_prepare_id` beradi; Complete aynan shu ID, Click tranzaksiya ID va buyurtmaga mos bo‘lishi kerak. Eski, allaqachon boshlangan tranzaksiyalar oldingi identifikatori bilan davom eta oladi.

## Mahalliy tekshiruv

```bash
npx vitest run server/__tests__/payments.test.js server/__tests__/paymentSafety.test.js src/__tests__/CheckoutModal.test.tsx
npm run build
```

Testlar alohida vaqtinchalik bazada ishlaydi, real provayderga pul yubormaydi. Qamrov: ikki provayderning muvaffaqiyatli oqimi, takroriy callbacklar, noto‘g‘ri summa va imzo, Prepare/Complete mosligi, bekor qilish va kredit yozishda xato bo‘lsa barcha holatlarning rollback qilinishi.

Payme refund qilingan daqiqalarni faqat bir marta qaytaradi. Agar hisobdagi qolgan daqiqalar xaridga tegishli daqiqalardan kam bo‘lsa, avtomatik bekor qilish `-31007` bilan rad etiladi. Click’da muvaffaqiyatli Complete’dan keyin kelgan xato callback to‘lovni bekor qilmaydi; haqiqiy refund alohida merchant jarayonidir va bu o‘zgarishda Click refund API ulanmagan.

## Provayder bilan yakuniy sinov

1. HTTPS callback URL’larini merchant kabinetlarida ro‘yxatdan o‘tkazing.
2. Payme sandbox tekshiruvlarini, jumladan takroriy Create/Perform/Cancel va timeout holatlarini bajaring.
3. Click test rekvizitlari bilan Prepare → Complete oqimini tekshiring.
4. To‘lovdan oldingi va keyingi balansni solishtiring; takroriy callback qo‘shimcha daqiqa bermasligini tekshiring.
5. Bekor qilingan to‘lov va kechikkan callback holatini tekshiring.
6. Real pul bilan yakuniy kichik xarid faqat merchant sozlamalari va foydalanuvchi roziligi tayyor bo‘lganda bajariladi.

Rasmiy manbalar:

- [Payme CreateTransaction](https://developer.help.paycom.uz/metody-merchant-api/createtransaction/)
- [Payme PerformTransaction](https://developer.help.paycom.uz/metody-merchant-api/performtransaction/)
- [Payme CancelTransaction](https://developer.help.paycom.uz/metody-merchant-api/canceltransaction/)
- [Click hujjatlari](https://docs.click.uz/)
