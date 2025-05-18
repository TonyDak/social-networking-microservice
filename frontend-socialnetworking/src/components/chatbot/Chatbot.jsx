import { useState, useRef, useEffect } from "react";
import axios from "axios";

function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Tự động scroll xuống cuối khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:8081/api/ai-chatbot", {
        messages: [...messages, userMsg],
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.reply },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Xin lỗi, có lỗi xảy ra!" },
      ]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <g>
              <rect x="4" y="7" width="16" height="10" rx="5" fill="currentColor" opacity="0.15"/>
              <rect x="4" y="7" width="16" height="10" rx="5" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="8.5" cy="12" r="1" fill="currentColor"/>
              <circle cx="15.5" cy="12" r="1" fill="currentColor"/>
              <rect x="10" y="15" width="4" height="1" rx="0.5" fill="currentColor"/>
              <path d="M12 7V5M7 7V5M17 7V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </g>
          </svg>
          </div>
          <div>
            <div className="font-semibold text-lg text-indigo-700">
              Chatbot AI
            </div>
            <div className="text-xs text-gray-500">
              Trò chuyện với trợ lý ảo
            </div>
          </div>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex mb-3 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 inline-block shadow-sm transition-all text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-50 text-gray-900 rounded-br-none"
                  : "bg-white border border-gray-100 text-gray-800 rounded-bl-none"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex mb-3 justify-start">
            <div className="max-w-[75%] rounded-2xl px-4 py-2.5 inline-block shadow-sm bg-white border border-gray-100 text-gray-400 text-sm leading-relaxed">
              Đang trả lời...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Input */}
      <div className="border-t border-gray-200 bg-white">
        <form onSubmit={sendMessage} className="flex items-center p-3">
          <div className="flex-1 mx-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi cho AI..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none transition-all"
              rows={input.split("\n").length > 3 ? 3 : 1}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className={`p-2 rounded-full ${
              input.trim() && !loading
                ? "bg-indigo-500 text-white hover:bg-indigo-600"
                : "bg-gray-100 text-gray-400"
            } focus:outline-none transition-colors`}
            style={{ width: 40, height: 40 }}
          >
            <svg
              className="w-5 h-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chatbot;
