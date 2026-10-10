import { useEffect, useRef } from 'react';

// Janela modal usando o <dialog> nativo (Esc fecha e o foco fica preso dentro dela).
export default function Modal({ title, onClose, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // clique no fundo escuro (fora da caixa) fecha
      onMouseDown={(event) => event.target === ref.current && onClose()}
    >
      <div className="modal-box">
        <header>
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
