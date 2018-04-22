const mongoose = require('mongoose');

const transactionSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
},
{
    timestamps: true, strict: false
});

module.exports = mongoose.model('transaction', transactionSchema);
