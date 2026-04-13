import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import { Menu, Search, X } from "lucide-react";
import Skeleton from "./ui/skeleton";
import { getAvatarUrl } from "../lib/utils";
const UserStatusBadge = ({ isOnline }) => (
  <span className={`inline-flex items-center gap-1 text-xs ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
    {isOnline ? 'online' : 'offline'}
  </span>
);

const Sidebar = () => {
  const {
    getUsers,
    users,
    selectedUser,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
    loadingUsers,
  } = useContext(ChatContext);

  const { logout, onlineUsers } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);

  const [input, setInput] = useState("");

  const navigate = useNavigate();

  const filteredUsers = input
    ? users.filter((user) =>
        user.fullName.toLowerCase().includes(input.toLowerCase())
      )
    : users;

  useEffect(() => {
    getUsers();
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
              placeholder="Search users..."
            />
          </div>
        </div>
      </div>

      {/* users list  */}

      {loadingUsers ? (
        <div className="flex flex-col px-1 pb-5">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          <p className="text-sm">No users found</p>
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
      )}
    </div>
  );
};

export default Sidebar;
