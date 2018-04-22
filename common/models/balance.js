const mongoose = require('mongoose');

const balanceSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
},
{
    timestamps: true, strict: false
});

module.exports = mongoose.model('balance', balanceSchema);
