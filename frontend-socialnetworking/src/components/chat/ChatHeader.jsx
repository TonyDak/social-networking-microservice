function ChatHeader({ conversation }) {
    return (
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                    {conversation.type === 'GROUP' ? (
                        <span className="text-base font-medium text-indigo-600">
                            {conversation.name?.charAt(0) || 'G'}
                        </span>
                    ) : (
                        <span className="text-base font-medium text-indigo-600">U</span>
                    )}
                </div>
                <div>
                    <h2 className="font-semibold text-lg">
                        {conversation.type === 'GROUP' 
                            ? conversation.name 
                            : 'Người dùng'}
                    </h2>
                    <p className="text-xs text-gray-500">
                        {conversation.type === 'GROUP' 
                            ? `${conversation.participants?.length || 0} thành viên` 
                            : 'Trực tuyến'}
                    </p>
                </div>
            </div>
            
            <div className="flex space-x-2">
                <button className="p-2 text-gray-500 hover:text-indigo-600 rounded-full hover:bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default ChatHeader;