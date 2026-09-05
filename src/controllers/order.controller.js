const orderModel = require("../models/order.model");
const menuItemModel = require("../models/menuItem.model");
const restaurantModel = require("../models/restaurant.model");

/**
 * Customer places an order. Body: { restaurantId, items: [{menuItemId, quantity}], deliveryAddress, notes }
 * We re-fetch every menu item from the DB and validate it before trusting anything the client sent.
 */
async function placeOrder(req, res, next) {
  try {
    const { restaurantId, items, deliveryAddress, notes } = req.body;

    if (!restaurantId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "restaurantId and a non-empty items array are required" });
    }

    const restaurant = await restaurantModel.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });
    if (!restaurant.is_open) return res.status(400).json({ error: "This restaurant is currently closed" });

    // Validate quantities up front
    for (const item of items) {
      if (!item.menuItemId || !Number.isInteger(item.quantity) || item.quantity < 1) {
        return res.status(400).json({ error: "Each item needs a valid menuItemId and quantity >= 1" });
      }
    }

    const menuItemIds = items.map((i) => i.menuItemId);
    const dbMenuItems = await menuItemModel.findByIds(menuItemIds);
    const dbMenuItemsById = new Map(dbMenuItems.map((m) => [m.id, m]));

    const resolvedItems = [];
    for (const { menuItemId, quantity } of items) {
      const menuItem = dbMenuItemsById.get(menuItemId);

      if (!menuItem) {
        return res.status(400).json({ error: `Menu item ${menuItemId} does not exist` });
      }
      if (menuItem.restaurant_id !== restaurantId) {
        return res.status(400).json({ error: `Menu item "${menuItem.name}" does not belong to this restaurant` });
      }
      if (!menuItem.is_available) {
        return res.status(400).json({ error: `"${menuItem.name}" is currently unavailable` });
      }

      resolvedItems.push({ menuItem, quantity });
    }

    const order = await orderModel.createWithItems({
      customerId: req.user.id,
      restaurantId,
      items: resolvedItems,
      deliveryAddress,
      notes,
    });

    // Real-time notification hook - the actual room/event wiring is built out in Phase 5
    const io = req.app.get("io");
    if (io) io.to(`restaurant:${restaurantId}`).emit("order:new", { orderId: order.id });

    const fullOrder = await orderModel.findByIdWithItems(order.id);
    res.status(201).json({ order: fullOrder });
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const order = await orderModel.findByIdWithItems(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const isCustomerOwner = order.customer_id === req.user.id;
    const isRestaurantOwner = await restaurantModel.isOwnedBy(order.restaurant_id, req.user.id);
    const isSuperAdmin = req.user.role === "super_admin";

    if (!isCustomerOwner && !isRestaurantOwner && !isSuperAdmin) {
      return res.status(403).json({ error: "You don't have access to this order" });
    }

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

async function myOrders(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;
    const orders = await orderModel.findByCustomer(req.user.id, { limit, offset });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

/** Restaurant admin: view orders for a restaurant they own, optionally filtered by status */
async function restaurantOrders(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const owns = req.user.role === "super_admin" || (await restaurantModel.isOwnedBy(restaurantId, req.user.id));
    if (!owns) return res.status(403).json({ error: "You don't own this restaurant" });

    const orders = await orderModel.findByRestaurant(restaurantId, {
      status: req.query.status,
      limit: Math.min(parseInt(req.query.limit) || 50, 100),
      offset: parseInt(req.query.offset) || 0,
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

/** Restaurant admin advances the order through its lifecycle (placed -> confirmed -> ... -> delivered) */
async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!orderModel.VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const order = await orderModel.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const owns = req.user.role === "super_admin" || (await restaurantModel.isOwnedBy(order.restaurant_id, req.user.id));
    if (!owns) return res.status(403).json({ error: "You don't own this restaurant" });

    if (!orderModel.canTransition(order.status, status)) {
      return res.status(400).json({
        error: `Cannot move order from "${order.status}" to "${status}"`,
      });
    }

    const updated = await orderModel.updateStatus(order.id, status);

    // Notify the customer in real time (Phase 5 wires up the actual customer-side listener)
    const io = req.app.get("io");
    if (io) io.to(`customer:${order.customer_id}`).emit("order:statusUpdate", { orderId: order.id, status });

    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
}

/** Customer can cancel their own order, but only while it's still early in the lifecycle */
async function cancelOrder(req, res, next) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.customer_id !== req.user.id) {
      return res.status(403).json({ error: "You can only cancel your own orders" });
    }
    if (!orderModel.canTransition(order.status, "cancelled")) {
      return res.status(400).json({ error: `Order can no longer be cancelled (current status: ${order.status})` });
    }

    const updated = await orderModel.updateStatus(order.id, "cancelled");
    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { placeOrder, getOrder, myOrders, restaurantOrders, updateStatus, cancelOrder };
