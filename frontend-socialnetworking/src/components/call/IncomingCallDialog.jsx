import React from 'react';
import { useCall } from '../../contexts/CallContext';
import { FaPhone as PhoneIcon, FaVideo as VideoCameraIcon, FaTimes as XIcon } from 'react-icons/fa';
import { getUserbyKeycloakId } from '../../services/userService';
import { getCookie } from '../../services/apiClient';
import { useEffect, useState } from 'react';

const IncomingCallDialog = () => {
  const { incomingCall, acceptCall, rejectCall } = useCall();
  const token = getCookie('access_token');
  const [callerInfo, setCallerInfo] = useState(null);

  useEffect(() => {
    if (incomingCall && incomingCall.callerId) {
      // Gọi API và cập nhật state khi có kết quả
      getUserbyKeycloakId(token, incomingCall.callerId)
        .then(response => {
          console.log('Thông tin người gọi:', response.body);
          setCallerInfo(response.body);
        })
        .catch(error => {
          console.error('Lỗi khi lấy thông tin người gọi:', error);
        });
    }
  }, [incomingCall, token]);
  
  // Thêm log để debug
  console.log('IncomingCallDialog - incomingCall:', incomingCall);

  // Chỉ hiển thị khi có cuộc gọi đến
  if (!incomingCall) return null;

  const isVideoCall = incomingCall.callType === 'VIDEO';
  const callerName = callerInfo 
    ? `${callerInfo.firstName} ${callerInfo.lastName}` 
    : incomingCall.callerId;
  return (
    <div className="fixed inset-0 backdrop-brightness-20 transition-opacity flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-80">
        <div className="text-center mb-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
            {isVideoCall ? (
              <VideoCameraIcon className="h-8 w-8 text-blue-600" />
            ) : (
              <PhoneIcon className="h-8 w-8 text-blue-600" />
            )}
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {isVideoCall ? 'Cuộc gọi video đến' : 'Cuộc gọi đến'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            { callerName || 'Người gọi không xác định'}
          </p>
        </div>
        
        <div className="flex justify-center space-x-4">
          <button
            onClick={rejectCall}
            className="flex-1 py-2 px-4 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
          >
            <XIcon className="h-5 w-5 mr-1" />
            Từ chối
          </button>
          
          <button
            onClick={acceptCall}
            className="flex-1 py-2 px-4 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center"
          >
            {isVideoCall ? (
              <VideoCameraIcon className="h-5 w-5 mr-1" />
            ) : (
              <PhoneIcon className="h-5 w-5 mr-1" />
            )}
            Trả lời
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallDialog;