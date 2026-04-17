import { createContext, useContext, useEffect, useState, useRef } from "react";
import { AuthContext } from "./AuthContext";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

export const ChatContext = createContext();

const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];
const JITTER_RANGE = 500; // 0-500ms random jitter to prevent retry storms
const PENDING_MESSAGES_KEY = 'chatmate_pending_messages';

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [chatType, setChatType] = useState("direct"); // "direct" or "group"
  const [unseenMessages, setUnseenMessages] = useState({});
  const [unseenGroupMessages, setUnseenGroupMessages] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [typingUsers, setTypingUsers] = useState({});
  const [groupTypingUsers, setGroupTypingUsers] = useState({});
  
  const pendingMessagesRef = useRef({});
  const retryTimeoutsRef = useRef({});
  const isRetryingRef = useRef(false);

  const { socket, axios, authUser } = useContext(AuthContext);

  const generateClientMessageId = () => {
    return uuidv4();
  };

  const getRetryDelay = (retryCount) => {
    const baseDelay = RETRY_DELAYS[Math.min(retryCount - 1, RETRY_DELAYS.length - 1)];
    const jitter = Math.random() * JITTER_RANGE;
    return baseDelay + jitter;
  };

  // Persist pending messages to localStorage
  const savePendingToStorage = () => {
    try {
      localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(pendingMessagesRef.current));
    } catch (e) {
      console.warn("Failed to save pending messages:", e);
    }
  };

  const loadPendingFromStorage = () => {
    try {
      const stored = localStorage.getItem(PENDING_MESSAGES_KEY);
      if (stored) {
        pendingMessagesRef.current = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load pending messages:", e);
    }
  };

  useEffect(() => {
    loadPendingFromStorage();
  }, []);

  const addToPendingQueue = (message) => {
    pendingMessagesRef.current[message.clientMessageId] = {
      ...message,
      retryCount: 0,
      status: 'sending',
      createdAt: Date.now()
    };
    savePendingToStorage();
  };

  const removeFromPendingQueue = (clientMessageId) => {
    delete pendingMessagesRef.current[clientMessageId];
    if (retryTimeoutsRef.current[clientMessageId]) {
      clearTimeout(retryTimeoutsRef.current[clientMessageId]);
      delete retryTimeoutsRef.current[clientMessageId];
    }
    savePendingToStorage();
  };

  const retryMessage = async (clientMessageId) => {
    if (isRetryingRef.current) return;
    
    const pending = pendingMessagesRef.current[clientMessageId];
    if (!pending) return;

    if (pending.retryCount >= MAX_RETRIES) {
      pending.status = 'failed';
      savePendingToStorage();
      toast.error("Message failed to send");
      return;
    }

    isRetryingRef.current = true;
    
    pending.retryCount++;
    pending.status = 'retrying';
    savePendingToStorage();

    const delay = getRetryDelay(pending.retryCount);
    
    retryTimeoutsRef.current[clientMessageId] = setTimeout(async () => {
      try {
        if (pending.isGroup) {
          await axios.post(`/api/groups/${pending.groupId}/messages`, {
            text: pending.text,
            clientMessageId: pending.clientMessageId
          });
        } else {
          await axios.post(`/api/messages/send/${pending.receiverId}`, {
            text: pending.text,
            clientMessageId: pending.clientMessageId
          });
        }
      } catch (error) {
        retryMessage(clientMessageId);
      } finally {
        isRetryingRef.current = false;
      }
    }, delay);
  };

  // Reconcile pending messages after reconnect
  // Uses server-as-source-of-truth pattern
  const reconcilePendingMessages = async () => {
    const pending = pendingMessagesRef.current;
    const clientMessageIds = Object.keys(pending);
    
    if (clientMessageIds.length === 0) return;

    try {
      const { data } = await axios.post('/api/messages/reconcile', {
        clientMessageIds
      });
      
      if (data.success && data.results) {
        data.results.forEach(result => {
          if (result.exists) {
            removeFromPendingQueue(result.clientMessageId);
            // Server wins: always use server state
            if (!result.isDuplicate && result.message) {
              setMessages(prev => {
                const exists = prev.some(m => m._id === result.message._id);
                if (exists) return prev;
                return [...prev, result.message];
              });
            }
          }
        });
      }
    } catch (error) {
      console.warn("Reconciliation failed:", error);
    }
  };

  // function to get all groups
  const getGroups = async () => {
    try {
      const { data } = await axios.get("/api/groups/all");
      if (data.success) {
        setGroups(data.groups);
      }
    } catch (error) {
      console.log("Get groups error:", error);
    }
  };

  // function to emit typing indicator
  const emitTyping = (isTyping) => {
    if (!socket || !selectedUser || !authUser) return;
    
    if (chatType === "group") {
      socket.emit(isTyping ? 'groupTyping' : 'groupStopTyping', {
        groupId: selectedUser._id,
        userId: authUser._id,
        userName: authUser.fullName
      });
    } else {
      socket.emit(isTyping ? 'typing' : 'stopTyping', {
        from: authUser._id,
        to: selectedUser._id
      });
    }
  };

  // function to get all users for sidebar
  const getUsers = async () => {
    try {
      setLoadingUsers(true);
      const { data } = await axios.get("/api/messages/users");
      if (data.success) {
        setUsers(data.users);
        setUnseenMessages(data.unseenMessages);
      }
    } catch (error) {
      console.log(error);
      
    } finally{
      setLoadingUsers(false);
    }
  };

  const fetchMessages = async (userId, { page = 1, limit = 20 } = {}) => {
    try {
      const { data } = await axios.get(`/api/messages/${userId}?page=${page}&limit=${limit}`);
      return data;
    } catch (error) {
      toast.error(error.message);
      return { success: false, message: error.message };
    }
  };

  // function to get messages for selected user
  const getMessages = async (userId) => {
    const data = await fetchMessages(userId, { page: 1, limit: 20 });
    if (data.success) {
      setMessages(data.messages);
    }
    return data;
  };

  //function to send message to selected user
  const sendMessage = async (messageData, skipPending = false) => {
    const clientMessageId = generateClientMessageId();
    
    if (!skipPending) {
      addToPendingQueue({
        clientMessageId,
        text: messageData.text,
        receiverId: selectedUser._id,
        isGroup: false
      });
    }

    try {
      const { data } = await axios.post(
        `/api/messages/send/${selectedUser._id}`,
        { ...messageData, clientMessageId }
      );
      if (data.success) {
        removeFromPendingQueue(clientMessageId);
        if (!data.isDuplicate) {
          setMessages((prevMessages) => [...prevMessages, data.newMessage]);
        }
      } else {
        toast.error(data.message);
        retryMessage(clientMessageId);
      }
    } catch (error) {
      // Handle rate limit errors (429)
      if (error.response?.status === 429) {
        const retryAfter = error.response.data?.retryAfter || 5;
        toast.warning(`Rate limit. Retrying in ${retryAfter}s...`);
        setTimeout(() => retryMessage(clientMessageId), retryAfter * 1000);
      } else {
        toast.error(error.message);
        retryMessage(clientMessageId);
      }
    }
  };

  const editMessage = async (messageId, text) => {
    try {
      const { data } = await axios.patch(`/api/messages/${messageId}`, { text });
      if (data.success) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg._id === messageId ? data.updatedMessage : msg
          )
        );
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      if (chatType === "group") {
        return;
      }
      const { data } = await axios.delete(`/api/messages/${messageId}`);
      if (data.success) {
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg._id === messageId ? data.deletedMessage : msg
          )
        );
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // Group functions
  const fetchGroupMessages = async (groupId, { page = 1, limit = 20 } = {}) => {
    try {
      const { data } = await axios.get(`/api/groups/${groupId}/messages?page=${page}&limit=${limit}`);
      return data;
    } catch (error) {
      toast.error(error.message);
      return { success: false, message: error.message };
    }
  };

  const getGroupMessages = async (groupId) => {
    const data = await fetchGroupMessages(groupId, { page: 1, limit: 20 });
    if (data.success) {
      setMessages(data.messages);
    }
    return data;
  };

  const sendGroupMessage = async (messageData) => {
    const clientMessageId = generateClientMessageId();
    
    addToPendingQueue({
      clientMessageId,
      text: messageData.text,
      groupId: selectedUser._id,
      isGroup: true
    });

    try {
      if (!selectedUser || chatType !== "group") {
        toast.error("Select a group to send message");
        return;
      }
      const { data } = await axios.post(
        `/api/groups/${selectedUser._id}/messages`,
        { ...messageData, clientMessageId }
      );
      if (data.success && data.newMessage) {
        removeFromPendingQueue(clientMessageId);
        if (!data.isDuplicate) {
          setMessages((prev) => [...prev, data.newMessage]);
        }
      } else if (data.success === false) {
        toast.error(data.message);
        retryMessage(clientMessageId);
      }
    } catch (error) {
      // Handle rate limit errors (429)
      if (error.response?.status === 429) {
        const retryAfter = error.response.data?.retryAfter || 5;
        toast.warning(`Rate limit. Retrying in ${retryAfter}s...`);
        setTimeout(() => retryMessage(clientMessageId), retryAfter * 1000);
      } else {
        toast.error(error.message);
        retryMessage(clientMessageId);
      }
    }
  };

  const leaveGroup = async (groupId) => {
    try {
      const { data } = await axios.post(`/api/groups/${groupId}/leave`);
      if (data.success) {
        setGroups((prevGroups) => prevGroups.filter(g => g._id !== groupId));
        toast.success("Left group successfully");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // function to subscribe to messages for selected user
  const subscribeToMessages = async () => {
    if (!socket) return;

    socket.on("messageAck", (ack) => {
      const { clientMessageId, serverMessageId, status, isGroup, groupId } = ack;
      if (clientMessageId) {
        removeFromPendingQueue(clientMessageId);
        
        setMessages((prev) => {
          const exists = prev.some(msg => 
            msg.clientMessageId === clientMessageId || msg._id === serverMessageId
          );
          if (exists) return prev;
          return prev;
        });
      }
    });

    socket.on("newMessage", (newMessage) => {
      const isActiveChat = selectedUser && newMessage.senderId === selectedUser._id;
      const messageWithStatus = {
        ...newMessage,
        status: isActiveChat ? "read" : newMessage.status || "sent",
      };

      setMessages((prevMessages) => [...prevMessages, messageWithStatus]);

      socket.emit("messageDelivered", {
        messageId: newMessage._id,
        to: newMessage.senderId,
      });

      if (isActiveChat) {
        socket.emit("messageRead", {
          messageId: newMessage._id,
          to: newMessage.senderId,
        });
      }

      if (!isActiveChat) {
        setUnseenMessages((prevUnseenMessages) => ({
          ...prevUnseenMessages,
          [newMessage.senderId]: prevUnseenMessages[newMessage.senderId]
            ? prevUnseenMessages[newMessage.senderId] + 1
            : 1,
        }));
      }
    });

    socket.on("messageStatusUpdate", ({ messageIds, status }) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          messageIds.includes(msg._id?.toString()) || messageIds.includes(msg._id)
            ? { ...msg, status }
            : msg
        )
      );
    });

    socket.on("messageUpdated", (updatedMessage) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg
        )
      );
    });

    socket.on("messageDeleted", (deletedMessage) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === deletedMessage._id ? deletedMessage : msg
        )
      );
    });

    socket.on("userTyping", ({ from }) => {
      setTypingUsers((prev) => ({ ...prev, [from]: true }));
    });

    socket.on("userStopTyping", ({ from }) => {
      setTypingUsers((prev) => ({ ...prev, [from]: false }));
    });

    // Group events
    socket.on("newGroupMessage", (newMessage) => {
      const isActiveGroup = selectedUser && chatType === "group" && 
        newMessage.groupId === selectedUser._id;
      const isFromMe = newMessage.senderId === authUser._id || 
        newMessage.senderId?._id === authUser._id;
      
      // Only add messages from OTHER people, not my own
      if (!isFromMe) {
        setMessages((prevMessages) => {
          const exists = prevMessages.some(msg => msg._id === newMessage._id);
          if (exists) return prevMessages;
          return [...prevMessages, newMessage];
        });
        
        if (!isActiveGroup) {
          setUnseenGroupMessages((prev) => ({
            ...prev,
            [newMessage.groupId]: (prev[newMessage.groupId] || 0) + 1
          }));
        }
      }
    });

    socket.on("groupUserTyping", ({ groupId, userId, userName }) => {
      setGroupTypingUsers((prev) => ({ 
        ...prev, 
        [groupId]: { ...prev[groupId], [userId]: userName }
      }));
    });

    socket.on("groupUserStopTyping", ({ groupId, userId }) => {
      setGroupTypingUsers((prev) => {
        const groupTyping = prev[groupId] || {};
        delete groupTyping[userId];
        return { ...prev, [groupId]: groupTyping };
      });
    });

    socket.on("syncResponse", ({ messages: syncMessages, hasMore, syncTimestamp }) => {
      if (!syncMessages || syncMessages.length === 0) return;
      
      setMessages((prev) => {
        const existingIds = new Set(prev.map(m => m._id));
        const newMessages = syncMessages.filter(m => !existingIds.has(m._id));
        return [...prev, ...newMessages].sort((a, b) => 
          new Date(a.createdAt) - new Date(b.createdAt)
        );
      });
      
      // If more messages exist, fetch next page
      if (hasMore && syncTimestamp) {
        setTimeout(() => {
          socket.emit("syncMessages", {
            lastMessageTimestamp: syncTimestamp
          });
        }, 100);
      }
    });
  };

  const joinGroup = (groupId) => {
    if (socket) {
      socket.emit("joinGroup", { groupId });
    }
  };

  const leaveGroupSocket = (groupId) => {
    if (socket) {
      socket.emit("leaveGroup", { groupId });
    }
  };

  const syncMissedMessages = () => {
    if (!socket || messages.length === 0) return;
    
    // Get oldest message for sync (not newest)
    const oldestMessage = [...messages].sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    )[0];
    
    if (!oldestMessage) return;
    
    socket.emit("syncMessages", { 
      lastMessageId: oldestMessage._id,
      lastMessageTimestamp: new Date(oldestMessage.createdAt).toISOString()
    });
  };

  // Reconciliation on reconnect
  const handleReconnect = () => {
    syncMissedMessages();
    reconcilePendingMessages();
  };

  // function to unsubscribe from messages
  const unsubscribeFromMessages = () => {
    if (!socket) return;
    socket.off("messageAck");
    socket.off("newMessage");
    socket.off("messageStatusUpdate");
    socket.off("messageUpdated");
    socket.off("messageDeleted");
    socket.off("userTyping");
    socket.off("userStopTyping");
    socket.off("syncResponse");
  };

  useEffect(() => {
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [socket, selectedUser]);

  // Sync missed messages on socket reconnect
  useEffect(() => {
    window.addEventListener('socketReconnected', handleReconnect);
    return () => window.removeEventListener('socketReconnected', handleReconnect);
  }, [socket, messages]);

  // Clean up stale pending messages on load (older than 24h)
  useEffect(() => {
    const cleanupStaleMessages = () => {
      const now = Date.now();
      const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
      const pending = pendingMessagesRef.current;
      
      Object.keys(pending).forEach(clientId => {
        if (now - pending[clientId].createdAt > staleThreshold) {
          removeFromPendingQueue(clientId);
        }
      });
    };
    
    cleanupStaleMessages();
  }, []);

  const value = {
    messages,
    users,
    groups,
    setGroups,
    selectedUser,
    chatType,
    setChatType,
    getUsers,
    getGroups,
    setMessages,
    sendMessage,
    sendGroupMessage,
    editMessage,
    deleteMessage,
    setSelectedUser,
    unseenMessages,
    unseenGroupMessages,
    setUnseenMessages,
    setUnseenGroupMessages,
    getMessages,
    getGroupMessages,
    fetchMessages,
    fetchGroupMessages,
    loadingUsers,
    setLoadingUsers,
    emitTyping,
    typingUsers,
    groupTypingUsers,
    joinGroup,
    leaveGroupSocket,
    leaveGroup,
    syncMissedMessages,
    reconcilePendingMessages,
    handleReconnect,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
