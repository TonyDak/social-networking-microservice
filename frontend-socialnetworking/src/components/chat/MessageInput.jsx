import { useState } from 'react';

function MessageInput({ onSendMessage}) {
    const [message, setMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (message.trim()) {
            // Truyền message.trim() trực tiếp lên onSendMessage
            console.log("Sending message:", message.trim());
            onSendMessage(message.trim());
            setMessage('');
            
            // Khi gửi tin nhắn, cũng đặt trạng thái isTyping thành false
            if (isTyping) {
                setIsTyping(false);

            }
        }
    };

    const handleChange = (e) => {
        setMessage(e.target.value);
    };

    return (
        <div className="p-4 border-t border-gray-200 bg-white">
            <form onSubmit={handleSubmit} className="flex items-center">
                <button 
                    type="button" 
                    className="p-2 text-gray-500 hover:text-indigo-600 rounded-full hover:bg-gray-100"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                </button>
                <input
                    type="text"
                    placeholder="Nhập tin nhắn..."
                    className="flex-1 p-2 mx-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={message}
                    onChange={handleChange}
                />
                <button
                    type="submit"
                    disabled={!message.trim()}
                    className={`p-2 rounded-full ${
                        message.trim()
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                </button>
            </form>
        </div>
    );
}

export default MessageInput;