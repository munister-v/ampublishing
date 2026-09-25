import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileJson, GitCommit, Loader2, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { contentStore, type ContentCommit, type ContentCommitFile } from '../services/contentStore';

// Human names for the content files, so editors don't have to read paths.
const FILE_LABELS: Record<string, string> = {
  books: 'Книги',
  news: 'Мероприятия',
  services: 'Услуги',
  'translation-overrides': 'Тексты сайта',
  'site-settings': 'Навигация и футер',
  integrations: 'Интеграции',
  seo: 'SEO',
  'payment-settings': 'Оплата',
  orders: 'Заказы',
  'admin-auth': 'Доступ в админку',
  manifest: 'Манифест',
};

const describeFile = (filename: string) => {
  const base = filename.replace('public/content/', '').replace(/\.json$/, '');
  const [name, lang] = base.split('.');
  return { label: FILE_LABELS[name] || name, lang: lang?.toUpperCase() || '' };
};

const describeCommit = (message: string, labelFor?: (key: string) => string | undefined) => {
  const first = message.split('\n')[0];
  const textKey = first.match(/^admin: (?:set|reset) ([\w.]+) \((\w+)\)$/);
  const label = textKey ? labelFor?.(textKey[1]) : undefined;
  if (textKey && label) return `${/^Текст/.test(label) ? label : `Текст: ${label}`} (${textKey[2]})`;
  return first
    .replace(/^admin:\s*/, '')
    .replace(/^ci\(translate\):\s*/, 'Автоперевод: ')
    .replace(/^upsert book /, 'Книга: ')
    .replace(/^upsert news /, 'Материал: ')
    .replace(/^set /, 'Текст: ')
    .replace(/^upload image /, 'Картинка: ')
    .replace(/^restore /, 'Восстановлено: ');
};

const dayLabel = (iso: string) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};

const PatchView: React.FC<{ patch: string }> = ({ patch }) => {
  if (!patch) return <p className="px-4 py-3 text-xs text-gray-400">Изменения слишком большие для просмотра — откройте на GitHub.</p>;
  const lines = patch.split('\n').slice(0, 400);
  return (
    <pre className="max-h-[420px] overflow-auto bg-[#FBFBF8] py-2 font-mono text-[11px] leading-relaxed">
      {lines.map((line, index) => (
        <div
          key={index}
          className={`whitespace-pre-wrap break-all px-4 ${line.startsWith('+') ? 'bg-emerald-50 text-emerald-900' : line.startsWith('-') ? 'bg-red-50 text-red-900' : line.startsWith('@@') ? 'text-sky-700' : 'text-gray-500'}`}
        >
          {line}
        </div>
      ))}
    </pre>
  );
};

export const ContentHistory: React.FC<{
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onRestored: () => Promise<void> | void;
  labelFor?: (key: string) => string | undefined;
}> = ({ onToast, onRestored, labelFor }) => {
  const [commits, setCommits] = useState<ContentCommit[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, ContentCommitFile[]>>({});
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hideTranslations, setHideTranslations] = useState(true);

  const load = async (nextPage: number) => {
    setLoading(true);
    setError('');
    try {
      const batch = await contentStore.listContentCommits(nextPage);
      setCommits(prev => (nextPage === 1 ? batch : [...prev, ...batch]));
      setHasMore(batch.length === 30);
      setPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить историю');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const toggle = async (sha: string) => {
    setOpenFile(null);
    if (expanded === sha) { setExpanded(null); return; }
    setExpanded(sha);
    if (!files[sha]) {
      try {
        const list = await contentStore.getCommitFiles(sha);
        setFiles(prev => ({ ...prev, [sha]: list.filter(file => file.filename.startsWith('public/content/')) }));
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Не удалось открыть правку', 'error');
      }
    }
  };

  const restore = async (commit: ContentCommit, file: ContentCommitFile) => {
    const { label, lang } = describeFile(file.filename);
    const when = new Date(commit.date).toLocaleString('ru-RU');
    if (!window.confirm(`Вернуть «${label}${lang ? ` ${lang}` : ''}» к состоянию ДО правки от ${when}?\n\nВсе более поздние изменения этого файла тоже откатятся. Операция создаёт новую запись в истории — её можно отменить.`)) return;
    const key = `${commit.sha}:${file.filename}`;
    setRestoring(key);
    try {
      await contentStore.restoreFileVersion(file.filename, commit.parent);
      onToast(`«${label}» восстановлено — сайт обновится за ~1 минуту`);
      await onRestored();
      await load(1);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Не удалось восстановить', 'error');
    } finally {
      setRestoring(null);
    }
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return commits.filter(commit => {
      if (hideTranslations && commit.message.startsWith('ci(translate)')) return false;
      return !needle || describeCommit(commit.message, labelFor).toLowerCase().includes(needle) || commit.message.toLowerCase().includes(needle) || commit.author.toLowerCase().includes(needle);
    });
  }, [commits, query, hideTranslations]);

  const grouped = useMemo(() => {
    const groups: { day: string; items: ContentCommit[] }[] = [];
    visible.forEach(commit => {
      const day = dayLabel(commit.date);
      const last = groups[groups.length - 1];
      if (last?.day === day) last.items.push(commit);
      else groups.push({ day, items: [commit] });
    });
    return groups;
  }, [visible]);

  return (
    <section className="space-y-6 pb-16">
      <div className="flex flex-col gap-3 border border-primary/10 bg-white p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по правкам: название книги, раздел…"
            className="w-full border border-gray-300 py-3 pl-9 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={hideTranslations} onChange={e => setHideTranslations(e.target.checked)} /> Скрыть автопереводы
        </label>
        <button onClick={() => load(1)} className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-primary/20 px-4 text-[10px] font-bold uppercase tracking-widest hover:border-primary">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Обновить
        </button>
      </div>

      {error ? <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {grouped.map(group => (
        <div key={group.day}>
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">{group.day}</p>
          <div className="divide-y divide-primary/10 border border-primary/10 bg-white">
            {group.items.map(commit => (
              <div key={commit.sha}>
                <button onClick={() => toggle(commit.sha)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-[#FAFAF7] md:px-6">
                  {expanded === commit.sha ? <ChevronDown size={15} className="shrink-0 text-gray-400" /> : <ChevronRight size={15} className="shrink-0 text-gray-400" />}
                  <GitCommit size={15} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-sm">{describeCommit(commit.message, labelFor)}</span>
                  <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">{commit.author}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-gray-400">{new Date(commit.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                </button>
                {expanded === commit.sha ? (
                  <div className="border-t border-primary/10 bg-[#FCFCFA] px-4 py-3 md:px-6">
                    {!files[commit.sha] ? (
                      <Loader2 size={16} className="my-2 animate-spin text-gray-400" />
                    ) : files[commit.sha].length === 0 ? (
                      <p className="text-xs text-gray-400">В этой правке нет файлов контента.</p>
                    ) : (
                      <div className="space-y-2">
                        {files[commit.sha].map(file => {
                          const { label, lang } = describeFile(file.filename);
                          const key = `${commit.sha}:${file.filename}`;
                          const restorable = file.filename.endsWith('.json') && commit.parent && file.status !== 'added';
                          return (
                            <div key={file.filename} className="border border-primary/10 bg-white">
                              <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                                <FileJson size={14} className="text-gray-400" />
                                <span className="text-sm font-semibold">{label}</span>
                                {lang ? <span className="bg-primary px-1.5 py-0.5 font-mono text-[9px] text-white">{lang}</span> : null}
                                <span className="font-mono text-[11px] text-emerald-700">+{file.additions}</span>
                                <span className="font-mono text-[11px] text-red-600">−{file.deletions}</span>
                                <div className="ml-auto flex gap-2">
                                  <button onClick={() => setOpenFile(openFile === key ? null : key)} className="min-h-[32px] border border-primary/15 px-3 text-[10px] font-bold uppercase tracking-widest hover:border-primary">
                                    {openFile === key ? 'Скрыть' : 'Что изменилось'}
                                  </button>
                                  {restorable ? (
                                    <button
                                      onClick={() => restore(commit, file)}
                                      disabled={Boolean(restoring)}
                                      className="inline-flex min-h-[32px] items-center gap-1.5 border border-amber-300 bg-amber-50 px-3 text-[10px] font-bold uppercase tracking-widest text-amber-900 hover:bg-amber-100 disabled:opacity-40"
                                    >
                                      {restoring === key ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Отменить правку
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              {openFile === key ? <PatchView patch={file.patch} /> : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}

      {!loading && !error && visible.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Правок не найдено.</p> : null}

      {hasMore && commits.length ? (
        <button onClick={() => load(page + 1)} disabled={loading} className="mx-auto flex min-h-[44px] items-center gap-2 border border-primary/20 bg-white px-6 text-[10px] font-bold uppercase tracking-widest hover:border-primary">
          {loading ? <Loader2 size={13} className="animate-spin" /> : null} Показать раньше
        </button>
      ) : null}
    </section>
  );
};
