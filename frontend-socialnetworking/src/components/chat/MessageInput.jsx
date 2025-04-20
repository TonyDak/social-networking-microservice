import { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';

function MessageInput({ onSendMessage, disabled }) {
    const [message, setMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const inputRef = useRef(null);
    const emojiButtonRef = useRef(null);
    const emojiPickerRef = useRef(null);
    
    // Xử lý click bên ngoài để đóng emoji picker
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showEmojiPicker && 
                emojiPickerRef.current && 
                !emojiPickerRef.current.contains(event.target) &&
                emojiButtonRef.current && 
                !emojiButtonRef.current.contains(event.target)) {
                setShowEmojiPicker(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPicker]);

    // Các hàm xử lý hiện tại
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (message.trim() && !disabled) {
            onSendMessage(message);
            setMessage('');
        }
    };
    
    const onEmojiClick = (emojiData) => {
        const emoji = emojiData.emoji;
        setMessage(prev => prev + emoji);
        inputRef.current.focus();
    };
    
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    return (
        <div className="relative border-t border-gray-100 bg-white">
            <form onSubmit={handleSendMessage} className="flex items-end p-3">
                {/* Nút chọn emoji với container cho emoji picker */}
                <div className="relative">
                    <button 
                        type="button"
                        ref={emojiButtonRef}
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-2 text-gray-500 hover:text-indigo-500 focus:outline-none transition-colors"
                    >
                        <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                    
                    {/* Emoji Picker định vị ngay trên nút emoji */}
                    {showEmojiPicker && (
                        <div 
                            ref={emojiPickerRef}
                            className="absolute bottom-full left-0 mb-7 z-50" 
                            style={{ transform: 'translateX(0%)' }}
                        >
                            <div className="shadow-xl rounded-lg overflow-hidden">
                                <EmojiPicker onEmojiClick={onEmojiClick} width={320} height={350} />
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Phần còn lại của form */}
                <div className="flex-1 mx-2">
                    <textarea
                        ref={inputRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Nhập tin nhắn..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none transition-all"
                        rows={message.split('\n').length > 3 ? 3 : 1}
                        disabled={disabled}
                    />
                </div>
                
                <button
                    type="submit"
                    disabled={!message.trim() || disabled}
                    className={`p-2 rounded-full ${
                        message.trim() && !disabled 
                            ? 'bg-indigo-500 text-white hover:bg-indigo-600' 
                            : 'bg-gray-100 text-gray-400'
                    } focus:outline-none transition-colors`}
                >
                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                </button>
            </form>
        </div>
    );
}

export default MessageInput;