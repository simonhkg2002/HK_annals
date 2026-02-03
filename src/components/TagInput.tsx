/**
 * Tag Input 組件
 * 用於關鍵詞輸入：輸入後按 Enter 變成 tag，tag 有 X 按鈕可刪除
 */

import React, { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from './ui/primitives';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  placeholder = '輸入關鍵詞後按 Enter...',
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const newTag = inputValue.trim();

      // 避免重複
      if (!tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }

      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // 當輸入框為空時，按 Backspace 刪除最後一個 tag
      e.preventDefault();
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className={`border rounded-md p-2 ${className}`}>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-1 bg-brand-blue/10 text-brand-blue rounded text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="hover:bg-brand-blue/20 rounded-full p-0.5 transition-colors"
              aria-label={`刪除關鍵詞 ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="border-0 p-0 focus:ring-0"
      />
    </div>
  );
};
