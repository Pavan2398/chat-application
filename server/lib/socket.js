import { Server } from "socket.io";

export let io = null;

export const initIO = (server) => {
    io = new Server(server, {
        cors: { origin: "*" }
    });

    return io;
};

export const getIO = () => io;