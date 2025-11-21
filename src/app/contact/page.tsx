import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Свържете се с нас | HoHo.bg",
  description: "Имате въпрос или проблем? Свържете се с екипа на HoHo.bg",
};

export default function ContactPage() {
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
            Свържете се с нас
          </h1>

          <div className="prose prose-lg max-w-none">
            <p className="my-6 text-lg text-[#d91f63]">
              Имате въпрос, предложение или проблем? Ще се радваме да ви помогнем! 🎅
            </p>

            <div className="my-8 rounded-3xl border-4 border-[#ffd7ec] bg-[#fff9fc] p-6">
              <h2 className="mb-4 text-2xl font-black text-[#d91f63]">📧 Email</h2>
              <p className="mb-2 text-lg text-[#d91f63]">
                <a
                  href="mailto:angel@viply.org"
                  className="font-bold text-[#ff5a9d] transition hover:text-[#d91f63] hover:underline"
                >
                  angel@viply.org
                </a>
              </p>
              <p className="text-sm text-[#d91f63]/70">
                Отговаряме обикновено в рамките на 24 часа
              </p>
            </div>

            <div className="my-8 rounded-3xl border-4 border-[#ffd7ec] bg-[#fff9fc] p-6">
              <h2 className="mb-4 text-2xl font-black text-[#d91f63]">❓ Често задавани въпроси</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-lg font-bold text-[#d91f63]">Как работят персонализациите?</h3>
                  <p className="text-[#d91f63]/80">
                    След като закупите пакет с персонализации, можете да създавате уникални коледни послания с гласа на Дядо Коледа. Всяка персонализация ви позволява да създадете едно послание до 100 символа.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-bold text-[#d91f63]">Мога ли да споделя моето послание?</h3>
                  <p className="text-[#d91f63]/80">
                    Да! След създаването на персонализирано послание, получавате уникален линк, който можете да споделите във Facebook или чрез други канали.
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-bold text-[#d91f63]">Защо трябва да купувам персонализации?</h3>
                  <p className="text-[#d91f63]/80">
                    Базовото отброяване и стандартното послание са безплатни. Персонализациите са платени, за да покрием разходите за AI технологията, която генерира уникалния глас на Дядо Коледа.
                  </p>
                </div>

              <div>
                  <h3 className="mb-2 text-lg font-bold text-[#d91f63]">Имам друг въпрос</h3>
                  <p className="text-[#d91f63]/80">
                    Не се колебайте да ни пишете на <a href="mailto:angel@viply.org" className="font-bold text-[#ff5a9d] hover:underline">angel@viply.org</a>. Ще се радваме да отговорим на всички ваши въпроси! 🎄
                  </p>
                </div>
              </div>
            </div>

            <div className="my-8 rounded-3xl border-4 border-[#ffd7ec] bg-[#fff9fc] p-6">
              <h2 className="mb-4 text-2xl font-black text-[#d91f63]">💳 Проблеми с плащания</h2>
              <p className="mb-4 text-[#d91f63]">
                Ако имате проблем с плащане или закупени персонализации, моля изпратете ни email с:
              </p>
              <ul className="mb-4 ml-6 list-disc text-[#d91f63]">
                <li>Вашия User ID (намира се в долната част на страницата)</li>
                <li>Описание на проблема</li>
                <li>Дата и час на плащането (ако е приложимо)</li>
              </ul>
              <p className="text-sm text-[#d91f63]/70">
                Ще разгледаме всеки случай индивидуално и ще отговорим възможно най-бързо.
              </p>
            </div>

            <div className="my-8 rounded-3xl border-4 border-[#ff5a9d] bg-linear-to-br from-[#fff0f8] to-[#ffe8f5] p-6 shadow-lg">
              <h2 className="mb-4 text-2xl font-black text-[#d91f63]">🏢 Корпоративни решения</h2>
              <p className="mb-4 text-lg font-bold text-[#d91f63]">
                Искате да зарадвате вашите служители, клиенти или партньори с уникални коледни поздравления?
              </p>
              <p className="mb-4 text-[#d91f63]">
                Предлагаме специални корпоративни пакети с:
              </p>
              <ul className="mb-4 ml-6 list-disc text-[#d91f63]">
                <li><strong>Неограничени персонализации</strong> за вашата организация</li>
                <li><strong>Корпоративен брандинг</strong> - добавете вашето лого и цветове</li>
                <li><strong>Персонализирани гласови послания</strong> с името на вашата компания</li>
                <li><strong>Приоритетна поддръжка</strong> и техническа помощ</li>
              </ul>
              <div className="mt-6 rounded-2xl border-2 border-[#ff5a9d] bg-white p-4">
                <p className="mb-2 text-center text-sm font-bold text-[#d91f63]">
                  Интересувате се от корпоративно решение?
                </p>
                <p className="text-center">
                  <a
                    href="mailto:angel@viply.org?subject=Корпоративен%20пакет%20HoHo.bg"
                    className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-[#ff5a9d] to-[#d91f63] px-6 py-3 text-base font-bold text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
                  >
                    📧 Свържете се с нас за оферта
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
