const restaurantModel = require("../models/restaurant.model");
const { uploadBuffer } = require("../config/cloudinary");

/** Restaurant admin creates their restaurant profile */
async function create(req, res, next) {
  try {
    const { name, description, address, phone } = req.body;
    if (!name) return res.status(400).json({ error: "Restaurant name is required" });

    let logoUrl = null;
    if (req.file) {
      logoUrl = await uploadBuffer(req.file.buffer, "restaurant-logos");
    }

    const restaurant = await restaurantModel.create({
      ownerId: req.user.id,
      name,
      description,
      address,
      phone,
      logoUrl,
    });

    res.status(201).json({ restaurant });
  } catch (err) {
    next(err);
  }
}

/** Public: browse all open restaurants */
async function listPublic(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;
    const restaurants = await restaurantModel.listOpen({ limit, offset });
    res.json({ restaurants });
  } catch (err) {
    next(err);
  }
}

/** Public: single restaurant details */
async function getById(req, res, next) {
  try {
    const restaurant = await restaurantModel.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });
    res.json({ restaurant });
  } catch (err) {
    next(err);
  }
}

/** Restaurant admin: list their own restaurant(s) */
async function myRestaurants(req, res, next) {
  try {
    const restaurants = await restaurantModel.findByOwner(req.user.id);
    res.json({ restaurants });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const restaurant = await restaurantModel.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

    if (restaurant.owner_id !== req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "You don't own this restaurant" });
    }

    const updateFields = { ...req.body };
    if (req.file) {
      updateFields.logo_url = await uploadBuffer(req.file.buffer, "restaurant-logos");
    }

    const updated = await restaurantModel.update(req.params.id, updateFields);
    res.json({ restaurant: updated });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const restaurant = await restaurantModel.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

    if (restaurant.owner_id !== req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "You don't own this restaurant" });
    }

    await restaurantModel.remove(req.params.id);
    res.json({ message: "Restaurant deleted" });
  } catch (err) {
    next(err);
  }
}

/** Toggle open/closed - a small but "real" operational feature restaurant owners need */
async function toggleOpen(req, res, next) {
  try {
    const restaurant = await restaurantModel.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

    if (restaurant.owner_id !== req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({ error: "You don't own this restaurant" });
    }

    const updated = await restaurantModel.update(req.params.id, { is_open: !restaurant.is_open });
    res.json({ restaurant: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, listPublic, getById, myRestaurants, update, remove, toggleOpen };
