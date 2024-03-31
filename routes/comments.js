const express = require("express");
const auth = require("../middleware/auth");
const mailgun = require("../config/mailgun");
const { sendSMS } = require("../config/termii");
const Product = require("../models/product");
const Comment = require("../models/comment");
const User = require("../models/user");
const router = express.Router();

router.post("/:productId", auth, async (req, res) => {
  try {
    const { content } = req.body;
    const productId = req.params.productId;
    const userId = req.user.id;

    if (!content || !productId) {
      return res.status(400).json({ msg: "Missing content or product ID." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ msg: "Product not found." });
    }

    const newComment = new Comment({
      content,
      user: userId,
      product: productId,
    });

    // Save the comment
    const savedComment = await newComment.save();

    // Add comment to product's comments array
    product.comments.push(savedComment._id);
    await product.save();

    const parentCommentId = req.body.parentCommentId;
    if (parentCommentId !== null || parentCommentId !== undefined) {
      const parentComment = await Comment.findById(parentCommentId).populate(
        "user"
      );

      // Ensure the parent comment exists
      if (!parentComment) {
        return res.status(404).json({ msg: "Parent comment not found." });
      }

      // Send notifications to the user of the parent comment
      const parentUser = await User.findById(parentComment.user?._id);
      const senderUser = await User.findById(userId);

      // Send email notification using Mailgun
      const emailData = {
        from: `Taski <mailgun@${process.env.MAILGUN_DOMAIN}>`,
        to: parentUser.email,
        subject: "Someone replied to your comment!",
        text: `Hi ${parentUser.username},\n\n${senderUser.username} has replied to your comment on the product: ${product.name}.`,
      };

      await mailgun.messages().send(emailData, (error, body) => {
        if (error) {
          console.error("Mailgun msg:", error);
        }
      });

      // Send SMS notification using Termii
      // await sendSMS(
      //   parentUser.phone.replace(/\s+/g, "").replace("+", ""),
      //   `Hi ${parentUser.username}, ${senderUser.username} has replied to your comment on the product: ${product.name}.`
      // );

      // Add reply to parent comment's replies array
      parentComment.replies.push(savedComment._id);
      await parentComment.save();
    }

    res.status(201).json(savedComment);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

router.get("/product-comments/:productId", auth, async (req, res) => {
  try {
    const productId = req.params.productId;

    if (!productId) {
      return res.status(400).json({ msg: "Product ID is required." });
    }

    const productExists = await Product.exists({ _id: productId });
    if (!productExists) {
      return res.status(404).json({ msg: "Product not found." });
    }

    // Find comments associated with the product and populate the user details
    const comments = await Comment.find({ product: productId })
      .populate("user", "username")
      .sort({ createdAt: -1 }); // Sorted by newest first

    res.json(comments);
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

module.exports = router;
