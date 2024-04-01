const mongoose = require("mongoose");

const dataSchema = new mongoose.Schema(
  {
    nodes: [
      {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: "builder_nodes",
      },
    ],
    edges: [
      {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: "builder_edges",
      },
    ],
    enabled: {
      required: true,
      type: Boolean,
    },
  },
  { collection: "builder_inventory", strict: false }
);

module.exports = mongoose.model("builder_inventory", dataSchema);
