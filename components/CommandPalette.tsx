import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';

export type Command = {
  id: string;
  label: string;
  group: string;
  hint?: string;
  icon?: React.ReactNode;
  keywords?: string;
  shortcut?: string;
  run: () => void;
};

// Cyrillic ↔ Latin keyboard layouts: typing «лтшпш» with the wrong layout
// still finds «книги», which happens constantly for RU/DE editors.
const EN = 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.';
const RU = 'йцукенгшщзхъфывапролджэячсмитьбю';
const swapLayout = (value: string) =>
  value.split('').map(char => {
    const en = EN.indexOf(char);
    if (en >= 0) return RU[en];
    const ru = RU.indexOf(char);
    return ru >= 0 ? EN[ru] : char;
  }).join('');

const score = (command: Command, needle: string) => {
  if (!needle) return 1;
  const haystack = `${command.label} ${command.group} ${command.keywords || ''} ${command.hint || ''}`.toLowerCase();
  for (const variant of [needle, swapLayout(needle)]) {
    if (command.label.toLowerCase().startsWith(variant)) return 3;
    if (haystack.includes(variant)) return 2;
    // every word present, in any order
    if (variant.split(/\s+/).every(word => haystack.includes(word))) return 1;
  }
  return 0;
};

export const CommandPalette: React.FC<{
  open: boolean;
  onClose: () => void;
  commands: Command[];
}> = ({ open, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return commands
      .map(command => ({ command, rank: score(command, needle) }))
      .filter(item => item.rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 40)
      .map(item => item.command);
  }, [commands, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const execute = (command?: Command) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(i => Math.min(results.length - 1, i + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); execute(results[active]); }
    else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  };

  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-primary/40 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Быстрые команды"
        className="w-full max-w-[640px] overflow-hidden border border-primary/20 bg-white shadow-[0_30px_80px_rgba(4,15,30,0.35)]"
        onMouseDown={event => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-primary/10 px-5">
          <Search size={17} className="text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Раздел, книга, материал или действие…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-gray-400"
            aria-controls="command-results"
            aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
          />
          <kbd className="border border-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">esc</kbd>
        </div>
        <div ref={listRef} id="command-results" role="listbox" className="max-h-[52vh] overflow-y-auto py-2">
          {results.length === 0 ? <p className="px-5 py-8 text-center text-sm text-gray-400">Ничего не найдено</p> : null}
          {results.map((command, index) => {
            const header = command.group !== lastGroup ? command.group : '';
            lastGroup = command.group;
            return (
              <React.Fragment key={command.id}>
                {header ? <p className="px-5 pb-1 pt-3 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-gray-400">{header}</p> : null}
                <button
                  id={`cmd-${command.id}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === active}
                  onMouseMove={() => setActive(index)}
                  onClick={() => execute(command)}
                  className={`flex w-full items-center gap-3 px-5 py-2.5 text-left ${index === active ? 'bg-[#F4F4F0]' : ''}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center border ${index === active ? 'border-accent bg-accent/15 text-primary' : 'border-primary/10 text-gray-500'}`}>{command.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{command.label}</span>
                    {command.hint ? <span className="block truncate text-xs text-gray-400">{command.hint}</span> : null}
                  </span>
                  {command.shortcut ? <kbd className="border border-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">{command.shortcut}</kbd> : null}
                  {index === active ? <CornerDownLeft size={14} className="text-gray-400" /> : null}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-primary/10 bg-[#FAFAF7] px-5 py-2 font-mono text-[10px] text-gray-400">
          <span>↑↓ выбрать</span><span>↵ открыть</span><span className="ml-auto">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
};
