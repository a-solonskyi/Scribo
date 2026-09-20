/* oxlint-disable next/no-html-link-for-pages -- Sign-in uses document navigation to avoid the published vinext Link regression. */
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';
import './instructions-dialog.css';

const labels = {
  en: {
    title: 'Instructions',
    close: 'Close',
    closeLabel: 'Close instructions',
    loading: 'Loading instructions…',
    error: 'Instructions could not be loaded. Please try again.',
    retry: 'Try again',
    denied:
      'Please sign in with an approved professor account to read the instructions.',
    signIn: 'Sign in',
  },
  uk: {
    title: 'Інструкції',
    close: 'Закрити',
    closeLabel: 'Закрити інструкції',
    loading: 'Завантаження інструкцій…',
    error: 'Не вдалося завантажити інструкції. Спробуйте ще раз.',
    retry: 'Спробувати ще раз',
    denied:
      'Увійдіть у підтверджений обліковий запис викладача, щоб прочитати інструкції.',
    signIn: 'Увійти',
  },
};

export default function InstructionsButton() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState('en');
  const [content, setContent] = useState(null);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const triggerRef = useRef(null);
  const titleRef = useRef(null);
  const text = labels[language];

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();

    async function loadInstructions() {
      try {
        const response = await fetch('/api/instructions', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 403) {
          setError('denied');
          return;
        }
        if (!response.ok) throw new Error('Instructions unavailable');
        const guide = await response.json();
        if (typeof guide.en !== 'string' || typeof guide.uk !== 'string') {
          throw new Error('Instructions unavailable');
        }
        if (!controller.signal.aborted) setContent(guide);
      } catch {
        if (!controller.signal.aborted) setError('error');
      }
    }

    void loadInstructions();
    return () => controller.abort();
  }, [open, retry]);

  function handleOpenChange(nextOpen) {
    if (nextOpen) {
      setContent(null);
      setError(null);
    }
    setOpen(nextOpen);
  }

  function retryLoading() {
    setError(null);
    setRetry((count) => count + 1);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="sidebar-action-button sidebar-action-button-inverse"
        ref={triggerRef}
      >
        Instructions
      </DialogTrigger>
      <DialogContent
        className="instructions-dialog"
        showCloseButton={false}
        initialFocus={titleRef}
        finalFocus={triggerRef}
        lang={language}
      >
        <div className="instructions-dialog-header">
          <DialogTitle ref={titleRef} tabIndex={-1}>
            {text.title}
          </DialogTitle>
          <DialogClose
            className="instructions-close"
            aria-label={text.closeLabel}
          >
            {text.close}
          </DialogClose>
        </div>
        <Tabs
          className="instructions-tabs"
          value={language}
          onValueChange={setLanguage}
        >
          <TabsList
            className="instructions-language-switch"
            aria-label="Instructions language"
            activateOnFocus
          >
            <TabsTrigger value="en" lang="en">
              English 🇬🇧
            </TabsTrigger>
            <TabsTrigger value="uk" lang="uk">
              Українська 🇺🇦
            </TabsTrigger>
          </TabsList>
          {['en', 'uk'].map((locale) => (
            <TabsContent
              key={locale}
              value={locale}
              className="instructions-panel"
              lang={locale}
            >
              {error ? (
                <div className="instructions-status" role="alert">
                  <p>{labels[locale][error]}</p>
                  {error === 'denied' ? (
                    <a href="/login">{labels[locale].signIn}</a>
                  ) : (
                    <button
                      className="outline-button"
                      type="button"
                      onClick={retryLoading}
                    >
                      {labels[locale].retry}
                    </button>
                  )}
                </div>
              ) : content ? (
                // HTML comes only from the protected endpoint's static, server-authored guide.
                <div
                  className="instructions-copy"
                  dangerouslySetInnerHTML={{ __html: content[locale] }}
                />
              ) : (
                <output className="instructions-status">
                  {labels[locale].loading}
                </output>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
