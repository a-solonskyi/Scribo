/* oxlint-disable next/no-html-link-for-pages -- Use full document navigation to avoid the published vinext Link regression. */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireApprovedProfessor } from '@/lib/server/professor';
import '../policies/policies.css';
import './instructions.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Instructions | Scribo',
  description:
    'Інструкції для викладачів і студентів. Instructions for professors and students.',
  robots: { index: false, follow: false },
};

export default async function InstructionsPage() {
  // The supplied guide includes the invitation code; only approved professors can read it.
  if (!(await requireApprovedProfessor())) redirect('/login');

  return (
    <div className="policy-shell instructions-shell">
      <a className="policy-skip-link" href="#instructions-content">
        Skip to instructions
      </a>
      <header className="policy-site-header">
        <a className="wordmark" href="/" aria-label="Scribo home">
          [ˈskriː.boː]
        </a>
        <a className="policy-back-link" href="/">
          Back to Scribo
        </a>
      </header>
      <div className="policy-grid">
        <aside className="policy-navigation">
          <p>Instructions</p>
          <nav aria-label="Instructions languages">
            <a href="#ukrainian" lang="uk">
              Українська 🇺🇦
            </a>
            <a href="#english" lang="en">
              English 🇬🇧
            </a>
          </nav>
        </aside>
        <main
          className="policy-document instructions-document"
          id="instructions-content"
          tabIndex={-1}
        >
          <h1>Instructions</h1>
          <section id="ukrainian" lang="uk" tabIndex={-1}>
            <h2 className="instructions-language">Українська 🇺🇦</h2>
            <section>
              <h3>Інструкція для викладачів</h3>
              <div className="instructions-access">
                <p>
                  <strong>Посилання:</strong>{' '}
                  <a href="https://skribo-essay.andriisolonskyi.chatgpt.site">
                    https://skribo-essay.andriisolonskyi.chatgpt.site
                  </a>
                </p>
                <p>
                  <strong>Код-запрошення:</strong> <code>JsuthW28!usyt</code>
                </p>
              </div>
              <h4>Створення завдання</h4>
              <ol>
                <li>Увійдіть через ChatGPT і введіть код-запрошення.</li>
                <li>
                  Натисніть <strong>New class</strong>.
                </li>
                <li>Вкажіть назву класу та, за потреби, опис.</li>
                <li>
                  Відкрийте клас і натисніть <strong>New essay</strong>.
                </li>
                <li>
                  Вкажіть:
                  <ul>
                    <li>тему есе;</li>
                    <li>інструкції, якщо потрібно;</li>
                    <li>дедлайн, якщо потрібно.</li>
                  </ul>
                </li>
                <li>
                  Натисніть <strong>Copy link</strong> і надішліть посилання
                  студентам. Обліковий запис студентам не потрібен.
                </li>
              </ol>
              <h4>Перевірка роботи</h4>
              <ol>
                <li>Відкрийте клас, завдання та оберіть роботу студента.</li>
                <li>
                  Використовуйте вкладки:
                  <ul>
                    <li>
                      <strong>Overview</strong> — основні показники письма;
                    </li>
                    <li>
                      <strong>Essay text</strong> — фінальний текст, позначення
                      вставлених фрагментів і відтворення процесу написання;
                    </li>
                    <li>
                      <strong>Response</strong> — виділення, коментарі, рисунки
                      та експорт відповіді у PDF;
                    </li>
                    <li>
                      <strong>Events</strong> — події вставлення та паузи;
                    </li>
                    <li>
                      <strong>Technical details</strong> — детальні показники
                      процесу;
                    </li>
                    <li>
                      <strong>AI prompt</strong> — завантаження <code>.md</code>
                      -файлу з текстом і даними роботи. Надалі ви можете
                      надіслати цей файл будь-якій LLM для допомоги з аналізом
                      роботи.
                    </li>
                  </ul>
                </li>
                <li>
                  Розглядайте показники разом із текстом і контекстом. Вони не є
                  самостійним доказом порушення.
                </li>
              </ol>
            </section>
            <section>
              <h3>Інструкція для студентів</h3>
              <h4>Перед початком</h4>
              <ol>
                <li>Відкрийте посилання викладача.</li>
                <li>Прочитайте тему та інструкції.</li>
                <li>
                  Введіть своє повне ім’я в полі <strong>Name</strong>.
                </li>
                <li>Почніть писати у текстовому редакторі.</li>
              </ol>
              <h4>Під час написання</h4>
              <ul>
                <li>Пишіть як у звичайному текстовому документі.</li>
                <li>
                  Ви можете форматувати, редагувати, видаляти та переписувати
                  текст.
                </li>
                <li>
                  Ви можете вставляти текст, якщо це дозволено завданням.
                  Вставлення буде зафіксовано.
                </li>
                <li>
                  Унизу сторінки відображається кількість слів і символів.
                </li>
                <li>
                  Для збереження прогресу написання — увійдіть у свій аккаунт
                  ChatGPT.
                  <ul>
                    <li>
                      Інакше — чернетка автоматично зберігається лише у цьому
                      браузері. Не змінюйте браузер або пристрій. Не оновлюйте й
                      не закривайте сторінку без потреби.
                    </li>
                  </ul>
                </li>
              </ul>
              <h4>Надсилання</h4>
              <ol>
                <li>Перевірте текст і своє ім’я.</li>
                <li>
                  Натисніть <strong>Submit</strong> лише після завершення
                  роботи.
                </li>
                <li>
                  Не закривайте сторінку, доки не з’явиться повідомлення{' '}
                  <strong>Essay submitted</strong>.
                </li>
                <li>
                  Натисніть <strong>Download my essay</strong>, щоб завантажити
                  копію.
                </li>
              </ol>
            </section>
          </section>
          <section id="english" lang="en" tabIndex={-1}>
            <h2 className="instructions-language">English 🇬🇧</h2>
            <section>
              <h3>Instructions for professors</h3>
              <div className="instructions-access">
                <p>
                  <strong>Link:</strong>{' '}
                  <a href="https://skribo-essay.andriisolonskyi.chatgpt.site">
                    https://skribo-essay.andriisolonskyi.chatgpt.site
                  </a>
                </p>
                <p>
                  <strong>Invitation code:</strong> <code>JsuthW28!usyt</code>
                </p>
              </div>
              <h4>Creating an assignment</h4>
              <ol>
                <li>Sign in with ChatGPT and enter the invitation code.</li>
                <li>
                  Click <strong>New class</strong>.
                </li>
                <li>Enter the class name and an optional description.</li>
                <li>
                  Open the class and click <strong>New essay</strong>.
                </li>
                <li>
                  Enter:
                  <ul>
                    <li>the essay topic;</li>
                    <li>optional instructions;</li>
                    <li>an optional deadline.</li>
                  </ul>
                </li>
                <li>
                  Click <strong>Copy link</strong> and send the link to
                  students. Students do not need an account.
                </li>
              </ol>
              <h4>Reviewing a submission</h4>
              <ol>
                <li>Open the class, assignment, and student’s work.</li>
                <li>
                  Use the following tabs:
                  <ul>
                    <li>
                      <strong>Overview</strong> — key writing metrics;
                    </li>
                    <li>
                      <strong>Essay text</strong> — final text, pasted-text
                      highlighting, and writing replay;
                    </li>
                    <li>
                      <strong>Response</strong> — highlights, comments,
                      drawings, and PDF feedback export;
                    </li>
                    <li>
                      <strong>Events</strong> — paste and pause events;
                    </li>
                    <li>
                      <strong>Technical details</strong> — detailed
                      writing-process information;
                    </li>
                    <li>
                      <strong>AI prompt</strong> — downloadable <code>.md</code>{' '}
                      file containing the essay and writing data. Provide it to
                      your preferred LLM for assistance in analyzing the essay.
                    </li>
                  </ul>
                </li>
                <li>
                  Review metrics together with the text and context. They are
                  not standalone proof of misconduct.
                </li>
              </ol>
            </section>
            <section>
              <h3>Instructions for students</h3>
              <h4>Before writing</h4>
              <ol>
                <li>Open the link provided by your professor.</li>
                <li>Read the essay topic and instructions.</li>
                <li>
                  Enter your full name in the <strong>Name</strong> field.
                </li>
                <li>Begin writing in the text editor.</li>
              </ol>
              <h4>While writing</h4>
              <ul>
                <li>Write as you would in a regular document.</li>
                <li>You may format, edit, delete, and revise your text.</li>
                <li>
                  You may paste text if the assignment permits it. Paste
                  activity will be recorded.
                </li>
                <li>
                  Word and character counts appear at the bottom of the page.
                </li>
                <li>
                  To save your writing progress, log in to your ChatGPT account.
                  <ul>
                    <li>
                      Otherwise — your draft will be saved automatically only in
                      the current browser. Do not switch browsers or devices.
                      Avoid refreshing or closing the page.
                    </li>
                  </ul>
                </li>
              </ul>
              <h4>Submitting</h4>
              <ol>
                <li>Review your essay and name.</li>
                <li>
                  Click <strong>Submit</strong> only when the essay is complete.
                </li>
                <li>
                  Keep the page open until <strong>Essay submitted</strong>{' '}
                  appears.
                </li>
                <li>
                  Click <strong>Download my essay</strong> to save a copy.
                </li>
              </ol>
            </section>
          </section>
          <footer className="policy-document-footer">
            <a href="/">Back to Scribo</a>
          </footer>
        </main>
      </div>
    </div>
  );
}
