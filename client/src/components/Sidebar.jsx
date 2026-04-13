import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import { Menu, Search, X, Users, Plus, MessageCircle, Hash } from "lucide-react";
import Skeleton from "./ui/skeleton";
import { getAvatarUrl } from "../lib/utils";
import CreateGroupModal from "./CreateGroupModal";

const UserStatusBadge = ({ isOnline }) => (
  <span className={`inline-flex items-center gap-1 text-xs ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
    {isOnline ? 'online' : 'offline'}
  </span>
);

const Sidebar = () => {
  const {
    getUsers,
    getGroups,
    users,
    groups,
    selectedUser,
    setSelectedUser,
    setChatType,
    unseenMessages,
    setUnseenMessages,
    loadingUsers,
  } = useContext(ChatContext);

  const { logout, onlineUsers } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [activeTab, setActiveTab] = useState("chats");

  const [input, setInput] = useState("");

  const navigate = useNavigate();

  const filteredUsers = input
    ? users.filter((user) =>
        user.fullName.toLowerCase().includes(input.toLowerCase())
      )
    : users;

  const filteredGroups = input
    ? groups.filter((group) =>
        group.name.toLowerCase().includes(input.toLowerCase())
      )
    : groups;

  useEffect(() => {
    getUsers();
    getGroups();
  }, [onlineUsers]);

  return (
    <div className="h-full bg-gray-900 border-r border-neutral-800 pt-0 overflow-y-scroll scroll-smooth text-white">
      {/* header  */}
      <div className="sticky bg-gray-900 top-0 p-4 pb-3 z-10 w-full border-b border-neutral-700">
        <div className="flex justify-between items-center">
          {/* menu  */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {menuOpen && (
              <div className="absolute top-12 left-0 w-44 bg-gray-800 shadow-xl border border-gray-700 rounded-lg p-2 z-20 animate-in slide-in-from-top-1">
                <p
                  onClick={() => {
                    navigate("/profile");
                    setMenuOpen(false);
                  }}
                  className="cursor-pointer text-sm p-2.5 hover:bg-gray-700 rounded transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7h" />
                  </svg>
                  Edit profile
                </p>
                <hr className="my-2 border-gray-700" />
                <p
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="cursor-pointer text-sm p-2.5 hover:bg-gray-700 rounded transition-colors text-red-400 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </p>
              </div>
            )}
          </div>

          {/* search  */}
          <div className="relative flex-1 ml-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              type="text"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-800 rounded-full text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
              placeholder={activeTab === "groups" ? "Search groups..." : "Search chats..."}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-2 border-b border-gray-800">
        <button
          onClick={() => setActiveTab("chats")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "chats"
              ? "bg-teal-500/20 text-teal-400"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Chats
          </div>
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "groups"
              ? "bg-teal-500/20 text-teal-400"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Users className="w-4 h-4" />
            Groups
          </div>
        </button>
      </div>

      {/* Create Group Button (visible in groups tab) */}
      {activeTab === "groups" && (
        <div className="px-4 py-3">
          <button
            onClick={() => setShowCreateGroup(true)}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create New Group
          </button>
        </div>
      )}

      {/* Content based on active tab */}
      {loadingUsers ? (
        <div className="flex flex-col px-1 pb-5">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} />
          ))}
        </div>
      ) : activeTab === "chats" ? (
        filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">No chats found</p>
          </div>
        ) : (
          <div className="flex flex-col px-1 pb-5">
            {filteredUsers.map((user, index) => {
              const isOnline = onlineUsers.includes(user._id);
              const hasUnseen = unseenMessages[user._id] > 0;
              
              return (
                <div
                  onClick={() => {
                    setSelectedUser(user);
                    setChatType("direct");
                    setUnseenMessages((prev) => ({ ...prev, [user._id]: 0 }));
                  }}
                  key={user._id || index}
                  className={`relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    selectedUser?._id === user._id
                      ? "bg-teal-500/20 border-l-2 border-teal-500"
                      : "hover:bg-gray-800/70 border-l-2 border-transparent"
                  }`}
                >
                  <div className="relative">
                    <img
                      src={getAvatarUrl(user?.profilePic)}
                      alt={user.fullName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-700"
                    />
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${
                      isOnline ? 'bg-green-500' : 'bg-gray-500'
                    }`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{user.fullName}</p>
                      {hasUnseen && (
                        <span className="min-w-[18px] h-5 px-1.5 flex items-center justify-center bg-teal-500 rounded-full text-xs font-medium">
                          {unseenMessages[user._id]}
                        </span>
                      )}
                    </div>
                    <UserStatusBadge isOnline={isOnline} />
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Users className="w-12 h-12 mb-2 opacity-50" />
          <p className="text-sm">No groups yet</p>
          <p className="text-xs text-gray-600 mt-1">Create a group to start chatting</p>
        </div>
      ) : (
        <div className="flex flex-col px-1 pb-5">
          {filteredGroups.map((group, index) => {
            const participantCount = group.participants?.length || 0;
            
            return (
              <div
                onClick={() => {
                  setSelectedUser(group);
                  setChatType("group");
                }}
                key={group._id || index}
                className={`relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  selectedUser?._id === group._id
                    ? "bg-teal-500/20 border-l-2 border-teal-500"
                    : "hover:bg-gray-800/70 border-l-2 border-transparent"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center border-2 border-gray-700">
                  {group.groupPic ? (
                    <img src={group.groupPic} alt={group.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <Hash className="w-6 h-6 text-white" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{group.name}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {participantCount} members
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateGroupModal 
        isOpen={showCreateGroup} 
        onClose={() => setShowCreateGroup(false)} 
      />
    </div>
  );
};

export default Sidebar;
