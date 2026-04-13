import React, { useContext, useEffect, useState } from 'react'
import assets from '../assets/assets'
import { ChatContext } from '../../context/ChatContext'
import { AuthContext } from '../../context/AuthContext'
import { LogOut, Image as ImageIcon, Clock, MessageCircle } from 'lucide-react'
import { getAvatarUrl, formatLastSeen } from '../lib/utils';

const RightSidebar = () => {
  const { selectedUser, messages } = useContext(ChatContext)
  const { logout, onlineUsers, lastSeen } = useContext(AuthContext)
  const [msgImages, setMsgImages] = useState([])

  useEffect(() => {
    setMsgImages(
      messages.filter(msg => msg.image).map(msg => msg.image)
    )
  }, [messages])

  const isOnline = onlineUsers.includes(selectedUser._id);
  const userLastSeen = lastSeen[selectedUser._id] ? formatLastSeen(lastSeen[selectedUser._id]) : null;
  const totalMessages = messages.length;
  const myMessages = messages.filter(m => m.senderId === selectedUser._id).length;

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
          {isOnline && (
            <span className='absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-3 border-gray-900 animate-pulse shadow-sm'></span>
          )}
        </div>
        
        <h2 className='text-lg font-semibold text-white'>{selectedUser.fullName}</h2>
        <div className={`flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full ${
          isOnline ? 'bg-green-500/10' : 'bg-gray-800/50'
        }`}>
          {isOnline ? (
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