import { createContext, useEffect, useRef } from "react";
import axios from 'axios'
import { useState } from "react";
import { io } from "socket.io-client"
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
axios.defaults.baseURL = backendUrl;

export const AuthContext = createContext();

export const AuthProvider = ({ children  })=>{

    const [token, setToken] = useState(localStorage.getItem("token"));
    const [authUser, setAuthUser] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [socket, setSocket] = useState(null);
    const [loading, setLoading] = useState(false);
    const [lastSeen, setLastSeen] = useState({});
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;
    const navigate = useNavigate();


    //check if user is authenticated if so, set the user data and connect
    //the socket
    const checkAuth = async()=>{
        try {
            const { data } = await axios.get("/api/auth/check");
            if(data.success){
                setAuthUser(data.user)
                if (data.user.lastSeen) {
                    setLastSeen(data.user.lastSeen);
                }
                connectSocket(data.user)
            }
        } catch (error) {
            if (error.response?.status === 401) {
                await handleTokenExpiry();
            } else {
                console.error("Auth check failed:", error.message);
            }
        }
    }

    const handleTokenExpiry = async () => {
        const storedToken = localStorage.getItem("token");
        if (storedToken) {
            try {
                const { data } = await axios.post("/api/auth/refresh-token", {}, {
                    headers: { token: storedToken }
                });
                if (data.success && data.token) {
                    setToken(data.token);
                    localStorage.setItem("token", data.token);
                    axios.defaults.headers.common["token"] = data.token;
                    reconnectAttempts.current = 0;
                    await checkAuth();
                } else {
                    await logout();
                    navigate("/login");
                }
            } catch {
                await logout();
                navigate("/login");
            }
        }
    }

    // login function to handle user authentication and socket connection

    const login = async (state, credentials)=>{
        setLoading(true);
        try {
            const { data } = await axios.post(`/api/auth/${state}`, credentials);
            if(data.success){
                setAuthUser(data.userData);
                connectSocket(data.userData);
                axios.defaults.headers.common["token"] = data.token;
                setToken(data.token);
                localStorage.setItem("token", data.token)
                toast.success(data.message)
            }else{
                toast.error(data.message)
                
            }
        } catch (error) {
            toast.error(error.message)
        }finally{
             setLoading(false);
        }
    }

    //logout function to handle user logout and socket disconnection

    const logout = async ()=>{
        localStorage.removeItem("token");
        setToken(null);
        setAuthUser(null);
        setOnlineUsers([]);
        axios.defaults.headers.common["token"] = null;
        toast.success("Logged out successfully")
        socket.disconnect();
    }

    // update profile function to handle user profile updates

    const updateProfile = async (body)=>{
        try {
            const { data } = await axios.put("/api/auth/update-profile", body);
            if(data.success){
                setAuthUser(data.user);
                toast.success("profile updated successfully")
            }
            
        } catch (error) {
            toast.error(error.message)
            
        }
    }

    // connect socket function to handle socket connection and online users updates
    const connectSocket = (userData, forceReconnect = false)=>{
        if(!userData) return;
        
        if (socket?.connected && !forceReconnect) return;
        
        if (socket) {
            socket.disconnect();
        }

        const token = localStorage.getItem("token");
        
        const newSocket = io(backendUrl, {
            auth: { token },
            query: {
                userId: userData._id,
            },
            reconnection: true,
            reconnectionAttempts: maxReconnectAttempts,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });

        newSocket.on("connect", () => {
            reconnectAttempts.current = 0;
            console.log("Socket connected");
            // Sync missed messages on reconnect
            window.dispatchEvent(new CustomEvent('socketReconnected'));
        });

        newSocket.on("reconnection", (attemptNumber) => {
            reconnectAttempts.current = attemptNumber;
            console.log(`Reconnection attempt ${attemptNumber}`);
        });

        newSocket.on("reconnection_failed", () => {
            console.log("Reconnection failed after max attempts");
            toast.error("Connection lost. Please refresh the page.");
        });

        newSocket.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason);
        });

        newSocket.on("connect_error", (error) => {
            console.error("Socket connection error:", error.message);
        });

        newSocket.on("getOnlineUsers", (userIds)=>{
            setOnlineUsers(userIds);
        });

        newSocket.on("userStatusUpdate", ({ userId, status, lastSeen: userLastSeen }) => {
            if (status === "online") {
                setOnlineUsers(prev => {
                    if (!prev.includes(userId)) {
                        return [...prev, userId];
                    }
                    return prev;
                });
            } else if (status === "offline" && userLastSeen) {
                setLastSeen(prev => ({ ...prev, [userId]: userLastSeen }));
                setOnlineUsers(prev => prev.filter(id => id !== userId));
            }
        });

        setSocket(newSocket);
    }

    const reconnectSocket = () => {
        if (authUser) {
            connectSocket(authUser, true);
        }
    }

    useEffect(()=>{
        if(token){
            axios.defaults.headers.common["token"] = token;
            
            axios.interceptors.request.use(
                (config) => config,
                (error) => Promise.reject(error)
            );
            
            checkAuth()
        }
    },[])

    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;
                    
                    try {
                        await handleTokenExpiry();
                        const newToken = localStorage.getItem("token");
                        if (newToken) {
                            originalRequest.headers["token"] = newToken;
                            return axios(originalRequest);
                        }
                    } catch (refreshError) {
                        await logout();
                        navigate("/login");
                        return Promise.reject(refreshError);
                    }
                }
                
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, [token]);

    const value = {
        axios,
        authUser,
        onlineUsers,
        socket,
        login,
        logout,
        updateProfile,
        loading,
        lastSeen,
        setLastSeen,
        reconnectSocket,
        handleTokenExpiry
    }

    return (
        <AuthContext.Provider value={value}>
        {children}
         </AuthContext.Provider>
    )
}