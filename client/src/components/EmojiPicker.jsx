import React, { useState } from "react";

const EmojiPicker = ({ onSelect, onClose }) => {
  const emojis = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
    "🙂", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜", "🤪",
    "😝", "🤗", "🤔", "🤭", "😮", "😯", "😲", "😱", "🥺", "😢",
    "😭", "😤", "😠", "😡", "🤬", "😈", "👿", "💀", "☠️", "💩",
    "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👊", "✊", "👋",
    "💪", "🙏", "👏", "🙌", "🤲", "🤝", "👮", "🚶", "🏃", "💼",
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
    "❣️", "💕", "💞", "💖", "💗", "❓", "❔", "❕", "❎", "✅",
    "⭕", "❌", "💯", "🔥", "⭐", "🌟", "✨", "💫", "🎉", "🎊",
    "👑", "🎖️", "🏆", "🥇", "🎯", "🎮", "🎲", "📱", "💻", "🌐"
  ];

  return (
    <div className="absolute bottom-14 left-2 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-64 max-h-48 overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <span className="text-xs text-gray-400">Emoji</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
      </div>
      <div className="grid grid-cols-8 gap-1 p-2 overflow-y-auto max-h-36">
        {emojis.map((emoji, idx) => (
          <button
            key={idx}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="p-1 hover:bg-gray-700 rounded text-lg text-center"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;