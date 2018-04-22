const mongoose = require('mongoose');

const tickerSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
},
{
    timestamps: true, strict: false
});

module.exports = mongoose.model('ticker', tickerSchema);
