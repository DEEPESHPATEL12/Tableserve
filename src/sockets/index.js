const { socketAuthMiddleware } = require("./socketAuth");
const restaurantModel = require("../models/restaurant.model");

/**
 * Room naming convention (must match the rooms emitted to in order.controller.js):
 *   - customer:<userId>       - a single customer's private channel for order status updates
 *   - restaurant:<restaurantId> - a restaurant's channel for incoming new-order notifications
 *
 * A restaurant_admin who owns multiple restaurants joins ALL of their restaurant rooms,
 * so their dashboard gets live updates regardless of which restaurant an order came from.
 */
function initSocket(io) {
  io.use(socketAuthMiddleware);

  io.on("connection", async (socket) => {
    const { id: userId, role } = socket.user;
    console.log(`Socket connected: ${socket.id} (user ${userId}, role ${role})`);

    if (role === "customer") {
      socket.join(`customer:${userId}`);
    }

    if (role === "restaurant_admin" || role === "super_admin") {
      try {
        const restaurants = await restaurantModel.findByOwner(userId);
        restaurants.forEach((r) => socket.join(`restaurant:${r.id}`));
        console.log(`  -> joined ${restaurants.length} restaurant room(s)`);
      } catch (err) {
        console.error("Failed to join restaurant rooms:", err.message);
      }
    }

    // Lets the client's UI show a "connected" indicator once rooms are actually joined
    socket.emit("connected", { userId, role });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initSocket };
