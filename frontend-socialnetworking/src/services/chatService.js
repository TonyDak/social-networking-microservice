import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { applyAuthInterceptor } from './authService';
import { apiPrivateClient } from './apiClient';

// Địa chỉ cơ sở và WebSocket của dịch vụ chat
const WS_URL = import.meta.env.VITE_WS_URL + `/ws`;
const BASE_URL = import.meta.env.VITE_API_URL + `/chat`;

const chatClient = apiPrivateClient(BASE_URL);

/**
 * Lớp ChatService - Quản lý tất cả giao tiếp giữa frontend và backend chat service
 * Bao gồm: kết nối WebSocket, đăng ký nhận tin nhắn, gửi tin nhắn, API REST
 */
class ChatService {
  constructor() {
    this.connected = false;
    this.stompClient = null;
    this.subscriptions = new Map();
    this.messageCallbacks = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    window.addEventListener('beforeunload', this.handleWindowClose.bind(this));
  }

  /**
   * Kết nối đến máy chủ WebSocket
   * @param {string} token - JWT token xác thực
   * @param {string} userId - ID của người dùng đang đăng nhập
   * @param {function} onConnected - Callback khi kết nối thành công
   * @param {function} onError - Callback khi gặp lỗi kết nối
   */
  connect(token, userId, onConnected, onError) {
    // Đảm bảo ngắt kết nối cũ trước
    this.disconnect();
    
    console.log(`Connecting to WebSocket as user ${userId}`);
    applyAuthInterceptor(chatClient);
    
    // Lưu thông tin xác thực để sử dụng khi kết nối lại
    this.authToken = token;
    this.currentUserId = userId;
    this.connectedCallback = onConnected;
    this.errorCallback = onError;

    this.setOnlineUserStatus(userId).catch(error => {
      console.warn('Failed to set online status:', error);
    });
    
    try {
      // Tạo Client STOMP với factory function
      this.stompClient = new Client({
        // Factory function để tạo WebSocket
        webSocketFactory: () => {
          console.log(`Creating SockJS connection to ${WS_URL}`);
          return new SockJS(WS_URL);
        },
        
        // QUAN TRỌNG: Định dạng header đúng
        connectHeaders: { 
          'Authorization': `Bearer ${token}`,
          'X-User-Id': userId
        },
        
        // Bật debug để theo dõi
        debug: (str) => {
          //console.log(`STOMP Debug: ${str}`);
        },
        
        // Tăng timeout kết nối
        connectTimeout: 30000,
        
        // QUAN TRỌNG: Giảm tần suất tự kết nối lại để tránh vòng lặp
        reconnectDelay: 5000,
        
        // QUAN TRỌNG: Giới hạn số lần thử kết nối lại
        maxReceivedFrameSize: 16384, // 16KB
        maxWebSocketFrameSize: 16384, // 16KB
        
        // QUAN TRỌNG: Khớp với cấu hình heartbeat của server
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        
        // Xử lý sự kiện kết nối thành công
        onConnect: (frame) => {
          console.log('Kết nối STOMP thành công', frame);
          this.reconnectAttempts = 0;
          this.connected = true;
          
          setTimeout(() => {
            try {
              // Đăng ký nhận tin nhắn cá nhân
              this.subscribeToPrivateMessages(userId, (message) => {
                if (this.messageCallbacks.has('private')) {
                  this.messageCallbacks.get('private')(message);
                }
                
              });
              // Bắt đầu gửi ping để giữ kết nối
              this.startPing();
              
              if (this.connectedCallback) {
                this.connectedCallback();
              }
            } catch (error) {
              console.error('Lỗi khi đăng ký nhận tin nhắn:', error);
              if (this.errorCallback) {
                this.errorCallback(error.message);
              }
            }
          }, 1000);
        },
        
        // Xử lý sự kiện lỗi
        onStompError: (frame) => {
          //console.error('Lỗi STOMP:', frame);
          let errorMsg = frame.headers['message'] || 'Unknown STOMP error';
          
          // Xử lý các lỗi OAuth2 cụ thể
          if (errorMsg.includes('token')) {
            errorMsg = 'Lỗi xác thực: Token không hợp lệ hoặc đã hết hạn';
          } else if (errorMsg.includes('scope')) {
            errorMsg = 'Lỗi quyền truy cập: Token không có quyền truy cập WebSocket';
          }
          
          if (this.errorCallback) {
            this.errorCallback(errorMsg);
          }
        },
        
        // QUAN TRỌNG: Xử lý mất kết nối
        onWebSocketClose: (event) => {
          console.log(`Kết nối WebSocket bị đóng: ${event.code} - ${event.reason}`);
          this.connected = false;
          
          if (event.code === 1008) { // Policy Violation thường liên quan đến xác thực
            console.error('Lỗi xác thực OAuth2: Kết nối bị từ chối');
            if (this.errorCallback) {
              this.errorCallback('Lỗi xác thực: Token không hợp lệ hoặc đã hết hạn');
            }
          }
        },
        
        // Thêm handler để xử lý WebSocket error
        onWebSocketError: (event) => {
          console.error('WebSocket Error:', event);
        }
      });
      
      console.log('Kích hoạt kết nối STOMP...');
      this.stompClient.activate();
      
    } catch (error) {
      console.error('Lỗi khởi tạo kết nối WebSocket:', error);
      if (this.errorCallback) {
        this.errorCallback(error.message);
      }
    }
  }

  // Thêm method xử lý khi đóng cửa sổ
  handleWindowClose() {
    if (this.connected && this.currentUserId) {
      // Gửi beacon API để đảm bảo request được gửi ngay cả khi trang đang đóng
      const url = `${BASE_URL}/offline/${this.currentUserId}`;
      const headers = {
        type: 'application/json',
        Authorization: `Bearer ${this.authToken}`
      };
      
      navigator.sendBeacon(url, JSON.stringify({}), headers);
      console.log('Sent offline status beacon before unload');
    }
  }

  /**
   * Ngắt kết nối WebSocket
   */
  disconnect() {
    console.log('Đang ngắt kết nối WebSocket...');

    // Xóa event listener khi không cần thiết nữa
    window.removeEventListener('beforeunload', this.handleWindowClose.bind(this));

    // Gọi API set trạng thái offline trước khi ngắt kết nối
    if (this.currentUserId) {
      this.setOfflineUserStatus(this.currentUserId).catch(error => {
        console.warn('Failed to set offline status:', error);
      });
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.stompClient) {
      // Đóng các subscription
      if (this.subscriptions) {
        this.subscriptions.forEach(subscription => {
          try {
            if (subscription && subscription.unsubscribe) {
              subscription.unsubscribe();
            }
          } catch (e) {
            console.warn('Error unsubscribing:', e);
          }
        });
        this.subscriptions.clear();
      }
      
      // QUAN TRỌNG: Sử dụng deactivate thay vì disconnect
      if (this.stompClient.connected) {
        try {
          // Thay vì gọi disconnect() trực tiếp, sử dụng deactivate()
          this.stompClient.deactivate();
          console.log('STOMP client deactivated');
        } catch (e) {
          console.warn('Error during deactivation:', e);
        }
      }
    }
    
    this.connected = false;
    this.stompClient = null;
  }


  /**
   * Xử lý kết nối lại tự động
   * Sử dụng cơ chế backoff tăng dần (cách quãng thời gian thử lại tăng dần)
   */
  handleReconnect() {
    if (this.reconnectAttempts < 5) {
      this.reconnectAttempts++;
      const delay = this.reconnectAttempts * 2000; // Tăng thời gian chờ theo số lần thử
      
      this.reconnectTimeout = setTimeout(() => {
        console.log(`Đang thử kết nối lại (${this.reconnectAttempts}/5)...`);
        // Cần lấy token và userId từ bên ngoài - thường từ localStorage
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');
        if (token && userId) {
          this.connect(token, userId);
        }
      }, delay);
    }
  }

  /**
   * Đăng ký nhận tin nhắn cá nhân
   * @param {string} userId - ID người dùng cần nhận tin nhắn
   * @param {function} callback - Hàm xử lý khi có tin nhắn đến
   * @returns {boolean} - Trạng thái đăng ký thành công hay không
   */
  subscribeToPrivateMessages(userId, callback) {
    if (!this.connected || !this.stompClient) {
      console.error('WebSocket chưa kết nối hoặc stompClient chưa sẵn sàng');
      return false;
    }
    
    try {
      // Thêm log id người dùng để xác nhận
      console.log(`Đang đăng ký kênh cho userId: ${userId}`);
      
      // ĐẢM BẢO DESTINATION ĐÚNG HOÀN TOÀN với cấu hình backend
      // STOMP/Spring WebSocket destination có định dạng:
      const destination = `/user/${userId}/queue/messages`;
      
      console.log(`Đăng ký kênh: ${destination}`);
      
      // Thêm debug headers
      const headers = {
        'Authorization': `Bearer ${this.authToken}`,
        'X-User-Id': userId,
      };
      
      // ĐẢM BẢO ĐÃ XÓA SUBSCRIPTION CŨ TRƯỚC KHI TẠO MỚI
      if (this.subscriptions.has(destination)) {
        const oldSub = this.subscriptions.get(destination);
        if (oldSub && oldSub.unsubscribe) {
          console.log(`Hủy đăng ký kênh cũ: ${destination}`);
          oldSub.unsubscribe();
        }
        this.subscriptions.delete(destination);
      }
      
      // Đăng ký với thêm debug
      const subscription = this.stompClient.subscribe(destination, (message) => {
        console.log(`===== NHẬN TIN NHẮN WEBSOCKET =====`);
        try {
          const messageData = JSON.parse(message.body);
          callback(messageData);
        } catch (e) {
          console.error('Lỗi khi xử lý tin nhắn:', e);
        }
      }, headers);
      
      this.subscriptions.set(destination, subscription);
      console.log(`Đã đăng ký thành công kênh ${destination}, ID subscription: ${subscription.id}`);
      
      return subscription;
    } catch (e) {
      console.error(`Lỗi khi đăng ký kênh nhận tin nhắn cá nhân:`, e);
      return false;
    }
  }


  /**
 * Đăng ký nhận tin nhắn nhóm
 * @param {string} conversationId - ID của cuộc trò chuyện nhóm
 * @param {function} callback - Hàm xử lý khi có tin nhắn đến
 * @returns {Object|boolean} - Subscription object hoặc false nếu thất bại
 */
  subscribeToGroupMessages(conversationId, callback) {
    if (!this.connected || !this.stompClient) {
      console.error('WebSocket chưa kết nối hoặc stompClient chưa sẵn sàng');
      return false;
    }
    
    try {
      console.log(`Đang đăng ký kênh nhóm cho conversationId: ${conversationId}`);
      
      // Đảm bảo destination đúng với cấu hình backend
      const destination = `/topic/group/${conversationId}`;
      
      console.log(`Đăng ký kênh nhóm: ${destination}`);
      
      // Thêm debug headers
      const headers = {
        'Authorization': `Bearer ${this.authToken}`,
        'X-User-Id': this.currentUserId,
        'X-Group-Id': conversationId
      };
      
      // Đảm bảo đã xóa subscription cũ trước khi tạo mới
      if (this.subscriptions.has(destination)) {
        const oldSub = this.subscriptions.get(destination);
        if (oldSub && oldSub.unsubscribe) {
          console.log(`Hủy đăng ký kênh nhóm cũ: ${destination}`);
          oldSub.unsubscribe();
        }
        this.subscriptions.delete(destination);
      }
      
      // Đăng ký với thêm debug
      const subscription = this.stompClient.subscribe(destination, (message) => {
        console.log(`===== NHẬN TIN NHẮN NHÓM WEBSOCKET (${conversationId}) =====`);
        try {
          const messageData = JSON.parse(message.body);
          callback(messageData);

          // Chỉ broadcast nếu callback khác với messageCallbacks.get('group')
          if (this.messageCallbacks.has('group') && callback !== this.messageCallbacks.get('group')) {
            this.messageCallbacks.get('group')(messageData);
          }
        } catch (e) {
          console.error('Lỗi khi xử lý tin nhắn nhóm:', e);
        }
      }, headers);
      
      this.subscriptions.set(destination, subscription);
      console.log(`Đã đăng ký thành công kênh nhóm ${destination}, ID subscription: ${subscription.id}`);
      
      return subscription;
    } catch (e) {
      console.error(`Lỗi khi đăng ký kênh nhận tin nhắn nhóm:`, e);
      return false;
    }
  }

  /**
 * Lấy danh sách người tham gia trong nhóm
 * @param {string} conversationId - ID cuộc trò chuyện nhóm
 * @returns {Promise<Array>} - Danh sách người tham gia
 */
  async getGroupParticipants(conversationId) {
    const response = await chatClient.get(`/group/${conversationId}/members`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`
      }
    });
    return response.data;
  }

  /**
   * Đăng ký callback cho các loại tin nhắn
   * @param {string} topic - Loại tin nhắn (private, group, etc.)
   * @param {function} callback - Hàm xử lý
   */
  onMessage(topic, callback) {
    if (!this.messageCallbacks) {
        this.messageCallbacks = new Map();
    }
    
    console.log(`Đăng ký nhận tin nhắn ${topic}`);
    this.messageCallbacks.set(topic, callback);
    
    // Nếu đang kết nối, đảm bảo đăng ký đúng cách
    if (this.stompClient && this.connected) {
        if (topic === 'group') {
            // Đảm bảo đã subscribe vào destination đúng
            this.subscribeToGroupMessages();
        }
    }
  }


  /**
   * Bắt đầu gửi ping định kỳ để giữ kết nối
   * Ngăn ngừa timeout từ server hoặc firewall
   */
  startPing() {
    let failedPings = 0;
    const MAX_FAILED_PINGS = 3;
    // Gửi ping mỗi 30 giây
    this.pingInterval = setInterval(async () => {
      if (this.connected) {
        try {
          // Đặt timeout 5 giây cho ping HTTP
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          // Gửi HTTP ping với timeout
          await chatClient.post(`/ping/${this.currentUserId}`, {}, {
            headers: {
              Authorization: `Bearer ${this.authToken}`
            },
            signal: controller.signal
          });
          
          // Hủy timeout nếu request thành công
          clearTimeout(timeoutId);
          
          // Gửi STOMP ping
          this.stompClient.publish({
            destination: '/app/ping',
            body: JSON.stringify({ timestamp: new Date().toISOString() })
          });
          
          // Reset số lần ping thất bại nếu thành công
          failedPings = 0;
        } catch (error) {
          // Tăng số lần ping thất bại
          failedPings++;
          
          console.warn(`Lỗi khi gửi ping (${failedPings}/${MAX_FAILED_PINGS}):`, 
                      error.name === 'AbortError' ? 'Request timeout' : error.message);
          
          // Nếu vượt quá số lần ping thất bại cho phép, thử kết nối lại
          if (failedPings >= MAX_FAILED_PINGS) {
            console.error(`Vượt quá ${MAX_FAILED_PINGS} lần ping thất bại, đang thử kết nối lại...`);
            
            // Đặt connected = false để tránh gửi ping tiếp
            this.connected = false;
            
            // Xóa interval hiện tại
            clearInterval(this.pingInterval);
            this.pingInterval = null;
            
            // Thử kết nối lại
            this.handleReconnect();
          }
        }
      }
    }, 30000);
  }

  /**
 * Gửi tin nhắn đến một người dùng cụ thể
 * @param {string} receiverId - ID người nhận
 * @param {string} content - Nội dung tin nhắn
 * @returns {Promise<Object>} - Thông tin tin nhắn đã gửi
 */
async sendPrivateMessage(receiverId, content, options = {}) {
  if (!this.connected || !this.currentUserId) {
    throw new Error('Chưa kết nối đến máy chủ chat');
  }
  
  try {
    const destination = `/app/chat.private.${receiverId}`;
    const message = {
      senderId: this.currentUserId,
      receiverId: receiverId,
      content: content,
      timestamp: new Date().toISOString(),
      type: options.type || 'text', // Sửa: gửi đúng type
      fileName: options.fileName    // Sửa: gửi fileName nếu có
    };
    
    this.stompClient.publish({
      destination: destination,
      body: JSON.stringify(message),
      headers: { 
        'content-type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
        'X-User-Id': this.currentUserId
      }
    });
    
    console.log(`Đã gửi tin nhắn đến ${receiverId}:`, message);
    return message;
  } catch (error) {
    console.error('Lỗi khi gửi tin nhắn:', error);
    throw error;
  }
}

/**
 * Gửi tin nhắn đến một nhóm
 * @param {string} conversationId - ID của cuộc trò chuyện nhóm
 * @param {string} content - Nội dung tin nhắn
 * @returns {Promise<Object>} - Thông tin tin nhắn đã gửi
 */
async sendGroupMessage(conversationId, content, options = {}) {
  if (!this.connected || !this.currentUserId) {
    throw new Error('Chưa kết nối đến máy chủ chat');
  }
  
  try {
    const destination = `/app/chat.group.${conversationId}`;
    const message = {
      senderId: this.currentUserId,
      conversationId: conversationId,
      content: content,
      timestamp: new Date().toISOString(),
      type: options.type || 'text', // Sửa: gửi đúng type
      fileName: options.fileName    // Sửa: gửi fileName nếu có
    };
    
    // Gửi qua websocket
    this.stompClient.publish({
      destination: destination,
      body: JSON.stringify(message),
      headers: { 
        'content-type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
        'X-User-Id': this.currentUserId
      }
    });
    
    console.log(`Đã gửi tin nhắn đến nhóm ${conversationId}:`, message);
    return message;
  } catch (error) {
    console.error('Lỗi khi gửi tin nhắn nhóm:', error);
    throw error;
  }
}

  /** 
   * ===== Các API REST =====
   * Tương tác với backend qua các API REST
   */

  /**
   * Lấy tất cả cuộc trò chuyện của người dùng hiện tại
   * @returns {Promise<Array>} - Danh sách các cuộc trò chuyện
   */
  async getUserConversations() {
    const response = await chatClient.get(`/conversations`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`
      }
    });
    return response.data;
  }

  /**
   * Lấy tin nhắn của một cuộc trò chuyện cụ thể
   * @param {string} conversationId - ID cuộc trò chuyện
   * @returns {Promise<Array>} - Danh sách tin nhắn trong cuộc trò chuyện
   */
  async getConversationMessages(conversationId, page = 0, size = 20) {
    const response = await chatClient.get(`/messages/${conversationId}?page=${page}&size=${size}`,
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      }
    );
    return response.data;
  }

  /**
   * Lấy cuộc trò chuyện giữa hai người dùng
   * @param {string} userId1 - ID người dùng thứ nhất
   * @param {string} userId2 - ID người dùng thứ hai
   * @returns {Promise<Object>} - Thông tin cuộc trò chuyện
   */
  async getPrivateConversation(userId1, userId2) {
    const response = await chatClient.get(`/conversations/${userId1}/${userId2}`,
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      }
    );
    return response.data;
  }

  /**
   * Đánh dấu tất cả tin nhắn trong cuộc trò chuyện là đã đọc
   * @param {string} senderId - ID người gửi
   * @param {string} receiverId - ID người nhận
   * @returns {Promise<void>}
   */
  async markAllAsRead(senderId, receiverId) {
    await chatClient.put(`/conversations/${senderId}/${receiverId}/read`,
      {},
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      }
    );
  }

  /**
   * Đánh dấu một tin nhắn cụ thể là đã đọc
   * @param {string} messageId - ID tin nhắn
   * @returns {Promise<Object>} - Thông tin cập nhật
   */
  async markMessageAsRead(messageId) {
    const response = await chatClient.put(`/messages/${messageId}/read`,
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      }
    );

    return response.data;
  }

  /**
   * Lấy danh sách tin nhắn chưa đọc của người dùng
   * @param {string} userId - ID người dùng 
   * @returns {Promise<Array>} - Danh sách tin nhắn chưa đọc
   */
  async getUnreadMessages(userId) {
    const response = await chatClient.get(`/unread/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      }
    );
    return response.data;
  }

  /**
   * Lấy danh sách tin nhắn gần đây
   * @param {string} userId - ID người dùng
   * @param {number} limit - Số lượng tin nhắn tối đa
   * @returns {Promise<Array>} - Danh sách tin nhắn gần đây
   */
  async getRecentMessages(userId, limit = 20) {
    const response = await chatClient.get(`/recent/${userId}?limit=${limit}`);
    return response.data;
  }

  /**
   * Tạo cuộc trò chuyện nhóm mới
   * @param {string} name - Tên nhóm 
   * @param {Array<string>} participants - Danh sách ID người tham gia
   * @returns {Promise<Object>} - Thông tin cuộc trò chuyện nhóm đã tạo
   */
  async createGroupConversation(name, participants) {
    const response = await chatClient.post(`/group`, { name, participants },
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      }
    );
    return response.data;
  }

  /**
   * Lấy thông tin cuộc trò chuyện nhóm
   * @returns {Promise<Object>} - Thông tin cuộc trò chuyện nhóm
   */
  async getGroupConversation() {
    const response = await chatClient.get(`/conversations/group`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'X-User-Id': this.currentUserId
        }
      }
    );
    return response.data;
  }

  /**
   * Thêm thành viên vào nhóm
   * @param {string} conversationId - ID cuộc trò chuyện nhóm
   * @param {Array<string>} members - Danh sách ID người dùng cần thêm
   * @returns {Promise<Object>} - Thông tin cập nhật 
   */
  async addMembersToGroup(conversationId, members, fullName) {
    const response = await chatClient.post(`/${conversationId}/members`, { members, fullName },
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      }
    );
    return response.data;
  }

  /**
   * Xóa thành viên khỏi nhóm
   * @param {string} conversationId - ID cuộc trò chuyện nhóm
   * @param {string} memberId - ID thành viên cần xóa
   * @returns {Promise<Object>} - Thông tin cập nhật
   */
  async removeMemberFromGroup(conversationId, members, fullName) {
    const response = await chatClient.post(`/${conversationId}/remove_members`, { members, fullName },
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      }
    );
    return response.data;
  }

  /**
   * Tham gia vào một nhóm
   * @param {string} conversationId - ID cuộc trò chuyện nhóm
   * @returns {Promise<Object>} - Thông tin cập nhật
   */
  async joinGroup(conversationId) {
    const response = await chatClient.post(`/${conversationId}/join`,
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      });
    return response.data;
  }

  /**
   * Lấy trạng thái người dùng
   * @param {string} userId - ID người dùng
   * @returns {Promise<Object>} - Thông tin trạng thái người dùng
   */
  async getUserStatus(userId) {
    const response = await chatClient.post(`/user-status/${userId}`,{},
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      });
    return response.data;
  }

  /**
   * Cập nhật trạng thái online
   * @param {string} userId - ID người dùng
   * @returns {Promise<Object>} - Thông tin cập nhật
   */
  async setOnlineUserStatus(userId) {
    const response = await chatClient.post(`/online/${userId}`,{},
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      });
    return response.data;
  }

  /**
   * Cập nhật trạng thái offline thông qua API
   * @param {string} userId - ID người dùng
   * @returns {Promise<Object>} - Thông tin cập nhật
   */
  async setOfflineUserStatus(userId) {
    const response = await chatClient.post(`/offline/${userId}`, {},
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      });
    return response.data;
    }
    /**
   * Xóa nhóm chat đồng thời xóa các tin nhắn liên quan
   * @param {string} conversationId - ID của cuộc trò chuyện nhóm
   * @return {Promise<void>}
   */
  async deleteGroupChat(conversationId) {
    try {
      await chatClient.delete(`/${conversationId}/delete`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      });
      console.log(`Đã xóa nhóm chat với ID: ${conversationId}`);
    } catch (error) {
      console.error(`Lỗi khi xóa nhóm chat:`, error);
      throw error;
    }
  }
}


// Tạo instance duy nhất để sử dụng trong toàn ứng dụng
const chatService = new ChatService();
export default chatService;