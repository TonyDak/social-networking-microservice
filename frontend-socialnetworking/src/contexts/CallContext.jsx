import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useUser } from './UserContext';
import chatService from '../services/chatService';
import { getCookie, apiPrivateClient } from '../services/apiClient';
import { toast } from 'react-toastify';
import 'webrtc-adapter';

const CallContext = createContext();

const BASE_URL = import.meta.env.VITE_API_URL + `/chat`;
const chatClient = apiPrivateClient(BASE_URL);


export const CallProvider = ({ children }) => {
  const { user } = useUser();
  const [callState, setCallState] = useState({
    incomingCall: null,
    activeCall: null,
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isVideoOff: false,
  });
  
  const peerConnection = useRef(null);
  
  useEffect(() => {
    console.log('useEffect đang chạy, kiểm tra điều kiện:', { user, connected: chatService.connected });
    
    // Nếu chưa đủ điều kiện, không đăng ký callback
    if (!user || !chatService.connected) {
      console.log('Không đủ điều kiện: user hoặc chatService.connected không tồn tại');
      return;
    }
    
    console.log('Đăng ký callbacks xử lý tin nhắn cuộc gọi');
    
    // Đăng ký callbacks cho tin nhắn cuộc gọi
    const callHandler = (message) => {
      console.log('Đã nhận tin nhắn cuộc gọi:', message);
      handleCallMessage(message);
    };
    
    const signalHandler = (message) => {
      console.log('Đã nhận tín hiệu WebRTC:', message);
      handleSignalMessage(message);
    };
    
    chatService.subscribeToCallNotifications(user.keycloakId, callHandler);
    chatService.subscribeToSignalChannel(user.keycloakId, signalHandler);
    
    return () => {
      console.log('Cleanup: Hủy đăng ký callbacks');
    };
  }, [user, chatService.connected]);
  
  const handleCallMessage = (message) => {
    console.log('Đang xử lý tin nhắn cuộc gọi, loại:', message.type);
    switch (message.type) {
      case 'incoming-call':
        console.log('Nhận cuộc gọi đến từ:', message.callerName || message.callerId);
      
        // Cập nhật state với incoming call
        setCallState(prev => {
          console.log('Cập nhật state với cuộc gọi đến:', message);
          return { ...prev, incomingCall: message };
        });
        // Phát âm thanh thông báo cuộc gọi đến nếu muốn
        //playRingtone();
        break;
      case 'call-accepted':
        setCallState(prev => ({
          ...prev,
          activeCall: {
            ...prev.activeCall,
            status: 'ONGOING'
          }
        }));
        
        // Để đảm bảo đủ thời gian cho state cập nhật, dùng timeout
        setTimeout(() => {
          console.log('Bắt đầu kết nối WebRTC sau khi cập nhật state');
          startCall(message.callId);
        }, 500);
        break;
      case 'call-rejected':
        // Xử lý khi cuộc gọi bị từ chối
        toast.info(`${message.receiverName || 'Người dùng'} đã từ chối cuộc gọi.`);
        setCallState(prev => ({ ...prev, activeCall: null }));
        break;
      case 'call-ended':
        // Kết thúc cuộc gọi
        endCall();
        break;
      default:
        console.log('Loại tin nhắn cuộc gọi không xác định:', message.type);
    }
  };
  
  const handleSignalMessage = async (signal) => {
    if (!peerConnection.current) return;
    
    try {
      if (signal.type === 'offer') {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal.payload));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        sendSignal({
          type: 'answer',
          callId: signal.callId,
          from: user.keycloakId,
          to: signal.from,
          payload: answer
        });
      } else if (signal.type === 'answer') {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal.payload));
      } else if (signal.type === 'ice-candidate' && signal.payload) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(signal.payload));
      }
    } catch (error) {
      console.error('Lỗi xử lý tín hiệu WebRTC:', error);
    }
  };
  
  const initiateCall = async (receiverId, callType) => {
    try {
      const token = getCookie('access_token');
      const response = await chatClient.post('/calls/initiate',
        {
          receiverId,
          callType
        },{
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = response.data;
      
      if (data) {
        console.log('Cuộc gọi đã được khởi tạo:', data);
        const callSession = await data;
        setCallState(prev => ({ ...prev, activeCall: callSession }));
        
        // Thiết lập luồng media cục bộ
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'VIDEO'
        });
        setCallState(prev => ({ ...prev, localStream: stream }));
        
        // Đợi người nhận chấp nhận cuộc gọi trước khi tạo kết nối ngang hàng
      } else {
        throw new Error('Không thể bắt đầu cuộc gọi');
      }
    } catch (error) {
      console.error('Lỗi khi bắt đầu cuộc gọi:', error);
    }
  };
  
  const startCall = async (callId) => {
    try {
      console.log('Bắt đầu cuộc gọi, kiểm tra localStream:', callState.localStream);
      
      // Kiểm tra và tạo localStream nếu chưa có
      if (!callState.localStream) {
        console.log('localStream chưa có sẵn, cần tạo mới');
        
        // Lấy thông tin cuộc gọi (từ activeCall hoặc từ API nếu cần)
        const callType = callState.activeCall?.callType || 'AUDIO';
        
        // Tạo localStream mới
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'VIDEO'
          });
          
          console.log('Đã tạo luồng media mới:', stream);
          
          // Cập nhật state
          setCallState(prev => ({ ...prev, localStream: stream }));
          
          // QUAN TRỌNG: Vì setState là bất đồng bộ, phải sử dụng stream vừa tạo
          // thay vì callState.localStream
          setupPeerConnection(callId, stream);
          return; // Thoát khỏi hàm hiện tại - setupPeerConnection sẽ tiếp tục xử lý
        } catch (error) {
          console.error('Không thể tạo luồng media:', error);
          toast.error('Không thể truy cập camera/microphone');
          return;
        }
      }
      
      // Nếu đã có localStream, tiếp tục bình thường
      setupPeerConnection(callId, callState.localStream);
    } catch (error) {
      console.error('Lỗi khi bắt đầu cuộc gọi WebRTC:', error);
    }
  };
  
  // Tách logic thiết lập kết nối thành hàm riêng để sử dụng trực tiếp stream
  const setupPeerConnection = (callId, stream) => {
    try {
      // Thiết lập kết nối WebRTC
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          // Thêm free TURN server từ Google
          {
            urls: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com'
          }
        ],
        sdpSemantics: 'unified-plan',
        // Mở rộng giới hạn băng thông cho audio
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceTransportPolicy: 'all'
      });
      peerConnection.current = pc;
      
      // Thêm các track từ luồng đã xác nhận vào kết nối
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      // Xử lý ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const activeCall = callState.activeCall;
          sendSignal({
            type: 'ice-candidate',
            callId: activeCall.callId,
            from: user.keycloakId,
            to: activeCall.callerId === user.keycloakId ? activeCall.receiverId : activeCall.callerId,
            payload: event.candidate
          });
        }
      };
      
      // Xử lý luồng từ xa
      pc.ontrack = (event) => {
        console.log('Nhận remote tracks:', event.streams);
        const remoteStream = event.streams[0];
        
        // Kiểm tra chi tiết audio tracks
        const audioTracks = remoteStream.getAudioTracks();
        console.log(`Số lượng audio tracks: ${audioTracks.length}`);
        
        if (audioTracks.length > 0) {
          // Đảm bảo audio tracks được bật
          audioTracks.forEach(track => {
            console.log(`Audio track: ${track.label}, enabled: ${track.enabled}`);
            track.enabled = true;
          });
        } else {
          console.error('KHÔNG TÌM THẤY AUDIO TRACKS trong remote stream!');
        }
        
        setCallState(prev => ({ ...prev, remoteStream }));
      };  

      const modifySdp = (sdp) => {
        // Ưu tiên audio codec
        let lines = sdp.split('\r\n');
        let audioIndex = lines.findIndex(line => line.includes('m=audio'));
        
        if (audioIndex !== -1) {
          // Thêm dòng để ưu tiên độ ưu tiên audio
          lines.splice(audioIndex + 1, 0, 'a=mid:audio');
          lines.splice(audioIndex + 2, 0, 'a=priority:high');
        }
        
        return lines.join('\r\n');
      };
      
      // Tạo và gửi offer nếu chúng ta là người gọi
      const activeCall = callState.activeCall;
      if (activeCall && activeCall.callerId === user.keycloakId) {
        pc.createOffer()
        .then(offer => {
          // Sửa đổi SDP để ưu tiên audio
          const modifiedSdp = modifySdp(offer.sdp);
          offer.sdp = modifiedSdp;
          return pc.setLocalDescription(offer);
        })
        .then(() => {
          sendSignal({
            type: 'offer',
            callId: activeCall.callId,
            from: user.keycloakId,
            to: activeCall.receiverId,
            payload: pc.localDescription
          });
        });
      }
      pc.onconnectionstatechange = () => {
        console.log(`Trạng thái kết nối: ${pc.connectionState}`);
        
        if (pc.connectionState === 'connected') {
          console.log('🎉 WEBRTC ĐÃ KẾT NỐI THÀNH CÔNG!');
        } else if (pc.connectionState === 'failed') {
          console.error('⚠️ Kết nối WebRTC thất bại!');
          toast.error('Kết nối cuộc gọi thất bại, vui lòng thử lại');
        }
      };
      
      pc.oniceconnectionstatechange = () => {
        console.log(`Trạng thái kết nối ICE: ${pc.iceConnectionState}`);
      };
      
      pc.onicegatheringstatechange = () => {
        console.log(`Trạng thái thu thập ICE: ${pc.iceGatheringState}`);
      };
    } catch (error) {
      console.error('Lỗi khi thiết lập kết nối WebRTC:', error);
    }
  };
  
  const acceptCall = async () => {
    try {
      const { callId, callType } = callState.incomingCall;
      const token = getCookie('access_token');
      
      // Thiết lập luồng media cục bộ TRƯỚC KHI gọi API
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'VIDEO'
      });
      
      // Cập nhật state
      setCallState(prev => ({
        ...prev,
        localStream: stream,
        activeCall: {
          callId,
          callerId: callState.incomingCall.callerId,
          receiverId: user.keycloakId,
          callType,
          status: 'ONGOING'
        },
        incomingCall: null
      }));
      
      // Gọi API chấp nhận
      const response = await chatClient.post(`/calls/${callId}/accept`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Bắt đầu cuộc gọi sau khi đã chấp nhận API
      // Truyền trực tiếp stream đã tạo thay vì dùng từ state
      setTimeout(() => setupPeerConnection(callId, stream), 500);
    } catch (error) {
      console.error('Lỗi khi chấp nhận cuộc gọi:', error);
      toast.error('Không thể kết nối cuộc gọi');
    }
  };
  
  const rejectCall = async () => {
    try {
      const { callId } = callState.incomingCall;
      const token = getCookie('access_token');
      
      await chatClient.post(`/calls/${callId}/reject`,{}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setCallState(prev => ({ ...prev, incomingCall: null }));
    } catch (error) {
      console.error('Lỗi khi từ chối cuộc gọi:', error);
    }
  };
  
  const endCall = async () => {
    try {
      if (callState.activeCall) {
        const { callId } = callState.activeCall;
        const token = getCookie('access_token');
        
        await chatClient.post(`/calls/${callId}/end`, {},{
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
      
      // Giải phóng tài nguyên
      if (callState.localStream) {
        callState.localStream.getTracks().forEach(track => track.stop());
      }
      
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      
      setCallState({
        incomingCall: null,
        activeCall: null,
        localStream: null,
        remoteStream: null,
        isMuted: false,
        isVideoOff: false
      });
    } catch (error) {
      console.error('Lỗi khi kết thúc cuộc gọi:', error);
    }
  };
  
  const toggleMute = () => {
    if (callState.localStream) {
      const audioTracks = callState.localStream.getAudioTracks();
      
      if (audioTracks.length > 0) {
        // Đảm bảo logic đúng: nếu đang muted, thì bật lại (enabled = true)
        const newMuteState = !callState.isMuted;
        audioTracks.forEach(track => {
          track.enabled = !newMuteState; // enabled phải NGƯỢC với isMuted
        });
        
        console.log('Đã thay đổi trạng thái micro:', newMuteState ? 'Đã tắt' : 'Đã bật');
        setCallState(prev => ({ ...prev, isMuted: newMuteState }));
      } else {
        console.warn('Không tìm thấy audio tracks trong localStream');
      }
    } else {
      console.warn('LocalStream không tồn tại, không thể thay đổi trạng thái micro');
    }
  };
  
  const toggleVideo = () => {
    if (callState.localStream) {
      const videoTracks = callState.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = callState.isVideoOff;
      });
      setCallState(prev => ({ ...prev, isVideoOff: !prev.isVideoOff }));
    }
  };
  
  const sendSignal = (signal) => {
    if (chatService.connected && chatService.stompClient) {
      chatService.stompClient.publish({
        destination: '/app/signal',
        body: JSON.stringify(signal)
      });
    }
  };

  const getUserStatus = async (userId) => {
    try {
      return await chatService.getUserStatus(userId);
    } catch (error) {
      console.error('Lỗi khi lấy trạng thái người dùng:', error);
      return 'UNKNOWN';
    }
  };
  
  return (
    <CallContext.Provider
      value={{
        ...callState,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        getUserStatus,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);