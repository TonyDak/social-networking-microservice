import React, { useState, useEffect } from 'react';
import { useCall } from '../../contexts/CallContext';
// Thay đổi import heroicons sang react-icons
import { FaPhone as PhoneIcon, FaVideo as VideoCameraIcon } from 'react-icons/fa';
import { toast } from 'react-toastify';

const CallButton = ({ recipientId, recipientName }) => {
  const { initiateCall, getUserStatus } = useCall();
  const [status, setStatus] = useState('UNKNOWN');
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch initial status and refresh periodically
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const userStatus = await getUserStatus(recipientId);
        setStatus(userStatus);
      } catch (error) {
        console.error('Error fetching user status:', error);
      }
    };
    
    checkUserStatus();
    
    // Refresh status every 30 seconds
    const intervalId = setInterval(checkUserStatus, 30000);
    
    return () => clearInterval(intervalId);
  }, [recipientId, getUserStatus]);
  
  const handleCallInitiate = async (callType) => {
    setIsLoading(true);
    try {
      // Check status right before initiating call
      const currentStatus = await getUserStatus(recipientId);
      
      if (currentStatus !== 'ONLINE') {
        toast.warning(`${recipientName} hiện đang không trực tuyến.`);
        return;
      }
      
      await initiateCall(recipientId, callType);
      // Call initiation was successful, now handled by CallContext
    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error(error.message || 'Không thể bắt đầu cuộc gọi. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Disable buttons if user is offline or we're still loading
  const isDisabled = status !== 'ONLINE' || isLoading;
  
  return (
    <div className="flex space-x-2">
      <button
        onClick={() => handleCallInitiate('AUDIO')}
        className={`p-2 rounded-full ${
          isDisabled 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-green-500 hover:bg-green-600'
        } text-white transition-colors`}
        title={status === 'ONLINE' ? "Audio Call" : `${recipientName} is ${status.toLowerCase()}`}
        disabled={isDisabled}
      >
        {isLoading ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
        </svg>
        ) : (
          <PhoneIcon className="h-5 w-5" />
        )}
      </button>
      
      <button
        onClick={() => handleCallInitiate('VIDEO')}
        className={`p-2 rounded-full ${
          isDisabled 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white transition-colors`}
        title={status === 'ONLINE' ? "Video Call" : `${recipientName} is ${status.toLowerCase()}`}
        disabled={isDisabled}
      >
        {isLoading ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            <path d="M14 6a2 2 0 012-2h2a2 2 0 012 2v8a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
          </svg>
        ) : (
          <VideoCameraIcon className="h-5 w-5" />
        )}
      </button>
    </div>
  );
};

export default CallButton;