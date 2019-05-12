var mongoose = require('mongoose');
const Schema = mongoose.Schema;

var commentSchema = new mongoose.Schema({
  authorEmail: {
    type: String,
    required: true
  },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  timestamp: {
		type: Date,
		required: true
	},
  rawContent: {
    type: String,
    required: true
  },
  parsedContent: {
    type: String
  },
  mentions: [String],
  tags: [String],
  images_v3: [{ type: Schema.Types.ObjectId, ref: 'Image' }]
});

var postSchema = new mongoose.Schema({
  type: String,
  community: { type: Schema.Types.ObjectId, ref: 'Community' },
  authorEmail: {
    type: String,
    required: true
  },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  url: {
    type: String,
    required: true
  },
  privacy: {
    type: String,
    required: true
  },
  timestamp: {
		type: Date,
		required: true
	},
  lastUpdated: {
    type: Date
  },
  rawContent: {
    type: String
  },
  parsedContent: {
    type: String
  },
  comments: [commentSchema],
  boostTarget: { type: Schema.Types.ObjectId, ref: 'Post' },
  // boosts: [boostSchema],
  numberOfComments: {
    type: Number
  },
  mentions: [String],
  tags: [String],
  boosts: [String],
  contentWarnings: String,
  commentsDisabled: Boolean,
  imageVersion: Number,
  images: [String],
  imageTags: [String],
  imageDescriptions: [String],
  images_v3: [{ type: Schema.Types.ObjectId, ref: 'Image' }],
  subscribedUsers: [String],
  unsubscribedUsers: [String]
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Post', postSchema);
