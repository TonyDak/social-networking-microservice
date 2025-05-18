import { useState, useEffect, useRef } from "react";
import ConversationList from "../components/chat/ConversationList";
import ChatWindow from "../components/chat/ChatWindow";
import { useUser } from "../contexts/UserContext";
import chatService from "../services/chatService";
import { getUserbyKeycloakId } from "../services/userService";
import { getCookie } from "../services/apiClient";
import { toast } from 'react-toastify';

function ChatPage({ selectedUser, connected, websocketError }) {
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(websocketError);
  const [chatWindowUser, setChatWindowUser] = useState(null);
  const { user } = useUser();
  const token = getCookie("access_token");

  const currentGroupSubscription = useRef(null);
  const processedUserRef = useRef(null);
  const selectedConversationRef = useRef(selectedConversation);
  const messageHandlerRef = useRef(null);
  const chatWindowUserRef = useRef(null);
  const [messagePage, setMessagePage] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  const handleLoadMoreMessages = () => {
    if (loadingMessages || !hasMoreMessages) return Promise.resolve();
    setLoadingMessages(true);
    return new Promise(async (resolve) => {
      try {
        const nextPage = messagePage + 1;
        const moreMessages = await chatService.getConversationMessages(
          selectedConversation.id,
          nextPage,
          20
        );
        if (!moreMessages || moreMessages.length === 0) {
          setHasMoreMessages(false); // Không còn tin nhắn để load nữa
          setLoadingMessages(false);
          resolve();
          return;
        }
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const uniqueMore = moreMessages.filter((m) => !existingIds.has(m.id));
          return [...uniqueMore, ...prev];
        });
        setMessagePage(nextPage);
      } catch (error) {
        // handle error
      }
      setLoadingMessages(false);
      resolve();
    });
  };

  // Khi đổi conversation, reset page về 1
  useEffect(() => {
    setMessagePage(0);
    setHasMoreMessages(true);
  }, [selectedConversation]);

  // Xử lý WebSocket và nhận tin nhắn
  useEffect(() => {
    if (user && connected) {
      // Chỉ fetch conversations khi đã kết nối
      fetchConversations();

      // Đăng ký nhận tin nhắn cá nhân
      chatService.onMessage("private", (message) => {
        if (messageHandlerRef.current) {
          messageHandlerRef.current(message);
        }
      });

      // Đăng ký nhận tin nhắn nhóm GLOBAL (cho tất cả các nhóm)
      chatService.onMessage("group", (message) => {
        console.log("Received group message from global handler:", message);

        if (messageHandlerRef.current) {
          // Always process group messages for conversation list updates
          const enrichedMessage = {
            ...message,
            type: "GROUP",
            isGroup: true,
          };

          // CRITICAL FIX: ALWAYS update the conversation list for group messages
          // This guarantees that even when viewing other conversations, group messages update the list
          updateConversationWithNewMessage({
            ...enrichedMessage,
            _receivedAt: new Date().getTime(),
          });

          // Pass to global handler for UI updates
          messageHandlerRef.current(enrichedMessage);

          // Show notification if not viewing this conversation
          const isCurrentConversation =
            selectedConversationRef.current &&
            selectedConversationRef.current.type === "GROUP" &&
            String(selectedConversationRef.current.id) ===
              String(message.conversationId);

          if (!isCurrentConversation && message.senderId !== user.keycloakId) {
            try {
              if (Notification.permission === "granted") {
                new Notification(
                  `Tin nhắn mới trong ${message.groupName || "nhóm"}`,
                  {
                    body: message.content,
                    icon: "/favicon.ico",
                  }
                );
              }
            } catch (e) {
              console.log("Notification error:", e);
            }
          }
        }
      });
    }

    // CHỈ hủy subscription khi rời khỏi trang chat hoàn toàn
    return () => {
      chatService.messageCallbacks.delete("private");
      chatService.messageCallbacks.delete("group");

      // Hủy tất cả subscription cho các nhóm khi rời trang
      if (
        currentGroupSubscription.current &&
        typeof currentGroupSubscription.current.unsubscribe === "function"
      ) {
        currentGroupSubscription.current.unsubscribe();
      }
      currentGroupSubscription.current = null;
    };
  }, [user, connected]);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    messageHandlerRef.current = (message) => {
      const currentConv = selectedConversationRef.current;
      if (message) {
        let isCurrentConversation = false;

        // More accurate group message detection
        const isGroupMessage =
          message.type === "GROUP" || message.isGroup === true;
        const conversationId = String(message.conversationId || "");

        // Important message details for debugging
        console.log("Message handler received:", {
          id: message.id,
          conversationId,
          senderId: message.senderId,
          type: message.type,
          isGroup: message.isGroup,
          content: message.content,
        });

        // Determine if this message belongs to the currently selected conversation
        if (currentConv) {
          if (!isGroupMessage && currentConv.type === "ONE_TO_ONE") {
            // Logic for 1-1 message (unchanged)
            let otherUserId = null;
            if (selectedUser) {
              otherUserId = selectedUser.id;
            }
            if (!otherUserId) {
              otherUserId = currentConv.users.body.keycloakId;
            }
            isCurrentConversation =
              (message.senderId === otherUserId &&
                message.receiverId === user.keycloakId) ||
              (message.senderId === user.keycloakId &&
                message.receiverId === otherUserId);
          } else if (isGroupMessage && currentConv.type === "GROUP") {
            // Logic for group messages
            isCurrentConversation =
              String(message.conversationId) === String(currentConv.id);
            console.log(
              "Comparing group IDs:",
              message.conversationId,
              currentConv.id,
              isCurrentConversation
            );
          }

          // Only add to UI messages list if this is the current conversation
          if (isCurrentConversation) {
            const messageWithTimestamp = {
              ...message,
              _receivedAt: new Date().getTime(),
              _source: "globalHandler",
            };

            setMessages((prev) => {
              // Check for duplicate message
              const exists = isDuplicateMessage(messageWithTimestamp, prev);

              if (exists) {
                console.log(
                  "Message already exists in global handler, not adding again"
                );
                return prev;
              }

              console.log("Adding new message to UI from global handler");
              return [...prev, messageWithTimestamp];
            });

            // Mark message as read if it's the current conversation
            if (message.senderId !== user.keycloakId && message.id) {
              chatService
                .markMessageAsRead(message.id)
                .catch((err) =>
                  console.error("Error marking message as read:", err)
                );
            }
          }
        }

        // CRITICAL FIX: ALWAYS update conversation list for ALL messages
        // Even if the message is not for the current conversation
        // This ensures lastMessage is updated and notifications appear
        if (isGroupMessage) {
          updateConversationWithNewMessage({
            ...message,
            _receivedAt: new Date().getTime(),
            type: "GROUP",
            isGroup: true,
            conversationId,
          });
        } else {
          updateConversationWithNewMessage({
            ...message,
            _receivedAt: new Date().getTime(),
          });
        }

        // Show notification for messages not in current conversation
        if (!isCurrentConversation && message.senderId !== user.keycloakId) {
          console.log(
            "Showing notification for non-current conversation message"
          );
          try {
            if (Notification.permission === "granted") {
              new Notification(
                isGroupMessage
                  ? `Tin nhắn mới trong ${message.groupName || "nhóm"}`
                  : `Tin nhắn mới từ ${message.senderName || "Người dùng"}`,
                {
                  body: message.content,
                  icon: "/favicon.ico",
                }
              );
            }
          } catch (e) {
            console.log("Notification error:", e);
          }
        }
      }
    };
  }, [selectedConversation, user, selectedUser]);

  useEffect(() => {
    const handleSelectedUser = async () => {
      if (
        selectedUser &&
        user &&
        connected &&
        selectedUser.id !== processedUserRef.current
      ) {
        try {
          const conversations = await chatService.getUserConversations();
          processedUserRef.current = selectedUser.id; // Đánh dấu đã xử lý
          setLoadingMessages(true);

          // Tìm cuộc trò chuyện hiện có với người dùng này
          const existingConv = findExistingConversation(
            conversations,
            selectedUser?.id
          );
          console.log("Cuộc trò chuyện hiện có:", existingConv);

          if (existingConv) {
            // Nếu đã có cuộc trò chuyện, chọn nó
            console.log("Tìm thấy cuộc trò chuyện hiện có:", existingConv.id);
            handleSelectConversation(existingConv);
          } else {
            // QUAN TRỌNG: Đối với người dùng mới, tạo cuộc trò chuyện tạm thời
            // nhưng KHÔNG lưu vào danh sách conversations vì chưa có tin nhắn
            console.log("Tạo cuộc trò chuyện tạm thời với:", selectedUser.id);

            const tempConversation = {
              id: `temp_${Date.now()}`,
              type: "ONE_TO_ONE",
              participants: [user.keycloakId, selectedUser.id],
              participantDetails: selectedUser,
              lastMessage: null,
              lastMessageContent: null,
              lastActivity: new Date().toISOString(),
              isTemporary: true,
            };

            // Chỉ thiết lập selectedConversation, KHÔNG thêm vào conversations
            setSelectedConversation(tempConversation);
            setMessages([]); // Reset messages
          }

          setLoadingMessages(false);
        } catch (error) {
          console.error("Lỗi khi mở cuộc trò chuyện với người dùng:", error);
          setError("Không thể mở cuộc trò chuyện với người dùng đã chọn.");
          setLoadingMessages(false);
        }
      }
    };

    if (conversations.length > 0 || selectedUser) {
      // Chỉ xử lý khi danh sách cuộc trò chuyện đã được tải hoặc có selectedUser
      handleSelectedUser();
    }
  }, [selectedUser, user, connected, conversations]);

  useEffect(() => {
    if (websocketError) {
      setError(websocketError);
    }
  }, [websocketError]);

  // Tải danh sách cuộc trò chuyện
  const fetchConversations = async () => {
    try {
      setLoading(true);
      const data = await chatService.getUserConversations();
      console.log("Danh sách cuộc trò chuyện:", data);

      // Tạo một mảng để lưu các subscription để có thể quản lý họ
      const groupSubscriptions = [];

      data.forEach((conv) => {
        if (conv.type === "GROUP") {
          console.log(`Đăng ký nhận tin nhắn nhóm: ${conv.id}`);
          // Tạo subscription riêng cho TỪNG nhóm
          const subscription = chatService.subscribeToGroupMessages(
            conv.id,
            (groupMessage) => {
              console.log(
                "Received group message from subscription:",
                groupMessage
              );

              // Làm giàu message với dữ liệu nhóm để xử lý đúng
              const enrichedMessage = {
                ...groupMessage,
                type: "GROUP",
                isGroup: true,
                conversationId: conv.id,
                groupName: conv.name || "nhóm",
                _receivedAt: new Date().getTime(),
              };

              //LUÔN cập nhật danh sách cuộc trò chuyện bất kể đang xem hội thoại nào
              updateConversationWithNewMessage(enrichedMessage);

              // Hiển thị thông báo nếu không đang xem cuộc trò chuyện này
              const isCurrentConversation =
                selectedConversationRef.current &&
                selectedConversationRef.current.type === "GROUP" &&
                String(selectedConversationRef.current.id) === String(conv.id);

              if (
                !isCurrentConversation &&
                groupMessage.senderId !== user.keycloakId
              ) {
                try {
                  if (Notification.permission === "granted") {
                    new Notification(
                      `Tin nhắn mới trong ${conv.name || "nhóm"}`,
                      {
                        body: groupMessage.content,
                        icon: "/favicon.ico",
                      }
                    );
                  }
                } catch (e) {
                  console.log("Notification error:", e);
                }
              }

              // Cập nhật danh sách tin nhắn nếu đang xem nhóm này
              if (isCurrentConversation) {
                setMessages((prev) => {
                  // Kiểm tra trùng lặp
                  const exists = isDuplicateMessage(groupMessage, prev);
                  if (exists) {
                    return prev;
                  }
                  return [
                    ...prev,
                    {
                      ...groupMessage,
                      _receivedAt: new Date().getTime(),
                      _source: "subscription",
                    },
                  ];
                });
              }
            }
          );

          // Lưu subscription vào mảng
          groupSubscriptions.push(subscription);
        }
      });

      // Lưu danh sách subscription vào một ref để có thể dọn dẹp khi thoát trang
      currentGroupSubscription.current = {
        subscriptions: groupSubscriptions,
        unsubscribe: () => {
          groupSubscriptions.forEach((sub) => {
            if (typeof sub.unsubscribe === "function") {
              sub.unsubscribe();
            }
          });
        },
      };

      setConversations((prev) => {
        const filtered = prev.filter((conv) => {
          if (!conv.isTemporary) return true;
          return !data.some(
            (serverConv) =>
              serverConv.type === "ONE_TO_ONE" &&
              conv.type === "ONE_TO_ONE" &&
              serverConv.participants.length === conv.participants.length &&
              serverConv.participants.every(pid => conv.participants.includes(pid)) &&
              conv.participants.every(pid => serverConv.participants.includes(pid))
          );
        });
        return [...data, ...filtered];
      });
      setLoading(false);

      // Nếu có selectedUser, xử lý sau khi đã tải conversations
      if (
        selectedUser &&
        user &&
        selectedUser.id !== processedUserRef.current
      ) {
        const existingConv = findExistingConversation(data, selectedUser?.id);

        if (existingConv) {
          handleSelectConversation(existingConv);
        } else {
          // Không gọi handleCreateConversation nữa, chờ tin nhắn đầu tiên
          processedUserRef.current = selectedUser.id;
        }
      }
    } catch (error) {
      console.error("Không thể tải danh sách trò chuyện", error);
      setError("Không thể tải danh sách trò chuyện. Vui lòng thử lại sau.");
      setLoading(false);
    }
  };
  const findExistingConversation = (
    conversations,
    idOrGroupId,
    type = "ONE_TO_ONE"
  ) => {
    if (!idOrGroupId || !conversations || !Array.isArray(conversations))
      return null;
    const idStr = String(idOrGroupId);

    if (type === "GROUP") {
      return conversations.find(
        (conv) => conv.type === "GROUP" && String(conv.id) === idStr
      );
    }
    // Mặc định: tìm 1-1
    return conversations.find(
      (conv) =>
        conv.type === "ONE_TO_ONE" &&
        Array.isArray(conv.participants) &&
        conv.participants.length === 2 &&
        conv.participants.includes(user.keycloakId) &&
        conv.participants.includes(idStr)
    );
  };
  const enrichConversationWithUsers = async (conversation) => {
    try {
      if (!conversation) return conversation;

      // Nếu đã có thông tin users, không cần làm gì thêm
      if (conversation.users) return conversation;

      const token = getCookie("access_token");

      if (conversation.type === "GROUP") {
        // Xử lý nhóm
        try {
          const participantsInfo = await Promise.all(
            conversation.participants.map(async (participantId) => {
              try {
                const info = await getUserbyKeycloakId(token, participantId);
                return info && info.body
                  ? info
                  : {
                      body: {
                        firstName: "User",
                        lastName: `(${participantId.substring(0, 8)})`,
                      },
                    };
              } catch (err) {
                console.error(
                  `Error fetching participant ${participantId}:`,
                  err
                );
                return {
                  body: {
                    firstName: "User",
                    lastName: `(${participantId.substring(0, 8)})`,
                  },
                };
              }
            })
          );

          return {
            ...conversation,
            users: {
              isGroup: true,
              groupName: conversation.name || "Nhóm không tên",
              participants: participantsInfo.map((info) => info.body),
            },
          };
        } catch (error) {
          console.error("Error fetching group participants:", error);
          return {
            ...conversation,
            users: { groupName: "Nhóm không xác định" },
          };
        }
      } else if (conversation.type === "ONE_TO_ONE") {
        // Trong cuộc trò chuyện 1-1, lấy ID người kia
        const otherParticipantId = conversation.participants.find(
          (id) => id !== user.keycloakId
        );

        if (!otherParticipantId) {
          return {
            ...conversation,
            users: {
              body: { firstName: "Người dùng", lastName: "không xác định" },
            },
          };
        }

        try {
          const otherParticipant = await getUserbyKeycloakId(
            token,
            otherParticipantId
          );
          if (otherParticipant && otherParticipant.body) {
            return {
              ...conversation,
              users: otherParticipant,
            };
          }
        } catch (error) {
          console.error("Error fetching user:", error);
        }

        // Fallback
        return {
          ...conversation,
          users: {
            body: {
              firstName: "Người dùng",
              lastName: `(${otherParticipantId.substring(0, 8)})`,
            },
          },
        };
      }

      // Mặc định nếu không có thông tin
      return {
        ...conversation,
        users: {
          body: { firstName: "Cuộc trò chuyện", lastName: "không xác định" },
        },
      };
    } catch (error) {
      console.error("Error enriching conversation:", error);
      return conversation;
    }
  };
  // Cập nhật cuộc trò chuyện với tin nhắn mới
  const updateConversationWithNewMessage = (message) => {
    console.log("Updating conversation list with message:", message);

    // Skip temporary messages
    if (message._source === "localTemp") {
      console.log("Skipping conversation update for temporary message");
      return;
    }
    // CRITICAL FIX: Remove redundant state updates for group messages
    // The problem is that you're calling setConversations twice for group messages
    const isGroupMessage = message.type === "GROUP" || message.isGroup === true;
    const conversationId = String(message.conversationId || "");
    const senderId = String(message.senderId || "");
    const receiverId = String(message.receiverId || "");
    const myId = String(user.keycloakId || "");

    // Check if conversation is selected to determine unreadCount
    const isSelected =
      selectedConversationRef.current &&
      ((selectedConversationRef.current.type === "ONE_TO_ONE" &&
        (selectedConversationRef.current.participants || []).some(
          (id) => String(id) === senderId || String(id) === receiverId
        )) ||
        (selectedConversationRef.current.type === "GROUP" &&
          String(selectedConversationRef.current.id) === conversationId));

    // CONSOLIDATED APPROACH: Single state update for both group and private messages
    setConversations((prevConversations) => {
      // For group messages
      if (isGroupMessage && conversationId) {
        console.log(`Processing group message for group: ${conversationId}`);

        // Find existing group conversation
        const existingGroupIndex = prevConversations.findIndex(
          (conv) => conv.type === "GROUP" && String(conv.id) === conversationId
        );

        if (existingGroupIndex !== -1) {
          console.log(
            `Updating existing group conversation: ${conversationId}`
          );

          const updatedConversations = [...prevConversations];
          const currentConversation = updatedConversations[existingGroupIndex];

          // Only increase unreadCount if not sender's message and not currently selected
          const shouldIncreaseUnreadCount =
            message.senderId !== myId && !isSelected;

          updatedConversations[existingGroupIndex] = {
            ...currentConversation,
            lastMessage: message.content,
            lastMessageContent: message.content,
            lastMessageSender: message.senderName || "Người dùng",
            lastActivity: message.timestamp || new Date().toISOString(),
            unreadCount: shouldIncreaseUnreadCount
              ? (currentConversation.unreadCount || 0) + 1
              : isSelected
              ? 0
              : currentConversation.unreadCount || 0,
            _lastUpdated: new Date().getTime(), // For debugging
          };

          // ALWAYS move conversation to top
          const conversationToMove = updatedConversations.splice(
            existingGroupIndex,
            1
          )[0];
          return [conversationToMove, ...updatedConversations];
        } else {
          console.log(
            `Group conversation not found: ${conversationId}, refreshing list`
          );

          // Trigger a background refresh to get the updated group
          setTimeout(() => {
            chatService
              .getUserConversations()
              .then((freshConversations) => {
                const foundGroup = freshConversations.find(
                  (conv) =>
                    conv.type === "GROUP" && String(conv.id) === conversationId
                );

                if (foundGroup) {
                  console.log(
                    `Found group ${conversationId} in fresh conversations`
                  );

                  // Add updated group info
                  const updatedGroup = {
                    ...foundGroup,
                    lastMessage: message.content,
                    lastMessageContent: message.content,
                    lastActivity: message.timestamp || new Date().toISOString(),
                    unreadCount: message.senderId !== myId ? 1 : 0,
                  };

                  setConversations((prev) => {
                    // Check if group already exists now
                    const existingIndex = prev.findIndex(
                      (conv) =>
                        conv.type === "GROUP" &&
                        String(conv.id) === conversationId
                    );

                    if (existingIndex !== -1) {
                      // Update existing group
                      const updated = [...prev];
                      updated[existingIndex] = {
                        ...updated[existingIndex],
                        lastMessage: message.content,
                        lastMessageContent: message.content,
                        lastActivity:
                          message.timestamp || new Date().toISOString(),
                        unreadCount:
                          message.senderId !== myId
                            ? (updated[existingIndex].unreadCount || 0) + 1
                            : 0,
                      };

                      // Move to top
                      const toMove = updated.splice(existingIndex, 1)[0];
                      return [toMove, ...updated];
                    }

                    // Add as new
                    return [updatedGroup, ...prev];
                  });
                }
              })
              .catch((err) => {
                console.error("Error refreshing conversations:", err);
              });
          }, 100);

          return prevConversations;
        }
      }

      // Handle one-to-one messages
      if (!isGroupMessage) {
        console.log("Processing one-to-one message");

        // Find existing one-to-one conversation that includes both the sender and receiver
        // or includes the sender and current user, or includes the receiver and current user
        const existingConversationIndex = prevConversations.findIndex((conv) => {
          if (conv.type === "ONE_TO_ONE") {
            const participants = (conv.participants || []).map((id) => String(id));
            // Phải đúng 2 người và là đúng cặp sender-receiver (bất kể thứ tự)
            return (
              participants.length === 2 &&
              participants.includes(senderId) &&
              participants.includes(receiverId)
            );
          }
          return false;
        });

        if (existingConversationIndex !== -1) {
          console.log(
            "Updating existing one-to-one conversation:",
            prevConversations[existingConversationIndex].id
          );

          const updatedConversations = [...prevConversations];
          const currentConversation =
            updatedConversations[existingConversationIndex];

          // Only increase unreadCount if not sender's message and not currently selected
          const shouldIncreaseUnreadCount =
            message.senderId !== myId && !isSelected;

          updatedConversations[existingConversationIndex] = {
            ...currentConversation,
            lastMessage: message.content,
            lastMessageContent: message.content,
            lastActivity: message.timestamp || new Date().toISOString(),
            unreadCount: shouldIncreaseUnreadCount
              ? (currentConversation.unreadCount || 0) + 1
              : isSelected
              ? 0
              : currentConversation.unreadCount || 0,
            _lastUpdated: new Date().getTime(), // For debugging
          };

          // ALWAYS move conversation to top
          const conversationToMove = updatedConversations.splice(
            existingConversationIndex,
            1
          )[0];
          console.log("Moving conversation to top:", conversationToMove.id);
          return [conversationToMove, ...updatedConversations];
        }
        // If no existing conversation, but the message is from/to the current user,
        // we should create a new one or refresh to get the latest
        else if (senderId === myId || receiverId === myId) {
          // Không tìm thấy, tạo mới đúng cặp participants
          const newConv = {
            id: message.conversationId || `conv_${Date.now()}`,
            type: "ONE_TO_ONE",
            participants: [senderId, receiverId],
            lastMessage: message.content,
            lastMessageContent: message.content,
            lastActivity: message.timestamp || new Date().toISOString(),
            unreadCount: message.senderId !== myId ? 1 : 0,
          };
          return [newConv, ...prevConversations];
        }
      }

      // If no matching conversation was found and updated, return the original list
      return prevConversations;
    });
  };

  // Xử lý khi người dùng chọn một cuộc trò chuyện
  const handleSelectConversation = async (conversation) => {
    try {
      if (!conversation.users) {
        conversation = await enrichConversationWithUsers(conversation);
      }
      setSelectedConversation(conversation);
      setLoadingMessages(true);

      let messagesData = [];

      // Nếu là cuộc trò chuyện có sẵn (không phải tạm thời)
      if (conversation.id && !conversation.isTemporary) {
        // Lấy tin nhắn dựa vào conversationId
        messagesData = await chatService.getConversationMessages(
          conversation.id
        );

        // Đánh dấu tất cả tin nhắn đã đọc
        if (conversation.type === "ONE_TO_ONE") {
          const otherUserId = conversation.participants[0];
          await chatService.markAllAsRead(otherUserId, user.keycloakId);
        }
      }
      // Nếu là cuộc trò chuyện tạm (mới bắt đầu với người dùng)
      else if (conversation.type === "ONE_TO_ONE") {
        // Kiểm tra xem có tin nhắn cũ với người này không
        const otherUserId = conversation.participants.find(
          (id) => id !== user.keycloakId
        );
        try {
          messagesData = await chatService.getPrivateConversation(
            user.keycloakId,
            otherUserId
          );
        } catch (error) {
          console.error("Lỗi khi lấy tin nhắn cũ:", error);
          messagesData = [];
        }
      }

      // Đăng ký nhận tin nhắn mới nếu là group chat
      if (conversation.type === "GROUP" && connected) {
        console.log(`Đăng ký nhận tin nhắn nhóm: ${conversation.id}`);
        currentGroupSubscription.current = chatService.subscribeToGroupMessages(
          conversation.id,
          (groupMessage) => {
            console.log("Nhận tin nhắn nhóm qua subscription:", groupMessage);

            // Thêm kiểm tra trùng lặp ĐÚNG CÁCH
            setMessages((prev) => {
              // Sử dụng hàm chung để kiểm tra trùng lặp
              const exists = isDuplicateMessage(groupMessage, prev);

              if (exists) {
                console.log(
                  "Tin nhắn đã tồn tại trong subscription, không thêm lại"
                );
                return prev;
              }

              console.log("Thêm tin nhắn nhóm vào UI từ subscription");
              return [
                ...prev,
                {
                  ...groupMessage,
                  _receivedAt: new Date().getTime(),
                  _source: "subscription",
                },
              ];
            });
          }
        );
      }

      // Cập nhật messages state và scroll xuống
      setMessages(messagesData);

      // Lấy thông tin người dùng cho ChatWindow
      let chatUser = selectedUser;
      if (conversation.type === "ONE_TO_ONE" && conversation.users?.body) {
        const otherUserId = conversation.participants.find(
          (id) => id !== user.keycloakId
        );
        chatUser = {
          id: otherUserId,
          keycloakId: conversation.users.body.keycloakId,
          firstName: conversation.users.body.firstName,
          lastName: conversation.users.body.lastName,
          image: conversation.users.body.image,
        };
      } else if (conversation.type === "GROUP") {
        chatUser = {
          id: conversation.id,
          name:
            conversation.name ||
            conversation.users?.groupName ||
            "Nhóm không tên",
          isGroup: true,
          participants:
            conversation.users?.participants || conversation.participants || [],
        };
      }

      setConversations((prevConvs) => {
        return prevConvs.map((conv) => {
          if (
            (conv.type === "ONE_TO_ONE" &&
              conversation.type === "ONE_TO_ONE" &&
              conv.participants &&
              conversation.participants &&
              conv.participants.some((id) =>
                conversation.participants.includes(id)
              )) ||
            (conv.type === "GROUP" &&
              String(conv.id) === String(conversation.id))
          ) {
            // Reset unread count when selecting this conversation
            return {
              ...conv,
              unreadCount: 0,
            };
          }
          return conv;
        });
      });

      chatWindowUserRef.current = chatUser;
      setChatWindowUser(chatUser);
      setLoadingMessages(false);
    } catch (error) {
      console.error("Lỗi khi tải tin nhắn:", error);
      setError("Không thể tải tin nhắn. Vui lòng thử lại sau.");
      setLoadingMessages(false);
    }
  };

  // Xử lý gửi tin nhắn mới
  const handleSendMessage = async (messageData) => {
    try {
      const msgData =
        typeof messageData === "string"
          ? { content: messageData }
          : messageData;

      // Tạo uniqueId dùng cho việc theo dõi tin nhắn giữa các nguồn
      let uniqueId = `msg_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      let tempId = `temp-${Date.now()}`;

      if (!msgData.content || !selectedConversation) {
        console.error("Missing message content or selected conversation");
        return;
      }

      let receiverId = null;
      let tempMessage = null;
      if (selectedConversation.type === "GROUP") {
        // Tin nhắn nhóm
        tempMessage = {
          tempId,
          uniqueId,
          senderId: user.keycloakId,
          conversationId: selectedConversation.id,
          content: msgData.content,
          type: msgData.type || "text",      // Thêm type
          fileName: msgData.fileName,        // Thêm fileName nếu có
          timestamp: new Date().toISOString(),
          status: "SENDING",
          isGroup: true,
          _source: "localTemp",
        };
      } else {
        // Tin nhắn 1-1
        if (selectedUser) {
          receiverId = selectedUser.id;
        } else if (chatWindowUser && selectedConversation.users?.body) {
          receiverId = selectedConversation.users.body.keycloakId;
        }
        tempMessage = {
          tempId,
          uniqueId,
          senderId: user.keycloakId,
          receiverId,
          content: msgData.content,
          type: msgData.type || "text",      // Thêm type
          fileName: msgData.fileName,        // Thêm fileName nếu có
          timestamp: new Date().toISOString(),
          status: "SENDING",
          _source: "localTemp",
        };
      }

      // Cập nhật UI ngay lập tức (không đợi phản hồi server)
      setMessages((prev) => [...prev, tempMessage]);

      let sentMessage;

      // Gửi tin nhắn đến server
      if (selectedConversation.type === "GROUP") {
        sentMessage = await chatService.sendGroupMessage(
          selectedConversation.id,
          msgData.content,
          { uniqueId, type: msgData.type, fileName: msgData.fileName }
        );
      } else {
        // Gửi tin nhắn private
        sentMessage = await chatService.sendPrivateMessage(
          receiverId,
          msgData.content,
          { uniqueId, type: msgData.type, fileName: msgData.fileName }
        );
        updateConversationWithNewMessage({
          ...sentMessage,
          tempId: tempId,
        });
      }

      // Cập nhật UI với trạng thái đã gửi
      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === tempId || m.uniqueId === uniqueId
            ? {
                ...m,
                ...sentMessage,
                uniqueId, // Đảm bảo uniqueId được giữ lại
                status: "SENT",
                _source: "apiResponse",
              }
            : m
        )
      );
      setConversations((prevConvs) => {
        const updatedConvs = [...prevConvs];
        const convIndex = updatedConvs.findIndex((conv) => {
          if (selectedConversation.type === "GROUP") {
            return String(conv.id) === String(selectedConversation.id);
          } else {
            return (
              conv.type === "ONE_TO_ONE" &&
              conv.participants &&
              conv.participants.includes(receiverId)
            );
          }
        });

        if (convIndex !== -1) {
          updatedConvs[convIndex] = {
            ...updatedConvs[convIndex],
            lastMessage: msgData.content,
            lastMessageContent: msgData.content,
            lastActivity: new Date().toISOString(),
          };

          // Di chuyển conversation lên đầu
          const conversationToMove = updatedConvs.splice(convIndex, 1)[0];
          return [conversationToMove, ...updatedConvs];
        }

        return prevConvs;
      });
      // Xử lý cuộc trò chuyện tạm thời
      if (
        selectedConversation.isTemporary &&
        selectedConversation.type !== "GROUP"
      ) {
        try {
          // Tải lại danh sách hoặc tạo mới conversation nếu cần
          const updatedConversations = await chatService.getUserConversations();
          const newCreatedConv = updatedConversations.find(
            (conv) =>
              conv.type === "ONE_TO_ONE" &&
              conv.participants.some((id) => id === receiverId)
          );
          console.log("Cuộc trò chuyện mới:", newCreatedConv);
          if (newCreatedConv) {
            if (!newCreatedConv.lastMessage)
              newCreatedConv.lastMessage = msgData.content;
            if (!newCreatedConv.lastMessageContent)
              newCreatedConv.lastMessageContent = msgData.content;
            setConversations((prev) => {
              // Loại bỏ conversation tạm thời trùng participants
              const filtered = prev.filter((conv) => {
                if (!conv.isTemporary) return true;
                // So sánh participants
                if (
                  conv.type === "ONE_TO_ONE" &&
                  newCreatedConv.type === "ONE_TO_ONE"
                ) {
                  return !conv.participants.some((pid) =>
                    newCreatedConv.participants.includes(pid)
                  );
                }
                return true;
              });
              // Thêm conversation thật vào đầu
              return [newCreatedConv, ...filtered];
            });
            setSelectedConversation(newCreatedConv);
          } else {
            // Tạo mới nếu server không tự tạo
            const newConv = {
              id: sentMessage.conversationId || `conv_${Date.now()}`,
              type: "ONE_TO_ONE",
              participants: [user.keycloakId, receiverId],
              participantDetails: selectedConversation.users,
              lastMessage: msgData.content,
              lastActivity: new Date().toISOString(),
              unreadCount: 0,
            };

            setConversations((prev) => [newConv, ...prev]);
            setSelectedConversation(newConv);
          }
        } catch (error) {
          console.error("Lỗi khi cập nhật cuộc trò chuyện mới:", error);
        }
      }

      // Cập nhật danh sách cuộc trò chuyện
    } catch (error) {
      console.error("Lỗi khi gửi tin nhắn:", error);

      // Đánh dấu tin nhắn lỗi trong UI
      setMessages((prev) =>
        prev.map((m) => (m.tempId === tempId ? { ...m, status: "ERROR" } : m))
      );

      setError("Không thể gửi tin nhắn. Vui lòng thử lại sau.");
    }
  };

  const isDuplicateMessage = (message, existingMessages) => {
    return existingMessages.some(
      (m) =>
        // Sử dụng uniqueId để xác định tin nhắn (cách chính xác nhất)
        (message.uniqueId && m.uniqueId === message.uniqueId) ||
        // Trường hợp không có uniqueId, kiểm tra id (tin nhắn đã xử lý thành công)
        (message.id && m.id === message.id) ||
        // Kiểm tra tempId (tin nhắn đang gửi)
        (message.tempId && m.tempId === message.tempId) ||
        // Trường hợp đặc biệt: tin nhắn gửi từ mình, có cùng nội dung
        // và được gửi trong khoảng thời gian gần nhau (<2s)
        (message.senderId === user.keycloakId &&
          m.senderId === user.keycloakId &&
          m.content === message.content &&
          Math.abs(new Date(m.timestamp) - new Date(message.timestamp)) < 2000)
    );
  };

  // Xử lý tạo cuộc trò chuyện mới
  const handleCreateConversation = async (type, participants, name = "") => {
    try {
      // Kiểm tra participants
      if (!participants || participants.length === 0) {
        throw new Error(
          "Không thể tạo cuộc trò chuyện: Thiếu thông tin người tham gia"
        );
      }

      let newConversation;

      if (type === "GROUP") {
        // Tạo nhóm mới
        newConversation = await chatService.createGroupConversation(
          name,
          participants
        );
      } else {
        // Lấy hoặc tạo cuộc trò chuyện một-một
        newConversation = await chatService.getPrivateConversation(
          user.keycloakId,
          participants[0]
        );
      }
      if (
        !newConversation.participants ||
        newConversation.participants.length === 0
      ) {
        console.log(
          "API trả về cuộc trò chuyện không có participants, bổ sung..."
        );
        newConversation = {
          ...newConversation,
          participants: [...participants],
        };
      }
      // Đảm bảo cuộc trò chuyện mới có trường participants
      if (
        !newConversation.participants ||
        newConversation.participants.length === 0
      ) {
        console.log(
          "API trả về cuộc trò chuyện không có participants, bổ sung..."
        );
        newConversation = {
          ...newConversation,
          participants: [...participants],
        };
      }

      // Thêm cuộc trò chuyện mới vào danh sách
      setConversations((prev) => [newConversation, ...prev]);

      // Chọn cuộc trò chuyện mới
      handleSelectConversation(newConversation);

      return newConversation;
    } catch (error) {
      console.error("Lỗi khi tạo cuộc trò chuyện:", error);
      setError("Không thể tạo cuộc trò chuyện. Vui lòng thử lại sau.");
      return null;
    }
  };
  const getEffectiveUser = () => {
    // Kiểm tra chatWindowUser từ state
    if (chatWindowUser) return chatWindowUser;

    // Kiểm tra chatWindowUserRef từ ref
    if (chatWindowUserRef.current) return chatWindowUserRef.current;

    // Kiểm tra selectedUser từ props
    if (selectedUser) return selectedUser;

    // Trích xuất thông tin từ selectedConversation
    if (selectedConversation) {
      if (
        selectedConversation.type === "ONE_TO_ONE" &&
        selectedConversation.users?.body
      ) {
        return {
          id: selectedConversation.participants?.[0] || "unknown",
          keycloakId: selectedConversation.users.body.keycloakId || "unknown",
          firstName: selectedConversation.users.body.firstName || "Người dùng",
          lastName: selectedConversation.users.body.lastName || "",
          image: selectedConversation.users.body.image,
        };
      } else if (selectedConversation.type === "GROUP") {
        return {
          id: selectedConversation.id || "unknown-group",
          name:
            selectedConversation.name ||
            selectedConversation.users?.groupName ||
            "Nhóm không tên",
          isGroup: true,
          participants: selectedConversation.users?.participants || [],
        };
      }
    }

    // Fallback cuối cùng
    return {
      id: "unknown",
      firstName: "Người dùng",
      lastName: "Không xác định",
    };
  };
  const handleAddGroupMember = async (groupId, memberIds) => {
        try {
            const members = await Promise.all(
                memberIds.map(id => getUserbyKeycloakId(token, id))
            );
            const fullName = members.map(user => `${user.body.firstName} ${user.body.lastName}`.trim());
            await chatService.addMembersToGroup(groupId, memberIds, fullName);

            // Reload tất cả conversations để lấy thông tin mới nhất
            const allConversations = await chatService.getUserConversations();
            
            // Tìm thông tin nhóm đã cập nhật trong danh sách vừa lấy về
            const updatedGroup = allConversations.find(
            (conv) => conv.type === "GROUP" && String(conv.id) === String(groupId)
            );

            if (!updatedGroup) {
            console.error("Không tìm thấy nhóm sau khi cập nhật");
            return;
            }

            // Cập nhật danh sách conversation
            setConversations((prev) =>
            prev.map((conv) =>
                String(conv.id) === String(groupId)
                ? { ...conv, participants: updatedGroup.participants }
                : conv
            )
            );

            // Cập nhật selectedConversation nếu đang mở nhóm đó
            if (selectedConversation?.id === groupId) {
            // Đảm bảo tải đầy đủ thông tin người dùng cho nhóm đã cập nhật
            const enrichedGroup = await enrichConversationWithUsers(updatedGroup);
            setSelectedConversation(enrichedGroup);
            }
            
            let user = await getUserbyKeycloakId(token, memberIds);
            console.log("user", user);
            // Thông báo thành công
            toast.success(`Đã thêm ${user.body.firstName} ${user.body.lastName} vào nhóm`);
        } catch (error) {
            console.error("Lỗi khi thêm thành viên:", error);
            toast.error("Không thể thêm thành viên vào nhóm");
        }
    };

    const handleRemoveGroupMember = async (groupId, memberIds) => {
    try {
        const members = await Promise.all(
                memberIds.map(id => getUserbyKeycloakId(token, id))
            );
         const fullName = members.map(user => `${user.body.firstName} ${user.body.lastName}`.trim());
        await chatService.removeMemberFromGroup(groupId, memberIds, fullName);
        // Reload tất cả conversations để lấy thông tin mới nhất
        const allConversations = await chatService.getUserConversations();
        // Tìm thông tin nhóm đã cập nhật trong danh sách vừa lấy về
        const updatedGroup = allConversations.find(
            (conv) => conv.type === "GROUP" && String(conv.id) === String(groupId)
        );
        if (!updatedGroup) {
            console.error("Không tìm thấy nhóm sau khi cập nhật");
            return;
        }
        // Cập nhật danh sách conversation
        setConversations((prev) =>
            prev.map((conv) =>
                String(conv.id) === String(groupId)
                    ? { ...conv, participants: updatedGroup.participants }
                    : conv
            )
        );
        // Cập nhật selectedConversation nếu đang mở nhóm đó
        if (selectedConversation?.id === groupId) {
            // Đảm bảo tải đầy đủ thông tin người dùng cho nhóm đã cập nhật
            const enrichedGroup = await enrichConversationWithUsers(updatedGroup);
            setSelectedConversation(enrichedGroup);
        }
        // Thông báo thành công
        const user = await getUserbyKeycloakId(token, memberIds);
        toast.success(`Đã xóa ${user.body.firstName} ${user.body.lastName} khỏi nhóm`);
    } catch (error) {
        console.error("Lỗi khi xóa thành viên:", error);
        toast.error("Không thể xóa thành viên khỏi nhóm");
    }
    }

  return (
    <div className="flex h-full">
      {/* Danh sách cuộc trò chuyện - chiếm 1/3 màn hình */}
      <div className="w-1/3 border-r border-gray-200">
        <ConversationList
          conversations={conversations}
          loading={loading}
          selectedId={selectedConversation?.id}
          onSelectConversation={handleSelectConversation}
          onCreateConversation={async (type, participants, name) => {
            // Khi tạo cuộc trò chuyện mới từ ConversationList
            if (type === "ONE_TO_ONE" && participants.length > 0) {
              const tempConv = {
                id: `temp_${Date.now()}`,
                type: "ONE_TO_ONE",
                participants: [user.keycloakId, participants[0]],
                isTemporary: true,
              };

              // Làm giàu conversation với thông tin users
              const enrichedTempConv = await enrichConversationWithUsers(
                tempConv
              );

              setSelectedConversation(enrichedTempConv);
              setMessages([]);
              return enrichedTempConv;
            } else {
              // Xử lý tạo nhóm như bình thường
              return handleCreateConversation(type, participants, name);
            }
          }}
          connected={connected}
        />
      </div>

      {/* Cửa sổ trò chuyện - chiếm 2/3 màn hình */}
      <div className="w-2/3">
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded mb-2">
            {error}
          </div>
        )}
        {loadingMessages && (
          <div className="flex justify-center items-center h-16 bg-gray-50">
            <span className="animate-pulse">Đang tải tin nhắn...</span>
          </div>
        )}
        {selectedConversation ? (
          <ChatWindow
            conversation={selectedConversation}
            messages={messages}
            loading={loadingMessages}
            onSendMessage={handleSendMessage}
            currentUserId={user?.keycloakId}
            selectedUser={getEffectiveUser()}
            onLoadMoreMessages={handleLoadMoreMessages}
            loadingMore={loadingMessages}
            hasMoreMessages={hasMoreMessages}
            onAddMember={handleAddGroupMember}
            onRemoveMember={handleRemoveGroupMember}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="relative text-xl font-medium text-gray-600 animate-typing">
              Chọn một cuộc trò chuyện để bắt đầu
            </div>

            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-20 w-20 text-indigo-400 icon-soft-pulse"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPage;
