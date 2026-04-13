import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import assets from "../assets/assets";
import { formatMessageTime, formatLastSeen, getAvatarUrl, formatFullDateTime, formatMessageDate } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import {
  ArrowBigUp,
  EllipsisVertical,
  Image,
  MessageCircleMore,
  MessageSquare,
  Phone,
  Radio,
  Search,
  Hash,
  Smile,
} from "lucide-react";
import { toast } from "sonner";
import EmojiPicker from "./EmojiPicker";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightText = (text = "", query = "") => {
  if (!query.trim() || !text) return text;
  const escapedQuery = escapeRegExp(query.trim());
  const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === query.trim().toLowerCase() ? (
      <mark key={index} className="bg-yellow-300 text-slate-900 rounded-sm px-px">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const features = [
  { id: 1, icon: MessageSquare, title: "Send Messages", description: "Chat with your friends instantly" },
  { id: 2, icon: Image, title: "Share Media", description: "Send photos and images easily" },
  { id: 3, icon: Radio, title: "Stay Connected", description: "Real-time online status" },
];

const TypingIndicator = () => (
  <div className="flex items-center gap-1">
    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

const GroupTypingStatus = ({ groupTypingUsers, groupId }) => {
  const typingData = groupTypingUsers?.[groupId] || {};
  const names = Object.values(typingData).filter(n => typeof n === 'string');
  if (names.length === 0) return null;
  return (
    <div className="flex items-center gap-1 ml-2">
      <TypingIndicator />
      <span className="text-xs text-blue-400">
        {names.join(", ")} {names.length === 1 ? "is" : "are"} typing
      </span>
    </div>
  );
};

const reactionEmojis = ["👍", "❤️", "😂", "😮", "😢", "😡"];

const DateSeparator = ({ date }) => {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-gray-800/80 backdrop-blur-sm px-4 py-1.5 rounded-full">
        <span className="text-xs text-gray-400 font-medium">{formatMessageDate(date)}</span>
      </div>
    </div>
  );
};

const MessageTimestamp = ({ date }) => (
  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
    {formatFullDateTime(date)}
  </div>
);

const EmptyChatState = ({ isDirect, otherUserName }) => (
  <div className="flex flex-col items-center justify-center h-full gap-4">
    <div className="relative">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-500/20 to-teal-600/20 flex items-center justify-center animate-pulse">
        <MessageCircleMore className="w-12 h-12 text-teal-500" />
      </div>
      <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
        <ArrowBigUp className="w-4 h-4 text-white" />
      </div>
    </div>
    <div className="text-center">
      <h3 className="text-white font-semibold text-lg mb-1">
        {isDirect ? `Chat with ${otherUserName}` : 'Group Chat'}
      </h3>
      <p className="text-gray-500 text-sm max-w-xs">
        {isDirect 
          ? "Send a message or share photos to start the conversation" 
          : "This is the start of your group conversation"}
      </p>
    </div>
    <div className="flex flex-wrap justify-center max-w-md gap-4 mt-2">
      <div className="flex flex-col items-center gap-2 p-4 border border-gray-800 rounded-2xl w-28 hover:bg-gray-800 transition-colors">
        <Image className="w-8 h-8 text-teal-500" />
        <span className="text-xs font-medium text-gray-400">Share Photos</span>
      </div>
      <div className="flex flex-col items-center gap-2 p-4 border border-gray-800 rounded-2xl w-28 hover:bg-gray-800 transition-colors">
        <Smile className="w-8 h-8 text-teal-500" />
        <span className="text-xs font-medium text-gray-400">Send Emoji</span>
      </div>
    </div>
  </div>
);

const MediaLightbox = ({ images, startIndex, onClose }) => {
  const [current, setCurrent] = useState(startIndex);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrent(c => Math.min(c + 1, images.length - 1));
      if (e.key === 'ArrowLeft') setCurrent(c => Math.max(c - 1, 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white" onClick={onClose}>
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      {images.length > 1 && (
        <>
          <button className="absolute left-4 p-2 text-white/70 hover:text-white" onClick={(e) => { e.stopPropagation(); setCurrent(c => Math.max(c - 1, 0)); }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button className="absolute right-4 p-2 text-white/70 hover:text-white" onClick={(e) => { e.stopPropagation(); setCurrent(c => Math.min(c + 1, images.length - 1)); }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
      
      <img 
        src={images[current]} 
        alt={`Media ${current + 1}`}
        className="max-w-[90vw] max-h-[90vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, idx) => (
            <div key={idx} className={`w-2 h-2 rounded-full ${idx === current ? 'bg-teal-500' : 'bg-white/30'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

const ChatContainer = () => {
  const { 
    messages, selectedUser, chatType, setMessages, sendMessage, sendGroupMessage,
    editMessage, deleteMessage, getMessages, getGroupMessages, fetchMessages, fetchGroupMessages,
    emitTyping, typingUsers, groupTypingUsers, joinGroup, leaveGroupSocket
  } = useContext(ChatContext);
  const { socket, authUser, axios, onlineUsers, lastSeen } = useContext(AuthContext);
  
  const [input, setInput] = useState("");
  const chatBoxRef = useRef(null);
  const scrollEnd = useRef(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [openMessageMenuId, setOpenMessageMenuId] = useState(null);
  const [showReactionMenu, setShowReactionMenu] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const messageRefs = useRef({});
  const [showTypingDots, setShowTypingDots] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
  const isTyping = selectedUser && typingUsers[selectedUser._id];
  const hasSearch = showSearchPanel && searchQuery.trim().length > 0;
  
  const searchResults = useMemo(() => {
    if (!hasSearch) return [];
    const query = searchQuery.toLowerCase();
    return messages.filter(msg => msg.text?.toLowerCase().includes(query));
  }, [messages, searchQuery, hasSearch]);
  
  const activeSearch = hasSearch && searchResults.length > 0 ? searchResults[currentMatchIndex] : null;
  
  useEffect(() => {
    if (selectedUser && chatType === "group") {
      joinGroup(selectedUser._id);
      return () => leaveGroupSocket(selectedUser._id);
    }
  }, [selectedUser?._id, chatType]);
  
  useEffect(() => {
    if (!selectedUser) return;
    
    if (chatType === "group") {
      setPage(1);
      setHasMore(true);
      getGroupMessages(selectedUser._id);
    } else {
      setPage(1);
      setHasMore(true);
      getMessages(selectedUser._id);
    }
  }, [selectedUser?._id, chatType]);
  
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);
  
  useEffect(() => {
    if (activeSearch && messageRefs.current[activeSearch._id]) {
      messageRefs.current[activeSearch._id].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeSearch]);
  
  const loadMessagesPage = async (pageNum, { prepend = false } = {}) => {
    if (!selectedUser || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const res = chatType === "group" 
      ? await fetchGroupMessages(selectedUser._id, { page: pageNum, limit: 20 })
      : await fetchMessages(selectedUser._id, { page: pageNum, limit: 20 });
    if (res.success) {
      if (prepend) {
        setMessages((prev) => [...res.messages, ...prev]);
      } else {
        setMessages((prev) => [...prev, ...res.messages]);
      }
      setPage(pageNum);
      setHasMore(res.messages.length === 20);
    }
    setIsLoadingMore(false);
  };
  
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    if (chatType === "group") {
      await sendGroupMessage({ text });
    } else {
      await sendMessage({ text });
    }
  };
  
  const handleSendImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      if (chatType === "group") {
        await axios.post(`/api/groups/${selectedUser._id}/messages`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else {
        await axios.post(`/api/messages/send/${selectedUser._id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }
    } catch (error) {
      toast.error("Failed to send image");
    }
    e.target.value = "";
  };
  
  const handleAddReaction = async (emoji) => {
    if (!showReactionMenu) return;
    try {
      const { data } = await axios.patch(`/api/messages/${showReactionMenu}/react`, { emoji });
      if (data.success) {
        setMessages((prev) => prev.map((msg) => {
          if (msg._id === showReactionMenu || msg._id?.toString() === showReactionMenu) {
            return data.updatedMessage;
          }
          return msg;
        }));
        setShowReactionMenu(null);
      }
    } catch (error) {
      toast.error("Failed to add reaction");
    }
  };

  const handleRemoveReaction = async (msgId, emoji) => {
    try {
      const { data } = await axios.patch(`/api/messages/${msgId}/react/remove`, { emoji });
      if (data.success) {
        setMessages((prev) => prev.map((msg) => {
          if (msg._id === msgId || msg._id?.toString() === msgId) {
            return data.updatedMessage;
          }
          return msg;
        }));
      }
    } catch (error) {
      toast.error("Failed to remove reaction");
    }
  };

  if (!selectedUser) {
    return (
      <div className="relative flex flex-col flex-1 bg-gray-900">
        <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
          <div className="flex flex-wrap justify-center max-w-md gap-4">
            {features.map(({ id, icon: Icon, title }) => (
              <div key={id} className="flex flex-col items-center gap-2 p-4 border border-gray-800 rounded-2xl w-28 hover:bg-gray-800">
                <Icon className="w-8 h-8 text-teal-500" />
                <span className="text-xs font-medium text-center">{title}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  const isDirect = chatType !== "group";
  const selectedUserId = selectedUser?._id;
  const isUserOnline = isDirect && onlineUsers.includes(selectedUserId);
  const userLastSeen = isDirect && lastSeen[selectedUserId] ? formatLastSeen(lastSeen[selectedUserId]) : null;

  const otherTyping = isDirect && isTyping;
  const groupTyping = chatType === "group" && groupTypingUsers?.[selectedUserId];

  return (
    <div className="flex flex-col bg-gray-900 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={getAvatarUrl(selectedUser?.profilePic)} alt={selectedUser?.fullName} className="w-10 h-10 rounded-full object-cover" />
            {isUserOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{isDirect ? selectedUser?.fullName : selectedUser?.name}</h3>
            {isDirect ? (
              isUserOnline ? <span className="text-xs text-green-500">online</span> : <span className="text-xs text-gray-500">{userLastSeen || "offline"}</span>
            ) : (
              <span className="text-xs text-teal-500">{selectedUser?.participants?.length || 0} members</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 cursor-pointer hover:text-white text-gray-400" />
          <Search onClick={() => setShowSearchPanel(true)} className={`w-5 h-5 cursor-pointer ${showSearchPanel ? 'text-teal-400' : 'text-gray-400 hover:text-white'}`} />
          {showSearchPanel && (
            <button onClick={() => { setShowSearchPanel(false); setSearchQuery(""); setCurrentMatchIndex(0); }} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-700 text-gray-400">✕</button>
          )}
          <EllipsisVertical className="w-5 h-5 cursor-pointer hover:text-white text-gray-400" />
        </div>
      </div>

      {/* Search Panel */}
      {showSearchPanel && (
        <div className="px-4 py-2 border-b border-gray-800 shrink-0 overflow-hidden">
          <div className="relative flex items-center gap-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input ref={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="text" placeholder="Search messages..." autoFocus className="w-full rounded-full bg-gray-800 border border-teal-500/50 px-10 py-2 text-sm text-white outline-none focus:border-teal-500" />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="absolute right-12 text-gray-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
            <button type="button" onClick={() => { setShowSearchPanel(false); setSearchQuery(""); setCurrentMatchIndex(0); }} className="absolute right-2 text-gray-400 hover:text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
            <span>{searchQuery ? (searchResults.length > 0 ? `${currentMatchIndex + 1} of ${searchResults.length}` : "No results") : "Type to search"}</span>
            <div className="flex gap-1">
              <button type="button" disabled={!searchResults.length} onClick={() => setCurrentMatchIndex((v) => v === 0 ? searchResults.length - 1 : v - 1)} className="px-2 py-1 hover:text-white hover:bg-gray-700 disabled:opacity-40">↑</button>
              <button type="button" disabled={!searchResults.length} onClick={() => setCurrentMatchIndex((v) => v === searchResults.length - 1 ? 0 : v + 1)} className="px-2 py-1 hover:text-white hover:bg-gray-700 disabled:opacity-40">↓</button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Container - scrollable area only */}
      <div ref={chatBoxRef} onScroll={() => { const el = chatBoxRef.current; if (el && el.scrollTop <= 50 && !isLoadingMore && hasMore && !hasSearch) loadMessagesPage(page + 1, { prepend: true }); }} className="flex-1 overflow-y-auto overflow-x-hidden p-3 flex flex-col">
        {isLoadingMore && <div className="text-center text-xs uppercase tracking-[0.3em] text-gray-400 py-2">Loading earlier messages...</div>}
        
        {/* Typing indicator at bottom of messages */}
        {(otherTyping || groupTyping) && (
          <div className="flex items-center gap-2 px-2 py-1">
            {isDirect && isTyping ? (
              <div className="flex items-center gap-1"><TypingIndicator /><span className="text-xs text-blue-400">typing</span></div>
            ) : <GroupTypingStatus groupTypingUsers={groupTypingUsers} groupId={selectedUserId} />}
          </div>
        )}

        {messages.length === 0 && (
          <EmptyChatState isDirect={isDirect} otherUserName={selectedUser?.fullName || selectedUser?.name} />
        )}

        {messages.map((msg, index) => {
          const senderIdStr = msg.senderId?._id || msg.senderId;
          const isMine = senderIdStr === authUser._id;
          const senderName = msg.senderId?.fullName || "Unknown";
          const senderPic = msg.senderId?.profilePic;
          const statusColor = msg.status === "read" ? "text-teal-400" : "text-gray-400";
          const msgId = msg._id?.toString() || index.toString();
          const isMatch = hasSearch && searchResults.some((r) => r.id === msgId);
          const isActiveMatch = hasSearch && activeSearch?.id === msgId;
          const showGroupSender = chatType === "group" && !isMine;
          
          const msgDate = new Date(msg.createdAt).toDateString();
          const prevMsgDate = index > 0 ? new Date(messages[index - 1].createdAt).toDateString() : null;
          const showDateSeparator = !prevMsgDate || prevMsgDate !== msgDate;

          return (
            <div key={msgId} ref={(el) => { if (el) messageRefs.current[msgId] = el; }}>
              {showDateSeparator && <DateSeparator date={msg.createdAt} />}
              <div className={`flex items-end gap-1 mb-1 ${isMine ? "justify-end" : "justify-start"}`}>
                {/* Sender info for group - LEFT side for others */}
                {showGroupSender && (
                  <div className="flex flex-col items-center min-w-[40px] max-w-[50px]">
                    <img src={getAvatarUrl(senderPic)} alt={senderName} className="w-7 h-7 rounded-full object-cover" />
                    <span className="text-[9px] text-teal-400 truncate max-w-[50px]">{senderName.split(" ")[0]}</span>
                  </div>
                )}

                {/* Message bubble container - flex-col for alignment */}
                <div className="flex flex-col items-start gap-0.5 max-w-[70%]">
                  {/* Message bubble */}
                  <div className="relative group">
                    <MessageTimestamp date={msg.createdAt} />
                    {msg.deleted ? (
                      <div className="p-2 text-sm rounded-2xl break-all bg-gray-800 text-gray-300 italic">This message was deleted</div>
                    ) : msg.image ? (
                      <img 
                        src={msg.image} 
                        alt="Shared" 
                        className={`max-w-[180px] rounded-2xl cursor-pointer hover:opacity-90 transition-opacity ${isMine ? "border border-gray-700" : "border border-gray-200 bg-white"}`}
                        onClick={() => {
                          const imgMsgs = messages.filter(m => m.image);
                          const idx = imgMsgs.findIndex(m => m._id === msg._id);
                          setLightboxImages(imgMsgs.map(m => m.image));
                          setLightboxIndex(idx);
                          setLightboxOpen(true);
                        }}
                      />
                    ) : editingMessageId === msgId ? (
                      <div className="flex flex-col gap-2 bg-gray-900 rounded-2xl p-2">
                        <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={2} className="w-full resize-none bg-transparent text-white text-sm outline-none" />
                        <div className="flex gap-2 self-end">
                          <button onClick={() => { setEditingMessageId(null); setEditingText(""); }} className="px-3 py-1 text-xs text-gray-300 border border-gray-600 rounded-full hover:bg-gray-800">Cancel</button>
                          <button onClick={async () => { if (!editingText.trim()) { toast.error("Message cannot be empty"); return; } await editMessage(msgId, editingText.trim()); setEditingMessageId(null); setEditingText(""); setOpenMessageMenuId(null); }} className="px-3 py-1 text-xs bg-teal-600 text-white rounded-full hover:bg-teal-500">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-2 text-sm rounded-2xl break-words ${isMine ? "bg-teal-700 text-white rounded-br-none" : "bg-white text-slate-900 rounded-bl-none shadow-sm"} ${isActiveMatch ? "ring-2 ring-yellow-300" : isMatch ? "ring-1 ring-yellow-200" : ""}`}>
                        {highlightText(msg.text, searchQuery)}
                        {msg.edited && !msg.deleted && <span className="ml-1 text-[10px] text-slate-300">(edited)</span>}
                      </div>
                    )}

                    {/* Menu button */}
                    {isMine && !msg.deleted && editingMessageId !== msgId && (
                      <>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setOpenMessageMenuId(openMessageMenuId === msgId ? null : msgId); }} className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1 rounded-full">
                          <EllipsisVertical size={14} />
                        </button>
                        {openMessageMenuId === msgId && (
                          <div className="absolute right-0 top-8 z-10 w-32 bg-slate-900 border border-gray-700 rounded-lg p-1 shadow-xl">
                            <button type="button" onClick={() => { setEditingMessageId(msgId); setEditingText(msg.text || ""); setOpenMessageMenuId(null); }} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-800 rounded">Edit</button>
                            <button type="button" onClick={() => { setOpenMessageMenuId(null); if (window.confirm("Delete this message?")) deleteMessage(msgId); }} className="w-full text-left px-3 py-2 text-sm text-rose-300 hover:bg-slate-800 rounded">Delete</button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Reaction picker button - show on hover like real chat apps */}
                    {!msg.deleted && (
                      <button 
                        type="button" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setShowReactionMenu(showReactionMenu === msgId ? null : msgId); 
                        }} 
                        className="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-700 p-1 rounded-full hover:bg-gray-600 z-20"
                        style={{ [isMine ? 'left' : 'right']: '-32px' }}
                      >
                        <Smile size={14} className="text-white" />
                      </button>
                    )}
                    {showReactionMenu === msgId && (
                      <div 
                        className="absolute top-8 z-30 flex gap-1 bg-gray-900 border border-gray-700 p-1.5 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-150"
                        style={{ [isMine ? 'right' : 'left']: 0 }}
                      >
                        {reactionEmojis.map((emoji) => {
                          const myReaction = msg.reactions?.[authUser._id];
                          const isSelected = myReaction === emoji;
                          return (
                            <button 
                              key={emoji} 
                              type="button" 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (isSelected) {
                                  handleRemoveReaction(emoji);
                                } else {
                                  handleAddReaction(emoji);
                                }
                                setShowReactionMenu(null); 
                              }} 
                              className={`p-1.5 hover:bg-gray-800 rounded-lg text-lg transition-transform hover:scale-125 ${isSelected ? 'bg-gray-700 ring-1 ring-teal-500' : ''}`}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* Show reactions below message - clickable to toggle */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const myReaction = msg.reactions[authUser._id];
                          if (myReaction) {
                            handleRemoveReaction(msgId, myReaction);
                          } else {
                            setShowReactionMenu(msgId);
                          }
                        }}
                        className={`absolute -bottom-1.5 flex items-center gap-0.5 bg-gray-800 hover:bg-gray-700 rounded-full px-2 py-0.5 shadow-lg z-10 transition-colors cursor-pointer border ${msg.reactions[authUser._id] ? 'border-teal-500/50' : 'border-transparent'}`}
                        style={{ [isMine ? 'right' : 'left']: 0 }}
                      >
                        <div className="flex gap-0.5">
                          {Object.entries(msg.reactions).slice(0, 3).map(([userId, reactionEmoji]) => (
                            <span key={userId} className="text-xs">{reactionEmoji}</span>
                          ))}
                        </div>
                        <span className="text-[10px] text-gray-400 ml-0.5">{Object.keys(msg.reactions).length}</span>
                      </button>
                    )}
                </div>

                {/* Time and status */}
                  <div className={`flex items-center gap-1 text-[10px] ${isMine ? "self-end" : "self-start"}`}>
                    {isMine && <span className={statusColor}>{msg.status === "read" ? "✓✓" : "✓"}</span>}
                    <span className="text-gray-500 group-hover:text-gray-400">{formatMessageTime(msg.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={scrollEnd} />
      </div>

      {lightboxOpen && (
        <MediaLightbox 
          images={lightboxImages} 
          startIndex={lightboxIndex} 
          onClose={() => setLightboxOpen(false)} 
        />
      )}

      {/* Message Input */}
      <div className="flex items-center gap-2 p-3 border-t border-gray-800 shrink-0">
        <div className="flex-1 flex items-center bg-gray-800/50 px-3 rounded-full">
          <input onChange={(e) => { setInput(e.target.value); emitTyping(e.target.value.length > 0); }} value={input} onKeyDown={(e) => (e.key === "Enter" && !e.shiftKey ? handleSendMessage(e) : null)} type="text" placeholder="Type a message..." className="flex-1 text-sm p-3 border-none outline-none text-white placeholder-gray-400 bg-transparent" />
          <input onChange={handleSendImage} type="file" id="image" accept="image/*" hidden />
          <label htmlFor="image" className="cursor-pointer p-2 hover:bg-gray-700 rounded-full text-gray-400"><Image className="size-5" /></label>
          <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 hover:bg-gray-700 rounded-full text-gray-400"><Smile className="size-5" /></button>
        </div>
        {showEmojiPicker && <EmojiPicker onSelect={(emoji) => setInput(prev => prev + emoji)} onClose={() => setShowEmojiPicker(false)} />}
        <button className="p-2.5 bg-teal-600 hover:bg-teal-700 rounded-full" onClick={handleSendMessage} disabled={!input.trim()}><ArrowBigUp strokeWidth={2.5} /></button>
      </div>
    </div>
  );
};

export default ChatContainer;