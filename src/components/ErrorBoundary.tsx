import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-offwhite gap-4 p-8 text-center">
          <div className="w-12 h-12 rounded-2xl gold-gradient flex items-center justify-center text-white text-xl font-black">
            !
          </div>
          <h1 className="text-bluegray font-display text-2xl font-semibold">Algo deu errado</h1>
          <p className="text-bluegray/50 text-sm max-w-sm">{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-3 rounded-full gold-gradient text-white text-xs font-bold uppercase tracking-widest"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
