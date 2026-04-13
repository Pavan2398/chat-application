import { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { toast } from "sonner";
import { getAvatarUrl } from "../src/lib/utils";

export const ChatContext = createContext();

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


  const { socket, axios, authUser } = useContext(AuthContext);

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
  const sendMessage = async (messageData) => {
    try {
      const { data } = await axios.post(
        `/api/messages/send/${selectedUser._id}`,
        messageData
      );
      if (data.success) {
        setMessages((prevMessages) => [...prevMessages, data.newMessage]);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
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
    try {
      if (!selectedUser || chatType !== "group") {
        toast.error("Select a group to send message");
        return;
      }
      const { data } = await axios.post(
        `/api/groups/${selectedUser._id}/messages`,
        messageData
      );
      if (data.success && data.newMessage) {
        setMessages((prev) => [...prev, data.newMessage]);
      } else if (data.success === false) {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
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

  // function to unsubscribe from messages
  const unsubscribeFromMessages = () => {
    if (!socket) return;
    socket.off("newMessage");
    socket.off("messageStatusUpdate");
    socket.off("messageUpdated");
    socket.off("messageDeleted");
    socket.off("userTyping");
    socket.off("userStopTyping");
  };

  useEffect(() => {
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [socket, selectedUser]);

  const value = {
    messages,
    users,
    groups,
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
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
