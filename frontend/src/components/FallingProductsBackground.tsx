import React, { useMemo } from 'react';

const ITEMS = ['🛒', '🍎', '🥦', '🍞', '🧀', '🥩', '🍇', '🥕', '🛍️', '🍅', '🥑', '🍼', '👓', '👜', '💄', '💅', '🧴', '🧼', '🪒', '🧽', '🧻', '🪥', '🧯', '📱', '💻', '🖥️', '⌨️', '🖱️', '🎧', '📷', '📺', '🔌', '🔋'];

export const FallingProductsBackground = () => {
  // Generate random items to fall
  const fallingItems = useMemo(() => {
    return Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      item: ITEMS[Math.floor(Math.random() * ITEMS.length)],
      left: `${Math.random() * 100}%`,
      animationDuration: `${10 + Math.random() * 15}s`,
      animationDelay: `-${Math.random() * 20}s`,
      fontSize: `${1.5 + Math.random() * 2.5}rem`,
      opacity: 0.15 + Math.random() * 0.35
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {fallingItems.map((confetti) => (
        <div
          key={confetti.id}
          className="absolute -top-[10%] animate-fall-down drop-shadow-md"
          style={{
            left: confetti.left,
            animationDuration: confetti.animationDuration,
            animationDelay: confetti.animationDelay,
            fontSize: confetti.fontSize,
            opacity: confetti.opacity
          }}
        >
          {confetti.item}
        </div>
      ))}
      {/* Bottom gradient to make items cleanly disappear behind content */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </div>
  );
};
