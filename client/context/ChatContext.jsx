import { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { toast } from "sonner";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [typingUsers, setTypingUsers] = useState({});


  const { socket, axios, authUser } = useContext(AuthContext);

  // function to emit typing indicator
  const emitTyping = (isTyping) => {
    if (!socket || !selectedUser || !authUser) return;
    socket.emit(isTyping ? 'typing' : 'stopTyping', {
      from: authUser._id,
      to: selectedUser._id
    });
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
    selectedUser,
    getUsers,
    setMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
    getMessages,
    fetchMessages,
    loadingUsers,
setLoadingUsers,
emitTyping,
typingUsers,

  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
