import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Общи условия | HoHo.bg",
  description: "Общи условия за ползване на уебсайта и закупуване на дигитални продукти",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#fff0f8] via-[#ffe8f5] to-[#ffd7ec] px-6 py-12">
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
            Общи условия
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-sm text-[#d91f63]/60">Последна актуализация: 16/11/2025</p>
            
            <p className="my-6 text-lg font-bold text-[#d91f63]">
              Моля, прочетете внимателно настоящите Общи условия, преди да използвате този уебсайт и да закупите дигитални продукти от него. Използвайки сайта, Вие приемате и се съгласявате с тези условия.
            </p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">1. Дефиниции</h2>
            
            <p className="mb-3"><strong className="text-[#d91f63]">„Търговец" / „Ние"</strong> – BrainEXT, ЕИК: 208028879, със седалище и адрес на управление: гр.София, кв.Витоша, бл.5Б, имейл за контакт: angel@brainext.io.</p>
            
            <p className="mb-3"><strong className="text-[#d91f63]">„Потребител"</strong> – всяко физическо лице, което използва сайта и закупува дигитален продукт.</p>
            
            <p className="mb-3"><strong className="text-[#d91f63]">„Уебсайт"</strong> – уеб страницата hoho.bg.</p>
            
            <p className="mb-3"><strong className="text-[#d91f63]">„Дигитален продукт"</strong> – персонализирано аудио съобщение, генерирано автоматично чрез изкуствен интелект (AI) въз основа на текст, предоставен от Потребителя.</p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">2. Предмет на услугата</h2>
            
            <p className="mb-3">Сайтът предоставя възможност за закупуване на персонализирани, незабавно генерирани аудио съобщения, в това число, но не само:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>персонализирани поздрави от „Дядо Коледа";</li>
              <li>аудио съобщения по текст, въведен от потребителя;</li>
              <li>пакети от няколко аудио съобщения;</li>
              <li>други дигитални продукти.</li>
            </ul>
            
            <p className="mb-3">Дигиталните продукти се доставят автоматично след успешно плащане.</p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">3. Характер на продукта</h2>
            
            <p className="mb-3"><strong>3.1.</strong> Аудио файловете се генерират автоматично чрез технология за синтез на реч (Text-to-Speech), базирана на изкуствен интелект.</p>
            
            <p className="mb-3"><strong>3.2.</strong> Потребителят носи пълна отговорност за съдържанието на въведения текст. Търговецът не носи отговорност за:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>правописни грешки;</li>
              <li>неподходящо съдържание;</li>
              <li>юридически последици от текст, предоставен от потребителя.</li>
            </ul>
            
            <p className="mb-3"><strong>3.3.</strong> Поради автоматизирания характер на услугата:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>тонът, интонацията и резултатът може да варират минимално;</li>
              <li>потребителят приема, че е възможно малко отклонение от очаквания резултат.</li>
            </ul>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">4. Поръчка и плащане</h2>
            
            <p className="mb-3"><strong>4.1.</strong> Потребителят не е длъжен да се регистрира в сайта.</p>
            
            <p className="mb-3"><strong>4.2.</strong> Поръчка се извършва чрез:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>въвеждане на персонализиран текст;</li>
              <li>избор на единичен продукт или пакет;</li>
              <li>натискане на бутон за плащане;</li>
              <li>заплащане чрез поддържания платежен оператор.</li>
            </ul>
            
            <p className="mb-3"><strong>4.3.</strong> Поддържани методи за плащане: myPOS (в зависимост от наличните към момента методи)</p>
            
            <p className="mb-3"><strong>4.4.</strong> След успешно плащане потребителят се пренасочва към страница за получаване на дигиталния продукт.</p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">5. Цена</h2>
            
            <p className="mb-3"><strong>5.1.</strong> Всички цени са посочени в български лева (BGN) и включват всички приложими данъци.</p>
            
            <p className="mb-3"><strong>5.2.</strong> Търговецът има право да променя цените по всяко време, като промените не засягат вече извършени плащания.</p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">6. Доставка на дигиталния продукт</h2>
            
            <p className="mb-3"><strong>6.1.</strong> Доставката е незабавна и се извършва автоматично след успешното плащане.</p>
            
            <p className="mb-3"><strong>6.2.</strong> Продуктът се предоставя във формата на:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>възпроизвеждане в сайта;</li>
              <li>възможност за изтегляне на аудио файл;</li>
              <li>лимитирано използване на закупен пакет (ако такъв е закупен).</li>
            </ul>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">7. Право на отказ (Refund Policy)</h2>
            
            <p className="mb-3">Съгласно чл. 57, т. 13 от Закона за защита на потребителите:</p>
            
            <p className="mb-3 font-bold text-[#d91f63]">
              Потребителят няма право на отказ от договор за предоставяне на дигитално съдържание, което не се доставя на материален носител, след като изпълнението е започнало със съгласието на потребителя.
            </p>
            
            <p className="mb-3">Поради това:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>След като аудио файлът бъде генериран, връщане на сума не се извършва.</li>
              <li>Потребителят изрично приема това преди плащане.</li>
            </ul>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">8. Отговорност</h2>
            
            <p className="mb-3"><strong>8.1.</strong> Търговецът не носи отговорност за щети, причинени от неправилно използване на сайта или дигиталният продукт.</p>
            
            <p className="mb-3"><strong>8.2.</strong> Търговецът не носи отговорност за:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>проблеми, причинени от трети страни (платежен оператор, AI доставчик);</li>
              <li>технически проблеми, свързани с устройството на потребителя.</li>
            </ul>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">9. Защита на личните данни (GDPR)</h2>
            
            <p className="mb-3"><strong>9.1.</strong> Търговецът обработва единствено минимално необходимите данни:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>текст, въведен от потребителя (за генериране на аудио);</li>
              <li>технически данни (IP, device info);</li>
              <li>данни, свързани с плащането (предоставени от платежния оператор).</li>
            </ul>
            
            <p className="mb-3"><strong>9.2.</strong> Данните се съхраняват за минимално необходимия срок за:</p>
            <ul className="mb-3 ml-6 list-disc text-[#d91f63]">
              <li>доставяне на продукта;</li>
              <li>счетоводни цели;</li>
              <li>обработка на плащания.</li>
            </ul>
            
            <p className="mb-3"><strong>9.3.</strong> Потребителят има право да поиска изтриване на данни.</p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">10. Интелектуална собственост</h2>
            
            <p className="mb-3"><strong>10.1.</strong> Всички текстове, изображения, дизайн и аудио файлове на сайта са собственост на Търговеца.</p>
            
            <p className="mb-3"><strong>10.2.</strong> Потребителят може да използва генерирания аудио файл единствено за лични цели.</p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">11. Промени</h2>
            
            <p className="mb-3">Търговецът може да актуализира Общите условия по всяко време. Промените влизат в сила след публикуване на сайта.</p>

            <hr className="my-8 border-[#ffd7ec]" />

            <h2 className="mb-4 mt-8 text-2xl font-black text-[#d91f63]">12. Контакт</h2>
            
            <p className="mb-3">За въпроси и запитвания:</p>
            <p className="mb-1"><strong className="text-[#d91f63]">BrainEXT</strong></p>
            <p className="mb-1">ЕИК: 208028879</p>
            <p className="mb-1">Email: <a href="mailto:angel@brainext.io" className="text-[#ff5a9d] hover:underline">angel@brainext.io</a></p>
            <p className="mb-3">Адрес: гр.София, кв.Витоша, бл.5Б</p>
          </div>
        </div>
      </div>
    </main>
  );
}
