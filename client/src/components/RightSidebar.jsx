import React, { useContext, useEffect, useState } from 'react'
import { ChatContext } from '../../context/ChatContext'
import { AuthContext } from '../../context/AuthContext'
import { LogOut, Image as ImageIcon, Clock, MessageCircle, Users, UserPlus, UserMinus, Trash2, Hash, X, Check, Search } from 'lucide-react'
import { getAvatarUrl, formatLastSeen } from '../lib/utils';
import { toast } from 'sonner';

const RightSidebar = () => {
  const { selectedUser, messages, chatType, leaveGroup, users, setSelectedUser, setChatType, setGroups } = useContext(ChatContext)
  const { logout, onlineUsers, lastSeen, axios, authUser } = useContext(AuthContext)
  const [msgImages, setMsgImages] = useState([])
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedToAdd, setSelectedToAdd] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setMsgImages(
      messages.filter(msg => msg.image).map(msg => msg.image)
    )
  }, [messages])

  if (!selectedUser || !selectedUser._id) {
    return (
      <div className="bg-gray-900 border-l border-gray-800 text-white h-full flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 text-sm">Select a chat to view details</p>
      </div>
    );
  }

  const isDirect = chatType === "group" ? false : (selectedUser?._id ? onlineUsers.includes(selectedUser._id) : false);
  const userLastSeen = selectedUser?._id && lastSeen[selectedUser._id] ? formatLastSeen(lastSeen[selectedUser._id]) : null;
  const totalMessages = messages.length;

  const group = selectedUser;

  if (chatType === "group" && group) {
    const participants = group?.participants || [];
    const adminId = group?.admin?._id || group?.admin;
    const userId = authUser?._id;
    const isAdmin = !!(adminId && userId && adminId === userId);
    
    // Debug: Show actual IDs for troubleshooting
    const debugShow = false; // Set to true to see debug info
    if (debugShow) {
      console.log('Group admin:', adminId);
      console.log('User ID:', userId);
      console.log('Is Admin:', isAdmin);
      console.log('Full group:', group);
    }
    
    const availableUsersToAdd = authUser?._id ? (users || []).filter(u => 
      u._id !== authUser._id && 
      !participants.some(p => (p._id || p) === u._id)
    ) : [];
    const filteredUsers = searchQuery 
      ? availableUsersToAdd.filter(u => u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()))
      : availableUsersToAdd

    const handleAddParticipants = async () => {
      if (selectedToAdd.length === 0 || !group?._id) return
      setLoading(true)
      
      let success = false
      try {
        const res = await axios.post(`/api/groups/${group._id}/add`, { userIds: selectedToAdd })
        if (res.data?.success) {
          success = true
          if (res.data.group) {
            setSelectedUser(res.data.group)
            setGroups(prev => prev.map(g => g._id === res.data.group._id ? res.data.group : g))
          }
        } else {
          toast.error(res.data?.message || 'Failed to add participants')
        }
      } catch (error) {
        console.error('Add error:', error.response?.data || error.message)
        if (error.response?.status === 403) {
          toast.error('Only admins can add participants')
        } else if (error.response?.status === 404) {
          toast.error('Group not found')
        } else {
          toast.error('Failed to add participants')
        }
      }
      
      if (success) {
        toast.success('Participants added')
        setShowAddParticipant(false)
        setSelectedToAdd([])
        setSearchQuery('')
      }
      setLoading(false)
    }

    const handleRemoveParticipant = async (userId, userName) => {
      if (!window.confirm(`Remove ${userName} from the group?`)) return
      
      let success = false
      try {
        const res = await axios.post(`/api/groups/${group._id}/remove`, { userId })
        if (res.data?.success) {
          success = true
          if (res.data.group) {
            setSelectedUser(res.data.group)
            setGroups(prev => prev.map(g => g._id === res.data.group._id ? res.data.group : g))
          }
        } else {
          toast.error(res.data?.message || 'Failed to remove participant')
        }
      } catch (error) {
        console.error('Remove error:', error.response?.data || error.message)
        if (error.response?.status === 403) {
          toast.error('Only admins can remove participants')
        } else if (error.response?.status === 404) {
          toast.error('Group not found')
        } else {
          toast.error('Failed to remove participant')
        }
      }
      
      if (success) {
        toast.success('Participant removed')
      }
    }
    
    return (
      <div className="bg-gray-900 border-l border-gray-800 text-white h-full flex flex-col">
        {/* Group Header */}
        <div className='p-6 flex flex-col items-center border-b border-gray-800'>
          <div className='relative mb-3'>
            {group.groupPic ? (
              <img 
                src={group.groupPic} 
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-700 shadow-lg" 
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-teal-600 flex items-center justify-center border-2 border-gray-700 shadow-lg">
                <Hash className="w-10 h-10 text-white" />
              </div>
            )}
          </div>
          
          <h2 className='text-lg font-semibold text-white text-center'>{group.name}</h2>
          <p className='text-xs text-teal-400 mt-1'>{participants.length} members</p>
        </div>

        {/* Participants List */}
        <div className='flex-1 overflow-y-auto p-4'>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='text-sm font-medium text-gray-300 flex items-center gap-2'>
              <Users className='w-4 h-4' />
              Members ({participants.length})
            </h3>
            {isAdmin ? (
              <button
                onClick={() => {
                  console.log('Add button clicked, isAdmin:', isAdmin);
                  setShowAddParticipant(true);
                }}
                className='text-xs flex items-center gap-1 text-teal-400 hover:text-teal-300 font-bold'
              >
                <UserPlus className='w-3 h-3' />
                Add [ADMIN]
              </button>
            ) : (
              <span className='text-xs text-gray-500'>Member</span>
            )}
          </div>
          <div className='space-y-2'>
            {participants.map((participant, idx) => {
              const participantId = participant._id || participant;
              const isParticipantOnline = onlineUsers.includes(participantId);
              const isParticipantAdmin = adminId === participantId;
              const isSelf = authUser && participantId === authUser._id;
              
              return (
                <div key={idx} className='flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 group'>
                  <div className="relative">
                    <img 
                      src={getAvatarUrl(participant.profilePic)} 
                      className="w-10 h-10 rounded-full object-cover" 
                    />
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${
                      isParticipantOnline ? 'bg-green-500' : 'bg-gray-500'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{participant.fullName}{isSelf && ' (You)'}</p>
                    {isParticipantAdmin && (
                      <span className="text-xs text-teal-400">admin</span>
                    )}
                  </div>
                  {isAdmin && !isSelf && !isParticipantAdmin && (
                    <button
                      onClick={() => handleRemoveParticipant(participantId, participant.fullName)}
                      className='opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-red-400 rounded-full transition-all'
                    >
                      <UserMinus className='w-4 h-4' />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Leave Group Button */}
        <div className='p-4 border-t border-gray-800'>
          <button
            onClick={() => {
              if (window.confirm(`Leave "${group.name}"?`)) {
                leaveGroup(group._id);
              }
            }}
            className='w-full py-2.5 bg-gray-800 hover:bg-red-100/5 text-red-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-gray-700'
          >
            <UserMinus className="w-4 h-4" />
            Leave Group
          </button>
        </div>

        {/* Add Participant Modal */}
        {showAddParticipant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddParticipant(false)} />
            <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm mx-4 max-h-[70vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">Add Participants</h3>
                <button onClick={() => setShowAddParticipant(false)} className="p-1 hover:bg-gray-800 rounded">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-4 border-b border-gray-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto p-2">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(user => (
                    <div
                      key={user._id}
                      onClick={() => {
                        setSelectedToAdd(prev => 
                          prev.includes(user._id) ? prev.filter(id => id !== user._id) : [...prev, user._id]
                        )
                      }}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
                        selectedToAdd.includes(user._id) ? "bg-teal-500/20" : "hover:bg-gray-800"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        selectedToAdd.includes(user._id) ? "bg-teal-500 border-teal-500" : "border-gray-600"
                      }`}>
                        {selectedToAdd.includes(user._id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <img src={getAvatarUrl(user.profilePic)} alt={user.fullName} className="w-8 h-8 rounded-full" />
                      <span className="text-sm text-white">{user.fullName}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 text-sm py-4">No users available to add</p>
                )}
              </div>
              {selectedToAdd.length > 0 && (
                <div className="p-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">{selectedToAdd.length} selected</p>
                  <button
                    onClick={handleAddParticipants}
                    disabled={loading}
                    className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Add Participants
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return selectedUser && (
    <div className="bg-gray-900 border-l border-gray-800 text-white h-full flex flex-col">
      
      {/* Profile Section */}
      <div className='p-6 flex flex-col items-center border-b border-gray-800'>
        <div className='relative mb-3'>
          <img 
            src={getAvatarUrl(selectedUser?.profilePic)} 
            className="w-24 h-24 rounded-full object-cover border-2 border-gray-700 shadow-lg" 
            onError={(e) => e.target.src = getAvatarUrl(null)}
          />
          {isDirect && (
            <span className='absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-3 border-gray-900 animate-pulse shadow-sm'></span>
          )}
        </div>
        
        <h2 className='text-lg font-semibold text-white'>{selectedUser.fullName}</h2>
        <div className={`flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full ${
          isDirect ? 'bg-green-500/10' : 'bg-gray-800/50'
        }`}>
          {isDirect ? (
            <>
              <span className='w-2 h-2 bg-green-400 rounded-full animate-pulse' />
              <span className='text-xs text-green-400 font-medium'>online</span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3 text-gray-500" />
              <span className='text-xs text-gray-500'>{userLastSeen || 'offline'}</span>
            </>
          )}
        </div>
        {selectedUser.bio && (
          <p className='text-sm text-gray-400 text-center mt-3 px-4'>{selectedUser.bio}</p>
        )}
      </div>

      {/* Stats Section */}
      <div className='p-4 border-b border-gray-800'>
        <h3 className='text-sm font-medium text-gray-300 mb-3'>Conversation</h3>
        <div className='grid grid-cols-2 gap-3'>
          <div className='bg-gray-800/50 rounded-lg p-3 flex flex-col items-center'>
            <MessageCircle className='w-5 h-5 text-teal-500 mb-1' />
            <span className='text-lg font-semibold text-white'>{totalMessages}</span>
            <span className='text-xs text-gray-500'>messages</span>
          </div>
          <div className='bg-gray-800/50 rounded-lg p-3 flex flex-col items-center'>
            <ImageIcon className='w-5 h-5 text-teal-500 mb-1' />
            <span className='text-lg font-semibold text-white'>{msgImages.length}</span>
            <span className='text-xs text-gray-500'>media</span>
          </div>
        </div>
      </div>

      {/* Media Section */}
      <div className='flex-1 overflow-y-auto p-4'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-sm font-medium text-white flex items-center gap-2'>
            <ImageIcon className='w-4 h-4 text-teal-500' />
            Media
          </h3>
          <span className='text-xs text-gray-500'>{msgImages.length}</span>
        </div>

        {msgImages.length > 0 ? (
          <div className='grid grid-cols-2 gap-2'>
            {msgImages.map((url, index) => (
              <div
                key={index}
                onClick={() => window.open(url)}
                className='aspect-square cursor-pointer rounded-lg overflow-hidden hover:opacity-75 transition-opacity border border-gray-800'>
                <img 
                  src={url} 
                  className="w-full h-full object-cover" 
                  alt={`Media ${index + 1}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center py-8 text-gray-500'>
            <ImageIcon className='w-12 h-12 mb-2 opacity-50' />
            <p className='text-xs'>No shared media yet</p>
          </div>
        )}
      </div>

      {/* Logout Button */}
      <div className='p-4 border-t border-gray-800'>
        <button
          onClick={() => logout()}
          className='w-full py-2.5 bg-gray-800 hover:bg-red-100/5 text-red-400  rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-gray-700 cursor-pointer'>
          <LogOut className='w-4 h-4' />
          Logout
        </button>
      </div>
    </div>
  )
}

export default RightSidebar