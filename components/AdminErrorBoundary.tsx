import React from 'react';

type State = { error: Error | null };

export class AdminErrorBoundary extends React.Component<{ children?: React.ReactNode }, State> {
  declare props: { children?: React.ReactNode };
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[admin] render failed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="min-h-dvh bg-[#F4F4F0] p-6 text-primary flex items-center justify-center">
        <section className="w-full max-w-2xl border border-primary bg-white p-8 md:p-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-600">Ошибка интерфейса</p>
          <h1 className="mt-4 font-serif text-4xl">Админка не смогла открыться</h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-600">Теперь вместо белого экрана показывается причина. Обновите страницу; если ошибка повторится, скопируйте текст ниже.</p>
          <pre className="mt-6 max-h-40 overflow-auto border border-red-100 bg-red-50 p-4 text-xs text-red-800 whitespace-pre-wrap">{this.state.error.message}</pre>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => window.location.reload()} className="min-h-[44px] bg-primary px-5 py-3 text-xs font-bold uppercase tracking-widest text-white">Повторить</button>
            <a href="/login" className="min-h-[44px] border border-primary px-5 py-3 text-xs font-bold uppercase tracking-widest inline-flex items-center">Вернуться ко входу</a>
          </div>
        </section>
      </main>
    );
  }
}
