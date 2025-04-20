import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '../../contexts/CallContext';
import { 
  FaPhone as PhoneIcon, 
  FaPhoneSlash as PhoneXMarkIcon,
  FaMicrophone as MicrophoneIcon,
  FaMicrophoneSlash as MicrophoneOffIcon,
  FaVideo as VideoCameraIcon,
  FaVideoSlash as VideoCameraOffIcon,
  FaTimes as XIcon
} from 'react-icons/fa';

const CallInterface = () => {
  const { 
    activeCall, 
    localStream, 
    remoteStream,
    isMuted,
    isVideoOff,
    endCall,
    toggleMute,
    toggleVideo
  } = useCall();
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (!remoteStream) return;
    
    try {
      // Tạo một AudioContext mới
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Kết nối trực tiếp remoteStream với AudioContext
      const sourceNode = audioCtx.createMediaStreamSource(remoteStream);
      sourceNode.connect(audioCtx.destination);
      
      console.log('Đã kết nối remoteStream trực tiếp với AudioContext');
      
      return () => {
        // Cleanup khi unmount
        sourceNode.disconnect();
      };
    } catch (e) {
      console.error('Lỗi khi kết nối stream với AudioContext:', e);
    }
  }, [remoteStream]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      
      // Quan trọng: thử phát audio ngay khi có remote stream
      const playPromise = remoteAudioRef.current.play();
      if (playPromise) {
        playPromise.catch(error => {
          console.error('Lỗi khi phát audio tự động:', error);
          
          // // Hiển thị nút để người dùng click
          // // Nhiều trình duyệt yêu cầu tương tác từ người dùng trước khi phát audio
          //    setShowPlayButton(true);
        });
      }
    }
  }, [remoteStream]);
  
  // Gắn streams vào video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    
    if (remoteStream) {
      // Thử cách 1: sử dụng ref
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        
        // Thử phát và bắt lỗi
        remoteAudioRef.current.play().catch(e => {
          console.error('Lỗi khi phát audio:', e);
        });
      }
      
      // Thử cách 2: tạo element mới qua Javascript
      const audioElement = document.getElementById('fallbackAudio');
      if (audioElement) {
        audioElement.srcObject = remoteStream;
        audioElement.play().catch(e => {
          console.error('Fallback audio cũng lỗi:', e);
        });
      }
      
      // Thử cách 3: tạo element hoàn toàn mới
      const newAudio = new Audio();
      newAudio.srcObject = remoteStream;
      newAudio.autoplay = true;
      document.body.appendChild(newAudio);
      
      // Cleanup khi unmount
      return () => {
        if (newAudio.parentNode) {
          document.body.removeChild(newAudio);
        }
      };
    }
  }, [localStream, remoteStream]);

  const playTestSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(360, audioCtx.currentTime); // 440 Hz
      oscillator.connect(audioCtx.destination);
      oscillator.start();
      setTimeout(() => oscillator.stop(), 500); // Dừng sau 0.5 giây
    } catch (e) {
      console.error('Lỗi khi phát âm kiểm tra:', e);
    }
  };
  
  // Không hiển thị gì nếu không có cuộc gọi hoạt động
  if (!activeCall) return null;
  
  const isVideoCall = activeCall.callType === 'VIDEO';
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      <audio 
        ref={remoteAudioRef} 
        autoPlay 
        playsInline 
        className="hidden" // ẩn đi nhưng vẫn phát âm thanh
      />
      <audio 
        id="fallbackAudio" 
        autoPlay 
        playsInline 
        className="hidden" 
      />
      {/* Main video area */}
      <div className="flex-1 relative">
        {/* Remote video (fullscreen) */}
        {isVideoCall && remoteStream ? (
          <video
            ref={remoteVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <div className="h-24 w-24 rounded-full bg-gray-700 mx-auto flex items-center justify-center">
                <span className="text-4xl text-white">
                  {activeCall.receiverName?.[0] || activeCall.callerName?.[0] || '?'}
                </span>
              </div>
              <p className="mt-4 text-xl text-white">
                {activeCall.status === 'CONNECTING' ? 'Đang kết nối...' : 'Đang trong cuộc gọi'}
              </p>
            </div>
          </div>
        )}
        
        {/* Local video (picture-in-picture) */}
        {isVideoCall && localStream && !isVideoOff && (
          <div className="absolute bottom-4 right-4 w-1/4 max-w-xs rounded-lg overflow-hidden border-2 border-white shadow-lg">
            <video
              ref={localVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="bg-gray-900 p-4 flex justify-center space-x-6">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-700'} text-white`}
        >
          {isMuted ? (
            <MicrophoneOffIcon className="h-6 w-6" />
          ) : (
            <MicrophoneIcon className="h-6 w-6" />
          )}
        </button>
        
        <button
          onClick={endCall}
          onClickCapture={playTestSound}
          className="p-4 rounded-full bg-red-600 text-white"
        >
          <PhoneXMarkIcon className="h-6 w-6" />
        </button>
        
        {isVideoCall && (
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-gray-700'} text-white`}
          >
            {isVideoOff ? (
              <VideoCameraOffIcon className="h-6 w-6" />
            ) : (
              <VideoCameraIcon className="h-6 w-6" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default CallInterface;