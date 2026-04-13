# MERN Stack Chat Application

A real-time chat application built with the MERN stack (MongoDB, Express.js, React.js, Node.js) and Socket.io for seamless real-time communication.

## Features

- **Real-time messaging** with Socket.io
- **User authentication** with JWT tokens
- **Private and group chat** functionality
- **Online user status** indicators
- **Responsive design** for mobile and desktop
- **Message notifications**

## Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Socket.io** - Real-time communication
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **cors** - Cross-origin resource sharing

### Frontend
- **React.js** - Frontend library
- **Socket.io-client** - Client-side real-time communication
- **Axios** - HTTP client
- **React Router** - Client-side routing
- **Context API** - State management

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

 
<!-- One-to-one “read receipts” (message states: sent/delivered/read) in UI #1 -->
<!-- Message delete / edit (server DELETE /messages/:id, PATCH /messages/:id) -->
<!-- Search messages by keyword in chat history #2 -->
Group chat room support (new model and socket room join)
User statuses (away/busy) with setting in profile 
@mentions, emoji picker, reactions
Pagination on message history (infinite scroll) #3
Optimize unseen counter by exact unseen field in user & query + backend socket update
Web push notifications for offline messages