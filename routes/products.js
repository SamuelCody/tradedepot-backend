const express = require("express");
const multer = require("multer");
const Product = require("../models/product");
const User = require("../models/user");
const auth = require("../middleware/auth");
const firestore = require("../firebase");
const router = express.Router();

// Configure Multer for image upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/upload", auth, upload.single("image"), async (req, res) => {
  try {
    if (!req.user)
      return res.status(403).json({ msg: "No user authenticated" });

    const { name, radius = 0, coordinate, price, address } = req.body;

    if (!name || !coordinate || !price || !address) {
      return res.status(400).json({ msg: "Please enter all product fields" });
    }

    // Convert the image buffer to a Base64 string (if an image was uploaded)
    const base64Image = req.file
      ? `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`
      : null;

    const newProduct = new Product({
      name,
      image: base64Image,
      location: {
        type: "Point",
        coordinates: JSON.parse(coordinate),
      },
      address,
      radius: parseFloat(radius),
      user: req.user.id,
      price,
    });

    // Save product to MongoDB
    const savedProduct = await newProduct.save();

    // Sync to Firestore
    const firestoreDoc = firestore
      .collection("products")
      .doc(savedProduct?._id?.toString());
    console.log(firestoreDoc);
    await firestoreDoc.set({
      name: savedProduct.name,
      image: savedProduct.image.toString("base64"), // Store image as base64 if included
      location: JSON.stringify(savedProduct.location),
      radius: savedProduct.radius,
      user: JSON.stringify(savedProduct.user),
      price: savedProduct.price,
    });

    res.status(201).json({ product: savedProduct });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: error.message });
  }
});

router.get("/nearme", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(400).json({ msg: "User does not exist." });
    }

    const userLocation = user.address.location.coordinates;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const productsPipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: userLocation },
          distanceField: "dist.calculated",
          maxDistance: 100000,
          spherical: true,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $unwind: "$userInfo",
      },
      {
        $project: {
          "userInfo.password": 0,
          "userInfo.__v": 0,
        },
      },
    ];

    const products = await Product.aggregate(productsPipeline);

    const totalProductsCount = await Product.find({
      location: {
        $geoWithin: {
          $centerSphere: [userLocation, 100000 / 6378100],
        },
      },
    }).countDocuments();

    res.json({
      totalPages: Math.ceil(totalProductsCount / limit),
      currentPage: page,
      products,
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

router.get("/product-detail/:productId", auth, async (req, res) => {
  try {
    const productId = req.params.productId;

    if (!productId) {
      return res.status(400).json({ msg: "Product ID is required." });
    }

    const product = await Product.findById(productId).populate(
      "user",
      "username"
    );

    if (!product) {
      return res.status(404).json({ msg: "Product not found." });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

module.exports = router;
