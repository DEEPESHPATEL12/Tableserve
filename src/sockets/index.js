// Full Socket.io event wiring added in Phase 5
function initSocket(io) {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    socket.on("disconnect", () => console.log("Socket disconnected:", socket.id));
  });
}
module.exports = { initSocket };
