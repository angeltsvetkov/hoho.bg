import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика за бисквитки | HoHo.bg",
  description: "Как използваме бисквитки и подобни технологии на HoHo.bg",
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-linear-to-b from-[#fff0f8] via-[#ffe8f5] to-[#ffd7ec] px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-lg font-bold text-[#d91f63] transition hover:text-[#ff5a9d]"
          >
            ← Назад към начало
          </Link>
        </div>

        <div className="rounded-4xl border-4 border-white bg-white p-8 shadow-[0_30px_90px_-30px_rgba(178,24,77,0.4)] md:p-12">
          <h1 className="mb-8 text-4xl font-black text-[#d91f63] md:text-5xl">
            Политика за бисквитки
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-sm text-[#d91f63]/60">Последна актуализация: 16/11/2025</p>
            
            <p className="my-6 text-lg font-bold text-[#d91f63]">
              Настоящата Политика за бисквитки обяснява как уебсайтът hoho.bg (наричан по-долу &bdquo;Уебсайтът&ldquo;) използва бисквитки и подобни технологии.
            </p>

            <p className="my-6 font-bold text-[#d91f63]">
              Политиката е част от Общите условия и Политиката за поверителност на Viply, ЕИК 208028879.
            </p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">1. Какво представляват бисквитките?</h2>
            
            <p className="mb-3">Бисквитките са малки текстови файлове, които се съхраняват във Вашето устройство (компютър, телефон, таблет), когато посещавате уебсайт. Те помагат за правилното функциониране на сайта и за подобряване на потребителското изживяване.</p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">2. Какви бисквитки използваме?</h2>
            
            <p className="mb-3">Нашият уебсайт използва минимално необходимите бисквитки, които попадат в следните категории:</p>

            <h3 className="mb-3 mt-6 text-xl font-bold text-[#d91f63]">2.1. Строго необходими (технически) бисквитки – ЗАДЪЛЖИТЕЛНИ</h3>
            
            <p className="mb-3">Тези бисквитки са нужни за работата на сайта и не могат да бъдат изключени.</p>
            
            <p className="mb-3">Използват се за:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>работа на системата за плащания</li>
              <li>управление на &bdquo;unlock&ldquo; състояние след плащане</li>
              <li>предотвратяване на злоупотреби и бот атаки</li>
            </ul>
            
            <p className="mb-3">Тези бисквитки не събират лични данни извън необходимото за функциониране.</p>

            <h3 className="mb-3 mt-6 text-xl font-bold text-[#d91f63]">2.2. Функционални бисквитки</h3>
            
            <p className="mb-3">Използваме функционални механизми като:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>localStorage</li>
              <li>sessionStorage</li>
            </ul>
            
            <p className="mb-3">Те не събират лични данни и не се използват за проследяване.</p>
            
            <p className="mb-3">Използват се за:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>запомняне на въведения текст временно</li>
              <li>съхранение на кодове/кредити (ако потребителят купи пакет)</li>
              <li>UX удобства като &bdquo;възпроизвеждане след плащане&ldquo;</li>
            </ul>

            <h3 className="mb-3 mt-6 text-xl font-bold text-[#d91f63]">2.3. Аналитични бисквитки (Използват се само ако потребителят даде съгласие)</h3>
            
            <p className="mb-3">Ако активираме Google Analytics или друга аналитика, това ще се случва само след изрично съгласие от потребителя чрез банер.</p>
            
            <p className="mb-3 font-bold text-[#d91f63]">Ако не дадете съгласие → АНАЛИТИКА НЕ СЕ ЗАРЕЖДА.</p>

            <h3 className="mb-3 mt-6 text-xl font-bold text-[#d91f63]">2.4. Маркетингови бисквитки — НЕ СЕ ИЗПОЛЗВАТ</h3>
            
            <p className="mb-3">Нашият сайт не използва:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>рекламни бисквитки</li>
              <li>trackers</li>
              <li>пиксели за ремаркетинг</li>
              <li>профилиране</li>
            </ul>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">3. Колко дълго се съхраняват бисквитките?</h2>
            
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>Технически бисквитки → до края на сесията или до 30 дни</li>
              <li>localStorage → докато потребителят не го изтрие</li>
              <li>Аналитични cookies → според политиката на доставчика (само при съгласие)</li>
            </ul>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">4. Как можете да управлявате бисквитките?</h2>
            
            <p className="mb-3">Можете да:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>блокирате бисквитки през настройките на браузъра</li>
              <li>изтривате съществуващи бисквитки</li>
              <li>отказвате аналитични cookies (ако съществуват)</li>
            </ul>
            
            <p className="mb-3 font-bold text-[#d91f63]">Изключването на технически бисквитки може да доведе до неправилна работа на сайта.</p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">5. Бисквитки от трети страни</h2>
            
            <p className="mb-3">Възможно е да използваме услуги на трети страни, като:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>платежни оператори (myPOS / Stripe / Revolut / ePay)</li>
              <li>CDN услуги</li>
              <li>AI доставчик (ако страницата зарежда ресурси от външни домейни)</li>
            </ul>
            
            <p className="mb-3">Те могат да поставят свои технически бисквитки, които са необходими за тяхната услуга.</p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">6. Промени в Политиката</h2>
            
            <p className="mb-3">При промени в технологията или законодателството, Политиката може да бъде актуализирана. Актуалната версия винаги е достъпна на уебсайта.</p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">7. Контакти</h2>
            
            <p className="mb-3">Ако имате въпроси относно бисквитките или защитата на данните, свържете се с нас:</p>
            
            <p className="mb-1"><strong className="text-[#d91f63]">Viply</strong></p>
            <p className="mb-1">ЕИК: 208028879</p>
            <p className="mb-1">Email: <a href="mailto:angel@viply.org" className="text-[#ff5a9d] hover:underline">angel@viply.org</a></p>
            <p className="mb-3">Адрес: гр. София, кв. Витоша, бл. 5Б</p>
          </div>
        </div>
      </div>
    </main>
  );
}
