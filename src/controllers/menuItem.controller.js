const menuItemModel = require("../models/menuItem.model");
const restaurantModel = require("../models/restaurant.model");
const { uploadBuffer } = require("../config/cloudinary");

/** Shared helper: confirms the logged-in user owns the restaurant this menu item belongs to */
async function assertOwnsRestaurant(restaurantId, user) {
  if (user.role === "super_admin") return true;
  return restaurantModel.isOwnedBy(restaurantId, user.id);
}

async function create(req, res, next) {
  try {
    const { restaurantId, name, description, price, category } = req.body;

    if (!restaurantId || !name || price === undefined) {
      return res.status(400).json({ error: "restaurantId, name, and price are required" });
    }
    if (isNaN(price) || Number(price) < 0) {
      return res.status(400).json({ error: "price must be a valid non-negative number" });
    }

    const owns = await assertOwnsRestaurant(restaurantId, req.user);
    if (!owns) return res.status(403).json({ error: "You don't own this restaurant" });

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadBuffer(req.file.buffer, "menu-items");
    }

    const item = await menuItemModel.create({
      restaurantId,
      name,
      description,
      price: Number(price),
      imageUrl,
      category,
    });

    res.status(201).json({ menuItem: item });
  } catch (err) {
    next(err);
  }
}

/** Public: full menu for a restaurant (customers only see available items) */
async function listByRestaurant(req, res, next) {
  try {
    const items = await menuItemModel.findByRestaurant(req.params.restaurantId, {
      onlyAvailable: true,
    });
    res.json({ menuItems: items });
  } catch (err) {
    next(err);
  }
}

/** Restaurant admin: sees ALL items including unavailable ones, for management */
async function listByRestaurantAdmin(req, res, next) {
  try {
    const owns = await assertOwnsRestaurant(req.params.restaurantId, req.user);
    if (!owns) return res.status(403).json({ error: "You don't own this restaurant" });

    const items = await menuItemModel.findByRestaurant(req.params.restaurantId, {
      onlyAvailable: false,
    });
    res.json({ menuItems: items });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const item = await menuItemModel.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Menu item not found" });

    const owns = await assertOwnsRestaurant(item.restaurant_id, req.user);
    if (!owns) return res.status(403).json({ error: "You don't own this menu item's restaurant" });

    const updateFields = { ...req.body };
    if (updateFields.price !== undefined) {
      if (isNaN(updateFields.price) || Number(updateFields.price) < 0) {
        return res.status(400).json({ error: "price must be a valid non-negative number" });
      }
      updateFields.price = Number(updateFields.price);
    }
    if (req.file) {
      updateFields.image_url = await uploadBuffer(req.file.buffer, "menu-items");
    }

    const updated = await menuItemModel.update(req.params.id, updateFields);
    res.json({ menuItem: updated });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const item = await menuItemModel.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Menu item not found" });

    const owns = await assertOwnsRestaurant(item.restaurant_id, req.user);
    if (!owns) return res.status(403).json({ error: "You don't own this menu item's restaurant" });

    await menuItemModel.remove(req.params.id);
    res.json({ message: "Menu item deleted" });
  } catch (err) {
    next(err);
  }
}

/** Quick toggle for "86'ing" an item (marking sold out) - a real restaurant-ops feature */
async function toggleAvailability(req, res, next) {
  try {
    const item = await menuItemModel.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Menu item not found" });

    const owns = await assertOwnsRestaurant(item.restaurant_id, req.user);
    if (!owns) return res.status(403).json({ error: "You don't own this menu item's restaurant" });

    const updated = await menuItemModel.update(req.params.id, { is_available: !item.is_available });
    res.json({ menuItem: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, listByRestaurant, listByRestaurantAdmin, update, remove, toggleAvailability };
