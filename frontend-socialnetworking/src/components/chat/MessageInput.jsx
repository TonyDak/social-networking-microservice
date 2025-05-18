import { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { uploadFileToCloudinary } from '../../services/apiClient';

function MessageInput({ onSendMessage, disabled }) {
    const [message, setMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const inputRef = useRef(null);
    const emojiButtonRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const fileInputRef = useRef(null);

    // Đóng emoji picker khi click ngoài
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showEmojiPicker &&
                emojiPickerRef.current &&
                !emojiPickerRef.current.contains(event.target) &&
                emojiButtonRef.current &&
                !emojiButtonRef.current.contains(event.target)
            ) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showEmojiPicker]);

    // Gửi tin nhắn text
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (message.trim() && !disabled) {
            onSendMessage({ type: "text", content: message });
            setMessage('');
        }
    };

    // Chọn emoji
    const onEmojiClick = (emojiData) => {
        const emoji = emojiData.emoji;
        setMessage(prev => prev + emoji);
        inputRef.current.focus();
    };

    // Gửi bằng Enter
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    // Xử lý gửi file
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        let fileType = "file";
        if (file.type.startsWith("image/")) fileType = "image";
        else if (file.type.startsWith("video/")) fileType = "video";
        // Upload lên Cloudinary
        const url = await uploadFileToCloudinary(file);
        onSendMessage({ type: fileType, content: url, fileName: file.name });
        fileInputRef.current.value = "";
    };

    return (
        <div className="relative border-t border-gray-100 bg-white">
            <form onSubmit={handleSendMessage} className="flex items-center p-3 gap-2">
    {/* Nút emoji */}
    <div className="relative flex items-center">
        <button
            type="button"
            ref={emojiButtonRef}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-500 hover:text-indigo-500 focus:outline-none transition-colors rounded-full flex items-center justify-center"
            style={{ width: 40, height: 40 }}
        >
            <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </button>
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
    {/* Nút đính kèm file */}
    <button
        type="button"
        onClick={() => fileInputRef.current.click()}
        className="p-2 text-gray-500 hover:text-indigo-500 focus:outline-none transition-colors rounded-full flex items-center justify-center"
        title="Đính kèm file"
        disabled={disabled}
        style={{ width: 40, height: 40 }}
    >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828a4 4 0 10-5.656-5.656L5.343 11.172a6 6 0 108.485 8.485l7.071-7.071" />
        </svg>
    </button>
    <input
        type="file"
        accept="image/*,video/*,application/pdf,.doc,.docx"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
    />
    {/* Nhập tin nhắn */}
    <div className="flex-1 mx-2 flex items-center">
        <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập tin nhắn..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none transition-all"
            rows={1}
            style={{ minHeight: 40, maxHeight: 80 }}
            disabled={disabled}
        />
    </div>
    {/* Nút gửi */}
    <button
        type="submit"
        disabled={!message.trim() || disabled}
        className={`p-2 rounded-full flex items-center justify-center ${
            message.trim() && !disabled
                ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                : 'bg-gray-100 text-gray-400'
        } focus:outline-none transition-colors`}
        style={{ width: 40, height: 40 }}
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