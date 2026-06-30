'use client';

import React from 'react';

export default function DemoActions({ templateId }: { templateId: string }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '32px',
      left: '32px',
      display: 'flex',
      gap: '12px',
      zIndex: 100,
      background: 'rgba(0,0,0,0.5)',
      padding: '12px',
      borderRadius: '16px',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.1)'
    }}>
      <a 
        href="#"
        onClick={(e) => { e.preventDefault(); window.close(); }}
        style={{
          padding: '12px 24px',
          borderRadius: '50px',
          background: 'rgba(255,255,255,0.1)',
          color: '#fff',
          textDecoration: 'none',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          fontWeight: 500,
          border: '1px solid rgba(255,255,255,0.2)',
          cursor: 'pointer'
        }}
      >
        Закрыть
      </a>
      <a
        href={`/editor?template=${templateId}`}
        style={{
          padding: '12px 32px',
          borderRadius: '50px',
          background: 'linear-gradient(135deg, #d3c5ad, #685d4a)',
          color: '#fff',
          textDecoration: 'none',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          fontWeight: 600,
          boxShadow: '0 4px 16px rgba(104, 93, 74, 0.3)',
          cursor: 'pointer'
        }}
      >
        Выбрать этот шаблон
      </a>
    </div>
  );
}
