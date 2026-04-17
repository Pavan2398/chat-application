import React, { useState, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import { toast } from "sonner";
import { X, Users, Plus, Check, Search, Image as ImageIcon } from "lucide-react";

const CreateGroupModal = ({ isOpen, onClose }) => {
  const { axios, authUser } = useContext(AuthContext);
  const { users, setSelectedUser, setChatType, setGroups } = useContext(ChatContext);
  
  const [groupName, setGroupName] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [groupPic, setGroupPic] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const availableUsers = users.filter(u => u._id !== authUser._id);
  const filteredUsers = searchQuery
    ? availableUsers.filter(u => 
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableUsers;

  const toggleParticipant = (userId) => {
    setSelectedParticipants(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    if (selectedParticipants.length < 2) {
      toast.error("Select at least 2 participants");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post("/api/groups/create", {
        name: groupName.trim(),
        participantIds: selectedParticipants,
        groupPic
      });

      if (data.success) {
        toast.success("Group created successfully!");
        setGroups(prev => [data.group, ...prev]);
        setSelectedUser(data.group);
        setChatType("group");
        onClose();
        setGroupName("");
        setSelectedParticipants([]);
        setGroupPic("");
      } else {
        toast.error(data.message || "Failed to create group");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectImage = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setGroupPic(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-500" />
            <h2 className="text-lg font-semibold text-white">Create Group</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Group Name Input */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <label className="cursor-pointer relative">
              <div className="w-14 h-14 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden">
                {groupPic ? (
                  <img src={groupPic} alt="Group" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-gray-500" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleSelectImage}
                className="hidden"
              />
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* Participants Selection */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-teal-500" />
            <span className="text-sm text-gray-400">Add Participants</span>
            <span className="text-xs text-teal-500 bg-teal-500/10 px-2 py-0.5 rounded-full">
              {selectedParticipants.length} selected
            </span>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredUsers.map(user => (
              <div
                key={user._id}
                onClick={() => toggleParticipant(user._id)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedParticipants.includes(user._id)
                    ? "bg-teal-500/20"
                    : "hover:bg-gray-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  selectedParticipants.includes(user._id)
                    ? "bg-teal-500 border-teal-500"
                    : "border-gray-600"
                }`}>
                  {selectedParticipants.includes(user._id) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <img
                  src={user.profilePic || "/default-avatar.png"}
                  alt={user.fullName}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div className="flex-1">
                  <p className="text-sm text-white">{user.fullName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Preview */}
        {selectedParticipants.length > 0 && (
          <div className="p-4 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Selected</p>
            <div className="flex flex-wrap gap-2">
              {selectedParticipants.slice(0, 5).map((id, idx) => {
                const user = users.find(u => u._id === id);
                return user ? (
                  <div
                    key={idx}
                    className="flex items-center gap-1 bg-gray-800 rounded-full pr-2"
                  >
                    <img
                      src={user.profilePic || "/default-avatar.png"}
                      alt={user.fullName}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-xs text-gray-300">{user.fullName.split(" ")[0]}</span>
                  </div>
                ) : null;
              })}
              {selectedParticipants.length > 5 && (
                <span className="text-xs text-gray-500 self-center">
                  +{selectedParticipants.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={loading || selectedParticipants.length < 2}
            className={`flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
              (loading || selectedParticipants.length < 2) ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Group
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;