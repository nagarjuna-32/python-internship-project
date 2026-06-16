import React from 'react';

export default function ConfirmModal({
  open,
  title = 'Confirm',
  description = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onCancel
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onMouseDown={(e) => {
        if (e.currentTarget === e.target && onCancel) onCancel();
      }}
    >
      <div className="card" style={{ width: 'min(560px, 90vw)', padding: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
        <div style={{ color: 'var(--muted)', marginTop: 8, fontSize: 13 }}>{description}</div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={`btn ${danger ? 'btnDanger' : 'btnPrimary'}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

