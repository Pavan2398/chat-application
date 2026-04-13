import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import assets from "../assets/assets";
import { formatMessageTime, formatLastSeen, getAvatarUrl } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import {
  ArrowBigUp,
  ArrowLeft,
  EllipsisVertical,
  Image,
  MessageCircleMore,
  MessageSquare,
  Phone,
  Radio,
  Search,
  Hash,
} from "lucide-react";
import { toast } from "sonner";

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
  {
    id: 1,
    icon: MessageSquare,
    title: "Send Messages",
    description: "Chat with your friends instantly",
  },
  {
    id: 2,
    icon: Image,
    title: "Share Media",
    description: "Send photos and images easily",
  },
  {
    id: 3,
    icon: Radio,
    title: "Stay Connected",
    description: "Real-time online status",
  },
];

const TypingIndicator = () => (
  <div className="flex items-center gap-1">
    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
);

const StatusIndicator = ({ isOnline, isTyping, lastSeen }) => {
  if (isTyping) {
    return (
      <div className="flex items-center gap-2">
        <TypingIndicator />
        <span className="text-xs text-blue-400 font-medium">typing</span>
      </div>
    );
  }
  
  if (isOnline) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-xs text-green-400 font-medium">online</span>
      </div>
    );
  }
  
  return (
    <span className="text-xs text-gray-500">{lastSeen || "offline"}</span>
  );
};

const ChatContainer = () => {
  const { 
    messages, selectedUser, setSelectedUser, setMessages, 
    sendMessage, sendGroupMessage, getMessages, getGroupMessages,
    fetchMessages, fetchGroupMessages, emitTyping, typingUsers, groupTypingUsers,
    editMessage, deleteMessage, chatType, setChatType,
    joinGroup, leaveGroupSocket
  } = useContext(ChatContext);
  const { authUser, onlineUsers, lastSeen, socket } = useContext(AuthContext);

  const chatBoxRef = useRef();
  const scrollEnd = useRef();
  const messageRefs = useRef({});
  const skipScrollToBottom = useRef(false);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [input, setInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [openMessageMenuId, setOpenMessageMenuId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchInputRef, setSearchInputRef] = useState(null);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return messages
      .map((msg, index) => ({
        id: msg._id?.toString() || index.toString(),
        index,
        text: msg.text || "",
      }))
      .filter((item) => item.text.toLowerCase().includes(query));
  }, [messages, searchQuery]);

  const hasSearch = Boolean(searchQuery.trim());
  const activeSearch = searchResults[currentMatchIndex] || null;

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (input.trim() === "") return null;
    
    if (chatType === "group") {
      await sendGroupMessage({ text: input.trim() });
    } else {
      await sendMessage({ text: input.trim() });
    }
    setInput("");
    emitTyping(false);
  };

  // handle sending an image

  const handleSendImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("select an image file");
      return;
    }
    const reader = new FileReader();

    reader.onloadend = async () => {
      if (chatType === "group") {
        await sendGroupMessage({ image: reader.result });
      } else {
        await sendMessage({ image: reader.result });
      }
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const loadMessagesPage = async (pageNumber = 1, { prepend = false } = {}) => {
    if (!selectedUser) return;
    try {
      const container = chatBoxRef.current;
      const previousScrollHeight = container?.scrollHeight;
      const previousScrollTop = container?.scrollTop;

      setIsLoadingMore(prepend);
      
      let data;
      if (chatType === "group" && selectedUser?._id) {
        data = await fetchGroupMessages(selectedUser._id, { page: pageNumber, limit: 20 });
      } else if (selectedUser?._id) {
        data = await fetchMessages(selectedUser._id, { page: pageNumber, limit: 20 });
      }
      
      if (data?.success) {
        if (prepend) {
          setMessages((prevMessages) => [...data.messages, ...prevMessages]);
          if (container) {
            requestAnimationFrame(() => {
              const nextScrollHeight = container.scrollHeight;
              container.scrollTop = nextScrollHeight - previousScrollHeight + previousScrollTop;
            });
          }
        } else {
          setMessages(data.messages);
        }
        setPage(pageNumber);
        setHasMore(Boolean(data.hasMore));
      }
      return data;
    } finally {
      setIsLoadingMore(false);
      skipScrollToBottom.current = prepend;
    }
  };

  const loadMessages = async () => {
    if (!selectedUser || !selectedUser._id) return;
    setPage(1);
    setHasMore(false);
    setSearchQuery("");
    setCurrentMatchIndex(0);
    setShowSearchPanel(false);
    messageRefs.current = {};
    
    if (chatType === "group") {
      joinGroup(selectedUser._id);
      await getGroupMessages(selectedUser._id);
    } else {
      leaveGroupSocket(selectedUser._id);
      await getMessages(selectedUser._id);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [selectedUser, chatType]);

  useEffect(() => {
    return () => {
      if (selectedUser && chatType === "group") {
        leaveGroupSocket(selectedUser._id);
      }
    };
  }, [selectedUser]);

  useEffect(() => {
    if (showSearchPanel && searchInputRef) {
      searchInputRef.focus();
    }
  }, [showSearchPanel, searchInputRef]);

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchResults.length]);

  useEffect(() => {
    if (skipScrollToBottom.current) {
      skipScrollToBottom.current = false;
      return;
    }

    if (!hasSearch && scrollEnd.current && messages) {
      scrollEnd.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, hasSearch]);

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  useEffect(() => {
    if (!hasSearch || !activeSearch) return;
    const activeElement = messageRefs.current[activeSearch.id];
    if (activeElement?.scrollIntoView) {
      activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeSearch, hasSearch]);

  const chatName = chatType === "group" ? (selectedUser?.name || "Group") : (selectedUser?.fullName || "Chat");
  const chatAvatar = chatType === "group" 
    ? (selectedUser?.groupPic || null) 
    : selectedUser?.profilePic;
  const participantCount = chatType === "group" 
    ? selectedUser?.participants?.length || 0 
    : null;
  const isGroupAdmin = chatType === "group" && selectedUser?.admin?._id === authUser?._id;
  const isGroupOnline = chatType === "group" || (selectedUser?._id && onlineUsers.includes(selectedUser._id));
  const isTyping = chatType === "group" 
    ? groupTypingUsers[selectedUser?._id] 
    : (selectedUser?._id ? typingUsers[selectedUser._id] : false);

  if (!selectedUser || !selectedUser._id) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8">
        <div className="size-24 rounded-full bg-teal-500/10 flex items-center justify-center mb-6">
          <MessageCircleMore size={56} className="text-teal-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to ChatMate</h2>
        <p className="text-gray-400 text-center">Select a chat or group to start messaging</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-scroll relative backdrop-blur-lg">
      {/* header  */}
      <div className="flex flex-col gap-3 py-2.5 px-2 bg-gray-900 md:px-5 border-b border-neutral-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center gap-3 ">
            <ArrowLeft
              onClick={() => {
                setSelectedUser(null);
                setChatType("direct");
              }}
              className="md:hidden size-6 cursor-pointer text-gray-400 hover:text-white "
            />
            {chatType === "group" ? (
              <div className="size-10 rounded-full bg-teal-600 flex items-center justify-center">
                {chatAvatar ? (
                  <img src={chatAvatar} className="size-10 rounded-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">#</span>
                )}
              </div>
            ) : (
              <img
                src={getAvatarUrl(selectedUser?.profilePic)}
                className="size-10 rounded-full object-cover"
              />
            )}

            <div>
              <p className="text-lg text-white font-medium">{chatName}</p>
              {chatType === "group" ? (
                <span className="text-xs text-teal-400">
                  {participantCount} members
                </span>
              ) : selectedUser?._id ? (
                <StatusIndicator 
                  isOnline={selectedUser?._id && onlineUsers.includes(selectedUser._id)}
                  isTyping={selectedUser?._id && typingUsers[selectedUser._id]}
                  lastSeen={selectedUser?._id && lastSeen[selectedUser._id] ? formatLastSeen(lastSeen[selectedUser._id]) : null}
                />
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-center text-gray-400 gap-4">
            <Phone className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
            <Search
              onClick={() => setShowSearchPanel(true)}
              className={`w-5 h-5 cursor-pointer transition-colors ${showSearchPanel ? 'text-teal-400' : 'hover:text-white'}`}
            />
            {showSearchPanel && (
              <button
                onClick={() => {
                  setShowSearchPanel(false);
                  setSearchQuery("");
                  setCurrentMatchIndex(0);
                }}
                className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-700"
              >
                ✕
              </button>
            )}
            <EllipsisVertical className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
          </div>
        </div>

        {showSearchPanel ? (
          <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
            <div className="relative flex items-center gap-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={setSearchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                type="text"
                placeholder="Search messages..."
                autoFocus
                className="w-full rounded-full bg-gray-800 border border-teal-500/50 px-10 py-2 text-sm text-white outline-none focus:border-teal-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-12 text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSearchPanel(false);
                  setSearchQuery("");
                  setCurrentMatchIndex(0);
                }}
                className="absolute right-2 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-2">
                {searchQuery ? (
                  searchResults.length > 0 ? (
                    <span className="text-teal-400">{`${currentMatchIndex + 1} of ${searchResults.length}`}</span>
                  ) : (
                    <span className="text-gray-500">No results</span>
                  )
                ) : (
                  <span>Type to search</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={!searchResults.length}
                  onClick={() =>
                    setCurrentMatchIndex((value) =>
                      value === 0 ? searchResults.length - 1 : value - 1
                    )
                  }
                  className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={!searchResults.length}
                  onClick={() =>
                    setCurrentMatchIndex((value) =>
                      value === searchResults.length - 1 ? 0 : value + 1
                    )
                  }
                  className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  ↓
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* chaTBox */}
      <div
        ref={chatBoxRef}
        onScroll={() => {
          if (
            chatBoxRef.current?.scrollTop <= 120 &&
            !isLoadingMore &&
            hasMore &&
            !hasSearch
          ) {
            loadMessagesPage(page + 1, { prepend: true });
          }
        }}
        className="flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-3 pb-6 "
      >
        {isLoadingMore ? (
          <div className="mb-4 text-center text-xs uppercase tracking-[0.3em] text-gray-400">
            Loading earlier messages...
          </div>
        ) : null}
        {messages.map((msg, index) => {
          const senderIdStr = msg.senderId?._id || msg.senderId;
          const isMine = senderIdStr === authUser._id;
          const senderName = msg.senderId?.fullName || "Unknown";
          const senderPic = msg.senderId?.profilePic;
          const statusColor =
            msg.status === "read"
              ? "text-teal-400"
              : "text-gray-400";
          const msgId = msg._id?.toString() || index.toString();
          const isMatch = hasSearch && searchResults.some((result) => result.id === msgId);
          const isActiveMatch = hasSearch && activeSearch?.id === msgId;

          return (
            <div
              key={msgId}
              ref={(el) => {
                if (el) messageRefs.current[msgId] = el;
              }}
              className={`flex items-end gap-2 justify-end ${!isMine && "flex-row-reverse"}`}
            >
              <div className="flex flex-col items-end gap-1 mb-8 max-w-[230px]">
                <div className="relative group">
                  {msg.deleted ? (
                    <div className="p-2 max-w-[200px] md:text-sm font-normal rounded-2xl break-all bg-gray-800 text-gray-300 italic">
                      This message was deleted
                    </div>
                  ) : msg.image ? (
                    <img
                      src={msg.image}
                      className={`w-full rounded-2xl overflow-hidden ${
                        isMine ? "border border-gray-700" : "border border-gray-200 bg-white"
                      } ${isActiveMatch ? "ring-2 ring-yellow-300" : isMatch ? "ring-1 ring-yellow-200" : ""}`}
                    />
                  ) : editingMessageId === msgId ? (
                    <div className="flex flex-col gap-2 w-full">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-2xl border border-neutral-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none"
                      />
                      <div className="flex gap-2 self-end">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMessageId(null);
                            setEditingText("");
                          }}
                          className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-gray-300 hover:bg-neutral-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!editingText.trim()) {
                              toast.error("Message cannot be empty");
                              return;
                            }
                            await editMessage(msgId, editingText.trim());
                            setEditingMessageId(null);
                            setEditingText("");
                            setOpenMessageMenuId(null);
                          }}
                          className="rounded-full bg-teal-600 px-3 py-1 text-xs text-white hover:bg-teal-500"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`p-2 max-w-[200px] md:text-sm font-normal rounded-2xl break-all ${
                        isMine
                          ? "bg-teal-700 text-white rounded-br-none"
                          : "bg-white text-slate-900 border border-gray-200 rounded-bl-none shadow-sm"
                      } ${isActiveMatch ? "ring-2 ring-yellow-300" : isMatch ? "ring-1 ring-yellow-200" : ""}`}
                    >
                      {highlightText(msg.text, searchQuery)}
                      {msg.edited && !msg.deleted ? (
                        <span className="ml-1 text-[10px] font-medium text-slate-200">(edited)</span>
                      ) : null}
                    </div>
                  )}

                  {isMine && !msg.deleted && editingMessageId !== msgId && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMessageMenuId(openMessageMenuId === msgId ? null : msgId);
                        }}
                        className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-full bg-black/30 p-1 text-slate-200 hover:bg-black/40"
                      >
                        <EllipsisVertical size={16} />
                      </button>
                      {openMessageMenuId === msgId && (
                        <div className="absolute right-0 top-8 z-10 w-36 rounded-xl border border-neutral-700 bg-slate-900 p-2 shadow-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId(msgId);
                              setEditingText(msg.text || "");
                              setOpenMessageMenuId(null);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMessageMenuId(null);
                              if (window.confirm("Delete this message?")) {
                                deleteMessage(msgId);
                              }
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-slate-800"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {isMine && msg.deleted && (
                    <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <span className="text-[10px] text-gray-500 italic">deleted</span>
                    </div>
                  )}
                </div>

                {isMine && (
                  <div className="flex items-center gap-1 self-end text-[10px] text-gray-400">
                    <span className={`${statusColor} inline-flex`}>
                      {msg.status === "sent" ? (
                        <svg
                          viewBox="0 0 16 16"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3.5 8.5L6.5 11.5L13 5" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 16 16"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2.5 9L6 12.5L10.5 8" />
                          <path d="M6.5 9.2L10 12.5L14.5 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-gray-400">{formatMessageTime(msg.createdAt)}</span>
                  </div>
                )}
              </div>

              {!isMine && (
                <div className="text-center text-xs">
                  {chatType === "group" ? (
                    <>
                      <img
                        src={getAvatarUrl(senderPic)}
                        className="w-7 rounded-full object-cover"
                      />
                      <p className="text-teal-400 text-[10px]">{senderName}</p>
                      <p className="text-gray-500">{formatMessageTime(msg.createdAt)}</p>
                    </>
                  ) : (
                    <>
                      <img
                        src={getAvatarUrl(selectedUser?.profilePic)}
                        className="w-7 rounded-full object-cover"
                      />
                      <p className="text-gray-500">{formatMessageTime(msg.createdAt)}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div ref={scrollEnd}></div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 flex items-center  p-3">
        <div className="flex-1 flex items-center bg-gray-100/12 px-3 rounded-full mx-2">
          <input
            onChange={(e) => {
              setInput(e.target.value);
              emitTyping(e.target.value.length > 0);
            }}
            value={input}
            onKeyDown={(e) => (e.key === "Enter" ? handleSendMessage(e) : null)}
            type="text"
            placeholder="send a message"
            className="flex-1 text-sm p-4 border-none rounded-lg outline-none text-white placeholder-gray-400"
          />
          <input
            onChange={handleSendImage}
            type="file"
            id="image"
            accept="image/png, image/jpeg"
            hidden
          />
          <label
            htmlFor="image"
            className="cursor-pointer p-2 hover:bg-neutral-600/20 rounded-full"
          >
            <Image className="size-5 text-neutral-400 " />
          </label>
        </div>

        <button
          className="p-2.5 bg-teal-600 hover:bg-teal-700 rounded-full text-neutral-100  cursor-pointer"
          onClick={handleSendMessage}
        >
          <ArrowBigUp strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

export default ChatContainer;
