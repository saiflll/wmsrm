'use client';
import React from 'react';

export const ChartTooltip = ({ tooltip }: { tooltip: any }) => {
  if (!tooltip) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: tooltip.x,
        top: tooltip.y,
        transform: 'translate(-50%, calc(-100% - 10px))',
        background: '#1a1a1a',
        color: '#fff',
        padding: '6px 10px',
        borderRadius: 8,
        fontSize: 11,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        zIndex: 20,
        boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
      }}
    >
      {tooltip.title && (
        <div
          style={{
            fontSize: 9,
            opacity: 0.65,
            marginBottom: 3,
            fontWeight: 700,
          }}
        >
          {tooltip.title}
        </div>
      )}
      {tooltip.lines.map((l: any, i: number) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            fontWeight: 600,
          }}
        >
          {l.color && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: l.color,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ opacity: 0.85, fontSize: 10 }}>{l.label}:</span>
          <span>{l.value}</span>
        </div>
      ))}
    </div>
  );
};
