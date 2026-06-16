import React from 'react';

export default function EmptyState({ title = 'No data', description = 'Try adjusting your filters.' }) {
  return (
    <div style={{ padding: 22 }}>
      <div
        className="card"
        style={{ padding: 22, borderRadius: 16, maxWidth: 720, margin: '0 auto', textAlign: 'center' }}
      >
        <div style={{ fontSize: 14, color: 'rgba(168,179,207,.95)', marginTop: 10 }}>{description}</div>
        <div style={{ fontWeight: 800, marginTop: 10 }}>{title}</div>
      </div>
    </div>
  );
}

